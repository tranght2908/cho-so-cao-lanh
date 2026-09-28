/* Markets data-access adapter over the existing legacy catalog source. */
(function (A) {
  'use strict';

  if (!A || !A.data) return;

  const features = A.features || (A.features = {});
  const markets = features.markets || (features.markets = {});
  const source = function () {
    const catalog = A.data.getSource && A.data.getSource('market-catalog');
    if (!catalog) throw new Error('Market catalog source is unavailable.');
    return catalog;
  };
  const repository = markets.repository || (markets.repository = {});

  repository.rows = function () { return source().rows(); };
  repository.get = function (id) { return source().get(id); };
  repository.priceConfig = function (id) { return source().priceConfig(id); };
  repository.codeTaken = function (code, excludeId) { return source().codeTaken(code, excludeId); };
  repository.nextCode = function () { return source().nextCode(); };
  repository.effectiveMarkets = function () { return source().effectiveMarkets(); };
  repository.add = function (record, user) { return source().add(record, user); };
  repository.update = function (id, patch, user) { return source().update(id, patch, user); };
  repository.ranks = function () { return source().RANKS; };
  repository.statuses = function () { return source().STATUS; };
  repository.priceConfigs = function () { return source().PRICE_CONFIGS; };
})(window.APP);
