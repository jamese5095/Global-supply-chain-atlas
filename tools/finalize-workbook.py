"""Add missing native XLSX features after Artifact Tool authors the workbook.

Only hyperlink relationships, the exchange marker, hidden helper state and frozen-pane attributes are
patched. All cell values, layouts and formatting are authored by Artifact Tool.
"""
import json, sys, zipfile, xml.etree.ElementTree as E
from pathlib import Path

path, spec_path = map(Path, sys.argv[1:])
spec = json.loads(spec_path.read_text())
S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
P = 'http://schemas.openxmlformats.org/package/2006/relationships'
E.register_namespace('', S)
E.register_namespace('r', R)
with zipfile.ZipFile(path) as z:
    files = {n: z.read(n) for n in z.namelist()}
w = E.fromstring(files['xl/workbook.xml'])
defined = w.find(f'{{{S}}}definedNames')
if defined is None:
    defined = E.Element(f'{{{S}}}definedNames')
    index = list(w).index(w.find(f'{{{S}}}sheets')) + 1
    w.insert(index, defined)
if not any(n.attrib.get('name') == '_SF_ATLAS_V1' for n in defined):
    first = next(iter(spec['sheets']))
    marker = E.SubElement(defined, f'{{{S}}}definedName', name='_SF_ATLAS_V1', hidden='1')
    marker.text = "'" + first.replace("'", "''") + "'!$A$1"
rels = E.fromstring(files['xl/_rels/workbook.xml.rels'])
targets = {r.attrib['Id']: r.attrib['Target'] for r in rels}
for sh in w.find(f'{{{S}}}sheets'):
    name = sh.attrib['name']
    if name == '_atlas_meta':
        sh.set('state', 'hidden')
    target = targets[sh.attrib[f'{{{R}}}id']]
    filename = target.lstrip('/') if target.startswith('/') else 'xl/' + target
    if name not in spec['sheets']:
        continue
    doc = E.fromstring(files[filename])
    old = doc.find(f'{{{S}}}hyperlinks')
    if old is not None:
        doc.remove(old)
    folder, base = filename.rsplit('/', 1)
    relpath = folder + '/_rels/' + base + '.rels'
    sr = E.fromstring(files[relpath]) if relpath in files else E.Element(f'{{{P}}}Relationships')
    for r in list(sr):
        if r.attrib.get('Type', '').endswith('/hyperlink'):
            sr.remove(r)
    links = [(a, c['url']) for a, c in spec['sheets'][name]['cells'].items() if c['url']]
    if links:
        links_node = E.Element(f'{{{S}}}hyperlinks')
        # OpenXML hyperlinks follow conditional formatting / validation and precede print settings.
        trailing = {'printOptions', 'pageMargins', 'pageSetup', 'headerFooter', 'rowBreaks', 'colBreaks', 'drawing', 'legacyDrawing', 'extLst'}
        pos = next((i for i, n in enumerate(doc) if n.tag.split('}')[-1] in trailing), len(doc))
        doc.insert(pos, links_node)
        ids = {r.attrib['Id'] for r in sr}
        for i, (addr, url) in enumerate(links):
            rid = f'atlasLink{i}'
            while rid in ids:
                rid += 'x'
            ids.add(rid)
            E.SubElement(sr, f'{{{P}}}Relationship', Id=rid, Type=R+'/hyperlink', Target=url, TargetMode='External')
            E.SubElement(links_node, f'{{{S}}}hyperlink', ref=addr, attrib={f'{{{R}}}id': rid})
    views = doc.find(f'{{{S}}}sheetViews')
    if views is None:
        views = E.Element(f'{{{S}}}sheetViews'); doc.insert(0, views)
    view = views.find(f'{{{S}}}sheetView')
    if view is None:
        view = E.SubElement(views, f'{{{S}}}sheetView', workbookViewId='0')
    for n in list(view):
        if n.tag.endswith('}pane') or n.tag.endswith('}selection'):
            view.remove(n)
    if spec['sheets'][name].get('main'):
        view.insert(0, E.Element(f'{{{S}}}pane', xSplit='5', ySplit='2', topLeftCell='F3', activePane='bottomRight', state='frozen'))
    files[filename] = E.tostring(doc, encoding='utf-8', xml_declaration=True)
    E.register_namespace('', P)
    files[relpath] = E.tostring(sr, encoding='utf-8', xml_declaration=True)
    E.register_namespace('', S)
files['xl/workbook.xml'] = E.tostring(w, encoding='utf-8', xml_declaration=True)
temporary = path.with_suffix('.tmp.xlsx')
with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as z:
    for n, data in files.items():
        z.writestr(n, data)
temporary.replace(path)
