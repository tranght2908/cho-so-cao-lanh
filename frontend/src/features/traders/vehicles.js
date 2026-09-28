/* Quản lý phương tiện tiểu thương — FE prototype V1.
 * Store tách riêng khỏi Trader và Hợp đồng. Phí luôn được suy ra từ biểu phí
 * có hiệu lực theo kỳ; đăng ký phương tiện không lưu giá như một nguồn sự thật.
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
  const esc = x => U.esc(String(x || ''));
  const db = () => {
    A.db.traderVehicles = Array.isArray(A.db.traderVehicles) ? A.db.traderVehicles : [];
    return A.db.traderVehicles;
  };
  const nextId = () => 'VEH-' + String(db().length + 1).padStart(4, '0');
  const typeOf = type => TYPES[type] || TYPES.OTHER;
  const vehiclesFor = (traderId, activeOnly) => db().filter(v => v.traderId === traderId && (!activeOnly || v.status === 'ACTIVE'));
  const vehiclePrice = (market, type, effectiveDate) => {
    const sc = A.SERVICE_CFG;
    if (!sc) return null;
    const date = effectiveDate || U.today();
    return sc.list('extraServices').filter(x => x.marketId === market && x.status === 'active' && x.category === 'VEHICLE' && x.vehicleType === type
      && (!x.effectiveFrom || x.effectiveFrom <= date) && (!x.effectiveTo || x.effectiveTo >= date))
      .sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')))[0] || null;
  };
  const policyHtml = (market, type, effectiveDate) => {
    const policy = vehiclePrice(market, type, effectiveDate), basis = policy && policy.legalBasis || {};
    return policy ? `<div class="note info"><b>Mức phí áp dụng</b><br><b>${U.money(policy.amount)} ${esc(policy.unit || '')}</b><br><span class="small">Theo biểu phí đang hiệu lực${basis.docNo || basis.summary ? ': ' + esc([basis.docNo, basis.summary].filter(Boolean).join(' · ')) : ''}</span></div>`
      : '<div class="note warn">Chưa có biểu phí đang áp dụng cho loại phương tiện này. Vẫn có thể lưu đăng ký, nhưng chưa thể tạo khoản phải thu tự động.</div>';
  };
  const validDates = input => !!input.startDate && (!input.endDate || input.endDate >= input.startDate);
  function createRegistration(input, persist) {
    if (!input || !input.traderId || !input.market || !input.type || !String(input.plateNumber || '').trim() || !validDates(input)) return null;
    const record = {
      id: nextId(), traderId: input.traderId, market: input.market, type: input.type, plateNumber: String(input.plateNumber).trim(),
      startDate: input.startDate, endDate: input.endDate || null, description: String(input.description || '').trim(), note: String(input.note || '').trim(),
      status: input.endDate ? 'INACTIVE' : 'ACTIVE', createdAt: U.today(), updatedAt: U.today()
    };
    db().push(record);
    if (persist !== false) A.save();
    return record;
  }

  // Renderer active của popup hồ sơ: chỉ một action thêm, và row dùng label/value rõ ràng.
  function traderSection(t, options) {
    const canEdit = options && options.editable === false ? false : A.canDo('tieu-thuong.them-moi', t.market), list = vehiclesFor(t.id, false);
    const action = canEdit ? `<button class="btn sm" data-act="vehicle-add" data-trader="${t.id}">+ Thêm phương tiện</button>` : '';
    const rows = list.map(v => {
      const type = typeOf(v.type), point = v.pointId && A.idx.stall.get(v.pointId);
      const policy = vehiclePrice(v.market, v.type, U.today());
      return `<div class="vehicle-row ${v.status === 'INACTIVE' ? 'is-inactive' : ''}"><div><span class="vehicle-field-label">Loại phương tiện</span><b>${type.label}</b></div><div><span class="vehicle-field-label">Biển số</span><b>${esc(v.plateNumber || 'Không có biển số')}</b></div><div><span class="vehicle-field-label">Từ ngày</span><b>${U.dmy(v.startDate || v.createdAt)}</b></div><div><span class="vehicle-field-label">Đến ngày</span><b>${v.endDate ? U.dmy(v.endDate) : '—'}</b></div><div><span class="vehicle-field-label">Biểu phí hiện tại</span><b>${policy ? U.money(policy.amount) + ' ' + esc(policy.unit || '') : 'Chưa có biểu phí'}</b></div><div><span class="vehicle-field-label">Trạng thái</span><span class="tag ${v.status === 'ACTIVE' ? 'ok' : ''}">${v.status === 'ACTIVE' ? 'Đang sử dụng' : 'Ngừng sử dụng'}</span></div>${canEdit ? `<span class="vehicle-actions"><button class="btn sm" data-act="vehicle-edit" data-id="${v.id}">Chỉnh sửa</button>${v.status === 'ACTIVE' ? `<button class="btn sm" data-act="vehicle-deactivate" data-id="${v.id}">Ngừng sử dụng</button>` : ''}</span>` : ''}</div>`;
    }).join('');
    return `<section class="tt-detail-card trader-vehicle-card"><div class="tt-detail-card-h"><span>${U.icon('vehicle')}</span><div><b>D. Phương tiện đăng ký</b><div class="small muted">Phương tiện đang đăng ký tại các điểm kinh doanh</div></div><span class="spacer"></span>${action}</div>${rows ? `<div class="vehicle-list">${rows}</div>` : '<div class="tt-empty-inline">Chưa đăng ký phương tiện.<span>Phương tiện có thể được bổ sung khi cần.</span></div>'}</section>`;
  }

  function vehicleModal(v, trader) {
    const isEdit = !!v;
    const canEdit = A.canDo('tieu-thuong.them-moi', trader.market);
    if (!canEdit) return U.toast('Bạn không có quyền cập nhật phương tiện.');
    const x = v || { type: 'MOTORBIKE', plateNumber: '', startDate: U.today(), endDate: '', description: '', note: '' };
    A.modal(A.mHead(isEdit ? 'Sửa phương tiện' : 'Thêm phương tiện') + `<div class="modal-b"><div class="form-grid"><div class="field"><label>Loại phương tiện *</label><select class="input" id="vehicle-type">${Object.keys(TYPES).map(k => `<option value="${k}" ${x.type === k ? 'selected' : ''}>${TYPES[k].label}</option>`).join('')}</select></div><div class="field"><label>Biển số *</label><input class="input" id="vehicle-plate" value="${esc(x.plateNumber)}" placeholder="Ví dụ: 66-P1 123.45"></div><div class="field"><label>Ngày bắt đầu gửi *</label><input class="input" id="vehicle-start" type="date" value="${x.startDate || x.createdAt || U.today()}"></div><div class="field"><label>Ngày kết thúc</label><input class="input" id="vehicle-end" type="date" value="${x.endDate || ''}"></div><div class="field"><label>Mô tả</label><input class="input" id="vehicle-description" value="${esc(x.description)}" placeholder="Ví dụ: Honda Vision"></div><div class="field"><label>Ghi chú</label><input class="input" id="vehicle-note" value="${esc(x.note)}" placeholder="Không bắt buộc"></div></div><div id="vehicle-policy" style="margin-top:10px">${policyHtml(trader.market, x.type, x.startDate || x.createdAt || U.today())}</div><div class="note info" style="margin-top:10px">Một hồ sơ tương ứng một phương tiện. Đây là thông tin đăng ký, không phải lịch sử xe ra/vào chợ.</div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="vehicle-save" data-id="${isEdit ? x.id : ''}" data-trader="${trader.id}">${isEdit ? 'Lưu thay đổi' : 'Thêm phương tiện'}</button></div>`, true);
    const refreshPolicy = () => { const slot = A.$('#vehicle-policy'); if (slot) slot.innerHTML = policyHtml(trader.market, A.$('#vehicle-type').value, A.$('#vehicle-start').value); };
    A.$('#vehicle-type').onchange = refreshPolicy; A.$('#vehicle-start').onchange = refreshPolicy;
  }
  function reopenTrader(id) { const t = A.idx.trader.get(id); if (t) A.openTraderDrawer(t); }
  A.ACT['vehicle-add'] = el => { const t = A.idx.trader.get(el.dataset.trader); if (t) vehicleModal(null, t); };
  A.ACT['vehicle-edit'] = el => { const v = db().find(x => x.id === el.dataset.id), t = v && A.idx.trader.get(v.traderId); if (v && t) vehicleModal(v, t); };
  A.ACT['vehicle-save'] = el => {
    const trader = A.idx.trader.get(el.dataset.trader), existing = el.dataset.id && db().find(x => x.id === el.dataset.id);
    if (!trader || !A.canDo('tieu-thuong.them-moi', trader.market)) return U.toast('Bạn không có quyền cập nhật phương tiện.');
    const type = A.$('#vehicle-type').value, plateNumber = A.$('#vehicle-plate').value.trim(), startDate = A.$('#vehicle-start').value, endDate = A.$('#vehicle-end').value;
    if (!type || !plateNumber || !startDate) return U.toast('Vui lòng nhập loại phương tiện, biển số và ngày bắt đầu gửi.');
    if (endDate && endDate < startDate) return U.toast('Ngày kết thúc không được trước ngày bắt đầu gửi.');
    const patch = { type, plateNumber, startDate, endDate: endDate || null, description: A.$('#vehicle-description').value.trim(), note: A.$('#vehicle-note').value.trim(), updatedAt: U.today() };
    if (existing) {
      // Không ghi đè bản ghi cũ: ngừng hiệu lực rồi tạo phiên bản mới để giữ lịch sử.
      existing.status = 'INACTIVE'; existing.endDate = U.today(); existing.updatedAt = U.today();
      db().push(Object.assign({}, existing, patch, { id: nextId(), status: endDate ? 'INACTIVE' : 'ACTIVE', createdAt: U.today(), updatedAt: U.today() }));
    } else createRegistration(Object.assign({ traderId: trader.id, market: trader.market }, patch), false);
    A.save(); A.closeModal(); reopenTrader(trader.id); U.toast(existing ? 'Đã thay đổi phương tiện; lịch sử cũ được giữ.' : 'Đã thêm phương tiện.');
  };
  A.ACT['vehicle-deactivate'] = el => {
    const v = db().find(x => x.id === el.dataset.id), t = v && A.idx.trader.get(v.traderId);
    if (!v || !t || !A.canDo('tieu-thuong.them-moi', t.market)) return;
    v.status = 'INACTIVE'; v.endDate = v.endDate || U.today(); v.updatedAt = U.today(); A.save(); reopenTrader(t.id); U.toast('Đã ngừng sử dụng phương tiện; lịch sử vẫn được giữ.');
  };

  A.VEHICLES = { TYPES, list: vehiclesFor, price: vehiclePrice, policyHtml, create: createRegistration, traderSection };
})(window.APP);
