# Authorization

Single owner of RBAC (Phase 15.4).

| File | Owns |
|---|---|
| `permissions.js` | Permission catalog, 6-role seed, versioned migrations, persisted role/permission state (`choso-caolanh-permissions`), `A.PERM` API. Moved unchanged from `js/permissions.js`. |
| `guards.js` | `U.can(screen)` (screen permission + market applicability) and `A.canDo(action, market)` (action permission + selected-market match). |

Rules: add permission keys only in `permissions.js`; check them only through `U.can` / `A.canDo`. Do not duplicate role or scope checks elsewhere.
