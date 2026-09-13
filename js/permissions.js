/* GIAI ĐOẠN 1 — Model phân quyền động: Role, Permission, RolePermission, Scope.
 *
 * File này CHỈ định nghĩa dữ liệu & hàm truy vấn (A.PERM.*). Nó KHÔNG được gọi ở đâu khác
 * trong ứng dụng — A.MENU, U.can(), ui.role và mọi view nghiệp vụ (js/v-*.js) vẫn hoạt động
 * y hệt như trước. Việc nối model này vào A.MENU/U.can() thuộc Giai đoạn 2; xây màn hình
 * "Vai trò & phân quyền" thuộc Giai đoạn 3; thay các điều kiện ui.role === 'bql' rải rác
 * trong từng v-*.js bằng A.PERM.canAction(...) thuộc Giai đoạn 5.
 *
 * Seed mặc định bên dưới được suy ra 1-1 từ hành vi cứng hiện tại:
 *   - screenRoles  ⇔ field "roles" của từng mục trong A.MENU (js/core.js)
 *   - actionRoles  ⇔ các điều kiện "ui.role === 'bql'" / "!bql" đang rải rác trong js/v-*.js
 * để khi nối vào (Giai đoạn 2+), hành vi demo không đổi.
 */
(function (A) {
  'use strict';
  const PKEY = 'choso-caolanh-permissions';

  // ============================================================
  // 1) PERMISSION — danh mục quyền (catalog). Tương đối tĩnh: chỉ
  //    thêm dòng mới khi có thêm màn hình/hành động mới trong app.
  //    kind: 'screen' = được vào 1 màn trong menu
  //          'action' = được làm 1 thao tác cụ thể bên trong 1 màn
  // ============================================================
  const CATALOG = [
    { key: 'screen:tong-quan', kind: 'screen', group: 'Điều hành', label: 'Tổng quan liên chợ' },
    { key: 'screen:cau-truc', kind: 'screen', group: 'Điều hành', label: 'Thiết lập mặt bằng chợ' },
    { key: 'screen:so-do', kind: 'screen', group: 'Điều hành', label: 'Sơ đồ mặt bằng' },
    { key: 'screen:phien-cho', kind: 'screen', group: 'Điều hành', label: 'Phiên chợ quê' },
    { key: 'screen:diem-kd', kind: 'screen', group: 'Tiểu thương & hợp đồng', label: 'Điểm kinh doanh' },
    { key: 'screen:tieu-thuong', kind: 'screen', group: 'Tiểu thương & hợp đồng', label: 'Tiểu thương' },
    { key: 'screen:hop-dong', kind: 'screen', group: 'Tiểu thương & hợp đồng', label: 'Hợp đồng' },
    { key: 'screen:dien-nuoc', kind: 'screen', group: 'Tài chính', label: 'Chỉ số điện, nước' },
    { key: 'screen:phai-thu', kind: 'screen', group: 'Tài chính', label: 'Khoản phải thu' },
    { key: 'screen:thu-tien', kind: 'screen', group: 'Tài chính', label: 'Thu tiền & biên lai' },
    { key: 'screen:doi-soat', kind: 'screen', group: 'Tài chính', label: 'Đối soát' },
    { key: 'screen:cong-no', kind: 'screen', group: 'Tài chính', label: 'Công nợ & nhắc nợ' },
    { key: 'screen:su-co', kind: 'screen', group: 'Vận hành', label: 'Phản ánh & sự cố' },
    { key: 'screen:thong-bao', kind: 'screen', group: 'Vận hành', label: 'Thông báo đa kênh' },
    { key: 'screen:bao-cao', kind: 'screen', group: 'Vận hành', label: 'Báo cáo thống kê' },
    { key: 'screen:tai-khoan', kind: 'screen', group: 'Vận hành', label: 'Tài khoản người dùng' },
    { key: 'screen:cai-dat', kind: 'screen', group: 'Vận hành', label: 'Cài đặt & phân quyền' },
    { key: 'screen:mini-app', kind: 'screen', group: 'Dành cho tiểu thương', label: 'Mini app tiểu thương' },

    { key: 'action:so-do.xem-ho-so', kind: 'action', group: 'Điều hành', screenId: 'so-do', label: 'Xem hồ sơ tiểu thương từ sơ đồ mặt bằng' },
    { key: 'action:so-do.tao-hop-dong', kind: 'action', group: 'Điều hành', screenId: 'so-do', label: 'Tạo hợp đồng từ sơ đồ mặt bằng' },
    { key: 'action:so-do.doi-trang-thai', kind: 'action', group: 'Điều hành', screenId: 'so-do', label: 'Đổi trạng thái điểm kinh doanh' },
    { key: 'action:phien-cho.chot-phien', kind: 'action', group: 'Điều hành', screenId: 'phien-cho', label: 'Điểm danh & chốt phiên chợ quê' },
    { key: 'action:tieu-thuong.them-moi', kind: 'action', group: 'Tiểu thương & hợp đồng', screenId: 'tieu-thuong', label: 'Thêm hồ sơ tiểu thương' },
    { key: 'action:phai-thu.mien-giam', kind: 'action', group: 'Tài chính', screenId: 'phai-thu', label: 'Miễn giảm / điều chỉnh khoản phải thu' },
    { key: 'action:thu-tien.thu', kind: 'action', group: 'Tài chính', screenId: 'thu-tien', label: 'Thu tiền (mọi nơi có nút "Thu tiền")' },
    { key: 'action:su-co.tao-phan-anh', kind: 'action', group: 'Vận hành', screenId: 'su-co', label: 'Tạo phản ánh / sự cố thủ công' },
    { key: 'action:su-co.phan-cong', kind: 'action', group: 'Vận hành', screenId: 'su-co', label: 'Phân công người xử lý' },
    { key: 'action:su-co.chuyen-trang-thai', kind: 'action', group: 'Vận hành', screenId: 'su-co', label: 'Chuyển trạng thái xử lý' },
    { key: 'action:su-co.vuot-cap', kind: 'action', group: 'Vận hành', screenId: 'su-co', label: 'Chuyển phản ánh vượt cấp lên phường' },
    { key: 'action:su-co.chi-dao', kind: 'action', group: 'Vận hành', screenId: 'su-co', label: 'Gửi ý kiến chỉ đạo (cho phản ánh đã vượt cấp)' },
    { key: 'action:tai-khoan.tao-moi', kind: 'action', group: 'Vận hành', screenId: 'tai-khoan', label: 'Thêm tài khoản người dùng' },
    { key: 'action:tai-khoan.sua', kind: 'action', group: 'Vận hành', screenId: 'tai-khoan', label: 'Sửa thông tin tài khoản' },
    { key: 'action:tai-khoan.khoa-mo-khoa', kind: 'action', group: 'Vận hành', screenId: 'tai-khoan', label: 'Khoá / mở khoá tài khoản' },
    { key: 'action:tai-khoan.gan-quyen', kind: 'action', group: 'Vận hành', screenId: 'tai-khoan', label: 'Gán vai trò / phạm vi chợ cho tài khoản' },
    { key: 'action:cai-dat.gia-mat-bang', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Quản lý đơn giá mặt bằng (Cấu hình dịch vụ)' },
    { key: 'action:cai-dat.gia-dien-nuoc', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Quản lý giá điện, nước (Cấu hình dịch vụ)' },
    { key: 'action:cai-dat.dich-vu-khac', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Quản lý dịch vụ khác (Cấu hình dịch vụ)' },
    { key: 'action:cai-dat.ky-thu', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Cấu hình kỳ thu' },
    { key: 'action:cai-dat.quy-tac-thu-phi', kind: 'action', group: 'Vận hành', screenId: 'cai-dat', label: 'Cấu hình quy tắc thu phí' }
  ];

  // ============================================================
  // 2) ROLE — vai trò, ĐỘNG: thêm/sửa/vô hiệu hoá được (không xoá
  //    cứng để tránh mất dấu vết, dùng cờ active).
  //    scope: 'all'    – không giới hạn chợ (chọn được ở thanh trên)
  //           'market' – giới hạn đúng 1 chợ (xem field market)
  //           'self'   – chỉ dữ liệu của chính tài khoản (tự phục vụ)
  //    selfService: true = hành vi tự phục vụ kiểu tiểu thương (ẩn bộ
  //    chọn "Chợ", mặc định vào thẳng mini-app) — giữ đúng hành vi
  //    hiện tại của ui.role === 'tieuthuong' trong js/core.js.
  //    builtin: true = 1 trong 3 vai trò gốc, không cho xoá.
  // ============================================================
  function defaultRoles() {
    return [
      { id: 'lanhdao', name: 'Lãnh đạo phường', desc: 'Lãnh đạo UBND phường – theo dõi liên chợ, xử lý phản ánh vượt cấp', scope: 'all', market: null, selfService: false, builtin: true, active: true },
      { id: 'bql', name: 'Ban Quản lý chợ', desc: 'Toàn quyền nghiệp vụ trong phạm vi chợ được giao', scope: 'all', market: null, selfService: false, builtin: true, active: true },
      { id: 'tieuthuong', name: 'Tiểu thương', desc: 'Tự phục vụ qua mini app: xem, thanh toán, gửi phản ánh cho điểm kinh doanh của mình', scope: 'self', market: null, selfService: true, builtin: true, active: true }
    ];
  }

  // ============================================================
  // 3) ROLE_PERMISSION — bảng gán quyền, quan hệ nhiều-nhiều
  //    Role × Permission. Mỗi dòng = 1 lượt cấp quyền, có mốc thời
  //    gian/người cấp để phục vụ nhật ký kiểm toán ở Giai đoạn 6.
  //
  //    Seed mặc định bám sát tuyệt đối hành vi cứng hiện tại:
  //      screenRoles ⇔ "roles" của A.MENU (js/core.js)
  //      actionRoles ⇔ các "ui.role === 'bql'" / "!bql" trong js/v-*.js
  // ============================================================
  function defaultRolePermissions() {
    const screenRoles = {
      'tong-quan': ['lanhdao', 'bql'],
      'cau-truc': ['bql'],
      'so-do': ['lanhdao', 'bql'],
      'phien-cho': ['lanhdao', 'bql'],
      'diem-kd': ['bql'],
      'tieu-thuong': ['lanhdao', 'bql'],
      'hop-dong': ['bql'],
      'dien-nuoc': ['bql'],
      'phai-thu': ['bql'],
      'thu-tien': ['bql'],
      'doi-soat': ['bql'],
      'cong-no': ['bql'],
      'su-co': ['lanhdao', 'bql'],
      'thong-bao': ['bql'],
      'bao-cao': ['lanhdao', 'bql'],
      'tai-khoan': ['bql'],
      'cai-dat': ['bql'],
      'mini-app': ['lanhdao', 'bql', 'tieuthuong']
    };
    const actionRoles = {
      'so-do.xem-ho-so': ['bql'],
      'so-do.tao-hop-dong': ['bql'],
      'so-do.doi-trang-thai': ['bql'],
      'phien-cho.chot-phien': ['bql'],
      'tieu-thuong.them-moi': ['bql'],
      'phai-thu.mien-giam': ['bql'],
      'thu-tien.thu': ['bql'],
      'su-co.tao-phan-anh': ['bql'],
      'su-co.phan-cong': ['bql'],
      'su-co.chuyen-trang-thai': ['bql'],
      'su-co.vuot-cap': ['bql'],
      'su-co.chi-dao': ['lanhdao'],
      'tai-khoan.tao-moi': ['bql'],
      'tai-khoan.sua': ['bql'],
      'tai-khoan.khoa-mo-khoa': ['bql'],
      'tai-khoan.gan-quyen': ['bql'],
      'cai-dat.gia-mat-bang': ['bql'],
      'cai-dat.gia-dien-nuoc': ['bql'],
      'cai-dat.dich-vu-khac': ['bql'],
      'cai-dat.ky-thu': ['bql'],
      'cai-dat.quy-tac-thu-phi': ['bql']
    };
    const rows = [];
    const grant = (roleId, permKey) => rows.push({ roleId: roleId, permKey: permKey, grantedAt: 'seed', grantedBy: 'Hệ thống (seed mặc định)' });
    Object.keys(screenRoles).forEach(s => screenRoles[s].forEach(r => grant(r, 'screen:' + s)));
    Object.keys(actionRoles).forEach(a => actionRoles[a].forEach(r => grant(r, 'action:' + a)));
    return rows;
  }

  // ============================================================
  // 4) SCOPE — phạm vi dữ liệu. Gắn trực tiếp vào Role (field
  //    scope + market ở mục 2) thay vì tách bảng riêng, vì trong
  //    nghiệp vụ hiện tại "phạm vi" luôn là thuộc tính của TỪNG VAI
  //    TRÒ (đúng như cột "Phạm vi dữ liệu" trong bảng D.ROLES hiện
  //    có ở màn Cài đặt), không phải của từng lượt cấp quyền riêng
  //    lẻ. RolePermission ở mục 3 đã có sẵn khoá (roleId, permKey)
  //    nên nếu sau này cần "1 vai trò có phạm vi khác nhau theo
  //    từng quyền", có thể thêm field scope vào từng dòng đó mà
  //    không phá vỡ dữ liệu cũ.
  // ============================================================

  function loadState() {
    try {
      const s = localStorage.getItem(PKEY);
      if (s) { const x = JSON.parse(s); if (x && x.roles && x.rolePerms) return x; }
    } catch (e) { /* bỏ qua */ }
    return { roles: defaultRoles(), rolePerms: defaultRolePermissions() };
  }
  let STATE = loadState();
  function saveState() { try { localStorage.setItem(PKEY, JSON.stringify(STATE)); } catch (e) { /* bỏ qua */ } }

  // ---------- API truy vấn/ghi (chưa được gọi ở đâu khác — dành cho Giai đoạn 2/3/5) ----------
  const PERM = A.PERM = {
    KEY: PKEY,
    CATALOG: CATALOG,
    catalog: () => CATALOG,
    permission: key => CATALOG.find(p => p.key === key),

    roles: () => STATE.roles,
    activeRoles: () => STATE.roles.filter(r => r.active),
    role: id => STATE.roles.find(r => r.id === id),

    rolePermKeys: roleId => STATE.rolePerms.filter(r => r.roleId === roleId).map(r => r.permKey),
    hasPerm: (roleId, permKey) => STATE.rolePerms.some(r => r.roleId === roleId && r.permKey === permKey),
    canScreen: (roleId, screenId) => PERM.hasPerm(roleId, 'screen:' + screenId),
    canAction: (roleId, actionKey) => PERM.hasPerm(roleId, 'action:' + actionKey),

    addRole: role => { STATE.roles.push(role); saveState(); },
    updateRole: (id, patch) => { const r = PERM.role(id); if (r) Object.assign(r, patch); saveState(); },
    setRoleActive: (id, active) => { const r = PERM.role(id); if (r) r.active = active; saveState(); },
    removeRole: id => {
      const r = PERM.role(id);
      if (!r || r.builtin) return false;
      STATE.roles = STATE.roles.filter(x => x.id !== id);
      STATE.rolePerms = STATE.rolePerms.filter(x => x.roleId !== id);
      saveState(); return true;
    },
    grant: (roleId, permKey, by) => {
      if (!PERM.hasPerm(roleId, permKey)) {
        STATE.rolePerms.push({ roleId: roleId, permKey: permKey, grantedAt: new Date().toISOString(), grantedBy: by || 'Không rõ' });
        saveState();
      }
    },
    revoke: (roleId, permKey) => {
      STATE.rolePerms = STATE.rolePerms.filter(r => !(r.roleId === roleId && r.permKey === permKey));
      saveState();
    },
    resetDefault: () => { STATE = { roles: defaultRoles(), rolePerms: defaultRolePermissions() }; saveState(); }
  };
})(window.APP);
