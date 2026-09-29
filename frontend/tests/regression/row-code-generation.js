/* Regression: "Thêm Dãy" form order + one Row code rule shared with the initial-setup wizard. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };

const h = createApp(root), A = h.A, S = A.features.marketLayout.store;
A.ui.sessionAccountId = 'AC-NV01'; A.ui.market = 'CL'; A.syncAccountContext();
const HS = 'Thủy hải sản', RC = 'Rau củ, trái cây';
const codesBefore = new Map(A.db.rows.map(r => [r.id, r.code]));
const haRow = code => ({ id: 'T-HA-R-' + code, market: 'HA', buildingId: 'T-HA-B', floorId: null, code, name: code, industry: HS, allocatedArea: 0, order: 1, status: 'active', collectorId: null, note: '' });
const withHaRows = (codes, fn) => { const keep = A.db.rows; A.db.rows = keep.concat(codes.map(haRow)); A.reindex(); try { fn(); } finally { A.db.rows = keep; A.reindex(); } };

ok('industry prefix comes from the single industry catalog', () => {
  assert.strictEqual(A.D.INDUSTRY_CODES[HS], 'HS');
  assert(A.D.INDUSTRIES.every(x => A.D.INDUSTRY_CODES[x]), 'every catalog industry has a prefix');
  assert.strictEqual(new Set(Object.values(A.D.INDUSTRY_CODES)).size, A.D.INDUSTRIES.length, 'prefixes are unique');
});
ok('next suffix = highest existing suffix + 1, per market, gaps never reused', () => {
  assert.strictEqual(S.nextRowCode('HA', ''), '', 'no industry → no code');
  assert.strictEqual(S.nextRowCode('HA', HS), 'HS-A', 'CL rows HS-A/HS-B do not affect HA');
  withHaRows(['HS-A'], () => assert.strictEqual(S.nextRowCode('HA', HS), 'HS-B'));
  withHaRows(['HS-A', 'HS-B'], () => assert.strictEqual(S.nextRowCode('HA', HS), 'HS-C'));
  withHaRows(['HS-A', 'HS-C'], () => assert.strictEqual(S.nextRowCode('HA', HS), 'HS-D'));
  assert.strictEqual(S.nextRowCode('CL', HS), 'HS-C');
  assert.strictEqual(S.suggestRowName(HS, 'HS-C'), 'Dãy thủy hải sản C');
});
ok('initial setup wizard uses the same generation rule', () => {
  withHaRows(['HS-A', 'HS-B'], () => {
    const d = S.initialSetup.createDraft('HA');
    d.rows.push({ id: 'tmp-row-1', name: 'x', industry: HS }, { id: 'tmp-row-2', name: 'y', industry: HS }, { id: 'tmp-row-3', name: 'z', industry: RC });
    const codes = S.initialSetup.preview(d).rowCodes;
    assert.strictEqual(codes['tmp-row-1'], S.nextRowCode('HA', HS));
    assert.deepStrictEqual([codes['tmp-row-1'], codes['tmp-row-2'], codes['tmp-row-3']], ['HS-C', 'HS-D', 'RC-A']);
  });
});

const nnl = A.db.buildings.find(b => b.market === 'CL' && !A.db.floors.some(f => f.buildingId === b.id));
const place = { block: nnl.id, floor: S.NO_FLOOR + nnl.id };
const pick = industry => A.CH['qhz-industry']({ value: industry });
const typeName = v => { h.input('#qhz-name', v); A.IN['qhz-name']({ value: v }); };

ok('form order: Ngành hàng → Tên Dãy → Mã Dãy (read-only, empty until industry)', () => {
  h.act('qh-add-zone', place);
  const m = h.modal();
  const iInd = m.indexOf('Ngành hàng *'), iName = m.indexOf('Tên Dãy *'), iCode = m.indexOf('<label>Mã Dãy</label>');
  assert(iInd > 0 && iInd < iName && iName < iCode, 'field order');
  assert(/id="qhz-code"[^>]*readonly/.test(m) && /id="qhz-code" value=""/.test(m));
  assert(/id="qhz-name"[^>]*disabled/.test(m), 'name waits for industry');
  assert(/Tự động tạo theo ngành hàng/.test(m));
});
ok('choosing an industry suggests code + name; editing name keeps code', () => {
  pick(HS); h.input('#qhz-name', 'Dãy thủy hải sản C');
  assert(/id="qhz-code" value="HS-C"/.test(h.modal()) && /value="Dãy thủy hải sản C"/.test(h.modal()));
  typeName('Khu bán cá tươi phía Đông');
  assert.strictEqual(A.ui.mb.zoneDraft.code, 'HS-C');
});
ok('changing industry keeps a user-edited name', () => {
  pick(RC);
  assert(/id="qhz-code" value="RC-B"/.test(h.modal()) && /value="Khu bán cá tươi phía Đông"/.test(h.modal()));
  A.closeModal();
});
ok('changing industry refreshes an untouched suggestion', () => {
  h.act('qh-add-zone', place); pick(HS); h.input('#qhz-name', 'Dãy thủy hải sản C');
  pick(RC);
  assert(/id="qhz-code" value="RC-B"/.test(h.modal()) && /value="Dãy rau củ, trái cây B"/.test(h.modal()));
  A.closeModal();
});
ok('save persists code/name/industry in the v16 Row shape only', () => {
  h.act('qh-add-zone', place); pick(HS); typeName('Khu bán cá tươi phía Đông');
  h.act('qh-add-zone-save');
  const r = A.db.rows.find(x => x.market === 'CL' && x.code === 'HS-C');
  assert(r, h.trace.toasts.at(-1));
  assert.strictEqual(r.name, 'Khu bán cá tươi phía Đông'); assert.strictEqual(r.industry, HS); assert.strictEqual(r.floorId, null);
  assert.deepStrictEqual(Object.keys(r).sort(), ['allocatedArea', 'buildingId', 'code', 'collectorId', 'floorId', 'id', 'industry', 'market', 'name', 'note', 'order', 'status']);
  assert.strictEqual(A.ui.mb.zoneDraft, null);
  A.closeModal();
});
ok('collision after the suggestion was shown is regenerated, not saved', () => {
  h.act('qh-add-zone', place); pick(HS); h.input('#qhz-name', 'Dãy thủy hải sản D');
  assert.strictEqual(A.ui.mb.zoneDraft.code, 'HS-D');
  S.addRow('CL', { blockId: nnl.id, floorId: S.NO_FLOOR + nnl.id }, 'HS-D', 'Dãy chen ngang', HS); // concurrent change
  const n = A.db.rows.length;
  h.act('qh-add-zone-save');
  assert.strictEqual(A.db.rows.length, n, 'nothing saved on collision');
  assert(/HS-E/.test(h.trace.toasts.at(-1)) && /id="qhz-code" value="HS-E"/.test(h.modal()) && /value="Dãy thủy hải sản E"/.test(h.modal()));
  h.input('#qhz-name', 'Dãy thủy hải sản E');
  h.act('qh-add-zone-save');
  assert(A.db.rows.some(x => x.market === 'CL' && x.code === 'HS-E'));
  A.closeModal();
  assert(S.addRow('CL', { blockId: nnl.id, floorId: S.NO_FLOOR + nnl.id }, 'HS-E', 'Trùng', HS).errors[0].includes('đã tồn tại'), 'store still rejects duplicates');
});
ok('existing Row codes are never rewritten', () => {
  codesBefore.forEach((code, id) => assert.strictEqual(A.idx.row.get(id).code, code, id));
});

ok('Thêm điểm kinh doanh uses its own scoped wide layout', () => {
  h.act('mb-add-point', { id: 'CL-R-TG-A' });
  const m = h.modal();
  assert(/class="modal-b mb-point-add"/.test(m) && /class="tbl mb-point-table"/.test(m));
  assert(/data-label="Loại diện tích"/.test(m) && /data-label="Số điểm"/.test(m) && /data-label="DT\/điểm"/.test(m));
  assert(/<div class="modal ?"/.test(m), 'no global modal variant is used');
  const css = require('fs').readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert(/\.modal:has\(> \.modal-b\.mb-point-add\) \{ width: min\(920px, calc\(100vw - 48px\)\); \}/.test(css));
  assert(/^\.modal \{[^}]*width: min\(620px, 100%\)/m.test(css) && /^\.modal\.wide \{ width: min\(880px, 100%\); \}/m.test(css), 'shared modal widths unchanged');
  A.closeModal();
});

console.log(`row-code-generation regression PASS (${passed} checks)`);
