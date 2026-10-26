const assert=require('node:assert/strict'),C=require('../workbook-core.js'),B=require('../bg-core.js'),P=require('../provider-core.js'),S=require('../industry-strategy.js'),bundle=require('../data.json'),content=require('../industry-strategy.json'),policy=require('../provider-policy.json'),areas=require('../regions.json');
const expected={
 '高科技':[[4,4,2,2,0],[11,4,1,0,1]],
 '汽车':[[7,6,3,0,2],[49,12,4,0,1]],
 '工业设备':[[13,9,3,0,1],[2,2,1,0,0]],
 '消费品':[[4,4,2,0,0],[11,6,2,2,1]],
 '医药':[[12,5,2,0,0]],
 '餐饮':[[3,2,1,0,2],[3,3,1,0,1]]
};
const report=[];
for(const d of bundle.datasets){const c=content.industries[d.name];assert(c&&c.recommendations.length);let rows=[];
 for(const [i,r]of c.recommendations.entries()){
  assert(areas.some(a=>a.id===r.area));if(r.country){assert(areas.find(a=>a.id===r.area).countries.includes(r.country));assert(r.selection.countryIds.includes(r.country));}
  assert(!r.rank&&!r.steps&&!r.condition);assert(r.location&&r.capacity&&r.why&&r.basis.text&&r.basis.sourceCells.length&&r.gap);assert(r.methods.length);
  for(const t of r.businessTypes)assert(C.TYPES.includes(t));for(const m of r.methods)assert(['build','partner','ma'].includes(m.kind));
  const ps=S.evidence(d,r,B),f=S.facts(ps);assert.deepEqual([f.cases,f.clients,f.subindustries,f.planned,f.historical],expected[d.name][i],r.id);assert(f.clients>=2,'Independent build direction requires multiple disclosed clients in this version');
  assert.equal(new Set(ps.map(p=>p.key)).size,ps.length);assert(ps.every(p=>p.records.every(r=>!r.reference&&r.attribute==='logistics')));
  if(r.selection.countryIds)assert(ps.every(p=>r.selection.countryIds.includes(p.countryId)),'Regional shared projects not spread into named countries');
  for(const id of r.selection.excludeRecordIds||[])assert(!ps.some(p=>p.records.some(r=>r.id===id)));
  const providers=P.build(ps,policy,C.TYPES).entries.map(e=>e.providerId);for(const id of r.competitionProviderIds||[])assert(providers.includes(id),'Mentioned provider must bind to selected cases: '+r.id+' / '+id);
  rows.push({id:r.id,...f,competitionProviders:r.competitionProviderIds||[]});
 }
 report.push({industry:d.name,directions:rows});
}
assert.equal(B.build(bundle.datasets).projects.length,486);assert.equal(bundle.datasets.length,6);assert.equal(bundle.datasets.reduce((n,d)=>n+d.clients.length,0),145);
console.log(JSON.stringify({status:'PASS',industries:report},null,2));
