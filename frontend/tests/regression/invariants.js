// Approved runtime invariants (Phase 15.1, commit 20b9a11; counts updated by approved removals below).
// These numbers are checked independently of the persisted baseline, so refreshing the baseline
// can never silently accept a lost route, handler or storage key. Change them only in the same
// approved phase that intentionally changes the runtime surface (e.g. deleting obsolete actions),
// and record the reason in docs/architecture/LEGACY_JS_ELIMINATION_PLAN.md.
module.exports = {
  views: 21,
  // 15.17 (Q1 + Q2 DROP): 393 → 307 actions (-73 Q1, -13 Q2), 62 → 29 input (-23, -10),
  // 149 → 116 change handlers (-21, -12). See baseline/meta.json approvedChanges.
  actions: 307,
  inputHandlers: 29,
  changeHandlers: 116,
  rbacSchema: 4,
  routes: 21,
  // +1: choso-caolanh-action-cooldown (cooldown 30 phút của thao tác "Tạm khóa tài khoản" theo Admin).
  localStorageKeys: 12,
  sessionStorageKeys: 1,
  replaySteps: 229
};
