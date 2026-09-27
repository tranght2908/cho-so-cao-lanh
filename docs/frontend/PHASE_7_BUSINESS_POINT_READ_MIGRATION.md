# Phase 7 — Business Point Read / Query Data Boundary

## Baseline

- Commit: `c615ca3 refactor: migrate trader profile to feature data boundary`; working tree clean before the phase.
- Inputs: `TRADER_CONTRACT_POINT_OWNERSHIP.md`, `EFFECTIVE_RUNTIME_ACTIONS.md`, `FRONTEND_DATA_BOUNDARY.md`, `PHASE_6_TRADER_PROFILE_MIGRATION.md`, `FRONTEND_FEATURE_MAP.md`.

Target path:

```text
Trader list/detail point display (v-tieuthuong.js)
  → APP.features.businessPoints.service
  → APP.features.businessPoints.repository
  → APP.data (shared adapter, unchanged)
  → A.db.stalls
```

## Stalls vs layout tree

| | `A.db.stalls` | Layout tree `LAYOUT` |
|---|---|---|
| Persistence | part of `A.db` → `choso-caolanh-state` via `A.save()` | `choso-caolanh-layout` via `saveLayout()` in `v-cautruc.js` |
| Shape | one record per business point: `id`, `code`, `market`, `floor`, `section`, `sectionName`, `cat`, `area`, `areaType`, `status`, `traderId`, `sellerId`, `contractId`, `collectorId`, `history`, structural fields | `{ [marketId]: { blocks: [{ floors: [{ zones: [{ code, name, catMain, area, status, planned: [...] }] }] }] } }` — block/floor/zone/planned-area configuration; no point records |
| Role | business-point source of record read by contracts, finance, operations, mini app, workflow | tree navigation/display; `A.mbSelectedStalls`, `A.mbLayoutPathForPoint` map stalls into the tree |

Source analysis confirms `A.db.stalls` is the business-point record representation, so no stop condition applied. Only `A.db.stalls` is wrapped. The layout tree, its persistence, and the stall↔tree mapping are untouched; no adapter or source-of-truth decision was made.

## Read-access inventory (baseline `c615ca3`)

Occurrences in runtime JS (`db.stalls` excludes comment lines): `db.stalls` **43**, `A.idx.stall` **190**.

| File | Function / area | Access | Purpose | Feature owner | Cross-feature | Safe to migrate now? |
|---|---|---|---|---|---|---|
| `core.js` | `A.reindex` (map), bootstrap `refreshStall` forEach, demo link fix (`find`), `areaType` migration (`some`/forEach) | READ + **WRITE** (status refresh, areaType migration) | index build, load-time normalization | core / OTHER | all | No — core bootstrap |
| `core.js` | finance helpers (`refreshStall(idx.get)`, receipt label) | READ feeding WRITE | invoice status refresh / label | FINANCE | yes | No |
| `mini.js` | session points, categories, merge candidates, fixed-point checks, 35 idx lookups | READ (+ record writes in session registration) | Mini App self-service | OTHER (mini-app) | contracts, finance | Later |
| `v-baocao-mau.js` | `stallsOf` | READ | report sample | OTHER (reports) | — | Later |
| `v-dieuhanh.js` | dashboard counts, `mbZoneStalls`, zone/section drill-down | READ | dashboard / layout drill-down | OPERATIONS / MARKET-LAYOUT | layout tree | Later (layout coupling) |
| `v-vanhanh.js` | incident forms, categories, operations report | READ | incidents / reports | OPERATIONS | finance | Later |
| `v-taichinh.js` | 32 idx lookups | READ feeding WRITE (`refreshStall`, readings) | invoices, readings, payments | FINANCE | contracts | No |
| `vehicles.js` | 2 idx lookups | READ | vehicle registration display | OTHER | contracts | Later |
| `workflow.js` | `workflowOpenContract` / contract form point list, `wf-contract-save` | READ feeding WRITE | available points + allocation | CONTRACT | traders | **Frozen** |
| `v-tieuthuong.js` 1–448 | `dkSeller`, CL point table, point drawer, direct-seller | READ | point display | MARKET-LAYOUT | traders, contracts, accounts | Later |
| `v-tieuthuong.js` 449–1890 | split / merge / conversion (`push`, `idx.stall.set`, candidates) | READ + **WRITE** | structural change | STRUCTURAL POINT | contracts, layout | **Frozen** |
| `v-tieuthuong.js` 1891–2009 | `dkRows`, generic `mat-bang`/`diem-kd` views | READ | point list | MARKET-LAYOUT | traders, contracts | Later |
| `v-tieuthuong.js` 2010–2520 | trader list filters/search, section/category derivation, point card, contract history rows, placement view, point navigation | READ | trader display | TRADER (display dependency) | — | **Yes (selected)** for pure point lookups |
| `v-tieuthuong.js` 2521–2810 | legacy wizard vacant points / allocation | READ feeding WRITE | create + allocate | WORKFLOW | contracts | Frozen |
| `v-tieuthuong.js` 2811+ | contract list, create, terminate/liquidate, `release(c)` | READ feeding WRITE | contract lifecycle | CONTRACT | traders, finance | **Frozen** |

Write classes found: assign trader/contract (`wf-contract-save`, legacy `ct-new-save`, `tt-wizard-save`), release (`release(c)`), status change (`A.refreshStall`, lifecycle), split/merge/conversion (`push`, `idx.stall.set`, record updates), collector assignment (`v-cautruc.js`, persisted via `A.save()`), bootstrap migration (`core.js`). None were changed.

## Selected consumer and rationale

**`frontend/js/v-tieuthuong.js` — business-point lookups used by the trader list and trader detail display** (option 1: pure point lookup/display).

- Phase 6 explicitly left these as the "SAFE WITH DEPENDENCY" point reads of the Traders consumer; routing them through a business-point boundary removes that implicit coupling without touching the Traders feature.
- All selected sites are pure `id → record` lookups used for display/filtering. None of them feeds a mutation.
- No contract, workflow, structural or layout-tree code is involved.
- The availability query (option 3) was **not** chosen: its two live definitions sit in frozen `workflow.js` and legacy `ct-new`, so migrating it would touch the contract-create entry.

## Repository methods

| Method | Implementation | Legacy equivalent |
|---|---|---|
| `getById(id)` | `APP.data.findById('stalls', id)` | `A.idx.stall.get(id)` |

Write methods: **0**. `list`, `listByMarket` and `listAvailable` were not implemented because the selected consumer does not use them.

## Service methods

| Method | Delegates to |
|---|---|
| `get(id)` | `repository.getById(id)` |

## Availability rule

Not migrated. Legacy conditions recorded for a later phase (unchanged):

- Contract form (`workflow.js:96`, `:107`, and `v-tieuthuong.js` final legacy `ct-new`): `s.market === market && s.status === 'trong' && !A.db.contracts.some(c => active(c) && c.stallId === s.id)` (legacy variant also filters `selected ? s.id === selected : true`).
- Older legacy `ct-new` (`v-tieuthuong.js` ~2882): `s.status === 'trong' && U.rentalKind(s) === 'fixed' && (pre ? s.id === pre : U.inM(s))`.
- Legacy wizard: `s.market === d.market && s.status === 'trong'` (+ `s.cat === d.cat`).
- Mini App session: `st.market === s.marketId && U.rentalKind(st) === 'session' && st.status === 'trong' && !st.traderId && !reserved.has(st.id) && (!cat || st.cat === cat)`.

## Consumers migrated

`const BP = A.features.businessPoints.service;` was added next to the Phase 6 `TS` alias in the Tiểu thương section.

| Function | Responsibility | Before → After |
|---|---|---|
| `ttSectionsOf` | section filter derivation | `A.idx.stall.get` → `BP.get` |
| `ttSectionNamesOf` | "Khu vực" column | `A.idx.stall.get` → `BP.get` |
| `ttCatsOf` | category column/filter | `A.idx.stall.get` → `BP.get` |
| `ttSearchMatchCL` | search by point code | `A.idx.stall.get` → `BP.get` |
| `ttRowsCL` | floor filter | `A.idx.stall.get` → `BP.get` |
| `ttRowHtmlCL` | "Điểm KD" column | `A.idx.stall.get` → `BP.get` |
| `ttRows` | non-CL search by point code | `A.idx.stall.get` → `BP.get` |
| `ttViewGeneric` | non-CL "Điểm KD" column | `A.idx.stall.get` → `BP.get` |
| `ttPointCardHtml` | trader drawer section C point card | `A.idx.stall.get` → `BP.get` |

## Direct reads removed

9 `A.idx.stall` lookups (190 → 181). No `db.stalls` access was in the selected slice (43 → 43).

## Reads intentionally retained

Remaining: `db.stalls` **43** (code lines), `A.idx.stall` **181**; total **224**.

- **Collection-level WRITE: 7.** `A.db.stalls.push` ×2 (split, merge), `A.idx.stall.set` ×3 (split, merge), `core.js` `refreshStall` forEach ×1, `areaType` migration forEach ×1.
- **READ: 217.** Some of these lookups feed record-level writes inside write handlers (listed below). Classification by feature:
  - CONTRACT: `workflow.js` (3), contract section of `v-tieuthuong.js` (2811+, including `release`, create, terminate/liquidate), plus the contract-history rows in the trader drawers (`ttDrawerHtmlLegacy`, non-CL `openTraderDrawer`), which are contract display.
  - TRADER (retained): `tt-placement-view` (point-usage file, coupled to `ttActiveUsage`/`pointUsages`) and `tt-open-point` (navigation into the point drawer). These are candidates for the next slice.
  - MARKET-LAYOUT: `v-tieuthuong.js` 1–448 and 1891–2009, `v-dieuhanh.js` layout drill-down.
  - STRUCTURAL POINT: `v-tieuthuong.js` 449–1890 (49 idx + candidates/code checks).
  - WORKFLOW: legacy wizard (`v-tieuthuong.js` 2521–2810).
  - FINANCE: `v-taichinh.js` (32), `core.js` finance helpers (2).
  - OPERATIONS: `v-vanhanh.js` (15 total), `v-dieuhanh.js` dashboard counts.
  - OTHER: `mini.js` (41), `vehicles.js` (2), `v-baocao-mau.js` (1), `core.js` index/bootstrap.

## All writes intentionally retained

Every record-level and collection-level stall write is unchanged: `stall.status/traderId/contractId` in contract create (`wf-contract-save`, legacy `ct-new-save`, `tt-wizard-save`), `trader.stalls` link, point history, recent-point marker, `release(c)`, `A.refreshStall`, collector assignment, split/merge/conversion execution and index updates, `core.js` bootstrap migration, and the layout tree persistence.

## Cross-feature dependencies

- Traders consumer → BusinessPoints service (read). The Traders feature files were not changed and do not read stalls.
- BusinessPoints does not depend on Markets, Traders, Contracts or the layout tree.
- `ttPointPath` still calls `A.mbLayoutPathForPoint` (layout tree, MARKET-LAYOUT), and `ttUsage*` still reads `A.db.pointUsages` and `A.idx.contract`. Both are unchanged.

## Validation

- `node --check`: PASS for 26 files (`data.js`, 18 legacy JS, shared repository, Markets ×2, Traders ×2, Business points ×2).
- Routes: 21/21.
- Storage: 11 localStorage keys (`UIKEY` = `'choso-caolanh-ui'`) + 1 sessionStorage key (`RECENT_POINT_KEY`), unchanged; business-points files contain no storage access.
- Legacy script relative order: unchanged (19 legacy references identical to HEAD). The new scripts load after `src/features/traders/service.js` and before `js/v-dieuhanh.js` / `js/v-tieuthuong.js`.
- `git diff --check`: PASS.
- Architecture smoke test (Node `vm`, real `DATA.build()`: 332 stalls, 275 traders): **PASS 21/21**.
  - Namespaces are present, Traders is preserved, and the repository/service expose 0 write methods.
  - Stall IDs are unique. For every stall, `get(id) === A.idx.stall.get(id)` and it returns the live record. An unknown ID returns `null` (legacy `undefined`; both falsy, and every migrated site either guards with `filter(Boolean)` / `if (!st)` / `st &&` or dereferences it in both versions).
  - Old vs new output is identical across all 275 traders for `ttSectionsOf`, `ttSectionNamesOf`, `ttCatsOf`, the `ttRowHtmlCL` points, the `ttViewGeneric` codes and the `ttPointCardHtml` lookup. It is also identical for the `ttRowsCL` floor filter on every floor and for the CL and non-CL point-code search.
  - Reads do not mutate `A.db` (stalls, contracts and traders unchanged), trigger no save, and create no storage key.
  - The Phase 6 traders smoke test still passes 23/23.
- Index consistency: every runtime stall insertion (split, merge) also calls `A.idx.stall.set`, and no code removes stalls, so the linear `findById` matches the Map lookup.
- Performance note: a linear lookup instead of the Map costs about 1.0 ms per trader-list render versus about 0.07 ms, measured over 275 traders × 332 stalls. This is negligible for the prototype. If needed, an indexed lookup would require a generic shared-adapter capability, which is out of scope here.

## Manual regression

**MANUAL TEST REQUIRED** — no browser runner.

- [ ] Login
- [ ] Mặt bằng mở bình thường
- [ ] Danh sách/hiển thị điểm đúng
- [ ] Tiểu thương mở bình thường (CL: tầng/khu/ngành hàng filters, search by point code; non-CL: "Điểm KD" column + search)
- [ ] Chi tiết trader vẫn hiển thị điểm đúng (section C point cards)
- [ ] Hợp đồng mở bình thường
- [ ] Mở form tạo hợp đồng
- [ ] Danh sách điểm khả dụng giống baseline
- [ ] KHÔNG cần save hợp đồng mới nếu chỉ test read
- [ ] Danh mục chợ vẫn hoạt động
- [ ] Logout
- [ ] Console không có lỗi mới

## Recommended Phase 8

Business-point read slice for the **Mặt bằng / point table (MARKET-LAYOUT display)**. Move the pure `id → point` lookups in `v-tieuthuong.js` 1–448 (`dkSeller`, CL table rows, point drawer display) and the trader-drawer leftovers (`tt-open-point`, `tt-placement-view` lookup) to `BusinessPoints.service.get`. Add a `listByMarket(marketId)` only if one of those consumers uses `s.market === marketId` filtering verbatim. Keep the layout tree, split/merge/conversion and the contract-availability query (`workflow.js`) frozen until the Contracts phase. At that point the availability condition above should be characterized against `DATA.build()` and extracted as a query.
