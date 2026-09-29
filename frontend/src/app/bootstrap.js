/* Lõi prototype: trạng thái, tiện ích, định tuyến, modal, biểu đồ. */
(function (A) {
  'use strict';
  const D = A.D;
  const UIKEY = 'choso-caolanh-ui', GUIDEKEY = 'choso-caolanh-guide';
  const RBAC_SCHEMA = A.RBAC_SCHEMA;
  const ui = A.ui;
  const $ = A.$;
  const U = A.U;

  // MARKET_SELECTOR_ALL_UNIFICATION: ui.market có thể là 'ALL' (account GLOBAL). U.inM chỉ dùng ở
  // các màn 'BOTH'/'CL'/'TTD' (theo A.SCREEN_MARKET) — renderer của các màn đó KHÔNG BAO GIỜ chạy
  // khi ui.market === 'ALL' (A.render() chặn trước, xem A.marketRequiredHtml()), nên so sánh trực
  // tiếp ở đây luôn an toàn (không cần nhánh 'ALL' riêng).
  U.inM = x => x.market === ui.market;
  // Dùng riêng cho các màn cross-market (Tổng quan liên chợ, Báo cáo) — nhận thẳng 1 market cụ
  // thể HOẶC 'ALL' làm tham số, KHÔNG đọc ui.market toàn cục. 'ALL' ở đây là "Tất cả" của bộ lọc
  // NỘI BỘ màn đó (xem A.xmMarket()), không phải selectedMarket.
  U.inScope = (x, m) => m === 'ALL' || x.market === m;
  U.due = i => i.amount - i.paid;
  U.isOver = i => i.status !== 'paid' && i.due < U.today();
  U.overDays = i => Math.max(0, U.days(i.due, U.today()));
  // GOM_KHOAN_THU_THEO_TIEU_THUONG: 1 khoản phải thu có thể gồm nhiều điểm KD (stallIds). Mọi nơi cần điểm
  // của khoản phải thu đi qua 2 helper này thay vì đọc thẳng i.stallId (chỉ còn là điểm đầu tiên).
  U.invStallIds = i => !i ? [] : Array.isArray(i.stallIds) && i.stallIds.length ? i.stallIds : (i.stallId ? [i.stallId] : []);
  U.invPoints = i => U.invStallIds(i).map(id => (A.idx.stall.get(id) || {}).code || id).join(', ');
  U.invStall = i => Object.assign({}, A.idx.stall.get(U.invStallIds(i)[0]) || {}, { code: U.invPoints(i) });
  // FINANCE_MARKET_SCOPE_MIGRATION: khoản phải thu thuộc Market, không còn được chia theo
  // collectorId của Dãy/Điểm. `invParts`/`invMyPart` được giữ như adapter read-only cho
  // consumer legacy; workflow Finance mới tuyệt đối không dùng chúng để cấp quyền hay tính tiền.
  A.receivableMarket = function (i) {
    if (!i) return null;
    if (i.market) return i.market;
    const point = A.idx.stall.get(U.invStallIds(i)[0]);
    if (point && point.market) return point.market;
    const trader = A.idx.trader.get(i.traderId);
    return (trader && trader.market) || null;
  };
  A.invPartMode = () => false;
  A.invCoveredStalls = function (i) {
    const all = U.invStallIds(i);
    if (i.status === 'paid') return new Set(all);
    const s = new Set();
    A.db.payments.filter(p => p.invoiceId === i.id).forEach(p => (Array.isArray(p.stallIds) ? p.stallIds : []).forEach(id => s.add(id)));
    return s;
  };
  A.invParts = function (i) {
    if (!i) return [];
    return [{ legacy: true, stallIds: U.invStallIds(i), amount: i.amount || 0, paid: i.status === 'paid', due: U.due(i) }];
  };
  A.invMyPart = () => null;
  A.invPartLabel = () => null;
  // ---------- QUA_HAN_CHUYEN_CONG_NO (chợ receivableGrouping 'TRADER') ----------
  // P chốt 29/09/2026: quá hạn nộp mà chưa thu đủ → HỆ THỐNG tự chuyển phần còn lại của mã khoản sang Công nợ
  // (1 dòng nợ / mã khoản, mã CN-<kỳ>-<số khoản>). Từ đó KHÔNG thu theo luồng thường nữa (NV không còn nút Đã
  // thu / Thu sau; QR thường của tiểu thương cũng không nhận) — chỉ thu theo luồng thu hồi nợ (thiết kế sau).
  // Hành động tự động được ghi Nhật ký kiểm toán (người thực hiện = Hệ thống) và lưu trên bản ghi nợ.
  A.debtOf = i => (i && (A.db.debts || []).find(d => d.invoiceId === i.id && d.status !== 'CLOSED')) || null;
  A.syncDebts = function (opts) {
    const db = A.db;
    if (!db || !Array.isArray(db.invoices)) return 0;
    db.debts = Array.isArray(db.debts) ? db.debts : [];
    db.extraLog = Array.isArray(db.extraLog) ? db.extraLog : [];
    let n = 0;
    db.invoices.filter(i => A.receivableMarket(i) && i.status !== 'paid' && i.due < U.today()).sort((a, b) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id)).forEach(i => {
      if (db.debts.some(d => d.invoiceId === i.id)) return;
      const next = new Date(i.due + 'T00:00:00'); next.setDate(next.getDate() + 1);
      const at = U.dmy(next.getFullYear() + '-' + U.pad(next.getMonth() + 1) + '-' + U.pad(next.getDate())) + ' 00:05';
      const d = { id: 'CN-' + String(i.id).replace(/^PT-/, ''), invoiceId: i.id, market: A.receivableMarket(i), traderId: i.traderId, period: i.period, dueDate: i.due,
        amount: U.due(i), stallIds: U.invStallIds(i), status: 'OPEN', createdAt: at, createdBy: 'Hệ thống (tự động)' };
      db.debts.push(d); n++;
      db.extraLog.unshift({ at, who: 'Hệ thống (tự động)', what: 'Khoản ' + i.id + ' quá hạn nộp ' + U.dmy(i.due) + ' → chuyển công nợ ' + d.id + ' (' + U.money(d.amount) + ')' });
    });
    // NHAC_NO_TU_DONG (P chốt 29/09/2026): theo Cài đặt › Kỳ thu — nhắc lần 1 sau reminder1Days (3) ngày quá hạn,
    // lần 2 sau reminder2Days (7) ngày (khi bật "Tự động nhắc nợ"). Quá reminder2Days ngày → thôi nhắc, khoản nợ
    // thành KHÔNG THU HỒI, vào DANH SÁCH CẮT ĐIỆN và hệ thống gửi thông báo cắt điện → luồng kết thúc (không thu nữa).
    // Mọi bước tự động ghi Nhật ký kiểm toán + lưu trên bản ghi nợ để các vai trò liên quan xem lại được.
    const cyc = (A.SERVICE_CFG && A.SERVICE_CFG.cycle && A.SERVICE_CFG.cycle()) || {};
    const r1 = Number(cyc.reminder1Days) || 3, r2 = Math.max(r1, Number(cyc.reminder2Days) || 7), autoRemind = cyc.autoRemind !== false;
    const plus = (iso, k) => { const x = new Date(iso + 'T00:00:00'); x.setDate(x.getDate() + k); return x.getFullYear() + '-' + U.pad(x.getMonth() + 1) + '-' + U.pad(x.getDate()); };
    db.notifications = Array.isArray(db.notifications) ? db.notifications : [];
    const notify = (d, o) => db.notifications.unshift(Object.assign({ id: 'TB-' + U.pad(32 + db.notifications.length, 3), market: d.market, traderId: d.traderId, debtId: d.id, invoiceId: d.invoiceId, channels: ['Mini app', 'Zalo OA', 'SMS'], sent: 1, delivered: 1, read: 0, auto: true }, o));
    db.debts.filter(d => d.status === 'OPEN').forEach(d => {
      const days = U.days(d.dueDate, U.today()), inv = db.invoices.find(x => x.id === d.invoiceId), t = (db.traders || []).find(x => x.id === d.traderId);
      d.autoReminders = Array.isArray(d.autoReminders) ? d.autoReminders : [];
      [[1, r1], [2, r2]].forEach(([lv, k]) => {
        if (!autoRemind || days < k || d.autoReminders.some(x => x.level === lv)) return;
        const on = plus(d.dueDate, k), at = U.dmy(on) + ' 08:00';
        d.autoReminders.push({ level: lv, at, by: 'Hệ thống (tự động)' });
        if (inv) inv.reminders = (inv.reminders || 0) + 1;
        notify(d, { at: on, kind: 'DEBT_REMINDER', level: lv, title: 'Nhắc nợ lần ' + lv + ': ' + d.id + ' (khoản ' + d.invoiceId + ')', group: 'Nhắc nợ tự động · ' + (t ? t.name : d.traderId),
          body: 'Khoản ' + d.invoiceId + ' quá hạn ' + U.dmy(d.dueDate) + ', còn nợ ' + U.money(inv ? U.due(inv) : d.amount) + '. Trả tiền mặt cho NV thu phí hoặc quét QR nội dung "CHOSO ' + d.id + ' ' + d.invoiceId + '".' + (lv === 2 ? ' Quá ' + r2 + ' ngày chưa nộp sẽ bị đưa vào danh sách cắt điện.' : '') });
        db.extraLog.unshift({ at, who: 'Hệ thống (tự động)', what: 'Nhắc nợ lần ' + lv + ' ' + d.id + ' tới ' + (t ? t.name : d.traderId) });
        n++;
      });
      if (days > r2) {
        const on = plus(d.dueDate, r2 + 1), at = U.dmy(on) + ' 08:00';
        Object.assign(d, { status: 'UNRECOVERABLE', unrecoverableAt: at, powerCut: { listedAt: at, noticeSentAt: at, by: 'Hệ thống (tự động)' } });
        notify(d, { at: on, kind: 'POWER_CUT_NOTICE', title: 'Thông báo cắt điện · ' + (t ? t.name : d.traderId) + ' (nợ ' + d.id + ')', group: 'Danh sách cắt điện · ' + (t ? t.name : d.traderId),
          body: 'Khoản ' + d.invoiceId + ' quá hạn ' + days + ' ngày, còn nợ ' + U.money(inv ? U.due(inv) : d.amount) + ' — không thu hồi. Gian ' + d.stallIds.map(id => ((db.stalls || []).find(s => s.id === id) || {}).code || id).join(', ') + ' được đưa vào danh sách cắt điện.' });
        db.extraLog.unshift({ at, who: 'Hệ thống (tự động)', what: 'Nợ ' + d.id + ' quá ' + r2 + ' ngày → không thu hồi, đưa vào danh sách cắt điện, gửi thông báo cắt điện' });
        n++;
      }
    });
    if (n && A.save && !(opts && opts.save === false)) A.save(); // lúc nạp dữ liệu: không ghi (tính lại được, idempotent)
    return n;
  };
  // Tiền của các điểm (theo dòng chi tiết) trong 1 khoản. Không phải ownership collector.
  A.stallsAmount = (i, ids) => { const all = U.invStallIds(i); return U.sum(i.items.filter(x => ids.indexOf(x.stallId || all[0]) !== -1), x => x.amount); };
  // THU_HOI_NO: thu nợ = ghi vào KHOẢN THU GỐC (gian còn nợ), gắn debtId; đủ → tất toán nợ. Không thu một phần.
  A.payDebt = function (d, method, by, stallIds) {
    const inv = d && A.idx.invoice.get(d.invoiceId);
    if (!inv || d.status !== 'OPEN') return [];
    const amount = U.due(inv);
    if (amount <= 0) return [];
    const pays = A.applyPayment([inv.id], amount, method, by, { debtId: d.id });
    if (inv.status === 'paid') Object.assign(d, { status: 'CLOSED', closedAt: U.dmy(U.today()) + ' ' + U.nowTime(), closedBy: by });
    // Tiểu thương nhận biên lai (cùng số BL-…) qua Mini app / Zalo.
    A.db.notifications = A.db.notifications || [];
    pays.forEach(p => A.db.notifications.unshift({ id: 'TB-' + U.pad(32 + A.db.notifications.length, 3), at: U.today(), kind: 'DEBT_RECEIPT', market: d.market, traderId: d.traderId, debtId: d.id, invoiceId: d.invoiceId,
      title: 'Biên lai ' + p.receipt + ' · thanh toán nợ ' + d.id, group: 'Biên lai thu hồi nợ', channels: ['Mini app', 'Zalo OA'], sent: 1, delivered: 1, read: 0, auto: true,
      body: U.money(p.amount) + ' · ' + (D.METHOD[p.method] || p.method) + ' · khoản ' + d.invoiceId + (d.status === 'CLOSED' ? ' · đã tất toán nợ' : '') }));
    A.save();
    return pays;
  };
  // QR thu nợ: nội dung chứa mã nợ CN-… → tự khớp về khoản thu gốc, thu TOÀN BỘ nợ còn lại (số cố định).
  A.payDebtByQr = function (debtId, by) { const d = (A.db.debts || []).find(x => x.id === debtId); return A.payDebt(d, 'qr', by || 'Mini app'); };
  U.invTag = i => (i && A.debtOf && A.debtOf(i) && `<span class="tag danger">Quá hạn · đã chuyển công nợ</span>`) || (i && i.status === 'paid' && (A.db.debts || []).some(d => d.invoiceId === i.id) && '<span class="tag ok">Đã thu hồi nợ</span>') || (i.status === 'paid' ? '<span class="tag ok">Đã thu</span>'
    : i.status === 'partial' ? '<span class="tag warn">Thu một phần</span>'
      : U.isOver(i) ? `<span class="tag danger">Quá hạn ${U.overDays(i)} ngày</span>` : '<span class="tag">Chưa đến hạn</span>');
  U.traderDebt = id => U.sum(A.db.invoices.filter(i => i.traderId === id && i.status !== 'paid'), U.due);
  U.traderOverdue = id => U.sum(A.db.invoices.filter(i => i.traderId === id && U.isOver(i)), U.due);
  A.canDirectCollect = function (targetMarket) {
    return targetMarket === 'TTD' && ui.market === 'TTD' && U.can('thu-tien') && A.canDo('thu-tien.thu', targetMarket);
  };
  A.canCollectReceivable = function (targetMarket) {
    const account = A.currentAccount();
    return !!(targetMarket && targetMarket === ui.market && account
      && A.allowedMarkets(account).indexOf(targetMarket) !== -1
      && U.can('thu-tien') && A.canDo('thu-tien.thu', targetMarket));
  };

  // v16: A.refreshStall đã bỏ — "Nợ phí" không còn ghi vào stall.status mà suy ra từ khoản phải thu
  // (features/business-points/service.js: debtStatus/displayStatus).

  // ---------- RBAC V1 — Account Demo đang dùng ----------
  // Nguồn xác thực runtime: currentDemoAccountId → account → account.status → account.roleIds.
  // A.currentAccount() luôn trả về 1 account ACTIVE hợp lệ, tự "heal" nếu id đang lưu không tồn
  // tại hoặc trỏ tới account đã bị khoá (status !== 'active') — không bao giờ để phiên demo chạy
  // với 1 account rỗng/không hợp lệ.
  A.currentAccount = function () {
    let acc = ui.currentDemoAccountId ? A.ACCOUNTS.get(ui.currentDemoAccountId) : null;
    if (!acc || acc.status !== 'active') {
      acc = A.ACCOUNTS.list().find(a => a.status === 'active') || null;
      ui.currentDemoAccountId = acc ? acc.id : null;
    }
    return acc;
  };
  // Market Scope: Account.marketScopes là nguồn enforce chính (KHÔNG dùng Role.scope). 'ALL' trong
  // marketScopes (dữ liệu mock hợp lệ, xem accounts.js — dùng cho account GLOBAL: system_admin/
  // ward_leader) = "toàn hệ thống", giải nén thành ĐÚNG danh sách id hiện có trong D.MARKETS (market
  // master 12 chợ, data.js) ở đây — nơi DUY NHẤT hiểu 'ALL' theo nghĩa này. Nơi khác trong app
  // không được tự ý coi 'ALL' là 1 market cụ thể. RBAC_MARKET_SCOPE_MIGRATION: KHÔNG còn hard-code
  // ['CL','TTD'] — market hợp lệ tra theo D.MARKETS động, để account MARKET scoped tới bất kỳ chợ
  // nào trong 12 chợ đều được nhận diện đúng, không chỉ 2 chợ demo gốc.
  // Danh sách chợ hợp lệ = A.effectiveMarkets() (D.MARKETS + chợ custom trong Danh mục chợ, xem
  // features/markets/store.js); trước khi store đó nạp thì chỉ có D.MARKETS. Tạo chợ custom KHÔNG cấp
  // scope cho ai: 'ALL' tự bao gồm chợ mới, account giới hạn chỉ thấy khi có đúng id trong marketScopes.
  A.allowedMarkets = function (account) {
    const scopes = (account && account.marketScopes) || [];
    const markets = typeof A.effectiveMarkets === 'function' ? A.effectiveMarkets() : D.MARKETS;
    if (scopes.indexOf('ALL') !== -1) return markets.map(m => m.id);
    const validIds = new Set(markets.map(m => m.id));
    return scopes.filter(m => validIds.has(m));
  };
  // Market applicability theo RBAC_V1_SPEC.md mục 6 — nguồn cấu hình TẬP TRUNG duy nhất, tránh
  // rải if(screen===...)/if(market===...) ở từng view:
  //   'CROSS'  = màn liên chợ (Tổng quan, Danh mục chợ, Báo cáo) — không bị chặn bởi selectedMarket,
  //              đọc thẳng A.xmMarket() (= ui.market) làm phạm vi lọc nội bộ; selectedMarket='ALL'
  //              (account GLOBAL) là điều kiện bình thường ở đúng các màn này.
  //   'BOTH'   = MARKET VIEW áp dụng cho TẤT CẢ chợ trong phạm vi account (không giới hạn CL/TTD —
  //              đã mở rộng cho 12 chợ), theo đúng selectedMarket cụ thể hiện tại. Khi selectedMarket
  //              ='ALL' (account GLOBAL), màn vẫn "truy cập được" (menu/route không chặn — xem
  //              A.screenMarketOk()) nhưng A.render() hiện thông báo yêu cầu chọn 1 chợ cụ thể thay
  //              vì gọi renderer thật (A.marketRequiredHtml() — MARKET_SELECTOR_ALL_UNIFICATION).
  //   'CL'/'TTD' = chỉ áp dụng đúng 1 chợ cụ thể (nghiệp vụ đặc thù của riêng chợ đó trong prototype
  //              — Tài sản chợ mới demo cho Chợ Cao Lãnh, Phiên chợ quê là đặc thù Chợ quê Tân Thuận
  //              Đông — KHÔNG phải "giả định 2 chợ" cần tổng quát hoá, giữ nguyên). Cùng quy tắc
  //              'ALL' như 'BOTH' ở trên.
  //   'SYSTEM' = không gate theo market (Tài khoản, Cài đặt = hệ thống).
  A.SCREEN_MARKET = {
    'tong-quan': 'CROSS', 'bao-cao': 'CROSS', 'danh-muc-cho': 'CROSS',
    'mat-bang': 'BOTH', 'tai-san': 'CL', 'diem-kd': 'BOTH', 'tieu-thuong': 'BOTH', 'hop-dong': 'BOTH',
    'cau-hinh-gia': 'BOTH',
    'phai-thu': 'BOTH', 'thu-tien': 'BOTH', 'doi-soat': 'BOTH', 'theo-doi-ky-doi-soat': 'CROSS', 'cong-no': 'BOTH',
    'su-co': 'BOTH', 'thong-bao': 'BOTH',
    'phien-cho': 'TTD',
    'dien-nuoc': 'BOTH',
    'tai-khoan': 'SYSTEM', 'cai-dat': 'SYSTEM', 'mini-app': 'BOTH'
  };
  // screenId có hợp lệ với market scope của account + selectedMarket hiện tại không. Đây là điểm
  // kiểm tra DUY NHẤT cho cả 2 vế "accountHasRequiredMarketScope" và "screenApplicableToMarket"
  // của công thức CAN_VIEW_SCREEN (RBAC_V1_SPEC.md mục 7).
  // MARKET_SELECTOR_ALL_UNIFICATION: khi ui.market === 'ALL' (chỉ đạt được nếu account đang dùng có
  // scopeType GLOBAL — A.syncAccountContext() đảm bảo bất biến này), màn 'BOTH'/'CL'/'TTD' vẫn coi là
  // "truy cập được" (không biến mất khỏi menu, route không bị bật lại về màn khác) — nhưng renderer
  // thật của màn đó KHÔNG được gọi với ui.market='ALL' (xem A.render()/A.marketRequiredHtml()), tự
  // hiện thông báo "chọn 1 chợ cụ thể" thay vì render sai dữ liệu hoặc crash.
  A.screenMarketOk = function (screenId, account) {
    const kind = A.SCREEN_MARKET[screenId];
    if (!kind || kind === 'CROSS' || kind === 'SYSTEM') return true;
    if (ui.market === 'ALL') return true;
    if (A.allowedMarkets(account).indexOf(ui.market) === -1) return false; // ngoài phạm vi account
    if (kind === 'BOTH') return true;
    return kind === ui.market; // 'CL' hoặc 'TTD' cụ thể
  };
  // "Tất cả" của các màn cross-market (Tổng quan liên chợ, Báo cáo, Danh mục chợ) giờ ĐỌC THẲNG
  // selectedMarket (ui.market) — không còn ui.xmScope/A.xmScopeBar() riêng (đã bỏ, gộp về đúng 1
  // state/1 cơ chế, xem A.marketSelectOptionsHtml() bên dưới). A.syncAccountContext() đảm bảo
  // ui.market luôn hợp lệ (1 chợ cụ thể trong A.allowedMarkets(account), hoặc 'ALL' chỉ khi account
  // GLOBAL) trước khi bất kỳ renderer nào chạy, nên ở đây chỉ cần trả nguyên giá trị.
  A.xmMarket = function () { return ui.market; };
  // Sinh HTML <option> cho dropdown chọn chợ (value=ui.market hiện tại được đánh dấu selected) —
  // "Tất cả" (value='ALL') chỉ có khi account đang dùng scopeType GLOBAL. Dùng chung cho dropdown
  // "Chợ" trên topbar (mọi màn 'BOTH'/'CL'/'TTD') VÀ dropdown "Phạm vi xem" vẽ riêng trong nội dung
  // "Tổng quan liên chợ" (xem js/v-dieuhanh.js) — ĐÚNG 1 nguồn logic option, tránh viết lại 2 lần
  // rồi lệch nhau; cả 2 nơi cùng dùng data-ch="market-select" → A.CH['market-select'] → A.ACT.market
  // (cùng 1 state/1 handler, không phải 2 selector độc lập).
  A.marketSelectOptionsHtml = function () {
    const accNow = A.currentAccount();
    const isGlobal = A.ACCOUNTS.scopeType(accNow) === 'GLOBAL';
    const opts = (isGlobal ? [['ALL', 'Tất cả']] : []).concat(A.allowedMarkets(accNow).map(id => [id, U.mShort(id)]));
    if (!opts.length) return '<option value="" selected>Chưa được phân công chợ</option>';
    return opts.map(o => `<option value="${o[0]}" ${ui.market === o[0] ? 'selected' : ''}>${U.esc(o[1])}</option>`).join('');
  };
  // ui.role KHÔNG còn được set trực tiếp qua hành động chọn role, và ui.market luôn phải là 1 chợ
  // hợp lệ trong A.allowedMarkets(account) HOẶC 'ALL' (chỉ khi account đang dùng có scopeType GLOBAL
  // — A.ACCOUNTS.scopeType()) — cả 2 luôn được suy ra/kẹp lại từ account đang dùng ở đây. Gọi mỗi khi
  // currentDemoAccountId đổi, và phòng thủ thêm ở đầu chrome()/A.route() để bắt cả trường hợp account
  // (hoặc marketScopes của nó) bị khoá/đổi giữa phiên.
  // MARKET_SELECTOR_ALL_UNIFICATION mục 8 test H: đổi từ account GLOBAL đang ở 'ALL' sang account
  // MARKET-scoped (Trưởng BQL/NV thu phí/NV kỹ thuật) phải tự kẹp ui.market về 1 chợ cụ thể — KHÔNG
  // được giữ 'ALL' trái phép. Ngược lại, nếu ui.market đã là 1 chợ cụ thể hợp lệ và account mới là
  // GLOBAL, GIỮ NGUYÊN chợ đang chọn (không tự nhảy sang 'ALL') — chỉ người dùng bấm dropdown mới đổi.
  A.syncAccountContext = function () {
    const acc = A.currentAccount();
    ui.role = acc ? A.ACCOUNTS.primaryRole(acc) : null;
    const allowed = A.allowedMarkets(acc);
    const isGlobal = acc && A.ACCOUNTS.scopeType(acc) === 'GLOBAL';
    if (!allowed.length && !isGlobal) {
      // An active collector may legitimately lose its final market during a
      // transfer. Never fall back to CL (or any other unauthorized market).
      ui.market = '';
    } else if (ui.market === 'ALL') {
      if (!isGlobal) ui.market = allowed[0]; // clamp: ALL không hợp lệ với account MARKET-scoped
    } else if (allowed.length) {
      if (allowed.indexOf(ui.market) === -1) ui.market = isGlobal ? 'ALL' : allowed[0];
    }
    return { role: ui.role, market: ui.market };
  };

  A.saveUi = function () { try { localStorage.setItem(UIKEY, JSON.stringify({ schemaVersion: RBAC_SCHEMA, currentDemoAccountId: ui.currentDemoAccountId, market: ui.market })); } catch (e) { /* bỏ qua */ } };
  // TRADER_PROFILE_AND_MINIAPP_WORKFLOW — demo case "hồ sơ đã có sẵn + Mini App ĐÃ LIÊN KẾT" (mục
  // 37 Case 1): account.traderId không thể seed cứng trong js/accounts.js (module đó chạy TRƯỚC
  // khi A.db tồn tại — data.js chỉ build() khi A.load()/A.fresh() được gọi ở init()) và tên 2
  // account demo cũ (AC-TT01/02) không khớp bất kỳ trader nào (dữ liệu trader sinh ngẫu nhiên có
  // seed riêng). Chạy ĐÚNG 1 lần, chỉ khi CHƯA account trader nào có traderId (idempotent — an toàn
  // gọi lại mỗi lần load): liên kết AC-TT01 với ĐÚNG trader đang thuê KA-A01 thật (deterministic vì
  // seed RNG trong data.js cố định) — đồng bộ luôn fullName/phone hiển thị của account demo cho
  // khớp, tránh gây hiểu lầm "AC-TT01 tên khác nhưng lại đại diện cho 1 trader tên khác".
  A.ensureMiniAppDemoLink = function () {
    if (!A.ACCOUNTS || !A.db) return;
    const acc = A.ACCOUNTS.get('AC-TT01');
    const kaA01 = A.db.stalls && A.db.stalls.find(s => s.id === 'CL-KA-A01');
    const trader = kaA01 && A.db.traders.find(t => t.id === kaA01.traderId);
    if (acc && trader && !acc.traderId) {
      A.ACCOUNTS.update(acc.id, { traderId: trader.id, fullName: trader.name, phone: trader.phone });
    }
  };
  A.load = function () {
    A.data.loadDb();
    A.ensureMiniAppDemoLink();
    // RBAC V1 migration: ui state cũ (schema khác, hoặc còn giữ shape {role, market} kiểu cũ
    // không có currentDemoAccountId) không tương thích — bỏ qua, để currentDemoAccountId=null rồi
    // A.currentAccount()/A.syncAccountContext() bên dưới tự chọn 1 account ACTIVE + 1 market hợp
    // lệ mặc định. Nhờ vậy không bao giờ còn sót ui.role='bql'/'lanhdao'/'tieuthuong' hay
    // ui.market='ALL' hay market không thuộc scope của account.
    try {
      const u = JSON.parse(localStorage.getItem(UIKEY) || 'null');
      if (u && u.schemaVersion === RBAC_SCHEMA && u.currentDemoAccountId) {
        ui.currentDemoAccountId = u.currentDemoAccountId;
        if (u.market) ui.market = u.market;
      }
    } catch (e) { /* bỏ qua */ }
    // syncAccountContext() kẹp ui.market vào đúng A.allowedMarkets(account) — xử lý luôn cả 3 case
    // của mục 12: market='ALL' (đã hết hạn), market không tồn tại, hoặc market hợp lệ nhưng không
    // thuộc scope account đang dùng (ví dụ localStorage ghi bởi 1 account khác trước đó).
    A.syncAccountContext();
  };

  // Ghi nhận thanh toán cho danh sách khoản phải thu (trả khoản cũ trước).
  // `by` là actor lịch sử đã thực hiện giao dịch; không được thay bằng NV đang phụ trách Market sau này.
  A.applyPayment = function (invoiceIds, amount, method, by, opts) {
    const db = A.db;
    let remain = amount;
    const out = [];
    const invs = invoiceIds.map(id => A.idx.invoice.get(id)).filter(Boolean).sort((a, b) => a.due.localeCompare(b.due));
    const time = U.nowTime();
    invs.forEach(inv => {
      if (remain <= 0) return;
      const take = Math.min(U.due(inv), remain);
      if (take <= 0) return;
      inv.paid += take;
      inv.status = inv.paid >= inv.amount ? 'paid' : 'partial';
      remain -= take;
      const n = db.payments.reduce((m, x) => Math.max(m, Number(String(x.id).replace(/\D/g, '')) || 0), 0) + 1;
      const receipt = 'BL2609-' + U.pad(n, 6);
      const p = {
        id: 'GD' + U.pad(n, 6), invoiceId: inv.id, market: A.receivableMarket(inv), traderId: inv.traderId, amount: take, method,
        date: db.today, time, by, receipt,
        paymentStatus: 'SUCCESS', paidAt: db.today + ' ' + time, receiptIssuedAt: db.today + ' ' + time,
        lookup: Math.random().toString(36).slice(2, 8).toUpperCase(), reconciled: method === 'tm' ? null : true,
        receiptDelivery: { miniApp: true, sentAt: db.today + ' ' + time, status: 'SENT_MOCK' },
        printStatus: 'PENDING'
      };
      if (opts && opts.debtId) p.debtId = opts.debtId; // THU_HOI_NO: giao dịch thu nợ vẫn ghi vào khoản thu gốc
      db.payments.push(p);
      out.push(p);
      if (method !== 'tm') {
        const bk = {
          id: 'SK' + U.pad(db.bank.length + 1, 4), date: db.today, time, amount: take, ref: 'CHOSO ' + (opts && opts.debtId ? opts.debtId + ' ' : '') + inv.id,
          market: A.receivableMarket(inv), bankName: (D.BANK_BY_MARKET && D.BANK_BY_MARKET[A.receivableMarket(inv)]) || 'Vietcombank',
          paymentId: p.id, receivableId: inv.id, receiptId: p.receipt,
          status: 'MATCHED_AUTO', matched: true, matchedBy: null, matchedAt: null, matchMethod: 'AUTO',
          log: [{ at: time, actor: 'Hệ thống', text: 'Nhận sao kê tương ứng thanh toán ' + p.id }, { at: time, actor: 'Hệ thống', text: 'Khớp tự động với khoản phải thu ' + inv.id }]
        };
        db.bank.push(bk);
      }
    });
    A.save();
    return out;
  };

  function receiptSessionPayment(p) {
    return p && p.sessionPaymentId && A.db.sessionPayments ? A.db.sessionPayments.find(x => x.id === p.sessionPaymentId) : null;
  }
  function receiptSessionRecord(p) {
    return p && A.db.sessionReceipts ? A.db.sessionReceipts.find(x => x.paymentId === p.id || x.receiptNumber === p.receipt) : null;
  }
  function receiptPaymentSuccessAt(p) {
    if (!p) return null;
    const sp = receiptSessionPayment(p);
    if (sp) {
      if (sp.status !== 'SUCCESS' && sp.status !== 'RECONCILED') return null;
      return sp.collectedAt || sp.paidAt || sp.reconciledAt || (p.date && p.time ? p.date + ' ' + p.time : null);
    }
    if (p.paymentStatus && p.paymentStatus !== 'SUCCESS') return null;
    return p.paidAt || (p.date && p.time ? p.date + ' ' + p.time : null);
  }
  function receiptIssuedAt(p) {
    if (!p) return null;
    const rc = receiptSessionRecord(p);
    return (rc && rc.issuedAt) || p.receiptIssuedAt || (p.date && p.time ? p.date + ' ' + p.time : null);
  }
  A.receiptBusinessStateOk = function (p) {
    const paidAt = receiptPaymentSuccessAt(p), issuedAt = receiptIssuedAt(p);
    return !!(p && p.receipt && paidAt && issuedAt && issuedAt >= paidAt);
  };
  A.paymentActorLabel = function (p) {
    const actor = p && (p.collectedBy || p.by || p.createdBy);
    if (!actor) return '—';
    if (actor === 'Hệ thống' || actor === 'Mini app') return actor + ' (tự động)';
    const account = A.ACCOUNTS && A.ACCOUNTS.list && A.ACCOUNTS.list().find(a => a.id === actor || a.code === actor);
    return account ? account.fullName : U.staffName(actor);
  };
  A.receiptHtml = function (pays) {
    pays = (pays || []).filter(A.receiptBusinessStateOk);
    if (!pays.length) return '<div class="note danger">Bien lai khong hop le: chi phat hanh sau khi thanh toan thanh cong.</div>';
    const p0 = pays[0], t = A.idx.trader.get(p0.traderId), m = U.market(p0.market);
    const rows = pays.map(p => {
      const inv = A.idx.invoice.get(p.invoiceId);
      const s = p.sessionId && A.db.marketSessions ? A.db.marketSessions.find(x => x.id === p.sessionId) : null;
      const reg = p.registrationId && A.db.sessionRegistrations ? A.db.sessionRegistrations.find(x => x.id === p.registrationId) : null;
      const content = inv
        ? `${inv.id}${p.debtId ? ' · Thu hồi nợ ' + p.debtId : ''} · Kỳ ${U.per(inv.period)} · ${Array.isArray(p.stallIds) && p.stallIds.length ? p.stallIds.map(id => (A.idx.stall.get(id) || {}).code || id).join(', ') : U.invPoints(inv)}`
        : `Phiên chợ quê · ${s ? U.dmy(s.sessionDate) : U.esc(p.sessionId || '')}${reg ? ' · ' + U.esc(reg.code || reg.id) : ''}`;
      return `<tr><td>${p.receipt}</td><td>${content}</td><td class="num">${U.money(p.amount)}</td></tr>`;
    });
    return `<div class="receipt"><h4>BIÊN LAI THU TIỀN ĐIỆN TỬ</h4><div class="sub">Ban Quản lý ${m.name} · UBND phường Cao Lãnh</div>
      <div class="row" style="align-items:flex-start;gap:16px"><dl class="kv" style="flex:1">
        <dt>Người nộp</dt><dd>${U.esc(t.name)} (${t.id})</dd>
        <dt>Hình thức</dt><dd>${D.METHOD[p0.method]}</dd>
        <dt>Thời gian</dt><dd>${U.dmy(p0.date)} ${p0.time}</dd>
        <dt>Người thu</dt><dd>${U.esc(A.paymentActorLabel(p0))}</dd>
        <dt>Mã tra cứu</dt><dd><b>${p0.lookup}</b></dd>
        <dt>Gửi Mini app</dt><dd><span class="tag ok">Đã gửi</span></dd></dl>
        <div class="note info" style="max-width:220px">Biên lai dùng để rà soát dữ liệu, truy vết giao dịch và kiểm soát thu theo từng phương thức.</div></div>
      <div class="divider"></div>
      ${U.table([{ t: 'Số biên lai' }, { t: 'Nội dung' }, { t: 'Số tiền', num: true }], rows)}
      <div class="total" style="margin-top:10px">${U.money(U.sum(pays, p => p.amount))}</div>
      <div class="small muted" style="margin-top:8px">✓ Đã gửi biên lai tới tiểu thương qua Mini app và Zalo OA (mô phỏng)</div></div>`;
  };
  A.showReceipt = function (pays, opts) {
    pays = (pays || []).filter(A.receiptBusinessStateOk);
    if (!pays.length) { U.toast('Khong the lap/xem bien lai truoc khi thanh toan thanh cong'); return; }
    A.modal(A.mHead('Biên lai điện tử') + `<div class="modal-b">${A.receiptHtml(pays)}</div>
      <div class="modal-f"><button class="btn" data-act="print">In biên lai</button><button class="btn primary" data-act="close">Xong</button></div>`);
    if (opts && opts.autoPrint) {
      pays.forEach(p => { p.printStatus = 'PRINTED_MOCK'; });
      A.save();
      setTimeout(() => window.print(), 0);
    }
  };

  // ---------- menu & định tuyến ----------
  // Ghi chú: từ Giai đoạn 2, quyền truy cập từng mục KHÔNG còn khai báo cứng ở đây nữa —
  // xem A.PERM (js/permissions.js). Danh sách vai trò cũng lấy động từ A.PERM.activeRoles().
  A.MENU = [
    { group: 'Điều hành', items: [
      { id: 'tong-quan', ico: U.icon('dashboard'), label: 'Tổng quan liên chợ' },
      // "Danh mục chợ" = quản lý thông tin CẤP CHỢ (tên, mã, địa điểm, hạng, BQL, bảng giá, trạng
      // thái) — KHÁC "Mặt bằng chợ" bên dưới (cấu trúc Khu/Tầng/Dãy/Điểm kinh doanh BÊN TRONG 1 chợ,
      // GIỮ NGUYÊN không đổi). Xem js/marketcatalog.js + js/v-danhmuccho.js.
      { id: 'danh-muc-cho', ico: U.icon('store'), label: 'Danh mục chợ' },
      { sub: 'Hạ tầng chợ' },
      // Phase 7: UI "Thiết lập mặt bằng chợ" + "Sơ đồ mặt bằng" đã gộp thành 1 workspace "Mặt bằng
      // chợ" (MARKET_LAYOUT_UX_HOTFIX_REPORT.md) và nay RBAC cũng chuẩn hóa theo — 2 screen
      // permission cũ 'so-do'/'cau-truc' gộp thành DUY NHẤT 'mat-bang', route chính #/mat-bang.
      // Hash cũ #/so-do, #/cau-truc vẫn redirect an toàn về #/mat-bang (xem A.route()). Xem
      // MARKET_LAYOUT_SCREEN_PERMISSION_AUDIT.md + MARKET_LAYOUT_SCREEN_PERMISSION_IMPLEMENTATION_REPORT.md.
      { id: 'mat-bang', ico: U.icon('map'), label: 'Mặt bằng chợ' },
      { id: 'tai-san', ico: U.icon('settings'), label: 'Tài sản chợ' },
      { id: 'diem-kd', ico: U.icon('store'), label: 'Điểm kinh doanh', hidden: true },
      { id: 'phien-cho', ico: U.icon('store'), label: 'Phiên chợ quê' }
    ] },
    { group: 'Tiểu thương & hợp đồng', items: [
      { id: 'tieu-thuong', ico: U.icon('users'), label: 'Hồ sơ tiểu thương' },
      { id: 'hop-dong', ico: U.icon('file'), label: 'Hợp đồng', badge: () => A.db.contracts.filter(c => U.inM(c) && c.status === 'hieuluc' && U.days(U.today(), c.end) <= 30).length }
    ] },
    { group: 'Tài chính', items: [
      { sub: 'Quản lý khai báo' },
      { id: 'cau-hinh-gia', ico: U.icon('money'), label: 'Chính sách thu và biểu phí' },
      { id: 'tai-khoan-ngan-hang', ico: U.icon('bank'), label: 'Danh sách tài khoản ngân hàng' },
      { sub: 'Nghiệp vụ tài chính' },
      { id: 'dien-nuoc', ico: U.icon('bolt'), label: 'Chỉ số điện, nước' },
      { id: 'phai-thu', ico: U.icon('receipt'), label: 'Khoản phải thu' },
      { id: 'thu-tien', ico: U.icon('card'), label: 'Thu tiền & biên lai' },
      { id: 'doi-soat', ico: U.icon('refresh'), label: 'Đối soát buổi thu', badge: () => (A.db.cashHandovers || []).filter(h => h.market === ui.market && ['SUBMITTED', 'WAITING_EXPLANATION'].includes(h.status)).length },
      { id: 'theo-doi-ky-doi-soat', ico: U.icon('calendar'), label: 'Theo dõi kỳ đối soát' },
      { id: 'cong-no', ico: '⏰', label: 'Công nợ & nhắc nợ' }
    ] },
    { group: 'Vận hành', items: [
      { id: 'su-co', ico: U.icon('warning'), label: 'Phản ánh & sự cố', badge: () => suCoMenuBadge() },
      { id: 'thong-bao', ico: U.icon('bell'), label: 'Thông báo đa kênh' },
      { id: 'bao-cao', ico: U.icon('chart'), label: 'Báo cáo thống kê' },
      { id: 'tai-khoan', ico: U.icon('users'), label: 'Tài khoản người dùng' },
      { id: 'cai-dat', ico: U.icon('settings'), label: 'Cài đặt & phân quyền' }
    ] },
    { group: 'Dành cho tiểu thương', items: [
      { id: 'mini-app', ico: U.icon('warning'), label: 'Cổng tiểu thương' }
    ] }
  ];
  A.menuItem = id => { for (const g of A.MENU) for (const it of g.items) if (it.id === id) return it; return null; };
  function suCoTechMenuContext() {
    return A.canDo('su-co.cap-nhat-xu-ly', ui.market) && !A.canDo('su-co.phan-cong', ui.market);
  }
  function suCoMenuLabel() {
    return suCoTechMenuContext() ? 'Công việc kỹ thuật' : 'Phản ánh & sự cố';
  }
  function suCoMenuBadge() {
    if (suCoTechMenuContext()) {
      const acc = A.currentAccount && A.currentAccount();
      const code = acc && acc.code;
      return code ? A.db.incidents.filter(i => U.inM(i) && i.assignee === code && (i.state === 'phancong' || i.state === 'dangxuly')).length : 0;
    }
    return A.db.incidents.filter(i => U.inM(i) && i.state === 'tiepnhan').length;
  }
  function suCoTechMenuItemsHtml() {
    const acc = A.currentAccount && A.currentAccount();
    const code = acc && acc.code;
    const rows = code ? A.db.incidents.filter(i => U.inM(i) && i.assignee === code) : [];
    const items = [
      { tab: 'assigned', icon: 'bell', label: 'Việc mới', count: rows.filter(i => i.state === 'phancong').length },
      { tab: 'doing', icon: 'settings', label: 'Đang xử lý', count: rows.filter(i => i.state === 'dangxuly').length },
      { tab: 'done', icon: 'check', label: 'Kết quả đã gửi', count: rows.filter(i => ['hoanthanh', 'dong'].indexOf(i.state) !== -1).length },
      { tab: 'all', icon: 'file', label: 'Tất cả công việc', count: rows.length }
    ];
    const active = ui.incFlowTab || 'assigned';
    return `<div class="tech-work-nav">${items.map(it => `<a href="#/su-co" class="${A.current === 'su-co' && active === it.tab ? 'active' : ''}" data-act="su-co-tech-menu" data-tab="${it.tab}"><span class="ico">${U.icon(it.icon)}</span><span class="nav-label">${it.label}</span>${it.count ? `<span class="badge">${it.count}</span>` : ''}</a>`).join('')}</div>`;
  }

  // Nhãn rút gọn cho thanh "Tài khoản demo" (mục 14 yêu cầu — biết ngay account thuộc role nào mà
  // không làm thanh quá dài với tới 12 chợ × nhiều role). Role tuỳ biến/không có trong map vẫn hiển
  // thị đúng tên đầy đủ (fallback ở chrome() bên dưới), không crash nếu admin đổi tên 1 trong 6 role
  // gốc hoặc tạo role mới.
  const DEMO_ROLE_SHORT = {
    system_admin: 'QTHT', ward_leader: 'Lãnh đạo', market_manager: 'Trưởng BQL',
    collector: 'Thu phí', market_accountant: 'Kế toán', technician: 'Kỹ thuật', central_accountant: 'KT Trung tâm',
    trader: 'Tiểu thương'
  };
  // DEMO_ACCOUNT_BAR_COMPACT_GROUPING (mục 4/5/6/10 yêu cầu): với 12 chợ, liệt kê phẳng mọi account
  // hợp lệ (bản cũ) làm thanh dài hàng chục nút khi selectedMarket='ALL'. Nhóm lại theo 2 tầng, vẫn
  // ĐÚNG 1 nguồn dữ liệu (A.ACCOUNTS.list()) và ĐÚNG 1 tiêu chí lọc (marketScopes qua
  // A.allowedMarkets(), KHÔNG hardcode theo tên/id):
  //   - "Tài khoản toàn hệ thống" (scopeType GLOBAL — system_admin/ward_leader): LUÔN hiện, mọi
  //     selectedMarket, để luôn có đường quay lại account GLOBAL (mục 6).
  //   - selectedMarket='ALL': CHỈ hiện nhóm GLOBAL ở trên + 1 dòng gợi ý — KHÔNG bung account của cả
  //     12 chợ (mục 4).
  //   - selectedMarket=1 chợ cụ thể: thêm các nhóm MARKET-scoped account CÓ chợ đó trong marketScopes,
  //     xếp theo role (mục 5) — account KHÔNG thuộc chợ đang chọn không xuất hiện.
  const DEMO_MARKET_ROLE_ORDER = ['market_manager', 'collector', 'market_accountant', 'technician', 'central_accountant', 'trader'];
  function demoAccountBtnHtml(a, withRolePrefix) {
    const roleTxt = withRolePrefix ? (DEMO_ROLE_SHORT[A.ACCOUNTS.primaryRole(a)] || (A.PERM.role(A.ACCOUNTS.primaryRole(a)) || {}).name || '') : '';
    return `<button class="${ui.currentDemoAccountId === a.id ? 'on' : ''}" data-act="demo-account" data-id="${a.id}">${roleTxt ? U.esc(roleTxt) + ' — ' : ''}${U.esc(a.fullName)}</button>`;
  }
  function demoAccountBarHtml() {
    const active = A.ACCOUNTS.list().filter(a => a.status === 'active');
    const globals = active.filter(a => A.ACCOUNTS.scopeType(a) === 'GLOBAL');
    const globalGroup = globals.length ? `<span class="label-sm">Tài khoản toàn hệ thống</span><span class="seg">${globals.map(a => demoAccountBtnHtml(a, true)).join('')}</span>` : '';
    if (ui.market === 'ALL') {
      return globalGroup + '<span class="small muted">Chọn một chợ cụ thể để xem tài khoản demo thuộc chợ đó.</span>';
    }
    const marketAccounts = active.filter(a => A.ACCOUNTS.scopeType(a) !== 'GLOBAL' && A.allowedMarkets(a).indexOf(ui.market) !== -1);
    const roleGroups = DEMO_MARKET_ROLE_ORDER.map(rid => {
      const list = marketAccounts.filter(a => A.ACCOUNTS.primaryRole(a) === rid);
      if (!list.length) return '';
      const r = A.PERM.role(rid);
      return `<span class="label-sm">${U.esc(DEMO_ROLE_SHORT[rid] || (r ? r.name : rid))}</span><span class="seg">${list.map(a => demoAccountBtnHtml(a, false)).join('')}</span>`;
    }).join('');
    // Phòng thủ: account MARKET với role tuỳ biến (admin thêm role thứ 7+ ngoài 4 role gốc ở trên,
    // xem js/permissions.js) vẫn phải hiện, không âm thầm biến mất khỏi thanh demo.
    const known = new Set(DEMO_MARKET_ROLE_ORDER);
    const others = marketAccounts.filter(a => !known.has(A.ACCOUNTS.primaryRole(a)));
    const otherGroup = others.length ? `<span class="label-sm">Khác</span><span class="seg">${others.map(a => demoAccountBtnHtml(a, true)).join('')}</span>` : '';
    return globalGroup + roleGroups + otherGroup;
  }

  function chrome() {
    // Phòng thủ: nếu account đang dùng vừa bị khoá/xoá giữa phiên, hoặc marketScopes của nó
    // không còn chứa selectedMarket đang lưu, tự "heal" role + market về đúng account trước khi
    // render menu/route — mỗi lần render đều chạy qua đây.
    A.syncAccountContext();
    $('#nav').innerHTML = A.MENU.map(g => {
      // "sub" là nhãn phụ nhóm menu con (không phải màn hình), chỉ để hiển thị — không qua U.can.
      // `hidden` (không còn mục nào dùng sau Phase 7 — trước đó 'cau-truc' từng đánh dấu hidden để
      // gộp UI với 'so-do', nay cả 2 đã hợp nhất thành đúng 1 entry 'mat-bang'): vẫn giữ lại cơ chế
      // lọc này (loại khỏi DANH SÁCH LINK hiển thị nhưng KHÔNG ảnh hưởng U.can()/A.menuItem()/route
      // trực tiếp qua hash) phòng khi cần dùng lại cho 1 màn khác sau này.
      const raw = g.items.filter(it => it.sub || (U.can(it.id) && !it.hidden));
      const items = raw.filter((it, i) => !it.sub || raw.slice(i + 1).some(x => !x.sub));
      if (!items.some(it => !it.sub)) return '';
      return `<div class="nav-group">${g.group}</div>` + items.map(it => {
        if (it.sub) return `<div class="nav-subgroup">${it.sub}</div>`;
        if (it.id === 'su-co' && suCoTechMenuContext()) return suCoTechMenuItemsHtml();
        const b = it.badge ? it.badge() : 0;
        const label = it.id === 'mat-bang' && ui.market === 'CL' ? 'Mặt bằng & điểm kinh doanh' : (it.id === 'su-co' ? suCoMenuLabel() : it.label);
        return `<a href="#/${it.id}" class="${A.current === it.id ? 'active' : ''}"><span class="ico">${it.ico}</span>${label}${b ? `<span class="badge">${b}</span>` : ''}</a>`;
      }).join('');
    }).join('');
    // RBAC_MARKET_SCOPE_MIGRATION mục 11-14 + DEMO_ACCOUNT_BAR_COMPACT_GROUPING: thanh "Tài khoản
    // demo" lọc theo ui.market (selectedMarket) và nhóm theo scope/role — xem demoAccountBarHtml().
    const demoMode = A.isDemoMode && A.isDemoMode();
    const accountModeLabel = $('#account-mode-label');
    if (demoMode) {
      if (accountModeLabel) accountModeLabel.style.display = '';
      $('#role-seg').innerHTML = demoAccountBarHtml();
    } else {
      if (accountModeLabel) accountModeLabel.style.display = 'none';
      $('#role-seg').innerHTML = A.userHeaderHtml ? A.userHeaderHtml(A.currentAccount()) : '';
    }
    const notificationHost = $('#personal-notification-host');
    if (notificationHost) notificationHost.innerHTML = A.personalNotifications ? A.personalNotifications.headerHtml(A.currentAccount()) : '';
    const activeRole = A.PERM.role(ui.role);
    const roleLabelEl = $('#active-role-label');
    if (roleLabelEl) roleLabelEl.textContent = demoMode && activeRole ? ('Vai trò: ' + activeRole.name) : '';
    // MARKET_SELECTOR_ALL_UNIFICATION: market selector dropdown — CÓ lựa chọn "Tất cả" (value='ALL')
    // khi account đang dùng có scopeType GLOBAL (A.ACCOUNTS.scopeType() — system_admin/ward_leader).
    // Với account MARKET, dropdown chỉ liệt kê ĐÚNG (các) chợ trong marketScopes của account đó,
    // KHÔNG có "Tất cả" — account không thể tự đổi sang chợ/phạm vi ngoài scope vì lựa chọn đó không
    // tồn tại trong dropdown. A.marketSelectHtml() sinh ra ĐÚNG 1 lần logic option này, dùng chung
    // cho cả dropdown "Chợ" trên topbar LẪN dropdown "Phạm vi xem" trong Tổng quan liên chợ (xem
    // js/v-dieuhanh.js) — cả 2 chỗ cùng đọc/ghi ui.market qua data-ch="market-select"/A.ACT.market,
    // không phải 2 state/2 cơ chế khác nhau, chỉ là 2 vị trí hiển thị của ĐÚNG 1 selector.
    $('#market-seg').innerHTML = `<select class="input" style="min-width:200px" data-ch="market-select">${A.marketSelectOptionsHtml()}</select>`;
    // TONG_QUAN_MARKET_DROPDOWN_DEDUP: "Tổng quan liên chợ" tự vẽ dropdown "Phạm vi xem" riêng ngay
    // trong nội dung dashboard (cùng control, xem trên) — ẩn bản trên topbar CHỈ cho đúng màn này để
    // khỏi có 2 dropdown chọn chợ cùng lúc trên 1 màn. Các màn khác (kể cả 'mini-app', đã ẩn từ
    // trước) không đổi.
    $('#market-wrap').style.display = (A.current === 'mini-app' || A.current === 'tong-quan') ? 'none' : '';
    const it = A.menuItem(A.current);
    const pageLabel = it && it.id === 'mat-bang' && ui.market === 'CL'
      ? 'Mặt bằng & điểm kinh doanh'
      : (it ? (it.id === 'su-co' ? suCoMenuLabel() : it.label) : (A.PERSONAL_ROUTES && A.PERSONAL_ROUTES[A.current]) || '');
    $('#page-title').textContent = pageLabel;
    document.title = (pageLabel ? pageLabel + ' · ' : '') + 'Chợ số Cao Lãnh – Prototype';
  }

  // MARKET_SELECTOR_ALL_UNIFICATION mục 5: màn 'BOTH'/'CL'/'TTD' bắt buộc cần 1 chợ cụ thể để render
  // đúng (Mặt bằng, Tài sản chợ, Tiểu thương, Hợp đồng, Thu tiền, Đối soát, Công nợ, Phản ánh...) —
  // khi ui.market === 'ALL', KHÔNG được silently fallback về Chợ Cao Lãnh và KHÔNG được gọi renderer
  // thật của màn đó (nhiều renderer tra cứu U.market(ui.market)/U.inM trực tiếp, sẽ sai dữ liệu hoặc
  // crash nếu chạy với 'ALL') — hiện thông báo yêu cầu chọn 1 chợ cụ thể thay thế.
  A.marketRequiredHtml = function (screenId) {
    const msg = screenId === 'mat-bang'
      ? 'Vui lòng chọn một chợ cụ thể để xem và quản lý mặt bằng.'
      : (() => { const it = A.menuItem(screenId); const lbl = it ? it.label : 'nội dung màn này'; return `Vui lòng chọn một chợ cụ thể để xem ${lbl.charAt(0).toLowerCase() + lbl.slice(1)}.`; })();
    return `<div class="empty">${U.esc(msg)}</div>`;
  };
  A.render = function (scroll) {
    const ae = document.activeElement;
    const focusKey = ae && ae.dataset && ae.dataset.in ? ae.dataset.in : null;
    const caret = focusKey ? ae.selectionStart : null;
    chrome();
    // A.current chỉ có thể là null khi router (bên dưới) không tìm được bất kỳ screen nào mà
    // account hiện tại có quyền — không được render A.VIEWS[...] trong trường hợp đó dù hàm view
    // có tồn tại hay không (NO SCREEN PERMISSION = NO SCREEN RENDER).
    const view = A.current ? A.VIEWS[A.current] : null;
    const kind = A.current ? A.SCREEN_MARKET[A.current] : null;
    const needsMarket = (!ui.market || ui.market === 'ALL') && (kind === 'BOTH' || kind === 'CL' || kind === 'TTD');
    $('#view').innerHTML = A.current
      ? (needsMarket ? A.marketRequiredHtml(A.current) : (view ? view() : '<div class="empty">Đang xây dựng</div>'))
      : '<div class="empty">Tài khoản hiện chưa được cấp quyền truy cập chức năng.</div>';
    if (focusKey) {
      const el = document.querySelector(`[data-in="${focusKey}"]`);
      if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) { /* bỏ qua */ } }
    }
    if (scroll) window.scrollTo(0, 0);
  };
  // Screen đầu tiên (theo đúng thứ tự A.MENU) mà account/role hiện tại có screen permission —
  // dùng làm đích fallback thay cho hard-code 'tong-quan' (vốn không tồn tại với 5 role đang
  // trống quyền ở Phase 1). Trả về null nếu role không có bất kỳ screen permission nào.
  A.firstAccessibleScreen = function () {
    for (const g of A.MENU) for (const it of g.items) if (!it.sub && U.can(it.id)) return it.id;
    return null;
  };
  // Màn cá nhân của CHÍNH tài khoản đang đăng nhập (không phải màn nghiệp vụ, không có trong menu,
  // không cần screen permission — ai đã đăng nhập đều xem được hồ sơ của mình).
  A.PERSONAL_ROUTES = { 'thong-tin-ca-nhan': 'Thông tin cá nhân' };
  A.route = function () {
    // Đồng bộ role + selectedMarket từ account đang dùng TRƯỚC khi đánh giá quyền — đảm bảo
    // U.can() bên dưới luôn dựa trên context mới nhất, kể cả khi route() được gọi ngay sau khi
    // đổi account/market mà chưa qua chrome() lần nào.
    A.syncAccountContext();
    let r = (location.hash || '').replace(/^#\/?/, '');
    // Phase 7 — tương thích ngược 2 hash cũ trước khi chuẩn hóa screen permission (so-do/cau-truc
    // → mat-bang, xem MARKET_LAYOUT_SCREEN_PERMISSION_IMPLEMENTATION_REPORT.md): đổi thẳng sang
    // 'mat-bang' NGAY TẠI ĐÂY, trước khi đánh giá U.can(r) — không cần nhánh xử lý riêng, logic
    // fallback U.can(r)/A.firstAccessibleScreen() ngay dưới đây tự áp dụng y hệt mọi route khác
    // (account không có quyền 'mat-bang' thì tự rơi về fallback, không trắng trang/không loop).
    // MAT_BANG_KHU_TANG_DAY_REDESIGN: "Sơ đồ mặt bằng"/"Danh sách điểm" không còn 2 tab riêng — cả
    // 2 route vẫn dẫn vào ĐÚNG 1 workspace (ui.mb.view chọn Sơ đồ/Bảng, xem js/v-cautruc.js), chỉ
    // khác giá trị mặc định khi mới vào theo đúng ý nghĩa route cũ (#/mat-bang → Sơ đồ, #/diem-kd →
    // Bảng) — GIỮ NGUYÊN route, không tự ý đổi.
    if (ui.market === 'CL' && r === 'mat-bang') {
      if (ui.mb) ui.mb.view = 'grid';
    } else if (ui.market === 'CL' && (r === 'diem-kd' || r === 'so-do' || r === 'cau-truc')) {
      if (ui.mb) ui.mb.view = r === 'diem-kd' ? 'table' : 'grid';
      r = 'mat-bang';
    } else if (r === 'so-do' || r === 'cau-truc') r = 'mat-bang';
    // NO SCREEN PERMISSION = NO SCREEN RENDER: route yêu cầu (từ hash, kể cả gõ thẳng URL) chỉ
    // được nhận nếu U.can(r) đúng — U.can() đã bao gồm cả permission LẪN market applicability
    // (Phase 2), nên 1 route trước đó hợp lệ (vd. phien-cho khi đang TTD) sẽ tự động bị chặn nếu
    // selectedMarket đổi sang market không applicable, không cần xử lý riêng cho từng screen.
    // Không còn fallback hard-code 'tong-quan' — dò screen đầu tiên account thực sự có quyền VÀ
    // applicable với market hiện tại; nếu không còn screen nào, A.current = null và A.render() sẽ
    // hiện trạng thái "chưa được cấp quyền" thay vì render bất kỳ view nào.
    if (!r || (!U.can(r) && !(A.PERSONAL_ROUTES[r] && A.currentAccount()))) {
      const role = A.PERM.role(ui.role);
      r = (role && role.selfService && U.can('mini-app')) ? 'mini-app' : A.firstAccessibleScreen();
    }
    const changed = A.current !== r;
    A.current = r;
    // Phase 2 hotfix: nếu route thật sự hiển thị (r) khác với screen đang ghi trên hash (do vừa
    // fallback — vd. đổi market khiến screen cũ hết applicable), đồng bộ lại hash cho khớp NGAY
    // TẠI ĐÂY bằng history.replaceState — KHÔNG dùng location.hash=... vì thao tác đó tự bắn thêm
    // 1 sự kiện 'hashchange' gọi lại A.route(), có nguy cơ tạo vòng lặp. replaceState chỉ sửa
    // thanh địa chỉ, không bắn hashchange/popstate nên không thể tự gọi lại A.route(). Nếu r là
    // null (không còn screen nào truy cập được) thì KHÔNG đụng vào hash — giữ nguyên trạng thái
    // empty/access hiện tại, không tự bịa 1 fallback screen trái quyền.
    if (r) {
      const wanted = '#/' + r;
      if (location.hash !== wanted) {
        try { history.replaceState(null, '', wanted); } catch (e) { /* bỏ qua */ }
      }
    }
    $('#sidebar').classList.remove('open');
    A.render(changed);
  };
  A.go = r => { if (location.hash === '#/' + r) A.route(); else location.hash = '#/' + r; };

  // ---------- hành động chung ----------
  Object.assign(A.ACT, {
    print: () => window.print(),
    menu: () => $('#sidebar').classList.toggle('open'),
    'demo-account': el => {
      // RBAC V1: đổi Account Demo đang dùng — role hiệu lực VÀ selectedMarket đều được suy ra lại
      // từ account mới (mục 4 yêu cầu Phase 2: giữ nguyên selectedMarket nếu vẫn thuộc
      // allowedMarkets của account mới, ngược lại tự chuyển sang allowedMarkets[0] —
      // syncAccountContext() làm đúng việc này). Đích 'tong-quan' bên dưới chỉ là gợi ý điều
      // hướng — A.go()/A.route() luôn re-validate qua U.can() (đã gồm cả market) và tự sửa về
      // đúng screen (hoặc trạng thái "chưa có quyền") nếu không hợp lệ với account mới.
      const acc = A.ACCOUNTS.get(el.dataset.id);
      if (!acc || acc.status !== 'active') return;
      ui.currentDemoAccountId = acc.id;
      ui.sessionAccountId = acc.id;
      A.syncAccountContext();
      A.saveUi();
      const role = A.PERM.role(ui.role);
      if (U.can('mini-app') && ((role && role.selfService) || A.canDirectCollect(ui.market))) A.go('mini-app');
      else if (!U.can(A.current) || A.current === 'mini-app') A.go('tong-quan'); else A.route();
    },
    // Đổi selectedMarket toàn cục: chấp nhận market nằm trong allowedMarkets của account đang dùng,
    // HOẶC 'ALL' nếu account có scopeType GLOBAL (MARKET_SELECTOR_ALL_UNIFICATION — phòng thủ, UI vốn
    // chỉ render đúng các lựa chọn này). Luôn đi qua A.route() thay vì A.render() để route hiện tại
    // được re-validate ngay (vd. đang ở "Phiên chợ quê" mà đổi sang Chợ Cao Lãnh phải tự chuyển màn
    // khác, không được tiếp tục hiện phien-cho cũ — mục 6).
    market: el => {
      const id = el.dataset.id;
      const acc = A.currentAccount();
      if (id === 'ALL') { if (A.ACCOUNTS.scopeType(acc) !== 'GLOBAL') return; }
      else if (A.allowedMarkets(acc).indexOf(id) === -1) return;
      ui.market = id; ui.page = {}; ui.sel = null; A.saveUi(); A.route();
    },
    go: el => A.go(el.dataset.to),
    'su-co-tech-menu': (el, e) => {
      if (e && e.preventDefault) e.preventDefault();
      if (!suCoTechMenuContext()) return;
      ui.incFlowTab = el.dataset.tab || 'assigned';
      A.go('su-co');
    },
    receipt: el => A.showReceipt(A.db.payments.filter(p => p.receipt === el.dataset.id && U.inM(p) && A.receiptBusinessStateOk(p))),
    guide: () => A.guide()
  });
  // Cầu nối cho dropdown thay hàng nút .seg cũ (RBAC_MARKET_SCOPE_MIGRATION mục 8) — tái dùng
  // NGUYÊN VẸN logic A.ACT.market đã có (không tạo helper thứ 2), chỉ đổi nguồn đọc giá trị từ
  // el.dataset.id (nút bấm) sang el.value (select).
  Object.assign(A.CH, {
    'market-select': el => A.ACT.market({ dataset: { id: el.value } })
  });

  A.guide = function () {
    A.modal(A.mHead('Hướng dẫn xem prototype') + `<div class="modal-b">
      <p class="muted" style="margin-top:0">Prototype mô phỏng <b>Hệ thống quản lý chợ số</b> cho phạm vi 12 chợ (Chợ Cao Lãnh và Chợ quê Cù lao Tân Thuận Đông có đầy đủ dữ liệu nghiệp vụ demo; 10 chợ còn lại mới có trong danh mục, chưa khảo sát hạ tầng). Đổi <b>Tài khoản demo</b> và <b>Chợ</b> ở thanh trên cùng.</p>
      <ol class="script">
        <li><div><b>Lãnh đạo phường → Tổng quan liên chợ:</b> số liệu tổng hợp, so sánh giữa các chợ, cảnh báo cần xử lý.</div></li>
        <li><div><b>Ban Quản lý chợ quê TTĐ → Thu tiền & biên lai:</b> ghi nhận thu tiền mặt trực tiếp, hệ thống phát hành biên lai, tự mở lệnh in và gửi biên lai qua Mini app.</div></li>
        <li><div><b>Tiểu thương → Mini app:</b> đăng nhập bằng OTP, thanh toán khoản phải nộp, gửi phản ánh kèm ảnh.</div></li>
        <li><div>Quay lại <b>Ban Quản lý chợ → Phản ánh & sự cố:</b> phản ánh vừa gửi đã nằm ở cột "Tiếp nhận" để phân công xử lý.</div></li>
        <li><div><b>Báo cáo thống kê:</b> hơn 10 báo cáo, xuất Excel (CSV) hoặc in PDF.</div></li>
      </ol>
      <div class="note" style="margin-top:14px">Toàn bộ tên, số tiền, số sạp là dữ liệu mẫu minh họa. Thao tác trong lúc xem được lưu trên trình duyệt; vào <b>Cài đặt → Đặt lại dữ liệu mẫu</b> để quay về ban đầu.</div>
      </div><div class="modal-f"><button class="btn primary" data-act="close">Bắt đầu xem</button></div>`);
  };

  function init() {
    A.load();
    // Dữ liệu mẫu của cổng tiểu thương (tài khoản tiểu thương gắn hồ sơ thật, có khoản nợ và phản
    // ánh) — dùng chung với /tieu-thuong/, idempotent nên chạy lại không nhân bản.
    if (A.traderWebDemoSeed) A.traderWebDemoSeed();
    // Hồ sơ sự cố mẫu gắn tài sản (SC-DEMO-*) — idempotent, để mở thẳng "Tài sản chợ" vẫn thấy lịch sử sự cố.
    if (A.features.complaints && A.features.complaints.ensureDemoIncidents) A.features.complaints.ensureDemoIncidents();
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const fn = A.ACT[el.dataset.act];
      if (fn) fn(el, e);
    });
    document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && A.IN[el.dataset.in]) A.IN[el.dataset.in](el); });
    document.addEventListener('change', e => { const el = e.target.closest('[data-ch]'); if (el && A.CH[el.dataset.ch]) A.CH[el.dataset.ch](el); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') A.closeModal(); });
    window.addEventListener('hashchange', A.route);
    A.route();
    let seen = false;
    try { seen = !!localStorage.getItem(GUIDEKEY); localStorage.setItem(GUIDEKEY, '1'); } catch (e) { /* bỏ qua */ }
    if (!seen && (!A.isLoggedIn || A.isLoggedIn())) A.guide();
  }
  document.addEventListener('DOMContentLoaded', init);
})(window.APP);
