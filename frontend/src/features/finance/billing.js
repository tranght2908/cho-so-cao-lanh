/* Finance-owned monthly calculation: drafts are replaceable; issued invoices are snapshots. */
(function (A) {
  'use strict';
  const U = A.U, finance = A.features.finance || (A.features.finance = {}), billing = finance.billing || (finance.billing = {});
  const active = (r, d) => r && r.status === 'active' && (!r.effectiveFrom || r.effectiveFrom <= d) && (!r.effectiveTo || r.effectiveTo >= d);
  const stamp = () => U.today() + ' ' + U.nowTime();
  const clean = x => String(x || '').replace(/[^A-Za-z0-9]/g, '').slice(-18);
  function ensure(write) {
    if (!write) return;
    A.db.billingDrafts = Array.isArray(A.db.billingDrafts) ? A.db.billingDrafts : [];
    A.db.billingWarnings = Array.isArray(A.db.billingWarnings) ? A.db.billingWarnings : [];
  }
  function rate(cat, market, date, filter) {
    const rows = (A.SERVICE_CFG ? A.SERVICE_CFG.list(cat) : []).filter(x => active(x, date) && (x.marketId === market || (cat === 'stallPrices' && x.marketId === 'ALL')) && (!filter || filter(x)));
    return rows.sort((a, b) => Number(b.marketId === 'ALL') - Number(a.marketId === 'ALL') || String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')))[0] || null;
  }
  function landRate(st, date) {
    const type = { kiot: 'Ki-ốt', nhalong: 'Trong nhà lồng chợ', ngoai: 'Tự sản tự tiêu', phien: 'Quầy theo phiên' }[st.type];
    return rate('stallPrices', st.market, date, x => x.stallType === type || x.stallType === st.cat);
  }
  function landAmount(r, area) { const u = String(r.unit || ''), n = Number(r.amount || 0); return u.indexOf('m²/ngày') >= 0 ? Math.round(area * n * 30 / 1000) * 1000 : u.indexOf('m²/tháng') >= 0 ? Math.round(area * n) : n; }
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
  function calculatePeriod(market, period) {
    ensure(true);
    const bp = A.db.billingPeriods.find(x => x.id === period), out = { drafts: [], warnings: [] };
    if (!bp) { warning(out, { code: 'PERIOD_NOT_FOUND', message: 'Không tìm thấy kỳ thu.' }); return out; }
    if (A.db.issuedPeriods.includes(period)) { warning(out, { code: 'PERIOD_ALREADY_ISSUED', message: 'Kỳ thu đã phát hành, không thể tính lại.' }); return out; }
    const date = bp.endDate, handledVehicles = new Set();
    A.db.contracts.filter(c => c.market === market && c.status === 'hieuluc' && c.start <= date && (!c.end || c.end >= bp.startDate)).forEach(c => {
      const st = A.idx.stall.get(c.businessPointId || c.stallId), t = A.idx.trader.get(c.traderId);
      if (!st || !t || st.traderId !== t.id) return warning(out, { code: 'INVALID_CONTRACT_SOURCE', contractId: c.id, message: 'Hợp đồng không còn liên kết rõ ràng với điểm kinh doanh.' });
      const common = { market, period, traderId: t.id, stallId: st.id, businessPointId: st.id, contractId: c.id };
      const lp = landRate(st, date);
      if (!lp) warning(out, { code: 'MISSING_LAND_POLICY', contractId: c.id, businessPointId: st.id, message: 'Chưa có đơn giá sử dụng mặt bằng phù hợp.' });
      else { const amount = landAmount(lp, Number(st.area || 0)); out.drafts.push(draft(Object.assign({ sourceKey: 'LAND|' + c.id }, common), { chargeType: 'LAND', sourceType: 'CONTRACT', sourceId: c.id, name: itemName('LAND'), businessPointId: st.id, contractId: c.id, policyId: lp.id, policyReference: (lp.legalBasis || {}).docNo || '', quantity: Number(st.area || 0), unit: lp.unit, unitPrice: Number(lp.amount || 0), amount, explanation: 'Diện tích × đơn giá chính sách; chưa áp dụng quy tắc phân bổ ngày.' })); }
      const applies = c.serviceApplicability || {}, reading = A.db.readings.find(x => x.stallId === st.id && x.period === period), utility = (applies.electricity || applies.water) && rate('utilities', market, date);
      [['electricity', 'ELECTRICITY', 'elecPrev', 'elecCur', 'elecPrice', 'elecUnit', 'điện', 'elecAvg'], ['water', 'WATER', 'waterPrev', 'waterCur', 'waterPrice', 'waterUnit', 'nước', 'waterAvg']].forEach(x => {
        if (!applies[x[0]]) return;
        if (!utility) return warning(out, { code: 'MISSING_UTILITY_POLICY', contractId: c.id, businessPointId: st.id, chargeType: x[1], message: 'Chưa có biểu phí ' + x[6] + ' đang áp dụng.' });
        if (!reading || reading[x[3]] == null) return warning(out, { code: 'MISSING_METER_READING', contractId: c.id, businessPointId: st.id, chargeType: x[1], message: 'Thiếu chỉ số ' + x[6] + ' kỳ này.' });
        const qty = Number(reading[x[3]]) - Number(reading[x[2]]);
        if (qty < 0) return warning(out, { code: 'INVALID_METER_READING', contractId: c.id, businessPointId: st.id, chargeType: x[1], message: 'Chỉ số ' + x[6] + ' mới nhỏ hơn chỉ số cũ.' });
        const price = Number(utility[x[4]] || 0), amount = qty * price;
        if (Number(reading[x[7]]) && qty > Number(reading[x[7]]) * 1.5) warning(out, { severity: 'WARNING', code: 'ABNORMAL_CONSUMPTION', contractId: c.id, businessPointId: st.id, chargeType: x[1], message: 'Sản lượng ' + x[6] + ' cao bất thường, cần kiểm tra.' });
        out.drafts.push(draft(Object.assign({ sourceKey: x[1] + '|' + st.id }, common), { chargeType: x[1], sourceType: 'METER_READING', sourceId: st.id + '|' + period + '|' + x[0], name: itemName(x[1]), businessPointId: st.id, contractId: c.id, meter: { previous: Number(reading[x[2]]), current: Number(reading[x[3]]), consumption: qty }, policyId: utility.id, policyReference: (utility.legalBasis || {}).docNo || '', quantity: qty, unit: utility[x[5]], unitPrice: price, amount, explanation: 'Chỉ số mới − chỉ số cũ = ' + qty + ' ' + utility[x[5]] }));
      });
      if (applies.marketService) {
        const services = (A.SERVICE_CFG ? A.SERVICE_CFG.list('extraServices') : []).filter(x => x.marketId === market && x.category !== 'VEHICLE' && active(x, date));
        if (!services.length) warning(out, { severity: 'WARNING', code: 'NO_MARKET_SERVICE_POLICY', contractId: c.id, businessPointId: st.id, message: 'Có áp dụng dịch vụ chợ nhưng chưa có biểu phí.' });
        services.forEach(s => { const qty = s.calcMethod === 'area' ? Number(st.area || 0) : 1, amount = s.calcMethod === 'area' ? Math.round(qty * Number(s.amount || 0)) : Number(s.amount || 0); out.drafts.push(draft(Object.assign({ sourceKey: 'SERVICE|' + c.id + '|' + s.id }, common), { chargeType: 'MARKET_SERVICE', sourceType: 'SERVICE_POLICY', sourceId: s.id, name: itemName('MARKET_SERVICE', s), businessPointId: st.id, contractId: c.id, policyId: s.id, policyReference: (s.legalBasis || {}).docNo || '', quantity: qty, unit: s.unit, unitPrice: Number(s.amount || 0), amount, explanation: s.calcMethod === 'area' ? 'Diện tích × mức dịch vụ.' : 'Mức dịch vụ cố định.' })); });
      }
      (A.db.traderVehicles || []).filter(v => v.traderId === t.id && v.market === market && v.status === 'ACTIVE' && v.startDate <= date && (!v.endDate || v.endDate >= bp.startDate)).forEach(v => {
        if (handledVehicles.has(v.id)) return; handledVehicles.add(v.id);
        const vp = rate('extraServices', market, date, x => x.category === 'VEHICLE' && x.vehicleType === v.type);
        if (!vp) return warning(out, { severity: 'WARNING', code: 'MISSING_VEHICLE_POLICY', vehicleId: v.id, traderId: t.id, message: 'Phương tiện ' + v.plateNumber + ' chưa có biểu phí phù hợp.' });
        const amount = Number(vp.amount || 0); out.drafts.push(draft(Object.assign({ sourceKey: 'VEHICLE|' + v.id, vehicleId: v.id }, common), { chargeType: 'VEHICLE', sourceType: 'VEHICLE_REGISTRATION', sourceId: v.id, name: itemName('VEHICLE', v), vehicleId: v.id, businessPointId: st.id, contractId: c.id, policyId: vp.id, policyReference: (vp.legalBasis || {}).docNo || '', quantity: 1, unit: vp.unit, unitPrice: amount, amount, explanation: 'Phương tiện ' + v.plateNumber + ' · ' + v.type + '.' }));
      });
    });
    // Issued receivables are immutable. Recalculation replaces only this period's
    // mutable drafts and never recreates a source that has already been issued.
    const issuedKeys = new Set(A.db.invoices.filter(x => x.market === market && x.period === period && x.sourceKey).map(x => x.sourceKey));
    out.drafts = out.drafts.filter(x => !issuedKeys.has(x.sourceKey));
    A.db.billingDrafts = A.db.billingDrafts.filter(x => !(x.market === market && x.period === period)).concat(out.drafts);
    A.db.billingWarnings = A.db.billingWarnings.filter(x => !(x.market === market && x.period === period)).concat(out.warnings.map(x => Object.assign({ market, period }, x)));
    bp.calculationStatus = out.warnings.some(x => x.severity === 'BLOCKING') ? 'REVIEW_REQUIRED' : 'DRAFT_CALCULATED'; A.save(); return out;
  }
  function drafts(m, p) { return (Array.isArray(A.db.billingDrafts) ? A.db.billingDrafts : []).filter(x => x.market === m && x.period === p); }
  function warnings(m, p) { return (Array.isArray(A.db.billingWarnings) ? A.db.billingWarnings : []).filter(x => x.market === m && x.period === p); }
  function openNextPeriod() {
    const all = A.db.billingPeriods.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const last = all[all.length - 1];
    if (!last) return null;
    const [year, month] = last.id.split('-').map(Number), d = new Date(year, month, 1);
    const id = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const existing = A.db.billingPeriods.find(x => x.id === id);
    if (existing) return existing;
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
    const next = { id, label: m + '/' + y, startDate: y + '-' + m + '-01', endDate: y + '-' + m + '-' + lastDay, dueDate: y + '-' + m + '-15', status: 'OPEN', calculationStatus: 'DATA_ENTRY' };
    A.db.billingPeriods.push(next);
    if (!(A.db.meterPeriods || []).some(x => x.id === id)) A.db.meterPeriods.push({ id, month: Number(m), year: y, status: 'RECORDING', closeDate: y + '-' + m + '-' + lastDay });
    A.save(); return next;
  }
  function issue(market, period, actor) {
    const bp = A.db.billingPeriods.find(x => x.id === period), list = drafts(market, period), blocks = warnings(market, period).filter(x => x.severity === 'BLOCKING');
    if (!bp || !list.length || blocks.length) return { issued: [], blocking: blocks };
    const issued = [];
    list.forEach(d => { if (A.db.invoices.some(x => x.sourceKey === d.sourceKey && x.market === market && x.period === period)) return; const inv = Object.assign({}, d, { id: 'PT-' + period.replace('-', '') + '-' + U.pad(A.db.invoices.length + 1, 5), status: 'unpaid', issued: U.today(), issuedAt: stamp(), issuedBy: actor || '', due: bp.dueDate, billingStatus: 'ISSUED', items: d.items.map(x => Object.assign({}, x, { status: 'ISSUED' })) }); A.db.invoices.push(inv); issued.push(inv); });
    A.db.billingDrafts = A.db.billingDrafts.filter(x => !(x.market === market && x.period === period)); if (!A.db.issuedPeriods.includes(period)) A.db.issuedPeriods.push(period);
    bp.status = 'COLLECTING'; bp.calculationStatus = 'ISSUED'; bp.issuedAt = stamp(); bp.issuedBy = actor || ''; A.reindex(); A.save(); return { issued, blocking: [] };
  }
  Object.assign(billing, { ensure, calculatePeriod, drafts, warnings, issue, openNextPeriod });
})(window.APP);
