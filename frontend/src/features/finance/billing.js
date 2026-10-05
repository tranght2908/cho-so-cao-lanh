/* Finance-owned monthly calculation: drafts are replaceable; issued invoices are snapshots.
 * Tính nháp + phát hành theo KỲ CỦA CHỢ (marketId + YYYY-MM, xem features/finance/market-period.js): phát hành chợ A
 * không đổi trạng thái/không chặn tính lại chợ B. Kỳ tính tiền (BR-05): mặt bằng = THÁNG KẾ TIẾP; điện/nước/dịch vụ = tháng của kỳ. */
(function (A) {
  'use strict';
  const U = A.U, finance = A.features.finance || (A.features.finance = {}), billing = finance.billing || (finance.billing = {});
  const active = (r, d) => r && r.status === 'active' && (!r.effectiveFrom || r.effectiveFrom <= d) && (!r.effectiveTo || r.effectiveTo >= d);
  const stamp = () => U.today() + ' ' + U.nowTime();
  const clean = x => String(x || '').replace(/[^A-Za-z0-9]/g, '').slice(-18);
  const MP = () => A.features.finance.marketPeriod;
  function ensure(write) {
    if (!write) return;
    A.db.billingDrafts = Array.isArray(A.db.billingDrafts) ? A.db.billingDrafts : [];
    A.db.billingWarnings = Array.isArray(A.db.billingWarnings) ? A.db.billingWarnings : [];
  }
  function rate(cat, market, date, filter) {
    const rows = (A.SERVICE_CFG ? A.SERVICE_CFG.list(cat) : []).filter(x => active(x, date) && x.marketId === market && (!filter || filter(x)));
    return rows.sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')))[0] || null;
  }
  function landRate(st, date) {
    const type = { kiot: 'Ki-ốt', nhalong: 'Trong nhà lồng chợ', ngoai: 'Tự sản tự tiêu', phien: 'Quầy theo phiên' }[st.type];
    // Bản ghi mới định danh bằng areaTypeId. Bản ghi legacy chưa có mã vẫn
    // được đọc qua type để không làm mất khả năng render dữ liệu cũ.
    return rate('stallPrices', st.market, date, x => x.areaTypeId ? x.areaTypeId === st.areaTypeId : x.stallType === type);
  }
  function landAmount(r, area, days) { const u = String(r.unit || ''), n = Number(r.amount || 0); return u.indexOf('m²/ngày') >= 0 ? Math.round(area * n * days) : u.indexOf('m²/tháng') >= 0 ? Math.round(area * n) : n; }
  function nextMonth(period) { const [year, month] = period.split('-').map(Number), d = new Date(year, month, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function daysInPeriod(period) { const [year, month] = period.split('-').map(Number); return new Date(year, month, 0).getDate(); }
  function warning(out, x) { out.warnings.push(Object.assign({ severity: 'BLOCKING' }, x)); }
  function itemName(type, meta) {
    if (type === 'LAND') return 'Phí sử dụng mặt bằng';
    if (type === 'ELECTRICITY') return 'Tiền điện';
    if (type === 'WATER') return 'Tiền nước';
    if (type === 'MARKET_SERVICE') return meta.name || 'Dịch vụ chợ';
    return 'Phí gửi xe ' + (meta.plateNumber || '');
  }
  function draft(base, item) {
    const key = base.sourceKey;
    return Object.assign({ id: 'DPT-' + base.market + '-' + base.period.replace('-', '') + '-' + clean(key), status: 'DRAFT', paid: 0, createdAt: stamp(), updatedAt: stamp(), items: [Object.assign({ id: 'ITEM-' + clean(key), status: 'DRAFT' }, item)] }, base, { amount: item.amount });
  }
  function periodContext(market, reference) {
    const bp = A.periods && A.periods.resolve ? A.periods.resolve(market, reference) : A.db.billingPeriods.find(x => x.id === reference);
    return bp ? { bp, id: bp.id, period: A.periods && A.periods.periodKey ? A.periods.periodKey(bp) : (bp.period || bp.id) } : null;
  }
  function periodMatch(row, market, bp) {
    return A.periods && A.periods.matchesEntity ? A.periods.matchesEntity(row, bp, market) : row.market === market && row.period === bp.id;
  }
  function calculatePeriod(market, period, actor) {
    ensure(true);
    const ctx = periodContext(market, period), bp = ctx && ctx.bp, out = { drafts: [], warnings: [] };
    if (!bp || bp.marketId !== market) { warning(out, { code: 'PERIOD_NOT_FOUND', message: 'Không tìm thấy kỳ thu của chợ.' }); return out; }
    if (MP().isClosed(bp)) { warning(out, { code: 'PERIOD_CLOSED', message: 'Kỳ thu đã chốt, không thể tính lại.' }); return out; }
    if (MP().isIssued(bp)) { warning(out, { code: 'PERIOD_ALREADY_ISSUED', message: 'Kỳ thu của chợ đã phát hành, không thể tính lại.' }); return out; }
    period = ctx.period;
    const stampCalc = () => { bp.calculatedAt = stamp(); bp.calculatedBy = actor || ''; };
    if (!MP().meterDone(bp)) {
      warning(out, { code: 'METER_PERIOD_NOT_CLOSED', message: 'Chỉ số điện, nước của kỳ chưa hoàn tất và khóa.' });
      A.db.billingWarnings = A.db.billingWarnings.filter(x => !periodMatch(x, market, bp)).concat(out.warnings.map(x => Object.assign({ market, marketId: market, period, billingPeriodId: bp.id }, x)));
      stampCalc(); A.save(); return out;
    }
    const landPeriod = nextMonth(period), landDate = landPeriod + '-01', landDays = daysInPeriod(landPeriod), date = bp.endDate;
    MP().contracts(bp).forEach(c => {
      const st = A.idx.stall.get(c.businessPointId || c.stallId), t = A.idx.trader.get(c.traderId);
      if (!t) return warning(out, { code: 'MISSING_TRADER', contractId: c.id, message: 'Hợp đồng thiếu tiểu thương liên kết.' });
      if (!st) return warning(out, { code: 'MISSING_BUSINESS_POINT', contractId: c.id, traderId: t.id, message: 'Hợp đồng không tìm thấy Điểm kinh doanh.' });
      if (st.traderId !== t.id) return warning(out, { code: 'INVALID_CONTRACT_SOURCE', contractId: c.id, traderId: t.id, businessPointId: st.id, message: 'Hợp đồng không còn liên kết rõ ràng với điểm kinh doanh.' });
      const common = { market, marketId: market, period, billingPeriodId: bp.id, traderId: t.id, stallId: st.id, businessPointId: st.id, contractId: c.id };
      if (!Number.isFinite(Number(st.area)) || Number(st.area) <= 0) return warning(out, { code: 'MISSING_AREA', contractId: c.id, traderId: t.id, businessPointId: st.id, message: 'Điểm kinh doanh thiếu diện tích hợp lệ.' });
      if (!st.areaTypeId) return warning(out, { code: 'MISSING_AREA_TYPE', contractId: c.id, traderId: t.id, businessPointId: st.id, message: 'Điểm kinh doanh thiếu loại diện tích.' });
      const lp = landRate(st, landDate);
      if (!lp) warning(out, { code: 'MISSING_LAND_POLICY', contractId: c.id, businessPointId: st.id, message: 'Chưa có đơn giá sử dụng mặt bằng phù hợp.' });
      else { const quantity = Number(st.area || 0), key = 'LAND|' + c.id, amount = landAmount(lp, quantity, landDays), row = draft(Object.assign({ sourceKey: key }, common), { chargeType: 'LAND', sourceType: 'CONTRACT', sourceId: c.id, name: 'Mặt bằng ' + landPeriod.slice(5) + '/' + landPeriod.slice(0, 4), businessPointId: st.id, contractId: c.id, policyId: lp.id, policyReference: (lp.legalBasis || {}).docNo || '', quantity, unit: lp.unit, unitPrice: Number(lp.amount || 0), days: landDays, feePeriod: landPeriod, amount, explanation: quantity + ' m² × ' + Number(lp.amount || 0).toLocaleString('vi-VN') + ' ' + lp.unit + ' × ' + landDays + ' ngày' }); out.drafts.push(row); }
      // HINH_THUC_THU_DIEN_NUOC: chợ thu điện, nước chia đều như dịch vụ → không tạo dòng theo công tơ.
      const applies = A.SERVICE_CFG && A.SERVICE_CFG.utilityMode(market) === 'SERVICE' ? Object.assign({}, c.serviceApplicability || {}, { electricity: false, water: false }) : (c.serviceApplicability || {}), reading = A.db.readings.find(x => x.stallId === st.id && (x.billingPeriodId === bp.id || (!x.billingPeriodId && x.period === period)));
      [['electricity', 'ELECTRICITY', 'elecPrev', 'elecCur', 'elecPrice', 'elecUnit', 'điện', 'elecAvg'], ['water', 'WATER', 'waterPrev', 'waterCur', 'waterPrice', 'waterUnit', 'nước', 'waterAvg']].forEach(x => {
        if (!applies[x[0]]) return;
        // Đơn giá điện / nước là 2 bản ghi riêng (kind); bản ghi cũ chưa có kind vẫn dùng chung cho cả hai.
        const utility = rate('utilities', market, date, u => (!u.kind || u.kind === x[1]) && u[x[4]] != null);
        if (!utility) return warning(out, { code: 'MISSING_UTILITY_POLICY', contractId: c.id, businessPointId: st.id, chargeType: x[1], message: 'Chưa có biểu phí ' + x[6] + ' đang áp dụng.' });
        if (!reading || reading[x[3]] == null || reading[x[2]] == null || reading.reviewRequired) return warning(out, { code: 'MISSING_METER_READING', contractId: c.id, businessPointId: st.id, chargeType: x[1], message: 'Thiếu chỉ số ' + x[6] + ' đã hợp lệ.' });
        const qty = Number(reading[x[3]]) - Number(reading[x[2]]);
        if (qty < 0) return warning(out, { code: 'INVALID_METER_READING', contractId: c.id, businessPointId: st.id, chargeType: x[1], message: 'Chỉ số ' + x[6] + ' mới nhỏ hơn chỉ số cũ.' });
        const price = Number(utility[x[4]] || 0), amount = qty * price;
        // Cảnh báo tiêu thụ bất thường chỉ chặn khi NV CHƯA kiểm tra/xác nhận chỉ số.
        if (Number(reading[x[7]]) && qty > Number(reading[x[7]]) * 1.5 && !MP().readingConfirmed(reading)) warning(out, { code: 'ABNORMAL_CONSUMPTION', contractId: c.id, traderId: t.id, businessPointId: st.id, chargeType: x[1], message: 'Sản lượng ' + x[6] + ' cao bất thường, cần xử lý ở dữ liệu nguồn.' });
        const key = x[1] + '|' + c.id, row = draft(Object.assign({ sourceKey: key }, common), { chargeType: x[1], sourceType: 'METER_READING', sourceId: st.id + '|' + period + '|' + x[0], name: x[6].charAt(0).toUpperCase() + x[6].slice(1) + ' ' + period.slice(5) + '/' + period.slice(0, 4), businessPointId: st.id, contractId: c.id, meter: { previous: Number(reading[x[2]]), current: Number(reading[x[3]]), consumption: qty }, policyId: utility.id, policyReference: (utility.legalBasis || {}).docNo || '', quantity: qty, unit: utility[x[5]], unitPrice: price, feePeriod: period, amount, explanation: Number(reading[x[3]]).toLocaleString('vi-VN') + ' − ' + Number(reading[x[2]]).toLocaleString('vi-VN') + ' = ' + qty + ' ' + utility[x[5]] }); out.drafts.push(row);
      });
      if (applies.marketService) {
        const services = (A.SERVICE_CFG ? A.SERVICE_CFG.list('extraServices') : []).filter(x => x.marketId === market && x.category !== 'VEHICLE' && active(x, date));
        if (!services.length) warning(out, { code: 'MISSING_SERVICE_POLICY', contractId: c.id, traderId: t.id, businessPointId: st.id, message: 'Hợp đồng đăng ký Dịch vụ nhưng chưa có biểu phí đang hiệu lực.' });
        services.forEach(s => { const qty = s.calcMethod === 'area' ? Number(st.area || 0) : 1, amount = s.calcMethod === 'area' ? Math.round(qty * Number(s.amount || 0)) : Number(s.amount || 0), key = 'SERVICE|' + c.id + '|' + s.id, row = draft(Object.assign({ sourceKey: key }, common), { chargeType: 'MARKET_SERVICE', sourceType: 'SERVICE_POLICY', sourceId: s.id, name: 'Dịch vụ ' + period.slice(5) + '/' + period.slice(0, 4) + ' · ' + s.name, businessPointId: st.id, contractId: c.id, policyId: s.id, policyReference: (s.legalBasis || {}).docNo || '', quantity: qty, unit: s.unit, unitPrice: Number(s.amount || 0), feePeriod: period, amount, explanation: s.calcMethod === 'area' ? qty + ' m² × ' + Number(s.amount || 0).toLocaleString('vi-VN') + ' ' + s.unit : 'Mức thu gói dịch vụ đang áp dụng.' }); out.drafts.push(row); });
      }
    });
    // Issued receivables are immutable. Recalculation replaces only this period's
    // mutable drafts and never recreates a source that has already been issued.
    const issuedKeys = issuedSourceKeys(market, period);
    out.drafts = out.drafts.filter(x => !issuedKeys.has(x.sourceKey));
    A.db.billingDrafts = A.db.billingDrafts.filter(x => !periodMatch(x, market, bp)).concat(out.drafts);
    A.db.billingWarnings = A.db.billingWarnings.filter(x => !periodMatch(x, market, bp)).concat(out.warnings.map(x => Object.assign({ market, marketId: market, period, billingPeriodId: bp.id }, x)));
    stampCalc(); A.save(); return out;
  }
  // Khoản đã phát hành có thể gộp nhiều nguồn (sourceKeys) khi chợ cấu hình receivableGrouping 'TRADER'.
  function issuedSourceKeys(market, period) {
    const ctx = periodContext(market, period), bp = ctx && ctx.bp;
    const keys = new Set();
    A.db.invoices.filter(x => bp && periodMatch(x, market, bp)).forEach(x => (Array.isArray(x.sourceKeys) ? x.sourceKeys : [x.sourceKey]).forEach(k => { if (k) keys.add(k); }));
    return keys;
  }
  function nextInvoiceId(period) {
    const prefix = 'PT-' + period.replace('-', '') + '-';
    const max = A.db.invoices.reduce((m, x) => String(x.id).indexOf(prefix) === 0 ? Math.max(m, Number(String(x.id).slice(prefix.length)) || 0) : m, 0);
    return prefix + U.pad(max + 1, 5);
  }
  function drafts(m, p) { const c = periodContext(m, p); return (Array.isArray(A.db.billingDrafts) ? A.db.billingDrafts : []).filter(x => c && periodMatch(x, m, c.bp)); }
  function warnings(m, p) { const c = periodContext(m, p); return (Array.isArray(A.db.billingWarnings) ? A.db.billingWarnings : []).filter(x => c && periodMatch(x, m, c.bp)); }
  function traderGroups(market, period) {
    const byTrader = new Map();
    drafts(market, period).forEach(d => { if (!byTrader.has(d.traderId)) byTrader.set(d.traderId, []); byTrader.get(d.traderId).push(d); });
    warnings(market, period).filter(w => w.contractId).forEach(w => {
      const c = (A.db.contracts || []).find(x => x.id === w.contractId), traderId = w.traderId || (c && c.traderId);
      if (traderId && !byTrader.has(traderId)) byTrader.set(traderId, []);
    });
    return Array.from(byTrader.entries()).map(([traderId, rows]) => {
      const errors = warnings(market, period).filter(w => w.traderId === traderId || (w.contractId && (A.db.contracts || []).find(c => c.id === w.contractId && c.traderId === traderId)));
      // Chỉ cảnh báo BLOCKING mới làm hồ sơ không hợp lệ và chặn phát hành.
      // Các cảnh báo mức thấp vẫn cần hiển thị để rà soát nhưng không được biến
      // một hồ sơ đang hợp lệ thành lỗi chặn ở màn Khoản phải thu.
      const blockingErrors = errors.filter(w => String(w.severity || 'BLOCKING').toUpperCase() === 'BLOCKING');
      const contractIds = Array.from(new Set(rows.map(x => x.contractId).concat(errors.map(x => x.contractId).filter(Boolean))));
      return { traderId, rows, contractIds, amount: rows.reduce((sum, x) => sum + Number(x.amount || 0), 0), validationStatus: blockingErrors.length ? 'HAS_ERRORS' : 'VALID', errors, blockingErrors };
    });
  }
  // PHAT_HANH_KHOAN_THU: phát hành = (1) sinh mã PT-…, (2) gửi notification riêng cho TỪNG tiểu thương
  // (traderId/referenceId; legacy traderLines vẫn được portal đọc để tương thích record cũ), (3) chuyển danh sách thu cho NV thu phí được phân
  // công theo Market hiện tại (Account.marketScopes). Danh sách của NV luôn đọc trực tiếp từ khoản phải thu
  // theo Market; không suy ra từ Dãy/Điểm.
  function notifyIssued(market, period, issued, actor) {
    if (!issued.length) return;
    const cfg = (A.NOTIFICATIONS && A.NOTIFICATIONS.eventByKey && A.NOTIFICATIONS.eventByKey('RECEIVABLE_ISSUED')) || (A.db.notificationEventConfigs || []).find(x => x.eventKey === 'RECEIVABLE_ISSUED') || { enabled: true, recipients: ['trader', 'fee_collector'], channels: ['Mini app', 'Zalo OA'], templates: {} };
    if (cfg && !cfg.enabled) return;
    A.db.notifications = Array.isArray(A.db.notifications) ? A.db.notifications : [];
    const mk = U.market(market) || {}, label = period.slice(5) + '/' + period.slice(0, 4);
    const nextId = () => 'TB-' + U.pad(32 + A.db.notifications.length, 3);
    const template = (role, fallback) => Object.assign({}, fallback, ((cfg.templates || {})[role] || {}));
    const fill = (text, data) => String(text || '').replace(/\{([A-Za-z]+)\}/g, (_, key) => data[key] == null ? '{' + key + '}' : String(data[key]));
    const has = key => A.db.notifications.some(n => n.notificationKey === key);
    const add = rec => { if (!has(rec.notificationKey)) A.db.notifications.unshift(Object.assign({ id: nextId(), at: U.today(), kind: 'RECEIVABLE_ISSUED', eventKey: 'RECEIVABLE_ISSUED', eventConfigKey: 'RECEIVABLE_ISSUED', market, marketId: market, period, channels: cfg.channels || [], sent: 1, delivered: 1, read: 0, auto: true, by: actor || '' }, rec)); };
    if ((cfg.recipients || []).includes('trader')) issued.forEach(i => {
      const trader = A.idx.trader.get(i.traderId) || {}, data = { traderName: trader.name || i.traderId, period: label, marketName: mk.name || market, totalAmount: U.money(i.amount), amount: U.money(i.amount), dueDate: U.dmy(i.due), receivableCode: i.id, paymentReference: i.paymentReference || '', qrReference: (i.qrReference || {}).reference || '' }, tpl = template('trader', { title: 'Khoản phải thu kỳ {period} đã được phát hành', body: 'Khoản phải thu kỳ {period} tại {marketName} đã được phát hành. Tổng tiền: {totalAmount}. Hạn thanh toán: {dueDate}. Vui lòng xem chi tiết và thực hiện thanh toán.' });
      add({ notificationKey: ['RECEIVABLE_ISSUED', market, period, 'TRADER', i.traderId, i.id].join('|'), recipientType: 'TRADER', recipientId: i.traderId, traderId: i.traderId, receivableId: i.id, referenceId: i.id, title: fill(tpl.title, data), body: fill(tpl.body, data), group: trader.name || i.traderId, action: { label: 'Xem khoản phải thu', route: 'phai-thu', referenceId: i.id } });
    });
    const collector = A.ACCOUNTS && A.ACCOUNTS.getMarketCollector && A.ACCOUNTS.getMarketCollector(market);
    if ((cfg.recipients || []).includes('fee_collector') && collector && A.allowedMarkets(collector).includes(market)) {
      const total = issued.reduce((sum, i) => sum + Number(i.amount || 0), 0), due = issued[0].due, data = { collectorName: collector.fullName || collector.id, period: label, marketName: mk.name || market, receivableCount: issued.length, totalAmount: U.money(total), dueDate: U.dmy(due) }, tpl = template('fee_collector', { title: 'Đã phát hành khoản phải thu kỳ {period}', body: 'Chợ {marketName} đã phát hành {receivableCount} khoản phải thu. Tổng cần thu: {totalAmount}. Hạn thanh toán: {dueDate}. Vui lòng theo dõi danh sách thu.' });
      add({ notificationKey: ['RECEIVABLE_ISSUED', market, period, 'FEE_COLLECTOR', collector.id, 'BATCH'].join('|'), recipientType: 'FEE_COLLECTOR', recipientId: collector.id, collectorId: collector.id, batchId: market + '|' + period, title: fill(tpl.title, data), body: fill(tpl.body, data), group: collector.fullName || collector.id, action: { label: 'Xem danh sách thu', route: 'phai-thu', market, period } });
    }
  }
  function issue(market, period, actor) {
    const ctx = periodContext(market, period), bp = ctx && ctx.bp, list = drafts(market, period), blocks = warnings(market, period).filter(x => x.severity === 'BLOCKING'), groups = traderGroups(market, period);
    // Chỉ phát hành kỳ của ĐÚNG chợ đang ở Sẵn sàng phát hành (đã hoàn tất chỉ số, 0 lỗi chặn, chưa phát hành, chưa chốt kỳ).
    if (!bp || bp.marketId !== market || !MP().canIssue(bp) || !list.length || blocks.length || groups.some(g => g.validationStatus !== 'VALID')) return { issued: [], blocking: blocks, invalid: groups.filter(g => g.validationStatus !== 'VALID') };
    period = ctx.period;
    const issued = [];
    const done = issuedSourceKeys(market, period), fresh = list.filter(d => !done.has(d.sourceKey));
    const base = { status: 'unpaid', issued: U.today(), issuedAt: stamp(), issuedBy: actor || '', publishedAt: stamp(), publishedBy: actor || '', due: bp.dueDate, billingStatus: 'PUBLISHED' };
    const lineOf = d => d.items.map(x => Object.assign({}, x, { status: 'PUBLISHED', stallId: d.stallId || null, contractId: d.contractId || null }));
    {
      // Workflow mới luôn gộp 1 khoản phải thu / tiểu thương / kỳ, độc lập với cấu hình legacy của chợ.
      const byTrader = new Map();
      fresh.forEach(d => { if (!byTrader.has(d.traderId)) byTrader.set(d.traderId, []); byTrader.get(d.traderId).push(d); });
      byTrader.forEach(ds => {
        const uniq = a => a.filter((v, n) => v && a.indexOf(v) === n);
        const items = [].concat.apply([], ds.map(lineOf));
        const id = nextInvoiceId(period);
        // traderId remains the ownership key. accountId is snapshot only when the
        // profile has exactly one active trader account; ambiguous links stay null.
        const linkedAccount = A.ACCOUNTS && A.ACCOUNTS.byTraderId ? A.ACCOUNTS.byTraderId(ds[0].traderId) : null;
        const accountId = linkedAccount && A.ACCOUNTS.authStatus && A.ACCOUNTS.authStatus(linkedAccount) === 'ACTIVE' ? linkedAccount.id : null;
        const inv = Object.assign({}, ds[0], base, { id, accountId, sourceKeys: ds.map(d => d.sourceKey), stallIds: uniq(ds.map(d => d.stallId)), contractIds: uniq(ds.map(d => d.contractId)), items, amount: items.reduce((a, b) => a + Number(b.amount || 0), 0), paid: 0, paymentReference: 'CHOSO ' + id, qrReference: { reference: 'CHOSO ' + id, generatedAt: stamp(), mock: true } });
        A.db.invoices.push(inv); issued.push(inv);
      });
    }
    A.db.billingDrafts = A.db.billingDrafts.filter(x => !periodMatch(x, market, bp));
    // Phát hành ghi mốc lên kỳ CỦA CHỢ (identity marketId + kỳ) — không đánh dấu cả tháng, không đổi kỳ chợ khác.
    // Đã phát hành → Đang thu: không có thao tác "Bắt đầu thu" riêng.
    A.periods.markIssued(bp);
    bp.issuance = { issuedAt: stamp(), issuedBy: actor || '', count: issued.length, amount: issued.reduce((sum, i) => sum + Number(i.amount || 0), 0) };
    A.reindex();
    if (U.log) U.log('Phát hành ' + issued.length + ' khoản phải thu kỳ ' + (bp.label || period) + ' tại ' + ((U.market(market) || {}).name || market));
    notifyIssued(market, period, issued, actor); A.save(); return { issued, blocking: [] };
  }
  Object.assign(billing, { ensure, calculatePeriod, drafts, warnings, traderGroups, issue, nextMonth, daysInPeriod });
})(window.APP);
