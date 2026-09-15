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

  // ---------- giao diện ----------
  function treeHtml(mid) {
    const sel = ui.qh.selZone;
    const blocks = blocksOf(mid);
    const canEdit = A.canDo('cau-truc.edit', mid), canDelete = A.canDo('cau-truc.delete', mid);
    if (!blocks.length) return '<div class="empty">Chưa có khối/nhà chợ nào.' + (canEdit ? ' Bấm "+ Thêm khối/nhà chợ" để bắt đầu.' : '') + '</div>';
    return blocks.map(b => `<div class="qh-block">
      <div class="qh-row"><b>${U.esc(b.name)}</b><span class="spacer"></span>
        ${canEdit ? `<button class="btn sm" data-act="qh-add-floor" data-block="${b.key}">+ Tầng</button>
        <button class="btn sm" data-act="qh-edit-block" data-id="${b.key}">Sửa</button>` : ''}
        ${canDelete ? `<button class="btn sm danger" data-act="qh-del-block" data-id="${b.key}">Xóa</button>` : ''}</div>
      ${b.floors.length ? b.floors.map(f => `<div class="qh-floor">
        <div class="qh-row"><span>${U.esc(f.name)}</span><span class="spacer"></span>
          ${canEdit ? `<button class="btn sm" data-act="qh-add-zone" data-block="${b.key}" data-floor="${f.key}">+ Khu</button>
          <button class="btn sm" data-act="qh-edit-floor" data-block="${b.key}" data-id="${f.key}">Sửa</button>` : ''}
          ${canDelete ? `<button class="btn sm danger" data-act="qh-del-floor" data-block="${b.key}" data-id="${f.key}">Xóa</button>` : ''}</div>
        <div class="qh-zones">${f.zones.length ? f.zones.map(z => `<button class="qh-zone-chip ${sel === z.key ? 'on' : ''}" data-act="qh-sel-zone" data-id="${z.key}">${U.esc(z.name || '(chưa đặt tên)')} <span class="muted">${U.esc(z.code || '')}</span>${z.status === 'nhap' ? ' <span class="tag warn">Nháp</span>' : ''}</button>`).join('') : '<div class="empty small">Chưa có khu</div>'}</div>
      </div>`).join('') : '<div class="empty small">Chưa có tầng</div>'}
    </div>`).join('');
  }

  function detailHtml(mid) {
    const z = ui.qh.selZone ? findZone(mid, ui.qh.selZone) : null;
    if (!z) return '<div class="empty">Chọn một khu trên cây cấu trúc bên trái để khai báo thông tin, hoặc bấm "+ Khu" tại một tầng để tạo khu mới.</div>';
    const canEdit = A.canDo('cau-truc.edit', mid), canDelete = A.canDo('cau-truc.delete', mid);
    const dis = canEdit ? '' : 'disabled';
    const blocks = blocksOf(mid), floors = floorsOfBlock(mid, z.blockId);
    const totalQty = U.sum(z.planned, p => Number(p.qty) || 0);
    const totalArea = U.sum(z.planned, p => (Number(p.std) || 0) * (Number(p.qty) || 0));
    const over = totalArea > Number(z.area || 0);
    return `<div class="row"><h3 style="margin:0">${U.esc(z.name || '(Chưa đặt tên)')}</h3>${z.status === 'nhap' ? '<span class="tag warn">Nháp</span>' : '<span class="tag ok">Chính thức</span>'}</div>
      <div class="form-grid" style="margin-top:10px">
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
      <div class="row"><h4 style="margin:0;font-size:14px">Quy hoạch loại điểm kinh doanh dự kiến</h4><span class="spacer"></span>${canEdit ? `<button class="btn sm primary" data-act="qh-pt-add" data-id="${z.key}">+ Thêm loại điểm</button>` : ''}</div>
      <div style="margin-top:8px">${U.table([{ t: 'Loại điểm' }, { t: 'DT chuẩn (m²)', num: true }, { t: 'Số lượng', num: true }, { t: 'Diện tích (m²)', num: true }, { t: '' }],
        z.planned.map(p => `<tr>
          <td><input class="input" ${dis} data-ch="qh-pt-field" data-zone="${z.key}" data-pt="${p.key}" data-k="name" value="${U.esc(p.name || '')}" placeholder="VD: Sạp nhỏ"></td>
          <td><input class="input num" style="width:90px" ${dis} type="number" min="0" data-ch="qh-pt-field" data-zone="${z.key}" data-pt="${p.key}" data-k="std" value="${p.std || 0}"></td>
          <td><input class="input num" style="width:80px" ${dis} type="number" min="0" data-ch="qh-pt-field" data-zone="${z.key}" data-pt="${p.key}" data-k="qty" value="${p.qty || 0}"></td>
          <td class="num">${((Number(p.std) || 0) * (Number(p.qty) || 0)).toLocaleString('vi-VN')}</td>
          <td>${canDelete ? `<button class="btn sm danger" data-act="qh-pt-del" data-id="${z.key}|${p.key}">Xóa</button>` : ''}</td></tr>`), { empty: 'Chưa khai báo loại điểm nào' })}</div>
      <div class="row" style="padding:8px 2px;font-weight:600"><span>Tổng cộng</span><span class="spacer"></span><span>${totalQty.toLocaleString('vi-VN')} điểm dự kiến · ${totalArea.toLocaleString('vi-VN')} m²</span></div>
      ${over ? `<div class="note">Tổng diện tích điểm kinh doanh dự kiến (${totalArea.toLocaleString('vi-VN')} m²) vượt quá diện tích của khu (${Number(z.area || 0).toLocaleString('vi-VN')} m²).</div>` : ''}
      <div class="row" style="margin-top:14px">
        ${canEdit ? `<button class="btn" data-act="qh-save-draft" data-id="${z.key}">Lưu nháp</button>
        <button class="btn primary" data-act="qh-save-final" data-id="${z.key}">Lưu và tiếp tục</button>` : ''}
        <span class="spacer"></span>
        ${canDelete ? `<button class="btn danger" data-act="qh-del-zone" data-id="${z.key}">Xóa khu</button>` : ''}
      </div>`;
  }

  function visualHtml(mid) {
    const blocks = blocksOf(mid);
    if (!blocks.length) return '<div class="empty">Chưa có cấu trúc để hiển thị.</div>';
    return blocks.map(b => `<div class="plan-section"><h4>${U.esc(b.name)}</h4>
      ${b.floors.map(f => `<div style="margin:8px 0 2px">
        <div class="small muted" style="margin-bottom:6px">${U.esc(f.name)}</div>
        <div class="qh-visual">${f.zones.length ? f.zones.map(z => `<div class="qh-visual-zone ${z.status === 'nhap' ? 'draft' : ''}" style="flex-grow:${Math.max(1, Math.min(8, Math.round((z.area || 0) / 40)))}" data-act="qh-sel-zone" data-id="${z.key}">
          <b>${U.esc(z.name || '(chưa đặt tên)')}</b><div class="small muted">${U.esc(z.code || '—')} · ${Number(z.area || 0).toLocaleString('vi-VN')} m²</div>
          <div class="small">${U.sum(z.planned, p => Number(p.qty) || 0).toLocaleString('vi-VN')} điểm dự kiến</div></div>`).join('') : '<div class="empty small">Chưa có khu</div>'}</div>
      </div>`).join('')}</div>`).join('');
  }

  A.VIEWS['cau-truc'] = function () {
    const mid = qhMarket(), m = U.market(mid), s = marketLayoutStats(mid);
    const canEdit = A.canDo('cau-truc.edit', mid), canReset = A.canDo('cau-truc.reset', mid);
    const k = (l, v, sub) => `<div class="card kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div>${sub ? `<div class="k-sub">${sub}</div>` : ''}</div>`;
    return `
    <div class="note info">Thiết lập khung cấu trúc <b>Khối/Nhà chợ → Tầng → Khu</b> và khai báo ngành hàng, diện tích, loại và số lượng điểm kinh doanh dự kiến cho từng khu. Việc khai báo từng điểm kinh doanh cụ thể (VD: A01, A02…) thực hiện tại màn <b>Điểm kinh doanh</b>.</div>
    <div class="card"><div class="card-b row" style="padding-top:14px">
      ${ui.market === 'ALL' ? `<div class="seg">${['CL', 'TTD'].map(id => `<button class="${mid === id ? 'on' : ''}" data-act="qh-market" data-id="${id}">${U.mShort(id)}</button>`).join('')}</div>` : ''}
      <span class="small muted">${U.esc(m.name)} · ${U.esc(m.hang)}</span>
      <span class="spacer"></span>
      ${canReset ? `<button class="btn" data-act="qh-reset">↺ Khôi phục cấu trúc mặc định</button>` : ''}
      ${canEdit ? `<button class="btn primary" data-act="qh-add-block">+ Thêm khối/nhà chợ</button>` : ''}</div></div>
    <div class="kpis">
      ${k('Khối / nhà chợ', s.blocks)}
      ${k('Tầng', s.floors)}
      ${k('Khu', s.zones, s.draft ? s.draft + ' khu đang ở dạng nháp' : 'Đã khai báo đầy đủ')}
      ${k('Điểm kinh doanh dự kiến', s.pts.toLocaleString('vi-VN'))}
      ${k('Diện tích quy hoạch', s.area.toLocaleString('vi-VN') + ' m²')}
    </div>
    <div class="grid g-main" style="align-items:start">
      <div class="card"><div class="card-h"><h3>Cây cấu trúc mặt bằng</h3></div><div class="card-b">${treeHtml(mid)}</div></div>
      <div class="card detail" style="position:sticky;top:70px"><div class="card-b" style="padding-top:16px">${detailHtml(mid)}</div></div>
    </div>
    <div class="card"><div class="card-h"><h3>Sơ đồ mặt bằng trực quan (quy hoạch)</h3><span class="small muted">Kích thước khu minh họa theo diện tích khai báo · khung nét đứt = khu đang nháp</span></div>
      <div class="card-b">${visualHtml(mid)}</div></div>`;
  };

  Object.assign(A.ACT, {
    'qh-market': el => { ui.qh.market = el.dataset.id; ui.qh.selZone = null; A.render(); },
    'qh-sel-zone': el => { ui.qh.selZone = el.dataset.id; A.render(); },
    'qh-reset': () => {
      if (!A.canDo('cau-truc.reset', qhMarket())) return;
      A.modal(A.mHead('Khôi phục cấu trúc mặc định') + `<div class="modal-b">Toàn bộ cấu trúc khối/tầng/khu và quy hoạch điểm đã khai báo cho <b>${U.esc(U.market(qhMarket()).name)}</b> sẽ bị xóa và khôi phục về cấu trúc mẫu ban đầu.</div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="qh-reset-ok">Khôi phục</button></div>`);
    },
    'qh-reset-ok': () => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.reset', mid)) return;
      LAYOUT[mid] = defaultLayout()[mid];
      ui.qh.selZone = null;
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
      ui.qh.selZone = z.key;
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã thêm khu ' + code + '. Vui lòng khai báo thêm thông tin chi tiết.');
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
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã xóa khu');
    },
    'qh-pt-add': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const z = findZone(qhMarket(), el.dataset.id);
      if (!z) return;
      z.planned.push({ key: newKey('p'), name: '', std: 0, qty: 0 });
      saveLayout(); A.render();
    },
    'qh-pt-del': el => {
      if (!A.canDo('cau-truc.delete', qhMarket())) return;
      const parts = el.dataset.id.split('|'), zk = parts[0], pk = parts[1];
      const z = findZone(qhMarket(), zk);
      if (!z) return;
      z.planned = z.planned.filter(p => p.key !== pk);
      saveLayout(); A.render(); U.toast('Đã xóa loại điểm');
    },
    'qh-save-draft': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const z = findZone(qhMarket(), el.dataset.id);
      if (!z) return;
      z.status = 'nhap';
      saveLayout(); A.render(); U.toast('Đã lưu nháp khu ' + (z.code || z.name));
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
      saveLayout(); A.render();
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
    saveLayout(); A.render();
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
    saveLayout(); A.render();
  };
})(window.APP);
