# Refactor bố cục drawer chi tiết — màn "Điểm kinh doanh" (CL)

## 1. Files changed

**Chỉ 1 file:** `js/v-tieuthuong.js` — viết lại `dkDetailHtmlCL(st)` (bố cục mới, bỏ `drawer-f`), thêm `dkHistoryHtml(st)` + 8 handler mới (`dkcl-edit-open/save`, `dkcl-convert-open/save`, `dkcl-split-open/save`, `dkcl-merge-open/save`). Không đụng `js/v-dieuhanh.js`, `js/v-cautruc.js`, `js/permissions.js`, `js/core.js`, `styles.css`, `data.js`.

## 2. Drawer trước → sau

**Trước:** `<dl>` gộp Chợ/Khu vực/Tầng/Loại điểm/Diện tích/Ngành hàng, rồi khối "Người thuê" (3 dòng) + khối "Người bán thực tế" tách riêng, footer `drawer-f` gom **Hồ sơ / Tạo hợp đồng / Đổi trạng thái / Đóng**.

**Sau:** header (mã điểm + badge trạng thái + **"Chỉnh sửa thông tin"** + ×) → "Thông tin điểm kinh doanh" (7 trường + **[Tách điểm][Gộp điểm][Chuyển đổi điểm]** ngay dưới) → "Tình trạng sử dụng" (header có **"Xem hồ sơ tiểu thương"**) + 1 `<dl>` gộp Trạng thái/Người thuê/Người bán thực tế/Hợp đồng/Thời hạn → "Lịch sử thay đổi". **Không còn `drawer-f`.**

TTD: `A.stallPanel`/modal cũ không đổi 1 dòng — vẫn "Hồ sơ"/"Đổi trạng thái" ở footer như trước (đã kiểm chứng trên browser).

## 3. Vị trí mới của từng action

| Action | Vị trí cũ | Vị trí mới |
|---|---|---|
| Chỉnh sửa thông tin | *(chưa có)* | Header, ngang mã điểm/badge, trước nút × |
| Tách điểm / Gộp điểm / Chuyển đổi điểm | *(chưa có)* | Ngay dưới khối "Thông tin điểm kinh doanh", 1 hàng ngang, cùng style `btn sm` |
| Xem hồ sơ tiểu thương (đổi tên từ "Hồ sơ") | Footer | Ngang tiêu đề "Tình trạng sử dụng" |
| Đổi trạng thái | Footer | **Bỏ hẳn** khỏi drawer này |
| Tạo hợp đồng | Footer | **Bỏ hẳn** khỏi drawer này (xem mục 13 NEED_CONFIRMATION) |

Responsive: `<div class="drawer-h" style="flex-wrap:wrap">` (inline style riêng cho đúng 1 markup này, không sửa `.drawer-h` global) — nút "Chỉnh sửa thông tin" tự xuống dòng khi hẹp, không đè lên mã điểm/×; đã test thu nhỏ cửa sổ, không vỡ layout.

## 4. Permission key được reuse

- **`cau-truc.edit`** (đã có sẵn, dùng cho khối/tầng/khu ở Mặt bằng chợ) — tái dùng cho cả 4 action mới "Chỉnh sửa thông tin/Tách điểm/Gộp điểm/Chuyển đổi điểm", vì cùng bản chất "sửa cấu trúc/đặc tính mặt bằng". **Không tạo permission key mới**, không đổi CATALOG/`PERM_SEED_VERSION`/`RBAC_SCHEMA`.
- **`so-do.xem-ho-so`** (không đổi) — cho "Xem hồ sơ tiểu thương".
- Tất cả gọi qua `A.canDo(actionKey, st.market)` — `targetMarket` lấy từ **record điểm** (`st.market`), không dựa `ui.market`/hard-code role.

## 5. Handler-level permission check

Cả 8 handler mới đều re-check `A.canDo('cau-truc.edit', st.market)` ngay dòng đầu (cả `-open` lẫn `-save`) — không chỉ ẩn nút. Đã verify qua console: gọi thẳng `A.ACT['dkcl-edit-open']({dataset:{id:'CL-HS-A10'}})` với account không có `cau-truc.edit` → không mở modal, không đổi dữ liệu (xem mục 10 CASE 5/6).

## 6. MarketScope enforcement

`A.canDo` đã tự chặn khi `targetMarket !== ui.market` (bất kể role) — test bằng account `marketScopes:["TTD"]`, `selectedMarket=TTD`, gọi thẳng handler với stall CL → bị chặn hoàn toàn dù role đó có quyền tương đương ở TTD. Không hard-code "Trưởng BQL luôn được CL".

## 7. Xử lý điểm còn trống

Người thuê "Chưa có", Người bán thực tế "Chưa ghi nhận", Hợp đồng hiện hành "Chưa có hợp đồng hiệu lực" (ẩn dòng Thời hạn), nút **"Xem hồ sơ tiểu thương" ẨN HOÀN TOÀN** (không render, không disabled). Nhóm Tách/Gộp/Chuyển đổi vẫn hiện nếu có quyền (đây là thao tác trên chính điểm, không phụ thuộc có người thuê hay không).

## 8. Xử lý Người thuê ≠ Người bán thực tế

Tái dùng nguyên `dkSeller()`/`st.sellerId`/`st.traderId` đã chốt từ task trước — không đổi model. Hiển thị 2 dòng riêng biệt trong cùng 1 `<dl>`; nếu trùng thì thêm chú thích nhỏ "(người thuê trực tiếp kinh doanh)". "Xem hồ sơ tiểu thương" LUÔN mở đúng **người thuê** (`t.id`), không bao giờ mở người bán — đã verify KA-A05 (thuê Trần Thị Kim Nhung, bán Châu Thị Hạnh) mở đúng hồ sơ Trần Thị Kim Nhung.

## 9. Lịch sử thay đổi

Dùng nguyên field `st.history` (mảng string `"DD/MM/YYYY: mô tả"`, đã có sẵn từ `stall-status-save`/`ct-end-save`) — không đổi model, không giả dữ liệu (điểm chưa có sự kiện nào → "Chưa có lịch sử thay đổi."). "Chỉnh sửa thông tin" và "Chuyển đổi điểm" ghi entry THẬT khi lưu; "Tách điểm"/"Gộp điểm" ghi entry MINH HOẠ ý định thao tác (không restructure dữ liệu — xem mục 13).

## 10. Regression test results (browser thật)

- **CASE 1** (KA-A01, Đang thuê, thuê=bán): render đúng 100% theo mockup yêu cầu; "Chỉnh sửa thông tin" đổi diện tích 14,1→15,5 m² thành công + ghi lịch sử; "Chuyển đổi điểm" Ki-ốt→Quầy hàng thành công + ghi lịch sử + bảng danh sách cập nhật theo; "Tách điểm"/"Gộp điểm" ghi lịch sử minh hoạ, KHÔNG tạo/xoá điểm thật (bảng danh sách vẫn chỉ có KA-A01, không có KA-A01A/B); "Xem hồ sơ tiểu thương" mở đúng modal Ngô Văn Nam.
- **CASE 2** (KA-A05, thuê≠bán): "Trần Thị Kim Nhung · TT0004" vs "Châu Thị Hạnh" hiển thị tách biệt; "Xem hồ sơ tiểu thương" mở đúng **Trần Thị Kim Nhung** (người thuê), không phải người bán.
- **CASE 3** (KA-A13, Còn trống): Người thuê "Chưa có", Người bán "Chưa ghi nhận", Hợp đồng "Chưa có hợp đồng hiệu lực", **không có nút "Xem hồ sơ tiểu thương"**.
- **CASE 4** (HS-A10, Nợ phí): badge "Nợ phí" hiển thị rõ ở header + dòng Trạng thái; không có bất kỳ UI nào cho chọn trạng thái thủ công (đã bỏ hẳn "Đổi trạng thái").
- **CASE 5** (ward_leader — không có `cau-truc.edit`): ẩn hoàn toàn "Chỉnh sửa thông tin" + nhóm Tách/Gộp/Chuyển đổi (vẫn thấy "Xem hồ sơ tiểu thương" vì có `so-do.xem-ho-so`); gọi thẳng cả 4 handler `-open` qua console → không mở modal, dữ liệu không đổi.
- **CASE 6** (account `marketScopes:["TTD"]`, `selectedMarket=TTD`) gọi thẳng `dkcl-edit-open` với stall CL → bị chặn, dữ liệu CL không đổi.
- **CASE 7**: Điểm kinh doanh TTD — bảng + modal cũ nguyên vẹn (Hồ sơ/Đổi trạng thái vẫn còn).
- **CASE 8**: Mặt bằng chợ CL (drawer từ task trước) — không đổi; bấm "Xem điểm kinh doanh" từ đó điều hướng đúng sang drawer MỚI vừa refactor (tích hợp 2 task hoạt động đúng).
- Không có console error trong toàn bộ phiên test (kể cả sau reload).

## 11. TTD unaffected

Xác nhận qua diff (`git diff --stat` chỉ có `js/v-tieuthuong.js`, các thay đổi đều nằm trong nhánh `dkDetailHtmlCL`/handler mới `dkcl-*`, không đụng `dkRows`/`dkLine`/`dkViewGeneric`/`A.stallPanel`) và qua browser (mục 10, CASE 7).

## 12. Mặt bằng chợ unaffected

Không file nào của Mặt bằng chợ (`js/v-dieuhanh.js`, `js/v-cautruc.js`) nằm trong diff của phiên này. Xác nhận qua browser (mục 10, CASE 8) — drawer Mặt bằng chợ CL (task trước) và cả điều hướng chéo sang màn Điểm kinh doanh đều hoạt động đúng.

## 13. NEED_CONFIRMATION còn lại

- **"Tách điểm"/"Gộp điểm" chỉ là prototype interaction**, ghi 1 dòng lịch sử minh hoạ — **KHÔNG** thật sự tạo/xoá điểm trong `A.db.stalls`, không phân bổ lại `traderId`/`contractId`/hoá đơn. Lý do: hệ thống hiện tại chưa có nghiệp vụ này, và tự thiết kế đầy đủ (đặc biệt xử lý quan hệ trader/hợp đồng/hoá đơn đang khoá theo `stallId`) sẽ là "tạo database phức tạp" ngoài phạm vi cho phép. Nếu cần vận hành thật, cần thiết kế riêng (mã điểm mới, phân bổ diện tích, xử lý hợp đồng/công nợ hiện hành, có thể cần permission riêng thay vì dùng chung `cau-truc.edit`).
- **Đã chủ động bỏ "Tạo hợp đồng"** khỏi drawer này (không chỉ "Đổi trạng thái" như yêu cầu nêu rõ) — vì cấu trúc mục tiêu ở mục 13 của yêu cầu (HEADER → Thông tin điểm → Tách/Gộp/Chuyển đổi → Tình trạng sử dụng+Xem hồ sơ → Lịch sử) không có chỗ cho action này, và mục 7 yêu cầu không còn "bãi nút" nào khác. Điểm trống vẫn có thể tạo hợp đồng qua màn "Hợp đồng" (nút "+ Tạo hợp đồng" sẵn có, không đổi) — đây là quyết định giống hệt đã áp dụng ở task drawer Mặt bằng chợ trước đó (cùng chưa được xác nhận lại). Nếu muốn giữ "Tạo hợp đồng" ngay trong drawer này, cho biết vị trí mong muốn để bổ sung.
- Permission `cau-truc.edit` được tái dùng cho 4 action mới là một suy diễn hợp lý nhưng KHÔNG phải 1-1 với mô tả gốc của key này ("Thêm/sửa khối, tầng, khu, loại điểm; lưu nháp/chính thức" — vốn dành cho model LAYOUT quy hoạch ở Mặt bằng chợ, không phải `A.db.stalls` thật). Nếu về lâu dài muốn tách permission riêng cho nhóm "quản lý điểm kinh doanh thật" (khác với "quy hoạch mặt bằng"), cần 1 task riêng để thêm permission key mới (đã tránh làm trong task này theo đúng yêu cầu "không tạo permission key mới nếu chỉ là bố cục/reuse").
