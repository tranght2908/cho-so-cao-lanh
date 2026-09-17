/* Workflow đăng ký tham gia phiên chợ quê theo state machine, RBAC và market scope hiện có. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;

  const S = {
    DRAFT: 'DRAFT',
    SCHEDULED: 'SCHEDULED',
    REGISTRATION_OPEN: 'REGISTRATION_OPEN',
    REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
    IN_PROGRESS: 'IN_PROGRESS',
    WAITING_RECONCILIATION: 'WAITING_RECONCILIATION',
    CLOSED: 'CLOSED',
    CANCELLED: 'CANCELLED'
  };
  const R = {
    CREATED: 'CREATED',
    WAITING_PAYMENT: 'WAITING_PAYMENT',
    CONDITIONAL_HOLD: 'CONDITIONAL_HOLD',
    CONFIRMED: 'CONFIRMED',
    CHECKED_IN: 'CHECKED_IN',
    PARTICIPATING: 'PARTICIPATING',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    PAYMENT_EXPIRED: 'PAYMENT_EXPIRED',
    NO_SHOW: 'NO_SHOW',
    REJECTED: 'REJECTED',
    WAITING_LIST: 'WAITING_LIST'
  };
  const P = {
    INITIATED: 'INITIATED',
    WAITING_PAYMENT: 'WAITING_PAYMENT',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
    RECONCILED: 'RECONCILED',
    REVERSED: 'REVERSED'
  };
  const E = {
    OPEN: 'OPEN',
    IN_REVIEW: 'IN_REVIEW',
    RESOLVED: 'RESOLVED',
    ACCEPTED_WITH_REASON: 'ACCEPTED_WITH_REASON'
  };

  const label = {
    DRAFT: 'Nháp', SCHEDULED: 'Đã lên lịch', REGISTRATION_OPEN: 'Đang mở đăng ký',
    REGISTRATION_CLOSED: 'Đã đóng đăng ký', IN_PROGRESS: 'Đang diễn ra',
    WAITING_RECONCILIATION: 'Chờ đối soát', CLOSED: 'Đã đóng phiên', CANCELLED: 'Đã hủy',
    CREATED: 'Mới tạo', WAITING_PAYMENT: 'Chờ thanh toán online', CONDITIONAL_HOLD: 'Giữ suất có điều kiện',
    CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Đã check-in', PARTICIPATING: 'Đang tham gia',
    COMPLETED: 'Hoàn tất', PAYMENT_EXPIRED: 'Hết hạn thanh toán', NO_SHOW: 'No-show',
    REJECTED: 'Từ chối', WAITING_LIST: 'Danh sách chờ', CANCELLED_REG: 'Đã hủy'
  };
  const statusCls = v => v === S.CLOSED || v === R.CONFIRMED || v === R.PARTICIPATING || v === R.COMPLETED || v === P.SUCCESS || v === P.RECONCILED || v === E.RESOLVED ? 'ok'
    : v === S.CANCELLED || v === R.NO_SHOW || v === R.PAYMENT_EXPIRED || v === R.REJECTED || v === E.OPEN ? 'danger'
      : v === S.WAITING_RECONCILIATION || v === R.CONDITIONAL_HOLD || v === R.WAITING_LIST || v === E.IN_REVIEW ? 'warn' : 'info';
  const tag = v => `<span class="tag ${statusCls(v)}">${U.esc(label[v] || v)}</span>`;

  function actor() {
    const acc = A.currentAccount();
    return acc ? acc.fullName : 'Không rõ';
  }
  function isSessionMarket(mid) {
    const m = U.market(mid);
    return !!m && m.kind === 'session';
  }
  function screenOk() {
    return U.can('phien-cho') && isSessionMarket(ui.market);
  }
  function canAction(actionKey, marketId) {
    return screenOk() && A.canDo(actionKey, marketId);
  }
  function deny(msg) {
    U.toast(msg || 'DENY: không đủ quyền, ngoài phạm vi chợ, hoặc trạng thái nghiệp vụ không hợp lệ');
    return false;
  }
  function canMutate(actionKey, session, statuses, extra) {
    if (!session || !canAction(actionKey, session.marketId)) return false;
    if (statuses && statuses.indexOf(session.status) === -1) return false;
    if (extra && !extra()) return false;
    return true;
  }
  function requireMutate(actionKey, session, statuses, extra) {
    return canMutate(actionKey, session, statuses, extra) || deny();
  }
  function today() { return U.today(); }
  function inWindow(s) { return s.registrationOpenAt <= today() && today() <= s.registrationCloseAt; }
  function merchantActive(t) { return !!t && t.stalls && t.stalls.length && t.market === ui.market; }
  function seq(prefix, arr) { return prefix + '-' + U.pad((arr ? arr.length : 0) + 1, 4); }
  function sessionReceiptNo() { return 'BLP-' + U.pad((A.db.sessionReceipts || []).length + 1, 5); }
  function sessionReceiptForPayment(paymentId) { return (A.db.sessionReceipts || []).find(r => r.paymentId === paymentId); }
  function pushSessionNotification(reg, s, receipt) {
    A.db.sessionNotifications = A.db.sessionNotifications || [];
    if (A.db.sessionNotifications.some(n => n.kind === 'SESSION_PAYMENT_SUCCESS' && n.receiptId === receipt.id)) return;
    A.db.sessionNotifications.unshift({
      at: today(), sessionId: s.id, merchantId: reg.merchantId, kind: 'SESSION_PAYMENT_SUCCESS',
      receiptId: receipt.id,
      text: 'Thanh toán thành công ' + U.money(receipt.amount) + ' cho ' + s.name + '. Biên lai ' + receipt.receiptNumber + ' đã lưu trên hệ thống.'
    });
  }
  A.completeSessionOnlinePayment = function (reg, s, payment, by) {
    if (!reg || !s || !payment) return null;
    if (reg.marketId !== ui.market || s.marketId !== ui.market || payment.marketId !== ui.market) return null;
    if (reg.sessionId !== s.id || payment.sessionId !== s.id || payment.registrationId !== reg.id) return null;
    if (reg.status !== R.WAITING_PAYMENT || payment.method !== 'ONLINE' || payment.status !== P.WAITING_PAYMENT) return null;
    if (paidAmount(reg) >= reg.totalAmount) return null;
    if (availableStalls(s) < reg.requestedStalls) return null;
    payment.status = P.SUCCESS;
    payment.paidAt = today();
    payment.confirmedBy = by || actor();
    payment.gateway = 'MOCK_ONLINE';
    payment.delivery = { miniApp: true, sentAt: today(), status: 'SENT_MOCK' };
    reg.status = R.CONFIRMED;
    let receipt = sessionReceiptForPayment(payment.id);
    if (!receipt) {
      receipt = {
        id: seq('RC', A.db.sessionReceipts), sessionId: s.id, registrationId: reg.id, paymentId: payment.id,
        merchantId: reg.merchantId, marketId: s.marketId, receiptNumber: sessionReceiptNo(),
        amount: payment.amount, method: 'ONLINE', collectedBy: 'Cổng thanh toán mock',
        collectedAt: today(), issuedBy: by || actor(), issuedAt: today(),
        delivery: { miniApp: true, sentAt: today(), status: 'SENT_MOCK' }
      };
      A.db.sessionReceipts.push(receipt);
    }
    reg.receiptNumber = receipt.receiptNumber;
    pushSessionNotification(reg, s, receipt);
    return receipt;
  };
  function sendRegistrationOpenNotification(s) {
    A.db.notifications = A.db.notifications || [];
    A.db.sessionNotifications = A.db.sessionNotifications || [];
    const market = U.market(s.marketId);
    const group = market ? market.short : s.marketId;
    const title = 'Mở đăng ký ' + s.name;
    const exists = A.db.notifications.some(n => n.sessionId === s.id && n.kind === 'SESSION_REGISTRATION_OPEN');
    if (!exists) {
      A.db.notifications.unshift({
        id: 'TB-' + U.pad(32 + A.db.notifications.length, 3),
        at: today(),
        title,
        body: 'Phiên ' + U.dmy(s.sessionDate) + ' đã mở đăng ký. Tiểu thương đăng ký trên Mini app và chọn QR code thanh toán tự động hoặc thanh toán tiền mặt.',
        group,
        channels: ['Mini app'],
        sent: A.db.traders.filter(t => t.market === s.marketId && t.app).length,
        delivered: 1,
        read: 0,
        auto: true,
        kind: 'SESSION_REGISTRATION_OPEN',
        sessionId: s.id
      });
    }
    if (!A.db.sessionNotifications.some(n => n.sessionId === s.id && n.kind === 'REGISTRATION_OPEN')) {
      A.db.sessionNotifications.unshift({ at: today(), sessionId: s.id, kind: 'REGISTRATION_OPEN', text: title });
    }
  }
  function sessionList() { ensureModel(); return A.db.marketSessions.filter(s => s.marketId === ui.market); }
  function regs(sid) { return A.db.sessionRegistrations.filter(r => r.sessionId === sid); }
  function paymentsFor(regId) { return A.db.sessionPayments.filter(p => p.registrationId === regId); }
  function paidAmount(reg) { return U.sum(paymentsFor(reg.id).filter(p => p.status === P.SUCCESS || p.status === P.RECONCILED), p => p.amount); }
  function blocksCapacity(r) {
    return [R.CONDITIONAL_HOLD, R.CONFIRMED, R.CHECKED_IN, R.PARTICIPATING, R.COMPLETED].indexOf(r.status) !== -1;
  }
  function usedStalls(s) { return U.sum(regs(s.id).filter(blocksCapacity), r => r.requestedStalls); }
  function availableStalls(s) { return Math.max(0, s.totalStalls - usedStalls(s)); }
  function releasedStalls(s) { return U.sum(regs(s.id).filter(r => r.status === R.NO_SHOW || r.status === R.CANCELLED), r => r.requestedStalls); }
  function currentSession() {
    const list = sessionList();
    let s = ui.sessionId ? list.find(x => x.id === ui.sessionId) : null;
    if (!s && list.length) { s = list[0]; ui.sessionId = s.id; }
    return s || null;
  }
  function categoryOptions(s) {
    return (s.allowedBusinessCategories || []).map(c => `<option value="${U.esc(c)}">${U.esc(c)}</option>`).join('');
  }
  function activePricing(mid) {
    const services = A.SERVICE_CFG && A.SERVICE_CFG.list ? (A.SERVICE_CFG.list('extraServices') || []) : [];
    const extra = services.filter(x => x.marketId === mid && x.status === 'active');
    return {
      unitPrice: D.SESSION_FEE,
      source: 'DATA.SESSION_FEE',
      additionalFees: extra.map(x => ({ name: x.name, amount: x.amount || 0, sourceId: x.id }))
    };
  }
  function snapshotAmount(stalls, mid) {
    const cfg = activePricing(mid);
    const lineStall = stalls * cfg.unitPrice;
    const extras = cfg.additionalFees.map(f => Object.assign({}, f, { amount: f.amount * stalls }));
    return {
      unitPrice: cfg.unitPrice,
      numberOfStalls: stalls,
      stallFee: lineStall,
      additionalFees: extras,
      totalAmount: lineStall + U.sum(extras, f => f.amount),
      source: cfg.source,
      capturedAt: today()
    };
  }
  function ensureModel() {
    const db = A.db;
    db.marketSessions = db.marketSessions || [];
    db.sessionRegistrations = db.sessionRegistrations || [];
    db.sessionPayments = db.sessionPayments || [];
    db.sessionReceipts = db.sessionReceipts || [];
    db.sessionReconExceptions = db.sessionReconExceptions || [];
    db.merchantParticipationHistory = db.merchantParticipationHistory || [];
    db.sessionNotifications = db.sessionNotifications || [];
    const sm = sessionMarketId();
    if (sm && !db.marketSessions.some(s => s.marketId === sm)) seedSessions(sm);
  }
  function sessionMarketId() {
    const m = D.MARKETS.find(x => x.kind === 'session');
    return m ? m.id : null;
  }
  function seedSessions(mid) {
    const cats = Array.from(new Set(A.db.stalls.filter(s => s.market === mid && U.rentalKind(s) === 'session').map(s => s.cat))).slice(0, 4);
    const pricing = activePricing(mid);
    A.db.marketSessions.push(
      mkSession(mid, 'PC-' + mid + '-20260919', 'Phiên chợ quê thứ Bảy 19/09/2026', '2026-09-19', S.REGISTRATION_OPEN, 24, cats, pricing),
      mkSession(mid, 'PC-' + mid + '-20260926', 'Phiên chợ quê thứ Bảy 26/09/2026', '2026-09-26', S.SCHEDULED, 30, cats, pricing),
      mkSession(mid, 'PC-' + mid + '-DRAFT', 'Phiên chợ quê dự kiến 03/10/2026', '2026-10-03', S.DRAFT, 28, cats, pricing)
    );
    const s = A.db.marketSessions[0];
    const traders = A.db.traders.filter(t => t.market === mid).slice(0, 5);
    if (traders[0]) createSeedReg(s, traders[0], 2, cats[0], 'ONLINE', R.CONFIRMED, P.SUCCESS);
    if (traders[1]) createSeedReg(s, traders[1], 1, cats[1] || cats[0], 'CASH', R.CONDITIONAL_HOLD);
    if (traders[2]) createSeedReg(s, traders[2], 1, cats[2] || cats[0], 'ONLINE', R.WAITING_PAYMENT, P.WAITING_PAYMENT);
    if (traders[3]) createSeedReg(s, traders[3], 1, cats[0], 'CASH', R.WAITING_LIST);
    if (traders[4]) createSeedReg(s, traders[4], 1, cats[0], 'CASH', R.NO_SHOW);
  }
  function mkSession(mid, code, name, date, status, total, cats, pricing) {
    return {
      id: code, code, marketId: mid, name, sessionDate: date, startTime: '14:00', endTime: '20:00',
      registrationOpenAt: '2026-09-13', registrationCloseAt: date < '2026-09-20' ? '2026-09-18' : '2026-09-24',
      checkInDeadline: date + ' 15:00', totalStalls: total, availableStalls: total,
      maxStallsPerMerchant: 2, allowedBusinessCategories: cats,
      pricingConfig: { unitPrice: pricing.unitPrice, additionalFees: pricing.additionalFees, source: pricing.source },
      cashPaymentEnabled: true, onlinePaymentEnabled: true, waitingListEnabled: true,
      status, createdBy: 'Hệ thống seed', createdAt: '2026-09-13'
    };
  }
  function createSeedReg(s, t, stalls, cat, method, status, payStatus) {
    const snap = snapshotAmount(stalls, s.marketId);
    const reg = {
      id: seq('DK', A.db.sessionRegistrations), code: 'DK-' + s.code.slice(-8) + '-' + U.pad(A.db.sessionRegistrations.length + 1, 3),
      sessionId: s.id, marketId: s.marketId, merchantId: t.id, requestedStalls: stalls, businessCategory: cat,
      status, paymentMethod: method, pricingSnapshot: snap, totalAmount: snap.totalAmount,
      createdBy: 'Hệ thống seed', createdAt: '2026-09-13', checkedInBy: null, checkedInAt: null,
      note: status === R.WAITING_LIST ? 'Manual promotion - NEED_CONFIRMATION thứ tự ưu tiên' : ''
    };
    A.db.sessionRegistrations.push(reg);
    if (payStatus) {
      const pay = {
      id: seq('PM', A.db.sessionPayments), sessionId: s.id, registrationId: reg.id, marketId: s.marketId,
      method, status: payStatus, amount: snap.totalAmount, reference: 'MOCK-' + reg.code,
      createdAt: '2026-09-13', paidAt: payStatus === P.SUCCESS ? '2026-09-13' : null, reconciledAt: null
      };
      A.db.sessionPayments.push(pay);
      if (method === 'ONLINE' && payStatus === P.SUCCESS) {
        pay.status = P.WAITING_PAYMENT; reg.status = R.WAITING_PAYMENT;
        A.completeSessionOnlinePayment(reg, s, pay, 'Hệ thống seed');
      }
    }
  }

  function validateRegistration(s, traderId, requestedStalls, category, allowWaiting) {
    const out = [];
    const t = A.idx.trader.get(traderId);
    if (!canAction('phien-cho.registration.create', s.marketId)) out.push('DENY: thiếu screen/action permission hoặc ngoài marketScopes.');
    if (s.status !== S.REGISTRATION_OPEN) out.push('Phiên chưa mở đăng ký hoặc đã đóng đăng ký.');
    if (!inWindow(s)) out.push('Ngoài thời gian đăng ký.');
    if (!merchantActive(t)) out.push('Tiểu thương không active hoặc không thuộc chợ đang chọn.');
    if (t && t.restrictedRegistration) out.push('Tiểu thương đang bị hạn chế đăng ký.');
    if (!(requestedStalls > 0)) out.push('Số quầy phải lớn hơn 0.');
    if (requestedStalls > s.maxStallsPerMerchant) out.push('Vượt số quầy tối đa mỗi tiểu thương.');
    if ((s.allowedBusinessCategories || []).indexOf(category) === -1) out.push('Ngành hàng không hợp lệ cho phiên.');
    const dup = regs(s.id).find(r => r.merchantId === traderId && [R.CANCELLED, R.REJECTED, R.PAYMENT_EXPIRED, R.NO_SHOW].indexOf(r.status) === -1);
    if (dup) out.push('Đã tồn tại đăng ký còn hiệu lực hoặc đang xử lý.');
    if (availableStalls(s) < requestedStalls && !(allowWaiting && s.waitingListEnabled)) out.push('Không còn đủ sức chứa.');
    return out;
  }

  function kpi(labelText, value, sub) {
    return `<div class="card kpi"><div class="k-label">${labelText}</div><div class="k-value">${value}</div><div class="k-sub">${sub || ''}</div></div>`;
  }
  function dashboard(s) {
    const rs = regs(s.id), pays = A.db.sessionPayments.filter(p => p.sessionId === s.id);
    const online = U.sum(pays.filter(p => p.method === 'ONLINE' && (p.status === P.SUCCESS || p.status === P.RECONCILED)), p => p.amount);
    const cash = U.sum(pays.filter(p => p.method === 'CASH' && p.status === P.SUCCESS), p => p.amount);
    const expected = U.sum(rs.filter(r => r.status !== R.CANCELLED && r.status !== R.REJECTED), r => r.totalAmount);
    const exceptions = A.db.sessionReconExceptions.filter(e => e.sessionId === s.id && (e.status === E.OPEN || e.status === E.IN_REVIEW)).length;
    return `<div class="kpis">
      ${kpi('Total capacity', s.totalStalls, 'quầy')}
      ${kpi('Registered stalls', usedStalls(s), 'đang giữ/xác nhận')}
      ${kpi('Confirmed online stalls', U.sum(rs.filter(r => r.paymentMethod === 'ONLINE' && [R.CONFIRMED, R.CHECKED_IN, R.PARTICIPATING, R.COMPLETED].indexOf(r.status) !== -1), r => r.requestedStalls), '')}
      ${kpi('Conditional cash holds', U.sum(rs.filter(r => r.status === R.CONDITIONAL_HOLD), r => r.requestedStalls), '')}
      ${kpi('Checked-in merchants', rs.filter(r => r.status === R.CHECKED_IN || r.status === R.PARTICIPATING || r.status === R.COMPLETED).length, '')}
      ${kpi('No-show count', rs.filter(r => r.status === R.NO_SHOW).length, '')}
      ${kpi('Waiting list count', rs.filter(r => r.status === R.WAITING_LIST).length, '')}
      ${kpi('Released stalls', releasedStalls(s), '')}
      ${kpi('Online collected', U.moneyShort(online), '')}
      ${kpi('Cash collected', U.moneyShort(cash), '')}
      ${kpi('Expected revenue', U.moneyShort(expected), '')}
      ${kpi('Difference', U.moneyShort(expected - online - cash), 'expected - collected')}
      ${kpi('Recon exceptions', exceptions, 'blocking open/in review')}
    </div>`;
  }
  function tabsHtml(tab) {
    const tabs = [['overview', 'Overview'], ['registrations', 'Registrations'], ['merchant', 'Merchant registration'], ['checkin', 'Check-in'], ['payments', 'Payments'], ['waiting', 'Waiting list'], ['recon', 'Reconciliation'], ['validation', 'Validation cases']];
    return `<div class="seg session-tabs">${tabs.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="ms-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`;
  }
  function actionButton(action, s, statuses, text, cls) {
    const ok = canMutate(action, s, statuses);
    return `<button class="btn ${cls || ''}" data-act="ms-action" data-action="${action}" data-id="${s.id}" ${ok ? '' : 'disabled'}>${text}</button>`;
  }
  function sessionSelector(s) {
    const list = sessionList();
    return `<div class="card"><div class="card-b row" style="padding-top:14px;flex-wrap:wrap">
      <span class="label-sm">Phiên</span>
      <select class="input" data-ch="ms-select">${list.map(x => `<option value="${x.id}" ${s && s.id === x.id ? 'selected' : ''}>${x.code} - ${U.dmy(x.sessionDate)} - ${label[x.status]}</option>`).join('')}</select>
      <span class="spacer"></span>
      <button class="btn primary" data-act="ms-create" ${canAction('phien-cho.create', ui.market) ? '' : 'disabled'}>+ Tạo phiên</button>
    </div></div>`;
  }
  function overview(s) {
    const rows = sessionList().map(x => `<tr><td><b>${x.code}</b><div class="small muted">${U.esc(x.name)}</div></td><td>${U.dmy(x.sessionDate)}<div class="small muted">${x.startTime}-${x.endTime}</div></td><td>${U.dmy(x.registrationOpenAt)} - ${U.dmy(x.registrationCloseAt)}</td><td class="num">${usedStalls(x)}/${x.totalStalls}</td><td class="num">${regs(x.id).length}</td><td>${tag(x.status)}</td><td><button class="btn sm" data-act="ms-pick" data-id="${x.id}">Mở</button></td></tr>`);
    return dashboard(s) + `<div class="card"><div class="card-h"><h3>Market Session List</h3></div><div class="card-b">
      ${U.table([{ t: 'Session code' }, { t: 'Date' }, { t: 'Registration window' }, { t: 'Capacity', num: true }, { t: 'Registration count', num: true }, { t: 'Status' }, { t: '' }], rows)}
    </div></div>
    <div class="card"><div class="card-h"><h3>State actions</h3></div><div class="card-b row" style="flex-wrap:wrap">
      ${actionButton('phien-cho.schedule', s, [S.DRAFT], 'Lên lịch', 'primary')}
      ${actionButton('phien-cho.registration.open', s, [S.SCHEDULED], 'Mở đăng ký', 'primary')}
      ${actionButton('phien-cho.registration.close', s, [S.REGISTRATION_OPEN], 'Đóng đăng ký')}
      ${actionButton('phien-cho.start', s, [S.REGISTRATION_CLOSED], 'Bắt đầu phiên', 'primary')}
      ${actionButton('phien-cho.end', s, [S.IN_PROGRESS], 'Kết thúc phiên', 'primary')}
      ${actionButton('phien-cho.cancel', s, [S.DRAFT, S.SCHEDULED, S.REGISTRATION_OPEN, S.REGISTRATION_CLOSED], 'Hủy phiên', 'danger')}
      ${actionButton('phien-cho.close', s, [S.WAITING_RECONCILIATION], 'Đóng phiên', 'primary')}
    </div></div>`;
  }
  function registrationRows(s) {
    return regs(s.id).map(r => {
      const t = A.idx.trader.get(r.merchantId);
      const paid = paidAmount(r);
      const canPaySuccess = r.status === R.WAITING_PAYMENT && canMutate('phien-cho.registration.create', s, [S.REGISTRATION_OPEN, S.REGISTRATION_CLOSED, S.IN_PROGRESS]);
      return `<tr><td><b>${r.code}</b><div class="small muted">${U.esc(t ? t.name : '')}</div></td><td>${r.requestedStalls}</td><td>${U.esc(r.businessCategory)}</td><td>${U.esc(r.paymentMethod || '-')}</td><td>${tag(r.status)}</td><td class="num">${U.money(r.totalAmount)}</td><td class="num">${U.money(paid)}</td><td class="nowrap">
        ${canPaySuccess ? `<button class="btn sm primary" data-act="ms-pay-success" data-id="${r.id}">Simulate Payment Success</button>` : ''}
        ${r.status === R.CONDITIONAL_HOLD ? `<button class="btn sm danger" data-act="ms-noshow" data-id="${r.id}">Mark no-show</button>` : ''}
        ${[R.CONFIRMED, R.CONDITIONAL_HOLD, R.WAITING_PAYMENT, R.WAITING_LIST].indexOf(r.status) !== -1 ? `<button class="btn sm" data-act="ms-reg-cancel" data-id="${r.id}">Cancel</button>` : ''}
      </td></tr>`;
    });
  }
  function registrationsView(s) {
    return `<div class="card"><div class="card-h"><h3>Registrations</h3></div><div class="card-b">
      ${U.table([{ t: 'Merchant' }, { t: 'Stalls', num: true }, { t: 'Category' }, { t: 'Payment' }, { t: 'Status' }, { t: 'Total', num: true }, { t: 'Paid', num: true }, { t: '' }], registrationRows(s))}
    </div></div>`;
  }
  function merchantFlow(s) {
    const traders = A.db.traders.filter(t => t.market === ui.market);
    const form = ui.msForm || {};
    const traderId = form.traderId || (traders[0] && traders[0].id) || '';
    const n = Number(form.stalls || 1), cat = form.cat || (s.allowedBusinessCategories || [])[0] || '';
    const snap = snapshotAmount(n, s.marketId);
    const reasons = validateRegistration(s, traderId, n, cat, !!form.waiting);
    return `<div class="grid g2" style="align-items:start">
      <div class="card"><div class="card-h"><h3>Merchant Registration Flow</h3></div><div class="card-b">
        <div class="field"><label>Step 1 - Select session</label><input class="input" value="${U.esc(s.code)} - ${U.dmy(s.sessionDate)}" readonly></div>
        <div class="form-grid" style="margin-top:10px">
          <div class="field"><label>Merchant</label><select class="input" data-ch="ms-form" data-k="traderId">${traders.map(t => `<option value="${t.id}" ${traderId === t.id ? 'selected' : ''}>${U.esc(t.name)} - ${t.id}</option>`).join('')}</select></div>
          <div class="field"><label>Requested stalls</label><input class="input" type="number" min="1" data-ch="ms-form" data-k="stalls" value="${n}"></div>
          <div class="field"><label>Business category</label><select class="input" data-ch="ms-form" data-k="cat">${categoryOptions(s).replace(`value="${U.esc(cat)}"`, `value="${U.esc(cat)}" selected`)}</select></div>
          <div class="field"><label>Payment method</label><select class="input" data-ch="ms-form" data-k="method"><option value="ONLINE" ${(form.method || 'ONLINE') === 'ONLINE' ? 'selected' : ''}>Online</option><option value="CASH" ${form.method === 'CASH' ? 'selected' : ''}>Tiền mặt</option></select></div>
        </div>
        <label class="row small" style="gap:8px;margin-top:10px"><input type="checkbox" data-ch="ms-form-check" data-k="waiting" ${form.waiting ? 'checked' : ''}> Nếu hết sức chứa, đưa vào danh sách chờ</label>
        <div class="divider"></div>
        <dl class="kv"><dt>Stall fee</dt><dd>${U.money(snap.stallFee)}</dd><dt>Additional fees</dt><dd>${snap.additionalFees.map(f => U.esc(f.name) + ': ' + U.money(f.amount)).join('<br>') || 'Không có'}</dd><dt>Total amount</dt><dd><b>${U.money(snap.totalAmount)}</b></dd></dl>
        ${reasons.length ? `<div class="note" style="margin-top:10px">${reasons.map(U.esc).join('<br>')}</div>` : '<div class="note info" style="margin-top:10px">Validation pass. Pricing snapshot sẽ được lưu khi tạo đăng ký.</div>'}
        <div class="row" style="margin-top:12px"><button class="btn primary" data-act="ms-register" data-id="${s.id}" ${reasons.length ? 'disabled' : ''}>Tạo đăng ký</button></div>
      </div></div>
      <div class="card"><div class="card-h"><h3>Business validation</h3></div><div class="card-b small">
        <div>Session.status == REGISTRATION_OPEN: <b>${s.status === S.REGISTRATION_OPEN ? 'PASS' : 'FAIL'}</b></div>
        <div>Registration window: <b>${inWindow(s) ? 'PASS' : 'FAIL'}</b></div>
        <div>Capacity available: <b>${availableStalls(s)}</b></div>
        <div>Duplicate registration: checked in handler and UI.</div>
        <div class="note info" style="margin-top:10px">Late registration: NEED_CONFIRMATION, DEFAULT DENY qua permission riêng <b>phien-cho.registration.lateCreate</b>.</div>
      </div></div></div>`;
  }
  function checkinView(s) {
    const rows = regs(s.id).filter(r => [R.CONFIRMED, R.CONDITIONAL_HOLD, R.CHECKED_IN, R.PARTICIPATING, R.NO_SHOW].indexOf(r.status) !== -1).map(r => {
      const t = A.idx.trader.get(r.merchantId), paid = paidAmount(r), due = Math.max(0, r.totalAmount - paid);
      const canCheck = canMutate('phien-cho.checkin', s, [S.IN_PROGRESS]) && (r.status === R.CONFIRMED || r.status === R.CONDITIONAL_HOLD);
      const canCash = canMutate('phien-cho.cash.collect', s, [S.IN_PROGRESS]) && r.status === R.CHECKED_IN && r.paymentMethod === 'CASH' && due > 0;
      return `<tr><td><b>${U.esc(t ? t.name : '')}</b><div class="small muted">${r.code}</div></td><td class="num">${r.requestedStalls}</td><td>${U.esc(r.paymentMethod)}</td><td>${tag(r.status)}</td><td class="num">${U.money(due)}</td><td>${s.checkInDeadline}</td><td class="nowrap">
        ${canCheck ? `<button class="btn sm primary" data-act="ms-checkin" data-id="${r.id}">Check-in</button>` : ''}
        ${canCash ? `<button class="btn sm primary" data-act="ms-cash" data-id="${r.id}">Thu tiền mặt</button>` : ''}
      </td></tr>`;
    });
    return `<div class="card"><div class="card-h"><h3>Check-in Screen</h3><span class="small muted">Check-in chỉ cho IN_PROGRESS</span></div><div class="card-b">
      ${U.table([{ t: 'Merchant' }, { t: 'Stalls', num: true }, { t: 'Payment method' }, { t: 'Registration status' }, { t: 'Amount due', num: true }, { t: 'Deadline' }, { t: '' }], rows)}
    </div></div>`;
  }
  function paymentsView(s) {
    const rows = A.db.sessionPayments.filter(p => p.sessionId === s.id).map(p => {
      const r = A.db.sessionRegistrations.find(x => x.id === p.registrationId);
      return `<tr><td>${p.id}</td><td>${r ? r.code : ''}</td><td>${p.method}</td><td>${tag(p.status)}</td><td class="num">${U.money(p.amount)}</td><td>${U.esc(p.reference || '')}</td><td>${U.esc(p.paidAt || '')}</td></tr>`;
    });
    const recRows = A.db.sessionReceipts.filter(r => r.sessionId === s.id).map(r => `<tr><td>${r.receiptNumber}</td><td>${r.registrationId}</td><td>${U.esc(r.method || 'CASH')}</td><td class="num">${U.money(r.amount)}</td><td>${U.esc(r.collectedBy)}</td><td>${U.esc(r.collectedAt)}</td><td>${r.delivery && r.delivery.miniApp ? '<span class="tag ok">Đã gửi</span>' : '<span class="muted">-</span>'}</td></tr>`);
    return `<div class="grid g2"><div class="card"><div class="card-h"><h3>Payments</h3></div><div class="card-b">${U.table([{ t: 'Payment' }, { t: 'Registration' }, { t: 'Method' }, { t: 'Status' }, { t: 'Amount', num: true }, { t: 'Reference' }, { t: 'Paid at' }], rows)}</div></div>
      <div class="card"><div class="card-h"><h3>Receipts</h3></div><div class="card-b">${U.table([{ t: 'Receipt' }, { t: 'Registration' }, { t: 'Method' }, { t: 'Amount', num: true }, { t: 'Collector' }, { t: 'Collected at' }, { t: 'Mini app' }], recRows)}</div></div></div>`;
  }
  function waitingView(s) {
    const rows = regs(s.id).filter(r => r.status === R.WAITING_LIST).map(r => {
      const t = A.idx.trader.get(r.merchantId);
      return `<tr><td><b>${U.esc(t ? t.name : '')}</b><div class="small muted">${r.code}</div></td><td class="num">${r.requestedStalls}</td><td>${U.esc(r.businessCategory)}</td><td>${U.esc(r.note || 'Manual promotion')}</td><td>${canMutate('phien-cho.waitingList.promote', s, [S.REGISTRATION_OPEN, S.REGISTRATION_CLOSED, S.IN_PROGRESS]) ? `<button class="btn sm primary" data-act="ms-promote" data-id="${r.id}">Promote</button>` : ''}</td></tr>`;
    });
    return `<div class="card"><div class="card-h"><h3>Waiting List</h3><span class="small muted">NEED_CONFIRMATION: FIFO/priority/manual. Prototype = manual promotion.</span></div><div class="card-b">${U.table([{ t: 'Merchant' }, { t: 'Stalls', num: true }, { t: 'Category' }, { t: 'Policy note' }, { t: '' }], rows)}</div></div>`;
  }
  function reconView(s) {
    if (!canAction('phien-cho.reconciliation.view', s.marketId)) {
      return '<div class="card"><div class="empty">DENY: thiếu action permission xem đối soát phiên.</div></div>';
    }
    const exceptions = A.db.sessionReconExceptions.filter(e => e.sessionId === s.id);
    const rows = exceptions.map(e => `<tr><td>${e.id}</td><td>${e.type}</td><td class="num">${U.money(e.expectedAmount)}</td><td class="num">${U.money(e.actualAmount)}</td><td class="num">${U.money(e.difference)}</td><td>${tag(e.status)}</td><td>${U.esc(e.reason || '')}</td><td class="nowrap">
      ${canMutate('phien-cho.reconciliation.exception.resolve', s, [S.WAITING_RECONCILIATION]) && (e.status === E.OPEN || e.status === E.IN_REVIEW) ? `<button class="btn sm primary" data-act="ms-ex-resolve" data-id="${e.id}">Resolve</button><button class="btn sm" data-act="ms-ex-accept" data-id="${e.id}">Accept with reason</button>` : ''}
    </td></tr>`);
    return `<div class="grid g2"><div class="card"><div class="card-h"><h3>Online & Cash Reconciliation</h3></div><div class="card-b">
      <button class="btn primary" data-act="ms-reconcile" data-id="${s.id}" ${canMutate('phien-cho.reconciliation.process', s, [S.WAITING_RECONCILIATION]) ? '' : 'disabled'}>Chạy đối soát</button>
      <div class="note info" style="margin-top:10px">Online: system payments vs mock bank statement. Cash: cash payment total vs receipt total vs submitted amount.</div>
    </div></div>
    <div class="card"><div class="card-h"><h3>Exceptions</h3></div><div class="card-b">${U.table([{ t: 'ID' }, { t: 'Type' }, { t: 'Expected', num: true }, { t: 'Actual', num: true }, { t: 'Difference', num: true }, { t: 'Status' }, { t: 'Reason' }, { t: '' }], rows)}</div></div></div>`;
  }
  function validationView(s) {
    return `<div class="card"><div class="card-h"><h3>Validation cases bắt buộc</h3></div><div class="card-b">
      <div class="grid g2">
        ${[
          'Đăng ký ngoài thời gian / session chưa mở / đã đóng: validate trước mutation.',
          'Vượt max stalls, hết capacity, duplicate registration: validate và không mutation.',
          'Hai merchant tranh capacity cuối: confirmation/conditional hold check lại capacity.',
          'Online payment fake callback 2 lần: payment SUCCESS không xử lý lại.',
          'Online đã thanh toán nhưng cố thu cash: handler deny nếu paidAmount >= totalAmount.',
          'Cash không đến / đến sau deadline: CONDITIONAL_HOLD -> NO_SHOW, release capacity, không tạo debt/payment.',
          'Waiting list promotion: manual, permission + capacity + business state.',
          'Thay giá sau registration: pricingSnapshot cũ không đổi.',
          'Session cancel sau payment: giữ payment SUCCESS, hiển thị NEED_CONFIRMATION refund/reversal.',
          'Đóng session khi còn exception: blocked nếu OPEN/IN_REVIEW.',
          'Cash submitted mismatch / payment reference mismatch: tạo ReconciliationException.',
          'Screen permission không đồng nghĩa action permission: UI disabled, handler check lại.',
          'Permission đúng nhưng marketScopes/SelectedMarket/Business State sai: DENY.'
        ].map(x => `<div class="note info">${U.esc(x)}</div>`).join('')}
      </div>
      <div class="divider"></div><button class="btn" data-act="ms-price-change" data-id="${s.id}" ${canMutate('phien-cho.edit', s, [S.DRAFT, S.SCHEDULED, S.REGISTRATION_OPEN]) ? '' : 'disabled'}>Giả lập đổi bảng giá hiện tại</button>
    </div></div>`;
  }
  A.VIEWS['phien-cho'] = function () {
    ensureModel();
    if (!screenOk()) return '<div class="empty">Màn Phiên chợ quê chỉ áp dụng cho chợ phiên trong phạm vi tài khoản hiện tại.</div>';
    const s = currentSession();
    if (!s) return '<div class="empty">Chưa có phiên chợ quê.</div>';
    const tab = ui.msTab || 'overview';
    const body = tab === 'registrations' ? registrationsView(s)
      : tab === 'merchant' ? merchantFlow(s)
      : tab === 'checkin' ? checkinView(s)
      : tab === 'payments' ? paymentsView(s)
      : tab === 'waiting' ? waitingView(s)
      : tab === 'recon' ? reconView(s)
      : tab === 'validation' ? validationView(s)
      : overview(s);
    return `<div class="note info">Workflow này dùng RBAC hiện có: screen permission + action permission + Account.marketScopes + SelectedMarket + market.kind=session + business state. Action mới mặc định DEFAULT DENY cho tới khi admin cấp quyền.</div>
      ${sessionSelector(s)}
      <div class="card"><div class="card-b row" style="padding-top:14px;flex-wrap:wrap"><b>${U.esc(s.name)}</b>${tag(s.status)}<span class="small muted">${s.code} · ${U.dmy(s.sessionDate)} · còn ${availableStalls(s)} quầy</span></div></div>
      ${tabsHtml(tab)}${body}`;
  };

  A.CH['ms-select'] = el => { ui.sessionId = el.value; ui.msTab = 'overview'; A.render(); };
  A.ACT['ms-pick'] = el => { ui.sessionId = el.dataset.id; ui.msTab = 'overview'; A.render(); };
  A.ACT['ms-tab'] = el => { ui.msTab = el.dataset.id; A.render(); };
  A.CH['ms-form'] = el => { ui.msForm = ui.msForm || {}; ui.msForm[el.dataset.k] = el.value; A.render(); };
  A.CH['ms-form-check'] = el => { ui.msForm = ui.msForm || {}; ui.msForm[el.dataset.k] = el.checked; A.render(); };

  A.ACT['ms-create'] = () => {
    ensureModel();
    if (!canAction('phien-cho.create', ui.market)) return deny();
    const cats = Array.from(new Set(A.db.stalls.filter(s => s.market === ui.market && U.rentalKind(s) === 'session').map(s => s.cat))).slice(0, 4);
    const cfg = activePricing(ui.market);
    const code = 'PC-' + ui.market + '-' + String(Date.now()).slice(-6);
    const s = mkSession(ui.market, code, 'Phiên chợ quê mới', '2026-10-10', S.DRAFT, 25, cats, cfg);
    s.id = code; s.code = code; s.marketId = ui.market; s.createdBy = actor(); s.createdAt = today();
    A.db.marketSessions.unshift(s); ui.sessionId = s.id; ui.msTab = 'overview';
    U.log('Tạo phiên chợ quê ' + s.code);
    A.save(); A.render(); U.toast('Đã tạo phiên DRAFT');
  };
  A.ACT['ms-action'] = el => {
    const s = A.db.marketSessions.find(x => x.id === el.dataset.id);
    const a = el.dataset.action;
    const next = {
      'phien-cho.schedule': [S.DRAFT, S.SCHEDULED, 'Đã lên lịch phiên'],
      'phien-cho.registration.open': [S.SCHEDULED, S.REGISTRATION_OPEN, 'Phiên chợ đã mở đăng ký.'],
      'phien-cho.registration.close': [S.REGISTRATION_OPEN, S.REGISTRATION_CLOSED, 'Đã đóng đăng ký'],
      'phien-cho.start': [S.REGISTRATION_CLOSED, S.IN_PROGRESS, 'Phiên đã bắt đầu'],
      'phien-cho.end': [S.IN_PROGRESS, S.WAITING_RECONCILIATION, 'Đã kết thúc phiên, chuyển sang chờ đối soát'],
      'phien-cho.cancel': [[S.DRAFT, S.SCHEDULED, S.REGISTRATION_OPEN, S.REGISTRATION_CLOSED], S.CANCELLED, 'Đã hủy phiên'],
      'phien-cho.close': [S.WAITING_RECONCILIATION, S.CLOSED, 'Đã đóng phiên']
    }[a];
    if (!next) return;
    const allowed = Array.isArray(next[0]) ? next[0] : [next[0]];
    if (!requireMutate(a, s, allowed, () => a !== 'phien-cho.close' || !A.db.sessionReconExceptions.some(e => e.sessionId === s.id && (e.status === E.OPEN || e.status === E.IN_REVIEW)))) return;
    s.status = next[1]; s.updatedBy = actor(); s.updatedAt = today();
    if (a === 'phien-cho.cancel') {
      regs(s.id).forEach(r => {
        if (paidAmount(r) > 0) r.note = (r.note ? r.note + ' | ' : '') + 'NEED_CONFIRMATION refund/reversal, payment SUCCESS được giữ lại.';
        else r.status = R.CANCELLED;
      });
      if (regs(s.id).some(r => paidAmount(r) > 0)) U.toast('NEED_CONFIRMATION: phiên có payment SUCCESS, chưa tự xử lý refund/reversal.');
    }
    if (a === 'phien-cho.registration.open') sendRegistrationOpenNotification(s);
    if (a === 'phien-cho.start') autoNoShow(s);
    if (a === 'phien-cho.registration.close') U.toast('Đăng ký bổ sung cần permission riêng và business rule. DEFAULT DENY.');
    U.log(next[2] + ': ' + s.code);
    A.save(); A.render(); U.toast(next[2]);
  };
  A.ACT['ms-register'] = el => {
    const s = A.db.marketSessions.find(x => x.id === el.dataset.id), f = ui.msForm || {};
    const n = Number(f.stalls || 1), cat = f.cat || (s.allowedBusinessCategories || [])[0], traderId = f.traderId;
    const method = f.method || 'ONLINE';
    const reasons = validateRegistration(s, traderId, n, cat, !!f.waiting);
    if (reasons.length) { U.toast(reasons[0]); return; }
    const isWaiting = availableStalls(s) < n;
    const snap = snapshotAmount(n, s.marketId);
    const reg = {
      id: seq('DK', A.db.sessionRegistrations), code: 'DK-' + s.code.slice(-8) + '-' + U.pad(A.db.sessionRegistrations.length + 1, 3),
      sessionId: s.id, marketId: s.marketId, merchantId: traderId, requestedStalls: n, businessCategory: cat,
      status: isWaiting ? R.WAITING_LIST : R.CREATED, paymentMethod: method, pricingSnapshot: snap, totalAmount: snap.totalAmount,
      createdBy: actor(), createdAt: today(), note: isWaiting ? 'Manual promotion - NEED_CONFIRMATION thứ tự ưu tiên' : ''
    };
    if (!isWaiting) {
      if (method === 'ONLINE') {
        reg.status = R.WAITING_PAYMENT;
        A.db.sessionPayments.push({ id: seq('PM', A.db.sessionPayments), sessionId: s.id, registrationId: reg.id, marketId: s.marketId, method: 'ONLINE', status: P.WAITING_PAYMENT, amount: snap.totalAmount, reference: 'MOCK-' + reg.code, createdAt: today(), paidAt: null });
      } else {
        if (availableStalls(s) < n) return deny('DENY: capacity vừa thay đổi, không còn đủ quầy.');
        reg.status = R.CONDITIONAL_HOLD;
      }
    }
    A.db.sessionRegistrations.push(reg);
    A.save(); A.render(); U.toast(isWaiting ? 'Đã đưa vào danh sách chờ' : method === 'CASH' ? 'Giữ suất có điều kiện - thanh toán tại phiên' : 'Đã tạo đăng ký, chờ thanh toán online');
  };
  A.ACT['ms-pay-success'] = el => {
    const r = A.db.sessionRegistrations.find(x => x.id === el.dataset.id), s = A.db.marketSessions.find(x => x.id === r.sessionId);
    if (!requireMutate('phien-cho.registration.create', s, [S.REGISTRATION_OPEN, S.REGISTRATION_CLOSED, S.IN_PROGRESS])) return;
    if (r.status !== R.WAITING_PAYMENT) return deny('DENY: đăng ký không ở trạng thái chờ thanh toán.');
    if (paidAmount(r) >= r.totalAmount) return deny('DENY: payment đã SUCCESS, không xử lý lại.');
    if (availableStalls(s) < r.requestedStalls) return deny('DENY: không còn capacity tại thời điểm bank callback.');
    const p = paymentsFor(r.id).find(x => x.method === 'ONLINE') || null;
    if (!p || p.status === P.SUCCESS || p.status === P.RECONCILED) return deny('DENY: payment callback đã xử lý.');
    const receipt = A.completeSessionOnlinePayment(r, s, p, actor());
    if (!receipt) return deny('DENY: không thể hoàn tất callback do sai trạng thái nghiệp vụ.');
    U.log('Thanh toán online thành công đăng ký ' + r.code + ', phát hành biên lai ' + receipt.receiptNumber);
    A.save(); A.render(); U.toast('Fake callback SUCCESS -> đã phát hành biên lai và gửi Mini app');
  };
  A.ACT['ms-reg-cancel'] = el => {
    const r = A.db.sessionRegistrations.find(x => x.id === el.dataset.id), s = A.db.marketSessions.find(x => x.id === r.sessionId);
    if (!requireMutate('phien-cho.registration.cancel', s, [S.REGISTRATION_OPEN, S.REGISTRATION_CLOSED, S.IN_PROGRESS])) return;
    if (paidAmount(r) > 0) U.toast('NEED_CONFIRMATION: đã có payment SUCCESS, không tự refund/reversal.');
    r.status = R.CANCELLED; r.cancelledBy = actor(); r.cancelledAt = today();
    A.save(); A.render(); U.toast('Đã hủy đăng ký và giải phóng suất nếu có');
  };
  function autoNoShow(s) {
    regs(s.id).filter(r => r.status === R.CONDITIONAL_HOLD).forEach(r => markNoShow(r, false));
  }
  function markNoShow(r, persist) {
    r.status = R.NO_SHOW; r.noShowAt = today();
    A.db.merchantParticipationHistory.push({ merchantId: r.merchantId, sessionId: r.sessionId, status: R.NO_SHOW, at: today(), note: 'No-show không tạo công nợ/payment/phạt tiền. NEED_CONFIRMATION cashEligibility threshold.' });
    if (persist !== false) { A.save(); A.render(); }
  }
  A.ACT['ms-noshow'] = el => {
    const r = A.db.sessionRegistrations.find(x => x.id === el.dataset.id), s = A.db.marketSessions.find(x => x.id === r.sessionId);
    if (!requireMutate('phien-cho.checkin', s, [S.IN_PROGRESS, S.REGISTRATION_CLOSED, S.REGISTRATION_OPEN])) return;
    if (r.status !== R.CONDITIONAL_HOLD) return deny();
    markNoShow(r); U.toast('CONDITIONAL_HOLD -> NO_SHOW, capacity released, no debt/payment created');
  };
  A.ACT['ms-checkin'] = el => {
    const r = A.db.sessionRegistrations.find(x => x.id === el.dataset.id), s = A.db.marketSessions.find(x => x.id === r.sessionId);
    if (!requireMutate('phien-cho.checkin', s, [S.IN_PROGRESS])) return;
    if (r.status !== R.CONFIRMED && r.status !== R.CONDITIONAL_HOLD) return deny();
    r.status = R.CHECKED_IN; r.checkedInBy = actor(); r.checkedInAt = today();
    if (r.paymentMethod === 'ONLINE' && paidAmount(r) >= r.totalAmount) r.status = R.PARTICIPATING;
    A.save(); A.render(); U.toast(r.status === R.PARTICIPATING ? 'Online paid: CHECKED_IN -> PARTICIPATING' : 'Cash: CHECKED_IN, chờ thu tiền mặt');
  };
  A.ACT['ms-cash'] = el => {
    const r = A.db.sessionRegistrations.find(x => x.id === el.dataset.id), s = A.db.marketSessions.find(x => x.id === r.sessionId);
    if (!requireMutate('phien-cho.cash.collect', s, [S.IN_PROGRESS])) return;
    if (r.paymentMethod !== 'CASH' || r.status !== R.CHECKED_IN) return deny('DENY: chỉ thu cash cho đăng ký CASH đã check-in.');
    if (paidAmount(r) >= r.totalAmount) return deny('DENY: đã thanh toán đủ, không thu hai lần.');
    const due = r.totalAmount - paidAmount(r);
    A.db.sessionPayments.push({ id: seq('PM', A.db.sessionPayments), sessionId: s.id, registrationId: r.id, marketId: s.marketId, method: 'CASH', status: P.SUCCESS, amount: due, reference: 'CASH-' + r.code, createdAt: today(), paidAt: today(), collector: actor() });
    const receipt = { id: seq('RC', A.db.sessionReceipts), sessionId: s.id, registrationId: r.id, receiptNumber: 'BLP-' + U.pad(A.db.sessionReceipts.length + 1, 5), amount: due, collectedBy: actor(), collectedAt: today() };
    A.db.sessionReceipts.push(receipt);
    r.status = R.PARTICIPATING; r.receiptNumber = receipt.receiptNumber;
    A.save(); A.render(); U.toast('Đã thu tiền mặt, tạo mock payment + receipt');
  };
  A.ACT['ms-promote'] = el => {
    const r = A.db.sessionRegistrations.find(x => x.id === el.dataset.id), s = A.db.marketSessions.find(x => x.id === r.sessionId);
    if (!requireMutate('phien-cho.waitingList.promote', s, [S.REGISTRATION_OPEN, S.REGISTRATION_CLOSED, S.IN_PROGRESS])) return;
    if (r.status !== R.WAITING_LIST || availableStalls(s) < r.requestedStalls) return deny('DENY: không thể promote do trạng thái/capacity.');
    r.status = r.paymentMethod === 'CASH' ? R.CONDITIONAL_HOLD : R.WAITING_PAYMENT;
    if (r.paymentMethod === 'ONLINE' && !paymentsFor(r.id).length) A.db.sessionPayments.push({ id: seq('PM', A.db.sessionPayments), sessionId: s.id, registrationId: r.id, marketId: s.marketId, method: 'ONLINE', status: P.WAITING_PAYMENT, amount: r.totalAmount, reference: 'MOCK-' + r.code, createdAt: today() });
    A.save(); A.render(); U.toast('Đã promote thủ công từ danh sách chờ');
  };
  A.ACT['ms-reconcile'] = el => {
    const s = A.db.marketSessions.find(x => x.id === el.dataset.id);
    if (!requireMutate('phien-cho.reconciliation.process', s, [S.WAITING_RECONCILIATION])) return;
    A.db.sessionPayments.filter(p => p.sessionId === s.id && p.method === 'ONLINE' && p.status === P.SUCCESS).forEach((p, i) => {
      if (i === 0 && !A.db.sessionReconExceptions.some(e => e.paymentId === p.id && e.type === 'REFERENCE_MISMATCH')) {
        A.db.sessionReconExceptions.push({ id: seq('EX', A.db.sessionReconExceptions), sessionId: s.id, type: 'REFERENCE_MISMATCH', paymentId: p.id, expectedAmount: p.amount, actualAmount: p.amount, difference: 0, reason: 'Mock bank statement reference mismatch', status: E.OPEN, handledBy: null, handledAt: null, resolutionNote: '' });
      } else p.status = P.RECONCILED;
    });
    const cash = A.db.sessionPayments.filter(p => p.sessionId === s.id && p.method === 'CASH' && p.status === P.SUCCESS);
    const systemCash = U.sum(cash, p => p.amount), receiptTotal = U.sum(A.db.sessionReceipts.filter(r => r.sessionId === s.id), r => r.amount), submitted = Math.max(0, systemCash - 100000);
    if (systemCash && systemCash !== submitted && !A.db.sessionReconExceptions.some(e => e.sessionId === s.id && e.type === 'CASH_SUBMITTED_MISMATCH')) {
      A.db.sessionReconExceptions.push({ id: seq('EX', A.db.sessionReconExceptions), sessionId: s.id, type: 'CASH_SUBMITTED_MISMATCH', collectorId: 'mock-collector', expectedAmount: receiptTotal, actualAmount: submitted, difference: submitted - receiptTotal, reason: 'Cash submitted amount mismatch', status: E.OPEN, handledBy: null, handledAt: null, resolutionNote: '' });
    }
    A.save(); A.render(); U.toast('Đã chạy đối soát mock; exception OPEN sẽ chặn đóng phiên');
  };
  function handleException(id, accepted) {
    const e = A.db.sessionReconExceptions.find(x => x.id === id), s = A.db.marketSessions.find(x => x.id === e.sessionId);
    if (!requireMutate('phien-cho.reconciliation.exception.resolve', s, [S.WAITING_RECONCILIATION])) return;
    e.status = accepted ? E.ACCEPTED_WITH_REASON : E.RESOLVED;
    e.handledBy = actor(); e.handledAt = today(); e.resolutionNote = accepted ? 'Chấp nhận chênh lệch có lý do (mock).' : 'Đã xử lý ngoại lệ (mock).';
    A.save(); A.render(); U.toast(accepted ? 'Đã ACCEPTED_WITH_REASON' : 'Đã RESOLVED');
  }
  A.ACT['ms-ex-resolve'] = el => handleException(el.dataset.id, false);
  A.ACT['ms-ex-accept'] = el => handleException(el.dataset.id, true);
  A.ACT['ms-price-change'] = el => {
    const s = A.db.marketSessions.find(x => x.id === el.dataset.id);
    if (!requireMutate('phien-cho.edit', s, [S.DRAFT, S.SCHEDULED, S.REGISTRATION_OPEN])) return;
    s.pricingConfig.unitPrice += 5000;
    A.save(); A.render(); U.toast('Đã đổi pricingConfig hiện tại; pricingSnapshot của registration cũ không đổi.');
  };
})(window.APP);
