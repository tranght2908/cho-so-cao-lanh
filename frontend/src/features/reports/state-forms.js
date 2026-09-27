/* Báo cáo theo mẫu Nhà nước — cột, dòng lấy nguyên văn từ văn bản:
   - Nghị định 60/2024/NĐ-CP (Phụ lục I): Mẫu 01A, 02A, 03A, 03D — chế độ báo cáo hằng năm theo Điều 34,
     đơn vị được giao quản lý tài sản gửi trước ngày 28/02 hằng năm.
   - Thông tư 34/2022/TT-BCT: Biểu 10/SCT-BCT "Báo cáo công tác phát triển chợ" (kỳ năm).
   Chỉ là lớp trình bày + tổng hợp từ dữ liệu nghiệp vụ; không thay đổi logic nghiệp vụ nào khác.
   Thông tin tài sản (nguyên giá, diện tích, năm sử dụng) là số mẫu minh họa. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const num = v => Math.round(v || 0).toLocaleString('vi-VN');
  const today = () => (A.db && A.db.today) || '2026-09-13';
  const YEAR = today().slice(0, 4);

  // Thông tin tài sản kết cấu hạ tầng chợ (mẫu minh họa) — không có trong dữ liệu nghiệp vụ hiện tại
  const ASSET = {
    CL: { ten: 'Chợ Cao Lãnh (tòa nhà chợ mới)', loai: 'Nhà chợ kiên cố 1 hầm, 1 trệt, 1 lầu', nam: 2024, dat: 8250, san: 20435, nguyengia: 68500000000, haomon: 5480000000, baotri: 320000000, hang: 1, quyhoach: true },
    TTD: { ten: 'Chợ quê Cù lao Tân Thuận Đông', loai: 'Nhà lồng bán kiên cố, sân họp chợ', nam: 2021, dat: 3200, san: 1100, haomon: 480000000, nguyengia: 2400000000, baotri: 45000000, hang: 3, quyhoach: true }
  };
  const mk = id => D.MARKETS.find(m => m.id === id);
  // BAO_CAO_THONG_KE_RECOVERY: ASSET chỉ có số liệu khảo sát tài sản cho CL/TTD (10 chợ còn lại mới
  // có trong danh mục, chưa khảo sát hạ tầng — xem "Hướng dẫn xem"). Dùng A.allowedMarkets() thay vì
  // hardcode ['CL','TTD'] để không rollback lại danh sách chợ cũ, và lọc theo ASSET[id] để không
  // crash/sinh dữ liệu giả cho các chợ chưa có khảo sát — báo cáo trả rỗng/0 cho các chợ đó.
  const scopeIds = xm => (xm === 'ALL' ? A.allowedMarkets(A.currentAccount()) : [xm]).filter(id => ASSET[id]);
  const stallsOf = id => A.db.stalls.filter(s => s.market === id);
  const occupied = id => stallsOf(id).filter(s => s.status === 'thue' || s.status === 'no').length;
  const paidYear = id => U.sum(A.db.payments.filter(p => p.market === id && p.date.startsWith(YEAR)), p => p.amount);
  const invoicedYear = id => U.sum(A.db.invoices.filter(i => i.market === id && i.period.startsWith(YEAR)), i => i.amount);
  const money = v => num(v);

  // Mỗi mẫu: { t, mau, van_ban, ky, sub, head: [[{t, rs, cs}]], colno: [...], build(ids) → { rows, total, kpis } }
  A.STATE_FORMS = {
    'mau-02a': {
      t: 'Báo cáo tình hình khai thác tài sản kết cấu hạ tầng chợ', mau: 'Mẫu số 02A', vb: 'Phụ lục I Nghị định 60/2024/NĐ-CP', ky: 'Năm ' + YEAR, sub: 'Phương thức: Tự khai thác · nộp trước 28/02 năm sau', unit: 'đồng',
      head: [[{ t: 'STT', rs: 2 }, { t: 'Danh mục tài sản', rs: 2 }, { t: 'Công suất sử dụng (trung bình số điểm kinh doanh/năm)', cs: 2 }, { t: 'Giá trị tài sản (đồng)', cs: 2 }, { t: 'Quản lý số tiền thu được (đồng)', cs: 4 }, { t: 'Ghi chú', rs: 2 }],
        [{ t: 'Thiết kế' }, { t: 'Thực tế' }, { t: 'Nguyên giá' }, { t: 'Giá trị còn lại' }, { t: 'Tổng số tiền đã thu' }, { t: 'Số tiền đã nộp NSNN (nếu có)' }, { t: 'Số tiền được NSNN cấp bù (nếu có)' }, { t: 'Chi phí bảo trì lũy kế' }]],
      colno: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
      build(ids) {
        const rows = ids.map((id, i) => { const a = ASSET[id]; return [i + 1, a.ten, stallsOf(id).length, occupied(id), a.nguyengia, a.nguyengia - a.haomon, paidYear(id), 0, 0, a.baotri, mk(id).hang]; });
        const total = ['', 'TỔNG CỘNG', U.sum(rows, r => r[2]), U.sum(rows, r => r[3]), U.sum(rows, r => r[4]), U.sum(rows, r => r[5]), U.sum(rows, r => r[6]), 0, 0, U.sum(rows, r => r[9]), ''];
        return { rows, total, numCols: [2, 3, 4, 5, 6, 7, 8, 9], kpis: [['Điểm KD thiết kế', num(total[2])], ['Điểm KD sử dụng thực tế', num(total[3])], ['Tổng số tiền đã thu ' + YEAR, U.moneyShort(total[6])], ['Giá trị còn lại tài sản', U.moneyShort(total[5])]] };
      }
    },
    'mau-03a': {
      t: 'Báo cáo tổng hợp tình hình quản lý, sử dụng và khai thác tài sản kết cấu hạ tầng chợ', mau: 'Mẫu số 03A', vb: 'Phụ lục I Nghị định 60/2024/NĐ-CP', ky: 'Năm ' + YEAR, sub: 'Đối tượng báo cáo: UBND phường Cao Lãnh (đơn vị được giao quản lý)', unit: 'đồng',
      head: [[{ t: 'STT', rs: 2 }, { t: 'Đối tượng được giao quản lý, sử dụng / Danh mục tài sản', rs: 2 }, { t: 'Năm đưa vào sử dụng', rs: 2 }, { t: 'Diện tích (m²)', cs: 2 }, { t: 'Công suất sử dụng của năm trước liền kề (số điểm KD/năm)', cs: 2 }, { t: 'Giá trị tài sản (đồng)', cs: 2 }, { t: 'Tình trạng tài sản', cs: 2 }, { t: 'Phương thức khai thác', cs: 4 }, { t: 'Ghi chú', rs: 2 }],
        [{ t: 'Đất' }, { t: 'Sàn sử dụng' }, { t: 'Thiết kế' }, { t: 'Thực tế' }, { t: 'Nguyên giá' }, { t: 'Giá trị còn lại' }, { t: 'Hoạt động' }, { t: 'Không hoạt động' }, { t: 'Tự khai thác' }, { t: 'Cho thuê quyền khai thác' }, { t: 'Chuyển nhượng có thời hạn' }, { t: 'Phương thức khác' }]],
      colno: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16'],
      build(ids) {
        const rows = [[1, 'UBND phường Cao Lãnh — Ban Quản lý chợ', '', '', '', '', '', '', '', '', '', '', '', '', '', '']];
        ids.forEach(id => { const a = ASSET[id]; rows.push(['', '   ' + a.ten, a.nam, a.dat, a.san, stallsOf(id).length, occupied(id), a.nguyengia, a.nguyengia - a.haomon, 'x', '', 'x', '', '', '', a.loai]); });
        const total = ['', 'Tổng cộng', '', U.sum(ids, id => ASSET[id].dat), U.sum(ids, id => ASSET[id].san), U.sum(ids, id => stallsOf(id).length), U.sum(ids, occupied), U.sum(ids, id => ASSET[id].nguyengia), U.sum(ids, id => ASSET[id].nguyengia - ASSET[id].haomon), '', '', '', '', '', '', ''];
        return { rows, total, numCols: [3, 4, 5, 6, 7, 8], kpis: [['Công trình chợ', num(ids.length)], ['Tổng diện tích sàn', num(total[4]) + ' m²'], ['Nguyên giá', U.moneyShort(total[7])], ['Đang hoạt động', num(ids.length) + '/' + num(ids.length)]] };
      }
    },
    'mau-03d': {
      t: 'Báo cáo tình hình quản lý, sử dụng số tiền thu từ khai thác tài sản kết cấu hạ tầng chợ', mau: 'Mẫu số 03D', vb: 'Phụ lục I Nghị định 60/2024/NĐ-CP', ky: 'Từ tháng 01/' + YEAR + ' đến tháng ' + today().slice(5, 7) + '/' + YEAR, sub: 'Chỉ phát sinh phương thức tự khai thác', unit: 'đồng',
      head: [[{ t: 'STT', rs: 2 }, { t: 'Đơn vị được giao quản lý, sử dụng', rs: 2 }, { t: 'Tài sản công trình được giao quản lý, sử dụng và khai thác', rs: 2 }, { t: 'Tự khai thác', cs: 3 }, { t: 'Cho thuê quyền khai thác', cs: 5 }, { t: 'Chuyển nhượng có thời hạn quyền khai thác', cs: 4 }, { t: 'Ghi chú', rs: 2 }],
        [{ t: 'Số lượng' }, { t: 'Số tiền thu được' }, { t: 'Chi phí bảo trì' }, { t: 'Số lượng' }, { t: 'Số tiền phải thu' }, { t: 'Số tiền đã thu được' }, { t: 'Chi phí có liên quan' }, { t: 'Số tiền nộp NSNN' }, { t: 'Số lượng' }, { t: 'Số tiền thu được' }, { t: 'Chi phí có liên quan' }, { t: 'Số tiền nộp NSNN' }]],
      colno: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11 (8-10)', '12', '13', '14', '15 (13-14)', '16'],
      build(ids) {
        const rows = [[1, 'UBND phường Cao Lãnh — Ban Quản lý chợ', ids.map(id => ASSET[id].ten).join('; '), ids.length, U.sum(ids, paidYear), U.sum(ids, id => ASSET[id].baotri), 0, 0, 0, 0, 0, 0, 0, 0, 0, 'Thu theo QĐ 480/QĐ-UBND']];
        const total = ['', 'Tổng cộng', '', ids.length, rows[0][4], rows[0][5], 0, 0, 0, 0, 0, 0, 0, 0, 0, ''];
        return { rows, total, numCols: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], kpis: [['Công trình tự khai thác', num(ids.length)], ['Số tiền thu được', U.moneyShort(rows[0][4])], ['Chi phí bảo trì', U.moneyShort(rows[0][5])], ['Phải thu đã phát hành ' + YEAR, U.moneyShort(U.sum(ids, invoicedYear))]] };
      }
    },
    'mau-01a': {
      t: 'Báo cáo kê khai tài sản kết cấu hạ tầng chợ', mau: 'Mẫu số 01A', vb: 'Phụ lục I Nghị định 60/2024/NĐ-CP', ky: 'Kê khai lần đầu', sub: 'Gửi cơ quan quản lý cấp trên trong 30 ngày kể từ ngày tiếp nhận tài sản', unit: 'đồng',
      head: [[{ t: 'STT', rs: 2 }, { t: 'Tài sản', rs: 2 }, { t: 'Địa chỉ', rs: 2 }, { t: 'Loại hình công trình', rs: 2 }, { t: 'Năm đưa vào sử dụng', rs: 2 }, { t: 'Diện tích (m²)', cs: 2 }, { t: 'Công suất sử dụng (TB số điểm KD/năm)', rs: 2 }, { t: 'Số hộ kinh doanh (hộ)', cs: 2 }, { t: 'Giá trị (đồng)', cs: 3 }, { t: 'Chế độ hao mòn/ khấu hao', rs: 2 }, { t: 'Tình trạng tài sản', rs: 2 }, { t: 'Ghi chú', rs: 2 }],
        [{ t: 'Đất' }, { t: 'Sàn sử dụng' }, { t: 'Thiết kế' }, { t: 'Thực tế' }, { t: 'Nguyên giá' }, { t: 'Hao mòn/ Khấu hao' }, { t: 'Giá trị còn lại' }]],
      colno: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16'],
      build(ids) {
        const rows = ids.map((id, i) => { const a = ASSET[id], m = mk(id); const hh = new Set(stallsOf(id).filter(s => s.traderId).map(s => s.traderId)).size; return [i + 1, a.ten, m.address || '', a.loai, a.nam, a.dat, a.san, stallsOf(id).length, stallsOf(id).length, hh, a.nguyengia, a.haomon, a.nguyengia - a.haomon, 'Hao mòn', 'Đang sử dụng', m.hang]; });
        return { rows, total: null, numCols: [4, 5, 6, 7, 8, 9, 10, 11, 12], kpis: [['Tài sản kê khai', num(ids.length)], ['Diện tích đất', num(U.sum(ids, id => ASSET[id].dat)) + ' m²'], ['Nguyên giá', U.moneyShort(U.sum(ids, id => ASSET[id].nguyengia))], ['Hộ kinh doanh', num(U.sum(rows, r => r[9]))]] };
      }
    },
    'bieu-10': {
      t: 'Báo cáo công tác phát triển chợ', mau: 'Biểu 10/SCT-BCT', vb: 'Thông tư 34/2022/TT-BCT (Bộ Công Thương)', ky: 'Năm ' + YEAR + ' (số liệu đến 31/12)', sub: 'Phường tổng hợp gửi Sở Công Thương · Sở gửi Vụ Thị trường trong nước trước 15/3 năm sau', unit: '',
      head: [[{ t: 'TT', rs: 2 }, { t: 'Chỉ tiêu', rs: 2 }, { t: 'Đơn vị tính', rs: 2 }, { t: 'Tổng số', rs: 2 }, { t: 'Chia theo hạng chợ', cs: 3 }, { t: 'Chợ trong quy hoạch', rs: 2 }, { t: 'Chợ đầu mối', rs: 2 }],
        [{ t: 'Hạng 1' }, { t: 'Hạng 2' }, { t: 'Hạng 3' }]],
      colno: ['A', 'B', 'C', '1', '2', '3', '4', '5', '6'],
      build(ids) {
        const h = k => ids.filter(id => ASSET[id].hang === k).length, qh = ids.filter(id => ASSET[id].quyhoach).length;
        const rows = [
          [1, 'Tổng số chợ', 'Chợ', ids.length, h(1), h(2), h(3), qh, 0],
          [2, 'Số chợ xây dựng mới trong năm', 'Chợ', 0, 0, 0, 0, 0, 0],
          [3, 'Số chợ cải tạo, nâng cấp trong năm', 'Chợ', 0, 0, 0, 0, 0, 0],
          [4, 'Số chợ ngừng hoạt động', 'Chợ', 0, 0, 0, 0, 0, 0],
          [5, 'Số chợ được đầu tư kiên cố/bán kiên cố nhưng hộ tham gia kinh doanh dưới 30%', 'Chợ', 0, 0, 0, 0, 0, 0],
          [6, 'Số chợ chuyển đổi chức năng', 'Chợ', 0, 0, 0, 0, 0, 0],
          [7, 'Số tổ chức kinh doanh, quản lý chợ', 'Tổ chức', 1, '', '', '', '', ''],
          ['', '   Trong đó: Doanh nghiệp', 'Tổ chức', 0, '', '', '', '', ''],
          ['', '   Hợp tác xã', 'Tổ chức', 0, '', '', '', '', ''],
          ['', '   Hộ kinh doanh', 'Tổ chức', 0, '', '', '', '', ''],
          ['', '   Ban Quản lý chợ', 'Tổ chức', 1, '', '', '', '', ''],
          ['', '   Tổ quản lý chợ', 'Tổ chức', 0, '', '', '', '', ''],
          [8, 'Tổng vốn đầu tư chợ', 'Tỷ đồng', Math.round(U.sum(ids, id => ASSET[id].nguyengia) / 1e7) / 100, Math.round(U.sum(ids.filter(id => ASSET[id].hang === 1), id => ASSET[id].nguyengia) / 1e7) / 100, 0, Math.round(U.sum(ids.filter(id => ASSET[id].hang === 3), id => ASSET[id].nguyengia) / 1e7) / 100, '', '']
        ];
        return { rows, total: null, numCols: [3, 4, 5, 6, 7, 8], raw: true, kpis: [['Tổng số chợ', num(ids.length)], ['Chợ hạng 1', num(h(1))], ['Chợ trong quy hoạch', num(qh)], ['Tổng vốn đầu tư', U.moneyShort(U.sum(ids, id => ASSET[id].nguyengia))]] };
      }
    }
  };
  A.STATE_FORM_ORDER = ['mau-02a', 'mau-03a', 'mau-03d', 'mau-01a', 'bieu-10'];

  // Kết xuất HTML khung xem trước cho một mẫu (dùng chung style .rp-* với báo cáo điều hành)
  A.stateFormHtml = function (key, xmMkt) {
    const F = A.STATE_FORMS[key], ids = scopeIds(xmMkt), out = F.build(ids);
    const fmt = (v, k) => typeof v === 'number' ? (out.raw && k >= 3 && !Number.isInteger(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : num(v)) : U.esc(v);
    const th = c => `<th ${c.rs ? `rowspan="${c.rs}"` : ''} ${c.cs ? `colspan="${c.cs}"` : ''}>${c.t}</th>`;
    const cell = (v, k, i) => `<td class="${out.numCols.includes(k) ? 'num' : ''} ${k === 1 ? 'rp-first' : ''}" style="${String(v).startsWith('   ') ? 'padding-left:22px;font-weight:400' : ''}">${fmt(typeof v === 'string' ? v.trim() : v, k)}</td>`;
    return `<div class="rp-preview rp-state">
      <div class="rp-state-head"><div><div class="rp-org">UBND TỈNH ĐỒNG THÁP</div><div class="rp-org rp-org-b">UBND PHƯỜNG CAO LÃNH – BAN QUẢN LÝ CHỢ</div></div><div class="rp-mau"><b>${F.mau}</b><br><span class="muted small">${F.vb}</span></div></div>
      <h2 class="rp-title">${U.esc(F.t.toUpperCase())}</h2>
      <div class="rp-period">Kỳ báo cáo: ${U.esc(F.ky)}${F.sub ? ' · ' + U.esc(F.sub) : ''}${F.unit ? ' · ĐVT: ' + F.unit : ''}</div>
      <div class="rp-kpis">${out.kpis.map(k => `<div class="rp-kpi"><div class="l">${k[0]}</div><div class="v">${k[1]}</div></div>`).join('')}</div>
      <div class="rp-block"><div class="rp-block-h">📋 ${U.esc(F.mau)} — ${U.esc(F.t)}</div>
        <div class="tbl-wrap"><table class="tbl rp-tbl rp-form"><thead>${F.head.map(r => `<tr>${r.map(th).join('')}</tr>`).join('')}<tr class="rp-colno">${F.colno.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${out.rows.map(row => `<tr>${row.map((v, k) => cell(v, k)).join('')}</tr>`).join('')}</tbody>
        ${out.total ? `<tfoot><tr class="rp-total">${out.total.map((v, k) => `<td class="${typeof v === 'number' ? 'num' : ''}">${fmt(v, k)}</td>`).join('')}</tr></tfoot>` : ''}</table></div></div>
      <div class="rp-sign"><div><div class="rp-sign-s">………, ngày … tháng … năm ……</div><div class="rp-sign-t">XÁC NHẬN CỦA CƠ QUAN QUẢN LÝ CẤP TRÊN (nếu có)</div><div class="rp-sign-s">(Ký, ghi rõ họ tên và đóng dấu)</div></div><div><div class="rp-sign-s">Cao Lãnh, ngày ${U.dmy(U.today()).replace(/\//g, ' tháng ').replace(/ tháng (\d+)$/, ' năm $1')}</div><div class="rp-sign-t">THỦ TRƯỞNG ĐƠN VỊ BÁO CÁO</div><div class="rp-sign-s">(Ký, ghi rõ họ tên và đóng dấu)</div><div class="rp-sign-n">Trần Minh Khoa</div></div></div>
      <div class="small muted rp-note">Biểu mẫu theo ${U.esc(F.vb)}. Số liệu điểm kinh doanh, số thu lấy tự động từ hệ thống; thông tin tài sản (nguyên giá, diện tích, năm sử dụng) là số mẫu minh họa cần đối chiếu sổ tài sản.</div>
    </div>`;
  };
  A.stateFormCsv = function (key, xmMkt) {
    const F = A.STATE_FORMS[key], out = F.build(scopeIds(xmMkt));
    const flat = []; F.head.forEach(r => flat.push(r.flatMap(c => Array(c.cs || 1).fill(c.t))));
    U.csv(key, F.colno, out.rows.map(r => r.map(v => typeof v === 'string' ? v.trim() : v)).concat(out.total ? [out.total] : []));
  };
})(window.APP);
