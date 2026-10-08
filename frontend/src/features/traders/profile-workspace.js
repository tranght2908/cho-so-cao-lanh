/* Unified trader-profile workspace.  Rental draft is profile preparation only;
 * contracts remain the source of occupancy, billing and historical truth. */
(function (A) {
  'use strict';
  if (!A || !A.features || !A.features.traders) return;
  const U=A.U, ui=A.ui, TS=A.features.traders.service, BP=A.features.businessPoints.service,
    CS=A.features.contracts.service;
  const state=ui.traderWorkspace || (ui.traderWorkspace={q:'',status:'',contract:'',areaType:'',wizard:null,detail:null,tab:'overview'});
  const canEdit=m=>A.canDo('tieu-thuong.them-moi',m);
  const rental=t=>TS.rentalItems(t);
  const label=s=>({PENDING_CONTRACT:'Chờ tạo hợp đồng',ACTIVE:'Đang hoạt động',INACTIVE:'Ngừng hoạt động',WAITING_ALLOCATION:'Chưa hoàn thiện'})[s]||'Chưa hoàn thiện';
  const tag=s=>`<span class="tag ${s==='ACTIVE'?'ok':s==='PENDING_CONTRACT'?'warn':''}">${label(s)}</span>`;
  const point=id=>BP.get(id);
  const location=p=>p?BP.location(p).label:'—';
  const areaType=p=>p?(U.areaTypeLabel(p.areaTypeId||p.areaType)||'—'):'—';
  const feeFor=(p,charges)=>{
    const billing=A.features.finance && A.features.finance.billing;
    const terms=billing&&billing.buildPriceTerms?billing.buildPriceTerms(p.market,p,p.area,U.today(),charges||{},'PROFILE_DRAFT'):null;
    return terms||null;
  };
  const nextId=()=>{const n=TS.list().reduce((m,t)=>Math.max(m,+((String(t.id).match(/TT(\d+)/)||[,0])[1])),0);return 'TT'+U.pad(n+1,4);};
  function filtered(){const q=(state.q||'').toLowerCase();return TS.list().filter(t=>t.market===ui.market).filter(t=>{const s=TS.deriveBusinessStatus(t);const c=CS.listByTrader(t.id);return(!q||[t.name,t.phone,t.idNo,t.id].join(' ').toLowerCase().includes(q))&&(!state.status||s===state.status)&&(!state.contract||(state.contract==='ACTIVE'?c.some(CS.isActive):state.contract==='NONE'?!c.some(CS.isActive):true))&&(!state.areaType||rental(t).some(x=>x.areaTypeId===state.areaType));});}
  function view(){const rows=filtered(), all=TS.list().filter(t=>t.market===ui.market), counts={};all.forEach(t=>{const s=TS.deriveBusinessStatus(t);counts[s]=(counts[s]||0)+1;});return `<div class="page-head"><div><h2>Hồ sơ tiểu thương</h2><p>Quản lý thông tin tiểu thương, hồ sơ giấy tờ và các điểm kinh doanh đăng ký thuê.</p></div>${canEdit(ui.market)?'<button class="btn primary" data-act="tp-new">+ Tạo hồ sơ tiểu thương</button>':''}</div><div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px">${[['Tổng hồ sơ',all.length],['Đang hoạt động',counts.ACTIVE||0],['Chờ tạo hợp đồng',counts.PENDING_CONTRACT||0],['Chưa hoàn thiện',(counts.WAITING_ALLOCATION||0)]].map(x=>`<div class="card" style="padding:12px"><div class="small muted">${x[0]}</div><b style="font-size:22px">${x[1]}</b></div>`).join('')}</div><div class="card"><div class="card-h" style="flex-wrap:wrap;gap:8px"><input class="input" data-in="tp-q" placeholder="Tìm tên / SĐT / số giấy tờ..." value="${U.esc(state.q)}"><select class="input" data-ch="tp-status"><option value="">Trạng thái hồ sơ: Tất cả</option>${['WAITING_ALLOCATION','PENDING_CONTRACT','ACTIVE','INACTIVE'].map(s=>`<option value="${s}" ${state.status===s?'selected':''}>${label(s)}</option>`).join('')}</select><select class="input" data-ch="tp-contract"><option value="">Trạng thái hợp đồng: Tất cả</option><option value="ACTIVE" ${state.contract==='ACTIVE'?'selected':''}>Còn hiệu lực</option><option value="NONE" ${state.contract==='NONE'?'selected':''}>Chưa có hiệu lực</option></select><select class="input" data-ch="tp-area"><option value="">Loại diện tích: Tất cả</option>${['covered','uncovered','self_produced'].map(x=>`<option value="${x}" ${state.areaType===x?'selected':''}>${U.esc(U.areaTypeLabel(x)||x)}</option>`).join('')}</select><button class="btn" data-act="tp-clear">Xóa bộ lọc</button></div><div class="card-b">${rows.length?U.table([{t:'Mã hồ sơ'},{t:'Tiểu thương'},{t:'Số điện thoại'},{t:'Giấy tờ'},{t:'Điểm KD thuê'},{t:'Loại diện tích'},{t:'Hợp đồng'},{t:'Trạng thái'},{t:'Thao tác'}],rows.map(t=>{const items=rental(t),cts=CS.listByTrader(t.id),codes=items.map(x=>(point(x.pointId)||{}).code).filter(Boolean),types=[...new Set(items.map(x=>U.areaTypeLabel(x.areaTypeId)||x.areaTypeId))];return `<tr><td><b>${U.esc(t.id)}</b></td><td>${U.esc(t.name)}</td><td>${U.esc(t.phone||'—')}</td><td>${U.esc(t.idType||'CCCD')} · ${U.maskId(t.idNo||'')}</td><td title="${U.esc(codes.join(', '))}">${U.esc(codes.slice(0,2).join(', ')||'—')}${codes.length>2?' +'+(codes.length-2):''}</td><td>${U.esc(types.join(', ')||'—')}</td><td>${cts.filter(CS.isActive).map(x=>x.id).join(', ')||'—'}</td><td>${tag(TS.deriveBusinessStatus(t))}${(n=>TS.deriveBusinessStatus(t)==='ACTIVE'&&n?`<div class="small muted">Còn ${n} điểm chờ tạo hợp đồng</div>`:'')(items.filter(x=>x.status==='pending_contract').length)}</td><td><button class="btn sm" data-act="tp-view" data-id="${t.id}">Xem</button></td></tr>`;}),{empty:'Chưa có hồ sơ tiểu thương.'}):'<div class="empty">Chưa có hồ sơ tiểu thương.</div>'}</div></div>`;}
  function draft(){return state.wizard;}
  // ---- Form hồ sơ tiểu thương (tạo + sửa): MỘT trang liên tục, không wizard ----
  // A. Thông tin cá nhân → B. Hồ sơ giấy tờ (+ OCR tùy chọn) → C. Điểm KD & khoản thu → D. Tổng hợp → [Hủy][Lưu hồ sơ].
  // Mỗi ô nhập ghi thẳng vào draft (data-in) nên upload ảnh / chọn điểm / OCR không làm mất dữ liệu đang gõ.
  // Domain giữ nguyên: lưu = hồ sơ + trader.rentalDraft (TS.setRentalDraft); không tạo hợp đồng, không phân bổ điểm,
  // không billing. "Chờ tạo hợp đồng" vẫn suy từ rentalDraft (TS.deriveBusinessStatus).
  const ID_TYPES=['CCCD','CMND','Hộ chiếu'];
  const REQUIRED_DOCS=['cccdFront','cccdBack','avatar'];
  const FIELDS={name:'Họ và tên',idType:'Loại giấy tờ',idNo:'Số giấy tờ',address:'Địa chỉ'};
  const previews=()=>state.previews||(state.previews={});
  const pct=v=>Math.round((Number(v)||0)*100)+'%';
  const docLabel=k=>((TS.DOC_DEFS||[]).find(x=>x.key===k)||{}).label||k;
  const missingDocs=d=>REQUIRED_DOCS.filter(k=>!d.files[k]);
  // Khoản thu của chợ khai báo "không áp dụng" (Chính sách thu) → không chọn được cho điểm.
  const CHARGE_OF={electricity:'electricity',water:'water',marketService:'service'};
  const chargeOff=(market,k)=>{const c=A.SERVICE_CFG&&A.SERVICE_CFG.chargeApplicability?A.SERVICE_CFG.chargeApplicability(market):null;return !!c&&c[CHARGE_OF[k]]===false;};
  const locked=x=>x.status==='contracted'||!!x.contractId;
  // OCR: tùy chọn hỗ trợ nhập liệu (provider hiện tại là OCR DEMO). Chỉ bật khi có ảnh CCCD mặt trước; kết quả là
  // gợi ý, chỉ vào biểu mẫu khi bấm "Áp dụng" — ô đã có dữ liệu khác thì hỏi xác nhận trước khi thay.
  function ocrHtml(d){const o=d.ocr||{},has=!!d.files.cccdFront,can=has&&o.status!=='running';
    const btn=`<div class="tp-ocr-bar"><button class="btn" data-act="tp-ocr-run" ${can?'':'disabled'} title="${has?'Nhận diện thông tin từ ảnh CCCD':'Vui lòng tải ảnh CCCD để sử dụng OCR.'}">${o.status==='running'?'Đang quét…':'Quét thông tin bằng OCR demo'}</button><span class="small muted">OCR demo phục vụ trình diễn, không phải xác thực giấy tờ.</span><span class="small muted">(Tùy chọn)</span></div>`;
    if(o.status==='error')return btn+`<div class="note warn">${U.esc(o.error)}</div>`;
    if(o.status!=='done'||!o.result)return btn;
    const r=o.result,conf=o.confirm||[];
    const actions=o.applied?'<span class="tag ok">Đã áp dụng vào biểu mẫu</span>':conf.length?`<div class="note warn" style="margin:0">Các ô đang có dữ liệu khác: ${conf.map(k=>FIELDS[k]).join(', ')}. Thay bằng kết quả OCR?</div><button class="btn primary" data-act="tp-ocr-apply" data-confirm="1">Thay thế</button><button class="btn" data-act="tp-ocr-cancel">Giữ dữ liệu hiện tại</button>`:'<button class="btn primary" data-act="tp-ocr-apply">Áp dụng vào biểu mẫu</button>';
    return btn+`<div class="tp-ocr-result"><div class="row"><b>Kết quả nhận diện OCR</b><span class="spacer"></span><span class="tag warn">DỮ LIỆU MẪU – KHÔNG CÓ GIÁ TRỊ</span></div><dl class="kv"><dt>Họ và tên</dt><dd>${U.esc(r.fullName)}</dd><dt>Loại giấy tờ</dt><dd>${U.esc(r.documentType)}</dd><dt>Số giấy tờ</dt><dd>${U.esc(r.documentNumber)}</dd><dt>Địa chỉ</dt><dd>${U.esc(r.address)}</dd><dt>Độ tin cậy</dt><dd>${pct(r.confidence)} <span class="small muted">· nguồn ${U.esc(r.source)}</span></dd></dl><div class="row" style="gap:8px;flex-wrap:wrap">${actions}${o.applied||!conf.length?'<button class="btn" data-act="tp-ocr-run">Quét lại</button>':''}</div><div class="small muted">Số điện thoại không lấy từ giấy tờ.</div></div>`;}
  const section=(id,title,sub,body)=>`<section class="card tp-section" id="${id}"><div class="tp-section-h"><h3>${title}</h3><p>${sub}</p></div><div class="tp-section-b">${body}</div></section>`;
  function personalHtml(d,readOnly){const f=(k,label,attrs)=>`<div class="field"><label>${label} *</label><input class="input" id="tp-${k}" ${readOnly?'readonly aria-readonly="true"':'data-in="tp-field" data-k="'+k+'"'} value="${U.esc(d[k])}" ${attrs||''}></div>`;
    return `${d.ocr&&d.ocr.applied?'<div class="note info">Một số ô được điền từ OCR (dữ liệu mẫu). Vui lòng kiểm tra và chỉnh sửa nếu cần.</div>':''}<div class="form-grid tp-grid">${f('name','Họ và tên')}${f('phone','Số điện thoại','inputmode="tel" placeholder="Nhập tay"')}<div class="field"><label>Loại giấy tờ *</label><select class="input" id="tp-idType" ${readOnly?'disabled aria-readonly="true"':'data-in="tp-field" data-k="idType"'}>${ID_TYPES.map(x=>`<option ${d.idType===x?'selected':''}>${x}</option>`).join('')}</select></div>${f('idNo','Số giấy tờ')}<div class="field tp-span"><label>Địa chỉ *</label><textarea class="input" id="tp-address" ${readOnly?'readonly aria-readonly="true"':'data-in="tp-field" data-k="address"'} rows="2">${U.esc(d.address)}</textarea></div></div>`;}
  function docsHtml(d,readOnly){const docs=TS.DOC_DEFS||[];
    const cards=docs.map(x=>{const f=d.files[x.key],url=previews()[x.key],actions=readOnly?'':`<div class="row" style="gap:6px"><button class="btn sm" data-act="tp-file" data-key="${x.key}">${f?'Thay ảnh':'Chọn ảnh'}</button>${f?`<button class="btn sm" data-act="tp-file-remove" data-key="${x.key}">Xóa</button>`:''}</div>`;return `<div class="tp-doc"><div class="tp-doc-thumb">${url?`<img src="${U.esc(url)}" alt="${U.esc(x.label)}">`:f?'<span>📄</span>':'<span class="muted small">Chưa có ảnh</span>'}</div><div class="tp-doc-b"><b>${x.label}${REQUIRED_DOCS.includes(x.key)?' <span class="tp-req" title="Cần có để hồ sơ đầy đủ">●</span>':''}</b><div class="small muted tp-doc-name">${f?U.esc(f.name):'JPG / JPEG / PNG'}</div>${actions}</div></div>`;}).join('');
    const miss=missingDocs(d);
    return `<div class="tp-docs">${cards}</div>${miss.length?`<div class="small muted">● Cần có để hồ sơ đầy đủ — có thể bổ sung sau: ${miss.map(docLabel).join(', ')}.</div>`:''}${readOnly?'':ocrHtml(d)}`;}
  function pointsHtml(d,readOnly){
    const rows=d.items.map(x=>{const p=point(x.pointId);if(!p)return '';const lock=locked(x),terms=feeFor(p,x.charges);
      const check=k=>{const off=chargeOff(p.market,k),dis=readOnly||lock||off;return `<td class="tp-c"><input type="checkbox" ${readOnly?'':'data-ch="tp-charge" data-id="'+p.id+'" data-key="'+k+'"'} ${x.charges[k]&&!off?'checked':''} ${dis?'disabled':''} title="${off?'Không áp dụng tại chợ này':lock?'Đã có hợp đồng':''}" aria-label="${k}"></td>`;};
      return `<tr><td><b>${U.esc(p.code)}</b>${lock?`<div class="small muted">HĐ ${U.esc(x.contractId||'')}</div>`:''}</td><td>${U.esc(location(p))}</td><td class="num">${p.area} m²</td><td>${U.esc(areaType(p))}</td><td>${U.esc(BP.industry(p)||'—')}</td><td class="nowrap">${terms&&terms.land?U.money(terms.land.amount||0)+' '+U.esc(terms.land.unit||''):'<span class="small muted">Chưa cấu hình</span>'}</td>${check('electricity')}${check('water')}${check('marketService')}<td>${readOnly?'<span class="small muted">Chỉ xem</span>':lock?'<span class="small muted">Đã ký</span>':`<button class="btn sm" data-act="tp-remove-point" data-id="${p.id}">Xóa</button>`}</td></tr>`;});
    const picker=readOnly?'':`<div class="row" style="margin-bottom:10px"><button class="btn primary" data-act="tp-select-points">+ Chọn điểm kinh doanh</button><span class="small muted">Chỉ điểm còn trống. Mỗi điểm là một dòng độc lập; mặt bằng lấy từ Chính sách thu, không nhập tay.</span></div>`;
    return `${picker}${d.items.length?`<div class="tbl-wrap">${U.table([{t:'Mã điểm'},{t:'Vị trí'},{t:'Diện tích',num:true},{t:'Loại diện tích'},{t:'Ngành hàng'},{t:'Mặt bằng'},{t:'Điện'},{t:'Nước'},{t:'Dịch vụ'},{t:'Thao tác'}],rows)}</div>`:'<div class="empty small">Chưa chọn điểm kinh doanh. Có thể lưu hồ sơ trước và bổ sung điểm sau.</div>'}`;}
  function summaryHtml(d){const ps=d.items.map(x=>point(x.pointId)).filter(Boolean),n=k=>d.items.filter(x=>x.charges&&x.charges[k]&&!chargeOff(ui.market,k)).length;
    const types=Array.from(new Set(ps.map(p=>areaType(p)))).join(', ')||'—';
    const kpi=(l,v)=>`<div class="tp-kpi"><span>${l}</span><b>${v}</b></div>`;
    return `<div class="tp-kpis">${kpi('Tổng số điểm',ps.length)}${kpi('Tổng diện tích',ps.reduce((s,p)=>s+(Number(p.area)||0),0).toLocaleString('vi-VN')+' m²')}${kpi('Loại diện tích',U.esc(types))}${kpi('Mặt bằng',d.items.length+' điểm')}${kpi('Điện',n('electricity')+' điểm')}${kpi('Nước',n('water')+' điểm')}${kpi('Dịch vụ',n('marketService')+' điểm')}</div><div class="small muted">Chưa tính tiền theo tháng — số tiền chỉ được chốt khi tạo hợp đồng.</div>`;}
  function profileFormSections(d,readOnly){return `
      ${section('tp-sec-a','A. Thông tin cá nhân','Thông tin bắt buộc; số điện thoại và số giấy tờ không trùng hồ sơ khác trong chợ.',personalHtml(d,readOnly))}
      ${section('tp-sec-b','B. Hồ sơ giấy tờ','Tải ảnh ngay hoặc bổ sung sau. OCR là tùy chọn hỗ trợ nhập liệu.',docsHtml(d,readOnly))}
      ${section('tp-sec-c','C. Điểm kinh doanh & khoản thu','Chọn các điểm còn trống và khoản thu áp dụng cho từng điểm.',pointsHtml(d,readOnly))}
      ${section('tp-sec-d','D. Tổng hợp','Tóm tắt đăng ký thuê của hồ sơ.',summaryHtml(d))}`;}
  function wizard(){const d=draft();
    return `<div class="tp-form"><div class="page-head"><div><h2>${d.editId?'Chỉnh sửa hồ sơ tiểu thương':'Tạo hồ sơ tiểu thương'}</h2><p>Nhập thông tin, bổ sung giấy tờ (có thể sau) và chọn điểm kinh doanh đăng ký thuê.</p></div><button class="btn" data-act="tp-wizard-cancel">← Danh sách</button></div>
      ${d.error?`<div class="note warn">${U.esc(d.error)}</div>`:''}
      ${profileFormSections(d,false)}
      <div class="card tp-footer"><span class="spacer"></span><button class="btn" data-act="tp-wizard-cancel">Hủy</button><button class="btn primary" data-act="tp-save">Lưu hồ sơ</button></div></div>`;}
  function pointPicker(){const d=draft(), pts=BP.list().filter(p=>p.market===ui.market&&BP.isAllocatable(p)&&!CS.hasActiveForPoint(p.id));return A.mHead('Chọn điểm kinh doanh')+`<div class="modal-b"><p class="small muted">Chỉ hiển thị điểm còn trống, chưa được hợp đồng khác phân bổ.</p>${U.table([{t:''},{t:'Mã điểm'},{t:'Vị trí'},{t:'Diện tích'},{t:'Loại diện tích'},{t:'Ngành hàng'},{t:'Trạng thái'}],pts.map(p=>`<tr><td><input type="checkbox" data-tp-point="${p.id}" ${d.items.some(x=>x.pointId===p.id)?'checked':''}></td><td><b>${p.code}</b></td><td>${U.esc(location(p))}</td><td>${p.area} m²</td><td>${U.esc(areaType(p))}</td><td>${U.esc(BP.industry(p)||'—')}</td><td>Còn trống</td></tr>`),{empty:'Không còn điểm kinh doanh phù hợp để đăng ký thuê.'})}</div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="tp-points-confirm">Xác nhận chọn</button></div>`;}
  function legacyDetail(t) {
    const items=rental(t), contracts=CS.listByTrader(t.id);
    const pending=items.filter(x=>x.status==='pending_contract').length;
    const pointIds=[...new Set(
      items.map(x=>x.pointId)
        .concat(Array.isArray(t.stalls)?t.stalls:[])
        .concat(contracts.map(c=>c.businessPointId||c.stallId))
        .filter(Boolean)
    )];
    const linkedPoints=pointIds.map(point).filter(Boolean);
    const itemByPoint=id=>items.find(x=>x.pointId===id);
    const pointStatus=p=>A.mbStatusLabel(BP.displayStatus(p,U.today()));
    const contractTag=c=>{const d=CS.DISPLAY_STATUS[CS.displayStatus(c,U.today())];return `<span class="tag ${d.tone}">${U.esc(d.label)}</span>`;};
    const chargeText=x=>{
      if(!x) return '<span class="muted">Chưa có cấu hình thuê lưu trong hồ sơ</span>';
      const c=x.charges||{};
      return `<span class="tp-charge">Mặt bằng</span>${c.electricity?'<span class="tp-charge">Điện</span>':''}${c.water?'<span class="tp-charge">Nước</span>':''}${c.marketService?'<span class="tp-charge">Dịch vụ</span>':''}`;
    };
    const docs=TS.DOC_DEFS||[];
    const documentRows=docs.map(x=>{const f=(t.docFiles||{})[x.key];return `<div class="tp-detail-doc"><b>${U.esc(x.label)}</b><span>${f?U.esc(f.name||'Đã đính kèm'):'Chưa có tệp đính kèm'}</span></div>`;}).join('');
    const pointRows=linkedPoints.map(p=>`<tr><td>${U.esc(U.mShort(p.market))}</td><td><b>${U.esc(p.code)}</b></td><td>${U.esc(location(p))}</td><td class="num">${Number(p.area||0).toLocaleString('vi-VN')} m²</td><td>${U.esc(BP.industry(p)||'—')}</td><td>${U.esc(pointStatus(p))}</td></tr>`);
    const contractRows=contracts.map(c=>{const p=point(c.businessPointId||c.stallId);return `<tr><td><button class="btn link" data-act="ct-view" data-id="${U.esc(c.id)}">${U.esc(c.id)}</button></td><td>${U.esc(p?p.code:'—')}</td><td class="nowrap">${U.dmy(c.start)} → ${U.dmy(c.end)}</td><td>${contractTag(c)}</td></tr>`;});
    const chargeRows=linkedPoints.map(p=>{const x=itemByPoint(p.id);return `<tr><td><b>${U.esc(p.code)}</b></td><td>${U.esc(areaType(p))}</td><td>${chargeText(x)}</td><td>${x&&x.contractId?U.esc(x.contractId):'Chờ tạo hợp đồng'}</td></tr>`;});
    const history=[]
      .concat(Array.isArray(t.history)?t.history:[])
      .concat(contracts.flatMap(c=>(c.history||[]).map(h=>Object.assign({contractId:c.id},h))))
      .sort((a,b)=>String(b.at||b.date||'').localeCompare(String(a.at||a.date||'')));
    const historyRows=history.map(h=>`<tr><td class="nowrap">${U.esc(h.at||h.date||'—')}</td><td>${U.esc(h.by||h.actor||'—')}</td><td>${U.esc(h.action||'—')}</td><td>${U.esc(h.detail||h.content||'—')}</td></tr>`);
    const edit=canEdit(t.market)?`<button class="btn" data-act="tp-edit" data-id="${t.id}">Chỉnh sửa</button> `:'';
    const make=pending&&A.canDo('hop-dong.tao',t.market)?`<button class="btn primary" data-act="tp-contracts" data-id="${t.id}">Tạo hợp đồng</button> `:'';
    const section=(title,content)=>`<section class="tp-detail-section"><h3>${title}</h3>${content}</section>`;
    return `<div class="tp-detail-page">
      <div class="page-head tp-detail-head"><div><h2>${U.esc(t.name)}</h2><div class="tp-detail-meta">Mã hồ sơ: <b>${U.esc(t.id)}</b> ${tag(TS.deriveBusinessStatus(t))}${pending?`<span class="tag warn">Còn ${pending} điểm chờ tạo hợp đồng</span>`:''}</div></div><div>${edit}${make}<button class="btn" data-act="tp-detail-close">Đóng</button></div></div>
      ${section('Thông tin cá nhân',`<div class="tp-detail-kv"><div><span>Mã hồ sơ</span><b>${U.esc(t.id)}</b></div><div><span>Trạng thái hồ sơ</span>${tag(TS.deriveBusinessStatus(t))}</div><div><span>Họ và tên</span><b>${U.esc(t.name||'—')}</b></div><div><span>Số điện thoại</span><b>${U.esc(t.phone||'—')}</b></div><div class="wide"><span>Địa chỉ</span><b>${U.esc(t.address||'—')}</b></div></div>`)}
      ${section('Thông tin giấy tờ',`<div class="tp-detail-kv"><div><span>Loại giấy tờ</span><b>${U.esc(t.idType||'—')}</b></div><div><span>Số giấy tờ</span><b>${U.esc(t.idNo||'—')}</b></div>${t.idIssuedDate||t.issuedDate?`<div><span>Ngày cấp</span><b>${U.esc(t.idIssuedDate||t.issuedDate)}</b></div>`:''}${t.idIssuedPlace||t.issuedPlace?`<div><span>Nơi cấp</span><b>${U.esc(t.idIssuedPlace||t.issuedPlace)}</b></div>`:''}</div><div class="tp-detail-docs">${documentRows||'<div class="empty">Chưa có thông tin giấy tờ.</div>'}</div>`)}
      ${section('Điểm kinh doanh',linkedPoints.length?`<div class="tbl-wrap tp-detail-table">${U.table([{t:'Chợ'},{t:'Mã điểm KD'},{t:'Khu / tầng / dãy'},{t:'Diện tích',num:true},{t:'Ngành hàng'},{t:'Trạng thái'}],pointRows)}</div>`:'<div class="empty">Chưa có điểm kinh doanh liên kết với hồ sơ.</div>')}
      ${section('Hợp đồng thuê',contracts.length?`<div class="tbl-wrap tp-detail-table">${U.table([{t:'Mã hợp đồng'},{t:'Điểm kinh doanh'},{t:'Thời hạn'},{t:'Trạng thái'}],contractRows)}</div>`:'<div class="empty">Chưa có hợp đồng thuê.</div>')}
      ${section('Khoản thu liên quan',linkedPoints.length?`<div class="tbl-wrap tp-detail-table">${U.table([{t:'Điểm kinh doanh'},{t:'Loại diện tích'},{t:'Khoản áp dụng'},{t:'Hợp đồng'}],chargeRows)}</div>`:'<div class="empty">Chưa có khoản thu liên quan vì hồ sơ chưa có điểm kinh doanh.</div>')}
      ${section('Lịch sử thay đổi',history.length?`<div class="tbl-wrap tp-detail-table">${U.table([{t:'Thời gian'},{t:'Người thực hiện'},{t:'Hành động'},{t:'Nội dung thay đổi'}],historyRows)}</div>`:'<div class="empty">Chưa có lịch sử thay đổi.</div>')}
    </div>`;
  }
  function detail(t){
    // The view model deliberately mirrors the edit draft.  It is a detached
    // copy, so rendering a profile never mutates the trader or rentalDraft.
    const d={files:Object.assign({},t.docFiles||{}),name:t.name||'',phone:t.phone||'',idType:t.idType||'CCCD',idNo:t.idNo||'',address:t.address||'',items:rental(t).map(x=>Object.assign({},x,{charges:Object.assign({},x.charges)})),ocr:null};
    const contracts=CS.listByTrader(t.id), pending=d.items.filter(x=>x.status==='pending_contract').length;
    const contractRows=contracts.map(c=>{const p=point(c.businessPointId||c.stallId),s=CS.DISPLAY_STATUS[CS.displayStatus(c,U.today())];return `<tr><td><button class="btn link" data-act="ct-view" data-id="${U.esc(c.id)}">${U.esc(c.id)}</button></td><td>${U.esc(p?p.code:'—')}</td><td class="nowrap">${U.dmy(c.start)} → ${U.dmy(c.end)}</td><td><span class="tag ${s.tone}">${U.esc(s.label)}</span></td></tr>`;});
    const history=[]
      .concat(Array.isArray(t.history)?t.history:[])
      .concat(contracts.flatMap(c=>(c.history||[]).map(h=>Object.assign({contractId:c.id},h))))
      .sort((a,b)=>String(b.at||b.date||'').localeCompare(String(a.at||a.date||'')));
    const historyRows=history.map(h=>`<tr><td class="nowrap">${U.esc(h.at||h.date||'—')}</td><td>${U.esc(h.by||h.actor||'—')}</td><td>${U.esc(h.action||'—')}</td><td>${U.esc(h.detail||h.content||'—')}</td></tr>`);
    const edit=canEdit(t.market)?`<button class="btn" data-act="tp-edit" data-id="${t.id}">Chỉnh sửa</button> `:'';
    const make=pending&&A.canDo('hop-dong.tao',t.market)?`<button class="btn primary" data-act="tp-contracts" data-id="${t.id}">Tạo hợp đồng</button> `:'';
    return `<div class="tp-form tp-form-view"><div class="page-head"><div><h2>Xem hồ sơ tiểu thương</h2><p>${U.esc(t.name)} · Mã hồ sơ: ${U.esc(t.id)} ${tag(TS.deriveBusinessStatus(t))}${pending?` <span class="tag warn">Còn ${pending} điểm chờ tạo hợp đồng</span>`:''}</p></div><div>${edit}${make}<button class="btn" data-act="tp-detail-close">Đóng</button></div></div>
      ${profileFormSections(d,true)}
      ${section('tp-sec-related','E. Thông tin liên quan','Các hợp đồng và lịch sử sẵn có của hồ sơ; chỉ xem.',`${contracts.length?`<h4 class="tp-related-title">Hợp đồng thuê</h4><div class="tbl-wrap">${U.table([{t:'Mã hợp đồng'},{t:'Điểm kinh doanh'},{t:'Thời hạn'},{t:'Trạng thái'}],contractRows)}</div>`:'<div class="empty small">Chưa có hợp đồng thuê.</div>'}${history.length?`<h4 class="tp-related-title">Lịch sử thay đổi</h4><div class="tbl-wrap">${U.table([{t:'Thời gian'},{t:'Người thực hiện'},{t:'Hành động'},{t:'Nội dung thay đổi'}],historyRows)}</div>`:'<div class="empty small">Chưa có lịch sử thay đổi.</div>'}`)}
    </div>`;
  }
  function render(){ return state.wizard ? wizard() : state.detail ? detail(TS.getProfile(state.detail)) : view(); }
  A.VIEWS['tieu-thuong']=render;
  A.IN['tp-q']=e=>{state.q=e.value;A.render();};A.CH['tp-status']=e=>{state.status=e.value;A.render();};A.CH['tp-contract']=e=>{state.contract=e.value;A.render();};A.CH['tp-area']=e=>{state.areaType=e.value;A.render();};A.CH['tp-charge']=e=>{const d=draft(),item=d&&d.items.find(x=>x.pointId===e.dataset.id),k=e.dataset.key;if(!item||!['electricity','water','marketService'].includes(k))return;if(locked(item)||(e.checked&&chargeOff(ui.market,k))){A.render();return U.toast(locked(item)?'Điểm đã có hợp đồng, không đổi khoản thu tại hồ sơ.':'Khoản này không áp dụng tại chợ.');}item.charges[k]=e.checked;A.render();};
  A.ACT['tp-clear']=()=>{state.q=state.status=state.contract=state.areaType='';A.render();};A.ACT['tp-view']=e=>{state.detail=e.dataset.id;A.render();};A.ACT['tp-detail-close']=()=>{state.detail=null;A.render();};
  // Compatibility for pre-existing callers/tests: the former tabs no longer
  // exist, therefore this action deliberately leaves the one-page detail open.
  A.ACT['tp-tab']=()=>A.render();
  const blank=()=>({files:{},name:'',phone:'',idType:'CCCD',idNo:'',address:'',items:[],ocr:null,error:''});
  A.ACT['tp-new']=()=>{if(!canEdit(ui.market))return;state.wizard=blank();state.previews={};A.render();};
  A.ACT['tp-edit']=e=>{const t=TS.getProfile(e.dataset.id);if(!t||!canEdit(t.market))return;state.wizard=Object.assign(blank(),{editId:t.id,files:Object.assign({},t.docFiles||{}),name:t.name,phone:t.phone,idType:t.idType||'CCCD',idNo:t.idNo,address:t.address||'',items:rental(t).map(x=>Object.assign({},x,{charges:Object.assign({},x.charges)}))});state.previews={};state.detail=null;A.render();};
  A.ACT['tp-wizard-cancel']=()=>{state.wizard=null;state.previews={};A.render();};
  // Ô nhập → draft (không vẽ lại để giữ con trỏ).
  A.IN['tp-field']=e=>{const d=draft();if(d&&['name','phone','idType','idNo','address'].includes(e.dataset.k))d[e.dataset.k]=e.value;};
  A.ACT['tp-file']=e=>{const d=draft();if(!d||!canEdit(ui.market))return;const key=e.dataset.key,input=document.createElement('input');input.type='file';input.accept='.jpg,.jpeg,.png,image/jpeg,image/png';input.onchange=()=>{const f=input.files&&input.files[0];if(f){if(!/\.(jpe?g|png)$/i.test(f.name||'')){input.remove();return U.toast('Chỉ nhận ảnh JPG, JPEG hoặc PNG.');}d.files[key]={name:f.name,type:f.type,size:f.size,addedAt:U.today(),mock:true};
    // Xem trước trong phiên (object URL) — không ghi vào hồ sơ; prototype chỉ lưu metadata tệp.
    try{if(typeof URL!=='undefined'&&URL.createObjectURL&&typeof Blob!=='undefined'&&f instanceof Blob)previews()[key]=URL.createObjectURL(f);}catch(err){}
    if(key==='cccdFront')d.ocr=null;A.render();}input.remove();};document.body.appendChild(input);input.click();};
  A.ACT['tp-file-remove']=e=>{const d=draft();if(!d)return;delete d.files[e.dataset.key];delete previews()[e.dataset.key];if(e.dataset.key==='cccdFront')d.ocr=null;A.render();};
  A.ACT['tp-select-points']=()=>{if(draft())A.modal(pointPicker());};
  // Điểm đã có hợp đồng luôn được giữ (không bỏ được qua hộp chọn); điểm mới mặc định chỉ mặt bằng.
  A.ACT['tp-points-confirm']=()=>{const d=draft();if(!d)return;const chosen=[...document.querySelectorAll('[data-tp-point]:checked')].map(x=>x.dataset.tpPoint);const keep=d.items.filter(locked);d.items=keep.concat(chosen.filter(id=>!keep.some(x=>x.pointId===id)).map(id=>{const p=point(id),old=d.items.find(x=>x.pointId===id);return old||{pointId:id,charges:{land:true,electricity:false,water:false,marketService:false},feeRefs:{areaTypeId:p.areaTypeId||p.areaType}};}));A.closeModal();A.render();};
  A.ACT['tp-remove-point']=e=>{const d=draft();if(!d)return;const x=d.items.find(i=>i.pointId===e.dataset.id);if(!x)return;if(locked(x))return U.toast('Điểm đã có hợp đồng, không thể bỏ khỏi hồ sơ.');d.items=d.items.filter(i=>i!==x);A.render();};
  // OCR: tùy chọn; không ghi gì cho tới khi "Áp dụng". Ô đã có dữ liệu khác → hỏi xác nhận. Không bao giờ lấy SĐT.
  A.ACT['tp-ocr-run']=()=>{const d=draft();if(!d||!canEdit(ui.market))return;if(!d.files.cccdFront)return U.toast('Vui lòng tải ảnh CCCD để sử dụng OCR.');d.ocr={status:'running'};A.render();return TS.extractTraderIdentityFromImages(d.files).then(out=>{if(draft()!==d)return;d.ocr=out.ok?{status:'done',result:out.result,applied:false,confirm:[]}:{status:'error',error:out.error};A.render();});};
  A.ACT['tp-ocr-apply']=e=>{const d=draft();if(!d||!canEdit(ui.market)||!d.ocr||d.ocr.status!=='done')return;const r=d.ocr.result,next={name:r.fullName,idType:ID_TYPES.includes(r.documentType)?r.documentType:d.idType,idNo:r.documentNumber,address:r.address};
    const conflicts=Object.keys(next).filter(k=>String(d[k]||'').trim()&&String(d[k]).trim()!==String(next[k]).trim()&&!(k==='idType'&&d[k]==='CCCD'&&!String(d.idNo||'').trim()));
    if(conflicts.length&&!(e&&e.dataset&&e.dataset.confirm==='1')){d.ocr.confirm=conflicts;A.render();return;}
    Object.assign(d,next);d.ocr.applied=true;d.ocr.confirm=[];A.render();U.toast('Đã áp dụng kết quả OCR vào biểu mẫu. Vui lòng kiểm tra và nhập số điện thoại.');};
  A.ACT['tp-ocr-cancel']=()=>{const d=draft();if(d&&d.ocr){d.ocr.confirm=[];A.render();}};
  // Lưu một lần cuối trang: chỉ chặn khi thiếu/trùng thông tin cá nhân; giấy tờ và điểm KD có thể bổ sung sau.
  A.ACT['tp-save']=()=>{const d=draft();if(!d||!canEdit(ui.market))return;['name','phone','idNo','address'].forEach(k=>{d[k]=String(d[k]||'').trim();});
    const fail=m=>{d.error=m;A.render();U.toast(m);};
    if(!d.name||!d.phone||!d.idNo||!d.address||!d.idType)return fail('Vui lòng nhập đủ thông tin cá nhân bắt buộc (mục A).');
    const dup=TS.validateProfileUnique({market:ui.market,phone:d.phone,idNo:d.idNo},d.editId);if(dup)return fail(dup.message);
    let t=d.editId?TS.getProfile(d.editId):null;
    if(t){if(!TS.updateProfile(t.id,d))return fail('Không thể cập nhật: thông tin bị trùng trong cùng chợ.');TS.updateDocuments(t.id,d.files,U.today());}
    else{t={id:nextId(),name:d.name,phone:d.phone,idType:d.idType,idNo:d.idNo,address:d.address,market:ui.market,stalls:[],status:'WAITING_ALLOCATION',docFiles:d.files,since:U.today(),source:'STAFF'};if(!TS.create(t))return fail('Không thể tạo hồ sơ: số điện thoại hoặc giấy tờ đã tồn tại trong chợ.');}
    if(!TS.setRentalDraft(t.id,d.items))return fail('Không thể lưu danh sách điểm đăng ký thuê.');
    const miss=missingDocs(d);state.wizard=null;state.previews={};state.detail=t.id;state.tab='overview';A.render();
    U.toast('Đã lưu hồ sơ tiểu thương.'+(d.items.length?' Có thể tạo hợp đồng cho các điểm đã đăng ký.':' Chưa có điểm đăng ký thuê.')+(miss.length?' Còn thiếu giấy tờ: '+miss.map(docLabel).join(', ')+'.':''));};
  // Tạo hợp đồng: dùng CHUNG form của màn Hợp đồng (chọn sẵn hồ sơ này) — mỗi điểm một hợp đồng, thời hạn riêng từng điểm.
  A.ACT['tp-contracts']=e=>{const t=TS.getProfile(e.dataset.id);if(!t||!A.canDo('hop-dong.tao',t.market))return U.toast('Bạn không có quyền tạo hợp đồng tại chợ này.');A.features.contracts.workspace.open(t.id);};
})(window.APP);
