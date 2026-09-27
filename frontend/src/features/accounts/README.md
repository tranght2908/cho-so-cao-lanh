# Accounts feature (trader account readiness scope)

Data path: `consumer → APP.features.accounts.service → repository → APP.data source "accounts" → A.ACCOUNTS (js/accounts.js)`.

`js/accounts.js` stays the owner and persister of the account store (`choso-caolanh-accounts`). It registers itself as the `accounts` source through `APP.data.registerSource`, the same pattern as `marketcatalog.js` → Markets. The registered functions delegate to `A.ACCOUNTS` at call time.

| Service method | Purpose | Consumers |
|---|---|---|
| `list()`, `get(id)`, `byTraderId(traderId)` | Reads | `workflow.js` (`needsAccount`, account task, OTP login), trader drawer (`ttLinkedAccount`) |
| `nextTraderAccountId(pad)` | `AC-TT<nn>`, legacy formula | `wf-account-create` |
| `add(account)` | Persisted by the legacy store | `wf-account-create` |
| `setStatus(id, status)` | Lock/unlock Mini App access | `tt-miniapp-toggle` |

Still legacy: auth/OTP/session (`auth.js`), RBAC (`permissions.js`), the account admin screen (`v-vanhanh.js`), point-request assignee lookups, and Mini App find-or-create (`A.createLinkedTraderAccount` in `v-tieuthuong.js`). Roles, `marketScopes`, statuses and storage are unchanged.
