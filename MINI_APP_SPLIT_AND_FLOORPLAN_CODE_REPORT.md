# BÁO CÁO — Mini App "Tách điểm" (tiểu thương) + Hiển thị mã điểm trên Sơ đồ mặt bằng

Phạm vi: tiếp nối `BUSINESS_POINT_SPLIT_WORKFLOW_IMPLEMENTATION_REPORT.md` (luồng nghiệp vụ Tách điểm phía Web BQL). Báo cáo này audit + hoàn tất phần Claude/Codex đã làm dở: (1) Mini App tiểu thương tự gửi yêu cầu Tách điểm, (2) Sơ đồ mặt bằng hiển thị mã điểm kinh doanh thay vì số thứ tự. Không đụng Gộp điểm/Chuyển đổi điểm, không backend/API/DB thật/auth thật/upload file thật.

## 0. Bối cảnh tiếp quản

Phiên làm việc này tiếp quản working tree đã có sẵn thay đổi (Claude rồi Codex thực hiện qua nhiều bước), Codex bị ngắt do usage limit ngay trước khi hoàn tất browser regression. Bước đầu tiên là **audit toàn bộ working tree trước khi sửa bất kỳ dòng code nào** — không reset/revert/checkout/format lại.

**Kết quả audit**: toàn bộ 7 file `.js` sửa đổi (`data.js`, `js/accounts.js`, `js/core.js`, `js/mini.js`, `js/permissions.js`, `js/v-dieuhanh.js`, `js/v-tieuthuong.js`) + `styles.css` đều nhất quán với mô tả trong comment code và với báo cáo trước đó — không có đoạn code lạc phạm vi, không có logic dở dang, không có mock đối nghịch với model dữ liệu thật. `node --check` PASS cả 7 file JS. Kết luận: **trạng thái an toàn để tiếp tục**, không cần fix gì trước khi chạy regression — mọi thay đổi liệt kê dưới đây là của Claude/Codex trước đó, phiên này chỉ audit + chạy regression (không chỉnh sửa code).

## 1. File đã thay đổi (tính đến thời điểm audit)

| File | Nội dung chính |
|---|---|
| `data.js` | `VERSION` 7→9. Thêm `A.db.pointRequests[]` (model yêu cầu Tách điểm) + seed 4 bản ghi mẫu YC-0015..0018 (3 nguồn TRADER/STAFF/MANAGER) tính đúng theo dữ liệu `stalls` thật. |
| `js/permissions.js` | Thêm 6 permission key mới `action:diem-kd.tach-diem.{lap-yeu-cau,tiep-nhan,gui-phe-duyet,phe-duyet,thuc-hien,assign}`. `PERM_SEED_VERSION` 7→9. |
| `js/accounts.js` | Thêm Account Demo `AC-NV08` (Nguyễn Văn A, `market_staff`, scope CL) + `mergeNewDefaultAccounts()` merge an toàn vào localStorage cũ. |
| `js/v-tieuthuong.js` | Toàn bộ luồng nghiệp vụ Tách điểm phía Web BQL (2 tab, lập/tiếp nhận/phê duyệt/thực hiện) + expose API dùng chung `A.pointReq` (`find/nextId/isActive/activeFor/stepStates`) và `A.openDkDrawer`/`A.openTraderDrawer` cho Mini App và Sơ đồ mặt bằng tái sử dụng. |
| `js/core.js` | Cơ chế điều hướng "← Quay lại" dùng chung (`A.drawerPush/A.drawerBackHtml/A.drawerReset/A.drawerBack`) cho mọi drawer trong app; gọi `A.resetMiniRequestState()` khi đổi Account Demo để dọn state Mini App dở dang. |
| `js/v-dieuhanh.js` | Sơ đồ mặt bằng: ô hiển thị `st.code` (mã điểm thật) thay vì `st.num`; điểm nguồn đã tách (`structuralStatus:'SPLIT'`) dùng lại class `.dim` có sẵn; 2 nút "xem sâu" (`mb-open-trader`/`mb-open-diemkd`) chuyển từ đổi hẳn màn hình (`A.go`) sang mở drawer con tại chỗ + đẩy vào navigation stack dùng chung. |
| `js/mini.js` | **Mini App tiểu thương — luồng tự gửi yêu cầu Tách điểm** (chi tiết mục 2 bên dưới). |
| `styles.css` | CSS cho `drawer-yc`, `split-plan/split-box/split-arrow/split-result`, `yc-steps/yc-step-*` — tái dùng token màu/spacing/radius hiện có, không thêm palette mới. |

Không có file `.js`/`.css` mới. File `.md` mới duy nhất trong phiên này là chính báo cáo hiện tại.

## 2. Mini App — luồng "tiểu thương tự gửi yêu cầu Tách điểm"

Vị trí: tab "Trang chủ" (mỗi điểm kinh doanh của tiểu thương giờ có 1 `m-card` riêng, `miniPointCard()`, thay cho 1 dòng gộp cũ) + tab "Phản ánh" (bổ sung khối "Yêu cầu của tôi" bên dưới "Phản ánh đã gửi", tái dùng đúng kiểu theo dõi trạng thái đã có, không thêm mục điều hướng mới vì `.m-tabs` đã cố định 5 cột).

**Nguồn dữ liệu**: Mini App **không** có mảng dữ liệu riêng — đọc/ghi thẳng `A.db.pointRequests` qua API dùng chung `A.pointReq` (expose ở `js/v-tieuthuong.js:1140`), cùng 1 nguồn sự thật với tab "Yêu cầu thay đổi" của Web BQL. Bản ghi Mini App tạo ra có `source:'TRADER'`, `createdBy` = trader id, `assignedTo: null`, `status:'DRAFT'`, `plan: null` — đúng shape model đã có từ trước, không đổi.

**Ownership**: tái dùng nguyên quan hệ `t.stalls` sẵn có (`miniOwnsStall(t, st) = t.stalls.indexOf(st.id) !== -1`) — không tạo model quan hệ mới. Re-check ownership ở **3 lớp độc lập**: (a) điều kiện hiện nút trong `miniPointCard()`, (b) handler `mini-split-open`/`mini-split-save` re-check lại `miniOwnsStall` + `st.market==='CL'` trước khi mở form/lưu, (c) `screenReqDetail()`/`mini-req-view` re-check `r.source==='TRADER' && r.requestedByTraderId===t.id` ngay ở nơi RENDER (phòng trường hợp `m.reqView` bị stale qua localStorage cũ) — không tin dữ liệu UI đã hiện.

**Chặn tạo trùng (duplicate-active-request)**: `A.pointReq.activeFor(pointId)` trả về request `SPLIT` đang ở 1 trong các trạng thái `DRAFT/STAFF_REVIEW/PENDING_APPROVAL/APPROVED/IMPLEMENTING` (tập `DKREQ_ACTIVE_STATUSES`, dùng chung với Web BQL). `miniPointCard()` chỉ hiện nút "Gửi yêu cầu tách điểm" khi **không có** request active cho điểm đó; nếu có, hiện "Xem yêu cầu đang xử lý" trỏ thẳng tới request đó. Handler `mini-split-open`/`mini-split-save` **re-check lại** điều kiện này ngay tại thời điểm hành động (không chỉ tin UI đã ẩn nút) — đã kiểm thử trực tiếp bằng browser (mục 5, TEST 3).

**CL-only**: mọi điều kiện hiện nút / re-check trong handler đều có `st.market === 'CL'` — Mini App không cho gửi yêu cầu Tách điểm cho điểm ở Chợ quê TTĐ (nghiệp vụ V1 chỉ áp dụng CL, đúng phạm vi báo cáo trước).

**Structurally active**: `miniStructurallyActive(st) = !st.structuralStatus || st.structuralStatus === 'ACTIVE'` — chặn cả điểm đã `SPLIT` lẫn các trạng thái kết cấu không-active có thể bổ sung sau này (không chỉ biết riêng `SPLIT`).

**Form gửi yêu cầu** (`screenSplitForm`): tiểu thương **chỉ** nhập lý do (*)/ghi chú/tệp minh hoạ — **không có** bất kỳ field phương án kỹ thuật nào (mã điểm mới, diện tích từng điểm con, loại điểm, ngành hàng quy hoạch, người xử lý, người phê duyệt) — đúng nguyên tắc tiểu thương chỉ "đề nghị", nhân viên BQL mới "lập phương án". File đính kèm chỉ mô phỏng tên file, không upload thật.

**Trạng thái/timeline hiển thị cho tiểu thương**: `MINI_STATUS_LABEL`/`MINI_STEP_LABEL` chỉ đổi NHÃN thân thiện (vd "Ban Quản lý đang xử lý" thay vì `STAFF_REVIEW`) — **không đổi** state machine kỹ thuật của Web (`A.db.pointRequests[].status` giữ nguyên giá trị). Timeline lấy trực tiếp từ `A.pointReq.stepStates(r)` — 1 nơi tính duy nhất, dùng chung Web/Mini App. Ghi chú trạng thái phân biệt rõ APPROVED ("đã duyệt phương án, đang chuẩn bị thực hiện") với COMPLETED ("đã tách thành mã X, Y") — không nói "đã tách" khi mới duyệt.

**Đồng bộ với Web BQL qua `A.db.pointRequests`**: Mini App và Web đọc/ghi cùng 1 mảng trong bộ nhớ (`A.save()` chung 1 cơ chế lưu localStorage đã có) — không có hàng đợi/API giả lập nào ở giữa. Yêu cầu tiểu thương gửi từ Mini App xuất hiện **ngay lập tức** trong tab "Yêu cầu thay đổi" của Web BQL (đã kiểm thử trực tiếp, mục 5).

**Reset state khi đổi ngữ cảnh**: `A.resetMiniRequestState()` (expose qua `A.resetMiniRequestState`) được gọi khi đổi Account Demo (`core.js`) và khi đổi tiểu thương/đăng xuất trong chính Mini App (`mini-trader`, `mini-logout`) — tránh state `splitPoint`/`splitDraft`/`reqView` của tiểu thương A rò rỉ sang tiểu thương B.

## 3. Sơ đồ mặt bằng — hiển thị `pointCode`

`js/v-dieuhanh.js` — cả 2 hàm vẽ ô (`mbZoneSectionHtml`, và hàm tương ứng ở view Khu) đổi nội dung nút từ `st.num` (số thứ tự) sang `st.code` (mã điểm kinh doanh thật, vd `KA-A01`). `data-id="${st.id}"` (technical id dùng cho click/tra cứu) **giữ nguyên không đổi** — chỉ đổi phần hiển thị.

Điểm nguồn đã tách (`structuralStatus === 'SPLIT'`) dùng lại đúng class `.dim` có sẵn (không tạo CSS mới) để phân biệt trực quan với điểm đang hoạt động bình thường, vẫn click được để xem lịch sử tách (title tooltip có thêm " · Đã tách").

Điểm con sinh ra từ tách (`row: null, num: null`, xem `js/v-tieuthuong.js:1046`) **không** xuất hiện trong lưới sơ đồ vật lý: vòng lặp dựng hàng dùng `sec.rows.map(r => stalls.filter(st => st.row === r))` — `sec.rows` là danh sách hàng cố định đã cấu hình (`'A'`, `'B'`, …, không có `null`), nên `st.row === null` không khớp bất kỳ `r` nào và bị loại khỏi grid một cách tự nhiên, không cần điều kiện lọc thêm. Điểm con **vẫn được đếm** trong tổng số điểm của khu/tầng (số liệu tổng quan cộng dồn đúng, đã kiểm thử: 288 → 290 điểm sau 1 lần tách) và **có thể tra cứu/tìm kiếm** trong "Danh mục điểm kinh doanh" (màn Điểm kinh doanh) — chỉ không có vị trí vật lý cố định trên lưới hàng/cột.

## 4. Kiểm tra tĩnh (static)

```
node --check data.js
node --check js/accounts.js
node --check js/core.js
node --check js/mini.js
node --check js/permissions.js
node --check js/v-dieuhanh.js
node --check js/v-tieuthuong.js
```
**PASS** toàn bộ 7 file (chạy lại ở đầu phiên trước khi sửa gì, và không có thay đổi code nào sau đó nên kết quả vẫn nguyên giá trị).

## 5. Browser regression (hoàn tất trong phiên này)

Chạy qua HTTP server cục bộ (`python -m http.server`), Chrome thật (Claude in Chrome), dùng handler thật — không giả lập.

- **TEST 1 — Web BQL, luồng có sẵn (YC-0015, nguồn TRADER, đã có `plan`)**: Trần Minh Khoa (market_manager) mở YC-0015 (`PENDING_APPROVAL`) → **Phê duyệt** → toast "Yêu cầu tách điểm KA-A01 đã được phê duyệt" → **Thực hiện tách điểm** → toast "Điểm KA-A01 đã được tách thành KA-A01A và KA-A01B" → trạng thái `Hoàn thành`. Kiểm tra "Danh mục điểm kinh doanh": KA-A01 (Đang thuê, Đã tách), KA-A01A (7 m², Còn trống), KA-A01B (7,1 m², Còn trống) — tổng diện tích khớp 14,1 m². **PASS**.
- **TEST 2 — Sơ đồ mặt bằng hiển thị mã điểm**: trước khi tách, ô hiển thị `KA-A01`..`KA-A20` (không phải số 1..20). Sau khi tách, `KA-A01` chuyển màu `.dim` (nhạt), vẫn ở đúng vị trí hàng A; số điểm khu tăng 20→22 (gồm cả 2 điểm con không hiển thị trên lưới); click "Xem điểm kinh doanh"/"Xem hồ sơ tiểu thương" từ drawer sơ đồ mở drawer con tại chỗ + nút "← Quay lại KA-A01" hoạt động đúng, quay lại đúng drawer sơ đồ ban đầu (không rời màn Mặt bằng chợ). **PASS**.
- **TEST 3 — Mini App, luồng tiểu thương tự gửi yêu cầu mới hoàn toàn**: đăng nhập demo tiểu thương "Phan Thị Mỹ Hoa" (điểm KA-A11, chưa có yêu cầu nào) → card "KA-A11" hiện nút "Gửi yêu cầu tách điểm" → điền lý do → **Gửi yêu cầu** → tạo `YC-0019` (`source:'TRADER'`, `status:'DRAFT'`) → xác nhận **xuất hiện ngay** trong Web BQL (tab "Yêu cầu thay đổi", 5 → hiển thị YC-0019 hàng đầu, "Chưa phân công"). Chuyển sang Nguyễn Văn A (market_staff) → "Tiếp nhận & hoàn thiện phương án" → form tự sinh mã `KA-A11A`/`KA-A11B` + diện tích chia đôi khớp 12,4 m² → Lưu (tự nhận `assignedTo`) → **Gửi phê duyệt** → `PENDING_APPROVAL`, không thấy nút Phê duyệt/Từ chối (đúng, staff không có quyền `phe-duyet`). Chuyển sang Trần Minh Khoa → **Phê duyệt** → **Thực hiện tách điểm** → toast "Điểm KA-A11 đã được tách thành KA-A11A và KA-A11B" → `Hoàn thành`. Quay lại Mini App (tiểu thương Phan Thị Mỹ Hoa): card KA-A11 chỉ còn "Xem chi tiết" (đúng, đã `SPLIT` nên không còn nút gửi yêu cầu); tab "Phản ánh" → "Yêu cầu của tôi" → YC-0019 tag "Hoàn thành" → mở chi tiết → ghi chú "Điểm KA-A11 đã được tách thành: KA-A11A, KA-A11B" + đủ 7 bước timeline done. **PASS end-to-end** (Mini App tạo → Web BQL xử lý → Mini App phản ánh kết quả, đúng 1 nguồn dữ liệu chung).
- **TEST 4 — chặn tạo trùng (duplicate-active-request)**: đăng nhập demo tiểu thương "Nguyễn Thị Thanh Lan" (điểm RC-A01, đã có sẵn YC-0017 `DRAFT` từ seed dữ liệu) → card RC-A01 hiện nút **"Xem yêu cầu đang xử lý"** (không phải "Gửi yêu cầu tách điểm") → bấm vào mở đúng chi tiết YC-0017 với timeline đúng bước ("Ban Quản lý đã tiếp nhận" đang `current`). **PASS**.
- **Console**: theo dõi `read_console_messages` xuyên suốt cả 4 test (điều hướng, submit form, phê duyệt, thực hiện tách, đổi tài khoản nhiều lần) — **không phát sinh lỗi/cảnh báo console nào**.

## 6. Kết luận PASS/FAIL

| Hạng mục | Kết quả |
|---|---|
| Audit working tree (Claude + Codex đã làm) | AN TOÀN — không cần fix |
| Static check (`node --check` × 7 file) | **PASS** |
| Web BQL — phê duyệt/thực hiện tách (luồng có sẵn) | **PASS** |
| Sơ đồ mặt bằng — hiển thị `pointCode`, `.dim` cho điểm đã tách, điểm con không lạc vào lưới | **PASS** |
| Mini App — tiểu thương tự gửi yêu cầu tách điểm, đồng bộ 2 chiều với Web BQL | **PASS** |
| Chặn tạo yêu cầu trùng cho cùng 1 điểm | **PASS** |
| Console lỗi trong toàn bộ regression | **Không có** |

**Không có lỗi nào cần sửa trong phiên này** — toàn bộ implementation của Claude/Codex trước đó đã đúng và đầy đủ; phiên này chỉ audit + hoàn tất browser regression còn dang dở.

## 7. Giới hạn / NEED_CONFIRMATION

- Danh sách tiểu thương mẫu trong dropdown demo của Mini App (`Xem với tư cách tiểu thương mẫu`) chỉ có 9 lựa chọn cố định (không đại diện hết toàn bộ tiểu thương CL) — đây là giới hạn UI demo có sẵn từ trước, không phải lỗi phát sinh từ task này. TEST 3/TEST 4 dùng đúng 2 trong 9 lựa chọn có sẵn nên không cần can thiệp gì thêm.
- Đúng như báo cáo trước đã nêu: "Thực hiện tách điểm" không chặn cứng khi điểm còn hợp đồng hiệu lực (chỉ cảnh báo) — vì yêu cầu gốc cấm tự động sửa/thanh lý hợp đồng và phần lớn điểm mẫu luôn có hợp đồng hiệu lực. Giữ nguyên hành vi này, không đổi trong phiên này.
- Gộp điểm / Chuyển đổi điểm: xác nhận lại **chưa** đụng tới trong toàn bộ các thay đổi đã audit (`dkcl-merge-open/save`, `dkcl-convert-open/save` vẫn là PROTOTYPE INTERACTION cũ, không tạo/xoá `stall` thật) — đúng phạm vi yêu cầu.
- Không có NEED_CONFIRMATION nào phát sinh mới — mọi quyết định thiết kế nằm trong phạm vi đã được xác nhận ở báo cáo trước.

---
*Báo cáo này bổ sung, không thay thế `BUSINESS_POINT_SPLIT_WORKFLOW_IMPLEMENTATION_REPORT.md` (vẫn giữ nguyên, mô tả chi tiết luồng nghiệp vụ Web BQL và permission).*
