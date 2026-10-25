const $=id=>document.getElementById(id);
let state=null;
const topologyView=new Topology.View($('map'),k=>{$('zoomLabel').textContent=Math.round(k*100)+'%';});
let cleanedFiles=null;
function prepareDownloads(links,gates){
  cleanedFiles={
    links:[...new Set(links.map(pair=>pair.slice().sort().join('-')))],
    gates:[...new Set(gates)]
  };
  $('downloadLinks').disabled=!cleanedFiles.links.length;
  $('downloadGates').disabled=!cleanedFiles.gates.length;
}
function downloadCleaned(kind){
  const values=cleanedFiles?.[kind];if(!values?.length)return;
  const header=kind==='links'?'link':'GNE';
  const blob=new Blob(['\uFEFF',header+'\r\n',values.join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=kind==='links'?'cleaned-links.csv':'cleaned-gne.csv';
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
$('downloadLinks').onclick=()=>downloadCleaned('links');
$('downloadGates').onclick=()=>downloadCleaned('gates');
async function readCells(file,kind){
  if(!file)throw Error('Choose both a links file and a GNE file first.');
  if(file.size>10*1024*1024)throw Error('Each file must be 10 MB or smaller.');
  if(/\.xlsx$/i.test(file.name)){
    if(!window.ExcelJS)throw Error('The Excel reader could not load. Reload the page or use CSV.');
    const book=new ExcelJS.Workbook();await book.xlsx.load(await file.arrayBuffer());
    const sheet=book.worksheets[0];if(!sheet)throw Error('This Excel file has no worksheets.');
    const headings=new Map();sheet.getRow(1).eachCell(cell=>headings.set(cell.text.trim().toLowerCase().replace(/[\s_-]/g,''),cell.col));
    let columns=null;
    if(kind==='links'&&headings.has('sourcenename')&&headings.has('sinknename'))columns=[headings.get('sourcenename'),headings.get('sinknename')];
    else if(kind==='links'&&(headings.has('linkname')||headings.has('link')))columns=[headings.get('linkname')||headings.get('link')];
    else if(kind==='gates')for(const key of ['gnename','gne','gatewayname','gateway'])if(headings.has(key)){columns=[headings.get(key)];break;}
    const cells=[];const add=cell=>cells.push({value:cell.text,location:cell.address,row:cell.row,column:cell.col});
    sheet.eachRow(row=>{if(columns)for(const column of columns)add(row.getCell(column));else row.eachCell(add);});return cells;
  }
  if(!/\.(csv|txt)$/i.test(file.name))throw Error('Use CSV, TXT, or an Excel .xlsx file.');
  // CSV parser supports quoted fields, separators, BOM, and embedded newlines.
  const text=(await file.text()).replace(/^\uFEFF/,'');const cells=[];
  let value='',quoted=false,row=1,col=1;
  const push=()=>{cells.push({value,location:`Row ${row}, column ${col}`,row,column:col});value='';};
  for(let i=0;i<text.length;i++){const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&/[,;\t\n\r]/.test(c)){push();if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row++;col=1;}else col++;}
    else value+=c;
  }
  if(quoted)throw Error('The CSV contains an unclosed quoted field.');push();return cells;
}
function setData(links,gates,ignoredCount=0,message=''){
  const uniqueLinks=[...new Map(links.map(pair=>[pair.slice().sort().join('|'),pair])).values()];
  const uniqueGates=[...new Set(gates)];
  if(!uniqueLinks.length||!uniqueGates.length)throw Error('No valid links and gateways found. Example link: A12S345-C12X3456; gateway: C12X3456.');
  state={adj:Network.graph(uniqueLinks,uniqueGates),links:uniqueLinks,gates:uniqueGates,foundSite:''};
  state.assignment=Network.traverse(state.adj,state.gates);
  topologyView.clear();$('extraLinks').checked=true;
  $('impactSite').disabled=false;$('calculateImpact').disabled=false;$('impactResult').value='';$('copyImpact').disabled=true;$('copyLabel').textContent='Copy list';$('impactSummary').textContent='Enter a site name to calculate its impact.';
  $('gneSearch').value='';$('gneSearch').disabled=false;$('gneSelect').disabled=false;
  $('search').value='';$('search').disabled=false;$('gneSelect').value='';filterGateways();
  replaceItems($('siteNames'),(function*(){for(const name of [...state.adj.keys()].sort()){const option=document.createElement('option');option.value=name;yield option;}})());
  $('searchStatus').textContent='Enter a full site name to open its gateway map.';
  $('status').textContent='Network imported. Select a gateway or search for any site.'+(ignoredCount?` ${ignoredCount} non-matching cells skipped (including headers).`:'')+(message?' '+message:'');
  draw();
}
// A fragment avoids passing a file-sized array as function arguments.
function replaceItems(container,items){
  const fragment=document.createDocumentFragment();
  for(const item of items)fragment.appendChild(item);
  container.replaceChildren(fragment);
}
function filterGateways(){
  if(!state)return;
  const query=$('gneSearch').value.trim().toUpperCase(),previous=$('gneSelect').value;
  const matches=state.gates.filter(g=>g.includes(query)).sort();
  replaceItems($('gneSelect'),(function*(){yield new Option(matches.length?'Select a GNE gateway…':'No matching gateways','');for(const gate of matches)yield new Option(gate,gate);})());
  $('gneSelect').value=matches.includes(previous)?previous:'';
}
function draw(){
  if(!state)return;
  const {adj,gates,links}=state,connected=Network.traverse(adj,gates);
  $('nodesCount').textContent=adj.size;$('gatesCount').textContent=gates.length;$('offlineCount').textContent=adj.size-connected.visited.size;
  const selected=$('gneSelect').value,base=Network.branch(adj,gates,selected);
  $('viewSummary').textContent=selected?`${selected} · ${base.visited.size} assigned sites, including the gateway · Counters cover the whole network.`:'Select a gateway, or find any NE to open its assigned map.';
  const query=state.foundSite||'';
  if(selected){
    const extra=topologyView.render({key:selected,branch:base,links,query,showExtra:$('extraLinks').checked});
    $('extraCount').textContent=extra;
  }else{
    topologyView.clear();$('extraCount').textContent='0';
    const empty=document.createElement('p');empty.className='empty';empty.textContent=state.foundSite&&!state.assignment.owner.has(state.foundSite)?'This site has no assigned GNE route.':'Select a GNE or search for any site to view its map.';$('map').replaceChildren(empty);
  }
  for(const id of ['zoomIn','zoomOut','fitMap','centerMap','resetLayout','extraLinks'])$(id).disabled=!selected;
  $('fullscreen').disabled=!selected||!document.fullscreenEnabled;

}
$('load').onclick=async()=>{const button=$('load');button.disabled=true;
  cleanedFiles=null;$('downloadLinks').disabled=true;$('downloadGates').disabled=true;
  try{
  const [l,g]=await Promise.all([readCells($('links').files[0],'links'),readCells($('gates').files[0],'gates')]);
  const pl=Network.parseLinks(l),pg=Network.parseGates(g);
  const confirmed=Network.applyConnections(pl.valid,pg.valid.flat());
  prepareDownloads(confirmed.links,pg.valid.flat());
  const ignoredCount=pl.invalid.length+pg.invalid.length;
  setData(confirmed.links,pg.valid.flat(),ignoredCount,confirmed.added.length?'Applied your confirmed A33T001 ↔ A33CA01 connection. It is included in the cleaned links export.':'');
}catch(e){$('status').textContent='Import failed: '+e.message;}finally{button.disabled=false;}};
$('search').oninput=findSite;
$('gneSearch').oninput=()=>{clearSiteSearch();filterGateways();draw();if($('impactResult').value)calculateImpact();};
$('gneSelect').onchange=()=>{clearSiteSearch();draw();$('map').scrollTop=0;$('map').scrollLeft=0;if($('impactResult').value)calculateImpact();};

$('zoomIn').onclick=()=>topologyView.zoom(1.25);
$('zoomOut').onclick=()=>topologyView.zoom(1/1.25);
$('fitMap').onclick=()=>topologyView.fit();
$('centerMap').onclick=()=>topologyView.center();
$('resetLayout').onclick=()=>{topologyView.clear();draw();};
$('extraLinks').onchange=draw;
$('fullscreen').onclick=async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('mapPanel').requestFullscreen();}
  catch{$('status').textContent='Full screen is unavailable. Maximize the browser window or use the map controls.';}
};
new ResizeObserver(()=>{if(topologyView.svg){if(state?.foundSite&&topologyView.points.has(state.foundSite))topologyView.focus(state.foundSite);else topologyView.open();}}).observe($('map'));
document.addEventListener('fullscreenchange',()=>{$('fullscreenLabel').textContent=document.fullscreenElement?'Exit full screen':'Full screen';});

$('impactSite').oninput=()=>{$('impactResult').value='';$('copyImpact').disabled=true;$('copyLabel').textContent='Copy list';$('impactSummary').textContent='Choose Calculate impact to refresh the list.';};
function calculateImpact(){
  $('impactResult').value='';$('copyImpact').disabled=true;$('copyLabel').textContent='Copy list';
  if(!state){$('impactSummary').textContent='Import both files first.';return;}
  const site=Network.primaryName($('impactSite').value);
  if(!site||!state.adj.has(site)){$('impactSummary').textContent='Site not found in the imported network.';return;}
  const gateway=Network.impactRoot(state.adj,state.gates,site);
  const result=Network.impact(state.adj,state.gates,site);
  $('impactResult').value=result.join(',');$('copyImpact').disabled=!result.length;
  $('impactSummary').textContent=`${site} — Impact: ${result.length} ${result.length===1?'site':'sites'}, including this site. ${gateway?'Assigned GNE: '+gateway:'No GNE route is available to determine dependencies.'}`;
}
$('impactForm').onsubmit=e=>{e.preventDefault();calculateImpact();};

function clearSiteSearch(){
  $('search').value='';if(state)state.foundSite='';
  $('searchStatus').textContent='Enter a full site name to open its gateway map.';
}
function findSite(){
  if(!state)return;
  const raw=$('search').value.trim(),site=Network.primaryName(raw);
  state.foundSite='';
  if(!raw){$('searchStatus').textContent='Enter a full site name to open its gateway map.';draw();return;}
  if(!site||!state.adj.has(site)){
    $('gneSelect').value='';draw();
    $('searchStatus').textContent='No match yet. Enter a full site name or choose a suggestion.';return;
  }
  state.foundSite=site;
  const gateway=state.assignment.owner.get(site),hops=state.assignment.depth.get(site);
  if(!gateway){$('gneSelect').value='';draw();$('searchStatus').textContent=site+' has no route to any GNE in this data.';return;}
  $('gneSearch').value='';filterGateways();$('gneSelect').value=gateway;
  draw();topologyView.focus(site);
  $('searchStatus').textContent=`${site} → ${gateway} · ${hops} ${hops===1?'hop':'hops'}`;
}
for(const id of ['links','gates'])$(id).addEventListener('change',()=>{
  $(id+'Name').textContent=$(id).files[0]?.name||(id==='links'?'Choose a link or MLR file':'Choose your gateway list');
});
$('copyImpact').onclick=async()=>{
  const value=$('impactResult').value;if(!value)return;
  try{
    if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
    await navigator.clipboard.writeText(value);$('copyLabel').textContent='Copied';
  }catch{
    $('impactResult').focus();$('impactResult').select();
    let copied=false;try{copied=document.execCommand?.('copy')===true;}catch{}
    $('copyLabel').textContent=copied?'Copied':'Selected — press Ctrl+C';
  }
};
