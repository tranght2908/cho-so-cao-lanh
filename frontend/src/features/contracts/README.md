# Contracts feature

Owns contract records (`A.db.contracts`) and the "Hợp đồng" screen (scope 10/2026).

| File | Responsibility |
|---|---|
| `repository.js` | Contract data access via `APP.data`: `list`, `getById`, contract-only writes (`add`, `addHistory`, `addSignedCopy`, legacy `applyRenewal` / `applyTermination` / `applyLiquidation`). No persistence of its own. |
| `service.js` | Reads (`list`, `get`, `listByTrader`, `isActive`, `holdsPointForTrader`, `displayStatus`, `isExpiringSoon`, …) and use cases. Current flow: `createFromRentalDraft` → `createBatchWithPointAllocation` (pre-validation + full rollback) → `createWithPointAllocation` per point. |
| `workspace.js` | The ONLY contract UI: list (KPI, filters incl. "Khoảng hiệu lực"), create form from `trader.rentalDraft` (one contract per point, own dates), success view, detail page (4 blocks, `priceTerms` snapshot), `ct-new`, `ct-view`, `ct-print`. |

Current flow: Hồ sơ tiểu thương → rental item `pending_contract` → Tạo hợp đồng (workspace) → each point its own dates →
batch create → point "Đang thuê", trader linked, `priceTerms` snapshot. From Mặt bằng a point opens the same form only when
it is registered (`pending_contract`) in a profile; otherwise the user is sent to Hồ sơ tiểu thương.

Contract display status is date-derived only: Chưa hiệu lực / Còn hiệu lực / Đã hết hạn. Expiry is a warning on the contract
and has NO side effects (point stays "Đang thuê", trader link and profile status unchanged — see `lifecycle/service.js`
`holdsPoint` and `businessPoints.service.contractOn`). Legacy PENDING_LIQUIDATION / LIQUIDATED records are read-only "(dữ liệu cũ)".

Retired (removed from the codebase): the old create form (`create.js`, `wf-contract-*`, `wf-ct-*`), the old list/popup
(`page.js`, `detail.js`, `hd-*`, `ct-copy-*`), the renew / terminate / liquidate forms and handlers (`ct-renew*`, `ct-extend*`,
`ct-end*`, `ct-terminate*`, `ct-liquidate*`) and the old available-point picker (`business-points/availability.js`).

LEGACY / DEPRECATED / NOT EXPOSED IN UI: `service.renew`, `terminate`, `liquidate`, their eligibility helpers and
`lifecycle.expireContract` are kept only for legacy data compatibility and lifecycle regressions. No current flow calls them.

This is a frontend orchestration boundary without a real transaction. The backend implementation of contract creation MUST be
one `@Transactional` use case.
