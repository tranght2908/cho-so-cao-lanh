/* P0: two independent app memories over one localStorage business/account source. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const ROOT = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (name, fn) => { try { fn(); passed++; } catch (e) { e.message = name + ': ' + e.message; throw e; } };

const tabA = createApp(ROOT);
const tabB = createApp(ROOT, { localStorage: tabA.localStorage });
const A = tabA.A, B = tabB.A;

ok('management save is rehydrated by trader-side state cache', () => {
  A.db.contracts.push({ id: 'HD-SHARED-001', traderId: 'TT-SHARED', market: 'CL', businessPointId: 'CL-KA-A01', status: 'active', start: '2026-05-01', end: '2026-12-31' });
  A.save();
  assert.strictEqual(B.data.reloadSharedState().changed, true);
  assert(B.db.contracts.some(x => x.id === 'HD-SHARED-001'));
});

ok('trader-side incident is rehydrated by management cache', () => {
  B.db.incidents.push({ id: 'PA-SHARED-001', traderId: 'TT-SHARED', market: 'CL', stallId: 'CL-KA-A01', state: 'tiepnhan', log: [] });
  B.save();
  assert.strictEqual(A.data.reloadSharedState().changed, true);
  assert(A.db.incidents.some(x => x.id === 'PA-SHARED-001'));
});

ok('stale whole-db save keeps independent mutations from both tabs', () => {
  // B is deliberately left at the previous baseline while A writes first.
  A.db.contracts.push({ id: 'HD-SHARED-STALE', traderId: 'TT-SHARED', market: 'CL', businessPointId: 'CL-KA-A02', status: 'active' });
  A.save();
  B.db.incidents.push({ id: 'PA-SHARED-STALE', traderId: 'TT-SHARED', market: 'CL', stallId: 'CL-KA-A02', state: 'tiepnhan', log: [] });
  B.save();
  A.data.reloadSharedState();
  assert(A.db.contracts.some(x => x.id === 'HD-SHARED-STALE'));
  assert(A.db.incidents.some(x => x.id === 'PA-SHARED-STALE'));
});

ok('account cache reloads the same A07 and OTP status', () => {
  const id = 'AC-SHARED-REFRESH';
  A.ACCOUNTS.add({ id, code: 'TT-REFRESH', fullName: 'Trader refresh', phone: '0988000111', roleIds: ['trader'], marketScopes: [], status: 'PENDING_ACTIVATION', traderIds: [] });
  assert.strictEqual(B.ACCOUNTS.reload().changed, true);
  assert.strictEqual(B.ACCOUNTS.byPhone('0988 000 111').id, id);
  B.ACCOUNTS.activateAfterOtp(B.ACCOUNTS.get(id));
  assert.strictEqual(A.ACCOUNTS.reload().changed, true);
  assert.strictEqual(A.ACCOUNTS.get(id).status, 'ACTIVE');
});

ok('new linked profile becomes visible after both shared caches refresh', () => {
  const trader = { id: 'TT-SHARED-PROFILE', name: 'Trader profile refresh', phone: '0988000111', market: 'TTD', stalls: [], app: false };
  A.db.traders.push(trader); A.reindex(); A.save();
  const linked = A.ACCOUNTS.linkTraderProfile('AC-SHARED-REFRESH', trader.id);
  assert(linked.ok, linked.reason);
  B.data.reloadSharedState(); B.ACCOUNTS.reload();
  assert(B.ACCOUNTS.traderProfilesOf(B.ACCOUNTS.get('AC-SHARED-REFRESH')).some(x => x.id === trader.id));
});

console.log(`shared-state-refresh regression PASS (${passed} checks)`);
