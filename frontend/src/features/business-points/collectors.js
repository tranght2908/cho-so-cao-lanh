/* Fee-collector assignment of business points (Phase 15.15, from js/v-cautruc.js). Each point has ONE
 * active collector (stall.collectorId); a layout zone is only a quick way to select its real points.
 * Queries: collector accounts in scope, zone assignment state/label. Command: assignCollector. */
(function (A) {
  'use strict';
  const service = A.features.businessPoints.service;
  const mbZonePoints = (mid, z) => A.mbBusinessPointsForZone(mid, z);
  // PHAN_CONG_NHAN_VIEN_THU_PHI: tài khoản demo role 'collector' (Nhân viên thu phí) thuộc phạm vi
  // chợ mid — REUSE A.ACCOUNTS (mục 1 yêu cầu: không tạo danh sách nhân viên riêng), cùng cách lọc
  // dkCollectorLabel() đã có ở js/v-tieuthuong.js (không dùng D.STAFF — đó là roster cũ, khác nguồn).
  function mbCollectorAccounts(mid) {
    return A.ACCOUNTS.list().filter(a => a.status === 'active' && A.ACCOUNTS.primaryRole(a) === 'collector' && A.allowedMarkets(a).indexOf(mid) !== -1);
  }
  // Trạng thái phân công NV thu phí của 1 dãy — suy TỪ collectorId trên CHÍNH các điểm kinh doanh
  // thật thuộc dãy (mục 2 yêu cầu: "dãy chỉ là cách chọn nhanh", KHÔNG lưu field riêng ở cấp dãy):
  //   null     = dãy chưa có điểm thật (đang quy hoạch)
  //   ''       = có điểm thật nhưng chưa điểm nào được phân công
  //   'MIXED'  = các điểm trong dãy đang có nhiều NV khác nhau
  //   <acc id> = mọi điểm trong dãy cùng 1 NV
  function mbZoneCollectorId(mid, z) {
    const pts = mbZonePoints(mid, z);
    if (!pts.length) return null;
    const ids = Array.from(new Set(pts.map(p => p.collectorId || '')));
    return ids.length === 1 ? ids[0] : 'MIXED';
  }
  function mbZoneCollectorLabel(mid, z) {
    const id = mbZoneCollectorId(mid, z);
    if (id === null || id === '') return id === null ? null : 'Chưa phân công';
    if (id === 'MIXED') return 'Nhiều NV phụ trách';
    const acc = A.ACCOUNTS.get(id);
    return acc ? acc.fullName : 'Chưa phân công';
  }
  A.mbZoneCollectorLabel = mbZoneCollectorLabel;
  service.collectorAccounts = mbCollectorAccounts;
  service.zoneCollectorId = mbZoneCollectorId;
  service.assignCollector = function (points, collectorId) {
    A.features.businessPoints.repository.assignCollector(points, collectorId);
    A.data.save();
  };
})(window.APP);
