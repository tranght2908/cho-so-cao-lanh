const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A;
const legacyIds = ['AC-NV06', 'AC-HA-QL', 'AC-TVH-QL', 'AC-TTT-QL', 'AC-TL-QL', 'AC-TT-QL', 'AC-TTH-QL', 'AC-MN-QL', 'AC-LH-QL', 'AC-XB-QL', 'AC-SQ-QL'];
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (error) { error.message = label + ': ' + error.message; throw error; } };
const login = id => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.syncAccountContext(); };

legacyIds.forEach((id, index) => A.ACCOUNTS.add({
  id, code: id.slice(3), fullName: 'Legacy manager ' + index, roleIds: ['market_manager'],
  accountType: A.PERM.role('market_manager').name, organization: 'Ban Quản lý legacy', marketScopes: [index ? 'HA' : 'TTD'], status: 'active'
}));

ok('canonical manager exists with ALL scope', () => {
  const manager = A.ACCOUNTS.get('AC-NV01');
  assert(manager);
  assert.strictEqual(A.ACCOUNTS.isCanonicalMarketManager(manager), true);
  assert.deepStrictEqual(Array.from(manager.marketScopes), ['ALL']);
});
ok('known legacy manager records remain persisted', () => {
  legacyIds.forEach(id => assert(A.ACCOUNTS.get(id), id));
});
ok('current organization list excludes exactly the known legacy manager seeds', () => {
  const current = A.ACCOUNTS.currentList();
  legacyIds.forEach(id => assert(!current.some(a => a.id === id), id));
  assert.strictEqual(current.filter(a => A.ACCOUNTS.primaryRole(a) === 'market_manager').length, 1);
});
ok('manager filter, search, count, and pagination do not surface legacy managers', () => {
  login('AC-QT01');
  A.ui.acc = { search: '', type: 'all', role: 'market_manager', market: '', status: '', viewMode: 'ACCOUNTS' };
  let html = A.VIEWS['tai-khoan']();
  assert(html.includes('NV01'));
  legacyIds.forEach(id => assert(!html.includes(id.slice(3)), id));
  A.ui.acc.search = 'HA-QL';
  html = A.VIEWS['tai-khoan']();
  assert(!html.includes('Legacy manager 1'));
});
ok('canonical manager detail and edit use shared organization and ALL presentation', () => {
  A.ACT['acc-edit']({ dataset: { id: 'AC-NV01' } });
  const modal = h.modal();
  assert(modal.includes('Tổ Quản lý chợ'));
  assert(modal.includes('Toàn bộ ' + A.allowedMarkets({ marketScopes: ['ALL'] }).length + ' chợ'));
  assert(/Tổ Quản lý chợ[^>]*readonly|readonly[^>]*Tổ Quản lý chợ/.test(modal));
  A.closeModal();
});

console.log(`accounts-current-organization regression PASS (${passed} checks)`);
