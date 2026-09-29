/* Demo account seed (Phase 15.8, from js/accounts.js): staff accounts derived from D.STAFF plus the
 * demo roster of the 10 markets without business data. Consumed by features/accounts/store.js through
 * APP.data source "accounts-seed"; the store owns persistence and migrations. */
(function (A) {
  'use strict';
  const D = A.D;
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
  // Số demo phục vụ luồng đăng nhập SĐT + OTP của prototype; không phải dữ liệu thật.
  const STAFF_DEMO_PHONE_BY_ID = {
    // Bộ tài khoản đăng nhập demo của Chợ Cao Lãnh. Các số này là dữ liệu
    // minh hoạ, dùng cùng OTP mock; không phải số điện thoại cá nhân.
    NV01: '0900000001',
    NV02: '0900000002',
    NV03: '0900000003',
    NV04: '0900000004',
    NV05: '0900000005'
  };

  function defaultStaffAccounts() {
    return D.STAFF.map(s => {
      const roleId = STAFF_ROLE_MAP[s.role] || 'collector';
      return {
        id: 'AC-' + s.id, code: s.id, fullName: s.name, phone: STAFF_DEMO_PHONE_BY_ID[s.id] || '',
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
  // SĐT demo cho luồng đăng nhập SĐT + OTP mock (dữ liệu minh hoạ, không phải số thật). Chỉ Chợ Hòa
  // An dùng cho E2E; account đã lưu có phone rỗng được mergeSeedAccounts (store.js) backfill.
  const NEW_MARKET_DEMO_PHONE_BY_ID = {
    'AC-HA-QL': '0911000001',
    'AC-HA-TP': '0911000002'
  };
  function newMarketAccounts() {
    const out = [];
    NEW_MARKET_ROSTER.forEach(row => {
      const mid = row[0], managerName = row[1], collectorName = row[2], technicianName = row[3];
      const m = D.MARKETS.find(x => x.id === mid);
      const org = 'Ban Quản lý ' + (m ? m.name : mid);
      const mk = (suffix, roleId, fullName, title) => ({
        id: 'AC-' + mid + '-' + suffix, code: mid + '-' + suffix, fullName, phone: NEW_MARKET_DEMO_PHONE_BY_ID['AC-' + mid + '-' + suffix] || '',
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
      // Hai actor kế toán dùng role metadata chưa được cấp permission nghiệp vụ mặc định.
      // Chỉ cập nhật dữ liệu tài khoản demo; không thay đổi ma trận quyền của các role.
      { id: 'AC-KTTT01', code: 'KTTT01', fullName: 'Nguyễn Thị Minh Anh', phone: '0909000505', accountType: roleName('central_accountant'), title: 'Kế toán Trung tâm', roleIds: ['central_accountant'], organization: 'Trung tâm Cung ứng dịch vụ công', marketScopes: ['CL'], status: 'active' },
      { id: 'AC-KTP01', code: 'KTP01', fullName: 'Trần Thị Thu Hà', phone: '0909000606', accountType: roleName('ward_accountant'), title: 'Kế toán phường', roleIds: ['ward_accountant'], organization: 'UBND phường Cao Lãnh', marketScopes: D.MARKETS.map(m => m.id), status: 'active' },
      { id: 'AC-CHI-QUYET', code: 'CHI-QUYET', fullName: 'Chí Quyết', phone: '0909000001', accountType: roleName('trader'), title: 'Tiểu thương chợ quê', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'active', linkedTraderId: 'TTD-CQ', traderId: 'TTD-CQ' },
      { id: 'AC-TT-TTD', code: 'TT-TTD', fullName: 'Tiểu thương Chợ quê Tân Thuận Đông', phone: '0909666777', accountType: roleName('trader'), title: 'Tiểu thương chợ quê mẫu', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'active' },
      // TRADER_PROFILE_AND_MINIAPP_WORKFLOW: `traderId` — liên kết account Mini App với ĐÚNG 1
      // Trader Profile (A.db.traders, xem data.js). null = account tồn tại nhưng CHƯA/không còn gắn
      // với hồ sơ nào (giữ nguyên 2 account demo cũ này ở trạng thái CHƯA LIÊN KẾT — không có cách
      // nào xác định AN TOÀN chúng "là" trader nào trong A.db.traders vì tên/SĐT hoàn toàn độc lập
      // với dữ liệu mẫu sinh ngẫu nhiên có seed riêng; auto-link case demo LINKED thật lấy trực tiếp
      // từ A.db lúc runtime — xem A.ensureMiniAppDemoLink() ở js/core.js).
      { id: 'AC-TT01', code: 'TT-DEMO1', fullName: 'Nguyễn Thị Hoa', phone: '0909345678', accountType: roleName('trader'), title: 'Tiểu thương mẫu', roleIds: ['trader'], organization: 'Chợ Cao Lãnh', marketScopes: ['CL'], status: 'active', traderId: null },
      // Tài khoản Mini App của TT0003 Trần Thị Kim Nhung (thuê 4 điểm KA-A03/KA-A04/HS-A01/TG-A01, Chợ
      // Cao Lãnh) — SĐT trùng hồ sơ tiểu thương trong data.js; liên kết đúng 1 hồ sơ qua traderId.
      { id: 'AC-TT03', code: 'TT0003', fullName: 'Trần Thị Kim Nhung', phone: '0918320516', accountType: roleName('trader'), title: 'Tiểu thương (thuê 4 điểm)', roleIds: ['trader'], organization: 'Chợ Cao Lãnh', marketScopes: ['CL'], status: 'active', linkedTraderId: 'TT0003', traderId: 'TT0003' },
      // DOI_SOAT_CUOI_NGAY: Kế toán Ban Quản lý Chợ Cao Lãnh (role market_accountant) — nhận tiền mặt NV thu phí
      // nộp cuối buổi và đối soát phiếu nộp. Tên là dữ liệu mẫu; không gán SĐT đăng nhập trong code (SĐT thử chỉ
      // đặt ở trang local frontend/tai-khoan-thu-phi.local.html).
      { id: 'AC-KT01', code: 'KT01', fullName: 'Lê Thị Thu Trang', phone: '', accountType: roleName('market_accountant'), title: 'Kế toán Ban Quản lý chợ', roleIds: ['market_accountant'], organization: 'Ban Quản lý Chợ Cao Lãnh', marketScopes: ['CL'], status: 'active' },
      { id: 'AC-TT02', code: 'TT-DEMO2', fullName: 'Trần Văn Sáu', phone: '0909456789', accountType: roleName('trader'), title: 'Tiểu thương mẫu (đã tạm khoá minh hoạ)', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'disabled', traderId: null }
    );
    return list.concat(newMarketAccounts());
  }
  A.data.registerSource('accounts-seed', { defaultAccounts });
})(window.APP);
