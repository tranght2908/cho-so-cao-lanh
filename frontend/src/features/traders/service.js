/* Traders profile use-case facade. Rendering, DOM, permissions and toasts remain in the legacy view. */
(function (A) {
  'use strict';

  if (!A || !A.features || !A.features.traders || !A.features.traders.repository) return;

  const traders = A.features.traders;
  const repository = traders.repository;
  const service = traders.service || (traders.service = {});

  // Danh mục giấy tờ hồ sơ tiểu thương — NGUỒN DUY NHẤT (key = field trong trader.docFiles). Dùng chung cho
  // Hồ sơ tiểu thương (web quản lý) và Thông tin cá nhân (web Tiểu thương); chuyển nguyên văn từ traders/page.js.
  service.DOC_DEFS = [
    { key: 'cccdFront', label: 'CCCD - Mặt trước' },
    { key: 'cccdBack', label: 'CCCD - Mặt sau' },
    { key: 'dkkd', label: 'Giấy chứng nhận đăng ký kinh doanh' },
    { key: 'avatar', label: 'Ảnh chân dung' }
  ];
  service.list = function () { return repository.list(); };
  service.getProfile = function (id) { return repository.get(id); };
  // Canonical business lifecycle is persisted by lifecycle.service; this facade is
  // the only reader used by views and compatibility callers.
  service.BUSINESS_STATUS = {
    WAITING_ALLOCATION: 'WAITING_ALLOCATION',
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE'
  };
  service.deriveBusinessStatus = function (traderOrId, date) {
    const trader = typeof traderOrId === 'string' ? repository.get(traderOrId) : traderOrId;
    if (!trader) return service.BUSINESS_STATUS.WAITING_ALLOCATION;
    const lifecycle = A.features.lifecycle && A.features.lifecycle.service;
    if (lifecycle && lifecycle.recalculateTrader) lifecycle.recalculateTrader(trader);
    return service.BUSINESS_STATUS[trader.status] || service.BUSINESS_STATUS.WAITING_ALLOCATION;
  };
  service.idNoTaken = function (idNo, excludeId) { return repository.idNoTaken(idNo, excludeId); };
  // HỒ SƠ TIỂU THƯƠNG DUY NHẤT THEO CHỢ (nguồn duy nhất cho tạo + sửa): trong CÙNG chợ không có 2 hồ sơ trùng SĐT
  // hoặc trùng CCCD/số giấy tờ; KHÁC chợ được trùng (cùng một người kinh doanh ở nhiều chợ = nhiều hồ sơ).
  // Không liên quan rule SĐT tài khoản đăng nhập (vẫn duy nhất toàn hệ thống, ở accounts).
  const normPhone = v => String(v || '').replace(/\D/g, '');
  const normIdNo = v => String(v || '').replace(/\s+/g, '').toUpperCase();
  service.profileDuplicates = function (profile, excludeId) {
    const market = profile && profile.market, phone = normPhone(profile && profile.phone), idNo = normIdNo(profile && profile.idNo);
    const same = repository.list().filter(x => x.id !== excludeId && x.market === market);
    return {
      phone: phone ? same.filter(x => normPhone(x.phone) === phone) : [],
      idNo: idNo ? same.filter(x => normIdNo(x.idNo) === idNo) : []
    };
  };
  // Tra hồ sơ theo (chợ, SĐT) — KHÔNG qua tài khoản, KHÔNG lấy hồ sơ ở chợ khác. (chợ, SĐT) là duy nhất nên kết
  // quả 0 hoặc 1; dữ liệu cũ trùng trong cùng chợ → AMBIGUOUS (không chọn hồ sơ đầu tiên).
  service.findByMarketPhone = function (market, phone) {
    const p = normPhone(phone);
    const found = p && market ? repository.list().filter(x => x.market === market && normPhone(x.phone) === p) : [];
    return { status: !p ? 'EMPTY' : found.length === 1 ? 'FOUND' : found.length ? 'AMBIGUOUS' : 'NOT_FOUND', trader: found.length === 1 ? found[0] : null };
  };
  // null = hợp lệ; ngược lại { code, message, traderIds } để handler báo lỗi.
  service.validateProfileUnique = function (profile, excludeId) {
    const d = service.profileDuplicates(profile, excludeId);
    if (d.phone.length) return { code: 'DUPLICATE_MARKET_PHONE', message: 'Số điện thoại đã được dùng cho hồ sơ tiểu thương khác trong chợ này.', traderIds: d.phone.map(x => x.id) };
    if (d.idNo.length) return { code: 'DUPLICATE_MARKET_ID_NO', message: 'Số CCCD/giấy tờ đã được dùng cho hồ sơ tiểu thương khác trong chợ này.', traderIds: d.idNo.map(x => x.id) };
    return null;
  };
  // updateProfile/updateDocuments mutate in memory only; save() persists. The legacy
  // edit flow logs between mutation and save, so persistence stays a separate step.
  // Chặn cả ở tầng service (không chỉ UI): trùng SĐT/CCCD trong cùng chợ → null, không ghi.
  service.updateProfile = function (id, profile) {
    const t = repository.get(id);
    if (!t || service.validateProfileUnique(Object.assign({}, profile, { market: t.market }), id)) return null;
    const updated = repository.updateProfile(id, profile);
    if (updated) service.linkExistingMerchantAccount(updated);
    return updated;
  };
  service.updateDocuments = function (id, files, updatedAt) { return repository.updateDocuments(id, files, updatedAt); };
  // In-memory link used by contract orchestration; the use case saves once.
  service.linkPoint = function (id, pointId) { return repository.linkPoint(id, pointId); };
  service.unlinkPoint = function (id, pointId) { return repository.unlinkPoint(id, pointId); };
  service.save = function () { return repository.save(); };
  // A person may have one profile in each market. Match an existing merchant
  // account by its globally unique login phone and add this profile to it.
  service.linkExistingMerchantAccount = function (profile) {
    const accounts = A.ACCOUNTS;
    const phone = accounts && accounts.normalizePhone ? accounts.normalizePhone(profile && profile.phone) : '';
    const account = phone && accounts && accounts.byPhone ? accounts.byPhone(phone) : null;
    if (!account || accounts.primaryRole(account) !== 'trader') return null;
    return accounts.linkTraderProfile(account.id, profile.id);
  };
  // Profile create: push + reindex + single save (the effective tt-new flow).
  // Trùng SĐT/CCCD trong cùng chợ → null, không ghi.
  service.create = function (profile) {
    if (service.validateProfileUnique(profile, profile && profile.id)) return null;
    profile.status = service.BUSINESS_STATUS.WAITING_ALLOCATION;
    repository.add(profile);
    // Linking does not alter this profile's independent placement status.
    service.linkExistingMerchantAccount(profile);
    repository.save(); return profile;
  };
})(window.APP);
