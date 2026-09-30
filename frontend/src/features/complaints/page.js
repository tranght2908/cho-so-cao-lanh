/* Complaints / incidents (Phase 15.12, from js/v-vanhanh.js): route su-co, the incident workflow
 * (Tiếp nhận → Phân công → Đang xử lý → Chờ nghiệm thu → Hoàn thành → Đóng), A.addIncident used by
 * the trader portal, and the open/late helpers read by reports. Data: A.db.incidents. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const ST = D.INCIDENT_STATES;
  const stLabel = id => ST.find(s => s.id === id).label;
  const isOpen = i => i.state !== 'hoanthanh' && i.state !== 'dong';
  const late = i => isOpen(i) && i.deadline < U.today();
  const complaints = A.features.complaints || (A.features.complaints = {});
  complaints.isOpen = isOpen;
  complaints.late = late;

  // ---------- Phản ánh & sự cố ----------
  A.VIEWS['su-co'] = function () {
    const all = A.db.incidents.filter(i => U.inM(i) && (!ui.incCat || i.cat === ui.incCat));
    const cats = Array.from(new Set(A.db.incidents.map(i => i.cat)));
    const done = A.db.incidents.filter(i => U.inM(i) && i.rating);
    return `<div class="kpis">
      <div class="card kpi"><div class="k-label">Đang xử lý</div><div class="k-value">${all.filter(isOpen).length}</div><div class="k-sub">trên tổng ${all.length} phản ánh</div></div>
      <div class="card kpi"><div class="k-label">Quá hạn</div><div class="k-value" style="color:var(--danger)">${all.filter(late).length}</div><div class="k-sub">Điện, PCCC: 24 giờ · khác: 3 ngày</div></div>
      <div class="card kpi"><div class="k-label">Vượt cấp lên phường</div><div class="k-value">${all.filter(i => i.escalated).length}</div><div class="k-sub">Lãnh đạo phường theo dõi</div></div>
      <div class="card kpi"><div class="k-label">Hài lòng của tiểu thương</div><div class="k-value">${done.length ? (U.sum(done, i => i.rating) / done.length).toFixed(1) : '–'}/5</div><div class="k-sub">${done.length} lượt đánh giá</div></div></div>
    <div class="card"><div class="card-h"><h3>Bảng theo dõi xử lý (6 trạng thái)</h3>
      <select class="input" data-ch="inc-cat"><option value="">Mọi nhóm</option>${cats.map(c => `<option ${ui.incCat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      ${A.canDo('su-co.tao-phan-anh', ui.market) ? '<button class="btn primary" data-act="inc-new">+ Tạo phản ánh</button>' : ''}</div>
      <div class="card-b"><div class="kanban">${ST.map(s => {
        const xs = all.filter(i => i.state === s.id);
        return `<div class="kcol"><h4>${s.label}<span class="muted">${xs.length}</span></h4>${xs.map(i => `<div class="kcard ${late(i) ? 'late' : ''}" data-act="inc-open" data-id="${i.id}">
          <div class="row small"><span class="muted">${i.id}</span>${i.escalated ? '<span class="tag purple">Vượt cấp</span>' : ''}${late(i) ? '<span class="tag danger">Quá hạn</span>' : ''}</div>
          <div class="t">${U.esc(i.title)}</div><div class="small muted">${i.cat} · ${A.idx.stall.get(i.stallId).code} · ${U.mShort(i.market)}</div>
          <div class="small muted">${U.icon(i.source === 'Mini app tiểu thương' ? 'phone' : 'dashboard')} ${U.dmy(i.created)}${i.assignee ? ' · ' + U.esc(U.staffName(i.assignee)) : ''}</div></div>`).join('')}</div>`;
      }).join('')}</div></div></div>`;
  };
  A.CH['inc-cat'] = el => { ui.incCat = el.value; A.render(); };
  A.ACT['inc-open'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id), t = A.idx.trader.get(i.traderId);
    const idx = ST.findIndex(s => s.id === i.state), next = ST[idx + 1];
    const canPhanCong = A.canDo('su-co.phan-cong', i.market);
    const canVuotCap = A.canDo('su-co.vuot-cap', i.market);
    const canChiDao = A.canDo('su-co.chi-dao', i.market);
    const canChuyenTT = A.canDo('su-co.chuyen-trang-thai', i.market);
    A.modal(A.mHead(i.id + ' · ' + U.esc(i.title)) + `<div class="modal-b">
      <dl class="kv"><dt>Trạng thái</dt><dd><span class="tag info">${stLabel(i.state)}</span> ${late(i) ? '<span class="tag danger">Quá hạn</span>' : ''} ${i.escalated ? '<span class="tag purple">Vượt cấp</span>' : ''}</dd>
        <dt>Nhóm</dt><dd>${i.cat}</dd><dt>Nguồn</dt><dd>${i.source}</dd>
        <dt>Tiểu thương</dt><dd>${U.esc(t ? t.name : '')} · ${A.idx.stall.get(i.stallId).code} · ${U.mShort(i.market)}</dd>
        <dt>Tiếp nhận / hạn</dt><dd>${U.dmy(i.created)} · hạn ${U.dmy(i.deadline)}</dd>
        ${i.desc ? `<dt>Nội dung</dt><dd>${U.esc(i.desc)}</dd>` : ''}${i.photo ? '<dt>Ảnh</dt><dd><span class="tag info">' + U.icon('camera') + ' 1 ảnh đính kèm</span></dd>' : ''}
        <dt>Người xử lý</dt><dd>${canPhanCong ? `<select class="input" data-ch="inc-assign" data-id="${i.id}"><option value="">– Chưa phân công –</option>${D.STAFF.filter(s => s.market === i.market).map(s => `<option value="${s.id}" ${i.assignee === s.id ? 'selected' : ''}>${s.name} (${s.role})</option>`).join('')}</select>` : U.esc(U.staffName(i.assignee) || 'Chưa phân công')}</dd>
        ${i.rating ? `<dt>Đánh giá</dt><dd>${'★'.repeat(i.rating)}${'☆'.repeat(5 - i.rating)}</dd>` : ''}</dl>
      <div class="divider"></div><b class="small">Nhật ký xử lý</b>${i.log.map(l => `<div class="small"><span class="muted">${U.dmy(l.at)}</span> · ${U.esc(l.text)}</div>`).join('')}
      ${canChiDao && i.escalated ? '<div class="field" style="margin-top:12px"><label>Ý kiến chỉ đạo của lãnh đạo phường</label><textarea class="input" id="inc-cmt" rows="2" placeholder="VD: Giao BQL phối hợp Công an phường xử lý trong 2 ngày"></textarea></div>' : ''}
      </div><div class="modal-f">
      ${canVuotCap && !i.escalated && isOpen(i) ? `<button class="btn" data-act="inc-escalate" data-id="${i.id}">Chuyển vượt cấp lên phường</button>` : ''}
      ${canChiDao && i.escalated ? `<button class="btn primary" data-act="inc-comment" data-id="${i.id}">Gửi ý kiến chỉ đạo</button>` : ''}
      ${canChuyenTT && next ? `<button class="btn primary" data-act="inc-next" data-id="${i.id}">Chuyển sang: ${next.label}</button>` : ''}
      <button class="btn" data-act="close">Đóng</button></div>`, true);
  };
  function incLog(i, text) { i.log.push({ at: U.today(), text }); A.save(); }
  A.CH['inc-assign'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id);
    if (!i || !A.canDo('su-co.phan-cong', i.market)) { A.render(); return; }
    i.assignee = el.value || null;
    if (i.assignee && i.state === 'tiepnhan') i.state = 'phancong';
    incLog(i, 'Phân công ' + U.staffName(i.assignee));
    A.render(); A.ACT['inc-open']({ dataset: { id: i.id } });
    U.toast('Đã phân công, thông báo gửi tới ' + U.staffName(i.assignee));
  };
  A.ACT['inc-next'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id);
    if (!i || !A.canDo('su-co.chuyen-trang-thai', i.market)) return;
    const n = ST[ST.findIndex(s => s.id === i.state) + 1];
    if (!n) return;
    if (n.id === 'phancong' && !i.assignee) i.assignee = i.market === 'TTD' ? 'NV06' : 'NV05';
    i.state = n.id; incLog(i, 'Chuyển trạng thái: ' + n.label);
    A.render(); A.ACT['inc-open']({ dataset: { id: i.id } });
    if (n.id === 'hoanthanh') U.toast('Đã hoàn thành – tiểu thương nhận thông báo và được mời đánh giá');
  };
  A.ACT['inc-escalate'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id);
    if (!i || !A.canDo('su-co.vuot-cap', i.market) || i.escalated || !isOpen(i)) return;
    i.escalated = true; incLog(i, 'Chuyển vượt cấp lên UBND phường');
    A.render(); A.closeModal(); U.toast('Đã chuyển ' + i.id + ' lên cổng giám sát cấp phường');
  };
  A.ACT['inc-comment'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id);
    if (!i || !A.canDo('su-co.chi-dao', i.market) || !i.escalated) return;
    const txt = (A.$('#inc-cmt').value || '').trim();
    if (!txt) { U.toast('Vui lòng nhập ý kiến chỉ đạo'); return; }
    incLog(i, 'Lãnh đạo phường chỉ đạo: ' + txt);
    A.closeModal(); U.toast('Đã gửi ý kiến chỉ đạo tới Ban Quản lý chợ');
  };
  A.ACT['inc-new'] = () => {
    if (!A.canDo('su-co.tao-phan-anh', ui.market)) return;
    const stalls = A.db.stalls.filter(s => s.traderId && U.inM(s)).slice(0, 200);
    A.modal(A.mHead('Tạo phản ánh / sự cố') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Điểm kinh doanh</label><select class="input" id="in-stall">${stalls.map(s => `<option value="${s.id}">${s.code} · ${U.esc(A.idx.trader.get(s.traderId).name)}</option>`).join('')}</select></div>
      <div class="field"><label>Nhóm</label><select class="input" id="in-cat">${['Điện', 'Cấp thoát nước', 'Vệ sinh', 'An ninh trật tự', 'PCCC', 'Hạ tầng', 'Khác'].map(c => `<option>${c}</option>`).join('')}</select></div></div>
      <div class="field" style="margin-top:12px"><label>Tiêu đề</label><input class="input" id="in-title" placeholder="VD: Đèn lối đi dãy B bị hỏng"></div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inc-new-save">Tạo</button></div>`);
  };
  A.addIncident = function (stallId, cat, title, desc, source, photo) {
    const st = A.idx.stall.get(stallId);
    const created = U.today();
    const photos = Array.isArray(photo) ? photo.slice(0, 3) : [];
    const i = { id: 'SC-' + U.pad(101 + A.db.incidents.length, 4), market: st.market, stallId, traderId: st.traderId, cat, title, desc: desc || '', photo: Array.isArray(photo) ? photos.length > 0 : !!photo, state: 'tiepnhan', source, escalated: false, created, deadline: incDefaultDeadline(cat, created, false), assignee: null, rating: null, log: [{ at: created, text: 'Tiếp nhận phản ánh từ ' + source }] };
    if (photos.length) i.images = { report: photos };
    A.db.incidents.push(i); A.save();
    return i;
  };
  A.ACT['inc-new-save'] = () => {
    if (!A.canDo('su-co.tao-phan-anh', ui.market)) return;
    const title = A.$('#in-title').value.trim();
    if (!title) { U.toast('Vui lòng nhập tiêu đề'); return; }
    const st = A.idx.stall.get(A.$('#in-stall').value);
    if (!st || st.market !== ui.market) { U.toast('Điểm kinh doanh không thuộc chợ đang chọn'); return; }
    const i = A.addIncident(st.id, A.$('#in-cat').value, title, '', 'Nhập tại Ban Quản lý', false);
    A.closeModal(); A.render(); U.toast('Đã tạo ' + i.id);
  };

  // ---------- Incident workflow V2 ----------
  // Reuses A.db.incidents; fields below are additive and retain the V1 log for compatibility.
  const incNow = () => U.today() + 'T' + (U.nowTime ? U.nowTime() : '09:00');
  const incFmt = value => value ? String(value).replace('T', ' · ') : '—';
  const incAsset = i => (A.db.marketAssets || []).find(a => a.id === i.assetId);
  const incStaff = i => U.staffName(i.assignee) || 'Chưa phân công';
  const incOverdueDays = i => Math.max(0, U.days(i.deadline, U.today()));
  const incAssets = () => (A.db.marketAssets || []).filter(a => a.market === ui.market);
  const incCats = () => ['Điện', 'Cấp thoát nước', 'Vệ sinh', 'An ninh trật tự', 'PCCC', 'Hạ tầng', 'Khác'];
  const incUrgentCats = new Set(['Điện', 'PCCC']);
  const incDeadlineDays = cat => incUrgentCats.has(cat) ? 1 : 3;
  const incDefaultDeadline = (cat, base, withTime) => {
    const s = String(base || U.today()).slice(0, 10);
    const d = new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
    d.setDate(d.getDate() + incDeadlineDays(cat));
    const day = d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
    return withTime ? day + 'T17:00' : day;
  };
  const incDeadlineRuleText = cat => incUrgentCats.has(cat) ? 'Điện/PCCC: 1 ngày' : 'Nhóm khác: 3 ngày';
  const incDeadlineMin = i => {
    const s = String((i && i.created) || U.today());
    return (s.indexOf('T') !== -1 ? s.slice(0, 16) : s.slice(0, 10) + 'T00:00');
  };
  const incDeadlineMax = (cat, i) => incDefaultDeadline(cat, (i && i.created) || U.today(), true);
  const incValidateDeadline = (i, cat, due) => {
    const min = incDeadlineMin(i), max = incDeadlineMax(cat, i);
    if (!due) return 'Vui lòng nhập hạn xử lý.';
    if (due < min) return 'Hạn xử lý không được trước thời gian tiếp nhận phản ánh.';
    if (due > max) return 'Hạn xử lý vượt quy định nghiệp vụ (' + incDeadlineRuleText(cat) + ', tối đa ' + incFmt(max) + ').';
    return '';
  };
  const incCanAssignMarket = market => A.canDo('su-co.phan-cong', market);
  const incCanUpdateMarket = market => A.canDo('su-co.cap-nhat-xu-ly', market);
  const incCanAssignedQueue = () =>
    A.canDo('su-co.cap-nhat-xu-ly', ui.market) &&
    !A.canDo('su-co.phan-cong', ui.market) &&
    !A.canDo('su-co.tao-phan-anh', ui.market);
  const incCurrentStaffId = () => {
    const acc = A.currentAccount && A.currentAccount();
    return acc && acc.code;
  };
  const incAssignedToCurrentTech = i => !!i && i.assignee && i.assignee === incCurrentStaffId();
  const incCanView = i => !!i && U.can('su-co') && i.market === ui.market && (!incCanAssignedQueue() || incAssignedToCurrentTech(i));
  const incAction = i => {
    if (incCanAssignedQueue()) {
      return ({ phancong:['inc-inspect-open','Nhận xử lý'], dangxuly:['inc-work-open','Cập nhật tiến độ'], chonghiemthu:['inc-open','Xem kết quả'], hoanthanh:['inc-open','Xem kết quả'], dong:['inc-open','Xem hồ sơ'] }[i.state]);
    }
    if (incCanAssignMarket(i.market)) {
      return ({ tiepnhan:['inc-assign-open','Tiếp nhận & phân công'], phancong:['inc-inspect-open','Kiểm tra hiện trường'], dangxuly:['inc-work-open','Cập nhật xử lý'], chonghiemthu:['inc-accept-open','Nghiệm thu hoàn thành'], hoanthanh:['inc-close-open','Đóng sự cố'], dong:['inc-open','Xem hồ sơ'] }[i.state]);
    }
    return ['inc-open', i.state === 'dong' ? 'Xem hồ sơ' : 'Xem'];
  };
  const incCan = (i, action) => {
    if (!incCanView(i)) return false;
    if (action === 'assign' || action === 'accept' || action === 'close') {
      return incCanAssignMarket(i.market);
    }
    if (!incCanUpdateMarket(i.market)) return false;
    if (!incCanAssignedQueue()) return true;
    return incAssignedToCurrentTech(i) && (i.state === 'phancong' || i.state === 'dangxuly');
  };
  function incHistory(i, action, detail) {
    (i.history || (i.history = [])).push({ at: incNow(), action, detail: detail || '' });
    (i.log || (i.log = [])).push({ at: U.today(), text: action + (detail ? ': ' + detail : '') });
  }
  function incAddLeaderReminderNotification(i) {
    if (!A.db || !A.ACCOUNTS || !i || !i.leaderReminder) return false;
    A.db.personalNotifications = Array.isArray(A.db.personalNotifications) ? A.db.personalNotifications : [];
    const accounts = (A.ACCOUNTS.list ? A.ACCOUNTS.list() : []).filter(a =>
      A.ACCOUNTS.authStatus(a) === 'ACTIVE' &&
      A.ACCOUNTS.primaryRole(a) === 'market_manager' &&
      A.allowedMarkets(a).indexOf(i.market) !== -1
    );
    let changed = false;
    accounts.forEach(account => {
      const id = 'PN-INC-OVERDUE-' + account.id + '-' + i.id;
      if (A.db.personalNotifications.some(n => n && n.id === id)) return;
      A.db.personalNotifications.unshift({
        id,
        recipientAccountId: account.id,
        type: 'OVERDUE_INCIDENT',
        title: 'Phản ánh quá hạn cần xử lý',
        message: i.id + ' · ' + (i.title || 'Phản ánh quá hạn') + ' tại ' + U.mShort(i.market),
        createdAt: i.leaderReminder.at || incNow(),
        readAt: null,
        targetRoute: 'su-co',
        targetId: i.id,
        targetMarket: i.market
      });
      changed = true;
    });
    return changed;
  }
  function incEnsureLeaderReminder(i) {
    if (!late(i)) return false;
    let changed = false;
    if (!i.leaderReminder) {
      i.leaderReminder = {
        at: incNow(),
        targetRole: 'market_manager',
        targetLabel: 'Trưởng Ban Quản lý',
        reason: 'OVERDUE_INCIDENT'
      };
      incHistory(i, 'Hệ thống nhắc Trưởng Ban Quản lý', 'Phản ánh quá hạn xử lý');
      changed = true;
    }
    return incAddLeaderReminderNotification(i) || changed;
  }
  function ensureIncidentV2() {
    let changed = false;
    (A.db.incidents || []).forEach(i => {
      if (i.state === 'hoanthanh' && i.work && !i.acceptance && !i.closeInfo) {
        i.state = 'chonghiemthu';
        if (!i.history) i.history = (i.log || []).map(x => ({ at:x.at, action:x.text, detail:'' }));
        i.history.push({ at: incNow(), action: 'Chuyển sang chờ nghiệm thu', detail: 'Cập nhật theo luồng tiếp nhận và xử lý mới.' });
        changed = true;
      }
      if (!i.history) { i.history = (i.log || []).map(x => ({ at:x.at, action:x.text, detail:'' })); changed = true; }
      if (!i.inspection) { i.inspection = null; changed = true; }
      if (!i.work) { i.work = null; changed = true; }
      if (!Array.isArray(i.workUpdates)) {
        i.workUpdates = i.work ? [{
          at: i.work.completedAt || incNow(),
          by: i.assignee || null,
          content: i.work.content || '',
          result: i.work.result || '',
          note: i.work.note || '',
          submitForAcceptance: i.state === 'chonghiemthu' || i.state === 'hoanthanh' || i.state === 'dong'
        }] : [];
        changed = true;
      }
      if (!i.acceptance) { i.acceptance = null; changed = true; }
      if (!Array.isArray(i.acceptanceHistory)) { i.acceptanceHistory = i.acceptance ? [i.acceptance] : []; changed = true; }
      if (!i.images) { i.images = { report: i.photo ? ['Ảnh phản ánh (mock)'] : [], inspection: [], work: [] }; changed = true; }
      if (!i.deadline) { i.deadline = incDefaultDeadline(i.cat, i.created || U.today(), String(i.created || '').indexOf('T') !== -1); changed = true; }
      if (incEnsureLeaderReminder(i)) changed = true;
    });
    const defs = [
      ['SC-DEMO-01','tiepnhan','Đồng hồ nước chạy bất thường','Cấp thoát nước','AST-CL-003'],
      ['SC-DEMO-02','phancong','Đèn lối đi khu B không hoạt động','Điện','AST-CL-002'],
      ['SC-DEMO-03','dangxuly','Rò nước tại tuyến chính khu A','Cấp thoát nước','AST-CL-003'],
      ['SC-DEMO-04','chonghiemthu','Kiểm tra bình chữa cháy khu A','PCCC','AST-CL-005'],
      ['SC-DEMO-05','hoanthanh','Camera cổng phụ cần hiệu chỉnh','An ninh trật tự','AST-CL-008'],
      ['SC-DEMO-06','dong','Đèn chiếu sáng khu A chập chờn','Điện','AST-CL-001']
    ];
    defs.forEach((d, n) => {
      if (A.db.incidents.some(i => i.id === d[0])) return;
      const asset = (A.db.marketAssets || []).find(a => a.id === d[4]);
      const stall = A.db.stalls.find(s => s.market === 'CL' && s.traderId);
      const created = '2026-09-' + String(8 + n).padStart(2, '0') + 'T08:20';
      const i = { id:d[0], market:'CL', stallId:stall && stall.id, traderId:stall && stall.traderId, cat:d[3], title:d[2], desc:'Phản ánh mẫu phục vụ trình diễn quy trình xử lý sự cố.', source:n % 2 ? 'Nhập tại Ban Quản lý' : 'Mini app tiểu thương', state:d[1], assetId:asset && asset.id, assignee:d[1] === 'tiepnhan' ? null : 'NV05', deadline:n === 0 ? '2026-09-10T17:00' : '2026-09-18T17:00', created, rating:d[1] === 'dong' ? 5 : null, escalated:false, images:{report:[],inspection:[],work:[]}, inspection:null, work:null, acceptance:null, history:[{at:created,action:'Tiếp nhận phản ánh',detail:'Nguồn: '+(n % 2 ? 'Nhập tại Ban Quản lý' : 'Mini app tiểu thương')}], log:[] };
      if (['dangxuly','chonghiemthu','hoanthanh','dong'].includes(d[1])) i.inspection = { at:'2026-09-12T09:15', by:'NV05', condition:'Kiểm tra tại hiện trường, đã xác định nguyên nhân cần xử lý.', note:'Ghi nhận kỹ thuật mẫu.' };
      if (['chonghiemthu','hoanthanh','dong'].includes(d[1])) i.work = { content:'Đã thực hiện xử lý theo hiện trạng ghi nhận.', result:'Thiết bị/vị trí hoạt động bình thường sau kiểm tra.', completedAt:'2026-09-12T11:20', note:'' };
      incEnsureLeaderReminder(i);
      A.db.incidents.push(i); changed = true;
    });
    if (changed) A.save();
  }
  function incImageInput(kind) { return `<div class="inc-image-input"><input type="file" accept="image/*" multiple data-ch="inc-images" data-kind="${kind}"><div class="small muted">Hỗ trợ: JPG, PNG${kind === 'report' ? ' (tối đa 3 ảnh trong prototype)' : ''}. Ảnh chỉ preview cục bộ, không upload/lưu base64.</div><div class="inc-image-draft" data-image-list="${kind}"></div></div>`; }
  function incImages(names) { return names && names.length ? `<div class="inc-image-list">${names.map(n => `<div class="inc-image-thumb">${U.icon('camera')}<span>${U.esc(typeof n === 'string' ? n : n.name)}</span></div>`).join('')}</div>` : '<div class="empty small">Chưa có hình ảnh.</div>'; }
  function incAssetPreview(asset) { return asset ? `<div class="inc-asset-preview"><b>${U.esc(asset.code)} · ${U.esc(asset.name)}</b><span>${U.esc(asset.locationLabel)} · ${U.esc(asset.status)}</span></div>` : ''; }
  function incModal(title, body, footer) { A.modal(`<div class="modal-h inc-modal-h"><h3>${title}</h3><button class="x" data-act="close">×</button></div><div class="modal-b inc-modal-b">${body}</div><div class="modal-f inc-modal-f">${footer}</div>`, true); }
  function incHeader(i) { return `<div class="inc-case"><b>${i.id}</b><span>${U.esc(i.title)}</span></div>`; }
  function incReadonly(i) { const st=A.idx.stall.get(i.stallId)||{}, t=A.idx.trader.get(i.traderId), imgs=(i.images||{}).report||[]; return `<section class="inc-section"><h4>Thông tin phản ánh</h4><dl class="kv"><dt>Nguồn</dt><dd>${U.esc(i.source)}</dd><dt>Người phản ánh</dt><dd>${U.esc(t ? t.name : (i.reporterName || '—'))}</dd><dt>Điểm kinh doanh</dt><dd>${U.esc(st.code || '—')}</dd><dt>Thời gian tiếp nhận</dt><dd>${incFmt(i.created)}</dd><dt>Nội dung</dt><dd>${U.esc(i.desc || '—')}</dd></dl></section><section class="inc-section"><h4>Hình ảnh phản ánh</h4>${incImages(imgs)}</section>`; }
  function incDetail(i) {
    const tab=ui.incDetailTab||'overview', a=incAsset(i), st=A.idx.stall.get(i.stallId)||{}, t=A.idx.trader.get(i.traderId), action=incAction(i);
    let body='';
    if(tab==='overview') body=`<dl class="kv"><dt>Mã sự cố</dt><dd>${i.id}</dd><dt>Tên sự cố</dt><dd>${U.esc(i.title)}</dd><dt>Trạng thái</dt><dd><span class="tag info">${stLabel(i.state)}</span>${late(i)?` <span class="tag danger">Quá hạn ${incOverdueDays(i)} ngày</span>`:''}${i.leaderReminder?' <span class="tag warn">Đã nhắc Trưởng BQL</span>':''}</dd><dt>Nhóm</dt><dd>${U.esc(i.cat)} <span class="small muted">(${incDeadlineRuleText(i.cat)})</span></dd><dt>Nguồn</dt><dd>${U.esc(i.source)}</dd><dt>Người phản ánh</dt><dd>${U.esc(t?t.name:'—')}</dd><dt>Điểm KD</dt><dd>${U.esc(st.code||'—')}</dd><dt>Ngày tiếp nhận</dt><dd>${incFmt(i.created)}</dd><dt>Hạn xử lý</dt><dd>${incFmt(i.deadline)}</dd>${i.leaderReminder?`<dt>Nhắc quá hạn</dt><dd>Hệ thống đã nhắc ${U.esc(i.leaderReminder.targetLabel)} lúc ${incFmt(i.leaderReminder.at)}</dd>`:''}<dt>Người xử lý</dt><dd>${U.esc(incStaff(i))}</dd></dl>${a?`<section class="inc-section"><h4>Tài sản liên quan</h4>${incAssetPreview(a)}<button class="btn sm" data-act="asset-open" data-id="${a.id}">Xem tài sản</button></section>`:''}`;
    if(tab==='inspection') body=i.receive?`<dl class="kv"><dt>Thời gian nhận xử lý</dt><dd>${incFmt(i.receive.at)}</dd><dt>Người xử lý</dt><dd>${U.esc(U.staffName(i.receive.by))}</dd><dt>Ghi chú khi nhận</dt><dd>${U.esc(i.receive.note||'—')}</dd></dl>${i.inspection?`<div class="divider"></div><dl class="kv"><dt>Kiểm tra hiện trường</dt><dd>${U.esc(i.inspection.condition||'—')}</dd><dt>Ghi chú kỹ thuật</dt><dd>${U.esc(i.inspection.note||'—')}</dd></dl>${incImages(i.images.inspection)}`:''}`:(i.inspection?`<dl class="kv"><dt>Thời gian kiểm tra</dt><dd>${incFmt(i.inspection.at)}</dd><dt>Người xử lý</dt><dd>${U.esc(U.staffName(i.inspection.by))}</dd><dt>Hiện trạng thực tế</dt><dd>${U.esc(i.inspection.condition)}</dd><dt>Ghi chú kỹ thuật</dt><dd>${U.esc(i.inspection.note||'—')}</dd></dl>${incImages(i.images.inspection)}`:'<div class="empty">Chưa có thông tin nhận xử lý.</div>');
    if(tab==='work') body=i.work?`<dl class="kv"><dt>Người xử lý</dt><dd>${U.esc(incStaff(i))}</dd><dt>Nội dung xử lý</dt><dd>${U.esc(i.work.content)}</dd><dt>Kết quả sau xử lý</dt><dd>${U.esc(i.work.result)}</dd><dt>Thời gian hoàn thành</dt><dd>${incFmt(i.work.completedAt)}</dd><dt>Ghi chú</dt><dd>${U.esc(i.work.note||'—')}</dd></dl>${incImages(i.images.work)}`:'<div class="empty">Chưa có kết quả xử lý.</div>';
    if(tab==='rating') body=i.rating?`<dl class="kv"><dt>Mức đánh giá</dt><dd><span class="stars readonly">${'★'.repeat(i.rating)}${'☆'.repeat(5 - i.rating)}</span></dd><dt>Người đánh giá</dt><dd>${U.esc(t?t.name:(i.reporterName||'Tiểu thương'))}</dd><dt>Thời gian</dt><dd>${incFmt((i.feedback||{}).at)}</dd><dt>Ý kiến</dt><dd>${U.esc((i.feedback||{}).comment||'—')}</dd></dl>`:'<div class="empty">Tiểu thương chưa đánh giá kết quả sau phản ánh.</div>';
    if(tab==='images') body=`<section class="inc-section"><h4>Ảnh phản ánh</h4>${incImages(i.images.report)}</section><section class="inc-section"><h4>Ảnh kiểm tra hiện trường</h4>${incImages(i.images.inspection)}</section><section class="inc-section"><h4>Ảnh sau xử lý</h4>${incImages(i.images.work)}</section>`;
    if(tab==='history') body=`<div class="inc-timeline">${(i.history||[]).map(h=>`<div class="inc-timeline-i"><b>${incFmt(h.at)}</b><strong>${U.esc(h.action)}</strong>${h.detail?`<span>${U.esc(h.detail)}</span>`:''}</div>`).join('')}</div>`;
    const permissionAction = i.state === 'tiepnhan' ? 'assign' : (i.state === 'chonghiemthu' ? 'accept' : (i.state === 'hoanthanh' ? 'close' : 'field'));
    return `<div class="drawer-h"><div><h3>${i.id} · ${U.esc(i.title)}</h3><div class="small muted"><span class="tag info">${stLabel(i.state)}</span>${late(i)?' <span class="tag danger">Quá hạn '+incOverdueDays(i)+' ngày</span>':''}${i.leaderReminder?' <span class="tag warn">Đã nhắc Trưởng BQL</span>':''}</div></div><span class="spacer"></span>${!ui.incReadOnlyDetail&&action&&i.state!=='dong'&&incCan(i,permissionAction)?`<button class="btn primary" data-act="${action[0]}" data-id="${i.id}">${action[1]}</button>`:''}<button class="x" data-act="close">×</button></div><div class="drawer-b"><div class="seg asset-tabs">${[['overview','Tổng quan'],['inspection','Kiểm tra'],['work','Xử lý'],['rating','Đánh giá'],['images','Hình ảnh'],['history','Nhật ký']].map(x=>`<button class="${tab===x[0]?'on':''}" data-act="inc-detail-tab" data-id="${i.id}" data-tab="${x[0]}">${x[1]}</button>`).join('')}</div><div class="inc-detail-content">${body}</div></div><div class="drawer-f"><button class="btn" data-act="close">Đóng</button></div>`;
  }
  function openIncident(i) { if(!i)return; ui.incDetailTab=ui.incDetailTab||'overview'; A.$('#modal-root').innerHTML=`<div class="drawer-overlay" data-act="close"></div><div class="drawer inc-detail-drawer">${incDetail(i)}</div>`; }
  function incPermissionAction(i) {
    return i.state === 'tiepnhan' ? 'assign' : (i.state === 'chonghiemthu' ? 'accept' : (i.state === 'hoanthanh' ? 'close' : 'field'));
  }
  function incCanManageComplaints() {
    return A.canDo('su-co.tao-phan-anh', ui.market) && A.canDo('su-co.phan-cong', ui.market);
  }
  function incRoleContext() {
    if (incCanAssignedQueue()) return 'tech';
    if (incCanManageComplaints()) return 'manager';
    if (A.canDo('su-co.chi-dao', ui.market)) return 'leader';
    return 'viewer';
  }
  function incRoleTitle(ctx) {
    if (ctx === 'tech') return 'Công việc kỹ thuật được giao';
    if (ctx === 'leader') return 'Giám sát phản ánh & sự cố';
    return 'Phản ánh & sự cố';
  }
  function incRoleDesc(ctx, marketName) {
    if (ctx === 'tech') return 'Nhận xử lý, cập nhật tiến độ và gửi kết quả chờ nghiệm thu cho phản ánh đã được phân công tại ' + marketName + '.';
    if (ctx === 'manager') return 'Tiếp nhận, phân công, nghiệm thu và theo dõi xử lý phản ánh tại ' + marketName + '.';
    if (ctx === 'leader') return 'Theo dõi phản ánh quá hạn, vượt cấp và kết quả xử lý tại ' + marketName + '.';
    return 'Theo dõi tình hình phản ánh, quá hạn và kết quả xử lý tại ' + marketName + '.';
  }
  function incKpisHtml(all, ctx) {
    const open = all.filter(isOpen);
    const overdue = all.filter(late);
    const waiting = all.filter(i => i.state === 'chonghiemthu');
    const intake = all.filter(i => i.state === 'tiepnhan');
    const reminded = overdue.filter(i => i.leaderReminder);
    const escalated = all.filter(i => i.escalated);
    const needsAction = ctx === 'tech'
      ? all.filter(i => i.state === 'phancong' || i.state === 'dangxuly')
      : (ctx === 'manager' ? intake : overdue);
    return `<div class="kpis inc-kpis">
      <div class="card kpi"><div class="k-label">${ctx === 'tech' ? 'Đang mở của tôi' : 'Đang mở'}</div><div class="k-value">${open.length}</div><div class="k-sub">trên tổng ${all.length} hồ sơ</div></div>
      <div class="card kpi"><div class="k-label">Quá hạn</div><div class="k-value" style="color:var(--danger)">${overdue.length}</div><div class="k-sub">Điện/PCCC 1 ngày · nhóm khác 3 ngày</div></div>
      <div class="card kpi"><div class="k-label">${ctx === 'leader' ? 'Vượt cấp' : 'Chờ nghiệm thu'}</div><div class="k-value">${ctx === 'leader' ? escalated.length : waiting.length}</div><div class="k-sub">${ctx === 'leader' ? 'cần theo dõi cấp phường' : 'chờ Tổ trưởng xác nhận'}</div></div>
      <div class="card kpi"><div class="k-label">${ctx === 'manager' ? 'Tiếp nhận' : (ctx === 'tech' ? 'Cần thao tác' : 'Đã nhắc BQL')}</div><div class="k-value">${ctx === 'leader' ? reminded.length : needsAction.length}</div><div class="k-sub">${ctx === 'leader' ? 'hồ sơ quá hạn đã nhắc' : 'hồ sơ cần xử lý tiếp'}</div></div>
    </div>`;
  }
  function incAvatar(name) {
    const text = String(name || '?').trim();
    const parts = text.split(/\s+/).filter(Boolean);
    const initials = (parts.length > 1 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : text.slice(0, 2)).toUpperCase();
    return `<span class="inc-avatar" title="${U.esc(text)}">${U.esc(initials)}</span>`;
  }
  function incIssueIcon(i) {
    const cls = i.escalated ? 'escalated' : (incUrgentCats.has(i.cat) ? 'urgent' : 'normal');
    const icon = i.escalated || incUrgentCats.has(i.cat) ? 'warning' : 'bell';
    return `<span class="inc-issue-icon ${cls}">${U.icon(icon)}</span>`;
  }
  function incBoardToolbarHtml(rows, options) {
    const opts = options || {};
    const assignees = Array.from(new Set(rows.map(i => i.assignee).filter(Boolean))).slice(0, 5);
    return `<div class="inc-board-toolbar">
      <div class="inc-board-search"><input class="input" data-in="inc-code-search" placeholder="Tìm mã hoặc nội dung" value="${U.esc(ui.incCodeSearch || '')}"></div>
      <div class="inc-board-people">${assignees.map(id => incAvatar(U.staffName(id) || id)).join('')}${assignees.length ? '' : '<span class="small muted">Chưa có người xử lý</span>'}</div>
      <span class="spacer"></span>
      <div class="inc-board-meta"><span class="small muted">Nhóm theo</span><button class="btn sm" type="button">Trạng thái</button></div>
    </div>`;
  }
  function incWorkflowBoardHtml(rows, options) {
    const opts = options || {}, readOnly = !!opts.readOnly;
    const states = opts.states || ST;
    const code = String(ui.incCodeSearch || '').trim().toLowerCase();
    const filtered = rows.filter(i => !code || String(i.id || '').toLowerCase().indexOf(code) !== -1 || String(i.title || '').toLowerCase().indexOf(code) !== -1);
    const rowSet = new Set(filtered.map(i => i.id));
    return `${incBoardToolbarHtml(rows)}<div class="kanban inc-jira-board" role="list">${states.map(s => {
      const xs = (A.db.incidents || []).filter(i => rowSet.has(i.id) && i.state === s.id);
      return `<div class="kcol inc-jira-col" role="listitem"><h4>${U.esc(s.label)}<span class="muted">${xs.length}</span></h4>${xs.map(i => {
        const st = A.idx.stall.get(i.stallId) || {}, a = incAsset(i), act = incAction(i), permissionAction = incPermissionAction(i);
        const canAct = !readOnly && act && act[0] !== 'inc-open' && incCan(i, permissionAction);
        const source = i.source === 'Mini app tiểu thương' ? 'Mini app' : (i.source || 'Ban Quản lý');
        return `<div class="kcard inc-jira-card ${late(i) ? 'late' : ''}" data-act="inc-open" data-id="${i.id}" data-readonly="${readOnly ? '1' : '0'}">
          <div class="t">${U.esc(i.title)}</div>
          <div class="inc-card-loc small muted">${U.esc(i.cat)} · ${U.esc(st.code || '—')}${a ? ' · ' + U.esc(a.code) : ''}</div>
          <div class="inc-card-foot">
            <span class="inc-code">${incIssueIcon(i)}${U.esc(i.id)}</span>
            ${late(i) ? '<span class="inc-pill danger">Quá hạn</span>' : ''}
            ${i.escalated ? '<span class="inc-pill purple">Vượt cấp</span>' : ''}
            <span class="spacer"></span>
            <span class="inc-card-source">${U.esc(source)}</span>
            ${i.assignee ? incAvatar(U.staffName(i.assignee)) : ''}
          </div>
          <div class="inc-card-actions">
            <button class="btn sm" data-act="inc-open" data-id="${i.id}" data-readonly="${readOnly ? '1' : '0'}">Xem</button>
            ${canAct ? `<button class="btn sm primary" data-act="${act[0]}" data-id="${i.id}">${act[1]}</button>` : ''}
          </div>
        </div>`;
      }).join('') || '<div class="empty small">Không có hồ sơ.</div>'}</div>`;
    }).join('')}</div>`;
  }
  function incLeadershipLegacyBoardHtml() {
    const all = A.db.incidents.filter(i => incCanView(i) && (!ui.incCat || i.cat === ui.incCat));
    const cats = Array.from(new Set((A.db.incidents || []).filter(i => i.market === ui.market).map(i => i.cat)));
    const done = all.filter(i => i.rating);
    const states = [
      { id: 'tiepnhan', label: 'Chưa phân công' },
      { id: 'phancong', label: 'Phân công' },
      { id: 'dangxuly', label: 'Đang xử lý' },
      { id: 'chonghiemthu', label: 'Chờ nghiệm thu' },
      { id: 'hoanthanh', label: 'Hoàn thành' },
      { id: 'dong', label: 'Đóng' }
    ];
    return `<div class="kpis">
      <div class="card kpi"><div class="k-label">Đang xử lý</div><div class="k-value">${all.filter(isOpen).length}</div><div class="k-sub">trên tổng ${all.length} phản ánh</div></div>
      <div class="card kpi"><div class="k-label">Quá hạn</div><div class="k-value" style="color:var(--danger)">${all.filter(late).length}</div><div class="k-sub">Điện, PCCC: 24 giờ · khác: 3 ngày</div></div>
      <div class="card kpi"><div class="k-label">Vượt cấp lên phường</div><div class="k-value">${all.filter(i => i.escalated).length}</div><div class="k-sub">Lãnh đạo phường theo dõi</div></div>
      <div class="card kpi"><div class="k-label">Hài lòng của tiểu thương</div><div class="k-value">${done.length ? (U.sum(done, i => i.rating) / done.length).toFixed(1) : '–'}/5</div><div class="k-sub">${done.length} lượt đánh giá</div></div></div>
    <div class="card"><div class="card-h"><h3>Bảng theo dõi xử lý</h3>
      <select class="input" data-ch="inc-cat"><option value="">Mọi nhóm</option>${cats.map(c => `<option ${ui.incCat === c ? 'selected' : ''}>${U.esc(c)}</option>`).join('')}</select></div>
      <div class="card-b">${incWorkflowBoardHtml(all, { readOnly: true, states })}</div></div>`;
  }
  function incFlowTabs(all) {
    const mk = (id, label, states, predicate) => ({ id, label, states, predicate, count: 0 });
    let tabs;
    if (incCanAssignedQueue()) {
      tabs = [
        mk('assigned', 'Phân công', ['phancong']),
        mk('doing', 'Đang xử lý', ['dangxuly']),
        mk('waiting-acceptance', 'Chờ nghiệm thu', ['chonghiemthu']),
        mk('done', 'Hoàn thành / Đóng', ['hoanthanh', 'dong']),
        mk('all', 'Tất cả', null)
      ];
    } else if (incCanManageComplaints()) {
      tabs = [
        mk('list', 'Bảng xử lý phản ánh', null),
        mk('assign', 'Phân công xử lý phản ánh', ['tiepnhan']),
        mk('accept', 'Chờ nghiệm thu', ['chonghiemthu']),
        mk('overdue', 'Theo dõi phản ánh quá hạn', null, late),
        mk('results', 'Xem kết quả phản ánh', null, i => !!i.work || i.state === 'chonghiemthu' || i.state === 'hoanthanh' || i.state === 'dong')
      ];
    } else if (A.canDo('su-co.chi-dao', ui.market)) {
      tabs = [
        mk('overdue', 'Quá hạn', null, late),
        mk('escalated', 'Vượt cấp', null, i => !!i.escalated),
        mk('open', 'Đang mở', ['tiepnhan', 'phancong', 'dangxuly', 'chonghiemthu', 'hoanthanh']),
        mk('done', 'Đã đóng', ['dong']),
        mk('all', 'Tất cả', null)
      ];
    } else {
      tabs = [
        mk('intake', 'Tiếp nhận', ['tiepnhan']),
        mk('assign', 'Đã phân công', ['phancong']),
        mk('processing', 'Đang xử lý', ['dangxuly']),
        mk('completed', 'Chờ nghiệm thu / Hoàn thành / Đóng', ['chonghiemthu', 'hoanthanh', 'dong']),
        mk('all', 'Tất cả', null)
      ];
    }
    tabs.forEach(t => { t.count = all.filter(i => incTabMatch(i, t)).length; });
    return tabs;
  }
  function incTabMatch(i, tab) {
    if (!tab || tab.id === 'all') return true;
    if (tab.predicate) return tab.predicate(i);
    return tab.states ? tab.states.indexOf(i.state) !== -1 : true;
  }
  function incTabBar(tabs, active) {
    return `<div class="seg inc-flow-tabs">${tabs.map(t => `<button class="${active===t.id?'on':''}" data-act="inc-flow-tab" data-id="${t.id}">${t.label} <span>${t.count}</span></button>`).join('')}</div>`;
  }
  function incFunctionNav(tabs, active) {
    return `<div class="inc-function-nav">${tabs.map(t => `<button class="${active===t.id?'on':''}" data-act="inc-flow-tab" data-id="${t.id}">
      <b>${t.label}</b><small>${t.count} hồ sơ</small>
    </button>`).join('')}</div>`;
  }
  function incWorkflowHint() {
    if (incCanManageComplaints()) return '';
    if (!incCanAssignedQueue()) return '';
    const steps = ['Phân công', 'Nhận xử lý', 'Đang xử lý', 'Gửi kết quả chờ nghiệm thu', 'Hoàn thành / Đóng'];
    return `<div class="inc-flow-steps">${steps.map((s,n)=>`<span>${n+1}. ${s}</span>`).join('')}</div>`;
  }
  function incRows(rows, options) {
    const readOnly = !!(options && options.readOnly);
    const viewReadOnly = !!(options && Object.prototype.hasOwnProperty.call(options, 'viewReadOnly') ? options.viewReadOnly : readOnly);
    const hideActions = !!(options && Object.prototype.hasOwnProperty.call(options, 'hideActions') ? options.hideActions : readOnly);
    const showView = !(options && options.showView === false);
    return rows.map(i => {
      const st = A.idx.stall.get(i.stallId) || {}, a = incAsset(i), act = incAction(i), canAct = act && act[0] !== 'inc-open' && incCan(i, incPermissionAction(i));
      return `<tr>
        <td><b>${i.id}</b><div class="small muted">${incFmt(i.created)}</div></td>
        <td><b>${U.esc(i.title)}</b><div class="small muted">${U.esc(i.cat)} · ${U.esc(i.source || '')}</div></td>
        <td>${U.esc(st.code || '—')}${a ? `<div class="small muted">${U.esc(a.code)} · ${U.esc(a.name)}</div>` : ''}</td>
        <td><span class="tag info">${stLabel(i.state)}</span>${late(i)?' <span class="tag danger">Quá hạn</span>':''}${i.leaderReminder?' <span class="tag warn">Đã nhắc BQL</span>':''}${i.escalated?' <span class="tag purple">Vượt cấp</span>':''}</td>
        <td>${U.esc(incStaff(i))}<div class="small muted">Hạn: ${incFmt(i.deadline)}</div></td>
        <td class="nowrap">${showView ? `<button class="btn sm" data-act="inc-open" data-id="${i.id}" data-readonly="${viewReadOnly ? '1' : '0'}">Xem</button>` : ''}${!hideActions&&canAct?`${showView ? ' ' : ''}<button class="btn sm primary" data-act="${act[0]}" data-id="${i.id}">${act[1]}</button>`:''}</td>
      </tr>`;
    });
  }
  function incTechPriorityTag(i) {
    if (late(i)) return '<span class="tag danger">Cao</span>';
    if (incUrgentCats.has(i.cat)) return '<span class="tag warn">Cao</span>';
    return '<span class="tag info">Bình thường</span>';
  }
  function incTechStateTag(i) {
    const cls = i.state === 'hoanthanh' || i.state === 'dong' ? 'ok' : (late(i) ? 'danger' : (i.state === 'dangxuly' || i.state === 'chonghiemthu' ? 'warn' : 'info'));
    return `<span class="tag ${cls}">${stLabel(i.state)}</span>`;
  }
  function incTechDetailPanel(i) {
    if (!i) return `<aside class="card inc-tech-detail"><div class="card-b"><div class="empty">Chọn một công việc để xem chi tiết xử lý.</div></div></aside>`;
    const st = A.idx.stall.get(i.stallId) || {}, t = A.idx.trader.get(i.traderId), a = incAsset(i), action = incAction(i);
    const canAct = action && action[0] !== 'inc-open' && incCan(i, incPermissionAction(i));
    const footer = canAct
      ? `<button class="btn primary" data-act="${action[0]}" data-id="${i.id}">${action[1]}</button><button class="btn" data-act="inc-open" data-id="${i.id}" data-readonly="1">Xem hồ sơ đầy đủ</button>`
      : `<button class="btn primary" data-act="inc-open" data-id="${i.id}" data-readonly="1">${action && action[1] ? action[1] : 'Xem hồ sơ'}</button>`;
    const images = (i.images && i.images.report || []).concat(i.images && i.images.inspection || [], i.images && i.images.work || []);
    return `<aside class="card inc-tech-detail">
      <div class="inc-tech-detail-h">
        <div><span class="small muted">Chi tiết phản ánh</span><h3>${U.esc(i.title)}</h3><div class="small muted">${i.id} · ${incFmt(i.created)}</div></div>
        ${incTechPriorityTag(i)}
      </div>
      <div class="inc-tech-detail-tabs">
        <button class="on">Thông tin</button><button>Địa điểm</button><button>Hình ảnh (${images.length})</button><button>Trao đổi (${(i.history || []).length})</button>
      </div>
      <div class="inc-tech-detail-b">
        <dl class="inc-tech-kv">
          <dt>Người gửi</dt><dd>${U.esc(t ? t.name : (i.reporterName || '—'))}${t && t.phone ? `<small>${U.maskPhone(t.phone)}</small>` : ''}</dd>
          <dt>Nhóm vấn đề</dt><dd>${U.esc(i.cat)}</dd>
          <dt>Vị trí</dt><dd>${U.esc(st.code || '—')}${a ? `<small>${U.esc(a.locationLabel || a.name)}</small>` : ''}</dd>
          <dt>Thời gian gửi</dt><dd>${incFmt(i.created)}</dd>
          <dt>Hạn xử lý</dt><dd>${incFmt(i.deadline)}${late(i) ? `<small class="danger-text">Quá hạn ${incOverdueDays(i)} ngày</small>` : ''}</dd>
          <dt>Trạng thái</dt><dd>${incTechStateTag(i)}</dd>
        </dl>
        <section class="inc-tech-detail-section"><h4>Nội dung phản ánh</h4><p>${U.esc(i.desc || 'Chưa có mô tả chi tiết.')}</p></section>
        <section class="inc-tech-detail-section"><h4>Cập nhật gần nhất</h4>${(i.history || []).slice(-3).reverse().map(h => `<div class="inc-tech-history"><b>${U.esc(h.action)}</b><span>${incFmt(h.at)}${h.detail ? ' · ' + U.esc(h.detail) : ''}</span></div>`).join('') || '<div class="empty small">Chưa có cập nhật.</div>'}</section>
      </div>
      <div class="inc-tech-detail-f">${footer}</div>
    </aside>`;
  }
  function incTechRows(rows) {
    return rows.length ? `<div class="inc-tech-list">${rows.map(i => {
      const st = A.idx.stall.get(i.stallId) || {}, a = incAsset(i);
      return `<article class="inc-tech-item ${late(i) ? 'late' : ''} ${ui.incTechSelectedId === i.id ? 'on' : ''}" data-act="inc-tech-select" data-id="${i.id}">
        <div class="inc-tech-main">
          <div class="inc-tech-code"><b>${i.id}</b><span>${incFmt(i.created)}</span></div>
          <div class="inc-tech-copy">
            <h4>${U.esc(i.title)}</h4>
            <p>${U.esc(i.cat)} · ${U.esc(i.source || '')}</p>
            <div class="inc-tech-meta">
              <span>${U.esc(st.code || 'Chưa xác định vị trí')}</span>
              ${a ? `<span>${U.esc(a.code)} · ${U.esc(a.name)}</span>` : ''}
              <span>Hạn: ${incFmt(i.deadline)}</span>
            </div>
          </div>
        </div>
        <div class="inc-tech-status">
          ${incTechStateTag(i)}${late(i)?' <span class="tag danger">Quá hạn</span>':''}${i.leaderReminder?' <span class="tag warn">Đã nhắc BQL</span>':''}
        </div>
      </article>`;
    }).join('')}</div>` : '<div class="empty">Không có công việc kỹ thuật phù hợp.</div>';
  }
  function incListFiltersHtml() {
    const stateOptions = ST.map(s => `<option value="${s.id}" ${ui.incState === s.id ? 'selected' : ''}>${s.label}</option>`).join('');
    return `<div class="row inc-list-filters" style="gap:8px;flex-wrap:wrap">
      <select class="input" data-ch="inc-state" style="min-width:180px"><option value="">Mọi trạng thái</option>${stateOptions}</select>
      <input class="input" data-in="inc-code-search" style="min-width:220px" placeholder="Tìm theo mã phản ánh" value="${U.esc(ui.incCodeSearch || '')}">
      <select class="input" data-ch="inc-cat"><option value="">Mọi nhóm</option>${incCats().map(c=>`<option ${ui.incCat===c?'selected':''}>${c}</option>`).join('')}</select>
    </div>`;
  }
  function incApplyListFilters(rows) {
    const code = String(ui.incCodeSearch || '').trim().toLowerCase();
    return rows.filter(i => (!ui.incState || i.state === ui.incState) && (!code || String(i.id || '').toLowerCase().indexOf(code) !== -1));
  }
  function incManagerIntro(tab, rows) {
    if (!incCanManageComplaints()) return '';
    if (tab.id === 'assign') return '<div class="note info" style="margin-bottom:12px"><b>Phân công xử lý phản ánh:</b> chỉ hiển thị phản ánh chưa phân công. Nút phân công vẫn kiểm tra quyền và phạm vi chợ khi lưu.</div>';
    if (tab.id === 'accept') return '<div class="note info" style="margin-bottom:12px"><b>Chờ nghiệm thu:</b> hồ sơ đã có kết quả xử lý từ nhân viên kỹ thuật, Trưởng BQL kiểm tra và xác nhận hoàn thành trước khi đóng.</div>';
    if (tab.id === 'overdue') return '<div class="note warn" style="margin-bottom:12px"><b>Theo dõi phản ánh quá hạn:</b> danh sách các phản ánh còn mở đã vượt hạn xử lý theo nhóm vấn đề.</div>';
    if (tab.id === 'results') return '<div class="note info" style="margin-bottom:12px"><b>Xem kết quả phản ánh:</b> theo dõi hồ sơ đã có kết quả xử lý, đánh giá của tiểu thương hoặc đã đóng.</div>';
    return `<div class="note info" style="margin-bottom:12px"><b>Xem danh sách phản ánh:</b> ${rows.length} phản ánh thuộc phạm vi chợ đang chọn.</div>`;
  }
  A.VIEWS['su-co'] = function () {
    ensureIncidentV2();
    const marketName = U.mShort(ui.market);
    const all = A.db.incidents.filter(i => incCanView(i) && (!ui.incCat || i.cat === ui.incCat));
    const ctx = incRoleContext();
    const tech = ctx === 'tech';
    const displayTitle = incRoleTitle(ctx);
    const displayDesc = incRoleDesc(ctx, marketName);
    // Lãnh đạo, Tổ trưởng và kỹ thuật dùng cùng renderer; quyền thao tác vẫn do incCan()/A.canDo() quyết định.
    if (ctx === 'leader') return incLeadershipLegacyBoardHtml();
    const tabs = incFlowTabs(all);
    if (!tabs.some(t => t.id === ui.incFlowTab)) ui.incFlowTab = tabs[0] && tabs[0].id;
    const tab = tabs.find(t => t.id === ui.incFlowTab) || tabs[0];
    let rows = all.filter(i => incTabMatch(i, tab));
    const useListFilters = tab && tab.id === 'list';
    if (useListFilters) rows = incApplyListFilters(rows);
    const reminderHtml = '';
    const managerIntro = incManagerIntro(tab, rows);
    const head = `<div class="page-head"><div><h2>${displayTitle}</h2><p class="muted">${displayDesc}</p></div>${ctx === 'manager' && A.canDo('su-co.tao-phan-anh', ui.market) ? '<button class="btn primary" data-act="inc-new-v2">+ Tạo phản ánh</button>' : ''}</div>
      ${incKpisHtml(all, ctx)}`;
    if (tech) {
      return `${head}
        <div class="card"><div class="card-h"><h3>${tab.label}</h3><select class="input" data-ch="inc-cat"><option value="">Mọi nhóm</option>${incCats().map(c=>`<option ${ui.incCat===c?'selected':''}>${c}</option>`).join('')}</select></div>
          <div class="card-b">${incWorkflowHint()}${incTabBar(tabs, tab.id)}${incWorkflowBoardHtml(rows)}</div></div>`;
    }
    if (!tech && incCanManageComplaints()) {
      return `${head}<div class="inc-manager-layout">
        <aside class="card inc-manager-menu"><div class="card-h"><h3>Chức năng</h3></div><div class="card-b">${incFunctionNav(tabs, tab.id)}</div></aside>
        <section class="card inc-manager-content"><div class="card-h"><h3>${tab.label}</h3>${useListFilters ? incListFiltersHtml() : `<select class="input" data-ch="inc-cat"><option value="">Mọi nhóm</option>${incCats().map(c=>`<option ${ui.incCat===c?'selected':''}>${c}</option>`).join('')}</select>`}</div>
          <div class="card-b">${reminderHtml}${managerIntro}
            ${incWorkflowBoardHtml(rows, { readOnly: tab.id === 'list' })}
          </div></section>
      </div>`;
    }
    if (!tech) {
      return `${head}
      <div class="card"><div class="card-h"><h3>${tab.label}</h3>${useListFilters ? incListFiltersHtml() : `<select class="input" data-ch="inc-cat"><option value="">Mọi nhóm</option>${incCats().map(c=>`<option ${ui.incCat===c?'selected':''}>${c}</option>`).join('')}</select>`}</div>
      <div class="card-b">${incTabBar(tabs, tab.id)}${incWorkflowBoardHtml(rows, { readOnly: true })}</div></div>`;
    }
    return `${head}
      <div class="card"><div class="card-h"><h3>${tech ? 'Danh sách xử lý kỹ thuật' : tab.label}</h3><select class="input" data-ch="inc-cat"><option value="">Mọi nhóm</option>${incCats().map(c=>`<option ${ui.incCat===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="card-b">${reminderHtml}${incWorkflowHint()}${incTabBar(tabs, tab.id)}${managerIntro}
        ${U.table([{t:'Mã / thời gian'}, {t:'Nội dung'}, {t:'Vị trí / tài sản'}, {t:'Trạng thái'}, {t:'Người xử lý / hạn'}, {t:''}], incRows(rows), { empty: tech ? 'Không có công việc kỹ thuật phù hợp.' : 'Không có phản ánh trong hàng đợi này.' })}
      </div></div>`;
  };
  function incShortSummaryHtml(all) {
    const done = all.filter(i => i.rating);
    const bits = [all.length + ' phản ánh', all.filter(late).length + ' quá hạn', all.filter(i => i.escalated).length + ' vượt cấp'];
    if (done.length) bits.push('hài lòng ' + (U.sum(done, i => i.rating) / done.length).toFixed(1) + '/5');
    return `<div class="inc-summary-line">${bits.map(x => `<span>${U.esc(x)}</span>`).join('<i></i>')}</div>`;
  }
  function incBoardGroups() {
    return [
      { id: 'todo', label: 'Cần xử lý', states: ['tiepnhan'] },
      { id: 'assigned', label: 'Đã phân công', states: ['phancong'] },
      { id: 'doing', label: 'Đang xử lý', states: ['dangxuly'] },
      { id: 'verify', label: 'Chờ xác nhận', states: ['chonghiemthu'] }
    ];
  }
  function incPriorityLabel(i) {
    if (late(i) || incUrgentCats.has(i.cat)) return 'Ưu tiên cao';
    return 'Bình thường';
  }
  function incDueHtml(i) {
    if (late(i)) return `<span class="inc-due danger">Quá hạn ${incOverdueDays(i)} ngày</span>`;
    if (incUrgentCats.has(i.cat)) return '<span class="inc-due warn">Sắp đến hạn</span>';
    return `<span class="inc-due">${incFmt(i.deadline)}</span>`;
  }
  function incQuickAction(i) {
    if (i.state === 'tiepnhan') return 'assign';
    if (i.state === 'phancong' || i.state === 'dangxuly') return 'transition';
    if (i.state === 'chonghiemthu') return 'accept';
    if (i.state === 'hoanthanh') return 'close';
    return 'field';
  }
  function incCanDrag(i, readOnly) {
    return !readOnly && i && !['hoanthanh', 'dong'].includes(i.state) && incCan(i, incQuickAction(i));
  }
  function incAllowedDrop(i, targetState) {
    if (!i || i.state === targetState) return false;
    if (i.state === 'tiepnhan' && targetState === 'phancong') return incCan(i, 'assign');
    if (i.state === 'phancong' && targetState === 'dangxuly') return incCan(i, 'transition');
    if (i.state === 'dangxuly' && targetState === 'chonghiemthu') return incCan(i, 'transition');
    if (i.state === 'chonghiemthu' && targetState === 'hoanthanh') return incCan(i, 'accept');
    return false;
  }
  function incStaffAvatar(i, editable) {
    if (!i.assignee) return `<button class="inc-assignee ${editable ? 'editable' : ''}" ${editable ? `data-act="inc-quick-assign" data-id="${i.id}"` : ''} title="Chưa phân công">Chưa phân công</button>`;
    const staff = D.STAFF.find(s => s.id === i.assignee);
    const label = (staff ? staff.name : U.staffName(i.assignee)) || i.assignee;
    const role = staff && staff.role ? ' · ' + staff.role : '';
    return `<button class="inc-assignee ${editable ? 'editable' : ''}" ${editable ? `data-act="inc-quick-assign" data-id="${i.id}"` : ''} title="${U.esc(label + role)}">${incAvatar(label)}</button>`;
  }
  function incApplyBoardFilters(rows) {
    const q = String(ui.incCodeSearch || '').trim().toLowerCase(), mine = incCurrentStaffId();
    return rows.filter(i => {
      const st = A.idx.stall.get(i.stallId) || {};
      if (q && [i.id, i.title, i.desc, i.cat].join(' ').toLowerCase().indexOf(q) === -1) return false;
      if (ui.incQuickFilter === 'mine' && (!mine || i.assignee !== mine)) return false;
      if (ui.incQuickFilter === 'late' && !late(i)) return false;
      if (ui.incQuickFilter === 'unassigned' && i.assignee) return false;
      if (ui.incQuickFilter === 'done' && !['hoanthanh', 'dong'].includes(i.state)) return false;
      if (ui.incBoardCat && i.cat !== ui.incBoardCat) return false;
      if (ui.incBoardAssignee && (ui.incBoardAssignee === '__none' ? !!i.assignee : i.assignee !== ui.incBoardAssignee)) return false;
      if (ui.incBoardArea && String(st.code || '').toLowerCase().indexOf(String(ui.incBoardArea).toLowerCase()) === -1) return false;
      if (ui.incBoardSource && i.source !== ui.incBoardSource) return false;
      if (ui.incBoardState && i.state !== ui.incBoardState) return false;
      if (ui.incBoardFrom && String(i.created || '').slice(0, 10) < ui.incBoardFrom) return false;
      if (ui.incBoardTo && String(i.created || '').slice(0, 10) > ui.incBoardTo) return false;
      return true;
    });
  }
  function incBoardToolbarHtml(rows, options) {
    const opts = options || {};
    const cats = Array.from(new Set(rows.map(i => i.cat).filter(Boolean)));
    const staffIds = Array.from(new Set(rows.map(i => i.assignee).filter(Boolean)));
    const sources = Array.from(new Set(rows.map(i => i.source).filter(Boolean)));
    const quick = id => ui.incQuickFilter === id ? 'on' : '';
    const compactFilters = !!opts.compactFilters;
    return `<div class="inc-board-top">
      <div class="inc-board-search"><input class="input" data-in="inc-code-search" placeholder="Tìm mã hoặc nội dung..." value="${U.esc(ui.incCodeSearch || '')}"></div>
      <div class="inc-quick-filters">
        ${opts.hideMineFilter ? '' : `<button class="${quick('mine')}" data-act="inc-quick-filter" data-id="mine">Của tôi</button>`}
        <button class="${quick('late')}" data-act="inc-quick-filter" data-id="late">Quá hạn</button>
        ${opts.hideUnassignedFilter ? '' : `<button class="${quick('unassigned')}" data-act="inc-quick-filter" data-id="unassigned">Chưa phân công</button>`}
        <button class="${quick('done')}" data-act="inc-quick-filter" data-id="done">${U.icon('check')} Đã hoàn thành</button>
      </div>
      <button class="btn sm" data-act="inc-toggle-filters">+ Bộ lọc</button>
      <span class="spacer"></span>
      <div class="seg inc-view-switch"><button class="${(ui.incViewMode || 'board') === 'board' ? 'on' : ''}" data-act="inc-view-mode" data-id="board">Bảng</button><button class="${ui.incViewMode === 'list' ? 'on' : ''}" data-act="inc-view-mode" data-id="list">Danh sách</button></div>
    </div>${ui.incFilterOpen ? `<div class="inc-filter-panel">
      <select class="input" data-ch="inc-board-cat"><option value="">Nhóm vấn đề</option>${cats.map(c=>`<option value="${U.esc(c)}" ${ui.incBoardCat===c?'selected':''}>${U.esc(c)}</option>`).join('')}</select>
      <select class="input" data-ch="inc-board-state"><option value="">Trạng thái</option>${ST.map(s=>`<option value="${s.id}" ${ui.incBoardState===s.id?'selected':''}>${U.esc(s.label)}</option>`).join('')}</select>
      <input class="input" data-in="inc-board-area" placeholder="Điểm/khu vực" value="${U.esc(ui.incBoardArea || '')}">
      ${compactFilters ? '' : `<select class="input" data-ch="inc-board-assignee"><option value="">Người xử lý</option><option value="__none" ${ui.incBoardAssignee==='__none'?'selected':''}>Chưa phân công</option>${staffIds.map(id=>`<option value="${id}" ${ui.incBoardAssignee===id?'selected':''}>${U.esc(U.staffName(id)||id)}</option>`).join('')}</select>`}
      ${compactFilters ? '' : `<select class="input" data-ch="inc-board-source"><option value="">Nguồn phản ánh</option>${sources.map(s=>`<option value="${U.esc(s)}" ${ui.incBoardSource===s?'selected':''}>${U.esc(s)}</option>`).join('')}</select>`}
      <input class="input" type="date" data-ch="inc-board-from" value="${U.esc(ui.incBoardFrom || '')}">
      <input class="input" type="date" data-ch="inc-board-to" value="${U.esc(ui.incBoardTo || '')}">
    </div>` : ''}`;
  }
  function incCardHtml(i, readOnly) {
    const st = A.idx.stall.get(i.stallId) || {};
    const assigneeEditable = !readOnly && incCan(i, 'assign') && (i.state === 'tiepnhan' || i.state === 'phancong');
    const stateEditable = !readOnly && incCan(i, incQuickAction(i)) && !['hoanthanh', 'dong'].includes(i.state);
    const priorityEditable = !readOnly && incCan(i, i.state === 'tiepnhan' ? 'assign' : 'transition');
    return `<article class="kcard inc-jira-card ${late(i) ? 'late' : ''}" data-act="inc-open" data-id="${i.id}" data-readonly="${readOnly ? '1' : '0'}" ${incCanDrag(i, readOnly) ? 'draggable="true" data-drag-id="' + i.id + '"' : ''}>
      <div class="inc-card-title">${U.esc(i.title)}</div>
      <div class="inc-card-tags"><span class="inc-code">${U.esc(i.id)}</span><span>${U.esc(i.cat)}</span></div>
      <div class="inc-card-loc">${U.icon('map')} ${U.esc(st.code || 'Chưa xác định')}${st.rowId ? ' · ' + U.esc(st.rowId) : ''}</div>
      <div class="inc-card-bottom">
        <button class="inc-inline ${stateEditable ? 'editable' : ''}" ${stateEditable ? `data-act="inc-quick-status" data-id="${i.id}"` : ''}>${U.esc(stLabel(i.state))}</button>
        <button class="inc-inline ${priorityEditable ? 'editable' : ''}" ${priorityEditable ? `data-act="inc-quick-priority" data-id="${i.id}"` : ''}>${U.esc(incPriorityLabel(i))}</button>
        ${incDueHtml(i)}
        <span class="spacer"></span>
        ${incStaffAvatar(i, assigneeEditable)}
      </div>
      <button class="inc-card-menu" title="Tùy chọn" data-act="inc-open" data-id="${i.id}" data-readonly="${readOnly ? '1' : '0'}">...</button>
    </article>`;
  }
  function incWorkflowBoardHtml(rows, options) {
    const opts = options || {}, readOnly = !!opts.readOnly;
    const filtered = incApplyBoardFilters(rows);
    if (ui.incViewMode === 'list') {
      return `${incBoardToolbarHtml(rows, opts)}${U.table([{t:'Mã / thời gian'}, {t:'Nội dung'}, {t:'Vị trí / tài sản'}, {t:'Trạng thái'}, {t:'Người xử lý / hạn'}, {t:''}], incRows(filtered, { readOnly: true, viewReadOnly: true }), { empty: 'Không có phản ánh phù hợp.' })}`;
    }
    const groups = opts.groups || (ui.incQuickFilter === 'done' ? [{ id: 'done', label: 'Đã hoàn thành', states: ['hoanthanh', 'dong'] }] : incBoardGroups());
    return `${incBoardToolbarHtml(rows, opts)}<div class="kanban inc-jira-board" role="list">${groups.map(g => {
      const xs = filtered.filter(i => g.states.indexOf(i.state) !== -1);
      return `<section class="kcol inc-jira-col" data-drop-state="${g.states[0]}" role="listitem"><h4><span>${U.esc(g.label)}</span><b>${xs.length}</b></h4>${xs.map(i => incCardHtml(i, readOnly)).join('') || '<div class="empty small">Không có phản ánh.</div>'}</section>`;
    }).join('')}</div>`;
  }
  function incTechBoardGroups(tab) {
    const groups = [
      { id: 'assigned', label: 'Phân công', states: ['phancong'] },
      { id: 'doing', label: 'Đang xử lý', states: ['dangxuly'] },
      { id: 'waiting-acceptance', label: 'Chờ nghiệm thu', states: ['chonghiemthu'] },
      { id: 'done', label: 'Hoàn thành / Đóng', states: ['hoanthanh', 'dong'] }
    ];
    return tab && tab.id !== 'all' ? groups.filter(g => g.id === tab.id) : groups;
  }
  function incKpisHtml(all) { return incShortSummaryHtml(all); }
  function incDetailSection(title, body) { return `<section class="inc-detail-section"><h4>${U.esc(title)}</h4>${body}</section>`; }
  function incWorkUpdatesHtml(i) {
    const xs = (i.workUpdates || []).slice().reverse();
    return xs.length ? `<div class="inc-timeline">${xs.map((x, n) => `<div class="inc-timeline-i"><b>${incFmt(x.at)}</b><strong>${x.submitForAcceptance ? 'Gửi kết quả chờ nghiệm thu' : 'Cập nhật tiến độ #' + (xs.length - n)}</strong><span>${U.esc(x.content || '')}${x.result ? '<br>Kết quả: ' + U.esc(x.result) : ''}${x.note ? '<br>Ghi chú: ' + U.esc(x.note) : ''}</span></div>`).join('')}</div>` : '<div class="empty small">Chưa có cập nhật tiến độ.</div>';
  }
  function incAcceptanceHistoryHtml(i) {
    const xs = (i.acceptanceHistory || []).slice().reverse();
    return xs.length ? `<div class="inc-timeline">${xs.map(x => `<div class="inc-timeline-i"><b>${incFmt(x.at)}</b><strong>${x.result === 'rejected' ? 'Nghiệm thu không đạt' : 'Nghiệm thu hoàn thành'}</strong>${x.note ? `<span>${U.esc(x.note)}</span>` : ''}</div>`).join('')}</div>` : '';
  }
  function incDetail(i) {
    const a = incAsset(i), st = A.idx.stall.get(i.stallId) || {}, t = A.idx.trader.get(i.traderId);
    const action = incAction(i), permissionAction = incPermissionAction(i);
    const canAct = !ui.incReadOnlyDetail && action && i.state !== 'dong' && incCan(i, permissionAction);
    const activityTab = ui.incDetailActivity || 'all';
    const history = (i.history || []).slice().reverse();
    const reporter = t ? t.name : (i.reporterName || '—');
    return `<div class="drawer-h inc-drawer-head"><div><div class="small muted">${U.esc(i.id)}</div><h3>${U.esc(i.title)}</h3></div><span class="spacer"></span>${canAct ? `<button class="btn primary" data-act="${action[0]}" data-id="${i.id}">${action[1]}</button>` : ''}<button class="btn sm" data-act="inc-open" data-id="${i.id}" data-readonly="1">...</button><button class="x" data-act="close">×</button></div>
      <div class="drawer-b inc-drawer-body">
        ${incDetailSection('Thông tin xử lý', `<dl class="kv inc-detail-kv"><dt>Trạng thái</dt><dd><span class="tag info">${U.esc(stLabel(i.state))}</span>${late(i) ? ` <span class="tag danger">Quá hạn ${incOverdueDays(i)} ngày</span>` : ''}</dd><dt>Người xử lý</dt><dd>${U.esc(incStaff(i))}</dd><dt>Mức ưu tiên</dt><dd>${U.esc(incPriorityLabel(i))}</dd><dt>Hạn xử lý</dt><dd>${incFmt(i.deadline)}</dd></dl>`)}
        ${incDetailSection('Thông tin phản ánh', `<dl class="kv inc-detail-kv"><dt>Người gửi</dt><dd>${U.esc(reporter)}</dd><dt>Nhóm vấn đề</dt><dd>${U.esc(i.cat)}</dd><dt>Nguồn phản ánh</dt><dd>${U.esc(i.source || '—')}</dd><dt>Thời gian gửi</dt><dd>${incFmt(i.created)}</dd><dt>Vị trí</dt><dd>${U.esc(st.code || '—')}</dd><dt>Nội dung</dt><dd>${U.esc(i.desc || '—')}</dd></dl>`)}
        ${a ? incDetailSection('Tài sản liên quan', `${incAssetPreview(a)}<button class="btn sm" data-act="asset-open" data-id="${a.id}">Xem tài sản</button>`) : ''}
        ${incDetailSection('Tiến độ xử lý', incWorkUpdatesHtml(i))}
        ${incAcceptanceHistoryHtml(i) ? incDetailSection('Lịch sử nghiệm thu', incAcceptanceHistoryHtml(i)) : ''}
        ${incDetailSection('Hình ảnh', `<div class="inc-detail-images">${incImages((i.images && i.images.report || []).concat(i.images && i.images.inspection || [], i.images && i.images.work || []))}</div>`)}
        ${incDetailSection('Hoạt động', `<div class="seg asset-tabs inc-activity-tabs">${[['all','Tất cả'],['comments','Trao đổi'],['history','Lịch sử']].map(x=>`<button class="${activityTab===x[0]?'on':''}" data-act="inc-activity-tab" data-id="${i.id}" data-tab="${x[0]}">${x[1]}</button>`).join('')}</div><div class="inc-timeline">${history.map(h=>`<div class="inc-timeline-i"><b>${incFmt(h.at)}</b><strong>${U.esc(h.action)}</strong>${h.detail?`<span>${U.esc(h.detail)}</span>`:''}</div>`).join('') || '<div class="empty small">Chưa có hoạt động.</div>'}</div>`)}
      </div>
      <div class="drawer-f inc-drawer-comment"><input class="input" disabled value="Trao đổi nội bộ sẽ dùng khi workflow bình luận được bật"><button class="btn" data-act="close">Đóng</button></div>`;
  }
  function openIncident(i) {
    if (!i) return;
    ui.incDetailActivity = ui.incDetailActivity || 'all';
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay inc-drawer-overlay" data-act="close"></div><div class="drawer inc-detail-drawer">${incDetail(i)}</div>`;
  }
  function incMoveIncident(i, targetState) {
    if (!incAllowedDrop(i, targetState)) return false;
    if (targetState === 'phancong') {
      if (!i.assignee) { U.toast('Cần chọn người xử lý trước khi chuyển sang Đã phân công.'); return false; }
      i.state = 'phancong';
      incHistory(i, 'Chuyển sang đã phân công', incStaff(i));
    } else if (targetState === 'dangxuly') {
      i.receive = i.receive || { at: incNow(), by: i.assignee, note: 'Cập nhật nhanh từ board.' };
      i.state = 'dangxuly';
      incHistory(i, 'Nhận xử lý', 'Cập nhật nhanh từ board.');
    } else if (targetState === 'chonghiemthu') {
      if (!i.work || !i.work.result) { U.toast('Cần nhập kết quả xử lý trước khi gửi chờ xác nhận.'); workModal(i); return false; }
      i.state = 'chonghiemthu';
      incHistory(i, 'Gửi kết quả chờ nghiệm thu', 'Cập nhật nhanh từ board.');
    } else if (targetState === 'hoanthanh') {
      i.acceptance = i.acceptance || { at: incNow(), by: (A.currentAccount && A.currentAccount() || {}).code || 'BQL', note: 'Nghiệm thu nhanh từ board.' };
      i.state = 'hoanthanh';
      incHistory(i, 'Nghiệm thu hoàn thành', i.acceptance.note);
    } else return false;
    A.save(); A.render(); U.toast('Đã chuyển ' + i.id + ' sang ' + stLabel(i.state));
    return true;
  }
  A.VIEWS['su-co'] = function () {
    ensureIncidentV2();
    const marketName = U.mShort(ui.market), all = A.db.incidents.filter(i => incCanView(i));
    const ctx = incRoleContext(), tech = ctx === 'tech', tabs = incFlowTabs(all);
    if (tech) ui.incFlowTab = 'all';
    if (!tabs.some(t => t.id === ui.incFlowTab)) ui.incFlowTab = tabs[0] && tabs[0].id;
    if (tech) {
      if (ui.incQuickFilter === 'unassigned' || ui.incQuickFilter === 'mine') ui.incQuickFilter = '';
      ui.incBoardAssignee = '';
      ui.incBoardSource = '';
    }
    const tab = tabs.find(t => t.id === ui.incFlowTab) || tabs[0];
    let rows = all.filter(i => incTabMatch(i, tab));
    const createBtn = ctx === 'manager' && A.canDo('su-co.tao-phan-anh', ui.market) ? '<button class="btn primary" data-act="inc-new-v2">+ Tạo phản ánh</button>' : '';
    const head = `<div class="page-head inc-page-head"><div><h2>${incRoleTitle(ctx)}</h2>${incShortSummaryHtml(all)}<p class="muted">${incRoleDesc(ctx, marketName)}</p></div>${createBtn}</div>`;
    const readOnly = ctx === 'leader' || (!tech && !incCanManageComplaints());
    const boardOptions = tech ? { readOnly, groups: incTechBoardGroups(tab), hideMineFilter: true, hideUnassignedFilter: true, compactFilters: true } : { readOnly };
    const boardTitle = tech ? 'Bảng công việc kỹ thuật' : (tab ? tab.label : 'Bảng xử lý phản ánh');
    return `${head}<div class="card inc-board-card"><div class="card-h"><h3>${boardTitle}</h3>${incCanManageComplaints() ? incFunctionNav(tabs, tab && tab.id) : ''}</div><div class="card-b">${incWorkflowBoardHtml(rows, boardOptions)}</div></div>`;
  };
  A.ACT['inc-flow-tab'] = el => { ui.incFlowTab = el.dataset.id; A.render(); };
  A.ACT['inc-tech-select'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id); if(!incCanView(i))return; ui.incTechSelectedId=i.id; A.render(); };
  A.IN['inc-code-search'] = el => { ui.incCodeSearch = el.value || ''; A.render(); };
  A.IN['inc-board-area'] = el => { ui.incBoardArea = el.value || ''; A.render(); };
  A.CH['inc-state'] = el => { ui.incState = el.value || ''; A.render(); };
  A.CH['inc-board-cat'] = el => { ui.incBoardCat = el.value || ''; A.render(); };
  A.CH['inc-board-assignee'] = el => { ui.incBoardAssignee = el.value || ''; A.render(); };
  A.CH['inc-board-source'] = el => { ui.incBoardSource = el.value || ''; A.render(); };
  A.CH['inc-board-state'] = el => { ui.incBoardState = el.value || ''; A.render(); };
  A.CH['inc-board-from'] = el => { ui.incBoardFrom = el.value || ''; A.render(); };
  A.CH['inc-board-to'] = el => { ui.incBoardTo = el.value || ''; A.render(); };
  A.ACT['inc-open'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id); if(!incCanView(i))return; ui.incReadOnlyDetail=el.dataset.readonly==='1'; ui.incDetailTab='overview'; openIncident(i); };
  A.ACT['inc-detail-tab'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id); if(!incCanView(i))return; ui.incDetailTab=el.dataset.tab; openIncident(i); };
  A.ACT['inc-activity-tab'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id); if(!incCanView(i))return; ui.incDetailActivity=el.dataset.tab||'all'; openIncident(i); };
  A.ACT['inc-quick-filter'] = el => { ui.incQuickFilter = ui.incQuickFilter === el.dataset.id ? '' : el.dataset.id; A.render(); };
  A.ACT['inc-toggle-filters'] = () => { ui.incFilterOpen = !ui.incFilterOpen; A.render(); };
  A.ACT['inc-view-mode'] = el => { ui.incViewMode = el.dataset.id || 'board'; A.render(); };
  A.ACT['inc-quick-assign'] = (el, e) => { if(e) e.stopPropagation(); const i=A.db.incidents.find(x=>x.id===el.dataset.id); if(!i||!incCan(i,'assign'))return; if(i.state!=='tiepnhan'){U.toast('Chỉ đổi phân công nhanh ở bước tiếp nhận.');return;} A.ACT['inc-assign-open'](el); };
  A.ACT['inc-quick-status'] = (el, e) => { if(e) e.stopPropagation(); const i=A.db.incidents.find(x=>x.id===el.dataset.id); if(!i)return; const next={tiepnhan:'phancong',phancong:'dangxuly',dangxuly:'chonghiemthu',chonghiemthu:'hoanthanh'}[i.state]; if(next) incMoveIncident(i,next); };
  A.ACT['inc-quick-priority'] = (el, e) => { if(e) e.stopPropagation(); const i=A.db.incidents.find(x=>x.id===el.dataset.id); if(!i||!incCan(i,i.state==='tiepnhan'?'assign':'transition'))return; U.toast('Mức ưu tiên đang được suy ra từ nhóm vấn đề và hạn xử lý.'); };
  A.CH['inc-images'] = el => { const list=A.$(`[data-image-list="${el.dataset.kind}"]`); const raw=Array.from(el.files||[]); const files=el.dataset.kind==='report'?raw.slice(0,3):raw; if(raw.length>files.length)U.toast('Chỉ được đính kèm tối đa 3 ảnh.'); ui.incImageDraft=ui.incImageDraft||{}; ui.incImageDraft[el.dataset.kind]=files.map(f=>({name:f.name,url:URL.createObjectURL(f)})); if(list) list.innerHTML=ui.incImageDraft[el.dataset.kind].map((x,n)=>`<div class="inc-image-thumb"><img src="${x.url}" alt=""><span>${U.esc(x.name)}</span><button class="x" data-act="inc-image-remove" data-kind="${el.dataset.kind}" data-n="${n}">×</button></div>`).join(''); };
  A.ACT['inc-image-remove'] = el => { const xs=(ui.incImageDraft||{})[el.dataset.kind]||[]; const x=xs.splice(Number(el.dataset.n),1)[0]; if(x)URL.revokeObjectURL(x.url); const box=A.$(`[data-image-list="${el.dataset.kind}"]`); if(box)box.innerHTML=xs.map((v,n)=>`<div class="inc-image-thumb"><img src="${v.url}" alt=""><span>${U.esc(v.name)}</span><button class="x" data-act="inc-image-remove" data-kind="${el.dataset.kind}" data-n="${n}">×</button></div>`).join(''); };
  function incDraftNames(kind) { return ((ui.incImageDraft||{})[kind]||[]).map(x=>x.name); }
  A.ACT['inc-assign-open'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id); if(!i||i.state!=='tiepnhan'||!incCan(i,'assign'))return; const assets=incAssets(), staff=D.STAFF.filter(s=>s.market===i.market && s.role.indexOf('kỹ thuật') !== -1), due=(i.deadline&&String(i.deadline).indexOf('T')!==-1)?i.deadline:incDefaultDeadline(i.cat,i.created,true), min=incDeadlineMin(i), max=incDeadlineMax(i.cat,i); incModal('Tiếp nhận & phân công sự cố',incHeader(i)+incReadonly(i)+`<section class="inc-section"><h4>Phân loại & tài sản liên quan</h4><div class="form-grid"><div class="field"><label>Nhóm sự cố *</label><select class="input" id="ia-cat">${incCats().map(x=>`<option ${x===i.cat?'selected':''}>${x}</option>`).join('')}</select><div class="small muted">Hạn mặc định: Điện/PCCC 1 ngày; nhóm khác 3 ngày tính từ thời gian tiếp nhận.</div></div><div class="field"><label>Tài sản liên quan</label><select class="input" id="ia-asset"><option value="">Không xác định / Không liên quan tài sản</option>${assets.map(a=>`<option value="${a.id}" ${i.assetId===a.id?'selected':''}>${U.esc(a.code)} · ${U.esc(a.name)}</option>`).join('')}</select></div></div></section><section class="inc-section"><h4>Phân công</h4><div class="form-grid"><div class="field"><label>Người xử lý *</label><select class="input" id="ia-assignee"><option value="">Chọn nhân viên kỹ thuật</option>${staff.map(s=>`<option value="${s.id}" ${i.assignee===s.id?'selected':''}>${U.esc(s.name)} · ${U.esc(s.role)}</option>`).join('')}</select></div><div class="field"><label>Hạn xử lý *</label><input class="input" type="datetime-local" id="ia-due" value="${due}" min="${min}" max="${max}"><div class="small muted">Tối đa theo nhóm hiện tại: ${incFmt(max)}.</div></div></div><div class="field"><label>Ghi chú phân công</label><textarea class="input" id="ia-note" rows="2"></textarea></div></section>`,`<button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inc-assign-save" data-id="${i.id}">Xác nhận phân công</button>`); };
  A.ACT['inc-assign-save'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id), as=A.$('#ia-assignee').value, due=A.$('#ia-due').value, cat=A.$('#ia-cat').value; if(!i||i.state!=='tiepnhan'||!incCan(i,'assign'))return; if(!as||!due){U.toast('Vui lòng chọn người xử lý và hạn xử lý.');return;} const dueErr=incValidateDeadline(i,cat,due); if(dueErr){U.toast(dueErr);return;} const staff=D.STAFF.find(s=>s.id===as&&s.market===i.market&&s.role.indexOf('kỹ thuật')!==-1); if(!staff){U.toast('Người xử lý phải là nhân viên kỹ thuật thuộc chợ đang chọn.');return;} const assetId=A.$('#ia-asset').value||null; if(assetId && !(A.db.marketAssets||[]).some(a=>a.id===assetId&&a.market===i.market)){U.toast('Tài sản liên quan không thuộc chợ đang chọn.');return;} i.cat=cat;i.assetId=assetId;i.assignee=as;i.deadline=due;i.assignmentNote=A.$('#ia-note').value.trim();i.state='phancong';incHistory(i,'Phân công xử lý',incStaff(i)+' · Hạn: '+incFmt(due));A.save();A.closeModal();A.render();U.toast('Đã phân công xử lý.'); };
  A.ACT['inc-inspect-open'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id), a = incAsset(i), st = i && (A.idx.stall.get(i.stallId) || {});
    if (!i || i.state !== 'phancong' || !incCan(i, 'transition')) return;
    incModal('Nhận xử lý phản ánh', incHeader(i) + `
      <section class="inc-section inc-accept-work">
        <h4>Thông tin cần xử lý</h4>
        <dl class="kv">
          <dt>Người xử lý</dt><dd>${U.esc(incStaff(i))}</dd>
          <dt>Hạn xử lý</dt><dd>${incFmt(i.deadline)}${late(i) ? ' <span class="tag danger">Quá hạn</span>' : ''}</dd>
          <dt>Vị trí</dt><dd>${U.esc(st.code || '—')}${a ? '<br><span class="small muted">' + U.esc(a.locationLabel || a.name) + '</span>' : ''}</dd>
          <dt>Tài sản liên quan</dt><dd>${a ? U.esc(a.code + ' · ' + a.name) : '—'}</dd>
          <dt>Nội dung phản ánh</dt><dd>${U.esc(i.desc || i.title || '—')}</dd>
        </dl>
      </section>
      <section class="inc-section inc-accept-work">
        <h4>Xác nhận nhận việc</h4>
        <div class="field"><label>Thời điểm nhận *</label><input class="input" type="datetime-local" id="ii-at" value="${incNow()}"></div>
        <div class="field"><label>Ghi chú khi nhận</label><textarea class="input" id="ii-note" rows="2" placeholder="Không bắt buộc. Ví dụ: sẽ xuống kiểm tra trong ca trực này."></textarea></div>
        <div class="note info" style="margin-top:10px">Sau khi nhận, hồ sơ chuyển sang <b>Đang xử lý</b>. Việc kiểm tra hiện trường và cập nhật kết quả thực hiện ở bước <b>Cập nhật tiến độ</b>.</div>
      </section>`,
      `<button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inc-inspect-save" data-id="${i.id}">Nhận xử lý</button>`);
  };
  A.ACT['inc-inspect-save'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id);
    if (!i || i.state !== 'phancong' || !incCan(i, 'transition')) return;
    const at = A.$('#ii-at').value;
    if (!at) { U.toast('Vui lòng nhập thời điểm nhận xử lý.'); return; }
    i.receive = {
      at,
      by: i.assignee,
      note: A.$('#ii-note').value.trim()
    };
    i.state = 'dangxuly';
    incHistory(i, 'Nhận xử lý', 'Nhân viên kỹ thuật đã nhận việc lúc ' + incFmt(at));
    A.save(); A.closeModal(); A.render(); U.toast('Đã nhận xử lý. Hãy cập nhật tiến độ sau khi kiểm tra hiện trường.');
  };
  function workModal(i) {
    const w = i.work || {}, r = i.receive || {}, ins = i.inspection || {};
    ui.incImageDraft = {};
    incModal('Cập nhật tiến độ xử lý', incHeader(i) + `<section class="inc-section inc-work-summary"><dl class="kv"><dt>Người xử lý</dt><dd>${U.esc(incStaff(i))}</dd><dt>Đã nhận lúc</dt><dd>${incFmt(r.at)}</dd><dt>Hạn xử lý</dt><dd>${incFmt(i.deadline)}</dd></dl></section><section class="inc-section"><h4>Các lần cập nhật trước</h4>${incWorkUpdatesHtml(i)}</section><section class="inc-section inc-accept-work"><h4>Cập nhật mới</h4><div class="inc-work-mode"><label><input type="radio" name="iw-mode" value="progress" checked data-ch="inc-work-mode"> Đang xử lý</label><label><input type="radio" name="iw-mode" value="done" data-ch="inc-work-mode"> Gửi chờ nghiệm thu</label></div><div class="field"><label>Nội dung cập nhật *</label><textarea class="input" id="iw-content" rows="4" placeholder="Ghi ngắn gọn việc đã kiểm tra / đã làm."></textarea></div><div class="field" id="iw-result-wrap" hidden><label>Kết quả sau xử lý *</label><textarea class="input" id="iw-result" rows="3" placeholder="Ví dụ: đã thông nghẹt, nước thoát bình thường.">${U.esc(w.result||'')}</textarea></div><input type="hidden" id="iw-at" value="${incNow()}"><div class="field"><label>Ghi chú</label><textarea class="input" id="iw-note" rows="2"></textarea></div></section><section class="inc-section"><h4>Hình ảnh <span class="muted small">(không bắt buộc)</span></h4>${incImageInput('work')}</section>`,`<button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inc-work-save" data-id="${i.id}">Lưu cập nhật</button>`);
  }
  A.ACT['inc-work-open'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id);if(i&&i.state==='dangxuly'&&incCan(i,'transition'))workModal(i); };
  function saveWork(i, submit) {
    const mode = (A.$('input[name="iw-mode"]:checked') || {}).value || 'progress', content = A.$('#iw-content').value.trim(), result = (A.$('#iw-result') && A.$('#iw-result').value.trim()) || '', at = A.$('#iw-at').value;
    if (!i || i.state !== 'dangxuly' || !incCan(i, 'transition')) return false;
    if (!content) { U.toast('Vui lòng nhập nội dung cập nhật.'); return false; }
    if (mode === 'done' && !result) { U.toast('Vui lòng nhập kết quả sau xử lý khi gửi chờ nghiệm thu.'); return false; }
    const note = A.$('#iw-note').value.trim();
    i.inspection = Object.assign({}, i.inspection || {}, { at: (i.inspection || {}).at || incNow(), by: i.assignee, condition: content });
    i.workUpdates = Array.isArray(i.workUpdates) ? i.workUpdates : [];
    i.workUpdates.push({ at, by: i.assignee, content, result, note, submitForAcceptance: mode === 'done' });
    i.work = { content, result: mode === 'done' ? result : ((i.work || {}).result || ''), completedAt: mode === 'done' ? at : ((i.work || {}).completedAt || ''), note, mode };
    i.images.work = (i.images.work || []).concat(incDraftNames('work'));
    if (mode === 'done') { i.state = 'chonghiemthu'; incHistory(i, 'Gửi kết quả chờ nghiệm thu', result); }
    else incHistory(i, 'Cập nhật tiến độ xử lý', content);
    A.save(); A.closeModal(); A.render(); U.toast(mode === 'done' ? 'Đã gửi kết quả, hồ sơ chuyển sang Chờ nghiệm thu.' : 'Đã lưu cập nhật tiến độ.');
    return true;
  }
  A.ACT['inc-work-save'] = el => saveWork(A.db.incidents.find(x=>x.id===el.dataset.id),false);
  A.CH['inc-work-mode'] = el => { const wrap=A.$('#iw-result-wrap'); if(wrap) wrap.hidden=el.value!=='done'; };
  A.ACT['inc-accept-open'] = el => {const i=A.db.incidents.find(x=>x.id===el.dataset.id);if(!i||i.state!=='chonghiemthu'||!incCan(i,'accept'))return;incModal('Nghiệm thu kết quả xử lý',incHeader(i)+`<section class="inc-section"><dl class="kv"><dt>Người xử lý</dt><dd>${U.esc(incStaff(i))}</dd><dt>Thời gian gửi kết quả</dt><dd>${incFmt((i.work||{}).completedAt)}</dd><dt>Nội dung xử lý</dt><dd>${U.esc((i.work||{}).content||'—')}</dd><dt>Kết quả sau xử lý</dt><dd>${U.esc((i.work||{}).result||'—')}</dd></dl>${incImages((i.images||{}).work||[])}<div class="field"><label>Ghi chú / lý do nghiệm thu</label><textarea class="input" id="ia-note-accept" rows="3" placeholder="Nhập ghi chú nghiệm thu. Nếu không đạt, phải nêu rõ nội dung cần xử lý lại."></textarea></div></section>`,`<button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="inc-accept-reject" data-id="${i.id}">Không đạt, trả xử lý lại</button><button class="btn primary" data-act="inc-accept-save" data-id="${i.id}">Xác nhận hoàn thành</button>`);};
  A.ACT['inc-accept-save'] = el => {const i=A.db.incidents.find(x=>x.id===el.dataset.id);if(!i||i.state!=='chonghiemthu'||!incCan(i,'accept'))return;const note=(A.$('#ia-note-accept')&&A.$('#ia-note-accept').value.trim())||'';i.acceptance={at:incNow(),by:(A.currentAccount&&A.currentAccount()||{}).code||'BQL',note,result:'accepted'};i.acceptanceHistory=Array.isArray(i.acceptanceHistory)?i.acceptanceHistory:[];i.acceptanceHistory.push(i.acceptance);i.state='hoanthanh';incHistory(i,'Nghiệm thu hoàn thành',note);incHistory(i,'Thông báo kết quả cho người phản ánh','Tiểu thương có thể đánh giá kết quả xử lý trên cổng tiểu thương.');A.save();A.closeModal();A.render();U.toast('Đã nghiệm thu hoàn thành. Tiểu thương có thể đánh giá kết quả phản ánh.');};
  A.ACT['inc-accept-reject'] = el => {const i=A.db.incidents.find(x=>x.id===el.dataset.id);if(!i||i.state!=='chonghiemthu'||!incCan(i,'accept'))return;const note=(A.$('#ia-note-accept')&&A.$('#ia-note-accept').value.trim())||'';if(!note){U.toast('Vui lòng nhập lý do nghiệm thu không đạt.');return;}i.acceptance={at:incNow(),by:(A.currentAccount&&A.currentAccount()||{}).code||'BQL',note,result:'rejected'};i.acceptanceHistory=Array.isArray(i.acceptanceHistory)?i.acceptanceHistory:[];i.acceptanceHistory.push(i.acceptance);i.state='dangxuly';if(i.work)i.work.mode='rework';incHistory(i,'Nghiệm thu không đạt',note);A.save();A.closeModal();A.render();U.toast('Đã trả hồ sơ về Đang xử lý để nhân viên kỹ thuật cập nhật lại.');};
  A.ACT['inc-close-open'] = el => {const i=A.db.incidents.find(x=>x.id===el.dataset.id);if(!i||i.state!=='hoanthanh'||!incCan(i,'close'))return;incModal('Đóng sự cố',incHeader(i)+`<section class="inc-section"><div class="inc-check">${U.icon('check')} Đã xử lý</div><div class="inc-check">${U.icon('check')} Đã thông báo kết quả cho người phản ánh</div><dl class="kv"><dt>Người xử lý</dt><dd>${U.esc(incStaff(i))}</dd><dt>Hoàn thành</dt><dd>${incFmt((i.work||{}).completedAt)}</dd>${i.rating?`<dt>Đánh giá tiểu thương</dt><dd>${'★'.repeat(i.rating)}${'☆'.repeat(5-i.rating)}${(i.feedback||{}).comment?` · ${U.esc(i.feedback.comment)}`:''}</dd>`:''}</dl><div class="field"><label>Ghi chú khi đóng</label><textarea class="input" id="ic-note" rows="2"></textarea></div></section>`,`<button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inc-close-save" data-id="${i.id}">Đóng sự cố</button>`);};
  A.ACT['inc-close-save'] = el => {const i=A.db.incidents.find(x=>x.id===el.dataset.id);if(!i||i.state!=='hoanthanh'||!incCan(i,'close'))return;i.closeInfo={at:incNow(),note:A.$('#ic-note').value.trim()};i.state='dong';incHistory(i,'Đóng sự cố',i.closeInfo.note);A.save();A.closeModal();A.render();U.toast('Đã đóng sự cố.');};
  A.ACT['inc-new-v2'] = () => {
    if (!A.canDo('su-co.tao-phan-anh', ui.market)) return;
    ui.incImageDraft = {};
    const stalls = A.db.stalls.filter(s => s.market === ui.market);
    incModal('Tạo phản ánh / sự cố', `<section class="inc-section">
      <div class="form-grid">
        <div class="field"><label>Nguồn</label><input class="input" value="Nhập tại Ban Quản lý" disabled></div>
        <div class="field"><label>Người phản ánh</label><input class="input" id="in2-reporter-name" placeholder="Tên tiểu thương / người dân"></div>
        <div class="field"><label>Số điện thoại</label><input class="input" id="in2-reporter-phone" placeholder="Số điện thoại liên hệ"></div>
        <div class="field"><label>Nhóm *</label><select class="input" id="in2-cat">${incCats().map(c=>`<option>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Điểm KD</label><select class="input" id="in2-stall"><option value="">Không xác định</option>${stalls.map(s=>`<option value="${s.id}">${s.code}</option>`).join('')}</select></div>
        <div class="field"><label>Tài sản liên quan</label><select class="input" id="in2-asset"><option value="">Không xác định / Không liên quan</option>${incAssets().map(a=>`<option value="${a.id}">${U.esc(a.code)} · ${U.esc(a.name)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Tiêu đề *</label><input class="input" id="in2-title"></div>
      <div class="field"><label>Nội dung *</label><textarea class="input" id="in2-desc" rows="3"></textarea></div>
    </section><section class="inc-section"><h4>Ảnh <span class="muted small">(không bắt buộc)</span></h4>${incImageInput('report')}</section>`, `<button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inc-new-v2-save">Tạo phản ánh</button>`);
  };
  A.ACT['inc-new-v2-save'] = () => {if(!A.canDo('su-co.tao-phan-anh',ui.market))return;const titleEl=A.$('#in2-title'),desc=(A.$('#in2-desc')&&A.$('#in2-desc').value.trim())||'',reporterName=(A.$('#in2-reporter-name')&&A.$('#in2-reporter-name').value.trim())||'',reporterPhone=(A.$('#in2-reporter-phone')&&A.$('#in2-reporter-phone').value.trim())||'',stall=A.idx.stall.get(A.$('#in2-stall').value),cat=A.$('#in2-cat').value,assetEl=A.$('#in2-asset'),assetId=assetEl?(assetEl.value||null):null,title=titleEl?titleEl.value.trim():(desc.length>60?desc.slice(0,57)+'…':desc);if(!desc||(!titleEl&&!reporterName)){U.toast(titleEl?'Vui lòng nhập tiêu đề và nội dung.':'Vui lòng nhập người phản ánh và nội dung phản ánh.');return;}if(titleEl&&!title){U.toast('Vui lòng nhập tiêu đề và nội dung.');return;}if(stall&&stall.market!==ui.market){U.toast('Điểm kinh doanh không thuộc chợ đang chọn.');return;}if(assetId&&!(A.db.marketAssets||[]).some(a=>a.id===assetId&&a.market===ui.market)){U.toast('Tài sản liên quan không thuộc chợ đang chọn.');return;}const id='SC-'+U.pad(101+A.db.incidents.length,4),created=incNow(),due=incDefaultDeadline(cat,created,true);const i={id,market:ui.market,stallId:stall&&stall.id,traderId:stall&&stall.traderId,assetId,cat,title,desc,source:'Nhập tại Ban Quản lý',reporterName,reporterPhone,state:'tiepnhan',created,deadline:due,assignee:null,rating:null,escalated:false,images:{report:incDraftNames('report').slice(0,3),inspection:[],work:[]},history:[{at:created,action:'Tiếp nhận phản ánh',detail:'Nguồn: Nhập tại Ban Quản lý'+(reporterName?' · Người phản ánh: '+reporterName:'')+' · hạn mặc định '+incDeadlineRuleText(cat)}],log:[]};A.db.incidents.push(i);ui.incImageDraft={};A.save();A.closeModal();A.render();U.toast('Đã tạo '+id);};
  document.addEventListener('dragstart', e => {
    const card = e.target.closest && e.target.closest('[data-drag-id]');
    if (!card) return;
    const i = A.db.incidents.find(x => x.id === card.dataset.dragId);
    if (!incCanDrag(i, card.dataset.readonly === '1')) { e.preventDefault(); return; }
    e.dataTransfer.setData('text/plain', i.id);
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  document.addEventListener('dragend', e => {
    const card = e.target.closest && e.target.closest('[data-drag-id]');
    if (card) card.classList.remove('dragging');
    document.querySelectorAll('.inc-jira-col.drag-over').forEach(x => x.classList.remove('drag-over'));
  });
  document.addEventListener('dragover', e => {
    const col = e.target.closest && e.target.closest('.inc-jira-col[data-drop-state]');
    if (!col) return;
    e.preventDefault();
    col.classList.add('drag-over');
  });
  document.addEventListener('dragleave', e => {
    const col = e.target.closest && e.target.closest('.inc-jira-col[data-drop-state]');
    if (col) col.classList.remove('drag-over');
  });
  document.addEventListener('drop', e => {
    const col = e.target.closest && e.target.closest('.inc-jira-col[data-drop-state]');
    if (!col) return;
    e.preventDefault();
    col.classList.remove('drag-over');
    const id = e.dataTransfer.getData('text/plain');
    const i = A.db.incidents.find(x => x.id === id);
    incMoveIncident(i, col.dataset.dropState);
  });
})(window.APP);
