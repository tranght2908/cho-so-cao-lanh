# BANK_ACCOUNT_SCREEN_IMPLEMENTATION_REPORT

## Phạm vi

Thêm màn **Danh sách tài khoản ngân hàng** — screen id `tai-khoan-ngan-hang` — dưới nhóm con **Quản lý
khai báo** trong Tài chính, ngang hàng với `cau-hinh-gia` (Chính sách thu và biểu phí). Là danh sách tài
khoản ngân hàng của Ban Quản lý chợ dùng nhận tiền qua QR/chuyển khoản từ tiểu thương, phục vụ đối soát
giao dịch. FE prototype — không implement backend/API/database/auth.

Hai điểm nghiệp vụ chưa rõ trong yêu cầu gốc đã được xác nhận với người yêu cầu **trước khi implement**
(không tự suy đoán):
1. Tài khoản ngân hàng **tách theo từng chợ** (marketId CL/TTD), màn hình lọc theo `ui.market` topbar —
   giống mọi màn Tài chính khác, dù entity gợi ý trong yêu cầu gốc không có field chợ.
2. Vai trò được **xem (read-only)** ngoài Quản trị hệ thống: đúng bằng bộ role hiện đang xem
   `screen:cau-hinh-gia` — `market_manager`, `accountant`, `ward_leader`. Các role vận hành/tự phục vụ
   (`market_staff`, `collector`, `technician`, `trader`) không có quyền xem màn này.

## Thay đổi đã thực hiện

- Thêm mục menu "Danh sách tài khoản ngân hàng" vào sidebar, dưới nhóm con "Quản lý khai báo", ngay sau
  "Chính sách thu và biểu phí".
- Màn danh sách: thanh công cụ (tìm theo tên chủ tài khoản, dropdown "Chọn trạng thái", "Xuất excel",
  "+ Thêm mới"); bảng có checkbox chọn dòng, STT, Số tài khoản (sắp xếp được), Tên chủ tài khoản (sắp xếp
  được), Ngân hàng, Ghi chú, Tài khoản thu tiền (✓), Trạng thái, Sửa/Xoá; phân trang 15 dòng/trang.
  "Xuất excel" xuất các dòng đang tick chọn, hoặc toàn bộ danh sách đang lọc nếu không tick dòng nào.
- Modal Thêm mới/Sửa: Ngân hàng* (dropdown từ danh mục `D.BANKS`), Tên chủ tài khoản* (tự UPPERCASE, bỏ
  dấu tiếng Việt ngay khi nhập), Số tài khoản* (chỉ giữ ký tự số, unique toàn hệ thống — không phân biệt
  chợ), checkbox "Là tài khoản thu tiền" (nhiều tài khoản được tick cùng lúc), Ghi chú, Trạng thái (mặc
  định Hoạt động; chọn "Ngừng hoạt động" tự bỏ tick và khoá checkbox "thu tiền" ngay trong modal), checkbox
  "Lưu và thêm tiếp" (chỉ khi thêm mới — lưu xong mở lại modal trống, giữ đúng chợ đang chọn), nút Hủy
  bỏ/Lưu.
- Validate & business rule, thực thi ở TẦNG DỮ LIỆU (`js/bankaccounts.js`), không chỉ ở form:
  - Số tài khoản unique toàn hệ thống (kiểm tra xuyên cả 2 chợ khi tạo/sửa).
  - "Ngừng hoạt động" không thể là tài khoản thu tiền — ép `isCollectionAccount=false` ngay trong
    `add()`/`update()`/`setStatus()`, không chỉ disable checkbox trên UI.
  - Không xoá cứng tài khoản đã có giao dịch tham chiếu (`hasTransactions`) — `remove()` từ chối, handler
    "Xoá" tự chuyển sang hiển thị xác nhận "Chuyển Ngừng hoạt động" thay thế.
  - Mọi lượt Thêm/Sửa/Xoá/đổi trạng thái được ghi vào nhật ký chung (`U.log`) — hiển thị ở tab "Nhật ký
    kiểm toán" hiện có, không tạo hệ audit log riêng.

## RBAC và migration

Phát sinh **1 screen permission mới + 1 action permission mới** (đã xác nhận với người yêu cầu trước khi
implement, theo đúng yêu cầu "không được tự suy đoán role" của đề bài):

- `screen:tai-khoan-ngan-hang` — mặc định `system_admin`, `market_manager`, `accountant`, `ward_leader`
  xem. Giống hệt bộ role của `screen:cau-hinh-gia` (màn liền kề, cùng nhóm con).
- `action:tai-khoan-ngan-hang.quan-ly` — mặc định chỉ `system_admin` (Thêm/Sửa/Xoá/đổi trạng thái không
  có sắc thái khác nhau giữa 4 hành động theo yêu cầu gốc nên dùng 1 action key duy nhất, không tách 4
  action riêng như `tai-khoan.*`).
- `PERM_SEED_VERSION` tăng từ 6 lên 7. Không cần migration tường minh rewrite/thu hồi permKey khác — 2
  permKey trên hoàn toàn mới, được thêm tự động bởi đúng bước "tự bổ sung permKey mới theo default" đã có
  sẵn ở cuối `mergeIntoCurrentSeed()`/`loadState()` trong `js/permissions.js`. Đã kiểm chứng bằng smoke
  test giả lập state v6 có sẵn tuỳ biến thủ công (xem mục Kiểm tra) — tuỳ biến đó giữ nguyên sau merge.
- Authorization không kiểm tra `ui.role` trực tiếp ở bất kỳ đâu trong code mới. UI (ẩn nút) và mutation
  handler (`ba-new`/`ba-edit`/`ba-form-save`/`ba-del`/`ba-del-ok`/`ba-deactivate-ok`) đều tự gọi lại
  `A.canDo('tai-khoan-ngan-hang.quan-ly', targetMarket)` — không chỉ dựa vào nút đã ẩn. `targetMarket`
  dùng đúng `marketId` của BẢN GHI đang thao tác (không phải `ui.market`) khi sửa/xoá bản ghi đã tồn tại,
  cùng nguyên tắc với `cfgPriceMutateAllowed()` ở màn Chính sách thu và biểu phí — 1 handler bị ép đổi
  `ui.market` giữa lúc thao tác không thể lách qua bản ghi thuộc chợ khác. Đã có smoke test gọi trực tiếp
  handler `ba-form-save` (bỏ qua UI) với vai trò `collector` để xác nhận mutation bị chặn ngay ở tầng
  handler, không chỉ vì nút bị ẩn.
- Không tạo hệ thống permission song song; không coi vào được màn hình = được phép thao tác (đã kiểm
  chứng: `market_manager` xem được màn nhưng nút Thêm/Sửa/Xoá bị ẩn VÀ `A.canDo()` trả `false` khi gọi
  thẳng); không bỏ qua `marketScopes`/`selectedMarket`; không tự cấp `system_admin` quyền nghiệp vụ nào
  ngoài đúng 1 action key mới.

## Cấu trúc dữ liệu mới

- File mới `js/bankaccounts.js` — module `A.BANK_ACCOUNTS`, độc lập với `BANK_BY_MARKET` (data.js, chỉ
  phục vụ demo Đối soát). Lưu `localStorage['choso-caolanh-bankaccounts']`.
- `BankAccount { id, marketId: 'CL'|'TTD', bankCode, bankName, accountHolderName, accountNumber (unique
  toàn hệ thống), isCollectionAccount: boolean, note, status: 'active'|'inactive', hasTransactions:
  boolean, createdBy, createdAt, updatedBy, updatedAt }`. So với entity gợi ý trong yêu cầu gốc: thêm
  `marketId` (mục 1 phần Phạm vi) và `hasTransactions` (cờ mô phỏng "đã có giao dịch tham chiếu" để minh
  hoạ ràng buộc không xoá cứng — không có engine đối soát thật nào set cờ này, chỉ 2 bản ghi seed demo).
- `D.BANKS` (data.js) — danh mục 10 ngân hàng phổ biến (mã + tên) cho dropdown "Ngân hàng", chỉ phục vụ
  hiển thị/lọc, không kết nối cổng thanh toán thật.
- `D.BANK_ACCOUNT_SEED` (data.js) — 4 bản ghi demo: 2 chợ × 1 tài khoản thu tiền chính + 1 tài khoản phụ;
  1 tài khoản mỗi chợ được đánh dấu `hasTransactions:true` để minh hoạ luồng không xoá cứng.

## File thay đổi

- `data.js`: thêm `BANKS`, `BANK_ACCOUNT_SEED`, export 2 hằng số này.
- `js/core.js`: thêm mục menu `tai-khoan-ngan-hang` vào nhóm Tài chính / Quản lý khai báo.
- `js/permissions.js`: thêm 1 screen + 1 action vào CATALOG, thêm default grants vào `screenRoles`/
  `actionRoles`, tăng `PERM_SEED_VERSION` 6→7.
- `js/bankaccounts.js` (mới): module dữ liệu `A.BANK_ACCOUNTS`.
- `js/v-vanhanh.js`: thêm `A.VIEWS['tai-khoan-ngan-hang']`, modal Thêm mới/Sửa, toàn bộ handler (lọc, tìm
  kiếm, sắp xếp, chọn dòng, xuất Excel, Thêm/Sửa/Xoá/chuyển trạng thái), khởi tạo `ui.bankAcc`/`ui.baSel`.
- `index.html`: thêm `<script src="js/bankaccounts.js">` (nạp sau `accounts.js`, trước `serviceconfig.js`).
- `BANK_ACCOUNT_SCREEN_IMPLEMENTATION_REPORT.md`: báo cáo này.

## Kiểm tra

- `node --check` PASS cho toàn bộ 5 file JavaScript đã sửa/thêm.
- Smoke test Playwright (Chromium headless) chạy trực tiếp trên `index.html`, đóng vai từng account demo
  qua `currentDemoAccountId` + `A.syncAccountContext()` (không mock permission engine):
  - `system_admin`: vào được màn, thấy đúng 2 tài khoản chợ Cao Lãnh / 2 tài khoản chợ quê TTĐ sau khi
    đổi `ui.market`; thêm mới tài khoản → tên tự UPPERCASE bỏ dấu, số tài khoản tự lọc chỉ còn số; thêm
    trùng số tài khoản đã tồn tại → bị chặn, modal giữ mở, đúng thông báo lỗi; sửa tài khoản đang là tài
    khoản thu tiền sang "Ngừng hoạt động" → checkbox "thu tiền" tự bỏ tick và bị khoá ngay trong modal;
    xoá tài khoản có `hasTransactions:true` → bị chặn xoá cứng, chuyển sang "Ngừng hoạt động" thành công
    và tự tắt cờ thu tiền; xoá tài khoản không có giao dịch tham chiếu → xoá cứng thành công.
  - `market_manager` (Trưởng BQL chợ Cao Lãnh): vào được màn (đúng "chỉ xem"), nút Thêm/Sửa/Xoá bị ẩn,
    gọi trực tiếp `A.canDo('tai-khoan-ngan-hang.quan-ly', ...)` trả `false`.
  - `collector` (Nhân viên thu phí): `U.can('tai-khoan-ngan-hang')` trả `false`, menu không hiện mục này,
    gõ thẳng route bị router tự điều hướng ra khỏi màn (không vào được dù gõ trực tiếp); gọi trực tiếp
    handler `ba-form-save` (bỏ qua UI, giả lập forge) — số bản ghi không đổi, xác nhận handler tự chặn.
  - Migration v6→v7: giả lập `localStorage` có sẵn state v6 (bao gồm 1 grant TUỲ BIẾN thủ công không
    thuộc default matrix nào) → tải lại trang → `seedVersion` lên 7, grant tuỳ biến giữ nguyên, grant
    không liên quan khác giữ nguyên, 2 permKey mới xuất hiện với đúng default grants đã xác nhận, `A.PERM`
    API trả kết quả khớp.
  - Không còn lỗi console/pageerror nào phát sinh từ code mới (đã sửa 1 lỗi DOM re-entrancy tự phát hiện
    trong quá trình test — xem mục Điểm còn để ngỏ).
  - Không chạy git commit.

## Điểm còn để ngỏ

- Đã phát hiện và tự sửa trong quá trình implement (không phải yêu cầu riêng): `baRows()` ban đầu dùng
  `U.inM()` để lọc theo chợ — hàm này so field `market`, còn bản ghi cấu hình (giống `stallPrices` ở
  `serviceconfig.js`) dùng field `marketId`, nên lọc sai (0 dòng). Đã sửa lại so trực tiếp `marketId`.
- 3 handler thay đổi hiển thị NGAY trong modal (chuẩn hoá chữ hoa, khoá checkbox) không gọi `A.render()`
  (hàm này chỉ vẽ lại `#nav`/`#view`, không vẽ lại modal) và cũng không vẽ lại toàn modal bằng cách gán
  lại `innerHTML` của `#modal-root` từ trong chính handler 'change' của 1 phần tử con — cách này từng ném
  lỗi DOM "node to be removed is no longer a child" khi test. Đã đổi sang sửa trực tiếp đúng phần tử DOM
  liên quan (`el.value`, hoặc `checked`/`disabled` của checkbox khác) — an toàn và nhất quán hơn.
- Chưa nối "tài khoản thu tiền" vào luồng hiển thị QR/thông tin chuyển khoản ở Mini app tiểu thương (ngoài
  phạm vi yêu cầu gốc — màn này chỉ là danh mục quản trị cho Ban Quản lý chợ, không đổi `js/mini.js`).
- `hasTransactions` chỉ là cờ mô phỏng gán sẵn ở 2 bản ghi seed để minh hoạ ràng buộc không xoá cứng;
  không có engine đối soát thật nào tự set cờ này khi có giao dịch — nhất quán với việc "Đối soát" hiện
  tại dùng nguồn dữ liệu `BANK_BY_MARKET` riêng, không đọc từ `A.BANK_ACCOUNTS` (ngoài phạm vi yêu cầu).
