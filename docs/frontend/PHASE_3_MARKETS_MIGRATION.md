# Phase 3 — Markets Migration

## Baseline

`b278372` — `refactor: establish frontend data access foundation`

## CURRENT IMPLEMENTATION

- Route: `#/danh-muc-cho`, registered in `frontend/js/core.js` menu and `A.SCREEN_MARKET` as `CROSS`.
- View: `frontend/js/v-danhmuccho.js`, `A.VIEWS['danh-muc-cho']`.
- View events: `dmc-search`, `dmc-rank`, `dmc-status`; actions `dmc-reset`, `dmc-csv`, `dmc-open`, `dmc-price`, `dmc-new`, `dmc-edit`, `dmc-save`.
- Legacy catalog owner: `frontend/js/marketcatalog.js`, exposed as `APP.MARKET_CATALOG`.
- The catalog is not an `APP.db` collection. It merges built-in `APP.D.MARKETS` with catalog metadata persisted under the existing `choso-caolanh-marketcatalog` key.

## DATA USED

- `DATA.MARKETS`: authoritative built-in 12-market master, including names and addresses.
- `MARKET_CATALOG` metadata: rank, unit, manager, phone, price config, status, audit metadata, plus custom catalog-only markets.
- `DATA.STAFF` and `APP.ACCOUNTS` are read only to derive a default manager while catalog seed is built.
- `APP.ui.dmcFilter`: view-local filter state.

## READ OPERATIONS

- List merged rows: `MARKET_CATALOG.rows()`.
- Get one row: `MARKET_CATALOG.get(id)`.
- Get price configuration: `MARKET_CATALOG.priceConfig(id)`.
- Read rank/status/price configuration reference values.
- Check code availability: `MARKET_CATALOG.codeTaken(code, excludeId)`.

## WRITE OPERATIONS

- Add catalog-only market: `MARKET_CATALOG.add(record, user)`.
- Update a catalog row: `MARKET_CATALOG.update(id, patch, user)`.
- The existing legacy catalog remains the only writer of `choso-caolanh-marketcatalog`; this phase does not change its payload or persistence behavior.

## DEPENDENCIES

- `core.js`: `APP`, `APP.U`, `APP.ui`, `APP.canDo`, modal/render/current-account helpers, `APP.data` foundation.
- `permissions.js`: `screen:danh-muc-cho`, `action:danh-muc-cho.tao`, `action:danh-muc-cho.sua`.
- `marketcatalog.js`: legacy source-of-truth catalog facade.
- `data.js`: `MARKETS`, staff/reference data.

## OUT OF SCOPE

- Shell market selector, market scopes and `APP.allowedMarkets`.
- Dashboard, layout, traders, contracts, sessions, finance, assets, reports and bank/pricing feature consumers.
- The `DATA.MARKETS` schema, account scopes, permissions, storage key, UI/filter/action behavior, and custom-market semantics.
- Any known baseline issue.

## MIGRATION PLAN

1. Add a domain-neutral source registry to `APP.data`; it holds references only and knows no business collection.
2. Register the existing `APP.MARKET_CATALOG` facade as the legacy source `market-catalog` after it is initialized.
3. Add markets repository and service under `frontend/src/features/markets/`.
4. Load repository/service after `marketcatalog.js` and before `v-danhmuccho.js`, without reordering any legacy script.
5. Replace the view's direct `APP.MARKET_CATALOG` consumer with `APP.features.markets.service`; retain UI state, HTML, handlers and permission checks unchanged.
6. Validate that repository/service delegate to the existing source, do not mutate reads, and do not create storage keys.

## Result

### Files created

- `frontend/src/features/markets/repository.js`
- `frontend/src/features/markets/service.js`
- `frontend/src/features/markets/README.md`

### Files modified

- `frontend/src/shared/data/repository.js`: adds the domain-neutral legacy-source registry used by feature repositories.
- `frontend/js/marketcatalog.js`: registers its existing catalog facade as the `market-catalog` source; it remains the only catalog/persistence implementation.
- `frontend/js/v-danhmuccho.js`: its existing `MC` dependency now resolves to `APP.features.markets.service`.
- `frontend/index.html`: loads the two feature files after the legacy market catalog and before legacy views. The relative order of all legacy scripts is unchanged.

### Data access migrated

The real consumer `A.VIEWS['danh-muc-cho']` and its existing `dmc-*` handlers now use `APP.features.markets.service`. The service delegates to the feature repository, which resolves the registered legacy catalog through `APP.data`.

No cross-feature market consumer was migrated. `APP.MARKET_CATALOG` still owns the existing merge, validation, write behavior, and `choso-caolanh-marketcatalog` persistence; this phase changes only the consumer's access boundary.

### Validation

- JavaScript syntax: PASS for 18 legacy files, the shared adapter, and the two Markets feature files.
- Static route compatibility: 21/21 baseline route identifiers remain present.
- Storage compatibility: 11 localStorage keys and 1 sessionStorage key remain unchanged; no new key is introduced.
- Script order: PASS; the 19 existing legacy script references retain their relative order.
- Network/API references in Markets implementation: none.
- Architecture smoke test: PASS. The service returns 12 markets, resolves a market by ID, does not mutate `A.D.MARKETS` or storage during reads, and delegates writes to the legacy catalog source.
- `git diff --check`: PASS.

### Manual browser regression

Required. No browser runner is available in this environment. Run the Phase 3 checklist: login as Admin; open, view, filter, create/edit/save the market catalog if permitted; verify ward-leader read access; verify shell market picker, dashboard, layout, and logout; and check the browser console for new errors.

### Known issues intentionally untouched

All existing market catalog data, validation, RBAC, scope, selection, UI state, messages, routes, and storage behavior are intentionally preserved. No known baseline issue was corrected in this phase.

### Recommended next feature

Migrate a small feature with a contained legacy data owner before any large cross-cutting feature. Do not migrate cross-feature market consumers until their respective feature phases.
