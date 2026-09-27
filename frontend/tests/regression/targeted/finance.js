// Targeted suite: effective finance actions before Phase 15.20 migration.
// Covers the current V3 meter page, receivables, collection policy, receipts,
// reconciliation/cash handover and debt views. The persisted expectation is
// recorded from the untouched b9f5c74 runtime, never from migrated code.
module.exports = function finance(r) {
  const { snap, login, ch, inp, act, go, A } = r;
  const invoice = () => A.db.invoices.find(x => x.market === 'CL' && x.status !== 'paid');
  const reading = () => A.db.readings.find(x => x.market === 'CL') || A.db.readings[0];

  login('AC-NV01', 'CL');
  snap('finance policy manager CL', () => [A.canDirectCollect('CL'), A.canCollectReceivable('CL')]);
  snap('finance policy manager TTD', () => [A.canDirectCollect('TTD'), A.canCollectReceivable('TTD')]);

  go('dien-nuoc');
  snap('meter V3 render', () => A.current);
  const meter = reading();
  snap('meter point open', () => meter && act('mr-point-open', { id: meter.stallId, period: meter.period }));
  snap('meter detail', () => meter && act('mr-point-detail', { id: meter.stallId, period: meter.period }));
  snap('meter close period open', () => act('dn-close-period', {}));
  snap('meter close period confirm', () => {
    const period = A.db.meterPeriods.find(x => x.market === 'CL' && x.status === 'RECORDING');
    return period && act('dn-close-confirm', { id: period.id });
  });

  go('phai-thu');
  snap('receivables render', () => A.current);
  snap('receivables status filter', () => ch('pt-status', 'all'));
  const inv = invoice();
  snap('receivable open', () => inv && act('inv-open', { id: inv.id }));

  login('AC-NV02', 'CL'); go('thu-tien');
  snap('collection render', () => A.current);
  snap('collection policy collector CL', () => [A.canDirectCollect('CL'), A.canCollectReceivable('CL')]);
  snap('collection search', () => inp('thu-search', 'CL'));
  const collectable = invoice();
  snap('collection open', () => collectable && act('pay-open', { id: collectable.id }));

  login('AC-NV01', 'CL'); go('doi-soat');
  snap('reconciliation render', () => A.current);
  snap('reconciliation bank tab', () => act('ds-tab', { id: 'bank' }));
  snap('reconciliation cash tab', () => act('ds-tab', { id: 'cash' }));

  go('cong-no');
  snap('debt render', () => A.current);
  snap('debt origin filter', () => ch('cn-origin', 'all'));
  snap('refresh stall semantics', () => {
    const st = A.db.stalls.find(x => x.market === 'CL' && x.status === 'thue');
    if (!st) return null;
    const before = st.status;
    A.refreshStall(st);
    return [before, st.status];
  });
};
