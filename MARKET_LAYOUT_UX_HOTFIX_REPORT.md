# HOTFIX UX "MẶT BẰNG CHỢ" — Báo cáo triển khai

## 0. Tóm tắt

Thiết kế lại **chế độ chỉnh sửa cấu trúc** của màn "Mặt bằng chợ" (gộp từ `#/so-do` + `#/cau-truc`), loại bỏ toàn bộ khối giao diện "màn setup cũ" còn sót lại sau lần gộp trước, thay bằng **thao tác chỉnh sửa theo ngữ cảnh (contextual inline actions)** ngay trên cây cấu trúc, không còn khái niệm "Chế độ chỉnh sửa" toàn cục. Phần **Tổng quan (view mode)** giữ nguyên 100% như trước, không redesign.

Không có thay đổi nào về Dynamic RBAC, permission CATALOG, schema, seed version, dữ liệu tài khoản/vai trò/phạm vi chợ, hay dữ liệu nghiệp vụ (stalls/traders/contracts...). Toàn bộ 24 handler `qh-*` giữ nguyên logic nghiệp vụ và điều kiện phân quyền (`A.canDo`) — chỉ có 6 handler được bổ sung **thêm 1 dòng gọi `qhSyncDrawer()`** để đồng bộ giao diện drawer đang mở, không thay đổi gì về mặt nghiệp vụ/permission.

## 1. Khối giao diện "màn setup cũ" đã gỡ bỏ

Trong `js/v-cautruc.js`, đã xoá hoàn toàn:
- Banner hướng dẫn setup riêng.
- 5 thẻ KPI lớn (đã thay bằng 1 dòng tóm tắt gọn `288 điểm KD · 196 đang thuê · 34 còn trống · ...` trong header, tái sử dụng đúng dữ liệu thật từ `A.db.stalls`).
- Thẻ hành động (action card) riêng.
- Layout cây + placeholder kiểu cũ (`treeHtml()`, `detailHtml()`, `visualHtml()`).
- Khối "Sơ đồ mặt bằng trực quan (quy hoạch)" tách riêng — nay chỉ còn **đúng 1 khu vực sơ đồ duy nhất** (panel phải), dùng chung cho cả xem và sửa.
- `A.VIEWS['cau-truc']` phiên bản cũ (route riêng biệt) — nay `A.VIEWS['so-do']` và `A.VIEWS['cau-truc']` trỏ **cùng một hàm** `mbWorkspaceHtml`.

Trong `js/v-dieuhanh.js`: xoá `A.mbHeaderHtml`, `mbTreeHtml`, `mbRightHtml` và toggle route `mb-edit-mode`/`mb-view-mode` (đã phát hiện và dọn một bản sao chết `A.VIEWS['so-do']` còn sót sau lần sửa đầu — đã xác nhận bằng `grep` không còn tham chiếu nào).

## 2. Chỉnh sửa theo ngữ cảnh (contextual inline editing) — đã triển khai

- Panel "Cấu trúc" (cây bên trái) có nút `+ Khối/Nhà chợ` ở header (chỉ hiện khi `cau-truc.edit`).
- Mỗi dòng Khối có `[+ Tầng] [✎ Sửa] [🗑 Xóa]` xuất hiện cạnh tên khối.
- Mỗi dòng Tầng có `[+ Khu] [✎ Sửa] [🗑 Xóa]`.
- Mỗi dòng Khu có `[✎ Sửa] [🗑 Xóa]`.
- Các nút này dùng class `.mb-iconbtn` (ghost/icon, không viền), mặc định mờ (`opacity:.45`), rõ hẳn khi hover/focus/khi dòng đang chọn (`.mb-node:hover .mb-actions`, `.on .mb-actions`). Nút Xóa (`.mb-iconbtn.danger`) **không đỏ mặc định**, chỉ chuyển đỏ khi hover (`.mb-iconbtn.danger:hover`).
- Tất cả các nút bị ẩn hoàn toàn (không render) khi tài khoản không có quyền tương ứng (`mbCan(mid)` gọi `A.canDo('cau-truc.edit'|'.delete'|'.reset', mid)`) — đã live-test xác nhận với `collector`/`market_staff`.
- "Khôi phục cấu trúc mặc định" chuyển vào nút phụ `[⋯]` (title="Khôi phục cấu trúc mặc định") cạnh `+ Khối/Nhà chợ`, chỉ hiện khi có quyền `cau-truc.reset`.

## 3. Hành vi cây (tree)

- Panel trái luôn có mục `📊 Tổng quan` ở đầu (chọn thì panel phải hiện lưới tổng quan, giống hệt Tổng quan gốc).
- Với chợ có **đúng 1 Khối và Khối đó có đúng 1 Tầng** (áp dụng cho TTD theo dữ liệu LAYOUT mặc định), cây **tự động rút gọn**: không hiện dòng Khối lồng Tầng, chỉ hiện 1 dòng nhãn khối (nhỏ, uppercase) rồi tới danh sách Khu trực tiếp — không hard-code theo `market id`, hoàn toàn dựa vào cấu trúc dữ liệu LAYOUT (`blocks.length===1 && blocks[0].floors.length===1`).
- Với chợ có nhiều Khối/Tầng (CL, sau khi dữ liệu LAYOUT mặc định gộp 3 tầng phi-gửi-xe vào 1 khối "Nhà chợ chính"), cây hiện đầy đủ Khối → Tầng (caret mở/đóng, `mb-toggle-node`) → Khu.
- Click 1 Khu (`mb-sel-zone`) → panel phải chuyển sang hiện đúng khu đó; không có 2 khu vực sơ đồ hiện cùng lúc.

## 4. Hành vi drawer/modal

- Sửa Khối/Tầng/Khu **không** chuyển màn hình — mở **drawer bên phải** (`.drawer`/`.drawer-overlay`, tái dùng pattern có sẵn) chứa đúng các field hiện có (Tên/Mã/Ngành hàng/Diện tích/Số điểm dự kiến...), có `[Hủy]`/`[Lưu thay đổi]`.
- Thêm hàm `qhSyncDrawer()`: sau khi sửa 1 field trong khi drawer đang mở, drawer tự cập nhật để phản ánh giá trị mới (không cần đóng/mở lại) — được gọi thêm (additive, không đổi logic cũ) sau `A.render()` trong 6 handler: `qh-pt-add`, `qh-pt-del`, `qh-save-draft`, `qh-save-final`, `A.CH['qh-zone-field']`, `A.CH['qh-pt-field']`.
- Thêm mới 1 Khu (`qh-add-zone-save`) → sau khi lưu, drawer **tự mở luôn** cho khu vừa tạo (thay vì đóng modal cũ) — đã live-test xác nhận (`drawerAutoOpenedAfterAdd:true`).
- Xóa Khu/Khối/Tầng vẫn giữ modal xác nhận cũ (`qh-*-del-ok`), cùng business rule (chặn xóa nếu còn khu con/đã có dữ liệu thật gắn vào theo logic cũ), cùng handler permission gate — không đổi.
- Đóng drawer/modal dùng đúng cơ chế `data-act="close"` → `A.closeModal()` có sẵn.

## 5. Hành vi sơ đồ (diagram) — panel phải

- Không chọn Khu → hiện lưới Tổng quan (`A.mbOverviewHtml`, không đổi so với bản gộp trước, khớp 100% dữ liệu thật).
- Chọn 1 Khu → hiện đúng 1 sơ đồ của khu đó (`A.mbZoneDiagramHtml`), tái dùng grid/legend/màu trạng thái gốc; nếu khu đã khớp với dữ liệu thật (`mbMatchRealSection`) hiện lưới gian hàng thật; nếu chưa (khu quy hoạch) hiện thẻ "chưa có dữ liệu thực tế" + số điểm dự kiến.
- Có nút `✎ Sửa thông tin khu` ngay trong panel sơ đồ (chỉ hiện khi có quyền `cau-truc.edit`) mở đúng drawer của khu đang xem — không tạo thêm khu vực sơ đồ thứ hai.

## 6. Hành vi chợ Cao Lãnh (CL)

- Cây: 1 khối "Nhà chợ chính" chứa 3 tầng (Tầng 1, Tầng 2, NL) — đơn giản hoá so với "2 khối tổng hợp" (giả lập) của lần gộp trước, vì khối/tầng đó vốn không có ý nghĩa chỉnh sửa thật (LAYOUT chỉ thật sự lưu 1 khối theo `defaultLayout()`). Việc rút gọn này bám sát đúng model LAYOUT — mô hình duy nhất thực sự có thể chỉnh sửa — loại bỏ nhóm ảo không thao tác được.
- "Tầng hầm/bãi xe" (không có trong LAYOUT vì `defaultLayout()` bỏ qua tầng gửi xe) tự nhiên không xuất hiện trên cây — không cần logic ẩn riêng.
- Đã live-test: Tổng quan hiển thị đúng 288 điểm KD/196 đang thuê/34 còn trống/47 nợ phí/8 tạm ngưng/3 tranh chấp — khớp dữ liệu gốc trước hotfix.
- Đã live-test thêm/sửa/xoá Khu (`TEST1` → sửa diện tích → xoá) thành công, đúng flow.

## 7. Hành vi chợ quê Tân Thuận Đông (TTD)

- Cây tự động rút gọn (không hiện lồng Khối→Tầng) — xác nhận bằng DOM thật: nhãn "Khu chợ quê" (1 dòng) rồi tới các Khu (`Khu ẩm thực dân dã`, ...) trực tiếp, không có nhãn "Tầng" nào hiển thị.
- Không hard-code theo `market id` — logic rút gọn hoàn toàn dựa trên `blocks.length===1 && blocks[0].floors.length===1`, tự động đúng cho TTD nhờ cấu trúc dữ liệu LAYOUT vốn có, không phải rule đặc biệt gắn cứng `if (mid==='TTD')`.
- Test với tài khoản `market_staff` (Huỳnh Thanh Tâm, scope TTD): thấy nút `✎ Sửa` (có `cau-truc.edit`), **không** thấy nút Xóa/nút `⋯` khôi phục mặc định (không có `cau-truc.delete`/`.reset`) — đúng theo ma trận phân quyền hiện có, không phải thay đổi permission mới.
- Click 1 Khu → panel phải hiện đúng 1 sơ đồ khu đó, dữ liệu thật khớp (`Khu ẩm thực dân dã · 20 điểm`).

## 8. Tái sử dụng phân quyền (không tạo permission key mới)

Toàn bộ nút hành động dùng lại đúng 3 action key đã có sẵn từ trước: `cau-truc.edit`, `cau-truc.delete`, `cau-truc.reset` (qua `A.canDo(actionKey, mid)`). Không thêm/xoá/đổi bất kỳ `permKey` nào trong `CATALOG`. Không đổi `defaultRolePermissions()`. Không đổi `PERM_SEED_VERSION`, không đổi `RBAC_SCHEMA`.

## 9. Kiểm thử đã thực hiện (live browser, http://localhost:8795, đã dọn sau khi xong)

| # | Test | Kết quả |
|---|------|---------|
| 1 | Tải trang lần đầu, 0 lỗi console | ✅ PASS |
| 2 | Không còn banner/5 KPI card/action card/section "quy hoạch" riêng | ✅ PASS (xác nhận qua screenshot) |
| 3 | Tổng quan CL khớp dữ liệu gốc (288/196/34/47/8/3) | ✅ PASS |
| 4 | Cây CL: 1 khối, 3 tầng, 11 khu (đúng model LAYOUT) | ✅ PASS |
| 5 | Click 1 Khu → panel phải chỉ hiện đúng khu đó, không trùng lặp sơ đồ | ✅ PASS |
| 6 | Nút "✎ Sửa" đúng khu mở đúng drawer, đúng field (code/tên) | ✅ PASS |
| 7 | Sửa field khi drawer mở → `qhSyncDrawer()` đồng bộ, drawer không đóng | ✅ PASS |
| 8 | Lưu và tiếp tục → giữ đúng khu đang chọn (`selAfterSave` không đổi) | ✅ PASS |
| 9 | Đóng drawer bằng `data-act="close"` | ✅ PASS |
| 10 | Thêm Khu mới → drawer tự mở cho khu vừa tạo | ✅ PASS |
| 11 | Xóa Khu (modal xác nhận → xác nhận) → khu biến mất khỏi cây | ✅ PASS |
| 12 | Nút `⋯` (khôi phục mặc định) mở modal xác nhận, Hủy đóng đúng, không thực thi khi hủy | ✅ PASS |
| 13 | TTD: cây rút gọn (không hiện Khối/Tầng lồng), chỉ hiện Khu | ✅ PASS |
| 14 | TTD với `market_staff`: có nút Sửa, không có nút Xóa/`⋯`, đúng theo quyền có sẵn | ✅ PASS |
| 15 | Chọn Khu TTD → panel phải hiện đúng dữ liệu thật của khu đó | ✅ PASS |
| 16 | Forged mutation: gọi trực tiếp `A.ACT['qh-del-zone']`/`'qh-reset'`/`'qh-del-zone-ok'` từ console với tài khoản không đủ quyền → không mở modal xác nhận, không xoá dữ liệu (khu vẫn còn sau `A.render()`) | ✅ PASS |
| 17 | `collector` (không có `cau-truc.edit`): 0 nút Sửa/Xóa/Thêm/`⋯` hiển thị, cây/tổng quan vẫn render bình thường | ✅ PASS |
| 18 | Quét toàn bộ 19 màn hình × 9 tài khoản demo (171 lượt render) — 0 exception ném ra, 0 lỗi console | ✅ PASS |
| 19 | Market-scope: mọi hành động vẫn giới hạn đúng theo `ui.market` qua `A.canDo(action, mid)` (không đổi so với trước) | ✅ PASS |
| 20 | `node --check js/v-cautruc.js` và `js/v-dieuhanh.js` | ✅ PASS |

## 10. Regression — các module khác

- Điểm kinh doanh (`diem-kd`) không bị đụng tới — vẫn là màn/route riêng biệt, dùng `A.stallPanel` chung không đổi logic.
- `js/core.js`, `js/permissions.js` không có thay đổi nào trong hotfix này (xác nhận qua `git diff`/`grep` — chỉ còn thay đổi từ 2 task trước đó, không liên quan hotfix).
- Quét 171 lượt render (9 tài khoản × 19 màn hình) không phát hiện lỗi console hay exception ở bất kỳ màn hình nào khác.

## 11. NEED_CONFIRMATION

- Không kiểm thử được ở độ rộng màn hình di động thật (`resize_window` của công cụ test không thay đổi `window.innerWidth` mà JS đọc được — hạn chế công cụ, đã gặp ở task trước). Đã rà soát logic/CSS responsive (`.mb-tree-toggle`, media query `max-width:860px`/`1180px`) bằng mắt và thấy đúng thiết kế, nhưng khuyến nghị người dùng tự kiểm tra trực quan trên thiết bị/di động thật trước khi coi là đã xác nhận đầy đủ.
- CSS không có công cụ syntax-check tương đương `node --check`; đã rà soát thủ công + xác nhận bằng screenshot thực tế render đúng.

## 12. Xác nhận theo yêu cầu

- `PERM_SEED_VERSION` changed? **NO**
- `RBAC_SCHEMA` changed? **NO**
- Permission `CATALOG` changed? **NO**
- Permission state reset? **NO**
- Account state reset? **NO**
- Business data reset? **NO**

## 13. Dừng

Hoàn tất hotfix theo đúng yêu cầu. Không thực hiện bước migration screen permission nào khác, không sửa RBAC, không redesign Điểm kinh doanh, không sửa module nào khác ngoài phạm vi trên (`js/v-cautruc.js`, `js/v-dieuhanh.js`, `styles.css`).
