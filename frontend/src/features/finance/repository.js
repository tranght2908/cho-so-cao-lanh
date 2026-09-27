/* Finance read access over the legacy A.db.invoices collection (read only). */
(function (A) {
  'use strict';

  if (!A || !A.data) return;

  const features = A.features || (A.features = {});
  const finance = features.finance || (features.finance = {});
  const repository = finance.repository || (finance.repository = {});

  // Live legacy array; callers treat it as read-only. Invoice/payment/receipt writes,
  // readings, periods and reconciliation stay in js/v-taichinh.js, js/core.js, js/mini.js.
  repository.listInvoices = function () { return A.data.getCollection('invoices'); };
})(window.APP);
