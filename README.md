# Athar MW

An offline microwave network explorer with a global site finder, radial topology maps, and a fixed-GNE impact calculator. The interface is in English. No files are uploaded to an external service.

## Run

Open **athar-offline.html** in Chrome or Edge. It contains the interface, icons, and Excel reader in one file. Alternatively, open `index.html` alongside its supporting files, or run `python -m http.server 8000` from this folder.

## Import network data

Upload your daily links file, then choose **Build network map**. The application already includes the confirmed **272 GNE gateways**: the 251 from the Ethernet-port analysis, A16X589 from the MLR name review, and 20 earlier confirmed gateways absent from the port analysis. This retains the complete original 191-gateway list. Supported formats are XLSX, CSV, and TXT, up to 10 MB per file. Only the first Excel worksheet is read; legacy XLS is not supported.

**Add GNE gateways** is optional. Its cleaned names are merged with the built-in list and any earlier additions, with duplicates removed. New gateways are saved locally in this browser for subsequent daily imports and page reloads. Storage belongs to the browser and page location; keep the downloadable GNE CSV when moving to another browser or computer. If storage is unavailable, additions work for the current session and the import message explains how to retain them. The GNE CSV contains the complete active list, including additions.

- In MLR tables, `Source NE Name` and `Sink NE Name` are authoritative. If both endpoint cells are empty, a valid Link Name supplies the pair. Otherwise, for files without endpoint columns, the importer uses `Link Name`, `Link`, or the first column; each link cell should contain two site identifiers.
- For gateways, the importer uses `GNE Name`, `GNE`, `Gateway Name`, or the first column. It keeps the primary identifier at the beginning of the cell and discards descriptions and annotated secondary names.
- Identifiers start with A, C, or O, followed by two digits, then S, M, X, T, B, SU, WX, SM, W, or R, followed by three or four digits. CA identifiers such as `A11CA03` and the special gateway `CA-BBM` are also supported. TSU is normalized to SU.
- All user-approved name corrections are applied automatically, including `O46WX158 → O46X158` and `O46WX159 → O46X159`. Numeric model suffixes remain separate: `A16X1801 6900 → A16X1801`.
- Special sites are retained. `A16-SCE1-PEPSI-050` becomes `A16SCE1-PEPSI050`. Spaces and extra hyphens/underscores are removed, with one hyphen after SCE1; case is normalized to uppercase. Equipment suffixes such as EB, EBAND2, E-band, NE, NE_1 and radio H/V are removed. SE01, SE1, SC-E01 and SEC1 use SCE1; SC1 remains separate.
- User-approved prefix repairs include `16 → A16`, `04 → C04`, a leading zero → O, `5A16 → A16`, `AAAX030 → A44X030`, `O4X106 → C04X106`, `A6S496 → A06S496`, `09X170 → A09X170`, `22X163 → O22X163`, and `A16XT1999 → A16X1999`.
- Explicit identity corrections include HYDRA → A16X1577, ERMA Baraki → A16M1230, CDS EL BIAR → A16M632, O38X090 → O38R050, and El kendi Rahmania-015 → A16SCE1-ELKENDIRAHMANIA015. Other descriptions do not override an existing primary standard identifier.
- Names starting with NE, including `NE(160-32630)`, remain exactly as written. Other nonempty special endpoint names are retained after cleanup. Unconnected sites remain counted and searchable; no route is invented for them.
- The confirmed `A33T001 ↔ A33CA01` connection is added only when that site and gateway are present and the connection is missing. The import message identifies the addition.

The two cleaned CSV downloads contain valid, unique links and gateways. Links are exported in separate `Source NE Name` and `Sink NE Name` columns, preserving special names and internal hyphens without ambiguous splitting. Original files remain unchanged. The import message reports skipped non-matching cells, including headers.

## Gateway ownership and topology

Every connected NE is assigned to exactly one GNE using the fewest physical hops. Equal-hop ties use the saved gateway order: the built-in list first, earlier additions next, and newly uploaded gateways in their file order. The built-in list preserves the previous file priority for all 191 original gateways, then discovery order for new port-detected gateways, then A16X589. Alphabetical sorting in the dropdown does not change this priority. A site appears only in its assigned gateway's map. Gateways absent from a daily links file remain in the list and have isolated maps until links are imported for them.

Type a complete NE or GNE name into **Search NE or GNE** to automatically open its assigned map, highlight its icon, and center it. Suggestions include all imported sites. Saved name corrections are supported in searches too. Both search and impact accept a name without its initial region letter, such as `44X003` for `A44X003`, when it identifies exactly one imported site. If multiple A/C/O names share that suffix, enter the full identifier. Unknown or unconnected sites show an explanatory message instead of an unrelated map. The single search field accepts both NE and GNE names. You can also select gateways from the adjacent dropdown. The desktop explorer uses one control row with a 5 cm search field and 4 cm gateway selector and adjacent map tools. The header is 1 cm tall. On desktop the map fills the browser space down to the bottom margin, adapting to window height instead of forcing a square. The sidebar ends at the same height and scrolls internally when needed. Smaller screens retain a stacked layout with a viewport-sized map. Counters overlay the canvas at 75% size and 50% opacity, becoming fully opaque on hover or keyboard focus. Their labels and values are enlarged by 70%. Navigation hints overlay the map; the colour legend is removed. Routine import messages are hidden; import errors appear beside the upload controls.

Maps use a compact radial arrangement with a single straight line per unique undirected link. Sites keep the ordered radial arrangement with reduced spacing between levels. Main-path crossings are checked; crowded branches retain nested angular sectors when needed to keep their links from crossing. After measuring the rendered device rectangles, automatic arrangement moves obstructing sites slightly until straight links clear the icons. A final compaction pass brings long branches closer to their parent by moving each complete subtree together. Moves are accepted only when they reduce connecting-link length, keep icons apart, avoid unrelated icons, and preserve main-path planarity. Line endpoints attach to the actual radio body boundary. Safety padding and the NE/GNE badge are used only to avoid unrelated icons, and never create a gap at the connected endpoint. Names are not routing obstacles: links may pass behind names, which are painted above all links. All connections remain single straight SVG lines; no curved or routed paths are used. Additional physical links can still cross other links and can be hidden with Extra links. This layout applies to every GNE and does not alter imported links, ownership, or impact. Drag the background to pan and use the wheel or buttons to zoom. Hovering a site icon or name turns its device dark green. Click to select one site; Ctrl+click (Cmd+click on macOS) adds or removes sites. Selected devices have red outlines, and dragging any selected device moves the whole group while updating its links. Manual selection cancels the previous search highlighting. Click the background or press Escape on a focused site to clear selection; a new search or impact calculation starts a fresh selection. Enter/Space also select focused sites, with Ctrl/Cmd to toggle them. Site names use a 29.25 px font, enlarged by a further 50%. Searching an NE/GNE or selecting a gateway starts at 32% zoom with its GNE centered in the map. If a searched NE would be outside the map, the view zooms out just enough to include its complete icon and name while keeping the GNE centered; visible sites retain 32%. Calculating impact centers the combined bounds of the affected sites and their GNE and chooses an automatic zoom that fits them all. Resizing the viewport retains the active framing mode; **Fit map** shows the whole branch. Long site names wrap at the full font size inside their labels. Extra links can be hidden. Auto arrange restores the layout. Full screen is available where supported. NE device icons are enlarged by 40% from their previous size. GNE device icons remain yellow and are enlarged by 20% from their previous size; impacted devices turn grey with red outlines, and the searched device is outlined red. NE names are white directly on the map without a label background; GNE labels retain their background. Local SVG dish, radio, gateway, and tower icons require no external resources.

## Impact calculation

Enter an NE or GNE and choose **Calculate impact**, or press Enter. Impact follows the fixed main-path tree drawn with solid lines on the map. Additional links provide no service protection and are ignored for impact, even inside the same GNE domain. Ownership and main paths are fixed before the outage.

Calculating impact opens the assigned map, centers the combined GNE and impacted-site group with automatic zoom, and marks them grey with red outlines. Editing the impact input clears the previous highlighting.

An NE's impact includes the site itself and every descendant on its main-path branch. A GNE's impact includes itself and its entire assigned domain. Changing the displayed map, dragging sites, or showing/hiding extra links does not change the result.

The copyable output contains only comma-separated identifiers, with no extra spaces or line breaks, for example:

`O46X158,O46X001,O46X117,O46X157,O46X165,O46X209`

The entered site is listed first; other names are sorted. Use **Copy list** or select the text manually. The count includes the entered site. Calculations describe imported topology, not live equipment state. Daily links and manual node positions are not retained after reloading the page; added gateways are retained when browser storage is available.

## Development checks

- Build the standalone file: `python build_offline.py`
- Graph and layout tests: `node --test network.test.js default-gne.test.js topology.test.js radial-layout.test.js layout-clearance.test.js`
- Browser workflow tests: `node --test import.browser.test.cjs` (requires Playwright and Chromium; set `CHROMIUM_PATH` if needed).

Browser checks cover CSV/XLSX import, a 150,000-cell rejection report, cleaned exports and re-import, ownership ties, global site search, map interactions, special-name normalization and round trips, and comma-separated impact results.

ExcelJS 4.4.0 is bundled in `vendor/` under the MIT license. System fonts and local icons keep the application independent of network access.
