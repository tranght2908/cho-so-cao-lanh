/* Trader account readiness (Phase 15.8, from js/workflow.js): a trader with an active contract on a
 * resolvable business point and no account needs one. Task panel shown on the tai-khoan route and the
 * wf-account-* commands that create the PENDING_ACTIVATION trader account. */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  const active = c => c && c.status === 'hieuluc';
  const trader = id => A.idx.trader.get(id);
  const stall = id => A.idx.stall.get(id);
  const accounts = A.features.accounts.service;
  const accountFor = id => accounts.byTraderId(id);
  const contracts = A.features.contracts.service;
  const marketName = id => U.mShort(id);
  const needsAccount = () => A.db.traders.filter(t => {
    const c = contracts.activeForTrader(t.id);
    return !!c && !!stall(c.stallId) && !accountFor(t.id);
  });

  function accountTaskHtml() {
    const rows = needsAccount();
    return A.UI.pending.summary({ count: rows.length, title: 'Tiểu thương chưa có tài khoản', description: 'Tiểu thương đã có hợp đồng và điểm kinh doanh nhưng chưa có tài khoản.', action: 'wf-account-worklist', actionLabel: A.canDo('tai-khoan.tao-moi') ? 'Xem & xử lý' : 'Xem danh sách' });
  }

  function pendingAccountRows() {
    const q = String(ui.pendingAccountSearch || '').trim().toLowerCase();
    return needsAccount().map(t => {
      const c = A.db.contracts.find(x => active(x) && x.traderId === t.id), s = c && stall(c.stallId);
      return { t, c, s };
    }).filter(x => !q || [x.t.name, x.t.id, x.t.phone, x.c && x.c.id, x.s && x.s.code].join(' ').toLowerCase().includes(q));
  }
  function showAccountWorklist() {
    const all = needsAccount(), rows = pendingAccountRows(), pg = A.UI.pending.pager({ key: 'pendingAccounts', total: rows.length, size: 15, action: 'wf-account-worklist-page' });
    const canCreate = A.canDo('tai-khoan.tao-moi');
    const body = rows.slice(pg.start, pg.end).map(({ t, c, s }) => `<div class="pending-work-row"><div><b>${U.esc(t.name)}</b><div class="small muted">${t.id} · ${U.maskPhone(t.phone)} · ${U.esc(marketName(t.market))}</div><div class="small">${s ? 'Điểm ' + s.code : 'Chưa có điểm'} · Hợp đồng ${c ? c.id : '—'}</div></div>${canCreate ? `<button class="btn sm primary" data-act="wf-account-open" data-id="${t.id}">Tạo tài khoản</button>` : ''}</div>`).join('');
    A.modal(A.UI.pending.worklist({ title: 'Tiểu thương chưa có tài khoản', count: all.length, searchKey: 'wf-account-search', searchValue: ui.pendingAccountSearch, placeholder: 'Tìm tên, mã TT, SĐT, điểm KD, hợp đồng...', rows: body, pagerHtml: pg.html }), true);
  }

  A.ACT['wf-account-open'] = el => {
    if (!A.canDo('tai-khoan.tao-moi')) return;
    const t = trader(el.dataset.id), c = t && A.db.contracts.find(x => active(x) && x.traderId === t.id), s = c && stall(c.stallId);
    if (!t || !c || !s || accountFor(t.id)) return;
    A.modal(A.mHead('Tạo tài khoản tiểu thương') + `<div class="modal-b"><dl class="kv"><dt>Họ tên</dt><dd>${U.esc(t.name)}</dd><dt>Số điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd><dt>Vai trò</dt><dd>Tiểu thương</dd><dt>Chợ</dt><dd>${U.esc(marketName(t.market))}</dd><dt>Điểm kinh doanh</dt><dd>${s.code}</dd></dl><div class="note info" style="margin-top:12px">Thông tin được lấy từ hồ sơ, hợp đồng và điểm kinh doanh hiện có.</div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="wf-account-create" data-id="${t.id}">Tạo tài khoản</button></div>`);
  };
  A.ACT['wf-account-worklist'] = () => { ui.page.pendingAccounts = 0; showAccountWorklist(); };
  A.ACT['wf-account-worklist-page'] = el => { ui.page[el.dataset.k] = Math.max(0, (ui.page[el.dataset.k] || 0) + Number(el.dataset.d)); showAccountWorklist(); };
  A.IN['wf-account-search'] = el => { ui.pendingAccountSearch = el.value; ui.page.pendingAccounts = 0; showAccountWorklist(); };
  A.ACT['wf-account-create'] = el => {
    if (!A.canDo('tai-khoan.tao-moi')) return;
    const t = trader(el.dataset.id); if (!t || accountFor(t.id)) return;
    const id = accounts.nextTraderAccountId(U.pad);
    accounts.add({ id, code: id.replace('AC-', ''), fullName: t.name, phone: t.phone, accountType: 'Tiểu thương', title: 'Tiểu thương', roleIds: ['trader'], organization: marketName(t.market), marketScopes: [t.market], status: 'PENDING_ACTIVATION', traderId: t.id });
    A.closeModal(); A.render(); A.modal(A.mHead('Tạo tài khoản thành công') + `<div class="modal-b"><b>${U.esc(t.name)}</b><div>${U.maskPhone(t.phone)}</div></div><div class="modal-f"><button class="btn primary" data-act="wf-send-activation" data-id="${t.id}">Gửi thông báo kích hoạt</button></div>`); U.toast('Tạo tài khoản thành công');
  };
  A.ACT['wf-send-activation'] = el => { const t = trader(el.dataset.id); if (!t || !accountFor(t.id)) return; A.closeModal(); U.toast('Đã gửi thông báo kích hoạt: dùng số điện thoại đã đăng ký để đăng nhập OTP.'); };
  accounts.tradersNeedingAccount = needsAccount;
  A.features.accounts.traderAccountTaskHtml = accountTaskHtml;
})(window.APP);
