/* Multi-channel notifications (Phase 15.13, from js/v-vanhanh.js): route thong-bao, recipient groups
 * and the tb-send command (mock channels). Data: A.db.notifications. */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  // ---------- Thông báo đa kênh ----------
  const cats = () => Array.from(new Set(A.db.stalls.map(s => s.cat)));
  function groupInfo(v) {
    const db = A.db;
    if (v === 'all') return ['Toàn bộ tiểu thương', db.traders.length];
    if (v === 'CL' || v === 'TTD') return [U.market(v).short, db.traders.filter(t => t.market === v).length];
    if (v === 'debt') return ['Danh sách nợ phí', new Set(db.invoices.filter(U.isOver).map(i => i.traderId)).size];
    const c = v.slice(4);
    return ['Ngành hàng: ' + c, db.traders.filter(t => t.cat === c).length];
  }
  A.VIEWS['thong-bao'] = function () {
    const g = ui.tbGroup || 'all', gi = groupInfo(g);
    return `<div class="grid g2" style="align-items:start">
      <div class="card"><div class="card-h"><h3>Soạn thông báo</h3></div><div class="card-b">
        <div class="field"><label>Gửi tới</label><select class="input" data-ch="tb-group">
          <option value="all" ${g === 'all' ? 'selected' : ''}>Toàn bộ tiểu thương</option><option value="CL" ${g === 'CL' ? 'selected' : ''}>Chợ Cao Lãnh</option><option value="TTD" ${g === 'TTD' ? 'selected' : ''}>Chợ quê Tân Thuận Đông</option>
          <option value="debt" ${g === 'debt' ? 'selected' : ''}>Danh sách nợ phí quá hạn</option>${cats().map(c => `<option value="cat:${c}" ${g === 'cat:' + c ? 'selected' : ''}>Ngành hàng: ${c}</option>`).join('')}</select>
          <span class="small muted">${gi[1]} người nhận</span></div>
        <div class="row" style="margin:12px 0">${['Mini app', 'Zalo OA', 'SMS', 'Email'].map((c, k) => `<label class="small"><input type="checkbox" class="tb-ch" value="${c}" ${k < 2 ? 'checked' : ''}> ${c}</label>`).join('')}</div>
        <div class="field"><label>Tiêu đề</label><input class="input" id="tb-title" value="Lịch vệ sinh, khử khuẩn toàn chợ Chủ nhật 20/9"></div>
        <div class="field" style="margin-top:10px"><label>Nội dung</label><textarea class="input" id="tb-content" rows="4">Ban Quản lý chợ thông báo: sáng Chủ nhật 20/9/2026 tổ chức tổng vệ sinh, khử khuẩn. Đề nghị tiểu thương thu dọn hàng hóa trước 6h00.</textarea></div>
        <div class="row" style="margin-top:12px"><span class="spacer"></span>${A.canDo('thong-bao.gui', ui.market) ? `<button class="btn primary" data-act="tb-send">${U.icon('bell')}Gửi ngay</button>` : ''}</div></div></div>
      <div class="card"><div class="card-h"><h3>Thông báo tự động theo sự kiện</h3></div><div class="card-b small">
        ${[['Phát hành khoản phải thu', 'Mini app, Zalo OA'], ['Trước hạn nộp 3 ngày', 'Mini app, Zalo OA'], ['Khoản phải thu quá hạn', 'Mini app, Zalo OA, SMS'], ['Hợp đồng còn 30 ngày hết hạn', 'Mini app, Zalo OA'], ['Phản ánh được xử lý xong', 'Mini app'], ['Biên lai điện tử sau khi thanh toán', 'Mini app, Zalo OA']].map(r => `<div class="row" style="padding:7px 0;border-bottom:1px solid #eef2f7"><span class="tag ok">Bật</span><span style="flex:1">${r[0]}</span><span class="muted">${r[1]}</span></div>`).join('')}</div></div></div>
    <div class="card"><div class="card-h"><h3>Lịch sử thông báo</h3></div><div class="card-b">
      ${U.table([{ t: 'Mã' }, { t: 'Ngày' }, { t: 'Tiêu đề' }, { t: 'Đối tượng' }, { t: 'Kênh' }, { t: 'Người nhận', num: true }, { t: 'Đã nhận', num: true }, { t: 'Đã đọc', num: true }, { t: 'Loại' }],
        A.db.notifications.map(n => `<tr><td>${n.id}</td><td>${U.dmy(n.at)}</td><td>${U.esc(n.title)}</td><td>${U.esc(n.group)}</td><td class="small">${n.channels.join(', ')}</td><td class="num">${n.sent}</td><td class="num">${U.pctTxt(n.delivered * 100)}</td><td class="num">${n.read ? U.pctTxt(n.read * 100) : '<span class="muted">đang cập nhật</span>'}</td><td>${n.auto ? '<span class="tag info">Tự động</span>' : '<span class="tag">Thủ công</span>'}</td></tr>`))}</div></div>`;
  };
  A.CH['tb-group'] = el => { ui.tbGroup = el.value; A.render(); };
  A.ACT['tb-send'] = () => {
    if (!A.canDo('thong-bao.gui', ui.market)) return;
    const title = A.$('#tb-title').value.trim(), ch = Array.from(document.querySelectorAll('.tb-ch:checked')).map(x => x.value);
    if (!title || !ch.length) { U.toast('Cần tiêu đề và ít nhất một kênh gửi'); return; }
    const gi = groupInfo(ui.tbGroup || 'all');
    A.db.notifications.unshift({ id: 'TB-' + U.pad(32 + A.db.notifications.length, 3), at: U.today(), title, group: gi[0], channels: ch, sent: gi[1], delivered: 0.96, read: 0, auto: false, body: A.$('#tb-content').value });
    U.log('Gửi thông báo "' + title + '" tới ' + gi[0]);
    A.save(); A.render(); U.toast(`Đã gửi tới ${gi[1]} tiểu thương qua ${ch.join(', ')}`);
  };
})(window.APP);
