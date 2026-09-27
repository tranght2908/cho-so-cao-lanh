/* Business-point read facade. Rendering, filtering and all point writes remain in legacy code. */
(function (A) {
  'use strict';

  if (!A || !A.features || !A.features.businessPoints || !A.features.businessPoints.repository) return;

  const businessPoints = A.features.businessPoints;
  const repository = businessPoints.repository;
  const service = businessPoints.service || (businessPoints.service = {});

  service.get = function (id) { return repository.getById(id); };
})(window.APP);
