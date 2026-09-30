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
  function renderProfile() {
    const d = profileDraft;
    A.modal(A.mHead('Thêm hồ sơ tiểu thương') + `<div class="modal-b"><h4>A. THÔNG TIN CƠ BẢN</h4><div class="form-grid">
      <div class="field"><label>Họ tên *</label><input class="input" data-in="wf-p-name" value="${U.esc(d.name)}"></div>
      <div class="field"><label>Số điện thoại *</label><input class="input" data-in="wf-p-phone" value="${U.esc(d.phone)}"></div>
      <div class="field"><label>Loại giấy tờ *</label><select class="input" data-ch="wf-p-idtype"><option ${d.idType === 'CCCD' ? 'selected' : ''}>CCCD</option><option ${d.idType === 'CMND' ? 'selected' : ''}>CMND</option><option ${d.idType === 'Hộ chiếu' ? 'selected' : ''}>Hộ chiếu</option></select></div>
      <div class="field"><label>Số giấy tờ *</label><input class="input" data-in="wf-p-idno" value="${U.esc(d.idNo)}"></div>
      <div class="field"><label>Địa chỉ</label><input class="input" data-in="wf-p-address" value="${U.esc(d.address)}"></div>
    </div><section style="margin-top:16px"><h4>B. HỒ SƠ ĐÍNH KÈM</h4><div class="small muted">Prototype chỉ lưu metadata/ảnh xem trước cục bộ, không tải lên máy chủ.</div>${profileFileButtons()}</section>
    <div class="note info" style="margin-top:14px">Hồ sơ được tạo độc lập. Ngành hàng được xác định khi bố trí điểm kinh doanh trong hợp đồng; không nhập tại hồ sơ tiểu thương.</div></div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="wf-profile-save">Lưu hồ sơ</button></div>`);
  }
  function profileSuccess(t) {
    const canCreateContract = A.canDo('hop-dong.tao', t.market);
    A.modal(A.mHead('Đã tạo hồ sơ tiểu thương') + `<div class="modal-b"><dl class="kv"><dt>Tiểu thương</dt><dd><b>${U.esc(t.name)} · ${t.id}</b></dd><dt>Trạng thái hồ sơ</dt><dd><span class="tag warn">Chờ bố trí</span></dd></dl><div class="note info" style="margin-top:12px">Bước tiếp theo: tạo hợp đồng để bố trí điểm kinh doanh.</div></div><div class="modal-f"><button class="btn" data-act="wf-profile-later">Để sau</button>${canCreateContract ? `<button class="btn primary" data-act="wf-profile-contract" data-id="${t.id}">Tạo hợp đồng ngay</button>` : ''}</div>`);
  }
  A.ACT['tt-new'] = () => {
    if (!A.canDo('tieu-thuong.them-moi', ui.market)) return;
    profileDraft = { name: '', phone: '', idType: 'CCCD', idNo: '', address: '', files: {} };
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
  A.ACT['wf-profile-save'] = () => {
    if (!A.canDo('tieu-thuong.them-moi', ui.market)) return U.toast('Bạn không có quyền tạo hồ sơ tiểu thương tại chợ này.');
    const d = profileDraft;
    if (!d || !d.name.trim() || !d.phone.trim() || !d.idNo.trim()) return U.toast('Vui lòng nhập họ tên, số điện thoại và số giấy tờ.');
    const dup = TS.validateProfileUnique({ market: ui.market, phone: d.phone, idNo: d.idNo });
    if (dup) return U.toast(dup.message);
    const t = { id: nextTraderId(), name: d.name.trim(), phone: d.phone.trim(), idNo: d.idNo.trim(), idType: d.idType, address: d.address.trim(), market: ui.market, stalls: [], source: 'STAFF', docFiles: Object.assign({}, d.files), since: U.today(), app: false, bank: false };
    if (!TS.create(t)) return U.toast('Không thể tạo hồ sơ: trùng số điện thoại hoặc CCCD trong chợ này.');
    profileDraft = null; profileSuccess(t); U.toast('Đã tạo hồ sơ tiểu thương');
  };
  A.ACT['wf-profile-contract'] = el => { const t = trader(el.dataset.id); if (!t || !A.canDo('hop-dong.tao', t.market)) return; A.closeModal(); A.go('hop-dong'); setTimeout(() => A.ACT['ct-new']({ dataset: { trader: t.id } }), 0); };
  A.ACT['wf-profile-later'] = () => { profileDraft = null; A.closeModal(); A.render(); };
})(window.APP);
