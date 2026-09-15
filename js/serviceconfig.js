/* Dữ liệu "Cấu hình dịch vụ". Từ Phase 6 STEP A: 3 collection đơn giá (stallPrices/utilities/
 * extraServices) được UI hiển thị ở màn "Cấu hình giá dịch vụ" độc lập (js/v-vanhanh.js,
 * A.VIEWS['cau-hinh-gia'], nhóm Tài chính) — billingCycle/billingRules (Kỳ thu/Quy tắc thu phí)
 * vẫn hiển thị trong Cài đặt & phân quyền, không đổi. Module dữ liệu này (shape/API) KHÔNG đổi.
 * Module này ĐỘC LẬP với data.js — KHÔNG đọc/ghi D.UNIT, D.SESSION_FEE, D.ELEC, D.WATER.
 * Đây chỉ là kho cấu hình UI prototype (đơn giá, điện nước, dịch vụ khác, kỳ thu, quy tắc
 * thu phí), có căn cứ pháp lý + tài liệu đính kèm (mock, không upload server) + lịch sử thay
 * đổi. Các màn tài chính thật (Khoản phải thu, Thu tiền, Chỉ số điện nước...) KHÔNG đọc từ
 * đây — tránh gây regression cho nghiệp vụ tính tiền đang chạy dựa trên data.js. STEP A này
 * KHÔNG nối biểu giá vào thuật toán tính khoản phải thu (xem ghi chú UI trên A.VIEWS['cau-hinh-gia']).
 */
(function (A) {
  'use strict';
  const SKEY = 'choso-caolanh-serviceconfig';
  let seq = 0;
  const newId = p => p + '_' + Date.now().toString(36) + (++seq);

  function emptyLegal() { return { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' }; }

  function defaultConfig() {
    const legal480 = { docNo: '480/QĐ-UBND', docDate: '2026-02-14', issuer: 'UBND tỉnh Đồng Tháp', summary: 'Quy định đơn giá dịch vụ chợ', effectiveDate: '2026-02-14', note: '' };
    return {
      stallPrices: [
        { id: newId('sp'), marketId: 'CL', area: 'Toàn chợ (hạng 1)', stallType: 'Ki-ốt', amount: 2000, unit: 'đ/m²/ngày', effectiveFrom: '2026-02-14', effectiveTo: null, status: 'active', legalBasis: Object.assign({}, legal480), attachments: [{ id: 'att-001', name: 'QD_480_2026.pdf', type: 'application/pdf', note: 'Văn bản căn cứ', mock: true }], history: [{ time: '14/02/2026 09:30', user: 'Trần Minh Khoa', action: 'Tạo đơn giá', detail: '2.000 đ/m²/ngày' }] },
        { id: newId('sp'), marketId: 'CL', area: 'Toàn chợ (hạng 1)', stallType: 'Trong nhà lồng chợ', amount: 2000, unit: 'đ/m²/ngày', effectiveFrom: '2026-02-14', effectiveTo: null, status: 'active', legalBasis: Object.assign({}, legal480), attachments: [], history: [{ time: '14/02/2026 09:30', user: 'Trần Minh Khoa', action: 'Tạo đơn giá', detail: '2.000 đ/m²/ngày' }] },
        { id: newId('sp'), marketId: 'CL', area: 'Ngoài nhà lồng', stallType: 'Tự sản tự tiêu', amount: 800, unit: 'đ/m²/ngày', effectiveFrom: '2026-02-14', effectiveTo: null, status: 'active', legalBasis: Object.assign({}, legal480), attachments: [{ id: 'att-002', name: 'bang_gia_trang_3.png', type: 'image/png', note: 'Trang có bảng đơn giá', mock: true }], history: [{ time: '14/02/2026 09:30', user: 'Trần Minh Khoa', action: 'Tạo đơn giá', detail: '800 đ/m²/ngày' }, { time: '01/03/2026 10:15', user: 'Trần Minh Khoa', action: 'Cập nhật căn cứ', detail: 'Bổ sung QĐ 480/QĐ-UBND' }] },
        { id: newId('sp'), marketId: 'TTD', area: 'Khu chợ quê', stallType: 'Quầy theo phiên', amount: 20000, unit: 'đ/quầy/phiên', effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: 'UBND phường Cao Lãnh', summary: 'Mức thu giả định, chưa có trong phụ lục QĐ 480', effectiveDate: '2026-01-01', note: 'Giả định, chờ văn bản chính thức' }, attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo đơn giá', detail: '20.000 đ/quầy/phiên' }] }
      ],
      utilities: [
        { id: newId('ut'), marketId: 'CL', elecPrice: 3200, waterPrice: 12000, effectiveFrom: '2026-01-01', status: 'active', legalBasis: { docNo: '', docDate: '', issuer: 'Theo giá bán lẻ hiện hành', summary: 'Đơn giá điện, nước áp dụng cho điểm kinh doanh có đồng hồ riêng', effectiveDate: '2026-01-01', note: '' }, attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Võ Hoàng Tuấn', action: 'Tạo cấu hình', detail: 'Điện 3.200 đ/kWh · Nước 12.000 đ/m³' }] }
      ],
      extraServices: [
        { id: newId('es'), name: 'Vệ sinh', marketId: 'CL', calcMethod: 'area', amount: 2000, unit: 'đ/m²/tháng', effectiveFrom: '2026-01-01', status: 'active', legalBasis: emptyLegal(), attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo dịch vụ', detail: '2.000 đ/m²/tháng' }] },
        { id: newId('es'), name: 'Bảo vệ', marketId: 'CL', calcMethod: 'fixed', amount: 50000, unit: 'đ/điểm/tháng', effectiveFrom: '2026-01-01', status: 'active', legalBasis: emptyLegal(), attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo dịch vụ', detail: '50.000 đ/điểm/tháng' }] },
        { id: newId('es'), name: 'Gửi xe', marketId: 'ALL', calcMethod: 'qty', amount: 3000, unit: 'đ/lượt', effectiveFrom: '2026-01-01', status: 'inactive', legalBasis: Object.assign(emptyLegal(), { note: 'Chưa triển khai, đang chờ bố trí bãi xe' }), attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo dịch vụ', detail: '3.000 đ/lượt (tạm chưa áp dụng)' }] }
      ],
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
    };
  }

  function loadConfig() {
    try {
      const s = localStorage.getItem(SKEY);
      if (s) { const x = JSON.parse(s); if (x && x.stallPrices && x.billingCycle && x.billingRules) return x; }
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
    setStatus: (cat, id, status, user) => {
      const r = SC.get(cat, id);
      if (!r) return;
      r.status = status;
      SC.log(r, user, status === 'active' ? 'Kích hoạt lại' : 'Vô hiệu hoá', '');
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
})(window.APP);
