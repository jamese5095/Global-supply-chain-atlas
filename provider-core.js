/* Evidence-bound provider counts. One primary official type per provider/project. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ProviderAtlas=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const key=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s.,，。’'()（）\-]/g,'');
 const signature=r=>JSON.stringify([r.clientId,r.title,r.detail,r.types,r.scope,r.countryId,r.region,r.areaId,r.sourceIds]);
 function canonical(name,policy){const n=key(name);return policy.providers.find(p=>p.aliases.some(a=>key(a)===n))||null;}
 function external(actor,client,policy){
  const p=canonical(actor.name,policy);if(!p||['客户自营','集团物流','制造与供货','物业与设施','技术合作方','客户仓储使用方'].includes(actor.role))return null;
  if((policy.selfRelations||[]).some(x=>x.clientId===client.id&&x.providerId===p.id))return null;
  return p;
 }
 function build(projects,policy,officialTypes){
  const byRecord=new Map((policy.bindings||[]).map(b=>[b.recordId,b])),entries=[],seen=new Set();
  let matchedProjects=0;
  for(const project of projects){let matched=false;
   for(const record of project.records){
    const client=project.dataset.clients.find(c=>c.id===record.clientId);if(!client)continue;
    const rule=byRecord.get(record.id),reviewed=rule&&rule.signature===signature(record);
    const actors=reviewed?rule.actors.map(x=>({review:x,actor:client.actors.find(a=>a.name===x.name&&a.duty===x.duty)})).filter(x=>x.actor&&(!x.review.sourceIds||JSON.stringify(x.review.sourceIds)===JSON.stringify(x.actor.sourceIds))):record.actors.map(actor=>({actor,review:null}));
    for(const {actor,review}of actors){
     const provider=external(actor,client,policy);if(!provider||!actor.sourceIds?.length)continue;
     const type=review?.type||(record.types.length===1?record.types[0]:'');
     if(!officialTypes.includes(type)||!record.types.includes(type))continue;
     const sourceIds=[...new Set([...(record.sourceIds||[]),...actor.sourceIds])].filter(id=>project.dataset.sources.some(s=>s.id===id));if(!sourceIds.length)continue;
     // A changed duty invalidates a manual association, rather than inheriting an old scope.
     const projectKey=project.dataset.id+':'+(review?.caseKey||record.engagementId||record.id);
     const entryKey=provider.id+'|'+projectKey;
     matched=true;if(seen.has(entryKey))continue;seen.add(entryKey);
     entries.push({providerId:provider.id,providerName:provider.name,projectKey,type,industry:project.industry,clientId:client.id,clientName:client.name,clientKey:project.dataset.id+':'+client.id,areaId:project.areaId,title:record.title,state:record.state,scope:record.scope,countryId:record.countryId,region:record.region,sourceIds,recordId:record.id,disclosedName:actor.name});
    }
   }
   if(matched)matchedProjects++;
  }
  return {entries,eligibleProjects:projects.length,matchedProjects};
 }
 function rank(model,{area='',type='',limit=10}={}){
  const entries=model.entries.filter(e=>(!area||e.areaId===area)&&(!type||e.type===type)),groups=new Map();
  for(const e of entries){let g=groups.get(e.providerId);if(!g)groups.set(e.providerId,g={id:e.providerId,name:e.providerName,entries:[],types:{},clients:new Set()});g.entries.push(e);g.types[e.type]=(g.types[e.type]||0)+1;g.clients.add(e.clientKey);}
  const all=[...groups.values()].map(g=>({...g,total:g.entries.length,clientCount:g.clients.size,clients:[...g.clients]})).sort((a,b)=>b.total-a.total||b.clientCount-a.clientCount||a.name.localeCompare(b.name,'zh-CN'));
  return {rows:all.slice(0,limit),providerCount:all.length,projects:new Set(entries.map(e=>e.projectKey)).size,relations:entries.length,topRelations:all.slice(0,limit).reduce((n,r)=>n+r.total,0),limit};
 }
 return {build,rank,signature,canonical,external};
});
