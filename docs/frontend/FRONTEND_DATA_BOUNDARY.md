# Frontend Data Boundary

## Current

```text
View / handler
→ APP.db
→ APP.save()
→ localStorage
```

Legacy views and handlers still use this path. It is the source of truth for the prototype and remains unchanged in Phase 2.

## Transition

```text
View
→ Feature service
→ Feature repository
→ Shared data adapter (APP.data)
→ APP.db / APP.save()
```

Phase 2 introduces only the shared, domain-neutral adapter:

- `APP.data.getDb()`
- `APP.data.getCollection(name)`
- `APP.data.findById(collectionName, id)`
- `APP.data.save()`

The adapter does not contain business collection names, mutations, storage keys or localStorage access.

## Future

```text
View
→ Feature service
→ Feature repository
→ API adapter
→ shared/api
→ Spring Boot
→ Database
```

## Rules

- Views must not access localStorage directly.
- Feature code must not know Spring Boot implementation details.
- Shared code must not know Trader, Contract or another business domain.
- Repositories own data access.
- Services own frontend use-case orchestration.
- Backend will be authoritative for business validation, authorization, state transitions and financial consistency.
- Mock data remains authoritative for the prototype until an API migration reaches parity.
