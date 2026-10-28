/* BG is an additional view over the same six editable industry datasets. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),core=WorkbookAtlas,agg=BGAtlas;
 const read=id=>JSON.parse($(id).textContent),editorial=read('bg-editorial'),meta=read('metadata'),areas=read('region-data'),geo=read('geo-data');
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const palette=['#e7edf3','#d9ebf8','#aed3ef','#76b1dd','#3f86bc','#15588f'];
 const bin=n=>!n?0:n<10?1:n<25?2:n<50?3:n<100?4:5;
 const areaMap=new Map(areas.map(a=>[a.id,a])),countryArea=new Map(areas.flatMap(a=>a.countries.map(id=>[id,a.id])));
 const iso=f=>meta.numeric[String(f.id).padStart(3,'0')]||String(f.id);
 const features=topojson.feature(geo,geo.objects.countries).features.filter(f=>iso(f)!=='AQ').map((f,i)=>({...f,iso:f.id==null?'geometry-'+i:iso(f)}));
 const shapes=areas.filter(a=>a.id!=='other').map(a=>({...a,geometry:topojson.merge(geo,geo.objects.countries.geometries.filter(g=>countryArea.get(iso(g))===a.id))}));
 let active=false,model,planningModel,area='',type='',datasets=[],projection,path,regionShapes,countryShapes;
 const displayNames=new Intl.DisplayNames(['zh-CN'],{type:'region'});
 function countryName(id){return meta.countries.find(c=>c.id===id)?.name||(/^[A-Z]{2}$/.test(id)?displayNames.of(id):id);}
 $('bgView').innerHTML=`<section id="bgPrioritySection" class="bg-priority-section" aria-label="区域进入顺序" hidden><div class="bg-priority-heading"><h2>区域进入顺序</h2><p>前三位与首页区域展示一致，其余按案例热度排列</p></div><div id="bgPriorityTop" class="bg-priority-top"></div><div id="bgPriorityMore" class="bg-priority-more"></div></section>
 <div class="bg-controls"><div class="context" id="bgContext"></div><button id="bgReset" class="reset-tag">清除选项 · 返回首页</button></div>
 <div class="bg-grid bg-hero"><section class="bg-card bg-map-box"><div class="bg-map-heading"><h2 id="bgMapTitle"></h2><span>区域 × 官方17类业务</span></div><svg id="bgMap" viewBox="0 0 1000 540" role="group" aria-label="BG全球区域地图"></svg><div class="legend" id="bgLegend"></div><p class="bg-map-note" id="bgMapNote"></p></section><aside class="bg-card bg-strategy-brief" id="bgStrategyBrief" aria-labelledby="bgStrategyTitle" hidden></aside><aside class="bg-card bg-brief" id="bgBrief" hidden></aside></div>
 <div class="bg-grid bg-secondary bg-analysis-grid"><section class="bg-card" id="bgTypeCard"><div class="bg-block-title"><div><h2 id="bgTypesTitle">供应链业务结构</h2><p>点击业务类型，联动地图与承接商统计</p></div><span id="bgTypesScope">17类 · 向下滚动查看</span></div><div class="bg-type-list" id="bgTypes"></div><p class="bg-count-note" id="bgCountNote"></p></section><section class="bg-card" id="bgIndustryCard" hidden><div class="bg-block-title"><div><h2 id="bgIndustryTitle">行业构成与资源复用</h2><p id="bgIndustryNote"></p></div></div><div class="bg-industries" id="bgIndustries"></div><div class="bg-reuse" id="bgReuse"></div></section><section id="bgProviders"></section></div>
 <section class="bg-card bg-capabilities" id="bgCapabilities"></section>`;
 const svg=d3.select('#bgMap'),mapLayer=svg.append('g'),sphere=mapLayer.append('path').attr('class','sphere'),regionLayer=mapLayer.append('g'),countryLayer=mapLayer.append('g');
 function syncPortraitHeight(){
  if(!active||!area)return;
  const height=Math.ceil($('bgMap').closest('.bg-map-box').getBoundingClientRect().height);
  if(height>0)$('bgView').style.setProperty('--bg-region-map-height',height+'px');
 }
 if(window.ResizeObserver)new ResizeObserver(syncPortraitHeight).observe($('bgMap').closest('.bg-map-box'));
 else window.addEventListener('resize',syncPortraitHeight);
 function rows(){return agg.select(model,{area,type});}
 function baseRows(){return agg.select(model,{area});}
 function renderPriorities(){
  $('bgPrioritySection').hidden=!area;
  if(!area){$('bgPriorityTop').innerHTML='';$('bgPriorityMore').innerHTML='';return;}
  const ranked=Object.entries(editorial.regions).sort((a,b)=>a[1].rank-b[1].rank);
  $('bgPriorityTop').innerHTML=ranked.slice(0,3).map(([id,c])=>`<button class="bg-priority-card ${area===id?'active':''}" data-bg-priority="${esc(id)}" aria-pressed="${area===id}" aria-label="区域${c.rank} ${esc(areaMap.get(id).name)}"><b class="bg-rank-number">${String(c.rank).padStart(2,'0')}</b><span class="bg-priority-copy"><span class="bg-priority-title"><strong>${esc(areaMap.get(id).name)}</strong></span><span class="bg-priority-short">${esc(c.short)}</span><span class="bg-priority-reason">${esc(c.reason)}</span></span></button>`).join('');
  $('bgPriorityMore').innerHTML=ranked.slice(3).map(([id,c])=>`<button class="bg-priority-chip ${area===id?'active':''}" data-bg-priority="${esc(id)}" aria-pressed="${area===id}" aria-label="区域${c.rank} ${esc(areaMap.get(id).name)}"><b>${String(c.rank).padStart(2,'0')}</b>${esc(areaMap.get(id).name)}</button>`).join('');
 }
 function drawMap(){
  const a=areaMap.get(area);
  if(a){const [w,s,e,n]=a.bounds;projection=d3.geoMercator().rotate([-a.center,0]).fitExtent([[30,25],[970,510]],{type:'MultiPoint',coordinates:[[w,s],[e,n]]}).clipExtent([[8,8],[992,532]]);}
  else projection=d3.geoNaturalEarth1().fitExtent([[18,34],[982,505]],{type:'FeatureCollection',features});
  path=d3.geoPath(projection);sphere.attr('d',a?null:path({type:'Sphere'}));
  regionLayer.style('display',a?'none':null);countryLayer.style('display',a?null:'none');
  regionShapes=regionLayer.selectAll('path').data(shapes,s=>s.id).join('path').attr('class','bg-map-region').attr('data-bg-region',s=>s.id).attr('d',s=>path(s.geometry)).attr('role',s=>model.projects.some(p=>p.areaId===s.id)?'button':null).attr('tabindex',s=>model.projects.some(p=>p.areaId===s.id)?0:null).on('click',(e,s)=>chooseArea(s.id)).on('keydown',(e,s)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseArea(s.id);}}).on('pointermove',(e,s)=>showTip(e,s.name,agg.select(model,{area:s.id,type}),true)).on('pointerleave',hideTip);
  countryShapes=countryLayer.selectAll('path').data(features,f=>f.iso).join('path').attr('class','bg-map-country').attr('data-bg-country',f=>f.iso).attr('d',f=>a&&countryArea.get(f.iso)===a.id?path(f):null).style('display',f=>a&&countryArea.get(f.iso)===a.id?null:'none').attr('role','img').attr('tabindex',null).on('pointermove',(e,f)=>showTip(e,countryName(f.iso),rows().filter(p=>p.scope==='country'&&p.countryId===f.iso),false)).on('pointerleave',hideTip);
 }
 function paintMap(){
  const all=agg.select(model,{type});
  regionShapes.attr('fill',s=>palette[bin(all.filter(p=>p.areaId===s.id).length)]).attr('aria-label',s=>`${s.name}，${all.filter(p=>p.areaId===s.id).length}个收录案例`);
  countryShapes.attr('fill',f=>palette[bin(all.filter(p=>p.scope==='country'&&p.countryId===f.iso).length)]).attr('aria-label',f=>`${countryName(f.iso)}，${all.filter(p=>p.scope==='country'&&p.countryId===f.iso).length}个国家案例，仅悬停查看`);
  $('bgMapTitle').textContent=area?areaMap.get(area).name+' · 区域业务布局':'全球 · 六行业供应链案例';
  $('bgLegend').innerHTML=['暂无案例','1–9','10–24','25–49','50–99','100+'].map((t,i)=>`<span><i class="swatch" style="background:${palette[i]}"></i>${t}</span>`).join('');
  $('bgMapNote').textContent=area?'鼠标悬停国家查看业务数量；国家不设置下钻。区域共用案例单独保留，不分摊至国家。':'色深表示收录案例数量。悬停区域看业务构成，点击进入区域；跨区域及全球案例不分摊热度。';
 }
 function highlightPortraitCountry(id=''){
  if(!active||!area)id='';
  $('bgBrief').querySelectorAll('[data-bg-portrait-country]').forEach(el=>el.classList.toggle('is-map-hover',!!id&&el.dataset.bgPortraitCountry===id));
  countryShapes?.classed('bg-region-highlight',f=>!!id&&f.iso===id);
 }
 function hideTip(){$('tooltip').hidden=true;highlightPortraitCountry();}
 function showTip(e,name,ps,isRegion){
  if(!active||e.pointerType==='touch')return hideTip();
  highlightPortraitCountry(isRegion?'':e.currentTarget?.dataset?.bgCountry||'');
  const s=agg.stats(ps),tip=$('tooltip'),ts=agg.typeCounts(ps,core.TYPES).filter(t=>t.projects).slice(0,5);
  tip.innerHTML=`<strong>${esc(name)}</strong>${s.projects}个案例 · ${s.clients}家客户 · ${s.industries}个行业<div class="bg-tooltip-types">${ts.map(t=>`<span>${esc(t.name)}</span><b>${t.projects}</b>`).join('')}</div>${s.planned||s.historical?`<small>含历史案例${s.historical}项 · 规划／建设${s.planned}项</small>`:''}<small>${isRegion?'点击查看区域总结、业务结构与承接商统计':'仅统计明确归属本国的案例；区域共用案例不分摊至国家'}</small>`;
  tip.hidden=false;const r=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(e.clientX+13,innerWidth-r.width-10))+'px';tip.style.top=Math.max(8,Math.min(e.clientY+13,innerHeight-r.height-10))+'px';
 }
 function renderBrief(ps){
  $('bgStrategyBrief').hidden=!!area;
  $('bgBrief').hidden=!area;
  if(!area){
   const c=editorial.insights;
   $('bgStrategyBrief').innerHTML=`<header class="bg-insights-heading"><h2 id="bgStrategyTitle">${esc(c.title)}</h2></header><div class="bg-overview-regions">${c.items.map((item,i)=>`<section class="bg-overview-region" aria-labelledby="bgOverviewRegion${i}"><h3 id="bgOverviewRegion${i}">${esc(item.title)}</h3><ul>${item.points.map(point=>`<li>${esc(point)}</li>`).join('')}</ul></section>`).join('')}</div>`;
   $('bgBrief').innerHTML='';return;
  }
  $('bgStrategyBrief').innerHTML='';
  if(area){
   const portrait=BGRegionPortrait.build(ps,areaMap.get(area),datasets,{agg,types:core.TYPES,countryName});
   const content=editorial.regions[area]?.businessPortrait,validRows=new Set((planningModel.regions.find(r=>r.id===area)?.rows||[]).map(r=>r.id));
   $('bgBrief').innerHTML=BGRegionPortrait.render(portrait,{...content,focusItems:(content?.focusItems||[]).filter(item=>item.planningRowIds.every(id=>validRows.has(id))),filtered:!!type});return;
  }

 }
 function renderCounts(ps){
  const base=baseRows(),ts=agg.typeCounts(base,core.TYPES),max=Math.max(1,...ts.map(t=>t.projects));
  $('bgTypesTitle').textContent=(area?areaMap.get(area).name:'全球')+' · 供应链业务结构';
  const visibleTypes=area?ts.filter(t=>t.projects>0):ts;
  $('bgTypesScope').textContent=area?`官方17类 · 本区涉及${visibleTypes.length}类`:'17类 · 向下滚动查看';
  $('bgTypes').innerHTML=visibleTypes.map(t=>`<button class="bg-type-row ${type===t.name?'active':''}" data-bg-type="${esc(t.name)}" aria-pressed="${type===t.name}" aria-label="${esc(t.name)}，${t.projects}个案例" ${!t.projects?'disabled':''} title="${t.projects}个案例 · ${t.clients}家客户 · ${t.industries}个行业"><span class="bg-type-name">${esc(t.name)}</span><span class="bg-track"><i style="width:${100*t.projects/max}%"></i></span><b>${t.projects}</b></button>`).join('')||'<p class="bg-empty">本区暂无已标注业务类型的案例。</p>';
  const st=agg.stats(base);
  $('bgCountNote').textContent=`${st.projects}个收录案例中，${st.typed}个已标注官方业务类型。一个案例可涉及多类，类型数量不可相加为项目总数。含历史案例${st.historical}项、规划／建设${st.planned}项。`;
  $('bgIndustryCard').hidden=!area;
  $('bgIndustryTitle').textContent='行业案例分布';
  $('bgReuse').hidden=true;
  if(!area){$('bgIndustries').innerHTML='';$('bgIndustryNote').textContent='';$('bgReuse').innerHTML='';return;}
  const industryCounts=agg.industryCounts(ps,datasets.map(d=>d.name)),imax=Math.max(1,...industryCounts.map(t=>t.projects));
  $('bgIndustryNote').textContent=type?`${type} · 涉及${agg.stats(ps).industries}个行业`:'案例分布用于识别跨行业共同需求';
  $('bgIndustries').innerHTML=industryCounts.map(t=>`<div class="bg-industry"><span>${esc(t.name)}</span><span class="bg-track"><i style="width:${100*t.projects/imax}%"></i></span><b>${t.projects}</b></div>`).join('');
  $('bgReuse').innerHTML='';
 }
 function renderCapabilities(){
  const regional=planningModel.regions.find(r=>r.id===area),host=$('bgCapabilities');
  host.hidden=!!area&&!regional;host.classList.toggle('bg-regional-planning',!!area);
  if(host.hidden){host.innerHTML='';return;}
  const summaries=Object.fromEntries(Object.entries(editorial.regions).map(([id,c])=>[id,{...c.businessPortrait,regionTitle:areaMap.get(id)?.name||id}]));
  host.innerHTML=BGPlanning.render(editorial.planning,planningModel,area?{region:area,regionTitle:areaMap.get(area).name,filtered:!!type}:{summaryRegions:planningModel.regions.map(r=>r.id),summaries});
 }
 function scrollToRegionalPlanning(){
  const heading=$('bgRegionalPlanningTitle');if(!heading)return;
  heading.focus({preventScroll:true});$('bgCapabilities').scrollIntoView({block:'start',behavior:'auto'});
 }
 function refresh(){
  if(!active)return;
  hideTip();const ps=rows(),s=agg.stats(ps);
  $('pageTitle').textContent='六行业国际供应链布局 · BG总览';document.title='六行业国际供应链布局 · BG总览';
  document.querySelector('.eyebrow').textContent='六行业需求 · 网络资源复用 · 能力布局';
  $('introText').innerHTML=window.AtlasScope.bg(window.AtlasHost.datasets(),{compact:!area});
  $('bgView').classList.toggle('bg-home',!area);
  $('bgView').classList.toggle('bg-region-portrait',!!area);
  $('summary').innerHTML=[[s.industries,'涉及行业'],[s.clients,'涉及客户'],[s.projects,'收录案例']].map(([n,l])=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
  $('bgContext').innerHTML=(area?`<button data-bg-clear="area">${esc(areaMap.get(area).name)} ×</button>`:'<span class="context-view">全球</span>')+(type?`<button data-bg-clear="type">${esc(type)} ×</button>`:'<span class="context-view">全部17类业务</span>');
  $('bgReset').disabled=!(area||type);
  $('version').textContent=`资料：六行业最新版表格 · BG汇总 · ${editorial.version}`;
  $('footerNote').textContent='地图按收录案例数着色；类型多标签计数，区域与全球范围独立保留。';
  renderPriorities();paintMap();renderBrief(ps);renderCounts(ps);ProviderCharts.render($('bgProviders'),{projects:model.projects,area,type,limit:area?5:10,title:(area?areaMap.get(area).name:'六行业 · 全球')+' · 外部承接商TOP'+(area?5:10),theme:'blue'});renderCapabilities();
  requestAnimationFrame(syncPortraitHeight);window.AtlasNav?.record(snapshot());
 }
 function chooseArea(id){if(!model.projects.some(p=>p.areaId===id)||!areaMap.has(id))return;area=id;drawMap();refresh();}
 function activate(){
  datasets=window.AtlasHost.datasets();model=agg.build(datasets);planningModel=BGPlanning.compile(editorial.planning,read('industry-strategy-content'),datasets,areas);planningModel.regions.sort((a,b)=>editorial.regions[a.id].rank-editorial.regions[b.id].rank);active=true;area='';type='';
  ProviderCharts.hide();$('industryProviders').hidden=true;document.body.classList.add('bg-mode');$('industryWorkspace').hidden=true;$('bgView').hidden=false;$('notice').hidden=true;$('industryName').hidden=true;
  document.querySelectorAll('[data-industry]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
  const tab=document.querySelector('[data-bg-home]');if(tab){tab.classList.add('active');tab.setAttribute('aria-pressed','true');}
  drawMap();refresh();
 }
 function deactivate(){
  active=false;hideTip();ProviderCharts.hide();document.body.classList.remove('bg-mode');$('industryWorkspace').hidden=false;$('bgView').hidden=true;
  document.querySelector('.eyebrow').textContent='客户产业布局 · 区域案例 · 供应链业务';$('footerNote').textContent='地图按客户数着色，数量不代表市场份额。';
 }
 $('bgBrief').addEventListener('pointerover',e=>{const el=e.target.closest('[data-bg-portrait-country]');if(el&&!el.contains(e.relatedTarget))highlightPortraitCountry(el.dataset.bgPortraitCountry);});
 $('bgBrief').addEventListener('pointerout',e=>{const el=e.target.closest('[data-bg-portrait-country]');if(el&&!el.contains(e.relatedTarget))highlightPortraitCountry();});
 $('bgBrief').addEventListener('focusin',e=>{const el=e.target.closest('[data-bg-portrait-country]');highlightPortraitCountry(el?.dataset.bgPortraitCountry||'');});
 $('bgBrief').addEventListener('focusout',e=>{if(!e.currentTarget.contains(e.relatedTarget))highlightPortraitCountry();});
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-bg-home'))activate();
  if(b.hasAttribute('data-bg-capability-source')){
   const id=b.dataset.bgCapabilitySource;
   requestAnimationFrame(()=>{const target=[...document.querySelectorAll('#industryStrategy [data-strategy-id]')].find(el=>el.dataset.strategyId===id);if(target){const heading=target.querySelector('h3');heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'auto'});}});return;
  }
  if(!active)return;
  if(b.hasAttribute('data-bg-full-planning')){chooseArea(b.dataset.bgFullPlanning);requestAnimationFrame(scrollToRegionalPlanning);return;}
  if(b.hasAttribute('data-bg-scroll-planning')){scrollToRegionalPlanning();return;}
  if(b.hasAttribute('data-bg-scroll-map')){$('bgMapTitle').setAttribute('tabindex','-1');$('bgMapTitle').focus({preventScroll:true});document.querySelector('#bgView .bg-hero').scrollIntoView({block:'start',behavior:'auto'});return;}
  if(b.hasAttribute('data-bg-priority'))chooseArea(b.dataset.bgPriority);
  if(b.hasAttribute('data-bg-planning-area')){chooseArea(b.dataset.bgPlanningArea);$('bgView').scrollIntoView({block:'start'});}
  if(b.hasAttribute('data-bg-type')){type=type===b.dataset.bgType?'':b.dataset.bgType;refresh();}
  if(b.hasAttribute('data-bg-clear')){if(b.dataset.bgClear==='area'){area='';drawMap();}else type='';refresh();}
 });
 $('bgReset').addEventListener('click',()=>{area='';type='';drawMap();refresh();});
 document.querySelector('.brand').addEventListener('click',()=>{if(window.AtlasNav)window.AtlasNav.home();else activate();});
 function snapshot(){return {kind:'bg',area,type,label:area?areaMap.get(area).name+' · BG区域':'BG总览首页'};}
 function restore(saved){activate();area=areaMap.has(saved.area)?saved.area:'';type=core.TYPES.includes(saved.type)?saved.type:'';drawMap();refresh();}
 window.AtlasBG={activate,deactivate,snapshot,restore,get active(){return active;}};
 Object.defineProperty(window,'bgDiagnostics',{get:()=>({active,area,type,priority:area?editorial.regions[area]?.rank:null,ranking:Object.entries(editorial.regions).sort((a,b)=>a[1].rank-b[1].rank).map(([id,c])=>({id,rank:c.rank})),all:agg.stats(model.projects),visible:agg.stats(rows()),broad:agg.stats(model.broad),types:agg.typeCounts(baseRows(),core.TYPES),regions:areas.filter(a=>a.id!=='other').map(a=>({id:a.id,...agg.stats(agg.select(model,{area:a.id,type}))}))})});
 activate();
})();
