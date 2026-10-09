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
  // Quan hệ thuê chính thức (scope 10/2026): hợp đồng ACTIVE đã bắt đầu — kể cả đã hết hạn (hết hạn chỉ là cảnh báo).
  const holdsPoint = (c, date) => !!c && c.status === 'ACTIVE' && (!c.start || c.start <= (date || A.U.today()));
  service.holdsPointForTrader = function (traderId, date) { return repository.list().some(c => c.traderId === traderId && holdsPoint(c, date)); };
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
  // ---- Trạng thái hiển thị (scope 10/2026): chỉ Chưa hiệu lực / Còn hiệu lực / Đã hết hạn, suy từ ngày ----
  // Hết hạn CHỈ là trạng thái/cảnh báo của hợp đồng: không giải phóng điểm, không đổi hồ sơ, không chờ thanh lý.
  // Hợp đồng dữ liệu cũ đã chấm dứt / chờ thanh lý / đã thanh lý vẫn đọc được, hiển thị chỉ đọc.
  service.DISPLAY_STATUS = {
    UPCOMING: { label: 'Chưa hiệu lực', tone: 'info' },
    ACTIVE: { label: 'Còn hiệu lực', tone: 'ok' },
    EXPIRED: { label: 'Đã hết hạn', tone: 'danger' },
    LEGACY_TERMINATED: { label: 'Đã chấm dứt (dữ liệu cũ)', tone: '', legacy: true },
    LEGACY_PENDING_LIQUIDATION: { label: 'Chờ thanh lý (dữ liệu cũ)', tone: '', legacy: true },
    LEGACY_LIQUIDATED: { label: 'Đã thanh lý (dữ liệu cũ)', tone: '', legacy: true }
  };
  service.displayStatus = function (contract, date) {
    if (!contract) return 'EXPIRED';
    if (contract.status === 'LIQUIDATED') return 'LEGACY_LIQUIDATED';
    if (contract.status === 'PENDING_LIQUIDATION') return contract.endReason === 'EARLY_TERMINATION' ? 'LEGACY_TERMINATED' : 'LEGACY_PENDING_LIQUIDATION';
    const at = date || A.U.today();
    if (contract.start && contract.start > at) return 'UPCOMING';
    if (contract.end && contract.end < at) return 'EXPIRED';
    return 'ACTIVE';
  };
  service.displayStatusLabel = function (contract, date) { return service.DISPLAY_STATUS[service.displayStatus(contract, date)].label; };
  service.expiryNotes = function (contractOrId) {
    const c = typeof contractOrId === 'string' ? repository.getById(contractOrId) : contractOrId;
    return c && Array.isArray(c.expiryNotes) ? c.expiryNotes.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || String(b.id || '').localeCompare(String(a.id || ''))) : [];
  };
  // Theo dõi hết hạn chỉ thêm lịch sử ghi chú, tuyệt đối không sửa ngày,
  // trạng thái hợp đồng, điểm kinh doanh hoặc hồ sơ tiểu thương.
  service.addExpiryNote = function (id, input) {
    const c = repository.getById(id);
    if (!c) return { error: 'NOT_FOUND', message: 'Không tìm thấy hợp đồng.' };
    if (service.displayStatus(c) !== 'EXPIRED') return { error: 'NOT_EXPIRED', message: 'Chỉ được ghi chú cho hợp đồng đã hết hạn.' };
    const content = String(input && input.content || '').trim();
    if (!content) return { error: 'REQUIRED', message: 'Vui lòng nhập nội dung ghi chú.' };
    const createdAt = new Date().toISOString();
    const notes = service.expiryNotes(c);
    const stamp = Date.now();
    let serial = notes.length + 1, noteId = 'GHCH-' + c.id + '-' + stamp + '-' + String(serial).padStart(4, '0');
    while (notes.some(x => x && x.id === noteId)) { serial += 1; noteId = 'GHCH-' + c.id + '-' + stamp + '-' + String(serial).padStart(4, '0'); }
    const note = { id: noteId, contractId: c.id, content, createdBy: String(input && input.createdBy || 'Không rõ'), createdAt };
    if (!repository.addExpiryNote(id, note)) return { error: 'SAVE_FAILED', message: 'Không thể lưu ghi chú hợp đồng.' };
    if (!A.data.save()) {
      c.expiryNotes = (c.expiryNotes || []).filter(x => x !== note);
      return { error: 'SAVE_FAILED', message: 'Không thể lưu ghi chú vào bộ nhớ của trình duyệt.' };
    }
    return { note };
  };
  // Còn hiệu lực và còn ≤ 30 ngày (tính cả ngày kết thúc).
  service.isExpiringSoon = function (contract, date) {
    const at = date || A.U.today();
    return service.displayStatus(contract, at) === 'ACTIVE' && !!contract.end && A.U.days(at, contract.end) <= 30;
  };
  // LEGACY (đã ra khỏi scope 10/2026): gia hạn / chấm dứt / thanh lý không còn entry point UI. Các use case
  // bên dưới chỉ giữ để đọc/kiểm thử dữ liệu cũ; không gọi từ màn hình mới.
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

  // ---- Gia hạn hợp đồng — LEGACY, không còn entry point UI (scope 10/2026) ----
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
  // legacy create command; persistence happens exactly once at the end.
  service.createWithPointAllocation = function (input) {
    const contract = input.contract, traderId = input.traderId, pointId = input.pointId;
    // INVARIANT (tầng service): Contract.market = Trader.market = Point.market, đúng hồ sơ/điểm của hợp đồng. Lệch → null,
    // KHÔNG ghi gì (kiểm tra trước mọi mutation).
    const t = A.idx && A.idx.trader ? A.idx.trader.get(traderId) : null, p = points().get(pointId);
    if (!contract || !contract.market || !t || !p || contract.traderId !== traderId || (contract.businessPointId || contract.stallId) !== pointId
      || t.market !== contract.market || p.market !== contract.market) return null;
    const markets = features.markets && features.markets.service;
    const market = markets && markets.get ? markets.get(contract.market) : null;
    const allowedTraderStates = traders().BUSINESS_STATUS || { WAITING_ALLOCATION: 'WAITING_ALLOCATION', PENDING_CONTRACT: 'PENDING_CONTRACT', ACTIVE: 'ACTIVE' };
    if (!market || market.layoutStatus !== 'SETUP_COMPLETED' || market.status !== 'ACTIVE'
      || ![allowedTraderStates.WAITING_ALLOCATION, allowedTraderStates.PENDING_CONTRACT, allowedTraderStates.ACTIVE].includes(traders().deriveBusinessStatus(t))
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

  // Profile rental drafts may create several normal, one-point contracts at once.
  // Every individual record still goes through createWithPointAllocation; this
  // wrapper pre-validates the whole set and restores the in-memory/persisted
  // aggregates if any later creation fails. This is the strongest atomicity a
  // localStorage prototype can provide (the backend counterpart must be one DB
  // transaction).
  service.createBatchWithPointAllocation = function (inputs) {
    if (!Array.isArray(inputs) || !inputs.length) return null;
    const ids = new Set(), pointsInBatch = new Set();
    for (const input of inputs) {
      const c = input && input.contract, p = input && input.pointId, t = input && input.traderId;
      if (!c || !p || !t || ids.has(c.id) || pointsInBatch.has(p)
        || repository.getById(c.id) || !points().isAvailable(p, c.start, c.end, { market:c.market })) return null;
      ids.add(c.id); pointsInBatch.add(p);
    }
    const snapshot = JSON.parse(JSON.stringify({ contracts: A.db.contracts, stalls: A.db.stalls, traders: A.db.traders }));
    const saved = [];
    try {
      for (const input of inputs) {
        const created = service.createWithPointAllocation(input);
        if (!created) throw new Error('BATCH_CONTRACT_CREATE_FAILED');
        saved.push(created);
      }
      return saved;
    } catch (err) {
      // Mutate existing arrays so all legacy references remain valid.
      ['contracts', 'stalls', 'traders'].forEach(key => { A.db[key].splice(0, A.db[key].length, ...snapshot[key]); });
      A.data.reindex(); A.data.save();
      console.warn('[choso] Batch contract creation rolled back.', err);
      return null;
    }
  };

  // ---- Use case: tạo hợp đồng từ hồ sơ đăng ký thuê (trader.rentalDraft) ----
  // 1 rental item (status pending_contract) = 1 hợp đồng 1 điểm, mỗi dòng có ngày bắt đầu/kết thúc và
  // thời hạn RIÊNG. Giá không nhập tay: priceTerms được chụp từ cấu hình mức thu của chợ tại ngày bắt đầu
  // của từng hợp đồng theo khoản thu đã đăng ký trong hồ sơ (item.charges). Một dòng lỗi → không tạo gì.
  const billingService = () => features.finance && features.finance.billing;
  service.contractDuration = function (start, end) {
    if (!start || !end || end < start) return 0;
    return A.U.days(start, end) + 1;
  };
  service.rentalPriceTerms = function (item, pointRecord, start) {
    const b = billingService();
    if (!b || !b.buildPriceTerms || !pointRecord) return null;
    const ch = Object.assign({}, item && item.charges || {});
    const applies = { electricity: !!ch.electricity, water: !!ch.water, marketService: !!ch.marketService };
    return b.buildPriceTerms(pointRecord.market, pointRecord, pointRecord.area, start || A.U.today(), applies, 'CONTRACT');
  };
  service.pendingRentalItems = function (traderOrId) {
    return traders().rentalItems(traderOrId).filter(x => x && x.status === 'pending_contract' && !x.contractId);
  };
  service.tradersWithPendingRental = function (market) {
    return traders().list().filter(t => t.market === market && service.pendingRentalItems(t).length);
  };
  // Kiểm tra MỘT dòng (dùng chung cho form và submit). Trả về null hoặc { field, message }.
  service.validateRentalRow = function (traderRecord, row, opts) {
    const o = opts || {};
    const item = service.pendingRentalItems(traderRecord).find(x => x.pointId === (row && row.pointId));
    if (!item) return { field: 'point', message: 'Điểm không còn ở trạng thái chờ tạo hợp đồng.' };
    const start = String(row.start || ''), end = String(row.end || '');
    if (!start) return { field: 'start', message: 'Vui lòng nhập ngày bắt đầu.' };
    if (!end) return { field: 'end', message: 'Vui lòng nhập ngày kết thúc.' };
    if (end < start) return { field: 'end', message: 'Ngày kết thúc phải từ ngày bắt đầu trở về sau.' };
    if (service.contractDuration(start, end) <= 0) return { field: 'end', message: 'Thời hạn hợp đồng phải lớn hơn 0.' };
    if (o.datesOnly) return null;
    const p = points().get(item.pointId);
    if (!p || p.market !== traderRecord.market) return { field: 'point', message: 'Điểm kinh doanh không thuộc chợ của hồ sơ.' };
    if (!points().isAvailable(p.id, start, end, { market: p.market })) return { field: 'point', message: 'Điểm ' + p.code + ' đã có hợp đồng trùng thời gian hoặc không còn khả dụng.' };
    const terms = service.rentalPriceTerms(item, p, start);
    if (!terms || !terms.land) return { field: 'point', message: 'Chợ chưa có mức thu mặt bằng áp dụng cho điểm ' + p.code + ' tại ngày bắt đầu.' };
    const ch = item.charges || {};
    const lacking = [ch.electricity && !terms.electricity ? 'đơn giá điện' : '', ch.water && !terms.water ? 'đơn giá nước' : '', ch.marketService && !(terms.services || []).length ? 'mức thu dịch vụ chợ' : ''].filter(Boolean);
    if (lacking.length) return { field: 'point', message: 'Chợ chưa có ' + lacking.join(', ') + ' đang áp dụng tại ngày bắt đầu. Cần cập nhật cấu hình mức thu.' };
    return null;
  };
  // rows: [{ pointId, start, end }] — chỉ các điểm được chọn; điểm không chọn giữ pending_contract.
  // Kết quả: { ok:true, contracts } hoặc { ok:false, message, errors:{ pointId: {field,message} } }.
  service.createFromRentalDraft = function (traderId, rows, opts) {
    const o = opts || {}, t = traders().getProfile ? traders().getProfile(traderId) : (A.idx.trader && A.idx.trader.get(traderId));
    if (!t) return { ok: false, message: 'Không tìm thấy hồ sơ tiểu thương.', errors: {} };
    const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!list.length) return { ok: false, message: 'Vui lòng chọn ít nhất một điểm kinh doanh.', errors: {} };
    if (new Set(list.map(r => r.pointId)).size !== list.length) return { ok: false, message: 'Một điểm chỉ được tạo một hợp đồng.', errors: {} };
    const markets = features.markets && features.markets.service, m = markets && markets.get ? markets.get(t.market) : null;
    if (!m || m.status !== 'ACTIVE' || m.layoutStatus !== 'SETUP_COMPLETED') return { ok: false, message: 'Chợ chưa hoạt động hoặc chưa hoàn tất cấu hình mức thu — chưa thể tạo hợp đồng.', errors: {} };
    const errors = {};
    list.forEach(r => { const e = service.validateRentalRow(t, r); if (e) errors[r.pointId] = e; });
    if (Object.keys(errors).length) return { ok: false, message: 'Có ' + Object.keys(errors).length + ' dòng chưa hợp lệ. Chưa tạo hợp đồng nào.', errors };
    const items = service.pendingRentalItems(t);
    // Mã HĐ tuần tự trong batch (nextId chỉ đọc dữ liệu đã lưu nên phải tự tăng).
    const base = repository.list().reduce((n, c) => Math.max(n, +(String(c.id).match(/-(\d+)$/) || [0, 0])[1]), 0);
    const stamp = A.U.dmy(A.U.today()) + ' ' + A.U.nowTime();
    const inputs = list.map((r, i) => {
      const item = items.find(x => x.pointId === r.pointId), p = points().get(r.pointId);
      const terms = service.rentalPriceTerms(item, p, r.start), ch = item.charges || {};
      const id = 'HĐ-' + t.market + '-' + String(r.start).slice(0, 4) + '-' + A.U.pad(base + 1 + i, 4);
      const contract = {
        id, traderId: t.id, stallId: p.id, businessPointId: p.id, market: t.market, kind: 'Hợp đồng thuê điểm kinh doanh',
        signedDate: r.start, start: r.start, end: r.end,
        monthly: terms.land.monthly, unit: terms.land.amount, unitLabel: terms.land.unit || '',
        feePolicy: { id: terms.land.policyId, amount: terms.land.amount, unit: terms.land.unit || '', legalBasis: { docNo: terms.land.docNo || '' } },
        priceTerms: terms,
        serviceApplicability: { electricity: !!ch.electricity, water: !!ch.water, marketService: !!ch.marketService },
        rentalSource: { traderId: t.id, pointId: p.id, charges: Object.assign({}, ch), feeRefs: Object.assign({}, item.feeRefs || {}) },
        deposit: 0, signedCopies: [], status: 'ACTIVE', endReason: null, createdAt: A.U.today(), createdBy: o.actor || '',
        history: [{ at: stamp, action: 'Khởi tạo hợp đồng', detail: 'Tạo từ hồ sơ đăng ký thuê ' + t.id + ' · ' + A.U.dmy(r.start) + ' → ' + A.U.dmy(r.end), by: o.actor || '' }]
      };
      // Đánh dấu rental item ngay trong unit of work → rollback của batch khôi phục luôn rentalDraft.
      return { contract, traderId: t.id, pointId: p.id,
        pointHistoryEntry: A.U.dmy(A.U.today()) + ': ký ' + id + ' với ' + t.name + ' (' + A.U.dmy(r.start) + ' → ' + A.U.dmy(r.end) + ')',
        beforeSave: c => { const x = (t.rentalDraft || []).find(y => y.pointId === p.id); if (x) { x.status = 'contracted'; x.contractId = c.id; } } };
    });
    const created = service.createBatchWithPointAllocation(inputs);
    if (!created) return { ok: false, message: 'Không thể tạo đầy đủ các hợp đồng; hệ thống đã hoàn tác toàn bộ, chưa có hợp đồng nào được tạo.', errors: {} };
    const lifecycle = lifecycleService(); if (lifecycle && lifecycle.recalculateTrader) lifecycle.recalculateTrader(t.id);
    A.data.save();
    return { ok: true, contracts: created };
  };

  // ---- Lifecycle use cases (Phase 10) — chấm dứt / thanh lý: LEGACY, không còn entry point UI (scope 10/2026) ----
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
  // LEGACY / NOT EXPOSED IN UI: bản ký số hóa đã retire cùng popup Hợp đồng cũ (quyền cap-nhat-ban-ky đã ẩn).
  // Giữ để tương thích dữ liệu cũ (contract.signedCopies vẫn được đọc ở trang tiểu thương).
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
