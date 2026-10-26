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
  <p class="strategy-intro">围绕可聚合的客户需求选择建设方向，先验证节点复用，再确定能力获取方式。</p>
  <section class="strategy-matrix-section" aria-label="重点国家及区域能力矩阵"><div class="strategy-subheading"><h3>重点能力布局</h3><span>行业输入的建设档位</span></div><div class="strategy-matrix-wrap"><table class="strategy-matrix"><thead><tr><th scope="col">建设能力</th>${c.columns.map(col=>`<th scope="col">${esc(col.label)}</th>`).join('')}</tr></thead><tbody>${c.capabilities.map(cap=>`<tr data-capability="${esc(cap.id)}"><th scope="row">${esc(cap.label)}</th>${c.columns.map(col=>`<td data-source-cell="${col.column}${cap.sourceRow}"><span class="strategy-state ${states[cap.states[col.key]]}">${esc(cap.states[col.key])}</span></td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="strategy-matrix-note">“快速落地”表示输入表的复制条件判断，仍需落实当地资源；全渠道仓配展示仓储履约部分。</p></section>
  <div class="strategy-subheading"><h3>建设方向与获取方式</h3><span>结合需求聚合、已有基础与能力缺口判断</span></div>
  <div class="strategy-direction-list">${c.recommendations.map(rec=>{
   const ps=evidence(dataset,rec,bg),f=facts(ps),examples=[...new Set(ps.map(p=>p.client.name.replace(/\s[A-Za-z].*$/,'')))].slice(0,4);
   return `<article class="strategy-direction" data-strategy-id="${esc(rec.id)}"><header><div><button type="button" class="strategy-region" data-area="${esc(rec.area)}" aria-label="查看${esc(rec.region)}区域案例">${esc(rec.region)} ↗</button><h3>${esc(rec.title)}</h3></div><span class="strategy-stage">${esc(rec.stage)}</span></header>
    <div class="strategy-analysis-grid">
     <section class="strategy-analysis-cell strategy-where"><h4>建设区域与能力</h4><strong>${esc(rec.location)}</strong><p>${esc(rec.capacity)}</p><div class="strategy-tags">${rec.businessTypes.map(t=>`<span>${esc(t)}</span>`).join('')}</div></section>
     <section class="strategy-analysis-cell strategy-why"><h4>为什么建设</h4><div class="strategy-evidence-stats">${[[f.clients,'家客户'],[f.cases,'个案例'],[f.subindustries,'个子行业']].map(([n,label])=>`<span><b>${n}</b>${label}</span>`).join('')}</div><p>${esc(rec.why)}</p><p class="strategy-customers">${examples.length?'相关客户：'+esc(examples.join('、')):'当前资料暂无匹配案例'}${f.planned||f.historical?`<small>含规划／建设${f.planned}项、历史${f.historical}项</small>`:''}</p></section>
     <section class="strategy-analysis-cell strategy-foundation"><h4>已有基础与关键缺口</h4><div class="strategy-basis"><b>${esc(rec.basis.tag)}</b><p>${esc(rec.basis.text)}</p></div><p class="strategy-gap"><b>重点补齐</b>${esc(rec.gap)}</p></section>
     <section class="strategy-analysis-cell strategy-acquisition"><h4>如何建设及布局取舍</h4><div class="strategy-methods">${rec.methods.map(method=>`<div class="strategy-method"><span class="strategy-method-tag ${esc(method.kind)}">${esc(method.label)}</span><p>${esc(method.text)}</p></div>`).join('')}</div><p class="strategy-condition"><b>布局取舍</b>${esc(rec.condition)}</p></section>
    </div>
   </article>`;
  }).join('')}</div><p class="strategy-footnote">能力依据：海外能力建设表高科技行业页。建设方向与获取方式为分析建议，未按案例数量直接排序；案例可包含自营及规划项目。</p>`;
 }
 return {evidence,facts,render};
});
