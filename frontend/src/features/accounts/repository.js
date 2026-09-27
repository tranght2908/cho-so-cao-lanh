/* Accounts data access over the legacy A.ACCOUNTS store (registered as APP.data source "accounts"). */
(function (A) {
  'use strict';

  if (!A || !A.data) return;

  const features = A.features || (A.features = {});
  const accounts = features.accounts || (features.accounts = {});
  const repository = accounts.repository || (accounts.repository = {});
  const source = function () {
    const store = A.data.getSource && A.data.getSource('accounts');
    if (!store) throw new Error('Accounts source is unavailable.');
    return store;
  };

  // The legacy store persists itself (choso-caolanh-accounts) on add/setStatus.
  repository.list = function () { return source().list(); };
  repository.get = function (id) { return source().get(id); };
  repository.byTraderId = function (traderId) { return source().byTraderId(traderId); };
  repository.add = function (account) { return source().add(account); };
  repository.setStatus = function (id, status) { return source().setStatus(id, status); };
})(window.APP);
