/* Pure import comparison: no writes, no implicit overwrite, no fuzzy deletions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ImportReview=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 function review(before,after,policy={}){
  const delta={};
  for(const key of ['clients','records','sources']){
   const old=new Map((before?.[key]||[]).map(x=>[x.id,x])),next=new Map(after[key].map(x=>[x.id,x]));
   delta[key]={added:[...next.keys()].filter(id=>!old.has(id)),removed:[...old.keys()].filter(id=>!next.has(id)),changed:[...next.keys()].filter(id=>old.has(id)&&JSON.stringify(old.get(id))!==JSON.stringify(next.get(id)))};
  }
  const conflicts=[];
  for(const s of after.sources){
   const removed=(policy.removedSources||[]).find(x=>x.industry===after.name&&(x.id===s.id||(x.clientId===s.clientId&&x.url===s.url)));
   if(removed)conflicts.push({kind:'removedSource',id:s.id,label:s.label,url:s.url,reason:removed.reason});
   const obsolete=(policy.repairedSources||[]).find(x=>x.industry===after.name&&x.oldUrl!==x.newUrl&&x.oldUrl===s.url);
   if(obsolete)conflicts.push({kind:'obsoleteSource',id:s.id,label:s.label,url:s.url,replacement:obsolete.newUrl,reason:obsolete.reason});
  }
  for(const r of after.records){const removed=(policy.removedRecords||[]).find(x=>x.industry===after.name&&x.id===r.id);if(removed)conflicts.push({kind:'removedRecord',id:r.id,label:r.title,reason:removed.reason});}
  return {industry:after.name,delta,conflicts,canApply:!conflicts.length,exchange:after.exchangeReport||null};
 }
 return {review};
});
