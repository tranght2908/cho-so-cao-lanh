// Targeted suite: market layout (mat-bang), business points and trader UI.
// Added before batches 15.14-15.16; baseline recorded from the pre-migration runtime (see README).
module.exports = function layout(r) {
  const { snap, login, ch, inp, act, go, input, A, h } = r;
  const ids = (re, html) => Array.from((html || h.view()).matchAll(re)).map(m => m[1]);
  const uniq = a => Array.from(new Set(a));

  // --- Market layout CL: navigation, views, filters (market manager).
  login('AC-NV01', 'CL'); go('mat-bang');
  snap('mat-bang CL overview', () => h.view().length);
  const blocks = uniq(ids(/data-act="mb-sel-block" data-id="([^"]+)"/g));
  const floors = uniq(ids(/data-act="mb-sel-floor" data-id="([^"]+)"/g));
  const zones = uniq(ids(/data-act="mb-sel-zone" data-id="([^"]+)"/g));
  snap('layout ids', () => [blocks.length, floors.length, zones.length]);
  snap('mb toggle tree', () => act('mb-toggle-tree', {}));
  snap('mb sel block', () => act('mb-sel-block', { id: blocks[0] }));
  snap('mb sel floor', () => act('mb-sel-floor', { id: floors[0] }));
  snap('mb sel zone', () => act('mb-sel-zone', { id: zones[0] }));
  snap('mb toggle node', () => act('mb-toggle-node', { key: blocks[0] }));
  snap('mb legend filter', () => act('legend', { s: 'trong' }));
  snap('mb plan search', () => inp('plan-search', 'A0'));
  snap('mb plan search clear', () => inp('plan-search', ''));
  snap('mb view table', () => act('mb-view', { id: 'table' }));
  snap('mb filter status', () => act('mb-filter-status', { id: 'thue' }));
  snap('mb filter search', () => inp('mb-filter-search', 'A'));
  snap('mb filter cat', () => ch('mb-filter-cat', 'Rau'));
  snap('mb filter area type', () => ch('mb-filter-area-type', 'covered'));
  snap('mb filter clear', () => act('mb-filter-clear', {}));
  snap('mb dkcl csv', () => act('dkcl-csv', {}));
  snap('mb dkcl clear', () => act('dkcl-clear', {}));
  snap('mb view grid', () => act('mb-view', { id: 'grid' }));
  snap('mb sel overview', () => act('mb-sel-overview', {}));

  // --- Layout editing (CL): block / floor / zone CRUD, zone fields, planned points, collector.
  snap('qh add block', () => act('qh-add-block', {}));
  snap('qh add block save', () => { input('#qhb-name', 'Khối thử nghiệm'); act('qh-add-block-save', {}); });
  const newBlock = uniq(ids(/data-act="mb-sel-block" data-id="([^"]+)"/g)).find(b => !blocks.includes(b));
  snap('qh edit block', () => act('qh-edit-block', { id: newBlock }));
  snap('qh edit block save', () => { input('#qhb-name', 'Khối thử nghiệm 2'); act('qh-edit-block-save', { id: newBlock }); });
  snap('qh add floor', () => act('qh-add-floor', { block: newBlock }));
  snap('qh add floor save', () => { input('#qhf-name', 'Tầng thử'); act('qh-add-floor-save', { block: newBlock }); });
  act('mb-sel-block', { id: newBlock });
  const newFloor = uniq(ids(/data-act="mb-sel-floor" data-id="([^"]+)"/g)).find(f => !floors.includes(f));
  snap('qh add zone', () => act('qh-add-zone', { block: newBlock, floor: newFloor }));
  snap('qh add zone save', () => { input('#qhz-code', 'ZT1'); input('#qhz-name', 'Khu thử'); act('qh-add-zone-save', { block: newBlock, floor: newFloor }); });
  act('mb-sel-overview', {});
  const newZone = uniq(ids(/data-act="mb-sel-zone" data-id="([^"]+)"/g)).find(z => !zones.includes(z));
  snap('qh zone edit open', () => act('qh-zone-edit-open', { id: newZone }));
  snap('qh zone field name', () => ch('qh-zone-field', 'Khu thử đổi tên', { dataset: { zone: newZone, k: 'name' } }));
  snap('qh zone field area', () => ch('qh-zone-field', '120', { dataset: { zone: newZone, k: 'area' } }));
  snap('qh pt add', () => act('qh-pt-add', { id: newZone }));
  const pt = ids(/data-pt="([^"]+)"/g, h.modal())[0];
  snap('qh pt field', () => pt && ch('qh-pt-field', '5', { dataset: { zone: newZone, pt, k: 'qty' } }));
  snap('qh save draft', () => act('qh-save-draft', { id: newZone }));
  snap('qh save final', () => act('qh-save-final', { id: newZone }));
  snap('layout stored after zone edits', () => h.localStorage.getItem('choso-caolanh-layout'));
  snap('qh pt del', () => pt && act('qh-pt-del', { id: newZone + '|' + pt }));
  snap('qh del floor blocked', () => act('qh-del-floor', { block: newBlock, id: newFloor }));
  snap('qh del zone', () => act('qh-del-zone', { id: newZone }));
  snap('qh del zone ok', () => act('qh-del-zone-ok', { id: newZone }));
  snap('qh del floor', () => act('qh-del-floor', { block: newBlock, id: newFloor }));
  snap('qh del floor ok', () => act('qh-del-floor-ok', { block: newBlock, id: newFloor }));
  snap('qh del block', () => act('qh-del-block', { id: newBlock }));
  snap('qh del block ok', () => act('qh-del-block-ok', { id: newBlock }));
  snap('layout stored after deletes', () => h.localStorage.getItem('choso-caolanh-layout'));
  snap('qh zone collector (existing zone)', () => { act('qh-zone-edit-open', { id: zones[0] }); ch('qh-zone-collector', 'AC-NV03', { dataset: { zone: zones[0] } }); return A.db.stalls.filter(s => s.market === 'CL').map(s => s.collectorId || '').join(','); });
  snap('qh reset', () => act('qh-reset', {}));
  snap('qh reset ok', () => act('qh-reset-ok', {}));
  snap('layout stored', () => h.localStorage.getItem('choso-caolanh-layout'));

  // --- Point quick drawer from diagram + point drawer CL.
  const cl = A.db.stalls.find(s => s.market === 'CL' && s.status === 'thue' && s.traderId);
  const clVacant = A.db.stalls.find(s => s.market === 'CL' && s.status === 'trong');
  snap('stall click (diagram drawer)', () => act('stall', { id: cl.id }));
  snap('mb open trader', () => { A.ui.sel = cl.id; act('mb-open-trader', { id: cl.traderId }); });
  snap('drawer back', () => act('drawer-back', {}));
  snap('mb open diemkd', () => act('mb-open-diemkd', { id: cl.id }));
  snap('dk open', () => act('dk-open', { id: cl.id }));
  ['info', 'contract', 'history', 'seller'].forEach(t => snap('dk detail tab ' + t, () => act('dkdetail-tab', { id: t })));
  snap('dk detail seller', () => act('dkdetail-seller', {}));
  snap('dkcl open trader', () => act('dkcl-open-trader', { id: cl.traderId, stall: cl.id }));
  snap('dkcl edit open', () => act('dkcl-edit-open', { id: cl.id }));
  snap('dkcl edit save', () => { input('#dke-loc', cl.floor + '|' + cl.section); input('#dke-type', cl.pointType || 'STANDARD'); input('#dke-area', '9'); input('#dke-cat', 'Rau củ'); act('dkcl-edit-save', { id: cl.id }); return [cl.area, cl.cat, (cl.history || []).length]; });
  snap('dkcl edit cancel', () => { act('dkcl-edit-open', { id: cl.id }); act('dkcl-edit-cancel', { id: cl.id }); });
  snap('dkds open', () => act('dkds-open', { id: cl.id }));
  snap('dkds save', () => { ch('dkds-kind', 'OTHER'); inp('dkds-name', 'Người bán thử'); inp('dkds-idno', '087111222333'); inp('dkds-phone', '0912000111'); inp('dkds-relationship', 'Con'); inp('dkds-start', '2026-05-15'); inp('dkds-note', 'ghi chú'); act('dkds-save', { id: cl.id }); return (A.db.directSellerAssignments || []).length; });
  const dsa = () => (A.db.directSellerAssignments || []).filter(x => x.pointId === cl.id && x.status === 'PENDING_VERIFICATION').slice(-1)[0];
  snap('dkds verify open', () => dsa() && act('dkds-verify-open', { id: dsa().id }));
  snap('dkds verify save', () => dsa() && act('dkds-verify-save', { id: dsa().id }));
  snap('stall status open', () => act('stall-status', { id: clVacant.id }));
  snap('stall status save', () => { input('#ss-status', 'ngung'); input('#ss-reason', 'Tạm ngừng'); act('stall-status-save', { id: clVacant.id }); return [clVacant.status, clVacant.history]; });
  snap('stall status denied (collector)', () => { login('AC-NV02', 'CL'); act('stall-status', { id: clVacant.id }); });
  snap('dkcl edit denied (collector)', () => act('dkcl-edit-open', { id: cl.id }));

  // --- TTD layout + generic point table (diem-kd for non-CL).
  login('AC-NV01', 'TTD'); go('mat-bang');
  snap('mat-bang TTD', () => h.view().length);
  const ttd = A.db.stalls.find(s => s.market === 'TTD');
  snap('stall click TTD (stallPanel)', () => act('stall', { id: ttd.id }));
  snap('dk open TTD (modal)', () => act('dk-open', { id: ttd.id }));
  go('diem-kd');
  snap('diem-kd TTD generic', () => A.current);
  snap('dk section filter', () => ch('dk-section', ''));
  snap('dk status filter', () => ch('dk-status', 'trong'));
  snap('dk search', () => inp('dk-search', 'T'));
  snap('dk csv', () => act('dk-csv', {}));

  // --- Traders CL: list filters, drawer, edit, documents, vehicles.
  login('AC-NV01', 'CL'); go('tieu-thuong');
  const t = A.db.traders.find(x => x.market === 'CL' && x.stalls.length);
  snap('ttcl search', () => inp('ttcl-search', t.name.slice(0, 3)));
  snap('ttcl section', () => ch('ttcl-section', ''));
  snap('ttcl floor', () => ch('ttcl-floor', ''));
  snap('ttcl cat', () => ch('ttcl-cat', t.cat));
  snap('ttcl clear', () => act('ttcl-clear', {}));
  snap('trader drawer', () => act('trader', { id: t.id }));
  snap('tt doc view', () => act('tt-doc-view', { id: t.id, key: Object.keys(t.docFiles || {})[0] || 'cccdFront' }));
  snap('tt edit open', () => act('tt-edit-open', { id: t.id }));
  snap('tt doc replace', () => { h.setFiles([{ name: 'cccd-moi.jpg', type: 'image/jpeg', size: 10 }]); act('tt-doc-replace', { id: t.id, key: 'cccdFront' }); });
  snap('tt edit save', () => { input('#tte-name', t.name); input('#tte-phone', t.phone); input('#tte-idno', t.idNo); input('#tte-idtype', 'CCCD'); act('tt-edit-save', { id: t.id }); return t.docFiles; });
  snap('tt edit cancel', () => { act('tt-edit-open', { id: t.id }); act('tt-edit-cancel', { id: t.id }); });
  snap('tt open congno', () => act('tt-open-congno', {}));
  go('tieu-thuong');
  snap('vehicle add', () => act('vehicle-add', { trader: t.id }));
  snap('vehicle save', () => { input('#vehicle-type', 'MOTORBIKE'); input('#vehicle-plate', '66B1-12345'); input('#vehicle-description', 'Xe máy'); input('#vehicle-note', ''); act('vehicle-save', { trader: t.id }); return (A.db.traderVehicles || []).filter(v => v.traderId === t.id).length; });
  const v = (A.db.traderVehicles || []).find(x => x.traderId === t.id);
  snap('vehicle edit', () => v && act('vehicle-edit', { id: v.id }));
  snap('vehicle deactivate', () => v && act('vehicle-deactivate', { id: v.id }));
  snap('trader denied edit (collector)', () => { login('AC-NV02', 'CL'); act('tt-edit-open', { id: t.id }); });

  // --- TTD trader generic list.
  login('AC-NV01', 'TTD'); go('tieu-thuong');
  snap('tt search TTD', () => inp('tt-search', 'Nguy'));
  snap('tt app filter TTD', () => ch('tt-app', 'yes'));
  const tt = A.db.traders.find(x => x.market === 'TTD');
  snap('trader drawer TTD', () => act('trader', { id: tt.id }));
};
