/* Market layout diagram (Phase 15.14, from js/v-dieuhanh.js): maps layout zones to real business
 * points (A.mbBusinessPointsForZone / ForMarket / ById, stats), renders overview/block/floor/zone diagrams, and the
 * diagram actions (legend, stall click, open trader/point from the quick drawer, plan search). */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const mbOpenStallDrawer = st => A.features.businessPoints.openStallDrawer(st);
  // ---------- Mặt bằng chợ (gộp UI "Thiết lập mặt bằng chợ" + "Sơ đồ mặt bằng", nay là workspace
  // drill-down nhiều cấp — MARKET_LAYOUT_DRILLDOWN_UX_REPORT.md) ----------
  // KHÔNG còn "edit mode" như 1 route/trang riêng nữa — action thêm/sửa/xóa cấu trúc hiện NGAY trên
  // cây, permission cho phép tới đâu thì action tự hiện tới đó. Toàn bộ cây + action cấu trúc + điều
  // hướng chọn node (Tổng quan/Khối/Tầng/Khu) nằm ở js/v-cautruc.js (nơi giữ model LAYOUT). File
  // này chỉ còn giữ đúng phần liên quan tới điểm kinh doanh THẬT (D.MARKETS/A.db.stalls):
  // A.stallPanel (drawer điểm KD, không đổi) + các hàm dùng chung A.mbOverviewHtml/A.mbBlockHtml/
  // A.mbFloorHtml/A.mbZoneDiagramHtml render vùng nội dung bên phải theo đúng cấp đang chọn —
  // js/v-cautruc.js gọi các hàm này, truyền vào (các) khối/tầng/khu LAYOUT hiện có; các hàm tự đối
  // chiếu với dữ liệu thật qua `zone.code === section.id` (đúng cách defaultLayout() đã seed — xem
  // js/v-cautruc.js) để hiển thị đúng trạng thái thực tế cho khu đã triển khai, hoặc thông tin quy
  // hoạch cho khu chưa khớp dữ liệu thật. Mọi số liệu tổng hợp (tổng điểm, số theo trạng thái) đều
  // TÍNH TỪ A.db.stalls/LAYOUT ngay tại thời điểm render — không persist thêm field nào. Không tạo
  // model/permission mặt bằng thứ hai, không đổi 'screen:mat-bang'/so-do.*/cau-truc.* (6 action
  // permKey GIỮ NGUYÊN).
  function mbMatchRealSection(mid, code) {
    const m = U.market(mid);
    for (const f of m.floors) { const s = f.sections.find(x => x.id === code); if (s) return { floor: f, section: s }; }
    return null;
  }
  // Điểm KD thật của 1 khu LAYOUT (mảng rỗng nếu khu còn ở giai đoạn quy hoạch, chưa khớp dữ liệu
  // thật — KHÔNG lẫn với "chưa có điểm nào dù đã khớp", 2 trường hợp này phân biệt bằng
  // mbMatchRealSection, không dựa vào độ dài mảng ở đây).
  function mbZoneStalls(mid, z) {
    const matched = mbMatchRealSection(mid, z.code);
    return matched ? A.db.stalls.filter(st => st.market === mid && st.floor === matched.floor.id && st.section === matched.section.id) : [];
  }
  function mbStatusLine(stalls) {
    const c = k => stalls.filter(st => A.mbStatusAt(st) === k).length;
    const parts = Object.keys(D.STATUS).filter(k => c(k)).map(k => `${c(k)} ${A.mbStatusLabel(k).toLowerCase()}`);
    return parts.length ? parts.join(' · ') : 'Chưa có điểm kinh doanh';
  }
  // Phân loại mô hình thuê chỉ thuộc Chợ quê Tân Thuận Đông.  Các summary,
  // tooltip và panel của Mặt bằng chợ đều đi qua các helper này để CL không
  // vô tình hiện lại terminology fixed/session ở một level drill-down khác.
  function mbRentalLabel(st) {
    return st && st.market === 'TTD' ? U.rentalLabel(st) : '';
  }
  function mbRentalLine(mid, stalls) {
    if (mid !== 'TTD') return '';
    const fixed = stalls.filter(st => U.rentalKind(st) === 'fixed').length;
    const session = stalls.filter(st => U.rentalKind(st) === 'session').length;
    const parts = [];
    if (fixed) parts.push(`${fixed} quầy cố định tháng/quý`);
    if (session) parts.push(`${session} quầy theo phiên/vãng lai`);
    return parts.join(' · ');
  }
  function mbMetaLine(mid, stalls) {
    const rent = mbRentalLine(mid, stalls);
    const status = mbStatusLine(stalls);
    return rent ? rent + ' · ' + status : status;
  }
  function mbPointTitle(st, trader, structural) {
    return [st.code, mbRentalLabel(st), A.mbStatusLabel(A.mbStatusAt(st)), trader ? U.esc(trader.name) : '', structural ? 'Đã tách' : ''].filter(Boolean).join(' · ');
  }
  A.mbResolveZoneContext = function (mid, zone) {
    const market = U.market(mid);
    if (!market) return { market: mid, floor: null, section: null, matched: false, reason: 'market-not-found' };
    if (!zone) return { market: mid, floor: null, section: null, matched: false, reason: 'zone-not-found' };
    if (!zone.code) return { market: mid, floor: null, section: null, matched: false, reason: 'zone-code-empty' };
    const matched = mbMatchRealSection(mid, zone.code);
    if (!matched) return { market: mid, floor: null, section: null, matched: false, reason: 'section-not-found' };
    return { market: mid, floor: matched.floor, section: matched.section, matched: true, reason: 'matched-zone-code' };
  };
  // Tình trạng điểm TẠI NGÀY đang xem trên Mặt bằng — suy ra từ hợp đồng (quy tắc chung ở
  // business-points/service.js), không ghi đè st.status. Tạm ngừng/Đang tranh chấp là trạng thái vận
  // hành của điểm nên giữ nguyên; có hợp đồng hiệu lực tại ngày → Đang thuê (Nợ phí nếu chính hợp đồng
  // hiện tại đang được đánh dấu nợ); không có → Còn trống. Ngày xem là state UI, không lưu.
  let mbDate = null;
  A.mbStatusDate = () => mbDate || U.today();
  A.mbSetStatusDate = d => { mbDate = d && d !== U.today() ? d : null; };
  A.mbStatusAt = function (st, date) {
    if (st.status === 'ngung' || st.status === 'tranhchap') return st.status;
    const c = A.features.businessPoints.service.contractOn(st.id, date || A.mbStatusDate());
    if (!c) return 'trong';
    return st.status === 'no' && c.id === st.contractId ? 'no' : 'thue';
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
  A.mbMarketStats = function (mid) {
    const points = A.mbBusinessPointsForMarket(mid);
    const byStatus = {};
    const at = points.map(st => A.mbStatusAt(st));
    Object.keys(D.STATUS).forEach(k => { byStatus[k] = at.filter(s => s === k).length; });
    return { total: points.length, byStatus: byStatus, points: points };
  };
  A.mbZoneStats = function (mid, zone) {
    const points = A.mbBusinessPointsForZone(mid, zone);
    const byStatus = {};
    const at = points.map(st => A.mbStatusAt(st));
    Object.keys(D.STATUS).forEach(k => { byStatus[k] = at.filter(s => s === k).length; });
    return { total: points.length, byStatus: byStatus, points: points };
  };
  // Danh sách khu của 1 tầng, MỖI khu render bằng ĐÚNG 1 renderer dùng chung (mbZoneSectionHtml —
  // tên khu + thống kê ngắn + point grid) — dùng lại nguyên vẹn ở cả Tầng/Khối/Tổng quan (hotfix
  // "cùng 1 visual language": không tạo renderer khác nhau cho từng cấp).
  function mbFloorZonesHtml(mid, floor) {
    return floor.zones.length ? floor.zones.map(z => mbZoneSectionHtml(mid, z)).join('') : '<div class="empty small">Chưa có khu nào.</div>';
  }
  // 1 tầng lồng bên trong Khối/Tổng quan (nơi 1 card có thể chứa NHIỀU tầng): thêm 1 heading nhỏ,
  // click được (→ view Tầng), phía trên danh sách khu của tầng đó — chỉ hiện khi phạm vi đang xem có
  // hơn 1 tầng (`showHeading`); khối chỉ có đúng 1 tầng thì heading thừa (trùng ý khối/tầng, giống
  // logic gộp `mbFlatMode` ở cây cấu trúc — xem js/v-cautruc.js), hiển thị thẳng danh sách khu.
  function mbFloorGroupHtml(mid, floor, showHeading) {
    const zonesHtml = mbFloorZonesHtml(mid, floor);
    if (!showHeading) return zonesHtml;
    const stalls = [];
    floor.zones.forEach(z => stalls.push.apply(stalls, mbZoneStalls(mid, z)));
    return `<div class="mb-floor-heading">
        <button class="mb-floor-heading-btn" data-act="mb-sel-floor" data-id="${floor.key}">${U.esc(floor.name)}</button>
        <span class="spacer"></span><span class="mb-floor-heading-meta">${stalls.length} điểm KD · ${mbMetaLine(mid, stalls)}</span>
      </div>${zonesHtml}`;
  }
  // ---- Tổng quan toàn chợ (mục 1/2/3 hotfix — cùng visual language mọi cấp): mỗi khối 1 card,
  // trong đó liệt kê ĐỦ các tầng (nếu >1 tầng, có heading tầng) và ĐỦ các khu + point grid của từng
  // tầng — KHÔNG còn rút gọn thành danh sách/chip như trước. Thống kê tối thiểu toàn chợ đã có sẵn ở
  // thanh tổng hợp phía trên workspace (không lặp lại ở đây — xem mbWorkspaceHtml ở v-cautruc.js).
  A.mbOverviewHtml = function (mid, blocks) {
    if (!blocks.length) return '<div class="empty">Chưa có khối/nhà chợ nào.</div>';
    return `<div class="mb-ov">${blocks.map(b => {
      const stalls = [];
      b.floors.forEach(f => f.zones.forEach(z => stalls.push.apply(stalls, mbZoneStalls(mid, z))));
      const multi = b.floors.length > 1;
      const body = b.floors.length ? b.floors.map(f => mbFloorGroupHtml(mid, f, multi)).join('') : '<div class="empty small">Chưa có tầng</div>';
      return `<div class="card"><div class="card-h mb-ov-clickable" data-act="mb-sel-block" data-id="${b.key}"><h3>${U.esc(b.name)}</h3><span class="small muted">${stalls.length} điểm KD${mbRentalLine(mid, stalls) ? ' · ' + mbRentalLine(mid, stalls) : ''}</span></div>
        <div class="card-b"><div class="plan">${body}</div></div></div>`;
    }).join('')}</div>`;
  };
  // ---- Khối/Nhà chợ (mục 2 hotfix): TOÀN BỘ tầng thuộc khối, mỗi tầng TOÀN BỘ khu + point grid —
  // cùng cấu trúc với Tổng quan, chỉ khác phạm vi (đúng 1 khối thay vì mọi khối).
  A.mbBlockHtml = function (mid, block) {
    const stalls = [];
    block.floors.forEach(f => f.zones.forEach(z => stalls.push.apply(stalls, mbZoneStalls(mid, z))));
    const multi = block.floors.length > 1;
    const body = block.floors.length ? block.floors.map(f => mbFloorGroupHtml(mid, f, multi)).join('') : '<div class="empty small">Chưa có tầng</div>';
    return `<div class="card"><div class="card-h"><h3>${U.esc(block.name)}</h3><span class="small muted">${stalls.length} điểm KD${mbRentalLine(mid, stalls) ? ' · ' + mbRentalLine(mid, stalls) : ''}</span></div>
      <div class="card-b"><div class="plan">${body}</div></div></div>`;
  };
  // ---- Tầng: sơ đồ TOÀN BỘ điểm KD của TẤT CẢ khu thuộc tầng, mỗi khu tách thành 1 .plan-section
  // riêng (KHÔNG trộn chung 1 grid), giữ màu trạng thái hiện tại — không có heading tầng thừa vì
  // card-h h3 ở đây đã chính là tên tầng.
  A.mbFloorHtml = function (mid, floor) {
    const stalls = [];
    floor.zones.forEach(z => stalls.push.apply(stalls, mbZoneStalls(mid, z)));
    return `<div class="card"><div class="card-h"><h3>${U.esc(floor.name)}</h3><span class="small muted">${stalls.length} điểm KD · ${mbMetaLine(mid, stalls)}</span></div>
      <div class="card-b"><div class="plan">${mbFloorZonesHtml(mid, floor)}</div></div></div>`;
  };
  // 1 khu, dạng compact (không bọc .card riêng) để nhúng nhiều khu liên tiếp trong view Tầng —
  // click tên khu → drill-down tiếp sang view Khu (mục 7: "Click tên Khu → chuyển sang view Khu").
  function mbZoneSectionHtml(mid, z) {
    const matched = mbMatchRealSection(mid, z.code);
    const head = `<h4><button class="mb-zone-jump" data-act="mb-sel-zone" data-id="${z.key}">${U.esc(z.name || '(chưa đặt tên)')}</button><span>${U.esc(z.code || '')}${z.status === 'nhap' ? ' · <span class="tag warn">Nháp</span>' : ''}</span></h4>`;
    if (!matched) {
      const planned = U.sum(z.planned, p => Number(p.qty) || 0);
      return `<div class="plan-section">${head}<div class="small muted">${planned} điểm dự kiến · khu đang quy hoạch, chưa có dữ liệu thực tế</div></div>`;
    }
    const sec = matched.section, stalls = A.db.stalls.filter(st => st.market === mid && st.floor === matched.floor.id && st.section === sec.id);
    const rows = sec.rows.map(r => {
      const cells = stalls.filter(st => st.row === r);
      return `<div class="plan-row"><span class="rl">${r}</span><div class="cells" style="--n:${sec.per}">${cells.map(st => {
        const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
        // `data-id` stays the technical id; `code` is the human-facing point code.
        const structural = st.structuralStatus === 'SPLIT';
        // Bộ lọc dùng chung Sơ đồ/Bảng (js/v-cautruc.js A.mbMatchesFilter) — điểm không khớp mờ đi,
        // cùng cách xử lý đã có cho điểm cấu trúc "Đã tách" (mục 7 yêu cầu redesign).
        const dim = structural || !A.mbMatchesFilter(st);
        return `<button class="cell s-${A.mbStatusAt(st)} ${sec.type === 'kiot' ? 'kiot' : ''} ${dim ? 'dim' : ''}" data-act="stall" data-id="${st.id}" title="${mbPointTitle(st, t, structural)}">${st.code}${A.WORKFLOW && A.WORKFLOW.isRecentPoint(st.id) ? '<small class="workflow-grid-new">Mới</small>' : ''}</button>`;
      }).join('')}</div></div>`;
    }).join('<div class="aisle"></div>');
    // PHAN_CONG_NHAN_VIEN_THU_PHI (mục 6 yêu cầu): thêm ĐÚNG 1 dòng nhỏ, không làm nặng giao diện —
    // A.mbZoneCollectorLabel (js/v-cautruc.js) tự suy "Chưa phân công"/"Nhiều NV phụ trách"/tên NV.
    const collectorLbl = A.mbZoneCollectorLabel(mid, z);
    return `<div class="plan-section">${head}<div class="small muted" style="margin:-4px 0 8px">${stalls.length} điểm · ${mbMetaLine(mid, stalls)}</div>${collectorLbl ? `<div class="small muted" style="margin:-4px 0 8px">NV thu phí: ${U.esc(collectorLbl)}</div>` : ''}${rows}</div>`;
  }
  // ---- Khu (mục 8): giữ đúng hành vi cũ (legend lọc trạng thái + tìm kiếm + sơ đồ đầy đủ). ----
  A.mbZoneDiagramHtml = function (mid, z, canEditZone) {
    const resolved = A.mbResolveZoneContext(mid, z);
    const editBtn = canEditZone ? `<button class="btn sm" data-act="qh-zone-edit-open" data-id="${z.key}">${U.icon('edit')}Sửa thông tin khu</button>` : '';
    if (!resolved.matched) {
      const totalQty = U.sum(z.planned, p => Number(p.qty) || 0), totalArea = U.sum(z.planned, p => (Number(p.std) || 0) * (Number(p.qty) || 0));
      return `<div class="card"><div class="card-h"><h3>${U.esc(z.name || '(chưa đặt tên)')}</h3><span class="small muted">${U.esc(z.code || '')} · quy hoạch</span><span class="spacer"></span>${editBtn}</div>
        <div class="card-b"><div class="note info">Khu này đang ở giai đoạn quy hoạch, chưa có điểm kinh doanh thực tế tương ứng (mã "${U.esc(z.code || '')}" chưa khớp khu vực nào trong sơ đồ thật).</div>
        <div class="row" style="margin-top:10px"><span>Số điểm dự kiến</span><span class="spacer"></span><b>${totalQty.toLocaleString('vi-VN')}</b></div>
        <div class="row"><span>Diện tích dự kiến</span><span class="spacer"></span><b>${totalArea.toLocaleString('vi-VN')} m²</b></div></div></div>`;
    }
    const f = resolved.floor, sec = resolved.section;
    const stalls = A.mbBusinessPointsForZone(mid, z);
    const legend = Object.keys(D.STATUS).map(k => `<button class="${ui.hidden[k] ? 'off' : ''}" data-act="legend" data-s="${k}"><span class="sw" style="background:${D.STATUS[k].color}"></span>${A.mbStatusLabel(k)} <b>${stalls.filter(st => st.status === k).length}</b></button>`).join('');
    const rentalLegend = mid === 'TTD'
      ? `<span class="tag">${stalls.filter(st => U.rentalKind(st) === 'fixed').length} quầy cố định tháng/quý</span> <span class="tag">${stalls.filter(st => U.rentalKind(st) === 'session').length} quầy theo phiên/vãng lai</span>`
      : '';
    const rows = sec.rows.map(r => {
      const cells = stalls.filter(st => st.row === r);
      return `<div class="plan-row"><span class="rl">${r}</span><div class="cells" style="--n:${sec.per}">${cells.map(st => {
        const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
        // Search filtering and structural history share the existing dim treatment. Bộ lọc dùng
        // chung Sơ đồ/Bảng (A.mbMatchesFilter) cộng thêm — mờ nếu KHÔNG khớp legend/search tại khu
        // NÀY hoặc KHÔNG khớp bộ lọc chung ở thanh trên (mục 7 yêu cầu redesign).
        const dim = st.structuralStatus === 'SPLIT' || !stallMatch(st) || !A.mbMatchesFilter(st);
        return `<button class="cell s-${A.mbStatusAt(st)} ${sec.type === 'kiot' ? 'kiot' : ''} ${dim ? 'dim' : ''} ${ui.sel === st.id ? 'sel' : ''}" data-act="stall" data-id="${st.id}" title="${mbPointTitle(st, t, st.structuralStatus === 'SPLIT')}">${st.code}${A.WORKFLOW && A.WORKFLOW.isRecentPoint(st.id) ? '<small class="workflow-grid-new">Mới</small>' : ''}</button>`;
      }).join('')}</div></div>`;
    }).join('<div class="aisle"></div>');
    // PHAN_CONG_NHAN_VIEN_THU_PHI (mục 6 yêu cầu): nối thêm vào ĐÚNG dòng meta nhỏ sẵn có, không tạo
    // khối riêng — giữ giao diện nhẹ.
    const collectorLbl = A.mbZoneCollectorLabel(mid, z);
    return `<div class="card"><div class="card-h">
        <h3>${U.esc(sec.name)}</h3><span class="small muted">${stalls.length} điểm · ${U.esc(sec.cat)} · ${f.name}${collectorLbl ? ` · NV thu phí: ${U.esc(collectorLbl)}` : ''}</span>
        <span class="spacer"></span>${editBtn}<input class="input" style="width:220px" placeholder="Tìm mã điểm hoặc tên tiểu thương" data-in="plan-search" value="${U.esc(ui.planSearch)}"></div>
      <div class="card-b"><div class="legend" style="margin-bottom:10px">${legend}</div>${rentalLegend ? `<div class="small muted" style="margin:-2px 0 10px">${rentalLegend}</div>` : ''}<div class="plan">${rows}</div></div></div>`;
  };
  function stallMatch(st) {
    const q = ui.planSearch.trim().toLowerCase();
    if (ui.hidden[A.mbStatusAt(st)]) return false;
    if (!q) return true;
    const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
    return st.code.toLowerCase().includes(q) || (t && t.name.toLowerCase().includes(q));
  }

  Object.assign(A.ACT, {
    legend: el => { ui.hidden[el.dataset.s] = !ui.hidden[el.dataset.s]; A.render(); },
    // Click 1 điểm trên sơ đồ = mở drawer GỐC (không phải drill-down từ drawer khác) — luôn reset
    // navigation stack trước, đảm bảo không hiện "← Quay lại" giả (mục 6 yêu cầu back navigation).
    stall: el => { A.drawerReset(); mbOpenStallDrawer(A.idx.stall.get(el.dataset.id)); },
    // 2 nút điều hướng "xem sâu" của drawer Mặt bằng CL — KHÔNG còn A.go() đổi hẳn màn hình nữa
    // (MARKET_LAYOUT_DRILLDOWN_UX hotfix): ở lại ĐÚNG màn 'mat-bang' nền, chỉ thay #modal-root, và
    // lưu lại cách vẽ đúng drawer nguồn (mbOpenStallDrawer, label = mã điểm) vào navigation stack
    // dùng chung (A.drawerPush/A.drawerBackHtml, core.js) để "← Quay lại <mã điểm>" hoạt động đúng
    // — thay vì quay về danh sách Tiểu thương/Điểm kinh doanh. Tái dùng NGUYÊN A.openTraderDrawer/
    // A.openDkDrawer đã có sẵn ở js/v-tieuthuong.js (không tạo drawer/model mới).
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
  A.IN['plan-search'] = el => { ui.planSearch = el.value; A.render(); };
})(window.APP);
