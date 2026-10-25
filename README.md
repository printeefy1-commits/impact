# Athar MW

An offline microwave network explorer with a global site finder, radial topology maps, and a fixed-GNE impact calculator. The interface is in English. No files are uploaded to an external service.

## Run

Open **athar-offline.html** in Chrome or Edge. It contains the interface, icons, and Excel reader in one file. Alternatively, open `index.html` alongside its supporting files, or run `python -m http.server 8000` from this folder.

## Import network data

Upload a links file and a GNE file, then choose **Build network map**. Supported formats are XLSX, CSV, and TXT, up to 10 MB per file. Only the first Excel worksheet is read; legacy XLS is not supported.

- In MLR tables, `Source NE Name` and `Sink NE Name` are authoritative. Otherwise the importer uses `Link Name`, `Link`, or the first column; each link cell should contain two site identifiers.
- For gateways, the importer uses `GNE Name`, `GNE`, `Gateway Name`, or the first column. It keeps the primary identifier at the beginning of the cell and discards descriptions and annotated secondary names.
- Identifiers start with A, C, or O, followed by two digits, then S, M, X, T, B, or SU, followed by three or four digits. CA identifiers such as `A11CA03` and the special gateway `CA-BBM` are also supported. TSU is normalized to SU.
- All user-approved name corrections are applied automatically, including `O46WX158 → O46X158` and `O46WX159 → O46X159`. Numeric model suffixes remain separate: `A16X1801 6900 → A16X1801`.
- The confirmed `A33T001 ↔ A33CA01` connection is added only when that site and gateway are present and the connection is missing. The import message identifies the addition.

The two cleaned CSV downloads contain valid, unique links and gateways. Original files remain unchanged. The import message reports skipped non-matching cells, including headers.

## Gateway ownership and topology

Every NE is assigned to exactly one GNE using the fewest physical hops. Equal-hop ties are resolved by the GNE's first appearance in the uploaded gateway file after normalization and deduplication. Alphabetical sorting in the dropdown does not change this priority. A site appears only in its assigned gateway's map.

Type a complete NE or GNE name into **Find any site across the network** to automatically open its assigned map, highlight its icon, and center it. Suggestions include all imported sites. Saved name corrections are supported in searches too. Unknown or unconnected sites show an explanatory message instead of an unrelated map. You can also select or filter gateways manually.

Maps use a radial arrangement with a single straight line per unique undirected link. Drag the background to pan, use the wheel or buttons to zoom, and drag icons to rearrange sites. Maps open at 100% icon size; **Fit map** shows the whole branch. Extra links can be hidden. Auto arrange restores the layout. Full screen is available where supported. Local SVG dish, radio, gateway, and tower icons require no external resources.

## Impact calculation

Enter an NE or GNE and choose **Calculate impact**, or press Enter. Ownership is fixed before the outage: a site cannot switch to another GNE or use another gateway's domain to bypass the failure. Backup routes within the same assigned domain remain usable.

An NE's impact includes the site itself and its assigned-domain sites that lose their route to the assigned gateway. A GNE's impact includes itself and its entire assigned domain. Changing the displayed map does not change the result.

The copyable output contains only comma-separated identifiers, with no extra spaces or line breaks, for example:

`O46X158,O46X001,O46X117,O46X157,O46X165,O46X209`

The entered site is listed first; other names are sorted. Use **Copy list** or select the text manually. The count includes the entered site. Calculations describe imported topology, not live equipment state. Data and manual node positions are not retained after reloading the page.

## Development checks

- Build the standalone file: `python build_offline.py`
- Graph and layout tests: `node --test network.test.js topology.test.js radial-layout.test.js`
- Browser workflow tests: `node --test import.browser.test.cjs` (requires Playwright and Chromium; set `CHROMIUM_PATH` if needed).

Browser checks cover CSV/XLSX import, a 150,000-cell rejection report, cleaned exports and re-import, ownership ties, global site search, map interactions, and comma-separated impact results.

ExcelJS 4.4.0 is bundled in `vendor/` under the MIT license. System fonts and local icons keep the application independent of network access.
