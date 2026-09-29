/* Focused regression: Account.marketScopes is the sole market-scope source for staff accounts. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A;
const allIds = () => A.allowedMarkets({ marketScopes: ['ALL'] });
const login = id => { A.ui.sessionAccountId = id; A.syncAccountContext(); };
const scoped = (id, scopes, role) => ({ id, code: id.replace('AC-', ''), fullName: id, phone: '', accountType: role, title: role, roleIds: [role], organization: 'Tổ Quản lý chợ', marketScopes: scopes, status: 'ACTIVE' });
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };

ok('collector one market is restricted to that market and header selector', () => {
  A.ACCOUNTS.add(scoped('AC-SCOPE-HA', ['HA'], 'collector'));
  login('AC-SCOPE-HA');
  assert.deepStrictEqual(Array.from(A.allowedMarkets(A.currentAccount())), ['HA']);
  assert(/value="HA"/.test(A.marketSelectOptionsHtml()) && !/value="CL"/.test(A.marketSelectOptionsHtml()));
});
ok('collector multiple markets is restricted to exactly those markets', () => {
  A.ACCOUNTS.add(scoped('AC-SCOPE-MULTI', ['HA', 'TVH'], 'collector'));
  login('AC-SCOPE-MULTI');
  assert.deepStrictEqual(Array.from(A.allowedMarkets(A.currentAccount())), ['HA', 'TVH']);
  assert(/value="HA"/.test(A.marketSelectOptionsHtml()) && /value="TVH"/.test(A.marketSelectOptionsHtml()) && !/value="CL"/.test(A.marketSelectOptionsHtml()));
});
ok('selected market outside scope falls back to the first permitted market', () => {
  A.ui.market = 'CL'; login('AC-SCOPE-MULTI');
  assert.strictEqual(A.ui.market, 'HA');
});
ok('canonical leader, central accountant, and ward leader are all-market accounts', () => {
  ['AC-NV01', 'AC-KTTT01', 'AC-LD01'].forEach(id => assert.deepStrictEqual(Array.from(A.ACCOUNTS.get(id).marketScopes), ['ALL'], id));
  ['AC-NV01', 'AC-KTTT01', 'AC-LD01'].forEach(id => assert.deepStrictEqual(Array.from(A.allowedMarkets(A.ACCOUNTS.get(id))), Array.from(allIds()), id));
});
ok('collector cannot save an empty scope', () => {
  login('AC-QT01'); h.go('tai-khoan'); h.act('acc-new');
  Object.assign(A.ui.accForm, { code: 'SCOPE-EMPTY', fullName: 'Scope Empty', roleIds: ['collector'], marketScopes: [] });
  const count = A.ACCOUNTS.list().length;
  h.act('acc-form-save');
  assert.strictEqual(A.ACCOUNTS.list().length, count);
  assert(/ít nhất một chợ/.test(h.trace.toasts.at(-1)));
  A.closeModal();
});
ok('account form stores ALL for fixed all-market roles', () => {
  h.act('acc-new');
  Object.assign(A.ui.accForm, { code: 'SCOPE-CENTRAL', fullName: 'Central Scope', roleIds: ['central_accountant'], marketScopes: ['HA'], status: 'ACTIVE' });
  h.act('acc-form-save');
  assert.deepStrictEqual(Array.from(A.ACCOUNTS.get('AC-SCOPE-CENTRAL').marketScopes), ['ALL']);
});
ok('account edit preserves role, status, and phone while changing a collector scope', () => {
  const before = Object.assign({}, A.ACCOUNTS.get('AC-SCOPE-MULTI'));
  const saved = A.ACCOUNTS.saveCollectorAccount(Object.assign({}, before, { marketScopes: ['TTT'] }), { transferMarkets: ['TTT'] });
  assert(saved.ok);
  const after = A.ACCOUNTS.get('AC-SCOPE-MULTI');
  assert.strictEqual(A.ACCOUNTS.primaryRole(after), A.ACCOUNTS.primaryRole(before));
  assert.strictEqual(after.status, before.status);
  assert.strictEqual(after.phone, before.phone);
  assert.deepStrictEqual(Array.from(after.marketScopes), ['TTT']);
});
ok('trader remains single-market and incident data remains untouched', () => {
  const trader = A.ACCOUNTS.get('AC-CHI-QUYET');
  assert.deepStrictEqual(Array.from(trader.marketScopes), ['TTD']);
  assert(A.db.rows.some(r => Object.prototype.hasOwnProperty.call(r, 'collectorId')), 'legacy row assignment data remains compatible');
  const incidents = JSON.stringify(A.db.incidents || []);
  login('AC-QT01');
  assert.strictEqual(JSON.stringify(A.db.incidents || []), incidents);
});
ok('OTP lookup still resolves the canonical manager', () => {
  assert.strictEqual(A.ACCOUNTS.byPhone('0900000001').id, 'AC-NV01');
});

console.log(`account market scope regression PASS (${passed} checks)`);
