/* Personal notification inbox for the signed-in account.
 * This is intentionally separate from A.db.notifications, which is the operational
 * multi-channel notification management dataset. */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;

  function list() {
    A.db.personalNotifications = Array.isArray(A.db.personalNotifications) ? A.db.personalNotifications : [];
    return A.db.personalNotifications;
  }
  function now() { return new Date().toISOString(); }
  function roleId(account) { return account && A.ACCOUNTS.primaryRole(account); }
  function defaultsFor(account) {
    const role = roleId(account);
    const byRole = {
      system_admin: [
        ['ACCOUNT', 'Có yêu cầu thay đổi số điện thoại', 'Một yêu cầu tài khoản đang chờ xử lý.', 'tai-khoan'],
        ['ACCESS', 'Rà soát phân quyền hệ thống', 'Danh mục vai trò đã sẵn sàng để cập nhật.', 'cai-dat']
      ],
      ward_leader: [
        ['REPORT', 'Báo cáo tổng hợp đã sẵn sàng', 'Có số liệu thu và công nợ cần theo dõi.', 'bao-cao'],
        ['CONTRACT', 'Hợp đồng sắp hết hạn', 'Có hợp đồng thuộc phạm vi giám sát sắp đến hạn.', 'hop-dong']
      ],
      market_manager: [
        ['CONTRACT', 'Hợp đồng sắp hết hạn', 'Có hợp đồng cần theo dõi trong thời hạn 30 ngày.', 'hop-dong'],
        ['INCIDENT', 'Có phản ánh cần xử lý', 'Một phản ánh trong phạm vi chợ cần được theo dõi.', 'su-co'],
        ['BILLING', 'Kỳ thu cần xử lý', 'Có khoản phải thu cần được kiểm tra.', 'phai-thu']
      ],
      collector: [
        ['COLLECTION', 'Danh sách thu phí cần xử lý', 'Có khoản thu trong phạm vi được phân công.', 'thu-tien'],
        ['DEBT', 'Công nợ cần nhắc', 'Có tiểu thương cần được nhắc nộp phí.', 'cong-no']
      ],
      technician: [
        ['INCIDENT', 'Có phản ánh mới được giao', 'Vui lòng tiếp nhận và cập nhật tiến độ xử lý.', 'su-co'],
        ['INCIDENT', 'Cập nhật trạng thái xử lý', 'Một hồ sơ phản ánh đang chờ cập nhật kết quả.', 'su-co']
      ],
      trader: [
        ['RECEIVABLE', 'Có khoản phải nộp mới', 'Vui lòng xem khoản phải nộp trong Mini App.', 'mini-app'],
        ['RECEIPT', 'Biên lai thanh toán đã sẵn sàng', 'Bạn có thể xem biên lai trong Mini App.', 'mini-app'],
        ['CONTRACT', 'Hợp đồng sắp hết hạn', 'Hợp đồng của bạn sắp đến hạn, vui lòng theo dõi.', 'mini-app']
      ]
    };
    return byRole[role] || [];
  }
  function seed() {
    if (!A.db || A.db.personalNotificationSeedVersion === 1) return;
    const records = list(), ids = new Set(records.map(x => x && x.id));
    (A.ACCOUNTS.list ? A.ACCOUNTS.list() : []).filter(a => A.ACCOUNTS.authStatus(a) === 'ACTIVE').forEach(account => {
      defaultsFor(account).forEach((item, index) => {
        const id = 'PN-' + account.id + '-' + (index + 1);
        if (ids.has(id)) return;
        records.push({ id, recipientAccountId: account.id, type: item[0], title: item[1], message: item[2], createdAt: now(), readAt: index === defaultsFor(account).length - 1 ? now() : null, targetRoute: item[3], targetId: null });
      });
    });
    A.db.personalNotificationSeedVersion = 1;
    A.save();
  }
  function mine(account) {
    seed();
    return list().filter(n => n && n.recipientAccountId === account.id).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
  function unread(account) { return mine(account).filter(n => !n.readAt); }
  function relativeTime(value) {
    const at = new Date(value || 0), diff = Math.max(0, Date.now() - at.getTime());
    if (isNaN(at) || diff < 60000) return 'Vừa xong';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' phút trước';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' giờ trước';
    if (diff < 172800000) return 'Hôm qua';
    return U.dmy(at.toISOString().slice(0, 10));
  }
  function routeAllowed(notification) {
    if (!notification.targetRoute) return false;
    if (notification.targetMarket && A.allowedMarkets(A.currentAccount()).indexOf(notification.targetMarket) === -1) return false;
    return !!((A.PERSONAL_ROUTES && A.PERSONAL_ROUTES[notification.targetRoute]) || U.can(notification.targetRoute));
  }
  function typeIcon(type) {
    const value = String(type || '').toUpperCase();
    if (/(BILLING|RECEIVABLE|COLLECTION|PAYMENT|RECEIPT)/.test(value)) return 'receipt';
    if (/(CONTRACT|ACCOUNT|ACCESS)/.test(value)) return 'file';
    if (/(INCIDENT|WARNING|RECONCILIATION)/.test(value)) return 'warning';
    if (/(METER|ELECTRIC|WATER)/.test(value)) return 'bolt';
    return 'bell';
  }
  function itemHtml(notification) {
    const unreadItem = !notification.readAt;
    return `<button class="personal-notification-item ${unreadItem ? 'unread' : ''}" data-act="personal-notification-open" data-id="${U.esc(notification.id)}"><span class="personal-notification-icon" aria-hidden="true">${U.icon(typeIcon(notification.type))}</span><span class="personal-notification-copy"><b>${U.esc(notification.title)}</b><span>${U.esc(notification.message || '')}</span><small>${relativeTime(notification.createdAt)}</small></span>${unreadItem ? '<i class="personal-notification-dot" aria-label="Chưa đọc"></i>' : ''}</button>`;
  }
  function headerPopoverHtml(account) {
    const notifications = mine(account), unreadCount = unread(account).length;
    const expanded = !!ui.personalNotificationsExpanded, visible = expanded ? notifications : notifications.slice(0, 5);
    return `<div class="header-popover personal-notification-popover" role="dialog" aria-label="Thông báo cá nhân"><div class="personal-notification-popover-head"><b>Thông báo</b>${unreadCount ? '<button class="btn link personal-notification-mark-all" data-act="personal-notification-mark-all">Đánh dấu đã đọc</button>' : ''}</div><div class="personal-notification-list">${visible.length ? visible.map(itemHtml).join('') : '<div class="personal-notification-empty">Bạn chưa có thông báo mới.</div>'}</div>${notifications.length > 5 ? `<button class="personal-notification-all" data-act="personal-notification-all">${expanded ? 'Thu gọn danh sách' : 'Xem tất cả thông báo'}</button>` : ''}</div>`;
  }
  function headerHtml(account) {
    if (!account) return '';
    const count = unread(account).length, badge = count ? `<span class="personal-notification-badge">${count > 99 ? '99+' : count}</span>` : '';
    const open = ui.activeHeaderPopover === 'notifications';
    return `<div class="header-popover-anchor personal-notification-host"><button class="personal-notification-trigger" data-act="personal-notification-toggle" aria-label="Thông báo cá nhân" aria-expanded="${open}">${U.icon('bell')}${badge}</button>${open ? headerPopoverHtml(account) : ''}</div>`;
  }
  function headerPopoverV2(account) {
    const notifications = mine(account), unreadCount = unread(account).length, visible = notifications.slice(0, 5);
    return `<div class="header-popover personal-notification-popover" role="dialog" aria-label="Th&#244;ng b&#225;o"><div class="personal-notification-popover-head"><b>Th&#244;ng b&#225;o</b><span class="personal-notification-head-actions"><button class="btn link personal-notification-view-all" data-act="personal-notification-view-all">Xem t&#7845;t c&#7843;</button>${unreadCount ? '<button class="btn link personal-notification-mark-all" data-act="personal-notification-mark-all">&#272;&#225;nh d&#7845;u &#273;&#227; &#273;&#7885;c</button>' : ''}</span></div><div class="personal-notification-list">${visible.length ? visible.map(itemHtml).join('') : '<div class="personal-notification-empty">B&#7841;n ch&#432;a c&#243; th&#244;ng b&#225;o.</div>'}</div><button class="personal-notification-all" data-act="personal-notification-view-all">Xem t&#7845;t c&#7843; th&#244;ng b&#225;o</button></div>`;
  }
  function headerHtml(account) {
    if (!account) return '';
    const count = unread(account).length, badge = count ? `<span class="personal-notification-badge">${count > 99 ? '99+' : count}</span>` : '';
    const open = ui.activeHeaderPopover === 'notifications';
    return `<div class="header-popover-anchor personal-notification-host"><button class="personal-notification-trigger" data-act="personal-notification-toggle" aria-label="Th&#244;ng b&#225;o" aria-expanded="${open}">${U.icon('bell')}${badge}</button>${open ? headerPopoverV2(account) : ''}</div>`;
  }
  function findOwn(id) { const account = A.currentAccount(); return account && mine(account).find(n => n.id === id); }
  function markRead(notification) { if (notification && !notification.readAt) { notification.readAt = now(); A.save(); } }

  A.personalNotifications = {
    headerHtml,
    list: () => { const account = A.currentAccount(); return account ? mine(account) : []; },
    unreadCount: () => { const account = A.currentAccount(); return account ? unread(account).length : 0; },
    add(notification) {
      if (!notification || !notification.recipientAccountId) return null;
      const record = Object.assign({ id: 'PN-' + Date.now(), type: 'GENERAL', title: 'Thông báo mới', message: '', createdAt: now(), readAt: null, targetRoute: null, targetId: null }, notification);
      list().unshift(record); A.save(); return record;
    }
  };
  A.ACT['personal-notification-toggle'] = () => { ui.activeHeaderPopover = ui.activeHeaderPopover === 'notifications' ? null : 'notifications'; ui.personalNotificationsExpanded = false; A.render(); };
  A.ACT['personal-notification-mark-all'] = () => { const account = A.currentAccount(); if (!account) return; unread(account).forEach(markRead); A.render(); };
  A.ACT['personal-notification-all'] = () => { ui.personalNotificationsExpanded = !ui.personalNotificationsExpanded; A.render(); };
  A.ACT['personal-notification-view-all'] = () => {
    ui.activeHeaderPopover = null;
    if (A.current === 'mini-app' && ui.mini) {
      ui.mini.portalNav = 'notice';
      A.render();
    } else if (U.can('thong-bao')) A.go('thong-bao'); else A.render();
  };
  A.ACT['personal-notification-open'] = el => {
    const notification = findOwn(el.dataset.id); if (!notification) return;
    markRead(notification); ui.activeHeaderPopover = null; ui.personalNotificationsExpanded = false;
    if (routeAllowed(notification)) A.go(notification.targetRoute); else A.render();
  };
  document.addEventListener('click', e => { if (ui.activeHeaderPopover && !e.target.closest('.header-popover-anchor')) { ui.activeHeaderPopover = null; ui.personalNotificationsExpanded = false; A.render(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.activeHeaderPopover) { ui.activeHeaderPopover = null; ui.personalNotificationsExpanded = false; A.render(); } });
})(window.APP);
