(function(root){
  const separator='[_\\s-]*',prefix='[ACO]'+separator+'\\d'+separator+'\\d'+separator;
  const identifier='(?:O01[_\\s-]+)?CA[_\\s-]+BBM|'+prefix+'CA'+separator+'\\d{2}(?!\\d)|'+prefix+'(?:WX|SM|SU|[SMXTBWR])'+separator+'\\d{3,4}(?!\\d)';
  // Explicit user-approved corrections; never infer a numbered CA name from a place name.
  const aliases=new Map([['O01CA_AOULEF','O01CA03'],['A11CA-AIN-GUEZZAM','A11CA03'],['A33CABORDJALHAOUAS','A33CA04'],['CAATAINGUEZZAM','A11CA03'],['CA_AT_BBM','CA-BBM'],['A33CABORJALHAOUES','A33CA04'],['O01CA_TIMIMOUNE','O01CA02'],['O46WX158','O46X158'],['O46WX159','O46X159'],['O38X090','O38R050']]);
  const aliasPatterns=[...aliases].map(([original,corrected])=>[new RegExp(original.split('').map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s*')+(/\d$/.test(original)?'(?!\\d)':''),'g'),corrected]);
  function normalize(value){
    let compact=String(value??'').trim().toUpperCase().replace(/T\s*S\s*U(?=[_\s-]*\d)/g,'SU');
    for(const [pattern,corrected] of aliasPatterns)compact=compact.replace(pattern,corrected);
    compact=compact
      .replace(/^A16[_\s-]*SCE1[_\s-]*HYDRA[_\s-]*A16X1577/,'A16X1577')
      .replace(/^ERMA[_\s-]*BARAKI[_\s-]*A16M1230/,'A16M1230')
      .replace(/^CDS[_\s-]*EL[_\s-]*BIAR[_\s-]*A16T120\s*\(A16M632\)/,'A16M632')
      .replace(/^EL[_\s-]*KENDI[_\s-]*RAHMANIA[_\s-]*015/,'A16SCE1-ELKENDIRAHMANIA015')
      .replace(/^(?:(?:E[_\s-]*BAND|EB(?:AND)?\d*|TO)[_\s-]+)+/,'')
      .replace(/^5A16/,'A16').replace(/^04/,'C04').replace(/^0/,'O').replace(/^16/,'A16')
      .replace(/^09X170/i,'A09X170').replace(/^O9X170/,'A09X170')
      .replace(/^22X163/,'O22X163').replace(/^O4X106/,'C04X106').replace(/^A6S496/,'A06S496')
      .replace(/^AAAX030/,'A44X030').replace(/^A16XT1999/,'A16X1999')
      .replace(new RegExp('^('+prefix+')(?:SEC1|SE0?1|SC[_\\s-]*E01)'),(_,region)=>canonical(region)+'SCE1');
    return compact;
  }
  function canonical(name){const compact=name.replace(/[-_\s]/g,'');return ['CABBM','O01CABBM'].includes(compact)?'CA-BBM':compact;}
  const headings=new Set(['gne','gnename','gateway','gatewayname','link','linkname','sourcenename','sinknename','البوابة','اسمالبوابة','اسمالرابط']);
  function specialName(value){
    if(!value||headings.has(value.toLowerCase().replace(/[\s_-]/g,'')))return '';
    // Equipment suffixes identify radios, not separate sites. Keep unknown site
    // names rather than guessing a standard identifier from their descriptions.
    let name=value.normalize('NFC').trim();
    let previous;
    do{previous=name;name=name.replace(/[_\s-]+(?:NE(?:[_\s-]*(?:\d+|ODU[_\s-]*\d+))?|(?:E[_\s-]*BAND|EB(?:AND)?)\d*(?:[_\s-]*[HV]\d*)?|IDU[_\s-]*\d+|[HV]\d*)[_\s-]*$/,'').trim();}while(name!==previous);
    name=name.replace(/\([^)]*\).*$/,'').trim();
    const special=name.match(/^([ACO][_\s-]*\d[_\s-]*\d)[_\s-]*(S[_\s-]*C[_\s-]*E?[_\s-]*\d+|S[_\s-]*E[_\s-]*C?[_\s-]*\d+)[_\s-]*(.+)$/);
    if(special)return canonical(special[1]+special[2])+'-'+special[3].replace(/[-_\s]/g,'');
    return (name||value).replace(/[-_\s]/g,'');
  }
  // Preserve suffix boundaries: O31X400_6900 must not become O31X4006900.
  function extract(value){
    const compact=normalize(value);
    return (compact.match(new RegExp(identifier,'g'))||[]).map(canonical);
  }
  function primaryName(value){
    const original=String(value??'').trim();
    if(/^NE/i.test(original))return original;
    const compact=normalize(value);
    const standard=compact.match(new RegExp('^(?:'+identifier+')'))?.[0];
    return standard?canonical(standard):specialName(compact);
  }
  function linkNames(value){
    const compact=normalize(value);
    if(!compact||headings.has(compact.toLowerCase().replace(/[\s_-]/g,'')))return [];
    // Explicit endpoint separators work even when both names are nonstandard.
    const explicit=compact.split(/\s*(?:↔|→|<->|\|)\s*|\s+-\s+/);
    if(explicit.length===2)return explicit.map(primaryName);
    // In legacy NE_A-NE_B cells, keep hyphens inside special names. An endpoint
    // boundary is a hyphen followed by a full region prefix or CA-BBM.
    const boundary=new RegExp('[-]+(?=(?:'+prefix+'[A-Z]|CA[_\\s-]+BBM))','g');
    const candidates=[...compact.matchAll(boundary)];
    if(candidates.length===1){
      const split=candidates[0];
      return [primaryName(compact.slice(0,split.index)),primaryName(compact.slice(split.index+split[0].length))];
    }
    if(candidates.length>1)return [];
    return extract(compact);
  }
  function parseCells(cells,count){
    const valid=[], invalid=[];
    for(const cell of cells){
      const raw=String(cell.value??'').trim(); if(!raw)continue;
      const primary=count===1?primaryName(raw):'';
      const ids=count===1?(primary?[primary]:[]):linkNames(raw);
      if(ids.length===count && ids.every(Boolean) && (count!==2||ids[0]!==ids[1]))valid.push(ids);
      else invalid.push({location:cell.location,value:raw});
    }
    return {valid,invalid};
  }
  function parseGates(cells){
    const headers=new Set(['gne','gnename','gateway','gatewayname','اسمالبوابة','البوابة']);
    const header=cells.find(c=>headers.has(String(c.value??'').trim().toLowerCase().replace(/[\s_-]/g,'')));
    const column=header?.column??cells.find(c=>c.column!=null)?.column??1;
    const selected=cells.filter(c=>(c.column??1)===column&&(!header||c.row==null||c.row>=header.row));
    const result=parseCells(selected,1),seen=new Set();
    result.review=[];
    for(const cell of selected){
      const raw=String(cell.value??'').trim();if(!raw)continue;
      const name=primaryName(raw),status=!name?'غير مطابق':seen.has(name)?'مكرر بعد التنظيف':'مقبول';
      if(name)seen.add(name);
      result.review.push([cell.location||'',raw,name,status]);
    }
    result.column=column;
    return result;
  }
  function parseLinks(cells){
    const key=c=>String(c.value??'').trim().toLowerCase().replace(/[\s_-]/g,'');
    const source=cells.find(c=>key(c)==='sourcenename'),sink=cells.find(c=>key(c)==='sinknename'),title=cells.find(c=>['link','linkname'].includes(key(c)));
    if(source&&sink){
      const rows=new Map(),valid=[],invalid=[];
      for(const cell of cells){
        if(cell.row<=Math.max(source.row,sink.row)||![source.column,sink.column,title?.column].includes(cell.column))continue;
        if(!rows.has(cell.row))rows.set(cell.row,{});
        rows.get(cell.row)[cell.column===source.column?'source':cell.column===sink.column?'sink':'title']=cell;
      }
      for(const [row,pair] of rows){
        let a=primaryName(pair.source?.value),b=primaryName(pair.sink?.value);
        if(!a&&!b){const fallback=linkNames(pair.title?.value);if(fallback.length===2)[a,b]=fallback;}
        if(a&&b&&a!==b)valid.push([a,b]);
        else invalid.push({location:`صف ${row}`,value:`${pair.source?.value??''} ↔ ${pair.sink?.value??''}`});
      }
      return {valid,invalid,mode:'endpoints'};
    }
    const header=cells.find(c=>['link','linkname','اسمالرابط'].includes(key(c))),column=header?.column??cells.find(c=>c.column!=null)?.column??1;
    return {...parseCells(cells.filter(c=>(c.column??1)===column),2),mode:'name'};
  }
  function graph(links,gates){
    const adjacency=new Map();const add=n=>{if(!adjacency.has(n))adjacency.set(n,new Set());};
    for(const [a,b] of links){add(a);add(b);adjacency.get(a).add(b);adjacency.get(b).add(a);}
    gates.forEach(add);return adjacency;
  }
  function applyConnections(links,gates){
    const source='A33T001',target='A33CA01';
    const relevant=gates.includes(target)&&links.some(pair=>pair.includes(source));
    const exists=links.some(([a,b])=>a===source&&b===target||a===target&&b===source);
    const added=relevant&&!exists?[[source,target]]:[];
    return {links:added.length?links.concat(added):links,added};
  }
  function traverse(adj,gates,failed=''){
    const visited=new Set(),parent=new Map(),depth=new Map(),owner=new Map(),queue=[];
    for(const gate of gates){if(gate===failed||visited.has(gate))continue;visited.add(gate);queue.push(gate);depth.set(gate,0);owner.set(gate,gate);}
    for(let i=0;i<queue.length;i++){const a=queue[i];for(const b of adj.get(a)||[]){if(b===failed||visited.has(b))continue;visited.add(b);parent.set(b,a);depth.set(b,depth.get(a)+1);owner.set(b,owner.get(a));queue.push(b);}}
    return {visited,parent,depth,owner};
  }
  function analyze(adj,gates,failed=''){
    const baseline=traverse(adj,gates),current=traverse(adj,gates,failed);
    const affected=[...baseline.visited].filter(n=>n!==failed&&!current.visited.has(n));
    const offline=[...adj.keys()].filter(n=>!baseline.visited.has(n));
    return {baseline,current,affected,offline};
  }
  // One multi-source BFS assigns every NE to exactly one GNE. FIFO root order
  // breaks equal-hop ties using the first occurrence in the uploaded GNE file.
  function branch(adj,gates,selected){
    const visited=new Set(),parent=new Map(),depth=new Map();
    if(!gates.includes(selected))return {visited,parent,depth};
    const assigned=traverse(adj,gates);
    for(const node of assigned.visited)if(assigned.owner.get(node)===selected){
      visited.add(node);depth.set(node,assigned.depth.get(node));
      if(assigned.parent.has(node))parent.set(node,assigned.parent.get(node));
    }
    return {visited,parent,depth};
  }
  function impactRoot(adj,gates,site){
    return traverse(adj,gates).owner.get(site)||'';
  }
  function impact(adj,gates,site){
    if(!adj.has(site))return [];
    // Use the same fixed main-path tree as the map. Additional physical links
    // provide no service protection and cannot bypass an outage.
    const assigned=traverse(adj,gates),children=new Map();
    for(const [child,parent] of assigned.parent){
      if(!children.has(parent))children.set(parent,[]);
      children.get(parent).push(child);
    }
    const impacted=[site];
    for(let i=0;i<impacted.length;i++)for(const child of children.get(impacted[i])||[])impacted.push(child);
    return [site,...impacted.slice(1).sort()];
  }
  const api={impactRoot,impact,extract,primaryName,parseCells,parseGates,parseLinks,applyConnections,graph,traverse,analyze,branch};
  if(typeof module!=='undefined')module.exports=api;else root.Network=api;
})(globalThis);
