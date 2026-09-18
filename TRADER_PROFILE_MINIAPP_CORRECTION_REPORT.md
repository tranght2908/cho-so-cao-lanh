# Báo cáo điều chỉnh: Hồ sơ tiểu thương + Mini App (correction pass)

> Điều chỉnh lại flow đã implement sai ở báo cáo trước
> (`TRADER_PROFILE_AND_MINIAPP_WORKFLOW_IMPLEMENTATION_REPORT.md`, nay đã lỗi thời).

## 1. Business flow cũ (sai, đã loại bỏ)

Mini App cho phép tiểu thương **tự đăng ký hồ sơ mới**: nhập CCCD + thông tin kinh
doanh + upload hồ sơ → tạo `Trader Profile` với `profileStatus: PENDING_VERIFICATION,
source: MINI_APP` → NV BQL xác minh/duyệt trên Web (tab "Chờ xác minh") → có thể yêu
cầu bổ sung (`NEEDS_SUPPLEMENT`) hoặc match với hồ sơ đã có (`miniLinkRequests`,
`PENDING_LINK`, popup "Liên kết với TTxxxx").

## 2. Business flow mới (đúng, hiện tại)

1. NV BQL tạo Trader Profile trước, trên Web BQL (Tiểu thương → + Thêm tiểu thương).
   Hợp đồng/điểm kinh doanh xử lý riêng, sau đó.
2. Trader mở Mini App → nhập **số điện thoại đã đăng ký với BQL** → hệ thống tra
   theo SĐT trong `A.db.traders` (không lọc theo chợ).
3. Không tìm thấy → báo "chưa được đăng ký", **không tạo gì cả**.
4. Tìm thấy đúng 1 hồ sơ → xác nhận tên/mã hồ sơ/chợ → gửi mã OTP giả lập (`123456`).
5. Nhập đúng OTP → **find-or-create** Trader Account (`Account.traderId` trỏ về
   Trader Profile có sẵn) → vào Mini App.
6. Tìm thấy > 1 hồ sơ cùng SĐT → chặn, yêu cầu liên hệ BQL (không tự chọn, không tạo).

## 3. Files changed

- `data.js` — bỏ seed `PENDING_VERIFICATION`/`miniLinkRequests` demo cho flow cũ; bump `VERSION` 12→13.
- `js/permissions.js` — thu hẹp mô tả permKey `action:tieu-thuong.xac-minh` (giữ nguyên id) về đúng 1 hành động: khoá/mở khoá truy cập Mini App.
- `js/v-tieuthuong.js` — bỏ tab "Chờ xác minh", `ttVerifyQueue`, 2 popup xác minh/liên kết; viết lại Section E (Mini App) theo trạng thái mới; giữ nguyên wizard tạo hồ sơ thủ công, OCR mock, duplicate guard.
- `js/mini.js` — bỏ toàn bộ wizard đăng ký 6 bước + màn bổ sung hồ sơ + `PENDING_LINK`; viết lại màn đăng nhập theo SĐT + OTP; tách `miniResetRequestState()` khỏi `miniResetLoginFlow()`.
- `js/accounts.js`, `js/core.js` — không sửa (đã có sẵn `traderId`, `ensureMiniAppDemoLink()` từ lượt trước, vẫn đúng với flow mới).

## 4. Những implementation cũ được giữ

Danh sách hồ sơ tiểu thương, "+ Thêm tiểu thương" (manual, OCR CCCD giả lập, 4 nhóm hồ sơ số hóa), duplicate CCCD/SĐT guard khi NV BQL nhập, `profileStatus` (ACTIVE/NEEDS_SUPPLEMENT/INACTIVE), trader detail UI, quan hệ điểm KD/hợp đồng/công nợ (chỉ đọc), phần tài khoản Mini App trong hồ sơ, ẩn/che SĐT, `marketScopes`, permission guard `A.canDo`, tài khoản trader vẫn ẩn khỏi bảng account nội bộ mặc định.

## 5. Những phần đã loại khỏi UX

Đăng ký hồ sơ (wizard 6 bước) trên Mini App; nhập CCCD/hồ sơ kinh doanh để tạo profile từ Mini App; upload hồ sơ xin tạo profile; tab "Chờ xác minh" + `PENDING_VERIFICATION` phát sinh từ Mini App; popup BQL xác nhận tạo hồ sơ; `PENDING_LINK`/"Liên kết với TTxxxx"; màn bổ sung hồ sơ (`NEEDS_SUPPLEMENT` từ Mini App) + gửi lại.

## 6. Manual Trader creation (NV BQL)

Không đổi so với trước: `+ Thêm tiểu thương` → nhập tay hoặc OCR mock → duplicate check (CCCD trùng = chặn, SĐT trùng = cảnh báo + checkbox xác nhận) → tạo `Trader Profile`, **không tự tạo Account/Contract/BusinessPoint**.

## 7. Phone lookup

`miniFindTradersByPhone(phone)` chuẩn hoá số (bỏ ký tự không phải số) rồi quét toàn bộ `A.db.traders` (cả 2 chợ). 0 kết quả → "Không tìm thấy hồ sơ tiểu thương". >1 kết quả → "Không thể xác định hồ sơ duy nhất, vui lòng liên hệ BQL" (không auto-pick).

## 8. OTP mock

Mã cố định `123456`, không gửi SMS thật, có hint trên UI. Sai mã không chặn thử lại (demo).

## 9. Account linking/reuse

`ttCreateLinkedAccount(trader, phone)` (đổi tên gọi từ `js/mini.js` qua `A.createLinkedTraderAccount`): kiểm tra `A.ACCOUNTS.byTraderId(trader.id)` trước — có thì tái sử dụng, không có thì tạo `AC-TTxx` mới với `traderId` trỏ về hồ sơ. Không bao giờ tạo trùng.

## 10. Mini App status mapping

`NOT_LINKED → "Chưa kích hoạt"`, `LINKED → "Đã kích hoạt"`, `LOCKED → "Đã khóa"` — giữ nguyên tên trạng thái nội bộ, chỉ đổi nhãn hiển thị (backward compatible, không migrate schema).

## 11. Account management behavior

Không đổi: tài khoản trader (`role: 'trader'`) vẫn bị lọc khỏi bảng quản lý tài khoản nội bộ mặc định, nhưng vẫn tồn tại trong `A.ACCOUNTS`; quản lý qua Hồ sơ tiểu thương → Tài khoản Mini App (khoá/mở khoá).

## 12. Regression results

TEST1-15 (theo yêu cầu) đều PASS: tạo hồ sơ thủ công; duplicate CCCD guard; trader mới = "Chưa kích hoạt"; không tự tạo account khi tạo trader; tra cứu SĐT có hồ sơ PASS; SĐT lạ → không tạo gì; OTP mock PASS; trader chưa có account → OTP tạo/liên kết account; trader đã có account → tái sử dụng, không tạo trùng; Section E hiển thị đúng; Account Management ẩn trader khỏi bảng nội bộ nhưng AC-TTxx vẫn tồn tại; tài khoản Mini App có sẵn (CASE1, AC-TT01) đăng nhập/tính năng cũ không vỡ; quan hệ điểm KD/hợp đồng/công nợ đọc đúng. Ngoài ra đã test thêm: tài khoản bị khoá chặn đăng nhập đúng màn `screenLoginLocked`; nhiều hồ sơ trùng SĐT → chặn đúng màn `screenLoginMulti`; menu SPLIT/MERGE/CONVERT trên Mini App và Web vẫn hiển thị/hoạt động bình thường.

## 13. node --check

`node --check` PASS trên tất cả file đã sửa: `data.js`, `js/core.js`, `js/permissions.js`, `js/accounts.js`, `js/v-tieuthuong.js`, `js/mini.js`.

## 14. Browser console

Không có lỗi console (uncaught) trong toàn bộ chuỗi test ở mục 12, kiểm tra bằng `read_console_messages` (onlyErrors) sau mỗi bước.

## 15. Known limitations

- Đây vẫn là prototype FE-only: OTP, SMS, tra cứu SĐT đều là mock, không có backend thật.
- `miniLinkRequests` được giữ lại như mảng rỗng trong `data.js`/`A.db` để tránh vỡ runtime nếu còn chỗ đọc, nhưng không còn được seed hay dùng bởi flow mới.
- Đổi số điện thoại của hồ sơ sau khi Mini App đã kích hoạt chỉ được xử lý ở mức "an toàn cho prototype" (đăng nhập lần sau dùng SĐT mới trong hồ sơ, tài khoản liên kết theo `traderId` không đổi) — không có flow khôi phục/migrate identifier phức tạp.

## 16. NEED_CONFIRMATION

- Trader Profile do BQL tạo có `ACTIVE` ngay hay còn trạng thái hồ sơ trung gian khác?
- Có bắt buộc phải có hợp đồng/điểm kinh doanh trước khi được kích hoạt Mini App không?
- Một Trader Profile được phép có nhiều số điện thoại đăng nhập không?
- Khi BQL đổi SĐT sau khi account đã kích hoạt, account login identifier nên xử lý thế nào (đồng bộ ngay hay giữ SĐT cũ)?
- Khi tài khoản Mini App bị khoá, ai có quyền mở lại (chỉ market_manager, hay cả market_staff)?
