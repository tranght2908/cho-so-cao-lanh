/* Trader profile creation (Phase 15.16, from js/workflow.js): the effective tt-new flow creates ONLY a
 * trader profile (no point, contract or account); the success dialog offers "create contract now". */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  const TS = A.features.traders.service;
  const trader = id => A.idx.trader.get(id);
  const nextTraderId = () => {
    const max = A.db.traders.reduce((n, t) => Math.max(n, +(String(t.id).match(/TT(\d+)/) || [0, 0])[1]), 0);
    return 'TT' + U.pad(max + 1, 4);
  };

  let profileDraft = null;
  function profileFileButtons() {
    const defs = A.ttDocDefs || [];
    return defs.map(d => {
      const file = profileDraft.files[d.key];
      return `<div class="row" style="padding:5px 0"><span style="flex:1">${U.esc(d.label)}${file ? ` · ${U.esc(file.name)}` : ''}</span><button class="btn sm" data-act="wf-profile-file" data-key="${d.key}">${file ? 'Thay thế' : 'Chọn tệp'}</button></div>`;
    }).join('');
  }
  function profileVehicleRows() {
    const vehicles = profileDraft.vehicles || [];
    if (!vehicles.length) return '<div class="small muted">Chưa có phương tiện trong hồ sơ nháp.</div>';
    return vehicles.map((v, index) => {
      const type = A.VEHICLES.TYPES[v.type] || A.VEHICLES.TYPES.OTHER, policy = A.VEHICLES.price(ui.market, v.type, v.startDate);
      return `<div class="row" style="padding:8px 0;border-bottom:1px solid #eef2f7;align-items:flex-start"><div style="flex:1"><b>${U.esc(type.label)} · ${U.esc(v.plateNumber)}</b><div class="small muted">Từ ngày ${U.dmy(v.startDate)}${v.endDate ? ' · đến ' + U.dmy(v.endDate) : ''}</div><div class="small">${policy ? 'Mức phí đang áp dụng: <b>' + U.money(policy.amount) + ' ' + U.esc(policy.unit || '') + '</b>' : '<span class="tag warn">Chưa có biểu phí áp dụng</span>'}</div></div><button class="btn sm" data-act="wf-profile-vehicle-edit" data-index="${index}">Sửa</button><button class="btn sm danger" data-act="wf-profile-vehicle-remove" data-index="${index}">Xóa khỏi nháp</button></div>`;
    }).join('');
  }
  function vehicleDraftModal(index) {
    const editing = Number.isInteger(index), v = editing ? profileDraft.vehicles[index] : { type: 'MOTORBIKE', plateNumber: '', startDate: U.today(), endDate: '', description: '', note: '' };
    const policy = () => A.VEHICLES.policyHtml(ui.market, A.$('#wf-pv-type').value, A.$('#wf-pv-start').value);
    A.modal(A.mHead(editing ? 'Sửa phương tiện nháp' : 'Thêm phương tiện nháp') + `<div class="modal-b"><div class="form-grid"><div class="field"><label>Loại phương tiện *</label><select class="input" id="wf-pv-type">${Object.keys(A.VEHICLES.TYPES).map(k => `<option value="${k}" ${v.type === k ? 'selected' : ''}>${A.VEHICLES.TYPES[k].label}</option>`).join('')}</select></div><div class="field"><label>Biển số *</label><input class="input" id="wf-pv-plate" value="${U.esc(v.plateNumber)}" placeholder="Ví dụ: 66H1-12345"></div><div class="field"><label>Ngày bắt đầu gửi *</label><input class="input" id="wf-pv-start" type="date" value="${v.startDate || U.today()}"></div><div class="field"><label>Ngày kết thúc</label><input class="input" id="wf-pv-end" type="date" value="${v.endDate || ''}"></div><div class="field"><label>Mô tả</label><input class="input" id="wf-pv-description" value="${U.esc(v.description)}"></div><div class="field"><label>Ghi chú</label><input class="input" id="wf-pv-note" value="${U.esc(v.note)}"></div></div><div id="wf-pv-policy" style="margin-top:10px">${A.VEHICLES.policyHtml(ui.market, v.type, v.startDate)}</div></div><div class="modal-f"><button class="btn" data-act="wf-profile-vehicle-cancel">Hủy</button><button class="btn primary" data-act="wf-profile-vehicle-save" data-index="${editing ? index : ''}">${editing ? 'Lưu phương tiện' : 'Thêm vào nháp'}</button></div>`);
    const refresh = () => { const slot = A.$('#wf-pv-policy'); if (slot) slot.innerHTML = policy(); };
    A.$('#wf-pv-type').onchange = refresh; A.$('#wf-pv-start').onchange = refresh;
  }
  function renderProfile() {
    const d = profileDraft;
    A.modal(A.mHead('Thêm hồ sơ tiểu thương') + `<div class="modal-b"><h4>A. THÔNG TIN CƠ BẢN</h4><div class="form-grid">
      <div class="field"><label>Họ tên *</label><input class="input" data-in="wf-p-name" value="${U.esc(d.name)}"></div>
      <div class="field"><label>Số điện thoại *</label><input class="input" data-in="wf-p-phone" value="${U.esc(d.phone)}"></div>
      <div class="field"><label>Loại giấy tờ *</label><select class="input" data-ch="wf-p-idtype"><option ${d.idType === 'CCCD' ? 'selected' : ''}>CCCD</option><option ${d.idType === 'CMND' ? 'selected' : ''}>CMND</option><option ${d.idType === 'Hộ chiếu' ? 'selected' : ''}>Hộ chiếu</option></select></div>
      <div class="field"><label>Số giấy tờ *</label><input class="input" data-in="wf-p-idno" value="${U.esc(d.idNo)}"></div>
      <div class="field"><label>Địa chỉ</label><input class="input" data-in="wf-p-address" value="${U.esc(d.address)}"></div>
    </div><section style="margin-top:16px"><h4>B. HỒ SƠ ĐÍNH KÈM</h4><div class="small muted">Prototype chỉ lưu metadata/ảnh xem trước cục bộ, không tải lên máy chủ.</div>${profileFileButtons()}</section><section style="margin-top:16px"><div class="row"><div><h4 style="margin:0">C. PHƯƠNG TIỆN</h4><div class="small muted">Không bắt buộc. Mỗi đăng ký là một phương tiện riêng.</div></div><span class="spacer"></span><button class="btn sm" data-act="wf-profile-vehicle-add">+ Thêm phương tiện</button></div><div style="margin-top:8px">${profileVehicleRows()}</div></section>
    <div class="note info" style="margin-top:14px">Hồ sơ được tạo độc lập. Ngành hàng được xác định khi bố trí điểm kinh doanh trong hợp đồng; không nhập tại hồ sơ tiểu thương.</div></div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="wf-profile-save">Lưu hồ sơ</button></div>`);
  }
  function profileSuccess(t) {
    const canCreateContract = A.canDo('hop-dong.tao', t.market);
    A.modal(A.mHead('Đã tạo hồ sơ tiểu thương') + `<div class="modal-b"><dl class="kv"><dt>Tiểu thương</dt><dd><b>${U.esc(t.name)} · ${t.id}</b></dd><dt>Trạng thái hồ sơ</dt><dd><span class="tag warn">Chờ bố trí</span></dd></dl><div class="note info" style="margin-top:12px">Bước tiếp theo: tạo hợp đồng để bố trí điểm kinh doanh.</div></div><div class="modal-f"><button class="btn" data-act="wf-profile-later">Để sau</button>${canCreateContract ? `<button class="btn primary" data-act="wf-profile-contract" data-id="${t.id}">Tạo hợp đồng ngay</button>` : ''}</div>`);
  }
  A.ACT['tt-new'] = () => {
    if (!A.canDo('tieu-thuong.them-moi', ui.market)) return;
    profileDraft = { name: '', phone: '', idType: 'CCCD', idNo: '', address: '', files: {}, vehicles: [] };
    renderProfile();
  };
  ['name', 'phone', 'idno', 'address'].forEach(k => { A.IN['wf-p-' + k] = el => { if (profileDraft) profileDraft[{ idno: 'idNo' }[k] || k] = el.value; }; });
  A.CH['wf-p-idtype'] = el => { if (profileDraft) profileDraft.idType = el.value; };
  A.ACT['wf-profile-file'] = el => {
    if (!profileDraft) return;
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*,.pdf'; input.style.display = 'none';
    input.onchange = () => { if (input.files[0]) { const f = input.files[0]; profileDraft.files[el.dataset.key] = { name: f.name, type: f.type || '', size: Number(f.size || 0), addedAt: U.today(), mock: true }; renderProfile(); } input.remove(); };
    document.body.appendChild(input); input.click();
  };
  A.ACT['wf-profile-vehicle-add'] = () => { if (profileDraft && A.VEHICLES) vehicleDraftModal(null); };
  A.ACT['wf-profile-vehicle-edit'] = el => { const index = Number(el.dataset.index); if (profileDraft && profileDraft.vehicles[index] && A.VEHICLES) vehicleDraftModal(index); };
  A.ACT['wf-profile-vehicle-remove'] = el => { const index = Number(el.dataset.index); if (!profileDraft || !profileDraft.vehicles[index]) return; profileDraft.vehicles.splice(index, 1); renderProfile(); };
  A.ACT['wf-profile-vehicle-cancel'] = () => { if (profileDraft) renderProfile(); };
  A.ACT['wf-profile-vehicle-save'] = el => {
    if (!profileDraft || !A.VEHICLES) return;
    const vehicle = { type: A.$('#wf-pv-type').value, plateNumber: A.$('#wf-pv-plate').value.trim(), startDate: A.$('#wf-pv-start').value, endDate: A.$('#wf-pv-end').value || null, description: A.$('#wf-pv-description').value.trim(), note: A.$('#wf-pv-note').value.trim() };
    if (!vehicle.type || !vehicle.plateNumber || !vehicle.startDate) return U.toast('Vui lòng nhập loại phương tiện, biển số và ngày bắt đầu gửi.');
    if (vehicle.endDate && vehicle.endDate < vehicle.startDate) return U.toast('Ngày kết thúc không được trước ngày bắt đầu gửi.');
    const index = el.dataset.index === '' ? null : Number(el.dataset.index);
    if (Number.isInteger(index) && profileDraft.vehicles[index]) profileDraft.vehicles[index] = vehicle;
    else profileDraft.vehicles.push(vehicle);
    renderProfile();
  };
  A.ACT['wf-profile-save'] = () => {
    if (!A.canDo('tieu-thuong.them-moi', ui.market)) return U.toast('Bạn không có quyền tạo hồ sơ tiểu thương tại chợ này.');
    const d = profileDraft;
    if (!d || !d.name.trim() || !d.phone.trim() || !d.idNo.trim()) return U.toast('Vui lòng nhập họ tên, số điện thoại và số giấy tờ.');
    if (A.db.traders.some(t => t.market === ui.market && t.idNo === d.idNo.trim())) return U.toast('Số giấy tờ đã tồn tại trong chợ.');
    const t = { id: nextTraderId(), name: d.name.trim(), phone: d.phone.trim(), idNo: d.idNo.trim(), idType: d.idType, address: d.address.trim(), market: ui.market, stalls: [], source: 'STAFF', docFiles: Object.assign({}, d.files), since: U.today(), app: false, bank: false };
    TS.create(t);
    (d.vehicles || []).forEach(v => A.VEHICLES.create(Object.assign({}, v, { traderId: t.id, market: t.market }), false));
    if ((d.vehicles || []).length) A.save();
    profileDraft = null; profileSuccess(t); U.toast('Đã tạo hồ sơ tiểu thương');
  };
  A.ACT['wf-profile-contract'] = el => { const t = trader(el.dataset.id); if (!t || !A.canDo('hop-dong.tao', t.market)) return; A.closeModal(); A.go('hop-dong'); setTimeout(() => A.ACT['ct-new']({ dataset: { trader: t.id } }), 0); };
  A.ACT['wf-profile-later'] = () => { profileDraft = null; A.closeModal(); A.render(); };
})(window.APP);
