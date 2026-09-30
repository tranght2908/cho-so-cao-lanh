const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const root = path.resolve(__dirname, '../..');
const { A } = createApp(root);
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (error) { error.message = label + ': ' + error.message; throw error; } };
const cleanScopes = () => A.ACCOUNTS.list().filter(a => A.ACCOUNTS.primaryRole(a) === 'collector' && A.ACCOUNTS.isActive(a))
  .forEach(a => A.ACCOUNTS.update(a.id, { marketScopes: [] }));
const add = (id, scopes) => {
  const saved = A.ACCOUNTS.saveCollectorAccount({ id, code: id, fullName: id, phone: '0900000000', roleIds: ['collector'], status: 'active', marketScopes: scopes });
  assert(saved.ok, saved.reason || 'collector was not saved');
  return A.ACCOUNTS.get(id);
};

cleanScopes();
const nv01 = add('TEST-ASSIGN-NV01', ['CL']);
const nv02 = add('TEST-ASSIGN-NV02', ['HA']);

ok('one active collector per market is valid', () => {
  assert.strictEqual(A.ACCOUNTS.getMarketCollector('CL').id, nv01.id);
  assert.strictEqual(A.ACCOUNTS.getMarketCollector('HA').id, nv02.id);
});
ok('a duplicate save is rejected until a transfer is confirmed', () => {
  const result = A.ACCOUNTS.saveCollectorAccount(Object.assign({}, nv02, { marketScopes: ['CL', 'HA'] }));
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'TRANSFER_REQUIRED');
  assert.deepStrictEqual(A.ACCOUNTS.get(nv01.id).marketScopes, ['CL']);
});
ok('transfer moves the only market without deleting or locking the old collector', () => {
  const result = A.ACCOUNTS.saveCollectorAccount(Object.assign({}, nv02, { marketScopes: ['CL', 'HA'] }), { transferMarkets: ['CL'] });
  assert(result.ok);
  assert.deepStrictEqual(A.ACCOUNTS.get(nv01.id).marketScopes, []);
  assert.strictEqual(A.ACCOUNTS.get(nv01.id).status, 'active');
  assert.strictEqual(A.ACCOUNTS.getMarketCollector('CL').id, nv02.id);
});
ok('transfer preserves the old collector\'s remaining markets', () => {
  const seeded = A.ACCOUNTS.saveCollectorAccount(Object.assign({}, nv01, { marketScopes: ['TVH', 'TTD'] }));
  assert(seeded.ok);
  const saved = A.ACCOUNTS.saveCollectorAccount(Object.assign({}, nv02, { marketScopes: ['CL', 'HA', 'TTD'] }), { transferMarkets: ['TTD'] });
  assert(saved.ok);
  assert.deepStrictEqual(A.ACCOUNTS.get(nv01.id).marketScopes, ['TVH']);
  assert.strictEqual(A.ACCOUNTS.getMarketCollector('TVH').id, nv01.id);
});
ok('legacy conflicts are visible and never pick an arbitrary collector', () => {
  A.ACCOUNTS.add({ id: 'TEST-ASSIGN-LEGACY', code: 'TEST-ASSIGN-LEGACY', fullName: 'Legacy', roleIds: ['collector'], status: 'active', marketScopes: ['TVH'] });
  assert.strictEqual(A.ACCOUNTS.marketCollectorState('TVH').status, 'CONFLICT');
  assert.strictEqual(A.ACCOUNTS.getMarketCollector('TVH'), null);
});
// Quyết định 30/09/2026: NV thu phí 0..N Chợ — mới tạo chưa được Tổ trưởng phân công là hợp lệ.
ok('a new collector may be created with no market (not yet assigned)', () => {
  const result = A.ACCOUNTS.saveCollectorAccount({ id: 'TEST-ASSIGN-EMPTY', code: 'TEST-ASSIGN-EMPTY', fullName: 'Empty', roleIds: ['collector'], status: 'active', marketScopes: [] });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(Array.from(A.ACCOUNTS.get('TEST-ASSIGN-EMPTY').marketScopes), []);
  assert.deepStrictEqual(Array.from(A.allowedMarkets(A.ACCOUNTS.get('TEST-ASSIGN-EMPTY'))), []);
});
ok('an unassigned market returns null', () => assert.strictEqual(A.ACCOUNTS.getMarketCollector('TTT'), null));
ok('locked collector scopes are retained but do not reserve a current assignment', () => {
  A.ACCOUNTS.add({ id: 'TEST-ASSIGN-LOCKED', code: 'TEST-ASSIGN-LOCKED', fullName: 'Locked', roleIds: ['collector'], status: 'LOCKED', marketScopes: ['TTT'] });
  assert.strictEqual(A.ACCOUNTS.getMarketCollector('TTT'), null);
});
ok('selected market falls back to the remaining allowed market after transfer', () => {
  // Simulate the current collector retaining another valid market while an old
  // legacy duplicate is being resolved by an explicit transfer.
  A.ACCOUNTS.update(nv01.id, { marketScopes: ['TVH', 'MN'] });
  A.ui.currentDemoAccountId = nv01.id;
  A.ui.sessionAccountId = nv01.id;
  A.ui.market = 'TVH';
  const saved = A.ACCOUNTS.saveCollectorAccount(Object.assign({}, nv02, { marketScopes: ['CL', 'HA', 'TTD', 'TVH'] }), { transferMarkets: ['TVH'] });
  assert(saved.ok);
  A.syncAccountContext();
  assert.strictEqual(A.ui.market, 'MN');
});

console.log(`collector-market-assignment regression PASS (${passed} checks)`);
