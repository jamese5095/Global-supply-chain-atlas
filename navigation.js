/* In-page navigation: retain filters and scroll position, never leave the atlas. */
(()=>{
 'use strict';
 const back=document.getElementById('globalBack');
 const clone=s=>JSON.parse(JSON.stringify(s));
 const key=s=>JSON.stringify(s.kind==='bg'?{kind:s.kind,area:s.area,type:s.type}:{kind:s.kind,dataset:s.dataset,state:s.state,search:s.search});
 const capture=()=>window.AtlasBG.active?window.AtlasBG.snapshot():window.AtlasHost.snapshot();
 const past=[];let current={...clone(capture()),scrollY:window.scrollY||0},restoring=false;
 function update(){
  const previous=past[past.length-1];
  back.textContent=previous?'← 返回上一步':'← 返回首页';
  back.title=previous?'返回：'+previous.label:'返回BG总览首页';
  back.setAttribute('aria-label',previous?'返回上一步':'返回首页');
 }
 function record(snapshot,{replace=false}={}){
  if(restoring)return;
  const next={...clone(snapshot),scrollY:window.scrollY||0};
  if(key(current)===key(next)){current.scrollY=next.scrollY;return;}
  if(!replace){past.push(current);if(past.length>80)past.shift();}
  current=next;update();
 }
 function rememberScroll(){if(!restoring)current.scrollY=window.scrollY||0;}
 function goHome(){window.AtlasBG.activate();window.scrollTo({top:0,behavior:'auto'});rememberScroll();}
 function goBack(){
  if(!past.length){goHome();return;}
  const previous=past.pop();restoring=true;
  try{
   if(previous.kind==='bg')window.AtlasBG.restore(previous);else window.AtlasHost.restore(previous);
   current={...clone(capture()),scrollY:previous.scrollY||0};
   window.scrollTo({top:current.scrollY,behavior:'auto'});
  }finally{restoring=false;update();}
 }
 function silent(apply){
  const previousRestoring=restoring,y=window.scrollY||0;restoring=true;
  try{apply();current={...clone(capture()),scrollY:y};window.scrollTo({top:y,behavior:'auto'});}
  finally{restoring=previousRestoring;update();}
 }
 back.addEventListener('click',goBack);
 window.addEventListener('scroll',rememberScroll,{passive:true});
 document.addEventListener('click',rememberScroll,true);
 window.AtlasNav={record,back:goBack,home:goHome,silent};
 Object.defineProperty(window,'atlasNavigationDiagnostics',{get:()=>({depth:past.length,current:clone(current),previous:past.length?clone(past[past.length-1]):null})});
 update();
})();
