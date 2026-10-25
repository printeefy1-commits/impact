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
  if(!file)throw Error('اختر ملف الروابط وملف GNE أولًا.');
  if(file.size>10*1024*1024)throw Error('الحد الأقصى لكل ملف هو 10 ميغابايت.');
  if(/\.xlsx$/i.test(file.name)){
    if(!window.ExcelJS)throw Error('تعذر تحميل قارئ Excel. أعد تحميل الصفحة أو استخدم CSV.');
    const book=new ExcelJS.Workbook();await book.xlsx.load(await file.arrayBuffer());
    const sheet=book.worksheets[0];if(!sheet)throw Error('ملف Excel لا يحتوي ورقة بيانات.');
    const headings=new Map();sheet.getRow(1).eachCell(cell=>headings.set(cell.text.trim().toLowerCase().replace(/[\s_-]/g,''),cell.col));
    let columns=null;
    if(kind==='links'&&headings.has('sourcenename')&&headings.has('sinknename'))columns=[headings.get('sourcenename'),headings.get('sinknename')];
    else if(kind==='links'&&(headings.has('linkname')||headings.has('link')))columns=[headings.get('linkname')||headings.get('link')];
    else if(kind==='gates')for(const key of ['gnename','gne','gatewayname','gateway'])if(headings.has(key)){columns=[headings.get(key)];break;}
    const cells=[];const add=cell=>cells.push({value:cell.text,location:cell.address,row:cell.row,column:cell.col});
    sheet.eachRow(row=>{if(columns)for(const column of columns)add(row.getCell(column));else row.eachCell(add);});return cells;
  }
  if(!/\.(csv|txt)$/i.test(file.name))throw Error('استخدم CSV أو TXT أو Excel بصيغة xlsx.');
  // CSV parser supports quoted fields, separators, BOM, and embedded newlines.
  const text=(await file.text()).replace(/^\uFEFF/,'');const cells=[];
  let value='',quoted=false,row=1,col=1;
  const push=()=>{cells.push({value,location:`صف ${row}، عمود ${col}`,row,column:col});value='';};
  for(let i=0;i<text.length;i++){const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&/[,;\t\n\r]/.test(c)){push();if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row++;col=1;}else col++;}
    else value+=c;
  }
  if(quoted)throw Error('يوجد حقل نصي غير مغلق بعلامة اقتباس في CSV.');push();return cells;
}
function setData(links,gates,ignoredCount=0,message=''){
  const uniqueLinks=[...new Map(links.map(pair=>[pair.slice().sort().join('|'),pair])).values()];
  const uniqueGates=[...new Set(gates)];
  if(!uniqueLinks.length||!uniqueGates.length)throw Error('لم نجد روابط وبوابات صالحة. النمط المطلوب مثل A12S345-C12X3456 وقائمة GNE مثل C12X3456.');
  state={adj:Network.graph(uniqueLinks,uniqueGates),links:uniqueLinks,gates:uniqueGates};
  topologyView.clear();$('extraLinks').checked=true;
  $('impactSite').disabled=false;$('calculateImpact').disabled=false;$('impactResult').value='';$('impactSummary').textContent='أدخل اسم الموقع لحساب Impact.';
  $('gneSearch').value='';$('gneSearch').disabled=false;$('gneSelect').disabled=false;
  $('search').value='';$('gneSelect').value='';filterGateways();
  $('status').textContent='تم الاستيراد. اختر بوابة GNE لعرض خريطتها.'+(ignoredCount?` تم تجاهل ${ignoredCount} خلية غير مطابقة (بما فيها العناوين).`:'')+(message?' '+message:'');
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
  replaceItems($('gneSelect'),(function*(){yield new Option(matches.length?'اختر بوابة GNE…':'لا توجد بوابات مطابقة','');for(const gate of matches)yield new Option(gate,gate);})());
  $('gneSelect').value=matches.includes(previous)?previous:'';
}
function draw(){
  if(!state)return;
  const {adj,gates,links}=state,connected=Network.traverse(adj,gates);
  $('nodesCount').textContent=adj.size;$('gatesCount').textContent=gates.length;$('offlineCount').textContent=adj.size-connected.visited.size;
  const selected=$('gneSelect').value,base=Network.branch(adj,gates,selected);
  $('viewSummary').textContent=selected?`${selected} · ${base.visited.size} عنصر مع البوابة · الإحصاءات العلوية للشبكة كاملة.`:'اختر بوابة GNE من القائمة. يمكنك البحث باسمها لتصفية الخيارات. الإحصاءات العلوية للشبكة كاملة.';
  const query=$('search').value.trim().toUpperCase();
  if(selected){
    const extra=topologyView.render({key:selected,branch:base,links,query,showExtra:$('extraLinks').checked});
    $('extraCount').textContent=extra;
  }else{
    topologyView.clear();$('extraCount').textContent='0';
    const empty=document.createElement('p');empty.className='empty';empty.textContent='اختر بوابة GNE لعرض الخريطة';$('map').replaceChildren(empty);
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
  setData(confirmed.links,pg.valid.flat(),ignoredCount,confirmed.added.length?'أُضيف الرابط A33T001 ↔ A33CA01 وفق تأكيدك، وهو مضمن في ملف الروابط المنظّفة.':'');
}catch(e){$('status').textContent='لم يتم الاستيراد: '+e.message;}finally{button.disabled=false;}};
$('search').oninput=draw;
$('gneSearch').oninput=()=>{filterGateways();draw();};
$('gneSelect').onchange=()=>{$('search').value='';draw();$('map').scrollTop=0;$('map').scrollLeft=0;};

$('zoomIn').onclick=()=>topologyView.zoom(1.25);
$('zoomOut').onclick=()=>topologyView.zoom(1/1.25);
$('fitMap').onclick=()=>topologyView.fit();
$('centerMap').onclick=()=>topologyView.center();
$('resetLayout').onclick=()=>{topologyView.clear();draw();};
$('extraLinks').onchange=draw;
$('fullscreen').onclick=async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('mapPanel').requestFullscreen();}
  catch{$('status').textContent='تعذر فتح ملء الشاشة. يمكنك تكبير نافذة المتصفح واستخدام أزرار الخريطة.';}
};
new ResizeObserver(()=>{if(topologyView.svg)topologyView.open();}).observe($('map'));
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'إنهاء ملء الشاشة':'ملء الشاشة';});

$('impactSite').oninput=()=>{$('impactResult').value='';$('impactSummary').textContent='اضغط عرض Impact لحساب النتيجة.';};
$('impactForm').onsubmit=e=>{
  e.preventDefault();$('impactResult').value='';
  if(!state){$('impactSummary').textContent='استورد الملفين أولًا.';return;}
  const site=Network.primaryName($('impactSite').value);
  if(!site||!state.adj.has(site)){$('impactSummary').textContent='الموقع غير موجود في البيانات المستوردة.';return;}
  const result=Network.impact(state.adj,state.gates,site);
  $('impactResult').value=result.join('\n');
  $('impactSummary').textContent=`${site} — Impact: ${result.length} موقعًا، شاملًا الموقع نفسه.`;
};
