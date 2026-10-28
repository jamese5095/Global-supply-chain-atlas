'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),template=fs.readFileSync(path.join(root,'page.html'),'utf8');
for(const s of [html,template]){
 assert.doesNotMatch(s,/<input\b[^>]*\btype\s*=\s*['"]?file\b/i,'File upload control remains');
 assert.doesNotMatch(s,/<a\b[^>]*\bdownload(?:\s|=|>)/i,'Download link remains');
 for(const id of ['dataBtn','dataDialog','importDialog','methodDialog','importFile','restoreFile','applyImport','exportData'])assert.doesNotMatch(s,new RegExp('id=["\']'+id+'["\']'),'Management element remains: '+id);
}
assert.doesNotMatch(app,/indexedDB|openStorage|storageData|saveDatasets|SourceAudit|ImportReview|\.download\s*=|createObjectURL|readAsArrayBuffer|\.arrayBuffer\(/,'Data mutation or backup handling remains');
assert.doesNotMatch(html,/sf-supplychain-atlas-six-industries-v1|SheetJS CE|id="audit-policy"|root\.WorkbookRoundtrip\s*=|root\.ImportReview\s*=/,'Browser import dependency remains');
let scriptCount=0;
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/type="application\/json"/.test(m[1])){new vm.Script(m[2]);scriptCount++;}
assert.match(app,/readOnly:true/);
const data=JSON.parse(html.match(/<script id="atlas-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.equal(data.datasets.length,6);
assert.equal(data.datasets.reduce((n,d)=>n+d.records.length,0),522);
assert.equal(data.datasets.reduce((n,d)=>n+d.clients.length,0),145);
console.log(JSON.stringify({status:'PASS',readOnly:true,fileControls:0,managementDialogs:0,legacyImportCacheIgnored:true,executableScriptsChecked:scriptCount,industries:6,records:522,clients:145}));
