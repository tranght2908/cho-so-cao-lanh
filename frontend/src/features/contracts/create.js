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
  const marketName = id => U.mShort(id);
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
  const needsContract = market => A.db.traders.filter(t => t.market === market && !contracts.hasActiveForTrader(t.id));
  const needsAccount = () => accounts.tradersNeedingAccount();
  A.WORKFLOW = {
    needsContract, needsAccount,
    isRecentPoint: id => ui.workflowRecentStallId === id || (() => { try { return sessionStorage.getItem(RECENT_POINT_KEY) === id; } catch (e) { return false; } })(),
    markRecentPoint: id => { ui.workflowRecentStallId = id; try { sessionStorage.setItem(RECENT_POINT_KEY, id); } catch (e) { /* UI marker is optional. */ } }
  };

  const BP = A.features.businessPoints.service;
  const canCreateIn = market => A.canDo('hop-dong.tao', market) || A.canDo('so-do.tao-hop-dong', market);
  const overlapMessage = s => 'Điểm ' + s.code + ' đã có hợp đồng hiệu lực trong một phần thời gian đã chọn. Vui lòng chọn khoảng thời gian hoặc điểm kinh doanh khác.';
  // "Cần xử lý" = compact summary only; the records open in the paged worklist below. Shared by the
  // Hợp đồng and Hồ sơ tiểu thương pages (same qualification rule: needsContract).
  function contractTaskHtml(opts) {
    const o = opts || {}, rows = needsContract(ui.market);
    return A.UI.pending.summary({ count: rows.length, title: o.title || 'Tiểu thương đủ điều kiện nhưng chưa có hợp đồng', description: 'Hồ sơ tiểu thương chưa có hợp đồng hiệu lực tại chợ đang chọn.', action: 'wf-contract-worklist', actionLabel: canCreateIn(ui.market) ? (o.actionLabel || 'Xem & tạo hợp đồng') : 'Xem danh sách' });
  }
  const traderPoints = t => (t.stalls || []).map(stall).filter(Boolean);
  function pendingContractRows() {
    const q = String(ui.pendingContractSearch || '').trim().toLowerCase();
    return needsContract(ui.market).filter(t => !q || [t.name, t.id, t.phone, marketName(t.market)].concat(traderPoints(t).map(x => x.code)).join(' ').toLowerCase().includes(q));
  }
  function showContractWorklist() {
    const all = needsContract(ui.market), rows = pendingContractRows(), pg = A.UI.pending.pager({ key: 'pendingContracts', total: rows.length, size: 15, action: 'wf-contract-worklist-page' });
    const canCreate = canCreateIn(ui.market);
    const body = rows.slice(pg.start, pg.end).map(t => { const pts = traderPoints(t); return `<div class="pending-work-row"><div><b>${U.esc(t.name)}</b><div class="small muted">${t.id} · ${U.maskPhone(t.phone)} · ${U.esc(marketName(t.market))}</div><div class="small">${pts.length ? 'Điểm KD hiện tại: ' + pts.map(x => x.code).join(', ') : 'Chưa có điểm kinh doanh'} · Chưa có hợp đồng hiệu lực</div></div>${canCreate ? `<button class="btn sm primary" data-act="wf-contract-open" data-id="${t.id}">Tạo hợp đồng</button>` : ''}</div>`; }).join('');
    A.modal(A.UI.pending.worklist({ title: 'Tiểu thương chưa có hợp đồng', count: all.length, searchKey: 'wf-contract-search', searchValue: ui.pendingContractSearch, placeholder: 'Tìm tên, mã TT, SĐT, mã điểm KD...', rows: body, pagerHtml: pg.html }), true);
  }

  // ---- Contract form (the ONE create form). Draft keeps the values while the point picker (the
  // shared availability worklist in selection mode) temporarily replaces the modal. ----
  let contractFiles = [];
  let draft = null;
  const oneYearLater = start => { const d = new Date(start); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };
  function readDraftFromDom() {
    if (!draft) return;
    const val = sel => { const e = A.$(sel); return e && e.value != null ? String(e.value) : null; };
    const tr = val('#wf-ct-trader'), st = val('#wf-ct-start'), en = val('#wf-ct-end');
    if (tr !== null) draft.traderId = tr;
    if (st !== null) draft.start = st;
    if (en !== null) draft.end = en;
    ['electricity', 'water', 'market'].forEach(k => { const e = A.$('#wf-ct-service-' + k); if (e) draft.services[k] = !!e.checked; });
  }
  const pointPath = p => { const x = A.mbLayoutPathForPoint ? A.mbLayoutPathForPoint(p.market, p) : null; return (x && [x.khu, x.tang, x.day].filter(v => v && v !== '—').join(' → ')) || p.sectionName || ''; };
  const info = p => `<div class="note info" id="wf-ct-stall-info" style="margin-top:8px"><b>${p.code}</b><br>${U.esc(pointPath(p))}<br>Diện tích: ${p.area} m² · Loại diện tích: ${U.esc(U.areaTypeLabel(p.areaType) || 'Chưa có thông tin')}<br>Ngành hàng: ${U.esc(p.cat || 'Chưa có thông tin')}<br>Biểu phí: ${U.esc(pointPrice(p).label)}</div>`;
  const feePolicyHtml = p => {
    if (!p) return '<div class="small muted" id="wf-ct-fee-policy">Chọn điểm kinh doanh để xem chính sách thu áp dụng.</div>';
    const rate = pointPrice(p), policy = rate.policy, basis = policy && policy.legalBasis || {};
    return `<dl class="kv" id="wf-ct-fee-policy"><dt>Loại diện tích</dt><dd>${U.esc(U.areaTypeLabel(p.areaType) || 'Chưa có thông tin')}</dd><dt>Diện tích</dt><dd>${p.area} m²</dd><dt>Đơn giá</dt><dd>${policy ? U.money(rate.unit) : '—'}</dd><dt>Đơn vị tính</dt><dd>${policy ? U.esc(policy.unit || '—') : '—'}</dd><dt>Căn cứ / chính sách áp dụng</dt><dd>${policy ? U.esc([basis.docNo, basis.summary].filter(Boolean).join(' · ') || policy.id) : '<span class="tag warn">Chưa có chính sách thu phù hợp</span>'}</dd><dt>Mức dự kiến</dt><dd>${policy ? '<b>' + U.money(rate.amount) + (rate.monthly === null ? ' / phiên' : ' / tháng') + '</b>' : '—'}</dd></dl>`;
  };
  // Live hint only; the binding check is repeated in wf-contract-save.
  function pointCheckHtml(p, start, end) {
    if (!p) return '';
    if (!start || !end || end < start) return '<div class="note" id="wf-ct-point-check" style="margin-top:8px">Nhập ngày bắt đầu và ngày kết thúc hợp lệ để kiểm tra điểm.</div>';
    return BP.isAvailable(p.id, start, end) ? `<div class="small" id="wf-ct-point-check" style="margin-top:6px;color:var(--ok)">✓ Điểm còn trống trong toàn bộ thời hạn ${U.dmy(start)} → ${U.dmy(end)}.</div>` : `<div class="note" id="wf-ct-point-check" style="margin-top:8px"><b>${U.esc(overlapMessage(p))}</b></div>`;
  }
  function renderContractForm() {
    const d = draft, traders = contracts.tradersWithoutActive(d.market), p = d.pointId ? stall(d.pointId) : null, sv = d.services;
    const chk = (k, label) => `<label><input id="wf-ct-service-${k}" type="checkbox" ${sv[k] ? 'checked' : ''}> ${label}</label>`;
    A.modal(A.mHead('Tạo hợp đồng') + `<div class="modal-b workflow-contract-form">
      <section><h4>A. TIỂU THƯƠNG</h4><select class="input" id="wf-ct-trader">${d.traderId ? '' : '<option value="">— Chọn tiểu thương chưa có hợp đồng —</option>'}${traders.map(x => `<option value="${x.id}" ${x.id === d.traderId ? 'selected' : ''}>${x.id} · ${U.esc(x.name)} · ${U.maskPhone(x.phone)}</option>`).join('')}</select></section>
      <section><h4>B. THỜI HẠN</h4><div class="form-grid"><div class="field"><label>Ngày bắt đầu *</label><input class="input" id="wf-ct-start" type="date" value="${U.esc(d.start)}"></div><div class="field"><label>Ngày kết thúc *</label><input class="input" id="wf-ct-end" type="date" value="${U.esc(d.end)}"></div></div></section>
      <section><h4>C. ĐIỂM KINH DOANH</h4><input type="hidden" id="wf-ct-stall" value="${p ? p.id : ''}">${p ? info(p) : '<div class="small muted">Chưa chọn điểm. Chọn thời hạn trước, sau đó chọn trong danh sách điểm còn trống suốt thời hạn đó.</div>'}<div id="wf-ct-point-check-slot">${pointCheckHtml(p, d.start, d.end)}</div><button class="btn sm" style="margin-top:8px" data-act="wf-ct-pick-point">${p ? 'Đổi điểm khả dụng' : 'Chọn điểm khả dụng'}</button></section>
      <section><h4>D. CHÍNH SÁCH THU ÁP DỤNG</h4><div class="field"><label>1. Phí sử dụng điểm</label>${feePolicyHtml(p)}<div class="small muted" style="margin-top:8px">Mức dự kiến được suy ra từ điểm kinh doanh và chính sách thu đang hiệu lực; không nhập tay tại hợp đồng.</div></div><div class="field"><label>2. Dịch vụ tại điểm</label>${chk('electricity', 'Điện')}${chk('water', 'Nước')}${chk('market', 'Dịch vụ chợ')}<div class="small muted" style="margin-top:6px">Điện và nước được tính ở kỳ thu từ chỉ số công tơ và biểu giá cấu hình, không tính khi tạo hợp đồng.</div></div><div class="field"><label>3. Phương tiện</label><div class="note info">Phương tiện và phí gửi xe được quản lý theo đăng ký phương tiện của tiểu thương.</div></div></section>
      <section><h4>E. HỒ SƠ HỢP ĐỒNG</h4><div id="wf-ct-files" class="${contractFiles.length ? 'small' : 'small muted'}">${contractFiles.length ? contractFiles.map(f => U.esc(f.name)).join('<br>') : 'Chưa có tệp đính kèm.'}</div><button class="btn sm" style="margin-top:8px" data-act="wf-contract-file">Chọn ảnh/scan hợp đồng</button><div class="small muted" style="margin-top:6px">Tệp chỉ được lưu metadata trong prototype.</div></section>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="wf-contract-save">Tạo hợp đồng</button></div>`);
    const refresh = () => { readDraftFromDom(); const slot = A.$('#wf-ct-point-check-slot'); if (slot) slot.innerHTML = pointCheckHtml(draft.pointId ? stall(draft.pointId) : null, draft.start, draft.end); };
    ['#wf-ct-start', '#wf-ct-end'].forEach(sel => { const e = A.$(sel); if (e) e.onchange = refresh; });
  }
  // Entry point for every creation path: trader (traderId), available point (preset.pointId + dates),
  // Hợp đồng toolbar. It never creates or occupies anything; only wf-contract-save does.
  function workflowOpenContract(traderId, preset) {
    const pre = preset || {}, selected = trader(traderId), point = pre.pointId ? stall(pre.pointId) : null;
    const market = selected ? selected.market : point ? point.market : ui.market;
    if (!allowedMarket(market) || !canCreateIn(market)) return;
    const traders = contracts.tradersWithoutActive(market);
    if (!traders.length) return U.toast('Chưa có hồ sơ tiểu thương phù hợp.');
    const start = pre.start || U.today();
    contractFiles = [];
    draft = { market, traderId: selected && traders.some(x => x.id === selected.id) ? selected.id : '', pointId: point && point.market === market ? point.id : '', start, end: pre.end || oneYearLater(start), services: {} };
    renderContractForm();
  }
  A.ACT['wf-contract-open'] = el => workflowOpenContract(el.dataset.id);
  A.ACT['wf-contract-worklist'] = () => { ui.page.pendingContracts = 0; showContractWorklist(); };
  A.ACT['wf-contract-worklist-page'] = el => { ui.page[el.dataset.k] = Math.max(0, (ui.page[el.dataset.k] || 0) + Number(el.dataset.d)); showContractWorklist(); };
  A.IN['wf-contract-search'] = el => { ui.pendingContractSearch = el.value; ui.page.pendingContracts = 0; showContractWorklist(); };
  A.ACT['ct-new'] = el => {
    if (!A.canDo('hop-dong.tao', ui.market) && !A.canDo('so-do.tao-hop-dong', ui.market)) return;
    const ds = el && el.dataset ? el.dataset : {};
    workflowOpenContract(ds.trader || null, { pointId: ds.point, start: ds.start, end: ds.end });
  };
  // "Chọn điểm khả dụng": the shared availability worklist in selection mode, bound to the dates.
  A.ACT['wf-ct-pick-point'] = () => {
    if (!draft) return;
    readDraftFromDom();
    if (!draft.start || !draft.end || draft.end < draft.start) return U.toast('Vui lòng nhập ngày bắt đầu và ngày kết thúc hợp lệ trước khi chọn điểm.');
    A.features.businessPoints.availability.open({ pick: true, market: draft.market, from: draft.start, to: draft.end });
  };
  A.features.contracts.form = {
    open: workflowOpenContract,
    active: () => !!draft,
    resume: () => { if (draft) renderContractForm(); },
    pickPoint: id => { const p = stall(id); if (!draft || !p || p.market !== draft.market) return; draft.pointId = p.id; renderContractForm(); }
  };
  A.ACT['wf-contract-file'] = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*,.pdf'; input.multiple = true; input.style.display = 'none';
    input.onchange = () => { contractFiles = contractFiles.concat(Array.from(input.files || []).map(f => ({ name: f.name, type: f.type || '', size: Number(f.size || 0), addedAt: U.today(), mock: true }))); const slot = A.$('#wf-ct-files'); if (slot) { slot.className = 'small'; slot.innerHTML = contractFiles.map(f => U.esc(f.name)).join('<br>'); } input.remove(); };
    document.body.appendChild(input); input.click();
  };
  A.ACT['wf-contract-save'] = () => {
    readDraftFromDom();
    const t = trader(A.$('#wf-ct-trader').value), s = stall(A.$('#wf-ct-stall').value), start = A.$('#wf-ct-start').value, end = A.$('#wf-ct-end').value;
    if (!t || !s || !start || !end || end < start || t.market !== s.market || contracts.hasActiveForTrader(t.id)) return U.toast('Vui lòng kiểm tra tiểu thương, điểm kinh doanh và thời hạn.');
    if (!canCreateIn(s.market) || !allowedMarket(s.market)) return U.toast('Bạn không có quyền tạo hợp đồng tại chợ này.');
    if (!BP.isAllocatable(s)) return U.toast('Điểm ' + s.code + ' đang tạm ngừng, tranh chấp hoặc không còn sử dụng nên không thể bố trí.');
    // Save-time revalidation against CURRENT contract data (never trust an earlier search result).
    if (!BP.isAvailable(s.id, start, end)) return U.toast(overlapMessage(s));
    const rate = pointPrice(s);
    if (!rate.policy) return U.toast('Điểm kinh doanh chưa có chính sách thu đang hiệu lực. Vui lòng cấu hình biểu phí trước khi tạo hợp đồng.');
    const serviceApplicability = {
      electricity: !!A.$('#wf-ct-service-electricity').checked,
      water: !!A.$('#wf-ct-service-water').checked,
      marketService: !!A.$('#wf-ct-service-market').checked
    };
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
})(window.APP);
