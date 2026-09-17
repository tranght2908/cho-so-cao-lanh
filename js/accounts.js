/* Dữ liệu dùng chung cho màn "Tài khoản người dùng" (Vận hành) — đồng thời là nguồn
 * "Account Demo" mà topbar dùng để xác định phiên đang chạy (xem A.currentAccount() ở core.js).
 * Module này ĐỘC LẬP với D.STAFF trong data.js — D.STAFF vẫn giữ nguyên,
 * tiếp tục dùng cho dropdown "Người xử lý" ở Phản ánh & sự cố như cũ.
 * Seed mặc định TÁI SỬ DỤNG các bản ghi D.STAFF (không đổi mã/tên/chức danh),
 * chỉ bổ sung thêm vài tài khoản mẫu để có đủ các loại tài khoản theo yêu cầu.
 *
 * RBAC V1 — PHASE 1: roleIds của mọi account đã chuyển sang role V1 (8 role trong
 * js/permissions.js). `bql` cũ KHÔNG map 1:1 — account từng dùng `bql` được tách theo đúng chức
 * danh thật (`D.STAFF[].role`) qua STAFF_ROLE_MAP bên dưới. V1 seed đúng 1 phần tử/roleIds; đọc
 * role hiệu lực của account LUÔN qua A.ACCOUNTS.primaryRole() (không đọc roleIds[0] trực tiếp ở
 * nơi khác), để sau này hỗ trợ nhiều role/account chỉ cần sửa đúng 1 hàm này.
 */
(function (A) {
  'use strict';
  const D = A.D;
  const AKEY = 'choso-caolanh-accounts';
  const ASCHEMA_KEY = 'choso-caolanh-accounts-schema';

  const ACCOUNT_TYPES = ['Quản trị hệ thống', 'Lãnh đạo UBND phường', 'Ban Quản lý chợ', 'Nhân viên Ban Quản lý chợ', 'Tiểu thương'];

  // D.STAFF[].role (text mô tả chức danh, data.js) → role id V1 tương ứng.
  const STAFF_ROLE_MAP = {
    'Trưởng Ban Quản lý chợ': 'market_manager',
    'Kế toán': 'accountant',
    'Nhân viên Ban Quản lý chợ': 'market_staff',
    'Nhân viên thu phí': 'collector',
    'Nhân viên kỹ thuật (điện, nước)': 'technician',
    'Tổ quản lý chợ quê': 'market_staff',
    'Nhân viên thu phí phiên': 'collector'
  };
  const RETIRED_SEED_ACCOUNT_IDS = ['AC-BQL-TTD', 'AC-PHIEN-DEMO'];

  function defaultAccounts() {
    const list = D.STAFF.map(s => ({
      id: 'AC-' + s.id, code: s.id, fullName: s.name, phone: '',
      accountType: s.role === 'Trưởng Ban Quản lý chợ' ? 'Ban Quản lý chợ' : 'Nhân viên Ban Quản lý chợ',
      title: s.role, roleIds: [STAFF_ROLE_MAP[s.role] || 'market_staff'],
      // Trưởng Ban Quản lý chợ quản lý cả 02 chợ (Chợ Cao Lãnh và Chợ quê); nhân viên gắn với chợ được giao.
      organization: s.role === 'Trưởng Ban Quản lý chợ' ? 'Ban Quản lý chợ phường Cao Lãnh' : 'Ban Quản lý ' + ((D.MARKETS.find(m => m.id === s.market) || {}).short || s.market),
      marketScopes: s.role === 'Trưởng Ban Quản lý chợ' ? ['ALL'] : [s.market], status: 'active'
    }));
    list.push(
      { id: 'AC-LD01', code: 'LD01', fullName: 'Nguyễn Văn Phúc', phone: '0909123456', accountType: 'Lãnh đạo UBND phường', title: 'Phó Chủ tịch UBND phường', roleIds: ['ward_leader'], organization: 'UBND phường Cao Lãnh', marketScopes: ['ALL'], status: 'active' },
      { id: 'AC-QT01', code: 'QT01', fullName: 'Đặng Thị Thu', phone: '0909234567', accountType: 'Quản trị hệ thống', title: 'Quản trị hệ thống', roleIds: ['system_admin'], organization: 'UBND phường Cao Lãnh', marketScopes: ['ALL'], status: 'active' },
      { id: 'AC-CHI-QUYET', code: 'CHI-QUYET', fullName: 'Chí Quyết', phone: '0909000001', accountType: 'Tiểu thương', title: 'Tiểu thương chợ quê', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'active', linkedTraderId: 'TTD-CQ' },
      { id: 'AC-TT-TTD', code: 'TT-TTD', fullName: 'Tiểu thương Chợ quê Tân Thuận Đông', phone: '0909666777', accountType: 'Tiểu thương', title: 'Tiểu thương chợ quê mẫu', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'active' },
      { id: 'AC-TT01', code: 'TT-DEMO1', fullName: 'Nguyễn Thị Hoa', phone: '0909345678', accountType: 'Tiểu thương', title: 'Tiểu thương mẫu', roleIds: ['trader'], organization: 'Chợ Cao Lãnh', marketScopes: ['CL'], status: 'active' },
      { id: 'AC-TT02', code: 'TT-DEMO2', fullName: 'Trần Văn Sáu', phone: '0909456789', accountType: 'Tiểu thương', title: 'Tiểu thương mẫu (đã tạm khoá minh hoạ)', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'disabled' }
    );
    return list;
  }

  function loadAccounts() {
    try {
      // RBAC V1 migration: mảng account đã lưu từ bản role cũ (roleIds như 'bql'/'lanhdao'/
      // 'tieuthuong') không tương thích — chỉ dùng lại nếu đúng schema hiện tại, ngược lại bỏ và
      // seed lại từ defaultAccounts() (đã dùng role id V1).
      if (localStorage.getItem(ASCHEMA_KEY) === String(A.RBAC_SCHEMA)) {
        const s = localStorage.getItem(AKEY);
        if (s) { const x = JSON.parse(s); if (Array.isArray(x)) return mergeSeedAccounts(x); }
      }
    } catch (e) { /* bỏ qua */ }
    return defaultAccounts();
  }
  function mergeSeedAccounts(accounts) {
    const before = accounts.length;
    accounts = accounts.filter(a => RETIRED_SEED_ACCOUNT_IDS.indexOf(a.id) === -1);
    const existingIds = new Set(accounts.map(a => a.id));
    let changed = accounts.length !== before;
    const ttdManager = defaultAccounts().find(a => a.id === 'AC-NV06');
    const oldTtdStaff = accounts.find(a => a.id === 'AC-NV06');
    const chiQuyetSeed = defaultAccounts().find(a => a.id === 'AC-CHI-QUYET');
    const oldChiQuyet = accounts.find(a => a.id === 'AC-CHI-QUYET' || a.fullName === 'Chí Quyết');
    if (chiQuyetSeed && oldChiQuyet) {
      Object.assign(oldChiQuyet, {
        id: chiQuyetSeed.id,
        code: chiQuyetSeed.code,
        fullName: chiQuyetSeed.fullName,
        phone: chiQuyetSeed.phone,
        accountType: chiQuyetSeed.accountType,
        title: chiQuyetSeed.title,
        roleIds: chiQuyetSeed.roleIds,
        organization: chiQuyetSeed.organization,
        marketScopes: chiQuyetSeed.marketScopes,
        status: chiQuyetSeed.status,
        linkedTraderId: chiQuyetSeed.linkedTraderId
      });
      existingIds.add(chiQuyetSeed.id);
      changed = true;
    }
    if (ttdManager && oldTtdStaff && oldTtdStaff.roleIds && oldTtdStaff.roleIds[0] !== 'market_manager') {
      Object.assign(oldTtdStaff, {
        accountType: ttdManager.accountType,
        title: ttdManager.title,
        roleIds: ttdManager.roleIds,
        organization: ttdManager.organization,
        marketScopes: ttdManager.marketScopes
      });
      changed = true;
    }
    defaultAccounts().forEach(acc => {
      if (!existingIds.has(acc.id)) {
        accounts.push(acc);
        existingIds.add(acc.id);
        changed = true;
      }
    });
    if (changed) {
      try {
        localStorage.setItem(AKEY, JSON.stringify(accounts));
        localStorage.setItem(ASCHEMA_KEY, String(A.RBAC_SCHEMA));
      } catch (e) { /* bỏ qua */ }
    }
    return accounts;
  }
  let ACCOUNTS = loadAccounts();
  function saveAccounts() {
    try {
      localStorage.setItem(AKEY, JSON.stringify(ACCOUNTS));
      localStorage.setItem(ASCHEMA_KEY, String(A.RBAC_SCHEMA));
    } catch (e) { /* bỏ qua */ }
  }

  A.ACCOUNTS = {
    KEY: AKEY,
    ACCOUNT_TYPES: ACCOUNT_TYPES,
    list: () => ACCOUNTS,
    get: id => ACCOUNTS.find(a => a.id === id),
    // V1 chỉ dùng roleIds[0] làm role hiệu lực (mỗi account seed đúng 1 role). Cấu trúc roleIds[]
    // vẫn là mảng để sau này hỗ trợ nhiều role/account mà không phải đổi shape dữ liệu — khi đó
    // chỉ cần sửa đúng hàm này (thêm UI chọn role trong account), mọi nơi khác đang gọi hàm này
    // không cần sửa.
    primaryRole: account => (account && account.roleIds && account.roleIds[0]) || null,
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
