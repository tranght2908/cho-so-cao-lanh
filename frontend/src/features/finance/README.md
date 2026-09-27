# Finance feature (read boundary only)

Data path: `consumer → APP.features.finance.service → repository → APP.data → A.db.invoices` (read only).

| Service method | Legacy condition | Consumers |
|---|---|---|
| `unpaidInvoicesForContract(contractId)` | `i.contractId === id && i.status !== 'paid'` | contract liquidation precondition (`contracts/page.js`) |
| `unpaidInvoicesForTrader(traderId)` | `i.traderId === id && i.status !== 'paid'` | trader drawer "Khoản chưa thanh toán" |

Amounts and debt are still computed by the unchanged core helpers (`U.due`, `U.sum`, `U.traderDebt`, `U.traderOverdue`).

Everything else in finance stays legacy in `js/v-taichinh.js`, `js/core.js` and `js/mini.js`, and is intentionally not migrated: invoice issuing and periods, meter readings and adjustments, payments/receipts, cash confirmation/deposits, bank reconciliation, debt reminders, and the point status refresh (`A.refreshStall`) triggered by payments. These flows are tightly coupled, and their calculation semantics must not change. See `docs/frontend/PHASE_12_REMAINING_FEATURE_BOUNDARIES.md`.
