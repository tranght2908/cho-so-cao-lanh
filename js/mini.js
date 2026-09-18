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

    const ledgerPayment = {
      id: 'GD' + U.pad(payNo, 6), invoiceId: null, market: reg.marketId, traderId: reg.merchantId,
      amount: payment.amount, method: 'qr', date: A.db.today, time, by: actor || 'Mini app',
      receipt: receiptNumber, lookup: Math.random().toString(36).slice(2, 8).toUpperCase(),
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

    const ledgerPayment = {
      id: 'GD' + U.pad(payNo, 6), invoiceId: null, market: reg.marketId, traderId: reg.merchantId,
      amount: payment.amount, method: 'tm', date: A.db.today, time, by: payment.collectedBy,
      receipt: receiptNumber, lookup: Math.random().toString(36).slice(2, 8).toUpperCase(),
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
  function fixedMonthlyAmount(term) {
    const fixed = A.db.stalls.find(s => s.market === ui.market && s.type !== 'phien');
    const price = (D.RATE_POLICY_SEED.stallPrices || []).find(x => x.marketId === ui.market && x.marketModel === D.RATE_MARKET_MODEL.FIXED_MONTHLY && x.status === 'active');
    const months = term === 'QUARTER' ? 3 : 1;
    const base = fixed && price ? Math.round(fixed.area * price.amount * 30 / 1000) * 1000 : 0;
    const extra = U.sum((D.RATE_POLICY_SEED.extraServices || []).filter(x => x.marketId === ui.market && x.status === 'active' && x.marketModel === D.RATE_MARKET_MODEL.FIXED_MONTHLY), x => x.amount || 0);
    return { months, base, extra, total: (base + extra) * months };
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
      if (!s || s.marketId !== ui.market) reasons.push('Phiên không thuộc chợ đang chọn.');
      if (s && s.status !== 'REGISTRATION_OPEN') reasons.push('Phiên chưa mở đăng ký.');
      if (s && !(s.registrationOpenAt <= U.today() && U.today() <= s.registrationCloseAt)) reasons.push('Ngoài thời gian đăng ký.');
      if (!(stalls > 0)) reasons.push('Số quầy phải lớn hơn 0.');
      if (s && stalls > s.maxStallsPerMerchant) reasons.push('Vượt số quầy tối đa mỗi tiểu thương.');
      if (s && (s.allowedBusinessCategories || []).indexOf(cat) === -1) reasons.push('Ngành hàng không hợp lệ cho phiên.');
      if (s && miniAvailableStalls(s) < stalls && !s.waitingListEnabled) reasons.push('Không còn đủ sức chứa.');
      if (t && s && miniSessionRegs(s.id).some(r => r.merchantId === t.id && ['CANCELLED', 'REJECTED', 'PAYMENT_EXPIRED', 'NO_SHOW'].indexOf(r.status) === -1)) reasons.push('Đã có đăng ký phiên đang hiệu lực hoặc đang xử lý.');
    } else {
      const term = form.term || 'MONTH';
      if (term !== 'MONTH' && term !== 'QUARTER') reasons.push('Kỳ đăng ký không hợp lệ.');
      if (t && A.db.fixedStallApplications.some(x => x.traderId === t.id && x.marketId === ui.market && x.status === 'PENDING_REVIEW')) reasons.push('Đã có hồ sơ quầy tháng/quý đang chờ duyệt.');
      if (!A.db.stalls.some(s => s.market === ui.market && s.type !== 'phien')) reasons.push('Chợ không có khu quầy cố định tháng/quý.');
    }
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
  const unpaid = t => A.db.invoices.filter(i => i.traderId === t.id && i.status !== 'paid').sort((a, b) => a.due.localeCompare(b.due));
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

  // ---- Tiểu thương gửi yêu cầu Tách điểm (Chợ Cao Lãnh) ----
  // Dùng CHÍNH A.db.pointRequests + A.pointReq (js/v-tieuthuong.js expose) — KHÔNG tạo mảng dữ liệu
  // song song. "Ownership" tái dùng ĐÚNG quan hệ t.stalls đã có (không tạo model quan hệ mới) —
  // trader() ở trên đã là cơ chế xác định trader context self-service sẵn có của Mini App, tái dùng
  // nguyên, không thêm if (role === 'trader') nào.
  const miniOwnsStall = (t, st) => t.stalls.indexOf(st.id) !== -1;
  // Chỉ điểm chưa mang trạng thái kết cấu, hoặc được đánh dấu ACTIVE rõ ràng, mới có thể gửi yêu
  // cầu mới. Cách kiểm tra này chặn cả SPLIT/MERGED/RETIRED và các trạng thái kết cấu không-active
  // có thể được bổ sung sau này, thay vì chỉ biết riêng SPLIT.
  const miniStructurallyActive = st => !st.structuralStatus || st.structuralStatus === 'ACTIVE';
  // LƯU Ý: hàm này được gọi từ `A.resetMiniRequestState` (core.js `demo-account` — đổi TÀI KHOẢN
  // DEMO đang dùng để xem web/app, KHÔNG phải đổi "danh tính điện thoại" đang mô phỏng) NGOÀI RA còn
  // gọi từ `mini-trader`/`mini-logout` bên dưới (đổi tiểu thương mẫu / đăng xuất — đây MỚI thật sự
  // là đổi danh tính điện thoại).
  function miniResetRequestState() {
    Object.assign(mini(), { splitPoint: null, splitDraft: null, mergeDraft: null, convertPoint: null, convertDraft: null, reqView: null, reqFilter: 'all' });
  }
  // Reset luồng đăng nhập/kích hoạt Mini App (SĐT → xác nhận → OTP) về bước đầu — gọi khi đổi tiểu
  // thương mẫu/đăng xuất (đổi danh tính điện thoại thật sự), KHÔNG gọi từ `A.resetMiniRequestState`
  // (đổi account demo Web/BQL không nên làm mất phiên đăng nhập SĐT đang nhập dở trên "điện thoại").
  function miniResetLoginFlow() {
    Object.assign(mini(), { loginStep: 'phone', loginPhone: null, loginTraderId: null });
  }
  // Adjacency V1 chỉ dành cho prototype: cùng floor/section, cùng row và num liền kề.
  // Không có geometry/span trong model nên không suy diễn đây là quy tắc mặt bằng chính thức.
  function miniMergeCandidates(t, st) { return A.db.stalls.filter(x => x.id !== st.id && x.market === 'CL' && miniOwnsStall(t,x) && miniStructurallyActive(x) && x.floor===st.floor && x.section===st.section && x.row!=null && x.row===st.row && x.num!=null && Math.abs(x.num-st.num)===1 && !A.db.pointRequests.some(r=>r.status!=='REJECTED'&&r.status!=='COMPLETED'&&((r.sourcePointIds||[]).includes(x.id)||r.pointId===x.id))); }
  // "Chuyển đổi vị trí" (RELOCATE_TO_VACANT_POINT) — KHÔNG cần liền kề/cùng khu vực (khác Gộp điểm),
  // target là 1 điểm CÒN TRỐNG bất kỳ trong Chợ Cao Lãnh (không thuộc quyền sử dụng của trader — điểm
  // trống thì không ai đang dùng). Conflict check dùng A.pointReq.convertActiveConflict (expose từ
  // js/v-tieuthuong.js) — biết cả SPLIT.pointId/MERGE.sourcePointIds/CONVERT.fromPointId|toPointId,
  // rộng hơn hẳn cách chặn trùng cũ của miniMergeCandidates (chỉ biết SPLIT/MERGE).
  function miniConvertCandidates(t, st) { return A.pointReq.convertTargetCandidates ? A.pointReq.convertTargetCandidates(st, null) : []; }
  // Cho phép luồng đổi Account Demo ở core.js xoá state self-service trước khi chuyển route.
  A.resetMiniRequestState = miniResetRequestState;
  // Nhãn trạng thái thân thiện cho tiểu thương (mục 11 yêu cầu bổ sung) — CHỈ đổi label hiển thị,
  // KHÔNG đổi state machine Web (A.db.pointRequests[].status vẫn nguyên giá trị kỹ thuật).
  const MINI_STATUS_LABEL = {
    DRAFT: 'Đã gửi — Chờ Ban Quản lý tiếp nhận', STAFF_REVIEW: 'Ban Quản lý đang xử lý',
    PENDING_APPROVAL: 'Chờ phê duyệt', APPROVED: 'Đã được phê duyệt', IMPLEMENTING: 'Đang thực hiện',
    COMPLETED: 'Hoàn thành', REJECTED: 'Không được chấp thuận'
  };
  const MINI_STATUS_CLASS = {
    DRAFT: 'info', STAFF_REVIEW: 'info', PENDING_APPROVAL: 'warn', APPROVED: 'info',
    IMPLEMENTING: 'warn', COMPLETED: 'ok', REJECTED: 'danger'
  };
  // Nhãn thân thiện cho từng bước timeline (mục 10 yêu cầu bổ sung) — Mini App CHỈ hiển thị request
  // nguồn TRADER nên chỉ cần bộ nhãn khớp DKREQ_STEPS_TRADER (v-tieuthuong.js); TRẠNG THÁI từng bước
  // (done/current/rejected/pending) lấy từ A.pointReq.stepStates(r) — CÙNG 1 nơi tính, không viết lại.
  const MINI_STEP_LABEL = {
    created: 'Đã gửi yêu cầu', received: 'Ban Quản lý đã tiếp nhận', planned: 'Ban Quản lý đã lập phương án',
    submitted: 'Chờ phê duyệt', approved: 'Đã được phê duyệt', implementing: 'Đang thực hiện', completed: 'Hoàn thành'
  };
  const MINI_REQ_FILTERS = [['all', 'Tất cả'], ['processing', 'Đang xử lý'], ['done', 'Hoàn thành'], ['rejected', 'Không được chấp thuận']];
  function miniMyRequests(t) {
    // Chỉ request Tách điểm CỦA CHÍNH tiểu thương hiện tại (mục 9 yêu cầu bổ sung: source=TRADER +
    // requestedByTraderId = trader hiện tại) — không cho xem yêu cầu của tiểu thương khác.
    return A.db.pointRequests.filter(r => (r.type === 'SPLIT' || r.type === 'MERGE' || r.type === 'CONVERT') && r.source === 'TRADER' && r.requestedByTraderId === t.id)
      .sort((a, b) => b.id.localeCompare(a.id));
  }
  function miniReqFilterMatch(r, f) {
    if (!f || f === 'all') return true;
    if (f === 'processing') return A.pointReq.isActive(r);
    if (f === 'done') return r.status === 'COMPLETED';
    if (f === 'rejected') return r.status === 'REJECTED';
    return true;
  }
  function miniTimelineHtml(r) {
    return A.pointReq.stepStates(r).map(s => {
      const ico = s.state === 'done' ? '✓' : s.state === 'rejected' ? '✗' : s.state === 'current' ? '●' : '○';
      const label = s.state === 'rejected' ? 'Không được chấp thuận' : (MINI_STEP_LABEL[s.key] || s.key);
      return `<div class="it" style="align-items:flex-start"><span style="width:20px;flex:none">${ico}</span><span style="flex:1">${U.esc(label)}${s.at ? `<div class="small muted">${U.esc(s.at)}</div>` : ''}</span></div>`;
    }).join('');
  }
  // Ghi chú riêng theo trạng thái (mục 12-14 yêu cầu bổ sung) — phân biệt rõ APPROVED (đã duyệt
  // phương án, CHƯA tách) với COMPLETED (đã tách xong), không được nói "đã tách" khi mới APPROVED.
  function miniReqStatusNoteHtml(r) {
    if (r.status === 'REJECTED') {
      const rej = (r.timeline || []).find(e => e.key === 'approved' && e.note);
      const reason = rej ? String(rej.note).replace(/^Từ chối:\s*/, '') : '';
      return `<div class="note" style="margin-top:0">Yêu cầu của bạn không được chấp thuận.${reason ? '<br>Lý do: ' + U.esc(reason) : ''}</div>`;
    }
    if (r.status === 'APPROVED') {
      const label = r.type === 'MERGE' ? 'gộp điểm' : r.type === 'CONVERT' ? 'chuyển đổi vị trí' : 'tách điểm';
      return `<div class="note info" style="margin-top:0">Phương án ${label} đã được phê duyệt. Ban Quản lý đang chuẩn bị thực hiện.</div>`;
    }
    if (r.status === 'COMPLETED' && r.resultPointIds && r.resultPointIds.length) {
      const st = A.idx.stall.get(r.type === 'CONVERT' ? r.fromPointId : r.pointId);
      // resultPointIds là INTERNAL ID — lookup rồi hiển thị business point code, KHÔNG dùng code làm
      // identity (mục 14 yêu cầu bổ sung). Mini App hiện KHÔNG có cơ chế mở "chi tiết điểm" riêng
      // (không có drawer như Web) nên chỉ hiển thị mã, không tạo nút [Xem ...] giả không có đích đến.
      const codes = r.resultPointIds.map(id => { const s2 = A.idx.stall.get(id); return s2 ? U.esc(s2.code) : ''; }).filter(Boolean);
      if (r.type === 'CONVERT') return `<div class="note info" style="margin-top:0">Điểm ${st ? U.esc(st.code) : ''} đã chuyển sang:<br><b>${codes.join(', ')}</b></div>`;
      return `<div class="note info" style="margin-top:0">${r.type === 'MERGE' ? 'Yêu cầu gộp đã hoàn thành, điểm kết quả:' : 'Điểm ' + (st ? U.esc(st.code) : '') + ' đã được tách thành:'}<br><b>${codes.join(', ')}</b></div>`;
    }
    return '';
  }
  function miniReqRowHtml(r) {
    const st = A.idx.stall.get(r.type === 'CONVERT' ? r.fromPointId : r.pointId);
    const codes = r.type === 'MERGE' ? (r.sourcePointIds || []).map(id => { const x = A.idx.stall.get(id); return x ? x.code : id; }).join(' + ')
      : r.type === 'CONVERT' ? [r.fromPointId, r.plan && r.plan.toPointId ? r.plan.toPointId : r.toPointId].map(id => { const x = id && A.idx.stall.get(id); return x ? x.code : (id || '?'); }).join(' → ') : null;
    const title = r.type === 'MERGE' ? 'Gộp điểm ' + codes : r.type === 'CONVERT' ? 'Chuyển đổi vị trí ' + codes : 'Tách điểm ' + (st ? st.code : r.pointId);
    return `<div class="it" style="flex-wrap:wrap;cursor:pointer" data-act="mini-req-view" data-id="${r.id}">
      <span>${r.id}<div class="small muted">${title}</div></span>
      <span style="text-align:right"><span class="tag ${MINI_STATUS_CLASS[r.status] || ''}">${U.esc(MINI_STATUS_LABEL[r.status] || r.status)}</span><div class="small muted" style="margin-top:2px">${U.dmy(r.requestedAt)}</div></span>
    </div>`;
  }
  // Card "Điểm kinh doanh của tôi" (mục 3 yêu cầu bổ sung) — style m-card/m-list/kv sẵn có, KHÔNG tạo
  // component mới. "Xem chi tiết" tái dùng NGUYÊN action mini-tab có sẵn (chuyển sang tab Hợp đồng,
  // nơi đã có đủ thông tin hợp đồng chi tiết của điểm) — không tạo màn/route mới chỉ để xem thêm.
  function miniPointCard(t, st) {
    const c = st.contractId ? A.idx.contract.get(st.contractId) : null;
    const active = st.market === 'CL' ? A.pointReq.activeFor(st.id) : null;
    // Điều kiện hiện nút "Gửi yêu cầu tách điểm" (mục 3 yêu cầu bổ sung): thuộc CL, chưa
    // structuralStatus SPLIT, thuộc quyền sử dụng của chính trader này, và KHÔNG có request SPLIT
    // nào đang active cho điểm này (mục 4 yêu cầu bổ sung — chặn tạo trùng).
    const canSplit = st.market === 'CL' && miniStructurallyActive(st) && miniOwnsStall(t, st) && !active;
    const canMerge = canSplit && miniMergeCandidates(t,st).length;
    // "Gửi yêu cầu chuyển vị trí": conflict check RIÊNG (convertActiveConflict — biết cả CONVERT),
    // KHÔNG dùng chung biến `active` ở trên (chỉ biết SPLIT — xem ghi chú A.pointReq.activeFor,
    // js/v-tieuthuong.js) để không bỏ sót trường hợp điểm đang dính 1 yêu cầu CONVERT khác.
    const convertConflict = st.market === 'CL' && A.pointReq.convertActiveConflict && A.pointReq.convertActiveConflict(st.id);
    const canConvert = st.market === 'CL' && miniStructurallyActive(st) && miniOwnsStall(t, st) && !convertConflict && miniConvertCandidates(t, st).length;
    return `<div class="m-card"><b>${st.code}</b><div class="small muted" style="margin:2px 0 8px">${U.esc(st.sectionName)}</div>
      <dl class="kv">
        <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd>
        <dt>Ngành hàng</dt><dd>${U.esc(st.cat) || 'Chưa có thông tin'}</dd>
        <dt>Hợp đồng</dt><dd>${c ? c.id : 'Chưa có hợp đồng hiệu lực'}</dd>
        <dt>Trạng thái</dt><dd>${D.STATUS[st.status] ? D.STATUS[st.status].label : st.status}${st.structuralStatus === 'SPLIT' ? ' · Đã tách' : ''}</dd>
      </dl>
      <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap">
        <button class="btn sm" data-act="mini-tab" data-id="contract">Xem chi tiết</button>
        ${st.market === 'CL' && canConvert ? `<button class="btn sm" data-act="mini-convert-open" data-id="${st.id}">Gửi yêu cầu chuyển vị trí</button>` : ''}
        ${st.market === 'CL' ? (active
          ? `<button class="btn sm" data-act="mini-req-view" data-id="${active.id}">Xem yêu cầu đang xử lý</button>`
          : (canSplit ? `<button class="btn sm" data-act="mini-split-open" data-id="${st.id}">Gửi yêu cầu tách điểm</button>${canMerge?`<button class="btn sm" data-act="mini-merge-open" data-id="${st.id}">Gửi yêu cầu gộp điểm</button>`:''}` : '')
        ) : ''}
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
      <div class="m-card small">${list.map(i => `<div class="row" style="padding:3px 0"><span style="flex:1">Kỳ ${U.per(i.period)} · ${A.idx.stall.get(i.stallId).code}</span><b>${U.money(U.due(i))}</b></div>`).join('')}</div>
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
    }).join('')}${invs.map(i => `<div class="it" style="flex-wrap:wrap;cursor:pointer" data-act="mini-bill" data-id="${i.id}"><span>Kỳ ${U.per(i.period)}<div class="small muted">${A.idx.stall.get(i.stallId).code}</div></span><span style="text-align:right"><b>${U.money(i.amount)}</b><div>${U.invTag(i)}</div></span>
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
    const general = A.db.notifications.filter(n => n.traderId === t.id || n.group === 'Toàn bộ tiểu thương' || n.group === mk || n.group === 'Ngành hàng: ' + t.cat || (debt && n.group === 'Danh sách nợ phí'));
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
        ${(i.state === 'hoanthanh' || i.state === 'dong') ? `<div class="stars" style="width:100%">${[1, 2, 3, 4, 5].map(n => `<button class="${i.rating >= n ? 'on' : ''}" data-act="mini-rate" data-id="${i.id}" data-n="${n}" aria-label="${n} sao">★</button>`).join('')}<span class="small muted">${i.rating ? 'Cảm ơn bạn đã đánh giá' : 'Đánh giá dịch vụ'}</span></div>` : ''}</div>`).join('')}</div></div>` : ''}
      ${tabMyRequests(t)}`;
  }
  // "Yêu cầu của tôi" (mục 9 yêu cầu bổ sung) — tích hợp NGAY trong tab "Phản ánh" đã có sẵn kiểu
  // theo dõi yêu cầu/phản ánh tương tự (mục "Phản ánh đã gửi" ở trên), KHÔNG thêm mục điều hướng
  // dư thừa (.m-tabs đã cố định 5 cột, không đủ chỗ thêm tab). Chỉ hiển thị request Tách điểm.
  function tabMyRequests(t) {
    const f = mini().reqFilter || 'all';
    const rows = miniMyRequests(t).filter(r => miniReqFilterMatch(r, f));
    return `<div class="m-card"><b>Yêu cầu của tôi</b>
      <div class="row" style="gap:4px;margin:8px 0;flex-wrap:wrap">${MINI_REQ_FILTERS.map(x => `<button class="btn sm ${f === x[0] ? 'primary' : ''}" data-act="mini-req-filter" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>
      <div class="m-list">${rows.length ? rows.map(miniReqRowHtml).join('') : '<div class="small muted">Chưa có yêu cầu tách điểm nào.</div>'}</div></div>`;
  }

  // "YÊU CẦU TÁCH ĐIỂM" (mục 5-6 yêu cầu bổ sung) — màn con TRONG khung điện thoại (cùng kỹ thuật
  // swap `body` theo state đã có ở screenPay: m.pay), KHÔNG dùng A.modal() vì modal render ra ngoài
  // khung điện thoại (#modal-root ở ngoài .phone), phá vỡ ảo giác "trong app". Tiểu thương CHỈ được
  // nhập lý do/ghi chú/tệp — KHÔNG có bất kỳ field phương án kỹ thuật nào (mã điểm mới/diện tích
  // từng điểm con/loại điểm/ngành hàng quy hoạch/người xử lý/người phê duyệt — mục 6 yêu cầu bổ sung).
  function screenSplitForm(t) {
    const m = mini(), st = A.idx.stall.get(m.splitPoint), d = m.splitDraft;
    if (!st || !d || st.market !== 'CL' || !miniOwnsStall(t, st)) { m.splitPoint = null; m.splitDraft = null; return tabHome(t); }
    const c = st.contractId ? A.idx.contract.get(st.contractId) : null;
    return `<div class="m-body"><button class="btn sm" style="align-self:flex-start" data-act="mini-split-cancel">‹ Quay lại</button>
      <div class="m-card"><b>Yêu cầu tách điểm</b>
        <dl class="kv" style="margin-top:8px">
          <dt>Điểm kinh doanh</dt><dd>${st.code}</dd>
          <dt>Vị trí</dt><dd>${U.esc(st.sectionName)}</dd>
          <dt>Diện tích hiện tại</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd>
          <dt>Ngành hàng</dt><dd>${U.esc(st.cat) || 'Chưa có thông tin'}</dd>
          <dt>Hợp đồng hiện hành</dt><dd>${c ? c.id : 'Chưa có hợp đồng hiệu lực'}</dd>
        </dl></div>
      <div class="m-card">
        <div class="field"><label>Lý do muốn tách *</label><textarea class="input" rows="3" id="mini-split-reason" data-in="mini-split-reason" placeholder="Mô tả nhu cầu...">${U.esc(d.reason)}</textarea></div>
        <div class="field" style="margin-top:8px"><label>Ghi chú</label><textarea class="input" rows="2" id="mini-split-note" data-in="mini-split-note">${U.esc(d.note)}</textarea></div>
        <div class="field" style="margin-top:8px"><label>Người dự kiến trực tiếp kinh doanh sau khi tách <span class="muted">(không bắt buộc)</span></label><input class="input" data-in="mini-split-proposed-name" value="${U.esc(d.proposedName || '')}" placeholder="Chưa xác định"><div class="small muted" style="margin-top:2px">Chỉ là thông tin dự kiến; không tự trở thành người bán đã xác minh.</div></div>
        <div class="field" style="margin-top:8px"><label>Hình ảnh / tài liệu kèm theo</label>
          <div class="row" style="gap:6px;flex-wrap:wrap">${d.files.map((name, i) => `<span class="tag info">${U.esc(name)} <button class="x" style="font-size:14px;line-height:1" data-act="mini-split-file-remove" data-idx="${i}" aria-label="Bỏ tệp ${U.esc(name)}">×</button></span>`).join('')}
          <button class="btn sm" type="button" data-act="mini-split-file-pick">+ Thêm</button></div>
          <div class="small muted" style="margin-top:2px">Chỉ mô phỏng chọn tệp minh họa cho prototype, chưa upload lên máy chủ.</div></div>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn" data-act="mini-split-cancel">Hủy</button>
        <button class="m-btn solid" style="width:auto;flex:1" data-act="mini-split-save">Gửi yêu cầu</button>
      </div></div>`;
  }
  function screenMergeForm(t) {
    const m=mini(), d=m.mergeDraft, a=d&&A.idx.stall.get(d.a), candidates=a?miniMergeCandidates(t,a):[];
    if(!d||!a||!miniOwnsStall(t,a)){m.mergeDraft=null;return tabHome(t);}
    return `<div class="m-body"><button class="btn sm" data-act="mini-merge-cancel">‹ Quay lại</button><div class="m-card"><b>Yêu cầu gộp điểm</b><dl class="kv"><dt>Điểm thứ nhất</dt><dd>${a.code}</dd><dt>Điểm gộp cùng *</dt><dd><select class="input" data-ch="mini-merge-b"><option value="">— Chọn điểm liền kề —</option>${candidates.map(x=>`<option value="${x.id}" ${d.b===x.id?'selected':''}>${x.code} · ${x.area} m²</option>`).join('')}</select></dd></dl><div class="small muted">Chỉ hiện điểm của chính bạn, liền kề theo row/num cùng khu — quy tắc prototype.</div></div>${d.b&&A.idx.stall.get(d.b)?`<div class="m-card"><b>Hai điểm đề nghị gộp</b><div class="small" style="margin-top:8px">${a.code} (${a.area} m²) + ${A.idx.stall.get(d.b).code} (${A.idx.stall.get(d.b).area} m²)</div><div class="field" style="margin-top:10px"><label>Lý do *</label><textarea class="input" data-in="mini-merge-reason">${U.esc(d.reason||'')}</textarea></div><div class="field"><label>Tài liệu minh họa</label><button class="btn sm" data-act="mini-merge-file">+ Thêm (mock)</button></div></div><div class="row"><button class="btn" data-act="mini-merge-cancel">Hủy</button><button class="m-btn solid" style="width:auto;flex:1" data-act="mini-merge-save">Gửi yêu cầu</button></div>`:''}</div>`;
  }
  // "Đề nghị chuyển vị trí" (RELOCATE_TO_VACANT_POINT, Mini App) — tiểu thương chọn ĐÚNG điểm hiện
  // tại của mình + 1 điểm còn trống bất kỳ trong Chợ Cao Lãnh (KHÔNG cần liền kề, khác Gộp điểm) +
  // lý do/ghi chú/tệp minh họa. KHÔNG có field phương án kỹ thuật nào khác (không sửa area/pointCode/
  // đơn giá) — giống hệt tinh thần "trader chỉ đề nghị, NV BQL lập phương án" của Tách/Gộp điểm.
  function screenConvertForm(t) {
    const m = mini(), st = A.idx.stall.get(m.convertPoint), d = m.convertDraft;
    if (!st || !d || st.market !== 'CL' || !miniOwnsStall(t, st)) { m.convertPoint = null; m.convertDraft = null; return tabHome(t); }
    const candidates = miniConvertCandidates(t, st);
    const target = d.toPointId ? A.idx.stall.get(d.toPointId) : null;
    return `<div class="m-body"><button class="btn sm" style="align-self:flex-start" data-act="mini-convert-cancel">‹ Quay lại</button>
      <div class="m-card"><b>Đề nghị chuyển vị trí</b>
        <dl class="kv" style="margin-top:8px">
          <dt>Điểm hiện tại</dt><dd>${st.code}</dd>
          <dt>Vị trí</dt><dd>${U.esc(st.sectionName)}</dd>
          <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd>
        </dl>
        <div class="field" style="margin-top:8px"><label>Điểm còn trống muốn chuyển đến *</label><select class="input" data-ch="mini-convert-to"><option value="">— Chọn điểm —</option>${candidates.map(x => `<option value="${x.id}" ${d.toPointId === x.id ? 'selected' : ''}>${x.code} · ${U.esc(x.sectionName)} · ${x.area.toLocaleString('vi-VN')} m²</option>`).join('')}</select></div>
        ${!candidates.length ? '<div class="small muted" style="margin-top:6px">Hiện không có điểm nào còn trống trong Chợ Cao Lãnh.</div>' : ''}
      </div>
      ${target ? `<div class="m-card">
        <div class="small" style="margin-bottom:8px">${st.code} (${st.area} m²) → ${target.code} (${target.area} m²)</div>
        <div class="field"><label>Lý do muốn chuyển vị trí *</label><textarea class="input" rows="3" data-in="mini-convert-reason" placeholder="Mô tả nhu cầu...">${U.esc(d.reason)}</textarea></div>
        <div class="field" style="margin-top:8px"><label>Ghi chú</label><textarea class="input" rows="2" data-in="mini-convert-note">${U.esc(d.note)}</textarea></div>
        <div class="field" style="margin-top:8px"><label>Hình ảnh / tài liệu kèm theo</label><button class="btn sm" type="button" data-act="mini-convert-file">+ Thêm (mock)</button>${d.files.length ? `<div class="small muted" style="margin-top:4px">${d.files.map(n => U.esc(n)).join(', ')}</div>` : ''}</div>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn" data-act="mini-convert-cancel">Hủy</button>
        <button class="m-btn solid" style="width:auto;flex:1" data-act="mini-convert-save">Gửi yêu cầu</button>
      </div>` : ''}</div>`;
  }
  // "CHI TIẾT YÊU CẦU" (mục 10 yêu cầu bổ sung) — render tiến độ TRỰC TIẾP từ timeline thật của
  // CHÍNH request (miniTimelineHtml → A.pointReq.stepStates), không tạo timeline riêng không liên
  // kết với request Web.
  function screenReqDetail(t) {
    const m = mini(), r = A.pointReq.find(m.reqView);
    // Re-check ownership (mục 9 yêu cầu bổ sung: không cho xem yêu cầu của người khác) — phòng thủ
    // thêm ở nơi RENDER, không chỉ ở handler mở (m.reqView có thể bị chỉnh tay/lưu localStorage cũ).
    if (!r || r.source !== 'TRADER' || r.requestedByTraderId !== t.id) { m.reqView = null; return tabHome(t); }
    const st = A.idx.stall.get(r.type === 'CONVERT' ? r.fromPointId : r.pointId);
    const codes = r.type === 'MERGE' ? (r.sourcePointIds || []).map(id => { const x = A.idx.stall.get(id); return x ? x.code : id; }).join(' + ')
      : r.type === 'CONVERT' ? [r.fromPointId, r.plan && r.plan.toPointId ? r.plan.toPointId : r.toPointId].map(id => { const x = id && A.idx.stall.get(id); return x ? x.code : (id || 'Chưa chọn'); }).join(' → ') : null;
    return `<div class="m-body"><button class="btn sm" style="align-self:flex-start" data-act="mini-req-close">‹ Quay lại</button>
      <div class="m-card"><b>Chi tiết yêu cầu</b>
        <dl class="kv" style="margin-top:8px">
          <dt>Mã yêu cầu</dt><dd>${r.id}</dd>
          <dt>Loại</dt><dd>${r.type==='MERGE'?'Gộp điểm kinh doanh':r.type==='CONVERT'?'Chuyển đổi vị trí điểm kinh doanh':'Tách điểm kinh doanh'}</dd>
          <dt>Điểm</dt><dd>${r.type==='MERGE'||r.type==='CONVERT'?codes:(st ? st.code : r.pointId)}</dd>
          <dt>Ngày gửi</dt><dd>${U.dmy(r.requestedAt)}</dd>
          <dt>Lý do</dt><dd>${U.esc(r.reason) || 'Chưa ghi nhận'}</dd>
          <dt>Trạng thái hiện tại</dt><dd><span class="tag ${MINI_STATUS_CLASS[r.status] || ''}">${U.esc(MINI_STATUS_LABEL[r.status] || r.status)}</span></dd>
        </dl></div>
      ${miniReqStatusNoteHtml(r)}
      <div class="m-card"><b>Tiến độ xử lý</b><div class="m-list" style="margin-top:6px">${miniTimelineHtml(r)}</div></div></div>`;
  }
  function tabRegister(t) {
    ensureMiniRegistrationModel();
    const m = mini();
    m.regForm = m.regForm || { kind: 'SESSION', stalls: 1, method: 'ONLINE', term: 'MONTH' };
    const form = m.regForm;
    const sessions = openRegistrationSessions();
    let s = sessions.find(x => x.id === form.sessionId) || sessions[0];
    if (s) form.sessionId = s.id;
    const cat = form.cat || (s && s.allowedBusinessCategories && s.allowedBusinessCategories[0]) || '';
    form.cat = cat;
    const n = Math.max(1, Number(form.stalls || 1));
    const snap = s ? miniSnapshotAmount(n, s.marketId) : null;
    const fixed = fixedMonthlyAmount(form.term || 'MONTH');
    const reasons = miniRegBusinessStateReasons(t, form);
    const mySessionRegs = A.db.sessionRegistrations.filter(r => r.merchantId === t.id && r.marketId === ui.market).slice(-3).reverse();
    const myFixed = A.db.fixedStallApplications.filter(r => r.traderId === t.id && r.marketId === ui.market).slice(-3).reverse();
    return `<div class="m-card"><b>Đăng ký quầy chợ</b>
      <div class="seg" style="margin-top:10px">${[['SESSION', 'Theo phiên'], ['FIXED', 'Tháng/quý']].map(x => `<button class="${form.kind === x[0] ? 'on' : ''}" data-act="mini-reg-kind" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>
      ${form.kind === 'SESSION' ? (sessions.length ? `<div class="field" style="margin-top:10px"><label>Phiên chợ đang mở đăng ký</label><select class="input" data-ch="mini-reg-form" data-k="sessionId">${sessions.map(x => `<option value="${x.id}" ${form.sessionId === x.id ? 'selected' : ''}>${U.dmy(x.sessionDate)} · còn ${miniAvailableStalls(x)} quầy</option>`).join('')}</select></div>
        <div class="form-grid" style="margin-top:8px">
          <div class="field"><label>Số quầy</label><input class="input" type="number" min="1" data-ch="mini-reg-form" data-k="stalls" value="${n}"></div>
          <div class="field"><label>Ngành hàng</label><select class="input" data-ch="mini-reg-form" data-k="cat">${s ? (s.allowedBusinessCategories || []).map(c => `<option value="${U.esc(c)}" ${cat === c ? 'selected' : ''}>${U.esc(c)}</option>`).join('') : ''}</select></div>
          <div class="field"><label>Hình thức thanh toán</label><select class="input" data-ch="mini-reg-form" data-k="method"><option value="ONLINE" ${form.method !== 'CASH' ? 'selected' : ''}>QR code thanh toán tự động</option><option value="CASH" ${form.method === 'CASH' ? 'selected' : ''}>Thanh toán tiền mặt</option></select></div>
        </div>
        <dl class="kv" style="margin-top:10px"><dt>Tạm tính</dt><dd><b>${snap ? U.money(snap.totalAmount) : '-'}</b></dd><dt>Trạng thái phiên</dt><dd>${s ? U.esc(s.status) : '-'}</dd></dl>` : '<div class="note" style="margin-top:10px">Hiện chưa có phiên chợ nào đang mở đăng ký trong phạm vi tài khoản.</div>') : `<div class="field" style="margin-top:10px"><label>Kỳ thuê</label><select class="input" data-ch="mini-reg-form" data-k="term"><option value="MONTH" ${form.term !== 'QUARTER' ? 'selected' : ''}>Theo tháng</option><option value="QUARTER" ${form.term === 'QUARTER' ? 'selected' : ''}>Theo quý</option></select></div>
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
      }).join('')}${myFixed.map(r => `<div class="it"><span>${U.esc(r.id)}<div class="small muted">${r.term === 'QUARTER' ? 'Theo quý' : 'Theo tháng'}</div></span><span class="tag warn">${U.esc(r.status)}</span></div>`).join('') || (!mySessionRegs.length ? '<div class="small muted">Chưa có đăng ký</div>' : '')}</div></div>`;
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
    else if (m.splitPoint) body = screenSplitForm(t);
    else if (m.mergeDraft) body = screenMergeForm(t);
    else if (m.convertPoint) body = screenConvertForm(t);
    else if (m.reqView) body = screenReqDetail(t);
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
          <button class="m-btn" data-act="mini-session-cash-paid" ${isCollectorMini() ? '' : 'disabled'}>Ghi nhận thu tiền mặt</button></div></div>`;
    } else if (selected) {
      body = `<div class="m-body"><button class="btn sm" style="align-self:flex-start" data-act="mini-collector-home">‹ Quay lại</button>
        <div class="m-card"><b>${U.esc(selected.name)}</b><div class="small muted">${selected.id} · ${U.maskPhone(selected.phone)} · ${U.mShort(selected.market)}</div>
          <div class="m-list" style="margin-top:8px">${due.map(i => `<div class="it"><span>Kỳ ${U.per(i.period)}<div class="small muted">${A.idx.stall.get(i.stallId).code}</div></span><b>${U.money(U.due(i))}</b></div>`).join('') || '<div class="small muted">Không còn khoản phải thu</div>'}</div></div>
        <div class="m-card m-due"><div class="small" style="opacity:.85">Tổng cần thu</div><div class="amt">${U.money(total)}</div>
          <button class="m-btn" data-act="mini-collect-paid" ${total > 0 && isCollectorMini() && miniCollectingBusinessStateOk(due) ? '' : 'disabled'}>Ghi nhận thu tiền mặt</button></div></div>`;
    } else {
      body = `<div class="m-head"><div class="hi">Xin chào,</div><div class="nm">${U.esc(A.currentAccount().fullName)}</div><div class="hi">${U.esc(U.market(ui.market).short)}</div></div>
        <div class="m-body"><div class="m-card m-due"><div class="small" style="opacity:.85">Cần thu hôm nay</div><div class="amt">${list.length + sessionDues.length}</div><div class="small">Tổng ${U.money(U.sum(list, x => x.amt) + U.sum(sessionDues, x => x.amount))}</div></div>
        ${sessionDues.length ? `<div class="m-card"><b>Đăng ký phiên chờ thu tiền mặt</b><div class="m-list">${sessionDues.slice(0, 12).map(x => `<button class="it" style="width:100%;text-align:left;background:transparent;border:0;cursor:pointer" data-act="mini-session-cash-open" data-id="${x.reg.id}">
          <span><b>${U.esc(x.trader.name)}</b><div class="small muted">${U.esc(x.reg.code || x.reg.id)} · trước điểm danh ${U.dmy(x.session.sessionDate)}</div></span>
          <span style="text-align:right"><b>${U.money(x.amount)}</b><div class="small muted">${U.esc(x.deadline || '')}</div></span></button>`).join('')}</div></div>` : ''}
        <div class="m-card"><b>Danh sách tiểu thương</b><div class="m-list">${list.slice(0, 12).map(x => `<button class="it" style="width:100%;text-align:left;background:transparent;border:0;cursor:pointer" data-act="mini-collect-open" data-id="${x.t.id}">
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
    const t = trader(), list = sampleTraders();
    if (!t) return '<div class="empty">Không có tiểu thương trong phạm vi tài khoản mini app.</div>';
    return `<div class="mini-wrap"><div>${phone(t)}</div>
      <div class="grid" style="align-content:start">
        <div class="card"><div class="card-h"><h3>Mini app tiểu thương</h3></div><div class="card-b">
          <p class="muted" style="margin-top:0">Ứng dụng cho iOS 14+ và Android 10+ (hoặc mini app trên Zalo). Tiểu thương đăng nhập bằng số điện thoại đã đăng ký với Ban Quản lý chợ và mã đăng nhập một lần (OTP giả lập).</p>
          <div class="field"><label>Xem với tư cách tiểu thương mẫu</label><select class="input" data-ch="mini-trader">${list.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${U.esc(x.name)} · ${x.stalls.map(id => A.idx.stall.get(id).code).join(', ')} · ${U.mShort(x.market)}${U.traderDebt(x.id) ? ' · nợ ' + U.moneyShort(U.traderDebt(x.id)) : ''}</option>`).join('')}</select></div>
          ${mini().step === 'app' ? '<button class="btn" style="margin-top:10px" data-act="mini-logout">Đăng xuất</button>' : ''}</div></div>
        <div class="card"><div class="card-h"><h3>Kịch bản demo</h3></div><div class="card-b"><ol class="script">
          <li><div>Bấm <b>Nhận mã đăng nhập</b> (SĐT có sẵn của tiểu thương mẫu đang chọn) → <b>Gửi mã đăng nhập</b> → <b>Xác nhận</b> để đăng nhập.</div></li>
          <li><div>Ở Trang chủ, bấm <b>Thanh toán bằng QR</b> → <b>Giả lập: đã chuyển khoản</b>. Hệ thống ghi nhận, phát hành biên lai điện tử, cập nhật công nợ.</div></li>
          <li><div>Mở tab <b>Phản ánh</b>, đính kèm ảnh và <b>Gửi phản ánh</b>.</div></li>
          <li><div>Đổi vai trò sang <b>Ban Quản lý chợ</b> → <b>Phản ánh & sự cố</b>: phản ánh mới nằm ở cột "Tiếp nhận". Chuyển đến "Hoàn thành" rồi quay lại đây để <b>đánh giá sao</b>.</div></li>
        </ol></div></div>      </div></div>`;
  };

  A.CH['mini-trader'] = el => { miniResetRequestState(); miniResetLoginFlow(); Object.assign(mini(), { traderId: el.value, step: 'login', tab: 'home', pay: null, bill: null, attach: false }); A.render(); };
  A.IN['mini-split-reason'] = el => { if (mini().splitDraft) mini().splitDraft.reason = el.value; };
  A.IN['mini-split-note'] = el => { if (mini().splitDraft) mini().splitDraft.note = el.value; };
  A.IN['mini-split-proposed-name'] = el => { if (mini().splitDraft) mini().splitDraft.proposedName = el.value; };
  A.IN['mini-merge-reason'] = el => { if (mini().mergeDraft) mini().mergeDraft.reason = el.value; };
  A.CH['mini-merge-b'] = el => { if (mini().mergeDraft) { mini().mergeDraft.b=el.value; A.render(); } };
  A.CH['mini-convert-to'] = el => { if (mini().convertDraft) { mini().convertDraft.toPointId = el.value || null; A.render(); } };
  A.IN['mini-convert-reason'] = el => { if (mini().convertDraft) mini().convertDraft.reason = el.value; };
  A.IN['mini-convert-note'] = el => { if (mini().convertDraft) mini().convertDraft.note = el.value; };
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
    'mini-logout': () => { miniResetRequestState(); miniResetLoginFlow(); Object.assign(mini(), { step: 'login', pay: null, tab: 'home' }); A.render(); },
    'mini-tab': el => { mini().tab = el.dataset.id; mini().bill = null; A.render(); },
    'mini-home': () => { mini().pay = null; mini().tab = 'home'; A.render(); },
    'mini-pay': () => { mini().pay = 'qr'; A.render(); },
    'mini-paid': () => {
      const t = trader(), list = unpaid(t);
      if (!isTraderMini() || !t || !inMiniScopeMarket(t.market)) { U.toast('Không có quyền thanh toán cho tiểu thương này'); return; }
      const pays = A.applyPayment(list.map(i => i.id), U.sum(list, U.due), 'qr', 'Mini app');
      mini().lastPays = pays; mini().pay = 'done'; A.render();
      U.toast('Ngân hàng báo có · hệ thống tự ghi nhận ' + U.money(U.sum(pays, p => p.amount)));
    },
    'mini-collect-open': el => {
      const t = A.idx.trader.get(el.dataset.id);
      if (!t || t.market !== ui.market) return;
      Object.assign(mini(), { collectTraderId: t.id, collectDone: false, lastPays: null });
      A.render();
    },
    'mini-collector-home': () => { Object.assign(mini(), { collectTraderId: null, collectSessionRegId: null, collectDone: false, lastPays: null }); A.render(); },
    'mini-session-cash-open': el => {
      const due = miniSessionCashDues().find(x => x.reg.id === el.dataset.id);
      if (!due || !isCollectorMini()) return;
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
    'mini-report': () => {
      const text = A.$('#mr-text').value.trim();
      if (!text) { U.toast('Vui lòng nhập nội dung'); return; }
      const title = text.length > 60 ? text.slice(0, 57) + '…' : text;
      const i = A.addIncident(A.$('#mr-stall').value, A.$('#mr-cat').value, title, text, 'Mini app tiểu thương', mini().attach);
      mini().attach = false; A.render();
      U.toast('Đã gửi ' + i.id + '. Ban Quản lý đã tiếp nhận phản ánh của bạn.');
    },
    'mini-reg-kind': el => { mini().regForm = Object.assign(mini().regForm || {}, { kind: el.dataset.id }); A.render(); },
    'mini-reg-submit': () => {
      const t = trader(), m = mini(), form = m.regForm || { kind: 'SESSION' };
      const reasons = miniRegBusinessStateReasons(t, form);
      if (reasons.length) { U.toast(reasons[0]); return; }
      if (form.kind === 'SESSION') {
        const s = A.db.marketSessions.find(x => x.id === form.sessionId), n = Math.max(1, Number(form.stalls || 1));
        miniEnsureOpsSession(s);
        const isWaiting = miniAvailableStalls(s) < n;
        const snap = miniSnapshotAmount(n, s.marketId);
        const reg = {
          id: miniSeq('DK', A.db.sessionRegistrations), code: 'DK-' + s.code.slice(-8) + '-' + U.pad(A.db.sessionRegistrations.length + 1, 3),
          sessionId: s.id, market: s.marketId, marketId: s.marketId, traderId: t.id, merchantId: t.id,
          pointId: null, requestedSectionId: null, requestedStalls: n, businessCategory: form.cat,
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
      } else {
        const fixed = fixedMonthlyAmount(form.term || 'MONTH');
        A.db.fixedStallApplications.push({
          id: miniSeq('DQ', A.db.fixedStallApplications), marketId: ui.market, traderId: t.id,
          term: form.term === 'QUARTER' ? 'QUARTER' : 'MONTH', months: fixed.months,
          status: 'PENDING_REVIEW', amountEstimate: fixed.total, createdBy: 'Mini app tiểu thương', createdAt: U.today(),
          note: 'Mock FE: chờ BQL duyệt và lập hợp đồng/quầy thật'
        });
        U.toast('Đã gửi hồ sơ đăng ký quầy tháng/quý, chờ Ban Quản lý duyệt');
      }
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
    },
    'mini-split-open': el => {
      const t = trader(), st = A.idx.stall.get(el.dataset.id);
      if (!t || !st || st.market !== 'CL' || !miniOwnsStall(t, st)) {
        U.toast('Bạn không có quyền gửi yêu cầu cho điểm kinh doanh này.'); return;
      }
      const active = A.pointReq.activeFor(st.id);
      if (active) {
        Object.assign(mini(), { splitPoint: null, splitDraft: null, reqView: active.id });
        A.render(); U.toast('Điểm này đã có yêu cầu tách đang được xử lý.'); return;
      }
      if (!miniStructurallyActive(st)) {
        U.toast('Điểm kinh doanh này không còn đủ điều kiện gửi yêu cầu tách.'); return;
      }
      Object.assign(mini(), { splitPoint: st.id, splitDraft: { reason: '', note: '', files: [], proposedName: '' }, reqView: null });
      A.render();
    },
    'mini-split-cancel': () => { Object.assign(mini(), { splitPoint: null, splitDraft: null }); A.render(); },
    'mini-merge-open': el => {
      const t=trader(), a=A.idx.stall.get(el.dataset.id);
      if(!t||!a||!miniOwnsStall(t,a)||!miniStructurallyActive(a)||!miniMergeCandidates(t,a).length) return U.toast('Không có điểm liền kề hợp lệ thuộc quyền sử dụng của bạn.');
      Object.assign(mini(),{splitPoint:null,splitDraft:null,mergeDraft:{a:a.id,b:'',reason:'',files:[]},reqView:null}); A.render();
    },
    'mini-merge-cancel': () => { mini().mergeDraft=null; A.render(); },
    'mini-merge-file': () => { const d=mini().mergeDraft;if(d){d.files.push('tai-lieu-minh-hoa.pdf');A.render();} },
    'mini-merge-save': () => {
      const m=mini(),t=trader(),d=m.mergeDraft,a=d&&A.idx.stall.get(d.a),b=d&&A.idx.stall.get(d.b),reason=String(d&&d.reason||'').trim();
      if(!t||!d||!a||!b||!reason||!miniOwnsStall(t,a)||!miniMergeCandidates(t,a).some(x=>x.id===b.id)) return U.toast('Chọn đúng điểm liền kề và nhập lý do.');
      const id=A.pointReq.nextId(), r={id,type:'MERGE',market:'CL',source:'TRADER',sourcePointIds:[a.id,b.id],createdBy:t.id,assignedTo:null,requestedByName:t.name,requestedByTraderId:t.id,requestedAt:U.today(),reason,note:'',attachments:d.files.slice(),status:'DRAFT',plan:null,timeline:[{key:'created',at:U.dmy(U.today()),by:t.name+' (Mini app)'}],resultPointIds:[]};
      A.db.pointRequests.push(r);A.save();Object.assign(m,{mergeDraft:null,reqView:id});A.render();U.toast('Đã gửi yêu cầu '+id+'. Ban Quản lý sẽ tiếp nhận và xử lý.');
    },
    // "Đề nghị chuyển vị trí" (RELOCATE_TO_VACANT_POINT) — trader chọn CẢ source (điểm của chính
    // mình) VÀ target (điểm còn trống bất kỳ trong CL) ngay từ Mini App (khác Tách/Gộp điểm — trader
    // không tự lập phương án kỹ thuật, nhưng nghiệp vụ chuyển vị trí V1 yêu cầu trader chỉ rõ muốn
    // chuyển ĐẾN ĐÂU). Request vẫn ở DRAFT/assignedTo=null cho tới khi NV BQL "Tiếp nhận" — cùng
    // state machine SPLIT/MERGE, KHÔNG tạo cơ chế riêng.
    'mini-convert-open': el => {
      const t = trader(), st = A.idx.stall.get(el.dataset.id);
      if (!t || !st || st.market !== 'CL' || !miniOwnsStall(t, st)) { U.toast('Bạn không có quyền gửi yêu cầu cho điểm kinh doanh này.'); return; }
      if (A.pointReq.convertActiveConflict && A.pointReq.convertActiveConflict(st.id)) { U.toast('Điểm này đang có 1 yêu cầu thay đổi khác chưa hoàn tất.'); return; }
      if (!miniStructurallyActive(st)) { U.toast('Điểm kinh doanh này không còn đủ điều kiện gửi yêu cầu.'); return; }
      if (!miniConvertCandidates(t, st).length) { U.toast('Hiện không có điểm nào còn trống trong Chợ Cao Lãnh.'); return; }
      Object.assign(mini(), { splitPoint: null, splitDraft: null, mergeDraft: null, convertPoint: st.id, convertDraft: { toPointId: null, reason: '', note: '', files: [] }, reqView: null });
      A.render();
    },
    'mini-convert-cancel': () => { Object.assign(mini(), { convertPoint: null, convertDraft: null }); A.render(); },
    'mini-convert-file': () => { const d = mini().convertDraft; if (d) { d.files.push('tai-lieu-minh-hoa.pdf'); A.render(); } },
    'mini-convert-save': () => {
      const m = mini(), t = trader(), st = A.idx.stall.get(m.convertPoint), d = m.convertDraft;
      const target = d && d.toPointId ? A.idx.stall.get(d.toPointId) : null;
      const reason = String(d && d.reason || '').trim();
      if (!t || !st || !d || !target || !reason || !miniOwnsStall(t, st) || !miniConvertCandidates(t, st).some(x => x.id === target.id)) {
        U.toast('Chọn đúng điểm còn trống và nhập lý do.'); return;
      }
      const id = A.pointReq.nextId();
      const r = {
        id, type: 'CONVERT', conversionType: 'RELOCATE_TO_VACANT_POINT', market: 'CL', source: 'TRADER',
        fromPointId: st.id, toPointId: target.id,
        requestedByName: t.name, requestedByTraderId: t.id, createdBy: t.id, assignedTo: null,
        requestedAt: U.today(), reason, note: String(d.note || '').trim(), attachments: d.files.slice(),
        status: 'DRAFT', plan: null, timeline: [{ key: 'created', at: U.dmy(U.today()), by: t.name + ' (Mini app)' }],
        resultPointIds: null, postCheck: null
      };
      A.db.pointRequests.push(r);
      A.save();
      Object.assign(m, { convertPoint: null, convertDraft: null, reqView: id });
      A.render(); U.toast('Đã gửi yêu cầu ' + id + '. Ban Quản lý sẽ tiếp nhận và xử lý.');
    },
    'mini-split-file-pick': () => {
      const d = mini().splitDraft;
      if (!d) return;
      const old = A.$('#mini-split-file-input'); if (old) old.remove();
      const input = document.createElement('input');
      input.type = 'file'; input.id = 'mini-split-file-input'; input.accept = 'image/*,.pdf'; input.style.display = 'none';
      input.addEventListener('change', () => {
        if (input.files && input.files[0] && mini().splitDraft === d) { d.files.push(input.files[0].name); A.render(); }
        input.remove();
      });
      document.body.appendChild(input);
      input.click();
    },
    'mini-split-file-remove': el => {
      const d = mini().splitDraft, idx = Number(el.dataset.idx);
      if (!d || !Number.isInteger(idx) || idx < 0 || idx >= d.files.length) return;
      d.files.splice(idx, 1); A.render();
    },
    'mini-split-save': () => {
      const m = mini(), t = trader(), st = A.idx.stall.get(m.splitPoint), d = m.splitDraft;
      if (!t || !st || !d || st.market !== 'CL' || !miniOwnsStall(t, st)) {
        Object.assign(m, { splitPoint: null, splitDraft: null });
        A.render(); U.toast('Điểm kinh doanh không hợp lệ hoặc không thuộc quyền sử dụng của bạn.'); return;
      }
      const active = A.pointReq.activeFor(st.id);
      if (active) {
        Object.assign(m, { splitPoint: null, splitDraft: null, reqView: active.id });
        A.render(); U.toast('Điểm này đã có yêu cầu tách đang được xử lý.'); return;
      }
      if (!miniStructurallyActive(st)) {
        Object.assign(m, { splitPoint: null, splitDraft: null });
        A.render(); U.toast('Điểm kinh doanh này không còn đủ điều kiện gửi yêu cầu tách.'); return;
      }
      const reason = String(d.reason || '').trim(), note = String(d.note || '').trim();
      if (!reason) { U.toast('Vui lòng nhập lý do muốn tách điểm.'); return; }
      const id = A.pointReq.nextId();
      const r = {
        id, type: 'SPLIT', market: 'CL', pointId: st.id, source: 'TRADER',
        requestedByName: t.name, requestedByTraderId: t.id, createdBy: t.id, assignedTo: null,
        requestedAt: U.today(), reason, note, attachments: d.files.slice(), status: 'DRAFT', plan: null,
        proposedDirectSeller: String(d.proposedName || '').trim() ? { fullName: String(d.proposedName).trim(), status: 'PROPOSED' } : null,
        timeline: [{ key: 'created', at: U.dmy(U.today()), by: t.name + ' (Mini app)' }], resultPointIds: null
      };
      A.db.pointRequests.push(r);
      A.save();
      Object.assign(m, { splitPoint: null, splitDraft: null, reqView: id });
      A.render(); U.toast('Đã gửi yêu cầu ' + id + '. Ban Quản lý sẽ tiếp nhận và xử lý.');
    },
    'mini-req-view': el => {
      const t = trader(), r = A.pointReq.find(el.dataset.id);
      if (!t || !r || r.source !== 'TRADER' || r.requestedByTraderId !== t.id) {
        U.toast('Bạn không có quyền xem yêu cầu này.'); return;
      }
      Object.assign(mini(), { reqView: r.id, splitPoint: null, splitDraft: null }); A.render();
    },
    'mini-req-close': () => { mini().reqView = null; A.render(); },
    'mini-req-filter': el => {
      const allowed = MINI_REQ_FILTERS.some(x => x[0] === el.dataset.id);
      mini().reqFilter = allowed ? el.dataset.id : 'all'; A.render();
    }
  });
})(window.APP);
