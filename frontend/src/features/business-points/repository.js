/* Business-point (Điểm kinh doanh) read-only access over the legacy A.db.stalls collection. */
(function (A) {
  'use strict';

  if (!A || !A.data) return;

  // Legacy collection name; the layout tree (choso-caolanh-layout) is a separate
  // representation owned by v-cautruc.js and is intentionally not wrapped here.
  const COLLECTION = 'stalls';
  const features = A.features || (A.features = {});
  const businessPoints = features.businessPoints || (features.businessPoints = {});
  const repository = businessPoints.repository || (businessPoints.repository = {});

  // Returns the live legacy record (or null).
  repository.list = function () { return A.data.getCollection(COLLECTION); };
  repository.getById = function (id) { return A.data.findById(COLLECTION, id); };

  // Occupancy writes used by contract orchestration (Phase 9). Only point fields are
  // touched; persistence is the caller's single save. Structural changes (split,
  // merge, conversion) and collector assignment stay on their legacy paths.
  repository.occupy = function (id, traderId, contractId) {
    const point = repository.getById(id);
    if (!point) return null;
    point.status = 'thue'; point.traderId = traderId; point.contractId = contractId;
    return point;
  };
  // Release after contract termination/liquidation: back to 'trong', links cleared.
  repository.vacate = function (id) {
    const point = repository.getById(id);
    if (!point) return null;
    point.status = 'trong'; point.traderId = null; point.contractId = null;
    return point;
  };
  repository.addHistory = function (id, entry) {
    const point = repository.getById(id);
    if (!point) return null;
    point.history = point.history || [];
    point.history.unshift(entry);
    return point;
  };
})(window.APP);
