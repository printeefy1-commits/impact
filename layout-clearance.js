(function(root){
  const orient=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  function intersects(a,b,r){
    let low=0,high=1;
    for(const [start,delta,min,max] of [[a.x,b.x-a.x,r.x,r.x+r.width],[a.y,b.y-a.y,r.y,r.y+r.height]]){
      if(Math.abs(delta)<1e-10){if(start<min||start>max)return false;}
      else{let t1=(min-start)/delta,t2=(max-start)/delta;if(t1>t2)[t1,t2]=[t2,t1];low=Math.max(low,t1);high=Math.min(high,t2);if(low>high)return false;}
    }
    return high>1e-8&&low<1-1e-8;
  }
  function obstacles(points,parts,edges){
    const found=[];
    for(const edge of edges)for(const [name,boxes] of parts){
      if(edge.a===name||edge.b===name)continue;const p=points.get(name);
      if(boxes.some(r=>intersects(points.get(edge.a),points.get(edge.b),{x:p.x+r.x,y:p.y+r.y,width:r.width,height:r.height})))found.push({edge,name});
    }
    return found;
  }
  function compactLinks(points,parts,edges,spacing=parts){
    const tree=edges.filter(e=>e.tree),children=new Map([...points.keys()].map(n=>[n,[]]));
    for(const e of tree)children.get(e.a).push(e.b);
    const length=e=>{const a=points.get(e.a),b=points.get(e.b);return Math.hypot(a.x-b.x,a.y-b.y);};
    const overlap=(a,b)=>{const p=points.get(a),q=points.get(b);return spacing.get(a).some(r=>spacing.get(b).some(s=>p.x+r.x<q.x+s.x+s.width&&p.x+r.x+r.width>q.x+s.x&&p.y+r.y<q.y+s.y+s.height&&p.y+r.y+r.height>q.y+s.y));};
    function valid(group,moved,fixed){
      for(const a of moved)for(const b of fixed)if(overlap(a,b))return false;
      for(const e of edges){
        const status=Number(group.has(e.a))+Number(group.has(e.b)),nodes=status===0?moved:status===2?fixed:points.keys();
        const a=points.get(e.a),b=points.get(e.b);
        for(const n of nodes){if(n===e.a||n===e.b)continue;const p=points.get(n);if(parts.get(n).some(r=>intersects(a,b,{...r,x:p.x+r.x,y:p.y+r.y})))return false;}
      }
      for(let i=0;i<tree.length;i++)for(let j=i+1;j<tree.length;j++){
        const e=tree[i],f=tree[j];if(e.a===f.a||e.a===f.b||e.b===f.a||e.b===f.b)continue;
        const first=Number(group.has(e.a))+Number(group.has(e.b)),second=Number(group.has(f.a))+Number(group.has(f.b));
        if(first===0&&second===0||first===2&&second===2)continue;
        const a=points.get(e.a),b=points.get(e.b),c=points.get(f.a),d=points.get(f.b);
        if(orient(a,b,c)*orient(a,b,d)<-1e-6&&orient(c,d,a)*orient(c,d,b)<-1e-6)return false;
      }
      return true;
    }
    for(let pass=0;pass<3;pass++){
      let changed=false;
      const ordered=tree.slice().sort((a,b)=>length(b)-length(a));
      for(const edge of ordered){
        const originalLength=length(edge);if(originalLength<=340)continue;
        const moved=[edge.b];for(let i=0;i<moved.length;i++)for(const n of children.get(moved[i]))moved.push(n);
        const group=new Set(moved),fixed=[...points.keys()].filter(n=>!group.has(n)),saved=new Map(moved.map(n=>[n,points.get(n)]));
        const boundary=edges.filter(e=>group.has(e.a)!==group.has(e.b)),before=boundary.reduce((s,e)=>s+length(e),0);
        const parent=points.get(edge.a),child=points.get(edge.b);
        for(const fraction of [.3,.5,.7,.85,.95]){
          const target=Math.max(280,originalLength*fraction),ratio=1-target/originalLength;
          for(const [n,p] of saved)points.set(n,{x:p.x+(parent.x-child.x)*ratio,y:p.y+(parent.y-child.y)*ratio});
          if(boundary.reduce((s,e)=>s+length(e),0)<before-1e-6&&valid(group,moved,fixed)){changed=true;break;}
          for(const [n,p] of saved)points.set(n,p);
        }
      }
      if(!changed)break;
    }
  }
  function arrange(points,parts,edges,root,spacing=parts){
    // Reserve the complete icon-and-name footprint, including wrapped labels.
    // Uniform expansion preserves the radial order and existing straight-line planarity.
    const names=[...points.keys()];
    function crowded(){for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){
      const a=names[i],b=names[j],p=points.get(a),q=points.get(b);
      if(spacing.get(a).some(r=>spacing.get(b).some(s=>p.x+r.x<q.x+s.x+s.width&&p.x+r.x+r.width>q.x+s.x&&p.y+r.y<q.y+s.y+s.height&&p.y+r.y+r.height>q.y+s.y)))return true;
    }return false;}
    for(let step=0;step<80&&crowded();step++){
      const anchor=points.get(root);for(const [name,p] of points)if(name!==root)points.set(name,{x:anchor.x+(p.x-anchor.x)*1.05,y:anchor.y+(p.y-anchor.y)*1.05});
    }
    const incident=new Map([...points.keys()].map(n=>[n,[]]));
    for(const edge of edges){incident.get(edge.a).push(edge);incident.get(edge.b).push(edge);}
    const blocked=(edge,name)=>{if(edge.a===name||edge.b===name)return false;const p=points.get(name);return parts.get(name).some(r=>intersects(points.get(edge.a),points.get(edge.b),{...r,x:p.x+r.x,y:p.y+r.y}));};
    function local(name){let count=0;for(const edge of edges)if(blocked(edge,name))count++;for(const edge of incident.get(name))for(const other of points.keys())if(blocked(edge,other))count++;return count;}
    function collisions(name){const p=points.get(name);let count=0;for(const [other,q] of points){if(other===name)continue;if(spacing.get(name).some(a=>spacing.get(other).some(b=>p.x+a.x<q.x+b.x+b.width&&p.x+a.x+a.width>q.x+b.x&&p.y+a.y<q.y+b.y+b.height&&p.y+a.y+a.height>q.y+b.y)))count++;}return count;}
    function crosses(name){for(const edge of incident.get(name)){if(!edge.tree)continue;for(const other of edges){if(!other.tree||edge.a===other.a||edge.a===other.b||edge.b===other.a||edge.b===other.b)continue;const a=points.get(edge.a),b=points.get(edge.b),c=points.get(other.a),d=points.get(other.b);if(orient(a,b,c)*orient(a,b,d)<-1e-6&&orient(c,d,a)*orient(c,d,b)<-1e-6)return true;}}return false;}
    let conflicts=obstacles(points,parts,edges),expansions=0;
    for(let round=0;conflicts.length&&round<160;round++){
      let best=null;
      for(const conflict of conflicts.slice(0,6)){
        const a=points.get(conflict.edge.a),b=points.get(conflict.edge.b),normal=Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2;
        for(const name of [conflict.name,conflict.edge.a,conflict.edge.b]){
          const original=points.get(name),before=local(name),overlap=collisions(name);
          for(const distance of [40,80,140,220,340])for(let turn=0;turn<8;turn++){
            const angle=normal+turn*Math.PI/4,p={x:original.x+distance*Math.cos(angle),y:original.y+distance*Math.sin(angle)};points.set(name,p);
            if(collisions(name)>overlap)continue;
            const improvement=before-local(name);
            if(improvement>0&&(!best||improvement>best.improvement||improvement===best.improvement&&distance<best.distance)&&!crosses(name))best={name,p,distance,improvement};
          }
          points.set(name,original);
        }
        if(best)break;
      }
      if(best)points.set(best.name,best.p);
      else{
        if(expansions++>=8)break;
        const anchor=points.get(root);for(const [name,p] of points)if(name!==root)points.set(name,{x:anchor.x+(p.x-anchor.x)*1.2,y:anchor.y+(p.y-anchor.y)*1.2});
      }
      conflicts=obstacles(points,parts,edges);
    }
    if(!conflicts.length)compactLinks(points,parts,edges,spacing);
    return conflicts;
  }
  // Clip a straight segment beyond the endpoint's protected device bounds.
  function endPoint(p,q,boxes){let exit=0;const dx=q.x-p.x,dy=q.y-p.y;
    for(const r of boxes){let low=0,high=1,valid=true;for(const [delta,min,max] of [[dx,r.x,r.x+r.width],[dy,r.y,r.y+r.height]]){if(Math.abs(delta)<1e-10){if(min>0||max<0)valid=false;}else{let a=min/delta,b=max/delta;if(a>b)[a,b]=[b,a];low=Math.max(low,a);high=Math.min(high,b);}}if(valid&&low<=high&&high>=0&&low<=1)exit=Math.max(exit,Math.min(1,high));}
    return {x:p.x+dx*exit,y:p.y+dy*exit};
  }
  const api={arrange,compactLinks,obstacles,intersects,endPoint};if(typeof module!=='undefined')module.exports=api;else root.LayoutClearance=api;
})(globalThis);
