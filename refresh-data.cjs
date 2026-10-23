/* Preview by default; --output writes a candidate bundle, --apply explicitly updates data.json. */
const fs=require('node:fs'),path=require('node:path');
const XLSX=require('./vendor/xlsx.full.min.js'),core=require('./workbook-core.js'),audit=require('./source-audit.js'),reviewer=require('./import-review.js');
const here=__dirname,meta=require('./metadata.json'),areas=require('./regions.json'),policy=require('./audit-policy.json');
const [file,name,...args]=process.argv.slice(2),get=flag=>{const i=args.indexOf(flag);return i<0?'':args[i+1];};
if(!file||!name)throw Error('用法：node refresh-data.cjs "表格.xlsx" "行业" [--report 差异.json] [--output 候选.json | --apply]');
if(args.includes('--apply')&&args.includes('--output'))throw Error('--apply与--output不能同时使用。');
if((args.includes('--report')&&!get('--report'))||(args.includes('--output')&&!get('--output')))throw Error('输出路径不能为空。');
const original=path.join(here,'data.json'),bundle=JSON.parse(fs.readFileSync(original,'utf8'));
const wb=XLSX.read(fs.readFileSync(file),{type:'buffer',cellHTML:false,cellStyles:false});
const raw=core.parseWorkbook(wb,{XLSX,areas,numeric:meta.numeric,baseCountries:meta.countries,name,filename:path.basename(file)}),exchange=raw.exchangeReport;
const d=audit.upgrade(raw,bundle.datasets),report=reviewer.review(bundle.datasets.find(x=>x.id===d.id),d,policy);
if(exchange)report.exchange=exchange;
report.exactLegacySnapshotMigrated=d!==raw;
if(get('--report')){fs.mkdirSync(path.dirname(path.resolve(get('--report'))),{recursive:true});fs.writeFileSync(get('--report'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
if(!report.canApply){process.exitCode=2;console.error('检测到已删除或已替换内容回流，原数据未变更。请保留用户修改并以统一数据版重新合并。');}
else if(args.includes('--apply')||get('--output')){
 const datasets=new Map(bundle.datasets.map(d=>[d.id,d]));datasets.set(d.id,d);
 const destination=args.includes('--apply')?original:path.resolve(get('--output'));
 if(destination===original&&!args.includes('--apply'))throw Error('更新data.json必须显式使用--apply。');
 fs.mkdirSync(path.dirname(destination),{recursive:true});const temporary=destination+'.tmp';fs.writeFileSync(temporary,JSON.stringify({...bundle,datasets:[...datasets.values()]},null,2)+'\n');fs.renameSync(temporary,destination);
}
