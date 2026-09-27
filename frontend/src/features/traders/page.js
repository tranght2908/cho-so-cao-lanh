/* Trader UI (Phase 15.16, from js/v-tieuthuong.js): route tieu-thuong (CL list with filters, generic
 * list), trader drawer (profile, documents, points, contracts, debt, Mini App state), profile edit and
 * document replacement, A.openTraderDrawer, A.ttDocDefs. Data via traders / business-points / contracts /
 * accounts / finance services. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const f = ui.f;
  const dkSeller = s => A.features.businessPoints.ui.dkSeller(s);
  // ---------- Tiểu thương ----------
  // Chợ Cao Lãnh (selectedMarket = CL): màn hồ sơ tiểu thương riêng theo yêu cầu
  // TIEU_THUONG_CL_SCREEN_REFACTOR (xem TIEU_THUONG_CL_SCREEN_REFACTOR_REPORT.md). Quan hệ lọc theo
  // Khu vực/Ngành hàng đi qua ĐÚNG chuỗi TIỂU THƯƠNG → HỢP ĐỒNG/QUAN HỆ THUÊ (t.stalls) → ĐIỂM KINH
  // DOANH (A.idx.stall) → KHU VỰC (st.section)/NGÀNH HÀNG (st.cat) — KHÔNG thêm field "khu vực" vào
  // trader, không duplicate dữ liệu. State filter RIÊNG (f.ttcl*, ui.page.ttcl) — tách biệt hoàn
  // toàn với f.tt*/ui.page.tt bên dưới (ttRows/ttViewGeneric, dùng cho TTD/market khác — KHÔNG đổi).
  // HOTFIX (drawer edit inline, xem báo cáo): id tiểu thương đang ở EDIT MODE trong drawer CL — null
  // = VIEW MODE (mặc định). Chỉ 1 drawer CL có thể mở tại 1 thời điểm nên 1 biến module là đủ, không
  // cần lưu theo từng trader. Reset về null mỗi khi mở lại drawer từ đầu (A.ACT.trader) hoặc sau khi
  // Hủy/Lưu — đảm bảo "mặc định mở drawer: VIEW MODE" (mục 2 yêu cầu).
  let ttEditId = null;
  // Trader profile read/edit/document data access (Phase 6) — src/features/traders/service.js.
  const TS = A.features.traders.service;
  // Business-point display lookups (Phase 7) — src/features/business-points/service.js.
  const BP = A.features.businessPoints.service;
  // Contract read access for trader display (Phase 8) — src/features/contracts/service.js.
  const CS = A.features.contracts.service;
  // HOTFIX (mục 9-11 yêu cầu): giấy tờ đang chờ thay thế trong EDIT MODE hiện tại — { [docKey]:
  // {fileName} }. CHỈ là state tạm phía FE, chưa ghi vào trader.docFiles cho tới khi bấm "Lưu thay
  // đổi" (tt-edit-save); "Hủy" xóa sạch, không để sót giữa các lần mở drawer khác nhau.
  let ttPendingDocs = {};
  // 4 giấy tờ cố định của hồ sơ số hóa CL (mục 12/17 yêu cầu TRADER_PROFILE_AND_MINIAPP_WORKFLOW —
  // tách CCCD mặt trước/sau thành 2 card riêng thay vì 1 card "CCCD 2 mặt" gộp trước đây). key dùng
  // làm field trong trader.docFiles, label dùng để hiển thị/mock preview. Đây là NGUỒN DUY NHẤT cho
  // cả wizard "+ Thêm tiểu thương" (xem TT_WIZARD_STEP_LABEL/ttWizardStep3Html bên dưới) lẫn Section
  // B của drawer chi tiết — không tạo danh mục giấy tờ song song. Key cũ 'cccd' (gộp) của dữ liệu cũ
  // (nếu có trong docFiles đã lưu) không còn được đọc — chỉ là mock metadata rỗng mặc định nên không
  // có dữ liệu thật nào bị mất.
  const TT_DOCS = [
    { key: 'cccdFront', label: 'CCCD - Mặt trước' },
    { key: 'cccdBack', label: 'CCCD - Mặt sau' },
    { key: 'dkkd', label: 'Giấy chứng nhận đăng ký kinh doanh' },
    { key: 'avatar', label: 'Ảnh chân dung' }
  ];
  // Expose cho js/mini.js (đăng ký/bổ sung hồ sơ Mini App dùng ĐÚNG danh mục này — mục 32 yêu cầu
  // "không duplicate trader data"). v-tieuthuong.js load TRƯỚC mini.js (xem index.html) nên luôn có
  // giá trị khi mini.js thực thi.
  A.ttDocDefs = TT_DOCS;
  // Attachment của prototype được lưu cùng record sở hữu. Ảnh mới giữ thêm data URL để
  // có thể xem lại sau reload localStorage; PDF/tệp khác chỉ giữ metadata, không giả preview.
  function ttCaptureFile(file, done) {
    const meta = { name: file.name, type: file.type || '', size: Number(file.size || 0), addedAt: U.today(), mock: true };
    if (!file.type || file.type.indexOf('image/') !== 0) return done(meta);
    const reader = new FileReader();
    reader.onload = () => done(Object.assign(meta, { dataUrl: reader.result }));
    reader.onerror = () => done(meta);
    reader.readAsDataURL(file);
  }
  function ttDocLabel(key) { const doc = TT_DOCS.find(x => x.key === key); return doc ? doc.label : 'Hồ sơ khác'; }
  function ttFileCanPreview(file) { return !!(file && file.dataUrl && String(file.dataUrl).indexOf('data:image/') === 0); }
  function ttFileMetaLabel(file) {
    if (!file) return 'Chưa có';
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) return 'PDF · Đã tải lên';
    return ttFileCanPreview(file) ? 'Ảnh · Đã tải lên' : 'Đã tải lên';
  }
  function ttFileViewHtml(title, file) {
    const preview = ttFileCanPreview(file) ? `<img class="tt-file-preview" src="${U.esc(file.dataUrl)}" alt="${U.esc(title)}">` : '<div class="note info">Prototype chỉ có metadata của tệp này, chưa có dữ liệu xem trước.</div>';
    return A.mHead('Xem tài liệu') + `<div class="modal-b"><p><b>${U.esc(title)}</b></p><p class="small muted">${U.esc(file && file.name || '')}</p>${preview}</div><div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`;
  }
  // Hồ sơ sử dụng điểm là adapter bổ sung cho quan hệ sẵn có trader.stalls <->
  // stall.traderId. Nó giữ dữ liệu theo TỪNG điểm (không thay thế contracts).
  function ttUsageStore() { return Array.isArray(A.db.pointUsages) ? A.db.pointUsages : (A.db.pointUsages = []); }
  function ttActiveUsage(pointId) { return ttUsageStore().find(x => x.pointId === pointId && x.status === 'ACTIVE') || null; }
  function ttUsageFor(t, pointId) { return ttUsageStore().find(x => x.traderId === t.id && x.pointId === pointId && x.status === 'ACTIVE') || null; }
  function ttUsageStart(t, st) { const u = ttUsageFor(t, st.id); return u ? u.startDate : ((st.contractId && A.idx.contract.get(st.contractId) || {}).start || t.since || ''); }
  function ttPointPath(st) { const p = A.mbLayoutPathForPoint ? A.mbLayoutPathForPoint(st.market, st) : null; return p ? [p.khu, p.tang, p.day, st.code].filter(x => x && x !== '—').join(' → ') : [st.sectionName, st.code].filter(Boolean).join(' → '); }
  function ttSectionsOf(t) {
    return t.stalls.map(id => BP.get(id)).filter(Boolean).map(st => st.section);
  }
  // Cột "Khu vực" ở bảng danh sách (mục 3-4 yêu cầu hotfix) — suy ra từ ĐÚNG quan hệ Trader → Điểm
  // KD (t.stalls) → st.sectionName đã có, KHÔNG thêm field "area" giả vào trader. Dedupe bằng Set để
  // nhiều điểm cùng khu vực không lặp tên khu (mục 4 yêu cầu: "Khu A, Khu A" → chỉ còn "Khu A").
  function ttSectionNamesOf(t) {
    const names = t.stalls.map(id => BP.get(id)).filter(Boolean).map(st => st.sectionName);
    return Array.from(new Set(names));
  }
  function ttCatsOf(t) {
    const stalls = t.stalls.map(id => BP.get(id)).filter(Boolean);
    return stalls.length ? Array.from(new Set(stalls.map(st => st.cat))) : [t.cat || 'Chưa gán'];
  }
  // ==================== TRADER_PROFILE_AND_MINIAPP_WORKFLOW ====================
  // CORRECTION (xem TRADER_PROFILE_MINIAPP_CORRECTION_REPORT.md): Mini App KHÔNG còn tự đăng ký hồ
  // sơ — Trader Profile luôn do NV BQL tạo trước (mục 7), Mini App chỉ TRA CỨU theo SĐT rồi
  // đăng nhập/kích hoạt (js/mini.js). Vì vậy: bỏ hẳn khái niệm PENDING_LINK (miniLinkRequests không
  // còn nguồn phát sinh nào trong runtime mới — field/collection GIỮ LẠI trong data.js chỉ để tương
  // thích, không đọc nữa) và bỏ tab "Chờ xác minh" (không còn cách nào tạo ra trạng thái này nữa,
  // hiển thị 1 tab luôn rỗng là dead UI). `profileStatus` vẫn giữ nguyên 4 giá trị + 3 tab lọc còn
  // lại (Tất cả/Đang hoạt động/Cần bổ sung/Ngừng hoạt động) — 2 trạng thái NEEDS_SUPPLEMENT/INACTIVE
  // không còn cách set qua UI ở V1 nhưng field vẫn hữu ích để BQL gán tay sau này qua "Chỉnh sửa
  // thông tin" (ngoài phạm vi task này) hoặc nghiệp vụ tương lai — fallback 'ACTIVE' cho record thiếu
  // field.
  const TT_PROFILE_LABEL = { ACTIVE: 'Đang hoạt động', PENDING_VERIFICATION: 'Chờ xác minh', NEEDS_SUPPLEMENT: 'Cần bổ sung', INACTIVE: 'Ngừng hoạt động' };
  const TT_PROFILE_CLASS = { ACTIVE: 'ok', PENDING_VERIFICATION: 'warn', NEEDS_SUPPLEMENT: 'danger', INACTIVE: '' };
  function ttProfileStatus(t) { return t.profileStatus || 'ACTIVE'; }
  function ttProfileStatusTag(t) { const s = ttProfileStatus(t); return `<span class="tag ${TT_PROFILE_CLASS[s] || ''}">${TT_PROFILE_LABEL[s] || s}</span>`; }
  // Tài khoản Mini App liên kết với hồ sơ — đọc qua A.ACCOUNTS.byTraderId (account.traderId — xem
  // js/accounts.js), KHÔNG dùng `t.app` (cờ "đã cài đặt app" thuần cũ, giữ nguyên cho các màn khác
  // đang dùng — dashboard/báo cáo/công nợ ngoài phạm vi feature này). Nhãn nghiệp vụ đổi sang
  // "kích hoạt" (mục 18 yêu cầu correction — Mini App giờ là "kích hoạt bằng SĐT+OTP", không phải
  // "liên kết hồ sơ đăng ký") — CHỈ đổi label hiển thị, KHÔNG đổi giá trị kỹ thuật NOT_LINKED/LINKED/
  // LOCKED (giữ nguyên để tương thích, xem A.ACCOUNTS.byTraderId/ttCreateLinkedAccount dùng chung
  // cho cả wizard cũ đã bỏ lẫn luồng OTP mới).
  function ttLinkedAccount(t) { return A.features.accounts.service.byTraderId(t.id); }
  function ttMiniAppState(t) {
    const acc = ttLinkedAccount(t);
    return acc ? (acc.status === 'active' ? 'LINKED' : 'LOCKED') : 'NOT_LINKED';
  }
  const TT_MINIAPP_LABEL = { NOT_LINKED: 'Chưa kích hoạt', LINKED: 'Đã kích hoạt', LOCKED: 'Đã khóa' };
  const TT_MINIAPP_CLASS = { NOT_LINKED: '', LINKED: 'ok', LOCKED: 'danger' };
  function ttMiniAppTag(t) { const s = ttMiniAppState(t); return `<span class="tag ${TT_MINIAPP_CLASS[s]}">${TT_MINIAPP_LABEL[s]}</span>`; }
  function ttclHasFilter() {
    return !!(f.ttclFloor || f.ttclSection || f.ttclCat || f.ttclApp || (f.ttclSearch && f.ttclSearch.trim()));
  }
  // Search theo tên/SĐT/CCCD/mã tiểu thương/mã điểm KD (mục 5 yêu cầu — CCCD ĐƯỢC search dù bảng
  // chính không hiển thị CCCD đầy đủ; kết quả search không làm lộ thêm dữ liệu vì bảng vẫn mask).
  function ttSearchMatchCL(t, q) {
    if (t.name.toLowerCase().includes(q)) return true;
    if (t.phone.includes(q)) return true;
    if ((t.idNo || '').includes(q)) return true;
    if (t.id.toLowerCase().includes(q)) return true;
    return t.stalls.some(id => { const st = BP.get(id); return st && st.code.toLowerCase().includes(q); });
  }
  // Lọc kết hợp được (giống pattern đã dùng ở Điểm kinh doanh CL): 1 tiểu thương = 1 dòng, chỉ cần
  // MỘT trong các điểm đang thuê thỏa khu vực/ngành hàng đang lọc là đủ để tiểu thương đó xuất hiện —
  // không flatten theo điểm nên không thể duplicate dòng.
  function ttRowsCL() {
    const q = (f.ttclSearch || '').trim().toLowerCase();
    return TS.list().filter(t => U.inM(t)
      && (!f.ttclFloor || t.stalls.some(id => { const st=BP.get(id); return st && st.floor===f.ttclFloor; }))
      && (!f.ttclSection || ttSectionsOf(t).includes(f.ttclSection))
      && (!f.ttclCat || ttCatsOf(t).includes(f.ttclCat))
      && (!f.ttclApp || ttMiniAppState(t) === f.ttclApp)
      && (!q || ttSearchMatchCL(t, q)));
  }
  function ttRowHtmlCL(t) {
    const debt = U.traderDebt(t.id), over = U.traderOverdue(t.id);
    // Bảng chính bỏ Điện thoại/Địa chỉ/CCCD đầy đủ (mục 4/35 yêu cầu) — dữ liệu model KHÔNG đổi, vẫn
    // xem đủ trong drawer chi tiết (Section A) và vẫn tìm được qua ô search (ttSearchMatchCL).
    const area = ttSectionNamesOf(t).join(', ') || '–';
    const points = t.stalls.map(id => BP.get(id)).filter(Boolean);
    const pointLabel = points.length > 1 ? points.length + ' điểm' : (points[0] ? points[0].code : '–');
    const updated = (t.updatedAt || t.since || '').split('-').reverse().join('/');
    return `<tr class="click" data-act="trader" data-id="${t.id}">
      <td>${t.id}</td><td><b>${U.esc(t.name)}</b></td><td>${U.maskPhone(t.phone)}</td><td>${U.maskId(t.idNo)}</td>
      <td title="${U.esc(area)}">${U.esc(pointLabel)}</td><td>${U.esc(ttCatsOf(t).join(', '))}</td><td>${updated || '–'}</td>
      <td class="nowrap"><button class="btn sm" data-act="trader" data-id="${t.id}">Xem</button></td></tr>`;
  }
  function ttViewCL() {
    const rows = ttRowsCL();
    const pg = U.pager('ttcl', rows.length, 25);
    const m = U.market('CL');
    const sections = [], cats = [];
    m.floors.forEach(fl => fl.sections.forEach(s => { sections.push([s.id, s.name]); if (!cats.includes(s.cat)) cats.push(s.cat); }));
    const body = U.table([{ t: 'Mã TT' }, { t: 'Họ tên' }, { t: 'Số điện thoại' }, { t: 'Số giấy tờ' }, { t: 'Điểm KD' }, { t: 'Ngành hàng' }, { t: 'Ngày cập nhật' }, { t: 'Thao tác' }],
      rows.slice(pg.start, pg.end).map(ttRowHtmlCL), { empty: 'Không có tiểu thương phù hợp.' });
    return `<div class="card trader-table-card"><div class="card-h" style="flex-direction:column;align-items:stretch;gap:10px">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap"><h3 style="margin:0">Hồ sơ tiểu thương</h3>
        ${A.canDo('tieu-thuong.them-moi', ui.market) ? '<button class="btn primary" data-act="tt-new">+ Thêm hồ sơ tiểu thương</button>' : ''}</div>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <select class="input" data-ch="ttcl-floor"><option value="">Tầng: Tất cả</option>${m.floors.map(x=>`<option value="${x.id}" ${f.ttclFloor===x.id?'selected':''}>${U.esc(x.name)}</option>`).join('')}</select>
        <select class="input" data-ch="ttcl-section"><option value="">Khu / dãy: Tất cả</option>${sections.map(s => `<option value="${s[0]}" ${f.ttclSection === s[0] ? 'selected' : ''}>${U.esc(s[1])}</option>`).join('')}</select>
        <select class="input" data-ch="ttcl-cat"><option value="">Tất cả ngành hàng</option>${cats.map(c => `<option ${f.ttclCat === c ? 'selected' : ''}>${U.esc(c)}</option>`).join('')}</select>
        <input class="input" placeholder="Tìm tên, SĐT, số giấy tờ, mã TT, mã điểm..." data-in="ttcl-search" value="${U.esc(f.ttclSearch || '')}">
        <button class="btn" data-act="ttcl-clear" ${ttclHasFilter() ? '' : 'disabled'}>↺ Xóa bộ lọc</button>
      </div>
      </div>
      <div class="card-b">${body}${pg.html}
        </div></div>`;
  }
  A.CH['ttcl-section'] = el => { f.ttclSection = el.value; ui.page.ttcl = 0; A.render(); };
  A.CH['ttcl-floor'] = el => { f.ttclFloor = el.value; ui.page.ttcl = 0; A.render(); };
  A.CH['ttcl-cat'] = el => { f.ttclCat = el.value; ui.page.ttcl = 0; A.render(); };
  A.CH['ttcl-app'] = el => { f.ttclApp = el.value; ui.page.ttcl = 0; A.render(); };
  A.IN['ttcl-search'] = el => { f.ttclSearch = el.value; ui.page.ttcl = 0; A.render(); };
  // "Xóa bộ lọc": reset đúng 4 state filter hiện có, KHÔNG đổi dữ liệu nghiệp vụ.
  A.ACT['ttcl-clear'] = () => {
    f.ttclFloor = ''; f.ttclSection = ''; f.ttclCat = ''; f.ttclApp = ''; f.ttclSearch = '';
    ui.page.ttcl = 0;
    A.render();
  };

  // ---- Chợ quê TTĐ / fallback: danh sách tổng quát cũ, KHÔNG đổi (ngoài phạm vi task CL) ----
  function ttRows() {
    const q = (f.ttSearch || '').toLowerCase();
    return TS.list().filter(t => U.inM(t)
      && (!f.ttApp || (f.ttApp === 'yes') === !!t.app)
      && (!q || t.name.toLowerCase().includes(q) || t.phone.includes(q) || t.id.toLowerCase().includes(q) || t.stalls.some(id => BP.get(id).code.toLowerCase().includes(q))));
  }
  function ttViewGeneric() {
    const rows = ttRows(), pg = U.pager('tt', rows.length, 25);
    return `<div class="card trader-table-card"><div class="card-h"><h3>${ui.role === 'ward_leader' ? 'Tra cứu tiểu thương' : 'Hồ sơ tiểu thương'}</h3>
      <select class="input" data-ch="tt-app"><option value="">Mini app: tất cả</option><option value="yes" ${f.ttApp === 'yes' ? 'selected' : ''}>Đã cài mini app</option><option value="no" ${f.ttApp === 'no' ? 'selected' : ''}>Chưa cài</option></select>
      <input class="input" placeholder="Tên, SĐT, mã điểm KD" data-in="tt-search" value="${U.esc(f.ttSearch || '')}">
      ${A.canDo('tieu-thuong.them-moi', ui.market) ? '<button class="btn primary" data-act="tt-new">+ Thêm tiểu thương</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Mã' }, { t: 'Họ tên' }, { t: 'Điện thoại' }, { t: 'Chợ' }, { t: 'Ngành hàng' }, { t: 'Điểm KD' }, { t: 'Mini app' }, { t: 'Công nợ', num: true }],
        rows.slice(pg.start, pg.end).map(t => {
          const debt = U.traderDebt(t.id), over = U.traderOverdue(t.id);
          return `<tr class="click" data-act="trader" data-id="${t.id}"><td>${t.id}</td><td><b>${U.esc(t.name)}</b></td><td>${U.maskPhone(t.phone)}</td><td>${U.mShort(t.market)}</td><td>${U.esc(t.cat)}</td>
            <td>${t.stalls.map(id => BP.get(id).code).join(', ') || '–'}</td><td>${t.app ? '<span class="tag ok">Đã cài</span>' : '<span class="tag">Chưa</span>'}</td>
            <td class="num" style="${over ? 'color:#df2225;font-weight:600' : ''}">${debt ? U.money(debt) : '–'}</td></tr>`;
        }))}${pg.html}
        <div class="small muted" style="margin-top:8px">Số điện thoại, số giấy tờ được che trên danh sách theo Nghị định 356/2025/NĐ-CP về bảo vệ dữ liệu cá nhân.</div></div></div>`;
  }
  A.VIEWS['tieu-thuong'] = () => ui.market === 'CL' ? ttViewCL() : ttViewGeneric();
  A.CH['tt-app'] = el => { f.ttApp = el.value; ui.page.tt = 0; A.render(); };
  A.IN['tt-search'] = el => { f.ttSearch = el.value; ui.page.tt = 0; A.render(); };

  // ---- Drawer hồ sơ tiểu thương — Chợ Cao Lãnh (bố cục A-E theo yêu cầu, xem báo cáo) ----
  // TTĐ/market khác: GIỮ NGUYÊN modal cũ (nhánh else trong A.ACT.trader bên dưới), không đổi 1 dòng.
  // Section B (Hồ sơ số hóa) — 3 giấy tờ được coi là hồ sơ bắt buộc đã có sẵn của tiểu thương
  // (TIEU_THUONG_CL_DRAWER_REDESIGN, xem báo cáo): chỉ còn nút "Xem" (mock preview có sẵn qua
  // tt-doc-view), KHÔNG còn badge "Đã có"/"Chưa có" (mục 6 yêu cầu).
  // Trạng thái THẬT theo t.docFiles[doc.key] (mục 6/17 yêu cầu — "Đã tải lên"/"Chưa có", không còn
  // hard-code "Đã tải lên" cho mọi giấy tờ như bản cũ). Nút "Xem" chỉ hiện khi thật sự có file mock.
  function ttDocRow(t, doc) {
    const f2 = (t.docFiles || {})[doc.key];
    return `<div class="tt-doc-tile"><span class="tt-doc-tile-icon">${U.icon('file')}</span><span class="tt-doc-label"><b>${U.esc(doc.label)}</b><small>${ttFileMetaLabel(f2)}${f2 ? ` · ${U.esc(f2.name || '')}` : ''}</small></span>${ttFileCanPreview(f2) ? `<button class="btn sm" data-act="tt-doc-view" data-id="${t.id}" data-key="${doc.key}">Xem</button>` : ''}</div>`;
  }
  function ttDetailDocRowsHtml(t) {
    const files = t.docFiles || {};
    const keys = Object.keys(files).filter(key => key !== 'avatar');
    if (!keys.length) return '<div class="tt-empty-inline">Chưa có giấy tờ cá nhân hoặc hồ sơ khác.</div>';
    return `<div class="tt-doc-list">${keys.map(key => {
      const file = files[key], label = ttDocLabel(key);
      return `<div class="tt-doc-tile"><span class="tt-doc-tile-icon">${U.icon('file')}</span><span class="tt-doc-label"><b>${U.esc(label)}</b><small>${ttFileMetaLabel(file)}${file && file.name ? ` · ${U.esc(file.name)}` : ''}</small></span></div>`;
    }).join('')}</div>`;
  }
  // EDIT MODE của Hồ sơ số hóa (mục 9-11 yêu cầu hotfix): thêm nút "Thay thế" cạnh "Xem". Giấy tờ
  // nào KHÔNG bấm "Thay thế" thì giữ nguyên file cũ (mục 10) — chỉ hiện dòng "đang chờ thay thế" cho
  // đúng giấy tờ có file mới trong ttPendingDocs, chưa ghi gì vào dữ liệu thật cho tới khi Lưu.
  function ttDocRowEdit(doc) {
    const pending = ttPendingDocs[doc.key];
    const current = (TS.getProfile(ttEditId) || {}).docFiles || {};
    const file = pending || current[doc.key];
    return `<div style="padding:7px 0;border-bottom:1px solid #eef2f7">
      <div class="row" style="justify-content:space-between">
        <span class="tt-doc-label">${doc.label}</span>
        <span class="row" style="gap:6px">
          <button class="btn sm" data-act="tt-doc-replace" data-key="${doc.key}">Thay thế</button>
        </span>
      </div>
      ${pending ? `<div class="small" style="color:var(--brand);margin-top:4px">Đang chờ thay thế bằng "${U.esc(pending.name)}" — áp dụng khi bấm "Lưu thay đổi"</div>` : ''}
    </div>`;
  }
  // Section C — mỗi điểm kinh doanh 1 card riêng (mục 7 yêu cầu), người trực tiếp kinh doanh của
  // ĐÚNG điểm đó nằm ngay trong card (mục 8 yêu cầu) — không còn section D riêng cho người bán.
  // Không suy đoán "giống người thuê" khi sellerId rỗng — nhất quán với quy ước đã chốt ở drawer
  // Mặt bằng chợ (mbStallSeller): null hiển thị đúng nghĩa "chưa ghi nhận", không tự bịa dữ liệu.
  // HOTFIX (mục 4-6 yêu cầu): "Người trực tiếp kinh doanh" gộp về 1 dòng (label + tên + SĐT + badge),
  // wrap tự nhiên qua .row (flex-wrap:wrap có sẵn) thay vì 4 dòng cứng như trước. Seller khác người
  // thuê: tên clickable mở lại đúng modal thông tin cơ bản (tt-seller-view) đã có, KHÔNG gán nghĩa vụ
  // tài chính cho seller — hợp đồng/người thuê phía trên card vẫn là chủ thể với BQL.
  // HOTFIX (drawer C — tách "Vị trí" thành dòng riêng + rút gọn "Người trực tiếp kinh doanh", xem
  // báo cáo): "Vị trí" dùng ĐÚNG field thật đang có trong model (st.sectionName) — KHÔNG suy diễn/
  // tách chuỗi "sectionName · cat" cũ, không đổi schema stall chỉ để phục vụ trình bày. Người trực
  // tiếp kinh doanh rút về đúng 1 dòng label/value như Vị trí/Hợp đồng/Thời hạn: trùng người thuê
  // → chỉ tên (đã đủ thông tin ở Section A, không lặp SĐT/badge); khác người thuê → CHỈ tên
  // clickable, tái dùng NGUYÊN action tt-seller-view/permission hiện có (A.canDo bên trong handler
  // đó không đổi) — không tạo luồng nghiệp vụ mới, không thêm nút "Xem" riêng.
  function ttPointCardHtml(t, stallId) {
    const st = BP.get(stallId);
    if (!st) return '';
    const usage = ttUsageFor(t, st.id);
    const seller = dkSeller(st);
    const sameSellerRenter = !!(seller && seller.id === t.id);
    const sellerCell = !seller
      ? '<span class="small muted">Chưa ghi nhận</span>'
      : sameSellerRenter
        ? U.esc(seller.name)
      : U.esc(seller.name);
    const placement = usage && Array.isArray(usage.placementFiles) ? usage.placementFiles : [];
    return `<div class="plan-section tt-point-tile">
      <div class="row tt-point-title"><h4>${st.code}</h4>${U.statusTag(st.status)}</div>
      <div class="tt-point-location">${U.esc(ttPointPath(st))}</div>
      <dl class="kv">
        <dt>Ngành hàng</dt><dd>${U.esc(usage ? usage.category : st.cat)}</dd>
        <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd>
        <dt>Ngày bắt đầu</dt><dd>${U.dmy(ttUsageStart(t, st))}</dd>
        <dt>Loại diện tích</dt><dd>${U.esc(U.areaTypeLabel(st.areaType) || 'Chưa có thông tin')}</dd>
      </dl>
      <div class="divider"></div>
      <div class="tt-point-subhead">NGƯỜI BÁN TRỰC TIẾP</div><div class="tt-seller-block">${seller ? `${sellerCell}<div class="tt-meta">${seller.phone ? U.maskPhone(seller.phone) + ' · ' : ''}${sameSellerRenter ? 'Chính tiểu thương trực tiếp bán' : 'Người trực tiếp bán'}</div>` : 'Chưa ghi nhận'}</div>
      <div class="divider"></div>
      <div class="tt-point-subhead">HỒ SƠ BỐ TRÍ</div>${placement.length ? `<div class="tt-placement-list">${placement.map(x => `<div class="tt-placement-row"><span>${U.icon('file')}</span><div><b>${U.esc(x.name)}</b><small>${ttFileMetaLabel(x)}</small></div></div>`).join('')}</div>` : '<div class="tt-empty-inline">Chưa có tệp</div>'}
    </div>`;
  }
  // Section A — VIEW MODE (mặc định khi mở drawer).
  function ttSectionAViewHtml(t) {
    const portrait = (t.docFiles || {}).avatar;
    const portraitHtml = ttFileCanPreview(portrait)
      ? `<img src="${U.esc(portrait.dataUrl)}" alt="Ảnh chân dung ${U.esc(t.name)}">`
      : `<span>${U.icon('users')}</span><small>${portrait ? 'Đã tải ảnh, chưa có dữ liệu xem trước' : 'Chưa có ảnh chân dung'}</small>`;
    return `<div class="tt-profile-layout"><div class="tt-portrait ${ttFileCanPreview(portrait) ? 'has-image' : ''}">${portraitHtml}</div><dl class="kv"><dt>Mã tiểu thương</dt><dd>${t.id}</dd><dt>Họ và tên</dt><dd>${U.esc(t.name)}</dd><dt>Số điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd><dt>Loại giấy tờ</dt><dd>${U.esc(t.idType || 'CCCD')}</dd><dt>Số giấy tờ</dt><dd>${U.maskId(t.idNo)}</dd></dl></div>`;
  }
  // Section A — EDIT MODE (mục 2 yêu cầu hotfix): chỉnh ngay trong drawer, KHÔNG mở modal/drawer thứ
  // hai. Mã tiểu thương là identifier — KHÔNG đưa vào form (mục 2). Mini app không thuộc form chỉnh
  // sửa này (chưa có nghiệp vụ bật/tắt mini app từ phía BQL — giữ nguyên, ngoài phạm vi hotfix).
  function ttSectionAEditHtml(t) {
    return `<div class="form-grid"><div class="field"><label>Họ tên *</label><input class="input" id="tte-name" value="${U.esc(t.name)}"></div><div class="field"><label>Số điện thoại *</label><input class="input" id="tte-phone" value="${U.esc(t.phone)}"></div><div class="field"><label>Loại giấy tờ *</label><select class="input" id="tte-idtype"><option value="CCCD" ${(!t.idType||t.idType==='CCCD')?'selected':''}>CCCD</option><option value="CMND" ${t.idType==='CMND'?'selected':''}>CMND</option><option value="Hộ chiếu" ${t.idType==='Hộ chiếu'?'selected':''}>Hộ chiếu</option></select></div><div class="field"><label>Số giấy tờ *</label><input class="input" id="tte-idno" value="${U.esc(t.idNo)}"></div></div>
    <div class="row" style="justify-content:flex-end;margin-top:14px">
      <button class="btn" data-act="tt-edit-cancel" data-id="${t.id}">← Quay lại xem chi tiết</button>
      <button class="btn primary" data-act="tt-edit-save" data-id="${t.id}">Lưu thay đổi</button>
    </div>`;
  }
  // Section E — Tài khoản Mini App (CORRECTION mục 17): CHỈ READ quan hệ Account.traderId — KHÔNG
  // còn nhánh "yêu cầu liên kết đang chờ" (PENDING_LINK đã bỏ khỏi runtime, xem ghi chú đầu file).
  // Không password management. Khóa/mở khóa chỉ đổi account.status (KHÔNG đụng profileStatus — 2
  // trục độc lập, mục 19 yêu cầu correction + NEED_CONFIRMATION #5).
  function ttMiniAppSectionHtml(t) {
    const canVerify = A.canDo('tieu-thuong.xac-minh', t.market);
    const acc = ttLinkedAccount(t);
    if (acc) {
      const locked = acc.status !== 'active';
      return `<dl class="kv">
          <dt>Trạng thái</dt><dd>${locked ? '<span class="tag danger">Đã khóa</span>' : '<span class="tag ok">Đã kích hoạt</span>'}</dd>
          <dt>Tài khoản</dt><dd>${acc.id}</dd>
          <dt>SĐT đăng nhập</dt><dd>${U.maskPhone(acc.phone || t.phone)}</dd>
          <dt>Hồ sơ liên kết</dt><dd>${t.id}</dd>
          <dt>Trạng thái truy cập</dt><dd>${locked ? 'Đã khóa' : 'Hoạt động'}</dd>
        </dl>
        ${canVerify ? `<div class="row" style="margin-top:8px"><button class="btn sm ${locked ? '' : 'danger'}" data-act="tt-miniapp-toggle" data-id="${t.id}">${locked ? 'Mở khóa truy cập' : 'Khóa truy cập'}</button></div>` : ''}`;
    }
    return `<div class="note"><span class="tag">Chưa kích hoạt</span><div style="margin-top:8px">Số điện thoại đăng ký: <b>${U.maskPhone(t.phone)}</b></div>
      <div class="small muted" style="margin-top:4px">Tiểu thương có thể sử dụng số điện thoại đã đăng ký với Ban Quản lý để kích hoạt Mini App.</div></div>
      ${canVerify ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="tt-miniapp-copy-guide" data-id="${t.id}">Sao chép hướng dẫn</button></div>` : ''}`;
  }
  A.ACT['tt-miniapp-toggle'] = el => {
    const t = A.idx.trader.get(el.dataset.id);
    if (!t || !A.canDo('tieu-thuong.xac-minh', t.market)) return;
    const acc = ttLinkedAccount(t);
    if (!acc) return;
    const next = acc.status === 'active' ? 'disabled' : 'active';
    A.features.accounts.service.setStatus(acc.id, next);
    U.log(`${next === 'active' ? 'Mở khóa' : 'Khóa'} truy cập Mini App của ${t.name} (${t.id})`);
    ttRerenderDrawer(t);
    A.render();
    U.toast(next === 'active' ? 'Đã mở khóa truy cập Mini App.' : 'Đã khóa truy cập Mini App.');
  };
  // Mock UI/toast thuần (mục 17 yêu cầu correction — thay "Gửi hướng dẫn đăng ký hồ sơ" cũ, không
  // còn ý nghĩa, bằng hành động nhẹ "Sao chép hướng dẫn" kích hoạt bằng SĐT). Không notification thật.
  A.ACT['tt-miniapp-copy-guide'] = el => {
    const t = A.idx.trader.get(el.dataset.id);
    if (!t || !A.canDo('tieu-thuong.xac-minh', t.market)) return;
    U.toast('Đã sao chép hướng dẫn kích hoạt Mini App (SĐT ' + U.maskPhone(t.phone) + ') — minh họa.');
  };
  // Renderer cũ được giữ làm tham chiếu compatibility; popup hiện dùng renderer bên dưới.
  function ttDrawerHtmlLegacy(t) {
    const canEdit = A.canDo('tieu-thuong.them-moi', t.market);
    const editing = canEdit && ttEditId === t.id;
    const canCongNo = U.can('cong-no');
    const debt = U.traderDebt(t.id);
    const unpaidCount = A.features.finance.service.unpaidInvoicesForTrader(t.id).length;
    const status = ttProfileStatus(t);
    return `<div class="drawer-h detail-form-head" style="flex-wrap:wrap"><div><div class="row" style="gap:9px"><h3>${U.esc(t.name)}</h3>${ttProfileStatusTag(t)}</div><div class="small muted" style="margin-top:2px">${t.id} · ${U.esc(U.mShort(t.market))}</div></div><span class="spacer"></span>
        ${canEdit && !editing ? `<button class="btn sm" data-act="tt-edit-open" data-id="${t.id}">${U.icon('edit')}Chỉnh sửa thông tin</button>` : ''}
        <button class="x" data-act="close" aria-label="Đóng">×</button></div><div class="detail-form-tabs">${U.icon('users')} Hồ sơ tiểu thương</div>
      <div class="drawer-b tt-detail-body">
        ${status === 'NEEDS_SUPPLEMENT' ? `<div class="note" style="margin-bottom:12px">Hồ sơ cần bổ sung: ${U.esc(t.supplementNote || 'Chưa ghi nội dung yêu cầu.')}</div>` : ''}
        <section class="tt-detail-card tt-profile-card">
        <div class="tt-detail-card-h"><span>${U.icon('users')}</span><div><b>A. Thông tin tiểu thương</b><div class="small muted">Hồ sơ định danh và thông tin kinh doanh</div></div></div>
        ${editing ? ttSectionAEditHtml(t) : ttSectionAViewHtml(t)}
        </section>
        <section class="tt-detail-card">
        <div class="tt-detail-card-h"><span>${U.icon('file')}</span><div><b>B. Hồ sơ số hóa</b><div class="small muted">Tài liệu minh họa đã lưu</div></div></div>
        <div class="tt-doc-grid">${TT_DOCS.map(d => editing ? ttDocRowEdit(d) : ttDocRow(t, d)).join('')}</div>
        </section>
        <section class="tt-detail-card tt-points-card">
        <div class="tt-detail-card-h"><span>${U.icon('store')}</span><div><b>C. Điểm kinh doanh đang sử dụng</b><div class="small muted">Vai trò tại từng điểm và hợp đồng liên quan</div></div></div>
        <div class="plan">${t.stalls.length ? t.stalls.map(id => ttPointCardHtml(t, id)).join('') : '<div class="empty small">Tiểu thương chưa có điểm kinh doanh đang sử dụng.</div>'}</div>
        </section>
        <section class="tt-detail-card">
        <div class="tt-detail-card-h"><span>${U.icon('file')}</span><div><b>Lịch sử hợp đồng</b><div class="small muted">Truy vết từ quan hệ Contract, không sao chép vào hồ sơ tiểu thương</div></div></div>
        ${(()=>{const cs=CS.listByTrader(t.id).sort((a,b)=>b.start.localeCompare(a.start));return cs.length?U.table([{t:'Mã HĐ'},{t:'Điểm KD'},{t:'Thời hạn'},{t:'Trạng thái'},{t:''}],cs.map(c=>`<tr><td>${c.id}</td><td>${A.idx.stall.get(c.stallId)?A.idx.stall.get(c.stallId).code:'—'}</td><td>${U.dmy(c.start)} – ${U.dmy(c.end)}</td><td>${c.status==='hieuluc'?'<span class="tag ok">Hiệu lực</span>':'<span class="tag">'+(c.status==='chamdut'?'Đã chấm dứt':'Đã kết thúc')+'</span>'}</td><td><button class="btn sm" data-act="ct-view" data-id="${c.id}">Xem</button></td></tr>`)): '<div class="empty small">Chưa có hợp đồng.</div>';})()}
        </section>
        ${A.VEHICLES ? A.VEHICLES.traderSection(t) : ''}<section class="tt-detail-card">
        <div class="tt-detail-card-h"><span>${U.icon('money')}</span><div><b>E. Tình trạng công nợ</b><div class="small muted">Tóm tắt các khoản cần theo dõi</div></div></div>
        <dl class="kv">
          <dt>Công nợ hiện tại</dt><dd>${debt ? `<b style="color:#df2225">${U.money(debt)}</b>` : '<span class="tag ok">Không nợ</span>'}</dd>
          <dt>Khoản chưa thanh toán</dt><dd>${unpaidCount}</dd>
        </dl>
        ${canCongNo ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="tt-open-congno">Xem chi tiết công nợ</button></div>` : ''}
        </section>
        <section class="tt-detail-card">
        <div class="tt-detail-card-h"><span>${U.icon('phone')}</span><div><b>E. Tài khoản Mini App</b><div class="small muted">Liên kết đăng nhập ứng dụng tiểu thương</div></div></div>
        ${ttMiniAppSectionHtml(t)}
        </section>
      </div><div class="drawer-f detail-form-footer"><button class="btn" data-act="close">Đóng</button></div>`;
  }
  // Chi tiết hồ sơ theo mô hình mới: dữ liệu kinh doanh nằm theo từng điểm,
  // không còn đưa Contract hoặc Mini App vào popup hồ sơ.
  function ttDrawerHtmlCL(t) {
    const canEdit=A.canDo('tieu-thuong.them-moi',t.market), editing=canEdit&&ttEditId===t.id, debt=U.traderDebt(t.id), unpaid=A.features.finance.service.unpaidInvoicesForTrader(t.id).length;
    return `<div class="drawer-h detail-form-head"><div><div class="row" style="gap:9px"><h3>${U.esc(t.name)}</h3>${ttProfileStatusTag(t)}</div><div class="small muted">${t.id} · ${U.esc(U.mShort(t.market))}</div></div><span class="spacer"></span>${canEdit&&!editing?`<button class="btn sm" data-act="tt-edit-open" data-id="${t.id}">${U.icon('edit')}Chỉnh sửa thông tin</button>`:''}<button class="x" data-act="close" aria-label="Đóng">×</button></div><div class="drawer-b tt-detail-body"><section class="tt-detail-card"><div class="tt-detail-card-h"><span>${U.icon('users')}</span><div><b>A. Thông tin tiểu thương</b><div class="small muted">Thông tin nhận dạng và liên hệ</div></div></div>${editing?ttSectionAEditHtml(t):ttSectionAViewHtml(t)}</section><section class="tt-detail-card"><div class="tt-detail-card-h"><span>${U.icon('file')}</span><div><b>B. Giấy tờ & hồ sơ đính kèm</b><div class="small muted">Giấy tờ cá nhân và tài liệu liên quan</div></div></div>${editing?`<div class="tt-doc-grid">${TT_DOCS.map(x=>ttDocRowEdit(x)).join('')}</div>`:ttDetailDocRowsHtml(t)}</section><section class="tt-detail-card tt-points-card"><div class="tt-detail-card-h"><span>${U.icon('store')}</span><div><b>C. Điểm kinh doanh đang sử dụng</b><div class="small muted">Thông tin kinh doanh tại từng điểm</div></div></div><div class="plan">${t.stalls.length?t.stalls.map(id=>ttPointCardHtml(t,id)).join(''):'<div class="empty small">Tiểu thương chưa có điểm kinh doanh đang sử dụng.</div>'}</div></section>${A.VEHICLES?A.VEHICLES.traderSection(t,{editable:editing}):''}<section class="tt-detail-card"><div class="tt-detail-card-h"><span>${U.icon('money')}</span><div><b>E. Tình trạng công nợ</b><div class="small muted">Tóm tắt các khoản cần theo dõi</div></div></div><dl class="kv"><dt>Công nợ hiện tại</dt><dd>${debt?`<b class="tt-debt-value">${U.money(debt)}</b>`:'<span class="tag ok">Không nợ</span>'}</dd><dt>Khoản chưa thanh toán</dt><dd>${unpaid}</dd></dl></section></div>`;
  }
  A.ACT['tt-placement-view'] = el => {
    const st = A.idx.stall.get(el.dataset.point);
    const usage = st && ttActiveUsage(st.id);
    const file = usage && (usage.placementFiles || [])[Number(el.dataset.file)];
    if (!file) return U.toast('Không tìm thấy tệp hồ sơ bố trí.');
    A.modal(ttFileViewHtml('Hồ sơ bố trí · ' + st.code, file));
  };
  A.ACT['tt-doc-view'] = el => {
    const t = TS.getProfile(el.dataset.id);
    const file = t && (t.docFiles || {})[el.dataset.key];
    if (!file) return U.toast('Không tìm thấy tệp hồ sơ.');
    A.modal(ttFileViewHtml(ttDocLabel(el.dataset.key), file));
  };
  // "Thay thế" giấy tờ (mục 9 yêu cầu hotfix) — FE prototype: chỉ mở file picker cục bộ (input
  // type=file, KHÔNG upload server/storage thật), lưu tên file vào state tạm ttPendingDocs. Chưa
  // đụng dữ liệu trader — chỉ thật sự áp dụng (ghi t.docFiles) khi bấm "Lưu thay đổi" (tt-edit-save),
  // "Hủy" (tt-edit-cancel) xóa sạch state tạm này. Re-check permission tại đây, không chỉ dựa vào
  // nút đã được ẩn/hiện đúng theo canEdit (mục 12 yêu cầu: handler phải tự kiểm tra lại).
  A.ACT['tt-doc-replace'] = el => {
    const t = TS.getProfile(ttEditId);
    if (!t || !A.canDo('tieu-thuong.them-moi', t.market)) return;
    const key = el.dataset.key;
    // Gắn input vào DOM (ẩn) thay vì tạo rời rạc rồi bỏ ngay — input.click() vẫn mở đúng file picker
    // của hệ điều hành như bình thường, nhưng input còn tồn tại trong DOM để có thể dọn dẹp đúng
    // cách sau khi chọn/hủy (tránh rò rỉ node lơ lửng qua nhiều lần "Thay thế").
    const old = A.$('#tt-doc-replace-input'); if (old) old.remove();
    const input = document.createElement('input');
    input.type = 'file'; input.id = 'tt-doc-replace-input'; input.accept = 'image/*,.pdf'; input.style.display = 'none';
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) ttCaptureFile(input.files[0], meta => { ttPendingDocs[key] = meta; ttRerenderDrawer(t); });
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  };
  // "Xem thông tin" người trực tiếp kinh doanh khi KHÁC người thuê (mục 8 yêu cầu) — chỉ xem thông
  // tin cơ bản (không phải hồ sơ tài chính/công nợ), không biến người bán thành chủ thể nghĩa vụ tài
  // chính với BQL. NEED_CONFIRMATION: xem báo cáo về phạm vi hiển thị của modal này.
  A.ACT['tt-seller-view'] = (el, e) => {
    if (e) e.preventDefault();
    const s = A.idx.trader.get(el.dataset.id);
    if (!s) return;
    A.modal(A.mHead('Người trực tiếp kinh doanh') + `<div class="modal-b"><dl class="kv">
      <dt>Họ tên</dt><dd>${U.esc(s.name)}</dd>
      <dt>Điện thoại</dt><dd>${U.maskPhone(s.phone)}</dd>
      <dt>CCCD</dt><dd>${U.maskId(s.idNo)}</dd>
      </dl></div>
      <div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`);
  };
  // Điều hướng "Xem" hợp đồng → màn Hợp đồng, tái dùng ĐÚNG state search/tab sẵn có của màn đó
  // (f.hdSearch/ui.contractTab) — không sửa 1 dòng nào trong A.VIEWS['hop-dong'].
  A.ACT['tt-open-contract'] = (el, e) => {
    if (e) e.preventDefault();
    const c = A.idx.contract.get(el.dataset.id);
    if (!c) return;
    ui.contractTab = c.status === 'hieuluc' ? 'all' : 'end';
    f.hdSearch = c.id;
    ui.page['hd' + ui.contractTab] = 0;
    A.go('hop-dong');
  };
  // Điều hướng "Xem công nợ" → màn Công nợ & nhắc nợ (screen-level, màn đó không có ô tìm theo tên
  // nên không thể tự động lọc đúng 1 tiểu thương — không sửa màn tài chính để thêm cơ chế đó).
  A.ACT['tt-open-congno'] = () => { if (U.can('cong-no')) A.go('cong-no'); };
  A.ACT['tt-open-point'] = el => {
    const t=A.idx.trader.get(el.dataset.trader), st=A.idx.stall.get(el.dataset.id);
    if(!t||!st)return;
    A.drawerPush(t.id, () => ttRerenderDrawer(t));
    A.openDkDrawer(st);
  };

  // Mở drawer hồ sơ tiểu thương — hàm THUẦN dùng chung cho action GỐC (`trader`, tự reset stack) và
  // khi mở làm drawer CON từ Mặt bằng chợ/Điểm kinh doanh (`mb-open-trader`/`dkcl-open-trader`, tự
  // push stack) — xem js/v-dieuhanh.js + `dkcl-open-trader` ở trên.
  A.openTraderDrawer = function (t) {
    if (t.market === 'CL') {
      ttEditId = null; // mở lại từ đầu luôn ở VIEW MODE (mục 2 yêu cầu hotfix)
      ttPendingDocs = {};
      A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer drawer-tt-cl">${A.drawerBackHtml()}${ttDrawerHtmlCL(t)}</div>`;
      A.render();
      return;
    }
    const invs = A.db.invoices.filter(i => i.traderId === t.id).sort((a, b) => b.period.localeCompare(a.period)).slice(0, 8);
    const cts = CS.listByTrader(t.id);
    const pays = A.db.payments.filter(p => p.traderId === t.id).slice(-6).reverse();
    A.modal(A.mHead(U.esc(t.name) + ' · ' + t.id) + `<div class="modal-b"><div class="grid g2">
      <dl class="kv"><dt>Giới tính / năm sinh</dt><dd>${t.gender} · ${t.birth}</dd><dt>Điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd>
        <dt>CCCD</dt><dd>${U.maskId(t.idNo)}</dd><dt>Địa chỉ</dt><dd>${U.esc(t.address)}</dd>
        <dt>Hộ kinh doanh</dt><dd>${t.hkd ? 'Có giấy CN ĐKKD' : 'Cá nhân kinh doanh'}</dd></dl>
      <dl class="kv"><dt>Chợ</dt><dd>${U.mShort(t.market)}</dd><dt>Ngành hàng</dt><dd>${U.esc(t.cat)}</dd><dt>Kinh doanh từ</dt><dd>${U.dmy(t.since)}</dd>
        <dt>Mini app</dt><dd>${t.app ? '<span class="tag ok">Đã cài</span>' : '<span class="tag">Chưa cài</span>'}</dd>
        <dt>Giấy tờ số hóa</dt><dd><span class="tag info">CCCD 2 mặt</span> ${t.hkd ? '<span class="tag info">Giấy CN ĐKKD</span>' : ''}</dd></dl></div>
      <div class="divider"></div><b>Điểm kinh doanh & hợp đồng</b>
      ${U.table([{ t: 'Số hợp đồng' }, { t: 'Điểm KD' }, { t: 'Thời hạn' }, { t: 'Giá/tháng', num: true }, { t: 'Trạng thái' }], cts.map(c => `<tr><td>${c.id}</td><td>${A.idx.stall.get(c.stallId).code}</td><td>${U.dmy(c.start)} – ${U.dmy(c.end)}</td><td class="num">${c.monthly ? U.money(c.monthly) : 'Theo phiên'}</td><td>${c.status === 'hieuluc' ? '<span class="tag ok">Hiệu lực</span>' : '<span class="tag">Đã thanh lý</span>'}</td></tr>`))}
      <div class="divider"></div><b>Khoản phải thu gần đây</b>
      ${U.table([{ t: 'Mã' }, { t: 'Kỳ' }, { t: 'Số tiền', num: true }, { t: 'Đã thu', num: true }, { t: 'Trạng thái' }], invs.map(i => `<tr><td>${i.id}</td><td>${U.per(i.period)}</td><td class="num">${U.money(i.amount)}</td><td class="num">${U.money(i.paid)}</td><td>${U.invTag(i)}</td></tr>`))}
      ${pays.length ? `<div class="divider"></div><b>Biên lai gần đây</b>${U.table([{ t: 'Biên lai' }, { t: 'Ngày' }, { t: 'Hình thức' }, { t: 'Số tiền', num: true }], pays.map(p => `<tr class="click" data-act="receipt" data-id="${p.receipt}"><td>${p.receipt}</td><td>${U.dmy(p.date)}</td><td>${D.METHOD[p.method]}</td><td class="num">${U.money(p.amount)}</td></tr>`))}` : ''}
      </div><div class="modal-f">${A.canDo('thu-tien.thu', t.market) && U.traderDebt(t.id) ? `<button class="btn primary" data-act="pay-open" data-id="${t.id}">${U.icon('card')}Thu tiền</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`, true);
  };
  // Click "Xem"/dòng bảng ở màn Tiểu thương (và các link trader ở nơi khác) = mở drawer/modal GỐC —
  // reset navigation stack trước (mục 6 yêu cầu back navigation: không hiện "← Quay lại" giả).
  A.ACT.trader = (el, e) => {
    if (e) e.preventDefault();
    A.drawerReset();
    A.openTraderDrawer(TS.getProfile(el.dataset.id));
  };

  // ==================== TÀI KHOẢN MINI APP — find-or-create khi kích hoạt (CORRECTION) ====================
  // Trước đây: 2 hàm này phục vụ 2 popup xác minh hồ sơ Mini App (đã BỎ — xem
  // TRADER_PROFILE_MINIAPP_CORRECTION_REPORT.md). Nghiệp vụ mới: Mini App KHÔNG tự đăng ký hồ sơ,
  // chỉ tra cứu SĐT rồi "kích hoạt" — nhưng bước "tìm hoặc tạo Trader Account" vẫn CẦN đúng logic
  // find-or-create này, nên GIỮ NGUYÊN 2 hàm, chỉ đổi vai trò gọi: giờ được gọi từ js/mini.js (luồng
  // OTP đăng nhập) qua A.createLinkedTraderAccount — expose bên dưới.
  function ttNextAccountId() {
    const nums = A.ACCOUNTS.list().map(a => { const m = /^AC-TT(\d+)$/.exec(a.id); return m ? parseInt(m[1], 10) : NaN; }).filter(n => !isNaN(n));
    return 'AC-TT' + U.pad((nums.length ? Math.max.apply(null, nums) : 0) + 1, 2);
  }
  // Tìm-hoặc-tạo account Mini App cho ĐÚNG 1 trader — an toàn gọi lại nhiều lần (không tạo trùng nếu
  // trader đã có account, xem mục 15 yêu cầu correction "Account uniqueness").
  function ttCreateLinkedAccount(trader, phone) {
    if (A.ACCOUNTS.byTraderId(trader.id)) return A.ACCOUNTS.byTraderId(trader.id);
    const id = ttNextAccountId();
    const acc = { id, code: id.replace('AC-', ''), fullName: trader.name, phone: phone || trader.phone, accountType: 'Tiểu thương', title: 'Tiểu thương', roleIds: ['trader'], organization: U.mShort(trader.market), marketScopes: [trader.market], status: 'active', traderId: trader.id };
    A.ACCOUNTS.add(acc);
    return acc;
  }
  // Expose cho js/mini.js (đăng nhập/kích hoạt Mini App bằng SĐT+OTP — mục 14 yêu cầu correction).
  A.createLinkedTraderAccount = ttCreateLinkedAccount;

  // "Chỉnh sửa thông tin tiểu thương" (CL, HOTFIX mục 1-2 yêu cầu) — reuse ĐÚNG action permission
  // 'tieu-thuong.them-moi' đã có (cùng phạm vi "quản lý hồ sơ tiểu thương"), không tạo permission
  // key mới. targetMarket lấy từ chính record t.market, không dựa ui.market. Chuyển drawer sang EDIT
  // MODE TẠI CHỖ bằng cách set ttEditId rồi render lại ĐÚNG container drawer đang mở — KHÔNG gọi
  // A.modal() (tránh mở modal/drawer thứ hai, tránh thay thế #modal-root làm mất drawer hiện tại).
  function ttRerenderDrawer(t) {
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer drawer-tt-cl">${A.drawerBackHtml()}${ttDrawerHtmlCL(t)}</div>`;
  }
  A.ACT['tt-edit-open'] = el => {
    const t = TS.getProfile(el.dataset.id);
    if (!t || !A.canDo('tieu-thuong.them-moi', t.market)) return;
    ttEditId = t.id;
    ttPendingDocs = {};
    ttRerenderDrawer(t);
  };
  A.ACT['tt-edit-cancel'] = el => {
    const t = TS.getProfile(el.dataset.id);
    if (!t) return;
    ttEditId = null;
    ttPendingDocs = {}; // bỏ luôn file vừa chọn để thay thế, chưa lưu thì không áp dụng (mục 11)
    ttRerenderDrawer(t);
  };
  A.ACT['tt-edit-save'] = el => {
    const t = TS.getProfile(el.dataset.id);
    if (!t || !A.canDo('tieu-thuong.them-moi', t.market)) return;
    const name = A.$('#tte-name').value.trim(), idNo = A.$('#tte-idno').value.trim(), phone = A.$('#tte-phone').value.trim();
    if (!name || !idNo || !phone) { U.toast('Vui lòng nhập đủ họ tên, số CCCD và điện thoại'); return; }
    if (TS.idNoTaken(idNo, t.id)) { U.toast('Số CCCD đã tồn tại trong hệ thống'); return; }
    TS.updateProfile(t.id, { name, idNo, phone, idType: A.$('#tte-idtype').value });
    // Hồ sơ số hóa: CHỈ ghi đè đúng giấy tờ có file thay thế đang chờ (mục 10 yêu cầu) — giấy tờ
    // không bấm "Thay thế" giữ nguyên tham chiếu cũ, không bắt upload lại toàn bộ khi chỉ sửa field
    // thông tin khác.
    TS.updateDocuments(t.id, ttPendingDocs, U.today());
    U.log('Cập nhật hồ sơ tiểu thương ' + t.id + ' – ' + name);
    TS.save();
    ttEditId = null;
    ttPendingDocs = {};
    ttRerenderDrawer(t);
    A.render(); U.toast('Đã cập nhật hồ sơ ' + t.id);
  };
})(window.APP);
