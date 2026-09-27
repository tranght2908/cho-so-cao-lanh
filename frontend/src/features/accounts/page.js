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
  // RBAC_MARKET_SCOPE_MIGRATION mục 21: không liệt kê hết tên chợ nếu account có nhiều chợ (table
  // sẽ quá cao với market master 12 chợ) — chỉ hiện chợ đầu + "+N chợ", đầy đủ danh sách xem ở
  // drawer chi tiết account (accDrawerHtml bên dưới vẫn gọi hàm này, nên khi cần liệt kê đủ, sửa ở
  // đây 1 chỗ là đủ — hiện tại drawer cũng chỉ cần tóm tắt, không có yêu cầu liệt kê đầy đủ riêng).
  function accScopeLabel(scopes) {
    if (!scopes || !scopes.length) return '—';
    if (scopes.includes('ALL')) return 'Toàn bộ ' + D.MARKETS.length + ' chợ';
    if (scopes.length === 1) return U.mShort(scopes[0]);
    return U.mShort(scopes[0]) + ' +' + (scopes.length - 1) + ' chợ';
  }
  function accRoleBadges(roleIds) {
    return (roleIds || []).map(rid => { const r = A.PERM.role(rid); return `<span class="tag info">${U.esc(r ? r.name : rid)}</span>`; }).join(' ') || '<span class="muted small">Chưa gán</span>';
  }
  function accRows() {
    const f = ui.acc, q = (f.search || '').toLowerCase();
    // TRADER_PROFILE_AND_MINIAPP_WORKFLOW (mục 31 yêu cầu — "S"): bảng MẶC ĐỊNH chỉ hiển thị account
    // nội bộ (system_admin/ward_leader/market_manager/collector/technician), KHÔNG hiển thị account
    // role 'trader' — account đó được quản lý về nghiệp vụ từ màn Hồ sơ tiểu thương → Tài khoản Mini
    // App (xem js/v-tieuthuong.js, Section E). Chỉ ẨN mặc định (presentation filter, KHÔNG xoá
    // account/role) — nếu admin CHỦ ĐỘNG lọc đúng "Tiểu thương" ở ô "Loại tài khoản" thì vẫn xem được
    // (tra cứu khi cần), không khoá cứng.
    const hideTraders = f.type !== 'Tiểu thương';
    // Lọc theo A.allowedMarkets() (không phải marketScopes thô) — chỉ có vậy mới lọc đúng cho cả
    // account GLOBAL ['ALL'] LẪN account MARKET scoped tới bất kỳ (các) chợ nào trong 12 chợ.
    return A.ACCOUNTS.list().filter(a =>
      (!hideTraders || a.accountType !== 'Tiểu thương') &&
      (!f.type || a.accountType === f.type) &&
      (!f.role || (a.roleIds || []).includes(f.role)) &&
      (!f.market || A.allowedMarkets(a).includes(f.market)) &&
      (!f.status || A.ACCOUNTS.authStatus(a) === f.status) &&
      (!q || a.fullName.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) || (a.phone || '').includes(q)));
  }
  function accStats() {
    const all = A.ACCOUNTS.list();
    return {
      total: all.length, active: all.filter(a => A.ACCOUNTS.authStatus(a) === 'ACTIVE').length,
      pending: all.filter(a => A.ACCOUNTS.authStatus(a) === 'PENDING_ACTIVATION').length,
      disabled: all.filter(a => A.ACCOUNTS.authStatus(a) === 'LOCKED').length,
      traders: all.filter(a => a.accountType === 'Tiểu thương').length
    };
  }
  function accStatusTag(a) {
    const status = A.ACCOUNTS.authStatus(a);
    return status === 'ACTIVE' ? '<span class="tag ok">Đang hoạt động</span>' : status === 'PENDING_ACTIVATION' ? '<span class="tag">Chờ kích hoạt</span>' : '<span class="tag danger">Đã khóa</span>';
  }
  function accDrawerHtml(a) {
    const canEdit = A.canDo('tai-khoan.sua');
    return `<div class="drawer-h"><span class="avatar lg">${U.esc(accInitials(a.fullName))}</span>
        <div><h3>${U.esc(a.fullName)}</h3><div class="small muted">${U.esc(a.code)} · ${accStatusTag(a)}</div></div>
        <span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <dl class="kv">
          <dt>Họ tên</dt><dd>${U.esc(a.fullName)}</dd>
          <dt>Số điện thoại</dt><dd>${a.phone ? U.esc(a.phone) : '<span class="muted">Chưa có</span>'}</dd>
          <dt>Loại tài khoản</dt><dd>${U.esc(a.accountType)}</dd>
          ${a.title ? `<dt>Chức danh</dt><dd>${U.esc(a.title)}</dd>` : ''}
          <dt>Đơn vị</dt><dd>${U.esc(a.organization || '')}</dd>
          <dt>Chợ</dt><dd>${accScopeLabel(a.marketScopes)}</dd>
        </dl>
        <div class="divider"></div>
        <b class="small">Phân quyền</b>
        <dl class="kv" style="margin-top:8px">
          <dt>Vai trò</dt><dd>${accRoleBadges(a.roleIds)}</dd>
          <dt>Phạm vi</dt><dd>${accScopeLabel(a.marketScopes)}</dd>
        </dl>
      </div>
      <div class="drawer-f">${canEdit ? `<button class="btn primary" data-act="acc-edit" data-id="${a.id}">Chỉnh sửa</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
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
    if (roleId === 'system_admin' || roleId === 'ward_leader') {
      const label = roleId === 'system_admin' ? 'Toàn hệ thống' : 'Toàn bộ ' + D.MARKETS.length + ' chợ';
      return `<div class="field" style="margin-top:12px"><label>Phạm vi</label><div class="note info">${U.esc(label)} — vai trò này không cần chọn từng chợ.</div></div>`;
    }
    if (roleId === 'trader') {
      return `<div class="field" style="margin-top:12px"><label>Phạm vi</label><div class="note">Tài khoản Tiểu thương được quản lý qua <b>Tiểu thương → Hồ sơ tiểu thương → Tài khoản Mini App</b>, không gán phạm vi chợ trực tiếp ở đây.</div></div>`;
    }
    // Legacy ['ALL'] (account cũ) diễn giải qua đúng A.allowedMarkets() hiện có — không tự viết lại
    // logic 'ALL' ở đây — để checkbox hiển thị đã tick sẵn đúng các chợ; account KHÔNG bị ghi lại
    // cho tới khi admin thật sự bấm Lưu.
    const dm = A.allowedMarkets({ marketScopes: d.marketScopes || [] });
    return `<div class="field" style="margin-top:12px"><label>Phạm vi chợ được phân công</label>
      <div class="row" style="gap:14px;flex-wrap:wrap;margin-top:4px">${D.MARKETS.map(m => `<label class="small" style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-ch="af-scope" data-market="${m.id}" ${dm.includes(m.id) ? 'checked' : ''} ${dis}> ${U.esc(m.short)}</label>`).join('')}</div></div>`;
  }
  function renderAccForm() {
    const d = ui.accForm, isNew = !d.id;
    const canAssign = isNew || A.canDo('tai-khoan.gan-quyen');
    const dis = canAssign ? '' : 'disabled';
    A.modal(A.mHead(isNew ? 'Thêm tài khoản mới' : 'Sửa tài khoản') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Mã tài khoản *</label><input class="input" data-ch="af-code" value="${U.esc(d.code || '')}" ${isNew ? '' : 'disabled'}></div>
      <div class="field"><label>Họ tên *</label><input class="input" data-ch="af-name" value="${U.esc(d.fullName || '')}"></div>
      <div class="field"><label>Số điện thoại</label><input class="input" data-ch="af-phone" value="${U.esc(d.phone || '')}"></div>
      <div class="field"><label>Loại tài khoản</label><select class="input" data-ch="af-type">${A.ACCOUNTS.ACCOUNT_TYPES.map(t => `<option ${d.accountType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Vai trò (Role)</label><select class="input" data-ch="af-role" ${dis}><option value="">— Chưa gán —</option>${A.PERM.roles().map(r => `<option value="${r.id}" ${(d.roleIds && d.roleIds[0]) === r.id ? 'selected' : ''}>${U.esc(r.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Đơn vị</label><input class="input" data-ch="af-org" value="${U.esc(d.organization || '')}"></div>
      <div class="field"><label>Trạng thái</label><select class="input" data-ch="af-status"><option value="ACTIVE" ${A.ACCOUNTS.authStatus(d) === 'ACTIVE' ? 'selected' : ''}>Đang hoạt động</option><option value="LOCKED" ${A.ACCOUNTS.authStatus(d) === 'LOCKED' ? 'selected' : ''}>Đã khóa</option></select></div>
    </div>
    ${afScopeSectionHtml(d, dis)}
    ${!canAssign ? '<div class="note" style="margin-top:12px">Bạn không có quyền gán vai trò / phạm vi chợ nên các trường này đang bị khoá.</div>' : ''}
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="acc-form-save">Lưu</button></div>`);
  }

  const accountsView = function () {
    const canCreate = A.canDo('tai-khoan.tao-moi');
    const canEdit = A.canDo('tai-khoan.sua');
    const canToggle = A.canDo('tai-khoan.khoa-mo-khoa');
    const rows = accRows(), st = accStats(), f = ui.acc;
    const pg = U.pager('acc', rows.length, 15);
    const k = (l, v) => `<div class="card kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div></div>`;
    return `
    <div class="card"><div class="card-b row" style="padding-top:14px">
      <div><h3 style="margin:0;font-size:var(--font-size-md)">Tài khoản người dùng</h3><div class="small muted">Quản lý và tra cứu các tài khoản được phép sử dụng hệ thống.</div></div>
      <span class="spacer"></span>
      ${canCreate ? '<button class="btn primary" data-act="acc-new">+ Thêm tài khoản</button>' : ''}</div></div>
    <div class="kpis">
      ${k('Tổng tài khoản', st.total)}
      ${k('Đang hoạt động', st.active)}
      ${k('Chờ kích hoạt', st.pending)}
      ${k('Tạm khoá', st.disabled)}
      ${k('Tiểu thương', st.traders)}
    </div>
    <div class="card"><div class="card-b row" style="padding-top:14px;flex-wrap:wrap">
      <input class="input" style="min-width:220px;flex:1" placeholder="Tìm theo họ tên, mã, số điện thoại..." data-in="acc-search" value="${U.esc(f.search || '')}">
      <select class="input" data-ch="acc-type"><option value="">Loại tài khoản: Tất cả</option>${A.ACCOUNTS.ACCOUNT_TYPES.map(t => `<option ${f.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <select class="input" data-ch="acc-role"><option value="">Vai trò: Tất cả</option>${A.PERM.roles().map(r => `<option value="${r.id}" ${f.role === r.id ? 'selected' : ''}>${U.esc(r.name)}</option>`).join('')}</select>
      <select class="input" data-ch="acc-market"><option value="">Chợ / phạm vi: Tất cả</option>${D.MARKETS.map(m => `<option value="${m.id}" ${f.market === m.id ? 'selected' : ''}>${m.short}</option>`).join('')}</select>
      <select class="input" data-ch="acc-status"><option value="">Trạng thái: Tất cả</option><option value="ACTIVE" ${f.status === 'ACTIVE' ? 'selected' : ''}>Đang hoạt động</option><option value="PENDING_ACTIVATION" ${f.status === 'PENDING_ACTIVATION' ? 'selected' : ''}>Chờ kích hoạt</option><option value="LOCKED" ${f.status === 'LOCKED' ? 'selected' : ''}>Đã khóa</option></select>
      <button class="btn" data-act="acc-clear">Đặt lại</button></div></div>
    <div class="card"><div class="card-b">
      ${U.table([{ t: 'Mã' }, { t: 'Người dùng' }, { t: 'Loại tài khoản' }, { t: 'Vai trò' }, { t: 'Đơn vị / Chợ' }, { t: 'Trạng thái' }, { t: '' }],
        rows.slice(pg.start, pg.end).map(a => `<tr class="click" data-act="acc-open" data-id="${a.id}">
          <td>${U.esc(a.code)}</td>
          <td><div class="row" style="gap:8px;flex-wrap:nowrap"><span class="avatar">${U.esc(accInitials(a.fullName))}</span><div><b>${U.esc(a.fullName)}</b>${a.phone ? `<div class="small muted">${U.esc(a.phone)}</div>` : ''}</div></div></td>
          <td class="small">${U.esc(a.accountType)}</td>
          <td>${accRoleBadges(a.roleIds)}</td>
          <td class="small">${U.esc(a.organization || '')}<div class="muted">${accScopeLabel(a.marketScopes)}</div></td>
          <td>${accStatusTag(a)}</td>
          <td class="nowrap">
            ${canEdit ? `<button class="btn sm" data-act="acc-edit" data-id="${a.id}">Sửa</button>` : ''}
            ${canToggle ? `<button class="btn sm ${A.ACCOUNTS.authStatus(a) === 'ACTIVE' ? 'danger' : ''}" data-act="acc-toggle" data-id="${a.id}">${A.ACCOUNTS.authStatus(a) === 'ACTIVE' ? 'Khoá' : 'Mở khoá'}</button>` : ''}
          </td></tr>`), { empty: 'Không tìm thấy tài khoản phù hợp' })}${pg.html}</div></div>`;
  };
  A.IN['acc-search'] = el => { ui.acc.search = el.value; ui.page.acc = 0; A.render(); };
  A.CH['acc-type'] = el => { ui.acc.type = el.value; ui.page.acc = 0; A.render(); };
  A.CH['acc-role'] = el => { ui.acc.role = el.value; ui.page.acc = 0; A.render(); };
  A.CH['acc-market'] = el => { ui.acc.market = el.value; ui.page.acc = 0; A.render(); };
  A.CH['acc-status'] = el => { ui.acc.status = el.value; ui.page.acc = 0; A.render(); };
  A.ACT['acc-clear'] = () => { ui.acc = { search: '', type: '', role: '', market: '', status: '' }; ui.page.acc = 0; A.render(); };
  A.ACT['acc-open'] = el => {
    const a = A.ACCOUNTS.get(el.dataset.id);
    if (!a) return;
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${accDrawerHtml(a)}</div>`;
  };
  A.ACT['acc-new'] = () => {
    if (!A.canDo('tai-khoan.tao-moi')) return;
    // Chưa chọn vai trò → chưa biết chợ nào phù hợp, để trống thay vì mặc định cứng — admin chọn
    // vai trò trước (A.CH['af-role'] tự hiện đúng dạng Phạm vi), rồi mới tick chợ. "Loại tài khoản"
    // mặc định ACCOUNT_TYPES[3] = tên role 'collector' (thứ tự cố định theo defaultRoles(),
    // js/permissions.js) — vai trò vận hành phổ biến nhất, tránh mặc định thiên về quyền cao.
    ui.accForm = { id: null, code: '', fullName: '', phone: '', accountType: A.ACCOUNTS.ACCOUNT_TYPES[3], roleIds: [], organization: '', marketScopes: [], status: 'ACTIVE' };
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
    ui.accForm = { id: a.id, code: a.code, fullName: a.fullName, phone: a.phone, accountType: a.accountType, roleIds: (a.roleIds || []).slice(), organization: a.organization, marketScopes: A.allowedMarkets(a), status: a.status };
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
    ui.accForm.marketScopes = D.MARKETS.map(m => m.id).filter(m => cur.has(m));
  }
  A.CH['af-scope'] = el => { afSetScope(el.dataset.market, el.checked); };
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
      if (roleId === 'system_admin' || roleId === 'ward_leader') marketScopes = ['ALL'];
      else if (roleId === 'trader') marketScopes = existing ? existing.marketScopes : (d.marketScopes || []);
      else if (!marketScopes.length) { U.toast('Vui lòng chọn ít nhất một chợ được phân công.'); return; }
    }
    const patch = { code: d.code.trim(), fullName: d.fullName.trim(), phone: (d.phone || '').trim(), accountType: d.accountType, roleIds: canAssign ? d.roleIds : (existing ? existing.roleIds : []), organization: (d.organization || '').trim(), marketScopes, status: d.status };
    if (d.id) {
      A.ACCOUNTS.update(d.id, patch);
      U.log('Cập nhật tài khoản "' + patch.fullName + '" (' + patch.code + ')');
      U.toast('Đã cập nhật tài khoản ' + patch.code);
    } else {
      A.ACCOUNTS.add(Object.assign({ id: 'AC-' + patch.code.trim().toUpperCase() }, patch));
      U.log('Thêm tài khoản mới "' + patch.fullName + '" (' + patch.code + ')');
      U.toast('Đã thêm tài khoản ' + patch.code);
    }
    ui.accForm = null;
    A.closeModal(); A.render();
  };
  A.ACT['acc-toggle'] = el => {
    if (!A.canDo('tai-khoan.khoa-mo-khoa')) return;
    const a = A.ACCOUNTS.get(el.dataset.id);
    if (!a) return;
    const wasActive = A.ACCOUNTS.authStatus(a) === 'ACTIVE';
    A.ACCOUNTS.setStatus(a.id, wasActive ? 'LOCKED' : 'ACTIVE');
    U.log((wasActive ? 'Tạm khoá' : 'Mở khoá') + ' tài khoản "' + a.fullName + '" (' + a.code + ')');
    A.render();
    U.toast(wasActive ? 'Đã tạm khoá tài khoản ' + a.code : 'Đã mở khoá tài khoản ' + a.code);
  };
  A.VIEWS['tai-khoan'] = function () { return A.features.accounts.traderAccountTaskHtml() + accountsView(); };

  if (!ui.acc) ui.acc = { search: '', type: '', role: '', market: '', status: '' };
})(window.APP);
