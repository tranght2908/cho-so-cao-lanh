/* Focused regression: tạo tài khoản Tiểu thương TỪ hồ sơ có sẵn. Điều kiện: hồ sơ hợp lệ, chưa có account,
 * ≥1 hợp đồng hiệu lực gắn điểm KD, Trader.market = Contract.market = Point.market, SĐT đăng nhập hợp lệ và chưa
 * dùng. Chợ lấy từ Trader.market; mã, vai trò, trạng thái do hệ thống xác định; kích hoạt qua OTP. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const eq = (actual, expected, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, msg);
const lastToast = () => h.trace.toasts[h.trace.toasts.length - 1] || '';
const svc = A.features.accounts.service;
const readyIds = () => svc.traderAccountRows().map(x => x.t.id);
const login = id => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.syncAccountContext(); };

// ---- Fixtures (chỉ trong bộ nhớ harness) ----
const clPoints = A.db.stalls.filter(s => s.market === 'CL' && !A.db.contracts.some(c => c.status === 'hieuluc' && (c.businessPointId || c.stallId) === s.id));
const ttdPoint = A.db.stalls.find(s => s.market === 'TTD');
assert(clPoints.length >= 5 && ttdPoint, 'fixture points');
const mkTrader = (id, phone, market) => { const t = { id, name: 'Test ' + id, phone, market: market || 'CL', gender: 'Nữ', idNo: '0' + id.replace(/\D/g, '').padStart(11, '0') }; A.db.traders.push(t); return t; };
const mkContract = (id, traderId, point, market) => { const c = { id, traderId, stallId: point ? point.id : 'NO-SUCH-POINT', businessPointId: point ? point.id : 'NO-SUCH-POINT', market: market || 'CL', status: 'hieuluc', start: '2026-01-01', end: '2027-12-31', monthly: 1000000 }; A.db.contracts.push(c); return c; };
mkTrader('TX-NOC', '0981000001');                                                   // no contract
mkTrader('TX-NOPT', '0981000002'); mkContract('HĐ-TX-NOPT', 'TX-NOPT', null);          // contract without point
mkTrader('TX-OK', '0981000003'); mkContract('HĐ-TX-OK-1', 'TX-OK', clPoints[0]); mkContract('HĐ-TX-OK-2', 'TX-OK', clPoints[1]); // 2 points, same market
mkTrader('TX-CMIS', '0981000004'); mkContract('HĐ-TX-CMIS', 'TX-CMIS', clPoints[2], 'TTD'); // contract.market mismatch
mkTrader('TX-PMIS', '0981000005'); mkContract('HĐ-TX-PMIS', 'TX-PMIS', ttdPoint, 'CL');     // point.market mismatch
mkTrader('TX-BADPH', '09810'); mkContract('HĐ-TX-BADPH', 'TX-BADPH', clPoints[3]);        // invalid phone
mkTrader('TX-TTD', '0981000006', 'TTD'); mkContract('HĐ-TX-TTD', 'TX-TTD', A.db.stalls.filter(s => s.market === 'TTD').slice(-1)[0], 'TTD');
mkTrader('TX-DUPPH', '0900000001'); mkContract('HĐ-TX-DUPPH', 'TX-DUPPH', clPoints[4]);   // phone of AC-NV01
A.reindex();
login('AC-QT01');

ok('eligibility: no contract / no point / market mismatch / bad or used phone are not ready; eligible is', () => {
  const ids = readyIds();
  ['TX-NOC', 'TX-NOPT', 'TX-CMIS', 'TX-PMIS', 'TX-BADPH', 'TX-DUPPH'].forEach(id => assert(!ids.includes(id), id));
  assert(ids.includes('TX-OK') && ids.includes('TX-TTD'));
  assert(/Lệch dữ liệu chợ/.test(svc.traderAccountCandidate(A.idx.trader.get('TX-CMIS')).issues.join()));
  assert(/đã được dùng/.test(svc.traderAccountCandidate(A.idx.trader.get('TX-DUPPH')).issues.join()));
});
ok('trader that already has an account is not listed', () => {
  const linked = A.ACCOUNTS.list().filter(a => a.traderId).map(a => a.traderId);
  assert(linked.length);
  linked.forEach(id => assert(!readyIds().includes(id), id));
});
ok('queue Market filter uses Trader.market', () => {
  A.ui.acc = { search: '', type: 'all', role: '', market: '', status: '', viewMode: 'TRADERS_WITHOUT_ACCOUNT' };
  A.ui.accQueue = { search: 'test tx-', status: '', market: 'CL', type: '', role: '' }; A.ui.page.accQueue = 0;
  let html = A.VIEWS['tai-khoan']();
  assert(html.includes('TX-OK') && !html.includes('TX-TTD'));
  assert(html.includes(clPoints[0].code) && html.includes(clPoints[1].code), 'all points of the trader listed');
  A.ui.accQueue.market = '';
  html = A.VIEWS['tai-khoan']();
  assert(html.includes('TX-OK') && html.includes('TX-TTD'));
});
ok('popup: 3 read-only sections, Market = Trader.market, all points, correct point field, no selector', () => {
  A.ui.market = 'TTD'; // selectedMarket khác Trader.market → không được dùng
  h.act('wf-account-open', { id: 'TX-OK' });
  const html = h.modal();
  ['A. Hồ sơ tiểu thương', 'B. Thông tin tài khoản', 'C. Phạm vi dữ liệu', 'Hệ thống tự động tạo', 'Chờ kích hoạt', 'Tiểu thương',
    'Chỉ được truy cập dữ liệu của chính tiểu thương tại chợ này.', A.U.market('CL').name].forEach(x => assert(html.includes(x), x));
  assert(!/<select|type="checkbox"|data-ch=/.test(html), 'no editable control');
  // Điểm kinh doanh = Point.code từ quan hệ Contract → Point (không phải mã hồ sơ TX-OK)
  assert(html.includes(clPoints[0].code) && html.includes(clPoints[1].code) && html.includes('HĐ-TX-OK-1') && html.includes('HĐ-TX-OK-2'));
  assert(!/Điểm kinh doanh[^<]*<\/dt><dd>[^<]*TX-OK/.test(html));
  A.closeModal();
});
ok('create is blocked for mismatched markets (even if called directly)', () => {
  const before = A.ACCOUNTS.list().length;
  h.act('wf-account-create', { id: 'TX-CMIS' }); assert(/Lệch dữ liệu chợ/.test(lastToast()));
  h.act('wf-account-create', { id: 'TX-PMIS' }); assert(/Lệch dữ liệu chợ/.test(lastToast()));
  h.act('wf-account-open', { id: 'TX-PMIS' }); assert(!h.modal().includes('A. Hồ sơ tiểu thương'));
  assert.strictEqual(A.ACCOUNTS.list().length, before);
});
let acc, snapshot;
ok('create: generated code, role trader, PENDING, phone from profile, linked to profile, Market from Trader', () => {
  snapshot = JSON.stringify([A.idx.trader.get('TX-OK'), A.db.contracts.filter(c => c.traderId === 'TX-OK'), clPoints.slice(0, 2)]);
  A.ui.market = 'TTD';
  h.act('wf-account-create', { id: 'TX-OK' });
  acc = svc.byTraderId('TX-OK');
  assert(acc, lastToast());
  assert(/^AC-TT\d+$/.test(acc.id) && acc.code === acc.id.replace('AC-', ''));
  eq(acc.roleIds, ['trader']); eq(acc.status, 'PENDING_ACTIVATION');
  eq(acc.phone, '0981000003'); eq(acc.traderId, 'TX-OK'); eq(acc.marketScopes, ['CL']);
  assert(/Hướng dẫn kích hoạt đã được tạo/.test(lastToast()));
  assert(!readyIds().includes('TX-OK'), 'trader leaves the pending list');
  const codes = A.ACCOUNTS.list().map(a => a.code);
  assert.strictEqual(new Set(codes).size, codes.length);
});
ok('account list shows the trader account with correct role, status and Market', () => {
  A.ui.acc = { search: 'TX-OK', type: 'all', role: '', market: 'CL', status: '', viewMode: 'ACCOUNTS' };
  A.ui.acc.search = acc.code.toLowerCase();
  const html = A.VIEWS['tai-khoan']();
  assert(html.includes(acc.code) && html.includes('Chờ kích hoạt') && html.includes('Tiểu thương'));
  assert(html.includes(A.U.mShort('CL')));
});
ok('OTP 123456 (auto-filled) activates PENDING → ACTIVE without touching Trader/Contract/Point', () => {
  A.ui.sessionAccountId = null; A.ui.currentDemoAccountId = null;
  A.ui.auth = { step: 'phone', phone: '0981000003', otp: '', error: '' };
  h.act('auth-continue');
  eq(A.ui.auth.otp, '123456'); eq(svc.get(acc.id).status, 'PENDING_ACTIVATION');
  h.act('auth-verify');
  eq(A.ui.sessionAccountId, null, 'A07 gets no back-office session');
  eq(JSON.parse(h.sessionStorage.getItem(A.ACCOUNTS.TRADER_WEB_SESSION_KEY)).accountId, acc.id, 'handed off to the trader web');
  eq(svc.get(acc.id).status, 'ACTIVE');
  eq(JSON.stringify([A.idx.trader.get('TX-OK'), A.db.contracts.filter(c => c.traderId === 'TX-OK'), clPoints.slice(0, 2)]), snapshot);
  eq(svc.get(acc.id).marketScopes, ['CL']);
});
ok('internal account creation unaffected', () => {
  login('AC-QT01'); h.go('tai-khoan');
  h.act('acc-new');
  assert(!h.modal().includes('value="trader"'));
  Object.assign(A.ui.accForm, { fullName: 'NV nội bộ', phone: '0981000099' });
  A.CH['af-role']({ value: 'technician', dataset: {} });
  h.act('acc-form-save');
  const a = A.ACCOUNTS.byPhone('0981000099');
  assert(a && /^NV\d+$/.test(a.code) && a.status === 'PENDING_ACTIVATION');
});

console.log(`trader-account-create regression PASS (${passed} checks)`);
