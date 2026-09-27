# Frontend ↔ Backend Contract Guide

Status: frontend frozen after master run 8→13. There is **no backend yet**, and this document deliberately does **not** define endpoints, payloads or URLs. It maps the frontend feature boundaries to future API domains and backend modules so that the Spring Boot design can start from verified frontend responsibilities.

## Integration principle

```text
NOW    View → Feature service → Feature repository → APP.data → A.db / legacy store → localStorage (mock)
LATER  View → Feature service → Feature repository → src/shared/api client → Spring Boot → Database
```

Only feature **repositories** change when the API arrives. Service method names and semantics are the frontend contract that views depend on. The backend becomes authoritative for validation, authorization, state transitions and financial consistency. Frontend checks stay as UX pre-checks only.

## Mapping

| Frontend feature | Frontend service surface today | Future API domain | Backend module (proposed) | Notes |
|---|---|---|---|---|
| `markets` | `rows`, `get`, `priceConfig`, `codeTaken`, `add`, `update` | Market catalog | `market-catalog` | 12 markets; price configuration references. |
| `traders` | `list`, `getProfile`, `idNoTaken`, `updateProfile`, `updateDocuments`, `linkPoint`, `unlinkPoint` | Trader profiles & documents | `trader` | `linkPoint`/`unlinkPoint` are **not** public operations; they exist only inside contract use cases. Document upload today stores metadata/data URLs locally; a real file service is a separate decision. |
| `business-points` | `list`, `get`, `occupy`, `vacate`, `addHistory` | Business points (Điểm kinh doanh) | `business-point` (inside a market-layout bounded context) | `occupy`/`vacate` are internal to contract use cases. The layout tree (`choso-caolanh-layout`) is a separate representation; its source of truth and versioning must be decided (see open questions). |
| `contracts` | reads (`list`, `get`, `listByTrader`, `activeForTrader`, `hasActiveForTrader`, `hasActiveForPoint`, `availablePoints`, `tradersWithoutActive`, `nextId`) + use cases `createWithPointAllocation`, `terminate`, `liquidate`, `addSignedCopy`, `recordEvent` | Contracts & lifecycle | `contract` | **Each use case MUST be one `@Transactional` backend operation** covering contract + point + trader link + history. ID generation moves to the backend. |
| `accounts` | `list`, `get`, `byTraderId`, `nextTraderAccountId`, `add`, `setStatus` | Identity / accounts | `identity` (accounts, roles, market scopes) | OTP/auth (`auth.js`) and RBAC (`permissions.js`) are still legacy. Roles, `marketScopes` and statuses (`PENDING_ACTIVATION`, `active`, `disabled`, …) must be preserved. |
| `finance` | `unpaidInvoicesForContract`, `unpaidInvoicesForTrader` (read) | Receivables, payments, receipts, reconciliation | `finance` | Only the read queries are bounded. Invoice generation, readings, payments, receipts, cash deposits, reconciliation and debt reminders are still legacy in `v-taichinh.js` / `mini.js` / `core.js` and need their own characterization before an API is designed. |
| (legacy) operations — `v-vanhanh.js` | — | Incidents & notifications | `operations` | Incidents, notifications, staff. |
| (legacy) reports — `v-baocao-mau.js`, dashboard in `v-dieuhanh.js` | — | Reporting | `reporting` (read models) | Aggregations across all domains; best served by backend read models. |
| (legacy) market sessions — `v-dieuhanh.js`, `mini.js` | — | Market sessions (chợ phiên) | `market-session` | Session registrations, payments and receipts. |
| (legacy) assets — `v-taisan.js` | — | Market assets | `asset` | Small, self-contained. |
| (legacy) banking / pricing config — `bankaccounts.js`, `serviceconfig.js` | — | Configuration | `configuration` | Bank accounts and service price configuration. |
| (legacy) vehicles — `vehicles.js` | — | Trader vehicles | `trader` (sub-resource) or `vehicle` | Vehicle fee snapshot on contracts exists only on an unreachable legacy path. |
| (legacy) mini app — `mini.js` | — | Merchant self-service | consumes the domains above | Must call the finance / point-change / session use cases instead of writing collections directly. |

## Transaction candidates (must be backend `@Transactional`)

1. Create contract + allocate point (`contracts.createWithPointAllocation`).
2. Terminate contract + release point + unlink trader (`contracts.terminate`).
3. Liquidate contract + release point + unlink trader, guarded by the no-unpaid-invoice rule (`contracts.liquidate`).
4. Payment → invoice status → point status refresh (`A.refreshStall`, legacy).
5. Point split / merge / conversion execution (legacy `pointRequests` workflow).

## Open questions for backend design

- Layout tree vs business points: which is authoritative, and is layout configuration versioned separately from point inventory?
- Contract ID and trader/account ID generation: this moves to the backend. Are the current formats (`HĐ-<market>-<year>-<nnnn>`, `TT<nnnn>`, `AC-TT<nn>`) business identifiers that must be kept?
- Contract renewal: today it only reopens the create form. Is there a real renewal/extension transaction?
- Document storage for trader documents and signed contract copies (currently mock metadata / local data URLs).
- Expiry notifications: these are generated during screen render today and should become a scheduled backend job.
