(function(root){
  const tau=2*Math.PI;
  function circular(angle){return ((angle%tau)+tau)%tau;}
  // Open up crowded gaps using the spare angle elsewhere on the same ring.
  // Keeping the circular order retains the subtree arrangement without forcing
  // a sparse ring to an enormous radius because of a very narrow inherited sector.
  function separate(nodes,angles,radius,gap){
    if(nodes.length<2)return;
    const sorted=nodes.map(name=>({name,angle:circular(angles.get(name))})).sort((a,b)=>a.angle-b.angle);
    const minimum=2*Math.asin(gap/(2*radius));let largest=-1,cut=0,closest=tau;
    for(let i=0;i<sorted.length;i++){
      const next=i+1<sorted.length?sorted[i+1].angle:sorted[0].angle+tau,d=next-sorted[i].angle;
      closest=Math.min(closest,d);if(d>largest){largest=d;cut=(i+1)%sorted.length;}
    }
    if(closest>=minimum-1e-12)return;
    const ordered=sorted.slice(cut).concat(sorted.slice(0,cut)),targets=[];
    let turn=0,last=-Infinity;
    for(const item of ordered){let target=item.angle+turn;if(target<last){turn+=tau;target+=tau;}targets.push(target);last=target;}
    const slack=[];let total=0;
    for(let i=0;i<targets.length;i++){const d=i+1<targets.length?targets[i+1]-targets[i]:targets[0]+tau-targets[i],s=Math.max(0,d-minimum);slack.push(s);total+=s;}
    const remaining=Math.max(0,tau-minimum*nodes.length),positions=[0];
    for(let i=0;i+1<targets.length;i++)positions.push(positions[i]+minimum+(total?slack[i]*remaining/total:0));
    let offset=0;for(let i=0;i<targets.length;i++)offset+=targets[i]-positions[i];offset/=targets.length;
    for(let i=0;i<ordered.length;i++)angles.set(ordered[i].name,offset+positions[i]);
  }
  // Each subtree occupies an angular sector. All traversals are iterative so a
  // long microwave chain does not consume the JavaScript call stack.
  function layout(branch){
    const names=[...branch.visited];
    if(!names.length)return {points:new Map(),width:280,height:280};
    const children=new Map(names.map(n=>[n,[]]));
    for(const [child,parent] of branch.parent)if(children.has(parent)&&children.has(child))children.get(parent).push(child);
    for(const list of children.values())list.sort((a,b)=>String(a).localeCompare(String(b),'en'));
    const roots=names.filter(n=>!branch.parent.has(n)).sort((a,b)=>String(a).localeCompare(String(b),'en'));
    const ordered=names.slice().sort((a,b)=>(branch.depth.get(b)||0)-(branch.depth.get(a)||0));
    const weight=new Map();
    for(const name of ordered){let total=0;for(const child of children.get(name))total+=weight.get(child)||1;weight.set(name,Math.max(1,total));}
    const angles=new Map(),levels=new Map(),queue=[];
    const anchor=roots[0]??names[0];angles.set(anchor,-Math.PI/2);
    const first=children.get(anchor).concat(roots.slice(1));
    const step=2*Math.PI/Math.max(1,first.length),sector=Math.min(step,Math.PI*.85);
    for(let i=0;i<first.length;i++)queue.push({name:first[i],depth:1,start:-Math.PI/2+i*step-sector/2,end:-Math.PI/2+i*step+sector/2});
    for(let i=0;i<queue.length;i++){
      const item=queue[i],angle=(item.start+item.end)/2;angles.set(item.name,angle);
      if(!levels.has(item.depth))levels.set(item.depth,[]);levels.get(item.depth).push(item.name);
      const list=children.get(item.name);let total=0;for(const child of list)total+=weight.get(child)||1;
      let start=item.start;
      for(const child of list){const end=start+(item.end-item.start)*(weight.get(child)||1)/total;queue.push({name:child,depth:item.depth+1,start,end});start=end;}
    }
    const originalAngles=new Map(angles),gap=210,radii=new Map();let previous=0;
    for(const [depth,nodes] of levels){
      for(const name of nodes){const parent=branch.parent.get(name);if(parent!=null&&angles.has(parent)){const delta=angles.get(parent)-originalAngles.get(parent);angles.set(name,originalAngles.get(name)+Math.atan2(Math.sin(delta),Math.cos(delta)));}}
      let radius=Math.max(260,previous+220);
      if(nodes.length>1){
        const sorted=nodes.map(n=>((angles.get(n)%(2*Math.PI))+2*Math.PI)%(2*Math.PI)).sort((a,b)=>a-b);
        let closest=2*Math.PI;
        for(let i=0;i<sorted.length;i++)closest=Math.min(closest,i+1<sorted.length?sorted[i+1]-sorted[i]:sorted[0]+2*Math.PI-sorted[i]);
        // Radius determines chord distance, not only arc distance.
        const compactLimit=Math.max(radius,nodes.length*gap/(Math.PI*.8));
        radius=Math.min(compactLimit,Math.max(radius,gap/(2*Math.sin(Math.max(closest,1e-10)/2))));
        separate(nodes,angles,radius,gap);
      }
      radii.set(depth,radius);previous=radius;
    }
    const center=Math.max(140,previous+110),size=center*2,points=new Map([[anchor,{x:center,y:center}]]);
    for(const [depth,nodes] of levels)for(const name of nodes){const angle=angles.get(name),r=radii.get(depth);points.set(name,{x:center+r*Math.cos(angle),y:center+r*Math.sin(angle)});}
    return {points,width:Math.max(280,size),height:Math.max(280,size)};
  }
  const api={layout};if(typeof module!=='undefined')module.exports=api;else root.RadialLayout=api;
})(globalThis);
