/* BG is an additional view over the same six editable industry datasets. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),core=WorkbookAtlas,agg=BGAtlas;
 const read=id=>JSON.parse($(id).textContent),editorial=read('bg-editorial'),meta=read('metadata'),areas=read('region-data'),geo=read('geo-data');
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const palette=['#e7edf3','#fae4e8','#efb8c3','#df879b','#bf4d6b','#8e2341'];
 const bin=n=>!n?0:n<10?1:n<25?2:n<50?3:n<100?4:5;
 const areaMap=new Map(areas.map(a=>[a.id,a])),countryArea=new Map(areas.flatMap(a=>a.countries.map(id=>[id,a.id])));
 const iso=f=>meta.numeric[String(f.id).padStart(3,'0')]||String(f.id);
 const features=topojson.feature(geo,geo.objects.countries).features.filter(f=>iso(f)!=='AQ').map((f,i)=>({...f,iso:f.id==null?'geometry-'+i:iso(f)}));
 const shapes=areas.filter(a=>a.id!=='other').map(a=>({...a,geometry:topojson.merge(geo,geo.objects.countries.geometries.filter(g=>countryArea.get(iso(g))===a.id))}));
 let active=false,model,area='',type='',datasets=[],projection,path,regionShapes,countryShapes;
 const displayNames=new Intl.DisplayNames(['zh-CN'],{type:'region'});
 function countryName(id){return meta.countries.find(c=>c.id===id)?.name||(/^[A-Z]{2}$/.test(id)?displayNames.of(id):id);}
 $('bgView').innerHTML=`<section class="bg-priority-section" aria-label="区域进入优先序列"><div class="bg-priority-heading"><h2>区域进入顺序</h2><p>首先复用优势，其次补齐能力</p></div><div id="bgPriorityTop" class="bg-priority-top"></div><div id="bgPriorityMore" class="bg-priority-more"></div></section>
 <div class="bg-controls"><div class="context" id="bgContext"></div><button id="bgReset" class="reset-tag">清除选项 · 返回首页</button></div>
 <div class="bg-grid"><section class="bg-card bg-map-box"><div class="bg-map-heading"><h2 id="bgMapTitle"></h2><span>区域 × 官方17类业务</span></div><svg id="bgMap" viewBox="0 0 1000 540" role="group" aria-label="BG全球区域地图"></svg><div class="legend" id="bgLegend"></div><p class="bg-map-note" id="bgMapNote"></p></section><aside class="bg-card bg-brief" id="bgBrief"></aside></div>
 <div class="bg-grid bg-secondary"><section class="bg-card"><div class="bg-block-title"><div><h2 id="bgTypesTitle">供应链业务结构</h2><p>点击业务类型，地图与案例同步筛选</p></div><span>17类 · 向下滚动查看</span></div><div class="bg-type-list" id="bgTypes"></div><p class="bg-count-note" id="bgCountNote"></p></section><section class="bg-card"><div class="bg-block-title"><div><h2>行业构成与资源复用</h2><p id="bgIndustryNote"></p></div></div><div class="bg-industries" id="bgIndustries"></div><div class="bg-reuse" id="bgReuse"></div></section></div>
 <section class="bg-card bg-capabilities" id="bgCapabilities"></section><section class="bg-card bg-cases" id="bgCases"></section>`;
 const svg=d3.select('#bgMap'),mapLayer=svg.append('g'),sphere=mapLayer.append('path').attr('class','sphere'),regionLayer=mapLayer.append('g'),countryLayer=mapLayer.append('g');
 function rows(){return agg.select(model,{area,type});}
 function baseRows(){return agg.select(model,{area});}
 function renderPriorities(){
  const ranked=Object.entries(editorial.regions).sort((a,b)=>a[1].rank-b[1].rank);
  $('bgPriorityTop').innerHTML=ranked.slice(0,3).map(([id,c])=>`<button class="bg-priority-card ${area===id?'active':''}" data-bg-priority="${esc(id)}" aria-pressed="${area===id}" aria-label="第${c.rank}优先 ${esc(areaMap.get(id).name)}"><b class="bg-rank-number">${String(c.rank).padStart(2,'0')}</b><span class="bg-priority-copy"><span class="bg-priority-title"><strong>${esc(areaMap.get(id).name)}</strong><small>${esc(c.tier)}</small></span><span class="bg-priority-short">${esc(c.short)}</span><span class="bg-priority-reason">${esc(c.reason)}</span></span></button>`).join('');
  $('bgPriorityMore').innerHTML=ranked.slice(3).map(([id,c])=>`<button class="bg-priority-chip ${area===id?'active':''}" data-bg-priority="${esc(id)}" aria-pressed="${area===id}" aria-label="第${c.rank}优先 ${esc(areaMap.get(id).name)}"><b>${String(c.rank).padStart(2,'0')}</b>${esc(areaMap.get(id).name)}<small>${esc(c.tier)}</small></button>`).join('');
 }
 function drawMap(){
  const a=areaMap.get(area);
  if(a){const [w,s,e,n]=a.bounds;projection=d3.geoMercator().rotate([-a.center,0]).fitExtent([[30,25],[970,510]],{type:'MultiPoint',coordinates:[[w,s],[e,n]]}).clipExtent([[8,8],[992,532]]);}
  else projection=d3.geoNaturalEarth1().fitExtent([[18,34],[982,505]],{type:'FeatureCollection',features});
  path=d3.geoPath(projection);sphere.attr('d',a?null:path({type:'Sphere'}));
  regionLayer.style('display',a?'none':null);countryLayer.style('display',a?null:'none');
  regionShapes=regionLayer.selectAll('path').data(shapes,s=>s.id).join('path').attr('class','bg-map-region').attr('data-bg-region',s=>s.id).attr('d',s=>path(s.geometry)).attr('role',s=>model.projects.some(p=>p.areaId===s.id)?'button':null).attr('tabindex',s=>model.projects.some(p=>p.areaId===s.id)?0:null).on('click',(e,s)=>chooseArea(s.id)).on('keydown',(e,s)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseArea(s.id);}}).on('pointermove',(e,s)=>showTip(e,s.name,agg.select(model,{area:s.id,type}),true)).on('pointerleave',hideTip);
  countryShapes=countryLayer.selectAll('path').data(features,f=>f.iso).join('path').attr('class','bg-map-country').attr('d',f=>a&&countryArea.get(f.iso)===a.id?path(f):null).style('display',f=>a&&countryArea.get(f.iso)===a.id?null:'none').attr('role','img').attr('tabindex',null).on('pointermove',(e,f)=>showTip(e,countryName(f.iso),rows().filter(p=>p.scope==='country'&&p.countryId===f.iso),false)).on('pointerleave',hideTip);
 }
 function paintMap(){
  const all=agg.select(model,{type});
  regionShapes.attr('fill',s=>palette[bin(all.filter(p=>p.areaId===s.id).length)]).attr('aria-label',s=>`${s.name}，${all.filter(p=>p.areaId===s.id).length}个收录案例`);
  countryShapes.attr('fill',f=>palette[bin(all.filter(p=>p.scope==='country'&&p.countryId===f.iso).length)]).attr('aria-label',f=>`${countryName(f.iso)}，${all.filter(p=>p.scope==='country'&&p.countryId===f.iso).length}个国家案例，仅悬停查看`);
  $('bgMapTitle').textContent=area?areaMap.get(area).name+' · 区域业务布局':'全球 · 六行业供应链案例';
  $('bgLegend').innerHTML=['暂无案例','1–9','10–24','25–49','50–99','100+'].map((t,i)=>`<span><i class="swatch" style="background:${palette[i]}"></i>${t}</span>`).join('');
  $('bgMapNote').textContent=area?'鼠标悬停国家查看业务数量；国家不设置下钻。区域共用案例单独保留，不分摊至国家。':'色深表示收录案例数量。悬停区域看业务构成，点击进入区域；跨区域及全球案例不分摊热度。';
 }
 function hideTip(){$('tooltip').hidden=true;}
 function showTip(e,name,ps,isRegion){
  if(!active||e.pointerType==='touch')return hideTip();
  const s=agg.stats(ps),tip=$('tooltip'),ts=agg.typeCounts(ps,core.TYPES).filter(t=>t.projects).slice(0,5);
  tip.innerHTML=`<strong>${esc(name)}</strong>${s.projects}个案例 · ${s.clients}家客户 · ${s.industries}个行业<div class="bg-tooltip-types">${ts.map(t=>`<span>${esc(t.name)}</span><b>${t.projects}</b>`).join('')}</div>${s.planned||s.historical?`<small>含历史案例${s.historical}项 · 规划／建设${s.planned}项</small>`:''}<small>${isRegion?'点击查看区域总结、完整业务类型数量及案例':'国家案例统计；区域共用信息见下方案例'}</small>`;
  tip.hidden=false;const r=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(e.clientX+13,innerWidth-r.width-10))+'px';tip.style.top=Math.max(8,Math.min(e.clientY+13,innerHeight-r.height-10))+'px';
 }
 function renderBrief(ps){
  const c=area?editorial.regions[area]:editorial.global,st=agg.stats(ps);
  if(!c){$('bgBrief').innerHTML='<p>选择区域查看业务特点。</p>';return;}
  const rank=c.rank?`<div class="bg-regional-priority"><span class="bg-priority-badge">第${c.rank}优先 · ${esc(c.tier)}</span><p>${esc(c.reason)}</p></div>`:'';
  $('bgBrief').innerHTML=`<p class="bg-kicker">${area?esc(areaMap.get(area).name)+' · 区域业务判断':'BG · 全球业务判断'}</p><h2>${esc(c.headline)}</h2>${rank}${type?`<p class="bg-focus">${esc(type)}：${st.projects}个案例 · ${st.clients}家客户 · ${st.industries}个行业</p>`:''}<section class="bg-analysis-section"><h3>区域业务特点</h3><p>${esc(c.features)}</p></section><section class="bg-analysis-section"><h3>BG切入方向</h3><p>${esc(c.entry)}</p></section><section class="bg-analysis-section bg-basis"><h3>现有能力依据</h3><ul>${c.basis.map(b=>`<li><strong>${esc(b.label)}</strong><span>${esc(b.text)}</span></li>`).join('')}</ul></section>${type?'<p class="bg-analysis-scope">以上为区域整体布局判断，当前筛选仅调整案例与数量。</p>':''}`;
 }
 function renderCounts(ps){
  const base=baseRows(),ts=agg.typeCounts(base,core.TYPES),max=Math.max(1,...ts.map(t=>t.projects));
  $('bgTypesTitle').textContent=(area?areaMap.get(area).name:'全球')+' · 供应链业务结构';
  $('bgTypes').innerHTML=ts.map(t=>`<button class="bg-type-row ${type===t.name?'active':''}" data-bg-type="${esc(t.name)}" aria-pressed="${type===t.name}" aria-label="${esc(t.name)}，${t.projects}个案例" ${!t.projects?'disabled':''} title="${t.projects}个案例 · ${t.clients}家客户 · ${t.industries}个行业"><span class="bg-type-name">${esc(t.name)}</span><span class="bg-track"><i style="width:${100*t.projects/max}%"></i></span><b>${t.projects}</b></button>`).join('');
  const st=agg.stats(base);
  $('bgCountNote').textContent=`${st.projects}个收录案例中，${st.typed}个已标注官方业务类型。一个案例可涉及多类，类型数量不可相加为项目总数。含历史案例${st.historical}项、规划／建设${st.planned}项。`;
  const industryCounts=agg.industryCounts(ps,datasets.map(d=>d.name)),imax=Math.max(1,...industryCounts.map(t=>t.projects));
  $('bgIndustryNote').textContent=type?`${type} · 涉及${agg.stats(ps).industries}个行业`:'案例分布用于识别跨行业共同需求';
  $('bgIndustries').innerHTML=industryCounts.map(t=>`<div class="bg-industry"><span>${esc(t.name)}</span><span class="bg-track"><i style="width:${100*t.projects/imax}%"></i></span><b>${t.projects}</b></div>`).join('');
  const c=area?editorial.regions[area]:editorial.global;
  $('bgReuse').innerHTML=`<h3>哪些资源值得共用</h3><p>${esc(c?.reuse||'围绕具体城市群匹配运输、库存及配送需求。')}</p>`;
 }
 function renderCapabilities(){
  $('bgCapabilities').hidden=!!area;
  if(area){$('bgCapabilities').innerHTML='';return;}
  const c=editorial.global;
  $('bgCapabilities').innerHTML=`<div class="bg-block-title"><div><h2>能力建设分析</h2><p>${esc(c.tradeoff)}</p></div></div><div class="bg-table-wrap"><table><thead><tr><th>获取方式</th><th>已有基础／适用条件</th><th>重点能力</th><th>布局取舍</th></tr></thead><tbody><tr><td><span class="bg-path">内部建设与复用</span></td><td>${esc(c.capability)}</td><td>${esc(c.gap)}</td><td>优先扩大已有节点的多客户服务，共用兼容的仓配、干线与系统。</td></tr><tr><td><span class="bg-path partner">当地伙伴合作</span></td><td>需求分散、波动较大，或当地已有成熟专业资源。</td><td>${esc(c.partner)}</td><td>以稳定业务验证资源组合，保留统一客户接口与质量管理。</td></tr><tr><td><span class="bg-path ma">并购评估</span></td><td>业务持续集中，关键能力短板长期限制进入。</td><td>${esc(c.ma)}</td><td>获取可延续客户、当地团队及能连接现有网络的运营能力。</td></tr></tbody></table></div><p class="bg-cap-footnote">${esc(editorial.rankingMethod)} 案例集中度用于识别方向，网络复用需结合城市群、货量频次与兼容作业判断。</p>`;
 }
 function projectCard(p){
  const r=p.record,c=p.client,d=p.dataset,sources=new Map(d.sources.map(s=>[s.id,s]));
  const renderText=value=>esc(value).replace(/\[(\d+)\]/g,(m,n)=>{const s=sources.get(c.sourceRefs?.[n]);return s?`<a href="${esc(core.safeUrl(s.url))}" target="_blank" rel="noopener noreferrer" title="${esc(s.label)}">[${n}]</a>`:m;}).replace(/\n/g,'<br>');
  const direct=p.records.flatMap(r=>r.actors),actors=direct.length?direct:c.actors||[],fallback=!direct.length;
  const ids=core.uniq(p.records.flatMap(r=>r.sourceIds).concat(actors.flatMap(a=>a.sourceIds||[]))),scope=p.scope==='country'?countryName(p.countryId):r.region||'全球';
  return `<article class="bg-case" data-bg-project="${esc(p.key)}"><div class="badges"><span class="badge">${esc(p.industry)}</span><span class="badge scope">${esc(scope)}</span>${p.state==='planned'?'<span class="badge status">规划／建设</span>':p.state==='case'?'<span class="badge status">历史案例</span>':''}</div><p class="bg-client-name">${esc(c.name)}</p><h3>${esc(r.title)}</h3><p>${renderText(r.detail)}</p><div class="badges">${p.types.map(t=>`<span class="badge">${esc(t)}</span>`).join('')}</div>${direct.length?`<p class="bg-actor">承接：${esc(core.uniq(direct.map(a=>a.name)).join('、'))}</p>`:''}<details><summary>承接分工与来源</summary>${fallback&&actors.length?'<p>客户承接主体汇总</p>':''}${actors.map(a=>`<p class="bg-actor"><strong>${esc(a.name)}</strong>：${renderText(a.duty||'')}</p>`).join('')}<ul>${ids.map(id=>sources.get(id)).filter(Boolean).map(s=>`<li><a href="${esc(core.safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a></li>`).join('')}</ul></details></article>`;
 }
 function renderCases(ps){
  $('bgCases').hidden=!!area;
  if(area){$('bgCases').innerHTML='';return;}
  const direct=ps.filter(p=>p.areaId),broad=ps.filter(p=>!p.areaId),context=area?model.broad.filter(p=>p.contextAreas.includes(area)&&(!type||p.types.includes(type))):[];
  const section=(label,items,open=false)=>`<details class="bg-case-group" ${open?'open':''}><summary>${esc(label)}<span>${items.length}个案例</span></summary><div class="bg-case-grid">${items.map(projectCard).join('')}</div></details>`;
  const national=direct.filter(p=>p.scope==='country').sort((a,b)=>countryName(a.countryId).localeCompare(countryName(b.countryId),'zh-CN')||a.industry.localeCompare(b.industry,'zh-CN'));
  const shared=direct.filter(p=>p.scope!=='country'),exampleGroups=[];
  if(national.length)exampleGroups.push(section('国家项目及承接关系',national,!!area));
  if(shared.length)exampleGroups.push(section('区域共用项目 · 保留原始范围',shared));
  if(broad.length)exampleGroups.push(section('跨区域及全球案例',broad));
  if(context.length)exampleGroups.push(section('相关跨区域案例 · 不计入本区热度',context));
  $('bgCases').innerHTML=`<div class="bg-block-title"><div><h2>${area?esc(areaMap.get(area).name):'全球'} · 案例依据${type?' · '+esc(type):''}</h2><p>六行业原表项目、承接关系与来源链接；同一案例仅展示一次</p></div><span>${ps.length}个案例${context.length?' · 另有跨区域参考':''}</span></div><p class="bg-scope-note">国家项目保留国家，区域共用信息保持原始范围。未标注官方类型的服务仍保留详情，不新增业务分类。</p>${exampleGroups.length?exampleGroups.join(''):'<p class="bg-empty">当前区域没有收录该业务类型的案例。可清除业务类型查看本区全部项目。</p>'}`;
 }
 function refresh(){
  if(!active)return;
  hideTip();const ps=rows(),s=agg.stats(ps);
  $('pageTitle').textContent='BG国际供应链布局总览';document.title='BG国际供应链布局总览 · 六行业';
  document.querySelector('.eyebrow').textContent='六行业需求 · 网络资源复用 · 能力布局';
  $('introText').innerHTML=window.AtlasScope.bg(window.AtlasHost.datasets());
  $('summary').innerHTML=[[s.industries,'涉及行业'],[s.clients,'涉及客户'],[s.projects,'收录案例']].map(([n,l])=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
  $('bgContext').innerHTML=(area?`<button data-bg-clear="area">${esc(areaMap.get(area).name)} ×</button>`:'<span class="context-view">全球</span>')+(type?`<button data-bg-clear="type">${esc(type)} ×</button>`:'<span class="context-view">全部17类业务</span>');
  $('bgReset').disabled=!(area||type);
  $('version').textContent=`资料：六行业最新版表格 · BG汇总 · ${editorial.version}`;
  $('footerNote').textContent='地图按收录案例数着色；类型多标签计数，区域与全球范围独立保留。';
  renderPriorities();paintMap();renderBrief(ps);renderCounts(ps);renderCapabilities();renderCases(ps);
  window.AtlasNav?.record(snapshot());
 }
 function chooseArea(id){if(!model.projects.some(p=>p.areaId===id)||!areaMap.has(id))return;area=id;drawMap();refresh();}
 function activate(){
  datasets=window.AtlasHost.datasets();model=agg.build(datasets);active=true;area='';type='';
  document.body.classList.add('bg-mode');$('industryWorkspace').hidden=true;$('bgView').hidden=false;$('notice').hidden=true;$('industryName').hidden=true;
  document.querySelectorAll('[data-industry]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
  const tab=document.querySelector('[data-bg-home]');if(tab){tab.classList.add('active');tab.setAttribute('aria-pressed','true');}
  drawMap();refresh();
 }
 function deactivate(){
  active=false;hideTip();document.body.classList.remove('bg-mode');$('industryWorkspace').hidden=false;$('bgView').hidden=true;
  document.querySelector('.eyebrow').textContent='客户产业布局 · 区域案例 · 供应链业务';$('footerNote').textContent='地图按客户数着色，数量不代表市场份额。';
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-bg-home'))activate();
  if(!active)return;
  if(b.hasAttribute('data-bg-priority'))chooseArea(b.dataset.bgPriority);
  if(b.hasAttribute('data-bg-type')){type=type===b.dataset.bgType?'':b.dataset.bgType;refresh();}
  if(b.hasAttribute('data-bg-clear')){if(b.dataset.bgClear==='area'){area='';drawMap();}else type='';refresh();}
 });
 $('bgReset').addEventListener('click',()=>{area='';type='';drawMap();refresh();});
 document.querySelector('.brand').addEventListener('click',()=>{if(active)activate();});
 function snapshot(){return {kind:'bg',area,type,label:area?areaMap.get(area).name+' · BG区域':'BG总览首页'};}
 function restore(saved){activate();area=areaMap.has(saved.area)?saved.area:'';type=core.TYPES.includes(saved.type)?saved.type:'';drawMap();refresh();}
 window.AtlasBG={activate,deactivate,snapshot,restore,get active(){return active;}};
 Object.defineProperty(window,'bgDiagnostics',{get:()=>({active,area,type,priority:area?editorial.regions[area]?.rank:null,ranking:Object.entries(editorial.regions).sort((a,b)=>a[1].rank-b[1].rank).map(([id,c])=>({id,rank:c.rank})),all:agg.stats(model.projects),visible:agg.stats(rows()),broad:agg.stats(model.broad),types:agg.typeCounts(baseRows(),core.TYPES),regions:areas.filter(a=>a.id!=='other').map(a=>({id:a.id,...agg.stats(agg.select(model,{area:a.id,type}))}))})});
 activate();
})();
