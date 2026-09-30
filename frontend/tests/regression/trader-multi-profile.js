/* Focused regression — Task 1: nền tảng Account 1 — N Trader Profile (Account.traderIds[]).
 * traderId = hồ sơ mặc định (tương thích); linkedTraderId legacy được gom; không có Trader.accountId. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const eq = (actual, expected, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, msg);
const snap = h => { const o = {}; h.localStorage._m.forEach((v, k) => { o[k] = v; }); return o; };

// Hai hồ sơ thật của cùng một "người" ở hai chợ khác nhau (chỉ trong bộ nhớ/test).
function withProfiles(A) {
  const cl = A.db.traders.find(t => t.market === 'CL' && !A.ACCOUNTS.isTraderLinked(t.id));
  const ttd = A.db.traders.find(t => t.market === 'TTD' && !A.ACCOUNTS.isTraderLinked(t.id));
  ttd.phone = cl.phone; // cùng người → cùng SĐT, khác chợ (hợp lệ)
  return { cl, ttd };
}
const traderAcc = (id, phone, extra) => Object.assign({ id, code: id.replace('AC-', ''), fullName: id, phone, accountType: 'Tiểu thương', title: 'Tiểu thương', roleIds: ['trader'], organization: '', marketScopes: [], status: 'ACTIVE' }, extra || {});

// ---------- A/B/C: migration legacy traderId / linkedTraderId, idempotent ----------
const base = createApp(ROOT);
const { cl, ttd } = withProfiles(base.A);
base.A.save();
const storage = snap(base);
const legacyAccounts = JSON.parse(storage['choso-caolanh-accounts'] || JSON.stringify(base.A.ACCOUNTS.list())).map(a => { const x = Object.assign({}, a); delete x.traderIds; return x; });
legacyAccounts.push(traderAcc('AC-LEG-A', '0981555001', { traderId: 'TT-LEG-A' }));
legacyAccounts.push(traderAcc('AC-LEG-B', '0981555002', { traderId: null, linkedTraderId: 'TT-LEG-B' }));
legacyAccounts.push(traderAcc('AC-LEG-C', '0981555003', { traderId: 'TT-LEG-C', linkedTraderId: 'TT-LEG-C' }));
legacyAccounts.push(traderAcc('AC-DUP-1', '0981555004', { traderId: 'TT-DUP' }));
legacyAccounts.push(traderAcc('AC-DUP-2', '0981555005', { traderId: 'TT-DUP' }));
storage['choso-caolanh-accounts'] = JSON.stringify(legacyAccounts);
storage['choso-caolanh-accounts-schema'] = String(base.A.RBAC_SCHEMA);
const h1 = createApp(ROOT, { storage });
const A = h1.A;

ok('A. legacy traderId → traderIds = [traderId]', () => {
  const a = A.ACCOUNTS.get('AC-LEG-A');
  eq(a.traderIds, ['TT-LEG-A']); eq(a.traderId, 'TT-LEG-A');
});
ok('B. legacy linkedTraderId gathered into traderIds (+ default traderId when single)', () => {
  const b = A.ACCOUNTS.get('AC-LEG-B');
  eq(b.traderIds, ['TT-LEG-B']); eq(b.traderId, 'TT-LEG-B'); eq(b.linkedTraderId, 'TT-LEG-B', 'legacy field kept');
  eq(A.ACCOUNTS.get('AC-LEG-C').traderIds, ['TT-LEG-C'], 'no duplicate');
  A.ACCOUNTS.list().forEach(x => { assert(Array.isArray(x.traderIds), x.id); if (x.traderId) assert(x.traderIds.includes(x.traderId), x.id); });
});
ok('C. migration twice → data unchanged', () => {
  const s1 = snap(h1);
  const h2 = createApp(ROOT, { storage: s1 });
  eq(h2.localStorage.getItem('choso-caolanh-accounts'), s1['choso-caolanh-accounts']);
  eq(h2.A.ACCOUNTS.list().length, A.ACCOUNTS.list().length);
});
ok('conflict (legacy trader in 2 accounts) is reported, not auto-fixed, not resolved randomly', () => {
  eq(A.ACCOUNTS.byTraderId('TT-DUP'), null);
  eq(A.ACCOUNTS.traderLinkState('TT-DUP').status, 'CONFLICT');
  assert(A.ACCOUNTS.isTraderLinked('TT-DUP'));
  const c = A.ACCOUNTS.traderLinkConflicts().find(x => x.traderId === 'TT-DUP');
  eq(c.accountIds.sort(), ['AC-DUP-1', 'AC-DUP-2']);
  eq(A.ACCOUNTS.get('AC-DUP-1').traderIds, ['TT-DUP']); eq(A.ACCOUNTS.get('AC-DUP-2').traderIds, ['TT-DUP']);
});
ok('I. missing Trader id is kept and exposed as missing', () => {
  const links = A.ACCOUNTS.traderProfileLinks(A.ACCOUNTS.get('AC-LEG-A'));
  eq(links.map(l => [l.traderId, l.missing]), [['TT-LEG-A', true]]);
  eq(A.ACCOUNTS.traderProfilesOf(A.ACCOUNTS.get('AC-LEG-A')), []);
  eq(A.ACCOUNTS.get('AC-LEG-A').traderIds, ['TT-LEG-A']);
});

// ---------- D–H, K: link write path + derived markets ----------
A.ACCOUNTS.add(traderAcc('AC-MULTI', cl.phone, { traderId: cl.id }));
ok('F. link TT02 into account with TT01 → [TT01, TT02], default traderId unchanged', () => {
  const r = A.ACCOUNTS.linkTraderProfile('AC-MULTI', ttd.id);
  assert(r.ok, r.reason);
  const a = A.ACCOUNTS.get('AC-MULTI');
  eq(a.traderIds, [cl.id, ttd.id]); eq(a.traderId, cl.id);
});
ok('D. traderProfilesOf returns both profiles', () => {
  eq(A.ACCOUNTS.traderProfilesOf(A.ACCOUNTS.get('AC-MULTI')).map(t => t.id), [cl.id, ttd.id]);
});
ok('E. byTraderId(TT02) resolves the account even though TT02 is not the default', () => {
  eq(A.ACCOUNTS.byTraderId(ttd.id).id, 'AC-MULTI');
  eq(A.features.accounts.service.byTraderId(ttd.id).id, 'AC-MULTI');
});
ok('G. linking the same Trader twice does not duplicate', () => {
  const r = A.ACCOUNTS.linkTraderProfile('AC-MULTI', ttd.id);
  assert(r.ok && r.alreadyLinked);
  eq(A.ACCOUNTS.get('AC-MULTI').traderIds, [cl.id, ttd.id]);
});
ok('H. linking a Trader owned by another account is blocked; other validations', () => {
  A.ACCOUNTS.add(traderAcc('AC-OTHER', cl.phone.replace(/.$/, d => String((+d + 1) % 10))));
  eq(A.ACCOUNTS.linkTraderProfile('AC-OTHER', ttd.id).reason, 'TRADER_LINKED_TO_OTHER_ACCOUNT');
  eq(A.ACCOUNTS.get('AC-OTHER').traderIds, []);
  eq(A.ACCOUNTS.linkTraderProfile('AC-NOPE', ttd.id).reason, 'ACCOUNT_NOT_FOUND');
  eq(A.ACCOUNTS.linkTraderProfile('AC-NV01', ttd.id).reason, 'NOT_TRADER_ACCOUNT');
  eq(A.ACCOUNTS.linkTraderProfile('AC-MULTI', 'NO-SUCH-TRADER').reason, 'TRADER_NOT_FOUND');
  const stranger = A.db.traders.find(t => t.market === 'CL' && t.id !== cl.id && !A.ACCOUNTS.isTraderLinked(t.id));
  eq(A.ACCOUNTS.linkTraderProfile('AC-MULTI', stranger.id).reason, 'PHONE_MISMATCH');
  // (chợ, SĐT) trùng giữa hai hồ sơ cùng chợ → chặn
  const twin = Object.assign({}, cl, { id: 'TX-TWIN', stalls: [] }); A.db.traders.push(twin); A.reindex();
  eq(A.ACCOUNTS.linkTraderProfile('AC-MULTI', 'TX-TWIN').reason, 'DUPLICATE_MARKET_PHONE');
  A.db.traders = A.db.traders.filter(t => t.id !== 'TX-TWIN'); A.reindex();
  assert(!A.ACCOUNTS.get('AC-MULTI').traderIds.includes('TX-TWIN'));
});
ok('K. derived markets TT01@CL + TT02@TTD → [CL, TTD]', () => {
  eq(A.ACCOUNTS.traderMarketsOf(A.ACCOUNTS.get('AC-MULTI')).sort(), ['CL', 'TTD']);
});
ok('L. derived Market does not grant access to another Trader of the same Market', () => {
  const acc = A.ACCOUNTS.get('AC-MULTI');
  const other = A.db.traders.find(t => t.market === 'CL' && t.id !== cl.id);
  assert(!A.ACCOUNTS.traderIdsOf(acc).includes(other.id));
  A.ACCOUNTS.update('AC-MULTI', { marketScopes: ['CL', 'TTD'] });
  A.ui.sessionAccountId = 'AC-MULTI'; A.ui.currentDemoAccountId = 'AC-MULTI'; A.ui.market = 'CL'; A.syncAccountContext();
  A.ui.mini = Object.assign(A.ui.mini || {}, { traderId: other.id, step: 'app', tab: 'home' });
  const html = A.VIEWS['mini-app']();
  assert(!html.includes(other.name), 'other trader of same Market not shown');
  eq(A.ui.mini.traderId, cl.id, 'state forced back to an own profile');
});
ok('J. trader account without a valid profile: empty state, no sample fallback', () => {
  A.ACCOUNTS.add(traderAcc('AC-EMPTY', '0981555099', { marketScopes: ['CL'] }));
  A.ui.sessionAccountId = 'AC-EMPTY'; A.ui.currentDemoAccountId = 'AC-EMPTY'; A.ui.market = 'CL'; A.syncAccountContext();
  A.ui.mini = Object.assign(A.ui.mini || {}, { traderId: cl.id, step: 'app', tab: 'home' });
  const html = A.VIEWS['mini-app']();
  assert(html.includes('Tài khoản chưa được liên kết với hồ sơ tiểu thương.'));
  assert(!html.includes(cl.name));
  eq(A.ui.mini.traderId, null);
  // legacy account whose only id is missing → same safe state
  A.ui.sessionAccountId = 'AC-LEG-A'; A.ui.currentDemoAccountId = 'AC-LEG-A'; A.ACCOUNTS.update('AC-LEG-A', { marketScopes: ['CL'] }); A.syncAccountContext();
  assert(A.VIEWS['mini-app']().includes('Tài khoản chưa được liên kết với hồ sơ tiểu thương.'));
});
ok('non-A07 role: no Trader profile resolved, no sample fallback, clear message', () => {
  A.ui.sessionAccountId = 'AC-NV05'; A.ui.currentDemoAccountId = 'AC-NV05'; A.ui.market = 'CL'; A.syncAccountContext();
  A.ui.mini = Object.assign(A.ui.mini || {}, { traderId: cl.id, step: 'app', tab: 'home' });
  const html = A.VIEWS['mini-app']();
  assert(html.includes('Chức năng này chỉ dành cho tài khoản Tiểu thương.'));
  assert(!html.includes(cl.name));
  eq(A.openTraderPortalProfile(), false);
  const src = require('fs').readFileSync(path.join(ROOT, 'src/features/trader-portal/page.js'), 'utf8');
  assert(!/sampleTraders/.test(src), 'sample fallback removed from runtime');
});
ok('single-profile trader login flow still works (compat traderId)', () => {
  A.ui.sessionAccountId = null; A.ui.currentDemoAccountId = null;
  const seedTrader = A.ACCOUNTS.get('AC-TT03');
  eq(seedTrader.traderIds, ['TT0003']);
  A.ui.auth = { step: 'phone', phone: seedTrader.phone, otp: '', error: '' };
  h1.act('auth-continue'); h1.act('auth-verify');
  // A07 dùng web Tiểu thương: không tạo phiên back-office; phiên web Tiểu thương mở đúng hồ sơ mặc định.
  eq(A.ui.sessionAccountId, null);
  eq(JSON.parse(h1.sessionStorage.getItem(A.ACCOUNTS.TRADER_WEB_SESSION_KEY)), { accountId: 'AC-TT03', traderId: 'TT0003' });
});

console.log(`trader-multi-profile regression PASS (${passed} checks)`);
