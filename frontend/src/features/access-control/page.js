/* Access control UI (Phase 15.9, from js/v-vanhanh.js): role list/CRUD and the per-role permission
 * matrix, shown as the "Vai trò & phân quyền" panel of the cai-dat screen. The RBAC engine itself
 * (catalog, grants, persistence) is shared/authz/permissions.js (A.PERM). */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  // ---------- Vai trò & phân quyền ----------
  // "Số quyền" ở bảng Role (Phase 5B, thay cột "Phạm vi dữ liệu" cũ) — đếm từ permission STATE
  // thực tế của role (A.PERM.rolePermKeys), không phải từ default matrix hard-code, để phản ánh
  // đúng sau khi admin grant/revoke qua "Phân quyền chi tiết".
  function roleGrantCountLabel(roleId) {
    const keys = A.PERM.rolePermKeys(roleId);
    const nScreen = keys.filter(k => k.indexOf('screen:') === 0).length;
    const nAction = keys.filter(k => k.indexOf('action:') === 0).length;
    return `<div class="actor-perm-count"><div><strong>${nScreen}</strong><span>màn hình</span></div><div><strong>${nAction}</strong><span>thao tác</span></div></div>`;
  }
  // Màn này chỉ quản lý danh mục actor chuẩn. Mapping actor → roleId giữ nguyên cơ chế
  // RBAC hiện có; actor không tạo một nguồn assignment permission thứ hai.
  function permissionActors() { return (A.D.ACTORS || []).filter(a => a.roleId && A.PERM.role(a.roleId)); }
  function selectedPermissionActor() {
    const actors = permissionActors();
    const fromActor = actors.find(a => a.id === ui.permActorId);
    // Tương thích state UI cũ chỉ lưu permRole, không ghi hay đổi rolePerms.
    const fromRole = actors.find(a => a.roleId === ui.permRole);
    return fromActor || fromRole || actors[0] || null;
  }
  const DEFAULT_ACTOR_RESPONSIBILITIES = {
    A01: ['Quản lý tài khoản, vai trò và phân quyền', 'Quản lý danh mục 12 chợ', 'Quản lý bảng giá QĐ 480', 'Tra cứu nhật ký'],
    A02: ['Quy hoạch khu/mặt bằng', 'Phân công nhân viên thu phí', 'Khai báo mức thu', 'Mở/chốt kỳ thu tháng', 'Duyệt miễn giảm và nghiệp vụ tiểu thương', 'Giao, theo dõi phản ánh', 'Xem báo cáo'],
    A03: ['Thu phí tháng tại điểm kinh doanh', 'Phát hành biên lai điện tử', 'Nộp tiền mặt tháng', 'Nhắc nộp phí'],
    A04: ['Nhận và xử lý phản ánh được giao', 'Cập nhật tiến độ xử lý', 'Cập nhật kết quả kèm ảnh minh họa'],
    A05: ['Xác nhận phiếu nộp tiền mặt', 'Đối soát số thu kỳ tháng với chứng từ', 'Xem, xuất số liệu thu, công nợ và báo cáo tài chính'],
    A07: ['Đăng ký và quản lý tài khoản cá nhân', 'Xem khoản phải nộp và thanh toán', 'Xem biên lai', 'Gửi, đánh giá phản ánh và nhận thông báo'],
    A08: ['Xem số liệu tổng hợp thu phí, công nợ và phản ánh của 12 chợ', 'Giám sát, không thao tác nghiệp vụ']
  };
  function actorMetadata(actor) {
    const stored = (A.db && Array.isArray(A.db.actorMetadata)) ? A.db.actorMetadata.find(x => x && x.id === actor.id) : null;
    const fallbackLines = String(actor.responsibility || '').split(/[;,]\s*/).filter(Boolean);
    const storedLines = stored && Array.isArray(stored.responsibilities) ? stored.responsibilities.filter(Boolean) : [];
    // Bản metadata mặc định cũ tách theo dấu phẩy. Chỉ thay cách HIỂN THỊ thành nhiệm vụ
    // hoàn chỉnh; metadata do người dùng đã sửa vẫn giữ nguyên từng dòng họ đã nhập.
    const isLegacySplit = storedLines.length && storedLines.join('\n') === fallbackLines.join('\n');
    const lines = isLegacySplit ? (DEFAULT_ACTOR_RESPONSIBILITIES[actor.id] || fallbackLines) : (storedLines.length ? storedLines : (DEFAULT_ACTOR_RESPONSIBILITIES[actor.id] || fallbackLines));
    return { unit: stored && typeof stored.unit === 'string' ? stored.unit : (actor.unit || ''), responsibilities: lines.length ? lines : fallbackLines };
  }
  function actorResponsibilitiesHtml(actor) {
    return `<ul>${actorMetadata(actor).responsibilities.map(line => `<li>${U.esc(line)}</li>`).join('')}</ul>`;
  }
  function slugify(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'vaitro';
  }
  // Phase 5B: tách rõ QUYỀN MÀN HÌNH (kind:'screen', "được vào màn nào") khỏi QUYỀN THAO TÁC
  // (kind:'action', "được làm gì bên trong 1 màn") — trước đây gộp chung 1 danh sách theo group
  // lớn (Điều hành/Tài chính/...) khiến khó phân biệt 2 loại quyền khác bản chất (audit Phase 5A
  // mục 7/8). KHÔNG đổi permKey, KHÔNG đổi CATALOG, chỉ đổi cách render.
  function permsMatrixHtml(role) {
    const granted = new Set(A.PERM.rolePermKeys(role.id));
    const canManage = A.canDo('cai-dat.phan-quyen');
    const state = ui.permEditor || (ui.permEditor = { query: '', openGroups: {} });
    const query = (state.query || '').trim().toLocaleLowerCase('vi');
    const matches = text => !query || String(text || '').toLocaleLowerCase('vi').indexOf(query) !== -1;
    const cb = (p, disabled) => `<label class="small perm-check ${disabled ? 'disabled' : ''}">
        <input type="checkbox" data-ch="perm-toggle" data-role="${role.id}" data-key="${p.key}" ${granted.has(p.key) ? 'checked' : ''} ${canManage && !disabled ? '' : 'disabled'}>
        <span>${U.esc(p.label)}</span></label>`;
    // "Chọn tất cả" chỉ điều khiển action của một màn hình, không thay đổi screen permission.
    const groupAll = (items, screenId, disabled) => {
      const n = items.filter(p => granted.has(p.key)).length, all = n === items.length;
      return `<label class="small perm-group-all"><input type="checkbox" data-ch="perm-group-toggle" data-role="${role.id}" data-screen="${U.esc(screenId)}" data-keys="${items.map(p => p.key).join(',')}" ${all ? 'checked' : ''} ${canManage && !disabled ? '' : 'disabled'}> Chọn tất cả</label>`;
    };
    const grid = items => `<div class="perm-check-grid">${items.map(cb).join('')}</div>`;
    const screens = A.PERM.catalog().filter(p => p.kind === 'screen');
    const actions = A.PERM.catalog().filter(p => p.kind === 'action');
    // Một hierarchy duy nhất: screen permission là parent; action permission là child.
    const visibleGroups = screens.map(screen => {
      const id = screen.key.replace(/^screen:/, ''), allActions = actions.filter(p => p.screenId === id);
      const screenGranted = granted.has(screen.key), screenMatch = matches(screen.label);
      const visibleActions = allActions.filter(p => screenMatch || matches(p.label));
      return { id, screen, allActions, visibleActions, screenGranted, screenMatch };
    }).filter(g => !query || g.screenMatch || g.visibleActions.length);
    return `<div class="perm-hierarchy"><div class="perm-hierarchy-title">Màn hình & thao tác</div>
      ${visibleGroups.length ? visibleGroups.map(g => {
        const n = g.allActions.filter(p => granted.has(p.key)).length;
        const open = !!state.openGroups[g.id] || (!!query && (g.screenMatch || g.visibleActions.length));
        const actionsToShow = query ? g.visibleActions : g.allActions;
        const actionDisabled = !g.screenGranted;
        const expandControl = g.allActions.length ? `<button class="perm-expand-button" data-act="perm-group-open" data-id="${U.esc(g.id)}" aria-expanded="${open}" aria-label="${open ? 'Thu gọn' : 'Mở'} thao tác của ${U.esc(g.screen.label)}"><svg class="perm-expand-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"/></svg></button>` : '<span class="perm-expand-spacer" aria-hidden="true"></span>';
        const screenName = g.allActions.length ? `<button class="perm-screen-name" data-act="perm-group-open" data-id="${U.esc(g.id)}" aria-expanded="${open}">${U.esc(g.screen.label)}</button>` : `<span class="perm-screen-name static">${U.esc(g.screen.label)}</span>`;
        return `<section class="perm-screen-group ${open ? 'open' : ''} ${g.screenGranted ? '' : 'screen-disabled'}">
          <div class="perm-screen-head"><div class="perm-screen-head-left"><label class="perm-screen-access" title="Quyền truy cập màn hình"><input type="checkbox" data-ch="perm-toggle" data-role="${role.id}" data-key="${g.screen.key}" ${g.screenGranted ? 'checked' : ''} ${canManage ? '' : 'disabled'}><span class="sr-only">Quyền truy cập ${U.esc(g.screen.label)}</span></label>${expandControl}${screenName}</div>${g.allActions.length ? `<div class="perm-screen-meta"><span class="muted">${n}/${g.allActions.length} thao tác</span>${groupAll(g.allActions, g.id, actionDisabled)}</div>` : '<span class="perm-screen-no-actions">Không có thao tác riêng</span>'}</div>
          ${open && g.allActions.length ? `<div class="perm-screen-body">${actionDisabled ? '<div class="small muted perm-screen-note">Chưa cấp quyền truy cập màn hình</div>' : ''}${actionsToShow.length ? `<div class="perm-check-grid">${actionsToShow.map(p => cb(p, actionDisabled)).join('')}</div>` : '<div class="small muted">Chưa có thao tác được cấp phù hợp với bộ lọc.</div>'}</div>` : ''}
        </section>`;
      }).join('') : '<div class="small muted">Không tìm thấy màn hình hoặc thao tác phù hợp.</div>'}
    </div>`;
  }
  // Phase 5B: bỏ dropdown "Phạm vi dữ liệu" (all/market/self) + field "Chợ" của Role khỏi form —
  // audit Phase 5A xác nhận field này KHÔNG phải authorization source (Account.marketScopes mới
  // là nguồn enforce chợ), chỉ còn đúng 1 nhánh có tác dụng runtime thật (scope==='self' →
  // selfService, dùng để auto-route Mini app — core.js A.route()/A.ACT['demo-account']). Thay
  // bằng 1 checkbox đúng bản chất, ghi thẳng `selfService`; `scope`/`market` vẫn giữ trong schema
  // (không bump RBAC_SCHEMA) để tương thích ngược, suy ra lại từ selfService khi lưu.
  function renderRoleForm() {
    const d = ui.roleForm;
    A.modal(A.mHead(d.id ? 'Sửa vai trò' : 'Thêm vai trò mới') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Tên vai trò *</label><input class="input" data-ch="rf-name" value="${U.esc(d.name || '')}"></div>
    </div>
    <div class="field" style="margin-top:10px"><label>Mô tả</label><textarea class="input" data-ch="rf-desc" rows="2">${U.esc(d.desc || '')}</textarea></div>
    <label class="small" style="display:flex;align-items:center;gap:6px;margin-top:12px;cursor:pointer"><input type="checkbox" data-ch="rf-self" ${d.selfService ? 'checked' : ''}> Vai trò tự phục vụ</label>
    <div class="note info" style="margin-top:8px">Tài khoản có vai trò tự phục vụ sẽ được điều hướng vào Mini app phù hợp với luồng hiện tại.</div>
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="role-form-save">Lưu</button></div>`);
  }

  function settingsVaitroHtml() {
    const actors = A.D.ACTORS || [];
    const selectedActor = selectedPermissionActor();
    const selRole = selectedActor && A.PERM.role(selectedActor.roleId);
    const actorRows = actors.map(a => {
      const role = a.roleId && A.PERM.role(a.roleId);
      const meta = actorMetadata(a), canEditInfo = A.canDo('cai-dat.vai-tro.sua');
      return `<tr><td class="actor-code"><b>${U.esc(a.id)}</b></td><td><b>${U.esc(a.name)}</b></td><td>${U.esc(meta.unit)}</td><td class="actor-responsibilities">${actorResponsibilitiesHtml(a)}</td><td>${role ? roleGrantCountLabel(role.id) : '<div class="actor-perm-count"><div><strong>0</strong><span>màn hình</span></div><div><strong>0</strong><span>thao tác</span></div></div>'}</td><td class="nowrap">${canEditInfo ? `<button class="btn sm actor-edit-btn" data-act="actor-info-edit" data-id="${a.id}">${U.icon('edit')}Sửa</button>` : ''}</td></tr>`;
    });
    const editor = ui.permEditor || (ui.permEditor = { query: '', openGroups: {} });
    return `<div class="card"><div class="card-h actor-catalog-head"><div><h3>Danh mục vai trò hệ thống</h3><div class="small muted">Các vai trò nghiệp vụ cố định được sử dụng trong hệ thống.</div></div></div><div class="card-b actor-role-table">
      ${U.table([{ t: 'Mã actor' }, { t: 'Actor / Vai trò hệ thống' }, { t: 'Ai đảm nhiệm' }, { t: 'Nhiệm vụ chính' }, { t: 'Quyền hiện tại' }, { t: 'Thao tác' }], actorRows)}</div></div>
    ${selRole ? `<div class="card"><div class="card-h perm-detail-head"><div><h3>Phân quyền chi tiết</h3><div class="small muted">Chọn vai trò để thiết lập quyền truy cập màn hình và thao tác.</div></div></div>
      <div class="card-b perm-detail-body"><div class="perm-toolbar"><label class="perm-role-field"><span>Vai trò</span>
        <select class="input" data-ch="perm-actor-select">${permissionActors().map(a => `<option value="${a.id}" ${a.id === selectedActor.id ? 'selected' : ''}>${U.esc(a.id)} — ${U.esc(a.name)}</option>`).join('')}</select></label>
        <div class="perm-search-field"><label for="perm-search">Tìm kiếm</label><input id="perm-search" class="input" data-in="perm-search" value="${U.esc(editor.query)}" placeholder="Tìm màn hình hoặc thao tác..."></div></div>${permsMatrixHtml(selRole)}</div></div>` : '<div class="card"><div class="card-b"><div class="empty">Không tìm thấy actor có role RBAC để phân quyền.</div></div></div>'}`;
  }

  A.CH['perm-actor-select'] = el => { const actor = permissionActors().find(a => a.id === el.value); if (actor) { ui.permActorId = actor.id; ui.permRole = actor.roleId; } A.render(); };
  A.ACT['actor-perm'] = el => { const actor = permissionActors().find(a => a.id === el.dataset.id); if (!actor) return; ui.permActorId = actor.id; ui.permRole = actor.roleId; A.render(); };
  // Không còn control này trên UI; giữ handler cho test/state UI cũ gửi roleId trực tiếp.
  A.CH['perm-role-select'] = el => { const actor = permissionActors().find(a => a.roleId === el.value); if (actor) ui.permActorId = actor.id; ui.permRole = el.value; A.render(); };
  A.ACT['actor-info-edit'] = el => {
    if (!A.canDo('cai-dat.vai-tro.sua')) return;
    const actor = (A.D.ACTORS || []).find(a => a.id === el.dataset.id);
    if (!actor) return;
    const meta = actorMetadata(actor);
    ui.actorInfoForm = { id: actor.id, unit: meta.unit, responsibilities: meta.responsibilities.join('\n') };
    A.modal(A.mHead('Cập nhật thông tin actor') + `<div class="modal-b"><div class="form-grid"><div class="field"><label>Mã actor</label><input class="input" value="${U.esc(actor.id)}" disabled></div><div class="field"><label>Vai trò hệ thống</label><input class="input" value="${U.esc(actor.name)}" disabled></div></div><div class="field" style="margin-top:12px"><label>Ai đảm nhiệm</label><input class="input" data-ch="actor-info-unit" value="${U.esc(meta.unit)}"></div><div class="field" style="margin-top:12px"><label>Nhiệm vụ chính</label><textarea class="input" data-ch="actor-info-responsibilities" rows="7" placeholder="Mỗi nhiệm vụ một dòng">${U.esc(meta.responsibilities.join('\n'))}</textarea><div class="small muted" style="margin-top:5px">Nhập mỗi nhiệm vụ trên một dòng.</div></div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="actor-info-save">Lưu thay đổi</button></div>`);
  };
  A.CH['actor-info-unit'] = el => { if (ui.actorInfoForm) ui.actorInfoForm.unit = el.value; };
  A.CH['actor-info-responsibilities'] = el => { if (ui.actorInfoForm) ui.actorInfoForm.responsibilities = el.value; };
  A.ACT['actor-info-save'] = () => {
    if (!A.canDo('cai-dat.vai-tro.sua') || !ui.actorInfoForm) return;
    const form = ui.actorInfoForm, actor = (A.D.ACTORS || []).find(a => a.id === form.id);
    if (!actor || !A.db) return;
    const lines = String(form.responsibilities || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (!form.unit || !form.unit.trim()) { U.toast('Vui lòng nhập thông tin đơn vị đảm nhiệm.'); return; }
    if (!lines.length) { U.toast('Vui lòng nhập ít nhất một nhiệm vụ chính.'); return; }
    if (!Array.isArray(A.db.actorMetadata)) A.db.actorMetadata = [];
    let meta = A.db.actorMetadata.find(x => x && x.id === actor.id);
    if (!meta) { meta = { id: actor.id }; A.db.actorMetadata.push(meta); }
    meta.unit = form.unit.trim(); meta.responsibilities = lines; meta.updatedAt = new Date().toISOString();
    A.save(); U.log('Cập nhật metadata actor "' + actor.id + '"'); ui.actorInfoForm = null; A.closeModal(); A.render(); U.toast('Đã cập nhật thông tin actor.');
  };
  A.IN['perm-search'] = el => { (ui.permEditor || (ui.permEditor = { openGroups: {} })).query = el.value; A.render(); };
  A.ACT['perm-group-open'] = el => { const s = ui.permEditor || (ui.permEditor = { openGroups: {} }); s.openGroups = s.openGroups || {}; s.openGroups[el.dataset.id] = !s.openGroups[el.dataset.id]; A.render(); };
  A.CH['perm-toggle'] = el => {
    if (!A.canDo('cai-dat.phan-quyen')) { A.render(); return; }
    // RBAC_MARKET_SCOPE_MIGRATION: 'lanhdao' là role id pre-V1 đã bỏ từ lâu, điều kiện này chưa bao
    // giờ đúng với bất kỳ role id V1/V2 nào (luôn rơi vào nhánh else) — sửa dùng thẳng tên account
    // demo đang thao tác thay vì tên cứng, đúng bản chất nhật ký kiểm toán.
    const currentAcc = A.currentAccount();
    const actor = currentAcc ? currentAcc.fullName : 'Không rõ';
    const role = A.PERM.role(el.dataset.role), perm = A.PERM.permission(el.dataset.key);
    // Action chỉ có thể được cấu hình khi screen parent đã được cấp. Thu hồi screen
    // không gọi revoke action nào, vì vậy assignment action đang có vẫn được giữ nguyên.
    if (perm && perm.kind === 'action' && !A.PERM.hasPerm(el.dataset.role, 'screen:' + perm.screenId)) { A.render(); return; }
    const roleName = role ? role.name : el.dataset.role, permLabel = perm ? perm.label : el.dataset.key;
    // Quyền đã retire (ẩn khỏi ma trận) không được cấp mới, kể cả khi handler bị gọi trực tiếp.
    if (el.checked && A.PERM.isRetiredPermission && A.PERM.isRetiredPermission(el.dataset.key)) { A.render(); return; }
    if (el.checked) {
      A.PERM.grant(el.dataset.role, el.dataset.key, actor);
      U.log('Cấp quyền "' + permLabel + '" cho vai trò "' + roleName + '"');
    } else {
      A.PERM.revoke(el.dataset.role, el.dataset.key);
      U.log('Thu hồi quyền "' + permLabel + '" của vai trò "' + roleName + '"');
    }
    A.render();
  };
  A.CH['perm-group-toggle'] = el => {
    if (!A.canDo('cai-dat.phan-quyen')) { A.render(); return; }
    const role = A.PERM.role(el.dataset.role);
    if (!role) return;
    const catalog = new Set(A.PERM.catalog().map(p => p.key));
    const keys = String(el.dataset.keys || '').split(',').filter(k => catalog.has(k));
    const firstAction = keys.length ? A.PERM.permission(keys[0]) : null;
    const screenId = el.dataset.screen || (firstAction && firstAction.screenId);
    if (!screenId || !A.PERM.hasPerm(role.id, 'screen:' + screenId)) { A.render(); return; }
    const granted = new Set(A.PERM.rolePermKeys(role.id));
    const currentAcc = A.currentAccount(), actor = currentAcc ? currentAcc.fullName : 'Không rõ';
    const changed = keys.filter(k => el.checked ? !granted.has(k) : granted.has(k));
    changed.forEach(k => { if (el.checked) A.PERM.grant(role.id, k, actor); else A.PERM.revoke(role.id, k); });
    if (changed.length) U.log((el.checked ? 'Cấp ' : 'Thu hồi ') + changed.length + ' quyền thao tác (' + changed.map(k => { const p = A.PERM.permission(k); return p ? p.label : k; }).join(', ') + ') ' + (el.checked ? 'cho' : 'của') + ' vai trò "' + role.name + '"');
    A.render();
  };
  A.ACT['role-new'] = () => { if (!A.canDo('cai-dat.vai-tro.tao')) return; ui.roleForm = { id: null, name: '', desc: '', selfService: false }; renderRoleForm(); };
  A.ACT['role-edit'] = el => {
    if (!A.canDo('cai-dat.vai-tro.sua')) return;
    const r = A.PERM.role(el.dataset.id);
    if (!r) return;
    ui.roleForm = { id: r.id, name: r.name, desc: r.desc, selfService: !!r.selfService };
    renderRoleForm();
  };
  A.CH['rf-name'] = el => { ui.roleForm.name = el.value; };
  A.CH['rf-desc'] = el => { ui.roleForm.desc = el.value; };
  A.CH['rf-self'] = el => { ui.roleForm.selfService = el.checked; };
  A.ACT['role-form-save'] = () => {
    const d = ui.roleForm;
    if (!A.canDo(d.id ? 'cai-dat.vai-tro.sua' : 'cai-dat.vai-tro.tao')) return;
    if (!d.name || !d.name.trim()) { U.toast('Vui lòng nhập tên vai trò'); return; }
    // Role.scope/Role.market KHÔNG còn field nào trong form ghi trực tiếp (Phase 5B) — suy ra lại
    // từ selfService để tương thích ngược với các chỗ đọc field này (không bump RBAC_SCHEMA vì
    // đây không phải đổi shape dữ liệu, chỉ đổi UI/nguồn ghi — xem PHASE5A_ACCOUNT_ROLE_SCOPE_AUDIT.md
    // mục 9.4/10). Không còn nhánh scope==='market': field Role.market không có tác dụng
    // authorization runtime nào (đã xác nhận ở audit), luôn ghi null từ đây trở đi.
    const patch = { name: d.name.trim(), desc: (d.desc || '').trim(), scope: d.selfService ? 'self' : 'all', market: null, selfService: !!d.selfService };
    if (d.id) {
      A.PERM.updateRole(d.id, patch);
      U.log('Cập nhật thông tin vai trò "' + patch.name + '"');
      U.toast('Đã cập nhật vai trò "' + patch.name + '"');
    } else {
      let id = slugify(d.name), n = 1;
      while (A.PERM.role(id)) { id = slugify(d.name) + '-' + (++n); }
      A.PERM.addRole(Object.assign({ id: id, builtin: false, active: true }, patch));
      ui.permRole = id;
      U.log('Thêm vai trò mới "' + patch.name + '"');
      U.toast('Đã thêm vai trò "' + patch.name + '"');
    }
    ui.roleForm = null;
    A.closeModal(); A.render();
  };
  A.ACT['role-toggle'] = el => {
    if (!A.canDo('cai-dat.vai-tro.khoa')) return;
    const r = A.PERM.role(el.dataset.id);
    if (!r) return;
    if (r.active && r.id === ui.role) { U.toast('Không thể vô hiệu hoá vai trò đang được sử dụng. Hãy chuyển sang vai trò khác trước.'); return; }
    const wasActive = r.active;
    A.PERM.setRoleActive(r.id, !wasActive);
    U.log((wasActive ? 'Vô hiệu hoá' : 'Kích hoạt lại') + ' vai trò "' + r.name + '"');
    A.render();
    U.toast(wasActive ? 'Đã vô hiệu hoá vai trò "' + r.name + '"' : 'Đã kích hoạt lại vai trò "' + r.name + '"');
  };
  A.ACT['role-perm'] = el => { ui.permRole = el.dataset.id; A.render(); };
  A.ACT['role-del'] = el => {
    if (!A.canDo('cai-dat.vai-tro.xoa')) return;
    const r = A.PERM.role(el.dataset.id);
    if (!r) return;
    if (r.builtin) { U.toast('Không thể xoá vai trò gốc của hệ thống.'); return; }
    if (r.id === ui.role) { U.toast('Không thể xoá vai trò đang được sử dụng. Hãy chuyển sang vai trò khác trước.'); return; }
    A.modal(A.mHead('Xoá vai trò') + `<div class="modal-b">Xoá vai trò <b>${U.esc(r.name)}</b> và toàn bộ quyền đã gán cho vai trò này? Thao tác này không thể hoàn tác.</div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="role-del-ok" data-id="${r.id}">Xoá vai trò</button></div>`);
  };
  A.ACT['role-del-ok'] = el => {
    if (!A.canDo('cai-dat.vai-tro.xoa')) return;
    const r = A.PERM.role(el.dataset.id);
    if (!r || r.builtin || r.id === ui.role) { A.closeModal(); A.render(); return; }
    const name = r.name;
    A.PERM.removeRole(el.dataset.id);
    if (ui.permRole === el.dataset.id) ui.permRole = 'market_manager'; // RBAC V1: 'bql' cũ đã bị thay bằng 8 role mới
    U.log('Xoá vai trò "' + name + '"');
    A.closeModal(); A.render(); U.toast('Đã xoá vai trò "' + name + '"');
  };
  // Panel hosted by the settings screen (cai-dat).
  const accessControl = A.features.accessControl || (A.features.accessControl = {});
  accessControl.settingsVaitroHtml = settingsVaitroHtml;

  if (!ui.permRole) ui.permRole = 'market_manager'; // RBAC V1: 'bql' cũ đã bị thay bằng 8 role mới
})(window.APP);
