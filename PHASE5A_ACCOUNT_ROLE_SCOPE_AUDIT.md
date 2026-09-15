# PHASE 5A — AUDIT & DESIGN: Quản lý Tài khoản + Vai trò + Phạm vi chợ

> Báo cáo thuần audit + thiết kế. **Không có code nào bị sửa ở Phase 5A.** Mọi khẳng định trong
> báo cáo này đều dẫn trực tiếp file/function/dòng code cụ thể (đã đọc toàn bộ `js/accounts.js`,
> `js/permissions.js`, `js/core.js`, `js/v-vanhanh.js`, `index.html`; đối chiếu chéo với
> `js/v-dieuhanh.js`, `js/v-taichinh.js`, `js/v-tieuthuong.js`, `js/v-cautruc.js`,
> `js/serviceconfig.js`, `js/mini.js`, `data.js` bằng grep có mục tiêu để xác nhận không có nơi
> nào khác đọc các field liên quan). `node --check` đã chạy lại trên 3 file lõi
> (`accounts.js`, `permissions.js`, `core.js`) chỉ để xác nhận cú pháp hiện tại hợp lệ trước khi
> phân tích — không có thay đổi nào được ghi xuống đĩa.

---

## 1. Current architecture

Chuỗi kiến trúc RBAC V1 hiện tại (Phase 1–4, đã ACCEPTED), đúng như bối cảnh đề bài nêu, xác nhận
qua code:

```
Account (js/accounts.js)
  → roleIds[0] = vai trò hiệu lực     — A.ACCOUNTS.primaryRole()
  → marketScopes[]                     — A.allowedMarkets() (core.js:228-232)
  → status ('active' | 'disabled')     — A.currentAccount() tự "heal" (core.js:216-223)
      ↓
Role (js/permissions.js, STATE.roles)
  → screen permission  (STATE.rolePerms, permKey = 'screen:<id>')
  → action permission  (STATE.rolePerms, permKey = 'action:<id>')
      ↓
SelectedMarket (ui.market, core.js)
  → luôn ∈ A.allowedMarkets(currentAccount())  — ép buộc bởi A.syncAccountContext() (core.js:282-289)
      ↓
Business state (A.db, data.js) — lọc theo U.inM()/U.inScope() dùng ui.market / xmMarket()
```

Không có hệ thống phân quyền song song nào khác trong code. Không có `Organization`/
`ManagementUnit`. Đúng như đề bài: 2 chợ (CL, TTD) do cùng 1 Ban Quản lý, không có phân cấp tổ
chức riêng theo chợ ở bất kỳ đâu trong model hiện tại.

---

## 2. Current Account model

File: `js/accounts.js`.

Shape 1 account (seed, `defaultAccounts()` dòng 32-47 và các bản ghi bổ sung dòng 40-45):

```js
{
  id, code, fullName, phone,
  accountType,                 // 1 trong 5 giá trị ACCOUNT_TYPES (dòng 20)
  title,                       // chỉ có ở account tạo từ D.STAFF, KHÔNG bắt buộc
  roleIds: [roleId],           // MẢNG nhưng seed luôn đúng 1 phần tử
  organization,
  marketScopes: [ 'CL' | 'TTD' | 'ALL' ],   // MẢNG, hiện LUÔN đúng 1 phần tử trong seed
  status: 'active' | 'disabled'
}
```

- **Lưu trữ**: `localStorage['choso-caolanh-accounts']` (`AKEY`, dòng 17), gate bằng
  `localStorage['choso-caolanh-accounts-schema'] === String(A.RBAC_SCHEMA)` (dòng 54,
  `A.RBAC_SCHEMA` định nghĩa ở `core.js:13`, hiện = `2`). Sai hoặc thiếu schema → bỏ hẳn, seed lại
  từ `defaultAccounts()` (dòng 55-59).
- **CRUD**: `A.ACCOUNTS.add/update/setStatus` (dòng 83-85) — đều gọi `saveAccounts()` (ghi
  localStorage NGAY, đồng bộ, không có debounce/batch).
- **`primaryRole(account)`** (dòng 78): `return (account && account.roleIds && account.roleIds[0]) || null`.
  Đây là **điểm đọc role hiệu lực DUY NHẤT** trong toàn bộ codebase — xác nhận bằng grep
  `roleIds` (không có nơi nào khác đọc `roleIds[1]`, `roleIds.length`, hay lặp qua `roleIds`).
- **`resetDefault()`** (dòng 86) tồn tại nhưng **không được gọi ở bất kỳ đâu** trong code (xác
  nhận bằng grep `ACCOUNTS.resetDefault` trên toàn bộ `js/` → 0 kết quả). Xem mục 8, dòng
  "Reset demo data không đụng Account/Permission".

---

## 3. Current Role model

File: `js/permissions.js`, `defaultRoles()` (dòng 111-125).

```js
{
  id, name, desc,
  scope: 'all' | 'market' | 'self',
  market: null | 'CL' | 'TTD',   // chỉ có giá trị khi scope==='market'
  selfService: boolean,
  builtin: boolean,
  active: boolean
}
```

8 role builtin V1: `system_admin, ward_leader, market_manager, market_staff, accountant,
collector, technician, trader`. Tất cả role builtin hiện có `scope: 'all', market: null` **trừ**
`trader` (`scope: 'self', selfService: true`).

### `Role.scope` / `Role.market` — KHÔNG hoàn toàn chết (phát hiện quan trọng)

Comment tại `permissions.js:112-114` đã tự ghi rõ: *"`scope`/`market` ở đây CHỈ còn là metadata mô
tả mặc định... không có đoạn code nào đọc field này để chặn dữ liệu."* Grep xác nhận đúng **một
phần**:

| Field | Nơi đọc | Có ảnh hưởng runtime thật không? |
|---|---|---|
| `role.scope === 'all' \| 'market'` | `scopeLabel()` (`v-vanhanh.js:387-389`) | **KHÔNG** — chỉ build chuỗi hiển thị cột "Phạm vi dữ liệu" |
| `role.market` | `scopeLabel()` (`v-vanhanh.js:388`) | **KHÔNG** — chỉ hiển thị |
| `role.scope === 'market'` (điều kiện hiện field) | `renderRoleForm()` (`v-vanhanh.js:420`) | Chỉ ảnh hưởng UI form, không phải authorization |
| `role.scope === 'self'` | `role-form-save` (`v-vanhanh.js:888`): `selfService: d.scope === 'self'` | **CÓ** — đây là cách DUY NHẤT UI hiện tại gán `selfService: true` cho 1 role |
| `role.selfService` | `A.route()` (`core.js:499-500`), `A.ACT['demo-account']` (`core.js:540-541`) | **CÓ** — tự động điều hướng thẳng vào `mini-app` khi đổi account/khi route fallback |

Kết luận: `Role.scope`/`Role.market` **không phải** authorization source cho market/data access
(đúng như nguyên tắc kiến trúc đã chốt) — nhưng field `scope` hiện đang **kiêm nhiệm 2 việc khác
nhau về bản chất**:
1. Text mô tả "Phạm vi dữ liệu" (`all`/`market`) — thuần cosmetic, KHÔNG có tác dụng.
2. Cờ hành vi điều hướng tự phục vụ (`self` → `selfService`) — CÓ tác dụng runtime thật.

Đây là nguồn gây hiểu nhầm chính (xem mục 7 đề bài) — không chỉ là "hiển thị sai", mà là **một
control hợp lệ (self-service routing) đang bị trộn chung UI với một field vô tác dụng (scope
all/market)**.

### Screen Permission & Action Permission

`defaultRolePermissions()` (`permissions.js:140-221`) sinh `STATE.rolePerms`: mảng phẳng
`{roleId, permKey, grantedAt, grantedBy}`, `permKey` dạng `'screen:<id>'` hoặc `'action:<id>'`.
Đọc qua `A.PERM.canScreen`/`A.PERM.canAction`/`A.PERM.hasPerm` (dòng 293-296). Ghi qua
`A.PERM.grant`/`A.PERM.revoke` (dòng 308-317) — **không có** ràng buộc field `scope`/`market` nào
trong các hàm này; hoàn toàn độc lập với Role.scope.

- **Lưu trữ**: `localStorage['choso-caolanh-permissions']` (`PKEY`, dòng 25). Gate kép:
  `x.schemaVersion === A.RBAC_SCHEMA` (=2) **VÀ** `x.seedVersion === PERM_SEED_VERSION` (=3, dòng
  245). Lệch 1 trong 2 → reseed toàn bộ (`freshState()`, dòng 246, 260-271) — xem phân tích chi
  tiết migration ở mục 12.
- **CRUD Role**: `addRole/updateRole/setRoleActive/removeRole` (dòng 298-307). `removeRole` chặn
  cứng nếu `role.builtin` (dòng 303) — bảo vệ 8 role gốc, đã kiểm chứng lại ở Phase 4B testing.

---

## 4. Current marketScopes behavior

- **Nguồn chuẩn hoá duy nhất**: `A.allowedMarkets(account)` (`core.js:228-232`):
  `marketScopes.indexOf('ALL') !== -1` → `['CL','TTD']`; ngược lại
  `marketScopes.filter(m => m==='CL'||m==='TTD')`.
- **Không có nơi nào khác** trong `js/*.js` tự ý diễn giải `'ALL'` thành 2 chợ cụ thể (đã grep
  `marketScopes` toàn bộ `js/`) — đúng như comment tại `core.js:224-227` khẳng định.
- `'ALL'` **hợp lệ về mặt schema hiện tại** (không có validation nào chặn), nhưng theo đúng yêu
  cầu domain ở đề bài, đây là kiểu dữ liệu cần loại bỏ dần khỏi cách LƯU (Account nên lưu
  `['CL','TTD']` tường minh) — `A.allowedMarkets()` xử lý cả hai dạng **cho ra kết quả runtime
  giống hệt nhau**, nên đổi cách lưu là thay đổi an toàn, không phá vỡ hàm tiêu thụ.
- `marketScopes: []` (mảng rỗng) → `A.allowedMarkets()` trả về `[]` → `A.syncAccountContext()`
  (`core.js:282-289`) rơi vào nhánh `else if (!ui.market) ui.market = 'CL'` (dòng 287, tự nhận là
  "phòng thủ tối đa, không kỳ vọng xảy ra với seed hiện tại") — nghĩa là code **có** một fallback
  cứng `'CL'` cho trường hợp này nhưng **không có validation nào ngăn UI tạo ra** account với
  `marketScopes: []` ở màn Tài khoản hiện tại (vì `af-scope` luôn có 1 giá trị được chọn — xem mục
  6). Đây là rủi ro tiềm ẩn nếu Phase 5B đổi sang checkbox mà không validate "phải chọn ít nhất 1".

---

## 5. Current selectedMarket behavior

`ui.market` (global) — bất biến bắt buộc: **luôn** là `'CL'` hoặc `'TTD'` cụ thể, không bao giờ
`'ALL'` kể từ Phase 2 (bump `RBAC_SCHEMA` 1→2, comment `core.js:9-12`).

Điểm ép buộc: `A.syncAccountContext()` (`core.js:282-289`), được gọi tại:
- `A.load()` cuối cùng (dòng 318) — khi khởi động app.
- `chrome()` đầu hàm (dòng 431) — mỗi lần render.
- `A.route()` đầu hàm (dòng 489) — mỗi lần định tuyến (hashchange, gọi tay).
- `A.ACT['demo-account']` (dòng 538) — ngay sau khi đổi account.

Logic: nếu `ui.market` hiện tại **không** nằm trong `A.allowedMarkets(currentAccount())` →
`ui.market = allowed[0]`. 3 case tại mục 12 đề bài (market='ALL' cũ, market không tồn tại, market
hợp lệ nhưng ngoài scope account) đều rơi vào đúng nhánh này — đã verify sống trong Phase 2/3/4B
testing (đổi account có `marketScopes` khác nhau, `ui.market` tự kẹp lại đúng).

Global market selector (`#market-seg`, `chrome()` dòng 452-453) chỉ render nút cho
`A.allowedMarkets(currentAccount())` — account 1-market chỉ thấy 1 nút (luôn "on"); không còn
`'ALL'` xuất hiện ở đây từ Phase 2.

`A.ACT.market` (`core.js:547-551`) — đổi `ui.market`, có phòng thủ
`if (A.allowedMarkets(...).indexOf(id) === -1) return;` trước khi set, rồi gọi `A.route()` (không
phải `A.render()`) để re-validate route hiện tại ngay.

---

## 6. Current Account Management UI

Toàn bộ tại `js/v-vanhanh.js`, khối "Tài khoản người dùng" (dòng 211-369, sau các sửa Phase 4B).

| Chức năng | Handler / hàm | Ghi chú |
|---|---|---|
| Danh sách + filter/search | `A.VIEWS['tai-khoan']` (283-321), `accRows()` (224-232) | Filter theo `market` dùng `(a.marketScopes||[]).includes(f.market)` — cùng vấn đề 'ALL' như form |
| Xem chi tiết (drawer) | `acc-open` → `accDrawerHtml()` (241-263) | Hiển thị `accScopeLabel()` (216-220): nếu có `'ALL'` → "Toàn hệ thống", ngược lại join tên chợ — **hàm này ĐÃ sẵn sàng cho multi-market** (nếu `marketScopes=['CL','TTD']` thì tự in "Chợ Cao Lãnh, Chợ quê TTĐ"), chỉ FORM chưa cho tạo ra giá trị đó |
| Tạo mới | `acc-new` (333-337) | Gate `A.canDo('tai-khoan.tao-moi')`; khởi tạo `marketScopes: ['ALL']` mặc định |
| Sửa | `acc-edit` (338-344) | Gate `A.canDo('tai-khoan.sua')` |
| Gán Role / MarketScopes trong form | `renderAccForm()` (264-281), field `af-role` (**select đơn**, dòng 273) + `af-scope` (**select đơn**, dòng 275) | Cả hai field disabled nếu `!canAssign` (`isNew \|\| A.canDo('tai-khoan.gan-quyen')`) |
| **BUG/GAP đã biết — `af-scope`** | `<select data-ch="af-scope">` (275): `<option value="ALL">Toàn hệ thống</option>` + 1 option/chợ | **Single-select** — không thể chọn đồng thời CL+TTD. Handler `A.CH['af-scope'] = el => { ui.accForm.marketScopes = [el.value]; }` (351) **luôn ghi đè thành mảng 1 phần tử** |
| Lưu | `acc-form-save` (353-370) | Gate kép: quyền tạo/sửa (355) + quyền gán (356, dùng để khoá `roleIds`/`marketScopes` về giá trị account cũ nếu không đủ quyền — đã làm đúng ở Phase 4B) |
| Khoá/mở khoá | `acc-toggle` (đã đọc Phase 4B) | Gate `A.canDo('tai-khoan.khoa-mo-khoa')` |
| Account selector demo (topbar) | `chrome()` `#role-seg` (`core.js:444-445`) | Chỉ liệt kê account `status==='active'` |
| selectedMarket sau khi đổi account | `A.ACT['demo-account']` (`core.js:528-542`) | Gọi `A.syncAccountContext()` — giữ nguyên `ui.market` nếu còn hợp lệ, ngược lại nhảy `allowedMarkets[0]` |
| Validation account không có market scope hợp lệ | **Không có validation tường minh ở form** — chỉ có fallback runtime `core.js:287` (mục 4) | Vì `af-scope` luôn có 1 giá trị nên trong thực tế không thể tạo ra `marketScopes: []` qua UI hiện tại; đây là validation **cần thêm mới**, không phải sửa cái đang có |

Filter "Chợ / phạm vi" trên danh sách (dòng 305) cũng có `<option value="ALL">Toàn hệ thống</option>`
— cùng bản chất vấn đề, nhưng ở đây `'ALL'` chỉ là 1 lựa chọn filter phía client (không ghi xuống
data), rủi ro thấp hơn field trong form.

---

## 7. Current Role & Permission UI

Tại `js/v-vanhanh.js`, khối "Cài đặt" → tab `vaitro` (`settingsVaitroHtml()`, dòng 810-826) +
`permsMatrixHtml()` (395-410) + `renderRoleForm()` (411-424).

| Chức năng | Handler / hàm | Ghi chú |
|---|---|---|
| Danh sách Role | `settingsVaitroHtml()` (810-826), cột: Vai trò / Mô tả / **Phạm vi dữ liệu** / Trạng thái / (thao tác) | Cột "Phạm vi dữ liệu" = `scopeLabel(r)` — xem mục 3, đây chính là điểm gây hiểu nhầm nêu ở mục 7 đề bài |
| Tạo Role | `role-new` (866) → `renderRoleForm()` | Gate `A.canDo('cai-dat.vai-tro.tao')` |
| Sửa Role | `role-edit` (869-873) | Gate `A.canDo('cai-dat.vai-tro.sua')` |
| Form Role | `renderRoleForm()` (411-424): Tên, **Phạm vi dữ liệu** (select `all/market/self`), Chợ (chỉ hiện nếu `scope==='market'`), Mô tả | Không có field bật/tắt `selfService` độc lập — hoàn toàn phụ thuộc lựa chọn `scope==='self'` |
| Vô hiệu hoá/kích hoạt Role | `role-toggle` (881-890) | Gate `A.canDo('cai-dat.vai-tro.khoa')`; giữ nguyên bảo vệ "role đang dùng" (`r.id === ui.role`) |
| Xoá Role | `role-del`/`role-del-ok` (892-906) | Gate `A.canDo('cai-dat.vai-tro.xoa')`; giữ nguyên bảo vệ builtin + role đang dùng |
| Chọn Role để xem chi tiết quyền | `role-perm` (891): `ui.permRole = el.dataset.id` | Điều hướng nội bộ, không phải authorization |
| Screen Permission | `permsMatrixHtml()` (395-410), nhóm theo `p.group` (Điều hành/Tài chính/...), **KHÔNG tách UI riêng khỏi Action Permission** | Mọi `CATALOG` entry (cả `kind:'screen'` lẫn `kind:'action'`) render chung 1 danh sách checkbox theo `group`, phân biệt duy nhất bằng cái tag nhỏ `<span class="tag">${A.menuItem(p.screenId).label}</span>` nếu `p.kind==='action'` — không có heading "Quyền màn hình" / "Quyền thao tác" tách biệt |
| Checkbox permission | `perm-toggle` (`A.CH`, 832-844) | Gate `cai-dat.phan-quyen` (Phase 4B, `permsMatrixHtml` dòng 397 disable checkbox nếu thiếu quyền) |
| Permission group | `group` field trong `CATALOG` (permissions.js) — hiện dùng đúng tên nhóm màn hình (Điều hành/Tiểu thương & hợp đồng/Tài chính/Vận hành), KHÔNG phải nhóm theo "screen cha" | Ví dụ: mọi action của `hop-dong`, `tieu-thuong`, `diem-kd` gộp chung nhóm "Tiểu thương & hợp đồng" — đúng ý đồ ban đầu nhưng KHÔNG tách theo từng màn cụ thể như ví dụ minh hoạ ở mục 6 đề bài ("Hợp đồng" / "Điện nước" là 2 khối riêng) |
| Role builtin | `r.builtin` — chặn xoá (`removeRole`, `permissions.js:303`), chặn nút "Xoá" ở UI (`!r.builtin` mới hiện nút, dòng 823) | Đã đúng, không đổi |
| Self protection | `role-toggle`/`role-del` chặn nếu `r.id === ui.role` (đang dùng); `perm-toggle` bắt buộc re-check `cai-dat.phan-quyen` trước khi `grant/revoke` (Phase 4B) | Đã verify sống ở Phase 4B testing, giữ nguyên |
| Permission migration | Xem mục 12 | |

---

## 8. Problems / Inconsistencies found

### BLOCKER
*Không phát hiện BLOCKER nào ảnh hưởng trực tiếp kiến trúc Phase 1–4.* Toàn bộ vấn đề tìm được là
UI/data-representation, có thể sửa trong Phase 5B mà không đổi chuỗi
`Account→Role→Screen→Action→marketScopes→selectedMarket→Business state`.

### PHASE5B_FIX

1. **`af-scope` là single-select, không thể lưu `['CL','TTD']`** (`v-vanhanh.js:275,351`). Đây là
   vấn đề trọng tâm của toàn bộ Phase 5. Không có cách nào qua UI hiện tại để tạo account có
   `marketScopes.length > 1` — dù model/`A.allowedMarkets()` hoàn toàn hỗ trợ.
2. **`'ALL'` được biểu diễn như 1 market ID thật** ở cả `af-scope` (275) và filter `acc-market`
   (305) — vi phạm đúng nguyên tắc đề bài mục 4 ("KHÔNG hiển thị lựa chọn 'Tất cả chợ' như một
   market ID thực").
3. **Cột "Phạm vi dữ liệu" trong bảng Role** (`v-vanhanh.js:822`, `scopeLabel()`) hiển thị
   "Tất cả chợ" / "Chợ CL" cho **Role**, trong khi phạm vi chợ thật sự nằm ở **Account**. Gây hiểu
   nhầm trực tiếp đúng như mục 7 đề bài mô tả.
4. **Screen Permission và Action Permission không tách UI** (`permsMatrixHtml()`) — gộp chung 1
   danh sách checkbox theo `group` màn hình lớn, không có 2 khối rõ ràng "Quyền màn hình" /
   "Quyền thao tác trong từng màn" như mục 6 đề bài yêu cầu.
5. **`Role.scope`/`Role.market` field dùng chung UI cho 2 mục đích khác bản chất** (cosmetic
   "Phạm vi dữ liệu" vs. hành vi thật `selfService`) — xem phân tích mục 3. Cần tách: 1 field mô tả
   thuần cosmetic (có thể bỏ hẳn) + 1 checkbox riêng, đặt tên đúng bản chất, cho `selfService`.
6. **`A.ACCOUNTS.resetDefault()` và `A.PERM.resetDefault()` tồn tại nhưng không được gọi ở đâu**
   (grep xác nhận). Nút "Đặt lại dữ liệu mẫu" (`cai-dat.reset-demo` → `A.ACT['reset-ok']` →
   `A.resetAll()`, `core.js:590-594`) **chỉ xoá `localStorage['choso-caolanh-state']`** (business
   mock data) — **KHÔNG đụng Account, KHÔNG đụng Permission**. Nhãn "Đặt lại dữ liệu mẫu" có thể
   khiến admin hiểu nhầm là mọi thứ (kể cả account/role tự tạo) sẽ về mặc định. Hành vi hiện tại
   thực ra là ĐÚNG theo tinh thần "không được xoá account tự tạo khi reset demo nghiệp vụ", nhưng
   **chưa được ghi chú/label rõ trong UI** — cần quyết định (xem NEED_CONFIRMATION #1).
7. **Filter "Chợ / phạm vi" trên danh sách tài khoản** (dòng 305) dùng `includes(f.market)` với
   `f.market==='ALL'` — sẽ không khớp account có `marketScopes:['CL','TTD']` (chỉ khớp account có
   đúng chuỗi `'ALL'` trong mảng). Nếu Phase 5B đổi sang lưu `['CL','TTD']` tường minh, filter này
   PHẢI đổi logic tương ứng (không thể giữ nguyên).

### NEED_CONFIRMATION
Xem mục 16 (gộp chung, không lặp lại ở đây).

---

## 9. Exact Phase 5B UI design

### 9.1 Màn "Tài khoản người dùng" — form Tạo/Sửa tài khoản

Thay field `af-scope` (select đơn) bằng nhóm checkbox, đúng theo mẫu đề bài:

```
Phạm vi chợ được phân công:
[ ] Chợ Cao Lãnh
[ ] Chợ quê Tân Thuận Đông
```

- 2 checkbox độc lập (`data-ch="af-scope-cl"`, `data-ch="af-scope-ttd"`), không còn option "Toàn
  hệ thống"/`ALL` trong DOM.
- Handler đổi thành: mỗi lần tick/bỏ tick → build lại `ui.accForm.marketScopes` từ set các
  checkbox đang được chọn (`['CL']`, `['TTD']`, hoặc `['CL','TTD']`).
- Cả 2 checkbox đều `disabled` khi `!canAssign` (giữ nguyên logic gate hiện có, chỉ đổi loại input).
- Validate tại `acc-form-save`: nếu cả 2 đều không tick → chặn lưu, toast "Vui lòng chọn ít nhất 1
  chợ được phân công" (áp dụng cho account có role cần market context — xem mục 11 về ngoại lệ).
- `accScopeLabel()` (216-220, hiển thị) **giữ nguyên logic join** — chỉ cần đổi nhánh `'ALL'` ⇒
  không còn xảy ra trong dữ liệu mới, nhưng nên **giữ nhánh này lại như tương thích ngược** cho
  account cũ còn `marketScopes:['ALL']` trong localStorage của trình duyệt admin hiện tại (xem mục
  10 — không ép migrate cưỡng bức).

### 9.2 Filter "Chợ / phạm vi" trên danh sách tài khoản

Đổi từ 1 dropdown (All/CL/TTD) hiện tại sang lọc theo "chợ có trong `marketScopes`" (không cần
phân biệt account 1-chợ hay 2-chợ) — dropdown giữ nguyên 2 lựa chọn CL/TTD, bỏ option "Toàn hệ
thống"; logic filter đổi thành so khớp trực tiếp `includes('CL')`/`includes('TTD')` (hoạt động
đúng với cả `marketScopes` cũ `['ALL']` **nếu** giữ tương thích ngược đọc — xem mục 10) hoặc mới
`['CL','TTD']`.

### 9.3 Màn "Vai trò & phân quyền" — bảng danh sách Role

Đổi cột hiện tại:

```
Vai trò | Mô tả | Phạm vi dữ liệu | Trạng thái | Thao tác
```

thành (theo đúng gợi ý ưu tiên ở mục 7 đề bài):

```
Vai trò | Mô tả | Số quyền | Trạng thái | Thao tác
```

- "Số quyền" = đếm nhanh `A.PERM.rolePermKeys(r.id).length`, hoặc tách 2 số "X màn hình · Y hành
  động" (đếm riêng theo `permKey.startsWith('screen:')`/`'action:'`) — ưu tiên phương án tách 2 số
  vì phù hợp trực tiếp với việc mục 9.4 bên dưới tách UI Screen/Action.
- Bỏ hẳn cột "Phạm vi dữ liệu"/`scopeLabel()` khỏi bảng danh sách Role.

### 9.4 Form Tạo/Sửa Role

Bỏ dropdown "Phạm vi dữ liệu" (`all`/`market`/`self`) + field "Chợ" phụ thuộc. Thay bằng:
- Tên vai trò *, Mô tả — giữ nguyên.
- **1 checkbox riêng, tên đúng bản chất**: `☐ Vai trò tự phục vụ (tự động vào Mini app tiểu
  thương khi chọn tài khoản có vai trò này)` — set thẳng `selfService: boolean`, không còn đi qua
  field `scope` trung gian.
- Field `market` (single chợ) trên Role **bỏ hẳn khỏi form** — không còn ý nghĩa gì sau khi tách
  (Account.marketScopes đã là nguồn duy nhất).
- `role.scope` **vẫn có thể giữ trong data model** thuần làm metadata lịch sử/tương thích (xem
  mục 10), nhưng **không còn field nào trong form ghi giá trị `'all'`/`'market'` nữa** — khi lưu,
  Phase 5B ghi `scope: d.selfService ? 'self' : 'all'` (giữ đúng 2 giá trị còn ý nghĩa, bỏ hẳn
  nhánh `'market'`) để không phá schema các nơi khác còn đọc `role.scope` (hiện chỉ còn
  `scopeLabel()` — nếu mục 9.3 đã bỏ cột này thì `scopeLabel()` có thể xoá theo, xem mục 13).

### 9.5 Khối Phân quyền chi tiết theo Role — tách Screen Permission / Action Permission

Giữ nguyên cơ chế `permsMatrixHtml(role)` (group theo `CATALOG[].group`) nhưng thêm 1 lớp phân
tách hiển thị **trước khi** group theo `group`:

```
QUYỀN MÀN HÌNH (screen)
  ☑ Điểm kinh doanh
  ☑ Tiểu thương
  ☑ Hợp đồng
  ...

QUYỀN THAO TÁC (action) — nhóm theo từng màn
  Hợp đồng
    ☑ Tạo hợp đồng
    ☑ Gia hạn
    ☐ Thanh lý
  Điện nước
    ☑ Ghi chỉ số
    ☐ Chốt kỳ
    ☑ Yêu cầu điều chỉnh
  ...
```

- Tách bằng `p.kind` (`'screen'` vs `'action'`) — dữ liệu đã có sẵn, không cần đổi `CATALOG`.
- Trong khối "QUYỀN THAO TÁC", nhóm phụ theo `p.screenId` (đã có sẵn trong `CATALOG`, dùng
  `A.menuItem(p.screenId).label` làm tiêu đề nhóm phụ — logic này ĐÃ tồn tại một phần, hiện chỉ
  dùng làm cái tag nhỏ, nay nâng thành heading nhóm phụ).
- Không đổi `permKey`, không đổi cách `grant/revoke` — thuần thay đổi cách RENDER.

---

## 10. Exact Phase 5B data behavior

1. **Account.marketScopes**: form ghi thẳng mảng con của `['CL','TTD']` theo checkbox — không bao
   giờ ghi `'ALL'` từ Phase 5B trở đi. **Không migrate cưỡng bức** các account cũ đã có
   `marketScopes:['ALL']` trong localStorage hiện tại của trình duyệt admin — `A.allowedMarkets()`
   đã xử lý đúng cả 2 dạng nên không có rủi ro runtime; khi admin MỞ SỬA 1 account như vậy trong
   form mới, checkbox tự hiển thị cả CL+TTD được tick sẵn (derive từ `A.allowedMarkets(account)`
   tại thời điểm mở form, không đọc thẳng `marketScopes` raw) và LẦN LƯU TIẾP THEO sẽ tự động ghi
   lại thành `['CL','TTD']` tường minh — tức là **tự làm sạch dữ liệu dần theo thao tác thật của
   admin**, không cần script migrate riêng.
2. **`Role.selfService`**: ghi trực tiếp từ checkbox mới (mục 9.4), không còn qua `scope`.
3. **`Role.scope`**: chỉ còn 2 giá trị được ghi mới (`'all'` | `'self'`); giá trị `'market'` cũ
   (nếu admin nào đã từng tạo role với scope này) vẫn đọc được (không có gì đọc field `market` cũ
   để chặn) nhưng nếu role đó được mở sửa bằng form mới, sẽ bị ghi lại về `'all'` (vì mất trường
   input tương ứng) — **cần nêu rõ với người dùng** đây là hành vi chấp nhận được (role thật sự
   dùng `scope:'market'` để hạn chế data theo 1 chợ **chưa từng có hiệu lực runtime**, nên mất đi
   không đổi bất kỳ hành vi nghiệp vụ nào).
4. **Screen/Action permission**: không đổi shape `rolePerms`, không đổi `permKey`, không đổi seed
   version chỉ vì lý do UI — chỉ bump `PERM_SEED_VERSION` nếu **catalog thật sự đổi** (thêm/bớt
   permission key), không bump vì đổi cách hiển thị.
5. **selectedMarket**: không đổi hành vi `A.syncAccountContext()`; chỉ hưởng lợi gián tiếp từ việc
   `marketScopes` giờ tường minh hơn (không còn phụ thuộc suy luận `'ALL'` cho account mới tạo).

---

## 11. Validation rules

Đề xuất cho Phase 5B (áp dụng ở `acc-form-save`, trước khi gọi `A.ACCOUNTS.add/update`):

1. **`marketScopes` không được rỗng** cho account có role thuộc nhóm cần market context. Cụ thể
   hoá theo dữ liệu hiện tại:
   - Role có ít nhất 1 screen permission với `A.SCREEN_MARKET[screenId]` ∈ `{'CL','TTD','BOTH'}`
     (tức không phải toàn bộ đều `'CROSS'`/`'SYSTEM'`) → **bắt buộc** ≥ 1 market được tick.
   - `system_admin`: toàn bộ screen permission của role này (`tong-quan`+`bao-cao`=CROSS,
     `tai-khoan`+`cai-dat`=SYSTEM) đều KHÔNG cần `ui.market` cụ thể — **nhưng** `tong-quan`/
     `bao-cao` vẫn đọc `A.allowedMarkets()` để dựng `A.xmScopeBar()` (mục 4/12 đề bài, xem
     `core.js:263-267,271-277`), nên **vẫn nên** giữ đủ 2 chợ được tick cho account admin (để bộ
     lọc nội bộ "Tất cả/CL/TTD" ở Tổng quan/Báo cáo hoạt động đúng ý), dù không phải "bắt buộc kỹ
     thuật" theo nghĩa route sẽ lỗi nếu thiếu. → xem NEED_CONFIRMATION #2.
   - `ward_leader`: có nhiều screen `BOTH` thật (so-do, diem-kd, tieu-thuong, hop-dong, phai-thu,
     doi-soat, cong-no, su-co — xem mục 3 phần Screen Permission) → **bắt buộc** đủ `['CL','TTD']`
     để dùng được các màn đó ở cả 2 chợ, đúng tinh thần "giám sát liên chợ". Không tick đủ vẫn
     KHÔNG lỗi runtime (chỉ tự giới hạn `ui.market` xuống 1 chợ có tick) nhưng lệch mục đích role.
   - `trader`: luôn đúng 1 chợ (gắn với 1 điểm kinh doanh cụ thể) — form Tài khoản hiện tại (và cả
     Phase 5B) áp dụng chung 1 UI cho mọi `accountType`; cần quyết định có giới hạn "chỉ được tick
     1 chợ" khi `accountType==='Tiểu thương'`/`roleIds` chứa `trader` hay không → xem
     NEED_CONFIRMATION #3.
2. **Giá trị market hợp lệ**: chỉ `'CL'`/`'TTD'` được phép nằm trong `marketScopes` sau khi lưu
   (checkbox tự đảm bảo, không cần validate thêm phía JS ngoài việc build đúng mảng từ 2
   checkbox cố định).
3. **Không lưu `'ALL'`** từ Phase 5B trở đi (đã nêu ở mục 10) — validate bằng cách đơn giản: mảng
   build ra từ checkbox không bao giờ có giá trị nào khác `'CL'`/`'TTD'`, nên không cần chặn riêng.
4. **Account đang là `currentDemoAccountId`**: nếu admin sửa account đang đăng nhập (chính họ) và
   bỏ tick chợ đang chọn làm `ui.market` → không cần validate riêng, vì `A.syncAccountContext()`
   (gọi lại ở lần render/route kế tiếp) tự kẹp `ui.market` về market còn lại hợp lệ — hành vi đã
   đúng, không cần thêm rule.
5. **roleIds rỗng**: hiện tại `af-role` cho phép chọn "— Chưa gán —" (`v-vanhanh.js:273`,
   `option value=""`) → `roleIds:[]`. `A.ACCOUNTS.primaryRole()` trả `null` cho trường hợp này,
   `A.PERM.role(null)` trả `undefined`, và nhiều nơi (`U.can`, `chrome()` dòng 446-448) đã có check
   `!role`/`role &&` nên **không crash** — nhưng account như vậy sẽ không vào được màn hình nào
   (`U.can` luôn `false` vì `!role`). Đây là hành vi **đã đúng về mặt an toàn** (không cấp gì =
   không vào được gì), giữ nguyên, không cần thêm validate chặn (có thể cố ý dùng để "tạo tài
   khoản trước, gán vai trò sau").

---

## 12. Permission migration strategy

### Hiện trạng chính xác (đã đọc kỹ `loadState()`, `permissions.js:247-278`)

Code hiện tại **đã có sẵn 2 nhánh khác nhau**, không phải chỉ 1 kiểu "reseed toàn bộ" như mô tả
tổng quát ở đề bài — cần ghi nhận chính xác trước khi đề xuất:

- **Nhánh A — version KHỚP** (`x.schemaVersion===RBAC_SCHEMA && x.seedVersion===PERM_SEED_VERSION`,
  dòng 257): dùng thẳng `x`, sau đó **tự bổ sung permission key mới** chưa từng có trong
  `rolePerms` đã lưu (dòng 272-276): `known = Set(existing permKey)`, với mỗi dòng trong
  `defaultRolePermissions()` mà `permKey` chưa nằm trong `known` → push thêm. **Đây chính xác là
  phần lớn giải pháp mà mục 10 đề bài yêu cầu thiết kế — đã tồn tại nhưng CHỈ chạy khi
  `seedVersion` không đổi.**
- **Nhánh B — version LỆCH** (dòng 260-271): bỏ hẳn toàn bộ `rolePerms` đã lưu (kể cả các
  grant/revoke tuỳ biến của admin cho các permKey **vẫn còn tồn tại** ở seed mới), ghi đè bằng
  `freshState()` — persist ngay lập tức xuống `localStorage` (dòng 269, đúng theo Phase 3 hotfix
  pattern).

Vấn đề: **mọi lần đổi `actionRoles`/`screenRoles`/`CATALOG` (dù chỉ thêm 1 dòng) đều buộc phải bump
`PERM_SEED_VERSION`** theo quy ước hiện tại (comment dòng 235-244) — và bump này luôn kích hoạt
Nhánh B (full reseed), xoá sạch mọi tuỳ biến admin đã làm cho **toàn bộ** ma trận, kể cả các
permKey không hề thay đổi. Đã verify sống điều này trong Phase 4B report (mục 7): seed v2→v3 xoá
đúng 1 permKey tuỳ biến giả lập, khớp với thiết kế hiện tại.

### Đề xuất cho migration TƯƠNG LAI (chỉ thiết kế, không implement ở Phase 5A)

Thay 2-nhánh-theo-version bằng **1 hàm merge 3 chiều** chạy mỗi lần load, bất kể `seedVersion` có
đổi hay không:

1. Đọc `stored.rolePerms` (nếu có; nếu hoàn toàn không có dữ liệu cũ → dùng thẳng
   `defaultRolePermissions()`, không có gì để merge).
2. Tính `defaultKeys = Set(permKey trong defaultRolePermissions() hiện tại)` và
   `storedKeys = Set(permKey trong stored.rolePerms)`.
3. **Permission key MỚI** (`defaultKeys - storedKeys`, key hoàn toàn chưa từng tồn tại ở lần lưu
   trước): thêm default grant y như `defaultRolePermissions()` sinh ra — **giữ nguyên logic đang
   có ở Nhánh A** (dòng 272-276), áp dụng luôn cho case version lệch thay vì chỉ case version
   khớp.
4. **Permission key ĐÃ CÓ TỪ TRƯỚC** (`defaultKeys ∩ storedKeys`): **giữ nguyên state đã lưu**
   (custom grant/revoke của admin), **không ghi đè** về default dù seed mới có danh sách role mặc
   định khác cho key đó. (Nếu 1 bản seed mới thật sự cần ÉP LẠI 1 permission cụ thể vì lý do bảo
   mật — ví dụ hành vi giống Phase 4B mục 10 sửa `tai-khoan.*` từ `market_manager` về
   `system_admin` chỉ — thì đây phải là 1 thao tác migration TƯỜNG MINH, có danh sách permKey cụ
   thể cần ép lại, không phải hệ quả ngầm của việc bump version.)
5. **Permission key BỊ XOÁ khỏi catalog** (`storedKeys - defaultKeys`, hiếm khi xảy ra — chỉ khi 1
   action/screen bị gỡ khỏi app thật sự): lọc bỏ khỏi `rolePerms` khi merge (tránh rác vĩnh viễn),
   không cần xử lý gì thêm vì `permission(key)` sẽ trả `undefined` và các UI dựa vào `CATALOG` để
   liệt kê nên tự động không hiển thị.
6. **Role mới thêm ở seed sau** (`defaultRoles()` có id role mà `stored.roles` chưa có): thêm role
   đó (kèm default permission theo bước 3) — role đã có sẵn trong `stored.roles` thì **giữ nguyên
   fields đã lưu** (kể cả `active`, `name`, `desc` nếu admin đã sửa), chỉ merge phần permission.
7. **Điều kiện KHÔNG áp dụng nhánh này**: nếu `stored.schemaVersion !== A.RBAC_SCHEMA` (đổi
   *shape* dữ liệu, không phải đổi *nội dung* ma trận) — giữ nguyên hành vi reseed toàn bộ hiện
   tại (Nhánh B), vì đây là thay đổi cấu trúc thật sự không thể merge an toàn. Điều này giữ đúng lý
   do `A.RBAC_SCHEMA` và `PERM_SEED_VERSION` đang tách biệt (comment `permissions.js:235-240`):
   `RBAC_SCHEMA` cho đổi SHAPE (buộc reseed), `PERM_SEED_VERSION` cho đổi NỘI DUNG ma trận (nên
   merge, không nên reseed).
8. Toàn bộ merge trên **không đụng** `localStorage['choso-caolanh-accounts']` (Account),
   `localStorage['choso-caolanh-ui']` (currentDemoAccountId/selectedMarket), hay
   `localStorage['choso-caolanh-state']` (business mock data) — đúng yêu cầu đề bài, và cũng đúng
   với thực tế code hiện tại (3 module này đã hoàn toàn độc lập, tự load/save riêng, xác nhận qua
   3 key + 3 hàm `loadState()`/`loadAccounts()`/`A.load()` không gọi chéo nhau).

**Không đổi `PERM_SEED_VERSION` ở Phase 5A.** Đề xuất trên áp dụng **từ lần đổi seed tiếp theo**
(ví dụ nếu Phase 5B hoặc phase sau cần thêm permission key mới) — Phase 5A chỉ chốt thiết kế.

---

## 13. Files/functions expected to change in Phase 5B

| File | Hàm/khối dự kiến sửa | Loại thay đổi |
|---|---|---|
| `js/v-vanhanh.js` | `renderAccForm()` (264-281) | Đổi `af-scope` select → 2 checkbox |
| `js/v-vanhanh.js` | `A.CH['af-scope']` (351) | Đổi thành 2 handler mới (hoặc 1 handler đọc cả 2 checkbox) build `marketScopes` |
| `js/v-vanhanh.js` | `A.ACT['acc-form-save']` (353-370) | Thêm validate "≥ 1 market" (mục 11) |
| `js/v-vanhanh.js` | Filter "Chợ / phạm vi" trong `A.VIEWS['tai-khoan']` (305) + `A.CH['acc-market']` (325) | Bỏ option `ALL`, đổi logic filter |
| `js/v-vanhanh.js` | `settingsVaitroHtml()` (810-826) | Đổi cột "Phạm vi dữ liệu" → "Số quyền" |
| `js/v-vanhanh.js` | `scopeLabel()` (386-390) | Xoá hẳn nếu không còn nơi nào dùng sau khi đổi mục 9.3, hoặc giữ lại rút gọn nếu vẫn cần hiển thị `selfService` ở đâu đó |
| `js/v-vanhanh.js` | `renderRoleForm()` (411-424) | Bỏ dropdown scope + field market, thêm checkbox `selfService` |
| `js/v-vanhanh.js` | `A.CH['rf-scope']`/`A.CH['rf-market']` (876-882) | Thay bằng 1 handler set `selfService` trực tiếp |
| `js/v-vanhanh.js` | `A.ACT['role-form-save']` (884-899, số dòng tham khảo vùng lân cận 861-880 đã đọc) | Đổi `patch` build từ `scope`/`market` sang `selfService` trực tiếp + `scope: selfService?'self':'all'` |
| `js/v-vanhanh.js` | `permsMatrixHtml()` (395-410) | Thêm layer tách `kind==='screen'` / `kind==='action'`, nhóm phụ theo `screenId` trong phần action |
| `js/permissions.js` | `loadState()` (247-278) | (Chỉ khi Phase 5B/sau quyết định áp dụng migration mới ở mục 12 — nếu không, KHÔNG đụng file này ở Phase 5B) |
| `js/accounts.js` | *Không dự kiến đổi* | Model/API hiện tại đã đủ (`marketScopes` đã là mảng, chỉ UI chưa dùng đúng) |
| `js/core.js` | *Không dự kiến đổi* | `A.allowedMarkets()`, `A.syncAccountContext()` đã xử lý đúng mọi dạng `marketScopes` |
| `index.html` | *Không dự kiến đổi* | Không có markup Account/Role tĩnh nào cần sửa |

---

## 14. Test plan for Phase 5B

**A — Checkbox marketScopes:**
- Tick cả CL+TTD, lưu account mới → `marketScopes === ['CL','TTD']` (không có `'ALL'`).
- Tick chỉ CL → `['CL']`; chỉ TTD → `['TTD']`.
- Không tick gì → bị chặn lưu, đúng toast.
- Sửa account cũ có `marketScopes:['ALL']` (dữ liệu localStorage hiện tại) → mở form, cả 2
  checkbox hiển thị đã tick sẵn → lưu lại → `marketScopes` ghi lại thành `['CL','TTD']`.
- 2 checkbox bị `disabled` đúng khi tài khoản đang thao tác thiếu `tai-khoan.gan-quyen`.

**B — Filter danh sách tài khoản:**
- Lọc theo CL → hiện đúng account có `'CL'` trong `marketScopes` (kể cả account 2-chợ).
- Lọc theo TTD tương tự.

**C — Role scope UI:**
- Tạo role mới, tick "Vai trò tự phục vụ" → `selfService===true`, `scope==='self'`.
- Không tick → `selfService===false`, `scope==='all'`.
- Đổi account đang dùng sang account có role `selfService:true` → tự động điều hướng `mini-app`
  (hành vi cũ ở `core.js:540-541` phải còn nguyên).
- Bảng danh sách Role hiển thị đúng "Số quyền" (X màn hình · Y hành động), khớp
  `A.PERM.rolePermKeys(roleId).length`.

**D — Tách Screen/Action Permission UI:**
- Mở khối phân quyền chi tiết 1 role → thấy rõ 2 khối "Quyền màn hình" và "Quyền thao tác" (nhóm
  phụ theo màn).
- Tick/bỏ tick 1 checkbox action vẫn gọi đúng `perm-toggle` với đúng `permKey` như trước (không
  đổi hành vi `grant`/`revoke`).

**E — Regression bắt buộc (không được vỡ):**
- `A.canDo`/`A.PERM.canAction`/`A.PERM.canScreen` không đổi kết quả cho toàn bộ test case đã
  PASS ở Phase 4B report (dynamic toggling, market scope cross-account, admin self-protection,
  payment 5 entry point, contract dual-permission OR-logic).
- `A.syncAccountContext()`/`A.allowedMarkets()`/`A.screenMarketOk()` không đổi hành vi cho account
  cũ còn `marketScopes:['ALL']` chưa được admin mở sửa lại.
- `role.builtin` vẫn chặn xoá; role đang dùng (`ui.role`) vẫn chặn khoá/xoá.
- `node --check` sạch trên mọi file bị sửa.

---

## 15. Out-of-scope items

Đúng theo mục 13 đề bài, xác nhận lại — Phase 5B **không** đụng tới:
Backend/API/Database/Authentication thật; Organization/BQL hierarchy; role "Cán bộ kinh tế" mới;
nghiệp vụ Thu tiền/Đối soát/Hợp đồng; workflow Sự cố; permission export; redesign toàn bộ dự án;
sidebar/menu ngoài phần liên quan trực tiếp tới Tài khoản/Vai trò; Screen Matrix V1; Action Matrix
V1 (trừ khi phát hiện bug thực tế — **không phát hiện bug nào trong Action/Screen Matrix ở audit
này**, chỉ có vấn đề UI/representation của Account.marketScopes và Role.scope).

---

## 16. NEED_CONFIRMATION

1. **"Đặt lại dữ liệu mẫu" có nên reset cả Account/Permission không?** Hiện tại (`A.resetAll()`,
   `core.js:590-594`) chỉ reset business mock data, giữ nguyên Account/Role/Permission admin đã
   tuỳ biến — hành vi này **hợp lý** cho 1 buổi demo dài (không mất công cấu hình lại tài khoản
   mỗi lần reset số liệu), nhưng **nhãn nút hiện tại ("Đặt lại dữ liệu mẫu") không nói rõ phạm vi
   này**. Cần quyết định: (a) giữ hành vi, chỉ sửa label/thêm ghi chú cho rõ; hay (b) thêm 1 hành
   động tách riêng "Đặt lại toàn bộ (kể cả tài khoản, vai trò, phân quyền)" dùng
   `A.ACCOUNTS.resetDefault()` + `A.PERM.resetDefault()` (đã có sẵn, chưa từng được gọi).
2. **`system_admin`/`ward_leader` có bắt buộc phải tick đủ CL+TTD không, hay chỉ khuyến nghị?**
   Về mặt kỹ thuật không bắt buộc (không màn nào của `system_admin` cần `ui.market` cụ thể; các
   `BOTH`-screen của `ward_leader` vẫn hoạt động với 1 chợ, chỉ tự giới hạn phạm vi xem). Cần
   quyết định có nên **validate cứng** ("role X phải có đủ 2 chợ") hay chỉ **gợi ý** (helper text)
   ở Phase 5B.
3. **Account loại "Tiểu thương" (`accountType==='Tiểu thương'` hoặc `roleIds` chứa `trader`) có
   nên giới hạn chỉ được chọn ĐÚNG 1 checkbox (không cho tick cả 2) không?** Về nghiệp vụ, 1 tiểu
   thương gắn với 1 điểm kinh doanh tại 1 chợ cụ thể — cho phép tick cả 2 chợ có thể không hợp lý
   dù không gây lỗi kỹ thuật.
4. **Có cần giữ lại field `Role.market` (single chợ, `scope==='market'`) trong data model cho mục
   đích tương lai nào đó không, hay xoá hẳn khỏi `defaultRoles()`/`role-form-save` luôn?** Audit
   xác nhận field này hiện KHÔNG có bất kỳ tác dụng runtime nào (mục 3) — đề xuất ở mục 9.4/10 là
   bỏ khỏi FORM nhưng không nhất thiết xoá khỏi schema Role ngay (để tương thích ngược nếu có role
   cũ đã lưu `scope:'market'`). Cần xác nhận có nên dọn hẳn field này khỏi `defaultRoles()` luôn
   trong Phase 5B, hay chỉ ẩn khỏi UI như đề xuất.
5. **"Số quyền" ở bảng Role (mục 9.3) nên hiển thị dạng 1 số gộp hay tách "X màn hình · Y hành
   động"?** Đề xuất tách 2 số (rõ ràng hơn, khớp việc tách UI Screen/Action ở mục 9.5), nhưng cần
   xác nhận ưu tiên hiển thị.

---

*Hết báo cáo Phase 5A. Không có thay đổi code nào được thực hiện. Dừng lại chờ xác nhận trước khi
sang Phase 5B.*
