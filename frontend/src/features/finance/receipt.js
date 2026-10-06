/* Biên lai thu tiền điện tử — MỘT mẫu dùng chung cho màn Thu tiền & biên lai (NV thu phí) và cổng Tiểu thương.
 * Render từ chính bản ghi A.db.payments (cùng số biên lai, mã giao dịch, mã tra cứu); không tự sinh dữ liệu.
 * Quyền / phạm vi được kiểm tra ở handler của từng màn trước khi gọi html(). */
(function (A) {
  'use strict';
  const U = A.U, D = window.DATA, finance = A.features.finance || (A.features.finance = {});
  const MP = () => finance.marketPeriod;
  const periodLabel = p => p.label || U.per(p.id);
  function html(pay, preview) {
    const inv = A.idx.invoice.get(pay.invoiceId), t = A.idx.trader.get(pay.traderId) || {}, mk = U.market(pay.market) || {};
    const bp = inv && MP().ofInvoice(inv);
    const lines = inv && !pay.debtId && Number(pay.amount) === Number(inv.amount) && (inv.items || []).length
      ? inv.items.map(x => `<tr><td>${U.esc(x.name || 'Khoản thu')}${x.stallId ? `<div class="small muted">Điểm ${U.esc((A.idx.stall.get(x.stallId) || {}).code || x.stallId)}</div>` : ''}</td><td class="num">${U.money(x.amount)}</td></tr>`)
      : [`<tr><td>Thu khoản ${U.esc(inv ? inv.id : pay.invoiceId || '')}</td><td class="num">${U.money(pay.amount)}</td></tr>`];
    return `<div class="receipt tt-receipt"><div class="tt-rc-org"><b>UBND PHƯỜNG CAO LÃNH</b><div>${U.esc(String(mk.name || pay.market).toLocaleUpperCase('vi'))}</div></div>
      <h4>BIÊN LAI THU TIỀN</h4><div class="sub">Số: <b>${preview ? 'Cấp sau khi xác nhận' : U.esc(pay.receipt)}</b></div>
      <dl class="kv"><dt>Tiểu thương</dt><dd>${U.esc(t.name || pay.traderId)}</dd><dt>Mã TT</dt><dd>${U.esc(t.id || pay.traderId)}</dd><dt>Kỳ thu</dt><dd>${U.esc(bp ? periodLabel(bp) : inv ? U.per(inv.period) : '')}</dd>
        <dt>Ngày thu</dt><dd>${preview ? 'Ghi nhận sau khi xác nhận' : U.dmy(pay.date) + ' ' + U.esc(pay.time || '')}</dd><dt>NV thu phí</dt><dd>${U.esc(A.paymentActorLabel(pay))}</dd><dt>Phương thức</dt><dd>${U.esc(D.METHOD[pay.method] || pay.method)}</dd>
        <dt>Mã giao dịch</dt><dd>${preview ? 'Cấp sau khi xác nhận' : U.esc(pay.id)}</dd><dt>Mã khoản phải thu</dt><dd>${U.esc(pay.invoiceId || '')}</dd></dl>
      ${U.table([{ t: 'Nội dung thu' }, { t: 'Số tiền', num: true }], lines)}
      <div class="tt-rc-total"><span>Tổng cộng</span><b>${U.money(pay.amount)}</b></div>
      <div class="tt-rc-ref">Mã tra cứu: <b>${preview ? 'Cấp sau khi xác nhận' : U.esc(pay.lookup || '')}</b>${inv && inv.paymentReference ? ` · Tham chiếu thanh toán: <b>${U.esc(inv.paymentReference)}</b>` : ''}</div>
      <div class="small muted">${preview ? 'Bản xem trước — mã biên lai, giao dịch và tra cứu được cấp sau khi xác nhận thu.' : 'Biên lai điện tử của bản mẫu (prototype) — không phải chứng từ phát hành qua hệ thống chính thức.'}</div></div>`;
  }
  function style() {
    setTimeout(() => {
      const receipt = document.querySelector('.tt-receipt');
      if (!receipt) return;
      Object.assign(receipt.style, { maxWidth: '760px', margin: '0 auto', padding: '28px 34px', border: '1px solid #d8dee8', borderRadius: '4px', background: '#fff', boxShadow: '0 3px 12px rgba(31,41,55,.08)', color: '#172033' });
      const org = receipt.querySelector('.tt-rc-org');
      if (org) Object.assign(org.style, { textAlign: 'center', lineHeight: '1.55', fontSize: '13px', textTransform: 'uppercase' });
      const title = receipt.querySelector('h4');
      if (title) Object.assign(title.style, { margin: '22px 0 4px', textAlign: 'center', fontSize: '20px', letterSpacing: '.04em' });
      const sub = receipt.querySelector('.sub');
      if (sub) Object.assign(sub.style, { textAlign: 'center', color: '#596579', marginBottom: '22px' });
      const facts = receipt.querySelector('.kv');
      if (facts) Object.assign(facts.style, { display: 'grid', gridTemplateColumns: '150px 1fr 150px 1fr', gap: '8px 14px', padding: '16px 0', borderTop: '1px solid #e5e9f0', borderBottom: '1px solid #e5e9f0' });
      const table = receipt.querySelector('table');
      if (table) { Object.assign(table.style, { marginTop: '20px', width: '100%', borderCollapse: 'collapse' }); table.querySelectorAll('th').forEach(x => Object.assign(x.style, { background: '#f3f5f8', fontWeight: '700', borderBottom: '1px solid #cfd6e2' })); table.querySelectorAll('th,td').forEach(x => Object.assign(x.style, { padding: '10px 12px', borderBottom: '1px solid #e5e9f0' })); }
      const total = receipt.querySelector('.tt-rc-total');
      if (total) Object.assign(total.style, { display: 'flex', justifyContent: 'flex-end', gap: '28px', marginTop: '18px', padding: '14px 0', borderTop: '2px solid #172033', fontSize: '17px' });
      const ref = receipt.querySelector('.tt-rc-ref');
      if (ref) Object.assign(ref.style, { marginTop: '18px', padding: '12px 14px', background: '#f7f9fc', border: '1px dashed #b8c2d1', textAlign: 'center' });
    }, 0);
  }
  finance.receipt = { html, style };
})(window.APP);
