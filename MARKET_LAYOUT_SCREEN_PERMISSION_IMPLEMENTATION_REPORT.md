# IMPLEMENT — Chuẩn hóa Screen Permission "Mặt bằng chợ"

> Bước implement sau `MARKET_LAYOUT_SCREEN_PERMISSION_AUDIT.md`, theo đúng 7 quyết định đã chốt (route `#/mat-bang`, screen permission `screen:mat-bang` duy nhất, migration OR từ stored state thực tế, action permKey giữ nguyên, Phương án A cho `screenId` metadata, xử lý mọi role kể cả custom).

## 0. Xác nhận trước khi sửa

Đã đọc lại `MARKET_LAYOUT_SCREEN_PERMISSION_AUDIT.md`, `js/permissions.js`, `js/core.js`, `js/v-cautruc.js`, `js/v-dieuhanh.js`, `js/v-vanhanh.js`, `js/v-tieuthuong.js` trước khi sửa — **implementation hiện tại khớp đúng 100% với mô tả trong audit** (không có mismatch nào phát hiện, không phải dừng để report sai lệch).

---

## 1. Files changed

| File | Thay đổi |
|---|---|
| `js/permissions.js` | CATALOG (xoá `screen:so-do`/`screen:cau-truc`, thêm `screen:mat-bang`; đổi `screenId` của 6 action); `screenRoles` (default matrix mới); `PERM_SEED_VERSION` 4→5; migration tường minh `migrateMatBangScreen()` gọi trong `mergeIntoCurrentSeed()`; guard `matBangMigratedV5` trong cả `mergeIntoCurrentSeed()` lẫn `loadState()`. |
| `js/core.js` | `A.MENU` (gộp 2 entry thành 1 entry `mat-bang`); `A.SCREEN_MARKET` (xoá 2 key cũ, thêm `mat-bang: 'BOTH'`); `A.route()` (thêm redirect 2 hash cũ → `mat-bang`, tái dùng `history.replaceState` có sẵn); cập nhật 2 khối comment liên quan. |
| `js/v-cautruc.js` | `A.VIEWS['so-do']`/`A.VIEWS['cau-truc']` → `A.VIEWS['mat-bang']` (chỉ đổi registration, hàm `mbWorkspaceHtml` và mọi `A.canDo('cau-truc.*', ...)` KHÔNG đổi); cập nhật 3 khối comment tham chiếu screen id cũ. |
| `js/v-dieuhanh.js` | Chỉ cập nhật 2 khối comment tham chiếu `screen:so-do`/`screen:cau-truc` → `screen:mat-bang`; **0 dòng logic đổi**. |

**Không sửa:** `js/v-vanhanh.js` (đã generic, tự phản ánh đúng khi CATALOG đổi — xác nhận bằng test mục 13), `js/v-tieuthuong.js` (dùng thẳng action permKey `so-do.tao-hop-dong`, không tham chiếu screen id), `js/accounts.js`, `styles.css`, dữ liệu (`js/data.js`), `A.RBAC_SCHEMA`.

---

## 2. CATALOG changes

Xoá:
```js
{ key: 'screen:cau-truc', kind: 'screen', group: 'Điều hành', label: 'Thiết lập mặt bằng chợ' },
{ key: 'screen:so-do', kind: 'screen', group: 'Điều hành', label: 'Sơ đồ mặt bằng' },
```
Thêm (đúng vị trí cũ trong mảng CATALOG):
```js
{ key: 'screen:mat-bang', kind: 'screen', group: 'Điều hành', label: 'Mặt bằng chợ' },
```
6 action entry — **permKey KHÔNG đổi**, chỉ đổi field `screenId` (Phương án A):
```js
{ key: 'action:cau-truc.edit', ..., screenId: 'mat-bang', ... },
{ key: 'action:cau-truc.delete', ..., screenId: 'mat-bang', ... },
{ key: 'action:cau-truc.reset', ..., screenId: 'mat-bang', ... },
{ key: 'action:so-do.xem-ho-so', ..., screenId: 'mat-bang', ... },
{ key: 'action:so-do.tao-hop-dong', ..., screenId: 'mat-bang', ... },
{ key: 'action:so-do.doi-trang-thai', ..., screenId: 'mat-bang', ... },
```
Nhãn (`label`) của 6 action giữ nguyên y hệt — không cần đổi để rõ nghĩa (đã đủ rõ theo audit mục 12).

---

## 3. Default matrix changes

`screenRoles['mat-bang']` (chỉ áp dụng cho **fresh state** — cài mới/reset, KHÔNG dùng để ghi đè state đã lưu):
```js
'mat-bang': ['system_admin', 'ward_leader', 'market_manager', 'market_staff', 'accountant', 'collector', 'technician'],
```
Đúng khớp bảng đã chốt ở mục 4 yêu cầu (7/8 role YES, `trader` NO). `actionRoles` cho 6 action `cau-truc.*`/`so-do.*` **không đổi 1 ký tự nào**.

---

## 4. Migration implementation

Hàm mới `migrateMatBangScreen(stored)`, gọi ngay đầu `mergeIntoCurrentSeed(stored)` — **trước** bước filter `validKeys` (đọc đúng lúc 2 permKey cũ còn nguyên trong `stored.rolePerms`):

```js
function migrateMatBangScreen(stored) {
  const hadLegacyKeys = stored.rolePerms.some(r => r.permKey === 'screen:so-do' || r.permKey === 'screen:cau-truc');
  if (!hadLegacyKeys) return;
  const matBangRoleIds = [];
  stored.roles.forEach(r => {
    const oldSoDo = stored.rolePerms.some(x => x.roleId === r.id && x.permKey === 'screen:so-do');
    const oldCauTruc = stored.rolePerms.some(x => x.roleId === r.id && x.permKey === 'screen:cau-truc');
    if (oldSoDo || oldCauTruc) matBangRoleIds.push(r.id);
  });
  stored.rolePerms = stored.rolePerms.filter(r => r.permKey !== 'screen:so-do' && r.permKey !== 'screen:cau-truc');
  matBangRoleIds.forEach(roleId => {
    stored.rolePerms.push({ roleId, permKey: 'screen:mat-bang', grantedAt: 'migrate-v5', grantedBy: 'Hệ thống (migrate screen:so-do/screen:cau-truc → screen:mat-bang)' });
  });
  stored.matBangMigratedV5 = true;
}
```

Điểm mấu chốt xử lý đúng yêu cầu mục 6:
1. **Tính OR từ STORED STATE THỰC TẾ** — `oldSoDo`/`oldCauTruc` đọc trực tiếp từ `stored.rolePerms` của **từng role trong `stored.roles`** (vòng `forEach` không hard-code danh sách id nào — bao gồm cả 8 builtin lẫn bất kỳ custom role nào có trong `stored.roles`), **không** dùng `defaultRolePermissions()` mới.
2. **Cờ `matBangMigratedV5`** — đặt sau khi xử lý xong, được 2 vòng lặp "tự bổ sung permKey hoàn toàn mới theo default" (1 trong `mergeIntoCurrentSeed()`, 1 trong `loadState()`) kiểm tra để **bỏ qua hẳn** `screen:mat-bang` khi bổ sung default — ngăn chặn đúng lỗ hổng đã audit: nếu không có cờ này, permKey `screen:mat-bang` (hoàn toàn mới với hệ thống merge) sẽ bị 2 vòng generic đó "hồi sinh" theo default matrix mới, xoá mất kết quả OR-migration vừa tính — **kể cả trường hợp cực đoan không role nào giữ được quyền này** (đã test riêng, xem mục 6 dòng `custom_B`).

```js
defaultRolePermissions().forEach(d => {
  if (stored.matBangMigratedV5 && d.permKey === 'screen:mat-bang') return; // đã xử lý tường minh, KHÔNG để default ghi đè
  if (!knownKeys.has(d.permKey)) stored.rolePerms.push(d);
});
```
Và tương ứng trong `loadState()` (vòng "tự bổ sung permission mới" chạy độc lập, mọi lần load):
```js
defaultRolePermissions().forEach(d => {
  if (s.matBangMigratedV5 && d.permKey === 'screen:mat-bang') return;
  if (!known.has(d.permKey)) s.rolePerms.push(d);
});
```

`PERM_SEED_VERSION` 4→5, `RBAC_SCHEMA` không đổi. Comment lịch sử version trong file đã cập nhật đầy đủ (v5 = Phase 7).

---

## 5. Four-case OR migration results (live test)

Test bằng cách viết trực tiếp 1 payload `localStorage['choso-caolanh-permissions']` mô phỏng state v4 đã lưu (schemaVersion khớp, seedVersion=4), reload trang để `loadState()` thật sự chạy migration, rồi đọc lại `A.PERM` sau khi đã persist v5:

| Case | Role test | `so-do` trước | `cau-truc` trước | `mat-bang` sau (thực đo) | Kết quả |
|---|---|---|---|---|---|
| A | `system_admin` | YES | NO | **YES** | ✅ PASS |
| B | `ward_leader` | NO | YES | **YES** | ✅ PASS |
| C | `market_manager` | YES | YES | **YES** | ✅ PASS |
| D | `market_staff` | NO | NO | **NO** | ✅ PASS |

Kèm 2 role bình thường khác cũng test (chỉ có `so-do`): `accountant` → `mat-bang` YES; `collector` → `mat-bang` YES. `trader` (không grant gì) → `mat-bang` NO. Tất cả đúng như dự kiến.

---

## 6. Custom-role migration results

| Role | Trước | Sau | Kết quả |
|---|---|---|---|
| `technician` (builtin, ADMIN ĐÃ REVOKE `screen:so-do`, không có `screen:cau-truc`) | so-do NO (đã revoke), cau-truc NO | `mat-bang`: **NO** | ✅ PASS — đúng ví dụ bắt buộc ở mục 6 yêu cầu, **không bị default seed hồi sinh** |
| `role_custom_A` (custom, chỉ có `screen:cau-truc`) | so-do NO, cau-truc YES | `mat-bang`: **YES** | ✅ PASS |
| `role_custom_B` (custom, không có cả hai) | so-do NO, cau-truc NO | `mat-bang`: **NO**, `rolePermKeys` = `[]` (0 dòng, không bị resurrect bởi vòng default-fill) | ✅ PASS — đây chính là trường hợp cực đoan mục 4 đã phân tích (permKey có 0 grantee sau migrate vẫn KHÔNG bị hiểu nhầm là "permKey chưa từng thấy") |

Migration xác nhận hoạt động đúng cho **cả role KHÔNG có trong danh sách 8 builtin** — vòng lặp `stored.roles.forEach(...)` trong `migrateMatBangScreen()` không hard-code bất kỳ id nào.

---

## 7. Custom revoke preservation

Test cụ thể case D (`market_staff`, không có `so-do`/`cau-truc` nhưng CÓ custom grant `action:cau-truc.edit` — giả lập admin đã cấp riêng action dù screen access đã bị thu hồi trước đó): sau migration, `market_staff` **vẫn giữ `action:cau-truc.edit` = true**, dù `screen:mat-bang` = false. Xác nhận đúng nguyên tắc "action permission độc lập hoàn toàn với screen permission" — kể cả trong chính bước migration.

Tương tự, `system_admin` test với grant phụ `action:tai-khoan.tao-moi` → giữ nguyên sau migration (không liên quan gì đến bước gộp screen).

---

## 8. Action permission preservation

Xác nhận (đọc trực tiếp `A.PERM.catalog()` sau khi ứng dụng khởi động với fresh state, không phải test-migration):

```
action:cau-truc.edit          screenId: mat-bang   (permKey KHÔNG đổi)
action:cau-truc.delete        screenId: mat-bang   (permKey KHÔNG đổi)
action:cau-truc.reset         screenId: mat-bang   (permKey KHÔNG đổi)
action:so-do.xem-ho-so        screenId: mat-bang   (permKey KHÔNG đổi)
action:so-do.tao-hop-dong     screenId: mat-bang   (permKey KHÔNG đổi)
action:so-do.doi-trang-thai   screenId: mat-bang   (permKey KHÔNG đổi)
```

`actionRoles` (default action matrix) trong `defaultRolePermissions()` — **0 dòng bị sửa** cho 6 action này. Toàn bộ 24 điểm gọi `A.canDo('cau-truc.*', ...)` trong `js/v-cautruc.js` và toàn bộ điểm gọi `A.canDo('so-do.*', ...)` trong `js/v-dieuhanh.js`/`js/v-tieuthuong.js` — **0 dòng bị sửa** (chỉ comment xung quanh được cập nhật).

---

## 9. Menu changes

`A.MENU` nhóm "Điều hành" → "Hạ tầng chợ" nay chỉ còn:
```js
{ id: 'mat-bang', ico: '🗺️', label: 'Mặt bằng chợ' },
{ id: 'diem-kd', ico: '🏪', label: 'Điểm kinh doanh' },
```
Không còn entry `so-do`/`cau-truc` nào (kể cả dạng `hidden: true`) — xác nhận qua test: sidebar chỉ hiện đúng 2 mục "Mặt bằng chợ" + "Điểm kinh doanh" trong nhóm này (cộng "Phiên chợ quê" khi applicable).

---

## 10. Route changes

Route chính: `#/mat-bang`. `A.VIEWS['mat-bang'] = mbWorkspaceHtml` (đăng ký DUY NHẤT — không còn `A.VIEWS['so-do']`/`A.VIEWS['cau-truc']`).

Xác nhận live: reload trang mới (fresh state) → tự động vào thẳng `#/mat-bang`, `A.current === 'mat-bang'`, tiêu đề "Mặt bằng chợ" — 0 lỗi console.

---

## 11. Old-route compatibility

Đoạn thêm trong `A.route()`, ngay sau khi đọc hash, trước khi đánh giá `U.can(r)`:
```js
if (r === 'so-do' || r === 'cau-truc') r = 'mat-bang';
```
Tái dùng nguyên vẹn cơ chế `history.replaceState` đã có sẵn trong `A.route()` để đồng bộ lại thanh địa chỉ — **không tạo router thứ hai**.

Test trực tiếp:
- `#/so-do` (gõ hash trực tiếp, gọi `A.route()`) → `location.hash` tự đổi thành `#/mat-bang`, `A.current === 'mat-bang'`.
- `#/cau-truc` → tương tự, tự đổi thành `#/mat-bang`.
- Lặp lại với tất cả 9 tài khoản demo (sweep mục 16) → không có trường hợp nào bị hash loop hay trắng trang.
- Account không có quyền `mat-bang` (ví dụ `trader`) gõ `#/mat-bang` trực tiếp → tự fallback đúng theo logic sẵn có (`mini-app` cho role selfService) — không lỗi.

---

## 12. SCREEN_MARKET

```js
A.SCREEN_MARKET = {
  ...
  'mat-bang': 'BOTH', 'diem-kd': 'BOTH', 'tieu-thuong': 'BOTH', 'hop-dong': 'BOTH',
  ...
};
```
Đã xoá `'cau-truc': 'BOTH'` và `'so-do': 'BOTH'` cũ. Hành vi `A.screenMarketOk()`/`A.allowedMarkets()` **không đổi logic** — chỉ đổi tên key tra cứu. Test xác nhận: account scope CL chỉ vào được `mat-bang` khi `ui.market==='CL'`; account scope TTD tương tự cho `TTD`; account scope `ALL` (ward_leader) chuyển đổi market bình thường và `mat-bang` luôn applicable ở cả 2 market.

---

## 13. Permission UI

Màn "Vai trò & phân quyền" (`js/v-vanhanh.js`, `permsMatrixHtml` — **0 dòng code sửa**, hoàn toàn generic):

**QUYỀN MÀN HÌNH** — live test (role `market_manager`): xác nhận đúng 1 checkbox **"☑ Mặt bằng chợ"**, không còn "Thiết lập mặt bằng chợ" / "Sơ đồ mặt bằng" (`screenLabels` chỉ trả về 1 phần tử duy nhất khớp "Mặt bằng chợ").

**QUYỀN THAO TÁC** — live test: cả 6 action (`Thêm/sửa khối, tầng, khu...`, `Xoá khối, tầng, khu...`, `Khôi phục cấu trúc mặc định`, `Xem hồ sơ tiểu thương từ sơ đồ mặt bằng`, `Tạo hợp đồng từ sơ đồ mặt bằng`, `Đổi trạng thái điểm kinh doanh`) nằm dưới **đúng 1 tiêu đề nhóm "Mặt bằng chợ"** (`groupHeadingCount: 1`, xác nhận bằng DOM query đếm số div tiêu đề nhóm có text "Mặt bằng chợ" — chỉ 1, không tách 2 nhóm như trước). Đã kèm ảnh chụp màn hình xác nhận trực quan.

---

## 14. Handler-level authorization

Xác nhận **không có dòng code mới nào** kiểm tra `A.PERM.canScreen(..., 'mat-bang')` hay `U.can('mat-bang')` bên trong bất kỳ handler mutation nào (`qh-*` trong `v-cautruc.js`, `stall-status*`/`A.stallPanel` trong `v-dieuhanh.js`). Toàn bộ gate mutation vẫn đi qua đúng `A.canDo(actionKey, targetMarket)` như trước — 0 thay đổi.

Live test forged mutation: đăng nhập `collector` (không có `cau-truc.edit`/`.delete`/`.reset`), gọi trực tiếp `A.ACT['qh-reset']`/`A.ACT['qh-add-zone']` qua console → không mở modal xác nhận/thêm được (`resetForgeOpenedModal: false`, `addZoneForgeOpenedModal: false`), số khu không đổi (`zoneCountUnchanged: true`) — handler-level gate vẫn chặn đúng, độc lập hoàn toàn với `screen:mat-bang`.

---

## 15. CL/TTD tests

| Test | Kết quả |
|---|---|
| Account scope CL (`market_manager`) vào `#/mat-bang` | `ui.market: CL`, `allowedMarkets: ['CL']` ✅ |
| Account scope TTD (`market_staff`) vào `#/mat-bang` | `ui.market: TTD`, `allowedMarkets: ['TTD']` ✅ |
| Forge `ui.market='CL'` cho account chỉ scope TTD, gọi lại `A.syncAccountContext()` | Tự kẹp lại về `TTD` (market hợp lệ duy nhất) ✅ |
| Account scope `ALL` (`ward_leader`) chuyển market CL↔TTD | Cả 2 chiều hoạt động đúng, `ui.market` luôn concrete (`CL`/`TTD`, không bao giờ `'ALL'`) ✅ |

---

## 16. Role regression (8 builtin role)

| Role | Vào `mat-bang`? | Nút Sửa/Thêm hiện? | Nút Xóa hiện? | Nút `⋯` (reset) hiện? |
|---|---|---|---|---|
| `system_admin` | ✅ | 0 (không có `cau-truc.edit`) | 0 | Không |
| `ward_leader` | ✅ | 0 | 0 | Không |
| `market_manager` | ✅ | 15 (có `cau-truc.edit`) | 12 (có `cau-truc.delete`) | Có (`cau-truc.reset`) |
| `market_staff` | ✅ | 5 (có `cau-truc.edit`, market TTD) | 0 (không có `.delete`) | Không (không có `.reset`) |
| `accountant` | ✅ | 0 | 0 | Không |
| `collector` | ✅ | 0 | 0 | Không |
| `technician` | ✅ | 0 | 0 | Không |
| `trader` | ❌ (không có `mat-bang` mặc định — tự route `mini-app`) | — | — | — |

Đúng khớp toàn bộ yêu cầu mục 21: mọi role đều XEM được (trừ `trader`), chỉ `market_manager`/`market_staff` có action edit theo đúng action permission hiện có (không tự nhận theo screen), `market_staff` không tự có delete/reset dù có edit.

---

## 17. `diem-kd` regression

- `screen:diem-kd` không đổi (permKey, role matrix, market applicability — nguyên vẹn).
- `A.stallPanel` (nơi 3 action `so-do.*` thật sự được kiểm tra) **không đổi 1 dòng** — vẫn dùng đúng `A.canDo('so-do.xem-ho-so'|'.tao-hop-dong'|'.doi-trang-thai', st.market)`.
- Live test: đăng nhập `collector`, vào `#/diem-kd`, click 1 dòng điểm kinh doanh → modal chi tiết mở đúng (`diemKdModalOpened: true`) — xác nhận 3 action `so-do.*` vẫn hoạt động bình thường từ màn Điểm kinh doanh, hoàn toàn độc lập với việc `screenId` metadata của chúng vừa đổi thành `'mat-bang'` (metadata đó chỉ ảnh hưởng cách group ở màn "Vai trò & phân quyền", không được `A.stallPanel`/`A.canDo` đọc tới).

---

## 18. Browser console

- Fresh load (state mới hoàn toàn): 0 lỗi console.
- Sweep 9 tài khoản demo × 18 màn hình (toàn bộ `Object.keys(A.VIEWS)`, giảm từ 19 entry cũ xuống 18 vì `so-do`+`cau-truc` gộp còn 1) + redirect 2 hash cũ cho mỗi tài khoản = 162 lượt render + 18 lượt redirect: **0 exception, 0 lỗi console**.
- `read_console_messages` (pattern lỗi/exception, `onlyErrors: true`) sau toàn bộ test: **"No console errors or exceptions found"**.

---

## 19. `node --check`

```
js/permissions.js   OK
js/core.js          OK
js/v-cautruc.js     OK
js/v-dieuhanh.js    OK
js/v-vanhanh.js     OK   (không sửa, check lại để xác nhận không vô tình hỏng)
js/v-tieuthuong.js  OK   (không sửa, check lại để xác nhận không vô tình hỏng)
```

---

## 20. NEED_CONFIRMATION

1. **Trường hợp cực đoan "0 role nào có `mat-bang` sau migration"** (đã test qua `role_custom_B` + tình huống giả lập, xử lý đúng nhờ cờ `matBangMigratedV5`) — cờ này persist vĩnh viễn trong `stored` JSON như 1 field phụ (`matBangMigratedV5: true`), không ảnh hưởng gì tới shape/schema hiện có, nhưng đây là lần đầu tiên `permissions.js` dùng kiểu "cờ đánh dấu đã migrate" thay vì suy luận thuần từ dữ liệu — nếu có bump `PERM_SEED_VERSION` tương lai cần thiết kế tương tự cho 1 permKey có khả năng "0 grantee hợp lệ", nên tái dùng đúng pattern này (đặt cờ riêng theo tên version, ví dụ `xyzMigratedV6`) thay vì dựa vào `knownKeys`/`known` (Set theo permKey) vốn không phân biệt được "0 dòng vì chưa xử lý" với "0 dòng vì đã xử lý và đúng là 0".
2. **Dữ liệu localStorage thực tế trên môi trường demo đang chạy** (ngoài phiên test này) không được audit/implementation kiểm tra trực tiếp — nếu có bất kỳ trình duyệt nào đang giữ state v4 thật với tuỳ biến admin đã grant/revoke `screen:so-do`/`screen:cau-truc` khác default, lần load đầu tiên sau khi deploy code này sẽ tự động chạy đúng migration đã test ở trên — không cần thao tác thủ công, nhưng nên xác nhận với người đang thao tác trên môi trường đó trước khi họ tải lại trang, để không bất ngờ nếu quyền xem "Mặt bằng chợ" của role họ đang dùng thay đổi đúng theo OR-logic (ví dụ nếu trước đó role đó có `cau-truc` nhưng không có `so-do`, giờ sẽ THẤY thêm quyền `mat-bang` — đây là hành vi ĐÚNG theo thiết kế, không phải lỗi, nhưng là 1 thay đổi quan sát được).

---

## Xác nhận cuối

```
PERM_SEED_VERSION: 4 → 5
RBAC_SCHEMA changed? NO (vẫn = 2)
Action permKey renamed? NO
Action grants/revokes reset? NO
Custom screen permission preserved through OR migration? YES
Account state reset? NO
Business data reset? NO
Floorplan data reset? NO
```

---

## STOP

Implement + test + report hoàn tất. Không refactor thêm action namespace nào, không redesign giao diện "Mặt bằng chợ" (giao diện hotfix trước đó giữ nguyên 100%, chỉ đổi registration/route/screen identity), không sửa "Điểm kinh doanh", không sửa module tài chính, không tạo permission mới ngoài `screen:mat-bang`.
