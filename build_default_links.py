"""Refresh the bundled network: python build_default_links.py path/to/MLR.xlsx.

Requires openpyxl and Node.js. Uses the same name and link parser as the website.
Only normalized, deduplicated endpoint pairs are published, not the workbook.
"""
import json
from pathlib import Path
import subprocess
import sys
import openpyxl

root = Path(__file__).resolve().parent
source = Path(sys.argv[1])
book = openpyxl.load_workbook(source, read_only=True, data_only=True)
sheet = book.worksheets[0]
rows = sheet.iter_rows(values_only=True)
header = next(rows)
keys = {str(v or '').strip().lower().replace(' ', '').replace('_', '').replace('-', ''): i for i, v in enumerate(header)}
columns = [keys[k] for k in ('sourcenename', 'sinknename', 'linkname') if k in keys]
if not columns:
    raise ValueError('No source/sink or link-name columns found')
cells = [{'row': 1, 'column': i + 1, 'value': str(header[i] or '')} for i in columns]
for number, row in enumerate(rows, 2):
    cells.extend({'row': number, 'column': i + 1, 'value': str(row[i] or '')} for i in columns)
book.close()
code = """
const fs=require('fs'),N=require('./network'),gates=require('./default-gne');
const parsed=N.parseLinks(JSON.parse(fs.readFileSync(0,'utf8')));
const links=[...new Map(parsed.valid.map(pair=>[JSON.stringify(pair.slice().sort()),pair])).values()];
if(!links.length)throw Error('No valid links in workbook');
const confirmed=N.applyConnections(links,gates),adj=N.graph(confirmed.links,gates),assignment=N.traverse(adj,gates);
console.log(JSON.stringify({links,stats:{uniqueLinks:links.length,sites:adj.size,gateways:gates.length,unconnected:adj.size-assignment.visited.size,skippedRows:parsed.invalid.length}}));
"""
result = json.loads(subprocess.run(['node', '-e', code], input=json.dumps(cells), text=True, capture_output=True, check=True, cwd=root).stdout)
snapshot = {'source': source.name, 'links': result['links']}
(root / 'default-links.js').write_text('// Bundled MLR endpoint pairs. Refresh with build_default_links.py.\n(function(root){\n  const data=' + json.dumps(snapshot, separators=(',', ':')) + ';\n  if(typeof module!=="undefined")module.exports=data;else root.DefaultLinks=data;\n})(globalThis);\n')
print(json.dumps(result['stats']))
