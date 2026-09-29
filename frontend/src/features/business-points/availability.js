/* Contract form point picker ("Chọn điểm khả dụng"): lists the points free for the WHOLE contract term,
 * derived from the shared availability rule in business-points/service.js (point + occupying
 * contracts). Nothing is stored — filters are UI state only. The Mặt bằng screen does not open this
 * picker; its main table stays the only detailed point list there. */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  const BP = A.features.businessPoints.service;
  const PAGE_SIZE = 15;
  const allowedMarket = market => A.allowedMarkets(A.currentAccount()).includes(market);
  // Picker state (UI only): market + contract term [from, to].
  let st = null;
  const emptyFilters = () => ({ search: '', khu: '', tang: '', day: '', areaType: '', cat: '' });
  let filters = emptyFilters();

  const pathOf = p => A.mbLayoutPathForPoint ? A.mbLayoutPathForPoint(p.market, p) : { khu: '—', tang: '—', day: p.sectionName || '' };
  // Filtering happens before pagination.
  function rows() {
    const q = filters.search.trim().toLowerCase();
    return BP.availablePoints(st.market, st.from, st.to).map(p => ({ p, path: pathOf(p) })).filter(x =>
      (!q || x.p.code.toLowerCase().includes(q)) && (!filters.khu || x.path.khu === filters.khu) && (!filters.tang || x.path.tang === filters.tang)
      && (!filters.day || x.path.day === filters.day) && (!filters.areaType || x.p.areaType === filters.areaType) && (!filters.cat || x.p.cat === filters.cat)
    ).sort((a, b) => a.p.code.localeCompare(b.p.code, 'vi', { numeric: true }));
  }
  function options(key, label, values) {
    const list = Array.from(new Set(values.filter(v => v && v !== '—'))).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
    if (!list.length) return '';
    return `<select class="input" data-ch="avail-filter" data-k="${key}"><option value="">${label}: Tất cả</option>${list.map(v => `<option value="${U.esc(v)}" ${filters[key] === v ? 'selected' : ''}>${U.esc(key === 'areaType' ? U.areaTypeLabel(v) || v : v)}</option>`).join('')}</select>`;
  }
  function rowHtml(x) {
    const p = x.p, since = BP.freeSince(p.id, st.from), next = BP.nextOccupancy(p.id, st.to), current = BP.contractOn(p.id, U.today());
    const state = current ? `<span class="tag">Đang dùng đến ${U.dmy(BP.occupyingInterval(current).end)}</span>` : '<span class="tag ok">Trống hôm nay</span>';
    const where = [x.path.khu, x.path.tang].filter(v => v && v !== '—').join(' · ');
    return `<tr><td class="nowrap"><b>${U.esc(p.code)}</b></td><td><b class="avail-row">${U.esc(x.path.day || p.sectionName || '')}</b>${where ? `<div class="small muted">${U.esc(where)}</div>` : ''}</td><td class="num nowrap">${Number(p.area || 0).toLocaleString('vi-VN')} m²</td><td>${U.esc(U.areaTypeLabel(p.areaType) || 'Chưa có thông tin')}</td><td>${U.esc(p.cat || '')}</td><td>${since ? U.dmy(since) : '<span class="small muted">Chưa ghi nhận HĐ</span>'}</td><td>${state}${next ? `<div class="small muted">Đã có lịch bố trí từ ${U.dmy(next.interval.start)}</div>` : ''}</td><td><div class="avail-actions"><button class="btn sm primary" data-act="avail-pick" data-id="${p.id}">Chọn</button></div></td></tr>`;
  }
  function render() {
    const all = A.mbBusinessPointsForMarket(st.market), paths = all.map(pathOf);
    const list = rows(), pg = A.UI.pending.pager({ key: 'availPoints', total: list.length, size: PAGE_SIZE, action: 'avail-page' });
    const filterHtml = `<div class="avail-filters"><input class="input" data-in="avail-search" placeholder="Tìm mã điểm..." value="${U.esc(filters.search)}">${options('khu', 'Khu', paths.map(x => x.khu))}${options('tang', 'Tầng', paths.map(x => x.tang))}${options('day', 'Dãy', paths.map(x => x.day))}${options('areaType', 'Loại diện tích', all.map(p => p.areaType))}${options('cat', 'Ngành hàng', all.map(p => p.cat))}${Object.keys(filters).some(k => filters[k]) ? '<button class="btn sm" data-act="avail-clear">↺ Xóa bộ lọc</button>' : ''}</div>`;
    const table = U.table([{ t: 'Mã điểm' }, { t: 'Vị trí' }, { t: 'Diện tích', num: true }, { t: 'Loại diện tích' }, { t: 'Ngành hàng' }, { t: 'Trống từ' }, { t: 'Tình trạng' }, { t: 'Thao tác' }], list.slice(pg.start, pg.end).map(rowHtml), { empty: 'Không có điểm phù hợp.' });
    A.modal(A.mHead('Chọn điểm khả dụng') + `<div class="modal-b avail-worklist"><div class="note info">Chỉ hiển thị điểm còn trống trong <b>toàn bộ</b> thời hạn hợp đồng: <b>${U.dmy(st.from)} → ${U.dmy(st.to)}</b>.</div>${filterHtml}<div class="pending-worklist-meta"><b>${list.length}</b> điểm có thể bố trí trong toàn bộ khoảng ${U.dmy(st.from)} → ${U.dmy(st.to)}</div><div class="avail-table">${table}</div>${pg.html}</div><div class="modal-f"><button class="btn" data-act="avail-pick-cancel">← Quay lại hợp đồng</button></div>`, true);
  }
  // Opened only by the contract form with the contract term.
  function open(opts) {
    const o = opts || {}, market = o.market || ui.market;
    if (!market || market === 'ALL' || !allowedMarket(market)) return U.toast('Vui lòng chọn một chợ trong phạm vi tài khoản.');
    if (!o.from || !o.to || o.to < o.from) return U.toast('Vui lòng nhập ngày bắt đầu và ngày kết thúc hợp lệ trước khi chọn điểm.');
    if (!st || st.market !== market) filters = emptyFilters();
    st = { market, from: o.from, to: o.to };
    ui.page.availPoints = 0;
    render();
  }

  A.CH['avail-filter'] = el => { if (!st || !(el.dataset.k in filters)) return; filters[el.dataset.k] = el.value; ui.page.availPoints = 0; render(); };
  A.IN['avail-search'] = el => { if (!st) return; filters.search = el.value; ui.page.availPoints = 0; render(); };
  A.ACT['avail-clear'] = () => { if (!st) return; filters = emptyFilters(); ui.page.availPoints = 0; render(); };
  A.ACT['avail-page'] = el => { if (!st) return; ui.page[el.dataset.k] = Math.max(0, (ui.page[el.dataset.k] || 0) + Number(el.dataset.d)); render(); };
  A.ACT['avail-pick'] = el => {
    const p = A.idx.stall.get(el.dataset.id);
    if (!p || !st || p.market !== st.market) return;
    if (!BP.isAvailable(p.id, st.from, st.to)) { U.toast('Điểm ' + p.code + ' không còn trống trong thời hạn đã chọn.'); return render(); }
    st = null;
    A.features.contracts.form.pickPoint(p.id);
  };
  A.ACT['avail-pick-cancel'] = () => { st = null; A.features.contracts.form.resume(); };

  A.features.businessPoints.availability = { open };
})(window.APP);
