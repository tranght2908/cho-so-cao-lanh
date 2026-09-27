# Business points feature (read scope)

Business point = Điểm kinh doanh. The legacy runtime stores these records in `A.db.stalls`; this feature hides that collection name behind a read API.

Phase 7 data path:

`consumer → APP.features.businessPoints.service → repository → APP.data → A.db.stalls`

| Layer | Method | Purpose |
|---|---|---|
| repository | `getById(id)` | Live business-point record by ID, or `null` (`APP.data.findById('stalls', id)`). |
| service | `get(id)` | Business-point lookup for display consumers. |

Read only. There are no write methods: point allocation/release (contracts), trader linkage, status changes, collector assignment, split/merge/conversion and layout synchronization stay on their legacy paths.

The layout tree persisted under `choso-caolanh-layout` (block/floor/zone/planned-area configuration owned by `js/v-cautruc.js`) is a separate representation. It is not wrapped, merged or synchronized here.

This layer creates no storage key, copies no data and does not change the stall schema.
