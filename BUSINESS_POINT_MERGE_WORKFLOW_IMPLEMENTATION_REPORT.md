# Business Point Merge Workflow — Implementation Report

## 1. Pre-audit

- `A.db.pointRequests` là collection dùng chung của workflow thay đổi điểm; MERGE được thêm bằng `type: 'MERGE'`, không có `mergeRequests[]` riêng.
- Điểm kinh doanh hiện có `floor`, `section`, `row`, `num`; không có geometry/span mặt bằng.
- Hợp đồng đang gắn theo `stallId`. Không có mutation hợp đồng trong workflow này.
- Dữ liệu người trực tiếp kinh doanh được lấy từ `A.db.directSellerAssignments`, tách biệt với chủ thể hợp đồng (`traderId`).
- Permission runtime dùng `A.canDo(...)` và account từ `A.ACCOUNTS`.

## 2. Files changed for MERGE

- `data.js`: nâng schema mock để nhận dữ liệu MERGE trong shared request store.
- `js/permissions.js`: sáu permission `diem-kd.gop-diem.*` và safe permission migration.
- `js/v-tieuthuong.js`: Web BQL, candidate, request detail, plan, approval, execution, lịch sử hai chiều.
- `js/mini.js`: Mini App gửi/theo dõi MERGE dùng cùng `A.db.pointRequests`.

## 3. UI implemented

Trong **Điểm kinh doanh → Yêu cầu thay đổi**, bảng chung hiển thị Tách điểm/Gộp điểm, nguồn, người đề nghị, **Người phụ trách**, ngày gửi và trạng thái. Hai nút tạo request được giữ riêng để không làm regression phần Tách đã pass.

Form Gộp gồm các section A–D: chọn điểm thứ nhất, candidate liền kề, so sánh hiện trạng/hợp đồng, và phương án. Drawer chi tiết MERGE thể hiện hai điểm nguồn, chủ thể hợp đồng, người trực tiếp KD, điều kiện hợp đồng, phương án, timeline và action footer.

## 4. MERGE request schema

Mỗi request có `type`, `market`, `sourcePointIds` (đúng 2 internal id), `createdBy`, `assignedTo`, source/request metadata, `plan`, `timeline` và `resultPointIds`. Schema này nằm trong `A.db.pointRequests` và giữ tương thích với SPLIT.

## 5. Candidate / adjacency rule

V1 chỉ hiển thị điểm cùng `market=CL`, cùng `floor`, `section`, `row`, và `num` chênh đúng 1; điểm phải ACTIVE về cấu trúc và không thuộc request cấu trúc active khác.

Đây là **prototype adjacency rule**, không phải business rule mặt bằng chính thức.

## 6. Contract behavior

- Không có hợp đồng: condition mặc định `RESOLVED`.
- Cùng chủ thể nhưng hợp đồng còn hiệu lực: warning; plan/approval được phép, execution cần nhân viên xác nhận mock condition là `RESOLVED`.
- Khác người sử dụng/chủ thể: warning mạnh/blocker; request vẫn được lập/plan/approve, execution bị chặn cho tới khi condition mock được xác nhận.

Không tự sửa, chuyển, gộp hoặc chấm dứt hợp đồng.

## 7. assignedTo and state machine

- TRADER: `DRAFT`, `assignedTo=null`; staff có permission tiếp nhận sẽ trở thành người phụ trách.
- STAFF: tạo request và tự là `assignedTo`.
- MANAGER: chọn một NV BQL CL đủ permission; request bắt đầu `STAFF_REVIEW`, `plan=null` để NV được giao hoàn thiện.

`assignedTo` không đổi sau approval. Chỉ assigned staff có action staff và execution; người khác vẫn có thể xem khi có screen permission. Stored state machine dùng chung: `DRAFT → STAFF_REVIEW → PENDING_APPROVAL → APPROVED → COMPLETED`, hoặc `REJECTED`.

## 8. Approval and atomic execution

Approval chỉ cập nhật `status` và timeline, không tạo/sửa business point.

Execution re-check account active, scope CL, permission, ownership, request/status/type, đúng hai source, structural active, adjacency prototype, unique result code, category zone, contract condition. Tất cả validation diễn ra trước mutation.

Khi thành công, hai source thành `MERGED` nhưng không bị xóa; result point có internal id riêng, `sourcePointIds`, `mergeRequestId`, `row:null`, `num:null`; request được `COMPLETED` và có `resultPointIds`.

## 9. History and floorplan

Source và result đều ghi history/back-reference; popup điểm nguồn có thể mở điểm kết quả và popup result có thể mở source.

Không hack geometry, colspan, CSS width, row hay num. Result hiển thị notice cần cập nhật ánh xạ tại Cấu hình mặt bằng.

## 10. Mini App

Mini App chỉ cho trader gửi MERGE khi cả hai điểm thuộc `t.stalls` của chính trader, active và liền kề theo prototype. Trader không nhập result code, area, category, contract handling hay approver. Request tạo ra là `source:'TRADER'`, `assignedTo:null`, `DRAFT` trong shared store.

Cross-trader consent workflow không được triển khai.

## 11. Static checks

PASS:

- `node --check` cho toàn bộ JS thay đổi.
- `git diff --check`.

## 12. Browser regression

NOT RUN in this workspace: không có Playwright/Puppeteer/Selenium hoặc browser automation runner được cài/khả dụng. Vì vậy không tuyên bố PASS end-to-end.

| Case | Result |
| --- | --- |
| A–C: STAFF/TRADER/MANAGER end-to-end | NOT RUN — browser unavailable |
| D–F: adjacency, structural source, conflict | NOT RUN — browser unavailable |
| G–H: contract warning/blocker | NOT RUN — browser unavailable |
| I–K: approval separation, execution, duplicate code | NOT RUN — browser unavailable |
| L–M: ownership/view and Mini App ownership | NOT RUN — browser unavailable |
| N: SPLIT regression | NOT RUN — browser unavailable |
| O: floorplan no-geometry regression | NOT RUN — browser unavailable |

Các luồng đã được kiểm tra tĩnh và các handler có re-check theo yêu cầu.

## 13. NEED_CONFIRMATION / limitations

- Quy tắc row/num adjacency chỉ là prototype; cần rule/geometry chính thức trước production.
- `KA-A04-05` là prototype code convention; cần convention chính thức.
- `contractCondition` là mock state xác nhận điều kiện; không thay thế workflow hợp đồng.
- Không implement consent liên tiểu thương, Chuyển đổi điểm, backend/API/upload thật hoặc cập nhật geometry mặt bằng.
