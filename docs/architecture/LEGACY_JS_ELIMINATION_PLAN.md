# Legacy JS Elimination Plan (Phase 14 — ownership audit)

Baseline: `4a1119d refactor: establish frontend feature architecture` (clean worktree).
Scope: analysis only. No runtime file is moved, renamed, deleted or edited by this phase.

Goal: make `frontend/js/` removable by **moving each responsibility to its real owner** (`src/app`, `src/shared`, `src/features/*`, `src/mocks`) or deleting it when proven dead. Moving the 18 files unchanged into `src/` is explicitly **not** a valid outcome.

## 0. Method and evidence

| Evidence | How it was obtained |
|---|---|
| Effective registry | Headless load of the real `index.html` script order in a Node `vm` with a stub DOM, snapshotting `A.VIEWS`/`A.ACT`/`A.IN`/`A.CH` and every `A.*`, `A.U.*`, `A.ui.*` key **after each script**, then running `DOMContentLoaded`. Gives, per key, the ordered chain of files that (re)assigned it. Result: **21 views, 393 actions, 62 input handlers, 149 change handlers**. |
| Intra-file overrides | Static scan for the same `A.VIEWS[...]`/`A.ACT[...]` key assigned twice in one file (the runtime snapshot only sees per-file changes). |
| Callers | Every `A.<symbol>` exported by a legacy file was searched across all 34 runtime scripts; every handler key was searched for a literal `data-act`/`data-in`/`data-ch` renderer, a string mention, or an `A.ACT[...]()` call. |
| State / persistence | Per file: `A.db.<collection>` and local `db.<collection>` references, `push`/`unshift`/`splice` writes, `A.idx.*`, `A.save()`, `localStorage`/`sessionStorage`, storage key literals, `ui.*` and `ui.f.*` writes, module-level `let`/`var`. |
| Load-time coupling | Module-level captures (`const x = A.VIEWS[...]`, `A.ACT[...]`, `A.features.*`, `A.PERM` …) that force script order. |

Counting convention: numbers such as "db 116" are source references (comments stripped), not distinct operations.

"No literal caller" means: no `data-act="key"` in any rendered template, no string occurrence of the key other than its registration, and no `A.ACT['key']()` call. Such handlers are **candidates** only; Phase 15 must re-prove unreachability in a browser before deleting (see §7).

## 1. Current runtime composition

Script order (`frontend/index.html`) — 34 scripts:

```text
data.js → js/core.js → src/shared/data/repository.js → js/permissions.js → js/accounts.js
→ js/bankaccounts.js → js/serviceconfig.js → js/marketcatalog.js
→ src/features/{markets,traders,business-points,contracts,accounts,finance}/{repository,service}.js
→ js/v-dieuhanh.js → js/v-danhmuccho.js → js/v-cautruc.js → js/v-tieuthuong.js
→ src/features/contracts/detail.js → src/features/contracts/page.js
→ js/vehicles.js → js/v-taichinh.js → js/v-vanhanh.js → js/v-taisan.js → js/v-baocao-mau.js
→ js/mini.js → js/workflow.js → js/auth.js
```

### 1.1 Hard ordering constraints found (must survive every batch)

| Constraint | Reason (load-time capture) |
|---|---|
| `core.js` first after `data.js` | Creates `window.APP`; `A.MENU` calls `U.icon` at load; everyone reads `A.U`, `A.ui`. |
| `permissions.js` before `accounts.js` | `permissions.js` runs `loadState()` at load (reads/writes `choso-caolanh-permissions`, needs `A.RBAC_SCHEMA`); `accounts.js:30` evaluates `A.PERM.roles()` at load. |
| `src/features/*/repository+service` before `v-tieuthuong.js`, `contracts/page.js`, `workflow.js` | `v-tieuthuong.js:2023-2027`, `page.js:18`, `workflow.js:10-12` capture `A.features.*.service` at load. |
| `v-cautruc.js` before `v-tieuthuong.js` | `v-tieuthuong.js:1993` re-registers `mat-bang` (see §5, redundant). |
| `contracts/page.js` before `vehicles.js` before `workflow.js` | `vehicles.js:172-174` wraps `ct-new`/`ct-new-save`; `workflow.js:110` replaces `ct-new`; `workflow.js:88` captures `A.VIEWS['hop-dong']`. |
| `v-vanhanh.js` before `workflow.js` | `workflow.js:139` captures `A.VIEWS['tai-khoan']`. |
| `mini.js` before `workflow.js` and `auth.js` | `workflow.js` replaces `mini-login-verify`; `auth.js:118` replaces `mini-logout`. |
| `auth.js` last | Replaces `A.currentAccount`, `A.saveUi`; decorates `A.load`, `A.route`, `A.render` (captures previous values at load). |
| Lazy (runtime-only) cross-file calls | `A.WORKFLOW` (defined in `workflow.js`, read lazily by `v-tieuthuong`/`v-dieuhanh`), `A.dkTableHtml`, `A.openDkDrawer`, `A.stallPanel`, `A.mb*`, `A.pointReq`, `A.addIncident`, `A.completeSession*Payment`, `A.syncPaidSessionRegistrationsToOfficial`, `A.resetMiniRequestState`. These tolerate any order as long as all scripts load before `DOMContentLoaded`. |

### 1.2 Effective override chains (registry evidence)

| Key | Chain (load order) | Effective owner |
|---|---|---|
| `VIEWS['mat-bang']` | `v-cautruc.js` → `v-tieuthuong.js` | `v-tieuthuong.js:1993`, but its CL branch `clLayoutView()` returns `A.mbWorkspaceHtml()` (`:1286-1288`) and the non-CL branch calls the same function → **behaviourally identical to the v-cautruc registration; redundant override**. |
| `VIEWS['hop-dong']` | `page.js:50` → `page.js:65` (wrapper) → `workflow.js:89` (wrapper) | workflow wrapper = contract task + contract page |
| `VIEWS['tai-khoan']` | `v-vanhanh.js:634` → `workflow.js:140` (wrapper) | workflow wrapper = account task + accounts page |
| `ACT['tt-new']` | `v-tieuthuong.js` (legacy wizard) → `workflow.js:60` | workflow profile create |
| `ACT['ct-new']` | `page.js:75` → `vehicles.js:173` (wrapper) → `workflow.js:110` | workflow contract create |
| `ACT['ct-new-save']` | `page.js:81` → `vehicles.js:175` (wrapper) | vehicles wrapper over unreachable V1 save |
| `ACT['mini-login-verify']` | `mini.js:1074` → `workflow.js:157` | workflow (no find-or-create of account) |
| `ACT['mini-logout']` | `mini.js:1084` → `auth.js:118` | auth logout |
| `A.currentAccount`, `A.saveUi` | `core.js` → `auth.js` (full replacement; `previousSaveUi` is captured but never called) | `auth.js` |
| `A.load`, `A.route`, `A.render` | `core.js` → `auth.js` (decorators) | core body + auth guard |

Intra-file overrides (earlier body dead): `v-taichinh.js` `VIEWS['dien-nuoc']` ×3 (`:101`, `:267`, `:312` wins), `mrOpen` reassigned to `mrOpenV2` (`:305`), `ACT['mr-evidence-add'/'mr-evidence-remove']` ×2 (`:278/279` → `:323/324`), `VIEWS['thu-tien']` ×2 (`:728` → `:790`); `v-vanhanh.js` `VIEWS['su-co']` ×2 (`:17` → `:289`), `ACT['inc-open']` ×2 (`:38` → `:313`); `page.js` `VIEWS['hop-dong']` ×2 (retained wrapper, not dead).

## 2. Ownership vocabulary and target destinations

Classes (exactly one per responsibility): **APP**, **SHARED**, **FEATURE:&lt;existing&gt;**, **NEW:&lt;feature&gt;** (justified new feature), **OBSOLETE** (dead / overridden / no caller), **UNRESOLVED** (needs a business/product decision).

`src/mocks/` is a destination, not an owner: seed/demo code (account rosters, demo links, demo reset, asset seed) keeps the class of the domain it seeds and is only *placed* under `src/mocks/`. A few rows carry a split class (e.g. C25, TC02, TC06, VH01); the split is listed key by key in the row.

Existing features: `markets`, `traders`, `business-points`, `contracts`, `accounts`, `finance`.

Proposed new features — each justified by an existing route and/or its own aggregate, persistence and permission keys (no empty folders):

| New feature | Justification (existing runtime evidence) |
|---|---|
| `market-layout` | Own persisted aggregate `choso-caolanh-layout` (`LKEY`), canonical route `#/mat-bang` (AGENTS §12-13), 32 `mb-*`/`qh-*` actions, layout tree model block → floor → zone. Distinct from point records (`A.db.stalls`). |
| `fee-config` | Own store `choso-caolanh-serviceconfig` (`A.SERVICE_CFG`), route `cau-hinh-gia`, QĐ 480 price data (AGENTS §18-19 single fee configuration source), billing cycle/rules panels. |
| `complaints` | Route `su-co`, collection `incidents`, complaint workflow (AGENTS §29-30), `A.addIncident` used by Mini App. |
| `notifications` | Route `thong-bao`, collection `notifications` written by finance, sessions, contracts (expiry) and mini. |
| `reports` | Routes `tong-quan`, `bao-cao`; read-only cross-market aggregation (AGENTS §31) + state report forms (`v-baocao-mau.js`). |
| `market-sessions` | Route `phien-cho`, 8 session collections (`sessions`, `marketSessions`, `sessionRegistrations`, `sessionPayments`, `sessionReceipts`, `sessionAttendances`, `sessionReplacements`, `sessionNotifications`), 33 actions, dedicated permission migrations (`migratePc3*`). Scope note in §8. |
| `assets` | Route `tai-san`, collection `marketAssets`, self-contained. Scope note in §8. |
| `access-control` | Role CRUD + permission matrix UI (`cai-dat` › *Vai trò & phân quyền*, `role-*`, `perm-*`), distinct from account records and from the RBAC engine in `shared/authz`. |
| `trader-portal` | Route `mini-app` (Merchant/Citizen self-service, AGENTS §10.5) + collector mobile collection screen. UI shell only; every write must call the owning feature's use case. |
| ~~`point-changes`~~ | **Not created** — §8 Q1 resolved as DROP. |

Rejected on purpose: no `features/workflow` (each `workflow.js` use case has a domain owner, §4.18), no `features/settings` (the `cai-dat` screen is a tab host → APP; panels belong to features), no `features/dashboard` (joins `reports`), no `features/vehicles` (trader sub-resource → `traders`), no `features/bank-accounts` (finance configuration → `finance`).

## 3. Summary by file

| # | File | Lines | Views (effective) | ACT/IN/CH (effective) | `A.save` | Storage | Verdict |
|---:|---|---:|---|---|---:|---|---|
| 1 | `core.js` | 897 | — | 11 / 0 / 1 | 3 | `choso-caolanh-state`, `-ui`, `-guide` | **Decompose** → app, shared (utils/ui/data/authz), finance, business-points, fee-config, markets, accounts, mocks |
| 2 | `permissions.js` | 691 | — | — | 0 | `choso-caolanh-permissions` | **Move whole** → `shared/authz` |
| 3 | `accounts.js` | 277 | — | — | 0 | `choso-caolanh-accounts`, `-accounts-schema` | **Decompose** → accounts store + mocks seed |
| 4 | `bankaccounts.js` | 94 | — | — | 0 | `choso-caolanh-bankaccounts` | **Move whole** → finance/bank-accounts |
| 5 | `serviceconfig.js` | 147 | — | — | 0 | `choso-caolanh-serviceconfig` | **Move whole** → fee-config |
| 6 | `marketcatalog.js` | 185 | — | — | 0 | `choso-caolanh-marketcatalog` | **Move whole** → markets |
| 7 | `v-dieuhanh.js` | 2,071 | `tong-quan`, `phien-cho` | 35 / 1 / 1 | 7 | — | **Decompose** → reports, market-layout, business-points, market-sessions |
| 8 | `v-danhmuccho.js` | 154 | `danh-muc-cho` | 7 / 1 / 2 | 0 | — | **Move whole** → markets |
| 9 | `v-cautruc.js` | 767 | (`mat-bang`, overridden by identical) | 32 / 1 / 5 | 2 | `choso-caolanh-layout` | **Move (critical)** → market-layout (+ collector assignment → business-points) |
| 10 | `v-tieuthuong.js` | 2,810 | `mat-bang`\*, `diem-kd`, `tieu-thuong` | 96 / 36 / 39 | 22 | — | **Decompose** → business-points, traders, point-changes/obsolete, contracts remnants |
| 11 | `vehicles.js` | 189 | — | 7 / 0 / 0 | 4 | — | **Decompose** → traders + obsolete |
| 12 | `v-taichinh.js` | 1,452 | `dien-nuoc`, `phai-thu`, `thu-tien`, `doi-soat`, `cong-no` | 48 / 8 / 18 | 17 | — | **Decompose inside finance** (+ session-cash boundary) |
| 13 | `v-vanhanh.js` | 1,712 | `su-co`, `thong-bao`, `bao-cao`, `cau-hinh-gia`, `tai-khoan-ngan-hang`, `cai-dat` (+ base `tai-khoan`) | 71 / 2 / 77 | 10 | — | **Decompose** → complaints, notifications, reports, accounts, access-control, fee-config, finance, app |
| 14 | `v-taisan.js` | 115 | `tai-san` | 6 / 0 / 1 | 2 | — | **Move whole** → assets |
| 15 | `v-baocao-mau.js` | 130 | — | — | 0 | — | **Move whole** → reports |
| 16 | `mini.js` | 1,334 | `mini-app` | 36 / 7 / 3 | 8 | — | **Decompose** → trader-portal shell + market-sessions, finance, complaints, point-changes |
| 17 | `workflow.js` | 166 | wrappers `hop-dong`, `tai-khoan` | 14 / 5 / 1 | 2 | session `choso-caolanh-workflow-recent-point` | **Decompose** → traders, contracts, accounts, trader-portal |
| 18 | `auth.js` | 120 | — | 8 / 0 / 0 | 0 | `prototype-demo-mode`, `choso-caolanh-ui` | **Move whole** → `app/auth` |

\* redundant override (§1.2).

Remaining effective registrations owned by `src/` today: `contracts/page.js` 22 ACT / 1 IN / 1 CH.

## 4. Per-file analysis

Each file lists responsibilities with an ID, the classification and the destination. The block after the table gives the required fields.

### 4.1 `js/core.js` (897 lines)

| ID | Responsibility (lines) | Key symbols | Class | Destination |
|---|---|---|---|---|
| C01 | Namespace + UI state defaults (`:2-50`) | `window.APP`, `A.D`, `A.db/idx/current` slots, `A.ui` defaults, `A.RBAC_SCHEMA`, `A.VIEWS/ACT/IN/CH` registries, `A.$` | APP | `src/app/state.js` |
| C02 | Pure formatters (`:54-73`, `U.nowTime`) | `U.pad esc money moneyShort pct pctTxt dmy per days sum maskPhone maskId nowTime` | SHARED | `src/shared/utils/format.js` |
| C03 | Icon set (`:76-83`) | `ICON_PATHS`, `U.icon` | SHARED | `src/shared/ui/icons.js` |
| C04 | Market lookup (`:84-85`) | `U.market`, `U.mShort` (read `D.MARKETS`) | FEATURE:markets | `features/markets/format.js` |
| C05 | Market-context filters (`:90-94`) | `U.inM`, `U.inScope` (read `ui.market`) | APP | `src/app/session.js` |
| C06 | Staff name lookup (`:95`) | `U.staffName` (reads `D.STAFF`) | FEATURE:accounts | `features/accounts/format.js` |
| C07 | Business-point labels (`:96-121`, `U.statusTag`) | `U.typeLabel areaTypeLabel AREA_TYPE_CODES rentalKind rentalLabel statusTag` | FEATURE:business-points | `features/business-points/format.js` |
| C08 | Applied price lookup (`:103-117`) | `U.appliedStallPrice`, `U.unitLabel` (read `A.SERVICE_CFG`) | NEW:fee-config | `features/fee-config/service.js` |
| C09 | Mock clock (`U.today` → `A.db.today`) | `U.today` | SHARED | `src/shared/utils/clock.js` (reads data store) |
| C10 | Invoice/debt helpers | `U.due isOver overDays invTag traderDebt traderOverdue` | FEATURE:finance | `features/finance/format.js` + `service.js` |
| C11 | Screen/action authorization (`:130-150`) | `U.can`, `A.canDo` | SHARED | `src/shared/authz/guards.js` |
| C12 | Collection-channel policy (`:151-157`) | `A.canDirectCollect`, `A.canCollectReceivable` (hard-coded `'TTD'`/`'CL'`) | FEATURE:finance | `features/finance/policy.js` (legacy two-market rule preserved; §8 Q7) |
| C13 | Table/pager/CSV/toast/QR/charts (`:158-236`) | `U.pager table csv toast qr bars donut` | SHARED | `src/shared/ui/{table,csv,toast,qr,charts}.js` |
| C14 | Audit log writer (`U.log`) | writes `A.db.extraLog` | SHARED | `src/shared/data/audit.js` |
| C15 | Data store (`:238-247`, `:329-332`, `:344-366` data part) | `KEY='choso-caolanh-state'`, `A.reindex`, `A.save`, `A.fresh`, `A.load` (db part + `areaType` migration) | SHARED | `src/shared/data/store.js` |
| C16 | Point status derived from overdue debt (`:243-246`) | `A.refreshStall` (writes `stall.status` `thue`↔`no`) | FEATURE:finance | finance → business-points use case `businessPoints.service.syncDebtStatus` (behaviour unchanged; AGENTS §15/§35 note in §8 Q8) |
| C17 | Session context (`:249-313`, `:329`, UI part of `A.load`) | `A.currentAccount` (**overridden** by auth), `A.allowedMarkets`, `A.syncAccountContext`, `A.xmMarket`, `A.marketSelectOptionsHtml`, `A.saveUi` (**overridden** by auth), `UIKEY` | APP | `src/app/session.js` (single implementation = auth version) |
| C18 | Screen/market applicability (`:260-275`) | `A.SCREEN_MARKET`, `A.screenMarketOk`, `A.marketRequiredHtml` | APP | `src/app/router.js` |
| C19 | Demo link repair (`:333-343`) | `A.ensureMiniAppDemoLink` (writes account store) | FEATURE:accounts | `src/mocks/demo-links.js` |
| C20 | Payment application (`:368-410`) | `A.applyPayment` (writes `invoices`, `payments`, `bank`; calls `refreshStall`; saves) | FEATURE:finance | `features/finance/collection/service.js` |
| C21 | Modal + drawer stack (`:412-428`) | `A.modal closeModal mHead drawerPush drawerReset drawerBack drawerBackHtml`, `drawerStack` | SHARED | `src/shared/ui/{modal,drawer}.js` |
| C22 | Receipt validity + rendering (`:430-500`) | `receipt*` helpers, `A.receiptBusinessStateOk`, `A.receiptHtml`, `A.showReceipt` | FEATURE:finance | `features/finance/receipts.js` |
| C23 | Menu + shell (`:573-735`) | `A.MENU` (badges read contracts, bank, incidents), `A.menuItem`, demo account bar, `chrome()`, `A.render`, `A.firstAccessibleScreen` | APP | `src/app/{menu,shell}.js` (badge functions supplied by owning features) |
| C24 | Router (`:757-807`) | `A.route` (legacy redirects `so-do`/`cau-truc`/`diem-kd` → `mat-bang`), `A.go` | APP | `src/app/router.js` |
| C25 | Core actions (`:810-856`) | ACT `overlay close print menu demo-account market go guide` + CH `market-select` → APP; `page` → shared/ui/table; `drawer-back` → shared/ui/drawer; `receipt` → finance | APP / SHARED / FEATURE:finance | split as listed |
| C26 | Guide + bootstrap + reset (`:857-896`) | `A.guide`, `init()` (event delegation, hashchange, first-visit guide, `GUIDEKEY`), `A.resetAll` | APP | `src/app/{guide,bootstrap}.js`, `src/mocks/reset.js` |

- **Exported globals**: `window.APP`; 45 `A.*` members first defined here (5 of them — `currentAccount`, `saveUi`, `load`, `route`, `render` — are later replaced or decorated by `auth.js`); 43 `A.U.*` helpers; 21 `A.ui.*` defaults.
- **A.VIEWS**: none. **A.ACT**: `overlay, close, print, menu, demo-account, market, page, go, receipt, guide, drawer-back`. **A.CH**: `market-select`.
- **Local mutable state**: `drawerStack`.
- **Persistence**: `localStorage` ×7 (`KEY`, `UIKEY`, `GUIDEKEY`); `A.save` ×3 (`applyPayment`, `showReceipt` autoPrint, `A.load` areaType migration); writes `extraLog`, `payments`, `bank`, `invoices`, `stalls.status`; reads `sessionPayments`, `sessionReceipts`, `marketSessions`, `sessionRegistrations` (receipts).
- **Callers**: every runtime file (see static dependents: all 17 other legacy files, `data.js`, `shared/data/repository.js`, `contracts/page.js`, `contracts/detail.js`).
- **Depends on**: `A.PERM`, `A.ACCOUNTS`, `A.SERVICE_CFG`, `A.resetMiniRequestState` (mini), auth decorators.
- **Target**: decomposition as per table. Nothing of core.js stays as a file.
- **Safe to move?** Not as a whole. C02/C03/C13/C21 are safe first (pure, no state), provided they load **before** the remaining core (MENU uses `U.icon` at load). C15/C17/C23/C24 last.
- **Prerequisites**: C01 extracted first so all later scripts can attach to `window.APP` in any order; `auth.js` decorators folded into `app/session.js` + `app/router.js` in the same batch as C17/C24.
- **Deletion criteria**: every C-row moved; `grep -r "js/core.js" frontend/index.html` empty; registry equal; `A.U` key set identical (43 keys) and `A.*` key set identical.

### 4.2 `js/permissions.js` (691 lines)

| ID | Responsibility | Class | Destination |
|---|---|---|---|
| P01 | Permission catalog (`CATALOG`), 6-role seed (`defaultRoles`, `defaultRolePermissions`) | SHARED | `src/shared/authz/catalog.js` |
| P02 | Versioned migrations (`migrateFeeLifecyclePerms`, `migrateRatePolicyPerms`, `migrateBankAccountPerms`, `migratePc3*`, `migrateMatBangScreen`, `mergeIntoCurrentSeed`) | SHARED | `src/shared/authz/migrations.js` |
| P03 | Store `loadState/saveState` (`PKEY='choso-caolanh-permissions'`, `STATE`) | SHARED | `src/shared/authz/store.js` |
| P04 | API `A.PERM` (role/permission queries, `canScreen`, `canAction`, grant/revoke, role CRUD) | SHARED | `src/shared/authz/permissions.js` |

- **Exported**: `A.PERM`. **Views/actions**: none. **State**: `STATE`. **Persistence**: 4 `localStorage` calls, key `choso-caolanh-permissions`; runs at load.
- **Callers**: core (`U.can`, demo bar), accounts, v-tieuthuong, v-vanhanh (role UI), mini, auth.
- **Target**: `src/shared/authz/` (one to four files; content unchanged). **Safe**: yes, if it keeps the slot after `A.RBAC_SCHEMA` and before the accounts store.
- **Deletion criteria**: file removed from `index.html`; `choso-caolanh-permissions` written byte-identical on fresh load and on upgrade from a stored v3/v4 state; RBAC allowed/denied role checks per AGENTS §55.

### 4.3 `js/accounts.js` (277 lines)

| ID | Responsibility | Class | Destination |
|---|---|---|---|
| AC01 | Account store: `loadAccounts/saveAccounts`, schema gate (`AKEY`, `ASCHEMA_KEY`), `A.ACCOUNTS` API (`get list add update setStatus byTraderId primaryRole scopeType authStatus …`) | FEATURE:accounts | `features/accounts/store.js` |
| AC02 | Seed rosters (`defaultStaffAccounts`, `newMarketAccounts`, `NEW_MARKET_ROSTER`, `RETIRED_SEED_ACCOUNT_IDS`, `mergeNewDefaultAccounts`, `mergeSeedAccounts`) | FEATURE:accounts | `src/mocks/accounts.seed.js` (consumed by the store) |
| AC03 | Trader link repair (`ensureTraderIdField`, reads `A.db.traders` ×3) | FEATURE:accounts | `features/accounts/store.js` |
| AC04 | `APP.data.registerSource('accounts', …)` | FEATURE:accounts | disappears once the repository reads the store directly |

- **Exported**: `A.ACCOUNTS`. **State**: `ACCOUNTS`. **Persistence**: `localStorage` ×8.
- **Callers**: core, marketcatalog, v-cautruc (collector list), v-tieuthuong, v-vanhanh, mini, auth, `features/accounts/repository.js`.
- **Safe**: yes after `shared/authz` (needs `A.PERM` at load). **Deletion**: account store bytes identical on fresh load and after schema upgrade; `A.ACCOUNTS` method set identical.

### 4.4 `js/bankaccounts.js` (94 lines)

| ID | Responsibility | Class | Destination |
|---|---|---|---|
| BA01 | Bank-account store `A.BANK_ACCOUNTS` (`BKEY`, `LIST`, `seq`, seed from `D`) | FEATURE:finance | `features/finance/bank-accounts/store.js` |

- **Callers**: only `v-vanhanh.js` (`tai-khoan-ngan-hang` view). **Safe**: yes. **Deletion**: page moved with it (batch 15.7).

### 4.5 `js/serviceconfig.js` (147 lines)

| ID | Responsibility | Class | Destination |
|---|---|---|---|
| SC01 | Fee configuration store `A.SERVICE_CFG` (`SKEY`, `CFG`, normalize/seed from `D.RATE_POLICY_SEED`, cycle/rules/legal basis) | NEW:fee-config | `features/fee-config/store.js` |

- **Callers**: core (`U.appliedStallPrice`), v-dieuhanh (session pricing), vehicles, v-vanhanh (fee screen), mini. **Safe**: yes. **Deletion**: `choso-caolanh-serviceconfig` identical; fee screen + applied prices equal.

### 4.6 `js/marketcatalog.js` (185 lines)

| ID | Responsibility | Class | Destination |
|---|---|---|---|
| MC01 | Market catalog store `A.MARKET_CATALOG` (`CKEY`, merge of `D.MARKETS` + meta, `RANKS`, `STATUS`, `PRICE_CONFIGS`) + `registerSource('market-catalog')` | FEATURE:markets | `features/markets/store.js` |

- **Callers**: only `features/markets/repository.js` (via source). **Safe**: yes. **Deletion**: markets page equal; `choso-caolanh-marketcatalog` identical.

### 4.7 `js/v-dieuhanh.js` (2,071 lines)

| ID | Responsibility (lines) | Class | Destination |
|---|---|---|---|
| DH01 | Session domain model (`:1-1023`): constants `SESSION_STATUS/TRANSITIONS/…`, `normalizeSession`, `ensureTtdSessions`, registration/attendance/replacement read models, snapshots + `run*Mutation`, `applySessionMutation`, `syncOpenSessionToMiniApp` | NEW:market-sessions | `features/market-sessions/{model,service}.js` |
| DH02 | Dashboard aggregates (`:1024-1049`) `marketStats` + unused export `A.marketStats` | NEW:reports | `features/reports/dashboard.js` (`A.marketStats` export → OBSOLETE: definition is its only reference) |
| DH03 | Revenue series + `VIEWS['tong-quan']` (`:1050-1149`) | NEW:reports | `features/reports/dashboard.js` |
| DH04 | Layout point resolvers (`:1150-1256`) `A.mbResolveZoneContext`, `A.mbBusinessPointsForZone/ForMarket/ById`, `A.mbMarketStats`; `A.mbZoneStats` (unused export) | NEW:market-layout | `features/market-layout/points.js` (reads business-points service); `A.mbZoneStats` → OBSOLETE |
| DH05 | Diagram rendering (`:1257-1360`) `A.mbOverviewHtml/BlockHtml/FloorHtml/ZoneDiagramHtml` + `mb*` helpers | NEW:market-layout | `features/market-layout/diagram.js` |
| DH06 | Point quick panels (`:1361-1461`) `A.stallPanel`, `mbStallPanelCL`, `mbOpenStallDrawer` | FEATURE:business-points | `features/business-points/panel.js` |
| DH07 | Diagram actions (`:1462-1487`) `legend`, `stall`, `mb-open-trader`, `mb-open-diemkd`; IN `plan-search` | NEW:market-layout | `features/market-layout/page.js` |
| DH08 | Point status change (`:1488-1510`) `stall-status`, `stall-status-save` (writes `stalls.status/history`, `refreshStall`, `U.log`, save) | FEATURE:business-points | `features/business-points/status.js` + service `changeStatus` |
| DH09 | Session page (`:1513-1634`) `VIEWS['phien-cho']`, CH `session-date-filter` | NEW:market-sessions | `features/market-sessions/page.js` |
| DH10 | Session actions (`:1635-2070`) 29 keys `session-*`, `reg-*`, `attendance-*`, `replacement-*` | NEW:market-sessions | `features/market-sessions/page.js` + service |

- **Exported**: `A.marketStats`, `A.mbResolveZoneContext`, `A.mbBusinessPointsForZone`, `A.mbBusinessPointById`, `A.mbBusinessPointsForMarket`, `A.mbMarketStats`, `A.mbZoneStats`, `A.mbOverviewHtml`, `A.mbBlockHtml`, `A.mbFloorHtml`, `A.mbZoneDiagramHtml`, `A.stallPanel`.
- **A.VIEWS**: `tong-quan`, `phien-cho`. **A.ACT (35)**: `legend stall mb-open-trader mb-open-diemkd stall-status stall-status-save` + 29 session keys. **IN** `plan-search`; **CH** `session-date-filter`.
- **Local state**: none at module level; `ui.sel`, `ui.planSearch`, `ui.sessionDateFilter`, `ui.sessionFocusId`, `ui.sessionAttendanceTab`, `ui.sessionRegistrationTab`.
- **Persistence**: `A.save` ×7; writes `sessions`, `marketSessions`, `sessionNotifications`, `notifications`, `extraLog`, `stalls` (status); reads nearly every collection (dashboard).
- **Callers**: `v-cautruc.js` (`mbBusinessPointsForZone/ForMarket`, `mbMarketStats`, diagram HTML ×4), `v-tieuthuong.js` (`stallPanel`). Depends on `v-cautruc` (`mbMatchesFilter`, `mbZoneCollectorLabel`), `v-tieuthuong` (`openDkDrawer`, `openTraderDrawer`), mini (`syncPaidSessionRegistrationsToOfficial`), `A.WORKFLOW`.
- **Safe**: per group. DH02/DH03 safe (read-only). DH04-DH07 only together with `v-cautruc.js` (they are one layout rendering pipeline split over two files). DH01/DH09/DH10 together with the mini session use cases (MI03).
- **Deletion criteria**: all four groups moved; `tong-quan`, `phien-cho`, `mat-bang` HTML equal per market; session action replay equal.

### 4.8 `js/v-danhmuccho.js` (154 lines)

| ID | Responsibility | Class | Destination |
|---|---|---|---|
| DM01 | `VIEWS['danh-muc-cho']`, detail drawer, price modal, create/edit form; ACT `dmc-reset dmc-csv dmc-open dmc-price dmc-new dmc-edit dmc-save`, IN `dmc-search`, CH `dmc-rank dmc-status`; `ui.dmcFilter` | FEATURE:markets | `features/markets/page.js` |

- Already uses `A.features.markets` only. **Safe**: yes. **Deletion**: markets page equal; RBAC `danh-muc-cho.*` allowed/denied.

### 4.9 `js/v-cautruc.js` (767 lines) — critical

| ID | Responsibility (lines) | Class | Destination |
|---|---|---|---|
| CT01 | Layout store (`:29-65`) `defaultLayout`, `loadLayout`, `saveLayout`, `LKEY='choso-caolanh-layout'`, `LAYOUT`, `seq` | NEW:market-layout | `features/market-layout/store.js` (authoritative layout source, AGENTS §12) |
| CT02 | Layout queries/validation (`:66-116`) `blocksOf findBlock floorsOfBlock findZone flatZones codeTaken marketLayoutStats validateZone …` | NEW:market-layout | `features/market-layout/repository.js` |
| CT03 | Workspace UI state (`:117-141`) `ui.qh`, `ui.mb` (view grid/table, selection, filter) | NEW:market-layout | `features/market-layout/state.js` |
| CT04 | Shared point-set API (`:142-202`) `A.mbSelectedStalls`, `A.mbSelectedLevel`, `A.mbPositionColumnVisibility`, `A.mbLayoutPathForPoint`, `A.mbMatchesFilter`, `A.mbCurrentPoints`, `A.mbCatOptions` | NEW:market-layout | `features/market-layout/service.js` (consumed by business-points table and traders drawer through the service, not `A.*`) |
| CT05 | Collector labels (`:203-229`) `mbCollectorAccounts`, `mbZoneCollectorId`, `A.mbZoneCollectorLabel` | FEATURE:business-points | derived query `businessPoints.service.collectorLabelForPoints` (reads accounts service) |
| CT06 | Tree, crumbs, zone drawer, view switcher, generic table, workspace (`:230-497`) `mbTreeHtml`, `qhZoneDrawerHtml`, `qhSyncDrawer`, `mbRightHtml`, `mbGenericTableHtml`, `mbWorkspaceHtml` | NEW:market-layout | `features/market-layout/page.js` (`mbGenericTableHtml` → business-points table for non-CL) |
| CT07 | Layout actions (`:498-735`) `mb-sel-* mb-toggle-* mb-view mb-filter-* qh-*`, IN `mb-filter-search`, CH `qh-zone-field qh-pt-field mb-filter-cat mb-filter-area-type` | NEW:market-layout | `features/market-layout/page.js` |
| CT08 | Collector bulk assignment (`:736-755`) CH `qh-zone-collector` — writes `collectorId` on every point of the zone, `A.save()` | FEATURE:business-points | use case `businessPoints.service.assignCollector(pointIds, collectorId)`; UI section stays in the layout zone drawer (AGENTS §17) |
| CT09 | `VIEWS['mat-bang']` + `A.mbWorkspaceHtml` (`:764-765`) | NEW:market-layout | single registration in `features/market-layout/page.js` |

- **Exported**: `A.mbSelectedStalls`, `A.mbSelectedLevel`, `A.mbPositionColumnVisibility`, `A.mbLayoutPathForPoint`, `A.mbMatchesFilter`, `A.mbCurrentPoints`, `A.mbCatOptions`, `A.mbZoneCollectorLabel`, `A.mbWorkspaceHtml`; `ui.qh`, `ui.mb`.
- **A.ACT (32)**: `mb-sel-zone mb-sel-block mb-sel-floor mb-sel-overview mb-toggle-node mb-toggle-tree mb-view mb-filter-status mb-filter-clear qh-zone-edit-open qh-reset qh-reset-ok qh-add-block qh-add-block-save qh-edit-block qh-edit-block-save qh-del-block qh-del-block-ok qh-add-floor qh-add-floor-save qh-edit-floor qh-edit-floor-save qh-del-floor qh-del-floor-ok qh-add-zone qh-add-zone-save qh-del-zone qh-del-zone-ok qh-pt-add qh-pt-del qh-save-draft qh-save-final`. IN 1, CH 5.
- **State**: `LAYOUT`, `seq`. **Persistence**: `localStorage` ×2 (`LKEY`), `A.save` ×2 (collector writes on `stalls`).
- **Callers**: v-dieuhanh (`mbMatchesFilter`, `mbZoneCollectorLabel`), v-tieuthuong (5 symbols). Depends on v-dieuhanh diagram (DH04-DH05) and `A.dkTableHtml` (v-tieuthuong).
- **Safe**: only as one batch with DH04-DH07 and the redundant `mat-bang` override removal (TT13). Never create a second layout store.
- **Deletion criteria**: `choso-caolanh-layout` read/write identical (including legacy stored layouts); tree/zone/floor/block/overview HTML equal for CL, TTD and a 10-market catalogue entry without layout; legacy hashes `#/so-do`, `#/cau-truc`, `#/diem-kd` still land on `#/mat-bang`; RBAC `mat-bang.*` allowed/denied.

### 4.10 `js/v-tieuthuong.js` (2,810 lines)

Separated as requested: business-point UI, point-change workflows, trader UI, contract remnants, shared local state/helpers.

**Business-point UI**

| ID | Responsibility (lines) | Class | Destination |
|---|---|---|---|
| TT01 | CL point table (`:9-95`) `dkSeller`, `dkRowsCL`, `dkViewCL`, `A.dkTableHtml`; ACT `dkcl-clear dkcl-csv` | FEATURE:business-points | `features/business-points/table.js` |
| TT02 | CL point drawer (`:96-289`) detail tabs, history, contract tab (read), `A.openDkDrawer`; ACT `dkdetail-tab dkdetail-seller`, `dk-open`, `dkcl-open-trader` | FEATURE:business-points | `features/business-points/drawer.js` |
| TT03 | Point edit (`:290-339`) `dkEditHtmlCL`; ACT `dkcl-edit-open dkcl-edit-cancel dkcl-edit-save` (writes stall fields + history) | FEATURE:business-points | `drawer.js` + service `updateInfo` |
| TT04 | Direct seller (`:125-160`, `:340-376`) `dkDirectSeller*`; ACT `dkds-open dkds-cancel dkds-save dkds-verify-open dkds-verify-save`; IN `dkds-*` ×6; CH `dkds-kind` (writes `directSellerAssignments`) | FEATURE:business-points | `features/business-points/direct-sellers.js` + repository for `directSellerAssignments` |
| TT05 | Point-type conversion (`:377-397`) ACT `dkcl-convert-open`, `dkcl-convert-save` | OBSOLETE | no literal caller for `dkcl-convert-open`; `-save` only rendered by it |
| TT06 | Merge prototype (`:398-434`) ACT `dkcl-merge-open`, `dkcl-merge-save`, `dkmerge-view-point` | OBSOLETE | no literal caller for `dkcl-merge-open` |
| TT07 | Generic (non-CL) table (`:1960-1992`) `dkRows`, `dkLine`, `dkViewGeneric`; CH `dk-section dk-status`; IN `dk-search`; ACT `dk-csv` | FEATURE:business-points | `table.js` (merged with `mbGenericTableHtml`, see CT06) |
| TT08 | `VIEWS['diem-kd']` (`:1994`) — CL redirects to `mat-bang` in router; non-CL renders generic table | FEATURE:business-points | `features/business-points/page.js` |

**Point-change workflows (split / merge / relocation)**

| ID | Responsibility (lines) | Class | Destination |
|---|---|---|---|
| TT09 | Split request workflow (`:435-1290`): `dkReq*`, `dksr*`, `dkma*`, plan/timeline/detail; ACT `dksr-*`, `dkma-*`, `dkreq-*`, `dkplan-file-*`, `cl-req-open`; IN/CH `dkrp-*`, `dkreq-*`, `dksr-point`, `dkma-*` (writes `pointRequests`, `stalls` on execute) | UNRESOLVED | `point-changes` or delete (§8 Q1). Entry actions `dksr-open`, `dkma-*` open only via no-caller paths; `cl-req-open` is called only from save handlers of those paths; `dkreq-open` is rendered only by `dkRequestsViewCL()` opened by `cl-req-open`. |
| TT10 | `A.pointReq` API (`:1291-1313`, `:1955-1958`) `find nextId ACTIVE_STATUSES isActive activeFor stepStates convertTargetCandidates convertActiveConflict` | UNRESOLVED | consumed by reachable Mini App submissions (MI05); owner = `point-changes` if kept |
| TT11 | Merge workflow (`:1314-1353`) ACT `dkmerge-*`, IN/CH `dkmerge-*` | UNRESOLVED | entry `dkmerge-open` has no literal caller |
| TT12 | Relocation workflow (`:1354-1954`) ACT `dkconvert-*`, `dkcv-*`, `dkcva-*`, postcheck; IN/CH `dkcv-*`, `dkcva-*` | UNRESOLVED | entry `dkconvert-open` has no literal caller |

**Route composition**

| ID | Responsibility | Class | Destination |
|---|---|---|---|
| TT13 | `VIEWS['mat-bang']` re-registration (`:1993`) + `clLayoutView` (`:1286`) | OBSOLETE | behaviour-identical to CT09; remove when market-layout owns the route |

**Trader UI**

| ID | Responsibility (lines) | Class | Destination |
|---|---|---|---|
| TT14 | Document definitions + file helpers (`:2028-2075`) `TT_DOCS`/`A.ttDocDefs`, `ttCaptureFile`, `ttDocLabel`, `ttFileCanPreview`, `ttFileMetaLabel`, `ttFileViewHtml` | FEATURE:traders | `features/traders/documents.js` |
| TT15 | Point usage store (`ttUsageStore`, `ttActiveUsage`, `ttUsageFor`, `ttUsageStart`; lazily creates `A.db.pointUsages`) | FEATURE:business-points | repository `pointUsages` (occupancy records); trader drawer reads via service. Lazy creation on read must be preserved or turned into an explicit migration. |
| TT16 | Trader list/filter (`:2076-2217`) `ttPointPath`, `ttSectionsOf`, `ttCatsOf`, `ttProfileStatus*`, `ttLinkedAccount`, `ttMiniApp*`, `ttRowsCL`, `ttViewCL`, `ttRows`, `ttViewGeneric`, `VIEWS['tieu-thuong']`; IN `ttcl-search tt-search`; CH `ttcl-section ttcl-floor ttcl-cat ttcl-app tt-app`; ACT `ttcl-clear`, `trader` | FEATURE:traders | `features/traders/page.js` (`ttcl-app` has no literal renderer → verify) |
| TT17 | Trader drawer CL (`:2218-2510`) `ttDrawerHtmlCL`, `ttSectionA*`, `ttPointCardHtml`, `ttDocRow*`, `A.openTraderDrawer`; ACT `tt-doc-view tt-doc-replace tt-edit-open tt-edit-cancel tt-edit-save`, `tt-open-congno` | FEATURE:traders | `features/traders/drawer.js` |
| TT18 | Legacy drawer + Mini App section (`ttDrawerHtmlLegacy`, `ttMiniAppSectionHtml`; ACT `tt-miniapp-toggle`, `tt-miniapp-copy-guide`) | OBSOLETE | `ttDrawerHtmlLegacy` has no caller; its buttons are the only renderers of the two actions (already listed as product debt in `FRONTEND_FINAL_ARCHITECTURE.md` §12) |
| TT19 | Unrendered drawer actions `tt-placement-view`, `tt-seller-view`, `tt-open-contract`, `tt-open-point` | OBSOLETE | no literal caller (comments reference them; renderers were removed) |
| TT20 | Linked account find-or-create (`:2511-2532`) `ttNextAccountId`, `ttCreateLinkedAccount`, `A.createLinkedTraderAccount` | OBSOLETE | only caller is `mini.js:1079` inside `mini-login-verify`, which is overridden by `workflow.js` |
| TT21 | Legacy trader wizard (`:2533-2776`) `ttWizard*`, `ttUsageWizard*`, `ttSingleFormHtml`; ACT `tt-wizard-*`, `ttw-*` (18 IN/CH), `tt-wizard-save` (writes traders, `pointUsages`, `directSellerAssignments`, vehicles) | UNRESOLVED | entry `tt-new` overridden by `workflow.js`; product decision already open (§8 Q2) |

**Contract remnants and shared state**

| ID | Responsibility | Class | Destination |
|---|---|---|---|
| TT22 | Contract reads inside drawers (`CS.listByTrader`, point contract tab) | FEATURE:contracts | via `contracts.service` (already); UI stays in traders/business-points drawers |
| TT23 | `tt-open-contract` writes `ui.contractTab`, `f.hdSearch` to deep-link the contract screen | OBSOLETE | no literal caller (TT19) |
| TT24 | Module-level mutable state: point `dkEditId dkDirectSellerPointId dkDirectSellerDraft dkDetailActiveTab dkDetailPointId`; point-change `dkPlanMode dkPlanDraft dkReqPlanEditId dkReqRejectId dkRejectReasonDraft dkAssignDraft dkMergeDraft dkMergePlanEditId dkcvMode dkcvDraft dkcvPlanEditId dkcvAssignDraft dkcvPostCheckEditId dkcvPostCheckDraft`; trader `ttEditId ttPendingDocs ttWizardDraft`; `ui.f` keys `dk*`, `dkreq*`, `tt*`, `ttcl*`, `hdSearch` | split per owner | each variable moves with its owner (point → business-points, `dk(req|cv|merge|plan|ma|sr)*` → point-changes, `tt*` → traders, `ttWizardDraft` → obsolete wizard) |

- **Exported**: `A.dkTableHtml`, `A.openDkDrawer`, `A.pointReq`, `A.ttDocDefs`, `A.openTraderDrawer`, `A.createLinkedTraderAccount`.
- **A.VIEWS**: `mat-bang` (redundant), `diem-kd`, `tieu-thuong`. **A.ACT**: 96 effective (+ `tt-new` overridden). **IN** 36, **CH** 39.
- **Persistence**: `A.save` ×22; writes `directSellerAssignments`, `pointRequests`, `stalls` (edit/split/merge/relocate execution, `A.idx.stall.set`), `traders` (wizard), `pointUsages`; `A.idx.*` 90 code references (stall 58, trader 26, contract 6).
- **Callers**: v-dieuhanh (`openDkDrawer`, `openTraderDrawer`), v-cautruc (`dkTableHtml`), vehicles (`openTraderDrawer`), mini (`pointReq`, `createLinkedTraderAccount`), workflow (`openDkDrawer`, `ttDocDefs`).
- **Safe**: business-point UI and trader UI are movable separately **only after** their shared closure is cut: TT01-TT04 need `ttPointPath`-style layout path from market-layout service; trader drawer needs point usage (TT15) and direct seller read (TT04) through business-points service. Point-change and wizard code must be decided first (§8), otherwise they block the file deletion.
- **Deletion criteria**: every TT row moved or deleted with proof; `mat-bang`, `diem-kd`, `tieu-thuong` HTML equal; trader drawer and point drawer HTML equal for sampled CL/TTD records; all remaining `dk*`/`tt*` keys registered by their new owners; Mini App point requests still work (if kept).

### 4.11 `js/vehicles.js` (189 lines)

| ID | Responsibility | Class | Destination |
|---|---|---|---|
| VE01 | Vehicle store/query (`db()` = `A.db.traderVehicles`, `vehiclesFor`, `vehiclePrice` via `A.SERVICE_CFG`, `TYPES`) | FEATURE:traders | `features/traders/vehicles.js` |
| VE02 | Trader drawer section `traderSection` + ACT `vehicle-add vehicle-edit vehicle-save vehicle-deactivate` | FEATURE:traders | `features/traders/vehicles.js` |
| VE03 | Draft editor for wizard (`draftSection`, `openDraftModal`, `finishDraftEditor`, `persistDrafts`, `draftEditor`; ACT `vehicle-draft-cancel vehicle-draft-save`) | UNRESOLVED | only used by the legacy wizard (TT21) |
| VE04 | Contract enhancement (`renderContractVehicles`, `enhanceContractModal`, `ct-new` wrapper (overridden), `ct-new-save` wrapper writing `vehicleFeeSnapshot`) | UNRESOLVED | wraps the unreachable V1 create (§8 Q2) |
| VE05 | Dead code: `traderSectionLegacy`, `traderSectionPrevious` (no call), `ensureDemoData()` (called only at load, when `A.db` is still `null` → returns immediately) | OBSOLETE | delete |

- **Exported**: `A.VEHICLES`. **Views**: none. **ACT**: 7 effective. **State**: `draftEditor`. **Persistence**: `A.save` ×4; writes `traderVehicles`, `contracts[].vehicleFeeSnapshot`.
- **Callers**: v-tieuthuong (`traderSection`, draft API ×5). **Deletion**: after traders batch + §8 Q2.

### 4.12 `js/v-taichinh.js` (1,452 lines)

| ID | Responsibility (lines) | Class | Destination |
|---|---|---|---|
| TC01 | Shared finance period (`:7-32`) `financePeriod`, `financeStatusBadge`, `financeTimeBarRow`; ACT `fp-nav`, CH `fp-select`; `ui.period` | FEATURE:finance | `features/finance/periods.js` |
| TC02 | Meter readings V1 (`:33-245`) `periodStatusBadge`, `periodHeaderHtml`, `photoBadge`, `rowHtml`, `VIEWS['dien-nuoc']#1`; ACT `dn-*` (8), CH `reading`, `dn-photo-add`, `mp-select`, ACT `mp-nav` | OBSOLETE (UI) / UNRESOLVED (`dn-close-period`, `dn-close-confirm`) | V1 view overridden; its actions are rendered only by V1 helpers/modals. The meter-period **closing** exists only here (§8 Q6). |
| TC03 | Meter readings V2 view (`:246-294`) `VIEWS['dien-nuoc']#2`, `mrOpen` | OBSOLETE | overridden by V3 (`:312`), `mrOpen` reassigned |
| TC04 | Meter readings V3 (`:295-324`) `mrOpenV2`, `VIEWS['dien-nuoc']#3`; ACT `mr-*` (8), CH `mr-type`, IN `mr-search`; `mrDraft`; document-level `input` listener for `#mr-current` | FEATURE:finance | `features/finance/meter-readings/page.js` (the global listener must be registered exactly once) |
| TC05 | Receivables + adjustments (`:325-576`) `pt*`, `VIEWS['phai-thu']`; ACT `pt-issue inv-open inv-adjust* `; IN `pt-search adj-*`; CH `pt-status adj-*` (writes `invoices`, `issuedPeriods`, `billingPeriods`, `receivableAdjustRequests`, `notifications`) | FEATURE:finance | `features/finance/receivables/` |
| TC06 | Collection (`:577-787`) `renderPay`, `receiptRows`, `VIEWS['thu-tien']#1`, ACT `pay-open pay-confirm thu-tab`, CH `pay-sel pay-amount thu-date receipt-*`, IN `thu-search receipt-search` | FEATURE:finance (V1 view body OBSOLETE) | `features/finance/collection/` |
| TC07 | Session cash collection (`:588-642`) `sessionCash*`, `openSessionCashPay`; ACT `pay-session-open pay-session-confirm` (calls `A.completeSessionCashPayment`) | FEATURE:finance | `collection/session-cash.js`, reads `market-sessions` service |
| TC08 | Collection view V2 (`:788-863`) final `VIEWS['thu-tien']` | FEATURE:finance | `collection/page.js` |
| TC09 | Reconciliation shared + session reconciliation (`:864-1094`) `ds*` guards, session totals/state/detail, `VIEWS['doi-soat']`; ACT `ds-tab ds-csv ds-session-detail ds-session-cash-confirm`; CH `ds-from ds-to` | FEATURE:finance | `features/finance/reconciliation/` |
| TC10 | Bank/QR reconciliation (`:1095-1227`) `dsBankView`, match modal; ACT `ds-bank-*` (6); IN `ds-bank-search ds-match-search`; writes `bank` | FEATURE:finance | `reconciliation/bank.js` |
| TC11 | Cash handover (`:1228-1384`) `dsCash*`; ACT `ds-cash-*` (5); writes `cashDeposits`, `cashConfirms` (AGENTS §25-26: collection ≠ handover ≠ confirmation) | FEATURE:finance | `features/finance/cash-handover/` |
| TC12 | Debt (`:1385-1451`) `VIEWS['cong-no']`, `remind`; ACT `cn-remind cn-remind-all cn-csv`; CH `cn-asof cn-origin`; writes `notifications` | FEATURE:finance | `features/finance/debt/` |

- **Exported**: none. **A.VIEWS**: `dien-nuoc`, `phai-thu`, `thu-tien`, `doi-soat`, `cong-no`. **ACT** 48, **IN** 8, **CH** 18.
- **State**: `mrDraft`; `ui.period readingsFilter ptAdjForm pay dsTab dsFrom dsTo dsBankSearch dsBankFilter dsMatch`; `ui.f` `cn* mr* pt* receipt* thu*`.
- **Persistence**: `A.save` ×17; writes 7 collections directly; calls `A.applyPayment`, `A.refreshStall`, `A.reindex`, `A.showReceipt`.
- **Callers**: none import from it (leaf). Depends on core finance helpers (C10, C12, C16, C20, C22) and mini (`completeSessionCashPayment`).
- **Safe**: only as finance sub-batches with the core finance helpers moved **in the same batch as their first consumer**. Financial safety rule: no formula/order change; replay unpaid / partial / full payment + session cash + bank match + cash handover confirm.
- **Deletion criteria**: 5 routes HTML equal per market and period; persisted db after each action sequence byte-equal; overridden V1/V2 bodies deleted only with §7 proof.

### 4.13 `js/v-vanhanh.js` (1,712 lines)

| ID | Responsibility (lines) | Class | Destination |
|---|---|---|---|
| VH01 | Incident V1 UI (`:16-60`, `:61-103`) `VIEWS['su-co']#1`, `inc-open#1`, ACT `inc-next inc-escalate inc-comment inc-new inc-new-save`, CH `inc-cat` | OBSOLETE (except `incLog`, CH `inc-cat`) | `inc-new`/`inc-next`/`inc-escalate`/`inc-comment` are rendered only by the overridden V1 view/modal |
| VH02 | `A.addIncident` (`:104`) | NEW:complaints | `features/complaints/service.js` (used by Mini App) |
| VH03 | Incident V2 (`:121-334`) `ensureIncidentV2` (render-time migration), `incEnsureLeaderReminder`, detail/flow tabs, `VIEWS['su-co']#2`, ACT `inc-*` V2 (17 incl. effective `inc-open`), CH `inc-assign inc-images inc-accept-result` (writes `incidents`, `notifications`) | NEW:complaints | `features/complaints/{page,service}.js` |
| VH04 | Notifications (`:335-373`) `groupInfo`, `VIEWS['thong-bao']`, ACT `tb-send`, CH `tb-group` | NEW:notifications | `features/notifications/page.js` |
| VH05 | Reports (`:374-517`) `reports()`, `rpTotals`, `rpKpis`, `hbars`, `VIEWS['bao-cao']`, ACT `rp rp-save rp-csv`, CH `rp-cfg`; uses `A.STATE_FORMS` | NEW:reports | `features/reports/page.js` |
| VH06 | Accounts admin (`:518-772`) `acc*`, `afScopeSectionHtml`, `renderAccForm`, base `VIEWS['tai-khoan']`; ACT `acc-*` (6); IN `acc-search`; CH `acc-*`, `af-*` (12); `ui.acc`, `ui.accForm` | FEATURE:accounts | `features/accounts/page.js` |
| VH07 | Roles & permission matrix (`:773-842`, `:1580-1599`, `:1615-1650`) `roleGrantCountLabel`, `slugify`, `permsMatrixHtml`, `renderRoleForm`, `settingsVaitroHtml`; ACT `role-*` (7); CH `perm-role-select perm-toggle rf-*`; `ui.permRole`, `ui.roleForm` | NEW:access-control | `features/access-control/page.js` (calls `A.PERM` from shared/authz) |
| VH08 | Fee configuration UI (`:846-1373`) `cfg*`, `settingsGia/DienNuoc/DichVu`, drawers, `renderCfgForm`, attachments, legal basis, `VIEWS['cau-hinh-gia']`; ACT `cfg-*` (20, of which 6 in VH09); CH `cf-* cfg-att-add lf-*` | NEW:fee-config | `features/fee-config/page.js` |
| VH09 | Fee config unreachable actions `cfg-price-edit cfg-price-toggle cfg-util-edit cfg-util-toggle cfg-svc-edit cfg-svc-toggle` | OBSOLETE | no literal caller (UI uses `cfg-fee-toggle`, `cfg-fee-apply`, shared form) |
| VH10 | Billing cycle + rules panels (`:1301-1362`) `settingsKyThuHtml`, `settingsQuyTacHtml`; CH `bc-* br-*` | NEW:fee-config | `features/fee-config/billing-panels.js` (hosted by `cai-dat`) |
| VH11 | Bank accounts UI (`:1374-1575`) `ba*`, `renderBankAcctForm`, `VIEWS['tai-khoan-ngan-hang']`; ACT `ba-*` (9); IN `ba-search`; CH `ba-* baf-*`; `ui.bankAcc`, `ui.baSel`, `ui.baForm` | FEATURE:finance | `features/finance/bank-accounts/page.js` |
| VH12 | Settings tab host (`:842-845`, `:1605-1614`) `SETTINGS_TABS`, `settingsTabBar`, `VIEWS['cai-dat']`, ACT `settings-tab`; integrations panel `settingsTichhopHtml` (static) | APP | `src/app/settings.js` (composes feature panels) |
| VH13 | Audit log panel `settingsNhatkyHtml` (reads `extraLog` + `audit`) | SHARED | `src/shared/data/audit.js` viewer panel, hosted by `app/settings` |
| VH14 | Demo reset ACT `reset`, `reset-ok` (calls `A.resetAll`) | APP | `src/mocks/reset.js` (button rendered by audit panel) |

- **Exported**: `A.addIncident`; initializes `ui.permRole settingsTab cfgTab acc bankAcc baSel` at load.
- **A.VIEWS**: `su-co`, `thong-bao`, `bao-cao`, `cau-hinh-gia`, `tai-khoan-ngan-hang`, `cai-dat` + base `tai-khoan` (wrapped by workflow). **ACT** 71, **IN** 2, **CH** 77.
- **Persistence**: `A.save` ×10; writes `incidents`, `notifications`, `marketAssets` (incident ↔ asset link); `A.ACCOUNTS`, `A.PERM`, `A.SERVICE_CFG`, `A.BANK_ACCOUNTS` stores via their APIs.
- **Callers**: mini (`addIncident`); workflow (captures `tai-khoan` view). Depends on v-baocao-mau.
- **Safe**: per group; each group is independent (no shared closure except `ST` incident states and `cfg*` helpers used by VH08+VH10). **Deletion**: all 14 rows placed; 7 views equal; `cai-dat` tabs equal.

### 4.14 `js/v-taisan.js` (115 lines)

| ID | Responsibility | Class | Destination |
|---|---|---|---|
| AS01 | Assets: `ensureAssets` (render-time seed/migration of `marketAssets` from `D.build()`), list/drawer/form, `VIEWS['tai-san']`, ACT `asset-*` (6), CH `asset-filter`; `ui.assetFilter/assetOpen/assetTab` | NEW:assets | `features/assets/{repository,page}.js` (seed part → `src/mocks`) |

- **Callers**: none. **Persistence**: `A.save` ×2. **Safe**: yes (self-contained). **Deletion**: `tai-san` HTML equal; `marketAssets` migration still additive and idempotent.

### 4.15 `js/v-baocao-mau.js` (130 lines)

| ID | Responsibility | Class | Destination |
|---|---|---|---|
| BM01 | State report forms (ND 60/2024, TT 34/2022): `A.STATE_FORMS`, `A.STATE_FORM_ORDER`, `A.stateFormHtml`, `A.stateFormCsv`; constants `YEAR`, `ASSET` | NEW:reports | `features/reports/state-forms.js` |

- **Callers**: v-vanhanh (reports page). Read-only. **Safe**: yes, with or before VH05.

### 4.16 `js/mini.js` (1,334 lines)

| ID | Responsibility (lines) | Class | Destination |
|---|---|---|---|
| MI01 | Portal context (`:7-29`) `activeRole`, `miniMarkets`, `isTraderMini`, `isCollectorMini`, `isSessionMarket`, `canTraderRegisterStall` | NEW:trader-portal | `features/trader-portal/context.js` |
| MI02 | Session ↔ registration sync (`:30-168`) `syncOpsSessionsToMiniRegistrationModel`, `ensureMiniRegistrationModel` (lazy creation of 5 collections), pricing, capacity, available points | NEW:market-sessions | `features/market-sessions/registration.js` |
| MI03 | Session payment completion (`:169-342`) `promotePaidSessionRegistration`, `A.syncPaidSessionRegistrationsToOfficial`, `A.completeSessionOnlinePayment`, `A.completeSessionCashPayment`, snapshots/receipt numbers (writes `sessionPayments`, `sessionReceipts`, `payments`, `bank`, `sessionRegistrations`) | NEW:market-sessions | `features/market-sessions/payments.js` — cross-domain write into finance collections; must become one use case called by finance (TC07) and the portal |
| MI04 | Registration eligibility + fixed-stall application (`:343-418`, `:887-928`, ACT `mini-reg-kind mini-reg-submit`) writes `fixedStallApplications` | UNRESOLVED | fixed-stall applications have no staff-side screen (§8 Q3); session registration part → market-sessions |
| MI05 | Point-change submissions (`:441-579`, `:801-886`, ACT `mini-split-* mini-merge-* mini-convert-* mini-req-*`, IN `mini-split-* mini-merge-reason mini-convert-*`, CH `mini-merge-b mini-convert-to`) writes `pointRequests` via `A.pointReq` | UNRESOLVED | owner = `point-changes` if kept (§8 Q1) |
| MI06 | Portal request state reset `A.resetMiniRequestState` (called by core `demo-account`) | NEW:trader-portal | `context.js` |
| MI07 | OTP login screens (`:580-657`) + ACT `mini-login-lookup mini-login-retry mini-login-send-otp`, IN `mini-login-phone`, CH `mini-trader` | NEW:trader-portal | `features/trader-portal/login.js` |
| MI08 | Overridden handlers `mini-login-verify` (`:1074`, replaced by workflow), `mini-logout` (`:1084`, replaced by auth) | OBSOLETE | delete bodies; keep the effective ones (WF08, AU04) |
| MI09 | Trader payment (`screenPay`, `tabBills`, ACT `mini-pay mini-paid mini-bill mini-home`) — calls `A.applyPayment('qr')` | FEATURE:finance | UI in portal; command = `finance.collection.service.payOnline` |
| MI10 | Collector mobile collection (ACT `mini-collect-open mini-collect-paid mini-collector-home mini-session-cash-open mini-session-cash-paid`, `collectorActor`) | FEATURE:finance | UI in portal (`collector.js`); commands in finance collection (cash) and market-sessions payments |
| MI11 | Portal tabs: contract (`tabContract`, ACT `mini-pdf`), notices (`notisFor`, `tabNotice`), report (`tabReport`, ACT `mini-report` → `A.addIncident`, `mini-attach`, `mini-rate`), session pay (`screenSessionPay`, ACT `mini-session-pay`) | NEW:trader-portal | UI only; data via contracts, notifications, complaints, market-sessions services |
| MI12 | Portal shell `VIEWS['mini-app']` (`:1003`), phone frame, ACT `mini-tab` | NEW:trader-portal | `features/trader-portal/page.js` |

- **Exported**: `A.syncPaidSessionRegistrationsToOfficial`, `A.completeSessionOnlinePayment`, `A.completeSessionCashPayment`, `A.resetMiniRequestState`.
- **A.VIEWS**: `mini-app`. **ACT** 36 effective (+2 overridden). **IN** 7, **CH** 3.
- **State**: `ui.mini` sub-state (`traderId step tab pay lastPays attach bill loginStep regForm splitDraft mergeDraft convertDraft reqView collectTraderId …`).
- **Persistence**: `A.save` ×8; writes `marketSessions`, `sessions`, `payments`, `sessionReceipts`, `bank`, `notifications`, `sessionRegistrations`, `sessionPayments`, `fixedStallApplications`, `pointRequests`.
- **Callers**: core (`resetMiniRequestState`), v-dieuhanh (`syncPaidSessionRegistrationsToOfficial`), v-taichinh (`completeSessionCashPayment`). Depends on v-tieuthuong (`pointReq`, `createLinkedTraderAccount`), v-vanhanh (`addIncident`).
- **Safe**: no — last feature batch. Requires finance collection, market-sessions, complaints and (decision on) point-changes to own their commands first.
- **Deletion criteria**: portal renders for trader and collector accounts; online payment, cash collection, session payment, complaint submission and (if kept) point request replay byte-equal.

### 4.17 `js/workflow.js` (166 lines)

Each use case has one domain owner; no `features/workflow`.

| ID | Use case (lines) | Class | Destination |
|---|---|---|---|
| WF01 | Derived tasks `needsContract`, `needsAccount`, `A.WORKFLOW` (`:24-35`) | FEATURE:contracts (`needsContract`) / FEATURE:accounts (`needsAccount`) | `contracts/service.tradersWithoutContract`; `accounts/service.tradersNeedingAccount` |
| WF02 | Recently assigned point marker (`RECENT_POINT_KEY` sessionStorage, `ui.workflowRecentStallId`, `isRecentPoint`/`markRecentPoint`) | FEATURE:business-points | UI marker in `business-points/drawer.js`; set by the contract create use case |
| WF03 | Trader profile create (`:37-86`) `profileDraft`, `renderProfile`, `profileSuccess`, ACT `tt-new` (effective), `wf-profile-file`, `wf-profile-save` (writes `A.db.traders` directly), `wf-profile-contract`, `wf-profile-later`; IN `wf-p-*`, CH `wf-p-idtype` | FEATURE:traders | `features/traders/create.js` + repository `add` (removes the last direct `A.db.traders.push`) |
| WF04 | Contract task + wrapper of `hop-dong` (`:88-89`) | FEATURE:contracts | composed directly inside `contracts/page.js` (no capture wrapper) |
| WF05 | Contract create form (`:91-138`) `workflowOpenContract`, `pointPrice`, `nextContractId`, ACT `wf-contract-open`, `ct-new` (effective), `wf-contract-file`, `wf-contract-save` (calls `contracts.service.createWithPointAllocation`) | FEATURE:contracts | `features/contracts/create.js` (price formula read from fee-config service) |
| WF06 | Post-create navigation `wf-go-stall` | FEATURE:contracts | `contracts/create.js` (calls business-points drawer API) |
| WF07 | Account task + wrapper of `tai-khoan`, `wf-account-open`, `wf-account-create`, `wf-send-activation` | FEATURE:accounts | `features/accounts/trader-account.js`, composed in `accounts/page.js` |
| WF08 | Effective `mini-login-verify` (OTP verify, no account creation) | NEW:trader-portal | `features/trader-portal/login.js` |

- **Exported**: `A.WORKFLOW`. **Views**: wrappers `hop-dong`, `tai-khoan`. **ACT** 14 effective. **State**: `profileDraft`, `contractFiles`. **Persistence**: `A.save` ×2, sessionStorage ×2.
- **Callers**: v-tieuthuong and v-dieuhanh read `A.WORKFLOW` lazily.
- **Safe**: after traders, contracts, accounts and trader-portal batches each take their row. **Deletion**: `hop-dong` and `tai-khoan` HTML equal (task + page); create profile → create contract → create account chain equal (existing Phase 9/12 smoke tests).

### 4.18 `js/auth.js` (120 lines)

| ID | Responsibility | Class | Destination |
|---|---|---|---|
| AU01 | Session identity: `A.isDemoMode` (`prototype-demo-mode`), `A.isLoggedIn`, `A.currentAccount` (authoritative), `A.saveUi` (authoritative), `A.load` decorator (session restore, trader portal defaults) | APP | `src/app/session.js` (merged with C17; core versions deleted) |
| AU02 | Route/render guards (`A.route`, `A.render` decorators) | APP | built into `src/app/router.js` / `shell.js` (no decoration chain) |
| AU03 | OTP login screen `loginHtml`, `bindInputs`, `completeLogin`, `A.showLogin`; ACT `auth-continue auth-verify auth-resend auth-change-phone` | APP | `src/app/auth/login.js` |
| AU04 | User menu/profile/logout `userMenuHtml`, `A.userHeaderHtml`; ACT `auth-user-menu auth-profile auth-logout`, `mini-logout` (effective) | APP | `src/app/auth/user-menu.js` |

- **Persistence**: `localStorage` ×3 (`prototype-demo-mode`, `choso-caolanh-ui`). **Callers**: every view through `A.render`/`A.currentAccount`.
- **Safe**: only in the final app batch together with C17/C23/C24. **Deletion**: login, demo mode, session restore after reload, trader auto-routing to `mini-app`, route guard for a denied screen.

## 5. Obsolete / overridden code register

All items need the Phase 15 proof protocol (§7) before deletion.

| Item | File:lines | Evidence |
|---|---|---|
| `VIEWS['mat-bang']` re-registration, `clLayoutView` | v-tieuthuong `:1286`, `:1993` | Both branches evaluate `A.mbWorkspaceHtml()` — identical to v-cautruc `:765`. |
| `VIEWS['dien-nuoc']` #1, #2 + `mrOpen` + V1 helpers/actions `dn-*`, `reading`, `dn-photo-add`, `mp-*` | v-taichinh `:33-294` | Overridden by `:312`; renderers only inside overridden bodies. **Except** `dn-close-period/confirm` (§8 Q6). |
| `ACT['mr-evidence-add'/'-remove']` first bodies | v-taichinh `:278-279` | Re-assigned at `:323-324`. |
| `VIEWS['thu-tien']` #1 body | v-taichinh `:728` | Superseded at `:790` (comment says so). Handlers used by #2 stay. |
| `VIEWS['su-co']` #1, `inc-open` #1, `inc-new`, `inc-new-save`, `inc-next`, `inc-escalate`, `inc-comment` | v-vanhanh `:16-103` | Overridden by `:289`/`:313`; the five actions are rendered only by the overridden bodies. `incLog`, `A.addIncident`, `inc-cat` stay. |
| `cfg-price/util/svc-edit`, `cfg-price/util/svc-toggle` | v-vanhanh `:992-1110` | No literal caller. |
| `dkcl-convert-open/save`, `dkcl-merge-open/save` | v-tieuthuong `:377-434` | No literal caller for the `-open` keys. |
| `tt-placement-view`, `tt-seller-view`, `tt-open-contract`, `tt-open-point` | v-tieuthuong `:2405-2477` | No literal caller. |
| `ttDrawerHtmlLegacy`, `ttMiniAppSectionHtml`, `tt-miniapp-toggle`, `tt-miniapp-copy-guide` | v-tieuthuong `:2337-2400` | No caller of the legacy drawer (documented product debt). |
| `A.createLinkedTraderAccount` / `ttCreateLinkedAccount` | v-tieuthuong `:2511-2531` | Only caller is overridden `mini-login-verify`. |
| `mini-login-verify`, `mini-logout` (mini bodies) | mini `:1074`, `:1084` | Replaced by workflow / auth. |
| `traderSectionLegacy`, `traderSectionPrevious`, `ensureDemoData` | vehicles `:29-80`, `:187` | No call / runs only while `A.db === null`. |
| `A.marketStats`, `A.mbZoneStats` exports | v-dieuhanh `:1045`, `:1231` | Exported symbol has zero external references (the functions stay if used internally). |
| `A.currentAccount`, `A.saveUi` core bodies; `previousSaveUi` capture | core `:249`, `:329`; auth `:30` | Fully replaced by auth; capture never invoked. |
| V1 `ct-new` / `ct-new-save` in `contracts/page.js` `:75-88` | src (not legacy) | Unreachable fallback (Phase 11/13); tied to §8 Q2. |

## 6. Existing `src/features` completeness

| Feature | Has now | Missing (should eventually join) |
|---|---|---|
| `markets` | repository, service | store (`marketcatalog.js`), page (`v-danhmuccho.js`), `U.market`/`U.mShort` |
| `traders` | repository, service (profile read/update/documents, point link) | create (`workflow.js` WF03 — still pushes `A.db.traders` directly), list/drawer/edit/doc UI (TT14, TT16, TT17), vehicles (VE01-VE02), `ttDocDefs` provider |
| `business-points` | repository, service (list/get/occupy/vacate/history) | point table/drawer/edit/direct sellers (TT01-TT04, TT07-TT08), status change (DH08), quick panels (DH06), collector assignment + label (CT05, CT08), point usages (TT15), labels (C07), debt status sync (C16), recent-point marker (WF02) |
| `contracts` | repository, service, detail, page (lifecycle) | effective create form + task (WF04-WF06), `needsContract` (WF01); expiry notifications should call `notifications` instead of writing during render (known debt); V1 create fallback decision (§8 Q2) |
| `accounts` | repository, service (byTraderId, add, setStatus) | store (`accounts.js`), admin page (VH06), trader-account task (WF07), `needsAccount` (WF01), `U.staffName` (C06) |
| `finance` | repository, service (2 read queries) | everything in `v-taichinh.js` (TC01, TC04-TC12), core helpers (C10, C12, C16, C20, C22, `receipt` action), bank accounts (BA01, VH11), portal payment/collector commands (MI09-MI10) |

## 7. Phase 15 proof protocol (applies to every batch)

1. **Registry diff**: effective `A.VIEWS`/`A.ACT`/`A.IN`/`A.CH` key sets identical to baseline (except keys deleted as obsolete in that batch, listed explicitly). Script-level ownership changes are expected; key sets are not.
2. **Behaviour replay**: the Phase 13 headless harness (real handlers, stub DOM) replays the batch's actions; rendered HTML, persisted `choso-caolanh-state`, account/permission/layout/config stores and toasts must be byte-equal to baseline.
3. **Obsolete deletion**: a key/function may be deleted only if (a) no literal renderer, string or call exists, (b) the harness shows the key never fires across all routes × roles × CL/TTD, and (c) a manual browser click-through of the screen confirms no button. Items tagged UNRESOLVED are never deleted without the answer in §8.
4. **Storage**: 11 localStorage + 1 sessionStorage identifiers unchanged; no new key; stored data from before the batch loads unchanged (no reseed).
5. **Routes**: 21/21, including legacy redirects `#/so-do`, `#/cau-truc`, `#/diem-kd`.
6. **RBAC**: one allowed and one denied role per moved screen/action (AGENTS §55).
7. `node --check` on every runtime file, `git diff --check`, `index.html` updated, old implementation removed in the same batch (move, never duplicate).

## 8. Business decisions (RESOLVED after Phase 14)

The eight Phase 14 questions were answered by the product owner before Phase 15.1. They replace the former NEEDS_CONFIRMATION entries.

| # | Topic | Decision | Consequence for Phase 15 |
|---|---|---|---|
| Q1 | Business-point split / merge / relocation requests (`pointRequests`, TT09-TT12, `A.pointReq` TT10, Mini App submission MI05) | **DROP** | Rows TT09-TT12 and MI05 are reclassified **OBSOLETE**. No `features/point-changes` is created. The staff workflow and the Mini App request flow are removed in batch 15.17 / 15.21 with the §7 proof. |
| Q2 | Legacy trader wizard (TT21), vehicle draft editor (VE03), V1 contract create + vehicle enhancement (VE04, `contracts/page.js:75-88`) | **DROP** | Reclassified **OBSOLETE**; not migrated. `vehicleFeeSnapshot` is **not** added to the effective contract flow; it is recorded as product/backend debt only. |
| Q3 | `fixedStallApplications` (Mini App fixed-stall application, fixed-stall part of MI04) | **DROP** | Fixed-stall application UI and writes reclassified **OBSOLETE**; the session-registration part of MI04 stays with `market-sessions`. |
| Q4 | TTĐ market sessions (`phien-cho`) | **KEEP** | `features/market-sessions` (batch 15.19) confirmed, behaviour unchanged. |
| Q5 | Assets (`tai-san`) | **KEEP** | `features/assets` (batch 15.10) confirmed, behaviour unchanged. |
| Q6 | Meter-period closing (`dn-close-period`, `dn-close-confirm`, surviving only in the overridden V1 electricity/water screen) | **KEEP** | These handlers must **not** be deleted. The finance meter-readings batch (15.20d) must expose closing in the current V3 UI; only the rest of TC02/TC03 is obsolete. |
| Q7 | Legacy CL/TTD collection policy (`A.canDirectCollect`, `A.canCollectReceivable`) | **PRESERVE exactly** | Moved as-is in 15.20b; no generalisation during Phase 15. |
| Q8 | `A.refreshStall` debt-derived point status | **PRESERVE exactly** | Moved as-is in 15.20b; occupancy/debt semantics are not redesigned in Phase 15. |

No NEEDS_CONFIRMATION item remains open for Phase 15.

## 9. Phase 15 migration batches

Rules for every batch: one ownership theme; **move** implementation (old code deleted after validation in the same batch); keep script order constraints (§1.1); update `index.html`; pass §7. Order goes from lowest to highest coupling/risk.

| Batch | Theme | Moves (IDs) | New/changed `index.html` slot | Deletes | Validation focus | Risk |
|---|---|---|---|---|---|---|
| 15.1 | App namespace | C01 → `src/app/state.js`; core.js becomes `(function (A) {…})(window.APP)` | `data.js → src/app/state.js → js/core.js …` | — (core shrinks) | full registry + harness (every file depends on the namespace) | Low |
| 15.2 | Shared UI & utils | C02, C03, C09, C13, C21 + ACT `overlay close page drawer-back` → `src/shared/utils/*`, `src/shared/ui/*` (attach to the same `A.U`/`A` members) | right after `state.js`, **before** core.js (MENU needs `U.icon` at load) | core parts | `A.U` key set (43) identical; HTML equal on all routes | Low |
| 15.3 | Shared data | C14, C15 → `src/shared/data/{store,audit}.js`; `shared/data/repository.js` stops delegating to core; VH13 audit viewer panel → `shared/data/audit.js` | before `repository.js` | core parts | `choso-caolanh-state` load/migrate/save byte-equal; fresh vs stored start | Medium |
| 15.4 | Shared authorization | `permissions.js` (P01-P04) → `src/shared/authz/`; C11 → `guards.js` | same slot as `permissions.js` | `js/permissions.js` | `choso-caolanh-permissions` fresh + upgrade; allowed/denied per role | Medium |
| 15.5 | Markets | MC01, DM01, C04 → `features/markets/{store,page,format}.js` | store before markets repository; page where v-danhmuccho was | `js/marketcatalog.js`, `js/v-danhmuccho.js` | `danh-muc-cho` CRUD replay; catalog store bytes | Low |
| 15.6 | Fee configuration | SC01, C08, VH08, VH09 (obsolete proof), VH10 → `features/fee-config/` | store where serviceconfig was; page before v-vanhanh | `js/serviceconfig.js` | `cau-hinh-gia` lifecycle replay; applied price per point; kythu/quytac panels | Medium |
| 15.7 | Finance configuration: bank accounts | BA01, VH11 → `features/finance/bank-accounts/` | store where bankaccounts was | `js/bankaccounts.js` | `tai-khoan-ngan-hang` replay; `choso-caolanh-bankaccounts` | Low |
| 15.8 | Accounts | AC01-AC04 (AC02 → `src/mocks/accounts.seed.js`), C06, VH06, WF07, WF01 (`needsAccount`) → `features/accounts/` | store where accounts.js was (after authz) | `js/accounts.js` | account store bytes; `tai-khoan` (task + page) HTML; `wf-account-*` smoke | Medium |
| 15.9 | Access control | VH07 → `features/access-control/page.js` (panel) | before app settings host | v-vanhanh part | role CRUD + perm toggle replay; permission store bytes; audit log lines | Medium |
| 15.10 | Assets | AS01 → `features/assets/` (seed → mocks) | where v-taisan was | `js/v-taisan.js` | `tai-san` replay; additive migration idempotent | Low |
| 15.11 | Reports | BM01, VH05, DH02, DH03 → `features/reports/` | where v-baocao-mau was | `js/v-baocao-mau.js`, v-vanhanh/v-dieuhanh parts | `tong-quan`, `bao-cao` HTML per scope (ALL/CL/TTD, ward leader) | Low |
| 15.12 | Complaints | VH01 (obsolete proof), VH02, VH03 → `features/complaints/` | before mini.js | v-vanhanh parts | `su-co` workflow replay (Tiếp nhận → Đang xử lý → Hoàn thành → Đóng); `addIncident` from portal | Medium |
| 15.13 | Notifications + settings host | VH04 → `features/notifications/`; VH12 → `src/app/settings.js`; VH14 → `src/mocks/reset.js` | — | **`js/v-vanhanh.js`** | `thong-bao`, `cai-dat` all tabs; reset demo | Low |
| 15.14 | Market layout (critical) | CT01-CT04, CT06, CT07, CT09, DH04, DH05, DH07 → `features/market-layout/`; TT13 removed | where v-cautruc was (after business-points service) | **`js/v-cautruc.js`**, v-dieuhanh + v-tieuthuong parts | `choso-caolanh-layout` bytes incl. old stored layouts; tree/zone/floor/block/overview per market; legacy hash redirects; `mat-bang.*` RBAC | High |
| 15.15 | Business points UI | TT01-TT04, TT07, TT08, TT15, DH06, DH08, CT05, CT08, C07, WF02 (+ TT05/TT06 obsolete proof) → `features/business-points/` | after market-layout | v-tieuthuong, v-dieuhanh, core parts | point drawer/table/edit/direct seller/status/collector replay (CL + TTD); `diem-kd` generic | High |
| 15.16 | Traders UI | TT14, TT16, TT17, TT22, VE01, VE02, VE05, WF03 (+ TT18-TT20, TT23 obsolete proof) → `features/traders/` | after business-points | v-tieuthuong part, vehicles parts | trader list/drawer/edit/doc replace; profile create → duplicate idNo rule per market | High |
| 15.17 | Obsolete point-change + legacy create removal (§8 Q1/Q2 = DROP) | delete TT09-TT12, TT10, TT21, VE03, VE04, `page.js:75-88` (Mini App side MI05 removed in 15.21) | — | **`js/v-tieuthuong.js`**, **`js/vehicles.js`** | registry diff lists every removed key; remaining screens byte-equal | High |
| 15.18 | Contracts completion | WF01 (`needsContract`), WF04-WF06 → `features/contracts/create.js`; `hop-dong` composed without wrappers | — | workflow parts | create profile → contract → account chain (Phase 9 smoke); `hop-dong` HTML | Medium |
| 15.19 | Market sessions | DH01, DH09, DH10, MI02, MI03 (+ session part of MI04) → `features/market-sessions/` | before finance pages | **`js/v-dieuhanh.js`**, mini parts | `phien-cho` full replay (create/transition/registration/attendance/replacement/close); online + cash session payment | High |
| 15.20a | Finance: periods, receivables, debt | TC01, TC05, TC12, C10 | where v-taichinh was | v-taichinh + core parts | `phai-thu` issue/adjust/approve; `cong-no` remind; unpaid / partial / full | High |
| 15.20b | Finance: collection & receipts | TC06, TC07, TC08, C12, C16, C20, C22, core ACT `receipt` | — | v-taichinh + core parts | cash/transfer/QR payment; partial payment; receipt validity; point status sync; idempotent double click | High |
| 15.20c | Finance: reconciliation & cash handover | TC09, TC10, TC11 | — | v-taichinh parts | bank auto/manual match; cash submit ≠ confirm; differences preserved | High |
| 15.20d | Finance: meter readings | TC04 (+ TC02/TC03 per §8 Q6) | — | **`js/v-taichinh.js`** | `dien-nuoc` record/evidence/abnormal; global input listener registered once | Medium |
| 15.21 | Trader portal | MI01, MI06, MI07, MI09-MI12 (+ MI08 obsolete), WF08; portal writes routed to finance / sessions / complaints / point-changes services | before app bootstrap | **`js/mini.js`**, **`js/workflow.js`** | trader + collector accounts: login, pay, collect cash, session pay, complaint, requests | High |
| 15.22 | App shell, router, auth | C05, C17-C19, C23-C26 (C19, `resetAll` → mocks), AU01-AU04 → `src/app/{session,router,menu,shell,guide,bootstrap}.js`, `src/app/auth/*` | `src/app/bootstrap.js` last | **`js/core.js`**, **`js/auth.js`** → `frontend/js/` removed | login/demo mode/session restore; route guard; 21 routes; menu per role; market selector scope | High |
| 15.23 (optional) | Mocks | `data.js` → `src/mocks/data.js` (+ seeds collected in 15.8/15.10/15.13/15.22) | first script | `frontend/data.js` | fresh start equal | Low |

Notes:
- 15.14 → 15.15 → 15.16 → 15.17 must stay in this order: `v-tieuthuong.js` can only be deleted once layout, points and traders have taken their parts and §8 Q1/Q2 are answered.
- 15.19 precedes 15.20 because finance session cash (TC07, TC09) calls the session payment use case; 15.21 comes after both because the portal consumes finance, sessions and complaints.
- Wrapper chains (`hop-dong`, `tai-khoan`, `ct-new`, `mat-bang`, `mini-login-verify`, `mini-logout`, auth decorators) are replaced by direct composition in the owning batch; the proof is HTML/state equality, not function identity.

## 9A. Phase 15 progress

| Batch | Status | Result |
|---|---|---|
| 15.1 App namespace | **DONE** | C01 moved verbatim from `js/core.js` into `src/app/state.js` (single owner of `window.APP`, `A.D`, `A.db`/`A.idx`/`A.current` slots, `A.RBAC_SCHEMA`, `A.VIEWS`/`A.ACT`/`A.IN`/`A.CH`, `A.ui` defaults, `A.$`). `core.js` now attaches with `(function (A) { … })(window.APP)` and keeps only local aliases (`D`, `RBAC_SCHEMA`, `ui`, `$`). Script order: `data.js → src/app/state.js → js/core.js → …` (all other scripts unchanged). Validation: `node --check` 35/35; registry 21/393/62/149 equal; `A.*` (99), `A.U` (43), `A.ui` (31 keys after load; initial structure byte-equal), `RBAC_SCHEMA` 4 equal; 229-step harness BEHAVIOUR EQUAL vs a pre-15.1 baseline taken on `4a1119d`; routes 21/21; storage 11 + 1 unchanged; `git diff --check` PASS. |

## 10. Expected final frontend tree

Only folders that receive real code from the batches above.

```text
frontend/
├── index.html
├── styles.css
└── src/
    ├── app/
    │   ├── state.js            namespace, ui defaults, registries (15.1 — done)
    │   ├── session.js          current account, market scope, ui persistence (15.22)
    │   ├── router.js           hash router, screen/market applicability, legacy redirects
    │   ├── menu.js  shell.js  guide.js  settings.js  bootstrap.js
    │   └── auth/               login.js, user-menu.js
    ├── shared/
    │   ├── utils/              format.js, clock.js
    │   ├── ui/                 icons, modal, drawer, table, csv, toast, qr, charts
    │   ├── data/               store.js, repository.js, audit.js
    │   ├── authz/              permissions.js (+ catalog, migrations, store), guards.js
    │   └── api/                (README only until the backend phase)
    ├── mocks/                  data.js (optional 15.23), accounts.seed.js, demo-links.js, reset.js, asset seed
    └── features/
        ├── markets/            store, repository, service, page, format
        ├── market-layout/      store, repository, service, state, diagram, points, page
        ├── business-points/    repository, service, table, drawer, direct-sellers, panel, status, format
        ├── traders/            repository, service, create, page, drawer, documents, vehicles
        ├── contracts/          repository, service, create, detail, page
        ├── accounts/           store, repository, service, page, trader-account, format
        ├── access-control/     page
        ├── fee-config/         store, service, page, billing-panels
        ├── finance/            repository, service, format, policy, periods, receipts,
        │                       receivables/, collection/, reconciliation/, cash-handover/,
        │                       debt/, meter-readings/, bank-accounts/
        ├── market-sessions/    model, service, registration, payments, page
        ├── complaints/         service, page
        ├── notifications/      page (+ writer used by finance/sessions/contracts)
        ├── reports/            dashboard, page, state-forms
        ├── assets/             repository, page
        ├── trader-portal/      context, login, collector, page
```

`frontend/js/` does not exist at the end of 15.22.
