const assert=require('node:assert/strict'),fs=require('fs'),crypto=require('crypto');
const P=require('../provider-core.js'),B=require('../bg-core.js'),C=require('../workbook-core.js'),bundle=require('../data.json'),policy=require('../provider-policy.json');
const original=fs.readFileSync(require.resolve('../data.json')),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bg=B.build(bundle.datasets),m=P.build(bg.projects,policy,C.TYPES);
assert.equal(bg.projects.length,486,'Original BG case count unchanged');
for(const x of m.entries){assert(C.TYPES.includes(x.type));assert(x.sourceIds.length);assert(!['其他','现场物流'].includes(x.type));}
assert.equal(new Set(m.entries.map(e=>e.providerId+'|'+e.projectKey)).size,m.entries.length,'No provider/case duplicate');
for(const area of ['',...new Set(bg.projects.map(p=>p.areaId).filter(Boolean))]){
 const ranking=P.rank(m,{area,limit:area?5:10});assert(ranking.rows.length<=(area?5:10));
 for(const r of ranking.rows){assert.equal(Object.values(r.types).reduce((a,b)=>a+b,0),r.total);assert.equal(r.entries.length,r.total);}
}
for(const d of bundle.datasets){const r=P.rank(P.build(B.build([d]).projects,policy,C.TYPES),{limit:5});assert(r.rows.length>0&&r.rows.length<=5,d.name);}
for(const role of ['客户自营','集团物流','制造与供货','物业与设施','技术合作方','客户仓储使用方'])assert.equal(P.external({name:'DHL',role},{id:'test'},policy),null);
for(const rel of policy.selfRelations){const p=policy.providers.find(p=>p.id===rel.providerId);assert.equal(P.external({name:p.aliases[0],role:'第三方服务'},{id:rel.clientId},policy),null);}
assert.equal(P.canonical('Deutsche Post',policy).id,'dhl');assert.equal(P.canonical('Wincanton',policy).id,'gxo');assert.equal(P.canonical('Swisslog',policy),null);
for(const family of ['zf-europe-production-network','lego-tessenderlo-rdc','adidas-mantova'])assert.equal(m.entries.filter(e=>e.projectKey.endsWith(':'+family)).length,1,'Dedup '+family);
const syntheticActor=(name,role='第三方服务')=>({name,role,duty:'example',sourceIds:['s1']});
const a=syntheticActor('DHL'),b=syntheticActor('Deutsche Post'),u=syntheticActor('UPS');
const r={id:'r',clientId:'c',title:'case',detail:'test',types:['成品仓','末端配送'],scope:'country',countryId:'DE',region:'欧洲',sourceIds:['s1'],actors:[a,b,u],state:'disclosed'};
const d={id:'d',clients:[{id:'c',name:'Client',actors:[a,b,u]}],sources:[{id:'s1'}]};
const project={dataset:d,industry:'test',records:[r],areaId:'europe'};
const pol={...policy,bindings:[{recordId:'r',signature:P.signature(r),actors:[{name:'DHL',duty:'example',type:'成品仓'},{name:'Deutsche Post',duty:'example',type:'成品仓'},{name:'UPS',duty:'example',type:'末端配送'}]}]};
let sample=P.build([project],pol,C.TYPES);assert.equal(sample.entries.length,2,'Aliases merged; two operators each get one case');
assert.equal(P.rank(sample,{type:'成品仓'}).relations,1,'Primary single assignment');assert.equal(P.rank(sample,{area:'north-america'}).relations,0,'No geographic spreading');
assert.equal(P.build([{...project,records:[{...r,detail:'modified'}]}],pol,C.TYPES).entries.length,0,'Changed case invalidates manual multitype association');
assert.equal(P.build([{...project,dataset:{...d,clients:[{...d.clients[0],actors:d.clients[0].actors.map(a=>({...a,duty:'changed'}))}]}}],pol,C.TYPES).entries.length,0,'Changed actor duty invalidates association');
assert.equal(P.build([{...project,records:[{...r,types:[]}]}],{...policy,bindings:[]},C.TYPES).entries.length,0,'Untyped not forced into 17');
assert.equal(P.build([{...project,records:[{...r,types:['成品仓']}]}],{...policy,bindings:[]},C.TYPES).entries.length,2,'New explicit single-type records supported');
assert.equal(hash(fs.readFileSync(require.resolve('../data.json'))),hash(original),'Source file unchanged');
console.log(JSON.stringify({cases:bg.projects.length,qualifiedCases:P.rank(m).projects,providerRelations:m.entries.length,providers:P.rank(m).providerCount,globalTop10:P.rank(m).rows.map(r=>({name:r.name,cases:r.total})),tests:'PASS'},null,2));
