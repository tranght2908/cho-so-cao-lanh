# Refactor màn "Điểm kinh doanh" — Chợ Cao Lãnh

## 1. Files changed

- `data.js` — thêm `D.POINT_TYPE` (catalog 4 loại điểm), khai báo `pointType` RÕ RÀNG trên từng section CL (MARKETS), lan truyền `pointType` vào stall khi `build()`, thêm relationship `sellerId` (người bán thực tế) + mock data demo. Bump `VERSION` 6 → 7 (chỉ data version, KHÔNG đụng RBAC_SCHEMA/PERM_SEED_VERSION).
- `js/v-tieuthuong.js` — viết lại hoàn toàn phần "Điểm kinh doanh" cho `selectedMarket = CL`: bảng, filter, search kết hợp, drawer xem nhanh. Giữ nguyên 100% bảng tổng quát cũ cho TTD/market khác (đổi tên nội bộ thành `dkViewGeneric()`, không đổi logic).
- (`js/v-cautruc.js`, `js/v-dieuhanh.js`, `styles.css` trong diff hiện tại là phần việc **Mặt bằng chợ** của phiên trước, chưa commit — không đụng thêm trong task này.)

## 2. UI trước → sau

**Trước:** bảng chung cho mọi chợ — cột Mã điểm/Chợ/Khu vực/Loại (kiot/nhalong/ngoai)/DT/Đơn giá/Giá tháng/Tiểu thương/Trạng thái; click mở **modal** dùng chung `A.stallPanel` (có cả hồ sơ, hợp đồng, công nợ, nút Thu tiền).

**Sau (CL):** bảng chuyên biệt — cột Mã điểm/Khu vực/Loại điểm (Quầy hàng/Sạp hàng/Ki-ốt/Cửa hàng)/DT/Ngành hàng/**Người thuê**/**Người bán thực tế**/Trạng thái/Thao tác; không còn Chợ/Đơn giá/Giá tháng/công nợ. Filter thêm "Loại điểm", search mở rộng theo cả người bán. Click mở **drawer bên phải** riêng (4 nhóm: nhận diện, vị trí/đặc tính, người thuê, người bán thực tế), không có dữ liệu tài chính.

TTD: không đổi gì (vẫn modal + bảng cũ).

## 3. Nguồn dữ liệu BusinessPoint đang dùng

`A.db.stalls` (không tạo entity mới) — lọc `U.inM(s)` (đúng `selectedMarket`), reindex qua `A.idx.stall`. Người thuê/người bán resolve qua `A.idx.trader` (cùng 1 entity `traders`, không entity riêng).

## 4. Mapping 4 loại điểm

GAP đã báo và được xác nhận trước khi code (field `type` cũ dùng tính đơn giá QĐ 480, không đủ để suy ra 4 loại). Giải pháp: field `pointType` MỚI, **khai báo rõ ràng theo từng khu vực (section) trong `MARKETS`**, không suy đoán từ `cat`/ngành hàng:

| Khu vực (section id) | pointType | Nhãn |
|---|---|---|
| KA, KB (Ki-ốt) | kiot | Ki-ốt |
| HS, TG, RC, LT, AU | sap | Sạp hàng |
| BH, MM, DV | cuahang | Cửa hàng |
| TS | quay | Quầy hàng |

Kết quả build: CL 288 điểm — Ki-ốt 36 · Sạp hàng 140 · Cửa hàng 82 · Quầy hàng 30 (đủ cả 4 loại). `type`/`cat` giữ nguyên, không đổi ý nghĩa/giá trị, không dùng trong logic tính đơn giá nào khác ngoài chỗ cũ đã dùng.

## 5. Mapping 5 trạng thái hiển thị

Không cần thêm gì — `stall.status` hiện có đúng 5 giá trị (`thue/trong/ngung/no/tranhchap`) khớp UI Mặt bằng chợ, dùng lại nguyên `D.STATUS` + `U.statusTag()` (cùng màu, cùng convention, không tạo hệ màu mới).

## 6. Cách resolve Người thuê

`stall.traderId` (không đổi) → `A.idx.trader.get(traderId)`. Đây vẫn là chủ thể duy nhất gắn hợp đồng/nghĩa vụ tài chính với BQL — không đổi ở bất kỳ đâu.

## 7. Cách resolve Người bán thực tế

GAP đã báo và xác nhận riêng: thêm `stall.sellerId` — THAM CHIẾU ID tới đúng entity `traders` hiện có (không entity mới, không duplicate tên bằng text). Hàm `dkSeller(s)`: nếu có `sellerId` → trader đó; nếu không → cùng người với `traderId`; điểm trống → `null`. `sellerId` **không** được đọc ở bất kỳ logic hợp đồng/khoản phải thu/thu tiền/công nợ/đối soát/tính phí/đơn giá nào — đã kiểm tra không có chỗ nào khác trong code đọc field này.

Mock data CL: 254 điểm có người thuê → mặc định `sellerId = traderId` (247 điểm), 7 điểm minh hoạ người bán khác người thuê (gồm 1 trường hợp 1 người thuê 2 điểm nhưng người bán từng điểm khác nhau — trader "Lê Thị Diễm" tại HS-B11/HS-B12). Điểm trống giữ `sellerId = null`, không gán giả.

## 8. Filter/search đã implement

- Khu vực: lấy từ `D.MARKETS` (CL) thật, không hard-code.
- Loại điểm: 4 lựa chọn từ `D.POINT_TYPE`.
- Trạng thái: 5 lựa chọn từ `D.STATUS`.
- Search: mã điểm / tên người thuê / tên người bán thực tế.
- Tất cả kết hợp được trong 1 `.filter()` (AND), search áp dụng trên tập đã lọc — đã test nhiều tổ hợp (khu vực+trạng thái, khu vực+search khớp cả người thuê lẫn người bán).
- State filter dùng key riêng (`f.dkcl*`, `ui.page.dkcl`) — tách biệt hoàn toàn với `f.dk*`/`ui.page.dk` của bảng TTD cũ để tránh xung đột định dạng giá trị khi đổi market.

## 9. Permission/RBAC được reuse

- Screen permission: `screen:diem-kd` — không đổi.
- Action trong drawer: `so-do.xem-ho-so` (nút Hồ sơ → action `trader` có sẵn), `so-do.tao-hop-dong`/`hop-dong.tao` (nút Tạo hợp đồng → action `ct-new` có sẵn), `so-do.doi-trang-thai` (nút Đổi trạng thái → action `stall-status` có sẵn). Không thêm action mới (không Thu tiền/Nhắc nợ/Miễn giảm/Ghi điện nước/Đối soát).
- Tất cả gọi qua `A.canDo(...)` y hệt cách `A.stallPanel` đã làm — không hard-code role, không hard-code `selectedMarket === 'CL'` để cấp quyền.

## 10. Xác nhận không đổi permission key

Đúng — không thêm/xoá/đổi tên bất kỳ `screen:*`/`action:*` nào trong `js/permissions.js` (file này không nằm trong diff).

## 11. Xác nhận không đổi PERM_SEED_VERSION/RBAC_SCHEMA

Đúng — cả hai hằng số giữ nguyên (`js/permissions.js`, `js/core.js` không đổi). Chỉ bump `D.VERSION` (data.js, 6→7) để mock dataset cũ trong localStorage tự rebuild với `pointType`/`sellerId` mới — cơ chế này độc lập, đã dùng nhiều lần trước đây trong project.

## 12. Regression tests (đã chạy trên browser thật)

- CL: danh sách chỉ hiển thị 288 điểm CL, đủ 9 cột, đủ 4 loại điểm/5 trạng thái trong dropdown.
- Filter khu vực (Khu thủy hải sản) + trạng thái (Còn trống) kết hợp đúng (4 điểm, không dữ liệu giả).
- Search "Ngọc Tuyết" trên tập đã lọc theo khu vực → đúng 3 kết quả (khớp cả tên người thuê lẫn người bán).
- Reset filter (xoá search + khu vực về "Tất cả") → trả lại đủ danh sách.
- Drawer: điểm thuê (người thuê = người bán) → tag "Người thuê trực tiếp kinh doanh"; điểm người thuê ≠ người bán → hiển thị đúng 2 người riêng biệt; điểm trống → "Chưa có thông tin"/"Điểm đang còn trống", không tạo dữ liệu giả.
- RBAC: `market_manager` (Trần Minh Khoa) thấy đủ Tạo hợp đồng/Đổi trạng thái; `ward_leader` (Nguyễn Văn Phúc) chỉ thấy Hồ sơ, không thấy 2 nút kia; `technician` (Võ Hoàng Tuấn) không có "Điểm kinh doanh" trong menu, và gõ thẳng `#/diem-kd` bị chặn, tự chuyển về màn đầu tiên có quyền (`mat-bang`).
- Market scope: chuyển account/market không làm lộ dữ liệu chéo CL/TTD; TTD vẫn dùng đúng bảng cũ, không bị ảnh hưởng.
- Regression: Mặt bằng chợ, Hợp đồng (254 hiệu lực, dữ liệu tiểu thương/điểm không đổi), Khoản phải thu (246 khoản CL / 36 khoản TTD), Tiểu thương (TT0004 vẫn đúng 2 điểm KA-A04/KA-A05) — không phát hiện sai lệch.
- Không có console error trong toàn bộ phiên test.

## 12b. "Xóa bộ lọc" (bổ sung sau — hotfix UX nhỏ, cùng file `js/v-tieuthuong.js`)

**Mục tiêu:** thêm 1 nút xóa toàn bộ điều kiện lọc/tìm kiếm hiện tại của màn Điểm kinh doanh CL, quay lại danh sách đầy đủ, không cần mở từng dropdown để tự trả về mặc định.

**Vị trí:** giữa ô Tìm kiếm và nút "⬇ Xuất Excel" (đúng thứ tự yêu cầu: Khu vực → Loại điểm → Trạng thái → Tìm kiếm → **↺ Xóa bộ lọc** → Xuất Excel). Style: `class="btn"` (secondary/outline có sẵn — không phải `.primary`/`.danger`), cùng chiều cao/font-size với các control khác trong thanh, tận dụng `.btn:disabled` có sẵn (opacity .5) cho trạng thái không thể bấm — không thêm CSS mới.

**State được reset** (đúng 4 key filter hiện có của CL, không tạo state song song):
- `f.dkclSection` → `''` (Tất cả khu vực)
- `f.dkclType` → `''` (Tất cả loại điểm)
- `f.dkclStatus` → `''` (Mọi trạng thái)
- `f.dkclSearch` → `''` (rỗng)
- `ui.page.dkcl` → `0` (page 1)

Sau đó gọi `A.render()` — render lại qua ĐÚNG pipeline `dkRowsCL()`/`dkViewCL()` sẵn có, không viết pipeline lọc thứ hai.

**Enable/disable:** hàm `dkclHasFilter()` — enabled nếu ít nhất 1 trong 4 filter khác mặc định (search dùng `.trim()` để khoảng trắng không tính là "có lọc"); mặc định (chưa chọn gì) → disabled. Sau khi bấm và reset xong → tự động disabled trở lại (vì tất cả filter đã về `''`).

**Không đổi:** data model, `pointType`, `sellerId`, `traderId`, mock data, logic hợp đồng/khoản phải thu/thu tiền/công nợ/đối soát, Mặt bằng chợ, RBAC/permission key/`PERM_SEED_VERSION`/`RBAC_SCHEMA`/`D.VERSION`. Không gọi `A.resetAll()` hay bất kỳ hàm reset dữ liệu/demo nào — chỉ gán lại 4 biến UI state kể trên.

**RBAC:** không thêm action permission nào (`action:diem-kd.reset` KHÔNG được tạo). Handler `dkcl-clear` không gọi `A.canDo(...)` vì đây thuần là UI filter state, không phải nghiệp vụ — bất kỳ account nào đã qua `screen:diem-kd` đều dùng được, đúng yêu cầu.

**Kết quả test trên browser thật:**
- Mặc định (chưa chọn gì): nút hiển thị mờ, disabled.
- Chọn Khu vực + Loại điểm + Trạng thái (Khu may mặc, giày dép / Cửa hàng / Nợ phí): danh sách lọc đúng, nút enabled; bấm nút → cả 3 dropdown về mặc định, danh sách về đủ 288 điểm (`1–25 / 288`), nút disabled trở lại.
- Chỉ nhập search (kể cả khi 0 kết quả khớp): nút vẫn enabled; bấm → search rỗng, danh sách đầy đủ, page về 1.
- Bật cả 4 filter đồng thời (Khu thủy hải sản / Sạp hàng / Đang thuê / search "HS") rồi mở drawer 1 điểm (HS-A02) — drawer vẫn hoạt động đúng (nhận diện, vị trí/loại điểm/ngành hàng, người thuê, "Người thuê trực tiếp kinh doanh", nút Hồ sơ theo permission) trước khi bấm Xóa bộ lọc — không regression.
- Test page-reset cô lập: lọc Loại điểm = Sạp hàng (140 kết quả) → bấm "Sau" sang trang 2 (`26–50/140`, KHÔNG qua dropdown nào) → bấm thẳng "Xóa bộ lọc" → về `1–25/288` — xác nhận chính handler `dkcl-clear` (không phải side-effect của handler khác) đưa page về 1.
- RBAC: `market_manager` (Trần Minh Khoa) và `ward_leader` (Nguyễn Văn Phúc) đều lọc/tìm kiếm/Xóa bộ lọc được bình thường.
- TTD: mở lại màn Điểm kinh doanh ở Chợ quê TTĐ — vẫn đúng bảng cũ (Chợ/Đơn giá/Giá tháng/Tiểu thương, placeholder "Mã điểm / tiểu thương"), không có nút "Xóa bộ lọc", không bị ảnh hưởng.
- Không có console error trong toàn bộ phiên test (kể cả sau khi reload lại trang).

## 13. NEED_CONFIRMATION còn lại

Không còn — 2 GAP (loại điểm, người bán thực tế) đã được báo cáo và xác nhận hướng xử lý trước khi code, đã implement đúng theo các ràng buộc đã thống nhất.

---

**Git:**
```
git diff --stat
 data.js            |  77 +++++++++++++++++++++++++------
 js/v-cautruc.js    |  90 +++++++++++++++++++++++++++++-------
 js/v-dieuhanh.js   | 132 ++++++++++++++++++++++++++++++++++++++++-------------
 js/v-tieuthuong.js | 125 ++++++++++++++++++++++++++++++++++++++++++++++++--
 styles.css         |  34 ++++++++++++--
 5 files changed, 389 insertions(+), 69 deletions(-)
```
(`v-cautruc.js`/`v-dieuhanh.js`/`styles.css` là phần việc Mặt bằng chợ của phiên trước, chưa commit từ trước — không đụng thêm trong task này.)

KHÔNG COMMIT. KHÔNG PUSH.
