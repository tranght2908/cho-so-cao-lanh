/* Accounts administration UI (Phase 15.8, from js/v-vanhanh.js): route tai-khoan (list, filters,
 * drawer, create/edit form, market scope, lock/unlock). The route is composed with the trader-account
 * task of trader-account.js. Data: A.ACCOUNTS (store.js). */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  // ---------- Tài khoản người dùng ----------
  function accInitials(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0] || '')[0] || '') + ((parts[parts.length - 1] || '')[0] || '');
  }
  // Phạm vi chợ = phạm vi phân quyền thực tế (A.allowedMarkets / marketScopes), không phải "Đơn vị".
  // Nhiều chợ → chợ đầu + "+N"; danh sách đầy đủ ở tooltip và popup chi tiết.
  function scopeMarkets() { return A.allowedMarkets({ marketScopes: ['ALL'] }).map(id => U.market(id)); }
  function allMarketsLabel() { return 'Toàn bộ ' + scopeMarkets().length + ' chợ'; }
  function currentAccounts() { return A.ACCOUNTS.currentList ? A.ACCOUNTS.currentList() : A.ACCOUNTS.list(); }
  function managementUnit() { return (A.MARKET_CATALOG && A.MARKET_CATALOG.MANAGEMENT_UNIT) || 'Tổ Quản lý chợ'; }
  function accountOrganization(a) { return A.ACCOUNTS.isCanonicalMarketManager && A.ACCOUNTS.isCanonicalMarketManager(a) ? managementUnit() : (a.organization || ''); }
  function accScopeNames(a) { return A.allowedMarkets(a).map(id => U.mShort(id)); }
  function accScopeLabel(a) {
    if ((a.marketScopes || []).includes('ALL')) return allMarketsLabel();
    const names = accScopeNames(a);
    if (!names.length) return '<span class="muted">Chưa phân công</span>';
    const conflicts = A.ACCOUNTS.collectorMarketConflicts ? A.ACCOUNTS.collectorMarketConflicts(a) : [];
    return U.esc(names[0]) + (names.length > 1 ? ` <span class="muted">+${names.length - 1}</span>` : '')
      + (conflicts.length ? ` <span class="tag warn" title="Có ${conflicts.length} chợ đang được nhiều NV thu phí phụ trách">!</span>` : '');
  }
  // "Loại người dùng" = nhóm danh tính, suy ra từ quan hệ sẵn có (vai trò trader / liên kết hồ sơ
  // tiểu thương / accountType cũ) — KHÔNG thêm field mới, KHÔNG trùng với "Vai trò".
  const USER_KIND = A.features.accounts.service.USER_KIND;
  const accKind = a => A.features.accounts.service.userKind(a);
  // Vai trò hiển thị từ role registry động (A.PERM.role), không map tên riêng.
  function accRoleNames(a) { return (a.roleIds || []).map(rid => { const r = A.PERM.role(rid); return U.esc(r ? r.name : rid); }).join(', ') || '<span class="muted">Chưa gán</span>'; }
  // SĐT là thông tin cá nhân: mặc định che, bấm biểu tượng mắt ở tiêu đề cột để hiện/ẩn (state UI, không lưu).
  function accPhone(a) { return a.phone ? U.esc(ui.accShowPhone ? a.phone : U.maskPhone(a.phone)) : '<span class="muted">Chưa cấu hình</span>'; }
  function accRows() {
    const f = ui.acc, q = (f.search || '').toLowerCase(), kind = accKindFilter();
    // Mặc định chỉ hiện tài khoản nội bộ (Cán bộ/Nhân viên) như trước; tài khoản Tiểu thương tra cứu
    // qua bộ lọc "Loại người dùng" (Tiểu thương hoặc Tất cả).
    return currentAccounts().filter(a =>
      (kind === 'all' || accKind(a) === kind) &&
      (!f.role || (a.roleIds || []).includes(f.role)) &&
      (!f.market || A.allowedMarkets(a).includes(f.market)) &&
      (!f.status || A.ACCOUNTS.authStatus(a) === f.status) &&
      (!q || a.fullName.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) || (a.phone || '').includes(q)));
  }
  // Giá trị cũ của ui.acc.type (tên accountType) được quy về nhóm mới; rỗng = tất cả.
  function accKindFilter() { const t = ui.acc.type || 'all'; return t === 'all' || t === 'trader' || t === 'staff' ? t : t === 'Tiểu thương' ? 'trader' : 'all'; }
  function accStats() {
    const all = currentAccounts();
    return {
      total: all.length, active: all.filter(a => A.ACCOUNTS.authStatus(a) === 'ACTIVE').length,
      pending: all.filter(a => A.ACCOUNTS.authStatus(a) === 'PENDING_ACTIVATION').length,
      disabled: all.filter(a => A.ACCOUNTS.authStatus(a) === 'LOCKED').length
    };
  }
  const ACC_STATUS = { ACTIVE: ['Đang hoạt động', 'ok'], PENDING_ACTIVATION: ['Chờ kích hoạt', 'warn'], LOCKED: ['Tạm khóa', 'danger'] };
  function accStatusTag(a) {
    const x = ACC_STATUS[A.ACCOUNTS.authStatus(a)] || ACC_STATUS.LOCKED;
    return `<span class="tag ${x[1]}">${x[0]}</span>`;
  }
  function accDrawerHtml(a) {
    const canEdit = A.canDo('tai-khoan.sua');
    const t = a.traderId ? A.idx.trader.get(a.traderId) : null;
    const pairs = rows => `<dl class="contract-detail-kv">${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>`;
    const sec = (icon, key, title, body) => `<section class="contract-detail-section"><h4><span>${U.icon(icon)}</span>${key}. ${title}</h4>${body}</section>`;
    const scopeFull = (a.marketScopes || []).includes('ALL') ? allMarketsLabel() : (accScopeNames(a).map(U.esc).join(', ') || '<span class="muted">Chưa phân công</span>');
    const userRows = [['Họ tên', `<b>${U.esc(a.fullName)}</b>`], ['Số điện thoại', accPhone(a)], ['Loại người dùng', USER_KIND[accKind(a)]]];
    if (a.title && a.title !== accRoleNames(a)) userRows.push(['Chức danh', U.esc(a.title)]);
    if (accountOrganization(a)) userRows.push(['Đơn vị', U.esc(accountOrganization(a))]);
    if (t) userRows.push(['Hồ sơ tiểu thương', `${U.esc(t.name)} · ${t.id}`]);
    const body = sec('users', 'A', 'THÔNG TIN NGƯỜI DÙNG', pairs(userRows))
      + sec('file', 'B', 'TÀI KHOẢN & PHÂN QUYỀN', pairs([['Mã tài khoản', `<b>${U.esc(a.code)}</b>`], ['Vai trò', accRoleNames(a)], ['Phạm vi chợ', scopeFull], ['Trạng thái', accStatusTag(a)]]));
    return `<div class="drawer-h tt-dossier-head"><h3>${U.icon('users')}Chi tiết tài khoản</h3><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b contract-detail-body"><div class="contract-detail-grid">${body}</div></div>
      <div class="drawer-f contract-detail-footer">${canEdit ? `<button class="btn primary" data-act="acc-edit" data-id="${a.id}">${U.icon('edit')}Chỉnh sửa tài khoản</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  // RBAC_MARKET_SCOPE_MIGRATION mục 20: phần "Phạm vi" đổi theo vai trò đang chọn —
  //   system_admin → "Toàn hệ thống" (tĩnh, không chọn từng chợ)
  //   ward_leader  → "Toàn bộ N chợ" (tĩnh, không chọn từng chợ)
  //   market_manager/collector/technician → multi-select 12 chợ (checkbox)
  //   trader       → không cho gán qua form này (quản lý qua Hồ sơ tiểu thương → Tài khoản Mini App,
  //                  "không cho phép dùng marketScopes để vượt qua ownership" — mục 20 yêu cầu)
  //   chưa chọn vai trò → vẫn hiện multi-select (an toàn mặc định, admin luôn chọn vai trò trước khi
  //                  Lưu vì acc-form-save đã validate).
  function afScopeSectionHtml(d, dis) {
    const roleId = (d.roleIds && d.roleIds[0]) || '';
    const scopeMode = A.ACCOUNTS.scopeModeForRole(roleId);
    if (scopeMode === 'ALL') {
      const label = allMarketsLabel();
      return `<div class="field" style="margin-top:12px"><label>Phạm vi</label><div class="note info">${U.esc(label)} — vai trò này không cần chọn từng chợ.</div></div>`;
    }
    if (scopeMode === 'TRADER') {
      return `<div class="field" style="margin-top:12px"><label>Phạm vi</label><div class="note">Tài khoản Tiểu thương được quản lý qua <b>Tiểu thương → Hồ sơ tiểu thương → Tài khoản Mini App</b>, không gán phạm vi chợ trực tiếp ở đây.</div></div>`;
    }
    // Legacy ['ALL'] (account cũ) diễn giải qua đúng A.allowedMarkets() hiện có — không tự viết lại
    // logic 'ALL' ở đây — để checkbox hiển thị đã tick sẵn đúng các chợ; account KHÔNG bị ghi lại
    // cho tới khi admin thật sự bấm Lưu.
    const dm = A.allowedMarkets({ marketScopes: d.marketScopes || [] });
    const isCollector = roleId === 'collector';
    const scopeItem = m => {
      const own = dm.includes(m.id);
      const state = isCollector && A.ACCOUNTS.marketCollectorState ? A.ACCOUNTS.marketCollectorState(m.id) : null;
      let note = '';
      if (state) {
        if (state.status === 'CONFLICT') note = '<small class="warn">Đang có nhiều NV thu phí được phân công</small>';
        else if (own) note = '<small class="muted">Đang phụ trách bởi tài khoản này</small>';
        else if (state.collector) note = `<small class="muted">Đang phụ trách: ${U.esc(state.collector.fullName)}</small>`;
        else note = '<small class="muted">Chưa phân công</small>';
      }
      return `<label class="small" style="display:flex;flex-direction:column;align-items:flex-start;gap:3px;cursor:pointer"><span style="display:flex;align-items:center;gap:6px"><input type="checkbox" data-ch="af-scope" data-market="${m.id}" ${own ? 'checked' : ''} ${dis}> ${U.esc(m.short)}</span>${note}</label>`;
    };
    return `<div class="field" style="margin-top:12px"><label>Phạm vi chợ được phân công</label>
      <div class="row" style="gap:14px;flex-wrap:wrap;margin-top:4px">${scopeMarkets().map(scopeItem).join('')}</div></div>`;
  }
  function renderAccForm() {
    const d = ui.accForm, isNew = !d.id;
    const canAssign = isNew || A.canDo('tai-khoan.gan-quyen');
    const dis = canAssign ? '' : 'disabled';
    // Tài khoản Tiểu thương chỉ tạo từ "Cần xử lý → Tạo tài khoản" (liên kết hồ sơ); form này dành cho
    // tài khoản nội bộ nên khi tạo mới không có vai trò Tiểu thương. "Loại tài khoản" (accountType)
    // vẫn tự đồng bộ theo vai trò như trước (A.CH['af-role']), không còn là ô chọn trùng với Vai trò.
    const currentRole = (d.roleIds && d.roleIds[0]) || '';
    const traderRoleLocked = currentRole === 'trader';
    const roles = A.PERM.roles().filter(r => r.id !== 'trader' || (!isNew && traderRoleLocked));
    A.modal(A.mHead(isNew ? 'Thêm tài khoản nội bộ' : 'Sửa tài khoản') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Mã tài khoản *</label><input class="input" data-ch="af-code" value="${U.esc(d.code || '')}" ${isNew ? '' : 'disabled'}></div>
      <div class="field"><label>Họ tên *</label><input class="input" data-ch="af-name" value="${U.esc(d.fullName || '')}"></div>
      <div class="field"><label>Số điện thoại đăng nhập</label>${isNew ? `<input class="input" data-ch="af-phone" value="${U.esc(d.phone || '')}">` : `<input class="input" value="${U.esc(U.maskPhone(d.phone || ''))}" readonly><small class="muted">Số đăng nhập chỉ thay đổi qua quy trình yêu cầu, phê duyệt và OTP.</small>${A.phoneChangeAdminOpenButton ? A.phoneChangeAdminOpenButton(d.id) : ''}`}</div>
      <div class="field"><label>Vai trò</label><select class="input" data-ch="af-role" ${dis || (traderRoleLocked ? 'disabled' : '')}><option value="">— Chưa gán —</option>${roles.map(r => `<option value="${r.id}" ${(d.roleIds && d.roleIds[0]) === r.id ? 'selected' : ''}>${U.esc(r.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Đơn vị</label><input class="input" data-ch="af-org" value="${U.esc(A.ACCOUNTS.isCanonicalMarketManager && A.ACCOUNTS.isCanonicalMarketManager(d) ? managementUnit() : (d.organization || ''))}" ${A.ACCOUNTS.isCanonicalMarketManager && A.ACCOUNTS.isCanonicalMarketManager(d) ? 'readonly' : ''}></div>
      <div class="field"><label>Trạng thái</label><select class="input" data-ch="af-status"><option value="ACTIVE" ${A.ACCOUNTS.authStatus(d) === 'ACTIVE' ? 'selected' : ''}>Đang hoạt động</option><option value="LOCKED" ${A.ACCOUNTS.authStatus(d) === 'LOCKED' ? 'selected' : ''}>Tạm khóa</option></select></div>
    </div>
    ${afScopeSectionHtml(d, dis)}
    ${!canAssign ? '<div class="note" style="margin-top:12px">Bạn không có quyền gán vai trò / phạm vi chợ nên các trường này đang bị khoá.</div>' : ''}
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="acc-form-save">Lưu</button></div>`);
  }

  const ACC_VIEW = { ACCOUNTS: 'ACCOUNTS', PHONE_CHANGE_REQUESTS: 'PHONE_CHANGE_REQUESTS', PENDING_ACTIVATION: 'PENDING_ACTIVATION', TRADERS_WITHOUT_ACCOUNT: 'TRADERS_WITHOUT_ACCOUNT' };
  function queueState() { return ui.accQueue || (ui.accQueue = { search: '', status: 'PENDING', market: '' }); }
  function phoneRequestLabel(status) { return ({ PENDING: 'Chờ xử lý', APPROVED_PENDING_OTP: 'Chờ xác minh số mới', REJECTED: 'Đã từ chối', COMPLETED: 'Đã hoàn tất', CANCELLED: 'Đã hủy' })[status] || status; }
  function phoneRequestTag(r) { return `<span class="tag ${r.status === 'REJECTED' ? 'danger' : r.status === 'COMPLETED' ? 'ok' : 'warn'}">${phoneRequestLabel(r.status)}</span>`; }
  function queueTable(title, count, content, description) { return `<div class="card acc-table-card"><div class="card-h acc-table-head acc-queue-head"><div><button class="acc-queue-back" data-act="acc-queue-back">← Danh sách tài khoản</button><h3>${title} <span class="acc-queue-total">${count}</span></h3>${description ? `<p>${description}</p>` : ''}</div></div><div class="card-b">${content}</div></div>`; }
  function phoneRequestQueue(canEdit) {
    const q = queueState(), all = (A.db.phoneChangeRequests || []).slice(), rows = all.filter(r => (!q.status || r.status === q.status) && (!q.search || [r.oldPhone, r.newPhone, (A.ACCOUNTS.get(r.accountId) || {}).fullName, (A.ACCOUNTS.get(r.accountId) || {}).code].join(' ').toLowerCase().includes(q.search.toLowerCase()))), pg = U.pager('accQueue', rows.length, 15);
    const filters = `<div class="card acc-filters"><div class="card-b row"><input class="input acc-search" placeholder="Tìm người dùng, mã tài khoản, số điện thoại..." data-in="accq-search" value="${U.esc(q.search)}"><select class="input" data-ch="accq-request-status"><option value="">Trạng thái yêu cầu: Tất cả</option>${['PENDING','APPROVED_PENDING_OTP','REJECTED','COMPLETED','CANCELLED'].map(x => `<option value="${x}" ${q.status === x ? 'selected' : ''}>${phoneRequestLabel(x)}</option>`).join('')}</select><button class="btn" data-act="accq-clear">Đặt lại</button></div></div>`;
    const table = U.table([{ t: 'Người dùng' }, { t: 'SĐT hiện tại' }, { t: 'SĐT đề nghị' }, { t: 'Ngày gửi' }, { t: 'Trạng thái' }, { t: 'Thao tác' }], rows.slice(pg.start, pg.end).map(r => { const a = A.ACCOUNTS.get(r.accountId) || {}; return `<tr><td><b>${U.esc(a.fullName || '—')}</b><div class="small muted">${U.esc(a.code || '')}</div></td><td>${U.esc(U.maskPhone(r.oldPhone || ''))}</td><td>${U.esc(U.maskPhone(r.newPhone || ''))}</td><td>${U.dmy(r.requestedAt || '')}</td><td>${phoneRequestTag(r)}</td><td>${canEdit ? `<button class="btn sm" data-act="phone-change-admin-detail" data-id="${r.id}">Xem & xử lý</button>` : '<span class="muted small">Chỉ xem</span>'}</td></tr>`; }), { empty: 'Không có yêu cầu phù hợp' }) + pg.html;
    return filters + queueTable('Yêu cầu đổi số điện thoại', rows.length + ' yêu cầu', table);
  }
  function pendingActivationQueue() {
    const q = queueState(), rows = currentAccounts().filter(a => A.ACCOUNTS.authStatus(a) === 'PENDING_ACTIVATION' && (!q.search || [a.fullName, a.code, a.phone].join(' ').toLowerCase().includes(q.search.toLowerCase())) && (!q.type || accKind(a) === q.type) && (!q.role || (a.roleIds || []).includes(q.role)) && (!q.market || A.allowedMarkets(a).includes(q.market))), pg = U.pager('accQueue', rows.length, 15);
    const filters = `<div class="card acc-filters"><div class="card-b row"><input class="input acc-search" placeholder="Tìm họ tên, mã tài khoản, số điện thoại..." data-in="accq-search" value="${U.esc(q.search)}"><select class="input" data-ch="accq-type"><option value="">Loại người dùng: Tất cả</option><option value="staff" ${q.type === 'staff' ? 'selected' : ''}>${USER_KIND.staff}</option><option value="trader" ${q.type === 'trader' ? 'selected' : ''}>${USER_KIND.trader}</option></select><select class="input" data-ch="accq-role"><option value="">Vai trò: Tất cả</option>${A.PERM.roles().map(r => `<option value="${r.id}" ${q.role === r.id ? 'selected' : ''}>${U.esc(r.name)}</option>`).join('')}</select><select class="input" data-ch="accq-market"><option value="">Phạm vi chợ: Tất cả</option>${D.MARKETS.map(m => `<option value="${m.id}" ${q.market === m.id ? 'selected' : ''}>${U.esc(m.short)}</option>`).join('')}</select><button class="btn" data-act="accq-clear">Đặt lại</button></div></div>`;
    const table = U.table([{ t: 'Mã tài khoản' }, { t: 'Người dùng' }, { t: 'Số điện thoại' }, { t: 'Loại người dùng' }, { t: 'Vai trò' }, { t: 'Phạm vi chợ' }, { t: 'Ngày tạo' }, { t: 'Trạng thái' }, { t: 'Thao tác' }], rows.slice(pg.start, pg.end).map(a => `<tr class="click" data-act="acc-open" data-id="${a.id}"><td>${U.esc(a.code)}</td><td><b>${U.esc(a.fullName)}</b></td><td>${accPhone(a)}</td><td>${USER_KIND[accKind(a)]}</td><td>${accRoleNames(a)}</td><td>${accScopeLabel(a)}</td><td>${a.createdAt ? U.dmy(a.createdAt) : '—'}</td><td>${accStatusTag(a)}</td><td><button class="btn sm" data-act="acc-open" data-id="${a.id}">Xem</button></td></tr>`), { empty: 'Không có tài khoản chờ kích hoạt' }) + pg.html;
    return filters + queueTable('Tài khoản chờ kích hoạt', rows.length + ' tài khoản', table);
  }
  function traderWithoutAccountQueue(canCreate) {
    const q = queueState(), source = A.features.accounts.service.traderAccountRows ? A.features.accounts.service.traderAccountRows() : [], rows = source.filter(x => (!q.market || x.t.market === q.market) && (!q.search || [x.t.id, x.t.name, x.t.phone, x.c && x.c.id, x.s && x.s.code].join(' ').toLowerCase().includes(q.search.toLowerCase()))), pg = U.pager('accQueue', rows.length, 15);
    const filters = `<div class="card acc-filters"><div class="card-b row"><input class="input acc-search" placeholder="Tìm mã tiểu thương, tên, SĐT, điểm, hợp đồng..." data-in="accq-search" value="${U.esc(q.search)}"><select class="input" data-ch="accq-market"><option value="">Chợ: Tất cả</option>${D.MARKETS.map(m => `<option value="${m.id}" ${q.market === m.id ? 'selected' : ''}>${U.esc(m.short)}</option>`).join('')}</select><button class="btn" data-act="accq-clear">Đặt lại</button></div></div>`;
    const table = U.table([{ t: 'Mã tiểu thương' }, { t: 'Tiểu thương' }, { t: 'Số điện thoại' }, { t: 'Điểm kinh doanh' }, { t: 'Hợp đồng' }, { t: 'Chợ' }, { t: 'Trạng thái' }, { t: 'Thao tác' }], rows.slice(pg.start, pg.end).map(x => `<tr><td>${U.esc(x.t.id)}</td><td><b>${U.esc(x.t.name)}</b></td><td>${U.esc(U.maskPhone(x.t.phone || ''))}</td><td>${U.esc((x.s && x.s.code) || '—')}</td><td>${U.esc((x.c && x.c.id) || '—')}</td><td>${U.esc(U.mShort(x.t.market))}</td><td><span class="tag warn">Chưa có tài khoản</span></td><td>${canCreate ? `<button class="btn sm primary" data-act="wf-account-open" data-id="${x.t.id}">Tạo tài khoản</button>` : '<span class="muted small">Chỉ xem</span>'}</td></tr>`), { empty: 'Không có tiểu thương phù hợp' }) + pg.html;
    return filters + queueTable('Tiểu thương chưa có tài khoản', rows.length + ' tiểu thương', table, 'Tiểu thương đã có hồ sơ/hợp đồng đủ điều kiện nhưng chưa được cấp tài khoản.');
  }
  const accountsView = function () {
    const canCreate = A.canDo('tai-khoan.tao-moi');
    const canEdit = A.canDo('tai-khoan.sua');
    const canToggle = A.canDo('tai-khoan.khoa-mo-khoa');
    const mode = ui.acc.viewMode || ACC_VIEW.ACCOUNTS, rows = accRows(), st = accStats(), f = ui.acc, kind = accKindFilter();
    const pg = U.pager('acc', rows.length, 15);
    const k = (l, v) => `<div class="card kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div></div>`;
    const statusOpts = Object.keys(ACC_STATUS).map(s => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${ACC_STATUS[s][0]}</option>`).join('');
    const pendingPhoneRequests = (A.db.phoneChangeRequests || []).filter(r => r.status === 'PENDING').length;
    const tradersNeedingAccount = A.features.accounts.service && A.features.accounts.service.tradersNeedingAccount ? A.features.accounts.service.tradersNeedingAccount().length : 0;
    const canProcess = canEdit || canCreate;
    const workRow = (label, count, modeId, allowed) => {
      if (!count) return '';
      const content = `<span>${label}</span><span class="acc-work-count">${count}</span><span aria-hidden="true">›</span>`;
      return allowed ? `<button class="acc-work-row ${mode === modeId ? 'on' : ''}" data-act="acc-queue" data-mode="${modeId}">${content}</button>` : `<div class="acc-work-row" aria-label="${label}: ${count}">${content}</div>`;
    };
    const defaultTable = `<div class="card acc-filters"><div class="card-b row">
      <input class="input acc-search" placeholder="Tìm theo họ tên, mã, số điện thoại..." data-in="acc-search" value="${U.esc(f.search || '')}">
      <select class="input" data-ch="acc-type"><option value="all" ${kind === 'all' ? 'selected' : ''}>Loại người dùng: Tất cả</option><option value="staff" ${kind === 'staff' ? 'selected' : ''}>Loại người dùng: ${USER_KIND.staff}</option><option value="trader" ${kind === 'trader' ? 'selected' : ''}>Loại người dùng: ${USER_KIND.trader}</option></select>
      <select class="input" data-ch="acc-role"><option value="">Vai trò: Tất cả</option>${A.PERM.roles().map(r => `<option value="${r.id}" ${f.role === r.id ? 'selected' : ''}>${U.esc(r.name)}</option>`).join('')}</select>
      <select class="input" data-ch="acc-market"><option value="">Phạm vi chợ: Tất cả</option>${D.MARKETS.map(m => `<option value="${m.id}" ${f.market === m.id ? 'selected' : ''}>${U.esc(m.short)}</option>`).join('')}</select>
      <select class="input" data-ch="acc-status"><option value="">Trạng thái: Tất cả</option>${statusOpts}</select>
      <button class="btn" data-act="acc-clear">Đặt lại</button></div></div>
    <div class="card acc-table-card"><div class="card-h acc-table-head"><h3>Danh sách tài khoản người dùng</h3><span class="spacer"></span>${canCreate ? '<button class="btn primary" data-act="acc-new">+ Thêm tài khoản nội bộ</button>' : ''}</div><div class="card-b">
      ${U.table([{ t: 'Mã tài khoản' }, { t: 'Người dùng' }, { t: `<span class="tt-private-heading">Số điện thoại<button class="btn sm" data-act="acc-toggle-phone" aria-pressed="${ui.accShowPhone ? 'true' : 'false'}">${U.icon(ui.accShowPhone ? 'eye-off' : 'eye')}</button></span>` }, { t: 'Loại người dùng' }, { t: 'Vai trò' }, { t: 'Phạm vi chợ' }, { t: 'Trạng thái' }, { t: 'Thao tác' }], rows.slice(pg.start, pg.end).map(a => `<tr class="click" data-act="acc-open" data-id="${a.id}"><td class="nowrap">${U.esc(a.code)}</td><td><div class="row acc-user"><span class="avatar">${U.esc(accInitials(a.fullName))}</span><b>${U.esc(a.fullName)}</b></div></td><td class="nowrap">${accPhone(a)}</td><td>${USER_KIND[accKind(a)]}</td><td>${accRoleNames(a)}</td><td>${accScopeLabel(a)}</td><td>${accStatusTag(a)}</td><td class="nowrap acc-actions"><button class="btn sm" data-act="acc-open" data-id="${a.id}">Xem</button>${canEdit || canToggle ? `<button class="btn sm acc-more" data-act="acc-more" data-id="${a.id}">⋯</button>` : ''}</td></tr>`), { empty: 'Không tìm thấy tài khoản phù hợp' })}${pg.html}</div></div>`;
    const activeTable = mode === ACC_VIEW.PHONE_CHANGE_REQUESTS ? phoneRequestQueue(canEdit) : mode === ACC_VIEW.PENDING_ACTIVATION ? pendingActivationQueue() : mode === ACC_VIEW.TRADERS_WITHOUT_ACCOUNT ? traderWithoutAccountQueue(canCreate) : defaultTable;
    return `
    <div class="acc-page-intro">Quản lý và tra cứu các tài khoản được phép sử dụng hệ thống.</div>
    <div class="acc-overview">
      <div class="kpis acc-kpis">
        ${k('Tổng tài khoản', st.total)}
        ${k('Đang hoạt động', st.active)}
        ${k('Chờ kích hoạt', st.pending)}
        ${k('Tạm khóa', st.disabled)}
      </div>
      <section class="card acc-work"><div class="card-b"><h3>Cần xử lý</h3>
        ${workRow('Yêu cầu đổi số điện thoại', pendingPhoneRequests, ACC_VIEW.PHONE_CHANGE_REQUESTS, canEdit)}
        ${workRow('Tài khoản chờ kích hoạt', st.pending, ACC_VIEW.PENDING_ACTIVATION, canProcess)}
        ${workRow('Tiểu thương chưa có tài khoản', tradersNeedingAccount, ACC_VIEW.TRADERS_WITHOUT_ACCOUNT, canCreate)}
        ${!pendingPhoneRequests && !st.pending && !tradersNeedingAccount ? '<div class="small muted">Không có việc cần xử lý.</div>' : ''}
      </div></section>
    </div>
    ${activeTable}`;
  };
  // Menu "⋯": chỉ hiện thao tác người dùng hiện tại được phép, và gọi lại ĐÚNG handler sẵn có
  // (acc-edit / acc-toggle) — không có logic sửa/khóa thứ hai.
  A.ACT['acc-more'] = el => {
    const a = A.ACCOUNTS.get(el.dataset.id);
    if (!a) return;
    const canEdit = A.canDo('tai-khoan.sua'), canToggle = A.canDo('tai-khoan.khoa-mo-khoa');
    if (!canEdit && !canToggle) return;
    const active = A.ACCOUNTS.authStatus(a) === 'ACTIVE';
    // Đang cooldown thao tác tạm khóa (của Admin hiện tại) → mục vẫn hiện nhưng mờ; bấm vào chỉ báo thời gian còn lại.
    const me = A.currentAccount(), wait = active ? actionCooldownRemaining(me && me.id) : 0;
    const lockAttr = wait ? ` aria-disabled="true" title="${cooldownMsg(wait)}"` : '';
    const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { bottom: 0, right: 0 };
    const top = Math.round(r.bottom + 4), left = Math.max(8, Math.round(r.right - 210));
    A.$('#modal-root').innerHTML = `<div class="acc-menu-wrap" data-act="close"></div><div class="acc-menu" role="menu" style="top:${top}px;left:${left}px">
      ${canEdit ? `<button class="acc-menu-item" role="menuitem" data-act="acc-edit" data-id="${a.id}">Chỉnh sửa tài khoản</button>` : ''}
      ${canEdit && canToggle ? '<div class="acc-menu-sep"></div>' : ''}
      ${canToggle ? `<button class="acc-menu-item ${active ? 'danger' : ''}${wait ? ' is-disabled' : ''}" role="menuitem" data-act="acc-menu-toggle" data-id="${a.id}"${lockAttr}>${active ? 'Tạm khóa tài khoản' : 'Mở khóa tài khoản'}</button>` : ''}${wait ? `<div class="acc-menu-hint">${cooldownMsg(wait)}</div>` : ''}</div>`;
  };
  A.ACT['acc-toggle-phone'] = () => { ui.accShowPhone = !ui.accShowPhone; A.render(); };
  A.ACT['acc-menu-toggle'] = el => { A.closeModal(); A.ACT['acc-toggle'](el); };
  A.IN['acc-search'] = el => { ui.acc.search = el.value; ui.page.acc = 0; A.render(); };
  A.CH['acc-type'] = el => { ui.acc.type = el.value; ui.page.acc = 0; A.render(); };
  A.CH['acc-role'] = el => { ui.acc.role = el.value; ui.page.acc = 0; A.render(); };
  A.CH['acc-market'] = el => { ui.acc.market = el.value; ui.page.acc = 0; A.render(); };
  A.CH['acc-status'] = el => { ui.acc.status = el.value; ui.page.acc = 0; A.render(); };
  A.ACT['acc-clear'] = () => { ui.acc = { search: '', type: 'all', role: '', market: '', status: '' }; ui.page.acc = 0; A.render(); };
  A.ACT['acc-queue'] = el => {
    const mode = el.dataset.mode;
    if (mode === ACC_VIEW.PHONE_CHANGE_REQUESTS && !A.canDo('tai-khoan.sua')) return;
    if (mode === ACC_VIEW.PENDING_ACTIVATION && !A.canDo('tai-khoan.sua') && !A.canDo('tai-khoan.tao-moi')) return;
    if (mode === ACC_VIEW.TRADERS_WITHOUT_ACCOUNT && !A.canDo('tai-khoan.tao-moi')) return;
    ui.acc.viewMode = mode; ui.accQueue = { search: '', status: mode === ACC_VIEW.PHONE_CHANGE_REQUESTS ? 'PENDING' : '', market: '', type: '', role: '' }; ui.page.accQueue = 0; A.render();
  };
  A.ACT['acc-queue-back'] = () => { ui.acc.viewMode = ACC_VIEW.ACCOUNTS; ui.page.acc = 0; A.render(); };
  A.IN['accq-search'] = el => { queueState().search = el.value; ui.page.accQueue = 0; A.render(); };
  A.CH['accq-request-status'] = el => { queueState().status = el.value; ui.page.accQueue = 0; A.render(); };
  A.CH['accq-market'] = el => { queueState().market = el.value; ui.page.accQueue = 0; A.render(); };
  A.CH['accq-type'] = el => { queueState().type = el.value; ui.page.accQueue = 0; A.render(); };
  A.CH['accq-role'] = el => { queueState().role = el.value; ui.page.accQueue = 0; A.render(); };
  A.ACT['accq-clear'] = () => { ui.accQueue = { search: '', status: ui.acc.viewMode === ACC_VIEW.PHONE_CHANGE_REQUESTS ? 'PENDING' : '', market: '', type: '', role: '' }; ui.page.accQueue = 0; A.render(); };
  A.ACT['acc-open'] = el => {
    if (!U.can('tai-khoan') || !A.openAccountProfile) return;
    A.openAccountProfile(el.dataset.id);
  };
  A.ACT['acc-new'] = () => {
    if (!A.canDo('tai-khoan.tao-moi')) return;
    // Chưa chọn vai trò → chưa biết chợ nào phù hợp, để trống thay vì mặc định cứng — admin chọn
    // vai trò trước (A.CH['af-role'] tự hiện đúng dạng Phạm vi), rồi mới tick chợ. "Loại tài khoản"
    // mặc định ACCOUNT_TYPES[3] = tên role 'collector' (thứ tự cố định theo defaultRoles(),
    // js/permissions.js) — vai trò vận hành phổ biến nhất, tránh mặc định thiên về quyền cao.
    ui.accForm = { id: null, code: '', fullName: '', phone: '', accountType: A.ACCOUNTS.ACCOUNT_TYPES[3], roleIds: [], organization: '', marketScopes: [], status: 'ACTIVE', collectorTransferMarkets: [] };
    renderAccForm();
  };
  A.ACT['acc-edit'] = el => {
    if (!A.canDo('tai-khoan.sua')) return;
    const a = A.ACCOUNTS.get(el.dataset.id);
    if (!a) return;
    // Diễn giải marketScopes cũ (kể cả legacy ['ALL']) qua A.allowedMarkets() NGAY khi mở form —
    // không chỉ lúc render checkbox — để checkbox hiển thị ĐÚNG state form đang giữ, và Lưu ngay
    // (không cần đụng checkbox) cũng ghi lại đúng ['CL','TTD'] tường minh thay vì giữ nguyên 'ALL'
    // (mục 3 yêu cầu Phase 5B: "làm sạch dữ liệu dần khi account thực sự được sửa").
    ui.accForm = { id: a.id, code: a.code, fullName: a.fullName, phone: a.phone, accountType: a.accountType, roleIds: (a.roleIds || []).slice(), organization: a.organization, marketScopes: (a.marketScopes || []).slice(), status: a.status, collectorTransferMarkets: [] };
    renderAccForm();
  };
  A.CH['af-code'] = el => { ui.accForm.code = el.value; };
  A.CH['af-name'] = el => { ui.accForm.fullName = el.value; };
  A.CH['af-phone'] = el => { ui.accForm.phone = el.value; };
  A.CH['af-type'] = el => { ui.accForm.accountType = el.value; };
  // Đổi vai trò làm phần "Phạm vi" hiện đúng dạng tương ứng (mục 20 yêu cầu: GLOBAL/trader/multi-
  // select 12 chợ) — phải vẽ lại cả form, có tiền lệ an toàn ở v-taichinh.js A.CH['adj-proposed'].
  // Đồng bộ luôn "Loại tài khoản" theo tên vai trò mới chọn (2 field cùng phản ánh 1 vai trò, tránh
  // lệch nhãn) — admin vẫn có thể tự đổi lại "Loại tài khoản" sau nếu muốn.
  A.CH['af-role'] = el => {
    ui.accForm.roleIds = el.value ? [el.value] : [];
    const r = el.value ? A.PERM.role(el.value) : null;
    if (r) ui.accForm.accountType = r.name;
    renderAccForm();
  };
  A.CH['af-org'] = el => { ui.accForm.organization = el.value; };
  // Rebuild ui.accForm.marketScopes theo ĐÚNG danh sách D.MARKETS hiện có (12 chợ, không còn hard-
  // code CL/TTD) mỗi lần tick/bỏ tick 1 checkbox — không bao giờ ghi 'ALL'. Chuẩn hoá state hiện có
  // qua A.allowedMarkets() trước khi add/remove để 1 account cũ ['ALL'] (hoặc vừa mở form) được diễn
  // giải đúng thành danh sách chợ cụ thể trước khi người dùng bỏ tick 1 trong số đó.
  function afSetScope(mid, checked) {
    const cur = new Set(A.allowedMarkets({ marketScopes: ui.accForm.marketScopes || [] }));
    if (checked) cur.add(mid); else cur.delete(mid);
    ui.accForm.marketScopes = scopeMarkets().map(m => m.id).filter(m => cur.has(m));
  }
  A.CH['af-scope'] = el => {
    const d = ui.accForm, mid = el.dataset.market;
    if (!d) return;
    const roleId = (d.roleIds && d.roleIds[0]) || '';
    const own = A.allowedMarkets({ marketScopes: d.marketScopes || [] }).includes(mid);
    const state = roleId === 'collector' && A.ACCOUNTS.marketCollectorState ? A.ACCOUNTS.marketCollectorState(mid, d.id) : null;
    const targetIsActive = A.ACCOUNTS.isActive({ status: d.status });
    if (el.checked && !own && targetIsActive && state && state.collectors.length) {
      ui.accPendingCollectorTransfer = { marketId: mid, collectorIds: state.collectors.map(a => a.id) };
      const names = state.collectors.map(a => U.esc(a.fullName)).join(', ');
      A.modal(A.mHead('Chuyển phân công') + `<div class="modal-b">Chợ <b>${U.esc(U.mShort(mid))}</b> hiện đang được <b>${names}</b> phụ trách. Bạn có muốn chuyển phân công sang tài khoản này không?</div><div class="modal-f"><button class="btn" data-act="af-transfer-cancel">Hủy</button><button class="btn primary" data-act="af-transfer-confirm">Chuyển phân công</button></div>`);
      return;
    }
    afSetScope(mid, el.checked);
    renderAccForm();
  };
  A.ACT['af-transfer-cancel'] = () => { ui.accPendingCollectorTransfer = null; renderAccForm(); };
  A.ACT['af-transfer-confirm'] = () => {
    const pending = ui.accPendingCollectorTransfer;
    if (!pending || !ui.accForm) return;
    afSetScope(pending.marketId, true);
    const transfers = new Set(ui.accForm.collectorTransferMarkets || []);
    transfers.add(pending.marketId);
    ui.accForm.collectorTransferMarkets = Array.from(transfers);
    ui.accPendingCollectorTransfer = null;
    renderAccForm();
  };
  A.CH['af-status'] = el => { ui.accForm.status = el.value; };
  A.ACT['acc-form-save'] = () => {
    const d = ui.accForm, isNew = !d.id;
    if (!A.canDo(isNew ? 'tai-khoan.tao-moi' : 'tai-khoan.sua')) return;
    const canAssign = isNew || A.canDo('tai-khoan.gan-quyen');
    if (!d.code || !d.code.trim()) { U.toast('Vui lòng nhập mã tài khoản'); return; }
    if (!d.fullName || !d.fullName.trim()) { U.toast('Vui lòng nhập họ tên'); return; }
    if (A.ACCOUNTS.codeTaken(d.code, d.id)) { U.toast('Mã tài khoản "' + d.code + '" đã tồn tại'); return; }
    const existing = d.id ? A.ACCOUNTS.get(d.id) : null;
    const roleId = canAssign ? ((d.roleIds && d.roleIds[0]) || '') : (existing && A.ACCOUNTS.primaryRole(existing)) || '';
    // RBAC_MARKET_SCOPE_MIGRATION mục 20: system_admin/ward_leader luôn GLOBAL ('ALL', không multi-
    // select); market_manager/collector/technician bắt buộc chọn ít nhất 1 trong 12 chợ; trader
    // không gán phạm vi ở form này (giữ nguyên phạm vi hiện có — quản lý qua Hồ sơ tiểu thương).
    let marketScopes = canAssign ? (d.marketScopes || []) : (existing ? existing.marketScopes : []);
    if (canAssign) {
      const scopeMode = A.ACCOUNTS.scopeModeForRole(roleId);
      if (scopeMode === 'ALL') marketScopes = ['ALL'];
      else if (scopeMode === 'TRADER') marketScopes = existing ? existing.marketScopes : (d.marketScopes || []);
      else if (!marketScopes.length && (roleId !== 'collector' || isNew)) { U.toast('Vui lòng chọn ít nhất một chợ được phân công.'); return; }
    }
    const patch = { code: d.code.trim(), fullName: d.fullName.trim(), phone: existing ? existing.phone : (d.phone || '').trim(), accountType: d.accountType, roleIds: canAssign ? d.roleIds : (existing ? existing.roleIds : []), organization: (d.organization || '').trim(), marketScopes, status: d.status };
    const fullRecord = Object.assign({ id: d.id || ('AC-' + patch.code.trim().toUpperCase()) }, patch);
    if (roleId === 'collector') {
      const saved = A.ACCOUNTS.saveCollectorAccount(fullRecord, { transferMarkets: d.collectorTransferMarkets || [] });
      if (!saved.ok) {
        if (saved.reason === 'TRANSFER_REQUIRED') U.toast('Chợ đã có NV thu phí phụ trách. Hãy chọn “Chuyển phân công”.');
        else if (saved.reason === 'COLLECTOR_SCOPE_REQUIRED') U.toast('Nhân viên thu phí mới cần được phân công ít nhất một chợ.');
        else U.toast('Không thể lưu phân công Nhân viên thu phí.');
        return;
      }
    } else if (d.id) {
      A.ACCOUNTS.update(d.id, patch);
      // Nếu vừa sửa account của phiên hiện tại, kẹp selected market ngay theo marketScopes mới.
      if (A.currentAccount && A.currentAccount().id === d.id) A.syncAccountContext();
      U.log('Cập nhật tài khoản "' + patch.fullName + '" (' + patch.code + ')');
      U.toast('Đã cập nhật tài khoản ' + patch.code);
    } else {
      A.ACCOUNTS.add(fullRecord);
      U.log('Thêm tài khoản mới "' + patch.fullName + '" (' + patch.code + ')');
      U.toast('Đã thêm tài khoản ' + patch.code);
    }
    if (roleId === 'collector') {
      if (A.currentAccount && A.currentAccount().id === fullRecord.id) A.syncAccountContext();
      U.log((d.id ? 'Cập nhật' : 'Thêm') + ' tài khoản "' + patch.fullName + '" (' + patch.code + ')');
      U.toast(d.id ? 'Đã cập nhật tài khoản ' + patch.code : 'Đã thêm tài khoản ' + patch.code);
    }
    ui.accForm = null;
    A.closeModal(); A.render();
  };
  // ---------- Xác nhận có chủ đích trước khi tạm khóa tài khoản ----------
  // "Mã xác nhận thao tác" KHÔNG phải OTP/MFA (không liên quan OTP đăng nhập ở app/auth.js): mã do hệ
  // thống sinh và hiển thị ngay trên popup, Admin nhập lại để chứng tỏ thao tác là có chủ đích.
  // Mã, hạn 30 giây và số lần nhập sai chỉ sống trong biến closure `lockChallenge` — KHÔNG ghi vào
  // Account, A.ui hay localStorage; đóng popup là hủy, mở lại là mã mới. Chỉ cooldown 30 phút của
  // THAO TÁC tạm khóa (không phải khóa tài khoản Admin, không đụng RBAC) được lưu theo id Admin hiện
  // tại, dưới dạng timestamp lockUntil để reload không làm lại từ đầu.
  const LOCK_CODE_TTL_MS = 30 * 1000, LOCK_MAX_FAILS = 3, LOCK_COOLDOWN_MS = 30 * 60 * 1000;
  const ACTION_COOLDOWN_KEY = 'choso-caolanh-action-cooldown', LOCK_ACTION = 'tai-khoan.tam-khoa';
  let lockChallenge = null, lockTimer = null, lockConfirmed = null;
  const cooldownMem = {}; // dự phòng khi localStorage không ghi được
  function readActionCooldowns() {
    try {
      const x = JSON.parse(localStorage.getItem(ACTION_COOLDOWN_KEY) || '{}');
      return x && typeof x === 'object' && !Array.isArray(x) ? x : {};
    } catch (e) { return {}; }
  }
  function actionCooldownRemaining(adminId) {
    if (!adminId) return 0;
    const stored = readActionCooldowns()[adminId];
    const until = Math.max(+(stored && stored[LOCK_ACTION]) || 0, cooldownMem[adminId] || 0);
    return Math.max(0, until - Date.now());
  }
  function startActionCooldown(adminId) {
    const until = Date.now() + LOCK_COOLDOWN_MS, map = readActionCooldowns();
    cooldownMem[adminId] = until;
    Object.keys(map).forEach(id => { if (!(+(map[id] && map[id][LOCK_ACTION]) > Date.now())) delete map[id]; });
    map[adminId] = Object.assign({}, map[adminId], { [LOCK_ACTION]: until });
    try { localStorage.setItem(ACTION_COOLDOWN_KEY, JSON.stringify(map)); } catch (e) { console.warn('Không lưu được thời gian tạm vô hiệu thao tác tạm khóa', e); }
  }
  const mmss = ms => { const s = Math.ceil(Math.max(0, ms) / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const cooldownMsg = ms => 'Tạm thời không khả dụng. Thử lại sau ' + mmss(ms) + '.';
  function createActionConfirmationCode() {
    const n = typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(1))[0] % 1000000 : Math.floor(Math.random() * 1000000);
    return String(n).padStart(6, '0');
  }
  function renewLockCode(ch) { ch.code = createActionConfirmationCode(); ch.expiresAt = Date.now() + LOCK_CODE_TTL_MS; ch.entered = ''; ch.error = ''; }
  function stopLockTimer() { if (lockTimer) { clearInterval(lockTimer); lockTimer = null; } }
  function discardLockChallenge() { stopLockTimer(); lockChallenge = null; }
  const lockExpired = ch => Date.now() >= ch.expiresAt;
  const lockCanSubmit = ch => !!ch.reason.trim() && ch.entered.length === 6 && !lockExpired(ch);
  function lockTimerHtml(ch) {
    return lockExpired(ch)
      ? '<span class="acc-lock-expired">Mã xác nhận đã hết hiệu lực.</span><button class="btn sm" data-act="acc-lock-renew">Tạo mã mới</button>'
      : `Mã có hiệu lực trong <b>${mmss(ch.expiresAt - Date.now())}</b>`;
  }
  // Cập nhật tại chỗ (không vẽ lại popup) để giữ con trỏ trong ô đang nhập.
  function syncLockModal() {
    const ch = lockChallenge;
    if (!ch) return;
    const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
    set('acc-lock-timer', el => { el.innerHTML = lockTimerHtml(ch); });
    set('acc-lock-code', el => { el.classList.toggle('expired', lockExpired(ch)); });
    set('acc-lock-error', el => { el.textContent = ch.error; el.hidden = !ch.error; });
    set('acc-lock-submit', el => { el.disabled = !lockCanSubmit(ch); });
  }
  function renderLockModal() {
    const ch = lockChallenge, a = ch && A.ACCOUNTS.get(ch.targetId);
    if (!a) return;
    const scope = (a.marketScopes || []).includes('ALL') ? 'Tất cả chợ' : (accScopeNames(a).map(U.esc).join(', ') || '<span class="muted">Chưa phân công</span>');
    A.modal(`<div class="modal-h"><h3>Tạm khóa tài khoản</h3><button class="x" data-act="acc-lock-cancel" aria-label="Đóng">×</button></div>
      <div class="modal-b acc-lock" id="acc-lock-root">
        <div class="acc-lock-target"><span class="avatar">${U.esc(accInitials(a.fullName))}</span><div class="acc-lock-who"><b>${U.esc(a.fullName)}</b><span>${U.esc(a.code)} · ${accRoleNames(a)}</span><span>${scope}</span></div>${accStatusTag(a)}</div>
        <div class="note">Tài khoản sẽ không thể tiếp tục sử dụng hệ thống sau khi bị tạm khóa.</div>
        <div class="field"><label for="acc-lock-reason">Lý do tạm khóa <b class="acc-lock-req">*</b></label><textarea id="acc-lock-reason" class="input" rows="3" data-in="acc-lock-reason" placeholder="Nhập lý do tạm khóa tài khoản...">${U.esc(ch.reason)}</textarea></div>
        <div class="acc-lock-section">Xác nhận thao tác</div>
        <div class="field"><label>Mã xác nhận</label><div class="acc-lock-code ${lockExpired(ch) ? 'expired' : ''}" id="acc-lock-code">${ch.code.slice(0, 3)} ${ch.code.slice(3)}</div></div>
        <div class="field"><label for="acc-lock-input">Nhập lại mã</label><input id="acc-lock-input" class="input acc-lock-input" data-in="acc-lock-code" value="${U.esc(ch.entered)}" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="______"><small class="muted">Nhập lại chính xác mã 6 chữ số bên trên để xác nhận thao tác.</small></div>
        <div class="acc-lock-timer" id="acc-lock-timer" aria-live="polite">${lockTimerHtml(ch)}</div>
        <div class="acc-lock-error" id="acc-lock-error" role="alert" ${ch.error ? '' : 'hidden'}>${U.esc(ch.error)}</div>
      </div>
      <div class="modal-f"><button class="btn" data-act="acc-lock-cancel">Hủy</button><button class="btn danger acc-lock-submit" id="acc-lock-submit" data-act="acc-lock-confirm" ${lockCanSubmit(ch) ? '' : 'disabled'}>Tạm khóa</button></div>`);
  }
  function startLockTimer() {
    stopLockTimer();
    if (typeof setInterval !== 'function') return;
    lockTimer = setInterval(() => {
      // Popup bị đóng bằng đường chung (nền mờ/Esc → A.closeModal) → hủy mã đang giữ.
      if (!lockChallenge || !document.getElementById('acc-lock-root')) { discardLockChallenge(); return; }
      syncLockModal();
    }, 1000);
  }
  function startActionConfirmation(a) {
    const admin = A.currentAccount(), wait = actionCooldownRemaining(admin && admin.id);
    if (wait) { U.toast(cooldownMsg(wait)); return; }
    discardLockChallenge();
    lockChallenge = { targetId: a.id, adminId: admin && admin.id, reason: '', fails: 0 };
    renewLockCode(lockChallenge);
    renderLockModal();
    startLockTimer();
  }
  // Trả về lỗi hiển thị, hoặc '' khi hợp lệ. Nhập sai mã mới tính vào failedAttempts.
  function validateActionConfirmation(ch) {
    if (!ch.reason.trim()) return 'Vui lòng nhập lý do tạm khóa.';
    if (lockExpired(ch)) return 'Mã xác nhận đã hết hiệu lực.';
    if (!/^\d{6}$/.test(ch.entered)) return 'Vui lòng nhập đủ 6 chữ số của mã xác nhận.';
    if (ch.entered !== ch.code) { ch.fails++; return 'WRONG'; }
    return '';
  }
  A.IN['acc-lock-reason'] = el => { if (!lockChallenge) return; lockChallenge.reason = el.value; syncLockModal(); };
  A.IN['acc-lock-code'] = el => {
    if (!lockChallenge) return;
    const digits = String(el.value || '').replace(/\D/g, '').slice(0, 6);
    if (el.value !== digits) el.value = digits;
    lockChallenge.entered = digits; syncLockModal();
  };
  A.ACT['acc-lock-renew'] = () => {
    if (!lockChallenge) return;
    renewLockCode(lockChallenge); renderLockModal(); startLockTimer();
  };
  A.ACT['acc-lock-cancel'] = () => { discardLockChallenge(); A.closeModal(); };
  A.ACT['acc-lock-confirm'] = () => {
    const ch = lockChallenge;
    if (!ch || !A.canDo('tai-khoan.khoa-mo-khoa')) return;
    const a = A.ACCOUNTS.get(ch.targetId), admin = A.currentAccount();
    if (!a || A.ACCOUNTS.authStatus(a) !== 'ACTIVE' || !admin || admin.id !== ch.adminId) { discardLockChallenge(); A.closeModal(); return; }
    const wait = actionCooldownRemaining(admin.id);
    if (wait) { discardLockChallenge(); A.closeModal(); U.toast(cooldownMsg(wait)); return; }
    const err = validateActionConfirmation(ch);
    if (err === 'WRONG') {
      if (ch.fails >= LOCK_MAX_FAILS) {
        startActionCooldown(admin.id);
        discardLockChallenge();
        A.modal(`<div class="modal-h"><h3>Tạm khóa tài khoản</h3><button class="x" data-act="close" aria-label="Đóng">×</button></div>
          <div class="modal-b"><div class="acc-lock-error">Bạn đã nhập sai mã xác nhận ${LOCK_MAX_FAILS} lần. Chức năng tạm khóa tài khoản tạm thời bị vô hiệu hóa trong 30 phút.</div></div>
          <div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`);
        return;
      }
      ch.error = 'Mã xác nhận không chính xác. Bạn còn ' + (LOCK_MAX_FAILS - ch.fails) + ' lần thử.';
      syncLockModal();
      return;
    }
    if (err) { ch.error = err; syncLockModal(); return; }
    // Hợp lệ → gọi đúng handler khóa/mở khóa sẵn có; lockConfirmed chỉ dùng được 1 lần cho đúng account.
    lockConfirmed = { id: a.id, reason: ch.reason.trim(), actorId: admin.id };
    discardLockChallenge();
    A.closeModal();
    A.ACT['acc-toggle']({ dataset: { id: a.id } });
  };
  A.ACT['acc-toggle'] = el => {
    if (!A.canDo('tai-khoan.khoa-mo-khoa')) return;
    const a = A.ACCOUNTS.get(el.dataset.id);
    if (!a) return;
    const wasActive = A.ACCOUNTS.authStatus(a) === 'ACTIVE';
    // Tạm khóa chỉ chạy sau khi xác nhận thành công ở acc-lock-confirm; gọi thẳng (menu/console) chỉ
    // mở popup xác nhận. Mở khóa giữ nguyên như cũ.
    const confirmed = wasActive && lockConfirmed && lockConfirmed.id === a.id ? lockConfirmed : null;
    lockConfirmed = null;
    if (wasActive && !confirmed) { startActionConfirmation(a); return; }
    A.ACCOUNTS.setStatus(a.id, wasActive ? 'LOCKED' : 'ACTIVE');
    U.log((wasActive ? 'Tạm khoá' : 'Mở khoá') + ' tài khoản "' + a.fullName + '" (' + a.code + ')' + (confirmed ? ' — Lý do: ' + confirmed.reason : ''));
    if (confirmed) {
      // Bổ sung metadata tối thiểu vào đúng dòng nhật ký vừa ghi (không lưu mã xác nhận).
      Object.assign(A.db.extraLog[0], { action: 'ACCOUNT_SUSPENDED', actorId: confirmed.actorId, targetId: a.id, reason: confirmed.reason, timestamp: new Date().toISOString() });
      if (A.save) A.save();
    }
    A.render();
    U.toast(wasActive ? 'Đã tạm khóa tài khoản ' + a.code + ' – ' + a.fullName + '.' : 'Đã mở khóa tài khoản ' + a.code);
  };
  A.VIEWS['tai-khoan'] = function () { return accountsView(); };

  if (!ui.acc) ui.acc = { search: '', type: 'all', role: '', market: '', status: '', viewMode: ACC_VIEW.ACCOUNTS };
  if (!ui.acc.viewMode) ui.acc.viewMode = ACC_VIEW.ACCOUNTS;
})(window.APP);
