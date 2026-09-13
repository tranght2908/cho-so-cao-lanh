/* Màn hình: Điểm kinh doanh, Tiểu thương, Hợp đồng. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const f = ui.f;

  // ---------- Điểm kinh doanh ----------
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
  A.VIEWS['diem-kd'] = function () {
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
  };
  A.CH['dk-section'] = el => { f.dkSection = el.value; ui.page.dk = 0; A.render(); };
  A.CH['dk-status'] = el => { f.dkStatus = el.value; ui.page.dk = 0; A.render(); };
  A.IN['dk-search'] = el => { f.dkSearch = el.value; ui.page.dk = 0; A.render(); };
  A.ACT['dk-csv'] = () => U.csv('diem-kinh-doanh', ['Mã điểm', 'Chợ', 'Khu vực', 'Ngành hàng', 'Loại', 'Diện tích m2', 'Đơn giá', 'Giá dịch vụ/tháng', 'Tiểu thương', 'Trạng thái'], dkRows().map(dkLine));
  A.ACT['dk-open'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    A.modal(A.mHead('Điểm kinh doanh') + `<div class="modal-b detail">${A.stallPanel(st)}</div>`);
  };

  // ---------- Tiểu thương ----------
  function ttRows() {
    const q = (f.ttSearch || '').toLowerCase();
    return A.db.traders.filter(t => U.inM(t)
      && (!f.ttApp || (f.ttApp === 'yes') === !!t.app)
      && (!q || t.name.toLowerCase().includes(q) || t.phone.includes(q) || t.id.toLowerCase().includes(q) || t.stalls.some(id => A.idx.stall.get(id).code.toLowerCase().includes(q))));
  }
  A.VIEWS['tieu-thuong'] = function () {
    const rows = ttRows(), pg = U.pager('tt', rows.length, 25);
    return `<div class="card"><div class="card-h"><h3>${ui.role === 'lanhdao' ? 'Tra cứu tiểu thương' : 'Hồ sơ tiểu thương'}</h3>
      <select class="input" data-ch="tt-app"><option value="">Mini app: tất cả</option><option value="yes" ${f.ttApp === 'yes' ? 'selected' : ''}>Đã cài mini app</option><option value="no" ${f.ttApp === 'no' ? 'selected' : ''}>Chưa cài</option></select>
      <input class="input" placeholder="Tên, SĐT, mã điểm KD" data-in="tt-search" value="${U.esc(f.ttSearch || '')}">
      ${ui.role === 'bql' ? '<button class="btn primary" data-act="tt-new">+ Thêm tiểu thương</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Mã' }, { t: 'Họ tên' }, { t: 'Điện thoại' }, { t: 'Chợ' }, { t: 'Ngành hàng' }, { t: 'Điểm KD' }, { t: 'Mini app' }, { t: 'Công nợ', num: true }],
        rows.slice(pg.start, pg.end).map(t => {
          const debt = U.traderDebt(t.id), over = U.traderOverdue(t.id);
          return `<tr class="click" data-act="trader" data-id="${t.id}"><td>${t.id}</td><td><b>${U.esc(t.name)}</b></td><td>${U.maskPhone(t.phone)}</td><td>${U.mShort(t.market)}</td><td>${U.esc(t.cat)}</td>
            <td>${t.stalls.map(id => A.idx.stall.get(id).code).join(', ') || '–'}</td><td>${t.app ? '<span class="tag ok">Đã cài</span>' : '<span class="tag">Chưa</span>'}</td>
            <td class="num" style="${over ? 'color:#d6453b;font-weight:600' : ''}">${debt ? U.money(debt) : '–'}</td></tr>`;
        }))}${pg.html}
        <div class="small muted" style="margin-top:8px">Số điện thoại, số giấy tờ được che trên danh sách theo Nghị định 356/2025/NĐ-CP về bảo vệ dữ liệu cá nhân.</div></div></div>`;
  };
  A.CH['tt-app'] = el => { f.ttApp = el.value; ui.page.tt = 0; A.render(); };
  A.IN['tt-search'] = el => { f.ttSearch = el.value; ui.page.tt = 0; A.render(); };

  A.ACT.trader = (el, e) => {
    if (e) e.preventDefault();
    const t = A.idx.trader.get(el.dataset.id);
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
      </div><div class="modal-f">${ui.role === 'bql' && U.traderDebt(t.id) ? `<button class="btn primary" data-act="pay-open" data-id="${t.id}">💳 Thu tiền</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`, true);
  };

  const OCR_SAMPLE = { name: 'Nguyễn Thị Mỹ Duyên', idNo: '087196012345', birth: '1988', gender: 'Nữ', address: 'Khóm 3, phường Cao Lãnh' };
  function ttForm(v, ocr) {
    v = v || {};
    return A.mHead('Thêm tiểu thương') + `<div class="modal-b">
      <div class="row" style="margin-bottom:12px"><button class="btn" data-act="tt-ocr">📷 Quét CCCD (OCR giả lập)</button><span class="small muted">Chụp ảnh CCCD, hệ thống tự điền thông tin</span></div>
      ${ocr ? '<div class="note" style="margin-bottom:12px">OCR chỉ gợi ý – cán bộ kiểm tra, xác nhận trước khi lưu. Hệ thống kiểm tra trùng theo số giấy tờ.</div>' : ''}
      <div class="form-grid">
        <div class="field"><label>Họ và tên *</label><input class="input" id="nt-name" value="${U.esc(v.name || '')}"></div>
        <div class="field"><label>Số CCCD *</label><input class="input" id="nt-id" value="${U.esc(v.idNo || '')}"></div>
        <div class="field"><label>Năm sinh</label><input class="input" id="nt-birth" value="${U.esc(v.birth || '')}"></div>
        <div class="field"><label>Điện thoại *</label><input class="input" id="nt-phone" placeholder="09xxxxxxxx"></div>
        <div class="field"><label>Địa chỉ</label><input class="input" id="nt-addr" value="${U.esc(v.address || '')}"></div>
        <div class="field"><label>Chợ</label><select class="input" id="nt-market">${D.MARKETS.map(m => `<option value="${m.id}">${m.short}</option>`).join('')}</select></div>
      </div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="tt-save">Lưu hồ sơ</button></div>`;
  }
  A.ACT['tt-new'] = () => A.modal(ttForm());
  A.ACT['tt-ocr'] = () => { A.modal(ttForm(OCR_SAMPLE, true)); U.toast('Đã nhận dạng CCCD (giả lập) – vui lòng kiểm tra lại'); };
  A.ACT['tt-save'] = () => {
    const name = A.$('#nt-name').value.trim(), idNo = A.$('#nt-id').value.trim(), phone = A.$('#nt-phone').value.trim();
    if (!name || !idNo || !phone) { U.toast('Vui lòng nhập đủ họ tên, số CCCD và điện thoại'); return; }
    if (A.db.traders.some(t => t.idNo === idNo)) { U.toast('Số CCCD đã tồn tại trong hệ thống'); return; }
    const mk = A.$('#nt-market').value;
    const t = { id: 'TT' + U.pad(A.db.traders.length + 1, 4), name, gender: 'Nữ', phone, idNo, birth: A.$('#nt-birth').value || '', address: A.$('#nt-addr').value, market: mk, cat: 'Chưa gán', hkd: false, since: U.today(), app: false, bank: false, stalls: [] };
    A.db.traders.push(t); A.idx.trader.set(t.id, t);
    U.log('Thêm hồ sơ tiểu thương ' + t.id + ' – ' + name);
    A.save(); A.closeModal(); A.render(); U.toast('Đã lưu hồ sơ ' + t.id + '. Có thể tạo hợp đồng tại màn hình Hợp đồng.');
  };

  // ---------- Hợp đồng ----------
  A.VIEWS['hop-dong'] = function () {
    const q = (f.hdSearch || '').toLowerCase(), tab = ui.contractTab;
    const rows = A.db.contracts.filter(c => U.inM(c)
      && (tab === 'all' ? c.status === 'hieuluc' : tab === 'exp' ? c.status === 'hieuluc' && U.days(U.today(), c.end) <= 30 : c.status === 'thanhly')
      && (!q || c.id.toLowerCase().includes(q) || A.idx.trader.get(c.traderId).name.toLowerCase().includes(q) || A.idx.stall.get(c.stallId).code.toLowerCase().includes(q)))
      .sort((a, b) => tab === 'exp' ? a.end.localeCompare(b.end) : 0);
    const pg = U.pager('hd' + tab, rows.length, 25);
    const n = k => A.db.contracts.filter(c => U.inM(c) && (k === 'all' ? c.status === 'hieuluc' : k === 'exp' ? c.status === 'hieuluc' && U.days(U.today(), c.end) <= 30 : c.status === 'thanhly')).length;
    return `<div class="card"><div class="card-h">
      <div class="seg">${[['all', 'Đang hiệu lực'], ['exp', 'Sắp hết hạn ≤ 30 ngày'], ['end', 'Đã thanh lý']].map(x => `<button class="${tab === x[0] ? 'on' : ''}" data-act="hd-tab" data-id="${x[0]}">${x[1]} (${n(x[0])})</button>`).join('')}</div>
      <span class="spacer"></span><input class="input" placeholder="Số HĐ, tiểu thương, mã điểm" data-in="hd-search" value="${U.esc(f.hdSearch || '')}">
      <button class="btn primary" data-act="ct-new">+ Tạo hợp đồng</button></div>
      <div class="card-b">${U.table([{ t: 'Số hợp đồng' }, { t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Loại' }, { t: 'Thời hạn' }, { t: 'Còn lại', num: true }, { t: 'Giá/tháng', num: true }, { t: 'Bản số hóa' }, { t: '' }],
        rows.slice(pg.start, pg.end).map(c => {
          const left = U.days(U.today(), c.end);
          return `<tr><td>${c.id}</td><td><a href="#" data-act="trader" data-id="${c.traderId}">${U.esc(A.idx.trader.get(c.traderId).name)}</a></td><td>${A.idx.stall.get(c.stallId).code}</td><td class="small">${c.kind}</td>
            <td class="nowrap">${U.dmy(c.start)} – ${U.dmy(c.end)}</td><td class="num">${c.status === 'hieuluc' ? (left <= 30 ? `<span class="tag danger">${left} ngày</span>` : left + ' ngày') : '–'}</td>
            <td class="num">${c.monthly ? U.money(c.monthly) : 'Theo phiên'}</td><td>${c.scanned ? '<span class="tag info">PDF</span>' : '<span class="tag warn">Chưa scan</span>'}</td>
            <td class="nowrap">${c.status === 'hieuluc' ? `<button class="btn sm" data-act="ct-extend" data-id="${c.id}">Gia hạn</button> <button class="btn sm danger" data-act="ct-end" data-id="${c.id}">Thanh lý</button>` : ''}</td></tr>`;
        }))}${pg.html}
        <div class="small muted" style="margin-top:8px">Hệ thống tự cảnh báo và gửi thông báo cho tiểu thương trước khi hợp đồng hết hạn tối thiểu 30 ngày.</div></div></div>`;
  };
  A.ACT['hd-tab'] = el => { ui.contractTab = el.dataset.id; A.render(); };
  A.IN['hd-search'] = el => { f.hdSearch = el.value; ui.page['hd' + ui.contractTab] = 0; A.render(); };
  A.ACT['ct-extend'] = el => {
    const c = A.idx.contract.get(el.dataset.id);
    A.modal(A.mHead('Gia hạn ' + c.id) + `<div class="modal-b"><p>Hợp đồng hiện hết hạn ngày <b>${U.dmy(c.end)}</b>.</p>
      <div class="field"><label>Gia hạn thêm</label><select class="input" id="ext-m"><option value="12">12 tháng</option><option value="24">24 tháng</option><option value="36" selected>36 tháng</option></select></div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="ct-extend-save" data-id="${c.id}">Gia hạn</button></div>`);
  };
  A.ACT['ct-extend-save'] = el => {
    const c = A.idx.contract.get(el.dataset.id), m = Number(A.$('#ext-m').value);
    const d = new Date(c.end); d.setMonth(d.getMonth() + m);
    c.end = d.toISOString().slice(0, 10);
    U.log(`Gia hạn hợp đồng ${c.id} thêm ${m} tháng`);
    A.save(); A.closeModal(); A.render(); U.toast(`Đã gia hạn ${c.id} đến ${U.dmy(c.end)}`);
  };
  A.ACT['ct-end'] = el => {
    const c = A.idx.contract.get(el.dataset.id), debt = U.sum(A.db.invoices.filter(i => i.contractId === c.id && i.status !== 'paid'), U.due);
    A.modal(A.mHead('Thanh lý ' + c.id) + `<div class="modal-b"><p>Thanh lý hợp đồng với <b>${U.esc(A.idx.trader.get(c.traderId).name)}</b> tại điểm <b>${A.idx.stall.get(c.stallId).code}</b>. Điểm kinh doanh sẽ chuyển sang "Còn trống".</p>
      ${debt ? `<div class="note">Tiểu thương còn nợ ${U.money(debt)}. Cần thu hoặc cấn trừ tiền đặt cọc trước khi thanh lý.</div>` : ''}</div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="ct-end-save" data-id="${c.id}">Xác nhận thanh lý</button></div>`);
  };
  A.ACT['ct-end-save'] = el => {
    const c = A.idx.contract.get(el.dataset.id), st = A.idx.stall.get(c.stallId), t = A.idx.trader.get(c.traderId);
    c.status = 'thanhly'; c.end = U.today();
    st.history = st.history || []; st.history.unshift(`${U.dmy(U.today())}: thanh lý ${c.id} (${t.name})`);
    st.status = 'trong'; st.traderId = null; st.contractId = null;
    t.stalls = t.stalls.filter(id => id !== st.id);
    U.log(`Thanh lý hợp đồng ${c.id}`);
    A.save(); A.closeModal(); A.render(); U.toast('Đã thanh lý ' + c.id);
  };
  A.ACT['ct-new'] = el => {
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
    const st = A.idx.stall.get(A.$('#nc-stall').value), t = A.idx.trader.get(A.$('#nc-trader').value), term = Number(A.$('#nc-term').value);
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
