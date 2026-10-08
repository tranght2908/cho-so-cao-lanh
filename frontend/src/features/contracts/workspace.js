/* Contracts feature — màn "Hợp đồng" (thiết kế lại 10/2026).
 * Danh sách → Tạo hợp đồng từ hồ sơ đăng ký thuê (trader.rentalDraft) → Kết quả → Chi tiết hợp đồng.
 * Domain giữ nguyên: 1 hợp đồng = 1 điểm; tạo qua contracts.service.createFromRentalDraft
 * (createBatchWithPointAllocation + rollback toàn batch); giá = priceTerms chụp tại ngày bắt đầu, không nhập tay.
 * Scope 10/2026: KHÔNG còn Gia hạn / Chấm dứt / Thanh lý (đã retire khỏi UI). Trạng thái chỉ Chưa hiệu lực /
 * Còn hiệu lực / Đã hết hạn (suy từ ngày); hết hạn chỉ là cảnh báo, không side effect. Chợ = chợ đang chọn ở topbar.
 * Đây là implementation DUY NHẤT của module Hợp đồng (form tạo cũ create.js, popup chi tiết detail.js và các form
 * Gia hạn / Chấm dứt / Thanh lý trong page.js đã được gỡ). Dữ liệu/use case: contracts/service.js. */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  const CS = A.features.contracts.service, TS = A.features.traders.service, BP = A.features.businessPoints.service;
  const st = () => ui.contractWs || (ui.contractWs = { mode: 'list', q: '', status: '', expiring: '', from: '', to: '' });
  const pointOf = c => BP.get(c.businessPointId || c.stallId);
  const traderOf = c => TS.getProfile(c.traderId);
  const areaType = p => p ? (U.areaTypeLabel(p.areaTypeId || p.areaType) || p.areaType || '—') : '—';
  const where = p => p ? BP.location(p).label : '—';
  const canCreate = m => A.canDo('hop-dong.tao', m) || A.canDo('so-do.tao-hop-dong', m);
  const actor = () => { const a = A.currentAccount() || {}; return a.fullName || a.name || a.id || 'Không rõ'; };
  const left = c => U.days(U.today(), c.end);
  const life = c => CS.displayStatus(c);
  const expiring = c => CS.isExpiringSoon(c);
  const isLegacy = c => !!CS.DISPLAY_STATUS[life(c)].legacy;
  // Mức thu + đơn vị: U.money đã có "đ" nên bỏ "đ" đầu đơn vị ("đ/m²/ngày" → "2.500 đ/m²/ngày").
  const price = (amount, unit) => { const u = String(unit || ''); return U.money(amount) + (!u ? '' : /^đ\//.test(u) ? U.esc(u.slice(1)) : ' ' + U.esc(u)); };
  const iso = d => d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  // Thời hạn: "12 tháng" / "1 năm" khi tròn tháng (bắt đầu → trước ngày cùng ngày của tháng sau), ngược lại "N ngày".
  function durationText(start, end) {
    const n = CS.contractDuration(start, end);
    if (!n) return '—';
    for (let m = 1; m <= 600; m++) {
      const d = new Date(start + 'T00:00:00'); d.setMonth(d.getMonth() + m); d.setDate(d.getDate() - 1);
      const v = iso(d);
      if (v === end) return m % 12 === 0 ? (m / 12) + ' năm' : m + ' tháng';
      if (v > end) break;
    }
    return n + ' ngày';
  }
  // Nhãn trạng thái — đọc từ contracts.service.displayStatus (dùng chung với Mặt bằng / Điểm KD).
  function statusTag(c) { const d = CS.DISPLAY_STATUS[life(c)]; return `<span class="tag ${d.tone}">${d.label}</span>`; }
  const STATUS_OPTIONS = [['', 'Tất cả trạng thái'], ['UPCOMING', 'Chưa hiệu lực'], ['ACTIVE', 'Còn hiệu lực'], ['EXPIRED', 'Đã hết hạn'], ['LEGACY', 'Dữ liệu cũ (chấm dứt / thanh lý)']];

  // ================= Danh sách =================
  function filteredContracts() {
    const s = st(), q = String(s.q || '').trim().toLowerCase();
    return CS.list().filter(c => c.market === ui.market).filter(c => {
      const t = traderOf(c), p = pointOf(c);
      if (q && ![c.id, t && t.name, t && t.phone, p && p.code].join(' ').toLowerCase().includes(q)) return false;
      if (s.status && (s.status === 'LEGACY' ? !isLegacy(c) : life(c) !== s.status)) return false;
      if (s.expiring && !(expiring(c) && left(c) <= Number(s.expiring))) return false;
      // Khoảng hiệu lực: hợp đồng xuất hiện khi [start, end] giao với [Từ ngày, Đến ngày]
      // (start <= Đến ngày AND end >= Từ ngày); thiếu một đầu = không giới hạn đầu đó.
      if (s.from && c.end && c.end < s.from) return false;
      if (s.to && c.start && c.start > s.to) return false;
      return true;
    }).sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')) || String(b.id).localeCompare(String(a.id)));
  }
  function listView() {
    const s = st(), all = CS.list().filter(c => c.market === ui.market), rows = filteredContracts();
    const kpi = (label, value, sub) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value">${value}</div>${sub ? `<div class="k-sub">${sub}</div>` : ''}</div>`;
    const kpis = `<div class="kpis ctw-kpis">${kpi('Tổng hợp đồng', all.length)}${kpi('Còn hiệu lực', all.filter(c => life(c) === 'ACTIVE').length)}${kpi('Sắp hết hạn', all.filter(expiring).length, 'Còn hiệu lực, ≤ 30 ngày')}${kpi('Đã hết hạn', all.filter(c => life(c) === 'EXPIRED').length)}</div>`;
    const sel = (act, value, opts, label) => `<select class="input" data-ch="${act}" aria-label="${label}">${opts.map(o => `<option value="${o[0]}" ${String(value || '') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
    const filtered = !!(s.q || s.status || s.expiring || s.from || s.to);
    const filters = `<div class="card ctw-filters"><div class="filters">
      <input class="input ctw-search" data-in="ctw-q" value="${U.esc(s.q || '')}" placeholder="Tìm mã HĐ, tên tiểu thương, SĐT, mã điểm" aria-label="Tìm kiếm hợp đồng">
      ${sel('ctw-status', s.status, STATUS_OPTIONS, 'Trạng thái')}
      ${sel('ctw-expiring', s.expiring, [['', 'Sắp hết hạn: tất cả'], ['30', 'Hết hạn ≤ 30 ngày'], ['15', 'Hết hạn ≤ 15 ngày']], 'Sắp hết hạn')}
      <fieldset class="ctw-range" title="Hợp đồng có khoảng hiệu lực giao với khoảng đã chọn"><legend>Khoảng hiệu lực</legend>
        <label class="ctw-date"><span>Từ ngày</span><input class="input" type="date" data-ch="ctw-from" value="${U.esc(s.from || '')}" aria-label="Khoảng hiệu lực từ ngày"></label>
        <label class="ctw-date"><span>Đến ngày</span><input class="input" type="date" data-ch="ctw-to" value="${U.esc(s.to || '')}" aria-label="Khoảng hiệu lực đến ngày"></label></fieldset>
      ${filtered ? '<button class="btn" data-act="ctw-clear">Xóa bộ lọc</button>' : ''}</div></div>`;
    const pg = U.pager('ctw', rows.length, 25);
    const body = rows.slice(pg.start, pg.end).map(c => {
      const t = traderOf(c), p = pointOf(c);
      const due = expiring(c) ? `<div class="small ${left(c) <= 15 ? 'ctw-danger' : 'ctw-warn'}">Còn ${left(c)} ngày</div>` : '';
      return `<tr><td class="nowrap"><b>${U.esc(c.id)}</b></td><td>${t ? `<b>${U.esc(t.name)}</b><div class="small muted">${U.esc(t.phone || '')}</div>` : '—'}</td><td class="nowrap">${p ? U.esc(p.code) : '—'}</td><td>${U.esc(areaType(p))}</td><td class="nowrap">${U.dmy(c.start)}</td><td class="nowrap">${U.dmy(c.end)}</td><td class="nowrap">${durationText(c.start, c.end)}</td><td>${statusTag(c)}${due}</td><td><button class="btn sm" data-act="ct-view" data-id="${U.esc(c.id)}">Xem</button></td></tr>`;
    });
    const cols = ['Mã HĐ', 'Tiểu thương', 'Điểm KD', 'Loại diện tích', 'Ngày bắt đầu', 'Ngày kết thúc', 'Thời hạn', 'Trạng thái', 'Thao tác'].map(t => ({ t }));
    const empty = all.length ? 'Không có hợp đồng phù hợp bộ lọc.' : 'Chợ chưa có hợp đồng nào.';
    return `<div class="ctw-page"><div class="page-head"><div><h2>Hợp đồng</h2><p>Quản lý hợp đồng thuê điểm kinh doanh của tiểu thương.</p></div>${canCreate(ui.market) ? '<button class="btn primary" data-act="ct-new">+ Tạo hợp đồng</button>' : ''}</div>
      ${kpis}${filters}<div class="card ctw-table">${U.table(cols, body, { empty })}${pg.html}</div></div>`;
  }

  // Chợ phải đang hoạt động (mặt bằng đã thiết lập + cấu hình mức thu riêng) mới tạo được hợp đồng.
  function marketBlock(market) {
    const MS = A.features.markets && A.features.markets.service, m = MS && MS.get ? MS.get(market) : null;
    if (!market || !m) return 'Vui lòng chọn một chợ cụ thể trước khi tạo hợp đồng.';
    if (m.layoutStatus === 'SETUP_COMPLETED' && m.status === 'ACTIVE') return null;
    const lc = MS.lifecycle && MS.lifecycle(m.id);
    return lc && lc.stage === 'PENDING_FEE' ? 'Chợ chưa hoàn tất cấu hình mức thu.' : 'Chợ chưa hoàn tất thiết lập mặt bằng nên chưa thể tạo hợp đồng.';
  }
  const NOT_REGISTERED = 'Điểm kinh doanh này chưa được đăng ký trong hồ sơ tiểu thương. Vui lòng tạo hoặc cập nhật hồ sơ tiểu thương trước.';
  // ================= Chọn hồ sơ (modal) =================
  function pickerModal(pointId) {
    const ts = CS.tradersWithPendingRental(ui.market).filter(t => !pointId || CS.pendingRentalItems(t).some(x => x.pointId === pointId));
    const p = pointId ? BP.get(pointId) : null;
    const rows = ts.map(t => { const n = CS.pendingRentalItems(t).length; return `<button class="ctw-pick" data-act="ctw-pick-trader" data-id="${U.esc(t.id)}"><span><b>${U.esc(t.name)}</b><small>Mã hồ sơ ${U.esc(t.id)} · ${U.esc(t.phone || '—')}</small></span><span class="tag warn">${n} điểm chờ tạo hợp đồng</span></button>`; }).join('');
    const empty = `<div class="empty">${p ? 'Điểm ' + U.esc(p.code) + ' chưa thuộc hồ sơ đăng ký thuê nào đang chờ tạo hợp đồng.' : 'Chưa có hồ sơ tiểu thương nào có điểm chờ tạo hợp đồng.'}<div class="small muted" style="margin-top:6px">Đăng ký điểm thuê trong Hồ sơ tiểu thương trước, sau đó tạo hợp đồng.</div>${U.can('tieu-thuong') ? '<button class="btn" style="margin-top:10px" data-act="ctw-go-traders">Mở Hồ sơ tiểu thương</button>' : ''}</div>`;
    return A.mHead('Chọn hồ sơ tiểu thương') + `<div class="modal-b"><p class="small muted">Chỉ hiển thị hồ sơ có điểm kinh doanh ở trạng thái <b>Chờ tạo hợp đồng</b>${p ? ' và chứa điểm ' + U.esc(p.code) : ''}.</p><div class="ctw-pick-list">${rows || empty}</div></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`;
  }

  // ================= Form tạo hợp đồng =================
  const draft = () => st().create || null;
  function openCreate(traderId, opts) {
    const t = TS.getProfile(traderId);
    if (!t) return U.toast('Không tìm thấy hồ sơ tiểu thương.');
    if (t.market !== ui.market) return U.toast('Hồ sơ tiểu thương thuộc chợ khác chợ đang chọn. Vui lòng chuyển sang đúng chợ để lập hợp đồng.');
    if (!canCreate(t.market)) return U.toast('Bạn không có quyền tạo hợp đồng tại chợ này.');
    const blocked = marketBlock(t.market); if (blocked) return U.toast(blocked);
    const items = CS.pendingRentalItems(t);
    if (!items.length) return U.toast('Hồ sơ không còn điểm nào chờ tạo hợp đồng.');
    const only = opts && opts.pointId;
    const s = st();
    s.create = { traderId: t.id, market: t.market, defStart: U.today(), defEnd: '', tried: false, errors: {}, open: null, formError: '',
      rows: items.map(x => ({ pointId: x.pointId, selected: !only || x.pointId === only, start: '', end: '' })) };
    s.mode = 'create'; s.success = null;
    A.closeModal();
    if (A.current !== 'hop-dong') A.go('hop-dong'); else A.render();
  }
  // Lỗi hiển thị của 1 dòng: lỗi service (sau khi bấm tạo) hoặc lỗi ngày (ngay khi nhập sai thứ tự).
  function rowError(d, t, r) {
    if (!r.selected) return null;
    if (d.errors[r.pointId]) return d.errors[r.pointId];
    const e = CS.validateRentalRow(t, r, { datesOnly: true });
    if (!e) return null;
    return (d.tried || (r.start && r.end)) ? e : null;
  }
  function configHtml(t, r) {
    const item = CS.pendingRentalItems(t).find(x => x.pointId === r.pointId) || {}, p = BP.get(r.pointId), ch = item.charges || {};
    const at = r.start || U.today(), terms = CS.rentalPriceTerms(item, p, at);
    const yes = k => ch[k] ? '<span class="tag ok">Áp dụng</span>' : '<span class="tag">Không áp dụng</span>';
    const land = terms && terms.land ? `${price(terms.land.amount, terms.land.unit)}${terms.land.monthly ? ` · ≈ ${U.money(terms.land.monthly)}/tháng` : ''}${terms.land.docNo ? `<div class="small muted">Căn cứ: ${U.esc(terms.land.docNo)}</div>` : ''}` : '<span class="ctw-danger">Chợ chưa có mức thu mặt bằng</span>';
    const util = (k, term) => !ch[k] ? '—' : term ? price(term.price, term.unit) : '<span class="ctw-danger">Chưa có đơn giá</span>';
    const svc = !ch.marketService ? '—' : terms && (terms.services || []).length ? terms.services.map(x => `${U.esc(x.name)}: ${price(x.amount, x.unit)}`).join('<br>') : '<span class="ctw-danger">Chưa có mức thu</span>';
    return `<div class="ctw-config"><div class="ctw-config-grid"><dl class="kv"><dt>Diện tích</dt><dd>${p ? p.area + ' m²' : '—'}</dd><dt>Loại diện tích</dt><dd>${U.esc(areaType(p))}</dd><dt>Ngành hàng</dt><dd>${U.esc((p && BP.industry(p)) || item.industry || '—')}</dd><dt>Vị trí</dt><dd>${U.esc(where(p))}</dd></dl>
      <dl class="kv"><dt>Mặt bằng</dt><dd>${yes('land')} ${land}</dd><dt>Điện</dt><dd>${yes('electricity')} ${util('electricity', terms && terms.electricity)}</dd><dt>Nước</dt><dd>${yes('water')} ${util('water', terms && terms.water)}</dd><dt>Dịch vụ chợ</dt><dd>${yes('marketService')} ${svc}</dd></dl></div>
      <div class="row ctw-config-f"><span class="small muted">Xem trước theo cấu hình mức thu tại ngày ${U.dmy(at)} — chỉ đọc. Giá được chụp vào hợp đồng khi tạo.</span><span class="spacer"></span><button class="btn sm" data-act="ctw-back-profile" data-id="${U.esc(t.id)}">Quay lại hồ sơ để chỉnh</button></div></div>`;
  }
  function createView() {
    const d = draft(), t = d && TS.getProfile(d.traderId);
    if (!t) { st().mode = 'list'; st().create = null; return listView(); }
    const kv = rows => `<dl class="kv">${rows.map(x => `<dt>${x[0]}</dt><dd>${x[1]}</dd>`).join('')}</dl>`;
    const secA = kv([['Họ và tên', `<b>${U.esc(t.name)}</b>`], ['Mã hồ sơ', U.esc(t.id)], ['Số điện thoại', U.esc(t.phone || '—')], ['Số giấy tờ', U.esc((t.idType || 'CCCD') + ' · ' + (t.idNo || '—'))]]);
    const secB = `<div class="ctw-defaults"><div class="field"><label>Ngày bắt đầu mặc định</label><input class="input" type="date" data-ch="ctw-def" data-k="defStart" value="${U.esc(d.defStart || '')}"></div><div class="field"><label>Ngày kết thúc mặc định</label><input class="input" type="date" data-ch="ctw-def" data-k="defEnd" value="${U.esc(d.defEnd || '')}"></div><button class="btn" data-act="ctw-apply-all">Áp dụng cho tất cả</button></div><div class="small muted">Sao chép ngày mặc định vào các điểm đang chọn. Sau đó vẫn sửa được ngày của từng điểm.</div>`;
    const selected = d.rows.filter(r => r.selected), allOn = selected.length === d.rows.length;
    const trs = d.rows.map(r => {
      const p = BP.get(r.pointId), item = CS.pendingRentalItems(t).find(x => x.pointId === r.pointId) || {}, e = rowError(d, t, r);
      const bad = k => e && e.field === k ? 'invalid' : '';
      const state = !r.selected ? '<span class="small muted">Giữ chờ tạo HĐ</span>' : e ? `<span class="ctw-err">${U.esc(e.message)}</span>` : r.start && r.end ? '<span class="tag ok">Hợp lệ</span>' : '<span class="tag warn">Chờ tạo hợp đồng</span>';
      const main = `<tr class="${r.selected ? '' : 'ctw-off'} ${e ? 'ctw-row-err' : ''}"><td class="ctw-c"><input type="checkbox" data-ch="ctw-sel" data-id="${U.esc(r.pointId)}" ${r.selected ? 'checked' : ''} aria-label="Chọn điểm ${U.esc(p ? p.code : r.pointId)}"></td>
        <td><b>${U.esc(p ? p.code : r.pointId)}</b><div class="small muted">${U.esc(where(p))}</div></td><td>${U.esc(areaType(p))}</td><td>${U.esc((p && BP.industry(p)) || item.industry || '—')}</td>
        <td><input class="input ${bad('start')}" type="date" data-ch="ctw-row" data-id="${U.esc(r.pointId)}" data-k="start" value="${U.esc(r.start || '')}" ${r.selected ? '' : 'disabled'} aria-label="Ngày bắt đầu"></td>
        <td><input class="input ${bad('end')}" type="date" data-ch="ctw-row" data-id="${U.esc(r.pointId)}" data-k="end" value="${U.esc(r.end || '')}" ${r.selected ? '' : 'disabled'} aria-label="Ngày kết thúc"></td>
        <td class="nowrap ctw-dur">${r.start && r.end ? durationText(r.start, r.end) : '—'}</td><td class="ctw-state">${state}</td>
        <td><button class="btn sm" data-act="ctw-config" data-id="${U.esc(r.pointId)}">${d.open === r.pointId ? 'Ẩn cấu hình' : 'Xem cấu hình'}</button></td></tr>`;
      return main + (d.open === r.pointId ? `<tr class="ctw-config-row"><td colspan="9">${configHtml(t, r)}</td></tr>` : '');
    }).join('');
    const head = `<tr><th class="ctw-c"><input type="checkbox" data-ch="ctw-sel-all" ${allOn ? 'checked' : ''} aria-label="Chọn tất cả"></th><th>Điểm KD</th><th>Loại diện tích</th><th>Ngành hàng</th><th>Ngày bắt đầu *</th><th>Ngày kết thúc *</th><th>Thời hạn</th><th>Trạng thái</th><th></th></tr>`;
    const secC = `<div class="tbl-wrap ctw-rows"><table class="tbl"><thead>${head}</thead><tbody>${trs}</tbody></table></div><div class="small muted" style="margin-top:6px">Mỗi điểm được chọn tạo một hợp đồng riêng với thời hạn riêng. Điểm không chọn vẫn ở trạng thái chờ tạo hợp đồng.</div>`;
    const sum = selected.map(r => { const p = BP.get(r.pointId); return `<li><b>${U.esc(p ? p.code : r.pointId)}</b> — ${r.start && r.end ? `${U.dmy(r.start)} → ${U.dmy(r.end)} (${durationText(r.start, r.end)})` : '<span class="muted">chưa nhập đủ ngày</span>'}</li>`; }).join('');
    const n = selected.length;
    const summary = `<div class="ctw-summary"><b>Sẽ tạo ${n} hợp đồng</b>${n ? `<ul>${sum}</ul>` : '<div class="small muted">Chưa chọn điểm nào.</div>'}</div>`;
    const section = (title, sub, body) => `<section class="card ctw-section"><div class="ctw-section-h"><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div><div class="ctw-section-b">${body}</div></section>`;
    return `<div class="ctw-page ctw-form"><div class="page-head"><div><h2>Tạo hợp đồng</h2><p>Tạo hợp đồng thuê cho các điểm kinh doanh đã đăng ký trong hồ sơ tiểu thương.</p></div><button class="btn" data-act="ctw-cancel">← Danh sách hợp đồng</button></div>
      ${d.formError ? `<div class="note warn">${U.esc(d.formError)}</div>` : ''}
      ${section('A. Tiểu thương', 'Thông tin lấy từ hồ sơ — chỉ đọc.', secA)}
      ${section('B. Thời hạn mặc định', '', secB)}
      ${section('C. Điểm kinh doanh chờ tạo hợp đồng', 'Khoản thu và mức thu lấy từ hồ sơ đăng ký và cấu hình mức thu của chợ — không nhập tay.', secC)}
      ${summary}
      <div class="card ctw-footer"><span class="spacer"></span><button class="btn" data-act="ctw-cancel">Hủy</button><button class="btn primary" data-act="ctw-submit" ${n ? '' : 'disabled'}>Tạo ${n} hợp đồng</button></div></div>`;
  }

  // ================= Kết quả =================
  function successView() {
    const s = st().success, list = (s && s.ids || []).map(id => CS.get(id)).filter(Boolean);
    const rows = list.map(c => { const p = pointOf(c); return `<li><button class="btn link" data-act="ct-view" data-id="${U.esc(c.id)}">${U.esc(c.id)}</button> — Điểm ${U.esc(p ? p.code : '—')}, ${U.dmy(c.start)} → ${U.dmy(c.end)} (${durationText(c.start, c.end)})</li>`; }).join('');
    return `<div class="ctw-page ctw-form"><div class="card ctw-success"><div class="ctw-success-ico">✓</div><h2>Đã tạo ${list.length} hợp đồng thành công.</h2><ul>${rows}</ul>
      <div class="row ctw-success-f">${s && U.can('tieu-thuong') ? `<button class="btn" data-act="ctw-open-trader" data-id="${U.esc(s.traderId)}">Xem hồ sơ tiểu thương</button>` : ''}<button class="btn primary" data-act="ctw-list">Xem danh sách hợp đồng</button></div></div></div>`;
  }

  // ================= Chi tiết hợp đồng =================
  function termsTable(terms, applies) {
    if (!terms) return '<div class="small muted">Hợp đồng cũ chưa có bản chụp biểu giá.</div>';
    const a = applies || {}, row = (name, on, value) => `<tr><td>${name}</td><td>${on ? '<span class="tag ok">Áp dụng</span>' : '<span class="tag">Không áp dụng</span>'}</td><td>${on ? value : '—'}</td></tr>`;
    const l = terms.land;
    const land = l ? `${price(l.amount, l.unit)}${l.area ? ' × ' + l.area + ' m²' : ''}${l.monthly ? ` · <b>≈ ${U.money(l.monthly)}/tháng</b>` : ''}${l.docNo ? `<div class="small muted">Căn cứ: ${U.esc(l.docNo)}</div>` : ''}` : '<span class="small muted">Không có trong bản chụp</span>';
    const util = x => x ? `${price(x.price, x.unit)}${x.docNo ? `<div class="small muted">Căn cứ: ${U.esc(x.docNo)}</div>` : ''}` : '<span class="small muted">Không có trong bản chụp</span>';
    const svc = (terms.services || []).length ? terms.services.map(x => `${U.esc(x.name)}: ${price(x.amount, x.unit)}`).join('<br>') : '<span class="small muted">Không có trong bản chụp</span>';
    return `<div class="tbl-wrap"><table class="tbl ctw-terms"><thead><tr><th>Khoản thu</th><th>Áp dụng</th><th>Mức thu</th></tr></thead><tbody>${row('Mặt bằng', true, land)}${row('Điện', !!a.electricity, util(terms.electricity))}${row('Nước', !!a.water, util(terms.water))}${row('Dịch vụ chợ', !!a.marketService, svc)}</tbody></table></div>`;
  }
  function detailView() {
    const c = CS.get(st().detailId);
    if (!c || c.market !== ui.market) { st().mode = 'list'; st().detailId = null; return listView(); }
    const t = traderOf(c), p = pointOf(c);
    const kv = rows => `<dl class="kv">${rows.map(x => `<dt>${x[0]}</dt><dd>${x[1]}</dd>`).join('')}</dl>`;
    const block = (title, body) => `<section class="card ctw-block"><h3>${title}</h3>${body}</section>`;
    const renewals = CS.renewalsForContract(c.id);
    const info = kv([['Mã hợp đồng', `<b>${U.esc(c.id)}</b>`], ['Ngày bắt đầu', U.dmy(c.start)], ['Ngày kết thúc', U.dmy(c.end) + (renewals.length ? ` <span class="small muted">(đã gia hạn ${renewals.length} lần)</span>` : '')], ['Thời hạn', durationText(c.start, c.end)], ['Trạng thái', statusTag(c) + (expiring(c) ? ` <span class="small ${left(c) <= 15 ? 'ctw-danger' : 'ctw-warn'}">còn ${left(c)} ngày</span>` : '')]]
      // Dữ liệu cũ (chấm dứt / thanh lý) chỉ đọc.
      .concat(c.termination && c.termination.date ? [['Ngày chấm dứt (dữ liệu cũ)', U.dmy(c.termination.date) + (c.termination.reason ? ' · ' + U.esc(c.termination.reason) : '')]] : [])
      .concat(c.liquidatedAt ? [['Ngày thanh lý (dữ liệu cũ)', U.dmy(c.liquidatedAt)]] : []));
    const traderBlock = t ? kv([['Họ và tên', U.can('tieu-thuong') ? `<button class="btn link" data-act="ctw-open-trader" data-id="${U.esc(t.id)}">${U.esc(t.name)}</button>` : U.esc(t.name)], ['Mã hồ sơ', U.esc(t.id)], ['Số điện thoại', U.esc(t.phone || '—')], ['Số giấy tờ', U.esc((t.idType || 'CCCD') + ' · ' + (t.idNo || '—'))]]) : '<div class="small muted">Không tìm thấy hồ sơ tiểu thương.</div>';
    const pointBlock = p ? kv([['Mã điểm', U.can('mat-bang') ? `<button class="btn link" data-act="ctw-open-point" data-id="${U.esc(p.id)}">${U.esc(p.code)}</button>` : `<b>${U.esc(p.code)}</b>`], ['Vị trí', U.esc(where(p))], ['Diện tích', p.area + ' m²'], ['Loại diện tích', U.esc(areaType(p))], ['Ngành hàng', U.esc(BP.industry(p) || '—')]]) : '<div class="small muted">Không tìm thấy điểm kinh doanh.</div>';
    // Bản chụp lúc tạo hợp đồng (c.priceTerms) — KHÔNG đọc lại cấu hình hiện hành.
    const charges = `<div class="small muted" style="margin-bottom:8px">Áp dụng theo cấu hình tại thời điểm tạo hợp đồng.${c.priceTerms && c.priceTerms.at ? ' (Ngày chụp: ' + U.dmy(c.priceTerms.at) + ')' : ''}</div>${termsTable(c.priceTerms, c.serviceApplicability)}`;
    // Chỉ còn thao tác In (nếu có quyền). Gia hạn / Chấm dứt / Thanh lý đã retire khỏi UI ở mọi trạng thái.
    const btn = A.canDo('hop-dong.in', c.market) ? [`<button class="btn" data-act="ct-print" data-id="${U.esc(c.id)}">In</button>`] : [];
    // Hết hạn chỉ là cảnh báo của hợp đồng: không đổi điểm KD, hồ sơ hay danh sách đăng ký thuê.
    const notice = life(c) === 'EXPIRED' ? `<div class="note warn ctw-expired">Hợp đồng này đã hết hạn từ ngày ${U.dmy(c.end)}.</div>`
      : isLegacy(c) ? '<div class="note ctw-legacy">Hợp đồng dữ liệu cũ (đã chấm dứt / thanh lý theo quy trình trước đây) — chỉ đọc.</div>' : '';
    const hist = (c.history || []).slice(0, 8).map(h => `<tr><td class="nowrap">${U.esc(h.at || '—')}</td><td>${U.esc(h.action || '')}</td><td>${U.esc(h.detail || '')}</td></tr>`).join('');
    return `<div class="ctw-page ctw-form"><div class="page-head ctw-detail-head"><div><h2>Hợp đồng ${U.esc(c.id)} ${statusTag(c)}</h2><p>${t ? U.esc(t.name) : '—'} · Điểm ${p ? U.esc(p.code) : '—'}</p></div><div class="ctw-actions">${btn.join('')}<button class="btn" data-act="ctw-list">← Danh sách</button></div></div>${notice}
      <div class="ctw-detail-grid">${block('Thông tin hợp đồng', info)}${block('Tiểu thương', traderBlock)}${block('Điểm kinh doanh', pointBlock)}${block('Khoản thu áp dụng', charges)}</div>
      ${hist ? `<section class="card ctw-block"><h3>Lịch sử</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Thời gian</th><th>Sự kiện</th><th>Mô tả</th></tr></thead><tbody>${hist}</tbody></table></div></section>` : ''}</div>`;
  }

  // ================= Điều hướng & handler =================
  A.VIEWS['hop-dong'] = function () {
    const s = st();
    if (s.create && s.create.market !== ui.market) { s.create = null; if (s.mode === 'create') s.mode = 'list'; }
    if (s.mode === 'create' && s.create) return createView();
    if (s.mode === 'success' && s.success) return successView();
    if (s.mode === 'detail' && s.detailId) return detailView();
    s.mode = 'list';
    return listView();
  };
  A.IN['ctw-q'] = el => { st().q = el.value; ui.page.ctw = 0; A.render(); };
  A.CH['ctw-status'] = el => { st().status = el.value; ui.page.ctw = 0; A.render(); };
  A.CH['ctw-expiring'] = el => { st().expiring = el.value; ui.page.ctw = 0; A.render(); };
  A.CH['ctw-from'] = el => { st().from = el.value; ui.page.ctw = 0; A.render(); };
  A.CH['ctw-to'] = el => { st().to = el.value; ui.page.ctw = 0; A.render(); };
  A.ACT['ctw-clear'] = () => { Object.assign(st(), { q: '', status: '', expiring: '', from: '', to: '' }); ui.page.ctw = 0; A.render(); };
  A.ACT['ctw-list'] = () => { const s = st(); s.mode = 'list'; s.detailId = null; s.success = null; A.closeModal(); if (A.current !== 'hop-dong') A.go('hop-dong'); else A.render(); };
  // + Tạo hợp đồng: luôn bắt đầu từ hồ sơ có điểm chờ tạo hợp đồng (không nhập tiểu thương / giá tại đây).
  A.ACT['ct-new'] = el => {
    const ds = el && el.dataset ? el.dataset : {};
    if (!canCreate(ui.market)) return U.toast('Bạn không có quyền tạo hợp đồng tại chợ này.');
    const blocked = marketBlock(ui.market); if (blocked) return U.toast(blocked);
    if (ds.trader) return openCreate(ds.trader, { pointId: ds.point });
    // Từ Mặt bằng: chỉ khi điểm đã được đăng ký (pending_contract) trong hồ sơ — không tạo hợp đồng trực tiếp.
    // Luồng chuẩn: Điểm trống → Hồ sơ tiểu thương → Đăng ký điểm → Hợp đồng → Điểm Đang thuê.
    if (ds.point) {
      const ts = CS.tradersWithPendingRental(ui.market).filter(t => CS.pendingRentalItems(t).some(x => x.pointId === ds.point));
      if (!ts.length) return U.toast(NOT_REGISTERED);
      if (ts.length === 1) return openCreate(ts[0].id, { pointId: ds.point });
    }
    A.modal(pickerModal(ds.point || null));
  };
  A.ACT['ctw-pick-trader'] = el => openCreate(el.dataset.id);
  A.ACT['ctw-open-create'] = el => openCreate(el.dataset.trader || el.dataset.id);
  A.ACT['ctw-go-traders'] = () => { A.closeModal(); if (U.can('tieu-thuong')) A.go('tieu-thuong'); };
  A.ACT['ctw-cancel'] = () => { const s = st(); s.create = null; s.mode = 'list'; A.render(); };
  A.CH['ctw-def'] = el => { const d = draft(); if (!d || !['defStart', 'defEnd'].includes(el.dataset.k)) return; d[el.dataset.k] = el.value; A.render(); };
  A.ACT['ctw-apply-all'] = () => {
    const d = draft(); if (!d) return;
    if (!d.defStart || !d.defEnd) return U.toast('Vui lòng nhập ngày bắt đầu và ngày kết thúc mặc định.');
    if (d.defEnd < d.defStart) return U.toast('Ngày kết thúc mặc định phải từ ngày bắt đầu trở về sau.');
    const on = d.rows.filter(r => r.selected);
    if (!on.length) return U.toast('Chưa chọn điểm nào.');
    on.forEach(r => { r.start = d.defStart; r.end = d.defEnd; delete d.errors[r.pointId]; });
    d.formError = ''; A.render();
  };
  A.CH['ctw-sel'] = el => { const d = draft(), r = d && d.rows.find(x => x.pointId === el.dataset.id); if (!r) return; r.selected = !!el.checked; delete d.errors[r.pointId]; A.render(); };
  A.CH['ctw-sel-all'] = el => { const d = draft(); if (!d) return; d.rows.forEach(r => { r.selected = !!el.checked; }); d.errors = {}; A.render(); };
  A.CH['ctw-row'] = el => { const d = draft(), r = d && d.rows.find(x => x.pointId === el.dataset.id); if (!r || !['start', 'end'].includes(el.dataset.k)) return; r[el.dataset.k] = el.value; delete d.errors[r.pointId]; A.render(); };
  A.ACT['ctw-config'] = el => { const d = draft(); if (!d) return; d.open = d.open === el.dataset.id ? null : el.dataset.id; A.render(); };
  A.ACT['ctw-back-profile'] = el => { const s = st(); s.create = null; s.mode = 'list'; A.ACT['ctw-open-trader']({ dataset: { id: el.dataset.id } }); };
  A.ACT['ctw-submit'] = () => {
    const d = draft(), t = d && TS.getProfile(d.traderId);
    if (!d || !t) return;
    // Đổi chợ đang chọn khi form còn mở → hủy bản nháp, không bao giờ lưu sang chợ mới.
    if (d.market !== ui.market || t.market !== ui.market) { const s0 = st(); s0.create = null; s0.mode = 'list'; A.render(); return U.toast('Chợ đang chọn đã thay đổi. Bản nháp hợp đồng đã được huỷ, vui lòng mở lại form tại chợ mới.'); }
    if (!canCreate(t.market)) return U.toast('Bạn không có quyền tạo hợp đồng tại chợ này.');
    const rows = d.rows.filter(r => r.selected).map(r => ({ pointId: r.pointId, start: r.start, end: r.end }));
    d.tried = true; d.errors = {}; d.formError = '';
    if (!rows.length) { d.formError = 'Vui lòng chọn ít nhất một điểm kinh doanh.'; A.render(); return U.toast(d.formError); }
    // Kiểm tra toàn bộ trước khi ghi; một dòng sai → không tạo hợp đồng nào.
    const result = CS.createFromRentalDraft(t.id, rows, { actor: actor() });
    if (!result.ok) { d.errors = result.errors || {}; d.formError = result.message; A.render(); return U.toast(result.message); }
    result.contracts.forEach(c => U.log('Tạo hợp đồng ' + c.id + ' — điểm ' + ((BP.get(c.businessPointId) || {}).code || c.businessPointId) + ' cho ' + t.name));
    A.save();
    const s = st(); s.create = null; s.success = { traderId: t.id, ids: result.contracts.map(c => c.id) }; s.mode = 'success';
    A.render();
    U.toast('Đã tạo ' + result.contracts.length + ' hợp đồng thành công.');
  };
  A.ACT['ct-view'] = el => {
    const c = CS.get(el.dataset.id);
    if (!c) return U.toast('Không tìm thấy hợp đồng.');
    if (c.market !== ui.market) return U.toast('Hợp đồng thuộc chợ khác với chợ đang chọn.');
    const s = st(); s.mode = 'detail'; s.detailId = c.id;
    A.closeModal();
    if (A.current !== 'hop-dong') A.go('hop-dong'); else A.render();
  };
  A.ACT['ctw-open-trader'] = el => {
    const t = TS.getProfile(el.dataset.id);
    if (!t || !U.can('tieu-thuong')) return;
    const ws = ui.traderWorkspace || (ui.traderWorkspace = { q: '', status: '', contract: '', areaType: '', wizard: null, detail: null, tab: 'overview' });
    ws.wizard = null; ws.detail = t.id; ws.tab = 'overview';
    A.closeModal(); A.go('tieu-thuong');
  };
  A.ACT['ctw-open-point'] = el => {
    const p = BP.get(el.dataset.id);
    if (!p || !U.can('mat-bang')) return;
    if (ui.mb) { ui.mb.pointId = p.id; ui.mb.inspectorOpen = true; }
    A.go('mat-bang');
  };
  // In hợp đồng giấy (quyền hop-dong.in): dữ liệu từ hợp đồng + bản chụp giá priceTerms, không đọc giá hiện hành.
  A.ACT['ct-print'] = el => {
    const c = CS.get(el.dataset.id);
    if (!c || !A.canDo('hop-dong.in', c.market)) return;
    const t = traderOf(c), p = pointOf(c), l = c.priceTerms && c.priceTerms.land;
    CS.recordEvent(c.id, { at: U.dmy(U.today()) + ' ' + U.nowTime(), action: 'In hợp đồng', detail: 'In biểu mẫu để ký giấy', by: actor() });
    const w = window.open('', '_blank');
    if (!w) return U.toast('Trình duyệt đã chặn cửa sổ in.');
    const land = l ? price(l.amount, l.unit) + (l.monthly ? ' (≈ ' + U.money(l.monthly) + '/tháng)' : '') : '—';
    w.document.write(`<html><head><title>${U.esc(c.id)}</title><style>body{font:15px Arial;max-width:760px;margin:40px auto;line-height:1.7}h1{text-align:center}table{width:100%;border-collapse:collapse}td{border:1px solid #555;padding:8px}.sign{display:flex;justify-content:space-between;margin-top:80px;text-align:center}</style></head><body><h1>HỢP ĐỒNG THUÊ ĐIỂM KINH DOANH</h1><p><b>Mã hợp đồng:</b> ${U.esc(c.id)}</p><p><b>Ban Quản lý:</b> Chợ ${U.esc(U.mShort(c.market))} · UBND phường Cao Lãnh</p><table><tr><td>Tiểu thương</td><td>${t ? U.esc(t.name) + ' · ' + U.esc(t.id) : ''}</td></tr><tr><td>Điểm kinh doanh</td><td>${p ? U.esc(p.code) + ' · ' + U.esc(where(p)) : ''}</td></tr><tr><td>Thời hạn</td><td>${U.dmy(c.start)} – ${U.dmy(c.end)} (${durationText(c.start, c.end)})</td></tr><tr><td>Mặt bằng</td><td>${land}</td></tr></table><div class="sign"><div>ĐẠI DIỆN BQL<br><br><br><br>Ký, ghi rõ họ tên</div><div>TIỂU THƯƠNG<br><br><br><br>Ký, ghi rõ họ tên</div></div><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };
  A.features.contracts.workspace = { open: openCreate, durationText, statusTag };
})(window.APP);
