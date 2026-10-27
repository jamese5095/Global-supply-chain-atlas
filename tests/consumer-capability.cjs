const assert=require('node:assert/strict');
const B=require('../bg-core.js'),S=require('../industry-strategy.js'),C=require('../workbook-core.js');
const bundle=require('../data.json'),content=require('../industry-strategy.json'),areas=require('../regions.json');
const d=bundle.datasets.find(d=>d.name==='消费品'),c=content.industries.消费品,plan=c.capabilityPlan;
assert.equal(plan.items.length,5);
const expected=[[8,8,3],[2,2,2],[0,0,0],[4,4,3],[3,3,2]],proofCounts=[2,2,0,3,3];
for(const [i,r]of plan.items.entries()){
 const e=S.capabilityFacts(d,r,B),f=e.facts,ids=r.countryGroups.flatMap(g=>g.countries.map(c=>c.id));
 assert.deepEqual([f.clients,f.cases,f.subindustries],expected[i],r.id);
 assert.equal(new Set(e.projects.map(p=>p.key)).size,e.projects.length);
 assert(e.projects.every(p=>p.scope==='country'&&ids.includes(p.countryId)),'No regional evidence inferred into named countries');
 for(const g of r.countryGroups)for(const country of g.countries)assert(areas.find(a=>a.id===country.area).countries.includes(country.id));
 for(const t of r.businessTypes)assert(C.TYPES.includes(t));
 assert(r.basis.sourceCells.length&&r.why&&r.gap&&r.methods.length);
 const proofs=S.capabilityProofs(d,r,e.projects);assert.equal(proofs.length,proofCounts[i]);
 assert(proofs.every(p=>p.country===r.countryGroups.flatMap(g=>g.countries).find(c=>c.id===e.projects.find(pr=>pr.records.some(x=>x.id===p.recordId)).countryId).name));
 assert.equal(S.capabilityProofs({...d,sources:[]},r,e.projects).length,0,'Missing source must suppress provider claims');
 assert.equal(S.capabilityProofs(d,r,[]).length,0,'Missing project must suppress provider claims');
 assert.equal(S.capabilityFacts({...d,records:[]},r,B).facts.cases,0,'Evidence counts derived from live records');
}
const dairy=plan.items[2],de=S.capabilityFacts(d,dairy,B);
assert.deepEqual(de.stats,[[2,'家需求客户'],[2,'个产地国'],[1,'项立项中']]);
assert.equal(de.projects.length,0,'Internal opportunities cannot become disclosed map projects');
assert.equal(B.build(bundle.datasets).projects.length,486);assert.equal(B.build([d]).projects.length,100);
const host={};S.render(host,d,content,B);
assert.equal((host.innerHTML.match(/data-strategy-id=/g)||[]).length,5);
assert.equal((host.innerHTML.match(/<h4>适用国家与服务链路<\/h4>/g)||[]).length,5);
assert(!host.innerHTML.includes('布局取舍'));assert(!host.innerHTML.includes('建设日期'));
assert.equal((host.innerHTML.match(/class="strategy-provider-proofs"/g)||[]).length,4);
assert.equal((host.innerHTML.match(/class="strategy-opportunities"/g)||[]).length,1);
const isolated=structuredClone(content);isolated.industries.消费品.capabilityPlan.items[0].title='<img src=x onerror="alert(1)">';S.render(host,d,isolated,B);assert(host.innerHTML.includes('&lt;img'));assert(!host.innerHTML.includes('<img'));
// BG continues to consume the existing regional recommendations.
assert.deepEqual(c.recommendations.map(r=>r.id),['consumer-japan-brand','consumer-europe-brand']);
for(const other of bundle.datasets.filter(x=>x.name!=='消费品'))assert.equal(content.industries[other.name].capabilityPlan.items.length,5,'Shared capability layout rolled out to all industries');
console.log('PASS: five consumer capabilities, country scope, live counts, internal opportunities, proof attribution, escaping and existing BG regional recommendation references');
