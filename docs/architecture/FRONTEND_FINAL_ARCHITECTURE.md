# Frontend Final Architecture (freeze after master run 8→13)

Baseline of the master run: `cd41337 refactor: add business point read boundary`. This document describes the working tree at the end of Phase 13. Nothing is committed until review.

## 1. Current tree

```text
frontend/
├── index.html                 script order = runtime composition order
├── data.js                    mock seed (DATA.build) — mock source NOW
├── styles.css
├── src/
│   ├── app/README.md          (reserved; bootstrap/router/shell still in js/core.js)
│   ├── shared/
│   │   ├── data/repository.js APP.data: getDb/getCollection/findById/save/reindex/registerSource/getSource
│   │   └── api|authz|ui|utils/README.md   (reserved; no code yet)
│   ├── mocks/README.md        (reserved; data.js not moved, see §8)
│   └── features/
│       ├── markets/           repository, service
│       ├── traders/           repository, service
│       ├── business-points/   repository, service
│       ├── contracts/         repository, service, detail.js (dossier), page.js (screen + lifecycle UI)
│       ├── accounts/          repository, service
│       └── finance/           repository, service (read only)
└── js/                        remaining legacy (18 files)
    core.js permissions.js accounts.js bankaccounts.js serviceconfig.js marketcatalog.js
    v-dieuhanh.js v-danhmuccho.js v-cautruc.js v-tieuthuong.js vehicles.js v-taichinh.js
    v-vanhanh.js v-taisan.js v-baocao-mau.js mini.js workflow.js auth.js
```

Script order (`index.html`). The 19 legacy scripts keep their original relative order; feature scripts are inserted at dependency points:

```text
data.js → js/core.js → src/shared/data/repository.js → js/permissions.js → js/accounts.js
→ js/bankaccounts.js → js/serviceconfig.js → js/marketcatalog.js
→ features: markets → traders → business-points → contracts (repo, service) → accounts → finance
→ js/v-dieuhanh.js → js/v-danhmuccho.js → js/v-cautruc.js → js/v-tieuthuong.js
→ src/features/contracts/detail.js → src/features/contracts/page.js
→ js/vehicles.js → js/v-taichinh.js → js/v-vanhanh.js → js/v-taisan.js → js/v-baocao-mau.js
→ js/mini.js → js/workflow.js → js/auth.js
```

## 2. Feature ownership

| Feature | Owns | Reads from other features | Writes into other aggregates |
|---|---|---|---|
| markets | market catalog (via `market-catalog` source) | — | — |
| traders | trader profile fields, `docFiles`, `trader.stalls` links | — | — |
| business-points | point records (`A.db.stalls`) access; occupancy fields | — | — |
| contracts | contract records; create/terminate/liquidate/signed-copy use cases; contract screen | traders, business-points (services) | only through sibling **services** inside its use cases |
| accounts | account store access (via `accounts` source) | — | — |
| finance | read queries on invoices | — | — |

## 3. Shared responsibilities

- `src/shared/data/repository.js` (`APP.data`) is domain-neutral. It returns live legacy references, delegates `save`/`reindex` to legacy core, and lets legacy stores register themselves (`market-catalog`, `accounts`).
- `js/core.js` still provides `A.U` utilities, router, render, modal/drawer, `A.db` load/save/reindex, and the demo guide.
- `js/permissions.js` provides RBAC (`A.canDo`, `U.can`); `js/auth.js` provides OTP login/session and route/render guards.

## 4. Data flow

```text
View / handler (legacy file or features/*/page.js)
  → APP.features.<feature>.service           use cases, derived queries
  → APP.features.<feature>.repository        data access for ONE aggregate
  → APP.data                                 getCollection / findById / source / save / reindex
  → A.db (+ A.idx) / legacy store            persisted by A.save() → localStorage "choso-caolanh-state"
```

## 5. Write orchestration

| Use case | Location | Sequence (single save) |
|---|---|---|
| Create contract + allocate point | `contracts.service.createWithPointAllocation` | contracts.add (push + reindex) → businessPoints.occupy → traders.linkPoint → businessPoints.addHistory → caller `beforeSave` (workflow recent-point marker) → save. Same order as `cd41337`. |
| Terminate | `contracts.service.terminate` | applyTermination → contract history → releasePoint (vacate if no other active contract; unlink trader) → save |
| Liquidate | `contracts.service.liquidate` | applyLiquidation → contract history → releasePoint → save (preconditions validated by the UI, unchanged) |
| Signed copy | `contracts.service.addSignedCopy` | addSignedCopy → history → save |
| Audit event (print) | `contracts.service.recordEvent` | history → save |
| Profile edit | `traders.service.updateProfile/updateDocuments` + `save` | mutate → `U.log` → save (legacy order) |
| Trader account creation | `accounts.service.add` | persisted by the legacy account store |

These are **frontend orchestration boundaries without real transactions or rollback**, exactly as in the legacy code. Backend equivalents MUST be `@Transactional`.

## 6. Legacy remaining and why

| Legacy area | Why it remains |
|---|---|
| `js/v-tieuthuong.js` (2,809 lines): trader list/drawer/edit UI, business-point table/drawer, split/merge/conversion, legacy trader wizard | The trader, point and wizard code share one module closure in both directions (filter state, edit state, `TT_DOCS`, `ttUsageStore`, `dkSeller`, `ttPointPath`). Extracting it would require publishing ~15 internals on `APP`. Its data path already goes through the traders, business-points and contracts services. |
| Legacy trader wizard (`tt-wizard-*`, `ttw-*`) and V1 `ct-new`/`ct-new-save` + `vehicles.js` contract enhancement | Proven unreachable (entry actions replaced by `workflow.js`), but they are the only implementations of "create + allocate + direct seller + vehicles" and of vehicle-fee snapshots. Removal is a product decision. |
| `ttDrawerHtmlLegacy` (and its Mini App section with `tt-miniapp-toggle` / `tt-miniapp-copy-guide` buttons) | No caller; kept by the original authors as a compatibility reference. Removing it cascades into Mini App account UI, so it is deferred to a product decision. |
| `js/workflow.js` | Effective trader-profile create (`wf-profile-save`) and the account/contract task wrappers. Profile creation still writes `A.db.traders` directly (next phase). |
| `js/v-taichinh.js`, `js/mini.js`, `js/v-dieuhanh.js`, `js/v-vanhanh.js` | Tightly coupled finance / session / operations flows with cross-domain writes; the finance safety rule forbids changing calculations. See `PHASE_12_REMAINING_FEATURE_BOUNDARIES.md`. |
| `js/core.js` (bootstrap, router, shell) | 13B assessment below. |

### 13B — App boundary assessment

`core.js` combines utilities (`A.U`, used by every file), `A.db` persistence and indexes, the router and route guards (wrapped by `auth.js`), chrome/render, modal and drawer stack, and the guide. Every legacy file depends on it at load time, and `auth.js` decorates `A.route`/`A.render`/`A.load`. Splitting bootstrap/router/shell into `src/app/` would change the load-time contract of all 18 legacy files for no behavioral gain, so **core.js stays legacy**. Future work: move `A.U` pure utilities to `src/shared/utils/`, then router/shell to `src/app/`, once the legacy views no longer rely on load-order decoration.

## 7. 13C — Dead / overridden code removed during the run

| Removed | Proof |
|---|---|
| First-generation contract section in `v-tieuthuong.js` (103 lines) | Every key is re-registered by the V1 block during the same load, before any capture (Phase 11 registry comparison). |
| `ct-view` override IIFE and the detail block's `ct-view` | Re-assigned by V1 `ct-view` before any event. |
| `workflow.js` `openContract()` + `contractFilesHtml()` | Local functions with no caller (source search). |

Kept although unreachable: see §6. Nothing was removed on intuition.

## 8. 13D — Mock boundary

`frontend/data.js` (`window.DATA`, `DATA.build()`) is the mock source **now**. It is loaded first by `index.html` and consumed by `core.js` `A.fresh()`/`A.load()`. Moving it into `src/mocks/` would change a deployment path for no behavioral gain, so **it stays**. Future: feature repositories switch from `APP.data` to `src/shared/api` clients domain by domain; `data.js` then becomes a dev-only fixture.

## 9. Future API boundary and Spring Boot path

See `docs/api/FRONTEND_BACKEND_CONTRACT_GUIDE.md`.

1. Keep service signatures stable; add an API client in `src/shared/api/`.
2. Per feature, add an API-backed repository with the same methods. Switch one feature at a time behind the same service.
3. Contract use cases become single backend `@Transactional` commands; the frontend service then calls one endpoint instead of orchestrating three aggregates.
4. Backend becomes authoritative for validation, RBAC and state transitions; frontend checks remain UX pre-checks.

## 10. 13G — Final validation and remaining legacy usage

| Check | Result |
|---|---|
| `node --check` (all 34 runtime JS files: `data.js`, 18 legacy, 15 `src/`) | PASS |
| Routes | 21/21 |
| Storage identifiers | 11 localStorage (`KEY`, `UIKEY`=`'choso-caolanh-ui'`, `AKEY`, `ASCHEMA_KEY`, `BKEY`, `CKEY`, `GUIDEKEY`, `LKEY`, `PKEY`, `SKEY`, `'prototype-demo-mode'`) + 1 sessionStorage (`RECENT_POINT_KEY`), unchanged |
| Permissions / roles / marketScopes | `permissions.js` untouched. `accounts.js` only appends a source registration. Account records created with the same role/scopes/status (account-store hash equal in every harness step). |
| Legacy script relative order | unchanged |
| `git diff --check` | PASS |
| Behavioral regression harness vs `cd41337` (229 steps) | **BEHAVIOUR EQUAL** |
| Create / lifecycle / accounts smoke tests | PASS 14/14, 15/15 (byte-identical to baseline), 6/6 (toggle byte-identical) |
| Effective `A.ACT`/`A.VIEWS`/`A.IN`/`A.CH` key sets | identical to baseline |

Remaining direct legacy usage in runtime JS (code lines, comments excluded; baseline `cd41337` → now):

| Pattern | Baseline | Now | Remaining by file (now) |
|---|---|---|---|
| `A.db.<collection>` | 517 | 488 | v-dieuhanh 116 (DASHBOARD/SESSIONS/LAYOUT), mini 121 (MINI APP), v-taichinh 88 (FINANCE), v-tieuthuong 59 (POINT/STRUCTURAL + WIZARD + TRADER DISPLAY), v-vanhanh 46 (OPERATIONS), core 23 (CORE/BOOTSTRAP/FINANCE helpers), contracts/page.js 9 (unreachable V1 create + expiry notifications), vehicles 9, workflow 7 (profile create, account task reads), v-taisan 6, v-baocao-mau 4 |
| `A.idx.<index>` | 339 | 302 | v-tieuthuong 120 (point drawer, structural workflows, wizard), v-taichinh 73, mini 49, v-dieuhanh 20, v-vanhanh 18, vehicles 9, core 5, contracts/page.js 3 (unreachable V1 create), workflow 2, v-cautruc 2, auth 1 |
| `A.save()` | 94 | 86 | legacy writers in finance, operations, sessions, structural point workflows, profile create; plus `APP.data.save` in the shared adapter |
| `localStorage.*` / `sessionStorage.*` | 30 / 2 | 30 / 2 | unchanged; only legacy stores and core/auth UI state |
| `A.VIEWS[…]` / `A.ACT…` registrations | — | — | still the runtime registry (routes and `data-act` compatibility). Contract registrations now live in `src/features/contracts/page.js`. |

Classification of remaining usage: CONTRACT (unreachable fallback only), TRADER (display and legacy wizard), BUSINESS POINT / STRUCTURAL (split/merge/conversion, collector, point drawer), FINANCE, OPERATIONS, SESSIONS / DASHBOARD, MINI APP, CORE / AUTH, WORKFLOW (profile create, account task).

## 11. Manual regression

**MANUAL BROWSER REGRESSION REQUIRED.** No browser runner was available. The headless harness replays real handlers against a stub DOM, which proves data/HTML equivalence but not visual layout, real file pickers, print windows or CSS. Checklist: `docs/frontend/FRONTEND_FINAL_REGRESSION_CHECKLIST.md`.

## 12. Known technical / product debt (documented, intentionally NOT fixed)

These were found during the master run and left unchanged at the final pre-commit review. Fixing any of them changes behavior or needs a product decision.

| Item | Current behavior | Kind |
|---|---|---|
| `vehicleFeeSnapshot` | Written only by the V1 `ct-new-save` + `vehicles.js` wrapper path, which is unreachable. The effective workflow create never snapshots vehicle fees. | Product |
| Mini App lock/unlock button | The `tt-miniapp-toggle` / `tt-miniapp-copy-guide` buttons are rendered only by `ttDrawerHtmlLegacy`, which has no caller. The actions are registered but not reachable from the UI. | Product |
| `syncExpiry` | Rendering the `hop-dong` screen creates expiry notifications and contract history entries (without saving). | Technical |
| Finance cross-domain writes | Payment flows change point status via `A.refreshStall` (`core.js`); `v-taichinh.js` writes several collections directly. | Technical |
| `mini.js` cross-domain writes | Writes payments, bank entries, `pointRequests`, session records and notifications directly. | Technical |
| Legacy trader wizard | `tt-new` wizard / `tt-wizard-save` (create + allocate + seller + vehicles) is unreachable because `workflow.js` replaced `tt-new`. | Product |
| V1 `ct-new` / `ct-new-save` | Unreachable fallback create (wrapped by `vehicles.js`). | Product |
| Remaining `A.db` / `A.idx` access | 488 / 302 code references outside feature boundaries (see §10). | Technical |
