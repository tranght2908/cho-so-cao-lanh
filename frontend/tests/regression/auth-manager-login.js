/* Focused account seed/migration and generic phone + OTP login regression. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');

const fresh = createApp(root);
const A = fresh.A;
const manager = A.ACCOUNTS.get('AC-NV01');
assert(manager);
assert.strictEqual(manager.phone, '0900000001');
assert.strictEqual(A.ACCOUNTS.primaryRole(manager), 'market_manager');
assert.deepStrictEqual(Array.from(manager.marketScopes), ['ALL']);
assert.strictEqual(A.ACCOUNTS.byPhone('0900000001').id, 'AC-NV01');
assert.strictEqual(A.ACCOUNTS.list().filter(a => A.ACCOUNTS.normalizePhone(a.phone) === '0900000001').length, 1);

// Existing persisted accounts retain deliberate edits, but blank old seed phone
// receives the new seed value without a reset.
const oldAccounts = A.ACCOUNTS.list().map(a => Object.assign({}, a, { roleIds: (a.roleIds || []).slice(), marketScopes: (a.marketScopes || []).slice() }));
oldAccounts.find(a => a.id === 'AC-NV01').phone = '';
const migrated = createApp(root, { storage: {
  'choso-caolanh-accounts': JSON.stringify(oldAccounts),
  'choso-caolanh-accounts-schema': String(A.RBAC_SCHEMA)
} }).A;
assert.strictEqual(migrated.ACCOUNTS.get('AC-NV01').phone, '0900000001');

A.ui.market = 'CL';
A.ui.auth = { step: 'phone', phone: '0900000001', otp: '', error: '' };
fresh.act('auth-continue');
assert.strictEqual(A.ui.auth.step, 'otp');
A.ui.auth.otp = '123456';
fresh.act('auth-verify');
assert.strictEqual(A.ui.sessionAccountId, 'AC-NV01');
assert.strictEqual(A.currentAccount().fullName, 'Trần Minh Khoa');
assert.strictEqual(A.ACCOUNTS.primaryRole(A.currentAccount()), 'market_manager');
assert.strictEqual(A.allowedMarkets(A.currentAccount()).length, A.allowedMarkets({ marketScopes: ['ALL'] }).length);

console.log('manager phone/OTP login regression PASS');
