/* Business-point (Điểm kinh doanh) data access over A.db.stalls. */
(function (A) {
  'use strict';

  if (!A || !A.data) return;

  // Legacy collection name. Mặt bằng v16: A.db.buildings → floors (tuỳ chọn) → rows → stalls là graph
  // DUY NHẤT; điểm chỉ lưu field của chính nó (rowId, area, areaTypeId, status vận hành, hasMeter,
  // type — cầu nối biểu phí cũ, note, history).
  const COLLECTION = 'stalls';
  const features = A.features || (A.features = {});
  const businessPoints = features.businessPoints || (features.businessPoints = {});
  const repository = businessPoints.repository || (businessPoints.repository = {});

  // ---- Compatibility adapter (TẠM THỜI) cho code cũ còn đọc field đã bỏ khỏi điểm ----
  // Getter CHỈ ĐỌC trên prototype chung (store.js gắn vào mọi stall khi reindex): không enumerable nên
  // không bao giờ được lưu lại vào localStorage, và ghi đè (strict mode) sẽ báo lỗi ngay thay vì âm
  // thầm tạo bản sao lệch. Code mới dùng helper của businessPoints.service (row/location/industry/
  // usageStatus/debtStatus/displayStatus…), không dùng các getter này.
  const svc = () => businessPoints.service;
  const proto = {};
  const getter = (name, fn) => Object.defineProperty(proto, name, { get: fn, enumerable: false, configurable: true });
  getter('areaType', function () { return this.areaTypeId; });
  getter('cat', function () { return svc().industry(this); });
  getter('section', function () { const r = svc().row(this); return r ? r.code : ''; });
  getter('sectionName', function () { const r = svc().row(this); return r ? r.name : ''; });
  getter('floor', function () { const r = svc().row(this); return r ? r.floorId : null; });
  // Deprecated compatibility getter. New access/display code uses Account.marketScopes, never this value.
  getter('collectorId', function () { const r = svc().row(this); return r ? r.collectorId || null : null; });
  getter('traderId', function () { return svc().occupantId(this); });
  getter('contractId', function () { const c = svc().contractOn(this.id, A.U.today()); return c ? c.id : null; });
  getter('sellerId', function () { const a = svc().activeSeller(this); return a ? a.traderId || a.personId || null : null; });
  A.data.stallPrototype = proto;

  repository.list = function () { return A.data.getCollection(COLLECTION); };
  repository.getById = function (id) { return A.data.findById(COLLECTION, id); };

  // Tình trạng sử dụng suy ra từ hợp đồng (businessPoints.service) — occupy/vacate không còn ghi
  // traderId/contractId/status lên điểm; giữ API để luồng hợp đồng hiện có không phải đổi.
  repository.occupy = function (id) { return repository.getById(id); };
  repository.vacate = function (id) { return repository.getById(id); };
  repository.addHistory = function (id, entry) {
    const point = repository.getById(id);
    if (!point) return null;
    point.history = point.history || [];
    point.history.unshift(entry);
    return point;
  };
})(window.APP);
