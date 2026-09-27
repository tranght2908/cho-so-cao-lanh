# Effective Runtime Actions Characterization

## Scope and baseline

Baseline inspected: `98808f6 docs: map trader contract and business point ownership`.

This is a source-based characterization phase. No runtime source, route, view, action, storage key, or business rule is changed. “Effective” means the value present in `window.APP.A.VIEWS` / `A.ACT` after the complete classic-script order in `frontend/index.html` has executed.

## 1. Script load order

The actual order below comes from `frontend/index.html`, not from filenames. Later scripts can replace an existing `A.VIEWS[key]` or `A.ACT[key]` value.

| Order | Script | Relevant effect |
|---:|---|---|
| 1 | `data.js` | Defines `DATA` seed/build functions. |
| 2 | `js/core.js` | Creates `window.APP` / `A`, `A.db`, `A.idx`, route/render/ACT infrastructure. |
| 3 | `src/shared/data/repository.js` | Shared compatibility data adapter. |
| 4 | `js/permissions.js` | RBAC catalog, `A.canDo` dependencies. |
| 5 | `js/accounts.js` | `A.ACCOUNTS`, linked trader accounts and account persistence. |
| 6 | `js/bankaccounts.js` | Bank configuration. |
| 7 | `js/serviceconfig.js` | Service/pricing configuration. |
| 8 | `js/marketcatalog.js` | Legacy market catalog. |
| 9 | `src/features/markets/repository.js` | Markets repository. |
| 10 | `src/features/markets/service.js` | Markets service. |
| 11 | `js/v-dieuhanh.js` | Dashboard/session features. |
| 12 | `js/v-danhmuccho.js` | Market-catalog view consumer. |
| 13 | `js/v-cautruc.js` | Initial `mat-bang` view and `A.mb*` layout helpers. |
| 14 | `js/v-tieuthuong.js` | Trader, contract, CL business-point and point-change code. |
| 15 | `js/vehicles.js` | Temporarily wraps then-current `ct-new` / `ct-new-save`. |
| 16 | `js/v-taichinh.js` | Finance views/actions. |
| 17 | `js/v-vanhanh.js` | Operations plus base Accounts view. |
| 18 | `js/v-taisan.js` | Assets. |
| 19 | `js/v-baocao-mau.js` | Report helpers. |
| 20 | `js/mini.js` | Mini App. |
| 21 | `js/workflow.js` | Final profile/contract/account workflow overrides and view wrappers. |
| 22 | `js/auth.js` | Auth route/render decorators. |

The important ordering is `v-cautruc → v-tieuthuong → vehicles → workflow → auth`. `auth.js` decorates route/render rather than replacing the trader/contract action keys characterized below.

## 2. View registration map

| View key | Registration chain in load order | Final effective implementation | Classification |
|---|---|---|---|
| `mat-bang` | `v-cautruc.js:765` `mbWorkspaceHtml` → `v-tieuthuong.js:1993` | `v-tieuthuong.js`: CL uses `clLayoutView()`, non-CL delegates to `A.mbWorkspaceHtml()` | Effective override. The original layout view remains reachable as the non-CL delegate. |
| `diem-kd` | `v-tieuthuong.js:1994` | CL uses `clLayoutView()`, non-CL `dkViewGeneric()` | Effective. |
| `tieu-thuong` | `v-tieuthuong.js:2208` | CL `ttViewCL()`, non-CL `ttViewGeneric()` | Effective; no later replacement found. |
| `hop-dong` | `v-tieuthuong.js:2814` → `v-tieuthuong.js:2998` → `v-tieuthuong.js:3013` (wrapper retaining prior view in `contractViewWithStatusFilter`) → `workflow.js:90` | `workflow.js`: `contractTaskHtml() + contractView()` where `contractView` is the final legacy view captured at workflow load | Effective wrapper chain. Earlier legacy registrations are overridden, but remain callable through captured closures where explicitly retained. |
| `tai-khoan` | `v-vanhanh.js:634` → `workflow.js:151` | `workflow.js`: `accountTaskHtml() + accountsView()` where `accountsView` is the captured v-vanhanh view | Effective wrapper chain. |

## 3. Action registration map and override chains

### Trader profile and documents

| Key | First definition | Later definition(s) / order | Final effective implementation | Classification / callers |
|---|---|---|---|---|
| `tt-new` | `v-tieuthuong.js:2643`: legacy wizard with point selection/allocation | `workflow.js:61` replaces it | `workflow.js:61`: initializes `profileDraft` and renders independent profile form | **EFFECTIVE** workflow action. The legacy wizard action is **OVERRIDDEN**, not labelled dead: its save handler and UI helpers remain in source and could be reached by another explicit caller later. Trader screen button uses `data-act="tt-new"`. |
| `wf-profile-save` | `workflow.js:74` | none | Creates only a trader profile | **EFFECTIVE**; called from workflow profile modal. |
| `wf-profile-contract` | `workflow.js:81` | none | Routes to `hop-dong`, then invokes current `A.ACT['ct-new']` with `dataset.trader` | **EFFECTIVE** cross-flow caller. |
| `tt-edit-open` | `v-tieuthuong.js:2771` | none | Sets edit state and rerenders existing drawer | **EFFECTIVE**. |
| `tt-edit-save` | `v-tieuthuong.js:2785` | none | Updates trader fields and pending document replacements, then `A.save()` | **EFFECTIVE**. |
| `tt-doc-view` | `v-tieuthuong.js:2406` | none | Opens stored trader document metadata/image preview | **EFFECTIVE**. |
| `tt-doc-replace` | `v-tieuthuong.js:2417` | none | Captures file to pending UI state; does not persist until `tt-edit-save` | **EFFECTIVE**. |
| `tt-wizard-save` | `v-tieuthuong.js:2712` | none | Performs the legacy create-trader-and-allocate-point transaction | **HELPER / legacy action**. It is not the final standard create entry because `tt-new` was replaced. No source evidence supports calling it dead. |

### Contract actions

| Key | First definition | Later definition(s) / order | Final effective implementation | Classification / callers |
|---|---|---|---|---|
| `ct-new` | `v-tieuthuong.js:2880` | `v-tieuthuong.js:3023` replaces first → `vehicles.js:173` wraps then-current handler → `workflow.js:123` replaces it | `workflow.js:123`: permission check then `workflowOpenContract(dataset.trader)` | **EFFECTIVE**. Both legacy definitions and the vehicle wrapper are **OVERRIDDEN** for this key. Calls come from contract toolbar, `wf-profile-contract`, and workflow task actions. |
| `wf-contract-open` | `workflow.js:122` | none | Calls `workflowOpenContract(traderId)` | **EFFECTIVE**; contract “Cần xử lý” task. |
| `wf-contract-save` | `workflow.js:132` | none | Creates contract, allocates point, links trader, saves | **EFFECTIVE** command. |
| `ct-view` | `v-tieuthuong.js:2943` → `v-tieuthuong.js:2950` → `v-tieuthuong.js:3022` | none later | Opens `A.contractDetailLayoutV2(c)` when available, otherwise `contractDetail(c)` | **EFFECTIVE** final legacy handler. Called by contract rows and workflow success modal. |
| `ct-renew` | `v-tieuthuong.js:3037` | none | Calls the current final `A.ACT['ct-new']` with `dataset.id` after permission check | **EFFECTIVE**, but it opens the creation path; it does not itself create/extend a contract. |
| `ct-extend`, `ct-extend-save` | older legacy definitions at 2841/2849; later aliases at 3040/3041 | later aliases win | Both delegate to final `ct-renew` | **EFFECTIVE aliases**. |
| `ct-terminate`, `ct-terminate-save` | `v-tieuthuong.js:3048/3051` | none | Opens/commits termination and invokes `release(c)` | **EFFECTIVE**. |
| `ct-liquidate`, `ct-liquidate-save` | `v-tieuthuong.js:3052/3058` | none | Opens/commits liquidation and invokes `release(c)` | **EFFECTIVE**. |
| `ct-end`, `ct-end-save` | older legacy definitions at 2859/2868; aliases at 3042/3043 | later aliases win | Both delegate to liquidation actions | **EFFECTIVE aliases**; they are not independent termination commands. |
| `ct-copy-add` | `v-tieuthuong.js:3044` | none | Adds mock signed-copy metadata, sets `scanned`, logs event, saves | **EFFECTIVE** signed-document update. |
| `ct-copy-view`, `ct-print` | `v-tieuthuong.js:3045/3046` | none | View mock copy / open print window; print logs and saves | **EFFECTIVE**. |
| `ct-new-save` | legacy definitions in `v-tieuthuong.js`, wrapped in `vehicles.js` | no workflow replacement | Remains the vehicle-enhanced legacy save action, but final `ct-new` opens the workflow form whose submit action is `wf-contract-save` | **FALLBACK / currently not on effective standard create path**. Not declared dead because another caller can still open a compatible legacy modal. |

### Business point allocation/release and account readiness

| Key / helper | Final location | Effective role | Classification |
|---|---|---|---|
| `workflowOpenContract` | `workflow.js:104` | Builds effective contract form with eligible traders and vacant points | Helper for effective create. |
| `wf-contract-save` | `workflow.js:132` | The effective point-allocation write path | Effective transaction candidate. |
| `release(c)` | `v-tieuthuong.js:3047` | Releases point/trader occupancy for termination or liquidation | Effective helper called by both lifecycle saves. |
| `wf-go-stall` | `workflow.js:143` | Navigates to `mat-bang`, then invokes `A.openDkDrawer(stall)` | Effective post-create navigation. |
| `needsContract` | `workflow.js:26` | Derived query for contract task | Effective derived state. |
| `needsAccount` | `workflow.js:27` | Derived query for account task | Effective derived state. |
| `wf-account-open` | `workflow.js:152` | Validates ready trader context and opens prefilled confirmation | Effective. |
| `wf-account-create` | `workflow.js:158` | Adds `A.ACCOUNTS` trader account in `PENDING_ACTIVATION` | Effective cross-store write. |

## 4. Effective trader-create flow

```text
Trader screen “Thêm hồ sơ” button
  → data-act="tt-new"
  → final A.ACT['tt-new'] in workflow.js
  → profileDraft + renderProfile()
  → user submits data-act="wf-profile-save"
  → trader profile record is added
  → A.reindex() → A.save()
  → success modal: Create contract now / Later
```

### Source-level behaviour

1. `workflow.js:A.ACT['tt-new']` checks `A.canDo('tieu-thuong.them-moi', ui.market)`, initializes a draft with identity/contact/category/document fields, and renders a modal.
2. `wf-profile-save` validates only non-empty name, phone and identity number. It rejects an existing `idNo` only when another trader has the same `market === ui.market`.
3. It creates a trader with a generated `TT####` ID, selected current market, empty `stalls: []`, `profileStatus: 'ACTIVE'`, `source: 'STAFF'`, `docFiles`, current date `since`, and false `app`/`bank` flags.
4. It executes exactly: `A.db.traders.push(t); A.reindex(); A.save();`, clears the UI draft, and opens a success modal.
5. The success modal exposes:
   - **Create contract now:** `wf-profile-contract` routes to `#/hop-dong`, then calls final `A.ACT['ct-new']({ dataset: { trader: t.id } })`.
   - **Later:** closes and rerenders. The trader remains discoverable through `needsContract(ui.market)`.

### Answer: does effective trader create allocate a point immediately?

**NO.** The final runtime `tt-new` flow creates only `A.db.traders`. It does not read/mutate `A.db.stalls`, `A.db.contracts`, `A.db.invoices`, `A.ACCOUNTS`, `pointUsages`, or `directSellerAssignments`.

The opposite behaviour exists in `v-tieuthuong.js:tt-wizard-save`: it creates a trader and immediately allocates a vacant point. That path is **overridden at the `tt-new` entry action** by `workflow.js`; it remains intentionally untouched.

## 5. Effective contract-create flow

```text
Contract toolbar / workflow “Cần xử lý” / profile success CTA
  → data-act="ct-new" or "wf-contract-open"
  → final workflow.js ct-new / workflowOpenContract(traderId)
  → eligible trader + vacant point form
  → data-act="wf-contract-save"
  → contract + point occupancy + trader link mutation
  → A.save()
  → success modal with point and contract navigation
```

### Form selection rules

- When invoked from profile success, the selected trader comes from `dataset.trader`.
- Eligible traders are in the selected trader’s market (or `ui.market`) and have no `status === 'hieuluc'` contract with the same `traderId`.
- Eligible points are in that market, have `status === 'trong'`, and have no active contract with the same `stallId`.
- The form preselects the specified trader, or the first eligible trader; it preselects the first eligible point.
- Point change refreshes displayed price/physical information in the modal.

### Validation and mutation order in `workflow.js:A.ACT['wf-contract-save']`

1. Read selected trader, stall, start date and end date from form controls.
2. Reject if a record/date is missing, end precedes start, the stall is no longer `trong`, or either trader or point already has an active contract.
3. Parse optional fee lines and calculate/default the point price.
4. Build a new contract with generated `HĐ-<market>-<year>-<number>` ID, `traderId`, `stallId`, `market`, pricing snapshot, mock signed-copy metadata, `history: []`, and `status: 'hieuluc'`.
5. Append the creation history entry.
6. Mutate in this source order:
   - `A.db.contracts.push(c)`;
   - `A.reindex()`;
   - `stall.status = 'thue'`;
   - `stall.traderId = trader.id`;
   - `stall.contractId = contract.id`;
   - append stall ID to `trader.stalls` when absent;
   - prepend stall history;
   - mark the session-level recently assigned point;
   - `A.save()`.
7. Close/rerender, then show success modal and toast.

### Finance effect

**No invoice, receivable, payment, or reading is created by this handler.** It only stores `feeSnapshot` / monthly price on the new contract. Finance collections are generated/managed by finance code separately.

This is the current frontend’s primary multi-record transaction candidate: contract + point occupancy + trader point link must remain coherent.

## 6. Contract lifecycle characterization

| Operation | Final handler | Reads | Writes / status | Point and finance effect | Persistence |
|---|---|---|---|---|---|
| Create | `workflow.js:wf-contract-save` | traders, stalls, contracts, price configuration, UI file metadata | New `contracts` record with `hieuluc`; stall/trader occupancy links | Allocates point; no invoice write | `A.save()` after all mutable records are updated. |
| Renew | `v-tieuthuong.js:ct-renew`; aliases `ct-extend*` | Contract and permission | No direct contract mutation in renew handler | Calls final `ct-new` with `{dataset:{id:c.id}}`; the effective creator reads `dataset.trader`, not `dataset.id` | No save in renewal handler. This is an open-create-form behaviour, not a demonstrated renewal transaction. |
| Terminate | `ct-terminate` / `ct-terminate-save` | Contract, trader, stall; form reason/date/detail | `contract.status='chamdut'`; `termination` payload; draft attachment removed; event history | Calls `release(c)`: if no other active contract uses that stall, sets point `trong`, clears `traderId`/`contractId`, removes stall from `trader.stalls`; does not mutate invoices | `A.save()` once after release. |
| Liquidate | `ct-liquidate` / `ct-liquidate-save` | Contract, related unpaid invoices, trader/stall, draft checklist/files | `contract.status='thanhly'`, liquidation timestamps/note/checklist/copies | Requires no unpaid invoice for `contractId`; then calls same `release(c)`. Invoice records are read-only in this operation. | `A.save()` once after release. |
| Signed document update | `ct-copy-add` | Contract, selected browser file | Appends mock metadata to `signedCopies`, sets `scanned=true`, logs history event | No point/finance mutation | `A.save()`. |

## 7. Derived states

| State | Exact implementation | Stored? | Owner and consumers |
|---|---|---|---|
| `needsContract(market)` | `A.db.traders.filter(t => t.market === market && !A.db.contracts.some(c => c && c.status === 'hieuluc' && c.traderId === t.id))` | Derived, not stored | `workflow.js`; rendered by `contractTaskHtml`, then wrapped into final `A.VIEWS['hop-dong']`. |
| `needsAccount()` | For each trader: find one active contract with matching `traderId`; require a resolvable `stall(c.stallId)`; require no `A.ACCOUNTS.byTraderId(t.id)` | Derived, not stored | `workflow.js`; rendered by `accountTaskHtml`, then wrapped into final `A.VIEWS['tai-khoan']`. |
| Available contract point | Stall in market with `status === 'trong'` and no active contract whose `stallId` matches | Derived, not stored | `workflowOpenContract` and `openContract` in workflow. |

## 8. Account readiness flow

```text
trader
  + active contract (status = hieuluc, contract.traderId = trader.id)
  + resolvable contract stall
  + no A.ACCOUNTS.byTraderId(trader.id)
    → needsAccount()
    → workflow wrapper adds contextual task to Accounts screen
    → wf-account-open confirmation
    → wf-account-create calls A.ACCOUNTS.add(... PENDING_ACTIVATION ... traderId)
```

`wf-account-open` additionally requires `A.canDo('tai-khoan.tao-moi')`, resolves trader + active contract + stall, and refuses if an account already exists. It displays prefilled trader/market/point values only.

`wf-account-create` creates one record in the **separate** Accounts store, not in `A.db`:

- generated `AC-TT##` ID;
- trader name and phone;
- role `trader`;
- `marketScopes: [trader.market]`;
- `status: 'PENDING_ACTIVATION'`;
- `traderId: trader.id`.

`A.ACCOUNTS.add` owns account persistence. The later OTP activation flow belongs to auth/accounts; this account workflow does not mutate the trader, contract, or stall after creation.

## 9. Safe trader extraction surface

| Candidate | Assessment | Evidence and required dependency boundary |
|---|---|---|
| Trader list/query (`ttRowsCL`, `ttRows`, filters, `ttViewCL`, `ttViewGeneric`) | **SAFE WITH DEPENDENCY** | Reads traders plus summaries from stalls/contracts/accounts and layout paths. Can migrate as a read service if the view receives point/contract/account summary queries rather than direct cross-feature data access. |
| Trader detail read (`ttDrawerHtmlCL`, `ttDrawerHtmlLegacy`, document/card helpers) | **SAFE WITH DEPENDENCY** | Presentation-only in normal view mode, but needs read-only trader, point, contract, account and layout-path adapters. Do not move `ttUsageStore` lazy creation into a read path. |
| Profile edit (`tt-edit-open`, `tt-edit-save`) | **SAFE** | Writes only a trader’s profile fields and `docFiles`; duplicate identity check is a traders query; invokes `A.save()`. Preserve avatar compatibility from `docFiles.avatar.dataUrl`. |
| Trader document view/replace | **SAFE** | `tt-doc-replace` holds pending UI state; `tt-edit-save` is the sole persistence command. Keep FileReader/mock metadata semantics unchanged. |
| Effective trader profile create | **SAFE WITH DEPENDENCY** | Effective workflow command writes only traders, but is currently located in `workflow.js` and uses `A.ttDocDefs` supplied by legacy trader file. Extract only after a compatibility document-definition provider is identified. |
| Legacy `tt-wizard-save` | **NOT SAFE YET** | Writes traders, stalls, point usages, direct-seller assignments and possible vehicle data. It is a multi-domain allocation transaction. |
| Contract create/terminate/liquidate | **NOT SAFE YET** | Mutate contract, stall and trader; liquidation additionally relies on finance invoices. |
| Point structure change actions | **NOT SAFE YET** | Mutate point requests/stalls and rely on contract preconditions/layout mapping. |
| Account creation readiness command | **NOT SAFE YET** | Reads `A.db` but writes separate `A.ACCOUNTS` store; needs a deliberate cross-store boundary. |

## 10. Code intentionally left untouched

- All legacy `A.VIEWS` and `A.ACT` registrations, including overridden definitions and aliases.
- `vehicles.js` legacy `ct-new` / `ct-new-save` wrapper. It is overridden for standard `ct-new` after `workflow.js` loads, but may remain relevant to a legacy-compatible modal path.
- The legacy trader allocation wizard and its `tt-wizard-save` action.
- `workflow.js` direct `A.db` and `A.ACCOUNTS` access.
- Contract status, point occupancy, finance checks, RBAC checks, storage schema and all `data-act` names.

No implementation is called dead solely because another registration overrides it. Cleanup/removal needs a dedicated phase with caller characterization and regression coverage.

## 11. Recommended Phase 6 scope

### Exact scope: Trader profile read + edit/document data boundary only

Do **not** migrate all Traders. Keep point allocation, contract lifecycle, account readiness, legacy wizard and contract/point writes out of scope.

Proposed exact extraction candidates from `v-tieuthuong.js`:

- read/query helpers: `ttRowsCL`, `ttRows`, `ttSectionsOf`, `ttSectionNamesOf`, `ttCatsOf`, `ttLinkedAccount`, and read-only profile/detail helpers;
- profile edit/document command: `tt-edit-open`, `tt-edit-save`, `tt-doc-view`, `tt-doc-replace`, `ttCaptureFile` and document label/preview helpers;
- one real consumer: final `A.VIEWS['tieu-thuong']` remains legacy but obtains list/detail data through `APP.features.traders.service`.

### Collections and dependencies

- Primary collection: `A.db.traders` via shared `APP.data`.
- Read dependencies only: `A.db.stalls`, `A.db.contracts`, `A.ACCOUNTS`, and layout-path helpers for display.
- Write scope: only existing trader fields and `trader.docFiles` through the existing save delegation. No stall, contract, invoice, account or localStorage schema mutation.

### Expected Phase 6 runtime files

- New: `frontend/src/features/traders/repository.js`, `service.js`, `README.md`.
- Modified: `frontend/index.html` only to load the two feature scripts in dependency order.
- Modified: `frontend/js/v-tieuthuong.js` only for the migrated Trader read/edit/document consumer boundary.
- Possibly modified: `frontend/src/shared/data/repository.js` only if an existing generic adapter method is demonstrably missing. No change to `core.js`, `workflow.js`, `v-cautruc.js`, `v-taichinh.js`, `accounts.js`, or `data.js` in this phase.

### Regression checklist for Phase 6

- Trader list: CL and non-CL selection, filter/search and pagination.
- Trader detail: point/contract/account summary and navigation buttons.
- Trader edit: name, identity number, phone, duplicate validation, save/reload.
- Documents: view image/metadata, replace document, save/cancel and avatar in authenticated header.
- Scope/RBAC: one permitted and one denied role.
- Neighbor checks: contract task, business-point drawer, Mini App profile, auth header/avatar.

The next phase must retain `data-act` names and the existing `A.VIEWS['tieu-thuong']` registration until its replacement is characterized and verified.
