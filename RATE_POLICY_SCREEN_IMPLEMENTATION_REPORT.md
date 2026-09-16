# RATE_POLICY_SCREEN_IMPLEMENTATION_REPORT

## Phạm vi

Đổi màn `cau-hinh-gia` thành **Chính sách thu và biểu phí**, đặt tại **Tài chính → Quản lý khai báo**, giữ 3 tab hiện có: Đơn giá mặt bằng / Điện & nước / Dịch vụ khác. Không thay đổi thuật toán lập khoản phải thu, không thêm backend/API/database.

## Thay đổi đã thực hiện

- Sidebar dùng đúng cấu trúc nhãn nhóm con hiện hữu: `Quản lý khai báo → Chính sách thu và biểu phí`; các màn tài chính vận hành nằm dưới nhóm con riêng `Nghiệp vụ tài chính`.
- Giữ screen ID `cau-hinh-gia`, ba action key hiện hữu và market applicability `BOTH`; không tạo hệ permission song song.
- Giữ cơ chế chọn chợ toàn cục. Danh sách, form và handler tiếp tục dựa trên `Account.marketScopes`, `selectedMarket`, `A.canDo(action, targetMarket)` và trạng thái bản ghi.
- Bổ sung trên từng dòng biểu phí: `marketModel`, `collectionCycle`, mức giá/đơn vị, `taxClass`, ngày hiệu lực/kết thúc hiệu lực, căn cứ pháp lý và `waiverTypeId`.
- Hai enum thuế được lưu tường minh: `TAXABLE_REVENUE` và `PASS_THROUGH_NON_TAX`; không suy luận từ tab hoặc đơn vị tính.
- Dữ liệu mẫu biểu phí và danh mục miễn giảm tối giản được đặt trong `data.js`. `js/serviceconfig.js` lấy seed từ đó và tiếp tục dùng localStorage hiện hữu cho thao tác demo; không tạo storage mới.
- Dữ liệu localStorage cũ được normalize khi đọc để bổ sung field mới mà không xóa bản ghi cũ.
- Khi lưu một bản ghi đang `active`, handler tạo bản ghi mới, gắn `previousVersionId`, đặt ngày hiệu lực mới; bản ghi cũ chuyển sang `expired` và được giữ nguyên để tra cứu. Bản ghi `expired` là read-only.
- Bổ sung kiểm tra handler cho enum, market đích, market scope, loại miễn giảm và permission trước khi mutation.

## RBAC và migration

Không phát sinh screen permission hoặc action permission mới.

- `screen:cau-hinh-gia`: mặc định cho `system_admin`, `market_manager`, `accountant`, `ward_leader` xem.
- `action:cau-hinh-gia.mat-bang`, `action:cau-hinh-gia.dien-nuoc`, `action:cau-hinh-gia.dich-vu-khac`: mặc định chỉ `system_admin`.
- `PERM_SEED_VERSION` tăng từ 5 lên 6.
- Migration v6 thu hồi ba action biểu phí khỏi mọi role khác và cấp cho `system_admin`; các permission không liên quan và dữ liệu Account/UI/business không bị reset.
- Authorization không kiểm tra trực tiếp `ui.role`; UI và mutation handler đều đọc permission động qua `A.canDo()`.

## Cấu trúc dữ liệu mới

- `marketModel`: `FIXED_MONTHLY | MARKET_SESSION`.
- `collectionCycle`: `MONTH | SESSION | DAY`.
- `taxClass`: `TAXABLE_REVENUE | PASS_THROUGH_NON_TAX`.
- `waiverTypeId`: nullable reference tới `WAIVER_TYPES`.
- `effectiveFrom`, `effectiveTo`, `status: active | inactive | expired`.
- `previousVersionId`: liên kết phiên bản trước khi một bản ghi active được thay thế.
- Điện/nước giữ cấu trúc cũ `elecPrice`/`waterPrice`, bổ sung `elecUnit`/`waterUnit` để không phá model hiện có.

## File thay đổi

- `data.js`: thêm enum, danh mục loại miễn giảm tối giản và seed biểu phí đầy đủ.
- `js/core.js`: đổi nhãn menu và thêm hai nhóm con trong Tài chính.
- `js/permissions.js`: đổi nhãn catalog, cập nhật default grants và migration permission seed v6.
- `js/serviceconfig.js`: lấy seed từ `data.js`, normalize dữ liệu cũ, hỗ trợ tạo phiên bản mới và trạng thái hết hiệu lực.
- `js/v-vanhanh.js`: mở rộng bảng/form/drawer, giữ chọn chợ, bổ sung field mới, dual-gate permission/market và luồng version hóa.
- `RATE_POLICY_SCREEN_IMPLEMENTATION_REPORT.md`: báo cáo này.

## Kiểm tra

- IntelliJ inspections: không phát hiện JavaScript error trong các file sửa.
- `node --check` chạy qua terminal tích hợp IntelliJ cho 5 file JavaScript: PASS.
- Smoke test `createVersion()`: bản cũ chuyển `expired`, bản mới tăng collection và giữ `previousVersionId`: PASS.
- Smoke test migration permission v5 → v6: ba action chỉ còn ở `system_admin`, screen permission của admin được bổ sung: PASS.
- Không chạy git commit.

## Điểm còn để ngỏ

- Chưa có UI quản trị riêng cho danh mục **Loại miễn giảm**; hiện chỉ có seed tối giản và trường tham chiếu trên dòng phí.
- Biểu phí vẫn chưa được nối vào engine lập khoản phải thu hiện đang dùng các hằng số cũ trong `data.js`; đây là chủ đích để không đụng module Tài chính khác trong task này.
- Bản ghi legacy `extraServices.marketId === 'ALL'` vẫn chỉ xem; không tự suy đoán hoặc tự tách sang từng chợ.
