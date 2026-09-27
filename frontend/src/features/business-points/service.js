/* Business-point facade. Rendering, filtering, structural changes and layout stay in legacy code. */
(function (A) {
  'use strict';

  if (!A || !A.features || !A.features.businessPoints || !A.features.businessPoints.repository) return;

  const businessPoints = A.features.businessPoints;
  const repository = businessPoints.repository;
  const service = businessPoints.service || (businessPoints.service = {});

  service.list = function () { return repository.list(); };
  service.get = function (id) { return repository.getById(id); };
  // Occupancy commands are in-memory only; the orchestrating use case saves once.
  service.occupy = function (id, traderId, contractId) { return repository.occupy(id, traderId, contractId); };
  service.vacate = function (id) { return repository.vacate(id); };
  service.addHistory = function (id, entry) { return repository.addHistory(id, entry); };
})(window.APP);
