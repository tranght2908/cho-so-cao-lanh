# Traders feature (profile scope)

The legacy Tiểu thương view remains in `frontend/js/v-tieuthuong.js` during the migration.

Phase 6 migrated only the trader **profile** data path:

`view → APP.features.traders.service → repository → APP.data → A.db.traders / A.save()`

| Service method | Purpose |
|---|---|
| `list()` | Live `A.db.traders` array (read-only for callers). |
| `getProfile(id)` | Trader record by ID, or `null`. |
| `idNoTaken(idNo, excludeId)` | Duplicate identity-number check used by profile edit. |
| `updateProfile(id, { name, idNo, phone, idType })` | In-memory update of profile fields only. |
| `updateDocuments(id, files, updatedAt)` | Replaces only the given `trader.docFiles` keys with a copy of the captured metadata plus `updatedAt`. |
| `save()` | Persists through the existing legacy save (`APP.data.save()` → `A.save()`). |

Updates do not save by themselves: the legacy edit flow writes an audit log entry between mutation and persistence, and that order is preserved by calling `save()` explicitly.

Out of scope and still legacy: trader creation (`workflow.js` `tt-new` / `wf-profile-save`, legacy `tt-wizard-save`), contracts, business-point allocation, stall mutation, account readiness and Mini App. The repository must never write `stalls`, `contractId`, account linkage, invoices, payments or point-allocation state.

This layer does not create a storage key, duplicate trader data, or change the trader schema.
