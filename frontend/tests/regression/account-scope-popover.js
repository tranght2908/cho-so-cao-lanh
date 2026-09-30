/* Focused regression: read-only market-scope quick inspector in the Accounts table. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');
const h = createApp(root), A = h.A;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const render = query => { A.ui.sessionAccountId = 'AC-QT01'; A.ui.currentDemoAccountId = 'AC-QT01'; A.syncAccountContext(); A.ui.acc = { search: query || '', type: 'all', role: '', market: '', status: '', viewMode: 'ACCOUNTS' }; return A.VIEWS['tai-khoan'](); };
const account = (id, roleIds, marketScopes, extra) => Object.assign({ id, code: id.slice(3), fullName: id, phone: '', accountType: 'Cán bộ', title: 'Cán bộ', roleIds, organization: '', marketScopes, status: 'PENDING_ACTIVATION' }, extra || {});

ok('A03 empty scope is muted and has no popover trigger', () => {
  A.ACCOUNTS.add(account('AC-POP-EMPTY', ['collector'], []));
  const html = render('AC-POP-EMPTY');
  assert(html.includes('Chưa được phân công'));
  assert(!new RegExp(`acc-scope-popover" data-id="AC-POP-EMPTY`).test(html));
});
ok('A03 one Market stays plain text', () => {
  A.ACCOUNTS.add(account('AC-POP-ONE', ['collector'], ['CL']));
  const html = render('AC-POP-ONE');
  assert(/Chợ Cao Lãnh/.test(html));
  assert(!new RegExp(`acc-scope-popover" data-id="AC-POP-ONE`).test(html));
});
ok('A03 multi-Market shows compact +N and a read-only assigned-markets popover', () => {
  A.ACCOUNTS.add(account('AC-POP-MULTI', ['collector'], ['TTT', 'CL', 'TVH', 'HA']));
  const html = render('AC-POP-MULTI');
  assert(new RegExp(`data-id="AC-POP-MULTI"[^>]*>[^<]*<span>Chợ Cao Lãnh</span><span class="acc-scope-more">\\+3`).test(html));
  h.act('acc-scope-popover', { id: 'AC-POP-MULTI' });
  const popover = h.modal();
  assert(popover.includes('Phạm vi được phân công') && popover.includes('4 chợ'));
  ['Chợ Cao Lãnh', 'Chợ Hòa An', 'Chợ Tân Việt Hòa', 'Chợ Tân Thuận Tây'].forEach(name => assert(popover.includes(name), name));
  assert(!/checkbox|Chỉnh sửa|Lưu/.test(popover));
  h.act('acc-scope-popover', { id: 'AC-POP-MULTI' }); assert.strictEqual(h.modal(), '');
});
ok('global roles keep the ALL label and list the full catalog', () => {
  const html = render();
  ['AC-NV01', 'AC-KTTT01', 'AC-LD01'].forEach(id => assert(new RegExp(`data-id="${id}"`).test(html), id));
  h.act('acc-scope-popover', { id: 'AC-NV01' });
  assert(h.modal().includes('Phạm vi truy cập'));
  assert((h.modal().match(/<span aria-hidden="true">✓<\/span>/g) || []).length === A.allowedMarkets({ marketScopes: ['ALL'] }).length);
  h.act('acc-scope-popover-close');
});
ok('A04 is incident-scoped text, never a Market popover', () => {
  const tech = A.ACCOUNTS.currentList().find(a => A.ACCOUNTS.primaryRole(a) === 'technician');
  const html = render(tech.code);
  assert(html.includes('Theo sự cố được giao'));
  assert(!new RegExp(`acc-scope-popover" data-id="${tech.id}`).test(html));
});
ok('A07 derives unique Markets from traderIds, never marketScopes', () => {
  A.db.traders.push(
    { id: 'TT-POP-CL', name: 'Hồ sơ CL', phone: '0999000011', market: 'CL' },
    { id: 'TT-POP-TTD', name: 'Hồ sơ TTD', phone: '0999000011', market: 'TTD' },
    { id: 'TT-POP-HA', name: 'Hồ sơ HA', phone: '0999000011', market: 'HA' },
    { id: 'TT-POP-CL-2', name: 'Hồ sơ CL 2', phone: '0999000011', market: 'CL' }
  ); A.reindex();
  A.ACCOUNTS.add(account('AC-POP-TRADER', ['trader'], ['SQ'], { accountType: 'Tiểu thương', traderIds: ['TT-POP-CL', 'TT-POP-TTD', 'TT-POP-HA', 'TT-POP-CL-2'], traderId: 'TT-POP-CL' }));
  const html = render('AC-POP-TRADER');
  assert(new RegExp(`data-id="AC-POP-TRADER"[^>]*>[^<]*<span>Chợ Cao Lãnh</span><span class="acc-scope-more">\\+2`).test(html));
  h.act('acc-scope-popover', { id: 'AC-POP-TRADER' });
  const popover = h.modal();
  assert(popover.includes('Chợ có hồ sơ tiểu thương') && popover.includes('3 chợ có hồ sơ được liên kết'));
  assert(!popover.includes('Chợ Sáu Quốc'), 'marketScopes is ignored for A07 presentation');
});
console.log(`account scope popover regression PASS (${passed} checks)`);
