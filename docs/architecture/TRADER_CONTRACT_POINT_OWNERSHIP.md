# Trader, Contract and Business-Point Ownership Mapping

## 1. Executive summary

Baseline analysed: `5508967` (`refactor: migrate markets to feature data boundary`). This is a read-only architecture analysis; it does not change runtime behaviour.

The legacy runtime does not have a one-file/one-domain boundary for the trader, contract, and business-point cluster. `frontend/js/v-tieuthuong.js` (about 3,060 lines) is the principal mixed owner. It contains:

- the Cao Lãnh business-point table/drawer and direct-seller operations;
- point split, merge, conversion and related request workflows;
- trader list, detail, documents and profile editing;
- an older trader wizard that allocates a point while creating a trader;
- contract views and termination/liquidation logic;
- compatibility exports consumed by `mini.js`, `v-cautruc.js`, and other views.

The final runtime behaviour also depends on load-order decorators. In particular, `workflow.js` is loaded after `v-tieuthuong.js` and replaces `A.ACT['tt-new']` and `A.ACT['ct-new']`, while wrapping `A.VIEWS['hop-dong']`. Therefore, the implementation that appears first in `v-tieuthuong.js` is not always the effective entry path.

The core mutable aggregate is `A.db`, persisted as `choso-caolanh-state` through `A.save()`. `A.idx.stall`, `A.idx.trader`, `A.idx.contract`, and `A.idx.invoice` are Maps rebuilt by `A.reindex()`. The market-layout tree has a separate persisted representation in `choso-caolanh-layout`, owned by `v-cautruc.js`; it is not a second stall collection, but it affects where `A.db.stalls` are displayed.

The highest-risk coupling is the three-way relationship **contract ↔ stall ↔ trader**, which is mutated in more than one legacy path and is read by finance, operations, layout, mini app, workflow, and accounts. A future migration must extract it as an explicit multi-record use case, not as one feature repository directly mutating another feature's records.

## 2. Current legacy ownership

| Runtime area | Effective legacy owner(s) | Notes |
|---|---|---|
| Trader list/detail/documents | `v-tieuthuong.js` | CL-specific and generic render branches; exports document definitions for Mini App. |
| Trader creation | `workflow.js` effective `tt-new`; older allocation wizard remains in `v-tieuthuong.js` | `workflow.js` replaces the handler after the legacy file loads. The effective workflow creates a profile without assigning a point or contract. |
| Trader edit | `v-tieuthuong.js` | Directly mutates a trader and `docFiles`; no contract/point mutation. |
| Contract list/detail/termination/liquidation | `v-tieuthuong.js`, wrapped by `workflow.js` | Multiple registrations in `v-tieuthuong.js`; final view is then wrapped by workflow task UI. |
| Contract creation | `workflow.js` effective `ct-new` / `wf-contract-save` | It creates a contract and atomically updates the linked stall and trader in one handler. |
| Business-point workspace/tree | `v-cautruc.js` | Owns `A.mb*` helpers, workspace UI, and `choso-caolanh-layout`. |
| CL business-point table/drawer | `v-tieuthuong.js`, called from `v-cautruc.js` | `A.dkTableHtml` and `A.openDkDrawer` bridge the two legacy files. |
| Point change requests, split, merge, conversion | `v-tieuthuong.js` | Uses `A.db.pointRequests` plus mutations to `A.db.stalls`; currently CL-specific in material places. |
| Point allocation / direct seller | `v-tieuthuong.js` | Historical wizard allocates point; direct seller uses `directSellerAssignments`. |
| Account persistence/link | `accounts.js` | `A.ACCOUNTS` owns `choso-caolanh-accounts`; relationship is `account.traderId`. |
| Account task / merchant account creation | `workflow.js` | Uses derived task data, then calls `A.ACCOUNTS.add`. |
| Finance effects | `v-taichinh.js` | Reads contract/stall/trader identifiers; monthly receivables are currently separately generated, not created by contract creation. |

### Effective load-order facts to preserve

```text
v-cautruc.js
  → registers A.VIEWS['mat-bang'] and A.mb* helpers
v-tieuthuong.js
  → augments CL point UI; registers trader/contract routes and handlers
workflow.js
  → replaces tt-new and ct-new; wraps hop-dong and tai-khoan views
auth.js
  → wraps route/render for authentication
```

`A.ACT['tt-new']` at approximately line 2643 and `A.ACT['ct-new']` at approximately line 3023 are later overwritten by `workflow.js`. They are public compatibility/action IDs even though their legacy definitions are no longer the final user entry paths.

## 3. `v-tieuthuong.js` inventory

Line ranges are approximate and intentionally describe coherent blocks rather than every tiny event binding.

| Lines | Block / principal functions | Responsibility and current domain owner | Reads / writes / callers | Dependencies and risk |
|---:|---|---|---|---|
| 1–124 | `dkSeller`, `dkCollectorLabel`, `dkRowsCL`, `dkViewCL`, `A.dkTableHtml` | CL business-point table projection. Target owner: market-layout/business-points UI. | Reads `stalls`, `directSellerAssignments`, traders, accounts, `ui.mb`; no business writes except filter reset/CSV. Called by the `mat-bang` workspace. | Depends on `v-cautruc` (`A.mbCurrentPoints`, path/filter helpers), accounts and workflow recent marker. **MEDIUM**. |
| 125–447 | direct-seller helpers, CL drawer, `dkcl-edit-*`, `dkds-*` | Point detail, point attribute edit, direct-seller assignment/verification. Target owner: business-points; direct seller may later be a subdomain. | Reads/writes stall fields/history and `directSellerAssignments`; uses trader/account indexes and DOM file inputs. Entry actions include `dk-open`, `dkcl-edit-save`, `dkds-save`, `dkds-verify-save`. | Directly couples point, trader identity, account permissions, and DOM drawer. **HIGH**. |
| 449–791 | split suggestion/plan helpers, `dksr-*` | Split request preparation and plan draft UI. Target owner: point-split-merge workflow, not traders. | Reads/writes `pointRequests`, `stalls`, current account and UI draft state; persists with `A.save`. | Uses request state machine, RBAC action keys, selected layout data. **HIGH**. |
| 804–1289 | `dkma*`, `dkReq*`, request list/detail/actions | Generic split/request assignment, review, approval, rejection and execution flow. Target owner: point-change workflow. | `A.db.pointRequests` is the request source; execution reads/mutates stalls and reindexes as needed. Actions: `dkreq-*`, `cl-req-open`. | Multiple actors and mutation stages; shared modal/drawer state. **HIGH**. |
| 1318–1352 | `dkMerge*`, `dkmerge-*` | Merge request flow and merge execution. Target owner: point-split-merge workflow. | Reads request records, two stalls, contracts/traders; creates result stall, sets source `structuralStatus='MERGED'`, writes request status/timeline, calls `A.save`. | Explicitly blocks unresolved contract condition but does not alter contracts. Uses `A.idx.stall` directly. **HIGH**. |
| 1361–1890 | `dkConvert*`, `dkcv-*` | Point conversion request, assignment, plan, approval, execution and postcheck. Target owner: point-change workflow. | Reads/writes `pointRequests`, stalls, contract context and request timeline; uses local draft state. | Deep point/layout/contract dependencies. **HIGH**. |
| 1961–2040 | `dkRows`, `dkViewGeneric`, `A.VIEWS['mat-bang']`, `A.VIEWS['diem-kd']`, `dk-open` | Generic business-point view/route compatibility and CL/generic route selection. Target owner: market-layout/business-points UI. | Reads stalls/traders/contracts and `ui` filters; delegates CL map/table to `clLayoutView` or `A.mbWorkspaceHtml`. | Overrides `mat-bang` registered by `v-cautruc.js`; route behaviour is script-order sensitive. **HIGH**. |
| 2045–2218 | document helpers, `ttUsage*`, trader filters/list views | Trader profile projection, document metadata, point-usage adapter, account-link display. Target owner: traders. | Reads `traders`, `stalls`, `contracts`, `pointUsages`, `A.ACCOUNTS`, layout paths; `ttUsageStore` can lazily create `A.db.pointUsages`. | Cross-feature reads are legitimate display dependencies but the lazy collection creation is persistence coupling. **MEDIUM**. |
| 2219–2467 | trader detail drawers, document view/replace, `tt-open-*` | Trader detail/edit presentation and navigation to contract, debt and business point. Target owner: traders. | Reads trader/stall/contract/account; document replace writes pending local draft until save. Actions include `tt-doc-*`, `tt-open-contract`, `tt-open-point`. | DOM drawer and cross-screen navigation. **MEDIUM**. |
| 2511–2767 | `ttNextId`, legacy wizard, `tt-wizard-*` | Legacy trader creation plus immediate point allocation, direct-seller record, point usage and vehicle persistence. Target owner: should be decomposed among traders + allocation orchestration. | Writes traders, stalls, `pointUsages`, `directSellerAssignments`, possibly vehicle data; reindexes/saves. | Its `tt-new` entry is overridden by workflow, but handler/code remains reachable indirectly and must not be deleted without characterization. **CRITICAL**. |
| 2768–2807 | `ttRerenderDrawer`, `tt-edit-*` | Trader edit and selected document replacement. Target owner: traders. | Writes one trader and its `docFiles`; validates duplicate identity number against `A.db.traders`; calls `A.save`. | Lower coupling than creation but still DOM-bound and account/avatar consumers depend on `docFiles.avatar`. **MEDIUM**. |
| 2810–3047 | contract list/detail/helpers and repeated action registrations | Contract browse/view/renew aliases/detail composition. Target owner: contracts. | Reads contracts, traders, stalls, UI filters; uses `A.idx` and permission checks. | Several later redefinitions of `hop-dong`, `hd-tab`, `ct-view`, `ct-new`; workflow wraps final view. **HIGH**. |
| 3044–3058 | signed-copy, print, `release`, terminate/liquidate handlers | Contract document metadata, print, termination and liquidation. Target owner: contracts plus contract-lifecycle orchestration. | Writes contract status/history/attachments/checklist, then `release` mutates stall and trader; liquidation reads invoices for debt; calls `A.save`. | Direct finance + point + trader mutation in compact handlers. **CRITICAL**. |

### Runtime registration inventory

- `A.VIEWS['tieu-thuong']`: legacy trader view in this file (CL/generic branch).
- `A.VIEWS['hop-dong']`: registered more than once in this file; final legacy registration is subsequently wrapped by `workflow.js`.
- `A.VIEWS['mat-bang']` and `A.VIEWS['diem-kd']`: later compatibility registrations in this file override/redirect from the earlier layout implementation.
- Significant `A.ACT` families: `dkcl-*`, `dkds-*`, `dksr-*`, `dkma-*`, `dkreq-*`, `dkmerge-*`, `dkconvert-*`, `dkcv-*`, `tt-*`, `ttw-*`, `ct-*`, `hd-*`.
- Significant `A.ui` / module-local state: `ui.mb`, `ui.f`, `ui.page`, contract tabs/filters, drawer tabs, plus local edit/draft values such as `ttWizardDraft`, `ttEditId`, `ttPendingDocs`, request plan drafts, merge drafts and conversion drafts.

## 4. Data collection map

| Collection / source | Current source of truth and persistence | Main readers | Main writers | Primary owner proposal | Important relationships |
|---|---|---|---|---|---|
| `A.db.traders` | `DATA.build()` seed → `A.load()`; `choso-caolanh-state` through `A.save()` | trader view, contracts, layout, finance, incidents, mini, workflow, auth avatar lookup | workflow profile save; legacy trader wizard; trader edit; Mini App supplemental paths | traders | `trader.id`; `market`; `stalls[]`; contracts/invoices reference `traderId`; accounts reference `traderId`. |
| `A.db.stalls` | same `A.db` state | layout, point UI, contracts, finance, incidents, mini, workflow | contract creation/release; legacy trader wizard; point change execution; layout collector assignment | market-layout / business-points | `stall.id`, `market`, location fields; `traderId`, `sellerId`, `contractId`, `collectorId`; invoices/readings/incidents reference `stallId`. |
| `A.db.contracts` | same `A.db` state | contract UI, workflow, finance, reports, mini, operations | workflow contract creation; legacy contract handlers; termination/liquidation | contracts | `contract.id`, `market`, `traderId`, `stallId`; invoices reference `contractId`. |
| `A.db.invoices` | same `A.db` state | finance, contract liquidation, reports, mini | finance period/receivable operations, not contract creation | finance | `invoice.id`, `period`, `traderId`, `stallId`, `contractId`; payment references `invoiceId`. |
| `A.db.payments` | same `A.db` state | finance/reconciliation/mini | finance collection/reconciliation | finance | `payment.invoiceId`, `traderId`, `market`; receipt/lookup fields. |
| `A.db.readings` | same `A.db` state | electricity/water screens | finance meter handlers | finance | `stallId + period`; reads stall/trader context. |
| `A.db.pointRequests` | same `A.db` state (seed in `data.js`) | CL point request, split/merge/conversion UI | `v-tieuthuong.js` request workflows; Mini App creates some request types | point-change workflow | request ID, `type`, `market`, `pointId` or `sourcePointIds`, `resultPointIds`, `requestedByTraderId`, `assignedTo`, status/timeline/plan. |
| `A.db.directSellerAssignments` | same `A.db` state (seed/generated when absent) | point drawer/table, trader wizard | point direct-seller handlers; legacy trader wizard | business-points (subdomain: direct seller) | `pointId`; optional `traderId`/`personId`; status `ACTIVE`/`ENDED`. It is informational and intentionally not a finance/contract key. |
| `A.db.pointUsages` | lazily initialized in `v-tieuthuong.js`, then persisted in `A.db` | trader point cards/details | legacy trader wizard | allocation/history adapter; needs ownership decision | `pointId`, `traderId`, `status`, dates. It duplicates part of `stall.traderId` / `trader.stalls` for per-point usage history. |
| `A.ACCOUNTS` | `accounts.js`; `choso-caolanh-accounts` plus schema key | auth/header, accounts UI, workflow, point collector labels, trader Mini App status | account administration and workflow merchant-account creation | accounts | `account.id`, `roleIds`, `marketScopes`, `status`, `traderId`. It is outside `A.db`. |
| Layout tree `LAYOUT` | `v-cautruc.js`; `choso-caolanh-layout` | `A.mb*` path/filter/workspace functions, point/trader display | layout structure handlers | market-layout | Market/block/floor/zone/row representation. It maps/render-filters `A.db.stalls`; it does not replace stalls. |

### Relationship graph

```mermaid
flowchart LR
  T[traders: trader.id]
  S[stalls: stall.id]
  C[contracts: contract.id]
  I[invoices]
  P[payments]
  A[accounts.js / A.ACCOUNTS]
  L[choso-caolanh-layout]
  R[pointRequests]
  DS[directSellerAssignments]
  PU[pointUsages]

  T -->|stalls[] / traderId| S
  C -->|traderId| T
  C -->|stallId| S
  S -->|contractId| C
  I -->|traderId, stallId, contractId| T
  I -->|stallId, contractId| S
  I -->|contractId| C
  P -->|invoiceId| I
  A -->|traderId| T
  L -->|display/map of business points| S
  R -->|pointId/sourcePointIds/resultPointIds| S
  R -->|requestedByTraderId| T
  DS -->|pointId| S
  DS -->|optional traderId| T
  PU -->|pointId| S
  PU -->|traderId| T
```

## 5. State transitions found in source

| Domain | Trigger / responsible function | Old → new state | Other mutations / persistence |
|---|---|---|---|
| Contract | `workflow.js` `wf-contract-save` | creates `status='hieuluc'` | Pushes contract, calls `A.reindex()`, sets stall `trong → thue`, `traderId`, `contractId`, appends `trader.stalls`, updates history, marks workflow-recent point, `A.save()`. |
| Contract | `v-tieuthuong.js` `ct-terminate-save` | `hieuluc → chamdut` | Adds `termination`; calls `release(c)` then `A.save()`. |
| Contract | `v-tieuthuong.js` `ct-liquidate-save` | eligible terminated/expired → `thanhly` | Requires no unpaid invoice, checklist, signed copy; saves liquidation fields; calls `release(c)` and `A.save()`. |
| Business point release | `release(c)` | `thue → trong` when no other active contract uses the same `stallId` | Clears `stall.traderId` / `stall.contractId`, removes stall from `trader.stalls`. |
| Business point allocation (legacy path) | `tt-wizard-save` in `v-tieuthuong.js` | `trong → thue` | Creates trader, point usage, direct seller assignment; sets trader/seller fields and history. This is not the effective normal `tt-new` path after workflow override. |
| Direct seller assignment | `dkds-save` and legacy wizard | existing active assignment → `ENDED`; new row → `ACTIVE` | Writes `A.db.directSellerAssignments`; point may retain `sellerId` for legacy display. |
| Point change request | split/merge/conversion action families | `DRAFT → STAFF_REVIEW → PENDING_APPROVAL → APPROVED → COMPLETED`; rejection path → `REJECTED` | Adds assignments, plans, timelines; individual type handlers contain validations. |
| Point merge structure | `dkmerge-execute` | source stalls `structuralStatus ACTIVE → MERGED`; created result point is `ACTIVE` and `status='trong'` | Creates result stall, source/result trace IDs, request `APPROVED → COMPLETED`, updates `A.idx.stall`, saves. Contract condition must be marked resolved; no contract is auto-mutated. |
| Point split / conversion | request execute handlers | source/result structural states are changed by type-specific implementation | Requests and stalls are mutated. Exact field set differs by request type and should be characterized with focused tests before extraction. |
| Trader profile | workflow `wf-profile-save` | creates profile with `profileStatus='ACTIVE'` | Does not create contract, allocate point or create account. Persists `A.db`. |
| Account | `auth.js` successful first OTP | `PENDING_ACTIVATION → ACTIVE` | Sets `activatedAt`, `lastLoginAt`, session/UI state using existing account persistence. |
| Account | account administration | `ACTIVE ↔ LOCKED` | `A.ACCOUNTS.setStatus` persists account store. |

`stalls` also have seeded operational statuses `trong`, `thue`, `no`, `ngung`, and `tranhchap`. This analysis does not infer a complete formal state machine for every seeded status because the legacy source does not provide one centralized transition owner.

## 6. Use-case map

| Use case | Effective entry UI / handler | Collections read | Collections written | Validation and cross-feature effect |
|---|---|---|---|---|
| Create trader profile | Trader screen → effective `workflow.js` `tt-new` → `wf-profile-save` | traders for duplicate document number; selected market | `traders` only | Requires name, phone, document number; creates independent profile and exposes “create contract” next step. |
| Legacy create trader + allocate point | Legacy `tt-wizard-save` | traders, chosen stall, vehicles | traders, stalls, pointUsages, directSellerAssignments, vehicle data | Requires vacant/category-compatible point, identity validation and seller fields. Retained code but no longer final normal entry. |
| Edit trader | drawer → `tt-edit-open` / `tt-edit-save` | trader list for identity collision | one trader / `docFiles` | Validates name, identity number and phone; avatar document is later consumed by auth/header. |
| View trader/documents | trader row / point drawer actions | traders, stalls, contracts, accounts, docs | none, except temporary UI drafts | Opens drawer/modal; navigation can target contract/point/debt. |
| Attach/replace trader documents | `tt-wizard-doc-pick`, `tt-doc-replace`, `tt-edit-save` | document definition and trader | `trader.docFiles` | Image data URL is captured for preview; other file types metadata only. |
| Create contract | Contract task or `ct-new` → workflow `wf-contract-save` | traders without active contract; vacant stalls; price helpers | contracts, selected stall, selected trader, workflow session marker | Validates date range, vacant stall and unique active trader/stall assignment. Does not create invoice. |
| View contract / signed copy / print | `ct-view`, `ct-copy-*`, `ct-print` | contract, trader, stall | contract history/signed copy metadata for update/print | Documents are mock metadata; print opens browser window. |
| Renew contract | `ct-renew` / alias `ct-extend` | contract/trader/stall | routed to contract-creation entry | Current code routes to creation UI rather than exposing an independent renewal aggregate. Exact resulting lifecycle semantics require characterization before migration. |
| Terminate contract | `ct-terminate` → `ct-terminate-save` | contract, trader, stall | contract termination fields; stall; trader | Requires reason/date/detail and permission; releases point immediately. |
| Liquidate contract | `ct-liquidate` → `ct-liquidate-save` | contract, related invoices, trader, stall | contract liquidation fields; stall; trader | Requires no unpaid invoices, mandatory checklist and signed copy; releases point. |
| Allocate point | effective flow is contract creation; legacy wizard also does it | stalls, trader, contracts | stall links/status, trader.stalls; contract path additionally creates contract | Current normal profile creation explicitly does not allocate point. Allocation therefore belongs to contract lifecycle today. |
| Transfer point | **NOT FOUND as a dedicated transfer use case** | — | — | “Convert point” changes point characteristics/request workflow, not a demonstrated trader/stall transfer. |
| Split point | `dksr-*` / `dkreq-*` request workflow | pointRequests, stalls, accounts | pointRequests and type-specific stall changes | Multi-stage review/approval/execution; point structure feature. |
| Merge point | `dkmerge-*` | pointRequests, two stalls, contracts/traders for condition display | request, source/result stalls | Requires adjacent points and resolved contract condition; does not mutate contracts. |
| Convert point | `dkconvert-*` / `dkcv-*` | pointRequests, source/target stalls, contract context | request and type-specific stalls | Request workflow; not trader transfer. |
| Create linked trader account | Accounts task → `wf-account-create` | trader + active contract + stall, accounts | `A.ACCOUNTS` | Requires account permission and no existing account for trader; creates `PENDING_ACTIVATION` account scoped to trader market. |

## 7. Transaction candidates

These are current multi-record mutations and should become backend transaction/use-case boundaries later. They are not recommendations to create database tables now.

1. **Create effective contract / allocate point** (`workflow.js:wf-contract-save`)
   - Create contract;
   - set point status and `traderId`/`contractId`;
   - append point to `trader.stalls`;
   - append point history and set session-only recent marker;
   - persist aggregate state.

2. **Legacy trader creation with allocation** (`v-tieuthuong.js:tt-wizard-save`)
   - Create trader;
   - allocate and categorize point;
   - create `pointUsages` history row;
   - close prior direct-seller assignment and create active assignment;
   - optionally persist vehicle drafts;
   - save shared state.

3. **Terminate or liquidate contract / release point** (`ct-terminate-save`, `ct-liquidate-save`, `release`)
   - Transition contract and store lifecycle data;
   - conditionally clear point's occupancy links;
   - remove point from `trader.stalls`;
   - liquidation additionally checks finance invoices before mutation.

4. **Execute point split/merge/conversion request**
   - Change request state/timeline;
   - create/change structural points and source/result trace links;
   - update indexes and persist;
   - may need to enforce contract preconditions. Exact per-type mutation sets should be separately characterized before backend implementation.

5. **Create merchant account from ready trader** (`workflow.js:wf-account-create`)
   - Read trader, active contract and point;
   - add account in separate `A.ACCOUNTS` persistence store;
   - does not mutate `A.db.traders` today. This is cross-store atomicity only simulated in the frontend.

## 8. Derived states

| Derived state | Formula found in source | Consumers |
|---|---|---|
| `needsContract` | Trader in selected market with no active contract whose `traderId` matches | `workflow.js` contract “Cần xử lý” section. |
| `needsAccount` | Trader with active contract, resolvable contract stall, and no `A.ACCOUNTS.byTraderId(trader.id)` | `workflow.js` account “Cần xử lý” section. |
| Point availability for contract form | Stall in market where `status === 'trong'` and no active contract uses `stallId` | workflow contract form. |
| Active point usage | `pointUsages` row with point/trader IDs and `status === 'ACTIVE'` | trader detail point start/display helpers. |
| Active direct seller | latest point assignment with `status === 'ACTIVE'` | CL point table/drawer. |
| Linked trader account / Mini App status | `A.ACCOUNTS.byTraderId(t.id)` plus `A.ACCOUNTS.authStatus` | trader detail and account workflow. |
| Recent point marker | `ui.workflowRecentStallId` or `sessionStorage` `choso-caolanh-workflow-recent-point` | CL point table/badge. |
| Contract liquidation eligibility | Contract status/date, unpaid invoice sum, checklist completeness and signed-copy count | liquidation UI/save handler. |

## 9. Target feature ownership

No folders are created in this phase. The proposed boundaries are based on the current code, not a claim that they already exist.

### `features/traders`

- **Owns:** trader profile fields, identity validation, document metadata/avatar, trader list/detail, profile status, trader-specific view state.
- **Does not own:** business-point occupancy, contract lifecycle, account records, financial receivables, layout tree.
- **Depends on:** read-only point/contract summaries for presentation; accounts query for linked-account status; layout path query for display.
- **Exposes:** trader lookup/profile query, document/avatar query, profile create/edit commands.

### `features/contracts`

- **Owns:** contract document/lifecycle fields, active/terminated/liquidated state, renewal/termination/liquidation validation, signed-copy metadata.
- **Does not own:** raw point structural model, trader profile fields, invoice/payment settlement.
- **Depends on:** trader eligibility query, allocatable point query, finance settlement query for liquidation.
- **Exposes:** contract query and lifecycle commands. Allocation/release should be orchestrated with business-point ownership, not by a repository reaching into that feature.

### `features/market-layout` (including business-points)

- **Owns:** layout tree persistence, point physical/location/category/area fields, visual workspace, structural status, collector assignment, point detail projection.
- **Does not own:** contract lifecycle, trader profile, accounts, invoices/payments.
- **Depends on:** occupancy/contract/trader summary projections, direct-seller query, permissions/scope.
- **Exposes:** point query, allocatable-point query, occupancy mutation capability through a future orchestration boundary, and structure-change request commands.

### `features/accounts`

- **Owns:** account records, roles/scopes/status, phone lookup, account ↔ `traderId` link, account persistence and activation/session integration.
- **Does not own:** trader profile or avatar copy. Avatar remains derived from trader `docFiles.avatar`.
- **Depends on:** trader identity and ready-for-account summary for the workflow command.
- **Exposes:** linked-account lookup and explicit account creation/status commands.

### Additional justified feature: `features/point-change-workflow`

Split, merge and conversion are multi-stage request processes (`pointRequests`) with their own permissions, assignment, plan, approval and execution. They should not be put inside either `traders` or a plain point repository. They can remain colocated with market-layout only if a later phase proves a small, cohesive implementation; current code size and risk support a dedicated workflow feature.

## 10. Cross-feature rule for the target architecture

Repositories should be feature-local data access only. A contracts repository must not directly mutate the market-layout repository's point as an implicit side effect, and a traders repository must not create contracts or accounts.

For current multi-record workflows, use a named orchestration/use-case layer with explicit dependencies, for example:

```text
CreateContractAndAllocatePoint
  → contract command
  → point occupancy command
  → trader point-link command
  → one persistence/transaction boundary

LiquidateContractAndReleasePoint
  → finance settlement eligibility query
  → contract lifecycle command
  → point release command
  → trader point-link command
  → one persistence/transaction boundary
```

In the mock frontend this can initially delegate to existing `A.db`/`A.save()` semantics. With Spring Boot, the equivalent orchestration becomes a backend transaction; the browser must not attempt to coordinate partial success across multiple API calls as the final authority.

## 11. Recommended migration order

1. **Characterization phase for the effective profile and contract entry paths**
   - Why first: `workflow.js` overrides key handlers; extraction without tests could migrate inactive legacy code rather than the implementation users invoke.
   - Files in scope later: `workflow.js`, the relevant `v-tieuthuong.js` view helpers, and tests/manual scripts only.
   - Risk: high due to action override compatibility.
   - Regression: profile save → needs-contract task → contract form preselection.

2. **Traders read/query boundary, then profile edit/document command boundary**
   - Why: trader list/detail/edit has a narrower write surface than point allocation and preserves avatar/account linkage.
   - Files later: trader parts of `v-tieuthuong.js`; `mini.js` consumer only after compatibility adapter exists.
   - Risk: medium; documents and avatar path are public behaviour.
   - Regression: list/filter/detail, edit, avatar header, Mini App profile.

3. **Business-point query boundary for layout consumers**
   - Why: stalls are foundational to contract and finance; start with read/query projection rather than structure mutation.
   - Files later: `v-cautruc.js` and the business-point blocks in `v-tieuthuong.js`.
   - Risk: high due to two persisted representations and `mat-bang` overrides.
   - Regression: tree, grid/table, point drawer, market scope, collector label.

4. **Contract query/lifecycle read boundary**
   - Why: contract list/detail can move before multi-record create/termination commands.
   - Files later: contract blocks in `v-tieuthuong.js`, workflow wrapper compatibility.
   - Risk: high because finance and mini app read contract links.
   - Regression: list/tab/search/detail/print/signed-copy metadata.

5. **Explicit contract-allocation orchestration migration**
   - Why: this is the first cross-domain command and must preserve contract/stall/trader atomic mutation semantics.
   - Files later: effective `workflow.js` creation actions plus focused adapters.
   - Risk: critical.
   - Regression: create profile → create contract → point state/link → account task → finance/layout visibility.

6. **Contract termination/liquidation release orchestration**
   - Why: depends on contract query, point commands and finance eligibility query.
   - Risk: critical due to debt precondition and release mutation.
   - Regression: terminate, liquidate, unpaid invoice block, released point and trader link.

7. **Point-change workflow (split, merge, conversion)**
   - Why last in this cluster: it has its own state machine and structural/history implications; it should not block foundational trader/contract boundaries.
   - Risk: critical.
   - Regression: each request type through draft/review/approval/execution/rejection; layout mapping and contract preconditions.

8. **Account creation readiness orchestration**
   - Can be migrated after trader and contract read boundaries are stable; keep account persistence separate until a future backend transaction owns it.
   - Regression: needs-account derived task, pending activation, OTP activation, account-to-trader avatar.

## 12. Spring Boot implications

Potential backend module/resource domains, without prescribing endpoints or entity schemas:

- **Trader profile:** identity, contacts, documents and profile state.
- **Business point / layout:** physical point records and structural layout/configuration; clarify whether layout configuration is versioned separately from point inventory.
- **Contract lifecycle:** contract, contract files, termination/liquidation evidence and lifecycle audit.
- **Point allocation:** the authoritative active relationship among trader, business point and contract; may be represented by contract lifecycle but must preserve history requirements.
- **Finance:** receivables, readings, payments and debt; finance owns invoice/payment correctness and exposes settlement eligibility to contract liquidation.
- **Account/identity:** account, role, scope, account-to-trader link, activation/login session.
- **Point-change workflow:** requests, assignments, plans, approvals, execution result mapping and audit timeline.

Likely backend transaction boundaries are the five candidates in section 7. The backend should be authoritative for uniqueness (active contract per trader/point), occupancy, status transitions, debt eligibility, scopes and cross-resource validation. The frontend should retain only UI drafts, display filters and non-authoritative derived display state.

## 13. Risks and unresolved questions

1. **Overridden handlers:** `tt-new` and `ct-new` have legacy and workflow versions. Migration must target effective behaviour while preserving existing `data-act` compatibility.
2. **Two point representations:** `A.db.stalls` and `choso-caolanh-layout` must remain consistent for UI. The current code treats stalls as the business-point source and layout as tree/display configuration, but a backend design needs explicit ownership/versioning confirmation.
3. **Legacy trader wizard conflicts with current workflow:** the older wizard allocates a point without creating a contract; the effective workflow creates a profile then a contract. Determine whether the legacy wizard remains a supported path or only dead/compatibility code before deleting it.
4. **`pointUsages` is an adapter with overlap:** it records active per-point usage alongside `trader.stalls`, `stall.traderId`, and contract links. Confirm whether it is required historical business data or a temporary UI adapter before modeling it as an authoritative backend resource.
5. **Direct seller semantics:** `sellerId` and `directSellerAssignments` overlap. The source explicitly says direct seller must not drive finance/contract logic, but its historical/audit role needs confirmation.
6. **Renewal semantics:** current renewal aliases call contract creation UI. Confirm whether renewal should create a new contract, extend an existing one, or both before backend lifecycle design.
7. **Contract expiry:** code shows expiry notifications, but the authoritative transition from active to expired is not centralized. Do not infer a persisted `EXPIRED` state without a confirmed rule.
8. **Point transfer:** no dedicated trader point-transfer use case was found; “conversion” is a point-structure request. Do not conflate them.
9. **Finance timing:** contract creation does not create receivables in the current workflow. Confirm the monthly-period generation boundary before coupling contract APIs to invoice generation.
10. **Account status casing in legacy Mini App path:** baseline documents an existing `ACTIVE` versus literal `active` mismatch in the legacy `mini-login-verify` override. It is intentionally untouched and must be characterized in an auth-specific phase.
