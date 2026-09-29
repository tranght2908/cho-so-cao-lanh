/* Business-point labels (Phase 15.15, from js/core.js): point type, area type, rental kind, status tag. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U;
  U.typeLabel = t => ({ kiot: 'Ki-ốt', nhalong: 'Trong nhà lồng', ngoai: 'Ngoài nhà lồng', phien: 'Quầy phiên' }[t]);
  // Physical-area taxonomy for Mặt bằng only; it is separate from `type` and `pointType`.
  U.areaTypeLabel = t => ({ covered: 'Có mái che', uncovered: 'Không mái che', self_produced: 'Tự sản tự tiêu', session: 'Theo phiên' }[t]);
  // Các mã loại diện tích dùng chung cho dropdown/filter của màn Mặt bằng.
  U.AREA_TYPE_CODES = ['covered', 'uncovered', 'self_produced', 'session'];
  U.rentalKind = st => st && st.type === 'phien' ? 'session' : 'fixed';
  U.rentalLabel = st => U.rentalKind(st) === 'session' ? 'Quầy thuê theo phiên / khách vãng lai' : 'Quầy thuê cố định tháng/quý';
  // Màn Mặt bằng & điểm kinh doanh dùng nhãn gọn: Đang thuê / Tạm ngưng / Tranh chấp (yêu cầu người dùng); các màn
  // khác vẫn dùng nhãn gốc D.STATUS. Chỉ đổi nhãn hiển thị, không đổi mã trạng thái/dữ liệu.
  const MB_STATUS_LABEL = { thue: 'Đang thuê', ngung: 'Tạm ngưng', tranhchap: 'Tranh chấp' };
  A.mbStatusLabel = s => MB_STATUS_LABEL[s] || (D.STATUS[s] ? D.STATUS[s].label : s);
  // Tag nhận khoá HIỂN THỊ (D.STATUS: thue/no/trong/ngung/tranhchap) — lấy bằng A.pointDisplayStatus(st),
  // không truyền stall.status (đó là trạng thái vận hành active/suspended/disputed).
  const dot = s => D.STATUS[s] ? `<span class="dot" style="background:${D.STATUS[s].color}"></span>` : '';
  A.mbStatusTag = s => `<span class="tag">${dot(s)}${U.esc(A.mbStatusLabel(s))}</span>`;
  U.statusTag = s => `<span class="tag">${dot(s)}${U.esc(D.STATUS[s] ? D.STATUS[s].label : s)}</span>`;
  // Tình trạng hiển thị của 1 điểm (hôm nay) và nhãn trạng thái vận hành lưu trên điểm.
  A.pointDisplayStatus = (st, date) => A.features.businessPoints.service.displayStatus(st, date);
  A.pointOpLabel = code => (D.POINT_STATUS && D.POINT_STATUS[code]) || code || '—';
})(window.APP);
