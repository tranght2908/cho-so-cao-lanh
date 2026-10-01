/* Demo account seed (Phase 15.8, from js/accounts.js). CURRENT ORGANIZATION demo set only — một Tổ
 * Quản lý chợ chung cho 12 chợ: 1 Quản trị hệ thống, 1 Tổ trưởng (NV01), 3 NV thu phí, 3 NV kỹ thuật,
 * 1 Kế toán Trung tâm (A05), 1 Lãnh đạo UBND phường + vài Tiểu thương demo. Account demo cũ (NV04, NV08,
 * TP/KT/QL của 10 chợ, KT01...) không seed nữa; bản đã lưu được store giữ nguyên nhưng ẩn khỏi tổ chức
 * hiện hành. Consumed by features/accounts/store.js through APP.data source "accounts-seed". */
(function (A) {
  'use strict';
  const D = A.D;
  const roleName = id => { const r = A.PERM.role(id); return r ? r.name : id; };
  const managementUnit = () => (A.MARKET_CATALOG && A.MARKET_CATALOG.MANAGEMENT_UNIT) || 'Tổ Quản lý chợ';

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

  // Phân công NV thu phí hiện hành theo Chợ (nguồn DUY NHẤT: Account.marketScopes). 12 id lấy đúng từ
  // D.MARKETS; mỗi Chợ đúng 1 NV, mỗi NV 4 Chợ. Store kiểm tra lại với D.MARKETS và không tạo trùng.
  const COLLECTOR_MARKET_SCOPES = {
    NV02: ['CL', 'HA', 'TVH', 'TTT'],
    NV03: ['TL', 'TT', 'TTH', 'MN'],
    NV07: ['TTD', 'LH', 'XB', 'SQ']
  };
  // D.STAFF thuộc tổ chức hiện hành. NV04/NV08 (NV thu phí) và NV06 (Trưởng Ban TTD cũ) vẫn ở D.STAFF để
  // đọc lịch sử (payment.by, Incident.assignee...) nhưng không còn account demo hiện hành.
  const CURRENT_STAFF_IDS = ['NV01', 'NV02', 'NV03', 'NV05', 'NV07', 'NV09'];
  // NV kỹ thuật được giao việc theo Incident.assignee, không theo Chợ/Khu/Dãy. marketScopes=['ALL'] chỉ
  // để mở được sự cố được giao ở bất kỳ chợ nào; không phải ownership.
  const staffScopes = (s, roleId) => roleId === 'market_manager' || roleId === 'technician' ? ['ALL'] : (COLLECTOR_MARKET_SCOPES[s.id] || [s.market]);

  function defaultStaffAccounts() {
    return D.STAFF.filter(s => CURRENT_STAFF_IDS.indexOf(s.id) !== -1).map(s => {
      const roleId = STAFF_ROLE_MAP[s.role] || 'collector';
      return {
        id: 'AC-' + s.id, code: s.id, fullName: s.name, phone: STAFF_DEMO_PHONE_BY_ID[s.id] || '',
        accountType: roleName(roleId),
        title: s.role, roleIds: [roleId],
        organization: managementUnit(),
        marketScopes: staffScopes(s, roleId), status: 'active'
      };
    });
  }

  // NV kỹ thuật thứ 3 tái sử dụng account demo sẵn có AC-HA-KT (cùng id/code/tên — không tạo trùng).
  function extraTechnicianAccount() {
    return { id: 'AC-HA-KT', code: 'HA-KT', fullName: 'Lê Văn Bình', phone: '', accountType: roleName('technician'), title: 'Nhân viên kỹ thuật', roleIds: ['technician'], organization: managementUnit(), marketScopes: ['ALL'], status: 'active' };
  }

  function defaultAccounts() {
    const list = defaultStaffAccounts();
    list.push(extraTechnicianAccount(),
      // 2 account GLOBAL (scopeType suy ra từ marketScopes=['ALL'] — mục 5/7 yêu cầu): Lãnh đạo UBND
      // và Quản trị hệ thống KHÔNG gán vào 1 chợ cụ thể nào (mục 12: "Không gán Admin/Lãnh đạo giả
      // vào từng market chỉ để thanh demo hoạt động").
      { id: 'AC-LD01', code: 'LD01', fullName: 'Nguyễn Văn Phúc', phone: '0909123456', accountType: roleName('ward_leader'), title: 'Phó Chủ tịch UBND phường', roleIds: ['ward_leader'], organization: 'UBND phường Cao Lãnh', marketScopes: ['ALL'], status: 'active' },
      { id: 'AC-QT01', code: 'QT01', fullName: 'Đặng Thị Thu', phone: '0909234567', accountType: roleName('system_admin'), title: 'Quản trị hệ thống', roleIds: ['system_admin'], organization: 'UBND phường Cao Lãnh', marketScopes: ['ALL'], status: 'active' },
      // Kế toán Trung tâm (A05) — role kế toán duy nhất hiện hành, phạm vi ALL. Không còn Kế toán phường
      // (A06) hay Kế toán Ban Quản lý chợ (market_accountant) trong tổ chức hiện hành.
      { id: 'AC-KTTT01', code: 'KTTT01', fullName: 'Nguyễn Thị Minh Anh', phone: '0909000505', accountType: roleName('central_accountant'), title: 'Kế toán Trung tâm', roleIds: ['central_accountant'], organization: 'Trung tâm Cung ứng dịch vụ công', marketScopes: ['ALL'], status: 'active' },
      { id: 'AC-CHI-QUYET', code: 'CHI-QUYET', fullName: 'Chí Quyết', phone: '0909000001', accountType: roleName('trader'), title: 'Tiểu thương chợ quê', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'active', linkedTraderId: 'TTD-CQ', traderId: 'TTD-CQ' },
      { id: 'AC-TT-TTD', code: 'TT-TTD', fullName: 'Tiểu thương Chợ quê Tân Thuận Đông', phone: '0909666777', accountType: roleName('trader'), title: 'Tiểu thương chợ quê mẫu', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'active' },
      // TRADER_PROFILE_AND_MINIAPP_WORKFLOW: `traderId` — liên kết account Mini App với ĐÚNG 1
      // Trader Profile (A.db.traders, xem data.js). null = account tồn tại nhưng CHƯA/không còn gắn
      // với hồ sơ nào (giữ nguyên 2 account demo cũ này ở trạng thái CHƯA LIÊN KẾT — không có cách
      // nào xác định AN TOÀN chúng "là" trader nào trong A.db.traders vì tên/SĐT hoàn toàn độc lập
      // với dữ liệu mẫu sinh ngẫu nhiên có seed riêng; auto-link case demo LINKED thật lấy trực tiếp
      // từ A.db khi Management tạo/link tài khoản; bootstrap không tự liên kết hồ sơ demo.
      { id: 'AC-TT01', code: 'TT-DEMO1', fullName: 'Nguyễn Thị Hoa', phone: '0909345678', accountType: roleName('trader'), title: 'Tiểu thương mẫu', roleIds: ['trader'], organization: 'Chợ Cao Lãnh', marketScopes: ['CL'], status: 'active', traderId: 'TT0001', demoTraderLinkVersion: 1 },
      // Tài khoản Mini App của TT0003 Trần Thị Kim Nhung (thuê 4 điểm KA-A03/KA-A04/HS-A01/TG-A01, Chợ
      // Cao Lãnh) — SĐT trùng hồ sơ tiểu thương trong data.js; liên kết đúng 1 hồ sơ qua traderId.
      { id: 'AC-TT03', code: 'TT0003', fullName: 'Trần Thị Kim Nhung', phone: '0918320516', accountType: roleName('trader'), title: 'Tiểu thương (thuê 4 điểm)', roleIds: ['trader'], organization: 'Chợ Cao Lãnh', marketScopes: ['CL'], status: 'active', linkedTraderId: 'TT0003', traderId: 'TT0003' },
      // Tài khoản web tiểu thương của TT0009 Bùi Thị Bích Xuân (điểm HS-B01, HS-B02, Chợ Cao Lãnh) — SĐT trùng
      // hồ sơ trong data.js; bổ sung 01/10/2026, mergeSeedAccounts tự thêm vào danh sách account đã lưu.
      { id: 'AC-TT09', code: 'TT0009', fullName: 'Bùi Thị Bích Xuân', phone: '0998387443', accountType: roleName('trader'), title: 'Tiểu thương (thuê 2 điểm)', roleIds: ['trader'], organization: 'Chợ Cao Lãnh', marketScopes: ['CL'], status: 'active', linkedTraderId: 'TT0009', traderId: 'TT0009' },
      { id: 'AC-TT02', code: 'TT-DEMO2', fullName: 'Trần Văn Sáu', phone: '0909456789', accountType: roleName('trader'), title: 'Tiểu thương mẫu (đã tạm khoá minh hoạ)', roleIds: ['trader'], organization: 'Chợ quê Tân Thuận Đông', marketScopes: ['TTD'], status: 'disabled', traderId: null }
    );
    return list;
  }
  A.data.registerSource('accounts-seed', { defaultAccounts, collectorMarketScopes: () => COLLECTOR_MARKET_SCOPES });
})(window.APP);
