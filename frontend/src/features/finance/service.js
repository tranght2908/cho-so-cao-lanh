/* Finance read queries used by other features. Amount/debt calculation (U.due, U.traderDebt) is unchanged and stays in core. */
(function (A) {
  'use strict';

  if (!A || !A.features || !A.features.finance || !A.features.finance.repository) return;

  const finance = A.features.finance;
  const repository = finance.repository;
  const service = finance.service || (finance.service = {});

  // "Unpaid" = legacy condition status !== 'paid'.
  service.unpaidInvoicesForContract = function (contractId) { return repository.listInvoices().filter(i => i.contractId === contractId && i.status !== 'paid'); };
  service.unpaidInvoicesForTrader = function (traderId) { return repository.listInvoices().filter(i => i.traderId === traderId && i.status !== 'paid'); };
})(window.APP);
