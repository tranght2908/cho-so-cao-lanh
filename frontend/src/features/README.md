# Feature boundary

Feature folders exist only for real migrated features:

```text
View → Feature service → Feature repository → APP.data now / API client later
```

| Feature | Data source now | Notes |
|---|---|---|
| `markets` | `APP.data` source `market-catalog` (`js/marketcatalog.js`) | Danh mục chợ |
| `traders` | `A.db.traders` | Profile read/edit/documents; point links for contract use cases |
| `business-points` | `A.db.stalls` | Reads; occupancy writes used only by contract use cases |
| `contracts` | `A.db.contracts` | Reads, create/terminate/liquidate/signed-copy use cases, contract screen UI |
| `accounts` | `APP.data` source `accounts` (`js/accounts.js`) | Trader account readiness |
| `finance` | `A.db.invoices` | Read-only queries for other features |
| `finance/market-period` | `A.db.billingPeriods` (records with `marketId`, id `{marketId}_{YYYY-MM}`) | Kỳ thu theo chợ: auto-create theo Lịch nghiệp vụ (`SERVICE_CFG.billingCycle`), helper trạng thái DUY NHẤT `stateOf`, guard mọi bước (chỉ số → tính → phát hành → thu → hoàn tất thu → đối soát → chốt kỳ). Kỳ legacy theo tháng chỉ đọc (`superseded`) |
| `staff-assignment` | `A.ACCOUNTS` (no own store) | Shared service for quick collector assignment in Theo dõi kỳ thu; collector assignment = `Account.marketScopes` written only via `A.ACCOUNTS.saveCollectorAccount` |

Rules: repositories write only their own aggregate. Cross-aggregate use cases live in a service and call sibling services, then save once. See `docs/architecture/FRONTEND_FINAL_ARCHITECTURE.md`.
