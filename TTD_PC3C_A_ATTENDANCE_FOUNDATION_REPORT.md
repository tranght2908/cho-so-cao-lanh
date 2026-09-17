# TTD-PC3C-A Attendance Foundation Report

## 1. Pre-check

- Branch: `feature/ttd-market-layout-workflow`.
- Worktree before changes: clean.
- HEAD: `24a2bdb feat(ttd): add session registration workflow`.

## 2. Audit Before Change

- Session schema: legacy closed metrics plus PC3A lifecycle fields and PC3B-A time fields (`registrationStartAt`, `registrationDeadline`, `date`, `startTime`, `endTime`).
- Registration schema: root `sessionRegistrations` with `sessionId`, `market`, `traderId`, `pointId`, `listType`, `status`, `waitlistOrder`, `note`, timestamp and actor fields.
- Official registrations were read through `registrationReadModels(session)` and bucketed as `listType === 'official' && status === 'approved'`.
- TTD points are read through `A.mbBusinessPointsForMarket('TTD')`; PC3C-A attendance display resolves trader identity from the validated point's `traderId`.
- Existing transition `registration_closed -> preparing` uses `phien-cho.bat-dau-chuan-bi`, granted by default to `market_staff`.
- Permission migration already used `PERM_SEED_VERSION` plus phase flags (`pc3aSessionPermVersion`, `pc3bRegistrationPermVersion`) to preserve custom grants/revokes.
- Existing rollback helpers snapshot session mutation, registration collection mutation, and `extraLog`.
- `A.save()` writes the full `A.db` object to localStorage.
- Existing states may not have `sessionAttendances`; read access must return `[]` without mutating.

## 3. Files Changed

- `data.js`
- `js/permissions.js`
- `js/v-dieuhanh.js`
- `styles.css`
- `TTD_PC3C_A_ATTENDANCE_FOUNDATION_REPORT.md`

## 4. Permission / Action / Migration

- Added action `phien-cho.diem-danh` with `screenId: phien-cho`.
- Default grant: `market_staff`.
- Default non-grants: `market_manager`, `accountant`, `collector`, `technician`, `trader`, `ward_leader`.
- Bumped permission seed to `PERM_SEED_VERSION = 8`.
- Added `pc3cAttendancePermVersion = 1`.
- Migration only adds the new action key when it is absent, then stores the phase version. It is idempotent and preserves custom revoke/grant after migration.

## 5. Attendance Schema

Fresh state now has:

```js
sessionAttendances: []
```

Supported attendance record:

- `id`
- `sessionId`
- `registrationId`
- `market`
- `traderId`
- `pointId`
- `status`
- `checkedAt`
- `arrivalAt`
- `reason`
- `note`
- `createdAt`
- `createdBy`
- `updatedAt`
- `updatedBy`

Valid statuses:

- `pending`
- `present`
- `late_notified`
- `late_arrived`
- `absent_excused`
- `absent_unexcused`

No finance fields are stored.

## 6. Read Model And Positive TTD Validation

- Attendance rows are derived from official approved registrations, not from standalone attendance records.
- A row is valid only when the registration belongs to the session, market is TTD, `status === approved`, `listType === official`, point resolves from the TTD adapter, and trader resolves from the point's `traderId`.
- Waitlist, pending, rejected, withdrawn, fake point, CL point, fake trader, and other-session records are excluded.
- Missing attendance record renders as `pending` / `Chưa điểm danh` without mutating or saving.
- Attendance orphan records are ignored and are not deleted by the renderer.

## 7. Role / Scope Matrix

- Staff TTD with `phien-cho.diem-danh` can mutate attendance only when the selected session is TTD and `preparing`.
- Manager can view the attendance section but has no default attendance mutation action.
- Staff CL is blocked by `A.canDo(action, session.market)` and selected-market/scope rules.
- Read-only roles do not receive mutation buttons and direct handlers still re-check permission and session state.

## 8. Handler Guards

Attendance save resolves the real session and real official registration from state, then checks:

- action `phien-cho.diem-danh`;
- selected market and session market TTD;
- `session.status === preparing`;
- official approved registration validity;
- target status validity;
- required reason for `late_notified` and `absent_excused`;
- `late_arrived` only after existing `late_notified`.

It does not trust DOM trader, point, account, checked time, arrival time, market, or current status.

## 9. UI / Summary / Filter / Modal

When the active session is `preparing`, the active-session card shows `Điểm danh & điều phối trước phiên`.

Summary KPIs:

- Chính thức
- Có mặt
- Xin đến trễ
- Đã đến trễ
- Vắng có báo
- Vắng không báo
- Chưa điểm danh

Filters:

- Tất cả
- Chưa điểm danh
- Có mặt
- Đến trễ
- Vắng mặt

The table shows STT, trader, point code, section, item, status, recorded time, reason/note, and action when allowed.

## 10. Lifecycle Mapping

- The existing 5-step timeline remains.
- For `preparing`, steps 1 and 2 are completed, step 3 is active.
- Persisted status and `SESSION_TRANSITIONS` are unchanged.
- Attendance does not auto-start the session and does not write `session.booths`.

## 11. Rollback

Attendance mutation snapshots:

- whether `sessionAttendances` existed as an own property;
- previous reference/value;
- serialized collection contents;
- `extraLog` contents and order.

If `A.save()` throws, `sessionAttendances` and `extraLog` are restored. The success modal/render/toast path is not executed.

## 12. VM / Stub Tests

- Permission fresh state: `market_staff` has attendance action, manager/collector do not.
- Existing state migration adds the new action when missing.
- Custom revoke for staff and custom grant for manager are preserved after migration.
- Second load is idempotent with `setItem = 0`.
- Source/stub checks confirmed the fresh collection, non-mutating accessor, official-registration read model, point-trader identity, preparing-only section, reason guards, late-arrived guard, rollback snapshot, save-failure restore path, and tab render-only behavior.

## 13. Regression PC3A / PC3B / PC2

- PC3B-B registration workflow is not changed.
- Zero-official close-list guard remains.
- PC3A transitions remain.
- PC2 forged-point close guard remains.
- `SESSION_FEE` remains `20000`.
- No stalls, finance, contracts, accounts, routes, or menus were changed.

## 14. Data Invariants

- No backend/API/database.
- No invoice/payment/receivable/receipt/debt integration.
- No waitlist replacement, absence warning, repeated absence counter, or session booth finalization.
- Renderer and tab switch do not create attendance records or call `A.save()`.

## 15. Browser Smoke

Browser smoke was not run in this environment. Verification used source review, Node VM/localStorage stubs, and static checks.

## 16. Static Checks

- `node --check data.js`
- `node --check js/permissions.js`
- `node --check js/v-dieuhanh.js`
- `git diff --check`

## 17. Risks / Limits

- PC3C-A does not replace absent households with waitlist households.
- PC3C-A does not finalize real booth count into `session.booths`.
- PC3C-A does not warn or sanction repeated absences.
- Real browser smoke should be performed before commit.

## 18. PC3C-A-FIX-1 - Deterministic Attendance Deduplication

- Closed the Medium review finding where attendance read/update used the first array match for `sessionId + registrationId`.
- Business key: `sessionId + registrationId`. Attendance `id` is not used as the business identity for read model or upsert.
- Added centralized canonical resolution helpers:
  - collect all records for the business key;
  - ignore records whose `status` is not a known attendance status;
  - choose newest valid `updatedAt`;
  - if tied, choose newest valid `createdAt`;
  - if tied, choose lexicographically larger `id`;
  - if still tied, choose a stable fingerprint from business fields.
- Invalid duplicate policy: invalid-status records never become canonical. If all records for a key are invalid, the read model treats the official registration as `pending`.
- Read model/KPI now use the canonical attendance record only, so reversing the attendance array does not change the displayed state for duplicates.
- Mutation/upsert uses the same canonical resolver. On a successful mutation for a duplicate business key, only that business key is normalized to one canonical record; other attendance records remain unchanged.
- Rollback remains covered by the existing attendance snapshot. If `A.save()` throws during duplicate normalization, the original duplicate records, their order, property state, and `extraLog` are restored.
- Scope unchanged: no schema change, no permission/action change, no cleanup during render/open, no replacement/warning/finance behavior.

## 19. PC3C-A-UX-FIX-1 - Simplify Attendance Summary And Filters

- Scope: UI/read-model presentation only. No attendance schema, persisted status, permission, handler guard, lifecycle, finance, replacement, or warning behavior was changed.
- Reason: the original attendance section showed 7 KPIs and 5 filters, which made staff compare detailed operational states before seeing the main work queue.
- KPI grouping changed from detailed status counters to 4 summary KPIs:
  - `Chính thức` = all valid official approved registrations.
  - `Đã có mặt` = `present + late_arrived`.
  - `Cần xử lý` = `pending + late_notified`.
  - `Vắng mặt` = `absent_excused + absent_unexcused`.
- Detailed row status is unchanged. Table badges still show:
  - `Chưa điểm danh`;
  - `Có mặt`;
  - `Xin đến trễ`;
  - `Đã đến trễ`;
  - `Vắng có báo`;
  - `Vắng không báo`.
- Filters changed to 4 tabs:
  - `Cần xử lý`;
  - `Đã có mặt`;
  - `Vắng mặt`;
  - `Tất cả`.
- Default/normalization:
  - default tab is `Cần xử lý`;
  - old UI tab keys are normalized safely (`pending`/`late` -> `needs_action`, `present` -> `attended`, `absent` -> `absent`);
  - if no action is needed and no valid tab is selected, the view falls back to `Tất cả`.
- Empty states:
  - `Cần xử lý`: `Không còn hộ cần điểm danh hoặc theo dõi đến trễ.`
  - `Đã có mặt`: `Chưa ghi nhận hộ nào có mặt.`
  - `Vắng mặt`: `Chưa ghi nhận hộ nào vắng mặt.`
  - `Tất cả`: `Chưa có hộ chính thức để điểm danh.`
- CSS/responsive:
  - `.session-attendance-summary` now uses 4 KPI columns on desktop and the existing scoped media rule keeps 2 columns on narrower screens;
  - scoped soft colors were added for total/attended/needs-action/absent KPIs;
  - no global table/button/card/body/font selectors were changed.
- VM/stub test targets:
  - fixture with 6 official rows confirms grouped counts `official=6`, `attended=1`, `needs_action=3`, `absent=2`;
  - tab rows expected: `Cần xử lý=3`, `Đã có mặt=1`, `Vắng mặt=2`, `Tất cả=6`;
  - duplicate attendance remains governed by canonical resolver;
  - tab switch remains render-only and does not call `A.save()`.
