# TTD-PC3A Session Lifecycle Report

## Pre-check

- Branch: `feature/ttd-market-layout-workflow`
- Worktree: clean before changes
- HEAD: `3ef80b0 fix(ttd): harden session attendance and close guards`
- Recent commits include `f92cd6b`, `414feae`, `1ecfffb`.

## Audit Summary

- `market_manager`: Trưởng Ban Quản lý chợ.
- `market_staff`: Nhân viên Ban Quản lý chợ.
- `AC-NV01`: Trưởng Ban demo; PC3A normalizes scope to `['CL', 'TTD']`.
- `AC-NV06`: Nhân viên BQL Chợ quê TTD; scope `['TTD']`.
- `AC-NV08`: Added independent demo account Nguyễn Thanh Bình for Nhân viên BQL Chợ Cao Lãnh; `code` is `BQL-CL-01`, scope `['CL']`. This account is not backed by `DATA.STAFF`.
- Existing action before PC3A: `phien-cho.chot-phien`.

## Session Schema

Before PC3A, historical sessions used:

- `date`
- `booths`
- `fee`
- `visitors`
- `revenue`
- `noncash`

PC3A adds fields additively as needed:

- `id`
- `market`
- `startTime`
- `endTime`
- `registrationDeadline`
- `status`
- `note`
- `createdBy`
- `createdAt`
- `updatedBy`
- `updatedAt`
- `assignedTo`
- `closedBy`
- `closedAt`

Historical sessions without `status` are treated as `closed`; existing numeric history is preserved.

## Action Keys

- `phien-cho.tao-phien`
- `phien-cho.mo-dang-ky`
- `phien-cho.chot-danh-sach`
- `phien-cho.bat-dau-chuan-bi`
- `phien-cho.bat-dau-phien`
- `phien-cho.cho-chot`
- `phien-cho.chot-phien`
- `phien-cho.hoan-phien`
- `phien-cho.huy-phien`
- `phien-cho.xem-bao-cao`

## Permission Matrix

- `market_manager`: create, open registration, close registration list, postpone, cancel.
- `market_staff`: start preparing, start session, move to pending close, close session.
- `ward_leader`: view/report only.
- `collector`: view/report only.

Fresh PC3A seed removes `market_manager` from `phien-cho.chot-phien` so the manager can supervise but not close.
Stored permission migration is versioned with `PERM_SEED_VERSION = 6` and `pc3aSessionPermVersion = 1`. Because the legacy permission state has no metadata to distinguish seed grants from administrator custom grants/revokes, migration only adds completely new `phien-cho.*` action keys and does not rewrite assignments for the pre-existing `phien-cho.chot-phien` action.

Custom preservation tests:

- Custom revoke `market_manager -> phien-cho.tao-phien`: preserved after PC3A version is current.
- Custom grant `collector -> phien-cho.chot-phien`: preserved.
- Unrelated custom permission rows: preserved.
- First migration from old permission state writes once to `choso-caolanh-permissions`; second load is deep-equal and writes `0` times.

Account migration:

- Fresh state includes independent account `AC-NV08`, code `BQL-CL-01`, role `market_staff`, scope `['CL']`, display name Nguyễn Thanh Bình.
- Existing state without `AC-NV08` gets exactly one `AC-NV08` account and adds `TTD` to `AC-NV01` scope if missing.
- Existing `AC-NV08` is not overwritten if administrator customized code, name, role, scope, or status.
- Existing Nguyễn Thanh Bình under another ID does not create a duplicate and is not claimed/rewritten.
- First account migration writes through existing account storage only when data changes; second load is deep-equal and writes `0` times.

## Transition Table

- `draft -> open`
- `draft -> cancelled`
- `open -> registration_closed`
- `open -> postponed`
- `open -> cancelled`
- `registration_closed -> preparing`
- `registration_closed -> postponed`
- `registration_closed -> cancelled`
- `preparing -> live`
- `preparing -> postponed`
- `preparing -> cancelled`
- `live -> pending_close`
- `pending_close -> closed`
- `postponed -> open`
- `postponed -> cancelled`
- `closed`: read-only in PC3A

## Handlers

- Added `session-create`
- Added `session-create-save`
- Added `session-transition`
- Updated `session-open` to require a real selected session in `pending_close`
- Updated `session-save` to close the selected session instead of pushing a duplicate date

Every mutation resolves the real session, verifies market `TTD`, checks `A.canDo(action, session.market)`, checks valid source status, then mutates and saves with rollback.

## Test Result

- Manager creates TTD session: PASS
- TTD staff cannot create session: PASS
- CL staff/scope cannot operate TTD session: PASS
- Manager opens registration and closes registration list: PASS
- TTD staff cannot do manager actions: PASS
- TTD staff runs preparing/live/pending_close/closed: PASS
- Manager cannot open attendance/close modal: PASS
- Direct handler calls are guarded: PASS
- Duplicate date creation blocked: PASS
- Invalid transition blocked without mutation: PASS
- Save failure rolls back mutation and log: PASS
- Historical session preserved and migrated additively: PASS
- PC2 forged DOM id blocked: PASS
- Stalls, invoices, payments unchanged in guard tests: PASS

## Remaining Limits

- No detailed registration list.
- No reserve list, absence notice, replacement, or leave limit rules.
- No detailed attendance history.
- No finance/receivable/payment integration.
- No backend/API/database.
- Demo values for visitors, revenue, and noncash remain unchanged.

## Runtime Hotfix - phien-cho Renderer

- Fixed runtime error where the KPI block used the last item in `A.db.sessions` as if it were always a closed session with `visitors`, `revenue`, `booths`, and `fee`.
- The renderer now separates active/upcoming sessions (`status !== 'closed' && status !== 'cancelled'`) from historical sessions (`status === 'closed'`).
- KPI, chart, and "Lich su cac phien" only read closed historical sessions.
- Draft/open/registration_closed/preparing/live/pending_close sessions render only in the "Phien sap toi/dang van hanh" block.
- Number, money, percent, time range, and registration deadline output now use safe formatting and display `—` when values are not available.
- Rendering no longer normalizes or mutates `A.db.sessions`; read compatibility for old session records is done through a read model.

## Files Changed

- `js/accounts.js`
- `js/permissions.js`
- `js/v-dieuhanh.js`
- `TTD_PC3A_SESSION_LIFECYCLE_REPORT.md`
