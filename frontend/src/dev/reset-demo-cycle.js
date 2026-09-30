/* Scoped DEV-only reset for the confirmed CL / 2026-10 prototype demo. No UI entry point. */
(function (A) {
  'use strict';
  const TARGET = Object.freeze({ marketId: 'CL', period: '2026-10' });
  const list = x => Array.isArray(x) ? x : [];
  const count = x => list(x).length;
  const exactTarget = x => !!x && x.marketId === TARGET.marketId && x.period === TARGET.period;
  // Some legacy readings have no stable id. Remove only the exact object references
  // selected in this in-memory preflight; never infer removal from a missing id.
  const removeSelected = (source, selected) => {
    const chosen = new Set(list(selected));
    return list(source).filter(x => !chosen.has(x));
  };
  const invoiceMarket = invoice => (A.receivableMarket && A.receivableMarket(invoice)) || (invoice && invoice.market) || null;

  function inspect(input) {
    const db = A.db, stalls = new Map(list(db.stalls).map(x => [x.id, x]));
    const readingMarket = r => ((stalls.get(r.stallId) || {}).market) || null;
    const readings = list(db.readings).filter(x => x.period === input.period);
    const invoices = list(db.invoices).filter(x => x.period === input.period);
    const targetInvoices = invoices.filter(x => invoiceMarket(x) === input.marketId);
    const invoiceIds = new Set(targetInvoices.map(x => x.id));
    const targetPayments = list(db.payments).filter(x => invoiceIds.has(x.invoiceId));
    const paymentIds = new Set(targetPayments.map(x => x.id));
    const workflowKinds = new Set(['PERIOD_PREPARATION_STARTED', 'RECEIVABLE_ISSUED', 'PAYMENT_SUCCESS', 'PAYMENT_RECEIPT']);
    const billingPeriod = list(db.billingPeriods).find(x => x.id === input.period) || null;
    const targetNotifications = list(db.notifications).filter(n => {
      const sameMarket = n.market === input.marketId || n.marketId === input.marketId;
      const linked = invoiceIds.has(n.invoiceId) || invoiceIds.has(n.receivableId) || paymentIds.has(n.referenceId) || paymentIds.has(n.paymentId);
      return sameMarket && (linked || (n.period === input.period && workflowKinds.has(n.kind || n.eventConfigKey)) || (n.period === input.period && /^DEMO_PERIOD_PREPARATION_/.test(n.eventKey || '')));
    });
    const otherReadings = readings.filter(x => readingMarket(x) !== input.marketId);
    const otherInvoices = invoices.filter(x => invoiceMarket(x) !== input.marketId);
    const globalSafe = !!billingPeriod && billingPeriod.marketId === input.marketId && !otherReadings.length && !otherInvoices.length;
    return {
      billingPeriod, meterPeriod: list(db.meterPeriods).find(x => x.id === input.period) || null, globalSafe,
      targetReadings: readings.filter(x => readingMarket(x) === input.marketId), otherReadings,
      targetInvoices, otherInvoices, targetPayments,
      targetReceipts: list(db.receipts).filter(x => invoiceIds.has(x.invoiceId) || paymentIds.has(x.paymentId)),
      targetBank: list(db.bank).filter(x => invoiceIds.has(x.receivableId) || invoiceIds.has(x.invoiceId) || paymentIds.has(x.paymentId)),
      targetHandovers: list(db.cashHandovers).filter(x => x.market === input.marketId && x.periodId === input.period),
      targetDrafts: list(db.billingDrafts).filter(x => x.market === input.marketId && x.period === input.period),
      targetWarnings: list(db.billingWarnings).filter(x => x.market === input.marketId && x.period === input.period),
      targetMeterAdjustments: list(db.meterAdjustRequests).filter(x => x.market === input.marketId && x.period === input.period),
      targetReceivableAdjustments: list(db.receivableAdjustRequests).filter(x => x.market === input.marketId && x.period === input.period),
      targetNotifications,
      targetPersonalNotifications: list(db.personalNotifications).filter(x => (x.market === input.marketId || x.marketId === input.marketId || x.targetMarket === input.marketId) && x.period === input.period)
    };
  }
  function summary(input, s) {
    const handoff = s.billingPeriod && (s.billingPeriod.collectionHandoffByMarket || {})[input.marketId];
    return { ok: true, target: Object.assign({}, input), globalPeriodSafe: s.globalSafe,
      counts: { readingsCL: count(s.targetReadings), readingsOtherMarkets: count(s.otherReadings), invoicesCL: count(s.targetInvoices), invoicesOtherMarkets: count(s.otherInvoices), payments: count(s.targetPayments), receipts: count(s.targetReceipts), bankLinked: count(s.targetBank), cashHandovers: count(s.targetHandovers), billingDrafts: count(s.targetDrafts), billingWarnings: count(s.targetWarnings), meterAdjustments: count(s.targetMeterAdjustments), receivableAdjustments: count(s.targetReceivableAdjustments), notifications: count(s.targetNotifications), personalNotifications: count(s.targetPersonalNotifications), hasCollectionHandoffCL: !!handoff },
      limitations: s.globalSafe ? [] : ['Có record 2026-10 thuộc market khác hoặc không xác định được market; chỉ reset record có ownership CL, không thay meterPeriods/issuedPeriods/billing period global.'] };
  }

  const DEV = A.DEV || (A.DEV = {});
  DEV.preflightDemoCycleReset = function (input) {
    if (!exactTarget(input)) return { ok: false, code: 'EXPLICIT_TARGET_REQUIRED', message: 'Phải truyền đúng { marketId: "CL", period: "2026-10" }; không có reset-all.' };
    const result = summary(input, inspect(input)); console.info('[demo-reset] preflight', result); return result;
  };
  DEV.resetDemoCycle = function (input) {
    if (!exactTarget(input)) return { ok: false, code: 'EXPLICIT_TARGET_REQUIRED', message: 'Từ chối reset: phải truyền đúng { marketId: "CL", period: "2026-10" }.' };
    const db = A.db, beforeScope = inspect(input), before = summary(input, beforeScope);
    if (!beforeScope.billingPeriod) return { ok: false, code: 'BILLING_PERIOD_NOT_FOUND', message: 'Không tìm thấy billing period 2026-10; không có mutation nào.' };

    // Capture every relation before deleting its owner invoice/payment.
    db.notifications = removeSelected(db.notifications, beforeScope.targetNotifications);
    db.personalNotifications = removeSelected(db.personalNotifications, beforeScope.targetPersonalNotifications);
    db.bank = removeSelected(db.bank, beforeScope.targetBank);
    db.payments = removeSelected(db.payments, beforeScope.targetPayments);
    if (Array.isArray(db.receipts)) db.receipts = removeSelected(db.receipts, beforeScope.targetReceipts);
    db.billingDrafts = removeSelected(db.billingDrafts, beforeScope.targetDrafts);
    db.billingWarnings = removeSelected(db.billingWarnings, beforeScope.targetWarnings);
    db.invoices = removeSelected(db.invoices, beforeScope.targetInvoices);
    db.cashHandovers = removeSelected(db.cashHandovers, beforeScope.targetHandovers);
    db.meterAdjustRequests = removeSelected(db.meterAdjustRequests, beforeScope.targetMeterAdjustments);
    db.receivableAdjustRequests = removeSelected(db.receivableAdjustRequests, beforeScope.targetReceivableAdjustments);
    db.readings = removeSelected(db.readings, beforeScope.targetReadings);

    const period = beforeScope.billingPeriod, handoffs = Object.assign({}, period.collectionHandoffByMarket || {});
    delete handoffs[input.marketId];
    if (Object.keys(handoffs).length) period.collectionHandoffByMarket = handoffs; else delete period.collectionHandoffByMarket;
    // Completion is market-scoped even when the legacy meter period is shared.
    // This override prevents a legacy global CLOSED marker from locking CL again.
    if (beforeScope.meterPeriod) {
      beforeScope.meterPeriod.completionByMarket = Object.assign({}, beforeScope.meterPeriod.completionByMarket || {}, { [input.marketId]: { status: 'PENDING' } });
    }
    if (beforeScope.globalSafe) {
      period.status = 'PREPARING'; period.calculationStatus = 'DATA_ENTRY'; delete period.issuedAt; delete period.issuedBy;
      let meter = beforeScope.meterPeriod;
      if (!meter) { meter = { id: input.period, month: Number(input.period.slice(5)), year: Number(input.period.slice(0, 4)), status: 'PENDING', closeDate: period.endDate }; db.meterPeriods = list(db.meterPeriods).concat([meter]); }
      else { meter.status = 'PENDING'; ['completedBy', 'completedAt', 'closedBy', 'closedAt', 'lockAt', 'lockedAt', 'reviewDemoSeeded'].forEach(k => delete meter[k]); }
      db.issuedPeriods = list(db.issuedPeriods).filter(x => x !== input.period);
    }
    A.reindex(); A.save(); if (A.render) A.render();
    const result = { ok: true, before, after: DEV.preflightDemoCycleReset(input), globalPeriodReset: beforeScope.globalSafe, preserved: ['debts', 'extraLog', 'cashDeposits', 'cashConfirms', 'notificationEventConfigs'] };
    console.info('[demo-reset] completed', result); return result;
  };
})(window.APP);
