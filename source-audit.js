/* Migrate only exact, previously audited snapshots; preserve later user edits. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SourceAudit=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 function fingerprint(d){let h=2166136261;const text=JSON.stringify([d.name,d.clients,d.records,d.sources]);for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16);}
 function upgrade(d,builtins){
  const audited=builtins.find(x=>x.id===d.id&&x.sourceAuditRevision);
  if(!audited||d.sourceAuditRevision===audited.sourceAuditRevision)return d;
  if(!(audited.sourceAuditPreviousFingerprints||[]).includes(fingerprint(d)))return d;
  return JSON.parse(JSON.stringify(audited));
 }
 return {fingerprint,upgrade};
});
