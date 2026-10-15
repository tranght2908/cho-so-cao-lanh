/* G4-alert preparation: notifications are derived at app-open time only.
 * This fixture uses an isolated headless app/localStorage and never changes seed data. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..')), A = h.A;
const CS = A.features.contracts.service, MS = A.features.markets.service, PN = A.personalNotifications;
const TODAY = A.U.today();
const add = (iso, days) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (err) { err.message = label + ': ' + err.message; throw err; } };
const alertKinds = (contract, day) => CS.expiryAlerts(day).filter(x => x.contract.id === contract.id);
const clearNotices = () => { A.db.personalNotifications = []; };
const make = (name, end) => {
  const c = { id: 'HD-ALERT-' + name, market: 'CL', traderId: 'TT01', businessPointId: 'CL-KA-A01', stallId: 'CL-KA-A01', start: add(end, -365), end, status: 'ACTIVE', continuations: [], expiryNotes: [], history: [] };
  A.db.contracts.push(c); A.reindex(); return c;
};
const c30 = make('30', add(TODAY, 30));
const c7 = make('7', add(TODAY, 7));
const expired = make('EXPIRED', add(TODAY, -1));
const continuing = make('CONTINUING', add(TODAY, -100));
continuing.continuations.push({ id: 'XNSD-ALERT-CONT', contractId: continuing.id, kind: 'CONTINUING', from: add(continuing.end, 1), until: add(TODAY, 60), evidence: 'SITE_CHECK', note: 'Vẫn kinh doanh', confirmedAt: TODAY + 'T08:00:00.000Z', confirmedBy: 'Fixture' });
const stopped = make('STOPPED', add(TODAY, -5));
stopped.continuations.push({ id: 'XNSD-ALERT-STOP', contractId: stopped.id, kind: 'STOPPED', stoppedOn: add(stopped.end, 1), evidence: 'SITE_CHECK', note: 'Đã ngừng', confirmedAt: TODAY + 'T08:00:00.000Z', confirmedBy: 'Fixture' });

ok('30 ngày chưa xác minh có một việc xác minh; 7 ngày cuối và quá hạn dùng khóa theo ngày', () => {
  assert(alertKinds(c30, TODAY).some(x => x.kind === 'VERIFY_WINDOW'));
  const k7 = alertKinds(c7, TODAY); assert.strictEqual(k7.filter(x => x.kind === 'VERIFY_FINAL_DAILY').length, 1);
  const ko = alertKinds(expired, TODAY); assert.strictEqual(ko.filter(x => x.kind === 'VERIFY_OVERDUE_DAILY').length, 1);
  assert(alertKinds(c7, add(TODAY, 1)).some(x => x.kind === 'VERIFY_FINAL_DAILY' && x.key.endsWith(add(TODAY, 1))));
});
ok('tiếp tục thuê dừng nhắc xác minh, chỉ theo dõi hồ sơ; không tiếp tục thuê chỉ chờ thủ tục kết thúc', () => {
  const follow = alertKinds(continuing, TODAY);
  assert(!follow.some(x => /^VERIFY_/.test(x.kind)), follow.map(x => x.kind).join(','));
  assert(follow.some(x => /^DOSSIER_/.test(x.kind)), follow.map(x => x.kind).join(','));
  assert.strictEqual(CS.chargeCoverage(continuing, '2026-11-01', '2026-11-30').covered, true, 'căn cứ hợp lệ vẫn dùng cho G1');
  const closure = alertKinds(stopped, TODAY);
  assert.strictEqual(closure.filter(x => x.kind === 'PENDING_CLOSURE').length, 1);
  assert(!closure.some(x => /^VERIFY_/.test(x.kind)));
});
ok('cùng ngày không trùng; đổi người phụ trách tạo bản mới cho người mới và giữ lịch sử người cũ', () => {
  const original = A.ACCOUNTS.get('AC-NV01');
  const alternate = Object.assign({}, original, { id: 'AC-ALERT-MANAGER', fullName: 'Tổ trưởng thay thế', code: 'ALERT-MGR', status: 'ACTIVE', marketScopes: ['ALL'] });
  A.ACCOUNTS.list().push(alternate);
  MS.update('CL', { managementAssignments: [{ id: 'MMA-ALERT-1', accountId: original.id, effectiveFrom: '2026-01-01', effectiveTo: null, assignedBy: original.id, assignedAt: TODAY + 'T00:00:00.000Z', reason: 'Fixture' }] }, original);
  clearNotices(); PN.ensureContractExpiryAlerts(TODAY); PN.ensureContractExpiryAlerts(TODAY);
  const old = A.db.personalNotifications.filter(n => n.targetId === c7.id && n.recipientAccountId === original.id);
  assert.strictEqual(old.length, 1);
  MS.update('CL', { managementAssignments: [{ id: 'MMA-ALERT-2', accountId: alternate.id, effectiveFrom: '2026-01-01', effectiveTo: null, assignedBy: original.id, assignedAt: TODAY + 'T00:00:00.000Z', reason: 'Fixture đổi người phụ trách' }] }, original);
  PN.ensureContractExpiryAlerts(TODAY);
  const current = A.db.personalNotifications.filter(n => n.targetId === c7.id);
  assert(current.some(n => n.recipientAccountId === original.id) && current.some(n => n.recipientAccountId === alternate.id), 'lịch sử người cũ và người mới cùng được giữ');
});
ok('không có người nhận hợp lệ thì không gửi nhầm hoặc tự cấp quyền', () => {
  const accounts = A.ACCOUNTS.currentList().filter(a => A.ACCOUNTS.primaryRole(a) === 'market_manager');
  const before = accounts.map(a => [a, a.status]); accounts.forEach(x => { x.status = 'LOCKED'; });
  clearNotices();
  assert.strictEqual(PN.ensureContractExpiryAlerts(TODAY), 0);
  assert.strictEqual(A.db.personalNotifications.length, 0);
  before.forEach(([a, status]) => { a.status = status; });
});
console.log('contract-followup-alerts regression PASS (' + passed + ' checks)');
