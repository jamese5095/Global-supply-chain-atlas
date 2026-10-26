/* Industry editorial conclusions and live case evidence remain separate. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IndustryStrategy=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const states={'快速落地':'ready','长期筑基':'develop','择机观察':'watch'};
 function evidence(dataset,recommendation,bg){
  const ps=bg.build([dataset]).projects,s=recommendation.selection;
  return ps.filter(p=>s.recordIds?p.records.some(r=>s.recordIds.includes(r.id)):(!s.area||p.areaId===s.area)&&(!s.subindustries||s.subindustries.includes(p.client.subindustry))&&(!s.types||s.types.some(t=>p.types.includes(t))));
 }
 function facts(projects){return {cases:projects.length,clients:new Set(projects.map(p=>p.client.id)).size,subindustries:new Set(projects.map(p=>p.client.subindustry)).size,planned:projects.filter(p=>p.state==='planned').length,historical:projects.filter(p=>p.state==='case').length};}
 function render(host,dataset,content,bg){
  const c=content.industries[dataset.name];if(!c){host.innerHTML='';return;}
  host.innerHTML=`<div class="strategy-heading"><div><p class="strategy-eyebrow">INDUSTRY STRATEGY</p><h2>高科技行业能力建设</h2></div><span class="strategy-version">${esc(content.version)}</span></div>
  <p class="strategy-intro">先聚合制造与品牌客户的仓运需求，再复制专业交付能力。</p>
  <section class="strategy-matrix-section" aria-label="重点国家及区域能力矩阵"><div class="strategy-subheading"><h3>重点能力布局</h3><span>行业输入的建设档位</span></div><div class="strategy-matrix-wrap"><table class="strategy-matrix"><thead><tr><th scope="col">建设能力</th>${c.columns.map(col=>`<th scope="col">${esc(col.label)}</th>`).join('')}</tr></thead><tbody>${c.capabilities.map(cap=>`<tr data-capability="${esc(cap.id)}"><th scope="row">${esc(cap.label)}</th>${c.columns.map(col=>`<td data-source-cell="${col.column}${cap.sourceRow}"><span class="strategy-state ${states[cap.states[col.key]]}">${esc(cap.states[col.key])}</span></td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="strategy-matrix-note">“快速落地”表示输入表的复制条件判断，仍需落实当地资源；全渠道仓配展示仓储履约部分。</p></section>
  <div class="strategy-card-list">${c.recommendations.map(rec=>{
   const ps=evidence(dataset,rec,bg),f=facts(ps),examples=[...new Set(ps.map(p=>p.client.name))].slice(0,4);
   return `<article class="strategy-card" data-strategy-id="${esc(rec.id)}"><header><span class="strategy-number">${String(rec.rank).padStart(2,'0')}</span><div><div class="strategy-card-title"><button type="button" class="strategy-region" data-area="${esc(rec.area)}" ${rec.country?`data-strategy-country="${esc(rec.country)}"`:""} aria-label="查看${esc(rec.region)}区域案例">${esc(rec.region)} ↗</button><span class="strategy-stage">${esc(rec.stage)}</span></div><h3>${esc(rec.title)}</h3></div></header>
    <div class="strategy-where"><span class="strategy-label">在哪里建设什么</span><strong>${esc(rec.location)}</strong><p>${esc(rec.capacity)}</p><div class="strategy-tags">${rec.businessTypes.map(t=>`<span>${esc(t)}</span>`).join('')}</div></div>
    <div class="strategy-why"><span class="strategy-label">为什么建设</span><div class="strategy-evidence-stats">${[[f.clients,'家客户'],[f.cases,'个案例'],[f.subindustries,'个子行业']].map(([n,label])=>`<span><b>${n}</b>${label}</span>`).join('')}</div><p>${esc(rec.why)}</p><p class="strategy-customers">${examples.length?'相关客户：'+esc(examples.join('、')):'当前资料暂无匹配案例'}${f.planned||f.historical?`<small>含规划／建设${f.planned}项、历史${f.historical}项</small>`:''}</p></div>
    <div class="strategy-how"><span class="strategy-label">如何建设</span><div class="strategy-basis"><b>${esc(rec.basis.tag)}</b><p>${esc(rec.basis.text)}</p></div><div class="strategy-steps" aria-label="建议建设路径">${rec.steps.map((step,i)=>`<div class="strategy-step ${step.kind}"><small>${String(i+1).padStart(2,'0')}</small><strong>${esc(step.name)}</strong><span>${esc(step.method)}</span></div>`).join('')}</div><p class="strategy-gap"><b>重点补齐</b>${esc(rec.gap)}</p><p class="strategy-condition">${esc(rec.condition)}</p></div>
   </article>`;
  }).join('')}</div><p class="strategy-footnote">能力依据：海外能力建设表高科技行业页。建设顺序与路径为分析建议；客户数量按对应案例去重，案例可包含自营及规划项目。</p>`;
 }
 return {evidence,facts,render};
});
