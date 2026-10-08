/* Màn "Chính sách thu và biểu phí" (route cau-hinh-gia) — cấu hình mức thu RIÊNG theo từng chợ (10/2026).
 * Chi tiết 1 chợ = MỘT trang: header · tiến độ cấu hình · 4 hàng khoản thu (Mặt bằng / Điện / Nước / Dịch vụ) · lịch
 * sử đơn giá; thiết lập / thay đổi qua popup cùng một bố cục (giá → thời gian áp dụng → văn bản căn cứ → ghi chú). Quản trị hệ thống có thêm "Thao tác khác → Đặt lại cấu hình mức thu" (quyền
 * cau-hinh-gia.dat-lai-cau-hinh-cho; chỉ mức thu chưa sử dụng; có sao lưu) — Tổ trưởng vẫn là người thiết lập giá.
 *
 * Mỗi chợ có MỘT cấu hình mức thu riêng = các bản ghi sẵn có của SERVICE_CFG thuộc riêng chợ đó
 * (isMarketOwnedPolicy: marketId = chợ, không SHARED) + khai báo khoản thu áp dụng (utilityModes[mid].charges):
 *   - Mặt bằng   : stallPrices theo areaTypeId (3 loại chuẩn, đ/m²/ngày) — khoản chính, luôn áp dụng.
 *   - Điện / Nước: utilities (kind ELECTRICITY / WATER — elecPrice đ/kWh, waterPrice đ/m³).
 *   - Dịch vụ    : extraServices của chợ (không tính phí gửi xe — category VEHICLE).
 * Đơn giá áp dụng luôn là bản ghi RIÊNG của từng chợ. Dữ liệu giá dùng chung cũ (nếu có) chỉ được giữ để
 * truy vết và không xuất hiện trong quy trình thiết lập mức thu này.
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
  const st = () => ui.feeCfg || (ui.feeCfg = { view: 'list', tab: 'list', marketId: null, dtab: 'charges', popup: null, reset: null, draft: null, result: null, fieldErrors: {}, saveErrors: [], filter: { q: '', status: '', rank: '' }, histMarket: '' });
  function draftFor(mid) {
    const f = st();
    if (f.draft && f.draft.mid === mid) return f.draft;
    const cur = current(mid), ch = SC().chargeApplicability(mid);
    const land = {};
    AREA().forEach(k => { land[k] = cur.land[k] ? String(cur.land[k].amount) : ''; });
    f.draft = {
      mid, land,
      charges: ch ? { electricity: ch.electricity, water: ch.water, service: ch.service } : { electricity: null, water: null, service: null },
      electricity: { price: cur.electricity ? String(cur.electricity.elecPrice) : '', note: '' },
      water: { price: cur.water ? String(cur.water.waterPrice) : '', note: '' },
      services: {}, newServices: [], seq: 1, file: null, landNote: '',
      // Giá mới chỉ hiệu lực từ ngày 01: chợ chưa có mức riêng → 01 tháng này; đang thay mức → 01 tháng sau.
      effectiveFrom: hasAnyLive(cur) ? fc.nextMonthStart() : today().slice(0, 8) + '01'
    };
    return f.draft;
  }

  // ---------- Danh sách cấu hình ----------
  // Nhãn khoản thu thống nhất: ✓ Áp dụng · – Không áp dụng · ? Chưa khai báo (trung tính — chưa chọn không phải lỗi).
  const CHIP = { on: ['is-on', '✓', 'Áp dụng'], off: ['is-off', '–', 'Không áp dụng'], none: ['is-none', '?', 'Chưa khai báo'] };
  const chip = (state, label) => { const c = CHIP[state]; return `<span class="fcm-chip ${c[0]}" title="${U.esc(label)}: ${c[2]}"><i aria-hidden="true">${c[1]}</i>${U.esc(label)}<span class="sr-only"> (${c[2]})</span></span>`; };
  function chargeTags(mid) {
    const ch = SC().chargeApplicability(mid);
    return `<div class="fcm-charges">${chip('on', 'Mặt bằng')}${CHARGES.map(c => chip(!ch ? 'none' : ch[c[0]] ? 'on' : 'off', c[1])).join('')}</div>`;
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
    // Căn chỉnh theo cột: c-center (STT, mã, hạng, trạng thái, ngày, thao tác); tên chợ + khoản thu căn trái.
    const body = rows.length ? rows.map((x, i) => `<tr><td class="c-center">${i + 1}</td><td class="c-center"><span class="fcm-code">${U.esc(x.m.code)}</span></td>
        <td><b class="fcm-name" title="${U.esc(x.m.name)}">${U.esc(x.m.name)}</b>${x.s.lifecycle.stage === 'PENDING_FEE' ? '<div class="small muted">Chờ cấu hình mức thu</div>' : ''}</td>
        <td class="c-center">${U.esc(MC().RANKS[x.m.rank] || '—')}</td><td>${chargeTags(x.m.id)}</td><td class="c-center">${tag(MARKET_STATE[x.state])}</td><td class="c-center">${latestEffective(x.m.id)}</td>
        <td class="c-center"><button class="btn sm" data-act="fcm-open" data-id="${U.esc(x.m.id)}">Xem</button></td></tr>`).join('')
      : '<tr><td colspan="8" class="empty">Không có chợ phù hợp.</td></tr>';
    return `<div class="card fcm-list"><div class="card-b">
      <div class="filters fcm-filters">
        <input class="input fcm-search" data-in="fcm-q" value="${U.esc(f.q)}" placeholder="Tìm theo tên chợ, mã chợ..." aria-label="Tìm chợ">
        <select class="input" data-ch="fcm-status" aria-label="Trạng thái cấu hình"><option value="">Trạng thái: Tất cả</option>${Object.keys(MARKET_STATE).map(k => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${MARKET_STATE[k][0]}</option>`).join('')}</select>
        <select class="input" data-ch="fcm-rank" aria-label="Hạng chợ"><option value="">Hạng chợ: Tất cả</option>${Object.keys(MC().RANKS).map(k => `<option value="${k}" ${f.rank === k ? 'selected' : ''}>${MC().RANKS[k]}</option>`).join('')}</select>
      </div>
      <div class="tbl-wrap"><table class="tbl fcm-list-tbl"><colgroup><col class="c-stt"><col class="c-code"><col class="c-name"><col class="c-rank"><col class="c-charges"><col class="c-state"><col class="c-date"><col class="c-act"></colgroup>
        <thead><tr><th class="c-center">STT</th><th class="c-center">Mã chợ</th><th>Tên chợ</th><th class="c-center">Hạng chợ</th><th>Khoản thu áp dụng</th><th class="c-center">Trạng thái cấu hình</th><th class="c-center">Ngày hiệu lực gần nhất</th><th class="c-center">Thao tác</th></tr></thead>
        <tbody>${body}</tbody></table></div>
      <div class="small muted fcm-legend">Khoản thu: ${chip('on', 'Áp dụng').replace(/<span class="sr-only">.*?<\/span>/, '')} ${chip('off', 'Không áp dụng').replace(/<span class="sr-only">.*?<\/span>/, '')} ${chip('none', 'Chưa khai báo').replace(/<span class="sr-only">.*?<\/span>/, '')} — khai báo khoản thu, không phải tình trạng sơ đồ mặt bằng.</div>
    </div></div>`;
  }

  // ---------- Phiên bản đơn giá (dùng chung cho Lịch sử thay đổi + Lịch sử đơn giá của 1 chợ) ----------
  const isWater = r => r.kind === 'WATER' || (!r.kind && r.elecPrice == null);
  const recLabel = (cat, r) => cat === 'stallPrices' ? 'Mặt bằng · ' + (r.areaTypeId ? U.areaTypeLabel(r.areaTypeId) : (r.stallType || '—'))
    : cat === 'utilities' ? (isWater(r) ? 'Nước' : 'Điện') : 'Dịch vụ · ' + (r.name || '—');
  const recPrice = (cat, r) => cat === 'utilities' ? (isWater(r) ? fmt(r.waterPrice) + ' ' + (r.waterUnit || 'đ/m³') : fmt(r.elecPrice) + ' ' + (r.elecUnit || 'đ/kWh')) : fmt(r.amount) + ' ' + (r.unit || '');
  const recBasis = r => { const files = (r.attachments || []).map(a => a.name).filter(Boolean); const lb = r.legalBasis || {}; return files.length ? files.join(', ') : (lb.docNo || lb.note || '—'); };
  const recPeriod = r => (r.effectiveFrom ? 'Từ ' + U.dmy(r.effectiveFrom) : '—') + (r.effectiveTo ? ' đến ' + U.dmy(r.effectiveTo) : '');
  const recTouched = r => (r.history || [])[0] || null; // lịch sử bản ghi: mới nhất ở đầu
  function versionRows(mids) {
    const rows = [];
    mids.forEach(mid => ['stallPrices', 'utilities', 'extraServices'].forEach(cat => owned(cat, mid).filter(r => cat !== 'extraServices' || isService(r)).forEach(r => rows.push({ mid, cat, r }))));
    return rows;
  }
  function versionsTable(rows, withMarket) {
    const cols = (withMarket ? ['Chợ'] : []).concat(['Khoản thu', 'Mức giá', 'Thời gian hiệu lực', 'Trạng thái phiên bản', 'Người cập nhật', 'Thời điểm cập nhật', 'Văn bản căn cứ']);
    const body = rows.length ? rows.map(x => { const t = recTouched(x.r); return `<tr>${withMarket ? `<td>${U.esc(U.mShort(x.mid))}</td>` : ''}<td>${U.esc(recLabel(x.cat, x.r))}</td><td class="nowrap"><b>${U.esc(recPrice(x.cat, x.r))}</b></td>
        <td>${recPeriod(x.r)}</td><td>${statusTag(x.r)}</td><td>${U.esc(t ? t.user || '—' : '—')}</td><td class="small">${U.esc(t ? t.time || '—' : '—')}</td><td class="small fcm-wrap">${U.esc(recBasis(x.r))}</td></tr>`; }).join('')
      : `<tr><td colspan="${cols.length}" class="empty">Chưa có mức thu riêng nào.</td></tr>`;
    return `<div class="tbl-wrap"><table class="tbl fcm-ver-tbl"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  // ---------- Lịch sử thay đổi ----------
  const histTime = t => { const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]*(\d{1,2}):(\d{2})/.exec(t || '') || /(\d{1,2}):(\d{2})(?::\d{2})? (\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t || '');
    if (!m) return ''; return m[0].indexOf(':') < m[0].indexOf('/') ? `${m[5]}${String(m[4]).padStart(2, '0')}${String(m[3]).padStart(2, '0')}${String(m[1]).padStart(2, '0')}${m[2]}` : `${m[3]}${String(m[2]).padStart(2, '0')}${String(m[1]).padStart(2, '0')}${String(m[4]).padStart(2, '0')}${m[5]}`; };
  function historyEntries(mids) {
    const out = [];
    mids.forEach(mid => {
      ['stallPrices', 'utilities', 'extraServices'].forEach(cat => owned(cat, mid).filter(r => cat !== 'extraServices' || isService(r))
        .forEach(r => (r.history || []).forEach(h => out.push({ mid, item: recLabel(cat, r), h }))));
      ((SC().utilityModeInfo(mid) || {}).history || []).forEach(h => out.push({ mid, item: 'Khoản thu áp dụng', h }));
    });
    return out.sort((a, b) => histTime(b.h.time).localeCompare(histTime(a.h.time)));
  }
  function historyHtml() {
    const f = st(), markets = scopedMarkets(), mid = markets.some(m => m.id === f.histMarket) ? f.histMarket : '';
    const mids = mid ? [mid] : markets.map(m => m.id);
    const versions = versionRows(mids).sort((a, b) => { const ta = recTouched(a.r), tb = recTouched(b.r); return histTime(tb && tb.time).localeCompare(histTime(ta && ta.time)) || byEffDesc(a.r, b.r); }).slice(0, 200);
    const log = historyEntries(mids).slice(0, 200);
    return `<div class="card"><div class="card-b fcm-hist">
      <div class="filters fcm-filters"><select class="input" data-ch="fcm-hist-market" aria-label="Chợ"><option value="">Tất cả chợ</option>${markets.map(m => `<option value="${U.esc(m.id)}" ${mid === m.id ? 'selected' : ''}>${U.esc(m.name)}</option>`).join('')}</select>
      <span class="small muted">Các phiên bản mức thu riêng của chợ (không gồm bảng giá tham chiếu dùng chung), tối đa 200 dòng gần nhất.</span></div>
      <h3 class="fcm-h3">Phiên bản đơn giá</h3>${versionsTable(versions, true)}
      <details class="fcm-log"><summary>Nhật ký thao tác <span class="small muted">(${log.length})</span></summary>
      ${U.table([{ t: 'Thời gian' }, { t: 'Chợ' }, { t: 'Hạng mục' }, { t: 'Hành động' }, { t: 'Người thực hiện' }, { t: 'Chi tiết' }],
        log.map(x => `<tr><td class="nowrap">${U.esc(x.h.time || '—')}</td><td>${U.esc(U.mShort(x.mid))}</td><td>${U.esc(x.item)}</td><td>${U.esc(x.h.action || '—')}</td><td>${U.esc(x.h.user || '—')}</td><td class="fcm-wrap">${U.esc(x.h.detail || '')}</td></tr>`), { empty: 'Chưa có thay đổi nào.' })}</details>
    </div></div>`;
  }

  // ---------- Chi tiết cấu hình 1 chợ: header · tiến độ · 4 hàng khoản thu · lịch sử đơn giá ----------
  // Trạng thái tính từ dữ liệu đã lưu (giá hiệu lực HÔM NAY + khai báo khoản thu). Thiết lập / thay đổi giá mở popup dùng
  // CHUNG bản nháp và service lưu (fc.saveMarketFeeConfig → addPriceVersion). Không có logic phiên bản / tính phí ở đây.
  const CARD_STATE = { SET: ['Đã thiết lập', 'ok'], MISSING: ['Chưa thiết lập', 'warn'], NA: ['Không áp dụng', ''] };
  const MARKET_STATE = { NONE: ['Chưa cấu hình', ''], PARTIAL: ['Chưa hoàn tất', 'warn'], COMPLETE: ['Đã cấu hình', 'ok'] };
  const ROW_STATE = { UNDECLARED: ['Chưa khai báo', 'fcm-t-none'], MISSING: ['Chưa thiết lập mức thu', 'warn'], SET: ['Đã thiết lập', 'ok'], NA: ['Không áp dụng', 'fcm-t-na'] };
  const ROW_NAME = { land: 'Tiền mặt bằng', electricity: 'Tiền điện', water: 'Tiền nước', service: 'Phí dịch vụ' };
  const ROW_KEYS = ['land', 'electricity', 'water', 'service'];
  const futureOf = rows => rows.filter(r => r.status === 'active' && r.effectiveFrom && r.effectiveFrom > today()).sort((a, b) => String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)))[0] || null;
  const tag = (x, extra) => `<span class="tag ${x[1]}">${x[0]}</span>${extra || ''}`;
  const FUTURE_TAG = '<span class="tag info fcm-t-future">Có mức thu mới sắp hiệu lực</span>';
  // Loại diện tích cần giá: loại đang có điểm KD; chợ chưa có điểm → các loại diện tích được phép của chợ (Danh mục chợ).
  function landScope(mid) {
    const pts = pointsByType(mid), used = AREA().filter(k => pts[k]);
    if (used.length) return { types: used, byPoints: true };
    const m = MC().get(mid) || {}, allowed = (m.allowedAreaTypeIds || []).filter(k => AREA().indexOf(k) !== -1);
    return { types: allowed.length ? allowed : AREA(), byPoints: false };
  }
  // Loại hiển thị trong popup / bảng chi tiết = loại cần giá + loại đã có mức riêng còn hiệu lực (để vẫn đổi được).
  const landTypes = (scope, cur) => AREA().filter(k => scope.types.indexOf(k) !== -1 || cur.lands.some(r => r.areaTypeId === k && r.status === 'active' && (!r.effectiveTo || r.effectiveTo >= today())));
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
  // Trạng thái 1 hàng khoản thu: Điện / Nước / Dịch vụ chưa chọn Áp dụng / Không áp dụng → "Chưa khai báo" (trung tính).
  const rowState = (k, states, ch) => k === 'land' ? states.land : !ch ? 'UNDECLARED' : states[k];
  const canReset = mid => U.can('cau-hinh-gia') && A.canDo('cau-hinh-gia.dat-lai-cau-hinh-cho') && allowedIds().indexOf(mid) !== -1;
  function headerHtml(m, states) {
    const more = canReset(m.id) ? `<details class="fcm-more"><summary class="btn sm" aria-label="Thao tác khác">Thao tác khác ▾</summary><div class="fcm-more-menu"><button class="btn sm danger" data-act="fcm-mreset-open">Đặt lại cấu hình mức thu</button></div></details>` : '';
    return `<section class="fcm-head"><button class="btn sm" data-act="fcm-back">← Danh sách</button>
      <div class="fcm-head-title"><h2>Cấu hình mức thu – ${U.esc(m.name)}</h2>
        <div class="fcm-meta"><span>Mã chợ <b>${U.esc(m.code)}</b></span><span>Hạng <b>${U.esc(MC().RANKS[m.rank] || '—')}</b></span><span>Trạng thái cấu hình ${tag(MARKET_STATE[states.market])}</span></div></div>${more}</section>`;
  }
  // Tiến độ: đếm từ trạng thái thật của 4 khoản; "Không áp dụng" đã khai báo = đã xử lý (không phải thiếu giá).
  function progressHtml(states, ch, lc) {
    const rs = ROW_KEYS.map(k => [k, rowState(k, states, ch)]), done = rs.filter(x => x[1] === 'SET' || x[1] === 'NA').length;
    const todo = rs.filter(x => x[1] !== 'SET' && x[1] !== 'NA').map(([k, s]) => ROW_NAME[k] + ': ' + ROW_STATE[s][0].toLowerCase()
      + (k === 'land' && states.landMissing.length ? ' (' + states.landMissing.map(t => U.areaTypeLabel(t)).join(', ') + ')' : ''));
    const gap = !todo.length && lc.feeGap ? 'Còn thiếu: ' + lc.feeGap.replace(/^Thiếu:\s*/, '') : '';
    const msg = todo.length ? 'Còn cần xử lý: ' + todo.join(' · ') : gap || (states.market === 'COMPLETE' ? 'Đã hoàn tất cấu hình mức thu của chợ.' : '');
    return `<section class="card fcm-progress"><div class="fcm-progress-top"><b>Tiến độ cấu hình</b><span class="small muted">Đã xử lý <b>${done}/${ROW_KEYS.length}</b> khoản thu · còn ${ROW_KEYS.length - done} khoản cần xử lý</span>${tag(MARKET_STATE[states.market])}</div>
      <div class="fcm-bar" role="progressbar" aria-label="Tiến độ cấu hình" aria-valuemin="0" aria-valuemax="${ROW_KEYS.length}" aria-valuenow="${done}"><span style="width:${Math.round(done * 100 / ROW_KEYS.length)}%"></span></div>
      ${msg ? `<div class="small fcm-progress-msg">${U.esc(msg)}</div>` : ''}
      ${lc.layoutReady ? '' : '<div class="small muted">Sơ đồ mặt bằng của chợ chưa thiết lập — chợ chỉ hoạt động khi đã thiết lập sơ đồ mặt bằng và đủ mức thu.</div>'}</section>`;
  }
  function applySeg(k, ch, edit) {
    const v = ch ? ch[k] : null, dis = edit ? '' : 'disabled';
    return `<div class="seg fcm-seg" role="group" aria-label="${U.esc(ROW_NAME[k])}"><button class="${v === true ? 'on' : ''}" data-act="fcm-apply" data-k="${k}" data-v="1" ${dis}>Áp dụng</button><button class="${v === false ? 'on' : ''}" data-act="fcm-apply" data-k="${k}" data-v="0" ${dis}>Không áp dụng</button></div>${v === null || v === undefined ? '<div class="small muted">Chưa chọn Áp dụng / Không áp dụng</div>' : ''}`;
  }
  function rowHtml(k, o) {
    return `<div class="fcm-row" data-row="${k}">
      <div class="fcm-row-name"><b>${ROW_NAME[k]}</b><div class="small muted">${o.desc}</div></div>
      <div class="fcm-row-apply"><span class="fcm-row-lbl">Áp dụng</span>${o.apply}</div>
      <div class="fcm-row-price"><span class="fcm-row-lbl">Mức giá hiện hành</span>${o.price}</div>
      <div class="fcm-row-state"><span class="fcm-row-lbl">Trạng thái</span>${tag(ROW_STATE[o.state])}${o.future ? FUTURE_TAG : ''}</div>
      <div class="fcm-row-act">${o.act || ''}</div>
      ${o.more ? `<div class="fcm-row-more">${o.more}</div>` : ''}</div>`;
  }
  const editBtn = (card, has, labels) => `<button class="btn sm ${has ? '' : 'primary'}" data-act="fcm-edit" data-card="${card}">${has ? labels[1] : labels[0]}</button>`;
  function landRow(mid, states, cur, edit) {
    const pts = pointsByType(mid), scope = states.scope, types = landTypes(scope, cur);
    const priced = scope.types.filter(k => cur.land[k]).length, futures = types.map(k => futureOf(cur.lands.filter(x => x.areaTypeId === k)));
    const scopeText = scope.byPoints ? `${scope.types.length} loại diện tích có điểm kinh doanh` : `Chợ chưa có điểm kinh doanh — áp dụng ${scope.types.length} loại diện tích được phép của chợ`;
    const price = `<span><b>${priced}/${scope.types.length}</b> loại diện tích có giá</span>${states.landMissing.length ? `<div class="small fcm-warn-text">Chưa có giá: ${states.landMissing.map(k => U.esc(U.areaTypeLabel(k))).join(', ')}</div>` : ''}`;
    const rows = types.map((k, i) => { const r = cur.land[k], fut = futures[i];
      return `<tr><td><b>${U.esc(U.areaTypeLabel(k))}</b></td><td class="num">${fmt(pts[k] || 0)}</td>
        <td>${r ? `<b>${fmt(r.amount)}</b> <span class="small muted">đ/m²/ngày · từ ${U.dmy(r.effectiveFrom)}</span>` : '<span class="muted">Chưa thiết lập</span>'}${fut ? `<div class="small fcm-future">Mức mới ${fmt(fut.amount)} đ/m²/ngày từ ${U.dmy(fut.effectiveFrom)}</div>` : ''}</td></tr>`; });
    const more = `<details class="fcm-detail"><summary>Xem giá từng loại diện tích</summary>
      <div class="tbl-wrap"><table class="tbl fcm-mini"><thead><tr><th>Loại diện tích</th><th class="num">Điểm KD</th><th>Giá hiện hành của chợ</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
      <div class="fcm-detail-f small muted"><button class="btn link" data-act="fcm-edit" data-card="land-view">Xem lịch sử giá & căn cứ</button></div></details>`;
    return rowHtml('land', { desc: 'Khoản bắt buộc · ' + scopeText, apply: '<span class="fcm-fixed">Bắt buộc</span>', price, state: states.land, future: futures.some(Boolean), more,
      act: edit ? editBtn('land', AREA().some(k => cur.land[k]), ['Thiết lập mức thu', 'Thay đổi mức thu']) : '' });
  }
  function utilRow(k, states, cur, ch, edit) {
    const c = UTIL[k], r = cur[k], s = rowState(k, states, ch), fut = s === 'NA' ? null : futureOf(cur.utils.filter(u => (!u.kind || u.kind === c.kind) && u[c.field] != null));
    const price = (s === 'NA' ? '<span class="muted">Không yêu cầu đơn giá</span>'
      : r ? `<span class="fcm-price"><b>${fmt(r[c.field])}</b> <span>${c.unit}</span></span><div class="small muted">Hiệu lực từ ${U.dmy(r.effectiveFrom)}</div>`
        : s === 'UNDECLARED' ? '<span class="muted">Chưa có đơn giá</span>' : '<span class="fcm-warn-text">Chưa thiết lập đơn giá</span>')
      + (fut ? `<div class="small fcm-future">Mức mới ${fmt(fut[c.field])} ${c.unit} từ ${U.dmy(fut.effectiveFrom)}</div>` : '');
    return rowHtml(k, { desc: 'Đơn vị ' + c.unit + ' · tính theo chỉ số công tơ', apply: applySeg(k, ch, edit), price, state: s, future: !!fut,
      act: edit && s !== 'NA' ? editBtn(k, !!r, ['Thiết lập', 'Thay đổi']) : '' });
  }
  const calcLabel = r => r.unit || (SVC_CALC.find(x => x[0] === r.calcMethod) || [0, '—'])[1];
  const activeServices = cur => cur.services.filter(r => r.status === 'active' && (!r.effectiveTo || r.effectiveTo >= today())).sort(byEffDesc);
  function serviceRow(states, cur, ch, edit) {
    const s = rowState('service', states, ch), list = activeServices(cur), liveN = list.filter(live).length, fut = s !== 'NA' && list.some(r => !live(r));
    const price = s === 'NA' ? '<span class="muted">Không yêu cầu mức thu</span>' : liveN ? `<span><b>${liveN}</b> dịch vụ đang hiệu lực</span>`
      : s === 'UNDECLARED' ? '<span class="muted">Chưa có dịch vụ</span>' : '<span class="fcm-warn-text">Chưa có dịch vụ đang hiệu lực</span>';
    const more = s !== 'NA' && list.length ? `<details class="fcm-detail"><summary>Xem danh sách dịch vụ (${list.length})</summary>
      <div class="tbl-wrap"><table class="tbl fcm-mini"><thead><tr><th>Dịch vụ</th><th>Đơn vị tính</th><th class="num">Mức thu</th><th>Chu kỳ</th><th>Hiệu lực</th></tr></thead><tbody>${list.map(r => `<tr><td><b>${U.esc(r.name || '—')}</b></td><td>${U.esc(calcLabel(r))}</td><td class="num">${fmt(r.amount)}</td><td>Hàng tháng</td><td class="small">${live(r) ? 'Từ ' + U.dmy(r.effectiveFrom) : '<span class="fcm-future">Từ ' + U.dmy(r.effectiveFrom) + ' (sắp hiệu lực)</span>'}</td></tr>`).join('')}</tbody></table></div></details>` : '';
    return rowHtml('service', { desc: 'Nhiều loại dịch vụ · phí gửi xe quản lý riêng, không tính ở đây', apply: applySeg('service', ch, edit), price, state: s, future: fut, more,
      act: edit && s !== 'NA' ? editBtn('service', list.length > 0, ['Thêm dịch vụ', 'Thay đổi']) : '' });
  }
  // Lịch sử đơn giá: mọi phiên bản mức thu riêng của chợ (kể cả đã hết hiệu lực) — chỉ đọc, không xóa.
  function priceHistoryHtml(mid) {
    const rows = versionRows([mid]).sort((a, b) => recLabel(a.cat, a.r).localeCompare(recLabel(b.cat, b.r)) || byEffDesc(a.r, b.r));
    return `<details class="card fcm-history"><summary><b>Lịch sử đơn giá</b> <span class="small muted">(${rows.length} phiên bản)</span></summary>${versionsTable(rows, false)}</details>`;
  }
  function resultHtml() {
    const r = st().result;
    if (!r) return '';
    return `<div class="note ${r.tone} fcm-result" role="status"><b>${U.esc(r.title)}</b>${r.items && r.items.length ? `<ul>${r.items.map(x => `<li>${U.esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
  }
  function detailHtml() {
    const f = st(), mid = f.marketId, m = MC().get(mid);
    if (!m || allowedIds().indexOf(mid) === -1) { f.view = 'list'; return listShellHtml(); }
    const lc = L().marketLifecycle(mid), edit = canEdit(mid), cur = current(mid), ch = SC().chargeApplicability(mid), states = cardStates(mid);
    return `<div class="fcm-page">${headerHtml(m, states)}${f.popup ? '' : resultHtml()}${progressHtml(states, ch, lc)}
      <section class="card fcm-rows"><div class="fcm-rows-h"><h3>Khoản thu và mức giá</h3>${edit ? '' : '<span class="small muted">Bạn chỉ có quyền xem cấu hình mức thu.</span>'}</div>
        <div class="fcm-rows-head" aria-hidden="true"><span>Khoản thu</span><span>Áp dụng</span><span>Mức giá hiện hành</span><span>Trạng thái</span><span></span></div>
        ${landRow(mid, states, cur, edit)}${utilRow('electricity', states, cur, ch, edit)}${utilRow('water', states, cur, ch, edit)}${serviceRow(states, cur, ch, edit)}</section>
      ${priceHistoryHtml(mid)}</div>`;
  }

  // ---------- Popup thiết lập (dùng chung bản nháp + service lưu) ----------
  // Bố cục thống nhất: các phần đánh số (giá → thời gian áp dụng → văn bản căn cứ → ghi chú), lỗi hiện tại đúng trường,
  // footer cố định chỉ có Hủy / Lưu mức thu. Ngày hiệu lực + tệp căn cứ KHÔNG nằm ở footer.
  const POPUP_TITLE = { land: 'Thiết lập giá mặt bằng', 'land-view': 'Lịch sử giá mặt bằng & căn cứ', electricity: 'Thiết lập đơn giá điện', water: 'Thiết lập đơn giá nước', service: 'Thiết lập phí dịch vụ', charges: 'Khoản thu áp dụng' };
  let shownErr = null; // khóa lỗi đã hiển thị tại trường trong lần vẽ popup hiện tại
  const errOf = key => (st().fieldErrors || {})[key] || '';
  const ferr = key => { if (shownErr) shownErr.add(key); const e = errOf(key); return e ? `<div class="fcm-ferr" role="alert">${U.esc(e)}</div>` : ''; };
  const inv = key => errOf(key) ? 'is-invalid' : '';
  const star = '<span class="fcm-star" aria-hidden="true">*</span>';
  const sec = (n, title, body, sub) => `<section class="fcm-sec"><h4 class="fcm-sec-h"><span class="fcm-step">${n}</span>${title}</h4>${sub ? `<div class="small muted fcm-sec-sub">${sub}</div>` : ''}${body}</section>`;
  const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
  const effText = v => isDate(v) ? 'Áp dụng từ ngày ' + U.dmy(v) : 'Chưa chọn ngày';
  const effWarn = v => isDate(v) && !fc.firstOfMonth(v) ? '<div class="fcm-ferr">Giá mới chỉ được có hiệu lực từ ngày 01 của tháng.</div>' : '';
  function effSection(n, d, edit, hint) {
    const v = d.effectiveFrom || '';
    return sec(n, 'Thời gian áp dụng', `<div class="field fcm-field">
      <label for="fcm-eff">Ngày bắt đầu hiệu lực ${star}</label>
      <div class="fcm-eff-row"><input id="fcm-eff" class="input fcm-date ${inv('effectiveFrom')}" type="date" data-in="fcm-field" data-path="effectiveFrom" value="${U.esc(v)}" ${edit ? '' : 'disabled'}><span class="small muted" data-fcm-live="eff">${effText(v)}</span></div>
      <div data-fcm-live="eff-err">${ferr('effectiveFrom') || effWarn(v)}</div>
      <div class="small muted">${hint}</div></div>`);
  }
  // Yêu cầu tệp căn cứ = kết quả kiểm tra thử của CHÍNH service lưu (validateOnly) — UI không tự đặt quy tắc.
  function fileReq(mid, d) {
    if (!canEdit(mid)) return 'NONE_YET';
    const v = fc.saveMarketFeeConfig(mid, d, actor(), { validateOnly: true });
    return !v || !v.priceChanges ? 'NONE_YET' : v.needsFile ? 'REQUIRED' : 'NONE_YET';
  }
  const FILE_REQ = {
    NONE_YET: [true, 'Bắt buộc khi thay đổi đơn giá (quyết định / công văn, PDF hoặc ảnh).'],
    REQUIRED: [true, 'Bắt buộc cho thay đổi này (quyết định / công văn, PDF hoặc ảnh).']
  };
  const fileReqHtml = req => `<label>Văn bản căn cứ áp dụng mức thu ${FILE_REQ[req][0] ? star : '<span class="small muted">(không bắt buộc)</span>'}</label><div class="small muted">${FILE_REQ[req][1]}</div>`;
  function fileSection(n, mid, d, edit) {
    const file = d.file, size = file && file.size ? ' · ' + Math.max(1, Math.round(file.size / 1024)) + ' KB' : '';
    const pick = label => `<label class="btn sm fcm-file">${label}<input type="file" accept="application/pdf,image/*" data-ch="fcm-file" aria-label="Chọn văn bản căn cứ"></label>`;
    const box = !edit ? (file ? `<div class="fcm-file-chip">📄 <b>${U.esc(file.name)}</b></div>` : '<div class="small muted">Chưa chọn tệp.</div>')
      : file ? `<div class="fcm-file-chip">📄 <b>${U.esc(file.name)}</b><span class="small muted">${size}</span></div>${pick('Thay tệp')}<button class="btn sm" data-act="fcm-file-remove">Gỡ tệp</button>`
        : `${pick('+ Chọn tệp (PDF / ảnh)')}<span class="small muted">Chưa chọn tệp</span>`;
    return sec(n, 'Văn bản căn cứ', `<div class="field fcm-field"><div data-fcm-live="file-req">${fileReqHtml(fileReq(mid, d))}</div><div class="fcm-upload ${inv('file')}">${box}</div>${ferr('file')}</div>`);
  }
  // Mức thu theo loại diện tích của chính chợ. Loại hiển thị lấy từ landScope
  // (loại có điểm KD / loại được phép của chợ) + loại đã có mức riêng.
  function landPopupBody(mid, d, edit, cur) {
    const lc = L().marketLifecycle(mid), pts = pointsByType(mid), scope = landScope(mid), types = landTypes(scope, cur);
    const rows = types.map(k => {
      const r = cur.land[k], v = d.land[k], n = num(v), need = scope.types.indexOf(k) !== -1, label = U.areaTypeLabel(k);
      const legacyCovers = !r && pts[k] && lc.fee.missingAreaTypes.indexOf(k) === -1;
      const now = r ? `Hiện hành: <b>${fmt(r.amount)}</b> đ/m²/ngày từ ${U.dmy(r.effectiveFrom)}` : legacyCovers ? 'Hiện hành: theo loại quầy cũ' : 'Chưa có giá hiện hành';
      return `<tr><th scope="row"><b>${U.esc(label)}</b><div class="small muted">${fmt(pts[k] || 0)} điểm KD${need ? '' : ' · không bắt buộc'}</div></th>
        <td class="num">${fmt(pts[k] || 0)}</td><td><div class="fcm-money"><input class="input fcm-num ${inv('land.' + k)}" type="number" min="0" step="any" inputmode="decimal" data-in="fcm-field" data-path="land.${k}" value="${U.esc(v)}" ${edit ? '' : 'disabled'} aria-label="Đơn giá áp dụng ${U.esc(label)}"><span class="fcm-unit-s">đ/m²/ngày</span></div>
          <div class="small muted fcm-now">${now}<span data-fcm-live="chg-land.${k}">${changeText(n, r ? Number(r.amount) : null, 'đ/m²/ngày')}</span></div>
          ${ferr('land.' + k)}</td></tr>`;
    });
    const legacyNote = cur.legacyLand.length ? `<div class="note info small">Chợ đang áp dụng mức thu mặt bằng theo loại quầy cũ: ${cur.legacyLand.map(x => U.esc(x.stallType || '—') + ' ' + fmt(x.amount) + ' ' + U.esc(x.unit || 'đ/m²/ngày')).join('; ')}. Nhập mức theo loại diện tích để chuyển sang cấu hình mới.</div>` : '';
    const table = `<div class="tbl-wrap"><table class="tbl fcm-land-tbl"><colgroup><col class="c-type"><col class="c-points"><col class="c-in"></colgroup><thead><tr><th>Loại diện tích</th><th class="num">Số điểm kinh doanh</th><th>Đơn giá áp dụng ${star}<div class="small muted">đ/m²/ngày</div></th></tr></thead><tbody>${rows.join('') || '<tr><td colspan="3" class="empty">Chợ chưa khai báo loại diện tích.</td></tr>'}</tbody></table></div>`;
    return sec(1, 'Mức thu theo loại diện tích', `${legacyNote}${table}
        ${pts._legacy ? `<div class="small muted">${fmt(pts._legacy)} điểm "Theo phiên" (dữ liệu cũ) không yêu cầu mức thu và không chặn hoạt động.</div>` : ''}${ferr('land')}`,
      'Ô giá mặc định bằng giá hiện hành — giữ nguyên thì không tạo phiên bản mới.')
      + effSection(2, d, edit, 'Giá mới chỉ có hiệu lực từ ngày 01 của tháng; phiên bản cũ được giữ trong lịch sử.')
      + fileSection(3, mid, d, edit)
      + sec(4, 'Ghi chú', `<div class="field fcm-field"><label for="fcm-land-note">Ghi chú <span class="small muted">(không bắt buộc)</span></label><textarea id="fcm-land-note" class="input" rows="2" data-in="fcm-field" data-path="landNote" ${edit ? '' : 'disabled'} placeholder="Ví dụ: số quyết định, lý do điều chỉnh">${U.esc(d.landNote || '')}</textarea></div>`);
  }
  // Hiển thị "giá mới" đã định dạng ngay dưới ô nhập (đọc dễ hơn ô number) — chỉ hiển thị, không đổi giá trị nhập.
  function changeText(n, curV, unit) {
    if (n === null || !(n > 0)) return '';
    if (curV !== null && n === curV) return ' · <span class="fcm-same">giữ nguyên</span>';
    return ` · <span class="fcm-chg">giá mới ${fmt(n)} ${unit}</span>`;
  }
  function utilPopupBody(k, mid, d, edit, cur) {
    const c = UTIL[k], applies = d.charges[k], dis = edit && applies !== false ? '' : 'disabled', r = cur[k];
    const now = r ? `<div class="fcm-current"><span>Đơn giá hiện hành</span><b>${fmt(r[c.field])} ${c.unit}</b><span class="small muted">hiệu lực từ ${U.dmy(r.effectiveFrom)}</span></div>`
      : `<div class="fcm-current is-empty"><span>Chưa có đơn giá ${c.noun} đang hiệu lực.</span></div>`;
    const n = num(d[k].price);
    return sec(1, 'Thông tin đơn giá', `${applies === false ? '<div class="note">Khoản này hiện không áp dụng tại chợ.</div>' : ''}${now}
      <div class="fcm-grid2"><div class="field fcm-field"><label for="fcm-${k}-price">${r ? 'Đơn giá mới' : 'Đơn giá'} ${c.noun} ${star}</label>
        <div class="fcm-money"><input id="fcm-${k}-price" class="input fcm-num ${inv(k)}" type="number" min="0" step="any" inputmode="decimal" data-in="fcm-field" data-path="${k}.price" value="${U.esc(d[k].price)}" ${dis}><span class="fcm-unit-s">${c.unit}</span></div>
        <div class="small muted" data-fcm-live="chg-${k}">${changeText(n, r ? Number(r[c.field]) : null, c.unit).replace(/^ · /, '')}</div>${ferr(k)}</div>
      <div class="field fcm-field"><label for="fcm-${k}-note">Ghi chú <span class="small muted">(không bắt buộc)</span></label><input id="fcm-${k}-note" class="input" data-in="fcm-field" data-path="${k}.note" value="${U.esc(d[k].note)}" ${dis} placeholder="Ví dụ: theo giá bán lẻ ${c.noun} hiện hành"></div></div>`,
      r ? 'Đổi đơn giá tạo phiên bản mới từ ngày hiệu lực đã chọn; phiên bản cũ được giữ trong lịch sử.' : '')
      + effSection(2, d, edit && applies !== false, 'Giá mới chỉ có hiệu lực từ ngày 01 của tháng.')
      + fileSection(3, mid, d, edit && applies !== false);
  }
  function servicePopupBody(mid, d, edit, cur) {
    const applies = d.charges.service, on = edit && applies !== false, dis = on ? '' : 'disabled';
    const rows = activeServices(cur).map(r => {
      const editable = live(r) && r.status === 'active', editing = d.services[r.id] !== undefined;
      const amount = editing ? `<div class="fcm-money"><input class="input fcm-num ${inv('service.' + r.id)}" type="number" min="0" step="any" data-in="fcm-field" data-path="services.${U.esc(r.id)}" value="${U.esc(d.services[r.id])}" ${dis} aria-label="Mức thu mới ${U.esc(r.name || '')}"><span class="fcm-unit-s">đ</span></div><div class="small muted">Hiện hành ${fmt(r.amount)}</div>${ferr('service.' + r.id)}` : `<b>${fmt(r.amount)}</b>`;
      const act = !on || !editable ? '' : editing ? `<button class="btn sm" data-act="fcm-svc-edit" data-id="${U.esc(r.id)}" data-off="1">Hủy đổi</button>` : `<button class="btn sm" data-act="fcm-svc-edit" data-id="${U.esc(r.id)}">Đổi mức thu</button>`;
      return `<tr><td><b>${U.esc(r.name || '—')}</b></td><td>${U.esc(calcLabel(r))}</td><td class="num">${amount}</td><td>Hàng tháng</td><td class="small">Từ ${U.dmy(r.effectiveFrom)}</td><td>${statusTag(r)}</td><td class="nowrap">${act}</td></tr>`;
    });
    const added = d.newServices.map((x, i) => `<div class="fcm-newsvc"><div class="fcm-newsvc-h"><b>Dịch vụ mới ${i + 1}</b><button class="btn sm" data-act="fcm-svc-remove" data-key="${x.key}" ${dis}>Bỏ</button></div>
      <div class="fcm-grid4">
        <div class="field fcm-field"><label>Tên dịch vụ ${star}</label><input class="input ${inv('new.' + x.key + '.name')}" data-in="fcm-field" data-path="new.${x.key}.name" value="${U.esc(x.name)}" placeholder="Ví dụ: Phí vệ sinh" ${dis}>${ferr('new.' + x.key + '.name')}</div>
        <div class="field fcm-field"><label>Đơn vị tính ${star}</label><select class="input" data-ch="fcm-new-calc" data-key="${x.key}" ${dis}>${SVC_CALC.map(c => `<option value="${c[0]}" ${x.calcMethod === c[0] ? 'selected' : ''}>${c[1]}</option>`).join('')}</select></div>
        <div class="field fcm-field"><label>Mức thu ${star}</label><div class="fcm-money"><input class="input fcm-num ${inv('new.' + x.key + '.amount')}" type="number" min="0" step="any" data-in="fcm-field" data-path="new.${x.key}.amount" value="${U.esc(x.amount)}" ${dis}><span class="fcm-unit-s">đ</span></div>${ferr('new.' + x.key + '.amount')}</div>
        <div class="field fcm-field"><label>Chu kỳ thu</label><input class="input" value="Hàng tháng" disabled></div>
      </div>
      <div class="field fcm-field"><label>Ghi chú <span class="small muted">(không bắt buộc)</span></label><input class="input" data-in="fcm-field" data-path="new.${x.key}.note" value="${U.esc(x.note)}" ${dis}></div></div>`).join('');
    const table = `<div class="tbl-wrap"><table class="tbl fcm-svc-tbl"><thead><tr><th>Tên dịch vụ</th><th>Đơn vị tính</th><th class="num">Mức thu</th><th>Chu kỳ thu</th><th>Ngày hiệu lực</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows.join('') || '<tr><td colspan="7" class="empty">Chưa có dịch vụ riêng của chợ.</td></tr>'}</tbody></table></div>`;
    return sec(1, 'Dịch vụ đã cấu hình', `${applies === false ? '<div class="note">Chợ không áp dụng khoản thu dịch vụ.</div>' : ''}${table}`, 'Phí gửi xe được quản lý riêng, không tính ở đây.')
      + sec(2, 'Thêm dịch vụ', `${added}${on ? '<button class="btn sm" data-act="fcm-svc-add">+ Thêm dịch vụ</button>' : ''}`, d.newServices.length ? '' : 'Bấm "Thêm dịch vụ" để khai báo dịch vụ mới của chợ.')
      + effSection(3, d, on, 'Áp dụng cho mức thu mới / dịch vụ mới trong lần lưu này; chỉ từ ngày 01 của tháng.')
      + fileSection(4, mid, d, on);
  }
  function chargesPopupBody(d, edit) {
    const row = (label, ctl, sub) => `<div class="fcm-charge-row"><div><b>${label}</b><div class="small muted">${sub}</div></div>${ctl}</div>`;
    const seg = k => { const v = d.charges[k], dis = edit ? '' : 'disabled'; return `<div class="seg fcm-seg"><button class="${v === true ? 'on' : ''}" data-act="fcm-charge" data-k="${k}" data-v="1" ${dis}>Áp dụng</button><button class="${v === false ? 'on' : ''}" data-act="fcm-charge" data-k="${k}" data-v="0" ${dis}>Không áp dụng</button></div>`; };
    return sec(1, 'Khoản thu áp dụng tại chợ', `${row('Tiền mặt bằng', '<span class="fcm-fixed">Bắt buộc</span>', 'Khoản bắt buộc.')}
      ${CHARGES.map(([k, label]) => row(label, seg(k), d.charges[k] === null ? 'Chưa khai báo' : d.charges[k] ? 'Áp dụng — cần mức thu riêng hợp lệ.' : 'Không áp dụng — không yêu cầu mức thu; mức đang có ngừng từ ngày hiệu lực đã chọn.')).join('')}${ferr('charges')}`, 'Chọn đủ Điện, Nước, Dịch vụ rồi bấm Lưu.')
      + effSection(2, d, edit, 'Khi chuyển một khoản sang "Không áp dụng", mức giá đang có của khoản đó ngừng áp dụng từ ngày này.');
  }
  function landViewBody(mid) {
    const cur = current(mid), rows = cur.lands.slice().sort(byEffDesc);
    return sec(1, 'Các phiên bản giá mặt bằng', U.table([{ t: 'Loại diện tích' }, { t: 'Mức thu' }, { t: 'Thời gian hiệu lực' }, { t: 'Trạng thái' }, { t: 'Căn cứ' }], rows.map(r => `<tr><td>${U.esc(r.areaTypeId ? U.areaTypeLabel(r.areaTypeId) : (r.stallType || '—'))}</td><td class="nowrap"><b>${fmt(r.amount)}</b> ${U.esc(r.unit || 'đ/m²/ngày')}</td><td>${recPeriod(r)}</td><td>${statusTag(r)}</td><td class="nowrap"><button class="btn sm" data-act="policy-land-view" data-id="${U.esc(r.id)}">Xem</button></td></tr>`), { empty: 'Chưa có mức thu mặt bằng riêng.' }));
  }
  // Có thay đổi chưa lưu? (so với ảnh chụp bản nháp lúc mở popup)
  const snap = d => d ? JSON.stringify(Object.assign({}, d, { file: d.file ? [d.file.name, d.file.size] : null })) : '';
  const dirty = () => { const f = st(); return !!(f.draft && f.base !== undefined && snap(f.draft) !== f.base); };
  function popupHtml() {
    const f = st(), mid = f.marketId, card = f.popup, edit = canEdit(mid), d = draftFor(mid), cur = current(mid), m = MC().get(mid) || {};
    shownErr = new Set();
    const body = card === 'land' ? landPopupBody(mid, d, edit, cur) : card === 'land-view' ? landViewBody(mid)
      : card === 'service' ? servicePopupBody(mid, d, edit, cur)
        : card === 'charges' ? chargesPopupBody(d, edit) : utilPopupBody(card, mid, d, edit, cur);
    const fe = f.fieldErrors || {}, keys = Object.keys(fe), rest = keys.filter(k => !shownErr.has(k)).map(k => fe[k]);
    const unkeyed = (f.saveErrors || []).filter(e => keys.every(k => fe[k] !== e));
    shownErr = null;
    const others = rest.concat(unkeyed);
    const summary = keys.length || others.length ? `<div class="note danger fcm-errsum" role="alert"><b>Chưa lưu được.</b> ${keys.length - rest.length ? `Vui lòng sửa ${keys.length - rest.length} mục được đánh dấu bên dưới.` : ''}${others.length ? `<ul>${others.map(e => `<li>${U.esc(e)}</li>`).join('')}</ul>` : ''}</div>` : '';
    const readOnly = !edit || card === 'land-view';
    const foot = readOnly ? '<span class="spacer"></span><button class="btn" data-act="fcm-popup-close">Đóng</button>'
      : f.confirmDiscard ? '<span class="fcm-discard-q">Bỏ các thay đổi chưa lưu?</span><span class="spacer"></span><button class="btn" data-act="fcm-discard-cancel">Tiếp tục chỉnh sửa</button><button class="btn danger" data-act="fcm-popup-discard">Bỏ thay đổi</button>'
        : `<span class="spacer"></span><button class="btn" data-act="fcm-popup-close">Hủy</button><button class="btn primary" data-act="fcm-save" ${f.saving ? 'disabled aria-busy="true"' : ''}>${f.saving ? 'Đang lưu…' : card === 'charges' ? 'Lưu khai báo' : 'Lưu mức thu'}</button>`;
    return `<div class="modal-h fcm-modal-h"><h3>${U.esc(POPUP_TITLE[card] || 'Cấu hình mức thu')} – ${U.esc(m.name || '')}</h3><button class="x" data-act="fcm-popup-close" aria-label="Đóng">×</button></div>
      <div class="modal-b fcm-popup">${readOnly && card !== 'land-view' ? '<div class="note">Bạn chỉ có quyền xem cấu hình mức thu.</div>' : ''}${summary}${body}</div><div class="modal-f fcm-popup-f">${foot}</div>`;
  }
  // Mở / vẽ lại popup (dữ liệu nháp giữ trong ui.feeCfg — không ghi gì cho tới khi Lưu).
  function showPopup() { const f = st(); if (f.popup) A.modal(popupHtml(), true); }
  function refresh() { A.render(); showPopup(); }
  // Cập nhật tại chỗ các dòng phụ (giá mới đã định dạng, ngày dd/mm/yyyy, yêu cầu căn cứ) khi gõ — không vẽ lại popup
  // để không mất con trỏ.
  function liveUpdate(path) {
    try {
      const root = typeof document !== 'undefined' && document.querySelector ? document.querySelector('#modal-root') : null;
      if (!root || !root.querySelector) return;
      const f = st(), d = f.draft, cur = current(f.marketId), set = (sel, html) => { const el = root.querySelector(sel); if (el) el.innerHTML = html; };
      if (!d) return;
      const p = String(path || '').split('.');
      if (p[0] === 'land') set(`[data-fcm-live="chg-land.${p[1]}"]`, changeText(num(d.land[p[1]]), cur.land[p[1]] ? Number(cur.land[p[1]].amount) : null, 'đ/m²/ngày'));
      if (UTIL[p[0]] && p[1] === 'price') set(`[data-fcm-live="chg-${p[0]}"]`, changeText(num(d[p[0]].price), cur[p[0]] ? Number(cur[p[0]][UTIL[p[0]].field]) : null, UTIL[p[0]].unit).replace(/^ · /, ''));
      if (p[0] === 'effectiveFrom') { set('[data-fcm-live="eff"]', effText(d.effectiveFrom)); set('[data-fcm-live="eff-err"]', effWarn(d.effectiveFrom)); }
      set('[data-fcm-live="file-req"]', fileReqHtml(fileReq(f.marketId, d)));
    } catch (e) { console.error('[fee-config] không cập nhật được thông tin phụ của popup', e); }
  }

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
    return `<div class="modal-h fcm-modal-h"><h3>Đặt lại cấu hình mức thu – ${U.esc(m.name || mid)}</h3><button class="x" data-act="fcm-mreset-close" aria-label="Đóng">×</button></div>
      <div class="modal-b fcm-popup">${errors}
        <div class="note warn">Thao tác đặc biệt. Gỡ các mức thu riêng chưa từng được sử dụng và khai báo khoản thu áp dụng của <b>${U.esc(m.name || mid)}</b>, đưa chợ về <b>Chưa cấu hình</b>. Dữ liệu được sao lưu trước khi gỡ. Thay đổi đơn giá thường ngày không dùng chức năng này.</div>
        <h4 class="fcm-sub">Sẽ đặt lại</h4>
        ${U.table([{ t: 'Mức thu riêng' }, { t: 'Mức giá' }, { t: 'Hiệu lực từ' }, { t: 'Sử dụng' }], rows, { empty: 'Không có mức thu riêng.' })}
        <div class="small">Khai báo khoản thu áp dụng hiện tại: <b>${U.esc(ch)}</b></div>
        <h4 class="fcm-sub">Không thay đổi</h4>
        <div class="small muted">Dữ liệu giá dùng chung cũ (nếu có), phí gửi xe, lịch kỳ thu, sơ đồ mặt bằng, điểm kinh doanh, hồ sơ tiểu thương, hợp đồng, chỉ số điện nước, kỳ thu, khoản phải thu, biên lai, đối soát và cấu hình của các chợ khác.</div>
        ${plan.used.length ? '<div class="note danger">Có mức thu đã được sử dụng — không thể đặt lại. Hãy tạo phiên bản giá thay thế với ngày hiệu lực mới.</div>' : ''}
        ${blocked ? '' : `<div class="field"><label>Lý do đặt lại *</label><textarea class="input" rows="2" data-in="fcm-mreset-reason" placeholder="Ví dụ: cấu hình thử nghiệm, cần khai báo lại từ đầu">${U.esc(r.reason || '')}</textarea></div>
        <label class="fcm-ack"><input type="checkbox" data-ch="fcm-mreset-ack" ${r.confirmed ? 'checked' : ''}> Tôi đã kiểm tra danh sách trên và xác nhận đặt lại cấu hình mức thu của chợ này.</label>`}
      </div>
      <div class="modal-f"><span class="spacer"></span><button class="btn" data-act="fcm-mreset-close">Hủy</button>${blocked ? '' : '<button class="btn danger" data-act="fcm-mreset-confirm">Đặt lại cấu hình</button>'}</div>`;
  }

  function listShellHtml() {
    const f = st(), tab = f.tab === 'history' ? 'history' : 'list';
    return `<div class="fcm-page"><section class="fcm-title"><h2>Chính sách thu và biểu phí</h2><p>Quản lý khoản thu và mức giá áp dụng cho từng chợ.</p></section>
      <div class="seg fcm-tabs"><button class="${tab === 'list' ? 'on' : ''}" data-act="fcm-tab" data-id="list">Danh sách cấu hình</button><button class="${tab === 'history' ? 'on' : ''}" data-act="fcm-tab" data-id="history">Lịch sử thay đổi</button></div>
      ${tab === 'history' ? historyHtml() : listHtml()}</div>`;
  }
  fc.marketConfigView = function () { return st().view === 'detail' ? detailHtml() : listShellHtml(); };
  A.VIEWS['cau-hinh-gia'] = fc.marketConfigView;

  // ---------- Handlers ----------
  const POPUP_RESET = { popup: null, draft: null, result: null, fieldErrors: {}, saveErrors: [], confirmDiscard: false, saving: false, base: undefined };
  A.ACT['fcm-tab'] = el => { st().tab = el.dataset.id === 'history' ? 'history' : 'list'; A.render(); };
  A.IN['fcm-q'] = el => { st().filter.q = el.value; A.render(); };
  A.CH['fcm-status'] = el => { st().filter.status = el.value; A.render(); };
  A.CH['fcm-rank'] = el => { st().filter.rank = el.value; A.render(); };
  A.CH['fcm-hist-market'] = el => { st().histMarket = el.value; A.render(); };
  A.ACT['fcm-open'] = el => {
    const id = el.dataset.id;
    if (!U.can('cau-hinh-gia') || !MC().get(id) || allowedIds().indexOf(id) === -1) return;
    Object.assign(st(), POPUP_RESET, { view: 'detail', marketId: id, dtab: 'charges', reset: null });
    A.render();
  };
  A.ACT['fcm-back'] = () => { Object.assign(st(), POPUP_RESET, { view: 'list', marketId: null, reset: null }); A.closeModal(); A.render(); };
  // Mở popup của một khoản. base = ảnh chụp bản nháp để nhận biết "thay đổi chưa lưu" khi Hủy.
  const openPopup = (card, base) => {
    const f = st(); if (!f.marketId || !POPUP_TITLE[card]) return;
    Object.assign(f, { popup: card, dtab: card, result: null, fieldErrors: {}, saveErrors: [], confirmDiscard: false, saving: false });
    f.base = base !== undefined ? base : snap(draftFor(f.marketId));
    A.render(); showPopup();
  };
  // Nút trên trang luôn mở với bản nháp mới (bản nháp của popup đã đóng không quay lại).
  A.ACT['fcm-edit'] = el => { const f = st(); if (!f.marketId) return; f.draft = null; openPopup(el.dataset.card); };
  // fcm-dtab giữ cho tương thích: chuyển phần cấu hình nhưng giữ bản nháp đang soạn.
  A.ACT['fcm-dtab'] = el => { const f = st(), id = el.dataset.id, base = f.popup ? f.base : undefined; openPopup(POPUP_TITLE[id] && id !== 'land-view' ? id : 'charges', base); };
  const closePopup = () => { Object.assign(st(), POPUP_RESET); A.closeModal(); A.render(); };
  // Hủy: không ghi gì. Có thay đổi chưa lưu → hỏi lại ngay trong footer (không dùng hộp thoại trình duyệt).
  A.ACT['fcm-popup-close'] = () => {
    const f = st();
    if (f.popup && canEdit(f.marketId) && dirty() && !f.confirmDiscard) { f.confirmDiscard = true; showPopup(); return; }
    closePopup();
  };
  A.ACT['fcm-popup-discard'] = () => closePopup();
  A.ACT['fcm-discard-cancel'] = () => { st().confirmDiscard = false; showPopup(); };
  A.ACT['fcm-reset'] = () => closePopup();
  // Áp dụng / Không áp dụng trên hàng khoản thu → mở popup "Khoản thu áp dụng" với lựa chọn này (lưu khi bấm Lưu).
  A.ACT['fcm-apply'] = el => {
    const f = st(); if (!canEdit(f.marketId)) return;
    const k = el.dataset.k; if (!CHARGES.some(c => c[0] === k)) return;
    f.draft = null; const d = draftFor(f.marketId), base = snap(d);
    d.charges[k] = el.dataset.v === '1';
    openPopup('charges', base);
  };
  // Ghi giá trị ô nhập vào bản nháp (không vẽ lại để giữ con trỏ; chỉ cập nhật các dòng phụ).
  A.IN['fcm-field'] = el => {
    const f = st(); if (!f.marketId || !canEdit(f.marketId)) return;
    const d = draftFor(f.marketId), path = String(el.dataset.path || ''), p = path.split('.');
    if (p[0] === 'land') d.land[p[1]] = el.value;
    else if (p[0] === 'electricity' || p[0] === 'water') d[p[0]][p[1]] = el.value;
    else if (p[0] === 'services') d.services[p[1]] = el.value;
    else if (p[0] === 'new') { const x = d.newServices.find(s => String(s.key) === p[1]); if (x) x[p[2]] = el.value; }
    else if (p[0] === 'effectiveFrom') d.effectiveFrom = el.value;
    else if (p[0] === 'landNote') d.landNote = el.value;
    if (f.popup) liveUpdate(path);
  };
  A.CH['fcm-file'] = el => {
    const f = st(), file = el.files && el.files[0];
    if (!file || !canEdit(f.marketId)) return;
    if (!fc.evidenceFileOk(file)) return U.toast('Chỉ nhận tệp PDF hoặc ảnh.');
    draftFor(f.marketId).file = fc.evidenceFromFile(file);
    if (f.fieldErrors) delete f.fieldErrors.file;
    refresh();
  };
  A.ACT['fcm-file-remove'] = () => { const f = st(); if (!canEdit(f.marketId)) return; draftFor(f.marketId).file = null; refresh(); };
  A.CH['fcm-new-calc'] = el => { const f = st(); if (!canEdit(f.marketId)) return; const x = draftFor(f.marketId).newServices.find(s => String(s.key) === el.dataset.key); if (x) x.calcMethod = el.value; };
  A.ACT['fcm-charge'] = el => {
    const f = st(); if (!canEdit(f.marketId)) return;
    const k = el.dataset.k; if (!CHARGES.some(c => c[0] === k)) return;
    draftFor(f.marketId).charges[k] = el.dataset.v === '1';
    refresh();
  };
  A.ACT['fcm-svc-add'] = () => { const f = st(); if (!canEdit(f.marketId)) return; const d = draftFor(f.marketId); d.newServices.push({ key: d.seq++, name: '', calcMethod: 'fixed', amount: '', note: '' }); refresh(); };
  A.ACT['fcm-svc-remove'] = el => { const f = st(); if (!canEdit(f.marketId)) return; const d = draftFor(f.marketId); d.newServices = d.newServices.filter(s => String(s.key) !== el.dataset.key); refresh(); };
  // Đổi mức thu một dịch vụ đang áp dụng: bật ô nhập (mặc định = mức hiện hành) / hủy đổi.
  A.ACT['fcm-svc-edit'] = el => {
    const f = st(); if (!canEdit(f.marketId)) return;
    const d = draftFor(f.marketId), r = current(f.marketId).services.find(x => x.id === el.dataset.id); if (!r) return;
    if (el.dataset.off) delete d.services[r.id]; else d.services[r.id] = String(r.amount);
    refresh();
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
    Object.assign(f, POPUP_RESET, { reset: null, result: { tone: 'ok', title: 'Đã đặt lại cấu hình mức thu. Chợ trở về "Chưa cấu hình".', items: ['Đã gỡ ' + out.plan.records.length + ' mức thu riêng chưa sử dụng' + (out.plan.charges ? ' và khai báo khoản thu áp dụng.' : '.'), 'Bản sao lưu: ' + out.entry.id + ' (lưu trong cấu hình mức thu).'] } });
    A.closeModal(); A.render(); U.toast('Đã đặt lại cấu hình mức thu.');
  };

  // ---- Service lưu cấu hình mức thu của 1 chợ — kiểm tra QUYỀN + PHẠM VI CHỢ ngay tại đây (không chỉ ẩn nút) ----
  // Quyền: action:cau-hinh-gia.them-phi (Tổ trưởng) + chợ thuộc marketScopes. Kiểm tra toàn bộ bản nháp trước khi ghi.
  // Căn cứ: mọi giá riêng mới hoặc thay đổi đều bắt buộc có tệp căn cứ của lần lưu. Khoản chuyển "Không áp dụng" → kết thúc hiệu lực mức giá riêng còn hiệu lực của
  // khoản đó từ ngày hiệu lực đã chọn (không xóa), ghi lịch sử "Khoản … ngừng áp dụng từ …".
  // opts.validateOnly: chỉ kiểm tra (không ghi) — popup dùng để hiển thị đúng yêu cầu tệp căn cứ theo CHÍNH quy tắc này.
  // fieldErrors: cùng nội dung lỗi, gắn với trường để hiển thị tại chỗ (không đổi quy tắc kiểm tra).
  fc.saveMarketFeeConfig = function (mid, d, user, opts) {
    if (!mid || !d || d.mid !== mid || !canEdit(mid)) return { ok: false, denied: true, errors: ['Bạn không có quyền cập nhật cấu hình mức thu của chợ này.'] };
    const cur = current(mid), eff = d.effectiveFrom || today(), errors = [], fieldErrors = {}, plan = [], stops = [];
    const err = (key, msg) => { errors.push(msg); if (key && !fieldErrors[key]) fieldErrors[key] = msg; };
    // Cùng quy tắc phiên bản với form cũ (feeConfig.priceVersionConflict).
    const versionable = (cat, same, label) => { if (fc.priceVersionConflict(cat, mid, same, eff)) { err('effectiveFrom', label + ': ngày hiệu lực của mức mới phải sau ngày hiệu lực của mức đang áp dụng.'); return false; } return true; };
    const legal = note => ({ note: note || 'Cấu hình mức thu riêng của chợ' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eff)) err('effectiveFrom', 'Vui lòng chọn ngày hiệu lực của thay đổi.');
    else if (!fc.firstOfMonth(eff)) err('effectiveFrom', 'Giá mới chỉ được có hiệu lực từ ngày 01 của tháng.');
    const decided = CHARGES.filter(c => d.charges[c[0]] !== null).length;
    if (decided && decided < CHARGES.length) err('charges', 'Vui lòng chọn Áp dụng / Không áp dụng cho đủ Điện, Nước, Dịch vụ.');
    // Mặt bằng
    AREA().forEach(k => {
      const v = num(d.land[k]), r = cur.land[k], label = 'Giá ' + U.areaTypeLabel(k);
      if (v === null) return;
      if (!(v > 0)) return err('land.' + k, label + ' phải là số lớn hơn 0.');
      if (r && Number(r.amount) === v) return;
      const same = x => x.areaTypeId === k;
      if (!versionable('stallPrices', same, label)) return;
      const rec = { marketId: mid, scope: 'MARKET', areaTypeId: k, stallType: '', name: 'Mặt bằng ' + U.areaTypeLabel(k), amount: v, unit: 'đ/m²/ngày', effectiveFrom: eff, effectiveTo: null, status: 'active',
        legalBasis: legal(String(d.landNote || '').trim()), attachments: [] };
      plan.push({ cat: 'stallPrices', same, rec, detail: label + ': ' + fmt(v) + ' đ/m²/ngày', refs: [], needsFile: true });
    });
    // Điện / nước
    ['electricity', 'water'].forEach(k => {
      const c = UTIL[k], v = num(d[k].price), r = cur[k];
      if (d.charges[k] === false || v === null) return;
      if (!(v > 0)) return err(k, 'Đơn giá ' + c.noun + ' phải là số lớn hơn 0.');
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
        if (!(v > 0)) return err('service.' + r.id, 'Mức thu "' + r.name + '" phải là số lớn hơn 0.');
        const same = x => isService(x) && String(x.name || '').trim().toLowerCase() === String(r.name || '').trim().toLowerCase();
        if (!versionable('extraServices', same, 'Dịch vụ "' + r.name + '"')) return;
        plan.push({ cat: 'extraServices', same, needsFile: true, refs: [], detail: 'Dịch vụ "' + r.name + '": ' + fmt(v),
          rec: { marketId: mid, name: r.name, category: r.category || 'GENERAL', calcMethod: r.calcMethod || 'fixed', amount: v, unit: r.unit, collectionCycle: r.collectionCycle || 'MONTH', effectiveFrom: eff, effectiveTo: null, status: 'active', legalBasis: Object.assign({}, r.legalBasis || {}), attachments: [] } });
      });
      d.newServices.forEach(x => {
        const name = String(x.name || '').trim(), v = num(x.amount), calc = SVC_CALC.find(c => c[0] === x.calcMethod) || SVC_CALC[0];
        if (!name && v === null) return;
        if (!name) return err('new.' + x.key + '.name', 'Vui lòng nhập tên dịch vụ.');
        if (!(v > 0)) return err('new.' + x.key + '.amount', 'Mức thu dịch vụ "' + name + '" phải là số lớn hơn 0.');
        if (cur.services.some(r => live(r) && String(r.name || '').trim().toLowerCase() === name.toLowerCase())) return err('new.' + x.key + '.name', 'Dịch vụ "' + name + '" đã có mức thu đang áp dụng; sửa mức ở dòng hiện có.');
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
    const needsFile = plan.some(x => x.needsFile);
    if (opts && opts.validateOnly) return { ok: !errors.length, validateOnly: true, errors, fieldErrors, needsFile, priceChanges: plan.length, chargesChanged: chChanged };
    if (needsFile && !d.file) err('file', 'Vui lòng chọn tệp căn cứ (PDF / ảnh quyết định, công văn) cho thay đổi giá.');
    if (errors.length) return { ok: false, errors, fieldErrors };
    if (!plan.length && !chChanged) return { ok: true, unchanged: true };
    const before = MC().get(mid).status, stopText = l => 'Khoản ' + l + ' ngừng áp dụng từ ' + U.dmy(eff);
    plan.forEach(x => {
      const file = x.needsFile ? d.file : null;
      fc.addPriceVersion(x.cat, x.rec, x.same, file, user, x.detail + (file ? ' · căn cứ: ' + file.name : ''));
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
  // Lưu: chống bấm 2 lần (cờ saving + chỉ lưu khi popup đang mở); lỗi → giữ nguyên dữ liệu đã nhập, hiện tại đúng trường.
  A.ACT['fcm-save'] = () => {
    const f = st(), mid = f.marketId;
    if (!mid || !f.popup || f.saving) return;
    f.saving = true;
    let out;
    try { out = fc.saveMarketFeeConfig(mid, draftFor(mid), actor()); } finally { f.saving = false; }
    if (out.denied) return U.toast(out.errors[0]);
    if (!out.ok) { Object.assign(f, { fieldErrors: out.fieldErrors || {}, saveErrors: out.errors, confirmDiscard: false, result: { tone: 'danger', title: 'Chưa lưu được cấu hình:', items: out.errors } }); refresh(); return; }
    if (out.unchanged) { f.fieldErrors = {}; f.saveErrors = []; U.toast('Không có thay đổi để lưu.'); return; }
    const lc = out.lifecycle, missing = lc.feeGap ? [lc.feeGap] : [];
    if (!lc.layoutReady) missing.unshift('Chợ chưa hoàn tất thiết lập sơ đồ mặt bằng.');
    const result = out.after === 'ACTIVE' && out.before !== 'ACTIVE' ? { tone: 'ok', title: 'Đã lưu cấu hình. Chợ đã đủ điều kiện và chuyển sang Đang hoạt động.' }
      : lc.stage === 'ACTIVE' ? { tone: 'ok', title: 'Đã lưu cấu hình mức thu.' }
        : lc.feeConfigWarning ? { tone: 'warn', title: 'Đã lưu cấu hình. Chợ đang hoạt động nhưng cần cập nhật mức thu.', items: missing }
          : { tone: 'warn', title: 'Đã lưu cấu hình. Chợ vẫn chưa đủ điều kiện hoạt động.', items: missing };
    // Lưu xong: đóng popup, bỏ bản nháp (bấm Lưu lần nữa không có popup / bản nháp nào để tạo trùng).
    Object.assign(f, POPUP_RESET, { result });
    A.closeModal(); A.render();
    U.toast(result.title);
  };
})(window.APP);
