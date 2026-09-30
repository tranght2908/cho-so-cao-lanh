/* Accounts use-case facade (trader account readiness). Auth/OTP, RBAC and the account admin screen stay legacy. */
(function (A) {
  'use strict';

  if (!A || !A.features || !A.features.accounts || !A.features.accounts.repository) return;

  const accounts = A.features.accounts;
  const repository = accounts.repository;
  const service = accounts.service || (accounts.service = {});

  service.list = function () { return repository.list(); };
  service.get = function (id) { return repository.get(id); };
  service.byTraderId = function (traderId) { return repository.byTraderId(traderId); };
  // Next trader account ID "AC-TT<nn>", same formula as the legacy workflow command.
  service.nextTraderAccountId = function (pad) {
    let n = repository.list().reduce((max, a) => Math.max(max, +(String(a.id).match(/^AC-TT(\d+)$/) || [0, 0])[1]), 0) + 1;
    // Không trùng id/mã của account đã lưu (vd. mã tiểu thương dạng TT0003 dùng làm code).
    while (repository.list().some(a => a.id === 'AC-TT' + pad(n, 2) || String(a.code || '').toUpperCase() === 'TT' + pad(n, 2))) n += 1;
    return 'AC-TT' + pad(n, 2);
  };
  // Mã tài khoản nội bộ do HỆ THỐNG sinh (nguồn duy nhất — form không nhập mã). Theo convention sẵn có của seed:
  // QTxx Quản trị, LDxx Lãnh đạo, KTTTxx Kế toán Trung tâm, NVxx nhân sự Tổ Quản lý chợ (Tổ trưởng/NV thu phí/NV
  // kỹ thuật — như D.STAFF NV01..NV09). Số = lớn nhất đã dùng + 1, tính trên MỌI account đã lưu (kể cả khoá/
  // legacy, cả id "AC-<mã>") và mã D.STAFF (lịch sử payment.by/Incident.assignee) → không tái sử dụng mã cũ.
  // Gọi lúc LƯU; vẫn kiểm tra trùng lần cuối trước khi trả về.
  const INTERNAL_CODE_PREFIX = { system_admin: 'QT', ward_leader: 'LD', central_accountant: 'KTTT', market_manager: 'NV', collector: 'NV', technician: 'NV' };
  service.internalCodePrefix = roleId => INTERNAL_CODE_PREFIX[roleId] || null;
  service.nextInternalAccountCode = function (roleId, pad) {
    const prefix = INTERNAL_CODE_PREFIX[roleId];
    if (!prefix) return null;
    const re = new RegExp('^' + prefix + '(\\d+)$'), num = v => +(String(v || '').toUpperCase().match(re) || [0, 0])[1];
    const used = repository.list().map(a => Math.max(num(a.code), num(String(a.id || '').replace(/^AC-/, ''))))
      .concat(((A.D && A.D.STAFF) || []).map(s => num(s.id)));
    let n = used.reduce((max, x) => Math.max(max, x), 0);
    let code;
    do { n += 1; code = prefix + pad(n, 2); } while (repository.list().some(a => String(a.code || '').toUpperCase() === code || a.id === 'AC-' + code));
    return code;
  };
  // Persisted by the legacy store; the caller builds the record (role, scopes, status).
  service.add = function (account) { return repository.add(account); };
  service.setStatus = function (id, status) { return repository.setStatus(id, status); };
  // "Loại người dùng" (nhóm danh tính) suy ra từ quan hệ sẵn có — vai trò trader, liên kết hồ sơ tiểu
  // thương hoặc accountType cũ — không có field lưu riêng. Dùng chung cho màn quản trị tài khoản và
  // màn Thông tin cá nhân.
  service.USER_KIND = { staff: 'Cán bộ/Nhân viên', trader: 'Tiểu thương' };
  service.userKind = function (a) { return a && (A.ACCOUNTS.primaryRole(a) === 'trader' || a.traderId || a.accountType === 'Tiểu thương') ? 'trader' : 'staff'; };
})(window.APP);