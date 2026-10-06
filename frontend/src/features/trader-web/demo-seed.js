/* Legacy isolated fixture for the former Trader portal demo. It is intentionally
 * not loaded by either canonical runtime entry point; keeping it here avoids
 * breaking old/manual fixtures without contaminating shared business data.
 * Không sinh khoản phải thu/thanh toán giả: chọn các tiểu thương CÓ SẴN trong A.db với tình huống
 * phí khác nhau (quá hạn, thu một phần, chưa đến hạn) rồi cấp tài khoản tiểu thương cho họ qua
 * A.ACCOUNTS.add — đúng như Quản trị cấp tài khoản trên trang quản lý. Bổ sung 2 phản ánh mẫu
 * (đang xử lý, đã hoàn thành) và 1 thông báo cá nhân theo đúng cấu trúc hiện có.
 * Ngoại lệ: ensurePortalDemo() thêm khoản phải thu/giao dịch/phản ánh MINH HỌA (gắn demoSeed) cho
 * tiểu thương demo TTD-CQ để xem trình bày màn "Tổng quan của tôi".
 * Idempotent: nhận diện bằng id cố định (AC-TW-DEMO-*, SC-TW-*, TB-TW-*, *-DEMO-TTDCQ-*, PA-2026-*), chạy lại không nhân bản. */
(function (A) {
  'use strict';
  if (!A) return;
  const U = A.U;
  const TAG = 'trader-web-demo';

  function roleName(id) { const r = A.PERM && A.PERM.role ? A.PERM.role(id) : null; return r ? r.name : 'Tiểu thương'; }
  const hasAccount = t => A.ACCOUNTS.isTraderLinked(t.id);
  const unpaid = t => A.db.invoices.filter(i => i.traderId === t.id && i.status !== 'paid');
  const eligible = (market, used) => A.db.traders.filter(t => t.market === market && t.stalls.length && A.features.traders.service.deriveBusinessStatus(t) === 'ACTIVE' && !hasAccount(t) && used.indexOf(t.id) === -1)
    .sort((a, b) => a.id.localeCompare(b.id));

  // Mỗi tình huống lấy 1 tiểu thương thật trong dữ liệu mẫu; không đủ dữ liệu thì bỏ qua tình huống đó.
  function pickScenarios() {
    const used = [], out = [];
    const take = (label, market, score) => {
      const list = eligible(market, used).map(t => ({ t, s: score(t) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s || a.t.id.localeCompare(b.t.id));
      if (list.length) { used.push(list[0].t.id); out.push({ t: list[0].t, label }); }
    };
    take('Nợ quá hạn kỳ trước', 'CL', t => unpaid(t).filter(U.isOver).length);
    take('Có khoản thu một phần', 'CL', t => unpaid(t).some(i => i.status === 'partial') ? 1 + unpaid(t).length : 0);
    take('Kỳ hiện tại chưa đến hạn', 'CL', t => { const u = unpaid(t); return u.length === 1 && !u.some(U.isOver) ? 1 : 0; });
    take('Nợ quá hạn', 'TTD', t => unpaid(t).filter(U.isOver).length);
    return out;
  }

  function ensureAccounts() {
    if (A.ACCOUNTS.list().some(a => a.demoSeed === TAG)) return;
    pickScenarios().forEach((x, n) => {
      const id = 'AC-TW-DEMO-' + (n + 1);
      if (A.ACCOUNTS.get(id)) return;
      const m = U.market(x.t.market) || { name: x.t.market };
      A.ACCOUNTS.add({ id, code: 'TW-DEMO' + (n + 1), fullName: x.t.name, phone: x.t.phone, accountType: roleName('trader'),
        title: 'Tiểu thương mẫu – ' + x.label, roleIds: ['trader'], organization: m.name, marketScopes: [x.t.market],
        status: 'PENDING_ACTIVATION', traderId: x.t.id, linkedTraderId: x.t.id, demoSeed: TAG });
    });
  }

  // Phản ánh mẫu theo cấu trúc Incident V2 (history/inspection/work/images) như complaints/page.js.
  function ensureIncidents() {
    const acc = A.ACCOUNTS.get('AC-TW-DEMO-1');
    const t = acc && A.idx.trader.get(acc.traderId);
    const st = t && A.idx.stall.get(t.stalls[0]);
    if (!st) return false;
    const d = String(A.db.today || U.today());
    const day = k => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() - k); return x.toISOString().slice(0, 10); };
    const defs = [
      { id: 'SC-TW-01', state: 'dangxuly', cat: 'Điện', title: 'Ổ cắm điện tại quầy bị chập, có mùi khét', created: day(2) + 'T07:40', deadline: day(1) + 'T17:00', images: ['o-cam-chap.jpg'] },
      { id: 'SC-TW-02', state: 'hoanthanh', cat: 'Cấp thoát nước', title: 'Rãnh thoát nước trước sạp bị tắc sau mưa', created: day(6) + 'T06:55', deadline: day(3) + 'T17:00', images: ['ranh-tac-1.jpg', 'ranh-tac-2.jpg'] }
    ];
    let changed = false;
    defs.forEach(x => {
      if (A.db.incidents.some(i => i.id === x.id)) return;
      const i = { id: x.id, market: st.market, stallId: st.id, traderId: t.id, cat: x.cat, title: x.title,
        desc: x.title + '. Nhờ Ban Quản lý chợ kiểm tra giúp.', source: 'Web app tiểu thương', state: x.state, assetId: null,
        assignee: 'NV05', deadline: x.deadline, created: x.created, rating: null, escalated: false, photo: true,
        images: { report: x.images, inspection: ['hien-truong.jpg'], work: x.state === 'hoanthanh' ? ['sau-xu-ly.jpg'] : [] },
        inspection: { at: x.created.slice(0, 10) + 'T09:30', by: 'NV05', condition: 'Đã kiểm tra tại hiện trường, xác định nguyên nhân.', note: '' },
        work: x.state === 'hoanthanh' ? { content: 'Đã thông tắc rãnh, vệ sinh hố ga trước dãy sạp.', result: 'Nước thoát bình thường, khu vực khô ráo.', completedAt: x.created.slice(0, 10) + 'T15:00', note: '' } : null,
        acceptance: x.state === 'hoanthanh' ? { result: 'pass', by: 'NV01', at: x.created.slice(0, 10) + 'T16:30', note: 'Đạt yêu cầu.' } : null,
        history: [{ at: x.created, action: 'Tiếp nhận phản ánh', detail: 'Nguồn: Web app tiểu thương' }, { at: x.created.slice(0, 10) + 'T08:30', action: 'Phân công kỹ thuật', detail: 'Giao nhân viên kỹ thuật xử lý' }, { at: x.created.slice(0, 10) + 'T09:30', action: 'Kiểm tra hiện trường', detail: '' }]
          .concat(x.state === 'hoanthanh' ? [{ at: x.created.slice(0, 10) + 'T15:00', action: 'Cập nhật kết quả hoàn thành', detail: 'Nước thoát bình thường, khu vực khô ráo.' }, { at: x.created.slice(0, 10) + 'T15:05', action: 'Thông báo kết quả cho người phản ánh', detail: '' }] : []),
        log: [{ at: x.created.slice(0, 10), text: 'Tiếp nhận phản ánh từ Web app tiểu thương' }], demoSeed: TAG };
      A.db.incidents.push(i); changed = true;
    });
    return changed;
  }

  function ensureNotifications() {
    const acc = A.ACCOUNTS.get('AC-TW-DEMO-1');
    const t = acc && A.idx.trader.get(acc.traderId);
    if (!t || (A.db.notifications || []).some(n => n.id === 'TB-TW-01')) return false;
    const over = unpaid(t).filter(U.isOver);
    if (!over.length) return false;
    A.db.notifications.unshift({ id: 'TB-TW-01', at: String(A.db.today || U.today()), title: 'Nhắc nộp phí: còn ' + over.length + ' khoản quá hạn', traderId: t.id, group: 'Cá nhân · ' + t.name,
      channels: ['Web app', 'Zalo OA'], sent: 1, delivered: 1, read: 0, auto: true, demoSeed: TAG,
      body: 'Tổng số tiền quá hạn ' + U.money(U.sum(over, U.due)) + '. Vui lòng thanh toán qua mã QR hoặc nộp cho nhân viên thu phí.' });
    return true;
  }

  // Dữ liệu minh họa cho màn "Tổng quan của tôi" (#/mini-app) của tiểu thương demo TTD-CQ (đăng nhập
  // 0909000001): 3 khoản phải thu (quá hạn / thu một phần / chưa đến hạn) + 3 phản ánh. Chỉ để xem trình
  // bày. Ghi vào đúng A.db.invoices/payments/incidents theo cấu trúc hiện có nên KPI tự tính qua helper
  // sẵn có; khoản thu một phần có giao dịch chuyển khoản tương ứng để số đã nộp khớp lịch sử thu.
  // Id cố định (PT-/GD-/BL-DEMO-TTDCQ-*, PA-2026-*) + demoSeed → chạy lại không nhân bản, dễ lọc/xóa.
  const PORTAL_DEMO_TRADER = 'TTD-CQ';
  function ensurePortalDemo() {
    const t = A.idx.trader.get(PORTAL_DEMO_TRADER), st = t && A.idx.stall.get(t.stalls[0]);
    if (!st) return false;
    const contract = A.db.contracts.find(c => c.traderId === t.id && c.status === 'ACTIVE');
    let changed = false;
    const invoice = (id, period, name, amount, paid, due) => {
      if (A.db.invoices.some(i => i.id === id)) return;
      A.db.invoices.push({ id, period, market: st.market, stallId: st.id, traderId: t.id, contractId: contract ? contract.id : null,
        items: [{ name, amount }], amount, paid, issued: period + '-01', due, status: paid >= amount ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
        adjust: null, reminders: 0, demoSeed: TAG });
      changed = true;
    };
    invoice('PT-DEMO-TTDCQ-01', '2026-09', 'Phí sử dụng điểm kinh doanh', 360000, 0, '2026-09-10');
    invoice('PT-DEMO-TTDCQ-02', '2026-09', 'Phí vệ sinh', 50000, 20000, '2026-09-30');
    if (!A.db.payments.some(p => p.id === 'GD-DEMO-TTDCQ-01') && A.db.invoices.some(i => i.id === 'PT-DEMO-TTDCQ-02')) {
      A.db.payments.push({ id: 'GD-DEMO-TTDCQ-01', invoiceId: 'PT-DEMO-TTDCQ-02', market: st.market, traderId: t.id, amount: 20000, method: 'ck',
        date: '2026-09-12', time: '09:00', by: 'Hệ thống', receipt: 'BL-DEMO-TTDCQ-01', lookup: 'DEMOCQ', reconciled: true, demoSeed: TAG });
      changed = true;
    }
    // Đẩy theo thứ tự cũ → mới: danh sách phản ánh của cổng hiển thị bản ghi mới nhất trước.
    [
      { id: 'PA-2026-011', state: 'hoanthanh', cat: 'Điện', title: 'Đề nghị kiểm tra ổ cắm điện tại quầy', created: '2026-09-20T14:20' },
      { id: 'PA-2026-015', state: 'tiepnhan', cat: 'Cấp thoát nước', title: 'Khu vực trước quầy bị đọng nước', created: '2026-09-25T08:15' },
      { id: 'PA-2026-018', state: 'dangxuly', cat: 'Điện', title: 'Đèn chiếu sáng tại dãy bị hỏng', created: '2026-09-28T18:30' }
    ].forEach(x => {
      if (A.db.incidents.some(i => i.id === x.id)) return;
      A.db.incidents.push({ id: x.id, market: st.market, stallId: st.id, traderId: t.id, cat: x.cat, title: x.title,
        desc: x.title + '. Nhờ Ban Quản lý chợ kiểm tra giúp.', source: 'Web app tiểu thương', state: x.state, assetId: null,
        assignee: x.state === 'tiepnhan' ? null : 'NV05', deadline: null, created: x.created, rating: null, escalated: false, photo: false,
        work: x.state === 'hoanthanh' ? { content: 'Đã kiểm tra, thay ổ cắm mới.', result: 'Ổ cắm hoạt động bình thường.', completedAt: x.created.slice(0, 10) + 'T17:00', note: '' } : null,
        history: [{ at: x.created, action: 'Tiếp nhận phản ánh', detail: 'Nguồn: Web app tiểu thương' }],
        log: [{ at: x.created.slice(0, 10), text: 'Tiếp nhận phản ánh từ Web app tiểu thương' }], demoSeed: TAG });
      changed = true;
    });
    return changed;
  }

  A.traderWebDemoSeed = function () {
    try {
      ensureAccounts();
      const a = ensureIncidents(), b = ensureNotifications(), c = ensurePortalDemo();
      if (a || b || c) A.save();
    } catch (e) { console.error('[trader-web] demo seed', e); }
  };
})(window.APP);
