# Contracts feature

Owns contract records (`A.db.contracts`), the "Hợp đồng" screen, the contract dossier and the contract lifecycle use cases.

| File | Responsibility |
|---|---|
| `repository.js` | Contract data access via `APP.data`: `list`, `getById`, and contract-only writes `add`, `addHistory`, `addSignedCopy`, `applyTermination`, `applyLiquidation`. No persistence of its own. |
| `service.js` | Reads (`list`, `get`, `listByTrader`, `activeForTrader`, `hasActiveForTrader`, `hasActiveForPoint`, `availablePoints`, `tradersWithoutActive`, `nextId`, `isActive`) and use cases (`createWithPointAllocation`, `terminate`, `liquidate`, `addSignedCopy`, `recordEvent`). Each use case saves exactly once. |
| `detail.js` | Dossier renderer `A.contractDetailLayoutV2` (moved from `js/v-tieuthuong.js`). |
| `page.js` | Effective `hop-dong` view + status filter wrapper, `ct-*` UI handlers (moved from `js/v-tieuthuong.js`). |

Load order is significant: `detail.js` and `page.js` load immediately after `js/v-tieuthuong.js` and before `js/vehicles.js`, which wraps `ct-new`/`ct-new-save`. `js/workflow.js` then wraps `hop-dong`, replaces `ct-new` and owns the effective create form (`wf-contract-save`).

Cross-aggregate rule: the service orchestrates. Point occupancy/release goes through `APP.features.businessPoints.service` (`occupy`, `vacate`, `addHistory`) and trader links through `APP.features.traders.service` (`linkPoint`, `unlinkPoint`). The contracts repository never writes other aggregates.

This is a frontend orchestration boundary without a real transaction. The Spring Boot implementation of create/terminate/liquidate MUST be `@Transactional` use cases.

Known legacy retained: V1 `ct-new`/`ct-new-save` (plus the `vehicles.js` wrappers) are unreachable because `workflow.js` replaced their only entry, but they are the only path that snapshots vehicle fees. Removing them is a product decision. `syncExpiry` writes notifications during render (unchanged).
