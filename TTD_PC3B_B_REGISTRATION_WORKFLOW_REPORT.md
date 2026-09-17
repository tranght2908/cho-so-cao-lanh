# TTD-PC3B-B Registration Review, Official List And Waitlist Report

## 1. Pre-check

- Branch: `feature/ttd-market-layout-workflow`
- Worktree before changes: clean
- HEAD: `7c9e0f8 feat(ttd): add session registration foundation`

## 2. Audit Before Change

- Session schema: legacy closed metrics plus PC3A lifecycle fields and PC3B-A `registrationStartAt`.
- Registration schema: `sessionRegistrations` root collection with session, market, trader, point, list/status, waitlist order, timestamps, note, and audit actor fields.
- PC3B-A read model rendered only registrations whose `pointId` resolved from TTD points, which protected official rows but could not show waitlist rows without point.
- TTD points are read through `A.mbBusinessPointsForMarket('TTD')`; traders are resolved from `A.idx.trader` / `A.db.traders`.
- Existing transition `open -> registration_closed` used action `phien-cho.chot-danh-sach`.
- Existing session create rollback snapshotted session/log/collection. Registration mutations did not exist yet.
- TTD traders usable for prototype registration are traders attached to TTD business points.
- Permission migration used seed version and phase-specific flags to add new keys without rewriting custom grants/revokes.

## 3. Schema Before/After

No new root collection was added. `sessionRegistrations` remains the collection.

PC3B-B supports:

- `pointId` nullable for waitlist/registered/rejected/withdrawn.
- `requestedSectionId` optional for desired section.
- `official/approved` requires valid TTD point.
- `waitlist/waitlisted` requires positive unique `waitlistOrder`.

No finance fields are stored.

## 4. Permission / Action

Added action:

- `phien-cho.quan-ly-dang-ky`

Default grant:

- `market_manager`: yes.
- `market_staff`, `accountant`, `collector`, `technician`, `trader`, `ward_leader`: no mutation default.

Migration:

- `PERM_SEED_VERSION = 7`.
- `pc3bRegistrationPermVersion = 1`.
- Existing state gets only the new action key when absent.
- Custom grants/revokes after migration are preserved.

## 5. Timeline 5 Steps

UI timeline now shows:

1. Tạo phiên
2. Đăng ký & chốt danh sách
3. Điểm danh & điều phối
4. Đang diễn ra
5. Chốt phiên

Persisted status and `SESSION_TRANSITIONS` are unchanged.

## 6. Registration Workflow

Added prototype management actions:

- Ghi nhận đăng ký.
- Duyệt chính thức.
- Chuyển dự bị.
- Từ chối.
- Rút đăng ký.

All handlers re-check session, market TTD, screen/action permission, scope through `A.canDo`, `open` status, registration window, real trader, real TTD point when needed, duplicate trader, and duplicate official point.

## 7. Waitlist Order

- Waitlist rows can have no point.
- New waitlist rows receive next positive order.
- Up/down reorder swaps existing positive order values.
- Save failure restores the full collection and log snapshot.

## 8. Chốt Danh Sách

Before `open -> registration_closed`, validation blocks:

- Pending `registered` rows.
- Invalid official point.
- Duplicate official point.
- Duplicate active trader.
- Invalid/duplicate waitlist order.

The confirmation modal shows official, waitlist, and rejected/withdrawn counts. Chốt danh sách does not auto-move to `preparing`.

## 9. Handler Guards

Mutation handlers do not trust DOM market/status/trader/point. Target market is read from the real session. Registration action uses `phien-cho.quan-ly-dang-ky`; closing the list still uses `phien-cho.chot-danh-sach`.

## 10. Rollback

Registration mutations snapshot:

- `sessionRegistrations` property/value.
- Serialized collection contents.
- `extraLog` contents.

If `A.save()` throws, collection/log are restored and no success UI is shown. Session transitions use content-based log rollback.

## 11. Role UX

- Manager can manage registrations and close the list when valid.
- TTD staff can view but does not get default registration management actions.
- CL staff is blocked by selected market/scope.
- Read-only roles see list data without mutation buttons.

## 12. Test Results

VM/stub tests covered:

- Fresh and existing permission migration.
- Custom permission preservation/idempotency.
- Add registration, duplicate trader guard, outside-window guard, non-open guard, no-permission guard.
- Approve official, duplicate point guard, waitlist conversion, reject/withdraw.
- Waitlist order up/down and rollback on save failure.
- Chốt danh sách validation and valid transition to `registration_closed`.
- PC2 forged point guard and `SESSION_FEE = 20000`.

## 13. Regression

- PC3A lifecycle transitions remain.
- PC3A-UX KPI/history remain closed-session only.
- PC3B-A time validation remains.
- PC2 close guard remains.
- No stalls/finance/accounts changes.

## 14. Data Invariants

- No backend/API/database.
- No invoice/payment/receivable/receipt/debt data.
- No attendance/replacement/warning data.
- No route/menu change.

## 15. Browser Smoke

Browser smoke was not run in this environment. Verification used Node VM/stub tests and static checks.

## 16. Static Checks

- `node --check js/v-dieuhanh.js`
- `node --check js/permissions.js`
- `node --check data.js`
- `git diff --check`

## 17. Files Changed

- `js/v-dieuhanh.js`
- `js/permissions.js`
- `styles.css`
- `TTD_PC3B_B_REGISTRATION_WORKFLOW_REPORT.md`

## 18. Risks / Limits

- Registration input is a prototype BQL-facing workflow, not a real Mini App/backend portal.
- Waitlist replacement and attendance are left for PC3C.
- Finance integration is not implemented.

## 19. Left For PC3C

- Detailed attendance.
- Absence reason.
- Calling waitlist households as replacements.
- Repeated absence warnings.
- Any finance/receivable/payment workflow.

## 20. PC3B-B-UX-FIX - Registration List Readability

- Reason: the previous layout showed official and waitlist tables side by side, leaving each table about half-width and forcing horizontal scrolling.
- New structure: one tabbed registration workspace under `Đăng ký tham gia phiên`.
- Tabs: `Chờ xử lý`, `Chính thức`, `Dự bị`, `Không tham gia`, each with its own count.
- Only the active tab's table is rendered, and it uses the full card width.
- Pending tab keeps primary actions visible (`Duyệt chính thức`, `Chuyển dự bị`) and groups lower-priority actions with less visual weight.
- Official tab is focused on approved official rows and does not show phone by default.
- Waitlist tab removes the unused point-code column and combines desired section/item into `Nhu cầu đăng ký`; reorder buttons are compact.
- Inactive tab is read-only and shows only household, registration time, status, and note/reason.
- Tab state is UI-only (`ui.sessionRegistrationTab`), is not persisted, does not mutate registration data, and does not call `A.save()`.
- Responsive behavior: table wrapper scrolls horizontally when needed; the page itself should not gain horizontal overflow. Tab bar can scroll on narrow screens.
- Business logic unchanged: schema, permissions, lifecycle, registration handlers, validation, rollback, PC2/PC3A guards, and finance remain unchanged.

## 21. PC3B-B-FIX-1 - Reject Guard And Final Polish

- Closed the Medium review finding by adding a source-status guard in `reg-reject-save`: only registrations still in `registered` can be rejected. Direct calls for `approved`, `waitlisted`, `rejected`, `withdrawn`, missing records, or records outside the resolved TTD session return before mutation/save/log/success UI.
- Updated withdrawal wording so BQL records the household's own withdrawal request: button `Ghi nhận rút`, modal `Ghi nhận rút đăng ký`, inactive tab `Không tham gia`, rejected label `BQL từ chối`, withdrawn label `Hộ đã rút đăng ký`.
- Withdrawal now requires a non-empty trimmed reason before saving. The reason is stored in the existing `note` field; no schema field was added.
- Added close-list validation requiring at least one valid official/approved TTD registration before `open -> registration_closed`. This guard is shared by UI confirmation, direct `session-close-list-save`, and direct `session-transition`.
- Existing list validation remains: no pending `registered`, no duplicate active trader, no duplicate official point, waitlist order must be positive/unique, and invalid/cross-market point data cannot pass.
- Updated `.session-progress` from seven grid columns to five columns to match the current 5-step business timeline.
- Scope unchanged: no permission migration change, no schema change, no PC3C attendance/replacement/warning, no finance integration, no account/market scope changes.
- Tests covered by VM/stub and static checks: registered reject succeeds, approved/waitlisted/inactive reject is blocked without mutation; withdrawal requires reason and remains blocked after `registration_closed`; zero-official close is blocked while one valid official can close; CSS no longer applies a 7-column timeline rule.
