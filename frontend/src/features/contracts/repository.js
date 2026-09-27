/* Contracts data access over the legacy A.db.contracts collection. */
(function (A) {
  'use strict';

  if (!A || !A.data) return;

  const COLLECTION = 'contracts';
  const features = A.features || (A.features = {});
  const contracts = features.contracts || (features.contracts = {});
  const repository = contracts.repository || (contracts.repository = {});

  // Live legacy array/records; callers treat them as read-only.
  repository.list = function () { return A.data.getCollection(COLLECTION); };
  repository.getById = function (id) { return A.data.findById(COLLECTION, id); };

  // Writes touch only contract records. Cross-aggregate effects (point occupancy,
  // trader links) are orchestrated by the service, never from here. None of these
  // methods persists; the calling use case saves once.
  repository.add = function (contract) {
    repository.list().push(contract);
    A.data.reindex();
    return contract;
  };
  repository.addHistory = function (id, entry) {
    const c = repository.getById(id);
    if (!c) return null;
    c.history = c.history || [];
    c.history.unshift(entry);
    return c;
  };
  // Signed paper copy metadata (mock upload): same shape and page numbering as legacy.
  repository.addSignedCopy = function (id, file) {
    const c = repository.getById(id);
    if (!c) return null;
    c.signedCopies = c.signedCopies || [];
    c.signedCopies.push({ name: file.name, page: c.signedCopies.length + 1, addedAt: file.addedAt, mock: true });
    c.scanned = true;
    return c;
  };
  // Status 'chamdut' + termination payload; the draft attachment is consumed.
  repository.applyTermination = function (id, termination) {
    const c = repository.getById(id);
    if (!c) return null;
    c.status = 'chamdut';
    c.termination = termination;
    delete c._terminationDraftAttachment;
    return c;
  };
  // Status 'thanhly' + liquidation fields in legacy order; the draft is consumed.
  repository.applyLiquidation = function (id, liquidation) {
    const c = repository.getById(id);
    if (!c) return null;
    c.status = 'thanhly';
    c.liquidatedAt = liquidation.liquidatedAt;
    c.liquidationNote = liquidation.liquidationNote;
    c.liquidationChecklist = liquidation.liquidationChecklist;
    c.liquidationSignedCopies = liquidation.liquidationSignedCopies;
    delete c._liquidationDraft;
    return c;
  };
})(window.APP);
