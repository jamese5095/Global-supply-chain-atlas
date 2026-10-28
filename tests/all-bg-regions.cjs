const assert=require('node:assert/strict'),P=require('../bg-planning.js'),V=require('../bg-region-portrait.js'),B=require('../bg-core.js'),C=require('../workbook-core.js'),d=require('../data.json'),s=require('../industry-strategy.json'),c=require('../bg-content.json'),areas=require('../regions.json');
const m=P.compile(c.planning,s,d.datasets,areas,{strict:true}),bg=B.build(d.datasets),names=new Intl.DisplayNames(['zh-CN'],{type:'region'}),summaries=Object.fromEntries(Object.entries(c.regions).map(([id,r])=>[id,r.businessPortrait]));
assert.equal(m.regions.length,10);assert.equal(m.sourceCount,30);assert.equal(m.regions.reduce((n,r)=>n+r.caseSourceCount,0),6);
const report=[];
for(const area of areas.filter(a=>a.id!=='other')){
 const region=m.regions.find(r=>r.id===area.id),content=summaries[area.id];assert(region&&region.rows.length&&content?.focusItems.length,area.id);
 const rowIds=new Set(region.rows.map(r=>r.id)),covered=new Set(content.focusItems.flatMap(f=>f.planningRowIds));assert.deepEqual([...covered].sort(),[...rowIds].sort());
 for(const id of content.summaryCountryIds)assert(region.rows.some(r=>r.countries.some(c=>c.id===id)),area.id+' unsupported summary node '+id);
 for(const row of region.rows)for(const proof of row.caseSources){
  const dataset=d.datasets.find(d=>d.id===proof.datasetId),record=dataset.records.find(r=>r.id===proof.recordId);
  assert(!record.reference&&record.attribute==='logistics'&&record.scope==='country'&&record.areaId===area.id);assert.equal(proof.country.id,record.countryId);
  assert(proof.proofs.length&&proof.proofs.every(s=>s.clientId===record.clientId&&/^https?:\/\//.test(s.url)));
 }
 const portrait=V.render(V.build(B.select(bg,{area:area.id}),area,d.datasets,{agg:B,types:C.TYPES,countryName:id=>names.of(id)}),content);
 assert(portrait.includes(area.name+'业务画像'));assert(portrait.includes('区域能力重点'));assert(portrait.includes('data-bg-scroll-planning'));
 const detail=P.render(c.planning,m,{region:area.id,regionTitle:area.name});assert(detail.includes(area.name+'能力建设方向'));
 assert.equal((detail.match(/data-bg-cap-row=/g)||[]).length,region.rows.length);assert(!detail.includes('<details'));
 report.push({area:area.id,cases:B.select(bg,{area:area.id}).length,directions:region.rows.length,focusItems:content.focusItems.length});
}
const home=P.render(c.planning,m,{summaryRegions:m.regions.map(r=>r.id),summaries});assert.equal((home.match(/data-bg-full-planning=/g)||[]).length,10);
assert.equal((home.match(/data-bg-cap-row=/g)||[]).length,2,'Only cross-region/global chains remain detailed on the home page');
assert(!/行业输入|能力输入|能力建设规划/.test(home));assert.equal(bg.projects.length,486);
const wrongGeo=structuredClone(c.planning);wrongGeo.regions.find(r=>r.id==='africa').rows[0].evidenceRecords[0]={datasetId:'industry-1makncl',recordId:'project-1prjh2q',sourceIds:['source-u326bv']};assert.throws(()=>P.compile(wrongGeo,s,d.datasets,areas,{strict:true}),/Unsupported customer-node geography/);
const wrongSource=structuredClone(c.planning);wrongSource.regions.find(r=>r.id==='africa').rows[0].evidenceRecords[0].sourceIds=['source-u326bv'];assert.throws(()=>P.compile(wrongSource,s,d.datasets,areas,{strict:true}),/Unbound customer-node source/);
const missing=structuredClone(c.planning);missing.regions.find(r=>r.id==='eurasia').rows[0].evidenceRecords[0].recordId='missing';assert.throws(()=>P.compile(missing,s,d.datasets,areas,{strict:true}),/Missing customer-node record/);
console.log(JSON.stringify({status:'PASS',regions:report,sourceCapabilities:30,globalCases:486},null,2));
