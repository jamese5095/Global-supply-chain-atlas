const assert=require('node:assert/strict'),B=require('../bg-core.js'),S=require('../industry-strategy.js'),C=require('../workbook-core.js'),bundle=require('../data.json'),content=require('../industry-strategy.json'),areas=require('../regions.json');
const expected={
 '高科技':[[4,4,2],[2,3,2],[4,6,1],[2,2,1],[3,3,1]],
 '汽车':[[4,5,3],[3,4,3],[5,5,3],[3,6,1],[2,4,1]],
 '工业设备':[[4,8,2],[4,6,2],[2,5,1],[2,3,2],[3,3,1]],
 '消费品':[[8,8,3],[2,2,2],[0,0,0],[4,4,3],[3,3,2]],
 '医药':[[2,4,1],[2,5,1],[3,4,1],[4,4,1],[2,2,1]],
 '餐饮':[[3,13,1],[2,2,1],[3,3,2],[4,4,1],[3,3,1]]
};
let cards=0,proofs=0,internal=0;
for(const d of bundle.datasets){
 const plan=content.industries[d.name].capabilityPlan,sourceById=new Map(d.sources.map(s=>[s.id,s]));
 assert.equal(plan.items.length,5,d.name); const unique=new Set();
 for(const [i,r]of plan.items.entries()){
  assert(!unique.has(r.id));unique.add(r.id);cards++;
  assert(!r.stage&&!r.rank&&!r.priority&&!r.date,'No stage, rank or date labels');
  assert(r.title&&r.why&&r.gap&&r.basis.text&&r.basis.sourceCells.length&&r.methods.length&&r.serviceFlows.length);
  for(const t of r.businessTypes)assert(C.TYPES.includes(t),'Official types only');
  for(const m of r.methods)assert(['build','partner','ma'].includes(m.kind));
  for(const f of r.serviceFlows)assert(f.steps.length>=2&&f.steps.every(Boolean));
  const ids=r.countryGroups.flatMap(g=>g.countries.map(c=>c.id));
  for(const g of r.countryGroups)for(const c of g.countries)assert(areas.find(a=>a.id===c.area).countries.includes(c.id));
  const e=S.capabilityFacts(d,r,B);assert.deepEqual([e.facts.clients,e.facts.cases,e.facts.subindustries],expected[d.name][i],r.id);
  assert.equal(new Set(e.projects.map(p=>p.key)).size,e.projects.length,'Distinct project counts');
  assert(e.projects.every(p=>p.records.every(r=>!r.reference&&r.attribute==='logistics')));
  assert(e.projects.every(p=>p.scope==='country'?ids.includes(p.countryId):(r.scopeTags||[]).some(s=>s.scope===p.scope)),'No global/region case invented into a country');
  for(const rid of r.selection.recordIds)assert(e.projects.some(p=>p.records.some(x=>x.id===rid)),'Missing selected record: '+rid);
  const pp=S.capabilityProofs(d,r,e.projects);assert.equal(pp.length,(r.proofs||[]).length,'All proof links must survive source checks');proofs+=pp.length;
  for(const p of pp){
   const pr=e.projects.find(x=>x.records.some(y=>y.id===p.recordId)),record=pr.records.find(x=>x.id===p.recordId),source=sourceById.get(p.sourceId);
   assert.equal(source.clientId,record.clientId);assert(/^https?:\/\//.test(p.url));
   assert.equal(p.country,pr.scope==='country'?r.countryGroups.flatMap(g=>g.countries).find(c=>c.id===pr.countryId).name:'全球');
  }
  assert.equal(S.capabilityProofs({...d,sources:[]},r,e.projects).length,0,'Source removal suppresses proof');
  assert.equal(S.capabilityFacts({...d,records:[]},r,B).facts.cases,0,'No hardcoded map counts');
  if(r.evidenceMode==='internal'){
   internal++;assert.equal(e.projects.length,0);assert.equal(r.selection.recordIds.length,0);assert(r.opportunities.length);
   for(const o of r.opportunities){assert(o.client&&o.state&&o.text);assert(o.countryIds.every(id=>ids.includes(id)));}
   assert.equal(e.stats[0][0],new Set(r.opportunities.map(o=>o.client)).size);
  }
 }
 const host={};S.render(host,d,content,B);
 assert.equal((host.innerHTML.match(/data-strategy-id=/g)||[]).length,5);
 assert.equal((host.innerHTML.match(/<h4>为什么建设<\/h4>/g)||[]).length,5);
 assert.equal((host.innerHTML.match(/class="strategy-service-flows"/g)||[]).length,5);
 assert(!/strategy-stage|布局取舍|建设日期|优先建设|需求复用 ·/.test(host.innerHTML));
}
const pharma=content.industries.医药.capabilityPlan.items[3],food=content.industries.餐饮.capabilityPlan.items;
assert.equal(pharma.countryGroups.length,0);assert.equal(pharma.scopeTags[0].scope,'global');
const fd=bundle.datasets.find(d=>d.name==='餐饮');
for(const cap of food){
 assert(!cap.evidenceMode&&!cap.opportunities&&!cap.scopeTags,'Food demand basis uses public country cases only');
 assert(cap.selection.recordIds.length>=2&&cap.proofs.length>=2);
 assert(!/行业输入|能力输入|已签|组客户需求|跟进需求/.test(cap.why),'Internal input cannot establish why to build');
 const evidence=S.capabilityFacts(fd,cap,B);
 assert.deepEqual(evidence.stats.map(x=>x[1]),['家客户','个案例','个子行业']);
 for(const proof of cap.proofs){
  const rec=fd.records.find(r=>r.id===proof.recordId);
  assert(cap.selection.recordIds.includes(rec.id));
  assert(rec.sourceIds.includes(proof.sourceId),'Proof must be linked to selected public project');
 }
 for(const country of cap.countryGroups.flatMap(g=>g.countries))assert(evidence.projects.some(p=>p.countryId===country.id),'Country must have a selected public project');
}
assert.deepEqual(food[1].countryGroups[0].countries.map(c=>c.id),['US']);
assert(!food.some(c=>c.id==='food-fresh-air'));
assert.equal(B.build(bundle.datasets).projects.length,486);assert.equal(cards,30);assert.equal(internal,1);
console.log(JSON.stringify({status:'PASS',cards,linkedProofs:proofs,internalDemandCards:internal,projects:486}));
