/* Màn hình tài chính: Chỉ số điện nước, Khoản phải thu, Thu tiền, Đối soát, Công nợ. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const f = ui.f;

  // ---------- Chỉ số điện, nước ----------
  const abnormal = r => r.elecCur != null && (r.elecCur - r.elecPrev) > r.elecAvg * 1.5;
  A.VIEWS['dien-nuoc'] = function () {
    const all = A.db.readings.filter(r => U.inM(A.idx.stall.get(r.stallId)));
    if (!all.length) return '<div class="card"><div class="empty">Chợ quê không có đồng hồ điện, nước riêng cho quầy.</div></div>';
    const done = all.filter(r => r.elecCur != null).length, abn = all.filter(abnormal).length;
    const rows = all.filter(r => ui.readingsFilter === 'all' || (ui.readingsFilter === 'todo' ? r.elecCur == null : abnormal(r)));
    const pg = U.pager('dn' + ui.readingsFilter, rows.length, 20);
    return `<div class="kpis">
      <div class="card kpi"><div class="k-label">Kỳ ghi chỉ số</div><div class="k-value">09/2026</div><div class="k-sub">Chốt ngày 10 hằng tháng</div></div>
      <div class="card kpi"><div class="k-label">Đã ghi</div><div class="k-value">${done}/${all.length}</div><div class="bar-mini"><i style="width:${U.pct(done, all.length)}%"></i></div></div>
      <div class="card kpi"><div class="k-label">Tăng bất thường</div><div class="k-value" style="color:#d6453b">${abn}</div><div class="k-sub">> 150% trung bình 3 kỳ</div></div>
      <div class="card kpi"><div class="k-label">Đơn giá mẫu</div><div class="k-value" style="font-size:17px">${U.money(D.ELEC)}/kWh</div><div class="k-sub">Nước ${U.money(D.WATER)}/m³</div></div></div>
    <div class="card"><div class="card-h"><h3>Ghi chỉ số điện, nước</h3>
      <div class="seg">${[['all', 'Tất cả'], ['todo', 'Chưa ghi'], ['abn', 'Bất thường']].map(x => `<button class="${ui.readingsFilter === x[0] ? 'on' : ''}" data-act="dn-filter" data-id="${x[0]}">${x[1]}</button>`).join('')}</div></div>
      <div class="card-b">${U.table([{ t: 'Điểm KD' }, { t: 'Tiểu thương' }, { t: 'Điện: cũ', num: true }, { t: 'Điện: mới' }, { t: 'kWh', num: true }, { t: 'Nước: cũ', num: true }, { t: 'Nước: mới' }, { t: 'm³', num: true }, { t: 'Ảnh đồng hồ' }, { t: '' }],
        rows.slice(pg.start, pg.end).map(r => {
          const st = A.idx.stall.get(r.stallId), t = A.idx.trader.get(st.traderId);
          const ec = r.elecCur != null ? r.elecCur - r.elecPrev : null, wc = r.waterCur != null ? r.waterCur - r.waterPrev : null;
          return `<tr><td><b>${st.code}</b></td><td>${U.esc(t ? t.name : '')}</td><td class="num">${r.elecPrev}</td>
            <td><input class="input" style="width:88px" type="number" data-ch="reading" data-id="${r.stallId}" data-k="elecCur" value="${r.elecCur == null ? '' : r.elecCur}" placeholder="Nhập"></td>
            <td class="num">${ec == null ? '–' : ec}</td><td class="num">${r.waterPrev}</td>
            <td><input class="input" style="width:78px" type="number" data-ch="reading" data-id="${r.stallId}" data-k="waterCur" value="${r.waterCur == null ? '' : r.waterCur}" placeholder="Nhập"></td>
            <td class="num">${wc == null ? '–' : wc}</td>
            <td>${r.photo ? '<span class="tag ok">📷 Đã chụp</span>' : `<button class="btn sm" data-act="dn-photo" data-id="${r.stallId}">📷 Chụp</button>`}</td>
            <td>${abnormal(r) ? `<span class="tag danger" title="TB 3 kỳ: ${r.elecAvg} kWh">⚠ Gấp ${(ec / r.elecAvg).toFixed(1)} lần TB</span>` : ''}</td></tr>`;
        }))}${pg.html}
        <div class="small muted" style="margin-top:8px">Nhân viên nhập trên máy tính hoặc điện thoại tại chợ. Sản lượng được dùng để tự động phát hành khoản phải thu kỳ sau.</div></div></div>`;
  };
  A.ACT['dn-filter'] = el => { ui.readingsFilter = el.dataset.id; A.render(); };
  A.ACT['dn-photo'] = el => { const r = A.db.readings.find(x => x.stallId === el.dataset.id); r.photo = true; A.save(); A.render(); U.toast('Đã đính kèm ảnh đồng hồ (giả lập)'); };
  A.CH.reading = el => {
    const r = A.db.readings.find(x => x.stallId === el.dataset.id), k = el.dataset.k, v = el.value === '' ? null : Number(el.value);
    const prev = k === 'elecCur' ? r.elecPrev : r.waterPrev;
    if (v != null && v < prev) { U.toast('Chỉ số mới không được nhỏ hơn chỉ số cũ (' + prev + ')'); A.render(); return; }
    r[k] = v; r.by = 'NV05';
    A.save(); A.render();
    if (k === 'elecCur' && abnormal(r)) U.toast('⚠ Chỉ số điện ' + A.idx.stall.get(r.stallId).code + ' tăng bất thường – đề nghị kiểm tra đồng hồ');
  };

  // ---------- Khoản phải thu ----------
  A.VIEWS['phai-thu'] = function () {
    const periods = A.db.issuedPeriods, p = ui.period;
    const q = (f.ptSearch || '').toLowerCase();
    const inv = A.db.invoices.filter(i => U.inM(i) && i.period === p);
    const rows = inv.filter(i => (!f.ptStatus || (f.ptStatus === 'over' ? U.isOver(i) : i.status === f.ptStatus))
      && (!q || i.id.toLowerCase().includes(q) || A.idx.trader.get(i.traderId).name.toLowerCase().includes(q) || A.idx.stall.get(i.stallId).code.toLowerCase().includes(q)));
    const pg = U.pager('pt' + p, rows.length, 25);
    const amt = U.sum(inv, i => i.amount), paid = U.sum(inv, i => i.paid);
    const next = periods.includes('2026-10') ? null : '2026-10';
    return `<div class="card"><div class="card-b row" style="padding-top:14px">
      <span class="label-sm">Kỳ thu</span><div class="seg">${periods.map(x => `<button class="${x === p ? 'on' : ''}" data-act="pt-period" data-id="${x}">${U.per(x)}</button>`).join('')}</div>
      <span class="spacer"></span>${next ? `<button class="btn primary" data-act="pt-issue">⚙ Phát hành tự động kỳ 10/2026</button>` : '<span class="tag ok">Đã phát hành kỳ 10/2026</span>'}</div></div>
    <div class="kpis">
      <div class="card kpi"><div class="k-label">Số khoản phải thu</div><div class="k-value">${inv.length}</div><div class="k-sub">Tạo tự động từ hợp đồng, đơn giá, chỉ số điện nước</div></div>
      <div class="card kpi"><div class="k-label">Tổng phải thu</div><div class="k-value">${U.moneyShort(amt)}</div><div class="k-sub">${U.money(amt)}</div></div>
      <div class="card kpi"><div class="k-label">Đã thu</div><div class="k-value">${U.moneyShort(paid)}</div><div class="bar-mini"><i style="width:${U.pct(paid, amt)}%"></i></div></div>
      <div class="card kpi"><div class="k-label">Còn phải thu</div><div class="k-value" style="color:#d6453b">${U.moneyShort(amt - paid)}</div><div class="k-sub">Tỷ lệ thu ${U.pctTxt(U.pct(paid, amt))}</div></div></div>
    <div class="card"><div class="card-h"><h3>Danh sách khoản phải thu kỳ ${U.per(p)}</h3>
      <select class="input" data-ch="pt-status"><option value="">Mọi trạng thái</option><option value="paid" ${f.ptStatus === 'paid' ? 'selected' : ''}>Đã thu</option><option value="unpaid" ${f.ptStatus === 'unpaid' ? 'selected' : ''}>Chưa thu</option><option value="partial" ${f.ptStatus === 'partial' ? 'selected' : ''}>Thu một phần</option><option value="over" ${f.ptStatus === 'over' ? 'selected' : ''}>Quá hạn</option></select>
      <input class="input" placeholder="Mã khoản, tiểu thương, mã điểm" data-in="pt-search" value="${U.esc(f.ptSearch || '')}"></div>
      <div class="card-b">${U.table([{ t: 'Mã khoản' }, { t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Số tiền', num: true }, { t: 'Đã thu', num: true }, { t: 'Hạn nộp' }, { t: 'Trạng thái' }],
        rows.slice(pg.start, pg.end).map(i => `<tr class="click" data-act="inv-open" data-id="${i.id}"><td>${i.id}${i.adjust ? ' <span class="tag purple">Miễn giảm</span>' : ''}</td><td>${U.esc(A.idx.trader.get(i.traderId).name)}</td><td>${A.idx.stall.get(i.stallId).code}</td>
          <td class="num">${U.money(i.amount)}</td><td class="num">${U.money(i.paid)}</td><td>${U.dmy(i.due)}</td><td>${U.invTag(i)}</td></tr>`))}${pg.html}</div></div>`;
  };
  A.ACT['pt-period'] = el => { ui.period = el.dataset.id; A.render(); };
  A.CH['pt-status'] = el => { f.ptStatus = el.value; A.render(); };
  A.IN['pt-search'] = el => { f.ptSearch = el.value; A.render(); };
  A.ACT['pt-issue'] = () => {
    const db = A.db, out = [];
    db.contracts.filter(c => c.status === 'hieuluc').forEach(c => {
      const st = A.idx.stall.get(c.stallId);
      if (st.status === 'ngung' || st.status === 'trong') return;
      const items = [];
      if (st.market === 'TTD') items.push({ name: 'Phí quầy theo phiên (5 phiên × ' + D.SESSION_FEE.toLocaleString('vi-VN') + ' đ)', amount: 5 * D.SESSION_FEE });
      else {
        items.push({ name: 'Giá dịch vụ sử dụng diện tích bán hàng (' + st.area + ' m² × ' + c.unit.toLocaleString('vi-VN') + ' đ × 30 ngày)', amount: c.monthly });
        const r = db.readings.find(x => x.stallId === st.id);
        if (r) {
          const kwh = r.elecCur != null ? r.elecCur - r.elecPrev : r.elecAvg, m3 = r.waterCur != null ? r.waterCur - r.waterPrev : r.waterAvg;
          items.push({ name: 'Tiền điện (' + kwh + ' kWh × ' + D.ELEC.toLocaleString('vi-VN') + ' đ)' + (r.elecCur == null ? ' – tạm tính theo TB' : ''), amount: kwh * D.ELEC });
          items.push({ name: 'Tiền nước (' + m3 + ' m³ × ' + D.WATER.toLocaleString('vi-VN') + ' đ)' + (r.waterCur == null ? ' – tạm tính theo TB' : ''), amount: m3 * D.WATER });
        }
      }
      const inv = { id: 'PT-202610-' + U.pad(db.invoices.length + 1, 5), period: '2026-10', market: c.market, stallId: st.id, traderId: c.traderId, contractId: c.id, items, amount: U.sum(items, x => x.amount), paid: 0, issued: '2026-10-01', due: '2026-10-15', status: 'unpaid', adjust: null, reminders: 0 };
      db.invoices.push(inv); A.idx.invoice.set(inv.id, inv); out.push(inv);
    });
    db.issuedPeriods.push('2026-10');
    db.notifications.unshift({ id: 'TB-' + U.pad(32 + db.notifications.length, 3), at: U.today(), title: 'Phát hành khoản phải thu kỳ 10/2026', group: 'Toàn bộ tiểu thương', channels: ['Mini app', 'Zalo OA'], sent: out.length, delivered: 0.97, read: 0, auto: true });
    U.log('Phát hành tự động ' + out.length + ' khoản phải thu kỳ 10/2026');
    ui.period = '2026-10'; A.save(); A.render();
    U.toast(`Đã phát hành ${out.length} khoản phải thu kỳ 10/2026 (${U.moneyShort(U.sum(out, x => x.amount))}) và gửi thông báo cho tiểu thương`);
  };
  A.ACT['inv-open'] = el => {
    const i = A.idx.invoice.get(el.dataset.id), t = A.idx.trader.get(i.traderId);
    const pays = A.db.payments.filter(p => p.invoiceId === i.id);
    A.modal(A.mHead('Khoản phải thu ' + i.id) + `<div class="modal-b">
      <dl class="kv"><dt>Tiểu thương</dt><dd>${U.esc(t.name)} (${t.id})</dd><dt>Điểm KD</dt><dd>${A.idx.stall.get(i.stallId).code} · ${U.mShort(i.market)}</dd>
        <dt>Kỳ / hạn nộp</dt><dd>${U.per(i.period)} · hạn ${U.dmy(i.due)}</dd><dt>Trạng thái</dt><dd>${U.invTag(i)}</dd></dl><div class="divider"></div>
      ${U.table([{ t: 'Nội dung' }, { t: 'Số tiền', num: true }], i.items.map(x => `<tr><td>${x.name}</td><td class="num">${U.money(x.amount)}</td></tr>`)
        .concat(i.adjust ? [`<tr><td>Miễn giảm ${i.adjust.pct}% (${U.esc(i.adjust.reason)}) – đã phê duyệt</td><td class="num">−${U.money(i.adjust.value)}</td></tr>`] : [])
        .concat([`<tr><td><b>Tổng cộng</b></td><td class="num"><b>${U.money(i.amount)}</b></td></tr>`]))}
      ${pays.length ? '<div class="divider"></div><b>Thanh toán</b>' + U.table([{ t: 'Biên lai' }, { t: 'Ngày' }, { t: 'Hình thức' }, { t: 'Số tiền', num: true }], pays.map(p => `<tr class="click" data-act="receipt" data-id="${p.receipt}"><td>${p.receipt}</td><td>${U.dmy(p.date)} ${p.time}</td><td>${D.METHOD[p.method]}</td><td class="num">${U.money(p.amount)}</td></tr>`)) : ''}
      </div><div class="modal-f">
      ${i.status !== 'paid' && !i.adjust && A.PERM.canAction(ui.role, 'phai-thu.mien-giam') ? `<button class="btn" data-act="inv-adjust" data-id="${i.id}">Miễn giảm / điều chỉnh</button>` : ''}
      ${i.status !== 'paid' && A.PERM.canAction(ui.role, 'thu-tien.thu') ? `<button class="btn primary" data-act="pay-open" data-id="${i.traderId}" data-inv="${i.id}">💳 Thu tiền</button>` : ''}
      <button class="btn" data-act="close">Đóng</button></div>`, true);
  };
  A.ACT['inv-adjust'] = el => {
    const i = A.idx.invoice.get(el.dataset.id);
    A.modal(A.mHead('Miễn giảm ' + i.id) + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Mức miễn giảm</label><select class="input" id="adj-pct"><option>10</option><option>30</option><option selected>50</option><option>100</option></select></div>
      <div class="field"><label>Lý do</label><input class="input" id="adj-reason" value="Sửa chữa hạ tầng khu vực, tạm ngừng kinh doanh"></div></div>
      <div class="note" style="margin-top:12px">Quy trình: nhân viên đề xuất → Trưởng Ban Quản lý phê duyệt → hệ thống điều chỉnh khoản phải thu và ghi nhật ký. (Prototype: phê duyệt ngay)</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inv-adjust-save" data-id="${i.id}">Gửi & phê duyệt</button></div>`);
  };
  A.ACT['inv-adjust-save'] = el => {
    const i = A.idx.invoice.get(el.dataset.id), pctv = Number(A.$('#adj-pct').value), reason = A.$('#adj-reason').value.trim() || 'Không ghi';
    const base = i.items[0].amount, value = Math.round(base * pctv / 100 / 1000) * 1000;
    i.adjust = { pct: pctv, reason, value }; i.amount = Math.max(i.paid, i.amount - value);
    if (i.paid >= i.amount) i.status = 'paid';
    A.refreshStall(A.idx.stall.get(i.stallId));
    U.log(`Phê duyệt miễn giảm ${pctv}% khoản ${i.id} (${reason})`);
    A.save(); A.closeModal(); A.render(); U.toast('Đã phê duyệt miễn giảm ' + U.money(value));
  };

  // ---------- Thu tiền ----------
  function renderPay() {
    const ps = ui.pay, t = A.idx.trader.get(ps.traderId);
    const invs = A.db.invoices.filter(i => i.traderId === t.id && i.status !== 'paid').sort((a, b) => a.due.localeCompare(b.due));
    const total = U.sum(invs.filter(i => ps.sel.includes(i.id)), U.due);
    const amount = ps.amount == null ? total : Math.min(ps.amount, total);
    const content = 'CHOSO ' + t.id + ' ' + (invs.find(i => ps.sel.includes(i.id)) || { id: '' }).id;
    A.modal(A.mHead('Thu tiền · ' + U.esc(t.name)) + `<div class="modal-b">
      ${U.table([{ t: '' }, { t: 'Khoản' }, { t: 'Kỳ' }, { t: 'Điểm KD' }, { t: 'Hạn' }, { t: 'Còn phải thu', num: true }],
        invs.map(i => `<tr><td><input type="checkbox" data-ch="pay-sel" data-id="${i.id}" ${ps.sel.includes(i.id) ? 'checked' : ''}></td><td>${i.id}</td><td>${U.per(i.period)}</td><td>${A.idx.stall.get(i.stallId).code}</td><td>${U.isOver(i) ? `<span class="tag danger">${U.dmy(i.due)}</span>` : U.dmy(i.due)}</td><td class="num">${U.money(U.due(i))}</td></tr>`), { empty: 'Không còn khoản nào phải thu' })}
      <div class="form-grid" style="margin-top:14px">
        <div class="field"><label>Số tiền thu (có thể thu một phần)</label><input class="input" type="number" data-ch="pay-amount" value="${amount}"></div>
        <div class="field"><label>Tổng các khoản đã chọn</label><input class="input" value="${U.money(total)}" disabled></div></div>
      <div class="pay-methods" style="margin-top:14px">${['qr', 'ck', 'tm'].map(m => `<label><input type="radio" name="pm" data-ch="pay-method" value="${m}" ${ps.method === m ? 'checked' : ''}><span>${{ qr: '📱 ', ck: '🏦 ', tm: '💵 ' }[m]}${D.METHOD[m]}</span></label>`).join('')}</div>
      ${ps.method === 'qr' ? `<div class="qr-box">${U.qr(content + amount)}<div class="small"><b>Mã QR thanh toán (minh họa)</b><br>Ngân hàng: (kết nối khi triển khai)<br>Tài khoản: BQL ${U.esc(U.market(t.market).name)}<br>Số tiền: <b>${U.money(amount)}</b><br>Nội dung: <b>${content}</b><br><span class="muted">Hệ thống tự ghi nhận khi ngân hàng báo có.</span></div></div>` : ''}
      ${ps.method === 'ck' ? '<div class="note info" style="margin-top:12px">Ghi nhận khoản chuyển khoản đã nhận; hệ thống sẽ đối chiếu với sao kê ngân hàng.</div>' : ''}
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button>
      <button class="btn primary" data-act="pay-confirm" ${amount > 0 ? '' : 'disabled'}>${ps.method === 'qr' ? 'Giả lập: tiểu thương đã quét mã và chuyển tiền' : 'Xác nhận thu & phát hành biên lai'}</button></div>`, true);
  }
  A.ACT['pay-open'] = el => {
    const tid = el.dataset.id;
    const invs = A.db.invoices.filter(i => i.traderId === tid && i.status !== 'paid');
    ui.pay = { traderId: tid, sel: el.dataset.inv ? [el.dataset.inv] : invs.map(i => i.id), method: 'qr', amount: null };
    renderPay();
  };
  A.CH['pay-sel'] = el => { const s = ui.pay.sel, id = el.dataset.id; ui.pay.sel = el.checked ? s.concat([id]) : s.filter(x => x !== id); ui.pay.amount = null; renderPay(); };
  A.CH['pay-amount'] = el => { ui.pay.amount = Math.max(0, Number(el.value) || 0); renderPay(); };
  A.CH['pay-method'] = el => { ui.pay.method = el.value; renderPay(); };
  A.ACT['pay-confirm'] = () => {
    const ps = ui.pay;
    const total = U.sum(A.db.invoices.filter(i => ps.sel.includes(i.id)), U.due);
    const amount = ps.amount == null ? total : Math.min(ps.amount, total);
    const pays = A.applyPayment(ps.sel, amount, ps.method, ps.method === 'tm' ? 'NV03' : 'Hệ thống');
    A.render(); A.showReceipt(pays);
    U.toast('Đã thu ' + U.money(amount) + ' · biên lai điện tử đã gửi tới tiểu thương');
  };

  A.VIEWS['thu-tien'] = function () {
    const q = (f.thuSearch || '').toLowerCase();
    const debtors = new Map();
    A.db.invoices.filter(i => U.inM(i) && i.status !== 'paid').forEach(i => {
      const d = debtors.get(i.traderId) || { n: 0, amt: 0, over: 0 };
      d.n++; d.amt += U.due(i); if (U.isOver(i)) d.over += U.due(i);
      debtors.set(i.traderId, d);
    });
    let list = Array.from(debtors.entries()).map(([id, d]) => Object.assign({ t: A.idx.trader.get(id) }, d))
      .filter(x => !q || x.t.name.toLowerCase().includes(q) || x.t.phone.includes(q) || x.t.stalls.some(id => A.idx.stall.get(id).code.toLowerCase().includes(q)))
      .sort((a, b) => b.over - a.over || b.amt - a.amt);
    const pg = U.pager('thu', list.length, 12);
    const today = A.db.payments.filter(p => U.inM(p) && p.date === U.today()).slice().reverse();
    const cash = U.sum(today.filter(p => p.method === 'tm'), p => p.amount), non = U.sum(today.filter(p => p.method !== 'tm'), p => p.amount);
    return `<div class="grid g-main" style="align-items:start">
      <div class="card"><div class="card-h"><h3>Tìm tiểu thương cần thu</h3><input class="input" style="width:260px" placeholder="Tên, SĐT hoặc mã điểm (VD: HS-A05)" data-in="thu-search" value="${U.esc(f.thuSearch || '')}"></div>
        <div class="card-b">${U.table([{ t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Số khoản', num: true }, { t: 'Còn phải thu', num: true }, { t: 'Quá hạn', num: true }, { t: '' }],
          list.slice(pg.start, pg.end).map(x => `<tr><td><b>${U.esc(x.t.name)}</b><div class="small muted">${x.t.id} · ${U.maskPhone(x.t.phone)}</div></td><td>${x.t.stalls.map(id => A.idx.stall.get(id).code).join(', ')}</td><td class="num">${x.n}</td><td class="num">${U.money(x.amt)}</td><td class="num" style="${x.over ? 'color:#d6453b;font-weight:600' : ''}">${x.over ? U.money(x.over) : '–'}</td><td><button class="btn sm primary" data-act="pay-open" data-id="${x.t.id}">Thu tiền</button></td></tr>`))}${pg.html}</div></div>
      <div class="card"><div class="card-h"><h3>Giao dịch hôm nay ${U.dmy(U.today())}</h3></div><div class="card-b">
        <div class="row small" style="margin-bottom:8px"><span class="tag">💵 Tiền mặt ${U.moneyShort(cash)}</span><span class="tag info">📱 QR/CK ${U.moneyShort(non)}</span></div>
        ${today.length ? today.slice(0, 14).map(p => `<div class="row small click" style="padding:7px 0;border-bottom:1px solid #eef2f0;cursor:pointer" data-act="receipt" data-id="${p.receipt}"><span class="muted">${p.time}</span><span style="flex:1">${U.esc(A.idx.trader.get(p.traderId).name)}<div class="muted">${p.receipt} · ${D.METHOD[p.method]}</div></span><b>${U.money(p.amount)}</b></div>`).join('') : '<div class="empty">Chưa có giao dịch</div>'}
      </div></div></div>`;
  };
  A.IN['thu-search'] = el => { f.thuSearch = el.value; ui.page.thu = 0; A.render(); };

  // ---------- Đối soát ----------
  A.VIEWS['doi-soat'] = function () {
    const bank = A.db.bank, matched = bank.filter(b => b.matched).length;
    const cashPays = A.db.payments.filter(p => p.date === U.today() && p.method === 'tm');
    const byStaff = {};
    cashPays.forEach(p => { const s = byStaff[p.by] || (byStaff[p.by] = { n: 0, amt: 0 }); s.n++; s.amt += p.amount; });
    return `<div class="kpis">
      <div class="card kpi"><div class="k-label">Giao dịch trên sao kê ${U.dmy(U.today())}</div><div class="k-value">${bank.length}</div><div class="k-sub">${U.money(U.sum(bank, b => b.amount))}</div></div>
      <div class="card kpi"><div class="k-label">Khớp tự động</div><div class="k-value">${U.pctTxt(U.pct(matched, bank.length))}</div><div class="k-sub">${matched}/${bank.length} giao dịch QR, chuyển khoản</div></div>
      <div class="card kpi"><div class="k-label">Chưa khớp</div><div class="k-value" style="color:${bank.length - matched ? '#d6453b' : '#2e9e6a'}">${bank.length - matched}</div><div class="k-sub">Cần gán thủ công</div></div>
      <div class="card kpi"><div class="k-label">Tiền mặt nhân viên thu</div><div class="k-value">${U.moneyShort(U.sum(cashPays, p => p.amount))}</div><div class="k-sub">${cashPays.length} biên lai</div></div></div>
    <div class="grid g-main" style="align-items:start">
      <div class="card"><div class="card-h"><h3>Sao kê ngân hàng – tài khoản thu của Ban Quản lý</h3><button class="btn" data-act="ds-csv">⬇ Xuất Excel</button></div><div class="card-b">
        ${U.table([{ t: 'Giờ' }, { t: 'Mã SK' }, { t: 'Nội dung chuyển khoản' }, { t: 'Số tiền', num: true }, { t: 'Khớp với' }, { t: '' }],
          bank.slice().reverse().map(b => { const p = b.paymentId ? A.db.payments.find(x => x.id === b.paymentId) : null;
            return `<tr><td>${b.time}</td><td>${b.id}</td><td class="small">${U.esc(b.ref)}</td><td class="num">${U.money(b.amount)}</td>
              <td class="small">${p ? `<a href="#" data-act="receipt" data-id="${p.receipt}">${p.receipt}</a> · ${U.esc(A.idx.trader.get(p.traderId).name)}` : '–'}</td>
              <td>${b.matched ? '<span class="tag ok">✓ Đã khớp</span>' : `<button class="btn sm accent" data-act="ds-match" data-id="${b.id}">Gán khoản thu</button>`}</td></tr>`; }))}</div></div>
      <div class="card"><div class="card-h"><h3>Tiền mặt theo nhân viên thu</h3></div><div class="card-b">
        ${U.table([{ t: 'Nhân viên' }, { t: 'Biên lai', num: true }, { t: 'Số tiền', num: true }, { t: 'Nộp quỹ' }],
          Object.keys(byStaff).map(k => `<tr><td>${U.esc(U.staffName(k))}</td><td class="num">${byStaff[k].n}</td><td class="num">${U.money(byStaff[k].amt)}</td><td><span class="tag warn">Chờ nộp</span></td></tr>`), { empty: 'Hôm nay chưa thu tiền mặt' })}
        <div class="small muted" style="margin-top:10px">Cuối ngày, kế toán đối chiếu số biên lai tiền mặt với số tiền nhân viên nộp quỹ.</div></div></div></div>`;
  };
  A.ACT['ds-csv'] = () => U.csv('doi-soat-' + U.today(), ['Giờ', 'Mã sao kê', 'Nội dung', 'Số tiền', 'Biên lai', 'Trạng thái'], A.db.bank.map(b => { const p = b.paymentId ? A.db.payments.find(x => x.id === b.paymentId) : null; return [b.time, b.id, b.ref, b.amount, p ? p.receipt : '', b.matched ? 'Đã khớp' : 'Chưa khớp']; }));
  A.ACT['ds-match'] = el => {
    const b = A.db.bank.find(x => x.id === el.dataset.id);
    const cands = A.db.invoices.filter(i => i.status !== 'paid').sort((x, y) => Math.abs(U.due(x) - b.amount) - Math.abs(U.due(y) - b.amount)).slice(0, 8);
    A.modal(A.mHead('Gán giao dịch ' + b.id) + `<div class="modal-b"><p>Nội dung: <b>${U.esc(b.ref)}</b> · Số tiền <b>${U.money(b.amount)}</b>. Hệ thống gợi ý các khoản có số tiền gần nhất:</p>
      ${U.table([{ t: 'Khoản' }, { t: 'Tiểu thương' }, { t: 'Kỳ' }, { t: 'Còn phải thu', num: true }, { t: '' }], cands.map(i => `<tr><td>${i.id}</td><td>${U.esc(A.idx.trader.get(i.traderId).name)}</td><td>${U.per(i.period)}</td><td class="num">${U.money(U.due(i))}</td><td><button class="btn sm primary" data-act="ds-match-save" data-id="${b.id}" data-inv="${i.id}">Chọn</button></td></tr>`))}</div>`, true);
  };
  A.ACT['ds-match-save'] = el => {
    const b = A.db.bank.find(x => x.id === el.dataset.id), inv = A.idx.invoice.get(el.dataset.inv);
    const before = A.db.bank.length;
    const pays = A.applyPayment([inv.id], Math.min(b.amount, U.due(inv)), 'ck', 'Hệ thống');
    A.db.bank.length = before; // giao dịch đã có trên sao kê, không thêm dòng mới
    b.matched = true; b.paymentId = pays[0] ? pays[0].id : null;
    U.log(`Gán thủ công giao dịch ${b.id} cho khoản ${inv.id}`);
    A.save(); A.closeModal(); A.render(); U.toast('Đã đối soát ' + b.id + ' với ' + inv.id);
  };

  // ---------- Công nợ ----------
  A.VIEWS['cong-no'] = function () {
    const over = A.db.invoices.filter(i => U.inM(i) && U.isOver(i));
    const buckets = [['1–30 ngày', 1, 30], ['31–60 ngày', 31, 60], ['61–90 ngày', 61, 90], ['Trên 90 ngày', 91, 9999]].map(b => {
      const xs = over.filter(i => U.overDays(i) >= b[1] && U.overDays(i) <= b[2]);
      return { label: b[0], amt: U.sum(xs, U.due), n: new Set(xs.map(i => i.traderId)).size };
    });
    const maxAmt = Math.max.apply(null, buckets.map(b => b.amt).concat([1]));
    const map = new Map();
    over.forEach(i => { const d = map.get(i.traderId) || { n: 0, amt: 0, days: 0, rem: 0 }; d.n++; d.amt += U.due(i); d.days = Math.max(d.days, U.overDays(i)); d.rem += i.reminders || 0; map.set(i.traderId, d); });
    const list = Array.from(map.entries()).map(([id, d]) => Object.assign({ t: A.idx.trader.get(id) }, d)).sort((a, b) => b.days - a.days || b.amt - a.amt);
    const pg = U.pager('cn', list.length, 20);
    return `<div class="grid g2">
      <div class="card"><div class="card-h"><h3>Phân loại nợ theo số ngày quá hạn</h3></div><div class="card-b">
        ${buckets.map(b => `<div style="margin:10px 0"><div class="row small"><b style="width:100px">${b.label}</b><span class="muted">${b.n} tiểu thương</span><span class="spacer"></span><b>${U.money(b.amt)}</b></div><div class="bar-mini" style="height:10px"><i style="width:${b.amt * 100 / maxAmt}%;background:#d6453b"></i></div></div>`).join('')}
        <div class="divider"></div><div class="row"><b>Tổng nợ quá hạn</b><span class="spacer"></span><b style="color:#d6453b;font-size:18px">${U.money(U.sum(over, U.due))}</b></div></div></div>
      <div class="card"><div class="card-h"><h3>Lịch nhắc nợ tự động</h3></div><div class="card-b small">
        <div class="row" style="padding:6px 0"><span class="tag info">Ngày 12</span>Nhắc trước hạn 3 ngày qua Mini app, Zalo OA</div>
        <div class="row" style="padding:6px 0"><span class="tag warn">Ngày 16</span>Thông báo quá hạn lần 1</div>
        <div class="row" style="padding:6px 0"><span class="tag warn">Ngày 25</span>Nhắc lần 2 kèm mã QR thanh toán</div>
        <div class="row" style="padding:6px 0"><span class="tag danger">Quá 60 ngày</span>Chuyển danh sách cho Trưởng Ban Quản lý xử lý theo hợp đồng</div>
        <div class="muted" style="margin-top:8px">Không gửi lặp trong cùng mốc, cùng kênh. Lưu nhật ký gửi, nhận, đọc.</div></div></div></div>
    <div class="card"><div class="card-h"><h3>Danh sách tiểu thương nợ quá hạn (${list.length})</h3><button class="btn accent" data-act="cn-remind-all">📣 Gửi nhắc nợ tất cả</button>
      <button class="btn" data-act="cn-csv">⬇ Xuất Excel</button></div>
      <div class="card-b">${U.table([{ t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Số kỳ nợ', num: true }, { t: 'Tổng nợ', num: true }, { t: 'Quá hạn lâu nhất', num: true }, { t: 'Đã nhắc', num: true }, { t: '' }],
        list.slice(pg.start, pg.end).map(x => `<tr><td><b>${U.esc(x.t.name)}</b> <span class="small muted">${x.t.app ? '· có mini app' : '· chưa cài app'}</span></td><td>${x.t.stalls.map(id => A.idx.stall.get(id).code).join(', ')}</td><td class="num">${x.n}</td><td class="num">${U.money(x.amt)}</td>
          <td class="num"><span class="tag ${x.days > 60 ? 'danger' : 'warn'}">${x.days} ngày</span></td><td class="num">${x.rem}</td>
          <td class="nowrap"><button class="btn sm" data-act="cn-remind" data-id="${x.t.id}">Nhắc nợ</button> <button class="btn sm primary" data-act="pay-open" data-id="${x.t.id}">Thu</button></td></tr>`), { empty: 'Không có nợ quá hạn 🎉' })}${pg.html}</div></div>`;
  };
  function remind(ids) {
    let n = 0;
    A.db.invoices.filter(i => U.isOver(i) && ids.includes(i.traderId)).forEach(i => { i.reminders = (i.reminders || 0) + 1; n++; });
    return n;
  }
  A.ACT['cn-remind'] = el => { remind([el.dataset.id]); A.save(); A.render(); U.toast('Đã gửi nhắc nợ qua Mini app, Zalo OA tới ' + A.idx.trader.get(el.dataset.id).name); };
  A.ACT['cn-remind-all'] = () => {
    const ids = Array.from(new Set(A.db.invoices.filter(i => U.inM(i) && U.isOver(i)).map(i => i.traderId)));
    remind(ids);
    A.db.notifications.unshift({ id: 'TB-' + U.pad(32 + A.db.notifications.length, 3), at: U.today(), title: 'Nhắc nộp phí quá hạn', group: 'Danh sách nợ phí', channels: ['Mini app', 'Zalo OA', 'SMS'], sent: ids.length, delivered: 0.95, read: 0, auto: false });
    U.log('Gửi nhắc nợ hàng loạt cho ' + ids.length + ' tiểu thương');
    A.save(); A.render(); U.toast('Đã gửi nhắc nợ tới ' + ids.length + ' tiểu thương');
  };
  A.ACT['cn-csv'] = () => {
    const rows = [];
    A.db.invoices.filter(i => U.inM(i) && U.isOver(i)).forEach(i => rows.push([A.idx.trader.get(i.traderId).name, A.idx.stall.get(i.stallId).code, i.id, U.per(i.period), U.due(i), U.overDays(i)]));
    U.csv('cong-no-qua-han', ['Tiểu thương', 'Điểm KD', 'Khoản', 'Kỳ', 'Còn nợ', 'Số ngày quá hạn'], rows);
  };
})(window.APP);
