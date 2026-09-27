# Shared utilities

`format.js` (Phase 15.2) owns the `A.U` namespace object and the pure formatters (`pad`, `esc`, `money`, `moneyShort`, `pct`, `pctTxt`, `dmy`, `per`, `days`, `sum`, `maskPhone`, `maskId`, `nowTime`) plus the prototype clock `U.today()` (reads `A.db.today`).

Domain helpers that live on `A.U` (market, business-point, fee, finance labels) belong to their features, not here.
