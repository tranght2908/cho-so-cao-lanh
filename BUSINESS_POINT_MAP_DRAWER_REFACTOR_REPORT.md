# Refactor drawer điểm KD — Mặt bằng chợ Cao Lãnh

## 1. File đã sửa

**Chỉ 1 file:** `js/v-dieuhanh.js` — thêm 3 hàm mới (`mbStallPointTypeLabel`, `mbStallSeller`, `mbStallPanelCL`), sửa handler `stall` (branch theo `st.market`), thêm 2 handler điều hướng (`mb-open-trader`, `mb-open-diemkd`). Không đổi `A.stallPanel` (giữ nguyên 100%, vẫn dùng cho Mặt bằng chợ quê TTĐ + fallback màn "Điểm kinh doanh" TTD).

Không đụng: `js/v-cautruc.js` (cây cấu trúc/drill-down), `js/v-tieuthuong.js` (màn Điểm kinh doanh/Tiểu thương/Hợp đồng — chỉ GỌI LẠI các action đã có `A.ACT.trader`, `A.ACT['dk-open']`, không sửa 1 dòng nào ở đó), `styles.css`, `data.js`, `js/permissions.js`, `js/core.js`.

## 2. Drawer trước → sau (khi click điểm CL trên Mặt bằng chợ)

**Trước:** dùng chung `A.stallPanel` với TTD — 1 khối `<dl>` gộp Ngành hàng/Loại/Diện tích/Đơn giá/Giá dịch vụ tháng, rồi 1 khối "Tiểu thương" gộp chung người thuê=người bán, hợp đồng, công nợ (số tiền + số kỳ); action: 💳 Thu tiền, Hồ sơ (mở modal lớn), Tạo hợp đồng, **Đổi trạng thái**.

**Sau (CL):** 4 nhóm tách bạch đúng theo yêu cầu:
- **A. Thông tin điểm** — Loại điểm, Diện tích, Ngành hàng, Đơn giá áp dụng.
- **B. Thông tin sử dụng** — Người thuê, **Người bán thực tế** (tách riêng), Điện thoại.
- **C. Hợp đồng hiện hành** — Số hợp đồng, Thời hạn + còn X ngày, Trạng thái (hoặc "Chưa có hợp đồng hiệu lực").
- **D. Công nợ** — badge nhanh (Không nợ / Nợ phí + số tiền), không liệt kê nhiều kỳ/lịch sử/biên lai.
- Action: **"Xem hồ sơ tiểu thương"** (điều hướng, thay cho "Hồ sơ" mở modal tại chỗ) + **"Xem điểm kinh doanh"** (mới). **Bỏ hẳn "Đổi trạng thái", "Thu tiền", "Tạo hợp đồng"** khỏi drawer này.

TTD: không đổi gì (vẫn `A.stallPanel` y nguyên, đủ Thu tiền/Hồ sơ/Tạo hợp đồng/Đổi trạng thái).

## 3. Field giữ / field bỏ

**Giữ (tái sử dụng nguyên field/helper có sẵn):** `st.pointType` + `D.POINT_TYPE` (đã có từ task trước), `st.area`, `st.cat`, `U.unitLabel(st)` (đơn giá), `st.traderId`→`A.idx.trader`, `st.sellerId`, `st.contractId`→`A.idx.contract`, `U.maskPhone`, `U.dmy`, `U.days`, `A.db.invoices` (để tính công nợ, giống cách `A.stallPanel` cũ đã tính, chỉ hiển thị gọn hơn).

**Bỏ khỏi drawer này:** Giá dịch vụ/tháng, danh sách khoản phải thu nhiều kỳ, số kỳ nợ, Mini app, lịch sử thay đổi trạng thái, nút Thu tiền/Tạo hợp đồng/Đổi trạng thái. Không xoá field/handler/permission ở nguồn — chỉ không render trong panel CL mới.

## 4. Xử lý 5 trạng thái

Không dựa vào `st.status` để suy diễn có/không có người thuê — luôn đọc trực tiếp `st.traderId`/`st.contractId`/hoá đơn thật, hiển thị đúng những gì tồn tại:
- **Còn trống:** Người thuê "Chưa có", Người bán thực tế "Chưa ghi nhận", Hợp đồng "Chưa có hợp đồng hiệu lực", Công nợ "Không có nghĩa vụ hiện tại" — không tạo dữ liệu giả.
- **Đang thuê / Nợ phí / Tạm ngừng / Đang tranh chấp:** đều hiển thị đúng người thuê/hợp đồng/công nợ hiện có nếu tồn tại — không tự xoá dữ liệu chỉ vì trạng thái hiển thị khác nhau. Công nợ (mục D) tính từ hoá đơn `A.db.invoices` thật (độc lập với label trạng thái điểm), nên "Tạm ngừng"/"Đang tranh chấp" vẫn hiển thị đúng nợ nếu có.

Đã test đủ cả 5 trạng thái trên browser thật (xem mục 8).

## 5. Người thuê / Người bán thực tế

- Người thuê = `st.traderId` → `A.idx.trader`. Nghĩa vụ tài chính (công nợ, hồ sơ mở ra khi bấm "Xem hồ sơ tiểu thương") LUÔN gắn với người này, không đổi.
- Người bán thực tế = `st.sellerId` → `A.idx.trader` (model đã chốt từ task trước, KHÔNG đổi). Khác với hàm `dkSeller()` ở màn Điểm kinh doanh (null → ngầm hiểu "giống người thuê"), hàm mới `mbStallSeller()` ở đây hiển thị đúng nghĩa đen: `sellerId` rỗng/không tìm thấy → **"Chưa ghi nhận"** (không suy đoán), `sellerId` trùng người thuê → tên + chú thích "(người thuê trực tiếp kinh doanh)", khác → chỉ hiển thị tên người bán, không gộp nghĩa vụ tài chính vào người này.
- Không tạo entity mới — cả hai đều resolve qua `A.idx.trader` sẵn có.

## 6. Cách 2 nút điều hướng hoạt động

- **"Xem hồ sơ tiểu thương"**: `A.go('tieu-thuong')` (router hiện có) rồi gọi lại **nguyên** `A.ACT.trader({dataset:{id: t.id}})` — đúng handler đã có sẵn ở màn Tiểu thương, mở lại đúng modal hồ sơ đầy đủ đó (không tạo bản sao). Chỉ hiện nút khi có người thuê (`t` tồn tại) — điểm trống không hiện, không tạo trader giả.
- **"Xem điểm kinh doanh"**: `A.go('diem-kd')` rồi gọi lại **nguyên** `A.ACT['dk-open']({dataset:{id: st.id}})` — đúng handler/drawer đã xây ở task BUSINESS_POINT_CL_SCREEN_REFACTOR, không duplicate màn chi tiết điểm.
- Cả 2 handler chỉ gọi `A.ACT[...]` đã đăng ký sẵn trong registry dùng chung của app (không expose API mới, không sửa file của 2 màn đích).

## 7. RBAC được giữ nguyên

- 2 nút chỉ render khi `U.can('tieu-thuong')` / `U.can('diem-kd')` — đúng helper `U.can()` sẵn có (đã gồm account active, role active, screen permission, `screenMarketOk`/`marketScopes`). Không permission key mới, không `A.canDo` mới, không hard-code role.
- Handler `mb-open-trader`/`mb-open-diemkd` re-check `U.can(...)` ngay đầu (phòng trường hợp bị gọi trực tiếp ngoài UI).
- "Đổi trạng thái" chỉ bị BỎ khỏi drawer CL này — handler `stall-status`, permission `so-do.doi-trang-thai` giữ nguyên, vẫn phục vụ Mặt bằng TTD.
- Không đổi `PERM_SEED_VERSION`, `RBAC_SCHEMA`, `D.VERSION`, không đổi `js/permissions.js`.

## 8. Test đã chạy (browser thật)

1. CL, click điểm **Đang thuê** (HS-A01) → khớp CHÍNH XÁC ví dụ trong yêu cầu (Sạp hàng, 4,8 m², Thủy hải sản, 2.000 đ/m²/ngày, Huỳnh Quốc Toàn (TT0019), "người thuê trực tiếp kinh doanh", HĐ-CL-2024-0020, còn 352 ngày, Đang hiệu lực, Không nợ).
2. **Còn trống** (HS-A06) → Người thuê "Chưa có", Người bán "Chưa ghi nhận", "Chưa có hợp đồng hiệu lực", "Không có nghĩa vụ hiện tại", chỉ có nút "Xem điểm kinh doanh" (không có "Xem hồ sơ tiểu thương").
3. **Nợ phí** (HS-A10) → vẫn có hợp đồng "Đang hiệu lực", công nợ hiện đúng badge "Nợ phí" + 418.400 đ.
4. **Tạm ngừng** (HS-B04) → vẫn giữ đúng người thuê/hợp đồng/công nợ.
5. **Đang tranh chấp** (HS-B07) → vẫn giữ đúng người thuê/hợp đồng/công nợ.
6. Người thuê = người bán (HS-A01, HS-A10, HS-B04, HS-B07) → hiện "(người thuê trực tiếp kinh doanh)".
7. Người thuê ≠ người bán (KA-A05: thuê Trần Thị Kim Nhung, bán Châu Thị Hạnh) → hiển thị đúng 2 người riêng biệt, không gộp.
8. `sellerId` null → hiển thị "Chưa ghi nhận" (áp dụng nhất quán cho điểm trống).
9. Một người thuê nhiều điểm, seller khác nhau: Trần Thị Kim Nhung (TT0004) thuê cả KA-A04 và KA-A05 — bấm "Xem hồ sơ tiểu thương" ở KA-A05 mở đúng TT0004, thấy đủ 2 hợp đồng của cô ấy.
10. "Xem hồ sơ tiểu thương" → điều hướng `#/tieu-thuong` + mở đúng modal hồ sơ người thuê (không phải người bán).
11. "Xem điểm kinh doanh" → điều hướng `#/diem-kd` + mở đúng drawer của chính điểm đó (HS-A10).
12-13. Account `technician` (Võ Hoàng Tuấn — có `screen:mat-bang` nhưng KHÔNG có `screen:tieu-thuong`/`screen:diem-kd`): drawer vẫn hiện đủ A/B/C/D nhưng **không render 2 nút điều hướng** — không có cách bypass qua drawer; gõ thẳng `#/tieu-thuong` cũng tự bị chặn/redirect về `#/mat-bang`.
14. `marketScopes`: Huỳnh Thanh Tâm (market_staff, chỉ TTD) — không có nút chọn "Chợ Cao Lãnh", không truy cập được dữ liệu CL.
15. Chợ quê TTĐ: click điểm AT-A01 → drawer CŨ y nguyên (Tiểu thương gộp, Hồ sơ mở modal tại chỗ, còn đủ "Đổi trạng thái") — không bị ảnh hưởng.
16. Không phát hiện regression ở các màn khác (đã đi qua Tiểu thương, Điểm kinh doanh, sidebar/permission theo từng account).
17. Không có console error trong toàn bộ phiên test.

## 9. NEED_CONFIRMATION còn lại

- Đã **chủ động bỏ luôn nút "Tạo hợp đồng"** và "💳 Thu tiền" khỏi drawer CL (không chỉ riêng "Đổi trạng thái" như yêu cầu nêu rõ) — vì mục 2 của yêu cầu khẳng định drawer "chỉ có nhiệm vụ XEM NHANH", và mục 9 liệt kê "không tạo modal tài chính mới" cùng tinh thần loại bỏ mutation khỏi drawer. Hành động "Tạo hợp đồng" cho điểm trống vẫn còn nguyên trong drawer của màn "Điểm kinh doanh" (`dkDetailHtmlCL`, không đổi) — người dùng vẫn tới được qua nút "Xem điểm kinh doanh". Nếu bạn muốn giữ lại "Tạo hợp đồng" ngay trong drawer Mặt bằng CL, cho biết để bổ sung lại (không cần sửa gì khác ngoài thêm lại 1 điều kiện nút).
- Không còn gap nào khác cần xác nhận thêm.
