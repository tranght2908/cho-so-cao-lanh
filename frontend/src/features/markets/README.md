# Markets feature

The legacy Danh mục chợ view remains in `frontend/js/v-danhmuccho.js` during the migration.

Its data path is:

`view → APP.features.markets.service → repository → APP.data source "market-catalog" → APP.MARKET_CATALOG`

`APP.MARKET_CATALOG` remains the sole owner of the existing market catalog data and its persistence behavior. This feature layer does not create a storage key, duplicate market data, or change the legacy market schema.

Other features that consume market data remain outside this phase.
