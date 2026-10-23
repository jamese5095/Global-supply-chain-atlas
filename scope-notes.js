/* Shared sample-selection and case-inclusion notes for all atlas pages. */
(()=>{
 'use strict';
 const definition='头部企业指在所属子行业中，营收、销量、市场份额或运营网络规模等适用指标处于领先梯队，并具有国际经营布局或规模化区域供应链需求的企业。名单综合考虑行业地位与供应链代表性，不采用跨子行业统一排名。';
 const cases='来源表格收录有来源支撑、能够明确业务内容及落地区域的海外或跨境供应链项目，包括生产配套、仓储、运输、分销配送及售后逆向等业务，涵盖企业自营与服务商承接项目。设厂、产能与销售市场信息作为布局背景，国内业务作为能力参考，历史及规划项目保留状态标识；区域或全球项目按原始范围收录，不拆分到国家。';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(selection,bg=false){
  return `<p class="scope-note"><strong>客户选取：</strong><span><strong class="scope-selection">${esc(selection)}</strong>${esc(definition)}</span></p><p class="scope-note"><strong>案例范围：</strong><span>${esc(cases+(bg?'国内参考及纯制造布局不计入BG热度。':''))}</span></p>`;
 }
 function industry(db){
  const subs=new Set(db.clients.map(c=>c.subindustry));
  const counts=[...subs].map(sub=>db.clients.filter(c=>c.subindustry===sub).length);
  const selection=counts.every(n=>n===5)?`本行业覆盖${subs.size}个子行业，每个子行业选取5家头部企业，共${db.clients.length}家。`:`本行业覆盖${subs.size}个子行业，共收录${db.clients.length}家代表性头部企业。`;
  return render(selection);
 }
 function bg(datasets){
  const subCount=datasets.reduce((n,d)=>n+new Set(d.clients.map(c=>c.subindustry)).size,0);
  const allFive=datasets.every(d=>[...new Set(d.clients.map(c=>c.subindustry))].every(sub=>d.clients.filter(c=>c.subindustry===sub).length===5));
  return render(`汇集${datasets.length}个行业、${subCount}个子行业${allFive?'分别选取的5家头部企业':'的代表性头部企业'}及其供应链案例。`,true);
 }
 window.AtlasScope={industry,bg};
})();
