/* Dữ liệu dùng chung cho màn "Tài khoản người dùng" (Vận hành) — đồng thời là nguồn
 * "Account Demo" mà topbar dùng để xác định phiên đang chạy (xem A.currentAccount() ở core.js).
 * Module này ĐỘC LẬP với D.STAFF trong data.js — D.STAFF vẫn giữ nguyên,
 * tiếp tục dùng cho dropdown "Người xử lý" ở Phản ánh & sự cố như cũ.
 * Seed mặc định TÁI SỬ DỤNG các bản ghi D.STAFF (không đổi mã/tên/chợ) cho 2 chợ có sẵn dữ liệu
 * nghiệp vụ (Chợ Cao Lãnh 'CL', Chợ quê Tân Thuận Đông 'TTD'), cộng thêm account demo tự viết cho
 * 10 chợ còn lại trong market master (RBAC_MARKET_SCOPE_MIGRATION mục 19 — market master 12 chợ,
 * xem D.MARKETS ở data.js) để chứng minh market scope hoạt động đúng ở mọi chợ, không chỉ 2 chợ gốc.
 *
 * RBAC_MARKET_SCOPE_MIGRATION: role master 8 → 6 (loại 'market_staff'/'accountant' — xem
 * js/permissions.js). roleIds của mọi account LUÔN thuộc 1 trong 6 role còn hiệu lực; đọc role hiệu
 * lực của account LUÔN qua A.ACCOUNTS.primaryRole() (không đọc roleIds[0] trực tiếp ở nơi khác), để
 * sau này hỗ trợ nhiều role/account chỉ cần sửa đúng 1 hàm này.
 *
 * scopeType (GLOBAL/MARKET, mục 5 yêu cầu) KHÔNG lưu thành field riêng để tránh 2 nguồn dữ liệu có
 * thể lệch nhau — suy ra TRỰC TIẾP từ marketScopes: chứa 'ALL' = GLOBAL (system_admin/ward_leader),
 * ngược lại = MARKET (market_manager/collector/technician/trader). Xem A.ACCOUNTS.scopeType() và
 * A.allowedMarkets() (js/core.js) — nơi DUY NHẤT giải mã 'ALL'.
 */
(function (A) {
  'use strict';
  const D = A.D;
  const AKEY = 'choso-caolanh-accounts';
  const ASCHEMA_KEY = 'choso-caolanh-accounts-schema';

  // ACCOUNT_TYPES ("Loại tài khoản" — filter/field hiển thị riêng, độc lập với Vai trò RBAC nhưng
  // PHẢI khớp đúng 1-1 với tên 6 role hiện hành để không còn nhãn "mồ côi" (RBAC_MARKET_SCOPE_
  // MIGRATION mục 2: "role labels" cũng phải migrate) — lấy ĐỘNG từ A.PERM.roles() (permissions.js
  // đã chạy xong trước accounts.js trong index.html, xem thứ tự script), không hard-code chuỗi lặp.
  const ACCOUNT_TYPES = A.PERM.roles().map(r => r.name);
  const roleName = id => { const r = A.PERM.role(id); return r ? r.name : id; };

  // D.STAFF[].role (text mô tả chức danh, data.js) → role id RBAC tương ứng. Chỉ còn 4 chức danh
  // thật sự tồn tại trong D.STAFF sau khi data.js đã migrate 3 dòng Kế toán/Nhân viên Ban Quản lý
  // chợ sang đúng 1 trong 6 role còn hiệu lực (xem data.js) — KHÔNG còn map nào trỏ tới
  // 'market_staff'/'accountant' (role đã nghỉ hưu).
  const STAFF_ROLE_MAP = {
    'Trưởng Ban Quản lý chợ': 'market_manager',
    'Nhân viên thu phí': 'collector',
    'Nhân viên thu phí phiên': 'collector',
    'Nhân viên kỹ thuật (điện, nước)': 'technician'
  };
  const RETIRED_SEED_ACCOUNT_IDS = [
    'AC-BQL-TTD', 'AC-PHIEN-DEMO',
    // RBAC_MARKET_SCOPE_MIGRATION: account demo "Nguyễn Văn A"/"Nguyễn Thanh Bình" tạo riêng cho
    // luồng "market_staff tiếp nhận yêu cầu tách điểm" (BUSINESS_POINT_SPLIT_WORKFLOW supplement) —
    // role 'market_staff' đã loại bỏ, bước "tiếp nhận" của tách/gộp/chuyển đổi điểm kinh doanh nay
    // gộp hẳn vào market_manager (NV01 đã có đủ quyền) nên không còn lý do nghiệp vụ riêng để giữ 2
    // account này (mục 26: "không giữ alias role cũ chỉ để tránh sửa code"). CL vẫn đủ 4 account
    // D.STAFF (1 market_manager + 2 collector + 1 technician) để demo mọi thao tác còn lại.
    'AC-NV08'
  ];

  function defaultStaffAccounts() {
    return D.STAFF.map(s => {
      const roleId = STAFF_ROLE_MAP[s.role] || 'collector';
      return {
        id: 'AC-' + s.id, code: s.id, fullName: s.name, phone: '',
        accountType: roleName(roleId),
        title: s.role, roleIds: [roleId],
        // Trưởng Ban Quản lý chợ quản lý cả 02 chợ có dữ liệu nghiệp vụ (demo "1 account, nhiều
        // chợ" — mục 19 yêu cầu); nhân viên gắn với đúng chợ được giao.
        organization: s.role === 'Trưởng Ban Quản lý chợ' ? 'Ban Quản lý chợ phường Cao Lãnh' : 'Ban Quản lý ' + ((D.MARKETS.find(m => m.id === s.market) || {}).short || s.market),
        marketScopes: s.role === 'Trưởng Ban Quản lý chợ' ? ['CL', 'TTD'] : [s.market], status: 'active'
      };
    });
  }

  // Account demo cho 10 chợ CHƯA có dữ liệu nghiệp vụ (floors:[] — xem data.js) — mỗi chợ có đúng 1
  // Trưởng Ban Quản lý chợ + 1 Nhân viên thu phí + 1 Nhân viên kỹ thuật (mục 19: mức tối thiểu),
  // KHÔNG có Tiểu thương demo (mục 19: "nếu phù hợp với dữ liệu hiện có" — 10 chợ này chưa có
  // A.db.traders/stalls thật để gắn traderId có ý nghĩa, tạo account tiểu thương "rỗng" không chứng
  // minh được gì thêm về ownership so với 4 account tiểu thương demo đã có ở CL/TTD). Tên người chỉ
  // là dữ liệu minh họa (mục 19: "Không tạo dữ liệu cá nhân thực").
  const NEW_MARKET_ROSTER = [
    ['HA', 'Nguyễn Văn Hòa', 'Trần Thị Ngọc An', 'Lê Văn Bình'],
    ['TVH', 'Phạm Văn Việt', 'Đặng Thị Hồng Hòa', 'Bùi Văn Toàn'],
    ['TTT', 'Ngô Văn Tây', 'Dương Thị Mỹ Dân', 'Lý Văn Thuận'],
    ['TL', 'Hồ Văn Lưu', 'Mai Thị Bình', 'Trương Văn Thông'],
    ['TT', 'Châu Văn Tịch', 'Lâm Thị Tân', 'Nguyễn Văn Đức'],
    ['TTH', 'Trần Văn Thới', 'Lê Thị Tịnh', 'Phạm Văn Long'],
    ['MN', 'Huỳnh Văn Ngãi', 'Võ Thị Mỹ', 'Đỗ Văn Sang'],
    ['LH', 'Ngô Văn Hồi', 'Dương Thị Long', 'Hồ Văn Thịnh'],
    ['XB', 'Mai Văn Bèo', 'Trương Thị Xẻo', 'Châu Văn Phát'],
    ['SQ', 'Lâm Văn Quốc', 'Nguyễn Thị Sáu', 'Trần Văn Cường']
  ];
  function newMarketAccounts() {
    const out = [];
    NEW_MARKET_ROSTER.forEach(row => {
      const mid = row[0], managerName = row[1], collectorName = row[2], technicianName = row[3];
      const m = D.MARKETS.find(x => x.id === mid);
      const org = 'Ban Quản lý ' + (m ? m.name : mid);
      const mk = (suffix, roleId, fullName, title) => ({
        id: 'AC-' + mid + '-' + suffix, code: mid + '-' + suffix, fullName, phone: '',
        accountType: roleName(roleId), title, roleIds: [roleId], organization: org,
        marketScopes: [mid], status: 'active'
      });
      out.push(mk('QL', 'market_manager', managerName, 'Trưởng Ban Quản lý chợ'));
      out.push(mk('TP', 'collector', collectorName, 'Nhân viên thu phí'));
      out.push(mk('KT', 'technician', technicianName, 'Nhân viên kỹ thuật'));
    });
    return out;
  }

  function defaultAccounts() {
    const list = defaultStaffAccounts();
    list.push(
      // 2 account GLOBAL (scopeType suy ra từ marketScopes=['ALL'] — mục 5/7 yêu cầu): Lãnh đạo UBND
      // và Quản trị hệ thống KHÔNG gán vào 1 chợ cụ thể nào (mục 12: "Không gán Admin/Lãnh đạo giả
      // vào từng market chỉ để thanh demo hoạt động").
      { id: 'AC-LD01', code: 'LD01', fullName: 'Nguyễn Văn Phúc', phone: '0909123456', accountType: roleName('ward_leader'), title: 'Phó Chủ tịch UBND phường', roleIds: ['ward_leader'], organization: 'UBND phường Cao Lãnh', marketScopes: ['ALL'], status: 'active' },
      { id: 'AC-QT01', code: 'QT01', fullName: 'Đặng Thị Thu', phone: '0909234567', accountType: roleName('system_admin'), title: 'Quản trị hệ thống', roleIds: ['system_admin'], organization: 'UBND phường Cao Lãnh', marketScopes: ['ALL'], status: 'active' },
      { id: 'AC-CHI-QUYET', code: 'CHI-QUYET', fullName: 'Chí Quyết', phone: '0909000001', accountType: roleName('trader'), title: 'Tiểu thương chợ quê', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'active', linkedTraderId: 'TTD-CQ', traderId: 'TTD-CQ' },
      { id: 'AC-TT-TTD', code: 'TT-TTD', fullName: 'Tiểu thương Chợ quê Tân Thuận Đông', phone: '0909666777', accountType: roleName('trader'), title: 'Tiểu thương chợ quê mẫu', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'active' },
      // TRADER_PROFILE_AND_MINIAPP_WORKFLOW: `traderId` — liên kết account Mini App với ĐÚNG 1
      // Trader Profile (A.db.traders, xem data.js). null = account tồn tại nhưng CHƯA/không còn gắn
      // với hồ sơ nào (giữ nguyên 2 account demo cũ này ở trạng thái CHƯA LIÊN KẾT — không có cách
      // nào xác định AN TOÀN chúng "là" trader nào trong A.db.traders vì tên/SĐT hoàn toàn độc lập
      // với dữ liệu mẫu sinh ngẫu nhiên có seed riêng; auto-link case demo LINKED thật lấy trực tiếp
      // từ A.db lúc runtime — xem A.ensureMiniAppDemoLink() ở js/core.js).
      { id: 'AC-TT01', code: 'TT-DEMO1', fullName: 'Nguyễn Thị Hoa', phone: '0909345678', accountType: roleName('trader'), title: 'Tiểu thương mẫu', roleIds: ['trader'], organization: 'Chợ Cao Lãnh', marketScopes: ['CL'], status: 'active', traderId: null },
      { id: 'AC-TT02', code: 'TT-DEMO2', fullName: 'Trần Văn Sáu', phone: '0909456789', accountType: roleName('trader'), title: 'Tiểu thương mẫu (đã tạm khoá minh hoạ)', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'disabled', traderId: null }
    );
    return list.concat(newMarketAccounts());
  }
  // Safe-merge cho account ĐÃ LƯU trong localStorage từ trước khi có field `traderId` (mục tương
  // tự mergeNewDefaultAccounts — KHÔNG đổi bất kỳ giá trị nào đã có, chỉ bổ sung field còn thiếu).
  function ensureTraderIdField(list) {
    let changed = false;
    list.forEach(a => { if (!('traderId' in a)) { a.traderId = null; changed = true; } });
    return changed;
  }

  // Bổ sung AN TOÀN account demo MỚI vào danh sách account ĐÃ LƯU trong localStorage của trình
  // duyệt — KHÔNG đụng account nào đã có (kể cả đã bị người dùng tuỳ biến qua màn "Tài khoản người
  // dùng": đổi tên, khoá/mở khoá, đổi vai trò/phạm vi chợ...). Chỉ thêm những id hoàn toàn chưa tồn
  // tại trong mảng đã lưu, giống nguyên tắc "merge, không reset" mà js/permissions.js đã áp dụng cho
  // RolePermission — KHÔNG bump `A.RBAC_SCHEMA` chỉ để thêm account demo (bump RBAC_SCHEMA sẽ kéo
  // theo reseed toàn bộ role/account/ui state, quá rộng so với thay đổi thật sự cần).
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
      // Schema migration: mảng account đã lưu từ bản role/market cũ không tương thích (RBAC_SCHEMA
      // đã bump — xem js/core.js) — chỉ dùng lại nếu đúng schema hiện tại, ngược lại bỏ và seed lại
      // từ defaultAccounts() (12 chợ, 6 role). Không cố "vá" account role đã nghỉ hưu (mục 25: fallback
      // an toàn, không tự nâng quyền).
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
    // scopeType (mục 5 yêu cầu) — suy ra từ marketScopes, KHÔNG lưu field riêng (xem comment đầu
    // file). 'GLOBAL' = system_admin/ward_leader (marketScopes chứa 'ALL'); 'MARKET' = còn lại.
    scopeType: account => (account && Array.isArray(account.marketScopes) && account.marketScopes.indexOf('ALL') !== -1) ? 'GLOBAL' : 'MARKET',
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
