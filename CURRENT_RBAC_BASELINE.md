# CURRENT RBAC BASELINE — Hệ thống quản lý chợ số phường Cao Lãnh (Prototype)

> Tài liệu **KIỂM KÊ hiện trạng** (baseline v1), không phải đặc tả yêu cầu. Mọi dòng đều được rút ra trực
> tiếp từ mã nguồn tại thời điểm viết (đọc toàn văn `index.html`, `data.js`, `js/core.js`,
> `js/permissions.js`, `js/accounts.js`, `js/serviceconfig.js`, `js/v-cautruc.js`, `js/v-dieuhanh.js`,
> `js/v-tieuthuong.js`, `js/v-taichinh.js`, `js/v-vanhanh.js`, `js/mini.js`). Không tự thêm role, screen,
> action hay permission nào ngoài những gì code thể hiện. Ký hiệu:
> **[OBSERVED]** xác nhận trực tiếp từ code · **[INFERRED]** suy luận từ code nhưng chưa có rule rõ ràng ·
> **[MISSING]** chưa tồn tại · **[NEED_CONFIRMATION]** chưa đủ thông tin nghiệp vụ.
>
> Ghi chú: thư mục dự án có sẵn `SYSTEM_PROTOTYPE_REVIEW.md` (chưa commit, có từ trước) — là một bản phân
> tích dở dang (dừng ở mục 7.7/40 lời hứa ban đầu). Tài liệu này được viết độc lập từ việc đọc lại toàn bộ
> mã nguồn, có đối chiếu chéo với file đó ở những chỗ trùng phạm vi.

---

# 1. Current Roles

## 1.1 Role có hiệu lực thật trong permission engine

Nguồn duy nhất của "role" mà `A.PERM`/`U.can()` sử dụng: `js/permissions.js`, hàm `defaultRoles()`
(dòng 86‑92), lưu động ở `localStorage['choso-caolanh-permissions']`.

| Role ID | Tên hiển thị | Khai báo tại | scope | selfService | builtin | Đang được dùng ở đâu | Trạng thái |
|---|---|---|---|---|---|---|---|
| `lanhdao` | Lãnh đạo phường | `js/permissions.js:88` | `all` | false | true | Role selector topbar (`core.js:303`), toàn bộ `U.can`/`A.PERM.canAction` | [OBSERVED] |
| `bql` | Ban Quản lý chợ | `js/permissions.js:89` | `all` | false | true | như trên; mặc định `ui.role` khi khởi tạo (`core.js:10`) | [OBSERVED] |
| `tieuthuong` | Tiểu thương | `js/permissions.js:90` | `self` | true | true | Role selector; khi chọn tự chuyển vào `mini-app` (`core.js:327,345`) | [OBSERVED] |

Đây là **toàn bộ** danh sách role có hiệu lực permission mặc định. Màn **Cài đặt & phân quyền → Vai trò &
phân quyền** (`js/v-vanhanh.js:793‑900`) cho phép **thêm/sửa/vô hiệu hoá/xoá role tại runtime** qua
`A.PERM.addRole/updateRole/setRoleActive/removeRole` — nghĩa là danh sách role **không cố định 3 phần tử**,
có thể mở rộng bởi bất kỳ ai vào được màn `cai-dat`. Role mới không có permission nào mặc định (phải tick
tay từng permission ở ma trận `permsMatrixHtml`, `v-vanhanh.js:372‑385`). [OBSERVED]

## 1.2 Role chỉ dùng để demo / hiển thị — KHÔNG điều khiển permission

| Nguồn | Khai báo tại | Nội dung | Dùng ở đâu | Ảnh hưởng permission? |
|---|---|---|---|---|
| `D.STAFF[].role` (text) | `data.js:90‑98` | 7 bản ghi: Trưởng BQL chợ, Kế toán, NV thu phí ×2, NV kỹ thuật, Tổ quản lý chợ quê, NV thu phí phiên | Dropdown "Người xử lý" trong Phản ánh & sự cố (`v-vanhanh.js:49`), `U.staffName()` hiển thị tên khắp nơi | **Không** — thuần nhãn hiển thị/danh bạ |
| `D.ROLES` | `data.js:100‑108` | 7 dòng mô tả role/scope/rights (Lãnh đạo UBND phường, Trưởng BQL, Kế toán, NV thu phí, NV kỹ thuật, Tiểu thương, Quản trị hệ thống) | **Không có nơi nào tham chiếu** ngoài 1 dòng comment ở `permissions.js:166` (đã grep xác nhận toàn project) | **Không — dead data** |
| `A.ACCOUNTS.ACCOUNT_TYPES` | `js/accounts.js:12` | 5 loại: Quản trị hệ thống, Lãnh đạo UBND phường, Ban Quản lý chợ, Nhân viên Ban Quản lý chợ, Tiểu thương | Field `accountType` hiển thị/lọc trong màn Tài khoản người dùng (`v-vanhanh.js:255,286`) | **Không** — chỉ filter/hiển thị trong chính màn Tài khoản |

## 1.3 Account (`js/accounts.js`) — hồ sơ độc lập, KHÔNG có cơ chế đăng nhập

`A.ACCOUNTS` (CRUD tại `js/accounts.js:41‑54`) lưu các bản ghi `{id, code, fullName, accountType, roleIds,
organization, marketScopes, status}`, seed 9 bản ghi mặc định (7 từ `D.STAFF` + `AC-LD01`, `AC-QT01`,
`AC-TT01`, `AC-TT02`, dòng 14‑27). Field `roleIds` có giá trị là id của role thật (`['bql']`,
`['lanhdao']`, `['tieuthuong']`) — **trông giống** liên kết Account→Role, nhưng:

- Không có màn đăng nhập, không có `sessionUser`, không có hàm nào đọc `A.ACCOUNTS` để set `ui.role`.
- Nút "Vai trò" ở topbar (`data-act="role"`, `core.js:342‑346`) chỉ đổi trực tiếp biến toàn cục `ui.role`
  giữa 3 giá trị ở mục 1.1, hoàn toàn độc lập với danh sách Account.
- Sửa `roleIds`/`marketScopes`/`status` của 1 account trong màn Tài khoản người dùng **không** làm thay đổi
  hành vi ứng dụng ở bất kỳ nơi nào khác (đã grep toàn project, không có `A.ACCOUNTS.get`/`list` nào được
  gọi ngoài chính `v-vanhanh.js` phần render/quản lý màn Tài khoản).

[OBSERVED] — xem thêm mục 9.4.

---

# 2. Current Navigation / Screens

Nguồn: `A.MENU` (`js/core.js:257‑287`) + hàm lọc `chrome()` (`core.js:291‑309`, lọc bằng `U.can(it.id)` →
`A.PERM.canScreen`). Cấu trúc hiện tại (sau lần tái tổ chức menu gần nhất — "Điểm kinh doanh" đã chuyển vào
nhóm Điều hành / Hạ tầng chợ):

```
ĐIỀU HÀNH
  Tổng quan liên chợ            tong-quan
  — Hạ tầng chợ (nhãn phụ, không phải screen) —
  Thiết lập mặt bằng chợ        cau-truc
  Sơ đồ mặt bằng                so-do
  Điểm kinh doanh                diem-kd
  Phiên chợ quê                  phien-cho

TIỂU THƯƠNG & HỢP ĐỒNG
  Tiểu thương                    tieu-thuong
  Hợp đồng                       hop-dong   (badge = số HĐ hiệu lực còn ≤30 ngày)

TÀI CHÍNH
  Chỉ số điện, nước              dien-nuoc
  Khoản phải thu                 phai-thu
  Thu tiền & biên lai            thu-tien
  Đối soát                       doi-soat   (badge = số GD ngân hàng chưa khớp)
  Công nợ & nhắc nợ              cong-no

VẬN HÀNH
  Phản ánh & sự cố               su-co      (badge = số phản ánh "Tiếp nhận")
  Thông báo đa kênh              thong-bao
  Báo cáo thống kê               bao-cao
  Tài khoản người dùng           tai-khoan
  Cài đặt & phân quyền           cai-dat

DÀNH CHO TIỂU THƯƠNG
  Mini app tiểu thương           mini-app
```

18 mục menu = 18 hàm `A.VIEWS[...]` = 18 permission `screen:*` trong catalog — khớp 1‑1, **không có screen
nào có route nhưng thiếu trong menu, và không có mục menu nào trỏ tới view không tồn tại.** [OBSERVED, đã
đối chiếu `A.MENU` với toàn bộ khai báo `A.VIEWS[...]` trong 12 file JS].

Route cũng được chặn ở tầng router, không chỉ ẩn menu: `A.route()` (`core.js:324‑333`) — nếu
`!U.can(r)` thì tự chuyển hướng về màn mặc định. Do đó **gõ thẳng URL hash `#/cai-dat` khi không có quyền
sẽ KHÔNG vào được màn đó** — đây không phải là một khoảng trống (ngược lại với giả định "menu ẩn nhưng route
vẫn vào được" nêu trong mục Gaps mẫu của đề bài). [OBSERVED]

| Module | Screen ID | Tên màn hình | Render function | Permission hiện tại | Market hiện tại | Source |
|---|---|---|---|---|---|---|
| Điều hành | `tong-quan` | Tổng quan liên chợ | `A.VIEWS['tong-quan']` | `screen:tong-quan` | `ui.market` (qua `U.inM`) | `js/v-dieuhanh.js:50` |
| Điều hành / Hạ tầng chợ | `cau-truc` | Thiết lập mặt bằng chợ | `A.VIEWS['cau-truc']` | `screen:cau-truc` | `ui.market`/`ui.qh.market` — chỉ chọn layout 1 chợ để xem, **không** filter dữ liệu thật (module tự nhận độc lập, `v-cautruc.js:1‑6`) | `js/v-cautruc.js:170` |
| Điều hành / Hạ tầng chợ | `so-do` | Sơ đồ mặt bằng | `A.VIEWS['so-do']` | `screen:so-do` | `ui.market`/`ui.planMarket` | `js/v-dieuhanh.js:146` |
| Điều hành / Hạ tầng chợ | `diem-kd` | Điểm kinh doanh | `A.VIEWS['diem-kd']` | `screen:diem-kd` | `ui.market` | `js/v-tieuthuong.js:19` |
| Điều hành | `phien-cho` | Phiên chợ quê | `A.VIEWS['phien-cho']` | `screen:phien-cho` | **Cố định TTD**, không đọc `ui.market` (xem mục 6) | `js/v-dieuhanh.js:213` |
| Tiểu thương & hợp đồng | `tieu-thuong` | Tiểu thương | `A.VIEWS['tieu-thuong']` | `screen:tieu-thuong` | `ui.market` | `js/v-tieuthuong.js:51` |
| Tiểu thương & hợp đồng | `hop-dong` | Hợp đồng | `A.VIEWS['hop-dong']` | `screen:hop-dong` | `ui.market` | `js/v-tieuthuong.js:120` |
| Tài chính | `dien-nuoc` | Chỉ số điện, nước | `A.VIEWS['dien-nuoc']` | `screen:dien-nuoc` | `ui.market` + `ui.period` (`A.db.meterPeriods`, dùng chung) | `js/v-taichinh.js:80` |
| Tài chính | `phai-thu` | Khoản phải thu | `A.VIEWS['phai-thu']` | `screen:phai-thu` | `ui.market` + `ui.period` (`A.db.billingPeriods`) | `js/v-taichinh.js:214` |
| Tài chính | `thu-tien` | Thu tiền & biên lai | `A.VIEWS['thu-tien']` | `screen:thu-tien` | `ui.market` + `f.thuDate` riêng | `js/v-taichinh.js:340` |
| Tài chính | `doi-soat` | Đối soát | `A.VIEWS['doi-soat']` | `screen:doi-soat` | `ui.market` + `ui.dsFrom/dsTo` riêng | `js/v-taichinh.js:410` |
| Tài chính | `cong-no` | Công nợ & nhắc nợ | `A.VIEWS['cong-no']` | `screen:cong-no` | `ui.market` + `f.cnAsOf/cnOrigin` riêng | `js/v-taichinh.js:667` |
| Vận hành | `su-co` | Phản ánh & sự cố | `A.VIEWS['su-co']` | `screen:su-co` | `ui.market` | `js/v-vanhanh.js:15` |
| Vận hành | `thong-bao` | Thông báo đa kênh | `A.VIEWS['thong-bao']` | `screen:thong-bao` | Không filter `ui.market` (chọn nhóm gửi thủ công trong form) | `js/v-vanhanh.js:119` |
| Vận hành | `bao-cao` | Báo cáo thống kê | `A.VIEWS['bao-cao']` | `screen:bao-cao` | `ui.market` (đa số báo cáo dùng `U.inM`) | `js/v-vanhanh.js:179` |
| Vận hành | `tai-khoan` | Tài khoản người dùng | `A.VIEWS['tai-khoan']` | `screen:tai-khoan` | Filter riêng theo `a.marketScopes` (field `f.market` của chính màn này, **độc lập** với `ui.market` topbar) | `js/v-vanhanh.js:266` |
| Vận hành | `cai-dat` | Cài đặt & phân quyền | `A.VIEWS['cai-dat']` | `screen:cai-dat` | Không có scope theo chợ (cấu hình gắn `marketId` từng bản ghi) | `js/v-vanhanh.js:816` |
| Dành cho tiểu thương | `mini-app` | Mini app tiểu thương | `A.VIEWS['mini-app']` | `screen:mini-app` | Không dùng `ui.market` — theo `t.market` của tiểu thương đang xem; `#market-wrap` bị ẩn khi ở màn này (`core.js:305`) | `js/mini.js:126` |

Không phát hiện màn hình "chết"/trùng lặp/có route nhưng không nằm trong navigation.

---

# 3. Screen Actions

Ký hiệu **Permission hiện tại**: tên `action:*` key nếu có kiểm tra qua `A.PERM.canAction`; `MISSING_ACTION_PERMISSION`
nếu không có bất kỳ permission action nào (chỉ dựa permission màn hình bao trùm); `HARDCODED_ROLE_CHECK` nếu so
sánh trực tiếp `ui.role === '...'`. **Status**: `MOCK_WORKING` (ghi thật vào `A.db`/`localStorage` nhưng nghiệp vụ
là mô phỏng), `WORKING_FE` (tính toán/validate thật ở FE), `PLACEHOLDER` (luôn trả kết quả cố định), `UI_ONLY`
(có nút nhưng không có handler ghi dữ liệu thật ngoài toast).

## 3.1 Tổng quan liên chợ (`tong-quan`)
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `tongquan.view` | render 8 KPI, biểu đồ, bảng so sánh 2 chợ | `A.VIEWS['tong-quan']` | screen only | `v-dieuhanh.js:50‑107` | WORKING_FE |
| `tongquan.goToAlert` | nút "Xem" ở cảnh báo | `A.ACT.go` | screen của màn đích (qua `U.can` khi render nút) | `v-dieuhanh.js:103` | WORKING_FE |
| `tongquan.openEscalated` | nút "Mở" phản ánh vượt cấp | `A.ACT['inc-open']` | screen `su-co` (ngầm định, không re-check tại đây) | `v-dieuhanh.js:105` | WORKING_FE |

## 3.2 Thiết lập mặt bằng chợ (`cau-truc`)
Toàn bộ dữ liệu ở đây là bản quy hoạch nháp riêng (`localStorage['choso-caolanh-layout']`), **không** ghi/đọc
`stalls` thật (tự nhận trong comment đầu file `v-cautruc.js:1‑6`).

| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `cautruc.addBlock` | "+ Thêm khối/nhà chợ" | `qh-add-block` → `qh-add-block-save` | **MISSING_ACTION_PERMISSION** | `v-cautruc.js:209‑218` | MOCK_WORKING |
| `cautruc.editBlock` | "Sửa" khối | `qh-edit-block` → `qh-edit-block-save` | **MISSING_ACTION_PERMISSION** | `v-cautruc.js:219‑231` | MOCK_WORKING |
| `cautruc.delBlock` | "Xoá" khối | `qh-del-block` → `qh-del-block-ok` | **MISSING_ACTION_PERMISSION** (chỉ có business rule: chặn nếu còn khu) | `v-cautruc.js:232‑244` | MOCK_WORKING |
| `cautruc.addFloor`/`editFloor`/`delFloor` | +Tầng / Sửa / Xoá | `qh-add-floor*`, `qh-edit-floor*`, `qh-del-floor*` | **MISSING_ACTION_PERMISSION** | `v-cautruc.js:245‑281` | MOCK_WORKING |
| `cautruc.addZone`/`delZone` | +Khu / Xoá khu | `qh-add-zone-save`, `qh-del-zone*` | **MISSING_ACTION_PERMISSION** (validate mã khu trùng) | `v-cautruc.js:282‑315` | MOCK_WORKING |
| `cautruc.editZoneField` | sửa field 1 khu | `qh-zone-field` | **MISSING_ACTION_PERMISSION** | `v-cautruc.js:348‑356` | MOCK_WORKING |
| `cautruc.plannedType` | thêm/sửa/xoá "loại điểm dự kiến" | `qh-pt-add`, `qh-pt-field`, `qh-pt-del` | **MISSING_ACTION_PERMISSION** | `v-cautruc.js:316‑327,357‑366` | MOCK_WORKING |
| `cautruc.saveDraft`/`saveFinal` | Lưu nháp / Lưu và tiếp tục | `qh-save-draft`, `qh-save-final` | **MISSING_ACTION_PERMISSION** | `v-cautruc.js:329‑345` | WORKING_FE (có `validateZone()` thật) |
| `cautruc.resetLayout` | "Khôi phục cấu trúc mặc định" | `qh-reset` → `qh-reset-ok` | **MISSING_ACTION_PERMISSION** (ghi đè toàn bộ layout 1 chợ) | `v-cautruc.js:199‑208` | MOCK_WORKING |

Toàn bộ 9 nhóm action (≈20 handler cụ thể) của màn này chỉ dựa vào `screen:cau-truc` (`['bql']`) — không có
bất kỳ `action:cau-truc.*` nào trong CATALOG.

## 3.3 Sơ đồ mặt bằng (`so-do`)
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `sodo.filter` | chọn chợ/tầng, tìm kiếm, legend | `plan-market`,`plan-floor`,`legend`,input `plan-search` | screen only | `v-dieuhanh.js:186‑210` | WORKING_FE |
| `sodo.select` | bấm 1 ô xem panel | `stall` (`ui.sel`) | screen only | `v-dieuhanh.js:190` | WORKING_FE |
| `so-do.xem-ho-so` | link "Hồ sơ" trong panel | `A.ACT.trader` | `action:so-do.xem-ho-so` | `v-dieuhanh.js:124,141` | WORKING_FE |
| `so-do.tao-hop-dong` | nút "Tạo hợp đồng" (điểm trống) | `ct-new` (dùng chung Hợp đồng) | `action:so-do.tao-hop-dong` | `v-dieuhanh.js:125,141` | MOCK_WORKING |
| `so-do.doi-trang-thai` | nút "Đổi trạng thái" | `stall-status` → `stall-status-save` | `action:so-do.doi-trang-thai` (chỉ gate nút hiện; **handler `stall-status-save` không re-check**) | `v-dieuhanh.js:126,142,191‑208` | MOCK_WORKING |
| `thu-tien.thu` | nút "Thu tiền" trong panel | `pay-open` | `action:thu-tien.thu` | `v-dieuhanh.js:123,140` | MOCK_WORKING |

## 3.4 Phiên chợ quê (`phien-cho`)
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `phienchoq.view` | KPI, biểu đồ, lịch sử phiên | render | screen only | `v-dieuhanh.js:213‑235` | WORKING_FE |
| `phien-cho.chot-phien` | "Điểm danh & chốt phiên" | `session-open` → `session-save` | `action:phien-cho.chot-phien` (chỉ gate nút hiện; **`session-save` không re-check**) | `v-dieuhanh.js:227,238‑252` | MOCK_WORKING — tạo bản ghi `sessions`, **không** tạo Invoice/khoản phải thu liên kết |

## 3.5 Điểm kinh doanh (`diem-kd`)
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `diemkd.filter` | lọc khu vực/trạng thái/tìm kiếm | `dk-section`,`dk-status`,input `dk-search` | screen only | `v-tieuthuong.js:35‑37` | WORKING_FE |
| `diemkd.export` | "Xuất Excel" | `dk-csv` | **MISSING_ACTION_PERMISSION** (screen only) | `v-tieuthuong.js:38` | WORKING_FE (CSV thật qua Blob) |
| `diemkd.detail` | click dòng → modal chi tiết | `dk-open` → `A.stallPanel` | screen only (các nút thao tác bên trong panel vẫn theo `action:so-do.*`/`thu-tien.thu`) | `v-tieuthuong.js:39‑42` | WORKING_FE |

## 3.6 Tiểu thương (`tieu-thuong`)
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `tieuthuong.filter` | lọc mini app, tìm kiếm | `tt-app`, input `tt-search` | screen only | `v-tieuthuong.js:66‑67` | WORKING_FE |
| `tieuthuong.detail` | click dòng → hồ sơ | `A.ACT.trader` | screen only | `v-tieuthuong.js:69‑88` | WORKING_FE |
| `tieu-thuong.them-moi` | "+ Thêm tiểu thương" | `tt-new` → `tt-save` | `action:tieu-thuong.them-moi` (chỉ gate nút hiện; **`tt-save` không re-check**) | `v-tieuthuong.js:56,106‑117` | WORKING_FE (validate CCCD không trùng thật) |
| `tieuthuong.ocr` | "Quét CCCD (OCR giả lập)" | `tt-ocr` | Nằm trong form đã gate bởi `tieu-thuong.them-moi`, không re-check riêng | `v-tieuthuong.js:107` | **PLACEHOLDER** — luôn trả 1 bộ dữ liệu mẫu cố định (`OCR_SAMPLE`) |
| `thu-tien.thu` (từ hồ sơ) | nút "💳 Thu tiền" trong modal hồ sơ | `pay-open` | `action:thu-tien.thu` **và** phải có công nợ | `v-tieuthuong.js:87` | MOCK_WORKING |

## 3.7 Hợp đồng (`hop-dong`)
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `hopdong.filter` | 3 tab + tìm kiếm | `hd-tab`, input `hd-search` | screen only | `v-tieuthuong.js:142‑143` | WORKING_FE |
| `hopdong.create` | "+ Tạo hợp đồng" trên chính màn Hợp đồng | `ct-new` → `ct-new-save` | **MISSING_ACTION_PERMISSION** (khi gọi từ Sơ đồ có `so-do.tao-hop-dong` gate nút, nhưng gọi trực tiếp từ nút này trên màn Hợp đồng thì KHÔNG có gate nào) | `v-tieuthuong.js:131,172‑198` | MOCK_WORKING |
| `hopdong.extend` | "Gia hạn" | `ct-extend` → `ct-extend-save` | **MISSING_ACTION_PERMISSION** | `v-tieuthuong.js:138,144‑156` | MOCK_WORKING |
| `hopdong.terminate` | "Thanh lý" | `ct-end` → `ct-end-save` | **MISSING_ACTION_PERMISSION**. Nếu còn nợ chỉ hiển thị *ghi chú cảnh báo*, **không chặn** thao tác | `v-tieuthuong.js:138,157‑171` | MOCK_WORKING — rủi ro nghiệp vụ, xem mục 10 |

## 3.8 Chỉ số điện, nước (`dien-nuoc`)
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `diennuoc.nav` | chọn kỳ, filter Tất cả/Chưa ghi/Bất thường | `mp-select`,`mp-nav`,`dn-filter` | screen only | `v-taichinh.js:105‑110` | WORKING_FE |
| `dien-nuoc.ghi-chi-so` | nhập ô chỉ số, đính ảnh, "Lưu nháp" | `reading` (CH), `dn-photo-add`, `dn-save-draft` | `action:dien-nuoc.ghi-chi-so` (qua biến `editable` truyền vào render; handler `A.CH.reading`/`dn-photo-add` tự re-check `p.status !== 'RECORDING'` nhưng **không re-check permission**, chỉ check trạng thái kỳ) | `v-taichinh.js:82,90,111‑134,144‑150` | WORKING_FE (validate chỉ số mới ≥ chỉ số cũ) |
| `dien-nuoc.chot-ky` | "🔒 Chốt kỳ" | `dn-close-period` → `dn-close-confirm` | `action:dien-nuoc.chot-ky` (gate nút; **`dn-close-confirm` không re-check**) | `v-taichinh.js:83,99,151‑167` | MOCK_WORKING |
| `dien-nuoc.yeu-cau-dieu-chinh` | "Yêu cầu điều chỉnh" (chỉ hiện khi kỳ đã CLOSED) | `dn-adjust-req` → `dn-adjust-send` | `action:dien-nuoc.yeu-cau-dieu-chinh` (gate nút; **`dn-adjust-send` không re-check**) | `v-taichinh.js:172,178,181‑211` | MOCK_WORKING — tự nhận "chưa có quy trình phê duyệt backend" (toast dòng 210) |

## 3.9 Khoản phải thu (`phai-thu`)
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `phaithu.filter` | chọn kỳ, lọc trạng thái, tìm kiếm | `fp-nav`,`fp-select`,`pt-status`, input `pt-search` | screen only | `v-taichinh.js:27‑30,239‑240` | WORKING_FE |
| `phaithu.issueAuto` | "⚙ Phát hành tự động kỳ 10/2026" | `pt-issue` | **MISSING_ACTION_PERMISSION** — tạo hàng loạt Invoice mới cho toàn bộ hợp đồng hiệu lực | `v-taichinh.js:226,241‑269` | MOCK_WORKING |
| `phaithu.detail` | click dòng → modal khoản phải thu | `inv-open` | screen only | `v-taichinh.js:236,270‑284` | WORKING_FE |
| `phai-thu.mien-giam` | "Miễn giảm / điều chỉnh" | `inv-adjust` → `inv-adjust-save` | `action:phai-thu.mien-giam` (gate nút; **`inv-adjust-save` không re-check**; toast tự nhận "Prototype: phê duyệt ngay") | `v-taichinh.js:281,285‑301` | MOCK_WORKING |
| `thu-tien.thu` | "💳 Thu tiền" trong modal | `pay-open` | `action:thu-tien.thu` | `v-taichinh.js:282` | MOCK_WORKING |

## 3.10 Thu tiền & biên lai (`thu-tien`)
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `thutien.filter` | tìm tiểu thương cần thu, đổi ngày | input `thu-search`, `thu-date` | screen only | `v-taichinh.js:358,366‑367` | WORKING_FE |
| `thutien.openFromList` | nút "Thu tiền" trong bảng con nợ chính màn này | `pay-open` | **screen only — KHÔNG gọi `A.PERM.canAction('thu-tien.thu')` tại vị trí này**, khác với mọi nơi khác gọi `pay-open` (đã gate ở `so-do`, `phai-thu`, `tieu-thuong`, `cong-no`) | `v-taichinh.js:360` | MOCK_WORKING — **INCONSISTENCY**, xem mục 10 |
| `thutien.confirm` | modal Thu tiền → "Xác nhận thu" / "Giả lập đã chuyển khoản" | `pay-confirm` | Không re-check tại `pay-confirm` (được mở từ `pay-open`, nơi gọi thường có gate nhưng không phải luôn — xem dòng trên) | `v-taichinh.js:322‑338` | MOCK_WORKING — dùng `A.applyPayment` (engine thanh toán dùng chung, ghi Invoice/Payment/Bank thật) |
| `thutien.receiptClick` | click dòng giao dịch trong ngày → xem biên lai | `receipt` | screen only | `v-taichinh.js:363`, `core.js:350` | WORKING_FE |

## 3.11 Đối soát (`doi-soat`)
Duy nhất màn hình có **defense‑in‑depth**: nhiều handler tự `A.PERM.canAction(...)` lại bên trong chính nó,
không chỉ gate hiển thị nút.

| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `doi-soat.xem-ngan-hang` | tab "Ngân hàng / QR" | `dsCanBank()` điều khiển việc tab có xuất hiện | `action:doi-soat.xem-ngan-hang` | `v-taichinh.js:380,410‑415` | WORKING_FE |
| `doi-soat.xem-tien-mat` | tab "Tiền mặt" | `dsCanCash()` | `action:doi-soat.xem-tien-mat` | `v-taichinh.js:382,410‑415` | WORKING_FE |
| `doi-soat.gan-thu-cong` | "Gắn thủ công" → modal chọn khoản → xác nhận | `ds-bank-match` → `ds-bank-match-confirm` | `action:doi-soat.gan-thu-cong` — **re-check ngay trong cả 2 handler** (`if (!dsCanBankMatch()) return;`, dòng 531,545) | `v-taichinh.js:381,453,530‑556` | MOCK_WORKING |
| `doi-soat.xem-truy-vet` | phần "Lịch sử xử lý" trong drawer | `dsCanAudit()` chỉ điều khiển hiển thị block | `action:doi-soat.xem-truy-vet` | `v-taichinh.js:384,501,619,640` | WORKING_FE |
| `doi-soat.xac-nhan-nop-quy` | "Xác nhận đối soát" (tiền mặt) | `ds-cash-confirm` | `action:doi-soat.xac-nhan-nop-quy` — **re-check trong handler** (dòng 655) | `v-taichinh.js:383,618,654‑664` | MOCK_WORKING |
| `doisoat.export` | "⬇ Xuất Excel" (cả 2 tab) | `ds-csv`, `ds-cash-csv` | **MISSING_ACTION_PERMISSION** — chỉ ràng buộc gián tiếp qua tab đang mở (đã cần `xem-ngan-hang`/`xem-tien-mat` để thấy nút) | `v-taichinh.js:449,467‑471,591,600‑604` | WORKING_FE |

## 3.12 Công nợ & nhắc nợ (`cong-no`)
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `congno.filter` | đổi ngày tính đến, kỳ phát sinh | `cn-asof`, `cn-origin` | screen only | `v-taichinh.js:706‑707` | WORKING_FE |
| `congno.remind` | "Nhắc nợ" 1 tiểu thương | `cn-remind` | **MISSING_ACTION_PERMISSION** | `v-taichinh.js:704,713` | MOCK_WORKING |
| `congno.remindAll` | "📣 Gửi nhắc nợ tất cả" | `cn-remind-all` | **MISSING_ACTION_PERMISSION** — gửi hàng loạt + tạo notification | `v-taichinh.js:699,714‑720` | MOCK_WORKING |
| `congno.export` | "⬇ Xuất Excel" | `cn-csv` | **MISSING_ACTION_PERMISSION** | `v-taichinh.js:700,721‑725` | WORKING_FE |
| `thu-tien.thu` | nút "Thu" trong bảng | `pay-open` | **MISSING** tại vị trí này — không thấy `A.PERM.canAction` bao quanh nút "Thu" ở dòng 704 (khác `thu-tien`/`phai-thu`/`tieu-thuong` đều có gate) | `v-taichinh.js:704` | MOCK_WORKING — **INCONSISTENCY** thêm, xem mục 10 |

## 3.13 Phản ánh & sự cố (`su-co`)
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `suco.filter` | lọc theo nhóm | `inc-cat` | screen only | `v-vanhanh.js:35` | WORKING_FE |
| `su-co.tao-phan-anh` | "+ Tạo phản ánh" | `inc-new` → `inc-new-save` | `action:su-co.tao-phan-anh` (gate nút; **`inc-new-save` không re-check**) | `v-vanhanh.js:26,87‑107` | MOCK_WORKING |
| `su-co.phan-cong` | chọn "Người xử lý" trong modal | `inc-assign` (CH) | `action:su-co.phan-cong` (gate hiển thị select; **`inc-assign` không re-check**) | `v-vanhanh.js:39,49,60‑67` | MOCK_WORKING |
| `su-co.chuyen-trang-thai` | nút "Chuyển sang: …" | `inc-next` | `action:su-co.chuyen-trang-thai` (gate nút; **`inc-next` không re-check**) | `v-vanhanh.js:42,56,68‑75` | MOCK_WORKING |
| `su-co.vuot-cap` | "Chuyển vượt cấp lên phường" | `inc-escalate` | `action:su-co.vuot-cap` (gate nút; **`inc-escalate` không re-check**) | `v-vanhanh.js:40,54,76‑80` | MOCK_WORKING |
| `su-co.chi-dao` | textarea + "Gửi ý kiến chỉ đạo" (chỉ `lanhdao` theo seed) | `inc-comment` | `action:su-co.chi-dao` (gate nút/textarea; **`inc-comment` không re-check**) | `v-vanhanh.js:41,52,55,81‑86` | MOCK_WORKING |

## 3.14 Thông báo đa kênh (`thong-bao`)
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `thongbao.compose` | chọn nhóm nhận, kênh, soạn nội dung | `tb-group` (CH) | screen only | `v-vanhanh.js:137` | WORKING_FE |
| `thongbao.send` | "📣 Gửi ngay" | `tb-send` | **MISSING_ACTION_PERMISSION** — gửi tới N tiểu thương, ghi `A.db.notifications` | `v-vanhanh.js:130,138‑145` | MOCK_WORKING |

## 3.15 Báo cáo thống kê (`bao-cao`)
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `baocao.select` | chọn 1 trong 10 báo cáo | `rp` | screen only | `v-vanhanh.js:191` | WORKING_FE |
| `baocao.export` | "⬇ Xuất Excel" | `rp-csv` | **MISSING_ACTION_PERMISSION** (rủi ro thấp — thuần xem/xuất) | `v-vanhanh.js:187,192` | WORKING_FE |
| `baocao.print` | "🖨 In / PDF" | `A.ACT.print` (dùng chung `window.print()`) | screen only | `v-vanhanh.js:187`, `core.js:340` | WORKING_FE |

## 3.16 Tài khoản người dùng (`tai-khoan`)
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `taikhoan.filter` | tìm kiếm, lọc loại/vai trò/chợ/trạng thái | inputs/CH tương ứng | screen only | `v-vanhanh.js:305‑310` | WORKING_FE |
| `taikhoan.detail` | click dòng → drawer | `acc-open` | screen only | `v-vanhanh.js:293,311‑315` | WORKING_FE |
| `tai-khoan.tao-moi` | "+ Thêm tài khoản" | `acc-new` → `acc-form-save` | `action:tai-khoan.tao-moi` (gate nút; **`acc-form-save` không re-check quyền tạo/sửa**, chỉ validate trùng mã) | `v-vanhanh.js:267,277,316‑351` | WORKING_FE (validate mã trùng thật) |
| `tai-khoan.sua` | "Sửa" (bảng) / "Chỉnh sửa" (drawer) | `acc-edit` → `acc-form-save` | `action:tai-khoan.sua` (gate nút) | `v-vanhanh.js:225,245,268,301,320‑325` | WORKING_FE |
| `tai-khoan.khoa-mo-khoa` | "Khoá"/"Mở khoá" | `acc-toggle` | `action:tai-khoan.khoa-mo-khoa` (gate nút; **`acc-toggle` không re-check**) | `v-vanhanh.js:269,302,352‑360` | MOCK_WORKING — **không** có enforcement thật (account "disabled" không chặn gì vì không có login) |
| `tai-khoan.gan-quyen` | field Vai trò/Phạm vi chợ trong form (khoá nếu không có quyền) | `af-role`, `af-scope` (CH) | `action:tai-khoan.gan-quyen` — chỉ role mới (`isNew`) mới bỏ qua check | `v-vanhanh.js:249‑250,256,258,261` | WORKING_FE |

## 3.17 Cài đặt & phân quyền (`cai-dat`)
4 sub‑tab: Cấu hình dịch vụ, **Vai trò & phân quyền**, Tích hợp, Nhật ký kiểm toán (`SETTINGS_TABS`,
`v-vanhanh.js:404`).

### 3.17.a Cấu hình dịch vụ (5 sub‑sub‑tab) — có action permission đầy đủ và nhất quán
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `cai-dat.gia-mat-bang` | +/Sửa/Vô hiệu hoá đơn giá mặt bằng | `cfg-price-new/edit/toggle` → `cfg-form-save` | `action:cai-dat.gia-mat-bang` qua `cfgCan('gia-mat-bang')` (gate nút; **handler lưu không re-check**) | `v-vanhanh.js:410,453‑490` | MOCK_WORKING |
| `cai-dat.gia-dien-nuoc` | +/Sửa/Vô hiệu hoá giá điện nước | `cfg-util-*` | `action:cai-dat.gia-dien-nuoc` (tương tự) | `v-vanhanh.js:494‑529` | MOCK_WORKING |
| `cai-dat.dich-vu-khac` | +/Sửa/Vô hiệu hoá dịch vụ khác | `cfg-svc-*` | `action:cai-dat.dich-vu-khac` (tương tự) | `v-vanhanh.js:533‑568` | MOCK_WORKING |
| `cai-dat.ky-thu` | sửa các field Kỳ thu (toggle disabled nếu không có quyền) | `bc-*` (CH) | `action:cai-dat.ky-thu` qua `dis = canManage ? '' : 'disabled'` | `v-vanhanh.js:716‑743` | MOCK_WORKING |
| `cai-dat.quy-tac-thu-phi` | sửa Quy tắc thu phí | `br-*` (CH) | `action:cai-dat.quy-tac-thu-phi` (tương tự) | `v-vanhanh.js:747‑774` | MOCK_WORKING |
| (đính kèm tài liệu, dùng chung) | thêm/xoá/xem tài liệu ở cả 5 mục | `cfg-att-add/view/del` | Gate theo `canManage` của mục cha (mỗi hạng mục truyền `canManage` riêng khi build HTML) | `v-vanhanh.js:427‑436,649‑678` | MOCK_WORKING (chỉ lưu blob URL trong phiên) |

**Ghi chú quan trọng:** toàn bộ "Cấu hình dịch vụ" (đơn giá, điện nước, kỳ thu, quy tắc) **tách biệt hoàn
toàn** khỏi engine tính tiền thật — `js/serviceconfig.js:1‑7` tự nhận không đọc/ghi `D.UNIT/D.SESSION_FEE/
D.ELEC/D.WATER`; các màn Khoản phải thu/Thu tiền/Chỉ số điện nước vẫn dùng hằng số cứng trong `data.js`.
Sửa giá ở đây **không** ảnh hưởng số tiền thật tính ở nơi khác — cần xác nhận nghiệp vụ (mục 12).

### 3.17.b Vai trò & phân quyền — **KHÔNG có action permission nào bảo vệ**
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `vaitro.create` | "+ Thêm vai trò" | `role-new` → `role-form-save` | **MISSING_ACTION_PERMISSION** — chỉ có `screen:cai-dat` | `v-vanhanh.js:795,839,855‑874` | MOCK_WORKING |
| `vaitro.edit` | "Sửa" 1 role | `role-edit` → `role-form-save` | **MISSING_ACTION_PERMISSION** | `v-vanhanh.js:803,840‑845` | MOCK_WORKING |
| `vaitro.toggleActive` | "Vô hiệu hoá"/"Kích hoạt" | `role-toggle` | **MISSING_ACTION_PERMISSION** (chỉ có business rule: không tự vô hiệu hoá role đang dùng) | `v-vanhanh.js:804,875‑884` | MOCK_WORKING |
| `vaitro.delete` | "Xoá" (role không builtin) | `role-del` → `role-del-ok` | **MISSING_ACTION_PERMISSION** (chỉ chặn role builtin/role đang dùng) | `v-vanhanh.js:805,886‑900` | MOCK_WORKING |
| `vaitro.grantRevoke` | **checkbox tick/bỏ tick từng permission** trong ma trận Phân quyền chi tiết | `perm-toggle` (CH) | **MISSING_ACTION_PERMISSION — toàn bộ 47 permission key có thể được cấp/thu hồi cho bất kỳ role nào bởi bất kỳ ai vào được màn `cai-dat`** | `v-vanhanh.js:372‑385,826‑838` | MOCK_WORKING — **rủi ro cao nhất trong toàn hệ thống, xem mục 10** |

### 3.17.c Tích hợp
Thuần bảng tĩnh (Mô phỏng/Khi triển khai) — không có action nào. `v-vanhanh.js:789‑792`.

### 3.17.d Nhật ký kiểm toán
| Action ID đề xuất | Action UI | Handler | Permission hiện tại | Source | Status |
|---|---|---|---|---|---|
| `nhatky.view` | xem 25 dòng gần nhất | render | screen only | `v-vanhanh.js:811‑814` | WORKING_FE |
| `nhatky.resetAllData` | "↺ Đặt lại dữ liệu mẫu" (xoá toàn bộ thao tác demo) | `reset` → `reset-ok` → `A.resetAll` | **MISSING_ACTION_PERMISSION** — hành động phá huỷ dữ liệu mạnh nhất trong app, chỉ cần vào được `cai-dat` | `v-vanhanh.js:813,901‑903`, `core.js:385‑389` | MOCK_WORKING — xoá `localStorage['choso-caolanh-state']` |

## 3.18 Mini app tiểu thương (`mini-app`)
Toàn bộ action (đăng nhập OTP giả lập, thanh toán QR giả lập, gửi phản ánh, đánh giá sao…) **không có bất kỳ
permission action nào** — đúng thiết kế vì đây là luồng tự phục vụ, chỉ gate ở cấp `screen:mini-app`
(`['lanhdao','bql','tieuthuong']`). [OBSERVED] `js/mini.js:126‑175`.

---

# 4. Current Role × Screen Matrix

Dựa **đúng** seed mặc định `screenRoles` (`js/permissions.js:104‑123`). Toàn bộ đều qua permission engine —
**không có screen nào bị chặn bằng `ui.role === '...'` hard-code**. `P` = qua `A.PERM.canScreen`.

| Screen | `lanhdao` | `bql` | `tieuthuong` |
|---|---|---|---|
| Tổng quan liên chợ | V(P) | V(P) | – |
| Thiết lập mặt bằng chợ | – | V(P) | – |
| Sơ đồ mặt bằng | V(P) | V(P) | – |
| Điểm kinh doanh | – | V(P) | – |
| Phiên chợ quê | V(P) | V(P) | – |
| Tiểu thương | V(P) | V(P) | – |
| Hợp đồng | – | V(P) | – |
| Chỉ số điện, nước | – | V(P) | – |
| Khoản phải thu | – | V(P) | – |
| Thu tiền & biên lai | – | V(P) | – |
| Đối soát | V(P) | V(P) | – |
| Công nợ & nhắc nợ | – | V(P) | – |
| Phản ánh & sự cố | V(P) | V(P) | – |
| Thông báo đa kênh | – | V(P) | – |
| Báo cáo thống kê | V(P) | V(P) | – |
| Tài khoản người dùng | – | V(P) | – |
| Cài đặt & phân quyền | – | V(P) | – |
| Mini app tiểu thương | V(P) | V(P) | V(P) |

Ghi chú: bảng phản ánh **seed mặc định**; vì role/permission có thể sửa động qua UI (mục 1.1, 3.17.b), ma
trận thật tại một thời điểm bất kỳ có thể khác nếu ai đó đã dùng màn "Vai trò & phân quyền" để cấp/thu hồi.
`bql` có quyền vào **toàn bộ** 17/18 screen (trừ `mini-app` cũng có) — không có sự phân tách nào giữa
"BQL nghiệp vụ" và "Quản trị hệ thống" như `D.ROLES`/`ACCOUNT_TYPES` mô tả trên giấy (mục 1.2). `tieuthuong`
chỉ có `mini-app`.

---

# 5. Screen × Action Matrix (tổng hợp permission action theo screen)

| Screen | Action permission (`action:*`) | Role mặc định | Ghi chú |
|---|---|---|---|
| `cau-truc` | *(không có)* | — | 100% MISSING_ACTION_PERMISSION, xem 3.2 |
| `so-do` | `so-do.xem-ho-so` | bql | |
| | `so-do.tao-hop-dong` | bql | |
| | `so-do.doi-trang-thai` | bql | |
| `phien-cho` | `phien-cho.chot-phien` | bql | |
| `tieu-thuong` | `tieu-thuong.them-moi` | bql | |
| `hop-dong` | *(không có)* | — | 100% MISSING, xem 3.7 |
| `dien-nuoc` | `dien-nuoc.ghi-chi-so` | bql | |
| | `dien-nuoc.chot-ky` | bql | |
| | `dien-nuoc.yeu-cau-dieu-chinh` | bql | |
| `phai-thu` | `phai-thu.mien-giam` | bql | phát hành tự động (`pt-issue`) MISSING |
| `thu-tien` | `thu-tien.thu` | bql | dùng ở 5 nơi khác nhau nhưng **thiếu** ở chính bảng con nợ của màn `thu-tien` và ở `cong-no` (mục 10) |
| `doi-soat` | `doi-soat.xem-ngan-hang` | lanhdao, bql | |
| | `doi-soat.gan-thu-cong` | bql | |
| | `doi-soat.xem-tien-mat` | lanhdao, bql | |
| | `doi-soat.xac-nhan-nop-quy` | bql | |
| | `doi-soat.xem-truy-vet` | bql | |
| `cong-no` | *(không có)* | — | MISSING toàn bộ — nhắc nợ, xuất Excel, nút Thu |
| `su-co` | `su-co.tao-phan-anh` | bql | |
| | `su-co.phan-cong` | bql | |
| | `su-co.chuyen-trang-thai` | bql | |
| | `su-co.vuot-cap` | bql | |
| | `su-co.chi-dao` | **lanhdao** (duy nhất seed mặc định cho lanhdao, không phải bql) | |
| `thong-bao` | *(không có)* | — | MISSING — gửi thông báo hàng loạt |
| `bao-cao` | *(không có)* | — | rủi ro thấp (chỉ xem/xuất) |
| `tai-khoan` | `tai-khoan.tao-moi` | bql | |
| | `tai-khoan.sua` | bql | |
| | `tai-khoan.khoa-mo-khoa` | bql | |
| | `tai-khoan.gan-quyen` | bql | |
| `cai-dat` | `cai-dat.gia-mat-bang` | bql | |
| | `cai-dat.gia-dien-nuoc` | bql | |
| | `cai-dat.dich-vu-khac` | bql | |
| | `cai-dat.ky-thu` | bql | |
| | `cai-dat.quy-tac-thu-phi` | bql | |
| | *(quản lý Vai trò & phân quyền)* | — | **MISSING** — xem 3.17.b, mục 10 |
| | *(Đặt lại dữ liệu mẫu)* | — | **MISSING** |
| `diem-kd`, `tong-quan`, `mini-app` | *(không có)* | — | Đúng thiết kế — thuần xem/tự phục vụ, rủi ro thấp |

**Tổng:** 29 permission `action:*` trong CATALOG (`permissions.js:44‑71`), bao phủ 8/18 screen
(`so-do`, `phien-cho`, `tieu-thuong`, `dien-nuoc`, `phai-thu`, `thu-tien`, `doi-soat`, `su-co`, `tai-khoan`,
`cai-dat` — 10 screen thực ra có ít nhất 1 action permission). **8 screen hoàn toàn không có action
permission nào**: `tong-quan`, `cau-truc`, `diem-kd`, `hop-dong`, `cong-no`, `thong-bao`, `bao-cao`,
`mini-app` — trong đó `cau-truc`, `hop-dong`, `cong-no`, `thong-bao` có action **ghi/thay đổi dữ liệu**
(không chỉ xem), là khoảng trống đáng chú ý nhất (mục 10).

---

# 6. Current Market / Market Scope

## 6.1 Cơ chế đang chạy [OBSERVED]

1. **Market ID/code:** `'ALL' | 'CL' | 'TTD'` — khai báo `MKTS` (`core.js:289`) và `D.MARKETS` (`data.js:21‑69`,
   2 chợ: `CL` = Chợ Cao Lãnh, `TTD` = Chợ quê Cù lao Tân Thuận Đông).
2. **Market selector nằm ở:** `#market-seg` trên topbar (`core.js:304`), luôn hiển thị **trừ** khi
   `A.current === 'mini-app'` (`core.js:305`, ẩn cả khối `#market-wrap`).
3. **`selectedMarket` lưu ở đâu:** biến `ui.market` (khởi tạo `'ALL'`, `core.js:10`), đồng bộ
   `localStorage['choso-caolanh-ui']` qua `A.saveUi()` mỗi khi đổi (`A.ACT.market`, `core.js:347`).
4. **`marketScope` của account/role hiện tại:** Role có field `scope` (`all|market|self`) + `market`
   (`permissions.js:88‑90`); Account có field `marketScopes` (mảng, `accounts.js`). **Không tìm thấy đoạn
   code nào đọc `role.scope`/`role.market` hoặc `account.marketScopes` để giới hạn `ui.market` hay lọc dữ
   liệu** (đã grep toàn bộ `js/*.js` cho `role.scope`, `\.market\b` gắn với role — chỉ thấy dùng để **hiển
   thị nhãn** `scopeLabel()` ở `v-vanhanh.js:363‑367` và `accScopeLabel()` ở dòng 199‑203). → Tạo 1 role mới
   với `scope:'market', market:'CL'` qua UI **không** khiến người dùng bị khoá ở Chợ Cao Lãnh — họ vẫn bấm
   được nút "Chợ quê TTĐ" ở topbar nếu role đó có quyền `screen:*` tương ứng. **[INFERRED GAP]**
5. **Menu có phụ thuộc market không:** **Không.** `chrome()` chỉ lọc theo `U.can(it.id)` (permission), không
   có điều kiện nào theo `ui.market` (`core.js:291‑302`).
6. **Screen có phụ thuộc market không:** Có, nhưng theo 3 kiểu khác nhau tồn tại song song:
   - Filter chuẩn qua `U.inM()` (hầu hết: `tong-quan`, `so-do`, `diem-kd`, `tieu-thuong`, `hop-dong`,
     `dien-nuoc`, `phai-thu`, `thu-tien`, `doi-soat`, `cong-no`, `su-co`, `bao-cao`).
   - Filter **riêng, độc lập với `ui.market` topbar**: `tai-khoan` dùng `f.market` riêng của chính màn đó
     (`accRows()`, `v-vanhanh.js:207‑214` — không gọi `U.inM`); `cau-truc` dùng `ui.qh.market` (chỉ chọn
     layout để xem, không filter dữ liệu thật vì dữ liệu là bản nháp riêng biệt theo từng chợ).
   - **Không filter theo market ở bất kỳ hình thức nào**: `phien-cho` (xem 6.2), `thong-bao` (gửi theo nhóm
     chọn tay trong form, không theo `ui.market`), `cai-dat`/`mini-app` (theo thiết kế, xem mục 2).
7. **Data có filter theo market không:** Có, qua hàm dùng chung duy nhất
   `U.inM = x => ui.market === 'ALL' || x.market === ui.market` (`core.js:42`) — áp dụng thủ công tại từng
   nơi query, **không có tầng data-access tập trung nào tự động áp filter này**; nơi nào quên gọi `U.inM` thì
   không lọc (xem `phien-cho` bên dưới).
8. **Action có kiểm tra market không:** Không tìm thấy action nào tự kiểm tra `ui.market` như một điều kiện
   permission (market chỉ ảnh hưởng qua việc dữ liệu hiển thị đã được lọc sẵn ở tầng render).

## 6.2 "Phiên chợ quê" — kiểm tra riêng theo yêu cầu

**[OBSERVED]** `A.VIEWS['phien-cho']` (`v-dieuhanh.js:213‑236`) đọc thẳng `A.db.sessions` và
`A.db.stalls.filter(s => s.market === 'TTD')` (dòng 216, 239) — **hard-code chợ TTD trong câu query**,
**không** gọi `U.inM()`. Hệ quả:

- Screen **không** ẩn/hiện theo `ui.market` — permission chỉ là `screen:phien-cho` (`lanhdao`, `bql`), độc
  lập hoàn toàn với chợ đang chọn.
- Nếu người dùng đang chọn "Chợ Cao Lãnh" ở topbar mà vẫn có quyền `screen:phien-cho`, menu **Phiên chợ quê**
  vẫn hiển thị và khi vào vẫn thấy đầy đủ dữ liệu của TTD (không bị ẩn, không có cảnh báo "sai chợ").
- Đây là **giới hạn theo cách viết truy vấn dữ liệu (hard-code `market === 'TTD'`)**, KHÔNG phải một cơ chế
  permission hay market-scope có chủ đích — không có rule tường minh nào như "chỉ hiện khi ui.market !== 'CL'".

**[OBSERVED]** Tương tự, "Chỉ số điện, nước" (`dien-nuoc`) không có dữ liệu `readings` gắn với stall của TTD
(TTD không có field `meter:true` trong cấu hình `sections` của `data.js`), nên khi lọc theo TTD, danh sách
`all` rỗng và UI trả về thẳng `'<div class="empty">Chợ quê không có đồng hồ điện, nước riêng cho quầy.</div>'`
(`v-taichinh.js:86`) — đây là **hệ quả của việc không sinh dữ liệu mock cho TTD**, không phải một rule
permission/market-scope tường minh trong code.

## 6.3 Bảng tổng hợp

| Screen | Chợ Cao Lãnh | Chợ quê TTĐ | Cả hai (ALL) | Market-specific? | Evidence |
|---|---|---|---|---|---|
| Tổng quan liên chợ | ✓ (`U.inM`) | ✓ | ✓ (mặc định) | Chuẩn `U.inM` | `v-dieuhanh.js:8‑9` |
| Thiết lập mặt bằng chợ | ✓ (chọn layout riêng) | ✓ | n/a (chỉ xem 1 chợ/lần qua `ui.qh.market`) | Filter riêng, không dùng `U.inM` | `v-cautruc.js:54,176` |
| Sơ đồ mặt bằng | ✓ | ✓ | n/a (chọn 1 chợ/lần qua `ui.planMarket`) | Chuẩn, có sub-selector khi ALL | `v-dieuhanh.js:111,171` |
| Điểm kinh doanh | ✓ | ✓ | ✓ | Chuẩn `U.inM` | `v-tieuthuong.js:10` |
| Phiên chợ quê | *(luôn hiện TTD bất kể chọn gì)* | ✓ (hard-code) | *(luôn hiện TTD)* | **Hard-code TTD, không theo `ui.market`** | `v-dieuhanh.js:216,239` |
| Tiểu thương / Hợp đồng | ✓ | ✓ | ✓ | Chuẩn `U.inM` | `v-tieuthuong.js:47,122` |
| Chỉ số điện, nước | ✓ | rỗng (do thiếu data mock, không phải rule) | ✓ | Chuẩn `U.inM`, TTD rỗng tự nhiên | `v-taichinh.js:85‑86` |
| Khoản phải thu / Thu tiền / Đối soát / Công nợ | ✓ | ✓ | ✓ | Chuẩn `U.inM` | `v-taichinh.js` nhiều nơi |
| Phản ánh & sự cố | ✓ | ✓ | ✓ | Chuẩn `U.inM` | `v-vanhanh.js:16` |
| Thông báo đa kênh | n/a | n/a | n/a | Không filter theo `ui.market`, chọn nhóm gửi thủ công | `v-vanhanh.js:119‑125` |
| Báo cáo thống kê | ✓ | ✓ | ✓ | Đa số `U.inM`; báo cáo "Số thu theo nhân viên" filter theo ngày, không gọi `U.inM` tường minh | `v-vanhanh.js:171` |
| Tài khoản người dùng | filter riêng theo `a.marketScopes` | như trên | như trên | **Độc lập hoàn toàn với `ui.market` topbar** | `v-vanhanh.js:207‑214` |
| Cài đặt & phân quyền | n/a | n/a | n/a | Không có scope theo chợ (cấu hình theo `marketId` riêng từng bản ghi) | `v-vanhanh.js` |
| Mini app tiểu thương | theo chợ của tiểu thương đang xem | như trên | n/a | Không dùng `ui.market`, ẩn cả selector | `core.js:305`, `mini.js` |

---

# 7. Current Permission Architecture

## 7.1 Sơ đồ thực tế đang chạy [OBSERVED]

```
Account (accounts.js — CRUD hồ sơ, KHÔNG có khái niệm "đang đăng nhập")
        ⋯ KHÔNG có liên kết runtime nào ⋯
ui.role  ('lanhdao' | 'bql' | 'tieuthuong', đổi qua nút "Vai trò" topbar — core.js:342‑346)
   │
   ▼
Role  (STATE.roles trong permissions.js — có thể thêm/sửa/vô hiệu hoá/xoá qua UI Cài đặt)
   │  field scope: 'all' | 'market' | 'self'  (KHÔNG có bảng Scope riêng, gắn trực tiếp trên Role)
   ▼
RolePermission  (STATE.rolePerms — quan hệ N‑N Role×Permission, có grantedAt/grantedBy)
   │
   ▼
Permission  (CATALOG tĩnh, 47 key: 18 kind='screen' + 29 kind='action')
   │
   ▼
UI/Router:
   U.can(screenId)              → A.PERM.canScreen(ui.role, screenId)   → gate MENU (chrome()) + ROUTER (A.route)
   A.PERM.canAction(ui.role, k) → gate TỪNG NÚT/HÀNH ĐỘNG cụ thể (chỉ ở nơi code có gọi)
```

- **Permission được khai báo ở đâu:** `CATALOG` tĩnh trong `js/permissions.js:24‑73` (đổi được chỉ bằng sửa
  code, không có UI thêm permission key mới).
- **Role → Permission mapping ở đâu:** `STATE.rolePerms`, seed tại `defaultRolePermissions()`
  (`permissions.js:103‑160`), lưu động `localStorage['choso-caolanh-permissions']`; sửa qua checkbox
  `perm-toggle` trong UI (`v-vanhanh.js:826‑838`).
- **Account → Role mapping ở đâu:** field `roleIds` trên Account (`accounts.js`) — **tồn tại trên giấy,
  không được đọc ở bất kỳ luồng runtime nào** (mục 1.3, 9.4).
- **Market scope nằm ở đâu:** field `scope`/`market` trên Role — **không được thực thi** (mục 6.1 điểm 4).
- **Menu visibility kiểm tra permission như thế nào:** `chrome()` lọc `g.items` bằng `U.can(it.id)`
  (`core.js:294`), tương đương `A.PERM.canScreen(ui.role, id)`.
- **Action/button kiểm tra permission như thế nào:** gọi trực tiếp `A.PERM.canAction(ui.role, 'screen.action')`
  tại thời điểm build HTML để quyết định **có render nút/field đó hay không** — đây là cơ chế **ẩn/hiện UI**,
  không phải chặn ở tầng dữ liệu.
- **Permission thay đổi động có làm UI cập nhật không:** Có — mọi thay đổi qua `perm-toggle`/`role-*` gọi
  `A.render()` ngay sau khi ghi `STATE`, nên menu/nút cập nhật tức thì trong cùng phiên (không cần tải lại
  trang). [OBSERVED]
- **Có chỗ nào bypass permission engine không:** Có — xem mục 8 (hard-coded) và mục 10 (thiếu re-check trong
  handler, chỉ gate UI).

## 7.2 Mức độ defense-in-depth (permission check chỉ ở UI hay cả handler)

| Kiểu | Số lượng quan sát được | Ví dụ |
|---|---|---|
| Chỉ gate **hiển thị nút/field** (`A.PERM.canAction` gọi khi build HTML), **handler xử lý không re-check** | Đa số các action có permission (≥20/29 action key) | `stall-status-save`, `session-save`, `tt-save`, `inc-assign`, `inc-next`, `inc-escalate`, `inc-comment`, `dn-close-confirm`, `dn-adjust-send`, `inv-adjust-save`, `acc-toggle`, `cfg-*-toggle`, `cfg-form-save` |
| **Re-check ngay trong handler** (`if (!canX()) return;`) | 3 action, đều trong `doi-soat` | `ds-bank-match`, `ds-bank-match-confirm`, `ds-cash-confirm` (`v-taichinh.js:531,545,655`) |
| **Không có permission nào ở cả 2 tầng** | Toàn bộ `cau-truc`, `hop-dong`, `cong-no`, `thong-bao`, phần "Vai trò & phân quyền"/"Đặt lại dữ liệu mẫu" trong `cai-dat` | Xem mục 3, 5 |

[OBSERVED] — vì đây là ứng dụng front-end thuần (không có server để chặn request), việc "gate chỉ ở UI"
tương đương **không có chặn thật**: bất kỳ ai mở DevTools console và gọi trực tiếp `APP.ACT['stall-status-save']({dataset:{id:'...'}})`
đều có thể thực thi hành động bất kể role đang chọn là gì, trừ 3 action ở `doi-soat` có re-check. Đây là đặc
điểm cố hữu của kiến trúc client-only, không phải lỗi implement — nhưng cần ghi nhận cho baseline vì ảnh
hưởng cách đánh giá "permission đã áp dụng" ở mục 5, 10.

---

# 8. Hard-coded Role Checks

Đã grep toàn bộ `js/*.js` cho các pattern `ui.role ===`, `ui.role !==`, `role.id`, `roleId ===`, so sánh
chuỗi role trực tiếp. Kết quả — **không có hard-code nào dùng để CHẶN truy cập** (mọi screen/action permission
đều qua `A.PERM`); toàn bộ hard-code tìm được chỉ dùng để **chọn nhãn hiển thị** (tên "actor" ghi vào log/audit
hoặc tiêu đề bảng):

| # | Vị trí | Nội dung | Mục đích | Rủi ro |
|---|---|---|---|---|
| 1 | `js/core.js:92` | `U.log`: `who: ui.role === 'lanhdao' ? 'Lãnh đạo UBND phường' : 'Trần Minh Khoa'` | Chọn tên hiển thị trong Nhật ký kiểm toán khi không phải `lanhdao` | Thấp — mọi hành động của `bql` đều bị gán chung 1 tên "Trần Minh Khoa" dù tài khoản Account thật có thể khác (vì không có Account đang đăng nhập thật, mục 1.3) — sai lệch **nhật ký kiểm toán**, không phải lỗ hổng quyền |
| 2 | `js/v-taichinh.js:378` | `dsActor()` — tương tự, dùng cho log đối soát | như trên | như trên |
| 3 | `js/v-vanhanh.js:411` | `cfgActor()` — tương tự, dùng cho log Cấu hình dịch vụ | như trên | như trên |
| 4 | `js/v-vanhanh.js:827` | tương tự, dùng khi ghi log `perm-toggle` (cấp/thu hồi quyền) | như trên | như trên — **đáng chú ý hơn vì đây là log của chính hành động cấp quyền** |
| 5 | `js/v-tieuthuong.js:53` | `${ui.role === 'lanhdao' ? 'Tra cứu tiểu thương' : 'Hồ sơ tiểu thương'}` | Đổi tiêu đề bảng (label only) | Không — thuần UI text, không ảnh hưởng dữ liệu/quyền truy cập |
| 6 | `js/core.js:303` | `ui.role === r.id ? 'on' : ''` | Highlight nút role đang chọn trên topbar | Không — hiển thị |

**Kết luận:** 6 vị trí hard-code, **0 vị trí** dùng để gate quyền truy cập màn hình/hành động. Tất cả
`HARDCODED_ROLE_CHECK` tìm thấy đều thuộc loại "chọn nhãn hiển thị", phù hợp với comment đầu `permissions.js`
(dòng 1‑12) khẳng định giai đoạn "thay `ui.role === 'bql'` bằng `A.PERM.canAction`" — **đã hoàn thành cho mọi
action-gate thật**, chỉ còn sót các actor-label này (không phải phạm vi của việc thay thế đó vì chúng không
kiểm tra quyền).

---

# 9. Missing Permission Checks

(Tổng hợp lại — chi tiết từng dòng đã liệt kê ở mục 3/5, đây là danh sách rút gọn để dễ tra cứu.)

## 9.1 Screen hoàn toàn không có action permission nhưng CÓ hành động ghi/sửa/xoá dữ liệu
| Screen | Action bị ảnh hưởng | Ghi chú |
|---|---|---|
| `cau-truc` | add/edit/del block, floor, zone, planned type; save draft/final; reset layout (≈9 nhóm, ~20 handler) | Toàn bộ chỉ dựa `screen:cau-truc` |
| `hop-dong` | Tạo hợp đồng (từ chính màn này), Gia hạn, Thanh lý | `thanh lý` còn nợ chỉ cảnh báo, không chặn (mục 10) |
| `cong-no` | Nhắc nợ 1 người, Nhắc nợ hàng loạt, Xuất Excel | |
| `thong-bao` | Gửi thông báo hàng loạt | |
| `cai-dat` (tab Vai trò & phân quyền) | Thêm/sửa/vô hiệu hoá/xoá role, **cấp/thu hồi permission cho role** | **Rủi ro cao nhất** — xem mục 10 |
| `cai-dat` (tab Nhật ký kiểm toán) | "Đặt lại dữ liệu mẫu" (xoá toàn bộ state) | |
| `phai-thu` | Phát hành khoản phải thu tự động (`pt-issue`) | Tạo hàng loạt Invoice mới |

## 9.2 Action đã có permission nhưng chỉ gate UI, handler không re-check
Xem bảng đầy đủ ở mục 7.2 — 20+ handler (ví dụ `stall-status-save`, `session-save`, `tt-save`, `inc-*`,
`dn-close-confirm`, `dn-adjust-send`, `inv-adjust-save`, `acc-toggle`, `cfg-*`). Không phải "thiếu permission"
theo nghĩa CATALOG, nhưng là khoảng trống về **defense‑in‑depth**.

## 9.3 Action dùng chung 1 permission nhưng bị bỏ sót ở 1 số vị trí gọi
- `thu-tien.thu` được check ở `so-do` (`stallPanel`), `phai-thu` (`inv-open`), `tieu-thuong` (modal
  `trader`) — nhưng **KHÔNG** được check tại nút "Thu tiền" trong chính bảng con nợ của màn `thu-tien`
  (`v-taichinh.js:360`) và nút "Thu" trong bảng `cong-no` (`v-taichinh.js:704`). Cùng 1 hành động
  (`pay-open`) nhưng độ bao phủ permission không đồng nhất giữa các điểm gọi.

## 9.4 Account/Role scope không được enforce
- `Account.roleIds`/`Account.marketScopes`/`Account.status` không có bất kỳ tác dụng runtime nào (mục 1.3).
- `Role.scope`/`Role.market` không giới hạn `ui.market` hay filter dữ liệu (mục 6.1).

---

# 10. Current Gaps / Risks

| # | Vị trí | Hiện trạng | Loại vấn đề | Mức ảnh hưởng | Source |
|---|---|---|---|---|---|
| 1 | `cai-dat` → tab "Vai trò & phân quyền" | Bất kỳ ai vào được màn `cai-dat` (chỉ cần `screen:cai-dat`, mặc định role `bql`) đều có thể **tự cấp thêm bất kỳ permission nào cho bất kỳ role nào**, kể cả tự nâng quyền cho chính role đang dùng, qua checkbox `perm-toggle` — không có permission action riêng bảo vệ chính "quyền quản lý quyền" | Permission tồn tại (`screen:cai-dat`) nhưng KHÔNG đủ chi tiết cho hành động nhạy cảm nhất trong hệ thống | **CAO** | `v-vanhanh.js:372‑385,826‑838` |
| 2 | `cai-dat` → "Đặt lại dữ liệu mẫu" | 1 click xoá toàn bộ `localStorage['choso-caolanh-state']`, không có permission action riêng, chỉ cách 1 modal xác nhận | Action nguy hiểm (phá huỷ dữ liệu) không có permission granular | **CAO** (trong phạm vi prototype) | `v-vanhanh.js:813,901‑903` |
| 3 | Toàn bộ `cau-truc` (Thiết lập mặt bằng chợ) | ~20 action CRUD không có permission action nào, chỉ cần vào được screen (`bql`) | Screen có permission nhưng nhiều nút bên trong không có permission riêng | Trung bình (dữ liệu ở đây là bản nháp quy hoạch, chưa phải dữ liệu vận hành thật) | `v-cautruc.js` toàn file |
| 4 | `hop-dong` → Thanh lý hợp đồng (`ct-end-save`) | Nếu tiểu thương còn nợ, hệ thống chỉ hiển thị **ghi chú cảnh báo**, KHÔNG chặn thao tác; đồng thời hành động này không có permission action riêng | Action nguy hiểm (mất liên kết hợp đồng‑điểm KD‑tiểu thương) không có rào chắn permission lẫn business rule đủ mạnh | **CAO** | `v-tieuthuong.js:157‑171` |
| 5 | `thu-tien` (bảng con nợ chính màn) & `cong-no` (nút "Thu") | Nút "Thu tiền"/"Thu" mở modal thu tiền **không qua `A.PERM.canAction('thu-tien.thu')`** tại 2 vị trí này, trong khi mọi nơi khác gọi cùng hành động đều có check | Permission tồn tại nhưng áp dụng không nhất quán giữa các điểm gọi cùng 1 action | Trung bình | `v-taichinh.js:360,704` |
| 6 | 20+ handler khắp `v-*.js` (mục 7.2, 9.2) | Permission chỉ gate việc **hiển thị nút**; hàm xử lý thật sự (`*-save`, `*-confirm`, `*-toggle`) không tự kiểm tra lại quyền | Không có defense‑in‑depth — do kiến trúc client-only nên bản chất không thể chặn thật, nhưng mức độ re-check không đồng đều (chỉ `doi-soat` có 3/29 action re-check) | Trung bình (đặc thù prototype front-end) | Nhiều file |
| 7 | `Role.scope`/`Role.market` (permissions.js) | Field tồn tại, hiển thị trong bảng Vai trò (`scopeLabel()`), nhưng **không có logic nào đọc field này để giới hạn `ui.market`/lọc dữ liệu** | Permission/scope tồn tại nhưng không được sử dụng ("defined but not enforced") | Trung bình–Cao (tạo ảo giác đã có phân quyền theo chợ) | `v-vanhanh.js:363‑367`, toàn bộ `permissions.js` |
| 8 | `Account.roleIds`/`marketScopes`/`status` (accounts.js) | Không có cơ chế đăng nhập nào đọc các field này; account "Tạm khoá" không chặn được gì | Permission/role tồn tại trên Account nhưng không được sử dụng runtime | Trung bình–Cao (module "Tài khoản người dùng" trông như IAM thật nhưng chỉ là hồ sơ tĩnh) | `accounts.js` toàn file |
| 9 | Menu group "Điểm kinh doanh" | Sau lần tái tổ chức sidebar gần nhất, menu hiển thị "Điểm kinh doanh" trong nhóm **Điều hành**, nhưng `permissions.js:29` vẫn khai báo `group: 'Tiểu thương & hợp đồng'` cho `screen:diem-kd` — nhãn nhóm này chỉ dùng để hiển thị trong ma trận phân quyền ở màn Cài đặt (`permsMatrixHtml`), nên bảng phân quyền và sidebar hiện **không khớp nhãn nhóm** | Permission catalog group label lệch so với navigation group thực tế | Thấp (chỉ ảnh hưởng nhãn hiển thị trong màn Cài đặt, không ảnh hưởng quyền truy cập) | `permissions.js:29` vs `core.js:257‑265` |
| 10 | `phien-cho` | Không phụ thuộc `ui.market` — luôn hiển thị/ luôn trả dữ liệu TTD bất kể chợ đang chọn ở topbar | Market-scope không nhất quán so với các screen khác (thiết kế cố ý theo dữ liệu, nhưng thiếu rule tường minh) | Thấp–Trung bình | `v-dieuhanh.js:213‑236` |
| 11 | `tai-khoan` (Tài khoản người dùng) | Bộ lọc "Chợ" trong chính màn này độc lập với `ui.market` topbar — đổi "Chợ" ở topbar không ảnh hưởng danh sách account hiển thị | Trải nghiệm không nhất quán (không phải lỗi truy cập dữ liệu) | Thấp | `v-vanhanh.js:207‑214` |
| 12 | `D.ROLES` (`data.js:100‑108`) | Dead data, không có tham chiếu chức năng nào | Permission tồn tại (dạng mô tả) nhưng không được sử dụng | Rất thấp | `data.js:100‑108` |
| 13 | "Cấu hình dịch vụ" (`serviceconfig.js`) | Toàn bộ 5 loại cấu hình (đơn giá, điện nước, dịch vụ khác, kỳ thu, quy tắc thu phí) có permission action đầy đủ và nhất quán, nhưng **không được đọc bởi engine tính tiền thật** | Không phải gap về permission, nhưng permission đang bảo vệ 1 module không có tác dụng nghiệp vụ thật — cần biết khi đánh giá mức ưu tiên | Thấp (về RBAC), Cao (về kỳ vọng nghiệp vụ — xem mục 12) | `serviceconfig.js:1‑7` |

---

# 11. Missing / Not Yet Implemented

Liệt kê thuần những gì **prototype hiện chưa có**, không coi là lỗi bắt buộc sửa ngay:

- **Không có cơ chế đăng nhập/xác thực thật** — không có bước nào biến 1 Account cụ thể thành `ui.role`
  đang chạy; "Vai trò" ở topbar chỉ là 1 toggle demo 3 giá trị cố định.
- **Không có bảng Scope độc lập** — `scope` chỉ là 1 field mô tả trên Role, không có engine nào đọc/áp dụng.
- **Không có action permission** cho: toàn bộ `cau-truc`, toàn bộ `hop-dong`, toàn bộ `cong-no`, gửi
  `thong-bao`, phát hành khoản phải thu tự động (`pt-issue`), và đặc biệt là **chính việc quản lý
  Vai trò & phân quyền** (tạo/sửa/xoá role, cấp/thu hồi permission) cùng "Đặt lại dữ liệu mẫu".
- **Không có defense‑in‑depth** ở hầu hết action đã có permission (chỉ 3/29 action re-check trong handler)
  — hệ quả tất yếu của kiến trúc thuần front-end, không có backend để chặn.
- **Không có market-scope thực thi theo Role** — dù UI có field `scope:'market'` khi tạo role mới, hệ thống
  không dùng field đó để giới hạn `ui.market` hay lọc dữ liệu.
- **Không có liên kết Account ↔ Role runtime** — sửa `roleIds`/`marketScopes` của account không đổi hành vi
  ứng dụng.
- **"Cấu hình dịch vụ"** (giá mặt bằng, điện nước, kỳ thu, quy tắc thu phí) chưa được engine tính tiền thật
  đọc — mọi số tiền vẫn tính từ hằng số cứng trong `data.js` (`UNIT`, `SESSION_FEE`, `ELEC`, `WATER`).
- **`billingRules.approverRoleId`** (giá trị mặc định `'bql'`, `serviceconfig.js:40`) tồn tại như 1 field cấu
  hình nhưng không có action/permission nào thực sự đọc field này để định tuyến phê duyệt — miễn giảm khoản
  phải thu hiện "phê duyệt ngay" không qua bước duyệt riêng (tự nhận trong `v-taichinh.js:290`).
- **`D.ROLES`** (data.js) — bảng mô tả 7 "vai trò nghiệp vụ" (Kế toán, Nhân viên thu phí, Nhân viên kỹ
  thuật, Quản trị hệ thống…) chưa từng được hiện thực hoá thành role thật trong `A.PERM` — hệ thống hiện chỉ
  có 3 role effective.

---

# 12. Questions Requiring Business Confirmation

1. **[NEED_CONFIRMATION]** Có cần bổ sung permission action riêng cho "Vai trò & phân quyền" (tạo/sửa/xoá
   role, cấp/thu hồi permission) thay vì để mặc định bất kỳ ai vào `cai-dat` đều làm được không? Đây hiện là
   khoảng trống lớn nhất được phát hiện (mục 10, #1).
2. **[NEED_CONFIRMATION]** "Thiết lập mặt bằng chợ" (`cau-truc`), "Hợp đồng" (`hop-dong`), "Công nợ & nhắc
   nợ" (`cong-no`), "Thông báo đa kênh" (`thong-bao`) có cần permission action riêng cho từng thao tác
   (thêm/sửa/xoá/gia hạn/thanh lý/nhắc nợ/gửi) hay việc chỉ gate ở cấp screen là đủ theo thiết kế hiện tại?
3. **[NEED_CONFIRMATION]** "Thanh lý hợp đồng" khi tiểu thương còn nợ hiện chỉ cảnh báo chứ không chặn — đây
   có phải hành vi mong muốn (cho phép Ban Quản lý toàn quyền quyết định) hay cần chặn cứng/thêm bước duyệt?
4. **[NEED_CONFIRMATION]** Field `scope`/`market` trên Role (và `marketScopes` trên Account) có đang được kỳ
   vọng sẽ thực sự giới hạn dữ liệu/`ui.market` ở giai đoạn sau, hay chỉ là nhãn mô tả cho mục đích tài liệu
   hoá vai trò?
5. **[NEED_CONFIRMATION]** "Cấu hình dịch vụ" (đơn giá, điện nước, kỳ thu, quy tắc thu phí) có kế hoạch được
   nối vào engine tính tiền thật không? Nếu có, việc đó có kéo theo yêu cầu permission mới nào không (ví dụ
   phân biệt rõ "người cấu hình giá" và "người vận hành thu tiền")?
6. **[NEED_CONFIRMATION]** Có kế hoạch xây dựng cơ chế đăng nhập/Account thật (liên kết `Account.roleIds` với
   `ui.role` đang chạy) hay "Vai trò" ở topbar sẽ tiếp tục là công cụ demo độc lập?
7. **[NEED_CONFIRMATION]** Nhãn nhóm `group: 'Tiểu thương & hợp đồng'` của `screen:diem-kd` trong
   `permissions.js` (dùng cho ma trận phân quyền ở màn Cài đặt) có cần cập nhật thành "Điều hành" để khớp với
   cấu trúc sidebar mới không, hay 2 cách phân nhóm (điều hướng vs. phân quyền) được phép khác nhau?
8. **[NEED_CONFIRMATION]** "Phiên chợ quê" có kế hoạch ẩn khỏi menu khi đang chọn "Chợ Cao Lãnh" ở topbar
   (đúng như định hướng "Chợ Cao Lãnh dùng ghi điện/nước; Chợ quê dùng phiên chợ" đã đề cập ở các trao đổi
   trước), hay việc đó thuộc phạm vi một task khác và hiện tại cứ để luôn hiển thị không điều kiện?
9. **[NEED_CONFIRMATION]** `billingRules.approverRoleId` (mặc định `'bql'`) có nên được dùng thật để định
   tuyến bước phê duyệt miễn giảm (thay vì "phê duyệt ngay" như hiện tại), và nếu có thì ai là người phê
   duyệt cấp cao hơn `bql` trong mô hình vai trò thật (vì hiện `bql` đã là "toàn quyền")?
10. **[NEED_CONFIRMATION]** `D.ROLES` (7 vai trò nghiệp vụ mô tả: Kế toán, Nhân viên thu phí, Nhân viên kỹ
    thuật, Quản trị hệ thống…) có phải là định hướng cho việc **mở rộng số role thật** trong `A.PERM` ở giai
    đoạn sau không, hay chỉ là tài liệu tham khảo không còn giá trị (dead data, có thể xoá)?

---

*Nguồn: đọc toàn văn `index.html`, `data.js` (phần cấu trúc chính), `js/core.js`, `js/permissions.js`,
`js/accounts.js`, `js/serviceconfig.js`, `js/v-cautruc.js`, `js/v-dieuhanh.js`, `js/v-tieuthuong.js`,
`js/v-taichinh.js`, `js/v-vanhanh.js`, `js/mini.js` tại thời điểm viết tài liệu. Không sửa bất kỳ file mã
nguồn nào trong quá trình phân tích.*
