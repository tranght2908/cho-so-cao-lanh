# App boundary

`app/` owns bootstrap, routing and the application shell. Migration happens batch by batch (see `docs/architecture/LEGACY_JS_ELIMINATION_PLAN.md` §9).

| File | Owns | Since |
|---|---|---|
| `state.js` | `window.APP` creation, `A.D`, the `A.db` / `A.idx` / `A.current` slots, `A.RBAC_SCHEMA`, the `A.VIEWS` / `A.ACT` / `A.IN` / `A.CH` registries, the `A.ui` defaults and `A.$` (responsibility C01) | Phase 15.1 |

`state.js` is loaded immediately after `data.js`; every other script (legacy `js/*` and `src/*`) attaches to the existing `window.APP`. Do not create the namespace anywhere else.

Router, shell, menu, session and bootstrap still live in `frontend/js/core.js` and `frontend/js/auth.js` until batch 15.22. This folder introduces no second router, state store or bootstrap path.

```text
frontend/
├── index.html
├── data.js
├── styles.css
├── js/      # legacy runtime, migration in progress
└── src/
    ├── app/
    ├── shared/
    ├── features/
    └── mocks/
```
