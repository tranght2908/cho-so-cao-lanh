/* Focused regression: "Tạm khóa tài khoản" requires an intentional confirmation (reason + 6-digit
 * action confirmation code shown in the popup, 30 s validity, 3 wrong attempts → 30 min cooldown of
 * the lock ACTION for the current admin). The existing acc-toggle / A.ACCOUNTS.setStatus path is
 * reused; the code is never persisted. Run: node frontend/tests/regression/account-lock-confirm.js */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
const COOLDOWN_KEY = 'choso-caolanh-action-cooldown';
let now = new Date('2026-05-15T09:30:00Z').getTime();
function boot(storage) {
  const h = createApp(ROOT, { storage });
  const Base = h.ctx.Date;
  // Controllable clock: every Date.now()/new Date() in the runtime reads `now`.
  h.ctx.Date = class extends Base { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } };
  return h;
}
let h = boot(), A = h.A;
const login = id => { A.ui.sessionAccountId = id; A.ui.market = 'CL'; A.syncAccountContext(); };
login('AC-QT01'); h.go('tai-khoan');
const status = id => A.ACCOUNTS.authStatus(A.ACCOUNTS.get(id));
const code = () => { const m = h.modal().match(/id="acc-lock-code">(\d{3}) (\d{3})</); return m && m[1] + m[2]; };
const setReason = v => h.ctx.APP.IN['acc-lock-reason']({ value: v });
const setCode = v => { const el = { value: v }; A.IN['acc-lock-code'](el); return el.value; };
const confirm = () => h.act('acc-lock-confirm');
const err = () => h.el('#acc-lock-error').textContent;
const rbac = () => JSON.stringify(A.ACCOUNTS.list().map(a => [a.id, a.roleIds, a.marketScopes])) + JSON.stringify(A.PERM.roles());
const rbacBefore = rbac();
const TARGET = 'AC-NV02', OTHER = 'AC-NV03';
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; console.log('PASS ' + label); } catch (e) { console.log('FAIL ' + label); throw e; } };
const wrong = c => String((+c + 1) % 1000000).padStart(6, '0');

ok('A. menu → Tạm khóa opens the popup with a 6-digit code, account not locked yet', () => {
  assert.strictEqual(status(TARGET), 'ACTIVE');
  h.act('acc-more', { id: TARGET });
  assert(/Tạm khóa tài khoản/.test(h.modal()));
  h.act('acc-menu-toggle', { id: TARGET });
  assert(/^\d{6}$/.test(code()));
  const acc = A.ACCOUNTS.get(TARGET);
  assert(h.modal().includes(acc.fullName) && h.modal().includes(acc.code) && /Đang hoạt động/.test(h.modal()));
  assert(/Tài khoản sẽ không thể tiếp tục sử dụng hệ thống sau khi bị tạm khóa/.test(h.modal()));
  assert(/Mã có hiệu lực trong <b>00:30<\/b>/.test(h.modal()));
  assert(/id="acc-lock-submit"[^>]*disabled/.test(h.modal()), 'submit disabled while empty');
  assert.strictEqual(status(TARGET), 'ACTIVE');
});
ok('B. close then reopen → new code; no code in storage', () => {
  const c1 = code();
  h.act('acc-lock-cancel');
  assert.strictEqual(h.modal(), '');
  const seen = new Set([c1]);
  for (let i = 0; i < 5; i++) { h.act('acc-toggle', { id: TARGET }); seen.add(code()); h.act('acc-lock-cancel'); }
  assert(seen.size > 1, 'codes change between openings');
  for (const [, v] of h.localStorage._m) seen.forEach(c => assert(!String(v).includes('"' + c + '"'), 'code persisted'));
});
ok('D. correct code without reason → not locked', () => {
  h.act('acc-toggle', { id: TARGET });
  setCode(code()); confirm();
  assert.strictEqual(status(TARGET), 'ACTIVE');
  assert(/lý do/.test(err()));
  setReason('   '); confirm();
  assert.strictEqual(status(TARGET), 'ACTIVE');
});
ok('input accepts digits only, max 6', () => {
  assert.strictEqual(setCode('12a3-45678'), '123456');
});
ok('K. expired code (30 s) cannot be used, L. "Tạo mã mới" issues a fresh 30 s code', () => {
  const c = code();
  setReason('Nghỉ việc'); setCode(c);
  now += 31 * 1000;
  confirm();
  assert.strictEqual(status(TARGET), 'ACTIVE');
  assert(/hết hiệu lực/.test(err()));
  h.act('acc-lock-renew');
  const c2 = code();
  assert(c2 && /Mã có hiệu lực trong <b>00:30<\/b>/.test(h.modal()) && /value=""/.test(h.modal().match(/id="acc-lock-input"[^>]*/)[0]));
  if (c2 !== c) { setCode(c); confirm(); assert.strictEqual(status(TARGET), 'ACTIVE', 'old code rejected'); }
  h.act('acc-lock-cancel');
});
ok('C. reason + correct code within 30 s → locked via existing path; toast; audit without code; RBAC untouched (N)', () => {
  h.trace.toasts.length = 0;
  h.act('acc-toggle', { id: TARGET });
  const c = code();
  setReason('Nghỉ việc từ 01/10'); now += 10 * 1000; setCode(c); confirm();
  const acc = A.ACCOUNTS.get(TARGET);
  assert.strictEqual(status(TARGET), 'LOCKED');
  assert.strictEqual(h.modal(), '');
  assert(h.trace.toasts.includes('Đã tạm khóa tài khoản ' + acc.code + ' – ' + acc.fullName + '.'));
  const log = A.db.extraLog[0];
  assert.strictEqual(log.action, 'ACCOUNT_SUSPENDED'); assert.strictEqual(log.actorId, 'AC-QT01'); assert.strictEqual(log.targetId, TARGET); assert.strictEqual(log.reason, 'Nghỉ việc từ 01/10');
  assert(!JSON.stringify(log).includes(c), 'code not logged');
  assert.strictEqual(rbac(), rbacBefore);
  assert.strictEqual(status(OTHER), 'ACTIVE', 'O. other account untouched');
  h.act('acc-toggle', { id: TARGET }); // unlock: unchanged, no confirmation
  assert.strictEqual(status(TARGET), 'ACTIVE');
});
ok('E/F/G/M. wrong code: 2 left, 1 left, then cooldown; account never locked', () => {
  h.act('acc-toggle', { id: TARGET });
  setReason('Thử'); setCode(wrong(code())); confirm();
  assert.strictEqual(err(), 'Mã xác nhận không chính xác. Bạn còn 2 lần thử.');
  assert.strictEqual(status(TARGET), 'ACTIVE');
  setCode(wrong(code())); confirm();
  assert.strictEqual(err(), 'Mã xác nhận không chính xác. Bạn còn 1 lần thử.');
  assert.strictEqual(status(TARGET), 'ACTIVE');
  setCode(wrong(code())); confirm();
  assert.strictEqual(status(TARGET), 'ACTIVE');
  assert(/Bạn đã nhập sai mã xác nhận 3 lần\. Chức năng tạm khóa tài khoản tạm thời bị vô hiệu hóa trong 30 phút\./.test(h.modal()));
  const stored = JSON.parse(h.localStorage.getItem(COOLDOWN_KEY));
  assert.deepStrictEqual(Object.keys(stored), ['AC-QT01'], 'cooldown bound to the admin, not the target');
  assert.strictEqual(stored['AC-QT01']['tai-khoan.tam-khoa'], now + 30 * 60 * 1000);
  assert.strictEqual(status('AC-QT01'), 'ACTIVE', 'admin not locked');
  assert.strictEqual(A.current, 'tai-khoan', 'admin still in the app');
  assert.strictEqual(rbac(), rbacBefore);
  A.closeModal();
});
ok('H. during cooldown the menu item is disabled and the action cannot run', () => {
  now += 60 * 1000;
  h.act('acc-more', { id: OTHER });
  assert(/is-disabled" role="menuitem" data-act="acc-menu-toggle"[^>]*aria-disabled="true" title="Tạm thời không khả dụng\. Thử lại sau 29:00\."/.test(h.modal()));
  h.trace.toasts.length = 0;
  h.act('acc-menu-toggle', { id: OTHER });
  assert.strictEqual(h.modal(), '');
  assert.deepStrictEqual(h.trace.toasts, ['Tạm thời không khả dụng. Thử lại sau 29:00.']);
  assert.strictEqual(status(OTHER), 'ACTIVE');
  // Other actions still work: edit menu item and unlock of a locked account.
  h.act('acc-edit', { id: OTHER }); assert(/Sửa tài khoản/.test(h.modal())); A.closeModal();
});
ok('I. reload during cooldown keeps the remaining time from lockUntil', () => {
  now += 5 * 60 * 1000; // 6 minutes after the 3rd wrong attempt
  h = boot(Object.fromEntries(h.localStorage._m)); A = h.A;
  login('AC-QT01'); h.go('tai-khoan');
  h.act('acc-more', { id: OTHER });
  assert(/Thử lại sau 24:00\./.test(h.modal()), 'not reset to 30:00');
  A.closeModal();
  // Another admin is not affected by AC-QT01's cooldown (cooldown is per admin).
});
ok('J. after cooldown the action works again', () => {
  now += 24 * 60 * 1000 + 1;
  h.act('acc-more', { id: OTHER });
  assert(!/is-disabled/.test(h.modal()));
  h.act('acc-menu-toggle', { id: OTHER });
  assert(/^\d{6}$/.test(code()));
  setReason('Hết hợp đồng'); setCode(code()); confirm();
  assert.strictEqual(status(OTHER), 'LOCKED');
  h.act('acc-toggle', { id: OTHER });
  assert.strictEqual(status(OTHER), 'ACTIVE');
});
ok('RBAC: a user without tai-khoan.khoa-mo-khoa cannot open or confirm', () => {
  login('AC-NV01');
  if (!A.canDo('tai-khoan.khoa-mo-khoa')) {
    h.act('acc-toggle', { id: OTHER });
    assert(!/acc-lock-code/.test(h.modal()));
    h.act('acc-lock-confirm');
    assert.strictEqual(status(OTHER), 'ACTIVE');
  }
});
console.log(`account lock confirmation regression PASS (${passed} checks)`);
