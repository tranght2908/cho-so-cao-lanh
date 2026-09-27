# Phase 2 Report — Frontend Foundation & Data Access Boundary

## Baseline

`9eb10a3` — `refactor: organize frontend and project documentation`

## Files created

- `frontend/src/shared/data/repository.js`
- `frontend/src/app/README.md`
- `frontend/src/shared/data/README.md`
- `frontend/src/shared/api/README.md`
- `frontend/src/shared/ui/README.md`
- `frontend/src/shared/utils/README.md`
- `frontend/src/shared/authz/README.md`
- `frontend/src/features/README.md`
- `frontend/src/mocks/README.md`
- `docs/frontend/FRONTEND_FEATURE_MAP.md`
- `docs/frontend/FRONTEND_DATA_BOUNDARY.md`
- `docs/frontend/PHASE_2_REPORT.md`

## Runtime change

`frontend/index.html` loads one new classic script directly after `js/core.js`:

```html
<script src="src/shared/data/repository.js"></script>
```

The relative order of all 18 legacy runtime scripts is unchanged. No legacy JavaScript, `data.js`, or `styles.css` content was changed.

## Repository foundation

The new namespace is `window.APP.data`; it preserves the existing global namespace and exposes a domain-neutral compatibility adapter:

- `getDb()` reads current `APP.db`.
- `getCollection(name)` returns an existing collection reference or `null`.
- `findById(collectionName, id)` reads an array collection without mutation.
- `save()` delegates to existing `APP.save()`.

The adapter has no business collection names, no localStorage key, no schema migration, no `fetch`, and does not replace `APP.db` or `APP.save()`.

## Validation

- Run `node --check` for all 18 legacy JS files and `repository.js`.
- Check the 21 existing route registrations.
- Check 11 localStorage keys and one sessionStorage key.
- Confirm the only index change is the new foundation script and legacy script order remains unchanged.
- Run `git diff --check`.

## Manual browser regression

Required. No browser/headless runner is available in this environment. Required manual checks: login, OTP, dashboard, market layout, traders, contracts, collection, debt, accounts, mini app and logout.

## Known issues intentionally untouched

- Existing `A.VIEWS` and `A.ACT` load-order overrides.
- Dual top-level and mini-app legacy authentication flows, including status-case mismatch documented in baseline.
- `tai-khoan-ngan-hang` omission from explicit `A.SCREEN_MARKET` mapping.
- Parallel market-layout representations.

## Recommended Phase 3

Choose one small, coherent feature and introduce its repository/service using `APP.data` without changing its UI, route, action IDs, permissions, storage keys or business behavior.
