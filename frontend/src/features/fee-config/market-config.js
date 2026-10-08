/* Màn "Chính sách thu và biểu phí" (route cau-hinh-gia) — cấu hình mức thu RIÊNG theo từng chợ (10/2026).
 * Chi tiết 1 chợ = MỘT trang: thông tin chợ · 4 thẻ (Mặt bằng / Điện / Nước / Dịch vụ) · lịch sử đơn giá; thiết lập /
 * thay đổi qua popup. Quản trị hệ thống có thêm "Thao tác khác → Đặt lại cấu hình mức thu" (quyền
 * cau-hinh-gia.dat-lai-cau-hinh-cho; chỉ mức thu chưa sử dụng; có sao lưu) — Tổ trưởng vẫn là người thiết lập giá.
 *
 * Mỗi chợ có MỘT cấu hình mức thu riêng = các bản ghi sẵn có của SERVICE_CFG thuộc riêng chợ đó
 * (isMarketOwnedPolicy: marketId = chợ, không SHARED) + khai báo khoản thu áp dụng (utilityModes[mid].charges):
 *   - Mặt bằng   : stallPrices theo areaTypeId (3 loại chuẩn, đ/m²/ngày) — khoản chính, luôn áp dụng.
 *   - Điện / Nước: utilities (kind ELECTRICITY / WATER — elecPrice đ/kWh, waterPrice đ/m³).
 *   - Dịch vụ    : extraServices của chợ (không tính phí gửi xe — category VEHICLE).
 * QĐ 480 (bản ghi SHARED theo hạng) chỉ là giá THAM CHIẾU/preset: "Áp dụng các mức giá này" chỉ điền vào bản
 * nháp; chỉ khi bấm "Lưu cấu hình mức thu" mới tạo bản ghi riêng của chợ. Không có nguồn cấu hình giá thứ hai.
 *
 * Lưu: thay đổi giá → feeConfig.addPriceVersion (DÙNG CHUNG với form cũ — KHOA_GIA_THEO_HOP_DONG: hiệu lực từ ngày
 * 01, bắt buộc tệp căn cứ, mức cũ "Ngừng áp dụng từ …" nhưng vẫn active cho HĐ cũ); khoản thu áp dụng →
 * setChargeApplicability. Mỗi lần lưu
 * SERVICE_CFG báo onChange → lifecycle chuẩn hóa vòng đời (đủ điều kiện → ACTIVE, không có nút kích hoạt).
 * Trạng thái cấu hình / điều kiện hoạt động đọc từ lifecycle.service (marketFeeStatus, marketLifecycle) — UI
 * không tự suy luận. Quyền: screen:cau-hinh-gia (xem) + action:cau-hinh-gia.them-phi (sửa) + marketScopes.
 */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  const SC = () => A.SERVICE_CFG, MC = () => A.features.markets.service, L = () => A.features.lifecycle.service;
  const BP = () => A.features.businessPoints.service;
  const fc = A.features.feeConfig || (A.features.feeConfig = {});
  const AREA = () => U.AREA_TYPE_CODES || [];
  const CHARGES = [['electricity', 'Điện'], ['water', 'Nước'], ['service', 'Dịch vụ']];
  const TABS = [['charges', 'Khoản thu áp dụng'], ['land', 'Tiền mặt bằng'], ['electricity', 'Điện'], ['water', 'Nước'], ['service', 'Dịch vụ'], ['qd480', 'Giá tham chiếu QĐ 480']];
  const UTIL = { electricity: { kind: 'ELECTRICITY', field: 'elecPrice', unitField: 'elecUnit', unit: 'đ/kWh', name: 'Điện', noun: 'điện', charge: 'ELECTRICITY' },
    water: { kind: 'WATER', field: 'waterPrice', unitField: 'waterUnit', unit: 'đ/m³', name: 'Nước', noun: 'nước', charge: 'WATER' } };
  const SVC_CALC = [['fixed', 'đ/điểm/tháng'], ['area', 'đ/m²/tháng']];
  const today = () => (A.db && A.db.today) || U.today();
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const actor = () => { const acc = A.currentAccount(); return acc ? acc.fullName : 'Không rõ'; };
  const allowedIds = () => A.allowedMarkets(A.currentAccount());
  const scopedMarkets = () => { const s = new Set(allowedIds()); return MC().rows().filter(m => s.has(m.id)); };
  const canEdit = mid => U.can('cau-hinh-gia') && A.canDo('cau-hinh-gia.them-phi') && allowedIds().indexOf(mid) !== -1;
  const owned = (cat, mid) => (SC().list(cat) || []).filter(r => SC().isMarketOwnedPolicy(r, mid) && r.status !== 'cancelled');
  const live = r => SC().policyActiveAt(r, today());
  const byEffDesc = (a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || ''));
  const latest = rows => rows.slice().sort(byEffDesc)[0] || null;
  const statusTag = r => fc.priceStatusTag ? fc.priceStatusTag(r) : `<span class="tag ${live(r) ? 'ok' : ''}">${live(r) ? 'Đang áp dụng' : 'Không áp dụng'}</span>`;
  const isService = x => x.category !== 'VEHICLE';
  const num = v => { const s = String(v === null || v === undefined ? '' : v).trim().replace(',', '.'); return s === '' ? null : Number(s); };

  // ---- Bản ghi riêng hiện hành của chợ ----
  function current(mid) {
    const land = {}, lands = owned('stallPrices', mid);
    AREA().forEach(k => { land[k] = latest(lands.filter(r => r.areaTypeId === k && live(r))); });
    const utils = owned('utilities', mid);
    const util = c => latest(utils.filter(u => live(u) && (!u.kind || u.kind === c.kind) && u[c.field] != null));
    return { land, lands, legacyLand: lands.filter(r => !r.areaTypeId && live(r)), utils,
      electricity: util(UTIL.electricity), water: util(UTIL.water), services: owned('extraServices', mid).filter(isService) };
  }
  const hasAnyLive = cur => AREA().some(k => cur.land[k]) || !!cur.electricity || !!cur.water || cur.services.some(live);
  function pointsByType(mid) {
    const out = { _legacy: 0 };
    BP().list().forEach(st => {
      if (st.market !== mid || !BP().isCountable(st)) return;
      const k = st.areaTypeId || '';
      if ((U.LEGACY_AREA_TYPE_CODES || []).indexOf(k) !== -1) { out._legacy++; return; }
      out[k] = (out[k] || 0) + 1;
    });
    return out;
  }

  // ---- Trạng thái UI (không lưu) ----
  const st = () => ui.feeCfg || (ui.feeCfg = { view: 'list', tab: 'list', marketId: null, dtab: 'charges', popup: null, reset: null, draft: null, result: null, filter: { q: '', status: '', rank: '' }, histMarket: '' });
  function draftFor(mid) {
    const f = st();
    if (f.draft && f.draft.mid === mid) return f.draft;
    const cur = current(mid), ch = SC().chargeApplicability(mid);
    const land = {};
    AREA().forEach(k => { land[k] = cur.land[k] ? String(cur.land[k].amount) : ''; });
    f.draft = {
      mid, land, preset: {},
      charges: ch ? { electricity: ch.electricity, water: ch.water, service: ch.service } : { electricity: null, water: null, service: null },
      electricity: { price: cur.electricity ? String(cur.electricity.elecPrice) : '', note: '' },
      water: { price: cur.water ? String(cur.water.waterPrice) : '', note: '' },
      services: {}, newServices: [], seq: 1, file: null,
      // Giá mới chỉ hiệu lực từ ngày 01: chợ chưa có mức riêng → 01 tháng này; đang thay mức → 01 tháng sau.
      effectiveFrom: hasAnyLive(cur) ? fc.nextMonthStart() : today().slice(0, 8) + '01'
    };
    return f.draft;
  }

  // ---------- Danh sách cấu hình ----------
  function chargeTags(mid) {
    const ch = SC().chargeApplicability(mid);
    const tag = (on, label) => on === true ? `<span class="tag ok" title="Áp dụng">${label}</span>`
      : on === false ? `<span class="tag fcm-off" title="Không áp dụng">${label}</span>` : `<span class="tag danger" title="Chưa khai báo">${label}?</span>`;
    return `<div class="fcm-charges">${tag(true, 'Mặt bằng')}${CHARGES.map(c => tag(ch ? ch[c[0]] : null, c[1])).join('')}</div>`;
  }
  function latestEffective(mid) {
    const rows = ['stallPrices', 'utilities', 'extraServices'].flatMap(cat => owned(cat, mid)).filter(r => r.status === 'active' && r.effectiveFrom);
    const d = rows.map(r => r.effectiveFrom).sort().pop();
    return d ? U.dmy(d) : '—';
  }
  function listRows() {
    const f = st().filter, q = String(f.q || '').trim().toLowerCase();
    return scopedMarkets().map(m => ({ m, s: L().marketFeeStatus(m.id), state: cardStates(m.id).market })).filter(x => x.s &&
      (!q || [x.m.name, x.m.code, x.m.id].join(' ').toLowerCase().includes(q)) && (!f.status || x.state === f.status) && (!f.rank || x.m.rank === f.rank));
  }
  function listHtml() {
    const f = st().filter, rows = listRows();
    const table = U.table([{ t: 'STT' }, { t: 'Mã chợ' }, { t: 'Tên chợ' }, { t: 'Hạng chợ' }, { t: 'Khoản thu áp dụng' }, { t: 'Trạng thái cấu hình' }, { t: 'Hiệu lực gần nhất' }, { t: 'Thao tác' }],
      rows.map((x, i) => `<tr><td>${i + 1}</td><td>${U.esc(x.m.code)}</td><td><b>${U.esc(x.m.name)}</b>${x.s.lifecycle.stage === 'PENDING_FEE' ? '<div class="small muted">Bước hiện tại: Chờ cấu hình mức thu</div>' : ''}</td>
        <td>${U.esc(MC().RANKS[x.m.rank] || '—')}</td><td>${chargeTags(x.m.id)}</td><td><span class="tag ${MARKET_STATE[x.state][1]}">${MARKET_STATE[x.state][0]}</span></td><td>${latestEffective(x.m.id)}</td>
        <td class="nowrap"><button class="btn sm" data-act="fcm-open" data-id="${U.esc(x.m.id)}">${canEdit(x.m.id) ? 'Xem / Sửa' : 'Xem'}</button></td></tr>`), { empty: 'Không có chợ phù hợp.' });
    return `<div class="card fcm-list"><div class="card-b">
      <div class="filters fcm-filters">
        <input class="input fcm-search" data-in="fcm-q" value="${U.esc(f.q)}" placeholder="Tìm theo tên chợ, mã chợ..." aria-label="Tìm chợ">
        <select class="input" data-ch="fcm-status" aria-label="Trạng thái cấu hình"><option value="">Trạng thái: Tất cả</option>${Object.keys(MARKET_STATE).map(k => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${MARKET_STATE[k][0]}</option>`).join('')}</select>
        <select class="input" data-ch="fcm-rank" aria-label="Hạng chợ"><option value="">Hạng chợ: Tất cả</option>${Object.keys(MC().RANKS).map(k => `<option value="${k}" ${f.rank === k ? 'selected' : ''}>${MC().RANKS[k]}</option>`).join('')}</select>
      </div>
      <div class="small muted fcm-legend">Khoản thu (khai báo áp dụng, không phải tình trạng sơ đồ mặt bằng): <span class="tag ok">Áp dụng</span> <span class="tag fcm-off">Không áp dụng</span> <span class="tag danger">Chưa khai báo?</span> · Giá tham chiếu QĐ 480 không được tính là cấu hình của chợ.</div>
      ${table}</div></div>`;
  }

  // ---------- Lịch sử thay đổi ----------
  const histTime = t => { const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]*(\d{1,2}):(\d{2})/.exec(t || '') || /(\d{1,2}):(\d{2})(?::\d{2})? (\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t || '');
    if (!m) return ''; return m[0].indexOf(':') < m[0].indexOf('/') ? `${m[5]}${String(m[4]).padStart(2, '0')}${String(m[3]).padStart(2, '0')}${String(m[1]).padStart(2, '0')}${m[2]}` : `${m[3]}${String(m[2]).padStart(2, '0')}${String(m[1]).padStart(2, '0')}${String(m[4]).padStart(2, '0')}${m[5]}`; };
  function historyEntries(mids) {
    const out = [], label = (cat, r) => cat === 'stallPrices' ? 'Mặt bằng · ' + (r.areaTypeId ? U.areaTypeLabel(r.areaTypeId) : (r.stallType || '—'))
      : cat === 'utilities' ? (r.kind === 'WATER' || (!r.kind && r.elecPrice == null) ? 'Nước' : 'Điện') : 'Dịch vụ · ' + (r.name || '—');
    mids.forEach(mid => {
      ['stallPrices', 'utilities', 'extraServices'].forEach(cat => owned(cat, mid).filter(r => cat !== 'extraServices' || isService(r))
        .forEach(r => (r.history || []).forEach(h => out.push({ mid, item: label(cat, r), h }))));
      ((SC().utilityModeInfo(mid) || {}).history || []).forEach(h => out.push({ mid, item: 'Khoản thu áp dụng', h }));
    });
    return out.sort((a, b) => histTime(b.h.time).localeCompare(histTime(a.h.time)));
  }
  function historyHtml() {
    const f = st(), markets = scopedMarkets(), mid = markets.some(m => m.id === f.histMarket) ? f.histMarket : '';
    const rows = historyEntries(mid ? [mid] : markets.map(m => m.id)).slice(0, 200);
    return `<div class="card"><div class="card-b">
      <div class="filters fcm-filters"><select class="input" data-ch="fcm-hist-market" aria-label="Chợ"><option value="">Tất cả chợ</option>${markets.map(m => `<option value="${U.esc(m.id)}" ${mid === m.id ? 'selected' : ''}>${U.esc(m.name)}</option>`).join('')}</select>
      <span class="small muted">Hiển thị tối đa 200 thay đổi gần nhất của cấu hình mức thu riêng (không gồm bảng giá tham chiếu dùng chung).</span></div>
      ${U.table([{ t: 'Thời gian' }, { t: 'Chợ' }, { t: 'Hạng mục' }, { t: 'Hành động' }, { t: 'Người thực hiện' }, { t: 'Chi tiết' }],
        rows.map(x => `<tr><td class="nowrap">${U.esc(x.h.time || '—')}</td><td>${U.esc(U.mShort(x.mid))}</td><td>${U.esc(x.item)}</td><td>${U.esc(x.h.action || '—')}</td><td>${U.esc(x.h.user || '—')}</td><td>${U.esc(x.h.detail || '')}</td></tr>`), { empty: 'Chưa có thay đổi nào.' })}
    </div></div>`;
  }

  // ---------- Chi tiết cấu hình 1 chợ: MỘT trang, 4 thẻ khoản thu (10/2026) ----------
  // Thẻ chỉ hiển thị trạng thái + giá đang áp dụng; thiết lập / thay đổi giá mở popup dùng CHUNG bản nháp và service
  // lưu (fc.saveMarketFeeConfig → addPriceVersion: hiệu lực từ ngày 01, tệp căn cứ, giữ phiên bản cũ). Không có logic
  // phiên bản / tính phí riêng ở màn này.
  const CARD_STATE = { SET: ['Đã thiết lập', 'ok'], MISSING: ['Chưa thiết lập', 'warn'], NA: ['Không áp dụng', ''] };
  const MARKET_STATE = { NONE: ['Chưa cấu hình', ''], PARTIAL: ['Chưa hoàn tất', 'warn'], COMPLETE: ['Đã cấu hình', 'ok'] };
  const futureOf = rows => rows.filter(r => r.status === 'active' && r.effectiveFrom && r.effectiveFrom > today()).sort((a, b) => String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)))[0] || null;
  const tag = (x, extra) => `<span class="tag ${x[1]}">${x[0]}</span>${extra || ''}`;
  // Loại diện tích cần giá: loại đang có điểm KD; chợ chưa có điểm → các loại diện tích được phép của chợ (Danh mục chợ).
  function landScope(mid) {
    const pts = pointsByType(mid), used = AREA().filter(k => pts[k]);
    if (used.length) return { types: used, byPoints: true };
    const m = MC().get(mid) || {}, allowed = (m.allowedAreaTypeIds || []).filter(k => AREA().indexOf(k) !== -1);
    return { types: allowed.length ? allowed : AREA(), byPoints: false };
  }
  // Trạng thái thẻ / chợ tính từ dữ liệu đã lưu (giá đang hiệu lực HÔM NAY + khai báo khoản thu) — không từ nhãn cũ.
  function cardStates(mid) {
    const s = L().marketFeeStatus(mid), lc = s.lifecycle, cur = current(mid), ch = SC().chargeApplicability(mid), scope = landScope(mid);
    const landMissing = scope.types.filter(k => !cur.land[k] && (!scope.byPoints || lc.fee.missingAreaTypes.indexOf(k) !== -1));
    const states = { land: landMissing.length ? 'MISSING' : 'SET', landMissing, scope };
    ['electricity', 'water'].forEach(k => { states[k] = ch && ch[k] === false ? 'NA' : cur[k] ? 'SET' : 'MISSING'; });
    states.service = ch && ch.service === false ? 'NA' : cur.services.some(r => live(r) && r.status === 'active') ? 'SET' : 'MISSING';
    states.declared = !!ch;
    const anyOwned = ['stallPrices', 'utilities', 'extraServices'].some(cat => owned(cat, mid).some(r => cat !== 'extraServices' || isService(r)));
    const allDone = ['land', 'electricity', 'water', 'service'].every(k => states[k] !== 'MISSING') && states.declared;
    states.market = !anyOwned && !ch ? 'NONE' : allDone && s.key === 'COMPLETE' ? 'COMPLETE' : 'PARTIAL';
    return states;
  }
  fc.marketConfigState = mid => cardStates(mid);
  const canReset = mid => U.can('cau-hinh-gia') && A.canDo('cau-hinh-gia.dat-lai-cau-hinh-cho') && allowedIds().indexOf(mid) !== -1;
  function headerHtml(m, states, lc) {
    const more = canReset(m.id) ? `<details class="fcm-more"><summary class="btn sm" aria-label="Thao tác khác">Thao tác khác ▾</summary><div class="fcm-more-menu"><button class="btn sm danger" data-act="fcm-mreset-open">Đặt lại cấu hình mức thu</button></div></details>` : '';
    const notes = [];
    if (!lc.layoutReady) notes.push('Sơ đồ mặt bằng của chợ chưa thiết lập — chợ chỉ hoạt động khi đã thiết lập sơ đồ mặt bằng và đủ mức thu.');
    if (lc.feeGap) notes.push('Còn thiếu: ' + lc.feeGap.replace(/^Thiếu:\s*/, ''));
    return `<section class="card fcm-head"><div class="fcm-head-top"><button class="btn sm" data-act="fcm-back">← Danh sách</button>
        <div class="fcm-head-title"><h2>Cấu hình mức thu – ${U.esc(m.name)}</h2>
        <div class="fcm-meta"><span>Mã chợ <b>${U.esc(m.code)}</b></span><span>Hạng <b>${U.esc(MC().RANKS[m.rank] || '—')}</b></span><span>Trạng thái cấu hình ${tag(MARKET_STATE[states.market])}</span></div></div>${more}</div>
      ${notes.length ? `<div class="small muted fcm-head-notes">${notes.map(U.esc).join('<br>')}</div>` : ''}</section>`;
  }
  const actBtn = (card, has, edit) => edit ? `<button class="btn sm ${has ? '' : 'primary'}" data-act="fcm-edit" data-card="${card}">${has ? 'Thay đổi' : 'Thiết lập'}</button>` : '';
  const futureNote = (r, price) => r ? `<div class="small fcm-future">Có giá mới ${price} từ ${U.dmy(r.effectiveFrom)} (chưa áp dụng hôm nay)</div>` : '';
  function applySeg(k, ch, edit) {
    const v = ch ? ch[k] : null, dis = edit ? '' : 'disabled';
    return `<div class="seg fcm-seg"><button class="${v === true ? 'on' : ''}" data-act="fcm-apply" data-k="${k}" data-v="1" ${dis}>Áp dụng</button><button class="${v === false ? 'on' : ''}" data-act="fcm-apply" data-k="${k}" data-v="0" ${dis}>Không áp dụng</button></div>`;
  }
  function landCardHtml(mid, states, cur, edit) {
    const pts = pointsByType(mid), ref = SC().referenceLandPrices(mid, today()).prices, scope = states.scope;
    const rows = AREA().map(k => {
      const r = cur.land[k], refP = ref[k], need = scope.types.indexOf(k) !== -1, fut = futureOf(cur.lands.filter(x => x.areaTypeId === k));
      const price = r ? `<b>${fmt(r.amount)}</b> <span class="small muted">đ/m²/ngày · từ ${U.dmy(r.effectiveFrom)}</span>` : need ? '<span class="fcm-req">Chưa có giá riêng</span>' : '<span class="small muted">Không bắt buộc</span>';
      return `<tr><td><b>${U.esc(U.areaTypeLabel(k))}</b></td><td class="num">${fmt(pts[k] || 0)}</td><td>${price}${futureNote(fut, fmt(fut && fut.amount))}</td><td class="num small muted">${refP ? fmt(refP.amount) : '—'}</td></tr>`;
    });
    const scopeText = scope.byPoints ? `${scope.types.length} loại diện tích có điểm kinh doanh` : `Chợ chưa có điểm kinh doanh — áp dụng ${scope.types.length} loại diện tích được phép của chợ`;
    return `<article class="card fcm-card"><div class="fcm-card-h"><div><h3>Tiền mặt bằng</h3><div class="small muted">Khoản bắt buộc · ${scopeText}</div></div>${tag(CARD_STATE[states.land])}</div>
      <div class="tbl-wrap"><table class="tbl fcm-mini"><thead><tr><th>Loại diện tích</th><th class="num">Điểm KD</th><th>Giá riêng của chợ</th><th class="num">Tham chiếu QĐ 480</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
      <div class="small muted">Giá tham chiếu QĐ 480 chỉ để đối chiếu, không dùng để tính tiền.</div>
      <div class="fcm-card-f"><button class="btn sm" data-act="fcm-edit" data-card="land-view">Xem bảng giá & căn cứ</button>${actBtn('land', AREA().some(k => cur.land[k]), edit)}</div></article>`;
  }
  function utilCardHtml(k, states, cur, ch, edit) {
    const c = UTIL[k], r = cur[k], st0 = states[k], fut = futureOf(cur.utils.filter(u => (!u.kind || u.kind === c.kind) && u[c.field] != null));
    const body = st0 === 'NA' ? '<div class="small muted">Chợ không thu khoản này — không yêu cầu đơn giá.</div>'
      : r ? `<div class="fcm-price"><b>${fmt(r[c.field])}</b> <span>${c.unit}</span></div><div class="small muted">Hiệu lực từ ${U.dmy(r.effectiveFrom)}</div>`
        : `<div class="fcm-req">Chưa có đơn giá ${c.noun} đang hiệu lực${ch && ch[k] ? ' (bắt buộc khi áp dụng)' : ''}.</div>`;
    const undeclared = !ch ? '<div class="small fcm-undeclared">Chưa chọn Áp dụng / Không áp dụng.</div>' : '';
    return `<article class="card fcm-card"><div class="fcm-card-h"><div><h3>Tiền ${c.noun}</h3><div class="small muted">Đơn vị ${c.unit}</div></div>${tag(CARD_STATE[st0])}</div>
      ${applySeg(k, ch, edit)}${undeclared}${body}${st0 === 'NA' ? '' : futureNote(fut, fmt(fut && fut[c.field]) + ' ' + c.unit)}
      <div class="fcm-card-f">${st0 === 'NA' ? '' : actBtn(k, !!r, edit && !(ch && ch[k] === false))}</div></article>`;
  }
  function serviceCardHtml(states, cur, ch, edit) {
    const list = cur.services.filter(r => r.status === 'active' && (!r.effectiveTo || r.effectiveTo >= today())).sort(byEffDesc);
    const calcLabel = r => r.unit || (SVC_CALC.find(x => x[0] === r.calcMethod) || [0, '—'])[1];
    const rows = list.map(r => `<tr><td><b>${U.esc(r.name || '—')}</b></td><td>${U.esc(calcLabel(r))}</td><td class="num">${fmt(r.amount)}</td><td>Hàng tháng</td><td class="small">${live(r) ? 'từ ' + U.dmy(r.effectiveFrom) : '<span class="fcm-future">từ ' + U.dmy(r.effectiveFrom) + ' (chưa áp dụng)</span>'}</td></tr>`);
    const body = states.service === 'NA' ? '<div class="small muted">Chợ không thu phí dịch vụ — không yêu cầu mức thu.</div>'
      : rows.length ? `<div class="tbl-wrap"><table class="tbl fcm-mini"><thead><tr><th>Dịch vụ</th><th>Đơn vị tính</th><th class="num">Mức thu</th><th>Chu kỳ</th><th>Hiệu lực</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`
        : '<div class="fcm-req">Chưa khai báo dịch vụ nào đang hiệu lực.</div>';
    return `<article class="card fcm-card fcm-card-wide"><div class="fcm-card-h"><div><h3>Phí dịch vụ</h3><div class="small muted">Nhiều loại dịch vụ · phí gửi xe quản lý riêng, không tính ở đây</div></div>${tag(CARD_STATE[states.service])}</div>
      ${applySeg('service', ch, edit)}${!ch ? '<div class="small fcm-undeclared">Chưa chọn Áp dụng / Không áp dụng.</div>' : ''}${body}
      <div class="fcm-card-f">${states.service === 'NA' || !edit || (ch && ch.service === false) ? '' : `<button class="btn sm" data-act="fcm-edit" data-card="service">${list.length ? 'Thay đổi / thêm dịch vụ' : '+ Thêm dịch vụ'}</button>`}</div></article>`;
  }
  // Lịch sử đơn giá: mọi phiên bản mức thu riêng của chợ (kể cả đã hết hiệu lực) — chỉ đọc, không xóa.
  function priceHistoryHtml(mid) {
    const label = (cat, r) => cat === 'stallPrices' ? 'Mặt bằng · ' + (r.areaTypeId ? U.areaTypeLabel(r.areaTypeId) : (r.stallType || '—'))
      : cat === 'utilities' ? (r.kind === 'WATER' || (!r.kind && r.elecPrice == null) ? 'Nước' : 'Điện') : 'Dịch vụ · ' + (r.name || '—');
    const price = (cat, r) => cat === 'utilities' ? (r.kind === 'WATER' || (!r.kind && r.elecPrice == null) ? fmt(r.waterPrice) + ' ' + (r.waterUnit || 'đ/m³') : fmt(r.elecPrice) + ' ' + (r.elecUnit || 'đ/kWh')) : fmt(r.amount) + ' ' + (r.unit || '');
    const creator = r => { const h = (r.history || []).slice().reverse().find(x => /Tạo/.test(x.action || '')) || (r.history || [])[0]; return h ? h.user : '—'; };
    const basis = r => { const files = (r.attachments || []).map(a => a.name).filter(Boolean); const lb = r.legalBasis || {}; return files.length ? files.join(', ') : (lb.docNo || lb.note || '—'); };
    const rows = [];
    ['stallPrices', 'utilities', 'extraServices'].forEach(cat => owned(cat, mid).filter(r => cat !== 'extraServices' || isService(r)).forEach(r => rows.push({ cat, r })));
    rows.sort((a, b) => label(a.cat, a.r).localeCompare(label(b.cat, b.r)) || byEffDesc(a.r, b.r));
    return `<details class="card fcm-history" ${rows.length ? '' : 'open'}><summary><b>Lịch sử đơn giá</b> <span class="small muted">(${rows.length} phiên bản)</span></summary>
      ${U.table([{ t: 'Khoản thu' }, { t: 'Mức giá' }, { t: 'Từ ngày' }, { t: 'Đến ngày' }, { t: 'Trạng thái' }, { t: 'Người cập nhật' }, { t: 'Văn bản căn cứ' }],
        rows.map(x => `<tr><td>${U.esc(label(x.cat, x.r))}</td><td class="nowrap"><b>${U.esc(price(x.cat, x.r))}</b></td><td>${U.dmy(x.r.effectiveFrom) || '—'}</td><td>${x.r.effectiveTo ? U.dmy(x.r.effectiveTo) : '—'}</td><td>${statusTag(x.r)}</td><td>${U.esc(creator(x.r))}</td><td class="small">${U.esc(basis(x.r))}</td></tr>`), { empty: 'Chưa có mức thu riêng nào.' })}</details>`;
  }
  function resultHtml() {
    const r = st().result;
    if (!r) return '';
    return `<div class="note ${r.tone} fcm-result"><b>${U.esc(r.title)}</b>${r.items && r.items.length ? `<ul>${r.items.map(x => `<li>${U.esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
  }
  function detailHtml() {
    const f = st(), mid = f.marketId, m = MC().get(mid);
    if (!m || allowedIds().indexOf(mid) === -1) { f.view = 'list'; return listShellHtml(); }
    const lc = L().marketLifecycle(mid), edit = canEdit(mid), cur = current(mid), ch = SC().chargeApplicability(mid), states = cardStates(mid);
    return `<div class="fcm-page">${headerHtml(m, states, lc)}${f.popup ? '' : resultHtml()}
      <div class="fcm-cards">${landCardHtml(mid, states, cur, edit)}${utilCardHtml('electricity', states, cur, ch, edit)}${utilCardHtml('water', states, cur, ch, edit)}${serviceCardHtml(states, cur, ch, edit)}</div>
      ${edit ? '' : '<div class="note">Bạn chỉ có quyền xem cấu hình mức thu.</div>'}
      ${priceHistoryHtml(mid)}</div>`;
  }

  // ---------- Popup thiết lập (dùng chung bản nháp + service lưu) ----------
  const POPUP_TITLE = { land: 'Thiết lập giá mặt bằng', 'land-view': 'Bảng giá mặt bằng & căn cứ', electricity: 'Thiết lập đơn giá điện', water: 'Thiết lập đơn giá nước', service: 'Thiết lập phí dịch vụ', charges: 'Khoản thu áp dụng', qd480: 'Giá tham chiếu QĐ 480' };
  function landTabHtml(mid, d, edit, cur) {
    const lc = L().marketLifecycle(mid), pts = pointsByType(mid), ref = SC().referenceLandPrices(mid, today()).prices, scope = landScope(mid);
    const rows = AREA().map(k => {
      const r = cur.land[k], refP = ref[k], v = d.land[k], n = num(v), used = pts[k] || 0, need = scope.types.indexOf(k) !== -1;
      const diff = refP && n !== null && n !== Number(refP.amount) ? '<div class="small fcm-diff" title="Khác mức tham chiếu QĐ 480">⚠ Khác mức tham chiếu QĐ 480</div>' : '';
      const legacyCovers = !r && used && lc.fee.missingAreaTypes.indexOf(k) === -1;
      const state = r ? `Đang áp dụng ${fmt(r.amount)} từ ${U.dmy(r.effectiveFrom)}` : legacyCovers ? 'Đang áp dụng theo loại quầy cũ' : need ? '<span class="fcm-req">Chưa có mức thu riêng (bắt buộc)</span>' : 'Không bắt buộc';
      return `<tr><td><b>${U.esc(U.areaTypeLabel(k))}</b></td><td class="num">${fmt(used)}</td><td class="num">${refP ? fmt(refP.amount) : '-'}</td>
        <td><input class="input fcm-num" type="number" min="0" step="any" data-in="fcm-field" data-path="land.${k}" value="${U.esc(v)}" ${edit ? '' : 'disabled'} aria-label="Mức thu ${U.esc(U.areaTypeLabel(k))}">${d.preset[k] ? '<div class="small muted">Điền từ QĐ 480 (bản nháp)</div>' : ''}</td>
        <td>đ/m²/ngày</td><td class="small">${state}${diff}</td></tr>`;
    });
    const legacyNote = cur.legacyLand.length ? `<div class="note info small">Chợ đang áp dụng mức thu mặt bằng theo loại quầy cũ: ${cur.legacyLand.map(x => U.esc(x.stallType || '—') + ' ' + fmt(x.amount) + ' ' + U.esc(x.unit || 'đ/m²/ngày')).join('; ')}. Nhập mức theo loại diện tích để chuyển sang cấu hình mới (mức mới có hiệu lực thay thế từ ngày hiệu lực đã chọn).</div>` : '';
    return `<div class="fcm-panel fcm-land">${legacyNote}${U.table([{ t: 'Loại diện tích' }, { t: 'Điểm KD đang dùng', num: true }, { t: 'Tham chiếu QĐ 480', num: true }, { t: 'Mức thu mới của chợ' }, { t: 'Đơn vị' }, { t: 'Hiện tại' }], rows)}
      ${pts._legacy ? `<div class="small muted">${fmt(pts._legacy)} điểm "Theo phiên" (dữ liệu cũ) không yêu cầu mức thu và không chặn hoạt động.</div>` : ''}
      <div class="small muted">Ô nhập mặc định bằng mức đang áp dụng; giữ nguyên = không đổi. Mức khác sẽ tạo phiên bản mới từ ngày hiệu lực đã chọn. Giá tham chiếu QĐ 480 không được dùng để tính tiền.</div></div>`;
  }
  function utilTabHtml(k, d, edit, cur) {
    const c = UTIL[k], applies = d.charges[k], on = applies !== false;
    const note = applies === false ? '<div class="note">Khoản này hiện không áp dụng tại chợ.</div>' : '';
    const dis = edit && on ? '' : 'disabled';
    const now = cur[k] ? `<div class="fcm-current"><span>Đơn giá hiện hành</span><b>${fmt(cur[k][c.field])} ${c.unit}</b><span class="small muted">hiệu lực từ ${U.dmy(cur[k].effectiveFrom)}</span></div>` : `<div class="fcm-current is-empty"><span>Chưa có đơn giá ${c.noun} đang hiệu lực.</span></div>`;
    return `<div class="fcm-panel">${note}${now}<div class="form-grid">
      <div class="field"><label>${cur[k] ? 'Đơn giá mới' : 'Đơn giá'} ${c.noun} *</label><div class="fcm-unit"><input class="input fcm-num" type="number" min="0" step="any" data-in="fcm-field" data-path="${k}.price" value="${U.esc(d[k].price)}" ${dis}><span>${c.unit}</span></div></div>
      <div class="field"><label>Ghi chú</label><input class="input" data-in="fcm-field" data-path="${k}.note" value="${U.esc(d[k].note)}" ${dis} placeholder="Căn cứ / ghi chú (nếu có)"></div></div>
      <div class="small muted">${cur[k] ? 'Đổi đơn giá sẽ tạo phiên bản mới từ ngày hiệu lực đã chọn; phiên bản cũ được giữ trong lịch sử.' : 'Đơn giá có hiệu lực từ ngày đã chọn.'}</div></div>`;
  }
  function serviceTabHtml(d, edit, cur) {
    const applies = d.charges.service, dis = edit && applies !== false ? '' : 'disabled';
    const note = applies === false ? '<div class="note">Chợ không áp dụng khoản thu dịch vụ.</div>' : '';
    const calcLabel = r => (SVC_CALC.find(x => x[0] === r.calcMethod) || [0, r.unit || '—'])[1];
    const existing = cur.services.slice().sort(byEffDesc).filter(r => r.status === 'active' && (!r.effectiveTo || r.effectiveTo >= today())).map(r => {
      const editable = live(r) && r.status === 'active';
      return `<tr><td><b>${U.esc(r.name || '—')}</b></td><td>${U.esc(r.unit || calcLabel(r))}</td>
        <td>${editable ? `<input class="input fcm-num" type="number" min="0" step="any" data-in="fcm-field" data-path="services.${U.esc(r.id)}" value="${U.esc(d.services[r.id] !== undefined ? d.services[r.id] : String(r.amount))}" ${dis}>` : fmt(r.amount)}</td>
        <td>Hàng tháng</td><td>${statusTag(r)}<div class="small muted">từ ${U.dmy(r.effectiveFrom)}</div></td><td class="small">${U.esc((r.legalBasis || {}).note || (r.legalBasis || {}).docNo || '—')}</td></tr>`;
    });
    const added = d.newServices.map(x => `<tr class="fcm-new"><td><input class="input" data-in="fcm-field" data-path="new.${x.key}.name" value="${U.esc(x.name)}" placeholder="Tên dịch vụ *" ${dis}></td>
        <td><select class="input" data-ch="fcm-new-calc" data-key="${x.key}" ${dis}>${SVC_CALC.map(c => `<option value="${c[0]}" ${x.calcMethod === c[0] ? 'selected' : ''}>${c[1]}</option>`).join('')}</select></td>
        <td><input class="input fcm-num" type="number" min="0" step="any" data-in="fcm-field" data-path="new.${x.key}.amount" value="${U.esc(x.amount)}" placeholder="Mức thu *" ${dis}></td>
        <td>Hàng tháng</td><td><span class="tag warn">Mới (chưa lưu)</span></td><td><input class="input" data-in="fcm-field" data-path="new.${x.key}.note" value="${U.esc(x.note)}" placeholder="Ghi chú" ${dis}><button class="btn sm" data-act="fcm-svc-remove" data-key="${x.key}" ${dis}>Bỏ</button></td></tr>`);
    return `<div class="fcm-panel">${note}
      ${U.table([{ t: 'Tên dịch vụ' }, { t: 'Đơn vị tính' }, { t: 'Mức thu' }, { t: 'Chu kỳ thu' }, { t: 'Hiệu lực' }, { t: 'Ghi chú' }], existing.concat(added), { empty: 'Chưa có dịch vụ riêng của chợ.' })}
      ${edit && applies !== false ? '<button class="btn sm" data-act="fcm-svc-add">+ Thêm dịch vụ</button>' : ''}
      <div class="small muted">Phí gửi xe được quản lý riêng. Đổi mức thu dịch vụ sẽ tạo phiên bản mới từ ngày hiệu lực đã chọn.</div></div>`;
  }
  function chargesTabHtml(d, edit) {
    const row = (label, ctl, sub) => `<div class="fcm-charge-row"><div><b>${label}</b><div class="small muted">${sub}</div></div>${ctl}</div>`;
    const seg = k => { const v = d.charges[k], dis = edit ? '' : 'disabled'; return `<div class="seg fcm-seg"><button class="${v === true ? 'on' : ''}" data-act="fcm-charge" data-k="${k}" data-v="1" ${dis}>Áp dụng</button><button class="${v === false ? 'on' : ''}" data-act="fcm-charge" data-k="${k}" data-v="0" ${dis}>Không áp dụng</button></div>`; };
    return `<div class="fcm-panel">
      ${row('Tiền mặt bằng', '<div class="seg fcm-seg"><button class="on" disabled>Áp dụng</button></div>', 'Khoản bắt buộc.')}
      ${CHARGES.map(([k, label]) => row(label, seg(k), d.charges[k] === null ? '<span class="fcm-undeclared">Chưa khai báo</span>' : d.charges[k] ? 'Áp dụng — cần mức thu riêng hợp lệ.' : 'Không áp dụng — không bắt buộc mức thu; mức đang có sẽ ngừng từ ngày hiệu lực đã chọn.')).join('')}
      <div class="small muted">Chọn đủ Điện, Nước, Dịch vụ rồi bấm Lưu.</div></div>`;
  }
  function qd480TabHtml(mid, d, edit) {
    const ref = SC().referenceLandPrices(mid, today()), types = AREA().filter(k => ref.prices[k]);
    const head = `<h4 class="fcm-sub">Giá tham chiếu theo QĐ 480 cho chợ ${ref.grade ? 'Hạng ' + ref.grade : '(chưa xác định hạng)'}</h4>`;
    if (!types.length) return `<div class="fcm-panel">${head}<div class="note">Không có mức tham chiếu QĐ 480 phù hợp với hạng của chợ này.</div></div>`;
    const doc = ref.prices[types[0]].legalBasis || {};
    const evidence = p => !p ? '-' : (p.attachments || []).length ? `<span class="tag ok">Có tệp căn cứ</span> <button class="btn sm" data-act="policy-land-view" data-id="${U.esc(p.id)}">Xem</button>` : '<span class="small muted">Chưa có tệp — lưu giá cần tải tệp căn cứ</span>';
    return `<div class="fcm-panel">${head}${U.table([{ t: 'Loại diện tích' }, { t: 'Đơn giá tham chiếu (đ/m²/ngày)', num: true }, { t: 'Căn cứ' }], AREA().map(k => `<tr><td>${U.esc(U.areaTypeLabel(k))}</td><td class="num">${ref.prices[k] ? fmt(ref.prices[k].amount) : '-'}</td><td>${evidence(ref.prices[k])}</td></tr>`))}
      <div class="small muted">${U.esc([doc.docNo, doc.summary].filter(Boolean).join(' — '))}</div>
      <div class="note info">Đây chỉ là giá tham chiếu. "Dùng mức tham chiếu" chỉ điền vào ô giá mặt bằng; cần bấm Lưu thì mới thành mức thu của chợ. Giá giữ nguyên mức tham chiếu được dùng lại tệp căn cứ của QĐ 480 (nếu đã có); giá nhập khác cần tệp căn cứ riêng.</div>
      ${edit ? `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn" data-act="fcm-preset" data-mode="empty">Dùng mức tham chiếu (chỉ ô còn trống)</button><button class="btn" data-act="fcm-preset" data-mode="all">Dùng mức tham chiếu cho tất cả</button></div>` : ''}</div>`;
  }
  function landViewHtml(mid) {
    const cur = current(mid), rows = cur.lands.slice().sort(byEffDesc);
    return `<div class="fcm-panel">${U.table([{ t: 'Loại diện tích' }, { t: 'Mức thu' }, { t: 'Từ ngày' }, { t: 'Đến ngày' }, { t: 'Trạng thái' }, { t: 'Căn cứ' }], rows.map(r => `<tr><td>${U.esc(r.areaTypeId ? U.areaTypeLabel(r.areaTypeId) : (r.stallType || '—'))}</td><td class="nowrap"><b>${fmt(r.amount)}</b> ${U.esc(r.unit || 'đ/m²/ngày')}</td><td>${U.dmy(r.effectiveFrom)}</td><td>${r.effectiveTo ? U.dmy(r.effectiveTo) : '—'}</td><td>${statusTag(r)}</td><td class="nowrap"><button class="btn sm" data-act="policy-land-view" data-id="${U.esc(r.id)}">Xem</button></td></tr>`), { empty: 'Chưa có mức thu mặt bằng riêng.' })}
      ${qd480TabHtml(mid, draftFor(mid), false)}</div>`;
  }
  function popupHtml() {
    const f = st(), mid = f.marketId, card = f.popup, edit = canEdit(mid), d = draftFor(mid), cur = current(mid), m = MC().get(mid) || {};
    const body = card === 'land' ? landTabHtml(mid, d, edit, cur) + qd480TabHtml(mid, d, edit) : card === 'land-view' ? landViewHtml(mid)
      : card === 'qd480' ? qd480TabHtml(mid, d, edit) : card === 'service' ? serviceTabHtml(d, edit, cur) : card === 'charges' ? chargesTabHtml(d, edit) : utilTabHtml(card, d, edit, cur);
    const errors = f.result && f.result.tone === 'danger' ? resultHtml() : '';
    const readOnly = !edit || card === 'land-view';
    const foot = readOnly ? '<button class="btn" data-act="fcm-popup-close">Đóng</button>'
      : `<label class="fcm-eff" title="Giá mới chỉ có hiệu lực từ ngày 01 của tháng">Hiệu lực từ <input class="input" type="date" data-in="fcm-field" data-path="effectiveFrom" value="${U.esc(d.effectiveFrom)}"></label>
        ${card === 'charges' ? '' : `<label class="btn sm fcm-file" title="Thay đổi giá cần tệp căn cứ (quyết định / công văn)">${d.file ? '📄 ' + U.esc(d.file.name) : '+ Tệp căn cứ (PDF / ảnh)'}<input type="file" accept="application/pdf,image/*" data-ch="fcm-file"></label>`}
        <span class="spacer"></span><button class="btn" data-act="fcm-popup-close">Hủy</button><button class="btn primary" data-act="fcm-save">Lưu</button>`;
    return `<div class="modal-h"><h3>${U.esc(POPUP_TITLE[card] || 'Cấu hình mức thu')} – ${U.esc(m.name || '')}</h3><button class="x" data-act="fcm-popup-close" aria-label="Đóng">×</button></div>
      <div class="modal-b fcm-popup">${errors}${body}</div><div class="modal-f fcm-popup-f">${foot}</div>`;
  }
  // Mở / vẽ lại popup (dữ liệu nháp giữ trong ui.feeCfg — không ghi gì cho tới khi Lưu).
  function showPopup() { const f = st(); if (f.popup) A.modal(popupHtml(), true); }
  function refresh() { A.render(); showPopup(); }

  // ---------- Đặt lại cấu hình mức thu của 1 chợ (Quản trị hệ thống) ----------
  // Tham chiếu tới một bản ghi mức thu: hợp đồng (bản chụp priceTerms + amendments + feePolicy/utilityPolicyId), khoản
  // phải thu đã phát hành, nháp khoản thu. Biên lai / thanh toán luôn gắn khoản phải thu nên được phủ qua khoản phải thu.
  fc.feeRecordUsage = function (ids) {
    const want = new Set(ids), out = {};
    const hit = (id, ref) => { if (id && want.has(id)) (out[id] = out[id] || []).push(ref); };
    const termsIds = t => t ? [t.land && t.land.policyId, t.electricity && t.electricity.policyId, t.water && t.water.policyId].concat((t.services || []).map(s => s.serviceId)) : [];
    (A.db.contracts || []).forEach(c => {
      const ref = 'Hợp đồng ' + c.id;
      termsIds(c.priceTerms).forEach(id => hit(id, ref));
      (c.amendments || []).forEach(a => termsIds(a.priceTerms || a.terms).forEach(id => hit(id, ref)));
      hit(c.feePolicy && c.feePolicy.id, ref); hit(c.utilityPolicyId, ref);
    });
    (A.db.invoices || []).forEach(i => (i.items || []).forEach(x => { hit(x.policyId, 'Khoản phải thu ' + i.id); hit(x.serviceId, 'Khoản phải thu ' + i.id); }));
    (A.db.billingDrafts || []).forEach(dr => (dr.items || []).forEach(x => { hit(x.policyId, 'Nháp khoản thu ' + dr.id); }));
    return out;
  };
  fc.marketResetPlan = function (mid) {
    const records = [];
    const label = (cat, r) => cat === 'stallPrices' ? 'Mặt bằng · ' + (r.areaTypeId ? U.areaTypeLabel(r.areaTypeId) : (r.stallType || '—')) : cat === 'utilities' ? (r.kind === 'WATER' ? 'Nước' : 'Điện') : 'Dịch vụ · ' + (r.name || '—');
    const price = (cat, r) => cat === 'utilities' ? fmt(r.kind === 'WATER' ? r.waterPrice : r.elecPrice) + ' ' + (r.kind === 'WATER' ? (r.waterUnit || 'đ/m³') : (r.elecUnit || 'đ/kWh')) : fmt(r.amount) + ' ' + (r.unit || '');
    ['stallPrices', 'utilities', 'extraServices'].forEach(cat => (SC().list(cat) || []).filter(r => SC().isMarketOwnedPolicy(r, mid) && (cat !== 'extraServices' || isService(r))).forEach(r => records.push({ cat, id: r.id, label: label(cat, r), price: price(cat, r), from: r.effectiveFrom, status: r.status })));
    const usage = fc.feeRecordUsage(records.map(r => r.id));
    records.forEach(r => { r.usedBy = usage[r.id] || []; });
    const charges = SC().chargeApplicability(mid);
    return { mid, records, charges, used: records.filter(r => r.usedBy.length), empty: !records.length && !charges };
  };
  // Service đặt lại: kiểm tra QUYỀN + PHẠM VI + LÝ DO + XÁC NHẬN + THAM CHIẾU ngay tại thời điểm xác nhận (không tin popup).
  fc.resetMarketFeeConfig = function (mid, opts) {
    const o = opts || {}, m = MC().get(mid);
    if (!m || !canReset(mid)) return { ok: false, denied: true, errors: ['Bạn không có quyền đặt lại cấu hình mức thu của chợ này.'] };
    if (!o.confirmed) return { ok: false, errors: ['Vui lòng xác nhận đã kiểm tra dữ liệu sẽ bị đặt lại.'] };
    const reason = String(o.reason || '').trim();
    if (!reason) return { ok: false, errors: ['Vui lòng nhập lý do đặt lại.'] };
    const plan = fc.marketResetPlan(mid);
    if (plan.empty) return { ok: false, errors: ['Chợ chưa có cấu hình mức thu để đặt lại.'] };
    if (plan.used.length) return { ok: false, used: plan.used, errors: plan.used.map(r => r.label + ' (' + r.price + ') đã được sử dụng: ' + r.usedBy.slice(0, 3).join(', ') + (r.usedBy.length > 3 ? '…' : '') + ' — không thể đặt lại; chỉ có thể tạo phiên bản giá thay thế.') };
    const user = o.user || actor();
    const entry = SC().resetMarketConfig(mid, { ids: plan.records.map(r => r.id), user, reason });
    if (!entry) return { ok: false, errors: ['Không đặt lại được cấu hình mức thu.'] };
    if (U.log) U.log('Đặt lại cấu hình mức thu chợ ' + m.name + ' (' + mid + '): gỡ ' + plan.records.length + ' mức thu riêng chưa sử dụng' + (plan.charges ? ' và khai báo khoản thu áp dụng' : '') + ' · sao lưu ' + entry.id + ' · lý do: ' + reason);
    if (A.save) A.save();
    L().normalizeMarketLifecycle(mid, 'Đặt lại cấu hình mức thu');
    return { ok: true, entry, plan };
  };
  function resetPopupHtml() {
    const f = st(), mid = f.marketId, m = MC().get(mid) || {}, plan = fc.marketResetPlan(mid), r = f.reset || {};
    const ch = plan.charges ? ['Mặt bằng'].concat(CHARGES.filter(c => plan.charges[c[0]]).map(c => c[1])).join(', ') : 'Chưa khai báo';
    const rows = plan.records.map(x => `<tr><td>${U.esc(x.label)}</td><td class="nowrap">${U.esc(x.price)}</td><td>${U.dmy(x.from) || '—'}</td><td>${x.usedBy.length ? `<span class="tag danger">Đã sử dụng</span><div class="small">${U.esc(x.usedBy.slice(0, 2).join(', '))}</div>` : '<span class="tag">Chưa sử dụng</span>'}</td></tr>`);
    const blocked = plan.used.length > 0 || plan.empty;
    const errors = r.errors && r.errors.length ? `<div class="note danger"><b>Chưa đặt lại:</b><ul>${r.errors.map(e => `<li>${U.esc(e)}</li>`).join('')}</ul></div>` : '';
    return `<div class="modal-h"><h3>Đặt lại cấu hình mức thu – ${U.esc(m.name || mid)}</h3><button class="x" data-act="fcm-mreset-close" aria-label="Đóng">×</button></div>
      <div class="modal-b fcm-popup">${errors}
        <div class="note warn">Thao tác đặc biệt. Gỡ các mức thu riêng chưa từng được sử dụng và khai báo khoản thu áp dụng của <b>${U.esc(m.name || mid)}</b>, đưa chợ về <b>Chưa cấu hình</b>. Dữ liệu được sao lưu trước khi gỡ. Thay đổi đơn giá thường ngày không dùng chức năng này.</div>
        <h4 class="fcm-sub">Sẽ đặt lại</h4>
        ${U.table([{ t: 'Mức thu riêng' }, { t: 'Mức giá' }, { t: 'Hiệu lực từ' }, { t: 'Sử dụng' }], rows, { empty: 'Không có mức thu riêng.' })}
        <div class="small">Khai báo khoản thu áp dụng hiện tại: <b>${U.esc(ch)}</b></div>
        <h4 class="fcm-sub">Không thay đổi</h4>
        <div class="small muted">Bảng giá tham chiếu QĐ 480, phí gửi xe, lịch kỳ thu, sơ đồ mặt bằng, điểm kinh doanh, hồ sơ tiểu thương, hợp đồng, chỉ số điện nước, kỳ thu, khoản phải thu, biên lai, đối soát và cấu hình của các chợ khác.</div>
        ${plan.used.length ? '<div class="note danger">Có mức thu đã được sử dụng — không thể đặt lại. Hãy tạo phiên bản giá thay thế với ngày hiệu lực mới.</div>' : ''}
        ${blocked ? '' : `<div class="field"><label>Lý do đặt lại *</label><textarea class="input" rows="2" data-in="fcm-mreset-reason" placeholder="Ví dụ: cấu hình thử nghiệm, cần khai báo lại từ đầu">${U.esc(r.reason || '')}</textarea></div>
        <label class="fcm-ack"><input type="checkbox" data-ch="fcm-mreset-ack" ${r.confirmed ? 'checked' : ''}> Tôi đã kiểm tra danh sách trên và xác nhận đặt lại cấu hình mức thu của chợ này.</label>`}
      </div>
      <div class="modal-f"><span class="spacer"></span><button class="btn" data-act="fcm-mreset-close">Hủy</button>${blocked ? '' : '<button class="btn danger" data-act="fcm-mreset-confirm">Đặt lại cấu hình</button>'}</div>`;
  }

  function listShellHtml() {
    const ref = !!(fc.canManageReference && fc.canManageReference()), f = st(), tab = f.tab === 'history' ? 'history' : f.tab === 'reference' && ref ? 'reference' : 'list';
    return `<div class="fcm-page"><section class="fcm-title"><h2>Chính sách thu và biểu phí</h2><p>Thiết lập mức thu riêng cho từng chợ: mặt bằng, điện, nước và dịch vụ.</p></section>
      <div class="seg fcm-tabs"><button class="${tab === 'list' ? 'on' : ''}" data-act="fcm-tab" data-id="list">Danh sách cấu hình</button><button class="${tab === 'history' ? 'on' : ''}" data-act="fcm-tab" data-id="history">Lịch sử thay đổi</button>${ref ? `<button class="${tab === 'reference' ? 'on' : ''}" data-act="fcm-tab" data-id="reference">Giá tham chiếu QĐ 480 (quản trị)</button>` : ''}</div>
      ${tab === 'history' ? historyHtml() : tab === 'reference' ? fc.referenceTabHtml() : listHtml()}</div>`;
  }
  fc.marketConfigView = function () { return st().view === 'detail' ? detailHtml() : listShellHtml(); };
  A.VIEWS['cau-hinh-gia'] = fc.marketConfigView;

  // ---------- Handlers ----------
  A.ACT['fcm-tab'] = el => { const id = el.dataset.id; st().tab = id === 'history' ? 'history' : id === 'reference' && fc.canManageReference && fc.canManageReference() ? 'reference' : 'list'; A.render(); };
  A.IN['fcm-q'] = el => { st().filter.q = el.value; A.render(); };
  A.CH['fcm-status'] = el => { st().filter.status = el.value; A.render(); };
  A.CH['fcm-rank'] = el => { st().filter.rank = el.value; A.render(); };
  A.CH['fcm-hist-market'] = el => { st().histMarket = el.value; A.render(); };
  A.ACT['fcm-open'] = el => {
    const id = el.dataset.id;
    if (!U.can('cau-hinh-gia') || !MC().get(id) || allowedIds().indexOf(id) === -1) return;
    Object.assign(st(), { view: 'detail', marketId: id, dtab: 'charges', draft: null, result: null, popup: null, reset: null });
    A.render();
  };
  A.ACT['fcm-back'] = () => { Object.assign(st(), { view: 'list', marketId: null, draft: null, result: null, popup: null, reset: null }); A.closeModal(); A.render(); };
  // Mở popup thiết lập của một thẻ (fcm-dtab giữ cho tương thích: cùng nghĩa "mở phần cấu hình X").
  const openPopup = card => { const f = st(); if (!f.marketId || !POPUP_TITLE[card]) return; f.popup = card; f.dtab = card; f.result = null; A.render(); showPopup(); };
  A.ACT['fcm-edit'] = el => openPopup(el.dataset.card);
  A.ACT['fcm-dtab'] = el => openPopup(el.dataset.id === 'electricity' || el.dataset.id === 'water' || el.dataset.id === 'land' || el.dataset.id === 'service' || el.dataset.id === 'charges' || el.dataset.id === 'qd480' ? el.dataset.id : 'charges');
  A.ACT['fcm-popup-close'] = () => { Object.assign(st(), { popup: null, draft: null, result: null }); A.closeModal(); A.render(); };
  A.ACT['fcm-reset'] = () => A.ACT['fcm-popup-close']();
  // Áp dụng / Không áp dụng trên thẻ → mở popup "Khoản thu áp dụng" với lựa chọn này (lưu khi bấm Lưu).
  A.ACT['fcm-apply'] = el => {
    const f = st(); if (!canEdit(f.marketId)) return;
    const k = el.dataset.k; if (!CHARGES.some(c => c[0] === k)) return;
    f.draft = null; const d = draftFor(f.marketId);
    d.charges[k] = el.dataset.v === '1';
    openPopup('charges');
  };
  // Ghi giá trị ô nhập vào bản nháp (không vẽ lại để giữ con trỏ).
  A.IN['fcm-field'] = el => {
    const f = st(); if (!f.marketId || !canEdit(f.marketId)) return;
    const d = draftFor(f.marketId), p = String(el.dataset.path || '').split('.');
    if (p[0] === 'land') { d.land[p[1]] = el.value; delete d.preset[p[1]]; }
    else if (p[0] === 'electricity' || p[0] === 'water') d[p[0]][p[1]] = el.value;
    else if (p[0] === 'services') d.services[p[1]] = el.value;
    else if (p[0] === 'new') { const x = d.newServices.find(s => String(s.key) === p[1]); if (x) x[p[2]] = el.value; }
    else if (p[0] === 'effectiveFrom') d.effectiveFrom = el.value;
  };
  A.CH['fcm-file'] = el => {
    const f = st(), file = el.files && el.files[0];
    if (!file || !canEdit(f.marketId)) return;
    if (!fc.evidenceFileOk(file)) return U.toast('Chỉ nhận tệp PDF hoặc ảnh.');
    draftFor(f.marketId).file = fc.evidenceFromFile(file);
    refresh();
  };
  A.CH['fcm-new-calc'] = el => { const f = st(); if (!canEdit(f.marketId)) return; const x = draftFor(f.marketId).newServices.find(s => String(s.key) === el.dataset.key); if (x) x.calcMethod = el.value; };
  A.ACT['fcm-charge'] = el => {
    const f = st(); if (!canEdit(f.marketId)) return;
    const k = el.dataset.k; if (!CHARGES.some(c => c[0] === k)) return;
    draftFor(f.marketId).charges[k] = el.dataset.v === '1';
    refresh();
  };
  A.ACT['fcm-svc-add'] = () => { const f = st(); if (!canEdit(f.marketId)) return; const d = draftFor(f.marketId); d.newServices.push({ key: d.seq++, name: '', calcMethod: 'fixed', amount: '', note: '' }); refresh(); };
  A.ACT['fcm-svc-remove'] = el => { const f = st(); if (!canEdit(f.marketId)) return; const d = draftFor(f.marketId); d.newServices = d.newServices.filter(s => String(s.key) !== el.dataset.key); refresh(); };
  // QĐ 480: chỉ điền bản nháp — không ghi gì vào cấu hình, không đổi vòng đời.
  A.ACT['fcm-preset'] = el => {
    const f = st(); if (!canEdit(f.marketId)) return;
    const d = draftFor(f.marketId), ref = SC().referenceLandPrices(f.marketId, today()).prices, all = el.dataset.mode === 'all';
    let n = 0;
    AREA().forEach(k => { if (ref[k] && (all || String(d.land[k] || '').trim() === '')) { d.land[k] = String(ref[k].amount); d.preset[k] = ref[k].id; n++; } });
    f.result = null; f.popup = 'land'; f.dtab = 'land'; refresh();
    U.toast(n ? `Đã điền ${n} mức tham chiếu QĐ 480 vào ô giá. Kiểm tra và bấm "Lưu".` : 'Không có ô nào cần điền.');
  };
  // Đặt lại cấu hình (Quản trị hệ thống) — popup xác nhận; mọi kiểm tra lặp lại trong service khi bấm xác nhận.
  A.ACT['fcm-mreset-open'] = () => { const f = st(); if (!canReset(f.marketId)) return U.toast('Bạn không có quyền đặt lại cấu hình mức thu của chợ này.'); f.reset = { reason: '', confirmed: false, errors: [] }; A.modal(resetPopupHtml(), true); };
  A.ACT['fcm-mreset-close'] = () => { st().reset = null; A.closeModal(); };
  A.IN['fcm-mreset-reason'] = el => { const r = st().reset; if (r) r.reason = el.value; };
  A.CH['fcm-mreset-ack'] = el => { const r = st().reset; if (r) { r.confirmed = !!el.checked; } };
  A.ACT['fcm-mreset-confirm'] = () => {
    const f = st(), r = f.reset; if (!r) return;
    const out = fc.resetMarketFeeConfig(f.marketId, { reason: r.reason, confirmed: r.confirmed, user: actor() });
    if (out.denied) { f.reset = null; A.closeModal(); return U.toast(out.errors[0]); }
    if (!out.ok) { r.errors = out.errors; A.modal(resetPopupHtml(), true); return; }
    Object.assign(f, { reset: null, draft: null, popup: null, result: { tone: 'ok', title: 'Đã đặt lại cấu hình mức thu. Chợ trở về "Chưa cấu hình".', items: ['Đã gỡ ' + out.plan.records.length + ' mức thu riêng chưa sử dụng' + (out.plan.charges ? ' và khai báo khoản thu áp dụng.' : '.'), 'Bản sao lưu: ' + out.entry.id + ' (lưu trong cấu hình mức thu).'] } });
    A.closeModal(); A.render(); U.toast('Đã đặt lại cấu hình mức thu.');
  };

  // ---- Service lưu cấu hình mức thu của 1 chợ — kiểm tra QUYỀN + PHẠM VI CHỢ ngay tại đây (không chỉ ẩn nút) ----
  // Quyền: action:cau-hinh-gia.them-phi (Tổ trưởng) + chợ thuộc marketScopes. Kiểm tra toàn bộ bản nháp trước khi ghi.
  // Căn cứ: giá giữ nguyên mức tham chiếu QĐ 480 đã điền (preset) → tham chiếu lại tệp căn cứ của bản ghi QĐ 480
  // (chỉ lưu reference, không sao chép tệp) nếu bản ghi đó đã có tệp; mọi giá nhập tay / khác QĐ 480 → bắt buộc
  // tệp căn cứ của lần thay đổi. Khoản chuyển "Không áp dụng" → kết thúc hiệu lực mức giá riêng còn hiệu lực của
  // khoản đó từ ngày hiệu lực đã chọn (không xóa), ghi lịch sử "Khoản … ngừng áp dụng từ …".
  fc.saveMarketFeeConfig = function (mid, d, user) {
    if (!mid || !d || d.mid !== mid || !canEdit(mid)) return { ok: false, denied: true, errors: ['Bạn không có quyền cập nhật cấu hình mức thu của chợ này.'] };
    const cur = current(mid), eff = d.effectiveFrom || today(), errors = [], plan = [], stops = [];
    // Cùng quy tắc phiên bản với form cũ (feeConfig.priceVersionConflict).
    const versionable = (cat, same, label) => { if (fc.priceVersionConflict(cat, mid, same, eff)) { errors.push(label + ': ngày hiệu lực của mức mới phải sau ngày hiệu lực của mức đang áp dụng.'); return false; } return true; };
    const legal = note => ({ note: note || 'Cấu hình mức thu riêng của chợ' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eff)) errors.push('Vui lòng chọn ngày hiệu lực của thay đổi.');
    else if (!fc.firstOfMonth(eff)) errors.push('Giá mới chỉ được có hiệu lực từ ngày 01 của tháng.');
    const decided = CHARGES.filter(c => d.charges[c[0]] !== null).length;
    if (decided && decided < CHARGES.length) errors.push('Vui lòng chọn Áp dụng / Không áp dụng cho đủ Điện, Nước, Dịch vụ.');
    // Mặt bằng
    AREA().forEach(k => {
      const v = num(d.land[k]), r = cur.land[k], label = 'Giá ' + U.areaTypeLabel(k);
      if (v === null) return;
      if (!(v > 0)) return errors.push(label + ' phải là số lớn hơn 0.');
      if (r && Number(r.amount) === v) return;
      const same = x => x.areaTypeId === k;
      if (!versionable('stallPrices', same, label)) return;
      const preset = d.preset[k] && SC().get('stallPrices', d.preset[k]);
      const fromPreset = !!preset && Number(preset.amount) === v;
      const refFiles = fromPreset ? (preset.attachments || []) : [];
      const rec = { marketId: mid, scope: 'MARKET', areaTypeId: k, stallType: '', name: 'Mặt bằng ' + U.areaTypeLabel(k), amount: v, unit: 'đ/m²/ngày', effectiveFrom: eff, effectiveTo: null, status: 'active',
        legalBasis: fromPreset ? Object.assign({}, preset.legalBasis || {}, { note: 'Áp dụng mức tham chiếu QĐ 480 cho chợ' }) : legal(), attachments: [] };
      if (fromPreset) rec.referencePolicyId = preset.id;
      // Tham chiếu tệp căn cứ của QĐ 480 (metadata + đường dẫn sẵn có — không sao chép tệp vật lý).
      const refs = refFiles.map(a => ({ id: a.id, name: a.name, type: a.type, size: a.size, url: a.url, mock: a.mock, referenceOf: preset.id }));
      plan.push({ cat: 'stallPrices', same, rec, detail: label + ': ' + fmt(v) + ' đ/m²/ngày' + (fromPreset ? ' (mức tham chiếu QĐ 480)' : ''), refs, needsFile: !refs.length });
    });
    // Điện / nước
    ['electricity', 'water'].forEach(k => {
      const c = UTIL[k], v = num(d[k].price), r = cur[k];
      if (d.charges[k] === false || v === null) return;
      if (!(v > 0)) return errors.push('Đơn giá ' + c.noun + ' phải là số lớn hơn 0.');
      if (r && Number(r[c.field]) === v) return;
      const same = x => x.kind ? x.kind === c.kind : x[c.field] != null;
      if (!versionable('utilities', same, 'Đơn giá ' + c.noun)) return;
      const rec = { marketId: mid, kind: c.kind, name: c.name, elecPrice: null, waterPrice: null, elecUnit: 'đ/kWh', waterUnit: 'đ/m³', effectiveFrom: eff, effectiveTo: null, status: 'active', legalBasis: legal(d[k].note), attachments: [] };
      rec[c.field] = v;
      plan.push({ cat: 'utilities', same, rec, detail: 'Đơn giá ' + c.noun + ': ' + fmt(v) + ' ' + c.unit, refs: [], needsFile: true });
    });
    // Dịch vụ: sửa mức của dịch vụ đang áp dụng + dịch vụ mới
    if (d.charges.service !== false) {
      cur.services.forEach(r => {
        if (d.services[r.id] === undefined) return;
        const v = num(d.services[r.id]);
        if (v === null || Number(r.amount) === v) return;
        if (!(v > 0)) return errors.push('Mức thu "' + r.name + '" phải là số lớn hơn 0.');
        const same = x => isService(x) && String(x.name || '').trim().toLowerCase() === String(r.name || '').trim().toLowerCase();
        if (!versionable('extraServices', same, 'Dịch vụ "' + r.name + '"')) return;
        plan.push({ cat: 'extraServices', same, needsFile: true, refs: [], detail: 'Dịch vụ "' + r.name + '": ' + fmt(v),
          rec: { marketId: mid, name: r.name, category: r.category || 'GENERAL', calcMethod: r.calcMethod || 'fixed', amount: v, unit: r.unit, collectionCycle: r.collectionCycle || 'MONTH', effectiveFrom: eff, effectiveTo: null, status: 'active', legalBasis: Object.assign({}, r.legalBasis || {}), attachments: [] } });
      });
      d.newServices.forEach(x => {
        const name = String(x.name || '').trim(), v = num(x.amount), calc = SVC_CALC.find(c => c[0] === x.calcMethod) || SVC_CALC[0];
        if (!name && v === null) return;
        if (!name) return errors.push('Vui lòng nhập tên dịch vụ.');
        if (!(v > 0)) return errors.push('Mức thu dịch vụ "' + name + '" phải là số lớn hơn 0.');
        if (cur.services.some(r => live(r) && String(r.name || '').trim().toLowerCase() === name.toLowerCase())) return errors.push('Dịch vụ "' + name + '" đã có mức thu đang áp dụng; sửa mức ở dòng hiện có.');
        plan.push({ cat: 'extraServices', same: x2 => isService(x2) && String(x2.name || '').trim().toLowerCase() === name.toLowerCase(), needsFile: true, refs: [], detail: 'Dịch vụ mới "' + name + '": ' + fmt(v) + ' ' + calc[1],
          rec: { marketId: mid, name, category: 'GENERAL', calcMethod: calc[0], amount: v, unit: calc[1], collectionCycle: 'MONTH', effectiveFrom: eff, effectiveTo: null, status: 'active', legalBasis: legal(x.note), attachments: [] } });
      });
    }
    // Khoản chuyển sang "Không áp dụng": kết thúc hiệu lực các mức riêng còn hiệu lực tại/ sau ngày ngừng (không xóa).
    const prevCh = SC().chargeApplicability(mid);
    const chChanged = decided === CHARGES.length && (!prevCh || CHARGES.some(c => !!prevCh[c[0]] !== !!d.charges[c[0]]));
    if (chChanged) CHARGES.forEach(([k, label]) => {
      if (d.charges[k] !== false || (prevCh && prevCh[k] === false)) return;
      const rows = k === 'service' ? cur.services : cur.utils.filter(u => (!u.kind || u.kind === UTIL[k].kind) && u[UTIL[k].field] != null);
      rows.filter(r => r.status === 'active' && (!r.effectiveTo || r.effectiveTo >= eff)).forEach(r => stops.push({ cat: k === 'service' ? 'extraServices' : 'utilities', r, label }));
    });
    if (plan.some(x => x.needsFile) && !d.file) errors.push('Vui lòng chọn tệp căn cứ (PDF / ảnh quyết định, công văn) cho thay đổi giá nhập tay hoặc khác mức tham chiếu QĐ 480.');
    if (errors.length) return { ok: false, errors };
    if (!plan.length && !chChanged) return { ok: true, unchanged: true };
    const before = MC().get(mid).status, stopText = l => 'Khoản ' + l + ' ngừng áp dụng từ ' + U.dmy(eff);
    plan.forEach(x => {
      const file = x.needsFile ? d.file : null;
      const out = fc.addPriceVersion(x.cat, x.rec, x.same, file, user, x.detail + (file ? ' · căn cứ: ' + file.name : x.refs.length ? ' · căn cứ: tham chiếu QĐ 480' : ''));
      if (x.refs.length) SC().update(x.cat, out.rec.id, { attachments: x.refs }, user, 'Tham chiếu căn cứ', 'Dùng lại tệp căn cứ của ' + x.rec.referencePolicyId);
    });
    stops.forEach(s => SC().update(s.cat, s.r.id, { effectiveTo: fc.prevDay(eff) }, user, 'Ngừng áp dụng', stopText(s.label)));
    if (chChanged) {
      const stopped = CHARGES.filter(([k]) => d.charges[k] === false && !(prevCh && prevCh[k] === false)).map(([, l]) => stopText(l));
      SC().setChargeApplicability(mid, d.charges, user, ['Màn Chính sách thu và biểu phí'].concat(stopped).join(' · '));
    }
    L().normalizeMarketLifecycle(mid, 'Cấu hình mức thu');
    const lc = L().marketLifecycle(mid), after = MC().get(mid).status;
    return { ok: true, before, after, lifecycle: lc, stops: stops.length };
  };
  A.ACT['fcm-save'] = () => {
    const f = st(), mid = f.marketId;
    const out = fc.saveMarketFeeConfig(mid, mid ? draftFor(mid) : null, actor());
    if (out.denied) return U.toast(out.errors[0]);
    if (!out.ok) { f.result = { tone: 'danger', title: 'Chưa lưu được cấu hình:', items: out.errors }; refresh(); return; }
    if (out.unchanged) { U.toast('Không có thay đổi để lưu.'); return; }
    const lc = out.lifecycle, missing = lc.feeGap ? [lc.feeGap] : [];
    if (!lc.layoutReady) missing.unshift('Chợ chưa hoàn tất thiết lập sơ đồ mặt bằng.');
    f.result = out.after === 'ACTIVE' && out.before !== 'ACTIVE' ? { tone: 'ok', title: 'Đã lưu cấu hình. Chợ đã đủ điều kiện và chuyển sang Đang hoạt động.' }
      : lc.stage === 'ACTIVE' ? { tone: 'ok', title: 'Đã lưu cấu hình mức thu.' }
        : lc.feeConfigWarning ? { tone: 'warn', title: 'Đã lưu cấu hình. Chợ đang hoạt động nhưng cần cập nhật mức thu.', items: missing }
          : { tone: 'warn', title: 'Đã lưu cấu hình. Chợ vẫn chưa đủ điều kiện hoạt động.', items: missing };
    // Lưu xong: đóng popup, bỏ bản nháp (bấm Lưu lần nữa không có popup / bản nháp nào để tạo trùng).
    f.draft = null; f.popup = null;
    A.closeModal(); A.render();
    U.toast(f.result.title);
  };
})(window.APP);
