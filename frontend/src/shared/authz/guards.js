/* Shared authorization guards (Phase 15.4, from js/core.js): screen access U.can and action
 * access A.canDo, both evaluated against the dynamic RBAC engine (permissions.js) and market scope. */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  // CAN_VIEW_SCREEN (RBAC_V1_SPEC.md mục 7) = account active AND screen permission AND market
  // scope/context hợp lệ AND screen applicable với selectedMarket. Không thay permission matrix —
  // chỉ thêm 2 điều kiện market vào đúng 1 điểm kiểm tra dùng chung cho mọi nơi (menu, router,
  // liên kết chéo screen), tránh rải hard-code if(screen===...)/if(market===...) ở từng view.
  U.can = r => {
    const it = A.menuItem(r), role = A.PERM.role(ui.role);
    const acc = A.currentAccount();
    if (!it || !role || !role.active || !acc || acc.status !== 'active') return false;
    const screenAllowed = r === 'mat-bang' && ui.market === 'CL'
      ? (A.PERM.canScreen(ui.role, 'mat-bang') || A.PERM.canScreen(ui.role, 'diem-kd'))
      : A.PERM.canScreen(ui.role, r);
    if (!screenAllowed) return false;
    return A.screenMarketOk(r, acc);
  };

  // Phase 4B — CAN_DO_ACTION: điểm kiểm tra DUY NHẤT để THỰC THI 1 action mutation (không chỉ hiển
  // thị nút). Dùng ở cả UI gate (build HTML) LẪN handler gate (ngay trước khi ghi dữ liệu) — cùng 1
  // hàm, không lặp lại điều kiện account/market rải rác ở từng file view.
  //   actionKey    : phần sau 'action:' trong CATALOG (vd. 'thu-tien.thu').
  //   targetMarket : market của bản ghi đang thao tác (vd. invoice.market, st.market, r.market...).
  //                  Bỏ qua (undefined/null) cho action không gắn với 1 chợ cụ thể (vd. tai-khoan.*,
  //                  cai-dat.*). Nếu có, PHẢI khớp đúng selectedMarket hiện tại (ui.market) — vì
  //                  ui.market luôn nằm trong A.allowedMarkets(account) theo bất biến của Phase 2
  //                  (A.syncAccountContext), so khớp với ui.market đã bao hàm luôn điều kiện
  //                  "targetMarket ∈ account.marketScopes" mà không cần kiểm tra lại 2 lần.
  A.canDo = function (actionKey, targetMarket) {
    const acc = A.currentAccount();
    if (!acc || acc.status !== 'active') return false;
    if (!A.PERM.canAction(ui.role, actionKey)) return false;
    if (targetMarket != null && targetMarket !== ui.market) return false;
    return true;
  };
})(window.APP);
