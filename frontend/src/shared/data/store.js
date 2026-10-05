/* Shared prototype data store (Phase 15.3, from js/core.js).
 * Single owner of the persisted business state A.db (localStorage 'choso-caolanh-state'),
 * its lookup indexes A.idx, fresh seeding from window.DATA and the stored-state load/migration.
 * Mặt bằng (v16): A.db.buildings/floors/rows/stalls là graph mặt bằng DUY NHẤT; điểm kinh doanh được
 * gắn prototype tương thích (A.data.stallPrototype — features/business-points/repository.js). */
(function (A) {
  'use strict';
  const D = A.D;
  const KEY = 'choso-caolanh-state';
  const BACKUP_KEY = 'choso-caolanh-state-backup';
  const data = A.data || (A.data = {});
  // Collection periods are owned by a market.  `period` is the business month
  // (YYYY-MM); `id` is the technical identifier of one market-period instance.
  // Keep this adapter here so every feature resolves the same identity instead
  // of independently treating a month string as a global primary key.
  const periodMonth = value => {
    if (!value) return '';
    if (typeof value === 'object') return value.period || periodMonth(value.id);
    const text = String(value);
    const match = text.match(/(\d{4}-\d{2})$/);
    return match ? match[1] : '';
  };
  const scopedPeriodId = (marketId, period) => marketId && period ? `${marketId}_${period}` : '';
  const periods = A.periods || (A.periods = {});
  periods.periodKey = periodMonth;
  periods.makeId = scopedPeriodId;
  periods.getById = id => (A.db && A.db.billingPeriods || []).find(x => x && x.id === id) || null;
  periods.getByMarketMonth = (marketId, period) => (A.db && A.db.billingPeriods || []).find(x => x && x.marketId === marketId && x.period === period) || null;
  periods.listForMarket = marketId => (A.db && A.db.billingPeriods || []).filter(x => x && x.marketId === marketId);
  periods.exists = (marketId, period) => !!periods.getByMarketMonth(marketId, period);
  periods.resolve = (marketId, reference) => {
    const byId = periods.getById(reference);
    if (byId && (byId.marketId === marketId || (!byId.marketId && !byId.superseded))) return byId;
    const period = periodMonth(reference);
    const scoped = periods.getByMarketMonth(marketId, period);
    if (scoped) return scoped;
    // Legacy rows are read-only compatibility fallbacks. They never prevent a
    // new scoped period from being created and never get assigned a market here.
    const legacy = (A.db && A.db.billingPeriods || []).filter(x => x && !x.marketId && periodMonth(x) === period);
    return legacy.length === 1 ? legacy[0] : null;
  };
  periods.matchesEntity = (entity, periodRecord, marketId) => {
    if (!entity || !periodRecord) return false;
    const owner = entity.marketId || entity.market;
    // Kỳ legacy dùng chung (không marketId) có cùng id cho mọi chợ → billingPeriodId
    // thôi chưa đủ phân biệt; phải khớp thêm chợ sở hữu để không lẫn bản nháp giữa các chợ.
    if (entity.billingPeriodId) return entity.billingPeriodId === periodRecord.id && (!!periodRecord.marketId || !marketId || !owner || owner === marketId);
    return (!marketId || !owner || owner === marketId) && entity.period === periodMonth(periodRecord);
  };
  periods.isIssued = periodRecord => {
    if (!periodRecord || !A.db) return false;
    if (periodRecord.marketId) return (A.db.issuedPeriodIds || []).includes(periodRecord.id);
    return (A.db.issuedPeriods || []).includes(periodMonth(periodRecord));
  };
  periods.markIssued = periodRecord => {
    if (!periodRecord || !A.db) return false;
    if (!periodRecord.marketId) {
      if (!(A.db.issuedPeriods || []).includes(periodMonth(periodRecord))) (A.db.issuedPeriods || (A.db.issuedPeriods = [])).push(periodMonth(periodRecord));
      return true;
    }
    const ids = A.db.issuedPeriodIds || (A.db.issuedPeriodIds = []);
    if (!ids.includes(periodRecord.id)) ids.push(periodRecord.id);
    return true;
  };
  periods.migrate = () => {
    if (!A.db) return false;
    let changed = false;
    const list = Array.isArray(A.db.billingPeriods) ? A.db.billingPeriods : (A.db.billingPeriods = []);
    if (!Array.isArray(A.db.issuedPeriodIds)) { A.db.issuedPeriodIds = []; changed = true; }
    list.forEach(record => {
      if (!record || typeof record !== 'object') return;
      const month = periodMonth(record);
      if (month && record.period !== month) { record.period = month; changed = true; }
      if (record.marketId && month) {
        const technicalId = scopedPeriodId(record.marketId, month);
        if (record.id !== technicalId) { record.id = technicalId; changed = true; }
        if (!record.label) { record.label = `${month.slice(5)}/${month.slice(0, 4)}`; changed = true; }
        if (!record.source) { record.source = 'default'; changed = true; }
        // Không suy "đã phát hành" của 1 chợ từ issuedPeriods theo THÁNG (danh sách legacy dùng chung 12 chợ):
        // phát hành theo chợ được xác định từ invoice của chính chợ đó trong migrateMarketPeriods().
      } else if (month && !record.marketId && !record.legacyPeriod) {
        // Explicit marker makes the compatibility policy inspectable without
        // guessing ownership for historic global month records.
        record.legacyPeriod = true; changed = true;
      }
    });
    // New relationship fields can only be backfilled when market + month map
    // to exactly one scoped period. Ambiguous legacy records remain untouched.
    const attach = (rows, marketField) => (Array.isArray(rows) ? rows : []).forEach(row => {
      if (!row || row.billingPeriodId) return;
      const marketId = row.marketId || row[marketField] || row.market;
      const period = row.period;
      const match = marketId && period && periods.getByMarketMonth(marketId, period);
      if (match) { row.billingPeriodId = match.id; changed = true; }
    });
    attach(A.db.invoices, 'market'); attach(A.db.billingDrafts, 'market');
    attach(A.db.billingWarnings, 'market'); attach(A.db.debts, 'market');
    attach(A.db.cashHandovers, 'market'); attach(A.db.receivableAdjustments, 'market');
    attach(A.db.meterPeriods, 'marketId'); attach(A.db.meterReadings, 'marketId');
    if (migrateMarketPeriods()) changed = true;
    return changed;
  };

  // ===== MARKET_PERIOD v2: kỳ thu = 1 chợ + 1 tháng (`{marketId}_{YYYY-MM}`) =====
  // Kỳ legacy dùng chung 12 chợ (không marketId) được TÁCH thành kỳ theo chợ; bản ghi legacy giữ lại read-only
  // (superseded) để tra cứu, không còn được ghi state mới. Mốc nghiệp vụ của từng chợ chuyển lên kỳ của chợ:
  //   meter       ← meterPeriod.completionByMarket[m] / meterPeriod.status CLOSED (legacy toàn cục)
  //   issuance    ← invoice đã phát hành của chính chợ (không suy từ issuedPeriods theo tháng)
  //   collection  ← collectionHandoffByMarket[m] (snapshot Hoàn tất thu + đối soát)
  //   monthClose  ← kỳ legacy PAST/CLOSED (kỳ cũ read-only)
  // Tham chiếu invoices/drafts/warnings/cashHandovers/readings được trỏ sang id kỳ của chợ. Không xoá bản ghi
  // nào. Idempotent: chỉ bổ sung khi chưa có; chạy cho cả dữ liệu seed lẫn dữ liệu đã lưu.
  const MARKET_PERIOD_MODEL_VERSION = 2;
  const ACTIVE_RECON = ['WAITING', 'NEEDS_RESOLUTION', 'RECONCILED'];
  function normalizeHandoff(h) {
    const rec = JSON.parse(JSON.stringify(h));
    if (!ACTIVE_RECON.includes(rec.reconciliationStatus)) rec.reconciliationStatus = 'WAITING'; // WAITING_RECONCILIATION cũ
    rec.reconciliationHistory = Array.isArray(rec.reconciliationHistory) ? rec.reconciliationHistory : [];
    // BR-02: Thiếu/Thừa không phải hoàn tất — kết quả cũ chuyển vào lịch sử, chờ Kế toán xử lý đến khi khớp.
    if (rec.reconciliationStatus === 'RECONCILED' && rec.result && rec.result !== 'MATCHED') {
      rec.reconciliationHistory.push({ at: rec.reconciledAt || '', by: rec.reconciledBy || '', result: rec.result, actualCashAmount: rec.actualCashAmount,
        systemCashAmount: rec.systemCashAmount, differenceAmount: rec.differenceAmount, transferDifferenceAmount: rec.transferDifferenceAmount, note: rec.note || '', migrated: true });
      rec.reconciliationStatus = 'NEEDS_RESOLUTION';
    }
    return rec;
  }
  function migrateMarketPeriods() {
    const db = A.db, list = db.billingPeriods;
    let changed = false;
    const marketIds = (typeof A.effectiveMarkets === 'function' ? A.effectiveMarkets() : (D.MARKETS || [])).map(m => m.id);
    const stallMarket = id => { const s = (db.stalls || []).find(x => x.id === id); return s ? s.market : ''; };
    const legacyByMonth = new Map();
    list.filter(x => x && !x.marketId && periodMonth(x)).forEach(lp => {
      legacyByMonth.set(periodMonth(lp), lp);
      if (!lp.legacyPeriod || !lp.superseded) { lp.legacyPeriod = true; lp.superseded = true; changed = true; }
    });
    legacyByMonth.forEach((lp, month) => marketIds.forEach(mid => {
      if (periods.getByMarketMonth(mid, month)) return;
      const rec = { id: scopedPeriodId(mid, month), marketId: mid, period: month, label: lp.label || `${month.slice(5)}/${month.slice(0, 4)}`, source: 'legacy-split', legacyPeriodId: lp.id, createdAt: 'migrated' };
      ['preparationDate', 'meterReadDate', 'startDate', 'reminder1Date', 'reminder2Date', 'dueDate', 'endDate'].forEach(k => { if (lp[k]) rec[k] = lp[k]; });
      list.push(rec); changed = true;
    }));
    const invoicesOf = mp => (db.invoices || []).filter(i => (i.marketId || i.market) === mp.marketId && i.billingStatus !== 'DRAFT'
      && (i.billingPeriodId === mp.id || ((!i.billingPeriodId || i.billingPeriodId === mp.legacyPeriodId || i.billingPeriodId === mp.period) && i.period === mp.period)));
    list.filter(x => x && x.marketId && periodMonth(x)).forEach(mp => {
      const month = periodMonth(mp), lp = legacyByMonth.get(month) || null, mid = mp.marketId;
      if (!mp.meter) {
        const mps = (db.meterPeriods || []).filter(x => x.billingPeriodId === mp.id || (x.marketId === mid && x.period === month) || (!x.marketId && x.id === month));
        const done = mps.map(x => (x.completionByMarket && x.completionByMarket[mid]) || (x.status === 'CLOSED' && (x.marketId === mid || !x.completionByMarket) ? x : null)).find(x => x && x.status === 'CLOSED');
        if (done) { mp.meter = { status: 'COMPLETED', mode: 'RECORDED', completedAt: done.completedAt || done.closedAt || '', completedBy: done.completedBy || done.closedBy || '', migrated: true }; changed = true; }
      }
      const invs = invoicesOf(mp);
      if (invs.length && !mp.issuance) {
        mp.issuance = { issuedAt: (lp && lp.issuedAt) || mp.issuedAt || invs[0].publishedAt || invs[0].issuedAt || '', issuedBy: (lp && lp.issuedBy) || mp.issuedBy || invs[0].publishedBy || invs[0].issuedBy || '', count: invs.length, migrated: true };
        changed = true;
      }
      if (mp.issuance && !(db.issuedPeriodIds || []).includes(mp.id)) { db.issuedPeriodIds.push(mp.id); changed = true; }
      const handoff = (mp.collectionHandoffByMarket && mp.collectionHandoffByMarket[mid]) || (lp && lp.collectionHandoffByMarket && lp.collectionHandoffByMarket[mid]);
      if (handoff && !mp.collection) { mp.collection = normalizeHandoff(handoff); mp.collection.periodId = mp.id; changed = true; }
      const closedSource = ['PAST', 'CLOSED'].includes(mp.status) ? mp : lp && ['PAST', 'CLOSED'].includes(lp.status) ? lp : null;
      if (closedSource && !mp.monthClose) {
        // Kỳ cũ read-only: trạng thái cuối đông cứng tại thời điểm migrate (chợ có khoản phải thu = Hoàn tất, không có = Không áp dụng).
        mp.monthClose = { closedAt: closedSource.closedAt || '', closedBy: closedSource.closedBy || '', legacy: true, finalState: invs.length ? 'COMPLETED' : 'NOT_APPLICABLE' };
        changed = true;
      }
      // Trỏ tham chiếu sang kỳ của chợ (chỉ các bản ghi đang trỏ tới kỳ legacy của cùng tháng / chưa có kỳ).
      const legacyRef = x => !x.billingPeriodId || (lp && x.billingPeriodId === lp.id) || x.billingPeriodId === month;
      const repoint = (rows, marketOf, monthOf) => (rows || []).forEach(x => {
        if (!x || x.billingPeriodId === mp.id || marketOf(x) !== mid || monthOf(x) !== month || !legacyRef(x)) return;
        x.billingPeriodId = mp.id; changed = true;
      });
      repoint(db.invoices, x => x.marketId || x.market, x => x.period);
      repoint(db.billingDrafts, x => x.marketId || x.market, x => x.period);
      repoint(db.billingWarnings, x => x.marketId || x.market, x => x.period);
      repoint(db.readings, x => stallMarket(x.stallId), x => x.period);
      (db.cashHandovers || []).forEach(h => {
        if (!h || h.market !== mid || h.periodId === mp.id) return;
        if (h.periodId === month || (lp && h.periodId === lp.id)) { h.periodId = mp.id; h.billingPeriodId = mp.id; changed = true; }
      });
    });
    if (db.periodModelVersion !== MARKET_PERIOD_MODEL_VERSION) { db.periodModelVersion = MARKET_PERIOD_MODEL_VERSION; changed = true; }
    return changed;
  }
  periods.migrateMarketPeriods = migrateMarketPeriods;
  // Kỳ của 1 chợ cho 1 tháng (không fallback sang kỳ legacy dùng chung).
  periods.forMarketMonth = (marketId, month) => periods.getByMarketMonth(marketId, periodMonth(month));
  // Danh sách tháng có kỳ theo chợ (mới nhất trước).
  periods.months = () => Array.from(new Set((A.db && A.db.billingPeriods || []).filter(x => x && x.marketId).map(periodMonth).filter(Boolean))).sort().reverse();
  // Last persisted snapshot seen by this tab. It protects unrelated changes
  // made in a second web app from a stale whole-A.db save.
  let baselineDb = null;
  const clone = value => JSON.parse(JSON.stringify(value));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const captureBaseline = db => { baselineDb = clone(db); };
  const hasIdObjects = list => Array.isArray(list) && list.every(x => x && typeof x === 'object' && !Array.isArray(x) && x.id != null);

  // Three-way merge: unchanged local fields retain the newest persisted value;
  // local edits apply on top. Arrays of business records merge by stable id.
  function mergeChanged(base, local, remote) {
    if (same(local, base)) return clone(remote);
    if (same(remote, base)) return clone(local);
    if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote) && hasIdObjects(base) && hasIdObjects(local) && hasIdObjects(remote)) {
      const baseById = new Map(base.map(x => [x.id, x]));
      const localById = new Map(local.map(x => [x.id, x]));
      const remoteById = new Map(remote.map(x => [x.id, x]));
      const ids = remote.map(x => x.id).concat(local.map(x => x.id).filter(id => !remoteById.has(id)));
      return ids.reduce((out, id) => {
        const b = baseById.get(id), l = localById.get(id), r = remoteById.get(id);
        if (!b) { out.push(clone(l || r)); return out; }
        if (!l) { if (!r || same(r, b)) return out; out.push(clone(r)); return out; }
        if (!r) { if (!same(l, b)) out.push(clone(l)); return out; }
        out.push(mergeChanged(b, l, r)); return out;
      }, []);
    }
    if (base && local && remote && typeof base === 'object' && typeof local === 'object' && typeof remote === 'object' && !Array.isArray(base) && !Array.isArray(local) && !Array.isArray(remote)) {
      const out = {};
      new Set(Object.keys(base).concat(Object.keys(local), Object.keys(remote))).forEach(key => {
        const inBase = Object.prototype.hasOwnProperty.call(base, key), inLocal = Object.prototype.hasOwnProperty.call(local, key), inRemote = Object.prototype.hasOwnProperty.call(remote, key);
        if (!inLocal) { if (inRemote && (!inBase || !same(remote[key], base[key]))) out[key] = clone(remote[key]); return; }
        if (!inRemote) { if (!inBase || !same(local[key], base[key])) out[key] = clone(local[key]); return; }
        out[key] = inBase ? mergeChanged(base[key], local[key], remote[key]) : clone(local[key]);
      });
      return out;
    }
    return clone(local);
  }
  function readSharedState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { db: null };
      const db = JSON.parse(raw);
      if (db && db.version === D.VERSION) return { db };
      // Phiên bản CŨ hơn: loadDb đã sao lưu (backupOutdated) và dựng lại seed có chủ đích → được ghi đè. Chỉ chặn khi state
      // đã lưu là phiên bản MỚI hơn (tab khác chạy code mới) hoặc không đọc được version.
      return db && Number(db.version) < Number(D.VERSION) ? { db: null, outdated: true } : { db: null, incompatible: true };
    } catch (e) { return { db: null, invalid: true }; }
  }
  // ---------- dữ liệu ----------
  A.reindex = function () {
    const db = A.db;
    if (data.stallPrototype) db.stalls.forEach(s => { if (Object.getPrototypeOf(s) !== data.stallPrototype) Object.setPrototypeOf(s, data.stallPrototype); });
    A.idx = {
      building: new Map((db.buildings || []).map(s => [s.id, s])),
      floor: new Map((db.floors || []).map(s => [s.id, s])),
      row: new Map((db.rows || []).map(s => [s.id, s])),
      stall: new Map(db.stalls.map(s => [s.id, s])),
      trader: new Map(db.traders.map(s => [s.id, s])),
      contract: new Map(db.contracts.map(s => [s.id, s])),
      invoice: new Map(db.invoices.map(s => [s.id, s]))
    };
  };

  A.save = function () {
    try {
      const latest = readSharedState();
      if (latest.incompatible || latest.invalid) { console.warn('[choso] Shared state khong tuong thich; bo qua ghi de.'); return false; }
      if (latest.db && baselineDb && !same(latest.db, baselineDb)) { A.db = mergeChanged(baselineDb, A.db, latest.db); A.reindex(); }
      localStorage.setItem(KEY, JSON.stringify(A.db));
      captureBaseline(A.db);
      return true;
    } catch (e) { return false; }
  };

  A.fresh = function () {
    A.db = D.build();
    A.reindex();
    captureBaseline(A.db);
  };
  // Trước khi bỏ state của version cũ (reseed có chủ đích, vd. 15 → 16), sao lưu MỘT lần nguyên văn vào
  // 'choso-caolanh-state-backup' ({version, savedAt, state}) — không ghi đè backup đã có; hết dung lượng
  // thì chỉ cảnh báo, không chặn khởi động.
  function backupOutdated(raw, version) {
    try {
      if (!localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY, JSON.stringify({ version, savedAt: new Date().toISOString(), state: raw }));
    } catch (e) { console.warn('[choso] Không sao lưu được state v' + version + ' trước khi seed lại:', e); }
  }
  // Load persisted state (same version only) or seed fresh; then additive migrations.
  data.loadDb = function () {
    try {
      const s = localStorage.getItem(KEY);
      if (s) {
        const x = JSON.parse(s);
        if (x && x.version === D.VERSION) { A.db = x; captureBaseline(x); }
        else if (x && x.version) backupOutdated(s, x.version);
      }
    } catch (e) { A.db = null; }
    // GOM_KHOAN_THU_THEO_TIEU_THUONG — bất biến dữ liệu: chợ receivableGrouping 'TRADER' chỉ có 1 khoản
    // phải thu / tiểu thương / kỳ. Dữ liệu đã lưu (seed cũ, cache) vi phạm → dựng lại seed hiện tại.
    if (A.db && Array.isArray(A.db.invoices)) {
      const grouped = new Set((D.MARKETS || []).filter(m => m.receivableGrouping === 'TRADER').map(m => m.id));
      const seen = new Set();
      const broken = A.db.invoices.some(i => { if (!grouped.has(i.market) || !i.stallId) return false; const k = i.traderId + '|' + i.period; if (seen.has(k)) return true; seen.add(k); return false; });
      if (broken) { A.db = null; try { localStorage.removeItem(KEY); } catch (e) { /* bỏ qua */ } }
    }
    if (A.db) A.reindex(); else A.fresh();
    // Lịch sử gia hạn nằm trong state dùng chung. State cũ thiếu field này vẫn
    // hợp lệ; chỉ bổ sung mảng rỗng, không reset/reseed dữ liệu đã lưu.
    if (!Array.isArray(A.db.contractRenewals)) A.db.contractRenewals = [];
    // Hợp đồng seed cũ thiếu serviceApplicability → tính nháp bỏ qua điện, nước, dịch vụ. Bổ sung đúng như seed
    // hiện tại (điểm có công tơ: điện + nước; chợ TTD: dịch vụ), không đụng hợp đồng đã khai báo trên UI.
    let serviceMigrated = false;
    (A.db.contracts || []).forEach(c => {
      if (c.serviceApplicability) return;
      const st = A.idx.stall.get(c.businessPointId || c.stallId) || {};
      c.serviceApplicability = { electricity: !!st.hasMeter, water: !!st.hasMeter, marketService: c.market === 'TTD' };
      serviceMigrated = true;
    });
    const migratedPeriods = A.periods && A.periods.migrate ? A.periods.migrate() : false;
    if (migratedPeriods) A.reindex();
    // BR-07: Công nợ đã retire — không còn tự chuyển khoản quá hạn thành nợ (dữ liệu debts cũ giữ nguyên, chỉ đọc).
    // Hồ sơ/tài khoản: collection nghiệp vụ đổi số điện thoại, cùng state prototype A.db.
    // Không sao chép account; mỗi request chỉ tham chiếu accountId.
    if (!Array.isArray(A.db.phoneChangeRequests)) A.db.phoneChangeRequests = [];
    // Metadata actor là phần trình bày có thể chỉnh sửa trong Cài đặt. Chỉ bổ sung các
    // record còn thiếu; identity/name/roleId vẫn đọc từ DATA.ACTORS và không vào A.db.
    const actorMetadata = Array.isArray(A.db.actorMetadata) ? A.db.actorMetadata : [];
    let migratedActorMetadata = !Array.isArray(A.db.actorMetadata);
    const knownActorMetadata = new Set(actorMetadata.map(x => x && x.id));
    (D.ACTORS || []).forEach(a => {
      if (!knownActorMetadata.has(a.id)) {
        actorMetadata.push({ id: a.id, unit: a.unit || '', responsibilities: String(a.responsibility || '').split(/[;,]\s*/).filter(Boolean) });
        migratedActorMetadata = true;
      }
    });
    A.db.actorMetadata = actorMetadata;
    if (serviceMigrated || migratedActorMetadata || migratedPeriods) A.save();
    // BR-08: hệ thống tự tạo kỳ thu theo Lịch nghiệp vụ (idempotent) và tự tính nháp các kỳ đã đủ điều kiện.
    const marketPeriod = A.features && A.features.finance && A.features.finance.marketPeriod;
    if (marketPeriod) {
      marketPeriod.ensurePeriodsForCurrentCycle(); marketPeriod.autoCalculatePending();
      // Cấu hình biểu phí vừa được bổ sung khi nạp (migration) → tính lại nháp các kỳ còn được tính theo đúng logic hiện có.
      if (A.SERVICE_CFG && A.SERVICE_CFG.takeRecalcRequest && A.SERVICE_CFG.takeRecalcRequest()) marketPeriod.recalculateAfterSourceChange();
    }
    // Bộ phát thông báo theo mốc kỳ thu (idempotent, notificationKey chống gửi trùng).
    if (A.NOTIFICATIONS && A.NOTIFICATIONS.dispatchDueMilestones) A.NOTIFICATIONS.dispatchDueMilestones();
  };
  // External-tab refresh: never seed, clear, or write localStorage. UI callers
  // decide separately whether it is safe to render (for example, no open form).
  data.reloadSharedState = function () {
    const latest = readSharedState();
    if (!latest.db) return { changed: false, reason: latest.incompatible ? 'INCOMPATIBLE' : (latest.invalid ? 'INVALID' : 'EMPTY') };
    if (baselineDb && same(latest.db, baselineDb)) return { changed: false };
    A.db = latest.db;
    captureBaseline(latest.db);
    A.reindex();
    if (A.periods && A.periods.migrate && A.periods.migrate()) { A.reindex(); A.save(); }
    if (!Array.isArray(A.db.phoneChangeRequests)) A.db.phoneChangeRequests = [];
    return { changed: true };
  };
  data.clearPersisted = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* bỏ qua */ }
  };
})(window.APP);
