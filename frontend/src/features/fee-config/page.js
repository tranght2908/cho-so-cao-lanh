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
  // Kỳ thu / Quy tắc thu phí GIỮ NGUYÊN permission cũ (cai-dat.ky-thu/cai-dat.quy-tac-thu-phi) —
  // không đổi ở Phase 6 STEP A (xem SERVICE_PRICING_SCREEN_AUDIT.md mục 11).
  function cfgCan(action) { return A.PERM.canAction(ui.role, 'cai-dat.' + action); }
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

  // ---- sub-tab: Kỳ thu ----
  function settingsKyThuHtml() {
    const c = A.SERVICE_CFG.cycle(), canManage = cfgCan('ky-thu'), dis = canManage ? '' : 'disabled';
    return `<div class="card"><div class="card-h"><div><h3>Cấu hình lịch kỳ thu</h3><div class="small muted">Thiết lập các mốc thời gian mặc định cho kỳ thu hàng tháng.</div></div></div><div class="card-b">
      <div class="form-grid">
        <div class="field"><label>Chu kỳ thu</label><select class="input" data-ch="bc-cycle" ${dis}><option value="monthly" ${c.cycle === 'monthly' ? 'selected' : ''}>Hàng tháng</option></select></div>
        <div class="field"><label>Ngày bắt đầu chuẩn bị kỳ</label><input class="input" type="number" min="1" max="31" data-ch="bc-preparation" value="${c.preparationDay}" ${dis}><div class="small muted">Hệ thống bắt đầu nhắc BQL chuẩn bị dữ liệu cho kỳ thu.</div></div>
        <div class="field"><label>Ngày ghi/chốt chỉ số điện, nước</label><input class="input" type="number" min="1" max="31" data-ch="bc-meter-read" value="${c.meterReadDay}" ${dis}><div class="small muted">Nhân viên thu phí ghi chỉ số điện, nước của các điểm kinh doanh.</div></div>
        <div class="field"><label>Ngày dự kiến phát hành khoản phải thu</label><input class="input" type="number" min="1" max="31" data-ch="bc-issue" value="${c.issueDay}" ${dis}><div class="small muted">Tổ trưởng kiểm tra và phát hành khoản phải thu sau khi dữ liệu đã đầy đủ.</div></div>
        <div class="field"><label>Ngày bắt đầu thu</label><input class="input" type="number" min="1" max="31" data-ch="bc-collection-start" value="${c.collectionStartDay}" ${dis}><div class="small muted">Từ ngày này nhân viên thu phí bắt đầu theo dõi và thực hiện thu.</div></div>
        <div class="field"><label>Hạn thanh toán</label><div class="row" style="gap:8px"><input class="input" style="width:92px" type="number" min="1" max="31" data-ch="bc-due" value="${c.dueDay}" ${dis}><select class="input" data-ch="bc-due-month" ${dis}><option value="next" ${c.dueMonth !== 'current' ? 'selected' : ''}>Tháng kế tiếp</option><option value="current" ${c.dueMonth === 'current' ? 'selected' : ''}>Cùng tháng</option></select></div><div class="small muted">Ngày ${U.pad(c.dueDay, 2)} của ${c.dueMonth === 'current' ? 'cùng tháng' : 'tháng kế tiếp'}.</div></div>
      </div>
      <div class="note info" style="margin-top:14px"><label class="row" style="gap:8px"><input type="checkbox" data-ch="bc-prepare-notification" ${c.prepareNotification ? 'checked' : ''} ${dis}> <b>Tự động gửi thông báo chuẩn bị kỳ thu</b></label><div class="small muted" style="margin-top:7px">Đến ngày bắt đầu chuẩn bị, hệ thống gửi thông báo cho Tổ trưởng BQL, Nhân viên thu phí và Tiểu thương.</div><div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap"><span class="tag">Tổ trưởng BQL</span><span class="tag">Nhân viên thu phí</span><span class="tag">Tiểu thương</span></div></div>
      <div class="small muted" style="margin-top:8px">Ngày phát hành là ngày dự kiến; khoản phải thu luôn chờ Tổ trưởng kiểm tra và phát hành tại module Khoản phải thu.</div>
      <div class="divider"></div>${settingsPeriodsHtml(canManage)}
      <div style="margin-top:14px"><details><summary><b>Căn cứ &amp; tài liệu</b></summary><div style="margin-top:10px"><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(c.legalBasis)}</div>${canManage ? `<button class="btn sm" style="margin-top:8px" data-act="cfg-editlegal" data-cat="billingCycle" data-id="cycle">Sửa căn cứ</button>` : ''}<div class="divider"></div><b class="small">TÀI LIỆU</b><div style="margin-top:6px">${cfgAttachHtml(c, 'billingCycle', 'cycle', canManage)}</div></div></details></div>
      <div style="margin-top:10px"><details><summary><b>Lịch sử thay đổi</b></summary><div style="margin-top:10px">${cfgHistoryHtml(c)}</div></details></div>
    </div></div>`;
  }
  const PERIOD_STATUS = { UPCOMING: ['Sắp tới', ''], PREPARING: ['Đang chuẩn bị', 'info'], COLLECTING: ['Đang thu', 'warn'], RECONCILING: ['Chờ đối soát', 'info'], CLOSED: ['Đã chốt', 'ok'] };
  function cfgDate(year, monthIndex, day) {
    const max = new Date(year, monthIndex + 1, 0).getDate(), normalizedDay = Number(day) <= 0 ? max : Math.min(Math.max(Number(day) || 1, 1), max), date = new Date(year, monthIndex, normalizedDay);
    return date.getFullYear() + '-' + U.pad(date.getMonth() + 1) + '-' + U.pad(date.getDate());
  }
  function cfgPeriodDates(monthValue, c) {
    const [year, month] = monthValue.split('-').map(Number), previous = month - 2;
    const prep = cfgDate(year, previous, c.preparationDay), meter = cfgDate(year, previous, c.meterReadDay), expectedIssue = cfgDate(year, previous, c.issueDay), start = cfgDate(year, previous, c.collectionStartDay);
    const due = cfgDate(year, c.dueMonth === 'current' ? previous : month - 1, c.dueDay);
    return { preparationDate: prep, meterReadDate: meter, expectedIssueDate: expectedIssue, startDate: start, dueDate: due, endDate: cfgDate(year, month, 0) };
  }
  function cfgPeriodStatus(p) {
    if (p.status === 'CLOSED') return 'CLOSED';
    if (PERIOD_STATUS[p.status]) return p.status;
    if (p.status === 'COLLECTING') return 'COLLECTING';
    const today = U.today(), prep = p.preparationDate || p.startDate;
    if (today < prep) return 'UPCOMING';
    if (today < p.startDate) return 'PREPARING';
    if (today <= p.dueDate) return 'COLLECTING';
    return 'RECONCILING';
  }
  function cfgPeriodTag(p) { const s = cfgPeriodStatus(p), meta = PERIOD_STATUS[s]; return `<span class="tag ${meta[1]}">${meta[0]}</span>`; }
  function cfgPeriodScope(p) { const m = p.marketId && U.market(p.marketId); return m ? m.name : (p.scopeLabel || 'Toàn bộ chợ trong phạm vi'); }
  function cfgMeterState(p) { const m = (A.db.meterPeriods || []).find(x => x.id === p.id); return m && m.status === 'CLOSED' ? 'Đã hoàn tất' : 'Chưa hoàn tất'; }
  function cfgReceivableState(p) { return A.db.issuedPeriods.includes(p.id) ? '<span class="tag ok">Đã phát hành</span>' : '<span class="tag">Chưa phát hành</span>'; }
  function settingsPeriodsHtml(canManage) {
    const bps = (A.db.billingPeriods || []).slice().sort((a, b) => b.id.localeCompare(a.id));
    return `<div class="row" style="align-items:center"><div><h3 style="margin:0">Danh sách kỳ thu</h3><div class="small muted" style="margin-top:3px">Mỗi kỳ thu có thể chứa nhiều khoản phải thu.</div></div><span class="spacer"></span>${canManage ? '<button class="btn sm primary" data-act="cfg-create-period-open">+ Tạo kỳ thu</button>' : ''}</div>
      <div style="margin-top:10px">${U.table([{ t: 'Kỳ thu' }, { t: 'Phạm vi/Chợ' }, { t: 'Ngày chuẩn bị' }, { t: 'Ghi chỉ số' }, { t: 'Khoản phải thu' }, { t: 'Thời gian thu' }, { t: 'Trạng thái' }, { t: 'Thao tác' }],
        bps.map(p => `<tr><td><b>${U.esc(p.label || p.id)}</b></td><td>${U.esc(cfgPeriodScope(p))}</td><td>${U.dmy(p.preparationDate || p.startDate)}</td><td>${cfgMeterState(p)}</td><td>${cfgReceivableState(p)}</td><td>${U.dmy(p.startDate)} – ${U.dmy(p.dueDate)}</td><td>${cfgPeriodTag(p)}</td><td><button class="btn sm" data-act="cfg-period-detail" data-id="${U.esc(p.id)}">Xem chi tiết</button></td></tr>`), { empty: 'Chưa có kỳ thu.' })}</div>`;
  }
  function cfgCreatePeriodModal(monthValue) {
    const c = A.SERVICE_CFG.cycle(), month = monthValue || (() => { const last = (A.db.billingPeriods || []).slice().sort((a, b) => b.id.localeCompare(a.id))[0]; if (last) { const [y, m] = last.id.split('-').map(Number), d = new Date(y, m, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); } return U.today().slice(0, 7); })(), dates = cfgPeriodDates(month, c), allowed = A.allowedMarkets(A.currentAccount());
    const scopeOptions = ['<option value="">Toàn bộ chợ trong phạm vi được cấp</option>'].concat(D.MARKETS.filter(m => allowed.includes(m.id)).map(m => `<option value="${m.id}">${U.esc(m.name)}</option>`)).join('');
    A.modal(A.mHead('Tạo kỳ thu') + `<div class="modal-b"><div class="small muted" style="margin-bottom:12px">Các mốc mặc định lấy từ cấu hình lịch kỳ thu. Việc tạo kỳ không phát hành khoản phải thu.</div><div class="form-grid"><div class="field"><label>Kỳ thu</label><input class="input" type="month" data-ch="cfg-period-month" value="${month}"></div><div class="field"><label>Chợ/phạm vi áp dụng</label><select class="input" id="cfg-period-market">${scopeOptions}</select></div><div class="field"><label>Ngày bắt đầu chuẩn bị</label><input class="input" id="cfg-period-prep" type="date" value="${dates.preparationDate}"></div><div class="field"><label>Ngày ghi chỉ số</label><input class="input" id="cfg-period-meter" type="date" value="${dates.meterReadDate}"></div><div class="field"><label>Ngày dự kiến phát hành khoản phải thu</label><input class="input" id="cfg-period-issue" type="date" value="${dates.expectedIssueDate}"></div><div class="field"><label>Ngày bắt đầu thu</label><input class="input" id="cfg-period-start" type="date" value="${dates.startDate}"></div><div class="field"><label>Hạn thanh toán</label><input class="input" id="cfg-period-due" type="date" value="${dates.dueDate}"></div></div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="cfg-period-create">Tạo kỳ thu</button></div>`);
  }
  A.ACT['cfg-create-period-open'] = () => { if (!cfgCan('ky-thu')) return U.toast('Bạn không có quyền cấu hình kỳ thu'); cfgCreatePeriodModal(); };
  A.CH['cfg-period-month'] = el => { if (/^\d{4}-\d{2}$/.test(el.value)) cfgCreatePeriodModal(el.value); };
  A.ACT['cfg-period-create'] = () => {
    if (!cfgCan('ky-thu')) return U.toast('Bạn không có quyền cấu hình kỳ thu');
    const month = A.$('[data-ch="cfg-period-month"]').value, dates = { preparationDate: A.$('#cfg-period-prep').value, meterReadDate: A.$('#cfg-period-meter').value, expectedIssueDate: A.$('#cfg-period-issue').value, startDate: A.$('#cfg-period-start').value, dueDate: A.$('#cfg-period-due').value };
    if (!/^\d{4}-\d{2}$/.test(month) || Object.keys(dates).some(k => !dates[k])) return U.toast('Vui lòng nhập đầy đủ kỳ thu và các mốc thời gian.');
    if (A.db.billingPeriods.some(p => p.id === month)) return U.toast('Kỳ thu ' + month.slice(5) + '/' + month.slice(0, 4) + ' đã tồn tại.');
    if (dates.preparationDate > dates.meterReadDate || dates.meterReadDate > dates.expectedIssueDate || dates.expectedIssueDate > dates.startDate || dates.startDate > dates.dueDate) return U.toast('Các mốc thời gian của kỳ thu chưa theo đúng thứ tự.');
    const [year, mon] = month.split('-').map(Number), marketId = A.$('#cfg-period-market').value, p = { id: month, label: mon + '/' + year, preparationDate: dates.preparationDate, meterReadDate: dates.meterReadDate, expectedIssueDate: dates.expectedIssueDate, startDate: dates.startDate, dueDate: dates.dueDate, endDate: cfgDate(year, mon, 0), status: dates.preparationDate <= U.today() ? 'PREPARING' : 'UPCOMING', marketId: marketId || null };
    A.db.billingPeriods.push(p);
    // Chỉ khởi tạo record kỳ ghi chỉ số ở trạng thái chưa bắt đầu; không ghi/chốt chỉ số thay cho module chuyên trách.
    A.db.meterPeriods = A.db.meterPeriods || [];
    if (!A.db.meterPeriods.some(x => x.id === p.id)) A.db.meterPeriods.push({ id: p.id, month: mon, year, status: 'PENDING', closeDate: p.endDate });
    A.SERVICE_CFG.updateCycle({}, cfgActor(), 'Tạo kỳ thu ' + p.label);
    A.save(); A.closeModal(); A.render(); U.toast('Đã tạo kỳ thu ' + p.label + '. Khoản phải thu vẫn chưa được phát hành.');
  };
  A.ACT['cfg-period-detail'] = el => {
    const p = (A.db.billingPeriods || []).find(x => x.id === el.dataset.id); if (!p) return;
    const state = cfgPeriodStatus(p), issued = A.db.issuedPeriods.includes(p.id), notified = state !== 'UPCOMING' && A.SERVICE_CFG.cycle().prepareNotification;
    const step = (done, text) => `<div style="padding:4px 0">${done ? '✓' : '○'} ${text}</div>`;
    A.modal(A.mHead('Chi tiết kỳ thu · ' + U.esc(p.label || p.id)) + `<div class="modal-b"><dl class="kv"><dt>Kỳ thu</dt><dd><b>${U.esc(p.label || p.id)}</b></dd><dt>Chợ/phạm vi</dt><dd>${U.esc(cfgPeriodScope(p))}</dd><dt>Ngày chuẩn bị</dt><dd>${U.dmy(p.preparationDate || p.startDate)}</dd><dt>Ngày ghi chỉ số</dt><dd>${U.dmy(p.meterReadDate || p.startDate)}</dd><dt>Ngày dự kiến phát hành khoản phải thu</dt><dd>${U.dmy(p.expectedIssueDate || p.startDate)}</dd><dt>Ngày bắt đầu thu</dt><dd>${U.dmy(p.startDate)}</dd><dt>Hạn thanh toán</dt><dd>${U.dmy(p.dueDate)}</dd><dt>Trạng thái kỳ</dt><dd>${cfgPeriodTag(p)}</dd></dl><section style="margin-top:16px"><h4>Tiến độ kỳ thu</h4>${step(true, 'Đã tạo kỳ')}${step(notified, 'Đã gửi thông báo chuẩn bị')}${step(cfgMeterState(p) === 'Đã hoàn tất', 'Chờ ghi chỉ số')}${step((A.db.billingDrafts || []).some(x => x.period === p.id), 'Chờ lập khoản phải thu')}${step(issued, 'Chờ phát hành')}${step(['COLLECTING', 'RECONCILING', 'CLOSED'].includes(state), 'Chờ bắt đầu thu')}${step(['RECONCILING', 'CLOSED'].includes(state), 'Chờ đối soát')}${step(state === 'CLOSED', 'Chờ chốt kỳ')}</section></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`, true);
  };
  const bcGuard = fn => el => { if (!cfgCan('ky-thu')) { U.toast('Bạn không có quyền cấu hình kỳ thu'); A.render(); return; } fn(el); };
  A.CH['bc-cycle'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ cycle: el.value }, cfgActor(), 'Đổi chu kỳ thu'); A.render(); });
  A.CH['bc-preparation'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ preparationDay: Number(el.value) || 1 }, cfgActor(), 'Đổi ngày bắt đầu chuẩn bị kỳ'); A.render(); });
  A.CH['bc-meter-read'] = bcGuard(el => { const day = Number(el.value) || 1; A.SERVICE_CFG.updateCycle({ meterReadDay: day, meterCutoffDay: day }, cfgActor(), 'Đổi ngày ghi/chốt chỉ số'); A.render(); });
  A.CH['bc-issue'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ issueDay: Number(el.value) || 1 }, cfgActor(), 'Đổi ngày dự kiến phát hành'); A.render(); });
  A.CH['bc-collection-start'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ collectionStartDay: Number(el.value) || 1 }, cfgActor(), 'Đổi ngày bắt đầu thu'); A.render(); });
  A.CH['bc-due'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ dueDay: Number(el.value) || 1 }, cfgActor(), 'Đổi hạn nộp'); A.render(); });
  A.CH['bc-due-month'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ dueMonth: el.value === 'current' ? 'current' : 'next' }, cfgActor(), 'Đổi tháng hạn thanh toán'); A.render(); });
  A.CH['bc-prepare-notification'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ prepareNotification: el.checked }, cfgActor(), el.checked ? 'Bật thông báo chuẩn bị kỳ' : 'Tắt thông báo chuẩn bị kỳ'); A.render(); });

  // ---- sub-tab: Quy tắc thu phí ----
  function settingsQuyTacHtml() {
    const r = A.SERVICE_CFG.rules(), canManage = cfgCan('quy-tac-thu-phi'), dis = canManage ? '' : 'disabled';
    const cr = A.SERVICE_CFG.complaintRules ? A.SERVICE_CFG.complaintRules() : { ratingAutoCloseDays: null, history: [] };
    const ratingAutoCloseDays = cr.ratingAutoCloseDays == null ? '' : Number(cr.ratingAutoCloseDays);
    return `<div class="card"><div class="card-h"><h3>Quy tắc thu phí</h3></div><div class="card-b">
      <div class="row" style="flex-direction:column;align-items:flex-start;gap:10px">
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="br-adjust" ${r.allowAdjust ? 'checked' : ''} ${dis}> Cho phép điều chỉnh khoản phải thu</label>
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="br-waiver" ${r.allowWaiver ? 'checked' : ''} ${dis}> Cho phép miễn giảm</label>
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="br-reason" ${r.requireReason ? 'checked' : ''} ${dis}> Bắt buộc nhập lý do</label>
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="br-partial" ${r.allowPartialPay ? 'checked' : ''} ${dis}> Cho phép thu một phần</label>
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="br-void" ${r.allowVoidReceipt ? 'checked' : ''} ${dis}> Cho phép huỷ biên lai</label>
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="br-noteadjust" ${r.requireNoteOnAdjust ? 'checked' : ''} ${dis}> Bắt buộc ghi chú khi điều chỉnh</label>
      </div>
      <div class="form-grid" style="margin-top:14px">
        <div class="field"><label>Ngưỡng miễn giảm cần phê duyệt (%)</label><input class="input" type="number" min="0" max="100" data-ch="br-threshold" value="${r.waiverApprovalThreshold}" ${dis}></div>
        <div class="field"><label>Vai trò phê duyệt</label><select class="input" data-ch="br-approver" ${dis}>${A.PERM.roles().map(x => `<option value="${x.id}" ${r.approverRoleId === x.id ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select></div>
      </div>
      <div class="divider"></div><b class="small">QUY TẮC PHẢN ÁNH</b>
      <div class="form-grid" style="margin-top:10px">
        <div class="field"><label>Thời gian chờ tiểu thương đánh giá trước khi tự động đóng phiếu (ngày)</label><input class="input" type="number" min="1" data-ch="br-complaint-rating-wait" value="${ratingAutoCloseDays}" placeholder="CXN" ${dis}></div>
      </div>
      <div class="small muted" style="margin-top:6px">Để trống khi chưa có quyết định nghiệp vụ. Khi có cấu hình, phản ánh ở trạng thái Hoàn thành nhưng chưa được đánh giá sẽ tự chuyển sang Đóng sau số ngày chờ.</div>
      <div class="divider"></div><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(r.legalBasis)}</div>
      ${canManage ? `<button class="btn sm" style="margin-top:8px" data-act="cfg-editlegal" data-cat="billingRules" data-id="rules">Sửa căn cứ</button>` : ''}
      <div class="divider"></div><b class="small">TÀI LIỆU</b><div style="margin-top:6px">${cfgAttachHtml(r, 'billingRules', 'rules', canManage)}</div>
      <div class="divider"></div><b class="small">LỊCH SỬ</b><div style="margin-top:6px">${cfgHistoryHtml(r)}</div>
    </div></div>`;
  }
  A.CH['br-adjust'] = el => { A.SERVICE_CFG.updateRules({ allowAdjust: el.checked }, cfgActor(), el.checked ? 'Bật điều chỉnh khoản phải thu' : 'Tắt điều chỉnh khoản phải thu'); A.render(); };
  A.CH['br-waiver'] = el => { A.SERVICE_CFG.updateRules({ allowWaiver: el.checked }, cfgActor(), el.checked ? 'Bật miễn giảm' : 'Tắt miễn giảm'); A.render(); };
  A.CH['br-reason'] = el => { A.SERVICE_CFG.updateRules({ requireReason: el.checked }, cfgActor(), el.checked ? 'Bật bắt buộc lý do' : 'Tắt bắt buộc lý do'); A.render(); };
  A.CH['br-partial'] = el => { A.SERVICE_CFG.updateRules({ allowPartialPay: el.checked }, cfgActor(), el.checked ? 'Bật thu một phần' : 'Tắt thu một phần'); A.render(); };
  A.CH['br-void'] = el => { A.SERVICE_CFG.updateRules({ allowVoidReceipt: el.checked }, cfgActor(), el.checked ? 'Bật huỷ biên lai' : 'Tắt huỷ biên lai'); A.render(); };
  A.CH['br-noteadjust'] = el => { A.SERVICE_CFG.updateRules({ requireNoteOnAdjust: el.checked }, cfgActor(), el.checked ? 'Bật bắt buộc ghi chú điều chỉnh' : 'Tắt bắt buộc ghi chú điều chỉnh'); A.render(); };
  A.CH['br-threshold'] = el => { A.SERVICE_CFG.updateRules({ waiverApprovalThreshold: Math.max(0, Math.min(100, Number(el.value) || 0)) }, cfgActor(), 'Đổi ngưỡng miễn giảm cần phê duyệt'); A.render(); };
  A.CH['br-approver'] = el => { A.SERVICE_CFG.updateRules({ approverRoleId: el.value }, cfgActor(), 'Đổi vai trò phê duyệt'); A.render(); };
  A.CH['br-complaint-rating-wait'] = el => {
    const raw = String(el.value || '').trim();
    const days = raw === '' ? null : Math.max(1, Number(raw) || 1);
    A.SERVICE_CFG.updateComplaintRules({ ratingAutoCloseDays: days }, cfgActor(), days == null ? 'Bỏ cấu hình thời gian chờ đánh giá phản ánh' : 'Đổi thời gian chờ đánh giá phản ánh: ' + days + ' ngày');
    A.render();
  };

  // ---- router "Chính sách thu và biểu phí" (Tài chính > Quản lý khai báo) ----
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
  function policyLandHtml() {
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
  A.ACT['policy-land-new'] = () => policyStart('land'); A.ACT['policy-service-new'] = () => policyStart('service'); A.ACT['policy-utility-new'] = el => policyStart(el.dataset.kind === 'water' ? 'water' : 'electricity'); A.ACT['policy-history'] = el => policyHistoryModal(el.dataset.cat, el.dataset.id, el.dataset.key);
  A.CH['policy-area-type'] = el => { ui.policyForm.areaTypeId = el.value; }; A.CH['policy-amount'] = el => { ui.policyForm.amount = Math.max(0, Number(el.value) || 0); }; A.CH['policy-name'] = el => { ui.policyForm.name = el.value; }; A.CH['policy-unit'] = el => { ui.policyForm.unit = el.value; }; A.CH['policy-effective'] = el => { ui.policyForm.effectiveFrom = el.value; }; A.CH['policy-note'] = el => { ui.policyForm.legalBasis.note = el.value; };
  A.ACT['policy-save'] = () => {
    const f = ui.policyForm; if (!f || !f.effectiveFrom) return U.toast('Vui lòng nhập ngày hiệu lực'); const cat = f.type === 'land' ? 'stallPrices' : f.type === 'service' ? 'extraServices' : 'utilities'; if (!cfgFeeAddAllowed(cat, null)) return;
    if (f.type === 'land' && !f.areaTypeId) return U.toast('Vui lòng chọn loại diện tích'); if (f.type === 'service' && !f.name.trim()) return U.toast('Vui lòng nhập tên dịch vụ');
    let p; if (f.type === 'land') p = {marketId:ui.market,areaTypeId:f.areaTypeId,amount:f.amount,unit:'đ/m²/ngày',effectiveFrom:f.effectiveFrom,effectiveTo:null,status:'active',legalBasis:f.legalBasis}; else if (f.type === 'service') p = {marketId:ui.market,name:f.name.trim(),category:'GENERAL',calcMethod:'fixed',amount:f.amount,unit:f.unit.trim() || 'đ/tháng',effectiveFrom:f.effectiveFrom,effectiveTo:null,status:'active',legalBasis:f.legalBasis}; else { const cur = policyActive(policyUtilityRows()).sort((a,b)=>String(b.effectiveFrom||'').localeCompare(String(a.effectiveFrom||'')))[0] || {}; p = Object.assign({},cur,{marketId:ui.market,effectiveFrom:f.effectiveFrom,effectiveTo:null,status:'active',legalBasis:f.legalBasis,elecUnit:cur.elecUnit||'đ/kWh',waterUnit:cur.waterUnit||'đ/m³'}); p[f.type === 'electricity' ? 'elecPrice' : 'waterPrice'] = f.amount; }
    const same = r => f.type === 'land' ? r.areaTypeId === p.areaTypeId : f.type === 'service' ? r.name === p.name : true; const active = A.SERVICE_CFG.list(cat).filter(r => r.marketId === ui.market && r.status === 'active' && same(r)).sort((a,b)=>String(b.effectiveFrom||'').localeCompare(String(a.effectiveFrom||'')))[0];
    if (active && f.effectiveFrom <= active.effectiveFrom) return U.toast('Ngày hiệu lực mức mới phải sau mức đang áp dụng'); if (active) A.SERVICE_CFG.createVersion(cat, active.id, p, cfgActor(), Number(f.amount).toLocaleString('vi-VN')); else A.SERVICE_CFG.add(cat, p, cfgActor()); ui.policyForm = null; A.closeModal(); A.render(); U.toast(active ? 'Đã tạo phiên bản mới; mức cũ được lưu lịch sử.' : 'Đã lưu mức phí mới.');
  };
  A.VIEWS['cau-hinh-gia'] = function () {
    const tab = POLICY_TABS.some(t => t[0] === ui.cfgTab) ? ui.cfgTab : 'land', configured = [policyLandRows().some(r=>r.areaTypeId),policyUtilityRows().length>0,policyUtilityRows().length>0,policyServiceRows().length>0].filter(Boolean).length;
    const bar = `<div class="seg" style="margin:14px 0">${POLICY_TABS.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="policy-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`;
    const content = tab === 'land' ? policyLandHtml() : tab === 'electricity' || tab === 'water' ? policyUtilityHtml(tab) : policyServiceHtml();
    return `<section><div class="card-h" style="padding:0 0 8px"><div><h2 style="margin:0">Chính sách thu & biểu phí</h2><div class="small muted">Cấu hình mức thu áp dụng cho từng chợ để lập khoản phải thu.</div></div></div><div class="note info">Chợ đang cấu hình: <b>${U.esc(U.market(ui.market).name)}</b><span class="muted"> · ${configured}/4 nhóm đã có cấu hình theo dữ liệu hiện tại</span></div>${bar}${content}${policyUseHtml()}</section>`;
  };
  A.ACT['policy-tab'] = el => { ui.cfgTab = el.dataset.id; A.render(); };

  // Panels hosted by the settings screen (cai-dat).
  const feeConfig = A.features.feeConfig || (A.features.feeConfig = {});
  feeConfig.settingsKyThuHtml = settingsKyThuHtml;
  feeConfig.settingsQuyTacHtml = settingsQuyTacHtml;

  if (!ui.cfgTab || ui.cfgTab === 'gia' || ui.cfgTab === 'dien-nuoc') ui.cfgTab = 'land';
})(window.APP);
