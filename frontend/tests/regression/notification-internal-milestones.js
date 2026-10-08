/* Focused regression: the day-28 milestones of a collection round are INTERNAL.
 * "Chuẩn bị kỳ" (PREPARATION) → Tổ trưởng + NV thu phí; "Ghi chỉ số" (METER_READ) → NV thu phí. Traders are never
 * notified at these milestones — even if a rule is configured with Tiểu thương — because before the receivable is
 * issued the amount is not yet a payment obligation. Traders are notified once receivables are issued. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..')), A = h.A;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const rules = A.db.notificationEventConfigs || [];
const rule = key => rules.find(r => r.eventKey === key);
const sentFor = milestone => (A.db.notifications || []).filter(n => String(n.notificationKey || '').includes('MILESTONE|' + milestone + '|'));

ok('default rules: PREPARATION → managers + collectors, METER_READ → collectors (no trader)', () => {
  assert(!JSON.stringify(rule('PERIOD_PREPARATION').recipients).includes('TRADER'));
  assert(!JSON.stringify(rule('PERIOD_METER_READ').recipients).includes('TRADER'));
});
ok('even when a rule is configured with Tiểu thương, the internal milestones never reach traders', () => {
  ['PERIOD_PREPARATION', 'PERIOD_METER_READ'].forEach(k => rule(k).recipients = rule(k).recipients.concat([{ actorGroup: 'TRADER', condition: 'HAS_CONTRACT' }]));
  A.db.notifications = (A.db.notifications || []).filter(n => !/MILESTONE\|(PREPARATION|METER_READ)\|/.test(String(n.notificationKey || '')));
  A.NOTIFICATIONS.dispatchDueMilestones();
  const prep = sentFor('PREPARATION'), meter = sentFor('METER_READ');
  assert(prep.length > 0, 'preparation notices still sent to staff');
  assert(prep.concat(meter).every(n => n.recipientType !== 'TRADER'), 'no trader recipient');
  assert(new Set(prep.map(n => n.recipientType)).size >= 1 && prep.every(n => ['MARKET_MANAGER', 'FEE_COLLECTOR'].includes(n.recipientType)));
});
console.log(`notification-internal-milestones regression PASS (${passed} checks)`);
