/* Multi-channel notifications (Phase 15.13, from js/v-vanhanh.js): route thong-bao, recipient groups
 * and the tb-send command (mock channels). Data: A.db.notifications. */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  // ---------- Thông báo đa kênh ----------
  const cats = () => Array.from(new Set(A.db.stalls.map(s => s.cat)));
  const CHANNELS = ['Mini app', 'Zalo OA', 'SMS', 'Email'];
  const VARS = ['{traderName}', '{collectorName}', '{period}', '{marketName}', '{totalAmount}', '{amount}', '{dueDate}', '{receivableCode}', '{receivableCount}', '{paymentReference}', '{qrReference}', '{preparationDate}', '{meterReadDate}', '{collectionStartDate}', '{receiptCode}', '{transactionCode}'];
  const ACTORS = { market_manager: 'Tổ trưởng BQL', fee_collector: 'Nhân viên thu phí', trader: 'Tiểu thương', accountant: 'Kế toán' };
  const t = (title, body) => ({ title, body });
  const clone = x => JSON.parse(JSON.stringify(x));
  function eventDefaults() { return [
    { eventKey: 'PERIOD_PREPARATION_STARTED', label: 'Bắt đầu chuẩn bị kỳ thu', trigger: 'Khi kỳ thu tới ngày bắt đầu chuẩn bị.', enabled: true, recipients: ['market_manager', 'fee_collector', 'trader'], channels: ['Mini app', 'Zalo OA'], templates: { market_manager: t('Sắp đến kỳ thu {period}', 'Kỳ thu {period} của {marketName} sẽ bắt đầu chuẩn bị từ ngày {preparationDate}.\nVui lòng theo dõi tiến độ ghi chỉ số và chuẩn bị các khoản phải thu.'), fee_collector: t('Chuẩn bị ghi chỉ số kỳ thu {period}', 'Kỳ thu {period} của {marketName} đã đến giai đoạn chuẩn bị.\nVui lòng ghi chỉ số điện, nước của các điểm kinh doanh được phân công trước ngày {meterReadDate}.'), trader: t('Sắp đến kỳ thu {period}', 'Kỳ thu {period} của {marketName} sắp bắt đầu.\nThời gian dự kiến thu từ {collectionStartDate} đến {dueDate}.\nVui lòng chuẩn bị thanh toán.') } },
    { eventKey: 'RECEIVABLE_ISSUED', label: 'Phát hành khoản phải thu', trigger: 'Khi Tổ trưởng phát hành khoản phải thu thành công.', enabled: true, recipients: ['trader', 'fee_collector'], channels: ['Mini app', 'Zalo OA'], templates: { trader: t('Khoản phải thu kỳ {period} đã được phát hành', 'Khoản phải thu kỳ {period} tại {marketName} đã được phát hành.\nTổng tiền: {totalAmount}.\nHạn thanh toán: {dueDate}.\nVui lòng xem chi tiết và thực hiện thanh toán.'), fee_collector: t('Đã phát hành khoản phải thu kỳ {period}', 'Chợ {marketName} đã phát hành {receivableCount} khoản phải thu.\nTổng cần thu: {totalAmount}.\nHạn thanh toán: {dueDate}.\nVui lòng theo dõi danh sách thu.') } },
    { eventKey: 'COLLECTION_STARTED', label: 'Bắt đầu thời gian thu', trigger: 'Khi kỳ thu chuyển từ Đang chuẩn bị sang Đang thu.', enabled: true, recipients: ['fee_collector', 'market_manager'], channels: ['Mini app'], templates: { fee_collector: t('Kỳ thu {period} đã bắt đầu', 'Kỳ thu {period} đã bắt đầu.\nVui lòng theo dõi danh sách tiểu thương chưa thanh toán và thực hiện thu theo phân công.'), market_manager: t('Kỳ thu {period} đã bắt đầu', 'Kỳ thu {period} đã bắt đầu.\nBạn có thể theo dõi tiến độ thu của {marketName}.') } },
    { eventKey: 'PAYMENT_DUE_SOON', label: 'Sắp đến hạn thanh toán', trigger: 'Gửi cho tiểu thương có khoản phải thu chưa thanh toán.', enabled: true, recipients: ['trader'], channels: ['Mini app', 'Zalo OA', 'SMS'], leadDays: 1, templates: { trader: t('Sắp đến hạn thanh toán kỳ {period}', 'Khoản phải thu {period} của bạn còn {amount}.\nHạn thanh toán: {dueDate}.\nVui lòng hoàn tất thanh toán đúng hạn.') } },
    { eventKey: 'PAYMENT_SUCCESS', label: 'Thanh toán thành công', trigger: 'Khi thanh toán được khớp thành công hoặc NV thu phí xác nhận đủ tiền mặt.', enabled: true, recipients: ['trader'], channels: ['Mini app', 'Zalo OA'], templates: { trader: t('Thanh toán thành công', 'Hệ thống đã ghi nhận thanh toán {amount} cho kỳ {period}.\nBiên lai điện tử: {receiptCode}.\nVui lòng xem chi tiết biên lai.') } },
    { eventKey: 'TRANSACTION_REVIEW_REQUIRED', label: 'Giao dịch cần tra soát', trigger: 'Khi giao dịch có trạng thái NEEDS_REVIEW, UNMATCHED hoặc tương đương.', enabled: true, recipients: ['fee_collector', 'accountant'], channels: ['Mini app'], templates: { fee_collector: t('Có giao dịch cần tra soát', 'Phát hiện giao dịch {transactionCode} liên quan kỳ {period} chưa thể tự động khớp.\nVui lòng kiểm tra.'), accountant: t('Có giao dịch cần tra soát', 'Phát hiện giao dịch {transactionCode} liên quan kỳ {period} chưa thể tự động khớp.\nVui lòng kiểm tra.') } },
    { eventKey: 'PERIOD_FULLY_COLLECTED', label: 'Thu đủ 100% kỳ', trigger: 'Khi toàn bộ khoản phải thu của kỳ đã thanh toán.', enabled: true, recipients: ['market_manager', 'fee_collector'], channels: ['Mini app'], templates: { market_manager: t('Kỳ thu {period} đã thu đủ 100%', 'Toàn bộ khoản phải thu của {marketName} trong kỳ {period} đã được thanh toán.\nCó thể thực hiện hoàn tất thu và chuyển sang đối soát.'), fee_collector: t('Kỳ thu {period} đã thu đủ 100%', 'Toàn bộ khoản phải thu của {marketName} trong kỳ {period} đã được thanh toán.\nCó thể thực hiện hoàn tất thu và chuyển sang đối soát.') } },
    { eventKey: 'RECONCILIATION_COMPLETED', label: 'Đối soát hoàn tất', trigger: 'Khi đối soát kỳ hoàn tất.', enabled: true, recipients: ['market_manager'], channels: ['Mini app'], templates: { market_manager: t('Đối soát kỳ {period} đã hoàn tất', 'Kết quả thu kỳ {period} của {marketName} đã được đối soát đầy đủ.\nKỳ đủ điều kiện để kiểm tra và chốt.') } },
    { eventKey: 'CONTRACT_EXPIRY_30', label: 'Hợp đồng còn 30 ngày hết hạn', trigger: 'Khi hợp đồng sắp hết hạn 30 ngày.', enabled: true, recipients: ['trader'], channels: ['Mini app', 'Zalo OA'], templates: { trader: t('Hợp đồng sắp hết hạn', 'Hợp đồng tại {marketName} sắp hết hạn. Vui lòng xem chi tiết hợp đồng.') } },
    { eventKey: 'COMPLAINT_COMPLETED', label: 'Phản ánh được xử lý xong', trigger: 'Khi phản ánh hoàn thành.', enabled: true, recipients: ['trader'], channels: ['Mini app'], templates: { trader: t('Phản ánh đã được xử lý', 'Phản ánh của bạn tại {marketName} đã được xử lý xong.') } }
  ]; }
  function ensureEvents() {
    let changed = false; A.db.notificationEventConfigs = Array.isArray(A.db.notificationEventConfigs) ? A.db.notificationEventConfigs : [];
    eventDefaults().forEach(base => { const cur = A.db.notificationEventConfigs.find(x => x.eventKey === base.eventKey); if (!cur) { A.db.notificationEventConfigs.push(clone(base)); changed = true; return; } ['label', 'trigger', 'enabled', 'recipients', 'channels', 'templates', 'leadDays'].forEach(k => { if (cur[k] === undefined && base[k] !== undefined) { cur[k] = clone(base[k]); changed = true; } }); if (!cur.templates || typeof cur.templates !== 'object') { cur.templates = {}; changed = true; } Object.keys(base.templates).forEach(actor => { if (!cur.templates[actor]) { cur.templates[actor] = clone(base.templates[actor]); changed = true; } }); if (base.eventKey === 'RECEIVABLE_ISSUED' && !cur.receivableIssuedRecipientSchema) { if (!cur.recipients.includes('fee_collector')) cur.recipients.push('fee_collector'); cur.receivableIssuedRecipientSchema = 2; changed = true; } });
    // Không seed lịch sử phát hành khoản phải thu: record RECEIVABLE_ISSUED chỉ
    // được tạo từ handler phát hành thành công. Demo cũ nếu đã lưu vẫn được giữ.
    // Historical demo notifications must come from their workflow trigger, not from opening this screen.
    if (changed) A.save(); return A.db.notificationEventConfigs;
  }
  const eventByKey = key => ensureEvents().find(x => x.eventKey === key);
  A.NOTIFICATIONS = A.NOTIFICATIONS || {};
  A.NOTIFICATIONS.eventByKey = eventByKey;
  function groupInfo(v) {
    const db = A.db;
    if (v === 'all') return ['Toàn bộ tiểu thương', db.traders.length];
    if (v === 'CL' || v === 'TTD') return [U.market(v).short, db.traders.filter(t => t.market === v).length];
    if (v === 'debt') return ['Danh sách nợ phí', new Set(db.invoices.filter(U.isOver).map(i => i.traderId)).size];
    const c = v.slice(4);
    return ['Ngành hàng: ' + c, db.traders.filter(t => t.cat === c).length];
  }
  A.VIEWS['thong-bao'] = function () {
    const events = ensureEvents(), g = ui.tbGroup || 'all', gi = groupInfo(g);
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
      <div class="card"><div class="card-h"><div><h3>Thông báo tự động theo sự kiện</h3><div class="small muted">Kỳ thu quyết định thời điểm; màn này quyết định người nhận, kênh và mẫu nội dung.</div></div></div><div class="card-b">
        ${U.table([{ t: 'Sự kiện' }, { t: 'Người nhận' }, { t: 'Kênh' }, { t: 'Trạng thái' }, { t: 'Thao tác' }], events.map(e => `<tr><td><b>${U.esc(e.label)}</b><div class="small muted">${U.esc(e.trigger)}</div></td><td>${U.esc(e.recipients.map(x => ACTORS[x] || x).join(', '))}</td><td class="small">${U.esc(e.channels.join(', '))}</td><td>${e.enabled ? '<span class="tag ok">Bật</span>' : '<span class="tag">Tắt</span>'}</td><td><button class="btn sm" data-act="notification-event-config" data-id="${e.eventKey}">Cấu hình</button></td></tr>`), { empty: 'Chưa có cấu hình thông báo tự động.' })}</div></div></div>
    <div class="card"><div class="card-h"><h3>Lịch sử thông báo</h3></div><div class="card-b">
      ${U.table([{ t: 'Mã' }, { t: 'Ngày' }, { t: 'Tiêu đề' }, { t: 'Đối tượng' }, { t: 'Kênh' }, { t: 'Loại' }, { t: 'Sự kiện' }, { t: 'Người nhận', num: true }, { t: 'Đã nhận', num: true }, { t: 'Đã đọc', num: true }],
        A.db.notifications.map(n => { const e = events.find(x => x.eventKey === (n.eventConfigKey || n.kind)); const recipientType = n.recipientType === 'TRADER' ? 'Tiểu thương' : n.recipientType === 'FEE_COLLECTOR' ? 'NV thu phí' : ''; return `<tr><td>${n.id}</td><td>${U.dmy(n.at)}</td><td>${U.esc(n.title)}</td><td>${U.esc(n.group)}${recipientType ? `<div class="small muted">${recipientType}</div>` : ''}</td><td class="small">${(n.channels || []).join(', ')}</td><td>${n.auto ? '<span class="tag info">Tự động</span>' : '<span class="tag">Thủ công</span>'}</td><td class="small">${U.esc(e ? e.label : '—')}</td><td class="num">${n.sent}</td><td class="num">${n.delivered != null ? U.pctTxt(n.delivered * 100) : '—'}</td><td class="num">${n.read ? U.pctTxt(n.read * 100) : '<span class="muted">đang cập nhật</span>'}</td></tr>`; }))}</div></div>`;
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
  function preparationNote(event) {
    if (event.eventKey !== 'PERIOD_PREPARATION_STARTED') return '';
    const cycle = A.SERVICE_CFG && A.SERVICE_CFG.cycle ? A.SERVICE_CFG.cycle() : null;
    return `<div class="note info" style="margin-top:12px">Ngày trigger được thiết lập ở màn Kỳ thu. Trigger hiện ${cycle && cycle.prepareNotification ? '<b>được cho phép</b>' : '<b>đang tắt</b>'} bởi “Tự động gửi thông báo chuẩn bị kỳ thu”.</div>`;
  }
  function eventModal(event) {
    const canEdit = A.canDo('thong-bao.gui', ui.market), dis = canEdit ? '' : 'disabled';
    const actors = Object.keys(event.templates || {}), recipientChecks = actors.map(actor => `<label class="row" style="gap:7px"><input class="notification-recipient" type="checkbox" value="${actor}" ${(event.recipients || []).includes(actor) ? 'checked' : ''} ${dis}> ${ACTORS[actor] || actor}</label>`).join('');
    const channelChecks = CHANNELS.map(channel => `<label class="row" style="gap:7px"><input class="notification-channel" type="checkbox" value="${channel}" ${(event.channels || []).includes(channel) ? 'checked' : ''} ${dis}> ${channel}</label>`).join('');
    const templates = actors.map((actor, index) => { const x = event.templates[actor]; return `<details ${index === 0 ? 'open' : ''}><summary><b>${ACTORS[actor] || actor}</b></summary><div style="margin-top:10px"><div class="field"><label>Tiêu đề</label><input class="input" data-template-title="${actor}" value="${U.esc(x.title || '')}" ${dis}></div><div class="field" style="margin-top:10px"><label>Nội dung</label><textarea class="input" rows="5" data-template-body="${actor}" ${dis}>${U.esc(x.body || '')}</textarea></div></div></details>${index < actors.length - 1 ? '<div class="divider"></div>' : ''}`; }).join('');
    A.modal(A.mHead('Cấu hình thông báo tự động') + `<div class="modal-b"><h4 style="margin-top:0">${U.esc(event.label)}</h4><div class="small muted">${U.esc(event.trigger)}</div><section style="margin-top:16px"><h4>Trạng thái</h4><label class="row" style="gap:7px"><input id="notification-event-enabled" type="checkbox" ${event.enabled ? 'checked' : ''} ${dis}> Bật thông báo tự động</label></section><section style="margin-top:16px"><h4>Người nhận</h4><div class="row" style="gap:14px;flex-wrap:wrap">${recipientChecks}</div></section><section style="margin-top:16px"><h4>Kênh gửi</h4><div class="row" style="gap:14px;flex-wrap:wrap">${channelChecks}</div></section>${event.leadDays != null ? `<section style="margin-top:16px"><h4>Nhắc thanh toán</h4><div class="field" style="max-width:180px"><label>Gửi trước hạn (ngày)</label><input id="notification-lead-days" class="input" type="number" min="0" value="${event.leadDays}" ${dis}></div></section>` : ''}<section style="margin-top:16px"><h4>Mẫu nội dung theo người nhận</h4>${templates}</section><section style="margin-top:16px"><h4>Biến có thể sử dụng</h4><div class="row" style="gap:6px;flex-wrap:wrap">${VARS.map(v => `<span class="tag">${v}</span>`).join('')}</div></section>${preparationNote(event)}</div><div class="modal-f"><button class="btn" data-act="close">${canEdit ? 'Hủy' : 'Đóng'}</button>${canEdit ? `<button class="btn primary" data-act="notification-event-save" data-id="${event.eventKey}">Lưu cấu hình</button>` : ''}</div>`);
  }
  A.ACT['notification-event-config'] = el => { const event = eventByKey(el.dataset.id); if (event) eventModal(event); };
  A.ACT['notification-event-save'] = el => {
    if (!A.canDo('thong-bao.gui', ui.market)) return;
    const event = eventByKey(el.dataset.id); if (!event) return;
    const channels = Array.from(document.querySelectorAll('.notification-channel:checked')).map(x => x.value);
    if (!channels.length) return U.toast('Vui lòng chọn ít nhất một kênh gửi.');
    event.enabled = A.$('#notification-event-enabled').checked;
    event.recipients = Array.from(document.querySelectorAll('.notification-recipient:checked')).map(x => x.value);
    event.channels = channels;
    if (event.leadDays != null) event.leadDays = Math.max(0, Number(A.$('#notification-lead-days').value) || 0);
    Object.keys(event.templates || {}).forEach(actor => { event.templates[actor].title = A.$(`[data-template-title="${actor}"]`).value.trim(); event.templates[actor].body = A.$(`[data-template-body="${actor}"]`).value.trim(); });
    A.save(); A.closeModal(); A.render(); U.toast('Đã lưu cấu hình thông báo cho sự kiện ' + event.label);
  };
})(window.APP);
