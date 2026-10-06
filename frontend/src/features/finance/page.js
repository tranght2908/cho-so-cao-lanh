/* Màn hình tài chính: Chỉ số điện nước, Khoản phải thu, Thu tiền & biên lai, Đối soát thu tiền (Công nợ đã retire). */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const f = ui.f;

  // ---------- Kỳ tài chính (kỳ của chợ đang chọn) dùng chung cho các màn Tài chính ----------
  // ui.period là "kỳ nghiệp vụ" (billing period) chung, giữ nguyên khi chuyển giữa Chỉ số điện nước,
  // Khoản phải thu, Thu tiền, Đối soát. Ngày phát sinh giao dịch thực tế (ngày ghi chỉ số, ngày thu,
  // ngày giao dịch ngân hàng...) là filter RIÊNG của từng màn, không đồng nhất với kỳ này.
  // Kỳ của CHỢ đang chọn (không dùng kỳ legacy dùng chung). Mặc định: kỳ đang thu, sau đó kỳ chưa chốt gần nhất.
  function financePeriod() {
    const market = ui.market, svc = A.features.finance.marketPeriod;
    const list = A.periods.listForMarket(market).slice().sort((a, b) => String(a.period).localeCompare(String(b.period)));
    const picked = A.periods.resolve(market, ui.periodId || ui.period);
    const selected = (picked && picked.marketId === market ? picked : null)
      || list.slice().reverse().find(x => svc.canCollect(x)) || list.slice().reverse().find(x => !svc.isClosed(x)) || list[list.length - 1];
    if (selected) { ui.periodId = selected.id; ui.period = A.periods.periodKey(selected); }
    return selected;
  }
  A.CH['fp-select'] = el => { const p = A.periods && A.periods.getById(el.value); ui.periodId = el.value; ui.period = p ? A.periods.periodKey(p) : el.value; A.render(); };

  // ---------- Chỉ số điện, nước — MỘT implementation duy nhất (theo kỳ của chợ) ----------
  // Nguồn: A.db.readings (1 bản ghi / điểm / tháng) + mốc hoàn tất chỉ số trên kỳ của chợ (marketPeriod.meter).
  // Trạng thái điểm/kỳ và điều kiện ghi/hoàn tất lấy từ features/finance/market-period.js (không tự suy ở view).
  // BR-03: chỉ NV thu phí ghi chỉ số, kiểm tra chỉ số cần xác nhận và Hoàn tất ghi chỉ số; Tổ trưởng theo dõi.
  const MP = () => A.features.finance.marketPeriod;
  const nowStamp = () => U.dmy(U.today()) + ' ' + U.nowTime();
  const mrMe = () => A.currentAccount() || null;
  const mrRecorder = () => { const acc = mrMe(); return acc ? (acc.code || acc.id) : null; };
  const mrCanRecord = st => { const acc = mrMe(); return !!(st && acc && st.market === ui.market && A.allowedMarkets(acc).indexOf(st.market) !== -1 && A.canDo('dien-nuoc.ghi-chi-so', st.market)); };
  const mrNumber = v => v == null ? '—' : Number(v).toLocaleString('vi-VN');
  const mrUse = (r, kind) => { const cur = r && r[kind === 'elec' ? 'elecCur' : 'waterCur'], prev = r && r[kind === 'elec' ? 'elecPrev' : 'waterPrev']; return cur == null || prev == null ? null : cur - prev; };
  const mrUseText = (r, kind) => { const v = mrUse(r, kind); return v == null ? '—' : mrNumber(v) + ' ' + (kind === 'elec' ? 'kWh' : 'm³'); };
  const MR_TAG = { NOT_RECORDED: '<span class="tag">Chưa ghi</span>', RECORDED: '<span class="tag ok">Đã ghi</span>', NEEDS_REVIEW: '<span class="tag warn">Cần kiểm tra</span>' };
  const mrContract = (mp, st) => MP().contracts(mp).find(c => (c.businessPointId || c.stallId) === st.id) || null;
  const mrWarningText = r => r.reviewReason || [MP().isAbnormal(r, 'elec') && 'Điện tăng bất thường so với kỳ trước.', MP().isAbnormal(r, 'water') && 'Nước tăng bất thường so với kỳ trước.'].filter(Boolean).join(' ') || 'Chỉ số cần xác minh.';
  // Kỳ đang xem của màn chỉ số: tháng có kỳ của chợ; mặc định kỳ chưa chốt gần nhất.
  function mrPeriod() {
    const months = MP().months().filter(m => MP().get(ui.market, m));
    const month = months.includes(f.mrPeriod) ? f.mrPeriod : (months.find(m => !MP().isClosed(MP().get(ui.market, m))) || months[0]);
    return month ? MP().get(ui.market, month) : null;
  }
  // Tạo bản ghi chỉ số còn thiếu cho các điểm cần ghi (chỉ khi kỳ còn được ghi) — giữ chỉ số kỳ trước làm chỉ số cũ.
  function mrEnsureRows(mp) {
    if (!MP().canRecordMeter(mp)) return;
    let changed = false;
    MP().meterPoints(mp).forEach(st => {
      if (MP().readingOf(mp, st.id)) return;
      const prior = (A.db.readings || []).filter(r => r.stallId === st.id && r.period < mp.period && r.elecCur != null).sort((a, b) => b.period.localeCompare(a.period))[0];
      A.db.readings.push({ stallId: st.id, period: mp.period, billingPeriodId: mp.id, elecPrev: prior ? prior.elecCur : null, elecCur: null, elecAvg: prior ? prior.elecAvg : 0, waterPrev: prior ? prior.waterCur : null, waterCur: null, waterAvg: prior ? prior.waterAvg : 0, status: 'PENDING', recordedBy: null, recordedAt: null, elecPhoto: null, waterPhoto: null });
      changed = true;
    });
    if (changed) A.save();
  }
  const mrRows = mp => MP().meterPoints(mp).map(st => ({ st, r: MP().readingOf(mp, st.id) })).filter(x => x.r);
  // Kiểm tra lại toàn bộ trong mọi handler ghi: kỳ còn được ghi + quyền + điểm thuộc chợ đang chọn.
  function mrWriteContext(stallId, month) {
    const mp = MP().get(ui.market, month), st = A.idx.stall.get(stallId), r = mp && st ? MP().readingOf(mp, st.id) : null;
    if (!mp || !st || !r) return { err: 'Không tìm thấy chỉ số của điểm này trong kỳ.' };
    if (!MP().canRecordMeter(mp)) return { err: MP().isClosed(mp) ? 'Kỳ thu đã chốt — không chỉnh sửa chỉ số.' : 'Chỉ số của kỳ đã hoàn tất — không chỉnh sửa.' };
    if (!mrCanRecord(st)) return { err: 'Bạn không có quyền ghi chỉ số của điểm này.' };
    return { mp, st, r };
  }
  let mrDraft = null;
  function mrOpen(stallId, month) {
    const mp = MP().get(ui.market, month), st = A.idx.stall.get(stallId), r = mp && st ? MP().readingOf(mp, st.id) : null;
    if (!mp || !st || !r) return;
    const editable = !mrWriteContext(stallId, month).err, trader = st.traderId ? A.idx.trader.get(st.traderId) : null, contract = mrContract(mp, st);
    if (!mrDraft || mrDraft.stallId !== stallId || mrDraft.month !== month) mrDraft = { stallId, month, photos: { elec: r.elecPhoto || null, water: r.waterPhoto || null } };
    const meter = kind => { const prev = r[kind === 'elec' ? 'elecPrev' : 'waterPrev'], cur = r[kind === 'elec' ? 'elecCur' : 'waterCur'], unit = kind === 'elec' ? 'kWh' : 'm³', diff = cur == null || prev == null ? null : cur - prev, photo = mrDraft.photos[kind];
      return `<section class="meter-section"><h4>${kind === 'elec' ? 'ĐIỆN' : 'NƯỚC'}</h4><dl class="kv"><dt>Chỉ số kỳ trước</dt><dd><b>${mrNumber(prev)} ${unit}</b></dd></dl><div class="field"><label>Chỉ số kỳ này (${unit})</label><input class="input" id="mr-${kind}" data-in="mr-value" data-kind="${kind}" data-prev="${prev == null ? '' : prev}" type="number" min="0" value="${cur == null ? '' : cur}" ${editable ? '' : 'disabled'}></div><div id="mr-${kind}-result" class="meter-consumption ${diff != null && diff < 0 ? 'danger' : ''}">${diff == null ? 'Nhập chỉ số để tính sản lượng.' : `${mrNumber(cur)} − ${mrNumber(prev)} = <b>${mrNumber(diff)} ${unit}</b>`}</div><div class="row" style="margin-top:8px;gap:8px">${photo ? `<span class="tag ok">Có ảnh: ${U.esc(photo.name)}</span>` : '<span class="small muted">Chưa có ảnh đồng hồ</span>'}${editable ? `<button class="btn sm" data-act="mr-photo" data-kind="${kind}">Chọn ảnh</button>` : ''}</div></section>`; };
    A.modal(A.mHead(editable ? 'Ghi chỉ số điện, nước' : 'Chỉ số điện, nước') + `<div class="modal-b meter-modal"><div class="small muted">Điểm KD: <b>${U.esc(st.code)}</b> · Tiểu thương: ${trader ? U.esc(trader.name) : '—'} · Hợp đồng: ${contract ? U.esc(contract.id) : '—'} · Kỳ thu: ${U.esc(mp.label)}</div>${meter('elec')}${meter('water')}${r.reviewHistory && r.reviewHistory[0] ? `<div class="note info">Đã kiểm tra: ${U.esc(r.reviewHistory[0].reviewedBy || '')} · ${U.esc(r.reviewHistory[0].reviewedAt || '')}${r.reviewHistory[0].reviewNote ? ' · ' + U.esc(r.reviewHistory[0].reviewNote) : ''}</div>` : ''}<section class="meter-section"><h4>GHI CHÚ</h4><textarea id="mr-note" class="input" rows="2" ${editable ? '' : 'disabled'}>${U.esc(r.note || '')}</textarea></section></div><div class="modal-f"><button class="btn" data-act="close">${editable ? 'Hủy' : 'Đóng'}</button>${editable ? `<button class="btn primary" data-act="mr-save" data-id="${st.id}" data-period="${mp.period}">Lưu chỉ số</button>` : ''}</div>`, true);
  }
  function mrReviewOpen(stallId, month) {
    const c = mrWriteContext(stallId, month);
    if (c.err) return U.toast(c.err);
    const { mp, st, r } = c, trader = st.traderId ? A.idx.trader.get(st.traderId) : null, contract = mrContract(mp, st);
    const meter = (kind, label, unit, prev, cur) => `<section class="meter-section"><h4>${label}</h4><dl class="kv"><dt>Chỉ số kỳ trước</dt><dd>${mrNumber(prev)} ${unit}</dd></dl><div class="field"><label>Chỉ số kỳ này</label><input class="input" id="mr-review-${kind}" data-in="mr-value" data-kind="${kind}" data-prev="${prev == null ? '' : prev}" data-out="mr-review-${kind}-result" type="number" min="0" value="${cur == null ? '' : cur}"></div><div id="mr-review-${kind}-result" class="small muted">${cur == null ? 'Nhập chỉ số để tính sản lượng.' : `${mrNumber(cur)} − ${mrNumber(prev)} = ${mrNumber(cur - prev)} ${unit}`}</div></section>`;
    A.modal(A.mHead('Kiểm tra chỉ số điện, nước') + `<div class="modal-b meter-modal"><div class="small muted"><b>Điểm KD:</b> ${U.esc(st.code)} · <b>Tiểu thương:</b> ${trader ? U.esc(trader.name) : '—'} · <b>Hợp đồng:</b> ${contract ? U.esc(contract.id) : '—'} · <b>Kỳ thu:</b> ${U.esc(mp.label)}</div><div class="note warn" style="margin-top:12px"><b>Cần kiểm tra</b><br>⚠ ${U.esc(mrWarningText(r))}</div>${meter('elec', 'ĐIỆN', 'kWh', r.elecPrev, r.elecCur)}${meter('water', 'NƯỚC', 'm³', r.waterPrev, r.waterCur)}<section class="meter-section"><h4>KẾT QUẢ KIỂM TRA</h4><label class="row" style="gap:8px"><input type="radio" name="mr-review-result" value="ADJUSTED"> Đã điều chỉnh chỉ số</label><label class="row" style="gap:8px;margin-top:8px"><input type="radio" name="mr-review-result" value="CONFIRMED"> Chỉ số hiện tại chính xác</label><div class="field" style="margin-top:10px"><label>Ghi chú kiểm tra</label><textarea id="mr-review-note" class="input" rows="3" placeholder="Đã kiểm tra ảnh đồng hồ, số liệu chính xác."></textarea></div></section></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="mr-review-confirm" data-id="${st.id}" data-period="${mp.period}">Xác nhận kiểm tra</button></div>`, true);
  }
  // Khóa chỉ số + tự tính nháp (quyết định 2): sau Hoàn tất, hệ thống chạy calculatePeriod ngay.
  const MR_STATE_TAG = { COMPLETED: '<span class="tag ok">🔒 Đã hoàn tất</span>', NOT_REQUIRED: '<span class="tag">Không cần ghi chỉ số</span>', RECORDING: '<span class="tag info">Đang ghi</span>', WAITING: '<span class="tag warn">Chờ ghi chỉ số</span>' };
  function mrHelper(status, s) {
    if (status === 'NOT_REQUIRED') return 'Chợ không có điểm cần ghi chỉ số trong kỳ (không có công tơ hoặc điện, nước thu như dịch vụ) — chuyển thẳng sang tính khoản phải thu.';
    if (status === 'COMPLETED') return s.recorded + '/' + s.required + ' điểm đã hợp lệ. Chỉ số đã được khóa và dùng để tính khoản phải thu.';
    if (s.unrecorded && s.review) return 'Còn ' + s.unrecorded + ' điểm chưa ghi và ' + s.review + ' điểm cần kiểm tra.';
    if (s.unrecorded) return 'Còn ' + s.unrecorded + ' điểm chưa ghi chỉ số.';
    if (s.review) return 'Còn ' + s.review + ' điểm cần kiểm tra trước khi có thể hoàn tất ghi chỉ số.';
    return 'Tất cả chỉ số hợp lệ, sẵn sàng hoàn tất.';
  }
  A.VIEWS['dien-nuoc'] = function () {
    const mp = mrPeriod(), market = U.market(ui.market) || {};
    if (!mp) return '<div class="card"><div class="empty">Chưa có kỳ thu của chợ này.</div></div>';
    mrEnsureRows(mp);
    const svc = MP(), stats = svc.meterStats(mp), status = svc.meterStatus(mp), applicable = svc.isApplicable(mp), editable = svc.canRecordMeter(mp);
    const canComplete = A.canDo('dien-nuoc.chot-ky', ui.market), state = f.mrStatus || 'all', q = (f.mrSearch || '').toLowerCase();
    const all = mrRows(mp), rows = all.filter(x => { const c = mrContract(mp, x.st); return (state === 'all' || svc.readingState(x.r) === state) && (!q || [x.st.code, (A.idx.trader.get(x.st.traderId) || {}).name, c && c.id].join(' ').toLowerCase().includes(q)); });
    const months = svc.months().filter(m => svc.get(ui.market, m)).map(m => `<option value="${m}" ${m === mp.period ? 'selected' : ''}>${U.per(m)}</option>`).join('');
    const kpi = (label, value, filter) => `<button class="card kpi" data-act="mr-status" data-id="${filter}" style="text-align:left"><div class="k-label">${label}</div><div class="k-value">${value}</div></button>`;
    const collector = A.ACCOUNTS.getMarketCollector ? A.ACCOUNTS.getMarketCollector(ui.market) : null, done = mp.meter && mp.meter.status === 'COMPLETED' ? mp.meter : null;
    const blocked = stats.unrecorded || stats.review, statusTag = !applicable ? '<span class="tag">Không áp dụng</span>' : MR_STATE_TAG[status];
    const head = `<div class="card meter-title"><div class="card-b"><h2>Chỉ số điện, nước</h2><p>Ghi nhận chỉ số điện, nước theo từng điểm kinh doanh trong kỳ thu.</p><div class="row" style="margin-top:12px"><label class="small">Kỳ thu</label><select class="input" style="min-width:130px" data-ch="mp-select">${months}</select></div><dl class="kv" style="margin-top:12px"><dt>Kỳ thu</dt><dd><b>${U.esc(mp.label)}</b></dd><dt>Chợ</dt><dd>${U.esc(market.name || ui.market)}</dd><dt>Ngày ghi chỉ số</dt><dd>${U.dmy(svc.dateOf(mp, 'meterReadDate'))}</dd><dt>NV thu phí phụ trách</dt><dd>${U.esc(collector ? (collector.fullName || collector.code) : 'Chưa phân công')}</dd><dt>Trạng thái</dt><dd>${statusTag}</dd>${done ? `<dt>Hoàn tất bởi</dt><dd>${U.esc(done.completedBy || '—')} · ${U.esc(done.completedAt || '—')}</dd>` : ''}</dl><div class="small muted" style="margin-top:8px">${applicable ? mrHelper(status, stats) : 'Chợ không có đối tượng phát sinh khoản thu trong kỳ — không cần ghi chỉ số.'}</div></div></div>`;
    if (!applicable || status === 'NOT_REQUIRED') return head;
    const action = x => { const s = svc.readingState(x.r);
      if (!editable || !mrCanRecord(x.st)) return `<button class="btn sm" data-act="mr-open" data-id="${x.st.id}" data-period="${mp.period}">Xem</button>`;
      if (s === 'NOT_RECORDED') return `<button class="btn sm primary" data-act="mr-open" data-id="${x.st.id}" data-period="${mp.period}">Ghi chỉ số</button>`;
      if (s === 'NEEDS_REVIEW') return `<button class="btn sm primary" data-act="mr-review-open" data-id="${x.st.id}" data-period="${mp.period}">Kiểm tra</button>`;
      return `<button class="btn sm" data-act="mr-open" data-id="${x.st.id}" data-period="${mp.period}">Cập nhật</button>`; };
    return head + `<div class="kpis">${kpi('Điểm cần ghi', stats.required, 'all')}${kpi('Đã ghi', stats.recorded, 'RECORDED')}${kpi('Chưa ghi', stats.unrecorded, 'NOT_RECORDED')}${kpi('Cần kiểm tra', stats.review, 'NEEDS_REVIEW')}</div><div class="card"><div class="card-h"><div class="seg">${[['all', 'Tất cả'], ['NOT_RECORDED', 'Chưa ghi'], ['RECORDED', 'Đã ghi'], ['NEEDS_REVIEW', 'Cần kiểm tra']].map(x => `<button class="${state === x[0] ? 'on' : ''}" data-act="mr-status" data-id="${x[0]}">${x[1]}</button>`).join('')}</div><span class="spacer"></span><input class="input meter-search" data-in="mr-search" placeholder="Tìm mã điểm, tiểu thương, mã hợp đồng..." value="${U.esc(f.mrSearch || '')}">${editable && canComplete ? `<button class="btn primary" data-act="mr-complete-open" ${svc.canCompleteMeter(mp) ? '' : 'disabled'}>Hoàn tất ghi chỉ số</button>` : ''}</div><div class="card-b">${blocked && editable ? `<div class="small muted" style="margin-bottom:10px">${mrHelper(status, stats)}</div>` : ''}${U.table([{ t: 'Điểm KD' }, { t: 'Tiểu thương' }, { t: 'Điện kỳ trước', num: true }, { t: 'Điện kỳ này', num: true }, { t: 'Tiêu thụ điện', num: true }, { t: 'Nước kỳ trước', num: true }, { t: 'Nước kỳ này', num: true }, { t: 'Tiêu thụ nước', num: true }, { t: 'Cảnh báo' }, { t: 'Trạng thái' }, { t: 'Thao tác' }], rows.map(x => { const s = svc.readingState(x.r), tr = A.idx.trader.get(x.st.traderId); return `<tr><td><b>${U.esc(x.st.code)}</b></td><td>${tr ? U.esc(tr.name) : '—'}</td><td class="num">${mrNumber(x.r.elecPrev)}</td><td class="num">${mrNumber(x.r.elecCur)}</td><td class="num">${mrUseText(x.r, 'elec')}</td><td class="num">${mrNumber(x.r.waterPrev)}</td><td class="num">${mrNumber(x.r.waterCur)}</td><td class="num">${mrUseText(x.r, 'water')}</td><td>${s === 'NEEDS_REVIEW' ? `<span class="tag warn">${U.esc(mrWarningText(x.r))}</span>` : '<span class="muted">—</span>'}</td><td>${MR_TAG[s]}</td><td>${action(x)}</td></tr>`; }), { empty: 'Không có điểm kinh doanh cần ghi chỉ số trong phạm vi này.' })}</div></div>`;
  };
  A.ACT['mr-status'] = el => { f.mrStatus = el.dataset.id; A.render(); };
  A.IN['mr-search'] = el => { f.mrSearch = el.value; A.render(); };
  A.CH['mp-select'] = el => { f.mrPeriod = el.value; f.mrStatus = 'all'; A.render(); };
  A.ACT['mr-open'] = el => { mrDraft = null; mrOpen(el.dataset.id, el.dataset.period); };
  A.ACT['mr-review-open'] = el => mrReviewOpen(el.dataset.id, el.dataset.period);
  // Tính sản lượng ngay khi nhập — cập nhật DOM tại chỗ, không render lại modal để giữ con trỏ.
  A.IN['mr-value'] = el => {
    const out = A.$('#' + (el.dataset.out || 'mr-' + el.dataset.kind + '-result')), unit = el.dataset.kind === 'elec' ? 'kWh' : 'm³';
    if (!out) return;
    const prev = el.dataset.prev === '' ? null : Number(el.dataset.prev), cur = el.value === '' ? null : Number(el.value);
    out.innerHTML = cur == null || prev == null ? 'Nhập chỉ số để tính sản lượng.' : !Number.isFinite(cur) || cur < prev ? 'Chỉ số kỳ này không được nhỏ hơn chỉ số kỳ trước.' : `${mrNumber(cur)} − ${mrNumber(prev)} = <b>${mrNumber(cur - prev)} ${unit}</b>`;
  };
  A.ACT['mr-photo'] = el => {
    if (!mrDraft || mrWriteContext(mrDraft.stallId, mrDraft.month).err) return;
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none'; document.body.appendChild(input);
    input.onchange = () => { const file = input.files && input.files[0]; if (file) mrDraft.photos[el.dataset.kind] = { name: file.name, type: file.type, size: file.size, addedAt: nowStamp(), mock: true }; input.remove(); mrOpen(mrDraft.stallId, mrDraft.month); };
    input.click();
  };
  const mrInput = id => { const el = A.$(id); return !el || el.value === '' ? null : Number(el.value); };
  A.ACT['mr-save'] = el => {
    const c = mrWriteContext(el.dataset.id, el.dataset.period);
    if (c.err) return U.toast(c.err);
    const r = c.r, e = mrInput('#mr-elec'), w = mrInput('#mr-water');
    if ((e !== null && !Number.isFinite(e)) || (w !== null && !Number.isFinite(w))) return U.toast('Vui lòng nhập chỉ số hợp lệ.');
    if ((e != null && r.elecPrev != null && e < r.elecPrev) || (w != null && r.waterPrev != null && w < r.waterPrev)) return U.toast('Chỉ số kỳ này không được nhỏ hơn chỉ số kỳ trước.');
    const changed = e !== r.elecCur || w !== r.waterCur;
    Object.assign(r, { elecCur: e, waterCur: w, note: String((A.$('#mr-note') || {}).value || '').trim(), recordedBy: mrRecorder(), recordedAt: nowStamp(), status: e != null && w != null ? 'RECORDED' : 'PENDING', billingPeriodId: c.mp.id });
    if (mrDraft && mrDraft.stallId === c.st.id) { r.elecPhoto = mrDraft.photos.elec; r.waterPhoto = mrDraft.photos.water; }
    // Sửa số sau khi đã kiểm tra → phải kiểm tra lại nếu vẫn bất thường.
    if (changed) { r.reviewedAt = null; r.reviewedBy = null; }
    mrDraft = null; A.save(); A.closeModal(); A.render(); U.toast('Đã lưu chỉ số cho điểm ' + c.st.code);
  };
  A.ACT['mr-review-confirm'] = el => {
    const c = mrWriteContext(el.dataset.id, el.dataset.period);
    if (c.err) return U.toast(c.err);
    const r = c.r, result = (A.$('input[name="mr-review-result"]:checked') || {}).value, note = String((A.$('#mr-review-note') || {}).value || '').trim();
    const elec = mrInput('#mr-review-elec'), water = mrInput('#mr-review-water');
    if (!result) return U.toast('Vui lòng chọn kết quả kiểm tra.');
    if (!Number.isFinite(elec) || !Number.isFinite(water) || (r.elecPrev != null && elec < r.elecPrev) || (r.waterPrev != null && water < r.waterPrev)) return U.toast('Chỉ số kỳ này không được nhỏ hơn chỉ số kỳ trước.');
    const oldReading = { elec: r.elecCur, water: r.waterCur };
    if (result === 'CONFIRMED' && (elec !== oldReading.elec || water !== oldReading.water)) return U.toast('Nếu đã sửa chỉ số, vui lòng chọn “Đã điều chỉnh chỉ số”.');
    if (result === 'ADJUSTED' && elec === oldReading.elec && water === oldReading.water) return U.toast('Vui lòng điều chỉnh ít nhất một chỉ số hoặc chọn “Chỉ số hiện tại chính xác”.');
    const acc = mrMe() || {}, audit = { reviewedBy: acc.fullName || acc.code || acc.id || '', reviewedAt: nowStamp(), reviewResult: result, reviewNote: note, oldReading, newReading: { elec, water } };
    Object.assign(r, { elecCur: elec, waterCur: water, reviewRequired: false, reviewReason: null, reviewedBy: audit.reviewedBy, reviewedAt: audit.reviewedAt, reviewResult: result, reviewNote: note, status: 'RECORDED' });
    r.reviewHistory = [audit].concat(r.reviewHistory || []);
    A.save(); A.closeModal(); A.render(); U.toast('Đã xác nhận kiểm tra chỉ số điểm ' + c.st.code + '.');
  };
  A.ACT['mr-complete-open'] = () => {
    const mp = mrPeriod(), svc = MP();
    if (!mp || !A.canDo('dien-nuoc.chot-ky', ui.market) || !svc.canCompleteMeter(mp)) return U.toast('Kỳ chưa đủ điều kiện hoàn tất ghi chỉ số.');
    const s = svc.meterStats(mp), market = U.market(ui.market) || {};
    A.modal(A.mHead('Hoàn tất ghi chỉ số kỳ ' + U.esc(mp.label) + '?') + `<div class="modal-b"><dl class="kv"><dt>Chợ</dt><dd>${U.esc(market.name || ui.market)}</dd><dt>Điểm cần ghi</dt><dd>${s.required}</dd><dt>Đã ghi hợp lệ</dt><dd>${s.recorded}</dd></dl><div class="note info">Sau khi hoàn tất, chỉ số của kỳ được khóa và hệ thống tự tính nháp khoản phải thu. Thao tác này không phát hành khoản phải thu.</div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="mr-complete-confirm" data-period="${mp.period}">Xác nhận hoàn tất</button></div>`);
  };
  A.ACT['mr-complete-confirm'] = el => {
    const svc = MP(), mp = svc.get(ui.market, el.dataset.period);
    if (!mp || !A.canDo('dien-nuoc.chot-ky', ui.market) || !A.allowedMarkets(mrMe()).includes(ui.market) || !svc.canCompleteMeter(mp)) { A.closeModal(); return U.toast('Kỳ chưa đủ điều kiện hoàn tất ghi chỉ số.'); }
    const out = svc.completeMeter(ui.market, mp.period, mrMe());
    A.closeModal(); A.render();
    const calc = out.calc, blocking = calc && calc.warnings.some(w => String(w.severity || 'BLOCKING').toUpperCase() === 'BLOCKING');
    U.toast('Đã hoàn tất ghi chỉ số kỳ ' + mp.label + (calc ? (blocking ? ' · Hệ thống đã tính nháp: còn dữ liệu cần xử lý.' : ' · Hệ thống đã tính nháp ' + calc.drafts.length + ' thành phần phí.') : '.'));
  };
  // Tương thích ngược cho module khác: chỉ số của chợ trong tháng đã hoàn tất (hoặc không cần ghi) theo kỳ của chợ.
  A.meterPeriodIsClosed = (meterPeriod, market) => { const mp = MP().get(market, A.periods.periodKey(meterPeriod)); return !!mp && MP().meterDone(mp); };

  // ---------- Khoản phải thu (theo kỳ của chợ) — màn KIỂM TRA, không phát hành ----------
  // Tổ trưởng xem/kiểm tra khoản phải thu của 1 chợ, xem lỗi, sửa dữ liệu nguồn rồi Tính lại. Phát hành chỉ ở cấp KỲ THU
  // (đồng loạt) tại Theo dõi kỳ thu. Tính nháp qua finance/billing.js; trạng thái/điều kiện qua finance/market-period.js.
  // Luồng điều chỉnh/miễn giảm sau phát hành, duyệt nháp và Bản đồ thu cũ đã retire (không còn UC hợp lệ gọi tới).
  // Phạm vi xem: luôn trong ui.market (⊂ marketScopes).
  const ptScopeAll = () => A.canDo('phai-thu.xem-toan-cho', ui.market);
  function ptRowPlace(r) {
    const fl = r.floorId && A.idx.floor ? A.idx.floor.get(r.floorId) : null, b = A.idx.building ? A.idx.building.get(r.buildingId) : null;
    return fl ? fl.name : b ? b.name : '';
  }
  function ptNewStatus(status) {
    const m = { VALID: ['✓ Hợp lệ', 'ok'], INVALID: ['⚠ Cần xử lý', 'danger'] };
    const x = m[status] || m.INVALID; return `<span class="tag ${x[1]}">${x[0]}</span>`;
  }
  // Kỳ đang xem của màn Khoản phải thu: kỳ của chợ đang chọn (không dùng kỳ legacy dùng chung).
  function ptNewPeriod() {
    const svc = MP(), months = svc.months().filter(m => svc.get(ui.market, m));
    const fromPeriod = id => { const p = id && A.periods.getById(id); return p && p.marketId === ui.market ? p : null; };
    return fromPeriod(f.ptPeriod) || fromPeriod(ui.periodId) || svc.get(ui.market, f.ptPeriod) || svc.get(ui.market, months.find(m => !svc.isIssued(svc.get(ui.market, m)) && !svc.isClosed(svc.get(ui.market, m))) || months[0]);
  }
  function ptNewGroups(market, period) { const b = A.features.finance.billing; return b ? b.traderGroups(market, period) : []; }
  function ptNewAmount(rows, type) { return U.sum(rows.filter(r => r.items[0] && r.items[0].chargeType === type), r => r.amount); }
  function ptReceivableCode(market, period, traderId, ordinal) {
    const marketCode = String(market || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const periodCode = String(period || '').replace(/[^0-9]/g, '').slice(0, 6);
    const traderCode = String(traderId || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return 'KPT-' + marketCode + '-' + periodCode + '-' + traderCode + (ordinal > 1 ? '-' + String(ordinal).padStart(2, '0') : '');
  }
  // BR-05: mặt bằng thu cho THÁNG KẾ TIẾP, điện/nước/dịch vụ cho THÁNG CỦA KỲ — hiển thị thống nhất với calculatePeriod.
  function ptFeeMonthsNote(p) {
    const b = A.features.finance.billing, land = b ? b.nextMonth(p.period) : '';
    return `<div class="small muted" style="margin-top:6px">Mặt bằng tính cho tháng <b>${U.per(land)}</b> · Điện, nước, dịch vụ tính cho tháng <b>${U.per(p.period)}</b>.</div>`;
  }
  function ptNewView() {
    const billing = A.features.finance.billing, svc = MP(), p = ptNewPeriod();
    if (!p || !billing) return '<div class="card"><div class="empty">Chưa có kỳ thu của chợ này.</div></div>';
    const market = ui.market, st = svc.stateOf(market, p.period), contracts = svc.contracts(p), meterDone = svc.meterDone(p), meterStatus = svc.meterStatus(p), stats = svc.meterStats(p);
    const groups = ptNewGroups(market, p.id), warns = billing.warnings(market, p.id), published = svc.invoices(p), isPublished = svc.isIssued(p), q = (f.ptSearch || '').toLowerCase();
    const rowFilter = f.ptValidation || 'all';
    const sourceRows = isPublished ? published.map(i => ({ traderId: i.traderId, rows: (i.items || []).map(item => ({ amount: item.amount, items: [item], contractId: item.contractId, stallId: item.stallId })), contractIds: i.contractIds || [], amount: i.amount, validationStatus: 'VALID', invoice: i, errors: [] })) : groups;
    const codeCounts = {};
    const withCodes = sourceRows.map(g => { const base = ptReceivableCode(market, p.period, g.traderId, 1), ordinal = (codeCounts[base] || 0) + 1; codeCounts[base] = ordinal; return Object.assign({}, g, { receivableCode: ptReceivableCode(market, p.period, g.traderId, ordinal) }); });
    const shown = withCodes.filter(g => { const t = A.idx.trader.get(g.traderId) || {}; return (rowFilter === 'all' || (rowFilter === 'valid' ? g.validationStatus === 'VALID' : g.validationStatus === 'HAS_ERRORS')) && (!q || [t.name, t.id, g.receivableCode, ...(g.contractIds || [])].join(' ').toLowerCase().includes(q)); });
    const total = U.sum(shown, g => g.amount), issueCount = groups.filter(g => g.validationStatus === 'HAS_ERRORS').length, calculated = !!p.calculatedAt || groups.length > 0 || warns.length > 0;
    const ready = svc.canIssue(p), canCalc = A.canDo('phai-thu.tinh-lai', market) && svc.canCalculate(p), validOk = calculated && groups.length > 0 && !issueCount && !warns.some(w => String(w.severity || 'BLOCKING').toUpperCase() === 'BLOCKING');
    const periods = svc.months().filter(m => svc.get(market, m)).map(m => { const x = svc.get(market, m); return `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${U.esc(x.label || U.per(m))}</option>`; }).join('');
    const meterText = meterStatus === 'NOT_REQUIRED' ? 'Không cần ghi chỉ số' : meterDone ? 'Đã hoàn tất ' + stats.required + ' điểm' : 'Chưa hoàn tất';
    const readiness = `<div class="row small" style="gap:12px;flex-wrap:wrap;margin-top:10px"><span>${meterDone ? '✓' : '○'} Chỉ số điện, nước: <b>${meterText}</b></span><span>${warns.some(w => w.code && w.code.indexOf('POLICY') >= 0) ? '○' : '✓'} Biểu phí: <b>${warns.some(w => w.code && w.code.indexOf('POLICY') >= 0) ? 'Cần kiểm tra' : 'Đã cấu hình'}</b></span><span>${contracts.length ? '✓' : '○'} Hợp đồng hiệu lực: <b>${contracts.length} hợp đồng</b></span><span>${isPublished || validOk ? '✓' : '○'} Khoản phải thu hợp lệ: <b>${isPublished ? 'Đã phát hành ' + published.length + ' khoản' : !calculated ? 'Chưa tính' : validOk ? groups.length + '/' + groups.length + ' hợp lệ' : issueCount + ' tiểu thương cần xử lý'}</b></span></div>`;
    const hint = isPublished ? '' : st.id === 'NOT_APPLICABLE' ? 'Chợ không có đối tượng phát sinh khoản thu trong kỳ — không áp dụng.' : svc.isClosed(p) ? 'Kỳ thu đã chốt.' : !meterDone ? 'Cần NV thu phí hoàn tất ghi chỉ số điện, nước — hệ thống sẽ tự tính nháp ngay sau đó.' : warns.length ? 'Có ' + warns.length + ' dữ liệu cần xử lý trước khi phát hành. Sau khi sửa dữ liệu nguồn, bấm Tính lại.' : !calculated ? 'Hệ thống chưa tính nháp kỳ này.' : ready ? 'Sẵn sàng phát hành. Kỳ thu được phát hành đồng loạt tại Theo dõi kỳ thu khi mọi chợ đều đủ điều kiện.' : '';
    const issued = p.issuance || {};
    return `<div class="card"><div class="card-b"><h2 style="margin:0">Khoản phải thu</h2><div class="small muted" style="margin-top:4px">Kỳ ${U.esc(p.label || U.per(p.period))} · ${U.esc((U.market(market) || {}).name || market)}</div><div class="row" style="gap:10px;flex-wrap:wrap;margin-top:12px"><label class="small">Kỳ thu</label><select class="input" data-ch="pt-period">${periods}</select><span>${svc.stateTag(st)}</span>${isPublished ? '<span class="tag ok">Đã phát hành</span>' : ''}<span class="spacer"></span>${canCalc ? `<button class="btn" data-act="pt-calc">${calculated ? 'Tính lại khoản phải thu' : 'Tính nháp khoản phải thu'}</button>` : ''}${U.can('theo-doi-ky-thu') ? '<button class="btn" data-act="pt-back-monitor">← Quay lại Theo dõi kỳ thu</button>' : ''}</div>${readiness}${ptFeeMonthsNote(p)}${hint ? `<div class="small muted" style="margin-top:8px">${hint}</div>` : ''}${isPublished ? `<div class="note info" style="margin-top:10px">Đã phát hành ${U.esc(issued.issuedAt || '')} · ${U.esc(issued.issuedBy || '—')}. Snapshot số tiền đã được khóa; theo dõi thanh toán ở màn Thu tiền & biên lai.</div>` : ''}</div></div>
      <div class="kpis"><div class="card kpi"><div class="k-label">Tiểu thương</div><div class="k-value">${shown.length}</div></div><div class="card kpi"><div class="k-label">Hợp đồng / Điểm KD</div><div class="k-value">${isPublished ? U.sum(shown, g => (g.contractIds || []).length) : new Set(groups.flatMap(g => g.contractIds)).size}</div></div><div class="card kpi"><div class="k-label">Tổng dự kiến thu</div><div class="k-value">${U.moneyShort(total)}</div><div class="k-sub">${U.money(total)}</div></div><div class="card kpi"><div class="k-label">Cần xử lý</div><div class="k-value">${issueCount}</div><div class="k-sub">${issueCount ? '' : ready ? '✓ Sẵn sàng phát hành' : ''}</div></div></div>
      ${warns.length && !isPublished ? `<div class="note warn"><b>Dữ liệu cần xử lý</b>${warns.map(w => `<div>${U.esc(w.message)}</div>`).join('')}</div>` : ''}
      <div class="card"><div class="card-h"><h3>Danh sách khoản phải thu</h3><div class="seg">${[['all', 'Tất cả'], ['valid', 'Hợp lệ'], ['errors', 'Cần xử lý']].map(x => `<button class="${rowFilter === x[0] ? 'on' : ''}" data-act="pt-validation" data-id="${x[0]}">${x[1]}</button>`).join('')}</div><input class="input" data-in="pt-search" placeholder="Tìm tiểu thương, mã khoản thu, mã HĐ, mã điểm..." value="${U.esc(f.ptSearch || '')}"></div><div class="card-b">${U.table([{ t: 'Tiểu thương' }, { t: 'Mã khoản thu' }, { t: 'HĐ / Điểm KD', num: true }, { t: 'Mặt bằng', num: true }, { t: 'Điện', num: true }, { t: 'Nước', num: true }, { t: 'Dịch vụ', num: true }, { t: 'Tổng phải thu', num: true }, { t: 'Trạng thái' }, { t: 'Thao tác' }], shown.map(g => { const t = A.idx.trader.get(g.traderId) || {}, bad = g.validationStatus === 'HAS_ERRORS'; return `<tr><td><b>${U.esc(t.name || g.traderId)}</b><div class="small muted">${U.esc(t.id || g.traderId)}</div></td><td class="small"><b>${U.esc(g.receivableCode)}</b></td><td class="num">${(g.contractIds || []).length}</td><td class="num">${bad && !ptNewAmount(g.rows, 'LAND') ? '—' : U.money(ptNewAmount(g.rows, 'LAND'))}</td><td class="num">${U.money(ptNewAmount(g.rows, 'ELECTRICITY'))}</td><td class="num">${U.money(ptNewAmount(g.rows, 'WATER'))}</td><td class="num">${U.money(ptNewAmount(g.rows, 'MARKET_SERVICE'))}</td><td class="num"><b>${U.money(g.amount)}</b></td><td>${ptNewStatus(bad ? 'INVALID' : 'VALID')}</td><td><button class="btn sm" data-act="pt-new-detail" data-trader="${U.esc(g.traderId)}" data-period="${p.id}">${bad ? 'Xem lỗi' : 'Xem chi tiết'}</button></td></tr>`; }), { empty: 'Chưa có khoản phải thu nháp trong kỳ này.' })}</div></div>`;
  }
  A.VIEWS['phai-thu'] = () => ptNewView();
  A.CH['pt-period'] = el => { f.ptPeriod = el.value; A.render(); };
  A.ACT['pt-back-monitor'] = () => { ui.periodTrackerBack = false; A.go('theo-doi-ky-thu'); };
  A.ACT['pt-validation'] = el => { f.ptValidation = el.dataset.id || 'all'; A.render(); };
  A.IN['pt-search'] = el => { f.ptSearch = el.value; A.render(); };
  // Tính lại thủ công (Tổ trưởng) — chỉ trước khi phát hành, sau khi chỉ số đã hoàn tất/không cần ghi.
  A.ACT['pt-calc'] = () => {
    const billing = A.features.finance.billing, p = ptNewPeriod();
    if (!billing || !p || !A.canDo('phai-thu.tinh-lai', ui.market) || !MP().canCalculate(p)) return U.toast('Kỳ chưa đủ điều kiện tính khoản phải thu.');
    const out = billing.calculatePeriod(ui.market, p.id, (A.currentAccount() || {}).fullName || '');
    A.render();
    U.toast(out.warnings.some(x => String(x.severity || 'BLOCKING').toUpperCase() === 'BLOCKING') ? 'Đã tính nháp: còn dữ liệu nguồn cần xử lý.' : 'Đã tính nháp ' + out.drafts.length + ' thành phần phí để kiểm tra.');
  };
  function ptStyleDetailCards() {
    setTimeout(() => {
      const modal = document.querySelector('.modal');
      if (!modal) return;
      Array.from(modal.querySelectorAll('section')).filter(s => /^HỢP ĐỒNG\b/.test((s.querySelector('h4') || {}).textContent || '')).forEach(section => {
        section.style.marginTop = '14px';
        section.style.padding = '14px 16px';
        section.style.border = '1px solid #dfe5ee';
        section.style.borderRadius = '12px';
        section.style.background = '#fbfcfe';
        section.style.boxShadow = '0 2px 8px rgba(31, 41, 55, .05)';
        const heading = section.querySelector('h4');
        if (heading) {
          heading.style.margin = '0 0 10px';
          heading.style.paddingBottom = '9px';
          heading.style.borderBottom = '1px solid #e7ebf2';
          heading.style.color = '#25324a';
        }
      });
    }, 0);
  }
  function ptNewDetail(traderId, period) {
    ptStyleDetailCards();
    const billing = A.features.finance.billing, p = A.periods.getById(period), group = billing && billing.traderGroups(ui.market, period).find(x => x.traderId === traderId), invoice = p ? MP().invoices(p).find(i => i.traderId === traderId) : null, t = A.idx.trader.get(traderId) || {};
    const rows = group ? group.rows : (invoice ? (invoice.items || []).map(item => ({ contractId: item.contractId, stallId: item.stallId, amount: item.amount, items: [item] })) : []);
    if (!p || p.marketId !== ui.market || !rows.length) return U.toast('Không tìm thấy chi tiết khoản phải thu.');
    const contracts = Array.from(new Set(rows.map(x => x.contractId))).map(id => ({ id, rows: rows.filter(x => x.contractId === id) }));
    const line = r => { const i = r.items[0] || {}; return `<div style="padding:7px 0;border-bottom:1px solid var(--border,#e5e7eb)"><div class="row"><b>${U.esc(i.name || 'Khoản phí')}</b><span class="spacer"></span><b>${U.money(r.amount)}</b></div><div class="small muted" style="margin-top:3px">${U.esc(i.explanation || '')}${i.chargeType === 'LAND' ? ' = ' + U.money(r.amount) : i.meter ? ' · ' + Number(i.meter.consumption).toLocaleString('vi-VN') + ' ' + U.esc(i.unit || '') + ' × ' + U.money(i.unitPrice) + ' = ' + U.money(r.amount) : ' · ' + U.money(r.amount)}${i.feePeriod ? ' · Tháng tính phí ' + U.per(i.feePeriod) : ''}</div></div>`; };
    const errors = group ? group.errors || [] : [];
    const errorsHtml = errors.length ? `<div class="note warn" style="margin-top:14px"><b>⚠ CẦN XỬ LÝ</b>${errors.map(e => { const st = A.idx.stall.get(e.businessPointId) || {}, label = e.chargeType === 'LAND' ? 'Mặt bằng' : e.chargeType === 'ELECTRICITY' ? 'Điện' : e.chargeType === 'WATER' ? 'Nước' : e.chargeType === 'MARKET_SERVICE' ? 'Dịch vụ' : 'Dữ liệu hợp đồng'; const go = e.code.indexOf('POLICY') >= 0 ? 'cau-hinh-gia' : e.code.indexOf('METER') >= 0 || e.code === 'ABNORMAL_CONSUMPTION' ? 'dien-nuoc' : e.code.indexOf('POINT') >= 0 || e.code.indexOf('AREA') >= 0 ? 'mat-bang' : 'hop-dong'; return `<div style="margin-top:8px"><b>${U.esc(e.contractId || 'Hợp đồng')} · ${U.esc(st.code || e.businessPointId || '—')}</b><br>${U.esc(label)}: ❌ ${U.esc(e.message)} <button class="btn sm" data-act="go" data-id="${go}">Đi đến dữ liệu nguồn</button></div>`; }).join('')}</div>` : '';
    A.modal(A.mHead('Chi tiết khoản phải thu') + `<div class="modal-b"><dl class="kv"><dt>Tiểu thương</dt><dd><b>${U.esc(t.name || traderId)}</b> (${U.esc(t.id || traderId)})</dd><dt>Kỳ thu</dt><dd>${U.esc(p.label || U.per(p.period))}</dd><dt>Số hợp đồng</dt><dd>${contracts.length}</dd></dl>${ptFeeMonthsNote(p)}${errorsHtml}${contracts.map(c => { const st = A.idx.stall.get(c.rows[0].stallId) || {}, source = (A.db.contracts || []).find(x => x.id === c.id) || {}, applies = source.serviceApplicability || {}, types = c.rows.map(x => (x.items[0] || {}).chargeType); const absent = [['ELECTRICITY', 'Điện', applies.electricity], ['WATER', 'Nước', applies.water], ['MARKET_SERVICE', 'Dịch vụ', applies.marketService]].filter(x => !x[2] && !types.includes(x[0])).map(x => `<div class="small muted">${x[1]}: Không đăng ký</div>`).join(''); return `<section style="margin-top:16px"><h4 style="margin:0 0 7px">HỢP ĐỒNG ${U.esc(c.id || '—')}</h4><div class="small muted">Điểm KD: <b>${U.esc(st.code || c.rows[0].stallId || '—')}</b></div>${c.rows.map(line).join('')}${absent}<div class="row" style="padding-top:8px"><b>TỔNG ĐIỂM ${U.esc(st.code || '')}</b><span class="spacer"></span><b>${U.money(U.sum(c.rows, x => x.amount))}</b></div></section>`; }).join('')}<div class="note info" style="margin-top:16px"><b>TỔNG KHOẢN PHẢI THU TIỂU THƯƠNG</b><span style="float:right"><b>${U.money(group ? group.amount : invoice.amount)}</b></span></div></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`, true);
  }
  A.ACT['pt-new-detail'] = el => ptNewDetail(el.dataset.trader, el.dataset.period);
  // ---------- Thu tiền: helper dùng chung của workspace ----------
  function receivableCollectAllowedForMarket(market) { return A.canCollectReceivable(market); }
  function cashHandovers() { A.db.cashHandovers = Array.isArray(A.db.cashHandovers) ? A.db.cashHandovers : []; return A.db.cashHandovers; }
  function hoAccByCode(code) { return A.ACCOUNTS.list().find(a => (a.code || a.id) === code) || null; }
  function hoName(code) { const a = hoAccByCode(code); return a ? a.fullName : U.staffName(code); }
  function hoAreaLabel(row) { return row.name + (ptRowPlace(row) ? ' · ' + ptRowPlace(row) : ''); }
  // Nút "Thu tiền" từ Điểm kinh doanh / hồ sơ tiểu thương → mở workspace Thu tiền của đúng tiểu thương (một luồng thu duy nhất).
  A.ACT['pay-open'] = el => {
    const t = A.idx.trader.get(el.dataset.id);
    if (!t || !U.can('thu-tien')) return U.toast('Bạn chưa được cấp quyền Thu tiền.');
    A.closeModal(); ui.market = t.market; f.ttTab = 'list'; f.ttStatus = 'UNPAID'; f.ttSearch = t.id; A.go('thu-tien');
  };

  // ---------- Thu tiền & biên lai — workspace kỳ thu của NV thu phí (implementation DUY NHẤT) ----------
  // Luồng: khoản phải thu đã phát hành → thu trong toàn kỳ → biên lai → hoàn tất thu → một phiếu nộp tiền mặt theo chợ/kỳ
  // → Kế toán Trung tâm đối soát. Trạng thái/điều kiện lấy từ features/finance/market-period.js.
  const TT_STATUS = { PAID: ['Đã thu đủ', 'ok'], UNPAID: ['Chưa thu', 'warn'] };
  const ttTag = (label, cls) => `<span class="tag ${cls || ''}">${U.esc(label)}</span>`;
  const ttIsTransfer = x => x.method !== 'tm';
  const ttSorted = list => list.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const ttPeriodLabel = p => p.label || U.per(p.id);
  // 1 kỳ của chợ = marketPeriod.collection: bản ghi "Hoàn tất thu & chuyển đối soát" (NV thu phí) đồng thời là bản ghi
  // ĐỐI SOÁT của Kế toán Trung tâm: reconciliationStatus WAITING → NEEDS_RESOLUTION (lệch) → RECONCILED (khớp 100%).
  function ttHandoff(p, market) { return (p && p.marketId === market && p.collection) || null; }
  const rcClosedAt = r => (r && (r.closedAt || r.completedAt)) || '';
  const rcClosedBy = r => (r && (r.closedBy || r.completedBy)) || '';
  const rcStatus = r => (r && r.reconciliationStatus) || 'WAITING';
  const RC_RESULT = { MATCHED: ['Đủ', 'ok'], SHORTAGE: ['Thiếu', 'danger'], SURPLUS: ['Thừa', 'warn'] };
  // Trạng thái chỉ nêu kết quả Thiếu / Đủ / Thừa; số tiền chênh lệch xem ở chi tiết.
  function rcStatusTag(r) {
    if (!r) return '<span class="tag">Chưa hoàn tất thu</span>';
    if (rcStatus(r) === 'NEEDS_RESOLUTION') { const res = RC_RESULT[r.lastResult || r.result] || RC_RESULT.SHORTAGE; return `<span class="tag danger">Cần xử lý chênh lệch</span> <span class="tag ${res[1]}">${res[0]}</span>`; }
    if (rcStatus(r) !== 'RECONCILED') return '<span class="tag warn">Chờ đối soát</span>';
    const res = RC_RESULT[r.result] || RC_RESULT.MATCHED;
    return `<span class="tag ok">Đã đối soát</span> <span class="tag ${res[1]}">${res[0]}</span>`;
  }
  // Trạng thái kỳ của chợ ở góc nhìn Thu tiền — dẫn xuất từ market-period (COLLECTING = còn được ghi nhận thu).
  function ttPeriodState(p, market) {
    const svc = MP(), st = svc.stateOf(market, A.periods.periodKey(p));
    if (svc.isClosed(p)) return { id: 'CLOSED', label: 'Đã chốt kỳ', cls: 'ok' };
    if (ttHandoff(p, market)) return { id: 'HANDED_OFF', label: st.label, cls: st.cls };
    if (svc.canCollect(p)) return { id: 'COLLECTING', label: st.label, cls: st.cls };
    return { id: 'OPEN', label: st.id === 'NOT_APPLICABLE' ? st.label : 'Chưa phát hành', cls: '' };
  }
  function ttCanCollect(market) { return receivableCollectAllowedForMarket(market) && !ptScopeAll(); }
  function ttRows(p, market) {
    const codeCounts = {};
    return MP().invoices(p).map(i => {
      const pays = ttSorted(A.db.payments.filter(x => x.invoiceId === i.id && A.receiptBusinessStateOk(x)));
      const paid = i.status === 'paid';
      const baseCode = ptReceivableCode(market, p.id, i.traderId, 1), ordinal = (codeCounts[baseCode] || 0) + 1;
      codeCounts[baseCode] = ordinal;
      return { inv: i, t: A.idx.trader.get(i.traderId) || { id: i.traderId, name: i.traderId }, pays, last: pays[pays.length - 1] || null,
        status: paid ? 'PAID' : 'UNPAID', remaining: paid ? 0 : Math.max(0, U.due(i)), stallIds: U.invStallIds(i), receivableCode: ptReceivableCode(market, p.id, i.traderId, ordinal) };
    });
  }
  // KẾT QUẢ THU của kỳ (market + period) dùng cho Chốt kỳ thu và Đối soát thu tiền: payment thành công của các khoản phải
  // thu thuộc kỳ/chợ này, LOẠI payment thu hồi công nợ (payment.debtId — luồng THU_HOI_NO/màn Công nợ; nghiệp vụ hiện tại
  // không xét nộp muộn/công nợ). Cùng MỘT tập payment → cash + transfer = collected theo định nghĩa. KPI màn Thu tiền
  // (ttStats) giữ nguyên; module Công nợ và dữ liệu nợ không đổi.
  function ttPeriodCollection(rows) {
    const all = rows.flatMap(r => r.pays), pays = all.filter(x => !x.debtId), debt = all.filter(x => x.debtId);
    const cashPays = pays.filter(x => !ttIsTransfer(x)), transferPays = pays.filter(ttIsTransfer);
    const cash = U.sum(cashPays, x => x.amount), transfer = U.sum(transferPays, x => x.amount);
    return { cashPays, transferPays, cash, transfer, collected: cash + transfer, debtExcluded: U.sum(debt, x => x.amount), debtExcludedCount: debt.length };
  }
  function ttStats(rows) {
    const pays = rows.flatMap(r => r.pays), cash = pays.filter(x => !ttIsTransfer(x)), transfer = pays.filter(ttIsTransfer);
    return { total: rows.length, paid: rows.filter(r => r.status === 'PAID').length, unpaid: rows.filter(r => r.status === 'UNPAID').length,
      amount: U.sum(rows, r => r.inv.amount), collected: U.sum(rows, r => r.inv.amount - r.remaining), remaining: U.sum(rows, r => r.remaining),
      cash: U.sum(cash, x => x.amount), cashCount: cash.length, transfer: U.sum(transfer, x => x.amount), transferCount: transfer.length };
  }
  // Điều kiện Hoàn tất thu — một nguồn duy nhất: market-period.collectionChecklist.
  const ttChecklist = p => MP().collectionChecklist(p);
  // Ngữ cảnh dùng chung cho view và handler: mọi số liệu KPI/bảng/checklist lấy từ cùng 1 lần tính.
  function ttContext() {
    const acc = A.currentAccount() || {}, market = ui.market, p = financePeriod();
    if (!p || A.allowedMarkets(acc).indexOf(market) === -1) return null;
    const code = acc.code || acc.id, rows = ttRows(p, market);
    return { acc, market, p, code, rows, s: ttStats(rows), check: ttChecklist(p), state: ttPeriodState(p, market), canFinish: ttCanFinish(market) };
  }
  const ttCanFinish = market => U.can('thu-tien') && A.canDo('thu-tien.hoan-tat-thu', market);
  const ttChecklistHtml = check => `<ul class="tt-check">${check.items.map(x => `<li class="${x.ok ? 'is-ok' : 'is-bad'}"><span>${x.ok ? '✓' : '✕'}</span>${U.esc(x.text)}</li>`).join('')}</ul>`;
  function ttBreakdownHtml(inv) {
    const ids = U.invStallIds(inv), items = inv.items || [];
    const html = ids.map(id => {
      const st = A.idx.stall.get(id) || {}, its = items.filter(x => (x.stallId || ids[0]) === id);
      return `<div class="tt-bd-group"><div class="tt-bd-line tt-bd-h"><b>Điểm ${U.esc(st.code || id)}</b><b>${U.money(U.sum(its, x => x.amount))}</b></div>${its.map(x => `<div class="tt-bd-line"><span>${U.esc(x.name || 'Khoản thu')}</span><span>${U.money(x.amount)}</span></div>`).join('')}</div>`;
    }).join('');
    return html || '<div class="small muted">Khoản phải thu không có chi tiết thành phần.</div>';
  }

  function ttHeadHtml(c) {
    const { p, market, s, state } = c, mk = U.market(market) || {}, pct = U.pct(s.paid, s.total);
    const collector = A.ACCOUNTS.getMarketCollector ? A.ACCOUNTS.getMarketCollector(market) : null;
    const markets = (typeof A.effectiveMarkets === 'function' ? A.effectiveMarkets() : D.MARKETS).filter(m => A.allowedMarkets(c.acc).includes(m.id));
    const periods = A.periods.listForMarket(market).slice().sort((a, b) => String(b.period).localeCompare(String(a.period))).map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${U.esc(ttPeriodLabel(x))}</option>`).join('');
    const handoff = ttHandoff(p, market);
    const actions = state.id === 'COLLECTING' && c.canFinish ? `<div class="tt-head-actions"><button class="btn primary" data-act="tt-finish-open" ${c.check.ok ? '' : 'disabled'}>Hoàn tất thu &amp; chuyển đối soát</button></div>` : '';
    const reason = state.id === 'COLLECTING' && c.canFinish && !c.check.ok ? `<div class="tt-head-reason">Chưa đủ điều kiện hoàn tất thu: ${c.check.items.filter(x => !x.ok).map(x => U.esc(x.text)).join(' · ')}. <button class="link-btn" data-act="tt-tab" data-id="progress">Xem tiến độ kỳ thu</button></div>` : '';
    const handoffNote = handoff ? `<div class="tt-head-reason">${ttClosedNote(handoff)} Không ghi nhận giao dịch mới trong kỳ này.</div>` : '';
    return `<div class="card tt-head"><div class="card-b"><div class="tt-head-b">
      <div class="tt-head-info">
        <div class="tt-head-row"><label class="tt-f"><span>Kỳ thu</span><select class="input" data-ch="fp-select">${periods}</select></label>
          <label class="tt-f"><span>Chợ</span>${markets.length > 1 ? `<select class="input" data-ch="market-select">${markets.map(m => `<option value="${m.id}" ${m.id === market ? 'selected' : ''}>${U.esc(m.name)}</option>`).join('')}</select>` : `<b>${U.esc(mk.name || market)}</b>`}</label>
          <span class="tt-f"><span>Trạng thái</span>${ttTag(state.label, state.cls)}</span></div>
        <dl class="tt-facts"><div><dt>Thời gian thu</dt><dd>${U.dmy(p.startDate)} – ${U.dmy(p.dueDate)}</dd></div><div><dt>Hạn nộp</dt><dd>${U.dmy(p.dueDate)}</dd></div><div><dt>NV thu phí</dt><dd>${U.esc(collector ? collector.fullName : 'Chưa phân công')}</dd></div></dl>
      </div>
      <div class="tt-head-progress"><div class="tt-progress-label">Tiến độ toàn kỳ</div><div class="tt-progress-num"><b>${s.paid} / ${s.total}</b> đã thu <b class="tt-pct">${U.pctTxt(pct)}</b></div><div class="bar-mini"><i style="width:${pct}%"></i></div>${actions}</div>
    </div>${reason}${handoffNote}</div></div>`;
  }
  function ttKpisHtml(s) {
    const k = (label, value, cls) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value ${cls || ''}">${value}</div></div>`;
    return `<div class="kpis tt-kpis">${k('Tổng khoản phải thu', s.total)}${k('Đã thu đủ', s.paid, 'tt-ok')}${k('Chưa thu', s.unpaid)}
      ${k('Tiền mặt đã thu kỳ này', U.money(s.cash))}${k('Chuyển khoản đã ghi nhận', U.money(s.transfer))}${k('Còn phải thu', U.money(s.remaining), s.remaining ? 'tt-bad' : 'tt-ok')}</div>`;
  }
  function ttListRows(c) {
    const q = (f.ttSearch || '').trim().toLowerCase(), flt = ['UNPAID', 'PAID'].includes(f.ttStatus) ? f.ttStatus : 'all';
    const base = c.rows.filter(r => !q || [r.t.name, r.t.id, r.t.phone, r.inv.id, r.stallIds.map(id => (A.idx.stall.get(id) || {}).code || id).join(' ')].join(' ').toLowerCase().includes(q));
    const order = { UNPAID: 0, PAID: 1 };
    const rows = base.filter(r => flt === 'all' || r.status === flt).sort(f.ttSort === 'due'
      ? (a, b) => String(a.inv.due).localeCompare(String(b.inv.due)) || order[a.status] - order[b.status] || String(a.t.name).localeCompare(String(b.t.name), 'vi')
      : (a, b) => order[a.status] - order[b.status] || String(a.t.name).localeCompare(String(b.t.name), 'vi'));
    return { base, rows, flt, cnt: k => base.filter(r => k === 'all' || r.status === k).length };
  }
  function ttReplaceTraderCodeColumn(rows) {
    setTimeout(() => {
      const header = Array.from(document.querySelectorAll('th')).find(x => x.textContent.trim() === 'Mã TT');
      if (!header) return;
      header.textContent = 'Mã khoản thu';
      const table = header.closest('table');
      if (!table) return;
      Array.from(table.querySelectorAll('tbody tr')).forEach((tr, index) => {
        const cell = tr.children[1], row = rows[index];
        if (!cell || !row) return;
        cell.innerHTML = '<b>' + U.esc(row.receivableCode) + '</b><div class="small muted">' + U.esc(row.inv.id) + '</div>';
      });
    }, 0);
  }
  function ttListHtml(c) {
    const { base, rows, flt, cnt } = ttListRows(c), pg = U.pager('ttList', rows.length, 20);
    const canCollect = ttCanCollect(c.market) && c.state.id === 'COLLECTING';
    const body = rows.slice(pg.start, pg.end).map(r => {
      const codes = r.stallIds.map(id => (A.idx.stall.get(id) || {}).code || id), st = TT_STATUS[r.status];
      const method = r.last ? U.esc(D.METHOD[r.last.method] || r.last.method) : '<span class="muted">—</span>';
      const detail = `<button class="btn sm ghost" data-act="tt-detail" data-id="${r.inv.id}">Xem chi tiết</button>`;
      const action = r.status === 'PAID'
        ? (r.last ? `<button class="btn sm" data-act="tt-receipt" data-id="${U.esc(r.last.receipt)}">Xem biên lai</button>` : '')
        : canCollect ? `<button class="btn sm primary" data-act="tt-pay-open" data-id="${r.inv.id}">Thu tiền</button>` : '';
      return `<tr><td><b>${U.esc(r.t.name)}</b>${r.t.phone ? `<div class="small muted">${U.maskPhone(r.t.phone)}</div>` : ''}</td><td>${U.esc(r.t.id)}<div class="small muted">${U.esc(r.inv.id)}</div></td>
        <td>${codes.length} điểm<div class="small muted">${U.esc(codes.join(', '))}</div></td><td class="num">${U.money(r.inv.amount)}</td><td class="num">${U.money(r.inv.amount - r.remaining)}</td><td class="num"><b>${U.money(r.remaining)}</b></td>
        <td>${U.dmy(r.inv.due)}</td><td>${ttTag(st[0], st[1])}</td><td>${method}</td><td class="nowrap tt-actions">${action}${detail}</td></tr>`;
    });
    ttReplaceTraderCodeColumn(rows.slice(pg.start, pg.end));
    return `<div class="card-b tt-toolbar">
        <input class="input tt-search" data-in="tt-search" placeholder="Tìm tiểu thương, mã TT, mã khoản, điểm KD..." value="${U.esc(f.ttSearch || '')}">
        <div class="seg">${[['all', 'Tất cả'], ['UNPAID', 'Chưa thu'], ['PAID', 'Đã thu đủ']].map(x => `<button class="${flt === x[0] ? 'on' : ''}" data-act="tt-status" data-id="${x[0]}">${x[1]} (${cnt(x[0])})</button>`).join('')}</div>
        <span class="spacer"></span>
        <button class="btn sm ${f.ttSort === 'due' ? 'on' : 'ghost'}" data-act="tt-sort">${f.ttSort === 'due' ? '✓ ' : ''}Sắp xếp theo hạn nộp</button>
        <button class="btn sm ghost" data-act="tt-export" ${base.length ? '' : 'disabled'}>Xuất danh sách</button></div>
      <div class="card-b">${U.table([{ t: 'Tiểu thương' }, { t: 'Mã TT' }, { t: 'Điểm KD' }, { t: 'Tổng phải thu', num: true }, { t: 'Đã thu', num: true }, { t: 'Còn lại', num: true }, { t: 'Hạn nộp' }, { t: 'Trạng thái' }, { t: 'Phương thức' }, { t: 'Thao tác' }],
        body, { empty: c.rows.length ? 'Không có khoản phù hợp bộ lọc' : 'Chưa có khoản phải thu đã phát hành trong kỳ này' })}${pg.html}</div>`;
  }
  function ttReorderTransactionColumns() {
    setTimeout(() => {
      const header = Array.from(document.querySelectorAll('th')).find(x => x.textContent.trim() === 'Thời gian');
      if (!header) return;
      const table = header.closest('table'), head = table && header.parentElement;
      if (!table || !head) return;
      const labels = Array.from(head.children).map(x => x.textContent.trim());
      const order = ['Mã giao dịch', 'Mã khoản phải thu', 'Tiểu thương', 'Số tiền', 'Phương thức', 'Mã biên lai', 'Trạng thái', 'Thao tác'];
      const timeIndex = labels.indexOf('Thời gian');
      if (timeIndex >= 0) {
        head.children[timeIndex].remove();
        table.querySelectorAll('tbody tr').forEach(row => { if (row.children[timeIndex]) row.children[timeIndex].remove(); });
      }
      const currentLabels = Array.from(head.children).map(x => x.textContent.trim());
      const indexes = order.map(label => currentLabels.indexOf(label)).filter(index => index >= 0);
      const reorder = row => indexes.map(index => row.children[index]).filter(Boolean).forEach(cell => row.appendChild(cell));
      reorder(head);
      Array.from(table.querySelectorAll('tbody tr')).forEach(reorder);
    }, 0);
  }
  function ttTxHtml(c) {
    const q = (f.ttTxSearch || '').trim().toLowerCase(), m = ['tm', 'transfer'].includes(f.ttTxMethod) ? f.ttTxMethod : 'all';
    const all = c.rows.flatMap(r => r.pays.map(p => ({ p, r }))).sort((a, b) => (b.p.date + b.p.time).localeCompare(a.p.date + a.p.time));
    const list = all.filter(x => (m === 'all' || (m === 'tm' ? !ttIsTransfer(x.p) : ttIsTransfer(x.p))) && (!q || [x.p.id, x.p.receipt, x.r.inv.id, x.r.t.name, x.r.t.id].join(' ').toLowerCase().includes(q)));
    const pg = U.pager('ttTx', list.length, 20);
    ttReorderTransactionColumns();
    const status = () => ttTag('Đã ghi nhận', 'ok');
    const cnt = k => all.filter(x => k === 'all' || (k === 'tm' ? !ttIsTransfer(x.p) : ttIsTransfer(x.p))).length;
    return `<div class="card-b tt-toolbar">
        <input class="input tt-search" data-in="tt-tx-search" placeholder="Tìm mã giao dịch, biên lai, mã khoản, tiểu thương..." value="${U.esc(f.ttTxSearch || '')}">
        <div class="seg">${[['all', 'Tất cả'], ['tm', 'Tiền mặt'], ['transfer', 'Chuyển khoản']].map(x => `<button class="${m === x[0] ? 'on' : ''}" data-act="tt-tx-method" data-id="${x[0]}">${x[1]} (${cnt(x[0])})</button>`).join('')}</div></div>
      <div class="card-b">${U.table([{ t: 'Thời gian' }, { t: 'Tiểu thương' }, { t: 'Mã giao dịch' }, { t: 'Mã khoản phải thu' }, { t: 'Số tiền', num: true }, { t: 'Phương thức' }, { t: 'Mã biên lai' }, { t: 'Trạng thái' }, { t: 'Thao tác' }],
        list.slice(pg.start, pg.end).map(x => `<tr><td class="nowrap">${U.dmy(x.p.date)} ${U.esc(x.p.time || '')}</td><td>${U.esc(x.r.t.name)}<div class="small muted">${U.esc(x.r.t.id)}</div></td><td>${U.esc(x.p.id)}</td><td>${U.esc(x.r.inv.id)}</td>
          <td class="num">${U.money(x.p.amount)}</td><td>${U.esc(D.METHOD[x.p.method] || x.p.method)}</td><td>${U.esc(x.p.receipt)}</td><td>${status(x)}</td><td><button class="btn sm" data-act="tt-receipt" data-id="${U.esc(x.p.receipt)}">Xem biên lai</button></td></tr>`),
        { empty: 'Chưa có giao dịch trong kỳ này' })}${pg.html}
        <div class="small muted tt-foot">Giao dịch đã xác nhận không sửa trực tiếp số tiền. Chuyển khoản/QR do hệ thống ghi nhận khi khớp giao dịch thanh toán.</div></div>`;
  }
  function ttProgressHtml(c) {
    const { p, s, check, state } = c, pct = U.pct(s.paid, s.total);
    const cta = state.id === 'COLLECTING' && c.canFinish ? `<div class="tt-progress-cta"><button class="btn primary" data-act="tt-finish-open" ${check.ok ? '' : 'disabled'}>Hoàn tất thu &amp; chuyển đối soát</button>${check.ok ? '' : '<span class="small muted">Cần đạt đủ các điều kiện bên trên.</span>'}</div>` : '';
    const handoff = ttHandoff(p, c.market);
    return `<div class="card-b tt-progress">
      <div class="tt-progress-h"><div><h3>Kỳ thu ${U.esc(ttPeriodLabel(p))}</h3><div class="small muted">${U.dmy(p.startDate)} – ${U.dmy(p.dueDate)}</div></div>${ttTag(state.label, state.cls)}</div>
      <div class="tt-progress-grid">
        <dl class="tt-sum"><div><dt>Tổng khoản phải thu</dt><dd>${s.total}</dd></div><div><dt>Đã thu đủ</dt><dd>${s.paid}</dd></div><div><dt>Chưa thu</dt><dd>${s.unpaid}</dd></div></dl>
        <dl class="tt-sum"><div><dt>Tổng phải thu</dt><dd>${U.money(s.amount)}</dd></div><div><dt>Đã thu</dt><dd>${U.money(s.collected)}</dd></div><div><dt>Tiền mặt</dt><dd>${U.money(s.cash)}</dd></div><div><dt>Chuyển khoản</dt><dd>${U.money(s.transfer)}</dd></div><div class="is-total"><dt>Còn phải thu</dt><dd>${U.money(s.remaining)}</dd></div></dl>
      </div>
      <div class="tt-progress-bars"><div><div class="tt-progress-label">Khoản đã thu đủ: <b>${s.paid} / ${s.total}</b> (${U.pctTxt(pct)})</div><div class="bar-mini"><i style="width:${pct}%"></i></div></div></div>
      <h4 class="tt-sec-title">Điều kiện hoàn tất thu</h4>${ttChecklistHtml(check)}${cta}
      ${handoff ? `<div class="note info">${ttClosedNote(handoff)} Tiền mặt đã thu bàn giao cho Kế toán Trung tâm để đối soát.</div>` : ''}</div>`;
  }
  A.VIEWS['thu-tien'] = function () {
    const c = ttContext();
    if (!c) return `<div class="card"><div class="card-b"><div class="empty">${financePeriod() ? 'Bạn chưa được phân công Chợ này.' : 'Chưa có kỳ thu.'}</div></div></div>`;
    const tabs = [['list', 'Danh sách thu'], ['tx', 'Giao dịch & biên lai'], ['progress', 'Tiến độ kỳ thu']];
    const tab = tabs.some(t => t[0] === f.ttTab) ? f.ttTab : 'list';
    const body = tab === 'tx' ? ttTxHtml(c) : tab === 'progress' ? ttProgressHtml(c) : ttListHtml(c);
    return ttHeadHtml(c) + ttKpisHtml(c.s) + `<div class="card tt-work"><div class="card-h tt-tabs"><div class="seg">${tabs.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="tt-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div></div>${body}</div>`;
  };
  A.ACT['tt-tab'] = el => { if (!U.can('thu-tien')) return; f.ttTab = el.dataset.id; A.closeModal(); A.render(); };
  A.ACT['tt-status'] = el => { f.ttStatus = el.dataset.id; ui.page.ttList = 0; A.render(); };
  A.ACT['tt-sort'] = () => { f.ttSort = f.ttSort === 'due' ? '' : 'due'; ui.page.ttList = 0; A.render(); };
  A.IN['tt-search'] = el => { f.ttSearch = el.value; ui.page.ttList = 0; A.render(); };
  A.ACT['tt-tx-method'] = el => { f.ttTxMethod = el.dataset.id; ui.page.ttTx = 0; A.render(); };
  A.IN['tt-tx-search'] = el => { f.ttTxSearch = el.value; ui.page.ttTx = 0; A.render(); };
  A.ACT['tt-export'] = () => {
    const c = U.can('thu-tien') && ttContext();
    if (!c) return;
    U.csv('danh-sach-thu-' + c.market.toLowerCase() + '-' + c.p.id, ['Tiểu thương', 'Mã TT', 'Mã khoản', 'Điểm KD', 'Tổng phải thu', 'Đã thu', 'Còn lại', 'Hạn nộp', 'Trạng thái', 'Phương thức'],
      ttListRows(c).rows.map(r => [r.t.name, r.t.id, r.inv.id, r.stallIds.map(id => (A.idx.stall.get(id) || {}).code || id).join(', '), r.inv.amount, r.inv.amount - r.remaining, r.remaining, U.dmy(r.inv.due), TT_STATUS[r.status][0], r.last ? (D.METHOD[r.last.method] || r.last.method) : '']));
  };
  A.ACT['tt-detail'] = el => {
    const c = U.can('thu-tien') && ttContext(), r = c && c.rows.find(x => x.inv.id === el.dataset.id);
    if (!r) return U.toast('Không tìm thấy khoản phải thu trong kỳ/chợ đang chọn');
    const st = TT_STATUS[r.status];
    A.modal(A.mHead('Chi tiết khoản phải thu') + `<div class="modal-b tt-pay">
      <div class="tt-pay-who"><b>${U.esc(r.t.name)}</b> (${U.esc(r.t.id)}) ${ttTag(st[0], st[1])}<div class="small muted">${U.esc(r.inv.id)} · Kỳ thu ${U.esc(ttPeriodLabel(c.p))} · Hạn nộp ${U.dmy(r.inv.due)}</div></div>
      <dl class="tt-sum"><div><dt>Tổng phải thu</dt><dd>${U.money(r.inv.amount)}</dd></div><div><dt>Đã thanh toán</dt><dd>${U.money(r.inv.amount - r.remaining)}</dd></div><div class="is-total"><dt>Còn phải thu</dt><dd>${U.money(r.remaining)}</dd></div></dl>
      <h4 class="tt-sec-title">Chi tiết khoản thu</h4>${ttBreakdownHtml(r.inv)}
      ${r.pays.length ? `<h4 class="tt-sec-title">Giao dịch</h4>${U.table([{ t: 'Thời gian' }, { t: 'Mã giao dịch' }, { t: 'Phương thức' }, { t: 'Số tiền', num: true }, { t: 'Biên lai' }], r.pays.map(x => `<tr><td>${U.dmy(x.date)} ${U.esc(x.time || '')}</td><td>${U.esc(x.id)}</td><td>${U.esc(D.METHOD[x.method] || x.method)}</td><td class="num">${U.money(x.amount)}</td><td><button class="link-btn" data-act="tt-receipt" data-id="${U.esc(x.receipt)}">${U.esc(x.receipt)}</button></td></tr>`))}` : ''}
      </div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`, true);
  };

  // ---- Thu tiền: chỉ thu đủ; tiền mặt NV xác nhận, chuyển khoản do hệ thống ghi nhận ----
  function ttPayContext(invId) {
    const inv = A.idx.invoice.get(invId), p = financePeriod(), acc = A.currentAccount(), code = acc && (acc.code || acc.id);
    if (!inv || !acc || !p || A.receivableMarket(inv) !== ui.market || MP().ofInvoice(inv) !== p) return { err: 'Khoản phải thu không thuộc kỳ/chợ đang chọn' };
    if (!ttCanCollect(ui.market)) return { err: 'Bạn không có quyền thu tiền khoản này' };
    const state = ttPeriodState(p, ui.market);
    if (state.id !== 'COLLECTING') return { err: state.id === 'CLOSED' ? 'Kỳ thu đã chốt — không ghi nhận thanh toán mới trong kỳ này' : state.id === 'HANDED_OFF' ? 'Chợ đã hoàn tất thu & chuyển đối soát — không ghi nhận thanh toán mới' : 'Chỉ thu tiền khi kỳ của chợ đã phát hành và đang thu' };
    if (inv.status === 'paid' || U.due(inv) <= 0) return { err: 'Khoản phải thu đã được thu đủ' };
    if (!MP().canCollectInvoice(inv)) return { err: 'Khoản phải thu không ở trạng thái được thu' };
    return { inv, p, acc, code, t: A.idx.trader.get(inv.traderId) || { id: inv.traderId, name: inv.traderId }, remaining: U.due(inv) };
  }
  function ttPayModal() {
    const st = ui.ttPay, c = st && ttPayContext(st.invId);
    if (!c || c.err) { ui.ttPay = null; A.closeModal(); if (c) U.toast(c.err); return; }
    const mk = U.market(ui.market) || {}, cash = st.method !== 'transfer';
    const amount = st.amount == null ? c.remaining : st.amount, ok = amount === c.remaining;
    const ref = c.inv.paymentReference || (c.inv.qrReference || {}).reference || '';
    const account = A.BANK_ACCOUNTS && A.BANK_ACCOUNTS.listByMarket(ui.market).find(a => a.isCollectionAccount && a.status !== 'inactive');
    const review = MP().reviewBank(c.p).filter(b => b.receivableId === c.inv.id || String(b.ref || '').includes(c.inv.id));
    const cashHtml = `<div class="tt-cash"><div class="tt-bd-line"><span>Số tiền phải thu</span><b>${U.money(c.remaining)}</b></div>
        <div class="field"><label for="tt-pay-amount">Số tiền nhận (đ)</label><input id="tt-pay-amount" class="input" type="number" min="0" step="1000" inputmode="numeric" data-in="tt-pay-amount" data-remaining="${c.remaining}" value="${amount == null || amount < 0 ? '' : amount}"></div>
        <div id="tt-pay-amount-msg" class="small ${ok ? 'muted' : 'tt-err'}">${ok ? 'Khoản phải thu phải được thanh toán đủ. Hệ thống không hỗ trợ thu một phần.' : 'Số tiền nhận phải bằng đúng ' + U.money(c.remaining) + '. Hệ thống không hỗ trợ thu một phần.'}</div>
        <div class="field"><label for="tt-pay-note">Ghi chú (không bắt buộc)</label><textarea id="tt-pay-note" class="input" rows="2" data-in="tt-pay-note">${U.esc(st.note || '')}</textarea></div></div>`;
    const transferHtml = `<div class="tt-cash"><dl class="tt-sum">${account ? `<div><dt>Tài khoản nhận</dt><dd>${U.esc(account.accountNumber)} · ${U.esc(A.BANK_ACCOUNTS.bankName(account.bankCode))}</dd></div><div><dt>Chủ tài khoản</dt><dd>${U.esc(account.accountHolderName || '')}</dd></div>` : ''}
        <div><dt>Số tiền</dt><dd>${U.money(c.remaining)}</dd></div>${ref ? `<div><dt>Nội dung chuyển khoản</dt><dd><b>${U.esc(ref)}</b></dd></div>` : ''}</dl>
        <div class="note info">Giao dịch chuyển khoản sẽ được hệ thống ghi nhận khi khớp được giao dịch thanh toán. Nhân viên thu phí không tự xác nhận đã nhận tiền chuyển khoản.</div>
        ${review.length ? `<div class="note" style="margin-top:8px">Có ${review.length} giao dịch ngân hàng liên quan khoản này đang <b>cần tra soát</b>.</div>` : ''}</div>`;
    A.modal(A.mHead('Thu tiền') + `<div class="modal-b tt-pay">
      <div class="tt-pay-who"><b>${U.esc(c.t.name)}</b> (${U.esc(c.t.id)})<div class="small muted">Kỳ thu ${U.esc(ttPeriodLabel(c.p))} · ${U.esc(mk.name || ui.market)} · ${U.esc(c.inv.id)}</div></div>
      <dl class="tt-sum"><div><dt>Tổng phải thu</dt><dd>${U.money(c.inv.amount)}</dd></div><div><dt>Đã thanh toán</dt><dd>${U.money(c.inv.paid)}</dd></div><div class="is-total"><dt>Còn phải thu</dt><dd>${U.money(c.remaining)}</dd></div></dl>
      <details class="tt-acc"><summary>Xem chi tiết khoản thu</summary>${ttBreakdownHtml(c.inv)}</details>
      <h4 class="tt-sec-title">Phương thức thanh toán</h4>
      <div class="tt-methods">${[['cash', 'Tiền mặt'], ['transfer', 'Chuyển khoản']].map(x => `<label class="tt-method ${(x[0] === 'cash') === cash ? 'on' : ''}"><input type="radio" name="tt-pay-method" value="${x[0]}" data-ch="tt-pay-method" ${(x[0] === 'cash') === cash ? 'checked' : ''}> ${x[1]}</label>`).join('')}</div>
      ${cash ? cashHtml : transferHtml}</div>
      <div class="modal-f">${cash ? `<button class="btn" data-act="close">Hủy</button><button id="tt-pay-submit" class="btn primary" data-act="tt-pay-review" ${ok ? '' : 'disabled'}>Xác nhận thu tiền</button>` : '<button class="btn" data-act="close">Đóng</button>'}</div>`);
  }
  A.ACT['tt-pay-open'] = el => {
    const c = ttPayContext(el.dataset.id);
    if (c.err) { U.toast(c.err); A.render(); return; }
    ui.ttPay = { invId: c.inv.id, method: 'cash', amount: null, note: '' };
    ttPayModal();
  };
  A.ACT['tt-pay-back'] = () => ttPayModal();
  A.CH['tt-pay-method'] = el => { if (!ui.ttPay) return; ui.ttPay.method = el.value === 'transfer' ? 'transfer' : 'cash'; ttPayModal(); };
  A.IN['tt-pay-note'] = el => { if (ui.ttPay) ui.ttPay.note = el.value; };
  // Kiểm tra trực tiếp trên DOM, không render lại modal để giữ con trỏ nhập liệu.
  A.IN['tt-pay-amount'] = el => {
    if (!ui.ttPay) return;
    const remaining = Number(el.dataset.remaining), v = el.value === '' ? NaN : Number(el.value), ok = Number.isFinite(v) && v === remaining;
    ui.ttPay.amount = Number.isFinite(v) ? v : -1;
    const btn = A.$('#tt-pay-submit'), msg = A.$('#tt-pay-amount-msg');
    if (btn) btn.disabled = !ok;
    if (msg) { msg.className = 'small ' + (ok ? 'muted' : 'tt-err'); msg.textContent = ok ? 'Khoản phải thu phải được thanh toán đủ. Hệ thống không hỗ trợ thu một phần.' : 'Số tiền nhận phải bằng đúng ' + U.money(remaining) + '. Hệ thống không hỗ trợ thu một phần.'; }
  };
  A.ACT['tt-pay-review'] = () => {
    const st = ui.ttPay, c = st && ttPayContext(st.invId);
    if (!c || c.err) { ui.ttPay = null; A.closeModal(); A.render(); return U.toast(c ? c.err : 'Phiên thu tiền không còn hợp lệ'); }
    if (st.method === 'transfer') return U.toast('Chuyển khoản do hệ thống ghi nhận khi khớp giao dịch — không xác nhận thủ công.');
    const inp = A.$('#tt-pay-amount'), amount = inp ? (inp.value === '' ? NaN : Number(inp.value)) : (st.amount == null ? c.remaining : st.amount);
    if (!Number.isFinite(amount) || amount !== c.remaining) return U.toast('Số tiền nhận phải bằng đúng ' + U.money(c.remaining) + '. Hệ thống không hỗ trợ thu một phần.');
    st.amount = amount; st.note = String((A.$('#tt-pay-note') || {}).value || st.note || '').trim();
    const receiptPreview = {
      invoiceId: c.inv.id, traderId: c.t.id, market: ui.market, amount, method: 'tm', by: c.code
    };
    A.modal(A.mHead('Xác nhận đã nhận tiền') + `<div class="modal-b tt-pay">
      <dl class="tt-sum"><div><dt>Tiểu thương</dt><dd>${U.esc(c.t.name)} (${U.esc(c.t.id)})</dd></div><div><dt>Kỳ thu</dt><dd>${U.esc(ttPeriodLabel(c.p))}</dd></div><div><dt>Phương thức</dt><dd>Tiền mặt</dd></div><div class="is-total"><dt>Số tiền</dt><dd>${U.money(amount)}</dd></div></dl>
      ${st.note ? `<div class="small muted" style="margin-top:8px">Ghi chú: ${U.esc(st.note)}</div>` : ''}
      <h4 class="tt-sec-title">Biên lai dự kiến</h4><div class="tt-receipt-preview">${ttReceiptHtml(receiptPreview, true)}</div>
      <div class="note" style="margin-top:12px">Vui lòng kiểm đếm tiền trước khi xác nhận. Sau khi xác nhận, hệ thống sẽ ghi nhận giao dịch và phát hành biên lai.</div></div>
      <div class="modal-f"><button class="btn" data-act="tt-pay-back">Hủy</button><button class="btn primary" data-act="tt-pay-commit">Xác nhận</button></div>`);
  };
  A.ACT['tt-pay-commit'] = () => {
    const st = ui.ttPay, c = st && ttPayContext(st.invId);
    // Bấm lặp: lần sau khoản đã 'paid' → ttPayContext trả lỗi, không tạo giao dịch/biên lai thứ hai.
    if (!c || c.err) { ui.ttPay = null; A.closeModal(); A.render(); return U.toast(c ? c.err : 'Phiên thu tiền không còn hợp lệ'); }
    if (st.method === 'transfer' || st.amount !== c.remaining) return U.toast('Số tiền nhận phải bằng đúng ' + U.money(c.remaining) + '. Hệ thống không hỗ trợ thu một phần.');
    const pays = A.applyPayment([c.inv.id], c.remaining, 'tm', c.code), pay = pays[0];
    if (pays.length !== 1 || !pay || c.inv.status !== 'paid' || U.due(c.inv) !== 0) {
      console.error('[thu-tien] applyPayment không thu đủ khoản', c.inv.id, pays);
      ui.ttPay = null; A.closeModal(); A.render(); return U.toast('Không ghi nhận được giao dịch thu đủ — vui lòng kiểm tra lại khoản phải thu');
    }
    if (st.note) pay.note = st.note;
    U.log('Thu tiền mặt khoản ' + c.inv.id + ' · ' + U.money(pay.amount) + ' · biên lai ' + pay.receipt);
    A.save(); ui.ttPay = null; A.render();
    A.modal(A.mHead('Thu tiền thành công') + `<div class="modal-b tt-pay"><div class="tt-success">✓ THU TIỀN THÀNH CÔNG</div>
      <div class="tt-pay-who"><b>${U.esc(c.t.name)}</b><div class="small muted">Kỳ ${U.esc(ttPeriodLabel(c.p))}</div></div>
      <dl class="tt-sum"><div class="is-total"><dt>Số tiền</dt><dd>${U.money(pay.amount)}</dd></div><div><dt>Phương thức</dt><dd>Tiền mặt</dd></div><div><dt>Mã giao dịch</dt><dd>${U.esc(pay.id)}</dd></div><div><dt>Mã biên lai</dt><dd>${U.esc(pay.receipt)}</dd></div><div><dt>Thời gian</dt><dd>${U.dmy(pay.date)} ${U.esc(pay.time)}</dd></div></dl></div>
      <div class="modal-f"><button class="btn" data-act="tt-receipt" data-id="${U.esc(pay.receipt)}">Xem biên lai</button><button class="btn" data-act="tt-receipt-print" data-id="${U.esc(pay.receipt)}">In biên lai</button><button class="btn primary" data-act="close">Đóng</button></div>`);
  };

  // ---- Biên lai điện tử (prototype: không phải chứng từ phát hành qua hệ thống chính thức) ----
  function ttPayByReceipt(no) { return A.db.payments.find(x => x.receipt === no && x.market === ui.market && A.receiptBusinessStateOk(x)) || null; }
  // Mẫu biên lai dùng chung với cổng Tiểu thương (features/finance/receipt.js).
  const ttReceiptHtml = (pay, preview) => A.features.finance.receipt.html(pay, preview);
  const ttStyleReceipt = () => A.features.finance.receipt.style();
  function ttReceiptModal(pay) {
    ttStyleReceipt();
    A.modal(A.mHead('Biên lai điện tử') + `<div class="modal-b">${ttReceiptHtml(pay)}</div>
      <div class="modal-f"><button class="btn" data-act="tt-receipt-print" data-id="${U.esc(pay.receipt)}">In biên lai</button><button class="btn" data-act="tt-receipt-send" data-id="${U.esc(pay.receipt)}">Gửi qua Zalo / Mini app</button><button class="btn primary" data-act="close">Đóng</button></div>`, true);
  }
  A.ACT['tt-receipt'] = el => {
    const pay = U.can('thu-tien') && ttPayByReceipt(el.dataset.id);
    if (!pay) return U.toast('Không tìm thấy biên lai trong phạm vi chợ đang chọn');
    ttReceiptModal(pay);
  };
  A.ACT['tt-receipt-print'] = el => {
    const pay = U.can('thu-tien') && ttPayByReceipt(el.dataset.id);
    if (!pay) return U.toast('Không tìm thấy biên lai trong phạm vi chợ đang chọn');
    if (!A.$('.tt-receipt')) ttReceiptModal(pay);
    pay.printStatus = 'PRINTED_MOCK'; A.save();
    setTimeout(() => window.print(), 0);
  };
  // Gửi lại dùng kênh thông báo lưu trữ hiện có (A.addTraderNotification) — mô phỏng, không gọi API ngoài.
  A.ACT['tt-receipt-send'] = el => {
    const pay = U.can('thu-tien') && ttPayByReceipt(el.dataset.id);
    if (!pay) return U.toast('Không tìm thấy biên lai trong phạm vi chợ đang chọn');
    if (!A.canDo('thu-tien.thu', pay.market)) return U.toast('Bạn không có quyền gửi biên lai');
    const key = 'receipt-resend:' + pay.id + ':' + U.today(), sent = (A.db.notifications || []).some(n => n.eventKey === key);
    if (sent) return U.toast('Biên lai ' + pay.receipt + ' đã được gửi lại hôm nay');
    A.addTraderNotification({ kind: 'PAYMENT_RECEIPT', traderId: pay.traderId, market: pay.market, referenceId: pay.id, eventKey: key, channels: ['Mini app', 'Zalo OA'],
      title: 'Biên lai ' + pay.receipt, body: 'Biên lai ' + pay.receipt + ' · ' + U.money(pay.amount) + ' cho khoản ' + (pay.invoiceId || '') + '. Mã tra cứu ' + (pay.lookup || '') + '.' });
    pay.receiptDelivery = Object.assign({}, pay.receiptDelivery, { resentAt: nowStamp(), status: 'SENT_MOCK' });
    U.log('Gửi lại biên lai ' + pay.receipt + ' qua Mini app/Zalo (mô phỏng)');
    A.save(); U.toast('Đã gửi biên lai tới tiểu thương qua Mini app / Zalo OA (mô phỏng)');
  };

  /* Legacy cash-session close flow: retained read-only in source for historical-data compatibility; it is not registered or reachable. */
  /*
  // ---- Chốt buổi thu (theo ngày) — KHÔNG phải chốt kỳ ----
  function ttSessionCloseContext(date) {
    const c = U.can('thu-tien') && ttContext();
    if (!c || !c.canClose) return { err: 'Bạn không có quyền chốt buổi thu' };
    if (!hoDateOk(date)) return { err: 'Ngày chốt không hợp lệ' };
    if (c.state.id !== 'COLLECTING') return { err: 'Chỉ chốt buổi khi kỳ đang ở trạng thái Đang thu' };
    const open = hoOpenCash(c.code, c.market, date, 'FEE');
    if (!open.length) return { err: ttDayClosed(c.market, c.code, date) ? 'Buổi thu ngày ' + U.dmy(date) + ' đã được chốt' : 'Không có giao dịch tiền mặt chưa chốt trong buổi này' };
    const periodInv = new Set(c.rows.map(r => r.inv.id));
    const transfers = A.db.payments.filter(x => periodInv.has(x.invoiceId) && ttIsTransfer(x) && x.date === date && A.receiptBusinessStateOk(x));
    return Object.assign(c, { date, open, transfers, cashTotal: U.sum(open, x => x.amount), transferTotal: U.sum(transfers, x => x.amount) });
  }
  A.ACT['tt-session-close-open'] = el => {
    const c = ttSessionCloseContext(el.dataset.date || U.today());
    if (c.err) { U.toast(c.err); A.render(); return; }
    A.modal(A.mHead('Chốt buổi thu ngày ' + U.dmy(c.date)) + `<div class="modal-b tt-pay">
      <dl class="tt-sum"><div><dt>NV thu phí</dt><dd>${U.esc(c.acc.fullName || c.code)}</dd></div><div><dt>Chợ</dt><dd>${U.esc((U.market(c.market) || {}).name || c.market)}</dd></div></dl>
      <dl class="tt-sum"><div><dt>Số giao dịch tiền mặt</dt><dd>${c.open.length}</dd></div><div><dt>Tiền mặt đã thu</dt><dd>${U.money(c.cashTotal)}</dd></div>
        <div><dt>Số giao dịch chuyển khoản đã ghi nhận</dt><dd>${c.transfers.length}</dd></div><div><dt>Chuyển khoản đã ghi nhận</dt><dd>${U.money(c.transferTotal)}</dd></div>
        <div><dt>Tổng giao dịch đã thu</dt><dd>${c.open.length + c.transfers.length}</dd></div><div class="is-total"><dt>Tổng giá trị</dt><dd>${U.money(c.cashTotal + c.transferTotal)}</dd></div>
        <div><dt>Còn chưa thu trong kỳ</dt><dd>${c.s.unpaid} khoản</dd></div></dl>
      <div class="note info" style="margin-top:12px">Sau khi chốt buổi thu, các giao dịch tiền mặt thuộc buổi này được khóa để chuẩn bị đối soát. Kỳ thu vẫn tiếp tục; ngày tiếp theo vẫn thu bình thường.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="tt-session-close-confirm" data-date="${c.date}">Chốt buổi thu</button></div>`);
  };
  A.ACT['tt-session-close-confirm'] = el => {
    const c = ttSessionCloseContext(el.dataset.date || U.today());
    if (c.err) { U.toast(c.err); A.closeModal(); A.render(); return; }
    // Nhiều buổi cùng ngày: mỗi lần chốt = 1 phiếu mới; định danh = chợ + NV + ngày (sessionDate) + số thứ tự buổi trong ngày
    // (sessionNo) + kỳ; id PN-{YYMMDD}-{mã NV}-{NN}. Chốt buổi chỉ khóa giao dịch tiền mặt CHƯA thuộc phiếu nào tại thời điểm chốt.
    const acc = c.acc, d = c.date.replace(/-/g, '').slice(2);
    let n = cashHandovers().filter(h => h.collectorCode === c.code && h.date === c.date && (h.kind || 'FEE') === 'FEE').length + 1;
    while (cashHandovers().some(h => h.id === 'PN-' + d + '-' + c.code + '-' + U.pad(n, 2))) n++;
    const assignedRows = (A.db.rows || []).filter(r => r.market === c.market && r.collectorId === acc.id), at = nowStamp();
    const h = { id: 'PN-' + d + '-' + c.code + '-' + U.pad(n, 2), kind: 'FEE', market: c.market, marketId: c.market, periodId: c.p.id, collectorId: acc.id, collectorCode: c.code, collectorName: acc.fullName || hoName(c.code),
      date: c.date, paymentIds: c.open.map(x => x.id), amount: c.cashTotal, declaredAmount: c.cashTotal, assignedRowIds: assignedRows.map(r => r.id), assignedAreas: assignedRows.map(hoAreaLabel), submittedAt: at, status: 'SUBMITTED',
      sessionDate: c.date, sessionNo: n, cashCount: c.open.length, transferPaymentIds: c.transfers.map(x => x.id), transferCount: c.transfers.length, transferAmount: c.transferTotal, closedAt: at, closedBy: acc.fullName || c.code, source: 'THU_TIEN_WORKSPACE' };
    cashHandovers().push(h);
    U.log('Chốt buổi thu ' + U.dmy(c.date) + ' · buổi ' + n + ' (' + h.id + '): ' + c.open.length + ' giao dịch tiền mặt, ' + U.money(h.amount));
    A.save(); A.closeModal(); A.render(); U.toast('Đã chốt buổi thu ngày ' + U.dmy(c.date) + ' · ' + h.id + ' · tiền mặt ' + U.money(h.amount));
  };
  A.ACT['tt-session-view'] = el => {
    const c = U.can('thu-tien') && ttContext(), s = c && c.sessions.find(x => x.date === el.dataset.date);
    if (!s) return;
    const handedBy = ttHandedBy(c.market), st = TT_SESSION[s.status];
    const rows = ttSorted(s.cash.concat(s.transfers)).reverse().map(x => { const t = A.idx.trader.get(x.traderId) || {}; return `<tr><td>${U.esc(x.time || '')}</td><td>${U.esc(t.name || x.traderId)}</td><td>${U.esc(x.id)}</td><td>${U.esc(x.invoiceId)}</td><td class="num">${U.money(x.amount)}</td><td>${U.esc(D.METHOD[x.method] || x.method)}</td>
      <td><button class="link-btn" data-act="tt-receipt" data-id="${U.esc(x.receipt)}">${U.esc(x.receipt)}</button></td><td>${ttIsTransfer(x) ? ttTag('Đã ghi nhận', 'ok') : handedBy[x.id] ? ttTag('Đã chốt', 'ok') : ttTag('Chưa chốt', 'warn')}</td></tr>`; });
    A.modal(A.mHead('Buổi thu ngày ' + U.dmy(s.date)) + `<div class="modal-b tt-pay">
      <dl class="tt-sum"><div><dt>Trạng thái</dt><dd>${ttTag(st[0], st[1])}</dd></div><div><dt>Tiền mặt</dt><dd>${U.money(s.cashTotal)}</dd></div><div><dt>CK ghi nhận</dt><dd>${U.money(s.transferTotal)}</dd></div><div class="is-total"><dt>Tổng thu</dt><dd>${U.money(s.cashTotal + s.transferTotal)}</dd></div>
        ${s.handovers.length ? `<div><dt>Phiếu chốt buổi</dt><dd>${s.handovers.map(h => `${U.esc(h.id)} · ${U.esc(h.closedAt || h.submittedAt || '')}`).join('<br>')}</dd></div>` : ''}</dl>
      <h4 class="tt-sec-title">Giao dịch trong buổi</h4>${U.table([{ t: 'Giờ' }, { t: 'Tiểu thương' }, { t: 'Mã giao dịch' }, { t: 'Mã khoản' }, { t: 'Số tiền', num: true }, { t: 'Phương thức' }, { t: 'Biên lai' }, { t: 'Trạng thái' }], rows, { empty: 'Chưa có giao dịch trong buổi này' })}</div>
      <div class="modal-f"><button class="btn" data-act="close">Đóng</button>${c.canClose && c.state.id === 'COLLECTING' && s.open.length ? `<button class="btn primary" data-act="tt-session-close-open" data-date="${s.date}">Chốt buổi thu</button>` : ''}</div>`, true);
  };

  */
  // ---- Hoàn tất thu & chuyển đối soát — NV thu phí, theo chợ/kỳ (100% đã thu, không còn giao dịch CK cần xử lý).
  // giao dịch CK cần xử lý). Sinh (1 lần) bản ghi CHỜ ĐỐI SOÁT trên kỳ của chợ (marketPeriod.collection). Không có
  // chế độ bỏ qua điều kiện. data-act giữ tên nội bộ tt-finish-*.
  function ttFinishContext() {
    const c = U.can('thu-tien') && ttContext();
    if (!c || !c.canFinish) return { err: 'Bạn không có quyền hoàn tất thu của chợ này' };
    if (c.state.id !== 'COLLECTING') return { err: c.state.id === 'HANDED_OFF' ? 'Chợ đã hoàn tất thu & chuyển đối soát' : c.state.id === 'CLOSED' ? 'Kỳ thu đã chốt' : 'Kỳ của chợ chưa ở trạng thái Đang thu' };
    if (!c.check.ok || !MP().canCompleteCollection(c.p)) return { err: 'Chưa đủ điều kiện hoàn tất thu: ' + c.check.items.filter(x => !x.ok).map(x => x.text).join('; ') };
    c.collector = A.ACCOUNTS.getMarketCollector ? A.ACCOUNTS.getMarketCollector(c.market) : null;
    c.col = ttPeriodCollection(c.rows);
    return c;
  }
  function ttClosedNote(h) {
    const sm = h.summary || {};
    return `Đã hoàn tất thu &amp; chuyển đối soát lúc ${U.esc(rcClosedAt(h))} · ${U.esc(rcClosedBy(h))}. Đối soát: ${rcStatusTag(h)}`
      + (h.prototypeBypass ? ` <span class="tag warn">Prototype</span> Chốt kỳ mô phỏng khi mới thu ${U.esc(String(sm.paidCount != null ? sm.paidCount : '?'))}/${U.esc(String(sm.receivables != null ? sm.receivables : '?'))} khoản, còn ${U.money(sm.remaining || 0)} chưa thu.` : '');
  }
  function ttCloseSummaryHtml(c) {
    return `<dl class="tt-sum"><div><dt>Kỳ thu</dt><dd>${U.esc(ttPeriodLabel(c.p))}</dd></div><div><dt>Chợ</dt><dd>${U.esc((U.market(c.market) || {}).name || c.market)}</dd></div><div><dt>NV thu phí</dt><dd>${U.esc((c.collector && c.collector.fullName) || c.acc.fullName || c.code)}</dd></div></dl>
      <h4 class="tt-sec-title">Kết quả thu</h4>
      <dl class="tt-sum"><div><dt>Tổng khoản phải thu</dt><dd>${c.s.total}</dd></div><div><dt>Đã thu đủ</dt><dd>${c.s.paid}/${c.s.total}</dd></div>
        <div><dt>Tổng phải thu</dt><dd>${U.money(c.s.amount)}</dd></div><div><dt>Tổng đã thu</dt><dd>${U.money(c.col.collected)}</dd></div><div class="is-total"><dt>Còn phải thu</dt><dd>${U.money(c.s.remaining)}</dd></div></dl>
      <h4 class="tt-sec-title">Phân theo phương thức</h4>
      <dl class="tt-sum"><div><dt>Tiền mặt</dt><dd>${U.money(c.col.cash)}</dd></div><div><dt>Chuyển khoản</dt><dd>${U.money(c.col.transfer)}</dd></div><div class="is-total"><dt>Tổng</dt><dd>${U.money(c.col.collected)}</dd></div></dl>
      ${ttChecklistHtml(c.check)}`;
  }
  function ttPeriodCashHandover(c, col, collector, at) {
    if (!col.cash) return null;
    const collectorCode = collector.code || collector.id || c.code;
    const existing = cashHandovers().find(h => h.marketId === c.market && h.periodId === c.p.id
      && h.collectorId === collector.id && h.handoverScope === 'MARKET_PERIOD');
    if (existing) return existing;
    const assignedRows = (A.db.rows || []).filter(r => r.market === c.market && r.collectorId === collector.id);
    const idBase = ('PN-' + c.p.id + '-' + collectorCode).replace(/[^A-Za-z0-9-]/g, '');
    let id = idBase, n = 2;
    while (cashHandovers().some(h => h.id === id)) id = idBase + '-' + n++;
    const handover = { id, kind: 'FEE', handoverScope: 'MARKET_PERIOD', market: c.market, marketId: c.market, periodId: c.p.id,
      collectorId: collector.id, collectorCode, collectorName: collector.fullName || hoName(collectorCode),
      paymentIds: col.cashPays.map(x => x.id), cashCount: col.cashPays.length, amount: col.cash, declaredAmount: col.cash,
      actualAmount: null, assignedRowIds: assignedRows.map(r => r.id), assignedAreas: assignedRows.map(hoAreaLabel),
      submittedAt: at, status: 'PENDING_RECONCILIATION', source: 'MARKET_PERIOD_COLLECTION' };
    cashHandovers().push(handover);
    return handover;
  }
  A.ACT['tt-finish-open'] = () => {
    const c = ttFinishContext();
    if (c.err) { U.toast(c.err); A.render(); return; }
    A.modal(A.mHead('Xác nhận hoàn tất thu & chuyển đối soát') + `<div class="modal-b tt-pay">${ttCloseSummaryHtml(c)}
      <div class="note" style="margin-top:12px">Sau khi hoàn tất thu, chợ không tiếp tục ghi nhận thanh toán trong kỳ này (kể cả chuyển khoản).<br>Số tiền mặt đã thu được bàn giao cho Kế toán Trung tâm để đối soát.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="tt-finish-confirm">Hoàn tất thu &amp; chuyển đối soát</button></div>`, true);
  };
  A.ACT['tt-finish-confirm'] = el => {
    const c = ttFinishContext();
    if (c.err) { U.toast(c.err); A.closeModal(); A.render(); return; }
    const at = nowStamp(), col = c.col, collector = c.collector || c.acc, cashHandover = ttPeriodCashHandover(c, col, c.collector || c.acc, at);
    // Snapshot số liệu THẬT tại thời điểm chốt — Kế toán đối soát trên snapshot này, không tính lại.
    const rec = { marketId: c.market, periodId: c.p.id, closedAt: at, closedBy: c.acc.fullName || c.code, closedByCode: c.code, closedById: c.acc.id,
      collectorId: collector.id, collectorName: collector.fullName || c.code, reconciliationStatus: 'WAITING', reconciliationHistory: [], createdAt: at,
      summary: { receivables: c.s.total, paidCount: c.s.paid, amount: c.s.amount, remaining: c.s.remaining,
        // Tiền của kỳ = ttPeriodCollection (không gồm thu hồi công nợ): cash + transfer = collected.
        cashScope: 'PERIOD_ONLY', collected: col.collected, cash: col.cash, cashCount: col.cashPays.length, transfer: col.transfer, transferCount: col.transferPays.length,
        cashPaymentIds: col.cashPays.map(x => x.id), transferPaymentIds: col.transferPays.map(x => x.id), debtExcludedAmount: col.debtExcluded, debtExcludedCount: col.debtExcludedCount,
        cashHandoverId: cashHandover && cashHandover.id } };
    // Idempotent: ttFinishContext từ chối khi chợ đã có bản ghi → mỗi kỳ của chợ đúng 1 bản ghi.
    c.p.collection = rec;
    U.log('Hoàn tất thu & chuyển đối soát kỳ ' + ttPeriodLabel(c.p) + ' tại ' + c.market);
    A.save(); A.closeModal(); A.render();
    A.modal(A.mHead('Đã hoàn tất thu') + `<div class="modal-b tt-pay"><div class="tt-success">✓ ĐÃ HOÀN TẤT THU &amp; CHUYỂN ĐỐI SOÁT</div>
      <p>Kỳ thu ${U.esc(ttPeriodLabel(c.p))} tại ${U.esc((U.market(c.market) || {}).name || c.market)} đã hoàn tất thu. Vui lòng bàn giao tiền mặt đã thu cho Kế toán Trung tâm để đối soát.</p>
      <dl class="tt-sum"><div><dt>Trạng thái</dt><dd>${ttTag('Chờ đối soát', 'warn')}</dd></div><div><dt>Đối soát</dt><dd>${rcStatusTag(rec)}</dd></div>
        <div><dt>Đã thu</dt><dd>${c.s.paid} / ${c.s.total} khoản</dd></div><div class="is-total"><dt>Tiền mặt bàn giao</dt><dd>${U.money(col.cash)}</dd></div></dl>
      <div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`);
  };

  // ==================== ĐỐI SOÁT THU TIỀN (Kế toán Trung tâm · theo kỳ của từng chợ) ====================
  // Nguồn DUY NHẤT: marketPeriod.collection — snapshot "Hoàn tất thu & chuyển đối soát" do NV thu phí tạo. Kế toán đối chiếu
  // (1) tiền mặt thực nhận với tiền mặt hệ thống và (2) tiền vào tài khoản ngân hàng (sao kê) với chuyển khoản hệ thống.
  // BR-02: chỉ khi CẢ HAI khớp 100% → RECONCILED (= chợ Hoàn tất). Thiếu/Thừa/lệch sao kê → NEEDS_RESOLUTION: Kế toán
  // xử lý chênh lệch (bổ sung/hoàn tiền, kiểm tra sao kê) rồi ghi lần đối soát tiếp theo kèm giải trình; mọi lần đều lưu
  // lịch sử. Không tạo Công nợ, không sửa payment/biên lai, không chốt kỳ. Route giữ id 'theo-doi-ky-doi-soat'.
  const rcCanView = () => U.can('theo-doi-ky-doi-soat');
  const rcInScope = market => A.allowedMarkets(A.currentAccount()).indexOf(market) !== -1;
  // Màn liên chợ (topbar ẩn): quyền action không gắn chợ + chợ thuộc phạm vi tài khoản + bản ghi còn được đối soát.
  const rcCanConfirm = (market, p) => rcCanView() && rcInScope(market) && A.canDo('theo-doi-ky-doi-soat.xac-nhan-hoan-tat') && (!p || MP().canReconcile(p));
  const rcKey = (periodId, market) => periodId + '|' + market;
  function rcMarkets() {
    const allowed = new Set(A.allowedMarkets(A.currentAccount()));
    return MP().activeMarkets().filter(m => allowed.has(m.id));
  }
  const rcMonths = () => MP().months();
  function rcDefaultMonth() {
    const months = rcMonths(), markets = rcMarkets();
    return months.find(m => markets.some(x => { const p = MP().get(x.id, m); return p && p.collection && MP().reconStatus(p) !== 'RECONCILED'; })) || months[0] || '';
  }
  function rcCollectorName(r, market) {
    if (r && (r.collectorName || r.completedBy)) return r.collectorName || r.completedBy;
    const col = A.ACCOUNTS.getMarketCollector ? A.ACCOUNTS.getMarketCollector(market) : null;
    return col ? col.fullName : '—';
  }
  // Mỗi dòng = 1 chợ trong tháng đang lọc (chợ chưa hoàn tất thu vẫn hiện để Kế toán thấy đủ các chợ).
  function rcRows(month) {
    return rcMarkets().map(m => {
      const p = MP().get(m.id, month), r = ttHandoff(p, m.id), rs = r ? rcStatus(r) : '';
      return { p, m, r, bucket: !r ? 'OPEN' : rs, collectorName: rcCollectorName(r, m.id), state: MP().stateOf(m.id, month) };
    });
  }
  function rcFind(periodId, market) {
    const p = A.periods.getById(periodId);
    return p && p.marketId === market && rcInScope(market) ? { p, m: U.market(market) || { id: market, name: market }, r: ttHandoff(p, market) } : null;
  }
  function rcEval(system, raw) {
    const v = String(raw == null ? '' : raw).trim() === '' ? NaN : Number(raw);
    if (!Number.isFinite(v) || v < 0 || Math.round(v) !== v) return { valid: false };
    const diff = v - system;
    return { valid: true, actual: v, diff, result: diff === 0 ? 'MATCHED' : diff < 0 ? 'SHORTAGE' : 'SURPLUS' };
  }
  function rcDiffHtml(ev) {
    if (!ev.valid) return '<div class="rc-diff"><span class="muted">Nhập số tiền mặt thực tế nhận để hệ thống tính chênh lệch.</span></div>';
    const sign = ev.diff > 0 ? '+' : ev.diff < 0 ? '−' : '';
    if (ev.result === 'MATCHED') return `<div class="rc-diff is-ok"><b>✓ ĐỦ</b><span>Chênh lệch: <b>0 đ</b></span></div>`;
    return `<div class="rc-diff ${ev.result === 'SHORTAGE' ? 'is-bad' : 'is-warn'}"><b>⚠ ${ev.result === 'SHORTAGE' ? 'THIẾU' : 'THỪA'}</b><span>Chênh lệch: <b>${sign}${U.money(Math.abs(ev.diff))}</b> · cần xử lý trước khi hoàn tất đối soát</span></div>`;
  }
  // Kết quả tổng của 1 lần đối soát: khớp 100% khi cả tiền mặt lẫn sao kê chuyển khoản không lệch.
  const rcOutcome = (ev, bc) => !ev.valid ? null : ev.diff === 0 && bc.diff === 0 ? 'MATCHED' : ev.diff !== 0 ? ev.result : (bc.diff < 0 ? 'SHORTAGE' : 'SURPLUS');
  const rcSubmitLabel = (ev, bc) => rcOutcome(ev, bc) === 'MATCHED' ? 'Xác nhận đối soát khớp' : 'Ghi nhận chênh lệch cần xử lý';
  const rcSubmitOk = (ev, bc, note) => ev.valid && (rcOutcome(ev, bc) === 'MATCHED' || !!String(note || '').trim());
  function rcDraft(key) {
    if (!ui.rcDraft || ui.rcDraft.key !== key) ui.rcDraft = { key, actual: '', note: '' };
    return ui.rcDraft;
  }
  const rcSum = r => r.summary || {};
  // Số tiền của bản ghi: bản ghi cashScope PERIOD_ONLY dùng snapshot; bản ghi cũ có danh sách payment thì loại payment thu nợ legacy.
  function rcFigures(r) {
    const sm = rcSum(r);
    if (sm.cashScope === 'PERIOD_ONLY' || !Array.isArray(sm.cashPaymentIds) || !Array.isArray(sm.transferPaymentIds)) {
      const cash = Number(sm.cash || 0), transfer = Number(sm.transfer || 0);
      return { cash, transfer, collected: sm.cashScope === 'PERIOD_ONLY' ? cash + transfer : Number(sm.collected || 0), transferCount: sm.transferCount != null ? sm.transferCount : (sm.transferPaymentIds || []).length };
    }
    const own = ids => ids.map(id => A.db.payments.find(x => x.id === id)).filter(x => x && !x.debtId);
    const cp = own(sm.cashPaymentIds), tp = own(sm.transferPaymentIds), cash = U.sum(cp, x => x.amount), transfer = U.sum(tp, x => x.amount);
    return { cash, transfer, collected: cash + transfer, transferCount: tp.length };
  }
  // Đối soát chuyển khoản: chuyển khoản hệ thống (snapshot) so với tiền vào tài khoản ngân hàng của chợ cho các khoản của kỳ.
  function rcBankCheck(p, m, r) {
    const fig = rcFigures(r);
    if (rcStatus(r) === 'RECONCILED' && r.bankInflowAmount != null) return { system: fig.transfer, systemCount: fig.transferCount, bank: r.bankInflowAmount, bankCount: r.bankInflowCount, diff: r.bankInflowAmount - fig.transfer };
    const ids = new Set(MP().invoices(p).map(i => i.id)), ref = b => MP().invoices(p).some(i => String(b.ref || '').includes(i.id));
    const lines = (A.db.bank || []).filter(b => b.market === m.id && (ids.has(b.receivableId) || ref(b)) && !/^CHOSO CN-/.test(b.ref || ''));
    const bank = U.sum(lines, b => Number(b.amount || 0));
    return { system: fig.transfer, systemCount: fig.transferCount, bank, bankCount: lines.length, diff: bank - fig.transfer };
  }
  function rcBankHtml(bc) {
    const ok = bc.diff === 0, sign = bc.diff > 0 ? '+' : bc.diff < 0 ? '−' : '';
    return `<dl class="tt-sum"><div><dt>Chuyển khoản theo hệ thống</dt><dd>${U.money(bc.system)} <span class="small muted">· ${bc.systemCount || 0} giao dịch</span></dd></div><div><dt>Tiền vào tài khoản ngân hàng (sao kê)</dt><dd>${U.money(bc.bank)} <span class="small muted">· ${bc.bankCount || 0} giao dịch</span></dd></div></dl>
      <div class="rc-diff ${ok ? 'is-ok' : 'is-bad'}"><b>${ok ? '✓ KHỚP' : '⚠ CHÊNH LỆCH'}</b><span>Chênh lệch: <b>${sign}${U.money(Math.abs(bc.diff))}</b>${ok ? '' : ' · Kiểm tra lại sao kê ngân hàng'}</span></div>`;
  }
  const RC_RESULT_TEXT = r => (RC_RESULT[r] || [r || '—'])[0];
  function rcHistoryHtml(r) {
    const h = (r.reconciliationHistory || []).slice().reverse();
    if (!h.length) return '';
    return `<h4 class="tt-sec-title">Lịch sử đối soát</h4>${U.table([{ t: 'Thời gian' }, { t: 'Người đối soát' }, { t: 'Tiền mặt thực nhận', num: true }, { t: 'Chênh lệch TM', num: true }, { t: 'Chênh lệch CK', num: true }, { t: 'Kết quả' }, { t: 'Giải trình' }],
      h.map(x => `<tr><td class="nowrap">${U.esc(x.at || '')}</td><td>${U.esc(x.by || '')}</td><td class="num">${x.actualCashAmount == null ? '—' : U.money(x.actualCashAmount)}</td><td class="num">${U.money(x.differenceAmount || 0)}</td><td class="num">${U.money(x.transferDifferenceAmount || 0)}</td><td>${U.esc(RC_RESULT_TEXT(x.result))}</td><td>${x.note ? U.esc(x.note) : '<span class="muted">—</span>'}</td></tr>`))}`;
  }
  function rcDetailHtml(x) {
    const { p, m, r } = x, sm = rcSum(r), acc = A.currentAccount() || {}, done = rcStatus(r) === 'RECONCILED', can = rcCanConfirm(m.id, p);
    const fig = rcFigures(r), system = fig.cash, transfer = fig.transfer, bc = rcBankCheck(p, m, r);
    const draft = rcDraft(rcKey(p.id, m.id)), ev = rcEval(system, draft.actual), outcome = rcOutcome(ev, bc);
    const paid = sm.paidCount != null ? `${sm.paidCount}/${sm.receivables}` : '—';
    const needs = rcStatus(r) === 'NEEDS_RESOLUTION';
    const cashBlock = done
      ? `<dl class="tt-sum"><div><dt>Tiền mặt theo hệ thống</dt><dd>${U.money(r.systemCashAmount)}</dd></div><div><dt>Tiền mặt thực nhận</dt><dd>${U.money(r.actualCashAmount)}</dd></div></dl>
        ${rcDiffHtml({ valid: true, diff: 0, result: 'MATCHED' })}
        <dl class="tt-sum"><div><dt>Ghi chú đối soát</dt><dd>${r.note ? U.esc(r.note) : '<span class="muted">—</span>'}</dd></div></dl>`
      : can ? `${needs ? `<div class="note warn">Lần đối soát trước còn chênh lệch (${U.esc(RC_RESULT_TEXT(r.lastResult))}). Sau khi xử lý chênh lệch, ghi nhận lại số tiền mặt thực nhận và giải trình — chỉ khi khớp 100% mới hoàn tất.</div>` : ''}
        <dl class="tt-sum"><div class="is-total"><dt>Tiền mặt theo hệ thống</dt><dd>${U.money(system)}</dd></div></dl>
        <div class="field"><label for="rc-actual">Tiền mặt thực tế nhận (đ)</label><input id="rc-actual" class="input rc-actual" type="number" min="0" step="1000" inputmode="numeric" data-in="rc-actual" data-system="${system}" data-bankdiff="${bc.diff}" value="${U.esc(draft.actual)}" placeholder="${system}"></div>
        <div id="rc-diff-box">${rcDiffHtml(ev)}</div>
        <div class="field"><label for="rc-note">Giải trình / ghi chú đối soát <span id="rc-note-req" class="small ${outcome && outcome !== 'MATCHED' ? 'tt-err' : 'muted'}">${outcome && outcome !== 'MATCHED' ? '(bắt buộc khi có chênh lệch)' : '(không bắt buộc khi khớp)'}</span></label><textarea id="rc-note" class="input" rows="2" data-in="rc-note" placeholder="Lý do chênh lệch, cách xử lý, người bàn giao, ...">${U.esc(draft.note)}</textarea></div>`
      : `<dl class="tt-sum"><div class="is-total"><dt>Tiền mặt theo hệ thống</dt><dd>${U.money(system)}</dd></div></dl><div class="note info">${MP().isClosed(p) ? 'Kỳ thu đã chốt — bản ghi đối soát chỉ để tra cứu.' : 'Bạn chỉ có quyền xem bản ghi đối soát này.'}</div>`;
    return `<div class="modal-b tt-pay rc-modal">
      <div class="tt-pay-who"><b>${U.esc(m.name)}</b> · Kỳ ${U.esc(ttPeriodLabel(p))} ${rcStatusTag(r)}</div>
      <dl class="tt-sum"><div><dt>NV thu phí</dt><dd>${U.esc(rcCollectorName(r, m.id))}</dd></div><div><dt>Hoàn tất thu lúc</dt><dd>${U.esc(rcClosedAt(r) || '—')}</dd></div>
        <div><dt>Người đối soát</dt><dd>${U.esc(done ? r.reconciledBy || '—' : acc.fullName || acc.code || '—')}</dd></div>${done ? `<div><dt>Thời gian đối soát</dt><dd>${U.esc(r.reconciledAt || '')}</dd></div>` : ''}</dl>
      <h4 class="tt-sec-title">1. Kết quả thu đã chốt <span class="small muted">(chỉ xem)</span></h4>
      <dl class="tt-sum"><div><dt>Tổng khoản thu</dt><dd>${sm.receivables != null ? sm.receivables : '—'}</dd></div><div><dt>Đã thu</dt><dd>${paid}</dd></div>
        <div><dt>Tổng phải thu</dt><dd>${U.money(sm.amount || 0)}</dd></div><div><dt>Tổng đã thu</dt><dd>${U.money(fig.collected)}</dd></div>${sm.remaining ? `<div class="is-total"><dt>Còn phải thu</dt><dd>${U.money(sm.remaining)}</dd></div>` : ''}</dl>
      <h4 class="tt-sec-title">2. Phân theo phương thức</h4>
      <dl class="tt-sum"><div><dt>Tiền mặt</dt><dd>${U.money(system)}</dd></div><div><dt>Chuyển khoản</dt><dd>${U.money(transfer)}</dd></div><div class="is-total"><dt>Tổng</dt><dd>${U.money(system + transfer)}</dd></div></dl>
      <h4 class="tt-sec-title">3. Đối soát tiền mặt bàn giao</h4>${cashBlock}
      <h4 class="tt-sec-title">4. Đối soát chuyển khoản</h4>${rcBankHtml(bc)}
      ${rcHistoryHtml(r)}</div>
      <div class="modal-f"><button class="btn" data-act="close">${can ? 'Hủy' : 'Đóng'}</button>${can ? `<button id="rc-submit" class="btn primary" data-act="rc-review" data-period="${U.esc(p.id)}" data-market="${U.esc(m.id)}" ${rcSubmitOk(ev, bc, draft.note) ? '' : 'disabled'}>${rcSubmitLabel(ev, bc)}</button>` : ''}</div>`;
  }
  function rcOpen(periodId, market) {
    const x = rcFind(periodId, market);
    if (!rcCanView() || !x || !x.r) return U.toast('Không tìm thấy bản ghi đối soát trong phạm vi của bạn');
    A.modal(A.mHead('Đối soát thu tiền') + rcDetailHtml(x), true);
  }
  // ---------- Giao dịch ngân hàng cần tra soát (Kế toán Trung tâm, tại Đối soát thu tiền) ----------
  // Dòng sao kê UNMATCHED / AMOUNT_MISMATCH / NEEDS_REVIEW chặn "Hoàn tất thu" của chợ (market-period.collectionChecklist).
  // Kế toán đối chiếu khoản phải thu, xác nhận số tiền, ghi chú → MATCHED_MANUAL khi hợp lệ; mọi lần xử lý lưu log trên dòng
  // sao kê + nhật ký kiểm toán. Thu đủ, không thu một phần: số tiền sao kê phải bằng đúng số còn phải thu của khoản.
  const RC_BANK_REVIEW = ['UNMATCHED', 'AMOUNT_MISMATCH', 'NEEDS_REVIEW'];
  const RC_BANK_LABEL = { UNMATCHED: ['Chưa khớp', ''], AMOUNT_MISMATCH: ['Lệch số tiền', 'danger'], NEEDS_REVIEW: ['Cần tra soát', 'warn'], MATCHED: ['Khớp', 'ok'], MATCHED_AUTO: ['Khớp tự động', 'ok'], MATCHED_MANUAL: ['Khớp thủ công', 'ok'] };
  const rcBankTag = b => { const x = RC_BANK_LABEL[b.status] || [b.status || '—', '']; return `<span class="tag ${x[1]}">${U.esc(x[0])}</span>`; };
  const rcCanBankResolve = market => rcCanView() && rcInScope(market) && A.canDo('theo-doi-ky-doi-soat.xu-ly-ngan-hang');
  const rcBankPending = markets => { const ids = new Set(markets.map(m => m.id)); return (A.db.bank || []).filter(b => ids.has(b.market) && RC_BANK_REVIEW.includes(b.status)); };
  // Khoản phải thu có thể đối chiếu: khoản của chợ thuộc kỳ ĐANG THU (đã phát hành, chưa hoàn tất thu, chưa chốt) còn phải thu,
  // hoặc khoản mà dòng sao kê đã gắn payment trước đó.
  function rcBankCandidates(b) {
    const linked = b.paymentId && A.db.payments.find(x => x.id === b.paymentId);
    return (A.db.invoices || []).filter(i => A.receivableMarket(i) === b.market && i.billingStatus !== 'DRAFT'
      && ((linked && linked.invoiceId === i.id) || MP().canCollectInvoice(i)))
      .sort((x, y) => (String(b.ref || '').includes(y.id) ? 1 : 0) - (String(b.ref || '').includes(x.id) ? 1 : 0) || String(x.id).localeCompare(String(y.id)));
  }
  function rcBankCardHtml(markets) {
    const list = rcBankPending(markets);
    if (!list.length) return '';
    return `<div class="card"><div class="card-h"><h3>Giao dịch ngân hàng cần tra soát (${list.length})</h3><span class="small muted">Chợ còn giao dịch cần tra soát chưa thể Hoàn tất thu.</span></div><div class="card-b">${U.table([{ t: 'Ngày' }, { t: 'Chợ' }, { t: 'Số tiền', num: true }, { t: 'Nội dung chuyển khoản' }, { t: 'Trạng thái' }, { t: 'Thao tác' }],
      list.map(b => `<tr><td class="nowrap">${U.dmy(b.date)} ${U.esc(b.time || '')}</td><td>${U.esc((U.market(b.market) || {}).name || b.market)}</td><td class="num">${U.money(b.amount)}</td><td>${U.esc(b.ref || '—')}</td><td>${rcBankTag(b)}</td><td>${rcCanBankResolve(b.market) ? `<button class="btn sm primary" data-act="rc-bank-open" data-id="${U.esc(b.id)}">Xử lý</button>` : '<span class="small muted">Chỉ xem</span>'}</td></tr>`))}</div></div>`;
  }
  function rcBankOpen(id) {
    const b = (A.db.bank || []).find(x => x.id === id);
    if (!b || !rcCanBankResolve(b.market)) return U.toast('Bạn chưa được cấp quyền xử lý giao dịch ngân hàng của chợ này.');
    const d = ui.rcBankDraft && ui.rcBankDraft.id === id ? ui.rcBankDraft : (ui.rcBankDraft = { id, invoiceId: (rcBankCandidates(b)[0] || {}).id || '', amount: '', note: '' });
    const cands = rcBankCandidates(b), inv = cands.find(i => i.id === d.invoiceId), due = inv ? (inv.status === 'paid' ? 0 : A.U.due(inv)) : null;
    A.modal(A.mHead('Xử lý giao dịch ngân hàng cần tra soát') + `<div class="modal-b tt-pay">
      <dl class="tt-sum"><div><dt>Mã sao kê</dt><dd>${U.esc(b.id)}</dd></div><div><dt>Chợ</dt><dd>${U.esc((U.market(b.market) || {}).name || b.market)}</dd></div><div><dt>Ngày</dt><dd>${U.dmy(b.date)} ${U.esc(b.time || '')}</dd></div>
        <div class="is-total"><dt>Số tiền sao kê</dt><dd>${U.money(b.amount)}</dd></div><div><dt>Nội dung</dt><dd>${U.esc(b.ref || '—')}</dd></div><div><dt>Trạng thái</dt><dd>${rcBankTag(b)}</dd></div></dl>
      <div class="field"><label>Khoản phải thu đối chiếu *</label><select class="input" data-ch="rc-bank-invoice"><option value="">Chọn khoản phải thu</option>${cands.map(i => `<option value="${U.esc(i.id)}" ${i.id === d.invoiceId ? 'selected' : ''}>${U.esc(i.id)} · ${U.esc((A.idx.trader.get(i.traderId) || {}).name || i.traderId)} · còn ${U.money(i.status === 'paid' ? 0 : A.U.due(i))}</option>`).join('')}</select>${cands.length ? '' : '<div class="small tt-err">Không có khoản phải thu đang thu của chợ để đối chiếu.</div>'}</div>
      ${inv ? `<div class="small muted">Số còn phải thu của khoản: <b>${U.money(due)}</b>${due === Number(b.amount) ? ' · khớp số tiền sao kê' : ' · <span class="tt-err">khác số tiền sao kê</span>'}</div>` : ''}
      <div class="field"><label>Xác nhận số tiền sao kê (đ) *</label><input class="input" type="number" min="0" data-in="rc-bank-amount" value="${U.esc(d.amount)}" placeholder="${b.amount}"></div>
      <div class="field"><label>Ghi chú tra soát *</label><textarea class="input" rows="2" data-in="rc-bank-note" placeholder="Căn cứ đối chiếu, người xác nhận, ...">${U.esc(d.note)}</textarea></div>
      ${(b.log || []).length ? `<h4 class="tt-sec-title">Lịch sử</h4>${(b.log || []).map(l => `<div class="small">${U.esc(l.at || '')} · ${U.esc(l.actor || '')}: ${U.esc(l.text || '')}</div>`).join('')}` : ''}</div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="rc-bank-match" data-id="${U.esc(b.id)}">Xác nhận khớp thủ công</button></div>`, true);
  }
  A.ACT['rc-bank-open'] = el => { ui.rcBankDraft = null; rcBankOpen(el.dataset.id); };
  A.CH['rc-bank-invoice'] = el => { if (ui.rcBankDraft) { ui.rcBankDraft.invoiceId = el.value; rcBankOpen(ui.rcBankDraft.id); } };
  A.IN['rc-bank-amount'] = el => { if (ui.rcBankDraft) ui.rcBankDraft.amount = el.value; };
  A.IN['rc-bank-note'] = el => { if (ui.rcBankDraft) ui.rcBankDraft.note = el.value; };
  A.ACT['rc-bank-match'] = el => {
    const b = (A.db.bank || []).find(x => x.id === el.dataset.id), d = ui.rcBankDraft;
    if (!b || !d || d.id !== b.id) return U.toast('Không tìm thấy giao dịch ngân hàng.');
    if (!rcCanBankResolve(b.market)) return U.toast('Bạn chưa được cấp quyền xử lý giao dịch ngân hàng của chợ này.');
    if (!RC_BANK_REVIEW.includes(b.status)) return U.toast('Giao dịch không còn ở trạng thái cần tra soát.');
    const inv = rcBankCandidates(b).find(i => i.id === d.invoiceId);
    if (!inv) return U.toast('Vui lòng chọn khoản phải thu đối chiếu hợp lệ (thuộc kỳ đang thu của chợ).');
    const confirmed = String(d.amount).trim() === '' ? NaN : Number(d.amount), note = String(d.note || '').trim();
    if (!Number.isFinite(confirmed) || confirmed !== Number(b.amount)) return U.toast('Số tiền xác nhận phải đúng bằng số tiền sao kê ' + U.money(b.amount) + '.');
    if (!note) return U.toast('Vui lòng nhập ghi chú tra soát.');
    const acc = A.currentAccount() || {}, by = acc.fullName || acc.code || acc.id, at = nowStamp(), linked = b.paymentId && A.db.payments.find(x => x.id === b.paymentId && x.invoiceId === inv.id);
    let text;
    if (linked) {
      text = 'Xác nhận khớp thủ công với khoản ' + inv.id + ' (đã có giao dịch ' + linked.id + ')';
    } else {
      if (inv.status === 'paid') return U.toast('Khoản ' + inv.id + ' đã thu đủ bằng giao dịch khác — không thể khớp sao kê này.');
      if (Number(b.amount) !== A.U.due(inv)) return U.toast('Số tiền sao kê khác số còn phải thu ' + U.money(A.U.due(inv)) + ' — không ghi nhận thu một phần.');
      const pays = A.applyPayment([inv.id], Number(b.amount), 'ck', 'Kế toán Trung tâm (khớp thủ công)', { bankLine: b });
      if (pays.length !== 1 || inv.status !== 'paid') return U.toast('Không ghi nhận được thanh toán cho khoản ' + inv.id + '.');
      text = 'Khớp thủ công với khoản ' + inv.id + ' → ghi nhận giao dịch ' + pays[0].id + ' · biên lai ' + pays[0].receipt;
    }
    Object.assign(b, { status: 'MATCHED_MANUAL', matched: true, matchMethod: 'MANUAL', matchedBy: by, matchedById: acc.id, matchedAt: at, receivableId: inv.id, reviewNote: note, confirmedAmount: confirmed });
    b.log = (b.log || []).concat([{ at, actor: by, text: text + ' · ghi chú: ' + note }]);
    U.log('Tra soát giao dịch ngân hàng ' + b.id + ' (' + U.money(b.amount) + '): ' + text);
    ui.rcBankDraft = null; A.save(); A.closeModal(); A.render();
    U.toast('Đã khớp thủ công giao dịch ' + b.id + ' với khoản ' + inv.id + '.');
  };
  const RC_FILTERS = [['all', 'Tất cả'], ['WAITING', 'Chờ đối soát'], ['NEEDS_RESOLUTION', 'Cần xử lý chênh lệch'], ['RECONCILED', 'Đã đối soát']];
  function rcView() {
    const markets = rcMarkets(), months = rcMonths(), month = months.includes(ui.rcPeriod) ? ui.rcPeriod : rcDefaultMonth(), marketF = markets.some(m => m.id === ui.rcMarket) ? ui.rcMarket : 'all';
    const statusF = RC_FILTERS.some(x => x[0] === ui.rcStatus) ? ui.rcStatus : 'all', q = String(ui.rcSearch || '').trim().toLowerCase();
    const base = rcRows(month).filter(x => marketF === 'all' || x.m.id === marketF);
    const rows = base.filter(x => (statusF === 'all' || x.bucket === statusF) && (!q || [x.m.name, x.m.id, x.collectorName].join(' ').toLowerCase().includes(q)));
    const k = (label, value, cls) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value ${cls || ''}">${value}</div></div>`;
    const cnt = b => base.filter(x => x.bucket === b).length;
    const body = rows.map(x => {
      const sm = x.r ? rcFigures(x.r) : null, canAct = x.r && rcCanConfirm(x.m.id, x.p);
      const act = !x.r ? `<span class="small muted">${U.esc(x.state.label)}</span>`
        : `<button class="btn sm ${canAct ? 'primary' : ''}" data-act="rc-open" data-period="${U.esc(x.p.id)}" data-market="${U.esc(x.m.id)}">${canAct ? (x.bucket === 'NEEDS_RESOLUTION' ? 'Xử lý chênh lệch' : 'Đối soát') : 'Xem'}</button>`;
      const rcDay = x.r && rcStatus(x.r) === 'RECONCILED' && x.r.reconciledAt ? String(x.r.reconciledAt).split(' ')[0] : '';
      return `<tr><td><b>${U.esc(x.m.name)}</b></td><td>${U.esc(x.collectorName)}</td><td class="nowrap">${rcDay ? U.esc(rcDay) : '<span class="muted">—</span>'}</td>
        <td class="num">${sm ? U.money(sm.collected) : '—'}</td><td class="num">${sm ? U.money(sm.cash) : '—'}</td><td class="num">${sm ? U.money(sm.transfer) : '—'}</td>
        <td>${x.r ? rcStatusTag(x.r) : MP().stateTag(x.state)}</td><td class="nowrap">${act}</td></tr>`;
    });
    return `<div class="card"><div class="card-b"><h2 style="margin:0">Đối soát thu tiền</h2><div class="small muted">Đối chiếu và xác nhận số tiền do Nhân viên thu phí bàn giao từ các chợ. Chỉ khi tiền mặt và sao kê chuyển khoản khớp 100% mới hoàn tất đối soát.</div></div></div>
      <div class="kpis">${k('Tổng chợ', marketF === 'all' ? markets.length : 1)}${k('Chờ đối soát', cnt('WAITING'), cnt('WAITING') ? 'tt-bad' : '')}${k('Cần xử lý chênh lệch', cnt('NEEDS_RESOLUTION'), cnt('NEEDS_RESOLUTION') ? 'tt-bad' : '')}${k('Đã đối soát', cnt('RECONCILED'), 'tt-ok')}</div>
      ${rcBankCardHtml(marketF === 'all' ? markets : markets.filter(m => m.id === marketF))}
      <div class="card"><div class="card-b tt-toolbar">
        <label class="tt-f"><span>Kỳ thu</span><select class="input" data-ch="rc-period">${months.map(m => `<option value="${U.esc(m)}" ${m === month ? 'selected' : ''}>${U.esc(U.per(m))}</option>`).join('')}</select></label>
        <label class="tt-f"><span>Chợ</span><select class="input" data-ch="rc-market"><option value="all">Tất cả ${markets.length} chợ</option>${markets.map(m => `<option value="${m.id}" ${m.id === marketF ? 'selected' : ''}>${U.esc(m.name)}</option>`).join('')}</select></label>
        <div class="seg">${RC_FILTERS.map(s => `<button class="${statusF === s[0] ? 'on' : ''}" data-act="rc-status" data-id="${s[0]}">${s[1]}</button>`).join('')}</div>
        <input class="input tt-search" data-in="rc-search" value="${U.esc(ui.rcSearch || '')}" placeholder="Tìm theo chợ, nhân viên thu phí..."></div>
      <div class="card-b">${U.table([{ t: 'Chợ' }, { t: 'NV thu phí' }, { t: 'Ngày đối soát' }, { t: 'Tổng đã thu', num: true }, { t: 'Tiền mặt bàn giao', num: true }, { t: 'Chuyển khoản', num: true }, { t: 'Trạng thái' }, { t: 'Thao tác' }], body,
        { empty: 'Không có chợ phù hợp bộ lọc' })}
        <div class="small muted tt-foot">Bản ghi đối soát được tạo khi Nhân viên thu phí "Hoàn tất thu &amp; chuyển đối soát". Kế toán Trung tâm không thu tiền, không sửa giao dịch và không chốt kỳ.</div></div></div>`;
  }
  A.VIEWS['theo-doi-ky-doi-soat'] = function () {
    if (!rcCanView()) return '<div class="card"><div class="empty">Bạn chưa được cấp quyền xem màn Đối soát thu tiền.</div></div>';
    return rcView();
  };
  A.CH['rc-period'] = el => { ui.rcPeriod = el.value || ''; A.render(); };
  A.CH['rc-market'] = el => { ui.rcMarket = el.value || 'all'; A.render(); };
  A.ACT['rc-status'] = el => { ui.rcStatus = el.dataset.id || 'all'; A.render(); };
  A.IN['rc-search'] = el => { ui.rcSearch = el.value; A.render(); };
  A.ACT['rc-open'] = el => rcOpen(el.dataset.period, el.dataset.market);
  // Tính chênh lệch ngay khi nhập — cập nhật DOM tại chỗ, không render lại modal để giữ con trỏ.
  function rcSyncForm() {
    const d = ui.rcDraft, inp = A.$('#rc-actual');
    if (!d || !inp) return;
    const ev = rcEval(Number(inp.dataset.system), d.actual), bc = { diff: Number(inp.dataset.bankdiff || 0) }, outcome = rcOutcome(ev, bc), box = A.$('#rc-diff-box'), btn = A.$('#rc-submit'), req = A.$('#rc-note-req');
    if (box) box.innerHTML = rcDiffHtml(ev);
    if (btn) { btn.disabled = !rcSubmitOk(ev, bc, d.note); btn.textContent = rcSubmitLabel(ev, bc); }
    if (req) { const need = outcome && outcome !== 'MATCHED'; req.className = 'small ' + (need ? 'tt-err' : 'muted'); req.textContent = need ? '(bắt buộc khi có chênh lệch)' : '(không bắt buộc khi khớp)'; }
  }
  A.IN['rc-actual'] = el => { if (ui.rcDraft) { ui.rcDraft.actual = el.value; rcSyncForm(); } };
  A.IN['rc-note'] = el => { if (ui.rcDraft) { ui.rcDraft.note = el.value; rcSyncForm(); } };
  // Kiểm tra lại toàn bộ trong handler: quyền + phạm vi chợ + bản ghi còn được đối soát + số liệu nhập hợp lệ.
  function rcCommitContext(el) {
    const x = rcFind(el.dataset.period, el.dataset.market);
    if (!x || !x.r) return { err: 'Không tìm thấy bản ghi đối soát trong phạm vi của bạn' };
    if (rcStatus(x.r) === 'RECONCILED') return { err: 'Bản ghi đã đối soát khớp — không chỉnh sửa' };
    if (!rcCanConfirm(x.m.id, x.p)) return { err: MP().isClosed(x.p) ? 'Kỳ thu đã chốt — không đối soát thêm' : 'Bạn chưa được cấp quyền xác nhận đối soát thu tiền' };
    const fig = rcFigures(x.r), d = rcDraft(rcKey(x.p.id, x.m.id)), system = fig.cash, ev = rcEval(system, d.actual), bc = rcBankCheck(x.p, x.m, x.r), outcome = rcOutcome(ev, bc);
    if (!ev.valid) return { err: 'Vui lòng nhập số tiền mặt thực tế nhận hợp lệ' };
    if (outcome !== 'MATCHED' && !String(d.note || '').trim()) return { err: 'Có chênh lệch — bắt buộc nhập giải trình' };
    return Object.assign(x, { d, ev, bc, outcome, system, transfer: fig.transfer, collected: fig.collected, acc: A.currentAccount() || {} });
  }
  A.ACT['rc-review'] = el => {
    const c = rcCommitContext(el);
    if (c.err) return U.toast(c.err);
    const matched = c.outcome === 'MATCHED', res = RC_RESULT[c.outcome];
    A.modal(A.mHead(matched ? 'Xác nhận đối soát khớp' : 'Ghi nhận chênh lệch cần xử lý') + `<div class="modal-b tt-pay">
      <div class="tt-pay-who"><b>${U.esc(c.m.name)}</b> · Kỳ ${U.esc(ttPeriodLabel(c.p))}<div class="small muted">NV bàn giao: ${U.esc(rcCollectorName(c.r, c.m.id))}</div></div>
      <dl class="tt-sum"><div><dt>Tổng đã thu</dt><dd>${U.money(c.collected)}</dd></div><div><dt>Tiền mặt theo hệ thống</dt><dd>${U.money(c.system)}</dd></div>
        <div><dt>Tiền mặt thực nhận</dt><dd>${U.money(c.ev.actual)}</dd></div><div><dt>Chênh lệch tiền mặt</dt><dd>${c.ev.diff > 0 ? '+' : c.ev.diff < 0 ? '−' : ''}${U.money(Math.abs(c.ev.diff))}</dd></div>
        <div><dt>Chuyển khoản hệ thống / sao kê</dt><dd>${U.money(c.bc.system)} / ${U.money(c.bc.bank)}</dd></div><div><dt>Chênh lệch chuyển khoản</dt><dd>${c.bc.diff > 0 ? '+' : c.bc.diff < 0 ? '−' : ''}${U.money(Math.abs(c.bc.diff))}</dd></div>
        <div class="is-total"><dt>Kết quả</dt><dd><span class="tag ${res[1]}">${res[0].toUpperCase()}</span></dd></div><div><dt>Giải trình</dt><dd>${c.d.note ? U.esc(c.d.note) : '<span class="muted">—</span>'}</dd></div></dl>
      <div class="note" style="margin-top:12px">${matched ? 'Kết quả khớp 100% được lưu vết và không chỉnh sửa. Chợ được tính là Hoàn tất đối soát.' : 'Đối soát CHƯA hoàn tất: bản ghi chuyển sang "Cần xử lý chênh lệch". Sau khi xử lý, ghi nhận lại đến khi khớp 100%.'}</div></div>
      <div class="modal-f"><button class="btn" data-act="rc-open" data-period="${U.esc(c.p.id)}" data-market="${U.esc(c.m.id)}">Hủy</button><button class="btn primary" data-act="rc-commit" data-period="${U.esc(c.p.id)}" data-market="${U.esc(c.m.id)}">${matched ? 'Xác nhận đối soát khớp' : 'Ghi nhận chênh lệch'}</button></div>`);
  };
  A.ACT['rc-commit'] = el => {
    const c = rcCommitContext(el);
    if (c.err) { U.toast(c.err); A.closeModal(); A.render(); return; }
    const at = nowStamp(), by = c.acc.fullName || c.acc.code || c.acc.id, matched = c.outcome === 'MATCHED';
    const attempt = { at, by, byId: c.acc.id, result: c.outcome, systemCashAmount: c.system, actualCashAmount: c.ev.actual, differenceAmount: c.ev.diff,
      transferAmount: c.transfer, bankInflowAmount: c.bc.bank, bankInflowCount: c.bc.bankCount, transferDifferenceAmount: c.bc.diff, note: String(c.d.note || '').trim() };
    c.r.reconciliationHistory = (c.r.reconciliationHistory || []).concat([attempt]);
    const handover = c.r.summary && c.r.summary.cashHandoverId && cashHandovers().find(h => h.id === c.r.summary.cashHandoverId);
    if (handover) Object.assign(handover, { actualAmount: c.ev.actual, reconciledAt: at, reconciledBy: by,
      status: matched ? 'RECONCILED' : 'NEEDS_RESOLUTION', differenceAmount: c.ev.diff });
    if (matched) {
      Object.assign(c.r, { reconciliationStatus: 'RECONCILED', result: 'MATCHED', reconciledAt: at, reconciledBy: by, reconciledById: c.acc.id, reconciledByCode: c.acc.code || '',
        systemCashAmount: c.system, actualCashAmount: c.ev.actual, transferAmount: c.transfer, totalCollectedAmount: c.collected, differenceAmount: 0,
        bankInflowAmount: c.bc.bank, bankInflowCount: c.bc.bankCount, transferDifferenceAmount: 0, note: attempt.note });
    } else {
      Object.assign(c.r, { reconciliationStatus: 'NEEDS_RESOLUTION', lastResult: c.outcome, lastAttemptAt: at });
    }
    ui.rcDraft = null;
    U.log('Đối soát thu tiền ' + c.m.id + ' kỳ ' + ttPeriodLabel(c.p) + ': ' + (matched ? 'KHỚP — hoàn tất đối soát' : c.outcome + ' (TM ' + U.money(c.ev.diff) + ', CK ' + U.money(c.bc.diff) + ') — cần xử lý chênh lệch'));
    if (matched && A.NOTIFICATIONS && A.NOTIFICATIONS.dispatchEvent) A.NOTIFICATIONS.dispatchEvent('RECONCILIATION_COMPLETED', { market: c.m.id, period: c.p });
    A.save(); A.render(); rcOpen(c.p.id, c.m.id);
    U.toast(matched ? 'Đã hoàn tất đối soát ' + c.m.name + ' kỳ ' + ttPeriodLabel(c.p) + ' — khớp 100%' : 'Đã ghi nhận chênh lệch ' + RC_RESULT[c.outcome][0].toLowerCase() + ' — đối soát chưa hoàn tất');
  };
})(window.APP);
