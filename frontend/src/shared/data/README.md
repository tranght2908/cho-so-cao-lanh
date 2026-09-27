# Shared data boundary

`repository.js` is a domain-neutral compatibility adapter over the current legacy runtime:

```text
Feature repository
→ APP.data
→ APP.db / APP.save() / APP.reindex()   (mock legacy source now)
```

| Method | Purpose |
|---|---|
| `getDb()`, `getCollection(name)`, `findById(collection, id)` | Live legacy references (read-only for callers). |
| `save()` | Delegates to `A.save()`. |
| `reindex()` | Delegates to `A.reindex()` (added in Phase 9; the legacy create command rebuilds indexes after an insert). |
| `registerSource(name, source)` / `getSource(name)` | Legacy stores with their own persistence (`market-catalog`, `accounts`) expose themselves to feature repositories. |

It does not know traders, contracts, invoices or any business collection. It does not create a storage key, clone state, migrate data, or replace `APP.db` / `APP.save()`.

When the Spring Boot API arrives, feature repositories switch from `APP.data` to an API client in `src/shared/api/`. Services and views keep their contracts.
