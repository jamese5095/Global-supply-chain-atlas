/* One workspace: customer, geography and official supply-chain type. */
(()=>{
 'use strict';
 const core=WorkbookAtlas,$=id=>document.getElementById(id),read=id=>JSON.parse($(id).textContent);
 const auditPolicy=read('audit-policy'),strategyContent=read('industry-strategy-content');
 const bundle=read('atlas-data'),initialDatasets=bundle.datasets||[bundle],seed=initialDatasets[0],meta=read('metadata'),areas=read('region-data'),geo=read('geo-data');
 initialDatasets.forEach(core.validate);
 const datasets=new Map(initialDatasets.map(d=>[d.id,d])),byArea=new Map(areas.map(a=>[a.id,a])),countryArea=new Map(areas.flatMap(a=>a.countries.map(id=>[id,a.id])));
 const allNames=new Intl.DisplayNames(['zh-CN'],{type:'region'}),palette=['#e7edf3','#d9ebf8','#aed3ef','#76b1dd','#3f86bc','#15588f'];
 const bin=n=>n===0?0:n===1?1:n<=3?2:n<=6?3:n<=10?4:5,uniq=core.uniq;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const status={planned:'规划／建设',case:'历史案例'};
 const defaults={view:'region',sub:'',client:'',type:'',provider:'',area:'',country:'',scope:'all',history:true,references:false,metric:'clients',broad:false,background:'production'};
 let state={...defaults},db=seed,clients,sources,countries,rows=[],areaRows=new Map(),countryRows=new Map(),broadRows=[],pending=null,pendingReview=null,importSeq=0;
 let storage,projection,path,mapCountries,nameEdited=false;
 const svg=d3.select('#map'),viewport=svg.append('g'),sphere=viewport.append('path').attr('class','sphere'),grid=viewport.append('path').attr('class','graticule'),areaLayer=viewport.append('g'),countryLayer=viewport.append('g'),backgroundLayer=viewport.append('g');
 const iso=f=>meta.numeric[String(f.id).padStart(3,'0')]||String(f.id);
 const features=topojson.feature(geo,geo.objects.countries).features.filter(f=>iso(f)!=='AQ').map((f,i)=>({...f,iso:f.id==null?'geometry-'+i:iso(f)}));
 const shapes=areas.filter(a=>a.id!=='other').map(a=>({...a,geometry:topojson.merge(geo,geo.objects.countries.geometries.filter(g=>countryArea.get(iso(g))===a.id))}));
 const zoom=d3.zoom().scaleExtent([1,10]).extent([[0,0],[1000,540]]).translateExtent([[-100,-100],[1100,640]]).filter(e=>e.type!=='wheel'||e.ctrlKey||e.metaKey).on('zoom',e=>{viewport.attr('transform',e.transform);$('tooltip').hidden=true;});
 svg.call(zoom).on('dblclick.zoom',null);
 function nameCountry(id,fallback=''){
  const known=countries?.get(id)?.name||meta.countries.find(c=>c.id===id)?.name;
  if(known)return known;
  if(/^[A-Z]{2}$/.test(String(id))){try{return allNames.of(id)||fallback||id;}catch{}}
  return fallback||features.find(f=>f.iso===id)?.properties?.name||String(id??'');
 }
 const showNotice=s=>{$('notice').hidden=!s;$('notice').textContent=s;};
 function text(s,c){return esc(s).replace(/\[(\d+)\]/g,(m,n)=>{const src=sources.get(c?.sourceRefs?.[n]);return src?`<a href="${esc(core.safeUrl(src.url))}" target="_blank" rel="noopener noreferrer" title="${esc(src.label)}">[${n}]</a>`:m;}).replace(/\n/g,'<br>');}
 function sourceList(ids){return `<ul class="source-list">${uniq(ids).map(id=>{const s=sources.get(id);return s?`<li><a href="${esc(core.safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a></li>`:'';}).join('')}</ul>`;}
 function useDataset(id){
  window.AtlasBG?.deactivate();
  db=datasets.get(id);clients=new Map(db.clients.map(c=>[c.id,c]));sources=new Map(db.sources.map(s=>[s.id,s]));countries=new Map(db.countries.map(c=>[c.id,c]));
  state={...defaults};$('navSearch').value='';
  $('industry').innerHTML=[...datasets.values()].map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');$('industry').value=id;$('industryWrap').hidden=true;$('industryName').hidden=datasets.size>1;$('industryName').textContent=db.name;
  $('industryTabs').innerHTML='<button class="industry-tab" data-bg-home aria-pressed="false">BG 总览</button>'+[...datasets.values()].map(d=>`<button class="industry-tab ${d.id===id?'active':''}" data-industry="${esc(d.id)}" aria-pressed="${d.id===id}">${esc(d.name)}</button>`).join('');
  $('pageTitle').textContent=db.name+'头部企业国际供应链布局';document.title=db.name+'头部企业国际供应链布局';
  $('typeFilter').innerHTML='<option value="">全部业务类型</option>'+core.TYPE_GROUPS.map(g=>`<optgroup label="${esc(g.name)}">${g.types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</optgroup>`).join('');
  $('version').textContent=`资料：${db.version} · ${db.workbook}`;drawGeography();refresh();
 }
 function filtered(omit=[]){return core.filter(db,state,omit);}
 function scoped(rs,includeContext=false){
  if(!state.area)return rs;
  return rs.filter(r=>r.areaId===state.area||(includeContext&&r.scope!=='country'&&r.contextAreas.includes(state.area)));
 }
 function aggregate(){
  rows=filtered();areaRows=new Map();countryRows=new Map();broadRows=[];
  for(const r of rows){
   if(r.scope==='country'){if(!countryRows.has(r.countryId))countryRows.set(r.countryId,[]);countryRows.get(r.countryId).push(r);}
   if(r.areaId){if(!areaRows.has(r.areaId))areaRows.set(r.areaId,[]);areaRows.get(r.areaId).push(r);}else broadRows.push(r);
  }
  if(state.country&&!countryRows.has(state.country))state.country='';
 }
 function refresh(){
  hideTip();aggregate();$('typeFilter').value=state.type;
  const st=core.stats(state.country?scoped(rows,true).filter(r=>r.scope!=='country'||r.countryId===state.country):scoped(rows)),c=clients.get(state.client);
  $('summary').innerHTML=[[st.clients,'涉及客户'],[st.projects,'收录案例']].map(([n,label])=>`<div class="stat"><b>${n}</b><span>${label}</span></div>`).join('');
  $('introText').innerHTML=window.AtlasScope.industry(db);
  $('context').innerHTML=[['client',c?.name||state.sub],['type',state.type],['area',byArea.get(state.area)?.name],['country',state.country?nameCountry(state.country):'']].filter(([,v])=>v).map(([k,v])=>`<button data-clear="${k}" title="取消筛选">${esc(v)} ×</button>`).join('')||'<span class="context-view">全部客户 · 全球 · 全部业务</span>';
  renderNavigation();renderProfile();paintMap();renderPanel();renderStrategy();renderProviders();rememberView();
 }
 function renderStrategy(){
  const host=$('industryStrategy'),home=!!strategyContent.industries[db.name]&&!state.area&&!state.country&&!state.client&&!state.sub&&!state.type&&!window.AtlasBG?.active;
  host.hidden=!home;$('industryWorkspace').classList.toggle('industry-home',home);
  if(home)IndustryStrategy.render(host,db,strategyContent,BGAtlas);
 }
 function renderProviders(){
  const host=$('industryProviders'),compact=!!strategyContent.industries[db.name];
  if(compact)$('industryStrategy').before(host);else $('bgView').before(host);
  host.classList.toggle('provider-compact',compact);host.hidden=!!(state.area||state.country||state.client||state.sub||window.AtlasBG?.active);window.ProviderCharts.hide();
  if(!host.hidden)window.ProviderCharts.render(host,{projects:BGAtlas.build([db]).projects,type:state.type,limit:5,title:db.name+' · 全球外部承接商TOP5'});
 }
 function viewSnapshot(){return {kind:'industry',dataset:db.id,state:{...state},search:$('navSearch').value,label:db.name+' · '+(clients.get(state.client)?.name||byArea.get(state.area)?.name||'全球')};}
 function rememberView(replace=false){if(!window.AtlasBG?.active)window.AtlasNav?.record(viewSnapshot(),{replace});}
 function restoreView(saved){useDataset(datasets.has(saved.dataset)?saved.dataset:seed.id);state={...defaults,...saved.state};if(state.client&&!clients.has(state.client)){state.client='';state.sub='';state.view='region';}$('navSearch').value=saved.search||'';drawGeography();refresh();}
 function renderNavigation(){
  const q=$('navSearch').value.trim().toLowerCase();
  $('reset').disabled=!(state.sub||state.client||state.type||state.area||state.country||q);
  $('navCount').textContent=db.clients.length+'家';
  $('navigation').innerHTML=`<button class="nav-all ${!state.client&&!state.sub?'active':''}" data-all-clients>${esc(db.name)}头部企业</button>`+db.subindustries.map((sub,i)=>{
   const cs=db.clients.filter(c=>c.subindustry===sub&&(!q||(c.name+' '+sub).toLowerCase().includes(q)));if(!cs.length)return '';
   const open=q||state.sub===sub||cSub()===sub||(!state.sub&&!state.client&&i===0);
   return `<details class="nav-group" ${open?'open':''}><summary><span>${esc(sub)} <small>${cs.length}</small></span></summary><button class="nav-client ${state.sub===sub&&!state.client?'active':''}" data-sub="${esc(sub)}">子行业TOP5客户</button>${cs.map(c=>`<button class="nav-client ${state.client===c.id?'active':''}" data-client="${esc(c.id)}"><span>${esc(c.name)}</span></button>`).join('')}</details>`;
  }).join('');
 }
 function cSub(){return clients.get(state.client)?.subindustry||'';}
 function renderProfile(){
  const c=clients.get(state.client);$('clientProfile').hidden=!c;
  if(c)$('clientProfile').innerHTML=`<h2>${esc(c.name)}</h2><p class="client-sector">${esc(c.subindustry)} · 全球产业布局</p><div class="profile-sections">${c.sections.map(s=>`<section class="profile-section"><h3>${esc(s.label)}</h3><p>${text(s.text,c)}</p></section>`).join('')}</div><details class="client-source"><summary>承接主体与信息来源</summary>${c.actors.map(p=>`<p class="carrier-line"><strong>${esc(p.name)}</strong> <span class="subtle">${esc(p.role)}</span><br>${text(p.duty,c)}</p>`).join('')}${sourceList(c.sourceIds)}</details>`;
 }

 function drawGeography(){
  const a=byArea.get(state.area);
  if(a){let [west,south,east,north]=a.bounds;projection=d3.geoMercator().rotate([-a.center,0]).fitExtent([[30,25],[970,510]],{type:'MultiPoint',coordinates:[[west,south],[east,north]]}).clipExtent([[8,8],[992,532]]);}else projection=d3.geoNaturalEarth1().fitExtent([[18,34],[982,505]],{type:'FeatureCollection',features});
  path=d3.geoPath(projection);sphere.style('display',a?'none':null).attr('d',a?null:path({type:'Sphere'}));grid.attr('d',null);
  areaLayer.style('display',a?'none':null);countryLayer.style('display',a?null:'none');
  areaLayer.selectAll('path').data(shapes,a=>a.id).join('path').attr('class','area-shape').attr('data-area',a=>a.id).attr('d',a=>path(a.geometry)).on('click',(e,a)=>{if(!e.defaultPrevented&&areaRows.has(a.id))chooseArea(a.id);}).on('pointermove',(e,a)=>showTip(e,a.name,areaRows.get(a.id)||[])).on('pointerleave',hideTip).on('keydown',(e,a)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(areaRows.has(a.id))chooseArea(a.id);}});
  mapCountries=countryLayer.selectAll('path.country').data(features,f=>f.iso).join('path').attr('class','country').attr('data-country',f=>f.iso).attr('d',f=>a&&countryArea.get(f.iso)===a.id?path(f):null).style('display',f=>a&&countryArea.get(f.iso)===a.id?null:'none').on('click',(e,f)=>{if(!e.defaultPrevented&&countryRows.has(f.iso))chooseCountry(f.iso);}).on('pointermove',(e,f)=>showTip(e,nameCountry(f.iso),countryRows.get(f.iso)||[])).on('pointerleave',hideTip).on('keydown',(e,f)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(countryRows.has(f.iso))chooseCountry(f.iso);}});
  svg.call(zoom.transform,d3.zoomIdentity);$('backWorld').hidden=!a;
 }
 function paintMap(){
  const a=byArea.get(state.area),value=rs=>core.stats(rs||[])[state.metric];
  areaLayer.selectAll('path').attr('fill',a=>palette[bin(value(areaRows.get(a.id)))]).classed('has-data',a=>areaRows.has(a.id)).attr('role',a=>areaRows.has(a.id)?'button':null).attr('tabindex',a=>areaRows.has(a.id)?0:null).attr('aria-label',a=>`${a.name}，${value(areaRows.get(a.id))}${state.metric==='clients'?'家客户':'个项目'}`);
  mapCountries.attr('fill',f=>countryRows.has(f.iso)&&state.country===f.iso?'#0d3e68':palette[bin(value(countryRows.get(f.iso)))]).classed('selected',f=>countryRows.has(f.iso)&&state.country===f.iso).classed('has-data',f=>countryRows.has(f.iso)).attr('role',f=>countryRows.has(f.iso)?'button':null).attr('tabindex',f=>countryRows.has(f.iso)?0:null).attr('aria-label',f=>`${nameCountry(f.iso)}，${value(countryRows.get(f.iso))}${state.metric==='clients'?'家客户':'个项目'}`).attr('aria-pressed',f=>String(countryRows.has(f.iso)&&state.country===f.iso));
  $('mapTitle').textContent=a?a.name+'区域':state.client?clients.get(state.client).name+' · 全球区域':'全球区域总览';$('countryPill').hidden=!state.country;$('countryPill').textContent=state.country?'已选：'+nameCountry(state.country):'';
  $('legend').innerHTML=['当前无资料','1','2–3','4–6','7–10','11+'].map((s,i)=>`<span><i class="swatch" style="background:${palette[i]}"></i>${s}</span>`).join('');
  $('mapCaption').textContent=a?'右侧展示本区案例；灰色国家暂无案例，点有资料的国家可进一步筛选。':'色深表示涉及客户数；鼠标悬停区域查看概况，点击查看各国案例。';
  
  backgroundLayer.selectAll('*').remove();backgroundLayer.raise();
  const c=clients.get(state.client),fp=c?.footprint?.[state.background];
  if(state.view==='client'&&fp&&state.background!=='off'){
   const pts=[];
   for(const id of fp.countryIds){if(!state.references&&meta.countries.find(x=>x.id===id)?.reference)continue;if(a&&countryArea.get(id)!==a.id)continue;const f=features.find(x=>x.iso===id);if(!f)continue;const [x,y]=path.centroid(f);if(Number.isFinite(x)&&x>10&&x<990&&y>12&&y<525)pts.push({x,y,name:nameCountry(id),areaId:countryArea.get(id)});}
   for(const id of fp.areaIds){if(a&&a.id!==id)continue;if(pts.some(p=>p.areaId===id))continue;const ar=byArea.get(id);if(ar){const [x,y]=projection(ar.anchor);if(x>10&&x<990&&y>12&&y<525)pts.push({x,y,name:ar.name,areaId:id});}}
   backgroundLayer.selectAll('circle').data(pts).join('circle').attr('class','background-dot').attr('cx',p=>p.x).attr('cy',p=>p.y).attr('r',5).attr('aria-label',p=>`${p.name}，${fp.label}背景`).on('pointermove',(e,p)=>{const tip=$('tooltip');tip.innerHTML=`<strong>${esc(p.name)}</strong>${esc(fp.label)}背景<small>国家或区域级示意，不计入项目热度</small>`;tip.hidden=false;const r=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(e.clientX+12,innerWidth-r.width-10))+'px';tip.style.top=Math.max(8,Math.min(e.clientY+12,innerHeight-r.height-10))+'px';}).on('pointerleave',hideTip).on('click',(e,p)=>{e.stopPropagation();if(p.areaId)chooseArea(p.areaId);});
   backgroundLayer.selectAll('circle').attr('role','button').attr('tabindex',0).on('keydown',(e,p)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(p.areaId)chooseArea(p.areaId);}});
   $('mapCaption').textContent+=' 蓝点为'+fp.label+'背景，不计入项目数量。';
  }
 }
 function hideTip(){$('tooltip').hidden=true;}
 function showTip(e,name,rs){
  if(e.pointerType==='touch'||!rs.length){hideTip();return;}
  const s=core.stats(rs),tip=$('tooltip'),types=core.TYPES.filter(t=>rs.some(r=>r.types.includes(t))).slice(0,3);
  tip.innerHTML=`<strong>${esc(name)}</strong>${s.clients}家客户 · ${s.projects}个案例${types.length?`<small>主要业务：${types.map(esc).join('、')}</small>`:''}<small>点击查看各国案例及承接关系</small>`;tip.hidden=false;
  const r=tip.getBoundingClientRect(),anchor=e.currentTarget?.getBoundingClientRect(),x=Number.isFinite(e.clientX)?e.clientX:(anchor?anchor.left+anchor.width/2:innerWidth/2),y=Number.isFinite(e.clientY)?e.clientY:(anchor?anchor.top+anchor.height/2:innerHeight/2);
  tip.style.left=Math.max(8,Math.min(x+13,innerWidth-r.width-10))+'px';tip.style.top=Math.max(8,Math.min(y+13,innerHeight-r.height-10))+'px';
 }
 function chooseArea(id){if(!byArea.has(id))return;state.area=id;state.country='';state.broad=false;hideTip();drawGeography();refresh();}
 function chooseCountry(id){if(countryArea.get(id)!==state.area||!countryRows.has(id))return;state.country=id;state.broad=false;hideTip();refresh();}
 function world(){state.area='';state.country='';state.broad=false;drawGeography();refresh();}
 function chooseClient(id){const c=clients.get(id);if(!c)return;state.client=id;state.sub=c.subindustry;state.view='client';refresh();}
 function card(r,peers=[]){
  const c=clients.get(r.clientId),scope=r.scope==='country'?nameCountry(r.countryId):r.region,ids=r.sourceIds.length?r.sourceIds:c.sourceIds,fallback=r.actors.length?[]:c.actors;
  return `<article class="project-card" data-project="${esc(r.id)}"><button class="client-link" data-client="${esc(c.id)}">${esc(c.name)} · ${esc(c.subindustry)}</button>${peers.length?`<p class="subtle">同项目关联客户：${peers.map(x=>`<button class="client-link" data-client="${esc(x.clientId)}">${esc(clients.get(x.clientId).name)}</button>`).join('、')}</p>`:''}<h3>${esc(r.title)}</h3><div class="badges"><span class="badge scope">${esc(scope)}</span>${r.types.map(t=>`<button class="badge text-btn" data-type="${esc(t)}">${esc(t)}</button>`).join('')}${r.attribute==='manufacturing'?'<span class="badge">制造与供货配套</span>':''}${status[r.state]?`<span class="badge status">${status[r.state]}</span>`:''}</div><p class="project-detail">${text(r.detail,c)}</p>${r.actors.length?`<p class="operator-line">承接：${r.actors.map(p=>esc(p.name)).join('、')}</p>`:''}<details><summary>服务分工与来源</summary><div>${r.actors.map(p=>`<p class="carrier-line"><strong>${esc(p.name)}</strong> <span class="subtle">${esc(p.role)}</span><br>${text(p.duty,c)}</p>`).join('')}${fallback.length?`<p class="subtle">客户承接主体汇总</p>${fallback.map(p=>`<p class="carrier-line"><strong>${esc(p.name)}</strong> <span class="subtle">${esc(p.role)}</span><br>${text(p.duty,c)}</p>`).join('')}${sourceList(fallback.flatMap(p=>p.sourceIds))}`:''}<p class="subtle">${r.sourceIds.length?'项目来源':'客户资料来源'}</p>${sourceList(ids)}</div></details></article>`;
 }
 function cards(rs){const gs=new Map();for(const r of rs){const id=r.engagementId||r.id;if(!gs.has(id))gs.set(id,[]);gs.get(id).push(r);}return [...gs.values()].map(g=>{const r=g.find(x=>x.clientId===state.client)||g[0];return card(r,g.filter(x=>x!==r));}).join('');}
 function scopeSection(title,rs,open=false){return rs.length?`<details class="scope-section" ${open?'open':''}><summary>${esc(title)} · ${core.stats(rs).projects}项</summary>${cards(rs)}</details>`:'';}
 function structure(rs){const cs=uniq(rs.map(r=>clients.get(r.clientId).subindustry));const types=core.TYPES.map(t=>({name:t,n:core.stats(rs.filter(r=>r.types.includes(t))).clients})).filter(x=>x.n).sort((a,b)=>b.n-a.n).slice(0,3);return rs.length?`<p class="case-overview">覆盖${cs.length}个子行业${types.length?'，主要业务为'+types.map(x=>esc(x.name)).join('、'):''}。</p>`:'';}

 function renderPanel(){
  const area=byArea.get(state.area);
  const local=state.country?(countryRows.get(state.country)||[]):state.area?(areaRows.get(state.area)||[]).filter(r=>r.scope==='country'):rows.filter(r=>r.scope==='country');
  const direct=state.country||state.area?rows.filter(r=>r.scope!=='country'&&r.areaId===state.area):rows.filter(r=>r.scope!=='country');
  const context=state.area?rows.filter(r=>r.scope!=='country'&&r.areaId!==state.area&&r.contextAreas.includes(state.area)):[];
  const factual=local.filter(r=>r.attribute==='logistics'),manufacturing=local.filter(r=>r.attribute==='manufacturing');
  const title=state.country?nameCountry(state.country)+'客户案例':area?area.name+'客户案例':'全球客户案例';
  const count=core.stats(local.concat(direct,context));
  let body=structure(factual)+(state.country?caseGroups(factual):countryCaseGroups(factual));
  if(direct.length)body+=`<section class="shared-cases"><h3>${area?'本区共用案例':'跨区域及全球案例'}</h3>${caseGroups(direct)}</section>`;
  if(context.length)body+=`<section class="shared-cases"><h3>相关跨区域案例</h3>${caseGroups(context)}</section>`;
  if(manufacturing.length)body+=`<details class="manufacturing-cases" open><summary>制造与供货配套 · ${core.stats(manufacturing).projects}项</summary>${state.country?caseGroups(manufacturing):countryCaseGroups(manufacturing)}</details>`;
  if(!local.length&&!direct.length&&!context.length)body=`<p class="empty">当前条件下没有收录供应链案例。${state.type?'<button class="text-btn" data-clear="type">查看全部业务类型</button>':state.area?'<button class="text-btn" data-world>查看全球案例</button>':''}</p>`+body;
  $('panel').innerHTML=`<div class="panel-head"><h2>${esc(title)}</h2><p>${count.clients}家相关客户 · ${count.projects}个收录案例</p>${state.country?'<button class="text-btn" data-clear="country">查看本区全部案例</button>':''}</div><div class="panel-content">${body}</div>`;
 }
 function caseGroups(rs){
  const projects=new Map();for(const r of rs){const id=r.engagementId||r.id;if(!projects.has(id))projects.set(id,[]);projects.get(id).push(r);}
  const groups=new Map();for(const items of projects.values()){const r=items.find(x=>x.clientId===state.client)||items[0];if(!groups.has(r.clientId))groups.set(r.clientId,[]);groups.get(r.clientId).push(...items);}
  return [...groups].map(([id,items])=>`<section class="case-client"><div class="case-client-heading"><button class="client-link" data-client="${esc(id)}">${esc(clients.get(id).name)}</button><small>${esc(clients.get(id).subindustry)}</small></div>${cards(items)}</section>`).join('');
 }
 function countryCaseGroups(rs){
  const groups=new Map();for(const r of rs){if(!groups.has(r.countryId))groups.set(r.countryId,[]);groups.get(r.countryId).push(r);}
  return [...groups].sort((a,b)=>nameCountry(a[0]).localeCompare(nameCountry(b[0]),'zh-CN')).map(([id,items])=>`<section class="country-cases" data-case-country="${esc(id)}"><h3 class="country-case-heading">${state.area?`<button class="text-btn" data-country="${esc(id)}">${esc(nameCountry(id))}</button>`:esc(nameCountry(id))}<small>${core.stats(items).clients}家客户 · ${core.stats(items).projects}个案例</small></h3>${caseGroups(items)}</section>`).join('');
 }



 function clear(key){if(key==='client'){state.client='';state.sub='';state.view='region';}else state[key]='';if(key==='area')state.country='';if(key==='area')drawGeography();refresh();}
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-industry')){if(datasets.has(b.dataset.industry))useDataset(b.dataset.industry);return;}
  if(b.hasAttribute('data-close')){$(b.dataset.close).close();return;}
  if(b.hasAttribute('data-client')){chooseClient(b.dataset.client);return;}
  if(b.hasAttribute('data-sub')){state.sub=b.dataset.sub;state.client='';state.provider='';refresh();return;}
  if(b.hasAttribute('data-all-clients')){state.sub='';state.client='';state.provider='';refresh();return;}
  if(b.hasAttribute('data-clear')){clear(b.dataset.clear);return;}
  if(b.hasAttribute('data-type')){state.type=b.dataset.type;refresh();return;}
  if(b.hasAttribute('data-world')){world();return;}
  if(b.hasAttribute('data-strategy-country')){const id=b.dataset.strategyCountry,a=b.dataset.area;if(countryArea.get(id)===a&&byArea.has(a)){state.area=a;state.country=id;state.broad=false;hideTip();drawGeography();refresh();}return;}
  if(b.hasAttribute('data-area')){chooseArea(b.dataset.area);return;}
  if(b.hasAttribute('data-country')){chooseCountry(b.dataset.country);return;}
 });
 $('industry').addEventListener('change',e=>useDataset(e.target.value));$('navSearch').addEventListener('input',()=>{renderNavigation();rememberView(true);});$('typeFilter').addEventListener('change',e=>{state.type=e.target.value;refresh();});
 $('reset').addEventListener('click',()=>{state={...defaults};$('navSearch').value='';drawGeography();refresh();});$('backWorld').addEventListener('click',world);
 $('methodBtn').addEventListener('click',()=>{$('dataDialog').close();$('methodDialog').showModal();});
 document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();state={...defaults};$('navSearch').value='';drawGeography();refresh();});
 function openStorage(){return new Promise((resolve,reject)=>{if(!window.indexedDB){reject(Error('当前浏览器不支持本地保存'));return;}const request=indexedDB.open('sf-supplychain-atlas-six-industries-v1',1);request.onupgradeneeded=()=>{const d=request.result;if(!d.objectStoreNames.contains('industries'))d.createObjectStore('industries',{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
 function saveDatasets(ds){return new Promise((resolve,reject)=>{if(!storage){reject(Error('当前环境无法持久保存，请使用资料备份保留更新'));return;}const tx=storage.transaction('industries','readwrite');for(const d of ds)tx.objectStore('industries').put(d);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('保存被中断'));});}
 function storageData(){return new Promise((resolve,reject)=>{const tx=storage.transaction('industries','readonly'),r=tx.objectStore('industries').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 $('importBtn').addEventListener('click',()=>{$('dataDialog').close();pending=null;nameEdited=false;importSeq++;$('importFile').value='';$('importPreview').hidden=true;$('applyImport').disabled=true;$('applyImport').textContent=storage?'保存行业更新':'载入本次页面';$('importMessage').textContent='';$('importName').value=db.name;$('importDialog').showModal();});
 $('importName').addEventListener('input',()=>{nameEdited=true;pending=null;importSeq++;$('applyImport').disabled=true;$('importMessage').textContent=$('importFile').files.length?'行业名称已修改，请重新选择表格以生成预览。':'';});
 $('importFile').addEventListener('change',async e=>{
  const file=e.target.files[0],sequence=++importSeq;pending=null;$('applyImport').disabled=true;$('importPreview').hidden=true;if(!file)return;
  try{if(file.size>15*1024*1024)throw Error('文件超过15MB。');if(!/\.xlsx$/i.test(file.name))throw Error('请选择XLSX格式的最新版表格。');const guessed=file.name.match(/国际业务热力图[_－\-]?([^_.（(]+?)(?:_.*)?\.xlsx$/i)?.[1];if(guessed&&!nameEdited)$('importName').value=guessed;const name=$('importName').value.trim();if(!name)throw Error('请填写行业名称。');$('importMessage').textContent='正在读取表格…';
   const buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array',cellHTML:false,cellStyles:false});const d=SourceAudit.upgrade(core.parseWorkbook(wb,{XLSX,areas,numeric:meta.numeric,baseCountries:meta.countries,name,filename:file.name}),initialDatasets);if(sequence!==importSeq)return;const review=ImportReview.review(datasets.get(d.id),d,auditPolicy);pendingReview=review;pending=review.canApply?d:null;
   $('importPreview').innerHTML=`<strong>${esc(d.name)}</strong><br>${d.report.customers}家客户 · ${d.records.length}个项目及配套条目<br>${d.report.regional}个区域项目 · ${d.sources.length}条来源链接<br>${datasets.has(d.id)?'保存后替换该行业现有资料，其他行业保留。':'保存后增加该行业，现有行业保留。'}${d.report.untyped?`<p class="subtle">${d.report.untyped}个服务项目没有官方类型标签，将保留在项目视图中。</p>`:''}${d.report.warnings.length?`<p class="warn">${d.report.warnings.map(esc).join('<br>')}</p>`:''}`;const deltaText=Object.entries(review.delta).map(([k,v])=>({clients:'客户',records:'记录',sources:'来源'}[k])+'：新增'+v.added.length+'，删除'+v.removed.length+'，修改'+v.changed.length).join('；');$('importPreview').innerHTML+=`<p class="subtle">${esc(deltaText)}</p>${review.exchange?`<p class="subtle">${review.exchange.unchanged?'统一数据版内容一致，项目、地域范围和历史状态完整保留。':'已重新解析'+review.exchange.visibleEdits.length+'处可见修改，保留未修改内容。'}</p>`:''}${review.conflicts.length?`<p class="warn">发现${review.conflicts.length}项已清理内容回流，暂不覆盖资料。请保留当前文件修改，以统一数据版合并。</p><ul>${review.conflicts.map(x=>`<li>${esc(x.label)}：${esc(x.reason)}</li>`).join('')}</ul>`:''}`;$('importPreview').hidden=false;$('importMessage').textContent=review.canApply?'读取完成，请核对变更后保存。':'存在来源或项目冲突，原数据保持完整。';$('applyImport').disabled=!review.canApply;
  }catch(err){if(sequence===importSeq){$('importMessage').textContent='读取未完成：'+err.message;}}
 });
 $('applyImport').addEventListener('click',async()=>{if(!pending||!pendingReview?.canApply)return;const d=pending;$('applyImport').disabled=true;try{if(storage)await saveDatasets([d]);datasets.set(d.id,d);pending=null;$('importDialog').close();useDataset(d.id);showNotice(storage?d.name+'资料已更新并保存在当前浏览器。':d.name+'资料已载入本次页面；当前环境无法持久保存，请在资料管理中备份更新。');}catch(err){$('importMessage').textContent='保存未完成：'+err.message;$('applyImport').disabled=false;}});
 $('dataBtn').addEventListener('click',()=>{$('dataInfo').innerHTML=[...datasets.values()].map(d=>`<div class="data-version"><strong>${esc(d.name)}</strong><small>${esc(d.version)} · ${d.clients.length}家客户 · ${d.records.length}个项目及配套条目<br>${esc(d.workbook)}</small></div>`).join('');$('storageInfo').textContent=storage?'本机持久保存可用。':'当前环境无法持久保存，内置资料可正常浏览。';$('dataDialog').showModal();});
 $('exportData').addEventListener('click',()=>{const data={schemaVersion:'2.0',datasets:[...datasets.values()]},url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='国际供应链看板_资料备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 $('restoreFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>25*1024*1024)throw Error('备份文件超过25MB。');const data=JSON.parse(await f.text()),ds=(data.datasets||[data]).map(d=>SourceAudit.upgrade(d,initialDatasets));if(!ds.length||ds.length>30)throw Error('备份行业数量无效。');ds.forEach(core.validate);const conflicts=ds.flatMap(d=>ImportReview.review(datasets.get(d.id),d,auditPolicy).conflicts);if(conflicts.length)throw Error('备份含'+conflicts.length+'项已清理内容，请保留用户修改并使用统一数据版合并。');if(new Set(ds.map(d=>d.id)).size!==ds.length)throw Error('备份包含重复行业。');if(storage)await saveDatasets(ds);ds.forEach(d=>datasets.set(d.id,d));$('dataDialog').close();useDataset(ds[0].id);showNotice(storage?'已载入并保存资料备份。':'已载入本次页面；当前环境无法持久保存，请保留原备份文件。');}catch(err){$('storageInfo').textContent='载入未完成：'+err.message;}finally{e.target.value='';}});
 window.AtlasHost={datasets:()=>[...datasets.values()],snapshot:viewSnapshot,restore:restoreView};
 useDataset(seed.id);
 openStorage().then(async d=>{storage=d;const saved=await storageData();const migrations=[];for(const s of saved){try{core.validate(s);const next=SourceAudit.upgrade(s,initialDatasets);datasets.set(next.id,next);if(next!==s)migrations.push(next);}catch{}}if(migrations.length)await saveDatasets(migrations);if(saved.length){const applySaved=()=>{const bgSaved=window.AtlasBG?.active?window.AtlasBG.snapshot():null,industrySaved=viewSnapshot();if(bgSaved){useDataset(datasets.has(db.id)?db.id:seed.id);window.AtlasBG.restore(bgSaved);}else restoreView(industrySaved);};if(window.AtlasNav)window.AtlasNav.silent(applySaved);else applySaved();}}).catch(()=>{});
 Object.defineProperty(window,'atlasDiagnostics',{get:()=>({state:{...state},industry:db.name,customers:db.clients.length,projects:db.records.length,sources:db.sources.length,visible:core.stats(rows),areas:[...areaRows].map(([id,rs])=>({id,...core.stats(rs)})),broad:core.stats(broadRows),classification:core.TYPES,storage:!!storage})});
})();
