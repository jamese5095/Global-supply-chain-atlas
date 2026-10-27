/* Industry editorial conclusions and live case evidence remain separate. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IndustryStrategy=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function evidence(dataset,recommendation,bg){
  const ps=bg.build([dataset]).projects,s=recommendation.selection;
  return ps.filter(p=>(!s.excludeRecordIds||!p.records.some(r=>s.excludeRecordIds.includes(r.id)))&&(s.recordIds?p.records.some(r=>s.recordIds.includes(r.id)):(!s.area||p.areaId===s.area)&&(!s.subindustries||s.subindustries.includes(p.client.subindustry))&&(!s.types||s.types.some(t=>p.types.includes(t))))&&(!s.countryIds||s.countryIds.includes(p.countryId)));
 }
 function facts(projects){return {cases:projects.length,clients:new Set(projects.map(p=>p.client.id)).size,subindustries:new Set(projects.map(p=>p.client.subindustry)).size,planned:projects.filter(p=>p.state==='planned').length,historical:projects.filter(p=>p.state==='case').length};}
 function capabilityFacts(dataset,rec,bg){
  const projects=evidence(dataset,rec,bg),f=facts(projects);
  if(rec.evidenceMode==='internal'){
   const opportunities=rec.opportunities||[],countries=new Set(opportunities.flatMap(o=>o.countryIds||[])),markets=new Set(opportunities.flatMap(o=>[...(o.countryIds||[]),...(o.areaIds||[])]));
   const stats=[[new Set(opportunities.map(o=>o.client)).size,rec.groupedDemand?'组客户需求':'家需求客户'],[rec.marketMetric?markets.size:countries.size,rec.marketMetric?'个市场':(rec.countryMetricLabel||'个产地国')]];
   if(rec.showInitiationStat!==false)stats.push([opportunities.filter(o=>o.state==='立项中').length,'项立项中']);
   return {projects,facts:f,kind:'internal',stats};
  }
  return {projects,facts:f,kind:'map',stats:[[f.clients,'家客户'],[f.cases,'个案例'],[f.subindustries,'个子行业']]};
 }
 function capabilityProofs(dataset,rec,projects){
  const records=new Map(projects.flatMap(p=>p.records.map(r=>[r.id,r]))),sources=new Map(dataset.sources.map(s=>[s.id,s]));
  return (rec.proofs||[]).flatMap(proof=>{
   const record=records.get(proof.recordId),source=sources.get(proof.sourceId);
   if(!record||!source||source.clientId!==record.clientId||!/^https?:\/\//.test(source.url))return [];
   return [{...proof,url:source.url,sourceLabel:source.label}];
  });
 }
 function renderCapabilityPlan(host,dataset,c,bg){
  const plan=c.capabilityPlan;
  host.innerHTML=`<div class="strategy-heading"><div><p class="strategy-eyebrow">INDUSTRY STRATEGY</p><h2>${esc(dataset.name)}行业能力建设</h2></div></div><p class="strategy-intro">${esc(plan.intro)}</p>
   <div class="strategy-direction-list strategy-capability-plan">${plan.items.map(rec=>{
    const e=capabilityFacts(dataset,rec,bg),f=e.facts,proofs=capabilityProofs(dataset,rec,e.projects);
    const clients=[...new Map(e.projects.map(p=>[p.client.id,p.client])).values()];
    const preferred=rec.highlightClientIds||[];clients.sort((a,b)=>{const ai=preferred.indexOf(a.id),bi=preferred.indexOf(b.id);return (ai<0?Infinity:ai)-(bi<0?Infinity:bi);});
    const names=clients.map(client=>client.name.split(' ')[0].replace(/（.*$/,'')),visible=names.slice(0,4);
    const related=e.kind==='internal'?'需求客户：'+[...new Set(rec.opportunities.map(o=>o.client))].join('、'):(visible.length?'相关客户：'+visible.join('、')+(names.length>4?`等${names.length}家`:''):'当前资料暂无匹配案例');
    return `<article class="strategy-direction strategy-capability" data-strategy-id="${esc(rec.id)}"><header><div class="strategy-capability-heading"><h3>${esc(rec.title)}</h3></div></header>
     <div class="strategy-analysis-grid">
      <section class="strategy-analysis-cell strategy-where"><h4>${rec.scopeTags?.length?'适用地区与服务链路':'适用国家与服务链路'}</h4>${(rec.scopeTags||[]).map(scope=>`<p class="strategy-scope-tag">${esc(scope.label)}</p>`).join('')}${rec.countryGroups.map(group=>`<div class="strategy-country-group"><p>${esc(group.label)}</p><div class="strategy-country-list">${group.countries.map(country=>`<button type="button" data-area="${esc(country.area)}" data-strategy-country="${esc(country.id)}" aria-label="查看${esc(country.name)}案例">${esc(country.name)}<span aria-hidden="true">↗</span></button>`).join('')}</div></div>`).join('')}${rec.serviceFlows?.length?`<div class="strategy-service-flows"><h5>服务链路</h5>${rec.serviceFlows.map(flow=>`<div class="strategy-service-flow">${flow.label?`<p>${esc(flow.label)}</p>`:''}<ol aria-label="${esc(flow.label||rec.title)}服务链路">${flow.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol></div>`).join('')}</div>`:''}</section>
      <section class="strategy-analysis-cell strategy-why" data-evidence-kind="${e.kind}"><h4>为什么建设</h4>${e.kind==='internal'?'<p class="strategy-evidence-kind">客户需求依据</p>':''}<div class="strategy-evidence-stats">${e.stats.map(([n,label])=>`<span><b>${n}</b>${label}</span>`).join('')}</div><p>${esc(rec.why)}</p><p class="strategy-customers" title="${esc(names.join('、'))}">${esc(related)}${f.planned||f.historical?`<small>含规划／建设${f.planned}项、历史${f.historical}项</small>`:''}</p>
       ${e.kind==='internal'?`<div class="strategy-opportunities">${rec.opportunities.map(o=>`<p><strong>${esc(o.client)}</strong><span>${esc(o.text)}</span><small>${esc(o.state)}</small></p>`).join('')}</div>`:proofs.length?`<div class="strategy-provider-proofs"><span>承接主体对标</span>${proofs.map(proof=>`<a href="${esc(proof.url)}" target="_blank" rel="noopener noreferrer" title="${esc(proof.sourceLabel)}">${esc(proof.provider)}：${esc(proof.service)}<small>（${esc(proof.country)}）</small><span aria-hidden="true">↗</span></a>`).join('')}</div>`:''}</section>
      <section class="strategy-analysis-cell strategy-foundation"><h4>已有基础与关键缺口</h4><div class="strategy-basis"><b>${esc(rec.basis.tag)}</b><p>${esc(rec.basis.text)}</p></div><p class="strategy-gap"><b>重点补齐</b>${esc(rec.gap)}</p></section>
      <section class="strategy-analysis-cell strategy-acquisition"><h4>如何建设</h4><div class="strategy-methods">${rec.methods.map(method=>`<div class="strategy-method"><span class="strategy-method-tag ${esc(method.kind)}">${esc(method.label)}</span><p>${esc(method.text)}</p></div>`).join('')}</div></section>
     </div></article>`;
   }).join('')}</div><p class="strategy-footnote">${esc(plan.footnote)}</p>`;
 }
 function render(host,dataset,content,bg){
  const c=content.industries[dataset.name];if(!c){host.innerHTML='';return;}
  if(c.capabilityPlan){renderCapabilityPlan(host,dataset,c,bg);return;}
  host.innerHTML=`<div class="strategy-heading"><div><p class="strategy-eyebrow">INDUSTRY STRATEGY</p><h2>${esc(dataset.name)}行业能力建设</h2></div></div>
  <p class="strategy-intro">${esc(c.intro||'围绕可聚合的客户需求选择建设方向，先验证节点复用，再确定能力获取方式。')}</p>

  <div class="strategy-subheading"><h3>建设方向与获取方式</h3><span>结合需求聚合、已有基础与能力缺口判断</span></div>
  <div class="strategy-direction-list">${c.recommendations.map(rec=>{
   const ps=evidence(dataset,rec,bg),f=facts(ps),examples=[...new Set(ps.map(p=>p.client.name.replace(/\s[A-Za-z].*$/,'')))].slice(0,4);
   return `<article class="strategy-direction" data-strategy-id="${esc(rec.id)}"><header><div><button type="button" class="strategy-region" data-area="${esc(rec.area)}" ${rec.country?`data-strategy-country="${esc(rec.country)}"`:""} aria-label="查看${esc(rec.region)}区域案例">${esc(rec.region)} ↗</button><h3>${esc(rec.title)}</h3></div><span class="strategy-stage">${esc(rec.stage)}</span></header>
    <div class="strategy-analysis-grid">
     <section class="strategy-analysis-cell strategy-where"><h4>建设区域与能力</h4><strong>${esc(rec.location)}</strong><p>${esc(rec.capacity)}</p><div class="strategy-tags">${rec.businessTypes.map(t=>`<span>${esc(t)}</span>`).join('')}</div></section>
     <section class="strategy-analysis-cell strategy-why"><h4>为什么建设</h4><div class="strategy-evidence-stats">${[[f.clients,'家客户'],[f.cases,'个案例'],[f.subindustries,'个子行业']].map(([n,label])=>`<span><b>${n}</b>${label}</span>`).join('')}</div><p>${esc(rec.why)}</p><p class="strategy-customers">${examples.length?'相关客户：'+esc(examples.join('、')):'当前资料暂无匹配案例'}${f.planned||f.historical?`<small>含规划／建设${f.planned}项、历史${f.historical}项</small>`:''}</p></section>
     <section class="strategy-analysis-cell strategy-foundation"><h4>已有基础与关键缺口</h4><div class="strategy-basis"><b>${esc(rec.basis.tag)}</b><p>${esc(rec.basis.text)}</p></div><p class="strategy-gap"><b>重点补齐</b>${esc(rec.gap)}</p></section>
     <section class="strategy-analysis-cell strategy-acquisition"><h4>如何建设</h4><div class="strategy-methods">${rec.methods.map(method=>`<div class="strategy-method"><span class="strategy-method-tag ${esc(method.kind)}">${esc(method.label)}</span><p>${esc(method.text)}</p></div>`).join('')}</div></section>
    </div>
   </article>`;
  }).join('')}</div><p class="strategy-footnote">能力依据：海外能力建设表${esc(c.source.sheet)}行业页。建设方向与获取方式为分析建议，未按案例数量直接排序；案例可包含自营及规划项目。</p>`;
 }
 return {evidence,facts,render,capabilityFacts,capabilityProofs};
});
