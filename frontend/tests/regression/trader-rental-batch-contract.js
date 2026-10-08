/* Batch profile contracts: 1 rental item = 1 normal contract, with real rollback. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const { A } = createApp(path.resolve(__dirname, '../..'));
const TS=A.features.traders.service, BP=A.features.businessPoints.service, CS=A.features.contracts.service;
const today=A.U.today(), add=n=>new Date(Date.parse(today)+n*86400000).toISOString().slice(0,10);
const market=A.features.markets.service.rows().find(m=>m.status==='ACTIVE'&&m.layoutStatus==='SETUP_COMPLETED');
assert(market, 'an active configured market fixture is required');
const points=BP.availablePoints(market.id,today,add(30)).slice(0,3);
assert.equal(points.length,3,'three available points');
const trader=TS.create({id:'TT-BATCH-VERIFY',name:'Batch verify',phone:'0988111222',idNo:'079888111222',market:market.id,stalls:[]});
assert(trader);
assert(TS.setRentalDraft(trader.id,points.map(p=>({pointId:p.id,charges:{land:true},feeRefs:{}}))));
const make=(p,n,wrong)=>({traderId:trader.id,pointId:p.id,contract:{id:'HD-BATCH-VERIFY-'+n,traderId:wrong?'WRONG':trader.id,market:market.id,stallId:p.id,businessPointId:p.id,start:today,end:add(30),status:'ACTIVE',history:[]},pointHistoryEntry:'test'});
const storageBefore=JSON.stringify(A.db);
const linksBefore=JSON.stringify(trader.stalls||[]), statusBefore=points.map(p=>({id:p.id,status:p.status,usageStatus:p.usageStatus,traderId:p.traderId,contractId:p.contractId}));
// The second entry passes preliminary availability then fails inside the existing
// one-point service, proving that rollback occurs after the first mutation.
assert.equal(CS.createBatchWithPointAllocation([make(points[0],1),make(points[1],2,true),make(points[2],3)]),null);
assert(!A.db.contracts.some(c=>/^HD-BATCH-VERIFY-/.test(c.id)),'first created contract was removed');
assert.equal(JSON.stringify(TS.getProfile(trader.id).stalls||[]),linksBefore,'trader point links restored');
assert.deepEqual(points.map(p=>{const current=BP.get(p.id);return {id:current.id,status:current.status,usageStatus:current.usageStatus,traderId:current.traderId,contractId:current.contractId};}),statusBefore,'point occupancy restored');
assert(TS.rentalItems(TS.getProfile(trader.id)).every(x=>x.status==='pending_contract'),'draft remains pending after rollback');
assert.equal(JSON.stringify(A.db),storageBefore,'in-memory persisted aggregate restored');
const created=CS.createBatchWithPointAllocation([make(points[0],11),make(points[1],12),make(points[2],13)]);
assert.equal(created.length,3,'three one-point contracts created');
assert(created.every(c=>(c.businessPointId||c.stallId)&&c.traderId===trader.id),'each contract owns exactly one selected point');
const byPoint={};created.forEach(c=>byPoint[c.businessPointId||c.stallId]=c.id);
TS.markRentalItemsContracted(trader.id,byPoint);
assert(TS.rentalItems(TS.getProfile(trader.id)).every(x=>x.status==='contracted'&&x.contractId),'each rental item receives its own contract ID');
assert(points.every(p=>CS.hasActiveForPoint(p.id)),'points became rented through the existing contract service');
assert.equal(TS.deriveBusinessStatus(trader.id),'ACTIVE','active contract has status priority over pending state');
console.log('trader-rental-batch-contract regression PASS (12 checks)');
