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
  // DEMO_TTD_FEE_POLICY v1 (prototype): Chợ quê Cù lao Tân Thuận Đông không có trong phụ lục QĐ 480 (xem D.MARKETS.priceNote)
  // nên chưa có giá mặt bằng cho điểm "Trong nhà lồng chợ" (areaTypeId 'covered') — thiếu biểu phí làm kỳ thu của TTD
  // luôn Cần xử lý. Bổ sung biểu phí DEMO đúng schema hiện có, CLONE mức giá đã tồn tại (không đặt số mới):
  //   mặt bằng  ← giá loại diện tích 'covered' đang áp dụng (QĐ 480 mái che / CL Trong nhà lồng chợ)
  //   điện/nước ← bản ghi điện/nước của chính TTD nếu có (kể cả không hiệu lực), nếu không thì của CL
  //   dịch vụ   ← dịch vụ chợ (không phải phí xe) của chính TTD nếu có, nếu không thì của CL
  // Chỉ thêm slot CHƯA có bản ghi đang hiệu lực cho kỳ demo; chạy đúng 1 lần (marker), id cố định → không trùng sau reload.
  const DEMO_MARKET = 'TTD', DEMO_REF_DATE = '2026-12-01'; // ngày mặt bằng (tháng kế tiếp) của kỳ demo 11/2026 — mốc tra cứu muộn nhất
  let recalcRequested = false;
  function ensureDemoMarketPolicies(cfg) {
    if (cfg.demoTtdFeePolicyV1 >= 1) return false;
    const live = x => x && x.status === 'active' && (!x.effectiveFrom || x.effectiveFrom <= DEMO_REF_DATE) && (!x.effectiveTo || x.effectiveTo >= DEMO_REF_DATE);
    const legal = { docNo: '', docDate: '', issuer: '', summary: 'Mức giá DEMO của prototype — chợ quê không có trong phụ lục QĐ 480; mức thu thực tế do phường quyết định.', effectiveDate: '2026-01-01', note: 'prototype-demo' };
    const stamp = { time: '05/10/2026 00:00', user: 'Hệ thống (dữ liệu demo)', action: 'Tạo cấu hình', detail: 'Bổ sung biểu phí demo cho ' + DEMO_MARKET + ' (clone từ bản ghi sẵn có)' };
    const add = (cat, id, src, patch) => {
      if (!src || cfg[cat].some(x => x.id === id)) return false;
      const rec = Object.assign(clone(src), { id, marketId: DEMO_MARKET, scope: 'MARKET', marketIds: undefined, marketGrades: undefined, status: 'active', effectiveFrom: '2026-01-01', effectiveTo: null,
        marketModel: 'FIXED_MONTHLY', collectionCycle: 'MONTH', source: 'prototype-demo', clonedFromId: src.id, legalBasis: clone(legal), attachments: [], history: [clone(stamp)] }, patch || {});
      delete rec.marketIds; delete rec.marketGrades; delete rec.previousVersionId; delete rec.splitFromId;
      cfg[cat].push(normalizeRecord(cat, rec));
      return true;
    };
    let changed = false;
    // 1. Mặt bằng — billing so khớp areaTypeId của điểm ('covered') hoặc stallType theo loại điểm (nhalong → 'Trong nhà lồng chợ').
    const landOk = cfg.stallPrices.some(x => live(x) && x.marketId === DEMO_MARKET && (x.areaTypeId === 'covered' || (!x.areaTypeId && x.stallType === 'Trong nhà lồng chợ')));
    const landSrc = cfg.stallPrices.find(x => live(x) && x.areaTypeId === 'covered') || cfg.stallPrices.find(x => live(x) && x.stallType === 'Trong nhà lồng chợ');
    if (!landOk && add('stallPrices', 'sp-ttd-demo-covered', landSrc, { areaTypeId: 'covered', stallType: 'Trong nhà lồng chợ' })) changed = true;
    // 2. Điện / nước — billing chọn theo kind + giá elecPrice / waterPrice khác null.
    [['ELECTRICITY', 'elecPrice', 'ut-ttd-demo-dien'], ['WATER', 'waterPrice', 'ut-ttd-demo-nuoc']].forEach(([kind, field, id]) => {
      const ok = cfg.utilities.some(x => live(x) && x.marketId === DEMO_MARKET && (!x.kind || x.kind === kind) && x[field] != null);
      const src = cfg.utilities.find(x => x.marketId === DEMO_MARKET && x.kind === kind && x[field] != null) || cfg.utilities.find(x => live(x) && x.marketId === 'CL' && x.kind === kind && x[field] != null);
      if (!ok && add('utilities', id, src)) changed = true;
    });
    // 3. Dịch vụ chợ — hợp đồng TTD đăng ký marketService: billing áp MỌI dịch vụ đang hiệu lực của chợ (trừ phí xe).
    const svcOk = cfg.extraServices.some(x => live(x) && x.marketId === DEMO_MARKET && x.category !== 'VEHICLE');
    const svcSrc = cfg.extraServices.find(x => x.marketId === DEMO_MARKET && x.category !== 'VEHICLE') || cfg.extraServices.find(x => live(x) && x.marketId === 'CL' && x.category !== 'VEHICLE');
    if (!svcOk && add('extraServices', 'es-ttd-demo-dich-vu', svcSrc)) changed = true;
    cfg.demoTtdFeePolicyV1 = 1;
    if (changed) recalcRequested = true;
    return true;
  }
  // Migration MỘT LẦN (marker chargeApplicabilityV1), không phá dữ liệu: chợ ĐÃ CÓ bản ghi mức thu riêng từ trước
  // (dữ liệu cũ — vd. CL, TTD) mà chưa khai báo khoản thu áp dụng → ghi khai báo suy ra từ chính các bản ghi đó
  // (điện/nước có đơn giá, dịch vụ chợ không tính phí xe). Chợ chưa có bản ghi riêng nào KHÔNG được tự khai báo.
  function ensureLegacyChargeApplicability(cfg) {
    if (cfg.chargeApplicabilityV1 >= 1) return;
    const ownedRec = r => r && r.marketId && r.marketId !== 'ALL' && r.scope !== 'SHARED' && !(Array.isArray(r.marketIds) && r.marketIds.length);
    const mids = new Set();
    ['stallPrices', 'utilities', 'extraServices'].forEach(cat => (cfg[cat] || []).forEach(r => { if (ownedRec(r)) mids.add(r.marketId); }));
    mids.forEach(mid => {
      const cur = cfg.utilityModes[mid] || { mode: 'METER', history: [] };
      if (cur.charges) return;
      const utils = (cfg.utilities || []).filter(u => ownedRec(u) && u.marketId === mid);
      const charges = { land: true,
        electricity: utils.some(u => (!u.kind || u.kind === 'ELECTRICITY') && u.elecPrice != null),
        water: utils.some(u => (!u.kind || u.kind === 'WATER') && u.waterPrice != null),
        service: (cfg.extraServices || []).some(x => ownedRec(x) && x.marketId === mid && x.category !== 'VEHICLE') };
      cur.history = cur.history || [];
      cur.history.unshift({ time: nowStrSafe(), user: 'Hệ thống', action: 'Khai báo khoản thu áp dụng', detail: 'Suy ra từ mức thu riêng đã có (dữ liệu cũ)' });
      cur.charges = charges;
      cfg.utilityModes[mid] = cur;
    });
    cfg.chargeApplicabilityV1 = 1;
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
    // KHOAN_THU_AP_DUNG (10/2026): utilityModes[marketId].charges = { land, electricity, water, service } (boolean)
    // — chợ khai báo rõ khoản nào ÁP DỤNG. Mặt bằng là khoản chính, luôn áp dụng. Không có `charges` = chưa khai báo.
    Object.keys(cfg.utilityModes).forEach(mid => {
      const c = cfg.utilityModes[mid] && cfg.utilityModes[mid].charges;
      if (c && typeof c === 'object') cfg.utilityModes[mid].charges = { land: true, electricity: !!c.electricity, water: !!c.water, service: !!c.service };
    });
    ensureLegacyChargeApplicability(cfg);
    // DAT_LAI_CAU_HINH_CHO: bản sao lưu các lần đặt lại cấu hình mức thu của một chợ (đủ dữ liệu để phục hồi thủ công).
    cfg.marketConfigResets = Array.isArray(cfg.marketConfigResets) ? cfg.marketConfigResets : [];
    cfg.waiverTypes = Array.isArray(cfg.waiverTypes) ? cfg.waiverTypes : clone(D.WAIVER_TYPES || []);
    cfg.complaintRules = cfg.complaintRules && typeof cfg.complaintRules === 'object' ? cfg.complaintRules : {};
    if (cfg.complaintRules.ratingAutoCloseDays === undefined) cfg.complaintRules.ratingAutoCloseDays = null;
    if (!Array.isArray(cfg.complaintRules.history)) cfg.complaintRules.history = [];
    ['stallPrices', 'utilities', 'extraServices'].forEach(cat => {
      cfg[cat] = Array.isArray(cfg[cat]) ? cfg[cat] : [];
      cfg[cat].forEach(rec => normalizeRecord(cat, rec));
    });
    splitUtilityRecords(cfg);
    // Giá QĐ 480 / cấu hình demo cũ vẫn được giữ nguyên nếu đã tồn tại, nhưng
    // không được tự tạo thêm khi tải lại. Giá áp dụng phải do từng chợ khai báo.
    // Lịch kỳ thu chỉ cấu hình các mốc vận hành; không kích hoạt phát hành khoản phải thu.
    const cycle = cfg.billingCycle || {};
    cycle.preparationDay = Number(cycle.preparationDay) || Number(cycle.meterCutoffDay) || 25;
    cycle.meterReadDay = Number(cycle.meterReadDay) || Number(cycle.meterCutoffDay) || 25;
    cycle.collectionStartDay = Number(cycle.collectionStartDay) || 29;
    // Offset tháng tách template lịch khỏi các ngày snapshot trên từng billing period.
    // Record cũ không có các field này tiếp tục đọc theo defaults tương thích.
    ['preparationMonth', 'meterReadMonth', 'collectionStartMonth', 'reminder1Month', 'reminder2Month'].forEach(key => {
      const fallback = key === 'preparationMonth' || key === 'meterReadMonth' ? 'previous' : key === 'reminder1Month' || key === 'reminder2Month' ? 'next' : 'current';
      cycle[key] = ['previous', 'current', 'next'].includes(cycle[key]) ? cycle[key] : fallback;
    });
    cycle.reminder1Day = Number(cycle.reminder1Day) || 1;
    cycle.reminder2Day = Number(cycle.reminder2Day) || 3;
    if (cycle.autoCreatePeriods === undefined) cycle.autoCreatePeriods = true;
    cycle.dueMonth = cycle.dueMonth === 'current' ? 'current' : 'next';
    if (cycle.prepareNotification === undefined) cycle.prepareNotification = true;
    // autoIssue là field legacy không còn được UI/handler dùng; luôn vô hiệu theo luồng mới.
    cycle.autoIssue = false;
    // Mốc dự kiến phát hành đã được bỏ khỏi lịch thu mặc định. Việc phát hành vẫn
    // được thực hiện độc lập tại module Khoản phải thu, nên các key này không còn
    // là một phần của cấu hình lịch và được loại bỏ an toàn khi cấu hình được lưu lại.
    delete cycle.issueDay;
    delete cycle.issueMonth;
    cfg.billingCycle = cycle;
    // Per-market templates; billingCycle remains the legacy fallback only.
    cfg.defaultSchedules = cfg.defaultSchedules && typeof cfg.defaultSchedules === 'object' ? cfg.defaultSchedules : {};
    Object.keys(cfg.defaultSchedules).forEach(mid => {
      const schedule = cfg.defaultSchedules[mid] || {};
      cfg.defaultSchedules[mid] = Object.assign({}, cycle, schedule, { issueDay: undefined, issueMonth: undefined });
      delete cfg.defaultSchedules[mid].issueDay;
      delete cfg.defaultSchedules[mid].issueMonth;
    });
    return cfg;
  }

  function nowStrSafe() { return new Date().toLocaleString('vi-VN'); }

  function defaultConfig() {
    const rateSeed = clone(D.RATE_POLICY_SEED || { stallPrices: [], utilities: [], extraServices: [] });
    return normalizeConfig(Object.assign(rateSeed, {
      waiverTypes: clone(D.WAIVER_TYPES || []),
      billingCycle: {
        cycle: 'monthly', preparationDay: 28, preparationMonth: 'previous', meterReadDay: 28, meterReadMonth: 'previous', meterCutoffDay: 28, collectionStartDay: 1, collectionStartMonth: 'current', reminder1Day: 5, reminder1Month: 'current', reminder2Day: 10, reminder2Month: 'current', dueDay: 15, dueMonth: 'current', autoCreatePeriods: true, prepareNotification: true,
        // Field legacy: giữ nguyên để không làm mất dữ liệu/policy đang được module khác đọc.
        reminder1Days: 3, reminder2Days: 7, autoIssue: false, autoRemind: true,
        legalBasis: { docNo: '', docDate: '', issuer: 'Ban Quản lý chợ', summary: 'Quy định kỳ thu và hạn thanh toán', effectiveDate: '2026-01-01', note: '' },
        attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo cấu hình', detail: 'Kỳ thu hằng tháng · hạn thanh toán ngày 15' }]
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
      if (s) {
        const x = JSON.parse(s);
        if (x && x.stallPrices && x.billingCycle && x.billingRules) {
          const cfg = normalizeConfig(x);
          // Biểu phí demo vừa bổ sung → lưu ngay vào đúng key cấu hình hiện có (không tạo key mới).
          if (recalcRequested) { try { localStorage.setItem(SKEY, JSON.stringify(cfg)); } catch (e) { /* bỏ qua */ } }
          return cfg;
        }
      }
    } catch (e) { /* bỏ qua */ }
    return defaultConfig();
  }
  let CFG = loadConfig();
  // The policy resolver is shared by pricing preview, contract creation and
  // billing.  Matching by display text in individual screens is prohibited.
  function marketFor(id) {
    const markets = A.features && A.features.markets && A.features.markets.service;
    return (markets && markets.get && markets.get(id)) || ((typeof A.effectiveMarkets === 'function' ? A.effectiveMarkets() : D.MARKETS || []).find(x => x.id === id)) || null;
  }
  function marketGrade(market) {
    const rank = String((market && (market.rank || market.hang)) || '');
    const hit = /(?:HANG_|hạng\s*)([123])/i.exec(rank);
    return hit ? Number(hit[1]) : null;
  }
  function legacyStallType(point) {
    return { kiot: 'Ki-ốt', nhalong: 'Trong nhà lồng chợ', ngoai: 'Tự sản tự tiêu', phien: 'Quầy theo phiên' }[point && point.type] || null;
  }
  function policyActiveAt(policy, date) {
    return !!policy && policy.status === 'active' && (!policy.effectiveFrom || policy.effectiveFrom <= date) && (!policy.effectiveTo || policy.effectiveTo >= date);
  }
  function policyMarketMatch(policy, marketId, grade) {
    const listed = Array.isArray(policy.marketIds) ? policy.marketIds : [];
    if (listed.length && !listed.includes(marketId)) return false;
    if (!listed.length && policy.marketId && policy.marketId !== 'ALL' && policy.marketId !== marketId) return false;
    return !(Array.isArray(policy.marketGrades) && policy.marketGrades.length) || policy.marketGrades.includes(grade);
  }
  // Bản ghi biểu phí THUỘC RIÊNG một chợ (cấu hình mức thu của chính chợ đó): marketId đúng chợ, không phải
  // bản ghi dùng chung (scope SHARED / danh sách marketIds — vd. QĐ 480 theo hạng, chỉ là tham chiếu/preset).
  function isMarketOwnedPolicy(policy, marketId) {
    return !!policy && !!marketId && policy.marketId === marketId && policy.scope !== 'SHARED' && !(Array.isArray(policy.marketIds) && policy.marketIds.length);
  }
  // Bộ giải mức thu mặt bằng DÙNG CHUNG (hợp đồng, khoản phải thu, đơn giá hiển thị, vòng đời chợ).
  // Quyết định 10/2026: CHỈ dùng cấu hình mức thu RIÊNG của chợ (isMarketOwnedPolicy). Bản ghi dùng chung
  // (SHARED / marketIds — QĐ 480 theo hạng) chỉ là tham chiếu/preset, KHÔNG BAO GIỜ được trả về làm giá áp
  // dụng; không tìm được bản ghi riêng → null = thiếu cấu hình, nơi gọi phải chặn thao tác cần tính tiền.
  // (input.ownedOnly vẫn được chấp nhận để tương thích; hành vi luôn là ownedOnly.)
  function resolveApplicableMarketFeePolicy(input) {
    const point = input && input.point;
    const marketId = (input && input.marketId) || (input && input.market && input.market.id) || (point && point.market);
    const date = String((input && (input.startDate || input.date)) || (U.today ? U.today() : '') || '');
    const market = (input && input.market) || marketFor(marketId);
    if (!point || !marketId || !date) return null;
    const areaTypeId = point.areaTypeId || point.areaType || null;
    const legacyType = legacyStallType(point);
    return (CFG.stallPrices || []).filter(policy => policyActiveAt(policy, date)
      && isMarketOwnedPolicy(policy, marketId)
      && policyMarketMatch(policy, marketId, marketGrade(market))
      && (policy.areaTypeId ? policy.areaTypeId === areaTypeId : (policy.stallType === legacyType || policy.stallType === point.cat)))
      .sort((a, b) => {
        const exactA = Number(a.marketId === marketId), exactB = Number(b.marketId === marketId);
        if (exactA !== exactB) return exactB - exactA;
        return String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || ''));
      })[0] || null;
  }
  // Giá THAM CHIẾU QĐ 480 (bản ghi dùng chung SHARED) cho 1 chợ theo hạng — CHỈ để xem/preset khi cấu hình,
  // không bao giờ là giá áp dụng. Khớp theo hạng chợ (marketGrades); bản ghi không khai báo hạng thì theo marketIds.
  // Trả về { [areaTypeId]: policy } với bản ghi hiệu lực mới nhất mỗi loại diện tích.
  function referenceLandPrices(marketId, date) {
    const day = date || (U.today ? U.today() : ''), market = marketFor(marketId), grade = marketGrade(market), out = {};
    (CFG.stallPrices || []).filter(p => p.scope === 'SHARED' && p.areaTypeId && policyActiveAt(p, day)
      && (Array.isArray(p.marketGrades) && p.marketGrades.length ? p.marketGrades.includes(grade) : (p.marketIds || []).includes(marketId)))
      .sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')))
      .forEach(p => { if (!out[p.areaTypeId]) out[p.areaTypeId] = p; });
    return { grade, prices: out };
  }
  // Người nghe thay đổi cấu hình (vd. kỳ thu tự tính lại nháp khi biểu phí đổi). Lỗi của người nghe không chặn việc lưu.
  const changeListeners = [];
  // Bản sao lưu đặt lại cấu hình chỉ được THÊM, không bao giờ mất: trước khi ghi, hợp nhất các bản đã có trong
  // localStorage (vd một tab khác / một service đang giữ CFG cũ ghi đè) theo id.
  function mergeStoredResets() {
    try {
      const stored = JSON.parse(localStorage.getItem(SKEY) || 'null');
      const list = stored && Array.isArray(stored.marketConfigResets) ? stored.marketConfigResets : [];
      if (!list.length) return;
      CFG.marketConfigResets = Array.isArray(CFG.marketConfigResets) ? CFG.marketConfigResets : [];
      const have = new Set(CFG.marketConfigResets.map(x => x && x.id));
      list.forEach(x => { if (x && x.id && !have.has(x.id)) CFG.marketConfigResets.push(x); });
    } catch (e) { console.error('[service-config] không đọc được bản sao lưu đặt lại cấu hình đã lưu', e); }
  }
  function save() {
    mergeStoredResets();
    try { localStorage.setItem(SKEY, JSON.stringify(CFG)); } catch (e) { /* bỏ qua */ }
    changeListeners.forEach(fn => { try { fn(); } catch (e) { console.error('[service-config] change listener lỗi', e); } });
  }
  function reload() {
    const next = loadConfig();
    if (JSON.stringify(next) === JSON.stringify(CFG)) return { changed: false };
    CFG = next;
    return { changed: true };
  }
  function nowStr() { return A.U.dmy(A.U.today()) + ' ' + A.U.nowTime(); }

  const SC = A.SERVICE_CFG = {
    KEY: SKEY,
    data: () => CFG,
    reload,
    resolveApplicableMarketFeePolicy,
    isMarketOwnedPolicy,
    policyActiveAt,
    referenceLandPrices,
    onChange: fn => { if (typeof fn === 'function') changeListeners.push(fn); },
    // Migration cấu hình lúc nạp (vd. biểu phí demo) chạy TRƯỚC khi dữ liệu kỳ thu sẵn sàng → bên nạp dữ liệu hỏi lại để tính lại nháp.
    takeRecalcRequest: () => { const r = recalcRequested; recalcRequested = false; return r; },
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
    // Khoản (electricity | water | service) có PHÁT SINH cho chợ tại ngày `date` không — dùng chung cho tính khoản
    // phải thu và danh sách điểm cần ghi chỉ số. Chưa khai báo / đang áp dụng → có. Khai báo "không áp dụng" →
    // chỉ còn phát sinh ở những ngày mức giá riêng cũ của khoản đó vẫn còn hiệu lực (trước ngày ngừng áp dụng:
    // mức cũ được kết thúc hiệu lực, không xóa) — kỳ trước ngày ngừng không đổi, kỳ mới không phát sinh.
    chargeActiveAt: (mid, charge, date) => {
      const c = SC.chargeApplicability(mid);
      if (!c || c[charge] !== false) return true;
      const day = date || (U.today ? U.today() : ''), own = cat => (CFG[cat] || []).filter(r => isMarketOwnedPolicy(r, mid) && policyActiveAt(r, day));
      if (charge === 'service') return own('extraServices').some(x => x.category !== 'VEHICLE');
      const field = charge === 'electricity' ? 'elecPrice' : 'waterPrice', kind = charge === 'electricity' ? 'ELECTRICITY' : 'WATER';
      return own('utilities').some(u => (!u.kind || u.kind === kind) && u[field] != null);
    },
    // Khoản thu áp dụng của chợ (null = chưa khai báo). Lưu cùng utilityModes, có lịch sử thay đổi.
    chargeApplicability: mid => { const c = ((CFG.utilityModes || {})[mid] || {}).charges; return c ? { land: true, electricity: !!c.electricity, water: !!c.water, service: !!c.service } : null; },
    setChargeApplicability: (mid, charges, user, reason) => {
      if (!mid || !charges) return null;
      CFG.utilityModes = CFG.utilityModes || {};
      const cur = CFG.utilityModes[mid] || { mode: 'METER', history: [] };
      const next = { land: true, electricity: !!charges.electricity, water: !!charges.water, service: !!charges.service };
      const label = c => c ? ['Mặt bằng'].concat(c.electricity ? ['Điện'] : [], c.water ? ['Nước'] : [], c.service ? ['Dịch vụ'] : []).join(', ') : 'Chưa khai báo';
      cur.history = cur.history || [];
      cur.history.unshift({ time: nowStr(), user: user, action: 'Khai báo khoản thu áp dụng', detail: label(cur.charges) + ' → ' + label(next) + (reason ? ' · ' + reason : '') });
      cur.charges = next; cur.updatedBy = user; cur.updatedAt = nowStr();
      CFG.utilityModes[mid] = cur;
      save();
      return next;
    },
    cycle: () => CFG.billingCycle,
    cycleFor: marketId => {
      if (!marketId) return CFG.billingCycle;
      if (!CFG.defaultSchedules[marketId]) CFG.defaultSchedules[marketId] = clone(CFG.billingCycle);
      return CFG.defaultSchedules[marketId];
    },
    updateCycle: (patch, user, detail) => { Object.assign(CFG.billingCycle, patch); SC.log(CFG.billingCycle, user, 'Cập nhật kỳ thu', detail || ''); },
    updateCycleFor: (marketId, patch, user, detail) => { const cycle = SC.cycleFor(marketId); Object.assign(cycle, patch); SC.log(cycle, user, 'Cập nhật lịch thu mặc định', detail || ''); },
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
    resetDefault: () => { CFG = defaultConfig(); save(); },
    // DAT_LAI_CAU_HINH_CHO: gỡ các bản ghi mức thu RIÊNG của một chợ (theo danh sách id đã kiểm tra là chưa từng
    // được sử dụng) và khai báo khoản thu áp dụng của chợ đó, sau khi sao lưu đầy đủ vào marketConfigResets.
    // Không đụng bảng giá dùng chung (QĐ 480), phí gửi xe, lịch kỳ thu, cấu hình chợ khác. Chỉ chạy khi được gọi
    // tường minh (không có lời gọi lúc tải trang). Kiểm tra quyền + tham chiếu do service nghiệp vụ thực hiện.
    resetMarketConfig: (mid, opts) => {
      const o = opts || {}, ids = new Set(o.ids || []);
      if (!mid) return null;
      // Làm việc trên bản mới nhất đã lưu (chỉ khi có bản lưu hợp lệ — không bao giờ quay về cấu hình mặc định).
      try { const raw = localStorage.getItem(SKEY), x = raw && JSON.parse(raw); if (x && x.stallPrices && x.billingCycle && x.billingRules) reload(); } catch (e) { console.error('[service-config] không đọc được cấu hình đã lưu trước khi đặt lại', e); }
      const records = { stallPrices: [], utilities: [], extraServices: [] };
      Object.keys(records).forEach(cat => {
        const list = CFG[cat] || [];
        for (let i = list.length - 1; i >= 0; i--) {
          const r = list[i];
          if (!ids.has(r.id) || !isMarketOwnedPolicy(r, mid) || (cat === 'extraServices' && r.category === 'VEHICLE')) continue;
          records[cat].unshift(clone(r));
          list.splice(i, 1); // giữ nguyên tham chiếu mảng cho mọi nơi đang đọc SC.list(cat)
        }
      });
      CFG.utilityModes = CFG.utilityModes || {};
      const mode = CFG.utilityModes[mid] || null, utilityMode = mode ? clone(mode) : null;
      const entry = { id: 'RST-' + mid + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), marketId: mid, at: nowStr(), atIso: new Date().toISOString(),
        user: o.user || 'Không rõ', reason: o.reason || '', records, utilityMode,
        counts: { stallPrices: records.stallPrices.length, utilities: records.utilities.length, extraServices: records.extraServices.length, charges: !!(mode && mode.charges) } };
      if (mode && mode.charges) {
        delete mode.charges;
        mode.history = mode.history || [];
        mode.history.unshift({ time: entry.at, user: entry.user, action: 'Đặt lại cấu hình mức thu', detail: 'Gỡ khai báo khoản thu áp dụng và ' + (records.stallPrices.length + records.utilities.length + records.extraServices.length) + ' mức thu riêng chưa sử dụng · sao lưu ' + entry.id + (entry.reason ? ' · ' + entry.reason : '') });
        mode.updatedBy = entry.user; mode.updatedAt = entry.at;
      }
      CFG.marketConfigResets = Array.isArray(CFG.marketConfigResets) ? CFG.marketConfigResets : [];
      CFG.marketConfigResets.push(entry);
      save();
      return entry;
    },
    marketConfigResets: mid => (CFG.marketConfigResets || []).filter(x => !mid || x.marketId === mid)
  };

  // KY_09_DEN_GHI_CHI_SO (seed v29): không tự bổ sung kỳ demo 10/2026.
  // Mọi kỳ sau chỉ được tạo từ dữ liệu/luồng Kỳ thu; finance không được tự tạo thay.

  // Applied price helpers (from js/core.js, Phase 15.6).
  // Đơn giá hiện hành của điểm KD lấy từ "Chính sách thu và biểu phí", không phải
  // đơn giá snapshot của hợp đồng. NEED_CONFIRMATION: quy tắc mapping biểu phí
  // theo khu vực/loại điểm cần được nghiệp vụ xác nhận khi có API/backend.
  U.appliedStallPrice = (st, startDate) => A.SERVICE_CFG.resolveApplicableMarketFeePolicy({
    point: st, startDate: startDate || (U.today ? U.today() : '')
  });
  U.unitLabel = st => {
    const price = U.appliedStallPrice(st);
    if (!price) return 'Chưa cấu hình';
    return U.money(price.amount) + '/' + String(price.unit || '').replace(/^đ\//, '');
  };
})(window.APP);
