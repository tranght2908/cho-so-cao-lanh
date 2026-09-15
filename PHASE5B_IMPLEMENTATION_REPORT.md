# PHASE 5B — IMPLEMENTATION REPORT

Account Management + Role/Permission UI + Market Scope UI

Triển khai đúng thiết kế đã chốt tại `PHASE5A_ACCOUNT_ROLE_SCOPE_AUDIT.md`, theo lệnh triển khai
Phase 5B. Toàn bộ mockup UI do người dùng cung cấp (checkbox `marketScopes`, khối "Quyền màn
hình"/"Quyền thao tác" nhóm theo màn) đã được implement và verify sống bằng screenshot khớp
chính xác layout mockup.

---

## 1. Files changed

- `js/v-vanhanh.js` — toàn bộ thay đổi UI/logic (Account form, Account filter, Role table, Role
  form, permission matrix renderer, label "Đặt lại dữ liệu mẫu").
- `js/permissions.js` — chỉ thêm 1 block comment tài liệu hoá gần `PERM_SEED_VERSION`/`loadState()`
  (mục 12 báo cáo Phase 5A), **không đổi bất kỳ hành vi hay giá trị nào**.
- Không sửa `js/accounts.js`, `js/core.js`, `index.html` (đúng dự đoán ở mục 13 báo cáo Phase 5A —
  model/API các file này đã đủ, không cần đổi).

---

## 2. Account marketScopes UI changes

`renderAccForm()` (`v-vanhanh.js`): bỏ hẳn `<select data-ch="af-scope">` (single-select, có
option `value="ALL"`), thay bằng 2 checkbox độc lập:

```html
<label><input type="checkbox" data-ch="af-scope-cl" ...> Chợ Cao Lãnh</label>
<label><input type="checkbox" data-ch="af-scope-ttd" ...> Chợ quê Tân Thuận Đông</label>
```

Handler mới:
```js
function afSetScope(mid, checked) {
  const cur = new Set(A.allowedMarkets({ marketScopes: ui.accForm.marketScopes || [] }));
  if (checked) cur.add(mid); else cur.delete(mid);
  ui.accForm.marketScopes = ['CL', 'TTD'].filter(m => cur.has(m));
}
A.CH['af-scope-cl'] = el => { afSetScope('CL', el.checked); };
A.CH['af-scope-ttd'] = el => { afSetScope('TTD', el.checked); };
```

Rebuild luôn CHỈ từ tập hợp `{CL, TTD}` — không đường nào ghi `'ALL'` từ Phase 5B trở đi. Cả 2
checkbox dùng chung `dis` (disabled khi thiếu `tai-khoan.gan-quyen`) — giữ nguyên cơ chế Phase 4B.

`A.ACT['acc-new']` đổi giá trị khởi tạo từ `marketScopes: ['ALL']` → `marketScopes: ['CL', 'TTD']`
(account mới không bao giờ mang giá trị `'ALL'` kể cả tạm thời trong bộ nhớ).

---

## 3. Account validation

`A.ACT['acc-form-save']`:

```js
const marketScopes = canAssign ? (d.marketScopes || []) : (existing ? existing.marketScopes : []);
if (canAssign && !marketScopes.length) { U.toast('Vui lòng chọn ít nhất một chợ được phân công.'); return; }
```

- Block save nếu không tick chợ nào (chỉ áp dụng khi `canAssign` — người có quyền
  `tai-khoan.gan-quyen`/đang tạo mới; nếu thiếu quyền, `marketScopes` lấy nguyên giá trị account cũ
  đã hợp lệ từ trước, không cần validate lại).
- **Không hard-code theo Role**: không có bất kỳ điều kiện nào kiểm tra `system_admin`/`ward_leader`
  bắt buộc đủ 2 chợ — đúng quyết định đã chốt.
- **Không hard-code trader chỉ 1 chợ**: form áp dụng đồng nhất cho mọi `accountType`/`roleIds` —
  đúng quyết định đã chốt.
- **Không tạo fallback ngầm**: nếu block, hàm `return` ngay, không tự gán `['CL']`.

---

## 4. Legacy ALL compatibility

- `renderAccForm()` tính `dm = A.allowedMarkets({ marketScopes: d.marketScopes || [] })` để hiển
  thị checkbox — dùng lại đúng `A.allowedMarkets()` hiện có (`core.js`, **không sửa**), nên diễn
  giải `['ALL']` → cả 2 checkbox tick sẵn.
- **Phát hiện và sửa 1 lỗi trong lúc implement**: ban đầu chỉ chuẩn hoá cho hiển thị (biến `dm`
  cục bộ trong `renderAccForm`) mà KHÔNG chuẩn hoá `ui.accForm.marketScopes` chính nó khi mở form
  sửa — hệ quả: nếu admin bấm Lưu ngay mà KHÔNG đụng tới checkbox nào, giá trị `marketScopes` vẫn
  giữ nguyên `['ALL']` cũ (vì handler `af-scope-cl`/`af-scope-ttd` — nơi thực sự rebuild mảng —
  chưa từng được gọi). Phát hiện qua test sống (test A5 lần đầu FAIL). Sửa bằng cách chuẩn hoá
  NGAY trong `A.ACT['acc-edit']`:
  ```js
  marketScopes: A.allowedMarkets(a)   // thay vì (a.marketScopes || []).slice()
  ```
  Verify lại: mở Sửa account có `['ALL']`, bấm Lưu ngay không đụng checkbox → ghi lại đúng
  `['CL','TTD']`. Test A5 PASS sau khi sửa (xem mục 14).
- `A.allowedMarkets()` **không bị sửa** — vẫn tương thích `'ALL'` như cũ, đúng yêu cầu.
- Account seed cũ chưa từng được mở Sửa (ví dụ `AC-QT01` trong lúc test) **vẫn giữ nguyên**
  `['ALL']` trong storage — không có migrate cưỡng bức nào chạy.

---

## 5. Account filter changes

`accRows()`:
```js
(!f.market || A.allowedMarkets(a).includes(f.market)) &&
```
(trước đây: `(a.marketScopes || []).includes(f.market)`). Dropdown filter (`acc-market`) bỏ hẳn
option `value="ALL"` — chỉ còn `value=""` ("Chợ / phạm vi: Tất cả", nghĩa "không lọc", state UI
thuần, không phải Account.marketScopes/market ID) + CL/TTD. Verify: lọc CL/TTD đều trả đúng cả
account 1-chợ lẫn 2-chợ lẫn account legacy `['ALL']` (mục 14).

---

## 6. Role table changes

`settingsVaitroHtml()`: cột `Phạm vi dữ liệu` (dùng `scopeLabel(r)`) → cột `Số quyền` (dùng hàm
mới `roleGrantCountLabel(roleId)`):

```js
function roleGrantCountLabel(roleId) {
  const keys = A.PERM.rolePermKeys(roleId);
  const nScreen = keys.filter(k => k.indexOf('screen:') === 0).length;
  const nAction = keys.filter(k => k.indexOf('action:') === 0).length;
  return nScreen + ' màn hình · ' + nAction + ' thao tác';
}
```

Đếm từ **permission state thực tế** (`A.PERM.rolePermKeys`), không từ default matrix — verify
sống: revoke 1 action của `market_staff` → số "thao tác" giảm ngay trong HTML tiếp theo (mục 14).
`scopeLabel()` (hàm cũ, không còn nơi nào gọi — xác nhận bằng grep) đã bị xoá hẳn khỏi file, thay
bằng `roleGrantCountLabel()` tại đúng vị trí cũ.

---

## 7. Role form changes

`renderRoleForm()`: bỏ hẳn `<select data-ch="rf-scope">` (all/market/self) và field "Chợ"
(`rf-market`) phụ thuộc. Thay bằng:
```html
<label><input type="checkbox" data-ch="rf-self" ...> Vai trò tự phục vụ</label>
<div class="note info">Tài khoản có vai trò tự phục vụ sẽ được điều hướng vào Mini app phù hợp với luồng hiện tại.</div>
```
`A.CH['rf-market']`/`A.CH['rf-scope']` (2 handler cũ) xoá, thay bằng 1 handler
`A.CH['rf-self'] = el => { ui.roleForm.selfService = el.checked; };`.

`role-new`/`role-edit` khởi tạo `ui.roleForm` chỉ còn `{id, name, desc, selfService}` (bỏ
`scope`/`market` khỏi object form — không cần nữa vì form không còn field đọc 2 giá trị này).

---

## 8. selfService behavior

`role-form-save`:
```js
const patch = { name: d.name.trim(), desc: (d.desc || '').trim(), scope: d.selfService ? 'self' : 'all', market: null, selfService: !!d.selfService };
```
- `selfService` ghi trực tiếp từ checkbox.
- `scope`/`market` **vẫn giữ trong schema Role** (không xoá khỏi `defaultRoles()`, không bump
  `RBAC_SCHEMA`) — chỉ suy ra lại 2 giá trị `'self'`/`'all'` cho tương thích ngược với bất kỳ nơi
  nào (hiện không còn nơi nào ngoài chính field này) từng đọc `role.scope`. `role.market` luôn ghi
  `null` — không có nhánh `'market'` nào được ghi mới nữa.
- Verify sống: tạo role tick "Vai trò tự phục vụ" → `{selfService:true, scope:'self', market:null}`;
  bỏ tick → `{selfService:false, scope:'all', market:null}` (mục 14, test B5/B6).
- Hành vi runtime auto-route Mini app (`core.js` — **không sửa file này**) không đổi, verify gián
  tiếp qua việc `role.selfService` vẫn đúng field mà `A.route()`/`A.ACT['demo-account']` đọc.

---

## 9. Screen Permission UI changes

`permsMatrixHtml(role)` viết lại hoàn toàn phần render (giữ nguyên `perm-toggle`/`grant`/`revoke`,
giữ nguyên `permKey`, **không đổi `CATALOG`**): lọc `CATALOG` theo `p.kind==='screen'`, render
thành 1 khối "QUYỀN MÀN HÌNH" độc lập, tách biệt (divider) khỏi khối "QUYỀN THAO TÁC" bên dưới.

---

## 10. Action Permission UI changes

Trong khối "QUYỀN THAO TÁC": nhóm `p.kind==='action'` theo TỪNG MÀN — dùng
`A.menuItem(p.screenId).label` làm tên nhóm phụ (ví dụ "Hợp đồng", "Chỉ số điện, nước", "Cài đặt &
phân quyền"); nếu `p.screenId` thiếu hoặc không hợp lệ (không có `A.menuItem` tương ứng), fallback
về `p.group` — không crash renderer (đã kiểm chứng: không có action nào trong `CATALOG` hiện tại
rơi vào nhánh fallback, nhưng code path đã có sẵn và an toàn). Verify screenshot: nhóm hiển thị
đúng như mockup người dùng cung cấp (Hợp đồng: Tạo/Gia hạn/Thanh lý; Điện nước: Ghi chỉ số/Chốt
kỳ/Yêu cầu điều chỉnh).

---

## 11. Reset demo clarification

`settingsNhatkyHtml()`: nhãn nút đổi "Đặt lại dữ liệu mẫu" → **"Đặt lại dữ liệu nghiệp vụ mẫu"**.

`A.ACT.reset` (modal xác nhận): thêm dòng ghi chú
`<div class="note info">Không ảnh hưởng tài khoản, vai trò và phân quyền.</div>`.

`A.ACT['reset-ok']`: toast đổi thành "Đã đặt lại dữ liệu nghiệp vụ mẫu".

**Hành vi `A.resetAll()` (core.js) không đổi** — vẫn chỉ xoá `localStorage['choso-caolanh-state']`
(business mock data), **không** gọi `A.ACCOUNTS.resetDefault()`/`A.PERM.resetDefault()` (2 hàm này
vẫn tồn tại, vẫn không được gọi ở bất kỳ đâu, đúng quyết định đã chốt: không tạo nút "reset toàn
bộ" ở Phase 5B).

---

## 12. Permission migration/version behavior

**Không đổi hành vi migration.** Chỉ thêm 1 block comment tài liệu hoá ngay trên
`const PERM_SEED_VERSION = 3;` trong `js/permissions.js`, mô tả đề xuất merge-thay-vì-reseed cho
lần bump version SAU NÀY (tham chiếu `PHASE5A_ACCOUNT_ROLE_SCOPE_AUDIT.md` mục 12) — **không thêm
code migration mới, không đổi `loadState()`/`freshState()`/`saveState()`**.

Trong lúc implement Phase 5B: **không phát sinh nhu cầu** thêm/bớt permission key hay đổi
`actionRoles`/`screenRoles` mặc định (toàn bộ thay đổi là UI/rendering + 1 field mới trên Account
form đã có sẵn trong schema `marketScopes`) — do đó **không cần dừng để xin NEED_CONFIRMATION** ở
mục này.

---

## 13. selectedMarket behavior

Không sửa `A.syncAccountContext()`/`A.allowedMarkets()`/`A.screenMarketOk()` (core.js, không đụng
file này). Các thao tác mới (sửa `marketScopes` qua checkbox, đổi trạng thái account) đều đi qua
`A.ACCOUNTS.update()` → `A.render()` (trong `acc-form-save`) → `chrome()` gọi
`A.syncAccountContext()` ở đầu mỗi lần render — đúng luồng heal sẵn có, không cần thêm gọi thủ
công. Verify: sau khi sửa `marketScopes` của account đang dùng, `ui.market` tự kẹp lại đúng phạm
vi mới ở lần render kế tiếp (cơ chế cũ, không đổi, không test riêng vì không có gì thay đổi ở tầng
này).

---

## 14. Test results

### A — Account marketScopes (bắt buộc)

| Test | Kết quả | Ghi chú |
|---|---|---|
| A1 (CL only) | **PASS** | `marketScopes === ['CL']` |
| A2 (TTD only) | **PASS** | `marketScopes === ['TTD']` |
| A3 (CL+TTD) | **PASS** | `marketScopes === ['CL','TTD']` |
| A4 (không chọn gì) | **PASS** | Save bị chặn, không tạo account, modal vẫn mở, toast đúng |
| A5 (legacy `['ALL']`) | **PASS (sau 1 lần sửa lỗi — xem mục 4)** | Checkbox hiển thị tick sẵn cả 2; Lưu (kể cả không đụng checkbox) → ghi lại `['CL','TTD']` |
| A6 (scan storage) | **PASS** | Không có account mới/vừa sửa nào còn `'ALL'`; account chưa từng mở sửa (`AC-QT01`) vẫn giữ nguyên `['ALL']` — đúng "không migrate cưỡng bức" |
| Disabled-checkbox + forged save (bổ sung, không có trong đề bài nhưng cần cho phòng thủ) | **PASS** | Checkbox `disabled` đúng khi thiếu `tai-khoan.gan-quyen`; forge gọi thẳng `A.CH['af-scope-ttd']` rồi Save vẫn KHÔNG đổi `marketScopes` (handler Save đọc `existing.marketScopes`, không đọc `d.marketScopes` khi `!canAssign`) |

### B — Same role, different market (mục 22)

**PASS** — `AC-NV03` (collector, `['CL']`) và `AC-NV07` (collector, `['TTD']`): cùng permission
screen/action (đọc từ cùng role `collector`), `A.canDo('thu-tien.thu', market)` trả kết quả khác
nhau đúng theo `marketScopes` từng account — không có Role riêng theo chợ nào được tạo.

### C — Role UI (mục 23)

| Test | Kết quả |
|---|---|
| B1 (không còn cột "Phạm vi dữ liệu") | **PASS** |
| B2 (hiển thị "X màn hình · Y thao tác" khớp state thật) | **PASS** — verify cả bằng regex match lẫn so khớp trực tiếp với `A.PERM.rolePermKeys()` |
| B3 (form không còn scope/market) | **PASS** |
| B4 (form có "Vai trò tự phục vụ") | **PASS** |
| B5 (tạo role `selfService=true`) | **PASS** — `{selfService:true, scope:'self', market:null}` |
| B6 (tạo role `selfService=false`) | **PASS** — `{selfService:false, scope:'all', market:null}` |

### D — Permission UI (mục 24)

| Test | Kết quả |
|---|---|
| C1 (khối "Quyền màn hình" + "Quyền thao tác") | **PASS** — verify cả qua chuỗi HTML lẫn screenshot |
| C2 (action nhóm theo màn) | **PASS** — screenshot khớp mockup ("Hợp đồng", "Chỉ số điện, nước", v.v.) |
| C3 (revoke → checkbox/runtime/số đếm đổi) | **PASS** (sau khi loại bỏ nhiễu do 1 lần chạy test trước đó vô tình để sai tài khoản đang đăng nhập — xem ghi chú debug bên dưới) |
| C4 (grant lại → hoạt động lại) | **PASS** |
| C5 (không có `cai-dat.phan-quyen` → checkbox disabled + forge `perm-toggle` vẫn bị handler chặn) | **PASS** |

*Ghi chú debug*: trong 1 lần chạy test giữa chừng, kết quả C3 tạm thời gây nhầm lẫn do script test
tự vô tình để tài khoản đang dùng lệch sang `market_manager` (không có `cai-dat.phan-quyen`) trước
khi gọi `perm-toggle` — bản thân đây **chính là hành vi bảo vệ đúng** (`A.CH['perm-toggle']` chặn
đúng vì thiếu quyền), không phải lỗi code. Test lại với tài khoản `system_admin` được giữ đúng
xuyên suốt cho kết quả PASS nhất quán ở cả 2 lần chạy độc lập.

### E — Regression Phase 1–4 (mục 25, bắt buộc)

| Kiểm tra | Kết quả |
|---|---|
| `A.ACCOUNTS.primaryRole()` đúng | **PASS** |
| `roleIds` vẫn 1 role hiệu lực | **PASS** |
| `marketScopes` enforcement đúng | **PASS** |
| `selectedMarket` heal đúng | **PASS** (gián tiếp qua các test account switch) |
| Hash không quyền bị chặn ngay | **PASS** |
| Screen Permission dynamic đúng | **PASS** |
| Action Permission dynamic đúng | **PASS** |
| `A.canDo` đúng | **PASS** |
| Handler-level action protection đúng | **PASS** |
| collector CL vs collector TTD khác theo market | **PASS** |
| `system_admin` không có business permission ngoài matrix | **PASS** (`thu-tien.thu`, `hop-dong.thanh-ly` đều `false`) |
| Payment protection Phase 4B không ảnh hưởng | **PASS** — forge `pay-confirm` cross-market vẫn bị chặn |
| Contract dual-permission OR logic không ảnh hưởng | **PASS** |
| Builtin role protection không ảnh hưởng | **PASS** |
| Render toàn bộ 17 màn × 7 account (đủ 8 role) | **PASS** — 0 lỗi |

---

## 15. Regression results

Tổng hợp: **toàn bộ PASS**, không phát hiện regression nào so với Phase 1–4B. Không có test case
nào trong danh sách bắt buộc bị FAIL ở lần chạy cuối cùng.

---

## 16. `node --check` result

```
js/v-vanhanh.js   OK
js/permissions.js OK
js/core.js        OK   (không sửa, chỉ check lại cho chắc)
js/accounts.js    OK   (không sửa, chỉ check lại cho chắc)
```

---

## 17. Browser console result

0 lỗi console (`onlyErrors: true`) xuyên suốt toàn bộ phiên test — kể cả sau khi reload để áp dụng
code fix ở mục 4, và sau khi render toàn bộ 17 màn hình cho 7 account khác nhau (đủ 8 role). Không
có `ReferenceError`/`TypeError`/`SyntaxError`/unhandled rejection nào.

---

## 18. Remaining gaps

- Cột "Số quyền" hiện hiển thị dạng tách 2 số ("X màn hình · Y thao tác") — đây là lựa chọn đã
  được người dùng xác nhận rõ trong lệnh triển khai Phase 5B (mục 11, có ví dụ cụ thể "8 màn hình ·
  13 thao tác"), khớp đúng NEED_CONFIRMATION #5 của Phase 5A đã được trả lời qua lệnh này.
- `Role.scope`/`Role.market` vẫn còn trong schema (cố ý giữ, theo đúng quyết định đã chốt) — không
  còn field nào trong UI ghi trực tiếp giá trị `'market'` nữa; nếu có role cũ nào từng lưu
  `scope:'market'` từ trước Phase 5B, field đó chỉ còn ý nghĩa lịch sử, không ảnh hưởng runtime
  (đã xác nhận ở audit Phase 5A, không kiểm tra lại vì seed hiện tại không có role nào như vậy).
- `A.ACCOUNTS.resetDefault()`/`A.PERM.resetDefault()` tiếp tục tồn tại nhưng không được gọi — như
  chốt ở mục 17, không thuộc phạm vi Phase 5B.

---

## 19. NEED_CONFIRMATION

Không có mục nào cần xác nhận thêm trước khi dừng Phase 5B — toàn bộ 5 NEED_CONFIRMATION còn lại
từ Phase 5A đã được trả lời tường minh trong chính lệnh triển khai Phase 5B (mục 5, 6, 12, 17 của
lệnh) và đã được implement đúng theo quyết định đó.

---

### Xác nhận bắt buộc theo yêu cầu đề bài

| Mục | Kết quả |
|---|---|
| `PERM_SEED_VERSION` có đổi không? | **KHÔNG ĐỔI** (vẫn `= 3`) |
| `RBAC_SCHEMA` có đổi không? | **KHÔNG ĐỔI** (vẫn `= 2`) |
| Default Screen Matrix có đổi không? | **KHÔNG ĐỔI** |
| Default Action Matrix có đổi không? | **KHÔNG ĐỔI** |
| Account storage có bị reset không? | **KHÔNG RESET** |
| Permission customizations có bị reset không? | **KHÔNG RESET** |

Toàn bộ đúng như "Expected" đề bài đặt ra — không có mục nào cần DỪNG để báo trước.

---

*Hết báo cáo Phase 5B. Dừng lại — không tự sang Phase 6, không implement thêm chức năng ngoài
phạm vi Phase 5B.*
