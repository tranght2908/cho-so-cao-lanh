# Phase 9 — Contract Creation Orchestration

Master run 8→13. Baseline `cd41337`, and Phase 8 is in the working tree.

## Effective runtime (re-characterized)

```text
"+ Khởi tạo hợp đồng" / "Tạo hợp đồng" task / profile-success CTA / ct-renew
  → A.ACT['ct-new'] (workflow.js, final) or 'wf-contract-open'
  → workflowOpenContract(traderId)
  → data-act="wf-contract-save"  (sole effective create command)
```

Legacy `ct-new-save` implementations in `v-tieuthuong.js`, which `vehicles.js` wraps, are reachable only from forms whose opening action is overridden. They are **not** migrated in this phase (see Phase 11).

### Exact legacy mutation sequence of `wf-contract-save`

1. Validation (unchanged): trader, point, dates, `end >= start`, `point.status === 'trong'`, no active contract for the trader **or** for the point.
2. Build the contract record `c` (ID `HĐ-<market>-<year>-<max+1>`, pricing snapshot, fees, `signedCopies`, `history` with a "Khởi tạo hợp đồng" entry, `status: 'hieuluc'`).
3. `A.db.contracts.push(c)` → `A.reindex()`.
4. Set `point.status = 'thue'`, then `point.traderId = trader.id`, then `point.contractId = c.id`.
5. `trader.stalls.push(point.id)` if absent.
6. `point.history = point.history || []` → `unshift('<dd/mm/yyyy>: ký <id> với <name>')`.
7. `A.WORKFLOW.markRecentPoint(point.id)` → sets `A.ui.workflowRecentStallId` and sessionStorage `choso-caolanh-workflow-recent-point`.
8. `A.save()` → `closeModal` → `render` → success modal → toast.

No invoice, payment, reading or account is created.

## New orchestration

```text
workflow.js wf-contract-save (UI: read form, validate, build record, messages)
  → APP.features.contracts.service.createWithPointAllocation({ contract, traderId, pointId, pointHistoryEntry, beforeSave })
      ├─ contracts.repository.add(contract)                 contracts.push + APP.data.reindex()
      ├─ businessPoints.service.occupy(pointId, traderId, contractId)   → business-points repository
      ├─ traders.service.linkPoint(traderId, pointId)                   → traders repository
      ├─ businessPoints.service.addHistory(pointId, entry)              → business-points repository
      ├─ input.beforeSave()   caller-owned side effect = A.WORKFLOW.markRecentPoint(pointId)
      └─ APP.data.save()                                                exactly once
  → UI: closeModal, render, success modal, toast
```

- **Repositories keep ownership.** The Contracts repository writes only contracts. Point fields are written by the business-points repository and `trader.stalls` by the traders repository. No repository reaches into another feature's records; the cross-aggregate sequence lives in the Contracts **service** (use-case layer), which calls sibling **services**.
- **Rollback safety.** This is a frontend orchestration boundary, not a transaction. There is no rollback in the prototype, as before. **The future Spring Boot implementation MUST make this one backend `@Transactional` use case** covering the contract insert, point occupancy, trader-point link and point history.
- **Side-effect order.** The full sequence, including the workflow recent-point marker, is identical to `cd41337`: `… point.history → markRecentPoint → save`, verified by instrumentation (see below). The marker stays owned by the workflow UI. It is passed as the optional `beforeSave` callback, which the service invokes immediately before its single save without knowing what it does. (The first Phase 9 cut ran the marker after `save`; this was corrected in the final pre-commit review.)

## Code changes

| File | Change |
|---|---|
| `src/shared/data/repository.js` | + `APP.data.reindex()`: a generic, domain-neutral pass-through to `A.reindex()`, needed because the legacy create reindexes after the insert. No collection names or business logic. |
| `src/features/contracts/repository.js` | + `add(contract)` (push + reindex). |
| `src/features/contracts/service.js` | + `hasActiveForPoint`, `availablePoints(market)`, `tradersWithoutActive(market)`, `nextId(market, year, pad)`, `createWithPointAllocation(input)`. |
| `src/features/business-points/repository.js` / `service.js` | + `list()`, `occupy(id, traderId, contractId)`, `addHistory(id, entry)`. |
| `src/features/traders/repository.js` / `service.js` | + `linkPoint(id, pointId)`. |
| `js/workflow.js` | `nextContractId` → `contracts.nextId`. Form lists → `tradersWithoutActive` / `availablePoints`. Validation → `hasActiveForTrader \|\| hasActiveForPoint`. Mutation block → `createWithPointAllocation`. |

Exact availability condition, unchanged: `s.market === market && s.status === 'trong' && !contracts.some(c => c.status === 'hieuluc' && c.stallId === s.id)`.

## Checkpoint results

Smoke test `smoke-create.js` drives the real UI actions (`tt-new` → `wf-profile-save` → `ct-new` → `wf-contract-save`) on both the baseline and the working tree:

| Check | Baseline | Current |
|---|---|---|
| contract exists, `hieuluc`, indexed | PASS | PASS |
| point = `thue` with traderId/contractId | PASS | PASS |
| trader linked to point (once) | PASS | PASS |
| point history + contract history written | PASS | PASS |
| saved exactly once; persisted state contains the contract | PASS | PASS |
| `needsContract` drops the trader; `needsAccount` now lists it | PASS | PASS |
| no invoice / payment / account created | PASS | PASS |
| duplicate create rejected | PASS | PASS |
| recorded side-effect order | `contracts.push → reindex → point.status → point.traderId → point.contractId → trader.stalls.push → point.history → markRecentPoint → save` | identical |

The full regression harness gives **BEHAVIOUR EQUAL (229/229)**. `node --check`: 28 files PASS. Routes 21/21. Storage 11 + 1 unchanged. Legacy order unchanged. `git diff --check` PASS.

**PHASE 9 PASS.**
