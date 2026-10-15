/* Markets use-case facade. Rendering and DOM behavior remain in the legacy view. */
(function (A) {
  'use strict';

  if (!A || !A.features || !A.features.markets || !A.features.markets.repository) return;

  const markets = A.features.markets;
  const repository = markets.repository;
  const service = markets.service || (markets.service = {});

  service.rows = function () { return repository.rows(); };
  service.get = function (id) { return repository.get(id); };
  service.priceConfig = function (id) { return repository.priceConfig(id); };
  service.codeTaken = function (code, excludeId) { return repository.codeTaken(code, excludeId); };
  const comparableName = value => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  service.nameTaken = function (name, excludeId) {
    const candidate = comparableName(name);
    return !!candidate && service.rows().some(m => m.id !== excludeId && comparableName(m.name) === candidate);
  };
  service.nextCode = function () { return repository.nextCode(); };
  // Danh sách chợ hiệu lực (12 chợ gốc + chợ custom trong danh mục) — xem markets/store.js.
  service.effectiveMarkets = function () { return repository.effectiveMarkets(); };
  service.add = function (record, user) { return repository.add(record, user); };
  service.update = function (id, patch, user) { return repository.update(id, patch, user); };
  service.normalizeLifecycle = function (id, layoutComplete, user, opts) { return repository.normalizeLifecycle(id, layoutComplete, user, opts); };
  // Vòng đời hiển thị (mặt bằng × trạng thái × biểu phí) — một nguồn: lifecycle.service.marketLifecycle.
  service.lifecycle = function (id) { const lc = A.features.lifecycle && A.features.lifecycle.service; return lc && lc.marketLifecycle ? lc.marketLifecycle(id) : null; };
  service.completeLayoutSetup = function (id, user) {
    if (!service.layoutGraphReady(id)) return null;
    return repository.completeLayoutSetup(id, user);
  };
  service.RANKS = repository.ranks();
  service.STATUS = repository.statuses();
  service.PRICE_CONFIGS = repository.priceConfigs();
  service.managementUnit = function (market) { return A.MARKET_CATALOG.marketManagementUnit(market); };

  // ---- Phân công người phụ trách chợ ------------------------------------
  // This is responsibility/audit data only. It deliberately never writes an
  // Account, role or marketScopes record.
  const RESPONSIBLE_ROLE_IDS = ['market_manager']; // No deputy role exists in the current RBAC catalog.
  const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null;
  // Ngày lịch trước đó, tính hoàn toàn theo UTC (tránh lệch múi giờ: giờ địa phương 00:00 ở UTC+7 là ngày hôm trước theo UTC).
  const previousDay = value => { const date = new Date(value + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); };
  const today = () => (A.U && A.U.today ? A.U.today() : new Date().toISOString().slice(0, 10));
  const clone = xs => (Array.isArray(xs) ? xs : []).map(x => Object.assign({}, x));
  const actorName = actor => actor && (actor.fullName || actor.code || actor.id) || 'Không rõ';
  const activeInternal = account => !!(account && A.ACCOUNTS && A.ACCOUNTS.isCurrentOrganization(account) && A.ACCOUNTS.isActive(account));
  const inRange = (row, date) => !!row && !row.cancelledAt && row.effectiveFrom <= date && (!row.effectiveTo || date <= row.effectiveTo);
  const overlap = (a, b) => a.effectiveFrom <= (b.effectiveTo || '9999-12-31') && b.effectiveFrom <= (a.effectiveTo || '9999-12-31');
  const assignmentRows = marketId => clone((service.get(marketId) || {}).managementAssignments).sort((a, b) => String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)) || String(a.assignedAt).localeCompare(String(b.assignedAt)));

  service.RESPONSIBLE_ROLE_IDS = RESPONSIBLE_ROLE_IDS.slice();
  service.assignments = marketId => assignmentRows(marketId);
  service.assignmentAt = (marketId, date) => assignmentRows(marketId).find(x => inRange(x, isoDate(date) || today())) || null;
  service.currentAssignment = marketId => service.assignmentAt(marketId, today());
  // For new/converted managers, active assignments are the single scope source.
  service.assignedMarketIdsForAccount = function (accountId, date) {
    const at = isoDate(date) || today();
    return service.effectiveMarkets().map(m => m.id).filter(marketId => {
      const row = service.assignmentAt(marketId, at);
      return !!row && row.accountId === accountId;
    });
  };
  service.eligibleResponsibleAccounts = function () {
    return (A.ACCOUNTS.currentList ? A.ACCOUNTS.currentList() : A.ACCOUNTS.list()).filter(a => activeInternal(a) && RESPONSIBLE_ROLE_IDS.indexOf(A.ACCOUNTS.primaryRole(a)) !== -1);
  };
  service.assignmentStatus = function (marketId, date) {
    const at = isoDate(date) || today(), current = service.assignmentAt(marketId, at);
    if (current) {
      const account = A.ACCOUNTS.get(current.accountId);
      if (!activeInternal(account)) return { state: 'ACCOUNT_INACTIVE', assignment: current, account };
      return { state: 'ACTIVE', assignment: current, account, hasScope: A.allowedMarkets(account).indexOf(marketId) !== -1 };
    }
    const planned = assignmentRows(marketId).find(x => x.effectiveFrom > at);
    return planned ? { state: 'PLANNED', assignment: planned, account: A.ACCOUNTS.get(planned.accountId) } : { state: 'UNASSIGNED', assignment: null, account: null };
  };
  service.scopeWarning = (marketId, accountId) => {
    const account = accountId && A.ACCOUNTS.get(accountId);
    if (account && A.ACCOUNTS.managerScopeMode && A.ACCOUNTS.managerScopeMode(account) === 'ASSIGNMENT') return false;
    return !!account && A.allowedMarkets(account).indexOf(marketId) === -1;
  };
  service.canManageAssignments = function () {
    const actor = A.currentAccount && A.currentAccount();
    return !!(actor && A.canDo('danh-muc-cho.phan-cong-nguoi-phu-trach') && A.allowedMarkets(actor).length);
  };
  const canManageAssignmentForMarket = marketId => service.canManageAssignments() && A.allowedMarkets(A.currentAccount()).indexOf(String(marketId)) >= 0;
  function fail(reason, extra) { return Object.assign({ ok: false, reason }, extra || {}); }
  function validateCandidate(marketId, accountId) {
    const account = A.ACCOUNTS.get(accountId);
    if (!account || !activeInternal(account) || RESPONSIBLE_ROLE_IDS.indexOf(A.ACCOUNTS.primaryRole(account)) === -1) return fail('INELIGIBLE_ACCOUNT');
    return { ok: true, account, scopeWarning: service.scopeWarning(marketId, accountId) };
  }
  function saveAssignments(marketId, rows, actor) {
    const saved = service.update(marketId, { managementAssignments: rows }, actorName(actor));
    return saved ? { ok: true, market: saved } : fail('SAVE_FAILED');
  }
  // Used while creating a market: validation happens before the catalog row is
  // persisted, so the market and its first assignment are saved atomically.
  service.prepareInitialAssignment = function (marketId, input, actor) {
    if (!input || !input.accountId) return { ok: true, assignments: [] };
    const effectiveFrom = isoDate(input.effectiveFrom);
    if (!effectiveFrom) return fail('INVALID_EFFECTIVE_DATE');
    const candidate = validateCandidate(marketId, input.accountId);
    if (!candidate.ok) return candidate;
    return { ok: true, assignments: [{ id: 'MMA-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), accountId: candidate.account.id, effectiveFrom, effectiveTo: null, assignedBy: actor && actor.id || null, assignedAt: new Date().toISOString(), reason: 'Phân công khi tạo chợ', note: String(input.note || '').trim() }], scopeWarning: candidate.scopeWarning };
  };
  service.assign = function (marketId, input, actor) {
    if (!canManageAssignmentForMarket(marketId)) return fail('FORBIDDEN');
    const effectiveFrom = isoDate(input && input.effectiveFrom);
    if (!effectiveFrom || !input || !String(input.reason || '').trim()) return fail(!effectiveFrom ? 'INVALID_EFFECTIVE_DATE' : 'REASON_REQUIRED');
    const candidate = validateCandidate(marketId, input.accountId);
    if (!candidate.ok) return candidate;
    const rows = assignmentRows(marketId), at = today();
    const next = { id: 'MMA-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), accountId: candidate.account.id, effectiveFrom, effectiveTo: null, assignedBy: actor && actor.id || null, assignedAt: new Date().toISOString(), reason: String(input.reason).trim(), note: String(input.note || '').trim() };
    // A future plan splits the preceding interval but never destroys it.
    const blocker = rows.find(x => !x.cancelledAt && overlap(x, next) && x.effectiveFrom >= effectiveFrom);
    if (blocker) return fail('OVERLAP', { assignment: blocker });
    const previous = rows.filter(x => inRange(x, effectiveFrom)).sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))[0];
    if (previous) previous.effectiveTo = previousDay(effectiveFrom);
    if (previous && previous.effectiveTo < previous.effectiveFrom) return fail('OVERLAP', { assignment: previous });
    rows.push(next);
    const saved = saveAssignments(marketId, rows, actor);
    if (saved.ok && A.U && A.U.log) A.U.log('Phân công người phụ trách chợ ' + marketId + ': ' + actorName(candidate.account) + ' từ ' + effectiveFrom);
    return Object.assign(saved, { assignment: next, scopeWarning: candidate.scopeWarning, planned: effectiveFrom > at });
  };
  service.updateFutureAssignment = function (marketId, assignmentId, input, actor) {
    if (!canManageAssignmentForMarket(marketId)) return fail('FORBIDDEN');
    if (!input || !String(input.reason || '').trim()) return fail('REASON_REQUIRED');
    const rows = assignmentRows(marketId), row = rows.find(x => x.id === assignmentId);
    if (!row || row.effectiveFrom <= today()) return fail('NOT_FUTURE');
    const candidate = validateCandidate(marketId, input.accountId || row.accountId);
    if (!candidate.ok) return candidate;
    row.accountId = candidate.account.id; row.reason = String(input.reason).trim(); row.note = String(input.note || '').trim();
    row.updatedBy = actor && actor.id || null; row.updatedAt = new Date().toISOString();
    return Object.assign(saveAssignments(marketId, rows, actor), { scopeWarning: candidate.scopeWarning });
  };
  service.cancelFutureAssignment = function (marketId, assignmentId, reason, actor) {
    if (!canManageAssignmentForMarket(marketId)) return fail('FORBIDDEN');
    if (!String(reason || '').trim()) return fail('REASON_REQUIRED');
    const rows = assignmentRows(marketId), index = rows.findIndex(x => x.id === assignmentId);
    if (index < 0 || rows[index].cancelledAt || rows[index].effectiveFrom <= today()) return fail('NOT_FUTURE');
    const removed = rows[index];
    removed.cancelledAt = new Date().toISOString(); removed.cancelledBy = actor && actor.id || null; removed.cancelReason = String(reason).trim();
    // Re-open the previous interval only until the next scheduled assignment.
    const previous = rows.filter(x => !x.cancelledAt && x.effectiveFrom < removed.effectiveFrom).sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))[0];
    const next = previous && rows.filter(x => !x.cancelledAt && x.effectiveFrom > removed.effectiveFrom).sort((a,b) => String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)))[0];
    if (previous) previous.effectiveTo = next ? previousDay(next.effectiveFrom) : null;
    const out = saveAssignments(marketId, rows, actor);
    if (out.ok && A.U && A.U.log) A.U.log('Hủy kế hoạch phân công người phụ trách chợ ' + marketId + ': ' + String(reason).trim());
    return out;
  };
  // Central routing: an assigned person receives a processing notification
  // only if their existing role, scope and action permission already allow it.
  service.responsibleRecipient = function (marketId, requiredAction, date) {
    const assignment = service.assignmentAt(marketId, date || today());
    const canHandle = account => activeInternal(account) && A.allowedMarkets(account).indexOf(marketId) !== -1 && (!requiredAction || A.PERM.canAction(A.ACCOUNTS.primaryRole(account), requiredAction));
    const assigned = assignment && A.ACCOUNTS.get(assignment.accountId);
    if (canHandle(assigned)) return { account: assigned, source: 'ASSIGNMENT', assignment };
    const fallback = service.eligibleResponsibleAccounts().find(canHandle);
    return fallback ? { account: fallback, source: 'FALLBACK', assignment, reason: assigned ? 'ASSIGNEE_NOT_AUTHORIZED' : 'UNASSIGNED' } : { account: null, source: 'UNRESOLVED', assignment, reason: assigned ? 'ASSIGNEE_NOT_AUTHORIZED' : 'UNASSIGNED' };
  };

  // ---- Suy ra từ nguồn sẵn có, KHÔNG lưu bản sao trong danh mục ----
  // Loại diện tích: danh mục dùng chung U.AREA_TYPE_CODES / U.areaTypeLabel (business-points/format.js).
  service.areaTypes = function () { return (A.U.AREA_TYPE_CODES || []).map(id => ({ id, label: A.U.areaTypeLabel(id) || id })); };

  // Lifecycle layout is persisted on Market; graph rows are never a substitute
  // for the explicit completed-setup transition.
  service.layoutZoneCount = function (id) {
    return ((A.db && A.db.rows) || []).filter(r => r.market === id).length;
  };
  service.layoutReady = function (id) { const market = repository.get(id); return !!market && market.layoutStatus === 'SETUP_COMPLETED'; };

  // A market may only become active after the canonical layout graph has been
  // completed.  Merely declaring an area, or adding a partial structure, is
  // not evidence that the market is ready for operation.
  service.layoutGraphReady = function (id) {
    const buildings = ((A.db && A.db.buildings) || []).filter(x => x.market === id);
    const rows = ((A.db && A.db.rows) || []).filter(x => x.market === id);
    const stalls = ((A.db && A.db.stalls) || []).filter(x => x.market === id);
    if (!buildings.length || !rows.length || !stalls.length) return false;
    const buildingIds = new Set(buildings.map(x => x.id));
    const rowIds = new Set(rows.map(x => x.id));
    return rows.every(x => buildingIds.has(x.buildingId) && Number(x.allocatedArea) > 0) &&
      stalls.every(x => rowIds.has(x.rowId) && Number(x.area) > 0);
  };

  // Đã số hoá theo loại diện tích: đếm điểm kinh doanh thật (A.db.stalls) của chợ, bỏ bản ghi đã gộp/
  // đã tách (chỉ giữ để truy vết). Trả về { [areaTypeId]: { count, area } }; điểm chưa có loại → '_none'.
  service.usage = function (id) {
    const bp = A.features.businessPoints && A.features.businessPoints.service;
    const points = bp ? bp.list() : [];
    const out = {};
    points.forEach(st => {
      if (st.market !== id || st.structuralStatus === 'MERGED' || st.structuralStatus === 'SPLIT') return;
      const k = st.areaTypeId || '_none';
      const u = out[k] || (out[k] = { count: 0, area: 0 });
      u.count++; u.area = Math.round((u.area + (Number(st.area) || 0)) * 100) / 100;
    });
    return out;
  };

  // ---- Validation quy mô chợ ----
  // input: { totalArea, businessArea } — mỗi giá trị là số, null (bỏ trống) hoặc NaN (không phải số).
  // opts.required: bắt buộc khai báo quy mô; opts.marketId checks that an edit
  // does not make the existing layout or business points invalid.
  // Trả về { ok, errors: { totalArea, businessArea }, value: { totalArea, businessArea } }.
  const fmt = n => Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  service.validateScale = function (input, opts) {
    opts = opts || {};
    const errors = {};
    const blank = v => v === null || v === undefined;
    if (!opts.required && blank(input.totalArea) && blank(input.businessArea)) {
      // Chợ chưa từng khai báo quy mô: được phép để "Chưa cập nhật" khi sửa thông tin chung.
      return { ok: true, errors, value: { totalArea: null, businessArea: null } };
    }
    const total = input.totalArea, biz = input.businessArea;
    if (blank(total)) errors.totalArea = 'Vui lòng nhập tổng diện tích chợ.';
    else if (isNaN(total) || total <= 0) errors.totalArea = 'Tổng diện tích chợ phải là số lớn hơn 0.';
    if (blank(biz)) errors.businessArea = 'Vui lòng nhập diện tích phục vụ kinh doanh.';
    else if (isNaN(biz) || biz <= 0) errors.businessArea = 'Diện tích phục vụ kinh doanh phải là số lớn hơn 0.';
    else if (!errors.totalArea && biz > total) errors.businessArea = `Diện tích phục vụ kinh doanh (${fmt(biz)} m²) không được lớn hơn tổng diện tích chợ (${fmt(total)} m²).`;
    if (!errors.businessArea && opts.marketId) {
      const buildings = ((A.db && A.db.buildings) || []).filter(x => x.market === opts.marketId);
      const rows = ((A.db && A.db.rows) || []).filter(x => x.market === opts.marketId);
      const stalls = ((A.db && A.db.stalls) || []).filter(x => x.market === opts.marketId);
      const requiredArea = Math.max(
        buildings.reduce((sum, x) => sum + (Number(x.businessArea) || 0), 0),
        rows.reduce((sum, x) => sum + (Number(x.allocatedArea) || 0), 0),
        stalls.reduce((sum, x) => sum + (Number(x.area) || 0), 0)
      );
      if (biz + 1e-9 < requiredArea) errors.businessArea = `Không thể giảm diện tích phục vụ kinh doanh xuống ${fmt(biz)} m² vì mặt bằng/điểm kinh doanh hiện có cần ít nhất ${fmt(requiredArea)} m².`;
    }
    return { ok: !errors.totalArea && !errors.businessArea, errors, value: { totalArea: total, businessArea: biz } };
  };

  // ---- Loại diện tích kinh doanh áp dụng ----
  // selected: [areaTypeId] Admin chọn; previous: allowedAreaTypeIds đang lưu (null = chưa cấu hình);
  // usage: service.usage(id). Không cho BỎ một loại đang được điểm kinh doanh thật sử dụng — không xoá
  // điểm, không đổi loại của điểm, không đụng mặt bằng. Trả về { ok, error, value } với value là danh
  // sách theo thứ tự U.AREA_TYPE_CODES. Market must always retain a type.
  service.validateAreaTypes = function (selected, previous, usage) {
    const codes = service.areaTypes().map(t => t.id);
    const next = codes.filter(k => (selected || []).indexOf(k) !== -1);
    if (!next.length) return { ok: false, error: 'Vui lòng chọn ít nhất một loại diện tích kinh doanh áp dụng.', value: null };
    const removedInUse = (previous || []).filter(k => next.indexOf(k) === -1 && usage && usage[k] && usage[k].count > 0);
    const error = removedInUse.map(k => `Không thể bỏ loại '${A.U.areaTypeLabel(k) || k}' vì hiện có điểm kinh doanh đang sử dụng loại diện tích này.`).join(' ');
    return { ok: !error, error, value: next.length ? next : null };
  };
})(window.APP);
