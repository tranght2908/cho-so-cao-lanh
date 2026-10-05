const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const h = createApp(path.resolve(__dirname, '../..'));
const { A } = h;

assert.equal(A.SCREEN_MARKET['thong-bao'], 'CROSS', 'notifications are a shared cross-market screen');
const auto = A.VIEWS['thong-bao']();
assert(!/Lịch nghiệp vụ|Theo sự kiện nghiệp vụ/.test(auto), 'automatic setup has no intermediate business schedule UI');
assert(/Tên cấu hình/.test(auto) || /QUY TẮC THÔNG BÁO TỰ ĐỘNG/.test(auto), 'automatic rule workspace renders');

const meter = A.NOTIFICATIONS.eventByKey('PERIOD_METER_READ');
h.act('notification-rule-select', { id: meter.eventKey });
assert(!/Chợ áp dụng/.test(h.modal()), 'standard rule edit has no market selector');

A.ui.notificationTab = 'manual';
const manual = A.VIEWS['thong-bao']();
assert(/Phạm vi chợ/.test(manual), 'manual notifications retain their market scope selector');
console.log('notification-global-scope-ui: OK');
