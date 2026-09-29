/* Mini app tiểu thương (mô phỏng trong khung điện thoại). */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const mini = () => ui.mini;

  function activeRole() {
    return A.PERM.role(ui.role);
  }
  function miniMarkets() {
    return A.allowedMarkets(A.currentAccount());
  }
  function inMiniScopeMarket(market) {
    return miniMarkets().indexOf(market) !== -1;
  }
  function isTraderMini() {
    const role = activeRole();
    return !!(role && role.selfService);
  }
  function isCollectorMini() {
    return A.canDirectCollect(ui.market);
  }
  function isSessionMarket(market) {
    const m = U.market(market);
    return !!m && m.kind === 'session';
  }
  function canTraderRegisterStall(market) {
    return U.can('mini-app') && isTraderMini() && isSessionMarket(market) && A.canDo('mini-app.stall-registration.create', market);
  }
  function miniSessionStatusFromOps(s) {
    if (!s) return 'SCHEDULED';
    if (s.status === 'open') return 'REGISTRATION_OPEN';
    if (s.status === 'registration_closed' || s.status === 'preparing' || s.status === 'active' || s.status === 'pending_close') return 'REGISTRATION_CLOSED';
    if (s.status === 'closed') return 'COMPLETED';
    if (s.status === 'cancelled') return 'CANCELLED';
    if (s.status === 'postponed') return 'POSTPONED';
    return 'SCHEDULED';
  }
  function miniOpenCloseDate(s, status) {
    const deadline = (s && s.registrationDeadline || '').slice(0, 10);
    if (status !== 'REGISTRATION_OPEN') return deadline || (s && s.date) || U.today();
    return [deadline, U.today(), s && s.date].filter(Boolean).sort().slice(-1)[0];
  }
  function syncOpsSessionsToMiniRegistrationModel() {
    const opsSessions = (A.db.sessions || []).filter(s => s && s.market === 'TTD' && s.id && s.date);
    if (!opsSessions.length) return;
    const sessionPoints = A.db.stalls.filter(s => s.market === 'TTD' && U.rentalKind(s) === 'session');
    const cats = Array.from(new Set(sessionPoints.map(s => s.cat).filter(Boolean))).slice(0, 4);
    const pricing = miniSessionPricing('TTD');
    opsSessions.forEach(s => {
      let ms = A.db.marketSessions.find(x => x.id === s.id);
      if (!ms) {
        ms = { id: s.id, code: s.id, marketId: 'TTD' };
        A.db.marketSessions.push(ms);
      }
      const wasOpen = ms.status === 'REGISTRATION_OPEN';
      const status = miniSessionStatusFromOps(s);
      const closeAt = miniOpenCloseDate(s, status);
      Object.assign(ms, {
        code: s.id,
        marketId: 'TTD',
        name: 'Phiên chợ quê thứ Bảy ' + U.dmy(s.date),
        sessionDate: s.date,
        startTime: s.startTime || '14:00',
        endTime: s.endTime || '20:00',
        registrationOpenAt: status === 'REGISTRATION_OPEN' ? U.today() : ((s.registrationStartAt || U.today()).slice(0, 10)),
        registrationCloseAt: closeAt,
        totalStalls: Math.max(1, Number(ms.totalStalls) || Math.min(sessionPoints.length || 24, 99)),
        maxStallsPerMerchant: Number(ms.maxStallsPerMerchant) || 2,
        allowedBusinessCategories: (ms.allowedBusinessCategories && ms.allowedBusinessCategories.length) ? ms.allowedBusinessCategories : (cats.length ? cats : ['Ẩm thực', 'Nông sản', 'Thủ công']),
        pricingConfig: ms.pricingConfig || { unitPrice: pricing.unitPrice, additionalFees: pricing.additionalFees, source: pricing.source },
        cashPaymentEnabled: ms.cashPaymentEnabled !== false,
        onlinePaymentEnabled: ms.onlinePaymentEnabled !== false,
        waitingListEnabled: ms.waitingListEnabled !== false,
        status,
        createdBy: ms.createdBy || s.createdBy || 'Điều hành phiên chợ',
        createdAt: ms.createdAt || s.createdAt || U.today(),
        updatedBy: s.updatedBy || ms.updatedBy || 'Điều hành phiên chợ',
        updatedAt: s.updatedAt || ms.updatedAt || U.today()
      });
      if (wasOpen && status !== 'REGISTRATION_OPEN') ms.registrationOpenAt = (s.registrationStartAt || ms.registrationOpenAt || U.today()).slice(0, 10);
    });
  }
  function ensureMiniRegistrationModel() {
    A.db.marketSessions = A.db.marketSessions || [];
    A.db.sessionRegistrations = A.db.sessionRegistrations || [];
    A.db.sessionPayments = A.db.sessionPayments || [];
    A.db.sessionReceipts = A.db.sessionReceipts || [];
    // Keep the legacy collection shape for existing persisted mock state; Q3
    // removes the portal flow that creates records in it.
    A.db.fixedStallApplications = A.db.fixedStallApplications || [];
    if (!A.db.marketSessions.some(s => s.marketId === 'TTD')) {
      const cats = Array.from(new Set(A.db.stalls.filter(s => s.market === 'TTD' && U.rentalKind(s) === 'session').map(s => s.cat))).slice(0, 4);
      const pricing = miniSessionPricing('TTD');
      A.db.marketSessions.push(
        miniSession('PC-TTD-20260919', 'Phiên chợ quê thứ Bảy 19/09/2026', '2026-09-19', 'REGISTRATION_OPEN', 24, cats, pricing),
        miniSession('PC-TTD-20260926', 'Phiên chợ quê thứ Bảy 26/09/2026', '2026-09-26', 'SCHEDULED', 30, cats, pricing)
      );
    }
    syncOpsSessionsToMiniRegistrationModel();
    syncPaidSessionRegistrationsToOfficial();
  }
  function miniSessionPricing(mid) {
    const services = A.SERVICE_CFG && A.SERVICE_CFG.list ? (A.SERVICE_CFG.list('extraServices') || []) : [];
    return {
      unitPrice: D.SESSION_FEE,
      additionalFees: services.filter(x => x.marketId === mid && x.status === 'active').map(x => ({ name: x.name, amount: x.amount || 0, sourceId: x.id })),
      source: 'DATA.SESSION_FEE'
    };
  }
  function miniSession(id, name, date, status, total, cats, pricing) {
    return {
      id, code: id, marketId: 'TTD', name, sessionDate: date, startTime: '14:00', endTime: '20:00',
      registrationOpenAt: '2026-09-13', registrationCloseAt: date < '2026-09-20' ? '2026-09-18' : '2026-09-24',
      totalStalls: total, maxStallsPerMerchant: 2, allowedBusinessCategories: cats,
      pricingConfig: { unitPrice: pricing.unitPrice, additionalFees: pricing.additionalFees, source: pricing.source },
      cashPaymentEnabled: true, onlinePaymentEnabled: true, waitingListEnabled: true,
      status, createdBy: 'Mini app seed', createdAt: U.today()
    };
  }
  function miniEnsureOpsSession(s) {
    if (!s || s.marketId !== 'TTD') return null;
    A.db.sessions = A.db.sessions || [];
    let ops = A.db.sessions.find(x => x && x.id === s.id);
    if (!ops) {
      ops = {
        id: s.id, market: s.marketId, date: s.sessionDate, startTime: s.startTime || '14:00', endTime: s.endTime || '20:00',
        registrationStartAt: (s.registrationOpenAt || U.today()) + 'T08:00',
        registrationDeadline: (s.registrationCloseAt || s.sessionDate) + 'T17:00',
        status: 'open', note: 'Tự đồng bộ từ phiên đang mở đăng ký trên Mini app',
        createdBy: 'Mini app seed', createdAt: U.today(), updatedBy: 'Mini app seed', updatedAt: U.today()
      };
      A.db.sessions.push(ops);
    }
    return ops;
  }
  function miniSeq(prefix, arr) {
    return prefix + '-' + U.pad((arr ? arr.length : 0) + 1, 4);
  }
  function miniSessionRegs(sessionId) {
    return (A.db.sessionRegistrations || []).filter(r => r.sessionId === sessionId);
  }
  function miniBlocksCapacity(r) {
    return ['registered', 'approved', 'CONDITIONAL_HOLD', 'CONFIRMED', 'CHECKED_IN', 'PARTICIPATING', 'COMPLETED'].indexOf(r.status) !== -1;
  }
  function miniCanCollectCashRegistration(reg) {
    return reg && ['registered', 'approved', 'CONDITIONAL_HOLD'].indexOf(reg.status) !== -1;
  }
  function miniAvailableStalls(s) {
    return Math.max(0, s.totalStalls - U.sum(miniSessionRegs(s.id).filter(miniBlocksCapacity), r => r.requestedStalls));
  }
  function miniReservedPointIds(sessionId) {
    return new Set(miniSessionRegs(sessionId).filter(r => ['CANCELLED', 'REJECTED', 'PAYMENT_EXPIRED', 'NO_SHOW', 'rejected', 'withdrawn'].indexOf(r.status) === -1).map(r => r.pointId).filter(Boolean));
  }
  function miniSessionAvailablePoints(s, cat) {
    if (!s) return [];
    const reserved = miniReservedPointIds(s.id);
    return A.db.stalls.filter(st => st.market === s.marketId && U.rentalKind(st) === 'session' && st.status === 'trong' && !st.traderId && !reserved.has(st.id) && (!cat || st.cat === cat))
      .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'vi'));
  }
  function miniSessionReceiptsForTrader(t) {
    ensureMiniRegistrationModel();
    return A.db.sessionReceipts.filter(rc => rc.merchantId === t.id && rc.marketId === t.market).slice().sort((a, b) => (b.issuedAt || b.collectedAt || '').localeCompare(a.issuedAt || a.collectedAt || ''));
  }
  function miniSessionPaymentForReg(reg) {
    return (A.db.sessionPayments || []).find(p => p.registrationId === reg.id && p.method === 'ONLINE') || null;
  }
  function miniSessionCashPaymentForReg(reg) {
    return (A.db.sessionPayments || []).find(p => p.registrationId === reg.id && p.method === 'CASH') || null;
  }
  function promotePaidSessionRegistration(reg, actor) {
    if (!reg || reg.paymentWorkflowStatus !== 'CONFIRMED') return false;
    if (reg.status === 'rejected' || reg.status === 'withdrawn' || reg.status === 'waitlisted') return false;
    const changed = reg.listType !== 'official' || reg.status !== 'approved' || reg.waitlistOrder != null;
    if (!changed) return false;
    reg.listType = 'official';
    reg.status = 'approved';
    reg.waitlistOrder = null;
    reg.updatedAt = A.db.today + ' ' + U.nowTime();
    reg.updatedBy = actor || 'Hệ thống xác minh thanh toán';
    const note = 'Hệ thống tự chuyển vào danh sách chính thức sau khi xác minh thanh toán thành công';
    reg.note = reg.note ? (reg.note.indexOf(note) === -1 ? reg.note + ' · ' + note : reg.note) : note;
    return changed;
  }
  function syncPaidSessionRegistrationsToOfficial() {
    (A.db.sessionRegistrations || []).forEach(reg => {
      if (reg && reg.paymentWorkflowStatus === 'CONFIRMED') promotePaidSessionRegistration(reg);
    });
  }
  A.syncPaidSessionRegistrationsToOfficial = syncPaidSessionRegistrationsToOfficial;
  function miniSessionCashDeadline(s) {
    if (!s) return null;
    return (s.sessionDate || s.date || U.today()) + ' ' + (s.attendanceStartTime || s.startTime || '00:00');
  }
  function miniSessionCashDues() {
    ensureMiniRegistrationModel();
    return (A.db.sessionRegistrations || []).map(reg => {
      const s = A.db.marketSessions.find(x => x.id === reg.sessionId);
      const t = A.idx.trader.get(reg.merchantId);
      const p = miniSessionCashPaymentForReg(reg);
      if (!s || !t || !p || reg.marketId !== ui.market || t.market !== ui.market) return null;
      if (reg.paymentMethod !== 'CASH' || !miniCanCollectCashRegistration(reg) || p.status !== 'WAITING_COLLECTION') return null;
      return { reg, session: s, trader: t, payment: p, amount: p.amount || reg.totalAmount || 0, deadline: p.dueAt || miniSessionCashDeadline(s) };
    }).filter(Boolean).sort((a, b) => String(a.deadline || '').localeCompare(String(b.deadline || '')));
  }
  function miniSessionCashSnapshot() {
    return {
      registrations: JSON.stringify(A.db.sessionRegistrations || []),
      sessionPayments: JSON.stringify(A.db.sessionPayments || []),
      sessionReceipts: JSON.stringify(A.db.sessionReceipts || []),
      payments: JSON.stringify(A.db.payments || []),
      log: JSON.stringify(A.db.extraLog || [])
    };
  }
  function miniRestoreSessionCashSnapshot(snap) {
    A.db.sessionRegistrations = JSON.parse(snap.registrations);
    A.db.sessionPayments = JSON.parse(snap.sessionPayments);
    A.db.sessionReceipts = JSON.parse(snap.sessionReceipts);
    A.db.payments = JSON.parse(snap.payments);
    A.db.extraLog = JSON.parse(snap.log);
    A.reindex();
  }
  function miniSessionReceiptNumber() {
    return 'BL-PC-' + U.today().replace(/-/g, '').slice(2) + '-' + U.pad((A.db.sessionReceipts || []).length + 1, 5);
  }
  function miniSessionBankRef(reg) {
    return 'TTD ' + (reg && (reg.code || reg.id)) + ' CHO QUE';
  }
  function miniCanPaySessionRegistration(t, reg) {
    if (!t || !reg) return false;
    const s = A.db.marketSessions.find(x => x.id === reg.sessionId), p = miniSessionPaymentForReg(reg);
    if (!s || !p) return false;
    if (!canTraderRegisterStall(reg.marketId) || !inMiniScopeMarket(reg.marketId) || reg.marketId !== ui.market) return false;
    if (reg.merchantId !== t.id || t.market !== reg.marketId) return false;
    if (s.marketId !== reg.marketId || p.marketId !== reg.marketId) return false;
    if (['registered', 'WAITING_PAYMENT'].indexOf(reg.status) === -1 || p.status !== 'WAITING_PAYMENT' || reg.paymentMethod !== 'ONLINE') return false;
    return miniAvailableStalls(s) >= reg.requestedStalls;
  }
  A.completeSessionOnlinePayment = function (reg, session, payment, actor) {
    ensureMiniRegistrationModel();
    if (!reg || !session || !payment) return null;
    const t = A.idx.trader.get(reg.merchantId);
    if (!t || t.market !== reg.marketId || session.marketId !== reg.marketId || payment.marketId !== reg.marketId) return null;
    if (['registered', 'WAITING_PAYMENT'].indexOf(reg.status) === -1 || payment.status !== 'WAITING_PAYMENT' || reg.paymentMethod !== 'ONLINE') return null;
    const time = U.nowTime();
    const receiptNumber = miniSessionReceiptNumber();
    const payNo = A.db.payments.length + 1;
    payment.status = 'RECONCILED';
    payment.paidAt = A.db.today + ' ' + time;
    payment.reconciledAt = A.db.today + ' ' + time;
    payment.receiptNumber = receiptNumber;
    reg.paymentWorkflowStatus = 'CONFIRMED';
    reg.receiptNumber = receiptNumber;
    reg.confirmedAt = A.db.today + ' ' + time;
    promotePaidSessionRegistration(reg, actor || 'Mini app');

    const ledgerPayment = {
      id: 'GD' + U.pad(payNo, 6), invoiceId: null, market: reg.marketId, traderId: reg.merchantId,
      amount: payment.amount, method: 'qr', date: A.db.today, time, by: actor || 'Mini app',
      receipt: receiptNumber, lookup: Math.random().toString(36).slice(2, 8).toUpperCase(),
      paymentStatus: 'SUCCESS', paidAt: A.db.today + ' ' + time, receiptIssuedAt: A.db.today + ' ' + time,
      reconciled: true, sourceType: 'SESSION_REGISTRATION', sessionId: session.id,
      registrationId: reg.id, sessionPaymentId: payment.id,
      receiptDelivery: { miniApp: true, sentAt: A.db.today + ' ' + time, status: 'SENT_MOCK' },
      printStatus: 'PENDING'
    };
    A.db.payments.push(ledgerPayment);

    const receipt = {
      id: 'RC-' + U.pad(A.db.sessionReceipts.length + 1, 5), receiptNumber,
      paymentId: ledgerPayment.id, sessionPaymentId: payment.id, sessionId: session.id,
      registrationId: reg.id, marketId: reg.marketId, merchantId: reg.merchantId,
      amount: payment.amount, method: 'ONLINE', issuedAt: A.db.today + ' ' + time,
      sentToMiniAppAt: A.db.today + ' ' + time, printStatus: 'PENDING'
    };
    A.db.sessionReceipts.push(receipt);

    A.db.bank.push({
      id: 'SK' + U.pad(A.db.bank.length + 1, 4), date: A.db.today, time, amount: payment.amount,
      ref: miniSessionBankRef(reg), market: reg.marketId,
      bankName: (D.BANK_BY_MARKET && D.BANK_BY_MARKET[reg.marketId]) || 'Vietcombank',
      paymentId: ledgerPayment.id, receivableId: reg.id, receiptId: receiptNumber,
      status: 'MATCHED_AUTO', matched: true, matchedBy: 'Hệ thống', matchedAt: A.db.today + ' ' + time,
      matchMethod: 'AUTO', sourceType: 'SESSION_REGISTRATION',
      log: [
        { at: time, actor: 'Hệ thống', text: 'Nhận báo có QR cho đăng ký phiên ' + (reg.code || reg.id) },
        { at: time, actor: 'Hệ thống', text: 'Tự động phát hành biên lai ' + receiptNumber + ' và gửi Mini app' }
      ]
    });
    A.db.notifications.unshift({
      id: 'TB-' + U.pad(32 + A.db.notifications.length, 3), at: A.db.today,
      title: 'Biên lai ' + receiptNumber + ' đã được phát hành',
      group: 'Chợ quê Tân Thuận Đông', channels: ['Mini app'], sent: 1, delivered: 1, read: 0, auto: true,
      kind: 'SESSION_PAYMENT_SUCCESS', sessionId: session.id, receiptId: receipt.id,
      merchantId: reg.merchantId, text: 'Thanh toán QR thành công cho ' + (reg.code || reg.id)
    });
    U.log('Thanh toán QR phiên chợ quê ' + (reg.code || reg.id) + ', phát hành ' + receiptNumber);
    return receipt;
  };
  A.completeSessionCashPayment = function (reg, session, payment, actor) {
    ensureMiniRegistrationModel();
    if (!reg || !session || !payment) return null;
    const t = A.idx.trader.get(reg.merchantId);
    if (!t || t.market !== reg.marketId || session.marketId !== reg.marketId || payment.marketId !== reg.marketId) return null;
    if (!miniCanCollectCashRegistration(reg) || reg.paymentMethod !== 'CASH' || payment.method !== 'CASH' || payment.status !== 'WAITING_COLLECTION') return null;
    if (!A.canDirectCollect(reg.marketId)) return null;
    const deadline = payment.dueAt || miniSessionCashDeadline(session);
    if (deadline && (A.db.today + ' ' + U.nowTime()) > deadline) return null;
    const time = U.nowTime();
    const receiptNumber = miniSessionReceiptNumber();
    const payNo = A.db.payments.length + 1;
    payment.status = 'SUCCESS';
    payment.collectedAt = A.db.today + ' ' + time;
    payment.collectedBy = actor || collectorActor();
    payment.receiptNumber = receiptNumber;
    reg.paymentWorkflowStatus = 'CONFIRMED';
    reg.receiptNumber = receiptNumber;
    reg.confirmedAt = A.db.today + ' ' + time;
    promotePaidSessionRegistration(reg, actor || collectorActor());

    const ledgerPayment = {
      id: 'GD' + U.pad(payNo, 6), invoiceId: null, market: reg.marketId, traderId: reg.merchantId,
      amount: payment.amount, method: 'tm', date: A.db.today, time, by: payment.collectedBy,
      receipt: receiptNumber, lookup: Math.random().toString(36).slice(2, 8).toUpperCase(),
      paymentStatus: 'SUCCESS', paidAt: A.db.today + ' ' + time, receiptIssuedAt: A.db.today + ' ' + time,
      reconciled: null, sourceType: 'SESSION_REGISTRATION', sessionId: session.id,
      registrationId: reg.id, sessionPaymentId: payment.id,
      receiptDelivery: { miniApp: true, sentAt: A.db.today + ' ' + time, status: 'SENT_MOCK' },
      printStatus: 'PENDING'
    };
    A.db.payments.push(ledgerPayment);

    const receipt = {
      id: 'RC-' + U.pad(A.db.sessionReceipts.length + 1, 5), receiptNumber,
      paymentId: ledgerPayment.id, sessionPaymentId: payment.id, sessionId: session.id,
      registrationId: reg.id, marketId: reg.marketId, merchantId: reg.merchantId,
      amount: payment.amount, method: 'CASH', issuedAt: A.db.today + ' ' + time,
      collectedAt: A.db.today + ' ' + time, collectedBy: payment.collectedBy,
      sentToMiniAppAt: A.db.today + ' ' + time, printStatus: 'PENDING'
    };
    A.db.sessionReceipts.push(receipt);
    U.log('Thu tiền mặt đăng ký phiên chợ quê ' + (reg.code || reg.id) + ', phát hành ' + receiptNumber);
    return { receipt, ledgerPayment };
  };
  function miniSnapshotAmount(stalls, mid) {
    const cfg = miniSessionPricing(mid), extras = cfg.additionalFees.map(f => Object.assign({}, f, { amount: f.amount * stalls }));
    return {
      unitPrice: cfg.unitPrice,
      numberOfStalls: stalls,
      stallFee: stalls * cfg.unitPrice,
      additionalFees: extras,
      totalAmount: stalls * cfg.unitPrice + U.sum(extras, f => f.amount),
      source: cfg.source,
      capturedAt: U.today()
    };
  }
  function miniRegBusinessStateReasons(t, form) {
    const reasons = [];
    ensureMiniRegistrationModel();
    if (!t || t.market !== ui.market || !inMiniScopeMarket(t.market)) reasons.push('Tiểu thương không thuộc chợ đang chọn.');
    if (!canTraderRegisterStall(ui.market)) reasons.push('Thiếu screen/action permission hoặc ngoài phạm vi chợ.');
    if (form.kind === 'SESSION') {
      const s = A.db.marketSessions.find(x => x.id === form.sessionId);
      const stalls = Number(form.stalls || 1);
      const cat = form.cat || (s && s.allowedBusinessCategories && s.allowedBusinessCategories[0]);
      const availablePoints = miniSessionAvailablePoints(s, cat);
      const selectedPoint = availablePoints.find(p => p.id === form.pointId);
      if (!s || s.marketId !== ui.market) reasons.push('Phiên không thuộc chợ đang chọn.');
      if (s && s.status !== 'REGISTRATION_OPEN') reasons.push('Phiên chưa mở đăng ký.');
      if (s && !(s.registrationOpenAt <= U.today() && U.today() <= s.registrationCloseAt)) reasons.push('Ngoài thời gian đăng ký.');
      if (!availablePoints.length) reasons.push('Không còn điểm kinh doanh trống phù hợp ngành hàng.');
      if (s && !selectedPoint) reasons.push('Vui lòng chọn điểm kinh doanh còn trống.');
      if (!(stalls > 0)) reasons.push('Số quầy phải lớn hơn 0.');
      if (s && stalls > s.maxStallsPerMerchant) reasons.push('Vượt số quầy tối đa mỗi tiểu thương.');
      if (s && (s.allowedBusinessCategories || []).indexOf(cat) === -1) reasons.push('Ngành hàng không hợp lệ cho phiên.');
      if (s && miniAvailableStalls(s) < stalls && !s.waitingListEnabled) reasons.push('Không còn đủ sức chứa.');
      if (t && s && miniSessionRegs(s.id).some(r => r.merchantId === t.id && ['CANCELLED', 'REJECTED', 'PAYMENT_EXPIRED', 'NO_SHOW'].indexOf(r.status) === -1)) reasons.push('Đã có đăng ký phiên đang hiệu lực hoặc đang xử lý.');
    } else reasons.push('Chỉ hỗ trợ đăng ký theo phiên chợ.');
    return reasons;
  }
  function openRegistrationSessions() {
    ensureMiniRegistrationModel();
    return A.db.marketSessions.filter(s => s.marketId === ui.market && s.status === 'REGISTRATION_OPEN' && s.registrationOpenAt <= U.today() && U.today() <= s.registrationCloseAt);
  }
  function miniCollectingBusinessStateOk(invoices) {
    const p = A.db.billingPeriods.find(x => x.id === ui.period) || A.db.billingPeriods[A.db.billingPeriods.length - 1];
    return invoices.length && p && p.status === 'COLLECTING';
  }
  function collectorActor() {
    const acc = A.currentAccount();
    return acc && D.STAFF.some(s => s.id === acc.code) ? acc.code : (acc ? acc.fullName : 'Mini app thu phí');
  }
  function sampleTraders() {
    const db = A.db, out = [];
    const add = t => { if (t && !out.includes(t)) out.push(t); };
    const scoped = db.traders.filter(t => t.stalls.length && inMiniScopeMarket(t.market));
    add(scoped.find(t => t.market === ui.market && t.app && U.traderOverdue(t.id) > 0));
    add(scoped.find(t => t.market === ui.market && t.app && U.traderDebt(t.id) > 0 && !U.traderOverdue(t.id)));
    add(scoped.find(t => t.market === 'TTD' && U.traderDebt(t.id) > 0));
    scoped.filter(t => U.traderDebt(t.id) > 0).slice(0, 8).forEach(add);
    add(scoped.find(t => !U.traderDebt(t.id)));
    return out.filter(t => t.stalls.length);
  }
  // Giữ nguyên: KHÔNG bắt buộc `t.stalls.length` — 1 trader hợp lệ (tìm được qua tra cứu SĐT, xem
  // luồng đăng nhập mới bên dưới) vẫn phải "đăng nhập" được dù CHƯA có điểm kinh doanh (mục 9 yêu cầu
  // correction — hợp đồng/điểm KD xử lý riêng, trader có thể tồn tại trước khi có contract/point).
  // Không ảnh hưởng dropdown demo hiện có: sampleTraders() vẫn tự lọc chỉ trader có stalls.
  function trader() {
    const m = mini();
    let t = m.traderId ? A.idx.trader.get(m.traderId) : null;
    const acc = A.currentAccount();
    const accountTraderId = acc && (acc.traderId || acc.linkedTraderId);
    if (accountTraderId && (!t || t.id !== accountTraderId || !inMiniScopeMarket(t.market))) t = A.idx.trader.get(accountTraderId) || t;
    if (!t || !inMiniScopeMarket(t.market)) { t = sampleTraders()[0]; if (t) m.traderId = t.id; }
    return t;
  }
  // QUA_HAN_CHUYEN_CONG_NO: khoản đã chuyển công nợ không nộp theo QR thường (chỉ thu hồi nợ).
  const unpaid = t => A.db.invoices.filter(i => i.traderId === t.id && i.status !== 'paid' && !(A.debtOf && A.debtOf(i))).sort((a, b) => a.due.localeCompare(b.due));
  const collectorDebtors = () => {
    const debtors = new Map();
    A.db.invoices.filter(i => i.market === ui.market && i.status !== 'paid').forEach(i => {
      const t = A.idx.trader.get(i.traderId);
      if (!t) return;
      const d = debtors.get(t.id) || { t, n: 0, amt: 0, over: 0 };
      d.n++; d.amt += U.due(i); if (U.isOver(i)) d.over += U.due(i);
      debtors.set(t.id, d);
    });
    return Array.from(debtors.values()).sort((a, b) => b.over - a.over || b.amt - a.amt);
  };

  // Reset luồng đăng nhập/kích hoạt Mini App (SĐT → xác nhận → OTP) về bước đầu — gọi khi đổi tiểu
  // thương mẫu/đăng xuất (đổi danh tính điện thoại thật sự), KHÔNG gọi từ `A.resetMiniRequestState`
  // (đổi account demo Web/BQL không nên làm mất phiên đăng nhập SĐT đang nhập dở trên "điện thoại").
  function miniResetLoginFlow() {
    Object.assign(mini(), { loginStep: 'phone', loginPhone: null, loginTraderId: null });
  }
  // Card "Điểm kinh doanh của tôi" (mục 3 yêu cầu bổ sung) — style m-card/m-list/kv sẵn có, KHÔNG tạo
  // component mới. "Xem chi tiết" tái dùng NGUYÊN action mini-tab có sẵn (chuyển sang tab Hợp đồng,
  // nơi đã có đủ thông tin hợp đồng chi tiết của điểm) — không tạo màn/route mới chỉ để xem thêm.
  const miniOwnsStall = (t, st) => t.stalls.indexOf(st.id) !== -1;
  // THU_HOI_NO — làn Tiểu thương của swimlane (P chốt 29/09/2026): nhận nhắc nợ / thông báo cắt điện, quét QR thu
  // nợ (trả ĐỦ nợ còn lại, nội dung CHOSO CN-… PT-…), nhận biên lai. Quyền: action:mini-app.tra-no-qr (trader) +
  // sở hữu (account.traderId === debt.traderId) + chợ trong marketScopes — kiểm tra lại trong handler.
  function miniDebtCard(t) {
    const acc = A.currentAccount() || {}, own = (acc.traderId || acc.linkedTraderId) === t.id;
    const debts = (A.db.debts || []).filter(d => d.traderId === t.id);
    if (!debts.length) return '';
    const canPay = own && A.canDo('mini-app.tra-no-qr', t.market);
    const row = d => {
      const i = A.idx.invoice.get(d.invoiceId), remain = i ? U.due(i) : d.amount;
      const notes = (A.db.notifications || []).filter(n => n.debtId === d.id && n.traderId === t.id).sort((a, b) => String(a.at).localeCompare(String(b.at)));
      const pays = A.db.payments.filter(p => p.debtId === d.id);
      const tag = d.status === 'OPEN' ? '<span class="tag danger">Còn nợ</span>' : d.status === 'UNRECOVERABLE' ? '<span class="tag danger">⚡ Danh sách cắt điện</span>' : '<span class="tag ok">✓ Đã thanh toán nợ</span>';
      return `<div style="border:1px solid #e3e7ef;border-radius:10px;padding:12px;margin-bottom:10px">
        <div class="row" style="gap:8px;flex-wrap:wrap"><b>${d.id}</b><span class="small muted">khoản ${d.invoiceId} · kỳ ${U.per(d.period)} · hạn ${U.dmy(d.dueDate)}</span><span class="spacer"></span>${tag}</div>
        <div style="margin:6px 0">Số nợ: <b>${U.money(d.status === 'CLOSED' ? d.amount : remain)}</b> · Gian ${d.stallIds.map(id => (A.idx.stall.get(id) || {}).code || id).join(', ')}</div>
        ${notes.length ? `<div class="small" style="margin:6px 0"><b>Thông báo đã nhận</b>${notes.map(n => `<div style="padding:3px 0;border-bottom:1px dashed #e3e7ef">${U.dmy(n.at)} · ${U.esc(n.title)}<div class="muted">${U.esc(n.body || '')}</div></div>`).join('')}</div>` : ''}
        ${d.status === 'OPEN' ? `<div class="row" style="gap:12px;align-items:center;flex-wrap:wrap;margin-top:8px"><div style="font-size:44px;line-height:1;border:1px solid #d9dfeb;border-radius:8px;padding:6px 10px">▦</div>
          <div class="small">QR thu nợ · số tiền cố định <b>${U.money(remain)}</b><br>Nội dung: <b>CHOSO ${d.id} ${d.invoiceId}</b></div><span class="spacer"></span>
          ${canPay ? `<button class="btn primary" data-act="mini-debt-pay" data-id="${d.id}">Quét QR & thanh toán (mô phỏng)</button>` : ''}</div>` : ''}
        ${pays.length ? `<div class="small" style="margin-top:6px">${pays.map(p => `✓ <button class="link-btn" data-act="receipt" data-id="${p.receipt}">${p.receipt}</button> · ${U.esc(D.METHOD[p.method] || p.method)} · ${U.money(p.amount)} · ${U.dmy(p.date)} ${p.time || ''}`).join('<br>')}</div>` : ''}
      </div>`;
    };
    return `<div class="card" style="margin-bottom:14px"><div class="card-h"><div><h3>Công nợ quá hạn của tôi</h3><div class="small muted">Trả đủ số nợ còn lại bằng QR thu nợ hoặc tiền mặt cho NV thu phí. Quá 7 ngày chưa trả: đưa vào danh sách cắt điện.</div></div></div>
      <div class="card-b">${debts.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(row).join('')}</div></div>`;
  }

  function miniPointCard(t, st) {
    const c = st.contractId ? A.idx.contract.get(st.contractId) : null;
    return `<div class="m-card"><b>${st.code}</b><div class="small muted" style="margin:2px 0 8px">${U.esc(st.sectionName)}</div>
      <dl class="kv">
        <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd>
        <dt>Ngành hàng</dt><dd>${U.esc(st.cat) || 'Chưa có thông tin'}</dd>
        <dt>Hợp đồng</dt><dd>${c ? c.id : 'Chưa có hợp đồng hiệu lực'}</dd>
        <dt>Trạng thái</dt><dd>${D.STATUS[st.status] ? D.STATUS[st.status].label : st.status}${st.structuralStatus === 'SPLIT' ? ' · Đã tách' : ''}</dd>
      </dl>
      <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap">
        <button class="btn sm" data-act="mini-tab" data-id="contract">Xem chi tiết</button>
      </div></div>`;
  }

  // ==================== ĐĂNG NHẬP / KÍCH HOẠT MINI APP (CORRECTION — SĐT + OTP) ====================
  // Thay hoàn toàn luồng "đăng ký hồ sơ" cũ: Mini App KHÔNG tạo Trader Profile — chỉ TRA CỨU hồ sơ
  // đã có sẵn (do NV BQL tạo trước) theo SĐT, rồi gửi OTP giả lập để "kích hoạt/đăng nhập". State
  // `m.loginStep` ('phone'|'notfound'|'multi'|'confirm'|'otp'|'locked') + `m.loginPhone` (SĐT đang
  // nhập) + `m.loginTraderId` (id trader vừa tra cứu được, CHỜ xác thực OTP — chưa coi là đã đăng
  // nhập). Không tạo Trader Profile/Contract/BusinessPoint ở bất kỳ bước nào trong luồng này.
  function miniNormalizePhone(p) { return String(p || '').replace(/\D/g, ''); }
  // Tra cứu theo SĐT KHÔNG giới hạn 1 market cụ thể (Mini App phục vụ cả CL/TTD — mục 23 yêu cầu
  // correction "không phá dữ liệu Chợ quê TTD"); mỗi trader tự mang đúng market của mình, account
  // tạo sau đó cũng lấy market TỪ trader (ttCreateLinkedAccount), không hard-code CL.
  function miniFindTradersByPhone(phone) {
    const norm = miniNormalizePhone(phone);
    if (!norm) return [];
    return A.db.traders.filter(t => miniNormalizePhone(t.phone) === norm);
  }
  function screenLoginPhone(t) {
    const m = mini();
    const val = m.loginPhone != null ? m.loginPhone : (t ? t.phone : '');
    return `<div class="m-body" style="justify-content:center;text-align:center">
      <div style="font-size:48px">🪷</div><h3 style="font-size:var(--font-size-lg)">Chợ số Cao Lãnh</h3><div class="small muted">Đăng nhập Mini App</div>
      <div class="small muted" style="margin-top:6px">Nhập số điện thoại đã đăng ký với Ban Quản lý Chợ Cao Lãnh.</div>
      <div class="field" style="text-align:left;margin-top:18px"><label>Số điện thoại</label><input class="input" style="padding:12px" data-in="mini-login-phone" value="${U.esc(val)}" placeholder="09xxxxxxxx"></div>
      <button class="m-btn solid" data-act="mini-login-lookup">Nhận mã đăng nhập</button></div>`;
  }
  function screenLoginNotFound() {
    return `<div class="m-body" style="justify-content:center;text-align:center">
      <div style="font-size:48px">🔍</div><h3>Không tìm thấy hồ sơ tiểu thương</h3>
      <div class="m-card" style="text-align:left"><div class="small">Số điện thoại này chưa được đăng ký trong hệ thống quản lý chợ.<br><br>Vui lòng liên hệ Ban Quản lý Chợ để kiểm tra hoặc cập nhật thông tin.</div></div>
      <button class="btn sm" data-act="mini-login-retry">Nhập lại số điện thoại</button></div>`;
  }
  function screenLoginMulti() {
    return `<div class="m-body" style="justify-content:center;text-align:center">
      <div style="font-size:48px">⚠️</div><h3>Không thể xác định hồ sơ duy nhất</h3>
      <div class="m-card"><div class="small">Vui lòng liên hệ Ban Quản lý.</div></div>
      <button class="btn sm" data-act="mini-login-retry">Nhập lại số điện thoại</button></div>`;
  }
  function screenLoginLocked() {
    return `<div class="m-body" style="justify-content:center;text-align:center">
      <div style="font-size:48px">🔒</div><h3>Tài khoản đã bị khóa</h3>
      <div class="m-card"><div class="small">Tài khoản Mini App của bạn đã bị khóa truy cập. Vui lòng liên hệ Ban Quản lý Chợ để được hỗ trợ.</div></div>
      <button class="btn sm" data-act="mini-login-retry">Nhập lại số điện thoại</button></div>`;
  }
  function screenLoginConfirm() {
    const m = mini(), t = A.idx.trader.get(m.loginTraderId);
    if (!t) { m.loginStep = 'phone'; return screenLoginPhone(trader()); }
    return `<div class="m-body" style="justify-content:center;text-align:center">
      <div style="font-size:40px">✓</div><h3>Đã tìm thấy hồ sơ tiểu thương</h3>
      <div class="m-card" style="text-align:left"><dl class="kv">
        <dt>Họ tên</dt><dd>${U.esc(t.name)}</dd>
        <dt>Mã tiểu thương</dt><dd>${t.id}</dd>
        <dt>Chợ</dt><dd>${U.mShort(t.market)}</dd>
        <dt>SĐT</dt><dd>${U.maskPhone(t.phone)}</dd>
      </dl></div>
      <button class="m-btn solid" data-act="mini-login-send-otp">Gửi mã đăng nhập</button>
      <button class="btn sm" style="margin-top:8px" data-act="mini-login-retry">Nhập lại số điện thoại</button></div>`;
  }
  function screenLoginOtp() {
    const m = mini(), t = A.idx.trader.get(m.loginTraderId);
    return `<div class="m-body" style="justify-content:center;text-align:center">
      <h3>Xác thực số điện thoại</h3><div class="small muted">Mã đăng nhập đã được gửi tới ${t ? U.maskPhone(t.phone) : ''}</div>
      <div class="otp" style="margin:16px 0">${'123456'.split('').map(c => `<input value="${c}" readonly>`).join('')}</div>
      <div class="small muted">(Demo: mã 123456 — OTP GIẢ LẬP, không gửi SMS thật)</div>
      <button class="m-btn solid" data-act="mini-login-verify">Xác nhận</button></div>`;
  }
  function screenLogin(t) {
    const m = mini();
    const step = m.loginStep || 'phone';
    if (step === 'notfound') return screenLoginNotFound();
    if (step === 'multi') return screenLoginMulti();
    if (step === 'locked') return screenLoginLocked();
    if (step === 'confirm') return screenLoginConfirm();
    if (step === 'otp') return screenLoginOtp();
    return screenLoginPhone(t);
  }
  // "Đang chờ"/trạng thái hồ sơ khác ACTIVE (mục 19 yêu cầu correction — Profile lifecycle độc lập
  // với Account access; giữ màn này CHỈ để hiển thị phòng thủ nếu profileStatus khác ACTIVE do dữ
  // liệu cũ/thao tác khác — KHÔNG còn hành động "bổ sung & gửi lại" nào ở Mini App nữa vì không còn
  // luồng nào tạo NEEDS_SUPPLEMENT/PENDING_VERIFICATION từ Mini App).
  function screenProfileStatus(t) {
    const status = t.profileStatus;
    const icon = status === 'NEEDS_SUPPLEMENT' ? '📝' : status === 'INACTIVE' ? '⛔' : '⏳';
    const title = status === 'NEEDS_SUPPLEMENT' ? 'Hồ sơ cần bổ sung' : status === 'INACTIVE' ? 'Hồ sơ đã ngừng hoạt động' : 'Hồ sơ chưa hoạt động';
    const body = status === 'NEEDS_SUPPLEMENT' ? (t.supplementNote || 'Vui lòng liên hệ Ban Quản lý chợ để biết chi tiết cần bổ sung.')
      : 'Vui lòng liên hệ Ban Quản lý Chợ để được hỗ trợ.';
    return `<div class="m-body" style="justify-content:center;text-align:center">
      <div style="font-size:48px">${icon}</div><h3>${title}</h3>
      <div class="m-card" style="text-align:left"><div class="small">${U.esc(body)}</div></div>
      <button class="btn sm" style="margin-top:8px" data-act="mini-logout">Đăng xuất</button></div>`;
  }

  function screenPay(t) {
    const m = mini(), list = unpaid(t), total = U.sum(list, U.due);
    if (m.pay === 'done') {
      const p = m.lastPays || [];
      return `<div class="m-body" style="text-align:center"><div style="font-size:54px;margin-top:20px">✅</div><h3>Thanh toán thành công</h3>
        <div class="m-card" style="text-align:left"><div class="m-list">
          <div class="it"><span class="muted">Số tiền</span><b>${U.money(U.sum(p, x => x.amount))}</b></div>
          <div class="it"><span class="muted">Biên lai</span><span>${p.map(x => x.receipt).join('<br>')}</span></div>
          <div class="it"><span class="muted">Mã tra cứu</span><b>${p[0] ? p[0].lookup : ''}</b></div>
          <div class="it"><span class="muted">Thời gian</span><span>${p[0] ? U.dmy(p[0].date) + ' ' + p[0].time : ''}</span></div></div></div>
        <div class="small muted">Biên lai điện tử đã lưu trong mục Hóa đơn và gửi qua Zalo OA</div>
        <button class="m-btn solid" data-act="mini-home">Về trang chủ</button></div>`;
    }
    const content = 'CHOSO ' + t.id;
    return `<div class="m-body"><button class="btn sm" style="align-self:flex-start" data-act="mini-home">‹ Quay lại</button>
      <div class="m-card" style="text-align:center"><div class="small muted">Quét mã bằng ứng dụng ngân hàng bất kỳ</div>
        <div style="margin:10px auto;width:190px">${U.qr(content + total, 190)}</div>
        <div style="font-size:var(--font-size-kpi);font-weight:800">${U.money(total)}</div><div class="small muted">Nội dung: ${content} · ${list.length} khoản</div></div>
      <div class="m-card small">${list.map(i => `<div class="row" style="padding:3px 0"><span style="flex:1">Kỳ ${U.per(i.period)} · ${U.invStall(i).code}</span><b>${U.money(U.due(i))}</b></div>`).join('')}</div>
      <button class="m-btn solid" data-act="mini-paid">Giả lập: đã chuyển khoản thành công</button></div>`;
  }
  function screenSessionPay(t) {
    const m = mini();
    const reg = (A.db.sessionRegistrations || []).find(r => r.id === m.sessionPayId);
    const s = reg && A.db.marketSessions.find(x => x.id === reg.sessionId);
    const p = reg && miniSessionPaymentForReg(reg);
    if (!miniCanPaySessionRegistration(t, reg) || !s || !p) {
      return `<div class="m-body"><button class="btn sm" style="align-self:flex-start" data-act="mini-session-pay-cancel">‹ Quay lại</button>
        <div class="m-card"><b>Không thể thanh toán</b><div class="small muted" style="margin-top:6px">Đăng ký không còn ở trạng thái chờ thanh toán hoặc không thuộc phạm vi mini app hiện tại.</div></div></div>`;
    }
    const content = miniSessionBankRef(reg);
    return `<div class="m-body"><button class="btn sm" style="align-self:flex-start" data-act="mini-session-pay-cancel">‹ Quay lại</button>
      <div class="m-card" style="text-align:center">
        <div class="small muted">Quét mã bằng ứng dụng ngân hàng bất kỳ</div>
        <div class="mini-qr-card"><div>${U.qr(content + ' ' + p.amount, 178)}</div></div>
        <div style="font-size:var(--font-size-kpi);font-weight:800">${U.money(p.amount)}</div>
        <div class="small muted">Nội dung: ${U.esc(content)}</div>
      </div>
      <div class="m-card small"><div class="m-list">
        <div class="it"><span>Phiên</span><b>${U.dmy(s.sessionDate)}</b></div>
        <div class="it"><span>Đăng ký</span><b>${U.esc(reg.code || reg.id)}</b></div>
        <div class="it"><span>Số quầy</span><b>${reg.requestedStalls}</b></div>
        <div class="it"><span>Trạng thái</span><span class="tag warn">Chờ thanh toán</span></div>
      </div></div>
      <button class="m-btn solid" data-act="mini-session-pay-success" data-id="${reg.id}">Giả lập thanh toán thành công</button></div>`;
  }

  function tabHome(t) {
    const list = unpaid(t), total = U.sum(list, U.due), over = list.filter(U.isOver);
    const notis = notisFor(t).slice(0, 2);
    const mine = A.db.incidents.filter(i => i.traderId === t.id).slice(-2).reverse();
    // "Điểm kinh doanh" — mỗi điểm 1 card riêng (mục 3 yêu cầu bổ sung), tái dùng miniPointCard()
    // (thay vì 1 dòng gọn cũ) để có chỗ cho nút "Gửi yêu cầu tách điểm"/"Xem yêu cầu đang xử lý".
    return `<div class="m-card m-due"><div class="small" style="opacity:.85">Tổng cần thanh toán</div><div class="amt">${U.money(total)}</div>
        ${over.length ? `<div class="small" style="background:rgba(255,255,255,.15);padding:6px 10px;border-radius:8px;margin-bottom:10px">⚠ ${over.length} khoản quá hạn – vui lòng thanh toán sớm</div>` : ''}
        ${total ? '<button class="m-btn" data-act="mini-pay">Thanh toán bằng QR</button>' : '<div class="small">Bạn không có khoản nào cần thanh toán 🎉</div>'}</div>
      ${t.stalls.map(id => miniPointCard(t, A.idx.stall.get(id))).join('')}
      <div class="m-card"><b>Thông báo mới</b><div class="m-list">${notis.map(n => `<div class="it"><span>${U.esc(n.title)}</span><span class="muted small">${U.dmy(n.at).slice(0, 5)}</span></div>`).join('') || '<div class="small muted">Chưa có</div>'}</div></div>
      ${mine.length ? `<div class="m-card"><b>Phản ánh của tôi</b><div class="m-list">${mine.map(i => `<div class="it"><span>${U.esc(i.title)}</span><span class="tag info">${D.INCIDENT_STATES.find(s => s.id === i.state).label}</span></div>`).join('')}</div></div>` : ''}`;
  }
  function tabBills(t) {
    const invs = A.db.invoices.filter(i => i.traderId === t.id).sort((a, b) => b.period.localeCompare(a.period)).slice(0, 8);
    const sessionReceipts = miniSessionReceiptsForTrader(t);
    const open = mini().bill;
    return `<div class="m-card"><b>Hóa đơn & biên lai</b><div class="m-list">${sessionReceipts.map(rc => {
      const s = A.db.marketSessions.find(x => x.id === rc.sessionId), reg = A.db.sessionRegistrations.find(x => x.id === rc.registrationId);
      return `<div class="it" style="flex-wrap:wrap"><span>${U.esc(rc.receiptNumber)}<div class="small muted">Phiên chợ quê · ${s ? U.dmy(s.sessionDate) : ''}</div></span><span style="text-align:right"><b>${U.money(rc.amount)}</b><div><span class="tag ok">Đã thanh toán</span></div></span>
        <div style="width:100%;font-size:var(--font-size-sm);background:#f5f8fc;border-radius:8px;padding:8px;margin-top:6px">
          <div class="row"><span style="flex:1">Đăng ký</span><span>${reg ? U.esc(reg.code) : U.esc(rc.registrationId)}</span></div>
          <div class="row"><span style="flex:1">Phương thức</span><span>${U.esc(rc.method || 'ONLINE')}</span></div>
          <div class="row"><span style="flex:1">Gửi Mini app</span><span class="tag ok">Đã gửi</span></div>
        </div></div>`;
    }).join('')}${invs.map(i => `<div class="it" style="flex-wrap:wrap;cursor:pointer" data-act="mini-bill" data-id="${i.id}"><span>Kỳ ${U.per(i.period)}<div class="small muted">${U.invStall(i).code}</div></span><span style="text-align:right"><b>${U.money(i.amount)}</b><div>${U.invTag(i)}</div></span>
      ${open === i.id ? `<div style="width:100%;font-size:var(--font-size-sm);background:#f5f8fc;border-radius:8px;padding:8px;margin-top:6px">${i.items.map(x => `<div class="row"><span style="flex:1">${x.name}</span><span>${U.money(x.amount)}</span></div>`).join('')}
        ${A.db.payments.filter(p => p.invoiceId === i.id).map(p => `<div class="muted" style="margin-top:4px">✓ ${p.receipt} · ${D.METHOD[p.method]} · ${U.dmy(p.date)}</div>`).join('')}</div>` : ''}</div>`).join('')}</div></div>`;
  }
  function tabContract(t) {
    return A.db.contracts.filter(c => c.traderId === t.id).map(c => {
      const s = A.idx.stall.get(c.stallId);
      return `<div class="m-card"><b>${c.kind}</b><div class="m-list">
        <div class="it"><span class="muted">Số</span><span>${c.id}</span></div><div class="it"><span class="muted">Điểm KD</span><span>${s.code} · ${s.area.toLocaleString('vi-VN')} m²</span></div>
        <div class="it"><span class="muted">Thời hạn</span><span>${U.dmy(c.start)} – ${U.dmy(c.end)}</span></div>
        <div class="it"><span class="muted">Đơn giá</span><span>${U.unitLabel(s)}</span></div>
        ${c.monthly ? `<div class="it"><span class="muted">Giá dịch vụ/tháng</span><b>${U.money(c.monthly)}</b></div>` : ''}
        <div class="it"><span class="muted">Trạng thái</span><span class="tag ${c.status === 'hieuluc' ? 'ok' : ''}">${c.status === 'hieuluc' ? 'Đang hiệu lực' : 'Đã thanh lý'}</span></div></div>
        <button class="m-btn" style="border:1px solid var(--line);margin-top:8px" data-act="mini-pdf">📄 Xem bản hợp đồng (PDF)</button></div>`;
    }).join('');
  }
  function notisFor(t) {
    const debt = U.traderOverdue(t.id) > 0, mk = U.market(t.market).short;
    // PHAT_HANH_KHOAN_THU: thông báo phát hành gửi riêng từng tiểu thương (traderLines[traderId] = mã, số tiền).
    const issuedFor = A.db.notifications.filter(n => n.kind === 'RECEIVABLE_ISSUED' && n.traderLines && n.traderLines[t.id]).map(n => Object.assign({}, n, { body: n.traderLines[t.id] }));
    const general = issuedFor.concat(A.db.notifications.filter(n => n.kind !== 'RECEIVABLE_ISSUED' && n.kind !== 'RECEIVABLE_LIST_TO_COLLECTORS').filter(n => n.traderId === t.id || n.group === 'Toàn bộ tiểu thương' || n.group === mk || n.group === 'Ngành hàng: ' + t.cat || (debt && n.group === 'Danh sách nợ phí')));
    const session = (A.db.sessionNotifications || []).map(n => {
      const s = (A.db.marketSessions || []).find(x => x.id === n.sessionId);
      if (n.merchantId && n.merchantId !== t.id) return null;
      if (general.some(g => g.sessionId === n.sessionId && g.kind === 'SESSION_REGISTRATION_OPEN')) return null;
      if (!s || s.marketId !== t.market) return null;
      return { id: 'SN-' + n.sessionId + '-' + (n.at || '') + '-' + (n.receiptId || ''), at: n.at || U.today(), title: n.text, group: mk, channels: ['Mini app'], body: n.kind === 'SESSION_PAYMENT_SUCCESS' ? 'Biên lai đã lưu trong mục Hóa đơn & biên lai.' : 'Tiểu thương có thể đăng ký trong tab Đăng ký khi phiên còn mở.' };
    }).filter(Boolean);
    return general.concat(session).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  }
  function tabNotice(t) {
    return `<div class="m-card"><b>Thông báo</b><div class="m-list">${notisFor(t).map(n => `<div class="it" style="flex-direction:column;gap:2px"><b style="font-weight:600">${U.esc(n.title)}</b><span class="small muted">${U.dmy(n.at)} · Ban Quản lý ${U.esc(U.market(t.market).name)}</span>${n.body ? `<span class="small">${U.esc(n.body)}</span>` : ''}</div>`).join('')}</div></div>`;
  }
  function tabReport(t) {
    const m = mini(), mine = A.db.incidents.filter(i => i.traderId === t.id).reverse();
    return `<div class="m-card"><b>Gửi phản ánh, kiến nghị</b>
      <div class="field" style="margin-top:8px"><label>Nhóm</label><select class="input" id="mr-cat">${['Điện', 'Cấp thoát nước', 'Vệ sinh', 'An ninh trật tự', 'PCCC', 'Hạ tầng', 'Khác'].map(c => `<option>${c}</option>`).join('')}</select></div>
      <div class="field" style="margin-top:8px"><label>Điểm kinh doanh</label><select class="input" id="mr-stall">${t.stalls.map(id => `<option value="${id}">${A.idx.stall.get(id).code}</option>`).join('')}</select></div>
      <div class="field" style="margin-top:8px"><label>Nội dung</label><textarea class="input" id="mr-text" rows="3">Đèn chiếu sáng trước quầy bị hỏng từ tối qua, nhờ Ban Quản lý kiểm tra.</textarea></div>
      <button class="btn" style="margin-top:8px" data-act="mini-attach">${m.attach ? '✓ Đã đính kèm 1 ảnh' : '📷 Chụp / đính kèm ảnh'}</button>
      <button class="m-btn solid" style="margin-top:10px" data-act="mini-report">Gửi phản ánh</button></div>
      ${mine.length ? `<div class="m-card"><b>Phản ánh đã gửi</b><div class="m-list">${mine.map(i => `<div class="it" style="flex-wrap:wrap"><span style="flex:1">${U.esc(i.title)}<div class="small muted">${i.id} · ${U.dmy(i.created)}</div></span><span class="tag info">${D.INCIDENT_STATES.find(s => s.id === i.state).label}</span>
        ${(i.state === 'hoanthanh' || i.state === 'dong') ? `<div class="stars" style="width:100%">${[1, 2, 3, 4, 5].map(n => `<button class="${i.rating >= n ? 'on' : ''}" data-act="mini-rate" data-id="${i.id}" data-n="${n}" aria-label="${n} sao">★</button>`).join('')}<span class="small muted">${i.rating ? 'Cảm ơn bạn đã đánh giá' : 'Đánh giá dịch vụ'}</span></div>` : ''}</div>`).join('')}</div></div>` : ''}`;
  }

  function tabRegister(t) {
    ensureMiniRegistrationModel();
    const m = mini();
    m.regForm = m.regForm || { kind: 'SESSION', stalls: 1, method: 'ONLINE', term: 'MONTH' };
    // Q3: fixed-stall applications are no longer part of the prototype flow.
    if (m.regForm.kind !== 'SESSION') m.regForm.kind = 'SESSION';
    const form = m.regForm;
    const sessions = openRegistrationSessions();
    let s = sessions.find(x => x.id === form.sessionId) || sessions[0];
    if (s) form.sessionId = s.id;
    const cat = form.cat || (s && s.allowedBusinessCategories && s.allowedBusinessCategories[0]) || '';
    form.cat = cat;
    const availablePoints = miniSessionAvailablePoints(s, cat);
    if (availablePoints.length && !availablePoints.some(p => p.id === form.pointId)) form.pointId = availablePoints[0].id;
    const selectedPoint = availablePoints.find(p => p.id === form.pointId) || null;
    const n = selectedPoint ? 1 : Math.max(1, Number(form.stalls || 1));
    form.stalls = n;
    const snap = s ? miniSnapshotAmount(n, s.marketId) : null;
    const reasons = miniRegBusinessStateReasons(t, form);
    const mySessionRegs = A.db.sessionRegistrations.filter(r => r.merchantId === t.id && r.marketId === ui.market).slice(-3).reverse();
    return `<div class="m-card"><b>Đăng ký quầy chợ</b>
      <div class="seg" style="margin-top:10px">${[['SESSION', 'Theo phiên']].map(x => `<button class="${form.kind === x[0] ? 'on' : ''}" data-act="mini-reg-kind" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>
      ${form.kind === 'SESSION' ? (sessions.length ? `<div class="field" style="margin-top:10px"><label>Phiên chợ đang mở đăng ký</label><select class="input" data-ch="mini-reg-form" data-k="sessionId">${sessions.map(x => `<option value="${x.id}" ${form.sessionId === x.id ? 'selected' : ''}>${U.dmy(x.sessionDate)} · còn ${miniAvailableStalls(x)} quầy</option>`).join('')}</select></div>
        <div class="form-grid" style="margin-top:8px">
          <div class="field"><label>Ngành hàng</label><select class="input" data-ch="mini-reg-form" data-k="cat">${s ? (s.allowedBusinessCategories || []).map(c => `<option value="${U.esc(c)}" ${cat === c ? 'selected' : ''}>${U.esc(c)}</option>`).join('') : ''}</select></div>
          <div class="field"><label>Điểm kinh doanh còn trống</label><select class="input" data-ch="mini-reg-form" data-k="pointId">${availablePoints.map(p => `<option value="${p.id}" ${form.pointId === p.id ? 'selected' : ''}>${U.esc(p.code)} · ${U.esc(p.sectionName || '')} · ${Number(p.area || 0).toLocaleString('vi-VN')} m²</option>`).join('')}</select></div>
          <div class="field"><label>Hình thức thanh toán</label><select class="input" data-ch="mini-reg-form" data-k="method"><option value="ONLINE" ${form.method !== 'CASH' ? 'selected' : ''}>QR code thanh toán tự động</option><option value="CASH" ${form.method === 'CASH' ? 'selected' : ''}>Thanh toán tiền mặt</option></select></div>
        </div>
        <dl class="kv" style="margin-top:10px"><dt>Điểm đã chọn</dt><dd>${selectedPoint ? U.esc(selectedPoint.code + ' · ' + selectedPoint.sectionName) : '-'}</dd><dt>Tạm tính</dt><dd><b>${snap ? U.money(snap.totalAmount) : '-'}</b></dd><dt>Trạng thái phiên</dt><dd>${s ? U.esc(s.status) : '-'}</dd></dl>` : '<div class="note" style="margin-top:10px">Hiện chưa có phiên chợ nào đang mở đăng ký trong phạm vi tài khoản.</div>') : `<div class="field" style="margin-top:10px"><label>Kỳ thuê</label><select class="input" data-ch="mini-reg-form" data-k="term"><option value="MONTH" ${form.term !== 'QUARTER' ? 'selected' : ''}>Theo tháng</option><option value="QUARTER" ${form.term === 'QUARTER' ? 'selected' : ''}>Theo quý</option></select></div>
        <dl class="kv" style="margin-top:10px"><dt>Thời hạn</dt><dd>${fixed.months} tháng</dd><dt>Tạm tính</dt><dd><b>${U.money(fixed.total)}</b></dd><dt>Trạng thái</dt><dd>Gửi hồ sơ chờ Ban Quản lý duyệt</dd></dl>`}
      ${reasons.length ? `<div class="note" style="margin-top:10px">${reasons.map(U.esc).join('<br>')}</div>` : '<div class="note info" style="margin-top:10px">Đủ điều kiện gửi đăng ký mock trong phạm vi Chợ quê TTĐ.</div>'}
      <button class="m-btn solid" style="margin-top:10px" data-act="mini-reg-submit" ${reasons.length ? 'disabled' : ''}>Gửi đăng ký</button></div>
      <div class="m-card"><b>Hồ sơ gần đây</b><div class="m-list">${mySessionRegs.map(r => {
        const canPay = miniCanPaySessionRegistration(t, r);
        const cashPay = miniSessionCashPaymentForReg(r);
        return `<div class="it" style="flex-wrap:wrap"><span>${U.esc(r.code)}<div class="small muted">Theo phiên · ${r.requestedStalls} quầy · ${U.money(r.totalAmount || 0)}</div></span><span class="tag info">${U.esc(r.status)}</span>
          ${canPay ? `<button class="m-btn solid" style="width:100%;margin-top:8px" data-act="mini-session-pay" data-id="${r.id}">Giả lập: đã thanh toán online</button>` : ''}
          ${cashPay && cashPay.status === 'WAITING_COLLECTION' ? `<div class="small muted" style="width:100%;margin-top:4px">Chờ thu tiền mặt · hạn trước điểm danh ${U.esc(cashPay.dueAt || '')}</div>` : ''}
          ${r.receiptNumber ? `<div class="small muted" style="width:100%;margin-top:4px">Biên lai ${U.esc(r.receiptNumber)} đã gửi Mini app</div>` : ''}</div>`;
      }).join('') || (!mySessionRegs.length ? '<div class="small muted">Chưa có đăng ký</div>' : '')}</div></div>`;
  }

  function phone(t) {
    const m = mini();
    const TABS = [['home', '🏠', 'Trang chủ'], ['bills', '🧾', 'Hóa đơn'], ['contract', '📄', 'Hợp đồng'], ['register', '🪷', 'Đăng ký'], ['notice', '🔔', 'Thông báo'], ['report', '💬', 'Phản ánh']];
    let body;
    // CORRECTION: bỏ nhánh regStep/pendingLinkId/supplementDraft (luồng Mini App tự đăng ký đã loại
    // bỏ — xem TRADER_PROFILE_MINIAPP_CORRECTION_REPORT.md). `m.step !== 'app'` giờ bao trọn luồng
    // đăng nhập SĐT+OTP mới (screenLogin tự dispatch theo m.loginStep bên trong).
    if (m.step !== 'app') body = screenLogin(t);
    else if (m.sessionPayId) body = screenSessionPay(t);
    // Hồ sơ CHƯA ACTIVE (NEEDS_SUPPLEMENT/INACTIVE — dữ liệu cũ/gán tay, không còn phát sinh từ Mini
    // App) → chỉ xem trạng thái, KHÔNG vào app bình thường (mục 19 yêu cầu correction: Profile
    // lifecycle độc lập với Account access lifecycle).
    else if (t.profileStatus && t.profileStatus !== 'ACTIVE') body = screenProfileStatus(t);
    else if (m.pay) body = screenPay(t);
    else {
      const f = { home: tabHome, bills: tabBills, contract: tabContract, register: tabRegister, notice: tabNotice, report: tabReport }[m.tab];
      body = `<div class="m-head"><div class="hi">Xin chào,</div><div class="nm">${U.esc(t.name)}</div><div class="hi">${U.esc(U.market(t.market).short)}</div></div><div class="m-body">${f(t)}</div>
        <div class="m-tabs">${TABS.map(x => `<button class="${m.tab === x[0] ? 'on' : ''}" data-act="mini-tab" data-id="${x[0]}"><span class="i">${x[1]}</span>${x[2]}</button>`).join('')}</div>`;
    }
    return `<div class="phone"><div class="screen"><div class="notch"><span>9:41</span><span>▮▮▮ 4G 🔋</span></div>${body}</div></div>`;
  }
  function collectorPhone() {
    const m = mini();
    const list = collectorDebtors();
    const sessionDues = miniSessionCashDues();
    const selectedSession = m.collectSessionRegId ? sessionDues.find(x => x.reg.id === m.collectSessionRegId) : null;
    const selectedRaw = m.collectTraderId ? A.idx.trader.get(m.collectTraderId) : null;
    const selected = selectedRaw && selectedRaw.market === ui.market ? selectedRaw : null;
    const due = selected ? unpaid(selected) : [];
    const total = selected ? U.sum(due, U.due) : 0;
    let body;
    if (m.collectDone) {
      const pays = m.lastPays || [];
      body = `<div class="m-body" style="text-align:center"><div style="font-size:54px;margin-top:20px">✓</div><h3>Đã ghi nhận thu</h3>
        <div class="m-card" style="text-align:left"><div class="m-list">
          <div class="it"><span class="muted">Số tiền</span><b>${U.money(U.sum(pays, p => p.amount))}</b></div>
          <div class="it"><span class="muted">Biên lai</span><span>${pays.map(p => p.receipt).join('<br>')}</span></div>
          <div class="it"><span class="muted">Người thu</span><span>${U.esc(A.currentAccount().fullName)}</span></div>
          <div class="it"><span class="muted">Gửi Mini app</span><span class="tag ok">Đã gửi</span></div></div></div>
        <button class="m-btn solid" data-act="mini-collector-home">Về danh sách</button></div>`;
    } else if (selectedSession) {
      body = `<div class="m-body"><button class="btn sm" style="align-self:flex-start" data-act="mini-collector-home">‹ Quay lại</button>
        <div class="m-card"><b>${U.esc(selectedSession.trader.name)}</b><div class="small muted">${selectedSession.trader.id} · ${U.maskPhone(selectedSession.trader.phone)} · ${U.mShort(selectedSession.trader.market)}</div>
          <div class="m-list" style="margin-top:8px">
            <div class="it"><span>Đăng ký</span><b>${U.esc(selectedSession.reg.code || selectedSession.reg.id)}</b></div>
            <div class="it"><span>Phiên</span><b>${U.dmy(selectedSession.session.sessionDate)}</b></div>
            <div class="it"><span>Số quầy</span><b>${selectedSession.reg.requestedStalls}</b></div>
            <div class="it"><span>Hạn thu</span><b>Trước điểm danh · ${U.esc(selectedSession.deadline || '')}</b></div>
          </div></div>
        <div class="m-card m-due"><div class="small" style="opacity:.85">Tổng cần thu</div><div class="amt">${U.money(selectedSession.amount)}</div>
          <button class="m-btn" data-act="mini-session-cash-paid" ${isCollectorMini() ? '' : 'disabled'}>Ghi nhận thu phí theo phiên trực tiếp</button></div></div>`;
    } else if (selected) {
      body = `<div class="m-body"><button class="btn sm" style="align-self:flex-start" data-act="mini-collector-home">‹ Quay lại</button>
        <div class="m-card"><b>${U.esc(selected.name)}</b><div class="small muted">${selected.id} · ${U.maskPhone(selected.phone)} · ${U.mShort(selected.market)}</div>
          <div class="m-list" style="margin-top:8px">${due.map(i => `<div class="it"><span>Kỳ ${U.per(i.period)}<div class="small muted">${U.invStall(i).code}</div></span><b>${U.money(U.due(i))}</b></div>`).join('') || '<div class="small muted">Không còn khoản phải thu</div>'}</div></div>
        <div class="m-card m-due"><div class="small" style="opacity:.85">Tổng cần thu</div><div class="amt">${U.money(total)}</div>
          <button class="m-btn" data-act="mini-collect-paid" ${total > 0 && isCollectorMini() && miniCollectingBusinessStateOk(due) ? '' : 'disabled'}>Ghi nhận thu phí cố định trực tiếp</button></div></div>`;
    } else {
      body = `<div class="m-head"><div class="hi">Xin chào,</div><div class="nm">${U.esc(A.currentAccount().fullName)}</div><div class="hi">${U.esc(U.market(ui.market).short)}</div></div>
        <div class="m-body"><div class="m-card m-due"><div class="small" style="opacity:.85">Thu tiền trực tiếp hôm nay</div><div class="amt">${list.length + sessionDues.length}</div><div class="small">Theo phiên ${U.money(U.sum(sessionDues, x => x.amount))} · Cố định ${U.money(U.sum(list, x => x.amt))}</div></div>
        ${sessionDues.length ? `<div class="m-card"><b>Thu phí theo phiên trực tiếp</b><div class="small muted" style="margin-top:4px">Khoản đăng ký phiên chợ quê TTĐ cần thu trước điểm danh.</div><div class="m-list" style="margin-top:8px">${sessionDues.slice(0, 12).map(x => `<button class="it" style="width:100%;text-align:left;background:transparent;border:0;cursor:pointer" data-act="mini-session-cash-open" data-id="${x.reg.id}">
          <span><b>${U.esc(x.trader.name)}</b><div class="small muted">${U.esc(x.reg.code || x.reg.id)} · trước điểm danh ${U.dmy(x.session.sessionDate)}</div></span>
          <span style="text-align:right"><b>${U.money(x.amount)}</b><div class="small muted">${U.esc(x.deadline || '')}</div></span></button>`).join('')}</div></div>` : ''}
        <div class="m-card"><b>Thu phí cố định trực tiếp</b><div class="small muted" style="margin-top:4px">Các khoản phí tháng/quý còn phải thu trong kỳ đang thu.</div><div class="m-list" style="margin-top:8px">${list.slice(0, 12).map(x => `<button class="it" style="width:100%;text-align:left;background:transparent;border:0;cursor:pointer" data-act="mini-collect-open" data-id="${x.t.id}">
          <span><b>${U.esc(x.t.name)}</b><div class="small muted">${x.t.stalls.map(id => A.idx.stall.get(id).code).join(', ')} · ${x.n} khoản</div></span>
          <span style="text-align:right"><b>${U.money(x.amt)}</b>${x.over ? `<div class="small" style="color:#d6453b">Quá hạn ${U.money(x.over)}</div>` : ''}</span></button>`).join('') || '<div class="small muted">Không có khoản cần thu</div>'}</div></div></div>`;
    }
    return `<div class="phone"><div class="screen"><div class="notch"><span>9:41</span><span>□□□ 4G 🔋</span></div>${body}</div></div>`;
  }

  A.VIEWS['mini-app'] = function () {
    if (isCollectorMini() && !isTraderMini()) {
      return `<div class="mini-wrap"><div>${collectorPhone()}</div>
      <div class="grid" style="align-content:start">
        <div class="card"><div class="card-h"><h3>Mini app nhân viên thu phí</h3></div><div class="card-b">
          <p class="muted" style="margin-top:0">Nhân viên thu phí chỉ thấy danh sách Chợ quê TTĐ trong phạm vi tài khoản. Ghi nhận thu tiền mặt kiểm tra lại action <b>thu-tien.thu</b> và trạng thái kỳ trước khi lưu.</p>
          <div class="note info">Tài khoản: <b>${U.esc(A.currentAccount().fullName)}</b> · Chợ: <b>${U.esc(U.market(ui.market).short)}</b></div>
        </div></div>
        <div class="card"><div class="card-h"><h3>Kiểm soát quyền</h3></div><div class="card-b"><ol class="script">
          <li><div>Vào được mini app nhờ <b>screen:mini-app</b>.</div></li>
          <li><div>Ghi nhận thu tiền cần <b>action:thu-tien.thu</b>, đúng <b>Account.marketScopes</b>, <b>SelectedMarket</b>, Chợ quê TTĐ và kỳ Đang thu.</div></li>
          <li><div>Khoản đã thu đủ hoặc sai chợ sẽ bị từ chối trong handler.</div></li>
        </ol></div></div>
      </div></div>`;
    }
    if (!isTraderMini()) {
      return '<div class="empty">Mini app nhân viên thu phí chỉ áp dụng cho luồng thu tiền mặt Chợ quê TTĐ, đúng phạm vi tài khoản và kỳ đang thu.</div>';
    }
    const t = trader(), list = sampleTraders(), mine = A.db.incidents.filter(i => i.traderId === t.id).reverse();
    if (!t) return '<div class="empty">Không có tiểu thương trong phạm vi tài khoản mini app.</div>';
    return `${miniDebtCard(t)}<div class="page-head"><div><h2>Gửi phản ánh</h2><p class="muted">Tiểu thương gửi phản ánh, kiến nghị cho điểm kinh doanh thuộc phạm vi tài khoản.</p></div></div>
      <div class="grid g2" style="align-items:start">
        <div class="card"><div class="card-h"><h3>Thông tin người gửi</h3></div><div class="card-b">
          <div class="field"><label>Tiểu thương</label><select class="input" data-ch="mini-trader">${list.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${U.esc(x.name)} · ${x.stalls.map(id => A.idx.stall.get(id).code).join(', ')} · ${U.mShort(x.market)}</option>`).join('')}</select></div>
          <dl class="kv" style="margin-top:12px"><dt>Chợ</dt><dd>${U.esc(U.mShort(t.market))}</dd><dt>Số điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd><dt>Điểm kinh doanh</dt><dd>${t.stalls.map(id => U.esc((A.idx.stall.get(id) || {}).code || id)).join(', ')}</dd></dl>
          <div class="note info" style="margin-top:12px">Phản ánh sau khi gửi sẽ vào màn <b>Phản ánh & sự cố</b> để Ban Quản lý tiếp nhận và phân công xử lý.</div>
        </div></div>
        <div class="card"><div class="card-h"><h3>Nội dung phản ánh</h3></div><div class="card-b">
          <div class="field"><label>Nhóm</label><select class="input" id="mr-cat">${['Điện', 'Cấp thoát nước', 'Vệ sinh', 'An ninh trật tự', 'PCCC', 'Hạ tầng', 'Khác'].map(c => `<option>${c}</option>`).join('')}</select></div>
          <div class="field" style="margin-top:10px"><label>Điểm kinh doanh</label><select class="input" id="mr-stall">${t.stalls.map(id => `<option value="${id}">${U.esc((A.idx.stall.get(id) || {}).code || id)}</option>`).join('')}</select></div>
          <div class="field" style="margin-top:10px"><label>Nội dung</label><textarea class="input" id="mr-text" rows="5" placeholder="Nhập nội dung phản ánh, kiến nghị cần Ban Quản lý xử lý..."></textarea></div>
          <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><button class="btn" data-act="mini-attach">${mini().attach ? '✓ Đã đính kèm 1 ảnh' : 'Đính kèm ảnh minh họa'}</button><span class="spacer"></span><button class="btn primary" data-act="mini-report">Gửi phản ánh</button></div>
        </div></div>
      </div>
      <div class="card" style="margin-top:14px"><div class="card-h"><h3>Phản ánh đã gửi</h3></div><div class="card-b">
        ${U.table([{ t: 'Mã' }, { t: 'Ngày gửi' }, { t: 'Điểm KD' }, { t: 'Nhóm' }, { t: 'Nội dung' }, { t: 'Trạng thái' }],
          mine.map(i => `<tr><td><b>${i.id}</b></td><td>${U.dmy(i.created)}</td><td>${U.esc((A.idx.stall.get(i.stallId) || {}).code || '—')}</td><td>${U.esc(i.cat)}</td><td>${U.esc(i.title)}</td><td><span class="tag info">${U.esc((D.INCIDENT_STATES.find(s => s.id === i.state) || {}).label || i.state)}</span></td></tr>`),
          { empty: 'Chưa có phản ánh nào.' })}
      </div></div>`;
  };

  A.CH['mini-trader'] = el => { miniResetLoginFlow(); Object.assign(mini(), { traderId: el.value, step: 'login', tab: 'home', pay: null, bill: null, attach: false }); A.render(); };
  // ---- Đăng nhập/kích hoạt Mini App (SĐT + OTP) — field binding ----
  // Render lại ngay khi gõ để nút "Nhận mã đăng nhập" phản ánh đúng giá trị mới nhất khi cần (an
  // toàn vì A.render() giữ nguyên focus/caret cho input đang gõ, xem A.render() ở core.js).
  A.IN['mini-login-phone'] = el => { mini().loginPhone = el.value; };
  Object.assign(A.ACT, {
    // Tra cứu Trader Profile theo SĐT (mục 11 yêu cầu correction) — KHÔNG tạo trader/account ở bước
    // này, chỉ xác định CASE A (không thấy)/CASE B (thấy đúng 1)/nhiều kết quả (mục 22 — ambiguous).
    'mini-login-lookup': () => {
      const m = mini();
      const raw = m.loginPhone != null ? m.loginPhone : trader().phone;
      if (!String(raw || '').trim()) { U.toast('Vui lòng nhập số điện thoại'); return; }
      const matches = miniFindTradersByPhone(raw);
      if (matches.length === 0) { m.loginStep = 'notfound'; A.render(); return; }
      if (matches.length > 1) { m.loginStep = 'multi'; A.render(); return; }
      m.loginTraderId = matches[0].id; m.loginStep = 'confirm'; A.render();
    },
    'mini-login-retry': () => { miniResetLoginFlow(); A.render(); },
    'mini-login-send-otp': () => { mini().loginStep = 'otp'; A.render(); },
    // Xác thực OTP giả lập thành công → tìm-hoặc-tạo Trader Account (mục 14/15 yêu cầu correction:
    // reuse account đã có, KHÔNG tạo trùng) rồi vào Mini App. Account đã bị khóa → chặn (mục 17 —
    // "Khóa truy cập" phải thật sự chặn được truy cập, không chỉ là nhãn hiển thị).
    'mini-login-verify': () => {
      const m = mini(), t = A.idx.trader.get(m.loginTraderId);
      if (!t) { m.loginStep = 'phone'; A.render(); return; }
      const existing = A.ACCOUNTS.byTraderId(t.id);
      if (existing && existing.status !== 'active') { m.loginStep = 'locked'; A.render(); return; }
      if (A.createLinkedTraderAccount) A.createLinkedTraderAccount(t, t.phone);
      Object.assign(m, { traderId: t.id, step: 'app', tab: 'home', loginStep: 'phone', loginPhone: null, loginTraderId: null });
      A.save();
      A.render();
    },
    'mini-logout': () => { miniResetLoginFlow(); Object.assign(mini(), { step: 'login', pay: null, tab: 'home' }); A.render(); },
    'mini-tab': el => { mini().tab = el.dataset.id; mini().bill = null; A.render(); },
    'mini-home': () => { mini().pay = null; mini().tab = 'home'; A.render(); },
    'mini-pay': () => { mini().pay = 'qr'; A.render(); },
    'mini-paid': () => {
      const t = trader(), list = unpaid(t);
      if (!isTraderMini() || !t || !inMiniScopeMarket(t.market)) { U.toast('Không có quyền thanh toán cho tiểu thương này'); return; }
      const pays = list.length ? A.applyPayment(list.map(i => i.id), U.sum(list, U.due), 'qr', 'Mini app') : [];
      // THU_HOI_NO: nợ quá hạn trả qua QR thu nợ (nội dung mã nợ) → map về khoản thu gốc.
      (A.db.debts || []).filter(d => d.traderId === t.id && d.status === 'OPEN').forEach(d => { pays.push.apply(pays, A.payDebtByQr(d.id, 'Mini app')); });
      mini().lastPays = pays; mini().pay = 'done'; A.render();
      U.toast('Ngân hàng báo có · hệ thống tự ghi nhận ' + U.money(U.sum(pays, p => p.amount)));
    },
    'mini-collect-open': el => {
      const t = A.idx.trader.get(el.dataset.id);
      if (!t || t.market !== ui.market || !isCollectorMini() || !A.canDirectCollect(t.market)) return;
      Object.assign(mini(), { collectTraderId: t.id, collectDone: false, lastPays: null });
      A.render();
    },
    'mini-collector-home': () => { Object.assign(mini(), { collectTraderId: null, collectSessionRegId: null, collectDone: false, lastPays: null }); A.render(); },
    'mini-session-cash-open': el => {
      const due = miniSessionCashDues().find(x => x.reg.id === el.dataset.id);
      if (!due || !isCollectorMini() || !A.canDirectCollect(due.payment.marketId)) return;
      Object.assign(mini(), { collectTraderId: null, collectSessionRegId: due.reg.id, collectDone: false, lastPays: null });
      A.render();
    },
    'mini-session-cash-paid': () => {
      const due = mini().collectSessionRegId ? miniSessionCashDues().find(x => x.reg.id === mini().collectSessionRegId) : null;
      if (!due || !A.canDirectCollect(ui.market)) { U.toast('Chỉ được thu trực tiếp tiền mặt cho Chợ quê TTĐ trong phạm vi tài khoản'); return; }
      const snap = miniSessionCashSnapshot();
      const done = A.completeSessionCashPayment(due.reg, due.session, due.payment, collectorActor());
      if (!done) { U.toast('Không thể ghi nhận thu: sai trạng thái đăng ký hoặc đã quá hạn trước điểm danh'); return; }
      mini().lastPays = [done.ledgerPayment]; mini().collectDone = true; mini().collectSessionRegId = null;
      try { A.save(); }
      catch (err) { miniRestoreSessionCashSnapshot(snap); U.toast('Không lưu được khoản thu, chưa in biên lai'); A.render(); return; }
      A.render();
      A.showReceipt([done.ledgerPayment], { autoPrint: true });
      U.toast('Đã ghi nhận thu ' + U.money(done.ledgerPayment.amount));
    },
    'mini-collect-paid': () => {
      const t = mini().collectTraderId ? A.idx.trader.get(mini().collectTraderId) : null;
      if (!t || !A.canDirectCollect(t.market)) { U.toast('Chỉ được thu trực tiếp tiền mặt cho Chợ quê TTĐ trong phạm vi tài khoản'); return; }
      const list = unpaid(t);
      if (!list.length) { U.toast('Tiểu thương không còn khoản phải thu'); return; }
      if (!miniCollectingBusinessStateOk(list)) { U.toast('Chỉ thu trực tiếp cho kỳ đang ở trạng thái Đang thu'); return; }
      const pays = A.applyPayment(list.map(i => i.id), U.sum(list, U.due), 'tm', collectorActor());
      mini().lastPays = pays; mini().collectDone = true; A.render();
      A.showReceipt(pays, { autoPrint: true });
      U.toast('Đã ghi nhận thu ' + U.money(U.sum(pays, p => p.amount)));
    },
    'mini-bill': el => { mini().bill = mini().bill === el.dataset.id ? null : el.dataset.id; A.render(); },
    'mini-pdf': () => U.toast('Mở bản số hóa hợp đồng (PDF) – minh họa'),
    'mini-attach': () => { mini().attach = !mini().attach; A.render(); },
    'mini-debt-pay': el => {
      const t = trader(), acc = A.currentAccount() || {}, d = (A.db.debts || []).find(x => x.id === el.dataset.id);
      if (!U.can('mini-app') || !isTraderMini() || !t || !d || d.traderId !== t.id || (acc.traderId || acc.linkedTraderId) !== t.id || !inMiniScopeMarket(d.market) || !A.canDo('mini-app.tra-no-qr', d.market)) { U.toast('Không có quyền thanh toán khoản nợ này'); return; }
      if (d.status !== 'OPEN') { U.toast(d.status === 'UNRECOVERABLE' ? 'Khoản nợ đã vào danh sách cắt điện — không nhận thanh toán' : 'Khoản nợ đã được thanh toán'); A.render(); return; }
      const pays = A.payDebtByQr(d.id, 'Mini app');
      if (!pays.length) { U.toast('Không ghi nhận được thanh toán'); return; }
      A.render(); A.showReceipt(pays, { autoPrint: false });
      U.toast('Ngân hàng báo có · đã thanh toán nợ ' + d.id + ' (' + U.money(U.sum(pays, p => p.amount)) + ')');
    },
    'mini-report': () => {
      const t = trader(), stall = A.idx.stall.get(A.$('#mr-stall').value);
      if (!U.can('mini-app') || !isTraderMini() || !t || !stall || !miniOwnsStall(t, stall) || !inMiniScopeMarket(stall.market) || (t.profileStatus && t.profileStatus !== 'ACTIVE')) {
        U.toast('Không có quyền gửi phản ánh cho điểm kinh doanh này.');
        return;
      }
      const text = A.$('#mr-text').value.trim();
      if (!text) { U.toast('Vui lòng nhập nội dung'); return; }
      const title = text.length > 60 ? text.slice(0, 57) + '…' : text;
      const i = A.addIncident(stall.id, A.$('#mr-cat').value, title, text, 'Mini app tiểu thương', mini().attach);
      mini().attach = false; A.render();
      U.toast('Đã gửi ' + i.id + '. Ban Quản lý đã tiếp nhận phản ánh của bạn.');
    },
    'mini-reg-kind': () => { mini().regForm = Object.assign(mini().regForm || {}, { kind: 'SESSION' }); A.render(); },
    'mini-reg-submit': () => {
      const t = trader(), m = mini(), form = m.regForm || { kind: 'SESSION' };
      const reasons = miniRegBusinessStateReasons(t, form);
      if (reasons.length) { U.toast(reasons[0]); return; }
      if (form.kind === 'SESSION') {
        const s = A.db.marketSessions.find(x => x.id === form.sessionId);
        const selectedPoint = miniSessionAvailablePoints(s, form.cat).find(p => p.id === form.pointId);
        if (!selectedPoint) { U.toast('Vui lòng chọn điểm kinh doanh còn trống'); return; }
        const n = 1;
        miniEnsureOpsSession(s);
        const isWaiting = false;
        const snap = miniSnapshotAmount(n, s.marketId);
        const reg = {
          id: miniSeq('DK', A.db.sessionRegistrations), code: 'DK-' + s.code.slice(-8) + '-' + U.pad(A.db.sessionRegistrations.length + 1, 3),
          sessionId: s.id, market: s.marketId, marketId: s.marketId, traderId: t.id, merchantId: t.id,
          pointId: selectedPoint.id, requestedSectionId: selectedPoint.section, requestedStalls: n, businessCategory: selectedPoint.cat,
          listType: isWaiting ? 'waitlist' : 'official', status: isWaiting ? 'waitlisted' : 'registered',
          waitlistOrder: isWaiting ? miniSessionRegs(s.id).filter(x => x.listType === 'waitlist' || x.status === 'waitlisted').length + 1 : null,
          paymentMethod: form.method || 'ONLINE', pricingSnapshot: snap, totalAmount: snap.totalAmount,
          paymentWorkflowStatus: isWaiting ? 'WAITING_LIST' : (form.method === 'CASH' ? 'WAITING_COLLECTION' : 'WAITING_PAYMENT'),
          registeredAt: U.today(), createdBy: 'Mini app tiểu thương', createdAt: U.today(), updatedBy: 'Mini app tiểu thương', updatedAt: U.today(),
          note: isWaiting ? 'Mini app: chờ duyệt danh sách chờ' : ''
        };
        A.db.sessionRegistrations.push(reg);
        if (!isWaiting && reg.paymentMethod === 'ONLINE') A.db.sessionPayments.push({ id: miniSeq('PM', A.db.sessionPayments), sessionId: s.id, registrationId: reg.id, marketId: s.marketId, method: 'ONLINE', status: 'WAITING_PAYMENT', amount: snap.totalAmount, reference: 'MOCK-' + reg.code, createdAt: U.today(), paidAt: null });
        if (!isWaiting && reg.paymentMethod === 'CASH') A.db.sessionPayments.push({ id: miniSeq('PM', A.db.sessionPayments), sessionId: s.id, registrationId: reg.id, marketId: s.marketId, method: 'CASH', status: 'WAITING_COLLECTION', amount: snap.totalAmount, reference: 'CASH-' + reg.code, createdAt: U.today(), dueAt: miniSessionCashDeadline(s), collectedAt: null, collectedBy: null });
        U.toast(isWaiting ? 'Đã gửi đăng ký vào danh sách chờ' : (reg.paymentMethod === 'CASH' ? 'Đăng ký thành công. Vui lòng sớm hoàn thành khoản thu tiền mặt trước điểm danh phiên chợ để được bán hàng tại chợ.' : 'Đã gửi đăng ký phiên, chờ thanh toán/xác nhận'));
      } else { U.toast('Chỉ hỗ trợ đăng ký theo phiên chợ'); return; }
      m.tab = 'register'; m.regForm = Object.assign({}, form); A.save(); A.render();
    },
    'mini-session-pay': el => {
      const t = trader(), reg = (A.db.sessionRegistrations || []).find(r => r.id === el.dataset.id);
      if (!miniCanPaySessionRegistration(t, reg)) { U.toast('Không thể thanh toán: sai quyền, sai chợ hoặc trạng thái đăng ký không hợp lệ'); return; }
      const s = A.db.marketSessions.find(x => x.id === reg.sessionId), p = miniSessionPaymentForReg(reg);
      const receipt = A.completeSessionOnlinePayment ? A.completeSessionOnlinePayment(reg, s, p, 'Mini app tiểu thương') : null;
      if (!receipt) { U.toast('Không thể xử lý giao dịch online mock'); return; }
      mini().tab = 'bills'; mini().bill = null;
      A.save(); A.render();
      U.toast('Thanh toán thành công. Biên lai ' + receipt.receiptNumber + ' đã gửi Mini app');
    },
    'mini-rate': el => {
      const i = A.db.incidents.find(x => x.id === el.dataset.id);
      i.rating = Number(el.dataset.n);
      if (i.state === 'hoanthanh') i.state = 'dong';
      i.log.push({ at: U.today(), text: 'Tiểu thương đánh giá ' + i.rating + ' sao' });
      A.save(); A.render(); U.toast('Cảm ơn bạn đã đánh giá ' + i.rating + ' sao');
    }
  });
})(window.APP);
