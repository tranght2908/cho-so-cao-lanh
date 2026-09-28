/* Market layout diagram helpers (v16): business points of a Dãy (A.mbBusinessPointsForZone / ForMarket /
 * ById), derived point status at the viewed date, market/row stats, the shared point-cell renderer used by the
 * Mặt bằng workspaces (A.mbCellsHtml), and the point actions (stall click, open trader/point from the quick
 * drawer). Workspaces themselves (Tổng quan / Khối / Tầng / Dãy) are rendered in market-layout/page.js.
 * All numbers are derived from A.db at render time — nothing is persisted here. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const mbOpenStallDrawer = st => A.features.businessPoints.openStallDrawer(st);

  // Dãy (zone trong view lồng của store) = A.db.rows; điểm của Dãy = A.db.stalls có rowId = row.id.
  function mbZoneStalls(mid, z) {
    return z ? A.db.stalls.filter(st => st.market === mid && st.rowId === z.key) : [];
  }
  // Phân loại mô hình thuê chỉ thuộc chợ quê TTD (quầy cố định / theo phiên) — chỉ dùng cho tooltip.
  function mbRentalLabel(st) {
    return st && st.market === 'TTD' ? U.rentalLabel(st) : '';
  }
  function mbPointTitle(st, trader) {
    return [st.code, mbRentalLabel(st), A.mbStatusLabel(A.mbStatusAt(st)), trader ? U.esc(trader.name) : ''].filter(Boolean).join(' · ');
  }
  A.mbResolveZoneContext = function (mid, zone) {
    const market = U.market(mid);
    if (!market) return { market: mid, row: null, floor: null, matched: false, reason: 'market-not-found' };
    const row = zone && A.idx.row ? A.idx.row.get(zone.key) : null;
    if (!row || row.market !== mid) return { market: mid, row: null, floor: null, matched: false, reason: 'zone-not-found' };
    return { market: mid, row, floor: row.floorId ? A.idx.floor.get(row.floorId) || null : null, matched: true, reason: 'row' };
  };
  // Tình trạng điểm TẠI NGÀY đang xem trên Mặt bằng — suy ra (businessPoints.service.displayStatus):
  // trạng thái vận hành (Tạm ngừng/Đang tranh chấp) → hợp đồng tại ngày (Đang thuê / Còn trống) →
  // khoản phải thu quá hạn của hợp đồng đó (Nợ phí). Ngày xem là state UI, không lưu.
  let mbDate = null;
  A.mbStatusDate = () => mbDate || U.today();
  A.mbSetStatusDate = d => { mbDate = d && d !== U.today() ? d : null; };
  A.mbStatusAt = function (st, date) {
    return A.features.businessPoints.service.displayStatus(st, date || A.mbStatusDate());
  };
  A.mbOccupantAt = function (st, date) {
    const c = A.features.businessPoints.service.contractOn(st.id, date || A.mbStatusDate());
    return c ? A.idx.trader.get(c.traderId) || null : null;
  };
  A.mbBusinessPointsForZone = function (mid, zone) {
    return mbZoneStalls(mid, zone);
  };
  A.mbBusinessPointById = function (mid, pointId) {
    const st = A.idx && A.idx.stall ? A.idx.stall.get(pointId) : null;
    return st && st.market === mid ? st : null;
  };
  A.mbBusinessPointsForMarket = function (mid) {
    if (!U.market(mid)) return [];
    return A.db.stalls.filter(st => st.market === mid);
  };
  // Đếm theo tình trạng hiển thị (khoá D.STATUS) cho 1 tập điểm.
  A.mbStatusCounts = function (points) {
    const byStatus = {};
    Object.keys(D.STATUS).forEach(k => { byStatus[k] = 0; });
    points.forEach(st => { const k = A.mbStatusAt(st); byStatus[k] = (byStatus[k] || 0) + 1; });
    return byStatus;
  };
  A.mbMarketStats = function (mid) {
    const points = A.mbBusinessPointsForMarket(mid);
    return { total: points.length, byStatus: A.mbStatusCounts(points), points: points };
  };
  A.mbZoneStats = function (mid, zone) {
    const points = A.mbBusinessPointsForZone(mid, zone);
    return { total: points.length, byStatus: A.mbStatusCounts(points), points: points };
  };
  // Ô điểm kinh doanh của 1 Dãy (1 hàng vật lý): màu theo tình trạng hiển thị suy ra; điểm không khớp
  // chip trạng thái đang chọn (A.mbMatchesFilter) mờ đi. `data-id` là id kỹ thuật, nhãn là mã điểm.
  A.mbCellsHtml = function (stalls) {
    return `<div class="plan-row"><div class="cells" style="--n:${Math.max(stalls.length, 1)}">${stalls.map(st => {
      const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
      const dim = !A.mbMatchesFilter(st);
      return `<button class="cell s-${A.mbStatusAt(st)} ${st.type === 'kiot' ? 'kiot' : ''} ${dim ? 'dim' : ''} ${ui.sel === st.id ? 'sel' : ''}" data-act="stall" data-id="${st.id}" title="${mbPointTitle(st, t)}" aria-label="Điểm ${U.esc(st.code)}">${st.code}${A.WORKFLOW && A.WORKFLOW.isRecentPoint(st.id) ? '<small class="workflow-grid-new">Mới</small>' : ''}</button>`;
    }).join('') || '<span class="small muted">Chưa có điểm kinh doanh</span>'}</div></div>`;
  };

  Object.assign(A.ACT, {
    legend: el => { ui.hidden[el.dataset.s] = !ui.hidden[el.dataset.s]; A.render(); },
    // Click 1 điểm trên sơ đồ = mở drawer GỐC (không phải drill-down từ drawer khác) — luôn reset
    // navigation stack trước, đảm bảo không hiện "← Quay lại" giả.
    stall: el => { A.drawerReset(); mbOpenStallDrawer(A.idx.stall.get(el.dataset.id)); },
    // Điều hướng "xem sâu" từ drawer điểm: ở lại màn 'mat-bang', đẩy cách vẽ lại drawer nguồn vào
    // navigation stack dùng chung để "← Quay lại <mã điểm>" hoạt động.
    'mb-open-trader': el => {
      if (!U.can('tieu-thuong')) return;
      const t = A.idx.trader.get(el.dataset.id);
      const st = A.idx.stall.get(ui.sel);
      if (!t || !st) return;
      A.drawerPush(st.code, () => mbOpenStallDrawer(st));
      A.openTraderDrawer(t);
    },
    'mb-open-diemkd': el => {
      if (!U.can('diem-kd')) return;
      const st = A.idx.stall.get(el.dataset.id);
      if (!st) return;
      A.drawerPush(st.code, () => mbOpenStallDrawer(st));
      A.openDkDrawer(st);
    }
  });
  // Tìm kiếm trên sơ đồ đã bỏ (search/filter chỉ ở chế độ Bảng); handler giữ cho tương thích.
  A.IN['plan-search'] = el => { ui.planSearch = el.value; A.render(); };
})(window.APP);
