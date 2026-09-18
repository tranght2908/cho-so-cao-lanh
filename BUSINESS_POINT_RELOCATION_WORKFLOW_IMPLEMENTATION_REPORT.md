# Chuyển đổi vị trí điểm kinh doanh (RELOCATE_TO_VACANT_POINT) — Implementation Report

Phạm vi: màn **Điểm kinh doanh**, Chợ Cao Lãnh, nghiệp vụ **Chuyển đổi vị trí** duy nhất
(`conversionType: 'RELOCATE_TO_VACANT_POINT'`). Không đụng Tách điểm/Gộp điểm, không backend/API/DB
thật, không auth thật, không upload file thật.

## 1. Codex work inherited (pre-check audit)

Trước khi bắt đầu, đã audit toàn bộ working tree (`git status` + `git diff --stat` + đọc các báo
cáo Codex đã tạo trước đó). Kết quả:

- **Codex CHƯA triển khai bất kỳ phần nào của nghiệp vụ Chuyển đổi vị trí.** Toàn bộ 2236 dòng thay
  đổi đang dang dở trong working tree đều thuộc 2 nghiệp vụ **Tách điểm** (BUSINESS_POINT_SPLIT_
  WORKFLOW) và **Gộp điểm** (BUSINESS_POINT_MERGE_WORKFLOW), cả ở Web BQL lẫn Mini App — cả hai đều
  đã hoàn thiện, có báo cáo riêng (`BUSINESS_POINT_SPLIT_WORKFLOW_IMPLEMENTATION_REPORT.md`,
  `BUSINESS_POINT_MERGE_WORKFLOW_IMPLEMENTATION_REPORT.md`, `MINI_APP_SPLIT_AND_FLOORPLAN_CODE_
  REPORT.md`, `SPLIT_RESPONSIBILITY_AND_DIRECT_SELLER_REPORT.md`).
- Cả 4 báo cáo trên đều **tự xác nhận rõ ràng** "Chuyển đổi điểm CHƯA triển khai" và liệt kê 2 handler
  minh họa cũ `dkcl-convert-open/save` (js/v-tieuthuong.js, trong drawer chi tiết điểm KD) là
  **PROTOTYPE INTERACTION cũ, KHÔNG liên quan** — đây là nghiệp vụ đổi **loại điểm** (pointType, ví
  dụ ki-ốt ↔ sạp hàng), khác hoàn toàn với "chuyển đổi VỊ TRÍ" (đổi điểm vật lý) mà yêu cầu này cần.
  Đã audit kỹ và **giữ nguyên, không đụng** 2 handler `dkcl-convert-*` đó để tránh nhầm lẫn 2 nghiệp
  vụ trùng tên "chuyển đổi".
- Không có schema/migration/permission/report nào cho CONVERT tồn tại trước khi phiên này bắt đầu.
- Không có syntax error hay code nửa chừng nào trong phần Codex đã làm (SPLIT/MERGE) — `node --check`
  sạch trên toàn bộ file trước khi bắt đầu.

**Kết luận audit:** không có gì để "tiếp quản dở dang" cho riêng nghiệp vụ CONVERT — toàn bộ implementation
dưới đây là MỚI, được thiết kế bám sát pattern đã có của SPLIT/MERGE (tái dùng tối đa hạ tầng chung:
`A.db.pointRequests`, state machine, permission engine, CSS, timeline, drawer).

## 2. Claude work completed

Toàn bộ nghiệp vụ **Chuyển đổi vị trí điểm kinh doanh (RELOCATE_TO_VACANT_POINT)** cho Chợ Cao Lãnh:
3 nguồn khởi tạo (Trader/Staff/Manager), state machine đầy đủ, kiểm tra điều kiện PASS/WARNING/
BLOCKER, execution với re-check toàn bộ, audit trail 2 chiều, hậu kiểm hồ sơ cơ bản. Xem chi tiết
từng mục bên dưới.

## 3. Files changed

Chỉ 3 file — **không đụng data.js/styles.css/index.html/các file khác** (không cần thêm field seed,
không cần class CSS mới — tái dùng 100% class đã có của SPLIT/MERGE):

| File | Thay đổi |
|---|---|
| `js/permissions.js` | +6 permKey mới `action:diem-kd.chuyen-doi.*`, role grant mặc định, bump `PERM_SEED_VERSION` 10→11 (chỉ để tài liệu hóa, auto-merge đã tự thêm permKey mới không cần bump) |
| `js/v-tieuthuong.js` | +~610 dòng: toàn bộ module CONVERT (helpers điều kiện, 2 form tạo yêu cầu, drawer chi tiết A–E, state machine handlers, execution, hậu kiểm) + 6 điểm tích hợp tối thiểu vào code SPLIT/MERGE hiện có (xem mục "Guards") |
| `js/mini.js` | +90 dòng: nút "Gửi yêu cầu chuyển vị trí" trên point card, form Mini App, tích hợp vào "Yêu cầu của tôi"/chi tiết yêu cầu |

`data.js`: **không sửa** — không seed sẵn dữ liệu mẫu CONVERT (giống MERGE, cũng không seed sẵn) để
tránh xung đột với các yêu cầu SPLIT (YC-0015..0018) đã seed sẵn trên đúng những điểm mẫu hay dùng
(KA-A01 có SPLIT PENDING_APPROVAL). Đã kiểm chứng qua Chrome: khi thử chọn KA-A01 làm nguồn, hệ
thống tự động loại khỏi danh sách vì `dkConvertActiveConflict` phát hiện đúng SPLIT YC-0015 đang xử
lý — xác nhận conflict-check hoạt động đúng ngay từ đầu.

## 4. Schema

Tái dùng nguyên `A.db.pointRequests` (đúng yêu cầu — "Không tạo convertRequests riêng"). Bản ghi
CONVERT thêm field MỚI (không đụng field hiện có của SPLIT/MERGE):

```js
{
  id, type: 'CONVERT', conversionType: 'RELOCATE_TO_VACANT_POINT', market: 'CL',
  source: 'TRADER'|'STAFF'|'MANAGER',
  fromPointId,           // điểm nguồn (luôn có ngay từ khi tạo)
  toPointId,             // điểm đích — TRADER/STAFF chọn ngay; MANAGER để null tới khi NV BQL lập phương án
  requestedByName, requestedByTraderId, createdBy, assignedTo, requestedAt,
  reason, note, attachments: [{name}],
  status: 'DRAFT'|'STAFF_REVIEW'|'PENDING_APPROVAL'|'APPROVED'|'REJECTED'|'IMPLEMENTING'|'COMPLETED',
  plan: null | { toPointId, contractCondition: 'PENDING'|'RESOLVED' },
  timeline: [{key, at, by, note?}],
  resultPointIds: null | [toPointId],   // set khi COMPLETED — cùng convention SPLIT/MERGE
  postCheck: null | { systemMoved:'DONE', contractStatus, businessLicenseStatus, note, confirmedBy, confirmedAt }
}
```

Không có migration nào cần thiết cho `data.js` vì đây chỉ là giá trị MỚI của field `type` trên 1
mảng đã tồn tại — không có object nào bị seed sẵn với shape cũ cần chuyển đổi.

## 5. Permissions

6 permKey MỚI, đặt tên đúng theo gợi ý trong yêu cầu, đúng ma trận least-privilege giống hệt
tach-diem/gop-diem:

| permKey | market_manager | market_staff |
|---|---|---|
| `diem-kd.chuyen-doi.lap-yeu-cau` | ✓ | ✓ |
| `diem-kd.chuyen-doi.tiep-nhan` | – | ✓ |
| `diem-kd.chuyen-doi.gui-phe-duyet` | ✓ | ✓ |
| `diem-kd.chuyen-doi.phe-duyet` | ✓ | – |
| `diem-kd.chuyen-doi.thuc-hien` | ✓ | ✓ |
| `diem-kd.chuyen-doi.assign` | ✓ | – |

Migration SAFE MERGE (không full reseed): thêm CATALOG + `actionRoles` mới, cơ chế
`mergeIntoCurrentSeed()`/`loadState()` đã có sẵn tự phát hiện permKey hoàn toàn mới và cấp theo
default matrix — **không sửa 1 dòng nào của cơ chế migration**, không revoke/đổi bất kỳ permKey nào
đã có. Đã verify trực tiếp qua Chrome console (`A.PERM.canAction(...)`) sau khi load app: cả 6
permKey được cấp đúng ma trận ngay từ lần load đầu, không cần thao tác gì thêm.

## 6. Web BQL workflow

Tái dùng màn **Điểm kinh doanh → Yêu cầu thay đổi** hiện có — không tạo màn riêng. Menu "+ Lập yêu
cầu thay đổi" có thêm mục **"Chuyển đổi vị trí"**.

- **Luồng 2 (NV BQL tự lập đủ, có quyền `tiep-nhan`):** 1 form duy nhất — chọn điểm nguồn (đang sử
  dụng, ACTIVE, CL) → chọn điểm đích (đang trống, ACTIVE, CL, **không yêu cầu liền kề**) → bảng so
  sánh + checklist điều kiện realtime → chọn `contractCondition` (mock) → lý do/ghi chú → Lưu (status
  `STAFF_REVIEW`, `plan` có sẵn).
- **Luồng 3 (Trưởng BQL đề xuất, chỉ có `assign`):** chọn điểm nguồn + lý do/chỉ đạo + giao NV BQL —
  KHÔNG tự chọn điểm đích (đúng yêu cầu "Manager phê duyệt nhưng không trở thành executor" và
  "KHÔNG tự lập phương án kỹ thuật"). `dkconvert-open` tự route đúng form theo permission, giống hệt
  pattern `dksr-open` của SPLIT.
- **Drawer chi tiết** bố cục A–D(+E) đúng yêu cầu, cùng ngôn ngữ hình ảnh MERGE (tái dùng nguyên
  class `.merge-detail-section/.merge-flow/.merge-flow-source/.tbl`):
  - A. Thông tin yêu cầu (mã, loại, nguồn, người đề nghị, lý do, trạng thái, người phụ trách)
  - B. Hiện trạng & vị trí đề xuất — source card → target card
  - C. Kiểm tra điều kiện & phương án — bảng so sánh (khu vực/loại/diện tích/ngành hàng/trạng
    thái/đơn giá + chênh lệch) + checklist PASS/WARNING/BLOCKER (8 mục, xem mục Guards) + dòng "Ảnh
    hưởng dự kiến"
  - D. Quá trình xử lý — timeline riêng (`dkConvertTimeline`, không tái dùng label SPLIT)
  - E. Hồ sơ sau chuyển đổi — chỉ hiện khi COMPLETED (xem mục Post-conversion tracking)
- Bảng "Yêu cầu thay đổi" hiển thị đúng dòng `Chuyển đổi vị trí · KA-A02 → AU-A03`, tìm kiếm theo mã
  cả nguồn lẫn đích.

## 7. Mini App

Trader CL thấy nút **"Gửi yêu cầu chuyển vị trí"** trên card điểm kinh doanh của mình (điều kiện:
CL, ACTIVE, đang sử dụng, không có request xung đột, có ít nhất 1 điểm trống hợp lệ trong CL). Form
trong khung điện thoại: chọn điểm đích (market-wide, không cần liền kề) + lý do + ghi chú + tệp mock
— **không có field kỹ thuật nào** (không sửa area/pointCode/đơn giá/assign/approve/execute — đúng
yêu cầu). Request tạo ở `DRAFT`, `assignedTo: null`, chờ NV BQL tiếp nhận.

"Yêu cầu của tôi" (tab Phản ánh) và "Chi tiết yêu cầu" đã mở rộng để hiển thị đúng CONVERT (nhãn
"Chuyển đổi vị trí điểm kinh doanh", mã điểm dạng "TG-A03 → AU-A06", ghi chú hoàn thành "Điểm X đã
chuyển sang: Y") — dùng lại nguyên `A.pointReq.stepStates`/`MINI_STEP_LABEL` sẵn có (label generic,
không cần sửa) cho tiến độ xử lý.

Trader **chỉ thấy request của chính mình** — re-check ownership tại cả nơi mở lẫn nơi render (đúng
pattern SPLIT/MERGE).

## 8. Guards (re-check trong MỌI handler, không chỉ ẩn/hiện nút)

- `dkConvertActiveConflict(pointId, exceptId)`: hàm **MỚI**, kiểm tra xung đột trên **CẢ 3 loại**
  request (SPLIT.`pointId`, MERGE.`sourcePointIds`, CONVERT.`fromPointId`/`toPointId`) — rộng hơn
  các hàm xung đột cũ của SPLIT/MERGE (mỗi hàm chỉ biết loại của chính nó). Đây là hàm **hoàn toàn
  mới**, không sửa `dkMergeActiveConflict`/`dksrEligibleStalls` hiện có.
- `dkConvertSourceEligible`/`dkConvertTargetEligible`: re-check market CL, structuralStatus ACTIVE,
  vacancy thật (status `'trong'` + không có `traderId`), không xung đột — gọi lại ở **mọi** bước
  (tạo, lập phương án, gửi phê duyệt, thực hiện), không chỉ 1 lần lúc tạo.
- `dkConvertConditions(r, source, target)`: 8 điều kiện tính LẠI từ dữ liệu hiện tại (không cache):
  điểm nguồn tồn tại+đang dùng (BLOCKER), điểm đích tồn tại+trống (BLOCKER), cấu trúc còn hiệu lực
  (BLOCKER), không xung đột request khác (BLOCKER), ngành hàng phù hợp quy hoạch đích (WARNING), công
  nợ tiểu thương (WARNING), điều kiện hợp đồng (WARNING), người trực tiếp kinh doanh tại nguồn
  (WARNING).
- **Execution** (`dkconvert-execute`) re-check đầy đủ theo đúng checklist yêu cầu: permission, CL
  scope, `assignedTo` ownership, status APPROVED, source tồn tại+ACTIVE+CL+có người dùng, target tồn
  tại+ACTIVE+CL+**vẫn còn trống**, không blocker, `contractCondition === 'RESOLVED'`. **Nếu target đã
  đổi → STOP, không mutation** — đã verify bằng test tự động (mục Tests, kịch bản 4).

## 9. Contract

**Không có mutation nào lên `A.db.contracts`** ở bất kỳ đâu trong toàn bộ luồng CONVERT — không tạo,
không sửa `stallId`, không copy, không tự thanh lý. Chỉ tracking `plan.contractCondition`
(`PENDING`/`RESOLVED`, do NV BQL tự đánh dấu, y hệt cơ chế mock của MERGE
`dkMergeContractState`/`contractCondition`) — không hoàn tất thì nút "Thực hiện" bị `disabled` (UI)
và bị chặn lần nữa ở handler (execution guard).

Khi thực hiện, STALL nguồn được set `contractId: null` (chỉ xoá tham chiếu NGƯỢC trên bản ghi điểm,
**không đụng** bản ghi hợp đồng gốc trong `A.db.contracts`) — cùng đúng pattern đã có sẵn ở
`ct-end-save` (thanh lý hợp đồng, `js/v-tieuthuong.js`): `st.status='trong'; st.traderId=null;
st.contractId=null;`. **NEED_CONFIRMATION**: hợp đồng cũ (nếu còn "hiệu lực") vẫn hiển thị nguyên
trạng ở màn Hợp đồng, trỏ `stallId` về điểm nguồn dù điểm đã trống trên thực tế — hệ thống không tự
thanh lý; đây chính là lý do mục E (hậu kiểm) có dòng "Hợp đồng / hồ sơ sử dụng" để NV BQL tự xác
nhận xử lý thủ công.

## 10. Debt

Hiển thị `U.traderDebt(source.traderId)` trong checklist điều kiện — nếu > 0 → WARNING kèm số tiền,
**không tự chặn** (đúng "NEED_CONFIRMATION", business rule debt-block chưa được xác nhận). Đã verify
qua Chrome với dữ liệu thật (Hồ Thị Thanh Yến, công nợ 1.836.800đ) — hiển thị đúng.

## 11. Direct seller

**Không tự copy** `directSellerAssignments` từ nguồn sang đích. Checklist chỉ hiển thị WARNING nếu
điểm nguồn đang có người trực tiếp kinh doanh khác người thuê (`dkDirectSellerActive`), nhắc "cần
đăng ký lại thủ công nếu cần" — không phá lịch sử `directSellerAssignments` hiện có (mảng không bị
đụng tới trong execution).

## 12. Execution mutations (đã verify bằng browser thật)

| | Trước | Sau |
|---|---|---|
| **Source** (KA-A02) | status `thue`, traderId=TT0002, contractId=HĐ-... | status **`trong`**, traderId **null**, sellerId **null**, contractId **null**, pointCode/area/geometry/structuralStatus giữ nguyên, `history` có dòng mới |
| **Target** (AU-A03) | status `trong`, traderId null | status **`thue`**, traderId **=TT0002**, contractId **vẫn null** (không auto tạo hợp đồng), pointCode/area/geometry giữ nguyên, `history` có dòng mới |
| **Trader** | `stalls: ['CL-KA-A02']` | `stalls: ['CL-AU-A03']` (xoá nguồn, thêm đích) |
| **Request** | APPROVED | COMPLETED, `resultPointIds: ['CL-AU-A03']`, timeline +implementing +completed |

## 13. History / Audit

Source: `"{date}: {trader} chuyển vị trí kinh doanh sang {targetCode} theo yêu cầu {id} — Lý do:
..."`. Target: `"{date}: Tiếp nhận chuyển đổi từ {sourceCode} — {trader} theo yêu cầu {id}"`. Cả 2
đều `unshift` vào `history` sẵn có của stall — không tạo bảng audit riêng. Navigation "Xem điểm
nguồn"/"Xem điểm đích"/"Xem hồ sơ tiểu thương" tái dùng nguyên `dkreq-view-point`/`dkreq-view-trader`
(generic, không cần sửa) với `A.drawerPush` giữ đúng "← Quay lại YC-xxxx".

## 14. Post-conversion tracking (mục E)

Chỉ hiện khi `status === 'COMPLETED'`. Người phụ trách (assignedTo, có quyền `tiep-nhan`) ghi nhận:
"Chuyển vị trí trong hệ thống: Hoàn thành" (cố định), "Hợp đồng/hồ sơ sử dụng" và "ĐKKD/địa điểm
kinh doanh" (chọn `Cần kiểm tra cập nhật`/`Đã cập nhật`/`Không áp dụng`) + ghi chú + người/ngày xác
nhận tự động. **Không implement thủ tục hành chính thật** — đúng yêu cầu, chỉ là tracking cơ bản.

## 15. Tests thực hiện (Chrome thật qua `claude-in-chrome`, không chỉ đọc code)

Chạy prototype trên local static server, dùng tài khoản demo thật của app (không mock/stub):

1. **Full flow MANAGER → STAFF → MANAGER → STAFF**: Trần Minh Khoa (market_manager) đề xuất
   KA-A02 → Nguyễn Văn A (market_staff) tiếp nhận, chọn đích AU-A03 (khác khu vực — xác nhận KHÔNG
   yêu cầu adjacency), lập phương án (checklist hiện đúng 3 PASS + 4 WARNING với dữ liệu thật: công
   nợ 1.836.800đ, hợp đồng HĐ-CL-2024-0002, ngành hàng lệch, người trực tiếp KD Hồ Thị Thanh Yến) →
   gửi phê duyệt → Trần Minh Khoa phê duyệt → Nguyễn Văn A thực hiện → **verify mutation đúng 100%**
   (mục 12) → ghi nhận hậu kiểm mục E thành công.
2. **Trader Mini App → Staff → Manager → Staff**: đăng nhập trader Nguyễn Thị Mỹ Tuyết (điểm
   TG-A03), gửi "Đề nghị chuyển vị trí" chọn đích AU-A06 ngay trong Mini App → xác nhận Web BQL
   nhận đúng request `source:'TRADER'`, `status:'DRAFT'` → NV BQL tiếp nhận → mở "Lập phương án" →
   **xác nhận điểm đích trader đã chọn được pre-fill sẵn** (đúng yêu cầu tận dụng đề xuất của trader)
   → hoàn tất phê duyệt + thực hiện → quay lại Mini App bằng đúng tài khoản trader, xác nhận card
   điểm kinh doanh đã đổi từ TG-A03 sang AU-A06, "Yêu cầu của tôi" hiện đúng "Hoàn thành", chi tiết
   hiện đúng "Điểm TG-A03 đã chuyển sang: AU-A06".
3. **Target đã thay đổi trước khi thực hiện → PHẢI block**: tạo + duyệt 1 request CONVERT
   (KA-A06→AU-A10), sau đó mô phỏng "người khác" chiếm AU-A10 (set `status:'thue'`) TRƯỚC khi bấm
   Thực hiện → click "Thực hiện chuyển đổi" → **đúng bị chặn**, toast hiển thị "Điểm đích đã thay
   đổi (không còn trống hoặc không hợp lệ) — không thể thực hiện", request vẫn APPROVED, **không có
   mutation nào xảy ra** trên source/target/trader.
4. **Duplicate/conflict**: chọn KA-A01 (đang có SPLIT YC-0015 PENDING_APPROVAL) làm nguồn trong form
   tạo → **tự động không xuất hiện** trong danh sách điểm nguồn hợp lệ (do
   `dkConvertActiveConflict` phát hiện đúng).
5. **CL market scope**: mọi dropdown nguồn/đích chỉ liệt kê điểm `market === 'CL'` (verify qua danh
   sách option trả về).
6. **Permission handler guard**: verify `A.PERM.canAction()` cho cả 6 permKey trên cả 2 role đúng ma
   trận thiết kế (mục 5) ngay sau khi load app lần đầu (auto-merge permission hoạt động không cần
   thao tác thêm).
7. **Contract không bị auto mutation**: verify sau execution, `A.db.contracts` không có object nào
   bị thêm/sửa/xoá; chỉ `stall.contractId` (điểm nguồn) bị set null.
8. **SPLIT full regression**: approve + execute YC-0015 (Ngô Văn Nam, KA-A01) qua đúng UI thật →
   thành công, tạo `CL-KA-A01A`/`CL-KA-A01B`, không lỗi.
9. **MERGE full regression**: tạo mới YC-0020 (KA-A04+KA-A05) qua đúng UI thật, lập phương án, gửi
   phê duyệt, phê duyệt, thực hiện → thành công, tạo `CL-KA-A04-KA-A05`, không lỗi. Xác nhận danh
   sách yêu cầu hiển thị đúng cả 3 loại (Tách điểm/Gộp điểm/Chuyển đổi vị trí) xen kẽ không xung đột.
10. **Point detail/history**: verify `history[0]` trên cả source/target đúng nội dung, đúng thứ tự
    thời gian, `resultPointIds` trỏ đúng.
11. **Console errors**: `read_console_messages(onlyErrors:true)` — **0 lỗi** qua suốt toàn bộ 11
    kịch bản trên (nhiều lần load lại trang, chuyển tài khoản, chuyển màn).
12. **`node --check`**: chạy trên toàn bộ 10 file `.js` của dự án (kể cả các file Codex đã sửa cho
    SPLIT/MERGE) — **tất cả OK**, không có file nào lỗi cú pháp.

## 16. NEED_CONFIRMATION

- **Hợp đồng cũ sau khi source thành trống**: hệ thống clear `stall.contractId` trên điểm nguồn
  (theo đúng pattern `ct-end-save` có sẵn) nhưng **không đụng** bản ghi hợp đồng gốc trong
  `A.db.contracts` (vẫn `status:'hieuluc'`, `stallId` vẫn trỏ về điểm nguồn) — cố ý, vì yêu cầu cấm
  tuyệt đối tự sửa/chấm dứt hợp đồng. Nghiệp vụ thật cần NV BQL xử lý thủ công (thanh lý/phụ lục) —
  đã có tracking qua mục E, nhưng KHÔNG chặn execution nếu chưa xử lý (chỉ WARNING).
- **Debt > 0 không chặn thực hiện** — theo đúng chỉ dẫn "không tự hardcode debt > 0 = block nếu
  business rule chưa xác nhận".
- **Mini App: nút "Xem yêu cầu đang xử lý" trên point card** (`miniPointCard`) hiện chỉ nhận biết
  request SPLIT đang active (biến `active` dùng `A.pointReq.activeFor` — hàm gốc của SPLIT, giữ
  nguyên không sửa theo đúng yêu cầu "không phá SPLIT/MERGE"). Nếu 1 điểm đang có CONVERT active,
  trader sẽ KHÔNG thấy nút rút gọn "Xem yêu cầu đang xử lý" trên card đó (dù nút "Gửi yêu cầu tách
  điểm" của SPLIT cũng bị ẩn sai tương tự — đây là hạn chế đã tồn tại từ trước, không phải lỗi mới).
  Trader vẫn xem được đầy đủ qua "Yêu cầu của tôi". Không sửa vì ngoài phạm vi CONVERT.
- **Không seed dữ liệu mẫu CONVERT trong `data.js`** (khác SPLIT có sẵn 4 mẫu) — theo đúng tiền lệ
  của MERGE (cũng không seed). Đã tạo + hoàn tất 3 request demo trực tiếp qua UI trong quá trình
  test (YC-0019, YC-0021 COMPLETED; YC-0022 dùng để test blocking) — các bản ghi này chỉ tồn tại
  trong `localStorage` của phiên test trình duyệt, **không** được ghi vào file nguồn.

## 17. Known limitations

- Chỉ hỗ trợ `RELOCATE_TO_VACANT_POINT` (V1) — không có SWAP, sang nhượng, CL↔TTĐ.
- Điều kiện hợp đồng/công nợ/direct seller là **mock tracking**, không có logic nghiệp vụ thật đằng
  sau (không có workflow thanh lý/phụ lục hợp đồng tự động).
- Hậu kiểm hồ sơ (mục E) là tracking tối giản, không phải quy trình hành chính thật.
