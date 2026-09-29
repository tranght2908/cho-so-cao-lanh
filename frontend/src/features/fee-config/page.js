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
  function cfgCommonLandAddAllowed() { return cfgCommonLandAllowed('them-muc'); }
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
    const canNew = cfgCommonLandAddAllowed();
    const rows = A.SERVICE_CFG.list('stallPrices');
    return `<div class="card"><div class="card-h"><div><h3>Đơn giá sử dụng mặt bằng</h3><div class="small muted">Phạm vi: dùng chung cho tất cả 12 chợ</div></div>${canNew ? '<button class="btn sm primary" data-act="cfg-price-new">+ Thêm mức giá</button>' : ''}</div>
      <div class="card-b"><div class="note info" style="margin-bottom:12px">Biểu phí dùng chung do Quản trị hệ thống quản lý và áp dụng theo chính sách hiện hành.${canNew ? '' : ' Biểu phí chung do Quản trị hệ thống quản lý.'}</div>${U.table([{ t: 'Phạm vi' }, { t: 'Khu vực / loại điểm' }, { t: 'Mức giá', num: true }, { t: 'Đơn vị / chu kỳ' }, { t: 'Phân loại thuế' }, { t: 'Hiệu lực / căn cứ' }, { t: 'Miễn giảm' }, { t: 'Trạng thái' }, { t: '' }],
        rows.map(r => { const canApply = cfgCommonLandApplyAllowed(r), canLock = cfgCommonLandLockAllowed(r); return `<tr>
          <td>${r.marketId === 'ALL' ? 'Tất cả 12 chợ' : 'Dữ liệu chuyển tiếp'}<div class="small muted">${U.esc(CFG_MARKET_MODEL_LABELS[r.marketModel] || '—')}</div></td>
          <td class="small">${U.esc(r.area)}<div class="muted">${U.esc(r.stallType)}</div></td>
          <td class="num">${r.amount.toLocaleString('vi-VN')}</td><td class="small nowrap">${U.esc(r.unit)}<div class="muted">Chu kỳ: ${U.esc(CFG_CYCLE_LABELS[r.collectionCycle] || '—')}</div></td>
          <td class="small">${U.esc(CFG_TAX_LABELS[r.taxClass] || '—')}</td>
          <td class="nowrap">${U.dmy(r.effectiveFrom)}${r.effectiveTo ? `<div class="small muted">đến ${U.dmy(r.effectiveTo)}</div>` : ''}<div class="small">${r.legalBasis && r.legalBasis.docNo ? U.esc(r.legalBasis.docNo) : '<span class="muted">—</span>'}</div></td>
          <td class="small">${U.esc(cfgWaiverName(r.waiverTypeId))}</td>
          <td>${cfgStatusTag(r.status)}</td>
          <td class="nowrap"><button class="btn sm" data-act="cfg-price-view" data-id="${r.id}">Xem</button>
            ${cfgLifecycleButtons('stallPrices', r.id, r.status, canApply, canLock)}
          </td></tr>`; }), { empty: 'Chưa có đơn giá sử dụng mặt bằng' })}</div></div>`;
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
    renderCfgForm();
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
  // Mỗi chợ chọn: theo công tơ (ghi chỉ số) hoặc chia đều. Chỉ tài khoản có action:cau-hinh-gia.hinh-thuc-dien-nuoc
  // ở chợ đang chọn (mặc định Tổ trưởng Tổ Quản lý chợ — P chốt 29/09/2026) được đổi; handler kiểm tra lại.
  const UTILITY_MODE_LABEL = {
    METER: ['Theo công tơ từng điểm kinh doanh', 'Nhân viên ghi chỉ số điện, nước hằng tháng; khoản phải thu tính theo chỉ số × đơn giá bên dưới.'],
    SERVICE: ['Chia đều – thu như dịch vụ chợ', 'Không ghi chỉ số. Mỗi tháng Tổ trưởng nhập tiền điện, nước chia đều cho mỗi điểm kinh doanh ngay tại tab này; mọi điểm nộp cùng một mức.']
  };
  const cfgCanUtilityMode = () => U.can('cau-hinh-gia') && A.canDo('cau-hinh-gia.hinh-thuc-dien-nuoc', ui.market);
  function utilityModeCardHtml() {
    const info = A.SERVICE_CFG.utilityModeInfo(ui.market), mode = A.SERVICE_CFG.utilityMode(ui.market), can = cfgCanUtilityMode();
    const opt = k => `<label style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1.5px solid ${mode === k ? '#1d4ed8' : 'var(--line)'};border-radius:10px;flex:1;min-width:260px;cursor:${can ? 'pointer' : 'default'};background:${mode === k ? '#f3f7ff' : 'transparent'}">
        <input type="radio" name="util-mode" ${mode === k ? 'checked' : ''} ${can ? `data-act="cfg-utility-mode" data-id="${k}"` : 'disabled'}><span><b>${UTILITY_MODE_LABEL[k][0]}</b><div class="small muted">${UTILITY_MODE_LABEL[k][1]}</div></span></label>`;
    return `<div class="card"><div class="card-h"><div><h3 style="margin:0">Hình thức thu điện, nước · ${U.esc(U.market(ui.market).name)}</h3>
      <div class="small muted">${can ? 'Tổ trưởng chọn hình thức áp dụng cho chợ mình.' : 'Chỉ Tổ trưởng Tổ Quản lý chợ phụ trách chợ này thay đổi được hình thức thu.'}${info.updatedAt ? ' · Cập nhật ' + U.esc(info.updatedAt) + ' bởi ' + U.esc(info.updatedBy || '') : ''}</div></div></div>
      <div class="card-b"><div class="row" style="gap:10px;flex-wrap:wrap">${opt('METER')}${opt('SERVICE')}</div>
      </div></div>`;
  }
  A.ACT['cfg-utility-mode'] = el => {
    A.render(); // radio chỉ đổi thật khi xác nhận (Hủy → giữ lựa chọn cũ)
    if (!cfgCanUtilityMode()) { U.toast('Bạn không có quyền đổi hình thức thu điện, nước của chợ này'); A.render(); return; }
    const next = el.dataset.id === 'SERVICE' ? 'SERVICE' : 'METER';
    if (next === A.SERVICE_CFG.utilityMode(ui.market)) return;
    A.modal(A.mHead('Đổi hình thức thu điện, nước') + `<div class="modal-b"><p>Chuyển <b>${U.esc(U.market(ui.market).name)}</b> sang: <b>${UTILITY_MODE_LABEL[next][0]}</b>.</p><div class="small muted">${UTILITY_MODE_LABEL[next][1]}</div>
      <div class="note" style="margin-top:10px">Áp dụng cho các lần <b>tính khoản thu</b> từ nay. Khoản phải thu đã phát hành không thay đổi.</div>
      <div class="field" style="margin-top:10px"><label>Lý do / căn cứ *</label><input class="input" id="util-mode-reason" placeholder="VD: Ban Quản lý đề nghị chia đều theo hóa đơn điện lực"></div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="cfg-utility-mode-save" data-id="${next}">Xác nhận đổi</button></div>`);
  };
  A.ACT['cfg-utility-mode-save'] = el => {
    if (!cfgCanUtilityMode()) { U.toast('Bạn không có quyền đổi hình thức thu điện, nước của chợ này'); A.closeModal(); A.render(); return; }
    const reason = ((A.$('#util-mode-reason') || {}).value || '').trim();
    if (!reason) return U.toast('Vui lòng nhập lý do / căn cứ');
    // Thu theo công tơ bắt buộc luôn có giá điện và giá nước đang áp dụng.
    if (el.dataset.id === 'METER') { const miss = ['ELECTRICITY', 'WATER'].filter(k => !A.SERVICE_CFG.utilityPriceAt(ui.market, k, U.today())); if (miss.length) return U.toast('Chưa có ' + miss.map(k => k === 'ELECTRICITY' ? 'giá điện' : 'giá nước').join(', ') + ' đang áp dụng — không chuyển sang thu theo công tơ được'); }
    A.SERVICE_CFG.setUtilityMode(ui.market, el.dataset.id, cfgActor(), reason);
    U.log('Đổi hình thức thu điện, nước ' + ui.market + ' → ' + el.dataset.id + ' (' + reason + ')');
    A.closeModal(); A.render(); U.toast('Đã cập nhật hình thức thu điện, nước');
  };
  // ---------- DIEN_NUOC_CHIA_DEU_THEO_THANG (chợ hình thức SERVICE, P chốt 29/09/2026) ----------
  // Mỗi dòng = 1 loại tiền (điện | nước) × 1 tháng × 1 khu vực (toàn chợ | khu theo ngành hàng | dãy, lấy từ sơ đồ
  // mặt bằng). Đơn giá: chia đều hóa đơn tổng cho số điểm KD của khu vực, hoặc chợ tự đặt mức / điểm theo khu.
  // Thêm dòng cùng loại + tháng + khu vực → dòng cũ "Vô hiệu hóa" (giữ lại, có nhật ký). Tháng đã phát hành khoản
  // thu → khóa. Quyền: action:cau-hinh-gia.them-phi (sẵn có, market_manager) theo chợ đang chọn; handler kiểm tra lại.
  const FLAT_KIND = { ELECTRICITY: 'Tiền điện', WATER: 'Tiền nước' };
  const FLAT_METHOD = { SPLIT_TOTAL: 'Chia đều hóa đơn tổng', AREA_RATE: 'Chợ đặt mức theo khu' };
  const flatIssued = (mid, p) => A.db.invoices.some(i => i.market === mid && i.period === p);
  const flatMonthRange = p => { const [y, m] = p.split('-').map(Number); return [p + '-01', p + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0')]; };
  const flatMonths = mid => { const out = [], d = new Date(U.today().slice(0, 7) + '-01T00:00:00'); for (let k = 0; k < 4; k++) { const p = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); if (!flatIssued(mid, p)) out.push(p); d.setMonth(d.getMonth() + 1); } return out; };
  const flatRows = mid => (A.db.rows || []).filter(r => r.market === mid && r.status !== 'inactive');
  const flatAreaOptions = mid => {
    const rows = flatRows(mid), inds = [];
    rows.forEach(r => { if (r.industry && inds.indexOf(r.industry) === -1) inds.push(r.industry); });
    return [{ id: 'ALL', label: 'Toàn chợ' }]
      .concat(inds.map(x => ({ id: 'IND:' + x, label: 'Khu ' + x + ' (' + rows.filter(r => r.industry === x).map(r => r.code).join(', ') + ')', group: 'Khu theo ngành hàng' })))
      .concat(rows.map(r => ({ id: 'ROW:' + r.id, label: 'Dãy ' + r.code + ' · ' + r.name, group: 'Theo dãy' })));
  };
  const flatAreaLabel = (mid, area) => { const o = flatAreaOptions(mid).find(x => x.id === area); return o ? o.label : area; };
  const flatInArea = (st, area) => { if (area === 'ALL') return true; const r = st && A.idx.row ? A.idx.row.get(st.rowId) : null; if (!r) return false; return area.indexOf('ROW:') === 0 ? r.id === area.slice(4) : area.indexOf('IND:') === 0 ? r.industry === area.slice(4) : false; };
  // Số chia khi chia đều hóa đơn tổng: số điểm KD trên SƠ ĐỒ MẶT BẰNG của khu vực (A.db.stalls theo Dãy), không phụ thuộc hợp đồng.
  const flatMapPoints = (mid, area) => A.db.stalls.filter(st => st.market === mid && flatInArea(st, area)).length;
  // Đơn giá = tổng ÷ số điểm, làm tròn LÊN tới 2 chữ số thập phân (P chốt 29/09/2026).
  const flatSplit = (total, n) => n ? Math.ceil(Number(total) / n * 100 - 1e-9) / 100 : 0;
  const flatMoney = n => Number(n || 0).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' đ';
  const flatPoints = (mid, p, area) => { const [from, to] = flatMonthRange(p); const ids = new Set(A.db.contracts.filter(c => c.market === mid && c.status === 'hieuluc' && c.start <= to && (!c.end || c.end >= from)).map(c => c.businessPointId || c.stallId)); return Array.from(ids).filter(id => flatInArea(A.idx.stall.get(id), area)).length; };
  const cfgCanFlat = () => U.can('cau-hinh-gia') && A.SERVICE_CFG.utilityMode(ui.market) === 'SERVICE' && cfgFeeAddAllowed('utilities', null);
  const flatState = r => r.status !== 'active' ? ['Vô hiệu hóa', 'tag'] : flatIssued(r.marketId, r.period) ? ['Có hiệu lực · đã phát hành, khóa', 'tag purple'] : ['Có hiệu lực', 'tag ok'];
  function utilityFlatCardHtml() {
    const mid = ui.market, can = cfgCanFlat(), months = flatMonths(mid);
    const all = A.SERVICE_CFG.utilityFlatList(mid).slice().sort((a, b) => Number(a.status !== 'active') - Number(b.status !== 'active') || String(b.period).localeCompare(String(a.period)) || String(a.kind).localeCompare(String(b.kind)) || String(b.createdAt).localeCompare(String(a.createdAt)));
    const act = all.filter(r => r.status === 'active'), old = all.filter(r => r.status !== 'active');
    const cols = [{ t: 'STT' }, { t: 'Loại tiền' }, { t: 'Tháng' }, { t: 'Khu vực' }, { t: 'Đơn giá (đ/điểm)', num: true }, { t: 'Căn cứ' }, { t: 'Ghi chú' }, { t: 'Trạng thái' }, { t: '' }];
    const tr = (r, n, faded) => { const st = flatState(r); return `<tr style="${faded ? 'color:#8a93a3' : ''}"><td>${n}</td><td><b>${FLAT_KIND[r.kind] || r.kind}</b></td><td>${U.per(r.period)}</td>
      <td class="small">${U.esc(flatAreaLabel(r.marketId, r.area))}</td>
      <td class="num"><b>${flatMoney(r.perPoint)}</b></td>
      <td class="small">${U.esc(r.basis || '')}</td><td class="small">${U.esc(r.note || '')}</td><td><span class="${st[1]}">${st[0]}</span></td>
      <td><button class="btn sm" data-act="cfg-flat-view" data-id="${r.id}">Xem</button></td></tr>`; };
    return `<div class="card"><div class="card-h"><div><h3 style="margin:0">Tiền điện, nước chia đều theo tháng · ${U.esc(U.market(mid).name)}</h3>
        <div class="small muted">Mỗi dòng là tiền điện hoặc tiền nước của một tháng cho một khu vực. Thêm dòng mới cùng loại, cùng tháng, cùng khu vực thì dòng cũ tự vô hiệu hóa. Mức theo dãy/khu được ưu tiên hơn mức toàn chợ. Tháng đã phát hành khoản thu thì khóa.</div></div><span class="spacer"></span>
        ${can ? (months.length ? '<button class="btn sm primary" data-act="cfg-flat-new">+ Thêm tiền điện, nước</button>' : '<span class="small muted">Không còn tháng nào chưa phát hành để nhập.</span>') : ''}</div>
      <div class="card-b">${U.table(cols, act.map((r, n) => tr(r, n + 1)), { empty: 'Chưa có dòng tiền điện, nước nào. Tháng chưa nhập sẽ bị chặn khi tính/phát hành khoản thu.' })}
        ${old.length ? `<div style="margin-top:10px"><button class="link-btn" data-act="cfg-flat-old">${ui.cfgFlatOld ? '▾ Ẩn' : '▸ Xem'} dòng đã vô hiệu hóa (${old.length})</button></div>${ui.cfgFlatOld ? '<div style="margin-top:6px">' + U.table(cols, old.map((r, n) => tr(r, n + 1, true))) + '</div>' : ''}` : ''}</div></div>`;
  }
  A.ACT['cfg-flat-old'] = () => { if (!U.can('cau-hinh-gia')) return; ui.cfgFlatOld = !ui.cfgFlatOld; A.render(); };
  A.ACT['cfg-flat-view'] = el => {
    if (!U.can('cau-hinh-gia')) return;
    const r = A.SERVICE_CFG.utilityFlatList(ui.market).find(x => x.id === el.dataset.id);
    if (!r) return;
    const st = flatState(r);
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer"><div class="drawer-h"><div><h3>${FLAT_KIND[r.kind]} tháng ${U.per(r.period)}</h3><div class="small muted">${r.id} · <span class="${st[1]}">${st[0]}</span></div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b"><dl class="kv"><dt>Khu vực</dt><dd>${U.esc(flatAreaLabel(r.marketId, r.area))}</dd><dt>Cách tính</dt><dd>${FLAT_METHOD[r.method] || ''}</dd>
        ${r.method === 'SPLIT_TOTAL' ? `<dt>Hóa đơn tổng</dt><dd>${flatMoney(r.total)}</dd><dt>Số điểm trên sơ đồ</dt><dd>${r.pointCount}</dd>` : ''}<dt>Đơn giá</dt><dd><b>${flatMoney(r.perPoint)} / điểm</b></dd>
        <dt>Căn cứ</dt><dd>${U.esc(r.basis || '—')}</dd><dt>Ghi chú</dt><dd>${U.esc(r.note || '—')}</dd><dt>Người nhập</dt><dd>${U.esc(r.createdBy || '')} · ${U.esc(r.createdAt || '')}</dd>
        ${r.status !== 'active' ? `<dt>Vô hiệu hóa</dt><dd>${U.esc(r.inactivatedBy || '')} · ${U.esc(r.inactivatedAt || '')}</dd>` : ''}</dl>
        <div class="divider"></div><b class="small">NHẬT KÝ THAY ĐỔI</b><div style="margin-top:6px">${cfgHistoryHtml(r)}</div></div>
      <div class="drawer-f"><button class="btn" data-act="close">Đóng</button></div></div>`;
  };
  function flatPreview(d) {
    const n = flatMapPoints(ui.market, d.area);
    if (d.method !== 'SPLIT_TOTAL') return `Khu vực có <b>${n}</b> điểm kinh doanh trên sơ đồ mặt bằng. Đơn giá lưu đúng số đã nhập.`;
    return `Hệ thống chia cho <b>${n}</b> điểm kinh doanh trên sơ đồ mặt bằng của khu vực → đơn giá <b>${flatMoney(flatSplit(Number(d.total) || 0, n))}</b> / điểm (làm tròn lên 2 chữ số thập phân).`;
  }
  function renderFlatForm() {
    const d = ui.cfgFlat, months = flatMonths(ui.market), areas = flatAreaOptions(ui.market);
    const cur = A.SERVICE_CFG.utilityFlatActive(ui.market, d.kind, d.period).find(r => r.area === d.area);
    let lastGroup = '';
    const areaOpts = areas.map(o => { const g = o.group && o.group !== lastGroup ? (lastGroup ? '</optgroup>' : '') + `<optgroup label="${U.esc(o.group)}">` : ''; if (o.group) lastGroup = o.group; return g + `<option value="${U.esc(o.id)}" ${d.area === o.id ? 'selected' : ''}>${U.esc(o.label)}</option>`; }).join('') + (lastGroup ? '</optgroup>' : '');
    const num = (k, v) => `<input class="input" type="number" min="0" step="any" data-ch="cfg-flat" data-k="${k}" value="${U.esc(v == null ? '' : v)}">`;
    A.modal(A.mHead('Thêm tiền điện, nước · ' + U.esc(U.market(ui.market).short)) + `<div class="modal-b">
      <div class="grid g2"><div class="field"><label>Loại tiền</label><div class="row" style="gap:16px;padding-top:6px">${Object.keys(FLAT_KIND).map(k => `<label class="row" style="gap:6px"><input type="radio" name="flat-kind" data-ch="cfg-flat" data-k="kind" value="${k}" ${d.kind === k ? 'checked' : ''}> ${FLAT_KIND[k]}</label>`).join('')}</div></div>
        <div class="field"><label>Tháng</label><select class="input" data-ch="cfg-flat" data-k="period">${months.map(p => `<option value="${p}" ${p === d.period ? 'selected' : ''}>Tháng ${U.per(p)}</option>`).join('')}</select></div></div>
      <div class="field" style="margin-top:10px"><label>Khu vực áp dụng (theo sơ đồ chợ)</label><select class="input" data-ch="cfg-flat" data-k="area">${areaOpts}</select></div>
      ${cur ? `<div class="note warn" style="margin-top:8px">Đang có dòng ${FLAT_KIND[d.kind].toLowerCase()} tháng ${U.per(d.period)} cho khu vực này (${flatMoney(cur.perPoint)} / điểm, ${U.esc(cur.createdBy)} ${U.esc(cur.createdAt)}). Lưu dòng mới thì dòng cũ tự vô hiệu hóa.</div>` : ''}
      <div class="field" style="margin-top:10px"><label>Đơn giá</label><div class="row" style="gap:16px;padding-top:6px">${Object.keys(FLAT_METHOD).map(k => `<label class="row" style="gap:6px"><input type="radio" name="flat-method" data-ch="cfg-flat" data-k="method" value="${k}" ${d.method === k ? 'checked' : ''}> ${FLAT_METHOD[k]}</label>`).join('')}</div></div>
      <div class="grid g2" style="margin-top:8px">${d.method === 'SPLIT_TOTAL' ? `<div class="field"><label>${FLAT_KIND[d.kind]} theo hóa đơn tổng của khu vực (đ) *</label>${num('total', d.total)}</div>` : `<div class="field"><label>Mức ${FLAT_KIND[d.kind].toLowerCase()} mỗi điểm KD (đ) *</label>${num('perPoint', d.perPoint)}</div>`}
        <div class="field"><label>Căn cứ *</label><input class="input" data-ch="cfg-flat" data-k="basis" value="${U.esc(d.basis || '')}" placeholder="VD: Hóa đơn điện lực số … tháng ${U.per(d.period)}"></div></div>
      <div class="note info" style="margin-top:8px" id="flat-preview">${flatPreview(d)}</div>
      <div class="field" style="margin-top:10px"><label>Ghi chú</label><input class="input" data-ch="cfg-flat" data-k="note" value="${U.esc(d.note || '')}" placeholder="VD: Khu cá dùng máy bơm, sục khí nên mức cao hơn"></div>
      <div class="small muted" style="margin-top:8px">Sau khi Trưởng Ban phát hành khoản thu của tháng này, các dòng của tháng bị khóa — không sửa được.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="cfg-flat-save">Lưu</button></div>`);
  }
  A.ACT['cfg-flat-new'] = () => {
    if (!cfgCanFlat()) { U.toast('Không có quyền nhập tiền điện, nước chia đều cho chợ này'); return; }
    const months = flatMonths(ui.market);
    if (!months.length) { U.toast('Không còn tháng nào chưa phát hành khoản thu'); return; }
    ui.cfgFlat = { kind: 'ELECTRICITY', period: months[0], area: 'ALL', method: 'SPLIT_TOTAL', total: '', perPoint: '', basis: '', note: '' };
    renderFlatForm();
  };
  A.CH['cfg-flat'] = el => {
    const d = ui.cfgFlat; if (!d) return;
    const k = el.dataset.k;
    d[k] = el.value;
    if (k === 'kind' || k === 'period' || k === 'area' || k === 'method') renderFlatForm();
    else if ((k === 'total' || k === 'perPoint') && A.$('#flat-preview')) A.$('#flat-preview').innerHTML = flatPreview(d);
  };
  A.ACT['cfg-flat-save'] = () => {
    const d = ui.cfgFlat;
    if (!d || !cfgCanFlat()) { U.toast('Không có quyền nhập tiền điện, nước chia đều cho chợ này'); A.closeModal(); A.render(); return; }
    if (!FLAT_KIND[d.kind] || !FLAT_METHOD[d.method]) return;
    if (flatMonths(ui.market).indexOf(d.period) === -1) { U.toast('Tháng ' + U.per(d.period) + ' đã phát hành khoản thu hoặc không hợp lệ — không được nhập'); return; }
    if (!flatAreaOptions(ui.market).some(o => o.id === d.area)) return U.toast('Khu vực không thuộc sơ đồ chợ đang chọn');
    const basis = String(d.basis || '').trim();
    if (!basis) return U.toast('Vui lòng nhập căn cứ');
    let rec;
    if (d.method === 'SPLIT_TOTAL') {
      const total = Number(d.total);
      if (d.total === '' || !(total > 0)) return U.toast('Nhập số tiền theo hóa đơn tổng (> 0)');
      const n = flatMapPoints(ui.market, d.area);
      if (!n) return U.toast('Khu vực này chưa có điểm kinh doanh trên sơ đồ mặt bằng để chia');
      rec = { method: 'SPLIT_TOTAL', total, pointCount: n, perPoint: flatSplit(total, n) };
    } else {
      const per = Number(d.perPoint);
      if (d.perPoint === '' || !(per > 0)) return U.toast('Nhập mức mỗi điểm KD (> 0)');
      rec = { method: 'AREA_RATE', total: null, pointCount: flatMapPoints(ui.market, d.area), perPoint: per };
    }
    const row = A.SERVICE_CFG.addUtilityFlat(Object.assign({ marketId: ui.market, kind: d.kind, period: d.period, area: d.area, basis, note: String(d.note || '').trim() }, rec), cfgActor());
    U.log('Thêm ' + FLAT_KIND[d.kind].toLowerCase() + ' chia đều ' + ui.market + ' tháng ' + U.per(d.period) + ' · ' + flatAreaLabel(ui.market, d.area) + ': ' + row.perPoint + ' đ/điểm (' + basis + ')');
    ui.cfgFlat = null; A.closeModal(); A.render(); U.toast('Đã lưu ' + FLAT_KIND[d.kind].toLowerCase() + ' tháng ' + U.per(d.period));
  };
  // ---------- GIA_DIEN_NUOC_THEO_LOAI (chợ hình thức METER, P chốt 29/09/2026) ----------
  // 2 dòng: giá điện, giá nước — mỗi loại luôn có đúng 1 giá đang áp dụng (không có nút Khóa). Thêm giá mới:
  // hiệu lực từ ngày 01 của tháng sau trở đi (tháng hiện tại vẫn tính giá cũ); giá cũ tự vô hiệu hóa, dữ liệu cũ và
  // nhật ký giữ nguyên. Quyền: action:cau-hinh-gia.them-phi + action:cau-hinh-gia.ap-dung-phi (sẵn có, market_manager)
  // theo chợ đang chọn — kiểm tra lại trong handler lưu.
  const UP_KIND = { ELECTRICITY: ['Giá điện', 'đ/kWh', 'điện'], WATER: ['Giá nước', 'đ/m³', 'nước'] };
  const upToday = () => U.today();
  const upMonthStart = (iso, add) => { const d = new Date(iso.slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() + add); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; };
  const cfgCanUtilPrice = () => U.can('cau-hinh-gia') && A.SERVICE_CFG.utilityMode(ui.market) === 'METER' && cfgFeeActionAllowed('cau-hinh-gia.them-phi', null) && cfgFeeActionAllowed('cau-hinh-gia.ap-dung-phi', null);
  function upState(r) {
    const t = upToday();
    if (r.status === 'cancelled') return ['Đã hủy', 'tag', 3];
    if (r.effectiveTo && r.effectiveTo < t) return ['Vô hiệu hóa', 'tag', 2];
    if (r.effectiveFrom > t) return ['Sắp áp dụng từ ' + U.dmy(r.effectiveFrom), 'tag warn', 1];
    return ['Đang áp dụng', 'tag ok', 0];
  }
  function upRowHtml(r, faded) {
    const st = upState(r), lb = r.legalBasis || {};
    return `<tr style="${faded ? 'color:#8a93a3' : ''}"><td><b>${UP_KIND[r.kind][0]}</b></td><td class="num"><b>${Number(r.price).toLocaleString('vi-VN')}</b><div class="small muted">${U.esc(r.unit)}</div></td>
      <td class="nowrap">Từ ${U.dmy(r.effectiveFrom)}${r.effectiveTo ? `<div class="small muted">đến ${U.dmy(r.effectiveTo)}</div>` : ''}</td>
      <td class="small">${lb.docNo ? U.esc(lb.docNo) : '<span class="muted">—</span>'}${lb.docDate ? `<div class="muted">${U.dmy(lb.docDate)}</div>` : ''}</td>
      <td class="small">${U.esc(r.createdBy || '')}<div class="muted">${U.esc(r.createdAt || '')}</div></td>
      <td><span class="${st[1]}">${st[0]}</span></td><td><button class="btn sm" data-act="cfg-up-view" data-id="${r.id}">Xem</button></td></tr>`;
  }
  function utilityPriceCardHtml() {
    const mid = ui.market, all = A.SERVICE_CFG.utilityPriceList(mid), t = upToday(), can = cfgCanUtilPrice();
    const rows = [], old = [];
    ['ELECTRICITY', 'WATER'].forEach(k => {
      const cur = A.SERVICE_CFG.utilityPriceAt(mid, k, t);
      rows.push(cur ? upRowHtml(cur) : `<tr><td><b>${UP_KIND[k][0]}</b></td><td colspan="5"><span class="tag danger">Chưa có giá ${UP_KIND[k][2]} đang áp dụng</span> <span class="small muted">— bắt buộc khi thu theo công tơ</span></td><td></td></tr>`);
      all.filter(r => r.kind === k && r.status === 'active' && r.effectiveFrom > t).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).forEach(r => rows.push(upRowHtml(r)));
      all.filter(r => r.kind === k && upState(r)[2] >= 2).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).forEach(r => old.push(upRowHtml(r, true)));
    });
    const cols = [{ t: 'Loại' }, { t: 'Mức giá', num: true }, { t: 'Hiệu lực' }, { t: 'Căn cứ (quyết định)' }, { t: 'Người cập nhật' }, { t: 'Trạng thái' }, { t: '' }];
    return `<div class="card"><div class="card-h"><div><h3 style="margin:0">Giá điện, nước theo công tơ · ${U.esc(U.market(mid).name)}</h3>
        <div class="small muted">Mỗi loại luôn có 1 giá đang áp dụng. Thêm giá mới thì giá cũ tự vô hiệu hóa; giá mới tính từ tháng sau, tháng này vẫn tính giá cũ.</div></div><span class="spacer"></span>
        ${can ? '<button class="btn sm primary" data-act="cfg-up-new">+ Thêm giá mới</button>' : ''}</div>
      <div class="card-b">${U.table(cols, rows)}
        ${old.length ? `<div style="margin-top:10px"><button class="link-btn" data-act="cfg-up-old">${ui.cfgUpOld ? '▾ Ẩn' : '▸ Xem'} giá cũ đã vô hiệu hóa (${old.length})</button></div>${ui.cfgUpOld ? '<div style="margin-top:6px">' + U.table(cols, old) + '</div>' : ''}` : ''}</div></div>`;
  }
  A.ACT['cfg-up-old'] = () => { if (!U.can('cau-hinh-gia')) return; ui.cfgUpOld = !ui.cfgUpOld; A.render(); };
  A.ACT['cfg-up-view'] = el => {
    if (!U.can('cau-hinh-gia')) return;
    const r = A.SERVICE_CFG.utilityPriceList(ui.market).find(x => x.id === el.dataset.id);
    if (!r) return;
    const prev = r.prevId ? A.SERVICE_CFG.utilityPriceList(ui.market).find(x => x.id === r.prevId) : null, st = upState(r);
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer"><div class="drawer-h"><div><h3>${UP_KIND[r.kind][0]} · ${U.esc(U.market(r.marketId).short)}</h3><div class="small muted">${r.id} · <span class="${st[1]}">${st[0]}</span></div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b"><dl class="kv"><dt>Mức giá</dt><dd><b>${Number(r.price).toLocaleString('vi-VN')} ${U.esc(r.unit)}</b></dd><dt>Hiệu lực từ</dt><dd>${U.dmy(r.effectiveFrom)}</dd>${r.effectiveTo ? `<dt>Hết hiệu lực</dt><dd>${U.dmy(r.effectiveTo)}</dd>` : ''}
        <dt>Giá trước đó</dt><dd>${prev ? Number(prev.price).toLocaleString('vi-VN') + ' ' + U.esc(prev.unit) + ` <span class="small muted">(${prev.id}, từ ${U.dmy(prev.effectiveFrom)})</span>` : '<span class="muted">—</span>'}</dd>
        <dt>Người cập nhật</dt><dd>${U.esc(r.createdBy || '')} · ${U.esc(r.createdAt || '')}</dd></dl>
        <div class="divider"></div><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(r.legalBasis)}</div>
        <div class="divider"></div><b class="small">NHẬT KÝ THAY ĐỔI</b><div style="margin-top:6px">${cfgHistoryHtml(r)}</div></div>
      <div class="drawer-f"><button class="btn" data-act="close">Đóng</button></div></div>`;
  };
  function renderUpForm() {
    const d = ui.cfgUp, cur = A.SERVICE_CFG.utilityPriceAt(ui.market, d.kind, upToday()), months = [1, 2, 3, 4, 5, 6].map(n => upMonthStart(upToday(), n));
    A.modal(A.mHead('Thêm giá mới · ' + U.esc(U.market(ui.market).short)) + `<div class="modal-b">
      <div class="row" style="gap:16px;margin-bottom:10px">${Object.keys(UP_KIND).map(k => `<label class="row" style="gap:6px"><input type="radio" name="up-kind" data-ch="cfg-up" data-k="kind" value="${k}" ${d.kind === k ? 'checked' : ''}> ${UP_KIND[k][0]}</label>`).join('')}</div>
      <div class="note" style="margin-bottom:10px">Giá ${UP_KIND[d.kind][2]} đang áp dụng: <b>${cur ? Number(cur.price).toLocaleString('vi-VN') + ' ' + U.esc(cur.unit) : 'chưa có'}</b>${cur ? ' (từ ' + U.dmy(cur.effectiveFrom) + ')' : ''}. Tháng này vẫn tính giá cũ; giá mới chỉ tính từ tháng sau.</div>
      <div class="grid g2"><div class="field"><label>Mức giá mới (${UP_KIND[d.kind][1]}) *</label><input class="input" type="number" min="1" data-ch="cfg-up" data-k="price" value="${U.esc(d.price || '')}"></div>
        <div class="field"><label>Áp dụng từ *</label><select class="input" data-ch="cfg-up" data-k="effectiveFrom">${months.map(m => `<option value="${m}" ${d.effectiveFrom === m ? 'selected' : ''}>01/${m.slice(5, 7)}/${m.slice(0, 4)}</option>`).join('')}</select></div></div>
      <div class="grid g2" style="margin-top:10px"><div class="field"><label>Số quyết định *</label><input class="input" data-ch="cfg-up" data-k="docNo" value="${U.esc(d.docNo || '')}" placeholder="VD: 15/QĐ-BQLC"></div>
        <div class="field"><label>Ngày quyết định *</label><input class="input" type="date" data-ch="cfg-up" data-k="docDate" value="${U.esc(d.docDate || '')}"></div></div>
      <div class="field" style="margin-top:10px"><label>Trích yếu / ghi chú</label><input class="input" data-ch="cfg-up" data-k="summary" value="${U.esc(d.summary || '')}" placeholder="VD: Điều chỉnh giá điện theo thông báo của Điện lực"></div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="cfg-up-save">Lưu giá mới</button></div>`);
  }
  A.ACT['cfg-up-new'] = () => {
    if (!cfgCanUtilPrice()) { U.toast('Không có quyền thêm giá điện, nước cho chợ này'); return; }
    ui.cfgUp = { kind: 'ELECTRICITY', price: '', effectiveFrom: upMonthStart(upToday(), 1), docNo: '', docDate: '', summary: '' };
    renderUpForm();
  };
  A.CH['cfg-up'] = el => { const d = ui.cfgUp; if (!d) return; d[el.dataset.k] = el.value; if (el.dataset.k === 'kind') renderUpForm(); };
  A.ACT['cfg-up-save'] = () => {
    const d = ui.cfgUp;
    if (!d || !cfgCanUtilPrice()) { U.toast('Không có quyền thêm giá điện, nước cho chợ này'); A.closeModal(); A.render(); return; }
    if (!UP_KIND[d.kind]) return;
    const price = Number(d.price);
    if (!(price > 0)) return U.toast('Nhập mức giá mới lớn hơn 0');
    if (!/^\d{4}-\d{2}-01$/.test(d.effectiveFrom || '') || d.effectiveFrom < upMonthStart(upToday(), 1)) return U.toast('Giá mới chỉ áp dụng từ ngày 01 của tháng sau trở đi');
    if (!String(d.docNo || '').trim() || !d.docDate) return U.toast('Nhập số và ngày quyết định làm căn cứ');
    const row = A.SERVICE_CFG.addUtilityPrice(ui.market, d.kind, { price, unit: UP_KIND[d.kind][1], effectiveFrom: d.effectiveFrom,
      legalBasis: { docNo: String(d.docNo).trim(), docDate: d.docDate, issuer: 'Ban Quản lý ' + (U.market(ui.market) || {}).short, summary: String(d.summary || '').trim(), effectiveDate: d.effectiveFrom, note: '' } }, cfgActor());
    U.log('Thêm ' + UP_KIND[d.kind][0].toLowerCase() + ' mới ' + ui.market + ': ' + price + ' ' + row.unit + ' từ ' + U.dmy(d.effectiveFrom) + ' (' + d.docNo + ')');
    ui.cfgUp = null; A.closeModal(); A.render(); U.toast('Đã lưu ' + UP_KIND[d.kind][0].toLowerCase() + ' mới, áp dụng từ ' + U.dmy(d.effectiveFrom));
  };
  function settingsDienNuocHtml() {
    if (A.SERVICE_CFG.utilityMode(ui.market) === 'SERVICE') return utilityModeCardHtml() + utilityFlatCardHtml();
    return utilityModeCardHtml() + utilityPriceCardHtml();
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
            ${cfgLifecycleButtons('extraServices', r.id, r.status, canApply, canLock)}
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
          <td class="nowrap"><button class="btn sm" data-act="cfg-svc-view" data-id="${r.id}">Xem</button>${cfgLifecycleButtons('extraServices', r.id, r.status, canApply, canLock)}</td>
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
    A.SERVICE_CFG.add(d.cat, patch, actor);
    U.toast('Đã thêm phí mới ở trạng thái Chưa áp dụng');
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
    return `<div class="card"><div class="card-h"><h3>Kỳ thu</h3></div><div class="card-b">
      <div class="form-grid">
        <div class="field"><label>Chu kỳ thu</label><select class="input" data-ch="bc-cycle" ${dis}><option value="monthly" ${c.cycle === 'monthly' ? 'selected' : ''}>Hàng tháng</option></select></div>
        <div class="field"><label>Ngày chốt chỉ số điện nước</label><input class="input" type="number" min="1" max="31" data-ch="bc-cutoff" value="${c.meterCutoffDay}" ${dis}></div>
        <div class="field"><label>Ngày phát hành khoản phải thu</label><input class="input" type="number" min="1" max="31" data-ch="bc-issue" value="${c.issueDay}" ${dis}></div>
        <div class="field"><label>Hạn nộp</label><input class="input" type="number" min="1" max="31" data-ch="bc-due" value="${c.dueDay}" ${dis}></div>
        <div class="field"><label>Nhắc nợ lần 1 (sau X ngày quá hạn)</label><input class="input" type="number" min="0" data-ch="bc-r1" value="${c.reminder1Days}" ${dis}></div>
        <div class="field"><label>Nhắc nợ lần 2 (sau X ngày quá hạn)</label><input class="input" type="number" min="0" data-ch="bc-r2" value="${c.reminder2Days}" ${dis}></div>
      </div>
      <div class="small muted" style="margin-top:6px">Quá mốc nhắc lần 2 mà chưa nộp: công nợ chuyển thành <b>không thu hồi</b>, vào <b>danh sách cắt điện</b> và hệ thống gửi thông báo cắt điện (luồng kết thúc) — Chợ thu theo phần.</div>
      <div class="row" style="margin-top:12px;gap:20px;flex-wrap:wrap">
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="bc-autoissue" ${c.autoIssue ? 'checked' : ''} ${dis}> Tự động phát hành khoản phải thu</label>
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="bc-autoremind" ${c.autoRemind ? 'checked' : ''} ${dis}> Tự động nhắc nợ</label>
      </div>
      <div class="divider"></div>${settingsPeriodsHtml(canManage)}
      <div class="divider"></div><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(c.legalBasis)}</div>
      ${canManage ? `<button class="btn sm" style="margin-top:8px" data-act="cfg-editlegal" data-cat="billingCycle" data-id="cycle">Sửa căn cứ</button>` : ''}
      <div class="divider"></div><b class="small">TÀI LIỆU</b><div style="margin-top:6px">${cfgAttachHtml(c, 'billingCycle', 'cycle', canManage)}</div>
      <div class="divider"></div><b class="small">LỊCH SỬ</b><div style="margin-top:6px">${cfgHistoryHtml(c)}</div>
    </div></div>`;
  }
  // MO_KY_THU_THANG_MOI: bắt đầu tính tiền tháng mới là việc thiết lập hệ thống (Quản trị hệ thống), không đặt
  // ở màn Khoản phải thu. Dùng lại quyền sẵn có action:cai-dat.ky-thu (không phát sinh permission mới); kỳ thu
  // dùng chung cho mọi chợ. Mở kỳ = tạo kỳ thu + kỳ ghi chỉ số tháng kế tiếp; phát hành vẫn do Trưởng Ban.
  const BP_STATUS = { OPEN: 'Đang mở · chờ ghi chỉ số / tính khoản', COLLECTING: 'Đang thu', PAST: 'Đã qua' };
  function settingsPeriodsHtml(canManage) {
    const bps = (A.db.billingPeriods || []).slice().sort((a, b) => b.id.localeCompare(a.id));
    const mp = id => (A.db.meterPeriods || []).find(x => x.id === id);
    const last = bps[0], lastMp = last && meterGateMp(last.id);
    const blocked = !last ? '' : !A.db.issuedPeriods.includes(last.id) ? 'Kỳ ' + last.label + ' chưa phát hành khoản thu' : lastMp && lastMp.status !== 'CLOSED' ? 'Kỳ ghi chỉ số ' + last.label + ' chưa chốt' : '';
    return `<div class="row" style="align-items:center"><b class="small">KỲ THU ĐÃ MỞ</b><span class="spacer"></span>${canManage ? `<button class="btn sm primary" data-act="cfg-open-period" ${blocked ? `disabled title="${U.esc(blocked)}"` : ''}>Mở kỳ thu tháng mới</button>` : ''}</div>
      ${blocked && canManage ? `<div class="small muted" style="margin-top:4px">Chưa mở được kỳ mới: ${U.esc(blocked)}.</div>` : ''}
      <div style="margin-top:6px">${U.table([{ t: 'Kỳ' }, { t: 'Từ – đến' }, { t: 'Hạn nộp' }, { t: 'Kỳ ghi chỉ số' }, { t: 'Khoản thu' }],
        bps.map(b => { const m = mp(b.id); return `<tr><td><b>${b.label}</b></td><td>${U.dmy(b.startDate)} – ${U.dmy(b.endDate)}</td><td>${U.dmy(b.dueDate)}</td><td>${m ? (m.status === 'CLOSED' ? 'Đã chốt' : 'Đang ghi') : '—'}</td><td>${A.db.issuedPeriods.includes(b.id) ? '<span class="tag ok">Đã phát hành</span>' : '<span class="tag">' + U.esc(BP_STATUS[b.status] || b.status) + '</span>'}</td></tr>`; }))}</div>`;
  }
  // SCREEN_BUSINESS_STATE: chợ thu điện, nước chia đều không có màn ghi chỉ số → kỳ ghi chỉ số chỉ chặn mở kỳ mới khi
  // còn ÍT NHẤT 1 chợ có chỉ số kỳ đó đang thu theo công tơ (tránh kẹt vì không ai chốt được kỳ ghi chỉ số).
  function meterGateMp(periodId) {
    const m = (A.db.meterPeriods || []).find(x => x.id === periodId);
    if (!m) return null;
    const meterMarket = (A.db.readings || []).some(r => { if (r.period !== periodId) return false; const st = A.idx.stall.get(r.stallId);
      return st && !(A.SERVICE_CFG && A.SERVICE_CFG.utilityMode(st.market) === 'SERVICE'); });
    return meterMarket ? m : null;
  }
  A.ACT['cfg-open-period'] = () => {
    if (!cfgCan('ky-thu')) return U.toast('Bạn không có quyền cấu hình kỳ thu');
    const billing = A.features.finance && A.features.finance.billing;
    const bps = (A.db.billingPeriods || []).slice().sort((a, b) => b.id.localeCompare(a.id)), last = bps[0];
    const lastMp = last && meterGateMp(last.id);
    if (!billing || !last) return;
    if (!A.db.issuedPeriods.includes(last.id)) return U.toast('Kỳ ' + last.label + ' chưa phát hành khoản thu');
    if (lastMp && lastMp.status !== 'CLOSED') return U.toast('Kỳ ghi chỉ số ' + last.label + ' chưa chốt');
    const bp = billing.openNextPeriod();
    if (!bp) return U.toast('Không thể mở kỳ thu mới');
    A.SERVICE_CFG.updateCycle({}, cfgActor(), 'Mở kỳ thu ' + bp.label);
    A.render(); U.toast('Đã mở kỳ thu ' + bp.label + ' cho các chợ. NV thu phí ghi chỉ số, Trưởng Ban tính và phát hành khoản thu.');
  };
  const bcGuard = fn => el => { if (!cfgCan('ky-thu')) { U.toast('Bạn không có quyền cấu hình kỳ thu'); A.render(); return; } fn(el); };
  A.CH['bc-cycle'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ cycle: el.value }, cfgActor(), 'Đổi chu kỳ thu'); A.render(); });
  A.CH['bc-cutoff'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ meterCutoffDay: Number(el.value) || 1 }, cfgActor(), 'Đổi ngày chốt chỉ số'); A.render(); });
  A.CH['bc-issue'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ issueDay: Number(el.value) || 1 }, cfgActor(), 'Đổi ngày phát hành'); A.render(); });
  A.CH['bc-due'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ dueDay: Number(el.value) || 1 }, cfgActor(), 'Đổi hạn nộp'); A.render(); });
  A.CH['bc-r1'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ reminder1Days: Number(el.value) || 0 }, cfgActor(), 'Đổi mốc nhắc nợ lần 1'); A.render(); });
  A.CH['bc-r2'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ reminder2Days: Number(el.value) || 0 }, cfgActor(), 'Đổi mốc nhắc nợ lần 2'); A.render(); });
  A.CH['bc-autoissue'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ autoIssue: el.checked }, cfgActor(), el.checked ? 'Bật tự động phát hành' : 'Tắt tự động phát hành'); A.render(); });
  A.CH['bc-autoremind'] = bcGuard(el => { A.SERVICE_CFG.updateCycle({ autoRemind: el.checked }, cfgActor(), el.checked ? 'Bật tự động nhắc nợ' : 'Tắt tự động nhắc nợ'); A.render(); });

  // ---- sub-tab: Quy tắc thu phí ----
  function settingsQuyTacHtml() {
    const r = A.SERVICE_CFG.rules(), canManage = cfgCan('quy-tac-thu-phi'), dis = canManage ? '' : 'disabled';
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

  // ---- router "Chính sách thu và biểu phí" (Tài chính > Quản lý khai báo) ----
  const PRICE_TABS = [['dien-nuoc', 'Điện & nước'], ['dich-vu', 'Dịch vụ chợ'], ['phi-gui-xe', 'Phí gửi xe']];
  A.VIEWS['cau-hinh-gia'] = function () {
    const tab = PRICE_TABS.some(t => t[0] === ui.cfgTab) ? ui.cfgTab : 'dien-nuoc';
    const common = `<section style="margin-bottom:18px"><div class="card-h" style="padding:0 0 8px"><div><h2 style="margin:0">CHÍNH SÁCH CHUNG</h2><div class="small muted">Biểu phí dùng chung do Quản trị hệ thống quản lý và áp dụng theo chính sách hiện hành.</div></div></div>${settingsGiaHtml()}</section>`;
    const bar = `<div class="seg" style="margin:12px 0 14px">${PRICE_TABS.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="cfg-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`;
    const local = `<section><div class="card-h" style="padding:0 0 8px"><div><h2 style="margin:0">CẤU HÌNH THU RIÊNG CỦA CHỢ</h2><div class="small muted"><b>${U.esc(U.market(ui.market).name)}</b> · Điện, nước, dịch vụ chợ và phí phương tiện được cấu hình riêng theo từng chợ.</div></div></div>${bar}${tab === 'dien-nuoc' ? settingsDienNuocHtml() : tab === 'dich-vu' ? settingsDichVuHtml() : settingsVehicleHtml()}</section>`;
    return common + local;
  };
  A.ACT['cfg-tab'] = el => { ui.cfgTab = el.dataset.id === 'gia' ? 'dien-nuoc' : el.dataset.id; A.render(); };
  // Panels hosted by the settings screen (cai-dat).
  const feeConfig = A.features.feeConfig || (A.features.feeConfig = {});
  feeConfig.settingsKyThuHtml = settingsKyThuHtml;
  feeConfig.settingsQuyTacHtml = settingsQuyTacHtml;

  if (!ui.cfgTab || ui.cfgTab === 'gia') ui.cfgTab = 'dien-nuoc';
})(window.APP);
