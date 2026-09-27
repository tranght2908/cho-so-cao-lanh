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

  const pointPrice = s => {
    const policy = U.appliedStallPrice ? U.appliedStallPrice(s) : null;
    const unit = policy ? Number(policy.amount || 0) : Number((A.D.UNIT || {})[s.type] || 0);
    return { unit, monthly: Math.round(Number(s.area || 0) * unit * 30 / 1000) * 1000, label: policy ? U.unitLabel(s) : 'Chưa cấu hình biểu phí' };
  };
  const nextContractId = market => contracts.nextId(market, new Date(U.today()).getFullYear(), U.pad);
  const allowedMarket = market => A.allowedMarkets(A.currentAccount()).includes(market);
  const needsContract = market => A.db.traders.filter(t => t.market === market && !contracts.hasActiveForTrader(t.id));
  const needsAccount = () => accounts.tradersNeedingAccount();
  A.WORKFLOW = {
    needsContract, needsAccount,
    isRecentPoint: id => ui.workflowRecentStallId === id || (() => { try { return sessionStorage.getItem(RECENT_POINT_KEY) === id; } catch (e) { return false; } })(),
    markRecentPoint: id => { ui.workflowRecentStallId = id; try { sessionStorage.setItem(RECENT_POINT_KEY, id); } catch (e) { /* UI marker is optional. */ } }
  };

  function contractTaskHtml() {
    const rows = needsContract(ui.market);
    if (!rows.length) return '';
    return `<section class="card workflow-task"><div class="card-h"><div><h3>Cần xử lý <span class="tag">${rows.length}</span></h3><div class="small muted">Hồ sơ đã có nhưng chưa có hợp đồng hiệu lực.</div></div></div><div class="card-b">${rows.map(t => `<div class="workflow-task-row"><div><b>${U.esc(t.name)} · ${t.id}</b><div class="small muted">${U.maskPhone(t.phone)} · ${U.esc(marketName(t.market))}</div><div class="small">Chưa có hợp đồng</div></div><button class="btn primary" data-act="wf-contract-open" data-id="${t.id}">Tạo hợp đồng</button></div>`).join('')}</div></section>`;
  }

  let contractFiles = [];
  function workflowOpenContract(traderId) {
    const selected = trader(traderId), market = selected ? selected.market : ui.market;
    const traders = contracts.tradersWithoutActive(market);
    const points = contracts.availablePoints(market);
    if (!traders.length || !points.length) return U.toast(!points.length ? 'Không còn điểm kinh doanh trống phù hợp.' : 'Chưa có hồ sơ tiểu thương phù hợp.');
    const t = selected || traders[0], s = points[0], rate = pointPrice(s), start = U.today(), end = new Date(new Date(start).setFullYear(new Date(start).getFullYear() + 1));
    contractFiles = [];
    const info = p => `<div class="note info" id="wf-ct-stall-info" style="margin-top:8px"><b>${p.code}</b><br>${U.esc(p.sectionName)}<br>Diện tích: ${p.area} m² · Loại diện tích: ${U.esc(U.areaTypeLabel(p.areaType) || 'Chưa có thông tin')}<br>Ngành hàng: ${U.esc(p.cat || 'Chưa có thông tin')}<br>Biểu phí: ${U.esc(pointPrice(p).label)}</div>`;
    A.modal(A.mHead('Tạo hợp đồng') + `<div class="modal-b workflow-contract-form">
      <section><h4>A. TIỂU THƯƠNG</h4><select class="input" id="wf-ct-trader">${traders.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${x.id} · ${U.esc(x.name)} · ${U.maskPhone(x.phone)}</option>`).join('')}</select></section>
      <section><h4>B. ĐIỂM KINH DOANH</h4><select class="input" id="wf-ct-stall">${points.map(x => `<option value="${x.id}">${x.code} · ${U.esc(x.sectionName)} · ${x.area} m²</option>`).join('')}</select>${info(s)}</section>
      <section><h4>C. THỜI HẠN</h4><div class="form-grid"><div class="field"><label>Ngày bắt đầu</label><input class="input" id="wf-ct-start" type="date" value="${start}"></div><div class="field"><label>Ngày kết thúc</label><input class="input" id="wf-ct-end" type="date" value="${end.toISOString().slice(0, 10)}"></div></div></section>
      <section><h4>D. KHOẢN THU / MỨC THU</h4><div class="field"><label>Mức thu tháng</label><input class="input" id="wf-ct-monthly" type="number" min="0" value="${rate.monthly}"></div><div class="field"><label>Khoản thu kèm theo (tên: số tiền, mỗi dòng)</label><textarea class="input" id="wf-ct-fees" rows="3"></textarea></div></section>
      <section><h4>E. HỒ SƠ HỢP ĐỒNG</h4><div id="wf-ct-files" class="small muted">Chưa có tệp đính kèm.</div><button class="btn sm" style="margin-top:8px" data-act="wf-contract-file">Chọn ảnh/scan hợp đồng</button><div class="small muted" style="margin-top:6px">Tệp chỉ được lưu metadata trong prototype.</div></section>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="wf-contract-save">Tạo hợp đồng</button></div>`);
    const pointSelect = A.$('#wf-ct-stall');
    pointSelect.onchange = () => { const p = stall(pointSelect.value), monthly = A.$('#wf-ct-monthly'), box = A.$('#wf-ct-stall-info'); if (p) { monthly.value = pointPrice(p).monthly; box.outerHTML = info(p); } };
  }
  A.ACT['wf-contract-open'] = el => workflowOpenContract(el.dataset.id);
  A.ACT['ct-new'] = el => {
    if (!A.canDo('hop-dong.tao', ui.market) && !A.canDo('so-do.tao-hop-dong', ui.market)) return;
    workflowOpenContract(el && el.dataset ? el.dataset.trader : null);
  };
  A.ACT['wf-contract-file'] = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*,.pdf'; input.multiple = true; input.style.display = 'none';
    input.onchange = () => { contractFiles = contractFiles.concat(Array.from(input.files || []).map(f => ({ name: f.name, type: f.type || '', size: Number(f.size || 0), addedAt: U.today(), mock: true }))); const slot = A.$('#wf-ct-files'); if (slot) { slot.className = 'small'; slot.innerHTML = contractFiles.map(f => U.esc(f.name)).join('<br>'); } input.remove(); };
    document.body.appendChild(input); input.click();
  };
  A.ACT['wf-contract-save'] = () => {
    const t = trader(A.$('#wf-ct-trader').value), s = stall(A.$('#wf-ct-stall').value), start = A.$('#wf-ct-start').value, end = A.$('#wf-ct-end').value;
    if (!t || !s || !start || !end || end < start || s.status !== 'trong' || contracts.hasActiveForTrader(t.id) || contracts.hasActiveForPoint(s.id)) return U.toast('Vui lòng kiểm tra tiểu thương, điểm kinh doanh và thời hạn.');
    const fees = A.$('#wf-ct-fees').value.split('\n').map(x => { const p = x.split(':'); return p.length > 1 ? { name: p[0].trim(), amount: Number(p.slice(1).join(':').trim()) || 0 } : null; }).filter(Boolean);
    const rate = pointPrice(s);
    const c = { id: nextContractId(s.market), traderId: t.id, stallId: s.id, market: s.market, kind: 'Hợp đồng thuê điểm kinh doanh', signedDate: start, start, end, monthly: Number(A.$('#wf-ct-monthly').value) || rate.monthly, unit: rate.unit, unitLabel: 'đ/tháng', deposit: 0, feeSnapshot: fees, signedCopies: contractFiles.slice(), history: [], status: 'hieuluc' };
    c.history.unshift({ at: U.dmy(U.today()) + ' ' + U.nowTime(), action: 'Khởi tạo hợp đồng', detail: 'Tạo từ luồng hồ sơ tiểu thương' });
    // Contract + point occupancy + trader link + point history + single save (Phase 9 use case).
    contracts.createWithPointAllocation({ contract: c, traderId: t.id, pointId: s.id, pointHistoryEntry: U.dmy(U.today()) + ': ký ' + c.id + ' với ' + t.name, beforeSave: () => A.WORKFLOW.markRecentPoint(s.id) });
    A.closeModal(); A.render();
    A.modal(A.mHead('Tạo hợp đồng thành công') + `<div class="modal-b"><dl class="kv"><dt>Hợp đồng</dt><dd><b>${c.id}</b></dd><dt>Tiểu thương</dt><dd>${U.esc(t.name)}</dd><dt>Điểm kinh doanh</dt><dd>${s.code}</dd><dt>Thời hạn</dt><dd>${U.dmy(start)} → ${U.dmy(end)}</dd></dl></div><div class="modal-f"><button class="btn" data-act="wf-go-stall" data-id="${s.id}">Đi tới điểm kinh doanh</button><button class="btn primary" data-act="ct-view" data-id="${c.id}">Xem hợp đồng</button></div>`);
    U.toast('Tạo hợp đồng thành công');
  };
  A.ACT['wf-go-stall'] = el => { const s = stall(el.dataset.id); if (!s || !allowedMarket(s.market)) return; ui.market = s.market; A.closeModal(); A.go('mat-bang'); setTimeout(() => { if (A.openDkDrawer) A.openDkDrawer(s); }, 0); };
  A.features.contracts.contractTaskHtml = contractTaskHtml;
})(window.APP);
