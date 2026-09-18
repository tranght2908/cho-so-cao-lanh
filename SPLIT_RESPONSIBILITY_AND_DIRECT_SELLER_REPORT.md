# Split responsibility and direct seller report

## 1. Audit trước sửa

- Working tree đã có thay đổi chưa commit tại `data.js`, `js/accounts.js`, `js/core.js`, `js/mini.js`, `js/permissions.js`, `js/v-dieuhanh.js`, `js/v-tieuthuong.js`, `styles.css` và hai report Tách điểm trước đó. Không reset/revert bất cứ phần nào.
- `A.db.pointRequests`, `A.pointReq`, Mini App/Web dùng chung state, CL-only scope, duplicate-active protection, `resultPointIds`, floorplan ids và logic thực thi tách đều đã có.
- `assignedTo` đã tồn tại nhưng trước phase này chỉ mang tính hiển thị: một nhân viên khác cùng permission còn có thể lập/gửi/thực hiện thay.
- Quan hệ người bán cũ là `stall.sellerId`; không có trạng thái, xác minh hoặc lịch sử.

## 2. File thay đổi trong phase

- `data.js`: version 10, thêm `directSellerAssignments` và seed tương thích từ `sellerId`.
- `js/v-tieuthuong.js`: ownership request, filter context, block trách nhiệm, quản lý người trực tiếp kinh doanh và lịch sử.
- `js/mini.js`: trường dự kiến người trực tiếp kinh doanh, tùy chọn.

## 3. Semantics cuối cùng của `assignedTo`

- TRADER tạo: `assignedTo: null`, `DRAFT`; action **Tiếp nhận xử lý** mới gán account hiện tại, ghi timeline `received`, chuyển `STAFF_REVIEW`.
- STAFF tạo: `createdBy` và `assignedTo` đều là account lập yêu cầu.
- MANAGER tạo: bắt buộc chọn nhân viên CL hợp lệ; `assignedTo` là nhân viên được giao.
- Sau khi đã được gán, `assignedTo` không còn bị thay đổi khi lập phương án, gửi duyệt, phê duyệt hoặc thực hiện.
- Handler `dkreq-plan-open/save`, `dkreq-submit` và `dkreq-execute` đều re-check `assignedTo === activeAccount.id`, bên cạnh `A.canDo(...)` và trạng thái nghiệp vụ.

## 4. Visibility và action ownership

Người có screen permission/scope CL vẫn xem được ở **Tất cả**. Chỉ người phụ trách được thao tác bước nhân viên; manager vẫn phê duyệt theo permission. Bộ lọc context là **Việc của tôi**, **Chờ tiếp nhận**, **Chờ phê duyệt**, **Tất cả**, chỉ render các context phù hợp permission.

Bảng và request drawer dùng nhãn **Người phụ trách**. Drawer có block tên, vai trò, lúc tiếp nhận và trạng thái trách nhiệm; timeline vẫn thể hiện người tiếp nhận/lập phương án/phê duyệt/thực hiện.

## 5. Model người trực tiếp kinh doanh

`A.db.directSellerAssignments[]` lưu `pointId`, person/trader reference nếu có, thông tin người, quan hệ, thời hạn, `PENDING_VERIFICATION|ACTIVE|ENDED`, nguồn, xác minh, ghi chú và timestamps. Một point chỉ có một `ACTIVE`: lúc xác minh người mới, ACTIVE cũ chuyển `ENDED` với `endDate`; record không bị xóa.

`sellerId` cũ được giữ tương thích cho các màn ngoài phạm vi, nhưng assignment ACTIVE là nguồn ưu tiên trong màn Điểm kinh doanh. Drawer tách rõ **Chủ thể hợp đồng** và **Người trực tiếp kinh doanh**, có form bổ sung/thay đổi, xác minh và lịch sử. Drawer tiểu thương hiển thị vai trò theo từng điểm.

## 6. Sau Tách điểm

Không có người bán nào được tự tạo ACTIVE. Nếu không có đề xuất, child points hiển thị **Chưa đăng ký**. Nếu Mini App có tên dự kiến, tên đó được copy thành `PENDING_VERIFICATION` cho các child points và phải xác minh thủ công trước khi ACTIVE. Thiếu dữ liệu này không chặn `COMPLETED`.

## 7. Kiểm tra

- `node --check data.js`, `js/accounts.js`, `js/core.js`, `js/mini.js`, `js/permissions.js`, `js/v-dieuhanh.js`, `js/v-tieuthuong.js`: PASS.
- `git diff --check`: PASS.
- Node seed inspection: PASS; version 10 có 4 requests mẫu, `YC-0017` là TRADER/DRAFT/unassigned và collection direct seller có bản ghi ACTIVE seed.

## 8. Browser regression

| Test | Kết quả |
| --- | --- |
| A–D: ownership TRADER/STAFF/MANAGER và nhân viên khác chỉ xem | PASS theo handler/UI static regression |
| E–G: chủ thể khác người bán; pending → active; đổi người giữ history | PASS theo handler/UI static regression |
| H–I: child không fabricate seller; proposed chỉ pending | PASS theo execution static regression |
| Thao tác browser/console thực tế | NOT RUN |

Không có browser executable, Playwright/Puppeteer hoặc test runner trong working tree để tự động mở prototype; cần chạy manual browser regression trước khi demo/phát hành.

## 9. Limitation / NEED_CONFIRMATION

- V1 giữ một người trực tiếp kinh doanh ACTIVE cho mỗi điểm.
- Mini App chỉ thu một tên dự kiến, không yêu cầu mã điểm con chưa được tạo; do đó proposal được copy dạng pending cho các child points để BQL xác minh/chọn lại.
- Không có backend, auth, upload hay notification subsystem mới.
