/* Focused regression: web Tiểu thương (frontend/tieu-thuong/index.html) là cổng chính thức của A07.
 * Đăng nhập SĐT → Tài khoản A07 → OTP dùng một lần (123456, tự điền, không tự gửi) → kích hoạt nếu Chờ kích hoạt
 * → hồ sơ đang xem lấy từ Account.traderIds (chọn theo chợ), dữ liệu lọc theo traderId. A07 đăng nhập nhầm web quản lý
 * được chuyển sang web Tiểu thương, không nhận quyền back-office. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
const TW_ROOT = path.join(ROOT, 'tieu-thuong');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const eq = (actual, expected, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, msg);
const store = h => { const o = {}; h.localStorage._m.forEach((v, k) => { o[k] = v; }); return o; };
const twHtml = h => h.el('#tw-root').innerHTML || '';
const PHONE = '0953000001';

// ---------- Web quản lý: hồ sơ TT-A (CL) → hợp đồng + điểm → tạo tài khoản (Chờ kích hoạt) ----------
const hb = createApp(ROOT), B = hb.A;
const TS = B.features.traders.service, BP = B.features.businessPoints.service;
const login = id => { B.ui.sessionAccountId = id; B.ui.currentDemoAccountId = id; B.ui.market = 'CL'; B.syncAccountContext(); };
const today = B.U.today(), end = (() => { const d = new Date(today + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + 1); return d.toISOString().slice(0, 10); })();
const mkProfile = (id, market, phone) => TS.create({ id, name: 'Tiểu thương ' + id, phone, idNo: 'ID-' + id, idType: 'CCCD', market, stalls: [], source: 'STAFF', since: today, app: false });
const rent = (t, p) => B.features.contracts.service.createWithPointAllocation({ contract: { id: 'HĐ-' + t.id, traderId: t.id, stallId: p.id, businessPointId: p.id, market: t.market, kind: 'Hợp đồng thuê điểm kinh doanh', start: today, end, monthly: 100000, status: 'hieuluc', history: [] }, traderId: t.id, pointId: p.id, pointHistoryEntry: 'test' });
const freeIn = m => B.db.stalls.filter(p => p.market === m && BP.row(p) && BP.isAvailable(p.id, today, end));
const tA = mkProfile('TT-WA', 'CL', PHONE); rent(tA, freeIn('CL')[0]);
const tB = mkProfile('TT-WB', 'TTD', PHONE); rent(tB, freeIn('TTD')[0]);   // cùng người, chợ khác
const neighbour = B.db.traders.find(t => t.market === 'CL' && t.id !== tA.id && B.db.contracts.some(c => c.traderId === t.id && c.status === 'hieuluc'));
login('AC-QT01'); hb.go('tai-khoan');
hb.act('wf-account-create', { id: tA.id });
const acc = B.ACCOUNTS.byTraderId(tA.id);

ok('1-4. profile + contract/point → account created from back-office: PENDING, traderIds includes profile', () => {
  assert(acc, hb.trace.toasts.at(-1));
  eq(acc.status, 'PENDING_ACTIVATION'); eq(acc.roleIds, ['trader']); eq(acc.phone, PHONE);
  assert(acc.traderIds.includes(tA.id)); eq(acc.traderId, tA.id);
});
const r = B.ACCOUNTS.linkTraderProfile(acc.id, tB.id);
assert(r.ok, r.reason);
// Tài khoản mẫu cho ca âm
B.ACCOUNTS.add({ id: 'AC-TW-LOCK', code: 'TW-LOCK', fullName: 'Khoá', phone: '0953000002', roleIds: ['trader'], organization: '', marketScopes: [], status: 'LOCKED', traderIds: [neighbour.id], traderId: neighbour.id });
B.ACCOUNTS.add({ id: 'AC-TW-EMPTY', code: 'TW-EMPTY', fullName: 'Chưa liên kết', phone: '0953000003', roleIds: ['trader'], organization: '', marketScopes: ['CL'], status: 'ACTIVE', traderIds: [] });
B.save();

// ---------- Web Tiểu thương ----------
const ht = createApp(TW_ROOT, { storage: store(hb) }), T = ht.A;
const twLogin = (phone, otp) => { ht.act('tw-back'); T.IN['tw-phone']({ value: phone }); ht.act('tw-lookup'); if (otp != null) T.IN['tw-otp']({ value: otp }); };

ok('5. trader web loads the canonical phone login without a demo-account picker', () => {
  const html = twHtml(ht);
  assert(/Đăng nhập/.test(html) && /id="tw-phone"/.test(html));
  assert(!html.includes('Tài khoản tiểu thương mẫu'));
  assert(!/data-act="tw-demo"/.test(html));
});
ok('OTP: auto-filled 123456 but not auto-submitted; request alone does not activate', () => {
  twLogin(PHONE);
  assert(/Xác thực OTP/.test(twHtml(ht)) && /123456/.test(twHtml(ht)));
  eq(T.ACCOUNTS.get(acc.id).status, 'PENDING_ACTIVATION');
});
ok('negative: OTP ≠ 123456 → blocked, not activated, not logged in', () => {
  T.IN['tw-otp']({ value: '654321' }); ht.act('tw-verify');
  assert(/không chính xác/.test(twHtml(ht)));
  eq(T.ACCOUNTS.get(acc.id).status, 'PENDING_ACTIVATION');
  assert(!/tw-top/.test(twHtml(ht)));
});
ok('6-10. correct OTP → ACTIVE → canonical sidebar → overview resolves TT-WA', () => {
  T.IN['tw-otp']({ value: '123456' }); ht.act('tw-verify');
  const a = T.ACCOUNTS.get(acc.id);
  eq(a.status, 'ACTIVE'); eq(a.traderIds, [tA.id, tB.id]); eq(a.traderId, tA.id);
  const html = twHtml(ht);
  assert(/class="merchant-sidebar"/.test(html) && html.includes(tA.name), 'canonical sidebar UI with TT-WA');
  eq(JSON.parse(ht.sessionStorage.getItem(T.ACCOUNTS.TRADER_WEB_SESSION_KEY)), { traderId: tA.id, accountId: acc.id });
});
ok('11. contracts/points/finance/incidents only of TT-WA', () => {
  ht.act('merchant-nav', { id: 'contracts' });
  let html = twHtml(ht);
  assert(html.includes('HĐ-' + tA.id) && !html.includes('HĐ-' + tB.id), 'only own contract');
  B.db.contracts.filter(c => c.traderId === neighbour.id).forEach(c => assert(!html.includes(c.id), 'neighbour contract hidden ' + c.id));
  ht.act('merchant-nav', { id: 'finance' });
  html = twHtml(ht);
  T.db.invoices.filter(i => i.traderId === neighbour.id).forEach(i => assert(!html.includes(i.id), 'neighbour invoice hidden'));
  ht.act('merchant-nav', { id: 'home' });
});
ok('multi-profile: market selector lists only markets of linked profiles; switching changes the active profile', () => {
  let html = twHtml(ht);
  assert(/data-ch="mini-profile"/.test(html));
  const opts = Array.from(html.matchAll(/<option value="([^"]+)"/g)).map(m => m[1]);
  eq(opts.sort(), [tA.id, tB.id].sort());
  T.CH['mini-profile']({ value: tB.id });
  html = twHtml(ht);
  assert(html.includes(tB.name) && html.includes(T.U.market('TTD').short));
  ht.act('merchant-nav', { id: 'contracts' });
  html = twHtml(ht);
  assert(html.includes('HĐ-' + tB.id) && !html.includes('HĐ-' + tA.id));
  T.CH['mini-profile']({ value: neighbour.id }); // hồ sơ không thuộc tài khoản → bỏ qua
  assert(!twHtml(ht).includes(neighbour.name));
  T.CH['mini-profile']({ value: tA.id });
  ht.act('merchant-nav', { id: 'home' });
  assert(twHtml(ht).includes(tA.name));
  eq(JSON.parse(ht.sessionStorage.getItem(T.ACCOUNTS.TRADER_WEB_SESSION_KEY)), { traderId: tA.id, accountId: acc.id });
});
ok('logout roundtrip: sidebar → canonical login → OTP → canonical sidebar', () => {
  ht.act('merchant-nav', { id: 'logout' });
  let html = twHtml(ht);
  assert(/id="tw-phone"/.test(html) && !/class="merchant-sidebar"/.test(html));
  assert.strictEqual(ht.sessionStorage.getItem(T.ACCOUNTS.TRADER_WEB_SESSION_KEY), null);
  twLogin(PHONE, '123456'); ht.act('tw-verify');
  html = twHtml(ht);
  assert(/class="merchant-sidebar"/.test(html) && html.includes(tA.name));
});
ok('negative: LOCKED account → blocked', () => {
  ht.act('tw-logout');
  twLogin('0953000002');
  assert(/tạm khóa/.test(twHtml(ht)) && !/Xác thực OTP/.test(twHtml(ht)));
});
ok('negative: internal account cannot log in to the trader web', () => {
  twLogin('0900000001');
  assert(/chưa có tài khoản tiểu thương/.test(twHtml(ht)));
});
ok('A07 without profile → "chưa liên kết", no sample fallback', () => {
  twLogin('0953000003', '123456'); ht.act('tw-verify');
  const html = twHtml(ht);
  assert(html.includes('Tài khoản chưa được liên kết với hồ sơ tiểu thương.'));
  assert(!/class="tw-top"/.test(html));
  T.db.traders.slice(0, 20).forEach(t => assert(!html.includes(t.name), 'no other trader shown: ' + t.name));
  ht.act('tw-logout');
});
ok('A07 logging into the back-office is sent to the trader web (no RBAC blank screen, no back-office session)', () => {
  const hb2 = createApp(ROOT, { storage: store(hb) }), C = hb2.A;
  C.ui.sessionAccountId = null; C.ui.currentDemoAccountId = null;
  C.ui.auth = { step: 'phone', phone: PHONE, otp: '', error: '' };
  hb2.act('auth-continue'); eq(C.ui.auth.otp, '123456'); hb2.act('auth-verify');
  eq(C.ui.sessionAccountId, null);
  const notice = hb2.el('#auth-root').innerHTML;
  assert(/Mở Cổng tiểu thương/.test(notice) && notice.includes(C.ACCOUNTS.TRADER_WEB_URL));
  assert(!/chưa được cấp quyền truy cập chức năng/.test(hb2.el('#view').innerHTML || ''));
  eq(JSON.parse(hb2.sessionStorage.getItem(C.ACCOUNTS.TRADER_WEB_SESSION_KEY)).accountId, acc.id);
  assert(String(hb2.ctx.location.href || '').includes('tieu-thuong/index.html'));
  // Phiên đó mở thẳng web Tiểu thương (sessionStorage dùng chung, không cần OTP lại)
  const ht2 = createApp(TW_ROOT, { storage: store(hb2), sessionStorage: { [C.ACCOUNTS.TRADER_WEB_SESSION_KEY]: hb2.sessionStorage.getItem(C.ACCOUNTS.TRADER_WEB_SESSION_KEY) } });
  ht2.location.hash = '#/trang-chu'; ht2.flush();
  assert(twHtml(ht2).includes(tA.name));
  // Demo/phiên cũ: A07 trong back-office → màn hướng sang web Tiểu thương, không phải RBAC trắng
  C.ui.sessionAccountId = acc.id; C.route();
  assert(/Mở Cổng tiểu thương/.test(hb2.el('#auth-root').innerHTML));
});
ok('back-office permissions of A07 unchanged (no screen besides existing mini-app)', () => {
  const screens = B.PERM.rolePermKeys('trader').filter(k => k.startsWith('screen:'));
  eq(screens, ['screen:mini-app']);
});

console.log(`trader-web-login regression PASS (${passed} checks)`);
