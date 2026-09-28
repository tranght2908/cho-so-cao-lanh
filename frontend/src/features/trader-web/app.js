/* Cổng tiểu thương — web app riêng (frontend/tieu-thuong/index.html).
 * Giao diện dùng đúng thành phần của hệ thống quản lý (auth-shell, sidebar/topbar, page-head,
 * kpis, card, U.table, tag, modal) để hai phía nhìn thống nhất.
 * Dữ liệu: dùng chung A.db, A.ACCOUNTS và nghiệp vụ hiện có (A.applyPayment, A.addIncident,
 * A.showReceipt) nên thanh toán/phản ánh từ đây hiện ngay ở trang quản lý cùng trình duyệt.
 * Không tạo nguồn dữ liệu nghiệp vụ mới; chỉ lưu phiên đăng nhập của trang này vào sessionStorage.
 * Trang này thay A.route/A.render/A.guide của bootstrap bằng bộ định tuyến riêng (chỉ trên trang này). */
(function (A) {
  'use strict';
  if (!A) return;
  const D = A.D, U = A.U, $ = A.$;
  const SKEY = 'choso-caolanh-trader-web-session';
  const SOURCE = 'Web app tiểu thương';
  const CATS = ['Điện', 'Cấp thoát nước', 'Vệ sinh', 'An ninh trật tự', 'PCCC', 'Hạ tầng', 'Khác'];

  // ---------- trạng thái giao diện của trang (không phải dữ liệu nghiệp vụ) ----------
  const S = { traderId: null, accountId: null, step: 'phone', phone: '', candidates: [], candidateId: null, otp: '', error: '',
    paySel: null, paying: false, openInv: null, billFilter: 'all', noticeFilter: 'all', draftImages: [], sessionImages: {}, lastPays: null, feeFilter: '', lookup: '', lookupResult: null };
  function loadSession() {
    try { const x = JSON.parse(sessionStorage.getItem(SKEY) || 'null'); if (x && x.traderId) { S.traderId = x.traderId; S.accountId = x.accountId; } } catch (e) { /* bỏ qua */ }
  }
  function saveSession() {
    try { if (S.traderId) sessionStorage.setItem(SKEY, JSON.stringify({ traderId: S.traderId, accountId: S.accountId })); else sessionStorage.removeItem(SKEY); } catch (e) { /* bỏ qua */ }
  }

  // ---------- danh tính & phạm vi ----------
  const normPhone = p => String(p || '').replace(/\D/g, '');
  const accounts = () => A.features.accounts.service;
  function traderAccount(t) {
    const acc = t && accounts().byTraderId(t.id);
    return acc && acc.status === 'active' && (acc.roleIds || []).indexOf('trader') !== -1 ? acc : null;
  }
  function inScope(acc, market) {
    const sc = (acc && acc.marketScopes) || [];
    return sc.indexOf('ALL') !== -1 || sc.indexOf(market) !== -1;
  }
  // Tiểu thương đang đăng nhập: hồ sơ còn, tài khoản còn hoạt động và chợ nằm trong phạm vi tài khoản.
  function me() {
    const t = S.traderId ? A.idx.trader.get(S.traderId) : null;
    const acc = t && traderAccount(t);
    if (!t || !acc || acc.id !== S.accountId || !inScope(acc, t.market)) return null;
    return t;
  }
  function logout(msg) {
    Object.assign(S, { traderId: null, accountId: null, step: 'phone', phone: '', candidates: [], candidateId: null, otp: '', error: '', paySel: null, lastPays: null });
    saveSession();
    location.hash = '#/dang-nhap';
    render();
    if (msg) U.toast(msg);
  }
  function demoTraders() {
    return A.ACCOUNTS.list().filter(a => a.status === 'active' && (a.roleIds || []).indexOf('trader') !== -1 && a.traderId)
      .map(a => ({ a, t: A.idx.trader.get(a.traderId) })).filter(x => x.t);
  }

  // ---------- dữ liệu của tiểu thương (chỉ đọc, suy ra từ A.db) ----------
  const stallOf = id => A.idx.stall.get(id);
  const marketName = id => (U.market(id) || { name: id }).name;
  const myInvoices = t => A.db.invoices.filter(i => i.traderId === t.id);
  const unpaid = t => myInvoices(t).filter(i => i.status !== 'paid').sort((a, b) => a.due.localeCompare(b.due));
  const myPayments = t => A.db.payments.filter(p => p.traderId === t.id).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const myIncidents = t => A.db.incidents.filter(i => i.traderId === t.id).slice().reverse();
  const incState = id => (D.INCIDENT_STATES.find(s => s.id === id) || { label: id }).label;
  const incTag = i => `<span class="tag ${i.state === 'dong' || i.state === 'hoanthanh' ? 'ok' : 'info'}">${U.esc(incState(i.state))}</span>`;
  function notices(t) {
    const debt = U.traderOverdue(t.id) > 0, mk = U.market(t.market).short;
    return (A.db.notifications || []).filter(n => n.traderId === t.id || n.group === 'Toàn bộ tiểu thương' || n.group === mk || n.group === 'Ngành hàng: ' + t.cat || (debt && n.group === 'Danh sách nợ phí'))
      .slice().sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  }
  const pointStatus = st => `<span class="tag ${st.status === 'no' ? 'danger' : st.status === 'thue' ? 'ok' : ''}">${U.esc(D.STATUS[st.status] ? D.STATUS[st.status].label : st.status)}</span>`;
  const MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12l2-6h18l2 6z" fill="#0089df"/><path d="M5 12h22v3a3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0z" fill="#4fb3ff"/><path d="M7 17v10h18V17" fill="#0b4a9e"/><rect x="13" y="20" width="6" height="7" fill="#fff"/></svg>';

  // ==================== ĐĂNG NHẬP (dùng khung đăng nhập của hệ thống) ====================
  function authBrand(eyebrow, desc) {
    return `<section class="auth-brand"><div class="auth-mark">${MARK}</div>
      <div class="auth-eyebrow">${eyebrow}</div><div class="auth-title">Chợ số<br>phường Cao Lãnh</div><div class="auth-province">Tỉnh Đồng Tháp</div>
      <p class="auth-desc">${desc}</p></section>`;
  }
  function authFoot() {
    return `<div class="auth-support"><div class="auth-support-h"><span aria-hidden="true">?</span>Cần hỗ trợ?</div>
      <p>Chưa có tài khoản hoặc không đăng nhập được? Vui lòng liên hệ Ban Quản lý chợ nơi bạn đang kinh doanh.</p>
      <a class="btn link" href="#/tra-cuu">Tra cứu biên lai không cần đăng nhập</a></div>
      <div class="auth-proto">Phiên bản nguyên mẫu phục vụ trình diễn. Dữ liệu trong hệ thống là dữ liệu minh họa.</div>`;
  }
  function screenLogin() {
    const err = S.error ? `<div class="auth-error" role="alert">${U.esc(S.error)}</div>` : '';
    let form;
    if (S.step === 'otp') {
      const t = A.idx.trader.get(S.candidateId);
      form = `<div class="auth-brand-label">Cổng tiểu thương</div><h1>Xác thực OTP</h1>
        <p class="auth-lead">Mã xác thực đã được gửi đến số điện thoại <b>${U.maskPhone(t ? t.phone : '')}</b></p>
        <div class="field"><label id="tw-otp-label">Mã OTP *</label><div class="auth-otp" role="group" aria-labelledby="tw-otp-label">${[0, 1, 2, 3, 4, 5].map(i => `<input class="input" inputmode="numeric" autocomplete="one-time-code" maxlength="1" data-tw-otp="${i}" value="${U.esc(S.otp[i] || '')}" aria-label="Số ${i + 1}">`).join('')}</div>${err}</div>
        <button class="btn primary auth-submit" data-act="tw-verify">Xác nhận</button>
        <div class="small muted auth-demo-otp">Prototype: nhập 6 chữ số bất kỳ, không gửi SMS thật.</div>
        <div class="auth-links"><button class="btn link" data-act="tw-back">← Đổi số điện thoại</button></div>`;
    } else if (S.step === 'multi') {
      form = `<div class="auth-brand-label">Cổng tiểu thương</div><h1>Chọn hồ sơ</h1>
        <p class="auth-lead">Số điện thoại gắn với nhiều hồ sơ tiểu thương. Vui lòng chọn hồ sơ cần đăng nhập.</p>
        ${U.table([{ t: 'Tiểu thương' }, { t: 'Chợ' }, { t: '' }], S.candidates.map(id => { const t = A.idx.trader.get(id); return `<tr class="click" data-act="tw-pick" data-id="${t.id}"><td><b>${U.esc(t.name)}</b></td><td>${U.esc(marketName(t.market))}</td><td class="num">Chọn ›</td></tr>`; }))}
        <div class="auth-links"><button class="btn link" data-act="tw-back">← Quay lại</button></div>`;
    } else {
      const demo = demoTraders();
      form = `<div class="auth-brand-label">Cổng tiểu thương</div><h1>Đăng nhập</h1>
        <p class="auth-lead">Sử dụng số điện thoại đã đăng ký với Ban Quản lý chợ.</p>
        <div class="field"><label for="tw-phone">Số điện thoại *</label><input id="tw-phone" class="input auth-input" type="tel" inputmode="tel" autocomplete="tel" data-in="tw-phone" value="${U.esc(S.phone)}" placeholder="Nhập số điện thoại">${err}</div>
        <button class="btn primary auth-submit" data-act="tw-lookup">Tiếp tục</button>
        ${demo.length ? `<div class="small muted" style="margin-top:14px">Tài khoản tiểu thương mẫu:</div><div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px">${demo.map(x => { const debt = U.traderDebt(x.t.id); return `<button class="btn sm" data-act="tw-demo" data-id="${x.t.id}" title="${U.esc(x.a.title || '')}">${U.esc(x.t.name)} · ${U.esc(U.market(x.t.market).short)} · ${debt ? 'còn nợ ' + U.money(debt) : 'đã nộp đủ'}</button>`; }).join('')}</div>` : ''}`;
    }
    return `<div class="auth-shell"><div class="auth-panel">${authBrand('Cổng tiểu thương', 'Xem khoản phí, thanh toán, nhận biên lai và gửi phản ánh tới Ban Quản lý chợ.')}<section class="auth-form">${form}${authFoot()}</section></div></div>`;
  }

  // ==================== TRA CỨU BIÊN LAI (công khai) ====================
  function screenLookup() {
    const r = S.lookupResult;
    let out = '';
    if (r === 'none') out = '<div class="auth-error" role="alert">Không tìm thấy biên lai với mã tra cứu này.</div>';
    else if (r) {
      const inv = A.idx.invoice.get(r.invoiceId), st = inv && stallOf(inv.stallId);
      out = `<dl class="kv" style="margin-top:14px"><dt>Số biên lai</dt><dd><b>${U.esc(r.receipt)}</b></dd><dt>Số tiền</dt><dd><b>${U.money(r.amount)}</b></dd>
        <dt>Kỳ thu</dt><dd>${inv ? U.per(inv.period) : '—'}</dd><dt>Điểm kinh doanh</dt><dd>${st ? U.esc(st.code) + ' · ' + U.esc(marketName(st.market)) : '—'}</dd>
        <dt>Hình thức</dt><dd>${U.esc(D.METHOD[r.method] || r.method)}</dd><dt>Thời gian</dt><dd>${U.dmy(r.date)} ${U.esc(r.time || '')}</dd></dl>
        <button class="btn auth-submit" data-act="tw-receipt" data-id="${r.id}">Xem biên lai</button>`;
    }
    const back = me() ? '<a class="btn link" href="#/trang-chu">← Về trang chủ</a>' : '<a class="btn link" href="#/dang-nhap">← Về đăng nhập</a>';
    return `<div class="auth-shell"><div class="auth-panel">${authBrand('Tra cứu biên lai', 'Nhập mã tra cứu in trên biên lai điện tử để kiểm tra giao dịch.')}
      <section class="auth-form"><div class="auth-brand-label">Cổng tiểu thương</div><h1>Tra cứu biên lai</h1>
        <p class="auth-lead">Mã tra cứu gồm 6 ký tự, in trên biên lai điện tử.</p>
        <div class="field"><label for="tw-lookup">Mã tra cứu *</label><input id="tw-lookup" class="input auth-input" data-in="tw-lookup" value="${U.esc(S.lookup)}" placeholder="VD: 8K2QZP" style="text-transform:uppercase"></div>
        <button class="btn primary auth-submit" data-act="tw-lookup-go">Tra cứu</button>${out}
        <div class="auth-links">${back}</div></section></div></div>`;
  }

  // ==================== CÁC MÀN SAU ĐĂNG NHẬP (góc nhìn của tiểu thương) ====================
  const periodOf = i => U.per(i.period);
  const currentPeriod = t => { const ps = myInvoices(t).map(i => i.period).sort(); return ps.length ? ps[ps.length - 1] : null; };
  const contractsOf = t => A.db.contracts.filter(c => c.traderId === t.id).sort((a, b) => (a.status === 'hieuluc' ? 0 : 1) - (b.status === 'hieuluc' ? 0 : 1) || b.start.localeCompare(a.start));
  const daysLeft = c => U.days(String(A.db.today || U.today()), c.end);
  const section = (title, body, action) => `<section class="card tw-sec"><div class="card-h"><h3>${title}</h3>${action || ''}</div><div class="card-b">${body}</div></section>`;
  const empty = txt => `<div class="tw-empty">${txt}</div>`;

  // Thông báo kỳ thu: suy ra từ khoản phải thu đã phát hành (ngày phát hành, số tiền, hạn nộp),
  // gộp với thông báo chung của Ban Quản lý. Không lưu thêm bản ghi nào.
  function feeNotices(t) {
    const invs = myInvoices(t).filter(i => i.issued);
    return Array.from(new Set(invs.map(i => i.period))).map(p => {
      const xs = invs.filter(i => i.period === p), total = U.sum(xs, i => i.amount);
      const codes = xs.map(i => (stallOf(i.stallId) || {}).code).filter(Boolean);
      const open = xs.find(i => U.due(i) > 0) || xs[0];
      return { id: 'KT-' + p, at: xs.map(i => i.issued).sort()[0], kind: 'fee', invoiceId: open.id,
        title: 'Thông báo phí dịch vụ kỳ ' + U.per(p),
        body: 'Số tiền phải nộp ' + U.money(total) + (codes.length > 1 ? ' cho ' + codes.length + ' điểm kinh doanh (' + codes.join(', ') + ')' : codes.length ? ' cho điểm ' + codes[0] : '') + ', hạn nộp ' + U.dmy(xs[0].due) + '.' };
    });
  }
  function allNotices(t) {
    return feeNotices(t).concat(notices(t).map(n => ({ id: n.id, at: n.at, kind: 'bql', title: n.title, body: n.body || n.text || '' })))
      .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  }
  const noticeItem = n => `<div class="tw-item${n.invoiceId ? ' click' : ''}"${n.invoiceId ? ` data-act="tw-bill-open" data-id="${n.invoiceId}"` : ''}>
      <span class="tw-dot ${n.kind === 'fee' ? 'fee' : ''}" aria-hidden="true">${U.icon(n.kind === 'fee' ? 'receipt' : 'bell')}</span>
      <div class="tw-item-m"><b>${U.esc(n.title)}</b>${n.body ? `<span class="small">${U.esc(n.body)}</span>` : ''}<span class="small muted">${U.dmy(n.at)} · ${n.kind === 'fee' ? 'Kỳ thu tháng' : 'Ban Quản lý chợ'}</span></div></div>`;

  function billCard(i, open, byStall) {
    const st = stallOf(i.stallId), pays = A.db.payments.filter(p => p.invoiceId === i.id);
    return `<div class="tw-bill${open ? ' open' : ''}">
      <button class="tw-bill-h" data-act="tw-bill" data-id="${i.id}" aria-expanded="${open}">
        <span class="tw-item-m">${byStall ? `<b>${st ? U.esc(st.code) : U.esc(i.id)}</b><span class="small muted">${st ? U.esc(st.sectionName || '') + ' · ' : ''}Hạn nộp ${U.dmy(i.due)}</span>` : `<b>Kỳ ${periodOf(i)}</b><span class="small muted">${st ? U.esc(st.code) + ' · ' : ''}Hạn nộp ${U.dmy(i.due)}</span>`}</span>
        <span class="tw-bill-r"><b>${U.money(i.amount)}</b>${U.invTag(i)}</span></button>
      ${open ? `<div class="tw-bill-b">
        <dl class="kv"><dt>Mã khoản</dt><dd>${U.esc(i.id)}</dd><dt>Ngày thông báo</dt><dd>${U.dmy(i.issued)}</dd><dt>Điểm kinh doanh</dt><dd>${st ? U.esc(st.code + ' · ' + (st.sectionName || '')) : '—'}</dd></dl>
        <div class="tw-lines">${(i.items || []).map(x => `<div><span>${U.esc(x.name)}</span><span>${U.money(x.amount)}</span></div>`).join('')}
          <div class="sum"><span>Tổng tiền kỳ ${periodOf(i)}</span><span>${U.money(i.amount)}</span></div>
          <div><span>Đã nộp</span><span>${U.money(i.paid)}</span></div>
          <div class="sum"><span>Còn phải nộp</span><span>${U.money(U.due(i))}</span></div></div>
        ${pays.length ? `<div class="small muted" style="margin:10px 0 4px">Biên lai</div>${pays.map(p => `<button class="tw-receipt" data-act="tw-receipt" data-id="${p.id}">${U.icon('file')}<span>${U.esc(p.receipt)} · ${U.esc(D.METHOD[p.method] || p.method)} · ${U.dmy(p.date)}</span><b>${U.money(p.amount)}</b></button>`).join('')}` : ''}
        ${U.due(i) > 0 ? '<a class="btn primary tw-full" href="#/thanh-toan">Thanh toán kỳ này</a>' : ''}
      </div>` : ''}</div>`;
  }

  function pageHome(t) {
    const cp = currentPeriod(t), cur = myInvoices(t).filter(i => i.period === cp);
    const curDue = U.sum(cur, U.due), older = unpaid(t).filter(i => i.period !== cp), olderDue = U.sum(older, U.due);
    const cons = contractsOf(t).filter(x => x.status === 'hieuluc');
    const inc = myIncidents(t).slice(0, 2);
    const period = cp ? `<section class="card tw-period"><div class="card-b">
        <div class="tw-period-h"><span class="small muted">Kỳ thu tháng ${U.per(cp)}</span>${cur.every(i => i.status === 'paid') ? '<span class="tag ok">Đã nộp đủ</span>' : (cur.some(U.isOver) ? '<span class="tag danger">Quá hạn</span>' : '<span class="tag warn">Chưa nộp</span>')}</div>
        <div class="tw-amount">${U.money(curDue || U.sum(cur, i => i.amount))}</div>
        <div class="small muted">${curDue ? 'Số tiền cần nộp · hạn nộp ' + U.dmy(cur[0].due) : 'Đã nộp đủ kỳ này · cảm ơn bạn'}</div>
        ${olderDue ? `<div class="note warn" style="margin-top:12px">Còn nợ ${older.length} khoản các kỳ trước: <b>${U.money(olderDue)}</b></div>` : ''}
        <div class="tw-actions">${curDue + olderDue ? `<a class="btn primary" href="#/thanh-toan">Thanh toán ${U.money(curDue + olderDue)}</a>` : ''}<a class="btn" href="#/hoa-don">Xem hóa đơn</a></div>
      </div></section>` : section('Kỳ thu', empty('Chưa có khoản phí nào được thông báo.'));
    return `<div class="tw-hello"><h2>Xin chào, ${U.esc(t.name)}</h2><div class="small muted">${U.esc(marketName(t.market))}</div></div>
      ${period}
      <div class="tw-quick">${[['hoa-don', 'receipt', 'Hóa đơn'], ['hop-dong', 'file', 'Hợp đồng'], ['phan-anh', 'warning', 'Phản ánh'], ['thong-bao', 'bell', 'Thông báo']].map(x => `<a href="#/${x[0]}">${U.icon(x[1])}<span>${x[2]}</span></a>`).join('')}</div>
      ${section('Hợp đồng của tôi', cons.map(c => `<div class="tw-item click" data-act="tw-go" data-id="hop-dong"><span class="tw-dot">${U.icon('file')}</span><div class="tw-item-m"><b>${U.esc(c.id)}</b><span class="small muted">${U.esc((stallOf(c.stallId) || {}).code || '')} · hiệu lực đến ${U.dmy(c.end)}</span></div>${contractLeftTag(c)}</div>`).join('') || empty('Chưa có hợp đồng đang hiệu lực.'))}
      ${section('Thông báo mới', allNotices(t).slice(0, 3).map(noticeItem).join('') || empty('Chưa có thông báo.'), '<a class="btn sm" href="#/thong-bao">Tất cả</a>')}
      ${section('Phản ánh của tôi', inc.map(i => `<div class="tw-item click" data-act="tw-inc" data-id="${i.id}"><span class="tw-dot">${U.icon('warning')}</span><div class="tw-item-m"><b>${U.esc(i.title)}</b><span class="small muted">${U.esc(i.id)} · ${U.dmy(i.created)}</span></div>${incTag(i)}</div>`).join('') || empty('Bạn chưa gửi phản ánh nào.'), t.stalls.length ? '<button class="btn sm primary" data-act="tw-report-new">+ Gửi phản ánh</button>' : '')}`;
  }

  // Mỗi kỳ thu tháng là 1 nhóm; trong kỳ liệt kê hóa đơn theo từng điểm kinh doanh.
  function periodGroups(rows) {
    const periods = Array.from(new Set(rows.map(i => i.period)));
    return periods.map(p => {
      const xs = rows.filter(i => i.period === p), due = U.sum(xs, U.due), total = U.sum(xs, i => i.amount);
      const tag = due <= 0 ? '<span class="tag ok">Đã nộp đủ</span>' : xs.some(U.isOver) ? '<span class="tag danger">Quá hạn</span>' : '<span class="tag warn">Còn phải nộp</span>';
      return `<section class="card tw-sec"><div class="card-h"><h3>Kỳ thu tháng ${U.per(p)}</h3>${tag}</div><div class="card-b">
        <div class="tw-period-sum"><span>Tổng tiền kỳ <b>${U.money(total)}</b></span>${due > 0 ? `<span>Còn phải nộp <b class="tw-red">${U.money(due)}</b></span>` : ''}<span class="small muted">${xs.length} điểm kinh doanh</span></div>
        ${xs.map(i => billCard(i, S.openInv === i.id, true)).join('')}</div></section>`;
    }).join('');
  }
  function pageBills(t) {
    const f = S.billFilter || 'all';
    const all = myInvoices(t).slice().sort((a, b) => b.period.localeCompare(a.period) || a.id.localeCompare(b.id));
    const rows = all.filter(i => f === 'all' || (f === 'unpaid' ? i.status !== 'paid' : i.status === 'paid'));
    const due = U.sum(unpaid(t), U.due);
    return `<div class="tw-hello"><h2>Hóa đơn theo kỳ thu</h2><div class="small muted">Phí dịch vụ được thông báo mỗi tháng khi đến kỳ thu.</div></div>
      ${due ? `<div class="note warn tw-due-note"><span>Còn phải nộp <b>${U.money(due)}</b> (${unpaid(t).length} khoản)</span><a class="btn primary sm" href="#/thanh-toan">Thanh toán</a></div>` : '<div class="note info">Bạn đã nộp đủ các kỳ thu.</div>'}
      <div class="seg tw-seg">${[['all', 'Tất cả'], ['unpaid', 'Chưa nộp đủ'], ['paid', 'Đã nộp']].map(x => `<button class="${f === x[0] ? 'on' : ''}" data-act="tw-bill-filter" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>
      ${periodGroups(rows) || `<section class="card tw-sec"><div class="card-b">${empty('Không có hóa đơn phù hợp.')}</div></section>`}`;
  }

  function pagePay(t) {
    if (S.lastPays) {
      const p = S.lastPays;
      return `<section class="card tw-sec"><div class="card-b tw-center">
          <div class="tw-ok">${U.icon('check')}</div><h2>Thanh toán thành công</h2>
          <div class="tw-amount">${U.money(U.sum(p, x => x.amount))}</div>
          <div class="small muted">Biên lai điện tử đã được gửi tới bạn và lưu trong mục Hóa đơn.</div>
          <div style="margin-top:14px;text-align:left">${p.map(x => `<button class="tw-receipt" data-act="tw-receipt" data-id="${x.id}">${U.icon('file')}<span>${U.esc(x.receipt)} · mã tra cứu <b>${U.esc(x.lookup)}</b></span><b>${U.money(x.amount)}</b></button>`).join('')}</div>
          <div class="tw-actions"><button class="btn primary" data-act="tw-receipt-last">Xem biên lai</button><a class="btn" href="#/trang-chu">Về trang chủ</a></div></div></section>`;
    }
    const list = unpaid(t);
    if (!list.length) return `<div class="tw-hello"><h2>Thanh toán</h2></div><div class="note info">Bạn không còn khoản nào cần thanh toán.</div>`;
    if (!S.paySel) S.paySel = list.map(i => i.id);
    S.paySel = S.paySel.filter(id => list.some(i => i.id === id));
    const sel = list.filter(i => S.paySel.indexOf(i.id) !== -1), total = U.sum(sel, U.due);
    const content = 'CHOSO ' + t.id;
    const bank = (D.BANK_BY_MARKET && D.BANK_BY_MARKET[t.market]) || 'Tài khoản thu của Ban Quản lý chợ';
    return `<div class="tw-hello"><h2>Thanh toán</h2><div class="small muted">Chọn kỳ cần nộp rồi quét mã QR bằng ứng dụng ngân hàng.</div></div>
      ${section('Chọn kỳ cần nộp', list.map(i => `<label class="tw-item tw-check"><input type="checkbox" data-ch="tw-sel" value="${i.id}" ${S.paySel.indexOf(i.id) !== -1 ? 'checked' : ''}>
          <div class="tw-item-m"><b>Kỳ ${periodOf(i)}</b><span class="small muted">${U.esc((stallOf(i.stallId) || {}).code || '')} · hạn ${U.dmy(i.due)}</span></div><span class="tw-bill-r"><b>${U.money(U.due(i))}</b>${U.isOver(i) ? '<span class="tag danger">Quá hạn</span>' : ''}</span></label>`).join(''))}
      <section class="card tw-sec"><div class="card-b tw-center">
        ${total ? `<div class="small muted">Quét mã bằng ứng dụng ngân hàng bất kỳ</div>
          <div class="tw-qr">${U.qr(content + ' ' + total, 200)}</div>
          <div class="tw-amount">${U.money(total)}</div>
          <dl class="kv" style="text-align:left;margin:12px 0"><dt>Ngân hàng</dt><dd>${U.esc(bank)}</dd><dt>Nội dung</dt><dd><b>${U.esc(content)}</b></dd><dt>Số kỳ</dt><dd>${sel.length}</dd></dl>
          <button class="btn primary tw-full" data-act="tw-paid" ${S.paying ? 'disabled' : ''}>Giả lập: ngân hàng báo đã chuyển khoản</button>
          <div class="small muted" style="margin-top:8px">Prototype: chưa kết nối cổng thanh toán thật. Có thể nộp tiền mặt cho nhân viên thu phí.</div>` : '<div class="note">Chọn ít nhất một kỳ để tạo mã QR.</div>'}
      </div></section>`;
  }

  function contractLeftTag(c) {
    if (c.status !== 'hieuluc') return '<span class="tag">Đã thanh lý</span>';
    const d = daysLeft(c);
    return d < 0 ? '<span class="tag danger">Đã hết hạn</span>' : d <= 30 ? `<span class="tag warn">Còn ${d} ngày</span>` : '<span class="tag ok">Đang hiệu lực</span>';
  }
  function pageContracts(t) {
    const cons = contractsOf(t);
    return `<div class="tw-hello"><h2>Hợp đồng của tôi</h2><div class="small muted">Hợp đồng thuê điểm kinh doanh ký với Ban Quản lý chợ.</div></div>
      ${cons.map(c => { const st = stallOf(c.stallId), d = daysLeft(c);
        return section(U.esc(c.id), `<dl class="kv">
          <dt>Loại hợp đồng</dt><dd>${U.esc(c.kind || '—')}</dd>
          <dt>Điểm kinh doanh</dt><dd><b>${st ? U.esc(st.code) : '—'}</b>${st ? ' · ' + U.esc(st.sectionName || '') : ''}</dd>
          <dt>Diện tích</dt><dd>${st ? Number(st.area || 0).toLocaleString('vi-VN') + ' m²' : '—'}</dd>
          <dt>Ngành hàng</dt><dd>${st ? U.esc(st.cat || '—') : '—'}</dd>
          <dt>Thời hạn</dt><dd>${U.dmy(c.start)} – ${U.dmy(c.end)}${c.status === 'hieuluc' && d >= 0 ? ` <span class="small muted">(còn ${d} ngày)</span>` : ''}</dd>
          <dt>Đơn giá</dt><dd>${st && U.unitLabel ? U.esc(U.unitLabel(st)) : '—'}</dd>
          ${c.monthly ? `<dt>Giá dịch vụ/tháng</dt><dd><b>${U.money(c.monthly)}</b></dd>` : ''}
          ${c.deposit ? `<dt>Tiền đặt cọc</dt><dd>${U.money(c.deposit)}</dd>` : ''}
          <dt>Trạng thái</dt><dd>${contractLeftTag(c)}</dd></dl>
          ${c.status === 'hieuluc' && d >= 0 && d <= 30 ? '<div class="note warn" style="margin-top:12px">Hợp đồng sắp hết hạn. Vui lòng liên hệ Ban Quản lý chợ để gia hạn.</div>' : ''}
          <div class="tw-actions"><button class="btn" data-act="tw-pdf">${U.icon('file')} Xem bản hợp đồng (PDF)</button></div>`, contractLeftTag(c)); }).join('') || '<div class="note info">Bạn chưa có hợp đồng. Vui lòng liên hệ Ban Quản lý chợ.</div>'}`;
  }

  function pageReport(t) {
    const inc = myIncidents(t);
    return `<div class="tw-hello tw-hello-a"><div><h2>Phản ánh, kiến nghị</h2><div class="small muted">Gửi tới Ban Quản lý chợ và theo dõi kết quả xử lý.</div></div>${t.stalls.length ? '<button class="btn primary" data-act="tw-report-new">+ Gửi phản ánh</button>' : ''}</div>
      <section class="card tw-sec"><div class="card-b">${inc.map(i => `<div class="tw-item click" data-act="tw-inc" data-id="${i.id}"><span class="tw-dot">${U.icon('warning')}</span>
        <div class="tw-item-m"><b>${U.esc(i.title)}</b><span class="small muted">${U.esc(i.id)} · ${U.esc(i.cat)} · ${U.dmy(i.created)}${reportImages(i).length ? ' · ' + reportImages(i).length + ' ảnh' : ''}</span>
        ${(i.state === 'hoanthanh' || i.state === 'dong') ? `<span class="small">${i.rating ? '★'.repeat(i.rating) + ' Đã đánh giá' : 'Đã xử lý xong · chạm để xem kết quả và đánh giá'}</span>` : ''}</div>${incTag(i)}</div>`).join('') || empty('Bạn chưa gửi phản ánh nào.')}</div></section>`;
  }
  const MAX_IMG = 5, MAX_MB = 10;
  const reportImages = i => (i.images && i.images.report) || (i.photo ? ['Ảnh phản ánh'] : []);
  function draftThumbs() {
    return S.draftImages.map((x, n) => `<div class="inc-image-thumb"><img src="${x.url}" alt=""><span>${U.esc(x.name)}</span><button class="x" data-act="tw-image-remove" data-n="${n}" aria-label="Bỏ ảnh">×</button></div>`).join('');
  }
  // Có bản xem trước trong phiên thì hiện ảnh thật; không thì hiện tên tệp như màn quản lý.
  function thumbs(names, urls) {
    return names && names.length ? `<div class="inc-image-list">${names.map((n, k) => `<div class="inc-image-thumb">${urls && urls[k] ? `<img src="${urls[k]}" alt="">` : '📷'}<span>${U.esc(typeof n === 'string' ? n : n.name)}</span></div>`).join('')}</div>` : '<div class="small muted">Chưa có hình ảnh.</div>';
  }
  function clearDraft() { S.draftImages.forEach(x => URL.revokeObjectURL(x.url)); S.draftImages = []; }
  function openIncident(t, id) {
    const i = A.db.incidents.find(x => x.id === id);
    if (!i || i.traderId !== t.id) { U.toast('Không tìm thấy phản ánh'); return; }
    const hist = i.history && i.history.length ? i.history.map(h => [h.at, h.action + (h.detail ? ' – ' + h.detail : '')]) : (i.log || []).map(h => [h.at, h.text]);
    const done = i.state === 'hoanthanh' || i.state === 'dong';
    const when = v => U.esc(String(v || '').replace('T', ' · '));
    A.modal(A.mHead('Phản ánh ' + U.esc(i.id)) + `<div class="modal-b">
      <dl class="kv"><dt>Nội dung</dt><dd><b>${U.esc(i.title)}</b>${i.desc && i.desc !== i.title ? `<div class="small">${U.esc(i.desc)}</div>` : ''}</dd><dt>Nhóm</dt><dd>${U.esc(i.cat)}</dd>
        <dt>Điểm kinh doanh</dt><dd>${U.esc((stallOf(i.stallId) || {}).code || '—')}</dd><dt>Ngày gửi</dt><dd>${when(i.created)}</dd><dt>Trạng thái</dt><dd>${incTag(i)}</dd></dl>
      <h4 style="margin:16px 0 8px">Ảnh bạn gửi</h4>${thumbs(reportImages(i), S.sessionImages[i.id])}
      ${i.work ? `<h4 style="margin:16px 0 8px">Kết quả xử lý</h4><dl class="kv"><dt>Nội dung xử lý</dt><dd>${U.esc(i.work.content || '—')}</dd><dt>Kết quả</dt><dd>${U.esc(i.work.result || '—')}</dd><dt>Hoàn thành lúc</dt><dd>${when(i.work.completedAt)}</dd></dl><div style="margin-top:8px">${thumbs((i.images && i.images.work) || [])}</div>` : ''}
      <h4 style="margin:16px 0 8px">Tiến độ xử lý</h4>${U.table([{ t: 'Thời gian' }, { t: 'Diễn biến' }], hist.map(h => `<tr><td>${when(h[0])}</td><td>${U.esc(h[1])}</td></tr>`))}
      ${done ? `<h4 style="margin:16px 0 8px">Đánh giá kết quả</h4><div class="stars">${[1, 2, 3, 4, 5].map(n => `<button class="${i.rating >= n ? 'on' : ''}" data-act="tw-rate" data-id="${i.id}" data-n="${n}" aria-label="${n} sao">★</button>`).join('')}<span class="small muted">${i.rating ? 'Cảm ơn bạn đã đánh giá' : 'Chạm để chấm điểm'}</span></div>` : ''}
      </div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`);
  }
  function openReportForm(t) {
    clearDraft();
    A.modal(A.mHead('Gửi phản ánh') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label for="tw-cat">Nhóm vấn đề</label><select class="input" id="tw-cat">${CATS.map(c => `<option>${c}</option>`).join('')}</select></div>
      <div class="field"><label for="tw-stall">Điểm kinh doanh</label><select class="input" id="tw-stall">${t.stalls.map(stallOf).filter(Boolean).map(st => `<option value="${st.id}">${U.esc(st.code)} · ${U.esc(st.sectionName || '')}</option>`).join('')}</select></div></div>
      <div class="field" style="margin-top:12px"><label for="tw-text">Nội dung *</label><textarea class="input" id="tw-text" rows="4" placeholder="Mô tả vấn đề, vị trí, thời điểm phát hiện"></textarea></div>
      <div class="field" style="margin-top:12px"><label>Hình ảnh hiện trường (tối đa ${MAX_IMG} ảnh, mỗi ảnh ≤ ${MAX_MB} MB)</label>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <label class="btn">${U.icon('camera')} Chụp ảnh<input type="file" accept="image/*" capture="environment" data-ch="tw-images" hidden></label>
          <label class="btn">${U.icon('attachment')} Chọn ảnh có sẵn<input type="file" accept="image/*" multiple data-ch="tw-images" hidden></label>
        </div>
        <div class="inc-image-draft" id="tw-image-draft" style="margin-top:10px">${draftThumbs()}</div>
        <div class="small muted" style="margin-top:6px">Prototype: ảnh chỉ xem trước trên trình duyệt này, chưa tải lên máy chủ.</div></div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="tw-report">Gửi phản ánh</button></div>`);
  }

  function pageNotices(t) {
    const f = S.noticeFilter || 'all';
    const list = allNotices(t).filter(n => f === 'all' || n.kind === f);
    return `<div class="tw-hello"><h2>Thông báo</h2><div class="small muted">Thông báo phí khi đến kỳ thu và thông báo từ Ban Quản lý ${U.esc(marketName(t.market))}.</div></div>
      <div class="seg tw-seg">${[['all', 'Tất cả'], ['fee', 'Kỳ thu'], ['bql', 'Ban Quản lý']].map(x => `<button class="${f === x[0] ? 'on' : ''}" data-act="tw-notice-filter" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>
      <section class="card tw-sec"><div class="card-b">${list.map(noticeItem).join('') || empty('Chưa có thông báo.')}</div></section>`;
  }

  function pageAccount(t) {
    const idNo = String(t.idNo || '');
    return `<div class="tw-hello"><h2>Tài khoản</h2></div>
      ${section('Thông tin tiểu thương', `<dl class="kv"><dt>Họ tên</dt><dd><b>${U.esc(t.name)}</b></dd><dt>Số điện thoại</dt><dd>${U.esc(t.phone)}</dd><dt>Số giấy tờ</dt><dd>${idNo ? '•••••' + U.esc(idNo.slice(-4)) : '—'}</dd>
        <dt>Chợ</dt><dd>${U.esc(marketName(t.market))}</dd><dt>Ngành hàng</dt><dd>${U.esc(t.cat || '—')}</dd><dt>Địa chỉ</dt><dd>${U.esc(t.address || '—')}</dd></dl>
        <div class="small muted" style="margin-top:10px">Muốn thay đổi thông tin, vui lòng liên hệ Ban Quản lý chợ.</div>`)}
      ${section('Điểm kinh doanh', t.stalls.map(stallOf).filter(Boolean).map(st => `<div class="tw-item"><span class="tw-dot">${U.icon('store')}</span><div class="tw-item-m"><b>${U.esc(st.code)}</b><span class="small muted">${U.esc(st.sectionName || '')} · ${Number(st.area || 0).toLocaleString('vi-VN')} m²</span></div>${pointStatus(st)}</div>`).join('') || empty('Chưa có điểm kinh doanh.'))}
      <section class="card tw-sec"><div class="card-b" style="padding-top:12px">
        <a class="tw-item click" href="#/tra-cuu"><span class="tw-dot">${U.icon('receipt')}</span><div class="tw-item-m"><b>Tra cứu biên lai</b><span class="small muted">Kiểm tra biên lai bằng mã tra cứu</span></div>›</a>
        <button class="btn tw-full" data-act="tw-logout">Đăng xuất</button></div></section>`;
  }

  // ==================== KHUNG (màu, phông, thành phần của hệ thống; bố cục dành cho tiểu thương) ====================
  const TABS = [['trang-chu', 'Trang chủ', 'dashboard'], ['hoa-don', 'Hóa đơn', 'receipt'], ['hop-dong', 'Hợp đồng', 'file'], ['phan-anh', 'Phản ánh', 'warning'], ['thong-bao', 'Thông báo', 'bell']];
  const PAGES = { 'trang-chu': pageHome, 'hoa-don': pageBills, 'thanh-toan': pagePay, 'hop-dong': pageContracts, 'phan-anh': pageReport, 'thong-bao': pageNotices, 'tai-khoan': pageAccount };
  const route = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || '');

  function shell(t, r) {
    const due = unpaid(t).length;
    const badge = id => id === 'hoa-don' && due ? `<i class="tw-badge">${due}</i>` : '';
    const initial = (t.name.split(' ').slice(-1)[0] || '?').charAt(0);
    return `<header class="tw-top"><div class="tw-top-in">
        <a class="tw-brand" href="#/trang-chu"><span class="brand-logo">${MARK.replace('<svg ', '<svg width="24" height="24" ')}</span><span><b>Chợ số Cao Lãnh</b><small>Cổng tiểu thương · ${U.esc(U.market(t.market).short)}</small></span></a>
        <nav class="tw-nav" aria-label="Điều hướng">${TABS.map(x => `<a href="#/${x[0]}" class="${r === x[0] ? 'on' : ''}">${x[1]}${badge(x[0])}</a>`).join('')}</nav>
        <a class="tw-me${r === 'tai-khoan' ? ' on' : ''}" href="#/tai-khoan" title="Tài khoản"><span class="tw-avatar">${U.esc(initial)}</span><span class="tw-me-n">${U.esc(t.name)}</span></a>
      </div></header>
      <main class="tw-main">${PAGES[r](t)}</main>
      <nav class="tw-tabbar" aria-label="Điều hướng nhanh">${TABS.map(x => `<a href="#/${x[0]}" class="${r === x[0] ? 'on' : ''}">${U.icon(x[2])}<span>${x[1]}</span>${badge(x[0])}</a>`).join('')}</nav>`;
  }

  function render() {
    const root = document.getElementById('tw-root');
    if (!root) return;
    let r = route();
    if (r === 'tra-cuu') { root.innerHTML = screenLookup(); return; }
    const t = me();
    if (!t) {
      if (S.traderId) { S.traderId = null; S.accountId = null; saveSession(); }
      if (r !== 'dang-nhap') history.replaceState(null, '', '#/dang-nhap');
      root.innerHTML = screenLogin();
      bindOtp();
      return;
    }
    if (!PAGES[r]) { r = 'trang-chu'; history.replaceState(null, '', '#/trang-chu'); }
    root.innerHTML = shell(t, r);
  }
  // Ô OTP 6 số: tự nhảy ô, Enter = Xác nhận (giống màn đăng nhập của hệ thống).
  function bindOtp() {
    const boxes = Array.from(document.querySelectorAll('[data-tw-otp]'));
    boxes.forEach((el, k) => {
      el.addEventListener('input', () => {
        S.otp = boxes.map(x => String(x.value || '').replace(/\D/g, '').slice(-1)).join(''); S.error = '';
        if (el.value && k < 5) boxes[k + 1].focus();
      });
      el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); A.ACT['tw-verify'](); } });
    });
    const phone = document.getElementById('tw-phone');
    if (phone) phone.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); S.phone = phone.value; A.ACT['tw-lookup'](); } });
    const first = phone || boxes.find(x => !x.value);
    if (first) first.focus();
  }

  let seeded = false;
  A.route = function () {
    if (!seeded) { seeded = true; if (A.traderWebDemoSeed) A.traderWebDemoSeed(); }
    if (route() !== 'thanh-toan') { S.lastPays = null; S.paySel = null; }
    if (route() !== 'hoa-don') S.openInv = null;
    const sb = document.getElementById('sidebar'); if (sb) sb.classList.remove('open');
    A.closeModal(); render(); window.scrollTo(0, 0);
  };
  A.render = function () { render(); };
  A.guide = function () { /* không hiện hướng dẫn của trang quản lý */ };

  // ==================== HÀNH ĐỘNG ====================
  function login(t) {
    const acc = traderAccount(t);
    if (!acc || !inScope(acc, t.market) || (t.profileStatus && t.profileStatus !== 'ACTIVE')) {
      Object.assign(S, { step: 'phone', error: 'Tài khoản chưa được kích hoạt hoặc đang tạm khóa. Vui lòng liên hệ Ban Quản lý chợ.' }); render(); return;
    }
    Object.assign(S, { traderId: t.id, accountId: acc.id, step: 'phone', otp: '', error: '', candidates: [], candidateId: null });
    saveSession();
    location.hash = '#/trang-chu';
    render();
  }
  const toOtp = t => { Object.assign(S, { candidateId: t.id, step: 'otp', otp: '', error: '' }); render(); };
  A.IN['tw-phone'] = el => { S.phone = el.value; };
  A.IN['tw-lookup'] = el => { S.lookup = el.value; };
  A.CH['tw-images'] = el => {
    const files = Array.from(el.files || []);
    el.value = '';
    for (const f of files) {
      if (S.draftImages.length >= MAX_IMG) { U.toast('Chỉ đính kèm tối đa ' + MAX_IMG + ' ảnh'); break; }
      if (!/^image\//.test(f.type)) { U.toast('Tệp ' + f.name + ' không phải hình ảnh'); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { U.toast('Ảnh ' + f.name + ' vượt quá ' + MAX_MB + ' MB'); continue; }
      S.draftImages.push({ name: f.name, url: URL.createObjectURL(f) });
    }
    const box = $('#tw-image-draft'); if (box) box.innerHTML = draftThumbs();
  };
  A.CH['tw-sel'] = el => {
    const set = new Set(S.paySel || []);
    if (el.checked) set.add(el.value); else set.delete(el.value);
    S.paySel = Array.from(set); render();
  };
  Object.assign(A.ACT, {
    'tw-lookup': () => {
      const found = A.db.traders.filter(t => normPhone(t.phone) && normPhone(t.phone) === normPhone(S.phone));
      if (!normPhone(S.phone)) { S.error = 'Vui lòng nhập số điện thoại.'; render(); return; }
      if (!found.length) { S.error = 'Không tìm thấy hồ sơ tiểu thương với số điện thoại này. Vui lòng liên hệ Ban Quản lý chợ.'; render(); return; }
      if (found.length > 1) { Object.assign(S, { step: 'multi', candidates: found.map(t => t.id), error: '' }); render(); return; }
      if (!traderAccount(found[0])) { S.error = 'Tài khoản chưa được kích hoạt hoặc đang tạm khóa. Vui lòng liên hệ Ban Quản lý chợ.'; render(); return; }
      toOtp(found[0]);
    },
    'tw-pick': el => {
      const t = A.idx.trader.get(el.dataset.id);
      if (!t || S.candidates.indexOf(t.id) === -1) return;
      if (!traderAccount(t)) { Object.assign(S, { step: 'phone', error: 'Tài khoản chưa được kích hoạt hoặc đang tạm khóa. Vui lòng liên hệ Ban Quản lý chợ.' }); render(); return; }
      toOtp(t);
    },
    'tw-demo': el => { const t = A.idx.trader.get(el.dataset.id); if (t) { S.phone = t.phone; toOtp(t); } },
    'tw-back': () => { Object.assign(S, { step: 'phone', otp: '', error: '', candidates: [], candidateId: null }); render(); },
    'tw-verify': () => {
      const t = A.idx.trader.get(S.candidateId);
      if (!t) { S.step = 'phone'; render(); return; }
      if (!/^\d{6}$/.test(S.otp)) { S.error = 'Vui lòng nhập đủ 6 chữ số OTP.'; render(); return; }
      login(t);
    },
    'tw-logout': () => logout('Đã đăng xuất'),
    'tw-bill': el => { S.openInv = S.openInv === el.dataset.id ? null : el.dataset.id; render(); },
    'tw-bill-open': el => { S.openInv = el.dataset.id; S.billFilter = 'all'; location.hash = '#/hoa-don'; },
    'tw-bill-filter': el => { S.billFilter = el.dataset.id; render(); },
    'tw-notice-filter': el => { S.noticeFilter = el.dataset.id; render(); },
    'tw-go': el => { location.hash = '#/' + el.dataset.id; },
    'tw-pdf': () => U.toast('Mở bản số hóa hợp đồng (PDF) – minh họa'),
    'tw-paid': () => {
      const t = me();
      if (!t) { logout('Phiên đăng nhập đã hết, vui lòng đăng nhập lại'); return; }
      if (S.paying) return;
      const list = unpaid(t).filter(i => (S.paySel || []).indexOf(i.id) !== -1);
      if (!list.length) { U.toast('Chọn ít nhất một khoản cần thanh toán'); return; }
      S.paying = true;
      try {
        const pays = A.applyPayment(list.map(i => i.id), U.sum(list, U.due), 'qr', SOURCE);
        S.lastPays = pays; S.paySel = null;
        render();
        U.toast('Ngân hàng báo có · đã ghi nhận ' + U.money(U.sum(pays, p => p.amount)));
      } catch (e) {
        console.error('[trader-web] applyPayment', e);
        U.toast('Không ghi nhận được thanh toán, vui lòng thử lại');
      } finally { S.paying = false; }
    },
    'tw-receipt-last': () => { if (S.lastPays) A.showReceipt(S.lastPays); },
    'tw-receipt': el => {
      const p = A.db.payments.find(x => x.id === el.dataset.id), t = me();
      // Đã đăng nhập: chỉ biên lai của mình. Tra cứu công khai: đúng biên lai vừa tra theo mã.
      const ok = p && ((t && p.traderId === t.id) || (route() === 'tra-cuu' && S.lookupResult && S.lookupResult.id === p.id));
      if (!ok) { U.toast('Không tìm thấy biên lai'); return; }
      A.showReceipt([p]);
    },
    'tw-lookup-go': () => {
      const code = String(S.lookup || '').trim().toUpperCase();
      if (!code) { U.toast('Vui lòng nhập mã tra cứu'); return; }
      S.lookupResult = A.db.payments.find(p => String(p.lookup || '').toUpperCase() === code) || 'none';
      render();
    },
    'tw-report-new': () => { const t = me(); if (t && t.stalls.length) openReportForm(t); },
    'tw-report': () => {
      const t = me();
      if (!t) { A.closeModal(); logout('Phiên đăng nhập đã hết, vui lòng đăng nhập lại'); return; }
      const stall = stallOf($('#tw-stall') && $('#tw-stall').value);
      if (!stall || t.stalls.indexOf(stall.id) === -1 || stall.market !== t.market) { U.toast('Điểm kinh doanh không thuộc tài khoản của bạn'); return; }
      const text = ($('#tw-text').value || '').trim();
      if (!text) { U.toast('Vui lòng nhập nội dung phản ánh'); return; }
      const title = text.length > 60 ? text.slice(0, 57) + '…' : text;
      const imgs = S.draftImages.slice();
      const i = A.addIncident(stall.id, $('#tw-cat').value, title, text, SOURCE, imgs.length > 0);
      // Giống màn quản lý: chỉ lưu tên ảnh vào images.report (không lưu base64); ảnh thật xem được trong phiên.
      i.images = { report: imgs.map(x => x.name), inspection: [], work: [] };
      if (imgs.length) S.sessionImages[i.id] = imgs.map(x => x.url);
      S.draftImages = [];
      A.save(); A.closeModal(); render();
      U.toast('Đã gửi ' + i.id + '. Ban Quản lý chợ đã tiếp nhận.');
    },
    'tw-inc': el => { const t = me(); if (t) openIncident(t, el.dataset.id); },
    'tw-image-remove': el => {
      const x = S.draftImages.splice(Number(el.dataset.n), 1)[0];
      if (x) URL.revokeObjectURL(x.url);
      const box = $('#tw-image-draft'); if (box) box.innerHTML = draftThumbs();
    },
    'tw-rate': el => {
      const t = me(), i = A.db.incidents.find(x => x.id === el.dataset.id);
      if (!t || !i || i.traderId !== t.id || (i.state !== 'hoanthanh' && i.state !== 'dong')) return;
      // Giữ đúng hành vi đánh giá hiện có của Mini app: đánh giá xong thì phản ánh chuyển Đóng.
      i.rating = Number(el.dataset.n);
      if (i.state === 'hoanthanh') i.state = 'dong';
      i.log.push({ at: U.today(), text: 'Tiểu thương đánh giá ' + i.rating + ' sao (' + SOURCE + ')' });
      const inModal = !!document.querySelector('#modal-root .modal');
      A.save(); render();
      if (inModal) openIncident(t, i.id);
      U.toast('Cảm ơn bạn đã đánh giá ' + i.rating + ' sao');
    }
  });

  loadSession();
})(window.APP);
