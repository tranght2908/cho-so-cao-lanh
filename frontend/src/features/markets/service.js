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
  service.completeLayoutSetup = function (id, user) { return repository.completeLayoutSetup(id, user); };
  service.RANKS = repository.ranks();
  service.STATUS = repository.statuses();
  service.PRICE_CONFIGS = repository.priceConfigs();
  service.managementUnit = function (market) { return A.MARKET_CATALOG.marketManagementUnit(market); };

  // ---- Suy ra từ nguồn sẵn có, KHÔNG lưu bản sao trong danh mục ----
  // Loại diện tích: danh mục dùng chung U.AREA_TYPE_CODES / U.areaTypeLabel (business-points/format.js).
  service.areaTypes = function () { return (A.U.AREA_TYPE_CODES || []).map(id => ({ id, label: A.U.areaTypeLabel(id) || id })); };

  // Lifecycle layout is persisted on Market; graph rows are never a substitute
  // for the explicit completed-setup transition.
  service.layoutZoneCount = function (id) {
    return ((A.db && A.db.rows) || []).filter(r => r.market === id).length;
  };
  service.layoutReady = function (id) { const market = repository.get(id); return !!market && market.layoutStatus === 'SETUP_COMPLETED'; };

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
  // opts.required: bắt buộc khai báo quy mô. Không có quota theo loại diện tích.
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
    else if (isNaN(biz) || biz < 0) errors.businessArea = 'Diện tích phục vụ kinh doanh phải là số không âm.';
    else if (!errors.totalArea && biz > total) errors.businessArea = `Diện tích phục vụ kinh doanh (${fmt(biz)} m²) không được lớn hơn tổng diện tích chợ (${fmt(total)} m²).`;
    return { ok: !errors.totalArea && !errors.businessArea, errors, value: { totalArea: total, businessArea: biz } };
  };

  // ---- Loại diện tích kinh doanh áp dụng ----
  // selected: [areaTypeId] Admin chọn; previous: allowedAreaTypeIds đang lưu (null = chưa cấu hình);
  // usage: service.usage(id). Không cho BỎ một loại đang được điểm kinh doanh thật sử dụng — không xoá
  // điểm, không đổi loại của điểm, không đụng mặt bằng. Trả về { ok, error, value } với value là danh
  // sách theo thứ tự U.AREA_TYPE_CODES, hoặc null khi không chọn loại nào.
  service.validateAreaTypes = function (selected, previous, usage) {
    const codes = service.areaTypes().map(t => t.id);
    const next = codes.filter(k => (selected || []).indexOf(k) !== -1);
    const removedInUse = (previous || []).filter(k => next.indexOf(k) === -1 && usage && usage[k] && usage[k].count > 0);
    const error = removedInUse.map(k => `Không thể bỏ loại '${A.U.areaTypeLabel(k) || k}' vì hiện có điểm kinh doanh đang sử dụng loại diện tích này.`).join(' ');
    return { ok: !error, error, value: next.length ? next : null };
  };
})(window.APP);
