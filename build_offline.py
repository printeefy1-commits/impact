"""Build the downloadable single-file edition from the application sources."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="style.css">',
                    '<style>' + (root / 'style.css').read_text() + '</style>')
for name in ('vendor/exceljs.min.js', 'network.js', 'radial-layout.js', 'topology.js', 'app.js'):
    code = re.sub(r'</script', r'<\\/script', (root / name).read_text(), flags=re.I)
    html = html.replace(f'<script src="{name}"></script>', f'<script>{code}</script>')
html = html.replace('<body>', '<body>\n<!-- ExcelJS 4.4.0, MIT license: ' +
                    (root / 'vendor/EXCELJS-LICENSE').read_text() + ' -->')
(root / 'athar-offline.html').write_text(html)
print('Built athar-offline.html')
