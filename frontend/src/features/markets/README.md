# Markets feature

Owns the 12-market catalog (Phase 15.5).

| File | Owns |
|---|---|
| `store.js` | `A.MARKET_CATALOG`: catalog meta merged with `D.MARKETS` (localStorage `choso-caolanh-marketcatalog`), registered as `APP.data` source `market-catalog`; `U.market`, `U.mShort` lookups. Moved from `js/marketcatalog.js` / `js/core.js`. |
| `repository.js`, `service.js` | Catalog data access and use cases (`rows`, `get`, `priceConfig`, `codeTaken`, `add`, `update`). |
| `page.js` | Route `danh-muc-cho` and its `dmc-*` actions. Moved from `js/v-danhmuccho.js`. |

Data path: `page → service → repository → APP.data source "market-catalog" → A.MARKET_CATALOG`.

`D.MARKETS` (data.js) stays the list of markets. The market's internal structure (areas/floors/rows/points) belongs to `market-layout` and `business-points`.
