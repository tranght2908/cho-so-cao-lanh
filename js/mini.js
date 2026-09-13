/* Mini app tiểu thương (mô phỏng trong khung điện thoại). */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const mini = () => ui.mini;

  function sampleTraders() {
    const db = A.db, out = [];
    const add = t => { if (t && !out.includes(t)) out.push(t); };
    add(db.traders.find(t => t.market === 'CL' && t.app && U.traderOverdue(t.id) > 0));
    add(db.traders.find(t => t.market === 'CL' && t.app && U.traderDebt(t.id) > 0 && !U.traderOverdue(t.id)));
    add(db.traders.find(t => t.market === 'TTD' && U.traderDebt(t.id) > 0));
    db.traders.filter(t => t.stalls.length && U.traderDebt(t.id) > 0).slice(3, 8).forEach(add);
    add(db.traders.find(t => t.stalls.length && !U.traderDebt(t.id)));
    return out.filter(t => t.stalls.length);
  }
  function trader() {
    const m = mini();
    let t = m.traderId ? A.idx.trader.get(m.traderId) : null;
    if (!t || !t.stalls.length) { t = sampleTraders()[0]; m.traderId = t.id; }
    return t;
  }
  const unpaid = t => A.db.invoices.filter(i => i.traderId === t.id && i.status !== 'paid').sort((a, b) => a.due.localeCompare(b.due));

  function screenLogin(t) {
    const m = mini();
    if (m.step === 'login') return `<div class="m-body" style="justify-content:center;text-align:center">
      <div style="font-size:48px">🪷</div><h3 style="font-size:20px">Chợ số Cao Lãnh</h3><div class="small muted">Ứng dụng dành cho tiểu thương</div>
      <div class="field" style="text-align:left;margin-top:18px"><label>Số điện thoại</label><input class="input" style="padding:12px;font-size:16px" value="${t.phone}" readonly></div>
      <button class="m-btn solid" data-act="mini-otp">Nhận mã OTP</button>
      <div class="small muted">Đăng nhập bằng số điện thoại đã đăng ký với Ban Quản lý chợ</div></div>`;
    return `<div class="m-body" style="justify-content:center;text-align:center">
      <h3>Nhập mã xác thực</h3><div class="small muted">Mã OTP đã gửi tới ${U.maskPhone(t.phone)}</div>
      <div class="otp" style="margin:16px 0">${'246810'.split('').map(c => `<input value="${c}" readonly>`).join('')}</div>
      <div class="small muted">(Demo: mã tự điền sẵn)</div>
      <button class="m-btn solid" data-act="mini-login">Xác nhận</button></div>`;
  }

  function screenPay(t) {
    const m = mini(), list = unpaid(t), total = U.sum(list, U.due);
    if (m.pay === 'done') {
      const p = m.lastPays || [];
      return `<div class="m-body" style="text-align:center"><div style="font-size:54px;margin-top:20px">✅</div><h3>Thanh toán thành công</h3>
        <div class="m-card" style="text-align:left"><div class="m-list">
          <div class="it"><span class="muted">Số tiền</span><b>${U.money(U.sum(p, x => x.amount))}</b></div>
          <div class="it"><span class="muted">Biên lai</span><span>${p.map(x => x.receipt).join('<br>')}</span></div>
          <div class="it"><span class="muted">Mã tra cứu</span><b>${p[0] ? p[0].lookup : ''}</b></div>
          <div class="it"><span class="muted">Thời gian</span><span>${p[0] ? U.dmy(p[0].date) + ' ' + p[0].time : ''}</span></div></div></div>
        <div class="small muted">Biên lai điện tử đã lưu trong mục Hóa đơn và gửi qua Zalo OA</div>
        <button class="m-btn solid" data-act="mini-home">Về trang chủ</button></div>`;
    }
    const content = 'CHOSO ' + t.id;
    return `<div class="m-body"><button class="btn sm" style="align-self:flex-start" data-act="mini-home">‹ Quay lại</button>
      <div class="m-card" style="text-align:center"><div class="small muted">Quét mã bằng ứng dụng ngân hàng bất kỳ</div>
        <div style="margin:10px auto;width:190px">${U.qr(content + total, 190)}</div>
        <div style="font-size:22px;font-weight:800">${U.money(total)}</div><div class="small muted">Nội dung: ${content} · ${list.length} khoản</div></div>
      <div class="m-card small">${list.map(i => `<div class="row" style="padding:3px 0"><span style="flex:1">Kỳ ${U.per(i.period)} · ${A.idx.stall.get(i.stallId).code}</span><b>${U.money(U.due(i))}</b></div>`).join('')}</div>
      <button class="m-btn solid" data-act="mini-paid">Giả lập: đã chuyển khoản thành công</button></div>`;
  }

  function tabHome(t) {
    const list = unpaid(t), total = U.sum(list, U.due), over = list.filter(U.isOver);
    const c = A.db.contracts.find(x => x.traderId === t.id && x.status === 'hieuluc');
    const notis = notisFor(t).slice(0, 2);
    const mine = A.db.incidents.filter(i => i.traderId === t.id).slice(-2).reverse();
    return `<div class="m-card m-due"><div class="small" style="opacity:.85">Tổng cần thanh toán</div><div class="amt">${U.money(total)}</div>
        ${over.length ? `<div class="small" style="background:rgba(255,255,255,.15);padding:6px 10px;border-radius:8px;margin-bottom:10px">⚠ ${over.length} khoản quá hạn – vui lòng thanh toán sớm</div>` : ''}
        ${total ? '<button class="m-btn" data-act="mini-pay">Thanh toán bằng QR</button>' : '<div class="small">Bạn không có khoản nào cần thanh toán 🎉</div>'}</div>
      <div class="m-card"><b>Điểm kinh doanh</b><div class="m-list">${t.stalls.map(id => { const s = A.idx.stall.get(id); return `<div class="it"><span>${s.code} · ${U.esc(s.sectionName)}</span><span class="muted">${s.area.toLocaleString('vi-VN')} m²</span></div>`; }).join('')}
        ${c ? `<div class="it"><span class="muted">Hợp đồng đến</span><span>${U.dmy(c.end)} (${U.days(U.today(), c.end)} ngày)</span></div>` : ''}</div></div>
      <div class="m-card"><b>Thông báo mới</b><div class="m-list">${notis.map(n => `<div class="it"><span>${U.esc(n.title)}</span><span class="muted small">${U.dmy(n.at).slice(0, 5)}</span></div>`).join('') || '<div class="small muted">Chưa có</div>'}</div></div>
      ${mine.length ? `<div class="m-card"><b>Phản ánh của tôi</b><div class="m-list">${mine.map(i => `<div class="it"><span>${U.esc(i.title)}</span><span class="tag info">${D.INCIDENT_STATES.find(s => s.id === i.state).label}</span></div>`).join('')}</div></div>` : ''}`;
  }
  function tabBills(t) {
    const invs = A.db.invoices.filter(i => i.traderId === t.id).sort((a, b) => b.period.localeCompare(a.period)).slice(0, 8);
    const open = mini().bill;
    return `<div class="m-card"><b>Hóa đơn & biên lai</b><div class="m-list">${invs.map(i => `<div class="it" style="flex-wrap:wrap;cursor:pointer" data-act="mini-bill" data-id="${i.id}"><span>Kỳ ${U.per(i.period)}<div class="small muted">${A.idx.stall.get(i.stallId).code}</div></span><span style="text-align:right"><b>${U.money(i.amount)}</b><div>${U.invTag(i)}</div></span>
      ${open === i.id ? `<div style="width:100%;font-size:12px;background:#f5f8f7;border-radius:8px;padding:8px;margin-top:6px">${i.items.map(x => `<div class="row"><span style="flex:1">${x.name}</span><span>${U.money(x.amount)}</span></div>`).join('')}
        ${A.db.payments.filter(p => p.invoiceId === i.id).map(p => `<div class="muted" style="margin-top:4px">✓ ${p.receipt} · ${D.METHOD[p.method]} · ${U.dmy(p.date)}</div>`).join('')}</div>` : ''}</div>`).join('')}</div></div>`;
  }
  function tabContract(t) {
    return A.db.contracts.filter(c => c.traderId === t.id).map(c => {
      const s = A.idx.stall.get(c.stallId);
      return `<div class="m-card"><b>${c.kind}</b><div class="m-list">
        <div class="it"><span class="muted">Số</span><span>${c.id}</span></div><div class="it"><span class="muted">Điểm KD</span><span>${s.code} · ${s.area.toLocaleString('vi-VN')} m²</span></div>
        <div class="it"><span class="muted">Thời hạn</span><span>${U.dmy(c.start)} – ${U.dmy(c.end)}</span></div>
        <div class="it"><span class="muted">Đơn giá</span><span>${U.unitLabel(s)}</span></div>
        ${c.monthly ? `<div class="it"><span class="muted">Giá dịch vụ/tháng</span><b>${U.money(c.monthly)}</b></div>` : ''}
        <div class="it"><span class="muted">Trạng thái</span><span class="tag ${c.status === 'hieuluc' ? 'ok' : ''}">${c.status === 'hieuluc' ? 'Đang hiệu lực' : 'Đã thanh lý'}</span></div></div>
        <button class="m-btn" style="border:1px solid var(--line);margin-top:8px" data-act="mini-pdf">📄 Xem bản hợp đồng (PDF)</button></div>`;
    }).join('');
  }
  function notisFor(t) {
    const debt = U.traderOverdue(t.id) > 0, mk = U.market(t.market).short;
    return A.db.notifications.filter(n => n.group === 'Toàn bộ tiểu thương' || n.group === mk || n.group === 'Ngành hàng: ' + t.cat || (debt && n.group === 'Danh sách nợ phí'));
  }
  function tabNotice(t) {
    return `<div class="m-card"><b>Thông báo</b><div class="m-list">${notisFor(t).map(n => `<div class="it" style="flex-direction:column;gap:2px"><b style="font-weight:600">${U.esc(n.title)}</b><span class="small muted">${U.dmy(n.at)} · Ban Quản lý ${U.esc(U.market(t.market).name)}</span>${n.body ? `<span class="small">${U.esc(n.body)}</span>` : ''}</div>`).join('')}</div></div>`;
  }
  function tabReport(t) {
    const m = mini(), mine = A.db.incidents.filter(i => i.traderId === t.id).reverse();
    return `<div class="m-card"><b>Gửi phản ánh, kiến nghị</b>
      <div class="field" style="margin-top:8px"><label>Nhóm</label><select class="input" id="mr-cat">${['Điện', 'Cấp thoát nước', 'Vệ sinh', 'An ninh trật tự', 'PCCC', 'Hạ tầng', 'Khác'].map(c => `<option>${c}</option>`).join('')}</select></div>
      <div class="field" style="margin-top:8px"><label>Điểm kinh doanh</label><select class="input" id="mr-stall">${t.stalls.map(id => `<option value="${id}">${A.idx.stall.get(id).code}</option>`).join('')}</select></div>
      <div class="field" style="margin-top:8px"><label>Nội dung</label><textarea class="input" id="mr-text" rows="3">Đèn chiếu sáng trước quầy bị hỏng từ tối qua, nhờ Ban Quản lý kiểm tra.</textarea></div>
      <button class="btn" style="margin-top:8px" data-act="mini-attach">${m.attach ? '✓ Đã đính kèm 1 ảnh' : '📷 Chụp / đính kèm ảnh'}</button>
      <button class="m-btn solid" style="margin-top:10px" data-act="mini-report">Gửi phản ánh</button></div>
      ${mine.length ? `<div class="m-card"><b>Phản ánh đã gửi</b><div class="m-list">${mine.map(i => `<div class="it" style="flex-wrap:wrap"><span style="flex:1">${U.esc(i.title)}<div class="small muted">${i.id} · ${U.dmy(i.created)}</div></span><span class="tag info">${D.INCIDENT_STATES.find(s => s.id === i.state).label}</span>
        ${(i.state === 'hoanthanh' || i.state === 'dong') ? `<div class="stars" style="width:100%">${[1, 2, 3, 4, 5].map(n => `<button class="${i.rating >= n ? 'on' : ''}" data-act="mini-rate" data-id="${i.id}" data-n="${n}" aria-label="${n} sao">★</button>`).join('')}<span class="small muted">${i.rating ? 'Cảm ơn bạn đã đánh giá' : 'Đánh giá dịch vụ'}</span></div>` : ''}</div>`).join('')}</div></div>` : ''}`;
  }

  function phone(t) {
    const m = mini();
    const TABS = [['home', '🏠', 'Trang chủ'], ['bills', '🧾', 'Hóa đơn'], ['contract', '📄', 'Hợp đồng'], ['notice', '🔔', 'Thông báo'], ['report', '💬', 'Phản ánh']];
    let body;
    if (m.step !== 'app') body = screenLogin(t);
    else if (m.pay) body = screenPay(t);
    else {
      const f = { home: tabHome, bills: tabBills, contract: tabContract, notice: tabNotice, report: tabReport }[m.tab];
      body = `<div class="m-head"><div class="hi">Xin chào,</div><div class="nm">${U.esc(t.name)}</div><div class="hi">${U.esc(U.market(t.market).short)}</div></div><div class="m-body">${f(t)}</div>
        <div class="m-tabs">${TABS.map(x => `<button class="${m.tab === x[0] ? 'on' : ''}" data-act="mini-tab" data-id="${x[0]}"><span class="i">${x[1]}</span>${x[2]}</button>`).join('')}</div>`;
    }
    return `<div class="phone"><div class="screen"><div class="notch"><span>9:41</span><span>▮▮▮ 4G 🔋</span></div>${body}</div></div>`;
  }

  A.VIEWS['mini-app'] = function () {
    const t = trader(), list = sampleTraders();
    return `<div class="mini-wrap"><div>${phone(t)}</div>
      <div class="grid" style="align-content:start">
        <div class="card"><div class="card-h"><h3>Mini app tiểu thương</h3></div><div class="card-b">
          <p class="muted" style="margin-top:0">Ứng dụng cho iOS 14+ và Android 10+ (hoặc mini app trên Zalo). Tiểu thương đăng nhập bằng số điện thoại và mã OTP.</p>
          <div class="field"><label>Xem với tư cách tiểu thương mẫu</label><select class="input" data-ch="mini-trader">${list.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${U.esc(x.name)} · ${x.stalls.map(id => A.idx.stall.get(id).code).join(', ')} · ${U.mShort(x.market)}${U.traderDebt(x.id) ? ' · nợ ' + U.moneyShort(U.traderDebt(x.id)) : ''}</option>`).join('')}</select></div>
          ${mini().step === 'app' ? '<button class="btn" style="margin-top:10px" data-act="mini-logout">Đăng xuất</button>' : ''}</div></div>
        <div class="card"><div class="card-h"><h3>Kịch bản demo</h3></div><div class="card-b"><ol class="script">
          <li><div>Bấm <b>Nhận mã OTP</b> → <b>Xác nhận</b> để đăng nhập.</div></li>
          <li><div>Ở Trang chủ, bấm <b>Thanh toán bằng QR</b> → <b>Giả lập: đã chuyển khoản</b>. Hệ thống ghi nhận, phát hành biên lai điện tử, cập nhật công nợ.</div></li>
          <li><div>Mở tab <b>Phản ánh</b>, đính kèm ảnh và <b>Gửi phản ánh</b>.</div></li>
          <li><div>Đổi vai trò sang <b>Ban Quản lý chợ</b> → <b>Phản ánh & sự cố</b>: phản ánh mới nằm ở cột "Tiếp nhận". Chuyển đến "Hoàn thành" rồi quay lại đây để <b>đánh giá sao</b>.</div></li>
        </ol></div></div>
        <div class="note info">Mục tiêu theo BCKTKT: ≥ 70% tiểu thương cài đặt và sử dụng sau 06 tháng; mức độ hài lòng ≥ 4/5.</div>
      </div></div>`;
  };

  A.CH['mini-trader'] = el => { Object.assign(mini(), { traderId: el.value, step: 'login', tab: 'home', pay: null, bill: null, attach: false }); A.render(); };
  Object.assign(A.ACT, {
    'mini-otp': () => { mini().step = 'otp'; A.render(); },
    'mini-login': () => { mini().step = 'app'; mini().tab = 'home'; A.render(); },
    'mini-logout': () => { Object.assign(mini(), { step: 'login', pay: null, tab: 'home' }); A.render(); },
    'mini-tab': el => { mini().tab = el.dataset.id; mini().bill = null; A.render(); },
    'mini-home': () => { mini().pay = null; mini().tab = 'home'; A.render(); },
    'mini-pay': () => { mini().pay = 'qr'; A.render(); },
    'mini-paid': () => {
      const t = trader(), list = unpaid(t);
      const pays = A.applyPayment(list.map(i => i.id), U.sum(list, U.due), 'qr', 'Mini app');
      mini().lastPays = pays; mini().pay = 'done'; A.render();
      U.toast('Ngân hàng báo có · hệ thống tự ghi nhận ' + U.money(U.sum(pays, p => p.amount)));
    },
    'mini-bill': el => { mini().bill = mini().bill === el.dataset.id ? null : el.dataset.id; A.render(); },
    'mini-pdf': () => U.toast('Mở bản số hóa hợp đồng (PDF) – minh họa'),
    'mini-attach': () => { mini().attach = !mini().attach; A.render(); },
    'mini-report': () => {
      const text = A.$('#mr-text').value.trim();
      if (!text) { U.toast('Vui lòng nhập nội dung'); return; }
      const title = text.length > 60 ? text.slice(0, 57) + '…' : text;
      const i = A.addIncident(A.$('#mr-stall').value, A.$('#mr-cat').value, title, text, 'Mini app tiểu thương', mini().attach);
      mini().attach = false; A.render();
      U.toast('Đã gửi ' + i.id + '. Ban Quản lý sẽ phản hồi trong 24 giờ.');
    },
    'mini-rate': el => {
      const i = A.db.incidents.find(x => x.id === el.dataset.id);
      i.rating = Number(el.dataset.n);
      if (i.state === 'hoanthanh') i.state = 'dong';
      i.log.push({ at: U.today(), text: 'Tiểu thương đánh giá ' + i.rating + ' sao' });
      A.save(); A.render(); U.toast('Cảm ơn bạn đã đánh giá ' + i.rating + ' sao');
    }
  });
})(window.APP);
