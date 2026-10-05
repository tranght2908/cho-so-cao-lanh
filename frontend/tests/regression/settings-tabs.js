const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A;
const rulesBefore = JSON.stringify(A.SERVICE_CFG.rules());
const cycleBefore = JSON.stringify(A.SERVICE_CFG.cycle ? A.SERVICE_CFG.cycle() : null);
const login = id => { A.ui.currentDemoAccountId = id; A.ui.sessionAccountId = id; A.ui.market = 'CL'; A.syncAccountContext(); };
const CURRENT_TABS = [['vaitro', 'Vai trò & phân quyền'], ['tichhop', 'Tích hợp'], ['nhatky', 'Nhật ký kiểm toán']];
const tabIds = html => Array.from(html.matchAll(/data-act="settings-tab" data-id="([a-z]+)"/g)).map(m => m[1]);

// Kiến trúc hiện hành: Lịch kỳ thu đã chuyển sang Thông báo đa kênh → Thiết lập tự động → Lịch nghiệp vụ.
// Cài đặt & phân quyền chỉ còn Vai trò & phân quyền / Tích hợp / Nhật ký kiểm toán.
login('AC-QT01');
h.go('cai-dat');
assert.strictEqual(A.current, 'cai-dat');

// State UI cũ còn lưu tab đã bỏ (quytac — Quy tắc thu phí; kythu — Lịch & kỳ thu) → về tab đầu, không render tab cũ.
['quytac', 'kythu'].forEach(legacy => {
  A.ui.settingsTab = legacy;
  const html = A.VIEWS['cai-dat']();
  assert.equal(A.ui.settingsTab, 'vaitro', 'legacy ' + legacy + ' state falls back to Vai trò & phân quyền');
  assert.deepStrictEqual(tabIds(html), CURRENT_TABS.map(t => t[0]), 'only current tabs render');
  CURRENT_TABS.forEach(t => assert(html.includes(t[1]), 'tab label ' + t[1]));
  assert(!html.includes('Lịch &amp; kỳ thu') && !html.includes('Lịch & kỳ thu'), 'Lịch & kỳ thu tab is absent');
  assert(!html.includes('Cấu hình lịch thu'), 'billing-cycle config is absent');
  assert(!html.includes('data-id="kythu"') && !html.includes('data-id="quytac"'), 'no retired tab ids');
  assert(!html.includes('Quy tắc thu phí') && !html.includes('Cho phép điều chỉnh khoản phải thu'), 'retired fee-rule panel is absent');
});

CURRENT_TABS.forEach(([tab]) => {
  h.act('settings-tab', { id: tab });
  assert.equal(A.ui.settingsTab, tab, 'active tab switches to ' + tab);
  const html = A.VIEWS['cai-dat']();
  assert(!html.includes('Lịch &amp; kỳ thu') && !html.includes('Quy tắc thu phí'), 'retired tabs stay absent on ' + tab);
});

// Action delegated với id tab cũ (link/HTML cũ) → về tab hợp lệ, không mở lại tab đã bỏ.
['quytac', 'kythu'].forEach(legacy => {
  h.act('settings-tab', { id: legacy });
  assert.equal(A.ui.settingsTab, 'vaitro', 'delegated legacy ' + legacy + ' action safely falls back');
});

// Dữ liệu cấu hình cũ không bị đụng khi bỏ tab.
assert.equal(JSON.stringify(A.SERVICE_CFG.rules()), rulesBefore, 'legacy fee-rule data is not changed');
assert.equal(JSON.stringify(A.SERVICE_CFG.cycle ? A.SERVICE_CFG.cycle() : null), cycleBefore, 'billing-cycle data is not changed');

// Lịch nghiệp vụ nay nằm ở Thông báo đa kênh → Thiết lập tự động.
A.ui.notificationTab = 'auto';
h.go('thong-bao');
assert.strictEqual(A.current, 'thong-bao');
const notif = h.view();
assert(notif.includes('Thiết lập tự động'), 'Thiết lập tự động tab');
assert(notif.includes('LỊCH NGHIỆP VỤ'), 'Lịch nghiệp vụ section');
assert(notif.includes('Lịch kỳ thu hàng tháng'), 'Lịch kỳ thu hàng tháng schedule');

console.log('settings-tabs: OK');
