/* Điều hành – UC01.1: Thiết lập cấu trúc và phân khu mặt bằng.
 * Module này tự quản lý dữ liệu riêng (Khối/Nhà chợ → Tầng → Khu, quy hoạch loại điểm dự kiến),
 * lưu ở localStorage riêng, KHÔNG đọc/ghi vào MARKETS hay stalls của data.js.
 * UC này chỉ quy hoạch số lượng/loại điểm dự kiến theo khu – chưa tạo điểm kinh doanh cụ thể
 * (việc đó thuộc màn "Điểm kinh doanh").
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
            planned: [{ key: newKey('p'), name: U.typeLabel(s.type), std: avg, qty: qty }]
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
    if (!z.catMain) errs.push('Chưa chọn Ngành hàng chính.');
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
  function mbCan(mid) { return { edit: A.canDo('cau-truc.edit', mid), del: A.canDo('cau-truc.delete', mid), reset: A.canDo('cau-truc.reset', mid) }; }
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
    const blocks = blocksOf(mid), floors = floorsOfBlock(mid, z.blockId);
    const totalQty = U.sum(z.planned, p => Number(p.qty) || 0);
    const totalArea = U.sum(z.planned, p => (Number(p.std) || 0) * (Number(p.qty) || 0));
    const over = totalArea > Number(z.area || 0);
    return `<div class="drawer-h"><div><h3>Sửa khu</h3><div class="small muted" style="margin-top:2px">${z.status === 'nhap' ? '<span class="tag warn">Nháp</span>' : '<span class="tag ok">Chính thức</span>'}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
      <div class="form-grid">
        <div class="field"><label>Mã khu *</label><input class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="code" value="${U.esc(z.code || '')}"></div>
        <div class="field"><label>Tên khu *</label><input class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="name" value="${U.esc(z.name || '')}"></div>
        <div class="field"><label>Thuộc khối/nhà chợ</label><select class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="blockId">${blocks.map(b => `<option value="${b.key}" ${b.key === z.blockId ? 'selected' : ''}>${U.esc(b.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Tầng</label><select class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="floorId">${floors.map(f => `<option value="${f.key}" ${f.key === z.floorId ? 'selected' : ''}>${U.esc(f.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Ngành hàng chính *</label><select class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="catMain"><option value="">— Chọn ngành hàng —</option>${CATS.map(c => `<option ${c === z.catMain ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Ngành hàng phụ</label><input class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="catSub" value="${U.esc(z.catSub || '')}"></div>
        <div class="field"><label>Diện tích khu (m²) *</label><input class="input" ${dis} type="number" min="0" data-ch="qh-zone-field" data-zone="${z.key}" data-k="area" value="${z.area || 0}"></div>
      </div>
      <div class="field" style="margin-top:10px"><label>Ghi chú</label><textarea class="input" ${dis} rows="2" data-ch="qh-zone-field" data-zone="${z.key}" data-k="note">${U.esc(z.note || '')}</textarea></div>
      <div class="divider"></div>
      <div class="row"><h4 style="margin:0;font-size:var(--font-size-sm)">Quy hoạch loại điểm kinh doanh dự kiến</h4><span class="spacer"></span>${can.edit ? `<button class="btn sm primary" data-act="qh-pt-add" data-id="${z.key}">+ Thêm loại điểm</button>` : ''}</div>
      <div style="margin-top:8px">${U.table([{ t: 'Loại điểm' }, { t: 'DT chuẩn (m²)', num: true }, { t: 'Số lượng', num: true }, { t: 'Diện tích (m²)', num: true }, { t: '' }],
        z.planned.map(p => `<tr>
          <td><input class="input" ${dis} data-ch="qh-pt-field" data-zone="${z.key}" data-pt="${p.key}" data-k="name" value="${U.esc(p.name || '')}" placeholder="VD: Sạp nhỏ"></td>
          <td><input class="input num" style="width:90px" ${dis} type="number" min="0" data-ch="qh-pt-field" data-zone="${z.key}" data-pt="${p.key}" data-k="std" value="${p.std || 0}"></td>
          <td><input class="input num" style="width:80px" ${dis} type="number" min="0" data-ch="qh-pt-field" data-zone="${z.key}" data-pt="${p.key}" data-k="qty" value="${p.qty || 0}"></td>
          <td class="num">${((Number(p.std) || 0) * (Number(p.qty) || 0)).toLocaleString('vi-VN')}</td>
          <td>${can.del ? `<button class="btn sm danger" data-act="qh-pt-del" data-id="${z.key}|${p.key}">Xóa</button>` : ''}</td></tr>`), { empty: 'Chưa khai báo loại điểm nào' })}</div>
      <div class="row" style="padding:8px 2px;font-weight:600"><span>Tổng cộng</span><span class="spacer"></span><span>${totalQty.toLocaleString('vi-VN')} điểm dự kiến · ${totalArea.toLocaleString('vi-VN')} m²</span></div>
      ${over ? `<div class="note">Tổng diện tích điểm kinh doanh dự kiến (${totalArea.toLocaleString('vi-VN')} m²) vượt quá diện tích của khu (${Number(z.area || 0).toLocaleString('vi-VN')} m²).</div>` : ''}
      </div>
      <div class="drawer-f">${can.del ? `<button class="btn danger" data-act="qh-del-zone" data-id="${z.key}">Xóa khu</button>` : ''}<span class="spacer"></span>
        ${can.edit ? `<button class="btn" data-act="qh-save-draft" data-id="${z.key}">Lưu nháp</button><button class="btn primary" data-act="qh-save-final" data-id="${z.key}">Lưu và tiếp tục</button>` : '<button class="btn" data-act="close">Đóng</button>'}</div>`;
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
        ${mbActions([can.edit ? `<button class="mb-iconbtn" data-act="qh-zone-edit-open" data-id="${z.key}" title="Sửa khu">✎ Sửa</button>` : '', can.del ? `<button class="mb-iconbtn danger" data-act="qh-del-zone" data-id="${z.key}" title="Xóa khu">🗑 Xóa</button>` : ''])}
      </div>`).join('') : '<div class="empty small">Chưa có khu</div>'}</div>`;
  }
  function mbTreeHtml(mid) {
    const can = mbCan(mid), blocks = blocksOf(mid);
    const overviewBtn = `<button class="mb-node mb-overview ${!ui.mb.sel ? 'on' : ''}" data-act="mb-sel-overview">📊 Tổng quan</button>`;
    if (!blocks.length) return overviewBtn + `<div class="empty small">Chưa có khối/nhà chợ nào.${can.edit ? ' Bấm "+ Khối/Nhà chợ" ở trên để bắt đầu.' : ''}</div>`;
    // Chợ chỉ có đúng 1 khối + 1 tầng (vd. chợ quê TTĐ — xem defaultLayout()): gộp 2 cấp này lại
    // thành 1 hàng, tránh hiển thị 1 node "Tầng" trùng tên khối không mang giá trị (hotfix mục 14) —
    // suy ra từ CHÍNH cấu trúc dữ liệu, không hard-code theo market id. Hàng gộp chọn được, xem như
    // đang chọn "Tầng" duy nhất bên dưới (mbFlatMode()) — nội dung Khối/Tầng ở đây vốn giống hệt
    // nhau (chỉ 1 tầng trong khối) nên không cần phân biệt 2 điểm chọn.
    if (mbFlatMode(mid)) {
      const b = blocks[0], f = b.floors[0];
      const rowBtns = mbActions([
        can.edit ? `<button class="mb-iconbtn" data-act="qh-add-zone" data-block="${b.key}" data-floor="${f.key}" title="Thêm khu">+ Khu</button>` : '',
        can.edit ? `<button class="mb-iconbtn" data-act="qh-edit-block" data-id="${b.key}" title="Sửa">✎ Sửa</button>` : '',
        can.del ? `<button class="mb-iconbtn danger" data-act="qh-del-block" data-id="${b.key}" title="Xóa">🗑 Xóa</button>` : ''
      ]);
      return overviewBtn + `<div class="mb-node mb-block-h mb-flatlabel-row ${mbIsSelFloor(f.key) ? 'on' : ''}"><button class="mb-node-label mb-node-label-btn" data-act="mb-sel-floor" data-id="${f.key}">${U.esc(b.name)}</button><span class="spacer"></span>${rowBtns}</div>${mbZonesHtml(f, can)}`;
    }
    return overviewBtn + blocks.map(b => {
      const bKey = 'b:' + b.key, bOpen = !ui.mb.collapsed[bKey];
      const bBtns = mbActions([
        can.edit ? `<button class="mb-iconbtn" data-act="qh-add-floor" data-block="${b.key}" title="Thêm tầng">+ Tầng</button>` : '',
        can.edit ? `<button class="mb-iconbtn" data-act="qh-edit-block" data-id="${b.key}" title="Sửa">✎</button>` : '',
        can.del ? `<button class="mb-iconbtn danger" data-act="qh-del-block" data-id="${b.key}" title="Xóa">🗑</button>` : ''
      ]);
      return `<div class="mb-block">
        <div class="mb-node mb-block-h ${mbIsSelBlock(b.key) ? 'on' : ''}"><button class="mb-caret-btn" data-act="mb-toggle-node" data-key="${bKey}">${bOpen ? '▼' : '▶'}</button><button class="mb-node-label mb-node-label-btn" data-act="mb-sel-block" data-id="${b.key}">${U.esc(b.name)}</button><span class="spacer"></span>${bBtns}</div>
        ${bOpen ? (b.floors.length ? b.floors.map(f => {
          const fKey = 'f:' + f.key, fOpen = !ui.mb.collapsed[fKey];
          const fBtns = mbActions([
            can.edit ? `<button class="mb-iconbtn" data-act="qh-add-zone" data-block="${b.key}" data-floor="${f.key}" title="Thêm khu">+ Khu</button>` : '',
            can.edit ? `<button class="mb-iconbtn" data-act="qh-edit-floor" data-block="${b.key}" data-id="${f.key}" title="Sửa">✎</button>` : '',
            can.del ? `<button class="mb-iconbtn danger" data-act="qh-del-floor" data-block="${b.key}" data-id="${f.key}" title="Xóa">🗑</button>` : ''
          ]);
          return `<div class="mb-floor">
            <div class="mb-node mb-floor-h ${mbIsSelFloor(f.key) ? 'on' : ''}"><button class="mb-caret-btn" data-act="mb-toggle-node" data-key="${fKey}">${fOpen ? '▼' : '▶'}</button><button class="mb-node-label mb-node-label-btn" data-act="mb-sel-floor" data-id="${f.key}">${U.esc(f.name)}</button><span class="spacer"></span>${fBtns}</div>
            ${fOpen ? mbZonesHtml(f, can) : ''}
          </div>`;
        }).join('') : '<div class="empty small">Chưa có tầng</div>') : ''}
      </div>`;
    }).join('');
  }
  // Vùng nội dung bên phải: render đúng 1 trong 4 view theo cấp đang chọn (Tổng quan/Khối/Tầng/Khu),
  // luôn kèm breadcrumb derive từ LAYOUT hiện tại (mục 10). Node đã bị xóa (key không còn hợp lệ —
  // vd. vừa xóa khối/tầng/khu đang chọn, hoặc vừa đổi market/account) tự "heal" về Tổng quan, không
  // vỡ trang.
  function mbRightHtml(mid) {
    const can = mbCan(mid), sel = ui.mb.sel;
    if (sel && sel.k === 'zone') {
      const z = findZone(mid, sel.id);
      if (z) return mbCrumbHtml(mbCrumbsForZone(mid, z)) + A.mbZoneDiagramHtml(mid, z, can.edit);
      ui.mb.sel = null;
    } else if (sel && sel.k === 'floor') {
      const found = findFloorAny(mid, sel.id);
      if (found) return mbCrumbHtml(mbCrumbsForFloor(mid, found.block, found.floor)) + A.mbFloorHtml(mid, found.floor);
      ui.mb.sel = null;
    } else if (sel && sel.k === 'block') {
      const b = findBlock(mid, sel.id);
      if (b) return mbCrumbHtml(mbCrumbsForBlock(mid, b)) + A.mbBlockHtml(mid, b);
      ui.mb.sel = null;
    }
    return mbCrumbHtml([{ label: U.market(mid).name }]) + A.mbOverviewHtml(mid, blocksOf(mid));
  }

  // Workspace "Mặt bằng chợ" DUY NHẤT — #/mat-bang (screen permission 'mat-bang' DUY NHẤT) trỏ vào
  // hàm này (gán ở cuối file). Không còn banner hướng dẫn dài/KPI card lớn/card hành
  // động riêng/sơ đồ quy hoạch tách rời như bản cũ (hotfix mục 4) — chỉ 1 header gọn + 1 cây cấu
  // trúc (action inline) + 1 vùng nội dung bên phải (Tổng quan hoặc sơ đồ đúng 1 khu).
  function mbWorkspaceHtml() {
    const mid = qhMarket(), can = mbCan(mid), m = U.market(mid), open = !!ui.mb.treeOpen;
    const stalls = A.db.stalls.filter(st => st.market === mid);
    const c = k => stalls.filter(st => st.status === k).length;
    const summary = [[stalls.length + ' điểm KD', ''], [c('thue') + ' đang thuê', 'ok'], [c('trong') + ' còn trống', ''], [c('no') + ' nợ phí', 'danger'], [c('ngung') + ' tạm ngưng', 'warn'], [c('tranhchap') + ' tranh chấp', 'purple']]
      .map(p => `<b${p[1] ? ` style="color:var(--${p[1]})"` : ''}>${p[0]}</b>`).join('<span class="muted">·</span>');
    return `<div class="card"><div class="card-b" style="padding-top:14px">
        <h3 style="margin:0;font-size:var(--font-size-md)">Mặt bằng chợ</h3><div class="small muted" style="margin-top:2px">${U.esc(m.name)} · ${U.esc(m.hang)}</div>
      </div><div class="card-b" style="padding-top:0"><div class="row mb-summary">${summary}</div></div></div>
    <button class="btn sm mb-tree-toggle" data-act="mb-toggle-tree">${open ? '✕ Đóng cấu trúc' : '☰ Cấu trúc mặt bằng'}</button>
    <div class="mb-workspace">
      <div class="card mb-tree-card ${open ? 'open' : ''}"><div class="card-h" style="padding-bottom:6px">
          <h3>Cấu trúc</h3><span class="spacer"></span>
          ${can.edit ? `<button class="btn sm primary" data-act="qh-add-block">+ Khối/Nhà chợ</button>` : ''}
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
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      A.modal(A.mHead('Thêm khối / nhà chợ') + `<div class="modal-b"><div class="field"><label>Tên khối/nhà chợ *</label><input class="input" id="qhb-name" placeholder="VD: Nhà chợ chính"></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-add-block-save">Thêm</button></div>`);
    },
    'qh-add-block-save': () => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const name = A.$('#qhb-name').value.trim();
      if (!name) { U.toast('Vui lòng nhập tên khối/nhà chợ'); return; }
      LAYOUT[qhMarket()].blocks.push({ key: newKey('b'), name: name, floors: [] });
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã thêm khối/nhà chợ "' + name + '"');
    },
    'qh-edit-block': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const b = findBlock(qhMarket(), el.dataset.id);
      if (!b) return;
      A.modal(A.mHead('Sửa khối / nhà chợ') + `<div class="modal-b"><div class="field"><label>Tên khối/nhà chợ *</label><input class="input" id="qhb-name" value="${U.esc(b.name)}"></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-edit-block-save" data-id="${b.key}">Lưu</button></div>`);
    },
    'qh-edit-block-save': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const name = A.$('#qhb-name').value.trim();
      if (!name) { U.toast('Vui lòng nhập tên khối/nhà chợ'); return; }
      const b = findBlock(qhMarket(), el.dataset.id);
      if (b) b.name = name;
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã cập nhật');
    },
    'qh-del-block': el => {
      if (!A.canDo('cau-truc.delete', qhMarket())) return;
      const mid = qhMarket(), b = findBlock(mid, el.dataset.id);
      if (!b) return;
      const zoneCount = U.sum(b.floors, f => f.zones.length);
      if (zoneCount) { U.toast('Khối "' + b.name + '" đang có ' + zoneCount + ' khu, cần xóa hết các khu trước.'); return; }
      A.modal(A.mHead('Xóa khối / nhà chợ') + `<div class="modal-b">Xóa khối/nhà chợ <b>${U.esc(b.name)}</b> và toàn bộ tầng bên trong (chưa có khu nào)?</div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="qh-del-block-ok" data-id="${b.key}">Xóa</button></div>`);
    },
    'qh-del-block-ok': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.delete', mid)) return;
      const L = LAYOUT[mid];
      // Phòng thủ lại (business rule): không xoá khối còn khu bên trong, dù nút Xoá ở bước trước
      // đã tự chặn — đúng theo yêu cầu "preserve existing child/dependency checks" (mục 8).
      const b = L.blocks.find(x => x.key === el.dataset.id);
      if (b && U.sum(b.floors, f => f.zones.length)) { U.toast('Khối "' + b.name + '" đang có khu, cần xóa hết các khu trước.'); return; }
      L.blocks = L.blocks.filter(x => x.key !== el.dataset.id);
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã xóa khối/nhà chợ');
    },
    'qh-add-floor': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      A.modal(A.mHead('Thêm tầng') + `<div class="modal-b"><div class="field"><label>Tên tầng *</label><input class="input" id="qhf-name" placeholder="VD: Tầng 1"></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-add-floor-save" data-block="${el.dataset.block}">Thêm</button></div>`);
    },
    'qh-add-floor-save': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const name = A.$('#qhf-name').value.trim();
      if (!name) { U.toast('Vui lòng nhập tên tầng'); return; }
      const b = findBlock(qhMarket(), el.dataset.block);
      if (!b) return;
      b.floors.push({ key: newKey('f'), name: name, zones: [] });
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã thêm tầng "' + name + '"');
    },
    'qh-edit-floor': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const f = findFloor(qhMarket(), el.dataset.block, el.dataset.id);
      if (!f) return;
      A.modal(A.mHead('Sửa tầng') + `<div class="modal-b"><div class="field"><label>Tên tầng *</label><input class="input" id="qhf-name" value="${U.esc(f.name)}"></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-edit-floor-save" data-block="${el.dataset.block}" data-id="${f.key}">Lưu</button></div>`);
    },
    'qh-edit-floor-save': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const name = A.$('#qhf-name').value.trim();
      if (!name) { U.toast('Vui lòng nhập tên tầng'); return; }
      const f = findFloor(qhMarket(), el.dataset.block, el.dataset.id);
      if (f) f.name = name;
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã cập nhật');
    },
    'qh-del-floor': el => {
      if (!A.canDo('cau-truc.delete', qhMarket())) return;
      const f = findFloor(qhMarket(), el.dataset.block, el.dataset.id);
      if (!f) return;
      if (f.zones.length) { U.toast('Tầng "' + f.name + '" đang có ' + f.zones.length + ' khu, cần xóa hết các khu trước.'); return; }
      A.modal(A.mHead('Xóa tầng') + `<div class="modal-b">Xóa tầng <b>${U.esc(f.name)}</b> (chưa có khu nào)?</div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="qh-del-floor-ok" data-block="${el.dataset.block}" data-id="${f.key}">Xóa</button></div>`);
    },
    'qh-del-floor-ok': el => {
      if (!A.canDo('cau-truc.delete', qhMarket())) return;
      const b = findBlock(qhMarket(), el.dataset.block);
      const f = b && b.floors.find(x => x.key === el.dataset.id);
      if (f && f.zones.length) { U.toast('Tầng "' + f.name + '" đang có khu, cần xóa hết các khu trước.'); return; }
      if (b) b.floors = b.floors.filter(x => x.key !== el.dataset.id);
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã xóa tầng');
    },
    'qh-add-zone': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      A.modal(A.mHead('Thêm khu mới') + `<div class="modal-b"><div class="form-grid">
        <div class="field"><label>Mã khu *</label><input class="input" id="qhz-code" placeholder="VD: A"></div>
        <div class="field"><label>Tên khu *</label><input class="input" id="qhz-name" placeholder="VD: Thực phẩm tươi sống"></div></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-add-zone-save" data-block="${el.dataset.block}" data-floor="${el.dataset.floor}">Thêm</button></div>`);
    },
    'qh-add-zone-save': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const code = A.$('#qhz-code').value.trim(), name = A.$('#qhz-name').value.trim();
      if (!code || !name) { U.toast('Vui lòng nhập đủ mã khu và tên khu'); return; }
      if (codeTaken(qhMarket(), code, null)) { U.toast('Mã khu "' + code + '" đã tồn tại trong chợ này'); return; }
      const f = findFloor(qhMarket(), el.dataset.block, el.dataset.floor);
      if (!f) { U.toast('Không tìm thấy tầng để thêm khu'); return; }
      const z = { key: newKey('z'), code: code, name: name, blockId: el.dataset.block, floorId: el.dataset.floor, catMain: '', catSub: '', area: 0, note: '', status: 'nhap', planned: [] };
      f.zones.push(z);
      saveLayout(); A.render();
      // Mở luôn drawer sửa khu để khai báo tiếp ngành hàng/diện tích/loại điểm — thay cho việc
      // phải tự bấm chọn lại khu vừa tạo (hotfix mục 5: thêm mới → sửa ngay tại chỗ).
      qhOpenZoneDrawer(qhMarket(), z.key);
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
      saveLayout(); A.render(); qhSyncDrawer(); U.toast('Đã xóa loại điểm');
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
    if (!A.canDo('cau-truc.edit', qhMarket())) { A.render(); return; }
    const z = findZone(qhMarket(), el.dataset.zone);
    if (!z) return;
    const k = el.dataset.k;
    if (k === 'area') z.area = Math.max(0, Number(el.value) || 0);
    else if (k === 'blockId') { z.blockId = el.value; z.floorId = firstFloorKey(qhMarket(), el.value); }
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

  // Phase 7: #/mat-bang (screen permission 'mat-bang' DUY NHẤT) render workspace này — không còn
  // 2 registration 'so-do'/'cau-truc' riêng, không còn khái niệm "màn edit riêng" (xem ghi chú đầu
  // khối giao diện phía trên).
  A.VIEWS['mat-bang'] = mbWorkspaceHtml;
})(window.APP);
