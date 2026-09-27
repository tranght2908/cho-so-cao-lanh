// Targeted suite: administration and operations screens (settings host, fee configuration, bank
// accounts, accounts admin, roles/permissions, assets, reports, complaints, notifications).
// Added before batches 15.7-15.13; baseline recorded from the pre-migration runtime (see README).
module.exports = function ops(r) {
  const { snap, login, ch, inp, act, go, input, A } = r;

  // Settings host: every tab (admin).
  login('AC-QT01', 'CL'); go('cai-dat');
  ['kythu', 'quytac', 'vaitro', 'tichhop', 'nhatky'].forEach(t => snap('cai-dat tab ' + t, () => act('settings-tab', { id: t })));
  snap('billing cycle change', () => { act('settings-tab', { id: 'kythu' }); ch('bc-due', '12'); return A.SERVICE_CFG.cycle(); });
  snap('billing rule change', () => { act('settings-tab', { id: 'quytac' }); ch('br-partial', false, { checked: false }); return A.SERVICE_CFG.rules(); });
  snap('role select + perm toggle', () => { act('settings-tab', { id: 'vaitro' }); ch('perm-role-select', 'collector'); ch('perm-toggle', true, { checked: true, dataset: { role: 'collector', key: 'action:bao-cao.xuat' } }); return A.PERM.rolePermKeys('collector'); });
  snap('role new form', () => act('role-new', {}));
  snap('role form save', () => { ch('rf-name', 'Vai trò thử'); ch('rf-desc', 'Mô tả'); act('role-form-save', {}); return A.PERM.roles().map(x => x.id); });
  snap('role perm focus', () => act('role-perm', { id: 'technician' }));

  // Fee configuration (market manager CL).
  login('AC-NV01', 'CL'); go('cau-hinh-gia');
  ['gia', 'dien-nuoc', 'dich-vu'].forEach(t => snap('cau-hinh-gia tab ' + t, () => act('cfg-tab', { id: t })));
  act('cfg-tab', { id: 'gia' });
  const price = A.SERVICE_CFG.list('stallPrices').find(x => x.marketId === 'CL');
  snap('cfg price view', () => act('cfg-price-view', { id: price.id }));
  snap('cfg price new', () => act('cfg-price-new', {}));
  snap('cfg price form save', () => { ch('cf-area', 'Nhà lồng chính'); ch('cf-stalltype', 'Ki-ốt'); ch('cf-amount', '12345'); ch('cf-eff', '2026-06-01'); ch('cf-lb-docno', '12/QĐ'); ch('cf-lb-summary', 'Căn cứ'); act('cfg-form-save', {}); return A.SERVICE_CFG.list('stallPrices').length; });
  const draft = A.SERVICE_CFG.list('stallPrices').find(x => x.status !== 'active' && x.marketId === 'CL');
  snap('cfg fee apply', () => draft && act('cfg-fee-apply', { cat: 'stallPrices', id: draft.id }));
  snap('cfg fee toggle', () => act('cfg-fee-toggle', { cat: 'stallPrices', id: price.id }));
  snap('cfg util view', () => { act('cfg-tab', { id: 'dien-nuoc' }); const u = A.SERVICE_CFG.list('utilities').find(x => x.marketId === 'CL'); return u && act('cfg-util-view', { id: u.id }); });
  snap('cfg svc new', () => { act('cfg-tab', { id: 'dich-vu' }); act('cfg-svc-new', {}); });
  snap('cfg legal edit', () => { act('cfg-editlegal', { cat: 'stallPrices', id: price.id }); ch('lf-docno', '99/QĐ'); act('cfg-legal-save', {}); });
  snap('stall applied price', () => A.db.stalls.filter(s => s.market === 'CL').slice(0, 20).map(s => [s.id, A.U.unitLabel(s)]));

  // Bank accounts (management is system_admin only).
  login('AC-QT01', 'CL'); go('tai-khoan-ngan-hang');
  snap('ba search', () => inp('ba-search', 'viet'));
  snap('ba clear', () => act('ba-clear', {}));
  snap('ba sort', () => act('ba-sort', { key: 'bankName' }));
  snap('ba new', () => act('ba-new', {}));
  snap('ba form save', () => { ch('baf-bank', 'VCB'); ch('baf-holder', 'Ban quan ly cho'); ch('baf-number', '0123456789'); act('ba-form-save', {}); return A.BANK_ACCOUNTS.list().length; });
  const ba = A.BANK_ACCOUNTS.list().find(x => x.marketId === 'CL');
  snap('ba edit', () => ba && act('ba-edit', { id: ba.id }));
  snap('ba csv', () => act('ba-csv', {}));

  // Accounts admin.
  login('AC-QT01', 'CL'); go('tai-khoan');
  snap('acc search', () => inp('acc-search', 'NV0'));
  snap('acc filter role', () => ch('acc-role', 'collector'));
  snap('acc clear', () => act('acc-clear', {}));
  snap('acc open', () => act('acc-open', { id: 'AC-NV02' }));
  snap('acc new', () => act('acc-new', {}));
  snap('acc form save', () => { ch('af-code', 'NV99'); ch('af-name', 'Nhân viên thử'); ch('af-phone', '0909000111'); ch('af-role', 'collector'); ch('af-scope', 'CL', { checked: true, dataset: { market: 'CL' } }); act('acc-form-save', {}); return A.ACCOUNTS.list().length; });
  snap('acc toggle', () => act('acc-toggle', { id: 'AC-NV03' }));
  snap('acc toggle back', () => act('acc-toggle', { id: 'AC-NV03' }));

  // Assets (CL only).
  login('AC-NV01', 'CL'); go('tai-san');
  const asset = (A.db.marketAssets || []).find(x => x.market === 'CL');
  snap('asset filter', () => ch('asset-filter', 'ELECTRICAL', { dataset: { k: 'category' } }));
  snap('asset reset', () => act('asset-reset', {}));
  snap('asset open', () => asset && act('asset-open', { id: asset.id }));
  snap('asset tab', () => asset && act('asset-tab', { id: 'maintenance' }));
  snap('asset new', () => act('asset-new', {}));
  snap('asset edit', () => asset && act('asset-edit', { id: asset.id }));

  // Reports + state forms.
  login('AC-LD01', 'CL'); go('bao-cao');
  ['lapday', 'thu', 'congno', 'suco', 'mau01a', 'mau02a', 'mau03a', 'mau03d', 'bieu10'].forEach(k => snap('report ' + k, () => act('rp', { id: k })));
  snap('report save', () => act('rp-save', {}));
  snap('report csv', () => act('rp-csv', {}));

  // Complaints V2 workflow (CL): create → assign → inspect → work → submit → accept → close.
  login('AC-NV01', 'CL'); go('su-co');
  snap('su-co cat filter', () => ch('inc-cat', 'dien'));
  snap('su-co cat clear', () => ch('inc-cat', ''));
  ['all', 'tiepnhan', 'phancong', 'dangxuly', 'chonghiemthu', 'hoanthanh', 'dong'].forEach(t => snap('su-co flow tab ' + t, () => act('inc-flow-tab', { id: t })));
  snap('inc new v2', () => act('inc-new-v2', {}));
  const st = A.db.stalls.find(s => s.market === 'CL' && s.status === 'thue');
  snap('inc new v2 save', () => { input('#in2-title', 'Mất điện khu A'); input('#in2-desc', 'Mất điện từ sáng'); input('#in2-stall', st.id); input('#in2-cat', 'dien'); input('#in2-asset', ''); act('inc-new-v2-save', {}); return A.db.incidents.length; });
  const inc = A.db.incidents[A.db.incidents.length - 1];
  snap('inc open', () => act('inc-open', { id: inc.id }));
  snap('inc detail tab', () => act('inc-detail-tab', { id: 'history', inc: inc.id }));
  snap('inc assign open', () => act('inc-assign-open', { id: inc.id }));
  snap('inc assign save', () => { input('#ia-assignee', 'NV05'); input('#ia-due', '2026-05-20'); input('#ia-note', 'Xử lý gấp'); input('#ia-asset', ''); input('#ia-cat', 'dien'); act('inc-assign-save', { id: inc.id }); return inc.state; });
  login('AC-NV05', 'CL'); go('su-co');
  snap('inc inspect open (technician)', () => act('inc-inspect-open', { id: inc.id }));
  snap('inc inspect save', () => { input('#ii-at', '2026-05-15T10:00'); input('#ii-condition', 'Đứt dây'); input('#ii-note', 'Cần thay'); act('inc-inspect-save', { id: inc.id }); return inc.state; });
  snap('inc work open', () => act('inc-work-open', { id: inc.id }));
  snap('inc work save', () => { input('#iw-at', '2026-05-15T11:00'); input('#iw-content', 'Thay dây'); input('#iw-result', 'Đã có điện'); input('#iw-note', ''); act('inc-work-save', { id: inc.id }); return inc.state; });
  snap('inc work submit', () => { act('inc-work-open', { id: inc.id }); input('#iw-at', '2026-05-15T11:00'); input('#iw-content', 'Thay dây'); input('#iw-result', 'Đã có điện'); act('inc-work-submit', { id: inc.id }); return inc.state; });
  snap('inc denied accept (technician)', () => act('inc-accept-open', { id: inc.id }));
  login('AC-NV01', 'CL'); go('su-co');
  snap('inc accept open', () => act('inc-accept-open', { id: inc.id }));
  snap('inc accept save', () => { input('input[name="ia-result"]:checked', 'pass'); input('#ia-by', 'NV01'); input('#ia-at', '2026-05-15T12:00'); input('#ia-rework', ''); input('#ia-note', 'Đạt'); act('inc-accept-save', { id: inc.id }); return inc.state; });
  snap('inc close open', () => act('inc-close-open', { id: inc.id }));
  snap('inc close save', () => { input('#ic-note', 'Đóng'); act('inc-close-save', { id: inc.id }); return [inc.state, (inc.history || []).length]; });
  snap('inc existing transitions', () => { const x = A.db.incidents.find(i => i.market === 'CL' && i.state === 'tiepnhan'); return x && act('inc-assign-open', { id: x.id }); });

  // Notifications.
  go('thong-bao');
  snap('tb group', () => ch('tb-group', 'debt'));
  snap('tb send', () => { input('#tb-title', 'Thông báo thử'); input('#tb-content', 'Nội dung'); act('tb-send', {}); return A.db.notifications.length; });

  snap('denied ba new (market manager)', () => { login('AC-NV01', 'CL'); act('ba-new', {}); });

  // Demo reset (settings audit tab) — reseeds business data only; accounts/roles untouched.
  login('AC-QT01', 'CL'); go('cai-dat');
  snap('settings audit tab', () => act('settings-tab', { id: 'nhatky' }));
  snap('reset open', () => act('reset', {}));
  snap('reset ok', () => { act('reset-ok', {}); return [A.db.incidents.length, A.db.notifications.length, A.ACCOUNTS.list().length]; });

  // Denied paths (collector cannot open admin/config actions).
  login('AC-NV02', 'CL');
  snap('denied cfg price new (collector)', () => act('cfg-price-new', {}));
  snap('denied acc new (collector)', () => act('acc-new', {}));
  snap('denied role new (collector)', () => act('role-new', {}));
  snap('denied inc assign (collector)', () => { const x = A.db.incidents.find(i => i.market === 'CL' && i.state === 'tiepnhan'); return x && act('inc-assign-open', { id: x.id }); });
};
