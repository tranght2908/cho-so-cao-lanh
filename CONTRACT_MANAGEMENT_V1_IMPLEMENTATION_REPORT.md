# CONTRACT MANAGEMENT V1 — Implementation Report

## 1. Audit

- Contract screen/render and legacy actions: `js/v-tieuthuong.js`.
- Contract seed model: `id`, `stallId`, `traderId`, `market`, `kind`, `start`, `end`, `unit`, `monthly`, `deposit`, `status`, `scanned`.
- Contract → Trader uses `traderId`; Contract → BusinessPoint uses `stallId`. A point’s current convenience references are `traderId` and `contractId`; these do not replace the Contract relation.
- Selected market is `A.ui.market`; scope and permission enforcement are `A.canDo(action, market)` backed by account `marketScopes`.
- Receivable/payment seed and finance views read `contractId`, `stallId`, `traderId`, and legacy price/date fields. These were preserved.
- Existing capabilities: list/search, basic creation, basic liquidate, scanned flag, notification store, `window.print` icon/helper, and action RBAC. Legacy renewal incorrectly mutated `end`; it is now overridden to start the new-contract flow.

## 2. Files changed

- `js/v-tieuthuong.js` — Contract V1 screen/workflow, detail, history, point history, and safeguards.
- `js/permissions.js` — safe additive action catalog/grants.
- `js/mini.js` — targeted contract notifications appear to the linked trader.

## 3. Contract schema

Legacy fields remain source-compatible. New optional fields are `signedDate`, `unitLabel`, `feeSnapshot`, `signedCopies`, `history`, `previousContractId`, `termination`, and `liquidatedAt`. `feeSnapshot` and the existing `monthly`/`unit` are immutable-at-creation price evidence.

## 4. Workflow delivered

- Summary cards, functional search/filter, active / 30-day / 15-day computed warning (status remains `hieuluc`).
- Create-from-template form with trader, safe vacant point candidates, signature/effective/end dates, generated ID, price and fee snapshot.
- Print page for paper signing with BQL, trader, point, dates, charges, and two signature areas.
- Mock signed-paper metadata through the local file picker only; no upload/storage.
- Detail sections for contract, trader, point, price/fees, digitization, and recorded timeline.
- Renewal opens a **new** contract prefilled from the old record and retains `previousContractId`; old end date/price are not changed.
- Trader profile derives contract history by `traderId`; point contract tab derives tenant history by `stallId`, retaining the same point code.
- `chamdut` and `thanhly` V1 actions release a point only when no other active contract references it. No structural point field is changed.

## 5. Notifications, permissions, and scope

30/15 milestone mock notifications use idempotent `eventKey = contractId + milestone`, are visible in BQL notification data and the linked trader Mini App. Added permission keys: `hop-dong.in`, `hop-dong.cap-nhat-ban-ky`, `hop-dong.cham-dut`; existing create/renew/liquidate keys remain in use. All mutation handlers re-check `A.canDo` and target-market scope.

## 6. Regression checks

- `node --check` passed for all app JavaScript files.
- `git diff --check` passed.
- Static relation smoke check: legacy `contractId`, `stallId`, `traderId`, `monthly`, `start`, and `end` are preserved; finance source was not redesigned.
- Browser-console/manual-flow check was not runnable in this terminal-only environment; recommended manual pass: create, print, add signed mock, renew, terminate, liquidate, then open trader/point histories.

## 7. Known limitations / NEED_CONFIRMATION

1. Legal/business distinction between **chấm dứt** and **thanh lý** is an explicit V1 assumption: termination records early end; liquidation completes the rental relationship/releases the point.
2. Final authority for termination/liquidation needs confirmation; V1 retains manager-only liquidation and manager-only termination.
3. Required documents for termination/liquidation need confirmation. This prototype stores no real documents or storage objects.
4. Existing demo data is retained; date-relative 30/15 cases are calculated from the current prototype date rather than rewriting seed records.
