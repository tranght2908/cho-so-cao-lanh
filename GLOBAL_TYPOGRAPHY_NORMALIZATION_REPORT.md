# GLOBAL TYPOGRAPHY NORMALIZATION — Báo cáo

> Task UI/CSS thuần tuý: chuẩn hóa cỡ chữ toàn hệ thống theo 1 typography scale nhỏ và nhất quán. **Không** đụng tới Dynamic RBAC, permission, role, account, marketScopes, selectedMarket, route, business logic, handler, dữ liệu, localStorage schema, cấu trúc nghiệp vụ.

## 1. Files changed

| File | Loại thay đổi |
|---|---|
| `styles.css` | Thêm 6 typography token + `--line-height-base` vào `:root`; áp `font-size`/`line-height` base cho `body`; thay **mọi** `font-size:` cứng (trừ nhóm icon/glyph liệt kê ở mục 20) bằng token tương ứng; thêm rule `.drawer-h h3` còn thiếu; thêm `font-weight:700` tường minh cho `.topbar h1`/`.card-h h3`/`.modal-h h3`/`.drawer-h h3`. |
| `js/v-vanhanh.js` | Xoá 4 chỗ `<h3 style="margin:0;font-size:16px">` lặp lại trong drawer (nay dùng `.drawer-h h3`); thêm `font-size:var(--font-size-md)` tường minh cho 1 h3 tiêu đề card ("Tài khoản người dùng") trước đây không có font-size (dựa vào mặc định trình duyệt). |
| `js/v-taichinh.js` | Xoá 2 chỗ `<h3 style="margin:0;font-size:16px">` lặp lại trong drawer; đổi 1 số tổng nổi bật ("Tổng nợ quá hạn") từ `font-size:18px` sang token `--font-size-lg`; thêm `font-size:var(--font-size-md)` tường minh cho 1 h3 tiêu đề fallback tab ("Đối soát"). |
| `js/v-dieuhanh.js` | Xoá 1 chỗ `<h3 style="margin:0;font-size:16px">` lặp lại trong drawer; đổi 1 h4 phụ ("Phản ánh chuyển vượt cấp...") từ `13.5px` sang token `--font-size-sm`. |
| `js/v-cautruc.js` | Xoá 1 chỗ `<h3 style="margin:0;font-size:16px">` lặp lại trong drawer; xoá override `font-size:13px` sai lệch trên h3 "Cấu trúc" (để kế thừa đúng `.card-h h3` = md); đổi h4 "Quy hoạch loại điểm kinh doanh dự kiến" từ `14px` sang token `--font-size-sm`; thêm `font-size:var(--font-size-md)` tường minh cho h3 "Mặt bằng chợ" (trước đây không có font-size). |
| `js/mini.js` | Đổi `20px`→token `--font-size-lg` (tiêu đề màn đăng nhập); xoá override `font-size:16px` thừa trên ô số điện thoại readonly (nay theo `.input` = base); đổi `22px`→token `--font-size-kpi` (số tiền thanh toán QR, đồng bộ với `.m-due .amt`); đổi `12px`→token `--font-size-sm` (khối chi tiết hoá đơn mở rộng). |

**Không sửa:** `js/permissions.js`, `js/core.js` (route/menu/RBAC — chỉ đọc để hiểu, không sửa dòng nào ở task này; các diff hiện có trên 2 file này trong working tree đến từ task RBAC trước đó, không liên quan task này), `js/accounts.js`, `js/v-tieuthuong.js`, dữ liệu (`js/data.js` nếu có), mọi handler/business logic.

---

## 2. Font sizes found before normalization (audit)

**`styles.css`** — 60 khai báo `font-size` rải rác từ **9px đến 26px**, không theo hệ thống: `9, 10.5, 11, 11.5, 11.5, 12, 12, 12, 12, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 13, 13, 13, 13, 13, 13, 13, 13, 13.5, 14, 15, 15, 15, 16, 17, 17, 18, 20, 20, 22, 24, 24, 26`. Đặc biệt: sidebar section heading (11px vs 10.5px lệch nhau vô lý), `.card-h h3`/`.modal-h h3` lệch nhau (15px vs 16px dù cùng vai trò "tiêu đề card/modal"), `.btn`/`.input` (13px) nhỏ hơn `.tag`/`.tbl th` gần bằng nhau (12px) dù vai trò khác hẳn, `.cell` (10.5px, số trong ô sơ đồ) quá nhỏ để đọc.

**Inline `style="font-size:...` trong JS** — 20 chỗ, gồm:
- 8 chỗ **lặp lại giống hệt nhau** `margin:0;font-size:16px` trên `<h3>` mở đầu mọi drawer (v-vanhanh.js ×4, v-taichinh.js ×2, v-dieuhanh.js ×1, v-cautruc.js ×1) — CSS chưa từng có rule `.drawer-h h3` nên mỗi nơi tự khai lại y hệt.
- 3 chỗ 3 h3/h4 tiêu đề card KHÔNG có font-size nào cả (dựa hoàn toàn vào mặc định trình duyệt, không tokenize được) — phát hiện thêm ngoài audit ban đầu khi rà theo pattern `.drawer-h h3`.
- Các giá trị lẻ không theo scale nào: `18px`, `13.5px`, `14px`, `13px` (override sai làm NHỎ HƠN card-title chuẩn), `16px` (thừa, trùng token nhưng không tokenize), `12px`, `20px`, `22px`.
- 3 SVG `font-size="..."` trong `core.js` (biểu đồ) — đơn vị viewBox, không phải px màn hình thật.
- 2 emoji icon (`48px`, `54px` trong `mini.js`) — kích thước icon trang trí, không phải text.

---

## 3. Typography tokens added

Thêm vào `:root` trong `styles.css`:
```css
--font-size-xs: 12px;   /* badge/chip, số trong ô sơ đồ, caption nhỏ */
--font-size-sm: 13px;   /* secondary/meta/help text, thead bảng, nhãn form */
--font-size-base: 14px; /* body mặc định, nav, button, input, table, nội dung card */
--font-size-md: 16px;   /* section/card title — font-weight 600/700 */
--font-size-lg: 20px;   /* page title — font-weight 700; số tổng nổi bật trong 1 dòng */
--font-size-kpi: 24px;  /* số KPI thật sự cần nhấn mạnh — font-weight 700+ */
--line-height-base: 1.45;
```
`body`/`:root` áp `font-size: var(--font-size-base); line-height: var(--line-height-base);` — **không dùng `transform`/`zoom`/`scale()`** ở bất kỳ đâu.

---

## 4. Mapping old sizes → semantic typography scale

| Cỡ cũ | Số nơi | Vai trò | Token mới |
|---|---|---|---|
| 9px (`.mb-caret-btn`) | 1 | Icon caret ▼ | **Giữ nguyên** (icon, mục 20) |
| 10.5px (`.cell`) | 1 | Số trong ô điểm KD | `--font-size-xs` (12px) |
| 10.5px (`.notch`, `.m-tabs button`) | 2 | Chrome phone/tab bar mobile | `.notch` giữ nguyên (icon-adjacent); `.m-tabs button` → `--font-size-xs` |
| 11px (`.nav-group`, `.mb-flatlabel-row`) | 2 | Section heading sidebar, metadata rút gọn | `--font-size-sm` (13px) |
| 11–11.5px (`.brand-sub`, `.nav .badge`, `.sidebar-foot`, `.label-sm`, `.m-head .hi`) | 5 | Caption/label phụ | `--font-size-xs`/`--font-size-sm` tuỳ ngữ cảnh (xem mục 6/7) |
| 11.5px (`.mb-iconbtn`) | 1 | Action Sửa/Xóa trong cây | `--font-size-sm` (13px) |
| 12–12.5px (`.tag`, `.tbl th`, `.field label`, `.small`, `.kpi .k-sub`, `.note`, `.pager`, `.legend`, `.plan-section h4`, `.kv`, `.kcol h4`, `.kcard`, `.receipt`, `.donut-legend`, `.qh-zone-chip`, `.chart-legend`, `.script li::before`, `.avatar`, ...) | ~24 | Badge/meta/secondary/thead — nhóm lớn nhất | `--font-size-xs` (12px) hoặc `--font-size-sm` (13px) tuỳ theo mục 9–13 |
| 13–13.5px (`.btn`, `.input`, `.seg button`, `.nav a`, `.mb-node`, `.mb-overview`, `.script li`, `.pay-methods label`) | 8 | Button/input/nav/tree node — đáng lẽ = body | `--font-size-base` (14px) |
| 14px (`v-cautruc.js` h4) | 1 | Subsection header trong drawer | `--font-size-sm` (đồng bộ `.plan-section h4`) |
| 15–17px (`.brand-title`, `.card-h h3`, `.modal-h h3`(đã đúng), `.detail h3`, `.receipt h4`, `.m-head .nm`, `.avatar.lg`) | 7 | Section/card title | `--font-size-md` (16px) |
| 18px (v-taichinh.js "Tổng nợ quá hạn") | 1 | Số tổng nổi bật 1 dòng | `--font-size-lg` (20px, đồng bộ `.receipt .total`) |
| 20px (`.topbar h1`, `.kpi .k-value` @860px) | 2 | Page title / KPI responsive | `--font-size-lg` (page title bumped 18→20); giữ 20 cho KPI responsive |
| 22px (mini.js số tiền QR) | 1 | Số tiền cần nhấn mạnh | `--font-size-kpi` (24px, đồng bộ `.m-due .amt`) |
| 24–26px (`.kpi .k-value`, `.m-due .amt`) | 2 | KPI thật sự | `--font-size-kpi` (24px; `.m-due .amt` giảm nhẹ 26→24 để khớp đúng 1 giá trị KPI duy nhất thay vì có 2 số KPI khác nhau 24 và 26) |
| 22px, 24px (`.otp input`, `.stars button`) | 2 | Widget chuyên biệt (OTP digit, rating star) | **Giữ nguyên** (mục 20) |

---

## 5. Sidebar

- `.nav a` (tên menu): 13.5px → **14px** (`--font-size-base`), đúng chuẩn "tên menu 14px".
- `.nav-group` (nhóm lớn "ĐIỀU HÀNH"/"TÀI CHÍNH"/"VẬN HÀNH"/"TIỂU THƯƠNG & HỢP ĐỒNG"): 11px → **13px** (`--font-size-sm`).
- `.nav-subgroup` (nhãn phụ trong nhóm, vd "Hạ tầng chợ"): 10.5px → **12px** (`--font-size-xs`).
- Cả 2 cấp section-heading nay nằm trong đúng dải 12–13px yêu cầu, thay vì lệch 10.5px/11px như trước — hết hiện tượng "menu này 13px, menu khác 15px".
- `.nav a .ico` được thêm `line-height:1` — icon không còn ảnh hưởng chiều cao dòng chữ dù `.nav a` vừa tăng font-size.
- Active item (`.nav a.active`) giữ nguyên style (nền trắng, `font-weight:600`) — không đổi.
- **Không redesign** cấu trúc/khoảng cách sidebar.

---

## 6. Topbar

- `.seg button` (tên tài khoản demo, tên chợ CL/TTD): 13px → **14px** (`--font-size-base`).
- `.label-sm` ("Tài khoản demo", "Chợ"): 11.5px → **13px** (`--font-size-sm`) — đúng "label phụ có thể 13px".
- Account selector layout **không đổi** — chỉ đổi cỡ chữ.

---

## 7. Page titles

`.topbar h1` (tên màn hình: "Mặt bằng chợ", "Điểm kinh doanh", "Tiểu thương", "Hợp đồng", "Cấu hình giá dịch vụ", "Khoản phải thu", "Thu tiền & biên lai", "Đối soát", "Công nợ & nhắc nợ", "Phản ánh & sự cố", ...): 18px → **20px, `font-weight:700`** tường minh (`--font-size-lg`). Vì mọi tiêu đề màn hình đều render qua CÙNG 1 rule CSS (`A.menuItem(A.current).label` → `#page-title` → `.topbar h1`), chuẩn hóa 1 chỗ áp dụng cho **toàn bộ** màn hình — không có màn nào tự đặt cỡ khác.

---

## 8. Cards

- `.card-h h3` (tiêu đề card): 15px → **16px, `font-weight:700`** tường minh (`--font-size-md`).
- `.card-b` nội dung thường: không đổi, đã đúng 14px kế thừa từ body.
- `.small` (meta/phụ dùng khắp nơi trong card): 12.5px → **13px** (`--font-size-sm`).
- Phát hiện + sửa 3 trường hợp h3 tiêu đề card KHÔNG nằm trong `.card-h` (dựa mặc định trình duyệt, không tokenize): "Mặt bằng chợ" (v-cautruc.js), "Tài khoản người dùng" (v-vanhanh.js), tiêu đề fallback tab Đối soát (v-taichinh.js) — cả 3 nay có `font-size:var(--font-size-md)` tường minh.

---

## 9. Tables

- `.tbl th` (thead): 12px → **13px, `font-weight:600`** (đã có sẵn) (`--font-size-sm`).
- `.tbl td` (tbody): trước đây KHÔNG có rule riêng (ngầm định kế thừa 14px từ body) → nay khai **tường minh** `font-size:var(--font-size-base)` (14px) để khóa cứng, không phụ thuộc ngầm vào body nữa.
- Không table nào còn tự đặt font-size riêng ngoài 2 rule chung này.

---

## 10. Forms

- `.field label`: 12px → **13px** (`--font-size-sm`).
- `.input`/`select.input`/`textarea.input`: 13px → **14px** (`--font-size-base`).
- Placeholder kế thừa từ input → tự động 14px.
- `.note` (help/error text): 12.5px → **13px** (`--font-size-sm`).
- `.pay-methods label` (lựa chọn phương thức thanh toán): 13px → **14px** (đồng bộ input/button).
- Không còn font-size nào dưới 12px trong nhóm form.

---

## 11. Buttons

- `.btn` (mặc định): 13px → **14px** (`--font-size-base`).
- `.btn.sm` (nhỏ/gọn): 12px → **13px** (`--font-size-sm`).
- Trước đây 3 cấp trộn lẫn (`.btn`=13, `.btn.sm`=12, một số button inline khác 14/16px không nhất quán) → nay chỉ còn đúng 2 cấp rõ ràng (14 thường / 13 compact), áp dụng thống nhất cho mọi nút cùng cấp.
- **Không đổi** permission visibility của bất kỳ nút nào — chỉ đổi `font-size`.

---

## 12. Badges

`.tag` (Đang thuê / Nợ phí / Tạm ngừng / Đang tranh chấp / Còn trống / Đã thanh toán / Quá hạn...): giữ nguyên **12px** (`--font-size-xs`, đã sẵn trong dải chuẩn 12–13px yêu cầu, chỉ tokenize không đổi số). `.nav .badge` (số thông báo): 11px → **12px** (`--font-size-xs`).

---

## 13. KPI

- `.kpi .k-value` (số KPI chính, dashboard Tổng quan): giữ nguyên **24px, `font-weight:700`** (`--font-size-kpi`) — đã đúng chuẩn từ trước, chỉ tokenize.
- `.kpi .k-label`: 12.5px → **13px** (`--font-size-sm`).
- `.kpi .k-sub`: giữ **12px** (`--font-size-xs`).
- `.m-due .amt` (mini app, số tiền cần thanh toán): 26px → **24px** (đồng bộ đúng 1 giá trị KPI thay vì có 2 cỡ KPI khác nhau 24 và 26 trong hệ thống).
- Số tiền QR trong mini app (trước 22px) → **24px** (đồng bộ với `.m-due .amt`, cùng ý nghĩa "số tiền cần thanh toán").
- "Tổng nợ quá hạn" (v-taichinh.js, 18px) và `.receipt .total` (20px, biên lai): xếp vào nhóm **20px** (`--font-size-lg`) riêng biệt với KPI 24px — đây là **quyết định thiết kế có chủ đích**: phân biệt "KPI dashboard nhiều thẻ cạnh nhau" (24px) với "1 số tổng nổi bật đơn lẻ trong dòng/tài liệu" (20px, cùng cấp page title) để tránh biến MỌI con số thành KPI lớn như task yêu cầu.
- KPI label vẫn 13–14px đúng chuẩn.

---

## 14. Modals/drawers

- `.modal-h h3`: giữ **16px**, thêm `font-weight:700` tường minh (`--font-size-md`).
- `.drawer-h h3`: **THÊM MỚI** rule (trước đây không tồn tại, mỗi nơi gọi drawer tự khai inline `style="margin:0;font-size:16px"` lặp lại y hệt 8 lần) — nay `.drawer-h h3 { font-size: var(--font-size-md); font-weight: 700; margin-right: auto; }`, xoá sạch 8 inline style trùng lặp khỏi JS, chỉ còn `<h3>đúng nội dung</h3>` (kế thừa `margin:0` từ rule chung `h1,h2,h3,h4`).
- `.x` (nút đóng ×): giữ nguyên 22px — icon, không phải text nội dung.

---

## 15. Mặt bằng chợ regression (không redesign, chỉ normalize typography)

- **Tree**: `.mb-node`/`.mb-overview` (node bình thường): 13px → **14px** đúng chuẩn "node bình thường 14px". `.mb-flatlabel-row .mb-node-label` (metadata/nhãn nhóm rút gọn TTD): 11px → **13px** đúng chuẩn "metadata/code 13px". `.mb-iconbtn` (action Sửa/Xóa): 11.5px → **13px**, nằm trong dải cho phép 12–13px. `.mb-node.on` (node đang chọn): **không có** font-size override nào — xác nhận selected node không tăng cỡ chữ.
- **Sơ đồ**: tên khu dùng `<h3>` trong `.card-h` → tự động 16px sau chuẩn hóa mục 8. Metadata khu dùng `.small` → tự động 13px sau chuẩn hóa mục 8. Số trong ô điểm KD (`.cell`): 10.5px → **12px** (`--font-size-xs`), đã live-test không tràn ô (ô rộng tối thiểu 26–34px, số 1–3 ký tự). Status legend (`.legend button`): 12.5px → **13px** đúng chuẩn "status legend 13px".
- **Toàn bộ behavior của workspace giữ nguyên 100%** — không sửa DOM structure, không sửa handler, không sửa permission gate (`A.canDo`), không sửa logic chọn khu/mở drawer/thêm-sửa-xoá. Xác nhận qua live test: click chọn khu → đúng, mở drawer Sửa → đúng, không có console error.

---

## 16. Responsive test

Live test qua `mcp__claude-in-chrome__resize_window` + `window.innerWidth`:

| Viewport | Kết quả |
|---|---|
| 958px (mặc định cửa sổ ban đầu) | 0 overflow, table/card/sidebar render đúng |
| 1424px (≈1440px) | 0 overflow; cột "Loại" trong bảng Hợp đồng wrap 2 dòng — **hành vi có sẵn từ trước** (cột không có `.nowrap`, text dài "Hợp đồng thuê điểm kinh doanh" tự xuống dòng theo đúng thiết kế bảng cũ, không phải regression do đổi font-size) |
| 1920px | Sweep tự động 9 tài khoản × 18 màn hình (162 lượt) — `document.documentElement.scrollWidth <= window.innerWidth` ở **100% lượt**, 0 overflow |
| ≤860px / ≤480px (breakpoint mobile hiện có) | **NEED_CONFIRMATION** — xem mục 20, công cụ test không thu nhỏ được cửa sổ thật xuống dưới kích thước hiện tại trong phiên này |

Không có trường hợp nào chữ bị cắt, đè lên nhau, tràn button/card, hay làm vỡ header bảng ở các viewport đã kiểm chứng trực tiếp.

---

## 17. RBAC regression

- `js/permissions.js`, `js/core.js` **không có dòng nào bị sửa** trong task này (xác nhận qua diff — 2 file này có thay đổi trong working tree nhưng đến từ task chuẩn hóa `screen:mat-bang` TRƯỚC ĐÓ, hoàn toàn không liên quan/không bị đụng thêm ở task typography này).
- `A.canDo(...)`, `U.can(...)`, screen permission, action permission, `PERM_SEED_VERSION`, `RBAC_SCHEMA`: không đổi.
- Không `localStorage.clear()`, không gọi `PERM.resetDefault()`.
- Live test: sweep 9 tài khoản × 18 màn hình không phát sinh lỗi phân quyền nào (mọi màn hình vẫn hiện/ẩn đúng theo tài khoản như trước khi đổi typography).

---

## 18. Browser console

- Tải trang mới hoàn toàn: 0 lỗi console.
- Sweep 9 tài khoản demo × 18 màn hình (`Object.keys(A.VIEWS)`, 162 lượt render) tại viewport 1920px: **0 exception, 0 lỗi console**.
- Tương tác trực tiếp (mở drawer "Sửa khu" trong Mặt bằng chợ, mở modal "Tạo hợp đồng", chọn 1 khu trong sơ đồ): 0 lỗi console.

---

## 19. `node --check`

```
js/v-vanhanh.js    OK
js/v-taichinh.js   OK
js/v-dieuhanh.js   OK
js/v-cautruc.js    OK
js/mini.js         OK
js/core.js         OK   (không sửa, check lại để xác nhận không vô tình hỏng)
js/permissions.js  OK   (không sửa, check lại để xác nhận không vô tình hỏng)
js/v-tieuthuong.js OK   (không sửa, check lại để xác nhận không vô tình hỏng)
js/accounts.js     OK   (không sửa, check lại để xác nhận không vô tình hỏng)
```
(`styles.css` không có công cụ syntax-check tương đương — đã rà soát thủ công toàn bộ file + xác nhận bằng screenshot render đúng ở 3 viewport.)

---

## 20. Remaining intentional exceptions

Các `font-size` **cố ý giữ nguyên**, không đưa vào token scale, vì không phải là "văn bản đọc theo hierarchy" mà là kích thước icon/glyph/widget chuyên biệt:

| Selector | Giá trị | Lý do giữ nguyên |
|---|---|---|
| `.x` | 22px | Glyph "×" đóng modal/drawer, kích thước hitbox/icon, không phải nội dung đọc |
| `.notch` | 11.5px | Mô phỏng thanh trạng thái điện thoại (giờ/pin) trong mini app — quy ước UI hệ điều hành thu nhỏ, không thuộc hierarchy text của app |
| `.m-tabs button .i` | 17px | Icon emoji trong tab bar mini app |
| `.otp input` | 20px | Widget nhập OTP từng ký tự, kích thước lớn có chủ đích để dễ đọc/nhập, không phải input form thông thường |
| `.stars button` | 24px | Icon ngôi sao đánh giá |
| `.mb-caret-btn` | 9px | Glyph mũi tên ▼/▶ thu gọn/mở rộng cây |
| `core.js` (SVG `font-size="11"`, `"6.5"`, `"3.2"`) | — | Đơn vị toạ độ bên trong `viewBox` của biểu đồ SVG responsive (`width:100%`), KHÔNG phải px màn hình thật — áp token CSS không có ý nghĩa ở đây |
| `mini.js` (emoji `48px`, `54px`) | — | Icon trang trí (🪷, ✅) trong màn hình mini app, không phải text |

Không có font-size nào trong nhóm trên bị coi là "quá nhỏ"/"quá lớn" gây rối thị giác theo đúng tinh thần task — vì chúng không cạnh tranh vai trò với văn bản đọc thực sự trong hierarchy.

**NEED_CONFIRMATION — giới hạn công cụ test:** `mcp__claude-in-chrome__resize_window` trong phiên này chỉ thu nhỏ cửa sổ thành công 1 lần đầu (từ mặc định xuống rồi tăng lên 1424px/1920px), nhưng **không thể** thu nhỏ trở lại dưới ~958px sau khi cửa sổ đã ở trạng thái lớn/maximize (giới hạn đã từng ghi nhận ở task trước — `MARKET_LAYOUT_MERGE_IMPLEMENTATION_REPORT.md`). Vì vậy **chưa xác nhận trực quan trực tiếp** ở đúng 2 breakpoint mobile hiện có (`max-width:860px`, `max-width:480px`) trong phiên này. Đã giảm thiểu rủi ro bằng cách: (1) không đổi bất kỳ `grid-template-columns`/breakpoint/layout nào, chỉ đổi giá trị `font-size`; (2) hầu hết thay đổi là ±1–1.5px (rủi ro tràn cực thấp); (3) đã rà soát bằng mắt các rule trong 2 media query mobile hiện có và xác nhận không có `font-size` nào bị đổi theo hướng LỚN HƠN đáng kể ở chính các khối UI vốn đã chật (`.mb-tree-toggle`, `.kv` 2 cột, `.pay-methods` 1 cột). Khuyến nghị người dùng tự kiểm tra trực quan trên thiết bị/trình duyệt di động thật trước khi coi phần này là đã xác nhận đầy đủ.

---

## Xác nhận cuối

```
RBAC changed? NO
Permission changed? NO
Route changed? NO
Business logic changed? NO
Data changed? NO
localStorage reset? NO
```

---

## STOP

Normalize typography + test + report hoàn tất. Không redesign màn hình nào, không sửa permission, không sửa nghiệp vụ, không tự làm task khác.
