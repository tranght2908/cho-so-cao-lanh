/* Contracts use cases. Rendering, DOM, permissions, validation messages and toasts remain in the consumers. */
(function (A) {
  'use strict';

  if (!A || !A.features || !A.features.contracts || !A.features.contracts.repository) return;

  const features = A.features;
  const contracts = features.contracts;
  const repository = contracts.repository;
  const service = contracts.service || (contracts.service = {});
  // Sibling feature services, resolved at call time (all load before any consumer runs).
  const points = () => features.businessPoints.service;
  const traders = () => features.traders.service;

  // Legacy status code for an active contract ("hiệu lực").
  const isActive = c => !!c && c.status === 'hieuluc';

  // ---- Reads ----
  service.isActive = isActive;
  service.list = function () { return repository.list(); };
  service.get = function (id) { return repository.getById(id); };
  service.listByTrader = function (traderId) { return repository.list().filter(c => c.traderId === traderId); };
  service.activeForTrader = function (traderId) { return repository.list().find(c => isActive(c) && c.traderId === traderId); };
  service.hasActiveForTrader = function (traderId) { return repository.list().some(c => isActive(c) && c.traderId === traderId); };
  service.hasActiveForPoint = function (pointId) { return repository.list().some(c => isActive(c) && c.stallId === pointId); };
  // Workflow contract form: point in the market, vacant ('trong'), without an active contract.
  service.availablePoints = function (market) {
    return points().list().filter(s => s.market === market && s.status === 'trong' && !service.hasActiveForPoint(s.id));
  };
  // Workflow contract form: traders of the market without an active contract.
  service.tradersWithoutActive = function (market) {
    return traders().list().filter(t => t.market === market && !service.hasActiveForTrader(t.id));
  };
  service.nextId = function (market, year, pad) {
    const max = repository.list().reduce((n, c) => Math.max(n, +(String(c.id).match(/-(\d+)$/) || [0, 0])[1]), 0);
    return 'HĐ-' + market + '-' + year + '-' + pad(max + 1, 4);
  };

  // ---- Use case: create contract + allocate business point ----
  // Frontend orchestration boundary only: there is no real transaction or rollback
  // in the prototype. The Spring Boot implementation MUST be one @Transactional use
  // case covering the same record changes. Mutation order mirrors the legacy
  // wf-contract-save command; persistence happens exactly once at the end.
  service.createWithPointAllocation = function (input) {
    const contract = input.contract, traderId = input.traderId, pointId = input.pointId;
    repository.add(contract);                                  // contracts.push + reindex
    points().occupy(pointId, traderId, contract.id);           // status 'thue', traderId, contractId
    traders().linkPoint(traderId, pointId);                    // trader.stalls (no duplicates)
    points().addHistory(pointId, input.pointHistoryEntry);     // point history (newest first)
    // Caller-owned side effect that the legacy command ran right before saving
    // (workflow recent-point marker); the service does not know what it does.
    if (typeof input.beforeSave === 'function') input.beforeSave(contract);
    A.data.save();
    return contract;
  };

  // ---- Lifecycle use cases (Phase 10) ----
  // Point release after termination/liquidation, exactly as legacy release(c): the
  // point is vacated only when no OTHER active contract uses it; the trader link is
  // always removed (trader.stalls reassigned, as before). No history is deleted and
  // no finance record is touched.
  function releasePoint(c) {
    const s = points().get(c.stallId), t = traders().getProfile(c.traderId);
    if (s && !repository.list().some(x => x.id !== c.id && isActive(x) && x.stallId === s.id)) points().vacate(s.id);
    if (t) traders().unlinkPoint(t.id, s ? s.id : null);
  }
  // Frontend orchestration only (no rollback); backend MUST be @Transactional.
  service.terminate = function (id, termination, historyEntry) {
    const c = repository.applyTermination(id, termination);
    if (!c) return null;
    repository.addHistory(id, historyEntry);
    releasePoint(c);
    A.data.save();
    return c;
  };
  // Preconditions (debt, checklist, signed minutes) are validated by the caller as before.
  service.liquidate = function (id, liquidation, historyEntry) {
    const c = repository.applyLiquidation(id, liquidation);
    if (!c) return null;
    repository.addHistory(id, historyEntry);
    releasePoint(c);
    A.data.save();
    return c;
  };
  service.addSignedCopy = function (id, file, historyEntry) {
    const c = repository.addSignedCopy(id, file);
    if (!c) return null;
    repository.addHistory(id, historyEntry);
    A.data.save();
    return c;
  };
  // Audit event that is persisted on its own (e.g. "In hợp đồng").
  service.recordEvent = function (id, historyEntry) {
    const c = repository.addHistory(id, historyEntry);
    if (!c) return null;
    A.data.save();
    return c;
  };
})(window.APP);
