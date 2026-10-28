const assert=require('node:assert/strict'),P=require('../bg-planning.js'),B=require('../bg-core.js'),R=require('../provider-core.js'),T=require('../workbook-core.js'),d=require('../data.json'),c=require('../bg-content.json'),s=require('../industry-strategy.json'),areas=require('../regions.json'),policy=require('../provider-policy.json');
const plan=c.planning,model=P.compile(plan,s,d.datasets,areas,{strict:true});
assert.equal(model.sourceCount,30);assert.equal(model.inputCount,30);assert.equal(model.industryCount,6);assert.deepEqual(model.unmapped,[]);assert.deepEqual(model.issues,[]);
assert.equal(model.regions.length,10);assert.equal(model.chains.length,2);assert.deepEqual(model.regions.filter(r=>r.primary).map(r=>r.id),['europe','southeast-asia','north-america']);
const all=model.regions.flatMap(r=>r.rows).concat(model.chains),used=new Set(all.flatMap(r=>r.sources.map(s=>s.id)));assert.equal(used.size,30);
for(const region of model.regions)for(const row of region.rows){
 assert((row.sources.length||row.caseSources.length)&&row.countries.length&&row.value&&row.basis&&row.gap&&row.methods.length);
 assert(row.countries.every(country=>country.area===region.id));
 for(const src of row.sources){assert(src.countries.some(c=>c.area===region.id));assert(d.datasets.find(d=>d.id===src.datasetId).name===src.industry);assert.equal(src.capability,s.industries[src.industry].capabilityPlan.items.find(cap=>cap.id===src.id));}
}
// Each applicable industry country is represented wherever that capability is mapped.
for(const src of model.catalog.values())for(const country of src.countries)assert(all.some(row=>row.sources.some(s=>s.id===src.id)&&row.countries.some(c=>c.id===country.id)),src.id+' / '+country.id);
const cgt=model.chains.find(c=>c.id==='chain-cgt');assert.equal(cgt.countries.length,0);assert(cgt.global);assert(!model.regions.some(r=>r.rows.some(row=>row.sources.some(s=>s.id==='pharma-cgt'))),'Global CGT not inferred into countries');
assert(!model.chains.some(c=>c.id==='chain-fresh'));
assert(!all.some(r=>r.sources.some(s=>['food-fresh-air','food-crossborder-cold','food-origin-sourcing'].includes(s.id))));
const cold=model.catalog.get('food-cold-storage');assert.deepEqual(cold.countries.map(c=>c.id).sort(),['GB','US']);
assert(!plan.basisCountries.some(x=>x.sourceId.startsWith('food-')),'Food regional demand must not inherit input-only countries');
assert(model.regions.find(r=>r.id==='north-america').rows.some(r=>r.id==='na-food-origin'));
const html=P.render(plan,model);assert.equal((html.match(/data-bg-cap-row=/g)||[]).length,28);assert(!html.includes('共建'));assert(!html.includes('案例依据'));
for(const src of model.catalog.values())assert(html.includes('data-bg-capability-source="'+src.id+'"'));
const bad=structuredClone(plan);bad.regions[0].rows[0].sourceIds.push('pharma-cgt');assert.throws(()=>P.compile(bad,s,d.datasets,areas,{strict:true}),/Unsupported region/);
const gone=structuredClone(plan);gone.regions[0].rows[0].sourceIds.push('removed-id');assert.throws(()=>P.compile(gone,s,d.datasets,areas,{strict:true}),/Missing source/);
const badBasis=structuredClone(plan);badBasis.basisCountries[0].sourceCells=['Z999'];assert.throws(()=>P.compile(badBasis,s,d.datasets,areas,{strict:true}),/Unbound basis/);
const added=structuredClone(s);added.industries.高科技.capabilityPlan.items.push({...added.industries.高科技.capabilityPlan.items[0],id:'new-capability'});assert.throws(()=>P.compile(plan,added,d.datasets,areas,{strict:true}),/Unmapped/,'New industry capability must be explicitly mapped');
const renamed=structuredClone(s);renamed.industries.高科技.capabilityPlan.items[0].title='Updated industry capability';assert(P.render(plan,P.compile(plan,renamed,d.datasets,areas,{strict:true})).includes('Updated industry capability'));
const escaped=structuredClone(plan);escaped.regions[0].rows[0].title='<img src=x onerror=alert(1)>';const safe=P.render(escaped,P.compile(escaped,s,d.datasets,areas,{strict:true}));assert(safe.includes('&lt;img'));assert(!safe.includes('<img'));
const bg=B.build(d.datasets),overview=c.insights.items.map(item=>B.stats(item.country?bg.projects.filter(p=>p.scope==='country'&&p.countryId===item.country):B.select(bg,{area:item.area})));
assert.equal(c.insights.title,'overview');assert.deepEqual(overview.map(x=>[x.projects,x.industries]),[[246,6],[46,5],[64,6]]);assert.equal(bg.projects.length,486);
const providers=R.rank(R.build(bg.projects,policy,T.TYPES));assert.equal(providers.projects,135);assert.equal(providers.providerCount,50);
console.log(JSON.stringify({status:'PASS',sourceCapabilities:30,regionalCombinations:26,regions:10,chains:2,overviewCounts:overview.map(x=>x.projects),mapCases:486,qualifiedProviderCases:135}));

const europe=model.regions.find(r=>r.id==='europe'),summary=c.regions.europe.businessPortrait;
const home=P.render(plan,model,{summaryRegions:['europe'],summaries:{europe:summary}});
assert.equal((home.match(/data-bg-cap-row=/g)||[]).length,21);
assert(home.includes('data-bg-full-planning="europe"'));
for(const row of europe.rows)assert(!home.includes('data-bg-cap-row="'+row.id+'"'),'Europe details belong to regional page');
for(const id of summary.summaryCountryIds)assert(europe.rows.some(r=>r.countries.some(c=>c.id===id)),'Summary node must be in the canonical plan');
const detail=P.render(plan,model,{region:'europe'});
assert.equal((detail.match(/data-bg-cap-row=/g)||[]).length,7);
assert(detail.includes('欧洲能力建设方向'));assert(detail.includes('data-bg-scroll-map'));
for(const row of europe.rows)assert(detail.includes('data-bg-cap-row="'+row.id+'"'));
for(const row of model.regions.filter(r=>r.id!=='europe').flatMap(r=>r.rows).concat(model.chains))assert(!detail.includes('data-bg-cap-row="'+row.id+'"'));
assert(!detail.includes('<details'),'Regional full plan remains expanded');
assert(P.render(plan,model,{region:'europe',filtered:true}).includes('不随单项业务筛选调整'));
assert.equal(P.render(plan,model,{region:'missing-region'}),'');
const changed=structuredClone(model);changed.regions.find(r=>r.id==='europe').rows[0].basis='Canonical updated foundation';assert(P.render(plan,changed,{region:'europe'}).includes('Canonical updated foundation'));
console.log('PASS: Europe home summary and regional seven-row detail share the same compiled plan');
