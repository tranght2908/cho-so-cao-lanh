/* Điều hành – UC01.1: Thiết lập cấu trúc và phân khu mặt bằng.
 * Module này tự quản lý dữ liệu riêng (mô hình LAYOUT nội bộ: block → floor → zone, quy hoạch loại
 * điểm dự kiến), lưu ở localStorage riêng, KHÔNG đọc/ghi vào MARKETS hay stalls của data.js.
 * UC này chỉ quy hoạch số lượng/loại điểm dự kiến theo khu – chưa tạo điểm kinh doanh cụ thể
 * (việc đó thuộc màn "Điểm kinh doanh").
 *
 * MAT_BANG_KHU_TANG_DAY_REDESIGN: field nội bộ block/floor/zone GIỮ NGUYÊN (không đổi tên field,
 * không đổi shape LAYOUT, không tạo source-of-truth mặt bằng thứ hai) — CHỈ đổi NHÃN hiển thị cho
 * khớp thuật ngữ nghiệp vụ mới, đúng 1 chỗ duy nhất tại tầng UI (không rải rác):
 *   block (LAYOUT, trước hiển thị "Khối/Nhà chợ") → hiển thị "Khu"      (Chợ → Khu)
 *   floor (LAYOUT, "Tầng")                        → hiển thị "Tầng"    (không đổi)
 *   zone  (LAYOUT, trước hiển thị "Khu")           → hiển thị "Dãy"    (Tầng → Dãy → Điểm KD)
 * Cấu trúc hiển thị: Chợ → Khu → Tầng → Dãy → Điểm kinh doanh (mục 2 yêu cầu redesign). Ngành hàng
 * (`catMain`/`cat`) vẫn là THUỘC TÍNH của dãy/điểm, KHÔNG dùng thay cấp Dãy — Dãy luôn định danh bằng
 * mã + tên riêng (z.code/z.name), độc lập với ngành hàng.
 */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const LKEY = 'choso-caolanh-layout';

  const CATS = ['Ki-ốt tổng hợp', 'Thủy hải sản', 'Thịt, gia cầm', 'Rau củ, trái cây', 'Lương thực, thực phẩm khô',
    'Bách hóa tổng hợp', 'May mặc, giày dép', 'Ăn uống', 'Dịch vụ', 'Nông sản tự sản tự tiêu',
    'Ẩm thực dân dã', 'Nông sản, đặc sản', 'Trải nghiệm', 'Khác'];

  let seq = 0;
  const newKey = p => p + '_' + (++seq) + '_' + Math.random().toString(36).slice(2, 6);

  // ---------- cấu trúc mặc định: gợi ý dựa theo MARKETS hiện có (chỉ đọc, không ghi ngược) ----------
  function defaultLayout() {
    const out = {};
    D.MARKETS.forEach(m => {
      const blocks = [];
      m.floors.forEach(fl => {
        if (fl.parking) return; // tầng hầm: không quy hoạch điểm kinh doanh
        const bname = m.kind === 'session' ? 'Khu chợ quê' : 'Nhà chợ chính';
        let block = blocks.find(b => b.name === bname);
        if (!block) { block = { key: newKey('b'), name: bname, floors: [] }; blocks.push(block); }
        const floor = { key: newKey('f'), name: fl.name, zones: [] };
        fl.sections.forEach(s => {
          const avg = +((s.area[0] + s.area[1]) / 2).toFixed(1);
          const qty = s.rows.length * s.per;
          floor.zones.push({
            key: newKey('z'), code: s.id, name: s.name, blockId: block.key, floorId: floor.key,
            catMain: s.cat, catSub: '', area: Math.round(avg * qty), note: '', status: 'chinhthuc',
            planned: [{ key: newKey('p'), name: U.areaTypeLabel(({ kiot: 'covered', nhalong: 'covered', ngoai: 'self_produced', phien: 'session' }[s.type] || 'covered')), std: avg, qty: qty }]
          });
        });
        block.floors.push(floor);
      });
      out[m.id] = { blocks: blocks };
    });
    return out;
  }

  function loadLayout() {
    try { const s = localStorage.getItem(LKEY); if (s) return JSON.parse(s); } catch (e) { /* bỏ qua */ }
    return defaultLayout();
  }
  let LAYOUT = loadLayout();
  function saveLayout() { try { localStorage.setItem(LKEY, JSON.stringify(LAYOUT)); } catch (e) { /* bỏ qua */ } }

  if (!ui.qh) ui.qh = { market: 'CL', selZone: null };
  function qhMarket() { return ui.market === 'ALL' ? ui.qh.market : ui.market; }

  // ---------- truy vấn cấu trúc ----------
  function blocksOf(mid) { return LAYOUT[mid].blocks; }
  function findBlock(mid, bk) { return blocksOf(mid).find(b => b.key === bk); }
  function floorsOfBlock(mid, bk) { const b = findBlock(mid, bk); return b ? b.floors : []; }
  function findFloor(mid, bk, fk) { return floorsOfBlock(mid, bk).find(f => f.key === fk); }
  function firstFloorKey(mid, bk) { const fs = floorsOfBlock(mid, bk); return fs.length ? fs[0].key : null; }
  function firstZonePlace(mid) {
    const b = blocksOf(mid)[0];
    const f = b && b.floors[0];
    return b && f ? { blockId: b.key, floorId: f.key } : null;
  }
  function findFloorOfZone(mid, zk) {
    for (const b of blocksOf(mid)) for (const f of b.floors) if (f.zones.some(z => z.key === zk)) return f;
    return null;
  }
  function findZone(mid, zk) {
    for (const b of blocksOf(mid)) for (const f of b.floors) { const z = f.zones.find(x => x.key === zk); if (z) return z; }
    return null;
  }
  function flatZones(mid) {
    const out = [];
    blocksOf(mid).forEach(b => b.floors.forEach(f => f.zones.forEach(z => out.push(z))));
    return out;
  }
  function codeTaken(mid, code, excludeKey) {
    const c = code.trim().toLowerCase();
    return flatZones(mid).some(z => z.key !== excludeKey && (z.code || '').trim().toLowerCase() === c);
  }
  function marketLayoutStats(mid) {
    const zs = flatZones(mid);
    let pts = 0, area = 0, draft = 0;
    zs.forEach(z => {
      if (z.status === 'nhap') draft++;
      z.planned.forEach(p => { pts += Number(p.qty) || 0; area += (Number(p.std) || 0) * (Number(p.qty) || 0); });
    });
    return { blocks: blocksOf(mid).length, floors: U.sum(blocksOf(mid), b => b.floors.length), zones: zs.length, pts: pts, area: area, draft: draft };
  }
  function validateZone(z) {
    const errs = [];
    if (!z.code || !z.code.trim()) errs.push('Chưa nhập Mã khu.');
    else if (codeTaken(qhMarket(), z.code, z.key)) errs.push('Mã khu "' + z.code + '" đã tồn tại trong chợ này.');
    if (!z.name || !z.name.trim()) errs.push('Chưa nhập Tên khu.');
    if (!z.blockId || !z.floorId) errs.push('Khu chưa được gán vào khối/tầng hợp lệ.');
    // MAT_BANG_NGANH_HANG_CAP_DIEM: "Ngành hàng" là thuộc tính của ĐIỂM kinh doanh, không phải của
    // Dãy — catMain nay là "Ngành hàng định hướng" (không bắt buộc), bỏ validate required.
    if (!(Number(z.area) > 0)) errs.push('Diện tích khu phải lớn hơn 0.');
    const totalArea = U.sum(z.planned, p => (Number(p.std) || 0) * (Number(p.qty) || 0));
    if (totalArea > Number(z.area)) errs.push('Tổng diện tích điểm kinh doanh dự kiến (' + totalArea.toLocaleString('vi-VN') + ' m²) vượt quá diện tích của khu (' + Number(z.area || 0).toLocaleString('vi-VN') + ' m²).');
    return errs;
  }

  // ---------- giao diện (hotfix UX — xem MARKET_LAYOUT_UX_HOTFIX_REPORT.md) ----------
  // KHÔNG còn "edit mode" như 1 trang riêng: workspace "Mặt bằng chợ" chỉ còn 1 cây cấu trúc DUY
  // NHẤT (nguồn LAYOUT — model quy hoạch, KHÔNG đổi), action Thêm/Sửa/Xóa hiện NGAY cạnh từng node
  // theo đúng permission hiện có, không cần bấm "Thiết lập mặt bằng" trước. Phase 7: route DUY
  // NHẤT #/mat-bang (screen permission 'mat-bang' DUY NHẤT, xem js/permissions.js) render workspace
  // này — hash cũ #/so-do/#/cau-truc redirect ở A.route() (js/core.js), không còn 2 screen permission
  // riêng như trước.
  // ui.mb: state hiển thị dùng chung (thuần UI, KHÔNG persist — không lưu localStorage, tự derive
  // lại từ LAYOUT mỗi lần render). Drill-down nhiều cấp (MARKET_LAYOUT_DRILLDOWN_UX_REPORT.md):
  // 'sel' = node đang xem ở panel phải — null (Tổng quan), {k:'block',id} (Khối/Nhà chợ),
  // {k:'floor',id} (Tầng) hoặc {k:'zone',id} (Khu); mọi cấp đều click được (mục 2/13 yêu cầu — xem
  // là navigation, KHÔNG cần cau-truc.edit). 'collapsed' = khối/tầng nào đang thu gọn trên cây,
  // 'treeOpen' = hiện cây trên mobile.
  if (!ui.mb) ui.mb = { sel: null, collapsed: {}, treeOpen: false };
  // MAT_BANG_KHU_TANG_DAY_REDESIGN — state MỚI, thuần UI (không persist, giống ui.mb.sel):
  //   view   : 'grid' (Sơ đồ) | 'table' (Bảng) — 2 CHẾ ĐỘ HIỂN THỊ của CÙNG 1 tập dữ liệu, không
  //            phải 2 route/tab nghiệp vụ riêng (mục 4 yêu cầu redesign).
  //   filter : { search, status, cat, areaType } — bộ lọc DÙNG CHUNG cho cả Sơ đồ lẫn Bảng (mục 7 yêu
  //            cầu), áp dụng CÙNG với phạm vi đang chọn trên cây (ui.mb.sel) — không tạo dataset riêng.
  //            areaType (MAT_BANG_LOAI_DIEN_TICH) lọc theo st.areaType ("Loại diện tích") — thay cho
  //            f.dkclType/pointType cũ (CHỈ có ở CL) — filter mới áp dụng ĐỒNG NHẤT mọi chợ vì st.type
  //            là field gốc trên mọi điểm kinh doanh, không riêng CL.
  if (!ui.mb.view) ui.mb.view = 'grid';
  if (!ui.mb.filter) ui.mb.filter = { search: '', status: '', cat: '', areaType: '' };

  // ---- API dùng chung cho phần "Sơ đồ/Bảng" (js/v-dieuhanh.js, js/v-tieuthuong.js) — resolve
  // phạm vi đang chọn trên cây (ui.mb.sel) thành ĐÚNG tập điểm kinh doanh THẬT (A.db.stalls), rồi áp
  // bộ lọc dùng chung. KHÔNG tạo dataset/mảng điểm mới — luôn gọi lại A.mbBusinessPointsFor* (nguồn
  // đã có, js/v-dieuhanh.js) tại thời điểm cần, nên Sơ đồ/Bảng/mọi nơi dùng hàm này luôn thấy CÙNG 1
  // kết quả tại CÙNG 1 thời điểm.
  function mbZonePoints(mid, z) { return A.mbBusinessPointsForZone(mid, z); }
  function mbFloorPoints(mid, floor) { return floor.zones.reduce((acc, z) => acc.concat(mbZonePoints(mid, z)), []); }
  function mbBlockPoints(mid, block) { return block.floors.reduce((acc, f) => acc.concat(mbFloorPoints(mid, f)), []); }
  A.mbSelectedStalls = function (mid) {
    const sel = ui.mb.sel;
    if (sel && sel.k === 'zone') { const z = findZone(mid, sel.id); return z ? mbZonePoints(mid, z) : []; }
    if (sel && sel.k === 'floor') { const found = findFloorAny(mid, sel.id); return found ? mbFloorPoints(mid, found.floor) : []; }
    if (sel && sel.k === 'block') { const b = findBlock(mid, sel.id); return b ? mbBlockPoints(mid, b) : []; }
    return A.mbBusinessPointsForMarket(mid);
  };
  // LAYOUT uses block/floor/zone internally; the table uses the business labels Khu/Tầng/Dãy.
  A.mbSelectedLevel = function () {
    const sel = ui.mb.sel;
    return !sel ? 'overview' : sel.k === 'block' ? 'zone' : sel.k === 'floor' ? 'floor' : 'row';
  };
  A.mbPositionColumnVisibility = function () {
    const level = A.mbSelectedLevel();
    return { level, zone: level === 'overview', floor: level === 'overview' || level === 'zone', row: level !== 'row' };
  };
  // Quy về đúng {Khu, Tầng, Dãy} hiển thị cho 1 điểm kinh doanh thật — tra theo mã khu vực thật
  // (st.section) khớp z.code trong LAYOUT (đúng cơ chế mbMatchRealSection đã có ở js/v-dieuhanh.js,
  // chỉ đi CHIỀU NGƯỢC LẠI: từ điểm thật → node cây). Trả về nhãn hiển thị, KHÔNG trả về key LAYOUT.
  A.mbLayoutPathForPoint = function (mid, st) {
    for (const b of blocksOf(mid)) for (const f of b.floors) for (const z of f.zones)
      if (z.code === st.section) return { khu: b.name, tang: f.name, day: z.name || z.code };
    // Chưa khớp LAYOUT (khu vực thật chưa được quy hoạch trong cây) — vẫn hiển thị được nhờ dữ liệu
    // gốc trên chính điểm kinh doanh (st.sectionName + tên tầng thật), không để trống.
    const flReal = U.market(mid).floors.find(x => x.id === st.floor);
    return { khu: '—', tang: flReal ? flReal.name : '—', day: st.sectionName || st.section };
  };
  // Bộ lọc dùng chung — trạng thái (badge chip) áp dụng ở CẢ Sơ đồ lẫn Bảng (không đổi). Tìm
  // mã điểm/tiểu thương + ngành hàng (thanh filter) nay CHỈ hiển thị ở Bảng (MAT_BANG_SEARCH_FILTER_
  // TABLE_ONLY — mục 1/8 yêu cầu) nên cũng CHỈ áp dụng khi ui.mb.view === 'table' — Sơ đồ không bị
  // "lọc ngầm" bởi search/ngành hàng đang ẩn, chỉ còn phạm vi cây (Khu/Tầng/Dãy) + trạng thái quyết
  // định hiển thị. KHÔNG reset flt.search/flt.cat khi ẩn — giữ nguyên giá trị, quay lại Bảng vẫn áp
  // dụng lại được (mục 7 yêu cầu: không rewrite state management chỉ để reset filter).
  A.mbMatchesFilter = function (st) {
    const flt = ui.mb.filter;
    if (flt.status && st.status !== flt.status) return false;
    if (ui.mb.view !== 'table') return true;
    if (flt.cat && st.cat !== flt.cat) return false;
    if (flt.areaType && st.areaType !== flt.areaType) return false;
    const q = (flt.search || '').trim().toLowerCase();
    if (q) {
      const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
      if (!st.code.toLowerCase().includes(q) && !(t && t.name.toLowerCase().includes(q))) return false;
    }
    return true;
  };
  // Dataset DUY NHẤT cho cả Sơ đồ lẫn Bảng (mục 11 yêu cầu: "không hardcode 1 dataset riêng cho UI
  // mới") — phạm vi cây + bộ lọc dùng chung, áp dụng 1 LẦN, mọi nơi hiển thị (grid/table) render lại
  // TỪ đúng mảng này.
  A.mbCurrentPoints = function (mid) { return A.mbSelectedStalls(mid).filter(A.mbMatchesFilter); };
  // Ngành hàng có thật trong chợ (data-driven — không hard-code danh sách CATS quy hoạch) để đổ vào
  // dropdown lọc ngành hàng.
  A.mbCatOptions = function (mid) { return Array.from(new Set(A.mbBusinessPointsForMarket(mid).map(st => st.cat).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi')); };
  function mbCan(mid) { return { edit: A.canDo('cau-truc.edit', mid), del: A.canDo('cau-truc.delete', mid), reset: A.canDo('cau-truc.reset', mid) }; }
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
  function mbActions(list) { list = list.filter(Boolean); return list.length ? `<span class="mb-actions">${list.join('')}</span>` : ''; }
  // Chợ chỉ có đúng 1 khối + 1 tầng (vd. chợ quê TTĐ — xem defaultLayout()): cây gộp 2 cấp Khối/Tầng
  // thành 1 hàng (mục 11 — suy ra từ CHÍNH cấu trúc dữ liệu, không hard-code theo market id), nên
  // cấp "Khối" không tồn tại như 1 điểm chọn riêng trong trường hợp này — dùng chung ở cả cây LẪN
  // breadcrumb để 2 nơi luôn nhất quán.
  function mbFlatMode(mid) { const bs = blocksOf(mid); return bs.length === 1 && bs[0].floors.length === 1; }
  function mbIsSelZone(zk) { return !!ui.mb.sel && ui.mb.sel.k === 'zone' && ui.mb.sel.id === zk; }
  function mbIsSelBlock(bk) { return !!ui.mb.sel && ui.mb.sel.k === 'block' && ui.mb.sel.id === bk; }
  function mbIsSelFloor(fk) { return !!ui.mb.sel && ui.mb.sel.k === 'floor' && ui.mb.sel.id === fk; }
  function findFloorAny(mid, fk) { for (const b of blocksOf(mid)) { const f = b.floors.find(x => x.key === fk); if (f) return { block: b, floor: f }; } return null; }
  // Breadcrumb (mục 10): derived UI state THUẦN TÚY từ cấu trúc LAYOUT hiện tại — không lưu vào
  // localStorage/database. segs: mảng {label, act?, id?} — segment cuối luôn là vị trí hiện tại
  // (không click được), các segment trước đó click được để nhảy thẳng lên cấp cha.
  function mbCrumbHtml(segs) {
    return `<div class="mb-crumb">${segs.map((s, i) => i === segs.length - 1
      ? `<span class="mb-crumb-cur">${U.esc(s.label)}</span>`
      : `<button class="mb-crumb-link" data-act="${s.act}" ${s.id ? `data-id="${s.id}"` : ''}>${U.esc(s.label)}</button><span class="mb-crumb-sep">›</span>`).join('')}</div>`;
  }
  function mbCrumbsForBlock(mid, b) {
    return [{ label: U.market(mid).name, act: 'mb-sel-overview' }, { label: b.name }];
  }
  function mbCrumbsForFloor(mid, block, floor) {
    const segs = [{ label: U.market(mid).name, act: 'mb-sel-overview' }];
    if (!mbFlatMode(mid)) segs.push({ label: block.name, act: 'mb-sel-block', id: block.key });
    segs.push({ label: floor.name });
    return segs;
  }
  function mbCrumbsForZone(mid, z) {
    const block = findBlock(mid, z.blockId), floor = findFloor(mid, z.blockId, z.floorId);
    const segs = [{ label: U.market(mid).name, act: 'mb-sel-overview' }];
    if (block && !mbFlatMode(mid)) segs.push({ label: block.name, act: 'mb-sel-block', id: block.key });
    if (floor) segs.push({ label: floor.name, act: 'mb-sel-floor', id: floor.key });
    segs.push({ label: z.name || z.code || '(chưa đặt tên)' });
    return segs;
  }

  // ---- drawer "Sửa khu" (thay cho panel chi tiết lớn/cố định cũ — hotfix mục 4/8) ----
  // Cùng field/handler với bản cũ (qh-zone-field, qh-pt-field, qh-save-draft, qh-save-final,
  // qh-pt-add/del, qh-del-zone) — KHÔNG đổi logic, chỉ đổi khung hiển thị sang .drawer.
  function qhZoneDrawerHtml(mid, z) {
    const can = mbCan(mid), dis = can.edit ? '' : 'disabled';
    const isTtd = mid === 'TTD';
    const blocks = blocksOf(mid), floors = floorsOfBlock(mid, z.blockId);
    const totalQty = U.sum(z.planned, p => Number(p.qty) || 0);
    const totalArea = U.sum(z.planned, p => (Number(p.std) || 0) * (Number(p.qty) || 0));
    const over = totalArea > Number(z.area || 0);
    return `<div class="drawer-h"><div><h3>Sửa dãy</h3><div class="small muted" style="margin-top:2px">${z.status === 'nhap' ? '<span class="tag warn">Nháp</span>' : '<span class="tag ok">Chính thức</span>'}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
      <div class="form-grid">
        <div class="field"><label>Mã dãy *</label><input class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="code" value="${U.esc(z.code || '')}"></div>
        <div class="field"><label>Tên dãy *</label><input class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="name" value="${U.esc(z.name || '')}"></div>
        ${isTtd ? '' : `<div class="field"><label>Thuộc khu</label><select class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="blockId">${blocks.map(b => `<option value="${b.key}" ${b.key === z.blockId ? 'selected' : ''}>${U.esc(b.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Tầng</label><select class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="floorId">${floors.map(f => `<option value="${f.key}" ${f.key === z.floorId ? 'selected' : ''}>${U.esc(f.name)}</option>`).join('')}</select></div>`}
        <div class="field"><label>Ngành hàng định hướng</label><select class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="catMain"><option value="">— Chưa xác định —</option>${CATS.map(c => `<option ${c === z.catMain ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Ngành hàng phụ</label><input class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="catSub" value="${U.esc(z.catSub || '')}"></div>
        <div class="field"><label>Diện tích dãy (m²) *</label><input class="input" ${dis} type="number" min="0" data-ch="qh-zone-field" data-zone="${z.key}" data-k="area" value="${z.area || 0}"></div>
      </div>
      <div class="field" style="margin-top:10px"><label>Ghi chú</label><textarea class="input" ${dis} rows="2" data-ch="qh-zone-field" data-zone="${z.key}" data-k="note">${U.esc(z.note || '')}</textarea></div>
      <div class="divider"></div>
      <div class="row"><h4 style="margin:0;font-size:var(--font-size-sm)">Quy hoạch điểm kinh doanh trong dãy</h4><span class="spacer"></span>${can.edit ? `<button class="btn sm primary" data-act="qh-pt-add" data-id="${z.key}">+ Thêm loại diện tích</button>` : ''}</div>
      <div style="margin-top:8px">${U.table([{ t: 'Loại diện tích' }, { t: 'DT chuẩn (m²)', num: true }, { t: 'Số lượng', num: true }, { t: 'Diện tích (m²)', num: true }, { t: '' }],
        z.planned.map(p => `<tr>
          <td><select class="input" ${dis} data-ch="qh-pt-field" data-zone="${z.key}" data-pt="${p.key}" data-k="name"><option value="">— Chọn loại diện tích —</option>${U.AREA_TYPE_CODES.map(k => `<option ${p.name === U.areaTypeLabel(k) ? 'selected' : ''}>${U.areaTypeLabel(k)}</option>`).join('')}</select></td>
          <td><input class="input num" style="width:90px" ${dis} type="number" min="0" data-ch="qh-pt-field" data-zone="${z.key}" data-pt="${p.key}" data-k="std" value="${p.std || 0}"></td>
          <td><input class="input num" style="width:80px" ${dis} type="number" min="0" data-ch="qh-pt-field" data-zone="${z.key}" data-pt="${p.key}" data-k="qty" value="${p.qty || 0}"></td>
          <td class="num">${((Number(p.std) || 0) * (Number(p.qty) || 0)).toLocaleString('vi-VN')}</td>
          <td>${can.del ? `<button class="btn sm danger" data-act="qh-pt-del" data-id="${z.key}|${p.key}">Xóa</button>` : ''}</td></tr>`), { empty: 'Chưa khai báo loại diện tích nào' })}</div>
      <div class="row" style="padding:8px 2px;font-weight:600"><span>Tổng cộng</span><span class="spacer"></span><span>${totalQty.toLocaleString('vi-VN')} điểm dự kiến · ${totalArea.toLocaleString('vi-VN')} m²</span></div>
      ${over ? `<div class="note">Tổng diện tích điểm kinh doanh dự kiến (${totalArea.toLocaleString('vi-VN')} m²) vượt quá diện tích của khu (${Number(z.area || 0).toLocaleString('vi-VN')} m²).</div>` : ''}
      ${qhZoneCollectorSectionHtml(mid, z, can, dis)}
      </div>
      <div class="drawer-f">${can.del ? `<button class="btn danger" data-act="qh-del-zone" data-id="${z.key}">Xóa dãy</button>` : ''}<span class="spacer"></span>
        ${can.edit ? `<button class="btn" data-act="qh-save-draft" data-id="${z.key}">Lưu nháp</button><button class="btn primary" data-act="qh-save-final" data-id="${z.key}">Lưu và tiếp tục</button>` : '<button class="btn" data-act="close">Đóng</button>'}</div>`;
  }
  // PHAN_CONG_NHAN_VIEN_THU_PHI (mục 3 yêu cầu): section bổ sung trong popup "Sửa dãy" hiện có —
  // KHÔNG redesign phần còn lại của popup. Chỉ hiện khi dãy đã khớp dữ liệu thật (có điểm kinh doanh
  // để phân công) — dãy còn ở giai đoạn quy hoạch (chưa khớp) thì không có gì để gán.
  function qhZoneCollectorSectionHtml(mid, z, can, dis) {
    const pts = mbZonePoints(mid, z);
    if (!pts.length) return '';
    const collectors = mbCollectorAccounts(mid);
    const curId = mbZoneCollectorId(mid, z); // '' | 'MIXED' | <acc id>
    return `<div class="divider"></div>
      <div class="row"><h4 style="margin:0;font-size:var(--font-size-sm)">Phân công thu phí</h4></div>
      <div class="field" style="margin-top:8px"><label>Nhân viên thu phí phụ trách *</label>
        <select class="input" ${dis} data-ch="qh-zone-collector" data-zone="${z.key}">
          <option value="" ${!curId ? 'selected' : ''}>— Chưa phân công —</option>
          ${curId === 'MIXED' ? '<option value="MIXED" selected disabled>— Nhiều NV phụ trách —</option>' : ''}
          ${collectors.map(a => `<option value="${a.id}" ${curId === a.id ? 'selected' : ''}>${U.esc(a.fullName)}</option>`).join('')}
        </select>
      </div>
      <div class="small muted" style="margin-top:4px">Phạm vi: ${pts.length.toLocaleString('vi-VN')} điểm kinh doanh thuộc dãy này</div>`;
  }
  function qhOpenZoneDrawer(mid, zk) {
    const z = findZone(mid, zk);
    if (!z) return;
    ui.qh.selZone = zk; ui.mb.sel = { k: 'zone', id: zk }; // đồng bộ để panel phải cũng đang xem đúng khu này
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${qhZoneDrawerHtml(mid, z)}</div>`;
  }
  // Gọi thêm (additive) sau các mutation field-level để giữ drawer đang mở luôn khớp dữ liệu mới
  // nhất — KHÔNG đổi hành vi mutation/permission của các handler gốc, chỉ đồng bộ UI.
  function qhSyncDrawer() {
    if (!ui.qh.selZone || !document.querySelector('.drawer')) return;
    const mid = qhMarket(), z = findZone(mid, ui.qh.selZone);
    if (!z) { A.closeModal(); return; }
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${qhZoneDrawerHtml(mid, z)}</div>`;
  }

  // ---- cây cấu trúc: MỌI node (Tổng quan/Khối/Tầng/Khu) đều click được để xem (mục 2/4/13 — pure
  // navigation, không cần permission), action Thêm/Sửa/Xóa hiện NGAY cạnh node, permission-gated
  // riêng (hotfix mục 5/6/7). Nút caret chỉ thu gọn/mở rộng cây — tách biệt khỏi việc chọn xem.
  function mbZonesHtml(f, can) {
    return `<div class="mb-zones">${f.zones.length ? f.zones.map(z => `<div class="mb-node mb-zone ${mbIsSelZone(z.key) ? 'on' : ''}">
        <button class="mb-zone-label" data-act="mb-sel-zone" data-id="${z.key}">${U.esc(z.name || '(chưa đặt tên)')} <span class="muted small">${U.esc(z.code || '')}</span>${z.status === 'nhap' ? ' <span class="tag warn">Nháp</span>' : ''}</button>
        ${mbActions([can.edit ? `<button class="mb-iconbtn" data-act="qh-zone-edit-open" data-id="${z.key}" title="Sửa dãy">✎ Sửa</button>` : '', can.del ? `<button class="mb-iconbtn danger" data-act="qh-del-zone" data-id="${z.key}" title="Xóa dãy">🗑 Xóa</button>` : ''])}
      </div>`).join('') : '<div class="empty small">Chưa có dãy</div>'}</div>`;
  }
  function mbTreeHtml(mid) {
    const can = mbCan(mid), blocks = blocksOf(mid);
    const isTtd = mid === 'TTD';
    const addZoneLabel = isTtd ? '+ Dãy chức năng' : '+ Dãy';
    const overviewBtn = `<button class="mb-node mb-overview ${!ui.mb.sel ? 'on' : ''}" data-act="mb-sel-overview">📊 Tổng quan</button>`;
    if (!blocks.length) return overviewBtn + `<div class="empty small">${isTtd ? 'Chưa có phân khu chợ nào.' : `Chưa có khu nào.${can.edit ? ' Bấm "+ Khu" ở trên để bắt đầu.' : ''}`}</div>`;
    // Chợ chỉ có đúng 1 khối + 1 tầng (vd. chợ quê TTĐ — xem defaultLayout()): gộp 2 cấp này lại
    // thành 1 hàng, tránh hiển thị 1 node "Tầng" trùng tên khối không mang giá trị (hotfix mục 14) —
    // suy ra từ CHÍNH cấu trúc dữ liệu, không hard-code theo market id. Hàng gộp chọn được, xem như
    // đang chọn "Tầng" duy nhất bên dưới (mbFlatMode()) — nội dung Khối/Tầng ở đây vốn giống hệt
    // nhau (chỉ 1 tầng trong khối) nên không cần phân biệt 2 điểm chọn.
    if (mbFlatMode(mid)) {
      const b = blocks[0], f = b.floors[0];
      const rowBtns = mbActions([
        can.edit ? `<button class="mb-iconbtn" data-act="qh-add-zone" data-block="${b.key}" data-floor="${f.key}" title="Thêm dãy">${addZoneLabel}</button>` : '',
        !isTtd && can.edit ? `<button class="mb-iconbtn" data-act="qh-edit-block" data-id="${b.key}" title="Sửa">✎ Sửa</button>` : '',
        !isTtd && can.del ? `<button class="mb-iconbtn danger" data-act="qh-del-block" data-id="${b.key}" title="Xóa">🗑 Xóa</button>` : ''
      ]);
      return overviewBtn + `<div class="mb-node mb-block-h mb-flatlabel-row ${mbIsSelFloor(f.key) ? 'on' : ''}"><button class="mb-node-label mb-node-label-btn" data-act="mb-sel-floor" data-id="${f.key}">${U.esc(b.name)}</button><span class="spacer"></span>${rowBtns}</div>${mbZonesHtml(f, can)}`;
    }
    return overviewBtn + blocks.map(b => {
      const bKey = 'b:' + b.key, bOpen = !ui.mb.collapsed[bKey];
      const bBtns = mbActions([
        !isTtd && can.edit ? `<button class="mb-iconbtn" data-act="qh-add-floor" data-block="${b.key}" title="Thêm tầng">+ Tầng</button>` : '',
        !isTtd && can.edit ? `<button class="mb-iconbtn" data-act="qh-edit-block" data-id="${b.key}" title="Sửa">✎</button>` : '',
        !isTtd && can.del ? `<button class="mb-iconbtn danger" data-act="qh-del-block" data-id="${b.key}" title="Xóa">🗑</button>` : ''
      ]);
      return `<div class="mb-block">
        <div class="mb-node mb-block-h ${mbIsSelBlock(b.key) ? 'on' : ''}"><button class="mb-caret-btn" data-act="mb-toggle-node" data-key="${bKey}">${bOpen ? '▼' : '▶'}</button><button class="mb-node-label mb-node-label-btn" data-act="mb-sel-block" data-id="${b.key}">${U.esc(b.name)}</button><span class="spacer"></span>${bBtns}</div>
        ${bOpen ? (b.floors.length ? b.floors.map(f => {
          const fKey = 'f:' + f.key, fOpen = !ui.mb.collapsed[fKey];
          const fBtns = mbActions([
            can.edit ? `<button class="mb-iconbtn" data-act="qh-add-zone" data-block="${b.key}" data-floor="${f.key}" title="Thêm dãy">${addZoneLabel}</button>` : '',
            !isTtd && can.edit ? `<button class="mb-iconbtn" data-act="qh-edit-floor" data-block="${b.key}" data-id="${f.key}" title="Sửa">✎</button>` : '',
            !isTtd && can.del ? `<button class="mb-iconbtn danger" data-act="qh-del-floor" data-block="${b.key}" data-id="${f.key}" title="Xóa">🗑</button>` : ''
          ]);
          return `<div class="mb-floor">
            <div class="mb-node mb-floor-h ${mbIsSelFloor(f.key) ? 'on' : ''}"><button class="mb-caret-btn" data-act="mb-toggle-node" data-key="${fKey}">${fOpen ? '▼' : '▶'}</button><button class="mb-node-label mb-node-label-btn" data-act="mb-sel-floor" data-id="${f.key}">${U.esc(f.name)}</button><span class="spacer"></span>${fBtns}</div>
            ${fOpen ? mbZonesHtml(f, can) : ''}
          </div>`;
        }).join('') : '<div class="empty small">Chưa có tầng</div>') : ''}
      </div>`;
    }).join('');
  }
  // Sơ đồ/Bảng (mục 4/5/6 yêu cầu redesign) — 2 nút nhỏ, KHÔNG đổi route/reload, chỉ đổi
  // ui.mb.view rồi render lại đúng vùng nội dung bên phải, giữ nguyên filter/selection hiện tại.
  function mbViewSwitcherHtml() {
    return `<div class="seg" style="margin-bottom:10px"><button class="${ui.mb.view === 'grid' ? 'on' : ''}" data-act="mb-view" data-id="grid">▦ Sơ đồ</button><button class="${ui.mb.view === 'table' ? 'on' : ''}" data-act="mb-view" data-id="table">☰ Bảng</button></div>`;
  }
  // Vùng nội dung bên phải: render đúng 1 trong 4 view theo cấp đang chọn (Tổng quan/Khối/Tầng/Khu),
  // luôn kèm breadcrumb derive từ LAYOUT hiện tại (mục 10). Node đã bị xóa (key không còn hợp lệ —
  // vd. vừa xóa khối/tầng/khu đang chọn, hoặc vừa đổi market/account) tự "heal" về Tổng quan, không
  // vỡ trang. Chế độ "Bảng" (ui.mb.view==='table') dùng CHUNG đúng phạm vi cây + bộ lọc (mục 6/7/11
  // yêu cầu redesign) — bảng KHÔNG drill-down theo cấp như chế độ Sơ đồ, luôn liệt kê phẳng toàn bộ
  // A.mbCurrentPoints(mid) trong phạm vi đang chọn.
  function mbRightHtml(mid) {
    if (ui.mb.view === 'table') {
      const sel = ui.mb.sel;
      const zone = sel && sel.k === 'zone' ? findZone(mid, sel.id) : null;
      const floor = sel && sel.k === 'floor' ? findFloorAny(mid, sel.id) : null;
      const block = sel && sel.k === 'block' ? findBlock(mid, sel.id) : null;
      const crumbs = zone ? mbCrumbsForZone(mid, zone)
        : floor ? mbCrumbsForFloor(mid, floor.block, floor.floor)
          : block ? mbCrumbsForBlock(mid, block) : [{ label: U.market(mid).name }];
      const richTable = A.dkTableHtml && A.dkTableHtml(mid);
      return mbViewSwitcherHtml() + mbCrumbHtml(crumbs || [{ label: U.market(mid).name }]) + (richTable || mbGenericTableHtml(mid));
    }
    const can = mbCan(mid), sel = ui.mb.sel;
    if (sel && sel.k === 'zone') {
      const z = findZone(mid, sel.id);
      if (z) return mbViewSwitcherHtml() + mbCrumbHtml(mbCrumbsForZone(mid, z)) + A.mbZoneDiagramHtml(mid, z, can.edit);
      ui.mb.sel = null;
    } else if (sel && sel.k === 'floor') {
      const found = findFloorAny(mid, sel.id);
      if (found) return mbViewSwitcherHtml() + mbCrumbHtml(mbCrumbsForFloor(mid, found.block, found.floor)) + A.mbFloorHtml(mid, found.floor);
      ui.mb.sel = null;
    } else if (sel && sel.k === 'block') {
      const b = findBlock(mid, sel.id);
      if (b) return mbViewSwitcherHtml() + mbCrumbHtml(mbCrumbsForBlock(mid, b)) + A.mbBlockHtml(mid, b);
      ui.mb.sel = null;
    }
    return mbViewSwitcherHtml() + mbCrumbHtml([{ label: U.market(mid).name }]) + A.mbOverviewHtml(mid, blocksOf(mid));
  }
  // Bảng chung cho market KHÔNG có bảng riêng (CL dùng A.dkTableHtml — richer, xem js/v-tieuthuong.js)
  // — cột theo đúng tài liệu nghiệp vụ (Mã điểm/Khu/Tầng/Dãy/Diện tích/Loại diện tích/Ngành hàng/
  // Trạng thái), cùng dataset A.mbCurrentPoints(mid) với Sơ đồ.
  // MAT_BANG_TABLE_TOOLBAR_UNIFY (mục 2 yêu cầu): search/ngành hàng/loại diện tích ở ngay trên bảng —
  // tái dùng NGUYÊN data-in="mb-filter-search"/data-ch="mb-filter-cat"/"mb-filter-area-type"/
  // data-act="mb-filter-clear" đã có, không tạo control/state mới. Không có "Xuất Excel" ở đây vì
  // market không phải CL chưa có chức năng đó (chỉ CL — dkViewCL, js/v-tieuthuong.js — mới có).
  function mbGenericTableHtml(mid) {
    const rows = A.mbCurrentPoints(mid), flt = ui.mb.filter, cats = A.mbCatOptions(mid), pos = A.mbPositionColumnVisibility();
    const toolbar = `<div class="card-h" style="flex-wrap:wrap">
        <input class="input" data-in="mb-filter-search" placeholder="Tìm mã điểm / tiểu thương" value="${U.esc(flt.search)}">
        <select class="input" data-ch="mb-filter-area-type"><option value="">Loại diện tích: Tất cả</option>${U.AREA_TYPE_CODES.map(k => `<option value="${k}" ${flt.areaType === k ? 'selected' : ''}>${U.areaTypeLabel(k)}</option>`).join('')}</select>
        <select class="input" data-ch="mb-filter-cat"><option value="">Ngành hàng: Tất cả</option>${cats.map(cName => `<option value="${U.esc(cName)}" ${flt.cat === cName ? 'selected' : ''}>${U.esc(cName)}</option>`).join('')}</select>
        ${(flt.search || flt.status || flt.cat || flt.areaType) ? `<button class="btn sm" data-act="mb-filter-clear">↺ Xóa bộ lọc</button>` : ''}
      </div>`;
    return `<div class="card mb-table-card">${toolbar}<div class="card-b">${U.table(
      [{ t: '<span class="mb-col-code">Mã điểm</span>' }, pos.zone && { t: '<span class="mb-col-zone">Khu</span>' }, pos.floor && { t: '<span class="mb-col-floor">Tầng</span>' }, pos.row && { t: '<span class="mb-col-row">Dãy</span>' }, { t: '<span class="mb-col-area">Diện tích (m²)</span>', num: true }, { t: '<span class="mb-col-area-type">Loại diện tích</span>' }, { t: '<span class="mb-col-category">Ngành hàng</span>' }, { t: '<span class="mb-col-trader">Tiểu thương</span>' }, { t: '<span class="mb-col-status">Trạng thái</span>' }, { t: '<span class="mb-col-actions">Thao tác</span>' }].filter(Boolean),
      rows.map(st => {
        const path = A.mbLayoutPathForPoint(mid, st), t = st.traderId ? A.idx.trader.get(st.traderId) : null;
        return `<tr><td class="mb-col-code"><b>${U.esc(st.code)}</b></td>${pos.zone ? `<td class="mb-col-zone">${U.esc(path.khu)}</td>` : ''}${pos.floor ? `<td class="mb-col-floor">${U.esc(path.tang)}</td>` : ''}${pos.row ? `<td class="mb-col-row">${U.esc(path.day)}</td>` : ''}
          <td class="num mb-col-area">${st.area.toLocaleString('vi-VN')}</td><td class="mb-col-area-type">${U.esc(U.areaTypeLabel(st.areaType) || 'Chưa có thông tin')}</td><td class="mb-col-category">${U.esc(st.cat || '')}</td>
          <td class="mb-col-trader">${t ? U.esc(t.name) : '<span class="muted">–</span>'}</td><td class="mb-col-status">${U.statusTag(st.status)}</td>
          <td class="nowrap mb-col-actions"><button class="btn sm" data-act="stall" data-id="${st.id}">Xem</button></td></tr>`;
      }), { empty: 'Không có điểm kinh doanh phù hợp bộ lọc.' }
    )}</div></div>`;
  }

  // Workspace "Mặt bằng chợ" DUY NHẤT — #/mat-bang (screen permission 'mat-bang' DUY NHẤT) trỏ vào
  // hàm này (gán ở cuối file). Không còn banner hướng dẫn dài/KPI card lớn/card hành
  // động riêng/sơ đồ quy hoạch tách rời như bản cũ (hotfix mục 4) — chỉ 1 header gọn + 1 cây cấu
  // trúc (action inline) + 1 vùng nội dung bên phải (Tổng quan hoặc sơ đồ đúng 1 khu).
  function mbWorkspaceHtml() {
    const mid = qhMarket(), can = mbCan(mid), m = U.market(mid), open = !!ui.mb.treeOpen;
    const isTtd = mid === 'TTD';
    const stats = A.mbMarketStats(mid);
    const flt = ui.mb.filter;
    const c = k => stats.byStatus[k] || 0;
    // Chip trạng thái BẤM ĐƯỢC (mục 7 yêu cầu redesign) — vẫn đúng 1 nguồn đếm A.mbMarketStats(mid)
    // như trước, chỉ thêm data-act + trạng thái "đang chọn" (ui.mb.filter.status). "Tất cả" = xoá lọc
    // trạng thái (giữ nguyên search/ngành hàng).
    const chip = (k, label, extra) => `<button class="mb-chip ${k ? 'mb-chip-' + k : 'mb-chip-total'} ${flt.status === (k || '') ? 'on' : ''}" data-act="mb-filter-status" data-id="${k || ''}">${k ? `<i style="background:${D.STATUS[k].color}"></i>` : ''}<b>${extra != null ? extra : c(k)}</b>${label}</button>`;
    const rentChip = (label, count) => `<span class="mb-chip mb-chip-total"><b>${count}</b>${label}</span>`;
    const rentalSummary = isTtd
      ? rentChip('quầy cố định tháng/quý', stats.points.filter(st => U.rentalKind(st) === 'fixed').length)
        + rentChip('quầy theo phiên/vãng lai', stats.points.filter(st => U.rentalKind(st) === 'session').length)
      : '';
    const statusChips = ['thue', 'trong', 'no', 'ngung', 'tranhchap'].map(k => chip(k, D.STATUS[k].label)).join('');
    const summary = rentalSummary + chip(null, 'điểm kinh doanh', stats.total) + statusChips;
    // MAT_BANG_TABLE_TOOLBAR_UNIFY (mục 1 yêu cầu): card header giờ CHỈ còn tên màn/tên chợ/mô tả/
    // badge thống kê — search + ngành hàng đã chuyển xuống toolbar ngay trên bảng (chỉ render ở chế
    // độ Bảng), xem dkViewCL()/js/v-tieuthuong.js (CL) và mbGenericTableHtml() bên trên (market khác)
    // — cùng tái dùng NGUYÊN data-in="mb-filter-search"/data-ch="mb-filter-cat", không tạo control
    // mới, không đổi ý nghĩa ui.mb.filter. Badge trạng thái (chip) KHÔNG đổi — vẫn ở đây, vẫn áp dụng
    // cho cả Sơ đồ lẫn Bảng như trước.
    return `<div class="card mb-head"><div class="card-b mb-head-b">
      <div class="mb-head-info"><h3>${isTtd ? 'Mặt bằng chợ' : 'Mặt bằng & điểm kinh doanh'}</h3><div class="mb-head-sub"><b>${U.esc(m.name)}</b> · ${U.esc(m.hang)}${m.address ? ' · ' + U.esc(m.address) : ''}</div>${m.note ? `<div class="small muted">${U.esc(m.note)}</div>` : ''}</div>
        <div class="mb-summary">${summary}</div></div></div>
    <button class="btn sm mb-tree-toggle" data-act="mb-toggle-tree">${open ? '✕ Đóng cấu trúc' : '☰ Cấu trúc mặt bằng'}</button>
    <div class="mb-workspace">
      <div class="card mb-tree-card ${open ? 'open' : ''}"><div class="card-h" style="padding-bottom:6px">
          <h3>Cấu trúc chợ</h3><span class="spacer"></span>
          ${!isTtd && can.edit ? `<button class="btn sm primary" data-act="qh-add-block">+ Khu</button>` : ''}
          ${can.reset ? `<button class="btn sm mb-more" data-act="qh-reset" title="Khôi phục cấu trúc mặc định">⋯</button>` : ''}</div>
        <div class="card-b mb-tree">${mbTreeHtml(mid)}</div></div>
      <div>${mbRightHtml(mid)}</div>
    </div>`;
  }

  Object.assign(A.ACT, {
    'mb-sel-zone': el => { ui.mb.sel = { k: 'zone', id: el.dataset.id }; A.render(); },
    'mb-sel-block': el => { ui.mb.sel = { k: 'block', id: el.dataset.id }; A.render(); },
    'mb-sel-floor': el => { ui.mb.sel = { k: 'floor', id: el.dataset.id }; A.render(); },
    'mb-sel-overview': () => { ui.mb.sel = null; A.render(); },
    'mb-toggle-node': el => { const k = el.dataset.key; ui.mb.collapsed[k] = !ui.mb.collapsed[k]; A.render(); },
    'mb-toggle-tree': () => { ui.mb.treeOpen = !ui.mb.treeOpen; A.render(); },
    // Chuyển Sơ đồ/Bảng (mục 4 yêu cầu redesign) — CHỈ đổi ui.mb.view rồi A.render(); KHÔNG đổi
    // route, KHÔNG reset ui.mb.sel (phạm vi cây)/ui.mb.filter (bộ lọc) đang giữ.
    'mb-view': el => { ui.mb.view = el.dataset.id === 'table' ? 'table' : 'grid'; A.render(); },
    'mb-filter-status': el => { ui.mb.filter.status = el.dataset.id; A.render(); },
    'mb-filter-clear': () => { ui.mb.filter = { search: '', status: '', cat: '', areaType: '' }; A.render(); },
    'qh-zone-edit-open': el => { if (findZone(qhMarket(), el.dataset.id)) qhOpenZoneDrawer(qhMarket(), el.dataset.id); },
    'qh-reset': () => {
      if (!A.canDo('cau-truc.reset', qhMarket())) return;
      A.modal(A.mHead('Khôi phục cấu trúc mặc định') + `<div class="modal-b">Toàn bộ cấu trúc khối/tầng/khu và quy hoạch điểm đã khai báo cho <b>${U.esc(U.market(qhMarket()).name)}</b> sẽ bị xóa và khôi phục về cấu trúc mẫu ban đầu.</div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="qh-reset-ok">Khôi phục</button></div>`);
    },
    'qh-reset-ok': () => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.reset', mid)) return;
      LAYOUT[mid] = defaultLayout()[mid];
      ui.qh.selZone = null; ui.mb.sel = null; // key cũ không còn hợp lệ sau khi tái tạo cấu trúc
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã khôi phục cấu trúc mặc định cho ' + U.mShort(mid));
    },
    'qh-add-block': () => {
      const mid = qhMarket();
      if (mid === 'TTD' || !A.canDo('cau-truc.edit', mid)) return;
      A.modal(A.mHead('Thêm khối / nhà chợ') + `<div class="modal-b"><div class="field"><label>Tên khối/nhà chợ *</label><input class="input" id="qhb-name" placeholder="VD: Nhà chợ chính"></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-add-block-save">Thêm</button></div>`);
    },
    'qh-add-block-save': () => {
      const mid = qhMarket();
      if (mid === 'TTD' || !A.canDo('cau-truc.edit', mid)) return;
      const name = A.$('#qhb-name').value.trim();
      if (!name) { U.toast('Vui lòng nhập tên khối/nhà chợ'); return; }
      LAYOUT[mid].blocks.push({ key: newKey('b'), name: name, floors: [] });
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã thêm khối/nhà chợ "' + name + '"');
    },
    'qh-edit-block': el => {
      const mid = qhMarket();
      if (mid === 'TTD' || !A.canDo('cau-truc.edit', mid)) return;
      const b = findBlock(mid, el.dataset.id);
      if (!b) return;
      A.modal(A.mHead('Sửa khối / nhà chợ') + `<div class="modal-b"><div class="field"><label>Tên khối/nhà chợ *</label><input class="input" id="qhb-name" value="${U.esc(b.name)}"></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-edit-block-save" data-id="${b.key}">Lưu</button></div>`);
    },
    'qh-edit-block-save': el => {
      const mid = qhMarket();
      if (mid === 'TTD' || !A.canDo('cau-truc.edit', mid)) return;
      const name = A.$('#qhb-name').value.trim();
      if (!name) { U.toast('Vui lòng nhập tên khối/nhà chợ'); return; }
      const b = findBlock(mid, el.dataset.id);
      if (b) b.name = name;
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã cập nhật');
    },
    'qh-del-block': el => {
      const mid = qhMarket();
      if (mid === 'TTD' || !A.canDo('cau-truc.delete', mid)) return;
      const b = findBlock(mid, el.dataset.id);
      if (!b) return;
      const zoneCount = U.sum(b.floors, f => f.zones.length);
      if (zoneCount) { U.toast('Khối "' + b.name + '" đang có ' + zoneCount + ' khu, cần xóa hết các khu trước.'); return; }
      A.modal(A.mHead('Xóa khối / nhà chợ') + `<div class="modal-b">Xóa khối/nhà chợ <b>${U.esc(b.name)}</b> và toàn bộ tầng bên trong (chưa có khu nào)?</div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="qh-del-block-ok" data-id="${b.key}">Xóa</button></div>`);
    },
    'qh-del-block-ok': el => {
      const mid = qhMarket();
      if (mid === 'TTD' || !A.canDo('cau-truc.delete', mid)) return;
      const L = LAYOUT[mid];
      // Phòng thủ lại (business rule): không xoá khối còn khu bên trong, dù nút Xoá ở bước trước
      // đã tự chặn — đúng theo yêu cầu "preserve existing child/dependency checks" (mục 8).
      const b = L.blocks.find(x => x.key === el.dataset.id);
      if (b && U.sum(b.floors, f => f.zones.length)) { U.toast('Khối "' + b.name + '" đang có khu, cần xóa hết các khu trước.'); return; }
      L.blocks = L.blocks.filter(x => x.key !== el.dataset.id);
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã xóa khối/nhà chợ');
    },
    'qh-add-floor': el => {
      const mid = qhMarket();
      if (mid === 'TTD' || !A.canDo('cau-truc.edit', mid)) return;
      A.modal(A.mHead('Thêm tầng') + `<div class="modal-b"><div class="field"><label>Tên tầng *</label><input class="input" id="qhf-name" placeholder="VD: Tầng 1"></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-add-floor-save" data-block="${el.dataset.block}">Thêm</button></div>`);
    },
    'qh-add-floor-save': el => {
      const mid = qhMarket();
      if (mid === 'TTD' || !A.canDo('cau-truc.edit', mid)) return;
      const name = A.$('#qhf-name').value.trim();
      if (!name) { U.toast('Vui lòng nhập tên tầng'); return; }
      const b = findBlock(mid, el.dataset.block);
      if (!b) return;
      b.floors.push({ key: newKey('f'), name: name, zones: [] });
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã thêm tầng "' + name + '"');
    },
    'qh-edit-floor': el => {
      const mid = qhMarket();
      if (mid === 'TTD' || !A.canDo('cau-truc.edit', mid)) return;
      const f = findFloor(mid, el.dataset.block, el.dataset.id);
      if (!f) return;
      A.modal(A.mHead('Sửa tầng') + `<div class="modal-b"><div class="field"><label>Tên tầng *</label><input class="input" id="qhf-name" value="${U.esc(f.name)}"></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-edit-floor-save" data-block="${el.dataset.block}" data-id="${f.key}">Lưu</button></div>`);
    },
    'qh-edit-floor-save': el => {
      const mid = qhMarket();
      if (mid === 'TTD' || !A.canDo('cau-truc.edit', mid)) return;
      const name = A.$('#qhf-name').value.trim();
      if (!name) { U.toast('Vui lòng nhập tên tầng'); return; }
      const f = findFloor(mid, el.dataset.block, el.dataset.id);
      if (f) f.name = name;
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã cập nhật');
    },
    'qh-del-floor': el => {
      const mid = qhMarket();
      if (mid === 'TTD' || !A.canDo('cau-truc.delete', mid)) return;
      const f = findFloor(mid, el.dataset.block, el.dataset.id);
      if (!f) return;
      if (f.zones.length) { U.toast('Tầng "' + f.name + '" đang có ' + f.zones.length + ' khu, cần xóa hết các khu trước.'); return; }
      A.modal(A.mHead('Xóa tầng') + `<div class="modal-b">Xóa tầng <b>${U.esc(f.name)}</b> (chưa có khu nào)?</div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="qh-del-floor-ok" data-block="${el.dataset.block}" data-id="${f.key}">Xóa</button></div>`);
    },
    'qh-del-floor-ok': el => {
      const mid = qhMarket();
      if (mid === 'TTD' || !A.canDo('cau-truc.delete', mid)) return;
      const b = findBlock(mid, el.dataset.block);
      const f = b && b.floors.find(x => x.key === el.dataset.id);
      if (f && f.zones.length) { U.toast('Tầng "' + f.name + '" đang có khu, cần xóa hết các khu trước.'); return; }
      if (b) b.floors = b.floors.filter(x => x.key !== el.dataset.id);
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã xóa tầng');
    },
    'qh-add-zone': el => {
      const mid = qhMarket(), isTtd = mid === 'TTD';
      if (!A.canDo('cau-truc.edit', mid)) return;
      const place = isTtd ? firstZonePlace(mid) : { blockId: el.dataset.block, floorId: el.dataset.floor };
      if (!place) { U.toast('Không tìm thấy phân khu mặc định để thêm khu'); return; }
      A.modal(A.mHead(isTtd ? 'Thêm khu chức năng' : 'Thêm khu mới') + `<div class="modal-b"><div class="form-grid">
        <div class="field"><label>Mã khu *</label><input class="input" id="qhz-code" placeholder="VD: A"></div>
        <div class="field"><label>Tên khu *</label><input class="input" id="qhz-name" placeholder="VD: Thực phẩm tươi sống"></div></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-add-zone-save" data-block="${place.blockId}" data-floor="${place.floorId}">Thêm</button></div>`);
    },
    'qh-add-zone-save': el => {
      const mid = qhMarket(), isTtd = mid === 'TTD';
      if (!A.canDo('cau-truc.edit', mid)) return;
      const code = A.$('#qhz-code').value.trim(), name = A.$('#qhz-name').value.trim();
      if (!code || !name) { U.toast('Vui lòng nhập đủ mã khu và tên khu'); return; }
      if (codeTaken(mid, code, null)) { U.toast('Mã khu "' + code + '" đã tồn tại trong chợ này'); return; }
      const place = isTtd ? firstZonePlace(mid) : { blockId: el.dataset.block, floorId: el.dataset.floor };
      if (!place) { U.toast('Không tìm thấy phân khu mặc định để thêm khu'); return; }
      const f = findFloor(mid, place.blockId, place.floorId);
      if (!f) { U.toast('Không tìm thấy tầng để thêm khu'); return; }
      const z = { key: newKey('z'), code: code, name: name, blockId: place.blockId, floorId: place.floorId, catMain: '', catSub: '', area: 0, note: '', status: 'nhap', planned: [] };
      f.zones.push(z);
      saveLayout(); A.render();
      // Mở luôn drawer sửa khu để khai báo tiếp ngành hàng/diện tích/loại điểm — thay cho việc
      // phải tự bấm chọn lại khu vừa tạo (hotfix mục 5: thêm mới → sửa ngay tại chỗ).
      qhOpenZoneDrawer(mid, z.key);
      U.toast('Đã thêm khu ' + code + '. Vui lòng khai báo thêm thông tin chi tiết.');
    },
    'qh-del-zone': el => {
      if (!A.canDo('cau-truc.delete', qhMarket())) return;
      const z = findZone(qhMarket(), el.dataset.id);
      if (!z) return;
      if (z.planned.length) {
        A.modal(A.mHead('Không thể xóa khu ' + U.esc(z.code)) + `<div class="modal-b"><div class="note">Khu "${U.esc(z.name)}" đã có quy hoạch loại điểm kinh doanh (${z.planned.length} loại). Vui lòng xóa hết các loại điểm ở mục "Quy hoạch loại điểm" trước khi xóa khu.</div></div>
          <div class="modal-f"><button class="btn primary" data-act="close">Đã hiểu</button></div>`);
        return;
      }
      A.modal(A.mHead('Xóa khu ' + U.esc(z.code)) + `<div class="modal-b">Bạn có chắc muốn xóa khu <b>${U.esc(z.name)}</b>? Thao tác này không thể hoàn tác.</div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="qh-del-zone-ok" data-id="${z.key}">Xóa khu</button></div>`);
    },
    'qh-del-zone-ok': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.delete', mid)) return;
      const z = findZone(mid, el.dataset.id);
      if (z && z.planned.length) { U.toast('Khu "' + z.name + '" còn quy hoạch loại điểm, cần xóa hết trước.'); return; }
      const f = findFloorOfZone(mid, el.dataset.id);
      if (f) f.zones = f.zones.filter(x => x.key !== el.dataset.id);
      if (ui.qh.selZone === el.dataset.id) ui.qh.selZone = null;
      if (mbIsSelZone(el.dataset.id)) ui.mb.sel = null;
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã xóa khu');
    },
    'qh-pt-add': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const z = findZone(qhMarket(), el.dataset.id);
      if (!z) return;
      z.planned.push({ key: newKey('p'), name: '', std: 0, qty: 0 });
      saveLayout(); A.render(); qhSyncDrawer();
    },
    'qh-pt-del': el => {
      if (!A.canDo('cau-truc.delete', qhMarket())) return;
      const parts = el.dataset.id.split('|'), zk = parts[0], pk = parts[1];
      const z = findZone(qhMarket(), zk);
      if (!z) return;
      z.planned = z.planned.filter(p => p.key !== pk);
      saveLayout(); A.render(); qhSyncDrawer(); U.toast('Đã xóa loại diện tích');
    },
    'qh-save-draft': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const z = findZone(qhMarket(), el.dataset.id);
      if (!z) return;
      z.status = 'nhap';
      saveLayout(); A.render(); qhSyncDrawer(); U.toast('Đã lưu nháp khu ' + (z.code || z.name));
    },
    'qh-save-final': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const z = findZone(qhMarket(), el.dataset.id);
      if (!z) return;
      const errs = validateZone(z);
      if (errs.length) { U.toast(errs[0]); return; }
      z.status = 'chinhthuc';
      const totalQty = U.sum(z.planned, p => Number(p.qty) || 0);
      const totalArea = U.sum(z.planned, p => (Number(p.std) || 0) * (Number(p.qty) || 0));
      saveLayout(); A.render(); qhSyncDrawer();
      U.toast('Đã lưu khu ' + z.code + ': ' + totalQty.toLocaleString('vi-VN') + ' điểm dự kiến, ' + totalArea.toLocaleString('vi-VN') + ' m²');
    }
  });

  A.CH['qh-zone-field'] = el => {
    const mid = qhMarket(), isTtd = mid === 'TTD';
    if (!A.canDo('cau-truc.edit', mid)) { A.render(); return; }
    const z = findZone(mid, el.dataset.zone);
    if (!z) return;
    const k = el.dataset.k;
    if (isTtd && (k === 'blockId' || k === 'floorId')) { qhSyncDrawer(); return; }
    if (k === 'area') z.area = Math.max(0, Number(el.value) || 0);
    else if (k === 'blockId') { z.blockId = el.value; z.floorId = firstFloorKey(mid, el.value); }
    else z[k] = el.value;
    saveLayout(); A.render(); qhSyncDrawer();
  };
  A.CH['qh-pt-field'] = el => {
    if (!A.canDo('cau-truc.edit', qhMarket())) { A.render(); return; }
    const z = findZone(qhMarket(), el.dataset.zone);
    if (!z) return;
    const p = z.planned.find(x => x.key === el.dataset.pt);
    if (!p) return;
    const k = el.dataset.k;
    if (k === 'std' || k === 'qty') p[k] = Math.max(0, Number(el.value) || 0);
    else p.name = el.value;
    saveLayout(); A.render(); qhSyncDrawer();
  };
  // PHAN_CONG_NHAN_VIEN_THU_PHI (mục 5 yêu cầu): chọn 1 NV cho cả dãy → ghi collectorId lên MỌI điểm
  // kinh doanh THẬT thuộc dãy (mục 2: "dãy chỉ là cách chọn nhanh") — GHI ĐÈ phân công cũ nếu có
  // (mục 7: đổi NV phải thay thế, không cộng dồn). Lưu qua A.save() (state thật — A.db.stalls),
  // KHÔNG qua saveLayout() (đó là model quy hoạch riêng, không liên quan tới field này).
  A.CH['qh-zone-collector'] = el => {
    const mid = qhMarket();
    if (!A.canDo('cau-truc.edit', mid)) { A.render(); return; }
    const z = findZone(mid, el.dataset.zone);
    if (!z) return;
    const pts = mbZonePoints(mid, z);
    if (!pts.length) return;
    const collectorId = el.value || null;
    pts.forEach(st => { st.collectorId = collectorId; });
    A.save();
    const acc = collectorId ? A.ACCOUNTS.get(collectorId) : null;
    U.toast(acc ? `Đã phân công ${acc.fullName} phụ trách thu phí dãy ${z.name || z.code}` : `Đã bỏ phân công thu phí dãy ${z.name || z.code}`);
    A.render(); qhSyncDrawer();
  };
  A.IN['mb-filter-search'] = el => { ui.mb.filter.search = el.value; A.render(); };
  A.CH['mb-filter-cat'] = el => { ui.mb.filter.cat = el.value; A.render(); };
  // MAT_BANG_LOAI_DIEN_TICH: filter "Loại diện tích" dùng CHUNG cho mọi bảng điểm kinh doanh (CL lẫn
  // market khác) — CÙNG 1 handler, tái dùng ui.mb.filter/A.mbMatchesFilter đã có, không tạo state
  // riêng cho từng market như f.dkclType cũ (đã bỏ, xem js/v-tieuthuong.js).
  A.CH['mb-filter-area-type'] = el => { ui.mb.filter.areaType = el.value; A.render(); };

  // Phase 7: #/mat-bang (screen permission 'mat-bang' DUY NHẤT) render workspace này — không còn
  // 2 registration 'so-do'/'cau-truc' riêng, không còn khái niệm "màn edit riêng" (xem ghi chú đầu
  // khối giao diện phía trên).
  A.mbWorkspaceHtml = mbWorkspaceHtml;
  A.VIEWS['mat-bang'] = mbWorkspaceHtml;
})(window.APP);
