// Approved runtime invariants (Phase 15.1, commit 20b9a11).
// These numbers are checked independently of the persisted baseline, so refreshing the baseline
// can never silently accept a lost route, handler or storage key. Change them only in the same
// approved phase that intentionally changes the runtime surface (e.g. deleting obsolete actions),
// and record the reason in docs/architecture/LEGACY_JS_ELIMINATION_PLAN.md.
module.exports = {
  views: 21,
  actions: 393,
  inputHandlers: 62,
  changeHandlers: 149,
  rbacSchema: 4,
  routes: 21,
  localStorageKeys: 11,
  sessionStorageKeys: 1,
  replaySteps: 229
};
