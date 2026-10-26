const assert=require('node:assert/strict'),C=require('../workbook-core.js'),B=require('../bg-core.js'),S=require('../industry-strategy.js'),bundle=require('../data.json'),content=require('../industry-strategy.json');
const d=bundle.datasets.find(d=>d.name==='高科技'),c=content.industries[d.name];
assert.equal(c.recommendations.length,3);assert.equal(c.capabilities.length,5);assert.equal(c.columns.length,4);
for(const cap of c.capabilities)for(const col of c.columns)assert(['快速落地','长期筑基','择机观察'].includes(cap.states[col.key]));
const expected=[[4,4,2,2,0],[11,4,1,0,1],[1,1,1,0,0]];
for(const [i,r]of c.recommendations.entries()){
 for(const t of r.businessTypes)assert(C.TYPES.includes(t));
 const ps=S.evidence(d,r,B),f=S.facts(ps);assert.deepEqual([f.cases,f.clients,f.subindustries,f.planned,f.historical],expected[i]);
 assert(ps.every(p=>p.records.every(r=>r.attribute==='logistics'&&!r.reference)));assert.equal(r.steps.length,3);assert(r.location&&r.capacity&&r.why&&r.basis.text&&r.gap);
}
const rec=c.recommendations[1],p=S.evidence(d,rec,B)[0],extra={...p.record,id:'new-europe-case',engagementId:'new-europe-case',types:['电商仓','末端配送','逆向退货']};
assert.equal(S.facts(S.evidence({...d,records:[...d.records,extra]},rec,B)).cases,12,'New eligible case increases once despite multiple labels');
assert.equal(S.facts(S.evidence({...d,records:[...d.records,{...extra,reference:true}]},rec,B)).cases,11,'Domestic reference excluded');
assert.equal(S.facts(S.evidence({...d,records:[...d.records,{...extra,areaId:'north-america'}]},rec,B)).cases,11,'Other geography excluded');
assert.equal(S.facts(S.evidence({...d,records:[]},rec,B)).cases,0,'Missing cases not replaced by hardcoded counts');
assert.equal(B.build(bundle.datasets).projects.length,486);assert.equal(B.build([d]).projects.length,50);
console.log('PASS: strategy evidence, scope, states, dynamic counts and original BG totals');
