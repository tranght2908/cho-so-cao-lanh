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
      // Trưởng Ban Quản lý chợ quản lý cả 02 chợ; nhân viên gắn với chợ được giao.
      organization: s.role === 'Trưởng Ban Quản lý chợ' ? 'Ban Quản lý chợ phường Cao Lãnh' : 'Ban Quản lý ' + ((D.MARKETS.find(m => m.id === s.market) || {}).short || s.market),
      marketScopes: s.role === 'Trưởng Ban Quản lý chợ' ? ['CL', 'TTD'] : [s.market], status: 'active'
    }));
    list.push(
      { id: 'AC-NV08', code: 'NV08', fullName: 'Nguyễn Văn A', phone: '0909567890', accountType: 'Nhân viên Ban Quản lý chợ', title: 'Nhân viên Ban Quản lý chợ (nghiệp vụ mặt bằng)', roleIds: ['market_staff'], organization: 'Ban Quản lý Chợ Cao Lãnh', marketScopes: ['CL'], status: 'active' },
      { id: 'AC-LD01', code: 'LD01', fullName: 'Nguyễn Văn Phúc', phone: '0909123456', accountType: 'Lãnh đạo UBND phường', title: 'Phó Chủ tịch UBND phường', roleIds: ['ward_leader'], organization: 'UBND phường Cao Lãnh', marketScopes: ['ALL'], status: 'active' },
      { id: 'AC-QT01', code: 'QT01', fullName: 'Đặng Thị Thu', phone: '0909234567', accountType: 'Quản trị hệ thống', title: 'Quản trị hệ thống', roleIds: ['system_admin'], organization: 'UBND phường Cao Lãnh', marketScopes: ['ALL'], status: 'active' },
      { id: 'AC-CHI-QUYET', code: 'CHI-QUYET', fullName: 'Chí Quyết', phone: '0909000001', accountType: 'Tiểu thương', title: 'Tiểu thương chợ quê', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'active', linkedTraderId: 'TTD-CQ', traderId: 'TTD-CQ' },
      { id: 'AC-TT-TTD', code: 'TT-TTD', fullName: 'Tiểu thương Chợ quê Tân Thuận Đông', phone: '0909666777', accountType: 'Tiểu thương', title: 'Tiểu thương chợ quê mẫu', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'active' },
      // BUSINESS_POINT_SPLIT_WORKFLOW supplement (yêu cầu bổ sung — luồng "Trưởng BQL chủ động đề
      // xuất"): D.STAFF (data.js) KHÔNG có sẵn nhân viên nào mang role V1 `market_staff` VÀ scoped
      // đúng Chợ Cao Lãnh (chỉ có 'Tổ quản lý chợ quê' → market_staff, nhưng market: 'TTD') — nếu
      // không có account demo này, bước "Nhân viên BQL tiếp nhận/hoàn thiện phương án" (permKey
      // `diem-kd.tach-diem.tiep-nhan`) và dropdown "Người xử lý" ở form "Đề xuất tách điểm" (Trưởng
      // BQL giao việc) không thể demo được cho CL. Thêm ĐÚNG 1 account thủ công (cùng pattern với 4
      // account tay bên trên/dưới — KHÔNG sửa D.STAFF/data.js), dùng tên "Nguyễn Văn A" khớp với ví
      // dụ trong yêu cầu bổ sung.
      // TRADER_PROFILE_AND_MINIAPP_WORKFLOW: `traderId` MỚI — liên kết account Mini App với ĐÚNG 1
      // Trader Profile (A.db.traders, xem data.js). null = account tồn tại nhưng CHƯA/không còn gắn
      // với hồ sơ nào (giữ nguyên 2 account demo cũ này ở trạng thái CHƯA LIÊN KẾT — không có cách
      // nào xác định AN TOÀN chúng "là" trader nào trong A.db.traders vì tên/SĐT hoàn toàn độc lập
      // với dữ liệu mẫu sinh ngẫu nhiên có seed riêng; auto-link case demo LINKED thật lấy trực tiếp
      // từ A.db lúc runtime — xem A.ensureMiniAppDemoLink() ở js/core.js).
      { id: 'AC-TT01', code: 'TT-DEMO1', fullName: 'Nguyễn Thị Hoa', phone: '0909345678', accountType: 'Tiểu thương', title: 'Tiểu thương mẫu', roleIds: ['trader'], organization: 'Chợ Cao Lãnh', marketScopes: ['CL'], status: 'active', traderId: null },
      { id: 'AC-TT02', code: 'TT-DEMO2', fullName: 'Trần Văn Sáu', phone: '0909456789', accountType: 'Tiểu thương', title: 'Tiểu thương mẫu (đã tạm khoá minh hoạ)', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'disabled', traderId: null }
    );
    return list;
  }
  // Safe-merge cho account ĐÃ LƯU trong localStorage từ trước khi có field `traderId` (mục tương
  // tự mergeNewDefaultAccounts — KHÔNG đổi bất kỳ giá trị nào đã có, chỉ bổ sung field còn thiếu).
  function ensureTraderIdField(list) {
    let changed = false;
    list.forEach(a => { if (!('traderId' in a)) { a.traderId = null; changed = true; } });
    return changed;
  }

  // Bổ sung AN TOÀN account demo MỚI (vd. AC-NV08 ở trên) vào danh sách account ĐÃ LƯU trong
  // localStorage của trình duyệt — KHÔNG đụng account nào đã có (kể cả đã bị người dùng tuỳ biến qua
  // màn "Tài khoản người dùng": đổi tên, khoá/mở khoá, đổi vai trò/phạm vi chợ...). Chỉ thêm những id
  // hoàn toàn chưa tồn tại trong mảng đã lưu, giống nguyên tắc "merge, không reset" mà
  // js/permissions.js đã áp dụng cho RolePermission — KHÔNG bump `A.RBAC_SCHEMA` chỉ để thêm 1
  // account demo (bump RBAC_SCHEMA sẽ kéo theo reseed toàn bộ role/account/ui state, quá rộng so với
  // thay đổi thật sự cần).
  function mergeNewDefaultAccounts(stored) {
    const ids = new Set(stored.map(a => a.id));
    const additions = defaultAccounts().filter(a => !ids.has(a.id));
    if (!additions.length) return stored;
    const merged = stored.concat(additions);
    try { localStorage.setItem(AKEY, JSON.stringify(merged)); } catch (e) { /* bỏ qua */ }
    return merged;
  }
  function loadAccounts() {
    try {
      // RBAC V1 migration: mảng account đã lưu từ bản role cũ (roleIds như 'bql'/'lanhdao'/
      // 'tieuthuong') không tương thích — chỉ dùng lại nếu đúng schema hiện tại, ngược lại bỏ và
      // seed lại từ defaultAccounts() (đã dùng role id V1).
      if (localStorage.getItem(ASCHEMA_KEY) === String(A.RBAC_SCHEMA)) {
        const s = localStorage.getItem(AKEY);
        if (s) {
          const x = JSON.parse(s);
          if (Array.isArray(x)) {
            const merged = mergeSeedAccounts(x);
            if (ensureTraderIdField(merged)) { try { localStorage.setItem(AKEY, JSON.stringify(merged)); } catch (e) { /* bỏ qua */ } }
            return merged;
          }
        }
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
  function normalizePc3aAccounts() {
    let changed = false;
    const manager = ACCOUNTS.find(a => a.id === 'AC-NV01');
    if (manager && manager.roleIds && manager.roleIds[0] === 'market_manager') {
      manager.marketScopes = Array.isArray(manager.marketScopes) ? manager.marketScopes : [];
      if (manager.marketScopes.indexOf('ALL') !== -1) {
        manager.marketScopes = ['CL', 'TTD'];
        changed = true;
      }
      if (manager.marketScopes.indexOf('CL') === -1) {
        manager.marketScopes.push('CL');
        changed = true;
      }
      if (manager.marketScopes.indexOf('TTD') === -1) {
        manager.marketScopes.push('TTD');
        changed = true;
      }
    }
    const clStaff = ACCOUNTS.find(a => a.id === 'AC-NV08');
    const sameName = ACCOUNTS.find(a => a.id !== 'AC-NV08' && a.fullName === 'Nguyễn Thanh Bình');
    if (!clStaff && !sameName) {
      ACCOUNTS.push({ id: 'AC-NV08', code: 'BQL-CL-01', fullName: 'Nguyễn Thanh Bình', phone: '', accountType: 'Nhân viên Ban Quản lý chợ', title: 'Nhân viên Ban Quản lý Chợ Cao Lãnh', roleIds: ['market_staff'], organization: 'Ban Quản lý Chợ Cao Lãnh', marketScopes: ['CL'], status: 'active' });
      changed = true;
    }
    if (changed) saveAccounts();
  }
  normalizePc3aAccounts();
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
    // Tài khoản Mini App liên kết với 1 traderId (TRADER_PROFILE_AND_MINIAPP_WORKFLOW) — chỉ tìm
    // trong account role 'trader', KHÔNG giả định 1-1 tuyệt đối ở tầng dữ liệu (phòng thủ dữ liệu
    // hỏng/nhiều account cùng trỏ 1 traderId) nhưng UI/nghiệp vụ luôn coi là 1-1.
    byTraderId: traderId => ACCOUNTS.find(a => a.traderId === traderId) || null,
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
