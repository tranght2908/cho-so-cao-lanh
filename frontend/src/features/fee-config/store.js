/* Dữ liệu "Chính sách thu và biểu phí". Ba collection đơn giá (stallPrices/utilities/
 * extraServices) lấy seed cố định từ data.js và được UI hiển thị tại Tài chính > Quản lý khai báo.
 * billingCycle/billingRules (Kỳ thu/Quy tắc thu phí) vẫn ở Cài đặt & phân quyền, không đổi.
 * Module tiếp tục dùng đúng localStorage hiện có để lưu thao tác demo; không tạo storage mới.
 * Đây chỉ là kho cấu hình UI prototype (đơn giá, điện nước, dịch vụ khác, kỳ thu, quy tắc
 * thu phí), có căn cứ pháp lý + tài liệu đính kèm (mock, không upload server) + lịch sử thay
 * đổi. Các màn tài chính thật (Khoản phải thu, Thu tiền, Chỉ số điện nước...) KHÔNG đọc từ
 * đây — tránh gây regression cho nghiệp vụ tính tiền đang chạy dựa trên data.js. STEP A này
 * KHÔNG nối biểu giá vào thuật toán tính khoản phải thu (xem ghi chú UI trên A.VIEWS['cau-hinh-gia']).
 */
(function (A) {
  'use strict';
  const D = window.DATA;
  const U = A.U;
  const SKEY = 'choso-caolanh-serviceconfig';
  let seq = 0;
  const newId = p => p + '_' + Date.now().toString(36) + (++seq);

  function emptyLegal() { return { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' }; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function marketModelFor(marketId) { return marketId === 'TTD' ? 'MARKET_SESSION' : 'FIXED_MONTHLY'; }
  function cycleFor(marketId) { return marketId === 'TTD' ? 'SESSION' : 'MONTH'; }
  function normalizeRecord(cat, rec) {
    rec.marketModel = rec.marketModel || marketModelFor(rec.marketId);
    rec.collectionCycle = rec.collectionCycle || cycleFor(rec.marketId);
    rec.taxClass = rec.taxClass || (cat === 'utilities' ? 'PASS_THROUGH_NON_TAX' : 'TAXABLE_REVENUE');
    if (rec.waiverTypeId === undefined) rec.waiverTypeId = null;
    if (rec.effectiveTo === undefined) rec.effectiveTo = null;
    if (cat === 'utilities') {
      rec.elecUnit = rec.elecUnit || 'đ/kWh';
      rec.waterUnit = rec.waterUnit || 'đ/m³';
    }
    return rec;
  }
  function normalizeConfig(cfg) {
    // HINH_THUC_THU_DIEN_NUOC: mỗi chợ chọn 1 trong 2 hình thức (mặc định METER — giữ hành vi cũ):
    //   METER   = theo công tơ từng điểm KD, ghi chỉ số hằng tháng, khoản phải thu tính theo chỉ số;
    //   SERVICE = chia đều, thu như DỊCH VỤ CHỢ (khai báo ở tab Dịch vụ chợ) — không ghi chỉ số, bước
    //             tính/phát hành khoản thu KHÔNG tạo dòng tiền điện/nước theo công tơ.
    cfg.utilityModes = cfg.utilityModes && typeof cfg.utilityModes === 'object' ? cfg.utilityModes : {};
    // DIEN_NUOC_CHIA_DEU_THEO_THANG: chợ SERVICE — mỗi tháng Tổ trưởng nhập tiền điện, nước chia đều / điểm KD.
    // Chỉ THÊM dòng (append-only): nhập lại cùng tháng → dòng cũ 'superseded', dòng mới 'active'.
    cfg.utilityFlat = Array.isArray(cfg.utilityFlat) ? cfg.utilityFlat : [];
    // v51+: mỗi dòng 1 LOẠI tiền (ELECTRICITY | WATER) × 1 tháng × 1 khu vực (ALL | IND:<ngành> | ROW:<dãy>).
    // Tách dòng kiểu cũ (điện + nước chung 1 dòng) thành 2 dòng.
    cfg.utilityFlat = [].concat.apply([], cfg.utilityFlat.map(r => r.kind ? [r] : [['ELECTRICITY', 'elecPerPoint', 'elecTotal', 'E'], ['WATER', 'waterPerPoint', 'waterTotal', 'W']].filter(k => Number(r[k[1]] || 0) > 0).map(k => ({
      id: r.id + '-' + k[3], marketId: r.marketId, kind: k[0], period: r.period, area: 'ALL', method: r.method === 'SPLIT_TOTAL' ? 'SPLIT_TOTAL' : 'AREA_RATE',
      total: r[k[2]] == null ? null : Number(r[k[2]]), pointCount: r.pointCount || 0, perPoint: Number(r[k[1]]), basis: r.basis || '', note: '',
      status: r.status === 'superseded' ? 'inactive' : 'active', createdBy: r.createdBy, createdAt: r.createdAt, inactivatedAt: r.supersededAt || null, inactivatedBy: r.supersededBy || null,
      history: [{ time: r.createdAt || '', user: r.createdBy || '', action: 'Chuyển dữ liệu', detail: 'Tách từ dòng ' + r.id }] }))));
    cfg.waiverTypes = Array.isArray(cfg.waiverTypes) ? cfg.waiverTypes : clone(D.WAIVER_TYPES || []);
    ['stallPrices', 'utilities', 'extraServices'].forEach(cat => {
      cfg[cat] = Array.isArray(cfg[cat]) ? cfg[cat] : [];
      cfg[cat].forEach(rec => normalizeRecord(cat, rec));
    });
    // GIA_DIEN_NUOC_THEO_LOAI (P chốt 29/09/2026): giá điện và giá nước là 2 dòng riêng (kind ELECTRICITY/WATER).
    // Mỗi loại luôn có đúng 1 giá đang áp dụng; thêm giá mới → giá cũ tự vô hiệu hóa từ ngày giá mới có hiệu lực
    // (đầu tháng sau trở đi), dữ liệu cũ + nhật ký thay đổi được giữ. Lần đầu: tách từ cấu hình 'utilities' cũ.
    cfg.utilityPrices = Array.isArray(cfg.utilityPrices) ? cfg.utilityPrices : [];
    cfg.utilities.filter(u => u.status === 'active').forEach(u => {
      [['ELECTRICITY', 'E', 'elecPrice', 'elecUnit', 'đ/kWh'], ['WATER', 'W', 'waterPrice', 'waterUnit', 'đ/m³']].forEach(k => {
        if (cfg.utilityPrices.some(p => p.marketId === u.marketId && p.kind === k[0])) return;
        cfg.utilityPrices.push({ id: 'GIA-' + u.marketId + '-' + k[1] + '-01', marketId: u.marketId, kind: k[0], price: Number(u[k[2]] || 0), unit: u[k[3]] || k[4],
          effectiveFrom: u.effectiveFrom || '2026-01-01', effectiveTo: u.effectiveTo || null, status: 'active', legalBasis: clone(u.legalBasis || emptyLegal()), prevId: null,
          createdBy: 'Dữ liệu chuyển tiếp', createdAt: '01/01/2026 08:00', history: [{ time: '01/01/2026 08:00', user: 'Hệ thống', action: 'Chuyển từ cấu hình điện & nước cũ', detail: 'Tách từ ' + u.id }] });
      });
    });
    return cfg;
  }

  function defaultConfig() {
    const rateSeed = clone(D.RATE_POLICY_SEED || { stallPrices: [], utilities: [], extraServices: [] });
    return normalizeConfig(Object.assign(rateSeed, {
      waiverTypes: clone(D.WAIVER_TYPES || []),
      billingCycle: {
        cycle: 'monthly', meterCutoffDay: 28, issueDay: 1, dueDay: 15, reminder1Days: 3, reminder2Days: 7,
        autoIssue: true, autoRemind: true,
        legalBasis: { docNo: '', docDate: '', issuer: 'Ban Quản lý chợ', summary: 'Quy định kỳ thu, ngày phát hành và hạn nộp', effectiveDate: '2026-01-01', note: '' },
        attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo cấu hình', detail: 'Kỳ thu hằng tháng · phát hành ngày 01 · hạn nộp ngày 15' }]
      },
      billingRules: {
        allowAdjust: true, allowWaiver: true, requireReason: true, waiverApprovalThreshold: 10, approverRoleId: 'bql',
        allowPartialPay: true, allowVoidReceipt: true, requireNoteOnAdjust: true,
        legalBasis: { docNo: '', docDate: '', issuer: 'Ban Quản lý chợ', summary: 'Quy tắc điều chỉnh, miễn giảm khoản phải thu', effectiveDate: '2026-01-01', note: '' },
        attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo cấu hình', detail: 'Ngưỡng phê duyệt miễn giảm 10%' }]
      }
    }));
  }

  function loadConfig() {
    try {
      const s = localStorage.getItem(SKEY);
      if (s) { const x = JSON.parse(s); if (x && x.stallPrices && x.billingCycle && x.billingRules) return normalizeConfig(x); }
    } catch (e) { /* bỏ qua */ }
    return defaultConfig();
  }
  let CFG = loadConfig();
  function save() { try { localStorage.setItem(SKEY, JSON.stringify(CFG)); } catch (e) { /* bỏ qua */ } }
  function nowStr() { return A.U.dmy(A.U.today()) + ' ' + A.U.nowTime(); }

  const SC = A.SERVICE_CFG = {
    KEY: SKEY,
    data: () => CFG,
    list: cat => CFG[cat],
    waiverTypes: () => CFG.waiverTypes || [],
    get: (cat, id) => CFG[cat].find(x => x.id === id),
    add: (cat, rec, user) => {
      rec.id = newId(cat);
      rec.attachments = rec.attachments || [];
      rec.history = [];
      CFG[cat].push(rec);
      SC.log(rec, user, 'Tạo cấu hình', rec.__detail || '');
      return rec;
    },
    update: (cat, id, patch, user, action, detail) => {
      const r = SC.get(cat, id);
      if (!r) return;
      Object.assign(r, patch);
      SC.log(r, user, action || 'Cập nhật cấu hình', detail || '');
    },
    // Không ghi đè một bản ghi đang active. Đóng phiên bản cũ và tạo bản ghi mới có liên kết
    // previousVersionId; dữ liệu cũ vẫn được giữ để tra cứu lịch sử.
    createVersion: (cat, id, next, user, detail) => {
      const current = SC.get(cat, id);
      if (!current || current.status !== 'active') return null;
      const eff = next.effectiveFrom;
      const end = eff ? new Date(eff + 'T00:00:00') : null;
      if (end && !isNaN(end.getTime())) { end.setDate(end.getDate() - 1); current.effectiveTo = end.toISOString().slice(0, 10); }
      else current.effectiveTo = eff || current.effectiveFrom;
      current.status = 'expired';
      SC.log(current, user, 'Kết thúc hiệu lực', 'Được thay thế bởi phiên bản có hiệu lực từ ' + (eff || '—'));
      const rec = normalizeRecord(cat, Object.assign({}, next));
      rec.id = newId(cat);
      rec.previousVersionId = current.id;
      rec.status = 'active';
      rec.effectiveTo = null;
      rec.attachments = clone(current.attachments || []);
      rec.history = [];
      delete rec.__detail;
      CFG[cat].push(rec);
      SC.log(rec, user, 'Tạo phiên bản mới', detail || '');
      return rec;
    },
    setStatus: (cat, id, status, user) => {
      const r = SC.get(cat, id);
      if (!r) return;
      if (r.status === 'expired' && status === 'active') return false;
      r.status = status;
      SC.log(r, user, status === 'active' ? 'Áp dụng phí' : status === 'draft' ? 'Mở khóa phí' : 'Khóa phí', '');
      return true;
    },
    utilityMode: mid => ((CFG.utilityModes || {})[mid] || {}).mode === 'SERVICE' ? 'SERVICE' : 'METER',
    utilityModeInfo: mid => (CFG.utilityModes || {})[mid] || { mode: 'METER', history: [] },
    setUtilityMode: (mid, mode, user, reason) => {
      CFG.utilityModes = CFG.utilityModes || {};
      const cur = CFG.utilityModes[mid] || { mode: 'METER', history: [] };
      const next = mode === 'SERVICE' ? 'SERVICE' : 'METER';
      cur.history = cur.history || [];
      cur.history.unshift({ time: nowStr(), user: user, action: 'Đổi hình thức thu điện, nước', detail: (cur.mode || 'METER') + ' → ' + next + (reason ? ' · ' + reason : '') });
      cur.mode = next; cur.updatedBy = user; cur.updatedAt = nowStr();
      CFG.utilityModes[mid] = cur;
      save();
      return cur;
    },
    utilityFlatList: mid => (CFG.utilityFlat || []).filter(r => r.marketId === mid),
    // Các dòng CÓ HIỆU LỰC của 1 loại tiền trong 1 tháng (mọi khu vực).
    utilityFlatActive: (mid, kind, period) => (CFG.utilityFlat || []).filter(r => r.marketId === mid && r.kind === kind && r.period === period && r.status === 'active'),
    // Thêm dòng mới: dòng cùng loại + cùng tháng + cùng khu vực đang có hiệu lực → vô hiệu hóa (giữ lại, có nhật ký).
    addUtilityFlat: (rec, user) => {
      CFG.utilityFlat = CFG.utilityFlat || [];
      const now = nowStr(), label = rec.kind === 'ELECTRICITY' ? 'điện' : 'nước';
      const n = CFG.utilityFlat.filter(r => r.marketId === rec.marketId).length + 1;
      const row = Object.assign({ id: 'DNCD-' + rec.marketId + '-' + String(n).padStart(3, '0') }, rec, { status: 'active', createdBy: user, createdAt: now, history: [] });
      CFG.utilityFlat.forEach(r => {
        if (r.marketId === rec.marketId && r.kind === rec.kind && r.period === rec.period && r.area === rec.area && r.status === 'active') {
          r.status = 'inactive'; r.inactivatedAt = now; r.inactivatedBy = user;
          SC.log(r, user, 'Vô hiệu hóa', 'Thay bằng ' + row.id + ' (' + Number(row.perPoint).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' đ/điểm)');
        }
      });
      CFG.utilityFlat.push(row);
      SC.log(row, user, 'Thêm tiền ' + label + ' tháng ' + rec.period.slice(5) + '/' + rec.period.slice(0, 4), (rec.method === 'SPLIT_TOTAL' ? 'Chia đều ' + Number(rec.total).toLocaleString('vi-VN') + ' đ cho ' + rec.pointCount + ' điểm trên sơ đồ → ' : 'Mức theo khu: ') + Number(rec.perPoint).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' đ/điểm · căn cứ ' + (rec.basis || '—'));
      save();
      return row;
    },
    utilityPriceList: mid => (CFG.utilityPrices || []).filter(p => p.marketId === mid),
    // Giá đang có hiệu lực tại ngày `date` (YYYY-MM-DD) của 1 loại (ELECTRICITY | WATER).
    utilityPriceAt: (mid, kind, date) => (CFG.utilityPrices || []).filter(p => p.marketId === mid && p.kind === kind && p.status === 'active' && p.effectiveFrom <= date && (!p.effectiveTo || p.effectiveTo >= date))
      .sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))[0] || null,
    // Thêm giá mới (effectiveFrom = ngày 01 của một tháng). Giá đang áp dụng kết thúc vào ngày trước đó (tự vô hiệu
    // hóa); giá "sắp áp dụng" trùng/sau mốc mới bị hủy. Không xóa bản ghi nào.
    addUtilityPrice: (mid, kind, rec, user) => {
      CFG.utilityPrices = CFG.utilityPrices || [];
      const from = rec.effectiveFrom, d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() - 1);
      const prevEnd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const same = (CFG.utilityPrices || []).filter(p => p.marketId === mid && p.kind === kind && p.status === 'active');
      const prev = same.filter(p => p.effectiveFrom < from).sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))[0] || null;
      const unitName = kind === 'ELECTRICITY' ? 'điện' : 'nước';
      same.filter(p => p.effectiveFrom >= from).forEach(p => { p.status = 'cancelled'; p.cancelledAt = nowStr(); p.cancelledBy = user; SC.log(p, user, 'Hủy giá sắp áp dụng', 'Có giá ' + unitName + ' mới từ ' + A.U.dmy(from)); });
      const n = CFG.utilityPrices.filter(p => p.marketId === mid && p.kind === kind).length + 1;
      const row = Object.assign({ id: 'GIA-' + mid + '-' + (kind === 'ELECTRICITY' ? 'E' : 'W') + '-' + String(n).padStart(2, '0'), marketId: mid, kind }, rec,
        { effectiveTo: null, status: 'active', prevId: prev ? prev.id : null, createdBy: user, createdAt: nowStr(), history: [] });
      if (prev) { prev.effectiveTo = prevEnd; // có thể rút ngắn/giữ nguyên nếu đã được đặt bởi giá sắp áp dụng vừa hủy
        SC.log(prev, user, 'Vô hiệu hóa', 'Hết hiệu lực sau ' + A.U.dmy(prevEnd) + ' · thay bằng ' + row.id + ' (' + Number(row.price).toLocaleString('vi-VN') + ' ' + row.unit + ')'); }
      CFG.utilityPrices.push(row);
      SC.log(row, user, 'Thêm giá ' + unitName + ' mới', (prev ? Number(prev.price).toLocaleString('vi-VN') + ' → ' : '') + Number(row.price).toLocaleString('vi-VN') + ' ' + row.unit + ' · hiệu lực từ ' + A.U.dmy(from) + ' · căn cứ ' + ((row.legalBasis || {}).docNo || '—'));
      save();
      return row;
    },
    cycle: () => CFG.billingCycle,
    updateCycle: (patch, user, detail) => { Object.assign(CFG.billingCycle, patch); SC.log(CFG.billingCycle, user, 'Cập nhật kỳ thu', detail || ''); },
    rules: () => CFG.billingRules,
    updateRules: (patch, user, detail) => { Object.assign(CFG.billingRules, patch); SC.log(CFG.billingRules, user, 'Cập nhật quy tắc thu phí', detail || ''); },
    log: (rec, user, action, detail) => {
      rec.history = rec.history || [];
      rec.history.unshift({ time: nowStr(), user: user, action: action, detail: detail || '' });
      save();
    },
    addAttachment: (rec, att, user) => {
      rec.attachments = rec.attachments || [];
      att.id = att.id || newId('att');
      rec.attachments.push(att);
      SC.log(rec, user, 'Thêm tài liệu', att.name);
    },
    removeAttachment: (rec, attId, user) => {
      const att = (rec.attachments || []).find(a => a.id === attId);
      rec.attachments = (rec.attachments || []).filter(a => a.id !== attId);
      SC.log(rec, user, 'Xoá tài liệu', att ? att.name : '');
    },
    resetDefault: () => { CFG = defaultConfig(); save(); }
  };

  // Applied price helpers (from js/core.js, Phase 15.6).
  // Đơn giá hiện hành của điểm KD lấy từ "Chính sách thu và biểu phí", không phải
  // đơn giá snapshot của hợp đồng. NEED_CONFIRMATION: quy tắc mapping biểu phí
  // theo khu vực/loại điểm cần được nghiệp vụ xác nhận khi có API/backend.
  U.appliedStallPrice = st => {
    if (!st) return null;
    const stallType = { kiot: 'Ki-ốt', nhalong: 'Trong nhà lồng chợ', ngoai: 'Tự sản tự tiêu', phien: 'Quầy theo phiên' }[st.type];
    if (!stallType) return null;
    const prices = A.SERVICE_CFG ? A.SERVICE_CFG.list('stallPrices') : ((D.RATE_POLICY_SEED || {}).stallPrices || []);
    const today = U.today ? U.today() : '';
    // Ưu tiên chính sách chung marketId:'ALL'; các bản ghi theo chợ cũ vẫn là
    // dữ liệu chuyển tiếp để không làm mất khả năng hiển thị của prototype cũ.
    const matches = prices.filter(r => (r.marketId === 'ALL' || r.marketId === st.market)
      && (r.stallType === stallType || r.stallType === st.cat) && r.status === 'active'
      && (!r.effectiveFrom || r.effectiveFrom <= today) && (!r.effectiveTo || r.effectiveTo >= today));
    return matches.sort((a, b) => {
      const commonFirst = Number(b.marketId === 'ALL') - Number(a.marketId === 'ALL');
      if (commonFirst) return commonFirst;
      return String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || ''));
    })[0] || null;
  };
  U.unitLabel = st => {
    const price = U.appliedStallPrice(st);
    if (!price) return 'Chưa cấu hình';
    return U.money(price.amount) + '/' + String(price.unit || '').replace(/^đ\//, '');
  };
})(window.APP);
