/* Màn hình: Điểm kinh doanh, Tiểu thương, Hợp đồng. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const f = ui.f;

  // ---------- Điểm kinh doanh ----------
  // Chợ Cao Lãnh (selectedMarket = CL): màn danh mục điểm kinh doanh riêng theo yêu cầu
  // BUSINESS_POINT_CL_SCREEN_REFACTOR (xem BUSINESS_POINT_CL_SCREEN_REFACTOR_REPORT.md) — bảng +
  // filter + drawer xem nhanh CHUYÊN BIỆT, không lẫn dữ liệu tài chính/hợp đồng chi tiết. Dùng state
  // filter RIÊNG (f.dkcl*, ui.page.dkcl) — KHÔNG chia sẻ với f.dk*/ui.page.dk bên dưới (dkRows/
  // dkLine/dkView cũ) để tránh lẫn định dạng giá trị filter giữa 2 luồng.
  // Chợ quê TTĐ (hoặc market khác 'CL'): GIỮ NGUYÊN bảng tổng quát cũ — ngoài phạm vi task này.
  function dkSeller(s) {
    if (s.sellerId) return A.idx.trader.get(s.sellerId);
    return s.traderId ? A.idx.trader.get(s.traderId) : null;
  }
  function dkPointTypeLabel(s) {
    return s.pointType && D.POINT_TYPE[s.pointType] ? D.POINT_TYPE[s.pointType].label : 'Chưa có thông tin';
  }
  function dkSearchMatchCL(s, q) {
    if (s.code.toLowerCase().includes(q)) return true;
    const t = s.traderId ? A.idx.trader.get(s.traderId) : null;
    if (t && t.name.toLowerCase().includes(q)) return true;
    const seller = dkSeller(s);
    return !!(seller && seller.name.toLowerCase().includes(q));
  }
  // "Xóa bộ lọc": true nếu ít nhất 1 trong 4 filter khác mặc định — quyết định enable/disable nút,
  // dùng lại ĐÚNG 4 state key filter hiện có (không thêm state song song).
  function dkclHasFilter() {
    return !!(f.dkclSection || f.dkclType || f.dkclStatus || (f.dkclSearch && f.dkclSearch.trim()));
  }
  // Filter kết hợp được (mục 8 yêu cầu): 1 lần lọc duy nhất theo khu vực + loại điểm + trạng thái,
  // rồi search áp dụng lên ĐÚNG tập kết quả đó (không reset lẫn nhau).
  function dkRowsCL() {
    const q = (f.dkclSearch || '').trim().toLowerCase();
    return A.db.stalls.filter(s => U.inM(s)
      && (!f.dkclSection || s.section === f.dkclSection)
      && (!f.dkclType || s.pointType === f.dkclType)
      && (!f.dkclStatus || s.status === f.dkclStatus)
      && (!q || dkSearchMatchCL(s, q)));
  }
  function dkRowHtmlCL(s) {
    const t = s.traderId ? A.idx.trader.get(s.traderId) : null;
    const seller = dkSeller(s);
    return `<tr class="click" data-act="dk-open" data-id="${s.id}">
      <td><b>${s.code}</b></td>
      <td title="${U.esc(s.sectionName)}">${U.esc(s.sectionName)}</td>
      <td>${U.esc(dkPointTypeLabel(s))}</td>
      <td class="num">${s.area.toLocaleString('vi-VN')}</td>
      <td title="${U.esc(s.cat)}">${U.esc(s.cat)}</td>
      <td title="${t ? U.esc(t.name) : ''}">${t ? U.esc(t.name) : '<span class="muted">–</span>'}</td>
      <td title="${seller ? U.esc(seller.name) : ''}">${seller ? U.esc(seller.name) : '<span class="muted">–</span>'}</td>
      <td>${U.statusTag(s.status)}</td>
      <td class="nowrap"><button class="btn sm" data-act="dk-open" data-id="${s.id}">Xem</button></td>
    </tr>`;
  }
  function dkViewCL() {
    const rows = dkRowsCL(), pg = U.pager('dkcl', rows.length, 25);
    const m = U.market('CL');
    const sections = [];
    m.floors.forEach(fl => fl.sections.forEach(s => sections.push([s.id, s.name])));
    return `<div class="card"><div class="card-h"><h3>Danh mục điểm kinh doanh</h3>
      <select class="input" data-ch="dkcl-section"><option value="">Tất cả khu vực</option>${sections.map(s => `<option value="${s[0]}" ${f.dkclSection === s[0] ? 'selected' : ''}>${U.esc(s[1])}</option>`).join('')}</select>
      <select class="input" data-ch="dkcl-type"><option value="">Tất cả loại điểm</option>${Object.keys(D.POINT_TYPE).map(k => `<option value="${k}" ${f.dkclType === k ? 'selected' : ''}>${D.POINT_TYPE[k].label}</option>`).join('')}</select>
      <select class="input" data-ch="dkcl-status"><option value="">Mọi trạng thái</option>${Object.keys(D.STATUS).map(k => `<option value="${k}" ${f.dkclStatus === k ? 'selected' : ''}>${D.STATUS[k].label}</option>`).join('')}</select>
      <input class="input" placeholder="Mã điểm / người thuê / người bán" data-in="dkcl-search" value="${U.esc(f.dkclSearch || '')}">
      <button class="btn" data-act="dkcl-clear" ${dkclHasFilter() ? '' : 'disabled'}>↺ Xóa bộ lọc</button>
      <button class="btn" data-act="dkcl-csv">⬇ Xuất Excel</button></div>
      <div class="card-b">${U.table([{ t: 'Mã điểm' }, { t: 'Khu vực' }, { t: 'Loại điểm' }, { t: 'DT (m²)', num: true }, { t: 'Ngành hàng' }, { t: 'Người thuê' }, { t: 'Người bán thực tế' }, { t: 'Trạng thái' }, { t: 'Thao tác' }],
        rows.slice(pg.start, pg.end).map(dkRowHtmlCL))}${pg.html}</div></div>`;
  }
  A.CH['dkcl-section'] = el => { f.dkclSection = el.value; ui.page.dkcl = 0; A.render(); };
  A.CH['dkcl-type'] = el => { f.dkclType = el.value; ui.page.dkcl = 0; A.render(); };
  A.CH['dkcl-status'] = el => { f.dkclStatus = el.value; ui.page.dkcl = 0; A.render(); };
  A.IN['dkcl-search'] = el => { f.dkclSearch = el.value; ui.page.dkcl = 0; A.render(); };
  // "Xóa bộ lọc": reset ĐÚNG 4 state filter hiện có về mặc định + page về 1, rồi render lại qua
  // pipeline dkRowsCL()/dkViewCL() có sẵn — không phải nghiệp vụ, không đổi dữ liệu/account/market/
  // permission, nên không cần A.canDo(...) (screen:diem-kd là điều kiện truy cập màn duy nhất).
  A.ACT['dkcl-clear'] = () => {
    f.dkclSection = ''; f.dkclType = ''; f.dkclStatus = ''; f.dkclSearch = '';
    ui.page.dkcl = 0;
    A.render();
  };
  A.ACT['dkcl-csv'] = () => U.csv('diem-kinh-doanh-cho-cao-lanh', ['Mã điểm', 'Khu vực', 'Loại điểm', 'Diện tích m2', 'Ngành hàng', 'Người thuê', 'Người bán thực tế', 'Trạng thái'],
    dkRowsCL().map(s => {
      const t = s.traderId ? A.idx.trader.get(s.traderId) : null, seller = dkSeller(s);
      return [s.code, s.sectionName, dkPointTypeLabel(s), s.area, s.cat, t ? t.name : '', seller ? seller.name : '', D.STATUS[s.status].label];
    }));
  // Drawer chi tiết CL — bố cục theo BUSINESS_POINT_CL_DETAIL_DRAWER_REFACTOR (xem
  // BUSINESS_POINT_CL_DETAIL_DRAWER_REFACTOR_REPORT.md): action đặt NGAY tại khối thông tin mà nó
  // tác động, KHÔNG gom xuống footer — không còn `drawer-f`. Người thuê ≠ Người bán thực tế tiếp tục
  // tái dùng ĐÚNG dkSeller()/pointType/sellerId đã có (mục 11 yêu cầu — không đổi model).
  //   - "Chỉnh sửa thông tin"/"Tách điểm"/"Gộp điểm"/"Chuyển đổi điểm": đây là 4 action MỚI, hệ
  //     thống hiện tại CHƯA có permission/handler riêng cho nhóm nghiệp vụ này — tái dùng NGUYÊN
  //     action permission 'cau-truc.edit' đã có (cùng phạm vi "sửa cấu trúc/đặc tính mặt bằng" mà
  //     v-cautruc.js đang dùng cho khối/tầng/khu/loại điểm quy hoạch), KHÔNG tạo permission key mới,
  //     không đổi CATALOG/PERM_SEED_VERSION/RBAC_SCHEMA. "Tách điểm"/"Gộp điểm" CHỈ ghi 1 dòng lịch
  //     sử minh hoạ (không tách/gộp thật A.db.stalls — tránh phá quan hệ trader/contract/invoice
  //     đang khoá theo stallId) — xem NEED_CONFIRMATION trong report. "Chỉnh sửa thông tin" (ngành
  //     hàng/diện tích) và "Chuyển đổi điểm" (pointType — field THUẦN HIỂN THỊ, không ảnh hưởng tính
  //     giá) là mutation THẬT vì an toàn/độc lập với các module khác.
  //   - "Xem hồ sơ tiểu thương": ĐỔI TÊN từ "Hồ sơ", tái dùng NGUYÊN action permission
  //     'so-do.xem-ho-so' + handler `trader` có sẵn (mở modal hồ sơ tại chỗ, không tạo màn mới).
  //   - BỎ hẳn "Đổi trạng thái"/"Tạo hợp đồng" khỏi drawer này (mục 8 yêu cầu — không tạo UI cho
  //     phép tự chọn trạng thái tuỳ ý, đặc biệt "Nợ phí"; xem NEED_CONFIRMATION về Tạo hợp đồng).
  function dkHistoryHtml(st) {
    if (!st.history || !st.history.length) return '<div class="small muted">Chưa có lịch sử thay đổi.</div>';
    return st.history.map(h => {
      const i = h.indexOf(': ');
      const date = i === -1 ? '' : h.slice(0, i), desc = i === -1 ? h : h.slice(i + 2);
      return `<div style="padding:6px 0;border-bottom:1px solid #eef2f7">${date ? `<div class="small muted">${U.esc(date)}</div>` : ''}<div>${U.esc(desc)}</div></div>`;
    }).join('');
  }
  function dkDetailHtmlCL(st) {
    const m = U.market('CL');
    const floorName = (m.floors.find(fl => fl.id === st.floor) || {}).name || '';
    const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
    const seller = dkSeller(st);
    const sameSellerRenter = !!(t && seller && seller.id === t.id);
    const c = st.contractId ? A.idx.contract.get(st.contractId) : null;
    const canEdit = A.canDo('cau-truc.edit', st.market);
    const canXemHoSo = A.canDo('so-do.xem-ho-so', st.market);
    const left = c ? U.days(U.today(), c.end) : null;
    return `<div class="drawer-h" style="flex-wrap:wrap"><div><h3>${st.code}</h3><div class="small muted" style="margin-top:2px">${U.statusTag(st.status)}</div></div><span class="spacer"></span>
        ${canEdit ? `<button class="btn sm" data-act="dkcl-edit-open" data-id="${st.id}">Chỉnh sửa thông tin</button>` : ''}
        <button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <div class="small muted" style="margin:-4px 0 12px">Thông tin điểm kinh doanh</div>
        <dl class="kv">
          <dt>Mã điểm</dt><dd>${st.code}</dd>
          <dt>Chợ</dt><dd>${U.esc(m.name)}</dd>
          <dt>Vị trí</dt><dd>${U.esc(floorName)} → ${U.esc(st.sectionName)}</dd>
          <dt>Loại điểm</dt><dd>${U.esc(dkPointTypeLabel(st))}</dd>
          <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd>
          <dt>Ngành hàng</dt><dd>${U.esc(st.cat) || 'Chưa có thông tin'}</dd>
          <dt>Đơn giá áp dụng</dt><dd>${U.unitLabel(st)}</dd>
        </dl>
        ${canEdit ? `<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn sm" data-act="dkcl-split-open" data-id="${st.id}">Tách điểm</button>
          <button class="btn sm" data-act="dkcl-merge-open" data-id="${st.id}">Gộp điểm</button>
          <button class="btn sm" data-act="dkcl-convert-open" data-id="${st.id}">Chuyển đổi điểm</button>
        </div>` : ''}
        <div class="divider"></div>
        <div class="row"><b style="font-size:var(--font-size-sm)">Tình trạng sử dụng</b><span class="spacer"></span>${t && canXemHoSo ? `<button class="btn sm" data-act="trader" data-id="${t.id}">Xem hồ sơ tiểu thương</button>` : ''}</div>
        <dl class="kv" style="margin-top:6px">
          <dt>Trạng thái</dt><dd>${U.statusTag(st.status)}</dd>
          <dt>Người thuê</dt><dd>${t ? `${U.esc(t.name)} · ${t.id}` : 'Chưa có'}</dd>
          <dt>Người bán thực tế</dt><dd>${!t ? 'Chưa ghi nhận' : !seller ? 'Chưa ghi nhận' : sameSellerRenter ? `${U.esc(seller.name)} <span class="small muted">(người thuê trực tiếp kinh doanh)</span>` : U.esc(seller.name)}</dd>
          <dt>Hợp đồng hiện hành</dt><dd>${c ? c.id : 'Chưa có hợp đồng hiệu lực'}</dd>
          ${c ? `<dt>Thời hạn</dt><dd>${U.dmy(c.start)} – ${U.dmy(c.end)} <span class="small muted">(${left <= 30 ? `<b style="color:#df2225">còn ${left} ngày</b>` : 'còn ' + left + ' ngày'})</span></dd>` : ''}
        </dl>
        <div class="divider"></div>
        <div class="row"><b style="font-size:var(--font-size-sm)">Lịch sử thay đổi</b></div>
        <div style="margin-top:6px">${dkHistoryHtml(st)}</div>
      </div>`;
  }
  // ---- Chỉnh sửa thông tin (ngành hàng, diện tích) — mutation thật, an toàn/độc lập, ghi lịch sử ----
  A.ACT['dkcl-edit-open'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !A.canDo('cau-truc.edit', st.market)) return;
    A.modal(A.mHead('Chỉnh sửa thông tin ' + st.code) + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Ngành hàng *</label><input class="input" id="dke-cat" value="${U.esc(st.cat || '')}"></div>
      <div class="field"><label>Diện tích (m²) *</label><input class="input" type="number" min="0" step="0.1" id="dke-area" value="${st.area}"></div></div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="dkcl-edit-save" data-id="${st.id}">Lưu</button></div>`);
  };
  A.ACT['dkcl-edit-save'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !A.canDo('cau-truc.edit', st.market)) return;
    const cat = A.$('#dke-cat').value.trim(), area = Number(A.$('#dke-area').value);
    if (!cat || !(area > 0)) { U.toast('Vui lòng nhập đủ ngành hàng và diện tích hợp lệ'); return; }
    const changes = [];
    if (cat !== st.cat) changes.push(`ngành hàng "${st.cat}" → "${cat}"`);
    if (area !== st.area) changes.push(`diện tích ${st.area} m² → ${area} m²`);
    st.cat = cat; st.area = area;
    if (changes.length) { st.history = st.history || []; st.history.unshift(`${U.dmy(U.today())}: Cập nhật thông tin điểm (${changes.join(', ')})`); }
    A.save(); A.closeModal();
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${dkDetailHtmlCL(st)}</div>`;
    A.render(); U.toast('Đã cập nhật thông tin ' + st.code);
  };
  // ---- Chuyển đổi điểm (đổi pointType — field thuần hiển thị, KHÔNG ảnh hưởng đơn giá) ----
  A.ACT['dkcl-convert-open'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !A.canDo('cau-truc.edit', st.market)) return;
    const opts = Object.keys(D.POINT_TYPE).filter(k => k !== st.pointType);
    A.modal(A.mHead('Chuyển đổi điểm ' + st.code) + `<div class="modal-b">
      <p class="muted" style="margin-top:0">Loại điểm hiện tại: <b>${U.esc(dkPointTypeLabel(st))}</b></p>
      <div class="field"><label>Chuyển sang loại điểm</label><select class="input" id="dkv-type">${opts.map(k => `<option value="${k}">${D.POINT_TYPE[k].label}</option>`).join('')}</select></div>
      <div class="note" style="margin-top:10px">Chỉ đổi phân loại hiển thị của điểm, không ảnh hưởng đơn giá dịch vụ đang áp dụng.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="dkcl-convert-save" data-id="${st.id}">Chuyển đổi</button></div>`);
  };
  A.ACT['dkcl-convert-save'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !A.canDo('cau-truc.edit', st.market)) return;
    const to = A.$('#dkv-type').value, fromLabel = dkPointTypeLabel(st), toLabel = D.POINT_TYPE[to] ? D.POINT_TYPE[to].label : to;
    st.pointType = to;
    st.history = st.history || []; st.history.unshift(`${U.dmy(U.today())}: Chuyển đổi loại điểm: ${fromLabel} → ${toLabel}`);
    A.save(); A.closeModal();
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${dkDetailHtmlCL(st)}</div>`;
    A.render(); U.toast('Đã chuyển đổi ' + st.code + ' sang ' + toLabel);
  };
  // ---- Tách điểm / Gộp điểm — PROTOTYPE INTERACTION (mục 4/15 yêu cầu): hệ thống hiện tại chưa có
  // nghiệp vụ thực thi đầy đủ (tạo/xoá điểm kèm phân bổ lại trader/hợp đồng/hoá đơn theo stallId) —
  // KHÔNG tự thiết kế database phức tạp/backend giả. Chỉ ghi 1 dòng lịch sử minh hoạ ý định thao
  // tác, KHÔNG restructure A.db.stalls thật. Xem NEED_CONFIRMATION trong report.
  A.ACT['dkcl-split-open'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !A.canDo('cau-truc.edit', st.market)) return;
    const half = +(st.area / 2).toFixed(1);
    A.modal(A.mHead('Tách điểm ' + st.code) + `<div class="modal-b">
      <p class="muted" style="margin-top:0">Từ điểm <b>${st.code}</b> (${st.area} m²) tạo thành 2 điểm mới.</p>
      <div class="form-grid">
        <div class="field"><label>Mã điểm mới 1</label><input class="input" id="dks-code1" value="${st.code}A"></div>
        <div class="field"><label>Diện tích (m²)</label><input class="input" type="number" min="0" step="0.1" id="dks-area1" value="${half}"></div>
        <div class="field"><label>Mã điểm mới 2</label><input class="input" id="dks-code2" value="${st.code}B"></div>
        <div class="field"><label>Diện tích (m²)</label><input class="input" type="number" min="0" step="0.1" id="dks-area2" value="${half}"></div>
      </div>
      <div class="note" style="margin-top:10px">Prototype: thao tác này chỉ ghi nhận minh hoạ vào lịch sử thay đổi của ${st.code}, CHƯA tạo điểm kinh doanh mới trong dữ liệu chính thức (cần nghiệp vụ phân bổ lại tiểu thương/hợp đồng/hoá đơn chưa có trong hệ thống).</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="dkcl-split-save" data-id="${st.id}">Ghi nhận</button></div>`);
  };
  A.ACT['dkcl-split-save'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !A.canDo('cau-truc.edit', st.market)) return;
    const c1 = A.$('#dks-code1').value.trim(), a1 = A.$('#dks-area1').value;
    const c2 = A.$('#dks-code2').value.trim(), a2 = A.$('#dks-area2').value;
    if (!c1 || !c2) { U.toast('Vui lòng nhập đủ mã điểm mới'); return; }
    st.history = st.history || [];
    st.history.unshift(`${U.dmy(U.today())}: Yêu cầu tách điểm ${st.code} thành ${c1} (${a1} m²) + ${c2} (${a2} m²) — ghi nhận minh hoạ, chưa áp dụng vào dữ liệu chính thức`);
    A.save(); A.closeModal();
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${dkDetailHtmlCL(st)}</div>`;
    A.render(); U.toast('Đã ghi nhận yêu cầu tách điểm ' + st.code + ' (minh hoạ prototype)');
  };
  A.ACT['dkcl-merge-open'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !A.canDo('cau-truc.edit', st.market)) return;
    const candidates = A.db.stalls.filter(s => s.market === st.market && s.section === st.section && s.id !== st.id && s.status === 'trong');
    A.modal(A.mHead('Gộp điểm ' + st.code) + `<div class="modal-b">
      <p class="muted" style="margin-top:0">Gộp <b>${st.code}</b> với 1 điểm còn trống khác trong cùng khu vực (${U.esc(st.sectionName)}) thành 1 điểm lớn hơn.</p>
      ${candidates.length
        ? `<div class="field"><label>Gộp với điểm</label><select class="input" id="dkm-with">${candidates.map(s => `<option value="${s.id}">${s.code} (${s.area} m²)</option>`).join('')}</select></div>
           <div class="note" style="margin-top:10px">Prototype: thao tác này chỉ ghi nhận minh hoạ vào lịch sử thay đổi, CHƯA gộp thật 2 điểm trong dữ liệu chính thức.</div>`
        : '<div class="note">Không có điểm còn trống nào khác trong cùng khu vực để gộp.</div>'}
      </div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button>${candidates.length ? `<button class="btn primary" data-act="dkcl-merge-save" data-id="${st.id}">Ghi nhận</button>` : ''}</div>`);
  };
  A.ACT['dkcl-merge-save'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !A.canDo('cau-truc.edit', st.market)) return;
    const withId = A.$('#dkm-with').value, other = A.idx.stall.get(withId);
    if (!other) return;
    st.history = st.history || [];
    st.history.unshift(`${U.dmy(U.today())}: Yêu cầu gộp điểm ${st.code} với ${other.code} — ghi nhận minh hoạ, chưa áp dụng vào dữ liệu chính thức`);
    A.save(); A.closeModal();
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${dkDetailHtmlCL(st)}</div>`;
    A.render(); U.toast('Đã ghi nhận yêu cầu gộp điểm ' + st.code + ' (minh hoạ prototype)');
  };

  // ---- Chợ quê TTĐ / fallback: bảng tổng quát cũ, KHÔNG đổi (ngoài phạm vi task CL) ----
  function dkRows() {
    const q = (f.dkSearch || '').toLowerCase();
    return A.db.stalls.filter(s => U.inM(s)
      && (!f.dkSection || s.market + ':' + s.section === f.dkSection)
      && (!f.dkStatus || s.status === f.dkStatus)
      && (!q || s.code.toLowerCase().includes(q) || (s.traderId && A.idx.trader.get(s.traderId).name.toLowerCase().includes(q))));
  }
  function dkLine(s) {
    const t = s.traderId ? A.idx.trader.get(s.traderId) : null, c = s.contractId ? A.idx.contract.get(s.contractId) : null;
    return [s.code, U.mShort(s.market), s.sectionName, s.cat, U.typeLabel(s.type), s.area, U.unitLabel(s), c && c.monthly ? c.monthly : '', t ? t.name : '', D.STATUS[s.status].label];
  }
  function dkViewGeneric() {
    const rows = dkRows(), pg = U.pager('dk', rows.length, 25);
    const sections = [];
    D.MARKETS.filter(m => ui.market === 'ALL' || m.id === ui.market).forEach(m => m.floors.forEach(fl => fl.sections.forEach(s => sections.push([m.id + ':' + s.id, (ui.market === 'ALL' ? m.short + ' · ' : '') + s.name]))));
    return `<div class="card"><div class="card-h"><h3>Danh mục điểm kinh doanh</h3>
      <select class="input" data-ch="dk-section"><option value="">Tất cả khu vực</option>${sections.map(s => `<option value="${s[0]}" ${f.dkSection === s[0] ? 'selected' : ''}>${U.esc(s[1])}</option>`).join('')}</select>
      <select class="input" data-ch="dk-status"><option value="">Mọi trạng thái</option>${Object.keys(D.STATUS).map(k => `<option value="${k}" ${f.dkStatus === k ? 'selected' : ''}>${D.STATUS[k].label}</option>`).join('')}</select>
      <input class="input" placeholder="Mã điểm / tiểu thương" data-in="dk-search" value="${U.esc(f.dkSearch || '')}">
      <button class="btn" data-act="dk-csv">⬇ Xuất Excel</button></div>
      <div class="card-b">${U.table([{ t: 'Mã điểm' }, { t: 'Chợ' }, { t: 'Khu vực' }, { t: 'Loại' }, { t: 'DT (m²)', num: true }, { t: 'Đơn giá' }, { t: 'Giá/tháng', num: true }, { t: 'Tiểu thương' }, { t: 'Trạng thái' }],
        rows.slice(pg.start, pg.end).map(s => {
          const l = dkLine(s);
          return `<tr class="click" data-act="dk-open" data-id="${s.id}"><td><b>${l[0]}</b></td><td>${l[1]}</td><td>${U.esc(l[2])}</td><td>${l[4]}</td><td class="num">${l[5].toLocaleString('vi-VN')}</td><td class="nowrap">${l[6]}</td><td class="num">${l[7] ? U.money(l[7]) : '–'}</td><td>${U.esc(l[8]) || '<span class="muted">–</span>'}</td><td>${U.statusTag(s.status)}</td></tr>`;
        }))}${pg.html}
        <div class="small muted" style="margin-top:8px">Hỗ trợ tách, gộp, chuyển đổi điểm kinh doanh kèm lưu vết lịch sử (thao tác tại màn hình Sơ đồ mặt bằng).</div></div></div>`;
  }
  A.CH['dk-section'] = el => { f.dkSection = el.value; ui.page.dk = 0; A.render(); };
  A.CH['dk-status'] = el => { f.dkStatus = el.value; ui.page.dk = 0; A.render(); };
  A.IN['dk-search'] = el => { f.dkSearch = el.value; ui.page.dk = 0; A.render(); };
  A.ACT['dk-csv'] = () => U.csv('diem-kinh-doanh', ['Mã điểm', 'Chợ', 'Khu vực', 'Ngành hàng', 'Loại', 'Diện tích m2', 'Đơn giá', 'Giá dịch vụ/tháng', 'Tiểu thương', 'Trạng thái'], dkRows().map(dkLine));

  A.VIEWS['diem-kd'] = () => ui.market === 'CL' ? dkViewCL() : dkViewGeneric();
  A.ACT['dk-open'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (st.market === 'CL') A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${dkDetailHtmlCL(st)}</div>`;
    else A.modal(A.mHead('Điểm kinh doanh') + `<div class="modal-b detail">${A.stallPanel(st)}</div>`);
  };

  // ---------- Tiểu thương ----------
  // Chợ Cao Lãnh (selectedMarket = CL): màn hồ sơ tiểu thương riêng theo yêu cầu
  // TIEU_THUONG_CL_SCREEN_REFACTOR (xem TIEU_THUONG_CL_SCREEN_REFACTOR_REPORT.md). Quan hệ lọc theo
  // Khu vực/Ngành hàng đi qua ĐÚNG chuỗi TIỂU THƯƠNG → HỢP ĐỒNG/QUAN HỆ THUÊ (t.stalls) → ĐIỂM KINH
  // DOANH (A.idx.stall) → KHU VỰC (st.section)/NGÀNH HÀNG (st.cat) — KHÔNG thêm field "khu vực" vào
  // trader, không duplicate dữ liệu. State filter RIÊNG (f.ttcl*, ui.page.ttcl) — tách biệt hoàn
  // toàn với f.tt*/ui.page.tt bên dưới (ttRows/ttViewGeneric, dùng cho TTD/market khác — KHÔNG đổi).
  function ttSectionsOf(t) {
    return t.stalls.map(id => A.idx.stall.get(id)).filter(Boolean).map(st => st.section);
  }
  function ttCatsOf(t) {
    const stalls = t.stalls.map(id => A.idx.stall.get(id)).filter(Boolean);
    return stalls.length ? Array.from(new Set(stalls.map(st => st.cat))) : [t.cat || 'Chưa gán'];
  }
  function ttclHasFilter() {
    return !!(f.ttclSection || f.ttclCat || f.ttclApp || (f.ttclSearch && f.ttclSearch.trim()));
  }
  // Search KHÔNG tra theo CCCD (mục 5 yêu cầu) — chỉ tên/SĐT/mã tiểu thương/mã điểm KD đang thuê.
  function ttSearchMatchCL(t, q) {
    if (t.name.toLowerCase().includes(q)) return true;
    if (t.phone.includes(q)) return true;
    if (t.id.toLowerCase().includes(q)) return true;
    return t.stalls.some(id => { const st = A.idx.stall.get(id); return st && st.code.toLowerCase().includes(q); });
  }
  // Lọc kết hợp được (giống pattern đã dùng ở Điểm kinh doanh CL): 1 tiểu thương = 1 dòng, chỉ cần
  // MỘT trong các điểm đang thuê thỏa khu vực/ngành hàng đang lọc là đủ để tiểu thương đó xuất hiện —
  // không flatten theo điểm nên không thể duplicate dòng.
  function ttRowsCL() {
    const q = (f.ttclSearch || '').trim().toLowerCase();
    return A.db.traders.filter(t => U.inM(t)
      && (!f.ttclSection || ttSectionsOf(t).includes(f.ttclSection))
      && (!f.ttclCat || ttCatsOf(t).includes(f.ttclCat))
      && (!f.ttclApp || (f.ttclApp === 'yes') === !!t.app)
      && (!q || ttSearchMatchCL(t, q)));
  }
  function ttRowHtmlCL(t) {
    const debt = U.traderDebt(t.id), over = U.traderOverdue(t.id);
    return `<tr class="click" data-act="trader" data-id="${t.id}">
      <td>${t.id}</td><td><b>${U.esc(t.name)}</b></td><td>${U.maskPhone(t.phone)}</td>
      <td title="${U.esc(t.address)}">${U.esc(t.address)}</td>
      <td>${U.esc(ttCatsOf(t).join(', '))}</td>
      <td>${t.stalls.map(id => A.idx.stall.get(id).code).join(', ') || '–'}</td>
      <td>${t.app ? '<span class="tag ok">Đã cài</span>' : '<span class="tag">Chưa</span>'}</td>
      <td class="num" style="${over ? 'color:#df2225;font-weight:600' : ''}">${debt ? U.money(debt) : '–'}</td>
      <td class="nowrap"><button class="btn sm" data-act="trader" data-id="${t.id}">Xem</button></td></tr>`;
  }
  function ttViewCL() {
    const rows = ttRowsCL(), pg = U.pager('ttcl', rows.length, 25);
    const m = U.market('CL');
    const sections = [], cats = [];
    m.floors.forEach(fl => fl.sections.forEach(s => { sections.push([s.id, s.name]); if (!cats.includes(s.cat)) cats.push(s.cat); }));
    return `<div class="card"><div class="card-h"><h3>Hồ sơ tiểu thương</h3>
      <select class="input" data-ch="ttcl-section"><option value="">Tất cả khu vực</option>${sections.map(s => `<option value="${s[0]}" ${f.ttclSection === s[0] ? 'selected' : ''}>${U.esc(s[1])}</option>`).join('')}</select>
      <select class="input" data-ch="ttcl-cat"><option value="">Tất cả ngành hàng</option>${cats.map(c => `<option ${f.ttclCat === c ? 'selected' : ''}>${U.esc(c)}</option>`).join('')}</select>
      <select class="input" data-ch="ttcl-app"><option value="">Mini app: tất cả</option><option value="yes" ${f.ttclApp === 'yes' ? 'selected' : ''}>Đã cài mini app</option><option value="no" ${f.ttclApp === 'no' ? 'selected' : ''}>Chưa cài</option></select>
      <input class="input" placeholder="Tên, SĐT, mã điểm KD" data-in="ttcl-search" value="${U.esc(f.ttclSearch || '')}">
      <button class="btn" data-act="ttcl-clear" ${ttclHasFilter() ? '' : 'disabled'}>↺ Xóa bộ lọc</button>
      ${A.canDo('tieu-thuong.them-moi', ui.market) ? '<button class="btn primary" data-act="tt-new">+ Thêm tiểu thương</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Mã' }, { t: 'Họ tên' }, { t: 'Điện thoại' }, { t: 'Địa chỉ' }, { t: 'Ngành hàng' }, { t: 'Điểm KD' }, { t: 'Mini app' }, { t: 'Công nợ', num: true }, { t: 'Thao tác' }],
        rows.slice(pg.start, pg.end).map(ttRowHtmlCL))}${pg.html}
        <div class="small muted" style="margin-top:8px">Số điện thoại, số giấy tờ được che trên danh sách theo Nghị định 356/2025/NĐ-CP về bảo vệ dữ liệu cá nhân.</div></div></div>`;
  }
  A.CH['ttcl-section'] = el => { f.ttclSection = el.value; ui.page.ttcl = 0; A.render(); };
  A.CH['ttcl-cat'] = el => { f.ttclCat = el.value; ui.page.ttcl = 0; A.render(); };
  A.CH['ttcl-app'] = el => { f.ttclApp = el.value; ui.page.ttcl = 0; A.render(); };
  A.IN['ttcl-search'] = el => { f.ttclSearch = el.value; ui.page.ttcl = 0; A.render(); };
  // "Xóa bộ lọc": reset đúng 4 state filter hiện có, KHÔNG đổi dữ liệu nghiệp vụ.
  A.ACT['ttcl-clear'] = () => {
    f.ttclSection = ''; f.ttclCat = ''; f.ttclApp = ''; f.ttclSearch = '';
    ui.page.ttcl = 0;
    A.render();
  };

  // ---- Chợ quê TTĐ / fallback: danh sách tổng quát cũ, KHÔNG đổi (ngoài phạm vi task CL) ----
  function ttRows() {
    const q = (f.ttSearch || '').toLowerCase();
    return A.db.traders.filter(t => U.inM(t)
      && (!f.ttApp || (f.ttApp === 'yes') === !!t.app)
      && (!q || t.name.toLowerCase().includes(q) || t.phone.includes(q) || t.id.toLowerCase().includes(q) || t.stalls.some(id => A.idx.stall.get(id).code.toLowerCase().includes(q))));
  }
  function ttViewGeneric() {
    const rows = ttRows(), pg = U.pager('tt', rows.length, 25);
    return `<div class="card"><div class="card-h"><h3>${ui.role === 'lanhdao' ? 'Tra cứu tiểu thương' : 'Hồ sơ tiểu thương'}</h3>
      <select class="input" data-ch="tt-app"><option value="">Mini app: tất cả</option><option value="yes" ${f.ttApp === 'yes' ? 'selected' : ''}>Đã cài mini app</option><option value="no" ${f.ttApp === 'no' ? 'selected' : ''}>Chưa cài</option></select>
      <input class="input" placeholder="Tên, SĐT, mã điểm KD" data-in="tt-search" value="${U.esc(f.ttSearch || '')}">
      ${A.canDo('tieu-thuong.them-moi', ui.market) ? '<button class="btn primary" data-act="tt-new">+ Thêm tiểu thương</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Mã' }, { t: 'Họ tên' }, { t: 'Điện thoại' }, { t: 'Chợ' }, { t: 'Ngành hàng' }, { t: 'Điểm KD' }, { t: 'Mini app' }, { t: 'Công nợ', num: true }],
        rows.slice(pg.start, pg.end).map(t => {
          const debt = U.traderDebt(t.id), over = U.traderOverdue(t.id);
          return `<tr class="click" data-act="trader" data-id="${t.id}"><td>${t.id}</td><td><b>${U.esc(t.name)}</b></td><td>${U.maskPhone(t.phone)}</td><td>${U.mShort(t.market)}</td><td>${U.esc(t.cat)}</td>
            <td>${t.stalls.map(id => A.idx.stall.get(id).code).join(', ') || '–'}</td><td>${t.app ? '<span class="tag ok">Đã cài</span>' : '<span class="tag">Chưa</span>'}</td>
            <td class="num" style="${over ? 'color:#df2225;font-weight:600' : ''}">${debt ? U.money(debt) : '–'}</td></tr>`;
        }))}${pg.html}
        <div class="small muted" style="margin-top:8px">Số điện thoại, số giấy tờ được che trên danh sách theo Nghị định 356/2025/NĐ-CP về bảo vệ dữ liệu cá nhân.</div></div></div>`;
  }
  A.VIEWS['tieu-thuong'] = () => ui.market === 'CL' ? ttViewCL() : ttViewGeneric();
  A.CH['tt-app'] = el => { f.ttApp = el.value; ui.page.tt = 0; A.render(); };
  A.IN['tt-search'] = el => { f.ttSearch = el.value; ui.page.tt = 0; A.render(); };

  // ---- Drawer hồ sơ tiểu thương — Chợ Cao Lãnh (bố cục A-E theo yêu cầu, xem báo cáo) ----
  // TTĐ/market khác: GIỮ NGUYÊN modal cũ (nhánh else trong A.ACT.trader bên dưới), không đổi 1 dòng.
  function ttDocRow(label, has) {
    return `<div class="row" style="padding:7px 0;border-bottom:1px solid #eef2f7"><span style="flex:1">${label}</span>
      ${has ? '<span class="tag ok">Đã có</span>' : '<span class="tag">Chưa có</span>'}
      ${has ? `<button class="btn sm" style="margin-left:8px" data-act="tt-doc-view" data-label="${U.esc(label)}">Xem</button>` : ''}</div>`;
  }
  function ttPointCardHtml(t, stallId) {
    const st = A.idx.stall.get(stallId);
    if (!st) return '';
    const c = st.contractId ? A.idx.contract.get(st.contractId) : null;
    // Không suy đoán "giống người thuê" khi sellerId rỗng — nhất quán với quy ước đã chốt ở drawer
    // Mặt bằng chợ (mbStallSeller): null hiển thị đúng nghĩa "chưa ghi nhận", không tự bịa dữ liệu.
    const seller = st.sellerId ? A.idx.trader.get(st.sellerId) : null;
    const sellerLabel = !seller ? 'Chưa ghi nhận'
      : seller.id === t.id ? `${U.esc(seller.name)} <span class="small muted">(người thuê trực tiếp kinh doanh)</span>` : U.esc(seller.name);
    return `<div class="plan-section">
      <h4>${st.code}<span>${U.esc(st.sectionName)} · ${U.esc(st.cat)}</span></h4>
      <dl class="kv">
        <dt>Hợp đồng hiện hành</dt><dd>${c ? `<a href="#" data-act="tt-open-contract" data-id="${c.id}">${c.id}</a>` : 'Chưa có hợp đồng hiệu lực'}</dd>
        ${c ? `<dt>Thời hạn</dt><dd>${U.dmy(c.start)} – ${U.dmy(c.end)}</dd>` : ''}
        <dt>Người trực tiếp kinh doanh</dt><dd>${sellerLabel}</dd>
      </dl></div>`;
  }
  function ttOtherSellersOf(t) {
    const map = new Map();
    t.stalls.forEach(id => {
      const st = A.idx.stall.get(id);
      if (st && st.sellerId && st.sellerId !== t.id) {
        const seller = A.idx.trader.get(st.sellerId);
        if (seller) map.set(seller.id, seller);
      }
    });
    return Array.from(map.values());
  }
  function ttDrawerHtmlCL(t) {
    const canEdit = A.canDo('tieu-thuong.them-moi', t.market);
    const canCongNo = U.can('cong-no');
    const debt = U.traderDebt(t.id);
    const unpaidCount = A.db.invoices.filter(i => i.traderId === t.id && i.status !== 'paid').length;
    const others = ttOtherSellersOf(t);
    return `<div class="drawer-h" style="flex-wrap:wrap"><div><h3>${U.esc(t.name)}</h3><div class="small muted" style="margin-top:2px">${t.id}</div></div><span class="spacer"></span>
        ${canEdit ? `<button class="btn sm" data-act="tt-edit-open" data-id="${t.id}">Chỉnh sửa thông tin tiểu thương</button>` : ''}
        <button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <div class="small muted" style="margin:-4px 0 12px">A. Thông tin cá nhân / hộ kinh doanh</div>
        <dl class="kv">
          <dt>Mã tiểu thương</dt><dd>${t.id}</dd>
          <dt>Họ tên</dt><dd>${U.esc(t.name)}</dd>
          <dt>Giới tính</dt><dd>${U.esc(t.gender)}</dd>
          <dt>Năm sinh</dt><dd>${U.esc(String(t.birth || ''))}</dd>
          <dt>Điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd>
          <dt>CCCD</dt><dd>${U.maskId(t.idNo)}</dd>
          <dt>Địa chỉ</dt><dd>${U.esc(t.address)}</dd>
          <dt>Hình thức hộ kinh doanh</dt><dd>${t.hkd ? 'Có giấy CN ĐKKD' : 'Cá nhân kinh doanh'}</dd>
          <dt>Kinh doanh từ</dt><dd>${U.dmy(t.since)}</dd>
          <dt>Mini app</dt><dd>${t.app ? '<span class="tag ok">Đã cài</span>' : '<span class="tag">Chưa cài</span>'}</dd>
        </dl>
        <div class="divider"></div>
        <div class="small muted" style="margin-bottom:4px">B. Hồ sơ số hóa</div>
        ${ttDocRow('CCCD 2 mặt', true)}
        ${ttDocRow('Giấy chứng nhận đăng ký kinh doanh', t.hkd)}
        <div class="divider"></div>
        <div class="small muted" style="margin-bottom:8px">C. Điểm kinh doanh & hợp đồng</div>
        <div class="plan">${t.stalls.length ? t.stalls.map(id => ttPointCardHtml(t, id)).join('') : '<div class="empty small">Chưa có điểm kinh doanh nào.</div>'}</div>
        <div class="divider"></div>
        <div class="small muted" style="margin-bottom:8px">D. Người trực tiếp kinh doanh</div>
        ${others.length ? others.map(s => `<dl class="kv" style="margin-bottom:8px">
            <dt>Họ tên</dt><dd>${U.esc(s.name)}</dd>
            <dt>Điện thoại</dt><dd>${U.maskPhone(s.phone)}</dd>
            <dt>CCCD</dt><dd>${U.maskId(s.idNo)}</dd>
          </dl>`).join('<div class="divider"></div>')
          : '<div class="small muted">Người thuê trực tiếp kinh doanh tại tất cả các điểm hiện có.</div>'}
        <div class="divider"></div>
        <div class="small muted" style="margin-bottom:8px">E. Tóm tắt nghiệp vụ tài chính</div>
        <dl class="kv">
          <dt>Công nợ hiện tại</dt><dd>${debt ? `<b style="color:#df2225">${U.money(debt)}</b>` : '<span class="tag ok">Không nợ</span>'}</dd>
          <dt>Số khoản chưa thanh toán</dt><dd>${unpaidCount}</dd>
        </dl>
        ${canCongNo ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="tt-open-congno">Xem công nợ</button></div>` : ''}
      </div>`;
  }
  A.ACT['tt-doc-view'] = el => {
    A.modal(A.mHead('Xem tài liệu') + `<div class="modal-b"><p>${U.esc(el.dataset.label)}</p>
      <div class="note info">Bản scan minh họa cho prototype — hệ thống chưa có kho lưu trữ tài liệu thật.</div></div>
      <div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`);
  };
  // Điều hướng "Xem" hợp đồng → màn Hợp đồng, tái dùng ĐÚNG state search/tab sẵn có của màn đó
  // (f.hdSearch/ui.contractTab) — không sửa 1 dòng nào trong A.VIEWS['hop-dong'].
  A.ACT['tt-open-contract'] = (el, e) => {
    if (e) e.preventDefault();
    const c = A.idx.contract.get(el.dataset.id);
    if (!c) return;
    ui.contractTab = c.status === 'hieuluc' ? 'all' : 'end';
    f.hdSearch = c.id;
    ui.page['hd' + ui.contractTab] = 0;
    A.go('hop-dong');
  };
  // Điều hướng "Xem công nợ" → màn Công nợ & nhắc nợ (screen-level, màn đó không có ô tìm theo tên
  // nên không thể tự động lọc đúng 1 tiểu thương — không sửa màn tài chính để thêm cơ chế đó).
  A.ACT['tt-open-congno'] = () => { if (U.can('cong-no')) A.go('cong-no'); };

  A.ACT.trader = (el, e) => {
    if (e) e.preventDefault();
    const t = A.idx.trader.get(el.dataset.id);
    if (t.market === 'CL') {
      A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${ttDrawerHtmlCL(t)}</div>`;
      A.render();
      return;
    }
    const invs = A.db.invoices.filter(i => i.traderId === t.id).sort((a, b) => b.period.localeCompare(a.period)).slice(0, 8);
    const cts = A.db.contracts.filter(c => c.traderId === t.id);
    const pays = A.db.payments.filter(p => p.traderId === t.id).slice(-6).reverse();
    A.modal(A.mHead(U.esc(t.name) + ' · ' + t.id) + `<div class="modal-b"><div class="grid g2">
      <dl class="kv"><dt>Giới tính / năm sinh</dt><dd>${t.gender} · ${t.birth}</dd><dt>Điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd>
        <dt>CCCD</dt><dd>${U.maskId(t.idNo)}</dd><dt>Địa chỉ</dt><dd>${U.esc(t.address)}</dd>
        <dt>Hộ kinh doanh</dt><dd>${t.hkd ? 'Có giấy CN ĐKKD' : 'Cá nhân kinh doanh'}</dd></dl>
      <dl class="kv"><dt>Chợ</dt><dd>${U.mShort(t.market)}</dd><dt>Ngành hàng</dt><dd>${U.esc(t.cat)}</dd><dt>Kinh doanh từ</dt><dd>${U.dmy(t.since)}</dd>
        <dt>Mini app</dt><dd>${t.app ? '<span class="tag ok">Đã cài</span>' : '<span class="tag">Chưa cài</span>'}</dd>
        <dt>Giấy tờ số hóa</dt><dd><span class="tag info">CCCD 2 mặt</span> ${t.hkd ? '<span class="tag info">Giấy CN ĐKKD</span>' : ''}</dd></dl></div>
      <div class="divider"></div><b>Điểm kinh doanh & hợp đồng</b>
      ${U.table([{ t: 'Số hợp đồng' }, { t: 'Điểm KD' }, { t: 'Thời hạn' }, { t: 'Giá/tháng', num: true }, { t: 'Trạng thái' }], cts.map(c => `<tr><td>${c.id}</td><td>${A.idx.stall.get(c.stallId).code}</td><td>${U.dmy(c.start)} – ${U.dmy(c.end)}</td><td class="num">${c.monthly ? U.money(c.monthly) : 'Theo phiên'}</td><td>${c.status === 'hieuluc' ? '<span class="tag ok">Hiệu lực</span>' : '<span class="tag">Đã thanh lý</span>'}</td></tr>`))}
      <div class="divider"></div><b>Khoản phải thu gần đây</b>
      ${U.table([{ t: 'Mã' }, { t: 'Kỳ' }, { t: 'Số tiền', num: true }, { t: 'Đã thu', num: true }, { t: 'Trạng thái' }], invs.map(i => `<tr><td>${i.id}</td><td>${U.per(i.period)}</td><td class="num">${U.money(i.amount)}</td><td class="num">${U.money(i.paid)}</td><td>${U.invTag(i)}</td></tr>`))}
      ${pays.length ? `<div class="divider"></div><b>Biên lai gần đây</b>${U.table([{ t: 'Biên lai' }, { t: 'Ngày' }, { t: 'Hình thức' }, { t: 'Số tiền', num: true }], pays.map(p => `<tr class="click" data-act="receipt" data-id="${p.receipt}"><td>${p.receipt}</td><td>${U.dmy(p.date)}</td><td>${D.METHOD[p.method]}</td><td class="num">${U.money(p.amount)}</td></tr>`))}` : ''}
      </div><div class="modal-f">${A.canDo('thu-tien.thu', t.market) && U.traderDebt(t.id) ? `<button class="btn primary" data-act="pay-open" data-id="${t.id}">💳 Thu tiền</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`, true);
  };

  const OCR_SAMPLE = { name: 'Nguyễn Thị Mỹ Duyên', idNo: '087196012345', birth: '1988', gender: 'Nữ', address: 'Khóm 3, phường Cao Lãnh' };
  // editId: khi có giá trị → form "Chỉnh sửa thông tin tiểu thương" (ẩn OCR + ẩn chọn Chợ, không đổi
  // market của hồ sơ đang sửa), khi rỗng → GIỮ NGUYÊN hành vi form "Thêm tiểu thương" cũ (mọi tham số
  // gọi ttForm()/ttForm(OCR_SAMPLE,true) hiện có đều không đổi output).
  function ttForm(v, ocr, editId) {
    v = v || {};
    const isEdit = !!editId;
    return A.mHead(isEdit ? 'Chỉnh sửa thông tin tiểu thương' : 'Thêm tiểu thương') + `<div class="modal-b">
      ${isEdit ? '' : `<div class="row" style="margin-bottom:12px"><button class="btn" data-act="tt-ocr">📷 Quét CCCD (OCR giả lập)</button><span class="small muted">Chụp ảnh CCCD, hệ thống tự điền thông tin</span></div>`}
      ${ocr ? '<div class="note" style="margin-bottom:12px">OCR chỉ gợi ý – cán bộ kiểm tra, xác nhận trước khi lưu. Hệ thống kiểm tra trùng theo số giấy tờ.</div>' : ''}
      <div class="form-grid">
        <div class="field"><label>Họ và tên *</label><input class="input" id="nt-name" value="${U.esc(v.name || '')}"></div>
        <div class="field"><label>Số CCCD *</label><input class="input" id="nt-id" value="${U.esc(v.idNo || '')}"></div>
        <div class="field"><label>Năm sinh</label><input class="input" id="nt-birth" value="${U.esc(v.birth || '')}"></div>
        <div class="field"><label>Điện thoại *</label><input class="input" id="nt-phone" value="${U.esc(v.phone || '')}" placeholder="09xxxxxxxx"></div>
        <div class="field"><label>Địa chỉ</label><input class="input" id="nt-addr" value="${U.esc(v.address || '')}"></div>
        ${isEdit ? '' : `<div class="field"><label>Chợ</label><select class="input" id="nt-market">${D.MARKETS.map(m => `<option value="${m.id}">${m.short}</option>`).join('')}</select></div>`}
      </div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="${isEdit ? 'tt-edit-save' : 'tt-save'}" ${isEdit ? `data-id="${editId}"` : ''}>${isEdit ? 'Lưu' : 'Lưu hồ sơ'}</button></div>`;
  }
  A.ACT['tt-new'] = () => { if (A.canDo('tieu-thuong.them-moi', ui.market)) A.modal(ttForm()); };
  A.ACT['tt-ocr'] = () => { if (!A.canDo('tieu-thuong.them-moi', ui.market)) return; A.modal(ttForm(OCR_SAMPLE, true)); U.toast('Đã nhận dạng CCCD (giả lập) – vui lòng kiểm tra lại'); };
  A.ACT['tt-save'] = () => {
    if (!A.canDo('tieu-thuong.them-moi', ui.market)) return;
    const name = A.$('#nt-name').value.trim(), idNo = A.$('#nt-id').value.trim(), phone = A.$('#nt-phone').value.trim();
    if (!name || !idNo || !phone) { U.toast('Vui lòng nhập đủ họ tên, số CCCD và điện thoại'); return; }
    if (A.db.traders.some(t => t.idNo === idNo)) { U.toast('Số CCCD đã tồn tại trong hệ thống'); return; }
    const mk = A.$('#nt-market').value;
    const t = { id: 'TT' + U.pad(A.db.traders.length + 1, 4), name, gender: 'Nữ', phone, idNo, birth: A.$('#nt-birth').value || '', address: A.$('#nt-addr').value, market: mk, cat: 'Chưa gán', hkd: false, since: U.today(), app: false, bank: false, stalls: [] };
    A.db.traders.push(t); A.idx.trader.set(t.id, t);
    U.log('Thêm hồ sơ tiểu thương ' + t.id + ' – ' + name);
    A.save(); A.closeModal(); A.render(); U.toast('Đã lưu hồ sơ ' + t.id + '. Có thể tạo hợp đồng tại màn hình Hợp đồng.');
  };
  // "Chỉnh sửa thông tin tiểu thương" (mục 9 yêu cầu, CL) — reuse ĐÚNG action permission
  // 'tieu-thuong.them-moi' đã có (cùng phạm vi "quản lý hồ sơ tiểu thương"), không tạo permission
  // key mới. targetMarket lấy từ chính record t.market, không dựa ui.market.
  A.ACT['tt-edit-open'] = el => {
    const t = A.idx.trader.get(el.dataset.id);
    if (!t || !A.canDo('tieu-thuong.them-moi', t.market)) return;
    A.modal(ttForm(t, false, t.id));
  };
  A.ACT['tt-edit-save'] = el => {
    const t = A.idx.trader.get(el.dataset.id);
    if (!t || !A.canDo('tieu-thuong.them-moi', t.market)) return;
    const name = A.$('#nt-name').value.trim(), idNo = A.$('#nt-id').value.trim(), phone = A.$('#nt-phone').value.trim();
    if (!name || !idNo || !phone) { U.toast('Vui lòng nhập đủ họ tên, số CCCD và điện thoại'); return; }
    if (A.db.traders.some(x => x.idNo === idNo && x.id !== t.id)) { U.toast('Số CCCD đã tồn tại trong hệ thống'); return; }
    t.name = name; t.idNo = idNo; t.phone = phone; t.birth = A.$('#nt-birth').value || ''; t.address = A.$('#nt-addr').value;
    U.log('Cập nhật hồ sơ tiểu thương ' + t.id + ' – ' + name);
    A.save(); A.closeModal();
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${ttDrawerHtmlCL(t)}</div>`;
    A.render(); U.toast('Đã cập nhật hồ sơ ' + t.id);
  };

  // ---------- Hợp đồng ----------
  A.VIEWS['hop-dong'] = function () {
    const q = (f.hdSearch || '').toLowerCase(), tab = ui.contractTab;
    const canNew = A.canDo('so-do.tao-hop-dong', ui.market) || A.canDo('hop-dong.tao', ui.market);
    const canExtend = A.canDo('hop-dong.gia-han', ui.market);
    const canEnd = A.canDo('hop-dong.thanh-ly', ui.market);
    const rows = A.db.contracts.filter(c => U.inM(c)
      && (tab === 'all' ? c.status === 'hieuluc' : tab === 'exp' ? c.status === 'hieuluc' && U.days(U.today(), c.end) <= 30 : c.status === 'thanhly')
      && (!q || c.id.toLowerCase().includes(q) || A.idx.trader.get(c.traderId).name.toLowerCase().includes(q) || A.idx.stall.get(c.stallId).code.toLowerCase().includes(q)))
      .sort((a, b) => tab === 'exp' ? a.end.localeCompare(b.end) : 0);
    const pg = U.pager('hd' + tab, rows.length, 25);
    const n = k => A.db.contracts.filter(c => U.inM(c) && (k === 'all' ? c.status === 'hieuluc' : k === 'exp' ? c.status === 'hieuluc' && U.days(U.today(), c.end) <= 30 : c.status === 'thanhly')).length;
    return `<div class="card"><div class="card-h">
      <div class="seg">${[['all', 'Đang hiệu lực'], ['exp', 'Sắp hết hạn ≤ 30 ngày'], ['end', 'Đã thanh lý']].map(x => `<button class="${tab === x[0] ? 'on' : ''}" data-act="hd-tab" data-id="${x[0]}">${x[1]} (${n(x[0])})</button>`).join('')}</div>
      <span class="spacer"></span><input class="input" placeholder="Số HĐ, tiểu thương, mã điểm" data-in="hd-search" value="${U.esc(f.hdSearch || '')}">
      ${canNew ? '<button class="btn primary" data-act="ct-new">+ Tạo hợp đồng</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Số hợp đồng' }, { t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Loại' }, { t: 'Thời hạn' }, { t: 'Còn lại', num: true }, { t: 'Giá/tháng', num: true }, { t: 'Bản số hóa' }, { t: '' }],
        rows.slice(pg.start, pg.end).map(c => {
          const left = U.days(U.today(), c.end);
          return `<tr><td>${c.id}</td><td><a href="#" data-act="trader" data-id="${c.traderId}">${U.esc(A.idx.trader.get(c.traderId).name)}</a></td><td>${A.idx.stall.get(c.stallId).code}</td><td class="small">${c.kind}</td>
            <td class="nowrap">${U.dmy(c.start)} – ${U.dmy(c.end)}</td><td class="num">${c.status === 'hieuluc' ? (left <= 30 ? `<span class="tag danger">${left} ngày</span>` : left + ' ngày') : '–'}</td>
            <td class="num">${c.monthly ? U.money(c.monthly) : 'Theo phiên'}</td><td>${c.scanned ? '<span class="tag info">PDF</span>' : '<span class="tag warn">Chưa scan</span>'}</td>
            <td class="nowrap">${c.status === 'hieuluc' ? `${canExtend ? `<button class="btn sm" data-act="ct-extend" data-id="${c.id}">Gia hạn</button>` : ''} ${canEnd ? `<button class="btn sm danger" data-act="ct-end" data-id="${c.id}">Thanh lý</button>` : ''}` : ''}</td></tr>`;
        }))}${pg.html}
        <div class="small muted" style="margin-top:8px">Hệ thống tự cảnh báo và gửi thông báo cho tiểu thương khi hợp đồng sắp hết hạn.</div></div></div>`;
  };
  A.ACT['hd-tab'] = el => { ui.contractTab = el.dataset.id; A.render(); };
  A.IN['hd-search'] = el => { f.hdSearch = el.value; ui.page['hd' + ui.contractTab] = 0; A.render(); };
  A.ACT['ct-extend'] = el => {
    const c = A.idx.contract.get(el.dataset.id);
    if (!A.canDo('hop-dong.gia-han', c.market)) return;
    A.modal(A.mHead('Gia hạn ' + c.id) + `<div class="modal-b"><p>Hợp đồng hiện hết hạn ngày <b>${U.dmy(c.end)}</b>.</p>
      <div class="field"><label>Gia hạn thêm</label><select class="input" id="ext-m"><option value="12">12 tháng</option><option value="24">24 tháng</option><option value="36" selected>36 tháng</option></select></div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="ct-extend-save" data-id="${c.id}">Gia hạn</button></div>`);
  };
  A.ACT['ct-extend-save'] = el => {
    const c = A.idx.contract.get(el.dataset.id);
    if (!A.canDo('hop-dong.gia-han', c.market)) return;
    const m = Number(A.$('#ext-m').value);
    const d = new Date(c.end); d.setMonth(d.getMonth() + m);
    c.end = d.toISOString().slice(0, 10);
    U.log(`Gia hạn hợp đồng ${c.id} thêm ${m} tháng`);
    A.save(); A.closeModal(); A.render(); U.toast(`Đã gia hạn ${c.id} đến ${U.dmy(c.end)}`);
  };
  A.ACT['ct-end'] = el => {
    const c = A.idx.contract.get(el.dataset.id);
    if (!A.canDo('hop-dong.thanh-ly', c.market)) return;
    const debt = U.sum(A.db.invoices.filter(i => i.contractId === c.id && i.status !== 'paid'), U.due);
    A.modal(A.mHead('Thanh lý ' + c.id) + `<div class="modal-b"><p>Thanh lý hợp đồng với <b>${U.esc(A.idx.trader.get(c.traderId).name)}</b> tại điểm <b>${A.idx.stall.get(c.stallId).code}</b>. Điểm kinh doanh sẽ chuyển sang "Còn trống".</p>
      ${debt ? `<div class="note">Tiểu thương còn nợ ${U.money(debt)}. Cần thu hoặc cấn trừ tiền đặt cọc trước khi thanh lý.</div>` : ''}</div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="ct-end-save" data-id="${c.id}">Xác nhận thanh lý</button></div>`);
  };
  A.ACT['ct-end-save'] = el => {
    const c = A.idx.contract.get(el.dataset.id);
    if (!A.canDo('hop-dong.thanh-ly', c.market)) return;
    const st = A.idx.stall.get(c.stallId), t = A.idx.trader.get(c.traderId);
    c.status = 'thanhly'; c.end = U.today();
    st.history = st.history || []; st.history.unshift(`${U.dmy(U.today())}: thanh lý ${c.id} (${t.name})`);
    st.status = 'trong'; st.traderId = null; st.contractId = null;
    t.stalls = t.stalls.filter(id => id !== st.id);
    U.log(`Thanh lý hợp đồng ${c.id}`);
    A.save(); A.closeModal(); A.render(); U.toast('Đã thanh lý ' + c.id);
  };
  A.ACT['ct-new'] = el => {
    if (!A.canDo('so-do.tao-hop-dong', ui.market) && !A.canDo('hop-dong.tao', ui.market)) return;
    const pre = el.dataset.id;
    const empty = A.db.stalls.filter(s => s.status === 'trong' && (pre ? s.id === pre : U.inM(s)));
    if (!empty.length) { U.toast('Không còn điểm kinh doanh trống'); return; }
    const mk = empty[0].market;
    const traders = A.db.traders.filter(t => t.market === mk || t.stalls.length === 0).slice(-60).reverse();
    A.modal(A.mHead('Tạo hợp đồng thuê điểm kinh doanh') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Điểm kinh doanh còn trống</label><select class="input" id="nc-stall">${empty.map(s => `<option value="${s.id}">${s.code} · ${U.esc(s.sectionName)} · ${s.area.toLocaleString('vi-VN')} m²</option>`).join('')}</select></div>
      <div class="field"><label>Tiểu thương</label><select class="input" id="nc-trader">${traders.map(t => `<option value="${t.id}">${t.id} · ${U.esc(t.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Thời hạn</label><select class="input" id="nc-term"><option value="12">12 tháng</option><option value="36" selected>36 tháng</option></select></div>
      <div class="field"><label>Ngày bắt đầu</label><input class="input" value="${U.dmy(U.today())}" disabled></div></div>
      <div class="note info" style="margin-top:12px">Hợp đồng khởi tạo từ mẫu; đơn giá lấy theo cấu hình (QĐ 480/QĐ-UBND). Tiền đặt cọc bằng 01 tháng giá dịch vụ.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="ct-new-save">Tạo hợp đồng</button></div>`);
  };
  A.ACT['ct-new-save'] = () => {
    const st = A.idx.stall.get(A.$('#nc-stall').value);
    if (!st || st.status !== 'trong' || (!A.canDo('so-do.tao-hop-dong', st.market) && !A.canDo('hop-dong.tao', st.market))) return;
    const t = A.idx.trader.get(A.$('#nc-trader').value), term = Number(A.$('#nc-term').value);
    const end = new Date(U.today()); end.setMonth(end.getMonth() + term); end.setDate(end.getDate() - 1);
    const unit = st.type === 'phien' ? D.SESSION_FEE : D.UNIT[st.type];
    const monthly = st.type === 'phien' ? 0 : Math.round(st.area * unit * 30 / 1000) * 1000;
    const c = { id: 'HĐ-' + st.market + '-2026-' + U.pad(A.db.contracts.length + 1, 4), stallId: st.id, traderId: t.id, market: st.market, kind: st.market === 'TTD' ? 'Đăng ký quầy theo năm' : 'Hợp đồng thuê điểm kinh doanh', start: U.today(), end: end.toISOString().slice(0, 10), unit, monthly, deposit: monthly, status: 'hieuluc', scanned: true };
    A.db.contracts.push(c); A.idx.contract.set(c.id, c);
    st.status = 'thue'; st.traderId = t.id; st.contractId = c.id; t.stalls.push(st.id);
    if (t.cat === 'Chưa gán') t.cat = st.cat;
    st.history = st.history || []; st.history.unshift(`${U.dmy(U.today())}: ký ${c.id} với ${t.name}`);
    U.log(`Tạo hợp đồng ${c.id} cho điểm ${st.code}`);
    A.save(); A.closeModal(); A.render(); U.toast('Đã tạo ' + c.id);
  };
})(window.APP);
