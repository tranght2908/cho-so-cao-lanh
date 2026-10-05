const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const { A } = createApp(path.resolve(__dirname, '../..'));

A.VIEWS['thong-bao']();
const rule = A.db.notificationEventConfigs.find(x => x.group === 'PERIOD' && x.triggerEvent === 'REMINDER_1');
assert(rule, 'period reminder rule is initialized');
assert.equal(rule.sendDate, undefined, 'rule does not store a calendar day');
const resolve = p => A.NOTIFICATIONS.resolvePeriodTrigger(rule, p);
assert.equal(resolve({ id:'CL_2026-10', marketId:'CL', period:'2026-10', reminder1Date:'2026-10-05' }).date, '2026-10-05');
assert.equal(resolve({ id:'TTD_2026-10', marketId:'TTD', period:'2026-10', reminder1Date:'2026-10-07' }).date, '2026-10-07');
assert.equal(resolve({ id:'CL_2026-11', marketId:'CL', period:'2026-11', source:'manual', reminder1Date:'2026-11-10' }).date, '2026-11-10');
const before = rule.eventKey;
rule.enabled = false;
assert.equal(A.db.notificationEventConfigs.find(x => x.eventKey === before).enabled, false, 'pausing preserves the rule');
console.log('notification-period-triggers: OK');
