/* Model phân quyền động: Role, Permission, RolePermission, Scope.
 *
 * RBAC V1 — PHASE 4B (Action Permission V1). Xem CURRENT_RBAC_BASELINE.md / RBAC_V1_SPEC.md /
 * PHASE4_ACTION_AUDIT.md.
 *
 * Role catalog: 8 role V1 (system_admin, ward_leader, market_manager, market_staff, accountant,
 * collector, technician, trader) — xem defaultRoles() bên dưới. Không còn role id cũ
 * (lanhdao/bql/tieuthuong) ở bất kỳ đâu, không dùng làm authorization source.
 *
 * `screenRoles` (mục 3, defaultRolePermissions()) là DEFAULT SCREEN PERMISSION MATRIX V1 (Phase 3,
 * không đổi ở Phase 4B) — "role có được vào màn nào".
 *
 * `actionRoles` (mục 3) từ Phase 4B là DEFAULT ACTION PERMISSION MATRIX V1 CHÍNH THỨC (theo đúng
 * bảng đã chốt trong yêu cầu Phase 4B) — "role có được làm gì BÊN TRONG 1 màn". Cả hai đều chỉ là
 * SEED BAN ĐẦU: admin có thể sửa động qua màn "Vai trò & phân quyền" (`A.PERM.grant/revoke`), UI và
 * handler đều đọc lại `STATE` mới ngay — không có ma trận nào bị hard-code cứng trong view.
 *
 * Nguyên tắc least-privilege đã áp dụng: `technician` KHÔNG có bất kỳ action permission nào ở V1
 * (chỉ có `screen:su-co`/`screen:so-do` — xem được nhưng chưa thao tác được, chờ xác nhận nghiệp vụ
 * ở Phase 5); nhiều mục khác còn NEED_CONFIRMATION (xem PHASE4_ACTION_AUDIT.md mục 9) nên cố tình
 * KHÔNG cấp mặc định cho tới khi có xác nhận nghiệp vụ.
 */
(function (A) {
  'use strict';
  const PKEY = 'choso-caolanh-permissions';

  // ============================================================
  // 1) PERMISSION — danh mục quyền (catalog). Tương đối tĩnh: chỉ
  //    thêm dòng mới khi có thêm màn hình/hành động mới trong app.
  //    kind: 'screen' = được vào 1 màn trong menu
  //          'action' = được làm 1 thao tác cụ thể bên trong 1 màn
  // ============================================================
  const CATALOG = [
    { key: 'screen:tong-quan', kind: 'screen', group: 'Điều hành', label: 'Tổng quan liên chợ' },
    { key: 'screen:cau-truc', kind: 'screen', group: 'Điều hành', label: 'Thiết lập mặt bằng chợ' },
    { key: 'screen:so-do', kind: 'screen', group: 'Điều hành', label: 'Sơ đồ mặt bằng' },
    { key: 'screen:phien-cho', kind: 'screen', group: 'Điều hành', label: 'Phiên chợ quê' },
    { key: 'screen:diem-kd', kind: 'screen', group: 'Tiểu thương & hợp đồng', label: 'Điểm kinh doanh' },
    { key: 'screen:tieu-thuong', kind: 'screen', group: 'Tiểu thương & hợp đồng', label: 'Tiểu thương' },
    { key: 'screen:hop-dong', kind: 'screen', group: 'Tiểu thương & hợp đồng', label: 'Hợp đồng' },
    { key: 'screen:dien-nuoc', kind: 'screen', group: 'Tài chính', label: 'Chỉ số điện, nước' },
    { key: 'screen:phai-thu', kind: 'screen', group: 'Tài chính', label: 'Khoản phải thu' },
    { key: 'screen:thu-tien', kind: 'screen', group: 'Tài chính', label: 'Thu tiền & biên lai' },
    { key: 'screen:doi-soat', kind: 'screen', group: 'Tài chính', label: 'Đối soát' },
    { key: 'screen:cong-no', kind: 'screen', group: 'Tài chính', label: 'Công nợ & nhắc nợ' },
    { key: 'screen:su-co', kind: 'screen', group: 'Vận hành', label: 'Phản ánh & sự cố' },
    { key: 'screen:thong-bao', kind: 'screen', group: 'Vận hành', label: 'Thông báo đa kênh' },
    { key: 'screen:bao-cao', kind: 'screen', group: 'Vận hành', label: 'Báo cáo thống kê' },
    { key: 'screen:tai-khoan', kind: 'screen', group: 'Vận hành', label: 'Tài khoản người dùng' },
    { key: 'screen:cai-dat', kind: 'screen', group: 'Vận hành', label: 'Cài đặt & phân quyền' },
    { key: 'screen:mini-app', kind: 'screen', group: 'Dành cho tiểu thương', label: 'Mini app tiểu thương' },

    { key: 'action:cau-truc.edit', kind: 'action', group: 'Điều hành', screenId: 'cau-truc', label: 'Thêm/sửa khối, tầng, khu, loại điểm; lưu nháp/chính thức' },
    { key: 'action:cau-truc.delete', kind: 'action', group: 'Điều hành', screenId: 'cau-truc', label: 'Xoá khối, tầng, khu, loại điểm' },
    { key: 'action:cau-truc.reset', kind: 'action', group: 'Điều hành', screenId: 'cau-truc', label: 'Khôi phục cấu trúc mặc định' },
    { key: 'action:so-do.xem-ho-so', kind: 'action', group: 'Điều hành', screenId: 'so-do', label: 'Xem hồ sơ tiểu thương từ sơ đồ mặt bằng' },
    { key: 'action:so-do.tao-hop-dong', kind: 'action', group: 'Điều hành', screenId: 'so-do', label: 'Tạo hợp đồng từ sơ đồ mặt bằng' },
    { key: 'action:so-do.doi-trang-thai', kind: 'action', group: 'Điều hành', screenId: 'so-do', label: 'Đổi trạng thái điểm kinh doanh' },
    { key: 'action:phien-cho.chot-phien', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Điểm danh & chốt phiên chợ quê' },
    { key: 'action:tieu-thuong.them-moi', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'tieu-thuong', label: 'Thêm hồ sơ tiểu thương' },
    { key: 'action:hop-dong.tao', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'hop-dong', label: 'Tạo hợp đồng (từ màn Hợp đồng)' },
    { key: 'action:hop-dong.gia-han', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'hop-dong', label: 'Gia hạn hợp đồng' },
    { key: 'action:hop-dong.thanh-ly', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'hop-dong', label: 'Thanh lý hợp đồng' },
    { key: 'action:dien-nuoc.ghi-chi-so', kind: 'action', group: 'Tài chính', screenId: 'dien-nuoc', label: 'Nhập / lưu nháp chỉ số điện, nước' },
    { key: 'action:dien-nuoc.chot-ky', kind: 'action', group: 'Tài chính', screenId: 'dien-nuoc', label: 'Chốt kỳ ghi chỉ số điện, nước' },
    { key: 'action:dien-nuoc.yeu-cau-dieu-chinh', kind: 'action', group: 'Tài chính', screenId: 'dien-nuoc', label: 'Yêu cầu điều chỉnh chỉ số kỳ đã chốt' },
    { key: 'action:phai-thu.phat-hanh', kind: 'action', group: 'Tài chính', screenId: 'phai-thu', label: 'Phát hành khoản phải thu tự động' },
    { key: 'action:phai-thu.mien-giam', kind: 'action', group: 'Tài chính', screenId: 'phai-thu', label: 'Miễn giảm / điều chỉnh khoản phải thu' },
    { key: 'action:thu-tien.thu', kind: 'action', group: 'Tài chính', screenId: 'thu-tien', label: 'Thu tiền (mọi nơi có nút "Thu tiền")' },
    { key: 'action:doi-soat.xem-ngan-hang', kind: 'action', group: 'Tài chính', screenId: 'doi-soat', label: 'Xem đối soát ngân hàng / QR' },
    { key: 'action:doi-soat.gan-thu-cong', kind: 'action', group: 'Tài chính', screenId: 'doi-soat', label: 'Gắn khoản thu thủ công cho giao dịch ngân hàng' },
    { key: 'action:doi-soat.xem-tien-mat', kind: 'action', group: 'Tài chính', screenId: 'doi-soat', label: 'Xem đối soát tiền mặt' },
    { key: 'action:doi-soat.xac-nhan-nop-quy', kind: 'action', group: 'Tài chính', screenId: 'doi-soat', label: 'Xác nhận đối soát nộp quỹ tiền mặt' },
    { key: 'action:doi-soat.xem-truy-vet', kind: 'action', group: 'Tài chính', screenId: 'doi-soat', label: 'Xem lịch sử truy vết đối soát' },
    { key: 'action:cong-no.nhac-no', kind: 'action', group: 'Tài chính', screenId: 'cong-no', label: 'Nhắc nợ 1 tiểu thương' },
    { key: 'action:cong-no.nhac-no-hang-loat', kind: 'action', group: 'Tài chính', screenId: 'cong-no', label: 'Nhắc nợ hàng loạt' },
    { key: 'action:su-co.tao-phan-anh', kind: 'action', group: 'Vận hành', screenId: 'su-co', label: 'Tạo phản ánh / sự cố thủ công' },
    { key: 'action:su-co.phan-cong', kind: 'action', group: 'Vận hành', screenId: 'su-co', label: 'Phân công người xử lý' },
    { key: 'action:su-co.chuyen-trang-thai', kind: 'action', group: 'Vận hành', screenId: 'su-co', label: 'Chuyển trạng thái xử lý' },
    { key: 'action:su-co.vuot-cap', kind: 'action', group: 'Vận hành', screenId: 'su-co', label: 'Chuyển phản ánh vượt cấp lên phường' },
    { key: 'action:su-co.chi-dao', kind: 'action', group: 'Vận hành', screenId: 'su-co', label: 'Gửi ý kiến chỉ đạo (cho phản ánh đã vượt cấp)' },
    { key: 'action:thong-bao.gui', kind: 'action', group: 'Vận hành', screenId: 'thong-bao', label: 'Gửi thông báo đa kênh' },
    { key: 'action:tai-khoan.tao-moi', kind: 'action', group: 'Vận hành', screenId: 'tai-khoan', label: 'Thêm tài khoản người dùng' },
    { key: 'action:tai-khoan.sua', kind: 'action', group: 'Vận hành', screenId: 'tai-khoan', label: 'Sửa thông tin tài khoản' },
    { key: 'action:tai-khoan.khoa-mo-khoa', kind: 'action', group: 'Vận hành', screenId: 'tai-khoan', label: 'Khoá / mở khoá tài khoản' },
    { key: 'action:tai-khoan.gan-quyen', kind: 'action', group: 'Vận hành', screenId: 'tai-khoan', label: 'Gán vai trò / phạm vi chợ cho tài khoản' },
    { key: 'action:cai-dat.gia-mat-bang', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Quản lý đơn giá mặt bằng (Cấu hình dịch vụ)' },
    { key: 'action:cai-dat.gia-dien-nuoc', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Quản lý giá điện, nước (Cấu hình dịch vụ)' },
    { key: 'action:cai-dat.dich-vu-khac', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Quản lý dịch vụ khác (Cấu hình dịch vụ)' },
    { key: 'action:cai-dat.ky-thu', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Cấu hình kỳ thu' },
    { key: 'action:cai-dat.quy-tac-thu-phi', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Cấu hình quy tắc thu phí' },
    { key: 'action:cai-dat.vai-tro.tao', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Tạo vai trò mới' },
    { key: 'action:cai-dat.vai-tro.sua', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Sửa thông tin vai trò' },
    { key: 'action:cai-dat.vai-tro.khoa', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Vô hiệu hoá / kích hoạt lại vai trò' },
    { key: 'action:cai-dat.vai-tro.xoa', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Xoá vai trò' },
    { key: 'action:cai-dat.phan-quyen', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Cấp / thu hồi permission cho vai trò' },
    { key: 'action:cai-dat.reset-demo', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Đặt lại dữ liệu mẫu' }
  ];

  // ============================================================
  // 2) ROLE — vai trò, ĐỘNG: thêm/sửa/vô hiệu hoá được (không xoá
  //    cứng để tránh mất dấu vết, dùng cờ active).
  //    scope: 'all'    – không giới hạn chợ (chọn được ở thanh trên)
  //           'market' – giới hạn đúng 1 chợ (xem field market)
  //           'self'   – chỉ dữ liệu của chính tài khoản (tự phục vụ)
  //    selfService: true = hành vi tự phục vụ kiểu tiểu thương (ẩn bộ
  //    chọn "Chợ", mặc định vào thẳng mini-app) — hiện chỉ role 'trader'
  //    có cờ này (xem A.ACT['demo-account']/A.route() ở js/core.js).
  //    builtin: true = 1 trong 8 role gốc V1, không cho xoá.
  // ============================================================
  function defaultRoles() {
    // RBAC V1 — 8 role (RBAC_V1_SPEC.md mục 2). `scope`/`market` ở đây CHỈ còn là metadata mô
    // tả mặc định (theo quyết định kiến trúc: Account.marketScopes mới là nguồn enforce phạm vi
    // chợ thật sự, xem js/accounts.js) — không có đoạn code nào đọc field này để chặn dữ liệu.
    return [
      { id: 'system_admin', name: 'Quản trị hệ thống', desc: 'Quản lý tài khoản, vai trò, phân quyền, cấu hình dịch vụ, tích hợp, nhật ký kiểm toán', scope: 'all', market: null, selfService: false, builtin: true, active: true },
      { id: 'ward_leader', name: 'Lãnh đạo UBND phường', desc: 'Giám sát liên chợ, dashboard, tra cứu, báo cáo, chỉ đạo xử lý phản ánh vượt cấp', scope: 'all', market: null, selfService: false, builtin: true, active: true },
      { id: 'market_manager', name: 'Trưởng Ban Quản lý chợ', desc: 'Điều hành và phê duyệt nghiệp vụ trong phạm vi chợ được giao qua tài khoản (account.marketScopes)', scope: 'all', market: null, selfService: false, builtin: true, active: true },
      { id: 'market_staff', name: 'Nhân viên Ban Quản lý chợ', desc: 'Vận hành hằng ngày trong phạm vi chợ được giao qua tài khoản', scope: 'all', market: null, selfService: false, builtin: true, active: true },
      { id: 'accountant', name: 'Kế toán', desc: 'Tài chính, đối soát, công nợ trong phạm vi chợ được giao qua tài khoản', scope: 'all', market: null, selfService: false, builtin: true, active: true },
      { id: 'collector', name: 'Nhân viên thu phí', desc: 'Thu tiền, cập nhật thu/biên lai trong phạm vi chợ được giao qua tài khoản', scope: 'all', market: null, selfService: false, builtin: true, active: true },
      { id: 'technician', name: 'Nhân viên kỹ thuật', desc: 'Tiếp nhận và xử lý sự cố/kỹ thuật/bảo trì trong phạm vi chợ được giao qua tài khoản', scope: 'all', market: null, selfService: false, builtin: true, active: true },
      { id: 'trader', name: 'Tiểu thương', desc: 'Tự phục vụ qua mini app: xem, thanh toán, gửi phản ánh cho điểm kinh doanh của mình', scope: 'self', market: null, selfService: true, builtin: true, active: true }
    ];
  }

  // ============================================================
  // 3) ROLE_PERMISSION — bảng gán quyền, quan hệ nhiều-nhiều
  //    Role × Permission. Mỗi dòng = 1 lượt cấp quyền, có mốc thời
  //    gian/người cấp để phục vụ nhật ký kiểm toán.
  //
  //    DEFAULT SCREEN PERMISSION MATRIX V1 (Phase 3) — "role có được VÀO màn này không", KHÔNG
  //    quyết định được bấm nút gì bên trong (đó là actionRoles/Phase 4). Đây chỉ là SEED BAN ĐẦU:
  //    admin sửa được qua màn "Vai trò & phân quyền", không phải giá trị cố định trong code.
  //
  //    Một số screen còn chịu thêm Market Applicability (Phase 2, xem A.SCREEN_MARKET ở core.js)
  //    độc lập với bảng này — có screen permission KHÔNG có nghĩa luôn vào được nếu selectedMarket
  //    không applicable: 'phien-cho' chỉ applicable TTD; 'dien-nuoc' chỉ applicable CL.
  // ============================================================
  function defaultRolePermissions() {
    const screenRoles = {
      'tong-quan': ['system_admin', 'ward_leader'],
      'cau-truc': ['market_manager', 'market_staff'],
      'so-do': ['system_admin', 'ward_leader', 'market_manager', 'market_staff', 'accountant', 'collector', 'technician'],
      'diem-kd': ['system_admin', 'ward_leader', 'market_manager', 'market_staff', 'accountant', 'collector'],
      'phien-cho': ['ward_leader', 'market_manager', 'market_staff', 'collector'],
      'tieu-thuong': ['system_admin', 'ward_leader', 'market_manager', 'market_staff', 'accountant', 'collector'],
      'hop-dong': ['system_admin', 'ward_leader', 'market_manager', 'market_staff', 'accountant'],
      'dien-nuoc': ['market_manager', 'market_staff', 'accountant'],
      'phai-thu': ['ward_leader', 'market_manager', 'market_staff', 'accountant', 'collector'],
      'thu-tien': ['market_manager', 'accountant', 'collector'],
      'doi-soat': ['ward_leader', 'market_manager', 'accountant'],
      'cong-no': ['ward_leader', 'market_manager', 'market_staff', 'accountant', 'collector'],
      'su-co': ['ward_leader', 'market_manager', 'market_staff', 'technician'],
      'thong-bao': ['market_manager', 'market_staff'],
      'bao-cao': ['system_admin', 'ward_leader', 'market_manager', 'market_staff', 'accountant'],
      'tai-khoan': ['system_admin'],
      'cai-dat': ['system_admin'],
      'mini-app': ['trader']
    };
    // DEFAULT ACTION PERMISSION MATRIX V1 (Phase 4B) — bám sát đúng ma trận đã chốt trong yêu cầu
    // Phase 4B, áp dụng least-privilege: 'technician' không có action nào ở V1 (chỉ xem, chờ xác
    // nhận nghiệp vụ ở Phase 5); những ô còn NEED_CONFIRMATION (xem PHASE4_ACTION_AUDIT.md mục 9)
    // cố tình để trống, không tự cấp.
    const actionRoles = {
      'cau-truc.edit': ['market_manager', 'market_staff'],
      'cau-truc.delete': ['market_manager'],
      'cau-truc.reset': ['market_manager'],
      'so-do.xem-ho-so': ['ward_leader', 'market_manager', 'market_staff', 'accountant', 'collector'],
      'so-do.tao-hop-dong': ['market_manager', 'market_staff'],
      'so-do.doi-trang-thai': ['market_manager', 'market_staff'],
      'phien-cho.chot-phien': ['market_manager', 'market_staff'],
      'tieu-thuong.them-moi': ['market_manager', 'market_staff'],
      'hop-dong.tao': ['market_manager', 'market_staff'],
      'hop-dong.gia-han': ['market_manager', 'market_staff'],
      'hop-dong.thanh-ly': ['market_manager'],
      'dien-nuoc.ghi-chi-so': ['market_manager', 'market_staff'],
      'dien-nuoc.chot-ky': ['market_manager'],
      'dien-nuoc.yeu-cau-dieu-chinh': ['market_manager', 'market_staff'],
      'phai-thu.phat-hanh': ['market_manager', 'accountant'],
      'phai-thu.mien-giam': ['market_manager'],
      'thu-tien.thu': ['market_manager', 'accountant', 'collector'],
      'doi-soat.xem-ngan-hang': ['ward_leader', 'market_manager', 'accountant'],
      'doi-soat.gan-thu-cong': ['market_manager', 'accountant'],
      'doi-soat.xem-tien-mat': ['ward_leader', 'market_manager', 'accountant'],
      'doi-soat.xac-nhan-nop-quy': ['market_manager', 'accountant'],
      'doi-soat.xem-truy-vet': ['market_manager', 'accountant'],
      'cong-no.nhac-no': ['market_manager', 'market_staff', 'accountant'],
      'cong-no.nhac-no-hang-loat': ['market_manager', 'accountant'],
      'su-co.tao-phan-anh': ['market_manager', 'market_staff'],
      'su-co.phan-cong': ['market_manager'],
      // KHÔNG cấp cho 'technician' ở V1 — quyền hiện tại cho phép chuyển tới cả trạng thái "Đóng"
      // (cuối máy trạng thái), nên nếu cấp sẽ rộng hơn ý định "chỉ cập nhật tiến độ xử lý". Không
      // redesign máy trạng thái sự cố ở Phase 4B — chờ xác nhận nghiệp vụ (PHASE4_ACTION_AUDIT.md
      // mục 9 câu 9) trước khi cấp granular hơn.
      'su-co.chuyen-trang-thai': ['market_manager', 'market_staff'],
      'su-co.vuot-cap': ['market_manager'],
      'su-co.chi-dao': ['ward_leader'],
      'thong-bao.gui': ['market_manager'],
      'tai-khoan.tao-moi': ['system_admin'],
      'tai-khoan.sua': ['system_admin'],
      'tai-khoan.khoa-mo-khoa': ['system_admin'],
      'tai-khoan.gan-quyen': ['system_admin'],
      'cai-dat.gia-mat-bang': ['system_admin'],
      'cai-dat.gia-dien-nuoc': ['system_admin'],
      'cai-dat.dich-vu-khac': ['system_admin'],
      'cai-dat.ky-thu': ['system_admin'],
      'cai-dat.quy-tac-thu-phi': ['system_admin'],
      'cai-dat.vai-tro.tao': ['system_admin'],
      'cai-dat.vai-tro.sua': ['system_admin'],
      'cai-dat.vai-tro.khoa': ['system_admin'],
      'cai-dat.vai-tro.xoa': ['system_admin'],
      'cai-dat.phan-quyen': ['system_admin'],
      'cai-dat.reset-demo': ['system_admin']
    };
    const rows = [];
    const grant = (roleId, permKey) => rows.push({ roleId: roleId, permKey: permKey, grantedAt: 'seed', grantedBy: 'Hệ thống (seed mặc định)' });
    Object.keys(screenRoles).forEach(s => screenRoles[s].forEach(r => grant(r, 'screen:' + s)));
    Object.keys(actionRoles).forEach(a => actionRoles[a].forEach(r => grant(r, 'action:' + a)));
    return rows;
  }

  // ============================================================
  // 4) SCOPE — phạm vi dữ liệu. Gắn trực tiếp vào Role (field
  //    scope + market ở mục 2) thay vì tách bảng riêng, vì trong
  //    nghiệp vụ hiện tại "phạm vi" luôn là thuộc tính của TỪNG VAI
  //    TRÒ (đúng như cột "Phạm vi dữ liệu" trong bảng D.ROLES hiện
  //    có ở màn Cài đặt), không phải của từng lượt cấp quyền riêng
  //    lẻ. RolePermission ở mục 3 đã có sẵn khoá (roleId, permKey)
  //    nên nếu sau này cần "1 vai trò có phạm vi khác nhau theo
  //    từng quyền", có thể thêm field scope vào từng dòng đó mà
  //    không phá vỡ dữ liệu cũ.
  // ============================================================

  // PERM_SEED_VERSION: version RIÊNG của default role/permission seed — ĐỘC LẬP với A.RBAC_SCHEMA
  // dùng chung cho Account/UI ở core.js. Tăng số này mỗi khi defaultRoles()/defaultRolePermissions()
  // đổi đáng kể (như Phase 3: screenRoles từ seed tạm Phase 1 sang ma trận V1 chính thức), để
  // localStorage cũ CHỈ reseed đúng phần permission — KHÔNG kéo theo reset Account (đã tuỳ biến
  // qua màn Tài khoản người dùng) hay UI state (account/market đang chọn), vốn không liên quan gì
  // tới việc đổi ma trận quyền.
  //   v1 = Phase 1 (8 role, seed tạm — market_manager/ward_leader/trader kế thừa role cũ)
  //   v2 = Phase 3 (Default Screen Permission Matrix V1 chính thức cho cả 8 role)
  //   v3 = Phase 4B (Default Action Permission Matrix V1 chính thức — 45 action key, xem
  //        defaultRolePermissions() mục 3)
  // Phase 5B (audit only — KHÔNG đổi hành vi migration, KHÔNG bump version nào ở phase này, xem
  // PHASE5A_ACCOUNT_ROLE_SCOPE_AUDIT.md mục 12): khi 1 phase SAU NÀY thật sự cần thêm/bớt
  // permission key hoặc đổi actionRoles/screenRoles mặc định (bắt buộc bump PERM_SEED_VERSION),
  // cân nhắc merge thay vì reseed toàn bộ ở nhánh "seedVersion lệch" bên dưới — hiện tại nhánh đó
  // xoá sạch MỌI grant/revoke tuỳ biến của admin cho toàn bộ ma trận, kể cả các permKey không hề
  // đổi giữa 2 version. Gợi ý (KHÔNG áp dụng ở đây): giữ logic merge-permission-key-mới đã có sẵn
  // bên dưới (dòng ~295, hiện CHỈ chạy khi seedVersion khớp) và áp dụng luôn cho case seedVersion
  // lệch, chỉ full-reseed khi schemaVersion đổi (đổi SHAPE dữ liệu, không thể merge an toàn).
  const PERM_SEED_VERSION = 3;
  function freshState() { return { schemaVersion: A.RBAC_SCHEMA, seedVersion: PERM_SEED_VERSION, roles: defaultRoles(), rolePerms: defaultRolePermissions() }; }
  function loadState() {
    let s = null;
    try {
      const raw = localStorage.getItem(PKEY);
      if (raw) {
        const x = JSON.parse(raw);
        // RBAC V1 migration: dữ liệu đã lưu từ schema/seed cũ (role id cũ lanhdao/bql/tieuthuong,
        // HOẶC seedVersion cũ — vd. seed tạm Phase 1 vẫn còn 5 role trống quyền) không tương thích
        // với ma trận V1 hiện tại — bỏ hẳn phần permission, seed lại từ đầu thay vì cố merge, để
        // tránh vừa sót role id cũ vừa "nhìn như Phase 3 không hoạt động" vì vẫn giữ seed cũ.
        if (x && x.roles && x.rolePerms && x.schemaVersion === A.RBAC_SCHEMA && x.seedVersion === PERM_SEED_VERSION) s = x;
      }
    } catch (e) { /* bỏ qua */ }
    if (!s) {
      const fresh = freshState();
      // Hotfix persist migration: ghi NGAY state mới xuống đúng PKEY tại thời điểm reseed, không
      // chờ tới lượt grant/revoke/resetDefault đầu tiên — nếu không, localStorage tiếp tục giữ
      // payload cũ (seedVersion/schemaVersion không khớp) dù runtime đã đúng, và mỗi lần load lại
      // đều phải reseed lại từ đầu thay vì đọc thẳng bản đã chuẩn hoá. Ghi trực tiếp `fresh` —
      // KHÔNG gọi saveState()/đọc biến STATE ở đây vì loadState() đang chạy để TÍNH giá trị gán
      // cho `let STATE` bên dưới; STATE lúc này còn trong temporal dead zone, saveState() (đóng
      // qua STATE) sẽ ném lỗi nếu gọi tại đây.
      try { localStorage.setItem(PKEY, JSON.stringify(fresh)); } catch (e) { /* bỏ qua */ }
      return fresh;
    }
    // Tự bổ sung các permission MỚI được thêm ở các phiên bản sau (chưa từng có trong
    // dữ liệu đã lưu của trình duyệt) theo seed mặc định, không đụng vào các quyền
    // người dùng đã tự cấp/thu hồi cho những permission đã tồn tại từ trước.
    const known = new Set(s.rolePerms.map(r => r.permKey));
    defaultRolePermissions().forEach(d => { if (!known.has(d.permKey)) s.rolePerms.push(d); });
    return s;
  }
  let STATE = loadState();
  function saveState() { try { localStorage.setItem(PKEY, JSON.stringify(STATE)); } catch (e) { /* bỏ qua */ } }

  // ---------- API truy vấn/ghi (chưa được gọi ở đâu khác — dành cho Giai đoạn 2/3/5) ----------
  const PERM = A.PERM = {
    KEY: PKEY,
    CATALOG: CATALOG,
    catalog: () => CATALOG,
    permission: key => CATALOG.find(p => p.key === key),

    roles: () => STATE.roles,
    activeRoles: () => STATE.roles.filter(r => r.active),
    role: id => STATE.roles.find(r => r.id === id),

    rolePermKeys: roleId => STATE.rolePerms.filter(r => r.roleId === roleId).map(r => r.permKey),
    hasPerm: (roleId, permKey) => STATE.rolePerms.some(r => r.roleId === roleId && r.permKey === permKey),
    canScreen: (roleId, screenId) => PERM.hasPerm(roleId, 'screen:' + screenId),
    canAction: (roleId, actionKey) => PERM.hasPerm(roleId, 'action:' + actionKey),

    addRole: role => { STATE.roles.push(role); saveState(); },
    updateRole: (id, patch) => { const r = PERM.role(id); if (r) Object.assign(r, patch); saveState(); },
    setRoleActive: (id, active) => { const r = PERM.role(id); if (r) r.active = active; saveState(); },
    removeRole: id => {
      const r = PERM.role(id);
      if (!r || r.builtin) return false;
      STATE.roles = STATE.roles.filter(x => x.id !== id);
      STATE.rolePerms = STATE.rolePerms.filter(x => x.roleId !== id);
      saveState(); return true;
    },
    grant: (roleId, permKey, by) => {
      if (!PERM.hasPerm(roleId, permKey)) {
        STATE.rolePerms.push({ roleId: roleId, permKey: permKey, grantedAt: new Date().toISOString(), grantedBy: by || 'Không rõ' });
        saveState();
      }
    },
    revoke: (roleId, permKey) => {
      STATE.rolePerms = STATE.rolePerms.filter(r => !(r.roleId === roleId && r.permKey === permKey));
      saveState();
    },
    resetDefault: () => { STATE = freshState(); saveState(); }
  };
})(window.APP);
