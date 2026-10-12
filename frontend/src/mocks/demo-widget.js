/* Widget demo nổi (kiểu AssistiveTouch) để giả lập điền dữ liệu khi trình diễn prototype.
 * CHỈ dùng cho demo: không phải chức năng nghiệp vụ. Không có store riêng, không tạo localStorage key mới.
 * Mọi thao tác dữ liệu đi qua hàm sẵn có (A.applyPayment) và kiểm tra lại quyền / trạng thái kỳ giống nút "Thu tiền".
 * Muốn gỡ: xoá thẻ <script> nạp file này trong index.html.
 * Thêm thao tác mới: A.demoWidget.register({ id, label, hint(): string|null (null = dùng được), run() }). */
(function (A) {
  'use strict';
  if (!A || A.demoWidget) return;
  const U = A.U, actions = [];
  const MP = () => A.features && A.features.finance && A.features.finance.marketPeriod;

  function register(a) {
    if (!a || !a.id || typeof a.run !== 'function') return;
    const i = actions.findIndex(x => x.id === a.id);
    if (i === -1) actions.push(a); else actions[i] = a;
  }

  // ---- Thu tiền: kỳ đang chọn của chợ đang chọn (cùng cách chọn kỳ như màn Thu tiền & biên lai) ----
  function currentPeriod() {
    const ui = A.ui, svc = MP();
    if (!svc || !A.periods) return null;
    const picked = A.periods.resolve(ui.market, ui.periodId || ui.period);
    if (picked && picked.marketId === ui.market) return picked;
    const list = A.periods.listForMarket(ui.market).slice().sort((a, b) => String(a.period).localeCompare(String(b.period)));
    return list.slice().reverse().find(x => svc.canCollect(x)) || list[list.length - 1] || null;
  }
  function unpaidInvoices(p) {
    const svc = MP();
    return svc.invoices(p).filter(i => i.status !== 'paid' && U.due(i) > 0 && svc.canCollectInvoice(i));
  }
  function collectAllHint() {
    if (!A.isLoggedIn()) return 'Chưa đăng nhập';
    if (!/thu-tien/.test(location.hash)) return 'Mở màn Thu tiền & biên lai để dùng';
    const ui = A.ui, p = currentPeriod(), svc = MP();
    if (!ui.market || ui.market === 'ALL') return 'Chọn một chợ cụ thể ở thanh trên';
    if (!p || !svc) return 'Chưa có kỳ thu';
    if (!A.canCollectReceivable(ui.market) || A.canDo('phai-thu.xem-toan-cho', ui.market)) return 'Tài khoản này không có quyền thu tiền ở chợ đang chọn';
    if (!svc.canCollect(p)) return 'Kỳ chưa phát hành hoặc đã hoàn tất thu / đã chốt';
    if (!unpaidInvoices(p).length) return 'Không còn khoản nào chưa thu';
    return null;
  }
  function collectAll() {
    if (collectAllHint()) return;
    const p = currentPeriod(), acc = A.currentAccount(), code = acc.code || acc.id;
    const list = unpaidInvoices(p), total = list.reduce((s, i) => s + U.due(i), 0);
    if (!window.confirm('Giả lập thu tiền mặt đủ ' + list.length + ' khoản chưa thu (' + U.money(total) + ')?\nChỉ dùng để demo.')) return;
    let ok = 0, sum = 0;
    list.forEach(inv => {
      const due = U.due(inv);
      if (due <= 0 || inv.status === 'paid') return; // chống ghi trùng
      const pays = A.applyPayment([inv.id], due, 'tm', code);
      if (pays.length === 1 && inv.status === 'paid') {
        pays[0].note = 'Demo: thu hàng loạt';
        ok++; sum += pays[0].amount;
      } else console.error('[demo-widget] không thu đủ khoản', inv.id, pays);
    });
    U.log('Demo: giả lập thu tiền mặt ' + ok + ' khoản · ' + U.money(sum));
    A.save(); A.render();
    U.toast('Đã giả lập thu ' + ok + '/' + list.length + ' khoản · ' + U.money(sum));
  }
  register({ id: 'collect-all', label: 'Thu hết khoản chưa thu', hint: collectAllHint, run: collectAll });

  // ---- Chuyển tài khoản nhanh (đổi account, đồng bộ role/chợ, điều hướng qua A.go/A.route để kiểm lại quyền). ----
  // Nguồn danh sách: A.ACCOUNTS.currentList() (tổ chức hiện hành, đang hoạt động). Tài khoản tiểu thương dùng cổng riêng nên không liệt kê.
  function switchableAccounts() {
    try {
      return A.ACCOUNTS.currentList().filter(a => A.ACCOUNTS.isActive(a) && A.ACCOUNTS.primaryRole(a) !== 'trader');
    } catch (e) { return []; }
  }
  function accountsHtml() {
    const cur = A.currentAccount(), list = switchableAccounts();
    if (!list.length) return '';
    return '<div class="dw-sec">Chuyển tài khoản</div>' + list.map(a => {
      const role = (A.PERM.role(A.ACCOUNTS.primaryRole(a)) || {}).name || '';
      return '<button class="dw-item dw-acc' + (cur && cur.id === a.id ? ' on' : '') + '" type="button" data-dw-acc="' + U.esc(a.id) + '">'
        + U.esc(a.fullName) + '<small>' + U.esc(role) + '</small></button>';
    }).join('');
  }
  // Các bước giống A.ACT['demo-account'] (bootstrap.js), nhưng kiểm tra bằng A.ACCOUNTS.isActive: handler gốc so status với
  // 'active' (thường) trong khi store đã chuẩn hóa thành 'ACTIVE' nên không dùng lại được.
  function switchTo(id) {
    const ui = A.ui, acc = A.ACCOUNTS.get(id);
    if (!acc || !A.ACCOUNTS.isActive(acc) || A.ACCOUNTS.primaryRole(acc) === 'trader') return;
    ui.currentDemoAccountId = acc.id;
    ui.sessionAccountId = acc.id;
    A.syncAccountContext();
    A.saveUi();
    const role = A.PERM.role(ui.role);
    if (U.can('mini-app') && ((role && role.selfService) || A.canDirectCollect(ui.market))) A.go('mini-app');
    else if (!U.can(A.current) || A.current === 'mini-app') A.go('tong-quan'); else A.route();
    U.toast('Đã chuyển sang: ' + acc.fullName);
  }

  // ---- Giao diện ----
  const css = `
  #dw-root{position:fixed;z-index:2147483000;left:0;top:0;font-family:inherit}
  #dw-btn{position:fixed;width:52px;height:52px;border-radius:16px;border:1px solid rgba(255,255,255,.35);
    background:rgba(11,93,122,.82);backdrop-filter:blur(6px);box-shadow:0 4px 14px rgba(0,0,0,.28);
    cursor:grab;touch-action:none;display:flex;align-items:center;justify-content:center;opacity:.9;
    transition:opacity .2s,left .22s,top .22s;user-select:none}
  #dw-btn.dw-drag{cursor:grabbing;transition:none;opacity:1}
  #dw-btn i{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center}
  #dw-btn i::after{content:"";width:14px;height:14px;border-radius:50%;background:#fff}
  #dw-menu{position:fixed;width:min(280px,calc(100vw - 24px));background:#fff;color:#16222b;border-radius:12px;
    box-shadow:0 10px 30px rgba(0,0,0,.3);padding:8px;display:none}
  #dw-menu.on{display:block}
  #dw-menu h4{margin:6px 8px 8px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#5b6b76}
  .dw-item{display:block;width:100%;text-align:left;min-height:44px;padding:8px 12px;margin:0 0 4px;border:1px solid #d3dde3;
    border-radius:8px;background:#fff;color:#0B5D7A;font:inherit;font-weight:600;cursor:pointer}
  .dw-item:disabled{color:#7b8a94;background:#f3f6f8;cursor:not-allowed}
  .dw-item small{display:block;font-weight:400;color:#5b6b76;margin-top:2px}
  .dw-sec{margin:10px 8px 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#5b6b76}
  .dw-acc{min-height:40px;font-weight:500}
  .dw-acc.on{background:#e6f1f5;border-color:#0B5D7A}
  .dw-acc small{display:inline;margin:0 0 0 6px}
  #dw-menu{max-height:calc(100vh - 24px);overflow-y:auto}
  .dw-note{margin:4px 8px 4px;font-size:12px;color:#5b6b76}
  @media print{#dw-root{display:none}}`;

  function mount() {
    if (document.getElementById('dw-root')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const root = document.createElement('div'); root.id = 'dw-root';
    root.innerHTML = '<div id="dw-menu" role="menu" aria-label="Công cụ demo"></div><button id="dw-btn" type="button" aria-label="Công cụ demo" title="Công cụ demo (kéo để di chuyển)"><i></i></button>';
    document.body.appendChild(root);
    const btn = root.querySelector('#dw-btn'), menu = root.querySelector('#dw-menu');
    const SZ = 52, M = 8;
    let x = window.innerWidth - SZ - M, y = Math.round(window.innerHeight * 0.6);
    const clamp = () => { x = Math.max(M, Math.min(window.innerWidth - SZ - M, x)); y = Math.max(M, Math.min(window.innerHeight - SZ - M, y)); };
    const place = () => { clamp(); btn.style.left = x + 'px'; btn.style.top = y + 'px'; placeMenu(); };
    function placeMenu() {
      const w = menu.offsetWidth || 280, h = menu.offsetHeight || 120;
      let mx = x + SZ / 2 > window.innerWidth / 2 ? x - w - 8 : x + SZ + 8;
      let my = y + SZ / 2 > window.innerHeight / 2 ? y + SZ - h : y;
      mx = Math.max(8, Math.min(window.innerWidth - w - 8, mx)); my = Math.max(8, Math.min(window.innerHeight - h - 8, my));
      menu.style.left = mx + 'px'; menu.style.top = my + 'px';
    }
    function renderMenu() {
      menu.innerHTML = '<h4>Công cụ demo</h4>' + actions.map(a => {
        const why = a.hint ? a.hint() : null;
        return '<button class="dw-item" type="button" data-dw="' + a.id + '"' + (why ? ' disabled' : '') + '>' + U.esc(a.label) + (why ? '<small>' + U.esc(why) + '</small>' : '') + '</button>';
      }).join('') + accountsHtml() + '<div class="dw-note">Giả lập cho prototype, bỏ qua bước đăng nhập OTP. Không phải nghiệp vụ thật.</div>';
      placeMenu();
    }
    const setMenu = on => { if (on) renderMenu(); menu.classList.toggle('on', on); placeMenu(); };

    let drag = null;
    btn.addEventListener('pointerdown', e => {
      drag = { sx: e.clientX, sy: e.clientY, ox: x, oy: y, moved: false };
      btn.setPointerCapture(e.pointerId);
    });
    btn.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      if (!drag.moved) { drag.moved = true; btn.classList.add('dw-drag'); menu.classList.remove('on'); }
      x = drag.ox + dx; y = drag.oy + dy; place();
    });
    const end = () => {
      if (!drag) return;
      const moved = drag.moved; drag = null; btn.classList.remove('dw-drag');
      if (moved) { x = x + SZ / 2 < window.innerWidth / 2 ? M : window.innerWidth - SZ - M; place(); } // hút vào mép như AssistiveTouch
      else setMenu(!menu.classList.contains('on'));
    };
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', () => { drag = null; btn.classList.remove('dw-drag'); });
    menu.addEventListener('click', e => {
      const ab = e.target.closest('[data-dw-acc]');
      if (ab) { setMenu(false); switchTo(ab.dataset.dwAcc); return; }
      const b = e.target.closest('[data-dw]');
      if (!b || b.disabled) return;
      const a = actions.find(x => x.id === b.dataset.dw);
      setMenu(false);
      if (a) a.run();
    });
    document.addEventListener('pointerdown', e => { if (!root.contains(e.target)) menu.classList.remove('on'); }, true);
    window.addEventListener('resize', place);
    window.addEventListener('hashchange', () => menu.classList.remove('on'));
    place();
    // Chỉ hiện khi đã đăng nhập (màn đăng nhập / cổng tiểu thương không có công cụ demo).
    setInterval(() => {
      let show = false;
      try { const acc = A.isLoggedIn() && A.currentAccount(); show = !!acc && A.ACCOUNTS.primaryRole(acc) !== 'trader'; } catch (e) { show = false; }
      root.style.display = show ? '' : 'none';
    }, 800);
  }

  A.demoWidget = { register, mount };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})(window.APP);
