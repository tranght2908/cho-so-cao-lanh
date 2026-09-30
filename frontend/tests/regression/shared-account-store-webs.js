/* Integration regression: management and trader web are separate app roots,
 * but must read/write the same persisted account store. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
const TRADER_WEB_ROOT = path.join(ROOT, 'tieu-thuong');
const PHONE = '0912345678';
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const eq = (actual, expected, message) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, message);
const html = h => h.el('#tw-root').innerHTML || '';
const loginTraderWeb = (h, phone) => {
  h.act('tw-back');
  h.A.IN['tw-phone']({ value: phone });
  h.act('tw-lookup');
};

// Web quản lý creates two real Trader profiles, then creates their A07 account
// through its accounts service/repository facade.
const management = createApp(ROOT);
const A = management.A;
const TS = A.features.traders.service;
const today = A.U.today();
const createProfile = (id, market) => TS.create({
  id, name: 'Tiểu thương shared ' + id, phone: PHONE, idNo: 'CCCD-' + id,
  idType: 'CCCD', market, stalls: [], source: 'STAFF', since: today, app: false
});
const profileCL = createProfile('TT-SHARED-CL', 'CL');
const profileTTD = createProfile('TT-SHARED-TTD', 'TTD');
const accountId = 'AC-TT-SHARED';
A.features.accounts.service.add({
  id: accountId, code: 'TT-SHARED', fullName: profileCL.name, phone: A.ACCOUNTS.normalizePhone(PHONE),
  accountType: 'Tiểu thương', title: 'Tiểu thương', roleIds: ['trader'], organization: 'Chợ Cao Lãnh',
  marketScopes: ['CL'], status: 'PENDING_ACTIVATION', traderIds: [profileCL.id], traderId: profileCL.id
});
A.save();

ok('A. management service persists the pending A07 to the shared account key', () => {
  const account = A.ACCOUNTS.get(accountId);
  assert(account);
  eq(account.traderIds, [profileCL.id]);
  assert.strictEqual(A.ACCOUNTS.KEY, 'choso-caolanh-accounts');
  assert(JSON.parse(management.localStorage.getItem(A.ACCOUNTS.KEY)).some(a => a.id === accountId));
});

// Simulate a stale cached schema marker: a valid account list must remain the
// source of truth instead of being replaced by default accounts on trader-web boot.
management.localStorage.setItem('choso-caolanh-accounts-schema', 'stale-schema');
const traderWeb = createApp(TRADER_WEB_ROOT, { localStorage: management.localStorage });
const T = traderWeb.A;

ok('A. trader web finds the exact management-created account with normalized phone', () => {
  assert(!traderWeb.scripts.some(src => src.endsWith('trader-web/demo-seed.js')), 'trader web does not boot an account demo seed');
  assert.strictEqual(T.ACCOUNTS.byPhone('0912 345 678').id, accountId);
  assert.strictEqual(T.ACCOUNTS.get(accountId).status, 'PENDING_ACTIVATION');
  assert.strictEqual(T.ACCOUNTS.get(accountId), T.ACCOUNTS.byPhone(PHONE));
});

ok('B. pending account OTP activates the same persisted account and opens the sidebar', () => {
  loginTraderWeb(traderWeb, '0912-345-678');
  assert(/Xác thực OTP/.test(html(traderWeb)));
  T.IN['tw-otp']({ value: '123456' }); traderWeb.act('tw-verify');
  assert.strictEqual(T.ACCOUNTS.get(accountId).status, 'ACTIVE');
  assert(/class="merchant-sidebar"/.test(html(traderWeb)));
  assert.strictEqual(JSON.parse(management.localStorage.getItem(T.ACCOUNTS.KEY)).find(a => a.id === accountId).status, 'ACTIVE');
});

const managementAfterOtp = createApp(ROOT, { localStorage: management.localStorage });
const M2 = managementAfterOtp.A;
ok('B. management reload sees the same account ACTIVE', () => {
  const account = M2.ACCOUNTS.get(accountId);
  assert(account);
  assert.strictEqual(account.status, 'ACTIVE');
  eq(account.traderIds, [profileCL.id]);
});

ok('C. management links a second profile on the existing account, not a new account', () => {
  const linked = M2.ACCOUNTS.linkTraderProfile(accountId, profileTTD.id);
  assert(linked.ok, linked.reason);
  eq(M2.ACCOUNTS.get(accountId).traderIds, [profileCL.id, profileTTD.id]);
  assert.strictEqual(M2.ACCOUNTS.byPhone(PHONE).id, accountId);
});

const traderWebAfterLink = createApp(TRADER_WEB_ROOT, { localStorage: management.localStorage });
const T2 = traderWebAfterLink.A;
ok('C. trader web resolves both linked profiles and only their markets', () => {
  const account = T2.ACCOUNTS.byPhone(PHONE);
  assert.strictEqual(account.id, accountId);
  eq(T2.ACCOUNTS.traderProfilesOf(account).map(t => t.id).sort(), [profileCL.id, profileTTD.id].sort());
  eq(T2.ACCOUNTS.traderMarketsOf(account).sort(), ['CL', 'TTD']);
  loginTraderWeb(traderWebAfterLink, PHONE);
  T2.IN['tw-otp']({ value: '123456' }); traderWebAfterLink.act('tw-verify');
  const options = Array.from(html(traderWebAfterLink).matchAll(/<option value="([^"]+)"/g)).map(x => x[1]).sort();
  eq(options, [profileCL.id, profileTTD.id].sort());
});

ok('D. only a genuinely absent account shows the unregistered-phone message', () => {
  traderWebAfterLink.act('merchant-nav', { id: 'logout' });
  loginTraderWeb(traderWebAfterLink, '0999999999');
  assert(/chưa có tài khoản tiểu thương/.test(html(traderWebAfterLink)));
});

console.log(`shared-account-store-webs regression PASS (${passed} checks)`);
