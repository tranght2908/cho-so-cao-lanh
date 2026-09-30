/* Nhân sự & phân công — use cases của Tổ trưởng Tổ Quản lý chợ (A02).
 *
 * KHÔNG có store riêng. Mọi dữ liệu derive từ nguồn sẵn có:
 *   - Nhân sự     = A.ACCOUNTS.currentList() lọc role A02/A03/A04 (legacy/retired/A06 đã bị loại ở đó).
 *   - Chợ         = A.allowedMarkets(tài khoản đang xem) — danh sách chợ hiệu lực ∩ phạm vi account.
 *   - Phân công   = Account.marketScopes của NV thu phí ACTIVE (A.ACCOUNTS.marketCollectorState).
 *   - NV kỹ thuật = theo từng sự cố (Incident.assignee), không sở hữu chợ.
 * Ghi phân công/điều chuyển CHỈ qua A.ACCOUNTS.saveCollectorAccount (1 lần lưu cho cả NV cũ + NV mới).
 * Không đụng Payment/Receipt/phiếu nộp/đối soát: người thu lịch sử vẫn giữ nguyên. */
(function (A) {
  'use strict';

  if (!A || !A.ACCOUNTS) return;

  const features = A.features || (A.features = {});
  const feature = features.staffAssignment || (features.staffAssignment = {});
  const service = feature.service || (feature.service = {});

  const SCREEN = 'nhan-su-phan-cong';
  const ACTION = { VIEW_ASSIGNMENT: SCREEN + '.xem-phan-cong', ASSIGN: SCREEN + '.phan-cong', REASSIGN: SCREEN + '.dieu-chuyen' };
  const STAFF_ROLE_IDS = ['market_manager', 'collector', 'technician'];
  const roleOf = a => A.ACCOUNTS.primaryRole(a);
  const uniq = xs => Array.from(new Set((xs || []).filter(Boolean)));

  service.SCREEN = SCREEN;
  service.ACTION = ACTION;
  service.STAFF_ROLE_IDS = STAFF_ROLE_IDS;

  service.canView = () => !!(A.U && A.U.can && A.U.can(SCREEN));
  service.canViewAssignment = () => service.canView() && A.canDo(ACTION.VIEW_ASSIGNMENT);
  service.canAssign = () => service.canView() && A.canDo(ACTION.ASSIGN);
  service.canReassign = () => service.canView() && A.canDo(ACTION.REASSIGN);

  // Nhân sự Tổ hiện hành: A02 + A03 + A04 (mọi trạng thái — trạng thái hiển thị ở bảng).
  service.staff = function () {
    return A.ACCOUNTS.currentList().filter(a => STAFF_ROLE_IDS.indexOf(roleOf(a)) !== -1)
      .sort((a, b) => STAFF_ROLE_IDS.indexOf(roleOf(a)) - STAFF_ROLE_IDS.indexOf(roleOf(b)) || String(a.code || '').localeCompare(String(b.code || '')));
  };
  service.managers = () => service.staff().filter(a => roleOf(a) === 'market_manager' && A.ACCOUNTS.isActive(a));
  service.isCollector = a => roleOf(a) === 'collector';
  service.isTechnician = a => roleOf(a) === 'technician';
  // Chỉ NV thu phí hiện hành đang hoạt động được nhận phân công mới (PENDING/LOCKED/legacy thì không).
  service.canReceive = a => !!a && service.isCollector(a) && A.ACCOUNTS.isActive(a) && A.ACCOUNTS.authStatus(a) === 'ACTIVE';
  service.eligibleCollectors = () => service.staff().filter(service.canReceive);

  // Chợ trong phạm vi của người đang xem, theo thứ tự danh mục chợ hiện hành.
  service.markets = function () { return A.allowedMarkets(A.currentAccount()); };
  service.marketState = marketId => A.ACCOUNTS.marketCollectorState(marketId);
  service.marketStates = () => service.markets().map(service.marketState);
  // Chợ đã ghi nhận trên Account.marketScopes (kể cả khi account chưa ACTIVE), giới hạn trong phạm vi đang xem.
  service.collectorMarkets = function (a) {
    if (!a || !service.isCollector(a)) return [];
    const own = new Set(A.allowedMarkets(a));
    return service.markets().filter(id => own.has(id));
  };
  service.collectorConflicts = a => service.collectorMarkets(a).filter(id => service.marketState(id).status === 'CONFLICT');
  service.summary = function () {
    const staff = service.staff(), states = service.marketStates();
    return {
      staff: staff.length,
      collectors: staff.filter(service.isCollector).length,
      technicians: staff.filter(service.isTechnician).length,
      markets: states.length,
      unassigned: states.filter(s => s.status === 'UNASSIGNED').length,
      conflicts: states.filter(s => s.status === 'CONFLICT').length
    };
  };

  const fail = (reason, extra) => Object.assign({ ok: false, reason }, extra || {});
  const who = a => (a.fullName || a.id) + ' (' + (a.code || a.id) + ')';
  const marketName = id => { const m = A.U.market(id); return m ? m.name : id; };
  // Đọc lại kho account dùng chung trước khi kiểm tra/ghi (web khác có thể vừa đổi phân công).
  function refreshAccounts() { if (A.ACCOUNTS.reload) A.ACCOUNTS.reload(); }
  function afterWrite(accountIds) {
    const cur = A.currentAccount && A.currentAccount();
    if (cur && accountIds.indexOf(cur.id) !== -1 && A.syncAccountContext) A.syncAccountContext();
    if (A.save) A.save(); // chỉ để lưu dòng nhật ký (A.db.extraLog), không đổi dữ liệu nghiệp vụ khác
  }

  // Phân tích thay đổi phân công của 1 NV thu phí khi chọn lại danh sách chợ (trong phạm vi đang xem).
  service.planCollectorMarkets = function (collectorId, marketIds) {
    const target = A.ACCOUNTS.get(collectorId);
    if (!target || !service.isCollector(target) || !A.ACCOUNTS.isCurrentOrganization(target)) return fail('NOT_COLLECTOR');
    if (!service.canReceive(target)) return fail('NOT_ACTIVE', { status: A.ACCOUNTS.authStatus(target) });
    const visible = service.markets(), visibleSet = new Set(visible);
    const wanted = uniq(marketIds);
    if (wanted.some(id => !visibleSet.has(id))) return fail('OUT_OF_SCOPE');
    const current = service.collectorMarkets(target);
    const added = wanted.filter(id => current.indexOf(id) === -1);
    const removed = current.filter(id => wanted.indexOf(id) === -1);
    const transfers = [], conflicts = [];
    added.forEach(id => {
      const st = service.marketState(id);
      if (st.status === 'CONFLICT') conflicts.push({ marketId: id, collectors: st.collectors });
      else if (st.status === 'ASSIGNED') transfers.push({ marketId: id, from: st.collector });
    });
    // Chợ ngoài phạm vi đang xem mà NV đã có: giữ nguyên, người xem không được gỡ/đổi.
    const hidden = uniq(target.marketScopes).filter(id => id !== 'ALL' && !visibleSet.has(id));
    const order = visible.filter(id => wanted.indexOf(id) !== -1);
    return {
      ok: true, target, added, removed, transfers, conflicts,
      targetConflicts: service.collectorConflicts(target),
      nextScopes: hidden.concat(order),
      unchanged: !added.length && !removed.length
    };
  };

  // Ghi phân công theo NV. opts.confirmTransfer = người dùng đã xác nhận điều chuyển các chợ đang có NV khác.
  service.saveCollectorMarkets = function (collectorId, marketIds, opts) {
    opts = opts || {};
    if (!service.canView()) return fail('FORBIDDEN');
    refreshAccounts();
    const plan = service.planCollectorMarkets(collectorId, marketIds);
    if (!plan.ok) return plan;
    if (plan.unchanged) return Object.assign({}, plan, { ok: true });
    // Xung đột legacy: không phân công thêm vào chợ xung đột, không lưu NV đang dính xung đột — xử lý ở "Theo chợ".
    if (plan.conflicts.length) return fail('MARKET_CONFLICT', { conflicts: plan.conflicts });
    if (plan.targetConflicts.length) return fail('TARGET_CONFLICT', { markets: plan.targetConflicts });
    const plainAdds = plan.added.filter(id => !plan.transfers.some(t => t.marketId === id));
    if ((plainAdds.length || plan.removed.length) && !service.canAssign()) return fail('FORBIDDEN');
    if (plan.transfers.length && !service.canReassign()) return fail('FORBIDDEN');
    if (plan.transfers.length && !opts.confirmTransfer) return fail('TRANSFER_REQUIRED', { transfers: plan.transfers });
    const transferIds = plan.transfers.map(t => t.marketId);
    const saved = A.ACCOUNTS.saveCollectorAccount({ id: plan.target.id, marketScopes: plan.nextScopes }, { transferMarkets: transferIds });
    if (!saved.ok) return fail(saved.reason === 'TRANSFER_REQUIRED' ? 'TARGET_CONFLICT' : (saved.reason || 'SAVE_FAILED'), { detail: saved });
    plainAdds.forEach(id => A.U.log('Phân công ' + marketName(id) + ' cho NV thu phí ' + who(plan.target)));
    plan.transfers.forEach(t => A.U.log('Điều chuyển ' + marketName(t.marketId) + ': ' + who(t.from) + ' → ' + who(plan.target)));
    plan.removed.forEach(id => A.U.log('Gỡ phân công ' + marketName(id) + ' khỏi NV thu phí ' + who(plan.target)));
    afterWrite([plan.target.id].concat(plan.transfers.map(t => t.from.id)));
    return Object.assign({}, plan, { ok: true, account: saved.account });
  };

  // Theo chợ: phân công chợ chưa có người / điều chuyển chợ sang NV khác — cùng 1 đường ghi với theo NV.
  service.assignMarket = function (marketId, collectorId, opts) {
    const target = A.ACCOUNTS.get(collectorId);
    if (!target) return fail('NOT_COLLECTOR');
    const st = service.marketState(marketId);
    if (st.status === 'ASSIGNED' && st.collector.id === collectorId) return fail('SAME_COLLECTOR');
    return service.saveCollectorMarkets(collectorId, service.collectorMarkets(target).concat([marketId]), opts);
  };

  // Xung đột legacy (nhiều NV ACTIVE cùng giữ 1 chợ): chỉ khi Tổ trưởng chọn người giữ mới ghi. Chỉ GỠ chợ khỏi
  // những NV còn lại (không thêm cho ai), nên không thể có thời điểm lưu nào phát sinh trùng mới.
  service.resolveConflict = function (marketId, keeperId) {
    if (!service.canView()) return fail('FORBIDDEN');
    if (!service.canReassign()) return fail('FORBIDDEN');
    refreshAccounts();
    if (service.markets().indexOf(marketId) === -1) return fail('OUT_OF_SCOPE');
    const st = service.marketState(marketId);
    if (st.status !== 'CONFLICT') return fail('NO_CONFLICT');
    const keeper = st.collectors.find(a => a.id === keeperId);
    if (!keeper) return fail('KEEPER_NOT_IN_CONFLICT');
    const losers = st.collectors.filter(a => a.id !== keeperId);
    losers.forEach(a => A.ACCOUNTS.update(a.id, { marketScopes: uniq(a.marketScopes).filter(id => id !== marketId) }));
    A.U.log('Xử lý xung đột phân công ' + marketName(marketId) + ': giữ ' + who(keeper) + ', gỡ ' + losers.map(who).join(', '));
    afterWrite(st.collectors.map(a => a.id));
    return { ok: true, marketId, keeper, removedFrom: losers };
  };
})(window.APP);
