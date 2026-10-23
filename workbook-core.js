/* Shared by browser imports and the reproducible build. Reads data only. */
(function(root){
 'use strict';
 const TYPES=['入厂运输','VMI/外库','线边仓','生产物流','厂-仓运输','HUB仓','进出口保税仓','多功能仓','成品仓','BC共仓','电商仓','仓-经销商/店','末端配送','售后仓','维修售后','逆向退货','逆向物流'];
 const TYPE_GROUPS=[{name:'入厂与生产',types:TYPES.slice(0,4)},{name:'正向仓配',types:TYPES.slice(4,13)},{name:'售后与逆向',types:TYPES.slice(13)}];
 const uniq=a=>[...new Set(a)];
 const norm=s=>String(s||'').replace(/\[\d+\]/g,'').replace(/[\s“”「」"'，,。；;：:、（）()｜|\-]/g,'').toLowerCase();
 function uid(prefix,s){let h=2166136261;for(const c of String(s)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return prefix+'-'+(h>>>0).toString(36);}
 const refNums=s=>uniq([...String(s||'').matchAll(/\[(\d+)\]/g)].map(m=>+m[1]));
 const safeUrl=u=>{try{const x=new URL(u);return /^https?:$/.test(x.protocol)?x.href:'';}catch{return '';}};
 const bare=s=>String(s||'').replace(/（[^）]*）|\([^)]*\)/g,'').trim();
 const regionAliases={'东北亚':'east-asia','东亚':'east-asia','北美洲':'north-america','南美':'latin-america','南美洲':'latin-america','欧盟':'europe','中亚':'eurasia'};
 const regionContext={'亚太':['east-asia','southeast-asia','south-asia','oceania'],'亚洲':['east-asia','southeast-asia','south-asia'],'EMEA':['europe','middle-east','africa'],'欧盟':['europe','middle-east']};
 function regionId(name,areas){return areas.find(a=>a.name===name)?.id||regionAliases[name]||'';}
 function countryCatalog(base,areas,numeric){
  const names=new Intl.DisplayNames(['zh-CN'],{type:'region'}),reverse=Object.fromEntries(Object.entries(numeric).map(([n,id])=>[id,n]));
  const byName=new Map(),byId=new Map();
  for(const a of areas)for(const id of a.countries){const c={id,name:names.of(id)||id,numeric:reverse[id],areaId:a.id,reference:false};byId.set(id,c);byName.set(bare(c.name),c);}
  for(const c of base){const old=byId.get(c.id)||{};const n={...old,...c,areaId:old.areaId||regionId(c.continent,areas)};byId.set(c.id,n);byName.set(bare(c.name),n);}
  const aliases={'中国':'CN','中国大陆':'CN','中国台湾':'TW','台湾':'TW','中国香港':'HK','香港':'HK','英国':'GB','美国':'US','韩国':'KR','俄罗斯':'RU','捷克':'CZ','土耳其':'TR','越南':'VN','伊朗':'IR','玻利维亚':'BO','坦桑尼亚':'TZ','老挝':'LA','巴拿马':'PA','苏格兰':'GB'};
  for(const [name,id]of Object.entries(aliases))if(byId.has(id))byName.set(name,byId.get(id));
  return {byName,byId,resolve(name){const x=byName.get(bare(name));return x?{...x,name,reference:/参考/.test(name)}:null;}};
 }
 function getTypes(title){return uniq([...String(title).matchAll(/[（(]([^（）()]*)[）)]/g)].flatMap(m=>m[1].split(/[、，,；;]/).map(t=>t.trim()).filter(t=>TYPES.includes(t))));}
 function cleanTitle(s){return String(s||'').replace(/[（(]([^（）()]*)[）)]/g,(m,v)=>v.split(/[、，,；;]/).some(t=>TYPES.includes(t.trim()))?'':m).replace(/\[\d+\]/g,'').trim();}
 function paragraphs(s){return String(s||'').split(/\n\s*\n/).filter(Boolean).map(x=>{const i=x.indexOf('：');return i>=0?{label:x.slice(0,i),text:x.slice(i+1)}:{label:'全球布局',text:x};});}
 function footprint(section,catalog,areas){
  const input=section?.text||'',spans=[],countryIds=[];
  for(const [key,c]of [...catalog.byName].sort((a,b)=>b[0].length-a[0].length)){
   let start=0,index;while((index=input.indexOf(key,start))>=0){const end=index+key.length;if(!spans.some(([lo,hi])=>index<hi&&end>lo)){spans.push([index,end]);countryIds.push(c.id);}start=end;}
  }
  const regionNames=uniq([...areas.map(a=>a.name),'北美洲','南美','拉美','东北亚','亚太'].filter(n=>input.includes(n)));
  const areaIds=uniq(regionNames.map(n=>n==='拉美'?'latin-america':regionId(n,areas)).filter(Boolean));
  return {label:section?.label||'',text:input,countryIds:uniq(countryIds),areaIds};
 }
 function actorRole(name,duty){
  if(/技术方|技术支持|包装技术|物业|园区设施|园区开发|设备方|仅为.*咨询|WMS.*设计/.test(name+duty))return /物业|园区/.test(name+duty)?'物业与设施':'技术合作方';
  if(/仓库使用方/.test(duty))return '客户仓储使用方';
  if(/制造体系|制造供应商|制造企业/.test(name)||(/最终装配|负责制造、装配/.test(duty)&&!/物流/.test(name)))return '制造与供货';
  if(/自营|自有|原厂|集团.*体系|供应链团队|物流团队|物料团队|制造组织|服务组织|物流中心|履约体系|常备库存|仓储体系/.test(name))return '客户自营';
  if(/集团物流/.test(name))return '集团物流';
  if(/未具名|第三方海外仓体系/.test(name))return '履约协作';
  return '第三方服务';
 }
 function splitNames(s){if(/体系|团队|自营|工厂|物流中心/.test(s))return [s];let depth=0,start=0,out=[];for(let i=0;i<s.length;i++){if('（('.includes(s[i]))depth++;if('）)'.includes(s[i]))depth--;if(s[i]==='、'&&!depth){out.push(s.slice(start,i));start=i+1;}}out.push(s.slice(start));return out.map(x=>x.trim()).filter(Boolean);}
 function actors(text,client,sourceMap,catalog,areas){
  const out=[];
  for(const line of String(text||'').split(/\n+/).filter(Boolean)){
   const inherited=refNums(line).map(n=>sourceMap.get(n)).filter(Boolean);
   const expanded=line.replace(/([；;])([^；;：]{1,55})(负责|提供)/g,'$1$2：$3');
   for(const part of expanded.split(/[；;](?=[^；;]*：)/)){
    const at=part.indexOf('：');if(at<0)continue;
    const names=part.slice(0,at).trim(),duty=part.slice(at+1).trim(),quotes=[...duty.matchAll(/[“「]([^”」]+)[”」]/g)].map(m=>m[1]);
    const sourceIds=refNums(part).map(n=>sourceMap.get(n)).filter(Boolean);
    let countryIds=uniq([...catalog.byName].filter(([k])=>k.length>1&&(names+duty).includes(k)).map(([,v])=>v.id));
    if(!countryIds.length)countryIds=uniq([...catalog.byName].filter(([k])=>k.length>1&&line.includes(k)).map(([,v])=>v.id));
    if(/上述/.test(duty)&&!countryIds.length&&out.length)countryIds=out[out.length-1].countryIds;
    const scopeNames=uniq([...areas.map(a=>a.name),...Object.keys(regionContext)].filter(k=>(names+duty).includes(k)));
    for(const name of splitNames(names))out.push({id:uid('provider',name),name,role:actorRole(name,duty),duty,quotes,sourceIds:sourceIds.length?sourceIds:inherited,countryIds,scopeNames,clientId:client.id});
   }
  }
  return out;
 }
 function functionGroups(s){return [/交付|派送|配送|送至|签收/,/安装|联网|试机/,/仓储|仓库|收储|库存|备货|拣包|寄售|履约|成品存储|分销仓/,/制造|装配|测试|集成|封装|基地建设|生产/,/运输|发运|出货|关务|集货/,/回收|退货|逆向/,/领用|机台|产线|物料/,/物流配套|物流统筹|货物物流/].map(r=>r.test(s));}
 function associate(record,client,catalog,areas){
  const txt=norm(record.title),all=record.title+' '+record.detail,groups=functionGroups(all);
  return client.actors.filter(p=>{
   const sharedSource=p.sourceIds.some(s=>record.sourceIds.includes(s));if(!sharedSource)return false;
   const named=p.quotes.some(q=>txt.includes(norm(q))||norm(q).includes(txt));
   const matchingFunction=functionGroups(p.duty.replace(/[“「][^”」]+[”」]/g,'')).some((v,i)=>v&&groups[i]);
   if(named)return true;
   if(!matchingFunction&&!(/上述/.test(p.duty)&&p.role==='技术合作方'))return false;
   if(record.scope==='region')return p.scopeNames.includes(record.region)||p.scopeNames.some(n=>regionContext[n]?.some(a=>record.contextAreas.includes(a)))||(!p.countryIds.length&&client.recordsCount===1);
   if(record.scope==='global')return !p.countryIds.length;
   if(p.countryIds.length)return p.countryIds.includes(record.countryId);
   const area=catalog.byId.get(record.countryId)?.areaId;
   if(p.scopeNames.length)return p.scopeNames.some(n=>regionId(n,areas)===area||(regionContext[n]||[]).includes(area));
   return client.countryIds.length===1;
  }).map(p=>({...p}));
 }
 function parseWorkbook(wb,options){
  const exchange=typeof module!=='undefined'&&module.exports?require('./workbook-roundtrip.js'):root.WorkbookRoundtrip;
  const restored=exchange?.restore(wb,{...options,core:api});if(restored)return restored;
  const {XLSX,areas,numeric,baseCountries}=options;
  const catalog=countryCatalog(baseCountries,areas,numeric),name=options.name||'高科技',industryId=uid('industry',name);
  let sheet,header;
  for(const sn of wb.SheetNames){const s=wb.Sheets[sn];for(let r=0;r<8;r++){const vals=[];for(let c=0;c<10;c++)vals.push(String(s[XLSX.utils.encode_cell({r,c})]?.v||''));if(vals.some(v=>/头部客户/.test(v))&&vals.some(v=>/信息来源/.test(v))){sheet=s;header=r;break;}}if(sheet)break;}
  if(!sheet)throw Error('没有找到“头部客户”和“信息来源”表头，请使用最新版行业模板。');
  const range=XLSX.utils.decode_range(sheet['!ref']),merges=sheet['!merges']||[];
  if(range.e.r>20000||range.e.c>600)throw Error('表格范围过大，请移除空白区域的多余格式后重试。');
  const read=(r,c)=>String(sheet[XLSX.utils.encode_cell({r,c})]?.v??'').trim();
  const inherited=(r,c)=>{const m=merges.find(m=>m.s.r<=r&&r<=m.e.r&&m.s.c<=c&&c<=m.e.c);return read(m?m.s.r:r,m?m.s.c:c);};
  const headers=Array.from({length:range.e.c+1},(_,c)=>inherited(header,c));
  const find=(re)=>headers.findIndex(v=>re.test(v));
  const columns={sub:find(/^子行业$/),client:find(/头部客户/),overview:find(/全球设厂|产能及市场|全球布局/),carrier:find(/承接主体|承运主体|承接商/),source:find(/信息来源/)};
  if(Object.values(columns).some(c=>c<0))throw Error('表格缺少子行业、全球布局、承接主体或来源列。');
  const countryColumns=[];const warnings=[];
  for(let c=0;c<=range.e.c;c++){
   if(Object.values(columns).includes(c))continue;
   const label=read(header+1,c);if(!label)continue;
   const country=catalog.resolve(label);if(!country)throw Error('无法识别国家／地区“'+label+'”，请检查国家表头。');
   countryColumns.push({col:c,country,region:headers[c],areaId:country.areaId||regionId(headers[c],areas)});
  }
  if(!countryColumns.length)throw Error('没有找到区域及国家两层表头。');
  const starts=[];for(let r=header+2;r<=range.e.r;r++)if(read(r,columns.client))starts.push(r);
  if(!starts.length)throw Error('表格没有客户记录。');
  const clients=[],sources=[],records=[],countryMap=new Map(),physical=[];
  for(const [i,row]of starts.entries()){
   const end=(starts[i+1]??(range.e.r+1))-1;
   const client={id:uid('client',industryId+'|'+read(row,columns.client)),name:read(row,columns.client),subindustry:inherited(row,columns.sub),overview:read(row,columns.overview),carrierText:read(row,columns.carrier),matrixRow:row+1,sections:paragraphs(read(row,columns.overview)),sourceIds:[]};
   if(!client.subindustry)throw Error(client.name+'缺少子行业。');
   client.footprint={production:footprint(client.sections[0],catalog,areas),market:footprint(client.sections[client.sections.length-1],catalog,areas)};
   const sourceMap=new Map();
   for(let r=row;r<=end;r++){
    const a=XLSX.utils.encode_cell({r,c:columns.source}),cell=sheet[a];if(!cell?.v)continue;
    const url=safeUrl(cell.l?.Target||String(cell.v).match(/https?:\/\/\S+/)?.[0]||'');
    if(!url){warnings.push(client.name+'：来源 '+a+' 缺少可用超链接');continue;}
    const label=String(cell.v),number=refNums(label)[0]||sourceMap.size+1,id=uid('source',client.id+'|'+url);
    if(!sources.some(s=>s.id===id))sources.push({id,label:label.replace(/^\[\d+\]\s*/,''),url,clientId:client.id,cell:a});
    sourceMap.set(number,id);client.sourceIds.push(id);
   }
   client.sourceRefs=Object.fromEntries(sourceMap);client.actors=actors(client.carrierText,client,sourceMap,catalog,areas);
   client.countryIds=[];
   for(const cc of countryColumns){
    const text=read(row,cc.col);if(!text)continue;
    const merge=merges.find(m=>m.s.r===row&&m.s.c===cc.col&&m.e.c>m.s.c);
    const address=XLSX.utils.encode_cell({r:row,c:cc.col});physical.push({clientId:client.id,cell:address,text});
    const scope=merge?'region':'country';
    let region=cc.region;
    if(scope==='region'){const declared=['亚太','EMEA','欧盟','北美','南美','欧洲','亚洲','东南亚','全球'].find(n=>text.split('\n')[0].includes(n));region=declared||region;}
    const contextAreas=regionContext[region]||[regionId(region,areas)].filter(Boolean);
    const covered=merge?countryColumns.filter(x=>x.col>=merge.s.c&&x.col<=merge.e.c).map(x=>x.country.id):[cc.country.id];
    if(!merge){countryMap.set(cc.country.id,{...cc.country,areaId:cc.areaId});client.countryIds.push(cc.country.id);}
    const chunks=text.split(/\n\s*\n/).filter(Boolean);
    for(const chunk of chunks){
     const lines=chunk.split('\n'),first=lines.shift(),types=getTypes(first),title=cleanTitle(first),detail=lines.join('\n')||title;
     const attribute=types.length?'logistics':/制造节点|装配节点|制造供货|最终装配|先进封装基地|服务器制造|制造及区域出货|按订单装配|服务器.*装配|装配与出货配套|集成交付项目/.test(title)?'manufacturing':'logistics';
     const existing=scope==='region'?records.find(r=>r.clientId===client.id&&r.region===region&&norm(r.title+' '+r.detail)===norm(title+' '+detail)):null;
     if(existing){existing.matrixCells.push(address);existing.eligibleCountryIds=uniq(existing.eligibleCountryIds.concat(covered));continue;}
     const sourceIds=refNums(chunk).map(n=>sourceMap.get(n)).filter(Boolean);
     const r={id:uid('project',client.id+'|'+(scope==='region'?region:cc.country.id)+'|'+title),clientId:client.id,title,detail,original:chunk,types,attribute,scope,region:scope==='region'?region:'',countryId:scope==='country'?cc.country.id:'',reference:scope==='country'&&cc.country.reference,areaId:scope==='country'?cc.areaId:regionId(region,areas),contextAreas,eligibleCountryIds:covered,matrixCells:[address],sourceIds:uniq(sourceIds),state:(/规划|拟开展|拟承接|土建|建设项目/.test(chunk)||/计划(?=于|在|将|未来|建设|新建|扩建|投产|启用|设立|投资|新增|到|至|[0-9]{4})/.test(chunk))?'planned':/案例|2013|2019|2020|2021|2022|2023|2024/.test(chunk)?'case':'disclosed'};
     records.push(r);
    }
   }
   if(!records.some(r=>r.clientId===client.id)&&client.carrierText){records.push({id:uid('project',client.id+'|global'),clientId:client.id,title:[...client.carrierText.matchAll(/“([^”]+)”/g)].map(m=>m[1]).filter((s,i,a)=>a.indexOf(s)===i).join('与')||'全球供应链服务',detail:client.carrierText,original:client.carrierText,types:getTypes(client.carrierText),attribute:'logistics',scope:'global',region:'全球',countryId:'',reference:false,areaId:'',contextAreas:[],eligibleCountryIds:[],matrixCells:[XLSX.utils.encode_cell({r:row,c:columns.carrier})],sourceIds:uniq(client.actors.flatMap(p=>p.sourceIds)),state:'disclosed'});}
   client.countryIds=uniq(client.countryIds);client.sourceIds=uniq(client.sourceIds);client.recordsCount=records.filter(r=>r.clientId===client.id).length;clients.push(client);
  }
  for(const r of records){const c=clients.find(c=>c.id===r.clientId);r.actors=associate(r,c,catalog,areas);}
  const ids=new Set();for(const r of records){if(ids.has(r.id))r.id+='-'+r.matrixCells[0];ids.add(r.id);r.engagementId=r.id;}
  const sourceUrls=new Map(sources.map(s=>[s.id,s.url]));
  for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){
   const a=records[i],b=records[j];if(a.attribute!=='manufacturing'||b.attribute!=='manufacturing'||a.clientId===b.clientId||!a.countryId||a.countryId!==b.countryId)continue;
   if(!a.sourceIds.some(x=>b.sourceIds.some(y=>sourceUrls.get(x)===sourceUrls.get(y))))continue;
   const ca=clients.find(c=>c.id===a.clientId),cb=clients.find(c=>c.id===b.clientId);
   const mentions=(r,c)=>(c.name.match(/[A-Za-z][A-Za-z0-9]{2,}/g)||[]).some(token=>new RegExp('\\b'+token+'\\b','i').test(r.title+' '+r.detail+' '+r.actors.map(p=>p.name).join(' ')));
   if(mentions(a,cb)||mentions(b,ca))b.engagementId=a.engagementId;
  }
  const data={schemaVersion:'2.0',id:industryId,name,version:options.version||new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}),workbook:options.filename||name+'.xlsx',clients,sources,records,countries:[...countryMap.values()],report:{customers:clients.length,sourceLinks:sources.length,projectCells:physical.length,projects:records.length,regional:records.filter(r=>r.scope==='region').length,manufacturing:records.filter(r=>r.attribute==='manufacturing').length,untyped:records.filter(r=>r.attribute==='logistics'&&!r.types.length).length,warnings},subindustries:uniq(clients.map(c=>c.subindustry))};
  validate(data);return data;
 }
 function validate(d){
  if(d?.schemaVersion!=='2.0'||!d.id||!d.name||!Array.isArray(d.clients)||!d.clients.length||!Array.isArray(d.records)||!Array.isArray(d.sources)||!Array.isArray(d.countries))throw Error('行业资料结构不完整。');
  for(const key of ['clients','records','sources'])if(new Set(d[key].map(x=>x.id)).size!==d[key].length)throw Error('资料编号重复：'+key);
  if(!Array.isArray(d.subindustries)||d.subindustries.some(s=>typeof s!=='string')||typeof d.workbook!=='string'||typeof d.version!=='string')throw Error('行业名称或版本资料不完整。');
  const cs=new Set(d.clients.map(x=>x.id)),ss=new Set(d.sources.map(x=>x.id)),gs=new Set(d.countries.map(x=>x.id));
  const validActor=p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&typeof p.duty==='string'&&typeof p.role==='string'&&Array.isArray(p.sourceIds)&&p.sourceIds.every(s=>ss.has(s));
  for(const c of d.clients)if(typeof c.name!=='string'||typeof c.subindustry!=='string'||typeof c.overview!=='string'||!Array.isArray(c.sections)||c.sections.some(s=>typeof s.label!=='string'||typeof s.text!=='string')||!Array.isArray(c.actors)||c.actors.some(p=>!validActor(p))||!Array.isArray(c.sourceIds)||c.sourceIds.some(s=>!ss.has(s))||!c.sourceRefs)throw Error('客户布局或服务主体资料不完整。');
  for(const r of d.records){if(!cs.has(r.clientId)||!Array.isArray(r.types)||r.types.some(t=>!TYPES.includes(t))||!['country','region','global'].includes(r.scope)||!['logistics','manufacturing'].includes(r.attribute)||!Array.isArray(r.actors))throw Error('项目字段或官方分类无效。');if(r.scope==='country'&&!gs.has(r.countryId))throw Error('项目国家缺少表头定义。');if(r.sourceIds.some(id=>!ss.has(id)))throw Error('项目来源关联失效。');}
  for(const r of d.records)if(typeof r.title!=='string'||typeof r.detail!=='string'||!Array.isArray(r.contextAreas)||r.contextAreas.some(x=>typeof x!=='string')||typeof r.areaId!=='string'||r.actors.some(p=>!validActor(p))||!['case','planned','disclosed'].includes(r.state))throw Error('项目内容或承接分工无效。');
  for(const g of d.countries)if(!/^[A-Z]{2}$/.test(g.id)||typeof g.name!=='string')throw Error('国家字段无效。');
  for(const s of d.sources)if(!safeUrl(s.url)||typeof s.label!=='string')throw Error('来源链接无效。');return true;
 }
 function filter(d,s,omit=[]){return d.records.filter(r=>{
  const c=d.clients.find(c=>c.id===r.clientId);
  return (omit.includes('sub')||!s.sub||c.subindustry===s.sub)&&(omit.includes('client')||!s.client||r.clientId===s.client)&&(omit.includes('type')||!s.type||r.types.includes(s.type))&&(!s.provider||r.actors.some(p=>p.id===s.provider))&&(s.references||!r.reference)&&(s.history||r.state==='disclosed')&&(s.scope==='all'||(s.scope==='manufacturing'?r.attribute==='manufacturing':r.attribute==='logistics'));
 });}
 function stats(rows){return {projects:new Set(rows.map(r=>r.engagementId||r.id)).size,clients:new Set(rows.map(r=>r.clientId)).size,providers:new Set(rows.flatMap(r=>r.actors.filter(p=>p.role==='第三方服务').map(p=>p.id))).size};}
 const api={TYPES,TYPE_GROUPS,parseWorkbook,validate,filter,stats,uid,uniq,norm,cleanTitle,safeUrl,regionId,regionContext,editable:{paragraphs,footprint,actors,associate,getTypes,refNums,countryCatalog}};
 root.WorkbookAtlas=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
