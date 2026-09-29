const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const { A } = createApp(path.resolve(__dirname, '../..'));
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (error) { error.message = label + ': ' + error.message; throw error; } };
const collectors = A.ACCOUNTS.list().filter(a => A.ACCOUNTS.primaryRole(a) === 'collector');
collectors.forEach(a => A.ACCOUNTS.update(a.id, { marketScopes: [], status: 'LOCKED' }));
const add = (id, scopes) => A.ACCOUNTS.saveCollectorAccount({ id, code: id, fullName: id, phone: '0900000000', roleIds: ['collector'], status: 'ACTIVE', marketScopes: scopes });

assert(add('FIN-NV01', ['CL']).ok);
assert(add('FIN-NV02', ['HA']).ok);
A.db.stalls.push({ id: 'FIN-POINT-CL', code: 'FIN-CL', market: 'CL', collectorId: 'LEGACY-OTHER', status: 'active' });
A.db.stalls.push({ id: 'FIN-POINT-HA', code: 'FIN-HA', market: 'HA', collectorId: 'FIN-NV02', status: 'active' });
A.reindex();
const invoice = { id: 'FIN-INV-CL', market: 'CL', traderId: (A.db.traders[0] || {}).id, period: '202605', due: '2026-05-31', amount: 1000000, paid: 0, status: 'unpaid', stallId: 'FIN-POINT-CL', items: [{ stallId: 'FIN-POINT-CL', name: 'Phí quầy', amount: 1000000 }] };
A.db.invoices.push(invoice); A.reindex();

A.ui.currentDemoAccountId = 'FIN-NV01'; A.ui.sessionAccountId = 'FIN-NV01'; A.ui.market = 'CL';
ok('receivable market comes from canonical market, not legacy row collector', () => assert.strictEqual(A.receivableMarket(invoice), 'CL'));
ok('collector scope includes selected Market despite legacy collectorId', () => assert.deepStrictEqual(Array.from(A.allowedMarkets(A.currentAccount())), ['CL']));
A.ui.market = 'HA';
ok('collector scope excludes another Market', () => assert.strictEqual(A.allowedMarkets(A.currentAccount()).includes('HA'), false));
A.ui.market = 'CL';
const first = A.applyPayment([invoice.id], 400000, 'tm', 'FIN-NV01')[0];
ok('first partial payment retains actual actor and has no collector part', () => { assert.strictEqual(first.by, 'FIN-NV01'); assert.strictEqual(first.stallIds, undefined); assert.strictEqual(invoice.paid, 400000); });
assert(A.ACCOUNTS.saveCollectorAccount(Object.assign({}, A.ACCOUNTS.get('FIN-NV02'), { marketScopes: ['HA', 'CL'] }), { transferMarkets: ['CL'] }).ok);
ok('transfer changes current assignment without rewriting old payment', () => { assert.strictEqual(A.ACCOUNTS.getMarketCollector('CL').id, 'FIN-NV02'); assert.strictEqual(first.by, 'FIN-NV01'); });
A.ui.currentDemoAccountId = 'FIN-NV02'; A.ui.sessionAccountId = 'FIN-NV02'; A.ui.market = 'CL';
const second = A.applyPayment([invoice.id], 600000, 'tm', 'FIN-NV02')[0];
ok('new collector can settle remaining Market receivable', () => { assert.strictEqual(second.by, 'FIN-NV02'); assert.strictEqual(invoice.paid, 1000000); assert.strictEqual(invoice.status, 'paid'); });
ok('receipt displays historic actor rather than current assignment', () => assert(A.receiptHtml([first]).includes('FIN-NV01')));
ok('legacy compatibility adapter does not expose collector ownership', () => assert.strictEqual(Object.prototype.hasOwnProperty.call(A.invParts(invoice)[0], 'collectorId'), false));

console.log(`finance-market-scope regression PASS (${passed} checks)`);
