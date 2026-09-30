/* Trader account readiness (Phase 15.8, from js/workflow.js): a trader profile with an active contract on a
 * business point of the SAME market and no account needs one. Task panel shown on the tai-khoan route and the
 * wf-account-* commands that create the PENDING_ACTIVATION trader account from the existing profile.
 * Market source-of-truth: Trader.market (must equal Contract.market and Point.market) — never selectedMarket,
 * the creator, a collector or row.collectorId. Nothing on the profile/contract/point is edited here. */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  const PENDING = 'PENDING_ACTIVATION';
  const trader = id => A.idx.trader.get(id);
  const stall = id => A.idx.stall.get(id);
  const accounts = A.features.accounts.service;
  const accountFor = id => accounts.byTraderId(id);
  // Hồ sơ đã gắn account (kể cả xung đột nhiều account) → không được tạo account mới.
  const hasAccount = id => A.ACCOUNTS.isTraderLinked(id);
  const contracts = A.features.contracts.service;
  const marketName = id => U.mShort(id);
  const contractPointId = c => c && (c.businessPointId || c.stallId);
  const phoneOk = phone => /^0\d{9}$/.test(A.ACCOUNTS.normalizePhone(phone));
  // Đăng nhập OTP tra account theo SĐT (A.ACCOUNTS.byPhone) nên SĐT phải chưa thuộc account khác.
  const phoneOwner = t => { const a = A.ACCOUNTS.byPhone(t.phone); return a && A.ACCOUNTS.traderIdsOf(a).indexOf(t.id) === -1 ? a : null; };

  // Nguồn DUY NHẤT của điều kiện tạo tài khoản tiểu thương. Mọi hợp đồng hiệu lực của hồ sơ được xét (không chỉ
  // hợp đồng đầu tiên); cặp Hợp đồng–Điểm hợp lệ khi điểm tồn tại và Trader.market = Contract.market = Point.market.
  function candidate(t) {
    const active = contracts.listByTrader(t.id).filter(contracts.isActive).map(c => ({ c, s: stall(contractPointId(c)) }));
    const linked = active.filter(x => x.s);
    const mismatched = linked.filter(x => !t.market || x.c.market !== t.market || x.s.market !== t.market);
    const issues = [];
    if (hasAccount(t.id)) issues.push('Hồ sơ đã có tài khoản');
    if (!active.length) issues.push('Chưa có hợp đồng hiệu lực');
    else if (!linked.length) issues.push('Hợp đồng chưa gắn điểm kinh doanh');
    if (mismatched.length) issues.push('Lệch dữ liệu chợ giữa hồ sơ, hợp đồng và điểm kinh doanh (' + mismatched.map(x => x.c.id).join(', ') + ')');
    if (!phoneOk(t.phone)) issues.push('Số điện thoại đăng nhập không hợp lệ');
    else { const other = phoneOwner(t); if (other) issues.push('Số điện thoại đã được dùng cho tài khoản ' + other.code); }
    return { t, pairs: linked.filter(x => mismatched.indexOf(x) === -1), ready: !issues.length, issues };
  }
  // Chỉ hồ sơ thuộc chợ mà người dùng hiện tại được xem (Trader.market ∈ phạm vi account).
  const visible = t => A.allowedMarkets(A.currentAccount()).indexOf(t.market) !== -1;
  const readyCandidates = () => A.db.traders.filter(visible).map(candidate).filter(x => x.ready);
  const needsAccount = () => readyCandidates().map(x => x.t);
  const toRow = x => ({ t: x.t, c: x.pairs[0].c, s: x.pairs[0].s, pairs: x.pairs });
  const pointsText = pairs => pairs.map(x => x.s.code).join(', ');
  const contractsText = pairs => pairs.map(x => x.c.id).join(', ');

  function accountTaskHtml() {
    const rows = needsAccount();
    return A.UI.pending.summary({ count: rows.length, title: 'Tiểu thương chưa có tài khoản', description: 'Tiểu thương đã có hợp đồng và điểm kinh doanh nhưng chưa có tài khoản.', action: 'wf-account-worklist', actionLabel: A.canDo('tai-khoan.tao-moi') ? 'Xem & xử lý' : 'Xem danh sách' });
  }

  function pendingAccountRows() {
    const q = String(ui.pendingAccountSearch || '').trim().toLowerCase();
    return readyCandidates().map(toRow)
      .filter(x => !q || [x.t.name, x.t.id, x.t.phone, contractsText(x.pairs), pointsText(x.pairs)].join(' ').toLowerCase().includes(q));
  }
  function showAccountWorklist() {
    const all = needsAccount(), rows = pendingAccountRows(), pg = A.UI.pending.pager({ key: 'pendingAccounts', total: rows.length, size: 15, action: 'wf-account-worklist-page' });
    const canCreate = A.canDo('tai-khoan.tao-moi');
    const body = rows.slice(pg.start, pg.end).map(({ t, pairs }) => `<div class="pending-work-row"><div><b>${U.esc(t.name)}</b><div class="small muted">${t.id} · ${U.maskPhone(t.phone)} · ${U.esc(marketName(t.market))}</div><div class="small">Điểm ${U.esc(pointsText(pairs))} · Hợp đồng ${U.esc(contractsText(pairs))}</div></div>${canCreate ? `<button class="btn sm primary" data-act="wf-account-open" data-id="${t.id}">Tạo tài khoản</button>` : ''}</div>`).join('');
    A.modal(A.UI.pending.worklist({ title: 'Tiểu thương chưa có tài khoản', count: all.length, searchKey: 'wf-account-search', searchValue: ui.pendingAccountSearch, placeholder: 'Tìm tên, mã TT, SĐT, điểm KD, hợp đồng...', rows: body, pagerHtml: pg.html }), true);
  }

  const kv = rows => `<dl class="kv">${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>`;
  const section = (title, body) => `<section class="af-scope"><div class="af-scope-title">${title}</div>${body}</section>`;
  // Kiểm tra lại ngay trước mở/tạo (dữ liệu có thể đổi sau khi danh sách hiển thị); lỗi dữ liệu → chặn, không tự sửa.
  function checked(id) {
    const t = trader(id);
    if (!t) { U.toast('Không tìm thấy hồ sơ tiểu thương.'); return null; }
    if (!visible(t)) { U.toast('Hồ sơ không thuộc phạm vi chợ của bạn.'); return null; }
    const x = candidate(t);
    if (!x.ready) { U.toast('Không thể tạo tài khoản: ' + x.issues.join('; ') + '.'); return null; }
    return x;
  }
  A.ACT['wf-account-open'] = el => {
    if (!A.canDo('tai-khoan.tao-moi')) return;
    const x = checked(el.dataset.id); if (!x) return;
    const t = x.t, m = U.market(t.market) || { name: t.market };
    const pointList = x.pairs.map(p => `<div><b>${U.esc(p.s.code)}</b>${p.s.sectionName ? ` <span class="muted">· ${U.esc(p.s.sectionName)}</span>` : ''} <span class="muted">— Hợp đồng ${U.esc(p.c.id)}</span></div>`).join('');
    A.modal(A.mHead('Tạo tài khoản tiểu thương') + `<div class="modal-b acc-form">
      ${section('A. Hồ sơ tiểu thương', kv([['Họ và tên', `<b>${U.esc(t.name)}</b>`], ['Số điện thoại', U.esc(U.maskPhone(t.phone))], ['Chợ', U.esc(m.name)], [x.pairs.length > 1 ? `Điểm kinh doanh (${x.pairs.length})` : 'Điểm kinh doanh', pointList]]))}
      ${section('B. Thông tin tài khoản', kv([['Vai trò', 'Tiểu thương'], ['Mã tài khoản', 'Hệ thống tự động tạo'], ['Số điện thoại đăng nhập', U.esc(U.maskPhone(t.phone)) + ' <span class="muted">(lấy từ hồ sơ)</span>'], ['Trạng thái', 'Chờ kích hoạt']]))}
      ${section('C. Phạm vi dữ liệu', `<div class="af-scope-value">${U.esc(m.name)}</div><p class="af-scope-help">Chỉ được truy cập dữ liệu của chính tiểu thương tại chợ này.</p>`)}
      <div class="note info" style="margin-top:12px">Thông tin lấy từ hồ sơ, hợp đồng và điểm kinh doanh hiện có. Tài khoản được kích hoạt sau lần xác thực OTP đầu tiên.</div>
    </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="wf-account-create" data-id="${t.id}">Tạo tài khoản</button></div>`);
  };
  A.ACT['wf-account-worklist'] = () => { ui.page.pendingAccounts = 0; showAccountWorklist(); };
  A.ACT['wf-account-worklist-page'] = el => { ui.page[el.dataset.k] = Math.max(0, (ui.page[el.dataset.k] || 0) + Number(el.dataset.d)); showAccountWorklist(); };
  A.IN['wf-account-search'] = el => { ui.pendingAccountSearch = el.value; ui.page.pendingAccounts = 0; showAccountWorklist(); };
  // Vai trò, chợ, trạng thái, mã tài khoản đều do hệ thống xác định — không lấy từ form.
  A.ACT['wf-account-create'] = el => {
    if (!A.canDo('tai-khoan.tao-moi')) return;
    const x = checked(el.dataset.id); if (!x) return;
    const t = x.t, id = accounts.nextTraderAccountId(U.pad), phone = A.ACCOUNTS.normalizePhone(t.phone);
    accounts.add({ id, code: id.replace('AC-', ''), fullName: t.name, phone, accountType: 'Tiểu thương', title: 'Tiểu thương', roleIds: ['trader'], organization: marketName(t.market), marketScopes: [t.market], status: PENDING, traderId: t.id });
    U.log('Tạo tài khoản tiểu thương ' + id.replace('AC-', '') + ' cho hồ sơ ' + t.id + ' — chờ kích hoạt qua OTP');
    A.closeModal(); A.render();
    // Prototype: không có nhà cung cấp SMS — chỉ tạo hướng dẫn kích hoạt, không khẳng định đã gửi thật.
    U.toast('Đã tạo tài khoản ' + id.replace('AC-', '') + '. Hướng dẫn kích hoạt đã được tạo cho số điện thoại đăng nhập ' + U.maskPhone(phone) + '.');
  };
  // Giữ tương thích lệnh cũ (thông báo kích hoạt mô phỏng) — không gửi SMS thật.
  A.ACT['wf-send-activation'] = el => { const t = trader(el.dataset.id); if (!t || !accountFor(t.id)) return; A.closeModal(); U.toast('Đã gửi thông báo kích hoạt: dùng số điện thoại đã đăng ký để đăng nhập OTP.'); };
  accounts.tradersNeedingAccount = needsAccount;
  accounts.traderAccountCandidate = t => candidate(t);
  // Read-only selector for the account-management work queue. The page owns rendering;
  // this module remains the sole owner of the trader/contract eligibility rule.
  accounts.traderAccountRows = () => readyCandidates().map(toRow);
  A.features.accounts.traderAccountTaskHtml = accountTaskHtml;
})(window.APP);
