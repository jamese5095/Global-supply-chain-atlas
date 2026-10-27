/* Shared, non-filtering provider ranking for BG and industry homepages. */
(()=>{
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const colors=['#296da8','#358e97','#7176b7','#559abd','#719765','#ab8744','#725e94','#399baf','#437a5c','#94834c','#5880ba','#8a71a0','#4b92c0','#5b9991','#9a774c','#6e8b9b','#b28d64'];
 // Consumer pilot: the eight currently visible types use exact reference swatches.
 // Omit the five palest swatches (#8EB3E1 onward), never omit business segments.
 // Remaining types use retained swatches or intermediate blues from that range.
 const blueColors=['#072D6C','#0E4192','#1857B7','#246ED9','#052357','#093276','#0A377F','#134CA5','#1E62C8','#397CDB','#4F8ADB','#6598DD','#79A6DF','#11479C','#1B5DC0','#2F75DA','#5A91DC'];
 function blueInk(hex){const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4),l=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];return 1.05/(l+.05)>=4.5?'#ffffff':'#052357';}
 let tip,focusedTip;
 const hide=()=>{if(tip)tip.hidden=true;focusedTip=null;};
 function show(target,entries,provider,type){
  if(!tip){tip=document.createElement('div');tip.id='providerTooltip';tip.className='provider-tooltip';tip.setAttribute('role','tooltip');document.body.append(tip);}
  const clients=[...new Set(entries.map(e=>e.clientName))],historical=entries.filter(e=>e.state==='case').length,planned=entries.filter(e=>e.state==='planned').length;
  tip.innerHTML=`<strong>${esc(provider)} · ${esc(type)}</strong><p>${entries.length}个案例 · ${clients.length}家客户</p><p>${esc(clients.slice(0,5).join('、'))}${clients.length>5?'等':''}</p><ul>${entries.slice(0,3).map(e=>`<li>${esc(e.title)}</li>`).join('')}</ul>${entries.length>3?'<small>列示前3个案例</small>':''}${historical||planned?`<small>含历史${historical}项 · 规划／建设${planned}项</small>`:''}`;
  focusedTip={target,entries,provider,type};tip.hidden=false;const box=target.getBoundingClientRect(),r=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(box.left,innerWidth-r.width-12))+'px';tip.style.top=(box.bottom+r.height+12<innerHeight?box.bottom+8:Math.max(8,box.top-r.height-8))+'px';
 }
 function render(host,{projects,area='',type='',limit=10,title,theme='default'}){
  hide();const policy=JSON.parse(document.getElementById('provider-policy').textContent),model=ProviderAtlas.build(projects,policy,WorkbookAtlas.TYPES),ranking=ProviderAtlas.rank(model,{area,type,limit}),max=Math.max(1,...ranking.rows.map(r=>r.total));
  const palette=theme==='blue'?blueColors:colors,color=t=>palette[WorkbookAtlas.TYPES.indexOf(t)],ink=t=>theme==='blue'?`;color:${blueInk(color(t))}`:'';
  const used=WorkbookAtlas.TYPES.filter(t=>ranking.rows.some(r=>r.types[t]));
  host.classList.add('provider-card');host.setAttribute('aria-label',title);host.dataset.limit=limit;host.dataset.projectCount=ranking.projects;host.dataset.theme=theme;
  host.innerHTML=`<div class="provider-heading"><div><h2>${esc(title)}</h2><p>${ranking.projects}个案例符合统计条件 · ${ranking.providerCount}家外部承接商${type?' · 按主业务类型筛选：'+esc(type):''}</p></div><span>条长＝案例数 · 分段＝主业务类型</span></div>${ranking.rows.length?`<div class="provider-chart">${ranking.rows.map((r,i)=>`<div class="provider-row" data-provider="${esc(r.id)}" data-total="${r.total}"><div class="provider-name"><small>${String(i+1).padStart(2,'0')}</small><strong>${esc(r.name)}</strong></div><div class="provider-track"><div class="provider-stack" style="width:${100*r.total/max}%">${WorkbookAtlas.TYPES.filter(t=>r.types[t]).map(t=>`<button type="button" class="provider-segment" style="width:${100*r.types[t]/r.total}%;background:${color(t)}${ink(t)}" data-segment="${esc(t)}" data-count="${r.types[t]}" aria-label="${esc(r.name)}，${esc(t)}，${r.types[t]}个案例">${100*r.types[t]/max>=6?r.types[t]:''}</button>`).join('')}</div></div><b class="provider-total">${r.total}<small>例</small></b></div>`).join('')}</div><div class="provider-legend">${used.map(t=>`<span><i style="background:${color(t)}"></i>${esc(t)}</span>`).join('')}</div>`:'<p class="provider-empty">当前范围暂无符合统计条件的外部承接案例。</p>'}<p class="provider-note">仅统计承接关系明确、可归入官方17类的外部服务案例；排除企业自营及集团内部物流。每家每案例计一次，按其主业务类型分段；同一案例有多家承接商时分别计入，数量不代表市场份额。保留历史及规划案例。</p><p class="provider-note">悬停或键盘聚焦色块查看客户与项目。已核实别名按统一主体归并，跨区域案例不分摊至区域；不足${limit}家时按实际数量展示。</p>`;
  const byId=new Map(ranking.rows.map(r=>[r.id,r]));
  host.querySelectorAll('.provider-segment').forEach(b=>{const row=byId.get(b.closest('.provider-row').dataset.provider),entries=row.entries.filter(e=>e.type===b.dataset.segment);const open=()=>show(b,entries,row.name,b.dataset.segment);b.addEventListener('pointerenter',open);b.addEventListener('focus',open);b.addEventListener('pointerleave',hide);b.addEventListener('blur',hide);b.addEventListener('click',open);});
  return ranking;
 }
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});window.addEventListener('scroll',()=>{if(focusedTip&&document.activeElement===focusedTip.target){const {target,entries,provider,type}=focusedTip;show(target,entries,provider,type);}else hide();},{passive:true});window.addEventListener('resize',hide);
 window.ProviderCharts={render,hide};
})();
