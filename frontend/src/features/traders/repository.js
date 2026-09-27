/* Traders data-access adapter over the legacy A.db.traders collection. */
(function (A) {
  'use strict';

  if (!A || !A.data) return;

  const COLLECTION = 'traders';
  const features = A.features || (A.features = {});
  const traders = features.traders || (features.traders = {});
  const repository = traders.repository || (traders.repository = {});

  // Returns the live legacy array (same reference as A.db.traders). Callers must
  // treat it as read-only; profile writes go through the update methods below.
  repository.list = function () { return A.data.getCollection(COLLECTION); };
  repository.get = function (id) { return A.data.findById(COLLECTION, id); };
  repository.idNoTaken = function (idNo, excludeId) {
    return repository.list().some(x => x.idNo === idNo && x.id !== excludeId);
  };

  // Profile fields only, in the legacy assignment order. Stall, contract,
  // account and status fields are intentionally not writable here.
  repository.updateProfile = function (id, profile) {
    const t = repository.get(id);
    if (!t) return null;
    t.name = profile.name; t.idNo = profile.idNo; t.phone = profile.phone;
    t.idType = profile.idType;
    return t;
  };
  // Replaces only the given document keys on trader.docFiles; other documents keep
  // their existing references. Shape: copy of the captured metadata + updatedAt.
  repository.updateDocuments = function (id, files, updatedAt) {
    const t = repository.get(id);
    if (!t) return null;
    const keys = Object.keys(files || {});
    if (keys.length) {
      t.docFiles = t.docFiles || {};
      keys.forEach(key => { t.docFiles[key] = Object.assign({}, files[key], { updatedAt }); });
    }
    return t;
  };
  // Point link on the trader record (trader.stalls), used only by contract
  // orchestration. Point/contract records are owned by their own features.
  repository.linkPoint = function (id, pointId) {
    const t = repository.get(id);
    if (!t) return null;
    if (!t.stalls.includes(pointId)) t.stalls.push(pointId);
    return t;
  };
  // Legacy release semantics: trader.stalls is reassigned to a filtered copy; with no
  // resolvable point (pointId null) every link is kept.
  repository.unlinkPoint = function (id, pointId) {
    const t = repository.get(id);
    if (!t) return null;
    t.stalls = t.stalls.filter(x => !pointId || x !== pointId);
    return t;
  };
  // Appends a new profile and rebuilds lookup indexes (same order as the legacy create).
  repository.add = function (profile) {
    A.data.getCollection(COLLECTION).push(profile);
    A.data.reindex();
    return profile;
  };
  repository.save = function () { return A.data.save(); };
})(window.APP);
