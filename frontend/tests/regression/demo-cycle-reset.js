const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const ROOT = path.resolve(__dirname, '../..');
const TARGET = { marketId: 'CL', period: '2026-10' };

function setup(includeOtherMarket) {
  const h = createApp(ROOT), A = h.A, db = A.db;
  const cl = db.stalls.find(x => x.market === 'CL'), other = db.stalls.find(x => x.market === 'TTD');
  const p = db.billingPeriods.find(x => x.id === TARGET.period);
  db.meterPeriods.push({ id: TARGET.period, month: 10, year: 2026, status: 'CLOSED', completedBy: 'old' });
  db.readings.push({ stallId: cl.id, period: '2026-09', elecPrev: 10, elecCur: 20, waterPrev: 5, waterCur: 8, status: 'RECORDED' });
  db.readings.push({ stallId: cl.id, period: TARGET.period, elecPrev: 20, elecCur: 30, waterPrev: 8, waterCur: 12, status: 'RECORDED', reviewRequired: true });
  const inv = { id: 'PT-202610-CL-TEST', market: 'CL', period: TARGET.period, stallId: cl.id, traderId: cl.traderId, amount: 100, paid: 100, status: 'paid' };
  db.invoices.push(inv);
  const pay = { id: 'GD-CL-TEST', invoiceId: inv.id, market: 'CL', amount: 100, receipt: 'BL-CL-TEST', paymentStatus: 'SUCCESS' };
  db.payments.push(pay);
  db.bank.push({ id: 'SK-CL-TEST', paymentId: pay.id, receivableId: inv.id, market: 'CL' });
  db.cashHandovers = [{ id: 'PN-CL-TEST', market: 'CL', periodId: TARGET.period, paymentIds: [pay.id] }];
  db.billingDrafts = [{ id: 'D-CL-TEST', market: 'CL', period: TARGET.period }];
  db.billingWarnings = [{ id: 'W-CL-TEST', market: 'CL', period: TARGET.period }];
  db.notifications.push({ id: 'TB-CL-TEST', market: 'CL', period: TARGET.period, kind: 'PAYMENT_RECEIPT', referenceId: pay.id });
  db.issuedPeriods.push(TARGET.period);
  p.status = 'CLOSED'; p.collectionHandoffByMarket = { CL: { reconciliationStatus: 'RECONCILED' } };
  if (includeOtherMarket) {
    db.readings.push({ stallId: other.id, period: TARGET.period, elecPrev: 1, elecCur: 2, waterPrev: 1, waterCur: 2, status: 'RECORDED' });
    db.invoices.push({ id: 'PT-202610-TTD-TEST', market: 'TTD', period: TARGET.period, stallId: other.id, traderId: other.traderId, amount: 100, paid: 0, status: 'unpaid' });
  }
  A.reindex();
  return { A, db, cl, other, p };
}

{
  const { A, db, cl, p } = setup(false);
  const previousCount = db.readings.filter(x => x.stallId === cl.id && x.period === '2026-09').length;
  const config = JSON.stringify(db.notificationEventConfigs || []);
  const result = A.DEV.resetDemoCycle(TARGET);
  assert.equal(result.ok, true); assert.equal(result.globalPeriodReset, true);
  assert.equal(db.readings.filter(x => x.stallId === cl.id && x.period === TARGET.period).length, 0);
  assert.equal(db.readings.filter(x => x.stallId === cl.id && x.period === '2026-09').length, previousCount);
  assert.equal(db.invoices.filter(x => x.market === 'CL' && x.period === TARGET.period).length, 0);
  assert.equal(db.payments.some(x => x.id === 'GD-CL-TEST'), false);
  assert.equal(db.bank.some(x => x.id === 'SK-CL-TEST'), false);
  assert.equal(db.cashHandovers.length, 0); assert.equal((p.collectionHandoffByMarket || {}).CL, undefined);
  assert.equal(p.status, 'PREPARING'); assert.equal(db.meterPeriods.find(x => x.id === TARGET.period).status, 'PENDING');
  assert.equal(db.issuedPeriods.includes(TARGET.period), false); assert.equal(JSON.stringify(db.notificationEventConfigs || []), config);
  assert.equal(A.DEV.resetDemoCycle(TARGET).ok, true, 'second reset is safe');
  assert.equal(A.DEV.resetDemoCycle({ marketId: 'CL' }).code, 'EXPLICIT_TARGET_REQUIRED');
  assert.equal(A.DEV.resetDemoCycle({}).code, 'EXPLICIT_TARGET_REQUIRED');
  A.VIEWS['thong-bao']();
  assert.equal(db.notifications.some(x => /^DEMO_PERIOD_PREPARATION_/.test(x.eventKey || '')), false, 'opening notification screen must not seed history');
}
{
  const { A, db, other, p } = setup(true);
  const result = A.DEV.resetDemoCycle(TARGET);
  assert.equal(result.ok, true); assert.equal(result.globalPeriodReset, false);
  assert.equal(db.readings.some(x => x.stallId === other.id && x.period === TARGET.period), true);
  assert.equal(db.invoices.some(x => x.market === 'TTD' && x.period === TARGET.period), true);
  assert.equal(db.issuedPeriods.includes(TARGET.period), true);
  assert.equal(p.status, 'CLOSED');
}
console.log('demo-cycle-reset: OK');
