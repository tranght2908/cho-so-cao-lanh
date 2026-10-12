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
  // EXPIRED = "Hết hạn – chờ xử lý" (Giai đoạn A, 10/2026): giữ nguyên kể cả khi đã xác nhận tiếp tục sử dụng.
  service.DISPLAY_STATUS = {
    UPCOMING: { label: 'Chưa hiệu lực', tone: 'info' },
    ACTIVE: { label: 'Còn hiệu lực', tone: 'ok' },
    EXPIRED: { label: 'Hết hạn – chờ xử lý', tone: 'danger' },
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
  // ---- Xác nhận tình trạng sử dụng của hợp đồng hết hạn – chờ xử lý (Giai đoạn A, 10/2026) ----
  // contract.continuations[] lưu RIÊNG với expiryNotes: CONTINUING {from, until} = vẫn kinh doanh trong khoảng đã
  // xác nhận; STOPPED {stoppedOn} = đã ngừng sử dụng (cần xử lý chấm dứt/quyết toán ở Giai đoạn C). Ngày hiệu lực
  // (from/until/stoppedOn) tách khỏi thời điểm thao tác (confirmedAt / voidedAt). Không xóa vật lý: hủy = voidedAt.
  // Chỉ bản ghi chưa hủy là thời gian sử dụng hợp lệ. KHÔNG đổi trạng thái hợp đồng, điểm KD hay hồ sơ tiểu thương.
  // Giai đoạn B (10/2026): tính phí dùng chargeCoverage() theo NGÀY LỊCH; bản ghi DỰ KIẾN (CONTINUING basis PLANNED,
  // PLANNED_STOP) là căn cứ tính phí nhưng không đổi trạng thái HĐ/điểm/hồ sơ; bản thay thế (supersededAt) không còn hợp lệ;
  // xác nhận đã dùng cho khoản phát hành không hủy được; chênh lệch sau phát hành chỉ ghi dấu vết (settlementFlags).
  const CONTINUATION_PERMISSION = service.CONTINUATION_PERMISSION = 'hop-dong.xac-nhan-su-dung';
  const CONTINUATION_MAX_MONTHS = service.CONTINUATION_MAX_MONTHS = 3;
  const CONTINUATION_WARN_DAYS = service.CONTINUATION_WARN_DAYS = 7;
  // Căn cứ bắt buộc của bản ghi DỰ KIẾN (tiếp tục sử dụng trước ngày hết hạn / dự kiến ngừng sử dụng).
  service.EVIDENCE_TYPES = [['APPLICATION', 'Đơn đề nghị gia hạn'], ['COMMITMENT', 'Cam kết của tiểu thương'], ['MINUTES', 'Biên bản làm việc'], ['OTHER', 'Khác']];
  const evidenceLabel = service.evidenceLabel = code => (service.EVIDENCE_TYPES.find(x => x[0] === code) || [null, ''])[1];
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  // Ngày cuối được phép của một lần xác nhận: from + 3 tháng − 1 ngày (cuối tháng được kẹp: 31/10 → 30/01).
  const maxUntil = from => {
    const [y, m, d] = from.split('-').map(Number), last = new Date(Date.UTC(y, m - 1 + CONTINUATION_MAX_MONTHS + 1, 0)).getUTCDate();
    return addDays(new Date(Date.UTC(y, m - 1 + CONTINUATION_MAX_MONTHS, Math.min(d, last))).toISOString().slice(0, 10), -1);
  };
  const isIsoDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(Date.parse(v + 'T00:00:00Z'));
  service.USAGE_STATE = {
    UNCONFIRMED: { label: 'Chưa xác nhận tình trạng sử dụng', tone: 'danger' },
    CONFIRMED: { label: 'Đã xác nhận tiếp tục sử dụng', tone: 'ok' },
    EXPIRING: { label: 'Xác nhận sắp hết hạn', tone: 'warn' },
    LAPSED: { label: 'Xác nhận đã hết hiệu lực', tone: 'danger' },
    PLANNED_STOP: { label: 'Dự kiến ngừng sử dụng – cần kiểm tra thực tế', tone: 'warn' },
    STOPPED: { label: 'Đã ngừng sử dụng – cần xử lý chấm dứt', tone: 'warn' },
    ENDING_UNCOVERED: { label: 'Sắp hết hạn trong tháng mặt bằng – chưa xác nhận', tone: 'danger' },
    ENDING_PLANNED: { label: 'Đã xác nhận dự kiến tiếp tục sử dụng', tone: 'info' },
    ENDING_PLANNED_STOP: { label: 'Dự kiến ngừng sử dụng khi hết hạn', tone: 'info' }
  };
  const getContract = x => typeof x === 'string' ? repository.getById(x) : x;
  const marketPeriod = () => features.finance && features.finance.marketPeriod;
  // Hợp đồng ở trạng thái "Hết hạn – chờ xử lý" (ACTIVE, đã qua ngày kết thúc). Dữ liệu cũ chấm dứt/thanh lý không thuộc diện này.
  service.isExpiredPending = function (contractOrId, date) {
    const c = getContract(contractOrId);
    return !!c && c.status === 'ACTIVE' && service.displayStatus(c, date) === 'EXPIRED';
  };
  service.overdueDays = function (contractOrId, date) {
    const c = getContract(contractOrId);
    return service.isExpiredPending(c, date) ? A.U.days(c.end, date || A.U.today()) : 0;
  };
  // Hợp đồng CÒN HIỆU LỰC nhưng ngày kết thúc rơi trước ngày cuối tháng mặt bằng N+1 của một kỳ thu đang mở
  // (chưa phát hành, chưa chốt) của chợ → Tổ trưởng được xác nhận DỰ KIẾN trước ngày hết hạn. Trả về kỳ sớm nhất.
  service.endingLandMonth = function (contractOrId, date) {
    const c = getContract(contractOrId), at = date || A.U.today(), MP = marketPeriod();
    if (!c || !MP || c.status !== 'ACTIVE' || !c.end || service.displayStatus(c, at) !== 'ACTIVE') return null;
    const hit = (A.db.billingPeriods || []).filter(p => p && p.marketId === c.market && !MP.isIssued(p) && !MP.isClosed(p))
      .map(p => ({ period: p, range: MP.monthRange(MP.landMonth(p)) })).filter(x => x.range.to && c.end < x.range.to)
      .sort((a, b) => a.range.to.localeCompare(b.range.to))[0];
    return hit ? { period: hit.period, periodId: hit.period.id, landFrom: hit.range.from, landTo: hit.range.to } : null;
  };
  // Toàn bộ lịch sử (kể cả đã hủy / bị thay thế), mới nhất trước.
  service.continuations = function (contractOrId) {
    const c = getContract(contractOrId);
    return c && Array.isArray(c.continuations) ? c.continuations.slice().sort((a, b) => String(b.confirmedAt || '').localeCompare(String(a.confirmedAt || '')) || String(b.id || '').localeCompare(String(a.id || ''))) : [];
  };
  // Bản ghi HỢP LỆ = chưa hủy và chưa bị thay thế; theo thứ tự thời gian hiệu lực. Chỉ bản hợp lệ là căn cứ tính phí.
  const isValid = r => !!r && !r.voidedAt && !r.supersededAt;
  service.isValidContinuation = isValid;
  service.isPlanned = r => !!r && (r.kind === 'PLANNED_STOP' || (r.kind === 'CONTINUING' && r.basis === 'PLANNED'));
  service.validContinuations = function (contractOrId) {
    const c = getContract(contractOrId);
    return (c && Array.isArray(c.continuations) ? c.continuations : []).filter(isValid)
      .slice().sort((a, b) => String(a.from || a.stoppedOn || '').localeCompare(String(b.from || b.stoppedOn || '')) || String(a.confirmedAt || '').localeCompare(String(b.confirmedAt || '')));
  };
  service.latestContinuation = function (contractOrId) {
    const v = service.validContinuations(contractOrId);
    return v.length ? v[v.length - 1] : null;
  };
  service.stoppedRecord = function (contractOrId) {
    return service.validContinuations(contractOrId).find(x => x.kind === 'STOPPED') || null;
  };
  service.plannedStopRecord = function (contractOrId) {
    return service.validContinuations(contractOrId).find(x => x.kind === 'PLANNED_STOP') || null;
  };
  // Ngày cuối đã xác nhận tiếp tục sử dụng liên tục (thực tế hoặc dự kiến; = ngày kết thúc HĐ nếu chưa có).
  service.confirmedThrough = function (contractOrId) {
    const c = getContract(contractOrId);
    if (!c) return null;
    return service.validContinuations(c).filter(x => x.kind === 'CONTINUING').reduce((m, x) => x.until > m ? x.until : m, c.end);
  };
  // Khoảng sử dụng hợp lệ của hợp đồng (NGÀY LỊCH thực tế): [start, end]. end = ngày trước ngày ngừng thực tế
  // (STOPPED), nếu không thì ngày trước ngày dự kiến ngừng (PLANNED_STOP), nếu không thì ngày cuối đã xác nhận.
  // closed = khoảng đã được khép (không còn chờ xác nhận thêm) bởi STOPPED / PLANNED_STOP.
  // G1 (10/2026): bản DỰ KIẾN ngừng chỉ là căn cứ kết thúc khi ngày dự kiến ngừng còn SAU ngày đánh giá (asOf = ngày tính
  // dự kiến / ngày phát hành). Tới hoặc qua ngày đó mà chưa ghi nhận thực tế → không còn là căn cứ: khoảng sau phần đã có
  // căn cứ là THIẾU căn cứ (unverifiedPlan) — không suy luận đã ngừng, cũng không suy luận còn thuê.
  service.usageCoverage = function (contractOrId, asOf) {
    const c = getContract(contractOrId);
    if (!c || !c.start) return null;
    const at = asOf || A.U.today();
    const stop = service.stoppedRecord(c), plan = !stop && service.plannedStopRecord(c), through = service.confirmedThrough(c);
    const planDue = !!plan && plan.plannedStopOn <= at, closer = stop || (plan && !planDue ? plan : null);
    const end = closer ? addDays(closer.kind === 'STOPPED' ? closer.stoppedOn : closer.plannedStopOn, -1) : through;
    return { start: c.start, end: closer && through && end > through ? through : end, closed: !!closer, closedBy: closer ? closer.kind : null, closer,
      unverifiedPlan: planDue ? plan : null, evaluatedAt: at };
  };
  const recordSnapshot = r => ({ id: r.id, kind: r.kind, basis: r.kind === 'CONTINUING' ? (r.basis || 'ACTUAL') : r.kind === 'PLANNED_STOP' ? 'PLANNED' : 'ACTUAL',
    from: r.from || null, until: r.until || null, plannedStopOn: r.plannedStopOn || null, stoppedOn: r.stoppedOn || null,
    evidence: r.evidence || null, note: r.note || '', confirmedBy: r.confirmedBy || '', confirmedByAccountId: r.confirmedByAccountId || null,
    confirmedAt: r.confirmedAt || null, verifiedAt: r.verifiedAt || null, verifiedBy: r.verifiedBy || null });
  // Helper DÙNG CHUNG cho tính phí: khoảng [from, to] (ngày lịch) của một khoản thu được hợp đồng + xác nhận hợp lệ
  // phủ tới đâu. applicable=false: hợp đồng không phát sinh khoản này (chưa bắt đầu / đã khép trước khoảng).
  // gap ≠ null: phần sau ngày kết thúc HĐ chưa có căn cứ → khoản thu chưa đủ điều kiện (cảnh báo chặn).
  // billTo: ngày cuối được tính tiền (giới hạn bởi khoảng đã phủ). recordIds/records: căn cứ đã dùng (để lưu dấu vết).
  // asOf: ngày đánh giá (mặc định ngày nghiệp vụ hiện tại) — chỉ ảnh hưởng tới bản dự kiến ngừng (xem usageCoverage).
  service.chargeCoverage = function (contractOrId, from, to, asOf) {
    const c = getContract(contractOrId), at = asOf || A.U.today();
    if (!c || !c.start || !from || !to || to < from) return { applicable: false };
    const effFrom = c.start > from ? c.start : from;
    if (effFrom > to) return { applicable: false };
    if (!c.end || c.end >= to) return { applicable: true, covered: true, effFrom, billTo: to, gap: null, basis: 'CONTRACT', closedBy: null, planned: false, recordIds: [], records: [], contractEnd: c.end || null, evaluatedAt: at, unverifiedPlan: null };
    const cov = service.usageCoverage(c, at), lastDay = cov.end;
    if (cov.closed && lastDay < effFrom) return { applicable: false, closedBefore: true, closedBy: cov.closedBy };
    const billTo = lastDay >= to ? to : lastDay >= effFrom ? lastDay : null;
    const gap = !cov.closed && lastDay < to ? { from: lastDay >= effFrom ? addDays(lastDay, 1) : effFrom, to } : null;
    const after = addDays(c.end, 1), used = service.validContinuations(c).filter(r => r.kind === 'CONTINUING'
      ? billTo && r.from <= billTo && r.until >= (effFrom > after ? effFrom : after)
      : r === cov.closer && (r.kind === 'STOPPED' ? r.stoppedOn : r.plannedStopOn) <= addDays(to, 1));
    const planned = used.some(service.isPlanned);
    const unverifiedPlan = gap && cov.unverifiedPlan ? recordSnapshot(cov.unverifiedPlan) : null;
    return { applicable: true, covered: !gap, effFrom, billTo, gap, closedBy: cov.closedBy, planned,
      basis: used.length ? (planned ? 'PLANNED' : 'ACTUAL') : 'CONTRACT', recordIds: used.map(r => r.id), records: used.map(recordSnapshot), contractEnd: c.end,
      evaluatedAt: at, unverifiedPlan };
  };
  // Tương thích Giai đoạn A: khoảng [from, to] được phủ bởi hợp đồng + xác nhận hợp lệ (khép tại ngày ngừng / dự kiến ngừng).
  service.coveredRange = function (contractOrId, from, to) {
    const c = getContract(contractOrId);
    if (!c || !c.start || !from || !to || to < from) return { covered: false, coveredTo: null, gapFrom: from || null, gapTo: to || null };
    const cov = service.usageCoverage(c), end = c.end && cov.end > c.end ? cov.end : (cov.closed ? cov.end : c.end);
    if (c.start > from) return { covered: false, coveredTo: null, gapFrom: from, gapTo: to < c.start ? to : addDays(c.start, -1) };
    if (!end || end >= to) return { covered: true, coveredTo: to, gapFrom: null, gapTo: null };
    return { covered: false, coveredTo: end >= from ? end : null, gapFrom: end >= from ? addDays(end, 1) : from, gapTo: to };
  };
  service.usageState = function (contractOrId, date) {
    const c = getContract(contractOrId), at = date || A.U.today();
    if (!c || c.status !== 'ACTIVE') return null;
    if (service.isExpiredPending(c, at)) {
      if (service.stoppedRecord(c)) return 'STOPPED';
      if (service.plannedStopRecord(c)) return 'PLANNED_STOP';
      const through = service.confirmedThrough(c);
      if (through === c.end) return 'UNCONFIRMED';
      if (through < at) return 'LAPSED';
      return A.U.days(at, through) <= CONTINUATION_WARN_DAYS ? 'EXPIRING' : 'CONFIRMED';
    }
    const em = service.endingLandMonth(c, at);
    if (!em) return null;
    if (service.plannedStopRecord(c)) return 'ENDING_PLANNED_STOP';
    return service.confirmedThrough(c) >= em.landTo ? 'ENDING_PLANNED' : 'ENDING_UNCOVERED';
  };
  // Bản ghi dự kiến cần Tổ trưởng kiểm tra lại thực tế (sau ngày hết hạn; dự kiến ngừng đã tới ngày).
  service.plannedToVerify = function (contractOrId, date) {
    const c = getContract(contractOrId), at = date || A.U.today();
    if (!service.isExpiredPending(c, at)) return [];
    return service.validContinuations(c).filter(r => !r.verifiedAt && (r.kind === 'CONTINUING' ? r.basis === 'PLANNED' : r.kind === 'PLANNED_STOP' && r.plannedStopOn <= at));
  };
  // Ngày bắt đầu bắt buộc của lần xác nhận kế tiếp (liên tục): ngày sau ngày cuối đã xác nhận / ngày hết hạn.
  service.nextContinuationFrom = function (contractOrId) {
    const c = getContract(contractOrId);
    return c && c.end ? addDays(service.confirmedThrough(c), 1) : null;
  };
  service.continuationMaxUntil = function (from) { return isIsoDate(from) ? maxUntil(from) : null; };
  const canConfirm = c => !!c && !!A.canDo && A.canDo(CONTINUATION_PERMISSION, c.market);
  service.canConfirmContinuation = function (contractOrId) { return canConfirm(getContract(contractOrId)); };
  // Chế độ xác nhận cho hợp đồng tại ngày xét: EXPIRED (thực tế) | ENDING (dự kiến trước ngày hết hạn) | null.
  service.continuationMode = function (contractOrId, date) {
    const c = getContract(contractOrId), at = date || A.U.today();
    if (service.isExpiredPending(c, at)) return 'EXPIRED';
    return service.endingLandMonth(c, at) ? 'ENDING' : null;
  };
  // Kiểm tra dùng chung cho form và service. Trả về null hoặc { field, message }.
  //   EXPIRED: CONTINUING (thực tế) / PLANNED_STOP / STOPPED. ENDING: CONTINUING (dự kiến) / PLANNED_STOP.
  //   Bản ghi dự kiến bắt buộc căn cứ. Đã ngừng thực tế → không nhận thêm. Có dự kiến ngừng → bản thực tế mới thay thế nó.
  service.validateContinuation = function (contractOrId, input, date) {
    const c = getContract(contractOrId), at = date || A.U.today(), x = input || {};
    if (!c) return { field: 'form', message: 'Không tìm thấy hợp đồng.' };
    const mode = service.continuationMode(c, at);
    if (!mode) return { field: 'form', message: 'Chỉ xác nhận cho hợp đồng Hết hạn – chờ xử lý hoặc sắp hết hạn trong tháng mặt bằng của kỳ thu đang mở.' };
    if (service.stoppedRecord(c)) return { field: 'form', message: 'Hợp đồng đã được xác nhận ngừng sử dụng. Không thể xác nhận tiếp tục sử dụng; cần xử lý gia hạn hoặc chấm dứt hợp đồng.' };
    const kinds = mode === 'EXPIRED' ? ['CONTINUING', 'PLANNED_STOP', 'STOPPED'] : ['CONTINUING', 'PLANNED_STOP'];
    if (kinds.indexOf(x.kind) === -1) return { field: 'kind', message: 'Vui lòng chọn tình trạng thực tế.' };
    if (x.kind === 'PLANNED_STOP' && service.plannedStopRecord(c)) return { field: 'kind', message: 'Hợp đồng đã có dự kiến ngừng sử dụng. Hủy bản dự kiến hoặc ghi nhận tình trạng thực tế.' };
    const expected = service.nextContinuationFrom(c), first = addDays(c.end, 1);
    if (x.kind === 'CONTINUING') {
      if (!isIsoDate(x.from)) return { field: 'from', message: 'Vui lòng nhập ngày bắt đầu tiếp tục sử dụng.' };
      if (x.from !== expected) return { field: 'from', message: 'Khoảng xác nhận phải liên tục: ngày bắt đầu phải là ' + A.U.dmy(expected) + ' (ngày sau ' + (expected === first ? 'ngày hết hạn hợp đồng' : 'ngày cuối của xác nhận trước') + ').' };
      if (!isIsoDate(x.until)) return { field: 'until', message: 'Vui lòng nhập ngày xác nhận sử dụng đến.' };
      if (x.until < x.from) return { field: 'until', message: 'Ngày xác nhận sử dụng đến phải từ ngày bắt đầu trở về sau.' };
      if (x.until > maxUntil(x.from)) return { field: 'until', message: 'Mỗi lần xác nhận tối đa ' + CONTINUATION_MAX_MONTHS + ' tháng (đến ' + A.U.dmy(maxUntil(x.from)) + ').' };
    } else {
      const key = x.kind === 'STOPPED' ? 'stoppedOn' : 'plannedStopOn', label = x.kind === 'STOPPED' ? 'ngừng sử dụng' : 'dự kiến ngừng sử dụng';
      if (!isIsoDate(x[key])) return { field: key, message: 'Vui lòng nhập ngày ' + label + '.' };
      if (x[key] < first) return { field: key, message: 'Ngày ' + label + ' phải sau ngày hết hạn hợp đồng (từ ' + A.U.dmy(first) + ').' };
      if (x.kind === 'STOPPED' && x[key] > at) return { field: key, message: 'Ngày ngừng sử dụng không được sau ngày hiện tại.' };
      // G1: dự kiến ngừng chỉ dành cho ngày TƯƠNG LAI; ngày đã tới / đã qua phải ghi nhận ngừng sử dụng thực tế (có kiểm chứng).
      if (x.kind === 'PLANNED_STOP' && x[key] <= at) return { field: key, message: 'Ngày dự kiến ngừng sử dụng phải sau ngày hiện tại. Nếu tiểu thương đã ngừng, ghi nhận "Đã ngừng sử dụng" (thực tế).' };
      if (x[key] > expected) return { field: key, message: 'Khoảng từ ' + A.U.dmy(expected) + ' chưa được xác nhận. Ngày ' + label + ' không được sau ' + A.U.dmy(expected) + '.' };
    }
    const planned = x.kind === 'PLANNED_STOP' || (x.kind === 'CONTINUING' && mode === 'ENDING');
    if (planned && !evidenceLabel(x.evidence)) return { field: 'evidence', message: 'Vui lòng chọn căn cứ của xác nhận dự kiến.' };
    if (!String(x.note || '').trim()) return { field: 'note', message: 'Vui lòng nhập ghi chú/lý do.' };
    return null;
  };
  const actorOf = () => { const a = A.currentAccount && A.currentAccount() || {}; return { name: a.fullName || a.name || a.id || 'Không rõ', id: a.id || null }; };
  const stampOf = iso => A.U.dmy(iso.slice(0, 10)) + ' ' + iso.slice(11, 16);
  function persistOrRollback(undo) {
    if (A.data.save()) return true;
    undo(); return false;
  }
  const recText = r => r.kind === 'CONTINUING' ? A.U.dmy(r.from) + ' → ' + A.U.dmy(r.until) + (r.basis === 'PLANNED' ? ' (dự kiến)' : '')
    : r.kind === 'PLANNED_STOP' ? 'dự kiến ngừng từ ' + A.U.dmy(r.plannedStopOn) : 'ngừng sử dụng từ ' + A.U.dmy(r.stoppedOn);
  service.continuationText = recText;
  // Bản ghi đã được dùng làm căn cứ cho khoản phải thu ĐÃ PHÁT HÀNH (suy ra từ coverage.recordIds trên dòng thu).
  service.usedForIssuance = function (recordId) {
    return (A.db.invoices || []).some(i => i && i.billingStatus !== 'DRAFT' && (i.items || []).some(it => it && it.coverage && (it.coverage.recordIds || []).indexOf(recordId) !== -1));
  };
  // Sau mỗi thay đổi căn cứ: tính lại các kỳ còn tính được của CHỢ đó (không đụng kỳ đã phát hành / đã chốt).
  const recalcMarket = market => { const MP = marketPeriod(); if (MP && MP.recalculateMarket) MP.recalculateMarket(market); };
  function nextRecordId(c) {
    let n = (Array.isArray(c.continuations) ? c.continuations.length : 0) + 1, id = 'XNSD-' + c.id + '-' + String(n).padStart(3, '0');
    while ((c.continuations || []).some(r => r && r.id === id)) { n += 1; id = 'XNSD-' + c.id + '-' + String(n).padStart(3, '0'); }
    return id;
  }
  service.confirmContinuation = function (id, input, date) {
    const c = repository.getById(id), at = date || A.U.today();
    if (!c) return { error: 'NOT_FOUND', message: 'Không tìm thấy hợp đồng.' };
    if (!canConfirm(c)) return { error: 'FORBIDDEN', message: 'Bạn không có quyền xác nhận tình trạng sử dụng của hợp đồng này.' };
    const x = Object.assign({}, input || {});
    const invalid = service.validateContinuation(c, x, at);
    if (invalid) return { error: 'INVALID', field: invalid.field, message: invalid.message };
    const mode = service.continuationMode(c, at), actor = actorOf(), confirmedAt = new Date().toISOString(), recId = nextRecordId(c);
    const base = { id: recId, contractId: c.id, kind: x.kind, note: String(x.note).trim(), confirmedBy: actor.name, confirmedByAccountId: actor.id, confirmedAt };
    const record = x.kind === 'CONTINUING' ? Object.assign(base, { basis: mode === 'ENDING' ? 'PLANNED' : 'ACTUAL', from: x.from, until: x.until })
      : x.kind === 'PLANNED_STOP' ? Object.assign(base, { plannedStopOn: x.plannedStopOn, from: x.plannedStopOn, until: null })
      : Object.assign(base, { stoppedOn: x.stoppedOn, from: x.stoppedOn, until: null });
    if (service.isPlanned(record)) record.evidence = x.evidence;
    // Thực tế khác dự kiến ngừng: bản ghi mới THAY THẾ (không hủy) bản dự kiến, giữ nguyên lịch sử.
    const replaced = x.kind !== 'PLANNED_STOP' ? service.plannedStopRecord(c) : null, replacedBefore = replaced && Object.assign({}, replaced);
    if (replaced) { Object.assign(replaced, { supersededAt: confirmedAt, supersededBy: actor.name, supersededById: recId, supersedeReason: record.note }); record.supersedes = replaced.id; }
    const action = x.kind === 'CONTINUING' ? (record.basis === 'PLANNED' ? 'Xác nhận dự kiến tiếp tục sử dụng' : 'Xác nhận tiếp tục sử dụng') : x.kind === 'PLANNED_STOP' ? 'Xác nhận dự kiến ngừng sử dụng' : 'Xác nhận ngừng sử dụng';
    const entry = { at: stampOf(confirmedAt), action, by: actor.name,
      detail: recText(record) + (record.evidence ? ' · Căn cứ: ' + evidenceLabel(record.evidence) : '') + ' · ' + record.note + (replaced ? ' · Thay thế ' + replaced.id : '') + ' (' + recId + ')' };
    if (!repository.addContinuation(c.id, record)) return { error: 'SAVE_FAILED', message: 'Không thể lưu xác nhận.' };
    repository.addHistory(c.id, entry);
    const flags = service.detectSettlementDiffs(c, record);
    const undo = () => {
      c.continuations = c.continuations.filter(r => r !== record); c.history = c.history.filter(h => h !== entry);
      if (replaced) { ['supersededAt', 'supersededBy', 'supersededById', 'supersedeReason'].forEach(k => delete replaced[k]); Object.assign(replaced, replacedBefore); }
      if (flags.length) { c.settlementFlags = c.settlementFlags.filter(f => flags.indexOf(f) === -1); flags.forEach(f => (f.previous || []).forEach(p => { p.status = 'OPEN'; delete p.supersededByFlagId; })); }
    };
    if (!persistOrRollback(undo)) return { error: 'SAVE_FAILED', message: 'Không thể lưu xác nhận vào bộ nhớ của trình duyệt.' };
    recalcMarket(c.market);
    return { record, replaced: replaced || null, settlementFlags: flags };
  };
  // Tổ trưởng kiểm tra bản DỰ KIẾN sau ngày hết hạn và thấy đúng thực tế:
  //   CONTINUING dự kiến → ghi verifiedAt (ngày hiệu lực không đổi);
  //   PLANNED_STOP đã tới ngày → ghi nhận ngừng thực tế (STOPPED cùng ngày, thay thế bản dự kiến).
  service.verifyPlanned = function (id, recordId, input) {
    const c = repository.getById(id);
    if (!c) return { error: 'NOT_FOUND', message: 'Không tìm thấy hợp đồng.' };
    if (!canConfirm(c)) return { error: 'FORBIDDEN', message: 'Bạn không có quyền xác nhận tình trạng sử dụng của hợp đồng này.' };
    const rec = (c.continuations || []).find(r => r && r.id === recordId);
    if (!rec || !isValid(rec) || !service.isPlanned(rec)) return { error: 'INVALID', message: 'Chỉ kiểm tra bản ghi dự kiến còn hiệu lực.' };
    if (!service.isExpiredPending(c)) return { error: 'INVALID', message: 'Chỉ kiểm tra thực tế sau ngày hợp đồng hết hạn.' };
    const note = String(input && input.note || '').trim() || 'Kiểm tra thực tế: đúng như dự kiến';
    if (rec.kind === 'PLANNED_STOP') {
      if (rec.plannedStopOn > A.U.today()) return { error: 'INVALID', message: 'Chưa tới ngày dự kiến ngừng sử dụng (' + A.U.dmy(rec.plannedStopOn) + ').' };
      return service.confirmContinuation(c.id, { kind: 'STOPPED', stoppedOn: rec.plannedStopOn, note });
    }
    const actor = actorOf(), verifiedAt = new Date().toISOString();
    Object.assign(rec, { verifiedAt, verifiedBy: actor.name, verifiedById: actor.id, verifyNote: note });
    const entry = { at: stampOf(verifiedAt), action: 'Kiểm tra thực tế xác nhận dự kiến', detail: rec.id + ' (' + recText(rec) + ') · ' + note, by: actor.name };
    repository.addHistory(c.id, entry);
    if (!persistOrRollback(() => { ['verifiedAt', 'verifiedBy', 'verifiedById', 'verifyNote'].forEach(k => delete rec[k]); c.history = c.history.filter(h => h !== entry); })) return { error: 'SAVE_FAILED', message: 'Không thể lưu vào bộ nhớ của trình duyệt.' };
    return { record: rec };
  };
  // Chỉ hủy được bản ghi hợp lệ MỚI NHẤT (giữ tính liên tục) và CHƯA được dùng để phát hành khoản thu. Bản đã dùng
  // chỉ được thay đổi bằng bản ghi tình trạng thực tế mới (phát sinh dấu vết chênh lệch), không hủy trực tiếp.
  service.canVoidContinuation = function (contractOrId, recordId) {
    const c = getContract(contractOrId), last = service.latestContinuation(c);
    return !!c && c.status === 'ACTIVE' && canConfirm(c) && !!last && last.id === recordId && !service.usedForIssuance(recordId);
  };
  service.voidContinuation = function (id, recordId, input) {
    const c = repository.getById(id);
    if (!c) return { error: 'NOT_FOUND', message: 'Không tìm thấy hợp đồng.' };
    if (!canConfirm(c)) return { error: 'FORBIDDEN', message: 'Bạn không có quyền hủy xác nhận của hợp đồng này.' };
    const rec = (c.continuations || []).find(r => r && r.id === recordId);
    if (!rec) return { error: 'NOT_FOUND', message: 'Không tìm thấy bản ghi xác nhận.' };
    if (rec.voidedAt) return { error: 'ALREADY_VOIDED', message: 'Bản ghi xác nhận này đã được hủy.' };
    if (rec.supersededAt) return { error: 'SUPERSEDED', message: 'Bản ghi đã được thay thế bởi ' + rec.supersededById + '.' };
    if (c.status !== 'ACTIVE') return { error: 'INVALID', message: 'Chỉ hủy xác nhận của hợp đồng đang theo dõi.' };
    if (service.latestContinuation(c).id !== rec.id) return { error: 'NOT_LATEST', message: 'Chỉ được hủy bản ghi xác nhận mới nhất để giữ khoảng xác nhận liên tục.' };
    if (service.usedForIssuance(rec.id)) return { error: 'USED_FOR_ISSUANCE', message: 'Xác nhận đã được dùng làm căn cứ cho khoản phải thu đã phát hành, không thể hủy. Hãy ghi nhận tình trạng thực tế mới.' };
    const reason = String(input && input.reason || '').trim();
    if (!reason) return { error: 'REQUIRED', field: 'reason', message: 'Vui lòng nhập lý do hủy xác nhận.' };
    const actor = actorOf(), voidedAt = new Date().toISOString(), before = Object.assign({}, rec);
    Object.assign(rec, { voidedAt, voidedBy: actor.name, voidedByAccountId: actor.id, voidReason: reason });
    const entry = { at: stampOf(voidedAt), action: 'Hủy xác nhận sử dụng', detail: rec.id + ' (' + recText(rec) + ') · Lý do: ' + reason, by: actor.name };
    repository.addHistory(c.id, entry);
    if (!persistOrRollback(() => { ['voidedAt', 'voidedBy', 'voidedByAccountId', 'voidReason'].forEach(k => delete rec[k]); Object.assign(rec, before); c.history = c.history.filter(h => h !== entry); })) return { error: 'SAVE_FAILED', message: 'Không thể lưu vào bộ nhớ của trình duyệt.' };
    recalcMarket(c.market);
    return { record: rec };
  };
  // ---- Chênh lệch sau phát hành (Giai đoạn B: chỉ phát hiện + lưu dấu vết; xử lý thuộc Giai đoạn C) ----
  // So dòng MẶT BẰNG đã phát hành (coverage.billTo đã chụp) với khoảng sử dụng hợp lệ HIỆN TẠI của tháng đó.
  // Lệch ngày nhưng cùng số ngày quy ước (vd 30/12 ↔ 31/12) → không phát sinh tiền, không ghi. Điện/nước là số đo thực
  // tế, dịch vụ thu trọn tháng (giả định) → không phát sinh chênh lệch theo ngày. Chống trùng: (khoản phải thu, dòng, căn cứ).
  service.SETTLEMENT_STATUS = { OPEN: 'Chờ quyết toán', SUPERSEDED: 'Đã được thay bằng chênh lệch mới' };
  service.settlementFlags = function (contractOrId) {
    const c = getContract(contractOrId);
    return c && Array.isArray(c.settlementFlags) ? c.settlementFlags.slice().sort((a, b) => String(b.detectedAt || '').localeCompare(String(a.detectedAt || ''))) : [];
  };
  service.detectSettlementDiffs = function (contractOrId, cause) {
    const c = getContract(contractOrId), B = features.finance && features.finance.billing, out = [];
    if (!c || !B || !B.landBillableDays || !B.landAmount) return out;
    const monthRange = m => { const [y, mo] = m.split('-').map(Number); return { from: m + '-01', to: new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10) }; };
    const flags = Array.isArray(c.settlementFlags) ? c.settlementFlags : null, actor = actorOf(), detectedAt = new Date().toISOString();
    (A.db.invoices || []).filter(i => i && i.billingStatus !== 'DRAFT' && (i.contractIds || [i.contractId]).indexOf(c.id) !== -1).forEach(inv => (inv.items || []).forEach(it => {
      if (!it || it.chargeType !== 'LAND' || it.contractId !== c.id || !it.coverage || !it.chargeMonth) return;
      const r = monthRange(it.chargeMonth), now = service.chargeCoverage(c, r.from, r.to);
      const actualTo = now.applicable ? now.billTo : null, billedTo = it.coverage.billTo;
      if (actualTo === billedTo) return;
      const days = to => to ? B.landBillableDays({ start: c.start, end: to }, it.chargeMonth) : 0;
      const billedDays = Number(it.billableDays != null ? it.billableDays : days(billedTo)), actualDays = days(actualTo), diff = actualDays - billedDays;
      if (!diff) return;
      const key = [inv.id, it.id, cause && cause.id].join('|'), list = c.settlementFlags || (c.settlementFlags = []);
      if (list.some(f => f.key === key)) return;
      const previous = list.filter(f => f.invoiceId === inv.id && f.itemId === it.id && f.status === 'OPEN');
      let n = list.length + 1, flagId = 'CLQT-' + c.id + '-' + String(n).padStart(3, '0');
      while (list.some(f => f.id === flagId)) { n += 1; flagId = 'CLQT-' + c.id + '-' + String(n).padStart(3, '0'); }
      const flag = { id: flagId, key, contractId: c.id, traderId: c.traderId, market: c.market, invoiceId: inv.id, itemId: it.id, billingPeriodId: inv.billingPeriodId || null,
        chargeType: 'LAND', month: it.chargeMonth, billedTo, actualTo, billedDays, actualDays, diffDays: diff, direction: diff > 0 ? 'UNDER' : 'OVER',
        unitPrice: Number(it.unitPrice || 0), unit: it.unit || '', quantity: Number(it.quantity || 0),
        amountEstimate: B.landAmount({ unit: it.unit, amount: it.unitPrice }, Number(it.quantity || 0), Math.abs(diff)),
        causeRecordId: cause ? cause.id : null, causeKind: cause ? cause.kind : null, billedRecordIds: (it.coverage.recordIds || []).slice(),
        detectedAt, detectedBy: actor.name, status: 'OPEN', resolution: null };
      previous.forEach(p => { p.status = 'SUPERSEDED'; p.supersededByFlagId = flagId; });
      Object.defineProperty(flag, 'previous', { value: previous, enumerable: false });
      list.push(flag); out.push(flag);
    }));
    if (!flags && !out.length) delete c.settlementFlags;
    return out;
  };
  // Cảnh báo cho Tổ trưởng (giao qua hộp thông báo nội bộ). notificationKey ổn định để chống trùng:
  // chưa xác nhận → theo hợp đồng; sắp hết / hết hiệu lực → theo bản ghi xác nhận (xác nhận mới = nhắc mới);
  // sắp hết hạn trong tháng mặt bằng → theo hợp đồng + kỳ; kiểm tra thực tế bản dự kiến → theo bản ghi.
  service.expiryAlerts = function (date) {
    const at = date || A.U.today(), out = [];
    repository.list().forEach(c => {
      const s = service.usageState(c, at);
      if (!s) return;
      const last = service.latestContinuation(c), through = service.confirmedThrough(c);
      if (s === 'UNCONFIRMED') out.push({ key: 'CONTRACT_EXPIRED_PENDING|' + c.id, kind: s, contract: c, title: 'Hợp đồng hết hạn – chờ xử lý', message: 'Hợp đồng ' + c.id + ' đã hết hạn từ ' + A.U.dmy(c.end) + ' và chưa được xác nhận tình trạng sử dụng.' });
      else if (s === 'EXPIRING') out.push({ key: 'CONTINUATION_EXPIRING|' + c.id + '|' + last.id, kind: s, contract: c, title: 'Xác nhận sử dụng sắp hết hạn', message: 'Xác nhận tiếp tục sử dụng của hợp đồng ' + c.id + ' hết hiệu lực ngày ' + A.U.dmy(through) + '.' });
      else if (s === 'LAPSED') out.push({ key: 'CONTINUATION_LAPSED|' + c.id + '|' + (last ? last.id : ''), kind: s, contract: c, title: 'Xác nhận sử dụng đã hết hiệu lực', message: 'Xác nhận tiếp tục sử dụng của hợp đồng ' + c.id + ' đã hết hiệu lực từ ' + A.U.dmy(addDays(through, 1)) + '. Cần xác nhận bổ sung hoặc xử lý hợp đồng.' });
      else if (s === 'ENDING_UNCOVERED') { const em = service.endingLandMonth(c, at); out.push({ key: 'CONTRACT_ENDING_IN_LAND_MONTH|' + c.id + '|' + em.periodId, kind: s, contract: c, title: 'Hợp đồng sắp hết hạn trong tháng mặt bằng', message: 'Hợp đồng ' + c.id + ' hết hạn ngày ' + A.U.dmy(c.end) + ', trước khi hết tháng mặt bằng ' + A.U.dmy(em.landTo) + '. Cần xác nhận dự kiến tiếp tục hoặc ngừng sử dụng trước khi phát hành kỳ thu.' }); }
      service.plannedToVerify(c, at).forEach(r => out.push({ key: 'PLANNED_VERIFY|' + c.id + '|' + r.id, kind: 'PLANNED_VERIFY', contract: c, record: r, title: 'Kiểm tra tình trạng sử dụng thực tế', message: 'Hợp đồng ' + c.id + ' đã hết hạn. Bản xác nhận dự kiến ' + r.id + ' (' + recText(r) + ') cần được kiểm tra với tình trạng sử dụng thực tế.' }));
    });
    return out;
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
