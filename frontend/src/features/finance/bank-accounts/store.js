/* Dữ liệu "Danh sách tài khoản ngân hàng" (Tài chính > Quản lý khai báo). Là danh sách tài khoản
 * ngân hàng của Ban Quản lý chợ dùng để nhận tiền qua QR/chuyển khoản từ tiểu thương và phục vụ
 * đối soát giao dịch. Tách theo từng chợ (marketId: 'CL'/'TTD') như phần lớn dữ liệu nghiệp vụ khác
 * trong hệ thống — màn hình lọc theo ui.market/A.allowedMarkets(account) giống các màn Tài chính
 * khác (xem js/v-vanhanh.js, A.VIEWS['tai-khoan-ngan-hang']).
 * Module này ĐỘC LẬP với BANK_BY_MARKET (data.js) — hằng số đó chỉ phục vụ demo màn Đối soát,
 * không phải nguồn dữ liệu tài khoản ngân hàng thật của Ban Quản lý.
 * Business rule (giữ ở tầng dữ liệu, không chỉ ở form):
 *  - accountNumber unique TOÀN HỆ THỐNG — không phân biệt chợ khi kiểm tra trùng.
 *  - Không xoá cứng tài khoản đã có giao dịch tham chiếu (hasTransactions) — remove() từ chối và
 *    handler phải tự chuyển sang "Ngừng hoạt động" (setStatus) thay thế.
 *  - "Ngừng hoạt động" không được là tài khoản thu tiền — setStatus() tự ép isCollectionAccount=false
 *    khi chuyển sang inactive, để enforcement không chỉ nằm ở UI/form.
 */
(function (A) {
  'use strict';
  const D = A.D;
  const BKEY = 'choso-caolanh-bankaccounts';
  let seq = 0;
  const newId = mid => 'BA-' + (mid || 'XX') + '-' + Date.now().toString(36) + (++seq);
  const nowStr = () => (A.U ? (A.U.dmy(A.U.today()) + ' ' + A.U.nowTime()) : '');

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function defaultAccounts() { return clone(D.BANK_ACCOUNT_SEED || []); }

  function loadAccounts() {
    try {
      const s = localStorage.getItem(BKEY);
      if (s) { const x = JSON.parse(s); if (Array.isArray(x)) return x; }
    } catch (e) { /* bỏ qua */ }
    return defaultAccounts();
  }
  let LIST = loadAccounts();
  function save() { try { localStorage.setItem(BKEY, JSON.stringify(LIST)); } catch (e) { /* bỏ qua */ } }

  const BA = A.BANK_ACCOUNTS = {
    KEY: BKEY,
    BANKS: (D.BANKS || []),
    list: () => LIST,
    listByMarket: mid => LIST.filter(a => a.marketId === mid),
    get: id => LIST.find(a => a.id === id),
    bankName: code => { const b = BA.BANKS.find(x => x.code === code); return b ? b.name : (code || ''); },
    // unique TOÀN HỆ THỐNG — cố ý KHÔNG lọc theo marketId khi kiểm tra trùng số tài khoản.
    numberTaken: (accountNumber, excludeId) => {
      const n = (accountNumber || '').trim();
      if (!n) return false;
      return LIST.some(a => a.id !== excludeId && a.accountNumber === n);
    },
    add: (rec, user) => {
      rec.id = newId(rec.marketId);
      rec.hasTransactions = false;
      rec.createdBy = user; rec.createdAt = nowStr();
      rec.updatedBy = user; rec.updatedAt = rec.createdAt;
      if (rec.status === 'inactive') rec.isCollectionAccount = false;
      LIST.push(rec);
      save();
      return rec;
    },
    update: (id, patch, user) => {
      const r = BA.get(id);
      if (!r) return null;
      Object.assign(r, patch);
      if (r.status === 'inactive') r.isCollectionAccount = false;
      r.updatedBy = user;
      r.updatedAt = nowStr();
      save();
      return r;
    },
    // Chuyển Hoạt động/Ngừng hoạt động. Ngừng hoạt động không được là tài khoản thu tiền — chặn lại
    // ngay tại đây (defense-in-depth), không chỉ dựa vào form/checkbox disabled ở UI.
    setStatus: (id, status, user) => {
      const r = BA.get(id);
      if (!r) return null;
      r.status = status;
      if (status === 'inactive') r.isCollectionAccount = false;
      r.updatedBy = user;
      r.updatedAt = nowStr();
      save();
      return r;
    },
    // Không xoá cứng nếu đã có giao dịch tham chiếu — trả về false và KHÔNG đổi gì; handler gọi
    // setStatus(id,'inactive',user) thay thế trong trường hợp đó. Chỉ xoá cứng khi hasTransactions
    // === false.
    remove: id => {
      const r = BA.get(id);
      if (!r || r.hasTransactions) return false;
      LIST = LIST.filter(a => a.id !== id);
      save();
      return true;
    },
    resetDefault: () => { LIST = defaultAccounts(); save(); }
  };
})(window.APP);
