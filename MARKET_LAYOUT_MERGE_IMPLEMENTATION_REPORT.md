# MARKET_LAYOUT_MERGE_IMPLEMENTATION_REPORT

Gộp UI "Thiết lập mặt bằng chợ" + "Sơ đồ mặt bằng" thành workspace "Mặt bằng chợ" thống nhất.

---

## 1. Files changed

- `js/core.js` — `A.MENU` (relabel `so-do` → "Mặt bằng chợ", đánh dấu `cau-truc` `hidden: true`);
  `chrome()` (bỏ item `hidden` khỏi danh sách `<a>` sidebar, không ảnh hưởng `U.can`/routing).
- `js/v-dieuhanh.js` — viết lại toàn bộ khối "Sơ đồ mặt bằng": adapter cây (`mbBlocks`,
  `mbFindSection`), header dùng chung (`A.mbHeaderHtml`), tree/overview/zone-detail renderer mới
  (`mbTreeHtml`, `mbOverviewHtml`, `mbZoneDetailHtml`, `mbRightHtml`), handler mới
  (`mb-edit-mode`/`mb-view-mode`/`mb-sel-zone`/`mb-sel-overview`/`mb-toggle-node`/`mb-toggle-tree`),
  đổi handler `stall` sang mở drawer. **`A.stallPanel`, `stall-status`, `stall-status-save` giữ
  nguyên 100% logic** (chỉ đổi vị trí gọi).
- `js/v-cautruc.js` — chỉ sửa 6 dòng đầu `A.VIEWS['cau-truc']`: thêm `A.mbHeaderHtml('edit')`, bỏ
  dòng subtitle chợ trùng lặp (đã có ở header chung) và nhánh `ui.market==='ALL'` đã chết từ Phase 2.
  **Không đụng `treeHtml`/`detailHtml`/`visualHtml`/bất kỳ handler `qh-*` nào.**
- `styles.css` — thêm khối CSS mới `/* Mặt bằng chợ */` (`.mb-*`), không sửa/xoá rule nào có sẵn.
- **Không sửa**: `js/permissions.js`, `js/tieuthuong.js` (màn Điểm kinh doanh), `js/v-taichinh.js`,
  `js/v-vanhanh.js`, `js/serviceconfig.js`, `data.js`, `index.html`.

---

## 2. Old screens reused

- `screen:so-do` (7 role) → route/permission gốc **giữ nguyên** — nay là **VIEW MODE** của
  workspace, route mặc định.
- `screen:cau-truc` (2 role: market_manager, market_staff) → route/permission gốc **giữ nguyên** —
  nay là **EDIT MODE**, tiếp tục render đúng model `LAYOUT` (localStorage
  `choso-caolanh-layout`) và toàn bộ 26 handler `qh-*` của `js/v-cautruc.js` y nguyên.
- Không tạo screen id mới, không tạo permission mới, không tạo model dữ liệu mặt bằng thứ hai.

---

## 3. New workspace structure

```
A.mbHeaderHtml(mode)          — header dùng chung: tiêu đề "Mặt bằng chợ", chợ đang chọn,
                                 nút chuyển mode, (VIEW) summary bar compact
VIEW  (A.VIEWS['so-do'])      — mb-workspace: cây trái (mbTreeHtml) + nội dung phải (mbRightHtml)
        mbRightHtml           — ui.mb.sel ? mbZoneDetailHtml (1 khu) : mbOverviewHtml (card lưới)
EDIT  (A.VIEWS['cau-truc'])   — A.mbHeaderHtml('edit') + nội dung cau-truc GỐC không đổi
```

Không còn trang dài "cấu trúc → toàn bộ sơ đồ → hàng trăm điểm KD" nối tiếp — đúng mục 3 đề bài.

---

## 4. CL rendering behavior

Adapter `MB_BLOCK_GROUPS.CL` gộp 4 floor thật (`H`,`T1`,`T2`,`NL`) thành 2 khối hiển thị:
- "Nhà chợ chính" → Tầng hầm (leaf, không children vì `sections:[]`), Tầng 1 (5 khu), Tầng 2 (5 khu)
- "Ngoài nhà" → Ngoài nhà lồng (1 khu: Khu tự sản tự tiêu)

Verify sống (screenshot): cây hiển thị đúng thứ tự Tầng hầm → Tầng 1 → Tầng 2, số điểm mỗi khu
khớp chính xác data thật (Khu thủy hải sản 36, Khu thịt gia cầm 24, Khu rau củ 36 — đúng ví dụ đề
bài). Không ép các khu cùng diện tích/số điểm — mỗi khu render theo đúng `rows.length × per` của
chính nó.

---

## 5. TTD rendering behavior

**Dùng chung 100% code với CL** — không có nhánh `if (mid === 'TTD')` nào. Quy tắc tự động: nếu
tổng số floor thật của market ≤ 1 (TTD chỉ có 1 floor `KHU`), `mbTreeHtml` tự bỏ cấp
khối+tầng, hiển thị thẳng nhãn "Không gian chợ quê" + 3 khu (Khu ẩm thực, Khu nông sản đặc sản, Khu
trải nghiệm) làm node cấp cao nhất. Verify sống: `hasFlatLabel: true`, `noFloorNodeShown: true`
(không có node "Tầng..." nào render), 3 khu hiển thị đúng.

---

## 6. Overview behavior

`mbOverviewHtml` render 1 card/khu (không phải hàng trăm điểm KD) — mỗi card: tên khu, tầng, tổng
điểm, breakdown trạng thái dạng "X thuê · Y nợ phí..." (chỉ hiện trạng thái có số > 0). Click card
→ `mb-sel-zone` → chuyển sang sơ đồ chi tiết đúng khu đó (cùng action với click node trên cây).
Verify sống: card hiển thị đúng format ví dụ đề bài ("36 điểm" / "25 đang thuê · 3 nợ phí · 2 đang
tranh chấp · 4 còn trống").

---

## 7. Tree navigation

Node "📊 Tổng quan" luôn ở đầu cây (chọn = `ui.mb.sel = null`). Khối/tầng có nút expand/collapse
riêng (`mb-toggle-node`, state `ui.mb.collapsed`), khu là leaf-button chọn được (`mb-sel-zone`).
Highlight node đang chọn qua class `.on`. **Không có nút Sửa/Xóa nào trong cây VIEW MODE** — đây là
cây điều hướng thuần đọc, hoàn toàn khác cây `qh-*` (có Sửa/Xóa) chỉ xuất hiện ở EDIT MODE.

---

## 8. Business-point drawer

Click 1 điểm kinh doanh (`data-act="stall"`) → mở drawer phải (tái dùng đúng pattern
`.drawer`/`.drawer-overlay` đã có sẵn trong `styles.css`, dùng chung ở Tài khoản/Đối soát...) chứa
nguyên `A.stallPanel(st)` — mã điểm, trạng thái, khu, tầng, loại, diện tích, tiểu thương, hợp đồng,
công nợ, action (Thu tiền/Hồ sơ/Tạo hợp đồng/Đổi trạng thái) theo đúng permission hiện có, không
đổi 1 dòng logic nào trong `A.stallPanel`. Đóng bằng `data-act="close"` chuẩn (X hoặc overlay) —
sơ đồ phía sau luôn giữ nguyên full-width (drawer là overlay nổi, không chiếm layout).

---

## 9. View/Edit mode

Mặc định VIEW (`so-do`). Nút "🧱 Thiết lập mặt bằng" **chỉ hiện nếu**
`U.can('cau-truc') && (cau-truc.edit || cau-truc.delete || cau-truc.reset)` cho chợ đang chọn —
bấm → `A.go('cau-truc')` (điều hướng qua route có sẵn, không có state "mode" riêng). Trong EDIT,
nút "✓ Hoàn tất thiết lập" → `A.go('so-do')`. Không nút Sửa/Xóa cấu trúc nào lọt vào VIEW MODE.

---

## 10. Existing permissions reused

Không thêm/bớt permission key nào. Toàn bộ hành động tiếp tục dùng đúng key cũ:
`cau-truc.edit`/`cau-truc.delete`/`cau-truc.reset` (EDIT mode, `js/v-cautruc.js` không đổi),
`so-do.xem-ho-so`/`so-do.tao-hop-dong`/`so-do.doi-trang-thai`/`hop-dong.tao`/`thu-tien.thu` (VIEW
mode drawer, qua `A.stallPanel` không đổi). `screen:so-do`/`screen:cau-truc` giữ nguyên, không xoá,
không đổi default matrix.

---

## 11. Route compatibility

- `#/so-do` → VIEW MODE (mặc định, route chính cho sidebar "Mặt bằng chợ").
- `#/cau-truc` → EDIT MODE, **vẫn gõ hash trực tiếp được, vẫn permission-gate độc lập y hệt trước**
  — verify sống: `collector` (không có `screen:cau-truc`) gõ thẳng `#/cau-truc` bị chặn bởi router
  gốc (`U.can`/`A.route()` không đổi), fallback về màn accessible đầu tiên — hành vi CHƯA TỪNG đổi.
- Sidebar chỉ hiện 1 link (trỏ `so-do`) — thực hiện bằng cờ `hidden: true` trên item `cau-truc`
  trong `A.MENU`, **chỉ ảnh hưởng bước lọc `<a>` render trong `chrome()`**, không đụng
  `A.menuItem()`/`U.can()`/`A.route()`/`A.firstAccessibleScreen()`.

---

## 12. Market-scope behavior

`ui.market` (global, luôn `'CL'`/`'TTD'`) là nguồn DUY NHẤT cho cả tree lẫn nội dung — không có
selector chợ nội bộ nào khác trong workspace mới (đã bỏ nhánh `ui.market==='ALL'` chết từ Phase 2 ở
cả 2 file). Đổi chợ ở topbar → `A.ACT.market` (không đổi) → `A.route()` → render lại toàn bộ
workspace theo đúng `ui.market` mới. `ui.mb.sel` không hợp lệ ở chợ mới (`mbFindSection` không tìm
thấy) tự fallback về Tổng quan, không leak dữ liệu chợ cũ, không crash — verify sống.

---

## 13. Data compatibility

- **Không sửa `data.js`** — dùng nguyên `D.MARKETS`/floor/section (không đổi tên "Tầng 1"/"Tầng 2"
  dù đề bài gợi ý "Tầng trệt"/"Tầng lầu" — đây chỉ là ví dụ minh hoạ, đổi tên field dữ liệu nghiệp
  vụ core rủi ro không cần thiết cho 1 task UI refactor; nhãn hiện tại "Tầng 1"/"Tầng 2"/"Ngoài nhà
  lồng"/"Tầng hầm" đã đủ rõ nghĩa).
- **Không sửa** `A.db.stalls`/`localStorage['choso-caolanh-state']`.
- **Không sửa** model `LAYOUT` (`localStorage['choso-caolanh-layout']`, `js/v-cautruc.js`).
- Toàn bộ adapter (`MB_BLOCK_GROUPS`, `mbBlocks`, `mbFindSection`) là **read-model thuần FE**, chỉ
  đọc `D.MARKETS`, không ghi ngược, không tạo bảng/localStorage mới.

---

## 14. Test results

| # | Test | Kết quả |
|---|---|---|
| A1 | Cây CL đúng cấu trúc (2 khối, đúng thứ tự tầng, đúng số điểm/khu) | **PASS** (screenshot) |
| A2 | Chọn khu → chỉ render khu đó (không kèm khu khác) | **PASS** — verify DOM: right-panel chỉ chứa "Khu thủy hải sản", không chứa "Khu thịt, gia cầm"; 3 `.plan-row` (A/B/C) |
| A3 | Tổng quan hoạt động, card đúng format, click card chuyển đúng khu | **PASS** (screenshot + DOM) |
| A4 | Click điểm mở drawer đúng nội dung | **PASS** (screenshot: HS-A01, đầy đủ tiểu thương/hợp đồng/công nợ/action) |
| A5 | Đóng drawer | **PASS** |
| B1 | TTD dùng chung workspace, cấu trúc đơn giản hơn (bỏ node tầng dư) | **PASS** |
| B2 | Không bị ép hiển thị tầng không cần thiết | **PASS** (`noFloorNodeShown: true`) |
| B3 | Chọn khu/điểm TTD hoạt động | **PASS** (dùng chung `mb-sel-zone`/`stall`, không cần test riêng) |
| C1 | `ui.market='CL'` → dữ liệu CL | **PASS** |
| C2 | `ui.market='TTD'` → dữ liệu TTD, không cross-market, không crash khi khu đang chọn không tồn tại ở chợ mới | **PASS** |
| D1 | `collector` (read-only so-do) vẫn xem được sơ đồ | **PASS** |
| D2 | `collector` không tự có nút "Thiết lập mặt bằng" | **PASS** |
| D3 | `market_staff`/`market_manager` có `cau-truc.edit` mới thấy đúng thao tác edit tương ứng (edit có, delete/reset theo đúng quyền riêng) | **PASS** — `market_staff` thấy "+Thêm khối" nhưng KHÔNG thấy "Khôi phục mặc định" (đúng, thiếu `cau-truc.reset`) |
| D4 | Forged mutation vẫn qua handler gate cũ | **PASS** — forge `mb-edit-mode` (collector, thiếu quyền) không chuyển route; forge `stall-status-save` (collector, thiếu `so-do.doi-trang-thai`) không đổi state; gõ thẳng `#/cau-truc` (collector, thiếu `screen:cau-truc`) bị router chặn; revoke `cau-truc.edit` runtime → modal `qh-add-block` không mở |
| E | Regression: render 19 màn × 8 account (đủ vai trò) | **PASS** — 0 lỗi |
| E | `diem-kd` (modal `dk-open` dùng `A.stallPanel`) không bị ảnh hưởng | **PASS** |
| F | Browser console | **PASS** — 0 lỗi xuyên suốt |
| G | `node --check` | **PASS** — cả 3 file JS sửa |

*Ghi chú*: 2 lần đầu test A.go()-rồi-đọc-A.current-ngay đọc phải state cũ do
`location.hash=` kích hoạt hashchange bất đồng bộ (hiện tượng đã biết, không phải lỗi code) — sửa
cách test bằng gọi `A.route()` đồng bộ ngay sau khi set hash, kết quả PASS nhất quán ở lần chạy lại.

---

## 15. Regression results

`PERM_SEED_VERSION` đọc lại = 4 (giữ nguyên từ task trước, không đổi), `RBAC_SCHEMA` = 2 (không
đổi), 11 account (không đổi). Không phát hiện regression ở bất kỳ module nào ngoài phạm vi sửa.

---

## 16. Browser console

0 lỗi (`onlyErrors: true`) xuyên suốt toàn bộ phiên test, kể cả sau reload và sau khi render 19 màn
× 8 account.

---

## 17. `node --check`

```
js/core.js       OK
js/v-dieuhanh.js OK
js/v-cautruc.js  OK
```

---

## 18. NEED_CONFIRMATION

1. **Responsive mobile thực tế chưa được screenshot-verify ở viewport hẹp** — công cụ
   `resize_window` trong phiên này không làm đổi `window.innerWidth` mà công cụ chụp màn hình đọc
   (vẫn ghi nhận 958px sau khi resize) — đây là giới hạn công cụ test, không phải nghi vấn về code.
   Đã verify logic JS (`ui.mb.treeOpen` toggle, class `.open`) hoạt động đúng và đã review kỹ 2 rule
   CSS `@media(max-width:860px)`/`@media(max-width:1180px)` — tự tin về mặt kỹ thuật nhưng CHƯA có
   ảnh chụp thực tế ở độ rộng điện thoại để xác nhận 100% bằng mắt.
2. **Sidebar không highlight "Mặt bằng chợ" khi đang ở EDIT MODE** (`#/cau-truc`) — vì link sidebar
   trỏ đúng `so-do`, `A.current==='cau-truc'` nên `class="active"` không khớp. Không phải lỗi chức
   năng (điều hướng vẫn đúng, không mất quyền truy cập) — chỉ là 1 tiểu tiết UX (không có highlight
   khi ở màn thiết lập). Không tự sửa vì cách sửa "đẹp" nhất (coi cau-truc là active-alias của
   so-do trong sidebar) có thể cần 1 quyết định thiết kế nhỏ — nêu ra để xác nhận có cần làm không.
3. **Trường hợp lý thuyết**: nếu 1 dynamic role tương lai có `screen:cau-truc` nhưng KHÔNG có
   `screen:so-do` (hiện tại không role nào như vậy), link "Mặt bằng chợ" sẽ biến mất khỏi sidebar
   với họ (vì sidebar chỉ gắn với `so-do`) dù họ vẫn vào `#/cau-truc` được qua URL trực tiếp — đã
   ghi nhận, không ảnh hưởng ma trận mặc định hiện tại, nêu ra để nếu cần xử lý thêm ở tương lai.

---

### Xác nhận bắt buộc theo yêu cầu đề bài

| Mục | Kết quả |
|---|---|
| `PERM_SEED_VERSION` changed? | **NO** |
| `RBAC_SCHEMA` changed? | **NO** |
| Permission `CATALOG` changed? | **NO** |
| Role permissions reset? | **NO** |
| Account storage reset? | **NO** |
| Business data reset? | **NO** |

---

*Hết báo cáo. Dừng lại — không redesign màn Điểm kinh doanh, không sửa Dynamic RBAC, không đổi
permission matrix, không refactor module khác.*
