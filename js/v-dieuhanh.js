

/* Màn hình điều hành: Tổng quan liên chợ, Sơ đồ mặt bằng, Phiên chợ quê. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const TTD_SESSION_MARKET = 'TTD';
  const TTD_DEMO_SESSION_DATE = '2026-09-12';
  const SESSION_STATUS = {
    draft: 'Bản nháp',
    open: 'Mở đăng ký',
    registration_closed: 'Đã chốt danh sách',
    preparing: 'Đang chuẩn bị',
    live: 'Đang diễn ra',
    pending_close: 'Chờ chốt phiên',
    closed: 'Đã chốt',
    postponed: 'Tạm hoãn',
    cancelled: 'Đã hủy'
  };
  const SESSION_PROGRESS_STEPS = [
    { key: 'created', label: 'Tạo phiên' },
    { key: 'registration', label: 'Đăng ký & chốt danh sách' },
    { key: 'ops', label: 'Điểm danh & điều phối' },
    { key: 'live', label: 'Đang diễn ra' },
    { key: 'close', label: 'Chốt phiên' }
  ];
  const SESSION_PROGRESS_INDEX = { draft: 0, open: 1, registration_closed: 1, preparing: 2, live: 3, pending_close: 4, closed: 4 };
  const SESSION_TRANSITIONS = {
    draft: { open: 'phien-cho.mo-dang-ky', cancelled: 'phien-cho.huy-phien' },
    open: { registration_closed: 'phien-cho.chot-danh-sach', postponed: 'phien-cho.hoan-phien', cancelled: 'phien-cho.huy-phien' },
    registration_closed: { preparing: 'phien-cho.bat-dau-chuan-bi', postponed: 'phien-cho.hoan-phien', cancelled: 'phien-cho.huy-phien' },
    preparing: { live: 'phien-cho.bat-dau-phien', postponed: 'phien-cho.hoan-phien', cancelled: 'phien-cho.huy-phien' },
    live: { pending_close: 'phien-cho.cho-chot' },
    pending_close: { closed: 'phien-cho.chot-phien' },
    postponed: { open: 'phien-cho.mo-dang-ky', cancelled: 'phien-cho.huy-phien' }
  };
  const SESSION_ACTION_LABEL = {
    open: 'Mở đăng ký',
    registration_closed: 'Chốt danh sách',
    preparing: 'Bắt đầu chuẩn bị',
    live: 'Bắt đầu phiên',
    pending_close: 'Chuyển chờ chốt',
    postponed: 'Tạm hoãn',
    cancelled: 'Hủy phiên'
  };
  const ATTENDANCE_STATUS = {
    pending: 'Chưa điểm danh',
    present: 'Có mặt',
    late_notified: 'Xin đến trễ',
    late_arrived: 'Đã đến trễ',
    absent_excused: 'Vắng có báo',
    absent_unexcused: 'Vắng không báo'
  };
  const ATTENDANCE_FILTERS = [
    ['needs_action', 'Cần xử lý'],
    ['attended', 'Đã có mặt'],
    ['absent', 'Vắng mặt'],
    ['all', 'Tất cả']
  ];

  function nowIso() { return new Date().toISOString(); }
  function currentAccountId() { const a = A.currentAccount && A.currentAccount(); return a ? a.id : null; }
  function currentAccountName() { const a = A.currentAccount && A.currentAccount(); return a ? a.fullName : 'Không rõ'; }
  function sessionIdForDate(date) { return 'PC-TTD-' + String(date || '').replace(/-/g, ''); }
  function sessionDateFilter() { return ui.sessionDateFilter || U.today(); }
  function sessionLabel(s) { return U.dmy(s && s.date); }
  function sessionShortLabel(s) { return sessionLabel(s).slice(0, 5); }
  function hasClosingMetrics(s) {
    return !!(s && (s.booths != null || s.fee != null || s.visitors != null || s.revenue != null || s.noncash != null));
  }
  function sessionReadModel(s) {
    if (!s || !s.date) return null;
    const status = s.status || (hasClosingMetrics(s) ? 'closed' : 'draft');
    return Object.assign({}, s, {
      id: s.id || sessionIdForDate(s.date),
      market: s.market || TTD_SESSION_MARKET,
      status
    });
  }
  function ttdSessionReadModels() {
    return A.db.sessions.map(sessionReadModel).filter(s => s && s.market === TTD_SESSION_MARKET);
  }
  function formatNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('vi-VN') : '—';
  }
  function formatMoney(value) {
    const n = Number(value);
    return Number.isFinite(n) ? U.money(n) : '—';
  }
  function formatMoneyShort(value) {
    const n = Number(value);
    return Number.isFinite(n) ? U.moneyShort(n) : '—';
  }
  function formatPct(value) {
    const n = Number(value);
    return Number.isFinite(n) ? U.pctTxt(n * 100) : '—';
  }
  function formatTimeRange(s) {
    return s && s.startTime && s.endTime ? U.esc(s.startTime) + '–' + U.esc(s.endTime) : 'Chưa thiết lập';
  }
  function formatDeadline(s) {
    if (!s || !s.registrationDeadline) return 'Chưa thiết lập';
    const raw = String(s.registrationDeadline);
    return U.dmy(raw.slice(0, 10)) + (raw.length >= 16 ? ' ' + raw.slice(11, 16) : '');
  }
  function formatDateTimeValue(value, missingText) {
    if (!value) return missingText || '—';
    const raw = String(value);
    const d = parseLocalDateTime(raw);
    if (!d) return missingText || '—';
    return U.dmy(raw.slice(0, 10)) + (raw.length >= 16 ? ' ' + raw.slice(11, 16) : '');
  }
  function normalizeSession(s) {
    if (!s || !s.date) return s;
    if (!s.id) s.id = sessionIdForDate(s.date);
    if (!s.market) s.market = TTD_SESSION_MARKET;
    if (!s.status) s.status = (s.booths != null || s.fee != null || s.visitors != null || s.revenue != null || s.noncash != null) ? 'closed' : 'draft';
    if (!s.startTime) s.startTime = '14:00';
    if (!s.endTime) s.endTime = '20:00';
    if (!s.registrationDeadline) s.registrationDeadline = registrationDeadlineForDate(s.date);
    return s;
  }
  function ttdSessionPricing(mid) {
    const services = A.SERVICE_CFG && A.SERVICE_CFG.list ? (A.SERVICE_CFG.list('extraServices') || []) : [];
    return {
      unitPrice: D.SESSION_FEE,
      additionalFees: services.filter(x => x.marketId === mid && x.status === 'active').map(x => ({ name: x.name, amount: x.amount || 0, sourceId: x.id })),
      source: 'DATA.SESSION_FEE'
    };
  }
  function syncOpenSessionToMiniApp(s) {
    if (!s || s.market !== TTD_SESSION_MARKET || s.status !== 'open') return;
    A.db.marketSessions = A.db.marketSessions || [];
    A.db.sessionNotifications = A.db.sessionNotifications || [];
    const points = ttdBusinessPoints() || [];
    const cats = Array.from(new Set(points.filter(p => U.rentalKind(p) === 'session').map(p => p.cat).filter(Boolean))).slice(0, 4);
    const pricing = ttdSessionPricing(TTD_SESSION_MARKET);
    let ms = A.db.marketSessions.find(x => x.id === s.id);
    if (!ms) {
      ms = { id: s.id, code: s.id, marketId: TTD_SESSION_MARKET };
      A.db.marketSessions.push(ms);
    }
    Object.assign(ms, {
      code: s.id, marketId: TTD_SESSION_MARKET,
      name: 'Phiên chợ quê thứ Bảy ' + U.dmy(s.date),
      sessionDate: s.date, startTime: s.startTime || '14:00', endTime: s.endTime || '20:00',
      registrationOpenAt: U.today(),
      registrationCloseAt: [(s.registrationDeadline || '').slice(0, 10), U.today(), s.date].filter(Boolean).sort().slice(-1)[0],
      totalStalls: Math.max(1, Math.min(points.filter(p => U.rentalKind(p) === 'session').length || 24, 99)),
      maxStallsPerMerchant: 2,
      allowedBusinessCategories: cats.length ? cats : ['Ẩm thực', 'Nông sản', 'Thủ công'],
      pricingConfig: { unitPrice: pricing.unitPrice, additionalFees: pricing.additionalFees, source: pricing.source },
      cashPaymentEnabled: true, onlinePaymentEnabled: true, waitingListEnabled: true,
      status: 'REGISTRATION_OPEN', createdBy: s.createdBy || currentAccountName(), createdAt: s.createdAt || U.today(),
      updatedBy: currentAccountName(), updatedAt: U.today()
    });
    if (!A.db.sessionNotifications.some(n => n.sessionId === s.id && n.kind === 'SESSION_REGISTRATION_OPEN')) {
      A.db.sessionNotifications.unshift({
        id: 'SN-' + s.id + '-OPEN',
        sessionId: s.id, marketId: TTD_SESSION_MARKET, kind: 'SESSION_REGISTRATION_OPEN',
        at: U.today(), channels: ['Mini app'],
        text: 'Phiên chợ quê ' + U.dmy(s.date) + ' đã mở đăng ký. Tiểu thương có thể đăng ký quầy theo phiên.'
      });
    }
    A.db.notifications = A.db.notifications || [];
    if (!A.db.notifications.some(n => n.sessionId === s.id && n.kind === 'SESSION_REGISTRATION_OPEN')) {
      A.db.notifications.unshift({
        id: 'TB-' + U.pad(32 + A.db.notifications.length, 3), at: U.today(),
        title: 'Phiên chợ quê ' + U.dmy(s.date) + ' đã mở đăng ký',
        group: U.market(TTD_SESSION_MARKET).short, channels: ['Mini app'], sent: 1, delivered: 1, read: 0, auto: true,
        kind: 'SESSION_REGISTRATION_OPEN', sessionId: s.id,
        text: 'Tiểu thương có thể đăng ký trong tab Đăng ký khi phiên còn mở.'
      });
    }
  }
  function ensureTtdSessions() { A.db.sessions.forEach(normalizeSession); }
  function sessionById(id) {
    return A.db.sessions.find(s => s && (s.id === id || (!s.id && s.date && sessionIdForDate(s.date) === id)));
  }
  function canHardDeleteSession(s) {
    if (!s || s.market !== TTD_SESSION_MARKET || !canDoSessionAction('phien-cho.huy-phien', s)) return false;
    const sid = s.id;
    const regIds = new Set((A.db.sessionRegistrations || []).filter(r => r.sessionId === sid).map(r => r.id));
    const hasMoney = (A.db.sessionPayments || []).some(p => p.sessionId === sid && p.status !== 'WAITING_PAYMENT' && p.status !== 'WAITING_COLLECTION')
      || (A.db.sessionReceipts || []).some(r => r.sessionId === sid)
      || (A.db.payments || []).some(p => p.sessionId === sid)
      || (A.db.bank || []).some(b => b.sessionId === sid || (b.sourceType === 'SESSION_REGISTRATION' && regIds.has(b.receivableId)));
    const hasOps = (A.db.sessionAttendances || []).some(a => a.sessionId === sid) || (A.db.sessionReplacements || []).some(r => r.sessionId === sid);
    return !hasMoney && !hasOps && s.status !== 'closed';
  }
  function activeTtdSession() {
    const focused = ui.sessionFocusId && sessionById(ui.sessionFocusId);
    if (focused && focused.market === TTD_SESSION_MARKET) return sessionReadModel(focused);
    const live = ttdSessionReadModels().filter(s => s.status !== 'closed' && s.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date));
    return live[0] || null;
  }
  function latestClosedSession(list) {
    return list.filter(s => s.status === 'closed').sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0] || null;
  }
  function hasSessionDate(date, excludeId) {
    return A.db.sessions.some(s => s && s.date === date && s.id !== excludeId);
  }
  function sessionByDate(date) {
    return ttdSessionReadModels().filter(s => s.date === date).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  }
  function registrationDeadlineForDate(date) {
    const d = parseIsoDate(date);
    if (!d) return '';
    d.setDate(d.getDate() - 2);
    return dateOnly(d) + 'T17:00';
  }
  function registrationStartForDate(date) {
    const d = parseIsoDate(date);
    if (!d) return '';
    d.setDate(d.getDate() - 5);
    return dateOnly(d) + 'T08:00';
  }
  function dateOnly(d) {
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  }
  function parseIsoDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
    const d = new Date(s + 'T00:00:00');
    return Number.isNaN(d.getTime()) || dateOnly(d) !== s ? null : d;
  }
  function parseLocalDateTime(s) {
    const d = new Date(String(s || ''));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function sessionStartDateTime(date, time) {
    const d = parseLocalDateTime(date + 'T' + time);
    return d;
  }
  function canTransition(from, to) {
    return !!(SESSION_TRANSITIONS[from] && SESSION_TRANSITIONS[from][to]);
  }
  function actionForTransition(from, to) {
    return canTransition(from, to) ? SESSION_TRANSITIONS[from][to] : null;
  }
  function canDoSessionAction(actionKey, session) {
    if (!session || session.market !== TTD_SESSION_MARKET || ui.market !== TTD_SESSION_MARKET) return false;
    return A.canDo(actionKey, session.market);
  }
  function ttdBusinessPoints() {
    if (typeof A.mbBusinessPointsForMarket !== 'function') return null;
    const points = A.mbBusinessPointsForMarket(TTD_SESSION_MARKET);
    if (!Array.isArray(points) || points.some(st => !st || st.market !== TTD_SESSION_MARKET)) return null;
    return points;
  }
  function ttdSessionEligiblePoints() {
    const points = ttdBusinessPoints();
    return points ? points.filter(st => st.traderId) : null;
  }
  function ttdSessionCanMutate(actionKey, session, showToast) {
    if (ui.market !== TTD_SESSION_MARKET) { if (showToast) U.toast('Phiên chợ quê chỉ áp dụng cho Chợ quê Tân Thuận Đông'); return false; }
    if (!U.can('phien-cho')) { if (showToast) U.toast('Màn Phiên chợ quê không hợp lệ trong ngữ cảnh hiện tại'); return false; }
    if (!session || session.market !== TTD_SESSION_MARKET) { if (showToast) U.toast('Không tìm thấy phiên TTD hợp lệ'); return false; }
    if (!A.canDo(actionKey, session.market)) { if (showToast) U.toast('Bạn không có quyền thao tác phiên này'); return false; }
    return true;
  }
  function sessionRegistrations() {
    return Array.isArray(A.db.sessionRegistrations) ? A.db.sessionRegistrations : [];
  }
  function ensureSessionRegistrationCollection() {
    if (!Array.isArray(A.db.sessionRegistrations)) A.db.sessionRegistrations = [];
    return A.db.sessionRegistrations;
  }
  function sessionAttendances() {
    return Array.isArray(A.db.sessionAttendances) ? A.db.sessionAttendances : [];
  }
  function ensureSessionAttendanceCollection() {
    if (!Array.isArray(A.db.sessionAttendances)) A.db.sessionAttendances = [];
    return A.db.sessionAttendances;
  }
  function sessionReplacements() {
    return Array.isArray(A.db.sessionReplacements) ? A.db.sessionReplacements : [];
  }
  function ensureSessionReplacementCollection() {
    if (!Array.isArray(A.db.sessionReplacements)) A.db.sessionReplacements = [];
    return A.db.sessionReplacements;
  }
  function registrationNow() {
    return parseLocalDateTime(A.__sessionRegistrationNow) || new Date();
  }
  function registrationWindowState(session, now) {
    const start = parseLocalDateTime(session && session.registrationStartAt);
    const end = parseLocalDateTime(session && session.registrationDeadline);
    if (!start || !end || start >= end) return { ok: false, reason: 'Cửa sổ đăng ký chưa hợp lệ' };
    const cur = now || registrationNow();
    if (cur < start) return { ok: false, reason: 'Chưa đến thời gian bắt đầu đăng ký' };
    if (cur > end) return { ok: false, reason: 'Đã quá hạn đăng ký' };
    return { ok: true, reason: 'ok' };
  }
  function registrationId(sessionId) {
    return 'REG-' + String(sessionId || 'TTD').replace(/[^A-Za-z0-9]/g, '') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }
  function registrationKey(r) {
    return (r && r.sessionId ? r.sessionId : '') + '|' + (r && r.pointId ? r.pointId : '');
  }
  function traderById(id) {
    return (A.idx && A.idx.trader && A.idx.trader.get(id)) || A.db.traders.find(t => t && t.id === id) || null;
  }
  function ttdRegistrationTraders() {
    const points = ttdBusinessPoints() || [];
    const ids = new Set(points.map(p => p.traderId).filter(Boolean));
    return A.db.traders.filter(t => t && t.market === TTD_SESSION_MARKET && ids.has(t.id)).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi'));
  }
  function ttdPointById(pointId) {
    const points = ttdBusinessPoints();
    if (!points) return null;
    return points.find(p => p && p.id === pointId) || null;
  }
  function activeRegistrationRows(session) {
    return sessionRegistrations().filter(r => r && r.sessionId === session.id && r.market === TTD_SESSION_MARKET && r.status !== 'rejected' && r.status !== 'withdrawn');
  }
  function registrationById(id) {
    return sessionRegistrations().find(r => r && r.id === id) || null;
  }
  function isOfficialRegistration(r) {
    return !!(r && r.listType === 'official' && (r.status === 'approved' || r.paymentWorkflowStatus === 'CONFIRMED'));
  }
  function registrationReadModels(session) {
    if (!session) return [];
    const points = ttdBusinessPoints() || [];
    const pointMap = new Map(points.map(p => [p.id, p]));
    const seenPoints = new Set();
    const seenTraders = new Set();
    return sessionRegistrations().filter(r => {
      if (!r || r.sessionId !== session.id || r.market !== TTD_SESSION_MARKET) return false;
      const trader = traderById(r.traderId);
      if (!trader || trader.market !== TTD_SESSION_MARKET) return false;
      if (r.status === 'registered' || r.status === 'rejected' || r.status === 'withdrawn') return !r.pointId || !!pointMap.get(r.pointId);
      if (isOfficialRegistration(r)) return !r.pointId || !!pointMap.get(r.pointId);
      if (r.status === 'waitlisted' || r.listType === 'waitlist') return !r.pointId || !!pointMap.get(r.pointId);
      return false;
    }).map(r => {
      const point = r.pointId ? pointMap.get(r.pointId) : null;
      const trader = traderById(r.traderId);
      const active = r.status !== 'rejected' && r.status !== 'withdrawn';
      const pointKey = registrationKey(r);
      const duplicatePoint = active && point && seenPoints.has(pointKey);
      const duplicateTrader = active && seenTraders.has(r.traderId);
      if (active && point) seenPoints.add(pointKey);
      if (active) seenTraders.add(r.traderId);
      return Object.assign({}, r, { point, trader, duplicate: duplicatePoint || duplicateTrader });
    }).filter(r => !r.duplicate);
  }
  function sessionRegistrationBuckets(session) {
    if (A.syncPaidSessionRegistrationsToOfficial) A.syncPaidSessionRegistrationsToOfficial();
    const rows = registrationReadModels(session);
    const pending = rows.filter(r => r.status === 'registered');
    const official = rows.filter(isOfficialRegistration);
    const waitlist = rows.filter(r => r.listType === 'waitlist' && r.status === 'waitlisted')
      .sort((a, b) => Number(a.waitlistOrder || 9999) - Number(b.waitlistOrder || 9999));
    const inactive = rows.filter(r => r.status === 'rejected' || r.status === 'withdrawn');
    return { rows, pending, official, waitlist, inactive };
  }
  function canManageRegistrations(session) {
    return !!(session && session.status === 'open' && canDoSessionAction('phien-cho.quan-ly-dang-ky', session));
  }
  function nextWaitlistOrder(session) {
    const used = activeRegistrationRows(session).filter(r => r.status === 'waitlisted' && Number.isFinite(Number(r.waitlistOrder)) && Number(r.waitlistOrder) > 0)
      .map(r => Number(r.waitlistOrder));
    return used.length ? Math.max.apply(null, used) + 1 : 1;
  }
  function registrationSnapshot() {
    return {
      had: Object.prototype.hasOwnProperty.call(A.db, 'sessionRegistrations'),
      value: A.db.sessionRegistrations,
      data: JSON.stringify(A.db.sessionRegistrations),
      log: Array.isArray(A.db.extraLog) ? A.db.extraLog.slice() : null
    };
  }
  function restoreRegistrationSnapshot(snap) {
    if (snap.had) A.db.sessionRegistrations = snap.value;
    else delete A.db.sessionRegistrations;
    if (snap.had && Array.isArray(snap.value) && snap.data) {
      snap.value.length = 0;
      JSON.parse(snap.data).forEach(x => snap.value.push(x));
    }
    if (snap.log) {
      A.db.extraLog.length = 0;
      snap.log.forEach(x => A.db.extraLog.push(x));
    }
  }
  function saveRegistrationMutation(logText, onSuccess) {
    try {
      U.log(logText);
      A.save();
    } catch (e) {
      return false;
    }
    if (onSuccess) onSuccess();
    return true;
  }
  function runRegistrationMutation(mutate, logText, onSuccess) {
    const snap = registrationSnapshot();
    ensureSessionRegistrationCollection();
    mutate(A.db.sessionRegistrations);
    if (!saveRegistrationMutation(logText, onSuccess)) {
      restoreRegistrationSnapshot(snap);
      U.toast('Không lưu được đăng ký phiên, dữ liệu đã được hoàn tác');
      return false;
    }
    return true;
  }
  function validateRegistrationManage(session, showToast) {
    if (!ttdSessionCanMutate('phien-cho.quan-ly-dang-ky', session, showToast)) return false;
    if (session.status !== 'open') { if (showToast) U.toast('Chỉ quản lý đăng ký khi phiên đang mở đăng ký'); return false; }
    return true;
  }
  function registrationOptions() {
    const traders = ttdRegistrationTraders();
    const points = (ttdBusinessPoints() || []).filter(p => p.traderId);
    return {
      trader: traders.map(t => `<option value="${t.id}">${U.esc(t.name)}${t.phone ? ' · ' + U.maskPhone(t.phone) : ''}</option>`).join(''),
      point: points.map(p => `<option value="${p.id}">${U.esc(p.code)} · ${U.esc(p.sectionName || '')} · ${U.esc(p.cat || '')}</option>`).join('')
    };
  }
  function validateRegistrationList(session) {
    const regs = sessionRegistrations().filter(r => r && r.sessionId === session.id && r.market === TTD_SESSION_MARKET);
    const active = regs.filter(r => r.status !== 'rejected' && r.status !== 'withdrawn');
    const traderSet = new Set(), pointSet = new Set(), waitSet = new Set();
    let officialCount = 0;
    for (const r of active) {
      const trader = traderById(r.traderId);
      if (!trader || trader.market !== TTD_SESSION_MARKET) return { ok: false, reason: 'Có đăng ký không liên kết tiểu thương TTD hợp lệ' };
      if (traderSet.has(r.traderId)) return { ok: false, reason: 'Có tiểu thương đăng ký trùng trong phiên' };
      traderSet.add(r.traderId);
      if (r.status === 'registered') return { ok: false, reason: 'Còn đăng ký chờ xử lý' };
      if (isOfficialRegistration(r)) {
        if (r.pointId) {
          const point = ttdPointById(r.pointId);
          if (!point) return { ok: false, reason: 'Danh sách chính thức có điểm không hợp lệ' };
          if (pointSet.has(r.pointId)) return { ok: false, reason: 'Có điểm chính thức bị trùng' };
          pointSet.add(r.pointId);
        }
        officialCount += 1;
      }
      if (r.status === 'waitlisted' || r.listType === 'waitlist') {
        const n = Number(r.waitlistOrder);
        if (!Number.isInteger(n) || n <= 0) return { ok: false, reason: 'Thứ tự dự bị không hợp lệ' };
        if (waitSet.has(n)) return { ok: false, reason: 'Thứ tự dự bị bị trùng' };
        waitSet.add(n);
        if (r.pointId && !ttdPointById(r.pointId)) return { ok: false, reason: 'Danh sách dự bị có điểm không hợp lệ' };
      }
    }
    if (officialCount === 0) return { ok: false, reason: 'Cần có ít nhất một hộ trong danh sách chính thức trước khi chốt.' };
    return { ok: true, reason: 'ok' };
  }
  function registrationStatusTag(status) {
    const labels = { registered: 'Đã đăng ký', approved: 'Đã duyệt', waitlisted: 'Dự bị', rejected: 'BQL từ chối', withdrawn: 'Hộ đã rút đăng ký' };
    const cls = status === 'approved' ? 'ok' : status === 'waitlisted' ? 'warn' : (status === 'rejected' || status === 'withdrawn') ? 'danger' : 'info';
    return `<span class="tag ${cls}">${labels[status] || U.esc(status || 'Không rõ')}</span>`;
  }
  function registrationTabKey(buckets) {
    const valid = { pending: 1, official: 1, waitlist: 1, inactive: 1 };
    let tab = ui.sessionRegistrationTab;
    if (!valid[tab]) tab = buckets.pending.length ? 'pending' : buckets.official.length ? 'official' : buckets.waitlist.length ? 'waitlist' : 'pending';
    return tab;
  }
  function registrationTabsHtml(tab, buckets) {
    const tabs = [
      ['pending', 'Chờ xử lý', buckets.pending.length],
      ['official', 'Chính thức', buckets.official.length],
      ['waitlist', 'Dự bị', buckets.waitlist.length],
      ['inactive', 'Không tham gia', buckets.inactive.length]
    ];
    return `<div class="session-reg-tabs">${tabs.map(t => `<button class="session-reg-tab ${tab === t[0] ? 'active' : ''}" data-act="session-registration-tab" data-tab="${t[0]}" type="button">${t[1]} <span>${t[2]}</span></button>`).join('')}</div>`;
  }
  function registrationListHtml(rows, mode, session, canManage) {
    const waitlist = mode === 'waitlist';
    const pending = mode === 'pending';
    const inactive = mode === 'inactive';
    const official = mode === 'official';
    const actionCol = canManage && !inactive && !official;
    const cols = waitlist
      ? [{ t: 'Thứ tự dự bị', num: true }, { t: 'Hộ/tiểu thương' }, { t: 'Điện thoại' }, { t: 'Nhu cầu đăng ký' }, { t: 'Thời điểm đăng ký' }, { t: 'Trạng thái' }, { t: 'Ghi chú' }]
      : inactive
        ? [{ t: 'STT', num: true }, { t: 'Hộ/tiểu thương' }, { t: 'Thời điểm đăng ký' }, { t: 'Trạng thái' }, { t: 'Ghi chú' }]
        : [{ t: 'STT', num: true }, { t: 'Hộ/tiểu thương' }, { t: 'Mã điểm dự kiến' }, { t: 'Khu chức năng' }, { t: 'Mặt hàng' }, { t: 'Thời điểm đăng ký' }, { t: 'Trạng thái' }, { t: 'Ghi chú' }];
    if (actionCol) cols.push({ t: 'Thao tác' });
    const body = rows.map((r, i) => {
      const point = r.point, trader = r.trader;
      const idx = waitlist ? (Number.isFinite(Number(r.waitlistOrder)) ? Number(r.waitlistOrder) : i + 1) : i + 1;
      const actions = actionCol ? `<td><div class="session-reg-actions">
        ${pending ? `<button class="btn sm primary" data-act="reg-approve-open" data-id="${r.id}">Duyệt chính thức</button><button class="btn sm" data-act="reg-waitlist" data-id="${r.id}">Chuyển dự bị</button><button class="btn sm" data-act="reg-reject-open" data-id="${r.id}">Khác: Từ chối</button>` : ''}
        ${waitlist ? `<button class="btn sm" data-act="reg-wait-up" data-id="${r.id}" title="Đưa lên" aria-label="Đưa lên">↑</button><button class="btn sm" data-act="reg-wait-down" data-id="${r.id}" title="Đưa xuống" aria-label="Đưa xuống">↓</button>` : ''}
        ${pending || waitlist ? `<button class="btn sm" data-act="reg-withdraw-open" data-id="${r.id}">Ghi nhận rút</button>` : ''}
      </div></td>` : '';
      const base = [`<td class="num">${idx}</td>`, `<td class="session-reg-name">${U.esc(trader ? trader.name : 'Không tìm thấy tiểu thương')}</td>`];
      const time = `<td>${formatDateTimeValue(r.registeredAt || r.createdAt, '—')}</td>`;
      const status = `<td>${registrationStatusTag(r.status)}</td>`;
      const note = `<td class="session-reg-note">${U.esc(r.note || '') || '—'}</td>`;
      if (waitlist) {
        const need = point ? `${point.sectionName || '—'} · ${point.cat || '—'}` : (r.requestedSectionId || '—');
        return `<tr>${base.join('')}<td>${U.maskPhone(trader && trader.phone)}</td><td>${U.esc(need)}</td>${time}${status}${note}${actions}</tr>`;
      }
      if (inactive) return `<tr>${base.join('')}${time}${status}${note}</tr>`;
      return `<tr>${base.join('')}<td>${U.esc(point ? point.code : (r.pointId || '—'))}</td><td>${U.esc(point ? point.sectionName : (r.requestedSectionId || '—'))}</td><td>${U.esc(point ? point.cat : '—')}</td>${time}${status}${note}${actions}</tr>`;
    });
    const empty = pending ? 'Chưa có đăng ký chờ xử lý.' : waitlist ? 'Chưa có hộ trong danh sách dự bị.' : inactive ? 'Chưa có đăng ký bị từ chối hoặc đã rút.' : 'Chưa có đăng ký chính thức.';
    return U.table(cols, body, { empty });
  }
  function attendanceId(sessionId, registrationId) {
    return 'ATT-' + String(sessionId || '').replace(/[^A-Za-z0-9]/g, '') + '-' + String(registrationId || '').replace(/[^A-Za-z0-9]/g, '');
  }
  function validAttendanceStatus(status) {
    return !!ATTENDANCE_STATUS[status] && status !== 'pending';
  }
  function attendanceStatusTag(status) {
    const cls = status === 'present' || status === 'late_arrived' ? 'ok' : status === 'late_notified' ? 'warn' : status === 'absent_excused' || status === 'absent_unexcused' ? 'danger' : 'info';
    return `<span class="tag ${cls}">${ATTENDANCE_STATUS[status] || ATTENDANCE_STATUS.pending}</span>`;
  }
  function attendanceRecordsFor(session, registrationId) {
    if (!session || !registrationId) return [];
    return sessionAttendances().filter(a => a && a.sessionId === session.id && a.registrationId === registrationId);
  }
  function attendanceTimestamp(value) {
    const d = parseLocalDateTime(value);
    return d ? d.getTime() : 0;
  }
  function attendanceFingerprint(a) {
    return ['status', 'checkedAt', 'arrivalAt', 'reason', 'note', 'createdBy', 'updatedBy']
      .map(k => String((a && a[k]) == null ? '' : a[k])).join('|');
  }
  function compareAttendanceRecord(a, b) {
    const au = attendanceTimestamp(a && a.updatedAt), bu = attendanceTimestamp(b && b.updatedAt);
    if (au !== bu) return au - bu;
    const ac = attendanceTimestamp(a && a.createdAt), bc = attendanceTimestamp(b && b.createdAt);
    if (ac !== bc) return ac - bc;
    const ai = String(a && a.id || ''), bi = String(b && b.id || '');
    if (ai !== bi) return ai < bi ? -1 : 1;
    const af = attendanceFingerprint(a), bf = attendanceFingerprint(b);
    if (af !== bf) return af < bf ? -1 : 1;
    return 0;
  }
  function canonicalAttendanceRecord(session, registrationId) {
    return attendanceRecordsFor(session, registrationId)
      .filter(a => a && ATTENDANCE_STATUS[a.status])
      .slice()
      .sort(compareAttendanceRecord)
      .pop() || null;
  }
  function attendanceRecordFor(session, registrationId) {
    return canonicalAttendanceRecord(session, registrationId);
  }
  function replacementId(sessionId, absentRegistrationId, replacementRegistrationId) {
    return 'REP-' + String(sessionId || '').replace(/[^A-Za-z0-9]/g, '') + '-' +
      String(absentRegistrationId || '').replace(/[^A-Za-z0-9]/g, '') + '-' +
      String(replacementRegistrationId || '').replace(/[^A-Za-z0-9]/g, '') + '-' + Date.now().toString(36);
  }
  function replacementFingerprint(r) {
    return ['absentRegistrationId', 'replacementRegistrationId', 'pointId', 'reason', 'status', 'assignedAt', 'cancelledAt', 'createdBy', 'updatedBy']
      .map(k => String((r && r[k]) == null ? '' : r[k])).join('|');
  }
  function compareReplacementRecord(a, b) {
    const au = attendanceTimestamp(a && a.updatedAt), bu = attendanceTimestamp(b && b.updatedAt);
    if (au !== bu) return au - bu;
    const ac = attendanceTimestamp(a && a.createdAt), bc = attendanceTimestamp(b && b.createdAt);
    if (ac !== bc) return ac - bc;
    const ai = String(a && a.id || ''), bi = String(b && b.id || '');
    if (ai !== bi) return ai < bi ? -1 : 1;
    const af = replacementFingerprint(a), bf = replacementFingerprint(b);
    if (af !== bf) return af < bf ? -1 : 1;
    return 0;
  }
  function activeReplacementRecordsFor(session, field, id) {
    if (!session || !id) return [];
    return sessionReplacements().filter(r => r && r.sessionId === session.id && r.market === TTD_SESSION_MARKET && r.status === 'active' && r[field] === id);
  }
  function canonicalReplacementFor(session, field, id) {
    return activeReplacementRecordsFor(session, field, id).slice().sort(compareReplacementRecord).pop() || null;
  }
  function canonicalAbsentReplacement(session, registrationId) {
    return canonicalReplacementFor(session, 'absentRegistrationId', registrationId);
  }
  function canonicalWaitlistReplacement(session, registrationId) {
    return canonicalReplacementFor(session, 'replacementRegistrationId', registrationId);
  }
  function replacementById(id) {
    return sessionReplacements().find(r => r && r.id === id) || null;
  }
  function officialAttendanceRegistrations(session) {
    const seen = new Set();
    return registrationReadModels(session).filter(r => {
      if (!r || r.sessionId !== session.id || r.market !== TTD_SESSION_MARKET) return false;
      if (r.status !== 'approved' || r.listType !== 'official') return false;
      if (!r.point || r.point.market !== TTD_SESSION_MARKET || !r.point.traderId) return false;
      const trader = traderById(r.point.traderId);
      if (!trader || trader.market !== TTD_SESSION_MARKET) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    }).map(r => {
      const trader = traderById(r.point.traderId);
      return Object.assign({}, r, { trader, traderId: trader.id });
    });
  }
  function waitlistReplacementRegistrations(session) {
    const seen = new Set();
    return registrationReadModels(session).filter(r => {
      if (!r || r.sessionId !== session.id || r.market !== TTD_SESSION_MARKET) return false;
      if (r.status !== 'waitlisted' || r.listType !== 'waitlist') return false;
      if (!r.trader || r.trader.market !== TTD_SESSION_MARKET) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }
  function officialRegistrationMap(session) {
    const map = new Map();
    officialAttendanceRegistrations(session).forEach(r => map.set(r.id, r));
    return map;
  }
  function activeTraderIdsInOfficial(session) {
    return new Set(officialAttendanceRegistrations(session).map(r => r.traderId));
  }
  function replacementReadModels(session) {
    if (!session) return [];
    const officialMap = officialRegistrationMap(session);
    const waitlistMap = new Map(waitlistReplacementRegistrations(session).map(r => [r.id, r]));
    const seenAbsent = new Set(), seenWaitlist = new Set();
    return sessionReplacements().slice().sort(compareReplacementRecord).reverse().filter(r => {
      if (!r || r.sessionId !== session.id || r.market !== TTD_SESSION_MARKET) return false;
      const absent = officialMap.get(r.absentRegistrationId);
      const repl = waitlistMap.get(r.replacementRegistrationId);
      if (!absent || !repl) return false;
      if (r.pointId !== absent.point.id) return false;
      if (r.replacementTraderId !== repl.trader.id || r.absentTraderId !== absent.trader.id) return false;
      if (r.status === 'active') {
        if (seenAbsent.has(r.absentRegistrationId) || seenWaitlist.has(r.replacementRegistrationId)) return false;
        seenAbsent.add(r.absentRegistrationId);
        seenWaitlist.add(r.replacementRegistrationId);
      }
      return r.status === 'active' || r.status === 'cancelled';
    }).map(r => ({
      record: r,
      absent: officialMap.get(r.absentRegistrationId),
      replacement: waitlistMap.get(r.replacementRegistrationId),
      point: officialMap.get(r.absentRegistrationId).point
    }));
  }
  function activeReplacementReadModels(session) {
    const byAbsent = new Map();
    replacementReadModels(session).filter(r => r.record.status === 'active').forEach(r => {
      const current = byAbsent.get(r.record.absentRegistrationId);
      if (!current || compareReplacementRecord(current.record, r.record) < 0) byAbsent.set(r.record.absentRegistrationId, r);
    });
    return Array.from(byAbsent.values());
  }
  function availableWaitlistForReplacement(session, absentRegistrationId) {
    const officialTraderIds = activeTraderIdsInOfficial(session);
    const activeReplIds = new Set(activeReplacementReadModels(session).map(r => r.record.replacementRegistrationId));
    const absent = officialAttendanceRegistrations(session).find(r => r.id === absentRegistrationId);
    return waitlistReplacementRegistrations(session).filter(r => {
      if (activeReplIds.has(r.id)) return false;
      if (absent && r.trader.id === absent.trader.id) return false;
      if (officialTraderIds.has(r.trader.id)) return false;
      return true;
    }).sort((a, b) => Number(a.waitlistOrder || 9999) - Number(b.waitlistOrder || 9999) || String(a.trader.name || '').localeCompare(String(b.trader.name || ''), 'vi'));
  }
  function attendanceReadModels(session) {
    if (!session) return [];
    const officialRows = officialAttendanceRegistrations(session).map((r, i) => {
      const rec = attendanceRecordFor(session, r.id);
      const status = rec && ATTENDANCE_STATUS[rec.status] ? rec.status : 'pending';
      const replacement = canonicalAbsentReplacement(session, r.id);
      return {
        index: i + 1,
        kind: 'official',
        session,
        registration: r,
        attendance: rec,
        status,
        checkedAt: rec && rec.checkedAt,
        arrivalAt: rec && rec.arrivalAt,
        reason: rec && rec.reason,
        note: rec && rec.note,
        point: r.point,
        trader: r.trader,
        replacement: replacement
      };
    });
    const replacementRows = activeReplacementReadModels(session).map((x, i) => {
      const r = x.replacement;
      const rec = attendanceRecordFor(session, r.id);
      const status = rec && ATTENDANCE_STATUS[rec.status] ? rec.status : 'pending';
      return {
        index: officialRows.length + i + 1,
        kind: 'replacement',
        session,
        registration: r,
        attendance: rec,
        status,
        checkedAt: rec && rec.checkedAt,
        arrivalAt: rec && rec.arrivalAt,
        reason: rec && rec.reason,
        note: rec && rec.note,
        point: x.point,
        trader: r.trader,
        absent: x.absent,
        replacementRecord: x.record
      };
    });
    return officialRows.concat(replacementRows);
  }
  function attendanceBuckets(rows) {
    const counts = { total: rows.filter(r => r.kind !== 'replacement').length, rows: rows.length, pending: 0, present: 0, late_notified: 0, late_arrived: 0, absent_excused: 0, absent_unexcused: 0 };
    rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    counts.attended = counts.present + counts.late_arrived;
    counts.needsAction = counts.pending + counts.late_notified;
    counts.absent = counts.absent_excused + counts.absent_unexcused;
    counts.processed = counts.attended + counts.absent;
    return counts;
  }
  function attendanceFilterKey(counts) {
    const map = { pending: 'needs_action', late: 'needs_action', present: 'attended', absent: 'absent', all: 'all', needs_action: 'needs_action', attended: 'attended' };
    const key = map[ui.sessionAttendanceTab];
    if (key) return key;
    return counts && counts.needsAction === 0 ? 'all' : 'needs_action';
  }
  function attendanceRowsForFilter(rows, filter) {
    if (filter === 'needs_action') return rows.filter(r => r.status === 'pending' || r.status === 'late_notified').slice().sort((a, b) => {
      const order = { pending: 0, late_notified: 1 };
      return (order[a.status] || 0) - (order[b.status] || 0) || a.index - b.index;
    });
    if (filter === 'attended') return rows.filter(r => r.status === 'present' || r.status === 'late_arrived');
    if (filter === 'absent') return rows.filter(r => r.status === 'absent_excused' || r.status === 'absent_unexcused');
    return rows;
  }
  function attendanceFilterCount(counts, filter) {
    if (filter === 'needs_action') return counts.needsAction;
    if (filter === 'attended') return counts.attended;
    if (filter === 'absent') return counts.absent;
    return counts.rows;
  }
  function attendanceEmptyText(filter) {
    if (filter === 'needs_action') return 'Không còn hộ cần điểm danh hoặc theo dõi đến trễ.';
    if (filter === 'attended') return 'Chưa ghi nhận hộ nào có mặt.';
    if (filter === 'absent') return 'Chưa ghi nhận hộ nào vắng mặt.';
    return 'Chưa có hộ chính thức để điểm danh.';
  }
  function replacementHistoryHtml(session) {
    const rows = replacementReadModels(session);
    if (!rows.length) return '';
    const body = rows.map((r, i) => `<tr>
      <td class="num">${i + 1}</td>
      <td>${U.esc(r.point.code)}<div class="small muted">${U.esc(r.point.sectionName || '—')} · ${U.esc(r.point.cat || '—')}</div></td>
      <td>${U.esc(r.absent.trader.name)}</td>
      <td>${U.esc(r.replacement.trader.name)}</td>
      <td class="session-reg-note">${U.esc(r.record.reason || '') || '—'}</td>
      <td>${U.esc(r.record.assignedBy || r.record.createdBy || '—')}<div class="small muted">${formatDateTimeValue(r.record.assignedAt || r.record.createdAt, '—')}</div></td>
      <td>${r.record.status === 'active' ? '<span class="tag ok">Đang thay</span>' : '<span class="tag">Đã hủy</span>'}${r.record.cancelReason ? `<div class="small muted">${U.esc(r.record.cancelReason)}</div>` : ''}</td>
    </tr>`);
    return `<div class="session-replacement-history">
      <h4>Điều phối dự bị</h4>
      ${U.table([{ t: 'STT', num: true }, { t: 'Điểm được thay' }, { t: 'Hộ chính thức vắng' }, { t: 'Hộ dự bị thay thế' }, { t: 'Lý do' }, { t: 'Người/thời điểm' }, { t: 'Trạng thái' }], body)}
    </div>`;
  }
  function canTakeAttendance(session) {
    return !!(session && session.status === 'preparing' && canDoSessionAction('phien-cho.diem-danh', session));
  }
  function canCoordinateReplacement(session) {
    return !!(session && session.status === 'preparing' && canDoSessionAction('phien-cho.dieu-phoi-du-bi', session));
  }
  function attendanceSnapshot() {
    return {
      had: Object.prototype.hasOwnProperty.call(A.db, 'sessionAttendances'),
      value: A.db.sessionAttendances,
      data: JSON.stringify(A.db.sessionAttendances),
      log: Array.isArray(A.db.extraLog) ? A.db.extraLog.slice() : null
    };
  }
  function restoreAttendanceSnapshot(snap) {
    if (snap.had) A.db.sessionAttendances = snap.value;
    else delete A.db.sessionAttendances;
    if (snap.had && Array.isArray(snap.value) && snap.data) {
      snap.value.length = 0;
      JSON.parse(snap.data).forEach(x => snap.value.push(x));
    }
    if (snap.log) {
      A.db.extraLog.length = 0;
      snap.log.forEach(x => A.db.extraLog.push(x));
    }
  }
  function replacementSnapshot() {
    return {
      had: Object.prototype.hasOwnProperty.call(A.db, 'sessionReplacements'),
      value: A.db.sessionReplacements,
      data: JSON.stringify(A.db.sessionReplacements),
      attendanceHad: Object.prototype.hasOwnProperty.call(A.db, 'sessionAttendances'),
      attendanceValue: A.db.sessionAttendances,
      attendanceData: JSON.stringify(A.db.sessionAttendances),
      log: Array.isArray(A.db.extraLog) ? A.db.extraLog.slice() : null
    };
  }
  function restoreReplacementSnapshot(snap) {
    if (snap.had) A.db.sessionReplacements = snap.value;
    else delete A.db.sessionReplacements;
    if (snap.had && Array.isArray(snap.value) && snap.data) {
      snap.value.length = 0;
      JSON.parse(snap.data).forEach(x => snap.value.push(x));
    }
    if (snap.attendanceHad) A.db.sessionAttendances = snap.attendanceValue;
    else delete A.db.sessionAttendances;
    if (snap.attendanceHad && Array.isArray(snap.attendanceValue) && snap.attendanceData) {
      snap.attendanceValue.length = 0;
      JSON.parse(snap.attendanceData).forEach(x => snap.attendanceValue.push(x));
    }
    if (snap.log) {
      A.db.extraLog.length = 0;
      snap.log.forEach(x => A.db.extraLog.push(x));
    }
  }
  function validateReplacementSession(session, showToast) {
    if (!ttdSessionCanMutate('phien-cho.dieu-phoi-du-bi', session, showToast)) return false;
    if (session.status !== 'preparing') { if (showToast) U.toast('Chỉ điều phối dự bị khi phiên đang chuẩn bị'); return false; }
    return true;
  }
  function validateReplacementTarget(session, absentRegistrationId, replacementRegistrationId, reason, showToast) {
    if (!validateReplacementSession(session, showToast)) return null;
    const absent = attendanceReadModels(session).find(r => r.kind === 'official' && r.registration.id === absentRegistrationId);
    if (!absent) { if (showToast) U.toast('Không tìm thấy hộ chính thức hợp lệ'); return null; }
    if (absent.status !== 'absent_excused' && absent.status !== 'absent_unexcused') {
      if (showToast) U.toast('Chỉ điều phối khi hộ chính thức đã được ghi nhận vắng mặt');
      return null;
    }
    if (canonicalAbsentReplacement(session, absent.registration.id)) { if (showToast) U.toast('Điểm này đã có hộ dự bị thay thế'); return null; }
    const waitlist = availableWaitlistForReplacement(session, absent.registration.id).find(r => r.id === replacementRegistrationId);
    if (!waitlist) { if (showToast) U.toast('Hộ dự bị không hợp lệ hoặc đã được điều phối'); return null; }
    if (canonicalWaitlistReplacement(session, waitlist.id)) { if (showToast) U.toast('Hộ dự bị này đang thay thế vị trí khác'); return null; }
    if (!String(reason || '').trim()) { if (showToast) U.toast('Vui lòng nhập lý do điều phối'); return null; }
    return { absent, waitlist };
  }
  function normalizeReplacementBusinessKey(session, rec) {
    A.db.sessionReplacements = ensureSessionReplacementCollection().filter(r => {
      if (!r || r === rec) return true;
      if (r.sessionId !== session.id) return true;
      if (rec.status === 'active' && r.status === 'active' && r.absentRegistrationId === rec.absentRegistrationId) return false;
      if (rec.status === 'active' && r.status === 'active' && r.replacementRegistrationId === rec.replacementRegistrationId) return false;
      return true;
    });
  }
  function runReplacementMutation(session, mutate, logText, onSuccess) {
    const snap = replacementSnapshot();
    ensureSessionReplacementCollection();
    try {
      const rec = mutate(A.db.sessionReplacements);
      if (rec) normalizeReplacementBusinessKey(session, rec);
      U.log(logText);
      A.save();
    } catch (e) {
      restoreReplacementSnapshot(snap);
      U.toast('Không lưu được điều phối dự bị, dữ liệu đã được hoàn tác');
      return false;
    }
    if (onSuccess) onSuccess();
    return true;
  }
  function validateAttendanceTarget(session, registrationId, status, reason, showToast) {
    if (!ttdSessionCanMutate('phien-cho.diem-danh', session, showToast)) return null;
    if (session.status !== 'preparing') { if (showToast) U.toast('Chỉ điểm danh khi phiên đang chuẩn bị'); return null; }
    if (!validAttendanceStatus(status)) { if (showToast) U.toast('Trạng thái điểm danh không hợp lệ'); return null; }
    const row = attendanceReadModels(session).find(r => r.registration.id === registrationId);
    if (!row) { if (showToast) U.toast('Không tìm thấy hộ chính thức hợp lệ để điểm danh'); return null; }
    if ((status === 'late_notified' || status === 'absent_excused') && !String(reason || '').trim()) {
      if (showToast) U.toast(status === 'late_notified' ? 'Vui lòng nhập lý do xin đến trễ' : 'Vui lòng nhập lý do vắng có báo');
      return null;
    }
    if (status === 'late_arrived' && row.status !== 'late_notified') {
      if (showToast) U.toast('Chỉ xác nhận đã đến trễ sau khi hộ đã báo đến trễ');
      return null;
    }
    return row;
  }
  function runAttendanceMutation(session, row, status, reason, note, onSuccess) {
    const snap = attendanceSnapshot();
    const list = ensureSessionAttendanceCollection();
    const existing = canonicalAttendanceRecord(session, row.registration.id);
    const prevStatus = existing && ATTENDANCE_STATUS[existing.status] ? existing.status : 'pending';
    const now = nowIso();
    const rec = existing || {
      id: attendanceId(session.id, row.registration.id),
      sessionId: session.id,
      registrationId: row.registration.id,
      market: TTD_SESSION_MARKET,
      traderId: row.trader.id,
      pointId: row.point.id,
      status: 'pending',
      checkedAt: null,
      arrivalAt: null,
      reason: '',
      note: '',
      createdAt: now,
      createdBy: currentAccountId(),
      updatedAt: now,
      updatedBy: currentAccountId()
    };
    if (!existing) list.push(rec);
    rec.traderId = row.trader.id;
    rec.pointId = row.point.id;
    rec.status = status;
    if (status === 'late_arrived') {
      rec.arrivalAt = now;
      rec.checkedAt = rec.checkedAt || now;
      if (reason) rec.reason = reason;
    } else {
      rec.checkedAt = now;
      rec.arrivalAt = null;
      rec.reason = reason || '';
    }
    rec.note = note || '';
    rec.updatedAt = now;
    rec.updatedBy = currentAccountId();
    A.db.sessionAttendances = list.filter(a => !(a && a.sessionId === session.id && a.registrationId === row.registration.id) || a === rec);
    try {
      U.log(`Điểm danh phiên ${session.id}: ${row.trader.name} / ${row.point.code} ${ATTENDANCE_STATUS[prevStatus]} -> ${ATTENDANCE_STATUS[status]}`);
      A.save();
    } catch (e) {
      restoreAttendanceSnapshot(snap);
      U.toast('Không lưu được điểm danh, dữ liệu đã được hoàn tác');
      return false;
    }
    if (onSuccess) onSuccess();
    return true;
  }
  function attendanceStatusOptions(current) {
    const base = [
      ['present', 'Có mặt'],
      ['late_notified', 'Xin đến trễ'],
      ['absent_excused', 'Vắng có báo'],
      ['absent_unexcused', 'Vắng không báo']
    ];
    if (current === 'late_notified') base.splice(2, 0, ['late_arrived', 'Đã đến trễ']);
    return base.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('');
  }
  function attendanceHtml(session) {
    if (!session || session.status !== 'preparing') return '';
    const rows = attendanceReadModels(session);
    const counts = attendanceBuckets(rows);
    const canManage = canTakeAttendance(session);
    const filter = attendanceFilterKey(counts);
    const shown = attendanceRowsForFilter(rows, filter);
    const tabs = ATTENDANCE_FILTERS.map(t => `<button class="session-attendance-tab ${filter === t[0] ? 'active' : ''}" data-act="session-attendance-tab" data-tab="${t[0]}" type="button">${t[1]} <span>${attendanceFilterCount(counts, t[0])}</span></button>`).join('');
    const k = (label, value, cls) => `<div class="session-attendance-kpi ${cls || ''}"><span>${label}</span><b>${value}</b></div>`;
    const body = shown.map((r, i) => {
      const time = r.status === 'late_arrived' ? (r.arrivalAt || r.checkedAt) : r.checkedAt;
      const replacement = r.kind === 'official' && r.replacement ? replacementReadModels(session).find(x => x.record.id === r.replacement.id) : null;
      const traderCell = r.kind === 'replacement'
        ? `<div><b>${U.esc(r.trader.name)}</b> <span class="tag ok">Hộ thay thế</span></div><div class="small muted">Thay hộ: ${U.esc(r.absent.trader.name)}</div>`
        : `<div><b>${U.esc(r.trader.name)}</b>${replacement ? ' <span class="tag ok">Đã có hộ thay</span>' : ''}</div>${replacement ? `<div class="small muted">Hộ thay thế: ${U.esc(replacement.replacement.trader.name)}</div>` : ''}`;
      const buttons = [];
      if (canManage) buttons.push(`<button class="btn sm ${r.status === 'pending' ? 'primary' : ''}" data-act="attendance-open" data-session="${session.id}" data-reg="${r.registration.id}">${r.kind === 'replacement' ? 'Điểm danh hộ thay' : (r.status === 'pending' ? 'Ghi nhận' : 'Cập nhật')}</button>`);
      if (canCoordinateReplacement(session) && r.kind === 'official' && (r.status === 'absent_excused' || r.status === 'absent_unexcused') && !replacement) buttons.push(`<button class="btn sm" data-act="replacement-open" data-session="${session.id}" data-reg="${r.registration.id}">Điều phối dự bị</button>`);
      if (canCoordinateReplacement(session) && replacement) buttons.push(`<button class="btn sm danger" data-act="replacement-cancel-open" data-id="${replacement.record.id}">Hủy điều phối</button>`);
      const actions = canManage || canCoordinateReplacement(session) ? `<td><div class="session-reg-actions">${buttons.join('')}</div></td>` : '';
      return `<tr><td class="num">${i + 1}</td><td class="session-reg-name">${traderCell}</td><td>${U.esc(r.point.code)}</td><td>${U.esc(r.point.sectionName || '—')}</td><td>${U.esc(r.point.cat || '—')}</td><td>${attendanceStatusTag(r.status)}</td><td>${formatDateTimeValue(time, '—')}</td><td class="session-reg-note">${U.esc(r.reason || r.note || '') || '—'}</td>${actions}</tr>`;
    });
    const cols = [{ t: 'STT', num: true }, { t: 'Hộ/tiểu thương' }, { t: 'Mã điểm' }, { t: 'Khu chức năng' }, { t: 'Mặt hàng' }, { t: 'Trạng thái' }, { t: 'Thời điểm ghi nhận' }, { t: 'Lý do/Ghi chú' }];
    if (canManage || canCoordinateReplacement(session)) cols.push({ t: 'Thao tác' });
    return `<div class="session-attendance">
      <div class="session-attendance-head"><h4>Điểm danh & điều phối trước phiên</h4><span class="spacer"></span><span class="small muted">Đã xử lý ${counts.processed}/${counts.rows} dòng · Còn ${counts.needsAction} dòng cần theo dõi</span></div>
      <div class="session-attendance-summary">
        ${k('Chính thức', counts.total, 'total')}${k('Đã có mặt', counts.attended, 'attended')}${k('Cần xử lý', counts.needsAction, 'needs-action')}${k('Vắng mặt', counts.absent, 'absent')}
      </div>
      <div class="session-attendance-tabs">${tabs}</div>
      ${replacementHistoryHtml(session)}
      <div class="session-attendance-table">${U.table(cols, body, { empty: attendanceEmptyText(filter) })}</div>
    </div>`;
  }
  function sessionRegistrationHtml(session) {
    const b = sessionRegistrationBuckets(session);
    const canManage = canManageRegistrations(session);
    const tab = registrationTabKey(b);
    const rows = b[tab] || b.pending;
    const add = canManage ? `<button class="btn sm primary" data-act="reg-add-open" data-id="${session.id}">+ Ghi nhận đăng ký</button>` : '';
    return `<div class="session-registrations">
      <div class="session-reg-head"><h4>Đăng ký tham gia phiên</h4><span class="spacer"></span>${add}</div>
      <div class="note info">Prototype: Trưởng Ban/BQL ghi nhận đăng ký đã tiếp nhận từ hộ dân; chưa phải cổng Mini App/backend chính thức.</div>
      ${registrationTabsHtml(tab, b)}
      <div class="session-reg-panel">${registrationListHtml(rows, tab, session, canManage)}</div>
    </div>`;
  }
  function applySessionMutation(session, mutate, successLog) {
    const before = JSON.stringify(session);
    const logBefore = Array.isArray(A.db.extraLog) ? A.db.extraLog.slice() : null;
    const hadMarketSessions = Object.prototype.hasOwnProperty.call(A.db, 'marketSessions');
    const marketSessionsBefore = JSON.stringify(A.db.marketSessions || []);
    const hadSessionNotifications = Object.prototype.hasOwnProperty.call(A.db, 'sessionNotifications');
    const sessionNotificationsBefore = JSON.stringify(A.db.sessionNotifications || []);
    const hadNotifications = Object.prototype.hasOwnProperty.call(A.db, 'notifications');
    const notificationsBefore = JSON.stringify(A.db.notifications || []);
    mutate();
    try {
      if (successLog) U.log(successLog);
      A.save();
    } catch (e) {
      Object.keys(session).forEach(k => delete session[k]);
      Object.assign(session, JSON.parse(before));
      if (logBefore) {
        A.db.extraLog.length = 0;
        logBefore.forEach(x => A.db.extraLog.push(x));
      }
      if (hadMarketSessions) A.db.marketSessions = JSON.parse(marketSessionsBefore);
      else delete A.db.marketSessions;
      if (hadSessionNotifications) A.db.sessionNotifications = JSON.parse(sessionNotificationsBefore);
      else delete A.db.sessionNotifications;
      if (hadNotifications) A.db.notifications = JSON.parse(notificationsBefore);
      else delete A.db.notifications;
      U.toast('Không lưu được phiên chợ quê, dữ liệu đã được hoàn tác');
      return false;
    }
    return true;
  }
  function readNonNegativeNumber(selector, scale) {
    const v = Number(A.$(selector).value);
    if (!Number.isFinite(v) || v < 0) return null;
    return v * (scale || 1);
  }

  function marketStats(mid) {
    const db = A.db, f = x => mid === 'ALL' || x.market === mid;
    const stalls = db.stalls.filter(f);
    const occ = stalls.filter(s => s.status !== 'trong').length;
    const traders = db.traders.filter(f);
    const inv = db.invoices.filter(i => f(i) && i.period === '2026-09');
    const pays = db.payments.filter(p => f(p) && p.date.startsWith('2026-09'));
    const payAug = db.payments.filter(p => f(p) && p.date.startsWith('2026-08'));
    const over = db.invoices.filter(i => f(i) && U.isOver(i));
    const inc = db.incidents.filter(i => f(i) && i.state !== 'hoanthanh' && i.state !== 'dong');
    return {
      stalls: stalls.length, occ, occPct: U.pct(occ, stalls.length), traders: traders.length,
      due: U.sum(inv, i => i.amount), paid: U.sum(inv, i => i.paid),
      noncash: U.pct(U.sum(pays.filter(p => p.method !== 'tm'), p => p.amount), U.sum(pays, p => p.amount)),
      noncashAug: U.pct(U.sum(payAug.filter(p => p.method !== 'tm'), p => p.amount), U.sum(payAug, p => p.amount)),
      over: U.sum(over, U.due), overTraders: new Set(over.map(i => i.traderId)).size,
      inc: inc.length, incLate: inc.filter(i => i.deadline < U.today()).length,
      expiring: db.contracts.filter(c => f(c) && c.status === 'hieuluc' && U.days(U.today(), c.end) <= 30).length,
      app: U.pct(traders.filter(t => t.app).length, traders.length)
    };
  }
  A.marketStats = marketStats;

  // xmMkt: kết quả A.xmMarket() — 'CL'/'TTD' cụ thể HOẶC 'ALL' (gộp trong phạm vi account,
  // xem core.js). Đây là màn cross-market nên dùng xmMkt thay vì selectedMarket (ui.market) toàn
  // cục cho mọi phép lọc theo chợ trong hàm này.
  function revenueSeries(xmMkt) {
    const db = A.db, incCL = xmMkt !== 'TTD', incT = xmMkt !== 'CL';
    const labels = [], cash = [], non = [];
    const ttdBase = 33 * D.SESSION_FEE * 4.3;
    db.months.forEach(m => {
      const share = m.noncash / (m.cash + m.noncash);
      labels.push(m.period.slice(5) + '/' + m.period.slice(2, 4));
      cash.push((incCL ? m.cash : 0) + (incT ? ttdBase * (1 - share) : 0));
      non.push((incCL ? m.noncash : 0) + (incT ? ttdBase * share : 0));
    });
    db.issuedPeriods.filter(p => p <= '2026-09').forEach(p => {
      const ps = db.payments.filter(x => U.inScope(x, xmMkt) && A.idx.invoice.get(x.invoiceId).period === p);
      labels.push(p.slice(5) + '/' + p.slice(2, 4) + (p === '2026-09' ? '*' : ''));
      cash.push(U.sum(ps.filter(x => x.method === 'tm'), x => x.amount));
      non.push(U.sum(ps.filter(x => x.method !== 'tm'), x => x.amount));
    });
    return { labels, cash, non };
  }

  A.VIEWS['tong-quan'] = function () {
    // Tổng quan liên chợ = màn cross-market (A.SCREEN_MARKET['tong-quan'] === 'CROSS') — không bị
    // chặn bởi selectedMarket, dùng bộ lọc nội bộ riêng A.xmMarket()/A.xmScopeBar() (mục 9 Phase 2).
    const xmMkt = A.xmMarket();
    const s = marketStats(xmMkt), db = A.db;
    const kpi = (label, value, sub, cls, bar) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value">${value}</div>
      ${sub ? `<div class="k-sub ${cls || ''}">${sub}</div>` : ''}${bar != null ? `<div class="bar-mini"><i style="width:${Math.min(100, bar)}%"></i></div>` : ''}</div>`;
    const rs = revenueSeries(xmMkt);
    const counts = Object.keys(D.STATUS).map(k => ({ label: D.STATUS[k].label, value: db.stalls.filter(x => U.inScope(x, xmMkt) && x.status === k).length, color: D.STATUS[k].color }));
    const alerts = [];
    const exp = db.contracts.filter(c => U.inScope(c, xmMkt) && c.status === 'hieuluc' && U.days(U.today(), c.end) <= 30).length;
    const over60 = new Set(db.invoices.filter(i => U.inScope(i, xmMkt) && U.isOver(i) && U.overDays(i) > 60).map(i => i.traderId)).size;
    const abn = db.readings.filter(r => r.period === '2026-09' && U.inScope(A.idx.stall.get(r.stallId), xmMkt) && r.elecCur != null && (r.elecCur - r.elecPrev) > r.elecAvg * 1.5).length;
    const unmatched = db.bank.filter(b => !b.matched).length;
    if (exp) alerts.push(['warn', `${exp} hợp đồng hết hạn trong 30 ngày tới`, 'hop-dong']);
    if (over60) alerts.push(['danger', `${over60} tiểu thương nợ phí quá hạn trên 60 ngày`, 'cong-no']);
    if (s.incLate) alerts.push(['danger', `${s.incLate} phản ánh, sự cố quá thời hạn xử lý`, 'su-co']);
    if (abn) alerts.push(['warn', `${abn} chỉ số điện tăng bất thường so với trung bình`, 'dien-nuoc']);
    if (unmatched) alerts.push(['warn', `${unmatched} giao dịch chuyển khoản chưa khớp khoản thu`, 'doi-soat']);
    const escal = db.incidents.filter(i => U.inScope(i, xmMkt) && i.escalated && i.state !== 'dong');

    const cmp = ['CL', 'TTD'].map(id => [id, marketStats(id)]);
    const cmpRow = (label, f) => `<tr><td>${label}</td>${cmp.map(c => `<td class="num">${f(c[1])}</td>`).join('')}</tr>`;
    const xmBar = A.xmScopeBar();

    return `
    ${xmBar ? `<div class="card"><div class="card-b row" style="padding-top:14px"><span class="label-sm">Phạm vi xem</span>${xmBar}</div></div>` : ''}
    <div class="kpis">
      ${kpi('Điểm kinh doanh', s.stalls, `Lấp đầy ${U.pctTxt(s.occPct)}`, '', s.occPct)}
      ${kpi('Tiểu thương đang kinh doanh', s.traders, `${U.pctTxt(s.app)} đã dùng mini app`, '', s.app)}
      ${kpi('Đã thu kỳ 09/2026', U.moneyShort(s.paid), `/ ${U.moneyShort(s.due)} phải thu (${U.pctTxt(U.pct(s.paid, s.due))})`, '', U.pct(s.paid, s.due))}
      ${kpi('Thanh toán không tiền mặt', U.pctTxt(s.noncash), `Kỳ 08/2026: ${U.pctTxt(s.noncashAug)}`, s.noncash >= s.noncashAug ? 'up' : 'down', s.noncash)}
      ${kpi('Nợ phí quá hạn', U.moneyShort(s.over), `${s.overTraders} tiểu thương`, 'down')}
      ${kpi('Phản ánh đang xử lý', s.inc, `${s.incLate} quá hạn xử lý`, s.incLate ? 'down' : 'up')}
      ${kpi('Hợp đồng sắp hết hạn', s.expiring, 'Trong 30 ngày tới', s.expiring ? 'down' : '')}
      ${kpi('Cập nhật', U.dmy(U.today()), 'Số liệu theo thời gian thực')}
    </div>
    <div class="grid g-main">
      <div class="card"><div class="card-h"><h3>Số thu theo tháng</h3><span class="small muted">* kỳ 09/2026 tính đến ngày ${U.dmy(U.today())} · trước 05/2026 là số mô phỏng</span></div>
        <div class="card-b">${U.bars(rs.labels, [{ name: 'Tiền mặt', values: rs.cash, color: '#c9a45c' }, { name: 'QR / chuyển khoản', values: rs.non, color: '#1f6fd0' }])}</div></div>
      <div class="card"><div class="card-h"><h3>Trạng thái điểm kinh doanh</h3></div>
        <div class="card-b">${U.donut(counts, [U.pctTxt(s.occPct), 'lấp đầy'])}</div></div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>So sánh giữa các chợ</h3></div><div class="card-b">
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Chỉ tiêu</th><th class="num">Chợ Cao Lãnh</th><th class="num">Chợ quê TTĐ</th></tr></thead><tbody>
        ${cmpRow('Điểm kinh doanh / quầy', x => x.stalls)}
        ${cmpRow('Tỷ lệ lấp đầy', x => U.pctTxt(x.occPct))}
        ${cmpRow('Tiểu thương', x => x.traders)}
        ${cmpRow('Phải thu kỳ 09/2026', x => U.money(x.due))}
        ${cmpRow('Đã thu', x => U.money(x.paid))}
        ${cmpRow('Tỷ lệ thu', x => U.pctTxt(U.pct(x.paid, x.due)))}
        ${cmpRow('Không tiền mặt (kỳ 09)', x => U.pctTxt(x.noncash))}
        ${cmpRow('Nợ quá hạn', x => U.money(x.over))}
        ${cmpRow('Phản ánh đang xử lý', x => x.inc)}
        ${cmpRow('Cài đặt mini app', x => U.pctTxt(x.app))}
        </tbody></table></div></div></div>
      <div class="card"><div class="card-h"><h3>Cảnh báo cần xử lý</h3></div><div class="card-b">
        ${alerts.length ? alerts.map(a => `<div class="row" style="padding:8px 0;border-bottom:1px solid #eef2f7"><span class="tag ${a[0]}">${a[0] === 'danger' ? 'Khẩn' : 'Lưu ý'}</span><span style="flex:1">${a[1]}</span>${U.can(a[2]) ? `<button class="btn sm" data-act="go" data-to="${a[2]}">Xem</button>` : ''}</div>`).join('') : '<div class="empty">Không có cảnh báo</div>'}
        <h4 style="margin:16px 0 6px;font-size:var(--font-size-sm)">Phản ánh chuyển vượt cấp lên UBND phường</h4>
        ${escal.length ? escal.map(i => `<div class="row small" style="padding:6px 0"><span class="tag purple">${i.id}</span><span style="flex:1">${U.esc(i.title)} · ${U.mShort(i.market)}</span><button class="btn sm" data-act="inc-open" data-id="${i.id}">Mở</button></div>`).join('') : '<div class="small muted">Không có</div>'}
      </div></div>
    </div>`;
  };

  // ---------- Mặt bằng chợ (gộp UI "Thiết lập mặt bằng chợ" + "Sơ đồ mặt bằng", nay là workspace
  // drill-down nhiều cấp — MARKET_LAYOUT_DRILLDOWN_UX_REPORT.md) ----------
  // KHÔNG còn "edit mode" như 1 route/trang riêng nữa — action thêm/sửa/xóa cấu trúc hiện NGAY trên
  // cây, permission cho phép tới đâu thì action tự hiện tới đó. Toàn bộ cây + action cấu trúc + điều
  // hướng chọn node (Tổng quan/Khối/Tầng/Khu) nằm ở js/v-cautruc.js (nơi giữ model LAYOUT). File
  // này chỉ còn giữ đúng phần liên quan tới điểm kinh doanh THẬT (D.MARKETS/A.db.stalls):
  // A.stallPanel (drawer điểm KD, không đổi) + các hàm dùng chung A.mbOverviewHtml/A.mbBlockHtml/
  // A.mbFloorHtml/A.mbZoneDiagramHtml render vùng nội dung bên phải theo đúng cấp đang chọn —
  // js/v-cautruc.js gọi các hàm này, truyền vào (các) khối/tầng/khu LAYOUT hiện có; các hàm tự đối
  // chiếu với dữ liệu thật qua `zone.code === section.id` (đúng cách defaultLayout() đã seed — xem
  // js/v-cautruc.js) để hiển thị đúng trạng thái thực tế cho khu đã triển khai, hoặc thông tin quy
  // hoạch cho khu chưa khớp dữ liệu thật. Mọi số liệu tổng hợp (tổng điểm, số theo trạng thái) đều
  // TÍNH TỪ A.db.stalls/LAYOUT ngay tại thời điểm render — không persist thêm field nào. Không tạo
  // model/permission mặt bằng thứ hai, không đổi 'screen:mat-bang'/so-do.*/cau-truc.* (6 action
  // permKey GIỮ NGUYÊN).
  function mbMatchRealSection(mid, code) {
    const m = U.market(mid);
    for (const f of m.floors) { const s = f.sections.find(x => x.id === code); if (s) return { floor: f, section: s }; }
    return null;
  }
  // Điểm KD thật của 1 khu LAYOUT (mảng rỗng nếu khu còn ở giai đoạn quy hoạch, chưa khớp dữ liệu
  // thật — KHÔNG lẫn với "chưa có điểm nào dù đã khớp", 2 trường hợp này phân biệt bằng
  // mbMatchRealSection, không dựa vào độ dài mảng ở đây).
  function mbZoneStalls(mid, z) {
    const matched = mbMatchRealSection(mid, z.code);
    return matched ? A.db.stalls.filter(st => st.market === mid && st.floor === matched.floor.id && st.section === matched.section.id) : [];
  }
  function mbStatusLine(stalls) {
    const c = k => stalls.filter(st => st.status === k).length;
    const parts = Object.keys(D.STATUS).filter(k => c(k)).map(k => `${c(k)} ${D.STATUS[k].label.toLowerCase()}`);
    return parts.length ? parts.join(' · ') : 'Chưa có điểm kinh doanh';
  }
  function mbRentalLine(stalls) {
    const fixed = stalls.filter(st => U.rentalKind(st) === 'fixed').length;
    const session = stalls.filter(st => U.rentalKind(st) === 'session').length;
    const parts = [];
    if (fixed) parts.push(`${fixed} quầy cố định tháng/quý`);
    if (session) parts.push(`${session} quầy theo phiên/vãng lai`);
    return parts.join(' · ');
  }
  function mbMetaLine(stalls) {
    const rent = mbRentalLine(stalls);
    const status = mbStatusLine(stalls);
    return rent ? rent + ' · ' + status : status;
  }
  A.mbResolveZoneContext = function (mid, zone) {
    const market = U.market(mid);
    if (!market) return { market: mid, floor: null, section: null, matched: false, reason: 'market-not-found' };
    if (!zone) return { market: mid, floor: null, section: null, matched: false, reason: 'zone-not-found' };
    if (!zone.code) return { market: mid, floor: null, section: null, matched: false, reason: 'zone-code-empty' };
    const matched = mbMatchRealSection(mid, zone.code);
    if (!matched) return { market: mid, floor: null, section: null, matched: false, reason: 'section-not-found' };
    return { market: mid, floor: matched.floor, section: matched.section, matched: true, reason: 'matched-zone-code' };
  };
  A.mbBusinessPointsForZone = function (mid, zone) {
    return mbZoneStalls(mid, zone);
  };
  A.mbBusinessPointById = function (mid, pointId) {
    const st = A.idx && A.idx.stall ? A.idx.stall.get(pointId) : null;
    return st && st.market === mid ? st : null;
  };
  A.mbBusinessPointsForMarket = function (mid) {
    if (!U.market(mid)) return [];
    return A.db.stalls.filter(st => st.market === mid);
  };
  A.mbMarketStats = function (mid) {
    const points = A.mbBusinessPointsForMarket(mid);
    const byStatus = {};
    Object.keys(D.STATUS).forEach(k => { byStatus[k] = points.filter(st => st.status === k).length; });
    return { total: points.length, byStatus: byStatus, points: points };
  };
  A.mbZoneStats = function (mid, zone) {
    const points = A.mbBusinessPointsForZone(mid, zone);
    const byStatus = {};
    Object.keys(D.STATUS).forEach(k => { byStatus[k] = points.filter(st => st.status === k).length; });
    return { total: points.length, byStatus: byStatus, points: points };
  };
  // Danh sách khu của 1 tầng, MỖI khu render bằng ĐÚNG 1 renderer dùng chung (mbZoneSectionHtml —
  // tên khu + thống kê ngắn + point grid) — dùng lại nguyên vẹn ở cả Tầng/Khối/Tổng quan (hotfix
  // "cùng 1 visual language": không tạo renderer khác nhau cho từng cấp).
  function mbFloorZonesHtml(mid, floor) {
    return floor.zones.length ? floor.zones.map(z => mbZoneSectionHtml(mid, z)).join('') : '<div class="empty small">Chưa có khu nào.</div>';
  }
  // 1 tầng lồng bên trong Khối/Tổng quan (nơi 1 card có thể chứa NHIỀU tầng): thêm 1 heading nhỏ,
  // click được (→ view Tầng), phía trên danh sách khu của tầng đó — chỉ hiện khi phạm vi đang xem có
  // hơn 1 tầng (`showHeading`); khối chỉ có đúng 1 tầng thì heading thừa (trùng ý khối/tầng, giống
  // logic gộp `mbFlatMode` ở cây cấu trúc — xem js/v-cautruc.js), hiển thị thẳng danh sách khu.
  function mbFloorGroupHtml(mid, floor, showHeading) {
    const zonesHtml = mbFloorZonesHtml(mid, floor);
    if (!showHeading) return zonesHtml;
    const stalls = [];
    floor.zones.forEach(z => stalls.push.apply(stalls, mbZoneStalls(mid, z)));
    return `<div class="mb-floor-heading">
        <button class="mb-floor-heading-btn" data-act="mb-sel-floor" data-id="${floor.key}">${U.esc(floor.name)}</button>
        <span class="spacer"></span><span class="mb-floor-heading-meta">${stalls.length} điểm KD · ${mbMetaLine(stalls)}</span>
      </div>${zonesHtml}`;
  }
  // ---- Tổng quan toàn chợ (mục 1/2/3 hotfix — cùng visual language mọi cấp): mỗi khối 1 card,
  // trong đó liệt kê ĐỦ các tầng (nếu >1 tầng, có heading tầng) và ĐỦ các khu + point grid của từng
  // tầng — KHÔNG còn rút gọn thành danh sách/chip như trước. Thống kê tối thiểu toàn chợ đã có sẵn ở
  // thanh tổng hợp phía trên workspace (không lặp lại ở đây — xem mbWorkspaceHtml ở v-cautruc.js).
  A.mbOverviewHtml = function (mid, blocks) {
    if (!blocks.length) return '<div class="empty">Chưa có khối/nhà chợ nào.</div>';
    return `<div class="mb-ov">${blocks.map(b => {
      const stalls = [];
      b.floors.forEach(f => f.zones.forEach(z => stalls.push.apply(stalls, mbZoneStalls(mid, z))));
      const multi = b.floors.length > 1;
      const body = b.floors.length ? b.floors.map(f => mbFloorGroupHtml(mid, f, multi)).join('') : '<div class="empty small">Chưa có tầng</div>';
      return `<div class="card"><div class="card-h mb-ov-clickable" data-act="mb-sel-block" data-id="${b.key}"><h3>${U.esc(b.name)}</h3><span class="small muted">${stalls.length} điểm KD${mbRentalLine(stalls) ? ' · ' + mbRentalLine(stalls) : ''}</span></div>
        <div class="card-b"><div class="plan">${body}</div></div></div>`;
    }).join('')}</div>`;
  };
  // ---- Khối/Nhà chợ (mục 2 hotfix): TOÀN BỘ tầng thuộc khối, mỗi tầng TOÀN BỘ khu + point grid —
  // cùng cấu trúc với Tổng quan, chỉ khác phạm vi (đúng 1 khối thay vì mọi khối).
  A.mbBlockHtml = function (mid, block) {
    const stalls = [];
    block.floors.forEach(f => f.zones.forEach(z => stalls.push.apply(stalls, mbZoneStalls(mid, z))));
    const multi = block.floors.length > 1;
    const body = block.floors.length ? block.floors.map(f => mbFloorGroupHtml(mid, f, multi)).join('') : '<div class="empty small">Chưa có tầng</div>';
    return `<div class="card"><div class="card-h"><h3>${U.esc(block.name)}</h3><span class="small muted">${stalls.length} điểm KD${mbRentalLine(stalls) ? ' · ' + mbRentalLine(stalls) : ''}</span></div>
      <div class="card-b"><div class="plan">${body}</div></div></div>`;
  };
  // ---- Tầng: sơ đồ TOÀN BỘ điểm KD của TẤT CẢ khu thuộc tầng, mỗi khu tách thành 1 .plan-section
  // riêng (KHÔNG trộn chung 1 grid), giữ màu trạng thái hiện tại — không có heading tầng thừa vì
  // card-h h3 ở đây đã chính là tên tầng.
  A.mbFloorHtml = function (mid, floor) {
    const stalls = [];
    floor.zones.forEach(z => stalls.push.apply(stalls, mbZoneStalls(mid, z)));
    return `<div class="card"><div class="card-h"><h3>${U.esc(floor.name)}</h3><span class="small muted">${stalls.length} điểm KD · ${mbMetaLine(stalls)}</span></div>
      <div class="card-b"><div class="plan">${mbFloorZonesHtml(mid, floor)}</div></div></div>`;
  };
  // 1 khu, dạng compact (không bọc .card riêng) để nhúng nhiều khu liên tiếp trong view Tầng —
  // click tên khu → drill-down tiếp sang view Khu (mục 7: "Click tên Khu → chuyển sang view Khu").
  function mbZoneSectionHtml(mid, z) {
    const matched = mbMatchRealSection(mid, z.code);
    const head = `<h4><button class="mb-zone-jump" data-act="mb-sel-zone" data-id="${z.key}">${U.esc(z.name || '(chưa đặt tên)')}</button><span>${U.esc(z.code || '')}${z.status === 'nhap' ? ' · <span class="tag warn">Nháp</span>' : ''}</span></h4>`;
    if (!matched) {
      const planned = U.sum(z.planned, p => Number(p.qty) || 0);
      return `<div class="plan-section">${head}<div class="small muted">${planned} điểm dự kiến · khu đang quy hoạch, chưa có dữ liệu thực tế</div></div>`;
    }
    const sec = matched.section, stalls = A.db.stalls.filter(st => st.market === mid && st.floor === matched.floor.id && st.section === sec.id);
    const rows = sec.rows.map(r => {
      const cells = stalls.filter(st => st.row === r);
      return `<div class="plan-row"><span class="rl">${r}</span><div class="cells" style="--n:${sec.per}">${cells.map(st => {
        const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
        // `data-id` stays the technical id; `code` is the human-facing point code.
        const structural = st.structuralStatus === 'SPLIT';
        return `<button class="cell s-${st.status} ${sec.type === 'kiot' ? 'kiot' : ''} ${structural ? 'dim' : ''}" data-act="stall" data-id="${st.id}" title="${st.code} · ${U.rentalLabel(st)} · ${D.STATUS[st.status].label}${t ? ' · ' + U.esc(t.name) : ''}${structural ? ' · Đã tách' : ''}">${st.code}</button>`;
      }).join('')}</div></div>`;
    }).join('<div class="aisle"></div>');
    return `<div class="plan-section">${head}<div class="small muted" style="margin:-4px 0 8px">${stalls.length} điểm · ${mbMetaLine(stalls)}</div>${rows}</div>`;
  }
  // ---- Khu (mục 8): giữ đúng hành vi cũ (legend lọc trạng thái + tìm kiếm + sơ đồ đầy đủ). ----
  A.mbZoneDiagramHtml = function (mid, z, canEditZone) {
    const resolved = A.mbResolveZoneContext(mid, z);
    const editBtn = canEditZone ? `<button class="btn sm" data-act="qh-zone-edit-open" data-id="${z.key}">${U.icon('edit')}Sửa thông tin khu</button>` : '';
    if (!resolved.matched) {
      const totalQty = U.sum(z.planned, p => Number(p.qty) || 0), totalArea = U.sum(z.planned, p => (Number(p.std) || 0) * (Number(p.qty) || 0));
      return `<div class="card"><div class="card-h"><h3>${U.esc(z.name || '(chưa đặt tên)')}</h3><span class="small muted">${U.esc(z.code || '')} · quy hoạch</span><span class="spacer"></span>${editBtn}</div>
        <div class="card-b"><div class="note info">Khu này đang ở giai đoạn quy hoạch, chưa có điểm kinh doanh thực tế tương ứng (mã "${U.esc(z.code || '')}" chưa khớp khu vực nào trong sơ đồ thật).</div>
        <div class="row" style="margin-top:10px"><span>Số điểm dự kiến</span><span class="spacer"></span><b>${totalQty.toLocaleString('vi-VN')}</b></div>
        <div class="row"><span>Diện tích dự kiến</span><span class="spacer"></span><b>${totalArea.toLocaleString('vi-VN')} m²</b></div></div></div>`;
    }
    const f = resolved.floor, sec = resolved.section;
    const stalls = A.mbBusinessPointsForZone(mid, z);
    const legend = Object.keys(D.STATUS).map(k => `<button class="${ui.hidden[k] ? 'off' : ''}" data-act="legend" data-s="${k}"><span class="sw" style="background:${D.STATUS[k].color}"></span>${D.STATUS[k].label} <b>${stalls.filter(st => st.status === k).length}</b></button>`).join('');
    const rentalLegend = `<span class="tag">${stalls.filter(st => U.rentalKind(st) === 'fixed').length} quầy cố định tháng/quý</span> <span class="tag">${stalls.filter(st => U.rentalKind(st) === 'session').length} quầy theo phiên/vãng lai</span>`;
    const rows = sec.rows.map(r => {
      const cells = stalls.filter(st => st.row === r);
      return `<div class="plan-row"><span class="rl">${r}</span><div class="cells" style="--n:${sec.per}">${cells.map(st => {
        const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
        // Search filtering and structural history share the existing dim treatment.
        const dim = st.structuralStatus === 'SPLIT' || !stallMatch(st);
        return `<button class="cell s-${st.status} ${sec.type === 'kiot' ? 'kiot' : ''} ${dim ? 'dim' : ''} ${ui.sel === st.id ? 'sel' : ''}" data-act="stall" data-id="${st.id}" title="${st.code} · ${U.rentalLabel(st)} · ${D.STATUS[st.status].label}${t ? ' · ' + U.esc(t.name) : ''}${st.structuralStatus === 'SPLIT' ? ' · Đã tách' : ''}">${st.code}</button>`;
      }).join('')}</div></div>`;
    }).join('<div class="aisle"></div>');
    return `<div class="card"><div class="card-h">
        <h3>${U.esc(sec.name)}</h3><span class="small muted">${stalls.length} điểm · ${U.esc(sec.cat)} · ${f.name}</span>
        <span class="spacer"></span>${editBtn}<input class="input" style="width:220px" placeholder="Tìm mã điểm hoặc tên tiểu thương" data-in="plan-search" value="${U.esc(ui.planSearch)}"></div>
      <div class="card-b"><div class="legend" style="margin-bottom:10px">${legend}</div><div class="small muted" style="margin:-2px 0 10px">${rentalLegend}</div><div class="plan">${rows}</div></div></div>`;
  };
  function stallMatch(st) {
    const q = ui.planSearch.trim().toLowerCase();
    if (ui.hidden[st.status]) return false;
    if (!q) return true;
    const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
    return st.code.toLowerCase().includes(q) || (t && t.name.toLowerCase().includes(q));
  }
  A.stallPanel = function (st) {
    const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
    const c = st.contractId ? A.idx.contract.get(st.contractId) : null;
    const unpaid = A.db.invoices.filter(i => i.stallId === st.id && i.status !== 'paid');
    const canThuTien = A.canDirectCollect(st.market);
    const canXemHoSo = A.canDo('so-do.xem-ho-so', st.market);
    const canTaoHopDong = A.canDo('so-do.tao-hop-dong', st.market) || A.canDo('hop-dong.tao', st.market);
    const canDoiTrangThai = A.canDo('so-do.doi-trang-thai', st.market);
    const left = c ? U.days(U.today(), c.end) : null;
    return `<div class="row"><h3>${st.code}</h3>${U.statusTag(st.status)}</div>
      <div class="muted small" style="margin:2px 0 12px">${U.esc(st.sectionName)} · ${U.market(st.market).floors.find(f => f.id === st.floor).name} · ${U.mShort(st.market)}</div>
      <dl class="kv"><dt>Ngành hàng</dt><dd>${U.esc(st.cat)}</dd><dt>Loại quầy</dt><dd>${U.rentalLabel(st)}</dd><dt>Loại mặt bằng</dt><dd>${U.typeLabel(st.type)}</dd>
        <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd><dt>Đơn giá</dt><dd>${U.unitLabel(st)}</dd>
        ${c && c.monthly ? `<dt>Giá dịch vụ/tháng</dt><dd>${U.money(c.monthly)}</dd>` : ''}</dl>
      <div class="divider"></div>
      ${t ? `<dl class="kv"><dt>Tiểu thương</dt><dd><a href="#" data-act="trader" data-id="${t.id}">${U.esc(t.name)}</a> (${t.id})</dd>
        <dt>Điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd><dt>Mini app</dt><dd>${t.app ? '<span class="tag ok">Đã cài</span>' : '<span class="tag">Chưa cài</span>'}</dd>
        ${c ? `<dt>Hợp đồng</dt><dd>${c.id}<br><span class="small muted">${U.dmy(c.start)} – ${U.dmy(c.end)} · ${left <= 30 ? `<b style="color:#df2225">còn ${left} ngày</b>` : 'còn ' + left + ' ngày'}</span></dd>` : ''}
        <dt>Công nợ</dt><dd>${unpaid.length ? `<b style="color:#df2225">${U.money(U.sum(unpaid, U.due))}</b> <span class="small muted">(${unpaid.length} kỳ)</span>` : '<span class="tag ok">Không nợ</span>'}</dd></dl>`
        : '<div class="note info">Điểm kinh doanh đang trống, có thể cho thuê.</div>'}
      ${(canThuTien || canXemHoSo || canTaoHopDong || canDoiTrangThai) ? `<div class="row" style="margin-top:14px">
        ${canThuTien && t && unpaid.length ? `<button class="btn primary" data-act="pay-open" data-id="${t.id}">${U.icon('card')}Thu tiền</button>` : ''}
        ${t ? (canXemHoSo ? `<button class="btn" data-act="trader" data-id="${t.id}">Hồ sơ</button>` : '') : (canTaoHopDong ? `<button class="btn primary" data-act="ct-new" data-id="${st.id}">Tạo hợp đồng</button>` : '')}
        ${canDoiTrangThai ? `<button class="btn" data-act="stall-status" data-id="${st.id}">Đổi trạng thái</button>` : ''}</div>` : ''}
      ${st.history && st.history.length ? `<div class="divider"></div><div class="small"><b>Lịch sử thay đổi</b>${st.history.map(h => `<div class="muted">${h}</div>`).join('')}</div>` : ''}`;
  };

  // ---- Mặt bằng chợ — Chợ Cao Lãnh: drawer "xem nhanh" khi click 1 điểm trên sơ đồ (KHÁC
  // A.stallPanel ở trên — A.stallPanel GIỮ NGUYÊN, vẫn dùng cho Mặt bằng chợ quê TTĐ + màn "Điểm
  // kinh doanh" TTD, không đổi gì ở đó). Theo yêu cầu BUSINESS_POINT_MAP_DRAWER_REFACTOR: chỉ XEM
  // NHANH (4 nhóm A/B/C/D), KHÔNG có nút "Đổi trạng thái"/"Thu tiền"/"Tạo hợp đồng", KHÔNG mở modal
  // hồ sơ lớn tại chỗ — thay bằng 2 nút điều hướng dùng lại router/state hiện có (A.go + A.ACT có
  // sẵn của chính 2 màn đích), không tạo màn/modal chi tiết thứ hai.
  function mbStallPointTypeLabel(st) {
    return st.pointType && D.POINT_TYPE[st.pointType] ? D.POINT_TYPE[st.pointType].label : 'Chưa có thông tin';
  }
  // Người bán thực tế: tham chiếu ĐÚNG model sellerId đã chốt — KHÔNG suy đoán "giống người thuê"
  // khi sellerId rỗng (khác dkSeller() ở màn Điểm kinh doanh — nơi đó null = mặc định giống người
  // thuê); ở đây null hiển thị đúng nghĩa "chưa ghi nhận" theo yêu cầu, không tự bịa dữ liệu.
  function mbStallSeller(st, t) {
    if (!t || !st.sellerId) return null;
    const seller = A.idx.trader.get(st.sellerId);
    return seller ? { trader: seller, same: seller.id === t.id } : null;
  }
  function mbStallPanelCL(st) {
    const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
    const c = st.contractId ? A.idx.contract.get(st.contractId) : null;
    const seller = mbStallSeller(st, t);
    // Điều hướng chỉ theo screen permission của MÀN ĐÍCH (U.can — đã gồm account active + role +
    // screenMarketOk/marketScopes) — không action permission riêng, không hard-code role/market.
    const canXemHoSo = U.can('tieu-thuong');
    const canXemDiemKD = U.can('diem-kd');
    const unpaid = t ? A.db.invoices.filter(i => i.stallId === st.id && i.status !== 'paid') : [];
    const owe = U.sum(unpaid, U.due);
    const left = c ? U.days(U.today(), c.end) : null;
    const sec = (label, body) => `<div class="row"><b style="font-size:var(--font-size-sm)">${label}</b></div><div style="margin:6px 0 14px">${body}</div>`;
    const actions = [];
    if (t && canXemHoSo) actions.push(`<button class="btn" data-act="mb-open-trader" data-id="${t.id}">Xem hồ sơ tiểu thương</button>`);
    if (canXemDiemKD) actions.push(`<button class="btn" data-act="mb-open-diemkd" data-id="${st.id}">Xem điểm kinh doanh</button>`);
    return `<div class="muted small" style="margin:2px 0 12px">${U.esc(st.sectionName)} · ${U.market(st.market).floors.find(f => f.id === st.floor).name} · ${U.esc(U.market(st.market).name)}</div>
      ${sec('A. Thông tin điểm', `<dl class="kv">
        <dt>Loại điểm</dt><dd>${U.esc(mbStallPointTypeLabel(st))}</dd>
        <dt>Loại quầy</dt><dd>${U.rentalLabel(st)}</dd>
        <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd>
        <dt>Ngành hàng</dt><dd>${U.esc(st.cat)}</dd>
        <dt>Đơn giá áp dụng</dt><dd>${U.unitLabel(st)}</dd></dl>`)}
      <div class="divider"></div>
      ${sec('B. Thông tin sử dụng', `<dl class="kv">
        <dt>Người thuê</dt><dd>${t ? `${U.esc(t.name)} (${t.id})` : 'Chưa có'}</dd>
        <dt>Người bán thực tế</dt><dd>${!t ? 'Chưa ghi nhận' : !seller ? 'Chưa ghi nhận' : seller.same ? `${U.esc(seller.trader.name)} <span class="small muted">(người thuê trực tiếp kinh doanh)</span>` : U.esc(seller.trader.name)}</dd>
        ${t ? `<dt>Điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd>` : ''}</dl>`)}
      <div class="divider"></div>
      ${sec('C. Hợp đồng hiện hành', c
        ? `<dl class="kv"><dt>Số hợp đồng</dt><dd>${c.id}</dd>
        <dt>Thời hạn</dt><dd>${U.dmy(c.start)} – ${U.dmy(c.end)}<br><span class="small muted">${left <= 30 ? `<b style="color:#df2225">còn ${left} ngày</b>` : 'còn ' + left + ' ngày'}</span></dd>
        <dt>Trạng thái</dt><dd>${c.status === 'hieuluc' ? '<span class="tag ok">Đang hiệu lực</span>' : '<span class="tag">Đã thanh lý</span>'}</dd></dl>`
        : '<div class="note info">Chưa có hợp đồng hiệu lực.</div>')}
      <div class="divider"></div>
      ${sec('D. Công nợ', !t ? '<span class="tag">Không có nghĩa vụ hiện tại</span>'
        : owe ? `<span class="tag danger">Nợ phí</span> <b style="color:#df2225;margin-left:6px">${U.money(owe)}</b>`
        : '<span class="tag ok">Không nợ</span>')}
      ${actions.length ? `<div class="row" style="gap:8px;flex-wrap:wrap">${actions.join('')}</div>` : ''}`;
  }

  // A.VIEWS['mat-bang'] giờ định nghĩa ở js/v-cautruc.js (mbWorkspaceHtml) — nơi giữ cây cấu trúc +
  // model LAYOUT. File này chỉ còn giữ đúng phần thao tác điểm kinh doanh thật (drawer khi click 1
  // điểm trên sơ đồ) dùng chung cho cả route 'mat-bang' lẫn màn "Điểm kinh doanh" (screen:diem-kd,
  // độc lập, không đổi).
  // Vẽ drawer "xem nhanh" 1 điểm trên sơ đồ Mặt bằng chợ — tách thành hàm THUẦN (không tự
  // push/reset navigation stack) để dùng lại được cả khi mở làm drawer GỐC (action `stall`) LẪN khi
  // dùng làm "cách vẽ lại drawer nguồn" cho nút "← Quay lại" (A.drawerPush, xem core.js).
  function mbOpenStallDrawer(st) {
    ui.sel = st.id;
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${A.drawerBackHtml()}
        <div class="drawer-h"><div><h3>${st.code}</h3><div class="small muted" style="margin-top:2px">${U.statusTag(st.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
        <div class="drawer-b">${st.market === 'CL' ? mbStallPanelCL(st) : A.stallPanel(st)}</div></div>`;
    A.render();
  }
  Object.assign(A.ACT, {
    legend: el => { ui.hidden[el.dataset.s] = !ui.hidden[el.dataset.s]; A.render(); },
    // Click 1 điểm trên sơ đồ = mở drawer GỐC (không phải drill-down từ drawer khác) — luôn reset
    // navigation stack trước, đảm bảo không hiện "← Quay lại" giả (mục 6 yêu cầu back navigation).
    stall: el => { A.drawerReset(); mbOpenStallDrawer(A.idx.stall.get(el.dataset.id)); },
    // 2 nút điều hướng "xem sâu" của drawer Mặt bằng CL — KHÔNG còn A.go() đổi hẳn màn hình nữa
    // (MARKET_LAYOUT_DRILLDOWN_UX hotfix): ở lại ĐÚNG màn 'mat-bang' nền, chỉ thay #modal-root, và
    // lưu lại cách vẽ đúng drawer nguồn (mbOpenStallDrawer, label = mã điểm) vào navigation stack
    // dùng chung (A.drawerPush/A.drawerBackHtml, core.js) để "← Quay lại <mã điểm>" hoạt động đúng
    // — thay vì quay về danh sách Tiểu thương/Điểm kinh doanh. Tái dùng NGUYÊN A.openTraderDrawer/
    // A.openDkDrawer đã có sẵn ở js/v-tieuthuong.js (không tạo drawer/model mới).
    'mb-open-trader': el => {
      if (!U.can('tieu-thuong')) return;
      const t = A.idx.trader.get(el.dataset.id);
      const st = A.idx.stall.get(ui.sel);
      if (!t || !st) return;
      A.drawerPush(st.code, () => mbOpenStallDrawer(st));
      A.openTraderDrawer(t);
    },
    'mb-open-diemkd': el => {
      if (!U.can('diem-kd')) return;
      const st = A.idx.stall.get(el.dataset.id);
      if (!st) return;
      A.drawerPush(st.code, () => mbOpenStallDrawer(st));
      A.openDkDrawer(st);
    },
    'stall-status': el => {
      const st = A.mbBusinessPointById(ui.market, el.dataset.id);
      if (!st) { U.toast('Không tìm thấy điểm kinh doanh trong chợ hiện tại'); return; }
      if (!A.canDo('so-do.doi-trang-thai', st.market)) return;
      const opts = ['thue', 'ngung', 'tranhchap'].concat(st.traderId ? [] : ['trong']);
      A.modal(A.mHead('Đổi trạng thái điểm ' + st.code) + `<div class="modal-b"><div class="form-grid">
        <div class="field"><label>Trạng thái mới</label><select class="input" id="ss-status">${opts.map(k => `<option value="${k}" ${st.status === k ? 'selected' : ''}>${D.STATUS[k].label}</option>`).join('')}</select></div>
        <div class="field"><label>Lý do</label><input class="input" id="ss-reason" placeholder="VD: tiểu thương xin tạm nghỉ 1 tháng"></div></div>
        <div class="small muted" style="margin-top:10px">Trạng thái "Nợ phí" do hệ thống tự xác định theo công nợ quá hạn.</div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="stall-status-save" data-id="${st.id}">Lưu</button></div>`);
    },
    'stall-status-save': el => {
      const st = A.mbBusinessPointById(ui.market, el.dataset.id);
      if (!st) { U.toast('Không tìm thấy điểm kinh doanh trong chợ hiện tại'); return; }
      if (!A.canDo('so-do.doi-trang-thai', st.market)) return;
      const ns = A.$('#ss-status').value, reason = A.$('#ss-reason').value.trim();
      st.history = st.history || [];
      st.history.unshift(`${U.dmy(U.today())}: ${D.STATUS[st.status].label} → ${D.STATUS[ns].label}${reason ? ' (' + reason + ')' : ''}`);
      st.status = ns; A.refreshStall(st);
      U.log(`Đổi trạng thái điểm ${st.code} sang ${D.STATUS[st.status].label}`);
      A.save(); A.closeModal(); A.render(); U.toast('Đã cập nhật trạng thái ' + st.code);
    }
  });
  A.IN['plan-search'] = el => { ui.planSearch = el.value; A.render(); };

  // ---------- Phiên chợ quê ----------
  function sessionStatusTag(s) {
    const cls = s.status === 'closed' ? 'ok' : s.status === 'cancelled' ? 'danger' : s.status === 'postponed' ? 'warn' : 'info';
    return `<span class="tag ${cls}">${SESSION_STATUS[s.status] || s.status}</span>`;
  }
  function sessionMetricValue(s, key, closedLabel, openLabel) {
    const value = s && s[key];
    const has = Number.isFinite(Number(value));
    return {
      label: s && s.status === 'closed' ? closedLabel : openLabel,
      value: has ? (key === 'revenue' ? formatMoneyShort(value) : formatNumber(value)) : 'Chưa ghi nhận'
    };
  }
  function sessionProgressHtml(s) {
    if (!s) return '';
    if (s.status === 'postponed' || s.status === 'cancelled') {
      return `<div class="session-progress special">${sessionStatusTag(s)}<span class="small muted">Phiên không nằm trên tuyến tiến trình vận hành chuẩn.</span></div>`;
    }
    const current = SESSION_PROGRESS_INDEX[s.status] == null ? 0 : SESSION_PROGRESS_INDEX[s.status];
    return `<div class="session-progress">${SESSION_PROGRESS_STEPS.map((step, i) => {
      const done = s.status === 'closed' ? i <= current : i < current || (s.status === 'registration_closed' && i === 1);
      const cls = done ? 'done' : i === current ? 'current' : '';
      const note = step.key === 'ops' ? '<small>Chi tiết ở bước vận hành</small>' : '';
      return `<div class="session-step ${cls}"><span>${i + 1}</span><b>${step.label}</b>${note}</div>`;
    }).join('')}</div>`;
  }
  function sessionActionButtons(s) {
    if (!s || s.market !== TTD_SESSION_MARKET) return '';
    const outs = [];
    Object.keys(SESSION_TRANSITIONS[s.status] || {}).forEach(to => {
      const action = actionForTransition(s.status, to);
      if (action === 'phien-cho.chot-phien') return;
      if (canDoSessionAction(action, s)) {
        const act = to === 'registration_closed' ? 'session-close-list-confirm' : 'session-transition';
        outs.push(`<button class="btn sm" data-act="${act}" data-id="${s.id}" data-to="${to}">${SESSION_ACTION_LABEL[to] || SESSION_STATUS[to]}</button>`);
      }
    });
    if (s.status === 'pending_close' && canDoSessionAction('phien-cho.chot-phien', s)) {
      outs.push(`<button class="btn sm primary" data-act="session-open" data-id="${s.id}">Điểm danh & chốt phiên</button>`);
    }
    return outs.join('');
  }
  function sessionOpsHtml(s) {
    if (!s) return '<div class="card"><div class="card-h"><h3>Phiên sắp tới/đang vận hành</h3></div><div class="card-b"><div class="muted">Chưa có phiên chợ sắp tới.</div></div></div>';
    const boothsMetric = sessionMetricValue(s, 'booths', 'Quầy thực tế tham gia', 'Số quầy đã ghi nhận');
    const visitorsMetric = sessionMetricValue(s, 'visitors', 'Lượt khách ước tính', 'Lượt khách ước tính');
    const revenueMetric = sessionMetricValue(s, 'revenue', 'Doanh thu tự khai', 'Doanh thu tự khai');
    const actions = sessionActionButtons(s);
    return `<div class="card"><div class="card-h"><h3>Phiên sắp tới/đang vận hành</h3><span class="spacer"></span>${sessionStatusTag(s)}</div>
      <div class="card-b">
        ${sessionProgressHtml(s)}
        <div class="grid g3">
          <div><div class="small muted">Ngày bắt đầu đăng ký</div><b>${formatDateTimeValue(s.registrationStartAt, 'Chưa ghi nhận')}</b></div>
          <div><div class="small muted">Hạn đăng ký</div><b>${formatDeadline(s)}</b></div>
          <div><div class="small muted">Ngày phiên diễn ra</div><b>${sessionLabel(s)}</b></div>
          <div><div class="small muted">Giờ bắt đầu - kết thúc phiên chợ</div><b>${formatTimeRange(s)}</b></div>
          <div><div class="small muted">Người tạo</div><b>${U.esc(s.createdBy || 'Dữ liệu lịch sử')}</b></div>
          <div><div class="small muted">Người phụ trách</div><b>${U.esc(s.assignedTo || 'Chưa phân công')}</b></div>
          <div><div class="small muted">Người chốt</div><b>${U.esc(s.closedBy || '—')}</b></div>
          <div><div class="small muted">${boothsMetric.label}</div><b>${boothsMetric.value}</b></div>
          <div><div class="small muted">${visitorsMetric.label}</div><b>${visitorsMetric.value}</b></div>
          <div><div class="small muted">${revenueMetric.label}</div><b>${revenueMetric.value}</b></div>
        </div>
        ${s.note ? `<div class="note info" style="margin-top:12px">${U.esc(s.note)}</div>` : ''}
        ${s.status === 'closed' ? `<div class="small muted" style="margin-top:12px">Đã chốt${s.closedAt ? ' lúc ' + U.esc(s.closedAt) : ''}. Phiên đã chốt chỉ đọc trong PC3A.</div>` : ''}
        <div class="row" style="margin-top:12px">${actions || '<span class="small muted">Không có thao tác phù hợp với quyền và trạng thái hiện tại.</span>'}</div>
        ${sessionRegistrationHtml(s)}
        ${attendanceHtml(s)}
      </div></div>`;
  }
  function sessionDayListHtml() {
    const date = sessionDateFilter();
    const rows = sessionByDate(date);
    const canCreate = A.canDo('phien-cho.tao-phien', TTD_SESSION_MARKET);
    return `<div class="card"><div class="card-h"><div><h3>Phiên trong ngày</h3><div class="small muted">Dùng để kiểm tra các phiên đã có trước khi tạo lại luồng test.</div></div></div>
      <div class="card-b">
        <div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <div class="field" style="min-width:220px"><label>Ngày phiên</label><input class="input" type="date" data-ch="session-date-filter" value="${U.esc(date)}"></div>
          ${canCreate ? '<button class="btn sm primary" data-act="session-create">Tạo phiên mới</button>' : ''}
        </div>
        ${U.table([{ t: 'Ngày' }, { t: 'Giờ' }, { t: 'Trạng thái' }, { t: 'Đăng ký' }, { t: 'Ghi chú' }, { t: '' }],
          rows.map(s => {
            const regs = (A.db.sessionRegistrations || []).filter(r => r.sessionId === s.id);
            const canDelete = canHardDeleteSession(s);
            return `<tr><td>${U.dmy(s.date)}</td><td>${U.esc((s.startTime || '—') + ' - ' + (s.endTime || '—'))}</td><td>${sessionStatusTag(s)}</td>
              <td>${regs.length.toLocaleString('vi-VN')}</td><td class="small">${U.esc(s.note || '—')}</td>
              <td class="nowrap"><button class="btn sm" data-act="session-focus" data-id="${s.id}">Xem</button>
                ${canDelete ? `<button class="btn sm danger" data-act="session-delete-open" data-id="${s.id}">Xóa test</button>` : ''}
              </td></tr>`;
          }), { empty: 'Chưa có phiên nào trong ngày này.' })}
      </div></div>`;
  }
  A.VIEWS['phien-cho'] = function () {
    const ss = ttdSessionReadModels();
    const historical = ss.filter(s => s.status === 'closed').sort((a, b) => a.date.localeCompare(b.date));
    const chartHistory = historical.filter(s => Number.isFinite(Number(s.visitors)));
    const last = latestClosedSession(ss);
    const active = activeTtdSession();
    const k = (l, v, s) => `<div class="card kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div><div class="k-sub">${s}</div></div>`;
    return `
    <div class="note info">Phiên chợ quê được quản lý theo từng ngày phiên: đăng ký quầy, vận hành, điểm danh và chốt kết quả.</div>
    ${sessionDayListHtml()}
    ${sessionOpsHtml(active)}
    <div class="card"><div class="card-h"><h3>Tổng quan phiên gần nhất đã chốt</h3></div><div class="card-b">
      ${last ? `<div class="kpis">
        ${k('Phiên gần nhất', U.dmy(last.date), 'phiên đã chốt')}
        ${k('Quầy thực tế tham gia', formatNumber(last.booths), 'từ dữ liệu chốt phiên')}
        ${k('Lượt khách ước tính', formatNumber(last.visitors), 'do tổ quản lý ghi nhận')}
        ${k('Doanh thu tự khai', formatMoneyShort(last.revenue), 'tổng hợp sau khi chốt')}
      </div>` : '<div class="empty">Chưa có phiên chợ đã chốt.</div>'}
    </div></div>
    <div class="card"><div class="card-h"><h3>Báo cáo & lịch sử</h3></div><div class="card-b">
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Lượt khách theo phiên</h3></div><div class="card-b">
        ${chartHistory.length ? U.bars(chartHistory.map(s => s.date.slice(8) + '/' + s.date.slice(5, 7)), [{ name: 'Lượt khách (ước)', values: chartHistory.map(s => Number(s.visitors)), color: '#0089df' }], { fmt: v => Math.round(v).toLocaleString('vi-VN'), stacked: false }) : '<div class="muted">Chưa có dữ liệu phiên đã chốt.</div>'}</div></div>
      <div class="card"><div class="card-h"><h3>Lịch sử các phiên</h3></div><div class="card-b">
        ${U.table([{ t: 'Ngày' }, { t: 'Trạng thái' }, { t: 'Quầy thực tế tham gia', num: true }, { t: 'Phí phiên', num: true }, { t: 'Khách (ước)', num: true }, { t: 'Không tiền mặt', num: true }],
          historical.slice().reverse().map(s => `<tr><td>${U.dmy(s.date)}</td><td>${sessionStatusTag(s)}</td><td class="num">${formatNumber(s.booths)}</td><td class="num">${formatMoney(s.fee)}</td><td class="num">${formatNumber(s.visitors)}</td><td class="num">${formatPct(s.noncash)}</td></tr>`))}
      </div></div>
    </div></div></div>`;
  };
  A.CH['session-date-filter'] = el => { ui.sessionDateFilter = el.value || U.today(); A.render(); };
  Object.assign(A.ACT, {
    'session-focus': el => {
      const s = sessionById(el.dataset.id);
      if (!s || s.market !== TTD_SESSION_MARKET) return;
      ui.sessionFocusId = s.id || sessionIdForDate(s.date);
      ui.sessionDateFilter = s.date || sessionDateFilter();
      A.render();
    },
    'session-delete-open': el => {
      const s = sessionById(el.dataset.id);
      if (!s || !canHardDeleteSession(s)) { U.toast('Chỉ xóa test khi phiên chưa phát sinh thanh toán, biên lai, điểm danh hoặc điều phối'); return; }
      const regs = (A.db.sessionRegistrations || []).filter(r => r.sessionId === s.id);
      A.modal(A.mHead('Xóa phiên test') + `<div class="modal-b">
        <div class="note warn">Thao tác này chỉ dùng cho FE prototype để tạo lại luồng test. Phiên đã phát sinh thanh toán, biên lai, sao kê, điểm danh hoặc điều phối sẽ bị chặn xóa cứng.</div>
        <dl class="kv" style="margin-top:10px"><dt>Ngày phiên</dt><dd>${U.dmy(s.date)}</dd><dt>Trạng thái</dt><dd>${SESSION_STATUS[s.status] || s.status}</dd><dt>Đăng ký sẽ xóa kèm</dt><dd>${regs.length.toLocaleString('vi-VN')}</dd></dl>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="session-delete-save" data-id="${s.id}">Xóa phiên test</button></div>`);
    },
    'session-delete-save': el => {
      const s = sessionById(el.dataset.id);
      if (!s || !canHardDeleteSession(s)) { U.toast('Không thể xóa: phiên đã phát sinh dữ liệu nghiệp vụ hoặc bạn không có quyền'); return; }
      const sid = s.id;
      const regIds = new Set((A.db.sessionRegistrations || []).filter(r => r.sessionId === sid).map(r => r.id));
      A.db.sessions = (A.db.sessions || []).filter(x => x !== s && x.id !== sid);
      A.db.marketSessions = (A.db.marketSessions || []).filter(x => x.id !== sid);
      A.db.sessionRegistrations = (A.db.sessionRegistrations || []).filter(r => r.sessionId !== sid);
      A.db.sessionPayments = (A.db.sessionPayments || []).filter(p => p.sessionId !== sid && !regIds.has(p.registrationId));
      A.db.sessionNotifications = (A.db.sessionNotifications || []).filter(n => n.sessionId !== sid);
      A.db.notifications = (A.db.notifications || []).filter(n => n.sessionId !== sid);
      if (ui.sessionFocusId === sid) ui.sessionFocusId = null;
      U.log('Xóa phiên test chợ quê ' + U.dmy(s.date));
      A.save(); A.closeModal(); A.render(); U.toast('Đã xóa phiên test');
    },
    'session-attendance-tab': el => {
      const tab = el.dataset.tab;
      if (!ATTENDANCE_FILTERS.some(t => t[0] === tab)) return;
      ui.sessionAttendanceTab = tab;
      A.render();
    },
    'attendance-open': el => {
      const s = sessionById(el.dataset.session);
      const registrationId = el.dataset.reg;
      const row = s && attendanceReadModels(s).find(r => r.registration.id === registrationId);
      if (!row || !canTakeAttendance(s)) { U.toast('Không thể điểm danh hộ này trong ngữ cảnh hiện tại'); return; }
      A.modal(A.mHead('Lưu ghi nhận điểm danh') + `<div class="modal-b">
        <dl class="kv"><dt>Hộ/tiểu thương</dt><dd>${U.esc(row.trader.name)}</dd><dt>Điểm kinh doanh</dt><dd>${U.esc(row.point.code)}</dd><dt>Trạng thái hiện tại</dt><dd>${attendanceStatusTag(row.status)}</dd></dl>
        <div class="form-grid" style="margin-top:10px">
          <div class="field"><label>Trạng thái điểm danh *</label><select class="input" id="att-status">${attendanceStatusOptions(row.status)}</select></div>
          <div class="field"><label>Lý do</label><input class="input" id="att-reason" value="${U.esc(row.reason || '')}" placeholder="Bắt buộc với xin đến trễ hoặc vắng có báo"></div>
        </div>
        <div class="field" style="margin-top:10px"><label>Ghi chú</label><textarea class="input" id="att-note" rows="2">${U.esc(row.note || '')}</textarea></div>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="attendance-save" data-session="${s.id}" data-reg="${row.registration.id}">Lưu ghi nhận</button></div>`);
    },
    'attendance-save': el => {
      const s = sessionById(el.dataset.session);
      const registrationId = el.dataset.reg;
      const status = A.$('#att-status').value;
      const reason = A.$('#att-reason').value.trim();
      const note = A.$('#att-note').value.trim();
      const row = s && validateAttendanceTarget(s, registrationId, status, reason, true);
      if (!row) return;
      runAttendanceMutation(s, row, status, reason, note, () => { A.closeModal(); A.render(); U.toast('Đã lưu ghi nhận điểm danh'); });
    },
    'replacement-open': el => {
      const s = sessionById(el.dataset.session);
      if (!validateReplacementSession(s, true)) return;
      const absent = attendanceReadModels(s).find(r => r.kind === 'official' && r.registration.id === el.dataset.reg);
      if (!absent || (absent.status !== 'absent_excused' && absent.status !== 'absent_unexcused')) { U.toast('Chỉ điều phối cho hộ chính thức đã vắng mặt'); return; }
      if (canonicalAbsentReplacement(s, absent.registration.id)) { U.toast('Điểm này đã có hộ dự bị thay thế'); return; }
      const options = availableWaitlistForReplacement(s, absent.registration.id);
      if (!options.length) { U.toast('Không còn hộ dự bị khả dụng để điều phối'); return; }
      const opts = options.map(r => `<option value="${r.id}">#${Number(r.waitlistOrder || 0)} · ${U.esc(r.trader.name)}${r.trader.phone ? ' · ' + U.maskPhone(r.trader.phone) : ''}${r.note ? ' · ' + U.esc(r.note) : ''}</option>`).join('');
      A.modal(A.mHead('Điều phối hộ dự bị') + `<div class="modal-b">
        <dl class="kv">
          <dt>Hộ chính thức vắng</dt><dd>${U.esc(absent.trader.name)}</dd>
          <dt>Điểm thay thế tạm</dt><dd>${U.esc(absent.point.code)} · ${U.esc(absent.point.sectionName || '—')} · ${U.esc(absent.point.cat || '—')}</dd>
          <dt>Trạng thái vắng</dt><dd>${attendanceStatusTag(absent.status)}</dd>
          <dt>Lý do vắng</dt><dd>${U.esc(absent.reason || absent.note || '') || '—'}</dd>
        </dl>
        <div class="field" style="margin-top:10px"><label>Hộ dự bị khả dụng *</label><select class="input" id="rep-reg">${opts}</select></div>
        <div class="field" style="margin-top:10px"><label>Lý do điều phối *</label><textarea class="input" id="rep-reason" rows="3" placeholder="Nhập lý do điều phối hộ dự bị"></textarea></div>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="replacement-save" data-session="${s.id}" data-absent="${absent.registration.id}">Xác nhận điều phối</button></div>`);
    },
    'replacement-save': el => {
      const s = sessionById(el.dataset.session);
      const absentId = el.dataset.absent;
      const replacementIdValue = A.$('#rep-reg').value;
      const reason = A.$('#rep-reason').value.trim();
      const target = s && validateReplacementTarget(s, absentId, replacementIdValue, reason, true);
      if (!target) return;
      const now = nowIso();
      runReplacementMutation(s, list => {
        const rec = {
          id: replacementId(s.id, target.absent.registration.id, target.waitlist.id),
          sessionId: s.id,
          market: TTD_SESSION_MARKET,
          absentRegistrationId: target.absent.registration.id,
          absentTraderId: target.absent.trader.id,
          replacementRegistrationId: target.waitlist.id,
          replacementTraderId: target.waitlist.trader.id,
          pointId: target.absent.point.id,
          reason,
          status: 'active',
          assignedAt: now,
          assignedBy: currentAccountName(),
          cancelledAt: null,
          cancelledBy: null,
          cancelReason: '',
          createdAt: now,
          createdBy: currentAccountId(),
          updatedAt: now,
          updatedBy: currentAccountId()
        };
        list.push(rec);
        return rec;
      }, `Điều phối dự bị phiên ${s.id}: ${target.waitlist.trader.name} thay ${target.absent.trader.name} tại ${target.absent.point.code}`, () => { A.closeModal(); A.render(); U.toast('Đã điều phối hộ dự bị'); });
    },
    'replacement-cancel-open': el => {
      const rec = replacementById(el.dataset.id);
      const s = rec && sessionById(rec.sessionId);
      if (!validateReplacementSession(s, true)) return;
      const model = replacementReadModels(s).find(r => r.record.id === rec.id && r.record.status === 'active');
      if (!model) { U.toast('Không tìm thấy điều phối đang hiệu lực'); return; }
      A.modal(A.mHead('Hủy điều phối dự bị') + `<div class="modal-b">
        <dl class="kv"><dt>Điểm</dt><dd>${U.esc(model.point.code)}</dd><dt>Hộ chính thức vắng</dt><dd>${U.esc(model.absent.trader.name)}</dd><dt>Hộ dự bị thay thế</dt><dd>${U.esc(model.replacement.trader.name)}</dd></dl>
        <div class="field" style="margin-top:10px"><label>Lý do hủy *</label><textarea class="input" id="rep-cancel-reason" rows="3" placeholder="Nhập lý do hủy điều phối"></textarea></div>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="replacement-cancel-save" data-id="${rec.id}">Hủy điều phối</button></div>`);
    },
    'replacement-cancel-save': el => {
      const rec = replacementById(el.dataset.id);
      const s = rec && sessionById(rec.sessionId);
      if (!validateReplacementSession(s, true)) return;
      const model = replacementReadModels(s).find(r => r.record.id === rec.id && r.record.status === 'active');
      if (!model) { U.toast('Không tìm thấy điều phối đang hiệu lực'); return; }
      const reason = A.$('#rep-cancel-reason').value.trim();
      if (!reason) { U.toast('Vui lòng nhập lý do hủy điều phối'); return; }
      const now = nowIso();
      runReplacementMutation(s, () => {
        rec.status = 'cancelled';
        rec.cancelledAt = now;
        rec.cancelledBy = currentAccountName();
        rec.cancelReason = reason;
        rec.updatedAt = now;
        rec.updatedBy = currentAccountId();
        return rec;
      }, `Hủy điều phối dự bị phiên ${s.id}: ${model.replacement.trader.name} tại ${model.point.code}`, () => { A.closeModal(); A.render(); U.toast('Đã hủy điều phối dự bị'); });
    },
    'session-registration-tab': el => {
      const tab = el.dataset.tab;
      if (['pending', 'official', 'waitlist', 'inactive'].indexOf(tab) === -1) return;
      ui.sessionRegistrationTab = tab;
      A.render();
    },
    'reg-add-open': el => {
      const s = sessionById(el.dataset.id);
      if (!validateRegistrationManage(s, true)) return;
      const win = registrationWindowState(s);
      if (!win.ok) { U.toast(win.reason); return; }
      const opts = registrationOptions();
      if (!opts.trader) { U.toast('Chưa có tiểu thương TTD hợp lệ để ghi nhận đăng ký'); return; }
      A.modal(A.mHead('Ghi nhận đăng ký') + `<div class="modal-b"><div class="form-grid">
        <div class="field"><label>Hộ/tiểu thương *</label><select class="input" id="reg-trader">${opts.trader}</select></div>
        <div class="field"><label>Loại ghi nhận ban đầu *</label><select class="input" id="reg-kind"><option value="registered">Chờ duyệt</option><option value="waitlist">Dự bị</option></select></div>
        <div class="field"><label>Thời điểm đăng ký *</label><input class="input" id="reg-at" type="datetime-local" value="${nowIso().slice(0, 16)}"></div>
        <div class="field"><label>Khu mong muốn</label><input class="input" id="reg-section" placeholder="AT / NS / TN"></div>
      </div><div class="field" style="margin-top:10px"><label>Ghi chú</label><textarea class="input" id="reg-note" rows="2"></textarea></div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="reg-add-save" data-id="${s.id}">Lưu đăng ký</button></div>`);
    },
    'reg-add-save': el => {
      const s = sessionById(el.dataset.id);
      if (!validateRegistrationManage(s, true)) return;
      const win = registrationWindowState(s);
      if (!win.ok) { U.toast(win.reason); return; }
      const traderId = A.$('#reg-trader').value;
      const kind = A.$('#reg-kind').value;
      const registeredAt = A.$('#reg-at').value;
      const note = A.$('#reg-note').value.trim();
      const requestedSectionId = A.$('#reg-section').value.trim();
      const trader = traderById(traderId);
      if (!trader || trader.market !== TTD_SESSION_MARKET) { U.toast('Tiểu thương đăng ký không hợp lệ'); return; }
      if (!parseLocalDateTime(registeredAt)) { U.toast('Thời điểm đăng ký không hợp lệ'); return; }
      if (kind !== 'registered' && kind !== 'waitlist') { U.toast('Loại đăng ký không hợp lệ'); return; }
      if (activeRegistrationRows(s).some(r => r.traderId === traderId)) { U.toast('Tiểu thương đã có đăng ký trong phiên này'); return; }
      const rec = {
        id: registrationId(s.id), sessionId: s.id, market: s.market, traderId, pointId: null, requestedSectionId,
        registeredAt, listType: kind === 'waitlist' ? 'waitlist' : 'official', status: kind === 'waitlist' ? 'waitlisted' : 'registered',
        waitlistOrder: kind === 'waitlist' ? nextWaitlistOrder(s) : null, note,
        createdAt: nowIso(), createdBy: currentAccountId(), updatedAt: nowIso(), updatedBy: currentAccountId()
      };
      runRegistrationMutation(list => list.push(rec), `Ghi nhận đăng ký phiên ${s.id}: ${rec.id}`, () => { A.closeModal(); A.render(); U.toast('Đã ghi nhận đăng ký'); });
    },
    'reg-approve-open': el => {
      const r = registrationById(el.dataset.id), s = r && sessionById(r.sessionId);
      if (!r || !validateRegistrationManage(s, true)) return;
      if (r.status !== 'registered') { U.toast('Chỉ duyệt đăng ký đang chờ xử lý'); return; }
      const opts = registrationOptions();
      if (!opts.point) { U.toast('Chưa có điểm TTD hợp lệ để duyệt'); return; }
      A.modal(A.mHead('Duyệt vào danh sách chính thức') + `<div class="modal-b"><div class="field"><label>Điểm kinh doanh TTD *</label><select class="input" id="reg-point">${opts.point}</select></div>
        <div class="field" style="margin-top:10px"><label>Ghi chú</label><textarea class="input" id="reg-note" rows="2">${U.esc(r.note || '')}</textarea></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="reg-approve-save" data-id="${r.id}">Duyệt chính thức</button></div>`);
    },
    'reg-approve-save': el => {
      const r = registrationById(el.dataset.id), s = r && sessionById(r.sessionId);
      if (!r || !validateRegistrationManage(s, true)) return;
      if (r.status !== 'registered') { U.toast('Chỉ duyệt đăng ký đang chờ xử lý'); return; }
      const pointId = A.$('#reg-point').value, point = ttdPointById(pointId);
      if (!point) { U.toast('Điểm kinh doanh TTD không hợp lệ'); return; }
      if (activeRegistrationRows(s).some(x => x.id !== r.id && x.status === 'approved' && x.pointId === pointId)) { U.toast('Điểm này đã nằm trong danh sách chính thức'); return; }
      const note = A.$('#reg-note').value.trim();
      runRegistrationMutation(() => {
        r.pointId = pointId; r.listType = 'official'; r.status = 'approved'; r.waitlistOrder = null; r.note = note;
        r.updatedAt = nowIso(); r.updatedBy = currentAccountId();
      }, `Duyệt đăng ký phiên ${s.id}: ${r.id}`, () => { A.closeModal(); A.render(); U.toast('Đã duyệt vào danh sách chính thức'); });
    },
    'reg-waitlist': el => {
      const r = registrationById(el.dataset.id), s = r && sessionById(r.sessionId);
      if (!r || !validateRegistrationManage(s, true)) return;
      if (r.status !== 'registered') { U.toast('Chỉ chuyển dự bị từ đăng ký chờ xử lý'); return; }
      runRegistrationMutation(() => {
        r.pointId = null; r.listType = 'waitlist'; r.status = 'waitlisted'; r.waitlistOrder = nextWaitlistOrder(s);
        r.updatedAt = nowIso(); r.updatedBy = currentAccountId();
      }, `Chuyển dự bị đăng ký phiên ${s.id}: ${r.id}`, () => { A.render(); U.toast('Đã chuyển vào danh sách dự bị'); });
    },
    'reg-reject-open': el => {
      const r = registrationById(el.dataset.id), s = r && sessionById(r.sessionId);
      if (!r || !validateRegistrationManage(s, true)) return;
      if (r.status !== 'registered') { U.toast('Chỉ từ chối đăng ký đang chờ xử lý'); return; }
      A.modal(A.mHead('Từ chối đăng ký') + `<div class="modal-b"><div class="field"><label>Lý do/ghi chú</label><textarea class="input" id="reg-note" rows="3">${U.esc(r.note || '')}</textarea></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="reg-reject-save" data-id="${r.id}">Từ chối</button></div>`);
    },
    'reg-reject-save': el => {
      const r = registrationById(el.dataset.id), s = r && sessionById(r.sessionId);
      if (!r || !validateRegistrationManage(s, true)) return;
      if (r.status !== 'registered') { U.toast('Chỉ có thể từ chối đăng ký đang chờ xử lý.'); return; }
      const note = A.$('#reg-note').value.trim();
      runRegistrationMutation(() => {
        r.pointId = null; r.listType = 'official'; r.status = 'rejected'; r.waitlistOrder = null; r.note = note;
        r.updatedAt = nowIso(); r.updatedBy = currentAccountId();
      }, `Từ chối đăng ký phiên ${s.id}: ${r.id}`, () => { A.closeModal(); A.render(); U.toast('Đã từ chối đăng ký'); });
    },
    'reg-withdraw-open': el => {
      const r = registrationById(el.dataset.id), s = r && sessionById(r.sessionId);
      if (!r || !validateRegistrationManage(s, true)) return;
      if (r.status === 'rejected' || r.status === 'withdrawn') { U.toast('Đăng ký đã ở trạng thái kết thúc'); return; }
      A.modal(A.mHead('Ghi nhận rút đăng ký') + `<div class="modal-b">
        <div class="note info">Hộ/tiểu thương là bên chủ động xin rút; Ban Quản lý chỉ ghi nhận yêu cầu này.</div>
        <div class="field"><label>Lý do hộ xin rút</label><textarea class="input" id="reg-note" rows="3" placeholder="Nhập lý do hộ/tiểu thương xin rút đăng ký">${U.esc(r.note || '')}</textarea></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="reg-withdraw-save" data-id="${r.id}">Ghi nhận rút đăng ký</button></div>`);
    },
    'reg-withdraw-save': el => {
      const r = registrationById(el.dataset.id), s = r && sessionById(r.sessionId);
      if (!r || !validateRegistrationManage(s, true)) return;
      if (r.status === 'rejected' || r.status === 'withdrawn') { U.toast('Đăng ký đã ở trạng thái kết thúc'); return; }
      const note = A.$('#reg-note').value.trim();
      if (!note) { U.toast('Vui lòng nhập lý do hộ xin rút đăng ký'); return; }
      runRegistrationMutation(() => {
        r.pointId = null; r.status = 'withdrawn'; r.waitlistOrder = null; r.note = note;
        r.updatedAt = nowIso(); r.updatedBy = currentAccountId();
      }, `Ghi nhận rút đăng ký phiên ${s.id}: ${r.id}`, () => { A.closeModal(); A.render(); U.toast('Đã ghi nhận hộ rút đăng ký'); });
    },
    'reg-wait-up': el => {
      const r = registrationById(el.dataset.id), s = r && sessionById(r.sessionId);
      if (!r || !validateRegistrationManage(s, true)) return;
      const rows = sessionRegistrationBuckets(s).waitlist;
      const i = rows.findIndex(x => x.id === r.id);
      if (i <= 0) return;
      const other = registrationById(rows[i - 1].id);
      if (!other) return;
      runRegistrationMutation(() => {
        const a = r.waitlistOrder; r.waitlistOrder = other.waitlistOrder; other.waitlistOrder = a;
        r.updatedAt = other.updatedAt = nowIso(); r.updatedBy = other.updatedBy = currentAccountId();
      }, `Sắp xếp dự bị phiên ${s.id}: ${r.id}`, () => { A.render(); U.toast('Đã cập nhật thứ tự dự bị'); });
    },
    'reg-wait-down': el => {
      const r = registrationById(el.dataset.id), s = r && sessionById(r.sessionId);
      if (!r || !validateRegistrationManage(s, true)) return;
      const rows = sessionRegistrationBuckets(s).waitlist;
      const i = rows.findIndex(x => x.id === r.id);
      if (i < 0 || i >= rows.length - 1) return;
      const other = registrationById(rows[i + 1].id);
      if (!other) return;
      runRegistrationMutation(() => {
        const a = r.waitlistOrder; r.waitlistOrder = other.waitlistOrder; other.waitlistOrder = a;
        r.updatedAt = other.updatedAt = nowIso(); r.updatedBy = other.updatedBy = currentAccountId();
      }, `Sắp xếp dự bị phiên ${s.id}: ${r.id}`, () => { A.render(); U.toast('Đã cập nhật thứ tự dự bị'); });
    },
    'session-close-list-confirm': el => {
      const s = sessionById(el.dataset.id);
      if (!s || !ttdSessionCanMutate('phien-cho.chot-danh-sach', s, true)) return;
      if (s.status !== 'open') { U.toast('Chỉ chốt danh sách khi phiên đang mở đăng ký'); return; }
      const check = validateRegistrationList(s);
      if (!check.ok) { U.toast(check.reason); return; }
      const b = sessionRegistrationBuckets(s);
      A.modal(A.mHead('Chốt danh sách đăng ký') + `<div class="modal-b">
        <div class="note warn">Danh sách sẽ khóa sau khi chốt. Không tự động chuyển sang chuẩn bị phiên.</div>
        <div class="grid g3"><div><div class="small muted">Chính thức</div><b>${b.official.length}</b></div><div><div class="small muted">Dự bị</div><b>${b.waitlist.length}</b></div><div><div class="small muted">Từ chối/rút</div><b>${b.inactive.length}</b></div></div>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="session-close-list-save" data-id="${s.id}">Chốt danh sách</button></div>`);
    },
    'session-close-list-save': el => {
      const s = sessionById(el.dataset.id);
      if (!s || !ttdSessionCanMutate('phien-cho.chot-danh-sach', s, true)) return;
      if (s.status !== 'open') { U.toast('Chỉ chốt danh sách khi phiên đang mở đăng ký'); return; }
      const check = validateRegistrationList(s);
      if (!check.ok) { U.toast(check.reason); return; }
      const ok = applySessionMutation(s, () => {
        s.status = 'registration_closed';
        s.updatedBy = currentAccountName();
        s.updatedAt = nowIso();
      }, `Chốt danh sách đăng ký phiên ${sessionLabel(s)}`);
      if (ok) { A.closeModal(); A.render(); U.toast('Đã chốt danh sách đăng ký'); }
    },
    'session-create': () => {
      const fake = { id: 'new', market: TTD_SESSION_MARKET };
      if (!ttdSessionCanMutate('phien-cho.tao-phien', fake, true)) return;
      const filteredDate = parseIsoDate(sessionDateFilter());
      const date = filteredDate && filteredDate.getDay() === 6 ? sessionDateFilter() : TTD_DEMO_SESSION_DATE;
      const regStart = registrationStartForDate(date), deadline = registrationDeadlineForDate(date);
      A.modal(A.mHead('Tạo phiên chợ quê') + `<div class="modal-b"><div class="form-grid">
        <div class="field"><label>Ngày bắt đầu đăng ký *</label><input class="input" id="ses-reg-start" type="datetime-local" value="${regStart}"></div>
        <div class="field"><label>Hạn đăng ký *</label><input class="input" id="ses-deadline" type="datetime-local" value="${deadline}"></div>
        <div class="field"><label>Ngày phiên diễn ra *</label><input class="input" id="ses-date" type="date" value="${date}"></div>
        <div class="field"><label>Giờ bắt đầu phiên chợ *</label><input class="input" id="ses-start" type="time" value="14:00"></div>
        <div class="field"><label>Giờ kết thúc phiên chợ *</label><input class="input" id="ses-end" type="time" value="20:00"></div>
      </div><div class="field" style="margin-top:10px"><label>Ghi chú</label><textarea class="input" id="ses-note" rows="2"></textarea></div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="session-create-save">Tạo phiên</button></div>`);
    },
    'session-create-save': () => {
      const fake = { id: 'new', market: TTD_SESSION_MARKET };
      if (!ttdSessionCanMutate('phien-cho.tao-phien', fake, true)) return;
      const date = A.$('#ses-date').value, startTime = A.$('#ses-start').value, endTime = A.$('#ses-end').value;
      const registrationStartAt = A.$('#ses-reg-start').value, registrationDeadline = A.$('#ses-deadline').value, note = A.$('#ses-note').value.trim();
      const day = parseIsoDate(date);
      if (!day) { U.toast('Ngày phiên không hợp lệ'); return; }
      if (day.getDay() !== 6) { U.toast('Ngày phiên phải là thứ Bảy'); return; }
      if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) { U.toast('Giờ bắt đầu phải nhỏ hơn giờ kết thúc'); return; }
      const registrationStart = parseLocalDateTime(registrationStartAt), startAt = sessionStartDateTime(date, startTime), deadlineAt = parseLocalDateTime(registrationDeadline);
      if (!registrationStart) { U.toast('Ngày bắt đầu đăng ký không hợp lệ'); return; }
      if (!deadlineAt) { U.toast('Hạn đăng ký không hợp lệ'); return; }
      if (registrationStart >= deadlineAt) { U.toast('Ngày bắt đầu đăng ký phải trước hạn đăng ký'); return; }
      if (!startAt || !deadlineAt || deadlineAt >= startAt) { U.toast('Hạn đăng ký phải trước giờ bắt đầu phiên'); return; }
      if (hasSessionDate(date, null)) { U.toast('Đã có phiên trong ngày này'); return; }
      const hadRegistrations = Object.prototype.hasOwnProperty.call(A.db, 'sessionRegistrations');
      const registrationsBefore = A.db.sessionRegistrations;
      ensureSessionRegistrationCollection();
      const session = {
        id: sessionIdForDate(date), market: TTD_SESSION_MARKET, date, startTime, endTime, registrationStartAt, registrationDeadline,
        status: 'draft', note, createdBy: currentAccountName(), createdAt: nowIso(), updatedBy: currentAccountName(), updatedAt: nowIso()
      };
      A.db.sessions.push(session);
      const logBefore = Array.isArray(A.db.extraLog) ? A.db.extraLog.slice() : null;
      try {
        U.log('Tạo phiên chợ quê ' + U.dmy(date));
        A.save();
      } catch (e) {
        A.db.sessions = A.db.sessions.filter(s => s !== session);
        if (logBefore) {
          A.db.extraLog.length = 0;
          logBefore.forEach(x => A.db.extraLog.push(x));
        }
        if (hadRegistrations) A.db.sessionRegistrations = registrationsBefore;
        else delete A.db.sessionRegistrations;
        U.toast('Không lưu được phiên chợ quê, dữ liệu đã được hoàn tác');
        return;
      }
      A.closeModal(); A.render(); U.toast('Đã tạo phiên chợ quê ' + U.dmy(date));
    },
    'session-transition': el => {
      const s = sessionById(el.dataset.id), to = el.dataset.to;
      if (!s || s.market !== TTD_SESSION_MARKET) { U.toast('Không tìm thấy phiên TTD hợp lệ'); return; }
      const action = actionForTransition(s.status, to);
      if (!action || !ttdSessionCanMutate(action, s, true)) return;
      if (!canTransition(s.status, to)) { U.toast('Không thể chuyển trạng thái phiên theo yêu cầu'); return; }
      if (to === 'registration_closed') {
        const check = validateRegistrationList(s);
        if (!check.ok) { U.toast(check.reason); return; }
      }
      const from = s.status;
      const ok = applySessionMutation(s, () => {
        s.status = to;
        s.updatedBy = currentAccountName();
        s.updatedAt = nowIso();
        if (to === 'open') syncOpenSessionToMiniApp(s);
        if (to === 'preparing' && !s.assignedTo) s.assignedTo = currentAccountName();
      }, `Chuyển phiên chợ quê ${sessionLabel(s)}: ${SESSION_STATUS[from]} → ${SESSION_STATUS[to]}`);
      if (ok) { A.render(); U.toast(to === 'open' ? 'Đã mở đăng ký và gửi thông báo Mini app cho tiểu thương' : 'Đã cập nhật trạng thái phiên'); }
    },
    'session-open': el => {
      const s = sessionById(el.dataset.id);
      if (!ttdSessionCanMutate('phien-cho.chot-phien', s, true)) return;
      if (s.status !== 'pending_close') { U.toast('Chỉ chốt phiên ở trạng thái Chờ chốt'); return; }
      const booths = ttdSessionEligiblePoints();
      if (!booths) { U.toast('Không đọc được danh sách điểm kinh doanh TTD'); return; }
      A.modal(A.mHead('Điểm danh quầy – phiên ' + sessionLabel(s)) + `<div class="modal-b">
        <div class="form-grid"><div class="field"><label>Lượt khách ước tính</label><input class="input" id="ses-visitors" type="number" value="2750"></div>
        <div class="field"><label>Doanh thu tiểu thương tự khai (triệu đồng)</label><input class="input" id="ses-rev" type="number" value="236"></div></div>
        <div class="divider"></div><div class="small muted" style="margin-bottom:8px">Bỏ chọn quầy vắng mặt:</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px">${booths.map(s => `<label class="small"><input type="checkbox" class="ses-b" value="${s.id}" ${s.status === 'thue' ? 'checked' : ''}> ${s.code} · ${U.esc(A.idx.trader.get(s.traderId).name)}</label>`).join('')}</div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="session-save" data-id="${s.id}">Chốt phiên</button></div>`, true);
    },
    'session-save': el => {
      const s = sessionById(el.dataset.id);
      if (!ttdSessionCanMutate('phien-cho.chot-phien', s, true)) return;
      if (s.status !== 'pending_close') { U.toast('Chỉ chốt phiên ở trạng thái Chờ chốt'); return; }
      const booths = ttdSessionEligiblePoints();
      if (!booths) { U.toast('Không đọc được danh sách điểm kinh doanh TTD'); return; }
      const validIds = new Set(booths.map(st => st.id));
      const checked = Array.from(document.querySelectorAll('.ses-b:checked'));
      const selectedIds = new Set();
      let forged = false;
      checked.forEach(el => {
        const id = el && el.value;
        if (!validIds.has(id)) forged = true;
        else selectedIds.add(id);
      });
      if (forged) { U.toast('Dữ liệu điểm danh không hợp lệ, vui lòng mở lại phiên'); return; }
      const visitors = readNonNegativeNumber('#ses-visitors');
      const revenue = readNonNegativeNumber('#ses-rev', 1e6);
      if (visitors == null) { U.toast('Lượt khách ước tính phải là số không âm'); return; }
      if (revenue == null) { U.toast('Doanh thu tự khai phải là số không âm'); return; }
      const n = selectedIds.size;
      if (n > booths.length) { U.toast('Số quầy tham gia không hợp lệ'); return; }
      const ok = applySessionMutation(s, () => {
        s.booths = n;
        s.fee = n * D.SESSION_FEE;
        s.visitors = visitors;
        s.revenue = revenue;
        s.noncash = 0.41;
        s.status = 'closed';
        s.closedBy = currentAccountName();
        s.closedAt = nowIso();
        s.updatedBy = currentAccountName();
        s.updatedAt = nowIso();
      }, `Chốt phiên chợ quê ${sessionLabel(s)}: ${n} quầy`);
      if (ok) { A.closeModal(); A.render(); U.toast(`Đã chốt phiên ${sessionShortLabel(s)}: ${n} quầy, phí phiên ${U.money(n * D.SESSION_FEE)}`); }
    }
  });
})(window.APP);
