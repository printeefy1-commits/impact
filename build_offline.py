"""Build the downloadable single-file edition from the application sources."""
from pathlib import Path
import base64
import re

root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="style.css">',
                    '<style>' + (root / 'style.css').read_text() + '</style>')
for name in ('vendor/exceljs.min.js', 'network.js', 'app.js'):
    code = re.sub(r'</script', r'<\\/script', (root / name).read_text(), flags=re.I)
    html = html.replace(f'<script src="{name}"></script>', f'<script>{code}</script>')
for name in ('sample-links.csv', 'sample-gne.csv'):
    data = base64.b64encode((root / name).read_bytes()).decode()
    html = html.replace(f'href="{name}" download',
                        f'href="data:text/csv;base64,{data}" download="{name}"')
html = html.replace('<body>', '<body>\n<!-- ExcelJS 4.4.0, MIT license: ' +
                    (root / 'vendor/EXCELJS-LICENSE').read_text() + ' -->')
(root / 'athar-offline.html').write_text(html)
print('Built athar-offline.html')
