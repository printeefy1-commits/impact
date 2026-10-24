(function(root){
  const identifier='(?:O01[-_]+)?CA[-_]+BBM|[ACO][_-]*\\d[_-]*\\d[_-]*CA[_-]*\\d{2}(?!\\d)|[ACO][_-]*\\d[_-]*\\d[_-]*(?:SU|[SMXT])[_-]*\\d{3,4}(?!\\d)';
  // Explicit user-approved corrections; never infer a numbered CA name from a place name.
  const aliases=new Map([['O01CA_AOULEF','O01CA03'],['A11CA-AIN-GUEZZAM','A11CA03'],['A33CABORDJALHAOUAS','A33CA04']]);
  function normalize(value){
    let compact=String(value??'').toUpperCase().replace(/\s/g,'');
    for(const [original,corrected] of aliases)compact=compact.split(original).join(corrected);
    return compact;
  }
  function canonical(name){return /^(?:O01[-_]+)?CA[-_]+BBM$/.test(name)?'CA-BBM':name.replace(/[-_]/g,'');}
  // Preserve suffix boundaries: O31X400_6900 must not become O31X4006900.
  function extract(value){
    const compact=normalize(value);
    return (compact.match(new RegExp(identifier,'g'))||[]).map(canonical);
  }
  function primaryName(value){
    const compact=normalize(value);
    return canonical(compact.match(new RegExp('^(?:'+identifier+')'))?.[0]||'');
  }
  function parseCells(cells,count){
    const valid=[], invalid=[];
    for(const cell of cells){
      const raw=String(cell.value??'').trim(); if(!raw)continue;
      const primary=count===1?primaryName(raw):'';
      const ids=count===1?(primary?[primary]:[]):extract(raw);
      if(ids.length===count && (count!==2||ids[0]!==ids[1]))valid.push(ids);
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
  function graph(links,gates){
    const adjacency=new Map();const add=n=>{if(!adjacency.has(n))adjacency.set(n,new Set());};
    for(const [a,b] of links){add(a);add(b);adjacency.get(a).add(b);adjacency.get(b).add(a);}
    gates.forEach(add);return adjacency;
  }
  function traverse(adj,gates,failed=''){
    const visited=new Set(),parent=new Map(),depth=new Map(),owner=new Map(),queue=[];
    for(const gate of gates){if(gate===failed)continue;visited.add(gate);queue.push(gate);depth.set(gate,0);owner.set(gate,gate);}
    for(let i=0;i<queue.length;i++){const a=queue[i];for(const b of adj.get(a)||[]){if(b===failed||visited.has(b))continue;visited.add(b);parent.set(b,a);depth.set(b,depth.get(a)+1);owner.set(b,owner.get(a));queue.push(b);}}
    return {visited,parent,depth,owner};
  }
  function analyze(adj,gates,failed=''){
    const baseline=traverse(adj,gates),current=traverse(adj,gates,failed);
    const affected=[...baseline.visited].filter(n=>n!==failed&&!current.visited.has(n));
    const offline=[...adj.keys()].filter(n=>!baseline.visited.has(n));
    return {baseline,current,affected,offline};
  }
  function branch(adj,gates,selected){
    const visited=new Set(),parent=new Map(),depth=new Map();
    if(!gates.includes(selected))return {visited,parent,depth};
    const boundaries=new Set(gates),queue=[selected];visited.add(selected);depth.set(selected,0);
    for(let i=0;i<queue.length;i++)for(const next of adj.get(queue[i])||[]){
      if(visited.has(next)||boundaries.has(next))continue;
      visited.add(next);parent.set(next,queue[i]);depth.set(next,depth.get(queue[i])+1);queue.push(next);
    }
    return {visited,parent,depth};
  }
  const api={extract,primaryName,parseCells,parseGates,graph,traverse,analyze,branch};
  if(typeof module!=='undefined')module.exports=api;else root.Network=api;
})(globalThis);
