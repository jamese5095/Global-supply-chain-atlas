const assert=require('node:assert/strict'),P=require('../bg-region-portrait.js'),B=require('../bg-core.js'),C=require('../workbook-core.js'),bundle=require('../data.json'),areas=require('../regions.json');
const model=B.build(bundle.datasets),area=areas.find(a=>a.id==='europe'),names=new Intl.DisplayNames(['zh-CN'],{type:'region'}),opts={agg:B,types:C.TYPES,countryName:id=>names.of(id)};
const ps=B.select(model,{area:area.id}),m=P.build(ps,area,bundle.datasets,opts);
assert.equal(m.stats.projects,246);assert.equal(m.stats.industries,6);
assert.deepEqual(m.topCountries.map(c=>[c.id,c.stats.projects]),[['DE',36],['GB',31],['FR',20],['NL',19],['BE',17]]);
assert.equal(m.shared.stats.projects,15);assert.equal(m.countries.reduce((n,c)=>n+c.stats.projects,0)+m.shared.stats.projects,m.stats.projects);
for(const c of m.countries){
 assert(area.countries.includes(c.id));assert(c.projects.every(p=>p.scope==='country'&&p.countryId===c.id&&p.areaId===area.id));
 assert.deepEqual(c.stats,B.stats(c.projects));assert.equal(c.industries.reduce((n,i)=>n+i.projects,0),c.stats.projects);
 for(const industry of c.industries){
  const ip=c.projects.filter(p=>p.industry===industry.name);assert.equal(industry.projects,ip.length);
  for(const type of industry.services){assert(C.TYPES.includes(type.name));assert.equal(type.projects,ip.filter(p=>p.types.includes(type.name)).length);}
 }
 assert(!c.projects.some(p=>m.shared.projects.includes(p)),'Shared projects must never be allocated to a country');
}
assert.deepEqual(P.build(model.projects,area,bundle.datasets,opts).stats,m.stats,'Other regions and global context must not enter European statistics');
for(const type of ['成品仓','入厂运输','维修售后']){
 const filtered=B.select(model,{area:'europe',type}),fm=P.build(filtered,area,bundle.datasets,opts);
 assert.equal(fm.stats.projects,filtered.length);assert(fm.countries.every(c=>c.projects.every(p=>p.types.includes(type))));
 assert(fm.industries.every(i=>i.projects>0));
}
const empty=P.build([],area,bundle.datasets,opts);assert.equal(empty.countries.length,0);assert.equal(empty.stats.projects,0);assert(!P.render(empty).includes('class="bg-country-portrait"'));
const editorial=require('../bg-content.json'),content=editorial.regions.europe.businessPortrait;
const html=P.render(m,content);assert.equal((html.match(/class="bg-country-portrait"/g)||[]).length,5);
assert(!/能力建设|BG切入|现有能力依据|如何建设|并购|案例依据/.test(html));
assert(!html.includes('data-country='),'BG country drilldown must remain disabled');assert.equal((html.match(/data-bg-scroll-planning/g)||[]).length,1,'One jump to complete planning');assert(!html.includes('<select'),'No new filter menus');
assert(html.includes('区域能力重点'));assert.equal(content.focusItems.length,4);
assert(!/其他有案例国家|区域业务特征|区域共用项目/.test(html));assert(html.includes('含15个区域共用案例'));assert(html.includes('bg-country-service'));
assert.deepEqual(content.focusItems.flatMap(x=>x.planningRowIds).sort(),editorial.planning.regions.find(r=>r.id==='europe').rows.map(r=>r.id).sort());
assert(P.render(m,{...content,filtered:true}).includes('不随单项业务筛选调整'));

const unsafe=structuredClone(m);unsafe.topCountries[0].name='<img src=x onerror=alert(1)>';const safe=P.render(unsafe);assert(safe.includes('&lt;img'));assert(!safe.includes('<img'));
console.log(JSON.stringify({status:'PASS',europeCases:m.stats.projects,countries:m.countries.length,sharedCases:m.shared.stats.projects,topCountries:m.topCountries.map(c=>c.id),industryBusinessMapping:true,scopeReconciliation:true}));
