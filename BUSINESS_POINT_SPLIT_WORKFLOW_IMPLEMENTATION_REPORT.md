# BÁO CÁO TRIỂN KHAI — Luồng nghiệp vụ TÁCH ĐIỂM KINH DOANH (Chợ Cao Lãnh)

Phạm vi: màn **Điểm kinh doanh**, Chợ Cao Lãnh, nghiệp vụ **Tách điểm** duy nhất. Không đụng Gộp điểm/Chuyển đổi điểm, không backend/API/DB thật.

## 1. File đã sửa

| File | Nội dung sửa |
|---|---|
| `data.js` | Bump `VERSION` 7 → 8. Thêm mảng `A.db.pointRequests` (build() trả về) + 3 bản ghi mẫu tối thiểu (YC-0015/0016/0017) tính từ chính dữ liệu điểm/tiểu thương thật đã seed sẵn (không hard-code số liệu minh hoạ lệch với model). |
| `js/permissions.js` | Thêm 4 permission key mới `action:diem-kd.tach-diem.{lap-yeu-cau,tiep-nhan,gui-phe-duyet,phe-duyet,thuc-hien}` (5 key) vào `CATALOG` + gán mặc định trong `actionRoles`. Bump `PERM_SEED_VERSION` 7 → 8 (không có migration tường minh — permKey hoàn toàn mới, tự bổ sung theo cơ chế merge sẵn có). |
| `js/v-tieuthuong.js` | (a) Bỏ nút "Tách điểm" + 2 handler mock `dkcl-split-open/save` khỏi drawer chi tiết điểm. (b) Thêm toàn bộ luồng nghiệp vụ mới: 2 tab "Danh sách điểm"/"Yêu cầu thay đổi", form lập yêu cầu, drawer chi tiết yêu cầu (4 mục A–D), form hoàn thiện phương án, phê duyệt/từ chối, thực hiện tách điểm thật (tạo 2 `stall` mới + đánh dấu điểm nguồn `structuralStatus: 'SPLIT'`). |
| `styles.css` | Thêm khối CSS mới cho `drawer-yc`, `split-plan/split-box/split-arrow/split-result`, `yc-steps/yc-step-*` — tái dùng token màu/spacing/radius hiện có (`--brand`, `--danger`, `--ok`...), không thêm palette mới. |

**Không sửa** `data.js`/`permissions.js` theo cách phá dữ liệu cũ: mọi field/permKey hiện có giữ nguyên, chỉ thêm mới.

Ghi chú: `js/core.js` và `js/v-dieuhanh.js` đang có sẵn 1 khối thay đổi CHƯA COMMIT từ trước khi bắt đầu task này (cơ chế điều hướng "← Quay lại" dùng chung `A.drawerPush/A.drawerBackHtml/A.drawerReset`) — task này **tái sử dụng nguyên** cơ chế đó cho luồng Tách điểm, **không sửa thêm** gì trong 2 file này.

## 2. File mới

Không có file `.js`/`.css` mới — chỉ thêm đúng 1 file báo cáo này.

## 3. Luồng Tách điểm đã triển khai

**Vị trí chức năng**: màn "Điểm kinh doanh" (chỉ khi `selectedMarket = CL`) nay có 2 tab: "Danh sách điểm" (giữ nguyên) và "Yêu cầu thay đổi (n)" + nút "+ Lập yêu cầu tách điểm" ở góc phải. Nút "Tách điểm" đã bỏ khỏi drawer chi tiết điểm.

**Model dữ liệu**: `A.db.pointRequests[]`, mỗi phần tử:
```
{ id: 'YC-00xx', type: 'SPLIT', market: 'CL', pointId, source: 'STAFF'|'TRADER',
  requestedByName, requestedByTraderId, requestedAt, reason, note, attachments: [{name}],
  status: DRAFT|STAFF_REVIEW|PENDING_APPROVAL|APPROVED|REJECTED|IMPLEMENTING|COMPLETED,
  plan: { a: {code, area, pointType, cat}, b: {...} } | null,
  timeline: [{key, at, by, note?}], resultPointIds: [id, id] | null }
```
`pointId` tham chiếu `stall.id` thật (`market-code`, đúng quy ước sẵn có) — **không** dùng `code` làm id.

**Luồng A — BQL chủ động**: "+ Lập yêu cầu tách điểm" mở drawer → chọn điểm (loại trừ điểm đã `structuralStatus:'SPLIT'`) → hệ thống tự hiển thị thông tin điểm + cảnh báo hợp đồng hiệu lực (nếu có) → tự sinh mã điểm mới (hậu tố A/B, né mã đã tồn tại) + diện tích mặc định chia đôi + ngành hàng theo đúng quy hoạch khu (`section.cat`) → người dùng chỉnh diện tích/loại điểm/ngành hàng, nhập lý do (*) → **Lưu yêu cầu** tạo request `status: STAFF_REVIEW`. Từ drawer chi tiết, nút **"Gửi phê duyệt"** chuyển `STAFF_REVIEW → PENDING_APPROVAL`.

**Luồng B — Tiểu thương đề nghị**: mock 2 bản ghi nguồn `TRADER` (YC-0015 đã có phương án + đã gửi; YC-0017 mới tạo, `plan: null`, `status: DRAFT` — mô phỏng "mong muốn" gửi từ Mini app, không xây Mini app mới). Nhân viên BQL mở request, bấm **"Tiếp nhận & hoàn thiện phương án"** (form giống Luồng A, thiếu phần chọn điểm vì đã cố định) → Lưu → `DRAFT → STAFF_REVIEW`, ghi cả 2 mốc `received`/`planned`. Sau đó cùng nút **"Gửi phê duyệt"** như Luồng A.

**Phê duyệt**: Trưởng BQL mở request `PENDING_APPROVAL` → **Phê duyệt** (chuyển `APPROVED`, có toast + `U.log`) hoặc **Từ chối** (nhập lý do bắt buộc TẠI CHỖ trong drawer — không dùng modal chồng lên drawer để tránh mất context, xem mục "← Quay lại" bên dưới) → `REJECTED`.

**Thực hiện**: chỉ khi `APPROVED`, nút **"Thực hiện tách điểm"** re-check đầy đủ (mục 8 bên dưới) rồi tạo 2 `stall` mới (`row/num: null` — không chèn vào lưới sơ đồ vật lý cố định của Mặt bằng chợ, tránh phá layout hàng/cột đã cấu hình sẵn), đặt `st.structuralStatus = 'SPLIT'` trên điểm nguồn (**không xoá**), ghi lịch sử ở cả điểm nguồn lẫn timeline yêu cầu, `status → COMPLETED`.

**Drawer chi tiết điểm** (KA-A01 sau khi tách) — mục C "Lịch sử thay đổi" hiển thị dòng tách + lý do; 2 điểm mới lưu `parentPointId`/`splitRequestId`, xem được qua nút "Xem KA-A01A/B" trong request hoặc trực tiếp từ danh sách điểm (2 mã mới xuất hiện trong "Danh mục điểm kinh doanh").

**"← Quay lại"**: mọi điều hướng từ request → điểm/tiểu thương đều qua `A.drawerPush(r.id, ...)` (tái dùng cơ chế có sẵn ở `core.js`), đã kiểm thử thực tế bằng trình duyệt.

## 4. Permission key đã thêm

```
action:diem-kd.tach-diem.lap-yeu-cau     — market_manager, market_staff
action:diem-kd.tach-diem.tiep-nhan       — market_staff
action:diem-kd.tach-diem.gui-phe-duyet   — market_manager, market_staff
action:diem-kd.tach-diem.phe-duyet       — market_manager
action:diem-kd.tach-diem.thuc-hien       — market_manager, market_staff
```
Không đổi bất kỳ permKey nào đã có (kể cả `cau-truc.edit`/`so-do.xem-ho-so` vẫn dùng nguyên cho Gộp/Chuyển đổi/Xem hồ sơ). Không đổi `screenRoles` — `screen:diem-kd` giữ nguyên danh sách role hiện có.

## 5. Migration permission

Không cần migration tường minh — 5 permKey **hoàn toàn mới**, không tồn tại ở bất kỳ state đã lưu nào, nên cơ chế merge sẵn có (`mergeIntoCurrentSeed()`/`loadState()` trong `permissions.js`) tự bổ sung đúng theo default matrix khi phát hiện `PERM_SEED_VERSION` lệch (7 → 8) — giống hệt cách xử lý v7 (bank account) trước đó. Không rewrite/thu hồi permKey nào khác.

## 6. Xác nhận không hard-code role

Mọi kiểm tra quyền trong code mới đều qua `A.canDo('diem-kd.tach-diem.xxx', market)` — không có bất kỳ `if (role === '...')`/`if (ui.role === '...')` nào trong toàn bộ logic tách điểm. Đã kiểm thử trực tiếp bằng cách đổi Account Demo (Trần Minh Khoa/market_manager, Phạm Văn Lợi/collector, Huỳnh Thanh Tâm/market_staff-TTD, Đặng Thị Thu/system_admin) và xác nhận nút/hành động ẩn-hiện đúng theo permission thật, **kể cả `system_admin` không tự động có bất kỳ quyền tách điểm nào** (đã kiểm tra `A.PERM.rolePermKeys('system_admin')` không chứa `tach-diem`).

## 7. Xác nhận market scope CL được kiểm tra

Mọi `A.canDo(...)` trong luồng đều truyền `targetMarket = 'CL'` (hoặc `r.market`/`st.market` của chính bản ghi) — `A.canDo` tự so khớp với `ui.market`/`A.allowedMarkets(account)` (cơ chế Phase 2 có sẵn, không viết lại). Đã kiểm thử: account chỉ có `marketScopes: ['TTD']` (Huỳnh Thanh Tâm, market_staff) → `A.canDo('diem-kd.tach-diem.lap-yeu-cau', 'CL')` trả về `false` dù đúng role, trong khi `A.canDo(..., 'TTD')` trả về `true` — xác nhận enforcement theo đúng chợ, không theo role suông.

## 8. Xác nhận handler mutation re-check

`dkreq-execute` (thực hiện tách) re-check TRỰC TIẾP trong handler, không chỉ dựa UI ẩn/hiện nút:
1. `A.canDo('diem-kd.tach-diem.thuc-hien', r.market)` — quyền + market scope.
2. `r.status === 'APPROVED'`.
3. `r.plan` tồn tại.
4. Điểm nguồn còn tồn tại + `st.market === 'CL'`.
5. `st.structuralStatus !== 'SPLIT'` (chưa tách trước đó).
6. Mã điểm mới (`plan.a.code`/`plan.b.code`) chưa tồn tại trong `A.db.stalls`.
7. Tổng diện tích khớp diện tích điểm nguồn (dung sai 0.05 m²).
8. Ngành hàng của cả 2 điểm mới nằm trong `dkZoneAllowedCats(st)`.

Đã kiểm thử bằng cách gọi thẳng `A.ACT['dkreq-execute']({dataset:{id:'YC-0015'}})` sau khi request đã `COMPLETED` (bỏ qua UI, nút đã ẩn) — handler tự chặn, không tạo thêm `stall`, không đổi `status`.

## 9. Xác nhận Gộp điểm / Chuyển đổi điểm CHƯA triển khai

Cả 2 vẫn là **PROTOTYPE INTERACTION cũ** (chỉ ghi 1 dòng lịch sử minh hoạ, không tạo/xoá `stall` thật) — giữ nguyên 100% logic, chỉ cập nhật lại đúng 1 đoạn comment giải thích (không đổi hành vi). Không thêm quy trình phê duyệt nào cho 2 nghiệp vụ này.

## 10. Static check / test hiện có

Dự án không có test suite tự động; đã chạy kiểm tra cú pháp cho mọi file JS đã sửa:
```
node --check data.js
node --check js/permissions.js
node --check js/core.js
node --check js/v-dieuhanh.js
node --check js/v-tieuthuong.js
```
Tất cả PASS. Đã build thử `data.js` bằng Node độc lập để xác nhận `pointRequests` sinh đúng, tổng diện tích khớp 100%.

## 11. Kiểm tra browser console

Đã chạy prototype qua HTTP server cục bộ, dùng Chrome thật thao tác đầy đủ: mở/đóng 2 tab, lập yêu cầu (Luồng A), tiếp nhận + hoàn thiện phương án (Luồng B, DRAFT → STAFF_REVIEW), gửi phê duyệt, từ chối (kèm lý do), phê duyệt, thực hiện tách điểm thật (tạo KA-A01A/KA-A01B từ KA-A01), xem lại lịch sử thay đổi điểm nguồn, điều hướng "← Quay lại" giữa request ↔ điểm kinh doanh, đổi qua nhiều Account Demo khác nhau (market_manager/collector/market_staff/system_admin), đổi chợ CL ↔ TTĐ, vào lại Tiểu thương/Hợp đồng/Mặt bằng chợ/Tài khoản/Cài đặt. **Không phát sinh lỗi console** ở bất kỳ bước nào.

## 12. Vấn đề phát hiện khi đọc code — KHÔNG tự ý refactor lớn

- **[ĐÃ XỬ LÝ ở phần Supplement bên dưới]** ~~Không có Account Demo mặc định nào có role `market_staff` scoped đúng `CL`~~ — task bổ sung (mục "Trưởng BQL chủ động đề xuất") đã thêm 1 Account Demo mới `AC-NV08` ("Nguyễn Văn A", `market_staff`, `marketScopes: ['CL']`) vì lúc đó việc demo Luồng 3 không thể thực hiện được nếu thiếu — xem mục "Supplement" cuối báo cáo.
- Model dữ liệu hiện tại (`data.js` MARKETS) mỗi khu (`section`) chỉ khai báo **đúng 1** ngành hàng quy hoạch (`section.cat`). Vì vậy `dkZoneAllowedCats()` trả về mảng 1 phần tử — đúng độ chi tiết dữ liệu hiện có, không bịa thêm cấu trúc "nhiều ngành/khu" chưa từng tồn tại.
- "Tình trạng hợp đồng đã được xử lý/đủ điều kiện" (mục 13 yêu cầu gốc) — vì yêu cầu gốc cấm tự động sửa/thanh lý hợp đồng, nên "Thực hiện tách điểm" **không** chặn cứng khi điểm còn hợp đồng hiệu lực (chỉ cảnh báo rõ ràng ở cả form lập yêu cầu lẫn drawer chi tiết) — nếu cần chặn cứng, cần xác nhận nghiệp vụ thêm (điểm gần như luôn có hợp đồng hiệu lực trong dữ liệu mẫu, chặn cứng sẽ khiến toàn bộ luồng không thể demo hoàn tất).

---

## Supplement: Manager-Initiated Split Request

Bổ sung nguồn khởi tạo thứ 3 — **Trưởng BQL chủ động đề xuất** (`source: 'MANAGER'`) — cho ĐÚNG nghiệp vụ Tách điểm đã triển khai ở trên. Không làm lại/revert phần đã có.

### 1. File đã sửa (phần bổ sung)

| File | Nội dung sửa |
|---|---|
| `data.js` | Bump `VERSION` 8 → 9. Mỗi `pointRequests[]` có thêm 2 field `createdBy`/`assignedTo`. Thêm bản ghi mẫu **YC-0018** (`source: 'MANAGER'`, `plan: null`, `status: 'STAFF_REVIEW'`). Cập nhật YC-0015/0016 để `assignedTo`/timeline actor trỏ đúng account nhân viên demo mới (xem bên dưới), thay vì tên chung chung "Trần Minh Khoa" cho cả việc lập lẫn duyệt. |
| `js/accounts.js` | Thêm 1 Account Demo mới `AC-NV08` ("Nguyễn Văn A", role `market_staff`, `marketScopes: ['CL']`) + hàm `mergeNewDefaultAccounts()` merge AN TOÀN account mới vào danh sách account đã lưu trong localStorage (không đụng account đã có, không bump `RBAC_SCHEMA`). |
| `js/permissions.js` | Thêm 1 permission key mới `action:diem-kd.tach-diem.assign` (mặc định chỉ `market_manager`). Bump `PERM_SEED_VERSION` 8 → 9. **Không đổi/revoke** bất kỳ permKey nào đã có ở phase trước (kể cả `lap-yeu-cau` của `market_manager` — xem mục 5). |
| `js/v-tieuthuong.js` | (a) 3 nguồn khởi tạo: `dkReqSourceLabel()` trả 3 nhãn; bộ lọc "Nguồn đề nghị" có 3 lựa chọn + "Tất cả". (b) Timeline riêng cho MANAGER (`DKREQ_STEPS_MANAGER`, có bước "đề xuất"/"giao việc"). (c) Form MỚI "Đề xuất tách điểm" (`dkma-*`, chỉ chọn điểm + lý do/chỉ đạo + chọn người xử lý — KHÔNG có phần phương án kỹ thuật) — nút "+ Lập yêu cầu tách điểm" tự route sang form này khi account chỉ có quyền `assign` (không có `tiep-nhan`). (d) Field `assignedTo`/`createdBy` trên request + cột "Người xử lý" trong bảng + dòng "Người xử lý" trong drawer chi tiết (mục A). (e) Nút "Phê duyệt" đổi nhãn thành "Phê duyệt phương án" khi `r.source === 'MANAGER'`. (f) Nút "Gửi phê duyệt" chỉ hiện khi `r.plan` đã tồn tại (tránh dẫn tới lỗi khi request MANAGER chưa có phương án). (g) `dkreq-plan-save` tự set `r.assignedTo` = tài khoản vừa lưu phương án (tự nhận nếu TRADER-request chưa ai nhận). |

Không có file mới ngoài chính report này (đã cập nhật, không tạo report thứ hai).

### 2. Model request sau bổ sung

```
{ id, type: 'SPLIT', market: 'CL', pointId,
  source: 'TRADER' | 'STAFF' | 'MANAGER',
  requestedByName, requestedByTraderId,     // giữ nguyên — tên hiển thị cache
  createdBy,   // id account (STAFF/MANAGER) HOẶC trader id (TRADER) — người KHỞI TẠO
  assignedTo,  // id account nhân viên đang/được giao XỬ LÝ, null nếu chưa ai nhận
  requestedAt, reason, note, attachments,
  status: DRAFT|STAFF_REVIEW|PENDING_APPROVAL|APPROVED|REJECTED|IMPLEMENTING|COMPLETED,
  plan: { a, b } | null, timeline: [{key, at, by, note?}], resultPointIds }
```
`createdBy` **không** giả định bằng `assignedTo` (mục 5 yêu cầu bổ sung) — ví dụ YC-0018: `createdBy: 'AC-NV01'` (Trần Minh Khoa), `assignedTo: 'AC-NV08'` (Nguyễn Văn A).

### 3. 3 source TRADER / STAFF / MANAGER

`source` **chỉ** là dữ liệu mô tả nguồn khởi tạo — không có bất kỳ `if (source === 'MANAGER')`/`if (ui.role === '...')` nào quyết định quyền ở bất kỳ đâu trong `js/v-tieuthuong.js`. Mọi action đều qua `A.canDo(...)`. Đã grep lại toàn bộ file để xác nhận không có nhánh rẽ theo `source` ngoài 2 chỗ THUẦN HIỂN THỊ (nhãn "Phê duyệt phương án" và tập bước timeline) — cả 2 đều không ảnh hưởng authorization.

Nhãn UI: TRADER → "Tiểu thương", STAFF → "Nhân viên BQL", MANAGER → "Trưởng BQL".

### 4. Luồng MANAGER → STAFF → MANAGER approval

1. Trưởng BQL (có permission `assign`, KHÔNG có `tiep-nhan`) bấm "+ Lập yêu cầu tách điểm" → hệ thống tự route sang form nhẹ "Đề xuất tách điểm" (KHÔNG bắt nhập diện tích/ngành hàng 2 điểm mới).
2. Chọn điểm (readonly info: mã/vị trí/khu vực/diện tích/ngành hàng/trạng thái/người thuê/hợp đồng/thời hạn — tái dùng nguyên `dksrPointInfoHtml()`), nhập lý do/chỉ đạo (*), chọn người xử lý (*) — dropdown CHỈ liệt kê account `ACTIVE` + `marketScopes` chứa `CL` + có permission `tiep-nhan` (lọc động qua `A.PERM.canAction(role, 'tiep-nhan')`, không so tên role) → **Giao xử lý** tạo **ĐÚNG 1** request `source: 'MANAGER'`, `plan: null`, `status: 'STAFF_REVIEW'`, `createdBy` = Trưởng BQL, `assignedTo` = người được chọn.
3. Nhân viên được giao mở **CHÍNH request đó** (không tạo request thứ 2, mục 4 yêu cầu bổ sung — đã kiểm thử bằng ID: `YC-0018` xuyên suốt từ lúc tạo tới `COMPLETED`), bấm "Tiếp nhận & hoàn thiện phương án" (nhãn tự chọn theo `!r.plan`, không theo `status`) → cùng 1 form phương án kỹ thuật đã có ở Luồng 2 → Lưu → vẫn `STAFF_REVIEW`, nay có `r.plan`.
4. Nhân viên bấm "Gửi phê duyệt" (chỉ hiện khi `r.plan` tồn tại) → `PENDING_APPROVAL`.
5. Trưởng BQL mở lại, thấy nút **"Phê duyệt phương án"**/"Từ chối" (không phải "Phê duyệt" trơn) → phê duyệt → `APPROVED`.
6. Nhân viên (hoặc Trưởng BQL, cả 2 đều có `thuc-hien`) bấm "Thực hiện tách điểm" → tạo 2 `stall` mới, điểm nguồn `structuralStatus: 'SPLIT'`, request `COMPLETED`.

Timeline hiển thị đủ 8 bước dành riêng cho MANAGER (`DKREQ_STEPS_MANAGER`): Trưởng BQL đề xuất → Đã giao nhân viên xử lý → Nhân viên tiếp nhận/kiểm tra hiện trạng → Hoàn thiện phương án → Trình lại Trưởng BQL phê duyệt phương án → Trưởng BQL phê duyệt phương án → Thực hiện tách điểm → Hoàn thành — tách rõ bước 1 ("đề xuất xem xét") khỏi bước 6 ("phê duyệt phương án đã được nhân viên kiểm tra/hoàn thiện"), đúng yêu cầu KHÔNG để hiểu lầm là "Trưởng BQL tự duyệt đề xuất của chính mình".

### 5. Permission thay đổi

Thêm ĐÚNG 1 permKey mới: `action:diem-kd.tach-diem.assign` (mặc định `market_manager`). Lý do cần permKey riêng (không dùng chung `lap-yeu-cau`): đây là 2 MUTATION khác nhau thật sự (tạo request với `plan` đầy đủ ngay, so với tạo request với `plan: null` + bắt buộc `assignedTo`), không chỉ khác label — nên giữ đúng nguyên tắc "1 action = 1 permKey" đã áp dụng xuyên suốt từ phase trước. Không tạo permission trùng lặp — đã kiểm tra 5 permKey cũ (`lap-yeu-cau`, `tiep-nhan`, `gui-phe-duyet`, `phe-duyet`, `thuc-hien`) đã đủ bao phủ "xem/tạo/tiếp nhận/gửi/phê duyệt/thực hiện", chỉ thiếu đúng hành vi "đề xuất + giao việc" nên mới thêm `assign`.

`market_manager` **vẫn giữ nguyên** `lap-yeu-cau` (không revoke) — form nào hiện ra do **thứ tự ưu tiên permission** quyết định (`tiep-nhan` → form đầy đủ; ngược lại có `assign` → form nhẹ), không phải do đổi ma trận `lap-yeu-cau`. Cách này tránh 1 migration ép buộc trên permKey đã tồn tại (đúng mục 17 yêu cầu bổ sung: ưu tiên thay đổi nhỏ nhất).

Default nghiệp vụ (khớp mục 12 yêu cầu bổ sung):
```
market_staff:   lap-yeu-cau, tiep-nhan, gui-phe-duyet, thuc-hien       (KHÔNG phe-duyet, KHÔNG assign)
market_manager: lap-yeu-cau, gui-phe-duyet, phe-duyet, thuc-hien, assign
```

### 6. Migration permission

`PERM_SEED_VERSION` 8 → 9. `action:diem-kd.tach-diem.assign` là permKey **hoàn toàn mới** → cơ chế merge sẵn có (`mergeIntoCurrentSeed()`/`loadState()`) tự bổ sung theo default matrix, **không đụng** bất kỳ grant/revoke tuỳ biến nào khác. Đã kiểm thử bằng cách giả lập state cũ (`seedVersion: 8`, tự revoke thủ công `market_staff` khỏi `thuc-hien`) rồi reload — xác nhận: `thuc-hien` của `market_staff` **vẫn bị revoke** (tuỳ biến được giữ), `assign` của `market_manager` **tự xuất hiện** (permKey mới tự bổ sung), `tiep-nhan` của `market_staff` không đổi.

Đồng thời bổ sung **account mới** `AC-NV08` — vì `A.RBAC_SCHEMA` (core.js) không đổi (bump sẽ kéo theo reseed toàn bộ role/account/UI state, quá rộng so với việc chỉ thêm 1 account demo), `js/accounts.js` tự viết 1 merge AN TOÀN riêng (`mergeNewDefaultAccounts()`) — chỉ thêm id account chưa từng tồn tại trong mảng đã lưu, không đụng account nào khác. Đã kiểm thử: giả lập localStorage "cũ" (thiếu `AC-NV08` + tự sửa tay `title` của 1 account khác) → reload → `AC-NV08` xuất hiện, tuỳ biến `title` **vẫn giữ nguyên**.

### 7. Business-state guards

- Nút "Gửi phê duyệt" chỉ hiện khi `r.status === 'STAFF_REVIEW' && r.plan` (trước đây chỉ theo status, request MANAGER mới tạo/giao việc có `plan: null` sẽ không hiện nút này nữa, tránh dẫn tới lỗi).
- Nhãn nút "Tiếp nhận & hoàn thiện phương án" / "Sửa phương án" nay xét theo `!r.plan` (nội dung thật) thay vì theo `status === 'DRAFT'` — đúng cho cả 3 nguồn: TRADER DRAFT chưa có `plan`, MANAGER STAFF_REVIEW chưa có `plan`, STAFF STAFF_REVIEW đã có `plan` ngay từ đầu.
- `dkreq-execute` giữ nguyên đầy đủ 8 điều kiện re-check đã có ở phase trước (không đổi) — đã kiểm thử lại cho cả request nguồn MANAGER (YC-0018): gọi trực tiếp handler sau khi `COMPLETED` → không tạo thêm `stall`, không đổi `status`.
- `COMPLETED`/`REJECTED` không còn action mutation nào hiện ra (đã kiểm thử `dkReqActionsHtml()` trả rỗng cho `YC-0015` sau khi hoàn thành ở phase trước, vẫn đúng với model mới).

### 8. Market-scope guards

Không đổi cơ chế — `dkma-save` (tạo đề xuất MANAGER) vẫn gọi `A.canDo('diem-kd.tach-diem.assign', 'CL')` (hard-code `'CL'`, đúng khoá phạm vi Chợ Cao Lãnh xuyên suốt cả 2 phase), và **re-check lại** điều kiện dropdown người xử lý (active + marketScopes chứa CL + có `tiep-nhan`) ngay trong handler lưu, không chỉ tin dữ liệu `<option>` đã render. Đã kiểm thử: account `market_staff` scope `TTD` (Huỳnh Thanh Tâm) không xuất hiện trong dropdown "Người xử lý" (chỉ `AC-NV08` scope `CL` xuất hiện); `A.canDo('diem-kd.tach-diem.assign', 'TTD')` → `false` khi `ui.market` đang là `CL`.

### 9. Regression test của cả 3 luồng

Chạy trực tiếp trên Chrome thật (HTTP server cục bộ), dùng data-act handler thật (không giả lập):

- **TEST A** (`YC-0017`, TRADER, DRAFT chưa ai nhận) → Nguyễn Văn A tiếp nhận (tự nhận `assignedTo`) + hoàn thiện phương án (`DRAFT → STAFF_REVIEW`) → gửi phê duyệt (`PENDING_APPROVAL`) → Trần Minh Khoa phê duyệt (nhãn "Phê duyệt" — KHÔNG "phương án", đúng vì `source !== 'MANAGER'`) → Nguyễn Văn A thực hiện → tạo `CL-RC-A01A`/`CL-RC-A01B`, `COMPLETED`. **PASS**.
- **TEST B** (`YC-0016`, STAFF, đã có `plan` sẵn) → Nguyễn Văn A gửi phê duyệt → Trần Minh Khoa phê duyệt → Nguyễn Văn A thực hiện → tạo `CL-KA-A03A`/`CL-KA-A03B`, `COMPLETED`. **PASS**.
- **TEST C** (`YC-0018`, MANAGER, `plan: null` lúc tạo) → Trần Minh Khoa KHÔNG cần nhập phương án kỹ thuật khi tạo (đã xác nhận form không có field diện tích/ngành hàng) → giao Nguyễn Văn A → Nguyễn Văn A tiếp nhận + hoàn thiện phương án → gửi phê duyệt → Trần Minh Khoa thấy nút **"Phê duyệt phương án"** (đã xác nhận đúng label) → phê duyệt → Nguyễn Văn A thực hiện → tạo `CL-KB-A02A`/`CL-KB-A02B`, `COMPLETED`. **PASS**.
- Tạo **request MANAGER mới hoàn toàn** qua UI thật (chọn điểm KA-A04, chọn người xử lý qua dropdown đã lọc đúng, Giao xử lý) → `YC-0019` tạo đúng `source: 'MANAGER'`, `plan: null`, `createdBy`/`assignedTo` đúng. **PASS**.
- Nhân viên (Nguyễn Văn A, không có `phe-duyet`) mở request `PENDING_APPROVAL` → không thấy nút "Phê duyệt"/"Từ chối". **PASS** (STAFF không tự phê duyệt được).
- `A.ACT['dkreq-execute']` không mutate business point tại bước "Phê duyệt" (chỉ đổi `status`, `stall`/`A.db.stalls.length` không đổi cho tới khi bấm "Thực hiện tách điểm" riêng) — đã xác nhận qua từng bước ở TEST A/B/C.
- Reload trang (F5) sau khi hoàn thành cả 4 request — `A.db.pointRequests` giữ nguyên trạng thái đã lưu (localStorage) — **PASS**, không mất dữ liệu.
- Không phát sinh lỗi console ở bất kỳ bước nào trong toàn bộ quá trình test trên (đã kiểm tra `read_console_messages` nhiều lần xuyên suốt).
- Regression các màn khác: Tiểu thương, Hợp đồng, Mặt bằng chợ, Tài khoản người dùng, Cài đặt & phân quyền (đã xác nhận permKey `assign` xuất hiện đúng trong màn "Vai trò & phân quyền") — không lỗi.

### 10. Xác nhận Mini App chưa sửa

Không đụng `js/mini.js`/màn Mini app tiểu thương. Model `pointRequests` vẫn dùng đúng field cũ cho nguồn `TRADER` (`requestedByTraderId`, `createdBy` = trader id) — sẵn sàng để 1 task sau nối UI Mini App thật vào (tạo request `source: 'TRADER'` qua `A.db.pointRequests.push(...)` theo đúng shape đã có), không cần đổi model.

### 11. Xác nhận Gộp/Chuyển đổi CHƯA triển khai

Không đụng `dkcl-merge-open/save`, `dkcl-convert-open/save` trong task bổ sung này — không thêm form/handler/mock workflow nào cho 2 nghiệp vụ đó. Toàn bộ thay đổi bổ sung chỉ nằm trong phạm vi nghiệp vụ Tách điểm.
