/* Versioned, lossless workbook exchange; visible edits are never hidden by metadata. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WorkbookRoundtrip=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const MAGIC='SF_ATLAS_WORKBOOK_V1',META='_atlas_meta',clone=x=>JSON.parse(JSON.stringify(x));
 const stable=x=>JSON.stringify(x),fingerprint=x=>{let h=2166136261;for(const c of stable(x)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
 function snapshot(wb,XLSX){
  const sheets={};
  for(const name of wb.SheetNames.filter(n=>n!==META)){
   const s=wb.Sheets[name],cells={};
   for(const a of Object.keys(s).filter(a=>!a.startsWith('!')).sort()){
    const c=s[a],value=String(c.v??'').replace(/\r\n/g,'\n').trim(),url=c.l?.Target||'';
    if(value||url)cells[a]={value,url};
   }
   sheets[name]={cells,merges:(s['!merges']||[]).map(m=>XLSX.utils.encode_range(m)).sort()};
  }
  return sheets;
 }
 function read(wb){
  const s=wb.Sheets[META];if(!s){if(wb.Workbook?.Names?.some(n=>n.Name==='_SF_ATLAS_V1')||wb.SheetNames.includes('区域共用与全球项目'))throw Error('统一表格辅助信息已丢失，请保留文件修改并重新导出模板。');return null;}
  if(s.A1?.v!==MAGIC)throw Error('表格辅助信息格式无效，请使用原始表格或重新导出。');
  const n=Number(s.A2?.v);if(!Number.isInteger(n)||n<1||n>300)throw Error('表格辅助信息长度无效。');
  let text='';for(let i=0;i<n;i++){const v=s['A'+(i+3)]?.v;if(typeof v!=='string')throw Error('表格辅助信息不完整。');text+=v;}
  const e=JSON.parse(text);if(e.version!==1||!e.dataset||!e.snapshot||!e.fields||fingerprint(e.dataset)!==e.dataFingerprint)throw Error('表格辅助信息校验失败。');return e;
 }
 function restore(wb,options){
  const {core,XLSX}=options,e=read(wb);if(!e)return null;
  const original=e.dataset;core.validate(original);
  if(options.name&&options.name!==original.name)throw Error('表格行业为'+original.name+'，请保持行业名称一致。');
  const current=snapshot(wb,XLSX),changed=[];
  if(stable(Object.keys(current).sort())!==stable(Object.keys(e.snapshot).sort()))throw Error('工作表结构已变化，请保留原表或重新导出。');
  for(const name of Object.keys(current)){
   if(stable(current[name].merges)!==stable(e.snapshot[name].merges))throw Error('表头或合并范围已变化，暂不自动载入；请保留原数据并重新导出模板。');
   for(const addr of new Set([...Object.keys(current[name].cells),...Object.keys(e.snapshot[name].cells)])){
    const now=current[name].cells[addr]||{value:'',url:''},was=e.snapshot[name].cells[addr]||{value:'',url:''};
    if(stable(now)!==stable(was)){
     const field=e.fields[name]?.[addr];if(!field)throw Error(name+'!'+addr+'不属于可编辑业务格；表头、客户行或项目范围变化请重新导出。');
     changed.push({sheet:name,cell:addr,field,before:was,after:now});
    }
   }
  }
  if(!changed.length){const d=clone(original);Object.defineProperty(d,'exchangeReport',{enumerable:false,value:{format:MAGIC,unchanged:true,visibleEdits:[],removedRecordIds:[]}});return d;}
  const d=clone(original),clients=new Map(d.clients.map(c=>[c.id,c])),catalog=core.editable.countryCatalog(options.baseCountries,options.areas,options.numeric);
  const sourceChanges=changed.filter(x=>x.field.kind==='source'),dataChanges=changed.filter(x=>x.field.kind!=='source');
  for(const x of sourceChanges){
   const f=x.field,c=clients.get(f.clientId),text=x.after.value,num=core.editable.refNums(text)[0];
   if(!text&&!x.after.url){
    if(f.sourceId){d.sources=d.sources.filter(s=>s.id!==f.sourceId);c.sourceIds=c.sourceIds.filter(id=>id!==f.sourceId);for(const k of Object.keys(c.sourceRefs))if(c.sourceRefs[k]===f.sourceId)delete c.sourceRefs[k];}
    continue;
   }
   if(!num)throw Error(x.cell+'来源需保留[n]编号。');
   const url=core.safeUrl(x.after.url||text.match(/https?:\/\/\S+/)?.[0]||'');if(!url)throw Error(x.cell+'缺少有效来源超链接。');
   if(f.sourceId&&Number(f.number)!==num)throw Error('来源编号变更请同步重导出，不直接改写既有编号。');
   if(!f.sourceId&&c.sourceRefs[num])throw Error('客户来源编号重复：['+num+']。');
   let s=d.sources.find(s=>s.id===f.sourceId);
   if(!s){s={id:core.uid('source',c.id+'|'+url),clientId:c.id,cell:x.cell};if(d.sources.some(v=>v.id===s.id))throw Error('新增来源已存在，请引用原编号。');d.sources.push(s);c.sourceIds.push(s.id);c.sourceRefs[num]=s.id;}
   Object.assign(s,{label:text.replace(/^\[\d+\]\s*/,''),url});
  }
  const refreshActors=new Set(),changedProjects=new Set(),removed=[];
  for(const x of dataChanges){
   const f=x.field,c=clients.get(f.clientId),text=x.after.value;
   if(x.after.url)throw Error(x.cell+'请将来源超链接放在信息来源列。');
   if(f.kind==='client'){
    if(!text&&['name','subindustry'].includes(f.key))throw Error('客户名称和子行业不能为空。');for(const id of f.clientIds||[c.id])clients.get(id)[f.key]=text;
    if(f.key==='overview'){c.sections=core.editable.paragraphs(text);c.footprint={production:core.editable.footprint(c.sections[0],catalog,options.areas),market:core.editable.footprint(c.sections.at(-1),catalog,options.areas)};}
    if(f.key==='carrierText')refreshActors.add(c.id);
   }else if(f.kind==='projects'){
    changedProjects.add(c.id);
    const previous=f.recordIds.map(id=>d.records.find(r=>r.id===id)),chunks=text.split(/\n\s*\n/).filter(Boolean),items=chunks.map(chunk=>{
     const lines=chunk.split('\n'),first=lines.shift(),title=core.cleanTitle(first),types=core.editable.getTypes(first);
     if(!title)throw Error(x.cell+'项目名称不能为空。');
     return {title,types,detail:lines.join('\n')||title,original:chunk};
    });
    const assigned=new Set(),matches=items.map(item=>{const r=previous.find(r=>r&&!assigned.has(r.id)&&r.title===item.title);if(r)assigned.add(r.id);return r;});
    const unmatched=previous.filter(r=>r&&!assigned.has(r.id)),slots=matches.map((r,i)=>r?null:i).filter(i=>i!==null);
    if(previous.length===items.length){slots.forEach((i,j)=>{matches[i]=unmatched[j];});}
    else if(unmatched.length&&slots.length)throw Error(x.cell+'同时增删和改名，无法确定原项目；请分两次保存。');
    const replacement=items.map((item,i)=>{
     const old=matches[i],r=old?clone(old):{id:core.uid('project',c.id+'|'+f.scope+'|'+f.countryId+'|'+f.region+'|'+item.title),clientId:c.id,engagementId:'',actors:[],state:'disclosed',attribute:'logistics',reference:!!f.reference,scope:f.scope,countryId:f.countryId||'',region:f.region||'',areaId:f.areaId||'',contextAreas:f.contextAreas||[],eligibleCountryIds:f.eligibleCountryIds||[],matrixCells:[x.cell]};
     if(!r.engagementId)r.engagementId=r.id;
     if(!old&&d.records.some(v=>v.id===r.id&&!f.recordIds.includes(v.id)))throw Error('新增项目与已有记录重名，请使用不同项目名称。');
     Object.assign(r,item);if(r.types.length)r.attribute='logistics';r.sourceIds=core.editable.refNums(item.original).map(n=>{const id=c.sourceRefs[n];if(!id)throw Error(x.cell+'引用['+n+']缺少来源。');return id;});
     if(!old){if(!r.sourceIds.length)throw Error('新增项目需引用至少一项有效来源。');r.actors=core.editable.associate(r,c,catalog,options.areas);}
     return r;
    });
    const keep=new Set(replacement.map(r=>r.id));previous.filter(r=>r&&!keep.has(r.id)).forEach(r=>removed.push(r.id));
    const positions=d.records.map((r,i)=>f.recordIds.includes(r.id)?i:-1).filter(i=>i>=0),at=positions.length?Math.min(...positions):d.records.length;
    d.records=d.records.filter(r=>!f.recordIds.includes(r.id));d.records.splice(at,0,...replacement);
   }else throw Error('不支持的业务格修改。');
  }
  const validSources=new Set(d.sources.map(s=>s.id));
  for(const c of d.clients){
   if(refreshActors.has(c.id))c.actors=core.editable.actors(c.carrierText,c,new Map(Object.entries(c.sourceRefs).map(([n,id])=>[Number(n),id])),catalog,options.areas);
   for(const a of c.actors)a.sourceIds=a.sourceIds.filter(id=>validSources.has(id));
   const records=d.records.filter(r=>r.clientId===c.id);if(changedProjects.has(c.id)){c.recordsCount=records.length;c.countryIds=core.uniq(records.filter(r=>r.scope==='country').map(r=>r.countryId));}
   for(const r of records){r.sourceIds=r.sourceIds.filter(id=>validSources.has(id));if(refreshActors.has(c.id))r.actors=core.editable.associate(r,c,catalog,options.areas);for(const a of r.actors)a.sourceIds=a.sourceIds.filter(id=>validSources.has(id));}
   for(const m of JSON.stringify([c.overview,c.carrierText,c.sections,...records.map(r=>[r.title,r.detail,r.original,...r.actors.map(a=>a.duty)])]).matchAll(/\[(\d+)\]/g))if(!c.sourceRefs[m[1]])throw Error(c.name+'引用['+m[1]+']缺少来源；请先同步修改业务内容。');
  }
  const seen=new Set(d.countries.map(c=>c.id));for(const r of d.records)if(r.countryId&&!seen.has(r.countryId)){const c=catalog.byId.get(r.countryId);if(!c)throw Error('国家无法识别。');d.countries.push(clone(c));seen.add(c.id);}
  d.subindustries=core.uniq(d.clients.map(c=>c.subindustry));
  if(changed.length){d.version=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});d.report={...d.report,customers:d.clients.length,projects:d.records.length,sourceLinks:d.sources.length,projectCells:new Set(d.records.flatMap(r=>r.matrixCells)).size,regional:d.records.filter(r=>r.scope==='region').length,manufacturing:d.records.filter(r=>r.attribute==='manufacturing').length,untyped:d.records.filter(r=>r.attribute==='logistics'&&!r.types.length).length};}
  core.validate(d);
  Object.defineProperty(d,'exchangeReport',{enumerable:false,value:{format:MAGIC,unchanged:!changed.length,visibleEdits:changed.map(x=>({sheet:x.sheet,cell:x.cell,kind:x.field.kind,clientId:x.field.clientId,from:x.before.value,to:x.after.value,urlBefore:x.before.url,urlAfter:x.after.url})),removedRecordIds:removed}});
  return d;
 }
 return {MAGIC,META,fingerprint,snapshot,read,restore};
});
