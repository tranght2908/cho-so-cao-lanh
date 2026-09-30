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
  const pointPrice = s => {
    // `U.appliedStallPrice` is the existing source. The category fallback handles
    // the existing fixed-stall TTD seed, whose policy is named after its category.
    const policy = (U.appliedStallPrice ? U.appliedStallPrice(s) : null) || (A.SERVICE_CFG && A.SERVICE_CFG.list ? A.SERVICE_CFG.list('stallPrices').find(p =>
      p.marketId === s.market && p.stallType === s.cat && p.status === 'active' && (!p.effectiveFrom || p.effectiveFrom <= U.today()) && (!p.effectiveTo || p.effectiveTo >= U.today())
    ) : null);
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
      <td><button class="btn sm" data-act="trader" data-id="${t.id}">Xem chi tiết</button>${canCreateIn(t.market) ? ` <button class="btn sm primary" data-act="wf-contract-open" data-id="${t.id}">Tạo hợp đồng</button>` : ''}</td>
    </tr>`).join('');
    return `<div class="card contract-pending-worklist"><div class="card-h" style="flex-wrap:wrap"><div><h3 style="margin:0">TIỂU THƯƠNG CHƯA CÓ HỢP ĐỒNG</h3><div class="small muted" style="margin-top:3px">Các hồ sơ tiểu thương đang chờ bố trí điểm kinh doanh và lập hợp đồng.</div></div><span class="spacer"></span><button class="btn" data-act="wf-contract-worklist-close">← Danh sách hợp đồng</button></div><div class="card-b"><div class="row" style="margin-bottom:12px"><input class="input" data-in="wf-contract-pending-search" placeholder="Tìm mã TT, họ tên, số điện thoại..." value="${U.esc(ui.contractPendingSearch || '')}" aria-label="Tìm tiểu thương chưa có hợp đồng"><span class="spacer"></span><span class="small muted">${all.length} hồ sơ chờ bố trí</span></div>${U.table([{ t: 'Mã TT' }, { t: 'Họ tên' }, { t: 'Số điện thoại' }, showMarket && { t: 'Chợ' }, { t: 'Trạng thái' }, { t: 'Thao tác' }].filter(Boolean), body ? [body] : [], { empty: 'Không có hồ sơ tiểu thương đang chờ bố trí.' })}${pg.html}</div></div>`;
  }

  // ---- Contract form (the ONE create form). Draft keeps values while the dependent
  // Khu → Tầng → Dãy → Điểm selector is rerendered. ----
  let contractFiles = [];
  let draft = null;
  const oneYearLater = start => { const d = new Date(start); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };
  function readDraftFromDom() {
    if (!draft) return;
    const val = sel => { const e = A.$(sel); return e && e.value != null ? String(e.value) : null; };
    const tr = val('#wf-ct-trader'), st = val('#wf-ct-start'), en = val('#wf-ct-end');
    if (tr !== null && !draft.traderLocked) draft.traderId = tr;
    if (st !== null) draft.start = st;
    if (en !== null) draft.end = en;
    ['buildingId', 'floorId', 'rowId', 'pointId'].forEach(key => { const value = val('#wf-ct-' + key.replace('Id', '')); if (value !== null) draft[key] = value; });
    ['electricity', 'water', 'market'].forEach(k => { const e = A.$('#wf-ct-service-' + k); if (e) draft.services[k] = !!e.checked; });
  }
  const pointGraph = point => ({ row: point && BP.row(point), floor: point && BP.floor(point), building: point && BP.building(point) });
  const pointPath = point => { const x = BP.location(point); return [x.khu, x.tang, x.day].filter(v => v && v !== '—').join(' / ') || '—'; };
  const selectionMatches = (point, d) => {
    const x = pointGraph(point);
    return !!point && !!x.row && !!x.building && x.building.id === d.buildingId && x.row.id === d.rowId && (x.floor ? x.floor.id === d.floorId : !d.floorId);
  };
  function setSelectionFromPoint(point) {
    if (!draft || !point) return;
    const x = pointGraph(point);
    draft.buildingId = x.building ? x.building.id : '';
    draft.floorId = x.floor ? x.floor.id : '';
    draft.rowId = x.row ? x.row.id : '';
    draft.pointId = point.id;
  }
  const info = (point, start, end) => {
    const available = BP.isAvailable(point.id, start, end);
    return `<div class="note info" id="wf-ct-stall-info" style="margin-top:10px"><b>THÔNG TIN ĐIỂM ĐÃ CHỌN</b><dl class="kv" style="margin-top:8px"><dt>Mã điểm</dt><dd><b>${U.esc(point.code)}</b></dd><dt>Vị trí</dt><dd>${U.esc(pointPath(point))}</dd><dt>Ngành hàng</dt><dd>${U.esc(BP.industry(point) || 'Chưa có thông tin')}</dd><dt>Diện tích</dt><dd>${Number(point.area || 0).toLocaleString('vi-VN')} m²</dd><dt>Loại diện tích</dt><dd>${U.esc(U.areaTypeLabel(point.areaTypeId) || 'Chưa có thông tin')}</dd><dt>Tình trạng trong thời hạn đã chọn</dt><dd>${available ? '<span style="color:var(--ok)">Còn trống</span>' : '<span class="contract-danger-text">Không khả dụng</span>'}</dd></dl></div>`;
  };
  const feePolicyHtml = p => {
    if (!p) return '<div class="small muted" id="wf-ct-fee-policy">Chọn điểm kinh doanh để xem chính sách thu áp dụng.</div>';
    const rate = pointPrice(p), policy = rate.policy, basis = policy && policy.legalBasis || {};
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
  function pointSelectionHtml(d, selectedPoint) {
    const buildings = (A.db.buildings || []).filter(x => x.market === d.market);
    const building = buildings.find(x => x.id === d.buildingId);
    const floors = building ? (A.db.floors || []).filter(x => x.market === d.market && x.buildingId === building.id) : [];
    const hasFloors = floors.length > 0;
    const candidateRows = building ? (A.db.rows || []).filter(x => x.market === d.market && x.buildingId === building.id && (hasFloors ? x.floorId === d.floorId : !x.floorId)) : [];
    const rows = candidateRows;
    const datesReady = !!d.start && !!d.end && d.end >= d.start;
    const ready = datesReady && !!building && (!hasFloors || !!d.floorId) && !!d.rowId;
    const available = ready ? BP.availablePoints(d.market, d.start, d.end).filter(p => p.rowId === d.rowId) : [];
    const fields = [
      locationSelect('wf-ct-building', 'Khối/Nhà', d.buildingId, buildings.map(x => ({ value: x.id, label: x.name })), '— Chọn Khối/Nhà —', !buildings.length),
      hasFloors ? locationSelect('wf-ct-floor', 'Tầng', d.floorId, floors.map(x => ({ value: x.id, label: x.name })), '— Chọn tầng —', !building) : '',
      locationSelect('wf-ct-row', 'Dãy', d.rowId, rows.map(x => ({ value: x.id, label: x.code + ' · ' + x.industry })), '— Chọn dãy —', !building || (hasFloors && !d.floorId)),
      locationSelect('wf-ct-point', 'Điểm kinh doanh', selectedPoint ? selectedPoint.id : '', available.map(p => ({ value: p.id, label: p.code + ' · ' + Number(p.area || 0).toLocaleString('vi-VN') + ' m²' })), ready ? '— Chọn điểm kinh doanh còn trống —' : '— Chọn Khối/Nhà, Tầng (nếu có), Dãy và thời hạn trước —', !ready)
    ].filter(Boolean).join('');
    return `<div class="form-grid workflow-contract-point-grid">${fields}</div>${selectedPoint ? info(selectedPoint, d.start, d.end) : '<div class="small muted" style="margin-top:10px">Chọn Khối/Nhà, Tầng (nếu có), Dãy và thời hạn để thấy điểm kinh doanh còn trống.</div>'}<div id="wf-ct-point-check-slot">${pointCheckHtml(selectedPoint, d.start, d.end)}</div>`;
  }
  function renderContractForm() {
    const d = draft, traderChoices = contracts.tradersForCreate(d.market), selectedTrader = trader(d.traderId), sv = d.services;
    let p = d.pointId ? stall(d.pointId) : null;
    if (p && (!selectionMatches(p, d) || !BP.isAvailable(p.id, d.start, d.end))) { d.pointId = ''; p = null; }
    const chk = (k, label) => `<label><input id="wf-ct-service-${k}" type="checkbox" ${sv[k] ? 'checked' : ''}> ${label}</label>`;
    A.modal(A.mHead('Tạo hợp đồng') + `<div class="modal-b workflow-contract-form">
      <section><h4>A. TIỂU THƯƠNG</h4>${d.traderLocked && selectedTrader ? `<dl class="kv"><dt>Tiểu thương</dt><dd><b>${U.esc(selectedTrader.name)}</b><br><span class="small muted">${selectedTrader.id} · ${U.maskPhone(selectedTrader.phone)}</span></dd><dt>Trạng thái</dt><dd>${traders.deriveBusinessStatus(selectedTrader) === traders.BUSINESS_STATUS.WAITING_ALLOCATION ? 'Chờ bố trí' : traders.deriveBusinessStatus(selectedTrader) === traders.BUSINESS_STATUS.ACTIVE ? 'Đang hoạt động' : 'Ngừng hoạt động'}</dd></dl>` : `<select class="input" id="wf-ct-trader"><option value="">— Chọn tiểu thương —</option>${traderChoices.map(x => `<option value="${x.id}" ${x.id === d.traderId ? 'selected' : ''}>${x.id} · ${U.esc(x.name)} · ${U.maskPhone(x.phone)}</option>`).join('')}</select>`}</section>
      <section><h4>B. THỜI HẠN</h4><div class="form-grid"><div class="field"><label>Ngày bắt đầu *</label><input class="input" id="wf-ct-start" type="date" value="${U.esc(d.start)}"></div><div class="field"><label>Ngày kết thúc *</label><input class="input" id="wf-ct-end" type="date" value="${U.esc(d.end)}"></div></div></section>
      <section><h4>C. BỐ TRÍ ĐIỂM KINH DOANH</h4>${pointSelectionHtml(d, p)}</section>
      <section><h4>D. CHÍNH SÁCH THU ÁP DỤNG</h4><div class="field"><label>1. Phí sử dụng điểm</label>${feePolicyHtml(p)}<div class="small muted" style="margin-top:8px">Mức dự kiến hiện tại được suy ra từ điểm kinh doanh và chính sách thu đang hiệu lực. Mức thu thực tế từng kỳ được xác định theo chính sách/biểu phí có hiệu lực tại kỳ thu.</div></div><div class="field"><label>2. Dịch vụ tại điểm</label>${chk('electricity', 'Điện')}${chk('water', 'Nước')}${chk('market', 'Dịch vụ chợ')}${p && !p.hasMeter ? '<div class="small muted" style="margin-top:6px">Điểm chưa ghi nhận công tơ; điện/nước sẽ được đối chiếu khi ghi chỉ số kỳ thu.</div>' : ''}<div class="small muted" style="margin-top:6px">Điện và nước được tính ở kỳ thu từ chỉ số công tơ và biểu giá cấu hình, không tính khi tạo hợp đồng.</div></div><div class="field"><label>3. Phương tiện</label><div class="note info">Phương tiện và phí gửi xe được quản lý theo đăng ký phương tiện của tiểu thương.</div></div></section>
      <section><h4>E. HỒ SƠ HỢP ĐỒNG</h4><div id="wf-ct-files" class="${contractFiles.length ? 'small' : 'small muted'}">${contractFiles.length ? contractFiles.map(f => U.esc(f.name)).join('<br>') : 'Chưa có tệp đính kèm.'}</div><button class="btn sm" style="margin-top:8px" data-act="wf-contract-file">Chọn ảnh/scan hợp đồng</button><div class="small muted" style="margin-top:6px">Tệp chỉ được lưu metadata trong prototype.</div></section>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="wf-contract-save">Tạo hợp đồng</button></div>`);
    const refresh = () => { readDraftFromDom(); const point = draft.pointId && stall(draft.pointId); if (point && !BP.isAvailable(point.id, draft.start, draft.end)) draft.pointId = ''; renderContractForm(); };
    ['#wf-ct-start', '#wf-ct-end'].forEach(sel => { const e = A.$(sel); if (e) e.onchange = refresh; });
  }
  // Entry point for every creation path: trader (traderId), available point (preset.pointId + dates),
  // Hợp đồng toolbar. It never creates or occupies anything; only wf-contract-save does.
  function workflowOpenContract(traderId, preset) {
    const pre = preset || {}, selected = trader(traderId), point = pre.pointId ? stall(pre.pointId) : null;
    const market = selected ? selected.market : point ? point.market : ui.market;
    if (!allowedMarket(market) || !canCreateIn(market)) return;
    const choices = contracts.tradersForCreate(market);
    if (!choices.length) return U.toast('Chưa có hồ sơ tiểu thương phù hợp.');
    const start = pre.start || U.today();
    contractFiles = [];
    draft = { market, traderId: selected && choices.some(x => x.id === selected.id) ? selected.id : '', traderLocked: !!selected, pointId: point && point.market === market ? point.id : '', buildingId: '', floorId: '', rowId: '', start, end: pre.end || oneYearLater(start), services: {} };
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
    if (!draft) return;
    readDraftFromDom();
    const key = el.dataset.k, value = el.value;
    if (key === 'building') { draft.buildingId = value; draft.floorId = ''; draft.rowId = ''; draft.pointId = ''; }
    else if (key === 'floor') { draft.floorId = value; draft.rowId = ''; draft.pointId = ''; }
    else if (key === 'row') { draft.rowId = value; draft.pointId = ''; }
    else if (key === 'point') {
      const p = stall(value);
      if (!p || p.market !== draft.market || !selectionMatches(p, draft) || !BP.isAvailable(p.id, draft.start, draft.end)) return U.toast('Điểm kinh doanh không còn phù hợp trong thời hạn đã chọn.');
      draft.pointId = p.id;
    }
    renderContractForm();
  };
  A.features.contracts.form = {
    open: workflowOpenContract,
    active: () => !!draft,
    resume: () => { if (draft) renderContractForm(); },
    pickPoint: id => { readDraftFromDom(); const p = stall(id); if (!draft || !p || p.market !== draft.market) return; setSelectionFromPoint(p); renderContractForm(); }
  };
  A.ACT['wf-contract-file'] = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*,.pdf'; input.multiple = true; input.style.display = 'none';
    input.onchange = () => { contractFiles = contractFiles.concat(Array.from(input.files || []).map(f => ({ name: f.name, type: f.type || '', size: Number(f.size || 0), addedAt: U.today(), mock: true }))); const slot = A.$('#wf-ct-files'); if (slot) { slot.className = 'small'; slot.innerHTML = contractFiles.map(f => U.esc(f.name)).join('<br>'); } input.remove(); };
    document.body.appendChild(input); input.click();
  };
  A.ACT['wf-contract-save'] = () => {
    if (!draft) return;
    readDraftFromDom();
    const t = trader(draft.traderId), s = stall(draft.pointId), start = draft.start, end = draft.end;
    if (!t || !s || !start || !end || end < start || draft.market !== ui.market) return U.toast('Vui lòng kiểm tra tiểu thương, bố trí điểm kinh doanh và thời hạn.');
    if (t.market !== s.market || t.market !== draft.market) return U.toast('Tiểu thương và điểm kinh doanh phải thuộc cùng một chợ.');
    if (!selectionMatches(s, draft)) return U.toast('Vui lòng kiểm tra tiểu thương, bố trí điểm kinh doanh và thời hạn.');
    if (!canCreateIn(s.market) || !allowedMarket(s.market)) return U.toast('Bạn không có quyền tạo hợp đồng tại chợ này.');
    if (!BP.isAllocatable(s)) return U.toast('Điểm ' + s.code + ' đang tạm ngừng, tranh chấp hoặc không còn sử dụng nên không thể bố trí.');
    // Save-time revalidation against CURRENT contract data (never trust an earlier search result).
    if (!BP.isAvailable(s.id, start, end)) return U.toast(overlapMessage(s));
    const rate = pointPrice(s);
    if (!rate.policy) return U.toast('Điểm kinh doanh chưa có chính sách thu đang hiệu lực. Vui lòng cấu hình biểu phí trước khi tạo hợp đồng.');
    const checked = key => { const input = A.$('#wf-ct-service-' + key); return input ? !!input.checked : !!draft.services[key]; };
    const serviceApplicability = { electricity: checked('electricity'), water: checked('water'), marketService: checked('market') };
    const utilityPolicy = (serviceApplicability.electricity || serviceApplicability.water) ? activePolicy('utilities', s.market) : null;
    const c = { id: nextContractId(s.market), traderId: t.id, stallId: s.id, businessPointId: s.id, market: s.market, kind: 'Hợp đồng thuê điểm kinh doanh', signedDate: start, start, end, monthly: rate.monthly, unit: rate.unit, unitLabel: rate.policy.unit || '', feePolicy: policySnapshot(rate), serviceApplicability, utilityPolicyId: utilityPolicy ? utilityPolicy.id : null, deposit: 0, signedCopies: contractFiles.slice(), history: [], status: 'hieuluc' };
    c.history.unshift({ at: U.dmy(U.today()) + ' ' + U.nowTime(), action: 'Khởi tạo hợp đồng', detail: 'Tạo từ luồng hồ sơ tiểu thương' });
    // Contract + point occupancy + trader link + point history + single save (Phase 9 use case).
    contracts.createWithPointAllocation({ contract: c, traderId: t.id, pointId: s.id, pointHistoryEntry: U.dmy(U.today()) + ': ký ' + c.id + ' với ' + t.name + ' (' + U.dmy(start) + ' → ' + U.dmy(end) + ')', beforeSave: () => A.WORKFLOW.markRecentPoint(s.id) });
    draft = null;
    A.closeModal(); A.render();
    A.modal(A.mHead('Tạo hợp đồng thành công') + `<div class="modal-b"><dl class="kv"><dt>Hợp đồng</dt><dd><b>${c.id}</b></dd><dt>Tiểu thương</dt><dd>${U.esc(t.name)}</dd><dt>Điểm kinh doanh</dt><dd>${s.code}</dd><dt>Thời hạn</dt><dd>${U.dmy(start)} → ${U.dmy(end)}</dd></dl>${start > U.today() ? '<div class="note info" style="margin-top:10px">Hợp đồng bắt đầu sau hôm nay: điểm vẫn giữ tình trạng sử dụng hiện tại cho tới ngày bắt đầu, nhưng không còn khả dụng cho khoảng thời gian của hợp đồng này.</div>' : ''}</div><div class="modal-f"><button class="btn" data-act="wf-go-stall" data-id="${s.id}">Đi tới điểm kinh doanh</button><button class="btn primary" data-act="ct-view" data-id="${c.id}">Xem hợp đồng</button></div>`);
    U.toast('Tạo hợp đồng thành công');
  };
  A.ACT['wf-go-stall'] = el => { const s = stall(el.dataset.id); if (!s || !allowedMarket(s.market)) return; ui.market = s.market; A.closeModal(); A.go('mat-bang'); setTimeout(() => { if (A.openDkDrawer) A.openDkDrawer(s); }, 0); };
  A.features.contracts.contractTaskHtml = contractTaskHtml;
  A.features.contracts.pendingContractWorklistHtml = pendingContractWorklistHtml;
})(window.APP);
