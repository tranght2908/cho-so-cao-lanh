const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const { A } = createApp(path.resolve(__dirname, '../..'));

A.VIEWS['thong-bao']();
const rules = A.db.notificationEventConfigs.filter(x => x && !x.retired);
const expected = ['PERIOD_PREPARATION', 'PERIOD_METER_READ', 'PERIOD_COLLECTION_START', 'PERIOD_REMINDER_1', 'PERIOD_REMINDER_2', 'PERIOD_DUE_DATE', 'RECEIVABLE_ISSUED', 'PAYMENT_SUCCESS', 'MARKET_COLLECTION_COMPLETED', 'MARKET_RECONCILED', 'PERIOD_CLOSED'];
assert.deepEqual(rules.map(x => x.eventKey).sort(), expected.sort(), 'only 11 default workflow rules remain active');
assert.equal(A.NOTIFICATIONS.eventByKey('RECEIVABLE_ISSUED').label, 'Phát hành kỳ thu');
assert.equal(A.NOTIFICATIONS.eventByKey('RECEIVABLE_ISSUED').trigger, 'Phát hành kỳ thu thành công');
assert.deepEqual(A.NOTIFICATIONS.eventByKey('PERIOD_PREPARATION').recipients, [
  { actorGroup: 'MARKET_MANAGEMENT_LEADERS', condition: 'CURRENT_MARKET' },
  { actorGroup: 'FEE_COLLECTOR', condition: 'ASSIGNED_TO_EVENT_MARKET' }
]);
assert.deepEqual(A.NOTIFICATIONS.eventByKey('PERIOD_METER_READ').recipients, [
  { actorGroup: 'FEE_COLLECTOR', condition: 'ASSIGNED_TO_EVENT_MARKET' }
]);
const rule = A.NOTIFICATIONS.eventByKey('MARKET_RECONCILED');
rule.enabled = false; rule.status = 'DISABLED';
assert.equal(A.NOTIFICATIONS.dispatchEvent('MARKET_RECONCILED', { period: { id:'x', marketId:'CL', period:'2026-05', reconciliation:{ reconciliationStatus:'RECONCILED', result:'MATCHED' } } }), 0, 'disabled rule does not send');
console.log('notification-rules-workflow: OK');
