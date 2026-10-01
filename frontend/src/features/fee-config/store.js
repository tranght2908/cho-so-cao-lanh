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
    // Giá mặt bằng mới được định danh bằng mã loại diện tích. Các bản ghi cũ
    // chưa có mã này được giữ nguyên để xem lịch sử, không suy đoán/migrate từ nhãn text.
    if (cat === 'stallPrices' && rec.areaTypeId === undefined) rec.areaTypeId = null;
    if (cat === 'utilities') {
      rec.elecUnit = rec.elecUnit || 'đ/kWh';
      rec.waterUnit = rec.waterUnit || 'đ/m³';
    }
    return rec;
  }
  // DON_GIA_MAT_BANG_DUNG_CHUNG (01/10/2026): đơn giá mặt bằng áp dụng chung nhiều chợ — scope 'SHARED',
  // marketId null, danh sách chợ ở marketIds[] (market applicability). QĐ 480/QĐ-UBND ngày 14/02/2026 của UBND
  // tỉnh Đồng Tháp, Phụ lục STT 7–17: 11 chợ phường Cao Lãnh cùng 3 mức. Seed 10 chợ; TTD (NEED_CONFIRMATION: chưa
  // rõ có phải "Chợ Tân Thuận Đông" trong QĐ) và CL (không có trong QĐ 480) KHÔNG gán. Bổ sung đúng 1 lần theo id
  // cố định (marker qd480LandSeed) cho cấu hình đã lưu. Bản ghi SHARED chưa nối vào tính khoản phải thu: billing
  // vẫn lọc theo marketId một chợ cho tới khi điểm KD được gán loại diện tích theo QĐ 480.
  const QD480_MARKETS = ['HA', 'TVH', 'TTT', 'TL', 'TT', 'TTH', 'MN', 'LH', 'XB', 'SQ'];
  const QD480_LEGAL = { docNo: '480/QĐ-UBND', docDate: '2026-02-14', issuer: 'UBND tỉnh Đồng Tháp', summary: 'Ban hành giá dịch vụ sử dụng diện tích bán hàng tại chợ được đầu tư từ nguồn vốn nhà nước trên địa bàn tỉnh Đồng Tháp', effectiveDate: '2026-02-15', note: 'Phụ lục STT 7–17 (các chợ phường Cao Lãnh). Giá đã bao gồm thuế VAT.' };
  // v2: loại điểm kinh doanh lấy từ danh mục loại diện tích (U.AREA_TYPE_CODES, khai báo ở Danh mục chợ) thay
  // cho tên tự nhập; bản ghi v1 đã lưu được gán areaTypeId tương ứng và bỏ landTypeName.
  const QD480_LAND = [
    ['sp-qd480-mai-che', 'covered', 2000],
    ['sp-qd480-khong-mai-che', 'uncovered', 1500],
    ['sp-qd480-tu-san-tu-tieu', 'self_produced', 1000]
  ];
  function ensureQd480LandPrices(cfg) {
    if (cfg.qd480LandSeed >= 2) return;
    QD480_LAND.forEach(([id, areaTypeId]) => {
      const r = cfg.stallPrices.find(x => x.id === id);
      if (r && !r.areaTypeId) { r.areaTypeId = areaTypeId; delete r.landTypeName; }
    });
    QD480_LAND.forEach(([id, areaTypeId, amount]) => {
      if (cfg.stallPrices.some(r => r.id === id)) return;
      cfg.stallPrices.push(normalizeRecord('stallPrices', { id, scope: 'SHARED', marketId: null, marketIds: QD480_MARKETS.slice(), areaTypeId, marketGrades: [2, 3],
        amount, unit: 'đ/m²/ngày', effectiveFrom: '2026-02-15', effectiveTo: null, status: 'active', legalBasis: clone(QD480_LEGAL), attachments: [],
        history: [{ time: '14/02/2026 00:00', user: 'Hệ thống', action: 'Tạo cấu hình', detail: 'Khai báo theo QĐ 480/QĐ-UBND · ' + amount.toLocaleString('vi-VN') + ' đ/m²/ngày · ' + QD480_MARKETS.length + ' chợ' }] }));
    });
    cfg.qd480LandSeed = 2;
  }
  // DON_GIA_DIEN_NUOC_RIENG (01/10/2026): mỗi bản ghi utilities cũ chứa CẢ giá điện lẫn giá nước → tách thành 2 bản
  // ghi kind 'ELECTRICITY' / 'WATER' (cùng chợ, hiệu lực, trạng thái, căn cứ, lịch sử) để tab Điện / Nước có danh
  // sách, vô hiệu hóa và lịch sử riêng. Chạy đúng 1 lần (marker utilitiesSplitV1); billing chọn giá theo kind.
  function splitUtilityRecords(cfg) {
    if (cfg.utilitiesSplitV1 >= 1) return;
    const out = [];
    cfg.utilities.forEach(r => {
      if (r.kind) { out.push(r); return; }
      [['ELECTRICITY', '-dien', 'elecPrice', 'waterPrice', 'điện'], ['WATER', '-nuoc', 'waterPrice', 'elecPrice', 'nước']].forEach(([kind, suffix, keep, drop, label]) => {
        if (r[keep] == null) return;
        const x = clone(r);
        x.id = r.id + suffix; x.kind = kind; x[drop] = null; x.splitFromId = r.id;
        x.history = [{ time: nowStrSafe(), user: 'Hệ thống', action: 'Tách đơn giá', detail: 'Tách đơn giá ' + label + ' khỏi bản ghi điện, nước chung ' + r.id }].concat(x.history || []);
        out.push(x);
      });
    });
    cfg.utilities = out;
    cfg.utilitiesSplitV1 = 1;
  }
  function normalizeConfig(cfg) {
    // HINH_THUC_THU_DIEN_NUOC: mỗi chợ chọn 1 trong 2 hình thức (mặc định METER — giữ hành vi cũ):
    //   METER   = theo công tơ từng điểm KD, ghi chỉ số hằng tháng, khoản phải thu tính theo chỉ số;
    //   SERVICE = chia đều, thu như DỊCH VỤ CHỢ (khai báo ở tab Dịch vụ chợ) — không ghi chỉ số, bước
    //             tính/phát hành khoản thu KHÔNG tạo dòng tiền điện/nước theo công tơ.
    cfg.utilityModes = cfg.utilityModes && typeof cfg.utilityModes === 'object' ? cfg.utilityModes : {};
    Object.keys(cfg.utilityModes).forEach(mid => {
      if (cfg.utilityModes[mid] && cfg.utilityModes[mid].mode === 'SERVICE') {
        cfg.utilityModes[mid].mode = 'METER';
        cfg.utilityModes[mid].history = cfg.utilityModes[mid].history || [];
        cfg.utilityModes[mid].history.unshift({ time: nowStrSafe(), user: 'Hệ thống', action: 'Chuẩn hóa hình thức thu', detail: 'Chia đều → Theo công tơ từng điểm kinh doanh' });
      }
    });
    cfg.waiverTypes = Array.isArray(cfg.waiverTypes) ? cfg.waiverTypes : clone(D.WAIVER_TYPES || []);
    cfg.complaintRules = cfg.complaintRules && typeof cfg.complaintRules === 'object' ? cfg.complaintRules : {};
    if (cfg.complaintRules.ratingAutoCloseDays === undefined) cfg.complaintRules.ratingAutoCloseDays = null;
    if (!Array.isArray(cfg.complaintRules.history)) cfg.complaintRules.history = [];
    ['stallPrices', 'utilities', 'extraServices'].forEach(cat => {
      cfg[cat] = Array.isArray(cfg[cat]) ? cfg[cat] : [];
      cfg[cat].forEach(rec => normalizeRecord(cat, rec));
    });
    ensureQd480LandPrices(cfg);
    splitUtilityRecords(cfg);
    // Lịch kỳ thu mới giữ các field cũ để dữ liệu localStorage đã có tiếp tục dùng được.
    // Các mốc mới chỉ là cấu hình lịch mặc định; không kích hoạt phát hành khoản phải thu.
    const cycle = cfg.billingCycle || {};
    cycle.preparationDay = Number(cycle.preparationDay) || Number(cycle.meterCutoffDay) || 25;
    cycle.meterReadDay = Number(cycle.meterReadDay) || Number(cycle.meterCutoffDay) || 25;
    cycle.collectionStartDay = Number(cycle.collectionStartDay) || 29;
    cycle.dueMonth = cycle.dueMonth === 'current' ? 'current' : 'next';
    if (cycle.prepareNotification === undefined) cycle.prepareNotification = true;
    // autoIssue là field legacy không còn được UI/handler dùng; luôn vô hiệu theo luồng mới.
    cycle.autoIssue = false;
    cfg.billingCycle = cycle;
    return cfg;
  }

  function nowStrSafe() { return new Date().toLocaleString('vi-VN'); }

  function defaultConfig() {
    const rateSeed = clone(D.RATE_POLICY_SEED || { stallPrices: [], utilities: [], extraServices: [] });
    return normalizeConfig(Object.assign(rateSeed, {
      waiverTypes: clone(D.WAIVER_TYPES || []),
      billingCycle: {
        cycle: 'monthly', preparationDay: 25, meterReadDay: 25, meterCutoffDay: 25, issueDay: 28, collectionStartDay: 29, dueDay: 3, dueMonth: 'next', prepareNotification: true,
        // Field legacy: giữ nguyên để không làm mất dữ liệu/policy đang được module khác đọc.
        reminder1Days: 3, reminder2Days: 7, autoIssue: false, autoRemind: true,
        legalBasis: { docNo: '', docDate: '', issuer: 'Ban Quản lý chợ', summary: 'Quy định kỳ thu, ngày phát hành và hạn nộp', effectiveDate: '2026-01-01', note: '' },
        attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo cấu hình', detail: 'Kỳ thu hằng tháng · phát hành ngày 01 · hạn nộp ngày 15' }]
      },
      billingRules: {
        allowAdjust: true, allowWaiver: true, requireReason: true, waiverApprovalThreshold: 10, approverRoleId: 'bql',
        allowPartialPay: true, allowVoidReceipt: true, requireNoteOnAdjust: true,
        legalBasis: { docNo: '', docDate: '', issuer: 'Ban Quản lý chợ', summary: 'Quy tắc điều chỉnh, miễn giảm khoản phải thu', effectiveDate: '2026-01-01', note: '' },
        attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo cấu hình', detail: 'Ngưỡng phê duyệt miễn giảm 10%' }]
      },
      complaintRules: {
        ratingAutoCloseDays: null,
        history: [{ time: '01/01/2026 08:00', user: 'Hệ thống', action: 'Tạo cấu hình', detail: 'Chưa cấu hình thời gian chờ đánh giá phản ánh' }]
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
    cycle: () => CFG.billingCycle,
    updateCycle: (patch, user, detail) => { Object.assign(CFG.billingCycle, patch); SC.log(CFG.billingCycle, user, 'Cập nhật kỳ thu', detail || ''); },
    rules: () => CFG.billingRules,
    updateRules: (patch, user, detail) => { Object.assign(CFG.billingRules, patch); SC.log(CFG.billingRules, user, 'Cập nhật quy tắc thu phí', detail || ''); },
    complaintRules: () => CFG.complaintRules,
    updateComplaintRules: (patch, user, detail) => { Object.assign(CFG.complaintRules, patch); SC.log(CFG.complaintRules, user, 'Cập nhật quy tắc phản ánh', detail || ''); },
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

  // KY_09_DEN_GHI_CHI_SO (seed v29): không còn tự bổ sung kỳ demo 10/2026 — kỳ đang làm là 09/2026,
  // mọi kỳ sau chỉ được tạo khi người dùng thao tác tiếp luồng thu phí.

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
