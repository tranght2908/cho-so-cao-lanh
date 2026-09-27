# Mock policy

The current mock source of truth remains:

```text
frontend/data.js
plus existing runtime mock generators and localStorage-backed prototype state
```

`data.js` is a large runtime dependency and is intentionally not moved in Phase 2. Later, after the repository contract is stable, this area can contain seed data and mock repositories that implement the same feature repository contracts as API-backed repositories.

Do not create a second mock data source here yet.
