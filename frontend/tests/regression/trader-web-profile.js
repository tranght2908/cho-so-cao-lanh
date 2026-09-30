/* Focused regression: web Tiểu thương › "Thông tin cá nhân" hiển thị đúng activeTraderProfile của account đang đăng
 * nhập (Account.traderIds), đổi theo "Chợ đang xem", đọc thẳng A.db.traders (state dùng chung với web quản lý). */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
const TW_ROOT = path.join(ROOT, 'tieu-thuong');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const twHtml = h => h.el('#tw-root').innerHTML || '';
const PHONE = '0953100001', PHONE_ONE = '0953100002';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

// ---------- Web quản lý: dữ liệu thật trong state dùng chung ----------
const hb = createApp(ROOT), B = hb.A, TS = B.features.traders.service;
const mk = (id, market, phone, extra) => TS.create(Object.assign({ id, name: 'Tiểu thương ' + id, phone, idNo: '0870' + id.replace(/\D/g, '').padStart(8, '0'), idType: 'CCCD', market, stalls: [], source: 'STAFF', since: B.U.today(), app: false }, extra || {}));
const tA = mk('TT-PF1', 'CL', PHONE, { address: '12 Lý Thường Kiệt, P. Cao Lãnh', docFiles: { cccdFront: { name: 'cccd-truoc.png', type: 'image/png', dataUrl: PNG }, dkkd: { name: 'dkkd.pdf', type: 'application/pdf' } } });
const tB = mk('TT-PF2', 'TTD', PHONE, { address: 'Ấp 3, xã Tân Thuận Đông' });
const tC = mk('TT-PF3', 'HA', PHONE_ONE);
assert(tA && tB && tC, 'fixtures created');
const neighbour = B.db.traders.find(t => t.market === 'CL' && ![tA.id, tB.id, tC.id].includes(t.id));
B.ACCOUNTS.add({ id: 'AC-PF-MULTI', code: 'PF-MULTI', fullName: tA.name, phone: PHONE, roleIds: ['trader'], organization: '', marketScopes: [], status: 'ACTIVE', traderIds: [tA.id, tB.id], traderId: tA.id });
B.ACCOUNTS.add({ id: 'AC-PF-ONE', code: 'PF-ONE', fullName: tC.name, phone: PHONE_ONE, roleIds: ['trader'], organization: '', marketScopes: ['CL'], status: 'ACTIVE', traderIds: [tC.id], traderId: tC.id });
B.save();

// ---------- Web Tiểu thương (CÙNG localStorage với web quản lý) ----------
const ht = createApp(TW_ROOT, { localStorage: hb.localStorage }), T = ht.A;
const login = phone => { ht.act('tw-back'); T.IN['tw-phone']({ value: phone }); ht.act('tw-lookup'); T.IN['tw-otp']({ value: '123456' }); ht.act('tw-verify'); };
const openProfile = () => { ht.act('merchant-nav', { id: 'profile' }); return twHtml(ht); };
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

ok('root cause guard: the shared profile view is loaded by the Trader Web', () => {
  assert(ht.scripts.includes('../src/features/accounts/profile.js'));
  assert.strictEqual(typeof T.VIEWS['thong-tin-ca-nhan'], 'function');
  assert.strictEqual(typeof T.activeTraderProfile, 'function');
});

ok('CASE 1: account with exactly one profile → Thông tin cá nhân shows that profile', () => {
  login(PHONE_ONE);
  const html = openProfile(), t = text(html);
  assert(!t.includes('Không mở được thông tin cá nhân'));
  // Bố cục: breadcrumb của khung cổng (Tài khoản › Thông tin cá nhân) + thẻ tóm tắt; không có tiêu đề/mô tả thứ hai.
  assert(/<span>Tài khoản<\/span><span>›<\/span><b>Thông tin cá nhân<\/b>/.test(html), 'breadcrumb');
  assert(!t.includes('Thông tin hồ sơ của bạn tại') && !html.includes('<h2>Thông tin cá nhân</h2>'), 'no second page heading');
  const summary = html.slice(html.indexOf('profile-summary'), html.indexOf('profile-basic-card'));
  const statusLabel = { ACTIVE: 'Đang hoạt động', WAITING_ALLOCATION: 'Chờ bố trí', INACTIVE: 'Ngừng hoạt động' }[T.features.traders.service.deriveBusinessStatus(T.idx.trader.get(tC.id))];
  [tC.name, 'Tiểu thương', statusLabel, PHONE_ONE, T.U.market('HA').name, tC.id].forEach(x => assert(summary.includes(x), 'summary: ' + x));
  // Thông tin cơ bản = lưới trường chi tiết, full-width dưới thẻ tóm tắt; không lặp trường nhận diện của thẻ tóm tắt.
  const basic = html.slice(html.indexOf('profile-basic-card'), html.indexOf('profile-docs-card'));
  assert(basic.includes('profile-info-grid') && !html.includes('profile-grid'), 'grid layout, no 2-column card split');
  ['Ngày sinh', 'Giới tính', 'Loại giấy tờ', 'Số giấy tờ', 'Địa chỉ'].forEach(x => assert(basic.includes('<span>' + x + '</span>'), 'basic: ' + x));
  ['Mã tiểu thương', 'Họ và tên', 'Số điện thoại', 'Trạng thái hồ sơ', tC.id, PHONE_ONE].forEach(x => assert(!basic.includes(x), 'not duplicated: ' + x));
  assert(!html.includes('profile-field-label'), 'no one-column separated field list');
  assert.strictEqual((summary.match(/data-act="profile-edit-open"/g) || []).length, 1, 'one edit button, in the summary');
  assert(html.indexOf('Thông tin cơ bản') < html.indexOf('Hồ sơ đính kèm'), 'basic info above attachments');
  assert(html.includes('<p class="profile-empty-line">Chưa có hồ sơ đính kèm.</p>'), 'compact empty attachments');
  assert(t.includes('Thông tin cơ bản') && t.includes('Hồ sơ đính kèm'));
  assert(t.includes(tC.id) && t.includes(tC.name) && t.includes(PHONE_ONE));
  assert(t.includes('Chưa cập nhật'), 'missing data shown as Chưa cập nhật');
  assert(t.includes('Chưa có hồ sơ đính kèm'));
  assert(!t.includes(tA.id) && !t.includes(tB.id));
  // "Chỉnh sửa thông tin" vẫn hoạt động như trước (ghi vào hồ sơ đang xem).
  ht.act('profile-edit-open');
  assert(ht.modal().includes('profile-edit-save'));
  ht.el('#profile-edit-name').value = tC.name; ht.el('#profile-edit-birth').value = ''; ht.el('#profile-edit-gender').value = 'Nữ'; ht.el('#profile-edit-address').value = 'Khóm 2, P. Hòa An';
  ht.act('profile-edit-save');
  assert.strictEqual(T.idx.trader.get(tC.id).address, 'Khóm 2, P. Hòa An');
  assert(text(twHtml(ht)).includes('Khóm 2, P. Hòa An'));
  ht.act('merchant-nav', { id: 'logout' });
});

ok('CASE 2: two profiles CL + TTD → profile follows the active profile when switching market', () => {
  login(PHONE);
  let t = text(openProfile());
  assert(t.includes(tA.id) && t.includes(T.U.market('CL').name) && t.includes('12 Lý Thường Kiệt'), 'active = CL (default)');
  assert(!t.includes(tB.id) && !t.includes('Ấp 3'), 'no data of the other profile');
  assert(t.includes('Loại giấy tờ') && t.includes('CCCD') && !t.includes('Trạng thái hồ sơ'));
  // Hồ sơ đính kèm: chỉ tệp thật, nhãn theo danh mục dùng chung; ảnh xem được, PDF chỉ metadata.
  assert(t.includes('CCCD - Mặt trước') && t.includes('cccd-truoc.png') && t.includes('Giấy chứng nhận đăng ký kinh doanh') && t.includes('dkkd.pdf'));
  assert(!t.includes('CCCD - Mặt sau') && !t.includes('Ảnh chân dung'), 'no fake documents');
  assert.strictEqual((twHtml(ht).match(/data-act="profile-doc-view"/g) || []).length, 1);
  ht.act('profile-doc-view', { key: 'cccdFront' });
  assert(ht.modal().includes(PNG));
  T.closeModal();
  T.CH['mini-profile']({ value: tB.id });
  t = text(twHtml(ht));
  assert(t.includes(tB.id) && t.includes(T.U.market('TTD').name) && t.includes('Ấp 3'), 'active = TTD after switch');
  assert(!t.includes(tA.id) && !t.includes('12 Lý Thường Kiệt') && !t.includes('cccd-truoc.png'));
  T.CH['mini-profile']({ value: tA.id });
  assert(text(twHtml(ht)).includes(tA.id));
});

ok('CASE 3: never shows a profile that does not belong to the account', () => {
  T.CH['mini-profile']({ value: neighbour.id });
  let t = text(openProfile());
  assert(t.includes(tA.id) && !t.includes(neighbour.id) && !t.includes(neighbour.name));
  // Phiên bị sửa tay trỏ tới hồ sơ người khác → quay về hồ sơ mặc định của account.
  const tampered = createApp(TW_ROOT, { localStorage: hb.localStorage, sessionStorage: { [T.ACCOUNTS.TRADER_WEB_SESSION_KEY]: JSON.stringify({ accountId: 'AC-PF-MULTI', traderId: neighbour.id }) } });
  tampered.act('merchant-nav', { id: 'profile' });
  t = text(twHtml(tampered));
  assert(t.includes(tA.id) && !t.includes(neighbour.id));
});

ok('CASE 4: Management edits the trader → Trader Web shared-state refresh shows new data', () => {
  const rec = B.db.traders.find(x => x.id === tA.id);
  rec.address = '99 Nguyễn Huệ (đã cập nhật)';
  B.save();
  T.refreshSharedState();
  const t = text(openProfile());
  assert(t.includes('99 Nguyễn Huệ (đã cập nhật)') && !t.includes('12 Lý Thường Kiệt'));
  assert.strictEqual(T.db.traders.find(x => x.id === tA.id), T.idx.trader.get(tA.id), 'single shared trader record');
});

ok('CASE 5: no sample/random fallback for an account without linked profiles', () => {
  ht.act('merchant-nav', { id: 'logout' });
  const hoa = T.ACCOUNTS.get('AC-TT01');
  if (hoa && !T.ACCOUNTS.traderIdsOf(hoa).length) {
    login(hoa.phone);
    const html = twHtml(ht);
    assert(!html.includes('class="merchant-sidebar"'), 'unlinked account does not get a portal');
    assert(!html.includes('TT0001'), 'no auto-link to the same-phone profile');
    assert.strictEqual(T.ACCOUNTS.traderIdsOf(T.ACCOUNTS.get('AC-TT01')).length, 0);
  }
  T.ui.currentDemoAccountId = 'AC-TT01'; T.ui.sessionAccountId = 'AC-TT01';
  assert.strictEqual(T.activeTraderProfile(), null);
});

ok('CASE 6: other portal screens still work', () => {
  login(PHONE);
  [['home', 'Tổng quan'], ['contracts', 'Hợp đồng'], ['finance', 'Thanh toán'], ['complaints', 'Phản ánh'], ['notice', 'Thông báo']].forEach(([id, label]) => {
    ht.act('merchant-nav', { id });
    const html = twHtml(ht);
    assert(html.includes('class="merchant-sidebar"') && html.includes(label) && !html.includes('Không mở được'), id);
  });
  const t = text(openProfile());
  assert(!/Phương tiện|Biển số|Loại xe/.test(t), 'no vehicles on the profile');
});

console.log(`trader-web-profile regression PASS (${passed} checks)`);
