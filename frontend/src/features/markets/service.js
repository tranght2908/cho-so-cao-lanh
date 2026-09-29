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
  service.nextCode = function () { return repository.nextCode(); };
  // Danh sách chợ hiệu lực (12 chợ gốc + chợ custom trong danh mục) — xem markets/store.js.
  service.effectiveMarkets = function () { return repository.effectiveMarkets(); };
  service.add = function (record, user) { return repository.add(record, user); };
  service.update = function (id, patch, user) { return repository.update(id, patch, user); };
  service.RANKS = repository.ranks();
  service.STATUS = repository.statuses();
  service.PRICE_CONFIGS = repository.priceConfigs();

  // ---- Suy ra từ nguồn sẵn có, KHÔNG lưu bản sao trong danh mục ----
  // Loại diện tích: danh mục dùng chung U.AREA_TYPE_CODES / U.areaTypeLabel (business-points/format.js).
  service.areaTypes = function () { return (A.U.AREA_TYPE_CODES || []).map(id => ({ id, label: A.U.areaTypeLabel(id) || id })); };

  // Tình trạng mặt bằng: "Đã thiết lập" khi graph mặt bằng (A.db.rows, do Tổ trưởng dựng ở Mặt bằng &
  // điểm kinh doanh) của chợ có ít nhất 1 Dãy. Chợ chưa có Dãy → chưa thiết lập.
  service.layoutZoneCount = function (id) {
    return ((A.db && A.db.rows) || []).filter(r => r.market === id).length;
  };
  service.layoutReady = function (id) { return service.layoutZoneCount(id) > 0; };

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

  service.capacityTotals = function (row) {
    const cap = row && row.capacityByAreaType;
    if (!cap) return null;
    return { maxPointCount: cap.reduce((s, x) => s + (x.maxPointCount || 0), 0), maxArea: cap.reduce((s, x) => s + (x.maxArea || 0), 0) };
  };

  // ---- Validation quy mô & chỉ tiêu ----
  // input: { totalArea, businessArea, capacity: { [areaTypeId]: { maxPointCount, maxArea } } } — mỗi giá
  // trị là số, null (bỏ trống) hoặc NaN (không phải số). opts.required: bắt buộc khai báo quy mô.
  // opts.usage: service.usage(id) — capacity mới không được nhỏ hơn phần đã số hoá tương ứng.
  // Trả về { ok, errors: { totalArea, businessArea, capacity: {[type]: {maxPointCount, maxArea}}, table }, value }.
  const fmt = n => Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  service.validateScale = function (input, opts) {
    opts = opts || {};
    const usage = opts.usage || {};
    const errors = { capacity: {} };
    const types = service.areaTypes();
    const cap = input.capacity || {};
    const blank = v => v === null || v === undefined;
    const anyValue = !blank(input.totalArea) || !blank(input.businessArea) || types.some(t => cap[t.id] && (!blank(cap[t.id].maxPointCount) || !blank(cap[t.id].maxArea)));
    if (!opts.required && !anyValue) {
      // Chợ chưa từng khai báo quy mô: được phép để "Chưa cập nhật" khi sửa thông tin chung.
      return { ok: true, errors, value: { totalArea: null, businessArea: null, capacityByAreaType: null } };
    }
    const total = input.totalArea, biz = input.businessArea;
    if (blank(total)) errors.totalArea = 'Vui lòng nhập tổng diện tích chợ.';
    else if (isNaN(total) || total <= 0) errors.totalArea = 'Tổng diện tích chợ phải là số lớn hơn 0.';
    if (blank(biz)) errors.businessArea = 'Vui lòng nhập diện tích phục vụ kinh doanh.';
    else if (isNaN(biz) || biz < 0) errors.businessArea = 'Diện tích phục vụ kinh doanh phải là số không âm.';
    else if (!errors.totalArea && biz > total) errors.businessArea = `Diện tích phục vụ kinh doanh (${fmt(biz)} m²) không được lớn hơn tổng diện tích chợ (${fmt(total)} m²).`;

    const list = [];
    let sumArea = 0;
    types.forEach(t => {
      const c = cap[t.id] || {};
      const e = {};
      const cnt = blank(c.maxPointCount) ? 0 : c.maxPointCount;
      const area = blank(c.maxArea) ? 0 : c.maxArea;
      const u = usage[t.id] || { count: 0, area: 0 };
      if (isNaN(cnt) || cnt < 0 || !Number.isInteger(cnt)) e.maxPointCount = 'Số điểm tối đa phải là số nguyên không âm.';
      else if (cnt < u.count) e.maxPointCount = `Không thể giảm xuống ${fmt(cnt)} điểm vì mặt bằng hiện có ${fmt(u.count)} điểm thuộc loại diện tích này.`;
      if (isNaN(area) || area < 0) e.maxArea = 'Diện tích tối đa phải là số không âm.';
      else if (area + 1e-9 < u.area) e.maxArea = `Không thể giảm xuống ${fmt(area)} m² vì mặt bằng hiện có ${fmt(u.area)} m² thuộc loại diện tích này.`;
      if (e.maxPointCount || e.maxArea) errors.capacity[t.id] = e;
      if (!isNaN(area) && area >= 0) sumArea += area;
      list.push({ areaTypeId: t.id, maxPointCount: cnt, maxArea: area });
    });
    if (!errors.businessArea && !blank(biz) && sumArea > biz + 1e-9) {
      errors.table = `Tổng diện tích chỉ tiêu đang vượt ${fmt(sumArea - biz)} m² so với diện tích phục vụ kinh doanh.`;
    }
    const ok = !errors.totalArea && !errors.businessArea && !errors.table && !Object.keys(errors.capacity).length;
    return { ok, errors, value: { totalArea: total, businessArea: biz, capacityByAreaType: list } };
  };
})(window.APP);
