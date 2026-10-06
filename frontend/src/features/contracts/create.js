/* Effective contract creation (Phase 15.18, from js/workflow.js): the "Cần xử lý" task (traders without an
 * active contract), the create form (trader + vacant point + term + fees + scans), wf-contract-save which
 * calls contracts.service.createWithPointAllocation, and A.WORKFLOW — the public facade of the
 * profile → contract → account flow (needsContract, needsAccount, recently allocated point marker). */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  const trader = id => A.idx.trader.get(id);
  const stall = id => A.idx.stall.get(id);
  const accounts = A.features.accounts.service;
  const contracts = A.features.contracts.service;
  const traders = A.features.traders.service;
  const RECENT_POINT_KEY = 'choso-caolanh-workflow-recent-point';

  const activePolicy = (category, market) => (A.SERVICE_CFG && A.SERVICE_CFG.list ? A.SERVICE_CFG.list(category) : []).find(p =>
    p.marketId === market && p.status === 'active' && (!p.effectiveFrom || p.effectiveFrom <= U.today()) && (!p.effectiveTo || p.effectiveTo >= U.today())
  ) || null;
  const pointPrice = (s, startDate) => {
    // Preview and submit use the same resolver and the contract's start date.
    const policy = A.SERVICE_CFG && A.SERVICE_CFG.resolveApplicableMarketFeePolicy
      ? A.SERVICE_CFG.resolveApplicableMarketFeePolicy({ point: s, startDate: startDate || U.today() })
      : (U.appliedStallPrice ? U.appliedStallPrice(s, startDate) : null);
    if (!policy) return { policy: null, unit: 0, monthly: null, amount: null, label: 'Chưa cấu hình chính sách thu phù hợp' };
    const unit = Number(policy.amount || 0), area = Number(s.area || 0), policyUnit = String(policy.unit || '');
    let amount = unit, monthly = null;
    if (policyUnit.includes('m²/ngày')) amount = monthly = Math.round(area * unit * 30 / 1000) * 1000;
    else if (policyUnit.includes('m²/tháng')) amount = monthly = Math.round(area * unit);
    else if (policyUnit.includes('/tháng')) amount = monthly = Math.round(unit);
    return { policy, unit, monthly, amount, label: U.money(unit) + '/' + policyUnit.replace(/^đ\//, '') };
  };
  const policySnapshot = rate => rate.policy && ({
    id: rate.policy.id, amount: rate.unit, unit: rate.policy.unit || '', effectiveFrom: rate.policy.effectiveFrom || '', effectiveTo: rate.policy.effectiveTo || null,
    legalBasis: Object.assign({}, rate.policy.legalBasis || {}), collectionCycle: rate.policy.collectionCycle || '', marketModel: rate.policy.marketModel || ''
  });
  const nextContractId = market => contracts.nextId(market, new Date(U.today()).getFullYear(), U.pad);
  const allowedMarket = market => A.allowedMarkets(A.currentAccount()).includes(market);
  // Single semantic source for both cards and the canonical onboarding worklist.
  const needsContract = market => contracts.pendingContractTraders(market);
  const needsAccount = () => accounts.tradersNeedingAccount();
  A.WORKFLOW = {
    needsContract, needsAccount,
    isRecentPoint: id => ui.workflowRecentStallId === id || (() => { try { return sessionStorage.getItem(RECENT_POINT_KEY) === id; } catch (e) { return false; } })(),
    markRecentPoint: id => { ui.workflowRecentStallId = id; try { sessionStorage.setItem(RECENT_POINT_KEY, id); } catch (e) { /* UI marker is optional. */ } }
  };

  const BP = A.features.businessPoints.service;
  const canCreateIn = market => A.canDo('hop-dong.tao', market) || A.canDo('so-do.tao-hop-dong', market);
  const overlapMessage = s => 'Điểm ' + s.code + ' đã có hợp đồng hiệu lực trong một phần thời gian đã chọn. Vui lòng chọn khoảng thời gian hoặc điểm kinh doanh khác.';
  // "Cần xử lý" is shared by Hợp đồng and Hồ sơ tiểu thương. Both CTAs open
  // the same contract-owned worklist, rather than routing into a filtered trader page.
  function contractTaskHtml(opts) {
    const o = opts || {}, rows = needsContract(ui.market);
    return A.UI.pending.summary({ count: rows.length, title: o.title || 'Tiểu thương chưa có hợp đồng', description: 'Các hồ sơ tiểu thương đang chờ bố trí điểm kinh doanh và lập hợp đồng.', action: 'wf-contract-worklist', actionLabel: canCreateIn(ui.market) ? (o.actionLabel || 'Xem & tạo hợp đồng') : 'Xem danh sách' });
  }
  function pendingContractWorklistHtml() {
    const all = needsContract(ui.market), q = String(ui.contractPendingSearch || '').trim().toLowerCase();
    const rows = all.filter(t => !q || [t.id, t.name, t.phone].join(' ').toLowerCase().includes(q));
    const pg = U.pager('contractPending', rows.length, 25), showMarket = ui.market === 'ALL';
    const body = rows.slice(pg.start, pg.end).map(t => `<tr>
      <td><b>${U.esc(t.id)}</b></td><td>${U.esc(t.name)}</td><td>${U.maskPhone(t.phone)}</td>
      ${showMarket ? `<td>${U.esc(U.mShort(t.market))}</td>` : ''}
      <td><span class="tag warn">Chờ bố trí</span></td>
      <td><button class="btn sm" data-act="trader" data-id="${t.id}">Xem chi tiết</button>${canCreateIn(t.market) && t.market === ui.market ? ` <button class="btn sm primary" data-act="wf-contract-open" data-id="${t.id}">Tạo hợp đồng</button>` : ''}</td>
    </tr>`).join('');
    return `<div class="card contract-pending-worklist"><div class="card-h" style="flex-wrap:wrap"><div><h3 style="margin:0">TIỂU THƯƠNG CHƯA CÓ HỢP ĐỒNG</h3><div class="small muted" style="margin-top:3px">Các hồ sơ tiểu thương đang chờ bố trí điểm kinh doanh và lập hợp đồng.</div></div><span class="spacer"></span><button class="btn" data-act="wf-contract-worklist-close">← Danh sách hợp đồng</button></div><div class="card-b"><div class="row" style="margin-bottom:12px"><input class="input" data-in="wf-contract-pending-search" placeholder="Tìm mã TT, họ tên, số điện thoại..." value="${U.esc(ui.contractPendingSearch || '')}" aria-label="Tìm tiểu thương chưa có hợp đồng"><span class="spacer"></span><span class="small muted">${all.length} hồ sơ chờ bố trí</span></div>${U.table([{ t: 'Mã TT' }, { t: 'Họ tên' }, { t: 'Số điện thoại' }, showMarket && { t: 'Chợ' }, { t: 'Trạng thái' }, { t: 'Thao tác' }].filter(Boolean), body ? [body] : [], { empty: 'Không có hồ sơ tiểu thương đang chờ bố trí.' })}${pg.html}</div></div>`;
  }

  // ---- Contract form (the ONE create form). Draft keeps values while the dependent
  // Khu → Tầng → Dãy → Điểm selector is rerendered. ----
  let contractFiles = [];
  let draft = null;
  const oneYearLater = start => { const d = new Date(start); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };
  // MARKET CONTEXT: chợ của form = chợ đang chọn (ui.market) lúc mở; nếu chợ đang chọn đổi khi form còn mở → huỷ bản
  // nháp (không bao giờ lưu dữ liệu cũ sang chợ mới). Trả về false khi đã huỷ.
  function contextOk() {
    if (!draft) return false;
    if (draft.market === ui.market) return true;
    draft = null; contractFiles = [];
    A.closeModal();
    U.toast('Chợ đang chọn đã thay đổi. Bản nháp hợp đồng đã được huỷ, vui lòng mở lại form tại chợ mới.');
    return false;
  }
  function readDraftFromDom() {
    if (!draft) return;
    const val = sel => { const e = A.$(sel); return e && e.value != null ? String(e.value) : null; };
    const ph = val('#wf-ct-phone'), st = val('#wf-ct-start'), en = val('#wf-ct-end');
    // Đổi SĐT sau khi đã tìm → bỏ kết quả cũ (phải bấm Tìm lại), không giữ hồ sơ không còn khớp.
    if (ph !== null && !draft.traderLocked) { draft.phone = ph; if (normPhone(ph) !== draft.lookupPhone) { draft.traderId = ''; draft.lookup = null; draft.lookupPhone = ''; } }
    if (st !== null) draft.start = st;
    if (en !== null) draft.end = en;
    ['buildingId', 'floorId', 'rowId', 'areaTypeId', 'pointId'].forEach(key => { const value = val('#wf-ct-' + key.replace('Id', '')); if (value !== null) draft[key] = value; });
    ['electricity', 'water', 'market'].forEach(k => { const e = A.$('#wf-ct-service-' + k); if (e) draft.services[k] = !!e.checked; });
  }
  const normPhone = v => String(v || '').replace(/\D/g, '');
  // Số điểm đang thuê hôm nay = hợp đồng hiện hành của CHÍNH hồ sơ này (suy từ hợp đồng, không từ tài khoản).
  const rentedNow = t => contracts.listByTrader(t.id).filter(c => contracts.isActive(c) && BP.contractPhase(c, U.today()) === 'current').length;
  const businessStatusLabel = t => { const st = traders.deriveBusinessStatus(t); return st === traders.BUSINESS_STATUS.WAITING_ALLOCATION ? 'Chờ bố trí' : st === traders.BUSINESS_STATUS.ACTIVE ? 'Đang hoạt động' : 'Ngừng hoạt động'; };
  const traderCardHtml = (t, title) => `<div class="wf-ct-found"><div class="wf-ct-found-title">✓ ${title}</div><dl class="kv"><dt>Tên tiểu thương</dt><dd><b>${U.esc(t.name)}</b></dd><dt>Mã hồ sơ</dt><dd>${U.esc(t.id)}</dd><dt>Chợ</dt><dd>${U.esc((U.market(t.market) || { name: t.market }).name)}</dd><dt>Số điểm đang thuê</dt><dd>${rentedNow(t)}</dd><dt>Trạng thái</dt><dd>${businessStatusLabel(t)}</dd></dl></div>`;
  // A. Tiểu thương: tìm hồ sơ ĐÃ CÓ tại chợ hiện tại theo SĐT. Popup không tạo hồ sơ/tài khoản.
  function traderSectionHtml(d, t) {
    if (d.traderLocked && t) return traderCardHtml(t, 'Hồ sơ tiểu thương');
    const lk = d.lookup;
    const result = t && lk && lk.status === 'FOUND' ? traderCardHtml(t, 'Đã tìm thấy hồ sơ')
      : lk && lk.status === 'NOT_FOUND' ? `<div class="note warn">Không tìm thấy hồ sơ tiểu thương tại chợ này. Vui lòng tạo/xử lý hồ sơ tiểu thương trước khi lập hợp đồng.${U.can('tieu-thuong') ? ' <button class="btn sm" data-act="wf-ct-go-traders">Mở Hồ sơ tiểu thương</button>' : ''}</div>`
      : lk && lk.status === 'AMBIGUOUS' ? '<div class="note warn">Có nhiều hồ sơ cùng số điện thoại trong chợ này. Vui lòng xử lý trùng hồ sơ trước khi lập hợp đồng.</div>'
      : lk && lk.status === 'EMPTY' ? '<div class="note warn">Vui lòng nhập số điện thoại.</div>' : '';
    return `<div class="field"><label>Số điện thoại *</label><div class="wf-ct-phone-row"><input class="input" id="wf-ct-phone" inputmode="numeric" placeholder="0xxxxxxxxx" value="${U.esc(d.phone || '')}"><button class="btn" data-act="wf-ct-find-trader">Tìm</button></div></div>${result}`;
  }
  const pointGraph = point => ({ row: point && BP.row(point), floor: point && BP.floor(point), building: point && BP.building(point) });
  const pointPath = point => { const x = BP.location(point); return [x.khu, x.tang, x.day].filter(v => v && v !== '—').join(' / ') || '—'; };
  const selectionMatches = (point, d) => {
    const x = pointGraph(point);
    return !!point && point.market === d.market && !!x.row && x.row.market === d.market && !!x.building && x.building.market === d.market && x.building.id === d.buildingId && x.row.id === d.rowId && (x.floor ? x.floor.id === d.floorId : !d.floorId)
      && !!d.areaTypeId && point.areaTypeId === d.areaTypeId;
  };
  function setSelectionFromPoint(point) {
    if (!draft || !point) return;
    const x = pointGraph(point);
    draft.buildingId = x.building ? x.building.id : '';
    draft.floorId = x.floor ? x.floor.id : '';
    draft.rowId = x.row ? x.row.id : '';
    draft.areaTypeId = point.areaTypeId || '';
    draft.pointId = point.id;
  }
  const info = (point, start, end) => {
    const available = BP.isAvailable(point.id, start, end);
    return `<div class="note info" id="wf-ct-stall-info" style="margin-top:10px"><b>THÔNG TIN ĐIỂM ĐÃ CHỌN</b><dl class="kv" style="margin-top:8px"><dt>Mã điểm</dt><dd><b>${U.esc(point.code)}</b></dd><dt>Vị trí</dt><dd>${U.esc(pointPath(point))}</dd><dt>Ngành hàng</dt><dd>${U.esc(BP.industry(point) || 'Chưa có thông tin')}</dd><dt>Diện tích</dt><dd>${Number(point.area || 0).toLocaleString('vi-VN')} m²</dd><dt>Loại diện tích</dt><dd>${U.esc(U.areaTypeLabel(point.areaTypeId) || 'Chưa có thông tin')}</dd><dt>Tình trạng trong thời hạn đã chọn</dt><dd>${available ? '<span style="color:var(--ok)">Còn trống</span>' : '<span class="contract-danger-text">Không khả dụng</span>'}</dd></dl></div>`;
  };
  const feePolicyHtml = p => {
    if (!p) return '<div class="small muted" id="wf-ct-fee-policy">Chọn điểm kinh doanh để xem chính sách thu áp dụng.</div>';
    const rate = pointPrice(p, draft && draft.start), policy = rate.policy, basis = policy && policy.legalBasis || {};
    return `<dl class="kv" id="wf-ct-fee-policy"><dt>Loại diện tích</dt><dd>${U.esc(U.areaTypeLabel(p.areaTypeId || p.areaType) || 'Chưa có thông tin')}</dd><dt>Diện tích</dt><dd>${p.area} m²</dd><dt>Đơn giá</dt><dd>${policy ? U.money(rate.unit) : '—'}</dd><dt>Đơn vị tính</dt><dd>${policy ? U.esc(policy.unit || '—') : '—'}</dd><dt>Căn cứ / chính sách áp dụng</dt><dd>${policy ? U.esc([basis.docNo, basis.summary].filter(Boolean).join(' · ') || policy.id) : '<span class="tag warn">Chưa có chính sách thu phù hợp</span>'}</dd><dt>Mức dự kiến</dt><dd>${policy ? '<b>' + U.money(rate.amount) + (rate.monthly === null ? ' / phiên' : ' / tháng') + '</b>' : '—'}</dd></dl>`;
  };
  // Live hint only; the binding check is repeated in wf-contract-save.
  function pointCheckHtml(p, start, end) {
    if (!p) return '';
    if (!start || !end || end < start) return '<div class="note" id="wf-ct-point-check" style="margin-top:8px">Nhập ngày bắt đầu và ngày kết thúc hợp lệ để kiểm tra điểm.</div>';
    return BP.isAvailable(p.id, start, end) ? `<div class="small" id="wf-ct-point-check" style="margin-top:6px;color:var(--ok)">✓ Điểm còn trống trong toàn bộ thời hạn ${U.dmy(start)} → ${U.dmy(end)}.</div>` : `<div class="note" id="wf-ct-point-check" style="margin-top:8px"><b>${U.esc(overlapMessage(p))}</b></div>`;
  }
  function locationSelect(id, label, value, values, placeholder, disabled) {
    return `<div class="field"><label>${label} *</label><select class="input" id="${id}" data-ch="wf-ct-location" data-k="${id.replace('wf-ct-', '')}" ${disabled ? 'disabled' : ''}><option value="">${placeholder}</option>${values.map(x => `<option value="${U.esc(x.value || x)}" ${(x.value || x) === value ? 'selected' : ''}>${U.esc(x.label || x)}</option>`).join('')}</select></div>`;
  }
  // Loại diện tích có trên các điểm của Dãy (danh mục chung U.AREA_TYPE_CODES/U.areaTypeLabel; giá trị = areaTypeId).
  const rowAreaTypes = rowId => { const used = new Set(BP.pointsOfRow(rowId).map(p => p.areaTypeId).filter(Boolean)); return (U.AREA_TYPE_CODES || []).filter(c => used.has(c)); };
  function pointSelectionHtml(d, selectedPoint) {
    const buildings = (A.db.buildings || []).filter(x => x.market === d.market);
    const building = buildings.find(x => x.id === d.buildingId);
    const floors = building ? (A.db.floors || []).filter(x => x.market === d.market && x.buildingId === building.id) : [];
    const hasFloors = floors.length > 0;
    const rows = building ? (A.db.rows || []).filter(x => x.market === d.market && x.buildingId === building.id && (hasFloors ? x.floorId === d.floorId : !x.floorId)) : [];
    const rowOk = !!d.rowId && rows.some(x => x.id === d.rowId);
    const areaTypes = rowOk ? rowAreaTypes(d.rowId) : [];
    if (d.areaTypeId && areaTypes.indexOf(d.areaTypeId) === -1) d.areaTypeId = '';
    const datesReady = !!d.start && !!d.end && d.end >= d.start;
    const ready = datesReady && !!building && (!hasFloors || !!d.floorId) && rowOk && !!d.areaTypeId;
    // Điểm còn trống trong TOÀN BỘ thời hạn + đúng Dãy + đúng loại diện tích.
    const available = ready ? BP.availablePoints(d.market, d.start, d.end).filter(p => p.rowId === d.rowId && p.areaTypeId === d.areaTypeId) : [];
    const fields = [
      locationSelect('wf-ct-building', 'Khối/Nhà', d.buildingId, buildings.map(x => ({ value: x.id, label: x.name })), '— Chọn Khối/Nhà —', !buildings.length).replace('<div class="field">', `<div class="field${hasFloors ? '' : ' wf-ct-full'}">`),
      hasFloors ? locationSelect('wf-ct-floor', 'Tầng', d.floorId, floors.map(x => ({ value: x.id, label: x.name })), '— Chọn tầng —', !building) : '',
      locationSelect('wf-ct-row', 'Dãy', d.rowId, rows.map(x => ({ value: x.id, label: x.code + ' · ' + x.industry })), '— Chọn dãy —', !building || (hasFloors && !d.floorId)),
      locationSelect('wf-ct-areaType', 'Loại diện tích', d.areaTypeId, areaTypes.map(c => ({ value: c, label: U.areaTypeLabel(c) || c })), '— Chọn loại diện tích —', !rowOk),
      locationSelect('wf-ct-point', 'Điểm kinh doanh', selectedPoint ? selectedPoint.id : '', available.map(p => ({ value: p.id, label: p.code + ' · ' + Number(p.area || 0).toLocaleString('vi-VN') + ' m²' })), ready ? (available.length ? '— Chọn điểm còn trống —' : '— Không còn điểm trống phù hợp —') : '— Chọn đủ thông tin phía trên —', !ready || !available.length).replace('<div class="field">', '<div class="field wf-ct-full">')
    ].filter(Boolean).join('');
    return `<div class="form-grid workflow-contract-point-grid">${fields}</div>${selectedPoint ? info(selectedPoint, d.start, d.end) : '<p class="wf-ct-help">Chọn Khối/Nhà, Tầng (nếu có), Dãy, Loại diện tích và thời hạn để xem các điểm còn trống trong toàn bộ thời hạn hợp đồng.</p>'}`;
  }
  function renderContractForm() {
    const d = draft, selectedTrader = d.traderId ? trader(d.traderId) : null, sv = d.services;
    let p = d.pointId ? stall(d.pointId) : null;
    if (p && (!selectionMatches(p, d) || !BP.isAvailable(p.id, d.start, d.end))) { d.pointId = ''; p = null; }
    const chk = (k, label) => `<label class="wf-ct-check"><input id="wf-ct-service-${k}" type="checkbox" ${sv[k] ? 'checked' : ''}> ${label}</label>`;
    A.modal(A.mHead('Tạo hợp đồng') + `<div class="modal-b workflow-contract-form">
      <p class="wf-ct-market">Chợ: <b>${U.esc((U.market(d.market) || { name: d.market }).name)}</b></p>
      <section><h4>A. TIỂU THƯƠNG</h4>${traderSectionHtml(d, selectedTrader)}</section>
      <section><h4>B. THỜI HẠN</h4><div class="form-grid"><div class="field"><label>Ngày bắt đầu *</label><input class="input" id="wf-ct-start" type="date" value="${U.esc(d.start)}"></div><div class="field"><label>Ngày kết thúc *</label><input class="input" id="wf-ct-end" type="date" value="${U.esc(d.end)}"></div></div></section>
      <section><h4>C. BỐ TRÍ ĐIỂM KINH DOANH</h4>${pointSelectionHtml(d, p)}</section>
      <section><h4>D. CHÍNH SÁCH THU ÁP DỤNG</h4><div class="field"><label>1. Phí sử dụng điểm</label>${feePolicyHtml(p)}<p class="wf-ct-help">Mức dự kiến hiện tại được suy ra từ điểm kinh doanh và chính sách thu đang hiệu lực. Mức thu thực tế từng kỳ được xác định theo chính sách/biểu phí có hiệu lực tại kỳ thu.</p></div><div class="field"><label>2. Dịch vụ tại điểm</label>${chk('electricity', 'Điện')}${chk('water', 'Nước')}${chk('market', 'Dịch vụ chợ')}${p && !p.hasMeter ? '<p class="wf-ct-help">Điểm chưa ghi nhận công tơ; điện/nước sẽ được đối chiếu khi ghi chỉ số kỳ thu.</p>' : ''}<p class="wf-ct-help">Điện và nước được tính ở kỳ thu từ chỉ số công tơ và biểu giá cấu hình, không tính khi tạo hợp đồng.</p></div></section>
      <section><h4>E. HỒ SƠ HỢP ĐỒNG</h4><div id="wf-ct-files" class="${contractFiles.length ? 'small' : 'small muted'}">${contractFiles.length ? contractFiles.map(f => U.esc(f.name)).join('<br>') : 'Chưa có tệp đính kèm.'}</div><button class="btn sm" style="margin-top:8px" data-act="wf-contract-file">Chọn ảnh/scan hợp đồng</button><p class="wf-ct-help">Tệp chỉ được lưu metadata trong prototype.</p></section>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="wf-contract-save">Tạo hợp đồng</button></div>`);
    const refresh = () => { readDraftFromDom(); const point = draft.pointId && stall(draft.pointId); if (point && !BP.isAvailable(point.id, draft.start, draft.end)) draft.pointId = ''; renderContractForm(); };
    ['#wf-ct-start', '#wf-ct-end'].forEach(sel => { const e = A.$(sel); if (e) e.onchange = refresh; });
    const phoneInput = A.$('#wf-ct-phone');
    if (phoneInput) phoneInput.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); A.ACT['wf-ct-find-trader'](); } };
  }
  // Entry point for every creation path: trader (traderId), available point (preset.pointId + dates),
  // Hợp đồng toolbar. It never creates or occupies anything; only wf-contract-save does.
  function workflowOpenContract(traderId, preset) {
    const pre = preset || {}, selected = trader(traderId), point = pre.pointId ? stall(pre.pointId) : null;
    // Chợ của hợp đồng = chợ đang chọn (không lấy từ hồ sơ/điểm/tài khoản, không mặc định CL).
    const market = ui.market;
    if (!market || !U.market(market)) return U.toast('Vui lòng chọn một chợ cụ thể trước khi tạo hợp đồng.');
    if (!allowedMarket(market) || !canCreateIn(market)) return;
    const marketService = A.features.markets && A.features.markets.service;
    const marketRecord = marketService && marketService.get ? marketService.get(market) : null;
    if (!marketRecord || marketRecord.layoutStatus !== 'SETUP_COMPLETED' || marketRecord.status !== 'ACTIVE') return U.toast('Chợ chưa hoàn tất thiết lập mặt bằng nên chưa thể tạo hợp đồng.');
    if (selected && selected.market !== market) return U.toast('Hồ sơ tiểu thương thuộc chợ khác chợ đang chọn. Vui lòng chuyển sang đúng chợ để lập hợp đồng.');
    if (point && point.market !== market) return U.toast('Điểm kinh doanh thuộc chợ khác chợ đang chọn.');
    const choices = contracts.tradersForCreate(market);
    if (!choices.length) return U.toast('Chưa có hồ sơ tiểu thương phù hợp.');
    const start = pre.start || U.today();
    contractFiles = [];
    const locked = selected && choices.some(x => x.id === selected.id) ? selected : null;
    draft = { market, traderId: locked ? locked.id : '', traderLocked: !!locked, phone: '', lookup: null, lookupPhone: '', pointId: point && point.market === market ? point.id : '', buildingId: '', floorId: '', rowId: '', areaTypeId: '', start, end: pre.end || oneYearLater(start), services: {} };
    if (draft.pointId) setSelectionFromPoint(point);
    renderContractForm();
  }
  A.ACT['wf-contract-open'] = el => workflowOpenContract(el.dataset.id);
  A.ACT['wf-contract-worklist'] = () => {
    // The worklist lives on the Contract route; without that screen the router would fall back elsewhere.
    if (!U.can('hop-dong')) return U.toast('Bạn chưa được cấp quyền xem màn Hợp đồng.');
    ui.contractPendingWorklist = true;
    ui.contractPendingSearch = '';
    ui.page.contractPending = 0;
    A.go('hop-dong');
  };
  A.ACT['wf-contract-worklist-close'] = () => { ui.contractPendingWorklist = false; ui.contractPendingSearch = ''; ui.page.contractPending = 0; A.render(); };
  // Worklist is transient view state of #/hop-dong: leaving the route returns the menu entry to the
  // normal contract list next time. Drawers/modals do not change the hash, so they keep the worklist.
  document.addEventListener('DOMContentLoaded', () => window.addEventListener('hashchange', () => {
    if (!/^#\/?hop-dong(?:$|[/?])/.test(location.hash || '')) { ui.contractPendingWorklist = false; ui.contractPendingSearch = ''; }
  }));
  A.IN['wf-contract-pending-search'] = el => { ui.contractPendingSearch = el.value; ui.page.contractPending = 0; A.render(); };
  A.ACT['ct-new'] = el => {
    if (!A.canDo('hop-dong.tao', ui.market) && !A.canDo('so-do.tao-hop-dong', ui.market)) return;
    const ds = el && el.dataset ? el.dataset : {};
    workflowOpenContract(ds.trader || null, { pointId: ds.point, start: ds.start, end: ds.end });
  };
  A.CH['wf-ct-location'] = el => {
    if (!contextOk()) return;
    readDraftFromDom();
    const key = el.dataset.k, value = el.value;
    if (key === 'building') { draft.buildingId = value; draft.floorId = ''; draft.rowId = ''; draft.areaTypeId = ''; draft.pointId = ''; }
    else if (key === 'floor') { draft.floorId = value; draft.rowId = ''; draft.areaTypeId = ''; draft.pointId = ''; }
    else if (key === 'row') { draft.rowId = value; draft.pointId = ''; } // loại diện tích giữ nếu Dãy mới vẫn có (render đánh giá lại)
    else if (key === 'areaType') { draft.areaTypeId = value; draft.pointId = ''; }
    else if (key === 'point') {
      const p = stall(value);
      if (!p || p.market !== draft.market || !selectionMatches(p, draft) || !BP.isAvailable(p.id, draft.start, draft.end)) return U.toast('Điểm kinh doanh không còn phù hợp trong thời hạn đã chọn.');
      draft.pointId = p.id;
    }
    renderContractForm();
  };
  // Tìm hồ sơ theo (chợ hiện tại, SĐT chuẩn hoá) — không qua tài khoản, không lấy chợ khác, không tạo hồ sơ.
  A.ACT['wf-ct-find-trader'] = () => {
    if (!contextOk() || draft.traderLocked) return;
    readDraftFromDom();
    const r = traders.findByMarketPhone(draft.market, draft.phone);
    draft.lookup = { status: r.status };
    draft.lookupPhone = normPhone(draft.phone);
    draft.traderId = r.trader ? r.trader.id : '';
    renderContractForm();
  };
  A.ACT['wf-ct-go-traders'] = () => { if (!U.can('tieu-thuong')) return; draft = null; A.closeModal(); A.go('tieu-thuong'); };
  A.features.contracts.form = {
    open: workflowOpenContract,
    active: () => !!draft,
    resume: () => { if (contextOk()) renderContractForm(); },
    pickPoint: id => { if (!contextOk()) return; readDraftFromDom(); const p = stall(id); if (!p || p.market !== draft.market) return; setSelectionFromPoint(p); renderContractForm(); }
  };
  A.ACT['wf-contract-file'] = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*,.pdf'; input.multiple = true; input.style.display = 'none';
    input.onchange = () => { contractFiles = contractFiles.concat(Array.from(input.files || []).map(f => ({ name: f.name, type: f.type || '', size: Number(f.size || 0), addedAt: U.today(), mock: true }))); const slot = A.$('#wf-ct-files'); if (slot) { slot.className = 'small'; slot.innerHTML = contractFiles.map(f => U.esc(f.name)).join('<br>'); } input.remove(); };
    document.body.appendChild(input); input.click();
  };
  A.ACT['wf-contract-save'] = () => {
    if (!contextOk()) return;
    readDraftFromDom();
    const t = draft.traderId ? trader(draft.traderId) : null, s = stall(draft.pointId), start = draft.start, end = draft.end;
    // Hồ sơ phải còn khớp đúng (chợ hiện tại, SĐT đã tìm) — không tin trạng thái form.
    if (!t) return U.toast(draft.traderLocked ? 'Không tìm thấy hồ sơ tiểu thương.' : 'Vui lòng tìm hồ sơ tiểu thương theo số điện thoại tại chợ này.');
    if (!draft.traderLocked) { const r = traders.findByMarketPhone(draft.market, draft.phone); if (r.status !== 'FOUND' || r.trader.id !== t.id) return U.toast('Hồ sơ tiểu thương không khớp số điện thoại tại chợ này. Vui lòng tìm lại.'); }
    if (t.market !== draft.market || t.market !== ui.market) return U.toast('Hồ sơ tiểu thương không thuộc chợ hiện tại.');
    if (!s || !start || !end || end < start || draft.market !== ui.market) return U.toast('Vui lòng kiểm tra tiểu thương, bố trí điểm kinh doanh và thời hạn.');
    if (!draft.areaTypeId || s.areaTypeId !== draft.areaTypeId) return U.toast('Điểm kinh doanh không đúng loại diện tích đã chọn.');
    // INVARIANT: chợ đang chọn = chợ hồ sơ = chợ hợp đồng = chợ điểm (kiểm tra lại, không tin form).
    if (!(ui.market === draft.market && t.market === ui.market && s.market === ui.market)) return U.toast('Hồ sơ tiểu thương, điểm kinh doanh và hợp đồng phải thuộc cùng một chợ là chợ đang chọn.');
    if (t.market !== s.market || t.market !== draft.market) return U.toast('Tiểu thương và điểm kinh doanh phải thuộc cùng một chợ.');
    if (!selectionMatches(s, draft)) return U.toast('Vui lòng kiểm tra tiểu thương, bố trí điểm kinh doanh và thời hạn.');
    if (!canCreateIn(s.market) || !allowedMarket(s.market)) return U.toast('Bạn không có quyền tạo hợp đồng tại chợ này.');
    if (!BP.isAllocatable(s)) return U.toast('Điểm ' + s.code + ' đang tạm ngừng, tranh chấp hoặc không còn sử dụng nên không thể bố trí.');
    // Save-time revalidation against CURRENT contract data (never trust an earlier search result).
    if (!BP.isAvailable(s.id, start, end)) return U.toast(overlapMessage(s));
    // Resolve again immediately before submission; rendered form values are not trusted.
    const rate = pointPrice(s, start);
    if (!rate.policy) return U.toast('Điểm kinh doanh chưa có chính sách thu đang hiệu lực. Vui lòng cấu hình biểu phí trước khi tạo hợp đồng.');
    const checked = key => { const input = A.$('#wf-ct-service-' + key); return input ? !!input.checked : !!draft.services[key]; };
    const serviceApplicability = { electricity: checked('electricity'), water: checked('water'), marketService: checked('market') };
    const billing = A.features.finance && A.features.finance.billing;
    const priceTerms = billing && billing.buildPriceTerms ? billing.buildPriceTerms(s.market, s, s.area, start, serviceApplicability, 'CONTRACT') : null;
    if (!priceTerms || !priceTerms.land) return U.toast('Điểm kinh doanh chưa có chính sách thu đang áp dụng tại ngày bắt đầu hợp đồng. Vui lòng cấu hình biểu phí trước khi tạo hợp đồng.');
    const utilityPolicy = (serviceApplicability.electricity || serviceApplicability.water) ? activePolicy('utilities', s.market) : null;
    const market = ui.market; // Contract.market lấy từ chợ đang chọn (đã khớp hồ sơ + điểm ở trên)
    const c = { id: nextContractId(market), traderId: t.id, stallId: s.id, businessPointId: s.id, market, kind: 'Hợp đồng thuê điểm kinh doanh', signedDate: start, start, end, monthly: priceTerms.land.monthly, unit: priceTerms.land.amount, unitLabel: priceTerms.land.unit || '', feePolicy: policySnapshot(rate), priceTerms, serviceApplicability, utilityPolicyId: utilityPolicy ? utilityPolicy.id : null, deposit: 0, signedCopies: contractFiles.slice(), history: [], status: 'ACTIVE', endReason: null };
    c.history.unshift({ at: U.dmy(U.today()) + ' ' + U.nowTime(), action: 'Khởi tạo hợp đồng', detail: 'Tạo từ luồng hồ sơ tiểu thương' });
    // Contract + point occupancy + trader link + point history + single save (Phase 9 use case).
    const saved = contracts.createWithPointAllocation({ contract: c, traderId: t.id, pointId: s.id, pointHistoryEntry: U.dmy(U.today()) + ': ký ' + c.id + ' với ' + t.name + ' (' + U.dmy(start) + ' → ' + U.dmy(end) + ')', beforeSave: () => A.WORKFLOW.markRecentPoint(s.id) });
    if (!saved) return U.toast('Không thể tạo hợp đồng: hồ sơ, điểm kinh doanh và hợp đồng không cùng chợ.');
    draft = null;
    A.closeModal(); A.render();
    A.modal(A.mHead('Tạo hợp đồng thành công') + `<div class="modal-b"><dl class="kv"><dt>Hợp đồng</dt><dd><b>${c.id}</b></dd><dt>Tiểu thương</dt><dd>${U.esc(t.name)}</dd><dt>Điểm kinh doanh</dt><dd>${s.code}</dd><dt>Thời hạn</dt><dd>${U.dmy(start)} → ${U.dmy(end)}</dd></dl>${start > U.today() ? '<div class="note info" style="margin-top:10px">Hợp đồng bắt đầu sau hôm nay: điểm vẫn giữ tình trạng sử dụng hiện tại cho tới ngày bắt đầu, nhưng không còn khả dụng cho khoảng thời gian của hợp đồng này.</div>' : ''}</div><div class="modal-f"><button class="btn" data-act="wf-go-stall" data-id="${s.id}">Đi tới điểm kinh doanh</button><button class="btn primary" data-act="ct-view" data-id="${c.id}">Xem hợp đồng</button></div>`);
    U.toast('Tạo hợp đồng thành công');
  };
  A.ACT['wf-go-stall'] = el => { const s = stall(el.dataset.id); if (!s || !allowedMarket(s.market)) return; ui.market = s.market; A.closeModal(); A.go('mat-bang'); setTimeout(() => { if (A.openDkDrawer) A.openDkDrawer(s); }, 0); };
  A.features.contracts.contractTaskHtml = contractTaskHtml;
  A.features.contracts.pendingContractWorklistHtml = pendingContractWorklistHtml;
})(window.APP);
