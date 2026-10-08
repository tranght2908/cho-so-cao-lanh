/* Giá THAM CHIẾU dùng chung (QĐ 480 và các quyết định thay thế) — master data do QUẢN TRỊ HỆ THỐNG quản lý.
 * Tab riêng "Giá tham chiếu QĐ 480 (quản trị)" trong màn Chính sách thu, chỉ hiện với quyền chính sách chung
 * (action:cau-hinh-gia.chinh-sach-chung.them-muc); không trộn với cấu hình mức thu riêng của từng chợ.
 *
 * Dữ liệu: bản ghi stallPrices scope SHARED (marketGrades + areaTypeId + marketIds của các chợ cùng hạng) — cùng
 * nguồn mà Tổ trưởng xem ở tab "Giá tham chiếu QĐ 480" của từng chợ (SERVICE_CFG.referenceLandPrices) và dùng
 * làm preset. Phiên bản: quyết định mới KHÔNG sửa đè bản ghi cũ — tạo bản ghi mới (số hiệu, ngày hiệu lực, ngày
 * hết hiệu lực, tệp căn cứ, bảng giá theo hạng × loại diện tích); bản ghi cũ giao nhau được kết thúc hiệu lực
 * ngày trước đó (giữ để truy vết). Không tự cập nhật mức thu riêng của các chợ, không đổi hợp đồng/khoản thu đã khóa.
 */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  const SC = () => A.SERVICE_CFG, MC = () => A.features.markets.service;
  const fc = A.features.feeConfig || (A.features.feeConfig = {});
  const AREA = () => U.AREA_TYPE_CODES || [];
  const GRADES = [1, 2, 3];
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const today = () => (A.db && A.db.today) || U.today();
  const actor = () => { const acc = A.currentAccount(); return acc ? acc.fullName : 'Không rõ'; };
  const num = v => { const s = String(v === null || v === undefined ? '' : v).trim().replace(',', '.'); return s === '' ? null : Number(s); };
  // Quyền master data: Quản trị hệ thống (chinh-sach-chung.them-muc). Tổ trưởng (them-phi) KHÔNG có quyền này.
  fc.canManageReference = () => U.can('cau-hinh-gia') && A.canDo('cau-hinh-gia.chinh-sach-chung.them-muc');
  const sharedRows = () => (SC().list('stallPrices') || []).filter(r => r.scope === 'SHARED' && r.status !== 'cancelled');
  const gradeOf = m => { const x = /HANG_(\d)/.exec((m && m.rank) || ''); return x ? Number(x[1]) : null; };
  const marketsOfGrade = g => MC().rows().filter(m => gradeOf(m) === g).map(m => m.id);
  const st = () => ui.feeCfg || (ui.feeCfg = {});
  const emptyForm = () => ({ docNo: '', docDate: '', issuer: '', summary: '', effectiveFrom: fc.nextMonthStart ? fc.nextMonthStart() : today(), effectiveTo: '', file: null, prices: {} });

  // ---- Service tạo phiên bản tham chiếu (kiểm tra quyền ngay tại đây — không chỉ ẩn UI) ----
  fc.saveReferenceVersion = function (spec, user) {
    if (!fc.canManageReference()) return { ok: false, denied: true, errors: ['Chỉ Quản trị hệ thống được quản lý giá tham chiếu dùng chung.'] };
    const f = spec || {}, errors = [], eff = f.effectiveFrom, to = f.effectiveTo || null;
    if (!String(f.docNo || '').trim()) errors.push('Vui lòng nhập số hiệu quyết định.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eff || '')) errors.push('Vui lòng nhập ngày hiệu lực.');
    if (to && eff && to < eff) errors.push('Ngày hết hiệu lực phải sau ngày hiệu lực.');
    if (!f.file) errors.push('Vui lòng tải lên tệp căn cứ (PDF / ảnh quyết định).');
    const cells = [];
    GRADES.forEach(g => AREA().forEach(k => {
      const v = num(((f.prices || {})[g] || {})[k]);
      if (v === null) return;
      if (!(v > 0)) return errors.push(`Đơn giá Hạng ${g} · ${U.areaTypeLabel(k)} phải lớn hơn 0.`);
      cells.push({ g, k, v });
    }));
    if (!cells.length && !errors.length) errors.push('Vui lòng nhập ít nhất một đơn giá tham chiếu.');
    // Bản ghi cũ cùng loại diện tích, có hạng giao nhau, còn hiệu lực tại ngày mới → kết thúc; phiên bản mới phải
    // khai báo đủ các hạng của bản ghi cũ đó (không làm mất tham chiếu của hạng khác).
    const olds = [];
    AREA().forEach(k => {
      const grades = cells.filter(c => c.k === k).map(c => c.g);
      if (!grades.length) return;
      sharedRows().filter(r => r.status === 'active' && r.areaTypeId === k && (!r.effectiveTo || r.effectiveTo >= eff) && (r.marketGrades || []).some(g => grades.includes(g))).forEach(r => {
        const miss = (r.marketGrades || []).filter(g => !grades.includes(g));
        if (miss.length) errors.push(`Mức tham chiếu "${U.areaTypeLabel(k)}" hiện áp dụng cho Hạng ${(r.marketGrades || []).join(', ')} — phiên bản mới phải khai báo đủ các hạng này.`);
        if ((r.effectiveFrom || '') >= eff) errors.push(`Ngày hiệu lực phải sau ngày hiệu lực của mức tham chiếu "${U.areaTypeLabel(k)}" đang áp dụng (${U.dmy(r.effectiveFrom)}).`);
        if (!olds.includes(r)) olds.push(r);
      });
    });
    if (errors.length) return { ok: false, errors: Array.from(new Set(errors)) };
    const legalBasis = { docNo: String(f.docNo).trim(), docDate: f.docDate || '', issuer: String(f.issuer || '').trim(), summary: String(f.summary || '').trim(), effectiveDate: eff, note: '' };
    const created = cells.map(c => {
      const prev = olds.find(r => r.areaTypeId === c.k && (r.marketGrades || []).includes(c.g));
      const rec = { scope: 'SHARED', marketId: null, marketIds: marketsOfGrade(c.g), marketGrades: [c.g], areaTypeId: c.k, amount: c.v, unit: 'đ/m²/ngày',
        effectiveFrom: eff, effectiveTo: to, status: 'active', previousVersionId: prev ? prev.id : null, legalBasis: Object.assign({}, legalBasis), attachments: [],
        __detail: `${legalBasis.docNo} · Hạng ${c.g} · ${U.areaTypeLabel(c.k)} · ${fmt(c.v)} đ/m²/ngày · căn cứ: ${f.file.name}` };
      SC().add('stallPrices', rec, user); delete rec.__detail;
      SC().addAttachment(rec, f.file, user); // cùng một tệp căn cứ (metadata/đường dẫn), không tạo bản sao nội dung
      return rec;
    });
    olds.forEach(r => SC().update('stallPrices', r.id, { effectiveTo: fc.prevDay(eff), replacedById: created.find(x => x.areaTypeId === r.areaTypeId).id }, user, 'Ngừng áp dụng',
      'Thay bằng ' + legalBasis.docNo + ' từ ' + U.dmy(eff)));
    return { ok: true, created, replaced: olds };
  };

  // ---- View ----
  function currentMatrixHtml() {
    const head = [{ t: 'Hạng chợ' }].concat(AREA().map(k => ({ t: U.areaTypeLabel(k) + ' (đ/m²/ngày)', num: true })));
    const rows = GRADES.map(g => {
      const cell = k => { const r = sharedRows().filter(x => x.areaTypeId === k && (x.marketGrades || []).includes(g) && SC().policyActiveAt(x, today())).sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')))[0];
        return r ? `${fmt(r.amount)}<div class="small muted">${U.esc((r.legalBasis || {}).docNo || '—')}</div>` : '-'; };
      return `<tr><td><b>Hạng ${g}</b></td>${AREA().map(k => `<td class="num">${cell(k)}</td>`).join('')}</tr>`;
    });
    return U.table(head, rows);
  }
  function versionsHtml() {
    const rows = sharedRows().slice().sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')) || String(a.areaTypeId).localeCompare(String(b.areaTypeId)));
    return U.table([{ t: 'Quyết định' }, { t: 'Hạng' }, { t: 'Loại diện tích' }, { t: 'Đơn giá', num: true }, { t: 'Hiệu lực từ' }, { t: 'Trạng thái' }, { t: 'Căn cứ' }, { t: '' }],
      rows.map(r => `<tr><td><b>${U.esc((r.legalBasis || {}).docNo || '—')}</b></td><td>${U.esc((r.marketGrades || []).map(g => 'Hạng ' + g).join(', ') || '—')}</td><td>${U.esc(U.areaTypeLabel(r.areaTypeId) || '—')}</td>
        <td class="num">${fmt(r.amount)} đ/m²/ngày</td><td>${U.dmy(r.effectiveFrom)}${r.effectiveTo ? `<div class="small muted">đến ${U.dmy(r.effectiveTo)}</div>` : ''}</td><td>${fc.priceStatusTag ? fc.priceStatusTag(r) : ''}</td>
        <td>${(r.attachments || []).length ? `<span class="tag ok">${(r.attachments || []).length} tệp</span>` : '<span class="tag warn">Chưa có tệp</span>'}</td>
        <td class="nowrap"><button class="btn sm" data-act="policy-land-view" data-id="${U.esc(r.id)}">Xem</button></td></tr>`), { empty: 'Chưa có giá tham chiếu dùng chung.' });
  }
  function formHtml(f) {
    const inputs = GRADES.map(g => `<tr><td><b>Hạng ${g}</b></td>${AREA().map(k => `<td><input class="input fcm-num" type="number" min="0" step="any" data-in="fcr-price" data-g="${g}" data-k="${k}" value="${U.esc(((f.prices[g] || {})[k]) || '')}" aria-label="Hạng ${g} ${U.esc(U.areaTypeLabel(k))}"></td>`).join('')}</tr>`);
    return `<section class="card fcm-ref-form"><div class="card-h"><h3>Phiên bản quyết định mới</h3></div><div class="card-b fcm-panel">
      <div class="form-grid">
        <div class="field"><label>Số hiệu quyết định *</label><input class="input" data-in="fcr-field" data-k="docNo" value="${U.esc(f.docNo)}" placeholder="VD: 123/QĐ-UBND"></div>
        <div class="field"><label>Ngày ban hành</label><input class="input" type="date" data-in="fcr-field" data-k="docDate" value="${U.esc(f.docDate)}"></div>
        <div class="field"><label>Cơ quan ban hành</label><input class="input" data-in="fcr-field" data-k="issuer" value="${U.esc(f.issuer)}"></div>
        <div class="field"><label>Trích yếu</label><input class="input" data-in="fcr-field" data-k="summary" value="${U.esc(f.summary)}"></div>
        <div class="field"><label>Ngày hiệu lực *</label><input class="input" type="date" data-in="fcr-field" data-k="effectiveFrom" value="${U.esc(f.effectiveFrom)}"></div>
        <div class="field"><label>Ngày hết hiệu lực</label><input class="input" type="date" data-in="fcr-field" data-k="effectiveTo" value="${U.esc(f.effectiveTo)}"></div>
      </div>
      <div><label class="small"><b>Bảng giá tham chiếu (đ/m²/ngày)</b> — để trống ô không có trong quyết định.</label>
        ${U.table([{ t: 'Hạng chợ' }].concat(AREA().map(k => ({ t: U.areaTypeLabel(k) }))), inputs)}</div>
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><label class="btn sm fcm-file">${f.file ? '📄 ' + U.esc(f.file.name) : '+ Tệp căn cứ * (PDF / ảnh)'}<input type="file" accept="application/pdf,image/*" data-ch="fcr-file"></label>
        <span class="spacer"></span><button class="btn" data-act="fcr-cancel">Hủy</button><button class="btn primary" data-act="fcr-save">Lưu phiên bản</button></div>
    </div></section>`;
  }
  fc.referenceTabHtml = function () {
    if (!fc.canManageReference()) return '<div class="card"><div class="empty">Chỉ Quản trị hệ thống được quản lý giá tham chiếu dùng chung.</div></div>';
    const f = st().refForm, r = st().refResult;
    return `<div class="fcm-panel">
      <div class="note info">Giá tham chiếu dùng chung theo hạng chợ và loại diện tích (QĐ 480 và các quyết định thay thế). Đây là dữ liệu tham chiếu: không làm chợ hoạt động, không dùng trực tiếp để tính tiền và <b>không tự cập nhật mức thu riêng của các chợ</b> — Tổ trưởng chủ động cập nhật cấu hình từng chợ khi cần. Hợp đồng/khoản thu đã khóa giá không đổi.</div>
      ${r ? `<div class="note ${r.tone}"><b>${U.esc(r.title)}</b>${r.items && r.items.length ? `<ul>${r.items.map(x => `<li>${U.esc(x)}</li>`).join('')}</ul>` : ''}</div>` : ''}
      <section class="card"><div class="card-h"><h3>Giá tham chiếu đang hiệu lực</h3><span class="spacer"></span>${f ? '' : '<button class="btn sm primary" data-act="fcr-new">+ Phiên bản quyết định mới</button>'}</div><div class="card-b">${currentMatrixHtml()}</div></section>
      ${f ? formHtml(f) : ''}
      <section class="card"><div class="card-h"><h3>Các phiên bản (lịch sử)</h3></div><div class="card-b">${versionsHtml()}<div class="small muted">Bấm "Xem" để xem chi tiết và cập nhật tệp căn cứ của từng mức tham chiếu.</div></div></section>
    </div>`;
  };

  // ---- Handlers (kiểm tra quyền lại trong handler) ----
  A.ACT['fcr-new'] = () => { if (!fc.canManageReference()) return; st().refForm = emptyForm(); st().refResult = null; A.render(); };
  A.ACT['fcr-cancel'] = () => { st().refForm = null; A.render(); };
  A.IN['fcr-field'] = el => { const f = st().refForm; if (f && fc.canManageReference() && ['docNo', 'docDate', 'issuer', 'summary', 'effectiveFrom', 'effectiveTo'].includes(el.dataset.k)) f[el.dataset.k] = el.value; };
  A.IN['fcr-price'] = el => { const f = st().refForm; if (!f || !fc.canManageReference()) return; const g = el.dataset.g; f.prices[g] = f.prices[g] || {}; f.prices[g][el.dataset.k] = el.value; };
  A.CH['fcr-file'] = el => {
    const f = st().refForm, file = el.files && el.files[0];
    if (!f || !file || !fc.canManageReference()) return;
    if (!fc.evidenceFileOk(file)) return U.toast('Chỉ nhận tệp PDF hoặc ảnh.');
    f.file = fc.evidenceFromFile(file); A.render();
  };
  A.ACT['fcr-save'] = () => {
    const out = fc.saveReferenceVersion(st().refForm, actor());
    if (out.denied) return U.toast(out.errors[0]);
    if (!out.ok) { st().refResult = { tone: 'danger', title: 'Chưa lưu được phiên bản:', items: out.errors }; A.render(); return; }
    st().refForm = null;
    st().refResult = { tone: 'ok', title: `Đã lưu phiên bản tham chiếu (${out.created.length} mức).`, items: out.replaced.length ? [`${out.replaced.length} mức tham chiếu cũ được kết thúc hiệu lực và giữ để truy vết.`, 'Mức thu riêng của các chợ không thay đổi.'] : ['Mức thu riêng của các chợ không thay đổi.'] };
    A.render(); U.toast(st().refResult.title);
  };
})(window.APP);
