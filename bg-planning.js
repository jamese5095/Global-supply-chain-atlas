/* Regional BG construction derives from the current industry capability plans. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BGPlanning=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const uniq=xs=>[...new Set(xs)];
 function compile(plan,industryContent,datasets,areas,{strict=false}={}){
  const issues=[],catalog=new Map(),areaMap=new Map(areas.map(a=>[a.id,a])),countryArea=new Map(areas.flatMap(a=>a.countries.map(id=>[id,a.id]))),names=new Intl.DisplayNames(['zh-CN'],{type:'region'});
  const problem=text=>{issues.push(text);if(strict)throw Error(text);};
  for(const d of datasets){
   for(const cap of industryContent.industries[d.name]?.capabilityPlan?.items||[]){
    if(catalog.has(cap.id)){problem('Duplicate capability '+cap.id);continue;}
    const countries=new Map((cap.countryGroups||[]).flatMap(g=>g.countries.map(c=>[c.id,{...c}])));
    for(const basis of (plan.basisCountries||[]).filter(b=>b.sourceId===cap.id)){
     if(!basis.sourceCells.every(c=>cap.basis.sourceCells.includes(c))){problem('Unbound basis cells '+cap.id);continue;}
     for(const id of basis.countryIds){if(!countryArea.has(id)){problem('Unknown basis country '+id);continue;}countries.set(id,{id,name:names.of(id),area:countryArea.get(id),basis:true});}
    }
    catalog.set(cap.id,{id:cap.id,title:cap.title,label:plan.sourceLabels[cap.id]||cap.title,industry:d.name,datasetId:d.id,capability:cap,countries:[...countries.values()],broadAreas:uniq((cap.opportunities||[]).flatMap(o=>o.areaIds||[])),global:(cap.scopeTags||[]).some(s=>s.scope==='global')});
   }
  }
  const used=new Set(),makeRow=(r,areaId)=>{
   const sources=[];
   for(const id of r.sourceIds){
    const s=catalog.get(id);if(!s){problem('Missing source capability '+id);continue;}
    if(areaId&&!s.countries.some(c=>c.area===areaId)){problem('Unsupported region '+id+' / '+areaId);continue;}
    sources.push(s);used.add(id);
   }
   if(!sources.length)return null;
   const countries=[...new Map(sources.flatMap(s=>s.countries.filter(c=>!areaId||c.area===areaId)).map(c=>[c.id,c])).values()];
   return {...r,sources,countries,industries:uniq(sources.map(s=>s.industry)),broadAreas:areaId?[]:uniq(sources.flatMap(s=>s.broadAreas)).map(id=>areaMap.get(id)?.name||id),global:sources.some(s=>s.global)};
  };
  const regions=plan.regions.flatMap(r=>{
   if(!areaMap.has(r.id)){problem('Unknown region '+r.id);return [];}
   const rows=r.rows.map(row=>makeRow(row,r.id)).filter(Boolean);
   return rows.length?[{...r,rows,sourceCount:uniq(rows.flatMap(x=>x.sources.map(s=>s.id))).length,industries:uniq(rows.flatMap(x=>x.industries))}]:[];
  });
  const chains=plan.chains.rows.map(row=>makeRow(row,'')).filter(Boolean),unmapped=[...catalog.keys()].filter(id=>!used.has(id));
  if(strict&&unmapped.length)throw Error('Unmapped industry capabilities: '+unmapped.join(', '));
  const allRows=regions.flatMap(r=>r.rows).concat(chains),unmappedCountries=[];
  for(const source of catalog.values())for(const country of source.countries)if(!allRows.some(row=>row.sources.some(s=>s.id===source.id)&&row.countries.some(c=>c.id===country.id))){const gap=source.id+' / '+country.id;unmappedCountries.push(gap);problem('Unmapped capability country '+gap);}
  return {regions,chains,catalog,issues,unmapped,unmappedCountries,sourceCount:used.size,inputCount:catalog.size,industryCount:uniq([...catalog.values()].map(s=>s.industry)).length};
 }
 const columns=['建设能力与适用节点','行业需求与复用价值','已有基础与关键缺口','如何建设'];
 function render(plan,model){
  const source=s=>`<button type="button" class="bg-cap-source" data-industry="${esc(s.datasetId)}" data-bg-capability-source="${esc(s.id)}" aria-label="查看${esc(s.industry)}：${esc(s.title)}能力建设" title="${esc(s.industry+'｜'+s.title)}"><strong>${esc(s.industry)}</strong><span>${esc(s.label)}</span><i aria-hidden="true">↗</i></button>`;
  const method=m=>`<div class="bg-cap-method"><span class="bg-path ${m.kind==='partner'?'partner':m.kind==='ma'?'ma':''}">${esc(m.label)}</span><p>${esc(m.text)}</p></div>`;
  const row=r=>`<article class="bg-cap-row" role="row" data-bg-cap-row="${esc(r.id)}">
   <section class="bg-cap-cell bg-cap-what" role="cell"><h5 class="bg-cap-mobile-label">${columns[0]}</h5><h4>${esc(r.title)}</h4><div class="bg-cap-countries">${r.countries.map(c=>`<span>${esc(c.name)}</span>`).join('')}${r.broadAreas.map(a=>`<span>${esc(a)}</span>`).join('')}${r.global?'<span>全球治疗网络</span>':''}</div><ul>${r.details.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></section>
   <section class="bg-cap-cell bg-cap-demand" role="cell"><h5 class="bg-cap-mobile-label">${columns[1]}</h5><div class="bg-cap-sources">${r.sources.map(source).join('')}</div><div class="bg-cap-resources">${r.resources.map(t=>`<span>${esc(t)}</span>`).join('')}</div><p>${esc(r.value)}</p></section>
   <section class="bg-cap-cell bg-cap-basis" role="cell"><h5 class="bg-cap-mobile-label">${columns[2]}</h5><div class="bg-cap-foundation"><b>已有基础</b><p>${esc(r.basis)}</p></div><div class="bg-cap-gap"><b>重点补齐</b><p>${esc(r.gap)}</p></div></section>
   <section class="bg-cap-cell bg-cap-how" role="cell"><h5 class="bg-cap-mobile-label">${columns[3]}</h5>${r.methods.map(method).join('')}</section>
  </article>`;
  const table=(label,rows)=>`<div class="bg-cap-table" role="table" aria-label="${esc(label)}"><div class="bg-cap-columns" role="row">${columns.map(c=>`<span role="columnheader">${c}</span>`).join('')}</div><div role="rowgroup">${rows.map(row).join('')}</div></div>`;
  const region=r=>`<section class="bg-cap-region ${r.primary?'bg-cap-region-primary':'bg-cap-region-other'}" data-bg-cap-region="${esc(r.id)}"><header><div><h3>${esc(r.title)}</h3><p>${esc(r.subtitle)}</p></div><div class="bg-cap-region-actions"><span>${r.industries.length}个行业 · ${r.sourceCount}项能力需求</span><button type="button" class="bg-plan-region-link" data-bg-planning-area="${esc(r.id)}">查看区域地图 <span aria-hidden="true">↗</span></button></div></header>${table(r.title+'能力建设',r.rows)}</section>`;
  return `<div class="bg-block-title bg-planning-title"><div><h2>${esc(plan.title)}</h2><p>${esc(plan.intro)}</p></div><span class="bg-plan-summary">${model.industryCount}行业 · ${model.sourceCount}项行业能力</span></div><div class="bg-cap-logic" aria-label="能力规划推导关系"><span>行业能力规划</span><i aria-hidden="true">→</i><span>区域需求归集</span><i aria-hidden="true">→</i><strong>BG能力建设</strong></div><div class="bg-cap-region-list">${model.regions.filter(r=>r.primary).map(region).join('')}<div class="bg-cap-secondary-title"><h3>其他区域能力建设</h3><p>围绕客户节点配置专业仓运与当地交付</p></div>${model.regions.filter(r=>!r.primary).map(region).join('')}<section class="bg-cap-region bg-cap-chain"><header><div><h3>${esc(plan.chains.title)}</h3><p>${esc(plan.chains.intro)}</p></div></header>${table(plan.chains.title,model.chains)}</section></div><p class="bg-cap-footnote">${esc(plan.footnote)}</p>`;
 }
 return {compile,render};
});
