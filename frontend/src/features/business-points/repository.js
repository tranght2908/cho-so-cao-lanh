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

  // Read only: returns the live legacy record (or null). Writes stay on the legacy
  // contract, allocation and structural-change paths.
  repository.getById = function (id) { return A.data.findById(COLLECTION, id); };
})(window.APP);
