# Frontend Feature Map

This map describes ownership targets; it does not migrate any feature in Phase 2.

| Feature | Owns | Current source | Future location | Dependencies | Data collections / stores | Candidate backend domain |
|---|---|---|---|---|---|---|
| Dashboard | cross-market overview, KPIs, charts | `frontend/js/v-dieuhanh.js` | `frontend/src/features/dashboard/` | `APP.U`, RBAC, market scope | markets, stalls, invoices, payments, incidents | reporting/dashboard |
| Markets | market catalog | `v-danhmuccho.js`, `marketcatalog.js` | `features/markets/` | permissions, market selector | `DATA.MARKETS`, market catalog storage | market catalog |
| Market layout | structure tree, workspace, points | `v-cautruc.js`, `v-tieuthuong.js`, `vehicles.js` | `features/market-layout/` | RBAC, traders/contracts | stalls, layout storage, point requests, seller assignments | layout/business points |
| Traders | profiles, documents, profile workflow | `v-tieuthuong.js`, `workflow.js` | `features/traders/` | accounts, layout, contracts | traders, stalls, doc metadata | traders/documents |
| Contracts | list, lifecycle, assignment effects | `v-tieuthuong.js`, `workflow.js` | `features/contracts/` | traders, points, pricing, finance | contracts, stalls, traders, invoices, notifications | contracts |
| Market sessions | session lifecycle, registration, attendance, settlement | `v-dieuhanh.js`, `mini.js` | `features/market-sessions/` | pricing, accounts, mini app | sessions, registrations, session payments/receipts/attendance | market sessions |
| Finance | meters, receivables, collection, reconciliation, debt | `v-taichinh.js`, `core.js`, `mini.js` | `features/finance/` | pricing, bank accounts, scope | readings, invoices, payments, bank, cash, billing periods | billing/collection |
| Operations | incidents and notifications | `v-vanhanh.js`, `mini.js` | `features/operations/` | accounts, RBAC, traders | incidents, notifications, staff | incidents/notifications |
| Assets | market assets | `v-taisan.js` | `features/assets/` | market scope | marketAssets | assets |
| Reports | report screens/forms/CSV export | `v-vanhanh.js`, `v-baocao-mau.js`, `v-dieuhanh.js` | `features/reports/` | dashboard, finance | derived from business collections | reporting |
| Accounts | account administration and lifecycle task | `accounts.js`, `v-vanhanh.js`, `workflow.js` | `features/accounts/` | RBAC, auth, traders | account storage, traders/contracts | identity/accounts |
| Pricing | pricing/service policies | `serviceconfig.js`, `v-vanhanh.js`, `data.js` | `features/pricing/` | market scope, finance | service config storage, rate policy seed | pricing/configuration |
| Banking | management bank-account catalog | `bankaccounts.js`, `v-vanhanh.js` | `features/banking/` | pricing/finance, RBAC | bank account storage, bank master | banking configuration |
| Auth | phone OTP, session, current-user header | `auth.js`, `accounts.js`, `core.js` | `features/auth/` | RBAC, mini app | accounts, UI storage, trader avatar | authentication/session |
| Mini app | trader self-service | `mini.js` | `features/mini-app/` | auth, traders, contracts, finance, operations, sessions | trader-owned points/contracts/invoices/incidents | merchant portal |

Rules for later migrations: create a feature folder only when moving a coherent screen/use case; feature services orchestrate frontend use cases; repositories access data through `APP.data` now and an API adapter later.
