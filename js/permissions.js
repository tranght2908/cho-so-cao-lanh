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
 * (chỉ có `screen:su-co`/`screen:mat-bang` [tên gọi từ Phase 7, trước đó là `screen:so-do`] — xem
 * được nhưng chưa thao tác được, chờ xác nhận nghiệp vụ ở Phase 5); nhiều mục khác còn
 * NEED_CONFIRMATION (xem PHASE4_ACTION_AUDIT.md mục 9) nên cố tình KHÔNG cấp mặc định cho tới khi
 * có xác nhận nghiệp vụ.
 */
(function (A) {
  'use strict';
  const PKEY = 'choso-caolanh-permissions';
  const RETIRED_ROLE_IDS = ['session_market_operator_demo'];

  // ============================================================
  // 1) PERMISSION — danh mục quyền (catalog). Tương đối tĩnh: chỉ
  //    thêm dòng mới khi có thêm màn hình/hành động mới trong app.
  //    kind: 'screen' = được vào 1 màn trong menu
  //          'action' = được làm 1 thao tác cụ thể bên trong 1 màn
  // ============================================================
  const CATALOG = [
    { key: 'screen:tong-quan', kind: 'screen', group: 'Điều hành', label: 'Tổng quan liên chợ' },
    // Phase 7 — chuẩn hóa RBAC theo UI đã gộp "Thiết lập mặt bằng chợ" + "Sơ đồ mặt bằng" thành 1
    // workspace (MARKET_LAYOUT_UX_HOTFIX_REPORT.md): 2 screen permission cũ 'cau-truc'/'so-do' gộp
    // thành DUY NHẤT 'mat-bang'. Xem MARKET_LAYOUT_SCREEN_PERMISSION_AUDIT.md +
    // MARKET_LAYOUT_SCREEN_PERMISSION_IMPLEMENTATION_REPORT.md. 6 action permKey bên dưới
    // (cau-truc.edit/.delete/.reset, so-do.xem-ho-so/.tao-hop-dong/.doi-trang-thai) GIỮ NGUYÊN —
    // chỉ đổi field screenId (metadata group UI) sang 'mat-bang'.
    { key: 'screen:mat-bang', kind: 'screen', group: 'Điều hành', label: 'Mặt bằng chợ' },
    { key: 'screen:tai-san', kind: 'screen', group: 'Điều hành', label: 'Tài sản chợ' },
    { key: 'screen:phien-cho', kind: 'screen', group: 'Điều hành', label: 'Phiên chợ quê' },
    { key: 'screen:diem-kd', kind: 'screen', group: 'Tiểu thương & hợp đồng', label: 'Điểm kinh doanh' },
    { key: 'screen:tieu-thuong', kind: 'screen', group: 'Tiểu thương & hợp đồng', label: 'Tiểu thương' },
    { key: 'screen:hop-dong', kind: 'screen', group: 'Tiểu thương & hợp đồng', label: 'Hợp đồng' },
    { key: 'screen:cau-hinh-gia', kind: 'screen', group: 'Tài chính / Quản lý khai báo', label: 'Chính sách thu và biểu phí' },
    { key: 'screen:tai-khoan-ngan-hang', kind: 'screen', group: 'Tài chính / Quản lý khai báo', label: 'Danh sách tài khoản ngân hàng' },
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

    { key: 'action:cau-truc.edit', kind: 'action', group: 'Điều hành', screenId: 'mat-bang', label: 'Thêm/sửa khối, tầng, khu, loại điểm; lưu nháp/chính thức' },
    { key: 'action:cau-truc.delete', kind: 'action', group: 'Điều hành', screenId: 'mat-bang', label: 'Xoá khối, tầng, khu, loại điểm' },
    { key: 'action:cau-truc.reset', kind: 'action', group: 'Điều hành', screenId: 'mat-bang', label: 'Khôi phục cấu trúc mặc định' },
    { key: 'action:so-do.xem-ho-so', kind: 'action', group: 'Điều hành', screenId: 'mat-bang', label: 'Xem hồ sơ tiểu thương từ sơ đồ mặt bằng' },
    { key: 'action:so-do.tao-hop-dong', kind: 'action', group: 'Điều hành', screenId: 'mat-bang', label: 'Tạo hợp đồng từ sơ đồ mặt bằng' },
    { key: 'action:so-do.doi-trang-thai', kind: 'action', group: 'Điều hành', screenId: 'mat-bang', label: 'Đổi trạng thái điểm kinh doanh' },
    // NEED_CONFIRMATION: ma trận quản lý tài sản V1 là seed prototype, vẫn có thể cấu hình động.
    { key: 'action:tai-san.create', kind: 'action', group: 'Điều hành', screenId: 'tai-san', label: 'Thêm tài sản chợ' },
    { key: 'action:tai-san.edit', kind: 'action', group: 'Điều hành', screenId: 'tai-san', label: 'Chỉnh sửa tài sản chợ' },
    { key: 'action:phien-cho.tao-phien', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Tạo phiên chợ quê' },
    { key: 'action:phien-cho.mo-dang-ky', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Mở đăng ký phiên chợ quê' },
    { key: 'action:phien-cho.chot-danh-sach', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Chốt danh sách đăng ký phiên chợ quê' },
    { key: 'action:phien-cho.quan-ly-dang-ky', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Quản lý đăng ký phiên chợ quê' },
    { key: 'action:phien-cho.diem-danh', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Điểm danh trước phiên chợ quê' },
    { key: 'action:phien-cho.dieu-phoi-du-bi', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Điều phối hộ dự bị thay thế' },
    { key: 'action:phien-cho.bat-dau-chuan-bi', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Bắt đầu chuẩn bị phiên chợ quê' },
    { key: 'action:phien-cho.bat-dau-phien', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Bắt đầu phiên chợ quê' },
    { key: 'action:phien-cho.cho-chot', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Chuyển phiên chợ quê sang chờ chốt' },
    { key: 'action:phien-cho.chot-phien', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Điểm danh & chốt phiên chợ quê' },
    { key: 'action:phien-cho.hoan-phien', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Tạm hoãn phiên chợ quê' },
    { key: 'action:phien-cho.huy-phien', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Hủy phiên chợ quê' },
    { key: 'action:phien-cho.xem-bao-cao', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Xem báo cáo phiên chợ quê' },
    { key: 'action:mini-app.stall-registration.create', kind: 'action', group: 'Dành cho tiểu thương', screenId: 'mini-app', label: 'Tiểu thương tự đăng ký quầy chợ quê trong mini app' },
    { key: 'action:tieu-thuong.them-moi', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'tieu-thuong', label: 'Thêm hồ sơ tiểu thương' },
    // TRADER_PROFILE_AND_MINIAPP_WORKFLOW — permKey "quản lý truy cập Mini App của tiểu thương".
    // CORRECTION (xem TRADER_PROFILE_MINIAPP_CORRECTION_REPORT.md): phạm vi ban đầu rộng hơn (xác
    // nhận hồ sơ đăng ký/liên kết Mini App từ luồng "tự đăng ký" đã bị loại bỏ) — permKey GIỮ
    // NGUYÊN id (an toàn cho migration, không phát sinh xoá/thêm permKey), chỉ còn dùng cho ĐÚNG 1
    // hành động thật: khoá/mở khoá truy cập tài khoản Mini App của 1 hồ sơ tiểu thương (Section E,
    // js/v-tieuthuong.js).
    { key: 'action:tieu-thuong.xac-minh', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'tieu-thuong', label: 'Khoá/mở khoá truy cập tài khoản Mini App của tiểu thương' },
    { key: 'action:hop-dong.tao', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'hop-dong', label: 'Tạo hợp đồng (từ màn Hợp đồng)' },
    { key: 'action:hop-dong.gia-han', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'hop-dong', label: 'Gia hạn hợp đồng' },
    { key: 'action:hop-dong.thanh-ly', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'hop-dong', label: 'Thanh lý hợp đồng' },
    { key: 'action:hop-dong.in', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'hop-dong', label: 'In hợp đồng giấy' },
    { key: 'action:hop-dong.cap-nhat-ban-ky', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'hop-dong', label: 'Cập nhật bản số hóa hợp đồng' },
    { key: 'action:hop-dong.cham-dut', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'hop-dong', label: 'Chấm dứt hợp đồng trước hạn' },
    { key: 'action:dien-nuoc.ghi-chi-so', kind: 'action', group: 'Tài chính', screenId: 'dien-nuoc', label: 'Nhập / lưu nháp chỉ số điện, nước' },
    { key: 'action:dien-nuoc.chot-ky', kind: 'action', group: 'Tài chính', screenId: 'dien-nuoc', label: 'Chốt kỳ ghi chỉ số điện, nước' },
    { key: 'action:dien-nuoc.yeu-cau-dieu-chinh', kind: 'action', group: 'Tài chính', screenId: 'dien-nuoc', label: 'Yêu cầu điều chỉnh chỉ số kỳ đã chốt' },
    { key: 'action:phai-thu.phat-hanh', kind: 'action', group: 'Tài chính', screenId: 'phai-thu', label: 'Phát hành khoản phải thu tự động' },
    { key: 'action:phai-thu.yeu-cau-dieu-chinh', kind: 'action', group: 'Tài chính', screenId: 'phai-thu', label: 'Gửi yêu cầu miễn giảm / điều chỉnh khoản phải thu' },
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
    { key: 'action:su-co.cap-nhat-xu-ly', kind: 'action', group: 'Vận hành', screenId: 'su-co', label: 'Kiểm tra và cập nhật xử lý sự cố' },
    { key: 'action:su-co.chuyen-trang-thai', kind: 'action', group: 'Vận hành', screenId: 'su-co', label: 'Chuyển trạng thái xử lý' },
    { key: 'action:su-co.vuot-cap', kind: 'action', group: 'Vận hành', screenId: 'su-co', label: 'Chuyển phản ánh vượt cấp lên phường' },
    { key: 'action:su-co.chi-dao', kind: 'action', group: 'Vận hành', screenId: 'su-co', label: 'Gửi ý kiến chỉ đạo (cho phản ánh đã vượt cấp)' },
    { key: 'action:thong-bao.gui', kind: 'action', group: 'Vận hành', screenId: 'thong-bao', label: 'Gửi thông báo đa kênh' },
    { key: 'action:tai-khoan.tao-moi', kind: 'action', group: 'Vận hành', screenId: 'tai-khoan', label: 'Thêm tài khoản người dùng' },
    { key: 'action:tai-khoan.sua', kind: 'action', group: 'Vận hành', screenId: 'tai-khoan', label: 'Sửa thông tin tài khoản' },
    { key: 'action:tai-khoan.khoa-mo-khoa', kind: 'action', group: 'Vận hành', screenId: 'tai-khoan', label: 'Khoá / mở khoá tài khoản' },
    { key: 'action:tai-khoan.gan-quyen', kind: 'action', group: 'Vận hành', screenId: 'tai-khoan', label: 'Gán vai trò / phạm vi chợ cho tài khoản' },
    { key: 'action:cau-hinh-gia.them-phi', kind: 'action', group: 'Tài chính', screenId: 'cau-hinh-gia', label: 'Thêm phí mới ở trạng thái chưa áp dụng' },
    { key: 'action:cau-hinh-gia.ap-dung-phi', kind: 'action', group: 'Tài chính', screenId: 'cau-hinh-gia', label: 'Áp dụng phí mới sau khi phí cũ đã khóa' },
    { key: 'action:cau-hinh-gia.khoa-mo-phi', kind: 'action', group: 'Tài chính', screenId: 'cau-hinh-gia', label: 'Khóa / mở khóa phí' },
    { key: 'action:tai-khoan-ngan-hang.quan-ly', kind: 'action', group: 'Tài chính', screenId: 'tai-khoan-ngan-hang', label: 'Thêm/sửa/xoá/đổi trạng thái tài khoản ngân hàng' },
    { key: 'action:cai-dat.ky-thu', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Cấu hình kỳ thu' },
    { key: 'action:cai-dat.quy-tac-thu-phi', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Cấu hình quy tắc thu phí' },
    { key: 'action:cai-dat.vai-tro.tao', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Tạo vai trò mới' },
    { key: 'action:cai-dat.vai-tro.sua', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Sửa thông tin vai trò' },
    { key: 'action:cai-dat.vai-tro.khoa', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Vô hiệu hoá / kích hoạt lại vai trò' },
    { key: 'action:cai-dat.vai-tro.xoa', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Xoá vai trò' },
    { key: 'action:cai-dat.phan-quyen', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Cấp / thu hồi permission cho vai trò' },
    { key: 'action:cai-dat.reset-demo', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Đặt lại dữ liệu mẫu' },

    // Phase 8 — nghiệp vụ "Tách điểm kinh doanh" (BUSINESS_POINT_SPLIT_WORKFLOW_IMPLEMENTATION_
    // REPORT.md), Chợ Cao Lãnh. 4 action permKey MỚI, screenId 'diem-kd' (cùng màn "Điểm kinh
    // doanh", tab "Yêu cầu thay đổi") — KHÔNG tái dùng 'cau-truc.edit' (đó là quyền sửa mặt bằng/
    // cấu trúc quy hoạch nói chung) vì đây là 1 QUY TRÌNH phê duyệt nhiều bước, nhiều vai trò khác
    // nhau ở từng bước (nhân viên lập/hoàn thiện, Trưởng BQL phê duyệt) — không thể diễn tả bằng 1
    // permKey duy nhất mà không cấp thừa quyền phê duyệt cho nhân viên. 'tiep-nhan' dùng chung cho
    // cả 2 việc "tiếp nhận yêu cầu tiểu thương" VÀ "hoàn thiện/sửa phương án" (luôn đi cùng nhau
    // trong 1 form ở UI — xem báo cáo) để không tăng số lượng permKey quá mức cần thiết.
    { key: 'action:diem-kd.tach-diem.lap-yeu-cau', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Lập yêu cầu tách điểm kinh doanh' },
    { key: 'action:diem-kd.tach-diem.tiep-nhan', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Tiếp nhận yêu cầu tiểu thương / hoàn thiện phương án tách điểm' },
    { key: 'action:diem-kd.tach-diem.gui-phe-duyet', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Gửi yêu cầu tách điểm cho Trưởng Ban Quản lý phê duyệt' },
    { key: 'action:diem-kd.tach-diem.phe-duyet', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Phê duyệt / từ chối yêu cầu tách điểm' },
    { key: 'action:diem-kd.tach-diem.thuc-hien', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Thực hiện tách điểm sau khi được phê duyệt' },
    // Supplement (source=MANAGER — "Trưởng BQL chủ động đề xuất"): permKey RIÊNG cho hành động "chủ
    // động đề xuất + giao nhân viên xử lý" — KHÁC với 'lap-yeu-cau' (nhân viên tự lập ĐỦ phương án
    // kỹ thuật ngay khi tạo). Cần tách riêng vì đây thực sự là 2 mutation khác nhau (tạo request với
    // `plan: null` + `assignedTo` bắt buộc, so với tạo request với `plan` đầy đủ ngay) — không phải
    // chỉ đổi label. Nhờ đó form "+ Lập yêu cầu tách điểm" tự chọn đúng loại form theo permission
    // (có 'tiep-nhan' → form đầy đủ; ngược lại có 'assign' → form đề xuất/giao việc) mà KHÔNG cần
    // if (ui.role === '...') ở bất kỳ đâu — xem js/v-tieuthuong.js.
    { key: 'action:diem-kd.tach-diem.assign', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Đề xuất tách điểm và giao nhân viên xử lý' }
    ,{ key: 'action:diem-kd.gop-diem.lap-yeu-cau', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Lập yêu cầu gộp điểm kinh doanh' }
    ,{ key: 'action:diem-kd.gop-diem.tiep-nhan', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Tiếp nhận và lập phương án gộp điểm' }
    ,{ key: 'action:diem-kd.gop-diem.gui-phe-duyet', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Gửi phương án gộp điểm phê duyệt' }
    ,{ key: 'action:diem-kd.gop-diem.phe-duyet', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Phê duyệt hoặc từ chối gộp điểm' }
    ,{ key: 'action:diem-kd.gop-diem.thuc-hien', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Thực hiện gộp điểm' }
    ,{ key: 'action:diem-kd.gop-diem.assign', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Đề xuất gộp điểm và giao nhân viên xử lý' }

    // Phase 9 — nghiệp vụ "Chuyển đổi vị trí điểm kinh doanh" (RELOCATE_TO_VACANT_POINT,
    // BUSINESS_POINT_RELOCATION_WORKFLOW_IMPLEMENTATION_REPORT.md), Chợ Cao Lãnh. 6 permKey MỚI,
    // cùng pattern least-privilege đã dùng cho tach-diem/gop-diem ở trên — KHÔNG tái dùng permKey
    // của 2 nghiệp vụ đó (đây là 1 quy trình phê duyệt riêng, dù dùng chung state machine/collection).
    ,{ key: 'action:diem-kd.chuyen-doi.lap-yeu-cau', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Lập yêu cầu chuyển đổi vị trí điểm kinh doanh' }
    ,{ key: 'action:diem-kd.chuyen-doi.tiep-nhan', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Tiếp nhận yêu cầu tiểu thương / lập phương án chuyển đổi vị trí' }
    ,{ key: 'action:diem-kd.chuyen-doi.gui-phe-duyet', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Gửi phương án chuyển đổi vị trí cho Trưởng Ban Quản lý phê duyệt' }
    ,{ key: 'action:diem-kd.chuyen-doi.phe-duyet', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Phê duyệt hoặc từ chối chuyển đổi vị trí' }
    ,{ key: 'action:diem-kd.chuyen-doi.thuc-hien', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Thực hiện chuyển đổi vị trí sau khi được phê duyệt' }
    ,{ key: 'action:diem-kd.chuyen-doi.assign', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'diem-kd', label: 'Đề xuất chuyển đổi vị trí và giao nhân viên xử lý' }
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
  //    không applicable: 'phien-cho' chỉ applicable TTD; 'dien-nuoc' applicable cả CL/TTD khi có
  //    quầy cố định cần ghi chỉ số.
  // ============================================================
  function defaultRolePermissions() {
    const screenRoles = {
      'tong-quan': ['system_admin', 'ward_leader'],
      // Phase 7: 'cau-truc' + 'so-do' gộp thành 'mat-bang' — default = hợp (OR) của 2 ma trận cũ,
      // đúng bằng tập cũ của 'so-do' (vì 'cau-truc' vốn là tập con). state cũ đã lưu (không rơi vào
      // fresh state này) được xử lý bằng migration tường minh trong mergeIntoCurrentSeed() bên dưới,
      // KHÔNG dùng ma trận này để ghi đè tuỳ biến đã có.
      'mat-bang': ['system_admin', 'ward_leader', 'market_manager', 'market_staff', 'accountant', 'collector', 'technician'],
      // NEED_CONFIRMATION: nhóm được xem tài sản là giả định prototype V1.
      'tai-san': ['ward_leader', 'market_manager', 'market_staff', 'technician'],
      'diem-kd': ['system_admin', 'ward_leader', 'market_manager', 'market_staff', 'accountant', 'collector'],
      'phien-cho': ['ward_leader', 'market_manager', 'market_staff', 'collector'],
      'tieu-thuong': ['system_admin', 'ward_leader', 'market_manager', 'market_staff', 'accountant', 'collector'],
      'hop-dong': ['system_admin', 'ward_leader', 'market_manager', 'market_staff', 'accountant'],
      'cau-hinh-gia': ['system_admin', 'market_manager', 'accountant', 'ward_leader'],
      // Cùng bộ role xem với 'cau-hinh-gia' — màn liền kề trong cùng nhóm con 'Quản lý khai báo'.
      // Các role vận hành/tự phục vụ (market_staff, collector, technician, trader) KHÔNG có trong
      // yêu cầu gốc ("các vai trò khác chỉ xem" không nêu rõ vai trò nào) — đã xác nhận với người
      // yêu cầu trước khi implement, không tự suy đoán.
      'tai-khoan-ngan-hang': ['system_admin', 'market_manager', 'accountant', 'ward_leader'],
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
      'mini-app': ['trader', 'collector']
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
      // NEED_CONFIRMATION: chỉ BQL được thêm/sửa trong prototype; các role khác chỉ xem.
      'tai-san.create': ['market_manager'],
      'tai-san.edit': ['market_manager'],
      'phien-cho.tao-phien': ['market_manager'],
      'phien-cho.mo-dang-ky': ['market_manager'],
      'phien-cho.chot-danh-sach': ['market_manager'],
      'phien-cho.quan-ly-dang-ky': ['market_manager'],
      'phien-cho.diem-danh': ['market_staff'],
      'phien-cho.dieu-phoi-du-bi': ['market_staff'],
      'phien-cho.bat-dau-chuan-bi': ['market_staff'],
      'phien-cho.bat-dau-phien': ['market_staff'],
      'phien-cho.cho-chot': ['market_staff'],
      'phien-cho.chot-phien': ['market_staff'],
      'phien-cho.hoan-phien': ['market_manager'],
      'phien-cho.huy-phien': ['market_manager'],
      'phien-cho.xem-bao-cao': ['ward_leader', 'market_manager', 'market_staff', 'collector'],
      'mini-app.stall-registration.create': ['trader'],
      'tieu-thuong.them-moi': ['market_manager', 'market_staff'],
      // NEED_CONFIRMATION (báo cáo mục 41): chưa xác nhận "ai ngoài market_staff được quyền xác
      // minh" — mặc định AN TOÀN dùng đúng ma trận của 'tieu-thuong.them-moi' (cùng nhóm người quản
      // lý hồ sơ tiểu thương hiện tại), không tự thêm role nào khác.
      'tieu-thuong.xac-minh': ['market_manager', 'market_staff'],
      'hop-dong.tao': ['market_manager', 'market_staff'],
      'hop-dong.gia-han': ['market_manager', 'market_staff'],
      'hop-dong.thanh-ly': ['market_manager'],
      'hop-dong.in': ['market_manager', 'market_staff'],
      'hop-dong.cap-nhat-ban-ky': ['market_manager', 'market_staff'],
      'hop-dong.cham-dut': ['market_manager'],
      'dien-nuoc.ghi-chi-so': ['market_manager', 'market_staff'],
      'dien-nuoc.chot-ky': ['market_manager'],
      'dien-nuoc.yeu-cau-dieu-chinh': ['market_manager', 'market_staff'],
      'phai-thu.phat-hanh': ['market_manager', 'accountant'],
      'phai-thu.yeu-cau-dieu-chinh': ['market_staff'],
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
      'su-co.cap-nhat-xu-ly': ['market_manager', 'market_staff', 'technician'],
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
      // Chính sách nghiệp vụ biểu phí: trưởng ban quản lý chợ thêm phí / áp dụng / khóa-mở khóa
      // trong phạm vi Account.marketScopes + selectedMarket. system_admin không tự có toàn bộ quyền
      // nghiệp vụ biểu phí.
      'cau-hinh-gia.them-phi': ['market_manager'],
      'cau-hinh-gia.ap-dung-phi': ['market_manager'],
      'cau-hinh-gia.khoa-mo-phi': ['market_manager'],
      // Thêm/sửa/xoá/đổi trạng thái tài khoản ngân hàng: chỉ Quản trị hệ thống (yêu cầu gốc, không
      // có sắc thái khác nhau giữa 4 hành động nên dùng 1 action key duy nhất).
      'tai-khoan-ngan-hang.quan-ly': ['system_admin'],
      'cai-dat.ky-thu': ['system_admin'],
      'cai-dat.quy-tac-thu-phi': ['system_admin'],
      'cai-dat.vai-tro.tao': ['system_admin'],
      'cai-dat.vai-tro.sua': ['system_admin'],
      'cai-dat.vai-tro.khoa': ['system_admin'],
      'cai-dat.vai-tro.xoa': ['system_admin'],
      'cai-dat.phan-quyen': ['system_admin'],
      'cai-dat.reset-demo': ['system_admin'],

      // Phase 8 — "Tách điểm kinh doanh": market_manager có cả 'lap-yeu-cau' (mục 10 yêu cầu:
      // "market_manager: ... lập yêu cầu nếu cần") lẫn 'phe-duyet' (2 permKey riêng biệt — cùng 1
      // account/role có cả 2 quyền không có nghĩa 2 bước phê duyệt gộp làm 1: UI/handler vẫn bắt
      // đi qua đúng 2 action rời nhau, xem 'dkreq-submit'/'dkreq-approve' trong báo cáo).
      // market_staff CHỈ có 3 quyền vận hành đầu (lập/tiếp nhận/gửi phê duyệt) — KHÔNG có 'phe-duyet'
      // (least-privilege, đúng "KHÔNG phê duyệt" mục 10). 'thuc-hien' cấp cho cả 2 role — cùng phạm
      // vi thao tác mặt bằng thật với 'cau-truc.edit' đã cấp sẵn cho cả market_manager/market_staff.
      'diem-kd.tach-diem.lap-yeu-cau': ['market_manager', 'market_staff'],
      'diem-kd.tach-diem.tiep-nhan': ['market_staff'],
      'diem-kd.tach-diem.gui-phe-duyet': ['market_manager', 'market_staff'],
      'diem-kd.tach-diem.phe-duyet': ['market_manager'],
      'diem-kd.tach-diem.thuc-hien': ['market_manager', 'market_staff'],
      // Supplement — chỉ market_manager (đúng mục 12 yêu cầu bổ sung: "Trưởng BQL: có thể chủ động
      // đề xuất; giao xử lý"). market_manager VẪN giữ 'lap-yeu-cau' ở trên (không revoke — tránh
      // migration ép buộc trên permKey đã tồn tại, mục 17 yêu cầu bổ sung: "ưu tiên thay đổi nhỏ
      // nhất"); UI quyết định form nào hiển thị bằng cách ưu tiên kiểm tra 'tiep-nhan' (có thể tự lập
      // phương án kỹ thuật → form đầy đủ) trước 'assign' (chỉ có thể đề xuất/giao việc → form nhẹ),
      // xem dksr-open ở js/v-tieuthuong.js — market_manager mặc định không có 'tiep-nhan' nên luôn
      // rơi vào nhánh form đề xuất/giao việc dù vẫn còn 'lap-yeu-cau'.
      'diem-kd.tach-diem.assign': ['market_manager']
      ,'diem-kd.gop-diem.lap-yeu-cau': ['market_manager', 'market_staff']
      ,'diem-kd.gop-diem.tiep-nhan': ['market_staff']
      ,'diem-kd.gop-diem.gui-phe-duyet': ['market_manager', 'market_staff']
      ,'diem-kd.gop-diem.phe-duyet': ['market_manager']
      ,'diem-kd.gop-diem.thuc-hien': ['market_manager', 'market_staff']
      ,'diem-kd.gop-diem.assign': ['market_manager']
      // Phase 9 — "Chuyển đổi vị trí điểm kinh doanh": cùng ma trận least-privilege với tach-diem/
      // gop-diem (market_staff vận hành, market_manager phê duyệt + có thể tự đề xuất/giao việc).
      ,'diem-kd.chuyen-doi.lap-yeu-cau': ['market_manager', 'market_staff']
      ,'diem-kd.chuyen-doi.tiep-nhan': ['market_staff']
      ,'diem-kd.chuyen-doi.gui-phe-duyet': ['market_manager', 'market_staff']
      ,'diem-kd.chuyen-doi.phe-duyet': ['market_manager']
      ,'diem-kd.chuyen-doi.thuc-hien': ['market_manager', 'market_staff']
      ,'diem-kd.chuyen-doi.assign': ['market_manager']
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
  //   v4 = Phase 6 STEP A (màn biểu phí tách khỏi Cài đặt sang Tài chính — thêm
  //        screen:cau-hinh-gia + 3 action:cau-hinh-gia.*, xoá 3 action:cai-dat.gia-* cũ. Xem
  //        SERVICE_PRICING_SCREEN_AUDIT.md mục 11/12.)
  //   v5 = Phase 7 (chuẩn hóa RBAC theo UI đã gộp "Thiết lập mặt bằng chợ" + "Sơ đồ mặt bằng":
  //        xoá screen:cau-truc + screen:so-do, thêm screen:mat-bang DUY NHẤT. KHÔNG đổi 6 action
  //        permKey cau-truc.*/so-do.* — chỉ đổi field screenId metadata sang 'mat-bang' để group UI.
  //        Migration screen:mat-bang = OR(screen:so-do, screen:cau-truc) tính từ STORED STATE THỰC
  //        TẾ của từng role — xử lý TƯỜNG MINH trong mergeIntoCurrentSeed(), KHÔNG dùng default
  //        matrix mới để suy ra. Xem MARKET_LAYOUT_SCREEN_PERMISSION_AUDIT.md +
  //        MARKET_LAYOUT_SCREEN_PERMISSION_IMPLEMENTATION_REPORT.md.)
  //   v6/v7 đã phát triển song song trên 2 nhánh:
  //        upstream: chính sách thu/biểu phí + tài khoản ngân hàng;
  //        PC3: lifecycle/registration/attendance phiên chợ quê.
  //   v9 = merge tổng hợp: giữ seed hiện tại và dùng marker theo từng feature để state upstream-only
  //        hoặc PC3-only đều được migrate đủ, không suy luận chỉ từ seedVersion tuyến tính.
  //   v13 = giữ các phần ngoài PC3 đã có ở nhánh local: khoản phải thu yêu cầu điều chỉnh và
  //        mini-app.stall-registration.create. Phiên chợ quê dùng action key PC3 từ bản pull.
  //        Bao gồm cả PC3C-B: action điều phối hộ dự bị thay hộ chính thức vắng mặt.
  //   v14 = vòng đời biểu phí theo nghiệp vụ mới: thêm phí ở trạng thái draft, khóa/mở khóa,
  //        áp dụng phí mới sau khi phí cũ cùng phạm vi đã khóa; cấp mặc định chỉ cho market_manager.
  const PERM_SEED_VERSION = 14;
  const RATE_POLICY_PERM_VERSION = 1;
  const BANK_ACCOUNT_PERM_VERSION = 1;
  const PC3A_SESSION_PERM_VERSION = 1;
  const PC3B_REGISTRATION_PERM_VERSION = 1;
  const PC3C_ATTENDANCE_PERM_VERSION = 1;
  const PC3C_REPLACEMENT_PERM_VERSION = 1;
  const FEE_LIFECYCLE_PERM_VERSION = 1;
  function freshState() {
    return {
      schemaVersion: A.RBAC_SCHEMA,
      seedVersion: PERM_SEED_VERSION,
      ratePolicyPermVersion: RATE_POLICY_PERM_VERSION,
      bankAccountPermVersion: BANK_ACCOUNT_PERM_VERSION,
      pc3aSessionPermVersion: PC3A_SESSION_PERM_VERSION,
      pc3bRegistrationPermVersion: PC3B_REGISTRATION_PERM_VERSION,
      pc3cAttendancePermVersion: PC3C_ATTENDANCE_PERM_VERSION,
      pc3cReplacementPermVersion: PC3C_REPLACEMENT_PERM_VERSION,
      feeLifecyclePermVersion: FEE_LIFECYCLE_PERM_VERSION,
      roles: defaultRoles(),
      rolePerms: defaultRolePermissions()
    };
  }
  function migrateFeeLifecyclePerms(stored) {
    if (stored.feeLifecyclePermVersion >= FEE_LIFECYCLE_PERM_VERSION) return false;
    const legacyKeys = new Set([
      'action:cau-hinh-gia.mat-bang',
      'action:cau-hinh-gia.dien-nuoc',
      'action:cau-hinh-gia.dich-vu-khac'
    ]);
    const lifecycleKeys = [
      'action:cau-hinh-gia.them-phi',
      'action:cau-hinh-gia.ap-dung-phi',
      'action:cau-hinh-gia.khoa-mo-phi'
    ];
    stored.rolePerms = stored.rolePerms.filter(r => legacyKeys.has(r.permKey) === false && lifecycleKeys.indexOf(r.permKey) === -1);
    lifecycleKeys.forEach(permKey => {
      stored.rolePerms.push({ roleId: 'market_manager', permKey: permKey, grantedAt: 'migrate-fee-lifecycle', grantedBy: 'Hệ thống' });
    });
    stored.feeLifecyclePermVersion = FEE_LIFECYCLE_PERM_VERSION;
    return true;
  }
  function migrateRatePolicyPerms(stored) {
    if (stored.ratePolicyPermVersion >= RATE_POLICY_PERM_VERSION) return false;
    if (!stored.rolePerms.some(r => r.roleId === 'system_admin' && r.permKey === 'screen:cau-hinh-gia')) {
      stored.rolePerms.push({ roleId: 'system_admin', permKey: 'screen:cau-hinh-gia', grantedAt: 'migrate-rate-policy', grantedBy: 'Hệ thống' });
    }
    stored.ratePolicyPermVersion = RATE_POLICY_PERM_VERSION;
    return true;
  }
  function migrateBankAccountPerms(stored) {
    if (stored.bankAccountPermVersion >= BANK_ACCOUNT_PERM_VERSION) return false;
    const bankKeys = new Set(['screen:tai-khoan-ngan-hang', 'action:tai-khoan-ngan-hang.quan-ly']);
    const known = new Set(stored.rolePerms.map(r => r.permKey));
    defaultRolePermissions().filter(r => bankKeys.has(r.permKey)).forEach(r => {
      if (!known.has(r.permKey)) stored.rolePerms.push(r);
    });
    stored.bankAccountPermVersion = BANK_ACCOUNT_PERM_VERSION;
    return true;
  }
  function migratePc3aSessionPerms(stored) {
    if (stored.pc3aSessionPermVersion >= PC3A_SESSION_PERM_VERSION) return false;
    const knownKeys = new Set(stored.rolePerms.map(r => r.permKey));
    const sessionDefaults = defaultRolePermissions().filter(r => r.permKey.indexOf('action:phien-cho.') === 0);
    sessionDefaults.forEach(r => {
      if (r.permKey === 'action:phien-cho.chot-phien') return;
      if (!knownKeys.has(r.permKey)) stored.rolePerms.push(r);
    });
    stored.pc3aSessionPermVersion = PC3A_SESSION_PERM_VERSION;
    return true;
  }
  function migratePc3bRegistrationPerms(stored) {
    if (stored.pc3bRegistrationPermVersion >= PC3B_REGISTRATION_PERM_VERSION) return false;
    const key = 'action:phien-cho.quan-ly-dang-ky';
    const hasAny = stored.rolePerms.some(r => r.permKey === key);
    if (!hasAny) {
      defaultRolePermissions().filter(r => r.permKey === key).forEach(r => stored.rolePerms.push(r));
    }
    stored.pc3bRegistrationPermVersion = PC3B_REGISTRATION_PERM_VERSION;
    return true;
  }
  function migratePc3cAttendancePerms(stored) {
    if (stored.pc3cAttendancePermVersion >= PC3C_ATTENDANCE_PERM_VERSION) return false;
    const key = 'action:phien-cho.diem-danh';
    const hasAny = stored.rolePerms.some(r => r.permKey === key);
    if (!hasAny) {
      defaultRolePermissions().filter(r => r.permKey === key).forEach(r => stored.rolePerms.push(r));
    }
    stored.pc3cAttendancePermVersion = PC3C_ATTENDANCE_PERM_VERSION;
    return true;
  }
  function migratePc3cReplacementPerms(stored) {
    if (stored.pc3cReplacementPermVersion >= PC3C_REPLACEMENT_PERM_VERSION) return false;
    const key = 'action:phien-cho.dieu-phoi-du-bi';
    const hasAny = stored.rolePerms.some(r => r.permKey === key);
    if (!hasAny) {
      defaultRolePermissions().filter(r => r.permKey === key).forEach(r => stored.rolePerms.push(r));
    }
    stored.pc3cReplacementPermVersion = PC3C_REPLACEMENT_PERM_VERSION;
    return true;
  }
  // Merge state đã lưu (shape còn đúng — schemaVersion khớp) vào seed hiện tại, THAY VÌ reseed toàn
  // bộ, để không xoá mất grant/revoke tuỳ biến của admin cho các permKey KHÔNG đổi giữa 2 bản seed
  // (Phase 6 STEP A — trước đây mỗi lần bump PERM_SEED_VERSION đều xoá sạch toàn bộ tuỳ biến, xem
  // ghi chú lịch sử trong SERVICE_PRICING_SCREEN_AUDIT.md mục 12 / PHASE5A...md mục 12):
  //   1) Role nào có trong defaultRoles() mà chưa có trong `stored.roles` (theo id) → thêm mới;
  //      role đã tồn tại giữ NGUYÊN mọi field đã lưu (kể cả name/desc/active đã tuỳ biến).
  //   2) permKey nào KHÔNG còn trong CATALOG hiện tại (bị gỡ khỏi seed lần này, vd 3
  //      action:cai-dat.gia-*) → xoá khỏi rolePerms của MỌI role — hành động đã mất ý nghĩa, không
  //      được để tồn tại song song với permKey mới.
  //   3) permKey nào HOÀN TOÀN MỚI (không còn dòng nào trong rolePerms sau bước 2) → thêm đúng
  //      grant mặc định theo defaultRolePermissions() hiện tại.
  //   4) permKey đã tồn tại VÀ vẫn còn trong CATALOG → giữ NGUYÊN, không đụng tới (kể cả khi default
  //      matrix của permKey đó đổi giữa 2 bản seed — 1 thay đổi default cho permKey đã tồn tại từ
  //      trước, nếu thật sự cần ép lại, phải là 1 thao tác migrate TƯỜNG MINH riêng, không phải hệ
  //      quả ngầm của việc bump version).
  // Phase 7 migration riêng — gộp screen:so-do + screen:cau-truc thành screen:mat-bang. PHẢI chạy
  // TRƯỚC bước filter/add-default chung bên dưới (đọc rolePerms lúc 2 permKey cũ CÒN NGUYÊN), và
  // PHẢI tính cho MỌI role hiện có trong stored.roles (builtin lẫn custom, KHÔNG hard-code danh
  // sách id) dựa trên STORED STATE THỰC TẾ — không phải default matrix mới (MARKET_LAYOUT_
  // SCREEN_PERMISSION_AUDIT.md mục 10). Đặt cờ `stored.matBangMigratedV5` để 2 vòng "tự bổ sung
  // permKey hoàn toàn mới theo default" (bước cuối hàm này VÀ vòng tương ứng trong loadState())
  // không được coi 'screen:mat-bang' là permKey mới rồi tự cấp lại theo default matrix — kể cả khi
  // kết quả OR-migration là KHÔNG role nào giữ được quyền này (0 dòng rolePerms cho permKey đó vẫn
  // phải được hiểu là "đã xử lý", không phải "chưa từng thấy").
  function migrateMatBangScreen(stored) {
    const hadLegacyKeys = stored.rolePerms.some(r => r.permKey === 'screen:so-do' || r.permKey === 'screen:cau-truc');
    if (!hadLegacyKeys) return;
    const matBangRoleIds = [];
    stored.roles.forEach(r => {
      const oldSoDo = stored.rolePerms.some(x => x.roleId === r.id && x.permKey === 'screen:so-do');
      const oldCauTruc = stored.rolePerms.some(x => x.roleId === r.id && x.permKey === 'screen:cau-truc');
      if (oldSoDo || oldCauTruc) matBangRoleIds.push(r.id);
    });
    stored.rolePerms = stored.rolePerms.filter(r => r.permKey !== 'screen:so-do' && r.permKey !== 'screen:cau-truc');
    matBangRoleIds.forEach(roleId => {
      stored.rolePerms.push({ roleId: roleId, permKey: 'screen:mat-bang', grantedAt: 'migrate-v5', grantedBy: 'Hệ thống (migrate screen:so-do/screen:cau-truc → screen:mat-bang)' });
    });
    stored.matBangMigratedV5 = true;
  }
  function mergeIntoCurrentSeed(stored) {
    stored.roles = stored.roles.filter(r => RETIRED_ROLE_IDS.indexOf(r.id) === -1);
    stored.rolePerms = stored.rolePerms.filter(r => RETIRED_ROLE_IDS.indexOf(r.roleId) === -1);
    const roleIds = new Set(stored.roles.map(r => r.id));
    defaultRoles().forEach(r => { if (!roleIds.has(r.id)) stored.roles.push(r); });
    migrateMatBangScreen(stored);
    migrateRatePolicyPerms(stored);
    migrateBankAccountPerms(stored);
    migrateFeeLifecyclePerms(stored);
    const validKeys = new Set(CATALOG.map(p => p.key));
    stored.rolePerms = stored.rolePerms.filter(r => validKeys.has(r.permKey));
    const knownKeys = new Set(stored.rolePerms.map(r => r.permKey));
    defaultRolePermissions().forEach(d => {
      if (stored.matBangMigratedV5 && d.permKey === 'screen:mat-bang') return;
      if (stored.pc3aSessionPermVersion >= PC3A_SESSION_PERM_VERSION && d.permKey.indexOf('action:phien-cho.') === 0) return;
      if (!knownKeys.has(d.permKey)) stored.rolePerms.push(d);
    });
    migratePc3aSessionPerms(stored);
    migratePc3bRegistrationPerms(stored);
    migratePc3cAttendancePerms(stored);
    migratePc3cReplacementPerms(stored);
    stored.seedVersion = PERM_SEED_VERSION;
    return stored;
  }
  function loadState() {
    let s = null;
    let needSave = false;
    try {
      const raw = localStorage.getItem(PKEY);
      if (raw) {
        const x = JSON.parse(raw);
        // RBAC V1 migration: dữ liệu đã lưu từ schema cũ (role id cũ lanhdao/bql/tieuthuong — đổi
        // SHAPE, không thể merge an toàn) vẫn bị bỏ hẳn, seed lại từ đầu như trước. Nhưng nếu
        // schemaVersion khớp (shape hợp lệ, chỉ seedVersion lệch — tức NỘI DUNG ma trận đổi), từ
        // Phase 6 STEP A chuyển sang MERGE thay vì reseed toàn bộ (xem mergeIntoCurrentSeed ở trên).
        if (x && x.roles && x.rolePerms && x.schemaVersion === A.RBAC_SCHEMA) {
          if (x.seedVersion === PERM_SEED_VERSION) { s = x; }
          else { s = mergeIntoCurrentSeed(x); needSave = true; }
        }
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
    // người dùng đã tự cấp/thu hồi cho những permission đã tồn tại từ trước. (Đã chạy trong
    // mergeIntoCurrentSeed() ở nhánh seedVersion lệch — chạy lại ở đây vô hại/idempotent, và vẫn
    // cần cho nhánh seedVersion khớp thẳng để bắt trường hợp CATALOG đổi mà quên bump version.)
    const known = new Set(s.rolePerms.map(r => r.permKey));
    defaultRolePermissions().forEach(d => {
      if (s.matBangMigratedV5 && d.permKey === 'screen:mat-bang') return;
      if (s.pc3aSessionPermVersion >= PC3A_SESSION_PERM_VERSION && d.permKey.indexOf('action:phien-cho.') === 0) return;
      if (!known.has(d.permKey)) s.rolePerms.push(d);
    });
    if (migratePc3aSessionPerms(s)) needSave = true;
    if (migratePc3bRegistrationPerms(s)) needSave = true;
    if (migratePc3cAttendancePerms(s)) needSave = true;
    if (migratePc3cReplacementPerms(s)) needSave = true;
    if (migrateRatePolicyPerms(s)) needSave = true;
    if (migrateBankAccountPerms(s)) needSave = true;
    if (migrateFeeLifecyclePerms(s)) needSave = true;
    {
      const validKeys = new Set(CATALOG.map(p => p.key));
      const before = s.rolePerms.length;
      s.rolePerms = s.rolePerms.filter(r => validKeys.has(r.permKey));
      if (s.rolePerms.length !== before) needSave = true;
    }
    // Cùng lý do Hotfix persist migration ở trên: ghi lại NGAY nếu vừa merge (seedVersion đổi),
    // không chờ tới lượt grant/revoke đầu tiên — STATE vẫn đang TDZ nên không gọi saveState().
    if (needSave) { try { localStorage.setItem(PKEY, JSON.stringify(s)); } catch (e) { /* bỏ qua */ } }
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
