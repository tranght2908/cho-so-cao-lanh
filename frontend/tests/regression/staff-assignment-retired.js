/* Focused regression: màn "Nhân sự & phân công" (route nhan-su-phan-cong) đã retire.
 * Chỉ bỏ UI/menu/screen permission; service phân công chợ (features/staffAssignment.service), dữ liệu
 * Account.marketScopes và nhật ký phân công vẫn giữ — Theo dõi kỳ thu dùng lại để phân công nhanh. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
const OLD = 'nhan-su-phan-cong';
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };

const h = createApp(ROOT);
const A = h.A, S = A.features.staffAssignment.service;
const login = (id, market) => { A.ui.currentDemoAccountId = id; A.ui.sessionAccountId = id; if (market) A.ui.market = market; A.syncAccountContext(); };
const scopesBefore = JSON.stringify(A.ACCOUNTS.list().map(a => [a.id, a.marketScopes]));

ok('1: sidebar/menu config has no Nhân sự & phân công for any internal actor', () => {
  assert(!A.MENU.some(g => g.items.some(it => it.id === OLD)), 'menu config');
  ['AC-QT01', 'AC-NV01', 'AC-NV02', 'AC-NV05', 'AC-KTTT01', 'AC-LD01'].forEach(id => {
    login(id, 'CL'); h.go('bao-cao');
    const nav = h.el('#nav').innerHTML;
    assert(!nav.includes('#/' + OLD) && !nav.includes('Nhân sự & phân công'), id);
  });
});

ok('2: old route redirects to Tài khoản người dùng (allowed) or a valid screen (denied), never the old view', () => {
  assert(!A.VIEWS[OLD], 'old view is not registered');
  login('AC-QT01', 'CL'); h.go(OLD); assert.strictEqual(A.current, 'tai-khoan');
  ['AC-NV01', 'AC-NV02'].forEach(id => {
    login(id, 'CL'); h.go(OLD);
    assert(A.current !== OLD && A.current !== 'tai-khoan', id + ' ' + A.current);
    assert(A.U.can(A.current), id + ' lands on a granted screen');
  });
});

ok('3: account data/scopes untouched by the retirement', () => {
  assert.strictEqual(JSON.stringify(A.ACCOUNTS.list().map(a => [a.id, a.marketScopes])), scopesBefore);
  ['AC-NV02', 'AC-NV03', 'AC-NV07'].forEach(id => assert(A.ACCOUNTS.get(id), id));
});

ok('10: permission catalog/UI has no retired screen; replacement actions exist for Tổ trưởng only', () => {
  const keys = A.PERM.CATALOG.map(p => p.key);
  assert(!keys.some(k => k.indexOf(OLD) !== -1), 'no nhan-su-phan-cong key in catalog');
  ['action:theo-doi-ky-thu.phan-cong-cho', 'action:theo-doi-ky-thu.doi-nv-phu-trach'].forEach(k => {
    assert(keys.includes(k), k);
    assert(A.PERM.hasPerm('market_manager', k), 'market_manager ' + k);
    assert(!A.PERM.hasPerm('collector', k) && !A.PERM.hasPerm('ward_leader', k), 'not granted wider ' + k);
  });
  // Tổ trưởng phân công ngay tại Theo dõi kỳ thu: không cần (và không có) màn/action Tài khoản người dùng.
  assert(!A.PERM.hasPerm('market_manager', 'screen:tai-khoan'), 'manager has no account screen');
  ['tai-khoan.tao-moi', 'tai-khoan.sua', 'tai-khoan.khoa-mo-khoa', 'tai-khoan.gan-quyen'].forEach(k => {
    assert(!A.PERM.hasPerm('market_manager', 'action:' + k), 'manager ' + k);
    assert(A.PERM.hasPerm('system_admin', 'action:' + k), 'admin keeps ' + k);
  });
  login('AC-QT01', 'CL'); A.ui.settingsTab = 'vaitro'; h.go('cai-dat');
  assert(!h.view().includes('Nhân sự & phân công'), 'role/permission UI');
});

// Chợ chưa có NV thu phí: gỡ phạm vi một chợ khỏi NV đang giữ (qua service hiện có) để dựng tình huống.
login('AC-NV01', 'CL');
const market = S.markets().find(id => S.marketState(id).status === 'ASSIGNED');
const holder = S.marketState(market).collector;
const removed = S.saveCollectorMarkets(holder.id, S.collectorMarkets(holder).filter(id => id !== market));
assert(removed.ok, 'setup: unassign ' + market + ' ' + (removed.reason || ''));

const rowHtml = id => { const v = h.view(), i = v.indexOf('data-act="period-monitor-open" data-market="' + id + '"'); return v.slice(v.lastIndexOf('<tr>', i), v.indexOf('</tr>', i)); };

ok('table: no Thao tác column, no Xem/Xem lỗi buttons; market name keeps the old navigation', () => {
  h.go('theo-doi-ky-thu');
  const v = h.view(), thead = v.slice(v.indexOf('<thead'), v.indexOf('</thead>'));
  assert(thead.includes('Trạng thái') && !thead.includes('Thao tác'), 'header');
  assert(!/>Xem( lỗi)?<\/button>/.test(v), 'no Xem buttons');
  assert(!v.includes('period-monitor-collector'), 'no navigation from collector name');
  assert.strictEqual((rowHtml(market).match(/<td/g) || []).length, 8, '8 cells per row');
});

ok('4 + 5 + 6 + 8: Theo dõi kỳ thu shows Chưa phân công, quick-assign saves via assignMarket, audit kept', () => {
  h.go('theo-doi-ky-thu');
  assert.strictEqual(A.current, 'theo-doi-ky-thu');
  assert.strictEqual(S.marketState(market).status, 'UNASSIGNED');
  assert(rowHtml(market).includes('Chưa phân công') && rowHtml(market).includes('Chưa có NV phụ trách'), 'unassigned row');
  assert(rowHtml(market).includes('data-act="period-monitor-assign" data-market="' + market + '"'), 'Phân công link');
  const logBefore = A.db.extraLog.length;
  h.act('period-monitor-assign', { market });
  assert(A.ui.periodMonitorAssign && A.ui.periodMonitorAssign.market === market, 'modal state');
  A.CH['period-monitor-assign-collector']({ value: holder.id, dataset: {} }); h.flush();
  h.act('period-monitor-assign-save', {});
  const st = S.marketState(market);
  assert.strictEqual(st.status, 'ASSIGNED'); assert.strictEqual(st.collector.id, holder.id);
  assert(A.allowedMarkets(A.ACCOUNTS.get(holder.id)).includes(market), 'account scope reflects assignment');
  assert(A.db.extraLog.length > logBefore && /Phân công .* cho NV thu phí/.test(A.db.extraLog[0].what), 'audit log written');
  assert(rowHtml(market).includes(holder.fullName) && !rowHtml(market).includes('Chưa phân công') && !rowHtml(market).includes('Chưa có NV phụ trách'), 'row updated');
});

ok('7: clicking an assigned collector opens the popup (preselected) and reassigns via the service, no duplicate', () => {
  const other = S.eligibleCollectors().find(a => a.id !== holder.id);
  assert(other, 'another active collector exists');
  assert(rowHtml(market).includes('data-act="period-monitor-assign"'), 'collector name is the assignment trigger');
  h.act('period-monitor-assign', { market });
  assert.strictEqual(A.current, 'theo-doi-ky-thu', 'no navigation');
  assert.strictEqual(A.ui.periodMonitorAssign.collectorId, holder.id, 'current collector preselected');
  const modal = h.modal();
  assert(modal.includes('Phân công nhân viên thu phí') && modal.includes('Nhân viên hiện tại') && modal.includes('Đang phụ trách'), 'popup content');
  assert(/data-act="period-monitor-assign-save"[^>]*disabled/.test(modal), 'save disabled while unchanged');
  const logBefore = A.db.extraLog.length;
  A.CH['period-monitor-assign-collector']({ value: other.id, dataset: {} }); h.flush();
  h.act('period-monitor-assign-save', {});
  const st = S.marketState(market);
  assert.strictEqual(st.status, 'ASSIGNED'); assert.strictEqual(st.collector.id, other.id);
  assert(!A.allowedMarkets(A.ACCOUNTS.get(holder.id)).includes(market), 'old collector no longer holds the market');
  const holders = A.ACCOUNTS.list().filter(a => S.canReceive(a) && A.allowedMarkets(a).includes(market));
  assert.strictEqual(holders.length, 1, 'exactly one active collector per market');
  assert(A.db.extraLog.length > logBefore && /Điều chuyển .*→/.test(A.db.extraLog[0].what), 'audit log: reassignment');
  assert(rowHtml(market).includes(other.fullName) && !rowHtml(market).includes(holder.fullName), 'row updated');
  assert(!A.ui.periodMonitorAssign, 'popup closed');
});

ok('9: collector still only sees assigned markets', () => {
  const now = S.marketState(market).collector;
  login(now.id, market);
  const own = A.allowedMarkets(A.ACCOUNTS.get(now.id));
  assert(own.includes(market) && own.length < 12, 'collector scope limited');
  assert(!A.U.can('theo-doi-ky-thu') && !A.U.can('tai-khoan'), 'collector has no admin screens');
});

ok('admin: Tài khoản người dùng still works as before', () => {
  login('AC-QT01', 'CL'); h.go('tai-khoan');
  assert.strictEqual(A.current, 'tai-khoan');
  const v = h.view();
  ['AC-NV02', 'AC-NV03', 'AC-NV07'].forEach(id => assert(v.includes(A.ACCOUNTS.get(id).code), id));
});

console.log('staff-assignment-retired regression PASS (' + passed + ' checks)');
