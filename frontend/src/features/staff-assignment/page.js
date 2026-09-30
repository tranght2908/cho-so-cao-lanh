/* Màn "Nhân sự & phân công" (Điều hành) — route nhan-su-phan-cong. MỘT bảng nhân sự Tổ Quản lý chợ + bộ lọc
 * (vai trò / chợ / phân công); "chợ nào chưa có NV thu phí" xem ở KPI "Chợ chưa phân công" (popover chỉ đọc).
 * Chỉ presentation/workflow; dữ liệu và luật ghi ở ./service.js
 * (Account + Account.marketScopes qua A.ACCOUNTS.saveCollectorAccount). Không tạo/sửa/khóa tài khoản ở đây —
 * các nghiệp vụ đó thuộc "Tài khoản người dùng". */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  const S = A.features && A.features.staffAssignment && A.features.staffAssignment.service;
  if (!S) return;

  const INCIDENT_SCOPE_LABEL = 'Theo sự cố được giao';
  const STATUS = { ACTIVE: ['Đang hoạt động', 'ok'], PENDING_ACTIVATION: ['Chờ kích hoạt', 'warn'], LOCKED: ['Tạm khóa', 'danger'] };
  const RESOLVE_HINT = '(ô "Chợ chưa phân công" → Xử lý)';
  const ERRORS = {
    FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
    NOT_COLLECTOR: 'Chỉ Nhân viên thu phí đang hoạt động mới được phân công chợ.',
    NOT_ACTIVE: 'Nhân viên chưa ở trạng thái Đang hoạt động nên không nhận phân công mới.',
    OUT_OF_SCOPE: 'Chợ nằm ngoài phạm vi quản lý của bạn.',
    MARKET_CONFLICT: 'Chợ đang có xung đột phân công. Vui lòng xử lý xung đột trước ' + RESOLVE_HINT + '.',
    TARGET_CONFLICT: 'Nhân viên đang có chợ bị xung đột phân công. Vui lòng xử lý xung đột trước ' + RESOLVE_HINT + '.',
    TRANSFER_REQUIRED: 'Chợ vừa được phân công cho nhân viên khác. Vui lòng kiểm tra lại trước khi lưu.',
    NO_CONFLICT: 'Chợ không còn xung đột phân công.',
    KEEPER_NOT_IN_CONFLICT: 'Nhân viên được chọn không nằm trong danh sách đang xung đột.'
  };
  const errorText = r => ERRORS[r && r.reason] || 'Không thể lưu phân công. Vui lòng thử lại.';

  const EMPTY_FILTER = () => ({ search: '', role: '', market: '', assign: '' });
  function state() { return ui.staffAssign || (ui.staffAssign = EMPTY_FILTER()); }
  const roleOf = a => A.ACCOUNTS.primaryRole(a);
  const roleName = a => { const r = A.PERM.role(roleOf(a)); return r ? r.name : (roleOf(a) || '—'); };
  const marketName = id => { const m = U.market(id); return m ? m.name : id; };
  const person = a => `${U.esc(a.fullName)} · ${U.esc(a.code)}`;
  const initials = name => { const p = String(name || '').trim().split(/\s+/).filter(Boolean); return ((p[0] || '')[0] || '') + ((p[p.length - 1] || '')[0] || ''); };
  const statusTag = a => { const x = STATUS[A.ACCOUNTS.authStatus(a)] || STATUS.LOCKED; return `<span class="tag ${x[1]}">${x[0]}</span>`; };
  const norm = s => String(s || '').toLowerCase();

  // ---------- Phân công hiện tại (theo nhân viên) ----------
  function assignmentCell(a) {
    if (S.isTechnician(a)) return `<span class="muted">${INCIDENT_SCOPE_LABEL}</span>`;
    if (!S.isCollector(a)) return `Quản lý Tổ · ${A.allowedMarkets(a).filter(id => S.markets().indexOf(id) !== -1).length} chợ`;
    const markets = S.collectorMarkets(a);
    if (!S.canReceive(a)) {
      const label = A.ACCOUNTS.authStatus(a) === 'PENDING_ACTIVATION' ? 'Chưa kích hoạt' : 'Tạm khóa';
      return `<span class="muted">${label} — không nhận phân công</span>${markets.length ? `<div class="small muted">Đã ghi nhận ${markets.length} chợ (không hiệu lực)</div>` : ''}`;
    }
    if (!markets.length) return '<span class="tag warn">Chưa được phân công</span>';
    const conflicts = S.collectorConflicts(a);
    const flag = conflicts.length ? ` <span class="tag danger" title="${U.esc(conflicts.map(marketName).join(', '))}">Xung đột</span>` : '';
    if (markets.length === 1) return U.esc(marketName(markets[0])) + flag;
    return `<button class="acc-scope-trigger" data-act="sa-scope" data-id="${U.esc(a.id)}" aria-label="Xem ${markets.length} chợ đang phụ trách"><span>${U.esc(marketName(markets[0]))}</span><span class="acc-scope-more">+${markets.length - 1}</span></button>${flag}`;
  }
  // Lọc Chợ = "chợ này hiện NV thu phí nào phụ trách": chỉ khớp NV thu phí ĐANG HOẠT ĐỘNG có chợ đó trong
  // Account.marketScopes. A02/A04 không có phân công cố định theo chợ (A04 marketScopes=['ALL'] chỉ là giá trị
  // tương thích) nên không bao giờ khớp một chợ cụ thể.
  const coversMarket = (a, mid) => S.isCollector(a) && S.canReceive(a) && S.collectorMarkets(a).indexOf(mid) !== -1;
  function staffRows() {
    const f = state(), q = norm(f.search);
    if (f.market && S.markets().indexOf(f.market) === -1) f.market = '';
    return S.staff().filter(a =>
      (!f.role || roleOf(a) === f.role) &&
      (!f.market || coversMarket(a, f.market)) &&
      (!f.assign || (S.isCollector(a) && (f.assign === 'assigned' ? S.canReceive(a) && S.collectorMarkets(a).length > 0 : !S.collectorMarkets(a).length))) &&
      (!q || norm(a.fullName).includes(q) || norm(a.code).includes(q)));
  }
  // Màn này không xem hồ sơ/tài khoản (thuộc "Tài khoản người dùng"): chỉ NV thu phí có thao tác, duy nhất "Phân công".
  // A02/A04 không có thao tác (A04 được giao việc theo Incident.assignee). NV thu phí chưa ACTIVE: nút bị vô hiệu.
  function staffActions(a) {
    if (!S.isCollector(a) || !(S.canAssign() || S.canReassign())) return '<span class="muted">—</span>';
    if (!S.canReceive(a)) return `<button class="btn sm" disabled title="Tài khoản chưa ở trạng thái Đang hoạt động nên không nhận phân công">Phân công</button>`;
    return `<button class="btn sm primary" data-act="sa-assign-open" data-id="${U.esc(a.id)}">Phân công</button>`;
  }
  function staffView(canViewAssign) {
    const f = state(), rows = staffRows(), pg = U.pager('staffAssign', rows.length, 15);
    const cols = [{ t: 'Mã' }, { t: 'Nhân viên' }, { t: 'Vai trò' }].concat(canViewAssign ? [{ t: 'Phân công hiện tại' }] : []).concat([{ t: 'Trạng thái' }, { t: 'Thao tác' }]);
    const filters = `<div class="card acc-filters sa-filters"><div class="card-b row">
      <input class="input acc-search" placeholder="Tìm theo mã, họ tên..." data-in="sa-search" value="${U.esc(f.search)}">
      <select class="input" data-ch="sa-role"><option value="">Vai trò: Tất cả</option>${['collector', 'technician'].map(id => { const r = A.PERM.role(id); return r ? `<option value="${id}" ${f.role === id ? 'selected' : ''}>${U.esc(r.name)}</option>` : ''; }).join('')}</select>
      ${canViewAssign ? `<select class="input sa-market-filter" data-ch="sa-market"><option value="">Chợ: Tất cả</option>${S.markets().map(id => `<option value="${U.esc(id)}" ${f.market === id ? 'selected' : ''}>${U.esc(marketName(id))}</option>`).join('')}</select>` : ''}
      ${canViewAssign ? `<select class="input" data-ch="sa-assign"><option value="">Phân công: Tất cả</option><option value="assigned" ${f.assign === 'assigned' ? 'selected' : ''}>Đã được phân công</option><option value="unassigned" ${f.assign === 'unassigned' ? 'selected' : ''}>Chưa được phân công</option></select>` : ''}
      <button class="btn" data-act="sa-clear">Đặt lại</button></div></div>`;
    const body = rows.slice(pg.start, pg.end).map(a => `<tr><td class="nowrap">${U.esc(a.code)}</td><td><div class="row acc-user"><span class="avatar">${U.esc(initials(a.fullName))}</span><b>${U.esc(a.fullName)}</b></div></td><td>${U.esc(roleName(a))}</td>${canViewAssign ? `<td>${assignmentCell(a)}</td>` : ''}<td>${statusTag(a)}</td><td class="nowrap acc-actions">${staffActions(a)}</td></tr>`);
    return filters + `<div class="card acc-table-card sa-table-card"><div class="card-h acc-table-head"><h3>Nhân sự Tổ Quản lý chợ</h3><span class="spacer"></span><span class="small muted">${rows.length} nhân viên</span></div><div class="card-b">${U.table(cols, body, { empty: 'Không tìm thấy nhân viên phù hợp' })}${pg.html}</div></div>`;
  }

  A.VIEWS['nhan-su-phan-cong'] = function () {
    const canViewAssign = S.canViewAssignment();
    const sum = S.summary(), managers = S.managers();
    const k = (label, value, sub) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value">${value}</div>${sub ? `<div class="k-sub">${sub}</div>` : ''}</div>`;
    const unit = A.ACCOUNTS.organizationForRole('market_manager') || 'Tổ Quản lý chợ';
    const context = managers.length
      ? `<div class="sa-context">${U.esc(unit)} · Tổ trưởng: <b>${managers.map(a => U.esc(a.fullName)).join(', ')}</b> · Phạm vi quản lý: ${sum.markets} chợ</div>` : '';
    // KPI "Chợ chưa phân công" = cảnh báo độ phủ. Chỉ bấm được (popover chỉ đọc) khi có chợ chưa phân công hoặc xung đột.
    const coverageSub = 'trên tổng ' + sum.markets + ' chợ' + (sum.conflicts ? ` · <span class="sa-conflict-text">${sum.conflicts} xung đột</span>` : '');
    const coverageKpi = sum.unassigned || sum.conflicts
      ? `<button class="card kpi sa-kpi-link" data-act="sa-coverage" aria-label="Xem chợ chưa có nhân viên thu phí phụ trách"><div class="k-label">Chợ chưa phân công</div><div class="k-value">${sum.unassigned}</div><div class="k-sub">${coverageSub} · <span class="sa-kpi-more">Xem</span></div></button>`
      : k('Chợ chưa phân công', sum.unassigned, coverageSub);
    return `<div class="acc-page-intro">Theo dõi nhân sự và phân công công việc của Tổ Quản lý chợ.</div>
    ${context}
    <div class="kpis acc-kpis sa-kpis">
      ${k('Tổng nhân sự', sum.staff)}
      ${k('Nhân viên thu phí', sum.collectors)}
      ${k('Nhân viên kỹ thuật', sum.technicians)}
      ${canViewAssign ? coverageKpi : ''}
    </div>
    ${staffView(canViewAssign)}`;
  };

  // ---------- Bộ lọc ----------
  A.IN['sa-search'] = el => { state().search = el.value; ui.page.staffAssign = 0; A.render(); };
  A.CH['sa-role'] = el => { state().role = el.value; ui.page.staffAssign = 0; A.render(); };
  A.CH['sa-market'] = el => { state().market = S.markets().indexOf(el.value) !== -1 ? el.value : ''; ui.page.staffAssign = 0; A.render(); };
  A.CH['sa-assign'] = el => { state().assign = el.value; ui.page.staffAssign = 0; A.render(); };
  A.ACT['sa-clear'] = () => { ui.staffAssign = EMPTY_FILTER(); ui.page.staffAssign = 0; A.render(); };

  // ---------- Popover chỉ đọc (dùng lại style acc-scope-popover) ----------
  function showPopover(el, title, body, footer) {
    const root = A.$('#modal-root');
    if (!root) return;
    const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 8, bottom: 8 };
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 1024, vh = (typeof window !== 'undefined' && window.innerHeight) || 768;
    const left = Math.max(8, Math.min(Math.round(r.left || 8), vw - 328)), top = Math.max(8, Math.min(Math.round((r.bottom || 8) + 6), vh - 300));
    root.innerHTML = `<div class="acc-scope-popover-backdrop" data-act="close"></div>
      <section class="acc-scope-popover" role="dialog" aria-label="${U.esc(title)}" style="top:${top}px;left:${left}px">
        <h4>${U.esc(title)}</h4>${body}<footer>${footer}</footer>
      </section>`;
  }
  const marketListHtml = ids => `<div class="acc-scope-popover-list">${ids.map(id => `<div><span aria-hidden="true">✓</span><b>${U.esc(marketName(id))}</b></div>`).join('')}</div>`;
  // "+N": các chợ NV thu phí đang phụ trách (chỉ xem; thay đổi qua nút "Phân công").
  A.ACT['sa-scope'] = el => {
    const a = A.ACCOUNTS.get(el.dataset.id);
    if (!a || !S.canViewAssignment()) return;
    const markets = S.collectorMarkets(a);
    if (markets.length < 2) return;
    showPopover(el, 'Các chợ đang phụ trách', marketListHtml(markets), markets.length + ' chợ · ' + person(a));
  };
  // KPI: chợ không có NV thu phí ACTIVE nào (UNASSIGNED) — chỉ xem, không phân công tại đây. Xung đột legacy
  // (nhiều NV cùng giữ 1 chợ) liệt kê riêng, kèm lối vào "Xử lý" (người dùng chọn người giữ mới ghi).
  A.ACT['sa-coverage'] = el => {
    if (!S.canViewAssignment()) return;
    const states = S.marketStates();
    const unassigned = states.filter(st => st.status === 'UNASSIGNED').map(st => st.marketId);
    const conflicts = states.filter(st => st.status === 'CONFLICT');
    if (!unassigned.length && !conflicts.length) return;
    const canResolve = S.canReassign();
    const body = (unassigned.length ? marketListHtml(unassigned) : '<div class="small muted">Tất cả chợ đều đã có nhân viên thu phí phụ trách.</div>')
      + (conflicts.length ? `<div class="sa-pop-sub">Xung đột phân công</div><div class="acc-scope-popover-list">${conflicts.map(st => `<div class="sa-pop-conflict"><span><b>${U.esc(marketName(st.marketId))}</b><span class="small muted">${st.collectors.map(person).join(', ')}</span></span>${canResolve ? `<button class="btn sm" data-act="sa-conflict-open" data-id="${U.esc(st.marketId)}">Xử lý</button>` : ''}</div>`).join('')}</div>` : '');
    showPopover(el, 'Chợ chưa có NV thu phí phụ trách', body, unassigned.length + ' / ' + states.length + ' chợ chưa được phân công');
  };
  // ---------- Popup "Phân công chợ" (theo nhân viên) ----------
  function renderAssignModal() {
    const d = ui.saAssignForm, a = d && A.ACCOUNTS.get(d.collectorId);
    if (!a) return;
    const canAssign = S.canAssign(), canReassign = S.canReassign(), q = norm(d.q);
    const current = S.collectorMarkets(a), targetConflicts = S.collectorConflicts(a);
    const rows = S.markets().filter(id => !q || norm(marketName(id)).includes(q)).map(id => {
      const st = S.marketState(id), held = st.collectors.some(x => x.id === a.id);
      let note = '', disabled = false;
      if (st.status === 'CONFLICT') { note = 'Xung đột phân công — cần xử lý trước'; disabled = true; }
      else if (held) { note = 'Đang phụ trách'; disabled = !canAssign; }
      else if (st.status === 'UNASSIGNED') { note = 'Chưa có nhân viên phụ trách'; disabled = !canAssign; }
      else { note = `Hiện do ${person(st.collector)} phụ trách`; disabled = !canReassign; }
      const on = d.selected.indexOf(id) !== -1;
      return `<label class="sa-market-row ${disabled ? 'is-disabled' : ''}"><input type="checkbox" data-ch="sa-assign-toggle" data-id="${U.esc(id)}" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
        <span class="sa-market-name">${U.esc(marketName(id))}</span><span class="sa-market-note ${held && st.status === 'ASSIGNED' ? 'is-held' : ''} ${st.status === 'CONFLICT' ? 'is-conflict' : ''}">${note}</span></label>`;
    });
    A.modal(A.mHead('Phân công chợ') + `<div class="modal-b sa-assign">
      <dl class="kv"><dt>Nhân viên</dt><dd><b>${U.esc(a.fullName)}</b> · ${U.esc(a.code)}<div class="small muted">${U.esc(roleName(a))}</div></dd>
        <dt>Phân công hiện tại</dt><dd>${current.length ? current.length + ' chợ' : 'Chưa được phân công'}</dd></dl>
      ${targetConflicts.length ? `<div class="note">Nhân viên đang có chợ bị xung đột phân công (${U.esc(targetConflicts.map(marketName).join(', '))}). Vui lòng xử lý xung đột trước ${RESOLVE_HINT} khi thay đổi phân công.</div>` : ''}
      <input class="input sa-market-search" placeholder="Tìm kiếm chợ..." data-in="sa-assign-q" value="${U.esc(d.q)}">
      <div class="sa-market-list">${rows.join('') || '<div class="empty">Không có chợ phù hợp</div>'}</div>
    </div>
    <div class="modal-f"><span class="small muted sa-selected-count">${d.selected.length} chợ được chọn</span><span class="spacer"></span><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="sa-assign-save" ${targetConflicts.length ? 'disabled' : ''}>Lưu phân công</button></div>`);
  }
  function renderAssignConfirm(plan) {
    const a = plan.target;
    const transfers = plan.transfers.map(t => `<div class="sa-confirm-block"><p><b>${U.esc(marketName(t.marketId))}</b> hiện đang được phân công cho:</p><p class="sa-confirm-who">${U.esc(t.from.fullName)} (${U.esc(t.from.code)})</p><p>Nếu tiếp tục, chợ sẽ được điều chuyển sang:</p><p class="sa-confirm-who">${U.esc(a.fullName)} (${U.esc(a.code)})</p></div>`).join('');
    const removed = plan.removed.length ? `<div class="sa-confirm-block"><p>Các chợ sau sẽ không còn nhân viên thu phí phụ trách:</p><p class="sa-confirm-who">${plan.removed.map(id => U.esc(marketName(id))).join(', ')}</p></div>` : '';
    A.modal(A.mHead(plan.transfers.length ? 'Xác nhận điều chuyển' : 'Xác nhận thay đổi phân công') + `<div class="modal-b">${transfers}${removed}<div class="small muted">Giao dịch, biên lai và phiếu nộp tiền đã phát sinh vẫn giữ nguyên người thực hiện.</div></div>
      <div class="modal-f"><button class="btn" data-act="sa-assign-back">Quay lại</button><button class="btn primary" data-act="sa-assign-confirm">${plan.transfers.length ? 'Xác nhận điều chuyển' : 'Xác nhận'}</button></div>`);
  }
  function commitAssign(confirmTransfer) {
    const d = ui.saAssignForm;
    if (!d) return;
    const result = S.saveCollectorMarkets(d.collectorId, d.selected, { confirmTransfer });
    // TRANSFER_REQUIRED ở đây = chợ vừa có người phụ trách (tab/web khác): vẽ lại để thấy chủ mới, giữ lựa chọn.
    if (!result.ok) { U.toast(errorText(result)); if (result.reason === 'TRANSFER_REQUIRED') renderAssignModal(); return; }
    ui.saAssignForm = null;
    A.closeModal(); A.render();
    U.toast(result.unchanged ? 'Không có thay đổi phân công.' : 'Đã lưu phân công cho ' + result.target.fullName + ' (' + result.target.code + ').');
  }
  A.ACT['sa-assign-open'] = el => {
    const a = A.ACCOUNTS.get(el.dataset.id);
    if (!a || !S.canView() || !(S.canAssign() || S.canReassign())) return;
    if (!S.canReceive(a)) { U.toast(ERRORS.NOT_ACTIVE); return; }
    ui.saAssignForm = { collectorId: a.id, selected: S.collectorMarkets(a), q: '' };
    renderAssignModal();
  };
  A.CH['sa-assign-toggle'] = el => {
    const d = ui.saAssignForm, id = el.dataset.id;
    if (!d || S.markets().indexOf(id) === -1) return;
    d.selected = el.checked ? d.selected.concat(d.selected.indexOf(id) === -1 ? [id] : []) : d.selected.filter(x => x !== id);
    renderAssignModal();
  };
  A.IN['sa-assign-q'] = el => {
    const d = ui.saAssignForm;
    if (!d) return;
    d.q = el.value;
    const caret = el.selectionStart;
    renderAssignModal();
    const input = document.querySelector('[data-in="sa-assign-q"]');
    if (input && input.focus) { input.focus(); try { input.setSelectionRange(caret, caret); } catch (e) { /* bỏ qua */ } }
  };
  A.ACT['sa-assign-save'] = () => {
    const d = ui.saAssignForm;
    if (!d || !S.canView()) return;
    const plan = S.planCollectorMarkets(d.collectorId, d.selected);
    if (!plan.ok) { U.toast(errorText(plan)); return; }
    if (plan.unchanged) { ui.saAssignForm = null; A.closeModal(); U.toast('Không có thay đổi phân công.'); return; }
    if (plan.conflicts.length) { U.toast(ERRORS.MARKET_CONFLICT); return; }
    if (plan.targetConflicts.length) { U.toast(ERRORS.TARGET_CONFLICT); return; }
    // Điều chuyển hoặc gỡ chợ → luôn xác nhận; chỉ thêm chợ chưa có người → lưu ngay.
    if (plan.transfers.length || plan.removed.length) { renderAssignConfirm(plan); return; }
    commitAssign(false);
  };
  A.ACT['sa-assign-back'] = () => renderAssignModal();
  A.ACT['sa-assign-confirm'] = () => commitAssign(true);

  // ---------- Xử lý xung đột phân công legacy (chỉ khi Tổ trưởng chọn người giữ mới ghi) ----------
  function renderConflictModal() {
    const d = ui.saConflictForm, st = d && S.marketState(d.marketId);
    if (!st) return;
    A.modal(A.mHead('Xử lý xung đột phân công') + `<div class="modal-b sa-assign">
      <dl class="kv"><dt>Chợ</dt><dd><b>${U.esc(marketName(st.marketId))}</b></dd></dl>
      <div class="note">${st.collectors.length} nhân viên thu phí đang cùng được ghi nhận phụ trách chợ này. Chọn người tiếp tục phụ trách; những người còn lại sẽ được gỡ khỏi chợ.</div>
      <div class="sa-market-list">${st.collectors.map(a => `<label class="sa-market-row"><input type="radio" name="sa-keeper" data-ch="sa-conflict-keeper" value="${U.esc(a.id)}" ${d.keeperId === a.id ? 'checked' : ''}><span class="sa-market-name">${person(a)}</span></label>`).join('')}</div>
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="sa-conflict-save">Xác nhận</button></div>`);
  }
  A.ACT['sa-conflict-open'] = el => {
    const id = el.dataset.id;
    if (!S.canViewAssignment() || !S.canReassign() || S.markets().indexOf(id) === -1 || S.marketState(id).status !== 'CONFLICT') return;
    ui.saConflictForm = { marketId: id, keeperId: '' };
    renderConflictModal();
  };
  A.CH['sa-conflict-keeper'] = el => { if (ui.saConflictForm) ui.saConflictForm.keeperId = el.value; };
  A.ACT['sa-conflict-save'] = () => {
    const d = ui.saConflictForm;
    if (!d || !S.canView()) return;
    if (!d.keeperId) { U.toast('Vui lòng chọn nhân viên tiếp tục phụ trách.'); return; }
    const result = S.resolveConflict(d.marketId, d.keeperId);
    if (!result.ok) { U.toast(errorText(result)); return; }
    ui.saConflictForm = null;
    A.closeModal(); A.render();
    U.toast('Đã xử lý xung đột phân công ' + marketName(d.marketId) + '.');
  };
})(window.APP);
