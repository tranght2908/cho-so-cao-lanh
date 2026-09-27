/* Luồng liên thông hồ sơ → hợp đồng → điểm KD → tài khoản → OTP.
 * Prototype FE: chỉ điều phối các nguồn dữ liệu hiện hữu A.db/A.ACCOUNTS. */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  const active = c => c && c.status === 'hieuluc';
  const RECENT_POINT_KEY = 'choso-caolanh-workflow-recent-point';
  const trader = id => A.idx.trader.get(id);
  const stall = id => A.idx.stall.get(id);
  const accountFor = id => A.ACCOUNTS.byTraderId(id);
  const marketName = id => U.mShort(id);
  const pointPrice = s => {
    const policy = U.appliedStallPrice ? U.appliedStallPrice(s) : null;
    const unit = policy ? Number(policy.amount || 0) : Number((A.D.UNIT || {})[s.type] || 0);
    return { unit, monthly: Math.round(Number(s.area || 0) * unit * 30 / 1000) * 1000, label: policy ? U.unitLabel(s) : 'Chưa cấu hình biểu phí' };
  };
  const nextContractId = market => {
    const max = A.db.contracts.reduce((n, c) => Math.max(n, +(String(c.id).match(/-(\d+)$/) || [0, 0])[1]), 0);
    return 'HĐ-' + market + '-' + new Date(U.today()).getFullYear() + '-' + U.pad(max + 1, 4);
  };
  const nextTraderId = () => {
    const max = A.db.traders.reduce((n, t) => Math.max(n, +(String(t.id).match(/TT(\d+)/) || [0, 0])[1]), 0);
    return 'TT' + U.pad(max + 1, 4);
  };
  const allowedMarket = market => A.allowedMarkets(A.currentAccount()).includes(market);
  const needsContract = market => A.db.traders.filter(t => t.market === market && !A.db.contracts.some(c => active(c) && c.traderId === t.id));
  const needsAccount = () => A.db.traders.filter(t => {
    const c = A.db.contracts.find(x => active(x) && x.traderId === t.id);
    return !!c && !!stall(c.stallId) && !accountFor(t.id);
  });
  A.WORKFLOW = {
    needsContract, needsAccount,
    isRecentPoint: id => ui.workflowRecentStallId === id || (() => { try { return sessionStorage.getItem(RECENT_POINT_KEY) === id; } catch (e) { return false; } })(),
    markRecentPoint: id => { ui.workflowRecentStallId = id; try { sessionStorage.setItem(RECENT_POINT_KEY, id); } catch (e) { /* UI marker is optional. */ } }
  };

  let profileDraft = null;
  function profileFileButtons() {
    const defs = A.ttDocDefs || [];
    return defs.map(d => {
      const file = profileDraft.files[d.key];
      return `<div class="row" style="padding:5px 0"><span style="flex:1">${U.esc(d.label)}${file ? ` · ${U.esc(file.name)}` : ''}</span><button class="btn sm" data-act="wf-profile-file" data-key="${d.key}">${file ? 'Thay thế' : 'Chọn tệp'}</button></div>`;
    }).join('');
  }
  function renderProfile() {
    const d = profileDraft;
    A.modal(A.mHead('Thêm hồ sơ tiểu thương') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Họ tên *</label><input class="input" data-in="wf-p-name" value="${U.esc(d.name)}"></div>
      <div class="field"><label>Số điện thoại *</label><input class="input" data-in="wf-p-phone" value="${U.esc(d.phone)}"></div>
      <div class="field"><label>Loại giấy tờ *</label><select class="input" data-ch="wf-p-idtype"><option ${d.idType === 'CCCD' ? 'selected' : ''}>CCCD</option><option ${d.idType === 'CMND' ? 'selected' : ''}>CMND</option><option ${d.idType === 'Hộ chiếu' ? 'selected' : ''}>Hộ chiếu</option></select></div>
      <div class="field"><label>Số giấy tờ *</label><input class="input" data-in="wf-p-idno" value="${U.esc(d.idNo)}"></div>
      <div class="field"><label>Địa chỉ</label><input class="input" data-in="wf-p-address" value="${U.esc(d.address)}"></div>
      <div class="field"><label>Ngành hàng</label><input class="input" data-in="wf-p-cat" value="${U.esc(d.cat)}"></div>
    </div><section style="margin-top:16px"><h4>Hồ sơ đính kèm</h4><div class="small muted">Prototype chỉ lưu metadata/ảnh xem trước cục bộ, không tải lên máy chủ.</div>${profileFileButtons()}</section>
    <div class="note info" style="margin-top:14px">Hồ sơ được tạo độc lập. Điểm kinh doanh, hợp đồng và tài khoản sẽ được thực hiện ở bước tiếp theo.</div></div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="wf-profile-save">Lưu hồ sơ</button></div>`);
  }
  function profileSuccess(t) {
    A.modal(A.mHead('Đã tạo hồ sơ tiểu thương') + `<div class="modal-b"><dl class="kv"><dt>Tiểu thương</dt><dd><b>${U.esc(t.name)} · ${t.id}</b></dd><dt>Trạng thái nghiệp vụ</dt><dd><span class="tag">Chưa có hợp đồng</span></dd></dl><div class="note info" style="margin-top:12px">Bước tiếp theo: tạo hợp đồng để bố trí điểm kinh doanh.</div></div><div class="modal-f"><button class="btn" data-act="wf-profile-later">Để sau</button><button class="btn primary" data-act="wf-profile-contract" data-id="${t.id}">Tạo hợp đồng ngay</button></div>`);
  }
  A.ACT['tt-new'] = () => {
    if (!A.canDo('tieu-thuong.them-moi', ui.market)) return;
    profileDraft = { name: '', phone: '', idType: 'CCCD', idNo: '', address: '', cat: '', files: {} };
    renderProfile();
  };
  ['name', 'phone', 'idno', 'address', 'cat'].forEach(k => { A.IN['wf-p-' + k] = el => { if (profileDraft) profileDraft[{ idno: 'idNo' }[k] || k] = el.value; }; });
  A.CH['wf-p-idtype'] = el => { if (profileDraft) profileDraft.idType = el.value; };
  A.ACT['wf-profile-file'] = el => {
    if (!profileDraft) return;
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*,.pdf'; input.style.display = 'none';
    input.onchange = () => { if (input.files[0]) { const f = input.files[0]; profileDraft.files[el.dataset.key] = { name: f.name, type: f.type || '', size: Number(f.size || 0), addedAt: U.today(), mock: true }; renderProfile(); } input.remove(); };
    document.body.appendChild(input); input.click();
  };
  A.ACT['wf-profile-save'] = () => {
    const d = profileDraft;
    if (!d || !d.name.trim() || !d.phone.trim() || !d.idNo.trim()) return U.toast('Vui lòng nhập họ tên, số điện thoại và số giấy tờ.');
    if (A.db.traders.some(t => t.market === ui.market && t.idNo === d.idNo.trim())) return U.toast('Số giấy tờ đã tồn tại trong chợ.');
    const t = { id: nextTraderId(), name: d.name.trim(), phone: d.phone.trim(), idNo: d.idNo.trim(), idType: d.idType, address: d.address.trim(), cat: d.cat.trim() || 'Chưa gán', market: ui.market, stalls: [], profileStatus: 'ACTIVE', source: 'STAFF', docFiles: Object.assign({}, d.files), since: U.today(), app: false, bank: false };
    A.db.traders.push(t); A.reindex(); A.save(); profileDraft = null; profileSuccess(t); U.toast('Đã tạo hồ sơ tiểu thương');
  };
  A.ACT['wf-profile-contract'] = el => { const t = trader(el.dataset.id); if (!t) return; A.closeModal(); A.go('hop-dong'); setTimeout(() => A.ACT['ct-new']({ dataset: { trader: t.id } }), 0); };
  A.ACT['wf-profile-later'] = () => { profileDraft = null; A.closeModal(); A.render(); };

  function contractTaskHtml() {
    const rows = needsContract(ui.market);
    if (!rows.length) return '';
    return `<section class="card workflow-task"><div class="card-h"><div><h3>Cần xử lý <span class="tag">${rows.length}</span></h3><div class="small muted">Hồ sơ đã có nhưng chưa có hợp đồng hiệu lực.</div></div></div><div class="card-b">${rows.map(t => `<div class="workflow-task-row"><div><b>${U.esc(t.name)} · ${t.id}</b><div class="small muted">${U.maskPhone(t.phone)} · ${U.esc(marketName(t.market))}</div><div class="small">Chưa có hợp đồng</div></div><button class="btn primary" data-act="wf-contract-open" data-id="${t.id}">Tạo hợp đồng</button></div>`).join('')}</div></section>`;
  }
  const contractView = A.VIEWS['hop-dong'];
  A.VIEWS['hop-dong'] = function () { return contractTaskHtml() + contractView(); };
  function contractFilesHtml() { return '<div class="small muted">Có thể cập nhật ảnh/scan sau khi tạo hợp đồng trong màn chi tiết (mock).</div>'; }
  function openContract(traderId) {
    const t = trader(traderId);
    const market = t ? t.market : ui.market;
    const traders = A.db.traders.filter(x => x.market === market && !A.db.contracts.some(c => active(c) && c.traderId === x.id));
    const points = A.db.stalls.filter(s => s.market === market && s.status === 'trong' && !A.db.contracts.some(c => active(c) && c.stallId === s.id));
    if (!points.length) return U.toast('Không còn điểm kinh doanh trống phù hợp.');
    const selectedTrader = t || traders[0];
    if (!selectedTrader) return U.toast('Chưa có hồ sơ tiểu thương phù hợp.');
    const start = U.today(), end = new Date(new Date(start).setFullYear(new Date(start).getFullYear() + 1));
    A.modal(A.mHead('Tạo hợp đồng') + `<div class="modal-b"><section><h4>A. TIỂU THƯƠNG</h4><select class="input" id="wf-ct-trader">${traders.map(x => `<option value="${x.id}" ${x.id === selectedTrader.id ? 'selected' : ''}>${x.id} · ${U.esc(x.name)} · ${U.maskPhone(x.phone)}</option>`).join('')}</select></section><section><h4>B. ĐIỂM KINH DOANH</h4><select class="input" id="wf-ct-stall">${points.map(s => `<option value="${s.id}">${s.code} · ${U.esc(s.sectionName)} · ${s.area} m²</option>`).join('')}</select><div class="note info" style="margin-top:8px">Điểm được lấy từ mặt bằng hiện có; không nhập lại vị trí, diện tích hay ngành hàng.</div></section><section><h4>C. THỜI HẠN</h4><div class="form-grid"><div class="field"><label>Ngày bắt đầu</label><input class="input" id="wf-ct-start" type="date" value="${start}"></div><div class="field"><label>Ngày kết thúc</label><input class="input" id="wf-ct-end" type="date" value="${end.toISOString().slice(0, 10)}"></div></div></section><section><h4>D. KHOẢN THU / MỨC THU</h4><div class="field"><label>Đơn giá tháng</label><input class="input" id="wf-ct-monthly" type="number" min="0" value="0"></div><div class="field"><label>Khoản thu kèm theo (tên: số tiền, mỗi dòng)</label><textarea class="input" id="wf-ct-fees" rows="3"></textarea></div></section><section><h4>E. HỒ SƠ HỢP ĐỒNG</h4>${contractFilesHtml()}</section></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="wf-contract-save">Tạo hợp đồng</button></div>`);
  }
  let contractFiles = [];
  function workflowOpenContract(traderId) {
    const selected = trader(traderId), market = selected ? selected.market : ui.market;
    const traders = A.db.traders.filter(t => t.market === market && !A.db.contracts.some(c => active(c) && c.traderId === t.id));
    const points = A.db.stalls.filter(s => s.market === market && s.status === 'trong' && !A.db.contracts.some(c => active(c) && c.stallId === s.id));
    if (!traders.length || !points.length) return U.toast(!points.length ? 'Không còn điểm kinh doanh trống phù hợp.' : 'Chưa có hồ sơ tiểu thương phù hợp.');
    const t = selected || traders[0], s = points[0], rate = pointPrice(s), start = U.today(), end = new Date(new Date(start).setFullYear(new Date(start).getFullYear() + 1));
    contractFiles = [];
    const info = p => `<div class="note info" id="wf-ct-stall-info" style="margin-top:8px"><b>${p.code}</b><br>${U.esc(p.sectionName)}<br>Diện tích: ${p.area} m² · Loại diện tích: ${U.esc(U.areaTypeLabel(p.areaType) || 'Chưa có thông tin')}<br>Ngành hàng: ${U.esc(p.cat || 'Chưa có thông tin')}<br>Biểu phí: ${U.esc(pointPrice(p).label)}</div>`;
    A.modal(A.mHead('Tạo hợp đồng') + `<div class="modal-b workflow-contract-form">
      <section><h4>A. TIỂU THƯƠNG</h4><select class="input" id="wf-ct-trader">${traders.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${x.id} · ${U.esc(x.name)} · ${U.maskPhone(x.phone)}</option>`).join('')}</select></section>
      <section><h4>B. ĐIỂM KINH DOANH</h4><select class="input" id="wf-ct-stall">${points.map(x => `<option value="${x.id}">${x.code} · ${U.esc(x.sectionName)} · ${x.area} m²</option>`).join('')}</select>${info(s)}</section>
      <section><h4>C. THỜI HẠN</h4><div class="form-grid"><div class="field"><label>Ngày bắt đầu</label><input class="input" id="wf-ct-start" type="date" value="${start}"></div><div class="field"><label>Ngày kết thúc</label><input class="input" id="wf-ct-end" type="date" value="${end.toISOString().slice(0, 10)}"></div></div></section>
      <section><h4>D. KHOẢN THU / MỨC THU</h4><div class="field"><label>Mức thu tháng</label><input class="input" id="wf-ct-monthly" type="number" min="0" value="${rate.monthly}"></div><div class="field"><label>Khoản thu kèm theo (tên: số tiền, mỗi dòng)</label><textarea class="input" id="wf-ct-fees" rows="3"></textarea></div></section>
      <section><h4>E. HỒ SƠ HỢP ĐỒNG</h4><div id="wf-ct-files" class="small muted">Chưa có tệp đính kèm.</div><button class="btn sm" style="margin-top:8px" data-act="wf-contract-file">Chọn ảnh/scan hợp đồng</button><div class="small muted" style="margin-top:6px">Tệp chỉ được lưu metadata trong prototype.</div></section>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="wf-contract-save">Tạo hợp đồng</button></div>`);
    const pointSelect = A.$('#wf-ct-stall');
    pointSelect.onchange = () => { const p = stall(pointSelect.value), monthly = A.$('#wf-ct-monthly'), box = A.$('#wf-ct-stall-info'); if (p) { monthly.value = pointPrice(p).monthly; box.outerHTML = info(p); } };
  }
  A.ACT['wf-contract-open'] = el => workflowOpenContract(el.dataset.id);
  A.ACT['ct-new'] = el => {
    if (!A.canDo('hop-dong.tao', ui.market) && !A.canDo('so-do.tao-hop-dong', ui.market)) return;
    workflowOpenContract(el && el.dataset ? el.dataset.trader : null);
  };
  A.ACT['wf-contract-file'] = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*,.pdf'; input.multiple = true; input.style.display = 'none';
    input.onchange = () => { contractFiles = contractFiles.concat(Array.from(input.files || []).map(f => ({ name: f.name, type: f.type || '', size: Number(f.size || 0), addedAt: U.today(), mock: true }))); const slot = A.$('#wf-ct-files'); if (slot) { slot.className = 'small'; slot.innerHTML = contractFiles.map(f => U.esc(f.name)).join('<br>'); } input.remove(); };
    document.body.appendChild(input); input.click();
  };
  A.ACT['wf-contract-save'] = () => {
    const t = trader(A.$('#wf-ct-trader').value), s = stall(A.$('#wf-ct-stall').value), start = A.$('#wf-ct-start').value, end = A.$('#wf-ct-end').value;
    if (!t || !s || !start || !end || end < start || s.status !== 'trong' || A.db.contracts.some(c => active(c) && (c.traderId === t.id || c.stallId === s.id))) return U.toast('Vui lòng kiểm tra tiểu thương, điểm kinh doanh và thời hạn.');
    const fees = A.$('#wf-ct-fees').value.split('\n').map(x => { const p = x.split(':'); return p.length > 1 ? { name: p[0].trim(), amount: Number(p.slice(1).join(':').trim()) || 0 } : null; }).filter(Boolean);
    const rate = pointPrice(s);
    const c = { id: nextContractId(s.market), traderId: t.id, stallId: s.id, market: s.market, kind: 'Hợp đồng thuê điểm kinh doanh', signedDate: start, start, end, monthly: Number(A.$('#wf-ct-monthly').value) || rate.monthly, unit: rate.unit, unitLabel: 'đ/tháng', deposit: 0, feeSnapshot: fees, signedCopies: contractFiles.slice(), history: [], status: 'hieuluc' };
    c.history.unshift({ at: U.dmy(U.today()) + ' ' + U.nowTime(), action: 'Khởi tạo hợp đồng', detail: 'Tạo từ luồng hồ sơ tiểu thương' });
    A.db.contracts.push(c); A.reindex(); s.status = 'thue'; s.traderId = t.id; s.contractId = c.id; if (!t.stalls.includes(s.id)) t.stalls.push(s.id); s.history = s.history || []; s.history.unshift(U.dmy(U.today()) + ': ký ' + c.id + ' với ' + t.name); A.WORKFLOW.markRecentPoint(s.id); A.save(); A.closeModal(); A.render();
    A.modal(A.mHead('Tạo hợp đồng thành công') + `<div class="modal-b"><dl class="kv"><dt>Hợp đồng</dt><dd><b>${c.id}</b></dd><dt>Tiểu thương</dt><dd>${U.esc(t.name)}</dd><dt>Điểm kinh doanh</dt><dd>${s.code}</dd><dt>Thời hạn</dt><dd>${U.dmy(start)} → ${U.dmy(end)}</dd></dl></div><div class="modal-f"><button class="btn" data-act="wf-go-stall" data-id="${s.id}">Đi tới điểm kinh doanh</button><button class="btn primary" data-act="ct-view" data-id="${c.id}">Xem hợp đồng</button></div>`);
    U.toast('Tạo hợp đồng thành công');
  };
  A.ACT['wf-go-stall'] = el => { const s = stall(el.dataset.id); if (!s || !allowedMarket(s.market)) return; ui.market = s.market; A.closeModal(); A.go('mat-bang'); setTimeout(() => { if (A.openDkDrawer) A.openDkDrawer(s); }, 0); };

  function accountTaskHtml() {
    const rows = needsAccount();
    if (!rows.length) return '';
    return `<section class="card workflow-task"><div class="card-h"><div><h3>Cần xử lý <span class="tag">${rows.length}</span></h3><div class="small muted">Tiểu thương đã có hợp đồng và điểm kinh doanh nhưng chưa có tài khoản.</div></div></div><div class="card-b">${rows.map(t => { const c = A.db.contracts.find(x => active(x) && x.traderId === t.id), s = stall(c.stallId); return `<div class="workflow-task-row"><div><b>${U.esc(t.name)}</b><div class="small muted">Tiểu thương · ${U.esc(marketName(t.market))} · ${U.maskPhone(t.phone)}</div><div class="small">Hồ sơ tiểu thương · Hợp đồng ${c.id} · Điểm ${s.code} · Chưa có tài khoản</div></div><button class="btn primary" data-act="wf-account-open" data-id="${t.id}">Tạo tài khoản</button></div>`; }).join('')}</div></section>`;
  }
  const accountsView = A.VIEWS['tai-khoan'];
  A.VIEWS['tai-khoan'] = function () { return accountTaskHtml() + accountsView(); };
  A.ACT['wf-account-open'] = el => {
    if (!A.canDo('tai-khoan.tao-moi')) return;
    const t = trader(el.dataset.id), c = t && A.db.contracts.find(x => active(x) && x.traderId === t.id), s = c && stall(c.stallId);
    if (!t || !c || !s || accountFor(t.id)) return;
    A.modal(A.mHead('Tạo tài khoản tiểu thương') + `<div class="modal-b"><dl class="kv"><dt>Họ tên</dt><dd>${U.esc(t.name)}</dd><dt>Số điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd><dt>Vai trò</dt><dd>Tiểu thương</dd><dt>Chợ</dt><dd>${U.esc(marketName(t.market))}</dd><dt>Điểm kinh doanh</dt><dd>${s.code}</dd></dl><div class="note info" style="margin-top:12px">Thông tin được lấy từ hồ sơ, hợp đồng và điểm kinh doanh hiện có.</div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="wf-account-create" data-id="${t.id}">Tạo tài khoản</button></div>`);
  };
  A.ACT['wf-account-create'] = el => {
    if (!A.canDo('tai-khoan.tao-moi')) return;
    const t = trader(el.dataset.id); if (!t || accountFor(t.id)) return;
    const n = A.ACCOUNTS.list().reduce((max, a) => Math.max(max, +(String(a.id).match(/^AC-TT(\d+)$/) || [0, 0])[1]), 0) + 1, id = 'AC-TT' + U.pad(n, 2);
    A.ACCOUNTS.add({ id, code: id.replace('AC-', ''), fullName: t.name, phone: t.phone, accountType: 'Tiểu thương', title: 'Tiểu thương', roleIds: ['trader'], organization: marketName(t.market), marketScopes: [t.market], status: 'PENDING_ACTIVATION', traderId: t.id });
    A.closeModal(); A.render(); A.modal(A.mHead('Tạo tài khoản thành công') + `<div class="modal-b"><b>${U.esc(t.name)}</b><div>${U.maskPhone(t.phone)}</div></div><div class="modal-f"><button class="btn primary" data-act="wf-send-activation" data-id="${t.id}">Gửi thông báo kích hoạt</button></div>`); U.toast('Tạo tài khoản thành công');
  };
  A.ACT['wf-send-activation'] = el => { const t = trader(el.dataset.id); if (!t || !accountFor(t.id)) return; A.closeModal(); U.toast('Đã gửi thông báo kích hoạt: dùng số điện thoại đã đăng ký để đăng nhập OTP.'); };

  // OTP mock chỉ cho đăng nhập tài khoản đã được Admin tạo; không tự sinh account từ Mini App.
  A.ACT['mini-login-verify'] = () => {
    const m = ui.mini || {}, t = trader(m.loginTraderId);
    if (!t) { m.loginStep = 'phone'; A.render(); return; }
    const acc = accountFor(t.id);
    if (!acc) return U.toast('Tài khoản chưa được kích hoạt. Vui lòng liên hệ Ban Quản lý chợ.');
    if (acc.status !== 'active') { m.loginStep = 'locked'; A.render(); return; }
    Object.assign(m, { traderId: t.id, step: 'app', tab: 'home', loginStep: 'phone', loginPhone: null, loginTraderId: null }); A.save(); A.render();
  };
})(window.APP);
