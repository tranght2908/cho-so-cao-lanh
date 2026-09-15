# HỒ SƠ HỆ THỐNG — PROTOTYPE "Hệ thống quản lý chợ số phường Cao Lãnh"

> Tài liệu này là **PHÂN TÍCH CODE HIỆN TRẠNG** (current-state analysis), không phải đặc tả yêu cầu.
> Mọi nhận định đều được rút ra trực tiếp từ mã nguồn tại thời điểm review; không có suy diễn chức năng
> ngoài những gì code thể hiện. Nơi nào không đủ bằng chứng, tài liệu ghi rõ "KHÔNG XÁC ĐỊNH ĐƯỢC" hoặc
> đưa vào mục 35 (Questions Requiring Business Confirmation).
> Đây thuần túy là prototype front-end: toàn bộ "dữ liệu" là mock sinh từ `data.js` (seed cố định) và/hoặc
> `localStorage` của trình duyệt — không có server, API hay database thật nào phía sau.

---

## 1. Executive Summary

| Chỉ số | Số lượng | Ghi chú |
|---|---|---|
| Module (nhóm menu) | 5 | Điều hành, Tiểu thương & hợp đồng, Tài chính, Vận hành, Dành cho tiểu thương |
| Màn hình (screen) có `A.VIEWS[...]` | 18 | Khớp 1-1 với 18 permission `screen:*` trong `permissions.js` |
| File nguồn đã đọc | 15 | `index.html`, `styles.css`, `data.js`, 12 file trong `js/` (liệt kê ở mục 40) |
| Vai trò (role) **có hiệu lực thật** trong permission engine | 3 | `lanhdao`, `bql`, `tieuthuong` (xem mục 4, 6) |
| "Vai trò/loại actor" khác tồn tại song song nhưng **không** điều khiển permission | 3 bộ | `D.STAFF[].role` (text), `D.ROLES` (không được dùng ở đâu cả), `A.ACCOUNTS.ACCOUNT_TYPES` |
| Permission key trong `CATALOG` | 47 | 18 `screen:*` + 29 `action:*` |
| localStorage key | 7 | Xem mục 13 |
| Entity dữ liệu chính (data.js) | 17 | stalls, traders, contracts, invoices, payments, readings, incidents, notifications, sessions, bank, months, audit, billingPeriods, meterPeriods, meterAdjustRequests, cashDeposits, cashConfirms |
| Entity dữ liệu phụ (module riêng, không thuộc data.js) | 4 | Account (`accounts.js`), ServiceConfig×5 loại bản ghi (`serviceconfig.js`), Layout/Zone (`v-cautruc.js`), RolePermission (`permissions.js`) |
| Action/handler `A.ACT` phân biệt | 87 | đếm bằng grep, xem mục 40 |
| Handler `A.CH` (change) | 80 | |
| Handler `A.IN` (input) | 9 | |
| Trạng thái nghiệp vụ (status/state machine) khác nhau tìm thấy | ~15 | Xem mục 13 |
| Luồng nghiệp vụ end-to-end chính | 8 | Xem mục 15 |
| Chức năng phân loại UI_ONLY / PLACEHOLDER | 12 | Xem mục 24 |
| Chức năng phân loại MOCK_WORKING | ~55 | Đa số action ghi dữ liệu vào `A.db` + `localStorage`, xem mục 7 |
| Chức năng phân loại WORKING_FE (tính toán/validate thật ở FE) | ~20 | Ví dụ: tính kWh/m³, tính hạn/quá hạn, validate CCCD trùng |
| Chức năng DEAD/UNUSED tìm thấy | 3 | `D.ROLES`, cấu hình `Cấu hình dịch vụ` (5 loại bản ghi) không được đọc bởi engine tính tiền thật, `billingRules`/`billingCycle` toggle không có tác dụng |
| Inconsistency tìm thấy (mục 34) | 14 | 2 CRITICAL, 5 HIGH, 5 MEDIUM, 2 LOW |

**Tóm tắt 1 đoạn:** Đây là một prototype front-end thuần JavaScript (vanilla, không framework), toàn bộ state
sống trong bộ nhớ (`window.APP.db`) và được đồng bộ định kỳ vào `localStorage` qua các hàm `save()` riêng của
từng module. Có một permission engine động thực sự chạy (Account→Role→Permission, xem mục 5) và được áp
dụng nhất quán ở cấp **screen**, nhưng ở cấp **action bên trong màn hình** thì mức độ áp dụng KHÔNG đồng đều —
nhiều màn (Hợp đồng, Thiết lập mặt bằng chợ, Thông báo đa kênh) không có bất kỳ permission action nào, chỉ
dựa vào permission màn hình. Có một module cấu hình "Cấu hình dịch vụ" (đơn giá, điện nước, kỳ thu, quy tắc
thu phí) được xây dựng khá đầy đủ nhưng **do chính comment trong code xác nhận** là hoàn toàn tách rời khỏi
engine tính tiền thật (vẫn dùng hằng số trong `data.js`) — đây là khoảng cách lớn nhất giữa "trông như hoạt
động" và "thực sự tính tiền".

---

## 2. Project Structure

| File | Vai trò | Module liên quan | State/localStorage sở hữu | Ghi chú |
|---|---|---|---|---|
| `index.html` | Khung trang, nạp script theo thứ tự cố định | Toàn hệ thống | — | Thứ tự load: `data.js → core.js → permissions.js → accounts.js → serviceconfig.js → v-dieuhanh.js → v-cautruc.js → v-tieuthuong.js → v-taichinh.js → v-vanhanh.js → mini.js`. Thứ tự này **có ý nghĩa**: các file `v-*.js` đăng ký vào `A.VIEWS/A.ACT/A.CH/A.IN` đã được `core.js` khởi tạo trước đó. |
| `styles.css` | Toàn bộ style, không chứa logic nghiệp vụ | Toàn hệ thống | — | Thuần CSS, 297 dòng. |
| `data.js` | Sinh **toàn bộ mock data** bằng RNG có seed cố định (`seed = 20260913`) | Toàn hệ thống (nguồn dữ liệu gốc) | Không tự lưu localStorage (việc lưu do `core.js` đảm nhiệm) | `window.DATA.build()` trả về object db đầy đủ. `VERSION = 6` — dùng để phát hiện schema cũ trong localStorage (mục 34, CRITICAL). |
| `js/core.js` | Lõi ứng dụng: state `ui`, tiện ích `U.*`, router, render loop, modal, `A.applyPayment` (engine thanh toán dùng chung), `A.MENU` (cấu trúc menu tĩnh) | Toàn hệ thống | `choso-caolanh-state` (toàn bộ `A.db`), `choso-caolanh-ui` (role+market), `choso-caolanh-guide` | `A.MENU` định nghĩa cấu trúc/icon/badge menu; **không** chứa permission (permission tra bằng `U.can()` gọi sang `A.PERM`). |
| `js/permissions.js` | Permission engine động: catalog, role, role-permission, scope | Toàn hệ thống | `choso-caolanh-permissions` | Xem mục 5. |
| `js/accounts.js` | CRUD "Tài khoản người dùng" — **độc lập** với `ui.role` đang chạy | Vận hành (màn Tài khoản) | `choso-caolanh-accounts` | Tự nhận trong comment đầu file: seed lấy từ `D.STAFF` nhưng là bản sao, sửa ở đây không ảnh hưởng `D.STAFF`. |
| `js/serviceconfig.js` | Kho cấu hình "Cấu hình dịch vụ" (đơn giá, điện nước, dịch vụ khác, kỳ thu, quy tắc thu phí) | Tài chính (chỉ ở màn Cài đặt) | `choso-caolanh-serviceconfig` | Tự nhận trong comment đầu file: **KHÔNG** được các màn tài chính thật đọc. |
| `js/v-dieuhanh.js` | Tổng quan liên chợ, Sơ đồ mặt bằng, Phiên chợ quê | Điều hành | (dùng chung `A.save()`) | Chứa `A.stallPanel` và `A.marketStats` được các module khác gọi lại (`v-tieuthuong.js` dùng `A.stallPanel`). |
| `js/v-cautruc.js` | Thiết lập mặt bằng chợ (quy hoạch khối/tầng/khu) | Điều hành | `choso-caolanh-layout` | Tự nhận trong comment đầu file: hoàn toàn tách khỏi `MARKETS`/`stalls` thật — chỉ là bản nháp quy hoạch. |
| `js/v-tieuthuong.js` | Điểm kinh doanh, Tiểu thương, Hợp đồng | Tiểu thương & hợp đồng | (dùng chung `A.save()`) | |
| `js/v-taichinh.js` | Chỉ số điện nước, Khoản phải thu, Thu tiền, Đối soát, Công nợ + Finance Time Bar dùng chung | Tài chính | (dùng chung `A.save()`) | File lớn nhất về nghiệp vụ tài chính (727 dòng). |
| `js/v-vanhanh.js` | Phản ánh & sự cố, Thông báo đa kênh, Báo cáo thống kê, Tài khoản người dùng, Cài đặt & phân quyền | Vận hành | (dùng chung `A.save()`) | File lớn nhất tổng thể (904 dòng), gồm cả UI cho `permissions.js` và `serviceconfig.js`. |
| `js/mini.js` | Mini app tiểu thương (mô phỏng điện thoại) | Dành cho tiểu thương | (dùng chung `A.save()`) | Không có bất kỳ permission check nào (đúng vì tự phục vụ), gọi lại `A.applyPayment`, `A.addIncident`. |

**Nguồn:** đọc toàn văn cả 15 file (không suy diễn từ tên file).

---

## 3. Navigation / Module Map

Cấu trúc menu lấy **chính xác** từ `A.MENU` (`js/core.js`, dòng ~257-286). Việc hiện/ẩn từng mục do
`chrome()` lọc bằng `U.can(it.id)` → `A.PERM.canScreen(ui.role, id)` (mục 5).

```
ĐIỀU HÀNH
- tong-quan        📊 Tổng quan liên chợ
- cau-truc         🧱 Thiết lập mặt bằng chợ
- so-do            🗺️ Sơ đồ mặt bằng
- phien-cho        🪷 Phiên chợ quê

TIỂU THƯƠNG & HỢP ĐỒNG
- diem-kd          🏪 Điểm kinh doanh
- tieu-thuong      👥 Tiểu thương
- hop-dong         📄 Hợp đồng                (badge = số hợp đồng hiệu lực còn ≤30 ngày)

TÀI CHÍNH
- dien-nuoc        ⚡ Chỉ số điện, nước
- phai-thu         🧾 Khoản phải thu
- thu-tien         💳 Thu tiền & biên lai
- doi-soat         🔁 Đối soát                (badge = số giao dịch ngân hàng chưa khớp)
- cong-no          ⏰ Công nợ & nhắc nợ

VẬN HÀNH
- su-co            🛠️ Phản ánh & sự cố        (badge = số phản ánh ở trạng thái "Tiếp nhận")
- thong-bao        📣 Thông báo đa kênh
- bao-cao          📈 Báo cáo thống kê
- tai-khoan        🧑‍💼 Tài khoản người dùng
- cai-dat          ⚙️ Cài đặt & phân quyền

DÀNH CHO TIỂU THƯƠNG
- mini-app         📱 Mini app tiểu thương
```

Không có tên nào bị đổi so với code. Badge được tính lại mỗi lần render (hàm `badge()` trong từng menu item).

### Bảng Menu → Screen → Permission → Scope

| Menu id | Function render (`A.VIEWS[...]`) | File | Permission (screen) | Scope áp dụng |
|---|---|---|---|---|
| tong-quan | `A.VIEWS['tong-quan']` | v-dieuhanh.js | `screen:tong-quan` | `ui.market` (qua `U.inM`) |
| cau-truc | `A.VIEWS['cau-truc']` | v-cautruc.js | `screen:cau-truc` | `ui.market`/`ui.qh.market` (chỉ chọn layout của 1 chợ để xem, không filter dữ liệu thật) |
| so-do | `A.VIEWS['so-do']` | v-dieuhanh.js | `screen:so-do` | `ui.market`/`ui.planMarket` |
| phien-cho | `A.VIEWS['phien-cho']` | v-dieuhanh.js | `screen:phien-cho` | Cố định chợ TTD (không có market selector áp dụng — dữ liệu vốn chỉ thuộc TTD) |
| diem-kd | `A.VIEWS['diem-kd']` | v-tieuthuong.js | `screen:diem-kd` | `ui.market` |
| tieu-thuong | `A.VIEWS['tieu-thuong']` | v-tieuthuong.js | `screen:tieu-thuong` | `ui.market` |
| hop-dong | `A.VIEWS['hop-dong']` | v-tieuthuong.js | `screen:hop-dong` | `ui.market` |
| dien-nuoc | `A.VIEWS['dien-nuoc']` | v-taichinh.js | `screen:dien-nuoc` | `ui.market` + `ui.period` (kỳ ghi chỉ số, dùng chung `A.db.meterPeriods`) |
| phai-thu | `A.VIEWS['phai-thu']` | v-taichinh.js | `screen:phai-thu` | `ui.market` + `ui.period` (kỳ thu, dùng chung `A.db.billingPeriods`) |
| thu-tien | `A.VIEWS['thu-tien']` | v-taichinh.js | `screen:thu-tien` | `ui.market` + `f.thuDate` (ngày thu, riêng biệt) |
| doi-soat | `A.VIEWS['doi-soat']` | v-taichinh.js | `screen:doi-soat` | `ui.market` + `ui.period` + `ui.dsFrom/dsTo` (ngày giao dịch, riêng biệt) |
| cong-no | `A.VIEWS['cong-no']` | v-taichinh.js | `screen:cong-no` | `ui.market` + `f.cnAsOf`/`f.cnOrigin` (độc lập với `ui.period` chung) |
| su-co | `A.VIEWS['su-co']` | v-vanhanh.js | `screen:su-co` | `ui.market` |
| thong-bao | `A.VIEWS['thong-bao']` | v-vanhanh.js | `screen:thong-bao` | Không filter theo `ui.market` (gửi theo nhóm chọn thủ công trong form) |
| bao-cao | `A.VIEWS['bao-cao']` | v-vanhanh.js | `screen:bao-cao` | `ui.market` (đa số báo cáo), nhưng có báo cáo hard-code kỳ 09/2026 (xem mục 34) |
| tai-khoan | `A.VIEWS['tai-khoan']` | v-vanhanh.js | `screen:tai-khoan` | Filter theo `marketScopes` của **account** (không phải `ui.market`) — đây là field filter riêng trong chính màn này |
| cai-dat | `A.VIEWS['cai-dat']` | v-vanhanh.js | `screen:cai-dat` | Không có scope theo chợ (cấu hình áp dụng theo `marketId` từng bản ghi) |
| mini-app | `A.VIEWS['mini-app']` | mini.js | `screen:mini-app` | Không dùng `ui.market` — mini app luôn hiển thị theo `t.market` của tiểu thương đang chọn; `$('#market-wrap').style.display = 'none'` khi ở màn này (core.js dòng 301) |

**Nguồn:** `js/core.js` hàm `chrome()` (dòng 290-305) và `U.can` (dòng 57-60).

---

## 4. Actors / Roles

### 4.1 Role thật sự điều khiển permission (`A.PERM` — `js/permissions.js`, hàm `defaultRoles()`)

| Role ID | Tên hiển thị | Mô tả (đúng nguyên văn code) | scope | selfService | builtin |
|---|---|---|---|---|---|
| `lanhdao` | Lãnh đạo phường | "Lãnh đạo UBND phường – theo dõi liên chợ, xử lý phản ánh vượt cấp" | `all` | false | true |
| `bql` | Ban Quản lý chợ | "Toàn quyền nghiệp vụ trong phạm vi chợ được giao" | `all` | false | true |
| `tieuthuong` | Tiểu thương | "Tự phục vụ qua mini app..." | `self` | true | true |

Đây là **toàn bộ** danh sách role có hiệu lực thật (được lưu ở `localStorage['choso-caolanh-permissions']`,
đọc bằng `A.PERM.roles()`). Màn "Cài đặt & phân quyền → Vai trò & phân quyền" cho phép **thêm role mới**
(`role-new`/`role-form-save`, `js/v-vanhanh.js` dòng 839-874) — vai trò mới thêm được gán `scope`
(`all`/`market`/`self`) nhưng **không có permission nào được cấp mặc định** (phải tick tay từng permission
trong ma trận). Vai trò mới **không** tự động xuất hiện trong `$('#role-seg')` trừ khi `active = true` (mặc
định true khi tạo).

### 4.2 Các "vai trò/loại actor" khác tồn tại song song — KHÔNG điều khiển permission

Phát hiện quan trọng: có **3 bảng dữ liệu khác** trông giống "role" nhưng hoàn toàn tách rời khỏi
`A.PERM`:

| Nguồn | Nội dung | Dùng ở đâu | Có ảnh hưởng permission không? |
|---|---|---|---|
| `D.STAFF[].role` (text, `data.js` dòng 90-98) — 7 bản ghi: Trưởng Ban Quản lý chợ, Kế toán, Nhân viên thu phí ×2, Nhân viên kỹ thuật, Tổ quản lý chợ quê, Nhân viên thu phí phiên | Chỉ là nhãn hiển thị + dùng để lọc dropdown "Người xử lý" trong Phản ánh & sự cố (`D.STAFF.filter(s => s.market === i.market)`, `v-vanhanh.js` dòng 49) và để tính `by` (người thu) trong seed thanh toán tiền mặt | `su-co.phan-cong` (chọn người xử lý), `U.staffName()` khắp nơi | **Không.** Đây chỉ là danh bạ nhân sự để hiển thị tên, không tham gia bất kỳ phép kiểm tra quyền nào. |
| `D.ROLES` (`data.js` dòng 100-108) — 7 dòng role/scope/rights dạng mô tả | — | **Không tìm thấy bất kỳ tham chiếu nào** ngoài 1 dòng comment trong `permissions.js` (dòng 166) | **Dead data — xem mục 26.** |
| `A.ACCOUNTS.ACCOUNT_TYPES` (`accounts.js` dòng 12) — 5 loại: Quản trị hệ thống, Lãnh đạo UBND phường, Ban Quản lý chợ, Nhân viên Ban Quản lý chợ, Tiểu thương | Field `accountType` hiển thị trong màn Tài khoản người dùng | Chỉ hiển thị/lọc trong chính màn Tài khoản | **Không.** Một account có `accountType = 'Quản trị hệ thống'` **không** có quyền gì khác — quyền thật của phiên demo chỉ do `ui.role` (1 trong 3 giá trị ở mục 4.1) quyết định. |

**Hệ quả quan trọng (đưa vào mục 28, 34):** Account (`js/accounts.js`) có field `roleIds` (mảng id role
kiểu `['bql']`) và `marketScopes`, **nhưng không có bất kỳ cơ chế "đăng nhập bằng account" nào** trong toàn
bộ code. Việc chọn "Vai trò" ở thanh trên (`data-act="role"`) chỉ đổi `ui.role` giữa 3 giá trị cố định ở mục
4.1, hoàn toàn độc lập với danh sách Account. Sửa `roleIds`/`marketScopes` của một account trong màn "Tài
khoản người dùng" **không** thay đổi hành vi ứng dụng ở bất kỳ đâu khác.

### 4.3 Nhân sự (`D.STAFF`) dùng trong seed dữ liệu

| ID | Tên | role (text) | market |
|---|---|---|---|
| NV01 | Trần Minh Khoa | Trưởng Ban Quản lý chợ | CL |
| NV02 | Lê Thị Ngọc Hân | Kế toán | CL |
| NV03 | Phạm Văn Lợi | Nhân viên thu phí | CL |
| NV04 | Nguyễn Thị Diễm | Nhân viên thu phí | CL |
| NV05 | Võ Hoàng Tuấn | Nhân viên kỹ thuật (điện, nước) | CL |
| NV06 | Huỳnh Thanh Tâm | Tổ quản lý chợ quê | TTD |
| NV07 | Đỗ Thị Kim Yến | Nhân viên thu phí phiên | TTD |

`NV01` (Trần Minh Khoa) được **hard-code làm actor mặc định** ở nhiều nơi (xem mục 8) bất kể ai đang thao
tác, trừ khi `ui.role === 'lanhdao'`.

**Nguồn:** `js/permissions.js` (`defaultRoles`, dòng 86-92), `data.js` (`STAFF`, `ROLES`), `js/accounts.js`.

---

## 5. Permission Architecture

### 5.1 Kiến trúc thật sự đang chạy

```
Account (accounts.js — CRUD only, KHÔNG có khái niệm "đang đăng nhập")
        ⋯ (không có liên kết runtime) ⋯
ui.role  (1 trong 3 giá trị: lanhdao | bql | tieuthuong — đổi qua nút "Vai trò" trên topbar)
   │
   ▼
Role (STATE.roles — permissions.js, có thể thêm/sửa/vô hiệu hoá/xoá qua UI "Cài đặt & phân quyền")
   │  scope: 'all' | 'market' | 'self'  (field trên Role, KHÔNG có bảng Scope riêng)
   ▼
RolePermission (STATE.rolePerms — quan hệ nhiều-nhiều Role×Permission, có grantedAt/grantedBy)
   │
   ▼
Permission (CATALOG tĩnh — 47 key, kind: 'screen' | 'action')
   │
   ▼
UI/Action:
   - U.can(screenId) → A.PERM.canScreen(ui.role, screenId)   → gate MENU + ROUTER (screen)
   - A.PERM.canAction(ui.role, actionKey)                     → gate TỪNG NÚT/HÀNH ĐỘNG cụ thể (action)
```

Đây đúng là mô hình **Account → Role → Permission → Scope → UI/Action** mà đề bài mô tả, NHƯNG "Account"
trong sơ đồ trên chỉ tồn tại trên giấy — không có bước xác thực nào biến một Account cụ thể thành `ui.role`
đang chạy. `scope` cũng không phải bảng riêng mà là 1 field gắn trực tiếp trên Role (đúng như comment trong
code, `permissions.js` dòng 162-172), và **hiện tại không có đoạn code nào thực sự đọc field `scope` của
Role để giới hạn dữ liệu** — market scope thực tế đang chạy hoàn toàn dựa vào `ui.market` (mục 6), tách biệt
khỏi Role.scope.

### 5.2 API (`A.PERM`, `js/permissions.js` dòng 192-228)

`canScreen(roleId, screenId)`, `canAction(roleId, actionKey)`, `hasPerm`, `roles`, `activeRoles`, `role`,
`rolePermKeys`, `addRole`, `updateRole`, `setRoleActive`, `removeRole`, `grant`, `revoke`, `resetDefault`.
State load có cơ chế tự vá (`loadState`, dòng 174-187): nếu `localStorage` đã lưu state cũ (từ bản trước
khi thêm permission mới), các permission key **mới toanh** (chưa từng xuất hiện ở bất kỳ role nào trong
state cũ) sẽ được cấp lại theo seed mặc định — nhưng permission đã tồn tại từ trước mà admin đã tự thu hồi
thì **không** bị ghi đè.

### 5.3 Toàn bộ 47 permission key

**Screen (18) — seed mặc định theo `screenRoles`:**

| Key | Nhóm | Label | Role mặc định |
|---|---|---|---|
| `screen:tong-quan` | Điều hành | Tổng quan liên chợ | lanhdao, bql |
| `screen:cau-truc` | Điều hành | Thiết lập mặt bằng chợ | bql |
| `screen:so-do` | Điều hành | Sơ đồ mặt bằng | lanhdao, bql |
| `screen:phien-cho` | Điều hành | Phiên chợ quê | lanhdao, bql |
| `screen:diem-kd` | Tiểu thương & hợp đồng | Điểm kinh doanh | bql |
| `screen:tieu-thuong` | Tiểu thương & hợp đồng | Tiểu thương | lanhdao, bql |
| `screen:hop-dong` | Tiểu thương & hợp đồng | Hợp đồng | bql |
| `screen:dien-nuoc` | Tài chính | Chỉ số điện, nước | bql |
| `screen:phai-thu` | Tài chính | Khoản phải thu | bql |
| `screen:thu-tien` | Tài chính | Thu tiền & biên lai | bql |
| `screen:doi-soat` | Tài chính | Đối soát | lanhdao, bql |
| `screen:cong-no` | Tài chính | Công nợ & nhắc nợ | bql |
| `screen:su-co` | Vận hành | Phản ánh & sự cố | lanhdao, bql |
| `screen:thong-bao` | Vận hành | Thông báo đa kênh | bql |
| `screen:bao-cao` | Vận hành | Báo cáo thống kê | lanhdao, bql |
| `screen:tai-khoan` | Vận hành | Tài khoản người dùng | bql |
| `screen:cai-dat` | Vận hành | Cài đặt & phân quyền | bql |
| `screen:mini-app` | Dành cho tiểu thương | Mini app tiểu thương | lanhdao, bql, tieuthuong |

**Action (29) — seed mặc định theo `actionRoles`, kèm nơi kiểm tra (`function/file`):**

| Key | screenId | Label | Role mặc định | Kiểm tra tại |
|---|---|---|---|---|
| `action:so-do.xem-ho-so` | so-do | Xem hồ sơ tiểu thương từ sơ đồ mặt bằng | bql | `A.stallPanel`, v-dieuhanh.js:124 |
| `action:so-do.tao-hop-dong` | so-do | Tạo hợp đồng từ sơ đồ mặt bằng | bql | `A.stallPanel`, v-dieuhanh.js:125 |
| `action:so-do.doi-trang-thai` | so-do | Đổi trạng thái điểm kinh doanh | bql | `A.stallPanel`, v-dieuhanh.js:126 |
| `action:phien-cho.chot-phien` | phien-cho | Điểm danh & chốt phiên chợ quê | bql | `A.VIEWS['phien-cho']`, v-dieuhanh.js:227 |
| `action:tieu-thuong.them-moi` | tieu-thuong | Thêm hồ sơ tiểu thương | bql | `A.VIEWS['tieu-thuong']`, v-tieuthuong.js:56 |
| `action:dien-nuoc.ghi-chi-so` | dien-nuoc | Nhập / lưu nháp chỉ số điện, nước | bql | `A.VIEWS['dien-nuoc']`, v-taichinh.js:82 |
| `action:dien-nuoc.chot-ky` | dien-nuoc | Chốt kỳ ghi chỉ số điện, nước | bql | v-taichinh.js:83 |
| `action:dien-nuoc.yeu-cau-dieu-chinh` | dien-nuoc | Yêu cầu điều chỉnh chỉ số kỳ đã chốt | bql | v-taichinh.js:172 |
| `action:phai-thu.mien-giam` | phai-thu | Miễn giảm / điều chỉnh khoản phải thu | bql | v-taichinh.js:281 |
| `action:thu-tien.thu` | thu-tien | Thu tiền (mọi nơi có nút "Thu tiền") | bql | v-taichinh.js:282, v-dieuhanh.js:123, v-tieuthuong.js:87 |
| `action:doi-soat.xem-ngan-hang` | doi-soat | Xem đối soát ngân hàng / QR | lanhdao, bql | v-taichinh.js:380 |
| `action:doi-soat.gan-thu-cong` | doi-soat | Gắn khoản thu thủ công cho giao dịch ngân hàng | bql | v-taichinh.js:381 |
| `action:doi-soat.xem-tien-mat` | doi-soat | Xem đối soát tiền mặt | lanhdao, bql | v-taichinh.js:382 |
| `action:doi-soat.xac-nhan-nop-quy` | doi-soat | Xác nhận đối soát nộp quỹ tiền mặt | bql | v-taichinh.js:383 |
| `action:doi-soat.xem-truy-vet` | doi-soat | Xem lịch sử truy vết đối soát | bql | v-taichinh.js:384 |
| `action:su-co.tao-phan-anh` | su-co | Tạo phản ánh / sự cố thủ công | bql | v-vanhanh.js (view `su-co`) |
| `action:su-co.phan-cong` | su-co | Phân công người xử lý | bql | v-vanhanh.js |
| `action:su-co.chuyen-trang-thai` | su-co | Chuyển trạng thái xử lý | bql | v-vanhanh.js |
| `action:su-co.vuot-cap` | su-co | Chuyển phản ánh vượt cấp lên phường | bql | v-vanhanh.js |
| `action:su-co.chi-dao` | su-co | Gửi ý kiến chỉ đạo (cho phản ánh đã vượt cấp) | **lanhdao** | v-vanhanh.js — permission duy nhất seed mặc định cho `lanhdao` chứ không phải `bql` |
| `action:tai-khoan.tao-moi` | tai-khoan | Thêm tài khoản người dùng | bql | v-vanhanh.js:267 |
| `action:tai-khoan.sua` | tai-khoan | Sửa thông tin tài khoản | bql | v-vanhanh.js:225, 268 |
| `action:tai-khoan.khoa-mo-khoa` | tai-khoan | Khoá / mở khoá tài khoản | bql | v-vanhanh.js:269 |
| `action:tai-khoan.gan-quyen` | tai-khoan | Gán vai trò / phạm vi chợ cho tài khoản | bql | v-vanhanh.js:249 (khoá field roleIds/marketScopes trên form nếu không có quyền) |
| `action:cai-dat.gia-mat-bang` | cai-dat | Quản lý đơn giá mặt bằng | bql | v-vanhanh.js:453 |
| `action:cai-dat.gia-dien-nuoc` | cai-dat | Quản lý giá điện, nước | bql | v-vanhanh.js:494 |
| `action:cai-dat.dich-vu-khac` | cai-dat | Quản lý dịch vụ khác | bql | v-vanhanh.js:533 |
| `action:cai-dat.ky-thu` | cai-dat | Cấu hình kỳ thu | bql | v-vanhanh.js:716 |
| `action:cai-dat.quy-tac-thu-phi` | cai-dat | Cấu hình quy tắc thu phí | bql | v-vanhanh.js:747 |

**Permission tồn tại nhưng không dùng ("defined but not referenced"):** không có — cả 47 key đều được ít
nhất 1 nơi trong `js/v-*.js` gọi `canScreen`/`canAction` tương ứng (đã grep xác nhận từng key).

**Action quan trọng KHÔNG có bất kỳ permission check nào** (chỉ dựa vào permission màn hình bao trùm) —
xem chi tiết bằng chứng ở mục 8 và 34:
- Toàn bộ CRUD trong "Thiết lập mặt bằng chợ" (`qh-add-block`, `qh-del-zone`, `qh-save-final`, …) — 20 action, `v-cautruc.js`.
- `ct-extend` / `ct-end` / `ct-new` (Gia hạn, Thanh lý, Tạo hợp đồng) trong màn Hợp đồng — `v-tieuthuong.js` dòng 144-198.
- `dk-open`/`dk-csv` (Điểm kinh doanh) — nhưng đây chỉ là xem/export nên rủi ro thấp.
- `tb-send` (Gửi thông báo đa kênh) — `v-vanhanh.js` dòng 138.
- `session-open`/`session-save` (chốt phiên chợ quê) **CÓ** check `phien-cho.chot-phien` — không thuộc nhóm này, liệt kê để đối chiếu.

**Nguồn:** `js/permissions.js` toàn văn; các dòng đối chiếu ở `js/v-*.js` như trích dẫn.

---

## 6. Market Scope

### 6.1 Cơ chế thật sự đang chạy

- **Lưu ở đâu:** `ui.market` (giá trị `'ALL' | 'CL' | 'TTD'`), khởi tạo trong `js/core.js` dòng 10, ghi vào
  `localStorage['choso-caolanh-ui']` qua `A.saveUi()` mỗi khi đổi (`A.ACT.market`, core.js dòng 343).
- **Selector nằm ở:** thanh topbar, `#market-seg` (core.js `chrome()` dòng 300), luôn hiển thị trừ khi
  `A.current === 'mini-app'` (dòng 301 ẩn cả khối `#market-wrap`).
- **Filter dữ liệu:** hàm dùng chung duy nhất `U.inM = x => ui.market === 'ALL' || x.market === ui.market`
  (core.js dòng 42). Mọi entity muốn được filter theo chợ phải có field `.market` và bị lọc thủ công bằng
  `U.inM(...)` tại từng nơi query — **không có tầng data-access tập trung nào tự động áp** filter này.
- **Permission có scope theo market không:** Role có field `scope` (`all`/`market`/`self`) nhưng — như nêu ở
  mục 5.1 — **không tìm thấy đoạn code nào đọc `role.scope`/`role.market` để chặn dữ liệu**; ngay cả role
  mới tạo với `scope: 'market'` (gắn `role.market = 'CL'` chẳng hạn) cũng không tự động giới hạn `ui.market`
  — người dùng vẫn có thể tự bấm chuyển sang "Chợ quê TTĐ" ở topbar nếu role đó có quyền màn hình tương ứng.
  → Đây là **INFERRED GAP**: cột "Phạm vi dữ liệu" hiển thị trong bảng Vai trò (`scopeLabel()`,
  `v-vanhanh.js` dòng 363-367) chỉ là **nhãn mô tả**, không phải ràng buộc thực thi.
- **Role nào có scope `all`:** `lanhdao`, `bql` (theo seed). `tieuthuong` có `scope: 'self'` +
  `selfService: true` → khi active, `A.ACT.role` tự điều hướng thẳng vào `mini-app` (core.js dòng 341) và ẩn
  `#market-wrap`, nhưng đây là hành vi UI, không phải một cơ chế lọc dữ liệu theo scope.
- **localStorage có lưu market không:** Có — `choso-caolanh-ui` lưu `{role, market}` (core.js dòng 166).

### 6.2 Entity có field `marketId`-tương-đương (tên field thật là `market`, trừ Account)

| Entity | Field | File nguồn |
|---|---|---|
| Stall (điểm kinh doanh) | `market` | data.js |
| Trader (tiểu thương) | `market` | data.js |
| Contract (hợp đồng) | `market` | data.js |
| Invoice (khoản phải thu) | `market` | data.js |
| Payment (thanh toán) | `market` | data.js (seed) + `A.applyPayment` (core.js) |
| Incident (phản ánh) | `market` | data.js |
| BankStatementTransaction | `market` | data.js + `A.applyPayment`/`addBankMock` |
| CashDeposit | `market` | data.js |
| CashConfirm | `market` | v-taichinh.js (`ds-cash-confirm`) |
| ServiceConfig record (stallPrices/utilities/extraServices) | `marketId` (tên khác!) | serviceconfig.js |
| Account | `marketScopes` (mảng, tên khác, ngữ nghĩa khác — "được phân công", không phải "thuộc về") | accounts.js |
| MeterReading | **không có field market riêng** — suy ra gián tiếp qua `stallId → Stall.market` | data.js |
| BillingPeriod / MeterPeriod | **không có market** — dùng chung cho cả 2 chợ | data.js |

### 6.3 Rủi ro / điểm cần lưu ý đã rà soát

- **`dien-nuoc` (Chỉ số điện, nước):** chợ TTD hoàn toàn không có đồng hồ (`hasMeter` luôn false cho mọi
  stall của TTD, xem `MARKETS` trong data.js) → khi chọn `ui.market = 'TTD'`, màn hình trả về thẳng
  `'<div class="empty">Chợ quê không có đồng hồ điện, nước riêng cho quầy.</div>'` (v-taichinh.js dòng 86).
  Đây là hành vi đúng theo dữ liệu, không phải lỗi filter.
- **`bao-cao` (Báo cáo):** đa số báo cáo dùng `U.inM`, nhưng báo cáo "Số thu theo nhân viên" hard-code
  `pays.filter(p => p.date.startsWith('2026-09'))` — không lọc qua `U.inM` một cách tường minh trước khi
  nhóm theo nhân viên, tuy nhiên vì `payments` chỉ liên kết 1 chợ/nhân viên (collectors theo market) nên
  trong dữ liệu mock hiện tại **không quan sát thấy trộn dữ liệu chợ thật sự xảy ra**, nhưng đây vẫn là điểm
  không nhất quán về mặt code (không filter tường minh theo `ui.market`) — xem mục 34.
- **`tai-khoan` (Tài khoản người dùng):** filter theo `f.market` (chọn trong bộ lọc riêng của màn này, ánh
  xạ tới `a.marketScopes`) — đây là **một filter khác, độc lập với `ui.market` ở topbar**. Nghĩa là đổi
  "Chợ" ở topbar **không** ảnh hưởng danh sách account hiển thị trong màn Tài khoản (đã đọc code xác nhận:
  `accRows()` trong `v-vanhanh.js` không gọi `U.inM`, chỉ dùng `f.market`).
- **Không phát hiện nơi nào có market-selector nhưng data không đổi** ngoài trường hợp `tai-khoan` nêu trên
  (đây là do **thiết kế cố ý dùng field lọc riêng**, không phải bug rõ ràng, nhưng gây bất nhất về trải
  nghiệm — xem mục 34, MEDIUM).

**Nguồn:** `js/core.js` (`U.inM`, `chrome()`, `A.ACT.market`), `js/v-vanhanh.js` (`accRows`), toàn bộ
`data.js`.

---

## 7. Full Functional Inventory (theo từng màn hình)

Ký hiệu phân loại (định nghĩa đầy đủ ở mục 24/25 và phần đầu task): **UI_ONLY**, **MOCK_WORKING**,
**WORKING_FE**, **PLACEHOLDER**, **TODO**, **DEAD/UNUSED**.

### 7.1 Tổng quan liên chợ (`tong-quan` — v-dieuhanh.js)

| Chức năng | Action / handler | Điều kiện hiện | Kết quả | Permission | Dữ liệu ảnh hưởng | Loại |
|---|---|---|---|---|---|---|
| Xem 8 KPI tổng hợp (điểm KD, tiểu thương, đã thu, không tiền mặt, nợ quá hạn, phản ánh, hợp đồng sắp hết hạn, cập nhật) | render (không có action) | luôn hiện | tính từ `marketStats()` | `screen:tong-quan` | Chỉ đọc | WORKING_FE |
| Biểu đồ số thu theo tháng | render | | SVG bar chart (`U.bars`) | như trên | Chỉ đọc | WORKING_FE |
| Donut trạng thái điểm KD | render | | | như trên | Chỉ đọc | WORKING_FE |
| Bảng so sánh 2 chợ | render | | `marketStats('CL')` vs `marketStats('TTD')` | như trên | Chỉ đọc | WORKING_FE |
| Danh sách cảnh báo cần xử lý (5 loại: hợp đồng sắp hết hạn, nợ >60 ngày, phản ánh trễ hạn, điện tăng bất thường, giao dịch NH chưa khớp) | click "Xem" → `data-act="go"` | chỉ hiện nếu số liệu >0 **và** `U.can(target)` | điều hướng sang màn liên quan | tuỳ đích đến | Chỉ đọc | WORKING_FE |
| Danh sách phản ánh vượt cấp | click "Mở" → `inc-open` | | mở modal chi tiết phản ánh | `screen:su-co` (ngầm định, không check ở đây) | Chỉ đọc | WORKING_FE |

### 7.2 Thiết lập mặt bằng chợ (`cau-truc` — v-cautruc.js)

Ghi chú bắt buộc (tự nhận trong code): module này **không** ghi/đọc `MARKETS`/`stalls` thật — toàn bộ là bản
quy hoạch nháp lưu ở `localStorage['choso-caolanh-layout']`.

| Chức năng chính | Chức năng phụ / Action | Permission | Validation | Dữ liệu ảnh hưởng | Loại |
|---|---|---|---|---|---|
| Quản lý cây Khối/Nhà chợ → Tầng → Khu | thêm/sửa/xoá khối (`qh-add-block*`, `qh-edit-block*`, `qh-del-block*`) | **Không có action permission** — chỉ `screen:cau-truc` | Xoá khối chỉ chặn nếu còn khu bên trong (không phải permission, là business rule) | `LAYOUT[mid].blocks` | MOCK_WORKING |
| | thêm/sửa/xoá tầng (`qh-add-floor*`, `qh-edit-floor*`, `qh-del-floor*`) | không | tương tự | như trên | MOCK_WORKING |
| | thêm/xoá khu (`qh-add-zone-save`, `qh-del-zone*`) | không | mã khu không trùng (`codeTaken`), không xoá khu còn "loại điểm" | như trên | MOCK_WORKING |
| Khai báo chi tiết 1 khu | sửa field (`qh-zone-field`) | không | không có validate tại chỗ (chỉ validate khi "Lưu và tiếp tục") | zone object | MOCK_WORKING |
| Quy hoạch loại điểm kinh doanh dự kiến trong khu | thêm/sửa/xoá dòng (`qh-pt-add`, `qh-pt-field`, `qh-pt-del`) | không | | zone.planned[] | MOCK_WORKING |
| Lưu nháp / Lưu chính thức | `qh-save-draft`, `qh-save-final` | không | `validateZone()`: bắt buộc mã/tên/khối-tầng/ngành hàng, diện tích >0, tổng diện tích loại điểm ≤ diện tích khu | zone.status | WORKING_FE (có validate thật) |
| Khôi phục cấu trúc mặc định | `qh-reset` → `qh-reset-ok` | không | modal xác nhận | Ghi đè toàn bộ `LAYOUT[mid]` | MOCK_WORKING |
| Sơ đồ trực quan quy hoạch | render `visualHtml` | — | | Chỉ đọc | WORKING_FE |

### 7.3 Sơ đồ mặt bằng (`so-do` — v-dieuhanh.js)

| Chức năng | Action | Permission | Kết quả | Dữ liệu | Loại |
|---|---|---|---|---|---|
| Chọn chợ/tầng, tìm theo mã điểm hoặc tên tiểu thương | `plan-market`, `plan-floor`, input `plan-search` | screen | lọc lưới ô | `ui.planMarket`, `ui.floor`, `ui.planSearch` | WORKING_FE |
| Bật/tắt hiển thị theo trạng thái (legend) | `legend` | screen | | `ui.hidden` | WORKING_FE |
| Chọn 1 ô → xem panel chi tiết (`A.stallPanel`, dùng chung với Điểm kinh doanh) | `stall` | screen | hiện hồ sơ tiểu thương/hợp đồng/công nợ | `ui.sel` | WORKING_FE |
| Xem hồ sơ tiểu thương từ panel | link `trader` | `so-do.xem-ho-so` | mở modal hồ sơ đầy đủ | Chỉ đọc | WORKING_FE |
| Tạo hợp đồng từ ô trống | `ct-new` (dùng chung với màn Hợp đồng) | `so-do.tao-hop-dong` | tạo Contract + gán Stall + Trader | `contracts`, `stalls`, `traders` | MOCK_WORKING |
| Đổi trạng thái điểm kinh doanh | `stall-status` → `stall-status-save` | `so-do.doi-trang-thai` | đổi status (`thue`/`ngung`/`tranhchap`/`trong`), ghi `st.history` | `stalls[].status/history` | MOCK_WORKING |
| Thu tiền trực tiếp từ panel | `pay-open` | `thu-tien.thu` | mở modal thu tiền dùng chung | `invoices`, `payments` | MOCK_WORKING |

### 7.4 Phiên chợ quê (`phien-cho` — v-dieuhanh.js)

| Chức năng | Action | Permission | Kết quả | Dữ liệu | Loại |
|---|---|---|---|---|---|
| Xem KPI phiên gần nhất, biểu đồ lượt khách, lịch sử phiên | render | screen | | Chỉ đọc | WORKING_FE |
| Điểm danh & chốt phiên 12/09/2026 (chỉ hiện nếu phiên này CHƯA có trong `sessions`) | `session-open` → `session-save` | `phien-cho.chot-phien` | Tạo 1 bản ghi `sessions` mới với số quầy có mặt, lượt khách, doanh thu tự khai | `A.db.sessions` | MOCK_WORKING — **nhưng KHÔNG tạo Invoice/Receivable nào** (xem mục 17 UI thể hiện luồng nhưng data chưa liên kết) |

### 7.5 Điểm kinh doanh (`diem-kd` — v-tieuthuong.js)

| Chức năng | Action | Permission | Dữ liệu | Loại |
|---|---|---|---|---|
| Danh mục điểm KD, lọc khu vực/trạng thái, tìm kiếm | `dk-section`, `dk-status`, input `dk-search` | screen | Chỉ đọc | WORKING_FE |
| Xuất Excel (CSV) | `dk-csv` | **không có action permission riêng** | tạo file CSV client-side | WORKING_FE (thật, dùng `Blob`+`URL.createObjectURL`, không phải giả) |
| Xem chi tiết 1 điểm (mở `A.stallPanel` trong modal) | `dk-open` | screen | Chỉ đọc | WORKING_FE |

### 7.6 Tiểu thương (`tieu-thuong` — v-tieuthuong.js)

| Chức năng | Action | Permission | Validation | Dữ liệu | Loại |
|---|---|---|---|---|---|
| Danh sách, lọc mini app, tìm kiếm | `tt-app`, input `tt-search` | screen | | Chỉ đọc | WORKING_FE |
| Xem hồ sơ đầy đủ (hợp đồng, khoản phải thu, biên lai gần đây) | `trader` | screen | | Chỉ đọc | WORKING_FE |
| Thêm tiểu thương (form thủ công) | `tt-new` → `tt-save` | `tieu-thuong.them-moi` | Bắt buộc họ tên/CCCD/điện thoại; **CCCD không được trùng** (`A.db.traders.some(t => t.idNo === idNo)`) | `A.db.traders` | WORKING_FE (validate thật + tạo bản ghi thật) |
| "Quét CCCD (OCR giả lập)" | `tt-ocr` | (nút hiện không kiểm tra permission riêng, nằm trong form đã được `tieu-thuong.them-moi` gate) | Điền sẵn 1 bộ dữ liệu mẫu cố định (`OCR_SAMPLE`) | không ghi gì tới khi bấm Lưu | **PLACEHOLDER** — không có OCR thật, luôn trả về đúng 1 bộ dữ liệu |
| Thu tiền từ hồ sơ tiểu thương | `pay-open` (trong modal `trader`) | `thu-tien.thu` **và** phải có công nợ (`U.traderDebt(t.id)`) | | `invoices`, `payments` | MOCK_WORKING |

### 7.7 Hợp đồng (`hop-dong` — v-tieuthuong.js)

| Chức năng | Action | Permission | Validation | Dữ liệu | Loại |
|---|---|---|---|---|---|
| 3 tab: Đang hiệu lực / Sắp hết hạn ≤30 ngày / Đã thanh lý, tìm kiếm | `hd-tab`, input `hd-search` | screen | | Chỉ đọc | WORKING_FE |
| Gia hạn hợp đồng | `ct-extend` → `ct-extend-save` | **KHÔNG có action permission** | không validate gì thêm (chọn 12/24/36 tháng) | `contracts[].end` | MOCK_WORKING |
| Thanh lý hợp đồng | `ct-end` → `ct-end-save` | **KHÔNG có action permission** | Nếu còn nợ, chỉ hiện **ghi chú cảnh báo**, **không chặn** thao tác thanh lý | `contracts[].status/end`, `stalls[].status/traderId/contractId`, `traders[].stalls` | MOCK_WORKING — có rủi ro nghiệp vụ (mục 34, HIGH) |
| Tạo hợp đồng thuê điểm kinh doanh | `ct-new` → `ct-new-save` | **KHÔNG có action permission** ở đây (dùng chung code với `so-do.tao-hop-dong` khi gọi từ Sơ đồ, nhưng khi gọi trực tiếp từ nút "+ Tạo hợp đồng" trên chính màn Hợp đồng thì **không có check nào**) | Chặn nếu hết điểm trống | `contracts`, `stalls`, `traders` | MOCK_WORKING |
