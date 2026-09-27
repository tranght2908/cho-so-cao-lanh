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

  // Renderer active của popup hồ sơ: chỉ một action thêm, và row dùng label/value rõ ràng.
  function traderSection(t, options) {
    const canEdit = options && options.editable === false ? false : A.canDo('tieu-thuong.them-moi', t.market), list = vehiclesFor(t.id, false);
    const action = canEdit ? `<button class="btn sm" data-act="vehicle-add" data-trader="${t.id}">+ Thêm phương tiện</button>` : '';
    const rows = list.map(v => {
      const type = typeOf(v.type), point = v.pointId && A.idx.stall.get(v.pointId);
      return `<div class="vehicle-row ${v.status === 'INACTIVE' ? 'is-inactive' : ''}"><div><span class="vehicle-field-label">Loại phương tiện</span><b>${type.label}</b></div><div><span class="vehicle-field-label">Biển số</span><b>${esc(v.plateNumber || 'Không có biển số')}</b></div><div><span class="vehicle-field-label">Số lượng</span><b>${Number(v.quantity || 1)}</b></div><div><span class="vehicle-field-label">Điểm KD</span><b>${point ? esc(point.code) : 'Chưa xác định điểm'}</b></div><div><span class="vehicle-field-label">Từ ngày</span><b>${U.dmy(v.startDate || v.createdAt)}</b></div><div><span class="vehicle-field-label">Trạng thái</span><span class="tag ${v.status === 'ACTIVE' ? 'ok' : ''}">${v.status === 'ACTIVE' ? 'Đang sử dụng' : 'Ngừng sử dụng'}</span></div>${canEdit ? `<span class="vehicle-actions"><button class="btn sm" data-act="vehicle-edit" data-id="${v.id}">Chỉnh sửa</button>${v.status === 'ACTIVE' ? `<button class="btn sm" data-act="vehicle-deactivate" data-id="${v.id}">Ngừng sử dụng</button>` : ''}</span>` : ''}</div>`;
    }).join('');
    return `<section class="tt-detail-card trader-vehicle-card"><div class="tt-detail-card-h"><span>${U.icon('vehicle')}</span><div><b>D. Phương tiện đăng ký</b><div class="small muted">Phương tiện đang đăng ký tại các điểm kinh doanh</div></div><span class="spacer"></span>${action}</div>${rows ? `<div class="vehicle-list">${rows}</div>` : '<div class="tt-empty-inline">Chưa đăng ký phương tiện.<span>Phương tiện có thể được bổ sung khi cần.</span></div>'}</section>`;
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
    if (existing) {
      // Không ghi đè bản ghi cũ: ngừng hiệu lực rồi tạo phiên bản mới để giữ lịch sử.
      existing.status = 'INACTIVE'; existing.endDate = U.today(); existing.updatedAt = U.today();
      db().push(Object.assign({}, existing, patch, { id: nextId(), status: 'ACTIVE', endDate: null, createdAt: U.today(), updatedAt: U.today() }));
    } else db().push(Object.assign({ id: nextId(), traderId: trader.id, market: trader.market, status: 'ACTIVE', createdAt: U.today() }, patch));
    A.save(); A.closeModal(); reopenTrader(trader.id); U.toast(existing ? 'Đã thay đổi phương tiện; lịch sử cũ được giữ.' : 'Đã thêm phương tiện.');
  };
  A.ACT['vehicle-deactivate'] = el => {
    const v = db().find(x => x.id === el.dataset.id), t = v && A.idx.trader.get(v.traderId);
    if (!v || !t || !A.canDo('tieu-thuong.them-moi', t.market)) return;
    v.status = 'INACTIVE'; v.updatedAt = U.today(); A.save(); reopenTrader(t.id); U.toast('Đã ngừng sử dụng phương tiện; lịch sử vẫn được giữ.');
  };

  A.VEHICLES = { TYPES, list: vehiclesFor, price: vehiclePrice, traderSection };
})(window.APP);
