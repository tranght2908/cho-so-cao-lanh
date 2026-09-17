# Nâng cấp UX drill-down nhiều cấp — Mặt bằng chợ

## 1. Files changed

Đúng phạm vi cho phép, không đụng `core.js`/`permissions.js` (không cần thiết — không đổi permission key/schema/routing):

- `js/v-cautruc.js` — cây cấu trúc: mọi node (Tổng quan/Khối/Tầng/Khu) chọn được, breadcrumb, vùng nội dung bên phải render đúng cấp.
- `js/v-dieuhanh.js` — các hàm render nội dung theo cấp (`A.mbOverviewHtml`, `A.mbBlockHtml`, `A.mbFloorHtml` mới; `A.mbZoneDiagramHtml` giữ nguyên hành vi) dùng dữ liệu thật từ `A.db.stalls`/`D.MARKETS`.
- `styles.css` — style cho breadcrumb, node/label click được, card Tổng quan/Khối theo tầng, chip khu, và các khu trong 1 tầng (`.plan-section` đã có sẵn, chỉ dùng lại).

Không sửa `js/core.js`, `js/permissions.js`, `js/accounts.js` — không cần thiết, không có thay đổi permission/schema/routing nào.

## 2. UI hierarchy sau sửa

Cùng 1 workspace `#/mat-bang` (không thêm screen/sidebar menu mới), state điều hướng `ui.mb.sel` (thuần UI, không persist):

```
null                  → Tổng quan (toàn chợ)
{k:'block', id}        → Khối/Nhà chợ
{k:'floor', id}        → Tầng
{k:'zone',  id}        → Điểm kinh doanh (Khu → grid điểm)
```

Mọi node trên cây cấu trúc bên trái (Tổng quan/Khối/Tầng/Khu) đều click được để xem — tách bạch hoàn toàn với nút caret (▼/▶, chỉ thu gọn/mở rộng cây) và với action Thêm/Sửa/Xóa (permission-gated riêng, không đổi).

Chợ chỉ có 1 khối + 1 tầng (Chợ quê TTĐ) tự gộp Khối+Tầng thành 1 hàng chọn được trong cây (logic gộp `mbFlatMode()` đã có từ trước, tái dùng cho cả breadcrumb để không lặp 2 cấp trùng nhau).

## 3. Behavior từng cấp

- **Tổng quan** (`A.mbOverviewHtml`): 1 card/khối, mỗi khối liệt kê từng tầng (số điểm KD + breakdown trạng thái + chip từng khu kèm số điểm). Click tiêu đề khối → Khối; click hàng tầng → Tầng; click chip khu → Khu. Không lặp lại dashboard lớn — số liệu tối thiểu (tổng/thuê/trống/nợ/ngừng/tranh chấp) đã có sẵn ở thanh tổng hợp phía trên workspace (không đổi).
- **Khối** (`A.mbBlockHtml`): tên khối + tổng điểm KD, chia theo từng tầng (cùng layout với Tổng quan nhưng chỉ trong phạm vi khối đó).
- **Tầng** (`A.mbFloorHtml`) — trọng tâm yêu cầu: sơ đồ TOÀN BỘ điểm KD của TẤT CẢ khu thuộc tầng, mỗi khu là 1 `.plan-section` riêng biệt (không trộn chung 1 grid), giữ nguyên màu trạng thái hiện tại. Click tên khu → Khu.
- **Khu** (`A.mbZoneDiagramHtml`, KHÔNG đổi logic): giữ nguyên legend lọc trạng thái, tìm kiếm, grid đầy đủ, nút "Sửa thông tin khu" theo đúng permission.
- **Điểm KD**: click ô → drawer `A.stallPanel` như cũ (Hồ sơ/Tạo hợp đồng/Đổi trạng thái theo `so-do.*`), không đổi.

## 4. Permission keys tái sử dụng (không đổi 1 key nào)

- `cau-truc.edit` / `cau-truc.delete` / `cau-truc.reset` — action Thêm/Sửa/Xóa khối/tầng/khu trên cây.
- `so-do.xem-ho-so` / `so-do.tao-hop-dong` / `so-do.doi-trang-thai` — action trong drawer điểm KD (`A.stallPanel`), dùng chung với "Điểm kinh doanh".
- Screen permission `mat-bang` — không đổi, vẫn 1 route duy nhất.

Điều hướng xem (click Tổng quan/Khối/Tầng/Khu) **không** gọi `A.canDo(...)` — đúng yêu cầu mục 13 (view khác edit): người chỉ có screen permission `mat-bang` drill-down được toàn bộ, không thấy bất kỳ nút Thêm/Sửa/Xóa nào nếu thiếu action permission tương ứng.

## 5. Handler-level permission guards

Không đổi handler nào — toàn bộ 26 handler `qh-*` (thêm/sửa/xóa khối/tầng/khu/loại điểm) vẫn re-check `A.canDo('cau-truc.edit'|'cau-truc.delete'|'cau-truc.reset', qhMarket())` ngay đầu handler, trước khi ghi `LAYOUT`. UI chỉ ẩn nút — mutation thật vẫn bị chặn ở handler nếu gọi trực tiếp (đã kiểm tra qua test RBAC bên dưới).

## 6. MarketScope enforcement

Không đổi: mọi dữ liệu vẫn lọc theo `qhMarket()` (= `ui.market`, luôn nằm trong `account.marketScopes` nhờ `A.syncAccountContext()` có sẵn). Chuyển `selectedMarket` khiến `ui.mb.sel` cũ (thuộc market trước) tự "heal" về Tổng quan ngay trong `mbRightHtml` (zone/floor/block không tìm thấy trong `LAYOUT[mid]` mới → `ui.mb.sel = null`) — không vỡ trang, không lộ dữ liệu chợ khác.

## 7. Derived data — không persist thêm field nào

Toàn bộ số liệu mới (tổng điểm KD theo khối/tầng/khu, breakdown trạng thái, breadcrumb) đều tính runtime từ `A.db.stalls` + `LAYOUT` ngay lúc render (`mbZoneStalls`, `mbStatusLine`, `mbCrumbsFor*`) — không thêm field nào vào `LAYOUT`/`A.db`, không đổi `localStorage` schema (`choso-caolanh-layout`, `choso-caolanh-state` không đổi shape).

## 8. Test — Chợ Cao Lãnh (đã chạy trên browser thật)

- Tổng quan → card "Nhà chợ chính" hiện đủ Tầng 1/Tầng 2/Ngoài nhà lồng + chip từng khu.
- Click "Nhà chợ chính" → Khối: 288 điểm KD, chia đúng Tầng 1 (140đ)/Tầng 2 (118đ)/Ngoài nhà lồng (30đ), breadcrumb "Chợ Cao Lãnh › Nhà chợ chính".
- Click "Tầng 1" → Tầng: 140 điểm KD, 5 khu (Ki-ốt mặt tiền/Thủy hải sản/Thịt gia cầm/Rau củ/Lương thực) mỗi khu 1 section riêng với grid đủ ô màu trạng thái, breadcrumb "Chợ Cao Lãnh › Nhà chợ chính › Tầng 1".
- Click "Khu thủy hải sản" → Khu: legend + tìm kiếm + grid đầy đủ, breadcrumb 4 cấp, nút "Sửa thông tin khu" hiện đúng theo quyền.
- Click 1 ô điểm → drawer chi tiết mở đúng (mã, trạng thái, tiểu thương, hợp đồng, công nợ, nút Thu tiền/Hồ sơ/Đổi trạng thái).
- Click "Chợ Cao Lãnh" trên breadcrumb → về Tổng quan.

## 9. Test — Chợ quê TTĐ

- Tổng quan (account Huỳnh Thanh Tâm, market_staff, chỉ scope TTD): 36 điểm KD, 33 thuê, 3 nợ phí — đúng dữ liệu TTĐ, không lẫn CL.
- Cây gộp Khối+Tầng thành 1 hàng "KHU CHỢ QUÊ" (đúng `mbFlatMode`), click vào → view Tầng, breadcrumb rút gọn còn 2 cấp "Chợ quê Cù lao Tân Thuận Đông › Khu chợ quê" (không lặp Khối=Tầng trùng tên).
- Cả 3 khu (Ẩm thực dân dã/Nông sản đặc sản/Trải nghiệm) hiện đủ trong 1 view Tầng, mỗi khu 1 section riêng.
- Tài khoản Huỳnh Thanh Tâm (market_staff, có `cau-truc.edit`, KHÔNG có `cau-truc.delete`): vẫn thấy "+ Khối/Nhà chợ", "+ Khu", "Sửa", nhưng KHÔNG thấy bất kỳ nút "Xóa" nào ở cây — đúng ma trận mặc định (chi tiết ở mục 10).

## 10. RBAC regression

- **Trần Minh Khoa (market_manager, đủ quyền)**: thấy đủ "+ Khối/Nhà chợ", "+ Tầng", "+ Khu", "Sửa", "Xóa", "⋯ Khôi phục cấu trúc mặc định" ở mọi cấp; drill-down bình thường.
- **Huỳnh Thanh Tâm (market_staff, có `cau-truc.edit`, KHÔNG có `cau-truc.delete`)**: thấy "+ Khu"/"Sửa" nhưng không thấy bất kỳ nút "Xóa" nào (khối/tầng/khu) — đúng least-privilege.
- **Nguyễn Văn Phúc (ward_leader, chỉ xem — không có `cau-truc.*` nào)**: drill-down đầy đủ Tổng quan → Khối/Tầng (gộp) → Khu, nhưng KHÔNG thấy bất kỳ nút "+ Khối/Nhà chợ"/"+ Khu"/"Sửa"/"Xóa" nào ở bất kỳ cấp nào — đúng mục 13 (view khác edit, xem không cần `cau-truc.edit`).
- Handler `qh-*` vẫn re-check `A.canDo` ngay đầu — gọi trực tiếp (không qua UI) vẫn bị chặn, không có đường vòng.
- `so-do.xem-ho-so`/`so-do.tao-hop-dong`/`so-do.doi-trang-thai`: không đổi, đã test qua drawer điểm KD (nút Hồ sơ/Tạo hợp đồng/Đổi trạng thái hiện đúng theo quyền, xem `A.stallPanel` không đổi).

## 11. Market scope

- Account chỉ CL (Trần Minh Khoa): không có nút chọn TTĐ.
- Account chỉ TTD (Huỳnh Thanh Tâm): không có nút chọn CL, chỉ thao tác được TTĐ.
- Account CL+TTD (Nguyễn Văn Phúc, ward_leader, scope ALL): chuyển market CL ↔ TTĐ — dữ liệu, cây, view đổi đúng theo từng chợ; selection cũ (đang xem 1 khu/tầng của TTĐ) tự "heal" về Tổng quan khi đổi sang CL, không lộ hoặc vỡ dữ liệu.

## 12. Browser/console result

Đã chạy qua Chrome thật (server tĩnh cục bộ, KHÔNG deploy/publish): drill-down 4 cấp cả CL lẫn TTĐ, chuyển account, chuyển market, mở drawer điểm KD, mở màn "Cài đặt & phân quyền" (system_admin) — **không có console error/exception** ở bất kỳ bước nào (`read_console_messages` với `onlyErrors:true` → rỗng qua toàn bộ phiên test).

## 13. NEED_CONFIRMATION

Không có mục nào cần dừng lại xin xác nhận — không phát sinh yêu cầu đổi permission architecture/migration/schema. Toàn bộ thay đổi nằm trong phạm vi UX/render, tái sử dụng đúng permission engine và model dữ liệu hiện có.

## 14. Git

Không commit, không push theo đúng yêu cầu. `git diff --check` sạch (không lỗi whitespace).

```
git diff --stat
 js/v-cautruc.js  |  90 ++++++++++++++++++++++++++++++++--------
 js/v-dieuhanh.js | 123 ++++++++++++++++++++++++++++++++++++++++---------------
 styles.css       |  25 ++++++++++-
 3 files changed, 187 insertions(+), 51 deletions(-)

git status
	modified:   js/v-cautruc.js
	modified:   js/v-dieuhanh.js
	modified:   styles.css
```
