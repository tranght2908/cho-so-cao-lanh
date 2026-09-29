/* Bank accounts of the market management boards (Phase 15.7, from js/v-vanhanh.js): route
 * tai-khoan-ngan-hang and its ba-* / baf-* handlers. Data: A.BANK_ACCOUNTS (store.js). */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  // ---- Danh sách tài khoản ngân hàng (Tài chính > Quản lý khai báo, ngang hàng cau-hinh-gia) ----
  // Tách theo từng chợ (marketId) như các màn Tài chính khác — lọc theo ui.market topbar (U.inM),
  // KHÔNG có bộ lọc chợ riêng của màn (đã xác nhận với người yêu cầu trước khi implement). Quyền:
  // screen:tai-khoan-ngan-hang cho xem; action:tai-khoan-ngan-hang.quan-ly cho MỌI thao tác ghi
  // (Thêm/Sửa/Xoá/đổi trạng thái) — kiểm tra ở nơi build nút (ẩn nút) VÀ lại một lần nữa ngay trong
  // từng handler ghi dữ liệu, không chỉ ẩn nút. rec (khi có) dùng đúng marketId của CHÍNH bản ghi đó
  // (không phải ui.market) để 1 handler bị ép đổi ui.market không thể lách qua bản ghi chợ khác —
  // cùng nguyên tắc với cfgPriceMutateAllowed().
  function baCan(rec) { return A.canDo('tai-khoan-ngan-hang.quan-ly', rec ? rec.marketId : ui.market); }
  function baRows() {
    // Bản ghi dùng field `marketId` (giống stallPrices/utilities/extraServices ở serviceconfig.js),
    // KHÔNG phải `market` — U.inM() kiểm tra đúng field `market` (dùng cho stalls/contracts/
    // invoices...) nên không áp dụng được ở đây; so sánh trực tiếp marketId với ui.market.
    const f = ui.bankAcc, q = (f.search || '').toLowerCase();
    const rows = A.BANK_ACCOUNTS.list().filter(a => a.marketId === ui.market &&
      (!f.status || a.status === f.status) &&
      (!q || a.accountHolderName.toLowerCase().includes(q)));
    const key = f.sortKey, dir = f.sortDir === 'desc' ? -1 : 1;
    if (!key) return rows;
    return rows.slice().sort((x, y) => (x[key] > y[key] ? 1 : x[key] < y[key] ? -1 : 0) * dir);
  }
  function baStatusTag(s) { return s === 'active' ? '<span class="tag ok">Hoạt động</span>' : '<span class="tag">Ngừng hoạt động</span>'; }
  // Tự UPPERCASE + bỏ dấu tiếng Việt cho Tên chủ tài khoản (đúng chuẩn ghi trên thẻ/sao kê ngân hàng).
  function baUpperNoAccent(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();
  }
  function baActor() { const acc = A.currentAccount(); return acc ? acc.fullName : 'Không rõ'; }
  function baSortHead(label, key) {
    const f = ui.bankAcc, on = f.sortKey === key;
    return `<button class="btn sm ${on ? 'primary' : ''}" data-act="ba-sort" data-key="${key}" style="padding:2px 8px">${label}${on ? (f.sortDir === 'desc' ? ' ▼' : ' ▲') : ''}</button>`;
  }
  // Mỗi chợ chỉ 1 TK thu tiền (nguồn sinh mã QR) — báo trước khi lưu nếu sẽ thay TK thu tiền hiện tại.
  function baCollectNote(d) {
    if (!d.isCollectionAccount || d.status === 'inactive') return '';
    const mid = d.id ? (A.BANK_ACCOUNTS.get(d.id) || {}).marketId : ui.market;
    const cur = A.BANK_ACCOUNTS.collectionAccount(mid);
    if (!cur || cur.id === d.id) return '';
    return `<div class="note" style="margin-top:8px">Mỗi chợ chỉ có 1 tài khoản thu tiền. Hiện tại là <b>${U.esc(A.BANK_ACCOUNTS.bankName(cur.bankCode))} · ${U.esc(cur.accountNumber)}</b> — khi lưu, tài khoản đó sẽ bỏ vai trò thu tiền và mã QR thu tiền sẽ dùng tài khoản này.</div>`;
  }
  function renderBankAcctForm() {
    const d = ui.baForm, isNew = !d.id;
    const banks = A.BANK_ACCOUNTS.BANKS;
    A.modal(A.mHead(isNew ? 'Thêm tài khoản ngân hàng' : 'Sửa tài khoản ngân hàng') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Ngân hàng *</label><select class="input" data-ch="baf-bank">
        <option value="">— Chọn ngân hàng —</option>
        ${banks.map(b => `<option value="${b.code}" ${d.bankCode === b.code ? 'selected' : ''}>${U.esc(b.name)}</option>`).join('')}
      </select></div>
      <div class="field"><label>Tên chủ tài khoản *</label><input class="input" data-ch="baf-holder" value="${U.esc(d.accountHolderName || '')}" placeholder="Tự in hoa, không dấu"></div>
      <div class="field"><label>Số tài khoản *</label><input class="input" data-ch="baf-number" value="${U.esc(d.accountNumber || '')}" placeholder="Chỉ gồm số"></div>
      <div class="field"><label>Trạng thái</label><select class="input" data-ch="baf-status">
        <option value="active" ${d.status === 'active' ? 'selected' : ''}>Hoạt động</option>
        <option value="inactive" ${d.status === 'inactive' ? 'selected' : ''}>Ngừng hoạt động</option>
      </select></div>
    </div>
    <div class="field" style="margin-top:10px"><label>Ghi chú</label><textarea class="input" data-ch="baf-note" rows="2">${U.esc(d.note || '')}</textarea></div>
    <label class="small" style="display:flex;align-items:center;gap:6px;margin-top:12px;cursor:${d.status === 'inactive' ? 'not-allowed' : 'pointer'}">
      <input type="checkbox" data-ch="baf-collect" ${d.isCollectionAccount ? 'checked' : ''} ${d.status === 'inactive' ? 'disabled' : ''}> Là tài khoản thu tiền (nhận tiền QR/chuyển khoản của tiểu thương)
    </label>
    <div id="baf-collect-note">${baCollectNote(d)}</div>
    ${d.status === 'inactive' ? '<div class="note" style="margin-top:8px">Tài khoản "Ngừng hoạt động" không thể chọn làm tài khoản thu tiền.</div>' : ''}
    ${isNew ? `<label class="small" style="display:flex;align-items:center;gap:6px;margin-top:12px;cursor:pointer"><input type="checkbox" data-ch="baf-continue" ${d.saveAndContinue ? 'checked' : ''}> Lưu và thêm tiếp</label>` : ''}
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy bỏ</button><button class="btn primary" data-act="ba-form-save">Lưu</button></div>`);
  }
  function baLogReplaced(newNo) {
    (A.BANK_ACCOUNTS.lastReplaced || []).forEach(o => U.log('Đổi tài khoản thu tiền: ' + o.accountNumber + ' → ' + newNo));
  }
  A.VIEWS['tai-khoan-ngan-hang'] = function () {
    const canManage = baCan();
    const rows = baRows(), f = ui.bankAcc;
    const coll = A.BANK_ACCOUNTS.collectionAccount(ui.market);
    const collBar = coll
      ? `<div class="card"><div class="card-b small" style="padding-top:12px">Tài khoản thu tiền của chợ (dùng sinh mã QR gửi tiểu thương): <b>${U.esc(A.BANK_ACCOUNTS.bankName(coll.bankCode))} · ${U.esc(coll.accountNumber)} · ${U.esc(coll.accountHolderName)}</b>. Mỗi chợ chỉ có 1 tài khoản thu tiền.</div></div>`
      : `<div class="card"><div class="card-b" style="padding-top:12px"><span class="tag danger">Chưa có tài khoản thu tiền</span> <span class="small">Chợ chưa chọn tài khoản thu tiền nên chưa sinh được mã QR cho khoản phải thu. ${canManage ? 'Sửa một tài khoản đang hoạt động và tích "Là tài khoản thu tiền".' : 'Liên hệ Tổ trưởng Tổ Quản lý chợ.'}</span></div></div>`;
    const pg = U.pager('bankAcc', rows.length, 15);
    return `
    <div class="card"><div class="card-b row" style="padding-top:14px">
      <div><h3 style="margin:0;font-size:var(--font-size-md)">Danh sách tài khoản ngân hàng</h3><div class="small muted">Tài khoản ngân hàng của Ban Quản lý chợ dùng nhận tiền qua QR/chuyển khoản từ tiểu thương, phục vụ đối soát giao dịch — ${U.esc(U.market(ui.market).name)}.</div></div>
      <span class="spacer"></span>
      <button class="btn" data-act="ba-csv">⬇ Xuất excel</button>
      ${canManage ? '<button class="btn primary" data-act="ba-new">+ Thêm mới</button>' : ''}
    </div></div>
    ${collBar}
    <div class="card"><div class="card-b row" style="padding-top:14px;flex-wrap:wrap">
      <input class="input" style="min-width:220px;flex:1" placeholder="Tìm theo tên chủ tài khoản..." data-in="ba-search" value="${U.esc(f.search || '')}">
      <select class="input" data-ch="ba-status"><option value="">Chọn trạng thái: Tất cả</option>
        <option value="active" ${f.status === 'active' ? 'selected' : ''}>Hoạt động</option>
        <option value="inactive" ${f.status === 'inactive' ? 'selected' : ''}>Ngừng hoạt động</option>
      </select>
      <button class="btn" data-act="ba-clear">Đặt lại</button>
    </div></div>
    <div class="card"><div class="card-b">
      ${U.table([{ t: 'STT' }, { t: baSortHead('Số tài khoản', 'accountNumber') }, { t: baSortHead('Tên chủ tài khoản', 'accountHolderName') }, { t: 'Ngân hàng' }, { t: 'Ghi chú' }, { t: 'Trạng thái' }].concat(canManage ? [{ t: '' }] : []),
        rows.slice(pg.start, pg.end).map((a, i) => `<tr>
          <td>${pg.start + i + 1}</td>
          <td>${U.esc(a.accountNumber)}</td>
          <td>${U.esc(a.accountHolderName)}</td>
          <td><span class="tag info">${U.esc(A.BANK_ACCOUNTS.bankName(a.bankCode))}</span></td>
          <td class="small">${U.esc(a.note || '')}${a.isCollectionAccount ? ' <span class="tag ok" title="Tài khoản thu tiền duy nhất của chợ — mã QR gửi tiểu thương sinh từ tài khoản này">Tài khoản thu tiền</span>' : ''}</td>
          <td>${baStatusTag(a.status)}</td>
          ${canManage ? `<td class="nowrap">
            ${baCan(a) ? `<button class="btn sm" data-act="ba-edit" data-id="${a.id}">Sửa</button>` : ''}
            ${baCan(a) ? `<button class="btn sm danger" data-act="ba-del" data-id="${a.id}">Xoá</button>` : ''}
          </td>` : ''}</tr>`), { empty: 'Không tìm thấy tài khoản ngân hàng phù hợp' })}${pg.html}</div></div>`;
  };
  A.IN['ba-search'] = el => { ui.bankAcc.search = el.value; ui.page.bankAcc = 0; A.render(); };
  A.CH['ba-status'] = el => { ui.bankAcc.status = el.value; ui.page.bankAcc = 0; A.render(); };
  A.ACT['ba-clear'] = () => { ui.bankAcc = { search: '', status: '', sortKey: null, sortDir: 'asc' }; ui.page.bankAcc = 0; A.render(); };
  A.ACT['ba-sort'] = el => {
    const k = el.dataset.key, f = ui.bankAcc;
    f.sortDir = f.sortKey === k && f.sortDir === 'asc' ? 'desc' : 'asc';
    f.sortKey = k;
    A.render();
  };
  A.CH['ba-select-all'] = el => { ui.baSel = el.checked ? baRows().map(a => a.id) : []; A.render(); };
  A.CH['ba-select'] = el => {
    const id = el.dataset.id, sel = new Set(ui.baSel || []);
    if (el.checked) sel.add(id); else sel.delete(id);
    ui.baSel = Array.from(sel);
    A.render();
  };
  A.ACT['ba-csv'] = () => {
    const rows = baRows();
    U.csv('tai-khoan-ngan-hang', ['Số tài khoản', 'Tên chủ tài khoản', 'Ngân hàng', 'Ghi chú', 'Tài khoản thu tiền', 'Trạng thái'],
      rows.map(a => [a.accountNumber, a.accountHolderName, A.BANK_ACCOUNTS.bankName(a.bankCode), a.note || '', a.isCollectionAccount ? 'Có' : '', a.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động']));
  };
  A.ACT['ba-new'] = () => {
    if (!baCan()) return;
    ui.baForm = { id: null, bankCode: '', accountHolderName: '', accountNumber: '', isCollectionAccount: false, note: '', status: 'active', saveAndContinue: false };
    renderBankAcctForm();
  };
  A.ACT['ba-edit'] = el => {
    const a = A.BANK_ACCOUNTS.get(el.dataset.id);
    if (!a || !baCan(a)) return;
    ui.baForm = { id: a.id, bankCode: a.bankCode, accountHolderName: a.accountHolderName, accountNumber: a.accountNumber, isCollectionAccount: a.isCollectionAccount, note: a.note, status: a.status, saveAndContinue: false };
    renderBankAcctForm();
  };
  // A.render() KHÔNG vẽ lại modal (chỉ vẽ lại #nav/#view, xem A.render() ở core.js), và gọi lại
  // renderBankAcctForm() (thay hẳn innerHTML #modal-root) NGAY trong handler 'change'/'input' của
  // 1 phần tử CON của modal đó có thể ném lỗi DOM ("node to be removed is no longer a child") do
  // gỡ phần tử đang dispatch sự kiện giữa lúc sự kiện chưa kết thúc. Vì vậy 3 handler dưới đây chỉ
  // sửa trực tiếp DOM phần tử liên quan (giữ nguyên phần tử đang có), không vẽ lại toàn modal.
  A.CH['baf-bank'] = el => { ui.baForm.bankCode = el.value; };
  A.CH['baf-holder'] = el => { const v = baUpperNoAccent(el.value); ui.baForm.accountHolderName = v; el.value = v; };
  A.CH['baf-number'] = el => { const v = el.value.replace(/\D/g, ''); ui.baForm.accountNumber = v; el.value = v; };
  A.CH['baf-note'] = el => { ui.baForm.note = el.value; };
  A.CH['baf-status'] = el => {
    ui.baForm.status = el.value;
    if (el.value === 'inactive') ui.baForm.isCollectionAccount = false;
    const cb = A.$('input[data-ch="baf-collect"]');
    if (cb) { cb.checked = ui.baForm.isCollectionAccount; cb.disabled = el.value === 'inactive'; }
    { const n = document.getElementById('baf-collect-note'); if (n) n.innerHTML = baCollectNote(ui.baForm); }
  };
  A.CH['baf-collect'] = el => {
    if (ui.baForm.status !== 'inactive') ui.baForm.isCollectionAccount = el.checked;
    const n = document.getElementById('baf-collect-note'); if (n) n.innerHTML = baCollectNote(ui.baForm);
  };
  A.CH['baf-continue'] = el => { ui.baForm.saveAndContinue = el.checked; };
  A.ACT['ba-form-save'] = () => {
    const d = ui.baForm, isNew = !d.id;
    const existing = d.id ? A.BANK_ACCOUNTS.get(d.id) : null;
    if (!baCan(existing)) return;
    const bank = A.BANK_ACCOUNTS.BANKS.find(b => b.code === d.bankCode);
    if (!bank) { U.toast('Vui lòng chọn ngân hàng'); return; }
    const holder = baUpperNoAccent((d.accountHolderName || '').trim());
    if (!holder) { U.toast('Vui lòng nhập tên chủ tài khoản'); return; }
    const number = (d.accountNumber || '').replace(/\D/g, '');
    if (!number) { U.toast('Vui lòng nhập số tài khoản (chỉ gồm số)'); return; }
    if (A.BANK_ACCOUNTS.numberTaken(number, d.id)) { U.toast('Số tài khoản "' + number + '" đã tồn tại trong hệ thống'); return; }
    const status = d.status === 'inactive' ? 'inactive' : 'active';
    const patch = {
      marketId: existing ? existing.marketId : ui.market, bankCode: bank.code, bankName: bank.name,
      accountHolderName: holder, accountNumber: number,
      isCollectionAccount: status === 'inactive' ? false : !!d.isCollectionAccount,
      note: (d.note || '').trim(), status: status
    };
    if (isNew) {
      A.BANK_ACCOUNTS.add(patch, baActor());
      U.log('Thêm tài khoản ngân hàng mới "' + patch.accountHolderName + '" (' + patch.accountNumber + ')');
      baLogReplaced(patch.accountNumber);
      U.toast('Đã thêm tài khoản ' + patch.accountNumber);
      if (d.saveAndContinue) {
        ui.baForm = { id: null, bankCode: '', accountHolderName: '', accountNumber: '', isCollectionAccount: false, note: '', status: 'active', saveAndContinue: true };
        renderBankAcctForm();
        return;
      }
    } else {
      A.BANK_ACCOUNTS.update(d.id, patch, baActor());
      U.log('Cập nhật tài khoản ngân hàng "' + patch.accountHolderName + '" (' + patch.accountNumber + ')');
      baLogReplaced(patch.accountNumber);
      U.toast('Đã cập nhật tài khoản ' + patch.accountNumber);
    }
    A.closeModal(); A.render();
  };
  A.ACT['ba-del'] = el => {
    const a = A.BANK_ACCOUNTS.get(el.dataset.id);
    if (!a || !baCan(a)) return;
    if (a.hasTransactions) {
      A.modal(A.mHead('Không thể xoá tài khoản') + `<div class="modal-b">Tài khoản <b>${U.esc(a.accountNumber)}</b> (${U.esc(a.accountHolderName)}) đã có giao dịch tham chiếu (đối soát) — không thể xoá cứng. Chỉ có thể chuyển sang "Ngừng hoạt động".</div>
        <div class="modal-f"><button class="btn" data-act="close">Đóng</button>${a.status === 'active' ? `<button class="btn danger" data-act="ba-deactivate-ok" data-id="${a.id}">Chuyển Ngừng hoạt động</button>` : ''}</div>`);
      return;
    }
    A.modal(A.mHead('Xoá tài khoản ngân hàng') + `<div class="modal-b">Xoá tài khoản <b>${U.esc(a.accountNumber)}</b> (${U.esc(a.accountHolderName)})? Thao tác này không thể hoàn tác.</div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="ba-del-ok" data-id="${a.id}">Xoá</button></div>`);
  };
  A.ACT['ba-del-ok'] = el => {
    const a = A.BANK_ACCOUNTS.get(el.dataset.id);
    if (!a || !baCan(a)) return;
    if (!A.BANK_ACCOUNTS.remove(a.id)) { U.toast('Không thể xoá — tài khoản đã có giao dịch tham chiếu.'); A.closeModal(); A.render(); return; }
    U.log('Xoá tài khoản ngân hàng "' + a.accountHolderName + '" (' + a.accountNumber + ')');
    U.toast('Đã xoá tài khoản ' + a.accountNumber);
    A.closeModal(); A.render();
  };
  A.ACT['ba-deactivate-ok'] = el => {
    const a = A.BANK_ACCOUNTS.get(el.dataset.id);
    if (!a || !baCan(a)) return;
    A.BANK_ACCOUNTS.setStatus(a.id, 'inactive', baActor());
    U.log('Chuyển "Ngừng hoạt động" tài khoản ngân hàng "' + a.accountHolderName + '" (' + a.accountNumber + ')');
    U.toast('Đã chuyển tài khoản ' + a.accountNumber + ' sang Ngừng hoạt động');
    A.closeModal(); A.render();
  };

  if (!ui.bankAcc) ui.bankAcc = { search: '', status: '', sortKey: null, sortDir: 'asc' };
  if (!ui.baSel) ui.baSel = [];
})(window.APP);
