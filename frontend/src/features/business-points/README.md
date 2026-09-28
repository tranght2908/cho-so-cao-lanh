# Business points feature

Business point = Điểm kinh doanh. The runtime stores these records in `A.db.stalls`; this feature hides that collection name.

Layout data model v16: `A.db.buildings` → `A.db.floors` (optional) → `A.db.rows` (Dãy) → `A.db.stalls` is the single layout graph (see `features/market-layout/store.js`). A point stores only its own fields: `id, code, market, rowId, num, area, areaTypeId, status, hasMeter, type, note, history`.

- `status` is the operational state only: `active | suspended | disputed` (`D.POINT_STATUS`).
- Industry comes from the row (`row.industry`); location from `rowId`; the fee collector from `row.collectorId`.
- Occupancy is derived from contracts; debt from overdue invoices. Nothing derived is persisted on the point.
- `type` (kiot/nhalong/ngoai/phien) is a temporary bridge for legacy pricing and market sessions; it is not the area type.

| Layer | Method | Purpose |
|---|---|---|
| repository | `list()`, `getById(id)` | Live records via `APP.data` (`getCollection/findById('stalls')`). |
| repository | `occupy(id)`, `vacate(id)` | No-ops kept for the contract use cases; occupancy is derived. |
| repository | `addHistory(id, entry)` | Prepend a point history line. |
| repository | `assignCollector(points, collectorId)` | Writes `collectorId` on the rows of those points. |
| service | `row`, `floor`, `building`, `industry`, `location`, `pointsOfRow` | Hierarchy helpers for other modules. |
| service | `usageStatus`, `occupantId`, `debtStatus`, `displayStatus`, `activeSeller` | Derived states (display keys match `D.STATUS`). |
| service | `contractOn`, `isAvailable`, `availablePoints`, … | Availability rule shared by Mặt bằng, traders and contracts. |

Compatibility adapter (temporary): `A.data.stallPrototype` adds read-only, non-enumerable getters (`cat`, `section`, `sectionName`, `floor`, `traderId`, `contractId`, `sellerId`, `collectorId`, `areaType`) so legacy readers keep working. They are never serialized, and writing them throws in strict mode. New code uses the service helpers.
