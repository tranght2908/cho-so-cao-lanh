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

  const lifecycleService = () => features.lifecycle && features.lifecycle.service;
  const syncExpiry = () => {
    const l = lifecycleService();
    if (l && l.syncExpiry && l.syncExpiry()) A.data.save();
  };
  // Persisted ACTIVE means the contract has not been liquidated/terminated.
  // Use-case eligibility that says "hiệu lực" must additionally respect its
  // date range; a future contract must not unlock trader-account onboarding.
  const isActive = c => !!c && c.status === 'ACTIVE' && (!c.start || c.start <= A.U.today()) && (!c.end || c.end >= A.U.today());

  // ---- Reads ----
  service.isActive = isActive;
  service.list = function () { syncExpiry(); return repository.list(); };
  service.get = function (id) { return repository.getById(id); };
  service.listByTrader = function (traderId) { return repository.list().filter(c => c.traderId === traderId); };
  service.activeForTrader = function (traderId) { return repository.list().find(c => isActive(c) && c.traderId === traderId); };
  service.hasActiveForTrader = function (traderId) { return repository.list().some(c => isActive(c) && c.traderId === traderId); };
  service.hasActiveForPoint = function (pointId) { return repository.list().some(c => isActive(c) && (c.businessPointId || c.stallId) === pointId); };
  // Contract creation is not restricted to traders without an existing contract:
  // one trader may rent multiple business points through separate contracts. Point
  // availability over the selected interval remains the conflict boundary.
  service.tradersForCreate = function (market) { return traders().list().filter(t => t.market === market); };
  // Onboarding worklist only: the trader's derived business status determines
  // whether their next step is initial point allocation / contract creation.
  // This intentionally does not restrict later, additional contracts.
  service.pendingContractTraders = function (market) {
    const scope = market === 'ALL' ? new Set(A.allowedMarkets(A.currentAccount())) : null;
    return traders().list().filter(t => (!scope ? t.market === market : scope.has(t.market)) && traders().deriveBusinessStatus(t) === traders().BUSINESS_STATUS.WAITING_ALLOCATION);
  };
  // Canonical lifecycle is persisted; this adapter only preserves legacy UI keys.
  service.lifecycle = function (contract, date) {
    if (!contract) return 'ENDED';
    syncExpiry();
    if (contract.status === 'LIQUIDATED') return 'LIQUIDATED';
    if (contract.status === 'PENDING_LIQUIDATION') return 'PENDING_LIQUIDATION';
    if (contract.status === 'ACTIVE') {
      const at = date || A.U.today();
      if (contract.start && contract.start > at) return 'UPCOMING';
      if (contract.end && contract.end < at) return 'ENDED';
      return 'ACTIVE';
    }
    return 'ENDED';
  };
  service.presentationStatus = function (contract, date) {
    return ({ ACTIVE: 'current', UPCOMING: 'upcoming', PENDING_LIQUIDATION: 'pending_liquidation', LIQUIDATED: 'liquidated', ENDED: 'ended' })[service.lifecycle(contract, date)] || 'ended';
  };
  service.terminationEligibility = function (contractOrId, date, permission) {
    const c = typeof contractOrId === 'string' ? repository.getById(contractOrId) : contractOrId;
    if (!c) return { allowed:false, message:'Không tìm thấy hợp đồng.' };
    if (permission === false) return { allowed:false, message:'Bạn không có quyền chấm dứt hợp đồng.' };
    const day = date || A.U.today();
    if (c.status !== 'ACTIVE' || service.lifecycle(c, day) !== 'ACTIVE' || c.end < day) return { allowed:false, message:'Chỉ có thể chấm dứt hợp đồng đang hiệu lực và chưa hết hạn.' };
    return { allowed:true };
  };
  service.liquidationEligibility = function (contractOrId, date, permission) {
    const c = typeof contractOrId === 'string' ? repository.getById(contractOrId) : contractOrId;
    if (!c) return { allowed:false, message:'Không tìm thấy hợp đồng.' };
    if (permission === false) return { allowed:false, message:'Bạn không có quyền thanh lý hợp đồng.' };
    const state = service.lifecycle(c, date);
    if (state === 'LIQUIDATED') return { allowed:false, message:'Hợp đồng đã được thanh lý.' };
    if (state !== 'PENDING_LIQUIDATION') return { allowed:false, message:'Chỉ thanh lý hợp đồng đã hết hạn hoặc đã chấm dứt trước hạn.' };
    return { allowed:true, endReason: c.endReason || 'EXPIRED' };
  };
  // Points free for [from, to] — delegates to the ONE availability rule owned by business points
  // (point eligibility + overlapping occupying contracts). No date = today.
  service.availablePoints = function (market, from, to) {
    const day = from || A.U.today();
    return points().availablePoints(market, day, to || day);
  };
  // Workflow contract form: traders of the market without an active contract.
  service.tradersWithoutActive = function (market) {
    return traders().list().filter(t => t.market === market && !service.hasActiveForTrader(t.id));
  };
  service.nextId = function (market, year, pad) {
    const max = repository.list().reduce((n, c) => Math.max(n, +(String(c.id).match(/-(\d+)$/) || [0, 0])[1]), 0);
    return 'HĐ-' + market + '-' + year + '-' + pad(max + 1, 4);
  };

  // ---- Gia hạn hợp đồng ----
  // Chỉ cho gia hạn kỳ đang hiệu lực trong 30 ngày cuối, bao gồm ngày hết hạn.
  // Permission được nhận riêng để UI luôn có thể hiển thị nút nhưng handler và
  // service vẫn chặn được thao tác không được cấp quyền.
  service.renewalEligibility = function (contractOrId, date, permission) {
    const c = typeof contractOrId === 'string' ? repository.getById(contractOrId) : contractOrId;
    if (!c) return { allowed: false, code: 'NOT_FOUND', message: 'Không tìm thấy hợp đồng.' };
    if (permission === false) return { allowed: false, code: 'FORBIDDEN', message: 'Bạn không có quyền gia hạn hợp đồng.' };
    if (service.lifecycle(c, date) !== 'ACTIVE') return { allowed: false, code: 'INACTIVE', message: 'Hợp đồng đã hết hạn, chấm dứt hoặc đang chờ thanh lý. Không thể thực hiện gia hạn.' };
    if (c.status !== 'ACTIVE') return { allowed: false, code: 'INACTIVE', message: 'Hợp đồng không còn hiệu lực. Không thể thực hiện gia hạn.' };
    const today = date || A.U.today();
    const remaining = A.U.days(today, c.end);
    if (remaining < 0) return { allowed: false, code: 'EXPIRED', message: 'Hợp đồng đã hết hạn. Không thể thực hiện gia hạn.' };
    if (remaining > 30) return { allowed: false, code: 'TOO_EARLY', message: 'Chỉ được gia hạn khi hợp đồng còn tối đa 30 ngày trước ngày hết hạn.' };
    return { allowed: true, code: 'ELIGIBLE', remaining };
  };
  // Explicit action helpers keep each action's business condition separate.
  // Only renewal uses the 0–30 day window; termination never does.
  service.canRenewContract = function (contractOrId, date, permission) {
    return service.renewalEligibility(contractOrId, date, permission).allowed;
  };
  service.canTerminateContract = function (contractOrId, date, permission) {
    return service.terminationEligibility(contractOrId, date, permission).allowed;
  };
  service.canLiquidateContract = function (contractOrId, date, permission) {
    return service.liquidationEligibility(contractOrId, date, permission).allowed;
  };
  service.renewalsForContract = function (contractId) {
    return (Array.isArray(A.db.contractRenewals) ? A.db.contractRenewals : []).filter(x => x && x.contractId === contractId)
      .slice().sort((a, b) => Number(b.renewalNo || 0) - Number(a.renewalNo || 0));
  };
  // Read-only policy projection for the renewal screen. Billing remains the
  // owner of applying a rate to each monthly collection period.
  service.renewalPolicy = function (contractOrId, date) {
    const c = typeof contractOrId === 'string' ? repository.getById(contractOrId) : contractOrId;
    const s = c && points().get(c.businessPointId || c.stallId);
    if (!c || !s) return { point: s || null, policy: null };
    const at = date || A.U.today();
    const rows = A.SERVICE_CFG && A.SERVICE_CFG.list ? A.SERVICE_CFG.list('stallPrices') : [];
    const areaTypeId = s.areaTypeId || s.areaType || null;
    const legacyType = { kiot: 'Ki-ốt', nhalong: 'Trong nhà lồng chợ', ngoai: 'Tự sản tự tiêu', phien: 'Quầy theo phiên' }[s.type];
    const policy = rows.filter(r => r && r.status === 'active'
      && (r.marketId === c.market || (Array.isArray(r.marketIds) && r.marketIds.includes(c.market)) || r.marketId === 'ALL')
      && (!r.effectiveFrom || r.effectiveFrom <= at) && (!r.effectiveTo || r.effectiveTo >= at)
      && (r.areaTypeId ? r.areaTypeId === areaTypeId : (r.stallType === legacyType || r.stallType === s.cat)))
      .sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')))[0] || null;
    return { point: s, policy };
  };
  service.renew = function (id, input) {
    const c = repository.getById(id), eligibility = service.renewalEligibility(c);
    if (!eligibility.allowed) return { error: eligibility };
    const end = String(input && input.newEndDate || '');
    if (!end || end <= c.end) return { error: { code: 'INVALID_DATES', message: 'Ngày kết thúc mới phải sau ngày hết hạn hiện tại.' } };
    const renewalNo = service.renewalsForContract(id).length + 1;
    const actor = input.renewedBy || 'Không rõ';
    const stamp = A.U.dmy(A.U.today()) + ' ' + A.U.nowTime();
    const renewal = {
      id: 'GH-' + id + '-' + String(renewalNo).padStart(2, '0'), contractId: id, renewalNo,
      oldStartDate: c.start, oldEndDate: c.end, newStartDate: c.start, newEndDate: end,
      policySnapshot: input.policySnapshot ? Object.assign({}, input.policySnapshot) : null,
      additionalTerms: String(input.additionalTerms || ''), note: String(input.note || ''),
      attachments: Array.isArray(input.attachments) ? input.attachments.slice() : [],
      renewedAt: input.renewedAt || stamp, renewedBy: actor, updatedAt: input.updatedAt || stamp
    };
    const updated = repository.applyRenewal(id, renewal);
    if (!updated) return { error: { code: 'DUPLICATE', message: 'Hợp đồng đã được gia hạn cho kỳ tiếp theo.' } };
    repository.addHistory(id, { at: renewal.renewedAt, action: 'Gia hạn hợp đồng', detail: 'Ngày kết thúc: ' + A.U.dmy(renewal.oldEndDate) + ' → ' + A.U.dmy(end), by: actor });
    A.data.save();
    return { contract: updated, renewal };
  };

  // ---- Use case: create contract + allocate business point ----
  // Frontend orchestration boundary only: there is no real transaction or rollback
  // in the prototype. The Spring Boot implementation MUST be one @Transactional use
  // case covering the same record changes. Mutation order mirrors the legacy
  // wf-contract-save command; persistence happens exactly once at the end.
  service.createWithPointAllocation = function (input) {
    const contract = input.contract, traderId = input.traderId, pointId = input.pointId;
    // INVARIANT (tầng service): Contract.market = Trader.market = Point.market, đúng hồ sơ/điểm của hợp đồng. Lệch → null,
    // KHÔNG ghi gì (kiểm tra trước mọi mutation).
    const t = A.idx && A.idx.trader ? A.idx.trader.get(traderId) : null, p = points().get(pointId);
    if (!contract || !contract.market || !t || !p || contract.traderId !== traderId || (contract.businessPointId || contract.stallId) !== pointId
      || t.market !== contract.market || p.market !== contract.market) return null;
    const markets = features.markets && features.markets.service;
    const market = markets && markets.get ? markets.get(contract.market) : null;
    const allowedTraderStates = traders().BUSINESS_STATUS || { WAITING_ALLOCATION: 'WAITING_ALLOCATION', ACTIVE: 'ACTIVE' };
    if (!market || market.layoutStatus !== 'SETUP_COMPLETED' || market.status !== 'ACTIVE'
      || ![allowedTraderStates.WAITING_ALLOCATION, allowedTraderStates.ACTIVE].includes(traders().deriveBusinessStatus(t))
      || !contract.start || !contract.end || contract.end < contract.start
      || repository.getById(contract.id)
      || !points().isAvailable(pointId, contract.start, contract.end, { market: contract.market })) return null;
    // Validate every aggregate before changing one of them. localStorage has
    // no transaction, so restore the in-memory unit of work if a later step
    // fails before the single final save.
    const before = {
      contractsLength: repository.list().length,
      point: Object.assign({}, p, { history: Array.isArray(p.history) ? p.history.slice() : p.history }),
      trader: Object.assign({}, t, { stalls: Array.isArray(t.stalls) ? t.stalls.slice() : t.stalls })
    };
    try {
      repository.add(contract);                                // contracts.push + reindex
    // Current occupancy fields (point status/traderId/contractId, trader.stalls) describe TODAY. A
    // contract that starts later does not displace today's occupant; its interval still blocks
    // availability through the shared rule.
      const lifecycle = lifecycleService();
      if (lifecycle) lifecycle.activateContract(contract);
      else { points().occupy(pointId, traderId, contract.id); traders().linkPoint(traderId, pointId); }
      points().addHistory(pointId, input.pointHistoryEntry);   // point history (newest first)
    // Caller-owned side effect that the legacy command ran right before saving
    // (workflow recent-point marker); the service does not know what it does.
      if (typeof input.beforeSave === 'function') input.beforeSave(contract);
      A.data.save();
      return contract;
    } catch (err) {
      repository.list().splice(before.contractsLength);
      Object.assign(p, before.point);
      Object.assign(t, before.trader);
      A.data.reindex();
      console.warn('[choso] Contract creation failed; changes were rolled back.', err);
      return null;
    }
  };

  // ---- Lifecycle use cases (Phase 10) ----
  // Point release is deliberately performed ONLY after liquidation, never at
  // termination. This preserves the pending-handover lock on the business point.
  // point is vacated only when no OTHER active contract uses it; the trader link is
  // always removed (trader.stalls reassigned, as before). No history is deleted and
  // no finance record is touched.
  // Frontend orchestration only (no rollback); backend MUST be @Transactional.
  service.terminate = function (id, termination, historyEntry) {
    const c0 = repository.getById(id), rule = service.terminationEligibility(c0);
    if (!rule.allowed || !termination || !termination.date || !termination.reason || !termination.detail) return null;
    const today = A.U.today();
    if (termination.date < c0.start || termination.date > c0.end || termination.date > today) return null;
    const c = repository.applyTermination(id, termination);
    if (!c) return null;
    const lifecycle = lifecycleService(); if (lifecycle) lifecycle.terminateContract(c);
    repository.addHistory(id, historyEntry);
    A.data.save();
    return c;
  };
  // Preconditions (debt, checklist, signed minutes) are validated by the caller as before.
  service.liquidate = function (id, liquidation, historyEntry) {
    const c0 = repository.getById(id), rule = service.liquidationEligibility(c0);
    if (!rule.allowed) return null;
    const c = repository.applyLiquidation(id, liquidation);
    if (!c) return null;
    repository.addHistory(id, historyEntry);
    const lifecycle = lifecycleService(); if (lifecycle) lifecycle.liquidateContract(c);
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
