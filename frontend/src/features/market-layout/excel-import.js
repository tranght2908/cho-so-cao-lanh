/* Excel import for existing business-point structure only. Requires SheetJS XLSX. */
(function (A) {
  'use strict';
  const U = A.U, S = A.features.marketLayout.store;
  const areaTypes = { 'có mái che':'covered', 'không mái che':'uncovered', 'tự sản tự tiêu':'self_produced' };
  const norm = x => String(x == null ? '' : x).trim().toLocaleLowerCase('vi-VN');
  const val = (r, k) => r[k] == null ? '' : String(r[k]).trim();
  const fields = ['MaCho','MaKhoiNha','MaTang','MaDay','MaDiem','DienTich','LoaiDienTich','NganhHang','GhiChu'];
  const importer = A.features.marketLayout.importer = {};
  importer.canOpen = function (mid) {
    const market = A.features.markets.service.get(mid);
    if (!market) return { ok:false, error:'Chợ đang chọn không hợp lệ.' };
    if (!A.canDo('cau-truc.edit', mid)) return { ok:false, error:'Bạn không có quyền nhập điểm kinh doanh cho chợ này.' };
    if (!(S.rowsOf(mid) || []).length) return { ok:false, error:'Cần khai báo Khối/Nhà, Tầng và Dãy trước khi nhập điểm kinh doanh từ Excel.' };
    return { ok:true };
  };

  importer.validate = function (mid, source) {
    const market = A.features.markets.service.get(mid), rows = (source || []).map((raw, i) => ({ raw, line:i + 2, errors:[], code:val(raw,'MaDiem'), area:Number(String(raw.DienTich || '').replace(',', '.')) }));
    const existing = new Set((A.db.stalls || []).filter(s => s.market === mid).map(s => norm(s.code))), inFile = new Set(), totals = {};
    rows.forEach(x => {
      const r=x.raw, fail=m=>x.errors.push(m), marketCode=norm(val(r,'MaCho'));
      if (!marketCode || marketCode !== norm(market.code || market.id)) fail('Điểm không thuộc chợ đang chọn.');
      const b=(A.db.buildings||[]).find(v=>v.market===mid && norm(v.code)===norm(val(r,'MaKhoiNha')));
      if (!b) fail('Khối/Nhà không tồn tại trong chợ.');
      const f=b && (A.db.floors||[]).find(v=>v.market===mid && v.buildingId===b.id && norm(v.code)===norm(val(r,'MaTang')));
      if (!f) fail('Tầng không thuộc đúng Khối/Nhà.');
      const row=f && (A.db.rows||[]).find(v=>v.market===mid && v.buildingId===b.id && v.floorId===f.id && norm(v.code)===norm(val(r,'MaDay')));
      if (!row) fail('Dãy không thuộc Tầng / Khối-Nhà đã khai báo.');
      if (!x.code) fail('MaDiem không được để trống.'); else if (existing.has(norm(x.code)) || inFile.has(norm(x.code))) fail('MaDiem ' + x.code + ' đã tồn tại hoặc bị trùng trong file.'); inFile.add(norm(x.code));
      if (!(x.area > 0)) fail('Diện tích phải lớn hơn 0.');
      const type=areaTypes[norm(val(r,'LoaiDienTich'))]; if (!type) fail('Loại diện tích không hợp lệ.'); else if (S.allowedAreaTypes(mid).indexOf(type) < 0) fail('Loại diện tích không được áp dụng tại chợ.');
      if (row && val(r,'NganhHang') && norm(val(r,'NganhHang')) !== norm(row.industry)) fail('Ngành hàng của điểm không khớp ngành hàng của Dãy.');
      x.rowId=row && row.id; x.areaTypeId=type; x.industry=row && row.industry; x.note=val(r,'GhiChu');
      if (row && x.area > 0) totals[row.id]=(totals[row.id]||0)+x.area;
    });
    Object.keys(totals).forEach(id=>{ const row=A.idx.row.get(id), remain=S.budget.row(row).remaining; if(totals[id] > remain + 1e-9) rows.filter(x=>x.rowId===id).forEach(x=>x.errors.push('Tổng diện tích điểm nhập mới vượt diện tích còn lại của Dãy ' + row.code + ': cần ' + totals[id] + ' m², còn ' + remain + ' m².')); });
    return { rows, valid:rows.filter(x=>!x.errors.length).length, errors:rows.filter(x=>x.errors.length).length, totalArea:rows.reduce((s,x)=>s+(x.area>0?x.area:0),0), plan:rows.map(x=>({code:x.code,rowId:x.rowId,area:x.area,areaTypeId:x.areaTypeId,note:x.note})) };
  };
  importer.commit = function(mid, preview) { const guard=importer.canOpen(mid); if(!guard.ok) return {ok:false,errors:[guard.error]}; if(!preview || preview.errors) return {ok:false,errors:['Cần sửa toàn bộ lỗi trước khi nhập.']}; const out=S.importPointsAtomic(mid,preview.plan); if(out.ok && U.log) U.log('Nhập Excel ' + out.stalls.length + ' điểm kinh doanh vào ' + new Set(out.stalls.map(x=>x.rowId)).size + ' Dãy.'); return out; };
  importer.template = function () { if (!window.XLSX) return U.toast('Không thể tạo file mẫu vì thư viện Excel chưa tải xong.'); const ws=XLSX.utils.aoa_to_sheet([fields]), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'DiemKinhDoanh'); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Hướng dẫn'],['Chỉ nhập điểm thuộc Khối/Nhà, Tầng, Dãy đã tồn tại.'],['LoaiDienTich: Có mái che | Không mái che | Tự sản tự tiêu.']]),'HuongDan'); XLSX.writeFile(wb,'mau-nhap-diem-kinh-doanh.xlsx'); };
  importer.read = function(file, done) { if (!file || !/\.xlsx$/i.test(file.name || '')) return done(null,'Chỉ hỗ trợ file .xlsx.'); if(!window.XLSX) return done(null,'Thư viện Excel chưa sẵn sàng.'); const reader=new FileReader(); reader.onerror=()=>done(null,'Không thể đọc file Excel.'); reader.onload=e=>{ try { const wb=XLSX.read(e.target.result,{type:'array'}), ws=wb.Sheets.DiemKinhDoanh; if(!ws) return done(null,'Không tìm thấy sheet DiemKinhDoanh.'); const data=XLSX.utils.sheet_to_json(ws,{defval:''}); if(!data.length) return done(null,'File Excel không có dòng dữ liệu.'); const missing=fields.filter(k=>!Object.prototype.hasOwnProperty.call(data[0],k)); if(missing.length) return done(null,'Thiếu cột bắt buộc: '+missing.join(', ')); done(data); } catch(err){done(null,'File Excel không hợp lệ.');} }; reader.readAsArrayBuffer(file); };
})(window.APP);
