# Refactor màn "Tiểu thương" — phạm vi Chợ Cao Lãnh (CL)

## 1. File đã sửa

**Chỉ 1 file:** `js/v-tieuthuong.js` — thêm bộ lọc + bảng danh sách CL mới (`ttViewCL`, `ttRowsCL`, `ttRowHtmlCL`, `ttSectionsOf`, `ttCatsOf`, `ttclHasFilter`, `ttSearchMatchCL`), thêm handler lọc (`ttcl-section`, `ttcl-cat`, `ttcl-app`, `ttcl-search`, `ttcl-clear`), viết lại drawer chi tiết CL (`ttDrawerHtmlCL` + `ttDocRow`, `ttPointCardHtml`, `ttOtherSellersOf`), thêm handler `tt-doc-view`, `tt-open-contract`, `tt-open-congno`, mở rộng `ttForm`/thêm `tt-edit-open`/`tt-edit-save`, branch `A.ACT.trader` theo `t.market === 'CL'`.

Logic TTD/generic giữ nguyên 100% dưới tên `ttViewGeneric()` (đổi tên, không đổi 1 dòng logic) và nhánh `else` cũ trong `A.ACT.trader`. **Không đụng** `js/permissions.js`, `js/v-taichinh.js`, `js/core.js`, `js/v-cautruc.js`, `js/v-dieuhanh.js`, `styles.css`, `data.js`.

## 2. Danh sách trước → sau (khi `selectedMarket = CL`)

**Trước:** dùng chung `ttRows()`/`A.VIEWS['tieu-thuong']` với TTD — chỉ có filter "Mini app" + ô tìm kiếm tên/SĐT/mã, không có lọc theo khu vực/ngành hàng.

**Sau (CL):** thanh lọc đúng thứ tự yêu cầu: `[Tất cả khu vực][Tất cả ngành hàng][Mini app: tất cả][Tên, SĐT, mã điểm KD][↺ Xóa bộ lọc][+ Thêm tiểu thương]`. Bảng 9 cột: Mã, Họ tên, Điện thoại, Địa chỉ, Ngành hàng, Điểm KD, Mini app, Công nợ, Thao tác — không có cột "Chợ", không có CCCD.

TTD: `ttViewGeneric()` không đổi — vẫn đủ filter Mini app + tìm kiếm cũ, đã verify trên browser.

## 3. Nguồn dữ liệu Khu vực / Ngành hàng (không thêm field mới)

Theo đúng yêu cầu **"không thêm field khu vực vào hồ sơ tiểu thương"**: `ttSectionsOf(t)`/`ttCatsOf(t)` suy ra Khu vực/Ngành hàng bằng cách đi qua `t.stalls[] → A.idx.stall.get(id) → st.section/st.cat` mỗi lần render — không lưu trữ, không cache, không duplicate dữ liệu. Quan hệ đúng chuỗi: TIỂU THƯƠNG → ĐIỂM KINH DOANH (qua `t.stalls`) → KHU VỰC + NGÀNH HÀNG.

Options của 2 dropdown filter được build động từ `A.db.stalls.filter(market CL)` (danh mục khu vực/ngành hàng thật đang tồn tại trong dữ liệu CL, không tạo catalog riêng).

## 4. Lọc kết hợp & chống trùng dòng

`ttRowsCL()` lọc `A.db.traders` bằng AND giữa 4 điều kiện (khu vực/ngành hàng/mini app/tìm kiếm) — mỗi tiểu thương chỉ xuất hiện **1 dòng duy nhất** dù có nhiều điểm khớp nhiều khu vực/ngành hàng khác nhau (vì filter là `Array.includes`, không `flatMap` nhân dòng). Cột "Điểm KD" nối các mã điểm bằng dấu phẩy (`ttRowHtmlCL`).

## 5. Tìm kiếm nhanh

`ttSearchMatchCL(t, q)` khớp: tên, SĐT, **mã tiểu thương**, **mã điểm KD** (qua `t.stalls`) — **không** khớp CCCD, đúng yêu cầu.

## 6. "↺ Xóa bộ lọc"

Label đúng chữ yêu cầu (không phải "Reset"). `ttclHasFilter()` kiểm tra có ít nhất 1 trong 4 điều kiện đang active để bật/tắt `disabled` trên nút. `ttcl-clear` chỉ reset `f.ttclSection/ttclCat/ttclApp/ttclSearch` + `ui.page.ttcl` — không đụng dữ liệu nghiệp vụ.

## 7. Drawer chi tiết — bố cục mới (A→E)

Chuyển từ MODAL 2 cột cũ (chỉ dùng cho TTD, giữ nguyên) sang DRAWER dọc mới cho CL, font/style tái dùng nguyên `.drawer`/`.drawer-h`/`.drawer-b`/`.plan-section`/`.kv`/`.tag` sẵn có trong `styles.css` — không tạo class mới, không thu nhỏ font.

- **A. Thông tin cá nhân/hộ kinh doanh** — Mã, Họ tên, Giới tính, Năm sinh, Điện thoại, **CCCD (masked qua `U.maskId`)**, Địa chỉ, Loại hộ KD, Ngày bắt đầu KD, Trạng thái Mini App.
- **B. Hồ sơ số hóa** — mỗi giấy tờ 1 dòng riêng dạng "Label … Đã có/Chưa có … [Xem]" (`ttDocRow`), không gộp badge. Chỉ render 2 loại giấy tờ có model thật hỗ trợ (xem mục 10 NEED_CONFIRMATION).
- **C. Điểm kinh doanh & hợp đồng** — mỗi điểm 1 `plan-section` (`ttPointCardHtml`): mã điểm, khu vực, ngành hàng, **hợp đồng hiện hành là link bấm được** (`tt-open-contract`) điều hướng sang đúng bản ghi ở màn Hợp đồng, thời hạn, người trực tiếp kinh doanh tại điểm. Không nhúng lại nội dung đầy đủ hợp đồng.
- **D. Người trực tiếp kinh doanh** — `ttOtherSellersOf(t)` liệt kê (dedup) những người bán khác với người thuê tại các điểm của họ; hiển thị tên/điện thoại/CCCD masked. Nếu seller trùng người thuê, không tách mục D riêng cho trường hợp đó (đã thể hiện ngay trong card điểm ở mục C bằng chú thích "(người thuê trực tiếp kinh doanh)"), tránh gợi ý seller có nghĩa vụ tài chính riêng.
- **E. Tóm tắt nghiệp vụ tài chính** — chỉ Công nợ hiện tại + số khoản chưa thanh toán (tính từ `A.db.invoices` thật) + nút **[Xem công nợ]** điều hướng sang màn Công nợ (`tt-open-congno`) — không liệt kê lịch sử hoá đơn/biên lai.

Header drawer: nút chính **"Chỉnh sửa thông tin tiểu thương"** (đúng chữ yêu cầu, không phải "Chỉnh sửa hồ sơ") + nút đóng `×`. Không có nút "Quản lý giấy tờ" gộp chung.

## 8. Permission được reuse

- **`tieu-thuong.them-moi`** (đã có sẵn, cấp cho `market_manager`, `market_staff`) — tái dùng cho cả hành động "Chỉnh sửa thông tin tiểu thương" (`tt-edit-open`/`tt-edit-save`), vì cùng bản chất "tạo/sửa hồ sơ tiểu thương". **Không tạo permission key mới**, không đổi `PERM_SEED_VERSION`/`RBAC_SCHEMA`/ma trận role.
- **`so-do.xem-ho-so`** — dùng cho nút "Xem" hồ sơ (đã có sẵn, không đổi).
- Toàn bộ gọi qua `A.canDo('tieu-thuong.them-moi', t.market)` — `targetMarket` lấy từ **record tiểu thương** (`t.market`), không dựa `ui.market`/hard-code role/tên tài khoản.

## 9. RBAC — kiểm tra ở cả 2 lớp

- `tt-edit-open` và `tt-edit-save` đều re-check `A.canDo('tieu-thuong.them-moi', t.market)` ngay dòng đầu (không chỉ ẩn nút) — verify qua console: gọi thẳng `A.ACT['tt-edit-open']({dataset:{id:'TT0001'}})` với account thiếu quyền → không mở modal, dữ liệu không đổi.
- MarketScope: test account `marketScopes:["TTD"]`, `selectedMarket=TTD`, gọi thẳng handler với trader CL → bị chặn hoàn toàn (không phụ thuộc "Trần Minh Khoa" hay bất kỳ tên tài khoản nào — không có so sánh `account.name`).
- Các thao tác đọc (lọc/tìm kiếm/mở drawer/xem giấy tờ) chỉ phụ thuộc quyền xem màn hình sẵn có (`U.can('tieu-thuong')`), không tạo permission mutation mới cho thao tác đọc.

## 10. Test đã chạy (browser thật, `python -m http.server 8834`)

1. `selectedMarket=CL` → màn hiển thị đúng danh sách CL với 4 filter đúng thứ tự.
2. Không filter nào active → hiển thị đủ toàn bộ tiểu thương CL.
3. Lọc riêng từng filter (khu vực / ngành hàng / mini app) → đúng kết quả.
4. Kết hợp nhiều filter (AND) → đúng giao tập kết quả.
5. Tiểu thương nhiều điểm thuộc nhiều khu vực/ngành hàng khớp filter → chỉ xuất hiện **1 dòng duy nhất**, cột Điểm KD nối đủ các mã điểm bằng dấu phẩy.
6. Tìm kiếm theo tên/SĐT/mã tiểu thương/mã điểm KD → đúng; xác nhận **không** khớp theo CCCD.
7. "↺ Xóa bộ lọc": disabled khi rỗng, active khi có filter, bấm xoá sạch cả 4 điều kiện + search, không đổi dữ liệu nghiệp vụ.
8. Mở drawer từ bảng → đủ 5 mục A–E đúng bố cục, font cỡ chữ bằng phần còn lại hệ thống (không có typography riêng).
9. Trader TT0004 (nhiều điểm, có điểm seller khác người thuê): mục C hiển thị đúng từng điểm, mục D liệt kê đúng seller khác (Châu Thị Hạnh) không trùng lặp.
10. Click link hợp đồng trong mục C → điều hướng đúng sang `#/hop-dong`, đúng tab/trạng thái, bảng lọc đúng đến hợp đồng vừa bấm (đã sửa bug thiếu `e.preventDefault()` — xem mục 11).
11. Nút "Xem" từng dòng giấy tờ → mở modal minh hoạ đúng, không giả nội dung tài liệu thật.
12. Nút "[Xem công nợ]" → điều hướng đúng sang `#/cong-no`.
13. "Chỉnh sửa thông tin tiểu thương" (account có quyền) → mở form đúng dữ liệu hiện tại, lưu thành công, cập nhật lại đúng dòng bảng + drawer.
14. Account thiếu `tieu-thuong.them-moi` → nút ẩn khỏi header drawer; gọi thẳng `tt-edit-open`/`tt-edit-save` qua console → bị chặn, không mở modal/không đổi dữ liệu.
15. Account `marketScopes` không gồm CL → không truy cập được dữ liệu CL qua handler dù gọi trực tiếp console.
16. TTD: danh sách + modal cũ (`ttViewGeneric`, `A.ACT.trader` nhánh else) không đổi — verify trên browser, không có filter khu vực/ngành hàng (đúng vì TTD không nằm trong phạm vi task).
17. Regression **Mặt bằng chợ** (CL): drawer điểm KD (`mbStallPanelCL`, task trước) mở đúng, 2 nút điều hướng "Xem hồ sơ tiểu thương"/"Xem điểm kinh doanh" hoạt động đúng, không bị ảnh hưởng bởi thay đổi trong `js/v-tieuthuong.js`.
18. Regression **Điểm kinh doanh** (CL): bảng danh mục + drawer chi tiết (`dkDetailHtmlCL`, cùng file `js/v-tieuthuong.js` nhưng khác hàm) vẫn hiển thị đầy đủ (Thông tin điểm, Tách/Gộp/Chuyển đổi, Tình trạng sử dụng, Lịch sử thay đổi) — không bị đè/xung đột bởi các hàm mới thêm trong task này.
19. Không có console error trong toàn bộ phiên test, kể cả sau hard reload (`ctrl+shift+r`) ở cả 2 màn Mặt bằng chợ và Điểm kinh doanh.
20. `node --check js/v-tieuthuong.js` — pass, không lỗi cú pháp (chạy lại 3 lần sau mỗi đợt sửa).
21. `git diff --check` — không có whitespace issue; `git diff --stat`/`git status` xác nhận đúng phạm vi file đã sửa trong phiên.

## 11. Lỗi phát hiện & đã sửa trong phiên

- **Bug điều hướng link hợp đồng**: `A.ACT['tt-open-contract']` ban đầu định nghĩa `el => {...}` (không nhận `e`), khiến hành vi mặc định của `<a href="#">` ghi đè hash `A.go('hop-dong')` vừa set (URL bị rơi về `#` trống thay vì `#/hop-dong`). Sửa thành `(el, e) => { if (e) e.preventDefault(); ... }` — đúng pattern đã dùng ở `A.ACT.trader`. Verify lại bằng hard reload + click: URL đúng `#/hop-dong`, bảng lọc đúng hợp đồng.
- **Tự sửa trước khi test**: logic `sellerLabel` trong `ttPointCardHtml` ban đầu viết theo quy ước cũ (ngầm định `!seller` → hiển thị như trùng người thuê), phát hiện không nhất quán với quy ước mới hơn đã chốt ở task trước (`mbStallSeller()`: `!seller` → "Chưa ghi nhận"). Đã sửa lại cho nhất quán trước khi đưa vào test.

## 12. TTD & các màn khác — không bị ảnh hưởng

- `git diff --stat` của phiên này chỉ đổi `js/v-tieuthuong.js`; nhánh CL (`ttViewCL`, `ttDrawerHtmlCL`, các handler `ttcl-*`/`tt-edit-*`/`tt-open-*`) tách biệt hoàn toàn khỏi nhánh generic/TTD (`ttViewGeneric`, nhánh else của `A.ACT.trader`).
- Đã verify trực tiếp trên browser: TTD Tiểu thương (danh sách + modal cũ), Mặt bằng chợ (cả CL và không CL), Điểm kinh doanh (CL) đều hoạt động đúng như trước khi có thay đổi của task này.
- Không đổi `js/permissions.js`, `PERM_SEED_VERSION`, `RBAC_SCHEMA`, `marketScopes`, `selectedMarket`, kiến trúc RBAC.

## 13. NEED_CONFIRMATION

- **Mục B (Hồ sơ số hóa)** chỉ render 2 loại giấy tờ có model thật hỗ trợ hiện tại (CCCD 2 mặt — luôn có; Giấy CN ĐKKD — chỉ khi `t.hkd`). Đã **bỏ qua** loại "Ảnh chân dung" vì không có field dữ liệu nào backing nó trong model tiểu thương hiện tại — tránh giả badge "Đã có" không có căn cứ. Nếu cần đủ 3 loại giấy tờ như một số hệ thống tương tự, cần bổ sung field mới vào model trước (nằm ngoài phạm vi "chỉ chỉnh sửa view" của task này).
- **Permission "Chỉnh sửa thông tin tiểu thương"** được tái dùng từ `tieu-thuong.them-moi` (permission gốc mô tả "Thêm tiểu thương mới") thay vì tạo permission `tieu-thuong.sua` riêng. Đây là suy diễn hợp lý (cùng nhóm nghiệp vụ hồ sơ tiểu thương) nhưng không phải 1-1 về mặt tên gọi. Nếu muốn tách quyền Thêm/Sửa riêng biệt (ví dụ 1 role được thêm nhưng không được sửa), cần 1 task riêng để bổ sung permission key mới theo đúng quy trình catalog/`PERM_SEED_VERSION`.
- Nút "[Xem công nợ]" chỉ điều hướng sang màn Công nợ (`#/cong-no`) ở cấp màn hình, không tự động lọc sẵn theo tiểu thương đang xem — vì màn Công nợ hiện tại (`js/v-taichinh.js`) chưa có cơ chế filter theo tên/mã tiểu thương, và việc thêm state lọc mới vào file đó nằm ngoài phạm vi cho phép của task này ("không refactor màn khác"). Nếu cần, có thể bổ sung 1 state filter nhỏ ở `js/v-taichinh.js` trong task riêng.

Không phát hiện gap nào khác cần xác nhận thêm.
