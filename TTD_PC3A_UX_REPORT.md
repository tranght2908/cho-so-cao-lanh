# TTD-PC3A-UX Role-Based Session Workspace Report

## 1. Pre-check

- Branch: `feature/ttd-market-layout-workflow`
- Worktree before changes: clean
- HEAD: `f11064c feat(ttd): add session lifecycle and responsibility guards`
- Recent history includes `3ef80b0`, `f92cd6b`, `414feae`, `1ecfffb`.

## 2. Architecture Before Change

- `A.VIEWS['phien-cho']` read TTD sessions through `ttdSessionReadModels()`.
- Active/upcoming sessions were separated from closed history, but the historical KPI block rendered before the operating session card.
- PC3A lifecycle helpers already existed: `SESSION_STATUS`, `SESSION_TRANSITIONS`, `actionForTransition`, `canTransition`, `canDoSessionAction`, `ttdSessionCanMutate`, `applySessionMutation`.
- Permission flow remained: account -> primary role -> screen permission -> action permission -> selected market -> session market/status.
- KPI, chart, and history used closed sessions. Renderer used safe number/date formatting for legacy or missing fields.

## 3. Layout After Change

The screen order is now:

1. Short business notice.
2. Role-based action bar.
3. Upcoming/operating session workspace.
4. Latest closed session overview.
5. `Báo cáo & lịch sử` section with visitor chart and closed-session table.

## 4. Role-Based UI

- `Tạo phiên mới` renders only through `A.canDo('phien-cho.tao-phien', 'TTD')`.
- Transition buttons render only when the action is permitted, `ui.market` is TTD, `session.market` is TTD, and the transition is valid for the current status.
- Manager can see create/management actions but not final close.
- TTD staff can see operating/close actions for valid statuses.
- CL staff and read-only roles do not see TTD mutation actions.

## 5. Status Labels

- `draft`: Bản nháp
- `open`: Mở đăng ký
- `registration_closed`: Đã chốt danh sách
- `preparing`: Đang chuẩn bị
- `live`: Đang diễn ra
- `pending_close`: Chờ chốt phiên
- `closed`: Đã chốt
- `postponed`: Tạm hoãn
- `cancelled`: Đã hủy

## 6. Active/Upcoming Session Selection

- Active/upcoming sessions are read models where `status !== 'closed' && status !== 'cancelled'`.
- The earliest active/upcoming TTD session is selected for the workspace.
- Cancelled sessions are excluded from the operating card.
- Postponed sessions are shown as a special state, outside the normal completed-step flow.

## 7. Closed Session KPI

- Latest-session KPI uses only `status === 'closed'`.
- Draft/open/preparing/live/pending_close data is not used for KPI, chart, or closed history.
- If no closed session exists, the latest-closed section renders an empty state.

## 8. Safe Fallbacks

- Missing `startTime`/`endTime`: `Chưa thiết lập`.
- Missing `registrationDeadline`: `Chưa thiết lập`.
- Missing assignee: `Chưa phân công`.
- Missing closer: `—`.
- Missing active-session metrics: `Chưa ghi nhận`.
- Missing closed-session numeric fields: `—`.
- Renderer does not mutate `A.db.sessions` and does not call `A.save()`.

## 9. Tests

VM/localStorage-stub tests:

- No session: PASS.
- Legacy historical session: PASS.
- `draft`, `open`, `registration_closed`, `preparing`, `live`, `pending_close`, `closed`, `postponed`, `cancelled`: PASS.
- Missing time and metric fields: PASS.
- Multiple sessions prioritize active/upcoming before historical KPI: PASS.
- Renderer no mutation: PASS.
- Renderer no save/localStorage write: PASS.
- Manager sees create action and does not see final close: PASS.
- TTD staff does not see create and does see final close in `pending_close`: PASS.
- CL staff direct TTD action blocked by market scope/current market: PASS.

Regression PC3A/PC2:

- Invalid transition does not mutate: PASS.
- Manager direct `session-save` blocked: PASS.
- Forged DOM point id blocked: PASS.
- Save throw rolls back session: PASS.
- `SESSION_FEE` remains `20000`: PASS.
- Stalls/finance collections unchanged in VM snapshots: PASS.

## 10. Browser Smoke

Browser runtime was not available in this environment (`No browser is available`), so real browser smoke was not run. Review uses VM/stub evidence only.

## 11. Files Changed

- `js/v-dieuhanh.js`
- `styles.css`
- `TTD_PC3A_UX_REPORT.md`

## 12. Final Checks

- `node --check js/v-dieuhanh.js`: PASS.
- `git diff --check`: PASS; Git only reported LF-to-CRLF conversion warnings for `js/v-dieuhanh.js` and `styles.css`.
- `git diff --stat`: `js/v-dieuhanh.js | 76`, `styles.css | 11`, total `70 insertions(+), 17 deletions(-)`. The untracked report is not included in Git stat.
- `git status --short`: `M js/v-dieuhanh.js`, `M styles.css`, `?? TTD_PC3A_UX_REPORT.md`.

## 13. Remaining Limits

- No PC3B registration list or approval workflow.
- No PC3C detailed attendance records.
- No finance, receivable, payment, or receipt integration.
- Browser visual smoke still needs to be run on a machine with a browser runtime.
