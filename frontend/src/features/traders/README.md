# Traders feature

The legacy Tiểu thương view remains in `frontend/js/v-tieuthuong.js`. Its data path is:

`view → APP.features.traders.service → repository → APP.data → A.db.traders / A.save()`

| Service method | Purpose |
|---|---|
| `list()` | Live `A.db.traders` array (read-only for callers). |
| `getProfile(id)` | Trader record by ID, or `null`. |
| `idNoTaken(idNo, excludeId)` | Duplicate identity-number check used by profile edit. |
| `updateProfile(id, { name, idNo, phone, idType })` | In-memory update of profile fields only. |
| `updateDocuments(id, files, updatedAt)` | Replaces only the given `trader.docFiles` keys with a copy of the captured metadata plus `updatedAt`. |
| `linkPoint(id, pointId)` / `unlinkPoint(id, pointId)` | `trader.stalls` link maintenance, called only by the contracts use cases (create / release). |
| `save()` | Persists through `APP.data.save()` → `A.save()`. |

Updates do not save by themselves. The profile edit flow writes an audit log entry between mutation and persistence, and contract use cases save once for all aggregates.

Still legacy: trader creation (`workflow.js` `tt-new` / `wf-profile-save`) and the unreachable legacy wizard (`tt-wizard-*`). The trader list/drawer UI also stays in `js/v-tieuthuong.js` because it shares module state with the business-point UI and the wizard.

No storage key, data duplicate or schema change.
