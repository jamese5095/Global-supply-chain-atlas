from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
text=(ROOT/'page.html').read_text()
licenses='\n\n'.join((ROOT/'vendor'/name).read_text() for name in ['D3-LICENSE.txt','TOPOJSON-LICENSE.txt','WORLD-ATLAS-LICENSE.txt','SHEETJS-LICENSE.txt'])
text=text.replace('<head>','<head>\n<!-- Third-party notices\n'+licenses+'\nNatural Earth geographical data: Public Domain.\n-->')
replacements={
 'STYLE':(ROOT/'style.css').read_text(),
 'D3':(ROOT/'vendor/d3.min.js').read_text(),
 'TOPO':(ROOT/'vendor/topojson-client.min.js').read_text(),
 'XLSX':(ROOT/'vendor/xlsx.full.min.js').read_text(),
 'CORE':(ROOT/'workbook-core.js').read_text(),
 'META':json.dumps(json.loads((ROOT/'metadata.json').read_text()),ensure_ascii=False,separators=(',',':')).replace('<','\\u003c'),
 'DATA':json.dumps(json.loads((ROOT/'data.json').read_text()),ensure_ascii=False,separators=(',',':')).replace('<','\\u003c'),
 'GEO':json.dumps(json.loads((ROOT/'vendor/countries-50m.json').read_text()),separators=(',',':')),
 'REGIONS':json.dumps(json.loads((ROOT/'regions.json').read_text()),ensure_ascii=False,separators=(',',':')),
 'SCOPE':(ROOT/'scope-notes.js').read_text(),
 'APP':(ROOT/'app.js').read_text(),
 'BGSTYLE':(ROOT/'bg.css').read_text(),
 'BGCORE':(ROOT/'bg-core.js').read_text(),
 'BGAPP':(ROOT/'bg.js').read_text(),
 'NAV':(ROOT/'navigation.js').read_text(),
 'BGCONTENT':json.dumps(json.loads((ROOT/'bg-content.json').read_text()),ensure_ascii=False,separators=(',',':')).replace('<','\\u003c'),
}
for key,value in replacements.items():
 marker='/*__'+key+'__*/'
 assert text.count(marker)==1,key
 text=text.replace(marker,value)
assert '/*__' not in text
dest=ROOT/'index.html'
dest.write_text(text)
print(f'Built {dest.name}: {len(text.encode()):,} bytes')
