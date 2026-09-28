/* Traders profile use-case facade. Rendering, DOM, permissions and toasts remain in the legacy view. */
(function (A) {
  'use strict';

  if (!A || !A.features || !A.features.traders || !A.features.traders.repository) return;

  const traders = A.features.traders;
  const repository = traders.repository;
  const service = traders.service || (traders.service = {});

  service.list = function () { return repository.list(); };
  service.getProfile = function (id) { return repository.get(id); };
  // Business lifecycle is derived at read time from contracts, never stored back on
  // the trader record. A future contract is not active yet; an ended/terminated/
  // liquidated valid contract proves the trader has operated before.
  service.BUSINESS_STATUS = {
    WAITING_ALLOCATION: 'WAITING_ALLOCATION',
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE'
  };
  service.deriveBusinessStatus = function (traderOrId, date) {
    const trader = typeof traderOrId === 'string' ? repository.get(traderOrId) : traderOrId;
    const status = service.BUSINESS_STATUS;
    if (!trader) return status.WAITING_ALLOCATION;
    const contractService = A.features.contracts && A.features.contracts.service;
    const pointService = A.features.businessPoints && A.features.businessPoints.service;
    if (!contractService || !pointService) return status.WAITING_ALLOCATION;
    const day = date || A.U.today();
    const contracts = contractService.listByTrader(trader.id);
    const validContract = c => !!pointService.get(c.businessPointId || c.stallId) && !!pointService.occupyingInterval(c);
    if (contracts.some(c => validContract(c) && pointService.contractPhase(c, day) === 'current')) return status.ACTIVE;
    if (contracts.some(c => validContract(c) && pointService.occupyingInterval(c).start <= day)) return status.INACTIVE;
    return status.WAITING_ALLOCATION;
  };
  service.idNoTaken = function (idNo, excludeId) { return repository.idNoTaken(idNo, excludeId); };
  // updateProfile/updateDocuments mutate in memory only; save() persists. The legacy
  // edit flow logs between mutation and save, so persistence stays a separate step.
  service.updateProfile = function (id, profile) { return repository.updateProfile(id, profile); };
  service.updateDocuments = function (id, files, updatedAt) { return repository.updateDocuments(id, files, updatedAt); };
  // In-memory link used by contract orchestration; the use case saves once.
  service.linkPoint = function (id, pointId) { return repository.linkPoint(id, pointId); };
  service.unlinkPoint = function (id, pointId) { return repository.unlinkPoint(id, pointId); };
  service.save = function () { return repository.save(); };
  // Profile create: push + reindex + single save (the effective tt-new flow).
  service.create = function (profile) { repository.add(profile); repository.save(); return profile; };
})(window.APP);
