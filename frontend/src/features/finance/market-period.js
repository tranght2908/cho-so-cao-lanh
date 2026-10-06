/* Kỳ thu theo chợ (MarketPeriod) — domain service DUY NHẤT của luồng thu phí.
 *
 * Kỳ thu = 1 chợ + 1 tháng: A.db.billingPeriods[] có marketId, id `{marketId}_{YYYY-MM}` (identity/migration ở
 * shared/data/store.js — A.periods). Kỳ tháng tổng ("Kỳ 11/2026") chỉ là AGGREGATION các kỳ của chợ, không có state riêng.
 *
 * Bản ghi kỳ chỉ LƯU các mốc nghiệp vụ; trạng thái tổng của chợ luôn TÍNH ở stateOf() từ dữ liệu nguồn:
 *   schedule snapshot  preparationDate · meterReadDate · startDate · reminder1Date · reminder2Date · dueDate · endDate
 *   meter              { status:'COMPLETED', mode:'RECORDED'|'NOT_REQUIRED', completedAt, completedBy }   (NV thu phí)
 *   calculatedAt       lần tính nháp gần nhất
 *   issuance           { issuedAt, issuedBy, count, amount }                                             (Tổ trưởng)
 *   collection         snapshot "Hoàn tất thu & chuyển đối soát" + reconciliationStatus/result/history   (NV → Kế toán)
 *   monthClose         { closedAt, closedBy, finalState }                                                (Tổ trưởng chốt kỳ)
 *
 * Mọi màn (Theo dõi kỳ thu, Chỉ số, Khoản phải thu, Thu tiền, Đối soát, cổng Tiểu thương) đọc trạng thái và kiểm tra
 * điều kiện chuyển bước QUA service này — không tự suy trạng thái ở view. */
(function (A) {
  'use strict';
  const U = A.U, D = A.D || window.DATA;
  const features = A.features || (A.features = {});
  const finance = features.finance || (features.finance = {});
  const svc = finance.marketPeriod || (finance.marketPeriod = {});

  const REVIEW_BANK = ['UNMATCHED', 'AMOUNT_MISMATCH', 'NEEDS_REVIEW'];
  const ABNORMAL_MULTIPLIER = 1.5;
  const SYSTEM_ACTOR = 'Hệ thống (tự động)';
  // [label, class tag]. NEEDS_RESOLUTION là trạng thái con của WAITING_RECONCILIATION (đối soát lệch, chưa hoàn tất).
  const STATES = {
    NO_PERIOD: ['Chưa có kỳ', ''],
    NOT_APPLICABLE: ['Không áp dụng', ''],
    UNASSIGNED: ['Chưa có NV phụ trách', 'warn'],
    WAITING_METER: ['Chờ ghi chỉ số', 'warn'],
    METER_RECORDING: ['Đang ghi chỉ số', 'info'],
    METER_COMPLETED: ['Chờ tính khoản thu', 'info'],
    NEEDS_ACTION: ['Cần xử lý', 'danger'],
    READY_TO_ISSUE: ['Sẵn sàng phát hành', 'ok'],
    COLLECTING: ['Đang thu', 'info'],
    COLLECTION_COMPLETED: ['Hoàn tất thu', 'ok'],
    WAITING_RECONCILIATION: ['Chờ đối soát', 'warn'],
    NEEDS_RESOLUTION: ['Xử lý chênh lệch đối soát', 'danger'],
    COMPLETED: ['Hoàn tất', 'ok']
  };
  // Nhóm lọc của Theo dõi kỳ thu: count và filter dùng CÙNG bảng này.
  const FILTERS = [
    ['UNASSIGNED', 'Chưa phân công', ['UNASSIGNED']],
    ['WAITING_METER', 'Chờ ghi chỉ số', ['WAITING_METER']],
    ['METER_RECORDING', 'Đang ghi chỉ số', ['METER_RECORDING']],
    ['NEEDS_ACTION', 'Cần xử lý', ['NEEDS_ACTION', 'METER_COMPLETED', 'NO_PERIOD']],
    ['READY_TO_ISSUE', 'Sẵn sàng phát hành', ['READY_TO_ISSUE']],
    ['COLLECTING', 'Đang thu', ['COLLECTING']],
    ['COLLECTION_COMPLETED', 'Hoàn tất thu', ['COLLECTION_COMPLETED']],
    ['RECONCILIATION', 'Chờ/Xử lý đối soát', ['WAITING_RECONCILIATION', 'NEEDS_RESOLUTION']],
    ['COMPLETED', 'Hoàn tất', ['COMPLETED']],
    ['NOT_APPLICABLE', 'Không áp dụng', ['NOT_APPLICABLE']]
  ];
  const CLOSABLE = ['COMPLETED', 'NOT_APPLICABLE'];

  const periods = () => A.periods;
  const monthOf = x => periods().periodKey(x);
  const stamp = () => U.dmy(U.today()) + ' ' + U.nowTime();
  const pad = n => String(n).padStart(2, '0');
  const lastDay = (y, m) => new Date(y, m, 0).getDate();
  const isoDate = (y, m0, day) => { const d = new Date(y, m0, 1); const yy = d.getFullYear(), mm = d.getMonth() + 1; return yy + '-' + pad(mm) + '-' + pad(Math.min(Number(day) || 1, lastDay(yy, mm))); };
  const addMonths = (month, k) => { const [y, m] = month.split('-').map(Number), d = new Date(y, m - 1 + k, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };

  // Chợ đang hoạt động: danh mục chợ hiệu lực, loại chợ đã ngừng hoạt động trong Danh mục chợ.
  svc.activeMarkets = function () {
    const all = typeof A.effectiveMarkets === 'function' ? A.effectiveMarkets() : (D.MARKETS || []);
    const rows = A.MARKET_CATALOG && A.MARKET_CATALOG.rows ? new Map(A.MARKET_CATALOG.rows().map(r => [r.id, r])) : null;
    return all.filter(m => { const r = rows && rows.get(m.id); return !r || !r.status || r.status === 'ACTIVE'; });
  };

  // ---------- Lịch nghiệp vụ (template) → snapshot ngày của kỳ ----------
  const offset = phase => phase === 'previous' ? -1 : phase === 'next' ? 1 : 0;
  svc.scheduleDates = function (month, cycle) {
    const c = cycle || (A.SERVICE_CFG && A.SERVICE_CFG.cycle()) || {}, [y, m] = month.split('-').map(Number);
    const at = (day, phase) => isoDate(y, m - 1 + offset(phase), day);
    return {
      preparationDate: at(c.preparationDay, c.preparationMonth), meterReadDate: at(c.meterReadDay, c.meterReadMonth),
      startDate: at(c.collectionStartDay, c.collectionStartMonth), reminder1Date: at(c.reminder1Day, c.reminder1Month),
      reminder2Date: at(c.reminder2Day, c.reminder2Month), dueDate: at(c.dueDay, c.dueMonth), endDate: y + '-' + pad(m) + '-' + pad(lastDay(y, m))
    };
  };
  const SCHEDULE_KEYS = ['preparationDate', 'meterReadDate', 'startDate', 'reminder1Date', 'reminder2Date', 'dueDate', 'endDate'];
  // Mốc ngày của kỳ: snapshot đã lưu; kỳ legacy thiếu mốc nào thì hiển thị theo template hiện tại (không ghi ngược).
  svc.dateOf = function (mp, key) {
    if (!mp) return '';
    return mp[key] || svc.scheduleDates(monthOf(mp))[key] || '';
  };

  function createPeriod(marketId, month, source, actor) {
    const dates = svc.scheduleDates(month), cycle = (A.SERVICE_CFG && A.SERVICE_CFG.cycle()) || {};
    const rec = Object.assign({ id: periods().makeId(marketId, month), marketId, period: month, label: month.slice(5) + '/' + month.slice(0, 4), source,
      createdAt: stamp(), createdBy: actor || SYSTEM_ACTOR }, dates, { scheduleSnapshot: Object.assign({ cycleHistoryAt: (cycle.history && cycle.history[0] && cycle.history[0].time) || '' }, dates) });
    A.db.billingPeriods.push(rec);
    return rec;
  }
  // Kỳ chỉ số theo tháng (lịch chọn tháng của màn Chỉ số điện, nước); hoàn tất chỉ số nằm trên kỳ của từng chợ.
  function ensureMeterMonth(month) {
    A.db.meterPeriods = Array.isArray(A.db.meterPeriods) ? A.db.meterPeriods : [];
    if (A.db.meterPeriods.some(x => !x.marketId && x.id === month)) return false;
    const [y, m] = month.split('-').map(Number);
    A.db.meterPeriods.push({ id: month, month: m, year: y, status: 'RECORDING', closeDate: svc.scheduleDates(month).meterReadDate });
    return true;
  }
  // BR-08: hệ thống tự tạo kỳ của mọi chợ đang hoạt động khi tới mốc CHUẨN BỊ của kỳ tiếp theo. Chỉ tạo kỳ
  // gần nhất đã tới mốc chuẩn bị — không dựng lại tháng quá khứ bị thiếu. Idempotent (không tạo trùng).
  svc.ensurePeriodsForCurrentCycle = function () {
    const out = { month: null, created: [] };
    if (!A.db || !A.SERVICE_CFG) return out;
    const cycle = A.SERVICE_CFG.cycle() || {};
    if (cycle.autoCreatePeriods === false) return out;
    const today = U.today(), base = today.slice(0, 7);
    for (let k = 2; k >= -1; k--) {
      const month = addMonths(base, k);
      if (svc.scheduleDates(month, cycle).preparationDate <= today) { out.month = month; break; }
    }
    if (!out.month) return out;
    svc.activeMarkets().forEach(m => {
      if (periods().forMarketMonth(m.id, out.month)) return;
      out.created.push(createPeriod(m.id, out.month, 'auto'));
    });
    const meterAdded = out.created.length ? ensureMeterMonth(out.month) : false;
    if (out.created.length || meterAdded) {
      if (U.log) U.log('Tự động tạo kỳ thu ' + out.month.slice(5) + '/' + out.month.slice(0, 4) + ' cho ' + out.created.length + ' chợ theo Lịch nghiệp vụ');
      A.save();
    }
    return out;
  };

  // ---------- Truy vấn dữ liệu nguồn của 1 kỳ chợ ----------
  svc.get = (marketId, month) => periods().forMarketMonth(marketId, month);
  svc.months = () => periods().months();
  svc.ofInvoice = inv => {
    if (!inv) return null;
    const market = inv.marketId || inv.market, byId = inv.billingPeriodId && periods().getById(inv.billingPeriodId);
    return byId && byId.marketId === market ? byId : svc.get(market, inv.period);
  };
  svc.contracts = mp => !mp ? [] : (A.db.contracts || []).filter(c => c.market === mp.marketId && c.status === 'ACTIVE'
    && c.start <= svc.dateOf(mp, 'endDate') && (!c.end || c.end >= svc.dateOf(mp, 'startDate')));
  svc.invoices = mp => !mp ? [] : (A.db.invoices || []).filter(i => (i.marketId || i.market) === mp.marketId && i.billingStatus !== 'DRAFT'
    && (i.billingPeriodId === mp.id || (!i.billingPeriodId && i.period === monthOf(mp))));
  svc.drafts = mp => !mp ? [] : (A.db.billingDrafts || []).filter(x => periods().matchesEntity(x, mp, mp.marketId));
  svc.warnings = mp => !mp ? [] : (A.db.billingWarnings || []).filter(x => periods().matchesEntity(x, mp, mp.marketId));
  svc.blockingWarnings = mp => svc.warnings(mp).filter(w => String(w.severity || 'BLOCKING').toUpperCase() === 'BLOCKING');
  // BR-01: chợ có đối tượng phát sinh khoản thu trong kỳ = có hợp đồng hiệu lực (điểm + khoản phí áp dụng) hoặc đã có khoản phải thu.
  svc.isApplicable = mp => !!mp && (svc.invoices(mp).length > 0 || svc.contracts(mp).length > 0);

  // ---------- Chỉ số điện, nước ----------
  svc.utilityByService = marketId => !!(A.SERVICE_CFG && A.SERVICE_CFG.utilityMode && A.SERVICE_CFG.utilityMode(marketId) === 'SERVICE');
  // Điểm cần ghi chỉ số: điểm có công tơ thuộc hợp đồng hiệu lực áp dụng điện/nước; chợ thu điện nước như dịch vụ → không có.
  svc.meterPoints = function (mp) {
    if (!mp || svc.utilityByService(mp.marketId)) return [];
    const ids = new Set();
    svc.contracts(mp).forEach(c => {
      const st = A.idx.stall.get(c.businessPointId || c.stallId), sa = c.serviceApplicability || {};
      if (st && st.hasMeter && (sa.electricity || sa.water || !c.serviceApplicability)) ids.add(st.id);
    });
    return Array.from(ids).map(id => A.idx.stall.get(id));
  };
  svc.readingOf = (mp, stallId) => (A.db.readings || []).find(r => r.stallId === stallId && (r.billingPeriodId === mp.id || (!r.billingPeriodId && r.period === monthOf(mp))) )
    || (A.db.readings || []).find(r => r.stallId === stallId && r.period === monthOf(mp)) || null;
  const consumption = (r, cur, prev) => r[cur] == null || r[prev] == null ? null : Number(r[cur]) - Number(r[prev]);
  svc.isAbnormal = (r, kind) => {
    const v = kind === 'elec' ? consumption(r, 'elecCur', 'elecPrev') : consumption(r, 'waterCur', 'waterPrev'), avg = Number(r[kind === 'elec' ? 'elecAvg' : 'waterAvg']);
    return v != null && avg > 0 && v > avg * ABNORMAL_MULTIPLIER;
  };
  // NV đã kiểm tra và xác nhận/điều chỉnh chỉ số → không còn là cảnh báo chặn.
  svc.readingConfirmed = r => !!(r && r.reviewedAt && !r.reviewRequired);
  svc.readingState = function (r) {
    if (!r || r.elecCur == null || r.waterCur == null) return 'NOT_RECORDED';
    if (r.reviewRequired || ((svc.isAbnormal(r, 'elec') || svc.isAbnormal(r, 'water')) && !r.reviewedAt)) return 'NEEDS_REVIEW';
    return 'RECORDED';
  };
  svc.meterStats = function (mp) {
    const points = svc.meterPoints(mp), s = { required: points.length, recorded: 0, review: 0, unrecorded: 0, started: 0 };
    points.forEach(st => {
      const r = svc.readingOf(mp, st.id), state = svc.readingState(r);
      if (r && (r.elecCur != null || r.waterCur != null)) s.started++;
      if (state === 'RECORDED') s.recorded++; else if (state === 'NEEDS_REVIEW') s.review++; else s.unrecorded++;
    });
    return s;
  };
  // NOT_REQUIRED | COMPLETED | RECORDING | WAITING
  svc.meterStatus = function (mp) {
    if (!mp) return 'WAITING';
    if (mp.meter && mp.meter.status === 'COMPLETED') return 'COMPLETED';
    const st = svc.meterStats(mp);
    if (!st.required) return 'NOT_REQUIRED';
    return st.started ? 'RECORDING' : 'WAITING';
  };
  svc.meterDone = mp => ['COMPLETED', 'NOT_REQUIRED'].includes(svc.meterStatus(mp));

  // ---------- Thu tiền ----------
  svc.isIssued = mp => !!(mp && mp.issuance);
  svc.isClosed = mp => !!(mp && mp.monthClose);
  svc.reviewBank = function (mp) {
    const invs = svc.invoices(mp), ids = new Set(invs.map(i => i.id));
    return (A.db.bank || []).filter(b => b.market === (mp && mp.marketId) && REVIEW_BANK.includes(b.status) && (ids.has(b.receivableId) || invs.some(i => String(b.ref || '').includes(i.id))));
  };
  // BR-04: điều kiện Hoàn tất thu — dùng chung cho checklist UI và handler.
  svc.collectionChecklist = function (mp) {
    const invs = svc.invoices(mp), unpaid = invs.filter(i => i.status !== 'paid' || Number(i.paid || 0) < Number(i.amount || 0)), review = svc.reviewBank(mp);
    const remaining = unpaid.reduce((s, i) => s + Math.max(0, Number(i.amount || 0) - Number(i.paid || 0)), 0);
    const items = [
      { key: 'ISSUED', ok: svc.isIssued(mp) && invs.length > 0, text: svc.isIssued(mp) ? 'Đã phát hành ' + invs.length + ' khoản phải thu' : 'Chưa phát hành khoản phải thu' },
      { key: 'PAID', ok: invs.length > 0 && !unpaid.length && remaining === 0, text: unpaid.length ? `Còn ${unpaid.length} khoản chưa thanh toán · còn ${U.money(remaining)}` : 'Tất cả khoản phải thu đã thanh toán đủ' },
      { key: 'BANK', ok: !review.length, text: review.length ? `Còn ${review.length} giao dịch chuyển khoản cần xử lý` : 'Không còn giao dịch chuyển khoản cần xử lý' }
    ];
    return { items, ok: items.every(x => x.ok), unpaid, review, remaining };
  };

  // ---------- Đối soát ----------
  // WAITING | NEEDS_RESOLUTION | RECONCILED (chỉ RECONCILED = khớp 100% = hoàn tất).
  svc.reconStatus = mp => (mp && mp.collection && mp.collection.reconciliationStatus) || 'WAITING';

  // ---------- Trạng thái tổng của 1 chợ trong kỳ (helper DUY NHẤT) ----------
  function make(id, mp, extra) { const meta = STATES[id]; return Object.assign({ id, label: meta[0], cls: meta[1], mp, closed: svc.isClosed(mp) }, extra || {}); }
  svc.stateOf = function (marketId, month) {
    const mp = svc.get(marketId, month);
    if (!mp) return make('NO_PERIOD', null);
    if (mp.monthClose && mp.monthClose.finalState) return make(mp.monthClose.finalState, mp, { legacy: !!mp.monthClose.legacy });
    if (!svc.isApplicable(mp)) return make('NOT_APPLICABLE', mp);
    if (mp.collection) {
      const rs = svc.reconStatus(mp);
      return make(rs === 'RECONCILED' ? 'COMPLETED' : rs === 'NEEDS_RESOLUTION' ? 'NEEDS_RESOLUTION' : 'WAITING_RECONCILIATION', mp, { group: 'WAITING_RECONCILIATION' });
    }
    if (svc.isIssued(mp)) return make(svc.collectionChecklist(mp).ok ? 'COLLECTION_COMPLETED' : 'COLLECTING', mp);
    const collector = A.ACCOUNTS && A.ACCOUNTS.marketCollectorState ? A.ACCOUNTS.marketCollectorState(marketId) : { status: 'ASSIGNED' };
    if (collector.status !== 'ASSIGNED') return make('UNASSIGNED', mp);
    const meter = svc.meterStatus(mp);
    if (meter === 'WAITING') return make('WAITING_METER', mp);
    if (meter === 'RECORDING') return make('METER_RECORDING', mp);
    const drafts = svc.drafts(mp), blocking = svc.blockingWarnings(mp);
    if (blocking.length) return make('NEEDS_ACTION', mp);
    if (drafts.length) return make('READY_TO_ISSUE', mp);
    return make(mp.calculatedAt ? 'NEEDS_ACTION' : 'METER_COMPLETED', mp);
  };
  svc.STATES = STATES;
  svc.FILTERS = FILTERS;
  svc.filterOf = stateId => (FILTERS.find(f => f[2].includes(stateId)) || [null])[0];
  svc.stateTag = s => `<span class="tag ${s.cls}">${U.esc(s.label)}</span>`;

  // ---------- Điều kiện chuyển bước (guard dùng ở MỌI handler) ----------
  svc.canRecordMeter = mp => !!mp && !svc.isClosed(mp) && !svc.isIssued(mp) && svc.isApplicable(mp) && ['WAITING', 'RECORDING'].includes(svc.meterStatus(mp));
  svc.canCompleteMeter = mp => { if (!svc.canRecordMeter(mp)) return false; const s = svc.meterStats(mp); return s.required > 0 && !s.unrecorded && !s.review; };
  svc.canCalculate = mp => !!mp && !svc.isClosed(mp) && !svc.isIssued(mp) && svc.isApplicable(mp) && svc.meterDone(mp);
  svc.canIssue = mp => !!mp && svc.stateOf(mp.marketId, monthOf(mp)).id === 'READY_TO_ISSUE';
  // BR/XII: chỉ thu khi kỳ của chợ đã phát hành, chưa Hoàn tất thu, chưa chốt kỳ — áp dụng cho tiền mặt, CK/QR và nút demo ngân hàng.
  svc.canCollect = mp => !!mp && svc.isIssued(mp) && !mp.collection && !svc.isClosed(mp);
  svc.canCollectInvoice = inv => !!inv && inv.billingStatus !== 'DRAFT' && inv.status !== 'paid' && svc.canCollect(svc.ofInvoice(inv));
  svc.canCompleteCollection = mp => !!mp && !svc.isClosed(mp) && svc.stateOf(mp.marketId, monthOf(mp)).id === 'COLLECTION_COMPLETED';
  svc.canReconcile = mp => !!mp && !!mp.collection && !svc.isClosed(mp) && ['WAITING', 'NEEDS_RESOLUTION'].includes(svc.reconStatus(mp));

  // NV thu phí hoàn tất ghi chỉ số (BR-03) → hệ thống tự tính nháp ngay sau đó (quyết định 2).
  svc.completeMeter = function (marketId, month, account) {
    const mp = svc.get(marketId, month);
    if (!svc.canCompleteMeter(mp)) return { ok: false, reason: 'NOT_READY' };
    const by = (account && (account.fullName || account.code || account.id)) || '';
    mp.meter = { status: 'COMPLETED', mode: 'RECORDED', completedAt: stamp(), completedBy: by, completedById: (account && account.id) || '' };
    if (U.log) U.log('Hoàn tất ghi chỉ số kỳ ' + mp.label + ' tại ' + marketId);
    A.save();
    return { ok: true, mp, calc: svc.autoCalculate(mp) };
  };
  // Tính nháp tự động khi chỉ số đã xong (hoặc chợ không cần ghi chỉ số) mà kỳ chưa từng được tính.
  svc.autoCalculate = function (mp) {
    const billing = finance.billing;
    if (!billing || !svc.canCalculate(mp)) return null;
    return billing.calculatePeriod(mp.marketId, mp.id, SYSTEM_ACTOR);
  };
  svc.autoCalculatePending = function () {
    if (!finance.billing || !A.db) return 0;
    let n = 0;
    (A.db.billingPeriods || []).filter(mp => mp.marketId && !mp.calculatedAt && svc.canCalculate(mp)).forEach(mp => { svc.autoCalculate(mp); n++; });
    return n;
  };

  // Dữ liệu nguồn (Chính sách thu và biểu phí) thay đổi → hệ thống tự tính lại nháp mọi kỳ còn được tính (đã xong chỉ số,
  // chưa phát hành, chưa chốt) để trạng thái phản ánh cấu hình mới: hết lỗi → Sẵn sàng phát hành, còn lỗi → Cần xử lý.
  // Không sửa dữ liệu cấu hình, không tự gán giá. Tổ trưởng vẫn có nút "Tính lại" ở Khoản phải thu.
  let recalculating = false;
  svc.recalculateAfterSourceChange = function () {
    if (!finance.billing || !A.db || !A.idx || recalculating) return 0;
    recalculating = true;
    let n = 0;
    try {
      (A.db.billingPeriods || []).filter(mp => mp.marketId && svc.canCalculate(mp)).forEach(mp => { finance.billing.calculatePeriod(mp.marketId, mp.id, SYSTEM_ACTOR); n++; });
    } finally { recalculating = false; }
    return n;
  };
  if (A.SERVICE_CFG && A.SERVICE_CFG.onChange) A.SERVICE_CFG.onChange(() => svc.recalculateAfterSourceChange());

  // ---------- Kỳ tháng tổng (aggregation) + chốt kỳ ----------
  svc.monthSummary = function (month) {
    const rows = svc.activeMarkets().map(m => ({ market: m, state: svc.stateOf(m.id, month) }));
    const count = id => rows.filter(r => r.state.id === id).length;
    const closed = rows.length > 0 && rows.every(r => svc.isClosed(r.state.mp));
    const pending = rows.filter(r => !CLOSABLE.includes(r.state.id));
    return { month, rows, count, closed, completed: count('COMPLETED'), notApplicable: count('NOT_APPLICABLE'), pending, canClose: !closed && rows.length > 0 && !pending.length };
  };
  // ---------- Phát hành KỲ THU (đồng loạt) — điểm phát hành nghiệp vụ DUY NHẤT ----------
  // 12 chợ dùng chung kỳ tháng: chỉ phát hành khi MỌI chợ đang hoạt động ở Sẵn sàng phát hành hoặc Không áp dụng.
  // Tương thích dữ liệu cũ: chợ đã phát hành từ trước (Đang thu trở đi) được coi là đã đạt, không phát hành lại.
  const ISSUED_OR_LATER = ['COLLECTING', 'COLLECTION_COMPLETED', 'WAITING_RECONCILIATION', 'NEEDS_RESOLUTION', 'COMPLETED'];
  svc.issueSummary = function (month) {
    const rows = svc.activeMarkets().map(m => ({ market: m, state: svc.stateOf(m.id, month) }));
    const ready = rows.filter(r => r.state.id === 'READY_TO_ISSUE'), notApplicable = rows.filter(r => r.state.id === 'NOT_APPLICABLE');
    const issued = rows.filter(r => ISSUED_OR_LATER.includes(r.state.id) && !r.state.closed);
    const blocking = rows.filter(r => r.state.id !== 'READY_TO_ISSUE' && r.state.id !== 'NOT_APPLICABLE' && !ISSUED_OR_LATER.includes(r.state.id));
    const billing = finance.billing, groups = r => billing ? billing.traderGroups(r.market.id, r.state.mp.id) : [];
    const receivables = ready.reduce((n, r) => n + groups(r).length, 0), amount = ready.reduce((n, r) => n + groups(r).reduce((a, g) => a + Number(g.amount || 0), 0), 0);
    return { month, rows, ready, notApplicable, issued, blocking, receivables, amount, closed: rows.length > 0 && rows.every(r => r.state.closed),
      canIssue: rows.length > 0 && ready.length > 0 && !blocking.length && !rows.some(r => r.state.closed) };
  };
  // Pre-validation TOÀN BỘ trước khi ghi; ghi từng chợ qua billing.issue; lỗi giữa chừng → khôi phục nguyên trạng A.db
  // (prototype không có transaction thật) để kỳ không bao giờ ở trạng thái nửa phát hành. Quyền kiểm tra ở handler.
  svc.issueMonth = function (month, account) {
    const billing = finance.billing, sum = svc.issueSummary(month);
    if (!billing) return { ok: false, reason: 'NO_BILLING' };
    if (!sum.canIssue) return { ok: false, reason: sum.ready.length ? 'NOT_READY' : 'NOTHING_TO_ISSUE', blocking: sum.blocking };
    const actor = (account && (account.fullName || account.code)) || '';
    const invalid = sum.ready.filter(r => !svc.canIssue(r.state.mp) || billing.traderGroups(r.market.id, r.state.mp.id).some(g => g.validationStatus !== 'VALID'));
    if (invalid.length) return { ok: false, reason: 'NOT_READY', blocking: invalid };
    const snapshot = JSON.stringify(A.db), results = [];
    try {
      sum.ready.forEach(r => {
        const out = billing.issue(r.market.id, r.state.mp.id, actor);
        if (!out.issued.length) throw new Error('Không phát hành được ' + (r.market.name || r.market.id));
        results.push({ market: r.market, count: out.issued.length, amount: out.issued.reduce((a, i) => a + Number(i.amount || 0), 0) });
      });
    } catch (e) {
      console.error('[market-period] Phát hành kỳ ' + month + ' thất bại — khôi phục dữ liệu trước phát hành', e);
      A.db = JSON.parse(snapshot); A.reindex(); A.save();
      return { ok: false, reason: 'ROLLED_BACK', error: e.message };
    }
    const count = results.reduce((n, x) => n + x.count, 0);
    if (U.log) U.log('Phát hành kỳ thu ' + month.slice(5) + '/' + month.slice(0, 4) + ': ' + count + ' khoản phải thu tại ' + results.length + ' chợ, ' + sum.notApplicable.length + ' chợ không áp dụng');
    A.save();
    return { ok: true, results, count, notApplicable: sum.notApplicable.length };
  };
  // XVIII: chốt kỳ tháng — xét TOÀN BỘ chợ đang hoạt động (không theo phạm vi người bấm). Quyền kiểm tra ở handler.
  svc.closeMonth = function (month, account) {
    const sum = svc.monthSummary(month);
    if (sum.closed) return { ok: false, reason: 'ALREADY_CLOSED' };
    if (!sum.canClose) return { ok: false, reason: 'NOT_READY', pending: sum.pending };
    const at = stamp(), by = (account && (account.fullName || account.code)) || '';
    sum.rows.forEach(r => { r.state.mp.monthClose = { closedAt: at, closedBy: by, closedById: (account && account.id) || '', finalState: r.state.id }; });
    if (U.log) U.log('Chốt kỳ thu ' + month.slice(5) + '/' + month.slice(0, 4) + ': ' + sum.completed + ' chợ hoàn tất, ' + sum.notApplicable + ' chợ không áp dụng');
    A.save();
    return { ok: true, summary: sum };
  };
})(window.APP);
