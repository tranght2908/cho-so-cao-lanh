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
      <div class="card kpi"><div class="k-label">Quá hạn</div><div class="k-value" style="color:#df2225">${all.filter(late).length}</div><div class="k-sub">Điện, PCCC: 24 giờ · khác: 3 ngày</div></div>
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
          <div class="small muted">${i.source === 'Mini app tiểu thương' ? '📱' : '🖥'} ${U.dmy(i.created)}${i.assignee ? ' · ' + U.esc(U.staffName(i.assignee)) : ''}</div></div>`).join('')}</div>`;
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
        ${i.desc ? `<dt>Nội dung</dt><dd>${U.esc(i.desc)}</dd>` : ''}${i.photo ? '<dt>Ảnh</dt><dd><span class="tag info">📷 1 ảnh đính kèm</span></dd>' : ''}
        <dt>Người xử lý</dt><dd>${canPhanCong ? `<select class="input" data-ch="inc-assign" data-id="${i.id}"><option value="">– Chưa phân công –</option>${D.STAFF.filter(s => s.market === i.market).map(s => `<option value="${s.id}" ${i.assignee === s.id ? 'selected' : ''}>${s.name} (${s.role})</option>`).join('')}</select>` : U.esc(U.staffName(i.assignee) || 'Chưa phân công')}</dd>
        ${i.rating ? `<dt>Đánh giá</dt><dd>${'★'.repeat(i.rating)}${'☆'.repeat(5 - i.rating)}</dd>` : ''}</dl>
      <div class="divider"></div><b class="small">Nhật ký xử lý</b>${i.log.map(l => `<div class="small"><span class="muted">${U.dmy(l.at)}</span> · ${U.esc(l.text)}</div>`).join('')}
      ${canChiDao && i.escalated ? '<div class="field" style="margin-top:12px"><label>Ý kiến chỉ đạo của lãnh đạo phường</label><textarea class="input" id="inc-cmt" rows="2" placeholder="VD: Giao BQL phối hợp Công an phường xử lý trong 2 ngày"></textarea></div>' : ''}
      </div><div class="modal-f">
      ${canVuotCap && !i.escalated && isOpen(i) ? `<button class="btn" data-act="inc-escalate" data-id="${i.id}">Chuyển vượt cấp lên phường</button>` : ''}
      ${canChiDao && i.escalated ? `<button class="btn primary" data-act="inc-comment" data-id="${i.id}">Gửi ý kiến chỉ đạo</button>` : ''}
      ${canChuyenTT && next ? `<button class="btn primary" data-act="inc-next" data-id="${i.id}">Chuyển sang: ${next.label} →</button>` : ''}
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
    const i = { id: 'SC-' + U.pad(101 + A.db.incidents.length, 4), market: st.market, stallId, traderId: st.traderId, cat, title, desc: desc || '', photo: !!photo, state: 'tiepnhan', source, escalated: false, created, deadline: incDefaultDeadline(cat, created, false), assignee: null, rating: null, log: [{ at: created, text: 'Tiếp nhận phản ánh từ ' + source }] };
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
  const incIsTechnician = () => ui.role === 'technician';
  const incCurrentStaffId = () => {
    const acc = A.currentAccount && A.currentAccount();
    return acc && acc.code;
  };
  const incAssignedToCurrentTech = i => !!i && i.assignee && i.assignee === incCurrentStaffId();
  const incCanView = i => !!i && U.can('su-co') && i.market === ui.market && (!incIsTechnician() || incAssignedToCurrentTech(i));
  const incAction = i => {
    if (incIsTechnician()) {
      return ({ phancong:['inc-inspect-open','Nhận xử lý'], dangxuly:['inc-work-open','Cập nhật tiến độ'], chonghiemthu:['inc-open','Xem kết quả'], hoanthanh:['inc-open','Xem kết quả'], dong:['inc-open','Xem hồ sơ'] }[i.state]);
    }
    return ({ tiepnhan:['inc-assign-open','Tiếp nhận & phân công'], phancong:['inc-inspect-open','Kiểm tra hiện trường'], dangxuly:['inc-work-open','Cập nhật xử lý'], chonghiemthu:['inc-accept-open','Nghiệm thu'], hoanthanh:['inc-close-open','Đóng sự cố'], dong:['inc-open','Xem hồ sơ'] }[i.state]);
  };
  const incCan = (i, action) => {
    if (!incCanView(i)) return false;
    if (action === 'assign' || action === 'accept' || action === 'close') {
      return !incIsTechnician() && A.canDo('su-co.phan-cong', i.market);
    }
    if (!A.canDo('su-co.cap-nhat-xu-ly', i.market)) return false;
    if (!incIsTechnician()) return true;
    return incAssignedToCurrentTech(i) && (i.state === 'phancong' || i.state === 'dangxuly');
  };
  function incHistory(i, action, detail) {
    (i.history || (i.history = [])).push({ at: incNow(), action, detail: detail || '' });
    (i.log || (i.log = [])).push({ at: U.today(), text: action + (detail ? ': ' + detail : '') });
  }
  function incEnsureLeaderReminder(i) {
    if (!late(i) || i.leaderReminder) return false;
    i.leaderReminder = {
      at: incNow(),
      targetRole: 'market_manager',
      targetLabel: 'Trưởng Ban Quản lý',
      reason: 'OVERDUE_INCIDENT'
    };
    incHistory(i, 'Hệ thống nhắc Trưởng Ban Quản lý', 'Phản ánh quá hạn xử lý');
    return true;
  }
  function ensureIncidentV2() {
    let changed = false;
    (A.db.incidents || []).forEach(i => {
      if (!i.history) { i.history = (i.log || []).map(x => ({ at:x.at, action:x.text, detail:'' })); changed = true; }
      if (!i.inspection) { i.inspection = null; changed = true; }
      if (!i.work) { i.work = null; changed = true; }
      if (!i.acceptance) { i.acceptance = null; changed = true; }
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
      if (['hoanthanh','dong'].includes(d[1])) i.acceptance = { result:'pass', by:'NV01', at:'2026-09-12T14:00', note:'Đạt yêu cầu.' };
      incEnsureLeaderReminder(i);
      A.db.incidents.push(i); changed = true;
    });
    if (changed) A.save();
  }
  function incImageInput(kind) { return `<div class="inc-image-input"><input type="file" accept="image/*" multiple data-ch="inc-images" data-kind="${kind}"><div class="small muted">Ảnh chỉ preview cục bộ trong phiên, không upload/lưu base64.</div><div class="inc-image-draft" data-image-list="${kind}"></div></div>`; }
  function incImages(names) { return names && names.length ? `<div class="inc-image-list">${names.map(n => `<div class="inc-image-thumb">📷<span>${U.esc(typeof n === 'string' ? n : n.name)}</span></div>`).join('')}</div>` : '<div class="empty small">Chưa có hình ảnh.</div>'; }
  function incAssetPreview(asset) { return asset ? `<div class="inc-asset-preview"><b>${U.esc(asset.code)} · ${U.esc(asset.name)}</b><span>${U.esc(asset.locationLabel)} · ${U.esc(asset.status)}</span></div>` : ''; }
  function incModal(title, body, footer) { A.modal(`<div class="modal-h inc-modal-h"><h3>${title}</h3><button class="x" data-act="close">×</button></div><div class="modal-b inc-modal-b">${body}</div><div class="modal-f inc-modal-f">${footer}</div>`, true); }
  function incHeader(i) { return `<div class="inc-case"><b>${i.id}</b><span>${U.esc(i.title)}</span></div>`; }
  function incReadonly(i) { const st=A.idx.stall.get(i.stallId)||{}, t=A.idx.trader.get(i.traderId); return `<section class="inc-section"><h4>Thông tin phản ánh</h4><dl class="kv"><dt>Nguồn</dt><dd>${U.esc(i.source)}</dd><dt>Người phản ánh</dt><dd>${U.esc(t ? t.name : '—')}</dd><dt>Điểm kinh doanh</dt><dd>${U.esc(st.code || '—')}</dd><dt>Thời gian tiếp nhận</dt><dd>${incFmt(i.created)}</dd><dt>Nội dung</dt><dd>${U.esc(i.desc || '—')}</dd></dl></section>`; }
  function incDetail(i) {
    const tab=ui.incDetailTab||'overview', a=incAsset(i), st=A.idx.stall.get(i.stallId)||{}, t=A.idx.trader.get(i.traderId), action=incAction(i);
    let body='';
    if(tab==='overview') body=`<dl class="kv"><dt>Mã sự cố</dt><dd>${i.id}</dd><dt>Tên sự cố</dt><dd>${U.esc(i.title)}</dd><dt>Trạng thái</dt><dd><span class="tag info">${stLabel(i.state)}</span>${late(i)?` <span class="tag danger">Quá hạn ${incOverdueDays(i)} ngày</span>`:''}${i.leaderReminder?' <span class="tag warn">Đã nhắc Trưởng BQL</span>':''}</dd><dt>Nhóm</dt><dd>${U.esc(i.cat)} <span class="small muted">(${incDeadlineRuleText(i.cat)})</span></dd><dt>Nguồn</dt><dd>${U.esc(i.source)}</dd><dt>Người phản ánh</dt><dd>${U.esc(t?t.name:'—')}</dd><dt>Điểm KD</dt><dd>${U.esc(st.code||'—')}</dd><dt>Ngày tiếp nhận</dt><dd>${incFmt(i.created)}</dd><dt>Hạn xử lý</dt><dd>${incFmt(i.deadline)}</dd>${i.leaderReminder?`<dt>Nhắc quá hạn</dt><dd>Hệ thống đã nhắc ${U.esc(i.leaderReminder.targetLabel)} lúc ${incFmt(i.leaderReminder.at)}</dd>`:''}<dt>Người xử lý</dt><dd>${U.esc(incStaff(i))}</dd></dl>${a?`<section class="inc-section"><h4>Tài sản liên quan</h4>${incAssetPreview(a)}<button class="btn sm" data-act="asset-open" data-id="${a.id}">Xem tài sản</button></section>`:''}`;
    if(tab==='inspection') body=i.inspection?`<dl class="kv"><dt>Thời gian kiểm tra</dt><dd>${incFmt(i.inspection.at)}</dd><dt>Người kiểm tra</dt><dd>${U.esc(U.staffName(i.inspection.by))}</dd><dt>Tình trạng thực tế</dt><dd>${U.esc(i.inspection.condition)}</dd><dt>Ghi chú kỹ thuật</dt><dd>${U.esc(i.inspection.note||'—')}</dd></dl>${incImages(i.images.inspection)}`:'<div class="empty">Chưa có thông tin kiểm tra hiện trường.</div>';
    if(tab==='work') body=i.work?`<dl class="kv"><dt>Người xử lý</dt><dd>${U.esc(incStaff(i))}</dd><dt>Nội dung xử lý</dt><dd>${U.esc(i.work.content)}</dd><dt>Kết quả sau xử lý</dt><dd>${U.esc(i.work.result)}</dd><dt>Thời gian hoàn thành</dt><dd>${incFmt(i.work.completedAt)}</dd><dt>Ghi chú</dt><dd>${U.esc(i.work.note||'—')}</dd></dl>${incImages(i.images.work)}`:'<div class="empty">Chưa có kết quả xử lý.</div>';
    if(tab==='acceptance') body=i.acceptance?`<dl class="kv"><dt>Kết quả</dt><dd><span class="tag ${i.acceptance.result==='pass'?'ok':'danger'}">${i.acceptance.result==='pass'?'Đạt':'Chưa đạt'}</span></dd><dt>Người nghiệm thu</dt><dd>${U.esc(U.staffName(i.acceptance.by))}</dd><dt>Thời gian</dt><dd>${incFmt(i.acceptance.at)}</dd><dt>Ý kiến</dt><dd>${U.esc(i.acceptance.note||'—')}</dd>${i.acceptance.rework?`<dt>Yêu cầu xử lý lại</dt><dd>${U.esc(i.acceptance.rework)}</dd>`:''}</dl>`:'<div class="empty">Chưa thực hiện nghiệm thu.</div>';
    if(tab==='images') body=`<section class="inc-section"><h4>Ảnh phản ánh</h4>${incImages(i.images.report)}</section><section class="inc-section"><h4>Ảnh kiểm tra hiện trường</h4>${incImages(i.images.inspection)}</section><section class="inc-section"><h4>Ảnh sau xử lý</h4>${incImages(i.images.work)}</section>`;
    if(tab==='history') body=`<div class="inc-timeline">${(i.history||[]).map(h=>`<div class="inc-timeline-i"><b>${incFmt(h.at)}</b><strong>${U.esc(h.action)}</strong>${h.detail?`<span>${U.esc(h.detail)}</span>`:''}</div>`).join('')}</div>`;
    const permissionAction = i.state === 'tiepnhan' ? 'assign' : (i.state === 'chonghiemthu' ? 'accept' : (i.state === 'hoanthanh' ? 'close' : 'field'));
    return `<div class="drawer-h"><div><h3>${i.id} · ${U.esc(i.title)}</h3><div class="small muted"><span class="tag info">${stLabel(i.state)}</span>${late(i)?' <span class="tag danger">Quá hạn '+incOverdueDays(i)+' ngày</span>':''}${i.leaderReminder?' <span class="tag warn">Đã nhắc Trưởng BQL</span>':''}</div></div><span class="spacer"></span>${action&&i.state!=='dong'&&incCan(i,permissionAction)?`<button class="btn primary" data-act="${action[0]}" data-id="${i.id}">${action[1]}</button>`:''}<button class="x" data-act="close">×</button></div><div class="drawer-b"><div class="seg asset-tabs">${[['overview','Tổng quan'],['inspection','Kiểm tra'],['work','Xử lý'],['acceptance','Nghiệm thu'],['images','Hình ảnh'],['history','Nhật ký']].map(x=>`<button class="${tab===x[0]?'on':''}" data-act="inc-detail-tab" data-id="${i.id}" data-tab="${x[0]}">${x[1]}</button>`).join('')}</div><div class="inc-detail-content">${body}</div></div><div class="drawer-f"><button class="btn" data-act="close">Đóng</button></div>`;
  }
  function openIncident(i) { if(!i)return; ui.incDetailTab=ui.incDetailTab||'overview'; A.$('#modal-root').innerHTML=`<div class="drawer-overlay" data-act="close"></div><div class="drawer inc-detail-drawer">${incDetail(i)}</div>`; }
  function incPermissionAction(i) {
    return i.state === 'tiepnhan' ? 'assign' : (i.state === 'chonghiemthu' ? 'accept' : (i.state === 'hoanthanh' ? 'close' : 'field'));
  }
  function incFlowTabs(all) {
    const mk = (id, label, states, predicate) => ({ id, label, states, predicate, count: 0 });
    let tabs;
    if (incIsTechnician()) {
      tabs = [
        mk('assigned', 'Việc mới', ['phancong']),
        mk('doing', 'Đang xử lý', ['dangxuly']),
        mk('done', 'Đã gửi kết quả', ['chonghiemthu', 'hoanthanh', 'dong']),
        mk('all', 'Tất cả', null)
      ];
    } else if (ui.role === 'ward_leader') {
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
        mk('processing', 'Đang xử lý', ['dangxuly', 'chonghiemthu']),
        mk('completed', 'Hoàn thành / Đóng', ['hoanthanh', 'dong']),
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
  function incWorkflowHint() {
    const steps = incIsTechnician()
      ? ['Xem việc được giao', 'Nhận xử lý', 'Cập nhật tiến độ', 'Cập nhật kết quả']
      : ['Tiếp nhận', 'Phân công kỹ thuật', 'Theo dõi xử lý', 'Hoàn thành / Đóng'];
    return `<div class="inc-flow-steps">${steps.map((s,n)=>`<span>${n+1}. ${s}</span>`).join('')}</div>`;
  }
  function incRows(rows) {
    return rows.map(i => {
      const st = A.idx.stall.get(i.stallId) || {}, a = incAsset(i), act = incAction(i), canAct = act && act[0] !== 'inc-open' && incCan(i, incPermissionAction(i));
      return `<tr>
        <td><b>${i.id}</b><div class="small muted">${incFmt(i.created)}</div></td>
        <td><b>${U.esc(i.title)}</b><div class="small muted">${U.esc(i.cat)} · ${U.esc(i.source || '')}</div></td>
        <td>${U.esc(st.code || '—')}${a ? `<div class="small muted">${U.esc(a.code)} · ${U.esc(a.name)}</div>` : ''}</td>
        <td><span class="tag info">${stLabel(i.state)}</span>${late(i)?' <span class="tag danger">Quá hạn</span>':''}${i.leaderReminder?' <span class="tag warn">Đã nhắc BQL</span>':''}${i.escalated?' <span class="tag purple">Vượt cấp</span>':''}</td>
        <td>${U.esc(incStaff(i))}<div class="small muted">Hạn: ${incFmt(i.deadline)}</div></td>
        <td class="nowrap"><button class="btn sm" data-act="inc-open" data-id="${i.id}">Xem</button>${canAct?` <button class="btn sm primary" data-act="${act[0]}" data-id="${i.id}">${act[1]}</button>`:''}</td>
      </tr>`;
    });
  }
  A.VIEWS['su-co'] = function () {
    ensureIncidentV2();
    const marketName = U.mShort(ui.market);
    const all = A.db.incidents.filter(i => incCanView(i) && (!ui.incCat || i.cat === ui.incCat));
    const tech = incIsTechnician();
    const overdue = all.filter(late);
    const reminded = overdue.filter(i => i.leaderReminder);
    const title = tech ? 'Công việc kỹ thuật được giao' : 'Phản ánh & sự cố';
    const desc = tech
      ? 'Nhận xử lý, cập nhật tiến độ và gửi kết quả cho phản ánh đã được phân công tại ' + marketName + '.'
      : 'Tiếp nhận, phân công và theo dõi xử lý phản ánh tại ' + marketName + '.';
    const tabs = incFlowTabs(all);
    if (!tabs.some(t => t.id === ui.incFlowTab)) ui.incFlowTab = tabs[0] && tabs[0].id;
    const tab = tabs.find(t => t.id === ui.incFlowTab) || tabs[0];
    const rows = all.filter(i => incTabMatch(i, tab));
    const reminderHtml = !tech && overdue.length ? `<div class="note warn" style="margin-bottom:12px"><b>Nhắc Trưởng Ban Quản lý:</b> ${reminded.length}/${overdue.length} phản ánh quá hạn tại ${U.esc(marketName)} đã được hệ thống đánh dấu nhắc xử lý.</div>` : '';
    return `<div class="page-head"><div><h2>${title}</h2><p class="muted">${desc}</p></div>${!tech && A.canDo('su-co.tao-phan-anh', ui.market) ? '<button class="btn primary" data-act="inc-new-v2">+ Tạo phản ánh</button>' : ''}</div>
      <div class="kpis"><div class="card kpi"><div class="k-label">${tech ? 'Được giao' : 'Đang mở'}</div><div class="k-value">${all.filter(isOpen).length}</div></div><div class="card kpi"><div class="k-label">Quá hạn</div><div class="k-value" style="color:#df2225">${overdue.length}</div><div class="k-sub">Điện/PCCC 1 ngày · nhóm khác 3 ngày</div></div><div class="card kpi"><div class="k-label">${tech ? 'Đã nhắc BQL' : 'Nhắc Trưởng BQL'}</div><div class="k-value">${reminded.length}</div></div><div class="card kpi"><div class="k-label">${tech ? 'Cần thao tác' : 'Chờ tiếp nhận'}</div><div class="k-value">${all.filter(i=>tech?(i.state==='phancong'||i.state==='dangxuly'):i.state==='tiepnhan').length}</div></div></div>
      <div class="card"><div class="card-h"><h3>${tech ? 'Danh sách xử lý kỹ thuật' : 'Hàng đợi phản ánh'}</h3><select class="input" data-ch="inc-cat"><option value="">Mọi nhóm</option>${incCats().map(c=>`<option ${ui.incCat===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="card-b">${reminderHtml}${incWorkflowHint()}${incTabBar(tabs, tab.id)}
        ${U.table([{t:'Mã / thời gian'}, {t:'Nội dung'}, {t:'Vị trí / tài sản'}, {t:'Trạng thái'}, {t:'Người xử lý / hạn'}, {t:''}], incRows(rows), { empty: tech ? 'Không có công việc kỹ thuật phù hợp.' : 'Không có phản ánh trong hàng đợi này.' })}
      </div></div>`;
  };
  A.ACT['inc-flow-tab'] = el => { ui.incFlowTab = el.dataset.id; A.render(); };
  A.ACT['inc-open'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id); if(!incCanView(i))return; ui.incDetailTab='overview'; openIncident(i); };
  A.ACT['inc-detail-tab'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id); if(!incCanView(i))return; ui.incDetailTab=el.dataset.tab; openIncident(i); };
  A.CH['inc-images'] = el => { const list=A.$(`[data-image-list="${el.dataset.kind}"]`); const files=Array.from(el.files||[]); ui.incImageDraft=ui.incImageDraft||{}; ui.incImageDraft[el.dataset.kind]=files.map(f=>({name:f.name,url:URL.createObjectURL(f)})); if(list) list.innerHTML=ui.incImageDraft[el.dataset.kind].map((x,n)=>`<div class="inc-image-thumb"><img src="${x.url}" alt=""><span>${U.esc(x.name)}</span><button class="x" data-act="inc-image-remove" data-kind="${el.dataset.kind}" data-n="${n}">×</button></div>`).join(''); };
  A.ACT['inc-image-remove'] = el => { const xs=(ui.incImageDraft||{})[el.dataset.kind]||[]; const x=xs.splice(Number(el.dataset.n),1)[0]; if(x)URL.revokeObjectURL(x.url); const box=A.$(`[data-image-list="${el.dataset.kind}"]`); if(box)box.innerHTML=xs.map((v,n)=>`<div class="inc-image-thumb"><img src="${v.url}" alt=""><span>${U.esc(v.name)}</span><button class="x" data-act="inc-image-remove" data-kind="${el.dataset.kind}" data-n="${n}">×</button></div>`).join(''); };
  function incDraftNames(kind) { return ((ui.incImageDraft||{})[kind]||[]).map(x=>x.name); }
  A.ACT['inc-assign-open'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id); if(!i||i.state!=='tiepnhan'||!incCan(i,'assign'))return; const assets=incAssets(), staff=D.STAFF.filter(s=>s.market===i.market && s.role.indexOf('kỹ thuật') !== -1), due=(i.deadline&&String(i.deadline).indexOf('T')!==-1)?i.deadline:incDefaultDeadline(i.cat,i.created,true); incModal('Tiếp nhận & phân công sự cố',incHeader(i)+incReadonly(i)+`<section class="inc-section"><h4>Phân loại & tài sản liên quan</h4><div class="form-grid"><div class="field"><label>Nhóm sự cố *</label><select class="input" id="ia-cat">${incCats().map(x=>`<option ${x===i.cat?'selected':''}>${x}</option>`).join('')}</select><div class="small muted">Hạn mặc định: Điện/PCCC 1 ngày; nhóm khác 3 ngày.</div></div><div class="field"><label>Tài sản liên quan</label><select class="input" id="ia-asset"><option value="">Không xác định / Không liên quan tài sản</option>${assets.map(a=>`<option value="${a.id}" ${i.assetId===a.id?'selected':''}>${U.esc(a.code)} · ${U.esc(a.name)}</option>`).join('')}</select></div></div></section><section class="inc-section"><h4>Phân công</h4><div class="form-grid"><div class="field"><label>Người xử lý *</label><select class="input" id="ia-assignee"><option value="">Chọn nhân viên kỹ thuật</option>${staff.map(s=>`<option value="${s.id}" ${i.assignee===s.id?'selected':''}>${U.esc(s.name)} · ${U.esc(s.role)}</option>`).join('')}</select></div><div class="field"><label>Hạn xử lý *</label><input class="input" type="datetime-local" id="ia-due" value="${due}"></div></div><div class="field"><label>Ghi chú phân công</label><textarea class="input" id="ia-note" rows="2"></textarea></div></section>`,`<button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inc-assign-save" data-id="${i.id}">Xác nhận phân công</button>`); };
  A.ACT['inc-assign-save'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id), as=A.$('#ia-assignee').value, due=A.$('#ia-due').value; if(!i||i.state!=='tiepnhan'||!incCan(i,'assign'))return; if(!as||!due){U.toast('Vui lòng chọn người xử lý và hạn xử lý.');return;} const staff=D.STAFF.find(s=>s.id===as&&s.market===i.market&&s.role.indexOf('kỹ thuật')!==-1); if(!staff){U.toast('Người xử lý phải là nhân viên kỹ thuật thuộc chợ đang chọn.');return;} const assetId=A.$('#ia-asset').value||null; if(assetId && !(A.db.marketAssets||[]).some(a=>a.id===assetId&&a.market===i.market)){U.toast('Tài sản liên quan không thuộc chợ đang chọn.');return;} i.cat=A.$('#ia-cat').value;i.assetId=assetId;i.assignee=as;i.deadline=due;i.assignmentNote=A.$('#ia-note').value.trim();i.state='phancong';incHistory(i,'Phân công xử lý',incStaff(i)+' · Hạn: '+incFmt(due));A.save();A.closeModal();A.render();U.toast('Đã phân công xử lý.'); };
  A.ACT['inc-inspect-open'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id),a=incAsset(i); if(!i||i.state!=='phancong'||!incCan(i,'transition'))return;ui.incImageDraft={};incModal('Kiểm tra hiện trường',incHeader(i)+`<section class="inc-section"><dl class="kv"><dt>Người xử lý</dt><dd>${U.esc(incStaff(i))}</dd><dt>Hạn xử lý</dt><dd>${incFmt(i.deadline)}</dd><dt>Tài sản liên quan</dt><dd>${a?U.esc(a.code+' · '+a.name):'—'}</dd><dt>Vị trí</dt><dd>${a?U.esc(a.locationLabel):'—'}</dd></dl></section><section class="inc-section"><h4>Kết quả kiểm tra</h4><div class="form-grid"><div class="field"><label>Thời gian kiểm tra *</label><input class="input" type="datetime-local" id="ii-at" value="${incNow()}"></div></div><div class="field"><label>Tình trạng thực tế *</label><textarea class="input" id="ii-condition" rows="3"></textarea></div><div class="field"><label>Ghi chú kỹ thuật</label><textarea class="input" id="ii-note" rows="2"></textarea></div></section><section class="inc-section"><h4>Hình ảnh hiện trường <span class="muted small">(không bắt buộc)</span></h4>${incImageInput('inspection')}</section>`,`<button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inc-inspect-save" data-id="${i.id}">Bắt đầu xử lý</button>`); };
  A.ACT['inc-inspect-save'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id),at=A.$('#ii-at').value,c=A.$('#ii-condition').value.trim();if(!i||i.state!=='phancong'||!incCan(i,'transition'))return;if(!at||!c){U.toast('Vui lòng nhập thời gian và tình trạng thực tế.');return;}i.inspection={at,by:i.assignee,condition:c,note:A.$('#ii-note').value.trim()};i.images.inspection=incDraftNames('inspection');i.state='dangxuly';incHistory(i,'Kiểm tra hiện trường',c);incHistory(i,'Bắt đầu xử lý','');A.save();A.closeModal();A.render();U.toast('Đã bắt đầu xử lý.'); };
  function workModal(i) { const w=i.work||{}; ui.incImageDraft={}; incModal('Cập nhật kết quả xử lý',incHeader(i)+`<section class="inc-section"><dl class="kv"><dt>Tài sản</dt><dd>${incAsset(i)?U.esc(incAsset(i).code):'—'}</dd><dt>Người xử lý</dt><dd>${U.esc(incStaff(i))}</dd><dt>Kết quả kiểm tra</dt><dd>${U.esc((i.inspection||{}).condition||'Chưa có')}</dd></dl></section><section class="inc-section"><h4>Nội dung xử lý</h4><div class="field"><label>Nội dung xử lý *</label><textarea class="input" id="iw-content" rows="3">${U.esc(w.content||'')}</textarea></div><div class="field"><label>Kết quả sau xử lý *</label><textarea class="input" id="iw-result" rows="3">${U.esc(w.result||'')}</textarea></div><div class="form-grid"><div class="field"><label>Thời gian hoàn thành *</label><input class="input" type="datetime-local" id="iw-at" value="${w.completedAt||incNow()}"></div></div><div class="field"><label>Ghi chú</label><textarea class="input" id="iw-note" rows="2">${U.esc(w.note||'')}</textarea></div></section><section class="inc-section"><h4>Hình ảnh sau xử lý <span class="muted small">(không bắt buộc)</span></h4>${incImageInput('work')}</section>`,`<button class="btn" data-act="close">Hủy</button><button class="btn" data-act="inc-work-save" data-id="${i.id}">Lưu cập nhật</button><button class="btn primary" data-act="inc-work-submit" data-id="${i.id}">Cập nhật hoàn thành</button>`); }
  A.ACT['inc-work-open'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id);if(i&&i.state==='dangxuly'&&incCan(i,'transition'))workModal(i); };
  function saveWork(i, submit) { const content=A.$('#iw-content').value.trim(),result=A.$('#iw-result').value.trim(),at=A.$('#iw-at').value;if(!i||i.state!=='dangxuly'||!incCan(i,'transition'))return false;if(submit&&(!content||!result||!at)){U.toast('Vui lòng nhập nội dung, kết quả và thời gian hoàn thành.');return false;}i.work={content,result,completedAt:at,note:A.$('#iw-note').value.trim()};i.images.work=incDraftNames('work');if(submit){i.state='hoanthanh';incHistory(i,'Cập nhật kết quả hoàn thành',result);incHistory(i,'Thông báo kết quả cho người phản ánh','');}else incHistory(i,'Cập nhật xử lý',content||'Lưu bản nháp');A.save();A.closeModal();A.render();U.toast(submit?'Đã cập nhật hoàn thành và thông báo kết quả.':'Đã lưu cập nhật.');return true; }
  A.ACT['inc-work-save'] = el => saveWork(A.db.incidents.find(x=>x.id===el.dataset.id),false);
  A.ACT['inc-work-submit'] = el => saveWork(A.db.incidents.find(x=>x.id===el.dataset.id),true);
  A.ACT['inc-accept-open'] = el => { const i=A.db.incidents.find(x=>x.id===el.dataset.id);if(!i||i.state!=='chonghiemthu'||!incCan(i,'accept'))return;incModal('Nghiệm thu kết quả xử lý',incHeader(i)+`<section class="inc-section"><h4>Trước xử lý</h4><p>${U.esc((i.inspection||{}).condition||'—')}</p></section><section class="inc-section"><h4>Kết quả xử lý</h4><p><b>Nội dung:</b> ${U.esc((i.work||{}).content||'—')}</p><p><b>Kết quả:</b> ${U.esc((i.work||{}).result||'—')}</p><p><b>Hoàn thành:</b> ${incFmt((i.work||{}).completedAt)}</p></section><section class="inc-section"><h4>Nghiệm thu</h4><div class="field"><label>Kết quả *</label><label><input type="radio" name="ia-result" value="pass" checked data-ch="inc-accept-result"> Đạt</label><label><input type="radio" name="ia-result" value="rework" data-ch="inc-accept-result"> Chưa đạt - yêu cầu xử lý lại</label></div><div class="form-grid"><div class="field"><label>Người nghiệm thu *</label><select class="input" id="ia-by">${D.STAFF.filter(s=>s.market===i.market).map(s=>`<option value="${s.id}">${U.esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>Thời gian nghiệm thu *</label><input class="input" type="datetime-local" id="ia-at" value="${incNow()}"></div></div><div class="field"><label>Ý kiến nghiệm thu</label><textarea class="input" id="ia-note" rows="2"></textarea></div><div class="field" id="ia-rework-wrap" hidden><label>Yêu cầu xử lý lại *</label><textarea class="input" id="ia-rework" rows="2"></textarea></div></section>`,`<button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inc-accept-save" data-id="${i.id}">Xác nhận nghiệm thu</button>`); };
  A.CH['inc-accept-result'] = el => { const wrap=A.$('#ia-rework-wrap'); if(wrap) wrap.hidden=el.value!=='rework'; };
  A.ACT['inc-accept-save'] = el => {const i=A.db.incidents.find(x=>x.id===el.dataset.id),r=(A.$('input[name="ia-result"]:checked')||{}).value,by=A.$('#ia-by').value,at=A.$('#ia-at').value,re=A.$('#ia-rework').value.trim();if(!i||i.state!=='chonghiemthu'||!incCan(i,'accept'))return;if(!by||!at||(r==='rework'&&!re)){U.toast(r==='rework'?'Vui lòng nhập yêu cầu xử lý lại.':'Vui lòng nhập người và thời gian nghiệm thu.');return;}if(!D.STAFF.some(s=>s.id===by&&s.market===i.market)){U.toast('Người nghiệm thu không thuộc chợ đang chọn.');return;}i.acceptance={result:r,by,at,note:A.$('#ia-note').value.trim(),rework:re};i.state=r==='pass'?'hoanthanh':'dangxuly';incHistory(i,r==='pass'?'Nghiệm thu đạt':'Nghiệm thu chưa đạt',r==='pass'?'':'Yêu cầu xử lý lại: '+re);A.save();A.closeModal();A.render();U.toast(r==='pass'?'Đã nghiệm thu đạt.':'Đã trả lại để xử lý.');};
  A.ACT['inc-close-open'] = el => {const i=A.db.incidents.find(x=>x.id===el.dataset.id);if(!i||i.state!=='hoanthanh'||!incCan(i,'close'))return;const accepted=i.acceptance&&i.acceptance.result==='pass';incModal('Đóng sự cố',incHeader(i)+`<section class="inc-section"><div class="inc-check">✓ Đã xử lý</div>${accepted?'<div class="inc-check">✓ Đã nghiệm thu đạt</div>':'<div class="inc-check">✓ Đã thông báo kết quả cho người phản ánh</div>'}<dl class="kv"><dt>Người xử lý</dt><dd>${U.esc(incStaff(i))}</dd>${accepted?`<dt>Người nghiệm thu</dt><dd>${U.esc(U.staffName((i.acceptance||{}).by))}</dd>`:''}<dt>Hoàn thành</dt><dd>${incFmt((i.work||{}).completedAt)}</dd></dl><div class="field"><label>Ghi chú khi đóng</label><textarea class="input" id="ic-note" rows="2"></textarea></div></section>`,`<button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inc-close-save" data-id="${i.id}">Đóng sự cố</button>`);};
  A.ACT['inc-close-save'] = el => {const i=A.db.incidents.find(x=>x.id===el.dataset.id);if(!i||i.state!=='hoanthanh'||!incCan(i,'close'))return;i.closeInfo={at:incNow(),note:A.$('#ic-note').value.trim()};i.state='dong';incHistory(i,'Đóng sự cố',i.closeInfo.note);A.save();A.closeModal();A.render();U.toast('Đã đóng sự cố.');};
  A.ACT['inc-new-v2'] = () => { if(!A.canDo('su-co.tao-phan-anh',ui.market))return;ui.incImageDraft={};const stalls=A.db.stalls.filter(s=>s.market===ui.market);incModal('Tạo phản ánh / sự cố',`<section class="inc-section"><div class="form-grid"><div class="field"><label>Nguồn</label><input class="input" value="Nhập tại Ban Quản lý" disabled></div><div class="field"><label>Nhóm *</label><select class="input" id="in2-cat">${incCats().map(c=>`<option>${c}</option>`).join('')}</select></div><div class="field"><label>Điểm KD</label><select class="input" id="in2-stall"><option value="">Không xác định</option>${stalls.map(s=>`<option value="${s.id}">${s.code}</option>`).join('')}</select></div><div class="field"><label>Tài sản liên quan</label><select class="input" id="in2-asset"><option value="">Không xác định / Không liên quan</option>${incAssets().map(a=>`<option value="${a.id}">${U.esc(a.code)} · ${U.esc(a.name)}</option>`).join('')}</select></div></div><div class="field"><label>Tiêu đề *</label><input class="input" id="in2-title"></div><div class="field"><label>Nội dung *</label><textarea class="input" id="in2-desc" rows="3"></textarea></div></section><section class="inc-section"><h4>Ảnh <span class="muted small">(không bắt buộc)</span></h4>${incImageInput('report')}</section>`,`<button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inc-new-v2-save">Tạo phản ánh</button>`);};
  A.ACT['inc-new-v2-save'] = () => {if(!A.canDo('su-co.tao-phan-anh',ui.market))return;const title=A.$('#in2-title').value.trim(),desc=A.$('#in2-desc').value.trim(),stall=A.idx.stall.get(A.$('#in2-stall').value),cat=A.$('#in2-cat').value,assetId=A.$('#in2-asset').value||null;if(!title||!desc){U.toast('Vui lòng nhập tiêu đề và nội dung.');return;}if(stall&&stall.market!==ui.market){U.toast('Điểm kinh doanh không thuộc chợ đang chọn.');return;}if(assetId&&!(A.db.marketAssets||[]).some(a=>a.id===assetId&&a.market===ui.market)){U.toast('Tài sản liên quan không thuộc chợ đang chọn.');return;}const id='SC-'+U.pad(101+A.db.incidents.length,4),created=incNow(),due=incDefaultDeadline(cat,created,true);const i={id,market:ui.market,stallId:stall&&stall.id,traderId:stall&&stall.traderId,assetId,cat,title,desc,source:'Nhập tại Ban Quản lý',state:'tiepnhan',created,deadline:due,assignee:null,rating:null,escalated:false,images:{report:incDraftNames('report'),inspection:[],work:[]},history:[{at:created,action:'Tiếp nhận phản ánh',detail:'Nguồn: Nhập tại Ban Quản lý · hạn mặc định '+incDeadlineRuleText(cat)}],log:[]};A.db.incidents.push(i);A.save();A.closeModal();A.render();U.toast('Đã tạo '+id);};
})(window.APP);
