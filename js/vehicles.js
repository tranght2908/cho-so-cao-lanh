/* Quản lý phương tiện tiểu thương — FE prototype V1.
 * Store tách riêng khỏi Trader; Hợp đồng chỉ giữ snapshot phí tại lúc tạo.
 */
(function (A) {
  'use strict';
  const U = A.U;
  const TYPES = {
    MOTORBIKE: { label: 'Xe máy', icon: '🛵' },
    BICYCLE: { label: 'Xe đạp', icon: '🚲' },
    CAR: { label: 'Ô tô', icon: '🚗' },
    ELECTRIC_BIKE: { label: 'Xe đạp/xe máy điện', icon: '🛴' },
    OTHER: { label: 'Khác', icon: '🚙' }
  };
  const currentUser = () => (A.ui && A.ui.account && A.ui.account.name) || 'Nhân viên BQL';
  const esc = x => U.esc(String(x || ''));
  const db = () => {
    A.db.traderVehicles = Array.isArray(A.db.traderVehicles) ? A.db.traderVehicles : [];
    return A.db.traderVehicles;
  };
  const nextId = () => 'VEH-' + String(db().length + 1).padStart(4, '0');
  const typeOf = type => TYPES[type] || TYPES.OTHER;
  const vehiclesFor = (traderId, activeOnly) => db().filter(v => v.traderId === traderId && (!activeOnly || v.status === 'ACTIVE'));
  const vehiclePrice = (market, type) => {
    const sc = A.SERVICE_CFG;
    if (!sc) return null;
    return sc.list('extraServices').find(x => x.marketId === market && x.status === 'active' && x.category === 'VEHICLE' && x.vehicleType === type) || null;
  };

  function ensureDemoData() {
    const cl = A.db.traders.find(t => t.id === 'TT0001' && t.market === 'CL') || A.db.traders.find(t => t.market === 'CL');
    if (cl && !vehiclesFor(cl.id).length) {
      db().push(
        { id: 'VEH-0001', traderId: cl.id, market: 'CL', type: 'MOTORBIKE', plateNumber: '66-P1 123.45', description: 'Honda Vision', note: 'Dữ liệu mẫu', status: 'ACTIVE', createdAt: U.today(), updatedAt: U.today() },
        { id: 'VEH-0002', traderId: cl.id, market: 'CL', type: 'BICYCLE', plateNumber: '', description: '', note: 'Dữ liệu mẫu', status: 'ACTIVE', createdAt: U.today(), updatedAt: U.today() }
      );
    }
    if (!A.SERVICE_CFG) return;
    const sample = [
      ['MOTORBIKE', 'Phí phương tiện - Xe máy (dữ liệu mẫu)', 100000],
      ['BICYCLE', 'Phí phương tiện - Xe đạp (dữ liệu mẫu)', 30000],
      ['CAR', 'Phí phương tiện - Ô tô (dữ liệu mẫu)', 300000],
      ['ELECTRIC_BIKE', 'Phí phương tiện - Xe điện (dữ liệu mẫu)', 80000]
    ];
    sample.forEach(([vehicleType, name, amount]) => {
      if (!vehiclePrice('CL', vehicleType)) A.SERVICE_CFG.add('extraServices', {
        name, marketId: 'CL', marketModel: 'FIXED_MONTHLY', collectionCycle: 'MONTH',
        calcMethod: 'fixed', amount, unit: 'đ/tháng', taxClass: 'TAXABLE_REVENUE',
        effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', category: 'VEHICLE', vehicleType,
        legalBasis: { docNo: '', docDate: '', issuer: 'Dữ liệu mẫu prototype', summary: 'Phí phương tiện cần BQL xác nhận', effectiveDate: '2026-01-01', note: '' }
      }, currentUser());
    });
    A.save();
  }

  function traderSection(t) {
    const canEdit = A.canDo('tieu-thuong.them-moi', t.market);
    const list = vehiclesFor(t.id, false);
    return `<section class="tt-detail-card trader-vehicle-card">
      <div class="tt-detail-card-h"><span>🛵</span><div><b>D. Phương tiện đăng ký</b><div class="small muted">Phương tiện thuộc hồ sơ tiểu thương; phí được áp dụng khi lập hợp đồng.</div></div><span class="spacer"></span>${canEdit ? `<button class="btn sm" data-act="vehicle-add" data-trader="${t.id}">+ Thêm phương tiện</button>` : ''}</div>
      ${list.length ? `<div class="vehicle-list">${list.map(v => { const tt = typeOf(v.type); return `<div class="vehicle-row ${v.status === 'INACTIVE' ? 'is-inactive' : ''}"><span class="vehicle-icon">${tt.icon}</span><div><b>${tt.label}</b><div>${esc(v.plateNumber || 'Không có biển số')}</div>${v.description ? `<small>${esc(v.description)}</small>` : ''}</div><span class="spacer"></span><span class="tag ${v.status === 'ACTIVE' ? 'ok' : ''}">${v.status === 'ACTIVE' ? 'Đang sử dụng' : 'Ngừng sử dụng'}</span>${canEdit ? `<button class="btn sm" data-act="vehicle-edit" data-id="${v.id}">Sửa</button>${v.status === 'ACTIVE' ? `<button class="btn sm" data-act="vehicle-deactivate" data-id="${v.id}">Ngừng sử dụng</button>` : ''}` : ''}</div>`; }).join('')}</div>` : `<div class="empty small">Chưa đăng ký phương tiện.${canEdit ? ' Thêm phương tiện để áp dụng phí dịch vụ khi lập hợp đồng.' : ''}</div>`}
    </section>`;
  }

  function vehicleModal(v, trader) {
    const isEdit = !!v;
    const canEdit = A.canDo('tieu-thuong.them-moi', trader.market);
    if (!canEdit) return U.toast('Bạn không có quyền cập nhật phương tiện.');
    const x = v || { type: 'MOTORBIKE', plateNumber: '', description: '', note: '' };
    A.modal(A.mHead(isEdit ? 'Sửa phương tiện' : 'Thêm phương tiện') + `<div class="modal-b"><div class="form-grid"><div class="field"><label>Loại phương tiện *</label><select class="input" id="vehicle-type">${Object.keys(TYPES).map(k => `<option value="${k}" ${x.type === k ? 'selected' : ''}>${TYPES[k].label}</option>`).join('')}</select></div><div class="field"><label>Biển số</label><input class="input" id="vehicle-plate" value="${esc(x.plateNumber)}" placeholder="Ví dụ: 66-P1 123.45"></div><div class="field"><label>Mô tả</label><input class="input" id="vehicle-description" value="${esc(x.description)}" placeholder="Ví dụ: Honda Vision"></div><div class="field"><label>Ghi chú</label><input class="input" id="vehicle-note" value="${esc(x.note)}" placeholder="Không bắt buộc"></div></div><div class="note info">Xe đạp có thể không có biển số. Đây là thông tin đăng ký, không phải lịch sử xe ra/vào chợ.</div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="vehicle-save" data-id="${isEdit ? x.id : ''}" data-trader="${trader.id}">${isEdit ? 'Lưu thay đổi' : 'Thêm phương tiện'}</button></div>`, true);
  }
  function reopenTrader(id) { const t = A.idx.trader.get(id); if (t) A.openTraderDrawer(t); }
  A.ACT['vehicle-add'] = el => { const t = A.idx.trader.get(el.dataset.trader); if (t) vehicleModal(null, t); };
  A.ACT['vehicle-edit'] = el => { const v = db().find(x => x.id === el.dataset.id), t = v && A.idx.trader.get(v.traderId); if (v && t) vehicleModal(v, t); };
  A.ACT['vehicle-save'] = el => {
    const trader = A.idx.trader.get(el.dataset.trader), existing = el.dataset.id && db().find(x => x.id === el.dataset.id);
    if (!trader || !A.canDo('tieu-thuong.them-moi', trader.market)) return U.toast('Bạn không có quyền cập nhật phương tiện.');
    const type = A.$('#vehicle-type').value, plateNumber = A.$('#vehicle-plate').value.trim();
    if (!type) return U.toast('Vui lòng chọn loại phương tiện.');
    const patch = { type, plateNumber, description: A.$('#vehicle-description').value.trim(), note: A.$('#vehicle-note').value.trim(), updatedAt: U.today() };
    if (existing) Object.assign(existing, patch); else db().push(Object.assign({ id: nextId(), traderId: trader.id, market: trader.market, status: 'ACTIVE', createdAt: U.today() }, patch));
    A.save(); A.closeModal(); reopenTrader(trader.id); U.toast(existing ? 'Đã cập nhật phương tiện.' : 'Đã thêm phương tiện.');
  };
  A.ACT['vehicle-deactivate'] = el => {
    const v = db().find(x => x.id === el.dataset.id), t = v && A.idx.trader.get(v.traderId);
    if (!v || !t || !A.canDo('tieu-thuong.them-moi', t.market)) return;
    v.status = 'INACTIVE'; v.updatedAt = U.today(); A.save(); reopenTrader(t.id); U.toast('Đã ngừng sử dụng phương tiện; lịch sử vẫn được giữ.');
  };

  function selectedVehicleIds() { return Array.from(document.querySelectorAll('#ct-vehicle-panel input[type="checkbox"]:checked')).map(x => x.value); }
  function renderContractVehicles() {
    const panel = A.$('#ct-vehicle-panel'), traderSelect = A.$('#ct-trader'); if (!panel || !traderSelect) return;
    const t = A.idx.trader.get(traderSelect.value); const vs = t ? vehiclesFor(t.id, true) : [];
    const selected = new Set(selectedVehicleIds());
    panel.innerHTML = `<div class="contract-vehicle-head"><b>Phương tiện & phí dịch vụ</b><small>Chọn phương tiện áp dụng cho hợp đồng này.</small></div>${vs.length ? vs.map(v => { const p = vehiclePrice(t.market, v.type), tt = typeOf(v.type); return `<label class="contract-vehicle-option ${p ? '' : 'no-price'}"><input type="checkbox" value="${v.id}" ${selected.has(v.id) ? 'checked' : ''} ${p ? '' : 'disabled'}><span>${tt.icon}</span><div><b>${tt.label} · ${esc(v.plateNumber || 'Không biển số')}</b>${v.description ? `<small>${esc(v.description)}</small>` : ''}<small class="vehicle-fee">${p ? U.money(p.amount) + ' / tháng' : `⚠ Chưa cấu hình phí cho ${tt.label}`}</small></div></label>`; }).join('') + `<div class="contract-vehicle-total">Tổng phí phương tiện: <b>${U.money(vs.filter(v => selected.has(v.id)).reduce((sum, v) => { const p = vehiclePrice(t.market, v.type); return sum + (p ? Number(p.amount) : 0); }, 0))} / tháng</b></div>` : `<div class="note">Tiểu thương chưa đăng ký phương tiện. <button class="btn sm" type="button" data-act="close">Cập nhật hồ sơ tiểu thương</button></div>`}`;
  }
  function enhanceContractModal() {
    const fees = A.$('#ct-fees'); if (!fees || A.$('#ct-vehicle-panel')) return;
    const panel = document.createElement('div'); panel.id = 'ct-vehicle-panel'; panel.className = 'contract-vehicle-panel';
    fees.closest('.form-grid').after(panel); renderContractVehicles();
    A.$('#ct-trader').addEventListener('change', renderContractVehicles);
    panel.addEventListener('change', renderContractVehicles);
  }
  const oldNew = A.ACT['ct-new'];
  if (oldNew) A.ACT['ct-new'] = function (el) { oldNew(el); setTimeout(enhanceContractModal, 0); };
  const oldSave = A.ACT['ct-new-save'];
  if (oldSave) A.ACT['ct-new-save'] = function (el) {
    const trader = A.idx.trader.get(A.$('#ct-trader') && A.$('#ct-trader').value);
    const picked = trader ? selectedVehicleIds().map(id => db().find(v => v.id === id)).filter(Boolean).map(v => {
      const p = vehiclePrice(trader.market, v.type); return p && { vehicleId: v.id, type: v.type, plateNumber: v.plateNumber || '', description: v.description || '', serviceId: p.id, serviceName: p.name, amount: Number(p.amount), unit: p.unit || 'đ/tháng' };
    }).filter(Boolean) : [];
    const feeBox = A.$('#ct-fees'); if (feeBox && picked.length) feeBox.value = [feeBox.value.trim(), ...picked.map(x => x.serviceName + ' · ' + (x.plateNumber || typeOf(x.type).label) + ': ' + x.amount)].filter(Boolean).join('\n');
    const before = new Set(A.db.contracts.map(c => c.id)); oldSave(el);
    const created = A.db.contracts.find(c => !before.has(c.id));
    if (created) { created.vehicleFeeSnapshot = picked; A.save(); }
  };

  A.VEHICLES = { TYPES, list: vehiclesFor, price: vehiclePrice, traderSection, renderContractVehicles };
  ensureDemoData();
})(window.APP);
