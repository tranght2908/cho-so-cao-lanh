# Shared data boundary

`repository.js` is a domain-neutral compatibility adapter over the current legacy runtime:

```text
Feature repository (future)
→ APP.data
→ APP.db / APP.save()
```

It does not know traders, contracts, invoices or any business collection. It does not create a new storage key, clone state, migrate data, or replace `APP.db` / `APP.save()`.

The Phase 2 adapter deliberately returns existing collection references for compatibility. A future feature repository must treat read results as read-only and route explicit writes through a command/service boundary.
