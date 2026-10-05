/* Fee configuration UI (Phase 15.6, from js/v-vanhanh.js): route cau-hinh-gia (stall prices,
 * electricity/water, other services, lifecycle, legal basis, attachments) and the billing cycle /
 * billing rules panels hosted by the cai-dat screen. Data: A.SERVICE_CFG (store.js). */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  // ---- Chính sách thu và biểu phí: tiện ích dùng chung ----
  const CFG_CALC_LABELS = { fixed: 'Cố định / kỳ', area: 'Theo diện tích', qty: 'Theo số lượng', session: 'Theo phiên' };
  const CFG_MARKET_MODEL_LABELS = { FIXED_MONTHLY: 'Chợ cố định · thu theo tháng', MARKET_SESSION: 'Chợ phiên · thu theo phiên họp chợ' };
  const CFG_CYCLE_LABELS = { MONTH: 'Tháng', SESSION: 'Phiên', DAY: 'Ngày' };
  const CFG_TAX_LABELS = { TAXABLE_REVENUE: 'Doanh thu chịu thuế', PASS_THROUGH_NON_TAX: 'Thu hộ, không chịu thuế' };
  function cfgActor() { const acc = A.currentAccount(); return acc ? acc.fullName : 'Không rõ'; }
  function cfgDefaultMarketModel(marketId) { return marketId === 'TTD' ? 'MARKET_SESSION' : 'FIXED_MONTHLY'; }
  function cfgDefaultCycle(marketId) { return marketId === 'TTD' ? 'SESSION' : 'MONTH'; }
  function cfgWaiverName(id) {
    if (!id) return 'Không áp dụng';
    const item = A.SERVICE_CFG.waiverTypes().find(x => x.id === id);
    return item ? item.name : 'Tham chiếu không còn tồn tại';
  }
  // 3 nhóm giá (stallPrices/utilities/extraServices) dùng 3 action vòng đời chung:
  // cau-hinh-gia.them-phi / ap-dung-phi / khoa-mo-phi + market scope thật.
  function cfgGiaActionKey(cat) {
    return { stallPrices: 'stallPrices', utilities: 'utilities', extraServices: 'extraServices' }[cat] || null;
  }
  function cfgFeeActionAllowed(actionKey, rec) {
    if (rec && (rec.marketId === 'ALL' || rec.status === 'expired')) return false;
    return A.canDo(actionKey, rec ? rec.marketId : ui.market);
  }
  // Chính sách giá mặt bằng là chính sách dùng chung. Quyền riêng giúp không
  // vô tình cấp quyền cấu hình chính sách cấp hệ thống cho Trưởng BQL chợ.
  function cfgCommonLandAllowed(actionKey) {
    return A.canDo('cau-hinh-gia.chinh-sach-chung.' + actionKey);
  }
  function cfgCommonLandAddAllowed() { return ui.role === 'market_manager' && A.canDo('cau-hinh-gia.them-phi', ui.market); }
  function cfgCommonLandApplyAllowed(rec) { return !!rec && rec.status === 'draft' && cfgCommonLandAllowed('ap-dung'); }
  function cfgCommonLandLockAllowed(rec) { return !!rec && (rec.status === 'active' || rec.status === 'inactive') && cfgCommonLandAllowed('khoa-mo'); }
  function cfgCommonLandDraftMutateAllowed(rec) { return !!rec && rec.status !== 'active' && rec.status !== 'expired' && cfgCommonLandAllowed('them-muc'); }
  function cfgFeeAddAllowed(cat, rec) {
    return !!cfgGiaActionKey(cat) && cfgFeeActionAllowed('cau-hinh-gia.them-phi', rec || null);
  }
  function cfgFeeApplyAllowed(cat, rec) {
    return !!cfgGiaActionKey(cat) && rec && rec.status === 'draft' && cfgFeeActionAllowed('cau-hinh-gia.ap-dung-phi', rec);
  }
  function cfgFeeLockAllowed(cat, rec) {
    return !!cfgGiaActionKey(cat) && rec && (rec.status === 'active' || rec.status === 'inactive') && cfgFeeActionAllowed('cau-hinh-gia.khoa-mo-phi', rec);
  }
  function cfgFeeDraftMutateAllowed(cat, rec) {
    return !!cfgGiaActionKey(cat) && rec && rec.status !== 'active' && rec.status !== 'expired' && cfgFeeActionAllowed('cau-hinh-gia.them-phi', rec);
  }
  // rec=null nghĩa là đang TẠO MỚI (chưa có bản ghi) — kiểm theo ui.market hiện tại. rec có sẵn
  // (khóa/mở khóa/áp dụng/đính kèm tài liệu bản nháp) — kiểm theo đúng market của CHÍNH bản ghi đó (không
  // phải ui.market), để 1 forge handler đổi ui.market không thể lách qua bản ghi thuộc chợ khác.
  // Bản ghi legacy marketId:'ALL' (chỉ extraServices) LUÔN read-only — không tự suy đoán bản ghi đó
  // thuộc chợ nào (mục 8 SERVICE_PRICING_SCREEN_AUDIT.md) — admin phải tạo bản ghi mới rõ ràng
  // theo từng chợ nếu cần tách.
  function cfgPriceMutateAllowed(cat, rec) {
    return rec ? cfgFeeDraftMutateAllowed(cat, rec) : cfgFeeAddAllowed(cat, null);
  }
  function cfgSameFeeScope(cat, a, b) {
    if (!a || !b || a.marketId !== b.marketId || a.marketModel !== b.marketModel || a.collectionCycle !== b.collectionCycle) return false;
    if (cat === 'stallPrices') return (a.area || '').trim().toLowerCase() === (b.area || '').trim().toLowerCase() && (a.stallType || '').trim().toLowerCase() === (b.stallType || '').trim().toLowerCase();
    if (cat === 'utilities') return true;
    if (a.category === 'VEHICLE' || b.category === 'VEHICLE') return a.category === b.category && a.vehicleType === b.vehicleType;
    return (a.name || '').trim().toLowerCase() === (b.name || '').trim().toLowerCase() && (a.calcMethod || '') === (b.calcMethod || '');
  }
  function cfgActiveConflict(cat, rec) {
    return A.SERVICE_CFG.list(cat).find(x => x.id !== rec.id && x.status === 'active' && cfgSameFeeScope(cat, x, rec));
  }
  function cfgStatusTag(s) {
    if (s === 'active') return '<span class="tag ok">Đang áp dụng</span>';
    if (s === 'draft') return '<span class="tag warn">Chưa áp dụng</span>';
    if (s === 'expired') return '<span class="tag info">Đã hết hiệu lực</span>';
    return '<span class="tag">Đã khóa</span>';
  }
  function cfgLifecycleButtons(cat, id, status, canApply, canLock) {
    return `${canApply ? `<button class="btn sm primary" data-act="cfg-fee-apply" data-cat="${cat}" data-id="${id}">Áp dụng</button>` : ''}
      ${canLock ? `<button class="btn sm ${status === 'active' ? 'danger' : ''}" data-act="cfg-fee-toggle" data-cat="${cat}" data-id="${id}">${status === 'active' ? 'Khóa' : 'Mở khóa'}</button>` : ''}`;
  }
  function cfgPolicyDetailHtml(r) {
    return `<dt>Mô hình áp dụng</dt><dd>${U.esc(CFG_MARKET_MODEL_LABELS[r.marketModel] || r.marketModel || '—')}</dd>
      <dt>Chu kỳ thu</dt><dd>${U.esc(CFG_CYCLE_LABELS[r.collectionCycle] || r.collectionCycle || '—')}</dd>
      <dt>Phân loại thuế</dt><dd>${U.esc(CFG_TAX_LABELS[r.taxClass] || r.taxClass || '—')}</dd>
      <dt>Loại miễn giảm</dt><dd>${U.esc(cfgWaiverName(r.waiverTypeId))}</dd>`;
  }
  function cfgRecord(cat, id) {
    if (cat === 'billingCycle') return A.SERVICE_CFG.cycle();
    if (cat === 'billingRules') return A.SERVICE_CFG.rules();
    return A.SERVICE_CFG.get(cat, id);
  }
  function cfgLegalHtml(lb) {
    if (!lb || (!lb.docNo && !lb.summary)) return '<div class="small muted">Chưa có căn cứ</div>';
    return `<dl class="kv"><dt>Số văn bản</dt><dd>${lb.docNo ? U.esc(lb.docNo) : '<span class="muted">—</span>'}</dd>
      <dt>Ngày ban hành</dt><dd>${lb.docDate ? U.dmy(lb.docDate) : '<span class="muted">—</span>'}</dd>
      <dt>Cơ quan ban hành</dt><dd>${U.esc(lb.issuer || '—')}</dd><dt>Trích yếu</dt><dd>${U.esc(lb.summary || '—')}</dd>
      <dt>Ngày hiệu lực</dt><dd>${lb.effectiveDate ? U.dmy(lb.effectiveDate) : '<span class="muted">—</span>'}</dd>
      ${lb.note ? `<dt>Ghi chú</dt><dd>${U.esc(lb.note)}</dd>` : ''}</dl>`;
  }
  function cfgAttachIcon(type) { return (type || '').indexOf('image/') === 0 ? '🖼' : '📄'; }
  function cfgAttachHtml(rec, cat, id, canManage) {
    const list = rec.attachments || [];
    return `<div class="small muted" style="margin-bottom:6px">Tài liệu / hình ảnh / chứng từ đính kèm</div>
      ${list.length ? list.map(a => `<div class="row" style="padding:5px 0;border-bottom:1px solid #eef2f7">
        <span>${cfgAttachIcon(a.type)}</span><span style="flex:1">${U.esc(a.name)}${a.note ? `<div class="small muted">${U.esc(a.note)}</div>` : ''}</span>
        <button class="btn sm" data-act="cfg-att-view" data-cat="${cat}" data-id="${id}" data-att="${a.id}">Xem</button>
        ${canManage ? `<button class="btn sm danger" data-act="cfg-att-del" data-cat="${cat}" data-id="${id}" data-att="${a.id}">Xoá</button>` : ''}
      </div>`).join('') : '<div class="small muted">Chưa có tài liệu đính kèm</div>'}
      ${canManage ? `<label class="btn sm" style="cursor:pointer;margin-top:8px;display:inline-flex">+ Thêm tài liệu<input type="file" style="display:none" data-ch="cfg-att-add" data-cat="${cat}" data-id="${id}"></label>` : ''}`;
  }
  function cfgHistoryHtml(rec) {
    return U.table([{ t: 'Thời điểm' }, { t: 'Người thực hiện' }, { t: 'Thao tác' }, { t: 'Nội dung' }],
      (rec.history || []).map(h => `<tr><td class="nowrap">${h.time}</td><td>${U.esc(h.user)}</td><td>${U.esc(h.action)}</td><td class="small">${U.esc(h.detail || '')}</td></tr>`),
      { empty: 'Chưa có lịch sử thay đổi' });
  }
  function reopenCfgDrawer(cat, id) {
    const html = cat === 'stallPrices' ? cfgPriceDrawerHtml(cfgRecord(cat, id))
      : cat === 'utilities' ? cfgUtilDrawerHtml(cfgRecord(cat, id))
      : cat === 'extraServices' ? cfgSvcDrawerHtml(cfgRecord(cat, id))
      : null;
    if (html) A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${html}</div>`;
    else A.render();
  }

  // ---- sub-tab: Đơn giá mặt bằng ----
  function settingsGiaHtml() {
    const market = ui.market;
    const canNew = cfgCommonLandAddAllowed();
    const rows = A.SERVICE_CFG.list('stallPrices').filter(r => r.marketId === market && r.status === 'active');
    const mapped = rows.length && market === 'CL' || rows.length && market === 'TTD';
    return `<div class="card"><div class="card-h"><div><h3>Phí sử dụng mặt bằng</h3><div class="small muted">Theo phụ lục Quyết định 480/QĐ-UBND · ${U.esc(U.market(market).name)}</div></div>${canNew ? '<button class="btn sm primary" data-act="cfg-price-new">+ Thêm phí mặt bằng</button>' : ''}</div>
      <div class="card-b"><div class="note info"><b>Căn cứ áp dụng</b><br>Quyết định 480/QĐ-UBND · Ban hành 14/02/2026 · Hiệu lực 15/02/2026<br>Giá đã bao gồm VAT.<br><a href="https://thuvienphapluat.vn/van-ban/Thuong-mai/Quyet-dinh-480-QD-UBND-2026-gia-dich-vu-su-dung-dien-tich-ban-hang-tai-cho-Dong-Thap-720181.aspx" target="_blank" rel="noopener">Nguồn văn bản</a> <button class="btn sm" data-act="cfg-price-view-basis">Xem phụ lục / căn cứ</button></div>
      ${U.table([{ t: 'Loại diện tích / vị trí' }, { t: 'Đơn giá', num: true }, { t: 'Đơn vị' }, { t: 'Hiệu lực' }, { t: 'Căn cứ' }, { t: 'Trạng thái' }, { t: 'Thao tác' }],
        rows.map(r => `<tr><td>${U.esc(r.stallType || r.area)}</td><td class="num">${Number(r.amount).toLocaleString('vi-VN')}</td><td>${U.esc(r.unit)}</td><td>${U.dmy(r.effectiveFrom)}</td><td>480/QĐ-UBND</td><td>${cfgStatusTag(r.status)}</td><td><button class="btn sm" data-act="cfg-price-view" data-id="${r.id}">Xem căn cứ</button></td></tr>`), { empty: mapped ? 'Chưa có dữ liệu đối chiếu QĐ 480' : 'Chưa có dữ liệu đối chiếu QĐ 480' })}</div></div>`;
  }
  function cfgPriceDrawerHtml(r) {
    const canManage = cfgCommonLandDraftMutateAllowed(r), canApply = cfgCommonLandApplyAllowed(r), canLock = cfgCommonLandLockAllowed(r);
    return `<div class="drawer-h"><div><h3>Đơn giá sử dụng mặt bằng</h3><div class="small muted">${r.marketId === 'ALL' ? 'Tất cả 12 chợ' : 'Dữ liệu chuyển tiếp'} · ${cfgStatusTag(r.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <dl class="kv"><dt>Phạm vi</dt><dd>${r.marketId === 'ALL' ? 'Tất cả 12 chợ' : 'Dữ liệu chuyển tiếp từ cấu hình theo chợ'}</dd><dt>Khu vực</dt><dd>${U.esc(r.area)}</dd>
          <dt>Loại điểm</dt><dd>${U.esc(r.stallType)}</dd>${cfgPolicyDetailHtml(r)}<dt>Mức giá</dt><dd><b>${r.amount.toLocaleString('vi-VN')} ${U.esc(r.unit)}</b></dd>
          <dt>Hiệu lực từ</dt><dd>${U.dmy(r.effectiveFrom)}</dd>${r.effectiveTo ? `<dt>Hết hiệu lực</dt><dd>${U.dmy(r.effectiveTo)}</dd>` : ''}</dl>
        <div class="divider"></div><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(r.legalBasis)}</div>
        <div class="divider"></div><b class="small">TÀI LIỆU</b><div style="margin-top:6px">${cfgAttachHtml(r, 'stallPrices', r.id, canManage)}</div>
        <div class="divider"></div><b class="small">LỊCH SỬ</b><div style="margin-top:6px">${cfgHistoryHtml(r)}</div>
      </div>
      <div class="drawer-f">${cfgLifecycleButtons('stallPrices', r.id, r.status, canApply, canLock)}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.ACT['cfg-price-view'] = el => { const r = A.SERVICE_CFG.get('stallPrices', el.dataset.id); if (!r) return; A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${cfgPriceDrawerHtml(r)}</div>`; };
  A.ACT['cfg-price-new'] = () => {
    if (!cfgCommonLandAddAllowed()) return;
    ui.cfgForm = { cat: 'stallPrices', id: null, marketId: 'ALL', area: '', stallType: '', marketModel: 'FIXED_MONTHLY', collectionCycle: 'MONTH', amount: 0, unit: 'đ/m²/ngày', taxClass: 'TAXABLE_REVENUE', waiverTypeId: null, effectiveFrom: A.db.today, effectiveTo: null, status: 'draft', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' } };
    renderStallPriceForm();
  };
  A.ACT['cfg-price-edit'] = el => {
    U.toast('Không sửa trực tiếp phí đã tạo. Hãy thêm phí mới, khóa phí cũ rồi áp dụng phí mới.');
  };
  A.ACT['cfg-price-toggle'] = el => {
    const r = A.SERVICE_CFG.get('stallPrices', el.dataset.id); if (!r) return;
    if (!cfgCommonLandLockAllowed(r)) return;
    const was = r.status;
    A.SERVICE_CFG.setStatus('stallPrices', r.id, was === 'active' ? 'inactive' : 'draft', cfgActor());
    A.render(); U.toast(was === 'active' ? 'Đã khóa đơn giá' : 'Đã mở khóa đơn giá, cần bấm Áp dụng để dùng');
  };

  // ---- sub-tab: Điện & nước ----
  // ---------- HINH_THUC_THU_DIEN_NUOC ----------
  // Mỗi chợ chọn: theo công tơ (ghi chỉ số) hoặc chia đều như dịch vụ chợ. Chỉ tài khoản có
  // action:cau-hinh-gia.hinh-thuc-dien-nuoc (mặc định Quản trị hệ thống) được đổi; handler kiểm tra lại.
  const UTILITY_MODE_LABEL = {
    METER: ['Theo công tơ từng điểm kinh doanh', 'Nhân viên ghi chỉ số điện, nước hằng tháng; khoản phải thu tính theo chỉ số × đơn giá bên dưới.'],
    SERVICE: ['Theo công tơ từng điểm kinh doanh', 'Điện và nước được thu theo chỉ số công tơ tại từng điểm kinh doanh.']
  };
  const cfgCanUtilityMode = () => U.can('cau-hinh-gia') && A.canDo('cau-hinh-gia.hinh-thuc-dien-nuoc', ui.market);
  function utilityModeCardHtml() {
    const info = A.SERVICE_CFG.utilityModeInfo(ui.market), mode = A.SERVICE_CFG.utilityMode(ui.market), can = cfgCanUtilityMode();
    const opt = k => `<label style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1.5px solid ${mode === k ? '#1d4ed8' : 'var(--line)'};border-radius:10px;flex:1;min-width:260px;cursor:${can ? 'pointer' : 'default'};background:${mode === k ? '#f3f7ff' : 'transparent'}">
        <input type="radio" name="util-mode" ${mode === k ? 'checked' : ''} ${can ? `data-act="cfg-utility-mode" data-id="${k}"` : 'disabled'}><span><b>${UTILITY_MODE_LABEL[k][0]}</b><div class="small muted">${UTILITY_MODE_LABEL[k][1]}</div></span></label>`;
    return `<div class="card"><div class="card-h"><div><h3 style="margin:0">Hình thức thu điện, nước · ${U.esc(U.market(ui.market).name)}</h3>
      <div class="small muted">${can ? 'Chọn hình thức áp dụng cho chợ này.' : 'Chỉ Quản trị hệ thống thay đổi được hình thức thu.'}${info.updatedAt ? ' · Cập nhật ' + U.esc(info.updatedAt) + ' bởi ' + U.esc(info.updatedBy || '') : ''}</div></div></div>
      <div class="card-b"><div class="row" style="gap:10px;flex-wrap:wrap">${opt('METER')}${opt('SERVICE')}</div>
      ${mode === 'SERVICE' ? '<div class="note info" style="margin-top:10px">Chợ đang thu điện, nước chia đều. Khai báo khoản "Tiền điện/nước chia đều" ở tab <b>Dịch vụ chợ</b>. Bảng đơn giá theo công tơ bên dưới không được dùng khi tính khoản thu.</div>' : ''}</div></div>`;
  }
  A.ACT['cfg-utility-mode'] = el => {
    if (!cfgCanUtilityMode()) { U.toast('Chỉ Quản trị hệ thống được đổi hình thức thu điện, nước'); A.render(); return; }
    const next = el.dataset.id === 'SERVICE' ? 'SERVICE' : 'METER';
    if (next === A.SERVICE_CFG.utilityMode(ui.market)) return;
    A.modal(A.mHead('Đổi hình thức thu điện, nước') + `<div class="modal-b"><p>Chuyển <b>${U.esc(U.market(ui.market).name)}</b> sang: <b>${UTILITY_MODE_LABEL[next][0]}</b>.</p><div class="small muted">${UTILITY_MODE_LABEL[next][1]}</div>
      <div class="note" style="margin-top:10px">Áp dụng cho các lần <b>tính khoản thu</b> từ nay. Khoản phải thu đã phát hành không thay đổi.</div>
      <div class="field" style="margin-top:10px"><label>Lý do / căn cứ *</label><input class="input" id="util-mode-reason" placeholder="VD: Ban Quản lý đề nghị chia đều theo hóa đơn điện lực"></div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="cfg-utility-mode-save" data-id="${next}">Xác nhận đổi</button></div>`);
  };
  A.ACT['cfg-utility-mode-save'] = el => {
    if (!cfgCanUtilityMode()) { U.toast('Chỉ Quản trị hệ thống được đổi hình thức thu điện, nước'); A.closeModal(); A.render(); return; }
    const reason = ((A.$('#util-mode-reason') || {}).value || '').trim();
    if (!reason) return U.toast('Vui lòng nhập lý do / căn cứ');
    A.SERVICE_CFG.setUtilityMode(ui.market, el.dataset.id, cfgActor(), reason);
    U.log('Đổi hình thức thu điện, nước ' + ui.market + ' → ' + el.dataset.id + ' (' + reason + ')');
    A.closeModal(); A.render(); U.toast('Đã cập nhật hình thức thu điện, nước');
  };
  function settingsDienNuocHtml() {
    const canNew = cfgFeeAddAllowed('utilities', null);
    const rows = A.SERVICE_CFG.list('utilities').filter(r => r.marketId === ui.market);
    return `<div class="card"><div class="card-h"><h3>Điện & nước · ${U.esc(U.market(ui.market).name)}</h3>${canNew ? '<button class="btn sm primary" data-act="cfg-util-new">Thiết lập mức mới</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Chợ / mô hình' }, { t: 'Mức giá điện', num: true }, { t: 'Mức giá nước', num: true }, { t: 'Chu kỳ thu' }, { t: 'Phân loại thuế' }, { t: 'Hiệu lực / căn cứ' }, { t: 'Miễn giảm' }, { t: 'Trạng thái' }, { t: '' }],
        rows.map(r => { const canApply = cfgFeeApplyAllowed('utilities', r), canLock = cfgFeeLockAllowed('utilities', r); return `<tr>
          <td>${U.mShort(r.marketId)}<div class="small muted">${U.esc(CFG_MARKET_MODEL_LABELS[r.marketModel] || '—')}</div></td><td class="num">${r.elecPrice.toLocaleString('vi-VN')}<div class="small muted">${U.esc(r.elecUnit || 'đ/kWh')}</div></td><td class="num">${r.waterPrice.toLocaleString('vi-VN')}<div class="small muted">${U.esc(r.waterUnit || 'đ/m³')}</div></td>
          <td class="small">${U.esc(CFG_CYCLE_LABELS[r.collectionCycle] || '—')}</td><td class="small">${U.esc(CFG_TAX_LABELS[r.taxClass] || '—')}</td><td class="nowrap">${U.dmy(r.effectiveFrom)}${r.effectiveTo ? `<div class="small muted">đến ${U.dmy(r.effectiveTo)}</div>` : ''}<div class="small">${r.legalBasis && r.legalBasis.docNo ? U.esc(r.legalBasis.docNo) : '<span class="muted">—</span>'}</div></td><td class="small">${U.esc(cfgWaiverName(r.waiverTypeId))}</td>
          <td>${cfgStatusTag(r.status)}</td>
          <td class="nowrap"><button class="btn sm" data-act="cfg-util-view" data-id="${r.id}">Lịch sử</button>
            ${canNew ? `<button class="btn sm primary" data-act="cfg-util-new">Thiết lập mức mới</button>` : ''}
          </td></tr>`; }), { empty: 'Chưa có cấu hình điện nước cho ' + U.market(ui.market).short })}</div></div>`;
  }
  function cfgUtilDrawerHtml(r) {
    const canManage = cfgFeeDraftMutateAllowed('utilities', r), canApply = cfgFeeApplyAllowed('utilities', r), canLock = cfgFeeLockAllowed('utilities', r);
    return `<div class="drawer-h"><div><h3>Điện & nước</h3><div class="small muted">${U.mShort(r.marketId)} · ${cfgStatusTag(r.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <dl class="kv"><dt>Chợ</dt><dd>${U.esc(U.market(r.marketId).name)}</dd>${cfgPolicyDetailHtml(r)}<dt>Giá điện</dt><dd><b>${r.elecPrice.toLocaleString('vi-VN')} ${U.esc(r.elecUnit || 'đ/kWh')}</b></dd>
          <dt>Giá nước</dt><dd><b>${r.waterPrice.toLocaleString('vi-VN')} ${U.esc(r.waterUnit || 'đ/m³')}</b></dd><dt>Hiệu lực từ</dt><dd>${U.dmy(r.effectiveFrom)}</dd>${r.effectiveTo ? `<dt>Hết hiệu lực</dt><dd>${U.dmy(r.effectiveTo)}</dd>` : ''}</dl>
        <div class="divider"></div><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(r.legalBasis)}</div>
        <div class="divider"></div><b class="small">TÀI LIỆU</b><div style="margin-top:6px">${cfgAttachHtml(r, 'utilities', r.id, canManage)}</div>
        <div class="divider"></div><b class="small">LỊCH SỬ</b><div style="margin-top:6px">${cfgHistoryHtml(r)}</div>
      </div>
      <div class="drawer-f">${cfgLifecycleButtons('utilities', r.id, r.status, canApply, canLock)}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.ACT['cfg-util-view'] = el => { const r = A.SERVICE_CFG.get('utilities', el.dataset.id); if (!r) return; A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${cfgUtilDrawerHtml(r)}</div>`; };
  A.ACT['cfg-util-new'] = () => {
    if (!cfgFeeAddAllowed('utilities', null)) return;
    ui.cfgForm = { cat: 'utilities', id: null, marketId: ui.market, marketModel: cfgDefaultMarketModel(ui.market), collectionCycle: cfgDefaultCycle(ui.market), elecPrice: D.ELEC, elecUnit: 'đ/kWh', waterPrice: D.WATER, waterUnit: 'đ/m³', taxClass: 'PASS_THROUGH_NON_TAX', waiverTypeId: null, effectiveFrom: A.db.today, effectiveTo: null, status: 'draft', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' } };
    renderCfgForm();
  };
  A.ACT['cfg-util-edit'] = el => {
    U.toast('Không sửa trực tiếp phí đã tạo. Hãy thêm phí mới, khóa phí cũ rồi áp dụng phí mới.');
  };
  A.ACT['cfg-util-toggle'] = el => {
    const r = A.SERVICE_CFG.get('utilities', el.dataset.id); if (!r) return;
    if (!cfgFeeLockAllowed('utilities', r)) return;
    const was = r.status;
    A.SERVICE_CFG.setStatus('utilities', r.id, was === 'active' ? 'inactive' : 'draft', cfgActor());
    A.render(); U.toast(was === 'active' ? 'Đã khóa cấu hình điện nước' : 'Đã mở khóa, cần bấm Áp dụng để dùng');
  };

  // ---- sub-tab: Dịch vụ khác ----
  // Legacy marketId:'ALL' (mục 8 SERVICE_PRICING_SCREEN_AUDIT.md): vẫn hiển thị ở MỌI selectedMarket
  // (không lọc mất — "không mất dữ liệu"), nhưng LUÔN read-only (cfgPriceMutateAllowed trả false
  // cho rec.marketId==='ALL') kèm nhãn rõ ràng, không tự suy đoán quy về CL/TTD.
  function cfgAllBadge(r) { return r.marketId === 'ALL' ? ' <span class="tag warn" title="Bản ghi cũ trước Phase 6, áp dụng nhiều chợ — chỉ xem, tạo bản ghi mới theo từng chợ nếu cần tách">Dữ liệu cũ · nhiều chợ</span>' : ''; }
  function cfgIsLegacyParking(r) { return r.marketId === 'ALL' && r.category !== 'VEHICLE' && /gửi xe/i.test(r.name || ''); }
  function settingsDichVuHtml() {
    const canNew = cfgFeeAddAllowed('extraServices', null);
    const rows = A.SERVICE_CFG.list('extraServices').filter(r => (r.marketId === ui.market || r.marketId === 'ALL') && r.category !== 'VEHICLE' && !cfgIsLegacyParking(r));
    return `<div class="card"><div class="card-h"><h3>Dịch vụ chợ · ${U.esc(U.market(ui.market).name)}</h3>${canNew ? '<button class="btn sm primary" data-act="cfg-svc-new">+ Thêm dịch vụ</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Tên dịch vụ' }, { t: 'Chợ / mô hình' }, { t: 'Cách tính' }, { t: 'Mức giá', num: true }, { t: 'Đơn vị / chu kỳ' }, { t: 'Phân loại thuế' }, { t: 'Hiệu lực / căn cứ' }, { t: 'Miễn giảm' }, { t: 'Trạng thái' }, { t: '' }],
        rows.map(r => { const canApply = cfgFeeApplyAllowed('extraServices', r), canLock = cfgFeeLockAllowed('extraServices', r); return `<tr>
          <td><b>${U.esc(r.name)}</b>${r.category === 'VEHICLE' ? `<div class="small muted">Phương tiện · ${U.esc((A.VEHICLES.TYPES[r.vehicleType] || {}).label || r.vehicleType || '—')}</div>` : ''}${cfgAllBadge(r)}</td><td>${r.marketId === 'ALL' ? 'Tất cả chợ (cũ)' : U.mShort(r.marketId)}<div class="small muted">${U.esc(CFG_MARKET_MODEL_LABELS[r.marketModel] || '—')}</div></td><td class="small">${CFG_CALC_LABELS[r.calcMethod] || r.calcMethod}</td>
          <td class="num">${r.amount.toLocaleString('vi-VN')}</td><td class="small nowrap">${U.esc(r.unit)}<div class="muted">Chu kỳ: ${U.esc(CFG_CYCLE_LABELS[r.collectionCycle] || '—')}</div></td><td class="small">${U.esc(CFG_TAX_LABELS[r.taxClass] || '—')}</td><td class="nowrap">${U.dmy(r.effectiveFrom)}${r.effectiveTo ? `<div class="small muted">đến ${U.dmy(r.effectiveTo)}</div>` : ''}<div class="small">${r.legalBasis && r.legalBasis.docNo ? U.esc(r.legalBasis.docNo) : '<span class="muted">—</span>'}</div></td><td class="small">${U.esc(cfgWaiverName(r.waiverTypeId))}</td>
          <td>${cfgStatusTag(r.status)}</td>
          <td class="nowrap"><button class="btn sm" data-act="cfg-svc-view" data-id="${r.id}">Xem</button>
            ${canNew ? `<button class="btn sm primary" data-act="cfg-svc-new">Thiết lập mức mới</button>` : ''}
          </td></tr>`; }), { empty: 'Chưa có dịch vụ chợ nào cho ' + U.market(ui.market).short })}</div></div>`;
  }
  function settingsVehicleHtml() {
    const canNew = cfgFeeAddAllowed('extraServices', null);
    const rows = A.SERVICE_CFG.list('extraServices').filter(r => r.marketId === ui.market && r.category === 'VEHICLE');
    const legacyRows = A.SERVICE_CFG.list('extraServices').filter(cfgIsLegacyParking);
    return `<div class="card"><div class="card-h"><div><h3>Phí gửi xe · ${U.esc(U.market(ui.market).name)}</h3><div class="small muted">Biểu phí theo loại phương tiện đăng ký của tiểu thương</div></div>${canNew ? '<button class="btn sm primary" data-act="cfg-vehicle-new">+ Thêm biểu phí</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Loại phương tiện' }, { t: 'Mức giá', num: true }, { t: 'Chu kỳ' }, { t: 'Hiệu lực' }, { t: 'Căn cứ' }, { t: 'Trạng thái' }, { t: 'Thao tác' }],
        rows.map(r => { const canApply = cfgFeeApplyAllowed('extraServices', r), canLock = cfgFeeLockAllowed('extraServices', r); return `<tr>
          <td><b>${U.esc((((A.VEHICLES || {}).TYPES || {})[r.vehicleType] || {}).label || r.vehicleType || '—')}</b></td>
          <td class="num">${r.amount.toLocaleString('vi-VN')}<div class="small muted">${U.esc(r.unit || '')}</div></td>
          <td>${U.esc(CFG_CYCLE_LABELS[r.collectionCycle] || r.collectionCycle || '—')}</td>
          <td class="nowrap">${U.dmy(r.effectiveFrom)}${r.effectiveTo ? `<div class="small muted">đến ${U.dmy(r.effectiveTo)}</div>` : ''}</td>
          <td class="small">${r.legalBasis && r.legalBasis.docNo ? U.esc(r.legalBasis.docNo) : '—'}</td><td>${cfgStatusTag(r.status)}</td>
          <td class="nowrap"><button class="btn sm" data-act="cfg-svc-view" data-id="${r.id}">Lịch sử</button>${canNew ? `<button class="btn sm primary" data-act="cfg-svc-new">Thiết lập mức mới</button>` : ''}</td>
        </tr>`; }), { empty: 'Chưa có biểu phí phương tiện theo loại xe cho ' + U.market(ui.market).short })}
        ${legacyRows.length ? `<div class="note warn" style="margin-top:12px"><b>Dữ liệu legacy:</b> ${legacyRows.map(r => `${U.esc(r.name)} · ${r.amount.toLocaleString('vi-VN')} ${U.esc(r.unit || '')}`).join('; ')}. Bản ghi lượt gửi xe cũ không được dùng để xác định phí đăng ký phương tiện theo tháng và chỉ được giữ để tham chiếu.</div>` : ''}
      </div></div>`;
  }
  function cfgSvcDrawerHtml(r) {
    const canManage = cfgFeeDraftMutateAllowed('extraServices', r), canApply = cfgFeeApplyAllowed('extraServices', r), canLock = cfgFeeLockAllowed('extraServices', r);
    return `<div class="drawer-h"><div><h3>${U.esc(r.name)}${cfgAllBadge(r)}</h3><div class="small muted">${r.marketId === 'ALL' ? 'Tất cả chợ (cũ)' : U.mShort(r.marketId)} · ${cfgStatusTag(r.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <dl class="kv"><dt>Tên dịch vụ</dt><dd>${U.esc(r.name)}</dd>${r.category === 'VEHICLE' ? `<dt>Loại phương tiện</dt><dd>${U.esc((A.VEHICLES.TYPES[r.vehicleType] || {}).label || r.vehicleType || '—')}</dd>` : ''}<dt>Cách tính</dt><dd>${CFG_CALC_LABELS[r.calcMethod] || r.calcMethod}</dd>${cfgPolicyDetailHtml(r)}
          <dt>Mức giá</dt><dd><b>${r.amount.toLocaleString('vi-VN')} ${U.esc(r.unit)}</b></dd><dt>Hiệu lực từ</dt><dd>${U.dmy(r.effectiveFrom)}</dd>${r.effectiveTo ? `<dt>Hết hiệu lực</dt><dd>${U.dmy(r.effectiveTo)}</dd>` : ''}</dl>
        <div class="divider"></div><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(r.legalBasis)}</div>
        <div class="divider"></div><b class="small">TÀI LIỆU</b><div style="margin-top:6px">${cfgAttachHtml(r, 'extraServices', r.id, canManage)}</div>
        <div class="divider"></div><b class="small">LỊCH SỬ</b><div style="margin-top:6px">${cfgHistoryHtml(r)}</div>
      </div>
      <div class="drawer-f">${cfgLifecycleButtons('extraServices', r.id, r.status, canApply, canLock)}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.ACT['cfg-svc-view'] = el => { const r = A.SERVICE_CFG.get('extraServices', el.dataset.id); if (!r) return; A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${cfgSvcDrawerHtml(r)}</div>`; };
  A.ACT['cfg-svc-new'] = () => {
    if (!cfgFeeAddAllowed('extraServices', null)) return;
    // Phase 6 STEP A mục 8 — quyết định đã chốt: bản ghi MỚI không được phép marketId:'ALL' nữa,
    // luôn pin đúng 1 chợ (ui.market). Nếu 1 dịch vụ áp dụng cả 2 chợ, admin tạo 2 bản ghi riêng.
    ui.cfgForm = { cat: 'extraServices', id: null, name: '', category: 'GENERAL', vehicleType: '', marketId: ui.market, marketModel: cfgDefaultMarketModel(ui.market), collectionCycle: cfgDefaultCycle(ui.market), calcMethod: 'fixed', amount: 0, unit: ui.market === 'TTD' ? 'đ/phiên' : 'đ/tháng', taxClass: 'TAXABLE_REVENUE', waiverTypeId: null, effectiveFrom: A.db.today, effectiveTo: null, status: 'draft', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' } };
    renderCfgForm();
  };
  A.ACT['cfg-vehicle-new'] = () => {
    if (!cfgFeeAddAllowed('extraServices', null)) return;
    ui.cfgForm = { cat: 'extraServices', id: null, name: '', category: 'VEHICLE', vehiclePolicy: true, vehicleType: '', marketId: ui.market, marketModel: cfgDefaultMarketModel(ui.market), collectionCycle: 'MONTH', calcMethod: 'fixed', amount: 0, unit: 'đ/tháng', taxClass: 'TAXABLE_REVENUE', waiverTypeId: null, effectiveFrom: A.db.today, effectiveTo: null, status: 'draft', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' } };
    renderCfgForm();
  };
  A.ACT['cfg-svc-edit'] = el => {
    U.toast('Không sửa trực tiếp phí đã tạo. Hãy thêm phí mới, khóa phí cũ rồi áp dụng phí mới.');
  };
  A.ACT['cfg-svc-toggle'] = el => {
    const r = A.SERVICE_CFG.get('extraServices', el.dataset.id); if (!r) return;
    if (!cfgFeeLockAllowed('extraServices', r)) return;
    const was = r.status;
    A.SERVICE_CFG.setStatus('extraServices', r.id, was === 'active' ? 'inactive' : 'draft', cfgActor());
    A.render(); U.toast(was === 'active' ? 'Đã khóa dịch vụ' : 'Đã mở khóa dịch vụ, cần bấm Áp dụng để dùng');
  };
  A.ACT['cfg-fee-toggle'] = el => {
    const cat = el.dataset.cat, r = A.SERVICE_CFG.get(cat, el.dataset.id);
    const allowed = cat === 'stallPrices' ? cfgCommonLandLockAllowed(r) : cfgFeeLockAllowed(cat, r);
    if (!r || !allowed) return;
    const was = r.status;
    A.SERVICE_CFG.setStatus(cat, r.id, was === 'active' ? 'inactive' : 'draft', cfgActor());
    A.render();
    U.toast(was === 'active' ? 'Đã khóa phí đang áp dụng' : 'Đã mở khóa phí, cần bấm Áp dụng để dùng');
  };
  A.ACT['cfg-fee-apply'] = el => {
    const cat = el.dataset.cat, r = A.SERVICE_CFG.get(cat, el.dataset.id);
    const allowed = cat === 'stallPrices' ? cfgCommonLandApplyAllowed(r) : cfgFeeApplyAllowed(cat, r);
    if (!r || !allowed) return;
    const conflict = cfgActiveConflict(cat, r);
    if (conflict) {
      U.toast('Còn phí cũ đang áp dụng cùng phạm vi. Hãy khóa phí cũ trước khi áp dụng phí mới.');
      return;
    }
    A.SERVICE_CFG.setStatus(cat, r.id, 'active', cfgActor());
    A.render();
    U.toast('Đã áp dụng phí mới');
  };

  // ---- form thêm/sửa dùng chung cho 3 sub-tab dạng bảng ----
  function cfgCategoryLabel(cat) {
    if (cat === 'stallPrices') return 'mức giá sử dụng mặt bằng dùng chung';
    if (cat === 'utilities') return 'mức điện & nước mới';
    return ui.cfgForm && ui.cfgForm.vehiclePolicy ? 'biểu phí phương tiện' : 'dịch vụ chợ';
  }
  function renderStallPriceForm() {
    const market = U.market(ui.market);
    A.modal(A.mHead('Thêm phí mặt bằng') + `<div class="modal-b">
      <div class="field"><label>Chợ áp dụng</label><input class="input" value="${U.esc(market ? market.name : ui.market)}" disabled></div>
      <div class="divider"></div><h3 style="margin:0 0 10px">Căn cứ áp dụng</h3>
      <div class="form-grid">
        <div class="field"><label>Số/ký hiệu văn bản *</label><input class="input"></div>
        <div class="field"><label>Cơ quan ban hành *</label><input class="input"></div>
        <div class="field"><label>Ngày ban hành *</label><input class="input" type="date"></div>
        <div class="field"><label>Ngày hiệu lực *</label><input class="input" type="date"></div>
      </div>
      <div class="field" style="margin-top:8px"><label>Trích yếu *</label><input class="input"></div>
      <div class="field" style="margin-top:8px"><label>Link văn bản</label><input class="input" type="url"></div>
      <div class="field" style="margin-top:8px"><label>Ghi chú</label><textarea class="input" rows="2"></textarea></div>
      <div class="divider"></div><h3 style="margin:0 0 10px">Danh sách mức phí</h3>
      <table class="table"><thead><tr><th>Loại điểm kinh doanh</th><th>Loại diện tích/vị trí áp dụng</th><th>Đơn giá (đồng)</th><th>Đơn vị</th><th>Thao tác</th></tr></thead>
        <tbody><tr><td><input class="input" value="Điểm kinh doanh"></td><td><input class="input" value="Diện tích tiêu chuẩn"></td><td><input class="input" type="number" value="0"></td><td>đồng/m²/ngày</td><td><button class="btn" disabled>Xóa</button></td></tr></tbody>
      </table>
      <button class="btn" disabled>+ Thêm loại điểm kinh doanh</button>
      <div class="small" style="margin-top:8px">Có thể bổ sung các mức phí khác theo loại điểm kinh doanh và vị trí áp dụng.</div>
    </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="close">Lưu và áp dụng</button></div>`);
  }
  function renderCfgForm() {
    const d = ui.cfgForm, isNew = !d.id, lb = d.legalBasis;
    let fields = '';
    // Phase 6 STEP A mục 9 — chợ áp dụng LUÔN = selectedMarket tại thời điểm thao tác, hiển thị
    // read-only, KHÔNG cho chọn tự do trong form (kể cả khi Sửa — bản ghi giữ nguyên chợ gốc, xem
    // cfg-*-edit ở trên: ui.cfgForm.marketId luôn lấy từ ui.market khi tạo mới hoặc từ chính bản
    // ghi khi sửa, chưa từng đổi qua form). Không còn field select 'Chợ' nào trong form.
    const marketField = `<div class="field"><label>${d.marketId === 'ALL' ? 'Phạm vi áp dụng' : 'Chợ áp dụng'}</label><input class="input" value="${d.marketId === 'ALL' ? 'Tất cả 12 chợ' : U.esc(U.market(d.marketId).name)}" disabled></div>`;
    const policyFields = `<div class="field"><label>Loại chợ / mô hình thu phí</label><select class="input" data-ch="cf-market-model">${Object.keys(CFG_MARKET_MODEL_LABELS).map(k => `<option value="${k}" ${d.marketModel === k ? 'selected' : ''}>${CFG_MARKET_MODEL_LABELS[k]}</option>`).join('')}</select></div>
      <div class="field"><label>Chu kỳ thu</label><select class="input" data-ch="cf-cycle">${Object.keys(CFG_CYCLE_LABELS).map(k => `<option value="${k}" ${d.collectionCycle === k ? 'selected' : ''}>${CFG_CYCLE_LABELS[k]}</option>`).join('')}</select></div>
      <div class="field"><label>Phân loại thuế</label><select class="input" data-ch="cf-tax">${Object.keys(CFG_TAX_LABELS).map(k => `<option value="${k}" ${d.taxClass === k ? 'selected' : ''}>${CFG_TAX_LABELS[k]}</option>`).join('')}</select></div>
      <div class="field"><label>Loại miễn giảm áp dụng</label><select class="input" data-ch="cf-waiver"><option value="">Không áp dụng</option>${A.SERVICE_CFG.waiverTypes().filter(x => x.active).map(x => `<option value="${x.id}" ${d.waiverTypeId === x.id ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select></div>`;
    if (d.cat === 'stallPrices') {
      fields = `${marketField}${policyFields}
        <div class="field"><label>Khu vực / tầng</label><input class="input" data-ch="cf-area" value="${U.esc(d.area || '')}"></div>
        <div class="field"><label>Loại điểm kinh doanh</label><input class="input" data-ch="cf-stalltype" value="${U.esc(d.stallType || '')}"></div>
        <div class="field"><label>Đơn giá</label><input class="input" type="number" min="0" data-ch="cf-amount" value="${d.amount || 0}"></div>
        <div class="field"><label>Đơn vị tính</label><input class="input" data-ch="cf-unit" value="${U.esc(d.unit || '')}" placeholder="VD: đ/m²/ngày"></div>
        <div class="field"><label>Ngày hiệu lực</label><input class="input" type="date" data-ch="cf-eff" value="${d.effectiveFrom || ''}"></div>
        <div class="field"><label>Ngày hết hiệu lực</label><input class="input" type="date" data-ch="cf-effto" value="${d.effectiveTo || ''}"></div>`;
    } else if (d.cat === 'utilities') {
      fields = `${marketField}${policyFields}
        <div class="field"><label>Mức giá điện</label><input class="input" type="number" min="0" data-ch="cf-elec" value="${d.elecPrice || 0}"></div>
        <div class="field"><label>Đơn vị điện</label><input class="input" data-ch="cf-elec-unit" value="${U.esc(d.elecUnit || 'đ/kWh')}"></div>
        <div class="field"><label>Mức giá nước</label><input class="input" type="number" min="0" data-ch="cf-water" value="${d.waterPrice || 0}"></div>
        <div class="field"><label>Đơn vị nước</label><input class="input" data-ch="cf-water-unit" value="${U.esc(d.waterUnit || 'đ/m³')}"></div>
        <div class="field"><label>Ngày hiệu lực</label><input class="input" type="date" data-ch="cf-eff" value="${d.effectiveFrom || ''}"></div>
        <div class="field"><label>Ngày hết hiệu lực</label><input class="input" type="date" data-ch="cf-effto" value="${d.effectiveTo || ''}"></div>`;
    } else {
      const vehicleTypes = A.VEHICLES ? A.VEHICLES.TYPES : {};
      const vehicleFields = d.category === 'VEHICLE' ? `<div class="field"><label>Loại phương tiện *</label><select class="input" data-ch="cf-vehicle-type"><option value="">Chọn loại phương tiện</option>${Object.keys(vehicleTypes).map(k => `<option value="${k}" ${d.vehicleType === k ? 'selected' : ''}>${U.esc(vehicleTypes[k].label)}</option>`).join('')}</select></div>` : `<div class="field"><label>Tên dịch vụ</label><input class="input" data-ch="cf-name" value="${U.esc(d.name || '')}"></div>`;
      const categoryField = d.vehiclePolicy ? '' : `<div class="field"><label>Phân loại dịch vụ</label><select class="input" data-ch="cf-category"><option value="GENERAL" ${d.category !== 'VEHICLE' ? 'selected' : ''}>Dịch vụ chợ</option><option value="VEHICLE" ${d.category === 'VEHICLE' ? 'selected' : ''}>Phí đăng ký phương tiện</option></select></div>`;
      fields = `${categoryField}${vehicleFields}
        ${marketField}${policyFields}
        <div class="field"><label>Cách tính</label><select class="input" data-ch="cf-calc">${Object.keys(CFG_CALC_LABELS).map(k => `<option value="${k}" ${d.calcMethod === k ? 'selected' : ''}>${CFG_CALC_LABELS[k]}</option>`).join('')}</select></div>
        <div class="field"><label>Đơn giá</label><input class="input" type="number" min="0" data-ch="cf-amount" value="${d.amount || 0}"></div>
        <div class="field"><label>Đơn vị tính</label><input class="input" data-ch="cf-unit" value="${U.esc(d.unit || '')}"></div>
        <div class="field"><label>Ngày hiệu lực</label><input class="input" type="date" data-ch="cf-eff" value="${d.effectiveFrom || ''}"></div><div class="field"><label>Ngày hết hiệu lực</label><input class="input" type="date" data-ch="cf-effto" value="${d.effectiveTo || ''}"></div>`;
    }
    A.modal(A.mHead((isNew ? 'Thêm ' : 'Không sửa trực tiếp ') + cfgCategoryLabel(d.cat)) + `<div class="modal-b">
      ${isNew ? '<div class="note info" style="margin-bottom:10px">Phí mới được tạo ở trạng thái Chưa áp dụng. Muốn dùng phí mới, hãy khóa phí cũ đang áp dụng rồi bấm Áp dụng trên phí mới.</div>' : '<div class="note warn" style="margin-bottom:10px">Không sửa trực tiếp phí đã tạo. Hãy thêm phí mới, khóa phí cũ rồi áp dụng phí mới.</div>'}
      <div class="form-grid">${fields}</div>
      <div class="divider"></div><b class="small">Căn cứ</b>
      <div class="form-grid" style="margin-top:8px">
        <div class="field"><label>Số văn bản</label><input class="input" data-ch="cf-lb-docno" value="${U.esc(lb.docNo || '')}"></div>
        <div class="field"><label>Ngày ban hành</label><input class="input" type="date" data-ch="cf-lb-docdate" value="${lb.docDate || ''}"></div>
        <div class="field"><label>Cơ quan ban hành</label><input class="input" data-ch="cf-lb-issuer" value="${U.esc(lb.issuer || '')}"></div>
        <div class="field"><label>Ngày hiệu lực căn cứ</label><input class="input" type="date" data-ch="cf-lb-effdate" value="${lb.effectiveDate || ''}"></div>
      </div>
      <div class="field" style="margin-top:8px"><label>Trích yếu</label><input class="input" data-ch="cf-lb-summary" value="${U.esc(lb.summary || '')}"></div>
      <div class="field" style="margin-top:8px"><label>Ghi chú</label><input class="input" data-ch="cf-lb-note" value="${U.esc(lb.note || '')}"></div>
      </div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="cfg-form-save">Lưu</button></div>`);
  }
  A.CH['cf-area'] = el => { ui.cfgForm.area = el.value; };
  A.CH['cf-stalltype'] = el => { ui.cfgForm.stallType = el.value; };
  A.CH['cf-amount'] = el => { ui.cfgForm.amount = Math.max(0, Number(el.value) || 0); };
  A.CH['cf-unit'] = el => { ui.cfgForm.unit = el.value; };
  A.CH['cf-eff'] = el => { ui.cfgForm.effectiveFrom = el.value; };
  A.CH['cf-effto'] = el => { ui.cfgForm.effectiveTo = el.value || null; };
  A.CH['cf-market-model'] = el => { ui.cfgForm.marketModel = el.value; };
  A.CH['cf-cycle'] = el => { ui.cfgForm.collectionCycle = el.value; };
  A.CH['cf-tax'] = el => { ui.cfgForm.taxClass = el.value; };
  A.CH['cf-waiver'] = el => { ui.cfgForm.waiverTypeId = el.value || null; };
  A.CH['cf-name'] = el => { ui.cfgForm.name = el.value; };
  A.CH['cf-category'] = el => { ui.cfgForm.category = el.value; if (el.value !== 'VEHICLE') ui.cfgForm.vehicleType = ''; renderCfgForm(); };
  A.CH['cf-vehicle-type'] = el => { ui.cfgForm.vehicleType = el.value; };
  A.CH['cf-calc'] = el => { ui.cfgForm.calcMethod = el.value; };
  A.CH['cf-elec'] = el => { ui.cfgForm.elecPrice = Math.max(0, Number(el.value) || 0); };
  A.CH['cf-elec-unit'] = el => { ui.cfgForm.elecUnit = el.value; };
  A.CH['cf-water'] = el => { ui.cfgForm.waterPrice = Math.max(0, Number(el.value) || 0); };
  A.CH['cf-water-unit'] = el => { ui.cfgForm.waterUnit = el.value; };
  A.CH['cf-lb-docno'] = el => { ui.cfgForm.legalBasis.docNo = el.value; };
  A.CH['cf-lb-docdate'] = el => { ui.cfgForm.legalBasis.docDate = el.value; };
  A.CH['cf-lb-issuer'] = el => { ui.cfgForm.legalBasis.issuer = el.value; };
  A.CH['cf-lb-effdate'] = el => { ui.cfgForm.legalBasis.effectiveDate = el.value; };
  A.CH['cf-lb-summary'] = el => { ui.cfgForm.legalBasis.summary = el.value; };
  A.CH['cf-lb-note'] = el => { ui.cfgForm.legalBasis.note = el.value; };
  A.ACT['cfg-form-save'] = () => {
    const d = ui.cfgForm, lb = d.legalBasis;
    // Handler-level gate: re-check NGAY TRƯỚC khi ghi, không chỉ dựa vào nút Lưu có hiển thị hay không.
    // Task này không cho sửa phí đã tạo; bản ghi mới luôn là draft, muốn dùng phải đi qua action Áp dụng.
    const existing = d.id ? A.SERVICE_CFG.get(d.cat, d.id) : null;
    if (d.id && !existing) return;
    if (d.id) { U.toast('Không sửa trực tiếp phí đã tạo. Hãy thêm phí mới, khóa phí cũ rồi áp dụng phí mới.'); return; }
    const isCommonLand = d.cat === 'stallPrices';
    if (isCommonLand ? !cfgCommonLandAddAllowed() : !cfgFeeAddAllowed(d.cat, null)) return;
    const targetMarket = isCommonLand ? 'ALL' : (existing ? existing.marketId : ui.market);
    if (d.marketId !== targetMarket || (!isCommonLand && (targetMarket !== 'CL' && targetMarket !== 'TTD'))) return;
    if (!Object.prototype.hasOwnProperty.call(CFG_MARKET_MODEL_LABELS, d.marketModel)
      || !Object.prototype.hasOwnProperty.call(CFG_CYCLE_LABELS, d.collectionCycle)
      || !Object.prototype.hasOwnProperty.call(CFG_TAX_LABELS, d.taxClass)) return;
    if (d.waiverTypeId && !A.SERVICE_CFG.waiverTypes().some(x => x.id === d.waiverTypeId && x.active)) return;
    if (!d.effectiveFrom) { U.toast('Vui lòng nhập ngày hiệu lực'); return; }
    if (d.effectiveTo && d.effectiveTo < d.effectiveFrom) { U.toast('Ngày hết hiệu lực không được trước ngày hiệu lực'); return; }
    if (existing && existing.status === 'active' && d.effectiveFrom <= existing.effectiveFrom) {
      U.toast('Phiên bản mới phải có ngày hiệu lực sau phiên bản đang áp dụng'); return;
    }
    const common = { marketId: targetMarket, marketModel: d.marketModel, collectionCycle: d.collectionCycle, taxClass: d.taxClass, waiverTypeId: d.waiverTypeId || null, effectiveFrom: d.effectiveFrom, effectiveTo: d.effectiveTo || null, status: 'draft', legalBasis: lb };
    let patch, detail;
    if (d.cat === 'stallPrices') {
      if (!d.area.trim() || !d.stallType.trim()) { U.toast('Vui lòng nhập đủ khu vực và loại điểm kinh doanh'); return; }
      patch = Object.assign({}, common, { area: d.area.trim(), stallType: d.stallType.trim(), amount: d.amount, unit: d.unit.trim() });
      detail = patch.amount.toLocaleString('vi-VN') + ' ' + patch.unit;
    } else if (d.cat === 'utilities') {
      patch = Object.assign({}, common, { elecPrice: d.elecPrice, elecUnit: d.elecUnit.trim(), waterPrice: d.waterPrice, waterUnit: d.waterUnit.trim() });
      detail = 'Điện ' + patch.elecPrice.toLocaleString('vi-VN') + ' ' + patch.elecUnit + ' · Nước ' + patch.waterPrice.toLocaleString('vi-VN') + ' ' + patch.waterUnit;
    } else {
      if (d.category === 'VEHICLE' && (!A.VEHICLES || !A.VEHICLES.TYPES[d.vehicleType])) { U.toast('Vui lòng chọn loại phương tiện'); return; }
      if (d.category !== 'VEHICLE' && !d.name.trim()) { U.toast('Vui lòng nhập tên dịch vụ'); return; }
      const name = d.category === 'VEHICLE' ? 'Phí gửi xe · ' + A.VEHICLES.TYPES[d.vehicleType].label : d.name.trim();
      patch = Object.assign({}, common, { name, category: d.category === 'VEHICLE' ? 'VEHICLE' : 'GENERAL', vehicleType: d.category === 'VEHICLE' ? d.vehicleType : null, calcMethod: d.calcMethod, amount: d.amount, unit: d.unit.trim() });
      detail = patch.amount.toLocaleString('vi-VN') + ' ' + patch.unit;
    }
    const actor = cfgActor();
    patch.__detail = detail;
    const active = d.cat === 'stallPrices' ? null : A.SERVICE_CFG.list(d.cat).find(r => r.status === 'active' && cfgSameFeeScope(d.cat, r, patch));
    if (active) {
      if (d.effectiveFrom <= (active.effectiveFrom || '')) return U.toast('Ngày bắt đầu mức mới phải sau mức đang áp dụng');
      const next = A.SERVICE_CFG.createVersion(d.cat, active.id, patch, actor, detail);
      if (!next) return U.toast('Không thể tạo phiên bản mới');
      U.toast('Đã tạo phiên bản mới; mức cũ được giữ trong lịch sử');
    } else {
      A.SERVICE_CFG.add(d.cat, patch, actor);
      U.toast('Đã thêm phí mới ở trạng thái Chưa áp dụng');
    }
    ui.cfgForm = null;
    A.closeModal(); A.render();
  };

  // ---- attachment (dùng chung cho mọi hạng mục) ----
  // Handler dùng chung 5 loại config (stallPrices/utilities/extraServices/billingCycle/billingRules)
  // qua `cat`. 3 nhóm giá dùng action vòng đời chung + market re-check; billingCycle/billingRules GIỮ NGUYÊN hành vi cũ (không
  // đổi ở task này — mục 11).
  function cfgAttachMutateAllowed(cat, rec) {
    if (cat === 'stallPrices') return cfgCommonLandDraftMutateAllowed(rec);
    return cfgGiaActionKey(cat) ? cfgPriceMutateAllowed(cat, rec) : true;
  }
  A.CH['cfg-att-add'] = el => {
    const file = el.files && el.files[0];
    if (!file) return;
    const rec = cfgRecord(el.dataset.cat, el.dataset.id);
    if (!rec) return;
    if (!cfgAttachMutateAllowed(el.dataset.cat, rec)) return;
    const att = { name: file.name, type: file.type || 'application/octet-stream', note: '', mock: false, url: URL.createObjectURL(file) };
    A.SERVICE_CFG.addAttachment(rec, att, cfgActor());
    reopenCfgDrawer(el.dataset.cat, el.dataset.id);
    U.toast('Đã đính kèm "' + file.name + '" (chỉ xem được trong phiên hiện tại, không upload lên máy chủ)');
  };
  A.ACT['cfg-att-view'] = el => {
    const rec = cfgRecord(el.dataset.cat, el.dataset.id);
    const a = rec && (rec.attachments || []).find(x => x.id === el.dataset.att);
    if (!a) return;
    if (a.url) {
      if ((a.type || '').indexOf('image/') === 0) A.modal(A.mHead(a.name) + `<div class="modal-b" style="text-align:center"><img src="${a.url}" style="max-width:100%;border-radius:8px"></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`);
      else window.open(a.url, '_blank');
    } else {
      A.modal(A.mHead(a.name) + `<div class="modal-b"><div class="note info">Đây là tài liệu mẫu minh hoạ (giả lập) — prototype không lưu file thật nên không có nội dung để xem trước.</div>
        <dl class="kv" style="margin-top:10px"><dt>Loại</dt><dd>${U.esc(a.type || '')}</dd><dt>Ghi chú</dt><dd>${U.esc(a.note || '—')}</dd></dl></div>
        <div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`);
    }
  };
  A.ACT['cfg-att-del'] = el => {
    const rec = cfgRecord(el.dataset.cat, el.dataset.id);
    if (!rec) return;
    if (!cfgAttachMutateAllowed(el.dataset.cat, rec)) return;
    A.SERVICE_CFG.removeAttachment(rec, el.dataset.att, cfgActor());
    reopenCfgDrawer(el.dataset.cat, el.dataset.id);
    U.toast('Đã xoá tài liệu đính kèm');
  };

  // ---- sửa căn cứ (dùng cho Kỳ thu / Quy tắc thu phí - không có form lớn riêng) ----
  function renderLegalForm() {
    const d = ui.legalForm, lb = d.legalBasis;
    A.modal(A.mHead('Sửa căn cứ') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Số văn bản</label><input class="input" data-ch="lf-docno" value="${U.esc(lb.docNo || '')}"></div>
      <div class="field"><label>Ngày ban hành</label><input class="input" type="date" data-ch="lf-docdate" value="${lb.docDate || ''}"></div>
      <div class="field"><label>Cơ quan ban hành</label><input class="input" data-ch="lf-issuer" value="${U.esc(lb.issuer || '')}"></div>
      <div class="field"><label>Ngày hiệu lực</label><input class="input" type="date" data-ch="lf-effdate" value="${lb.effectiveDate || ''}"></div>
      </div>
      <div class="field" style="margin-top:8px"><label>Trích yếu</label><input class="input" data-ch="lf-summary" value="${U.esc(lb.summary || '')}"></div>
      <div class="field" style="margin-top:8px"><label>Ghi chú</label><input class="input" data-ch="lf-note" value="${U.esc(lb.note || '')}"></div>
      </div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="cfg-legal-save">Lưu</button></div>`);
  }
  A.ACT['cfg-editlegal'] = el => {
    const rec = cfgRecord(el.dataset.cat, el.dataset.id); if (!rec) return;
    if (el.dataset.cat === 'stallPrices' && !cfgCommonLandDraftMutateAllowed(rec)) return;
    if (el.dataset.cat !== 'stallPrices' && cfgGiaActionKey(el.dataset.cat) && !cfgPriceMutateAllowed(el.dataset.cat, rec)) return;
    ui.legalForm = { cat: el.dataset.cat, id: el.dataset.id, legalBasis: Object.assign({ docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' }, rec.legalBasis) };
    renderLegalForm();
  };
  A.CH['lf-docno'] = el => { ui.legalForm.legalBasis.docNo = el.value; };
  A.CH['lf-docdate'] = el => { ui.legalForm.legalBasis.docDate = el.value; };
  A.CH['lf-issuer'] = el => { ui.legalForm.legalBasis.issuer = el.value; };
  A.CH['lf-effdate'] = el => { ui.legalForm.legalBasis.effectiveDate = el.value; };
  A.CH['lf-summary'] = el => { ui.legalForm.legalBasis.summary = el.value; };
  A.CH['lf-note'] = el => { ui.legalForm.legalBasis.note = el.value; };
  A.ACT['cfg-legal-save'] = () => {
    const d = ui.legalForm, rec = cfgRecord(d.cat, d.id);
    if (!rec) return;
    if (d.cat === 'stallPrices' && !cfgCommonLandDraftMutateAllowed(rec)) return;
    if (d.cat !== 'stallPrices' && cfgGiaActionKey(d.cat) && !cfgPriceMutateAllowed(d.cat, rec)) return;
    rec.legalBasis = d.legalBasis;
    A.SERVICE_CFG.log(rec, cfgActor(), 'Cập nhật căn cứ', d.legalBasis.docNo || '');
    ui.legalForm = null;
    A.closeModal(); A.render(); U.toast('Đã cập nhật căn cứ');
  };

  // Lịch kỳ thu (template) nay ở Thông báo đa kênh › Thiết lập tự động › Lịch nghiệp vụ; kỳ thu do hệ thống tự tạo
  // (features/finance/market-period.js). Các panel Lịch & kỳ thu / Quy tắc thu phí cũ trong Cài đặt đã retire.
  const PRICE_TABS = [['dien-nuoc', 'Điện & nước'], ['dich-vu', 'Dịch vụ chợ'], ['phi-gui-xe', 'Phí gửi xe']];
  A.VIEWS['cau-hinh-gia'] = function () {
    const tab = PRICE_TABS.some(t => t[0] === ui.cfgTab) ? ui.cfgTab : 'dien-nuoc';
    const common = `<section style="margin-bottom:18px"><div class="card-h" style="padding:0 0 8px"><div><h2 style="margin:0">Chính sách thu & biểu phí</h2><div class="small muted">Quản lý căn cứ áp dụng và mức thu theo từng chợ.</div></div></div><div class="note info" style="margin-bottom:12px">Chợ đang xem: <b>${U.esc(U.market(ui.market).name)}</b>. Phạm vi chợ tuân theo tài khoản hiện tại.</div>${settingsGiaHtml()}</section>`;
    const bar = `<div class="seg" style="margin:12px 0 14px">${PRICE_TABS.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="cfg-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`;
    const local = `<section><div class="card-h" style="padding:0 0 8px"><div><h3 style="margin:0">Các khoản thu vận hành</h3><div class="small muted">Cấu hình theo chợ, có lịch sử phiên bản; mức đã phát sinh không bị sửa đè.</div></div></div>${bar}${tab === 'dien-nuoc' ? settingsDienNuocHtml() : tab === 'dich-vu' ? settingsDichVuHtml() : settingsVehicleHtml()}</section>`;
    return common + local;
  };
  A.ACT['cfg-tab'] = el => { ui.cfgTab = el.dataset.id === 'gia' ? 'dien-nuoc' : el.dataset.id; A.render(); };
  // Bieu phi theo cho: chi presentation/configuration, khong goi engine lap khoan phai thu.
  const POLICY_TABS = [['land', 'Mặt bằng'], ['electricity', 'Điện'], ['water', 'Nước'], ['service', 'Dịch vụ']];
  const policyToday = () => A.db.today || U.today();
  const policyState = r => r.status === 'expired' || (r.effectiveTo && r.effectiveTo < policyToday()) ? '<span class="tag">Hết hiệu lực</span>' : r.status !== 'active' || (r.effectiveFrom && r.effectiveFrom > policyToday()) ? '<span class="tag warn">Sắp áp dụng</span>' : '<span class="tag ok">Đang áp dụng</span>';
  const policyEffective = r => U.dmy(r.effectiveFrom) + (r.effectiveTo ? '<div class="small muted">đến ' + U.dmy(r.effectiveTo) + '</div>' : '');
  const policyNote = r => U.esc((r.legalBasis || {}).docNo || (r.legalBasis || {}).note || '—');
  const policyActive = rows => rows.filter(r => r.status === 'active' && (!r.effectiveFrom || r.effectiveFrom <= policyToday()) && (!r.effectiveTo || r.effectiveTo >= policyToday()));
  const policyLandRows = () => A.SERVICE_CFG.list('stallPrices').filter(r => r.marketId === ui.market);
  const policyUtilityRows = () => A.SERVICE_CFG.list('utilities').filter(r => r.marketId === ui.market);
  const policyServiceRows = () => A.SERVICE_CFG.list('extraServices').filter(r => r.marketId === ui.market && r.category !== 'VEHICLE' && !/gửi xe/i.test(r.name || ''));
  function policyAreaTypes() { return Array.from(new Set((A.db.stalls || []).filter(s => s.market === ui.market && s.areaTypeId).map(s => s.areaTypeId))).map(id => ({ id, label: U.areaTypeLabel(id) || id })); }
  function policyHistoryModal(cat, id, key) {
    const r = A.SERVICE_CFG.get(cat, id); if (!r) return;
    const rows = A.SERVICE_CFG.list(cat).filter(x => x.marketId === r.marketId && (!key || x[key] === r[key])).sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')));
    const val = x => cat === 'utilities' ? (key === 'elecPrice' ? x.elecPrice : x.waterPrice) : x.amount;
    const unit = x => cat === 'utilities' ? (key === 'elecPrice' ? x.elecUnit : x.waterUnit) : x.unit;
    A.modal(A.mHead('Lịch sử mức phí') + `<div class="modal-b">${U.table([{t:'Hiệu lực'},{t:'Mức thu',num:true},{t:'Trạng thái'},{t:'Căn cứ/Ghi chú'}], rows.map(x => `<tr><td>${policyEffective(x)}</td><td class="num">${Number(val(x) || 0).toLocaleString('vi-VN')}<div class="small muted">${U.esc(unit(x) || '')}</div></td><td>${policyState(x)}</td><td class="small">${policyNote(x)}</td></tr>`), {empty:'Chưa có lịch sử mức phí'})}</div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`);
  }
  // ---- Đơn giá mặt bằng dùng chung nhiều chợ (DON_GIA_MAT_BANG_DUNG_CHUNG, 01/10/2026) ----
  // Account → Role → screen:cau-hinh-gia (xem) → action:cau-hinh-gia.them-phi (thêm, market_manager) →
  // marketScopes: mỗi chợ trong marketIds[] phải thuộc A.allowedMarkets(account). A.canDo(action, market) chỉ khớp
  // SelectedMarket nên mức áp dụng nhiều chợ kiểm marketScopes riêng (cùng cách màn Đối soát). Không quyền mới.
  const landMarkets = () => typeof A.effectiveMarkets === 'function' ? A.effectiveMarkets() : D.MARKETS;
  const landAllowed = () => new Set(A.allowedMarkets(A.currentAccount()));
  const landGrade = m => { const x = /hạng\s*(\d)/i.exec((m && m.hang) || ''); return x ? Number(x[1]) : null; };
  const landMarketIds = r => r.scope === 'SHARED' ? (r.marketIds || []) : (r.marketId ? [r.marketId] : []);
  const landName = r => (r.areaTypeId ? (U.areaTypeLabel(r.areaTypeId) || r.areaTypeId) : r.landTypeName || r.stallType) || '—';
  const landGrades = r => (r.marketGrades && r.marketGrades.length ? r.marketGrades : Array.from(new Set(landMarketIds(r).map(id => landGrade(landMarkets().find(m => m.id === id))).filter(Boolean)))).slice().sort();
  const landGradeText = r => { const g = landGrades(r); return g.length ? 'Hạng ' + g.join(', ') : '—'; };
  // KHOA_GIA_THEO_HOP_DONG: số hợp đồng còn hiệu lực đã khóa mức giá này (priceTerms), chỉ đếm HĐ thuộc marketScopes.
  function priceContractCount(cat, r) {
    if (!r) return 0;
    const billing = A.features.finance && A.features.finance.billing, allowed = landAllowed(), today = policyToday();
    return (A.db.contracts || []).filter(c => (c.status === 'ACTIVE' || c.status === 'hieuluc') && (!c.end || c.end >= today) && allowed.has(c.market)).filter(c => {
      const t = c.priceTerms || (billing && billing.freezeContractTerms ? billing.freezeContractTerms(c) : null);
      if (!t) return false;
      if (cat === 'stallPrices') return !!t.land && t.land.policyId === r.id;
      if (cat === 'utilities') return ['electricity', 'water'].some(k => t[k] && t[k].policyId === r.id);
      return (t.services || []).some(x => x.serviceId === r.id);
    }).length;
  }
  const priceUsageHtml = (cat, r) => `<div class="note info" style="margin-bottom:12px">Hợp đồng đang dùng: <b>${priceContractCount(cat, r)} hợp đồng</b></div>`;
  function landState(r) {
    const t = policyToday();
    if (r.status === 'inactive') return ['Vô hiệu hóa', 'danger', 3];
    if (r.status === 'expired' || (r.effectiveTo && r.effectiveTo < t)) return ['Hết hiệu lực', '', 2];
    if (r.status !== 'active' || (r.effectiveFrom && r.effectiveFrom > t)) return ['Chưa có hiệu lực', 'warn', 1];
    return ['Đang có hiệu lực', 'ok', 0];
  }
  function landRows() {
    const allowed = landAllowed();
    return A.SERVICE_CFG.list('stallPrices').filter(r => landMarketIds(r).some(id => allowed.has(id)))
      .sort((a, b) => landState(a)[2] - landState(b)[2] || String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')));
  }
  function landPriceHtml(r) {
    const amount = Number(r.amount || 0), unit = r.unit || 'đ/m²/ngày';
    return unit === 'đ/m²/ngày' ? `${amount.toLocaleString('vi-VN')} đ/m²/ngày<div class="small muted">≈ ${(amount * 30).toLocaleString('vi-VN')} đ/m²/tháng</div>` : `${amount.toLocaleString('vi-VN')} ${U.esc(unit)}`;
  }
  const landCanAdd = () => U.can('cau-hinh-gia') && A.canDo('cau-hinh-gia.them-phi') && landMarkets().some(m => landAllowed().has(m.id));
  function policyLandHtml() {
    const rows = landRows(), can = landCanAdd();
    return `<div class="card"><div class="card-h"><div><h3>Đơn giá mặt bằng</h3><div class="small muted">Mỗi mức giá áp dụng cho một hoặc nhiều chợ theo hạng chợ và căn cứ ban hành. Thu trước cho tháng tiếp theo.</div></div>${can ? '<button class="btn sm primary" data-act="policy-land-new">+ Thêm đơn giá</button>' : ''}</div><div class="card-b">${U.table([{t:'STT'},{t:'Loại điểm kinh doanh'},{t:'Đơn giá',num:true},{t:'Hạng chợ áp dụng'},{t:'Trạng thái áp dụng'},{t:'Có hiệu lực từ'},{t:''}], rows.map((r, i) => { const s = landState(r); return `<tr><td>${i + 1}</td><td><b>${U.esc(landName(r))}</b></td><td class="num">${landPriceHtml(r)}</td><td>${landGradeText(r)}</td><td><span class="tag ${s[1]}">${s[0]}</span></td><td>${U.dmy(r.effectiveFrom)}</td><td><button class="btn sm" data-act="policy-land-view" data-id="${U.esc(r.id)}">Xem chi tiết</button></td></tr>`; }), {empty:'Chưa có đơn giá mặt bằng cho các chợ trong phạm vi tài khoản.'})}<div class="note info" style="margin-top:12px"><b>Cách tính</b><br>Phí mặt bằng = Đơn giá × Diện tích điểm KD × Số ngày của tháng được thu. Quy đổi tháng ở cột Đơn giá tính theo 30 ngày để tham khảo.</div></div></div>`;
  }
  // Căn cứ = 1 tệp PDF hoặc ảnh quyết định/công văn (mock: object URL, chỉ xem được trong phiên hiện tại).
  const LAND_FILE_ACCEPT = 'application/pdf,image/*';
  const landFileOk = file => !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '') || (file.type || '').indexOf('image/') === 0);
  const landAttachment = file => ({ name: file.name, type: file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : 'application/octet-stream'), size: file.size, note: '', mock: false, url: URL.createObjectURL(file) });
  // Sửa căn cứ của bản ghi có sẵn: cùng quyền thêm + MỌI chợ của bản ghi thuộc marketScopes.
  const landCanEdit = r => !!r && U.can('cau-hinh-gia') && A.canDo('cau-hinh-gia.them-phi') && landMarketIds(r).length > 0 && landMarketIds(r).every(id => landAllowed().has(id));
  const landFileRow = (a, r, pending) => {
    const img = a.url && (a.type || '').indexOf('image/') === 0;
    return `<div class="row" style="gap:10px;padding:6px 0;border-bottom:1px solid #eef2f7">${img ? `<img src="${a.url}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb">` : `<span style="font-size:22px">${cfgAttachIcon(a.type)}</span>`}<span style="flex:1">${U.esc(a.name)}${pending ? ' <span class="tag warn">Chưa lưu</span>' : ''}</span>${pending ? '' : `<button class="btn sm" data-act="cfg-att-view" data-cat="stallPrices" data-id="${U.esc(r.id)}" data-att="${U.esc(a.id)}">Xem</button>`}</div>`;
  };
  function landEvidenceHtml(r, canEdit, pending) {
    const list = r.attachments || [], lb = r.legalBasis || {};
    const items = list.map(a => landFileRow(a, r, false)).join('') + pending.map(a => landFileRow(a, r, true)).join('');
    const legacy = !items && lb.docNo ? `<div class="small muted">Đã ghi nhận văn bản ${U.esc(lb.docNo)} nhưng chưa đính kèm tệp.</div>` : '';
    return `${items || legacy || '<div class="small muted">Chưa có tệp căn cứ.</div>'}${canEdit ? `<label class="btn sm" style="cursor:pointer;margin-top:8px;display:inline-flex">${list.length || pending.length ? 'Chọn thêm tệp căn cứ' : '+ Chọn tệp căn cứ (PDF / ảnh)'}<input type="file" accept="${LAND_FILE_ACCEPT}" style="display:none" data-ch="land-att-add" data-id="${U.esc(r.id)}"></label>` : ''}`;
  }
  function landDetail(id) {
    const r = A.SERVICE_CFG.get('stallPrices', id), allowed = landAllowed();
    if (!r || !landMarketIds(r).some(x => allowed.has(x))) return U.toast('Không tìm thấy đơn giá trong phạm vi chợ của tài khoản.');
    const s = landState(r), names = landMarketIds(r).map(x => (landMarkets().find(m => m.id === x) || {}).name || x);
    const draft = ui.landEvidenceDraft && ui.landEvidenceDraft.id === r.id ? ui.landEvidenceDraft.files : [], canEdit = landCanEdit(r);
    const off = r.status === 'inactive' ? `<dt>Vô hiệu hóa</dt><dd>${U.dmy(r.deactivatedAt) || '—'} · ${U.esc(r.deactivatedBy || '—')}</dd>` : '';
    A.modal(A.mHead('Chi tiết đơn giá mặt bằng') + `<div class="modal-b">${priceUsageHtml('stallPrices', r)}<dl class="kv"><dt>Loại điểm kinh doanh</dt><dd><b>${U.esc(landName(r))}</b></dd><dt>Đơn giá</dt><dd>${landPriceHtml(r)}</dd><dt>Hạng chợ áp dụng</dt><dd>${landGradeText(r)}</dd><dt>Các chợ đang áp dụng</dt><dd>${names.length} chợ: ${names.map(U.esc).join(', ')}</dd><dt>Trạng thái áp dụng</dt><dd><span class="tag ${s[1]}">${s[0]}</span></dd>${off}<dt>Có hiệu lực từ</dt><dd>${U.dmy(r.effectiveFrom)}</dd><dt>Ngày kết thúc</dt><dd>${r.effectiveTo ? U.dmy(r.effectiveTo) : 'Chưa kết thúc'}</dd></dl><h4 style="margin:16px 0 6px">Căn cứ quyết định / công văn</h4>${landEvidenceHtml(r, canEdit, draft)}<h4 style="margin:16px 0 6px">Lịch sử thay đổi</h4>${cfgHistoryHtml(r)}</div><div class="modal-f"><span class="spacer"></span><button class="btn" data-act="close">Đóng</button>${canEdit && draft.length ? `<button class="btn primary" data-act="policy-land-evidence-save" data-id="${U.esc(r.id)}">Lưu</button>` : ''}</div>`, true);
  }
  A.ACT['policy-land-view'] = el => { if (!U.can('cau-hinh-gia')) return; ui.landEvidenceDraft = null; landDetail(el.dataset.id); };
  // Chọn tệp chỉ đưa vào bản nháp; bấm "Lưu" mới ghi vào đơn giá + lịch sử.
  A.CH['land-att-add'] = el => {
    const file = el.files && el.files[0], r = A.SERVICE_CFG.get('stallPrices', el.dataset.id);
    if (!file || !r) return;
    if (!landCanEdit(r)) return U.toast('Bạn không có quyền cập nhật căn cứ của đơn giá này.');
    if (!landFileOk(file)) return U.toast('Chỉ nhận tệp PDF hoặc ảnh.');
    if (!ui.landEvidenceDraft || ui.landEvidenceDraft.id !== r.id) ui.landEvidenceDraft = { id: r.id, files: [] };
    ui.landEvidenceDraft.files.push(landAttachment(file));
    landDetail(r.id);
  };
  A.ACT['policy-land-evidence-save'] = el => {
    const r = A.SERVICE_CFG.get('stallPrices', el.dataset.id), d = ui.landEvidenceDraft;
    if (!r || !d || d.id !== r.id || !d.files.length) return;
    if (!landCanEdit(r)) return U.toast('Bạn không có quyền cập nhật căn cứ của đơn giá này.');
    d.files.forEach(a => A.SERVICE_CFG.addAttachment(r, a, cfgActor()));
    const n = d.files.length; ui.landEvidenceDraft = null; landDetail(r.id);
    U.toast('Đã lưu ' + n + ' tệp căn cứ (chỉ xem được trong phiên hiện tại, không upload lên máy chủ).');
  };
  // Form: Hạng chợ → các chợ áp dụng (tự suy ra, không tích tay) → loại diện tích đã khai báo ở Danh mục chợ.
  const landAreaTypesOf = mid => { const st = A.features.marketLayout && A.features.marketLayout.store; return st && st.allowedAreaTypes ? st.allowedAreaTypes(mid) : (U.AREA_TYPE_CODES || []); };
  const landGradeMarkets = grades => { const allowed = landAllowed(); return landMarkets().filter(m => allowed.has(m.id) && grades.includes(landGrade(m))); };
  function landFormScope(f) {
    const byGrade = landGradeMarkets(f.grades), types = Array.from(new Set(byGrade.flatMap(m => landAreaTypesOf(m.id)))).filter(t => (U.AREA_TYPE_CODES || []).includes(t));
    const markets = f.areaTypeId ? byGrade.filter(m => landAreaTypesOf(m.id).includes(f.areaTypeId)) : byGrade;
    return { byGrade, types, markets, skipped: f.areaTypeId ? byGrade.filter(m => !markets.includes(m)) : [] };
  }
  function landFormHtml() {
    const f = ui.landForm, sc = landFormScope(f), chk = on => on ? 'checked' : '';
    if (f.areaTypeId && !sc.types.includes(f.areaTypeId)) f.areaTypeId = '';
    const grades = [1, 2, 3].map(g => `<label class="row" style="gap:6px"><input type="checkbox" data-ch="land-grade" value="${g}" ${chk(f.grades.includes(g))}> Hạng ${g}</label>`).join('');
    const typeSelect = `<select class="input" data-ch="land-area-type" ${f.grades.length ? '' : 'disabled'}><option value="">${f.grades.length ? 'Chọn loại diện tích' : 'Chọn hạng chợ trước'}</option>${sc.types.map(t => `<option value="${t}" ${f.areaTypeId === t ? 'selected' : ''}>${U.esc(U.areaTypeLabel(t) || t)}</option>`).join('')}</select>`;
    const marketList = !f.grades.length ? '<div class="small muted">Chọn hạng chợ để hệ thống hiển thị các chợ áp dụng.</div>'
      : sc.markets.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:2px 24px">${sc.markets.map(m => `<div>✓ ${U.esc(m.name)} <span class="small muted">· ${U.esc(m.hang || '—')}</span></div>`).join('')}</div>${sc.skipped.length ? `<div class="small muted" style="margin-top:6px">Không áp dụng (chợ chưa khai báo loại diện tích này ở Danh mục chợ): ${sc.skipped.map(m => U.esc(m.name)).join(', ')}</div>` : ''}`
      : '<div class="small muted">Không có chợ nào trong phạm vi tài khoản thuộc hạng đã chọn.</div>';
    const file = f.file ? `<div class="row" style="gap:8px;margin-top:6px"><span>${cfgAttachIcon(f.file.type)}</span><span>${U.esc(f.file.name)}</span></div>` : '';
    A.modal(A.mHead('Thêm đơn giá mặt bằng') + `<div class="modal-b"><div class="form-grid"><div class="field"><label>Hạng chợ áp dụng *</label><div class="row" style="gap:14px;flex-wrap:wrap">${grades}</div></div><div class="field"><label>Loại điểm kinh doanh *</label>${typeSelect}<div class="small muted">Lấy từ loại diện tích đã khai báo cho chợ ở Danh mục chợ.</div></div><div class="field"><label>Đơn giá (đ/m²/ngày) *</label><input class="input" type="number" min="0" data-ch="land-amount" value="${f.amount || ''}"><div class="small muted">≈ ${(Number(f.amount || 0) * 30).toLocaleString('vi-VN')} đ/m²/tháng (30 ngày)</div></div><div class="field"></div><div class="field"><label>Có hiệu lực từ *</label><input class="input" type="date" data-ch="land-from" value="${f.effectiveFrom}"></div><div class="field"><label>Ngày kết thúc</label><input class="input" type="date" data-ch="land-to" value="${f.effectiveTo || ''}"><div class="small muted">Để trống = chưa kết thúc.</div></div></div><div class="field" style="margin-top:10px"><label>Các chợ áp dụng <span class="small muted">(tự động theo hạng chợ, trong phạm vi tài khoản)</span></label>${marketList}</div><div class="field" style="margin-top:10px"><label>Căn cứ quyết định / công văn * <span class="small muted">(1 tệp PDF hoặc ảnh)</span></label><label class="btn sm" style="cursor:pointer;display:inline-flex;width:max-content">${f.file ? 'Đổi tệp' : '+ Tải tệp PDF / ảnh'}<input type="file" accept="${LAND_FILE_ACCEPT}" style="display:none" data-ch="land-file"></label>${file}</div><div class="small muted" style="margin-top:10px">Lịch sử thay đổi được hệ thống ghi tự động (người thực hiện, thời điểm, nội dung).</div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="policy-land-save">Lưu đơn giá</button></div>`, true);
  }
  A.ACT['policy-land-new'] = () => {
    if (!landCanAdd()) return U.toast('Bạn không có quyền thêm đơn giá mặt bằng.');
    ui.landForm = { grades: [], areaTypeId: '', amount: 0, effectiveFrom: policyToday(), effectiveTo: '', file: null };
    landFormHtml();
  };
  A.CH['land-grade'] = el => { const f = ui.landForm, g = Number(el.value); f.grades = el.checked ? Array.from(new Set(f.grades.concat([g]))).sort() : f.grades.filter(x => x !== g); landFormHtml(); };
  A.CH['land-area-type'] = el => { ui.landForm.areaTypeId = el.value; landFormHtml(); };
  A.CH['land-amount'] = el => { ui.landForm.amount = Math.max(0, Number(el.value) || 0); landFormHtml(); };
  A.CH['land-from'] = el => { ui.landForm.effectiveFrom = el.value; };
  A.CH['land-to'] = el => { ui.landForm.effectiveTo = el.value; };
  A.CH['land-file'] = el => {
    const file = el.files && el.files[0]; if (!file) return;
    if (!landFileOk(file)) return U.toast('Chỉ nhận tệp PDF hoặc ảnh.');
    ui.landForm.file = landAttachment(file); landFormHtml();
  };
  A.ACT['policy-land-save'] = () => {
    const f = ui.landForm; if (!f) return;
    // Kiểm tra lại quyền + marketScopes trong handler (không chỉ dựa vào việc ẩn nút).
    if (!U.can('cau-hinh-gia') || !A.canDo('cau-hinh-gia.them-phi')) return U.toast('Bạn không có quyền thêm đơn giá mặt bằng.');
    const sc = landFormScope(f), allowed = landAllowed(), marketIds = sc.markets.map(m => m.id);
    if (!f.grades.length) return U.toast('Vui lòng chọn hạng chợ áp dụng.');
    if (!f.areaTypeId || !sc.types.includes(f.areaTypeId)) return U.toast('Vui lòng chọn loại điểm kinh doanh đã khai báo cho chợ.');
    if (!marketIds.length) return U.toast('Không có chợ nào áp dụng cho hạng và loại diện tích đã chọn.');
    if (marketIds.some(id => !allowed.has(id))) return U.toast('Có chợ nằm ngoài phạm vi chợ của tài khoản.');
    if (!(f.amount > 0)) return U.toast('Đơn giá phải lớn hơn 0.');
    if (!f.effectiveFrom) return U.toast('Vui lòng nhập ngày có hiệu lực.');
    if (f.effectiveTo && f.effectiveTo < f.effectiveFrom) return U.toast('Ngày kết thúc phải sau ngày có hiệu lực.');
    if (!f.file) return U.toast('Vui lòng tải lên tệp PDF hoặc ảnh quyết định / công văn làm căn cứ.');
    const actor = cfgActor(), label = U.areaTypeLabel(f.areaTypeId) || f.areaTypeId;
    // Kiểm tra trùng theo loại điểm kinh doanh: bảng không có 2 mức đang áp dụng cho cùng 1 loại → mức cũ (còn hiệu
    // lực hoặc chưa tới hiệu lực, hiển thị trong phạm vi tài khoản) tự chuyển Vô hiệu hóa. Không vô hiệu hóa giá của
    // chợ ngoài marketScopes — khi đó chặn lưu.
    const today = policyToday();
    const dup = landRows().filter(r => r.status === 'active' && r.areaTypeId === f.areaTypeId && !(r.effectiveTo && r.effectiveTo < today));
    const foreign = dup.find(r => landMarketIds(r).some(id => !allowed.has(id)));
    if (foreign) return U.toast('Mức "' + label + '" đang áp dụng cả cho chợ ngoài phạm vi tài khoản nên không thể tự vô hiệu hóa. Liên hệ người quản lý các chợ đó.');
    dup.forEach(r => A.SERVICE_CFG.update('stallPrices', r.id, { status: 'inactive', deactivatedAt: today, deactivatedBy: actor }, actor, 'Vô hiệu hóa', 'Trùng loại điểm kinh doanh — được thay bằng mức ' + f.amount.toLocaleString('vi-VN') + ' đ/m²/ngày có hiệu lực từ ' + U.dmy(f.effectiveFrom)));
    const overlap = dup;
    const rec = { scope: 'SHARED', marketId: null, marketIds, areaTypeId: f.areaTypeId, marketGrades: f.grades.slice(), amount: f.amount, unit: 'đ/m²/ngày',
      effectiveFrom: f.effectiveFrom, effectiveTo: f.effectiveTo || null, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: f.effectiveFrom, note: '' },
      __detail: label + ' · ' + f.amount.toLocaleString('vi-VN') + ' đ/m²/ngày · ' + marketIds.length + ' chợ · căn cứ: ' + f.file.name };
    A.SERVICE_CFG.add('stallPrices', rec, actor); delete rec.__detail;
    A.SERVICE_CFG.addAttachment(rec, f.file, actor);
    ui.landForm = null; A.closeModal(); A.render(); U.toast('Đã lưu đơn giá mặt bằng.' + (overlap.length ? ' Mức cũ cùng loại điểm kinh doanh đã chuyển sang Vô hiệu hóa.' : ''));
  };
  // ---- Đơn giá điện / nước / dịch vụ theo từng chợ (DON_GIA_THEO_CHO, 01/10/2026) ----
  // Mỗi dòng giá thuộc 1 chợ (marketId — market applicability sẵn có, billing đọc theo chợ). Không quyền mới:
  // thêm + lưu căn cứ = action:cau-hinh-gia.them-phi; vô hiệu hóa = action:cau-hinh-gia.khoa-mo-phi; chợ của dòng giá
  // phải thuộc A.allowedMarkets(account) (kiểm tra lại trong handler; canDo(action, market) chỉ khớp SelectedMarket).
  const FEE_TABS = {
    electricity: { cat: 'utilities', kind: 'ELECTRICITY', field: 'elecPrice', unitField: 'elecUnit', unit: 'đ/kWh', title: 'Đơn giá điện', noun: 'điện', formula: '<b>Tiền điện</b> = (Chỉ số điện kỳ này − Chỉ số điện kỳ trước) × Đơn giá điện của chợ.' },
    water: { cat: 'utilities', kind: 'WATER', field: 'waterPrice', unitField: 'waterUnit', unit: 'đ/m³', title: 'Đơn giá nước', noun: 'nước', formula: '<b>Tiền nước</b> = (Chỉ số nước kỳ này − Chỉ số nước kỳ trước) × Đơn giá nước của chợ.' },
    service: { cat: 'extraServices', field: 'amount', unitField: 'unit', title: 'Đơn giá dịch vụ', noun: 'dịch vụ', formula: 'Hợp đồng có đăng ký Dịch vụ cộng toàn bộ dịch vụ đang có hiệu lực của chợ. <b>Cố định</b> = mức thu/tháng; <b>Theo diện tích</b> = mức thu × diện tích điểm KD.' }
  };
  const FEE_CALC = { fixed: ['Cố định theo tháng', 'đ/tháng'], area: ['Theo diện tích', 'đ/m²/tháng'] };
  const feeScopeMarkets = () => { const allowed = landAllowed(); return landMarkets().filter(m => allowed.has(m.id)); };
  const feeMarketName = id => (landMarkets().find(m => m.id === id) || {}).name || id;
  // Bộ lọc luôn là 1 chợ cụ thể (bảng không có cột Chợ): mặc định SelectedMarket, nếu ngoài phạm vi thì chợ đầu tiên.
  const feeFilter = () => { const ids = feeScopeMarkets().map(m => m.id), v = ui.feeMarketFilter || ui.market; return ids.includes(v) ? v : (ids.includes(ui.market) ? ui.market : ids[0] || ''); };
  const feeInScope = r => !!r && !!r.marketId && landAllowed().has(r.marketId);
  const feeOfTab = (tab, r) => { const c = FEE_TABS[tab]; return c.cat === 'utilities' ? (r.kind ? r.kind === c.kind : r[c.field] != null) : r.category !== 'VEHICLE' && !/gửi xe/i.test(r.name || ''); };
  function feeRows(tab, market) {
    const c = FEE_TABS[tab];
    return A.SERVICE_CFG.list(c.cat).filter(r => feeInScope(r) && feeOfTab(tab, r) && (market === 'all' || r.marketId === market))
      .sort((a, b) => String(a.marketId).localeCompare(String(b.marketId)) || landState(a)[2] - landState(b)[2] || String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')));
  }
  const feeTabOf = (cat, r) => cat === 'extraServices' ? 'service' : (r.kind === 'WATER' || (!r.kind && r.elecPrice == null) ? 'water' : 'electricity');
  function feePriceHtml(tab, r) { const c = FEE_TABS[tab]; return `${Number(r[c.field] || 0).toLocaleString('vi-VN')} ${U.esc(r[c.unitField] || c.unit || '')}`; }
  const feeCanAdd = () => U.can('cau-hinh-gia') && A.canDo('cau-hinh-gia.them-phi') && feeScopeMarkets().length > 0;
  const feeCanEdit = r => feeInScope(r) && U.can('cau-hinh-gia') && A.canDo('cau-hinh-gia.them-phi');
  const feeCanDisable = r => feeInScope(r) && r.status === 'active' && landState(r)[2] !== 2 && U.can('cau-hinh-gia') && A.canDo('cau-hinh-gia.khoa-mo-phi');
  function feeTabHtml(tab) {
    const c = FEE_TABS[tab], filter = feeFilter(), rows = feeRows(tab, filter), svc = tab === 'service';
    const opts = feeScopeMarkets().map(m => `<option value="${U.esc(m.id)}" ${filter === m.id ? 'selected' : ''}>${U.esc(m.name)}</option>`).join('');
    const cols = [{t:'STT'}].concat(svc ? [{t:'Tên dịch vụ'},{t:'Cách tính'}] : []).concat([{t:'Đơn giá',num:true},{t:'Trạng thái áp dụng'},{t:'Có hiệu lực từ'},{t:''}]);
    const body = rows.map((r, i) => { const s = landState(r); return `<tr><td>${i + 1}</td>${svc ? `<td><b>${U.esc(r.name || '—')}</b></td><td>${U.esc((FEE_CALC[r.calcMethod] || [CFG_CALC_LABELS[r.calcMethod] || r.calcMethod || '—'])[0])}</td>` : ''}<td class="num"><b>${feePriceHtml(tab, r)}</b></td><td><span class="tag ${s[1]}">${s[0]}</span></td><td>${U.dmy(r.effectiveFrom)}</td><td><button class="btn sm" data-act="fee-view" data-cat="${c.cat}" data-id="${U.esc(r.id)}">Xem chi tiết</button></td></tr>`; });
    const missing = filter && !rows.some(r => landState(r)[2] === 0) ? `<div class="note warn" style="margin-bottom:10px">${U.esc(feeMarketName(filter))} chưa có ${c.noun === 'dịch vụ' ? 'dịch vụ' : 'đơn giá ' + c.noun} đang có hiệu lực.</div>` : '';
    return `<div class="card"><div class="card-h"><div><h3>${c.title}</h3><div class="small muted">Mỗi chợ khai báo đơn giá ${c.noun} riêng; lọc theo chợ để xem.</div></div><span class="spacer"></span><label class="small" style="margin-right:6px">Chợ</label><select class="input" style="min-width:220px" data-ch="fee-market-filter">${opts}</select>${feeCanAdd() ? `<button class="btn sm primary" style="margin-left:8px" data-act="fee-new" data-tab="${tab}">+ Thêm đơn giá</button>` : ''}</div><div class="card-b">${missing}${U.table(cols, body, {empty:'Chưa có đơn giá ' + c.noun + ' cho chợ đã chọn.'})}<div class="note info" style="margin-top:12px">${c.formula}</div></div></div>`;
  }
  A.CH['fee-market-filter'] = el => { ui.feeMarketFilter = el.value; A.render(); };
  // Chi tiết + căn cứ (chọn tệp → "Lưu") + vô hiệu hóa — cùng cách làm với Đơn giá mặt bằng.
  function feeDetail(cat, id) {
    const r = A.SERVICE_CFG.get(cat, id);
    if (!feeInScope(r)) return U.toast('Không tìm thấy đơn giá trong phạm vi chợ của tài khoản.');
    const tab = feeTabOf(cat, r), c = FEE_TABS[tab], s = landState(r), svc = tab === 'service';
    const draft = ui.feeEvidenceDraft && ui.feeEvidenceDraft.id === r.id ? ui.feeEvidenceDraft.files : [], canEdit = feeCanEdit(r), canDisable = feeCanDisable(r);
    const list = r.attachments || [], rowsHtml = list.map(a => landFileRow(a, r, false).replace('data-cat="stallPrices"', `data-cat="${cat}"`)).join('') + draft.map(a => landFileRow(a, r, true)).join('');
    const evidence = `${rowsHtml || '<div class="small muted">Chưa có tệp căn cứ.</div>'}${canEdit ? `<label class="btn sm" style="cursor:pointer;margin-top:8px;display:inline-flex">${rowsHtml ? 'Chọn thêm tệp căn cứ' : '+ Chọn tệp căn cứ (PDF / ảnh)'}<input type="file" accept="${LAND_FILE_ACCEPT}" style="display:none" data-ch="fee-att-add" data-cat="${cat}" data-id="${U.esc(r.id)}"></label>` : ''}`;
    const off = r.status === 'inactive' ? `<dt>Vô hiệu hóa</dt><dd>${U.dmy(r.deactivatedAt) || '—'} · ${U.esc(r.deactivatedBy || '—')}</dd>` : '';
    A.modal(A.mHead('Chi tiết ' + c.title.toLowerCase()) + `<div class="modal-b">${priceUsageHtml(cat, r)}<dl class="kv"><dt>Chợ</dt><dd><b>${U.esc(feeMarketName(r.marketId))}</b></dd>${svc ? `<dt>Tên dịch vụ</dt><dd>${U.esc(r.name || '—')}</dd><dt>Cách tính</dt><dd>${U.esc((FEE_CALC[r.calcMethod] || [r.calcMethod || '—'])[0])}</dd>` : ''}<dt>Đơn giá</dt><dd>${feePriceHtml(tab, r)}</dd><dt>Trạng thái áp dụng</dt><dd><span class="tag ${s[1]}">${s[0]}</span></dd>${off}<dt>Có hiệu lực từ</dt><dd>${U.dmy(r.effectiveFrom)}</dd><dt>Ngày kết thúc</dt><dd>${r.effectiveTo ? U.dmy(r.effectiveTo) : 'Chưa kết thúc'}</dd></dl><h4 style="margin:16px 0 6px">Căn cứ quyết định / công văn</h4>${evidence}<h4 style="margin:16px 0 6px">Lịch sử thay đổi</h4>${cfgHistoryHtml(r)}</div><div class="modal-f">${canDisable ? `<button class="btn danger" data-act="fee-disable-open" data-cat="${cat}" data-id="${U.esc(r.id)}">Vô hiệu hóa</button><span class="spacer"></span>` : ''}<button class="btn" data-act="close">Đóng</button>${canEdit && draft.length ? `<button class="btn primary" data-act="fee-evidence-save" data-cat="${cat}" data-id="${U.esc(r.id)}">Lưu</button>` : ''}</div>`, true);
  }
  A.ACT['fee-view'] = el => { if (!U.can('cau-hinh-gia')) return; ui.feeEvidenceDraft = null; feeDetail(el.dataset.cat, el.dataset.id); };
  A.CH['fee-att-add'] = el => {
    const file = el.files && el.files[0], r = A.SERVICE_CFG.get(el.dataset.cat, el.dataset.id);
    if (!file || !r) return;
    if (!feeCanEdit(r)) return U.toast('Bạn không có quyền cập nhật căn cứ của đơn giá này.');
    if (!landFileOk(file)) return U.toast('Chỉ nhận tệp PDF hoặc ảnh.');
    if (!ui.feeEvidenceDraft || ui.feeEvidenceDraft.id !== r.id) ui.feeEvidenceDraft = { id: r.id, files: [] };
    ui.feeEvidenceDraft.files.push(landAttachment(file)); feeDetail(el.dataset.cat, r.id);
  };
  A.ACT['fee-evidence-save'] = el => {
    const r = A.SERVICE_CFG.get(el.dataset.cat, el.dataset.id), d = ui.feeEvidenceDraft;
    if (!r || !d || d.id !== r.id || !d.files.length) return;
    if (!feeCanEdit(r)) return U.toast('Bạn không có quyền cập nhật căn cứ của đơn giá này.');
    d.files.forEach(a => A.SERVICE_CFG.addAttachment(r, a, cfgActor()));
    const n = d.files.length; ui.feeEvidenceDraft = null; feeDetail(el.dataset.cat, r.id);
    U.toast('Đã lưu ' + n + ' tệp căn cứ (chỉ xem được trong phiên hiện tại, không upload lên máy chủ).');
  };
  A.ACT['fee-disable-open'] = el => {
    const cat = el.dataset.cat, r = A.SERVICE_CFG.get(cat, el.dataset.id);
    if (!feeCanDisable(r)) return U.toast('Bạn không có quyền vô hiệu hóa đơn giá này.');
    const tab = feeTabOf(cat, r);
    A.modal(A.mHead('Vô hiệu hóa ' + FEE_TABS[tab].title.toLowerCase() + '?') + `<div class="modal-b">${tab === 'service' ? 'Dịch vụ <b>' + U.esc(r.name || '') + '</b>' : 'Đơn giá ' + FEE_TABS[tab].noun} · ${feePriceHtml(tab, r)} của <b>${U.esc(feeMarketName(r.marketId))}</b> sẽ ngừng áp dụng. Thao tác được ghi vào lịch sử thay đổi.<div class="field" style="margin-top:12px"><label>Lý do</label><input class="input" id="fee-disable-reason" placeholder="Có quyết định giá mới"></div></div><div class="modal-f"><button class="btn" data-act="fee-view" data-cat="${cat}" data-id="${U.esc(r.id)}">Hủy</button><button class="btn danger" data-act="fee-disable" data-cat="${cat}" data-id="${U.esc(r.id)}">Vô hiệu hóa</button></div>`);
  };
  A.ACT['fee-disable'] = el => {
    const cat = el.dataset.cat, r = A.SERVICE_CFG.get(cat, el.dataset.id);
    if (!feeCanDisable(r)) return U.toast('Bạn không có quyền vô hiệu hóa đơn giá này.');
    const actor = cfgActor(), reason = ((A.$('#fee-disable-reason') || {}).value || '').trim();
    A.SERVICE_CFG.update(cat, r.id, { status: 'inactive', deactivatedAt: policyToday(), deactivatedBy: actor }, actor, 'Vô hiệu hóa', reason || 'Vô hiệu hóa thủ công');
    ui.feeEvidenceDraft = null; A.render(); feeDetail(cat, r.id); U.toast('Đã vô hiệu hóa đơn giá.');
  };
  // Form thêm: chợ (trong phạm vi) · [tên dịch vụ, cách tính] · đơn giá · hiệu lực · ngày kết thúc · 1 tệp căn cứ.
  function feeFormHtml() {
    const f = ui.feeForm, c = FEE_TABS[f.tab], svc = f.tab === 'service', unit = svc ? FEE_CALC[f.calcMethod][1] : c.unit;
    const cur = f.marketId ? A.SERVICE_CFG.list(c.cat).filter(r => r.marketId === f.marketId && feeOfTab(f.tab, r) && r.status === 'active' && !(r.effectiveTo && r.effectiveTo < policyToday()) && (!svc || (r.name || '').trim().toLowerCase() === f.name.trim().toLowerCase())) : [];
    const note = cur.length && (!svc || f.name.trim()) ? `<div class="note warn" style="margin-top:10px">Đang có ${svc ? 'dịch vụ "' + U.esc(f.name.trim()) + '"' : 'đơn giá ' + c.noun} ${cur.map(r => feePriceHtml(f.tab, r)).join(', ')} tại chợ này. Khi lưu, mức cũ sẽ tự chuyển sang Vô hiệu hóa.</div>` : '';
    const svcFields = svc ? `<div class="field"><label>Tên dịch vụ *</label><input class="input" data-ch="fee-name" value="${U.esc(f.name)}" placeholder="Vệ sinh"></div><div class="field"><label>Cách tính *</label><select class="input" data-ch="fee-calc">${Object.keys(FEE_CALC).map(k => `<option value="${k}" ${f.calcMethod === k ? 'selected' : ''}>${FEE_CALC[k][0]}</option>`).join('')}</select></div>` : '';
    A.modal(A.mHead('Thêm ' + c.title.toLowerCase() + ' · ' + U.esc(feeMarketName(f.marketId))) + `<div class="modal-b"><div class="form-grid">${svcFields}<div class="field"><label>Đơn giá (${unit}) *</label><input class="input" type="number" min="0" data-ch="fee-amount" value="${f.amount || ''}"></div><div class="field"><label>Có hiệu lực từ *</label><input class="input" type="date" data-ch="fee-from" value="${f.effectiveFrom}"></div><div class="field"><label>Ngày kết thúc</label><input class="input" type="date" data-ch="fee-to" value="${f.effectiveTo || ''}"><div class="small muted">Để trống = chưa kết thúc.</div></div></div>${note}<div class="field" style="margin-top:10px"><label>Căn cứ quyết định / công văn * <span class="small muted">(1 tệp PDF hoặc ảnh)</span></label><label class="btn sm" style="cursor:pointer;display:inline-flex;width:max-content">${f.file ? 'Đổi tệp' : '+ Tải tệp PDF / ảnh'}<input type="file" accept="${LAND_FILE_ACCEPT}" style="display:none" data-ch="fee-file"></label>${f.file ? `<div class="row" style="gap:8px;margin-top:6px"><span>${cfgAttachIcon(f.file.type)}</span><span>${U.esc(f.file.name)}</span></div>` : ''}</div><div class="small muted" style="margin-top:10px">Lịch sử thay đổi được hệ thống ghi tự động (người thực hiện, thời điểm, nội dung).</div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="fee-save">Lưu đơn giá</button></div>`, true);
  }
  A.ACT['fee-new'] = el => {
    if (!feeCanAdd()) return U.toast('Bạn không có quyền thêm đơn giá.');
    const tab = FEE_TABS[el.dataset.tab] ? el.dataset.tab : 'electricity', filter = feeFilter();
    if (!filter) return U.toast('Tài khoản chưa có chợ nào trong phạm vi.');
    // Chợ của dòng giá = chợ đang lọc (không chọn lại trong form); fee-save vẫn kiểm tra marketScopes.
    ui.feeForm = { tab, marketId: filter, name: '', calcMethod: 'fixed', amount: 0, effectiveFrom: policyToday(), effectiveTo: '', file: null };
    feeFormHtml();
  };
  A.CH['fee-name'] = el => { ui.feeForm.name = el.value; feeFormHtml(); };
  A.CH['fee-calc'] = el => { ui.feeForm.calcMethod = FEE_CALC[el.value] ? el.value : 'fixed'; feeFormHtml(); };
  A.CH['fee-amount'] = el => { ui.feeForm.amount = Math.max(0, Number(el.value) || 0); };
  A.CH['fee-from'] = el => { ui.feeForm.effectiveFrom = el.value; };
  A.CH['fee-to'] = el => { ui.feeForm.effectiveTo = el.value; };
  A.CH['fee-file'] = el => { const file = el.files && el.files[0]; if (!file) return; if (!landFileOk(file)) return U.toast('Chỉ nhận tệp PDF hoặc ảnh.'); ui.feeForm.file = landAttachment(file); feeFormHtml(); };
  A.ACT['fee-save'] = () => {
    const f = ui.feeForm; if (!f) return;
    const c = FEE_TABS[f.tab], svc = f.tab === 'service';
    // Kiểm tra lại quyền + marketScopes trong handler (không chỉ dựa vào việc ẩn nút).
    if (!U.can('cau-hinh-gia') || !A.canDo('cau-hinh-gia.them-phi')) return U.toast('Bạn không có quyền thêm đơn giá.');
    if (!f.marketId) return U.toast('Vui lòng chọn chợ.');
    if (!landAllowed().has(f.marketId) || !landMarkets().some(m => m.id === f.marketId)) return U.toast('Chợ nằm ngoài phạm vi chợ của tài khoản.');
    if (svc && !f.name.trim()) return U.toast('Vui lòng nhập tên dịch vụ.');
    if (!(f.amount > 0)) return U.toast('Đơn giá phải lớn hơn 0.');
    if (!f.effectiveFrom) return U.toast('Vui lòng nhập ngày có hiệu lực.');
    if (f.effectiveTo && f.effectiveTo < f.effectiveFrom) return U.toast('Ngày kết thúc phải sau ngày có hiệu lực.');
    if (!f.file) return U.toast('Vui lòng tải lên tệp PDF hoặc ảnh quyết định / công văn làm căn cứ.');
    const actor = cfgActor(), today = policyToday(), name = f.name.trim(), unit = svc ? FEE_CALC[f.calcMethod][1] : c.unit;
    // Trùng: cùng chợ (+ cùng tên dịch vụ) đang áp dụng / chưa tới hiệu lực → mức cũ tự Vô hiệu hóa.
    const dup = A.SERVICE_CFG.list(c.cat).filter(r => r.marketId === f.marketId && feeOfTab(f.tab, r) && r.status === 'active' && !(r.effectiveTo && r.effectiveTo < today) && (!svc || (r.name || '').trim().toLowerCase() === name.toLowerCase()));
    dup.forEach(r => A.SERVICE_CFG.update(c.cat, r.id, { status: 'inactive', deactivatedAt: today, deactivatedBy: actor }, actor, 'Vô hiệu hóa', 'Trùng ' + (svc ? 'dịch vụ "' + name + '"' : 'đơn giá ' + c.noun) + ' — được thay bằng mức ' + f.amount.toLocaleString('vi-VN') + ' ' + unit + ' có hiệu lực từ ' + U.dmy(f.effectiveFrom)));
    const base = { marketId: f.marketId, effectiveFrom: f.effectiveFrom, effectiveTo: f.effectiveTo || null, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: f.effectiveFrom, note: '' } };
    const rec = svc ? Object.assign(base, { name, category: 'GENERAL', calcMethod: f.calcMethod, amount: f.amount, unit })
      : Object.assign(base, { kind: c.kind, elecPrice: null, waterPrice: null, elecUnit: 'đ/kWh', waterUnit: 'đ/m³', [c.field]: f.amount });
    rec.__detail = (svc ? name + ' · ' : '') + f.amount.toLocaleString('vi-VN') + ' ' + unit + ' · ' + feeMarketName(f.marketId) + ' · căn cứ: ' + f.file.name;
    A.SERVICE_CFG.add(c.cat, rec, actor); delete rec.__detail;
    A.SERVICE_CFG.addAttachment(rec, f.file, actor);
    ui.feeMarketFilter = f.marketId; ui.feeForm = null; A.closeModal(); A.render();
    U.toast('Đã lưu ' + c.title.toLowerCase() + '.' + (dup.length ? ' Mức cũ đã chuyển sang Vô hiệu hóa.' : ''));
  };
  function policyLandHtmlLegacy() {
    const rows = policyLandRows(), legacy = rows.filter(r => !r.areaTypeId), can = cfgFeeAddAllowed('stallPrices', null);
    return `<div class="card"><div class="card-h"><div><h3>Phí sử dụng mặt bằng</h3><div class="small muted">Thu trước cho tháng tiếp theo. Mức phí theo loại diện tích của điểm kinh doanh.</div></div>${can ? '<button class="btn sm primary" data-act="policy-land-new">+ Cấu hình mức phí</button>' : ''}</div><div class="card-b">${U.table([{t:'Loại diện tích'},{t:'Đơn giá',num:true},{t:'Đơn vị'},{t:'Hiệu lực từ'},{t:'Căn cứ/Ghi chú'},{t:'Trạng thái'},{t:'Thao tác'}], rows.filter(r => r.areaTypeId).map(r => `<tr><td><b>${U.esc(U.areaTypeLabel(r.areaTypeId) || r.areaTypeId)}</b></td><td class="num">${Number(r.amount || 0).toLocaleString('vi-VN')}</td><td>${U.esc(r.unit || 'đ/m²/ngày')}</td><td>${policyEffective(r)}</td><td class="small">${policyNote(r)}</td><td>${policyState(r)}</td><td><button class="btn sm" data-act="policy-history" data-cat="stallPrices" data-id="${r.id}" data-key="areaTypeId">Lịch sử</button></td></tr>`), {empty:'Chưa có mức phí mặt bằng theo loại diện tích cho chợ này.'})}${legacy.length ? `<div class="note" style="margin-top:12px">Có ${legacy.length} bản ghi mặt bằng cũ chưa có mã loại diện tích. Dữ liệu được giữ để tham chiếu, không dùng làm cấu hình mới.</div>` : ''}<div class="note info" style="margin-top:12px"><b>Cách tính</b><br>Phí mặt bằng = Đơn giá loại diện tích × Diện tích điểm KD × Số ngày của tháng được thu.</div></div></div>`;
  }
  function policyUtilityHtml(kind) {
    const elec = kind === 'electricity', field = elec ? 'elecPrice' : 'waterPrice', unitField = elec ? 'elecUnit' : 'waterUnit', label = elec ? 'điện' : 'nước', title = elec ? 'Tiền điện' : 'Tiền nước', unit = elec ? 'đ/kWh' : 'đ/m³';
    const current = policyActive(policyUtilityRows()).sort((a,b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')))[0], can = cfgFeeAddAllowed('utilities', null);
    return `<div class="card"><div class="card-h"><div><h3>${title}</h3><div class="small muted">Thu theo sản lượng ${label} đã sử dụng trong kỳ vừa chốt chỉ số.</div></div>${can ? `<button class="btn sm primary" data-act="policy-utility-new" data-kind="${kind}">Thay đổi mức giá</button>` : ''}</div><div class="card-b">${current ? `<dl class="kv"><dt>Đơn giá đang áp dụng</dt><dd><b>${Number(current[field] || 0).toLocaleString('vi-VN')} ${U.esc(current[unitField] || unit)}</b></dd><dt>Hiệu lực từ</dt><dd>${U.dmy(current.effectiveFrom)}</dd><dt>Căn cứ/Ghi chú</dt><dd>${policyNote(current)}</dd></dl><button class="btn sm" style="margin-top:10px" data-act="policy-history" data-cat="utilities" data-id="${current.id}" data-key="${field}">Lịch sử</button>` : '<div class="note">Chưa có mức giá đang áp dụng cho chợ này.</div>'}<div class="note info" style="margin-top:12px"><b>Sản lượng ${label}</b> = Chỉ số ${label} kỳ này - Chỉ số ${label} kỳ trước<br><b>${title}</b> = Sản lượng ${label} × Đơn giá ${label}</div></div></div>`;
  }
  function policyServiceHtml() {
    const rows = policyServiceRows(), total = policyActive(rows).reduce((s,r) => s + Number(r.amount || 0), 0), can = cfgFeeAddAllowed('extraServices', null);
    return `<div class="card"><div class="card-h"><div><h3>Gói dịch vụ</h3><div class="small muted">Thu cho dịch vụ đã sử dụng trong tháng vừa qua. Hợp đồng đăng ký Dịch vụ áp dụng toàn bộ gói đang có hiệu lực.</div></div>${can ? '<button class="btn sm primary" data-act="policy-service-new">+ Thêm dịch vụ</button>' : ''}</div><div class="card-b"><div class="note info" style="margin-bottom:12px"><b>Tổng gói dịch vụ đang áp dụng: ${total.toLocaleString('vi-VN')} đ/tháng</b><br>Hợp đồng có chọn Dịch vụ sẽ áp dụng toàn bộ tổng gói; không chọn thì phí dịch vụ bằng 0.</div>${U.table([{t:'Tên dịch vụ'},{t:'Mức thu',num:true},{t:'Đơn vị'},{t:'Hiệu lực từ'},{t:'Căn cứ/Ghi chú'},{t:'Trạng thái'},{t:'Thao tác'}], rows.map(r => `<tr><td><b>${U.esc(r.name)}</b></td><td class="num">${Number(r.amount || 0).toLocaleString('vi-VN')}</td><td>${U.esc(r.unit || 'đ/tháng')}</td><td>${policyEffective(r)}</td><td class="small">${policyNote(r)}</td><td>${policyState(r)}</td><td><button class="btn sm" data-act="policy-history" data-cat="extraServices" data-id="${r.id}" data-key="name">Lịch sử</button></td></tr>`), {empty:'Chưa có thành phần dịch vụ cho chợ này.'})}</div></div>`;
  }
  function policyUseHtml() { return `<div class="card" style="margin-top:14px"><div class="card-h"><h3>Cách hệ thống sử dụng biểu phí</h3></div><div class="card-b"><div class="small">Mỗi hợp đồng / điểm KD: <b>Mặt bằng tháng tiếp theo + Điện tháng vừa sử dụng + Nước tháng vừa sử dụng + Gói dịch vụ tháng vừa sử dụng</b> = Tổng của HĐ/Điểm KD.</div><div class="small muted" style="margin-top:6px">Chỉ nhóm phí được chọn trong hợp đồng mới được tính. Tiểu thương có nhiều HĐ được tính riêng từng HĐ/Điểm KD rồi cộng thành tổng khoản phải thu.</div></div></div>`; }
  function policyFormHtml(f) {
    const land = f.type === 'land', service = f.type === 'service', elec = f.type === 'electricity', title = land ? 'Cấu hình mức phí mặt bằng' : service ? 'Thêm dịch vụ' : 'Cấu hình mức giá ' + (elec ? 'điện' : 'nước');
    const fields = land ? `<div class="field"><label>Loại diện tích</label><select class="input" data-ch="policy-area-type"><option value="">Chọn loại diện tích</option>${policyAreaTypes().map(x => `<option value="${U.esc(x.id)}">${U.esc(x.label)}</option>`).join('')}</select></div><div class="field"><label>Đơn giá</label><input class="input" type="number" min="0" data-ch="policy-amount" value="${f.amount || 0}"></div><div class="field"><label>Đơn vị</label><input class="input" value="đ/m²/ngày" disabled></div>` : service ? `<div class="field"><label>Tên dịch vụ</label><input class="input" data-ch="policy-name"></div><div class="field"><label>Mức thu</label><input class="input" type="number" min="0" data-ch="policy-amount" value="${f.amount || 0}"></div><div class="field"><label>Đơn vị tính</label><input class="input" data-ch="policy-unit" value="đ/tháng"></div>` : `<div class="field"><label>Đơn giá ${elec ? 'điện' : 'nước'}</label><input class="input" type="number" min="0" data-ch="policy-amount" value="${f.amount || 0}"></div><div class="field"><label>Đơn vị</label><input class="input" value="${elec ? 'đ/kWh' : 'đ/m³'}" disabled></div>`;
    A.modal(A.mHead(title) + `<div class="modal-b"><div class="form-grid"><div class="field"><label>Chợ</label><input class="input" value="${U.esc(U.market(ui.market).name)}" disabled></div>${fields}<div class="field"><label>Hiệu lực từ</label><input class="input" type="date" data-ch="policy-effective" value="${f.effectiveFrom}"></div></div><div class="field" style="margin-top:10px"><label>Căn cứ/Ghi chú</label><textarea class="input" rows="3" data-ch="policy-note"></textarea></div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="policy-save">Lưu mức phí</button></div>`);
  }
  function policyStart(type) { const cat = type === 'land' ? 'stallPrices' : type === 'service' ? 'extraServices' : 'utilities'; if (!cfgFeeAddAllowed(cat, null)) return; ui.policyForm = {type,amount:0,name:'',unit:'đ/tháng',areaTypeId:'',effectiveFrom:policyToday(),legalBasis:{note:''}}; policyFormHtml(ui.policyForm); }
  A.ACT['policy-service-new'] = () => policyStart('service'); A.ACT['policy-utility-new'] = el => policyStart(el.dataset.kind === 'water' ? 'water' : 'electricity'); A.ACT['policy-history'] = el => policyHistoryModal(el.dataset.cat, el.dataset.id, el.dataset.key);
  A.CH['policy-area-type'] = el => { ui.policyForm.areaTypeId = el.value; }; A.CH['policy-amount'] = el => { ui.policyForm.amount = Math.max(0, Number(el.value) || 0); }; A.CH['policy-name'] = el => { ui.policyForm.name = el.value; }; A.CH['policy-unit'] = el => { ui.policyForm.unit = el.value; }; A.CH['policy-effective'] = el => { ui.policyForm.effectiveFrom = el.value; }; A.CH['policy-note'] = el => { ui.policyForm.legalBasis.note = el.value; };
  A.ACT['policy-save'] = () => {
    const f = ui.policyForm; if (!f || !f.effectiveFrom) return U.toast('Vui lòng nhập ngày hiệu lực'); const cat = f.type === 'land' ? 'stallPrices' : f.type === 'service' ? 'extraServices' : 'utilities'; if (!cfgFeeAddAllowed(cat, null)) return;
    if (f.type === 'land' && !f.areaTypeId) return U.toast('Vui lòng chọn loại diện tích'); if (f.type === 'service' && !f.name.trim()) return U.toast('Vui lòng nhập tên dịch vụ');
    let p; if (f.type === 'land') p = {marketId:ui.market,areaTypeId:f.areaTypeId,amount:f.amount,unit:'đ/m²/ngày',effectiveFrom:f.effectiveFrom,effectiveTo:null,status:'active',legalBasis:f.legalBasis}; else if (f.type === 'service') p = {marketId:ui.market,name:f.name.trim(),category:'GENERAL',calcMethod:'fixed',amount:f.amount,unit:f.unit.trim() || 'đ/tháng',effectiveFrom:f.effectiveFrom,effectiveTo:null,status:'active',legalBasis:f.legalBasis}; else { const cur = policyActive(policyUtilityRows()).sort((a,b)=>String(b.effectiveFrom||'').localeCompare(String(a.effectiveFrom||'')))[0] || {}; p = Object.assign({},cur,{marketId:ui.market,effectiveFrom:f.effectiveFrom,effectiveTo:null,status:'active',legalBasis:f.legalBasis,elecUnit:cur.elecUnit||'đ/kWh',waterUnit:cur.waterUnit||'đ/m³'}); p[f.type === 'electricity' ? 'elecPrice' : 'waterPrice'] = f.amount; }
    const same = r => f.type === 'land' ? r.areaTypeId === p.areaTypeId : f.type === 'service' ? r.name === p.name : true; const active = A.SERVICE_CFG.list(cat).filter(r => r.marketId === ui.market && r.status === 'active' && same(r)).sort((a,b)=>String(b.effectiveFrom||'').localeCompare(String(a.effectiveFrom||'')))[0];
    if (active && f.effectiveFrom <= active.effectiveFrom) return U.toast('Ngày hiệu lực mức mới phải sau mức đang áp dụng'); if (active) A.SERVICE_CFG.createVersion(cat, active.id, p, cfgActor(), Number(f.amount).toLocaleString('vi-VN')); else A.SERVICE_CFG.add(cat, p, cfgActor()); ui.policyForm = null; A.closeModal(); A.render(); U.toast(active ? 'Đã tạo phiên bản mới; mức cũ được lưu lịch sử.' : 'Đã lưu mức phí mới.');
  };
  A.VIEWS['cau-hinh-gia'] = function () {
    const tab = POLICY_TABS.some(t => t[0] === ui.cfgTab) ? ui.cfgTab : 'land', configured = [landRows().some(r => landMarketIds(r).includes(ui.market) && landState(r)[2] === 0),policyUtilityRows().length>0,policyUtilityRows().length>0,policyServiceRows().length>0].filter(Boolean).length;
    const bar = `<div class="seg" style="margin:14px 0">${POLICY_TABS.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="policy-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`;
    const content = tab === 'land' ? policyLandHtml() : feeTabHtml(tab === 'electricity' || tab === 'water' ? tab : 'service');
    return `<section><div class="card-h" style="padding:0 0 8px"><div><h2 style="margin:0">Chính sách thu & biểu phí</h2><div class="small muted">Cấu hình mức thu áp dụng cho từng chợ để lập khoản phải thu.</div></div></div><div class="note info">${tab === 'land' ? `Đơn giá mặt bằng áp dụng chung cho <b>${landMarkets().filter(m => landAllowed().has(m.id)).length} chợ</b> trong phạm vi tài khoản` : `Đơn giá ${tab === 'service' ? 'dịch vụ' : tab === 'water' ? 'nước' : 'điện'} khai báo riêng từng chợ — dùng bộ lọc Chợ ở bảng bên dưới`}<span class="muted"> · ${U.esc(U.market(ui.market).name)}: ${configured}/4 nhóm đã có cấu hình theo dữ liệu hiện tại</span></div>${bar}${content}${policyUseHtml()}</section>`;
  };
  A.ACT['policy-tab'] = el => { ui.cfgTab = el.dataset.id; A.render(); };


  if (!ui.cfgTab || ui.cfgTab === 'gia' || ui.cfgTab === 'dien-nuoc') ui.cfgTab = 'land';
})(window.APP);
