(function(root){
  // Extract identifiers from descriptive cell text, ignoring separators and whitespace.
  function extract(value){
    const compact=String(value??'').toUpperCase().replace(/[-_\s]/g,'');
    // Do not truncate a longer numeric identifier into a valid-looking shorter one.
    return compact.match(/[ACO]\d{2}[SMX]\d{3,4}(?!\d)/g)||[];
  }
  function parseCells(cells,count){
    const valid=[], invalid=[];
    for(const cell of cells){
      const raw=String(cell.value??'').trim(); if(!raw)continue;
      const ids=extract(raw);
      if(ids.length===count && (count!==2||ids[0]!==ids[1]))valid.push(ids);
      else invalid.push({location:cell.location,value:raw});
    }
    return {valid,invalid};
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
  const api={extract,parseCells,graph,traverse,analyze,branch};
  if(typeof module!=='undefined')module.exports=api;else root.Network=api;
})(globalThis);
