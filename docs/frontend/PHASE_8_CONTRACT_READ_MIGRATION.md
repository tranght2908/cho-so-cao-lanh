# Phase 8 — Contract Read Boundary

Part of the master run 8→13 (baseline `cd41337 refactor: add business point read boundary`, working tree clean, no commits during the run).

## Scope

Create `frontend/src/features/contracts/` (repository, service, README) for READ responsibilities over `A.db.contracts` and migrate real read consumers. No write migration.

```text
Contract consumers → APP.features.contracts.service → repository → APP.data → A.db.contracts
```

## Effective contract runtime (re-characterized from source)

`v-tieuthuong.js` contains four contract blocks that execute in order:

1. The main module (`hdFixedContract`, the first `A.VIEWS['hop-dong']`, `hd-tab`, `hd-search`, `ct-extend[-save]`, `ct-end[-save]`, `ct-new`, `ct-new-save`). All of it is **overridden** by block 4.
2. The detail-layout IIFE. It exposes `A.contractDetailLayoutV2` (effective renderer). Its `ct-view` is overridden.
3. A `ct-view` override IIFE. It is overridden again by block 4.
4. `CONTRACT_MANAGEMENT_V1`: the effective view and wrapper (`hop-dong` + status filter), `ct-view`, `ct-renew`, aliases, `ct-copy-*`, `ct-print`, `release`, terminate/liquidate. Its `ct-new`/`ct-new-save` are captured by `vehicles.js`. `workflow.js` then replaces `ct-new` and wraps `hop-dong`.

## Repository methods (read only)

| Method | Implementation | Legacy equivalent |
|---|---|---|
| `list()` | `APP.data.getCollection('contracts')` (live array) | `A.db.contracts` |
| `getById(id)` | `APP.data.findById('contracts', id)` | `A.idx.contract.get(id)` |

## Service methods

| Method | Semantics (exact legacy expression) | Used by |
|---|---|---|
| `isActive(c)` | `!!c && c.status === 'hieuluc'` | service internals |
| `list()` | live array | `hop-dong` view, `syncExpiry` |
| `get(id)` | by ID or `null` | `ct-view`, `ct-copy-view` |
| `listByTrader(traderId)` | `list().filter(c => c.traderId === traderId)` | trader drawers (contract history / non-CL modal) |
| `activeForTrader(traderId)` | `list().find(c => active && c.traderId === traderId)` | `workflow.js` `needsAccount` |
| `hasActiveForTrader(traderId)` | `list().some(c => active && c.traderId === traderId)` | `workflow.js` `needsContract` |

## Consumers migrated

| File | Consumer | Before → After |
|---|---|---|
| `v-tieuthuong.js` (V1) | effective `hop-dong` view `all` list | `A.db.contracts.filter` → `CS.list().filter` |
| `v-tieuthuong.js` (V1) | `syncExpiry` iteration | `A.db.contracts.filter` → `CS.list().filter` |
| `v-tieuthuong.js` (V1) | effective `ct-view`, `ct-copy-view` | `A.idx.contract.get` → `CS.get` |
| `v-tieuthuong.js` (detail layout) | `A.contractDetailLayoutV2` trader/point lookup | `A.idx.trader/stall.get` → `TradersService.getProfile` / `BusinessPointsService.get` (read-only) |
| `v-tieuthuong.js` (main) | `ttDrawerHtmlLegacy` history, non-CL `openTraderDrawer` contracts | `A.db.contracts.filter(traderId)` → `CS.listByTrader` |
| `workflow.js` | `needsContract`, `needsAccount` | inline `A.db.contracts.some/find` → `hasActiveForTrader` / `activeForTrader` |

## Intentionally retained

- All contract writes: create (`wf-contract-save`, V1/legacy `ct-new-save`), `ct-copy-add`, `ct-print` (history + save), terminate, liquidate, `release`, and `syncExpiry`/`expiryNotifications`. `syncExpiry` writes notifications and contract history during view render, without saving. That existing behavior is unchanged and documented.
- V1 `point`/`trader` helpers: they feed `release` and are migrated with the lifecycle in Phase 10.
- Overridden blocks 1 and 3 are candidates for Phase 11 cleanup.
- Contract reads in other domains (`mini.js`, `v-dieuhanh.js`, `v-taichinh.js`, `v-vanhanh.js`, `vehicles.js`, `core.js`) and the point drawer/structural code in `v-tieuthuong.js`.

## Validation

- `node --check`: PASS for 28 files. Routes 21/21. Storage identifiers unchanged: 11 localStorage + 1 sessionStorage (`RECENT_POINT_KEY`). Legacy script order unchanged. `git diff --check`: PASS.
- **Behavioral regression harness** (new for the master run; Node `vm` + stub DOM, fixed clock, seeded RNG, loading every script from `index.html` in order). It runs 229 steps: all 21 routes for 5 account/market combinations; trader detail/edit; contract list/tabs/filter/search/detail/copy view; profile create; contract create (invalid, valid, duplicate); account readiness and creation; renew/extend alias; signed copy; print; terminate; liquidate checklist; post-mutation route renders; reload from persisted storage. Each step compares DB hash, account store, storage keys, sessionStorage, save count, toasts, modal HTML and view HTML against a baseline snapshot of `cd41337`. **Result: BEHAVIOUR EQUAL (229/229).**
- Contracts read smoke test: PASS 10/10. Over 262 seeded contracts, `get === A.idx.contract.get` and IDs are unique. `listByTrader`, `activeForTrader` and `hasActiveForTrader` equal the legacy expressions for every trader. The repository exposes only `list,getById`. Reads do not mutate or save.

Checkpoint: contract create semantics, stall mutation and trader mutation are unchanged (proven by the harness trace). **PHASE 8 PASS.**
