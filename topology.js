(function(root){
  const radial=typeof module!=='undefined'?require('./radial-layout.js'):root.RadialLayout;
  const clearance=typeof module!=='undefined'?require('./layout-clearance.js'):root.LayoutClearance;
  const layout=branch=>radial.layout(branch);
  // Each physical adjacency gets one direct segment, clipped to the two device icons.
  function segment(p,q,scaleP=1,scaleQ=1){
    const dx=q.x-p.x,dy=q.y-p.y;
    const ratio=Math.max(Math.abs(dx)/33,Math.abs(dy)/37);
    const inset=Math.min(.45,scaleP/ratio),endInset=Math.min(.45,scaleQ/ratio);
    if(!Number.isFinite(inset))return {x1:p.x,y1:p.y,x2:q.x,y2:q.y};
    return {x1:p.x+dx*inset,y1:p.y+dy*inset,x2:q.x-dx*endInset,y2:q.y-dy*endInset};
  }
  function el(tag,attrs={}){
    const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
    return node;
  }
  function wrapName(label,background,gate){
    const name=label.textContent,lines=[];let line='';
    // Measure at the full requested font size; long special names wrap rather
    // than shrinking, truncating, or covering neighboring sites.
    for(const character of name){
      label.textContent=line+character;
      if(line&&label.getComputedTextLength()>134){lines.push(line);line=character;}
      else line+=character;
    }
    lines.push(line);label.textContent='';
    lines.forEach((value,index)=>{const span=el('tspan',{x:0,y:(gate?94:81)+index*34});span.textContent=value;label.append(span);});
    background.setAttribute('height',50+(lines.length-1)*34);
  }
  class View{
    constructor(container,onZoom){this.container=container;this.onZoom=onZoom;this.clear();}
    clear(){this.key=null;this.svg=null;this.points=null;this.selected=new Set();this.camera={x:0,y:0,k:1};this.onZoom?.(1);}
    render({key,branch,links,failed='',affected=new Set(),query,showExtra,onSelectionChange}){
      const changed=this.key!==key;
      if(changed){this.points=layout(branch).points;this.key=key;this.selected=new Set();}
      this.query=query||'';this.onSelectionChange=onSelectionChange;
      const svg=el('svg',{width:'100%',height:'100%',role:'group','aria-label':`Radial topology for gateway ${key}`});
      const layer=el('g',{'class':'topology-layer'}),edges=el('g',{'class':'topology-edges'}),nodes=el('g',{'class':'topology-nodes'});
      svg.append(layer);layer.append(edges,nodes);this.svg=svg;this.layer=layer;this.edges=[];this.nodeElements=new Map();
      let extraCount=0;const drawn=new Set();
      for(const [a,b] of links){
        if(a===b||!this.points.has(a)||!this.points.has(b))continue;
        const identity=JSON.stringify([a,b].sort());if(drawn.has(identity))continue;drawn.add(identity);
        const tree=branch.parent.get(a)===b||branch.parent.get(b)===a;
        if(!tree)extraCount++;
        const path=el('line',{'data-source':a,'data-target':b,'class':tree?'tree-link':'extra-link',fill:'none',stroke:a===failed||b===failed?'#f48a98':affected.has(a)||affected.has(b)?'#ffc068':tree?'#45ed8a':'#f6d77d','stroke-width':tree?2:1.5,'stroke-dasharray':tree?'':'6 5',display:tree||showExtra?'':'none'});
        const title=el('title');title.textContent=`${a} ↔ ${b}${tree?'':' · Additional link'}`;path.append(title);edges.append(path);
        const parent=branch.parent.get(a)===b?b:a,child=parent===a?b:a;
        this.edges.push({a:parent,b:child,path,tree});
      }
      for(const [n,p] of this.points){
        const gate=n===key,color=n===failed?'#e84b5d':affected.has(n)?'#87929d':gate?'#f2c230':'#16b860';
        const status=n===failed?'Down':affected.has(n)?'Impacted':gate?'GNE gateway':'Connected';
        const g=el('g',{'class':'network-node'+(affected.has(n)?' impacted':'')+(n===query?' highlighted':'')+(gate?' gateway-node':''),transform:`translate(${p.x} ${p.y})`,tabindex:0,role:'button','aria-pressed':'false','aria-label':`${n}: ${status}. Ctrl+click to select multiple sites; drag to move the selection.`,'data-node':n,opacity:'1'});
        const title=el('title');title.textContent=`${n} · ${status}\nDrag to arrange this site`;g.append(title);
        // Microwave dish and radio chassis, drawn as local SVG rather than an external image.
        const device=el('g',{'class':'device-icon',transform:gate?'scale(1.8)':'scale(1.4)'});g.append(device);
        device.append(el('rect',{x:-29,y:-33,width:58,height:64,rx:4,fill:color,stroke:affected.has(n)||n===query?'#ff3038':gate?'#b6f5ff':'#c6f2d7','stroke-width':affected.has(n)||n===query?5:gate?3:1.5}));
        device.append(el('path',{d:'M-15 -22 Q-23 -1 8 0 Z M-14 -21 L7 -3 M-1 -13 L10 -23 M10 -23 L14 -19 M-4 0 L-4 6 M-12 6 H5',fill:'none',stroke:'white','stroke-width':2.2,'stroke-linecap':'round','stroke-linejoin':'round'}));
        device.append(el('circle',{cx:12,cy:-24,r:3,fill:'none',stroke:'white','stroke-width':1.5}));
        for(let i=0;i<3;i++)device.append(el('rect',{x:-20+i*15,y:12,width:10,height:13,rx:1,fill:'none',stroke:'white','stroke-width':1.5}));
        device.append(el('rect',{x:gate?-44:-32,y:-48,width:gate?40:30,height:17,rx:4,fill:gate?'#ddfaff':'#e3ecef',stroke:'#fff','stroke-width':.5}));
        const type=el('text',{'class':'node-type',x:gate?-24:-17,y:-36,'text-anchor':'middle',fill:gate?'#075f70':'#385c6b','font-size':10,'font-weight':'bold'});type.textContent=gate?'GNE':'NE';device.append(type);
        g.append(el('rect',{'class':'node-label-bg',x:-75,y:gate?62:49,width:150,height:50,rx:5,fill:gate?'#f7fcff':'none',stroke:gate?(query&&n===query?'#ff3038':'#c8dce5'):'none','stroke-width':query&&n===query?3:1}));
        const label=el('text',{'class':'node-name',x:0,y:67,'text-anchor':'middle',fill:gate?'#173e50':'#ffffff','font-size':29.25,'font-weight':'bold'});label.textContent=n;g.append(label);
        g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.select(n,e.ctrlKey||e.metaKey);}else if(e.key==='Escape'){e.preventDefault();this.clearSelection();}};
        nodes.append(g);this.nodeElements.set(n,g);
      }
      this.container.replaceChildren(svg);
      for(const node of this.nodeElements.values())wrapName(node.querySelector('.node-name'),node.querySelector('.node-label-bg'),node.classList.contains('gateway-node'));
      this.parts=new Map();
      for(const [name,node] of this.nodeElements){
        const scale=name===this.key?1.8:1.4,device=node.querySelector('.device-icon').getBBox(),pad=9;
        this.parts.set(name,[{x:device.x*scale-pad,y:device.y*scale-pad,width:device.width*scale+pad*2,height:device.height*scale+pad*2}]);
      }
      if(changed){
        this.obstructions=clearance.arrange(this.points,this.parts,this.edges,this.key);
        for(const [name,p] of this.points)this.nodeElements.get(name).setAttribute('transform',`translate(${p.x} ${p.y})`);
      }
      this.updateEdges();
      this.bindInteractions(svg);
      this.syncSelection();
      if(changed)this.open();else this.applyCamera();
      return extraCount;
    }
    syncSelection(){
      for(const [name,node] of this.nodeElements||[]){
        const selected=this.selected.has(name),highlighted=name===this.query;
        node.classList.toggle('selected',selected);node.classList.toggle('highlighted',highlighted);node.setAttribute('aria-pressed',String(selected));
        const active=selected||highlighted||node.classList.contains('impacted'),gate=name===this.key;
        const icon=node.querySelector('.device-icon>rect');icon.setAttribute('stroke',active?'#ff3038':gate?'#b6f5ff':'#c6f2d7');icon.setAttribute('stroke-width',active?5:gate?3:1.5);
        const label=node.querySelector('.node-label-bg');label.setAttribute('stroke',gate?(active?'#ff3038':'#c8dce5'):'none');
      }
    }
    select(name,additive=false,preserveGroup=false){
      if(additive){if(this.selected.has(name))this.selected.delete(name);else this.selected.add(name);}
      else if(!preserveGroup||!this.selected.has(name))this.selected=new Set([name]);
      this.query='';this.syncSelection();this.onSelectionChange?.([...this.selected]);
    }
    clearSelection(){this.selected=new Set();this.syncSelection();}
    updateEdges(){
      for(const {a,b,path} of this.edges){
        const start=clearance.endPoint(this.points.get(a),this.points.get(b),this.parts.get(a)),end=clearance.endPoint(this.points.get(b),this.points.get(a),this.parts.get(b));
        const aPoint=this.points.get(a),bPoint=this.points.get(b);
        if((end.x-start.x)*(bPoint.x-aPoint.x)+(end.y-start.y)*(bPoint.y-aPoint.y)<0){const x=(start.x+end.x)/2,y=(start.y+end.y)/2;start.x=end.x=x;start.y=end.y=y;}
        const coordinates={x1:start.x,y1:start.y,x2:end.x,y2:end.y};
        for(const [name,value] of Object.entries(coordinates))path.setAttribute(name,value);
      }
    }
    open(){
      this.focus(this.key);
    }
    applyCamera(){if(!this.layer)return;const c=this.camera;this.layer.setAttribute('transform',`translate(${c.x} ${c.y}) scale(${c.k})`);this.onZoom?.(c.k);}
    fit(names=this.points?.keys()){
      if(!this.svg)return;
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      for(const name of names){const p=this.points.get(name);if(!p)continue;const box=this.nodeElements.get(name).getBBox();left=Math.min(left,p.x+box.x-15);right=Math.max(right,p.x+box.x+box.width+15);top=Math.min(top,p.y+box.y-15);bottom=Math.max(bottom,p.y+box.y+box.height+15);}
      const w=this.container.clientWidth,h=this.container.clientHeight,k=Math.min(1.35,(w-40)/(right-left),(h-40)/(bottom-top));
      this.camera={k,x:(w-(right-left)*k)/2-left*k,y:(h-(bottom-top)*k)/2-top*k};this.applyCamera();
    }
    focus(site,targets=[site]){
      const root=this.points?.get(this.key);if(!this.svg||!root||!this.points.has(site))return;
      const names=new Set(site===this.key?this.points.keys():targets);names.add(this.key);names.add(site);
      const w=this.container.clientWidth,h=this.container.clientHeight;
      const anchor={x:w*.5,y:h*.25},padding=16,top=Math.min(70,h*.12);
      let k=.38;
      for(const name of names){
        const p=this.points.get(name),node=this.nodeElements.get(name);if(!p||!node)continue;
        const box=node.getBBox(),left=p.x+box.x-root.x,right=left+box.width,up=p.y+box.y-root.y,down=up+box.height;
        if(left<0)k=Math.min(k,(anchor.x-padding)/-left);
        if(right>0)k=Math.min(k,(w-padding-anchor.x)/right);
        if(up<0)k=Math.min(k,(anchor.y-top)/-up);
        if(down>0)k=Math.min(k,(h-padding-anchor.y)/down);
      }
      k=Math.max(Number.EPSILON,k);
      this.camera={k,x:anchor.x-root.x*k,y:anchor.y-root.y*k};this.applyCamera();
    }
    center(){if(!this.svg)return;const p=this.points.get(this.key);this.camera={k:1,x:this.container.clientWidth/2-p.x,y:this.container.clientHeight/2-p.y};this.applyCamera();}
    zoom(factor,x=this.container.clientWidth/2,y=this.container.clientHeight/2){
      if(!this.svg)return;const c=this.camera,k=Math.max(.001,Math.min(4,c.k*factor)),ratio=k/c.k;
      this.camera={k,x:x-(x-c.x)*ratio,y:y-(y-c.y)*ratio};this.applyCamera();
    }
    bindInteractions(svg){
      let drag=null;this.moved=false;
      svg.onpointerdown=e=>{
        if(e.button!==0)return;const n=e.target.closest('.network-node')?.getAttribute('data-node');
        const additive=e.ctrlKey||e.metaKey,collapse=n&&!additive&&this.selected.has(n)&&this.selected.size>1;
        const removeOnTap=n&&additive&&this.selected.has(n);
        if(removeOnTap){this.query='';this.syncSelection();this.onSelectionChange?.([...this.selected]);}
        else if(n)this.select(n,additive,true);else if(!additive)this.clearSelection();
        if(n&&!this.selected.has(n)){e.preventDefault();return;}
        const p=n?this.points.get(n):this.camera;
        drag={n,collapse,removeOnTap,startX:e.clientX,startY:e.clientY,x:p.x,y:p.y,positions:n?new Map([...this.selected].map(name=>[name,{...this.points.get(name)}])):null};this.moved=false;
        svg.setPointerCapture(e.pointerId);e.preventDefault();
      };
      svg.onpointermove=e=>{
        if(!drag)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
        if(Math.hypot(dx,dy)>4)this.moved=true;if(!this.moved)return;
        if(drag.n){for(const [name,start] of drag.positions){const p={x:start.x+dx/this.camera.k,y:start.y+dy/this.camera.k};this.points.set(name,p);this.nodeElements.get(name).setAttribute('transform',`translate(${p.x} ${p.y})`);}this.updateEdges();}
        else{this.camera.x=drag.x+dx;this.camera.y=drag.y+dy;this.applyCamera();}
      };
      svg.onpointerup=e=>{if(!drag)return;const {n,collapse,removeOnTap}=drag;drag=null;if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);if(n&&!this.moved){if(removeOnTap)this.select(n,true);else if(collapse)this.select(n);}};
      svg.onpointercancel=()=>{drag=null;this.moved=true;};
      svg.addEventListener('wheel',e=>{e.preventDefault();const rect=this.container.getBoundingClientRect();this.zoom(e.deltaY<0?1.15:1/1.15,e.clientX-rect.left,e.clientY-rect.top);},{passive:false});
    }
  }
  const api={layout,segment,View};if(typeof module!=='undefined')module.exports=api;else root.Topology=api;
})(globalThis);
