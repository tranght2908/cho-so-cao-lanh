# AUDIT — Chuẩn hóa Screen Permission "Mặt bằng chợ"

> **CHỈ AUDIT. Không có dòng code nào bị sửa để tạo report này.** Toàn bộ số liệu dưới đây lấy trực tiếp từ trạng thái hiện tại của `js/core.js`, `js/permissions.js`, `js/v-dieuhanh.js`, `js/v-cautruc.js`, `js/accounts.js`, `js/v-tieuthuong.js`, `js/v-vanhanh.js`, `styles.css` tại thời điểm audit (sau hotfix UX ở `MARKET_LAYOUT_UX_HOTFIX_REPORT.md`).

---

## 1. Current screen permissions

Hai permission-key `kind:'screen'` đang tồn tại độc lập trong `CATALOG` (`js/permissions.js` dòng 35-36):

```js
{ key: 'screen:cau-truc', kind: 'screen', group: 'Điều hành', label: 'Thiết lập mặt bằng chợ' },
{ key: 'screen:so-do',    kind: 'screen', group: 'Điều hành', label: 'Sơ đồ mặt bằng' },
```

Cả hai key này đều là **screen permission gác cổng `U.can(screenId)`** (`js/core.js` dòng 81-87) — quyết định "vào được màn nào", hoàn toàn tách biệt với action permission.

Về mặt UI, cả hai screen id (`so-do` và `cau-truc`) hiện **render CÙNG một hàm** `mbWorkspaceHtml` (`js/v-cautruc.js` dòng 457-460):

```js
A.VIEWS['so-do'] = mbWorkspaceHtml;
A.VIEWS['cau-truc'] = mbWorkspaceHtml;
```

Nghĩa là: về UI đã là 1 workspace duy nhất, nhưng về RBAC vẫn là 2 screen permission độc lập, có thể được cấp/thu hồi riêng biệt cho từng vai trò qua màn "Vai trò & phân quyền" — đây chính là điểm lệch pha cần audit.

---

## 2. Audit hai screen hiện tại

### `screen:so-do`

| Mục | Giá trị hiện tại |
|---|---|
| Role có mặc định (seed) | `system_admin`, `ward_leader`, `market_manager`, `market_staff`, `accountant`, `collector`, `technician` (7/8 role — chỉ thiếu `trader`) |
| Route sử dụng | `#/so-do` |
| Menu sử dụng | `A.MENU` nhóm "Điều hành" → mục `{ id: 'so-do', label: 'Mặt bằng chợ' }` — **hiển thị trong sidebar** (không có `hidden`) |
| Action nằm dưới (theo `screenId` trong CATALOG) | `action:so-do.xem-ho-so`, `action:so-do.tao-hop-dong`, `action:so-do.doi-trang-thai` |
| Market applicability (`A.SCREEN_MARKET`) | `'BOTH'` — áp dụng cả CL/TTD theo `ui.market`, còn phải nằm trong `account.marketScopes` |

### `screen:cau-truc`

| Mục | Giá trị hiện tại |
|---|---|
| Role có mặc định (seed) | `market_manager`, `market_staff` (2/8 role) |
| Route sử dụng | `#/cau-truc` |
| Menu sử dụng | `A.MENU` nhóm "Điều hành" → mục `{ id: 'cau-truc', label: 'Thiết lập mặt bằng chợ', hidden: true }` — **entry đầy đủ vẫn tồn tại trong `A.MENU`, nhưng bị lọc khỏi danh sách `<a>` render trong `chrome()`** (điều kiện `!it.hidden`, xem `js/core.js` dòng 445) |
| Action nằm dưới (theo `screenId` trong CATALOG) | `action:cau-truc.edit`, `action:cau-truc.delete`, `action:cau-truc.reset` |
| Market applicability (`A.SCREEN_MARKET`) | `'BOTH'` — giống hệt `so-do` |

### Dynamic custom permission có thể khác default matrix như thế nào

- Default matrix (`defaultRolePermissions()`) chỉ là **seed ban đầu**. Admin có thể `A.PERM.grant`/`A.PERM.revoke` bất kỳ `(roleId, permKey)` nào qua màn "Vai trò & phân quyền" (`js/v-vanhanh.js` `permsMatrixHtml`), lưu trực tiếp vào `localStorage['choso-caolanh-permissions']` (`STATE.rolePerms`).
- Vì vậy **tại runtime thực tế**, tổ hợp `(screen:so-do, screen:cau-truc)` cho một role bất kỳ có thể là bất kỳ 1 trong 4 trạng thái (có cả hai / chỉ so-do / chỉ cau-truc / không có cái nào) **dù seed mặc định hiện tại KHÔNG có trường hợp "chỉ cau-truc, không so-do"** (xem bảng mục 5). Bất kỳ đề xuất migration nào PHẢI xử lý đúng cho cả 4 tổ hợp, không được giả định chỉ có tổ hợp theo default matrix.
- `PERM.resetDefault()` (nút "Khôi phục mặc định" trong Cài đặt, nếu có) sẽ xoá mọi custom grant và seed lại — nhưng đây là hành động tường minh do admin bấm, không tự động chạy.

---

## 3. Current routes/menu

| | `#/so-do` | `#/cau-truc` |
|---|---|---|
| Sidebar link | Có (label "Mặt bằng chợ") | Không (bị lọc bởi `!it.hidden`) |
| `A.menuItem(id)` | Trả về đầy đủ `{id,ico,label}` | Trả về đầy đủ `{id,ico,label,hidden:true}` |
| `A.VIEWS[id]` | `mbWorkspaceHtml` | `mbWorkspaceHtml` (cùng hàm) |
| `U.can(id)` | Kiểm `screen:so-do` | Kiểm `screen:cau-truc` |
| Truy cập trực tiếp URL `#/cau-truc` | — | Vẫn hoạt động **nếu** role có `screen:cau-truc`, dù không có link trong sidebar |
| `A.firstAccessibleScreen()` | Trả về `so-do` nếu đây là màn đầu tiên (theo thứ tự `A.MENU`) mà role có quyền — **chỉ xét `so-do` vì `cau-truc` không có điều kiện đặc biệt trong hàm này, nó chỉ lặp qua toàn bộ `A.MENU.items` bất kể `hidden`** — nghĩa là về lý thuyết `cau-truc` VẪN có thể được chọn làm fallback nếu nó đứng trước `so-do` trong thứ tự `A.MENU`. Thực tế thứ tự hiện tại là `so-do` đứng TRƯỚC `cau-truc` (dòng 405-406 `core.js`) nên `so-do` luôn thắng trong fallback hiện nay — nhưng đây là 1 sự trùng hợp về thứ tự khai báo, không phải 1 rule tường minh. |

---

## 4. Current SCREEN_MARKET

```js
A.SCREEN_MARKET = {
  ...
  'cau-truc': 'BOTH', 'so-do': 'BOTH', ...
};
```

Cả hai giống hệt nhau: `'BOTH'` — áp dụng cho CL và TTD theo đúng `ui.market` hiện tại, với điều kiện `ui.market` phải nằm trong `A.allowedMarkets(account)` (tức `account.marketScopes`). Không có sự khác biệt nào giữa 2 screen ở khía cạnh này — thuận lợi cho việc gộp.

---

## 5. Current action permissions

| Action key | `screenId` (CATALOG) | Role mặc định | Dùng ở đâu trong code |
|---|---|---|---|
| `action:cau-truc.edit` | `cau-truc` | `market_manager`, `market_staff` | `js/v-cautruc.js` — 15 điểm gọi `A.canDo('cau-truc.edit', ...)` (UI gate + handler gate, cùng 1 hàm) |
| `action:cau-truc.delete` | `cau-truc` | `market_manager` | `js/v-cautruc.js` — 6 điểm |
| `action:cau-truc.reset` | `cau-truc` | `market_manager` | `js/v-cautruc.js` — 2 điểm |
| `action:so-do.xem-ho-so` | `so-do` | `ward_leader`, `market_manager`, `market_staff`, `accountant`, `collector` | `js/v-dieuhanh.js` (`A.stallPanel`, dùng chung cho cả 2 nơi mở drawer điểm KD) |
| `action:so-do.tao-hop-dong` | `so-do` | `market_manager`, `market_staff` | `js/v-dieuhanh.js` (`A.stallPanel`) **và** `js/v-tieuthuong.js` (3 điểm — màn "Tiểu thương") |
| `action:so-do.doi-trang-thai` | `so-do` | `market_manager`, `market_staff` | `js/v-dieuhanh.js` (`A.stallPanel` + 2 handler `stall-status`/`stall-status-save`) |

**Phát hiện quan trọng nhất của mục này:** `A.stallPanel` (nơi 3 action `so-do.*` thật sự được kiểm tra) được dùng ở **hai màn khác nhau**:
1. Workspace "Mặt bằng chợ" (`#/so-do` / `#/cau-truc`, click 1 điểm trên sơ đồ → drawer).
2. Màn **"Điểm kinh doanh"** (`screen:diem-kd`, hoàn toàn độc lập, KHÔNG nằm trong phạm vi gộp lần này) — `js/v-tieuthuong.js` dòng 39-41, `A.ACT['dk-open']` mở modal chứa `A.stallPanel(st)`.

→ 3 action `so-do.*` **không thuộc riêng về 1 screen** — chúng là action permission dùng chung cho bất kỳ nơi nào trong app render 1 điểm kinh doanh, bất kể entry point là "Mặt bằng chợ" hay "Điểm kinh doanh". Đây là bằng chứng kỹ thuật trực tiếp củng cố yêu cầu của task: **không được đổi namespace hay suy diễn theo screen**, vì `so-do.*` đã sẵn cross-screen, không phải 1-1 với `screen:so-do`.

---

## 6. Current permission migration/loadState (cơ chế đang có sẵn)

`js/permissions.js` dòng 254-321. Tóm tắt cơ chế MERGE hiện có (đã triển khai từ Phase 6 STEP A, đổi `PERM_SEED_VERSION` 3→4 — không phải lần này):

1. `PERM_SEED_VERSION` (hiện = `4`) tách biệt hoàn toàn với `A.RBAC_SCHEMA` (hiện = `2`).
2. `loadState()`: nếu `schemaVersion` khớp nhưng `seedVersion` lệch → gọi `mergeIntoCurrentSeed(stored)` thay vì reseed toàn bộ.
3. `mergeIntoCurrentSeed(stored)`:
   - Role có trong `defaultRoles()` nhưng chưa có trong `stored.roles` → thêm mới; role đã tồn tại giữ nguyên mọi field đã tuỳ biến.
   - `permKey` không còn trong `CATALOG` hiện tại → **xoá khỏi `rolePerms` của MỌI role**.
   - `permKey` hoàn toàn mới (không còn dòng nào sau bước xoá) → thêm đúng grant mặc định theo `defaultRolePermissions()` hiện tại.
   - `permKey` đã tồn tại VÀ vẫn còn trong `CATALOG` → **giữ nguyên tuyệt đối**, không đụng tới dù default matrix của nó đổi.

Cơ chế này **đã đúng chuẩn** "không full reseed" mà task yêu cầu — không cần thiết kế lại, chỉ cần *áp dụng đúng* cho trường hợp `screen:so-do`/`screen:cau-truc` → `screen:mat-bang` (xem mục 9 bên dưới, đây là phần audit chính, KHÔNG implement).

---

## 7. Target `screen:mat-bang`

### Đánh giá phương án

`screen:mat-bang` là **screen permission DUY NHẤT** để vào workspace hợp nhất, thay thế `screen:so-do` + `screen:cau-truc`.

**Action permission GIỮ NGUYÊN KHÔNG ĐỔI:**
```
action:cau-truc.edit
action:cau-truc.delete
action:cau-truc.reset
action:so-do.xem-ho-so
action:so-do.tao-hop-dong
action:so-do.doi-trang-thai
```

**Phân tích tính sạch/an toàn:**

✅ **Sạch:**
- Khớp đúng thực tế UI: đã là 1 workspace từ sau hotfix, nay RBAC phản ánh đúng đó là 1 màn.
- `permsMatrixHtml` (mục 10 audit) sẽ chỉ còn 1 checkbox "Mặt bằng chợ" ở "Quyền màn hình" thay vì 2 checkbox trùng lặp gây nhầm lẫn (đúng như task mô tả ở mục 10 yêu cầu gốc).
- Không đổi `permKey` của action → **0 rủi ro** cho toàn bộ 15+21 điểm gọi `A.canDo('cau-truc.*'/'so-do.*', ...)` đang rải trong `v-cautruc.js`, `v-dieuhanh.js`, `v-tieuthuong.js`.
- Không ảnh hưởng `screen:diem-kd` (hoàn toàn độc lập, đã xác nhận mục 5).

⚠️ **Rủi ro cần kiểm soát (không phải lý do từ chối phương án, nhưng phải thiết kế đúng khi implement):**
- **Không được để việc gộp screen bị hiểu nhầm là "gộp action"** — nguy cơ lớn nhất nếu người thực hiện tương lai tiện tay đổi luôn `screenId: 'cau-truc'/'so-do'` trong CATALOG action entries thành `screenId: 'mat-bang'` mà không hiểu rằng đây chỉ là field DÙNG ĐỂ GROUP UI (mục 10), không phải authorization logic — nhưng nếu làm sai và đồng thời có người suy luận "action nằm dưới `mat-bang` thì cứ có `screen:mat-bang` là đủ để thao tác", đó sẽ là lỗi thiết kế. Cần ghi rõ trong code/comment (khi implement, ngoài phạm vi task này) rằng 2 việc độc lập nhau.
- Route `#/cau-truc` cũ vẫn phải tiếp tục hoạt động nếu muốn tương thích ngược (mục 10 audit route riêng bên dưới).

**Kết luận:** phương án `screen:mat-bang` duy nhất + giữ nguyên 6 action key là **sạch và an toàn**, miễn là migration tuân thủ đúng rule ở mục 9 và route/menu xử lý đúng ở mục 10.

---

## 8. Quy tắc quan trọng (đã xác nhận đúng với kiến trúc hiện tại)

> Screen permission chỉ quyết định "Có được vào Mặt bằng chợ không?" — Action permission quyết định "Vào rồi được làm gì?"

Điều này **đã đúng 100% với kiến trúc hiện tại**, không cần thay đổi gì về nguyên lý:

- `U.can(screenId)` (routing/menu gate) và `A.canDo(actionKey, targetMarket)` (mutation gate) là **hai hàm hoàn toàn độc lập**, không hàm nào gọi hàm kia.
- Ví dụ minh hoạ của task khớp chính xác với code hiện tại: 1 account có `screen:mat-bang` nhưng KHÔNG có `action:cau-truc.edit` → `U.can('mat-bang')` = true (vào được workspace, thấy cây/tổng quan/sơ đồ) nhưng `mbCan(mid).edit` = false (mọi nút Sửa/Xoá/Thêm bị ẩn, mọi handler `qh-*` tự chặn ở dòng đầu `if (!A.canDo('cau-truc.edit', ...)) return;`).
- Role không được dùng trực tiếp để quyết định UI ở bất kỳ đâu trong `v-cautruc.js`/`v-dieuhanh.js` hiện tại — toàn bộ đều qua `A.canDo`/`U.can`. Xác nhận: `grep` không tìm thấy bất kỳ `if (ui.role === ...)` nào trong 2 file này.

---

## 9. Default role target cho `screen:mat-bang`

### Bảng tổng hợp theo default seed hiện tại

| Role | `so-do` (default) | `cau-truc` (default) | Đề xuất `mat-bang` | Có `cau-truc.edit` mặc định? |
|---|---|---|---|---|
| `system_admin` | ✅ | ❌ | ✅ (xem, không sửa) | ❌ |
| `ward_leader` | ✅ | ❌ | ✅ (xem, không sửa) | ❌ |
| `market_manager` | ✅ | ✅ | ✅ | ✅ |
| `market_staff` | ✅ | ✅ | ✅ | ✅ |
| `accountant` | ✅ | ❌ | ✅ (xem, không sửa) | ❌ |
| `collector` | ✅ | ❌ | ✅ (xem, không sửa) | ❌ |
| `technician` | ✅ | ❌ | ✅ (xem, không sửa) | ❌ |
| `trader` | ❌ | ❌ | ❌ | ❌ |

Với default seed hiện tại, **`mat-bang = so-do OR cau-truc` cho MỌI role đều đơn giản = `so-do`** (vì tập `cau-truc` là tập con thực sự của tập `so-do`: `{market_manager, market_staff} ⊂ {system_admin, ward_leader, market_manager, market_staff, accountant, collector, technician}`). Không có role nào bị mất quyền xem hay bị cấp nhầm quyền sửa nếu default target = union.

Ví dụ task nêu (`collector`): hiện có `screen:so-do` nhưng không có `screen:cau-truc` và không có `action:cau-truc.edit/.delete/.reset` → sau migration: có `screen:mat-bang` (từ `so-do`), vẫn KHÔNG có 3 action `cau-truc.*` → **vẫn xem được Mặt bằng chợ, vẫn không chỉnh được cấu trúc** — đúng target.

**Không tự grant thêm business permission** nào ngoài screen access — xác nhận không có action nào cần cấp thêm cho bất kỳ role nào trong đề xuất default target này.

---

## 10. Proposed migration rule

### Bảng 4 trường hợp

| Trường hợp | `so-do` | `cau-truc` | Screen access sau migrate (`mat-bang`) | Action permission |
|---|---|---|---|---|
| A | ✅ | ❌ | ✅ (từ `so-do`) | Giữ nguyên bất kỳ `cau-truc.*`/`so-do.*` role đó đang có (không đổi) |
| B | ❌ | ✅ | ✅ (từ `cau-truc`) | Giữ nguyên |
| C | ✅ | ✅ | ✅ | Giữ nguyên |
| D | ❌ | ❌ | ❌ | Giữ nguyên (không có gì để giữ/mất) |

**Rule đề xuất — đã xác nhận AN TOÀN:**

```
mat-bang = so-do OR cau-truc      (CHỈ áp dụng cho SCREEN ACCESS)
```

Đây là rule đúng và an toàn vì:
1. Nó **union**, không bao giờ **thu hẹp** quyền xem của bất kỳ role nào đang có ít nhất 1 trong 2 screen — không role nào bị mất khả năng vào workspace.
2. Nó **không đụng đến** 6 action key `cau-truc.*`/`so-do.*` — action permission của từng role giữ nguyên 100% bất kể tổ hợp screen trước đó là gì. **Không được suy ra `action:cau-truc.edit` từ việc có `screen:so-do`/`screen:cau-truc`** — đây chính là ranh giới phải giữ nghiêm ngặt (một role case A — có `so-do`, không có `cau-truc` — dù sau migrate có `screen:mat-bang`, vẫn không tự nhiên có `cau-truc.edit` nếu trước đó không có).
3. Áp dụng đúng cơ chế `mergeIntoCurrentSeed()` đã có sẵn (mục 6): khi bump `PERM_SEED_VERSION`, 2 permKey `screen:so-do`/`screen:cau-truc` sẽ bị xoá khỏi `rolePerms` (không còn trong `CATALOG` mới), và cần MỘT bước xử lý ĐẶC BIỆT (không phải hành vi mặc định của `mergeIntoCurrentSeed`) để "hồi sinh" thành `screen:mat-bang` theo đúng rule OR ở trên cho những role ĐÃ CÓ tuỳ biến khác default — nếu không, `mergeIntoCurrentSeed` bước 3 ("permKey hoàn toàn mới → grant theo default") sẽ chỉ cấp `screen:mat-bang` theo **default matrix mới** (mục 9), LÀM MẤT bất kỳ custom grant nào (ví dụ nếu admin từng tự cấp thêm `screen:so-do` cho `technician` dù seed gốc đã có sẵn — không mất gì vì trùng default; nhưng nếu admin từng REVOKE `screen:so-do` khỏi 1 role có nó theo default, và role đó không có `cau-truc` → sau migrate role đó đáng lẽ phải KHÔNG có `mat-bang`, nhưng `mergeIntoCurrentSeed` mặc định sẽ không cấp lại vì permKey `mat-bang` "hoàn toàn mới" → chỉ cấp theo default matrix mới, tức lại cấp `mat-bang` cho role đó theo default `so-do` cũ — **sai**, phải cấp/không cấp dựa trên STATE THỰC TẾ của `stored.rolePerms`, không phải default matrix).

   → **Kết luận migration**: không thể dùng nguyên xi `mergeIntoCurrentSeed()` hiện có cho bước NÀY — cần 1 đoạn migration TƯỜNG MINH (chạy 1 lần, trước hoặc trong `mergeIntoCurrentSeed`) đọc trực tiếp `stored.rolePerms` để tính `hasMatBang(roleId) = hasPerm(roleId,'screen:so-do') OR hasPerm(roleId,'screen:cau-truc')` cho TỪNG role có mặt trong `stored.roles` (kể cả role tuỳ biến thêm sau, không chỉ 8 role builtin), rồi mới xoá 2 permKey cũ + thêm `screen:mat-bang` theo kết quả tính được — **không phải theo default matrix mới**. Đây là điểm THIẾT KẾ quan trọng nhất cần làm đúng khi implement (ngoài phạm vi audit này).

4. Role KHÔNG có trong 8 role builtin (role tuỳ biến do admin tạo qua "Thêm vai trò mới") cũng phải được xử lý theo đúng state thực tế của nó, không được bỏ sót.

---

## 11. Route compatibility strategy

### Phân tích hiện trạng

| | Hiện tại | Sau chuẩn hoá (đề xuất, CHƯA implement) |
|---|---|---|
| Hash chính | `#/so-do` (có sidebar link) | `#/mat-bang` (ưu tiên) |
| Hash phụ | `#/cau-truc` (không sidebar link, vẫn route được trực tiếp) | Redirect về `#/mat-bang` nếu hợp lệ |
| Sidebar | 1 link duy nhất trỏ `so-do` | 1 link duy nhất trỏ `mat-bang` |
| Active state | `A.current === 'so-do'` | `A.current === 'mat-bang'` |
| Direct URL cũ | `#/so-do`, `#/cau-truc` đều vào được nếu có quyền tương ứng | Cả 2 nên tiếp tục vào được (xem đề xuất bên dưới), không được 404/trắng trang |
| `A.firstAccessibleScreen()` | Duyệt `A.MENU` theo thứ tự khai báo, trả `so-do` trước (mục 3) | Cần trỏ đúng `mat-bang` (thay `so-do`/`cau-truc` trong `A.MENU` bằng 1 entry `mat-bang`) |

### Đề xuất (KHÔNG implement trong task này)

**Ưu tiên `#/mat-bang` làm route chính thức mới**, đồng thời giữ tương thích ngược 2 chiều:

1. `A.MENU` chỉ còn **1 entry** `{ id: 'mat-bang', ico: '🗺️', label: 'Mặt bằng chợ' }` (thay thế cả `so-do` và `cau-truc`).
2. Trong `A.route()`, thêm 1 bảng ánh xạ redirect tường minh cho 2 hash cũ:
   ```
   '#/so-do'    → nếu U.can('mat-bang') thì chuyển hash sang '#/mat-bang' (giống cơ chế replaceState đã có ở A.route() cho trường hợp fallback)
   '#/cau-truc' → tương tự
   ```
   Việc redirect PHẢI đi qua `U.can('mat-bang')` — nếu account không có quyền `mat-bang` (dù trước đó từng có `so-do`/`cau-truc` — về lý thuyết không xảy ra sau migration đúng, nhưng vẫn nên phòng thủ), fallback về `A.firstAccessibleScreen()` như hiện tại, không được giả định luôn có quyền.
3. Đây là hành vi **redirect theo quyền của account hiện tại**, không phải bookmark cố định — đúng tinh thần "old route redirect về mat-bang nếu user có quyền phù hợp" mà task đề cập.
4. Không cần giữ `screen:so-do`/`screen:cau-truc` như 2 permKey "ma" (deprecated nhưng còn trong CATALOG) chỉ để route cũ hoạt động — vì redirect ở bước 2 xử lý bằng cách map HASH (chuỗi tĩnh), không phụ thuộc permKey còn tồn tại hay không.

---

## 12. Permission UI impact

Màn "Vai trò & phân quyền" (`js/v-vanhanh.js`, hàm `permsMatrixHtml`, dòng 429-457):

**Quyền màn hình** — hiện render toàn bộ `CATALOG.filter(kind==='screen')`, tức đang có 2 checkbox riêng "☑ Thiết lập mặt bằng chợ" và "☑ Sơ đồ mặt bằng". Sau chuẩn hoá còn đúng 1 permKey `screen:mat-bang` trong CATALOG → tự động chỉ còn 1 checkbox "☑ Mặt bằng chợ" **mà không cần sửa gì thêm ở `permsMatrixHtml`** (hàm này generic, chỉ lặp qua CATALOG).

**Quyền thao tác** — hiện nhóm theo `A.menuItem(p.screenId).label`:
```js
const item = p.screenId && A.menuItem(p.screenId);
const gname = item ? item.label : p.group;
```
- `cau-truc.edit/.delete/.reset` có `screenId:'cau-truc'` → nhóm dưới label của `A.menuItem('cau-truc')`.
- `so-do.xem-ho-so/.tao-hop-dong/.doi-trang-thai` có `screenId:'so-do'` → nhóm dưới label của `A.menuItem('so-do')`.

**Vấn đề hiện tại (đã tồn tại, không phải do task này gây ra):** nếu `A.MENU` đổi để chỉ còn 1 entry `mat-bang` (mục 11), thì `A.menuItem('cau-truc')` và `A.menuItem('so-do')` sẽ trả về `null` → `gname` fallback về `p.group` (= `'Điều hành'`, group lớn) — **2 nhóm hành động sẽ KHÔNG còn gộp chung dưới 1 tiêu đề "Mặt bằng chợ" nữa mà rơi vào nhóm "Điều hành" chung chung, mất đi sự phân biệt rõ ràng theo màn** — đây là hệ quả PHỤ cần lưu ý khi implement, không phải lỗi của audit này.

**Đề xuất group action mà KHÔNG đổi action key:**
- **Phương án A (khuyến nghị):** Đổi field `screenId` trong CATALOG của 6 action entry đó (`cau-truc.edit/.delete/.reset`, `so-do.xem-ho-so/.tao-hop-dong/.doi-trang-thai`) từ `'cau-truc'`/`'so-do'` sang `'mat-bang'`. Đây **CHỈ là metadata dùng để group UI** (`permsMatrixHtml`), **KHÔNG phải là `permKey`** — action key vẫn nguyên vẹn `action:cau-truc.edit` v.v., `A.canDo('cau-truc.edit', ...)` ở mọi handler không cần sửa gì. Rủi ro: phải đảm bảo `A.menuItem('mat-bang')` tồn tại đúng lúc `permsMatrixHtml` chạy (tức phải đổi `A.MENU` trước/cùng lúc).
- **Phương án B (ít xâm lấn hơn, an toàn hơn nếu muốn tối thiểu thay đổi):** Giữ nguyên `screenId:'cau-truc'`/`'so-do'` trong CATALOG (không đổi field nào của action entry), nhưng giữ lại 2 entry `so-do`/`cau-truc` trong `A.MENU` ở dạng **ẩn khỏi sidebar nhưng vẫn có `label`** (tương tự cách `cau-truc` đang bị `hidden:true` hiện nay) chỉ để `A.menuItem()` tiếp tục resolve được label cho mục đích group UI — đánh đổi là vẫn phải duy trì 2 "screen id ma" trong `A.MENU` dù đã không còn 2 permKey `screen:*` tương ứng.
- Khuyến nghị **Phương án A** vì sạch hơn về lâu dài (không giữ id ma), miễn là thực hiện đúng thứ tự (đổi `A.MENU` → đổi `screenId` metadata) và test kỹ `permsMatrixHtml` sau đổi.

---

## 13. Handler-level safety

Xác nhận: việc gộp screen permission **không** và **không được** làm mất `A.canDo(actionKey, targetMarket)` ở bất kỳ handler mutation nào.

- `js/v-cautruc.js`: toàn bộ 24 handler `qh-*` đều mở đầu bằng `if (!A.canDo('cau-truc.edit'|'.delete'|'.reset', ...)) return;` — đây là gate ĐỘC LẬP với `U.can('so-do'|'cau-truc'|'mat-bang')`. Gộp screen permission **không chạm** vào bất kỳ dòng nào trong số này.
- `js/v-dieuhanh.js` (`A.stallPanel`, `stall-status`, `stall-status-save`): tương tự, dùng `A.canDo('so-do.xem-ho-so'|'.tao-hop-dong'|'.doi-trang-thai', st.market)` — độc lập với screen permission.
- `js/v-tieuthuong.js` (3 điểm dùng `so-do.tao-hop-dong`): độc lập tương tự, và đây chính là bằng chứng `so-do.*` không thể bị gắn chặt vào 1 screen cụ thể (mục 5).

**Xác nhận rõ ràng:** `screen:mat-bang` **CHỈ** là điều kiện "vào được route/menu `mat-bang`" tại `U.can()` (`js/core.js` dòng 81-87) — nó **KHÔNG** xuất hiện, và theo thiết kế đúng thì **KHÔNG ĐƯỢC** xuất hiện, ở bất kỳ điều kiện nào bên trong các handler `qh-*`/`A.stallPanel`/`stall-status*`. Việc migrate screen permission **không có khả năng "biến `screen:mat-bang` thành quyền sửa mọi thứ"** miễn là không có ai vô tình thêm 1 điều kiện kiểu `if (A.PERM.canScreen(ui.role,'mat-bang')) { cho phép sửa }` vào handler — điều này **hiện không tồn tại** và audit này khuyến cáo **không được thêm** khi implement.

---

## 14. Files expected to change (KHI implement — audit only, chưa sửa)

| File | Thay đổi dự kiến |
|---|---|
| `js/permissions.js` | Xoá `screen:so-do`/`screen:cau-truc` khỏi CATALOG, thêm `screen:mat-bang`; sửa `screenRoles` (bỏ 2 dòng cũ, thêm dòng `mat-bang`); (tuỳ chọn) sửa `screenId` của 6 action entry sang `'mat-bang'` (Phương án A mục 12); thêm đoạn migration tường minh xử lý rule OR theo state thực tế (mục 10); bump `PERM_SEED_VERSION` 4→5. |
| `js/core.js` | `A.MENU`: gộp 2 entry `so-do`/`cau-truc` thành 1 entry `mat-bang`; `A.route()`: thêm redirect map cho 2 hash cũ (mục 11); `A.SCREEN_MARKET`: xoá 2 key cũ, thêm `mat-bang: 'BOTH'`. |
| `js/v-cautruc.js` | Đổi `A.VIEWS['so-do']`/`A.VIEWS['cau-truc']` thành `A.VIEWS['mat-bang']` (giữ nguyên toàn bộ hàm `mbWorkspaceHtml` và mọi `A.canDo('cau-truc.*', ...)` — không đổi). |
| `js/v-dieuhanh.js` | Không cần sửa logic — chỉ cập nhật comment tham chiếu `so-do`/`cau-truc` nếu muốn đồng bộ tài liệu nội bộ. |
| `js/v-vanhanh.js` | Không cần sửa `permsMatrixHtml` (đã generic) — chỉ cần CATALOG/`A.MENU` đổi đúng là tự phản ánh. |
| `js/v-tieuthuong.js` | Không cần sửa — dùng thẳng `so-do.tao-hop-dong`, không tham chiếu `screen:so-do`. |

**Không cần sửa:** `js/accounts.js`, `styles.css`, dữ liệu (`js/data.js`), `A.RBAC_SCHEMA` (không đổi shape, chỉ đổi seed content → chỉ bump `PERM_SEED_VERSION`).

---

## 15. Regression risks

| Rủi ro | Mức độ | Ghi chú |
|---|---|---|
| Role có custom grant lệch default bị migrate sai (mất/thừa quyền xem) nếu dùng `mergeIntoCurrentSeed()` nguyên xi thay vì migration tường minh | **Cao** | Đã phân tích chi tiết ở mục 10 — đây là rủi ro chính, PHẢI thiết kế đoạn migration riêng, không dùng default matrix để quyết định `mat-bang` cho role đã có custom state. |
| Action permission bị suy diễn nhầm từ screen access khi implement (thêm nhầm điều kiện `canScreen` vào handler) | Trung bình | Không tồn tại hiện tại; chỉ là rủi ro nếu người implement không đọc kỹ mục 8/13. |
| `A.firstAccessibleScreen()`/redirect route cũ tạo vòng lặp hashchange nếu implement sai (giống lỗi đã từng gặp và tránh được trong các task trước — dùng `history.replaceState`, không dùng `location.hash=` trong `A.route()`) | Trung bình | `A.route()` hiện đã có sẵn pattern đúng (`history.replaceState`) — chỉ cần tái dùng, không tạo cơ chế redirect mới song song. |
| `permsMatrixHtml` group "Quyền thao tác" rơi về nhóm chung "Điều hành" thay vì "Mặt bằng chợ" nếu không đổi `screenId` metadata đồng thời với `A.MENU` (mục 12) | Thấp | Chỉ ảnh hưởng UI hiển thị trong màn Cài đặt, không ảnh hưởng authorization logic — nhưng làm giảm rõ ràng nếu bỏ sót. |
| `diem-kd` (Điểm kinh doanh) bị ảnh hưởng ngoài ý muốn | Rất thấp | Đã xác nhận `screen:diem-kd` hoàn toàn độc lập (permKey riêng, role matrix riêng — thiếu `technician` khác với `so-do`); chỉ dùng chung 3 action `so-do.*` vốn đã cross-screen từ trước, không đổi gì ở bước này. |
| `#/cau-truc` bookmark cũ (nếu có người dùng lưu) không còn hoạt động nếu quên implement redirect | Thấp | Chỉ xảy ra nếu bỏ qua đề xuất mục 11. |

---

## 16. Implementation test plan (audit — checklist cho lần implement sau, KHÔNG chạy trong task này)

1. Với mỗi 1 trong 8 role builtin + ít nhất 1 role tuỳ biến demo (nếu có), so sánh `A.PERM.rolePermKeys(roleId)` TRƯỚC và SAU migration: xác nhận `has('screen:mat-bang') === (has('screen:so-do') OR has('screen:cau-truc'))` (đo TRƯỚC migration), và mọi permKey khác (kể cả 6 action `cau-truc.*`/`so-do.*`) giữ nguyên y hệt.
2. Test riêng trường hợp custom: revoke `screen:so-do` khỏi `technician` (vẫn giữ default không có `cau-truc`) trước khi migrate → sau migrate xác nhận `technician` KHÔNG có `screen:mat-bang` (không bị "hồi sinh" theo default matrix mới).
3. Test route: `#/so-do` và `#/cau-truc` (gõ thẳng URL) đều phải đưa về đúng `#/mat-bang` cho account có quyền; account KHÔNG có quyền phải fallback đúng theo `A.firstAccessibleScreen()`, không trắng trang/lỗi console.
4. Test sidebar: chỉ còn 1 link "Mặt bằng chợ", active state đúng khi ở `#/mat-bang`.
5. Test permission UI (`Vai trò & phân quyền`): đúng 1 checkbox "Mặt bằng chợ" ở "Quyền màn hình"; 6 checkbox action nhóm đúng dưới 1 tiêu đề (nếu chọn Phương án A mục 12).
6. Test handler: với account có `screen:mat-bang` nhưng không có `cau-truc.edit` → vào được workspace, không thấy nút sửa, forge `A.ACT['qh-*']` qua console vẫn bị chặn (lặp lại đúng bộ test đã dùng ở `MARKET_LAYOUT_UX_HOTFIX_REPORT.md` mục 9 test #16-17).
7. Test `diem-kd`: không có thay đổi hành vi nào (regression check).
8. `node --check` toàn bộ file đổi.
9. Quét toàn bộ màn × toàn bộ account (như đã làm ở hotfix trước, 9 account × 19 màn) — 0 console error.
10. Xác nhận `PERM_SEED_VERSION` tăng đúng 1 bước, `RBAC_SCHEMA` KHÔNG đổi.

---

## 17. NEED_CONFIRMATION

1. **Route chính thức mới `#/mat-bang` hay giữ `#/so-do` làm route chính?** Audit này đề xuất `#/mat-bang` (khớp tên hiển thị "Mặt bằng chợ", nhất quán với permKey mới), nhưng nếu có lo ngại về việc đổi hash ảnh hưởng tới thứ gì đó ngoài phạm vi đã audit (ví dụ liên kết ngoài, tài liệu đào tạo người dùng nội bộ đã có sẵn ghi `#/so-do`), có thể chọn giữ `#/so-do` làm hash chính thức và chỉ đổi permKey (không đổi hash) — về mặt kỹ thuật cả 2 đều khả thi, cần quyết định của người có thẩm quyền nghiệp vụ/UX trước khi implement.
2. **Phương án A hay B ở mục 12** (đổi `screenId` metadata của action entry, hay giữ 2 "id ma" ẩn trong `A.MENU`) — đã đề xuất Phương án A nhưng đây là quyết định về mức độ chấp nhận thay đổi diện rộng hơn (dù an toàn) so với thay đổi tối thiểu.
3. **Custom permission thực tế trong localStorage của môi trường demo đang chạy** (nếu có admin nào đã từng grant/revoke tuỳ biến `screen:so-do`/`screen:cau-truc` ngoài default) KHÔNG được audit này kiểm tra trực tiếp (audit chỉ đọc source code/default seed, không đọc `localStorage` của bất kỳ trình duyệt cụ thể nào) — trước khi implement thật, nên kiểm tra nhanh `localStorage['choso-caolanh-permissions']` trên (các) môi trường đang dùng để xác nhận không có tuỳ biến bất ngờ cần xử lý đặc biệt.
4. **Role tuỳ biến do admin tự tạo** (ngoài 8 role builtin) — audit không có dữ liệu cụ thể về việc có role nào như vậy đang tồn tại trong bất kỳ môi trường thật nào hay không; migration tường minh (mục 10) PHẢI được viết để tự động đúng cho mọi role trong `stored.roles`, không hard-code danh sách 8 role.

---

## Bảng tổng hợp CURRENT → TARGET → MIGRATION RULE

| Đối tượng | CURRENT | TARGET | MIGRATION RULE |
|---|---|---|---|
| `screen:so-do` | Permission riêng, 7/8 role mặc định | Bị xoá khỏi CATALOG | Value được gộp vào `screen:mat-bang` theo rule OR (mục 10) |
| `screen:cau-truc` | Permission riêng, 2/8 role mặc định, `A.MENU` entry `hidden:true` | Bị xoá khỏi CATALOG | Value được gộp vào `screen:mat-bang` theo rule OR (mục 10) |
| `screen:mat-bang` | Chưa tồn tại | Permission DUY NHẤT cho workspace | Với mỗi role: `has = hasPerm(role,'screen:so-do') OR hasPerm(role,'screen:cau-truc')` đọc từ `stored.rolePerms` THỰC TẾ (không phải default matrix mới) tại thời điểm migrate |
| Route | `#/so-do` (sidebar) + `#/cau-truc` (ẩn, vẫn hoạt động) | `#/mat-bang` (đề xuất, cần xác nhận mục 17.1) | Cả 2 hash cũ redirect (`history.replaceState`, tái dùng cơ chế có sẵn trong `A.route()`) về `#/mat-bang` nếu `U.can('mat-bang')`, ngược lại fallback `A.firstAccessibleScreen()` như hiện tại |
| Sidebar | 1 link trỏ `so-do` | 1 link trỏ `mat-bang` | `A.MENU`: xoá 2 entry `so-do`/`cau-truc`, thêm 1 entry `mat-bang` |
| Market scope | Cả `so-do`/`cau-truc` đều `A.SCREEN_MARKET[...] = 'BOTH'` | `A.SCREEN_MARKET['mat-bang'] = 'BOTH'` | Không đổi logic `A.screenMarketOk` — chỉ đổi tên key, hành vi giữ nguyên |
| Screen permission (UI Cài đặt) | 2 checkbox "Thiết lập mặt bằng chợ" / "Sơ đồ mặt bằng" | 1 checkbox "Mặt bằng chợ" | Tự động đúng khi CATALOG đổi (mục 12), không cần sửa `permsMatrixHtml` |
| Action permission | 6 key `cau-truc.*`/`so-do.*`, `screenId` trỏ `'cau-truc'`/`'so-do'` | **KHÔNG đổi `permKey`**; `screenId` metadata có thể đổi sang `'mat-bang'` (Phương án A, tuỳ chọn) | Không migrate gì cho action — giữ nguyên `rolePerms` của mọi role đối với 6 permKey này, kể cả grant/revoke tuỳ biến |
| Custom role permissions | Có thể lệch default ở cả 2 screen key cũ | Phải phản ánh đúng union của state THỰC TẾ trước migrate | Migration tường minh đọc `stored.rolePerms`, không dùng `mergeIntoCurrentSeed()` mặc định cho riêng bước screen này (mục 10) |

---

## STOP

Audit hoàn tất. **Không có dòng code nào bị sửa**, không migrate permission, không bump `PERM_SEED_VERSION`, không sửa `RBAC_SCHEMA`, không sửa UI/data/marketScopes/Account/Role nào trong quá trình audit này.
