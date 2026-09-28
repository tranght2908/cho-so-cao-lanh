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
    return nScreen + ' màn hình · ' + nAction + ' thao tác';
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
    const cb = p => `<label class="small" style="display:flex;gap:6px;align-items:center;padding:3px 0">
        <input type="checkbox" data-ch="perm-toggle" data-role="${role.id}" data-key="${p.key}" ${granted.has(p.key) ? 'checked' : ''} ${canManage ? '' : 'disabled'}>
        ${U.esc(p.label)}</label>`;
    // "Chọn tất cả" theo từng nhóm màn hình: cấp/thu hồi đúng các quyền thao tác của nhóm đó, qua
    // cùng A.PERM.grant/revoke như ô từng quyền (không tạo cơ chế phân quyền thứ hai).
    const groupAll = items => {
      const n = items.filter(p => granted.has(p.key)).length, all = n === items.length;
      return `<label class="small perm-group-all"><input type="checkbox" data-ch="perm-group-toggle" data-role="${role.id}" data-keys="${items.map(p => p.key).join(',')}" ${all ? 'checked' : ''} ${canManage ? '' : 'disabled'}> Chọn tất cả <span class="muted">(${n}/${items.length})</span></label>`;
    };
    const grid = items => `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:4px 14px">${items.map(cb).join('')}</div>`;
    const screens = A.PERM.catalog().filter(p => p.kind === 'screen');
    const actions = A.PERM.catalog().filter(p => p.kind === 'action');
    // Nhóm action theo TỪNG MÀN (A.menuItem(p.screenId).label) — nếu screenId thiếu/không hợp lệ,
    // fallback về p.group thay vì crash renderer (yêu cầu Phase 5B mục 14).
    const actionGroups = [];
    actions.forEach(p => {
      const item = p.screenId && A.menuItem(p.screenId);
      const gname = item ? item.label : p.group;
      let g = actionGroups.find(x => x.name === gname);
      if (!g) { g = { name: gname, items: [] }; actionGroups.push(g); }
      g.items.push(p);
    });
    return `<div style="margin-bottom:20px">
        <div class="small" style="font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Quyền màn hình</div>
        ${grid(screens)}
      </div>
      <div class="divider" style="margin:0 0 16px"></div>
      <div>
        <div class="small" style="font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Quyền thao tác</div>
        ${actionGroups.map(g => `<div style="margin-bottom:14px"><div class="row perm-group-head"><div class="small" style="font-weight:600">${U.esc(g.name)}</div>${groupAll(g.items)}</div>${grid(g.items)}</div>`).join('')}
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
    const selRole = A.PERM.role(ui.permRole) || A.PERM.role('market_manager') || A.PERM.roles()[0];
    const canNew = A.canDo('cai-dat.vai-tro.tao'), canEdit = A.canDo('cai-dat.vai-tro.sua'),
      canToggleRole = A.canDo('cai-dat.vai-tro.khoa'), canDelRole = A.canDo('cai-dat.vai-tro.xoa');
    return `<div class="card"><div class="card-h"><h3>Vai trò và phân quyền</h3><span class="small muted">Nguyên tắc tối thiểu quyền hạn</span>${canNew ? '<button class="btn sm primary" data-act="role-new">+ Thêm vai trò</button>' : ''}</div><div class="card-b">
      ${U.table([{ t: 'Vai trò' }, { t: 'Mô tả' }, { t: 'Số quyền' }, { t: 'Trạng thái' }, { t: '' }], A.PERM.roles().map(r => `<tr>
        <td><b>${U.esc(r.name)}</b>${r.builtin ? ' <span class="tag info">Gốc</span>' : ''}${r.id === ui.role ? ' <span class="tag ok">Đang chọn</span>' : ''}</td>
        <td class="small">${U.esc(r.desc || '')}</td>
        <td class="small">${roleGrantCountLabel(r.id)}</td>
        <td>${r.active ? '<span class="tag ok">Đang dùng</span>' : '<span class="tag">Đã vô hiệu hoá</span>'}</td>
        <td class="nowrap">
          <button class="btn sm ${ui.permRole === r.id ? 'primary' : ''}" data-act="role-perm" data-id="${r.id}">Phân quyền</button>
          ${canEdit ? `<button class="btn sm" data-act="role-edit" data-id="${r.id}">Sửa</button>` : ''}
          ${canToggleRole ? `<button class="btn sm ${r.active ? 'danger' : ''}" data-act="role-toggle" data-id="${r.id}">${r.active ? 'Vô hiệu hoá' : 'Kích hoạt'}</button>` : ''}
          ${!r.builtin && canDelRole ? `<button class="btn sm danger" data-act="role-del" data-id="${r.id}">Xoá</button>` : ''}
        </td></tr>`))}</div></div>
    <div class="card"><div class="card-h"><h3>Phân quyền chi tiết — ${U.esc(selRole.name)}</h3>
      <select class="input" data-ch="perm-role-select">${A.PERM.roles().map(r => `<option value="${r.id}" ${r.id === selRole.id ? 'selected' : ''}>${U.esc(r.name)}</option>`).join('')}</select></div>
      <div class="card-b">${permsMatrixHtml(selRole)}</div></div>`;
  }

  A.CH['perm-role-select'] = el => { ui.permRole = el.value; A.render(); };
  A.CH['perm-toggle'] = el => {
    if (!A.canDo('cai-dat.phan-quyen')) { A.render(); return; }
    // RBAC_MARKET_SCOPE_MIGRATION: 'lanhdao' là role id pre-V1 đã bỏ từ lâu, điều kiện này chưa bao
    // giờ đúng với bất kỳ role id V1/V2 nào (luôn rơi vào nhánh else) — sửa dùng thẳng tên account
    // demo đang thao tác thay vì tên cứng, đúng bản chất nhật ký kiểm toán.
    const currentAcc = A.currentAccount();
    const actor = currentAcc ? currentAcc.fullName : 'Không rõ';
    const role = A.PERM.role(el.dataset.role), perm = A.PERM.permission(el.dataset.key);
    const roleName = role ? role.name : el.dataset.role, permLabel = perm ? perm.label : el.dataset.key;
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
