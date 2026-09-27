# Frontend Baseline — Phase 0

Ngày baseline: 2026-09-28. Đây là snapshot trước refactor; chỉ kiểm tra, không thay đổi runtime source.

## 1. Git baseline

| Thuộc tính | Giá trị |
|---|---|
| Branch | `main` |
| HEAD | `649d2e2` — `fix: prevent vehicle demo data initialization error` |
| 5 commit gần nhất | `649d2e2`, `0e7bce7`, `ca9b5ce`, `f30f51d`, `3be9593` |
| Working tree | Không sạch trước Phase 0 |

Tracked changes hiện có (không phải do Phase 0 tạo):

- `index.html`
- `js/accounts.js`
- `js/core.js`
- `js/v-dieuhanh.js`
- `js/v-tieuthuong.js`
- `js/v-vanhanh.js`
- `styles.css`

Untracked hiện có:

- `BAO_CAO_TAI_KHOAN_MOCK.md`
- `FRONTEND_ARCHITECTURE_AUDIT.md`
- `XUAT_DU_LIEU_MOCK_MAC_DINH.json`
- `js/auth.js`
- `js/workflow.js`

`auth.js` và `workflow.js` thực sự chưa được Git track tại baseline, nhưng đều được `index.html` load và vì vậy là runtime dependency.

## 2. Runtime routes baseline

Toàn bộ 18 file JS runtime đã qua `node --check` không có syntax error. Environment audit không có browser/headless browser hay test runner, nên console error không thể quan sát trực tiếp; trạng thái `N/A` không đồng nghĩa “không có error”. Render được xác nhận tĩnh từ router/menu/view registration và thứ tự script.

| Route | Render tĩnh | Render implementation cuối | Console error runtime | Ghi chú |
|---|---|---|---|---|
| `#/tong-quan` | Có | `v-dieuhanh.js` `A.VIEWS['tong-quan']` | N/A | cross-market |
| `#/danh-muc-cho` | Có | `v-danhmuccho.js` | N/A | cross-market |
| `#/mat-bang` | Có | `v-tieuthuong.js:1993` | N/A | CL dùng `clLayoutView`, market khác dùng `A.mbWorkspaceHtml()` |
| `#/diem-kd` | Có/legacy | `v-tieuthuong.js:1994`, CL route redirect sang `mat-bang` | N/A | menu hidden |
| `#/tai-san` | Có | `v-taisan.js` | N/A | chỉ applicable CL |
| `#/phien-cho` | Có | `v-dieuhanh.js` | N/A | chỉ applicable TTD |
| `#/tieu-thuong` | Có | `v-tieuthuong.js` | N/A | CL/generic branch |
| `#/hop-dong` | Có | `workflow.js` wrapper trên view cuối của `v-tieuthuong.js` | N/A | thêm “Cần xử lý” |
| `#/cau-hinh-gia` | Có | `v-vanhanh.js` | N/A | pricing feature trong operations file |
| `#/tai-khoan-ngan-hang` | Có | `v-vanhanh.js` | N/A | see known issue on `SCREEN_MARKET` |
| `#/dien-nuoc` | Có | `v-taichinh.js:312` | N/A | 3 registrations cùng id |
| `#/phai-thu` | Có | `v-taichinh.js` | N/A | finance |
| `#/thu-tien` | Có | `v-taichinh.js:790` | N/A | registration cuối hiệu lực |
| `#/doi-soat` | Có | `v-taichinh.js` | N/A | finance |
| `#/cong-no` | Có | `v-taichinh.js` | N/A | finance |
| `#/su-co` | Có | `v-vanhanh.js:289` | N/A | registration cuối hiệu lực |
| `#/thong-bao` | Có | `v-vanhanh.js` | N/A | operations |
| `#/bao-cao` | Có | `v-vanhanh.js` + `v-baocao-mau.js` helpers | N/A | cross-market |
| `#/tai-khoan` | Có | `workflow.js` wrapper trên `v-vanhanh.js` | N/A | SYSTEM |
| `#/cai-dat` | Có | `v-vanhanh.js` | N/A | SYSTEM/RBAC |
| `#/mini-app` | Có | `mini.js` | N/A | trader/collector screen permission |

Router contract: `A.route()` parses `#/id`, syncs account context, maps legacy `so-do`/`cau-truc` to `mat-bang`, applies `U.can()` and `A.SCREEN_MARKET`, then calls `A.VIEWS[id]`. `auth.js` wraps both `A.route` and `A.render` to gate unauthenticated access.

## 3. Script load order and overrides

Exact `<script>` order from `index.html`:

1. `data.js`
2. `js/core.js`
3. `js/permissions.js`
4. `js/accounts.js`
5. `js/bankaccounts.js`
6. `js/serviceconfig.js`
7. `js/marketcatalog.js`
8. `js/v-dieuhanh.js`
9. `js/v-danhmuccho.js`
10. `js/v-cautruc.js`
11. `js/v-tieuthuong.js`
12. `js/vehicles.js`
13. `js/v-taichinh.js`
14. `js/v-vanhanh.js`
15. `js/v-taisan.js`
16. `js/v-baocao-mau.js`
17. `js/mini.js`
18. `js/workflow.js`
19. `js/auth.js`

Important dependency chain:

```text
DATA → core (window.APP/A) → permissions → accounts
     → catalog/config repositories → business views
     → mini → workflow decorators → auth route/render decorators
```

| Identifier | First registration | Later registrations/overrides | Effective baseline implementation |
|---|---|---|---|
| `A.VIEWS['mat-bang']` | `v-cautruc.js:765` (`mbWorkspaceHtml`) | `v-tieuthuong.js:1993` | `v-tieuthuong`: CL `clLayoutView()`, others `A.mbWorkspaceHtml()` |
| `A.VIEWS['hop-dong']` | `v-tieuthuong.js:2814` | `v-tieuthuong.js:2998`, `3013`; `workflow.js:90` wraps it | workflow task HTML + contract view version at `3013` |
| `A.VIEWS['dien-nuoc']` | `v-taichinh.js:101` | `v-taichinh.js:267`, `312` | registration at line 312 |
| `A.VIEWS['thu-tien']` | `v-taichinh.js:728` | `v-taichinh.js:790` | registration at line 790 |
| `A.VIEWS['su-co']` | `v-vanhanh.js:17` | `v-vanhanh.js:289` | registration at line 289 |
| `A.ACT['tt-new']` | `v-tieuthuong.js:2643` | `workflow.js:61` | workflow profile creation flow |
| `A.ACT['ct-new']` | `v-tieuthuong.js:2880` | `v-tieuthuong.js:3023`; `vehicles.js:173` wraps prior; `workflow.js:123` replaces it | workflow contract creation flow |

These overrides are a public runtime fact of baseline. Do not change load order or remove an apparent duplicate without characterization tests.

## 4. Data architecture and storage snapshot

```text
DATA.build()
  → core A.load()
  → A.db (from `choso-caolanh-state` when compatible; otherwise source seed)
  → A.reindex() / A.idx Maps
  → views and A.ACT/A.CH handlers read/write A.db directly
  → A.save()
  → localStorage `choso-caolanh-state`
```

Additional repositories use separate localStorage keys.

| Key | Reader | Writer | Purpose |
|---|---|---|---|
| `choso-caolanh-state` | `core.js` | `core.js:A.save` | mutable aggregate `A.db` |
| `choso-caolanh-ui` | `core.js`, `auth.js` | `core.js`, `auth.js` | selected market, demo account, session account |
| `choso-caolanh-guide` | `core.js` | `core.js` | seen-guide flag |
| `choso-caolanh-permissions` | `permissions.js` | `permissions.js` | role/permission state and migration version |
| `choso-caolanh-accounts` | `accounts.js` | `accounts.js` | mock/user-created accounts |
| `choso-caolanh-accounts-schema` | `accounts.js` | `accounts.js` | account schema marker |
| `choso-caolanh-bankaccounts` | `bankaccounts.js` | `bankaccounts.js` | bank account configuration |
| `choso-caolanh-marketcatalog` | `marketcatalog.js` | `marketcatalog.js` | market catalog configuration |
| `choso-caolanh-serviceconfig` | `serviceconfig.js` | `serviceconfig.js` | pricing/service policy configuration |
| `choso-caolanh-layout` | `v-cautruc.js` | `v-cautruc.js` | layout block/floor/zone tree |
| `prototype-demo-mode` | `auth.js` | no runtime writer found | enables old demo-account switcher when value is `true` |
| `choso-caolanh-workflow-recent-point` *(sessionStorage)* | `workflow.js` | `workflow.js` | one-session “recently assigned point” UX marker |

No `fetch`, `XMLHttpRequest`, axios, or WebSocket was found in runtime source.

## 5. Mock data snapshot

### Reference data

| Collection/source | Default count | Source |
|---|---:|---|
| Markets | 12 | `data.js: MARKETS` |
| Roles | 6 | `data.js: ROLES`; RBAC persistence seed in `permissions.js` |
| Staff | 9 | `data.js: STAFF` |
| Rate policy entries | 11 | `data.js: RATE_POLICY_SEED` |
| Bank catalog | 10 | `data.js: BANKS` |

### Mock business data (`DATA.build()`)

| Collection | Default count | Source |
|---|---:|---|
| Business points / `stalls` | 332 | `data.js` deterministic builder |
| Traders | 275 | `data.js` deterministic builder |
| Contracts | 262 | `data.js` deterministic builder |
| Invoices / receivables | 1.283 | `data.js` deterministic builder |
| Payments | 1.140 | `data.js` deterministic builder |
| Meter readings | 351 | `data.js` deterministic builder |
| Incidents | 14 | `data.js` seed |
| Market assets | 14 | `data.js` seed |
| Notifications | 6 | `data.js` seed |
| Sessions | 13 | `data.js` seed |
| Market sessions | 2 | `data.js` seed |
| Session registrations | 4 | `data.js` seed |
| Session payments / receipts | 4 / 1 | `data.js` seed |
| Bank reconciliation rows | 29 | `data.js` seed |
| Billing periods / months | 5 / 7 | `data.js` seed |
| Cash deposits / confirms | 2 / 0 | `data.js` seed |
| Point requests | 4 | `data.js` seed |
| Direct seller assignments | 254 | generated from seeded stalls |

### Demo account and runtime-generated data

| Type | Source | Notes |
|---|---|---|
| Demo accounts | `accounts.js: BASE_ACCOUNTS` then `A.ACCOUNTS` local persistence | account status/scope/trader links |
| Role/permission seed | `permissions.js` | catalog + default roles + role-permission rows |
| Runtime deterministic mock | `data.js` PRNG/build helpers and mock file metadata | stable seed, mock photos/files, session/debt/request seeds |
| Runtime user mutation | handlers across views | persisted to `A.db` or feature-specific localStorage |

## 6. RBAC baseline

Role resolution: `Account.roleIds[0]` is effective role. Market scope comes from `account.marketScopes`; scope containing `ALL` is treated as global. `A.syncAccountContext()` aligns `ui.role` and `ui.market`; `U.can()` combines screen permission and market applicability; `A.canDo()` checks action permission plus scope.

| Role | Screens chính theo default matrix | Market scope behavior |
|---|---|---|
| `system_admin` | tổng quan, danh mục chợ, mặt bằng, điểm KD, trader, contract, pricing, bank account, reports, accounts, settings | global when account contains `ALL`; market selector can choose `ALL` or scoped market |
| `ward_leader` | tổng quan, danh mục, mặt bằng, assets, points, trader, contract, pricing, bank, receivable, reconciliation, debt, incidents, reports | global supervisory scope with `ALL` in seed account |
| `market_manager` | mặt bằng, assets, points, session, trader, contract, pricing, bank, meter, receivable, payment, reconciliation, debt, incidents, notifications, reports | only concrete values from `marketScopes` |
| `collector` | mặt bằng, points, session, trader, contract, meter, receivable, payment, debt, mini-app | only concrete assigned market scope; action matrix narrows operations |
| `technician` | mặt bằng, assets, incidents | concrete market scope; incident progress action is assigned-work constrained by handler |
| `trader` | mini-app | account `traderId` is ownership boundary; mini queries own trader/stalls/contracts/invoices/incidents |

Baseline checks to preserve:

- selected market `ALL` is only valid for global account scope;
- screen permission is distinct from action permission;
- `A.SCREEN_MARKET` adds `CROSS`, `BOTH`, `CL`, `TTD`, `SYSTEM` applicability;
- mini app should filter to linked `traderId`, not name or arbitrary phone match;
- direct handler checks remain necessary; hidden menu alone is not authorization.

## 7. Auth baseline

Current top-level auth flow (`auth.js`):

```text
phone input
  → A.ACCOUNTS.byPhone() (normalized digits)
  → reject unknown or LOCKED
  → six OTP inputs; fixed mock OTP = 123456
  → completeLogin(account)
      → PENDING_ACTIVATION becomes ACTIVE + activatedAt
      → lastLoginAt updated
      → ui.sessionAccountId stored in choso-caolanh-ui
      → trader role routes to #/mini-app; others first allowed route
```

- Account statuses normalized by `A.ACCOUNTS.authStatus`: `PENDING_ACTIVATION`, `LOCKED` (also `locked`/`disabled`), otherwise `ACTIVE`.
- Refresh restores `sessionAccountId` from `choso-caolanh-ui` only when `schemaVersion === A.RBAC_SCHEMA` and account remains active.
- Logout clears session and demo account selection only; it does not remove account/trader/data localStorage.
- Avatar for linked trader uses `A.idx.trader.get(account.traderId).docFiles.avatar.dataUrl`; fallback is name initials.
- Demo switcher appears only if localStorage `prototype-demo-mode === 'true'`; otherwise normal phone/OTP login is required.
- Header uses `A.currentAccount()`, role name from `A.PERM`, dropdown profile/logout.

### Mini-app legacy auth still present

`mini.js` still renders a separate phone → trader lookup → demo OTP (`123456`) mini login UX. `workflow.js` loads after `mini.js` and replaces `A.ACT['mini-login-verify']` with a version requiring an existing linked account with literal status `active`.

**PHÁT HIỆN BASELINE ISSUE:** top-level `auth.js` writes activated account status as `ACTIVE` (uppercase) while final legacy `workflow.js` mini-login handler checks `acc.status !== 'active'` (lowercase). These are two unmerged authentication paths and must not be silently “fixed” during structural refactor; characterize intended behavior first.

## 8. Happy path regression checklist

### A. AUTH
- [ ] login with existing phone
- [ ] fixed OTP `123456`
- [ ] refresh keeps session
- [ ] logout returns to login without removing business data
- [ ] locked account is blocked

### B. MARKET SCOPE
- [ ] System administrator
- [ ] Ward leader
- [ ] Market manager
- [ ] Collector
- [ ] Technician
- [ ] Trader

### C. TRADER
- [ ] list
- [ ] search/filter
- [ ] detail
- [ ] create
- [ ] edit
- [ ] documents
- [ ] avatar

### D. MARKET LAYOUT
- [ ] block/floor/zone tree
- [ ] grid
- [ ] table
- [ ] business-point detail
- [ ] business-point status

### E. CONTRACT
- [ ] list
- [ ] “Cần xử lý” task
- [ ] create
- [ ] view
- [ ] renew
- [ ] terminate
- [ ] liquidate
- [ ] point/trader updates after contract operation

### F. FINANCE
- [ ] meter readings
- [ ] receivables
- [ ] collect payment
- [ ] receipt
- [ ] reconciliation
- [ ] debt/reminder

### G. OPERATIONS
- [ ] incident create/assign/update
- [ ] notifications
- [ ] assets

### H. ADMIN
- [ ] accounts
- [ ] roles/permissions
- [ ] market catalog
- [ ] pricing policy
- [ ] bank accounts

### I. REPORT
- [ ] dashboard
- [ ] report screen
- [ ] CSV export where available

### J. MINI APP
- [ ] own profile
- [ ] own business points
- [ ] own contracts
- [ ] own receivables/payments
- [ ] own incident/request

## 9. Public compatibility contract

The following identifiers are compatibility contracts until an explicit migration phase says otherwise.

| Contract | Baseline |
|---|---|
| Route IDs | `tong-quan`, `danh-muc-cho`, `mat-bang`, `diem-kd`, `tai-san`, `phien-cho`, `tieu-thuong`, `hop-dong`, `cau-hinh-gia`, `tai-khoan-ngan-hang`, `dien-nuoc`, `phai-thu`, `thu-tien`, `doi-soat`, `cong-no`, `su-co`, `thong-bao`, `bao-cao`, `tai-khoan`, `cai-dat`, `mini-app`; legacy aliases `so-do`, `cau-truc` |
| RBAC permission keys | `screen:<route-id>` and `action:<feature.action>` from `permissions.js: CATALOG`; preserve all current string keys |
| DOM actions | all `data-act` identifiers registered in `A.ACT`; especially `tt-new`, `ct-new`, auth, finance, layout and incident actions |
| DOM changes/input bindings | all `data-ch` and `data-in` identifiers registered in `A.CH` / `A.IN` |
| Storage keys | all keys in section 4 |
| Market IDs | `CL`, `TTD`, `HA`, `TVH`, `TTT`, `TL`, `TT`, `TTH`, `MN`, `LH`, `XB`, `SQ`; `ALL` is global selection sentinel |
| Account IDs | seeded formats include `AC-*`; workflow creates merchant account `AC-TT##` |
| Trader IDs | `TT####` convention; workflow next ID derives numeric suffix |
| Contract IDs | market contract IDs end numeric; workflow creates `HD-<market>-<number>` |
| Business point IDs | seeded `<market>-<code>`; examples such as `CL-KA-A01` are referenced directly |
| Status values | contract `hieuluc`, `chamdut`, `thanhly`; point `trong`, `thue`; account normalized statuses above; request/session/incident states must retain exact persisted strings |

## 10. Known baseline issues

1. **No browser runtime observation available in audit environment.** Static registrations and syntax are verified; console/DOM runtime needs manual browser baseline before a high-risk phase.
2. **View/action override coupling:** listed in section 3; effective behavior depends on script order.
3. **Two auth paths:** global `auth.js` and legacy mini login; final mini verify handler has case-sensitive account-status mismatch with global auth activation.
4. **`A.SCREEN_MARKET` does not explicitly list `tai-khoan-ngan-hang`.** Unknown key currently passes `A.screenMarketOk()`; make intended scope explicit only in an approved behavior phase.
5. **Two data representations affect market layout:** `A.db.stalls` and `choso-caolanh-layout`; CL also has a special renderer in `v-tieuthuong.js`.
6. **Repository documentation drift:** `README.md` says two markets while `DATA.MARKETS` currently has 12.

No baseline issue was fixed in Phase 0.
