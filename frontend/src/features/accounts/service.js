/* Accounts use-case facade (trader account readiness). Auth/OTP, RBAC and the account admin screen stay legacy. */
(function (A) {
  'use strict';

  if (!A || !A.features || !A.features.accounts || !A.features.accounts.repository) return;

  const accounts = A.features.accounts;
  const repository = accounts.repository;
  const service = accounts.service || (accounts.service = {});

  service.list = function () { return repository.list(); };
  service.get = function (id) { return repository.get(id); };
  service.byTraderId = function (traderId) { return repository.byTraderId(traderId); };
  // Next trader account ID "AC-TT<nn>", same formula as the legacy workflow command.
  service.nextTraderAccountId = function (pad) {
    const n = repository.list().reduce((max, a) => Math.max(max, +(String(a.id).match(/^AC-TT(\d+)$/) || [0, 0])[1]), 0) + 1;
    return 'AC-TT' + pad(n, 2);
  };
  // Persisted by the legacy store; the caller builds the record (role, scopes, status).
  service.add = function (account) { return repository.add(account); };
  service.setStatus = function (id, status) { return repository.setStatus(id, status); };
})(window.APP);
