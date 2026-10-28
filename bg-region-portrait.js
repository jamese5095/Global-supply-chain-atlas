/* BG country portraits follow the same project scope and counts as the regional map. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BGRegionPortrait=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const unique=xs=>[...new Set(xs)];
 function build(projects,area,datasets,{agg,types,countryName,limit=5}){
  const ps=projects.filter(p=>p.areaId===area.id),names=datasets.map(d=>d.name);
  const services=rs=>agg.typeCounts(rs,types).filter(t=>t.projects);
  const industries=rs=>agg.industryCounts(rs,names).filter(i=>i.projects).sort((a,b)=>b.projects-a.projects||names.indexOf(a.name)-names.indexOf(b.name)).map(i=>({...i,services:services(rs.filter(p=>p.industry===i.name))}));
  const local=ps.filter(p=>p.scope==='country'),shared=ps.filter(p=>p.scope!=='country');
  const countries=unique(local.map(p=>p.countryId)).map(id=>{
   const records=local.filter(p=>p.countryId===id);
   return {id,name:countryName(id),projects:records,stats:agg.stats(records),industries:industries(records),services:services(records)};
  }).sort((a,b)=>b.stats.projects-a.stats.projects||b.stats.industries-a.stats.industries||a.name.localeCompare(b.name,'zh-CN'));
  const mainIndustries=industries(ps),mainServices=services(ps),topCountries=countries.slice(0,limit);
  const summary=ps.length?`本区收录案例主要涉及${mainIndustries.slice(0,3).map(i=>i.name).join('、')}${mainServices.length?`，主要业务为${mainServices.slice(0,2).map(t=>t.name).join('、')}`:''}。`:'当前筛选下，本区暂无供应链案例。';
  return {area,stats:agg.stats(ps),countries,topCountries,otherCountries:countries.slice(limit),industries:mainIndustries,services:mainServices,summary,shared:{projects:shared,stats:agg.stats(shared),industries:industries(shared),services:services(shared)}};
 }
 function render(m,content={}){
  const row=i=>`<div class="bg-country-industry"><span><strong>${esc(i.name)}</strong><small>${i.projects}例</small></span><div>${i.services.length?i.services.slice(0,2).map(t=>`<span class="bg-country-service">${esc(t.name)}</span>`).join(''):'<span class="bg-country-untyped" aria-label="业务类型以行业项目资料为准">—</span>'}</div></div>`;
  const country=c=>`<article class="bg-country-portrait" data-bg-portrait-country="${esc(c.id)}" tabindex="0" aria-label="${esc(c.name)}，${c.stats.projects}个案例，${c.stats.industries}个行业"><header><h3>${esc(c.name)}</h3><span><b>${c.stats.projects}</b>个案例</span></header><div class="bg-country-table"><div class="bg-country-table-label"><span>重点行业</span><span>对应主要业务</span></div>${c.industries.slice(0,3).map(row).join('')}</div>${c.industries.length>3?`<p class="bg-country-more-industries">其余：${c.industries.slice(3).map(i=>`${esc(i.name)} ${i.projects}例`).join(' · ')}</p>`:''}</article>`;
  return `<header class="bg-portrait-header"><p>六行业 · 区域需求分布</p><h2>${esc(m.area.name)}业务画像</h2><span>${m.stats.projects}个案例 · ${m.stats.industries}个行业 · ${m.countries.length}个国家</span></header><div class="bg-portrait-body"><p class="bg-portrait-summary">${esc(m.summary)}</p>${content.focusItems?.length?`<section class="bg-portrait-focus" aria-label="${esc(content.focusTitle)}"><h3>${esc(content.focusTitle)}</h3><ul>${content.focusItems.map(item=>`<li><strong>${esc(item.title)}</strong><p>${esc(item.text)}</p></li>`).join('')}</ul><button type="button" class="bg-portrait-planning-link" data-bg-scroll-planning>查看完整方向 →</button>${content.filtered?'<p class="bg-portrait-focus-scope">以上为区域整体能力建设方向，不随单项业务筛选调整。</p>':''}</section>`:''}${m.topCountries.length?`<section aria-label="重点国家与业务"><h3 class="bg-portrait-section-heading">重点国家与业务</h3><div class="bg-country-portrait-list">${m.topCountries.map(country).join('')}</div></section>`:''}<p class="bg-portrait-footnote">国家按收录案例数排列，行业与业务对应同一国家项目。${m.shared.stats.projects?`含${m.shared.stats.projects}个区域共用案例，保留原范围。`:""}案例量反映资料覆盖，不代表市场规模。</p></div>`;
 }
 return {build,render};
});
