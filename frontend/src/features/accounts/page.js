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
  function scopeMarkets() { return A.allowedMarkets({ marketScopes: ['ALL'] }).map(id => U.market(id)); }
  function allMarketsLabel() { return 'Toàn bộ ' + scopeMarkets().length + ' chợ'; }
  function currentAccounts() { return A.ACCOUNTS.currentList ? A.ACCOUNTS.currentList() : A.ACCOUNTS.list(); }
  function managementUnit() { return (A.MARKET_CATALOG && A.MARKET_CATALOG.MANAGEMENT_UNIT) || 'Tổ Quản lý chợ'; }
  // Đơn vị hiển thị: A.ACCOUNTS.organizationOf (actor metadata theo vai trò; account cũ không dùng chuỗi đã lưu).
  const accountOrganization = a => A.ACCOUNTS.organizationOf(a);
  function accScopeNames(a) { return A.allowedMarkets(a).map(id => U.mShort(id)); }
  // NV kỹ thuật được giao việc theo từng sự cố (Incident.assignee), không "sở hữu" chợ/dãy nào.
  const INCIDENT_SCOPE_LABEL = 'Theo sự cố được giao';
  const isIncidentScoped = a => A.ACCOUNTS.primaryRole(a) === 'technician';
  // Chỉ presentation của cột "Phạm vi chợ": không dùng marketScopes cho Tiểu thương.
  // Thứ tự luôn theo catalog chợ hiện hành, không theo thứ tự id được lưu trên account.
  function accountScopeMarkets(a) {
    const roleId = A.ACCOUNTS.primaryRole(a);
    if (roleId === 'trader') {
      const ids = new Set(A.ACCOUNTS.traderMarketsOf ? A.ACCOUNTS.traderMarketsOf(a) : []);
      return scopeMarkets().filter(m => ids.has(m.id));
    }
    // Cột quản trị phải hiển thị assignment đã persist kể cả khi account đang chờ kích hoạt/khóa;
    // A.allowedMarkets() vẫn là lớp authorization runtime riêng.
    const ids = new Set((a.marketScopes || []).includes('ALL') ? scopeMarkets().map(m => m.id) : (a.marketScopes || []));
    return scopeMarkets().filter(m => ids.has(m.id));
  }
  function accountScopePresentation(a) {
    const roleId = A.ACCOUNTS.primaryRole(a);
    if (isIncidentScoped(a)) return { kind: 'incident', label: INCIDENT_SCOPE_LABEL, markets: [], interactive: false };
    const markets = accountScopeMarkets(a);
    if (!markets.length) return { kind: 'empty', label: 'Chưa được phân công', markets, interactive: false };
    const global = roleId !== 'trader' && (a.marketScopes || []).includes('ALL');
    if (global) return { kind: 'global', label: allMarketsLabel(), markets, interactive: true, title: 'Phạm vi truy cập', footer: markets.length + ' chợ' };
    const trader = roleId === 'trader';
    return {
      kind: trader ? 'trader' : 'assigned',
      label: markets[0].name,
      markets,
      interactive: markets.length > 1,
      title: trader ? 'Chợ có hồ sơ tiểu thương' : 'Phạm vi được phân công',
      footer: trader ? markets.length + ' chợ có hồ sơ được liên kết' : markets.length + ' chợ'
    };
  }
  function accScopeLabel(a) {
    const p = accountScopePresentation(a);
    if (!p.interactive) return p.kind === 'empty' ? '<span class="muted">Chưa được phân công</span>' : U.esc(p.label);
    const suffix = p.kind === 'global'
      ? '<span class="acc-scope-chevron" aria-hidden="true">▾</span>'
      : `<span class="acc-scope-more">+${p.markets.length - 1}</span>`;
    const aria = p.kind === 'global' ? `Xem danh sách ${p.markets.length} chợ` : `Xem thêm ${p.markets.length - 1} chợ`;
    const main = p.kind === 'global' ? U.esc(p.label) : U.esc(p.label);
    const conflicts = A.ACCOUNTS.collectorMarketConflicts ? A.ACCOUNTS.collectorMarketConflicts(a) : [];
    return `<button class="acc-scope-trigger ${p.kind === 'global' ? 'acc-scope-trigger-all' : ''}" data-act="acc-scope-popover" data-id="${U.esc(a.id)}" title="${U.esc(aria)}" aria-label="${U.esc(aria)}"><span>${main}</span>${suffix}</button>`
      + (conflicts.length ? ` <span class="tag warn" title="Có ${conflicts.length} chợ đang được nhiều NV thu phí phụ trách">!</span>` : '');
  }
  function closeScopePopover() {
    const root = A.$('#modal-root');
    const open = root && ((root.querySelector && root.querySelector('.acc-scope-popover')) || String(root.innerHTML || '').includes('acc-scope-popover'));
    if (open) root.innerHTML = '';
  }
  function scopePopoverHtml(a, p, rect) {
    const width = 320;
    const viewportWidth = (typeof window !== 'undefined' && window.innerWidth) || 1024;
    const viewportHeight = (typeof window !== 'undefined' && window.innerHeight) || 768;
    const left = Math.max(8, Math.min(Math.round((rect && rect.left) || 8), viewportWidth - width - 8));
    const top = Math.max(8, Math.min(Math.round(((rect && rect.bottom) || 8) + 6), viewportHeight - 300));
    return `<div class="acc-scope-popover-backdrop" data-act="acc-scope-popover-close"></div>
      <section class="acc-scope-popover" role="dialog" aria-label="${U.esc(p.title)}" style="top:${top}px;left:${left}px">
        <h4>${U.esc(p.title)}</h4>
        <div class="acc-scope-popover-list">${p.markets.map(m => `<div><span aria-hidden="true">✓</span><b>${U.esc(m.name)}</b></div>`).join('')}</div>
        <footer>${U.esc(p.footer)}</footer>
      </section>`;
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
    const scopeFull = isIncidentScoped(a) ? INCIDENT_SCOPE_LABEL : (a.marketScopes || []).includes('ALL') ? allMarketsLabel() : (accScopeNames(a).map(U.esc).join(', ') || '<span class="muted">Chưa phân công</span>');
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
  // FORM TÀI KHOẢN NỘI BỘ (Thêm + Sửa dùng chung renderAccForm/acc-form-save) — CHỈ quản lý danh tính tài khoản;
  // phần phạm vi ĐỘNG THEO VAI TRÒ và luôn chỉ đọc:
  //   collector (A03)  → KHÔNG phân công Chợ ở đây. Tạo mới = chưa được phân công (marketScopes []); sửa chỉ hiển
  //                      thị Chợ đang phụ trách. Phân công/chuyển Chợ là nghiệp vụ của Tổ trưởng (Account.marketScopes
  //                      qua A.ACCOUNTS.saveCollectorAccount), không phải của Admin tạo tài khoản.
  //   technician (A04) → "Theo sự cố được giao" (Incident.assignee); marketScopes=['ALL'] chỉ là giá trị tương
  //                      thích để mở sự cố được giao, không hiển thị như phân công Chợ.
  //   system_admin/market_manager/central_accountant/ward_leader → "Toàn bộ N chợ" (lưu ['ALL']).
  //   trader → không gán phạm vi ở đây (Tiểu thương → Hồ sơ tiểu thương → Tài khoản Mini App).
  const ROLE_SCOPE_INFO = {
    system_admin: { title: 'Phạm vi dữ liệu', all: true },
    market_manager: { title: 'Phạm vi quản lý', all: true, help: 'Quản lý hoạt động của Tổ Quản lý chợ trên toàn bộ hệ thống.' },
    technician: { title: 'Phạm vi công việc', value: INCIDENT_SCOPE_LABEL, help: 'Nhân viên kỹ thuật được Tổ trưởng phân công theo từng phản ánh/sự cố.' },
    central_accountant: { title: 'Phạm vi dữ liệu', all: true, help: 'Thực hiện nghiệp vụ kế toán và đối soát theo quyền được phân.' },
    ward_leader: { title: 'Phạm vi theo dõi', all: true, help: 'Xem và giám sát số liệu tổng hợp theo quyền được phân.' }
  };
  const afRole = d => (d && d.roleIds && d.roleIds[0]) || '';
  // Chợ NV thu phí trong form: chỉ id Chợ cụ thể hợp lệ — không bao giờ diễn giải 'ALL' thành 12 Chợ.
  const afCollectorScopes = d => { const valid = new Set(scopeMarkets().map(m => m.id)); return (d.marketScopes || []).filter(id => valid.has(id)); };
  function afInfoBox(title, value, help) {
    return `<section class="af-scope"><div class="af-scope-title">${U.esc(title)}</div><div class="af-scope-value">${U.esc(value)}</div>${help ? `<p class="af-scope-help">${U.esc(help)}</p>` : ''}</section>`;
  }
  const ACC_PENDING = 'PENDING_ACTIVATION';
  function afCollectorInfoHtml(d) {
    const names = afCollectorScopes(d).map(id => U.mShort(id));
    return names.length
      ? afInfoBox('Phân công công việc', 'Đang phụ trách: ' + names.join(', '), 'Phân công chợ do Tổ trưởng Tổ Quản lý chợ thực hiện.')
      : afInfoBox('Phân công công việc', 'Chưa được phân công chợ', 'Tổ trưởng Tổ Quản lý chợ sẽ phân công chợ sau khi tài khoản được tạo.');
  }
  function afScopeSectionHtml(d) {
    const roleId = afRole(d);
    if (!roleId) return '<section class="af-scope af-scope-empty">Chọn vai trò để xác định phạm vi làm việc.</section>';
    if (roleId === 'collector') return afCollectorInfoHtml(d);
    if (roleId === 'trader') return afInfoBox('Phạm vi', 'Theo hồ sơ tiểu thương', 'Tài khoản Tiểu thương được quản lý qua Tiểu thương → Hồ sơ tiểu thương → Tài khoản Mini App.');
    const info = ROLE_SCOPE_INFO[roleId];
    if (info) return afInfoBox(info.title, info.all ? allMarketsLabel() : info.value, info.help);
    // Vai trò không thuộc danh mục actor (tuỳ biến/legacy khi sửa account cũ): chỉ hiển thị, giữ phạm vi đã lưu.
    const names = A.allowedMarkets({ marketScopes: d.marketScopes || [] }).map(id => U.mShort(id));
    return afInfoBox('Phạm vi', names.join(', ') || 'Chưa phân công', 'Vai trò này giữ nguyên phạm vi đã lưu.');
  }
  // Danh sách vai trò của form: role nội bộ hiện hành; khi SỬA account có role ngoài danh sách (trader, role
  // tuỳ biến) thì vẫn hiện đúng role đó để không âm thầm đổi vai trò.
  function afRoleOptions(d, isNew) {
    const roles = A.ACCOUNTS.internalRoles();
    const existing = !isNew && d.id ? A.ACCOUNTS.get(d.id) : null, own = existing && A.ACCOUNTS.primaryRole(existing);
    if (own && !roles.some(r => r.id === own) && A.PERM.role(own)) roles.push(A.PERM.role(own));
    return roles;
  }
  function renderAccForm() {
    const d = ui.accForm, isNew = !d.id;
    const canAssign = isNew || A.canDo('tai-khoan.gan-quyen');
    const dis = canAssign ? '' : 'disabled';
    // Tài khoản Tiểu thương chỉ tạo từ "Cần xử lý → Tạo tài khoản" (liên kết hồ sơ); form này dành cho
    // tài khoản nội bộ nên không có vai trò Tiểu thương khi tạo mới. "Loại tài khoản" (accountType) tự đồng bộ
    // theo vai trò (A.CH['af-role']).
    const currentRole = afRole(d), traderRoleLocked = currentRole === 'trader';
    const existing = !isNew ? A.ACCOUNTS.get(d.id) : null;
    const org = A.ACCOUNTS.organizationForRole(currentRole) || (existing ? A.ACCOUNTS.organizationOf(existing) : '');
    const phoneField = isNew
      ? `<input class="input" data-ch="af-phone" inputmode="numeric" placeholder="0xxxxxxxxx" value="${U.esc(d.phone || '')}">`
      : `<input class="input" value="${U.esc(U.maskPhone(d.phone || ''))}" readonly><small class="muted">Số đăng nhập chỉ thay đổi qua quy trình yêu cầu, phê duyệt và OTP.</small>${A.phoneChangeAdminOpenButton ? A.phoneChangeAdminOpenButton(d.id) : ''}`;
    // Tạo mới: mã do hệ thống sinh lúc Lưu, trạng thái luôn "Chờ kích hoạt" (kích hoạt sau OTP đầu tiên).
    const codeField = isNew
      ? '<div class="af-readonly-text">Hệ thống tự động tạo</div>'
      : `<input class="input af-readonly" value="${U.esc(d.code || '')}" readonly tabindex="-1">`;
    const statusField = isNew
      ? '<div class="af-readonly-text">Chờ kích hoạt</div><small class="muted">Tài khoản sẽ được kích hoạt sau lần xác thực OTP đầu tiên.</small>'
      : `<select class="input" data-ch="af-status">${A.ACCOUNTS.authStatus(d) === ACC_PENDING ? '<option value="PENDING_ACTIVATION" selected>Chờ kích hoạt</option>' : ''}<option value="ACTIVE" ${A.ACCOUNTS.authStatus(d) === 'ACTIVE' ? 'selected' : ''}>Đang hoạt động</option><option value="LOCKED" ${A.ACCOUNTS.authStatus(d) === 'LOCKED' ? 'selected' : ''}>Tạm khóa</option></select>`;
    A.modal(A.mHead(isNew ? 'Thêm tài khoản nội bộ' : 'Sửa tài khoản') + `<div class="modal-b acc-form"><div class="form-grid">
      <div class="field"><label>Họ và tên *</label><input class="input" data-ch="af-name" value="${U.esc(d.fullName || '')}"></div>
      <div class="field"><label>Số điện thoại đăng nhập${isNew ? ' *' : ''}</label>${phoneField}</div>
      <div class="field"><label>Vai trò *</label><select class="input" data-ch="af-role" ${dis || (traderRoleLocked ? 'disabled' : '')}><option value="">— Chọn vai trò —</option>${afRoleOptions(d, isNew).map(r => `<option value="${r.id}" ${currentRole === r.id ? 'selected' : ''}>${U.esc(r.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Đơn vị</label><input class="input af-readonly" value="${U.esc(org)}" placeholder="Tự xác định theo vai trò" readonly tabindex="-1"></div>
      <div class="field"><label>Mã tài khoản</label>${codeField}</div>
      <div class="field"><label>Trạng thái</label>${statusField}</div>
    </div>
    ${afScopeSectionHtml(d)}
    ${!canAssign ? '<div class="note" style="margin-top:12px">Bạn không có quyền gán vai trò / phạm vi chợ nên các trường này đang bị khoá.</div>' : ''}
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="acc-form-save">${isNew ? 'Tạo tài khoản' : 'Lưu thay đổi'}</button></div>`);
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
    const filters = `<div class="card acc-filters"><div class="card-b row"><input class="input acc-search" placeholder="Tìm họ tên, mã tài khoản, số điện thoại..." data-in="accq-search" value="${U.esc(q.search)}"><select class="input" data-ch="accq-type"><option value="">Loại người dùng: Tất cả</option><option value="staff" ${q.type === 'staff' ? 'selected' : ''}>${USER_KIND.staff}</option><option value="trader" ${q.type === 'trader' ? 'selected' : ''}>${USER_KIND.trader}</option></select><select class="input" data-ch="accq-role"><option value="">Vai trò: Tất cả</option>${A.PERM.currentRoles().map(r => `<option value="${r.id}" ${q.role === r.id ? 'selected' : ''}>${U.esc(r.name)}</option>`).join('')}</select><select class="input" data-ch="accq-market"><option value="">Phạm vi chợ: Tất cả</option>${D.MARKETS.map(m => `<option value="${m.id}" ${q.market === m.id ? 'selected' : ''}>${U.esc(m.short)}</option>`).join('')}</select><button class="btn" data-act="accq-clear">Đặt lại</button></div></div>`;
    const table = U.table([{ t: 'Mã tài khoản' }, { t: 'Người dùng' }, { t: 'Số điện thoại' }, { t: 'Loại người dùng' }, { t: 'Vai trò' }, { t: 'Phạm vi chợ' }, { t: 'Ngày tạo' }, { t: 'Trạng thái' }, { t: 'Thao tác' }], rows.slice(pg.start, pg.end).map(a => `<tr class="click" data-act="acc-open" data-id="${a.id}"><td>${U.esc(a.code)}</td><td><b>${U.esc(a.fullName)}</b></td><td>${accPhone(a)}</td><td>${USER_KIND[accKind(a)]}</td><td>${accRoleNames(a)}</td><td>${accScopeLabel(a)}</td><td>${a.createdAt ? U.dmy(a.createdAt) : '—'}</td><td>${accStatusTag(a)}</td><td><button class="btn sm" data-act="acc-open" data-id="${a.id}">Xem</button></td></tr>`), { empty: 'Không có tài khoản chờ kích hoạt' }) + pg.html;
    return filters + queueTable('Tài khoản chờ kích hoạt', rows.length + ' tài khoản', table);
  }
  // Mọi cặp Hợp đồng–Điểm hợp lệ của hồ sơ (trader-account.js là nguồn điều kiện), không chỉ cặp đầu tiên.
  const queuePairs = (x, key, field) => (x.pairs || [{ c: x.c, s: x.s }]).map(p => p[key] && p[key][field]).filter(Boolean).join(', ');
  function traderWithoutAccountQueue(canCreate) {
    const q = queueState(), source = A.features.accounts.service.traderAccountRows ? A.features.accounts.service.traderAccountRows() : [], rows = source.filter(x => (!q.market || x.t.market === q.market) && (!q.search || [x.t.id, x.t.name, x.t.phone, queuePairs(x, 'c', 'id'), queuePairs(x, 's', 'code')].join(' ').toLowerCase().includes(q.search.toLowerCase()))), pg = U.pager('accQueue', rows.length, 15);
    const filters = `<div class="card acc-filters"><div class="card-b row"><input class="input acc-search" placeholder="Tìm mã tiểu thương, tên, SĐT, điểm, hợp đồng..." data-in="accq-search" value="${U.esc(q.search)}"><select class="input" data-ch="accq-market"><option value="">Chợ: Tất cả</option>${D.MARKETS.filter(m => A.allowedMarkets(A.currentAccount()).includes(m.id)).map(m => `<option value="${m.id}" ${q.market === m.id ? 'selected' : ''}>${U.esc(m.short)}</option>`).join('')}</select><button class="btn" data-act="accq-clear">Đặt lại</button></div></div>`;
    const table = U.table([{ t: 'Mã tiểu thương' }, { t: 'Tiểu thương' }, { t: 'Số điện thoại' }, { t: 'Điểm kinh doanh' }, { t: 'Hợp đồng' }, { t: 'Chợ' }, { t: 'Trạng thái' }, { t: 'Thao tác' }], rows.slice(pg.start, pg.end).map(x => `<tr><td>${U.esc(x.t.id)}</td><td><b>${U.esc(x.t.name)}</b></td><td>${U.esc(U.maskPhone(x.t.phone || ''))}</td><td>${U.esc(queuePairs(x, 's', 'code') || '—')}</td><td>${U.esc(queuePairs(x, 'c', 'id') || '—')}</td><td>${U.esc(U.mShort(x.t.market))}</td><td><span class="tag warn">Chưa có tài khoản</span></td><td>${canCreate ? `<button class="btn sm primary" data-act="wf-account-open" data-id="${x.t.id}">Tạo tài khoản</button>` : '<span class="muted small">Chỉ xem</span>'}</td></tr>`), { empty: 'Không có tiểu thương phù hợp' }) + pg.html;
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
      <select class="input" data-ch="acc-role"><option value="">Vai trò: Tất cả</option>${A.PERM.currentRoles().map(r => `<option value="${r.id}" ${f.role === r.id ? 'selected' : ''}>${U.esc(r.name)}</option>`).join('')}</select>
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
  A.ACT['acc-scope-popover'] = el => {
    const a = A.ACCOUNTS.get(el.dataset.id), p = a && accountScopePresentation(a);
    if (!a || !p || !p.interactive) return;
    const root = A.$('#modal-root');
    const open = root && ((root.querySelector && root.querySelector('.acc-scope-popover')) || String(root.innerHTML || '').includes('acc-scope-popover'));
    if (open) { closeScopePopover(); return; }
    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 8, bottom: 8 };
    if (root) root.innerHTML = scopePopoverHtml(a, p, rect);
  };
  A.ACT['acc-scope-popover-close'] = () => closeScopePopover();
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
  // Fixed-position popover must not remain detached from its account row while the table scrolls.
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('scroll', closeScopePopover, true);
  A.ACT['acc-new'] = () => {
    if (!A.canDo('tai-khoan.tao-moi')) return;
    // Chưa chọn vai trò → chưa biết chợ nào phù hợp, để trống thay vì mặc định cứng — admin chọn
    // vai trò trước (A.CH['af-role'] tự hiện đúng dạng Phạm vi), rồi mới tick chợ. "Loại tài khoản"
    // mặc định ACCOUNT_TYPES[3] = tên role 'collector' (thứ tự cố định theo defaultRoles(),
    // js/permissions.js) — vai trò vận hành phổ biến nhất, tránh mặc định thiên về quyền cao.
    ui.accForm = { id: null, code: '', fullName: '', phone: '', accountType: A.ACCOUNTS.ACCOUNT_TYPES[3], roleIds: [], organization: '', marketScopes: [], status: ACC_PENDING };
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
    ui.accForm = { id: a.id, code: a.code, fullName: a.fullName, phone: a.phone, accountType: a.accountType, roleIds: (a.roleIds || []).slice(), organization: a.organization, marketScopes: (a.marketScopes || []).slice(), status: a.status };
    renderAccForm();
  };
  A.CH['af-name'] = el => { ui.accForm.fullName = el.value; };
  A.CH['af-phone'] = el => { ui.accForm.phone = el.value; };
  A.CH['af-type'] = el => { ui.accForm.accountType = el.value; };
  // Đổi vai trò làm phần "Phạm vi" hiện đúng dạng tương ứng (mục 20 yêu cầu: GLOBAL/trader/multi-
  // select 12 chợ) — phải vẽ lại cả form, có tiền lệ an toàn ở v-taichinh.js A.CH['adj-proposed'].
  // Đồng bộ luôn "Loại tài khoản" theo tên vai trò mới chọn (2 field cùng phản ánh 1 vai trò, tránh
  // lệch nhãn) — admin vẫn có thể tự đổi lại "Loại tài khoản" sau nếu muốn.
  // Đổi vai trò KHÔNG mang marketScopes của vai trò cũ sang: NV thu phí chỉ còn Chợ nếu CHÍNH account này đang là
  // NV thu phí (hiển thị lại phân công đã lưu, chỉ đọc); vai trò khác được chuẩn hoá lúc Lưu (['ALL'] …).
  A.CH['af-role'] = el => {
    const d = ui.accForm, roleId = el.value || '';
    const existing = d.id ? A.ACCOUNTS.get(d.id) : null, ownRole = existing && A.ACCOUNTS.primaryRole(existing);
    d.roleIds = roleId ? [roleId] : [];
    const r = roleId ? A.PERM.role(roleId) : null;
    if (r) d.accountType = r.name;
    d.marketScopes = existing && roleId === ownRole ? (roleId === 'collector' ? afCollectorScopes({ marketScopes: existing.marketScopes }) : (existing.marketScopes || []).slice()) : [];
    renderAccForm();
  };
  A.CH['af-status'] = el => { ui.accForm.status = el.value; };
  const afPhoneOk = phone => /^0\d{9}$/.test(A.ACCOUNTS.normalizePhone(phone));
  A.ACT['acc-form-save'] = () => {
    const d = ui.accForm, isNew = !d.id;
    if (!A.canDo(isNew ? 'tai-khoan.tao-moi' : 'tai-khoan.sua')) return;
    const canAssign = isNew || A.canDo('tai-khoan.gan-quyen');
    if (!d.fullName || !d.fullName.trim()) { U.toast('Vui lòng nhập họ và tên'); return; }
    // SĐT đăng nhập: bắt buộc khi tạo mới (cùng quy tắc 10 số bắt đầu bằng 0 của luồng đổi số), không trùng
    // account khác vì đăng nhập OTP tra account theo SĐT. Khi sửa, SĐT chỉ đổi qua quy trình yêu cầu đổi số.
    if (isNew) {
      if (!afPhoneOk(d.phone)) { U.toast('Vui lòng nhập số điện thoại gồm 10 chữ số, bắt đầu bằng 0.'); return; }
      if (A.ACCOUNTS.byPhone(d.phone)) { U.toast('Số điện thoại đã được dùng cho tài khoản khác.'); return; }
    }
    const existing = d.id ? A.ACCOUNTS.get(d.id) : null;
    const ownRole = existing ? A.ACCOUNTS.primaryRole(existing) : '';
    const roleId = canAssign ? afRole(d) : (ownRole || '');
    if (!roleId) { U.toast('Vui lòng chọn vai trò'); return; }
    if (canAssign && roleId !== ownRole && !A.ACCOUNTS.internalRoles().some(r => r.id === roleId)) { U.toast('Vai trò không dùng cho tài khoản nội bộ.'); return; }
    // Phạm vi theo vai trò: vai trò toàn hệ thống (kể cả technician — giá trị tương thích) → ['ALL'];
    // NV thu phí → Chợ cụ thể, bắt buộc ≥1 Chợ khi đang hoạt động; trader/vai trò ngoài danh mục → giữ nguyên.
    let marketScopes = existing ? existing.marketScopes : [];
    if (canAssign) {
      const scopeMode = A.ACCOUNTS.scopeModeForRole(roleId);
      // NV thu phí: form KHÔNG đổi phân công Chợ. Tạo mới / vừa đổi sang NV thu phí → [] (chưa được phân công, hợp
      // lệ ở mọi trạng thái); NV thu phí đã có → giữ nguyên Chợ đang phụ trách.
      if (roleId === 'collector') marketScopes = roleId === ownRole ? existing.marketScopes : [];
      else if (scopeMode === 'ALL') marketScopes = ['ALL'];
      else if (roleId === ownRole) marketScopes = existing.marketScopes;
      else marketScopes = [];
    }
    const organization = A.ACCOUNTS.organizationForRole(roleId) || (existing && existing.organization) || '';
    // Mã: tạo mới → hệ thống sinh ngay lúc Lưu (không lấy từ form); sửa → giữ nguyên mã cũ (bất biến).
    const code = isNew ? A.features.accounts.service.nextInternalAccountCode(roleId, U.pad) : existing.code;
    if (!code) { U.toast('Không xác định được mã tài khoản cho vai trò này.'); return; }
    const patch = { code, fullName: d.fullName.trim(), phone: existing ? existing.phone : A.ACCOUNTS.normalizePhone(d.phone), accountType: d.accountType, roleIds: canAssign ? [roleId] : (existing ? existing.roleIds : []), organization, marketScopes, status: isNew ? ACC_PENDING : d.status };
    const fullRecord = Object.assign({ id: d.id || ('AC-' + code) }, patch);
    // Prototype: chưa có nhà cung cấp SMS — chỉ tạo hướng dẫn kích hoạt (không khẳng định đã gửi thật).
    const createdMsg = 'Đã tạo tài khoản ' + code + '. Hướng dẫn kích hoạt đã được tạo cho số điện thoại đăng nhập ' + U.maskPhone(patch.phone) + '.';
    if (roleId === 'collector') {
      // Không truyền transferMarkets: lưu tài khoản không bao giờ chuyển Chợ. Chỉ có thể vướng khi mở khoá lại NV có
      // Chợ nay đã thuộc NV khác → chặn, để Tổ trưởng phân công lại (không tạo trùng NV thu phí hiện hành).
      const saved = A.ACCOUNTS.saveCollectorAccount(fullRecord);
      if (!saved.ok) {
        if (saved.reason === 'TRANSFER_REQUIRED') U.toast('Chợ ' + saved.conflicts.map(x => U.mShort(x.marketId)).join(', ') + ' đang do NV thu phí khác phụ trách. Tổ trưởng cần phân công lại trước khi mở khóa tài khoản này.');
        else U.toast('Không thể lưu tài khoản Nhân viên thu phí.');
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
      U.log('Thêm tài khoản mới "' + patch.fullName + '" (' + patch.code + ') — chờ kích hoạt qua OTP');
      U.toast(createdMsg);
    }
    if (roleId === 'collector') {
      if (A.currentAccount && A.currentAccount().id === fullRecord.id) A.syncAccountContext();
      U.log((d.id ? 'Cập nhật' : 'Thêm') + ' tài khoản "' + patch.fullName + '" (' + patch.code + ')');
      U.toast(d.id ? 'Đã cập nhật tài khoản ' + patch.code : createdMsg);
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
