/* Markets use-case facade. Rendering and DOM behavior remain in the legacy view. */
(function (A) {
  'use strict';

  if (!A || !A.features || !A.features.markets || !A.features.markets.repository) return;

  const markets = A.features.markets;
  const repository = markets.repository;
  const service = markets.service || (markets.service = {});

  service.rows = function () { return repository.rows(); };
  service.get = function (id) { return repository.get(id); };
  service.priceConfig = function (id) { return repository.priceConfig(id); };
  service.codeTaken = function (code, excludeId) { return repository.codeTaken(code, excludeId); };
  service.add = function (record, user) { return repository.add(record, user); };
  service.update = function (id, patch, user) { return repository.update(id, patch, user); };
  service.RANKS = repository.ranks();
  service.STATUS = repository.statuses();
  service.PRICE_CONFIGS = repository.priceConfigs();
})(window.APP);
