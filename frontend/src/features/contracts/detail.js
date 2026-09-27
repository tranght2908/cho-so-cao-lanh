/* Contracts feature — contract dossier renderer (A.contractDetailLayoutV2).
 * Moved verbatim from js/v-tieuthuong.js in Phase 11; loads right after it so the
 * registration order is unchanged. The overridden ct-view registration was dropped. */
// Detail-layout refresh: mirrors the compact two-column contract dossier while
// preserving the Contract V1 actions and data model above.
(function (A) {
  'use strict';
  const U = A.U;
  const active = c => c && c.status === 'hieuluc';
  const days = c => U.days(U.today(), c.end);
  const point = c => A.features.businessPoints.service.get(c.stallId);
  const trader = c => A.features.traders.service.getProfile(c.traderId);
  const tag = c => c.status === 'thanhly' ? '<span class="tag">Đã thanh lý</span>' : c.status === 'chamdut' ? '<span class="tag danger">Đã chấm dứt</span>' : active(c) ? '<span class="tag ok">Đang hiệu lực</span>' : '<span class="tag">Đã kết thúc</span>';
  const price = c => c.monthly ? U.money(c.monthly) + '/tháng' : 'Theo phiên';
  function section(icon, key, title, body, tone) {
    return `<section class="contract-detail-section ${tone || ''}"><h4><span>${U.icon(icon)}</span>${key}. ${title}</h4>${body}</section>`;
  }
  function pairs(rows) { return `<dl class="contract-detail-kv">${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>`; }
  function detail(c) {
    const t = trader(c), s = point(c), files = c.signedCopies || [], h = c.history || [];
    const warning = active(c) && days(c) <= 30 ? `<b class="${days(c) <= 15 ? 'contract-danger-text' : 'contract-warn-text'}">${days(c)} ngày · Sắp hết hạn</b>` : active(c) ? days(c) + ' ngày' : '—';
    const contract = section('file', 'A', 'THÔNG TIN HỢP ĐỒNG', pairs([['Mã hợp đồng', '<b>' + c.id + '</b>'], ['Ngày ký', U.dmy(c.signedDate || c.start)], ['Ngày hiệu lực', U.dmy(c.start)], ['Ngày hết hạn', U.dmy(c.end)], ['Trạng thái', tag(c)], ['Thời hạn còn lại', warning]]), 'contract-amber');
    const traderBlock = section('users', 'B', 'TIỂU THƯƠNG', pairs([['Tiểu thương', t ? '<b>' + U.esc(t.name) + ' · ' + t.id + '</b>' : '—'], ['Điện thoại', t ? '☎ ' + U.maskPhone(t.phone) : '—'], ['Loại / diện tích', s ? 'Loại: ' + U.esc(U.typeLabel(s.type)) + '<br>Diện tích: <b>' + s.area + ' m²</b>' : '—']]) + (t ? `<div class="contract-section-action"><button class="btn sm" data-act="trader" data-id="${t.id}">${U.icon('eye')}Xem hồ sơ tiểu thương</button></div>` : ''), 'contract-blue');
    const pointBlock = section('store', 'C', 'ĐIỂM KINH DOANH', pairs([['Mã điểm', '<b>' + (s ? s.code : '—') + '</b>'], ['Khu vực', s ? U.esc(s.sectionName) : '—'], ['Loại / diện tích', s ? U.esc(U.typeLabel(s.type)) + ' · <b>' + s.area + ' m²</b>' : '—']]) + (s ? `<div class="contract-section-action"><button class="btn sm" data-act="dk-open" data-id="${s.id}">${U.icon('store')}Xem chi tiết điểm</button></div>` : ''), 'contract-mint');
    const vehicleFees = (c.vehicleFeeSnapshot || []).length ? `<div class="contract-vehicle-snapshot"><b>PHƯƠNG TIỆN</b><br>${c.vehicleFeeSnapshot.map(x => U.esc((x.plateNumber || x.type || 'Phương tiện')) + ': ' + U.money(x.amount) + ' / tháng').join('<br>')}<br><b>Tổng phí phương tiện: ${U.money(c.vehicleFeeSnapshot.reduce((n, x) => n + Number(x.amount || 0), 0))} / tháng</b></div>` : '';
    const regularFees = (c.feeSnapshot || []).filter(x => !String(x.name || '').startsWith('Phí phương tiện'));
    const fees = (regularFees.length ? regularFees.map(x => U.esc(x.name) + ': ' + U.money(x.amount)).join('<br>') : (vehicleFees ? '' : 'Chưa ghi nhận')) + vehicleFees;
    const finance = section('money', 'D', 'ĐƠN GIÁ & KHOẢN PHÍ', pairs([['Đơn giá snapshot', c.unit ? U.money(c.unit) + (c.unitLabel ? ' ' + U.esc(c.unitLabel) : '') : '—'], ['Giá thuê', '<b>' + price(c) + '</b>'], ['Khoản phí kèm theo', fees]]), 'contract-sky');
    const copies = section('attachment', 'E', 'BẢN SỐ HÓA HỢP ĐỒNG', files.length ? `<div class="contract-copy-list">${files.map((x,i) => `<div class="contract-copy"><span class="contract-copy-icon">${U.icon('file')}</span><span><b>Ảnh trang ${x.page || i + 1}</b><small>${U.esc(x.name)}</small></span><span class="tag ok">Đã lưu</span><button class="btn sm" data-act="ct-copy-view" data-id="${c.id}" data-file="${i}">Xem</button></div>`).join('')}</div>` : `<div class="contract-empty-copy"><span>${U.icon('file')}</span><div><b>Chưa cập nhật ảnh hợp đồng giấy đã ký.</b><small>Vui lòng thêm ảnh chụp/scan hợp đồng sau khi hai bên ký giấy.</small></div></div>` + (A.canDo('hop-dong.cap-nhat-ban-ky', c.market) ? `<button class="btn sm contract-add-copy" data-act="ct-copy-add" data-id="${c.id}">+ Thêm ảnh</button>` : ''), 'contract-purple');
    const history = section('refresh', 'F', 'LỊCH SỬ', h.length ? `<div class="tbl-wrap"><table class="tbl contract-history"><thead><tr><th>Thời gian</th><th>Sự kiện</th><th>Mô tả</th><th>Người thực hiện</th></tr></thead><tbody>${h.map(x => `<tr><td>${U.esc(x.at || '—')}</td><td><b>${U.esc(x.action || '—')}</b></td><td>${U.esc(x.detail || '—')}</td><td>${U.esc(x.by || 'Hệ thống')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty small">Chưa có lịch sử xử lý.</div>', 'contract-history-section');
    return A.mHead(`${U.icon('file')}Hợp đồng ${c.id}`) + `<div class="modal-b contract-detail-body"><div class="contract-detail-grid">${contract}${traderBlock}${pointBlock}${finance}</div>${copies}${history}</div><div class="modal-f contract-detail-footer">${A.canDo('hop-dong.in', c.market) ? `<button class="btn primary" data-act="ct-print" data-id="${c.id}">${U.icon('print')}In hợp đồng</button>` : ''}${active(c) && A.canDo('hop-dong.gia-han', c.market) ? `<button class="btn" data-act="ct-renew" data-id="${c.id}">${U.icon('file')}Gia hạn / Tạo HĐ mới</button>` : ''}${active(c) && A.canDo('hop-dong.cham-dut', c.market) ? `<button class="btn danger" data-act="ct-terminate" data-id="${c.id}">× Chấm dứt</button>` : ''}${(active(c) || c.status === 'chamdut') && A.canDo('hop-dong.thanh-ly', c.market) ? `<button class="btn danger" data-act="ct-liquidate" data-id="${c.id}">⌁ Thanh lý</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.contractDetailLayoutV2 = detail;
})(window.APP);
