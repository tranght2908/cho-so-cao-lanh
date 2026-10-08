/* Finance-owned monthly calculation: drafts are replaceable; issued invoices are snapshots.
 * Tính nháp + phát hành theo KỲ CỦA CHỢ (marketId + YYYY-MM, xem features/finance/market-period.js): phát hành chợ A
 * không đổi trạng thái/không chặn tính lại chợ B.
 * Tháng của từng khoản (BR-05, chốt 10/2026) — KHÔNG suy từ khoảng đi thu (startDate/dueDate):
 *   Điện / Nước = THÁNG SỬ DỤNG = tháng của ngày ghi chỉ số (vd ghi 28/10 → tháng 10; khoảng dùng 28/09 → 28/10);
 *   Dịch vụ     = tháng sử dụng (phí theo tháng, không chia ngày);
 *   Mặt bằng    = thu TRƯỚC cho tháng kế tiếp tháng sử dụng (vd tháng 11), quy ước 1 tháng = 30 ngày.
 * Hợp đồng được xét theo NGÀY HIỆU LỰC của chính nó với tháng/khoảng của từng khoản (không theo người đang thuê điểm hôm nay). */
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
  // Chỉ cấu hình mức thu RIÊNG của chợ (SERVICE_CFG.isMarketOwnedPolicy) — không dùng bản ghi SHARED/QĐ 480.
  const owned = (x, market) => A.SERVICE_CFG && A.SERVICE_CFG.isMarketOwnedPolicy ? A.SERVICE_CFG.isMarketOwnedPolicy(x, market) : x.marketId === market;
  function rate(cat, market, date, filter) {
    const rows = (A.SERVICE_CFG ? A.SERVICE_CFG.list(cat) : []).filter(x => active(x, date) && owned(x, market) && (!filter || filter(x)));
    return rows.sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')))[0] || null;
  }
  function landRate(st, date) {
    const resolved = A.SERVICE_CFG && A.SERVICE_CFG.resolveApplicableMarketFeePolicy
      ? A.SERVICE_CFG.resolveApplicableMarketFeePolicy({ point: st, startDate: date }) : null;
    if (resolved) return resolved;
    // Không fallback sang mức dùng chung (SHARED/QĐ 480): thiếu mức thu riêng = thiếu cấu hình (quyết định 10/2026).
    const type = { kiot: 'Ki-ốt', nhalong: 'Trong nhà lồng chợ', ngoai: 'Tự sản tự tiêu', phien: 'Quầy theo phiên' }[st.type];
    // Bản ghi mới định danh bằng areaTypeId. Bản ghi legacy chưa có mã vẫn
    // được đọc qua type để không làm mất khả năng render dữ liệu cũ.
    return rate('stallPrices', st.market, date, x => x.areaTypeId ? x.areaTypeId === st.areaTypeId : x.stallType === type);
  }
  // Khoản thu chợ đã chuyển "Không áp dụng" (Chính sách thu) không phát sinh ở kỳ sau ngày ngừng áp dụng, kể cả
  // với hợp đồng cũ đã đăng ký; kỳ trước đó và khoản đã phát hành không đổi (SERVICE_CFG.chargeActiveAt).
  function chargeApplies(market, sa, date) {
    const on = k => !A.SERVICE_CFG || !A.SERVICE_CFG.chargeActiveAt || A.SERVICE_CFG.chargeActiveAt(market, k, date);
    return Object.assign({}, sa, { electricity: !!sa.electricity && on('electricity'), water: !!sa.water && on('water'), marketService: !!sa.marketService && on('service') });
  }
  // Mức mặt bằng cho `days` ngày (quy ước tháng 30 ngày — LAND_MONTH_DAYS):
  //   đ/m²/ngày        → diện tích × đơn giá × days;
  //   đ/m²/tháng       → diện tích × đơn giá tháng × days / 30;
  //   mức cố định/tháng → mức cố định × days / 30.
  // Đủ tháng (days = 30) → đúng 100% mức tháng. Làm tròn đến đồng (Math.round), như công thức theo ngày.
  function landAmount(r, area, days) {
    const u = String(r.unit || ''), n = Number(r.amount || 0), d = days == null ? 30 : Number(days);
    if (u.indexOf('m²/ngày') >= 0) return Math.round(area * n * d);
    const monthly = u.indexOf('m²/tháng') >= 0 ? area * n : n;
    return d >= 30 ? Math.round(monthly) : Math.round(monthly * d / 30);
  }
  // Mặt bằng: quy ước 1 tháng = 30 ngày. Hợp đồng phủ trọn tháng → 30 ngày (kể cả tháng 28/29/31 ngày);
  // không phủ trọn → số ngày hiệu lực trong tháng, đếm theo lịch 30 ngày (ngày 31 quy về 30), tối đa 30.
  // Ví dụ: hết hạn 15/11 → 1..15 = 15 ngày; bắt đầu 15/11 → 15..30 = 16 ngày; bắt đầu 15/12 → 15..30 = 16 ngày.
  const LAND_MONTH_DAYS = 30;
  function landBillableDays(c, month) {
    const [y, m] = month.split('-').map(Number), first = month + '-01', last = month + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
    if (!c || !c.start || c.start > last || (c.end && c.end < first)) return 0;
    const from = c.start <= first ? 1 : Math.min(Number(c.start.slice(8, 10)), LAND_MONTH_DAYS);
    const to = !c.end || c.end >= last ? LAND_MONTH_DAYS : Math.min(Number(c.end.slice(8, 10)), LAND_MONTH_DAYS);
    return Math.max(0, Math.min(LAND_MONTH_DAYS, to - from + 1));
  }
  const monthLabel = month => month.slice(5) + '/' + month.slice(0, 4);
  function landExplain(lp, area, days) {
    const u = String(lp.unit || ''), price = Number(lp.amount || 0).toLocaleString('vi-VN') + ' ' + u;
    if (u.indexOf('m²/ngày') >= 0) return area + ' m² × ' + price + ' × ' + days + ' ngày';
    const base = u.indexOf('m²/tháng') >= 0 ? area + ' m² × ' + price : price;
    return days >= LAND_MONTH_DAYS ? base : base + ' × ' + days + '/30 ngày';
  }
  // "đ/kWh" → "kWh": đơn vị của SẢN LƯỢNG (chỉ để hiển thị), không đổi công thức.
  const consumptionUnit = unit => String(unit || '').replace(/^\s*đ\s*\//, '').trim() || String(unit || '');
  function nextMonth(period) { const [year, month] = period.split('-').map(Number), d = new Date(year, month, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function daysInPeriod(period) { const [year, month] = period.split('-').map(Number); return new Date(year, month, 0).getDate(); }
  const UTILITY_FIELDS = { ELECTRICITY: ['elecPrice', 'elecUnit'], WATER: ['waterPrice', 'waterUnit'] };
  function utilityAt(market, kind, date) { return rate('utilities', market, date, u => (!u.kind || u.kind === kind) && u[UTILITY_FIELDS[kind][0]] != null); }
  function utilityTerm(u, kind) { return { policyId: u.id, price: Number(u[UTILITY_FIELDS[kind][0]] || 0), unit: u[UTILITY_FIELDS[kind][1]] || '', docNo: (u.legalBasis || {}).docNo || '' }; }
  function landTerm(lp, st, area) { return { policyId: lp.id, amount: Number(lp.amount || 0), unit: lp.unit || '', area: Number(area || 0), monthly: landAmount(lp, Number(area || 0), 30), docNo: (lp.legalBasis || {}).docNo || '', stallId: st.id }; }
  function serviceTerm(x) { return { serviceId: x.id, name: x.name, calcMethod: x.calcMethod, amount: Number(x.amount || 0), unit: x.unit || '', docNo: (x.legalBasis || {}).docNo || '' }; }
  // KHOA_GIA_THEO_HOP_DONG: chụp toàn bộ biểu giá tại ngày bắt đầu hợp đồng để các lần tính sau không đọc giá hiện hành.
  function buildPriceTerms(market, st, area, date, applies, source) {
    const use = applies || {}, lp = st && landRate(st, date);
    const ep = use.electricity ? utilityAt(market, 'ELECTRICITY', date) : null, wp = use.water ? utilityAt(market, 'WATER', date) : null;
    const services = use.marketService ? (A.SERVICE_CFG ? A.SERVICE_CFG.list('extraServices') : []).filter(x => owned(x, market) && x.category !== 'VEHICLE' && active(x, date)).map(serviceTerm) : [];
    return {
      at: date, source: source || 'CONTRACT',
      land: lp ? landTerm(lp, st, area) : null,
      electricity: ep ? utilityTerm(ep, 'ELECTRICITY') : null,
      water: wp ? utilityTerm(wp, 'WATER') : null,
      services
    };
  }
  // Bản ghi đã hủy / vô hiệu hóa / nháp không bao giờ được chụp vào HĐ; bản ghi hết hạn vẫn là lịch sử hợp lệ.
  const lockable = x => !['cancelled', 'inactive', 'draft'].includes(x.status);
  const earliest = rows => rows.filter(lockable).sort((a, b) => String(a.effectiveFrom || '').localeCompare(String(b.effectiveFrom || '')))[0] || null;
  // HĐ đủ bảng giá cho mọi dịch vụ đã đăng ký. Phần còn trống (lúc chụp chợ chưa có giá) được bổ sung khi có giá;
  // phần đã khóa KHÔNG bao giờ bị ghi đè.
  function termsComplete(c) {
    const t = c && c.priceTerms, applies = (c && c.serviceApplicability) || {};
    return !!t && !!t.land && (!applies.electricity || !!t.electricity) && (!applies.water || !!t.water) && (!applies.marketService || (t.services || []).length > 0);
  }
  function freezeContractTerms(c) {
    if (!c || termsComplete(c)) return c && c.priceTerms;
    const st = A.idx.stall.get(c.businessPointId || c.stallId);
    if (!st) return c.priceTerms || null;
    const fresh = buildPriceTerms(c.market, st, st.area, c.start, c.serviceApplicability || {}, 'LEGACY');
    if (!c.priceTerms) c.priceTerms = fresh;
    else {
      ['land', 'electricity', 'water'].forEach(k => { if (!c.priceTerms[k] && fresh[k]) c.priceTerms[k] = fresh[k]; });
      if (!(c.priceTerms.services || []).length) c.priceTerms.services = fresh.services;
    }
    // Dữ liệu HĐ cũ có thể bắt đầu trước mốc biểu phí đầu tiên được số hóa: dùng bản ghi lịch sử sớm nhất,
    // không dùng giá mới nhất, để migration không làm tăng phí HĐ cũ.
    const applies = c.serviceApplicability || {}, type = { kiot: 'Ki-ốt', nhalong: 'Trong nhà lồng chợ', ngoai: 'Tự sản tự tiêu', phien: 'Quầy theo phiên' }[st.type];
    if (!c.priceTerms.land) {
      // Chỉ mức thu riêng của chợ — không chụp bản ghi SHARED/QĐ 480 vào hợp đồng.
      const lp = earliest((A.SERVICE_CFG ? A.SERVICE_CFG.list('stallPrices') : []).filter(x => owned(x, c.market) && (x.areaTypeId ? x.areaTypeId === st.areaTypeId : x.stallType === type)));
      if (lp) c.priceTerms.land = landTerm(lp, st, st.area);
    }
    ['electricity', 'water'].forEach(key => {
      if (!applies[key] || c.priceTerms[key]) return;
      const kind = key === 'electricity' ? 'ELECTRICITY' : 'WATER';
      const p = earliest((A.SERVICE_CFG ? A.SERVICE_CFG.list('utilities') : []).filter(u => owned(u, c.market) && (!u.kind || u.kind === kind) && u[UTILITY_FIELDS[kind][0]] != null));
      if (p) c.priceTerms[key] = utilityTerm(p, kind);
    });
    if (applies.marketService && !c.priceTerms.services.length) c.priceTerms.services = (A.SERVICE_CFG ? A.SERVICE_CFG.list('extraServices') : []).filter(x => owned(x, c.market) && x.category !== 'VEHICLE' && lockable(x)).map(serviceTerm);
    return c.priceTerms;
  }
  function contractTermsAt(c, date) {
    if (!c) return null;
    if (!termsComplete(c)) { const before = JSON.stringify(c.priceTerms || null); freezeContractTerms(c); if (JSON.stringify(c.priceTerms || null) !== before) A.save(); }
    const amendment = (c.amendments || []).filter(x => x.effectiveFrom && x.effectiveFrom <= date)
      .sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))[0];
    return amendment ? (amendment.priceTerms || amendment.terms || amendment) : c.priceTerms;
  }
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
    // Tháng của từng khoản (xem đầu file). Hợp đồng chọn theo ngày hiệu lực của chính nó — không theo khoảng đi thu.
    const usageMonth = MP().usageMonth(bp), landMonth = MP().landMonth(bp), win = MP().usageWindow(bp), readDate = win.to;
    const usageRange = MP().monthRange(usageMonth), landRange = MP().monthRange(landMonth);
    const usageIds = new Set(MP().usageContracts(bp).map(c => c.id)), serviceIds = new Set(MP().serviceContracts(bp).map(c => c.id)), landIds = new Set(MP().landContracts(bp).map(c => c.id));
    // ISSUE-07: một chỉ số (điểm × đợt) chỉ được tính cho MỘT hợp đồng. Nhiều hợp đồng cùng dùng khoảng chỉ số của một
    // điểm → cảnh báo chặn, không tự chia / không tính hai lần.
    const meterUsers = new Map();
    MP().usageContracts(bp).forEach(c => { const sa = c.serviceApplicability || {}; if (!sa.electricity && !sa.water) return; const pid = c.businessPointId || c.stallId; meterUsers.set(pid, (meterUsers.get(pid) || []).concat(c.id)); });
    const clip = (d, lo, hi) => d < lo ? lo : d > hi ? hi : d;
    MP().contracts(bp).forEach(c => {
      const st = A.idx.stall.get(c.businessPointId || c.stallId), t = A.idx.trader.get(c.traderId);
      if (!t) return warning(out, { code: 'MISSING_TRADER', contractId: c.id, message: 'Hợp đồng thiếu tiểu thương liên kết.' });
      if (!st) return warning(out, { code: 'MISSING_BUSINESS_POINT', contractId: c.id, traderId: t.id, message: 'Hợp đồng không tìm thấy Điểm kinh doanh.' });
      // ISSUE-03: kiểm tra quan hệ CANONICAL của hợp đồng (hợp đồng ↔ tiểu thương ↔ điểm ↔ chợ), không dùng người đang
      // thuê điểm tại ngày bấm tính → cùng dữ liệu + cùng đợt cho cùng kết quả ở mọi ngày.
      if (c.traderId !== t.id || t.market !== c.market || st.market !== c.market) return warning(out, { code: 'INVALID_CONTRACT_SOURCE', contractId: c.id, traderId: t.id, businessPointId: st.id, message: 'Hợp đồng không khớp tiểu thương / điểm kinh doanh / chợ.' });
      const common = { market, marketId: market, period, billingPeriodId: bp.id, traderId: t.id, stallId: st.id, businessPointId: st.id, contractId: c.id };
      if (!Number.isFinite(Number(st.area)) || Number(st.area) <= 0) return warning(out, { code: 'MISSING_AREA', contractId: c.id, traderId: t.id, businessPointId: st.id, message: 'Điểm kinh doanh thiếu diện tích hợp lệ.' });
      if (!st.areaTypeId) return warning(out, { code: 'MISSING_AREA_TYPE', contractId: c.id, traderId: t.id, businessPointId: st.id, message: 'Điểm kinh doanh thiếu loại diện tích.' });
      // ---- Mặt bằng: thu trước cho landMonth, chỉ những ngày hợp đồng còn hiệu lực (quy ước 30 ngày) ----
      const landDays = landIds.has(c.id) ? landBillableDays(c, landMonth) : 0;
      if (landDays > 0) {
        // KHOA_GIA_THEO_HOP_DONG: đơn giá lấy từ bảng giá đã khóa trên hợp đồng (amendment theo ngày nếu có), không đọc giá hiện hành.
        const landTerms = contractTermsAt(c, clip(landRange.from, c.start, c.end || landRange.to)), lp = landTerms && landTerms.land;
        if (!lp) warning(out, { code: 'MISSING_LAND_POLICY', contractId: c.id, businessPointId: st.id, message: 'Hợp đồng chưa có đơn giá sử dụng mặt bằng đã khóa.' });
        else {
          const quantity = Number(st.area || 0), key = 'LAND|' + c.id, amount = landAmount(lp, quantity, landDays), full = landDays === LAND_MONTH_DAYS;
          const row = draft(Object.assign({ sourceKey: key }, common), { chargeType: 'LAND', sourceType: 'CONTRACT', sourceId: c.id, name: 'Mặt bằng ' + monthLabel(landMonth), businessPointId: st.id, contractId: c.id, policyId: lp.policyId, policyReference: lp.docNo || '', quantity, unit: lp.unit, unitPrice: Number(lp.amount || 0), days: landDays, billableDays: landDays, fullMonth: full, targetMonth: landMonth, chargeMonth: landMonth, feePeriod: landMonth, amount, explanation: landExplain(lp, quantity, landDays) + (full ? ' (đủ tháng, quy ước 30 ngày)' : ' (hợp đồng hiệu lực một phần tháng ' + monthLabel(landMonth) + ')') });
          out.drafts.push(row);
        }
      }
      // ---- Điện / Nước: chỉ số của khoảng sử dụng (lần ghi trước → lần ghi này), tháng sử dụng = tháng ghi chỉ số ----
      const terms = contractTermsAt(c, clip(readDate, c.start, c.end || readDate));
      // HINH_THUC_THU_DIEN_NUOC: chợ thu điện, nước chia đều như dịch vụ → không tạo dòng theo công tơ.
      const applies = chargeApplies(market, A.SERVICE_CFG && A.SERVICE_CFG.utilityMode(market) === 'SERVICE' ? Object.assign({}, c.serviceApplicability || {}, { electricity: false, water: false }) : (c.serviceApplicability || {}), readDate);
      const sharedMeter = (meterUsers.get(st.id) || []).length > 1;
      if (usageIds.has(c.id) && sharedMeter && (applies.electricity || applies.water)) warning(out, { code: 'SHARED_METER_READING', contractId: c.id, traderId: t.id, businessPointId: st.id, message: 'Nhiều hợp đồng cùng dùng chỉ số điện, nước của điểm ' + st.code + ' trong đợt này — cần xử lý trước khi tính (không tính một chỉ số hai lần).' });
      const reading = A.db.readings.find(x => x.stallId === st.id && (x.billingPeriodId === bp.id || (!x.billingPeriodId && x.period === period)));
      if (usageIds.has(c.id) && !sharedMeter) [['electricity', 'ELECTRICITY', 'elecPrev', 'elecCur', 'elecPrice', 'elecUnit', 'điện', 'elecAvg'], ['water', 'WATER', 'waterPrev', 'waterCur', 'waterPrice', 'waterUnit', 'nước', 'waterAvg']].forEach(x => {
        if (!applies[x[0]]) return;
        // KHOA_GIA_THEO_HOP_DONG: giá điện / nước đã khóa trên hợp đồng (chụp theo kind tại ngày bắt đầu).
        const locked = terms && terms[x[0]];
        const utility = locked ? { id: locked.policyId, legalBasis: { docNo: locked.docNo || '' }, [x[4]]: locked.price, [x[5]]: locked.unit } : null;
        if (!utility) return warning(out, { code: 'MISSING_UTILITY_POLICY', contractId: c.id, businessPointId: st.id, chargeType: x[1], message: 'Hợp đồng chưa có giá ' + x[6] + ' đã khóa.' });
        if (!reading || reading[x[3]] == null || reading[x[2]] == null || reading.reviewRequired) return warning(out, { code: 'MISSING_METER_READING', contractId: c.id, businessPointId: st.id, chargeType: x[1], message: 'Thiếu chỉ số ' + x[6] + ' đã hợp lệ.' });
        const qty = Number(reading[x[3]]) - Number(reading[x[2]]);
        if (qty < 0) return warning(out, { code: 'INVALID_METER_READING', contractId: c.id, businessPointId: st.id, chargeType: x[1], message: 'Chỉ số ' + x[6] + ' mới nhỏ hơn chỉ số cũ.' });
        const price = Number(utility[x[4]] || 0), amount = qty * price, qtyUnit = consumptionUnit(utility[x[5]]);
        // Cảnh báo tiêu thụ bất thường chỉ chặn khi NV CHƯA kiểm tra/xác nhận chỉ số.
        if (Number(reading[x[7]]) && qty > Number(reading[x[7]]) * 1.5 && !MP().readingConfirmed(reading)) warning(out, { code: 'ABNORMAL_CONSUMPTION', contractId: c.id, traderId: t.id, businessPointId: st.id, chargeType: x[1], message: 'Sản lượng ' + x[6] + ' cao bất thường, cần xử lý ở dữ liệu nguồn.' });
        const key = x[1] + '|' + c.id, row = draft(Object.assign({ sourceKey: key }, common), { chargeType: x[1], sourceType: 'METER_READING', sourceId: st.id + '|' + period + '|' + x[0], name: x[6].charAt(0).toUpperCase() + x[6].slice(1) + ' ' + monthLabel(usageMonth), businessPointId: st.id, contractId: c.id, meter: { previous: Number(reading[x[2]]), current: Number(reading[x[3]]), consumption: qty, unit: qtyUnit, readDate, usageFrom: win.from, usageTo: win.to }, policyId: utility.id, policyReference: (utility.legalBasis || {}).docNo || '', quantity: qty, quantityUnit: qtyUnit, unit: utility[x[5]], unitPrice: price, usageMonth, chargeMonth: usageMonth, usageWindow: { from: win.from, to: win.to }, feePeriod: usageMonth, amount, explanation: Number(reading[x[3]]).toLocaleString('vi-VN') + ' − ' + Number(reading[x[2]]).toLocaleString('vi-VN') + ' = ' + qty + ' ' + qtyUnit });
        out.drafts.push(row);
      });
      // ---- Dịch vụ: tháng sử dụng, phí theo tháng (không chia ngày) — chỉ khi hợp đồng có hiệu lực trong tháng đó ----
      const serviceApplies = chargeApplies(market, c.serviceApplicability || {}, usageRange.to).marketService;
      if (serviceIds.has(c.id) && serviceApplies) {
        const sTerms = contractTermsAt(c, clip(usageRange.to, c.start, c.end || usageRange.to));
        const services = sTerms && Array.isArray(sTerms.services) ? sTerms.services : [];
        if (!services.length) warning(out, { code: 'MISSING_SERVICE_POLICY', contractId: c.id, traderId: t.id, businessPointId: st.id, message: 'Hợp đồng đăng ký Dịch vụ nhưng chưa có bảng giá dịch vụ đã khóa.' });
        services.forEach(s => { const qty = s.calcMethod === 'area' ? Number(st.area || 0) : 1, amount = s.calcMethod === 'area' ? Math.round(qty * Number(s.amount || 0)) : Number(s.amount || 0), key = 'SERVICE|' + c.id + '|' + s.serviceId, row = draft(Object.assign({ sourceKey: key }, common), { chargeType: 'MARKET_SERVICE', sourceType: 'SERVICE_POLICY', sourceId: s.serviceId, name: 'Dịch vụ ' + monthLabel(usageMonth) + ' · ' + s.name, businessPointId: st.id, contractId: c.id, policyId: s.serviceId, policyReference: s.docNo || '', quantity: qty, unit: s.unit, unitPrice: Number(s.amount || 0), usageMonth, chargeMonth: usageMonth, feePeriod: usageMonth, amount, explanation: s.calcMethod === 'area' ? qty + ' m² × ' + Number(s.amount || 0).toLocaleString('vi-VN') + ' ' + s.unit : 'Mức thu gói dịch vụ đang áp dụng.' }); out.drafts.push(row); });
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
    // Người nhận cấu hình theo 2 dạng: mã cũ ('trader', 'fee_collector') hoặc { actorGroup: 'TRADER' | 'FEE_COLLECTOR', condition }.
    const wants = (key, group) => (cfg.recipients || []).some(x => x === key || (x && x.actorGroup === group));
    const mk = U.market(market) || {}, label = period.slice(5) + '/' + period.slice(0, 4);
    const nextId = () => 'TB-' + U.pad(32 + A.db.notifications.length, 3);
    const template = (role, fallback) => Object.assign({}, fallback, ((cfg.templates || {})[role] || {}));
    const fill = (text, data) => String(text || '').replace(/\{([A-Za-z]+)\}/g, (_, key) => data[key] == null ? '{' + key + '}' : String(data[key]));
    const has = key => A.db.notifications.some(n => n.notificationKey === key);
    const add = rec => { if (!has(rec.notificationKey)) A.db.notifications.unshift(Object.assign({ id: nextId(), at: U.today(), kind: 'RECEIVABLE_ISSUED', eventKey: 'RECEIVABLE_ISSUED', eventConfigKey: 'RECEIVABLE_ISSUED', market, marketId: market, period, channels: cfg.channels || [], sent: 1, delivered: 1, read: 0, auto: true, by: actor || '' }, rec)); };
    if (wants('trader', 'TRADER')) issued.forEach(i => {
      const trader = A.idx.trader.get(i.traderId) || {}, data = { traderName: trader.name || i.traderId, period: label, marketName: mk.name || market, totalAmount: U.money(i.amount), amount: U.money(i.amount), dueDate: U.dmy(i.due), receivableCode: i.id, paymentReference: i.paymentReference || '', qrReference: (i.qrReference || {}).reference || '' }, tpl = template('trader', { title: 'Khoản phải thu kỳ {period} đã được phát hành', body: 'Khoản phải thu kỳ {period} tại {marketName} đã được phát hành. Tổng tiền: {totalAmount}. Hạn thanh toán: {dueDate}. Vui lòng xem chi tiết và thực hiện thanh toán.' });
      add({ notificationKey: ['RECEIVABLE_ISSUED', market, period, 'TRADER', i.traderId, i.id].join('|'), recipientType: 'TRADER', recipientId: i.traderId, traderId: i.traderId, receivableId: i.id, referenceId: i.id, title: fill(tpl.title, data), body: fill(tpl.body, data), group: trader.name || i.traderId, action: { label: 'Xem khoản phải thu', route: 'phai-thu', referenceId: i.id } });
    });
    const collector = A.ACCOUNTS && A.ACCOUNTS.getMarketCollector && A.ACCOUNTS.getMarketCollector(market);
    if (wants('fee_collector', 'FEE_COLLECTOR') && collector && A.allowedMarkets(collector).includes(market)) {
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
  Object.assign(billing, { ensure, buildPriceTerms, contractTermsAt, freezeContractTerms, calculatePeriod, drafts, warnings, traderGroups, issue, nextMonth, daysInPeriod, landBillableDays, landAmount, LAND_MONTH_DAYS, consumptionUnit });
  // KHOA_GIA_THEO_HOP_DONG: migration cộng thêm, không đổi khóa localStorage và chạy lặp an toàn.
  document.addEventListener('DOMContentLoaded', () => {
    let migrated = false;
    (A.db.contracts || []).forEach(c => { if (termsComplete(c)) return; const before = JSON.stringify(c.priceTerms || null); freezeContractTerms(c); if (JSON.stringify(c.priceTerms || null) !== before) migrated = true; });
    if (migrated) A.save();
  });
})(window.APP);
