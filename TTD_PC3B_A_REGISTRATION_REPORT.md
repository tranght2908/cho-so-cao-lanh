# TTD-PC3B-A Registration Window And Session Registration List Report

## 1. Pre-check

- Branch: `feature/ttd-market-layout-workflow`
- Worktree before changes: clean
- HEAD: `4a20426 feat(ttd): improve role-based session workspace`
- Recent history includes `f11064c`, `3ef80b0`, `f92cd6b`, `414feae`.

## 2. Audit Before Change

- Session legacy schema: `date`, `booths`, `fee`, `visitors`, `revenue`, `noncash`.
- PC3A additive fields: `id`, `market`, `startTime`, `endTime`, `registrationDeadline`, `status`, `note`, `createdBy`, `createdAt`, `updatedBy`, `updatedAt`, `assignedTo`, `closedBy`, `closedAt`.
- PC3A read model wraps legacy sessions without mutating storage. Missing `status` is interpreted as `closed` when closing metrics exist.
- `A.save()` writes the whole `A.db` object into `choso-caolanh-state`.
- TTD points are read through `A.mbBusinessPointsForMarket('TTD')`; traders are resolved from `point.traderId` through `A.idx.trader`.
- Before this phase, there was no session registration root collection.
- Existing PC3A actions reused: `phien-cho.tao-phien`, `phien-cho.mo-dang-ky`, `phien-cho.chot-danh-sach`.
- Active session selection remains the PC3A-UX rule: TTD sessions whose status is not `closed` or `cancelled`, sorted by date.

## 3. Session Schema After Change

New sessions created from the UI now include:

- `registrationStartAt`
- `registrationDeadline`
- `date`
- `startTime`
- `endTime`

Existing PC3A fields are preserved. Legacy sessions without `registrationStartAt` render with `Chưa ghi nhận`; no migration rewrites old session records.

## 4. Registration Model

Fresh state now has:

```js
sessionRegistrations: []
```

Registration record schema supported by the renderer:

- `id`
- `sessionId`
- `market`
- `pointId`
- `traderId`
- `registeredAt`
- `listType`: `official` or `waitlist`
- `status`: `registered`, `approved`, `waitlisted`, `rejected`, `withdrawn`
- `waitlistOrder`
- `note`
- `createdAt`
- `createdBy`
- `updatedAt`
- `updatedBy`

No financial fields are stored in registration records.

## 5. Collection Migration / Idempotency

- Fresh `DATA.build()` includes `sessionRegistrations: []`.
- Existing localStorage state without the collection is handled by a read accessor that returns `[]` without mutating during render.
- Existing state with `sessionRegistrations` is preserved.
- The collection is only initialized during a real session create mutation if missing, right before `A.save()`.
- Renderer does not create or persist the collection.

## 6. Time Validation

`session-create-save` validates:

- `registrationStartAt` is valid.
- `registrationDeadline` is valid.
- `registrationStartAt < registrationDeadline`.
- `registrationDeadline < session start datetime`.
- `startTime < endTime`.
- No duplicate TTD session on the same date.
- Market/status/creator are system-controlled, not read from DOM.
- Existing PC3A permission/scope guard remains.

## 7. Point / Trader Resolution

- Registration list reads points only through `A.mbBusinessPointsForMarket('TTD')`.
- Records with non-TTD `market` are ignored for TTD session rendering.
- Point/trader fields are resolved live from existing `A.db.stalls` and `A.db.traders`.
- Orphan records render safe fallback text and do not break the view.
- Duplicate `sessionId + pointId` records are de-duplicated in the read model for display.

## 8. Official / Waitlist UI

The active/upcoming session card now includes `Đăng ký tham gia phiên` with:

- Total registrations.
- Official count.
- Waitlist count.
- Rejected/withdrawn count when present.
- Official table.
- Waitlist table ordered by `waitlistOrder`.
- Empty states for both lists.

## 9. Permission / Scope

- No new roles or action permissions were added.
- Manager and TTD staff can view the list through existing `screen:phien-cho` + TTD scope.
- CL staff cannot access/mutate TTD session context through `A.canDo`.
- Read-only roles do not get mutation buttons.
- No checks use `ui.role`, account IDs, or names.

## 10. Lifecycle / PC3A Regression

- `SESSION_TRANSITIONS` unchanged.
- `session-transition`, `session-open`, and `session-save` semantics unchanged.
- PC2 close guards remain in place.
- No attendance, replacement, warning, or finance workflow was added.

## 11. Test Results

VM/localStorage-stub tests:

- Valid create persists `registrationStartAt`: PASS.
- `registrationStartAt === registrationDeadline` blocked: PASS.
- Deadline after session start blocked: PASS.
- `startTime >= endTime` blocked: PASS.
- Save failure rolls back session/log: PASS.
- Fresh state has `sessionRegistrations: []`: PASS.
- Existing state missing collection renders without mutation: PASS.
- Official list renders: PASS.
- Waitlist renders in order: PASS.
- Orphan registration renders safely: PASS.
- CL registration record does not leak into TTD list: PASS.
- Duplicate `sessionId + pointId` does not double-render: PASS.
- Missing fields do not render `undefined` or `NaN`: PASS.
- Manager and TTD staff can view list: PASS.
- CL staff action against TTD remains blocked: PASS.
- `SESSION_FEE` remains `20000`: PASS.

## 12. Data Invariants

- No changes to stalls.
- No changes to invoices/payments/finance collections.
- No changes to contracts/traders.
- No new route/menu.
- No permission/action changes.
- No account changes.
- No registration CRUD, approval workflow, attendance, replacement, warning, or finance integration.

## 13. Browser Smoke

Browser runtime was not available in this environment in the previous PC3A-UX review. This phase was verified with VM/stub tests only; real browser smoke still needs a local browser runtime.

## 14. Files Changed

- `data.js`
- `js/v-dieuhanh.js`
- `styles.css`
- `TTD_PC3B_A_REGISTRATION_REPORT.md`

## 15. Static Checks

- `node --check js/v-dieuhanh.js`: PASS.
- `node --check data.js`: PASS.
- `git diff --check`: PASS; Git reported only LF-to-CRLF conversion warnings for `data.js`, `js/v-dieuhanh.js`, and `styles.css`.
- `git diff --stat`: `data.js | 3`, `js/v-dieuhanh.js | 105`, `styles.css | 2`; total `100 insertions(+), 10 deletions(-)`. The untracked report is not included in Git stat.
- `git status --short`: `M data.js`, `M js/v-dieuhanh.js`, `M styles.css`, `?? TTD_PC3B_A_REGISTRATION_REPORT.md`.

## 16. Remaining Limits

- PC3B-A is read-only for registration lists.
- No handler/UI for creating or approving registration records yet.
- No waitlist replacement.
- No attendance/check-in.
- No leave/absence tracking.
- No finance integration.

## 17. Left For Later Phases

- PC3B-B: registration CRUD/approval/waitlist management.
- PC3C: attendance, absence reason, replacement, repeated-absence warnings.
- Finance phase: receivable/payment/receipt/reconciliation.

## 18. FIX-1 Review Findings Closed

- High cross-market filter: registration rows are now rendered and counted only when `pointId` is positively resolved from the TTD business point adapter. Records whose `market` is forged as `TTD` but whose point belongs to CL, or whose point no longer exists, are excluded from official/waitlist/total output and their IDs are not rendered. Invalid/orphan records are not deleted or mutated.
- Trader identity: once the point is confirmed as a TTD point, the displayed trader is resolved from the real point's `traderId`; `registration.traderId` is not trusted to display a different person.
- Medium rollback: `session-create-save` snapshots whether `sessionRegistrations` existed as an own property and snapshots its previous value/reference before initializing the collection. If `A.save()` throws, the session and log are rolled back, and `sessionRegistrations` is either deleted again when absent before mutation or restored to its exact previous value when it existed, including non-array values.
- Scope: no registration CRUD, approval workflow, lifecycle change, permission change, account change, finance integration, attendance, replacement, or warning workflow was added.
