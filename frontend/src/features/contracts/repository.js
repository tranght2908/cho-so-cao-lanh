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
  // Ghi chú theo dõi hợp đồng đã hết hạn thuộc chính bản ghi hợp đồng. Không
  // dùng history chung vì cần hiển thị như một danh sách ghi chú độc lập.
  repository.addExpiryNote = function (id, note) {
    const c = repository.getById(id);
    if (!c) return null;
    c.expiryNotes = Array.isArray(c.expiryNotes) ? c.expiryNotes : [];
    c.expiryNotes.push(note);
    return note;
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
  // Gia hạn cập nhật cùng một hợp đồng; lịch sử được lưu riêng để giữ kỳ trước.
  repository.applyRenewal = function (id, renewal) {
    const c = repository.getById(id);
    if (!c) return null;
    const renewals = Array.isArray(A.db.contractRenewals) ? A.db.contractRenewals : (A.db.contractRenewals = []);
    if (renewals.some(x => x && x.contractId === id && x.renewalNo === renewal.renewalNo)) return null;
    c.end = renewal.newEndDate;
    if (renewal.additionalTerms != null) c.additionalTerms = renewal.additionalTerms;
    renewals.push(renewal);
    return c;
  };
  // Canonical pending-liquidation state + termination payload.
  repository.applyTermination = function (id, termination) {
    const c = repository.getById(id);
    if (!c) return null;
    c.status = 'PENDING_LIQUIDATION';
    c.termination = termination;
    c.endReason = 'EARLY_TERMINATION';
    c.terminatedAt = termination.date;
    c.terminationReason = termination.reason;
    c.terminationDetail = termination.detail;
    c.terminatedBy = termination.terminatedBy || '';
    delete c._terminationDraftAttachment;
    return c;
  };
  // Canonical liquidated state + liquidation fields; the draft is consumed.
  repository.applyLiquidation = function (id, liquidation) {
    const c = repository.getById(id);
    if (!c) return null;
    c.status = 'LIQUIDATED';
    c.endReason = c.endReason || 'EXPIRED';
    c.liquidatedAt = liquidation.liquidatedAt;
    c.liquidatedBy = liquidation.liquidatedBy || '';
    c.liquidationNote = liquidation.liquidationNote;
    c.liquidationChecklist = liquidation.liquidationChecklist;
    c.liquidationSignedCopies = liquidation.liquidationSignedCopies;
    c.handoverCondition = liquidation.handoverCondition || '';
    delete c._liquidationDraft;
    return c;
  };
})(window.APP);
