/* Canonical lifecycle state machine for market, business point, trader and contract. */
(function (A) {
  'use strict';

  const features = A.features || (A.features = {});
  const lifecycle = features.lifecycle || (features.lifecycle = {});
  const service = lifecycle.service || (lifecycle.service = {});
  const MARKET = service.MARKET = { NOT_ACTIVE: 'NOT_ACTIVE', ACTIVE: 'ACTIVE' };
  const LAYOUT = service.LAYOUT = { PENDING_SETUP: 'PENDING_SETUP', SETUP_COMPLETED: 'SETUP_COMPLETED' };
  const USAGE = service.USAGE = { VACANT: 'VACANT', RENTED: 'RENTED', SUSPENDED: 'SUSPENDED' };
  const CONTRACT = service.CONTRACT = { ACTIVE: 'ACTIVE', PENDING_LIQUIDATION: 'PENDING_LIQUIDATION', LIQUIDATED: 'LIQUIDATED' };
  const TRADER = service.TRADER = { WAITING_ALLOCATION: 'WAITING_ALLOCATION', ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' };

  const contractPointId = c => c && (c.businessPointId || c.stallId);
  const point = id => A.idx && A.idx.stall ? A.idx.stall.get(id) : null;
  const trader = id => A.idx && A.idx.trader ? A.idx.trader.get(id) : null;
  const day = value => value || A.U.today();
  // A signed contract may start in the future. `ACTIVE` is its persisted
  // contractual state; occupancy and trader business status are day-specific.
  const effectiveOn = (c, date) => !!c && c.status === CONTRACT.ACTIVE &&
    (!c.start || c.start <= day(date)) && (!c.end || c.end >= day(date));
  const normalizeContract = c => {
    if (!c) return null;
    if (c.status === 'LIQUIDATED' || c.status === 'thanhly') c.status = CONTRACT.LIQUIDATED;
    else if (c.status === 'PENDING_LIQUIDATION' || c.status === 'chamdut') { c.status = CONTRACT.PENDING_LIQUIDATION; c.endReason = c.endReason || 'EARLY_TERMINATION'; }
    else c.status = CONTRACT.ACTIVE;
    return c;
  };
  const normalizeTrader = t => {
    if (!t) return null;
    const old = t.status || t.profileStatus;
    t.status = old === 'ACTIVE' ? TRADER.ACTIVE : old === 'INACTIVE' ? TRADER.INACTIVE : TRADER.WAITING_ALLOCATION;
    return t;
  };
  const normalizePoint = s => {
    if (!s) return null;
    if (!s.operationalStatus) s.operationalStatus = ['suspended', 'disputed', 'inactive'].includes(s.status) ? s.status : 'active';
    if (!USAGE[s.usageStatus]) s.usageStatus = USAGE.VACANT;
    if (s.usageStatus !== USAGE.SUSPENDED) s.usageReason = null;
    return s;
  };
  const setPointUsage = (id, status, reason) => {
    const s = typeof id === 'string' ? point(id) : id;
    if (!s) return null;
    normalizePoint(s);
    s.usageStatus = status;
    s.usageReason = status === USAGE.SUSPENDED ? reason || null : null;
    return s;
  };
  // Scope 10/2026: hết hạn chỉ là trạng thái/cảnh báo của hợp đồng — hợp đồng ACTIVE đã bắt đầu vẫn giữ
  // liên kết điểm/hồ sơ sau ngày kết thúc (không tự giải phóng, không đổi trạng thái hồ sơ).
  const holdsPoint = (c, date) => !!c && c.status === CONTRACT.ACTIVE && (!c.start || c.start <= day(date));
  const activeContractsFor = (traderId, date) => (A.db.contracts || []).filter(c => c.traderId === traderId && holdsPoint(c, date));
  service.recalculateTrader = function (traderOrId, date) {
    const t = typeof traderOrId === 'string' ? trader(traderOrId) : traderOrId;
    if (!t) return null;
    normalizeTrader(t);
    t.status = activeContractsFor(t.id, date).length ? TRADER.ACTIVE : (t.status === TRADER.INACTIVE ? TRADER.INACTIVE : TRADER.WAITING_ALLOCATION);
    return t;
  };
  service.activateContract = function (contractOrId, date) {
    const c = typeof contractOrId === 'string' ? (A.idx.contract && A.idx.contract.get(contractOrId)) : contractOrId;
    if (!c) return null;
    c.status = CONTRACT.ACTIVE; c.endReason = null;
    // A future contract reserves its interval but must not rent the point or
    // activate the trader before its start date.
    if (!effectiveOn(c, date)) return c;
    setPointUsage(contractPointId(c), USAGE.RENTED);
    const t = trader(c.traderId); if (t) { t.status = TRADER.ACTIVE; if (!Array.isArray(t.stalls)) t.stalls = []; if (!t.stalls.includes(contractPointId(c))) t.stalls.push(contractPointId(c)); }
    return c;
  };
  // LEGACY: luồng cũ "hết hạn → chờ thanh lý". Không còn được gọi (syncExpiry không chuyển trạng thái nữa);
  // giữ để đọc/kiểm thử dữ liệu cũ.
  service.expireContract = function (contractOrId) {
    const c = typeof contractOrId === 'string' ? (A.idx.contract && A.idx.contract.get(contractOrId)) : contractOrId;
    if (!c || c.status === CONTRACT.LIQUIDATED) return c || null;
    c.status = CONTRACT.PENDING_LIQUIDATION; c.endReason = 'EXPIRED';
    setPointUsage(contractPointId(c), USAGE.SUSPENDED, 'CONTRACT_EXPIRED');
    service.recalculateTrader(c.traderId);
    return c;
  };
  service.terminateContract = function (contractOrId) {
    const c = typeof contractOrId === 'string' ? (A.idx.contract && A.idx.contract.get(contractOrId)) : contractOrId;
    if (!c || c.status === CONTRACT.LIQUIDATED) return c || null;
    c.status = CONTRACT.PENDING_LIQUIDATION; c.endReason = 'EARLY_TERMINATION';
    setPointUsage(contractPointId(c), USAGE.SUSPENDED, 'CONTRACT_TERMINATED');
    service.recalculateTrader(c.traderId);
    return c;
  };
  service.liquidateContract = function (contractOrId) {
    const c = typeof contractOrId === 'string' ? (A.idx.contract && A.idx.contract.get(contractOrId)) : contractOrId;
    if (!c) return null;
    c.status = CONTRACT.LIQUIDATED;
    setPointUsage(contractPointId(c), USAGE.VACANT);
    const t = trader(c.traderId);
    if (t && Array.isArray(t.stalls)) t.stalls = t.stalls.filter(id => id !== contractPointId(c));
    service.recalculateTrader(c.traderId);
    return c;
  };
  service.syncExpiry = function (date) {
    const today = day(date); let changed = false;
    (A.db.contracts || []).forEach(c => {
      if (c.status !== CONTRACT.ACTIVE) return;
      // Hết hạn: KHÔNG side effect (không chờ thanh lý, không tạm ngừng điểm, không đổi hồ sơ).
      if (c.end && c.end < today) return;
      if (effectiveOn(c, today)) {
        const s = point(contractPointId(c)), t = trader(c.traderId);
        const before = JSON.stringify([s && s.usageStatus, t && t.status]);
        service.activateContract(c, today);
        if (before !== JSON.stringify([s && s.usageStatus, t && t.status])) changed = true;
      }
    });
    return changed;
  };
  // ---- Vòng đời CHỢ (quyết định 10/2026) — hai chiều tách biệt:
  //   Tình trạng mặt bằng (layoutStatus): PENDING_SETUP → SETUP_COMPLETED, suy từ graph mặt bằng chuẩn.
  //   Trạng thái chợ (status)          : NOT_ACTIVE → ACTIVE chỉ khi ĐỦ ĐIỀU KIỆN = mặt bằng đã thiết lập
  //                                       + biểu phí áp dụng được cho các loại diện tích đang dùng.
  // "Đã thiết lập mặt bằng" KHÔNG đồng nghĩa "Đang hoạt động". Mọi màn (Danh mục chợ, Tổng quan liên chợ,
  // Mặt bằng, Hợp đồng) đọc qua marketLifecycle()/canActivateMarket() — không tự suy luận riêng.
  service.completeMarketLayout = function (marketId, user) {
    const markets = features.markets && features.markets.service;
    const out = markets && markets.completeLayoutSetup ? markets.completeLayoutSetup(marketId, user) : null;
    // Hoàn tất mặt bằng chỉ đặt layoutStatus. It deliberately does not run the
    // activation normalizer here: the next explicit fee-configuration save is
    // the business event that may activate a market.
    return out;
  };
  // A market with an incomplete/missing graph is never active, regardless of
  // legacy catalog flags, declared area, price configuration or business-area types.
  service.marketLayoutComplete = function (marketId) {
    const markets = features.markets && features.markets.service;
    return !!(markets && markets.layoutGraphReady && markets.layoutGraphReady(marketId));
  };
  const day0 = value => value || A.U.today();
  // ---- Cấu hình mức thu RIÊNG của chợ (quyết định 10/2026) ----
  // "Policy tồn tại trong hệ thống" (vd. QĐ 480 dùng chung theo hạng) KHÔNG phải "chợ đã cấu hình mức thu".
  // Chỉ bản ghi thuộc riêng chợ (SERVICE_CFG.isMarketOwnedPolicy: marketId = chợ, không SHARED/marketIds)
  // được tính. Tái sử dụng 3 danh mục sẵn có: stallPrices (mặt bằng), utilities (điện/nước), extraServices.
  const CHARGE_LABELS = service.FEE_CHARGE_LABELS = { DECLARATION: 'Khai báo khoản thu áp dụng', CONFIG: 'Cấu hình mức thu riêng của chợ', ELECTRICITY: 'Đơn giá điện', WATER: 'Đơn giá nước', SERVICE: 'Mức thu dịch vụ chợ' };
  // Khoản thu ÁP DỤNG của chợ: khai báo trong SERVICE_CFG.chargeApplicability (utilityModes[mid].charges).
  // Chưa khai báo = chưa đủ cấu hình. Dữ liệu cũ (chợ đã có mức thu riêng trước 10/2026) được khai báo một lần bởi
  // migration ensureLegacyChargeApplicability ở fee-config/store.js — không suy luận lúc đọc.
  service.marketFeeConfig = function (marketId, date) {
    const cfg = A.SERVICE_CFG, day = day0(date);
    if (!cfg || !cfg.list) return { configured: false, land: [], utilities: [], services: [], electricity: null, water: null, liveServices: [], charges: null };
    const owned = cat => (cfg.list(cat) || []).filter(p => cfg.isMarketOwnedPolicy(p, marketId));
    const live = p => cfg.policyActiveAt(p, day);
    const land = owned('stallPrices'), utilities = owned('utilities'), services = owned('extraServices').filter(x => x.category !== 'VEHICLE');
    const has = (kind, field) => u => (!u.kind || u.kind === kind) && u[field] != null;
    const utility = (kind, field) => utilities.find(u => live(u) && has(kind, field)(u)) || null;
    const charges = cfg.chargeApplicability ? cfg.chargeApplicability(marketId) : null;
    return {
      configured: land.length + utilities.length + services.length > 0, land, utilities, services,
      electricity: utility('ELECTRICITY', 'elecPrice'), water: utility('WATER', 'waterPrice'),
      liveServices: services.filter(live), charges
    };
  };
  // Đủ mức thu = cấu hình riêng của chợ áp dụng được tại ngày xét:
  //   0. Chợ đã khai báo khoản thu áp dụng (SERVICE_CFG.chargeApplicability).
  //   A. Mặt bằng (khoản chính, luôn áp dụng): mọi điểm KD hợp lệ (bỏ MERGED/SPLIT) có loại diện tích chuẩn
  //      ĐANG DÙNG giải được mức thu riêng của chợ (resolver dùng chung). Điểm legacy "Theo phiên" không bắt buộc.
  //   B/C/D. Điện / nước / dịch vụ: CHỈ bắt buộc khi được khai báo "áp dụng"; "không áp dụng" thì không chặn.
  service.marketFeeCoverage = function (marketId, date) {
    const bp = features.businessPoints && features.businessPoints.service;
    const cfg = A.SERVICE_CFG, day = day0(date), legacy = A.U.LEGACY_AREA_TYPE_CODES || [];
    const conf = service.marketFeeConfig(marketId, day);
    const used = [], missing = [];
    let legacyPoints = 0;
    (bp ? bp.list() : []).forEach(st => {
      if (st.market !== marketId || !bp.isCountable(st)) return;
      const k = st.areaTypeId || '';
      if (k && legacy.indexOf(k) !== -1) { legacyPoints++; return; }
      if (used.indexOf(k) === -1) used.push(k);
      if (missing.indexOf(k) === -1 && !(cfg && cfg.resolveApplicableMarketFeePolicy && cfg.resolveApplicableMarketFeePolicy({ point: st, date: day, ownedOnly: true }))) missing.push(k);
    });
    const missingCharges = [], ch = conf.charges;
    if (!ch) missingCharges.push('DECLARATION');
    if (!conf.configured) missingCharges.push('CONFIG');
    if (ch && ch.electricity && !conf.electricity) missingCharges.push('ELECTRICITY');
    if (ch && ch.water && !conf.water) missingCharges.push('WATER');
    if (ch && ch.service && !conf.liveServices.length) missingCharges.push('SERVICE');
    return { ready: !missing.length && !missingCharges.length, configured: conf.configured, charges: ch,
      usedAreaTypes: used, missingAreaTypes: missing, missingCharges, legacyPoints };
  };
  // Tình trạng mặt bằng ĐÃ HOÀN TẤT = đã được xác nhận bằng lệnh "Hoàn tất mặt bằng" (completeMarketLayout →
  // layoutStatus SETUP_COMPLETED) VÀ graph mặt bằng vẫn hợp lệ. Graph hợp lệ mà chưa bấm hoàn tất vẫn là
  // PENDING_SETUP — không suy "đã hoàn tất" chỉ từ graph (tránh lưu mức thu / tải trang tự hoàn tất mặt bằng).
  // Ngoại lệ backfill một lần: bản ghi chưa qua migration vòng đời (layoutLifecycleVersion = 0 — seed cũ) suy từ graph.
  service.layoutSetupCompleted = function (marketId) {
    const markets = features.markets && features.markets.service, m = markets && markets.get ? markets.get(marketId) : null;
    if (!m || !service.marketLayoutComplete(marketId)) return false;
    return m.layoutStatus === LAYOUT.SETUP_COMPLETED || !m.layoutLifecycleVersion;
  };
  service.canActivateMarket = function (marketId, date) {
    return service.layoutSetupCompleted(marketId) && service.marketFeeCoverage(marketId, date).ready;
  };
  // Trạng thái vòng đời để HIỂN THỊ (không lưu thêm gì):
  //   PENDING_LAYOUT → PENDING_FEE → ACTIVE; ACTIVE_FEE_WARNING = chợ đang hoạt động (giữ nguyên, không tự hạ)
  //   nhưng mức thu riêng hiện không đủ/hết hiệu lực → cảnh báo "Cần cập nhật mức thu/biểu phí".
  const STAGE = service.MARKET_STAGE = {
    PENDING_LAYOUT: { label: 'Chưa thiết lập mặt bằng', hint: 'Chưa thiết lập mặt bằng' },
    PENDING_FEE: { label: 'Chờ cấu hình mức thu', hint: 'Chờ cấu hình mức thu' },
    ACTIVE: { label: 'Đang hoạt động', hint: 'Đang hoạt động' },
    // A fee warning is secondary to the lifecycle progress, not a third
    // market state or progress step.
    ACTIVE_FEE_WARNING: { label: 'Đang hoạt động', hint: 'Đang hoạt động', warning: 'Cần cập nhật mức thu/biểu phí' }
  };
  service.feeGapText = function (fee) {
    if (!fee) return '';
    const parts = fee.missingAreaTypes.map(k => 'mặt bằng ' + (k ? (A.U.areaTypeLabel(k) || k) : 'chưa xác định loại diện tích').toLowerCase())
      .concat(fee.missingCharges.filter(k => k !== 'CONFIG' && k !== 'DECLARATION').map(k => CHARGE_LABELS[k].toLowerCase()));
    const head = fee.missingCharges.indexOf('CONFIG') !== -1 ? 'Chưa có cấu hình mức thu riêng của chợ.'
      : fee.missingCharges.indexOf('DECLARATION') !== -1 ? 'Chưa khai báo khoản thu áp dụng (điện, nước, dịch vụ).' : '';
    return [head, parts.length ? 'Thiếu: ' + parts.join(', ') + '.' : ''].filter(Boolean).join(' ');
  };
  service.marketLifecycle = function (marketId, date) {
    const markets = features.markets && features.markets.service;
    const m = markets && markets.get ? markets.get(marketId) : null;
    if (!m) return null;
    const layoutReady = m.layoutStatus === LAYOUT.SETUP_COMPLETED, active = m.status === MARKET.ACTIVE;
    const fee = service.marketFeeCoverage(marketId, date);
    const stage = active ? (fee.ready ? 'ACTIVE' : 'ACTIVE_FEE_WARNING') : layoutReady ? 'PENDING_FEE' : 'PENDING_LAYOUT';
    return { marketId, status: m.status, layoutStatus: m.layoutStatus, layoutReady, feeReady: fee.ready, fee, stage,
      label: STAGE[stage].label, hint: STAGE[stage].hint, warning: STAGE[stage].warning || '', canActivate: layoutReady && fee.ready,
      feeConfigWarning: stage === 'ACTIVE_FEE_WARNING', legacyActiveGap: stage === 'ACTIVE_FEE_WARNING', feeGap: service.feeGapText(fee) };
  };
  // Trạng thái CẤU HÌNH MỨC THU của chợ (màn Chính sách thu, danh sách + chi tiết) — suy từ coverage dùng chung:
  //   NONE      Chưa cấu hình : chưa khai báo khoản thu áp dụng và chưa có bản ghi mức thu riêng nào.
  //   WARNING   Cần cập nhật  : chợ đang hoạt động nhưng mức thu riêng hiện không đủ / hết hiệu lực.
  //   COMPLETE  Đã cấu hình   : đủ theo marketFeeCoverage (QĐ 480 dùng chung không bao giờ được tính).
  //   PARTIAL   Chưa đầy đủ   : còn lại.
  const FEE_STATUS = service.FEE_STATUS = { NONE: ['Chưa cấu hình', ''], PARTIAL: ['Chưa đầy đủ', 'warn'], COMPLETE: ['Đã cấu hình', 'ok'], WARNING: ['Cần cập nhật', 'danger'] };
  service.marketFeeStatus = function (marketId, date) {
    const lc = service.marketLifecycle(marketId, date);
    if (!lc) return null;
    const fee = lc.fee, key = lc.feeConfigWarning ? 'WARNING' : fee.ready ? 'COMPLETE' : (!fee.configured && !fee.charges) ? 'NONE' : 'PARTIAL';
    return { key, label: FEE_STATUS[key][0], cls: FEE_STATUS[key][1], lifecycle: lc };
  };
  service.normalizeMarketLifecycle = function (marketId, user) {
    const markets = features.markets && features.markets.service;
    if (!markets || !markets.normalizeLifecycle) return null;
    const layoutComplete = service.layoutSetupCompleted(marketId);
    return markets.normalizeLifecycle(marketId, layoutComplete, user || 'Migration lifecycle',
      { canActivate: layoutComplete && service.marketFeeCoverage(marketId).ready });
  };
  // Biểu phí đổi → xét lại kích hoạt các chợ (cùng đường normalize). Chỉ chạy khi dữ liệu mặt bằng đã nạp.
  service.normalizeAllMarkets = function (user) {
    const markets = features.markets && features.markets.service;
    if (!A.db || !Array.isArray(A.db.stalls) || !markets) return false;
    let changed = false;
    markets.rows().forEach(m => { const out = service.normalizeMarketLifecycle(m.id, user); if (out && out.changed) changed = true; });
    return changed;
  };
  if (A.SERVICE_CFG && A.SERVICE_CFG.onChange) A.SERVICE_CFG.onChange(() => service.normalizeAllMarkets('Cấu hình biểu phí'));
  service.migrate = function () {
    if (!A.db) return false;
    let changed = false;
    const markets = features.markets && features.markets.service;
    if (markets) markets.rows().forEach(m => {
      // Idempotent backfill: normalize both fields from the actual layout
      // graph, including legacy PENDING_SETUP + ACTIVE combinations.
      const out = service.normalizeMarketLifecycle(m.id, 'Migration lifecycle');
      if (out && out.changed) changed = true;
    });
    (A.db.stalls || []).forEach(s => {
      const before = JSON.stringify([s.operationalStatus, s.usageStatus, s.usageReason]);
      normalizePoint(s);
      if (before !== JSON.stringify([s.operationalStatus, s.usageStatus, s.usageReason])) changed = true;
    });
    (A.db.traders || []).forEach(t => { const before = t.status; normalizeTrader(t); if (before !== t.status) changed = true; });
    (A.db.contracts || []).forEach(c => { const before = JSON.stringify([c.status, c.endReason]); normalizeContract(c); if (before !== JSON.stringify([c.status, c.endReason])) changed = true; });
    if (service.syncExpiry()) changed = true;
    // Contracts are authoritative for usage and trader business status after normalization.
    // A future contract is not current occupancy; this repairs legacy RENTED
    // values that were written at signing time.
    (A.db.stalls || []).forEach(s => {
      // Hợp đồng ACTIVE đã bắt đầu (kể cả đã hết hạn — scope 10/2026) vẫn giữ điểm "Đang thuê".
      const c = (A.db.contracts || []).find(x => contractPointId(x) === s.id && holdsPoint(x));
      if (c && s.usageStatus !== USAGE.RENTED) { setPointUsage(s, USAGE.RENTED); changed = true; }
      if (!c && s.usageStatus === USAGE.RENTED) { setPointUsage(s, USAGE.VACANT); changed = true; }
    });
    (A.db.traders || []).forEach(t => { const before = t.status; service.recalculateTrader(t); if (before !== t.status) changed = true; });
    return changed;
  };
})(window.APP);
