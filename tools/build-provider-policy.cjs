/* Reviewed associations from existing project text and client-level evidence. Does not rewrite data.json. */
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..'),data=require(root+'/data.json'),ranking=require(root+'/provider-core.js');
const providers=[
 ['dhl','DHL集团',['DHL','DHL等','Deutsche Post','DHL Supply Chain','DHL Global Forwarding','DHL Freight','DHL Express','DHL Load Planning Center','DHL Supply Chain / DHL Freight']],
 ['ceva','CEVA',['CEVA','CEVA Logistics','CEVA（原Bolloré Logistics）']],
 ['kn','Kuehne+Nagel',['Kuehne+Nagel']],
 ['dsv','DSV集团',['DSV','DB Schenker Asia Pacific（DSV集团）','DB Schenker（DSV集团）','DB Schenker（现属DSV）']],
 ['gxo','GXO（含Wincanton）',['GXO','GXO Logistics','Wincanton']],
 ['fedex','FedEx',['FedEx','FedEx Ground']],['ups','UPS',['UPS']],['amazon','Amazon',['Amazon','Amazon Logistics US']],
 ['penske','Penske Logistics',['Penske','Penske Logistics']],['rhenus','Rhenus',['Rhenus','Rhenus Automotive','Rhenus AL']],
 ['neovia','Neovia',['Neovia Logistics Austria（原TLC）','TLC历史项目']],['fiege','FIEGE',['FIEGE']],
 ['mb','Martin Brower',['Martin Brower']],['havi','HAVI',['HAVI']],['bestfood','Best Food Logistics',['Best Food Logistics']],
 ['lekkerland','Lekkerland',['Lekkerland']],['mclane','McLane Foodservice',['McLane Foodservice']],['lineage','Lineage',['Lineage']],
 ['dpd','DPD',['DPD']],['usps','USPS',['USPS']],['bol','Logistics via bol',['Logistics via bol']],['canadapost','Canada Post',['Canada Post']],
 ['md','MD Logistics',['MD Logistics']],['mckesson','McKesson',['McKesson','McKesson Canada']],
 ['blondel','Groupe Blondel',['Groupe Blondel']],['geodis','GEODIS',['GEODIS']],['dpworld','DP World',['DP World']],
 ['netlog','Netlog',['Netlog']],['bleckmann','Bleckmann',['Bleckmann']],['malcolm','Malcolm Logistics',['Malcolm Logistics']],['staci','Staci',['Staci']],
 ['xpo','XPO Logistics',['XPO Logistics']],['zufall','ZUFALL',['ZUFALL logistics group']],['geis','Geis Group',['Geis Group']],
 ['trientec','Trientec',['Trientec']],['dbcargo','DB Cargo',['DB Cargo']],['duvenbeck','Duvenbeck',['Duvenbeck']],['blg','BLG',['BLG']],
 ['crusader','Crusader Logistics',['Crusader Logistics']],['vos','Vos Transport',['Vos Transport']],['cat','Groupe CAT',['Groupe CAT']],['yusen','Yusen Logistics',['Yusen Logistics']],
 ['nxnec','日通NEC物流',['Nittsu NEC Logistics（日通NEC）']],['teckwah','Teckwah',['Teckwah']],['cryoport','Cryoport',['Cryoport']],
 ['lx','LX Pantos',['LX Pantos Netherlands']],['dynalogic','Dynalogic',['Dynalogic']],['kaboodle','Kaboodle',['Kaboodle']],['arrowxl','ArrowXL',['ArrowXL']],['mcd','MCD',['MCD']],['lt','LT Solution',['LT Solution']],
 ['and','安得智联',['安得智联']],['sf','顺丰',['SF Express','SF']],['yunexpress','YunExpress',['YunExpress']],['4px','4PX',['4PX']],['sagawa','佐川急便',['佐川急便']],['yamato','ヤマト',['ヤマト']],['japanpost','日本邮便',['日本邮便等']]
].map(([id,name,aliases])=>({id,name,aliases}));
const policy={version:'2026-10-26',providers,selfRelations:[{clientId:'client-1xtfrlz',providerId:'and'},{clientId:'client-7jbfx2',providerId:'mckesson'}],bindings:[],groupingSources:[{group:'GXO / Wincanton',url:'https://investors.gxo.com/news-releases/news-release-details/gxo-completes-acquisition-wincanton'},{group:'GXO / Wincanton 2025',url:'https://www.sec.gov/Archives/edgar/data/1852244/000185224426000007/gxo-20251231.htm'}]};
const records=new Map(data.datasets.flatMap(d=>d.records.map(r=>[r.id,{d,r,c:d.clients.find(c=>c.id===r.clientId)}]))),rules=new Map();
function bind(id,names,type,caseKey){const x=records.get(id);if(!x)throw Error(id);let b=rules.get(id);if(!b)rules.set(id,b={recordId:id,signature:ranking.signature(x.r),reason:'已核对原项目地点、服务内容及客户D列对应来源；不将客户汇总主体分摊至无关项目。',actors:[]});for(const name of names){const a=x.c.actors.find(a=>a.name===name);if(!a)throw Error(id+' missing '+name);if(!a.sourceIds.length)throw Error('missing evidence '+id+' '+name);const t=type||x.r.types[0];if(!x.r.types.includes(t))throw Error('invalid primary '+id+' '+t);const previous=b.actors.find(v=>v.name===name);if(previous)Object.assign(previous,{type:t,...(caseKey?{caseKey}:{})});else b.actors.push({name,duty:a.duty,type:t,...(caseKey?{caseKey}:{})});}}
// Existing case-level associations retain their evidence; multi-type cases receive an explicit reviewed primary.
for(const {r,c}of records.values())if(r.attribute==='logistics'&&!r.reference&&r.types.length)for(const a of r.actors){const p=ranking.external(a,c,policy);if(p&&a.sourceIds.length)bind(r.id,[a.name],r.types[0]);}
// Automobile: production-network operators and tire contract logistics; captive group logistics are excluded.
bind('project-1jzv6nr',['CEVA Logistics']);bind('project-1cy61jw',['Duvenbeck']);
for(const id of ['project-1rbla3j','project-qaeiwh','project-cn5rq4'])bind(id,['CEVA Logistics']);
bind('project-1wosrw0',['DHL Supply Chain']);bind('project-s3pmmk',['Rhenus AL','BLG'],'入厂运输');
bind('project-16ny6vw',['Neovia Logistics Austria（原TLC）','TLC历史项目']);
for(const id of ['project-1490e05','project-16560wk','project-19ayh92'])bind(id,['Rhenus'],'入厂运输','zf-europe-production-network');
for(const id of ['project-15k85pn','project-wfgvf0','project-1uenk7u'])bind(id,['CEVA Logistics']);
bind('project-11rw90a',['DHL Supply Chain']);bind('project-he65o7',['DHL Supply Chain / DHL Freight']);
bind('project-rbnr4t',['DHL']);bind('project-165vl2o',['DHL Supply Chain']);
for(const id of ['project-1p707x5','project-bygnqb','project-1fi0bzm','project-xeevgb','project-y6t0sw'])bind(id,['FIEGE']);
bind('project-1csma18',['Crusader Logistics']);
// Industrial equipment: only disclosed warehouses, delivery nodes or a specified production service.
bind('project-eoq3vs',['DHL']);
for(const id of ['project-y3f85w','project-13ikp3x','project-1otsdq7'])bind(id,['DHL Supply Chain']);
for(const id of ['project-bjg5yb','project-f45o43','project-1hiu4ie'])bind(id,['Trientec']);
bind('project-zn335c',['Geis Group'],'HUB仓');bind('project-z2f72j',['DHL Supply Chain'],'成品仓');
bind('project-1ychwmm',['ZUFALL logistics group']);bind('project-69zv9b',['DB Cargo']);
bind('project-1cukmr9',['GXO Logistics']);for(const id of ['project-1svch0v','project-6jxg0m'])bind(id,['Wincanton'],'电商仓');
bind('project-4hpqrr',['Rhenus']);for(const id of ['project-9yw6r9','project-1nmnxp9'])bind(id,['XPO Logistics']);bind('project-nms11a',['DSV']);
// Consumer goods: validated operating sites and channel projects, not the customer's own warehouse network.
for(const id of ['project-rmcdj8','project-11g41vy'])bind(id,['Groupe Blondel']);
for(const id of ['project-1rzway5','project-eu2ius','project-eb2drv'])bind(id,['GXO']);
for(const id of ['project-16xizcl','project-bex305'])bind(id,['Kuehne+Nagel']);bind('project-h7ius4',['Maersk']);
for(const id of ['project-1ah0ph9','project-lk06au'])bind(id,[id==='project-1ah0ph9'?'CEVA Logistics':'CEVA（原Bolloré Logistics）']);
bind('project-1pcx6eh',['GXO'],'多功能仓');bind('project-1m9d9xz',['GXO']);bind('project-16asibx',['DHL Supply Chain']);
for(const id of ['project-stlee4','project-1ilkj5f'])bind(id,[id==='project-stlee4'?'CEVA Logistics':'Kuehne+Nagel']);
for(const id of ['project-j0ze5v','project-gesw3z'])bind(id,['GXO']);bind('project-1s4pfsq',['DHL Supply Chain']);
bind('project-1e5alob',['GEODIS']);bind('project-h74jc1',['DP World']);bind('project-1j5vep3',['DHL']);
for(const id of ['project-inuqv1','project-1w70bgk'])bind(id,['Kuehne+Nagel'],'成品仓','lego-tessenderlo-rdc');bind('project-5rn54c',['Kuehne+Nagel']);
bind('project-1lmexrz',['DHL Supply Chain']);bind('project-fi5ilv',['GXO']);bind('project-7hn8hp',['Netlog']);
bind('project-1018rs3',['YunExpress','4PX','SF Express','UPS','USPS','DHL等']);
bind('project-phu39n',['DHL']);bind('project-1qmu1ao',['DHL']);
bind('project-1t7bmek',['GXO']);for(const id of ['project-i5jkb','project-1rsqunm'])bind(id,['Kuehne+Nagel'],'BC共仓','adidas-mantova');
bind('project-1m2bpas',['Bleckmann']);bind('project-1eagja8',['Malcolm Logistics'],'生产物流');bind('project-aqwcmf',['CEVA Logistics']);
for(const id of ['project-1ijus5c','project-1k1dn8g'])bind(id,['FIEGE']);bind('project-1fs89hb',['Staci']);
// Medicine and food: internal hospital/pharmacy networks and automation vendors do not enter the ranking.
bind('project-j728kq',['McKesson']);bind('project-1e61du8',['DHL Supply Chain','GXO'],'售后仓');
bind('project-ncqigf',['Lineage']);
const mcdonald=data.datasets.find(d=>d.name==='餐饮').clients.find(c=>c.name==='麦当劳');
for(const r of records.values())if(r.c.id===mcdonald.id&&r.r.types.includes('仓-经销商/店'))bind(r.r.id,[r.r.countryId==='DE'?'HAVI':'Martin Brower'],'仓-经销商/店');
bind('project-77cqka',['Lekkerland']);bind('project-144pavx',['McLane Foodservice']);
// In a shared node the warehouse operator and the store distributor have different main services.
bind('project-1ejk2ul',['Penske'],'成品仓');bind('project-1ejk2ul',['Lekkerland'],'仓-经销商/店');
policy.bindings=[...rules.values()];
// Maersk is needed by the reviewed Unilever operating project.
policy.providers.push({id:'maersk',name:'Maersk',aliases:['Maersk','Maersk Project Logistics']});
fs.writeFileSync(root+'/provider-policy.json',JSON.stringify(policy,null,2)+'\n');
console.log(JSON.stringify({providers:policy.providers.length,reviewedProjects:policy.bindings.length}));
