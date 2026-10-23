/* Shared, deterministic aggregation for the BG view. No country inference. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BGAtlas=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const unique=xs=>[...new Set(xs)];
 function build(datasets){
  const groups=new Map();
  for(const d of datasets){
   const clients=new Map(d.clients.map(c=>[c.id,c]));
   for(const r of d.records){
    if(r.reference||r.attribute!=='logistics')continue;
    const key=d.id+':'+(r.engagementId||r.id);
    if(!groups.has(key))groups.set(key,{key,industry:d.name,dataset:d,records:[],client:clients.get(r.clientId),record:r});
    groups.get(key).records.push(r);
   }
  }
  const projects=[...groups.values()].map(p=>({...p,types:unique(p.records.flatMap(r=>r.types)),clientKeys:unique(p.records.map(r=>p.dataset.id+':'+r.clientId)),areaId:p.record.areaId||'',countryId:p.record.scope==='country'?p.record.countryId:'',scope:p.record.scope,state:p.record.state,contextAreas:unique(p.records.flatMap(r=>r.contextAreas||[]))}));
  return {projects,industryCount:datasets.length,clientCount:datasets.reduce((n,d)=>n+d.clients.length,0),broad:projects.filter(p=>!p.areaId)};
 }
 function stats(ps){return {projects:ps.length,clients:unique(ps.flatMap(p=>p.clientKeys)).length,industries:unique(ps.map(p=>p.industry)).length,typed:ps.filter(p=>p.types.length).length,planned:ps.filter(p=>p.state==='planned').length,historical:ps.filter(p=>p.state==='case').length};}
 function select(model,{area='',type=''}={}){return model.projects.filter(p=>(!area||p.areaId===area)&&(!type||p.types.includes(type)));}
 function typeCounts(ps,types){return types.map(name=>({name,...stats(ps.filter(p=>p.types.includes(name)))})).sort((a,b)=>b.projects-a.projects||types.indexOf(a.name)-types.indexOf(b.name));}
 function industryCounts(ps,names){return names.map(name=>({name,...stats(ps.filter(p=>p.industry===name))}));}
 return {build,stats,select,typeCounts,industryCounts};
});
