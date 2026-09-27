# Phase 6 — Trader Profile Read / Edit / Document Boundary

## Baseline

- Commit: `397b9e9 docs: characterize effective trader and contract runtime flows` (Phase 5).
- Working tree clean before the phase.
- Inputs: `docs/architecture/TRADER_CONTRACT_POINT_OWNERSHIP.md`, `docs/architecture/EFFECTIVE_RUNTIME_ACTIONS.md` §9 (safe extraction surface), `docs/frontend/FRONTEND_DATA_BOUNDARY.md`, `FRONTEND_FEATURE_MAP.md`, `FRONTEND_REFACTOR_RULES.md`.

Target path after this phase:

```text
Tiểu thương view / handlers (v-tieuthuong.js)
  → APP.features.traders.service
  → APP.features.traders.repository
  → APP.data (shared adapter, unchanged)
  → A.db.traders / A.save()
```

## Extraction surface (characterized from source)

| Responsibility | Legacy code | Reads | Writes | A.idx | DOM / A.ui | A.save / A.reindex | Contract / stall dependency | Decision |
|---|---|---|---|---|---|---|---|---|
| Trader list CL | `ttRowsCL` | `A.db.traders`, `f.ttcl*` | none | `A.idx.stall` (floor/section/cat/search by point code) | filter state only | none | stall read for derived filters | **SAFE WITH DEPENDENCY** — trader collection via service; stall-derived filters stay in consumer |
| Trader list non-CL | `ttRows` | `A.db.traders`, `f.tt*` | none | `A.idx.stall` (search by point code) | filter state only | none | stall read | **SAFE WITH DEPENDENCY** — same |
| Detail open | `A.ACT.trader` → `A.openTraderDrawer` | trader by id | none | was `A.idx.trader` | drawer / modal | none | drawer renders stalls, contracts, invoices, payments, accounts, vehicles (read-only) | Trader lookup migrated; drawer renderers unchanged (derived display) |
| Profile edit open / cancel | `tt-edit-open`, `tt-edit-cancel` | trader by id | UI state `ttEditId`, `ttPendingDocs` | was `A.idx.trader` | drawer rerender | none | none | **SAFE** — lookup migrated |
| Profile edit save | `tt-edit-save` | trader by id, DOM inputs, duplicate `idNo` over all traders | `name`, `idNo`, `phone`, `idType`, `docFiles[key]`; `A.db.extraLog` via `U.log` | was `A.idx.trader` | inputs, toast, rerender | exactly one `A.save()`, no reindex | none | **SAFE** — lookup, duplicate check, field/doc mutation and save migrated |
| Document read in edit mode | `ttDocRowEdit` | `ttEditId` trader `docFiles` | none | was `A.idx.trader` | HTML | none | none | **SAFE** — lookup migrated |
| Document preview | `tt-doc-view` | trader `docFiles[key]` | none | was `A.idx.trader` | modal | none | none | **SAFE** — lookup migrated; preview HTML unchanged |
| Document replace | `tt-doc-replace` + `ttCaptureFile` | `ttEditId` trader (permission market) | pending UI state only (FileReader metadata / `dataUrl`) | was `A.idx.trader` | file input, FileReader | none | none | **SAFE** — lookup migrated; capture/upload implementation unchanged; persistence happens only in `tt-edit-save` |

Profile edit does not write `trader.stalls`, `contractId`, stall status, account linkage, invoices, payments or point-allocation state (verified in source and by smoke test), so no write extraction had to be stopped.

## Repository methods (`frontend/src/features/traders/repository.js`)

| Method | Implementation | Legacy equivalent |
|---|---|---|
| `list()` | `APP.data.getCollection('traders')` — same live array | `A.db.traders` |
| `get(id)` | `APP.data.findById('traders', id)` | `A.idx.trader.get(id)` |
| `idNoTaken(idNo, excludeId)` | `list().some(x => x.idNo === idNo && x.id !== excludeId)` | inline check in `tt-edit-save` |
| `updateProfile(id, profile)` | assigns `name`, `idNo`, `phone`, `idType` in legacy order; whitelist only | inline assignments in `tt-edit-save` |
| `updateDocuments(id, files, updatedAt)` | if any keys: `docFiles = docFiles \|\| {}`; each key ← `Object.assign({}, file, { updatedAt })` | inline block in `tt-edit-save` |
| `save()` | `APP.data.save()` → `A.save()` | `A.save()` |

No DOM, HTML, modal, toast, permission, contract, stall or account logic.

## Service methods (`frontend/src/features/traders/service.js`)

`list`, `getProfile`, `idNoTaken`, `updateProfile`, `updateDocuments`, `save` — thin use-case facade over the repository, each used by a real consumer.

`updateProfile`/`updateDocuments` do not save. The legacy sequence is *mutate → `U.log` (writes `A.db.extraLog`) → `A.save()`*; keeping `save()` explicit preserves that order so the audit entry is persisted in the same single save.

## Namespace and script order

- `APP.features.traders.repository`, `APP.features.traders.service`; `APP.features` / `APP.features.traders` initialized defensively; no new globals; Markets namespace untouched.
- `index.html`: the two scripts are inserted after `src/features/markets/service.js` (after `src/shared/data/repository.js`) and before `js/v-tieuthuong.js`. The 19 legacy script references keep the same relative order.

## Consumers migrated (`frontend/js/v-tieuthuong.js`)

A module constant `const TS = A.features.traders.service;` is declared in the Tiểu thương section.

| Consumer | Before | After |
|---|---|---|
| `ttRowsCL` | `A.db.traders.filter(...)` | `TS.list().filter(...)` |
| `ttRows` | `A.db.traders.filter(...)` | `TS.list().filter(...)` |
| `ttDocRowEdit` | `A.idx.trader.get(ttEditId)` | `TS.getProfile(ttEditId)` |
| `tt-doc-view` | `A.idx.trader.get(id)` | `TS.getProfile(id)` |
| `tt-doc-replace` | `A.idx.trader.get(ttEditId)` | `TS.getProfile(ttEditId)` |
| `A.ACT.trader` | `A.idx.trader.get(id)` | `TS.getProfile(id)` |
| `tt-edit-open` | `A.idx.trader.get(id)` | `TS.getProfile(id)` |
| `tt-edit-cancel` | `A.idx.trader.get(id)` | `TS.getProfile(id)` |
| `tt-edit-save` | idx lookup, `A.db.traders.some`, inline field/doc mutation, `A.save()` | `TS.getProfile`, `TS.idNoTaken`, `TS.updateProfile`, `TS.updateDocuments`, `TS.save()` |

## Direct access removed

- `A.db.traders`: 3 profile-responsibility accesses removed (`ttRowsCL`, `ttRows`, `tt-edit-save` duplicate check).
- `A.idx.trader`: 7 profile-responsibility lookups removed (44 → 37 occurrences in the file).

## Direct access intentionally retained

Remaining `A.db.traders` in `v-tieuthuong.js`: **6**.

| Line | Code | Classification |
|---|---|---|
| 2535 | `ttNextId()` — max TT number | WORKFLOW (legacy wizard, `tt-new` overridden by `workflow.js`) |
| 2548 | `ttDuplicateCheck` — CCCD match | WORKFLOW (legacy wizard) |
| 2550 | `ttDuplicateCheck` — phone match | WORKFLOW (legacy wizard) |
| 2750 | `tt-wizard-save` — `push` + `A.idx.trader.set` | WORKFLOW / POINT/ALLOCATION (create + allocate transaction; LEGACY OVERRIDDEN entry) |
| 2883 | legacy `ct-new` trader picker | CONTRACT (LEGACY OVERRIDDEN by later `ct-new` / `workflow.js`) |
| 3023 | final legacy `ct-new` trader list | CONTRACT (LEGACY OVERRIDDEN by `workflow.js`) |

Remaining `A.idx.trader` (37) are CONTRACT (contract list/detail/terminate/liquidate/renew), POINT/ALLOCATION (business-point drawer, seller resolution, split/merge/conversion, `tt-open-point`, `dkcl-open-trader`, `tt-seller-view`), OTHER/account (`tt-miniapp-toggle`, `tt-miniapp-copy-guide` → `A.ACCOUNTS`), and WORKFLOW (legacy wizard). None belong to the profile read/edit/document responsibility.

## Cross-feature dependencies retained (SAFE WITH DEPENDENCY)

- List filters/columns (`ttSectionsOf`, `ttSectionNamesOf`, `ttCatsOf`, `ttSearchMatchCL`, point labels) read `A.idx.stall` — derived display, kept in the consumer.
- `ttMiniAppState` / `ttLinkedAccount` read `A.ACCOUNTS` — derived display.
- Drawer renderers (`ttDrawerHtmlCL`, `ttDrawerHtmlLegacy`, `ttPointCardHtml`, non-CL modal in `openTraderDrawer`) read stalls, contracts, invoices, payments, `pointUsages` (`ttUsageStore` lazy init unchanged), layout paths and `A.VEHICLES` — derived display, unchanged.
- No Contract or MarketLayout repository was pulled into Traders; no cross-feature mutation added.

## Files modified

Runtime modified: `frontend/index.html`, `frontend/js/v-tieuthuong.js`.

New: `frontend/src/features/traders/repository.js`, `frontend/src/features/traders/service.js`, `frontend/src/features/traders/README.md`, `docs/frontend/PHASE_6_TRADER_PROFILE_MIGRATION.md`.

Not modified: `workflow.js`, `core.js`, `data.js`, `styles.css`, `v-taichinh.js`, `v-cautruc.js`, `accounts.js`, `src/shared/data/repository.js`, Markets feature.

## Validation

- JavaScript syntax (`node --check`): PASS — 18 legacy JS + `data.js`, shared repository, Markets repository/service, Traders repository/service (24 files).
- Routes: 21/21 view registrations present.
- Storage: 11 localStorage keys + 1 sessionStorage key unchanged; the new files contain no storage access.
- Legacy script relative order: unchanged.
- `git diff --check`: PASS.
- Architecture smoke test (Node `vm`, real `DATA.build()` seed with 275 traders, shared adapter + traders repository/service loaded; `A.save`/`A.reindex` mirrored from `core.js`): **PASS, 23/23 checks**:
  - `list()` returns the same live `A.db.traders` reference;
  - `getProfile(id) === A.idx.trader.get(id)` for every seeded trader; trader IDs unique; unknown ID → `null`;
  - `idNoTaken` matches the legacy expression;
  - reads do not mutate `A.db`, do not save, do not touch storage;
  - `updateProfile` mutates the same record in place and changes only `name`, `idNo`, `phone`, `idType`; it does not save;
  - `updateDocuments` stores a copy with `updatedAt`, keeps other documents unchanged, and is a no-op for empty input;
  - `save()` persists once to the existing `choso-caolanh-state` key; persisted data contains the profile and document change;
  - contracts, stalls, `pointUsages`, invoices, payments unchanged; `A.db` / `A.db.traders` references and top-level schema unchanged; no new storage key.

## Manual test

**MANUAL TEST REQUIRED** — no browser runner in this environment.

- [ ] Login
- [ ] Danh sách tiểu thương mở được (CL and non-CL market)
- [ ] Search/filter giống trước (tầng, khu/dãy, ngành hàng, search; non-CL mini app filter)
- [ ] Xem chi tiết tiểu thương
- [ ] Ảnh chân dung hiển thị
- [ ] Hồ sơ/giấy tờ hiển thị
- [ ] Preview giấy tờ
- [ ] Sửa hồ sơ (duplicate CCCD message, empty-field message)
- [ ] Save
- [ ] Reload vẫn giữ dữ liệu
- [ ] Replace/update giấy tờ nếu có (and Cancel discards pending)
- [ ] Hợp đồng vẫn mở
- [ ] Mặt bằng vẫn mở
- [ ] needsContract vẫn đúng
- [ ] needsAccount vẫn đúng
- [ ] Logout
- [ ] Console không có lỗi mới

## Known issues untouched

- `get(id)` now uses `findById` (linear scan of `A.db.traders`) instead of the `A.idx.trader` Map. Equivalent while trader IDs are unique and the index is in sync (all trader-writing paths push + reindex/`idx.set`); verified for seed data. With a duplicate ID the Map would return the last record, `findById` the first — no such data exists.
- A missing trader in `A.ACT.trader` still fails inside `openTraderDrawer` (now receives `null` instead of `undefined`), as before.
- Legacy wizard, overridden `ct-new` definitions, `release(c)`, account find-or-create and all contract/point workflows are unchanged.
- `A.ttDocDefs` / `TT_DOCS` and `ttCaptureFile` remain in `v-tieuthuong.js` (consumed by `workflow.js` and `mini.js`).

## Recommended Phase 7

Trader profile **creation** boundary: move the effective `workflow.js` `wf-profile-save` persistence (`push` → `A.reindex()` → `A.save()`, `TT####` ID generation, market-scoped `idNo` check) behind `APP.features.traders.service.create(...)`, after first giving `TT_DOCS` a provider in the Traders feature. Keep `tt-new` / `wf-profile-save` action names, the success modal and the legacy `tt-wizard-save` allocation transaction untouched; contract/point allocation remains a later multi-record use case.
