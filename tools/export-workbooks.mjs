/* Run with the bundled @oai/artifact-tool runtime; SheetJS is used for reading only. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const XLSX=require('../vendor/xlsx.full.min.js'),sync=require('../workbook-roundtrip.js'),core=require('../workbook-core.js');
const args=process.argv.slice(2),out=path.resolve(args[0]||path.join(root,'unified-workbooks')),sector=args[1];
const data=JSON.parse(await fs.readFile(path.join(root,'data.json'),'utf8'));
const areas=JSON.parse(await fs.readFile(path.join(root,'regions.json'),'utf8'));
await fs.mkdir(out,{recursive:true});
const report=[];
for(const d of data.datasets.filter(d=>!sector||d.name===sector)){
 core.validate(d);
 const input=path.join(root,'input',d.workbook),raw=XLSX.read(await fs.readFile(input),{type:'buffer',cellStyles:true}),name=raw.SheetNames[0],s=raw.Sheets[name];
 const range=XLSX.utils.decode_range(s['!ref']),merges=s['!merges']||[],cells={},fields={},links={};
 const address=(r,c)=>XLSX.utils.encode_cell({r,c}),inside=(m,r,c)=>m.s.r<=r&&r<=m.e.r&&m.s.c<=c&&c<=m.e.c;
 const anchor=(r,c)=>{const m=merges.find(m=>inside(m,r,c));return m?address(m.s.r,m.s.c):address(r,c);};
 const set=(a,value,field,url='')=>{if(value||url)cells[a]={value:String(value),url};if(field)fields[a]=field;if(url)links[a]=url;};
 for(let r=0;r<2;r++)for(let c=0;c<=range.e.c;c++){const a=address(r,c);if(s[a]?.v)set(a,s[a].v);}
 const catalog=core.editable.countryCatalog(require('../metadata.json').countries,areas,require('../metadata.json').numeric);
 const countryColumns=[];
 for(let c=5;c<=range.e.c;c++){const label=String(s[address(1,c)]?.v||'');if(label){const country=catalog.resolve(label);if(!country)throw Error('国家无法识别：'+label);countryColumns.push({c,country});}}
 const supplement=[],covered=new Set();
 for(let i=0;i<d.clients.length;i++){
  const client=d.clients[i],r=client.matrixRow-1,end=(d.clients[i+1]?.matrixRow||range.e.r+2)-2;
  for(const [c,key]of [[0,'subindustry'],[1,'name'],[2,'overview'],[3,'carrierText']]){
   const a=anchor(r,c),ids=key==='subindustry'?[...(fields[a]?.clientIds||[]),client.id]:undefined;set(a,client[key],{kind:'client',clientId:client.id,key,...(ids?{clientIds:ids}:{})});
  }
  const refs=Object.entries(client.sourceRefs).sort((a,b)=>Number(a[0])-Number(b[0]));
  if(refs.length>end-r+1)throw Error('来源超过客户行块容量：'+client.name);
  for(let j=0;j<=end-r;j++){
   const a=address(r+j,4),ref=refs[j],source=ref&&d.sources.find(s=>s.id===ref[1]);
   set(a,source?'['+ref[0]+'] '+source.label:'',{kind:'source',clientId:client.id,sourceId:source?.id||'',number:ref?.[0]||''},source?.url||'');
  }
  for(const cc of countryColumns){
   const a=anchor(r,cc.c);if(fields[a])continue;
   const m=merges.find(m=>inside(m,r,cc.c)),horizontal=m&&m.e.c>m.s.c,region=String(s[anchor(0,cc.c)]?.v||'');
   fields[a]={kind:'projects',clientId:client.id,recordIds:[],scope:horizontal?'region':'country',countryId:horizontal?'':cc.country.id,region:horizontal?region:'',reference:cc.country.reference,areaId:horizontal?core.regionId(region,areas):cc.country.areaId,contextAreas:horizontal?(core.regionContext[region]||[core.regionId(region,areas)].filter(Boolean)):[cc.country.areaId],eligibleCountryIds:horizontal?countryColumns.filter(x=>x.c>=m.s.c&&x.c<=m.e.c).map(x=>x.country.id):[cc.country.id]};
  }
  for(const rcd of d.records.filter(r=>r.clientId===client.id)){
   const possible=rcd.scope==='global'?null:rcd.matrixCells.find(a=>XLSX.utils.decode_cell(a).c>=5),a=possible&&anchor(XLSX.utils.decode_cell(possible).r,XLSX.utils.decode_cell(possible).c),f=a&&fields[a];
   if(f&&f.kind==='projects'&&(!f.recordIds.length||f.scope===rcd.scope)){
    Object.assign(f,{scope:rcd.scope,countryId:rcd.countryId,region:rcd.region,reference:rcd.reference,areaId:rcd.areaId,contextAreas:rcd.contextAreas,eligibleCountryIds:rcd.eligibleCountryIds});f.recordIds.push(rcd.id);covered.add(rcd.id);
   }else supplement.push(rcd);
  }
 }
 const projectText=r=>r.title+(r.types.length?'（'+r.types.join('、')+'）':'')+'\n'+r.detail;
 for(const [a,f]of Object.entries(fields))if(f.kind==='projects'&&f.recordIds.length)set(a,f.recordIds.map(id=>projectText(d.records.find(r=>r.id===id))).join('\n\n'));
 const planned={sheets:{[name]:{cells,merges:merges.map(m=>XLSX.utils.encode_range(m)).sort(),main:true}}},allFields={[name]:fields};
 const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(input)),sheet=wb.worksheets.getItem(name);
 sheet.getRange(address(2,0)+':'+address(range.e.r,range.e.c)).clear({applyTo:'contents'});
 // Reapply headers and body text as blocks, retaining the reference workbook's geometry.
 const values=Array.from({length:range.e.r+1},()=>Array(range.e.c+1).fill(null));
 for(const [a,c]of Object.entries(cells)){const p=XLSX.utils.decode_cell(a);values[p.r][p.c]=c.value;}
 sheet.getRange('A1:'+address(range.e.r,range.e.c)).values=values;
 sheet.getRange('A3:'+address(range.e.r,range.e.c)).format.font={name:'Microsoft YaHei',size:11,color:'#243746'};
 sheet.getRange('A3:'+address(range.e.r,range.e.c)).format.wrapText=true;
 sheet.getRange('A3:'+address(range.e.r,range.e.c)).format.verticalAlignment='top';
 sheet.getRange('F3:'+address(range.e.r,range.e.c)).format.fill='#EAF3FA';
 sheet.getRange('E3:E'+(range.e.r+1)).format.font={name:'Microsoft YaHei',size:11,color:'#1765A5'};
 const columns=s['!cols']||[],textHeight=(text,c)=>{
  const width=columns[c]?.wch||columns[c]?.width||24;
  const lines=String(text).split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil([...line].reduce((m,ch)=>m+(ch.codePointAt(0)>255?2:1),0)/Math.max(8,width-1))),0);
  return lines*14.5+8;
 };
 const heights=Array.from({length:range.e.r+1},(_,r)=>s['!rows']?.[r]?.hpt||s['!rows']?.[r]?.hpx*0.75||44);
 for(const [a,v]of Object.entries(cells)){
  const p=XLSX.utils.decode_cell(a);if(p.r<2)continue;
  const m=merges.find(m=>m.s.r===p.r&&m.s.c===p.c),last=m?.e.r??p.r;
  const current=heights.slice(p.r,last+1).reduce((n,x)=>n+x,0),need=textHeight(v.value,p.c);
  if(need>current)for(let r=p.r;r<=last;r++)heights[r]+=(need-current)/(last-p.r+1);
 }
 for(let r=2;r<=range.e.r;r++)sheet.getRange('A'+(r+1)+':'+address(r,range.e.c)).format.rowHeight=Math.min(400,Math.ceil(heights[r]));
 if(supplement.length){
  const sn='区域共用与全球项目',ss=wb.worksheets.add(sn),sc={},sf={};
  const headers=['子行业','头部客户','项目范围','落地项目与业务类型','信息来源'];
  headers.forEach((v,i)=>{sc[address(0,i)]={value:v,url:''};});
  ss.getRange('A1:E1').values=[headers];
  for(let i=0;i<supplement.length;i++){
   const r=supplement[i],c=d.clients.find(c=>c.id===r.clientId),row=i+1,vals=[c.subindustry,c.name,r.region||'全球',projectText(r),r.sourceIds.map(id=>'['+Object.entries(c.sourceRefs).find(([,x])=>x===id)?.[0]+']').join(' ')];
   for(let j=0;j<vals.length;j++)sc[address(row,j)]={value:vals[j],url:''};
   sf[address(row,3)]={kind:'projects',clientId:c.id,recordIds:[r.id],scope:r.scope,countryId:r.countryId,region:r.region,reference:r.reference,areaId:r.areaId,contextAreas:r.contextAreas,eligibleCountryIds:r.eligibleCountryIds};
   ss.getRange('A'+(row+1)+':E'+(row+1)).values=[vals];covered.add(r.id);
  }
  ss.getRange('A1:E'+(supplement.length+1)).format={font:{name:'Microsoft YaHei',size:11,color:'#243746'},wrapText:true,verticalAlignment:'top',rowHeight:150};
  ss.getRange('A1:E1').format={fill:'#213B63',font:{bold:true,color:'#FFFFFF'},rowHeight:30};
  ss.getRange('A:A').format.columnWidth=20;ss.getRange('B:B').format.columnWidth=24;ss.getRange('C:C').format.columnWidth=18;ss.getRange('D:D').format.columnWidth=75;ss.getRange('E:E').format.columnWidth=22;
  ss.getRange('D2:D'+(supplement.length+1)).format.fill='#EAF3FA';ss.freezePanes.freezeRows(1);
  planned.sheets[sn]={cells:sc,merges:[],main:false};allFields[sn]=sf;
 }
 if(covered.size!==d.records.length)throw Error('项目导出不完整');
 const envelope={version:1,dataFingerprint:sync.fingerprint(d),dataset:d,snapshot:Object.fromEntries(Object.entries(planned.sheets).map(([n,s])=>[n,{cells:s.cells,merges:s.merges}])),fields:allFields};
 const ms=wb.worksheets.add(sync.META),payload=JSON.stringify(envelope),chunks=[];for(let i=0;i<payload.length;i+=28000)chunks.push([payload.slice(i,i+28000)]);
 ms.getRange('A1').values=[[sync.MAGIC]];ms.getRange('A2').values=[[chunks.length]];ms.getRange('A3:A'+(chunks.length+2)).values=chunks;
 wb.recalculate();
 const inspected=await wb.inspect({kind:'table',sheetId:name,range:'B1:H3',maxChars:1200,tableMaxRows:3,tableMaxCols:7,tableMaxCellChars:65});
 const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:5},maxChars:1000});
 const filename='国际业务热力图_'+d.name+'_统一数据版.xlsx',dest=path.join(out,filename),spec=path.join(out,'.'+d.name+'-native.json');
 await fs.writeFile(spec,JSON.stringify(planned));
 await (await SpreadsheetFile.exportXlsx(wb)).save(dest);
 execFileSync('python3',[path.join(root,'tools/finalize-workbook.py'),dest,spec]);await fs.unlink(spec);
 const saved=XLSX.read(await fs.readFile(dest),{type:'buffer'}),actual=sync.snapshot(saved,XLSX);
 if(JSON.stringify(actual)!==JSON.stringify(envelope.snapshot)){
  await fs.writeFile(path.join(out,'.'+d.name+'-actual.json'),JSON.stringify(actual));await fs.writeFile(path.join(out,'.'+d.name+'-expected.json'),JSON.stringify(envelope.snapshot));
  // Object key order is irrelevant; report any real serialization differences.
  for(const n of Object.keys(actual))for(const a of new Set([...Object.keys(actual[n].cells),...Object.keys(envelope.snapshot[n].cells)]))if(JSON.stringify(actual[n].cells[a])!==JSON.stringify(envelope.snapshot[n].cells[a]))throw Error('保存内容不一致 '+n+'!'+a);
 }
 // Rendering excludes the large hidden payload and focuses on readable content.
 const png=await wb.render({sheetName:name,range:'A1:H'+Math.min(range.e.r+1,d.clients[1]?.matrixRow-1||8),scale:1,format:'png'});
 await fs.writeFile(path.join(out,'.'+d.name+'-preview.png'),new Uint8Array(await png.arrayBuffer()));
 report.push({name:d.name,file:filename,clients:d.clients.length,records:d.records.length,sources:d.sources.length,supplementProjects:supplement.length,artifactInspect:inspected.ndjson,formulaErrors:errors.ndjson});
 console.log(JSON.stringify({industry:d.name,exported:filename,records:d.records.length,sources:d.sources.length}));
}
await fs.writeFile(path.join(out,'export-report.json'),JSON.stringify(report,null,2));
