# Frontend regression harness

**Purpose.** Protect behaviour during the legacy-JS elimination (`docs/architecture/LEGACY_JS_ELIMINATION_PLAN.md`, Phase 15). Each migration batch moves code between files, and this suite proves that the running prototype behaves the same as the approved baseline.

This is a **frontend prototype regression harness**: Node `vm` + stub DOM, fixed clock (`2026-05-15T09:30Z`), seeded `Math.random`. It replays the real `A.ACT`/`A.IN`/`A.CH` handlers and compares state and rendered HTML hashes. It is **not** production browser/E2E coverage: CSS, layout, real file pickers, print windows and real browser events are not exercised. Manual browser regression (`docs/frontend/FRONTEND_FINAL_REGRESSION_CHECKLIST.md`) is still required for visual changes.

It is test infrastructure only. `frontend/index.html` does not reference it, it adds no dependency, and it never writes to the runtime.

## Run

```sh
node frontend/tests/regression/run.js
```

The only requirement is Node (tested with v24); no package manager or framework is involved. Exit code `0` means every check passed; `1` means a check failed, and the failing checks are printed with details.

## What is checked

| Check | Source |
|---|---|
| Every script in `frontend/index.html` exists and compiles; the runtime boots headless | real `<script src>` order parsed from `index.html` (`harness.indexScripts`), never a second list |
| Registry counts: 21 views, 393 actions, 62 input handlers, 149 change handlers | `invariants.js` |
| `A.RBAC_SCHEMA` = 4 | `invariants.js` |
| Routes 21/21: each route has an `A.VIEWS` entry and is rendered by the router (`A.current === route`) for at least one of the 5 replay accounts/markets | `invariants.js` + `shape.js` |
| Storage: 11 localStorage + 1 sessionStorage identifiers, all resolved to a known key | static scan of the loaded scripts |
| APP shape before boot (`A.*` and `A.U` keys, `db`/`idx`/`current` slots, `A.D`, `A.$`) and the **initial `A.ui` structure** (byte-equal JSON) | `baseline/shape.json` |
| After boot: `A.*`, `A.U`, `A.ui` keys, full registry key sets, keys written at init, route results | `baseline/shape.json` |
| 229-step behaviour replay: all 21 routes × 5 account/market contexts; trader detail/edit; contract list/tabs/filters/detail; profile create; contract create (invalid/valid/duplicate); account readiness/creation; renew/extend alias; signed copy; print; terminate; liquidate checklist; post-mutation route renders; reload round-trip. Each step compares error, save count, toasts, and hashes of `A.db`, the account store, sessionStorage, modal HTML, view HTML and return value, plus storage keys | `baseline/trace.json` |

## Files

| File | Role |
|---|---|
| `run.js` | Suite entry point. Read-only against the baseline. |
| `harness.js` | Headless loader (`createApp`, `indexScripts`). |
| `scenarios.js` | The 229-step replay (unchanged scenarios from the Phase 13 harness). |
| `compare.js` | Step-by-step comparison, plus stripping of raw HTML when persisting. |
| `shape.js` | Script compile check, APP/`A.ui` shape, registry, routes, storage identifiers. |
| `invariants.js` | Approved counts, checked independently of the baseline. |
| `update-baseline.js` | **Explicit** baseline refresh. |
| `baseline/` | Approved baseline: `meta.json` (commit, date, reason), `shape.json`, `trace.json`. |

The persisted trace keeps hashes only. Raw HTML is used only to show the **current** side of a differing step. To see the baseline HTML, check out the commit named in `baseline/meta.json` and inspect it there.

## Baseline

The current baseline is the **approved Phase 15.1 runtime (commit `20b9a11`)**. It was cross-checked against the earlier scratchpad traces of `4a1119d` and of Phase 15.1: 0 differing steps.

`run.js` **never** regenerates the baseline. Refreshing it is a deliberate developer action, taken only after a phase has been reviewed and approved (or when a phase intentionally changes behaviour):

```sh
node frontend/tests/regression/update-baseline.js --label "Phase 15.x approved runtime" --reason "<approved phase and why behaviour/shape changed>"
```

- Without `--reason`, it refuses.
- It refuses when runtime files under `frontend/` (outside `tests/`) have uncommitted changes, so every baseline maps to a commit. `--allow-dirty` exists only for a deliberate exception and is recorded in `meta.json`.
- It refuses when the replay has step errors.
- It does **not** change `invariants.js`. If an approved phase intentionally changes counts (for example, deleting obsolete actions), edit `invariants.js` by hand in the same change and record the reason in the plan document.

Review the resulting `baseline/` diff before committing it together with the phase.
