/* Dữ liệu dùng chung cho màn "Tài khoản người dùng" (Vận hành).
 * Module này ĐỘC LẬP với D.STAFF trong data.js — D.STAFF vẫn giữ nguyên,
 * tiếp tục dùng cho dropdown "Người xử lý" ở Phản ánh & sự cố như cũ.
 * Seed mặc định TÁI SỬ DỤNG đúng 7 bản ghi D.STAFF (không đổi mã/tên/chức danh),
 * chỉ bổ sung thêm vài tài khoản mẫu để có đủ các loại tài khoản theo yêu cầu.
 */
(function (A) {
  'use strict';
  const D = A.D;
  const AKEY = 'choso-caolanh-accounts';

  const ACCOUNT_TYPES = ['Quản trị hệ thống', 'Lãnh đạo UBND phường', 'Ban Quản lý chợ', 'Nhân viên Ban Quản lý chợ', 'Tiểu thương'];

  function defaultAccounts() {
    const list = D.STAFF.map(s => ({
      id: 'AC-' + s.id, code: s.id, fullName: s.name, phone: '',
      accountType: s.role === 'Trưởng Ban Quản lý chợ' ? 'Ban Quản lý chợ' : 'Nhân viên Ban Quản lý chợ',
      title: s.role, roleIds: ['bql'],
      organization: 'Ban Quản lý ' + ((D.MARKETS.find(m => m.id === s.market) || {}).short || s.market),
      marketScopes: [s.market], status: 'active'
    }));
    list.push(
      { id: 'AC-LD01', code: 'LD01', fullName: 'Nguyễn Văn Phúc', phone: '0909123456', accountType: 'Lãnh đạo UBND phường', title: 'Phó Chủ tịch UBND phường', roleIds: ['lanhdao'], organization: 'UBND phường Cao Lãnh', marketScopes: ['ALL'], status: 'active' },
      { id: 'AC-QT01', code: 'QT01', fullName: 'Đặng Thị Thu', phone: '0909234567', accountType: 'Quản trị hệ thống', title: 'Quản trị hệ thống', roleIds: ['bql'], organization: 'UBND phường Cao Lãnh', marketScopes: ['ALL'], status: 'active' },
      { id: 'AC-TT01', code: 'TT-DEMO1', fullName: 'Nguyễn Thị Hoa', phone: '0909345678', accountType: 'Tiểu thương', title: 'Tiểu thương mẫu', roleIds: ['tieuthuong'], organization: 'Chợ Cao Lãnh', marketScopes: ['CL'], status: 'active' },
      { id: 'AC-TT02', code: 'TT-DEMO2', fullName: 'Trần Văn Sáu', phone: '0909456789', accountType: 'Tiểu thương', title: 'Tiểu thương mẫu (đã tạm khoá minh hoạ)', roleIds: ['tieuthuong'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'disabled' }
    );
    return list;
  }

  function loadAccounts() {
    try {
      const s = localStorage.getItem(AKEY);
      if (s) { const x = JSON.parse(s); if (Array.isArray(x)) return x; }
    } catch (e) { /* bỏ qua */ }
    return defaultAccounts();
  }
  let ACCOUNTS = loadAccounts();
  function saveAccounts() { try { localStorage.setItem(AKEY, JSON.stringify(ACCOUNTS)); } catch (e) { /* bỏ qua */ } }

  A.ACCOUNTS = {
    KEY: AKEY,
    ACCOUNT_TYPES: ACCOUNT_TYPES,
    list: () => ACCOUNTS,
    get: id => ACCOUNTS.find(a => a.id === id),
    codeTaken: (code, excludeId) => {
      const c = (code || '').trim().toLowerCase();
      return ACCOUNTS.some(a => a.id !== excludeId && a.code.trim().toLowerCase() === c);
    },
    add: acc => { ACCOUNTS.push(acc); saveAccounts(); },
    update: (id, patch) => { const a = A.ACCOUNTS.get(id); if (a) Object.assign(a, patch); saveAccounts(); },
    setStatus: (id, status) => { const a = A.ACCOUNTS.get(id); if (a) a.status = status; saveAccounts(); },
    resetDefault: () => { ACCOUNTS = defaultAccounts(); saveAccounts(); }
  };
})(window.APP);
