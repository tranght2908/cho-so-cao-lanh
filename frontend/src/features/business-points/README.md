# Business points feature

Business point = Điểm kinh doanh. The legacy runtime stores these records in `A.db.stalls`; this feature hides that collection name.

| Layer | Method | Purpose |
|---|---|---|
| repository | `list()`, `getById(id)` | Live records via `APP.data` (`getCollection/findById('stalls')`). |
| repository | `occupy(id, traderId, contractId)` | `status='thue'`, links set (contract create). |
| repository | `vacate(id)` | `status='trong'`, links cleared (contract release). |
| repository | `addHistory(id, entry)` | Prepend a point history line. |
| service | `list`, `get`, `occupy`, `vacate`, `addHistory` | Facade used by display consumers and by the contracts use cases. |

The writes are in-memory only. They are called exclusively by the contracts service, which saves once per use case. Structural changes (split, merge, conversion, `pointRequests`), collector assignment and `A.refreshStall` status refresh stay on their legacy paths in `js/v-tieuthuong.js`, `js/v-cautruc.js` and `js/core.js`.

The point table/drawer UI and the split/merge/conversion workflows remain in `js/v-tieuthuong.js`. They share module state with the trader UI; see `docs/frontend/PHASE_11_DOMAIN_UI_EXTRACTION.md`.

The layout tree persisted under `choso-caolanh-layout` (block/floor/zone/planned-area configuration owned by `js/v-cautruc.js`) is a separate representation. It is not wrapped, merged or synchronized here.

No storage key, data copy or schema change.
