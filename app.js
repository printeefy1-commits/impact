const $=id=>document.getElementById(id);
let state=null;
const topologyView=new Topology.View($('map'),k=>{$('zoomLabel').textContent=Math.round(k*100)+'%';});
let cleanedFiles=null;
let gneReview=null;
function prepareDownloads(links,gates){
  cleanedFiles={
    links:[...new Set(links.map(pair=>pair.slice().sort().join('-')))],
    gates:[...new Set(gates)]
  };
  $('downloadLinks').disabled=!cleanedFiles.links.length;
  $('downloadGates').disabled=!cleanedFiles.gates.length;
  $('exportSummary').textContent=`ملفات التنزيل: ${cleanedFiles.links.length} رابط فريد و${cleanedFiles.gates.length} بوابة فريدة. تُصدّر البيانات الصالحة فقط؛ راجع الخلايا المستبعدة. ملفاتك الأصلية لا تتغير.`;
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
$('downloadReview').onclick=()=>{
  if(!gneReview)return;
  const quote=value=>'"'+String(value).replace(/^(\s*[=+@-])/,'\'$1').replace(/"/g,'""')+'"';
  const rows=[['الموقع في المصدر','الاسم الأصلي','الاسم المنظف','الحالة'],...gneReview];
  const blob=new Blob(['\uFEFF',rows.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gne-name-comparison.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
};
async function readCells(file){
  if(!file)throw Error('اختر ملف الروابط وملف GNE أولًا.');
  if(file.size>10*1024*1024)throw Error('الحد الأقصى لكل ملف هو 10 ميغابايت.');
  if(/\.xlsx$/i.test(file.name)){
    if(!window.ExcelJS)throw Error('تعذر تحميل قارئ Excel. أعد تحميل الصفحة أو استخدم CSV.');
    const book=new ExcelJS.Workbook();await book.xlsx.load(await file.arrayBuffer());
    const sheet=book.worksheets[0];if(!sheet)throw Error('ملف Excel لا يحتوي ورقة بيانات.');
    const cells=[];sheet.eachRow(row=>row.eachCell(cell=>cells.push({value:cell.text,location:cell.address,row:cell.row,column:cell.col})));return cells;
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
function setData(links,gates,issues=[],message=''){
  const uniqueLinks=[...new Map(links.map(pair=>[pair.slice().sort().join('|'),pair])).values()];
  const uniqueGates=[...new Set(gates)];
  if(!uniqueLinks.length||!uniqueGates.length)throw Error('لم نجد روابط وبوابات صالحة. النمط المطلوب مثل A12S345-C12X3456 وقائمة GNE مثل C12X3456.');
  state={adj:Network.graph(uniqueLinks,uniqueGates),links:uniqueLinks,gates:uniqueGates};
  topologyView.clear();$('extraLinks').checked=false;
  $('gneSearch').value='';$('gneSearch').disabled=false;$('gneSelect').disabled=false;
  $('search').value='';$('gneSelect').value='';filterGateways();
  replaceItems($('failure'),(function*(){yield new Option('بدون عطل','');for(const n of [...state.adj.keys()].sort())yield new Option(n,n);})());
  const previewLimit=200;
  $('importReport').textContent=`${uniqueLinks.length} رابط فريد، ${uniqueGates.length} بوابة. تم تجاهل ${issues.length} خلية غير مطابقة (تشمل العناوين). ${issues.length>previewLimit?`تُعرض أول ${previewLimit} خلية مستبعدة فقط؛ جميع الخلايا الصالحة تدخل في التحليل.`:''} ${message}`;
  replaceItems($('issues'),issues.slice(0,previewLimit).map(issue=>{const p=document.createElement('p');p.textContent=issue;return p;}));
  $('status').textContent=issues.length?'تم إنشاء الخريطة. راجع الخلايا المستبعدة أسفل الصفحة للتأكد من اكتمال البيانات.':'الخريطة جاهزة. اختر عنصرًا لمحاكاة تعطله.';
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
  const failed=$('failure').value,{adj,gates,links}=state;
  const a=Network.analyze(adj,gates,failed),affected=new Set(a.affected),offline=new Set(a.offline);
  $('nodesCount').textContent=adj.size;$('gatesCount').textContent=gates.length;$('impactCount').textContent=affected.size;$('offlineCount').textContent=offline.size;
  const selected=$('gneSelect').value,base=Network.branch(adj,gates,selected);
  $('viewSummary').textContent=selected?`${selected} · ${base.visited.size} عنصر مع البوابة · ${[...base.visited].filter(n=>affected.has(n)).length} متأثر بالعطل في هذا الفرع. الإحصاءات العلوية وحساب الأعطال للشبكة كاملة.`:'اختر بوابة GNE من القائمة. يمكنك البحث باسمها لتصفية الخيارات. الإحصاءات العلوية للشبكة كاملة.';
  const query=$('search').value.trim().toUpperCase();
  function status(n){return n===failed?'متعطل':affected.has(n)?'متأثر بالعطل':offline.has(n)?'غير متصل أصلًا':gates.includes(n)?'بوابة GNE':'متصل';}
  if(selected){
    const extra=topologyView.render({key:selected,branch:base,links,failed,affected,query,showExtra:$('extraLinks').checked,onSelect:n=>{$('failure').value=n;draw();}});
    $('extraCount').textContent=extra;
  }else{
    topologyView.clear();$('extraCount').textContent='0';
    const empty=document.createElement('p');empty.className='empty';empty.textContent='اختر بوابة GNE لعرض الخريطة';$('map').replaceChildren(empty);
  }
  for(const id of ['zoomIn','zoomOut','fitMap','centerMap','resetLayout','extraLinks'])$(id).disabled=!selected;
  $('fullscreen').disabled=!selected||!document.fullscreenEnabled;
  replaceItems($('nodeList'),(function*(){for(const n of [...base.visited].sort()){if(query&&!n.includes(query))continue;const row=document.createElement('div');row.className='node-row';const code=document.createElement('code');code.textContent=n;const text=document.createElement('span');text.textContent=status(n);row.append(code,text);yield row;}})());
  if(failed)$('status').textContent=`محاكاة تعطل ${failed}: ${affected.size} عنصر يفقد الاتصال بسبب هذا العطل، باستثناء العنصر المتعطل نفسه. ${offline.size} عنصر غير متصل أصلًا.`;
}
$('load').onclick=async()=>{const button=$('load');button.disabled=true;
  cleanedFiles=null;$('downloadLinks').disabled=true;$('downloadGates').disabled=true;
  gneReview=null;$('downloadReview').disabled=true;
  $('exportSummary').textContent='لم تُجهّز ملفات تنزيل لهذا الاستيراد بعد.';
  try{
  const [l,g]=await Promise.all([readCells($('links').files[0]),readCells($('gates').files[0])]);
  const pl=Network.parseCells(l,2),pg=Network.parseGates(g);
  prepareDownloads(pl.valid,pg.valid.flat());
  gneReview=pg.review;$('downloadReview').disabled=false;
  const issues=[...pl.invalid.map(x=>`ملف الروابط · ${x.location}: ${x.value}`),...pg.invalid.map(x=>`ملف GNE · ${x.location}: ${x.value}`)];
  setData(pl.valid,pg.valid.flat(),issues,`قراءة أسماء GNE من العمود ${pg.column} فقط، والاحتفاظ بالاسم الأساسي قبل الوصف. تظهر البوابات غير الموجودة في الروابط منفردة.`);
}catch(e){$('status').textContent='لم يتم الاستيراد: '+e.message;}finally{button.disabled=false;}};
$('demo').onclick=()=>{gneReview=null;$('downloadReview').disabled=true;cleanedFiles=null;$('downloadLinks').disabled=true;$('downloadGates').disabled=true;$('exportSummary').textContent='هذا مثال تجريبي. ارفع ملفيك لتنزيل بياناتك بعد التنظيف.';setData([['A01S001','C01M001'],['C01M001','O01X001'],['C01M001','A02S002'],['A02S002','O02M002'],['C02X002','O02M002'],['A03X003','C03S003']],['A01S001','C02X002'],[],'بيانات تجريبية وليست بيانات ملفاتك.');};
$('failure').onchange=()=>{draw();if(!$('failure').value)$('status').textContent='أُعيد الاتصال؛ لا توجد محاكاة عطل فعالة.';};
$('reset').onclick=()=>{$('failure').value='';draw();$('status').textContent='أُعيد الاتصال؛ لا توجد محاكاة عطل فعالة.';};
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
new ResizeObserver(()=>{if(topologyView.svg)topologyView.fit();}).observe($('map'));
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'إنهاء ملء الشاشة':'ملء الشاشة';});
