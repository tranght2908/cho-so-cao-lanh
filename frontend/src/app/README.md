# App boundary

`app/` will own bootstrap, routing and application shell after an explicit migration phase.

Current runtime remains in `frontend/index.html` and `frontend/js/`. This folder introduces no second router, state store or bootstrap path.

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
