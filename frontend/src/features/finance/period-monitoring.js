/* Theo dõi kỳ thu: kỳ tháng tổng = AGGREGATION các kỳ của chợ (marketId + YYYY-MM). Trạng thái từng chợ, count và
 * filter đều lấy từ MỘT helper: features/finance/market-period.js (stateOf / FILTERS / monthSummary). */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  const MP = () => A.features.finance.marketPeriod;
  const billing = () => A.features.finance && A.features.finance.billing;
  const periodLabel = key => /^\d{4}-\d{2}$/.test(key) ? key.slice(5) + '/' + key.slice(0, 4) : key;
  const inScope = market => A.allowedMarkets(A.currentAccount()).includes(market);
  const tag = (text, cls) => `<span class="tag ${cls || ''}">${U.esc(text)}</span>`;
  // Màn liên chợ (topbar ẩn): A.canDo(key, market) chỉ khớp ui.market, nên kiểm tra quyền action không gắn chợ
  // + chợ thuộc phạm vi tài khoản — cùng mẫu với Đối soát thu tiền (rcCanConfirm).
  // Phát hành KỲ THU (đồng loạt) — entry point phát hành DUY NHẤT; cần phạm vi đủ toàn bộ chợ như chốt kỳ.
  const canIssuePeriod = () => U.can('theo-doi-ky-thu') && A.canDo('theo-doi-ky-thu.phat-hanh-ky');
  const canCloseMonth = () => U.can('theo-doi-ky-thu') && A.canDo('theo-doi-ky-thu.chot-ky');
  const assignment = () => A.features && A.features.staffAssignment && A.features.staffAssignment.service;
  const collectorName = a => a ? `${a.fullName || a.id} · ${a.code || a.id}` : '';
  // Quyền mở popup theo trạng thái phân công của chợ: chưa có NV → phan-cong-cho; đã có NV/xung đột → doi-nv-phu-trach.
  const canEditAssignment = (staff, st) => !!(staff && st && (st.status === 'UNASSIGNED' ? staff.canAssign() : staff.canReassign()));

  // Một dòng = 1 chợ trong kỳ tháng. Trạng thái = MP().stateOf (helper duy nhất); các cột chỉ là số liệu hiển thị.
  function summary(market, key) {
    const svc = MP(), state = svc.stateOf(market, key), p = state.mp, b = billing();
    const staff = assignment(), collectorState = staff ? staff.marketState(market) : { status: 'UNASSIGNED', collector: null };
    const collector = collectorState.status === 'ASSIGNED' ? collectorState.collector : null;
    const meter = p ? svc.meterStats(p) : { required: 0, recorded: 0 }, meterStatus = p ? svc.meterStatus(p) : 'WAITING';
    const groups = p && b && !svc.isIssued(p) ? b.traderGroups(market, p.id) : [];
    const invoices = p ? svc.invoices(p) : [], paid = invoices.filter(i => i.status === 'paid').length;
    return { market, key, p, state, collector, collectorState, meter, meterStatus, groups, invoices, paid, issued: !!(p && svc.isIssued(p)), recon: p && p.collection ? svc.reconStatus(p) : '' };
  }
  const inFilter = (row, filter) => !filter || filter === 'all' || MP().filterOf(row.state.id) === filter;
  function collectorCellHtml(row) {
    const staff = assignment(), st = row.collectorState || {}, editable = canEditAssignment(staff, st);
    const open = label => editable ? `<div><button class="period-monitor-link small" data-act="period-monitor-assign" data-market="${U.esc(row.market)}">${U.esc(label)}</button></div>` : '';
    if (row.collector) {
      const name = U.esc(row.collector.fullName || row.collector.id), code = `<div class="small muted">${U.esc(row.collector.code || row.collector.id)}</div>`;
      return editable ? `<button class="period-monitor-link" data-act="period-monitor-assign" data-market="${U.esc(row.market)}" title="Phân công nhân viên thu phí">${name}</button>${code}` : `<b>${name}</b>${code}`;
    }
    if (st.status === 'CONFLICT') return tag('Xung đột phân công', 'danger') + open('Xử lý');
    return tag('Chưa phân công', 'warn') + open('Phân công');
  }
  const RECON_TEXT = { WAITING: 'Chờ đối soát', NEEDS_RESOLUTION: 'Cần xử lý chênh lệch', RECONCILED: 'Đã đối soát' };
  // Cột phụ dùng chấm màu nhẹ + chữ; chỉ cột Trạng thái dùng badge.
  const dot = (text, tone) => `<span class="pm-dot pm-dot-${tone || 'muted'}">${U.esc(text)}</span>`;
  function monitorRowHtml(row, key) {
    const market = U.market(row.market) || { name: row.market }, na = row.state.id === 'NOT_APPLICABLE';
    // Mẫu số Điện / Nước = số ĐIỂM cần ghi chỉ số (không dùng số hợp đồng).
    const meterText = na ? '—' : row.meterStatus === 'NOT_REQUIRED' ? 'Không cần ghi' : `${row.meter.recorded}/${row.meter.required}${row.meterStatus === 'COMPLETED' ? ' ✓' : ''}`;
    const list = row.issued ? row.invoices : row.groups, sum = list.reduce((a, x) => a + Number(x.amount || 0), 0);
    const invalid = row.issued ? 0 : row.groups.filter(g => g.validationStatus !== 'VALID').length;
    const receivable = list.length ? `${list.length} khoản · ${U.money(sum)}${invalid ? `<div class="small pm-warn-text">${invalid} cần xử lý</div>` : ''}` : '—';
    const issue = na ? '—' : row.issued ? dot('Đã phát hành', 'ok') : dot('Chưa phát hành');
    const collection = row.issued ? dot(`${row.paid}/${row.invoices.length}`, row.paid === row.invoices.length ? 'ok' : 'info') : '—';
    const recon = !row.issued ? '—' : row.recon ? dot(RECON_TEXT[row.recon], row.recon === 'RECONCILED' ? 'ok' : row.recon === 'NEEDS_RESOLUTION' ? 'danger' : 'warn') : dot('Chưa đối soát');
    const open = `<button class="period-monitor-link" data-act="period-monitor-open" data-market="${U.esc(row.market)}" data-period="${U.esc(key)}" title="${row.state.id === 'NEEDS_ACTION' ? 'Xem lỗi' : 'Xem chi tiết'}"><b>${U.esc(market.name)}</b></button>`;
    return `<tr${na ? ' class="pm-row-na"' : ''}><td>${open}</td><td>${collectorCellHtml(row)}</td><td>${U.esc(meterText)}</td><td>${receivable}</td><td>${issue}</td><td>${collection}</td><td>${recon}</td><td>${MP().stateTag(row.state)}</td></tr>`;
  }
  // Tên chợ dẫn tới màn nghiệp vụ đúng bước hiện tại của chợ.
  function goToMarket(row) {
    if (!row || !inScope(row.market)) return U.toast('Chợ không thuộc phạm vi được phép xem');
    ui.market = row.market;
    ui.periodTrackerBack = true;
    if (row.p) { ui.periodId = row.p.id; ui.period = row.key; if (ui.f) { ui.f.ptPeriod = row.p.id; ui.f.mrPeriod = row.key; } }
    const id = row.state.id;
    if (id === 'WAITING_METER' || id === 'METER_RECORDING' || id === 'UNASSIGNED') return A.go('dien-nuoc');
    if (id === 'COLLECTING' || id === 'COLLECTION_COMPLETED') return A.go('thu-tien');
    // Đối soát thu tiền là màn của Kế toán Trung tâm; tài khoản không có quyền màn đó xem trạng thái tại Thu tiền.
    if (id === 'WAITING_RECONCILIATION' || id === 'NEEDS_RESOLUTION' || id === 'COMPLETED') return A.go(U.can('theo-doi-ky-doi-soat') ? 'theo-doi-ky-doi-soat' : 'thu-tien');
    return A.go('phai-thu');
  }
  // Bộ lọc: 5 lọc chính hiển thị ngang, các trạng thái còn lại trong dropdown "Trạng thái khác" (cùng bảng FILTERS của market-period).
  const MAIN_FILTERS = ['NEEDS_ACTION', 'READY_TO_ISSUE', 'COLLECTING', 'COMPLETED'];
  function monitorView() {
    const svc = MP(), keys = svc.months();
    if (!keys.length) return '<div class="card"><div class="empty">Chưa có kỳ thu để theo dõi.</div></div>';
    const key = keys.includes(ui.periodMonitorPeriod) ? ui.periodMonitorPeriod : (keys.find(k => !svc.monthSummary(k).closed) || keys[0]);
    // Chốt kỳ / phát hành xét TOÀN BỘ chợ đang hoạt động (không theo phạm vi người xem); bảng hiển thị các chợ trong phạm vi.
    const month = svc.monthSummary(key), iss = svc.issueSummary(key), all = month.rows.filter(r => inScope(r.market.id)).map(r => summary(r.market.id, key));
    const fullScope = month.rows.every(r => inScope(r.market.id));
    const q = String(ui.periodMonitorSearch || '').trim().toLowerCase(), filter = ui.periodMonitorFilter || 'all';
    const rows = all.filter(r => inFilter(r, filter) && (!q || [r.market, (U.market(r.market) || {}).name].join(' ').toLowerCase().includes(q)));
    const byFilter = id => all.filter(r => inFilter(r, id)).length;
    // Tiến độ: mẫu số chỉ gồm chợ có đối tượng thu (NOT_APPLICABLE không nằm trong mẫu số).
    const applicable = all.filter(r => r.state.id !== 'NOT_APPLICABLE'), total = applicable.length;
    const meterDone = applicable.filter(r => r.p && svc.meterDone(r.p)).length, calculated = applicable.filter(r => r.issued || r.groups.length > 0).length, issued = applicable.filter(r => r.issued).length;
    const collectionDone = applicable.filter(r => ['COLLECTION_COMPLETED', 'WAITING_RECONCILIATION', 'NEEDS_RESOLUTION', 'COMPLETED'].includes(r.state.id)).length;
    const reconciled = applicable.filter(r => r.state.id === 'COMPLETED').length;
    // Hành động: phase hiện tại quyết định nút nào là primary (không để 2 nút cùng nổi bật).
    const issueDone = !iss.ready.length && !iss.blocking.length && iss.issued.length > 0;
    const canIssue = iss.canIssue && fullScope && canIssuePeriod(), canClose = month.canClose && fullScope && canCloseMonth();
    const scopeNote = !fullScope ? 'Bạn không có phạm vi quản lý đủ toàn bộ chợ của kỳ.' : '';
    let alert = '', alertTone = 'warn';
    if (month.closed) { const c = month.rows[0].state.mp.monthClose || {}; alert = `Đã chốt kỳ${c.closedBy ? ' bởi ' + c.closedBy : ''}${c.closedAt ? ' · ' + c.closedAt : ''}.`; alertTone = 'ok'; }
    else if (!issueDone) {
      if (iss.canIssue) { alert = `${iss.ready.length + iss.notApplicable.length + iss.issued.length}/${iss.rows.length} chợ đủ điều kiện phát hành.` + (scopeNote ? ' ' + scopeNote : !canIssuePeriod() ? ' Bạn chưa được cấp quyền phát hành kỳ thu.' : ''); alertTone = canIssue ? 'ok' : 'warn'; }
      else alert = iss.blocking.length ? `Còn ${iss.blocking.length} chợ chưa đủ điều kiện phát hành.` : 'Không có chợ nào có khoản phải thu để phát hành.';
    } else if (month.canClose) { alert = 'Mọi chợ đã hoàn tất hoặc không áp dụng — đủ điều kiện chốt kỳ.' + (scopeNote ? ' ' + scopeNote : !canCloseMonth() ? ' Bạn chưa được cấp quyền chốt kỳ thu.' : ''); alertTone = canClose ? 'ok' : 'warn'; }
    else alert = `Còn ${month.pending.length} chợ chưa hoàn tất thu hoặc đối soát.`;
    const unassigned = all.filter(r => r.state.id === 'UNASSIGNED').length;
    const summaryLine = `Hoàn tất: ${month.completed} · Không áp dụng: ${month.notApplicable}${month.closed ? '' : ` · Còn ${month.pending.length}/${month.rows.length} chợ chưa hoàn tất`}`;
    const issueBtn = month.closed || issueDone ? '' : `<button class="btn primary" data-act="period-monitor-issue-open" ${canIssue ? '' : `disabled title="${U.esc(alert)}"`}>Phát hành kỳ thu</button>`;
    const closeBtn = month.closed ? '' : `<button class="btn ${issueDone && canClose ? 'primary' : ''}" data-act="period-monitor-close" ${canClose ? '' : `disabled title="${U.esc(issueDone ? alert : 'Chỉ chốt kỳ khi mọi chợ đã hoàn tất hoặc không áp dụng.')}"`}>Chốt kỳ thu</button>`;
    const step = (label, value, done) => `<div class="period-monitor-step ${done ? 'is-done' : ''}"><b>${U.esc(label)}</b><span>${U.esc(value)}</span></div>`;
    const kpi = (label, value, tone) => `<div class="card kpi pm-kpi"><div class="k-label">${label}</div><div class="k-value ${tone || ''}">${value}</div></div>`;
    const more = svc.FILTERS.filter(f => !MAIN_FILTERS.includes(f[0])), moreOn = more.some(f => f[0] === filter);
    const chip = (id, label, n) => `<button class="${filter === id ? 'on' : ''}" data-act="period-monitor-filter" data-id="${id}">${U.esc(label)} (${n})</button>`;
    return `<div class="period-monitor pm-compact">
      <div class="period-monitor-head pm-head"><div><h2>Theo dõi kỳ thu</h2><p>Theo dõi tiến độ chuẩn bị, phát hành, thu tiền và đối soát của kỳ thu theo từng chợ.</p></div>
        <div class="period-monitor-actions"><label class="pm-period">Kỳ thu <select class="input" data-ch="period-monitor-period">${keys.map(k => `<option value="${U.esc(k)}" ${k === key ? 'selected' : ''}>${U.esc(periodLabel(k))}</option>`).join('')}</select></label><span class="tag ${month.closed ? 'ok' : 'info'}">${month.closed ? 'Đã chốt kỳ' : 'Đang theo dõi'}</span>${U.can('thong-bao') ? '<button class="btn" data-act="period-monitor-config">Xem lịch nghiệp vụ</button>' : ''}</div></div>
      <div class="kpis pm-kpis">${kpi('Tổng số chợ', iss.rows.length)}${kpi('Sẵn sàng phát hành', iss.ready.length, iss.ready.length ? 'pm-ok' : '')}${kpi('Chưa đủ điều kiện', iss.blocking.length, iss.blocking.length ? 'pm-bad' : '')}${kpi('Không áp dụng', iss.notApplicable.length)}</div>
      <section class="card pm-progress"><div class="card-b">
        <div class="pm-progress-head"><h3>Tiến độ kỳ thu</h3><span class="small muted">Tính trên ${total} chợ có đối tượng thu</span></div>
        <div class="period-monitor-steps">${step('Ghi chỉ số', `${meterDone}/${total} chợ`, total > 0 && meterDone === total)}${step('Tính khoản thu', `${calculated}/${total} chợ`, total > 0 && calculated === total)}${step('Phát hành', `${issued}/${total} chợ`, total > 0 && issued === total)}${step('Thu tiền', `${collectionDone}/${total} chợ hoàn tất`, total > 0 && collectionDone === total)}${step('Đối soát', `${reconciled}/${total} chợ`, total > 0 && reconciled === total)}${step('Chốt kỳ', month.closed ? 'Đã chốt' : month.canClose ? 'Sẵn sàng' : 'Chưa sẵn sàng', month.closed || month.canClose)}</div>
        <div class="pm-progress-foot"><div class="pm-progress-text"><div class="small">${U.esc(summaryLine)}</div><div class="pm-alert pm-alert-${alertTone}">${U.esc(alert)}${unassigned && !month.closed ? ` <button class="period-monitor-link small" data-act="period-monitor-unassigned">${unassigned} chợ chưa phân công NV thu phí</button>` : ''}</div></div>
          <div class="pm-progress-actions">${issueBtn}${closeBtn}</div></div>
      </div></section>
      ${pendingFeeNoteHtml()}
      <section class="card"><div class="card-h period-monitor-table-head"><div><h3>Theo dõi theo chợ</h3><div class="pm-filters"><div class="seg">${chip('all', 'Tất cả', all.length)}${MAIN_FILTERS.map(id => chip(id, svc.FILTERS.find(f => f[0] === id)[1], byFilter(id))).join('')}</div>
          <select class="input pm-more ${moreOn ? 'on' : ''}" data-ch="period-monitor-filter-more"><option value="">Trạng thái khác</option>${more.map(f => `<option value="${f[0]}" ${filter === f[0] ? 'selected' : ''}>${U.esc(f[1])} (${byFilter(f[0])})</option>`).join('')}</select></div></div>
        <input class="input" data-in="period-monitor-search" value="${U.esc(ui.periodMonitorSearch || '')}" placeholder="Tìm tên chợ..."></div>
        <div class="card-b">${U.table([{ t: 'Chợ' }, { t: 'NV thu phí' }, { t: 'Điện / Nước' }, { t: 'Khoản phải thu' }, { t: 'Phát hành' }, { t: 'Thu tiền' }, { t: 'Đối soát' }, { t: 'Trạng thái' }], rows.map(r => monitorRowHtml(r, key)), { empty: 'Không có chợ phù hợp bộ lọc.' })}</div></section></div>`;
  }
  // Chợ trong phạm vi đã thiết lập mặt bằng nhưng chưa hoạt động (chờ cấu hình mức thu) không có kỳ thu —
  // nêu rõ lý do (vòng đời dùng chung lifecycle.service.marketLifecycle).
  function pendingFeeNoteHtml() {
    const lc = A.features.lifecycle && A.features.lifecycle.service;
    if (!lc || !lc.marketLifecycle) return '';
    const names = A.allowedMarkets(A.currentAccount()).map(id => lc.marketLifecycle(id)).filter(x => x && x.stage === 'PENDING_FEE').map(x => U.mShort(x.marketId));
    return names.length ? `<div class="note pm-pending-fee">Chưa tạo kỳ thu cho ${names.length} chợ: ${U.esc(names.join(', '))}. Chợ chưa hoàn tất cấu hình mức thu.</div>` : '';
  }
  A.VIEWS['theo-doi-ky-thu'] = () => U.can('theo-doi-ky-thu') ? monitorView() : '<div class="card"><div class="empty">Bạn chưa được cấp quyền xem Theo dõi kỳ thu.</div></div>';
  A.CH['period-monitor-period'] = el => { ui.periodMonitorPeriod = el.value; A.render(); };
  A.IN['period-monitor-search'] = el => { ui.periodMonitorSearch = el.value; A.render(); };
  A.ACT['period-monitor-filter'] = el => { ui.periodMonitorFilter = el.dataset.id || 'all'; A.render(); };
  A.CH['period-monitor-filter-more'] = el => { ui.periodMonitorFilter = el.value || 'all'; A.render(); };
  A.ACT['period-monitor-unassigned'] = () => { ui.periodMonitorFilter = 'UNASSIGNED'; A.render(); };
  A.ACT['period-monitor-config'] = () => { if (!U.can('thong-bao')) return U.toast('Bạn chưa được cấp quyền xem Lịch nghiệp vụ'); ui.notificationTab = 'auto'; A.go('thong-bao'); };
  A.ACT['period-monitor-open'] = el => goToMarket(summary(el.dataset.market, el.dataset.period));
  function assignError(result) {
    const text = {
      FORBIDDEN: 'Bạn chưa được cấp quyền phân công chợ.',
      NOT_COLLECTOR: 'Chỉ Nhân viên thu phí đang hoạt động mới nhận phân công.',
      NOT_ACTIVE: 'Nhân viên chưa ở trạng thái Đang hoạt động.',
      OUT_OF_SCOPE: 'Chợ nằm ngoài phạm vi quản lý của bạn.',
      MARKET_CONFLICT: 'Chợ đang có xung đột phân công. Vui lòng kiểm tra phạm vi chợ của các tài khoản liên quan.',
      TARGET_CONFLICT: 'Nhân viên đang có phân công xung đột. Vui lòng kiểm tra phạm vi chợ của tài khoản.',
      TRANSFER_REQUIRED: 'Chợ vừa được phân công cho nhân viên khác. Vui lòng tải lại dữ liệu.'
    };
    return text[result && result.reason] || 'Không thể lưu phân công. Vui lòng thử lại.';
  }
  // Popup phân công theo chợ. Mọi ghi đều qua staffAssignment.service (Account.marketScopes + nhật ký), không có store riêng:
  //   chưa có NV → assignMarket; đổi NV → assignMarket(confirmTransfer) (điều chuyển, gỡ NV cũ trong cùng 1 lần lưu);
  //   xung đột legacy → resolveConflict (chọn 1 người giữ trong các NV đang xung đột).
  function renderQuickAssignModal() {
    const d = ui.periodMonitorAssign, staff = assignment();
    if (!d || !staff) return;
    const state = staff.marketState(d.market), market = U.market(d.market) || { name:d.market };
    if (!canEditAssignment(staff, state)) { ui.periodMonitorAssign = null; A.closeModal(); return U.toast('Bạn chưa được cấp quyền phân công chợ.'); }
    const current = state.status === 'ASSIGNED' ? collectorName(state.collector) : state.status === 'CONFLICT' ? 'Xung đột: ' + state.collectors.map(collectorName).join(', ') : 'Chưa phân công';
    const collectors = state.status === 'CONFLICT' ? state.collectors : staff.eligibleCollectors();
    const unchanged = !d.collectorId || (state.status === 'ASSIGNED' && state.collector.id === d.collectorId);
    A.modal(A.mHead('Phân công nhân viên thu phí') + `<div class="modal-b">
      <dl class="kv"><dt>Chợ</dt><dd><b>${U.esc(market.name)}</b></dd><dt>Nhân viên hiện tại</dt><dd>${U.esc(current)}</dd></dl>
      <div class="field"><label>Nhân viên thu phí *</label><select class="input" data-ch="period-monitor-assign-collector"><option value="">Chọn nhân viên thu phí</option>${collectors.map(a => `<option value="${U.esc(a.id)}" ${d.collectorId === a.id ? 'selected' : ''}>${U.esc(collectorName(a))} — Đang phụ trách ${staff.collectorMarkets(a).length} chợ</option>`).join('')}</select></div>
      <div class="note">${state.status === 'CONFLICT' ? 'Chọn một nhân viên tiếp tục phụ trách; chợ sẽ được gỡ khỏi các nhân viên còn lại.' : 'Phân công áp dụng ổn định theo chợ, không gắn với kỳ thu. Mỗi chợ chỉ có một Nhân viên thu phí phụ trách tại cùng thời điểm; đổi nhân viên sẽ chuyển chợ khỏi nhân viên hiện tại, lịch sử thu tiền giữ nguyên.'}</div>
    </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="period-monitor-assign-save" ${unchanged ? 'disabled' : ''}>Lưu phân công</button></div>`);
  }
  A.ACT['period-monitor-assign'] = el => {
    const staff = assignment(), market = el.dataset.market;
    if (!staff || !A.allowedMarkets(A.currentAccount()).includes(market)) return U.toast('Chợ không thuộc phạm vi được phép.');
    const state = staff.marketState(market);
    if (!canEditAssignment(staff, state)) return U.toast('Bạn chưa được cấp quyền phân công chợ.');
    // Ghi nhận trạng thái lúc mở để phát hiện phân công đã đổi (web khác) trước khi lưu.
    const currentId = state.status === 'ASSIGNED' ? state.collector.id : '';
    ui.periodMonitorAssign = { market, status: state.status, currentId, collectorId: currentId };
    renderQuickAssignModal();
  };
  A.CH['period-monitor-assign-collector'] = el => {
    if (!ui.periodMonitorAssign) return;
    ui.periodMonitorAssign.collectorId = el.value || '';
    renderQuickAssignModal();
  };
  A.ACT['period-monitor-assign-save'] = () => {
    const d = ui.periodMonitorAssign, staff = assignment();
    if (!d || !staff) return;
    const state = staff.marketState(d.market);
    if (!canEditAssignment(staff, state)) return U.toast('Bạn chưa được cấp quyền phân công chợ.');
    if (state.status !== d.status || (state.status === 'ASSIGNED' && state.collector.id !== d.currentId)) return U.toast('Phân công của chợ vừa thay đổi. Vui lòng đóng popup và thử lại.');
    if (!d.collectorId) return U.toast('Vui lòng chọn Nhân viên thu phí.');
    if (state.status === 'ASSIGNED' && d.collectorId === state.collector.id) return U.toast('Nhân viên này đang phụ trách chợ.');
    const result = state.status === 'CONFLICT' ? staff.resolveConflict(d.market, d.collectorId)
      : staff.assignMarket(d.market, d.collectorId, state.status === 'ASSIGNED' ? { confirmTransfer: true } : undefined);
    if (!result || !result.ok) return U.toast(assignError(result));
    ui.periodMonitorAssign = null;
    A.closeModal();
    A.render();
    U.toast('Lưu phân công thành công.');
  };
  // ---- Phát hành kỳ thu: popup xác nhận → market-period.issueMonth (pre-validate toàn bộ, ghi từng chợ qua billing.issue,
  // lỗi giữa chừng thì khôi phục). Chợ Không áp dụng bỏ qua, không tạo khoản rỗng. Không còn phát hành từng chợ.
  function issueContext() {
    const key = ui.periodMonitorPeriod || MP().months()[0], sum = MP().issueSummary(key);
    if (!canIssuePeriod()) return { err: 'Bạn chưa được cấp quyền phát hành kỳ thu.' };
    if (!sum.rows.every(r => inScope(r.market.id))) return { err: 'Bạn không có phạm vi quản lý đủ toàn bộ chợ của kỳ nên không thể phát hành kỳ thu.' };
    if (!sum.canIssue) return { err: sum.blocking.length ? 'Chưa thể phát hành kỳ thu: ' + sum.blocking.map(r => (r.market.name || r.market.id) + ' — ' + r.state.label).join('; ') : 'Không có chợ nào sẵn sàng phát hành.' };
    return { key, sum };
  }
  A.ACT['period-monitor-issue-open'] = () => {
    const c = issueContext();
    if (c.err) return U.toast(c.err);
    const { key, sum } = c;
    A.modal(A.mHead('PHÁT HÀNH KỲ THU ' + periodLabel(key)) + `<div class="modal-b"><dl class="kv"><dt>Tổng số chợ</dt><dd>${sum.rows.length}</dd><dt>Chợ có khoản phải thu</dt><dd>${sum.ready.length}${sum.issued.length ? ' <span class="small muted">(+' + sum.issued.length + ' chợ đã phát hành trước đó)</span>' : ''}</dd><dt>Không áp dụng</dt><dd>${sum.notApplicable.length}</dd><dt>Tổng số khoản phải thu</dt><dd>${sum.receivables}</dd><dt>Tổng dự kiến thu</dt><dd><b>${U.money(sum.amount)}</b></dd></dl>
      <div class="small muted" style="margin-top:6px">Chợ phát hành: ${sum.ready.map(r => U.esc(r.market.name || r.market.id)).join(', ')}</div>
      <div class="note info" style="margin-top:10px">Sau khi phát hành:<br>- khoản phải thu của các chợ áp dụng sẽ được phát hành;<br>- tiểu thương có thể xem và thanh toán;<br>- NV thu phí có thể bắt đầu thu tiền;<br>- hệ thống gửi thông báo khoản phải thu.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="period-monitor-issue-confirm" data-period="${U.esc(key)}">Xác nhận phát hành</button></div>`);
  };
  A.ACT['period-monitor-issue-confirm'] = el => {
    if (el && el.dataset.period) ui.periodMonitorPeriod = el.dataset.period;
    const c = issueContext();
    if (c.err) { A.closeModal(); A.render(); return U.toast(c.err); }
    const out = MP().issueMonth(c.key, A.currentAccount());
    A.closeModal(); A.render();
    if (!out.ok) return U.toast(out.reason === 'ROLLED_BACK' ? 'Phát hành kỳ thu không thành công — đã khôi phục, chưa chợ nào được phát hành. ' + (out.error || '') : 'Chưa thể phát hành kỳ thu: ' + (out.blocking || []).map(r => (r.market.name || r.market.id) + ' — ' + r.state.label).join('; '));
    U.toast(`Đã phát hành kỳ thu ${periodLabel(c.key)}: ${out.count} khoản phải thu tại ${out.results.length} chợ; ${out.notApplicable} chợ không áp dụng.`);
  };
  // XVIII: chốt kỳ tháng — action:theo-doi-ky-thu.chot-ky, phạm vi đủ toàn bộ chợ, mọi chợ COMPLETED/NOT_APPLICABLE.
  A.ACT['period-monitor-close'] = () => {
    const key = ui.periodMonitorPeriod || MP().months()[0], month = MP().monthSummary(key);
    if (!canCloseMonth()) return U.toast('Bạn chưa được cấp quyền chốt kỳ thu.');
    if (!month.rows.every(r => inScope(r.market.id))) return U.toast('Bạn không có phạm vi quản lý đủ toàn bộ chợ của kỳ nên không thể chốt kỳ.');
    const out = MP().closeMonth(key, A.currentAccount());
    if (!out.ok) return U.toast(out.reason === 'ALREADY_CLOSED' ? 'Kỳ thu đã được chốt.' : 'Chưa đủ điều kiện chốt kỳ thu: còn ' + out.pending.length + ' chợ chưa hoàn tất.');
    if (A.NOTIFICATIONS && A.NOTIFICATIONS.dispatchEvent) out.summary.rows.forEach(r => A.NOTIFICATIONS.dispatchEvent('PERIOD_CLOSED', { market:r.market.id, period:r.state.mp, completedMarkets:out.summary.completed, notApplicableMarkets:out.summary.notApplicable }));
    A.render(); U.toast('Đã chốt kỳ thu ' + periodLabel(key) + '. Dữ liệu kỳ chỉ còn phục vụ tra cứu.');
  };
})(window.APP);
