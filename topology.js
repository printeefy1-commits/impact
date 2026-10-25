(function(root){
  const radial=typeof module!=='undefined'?require('./radial-layout.js'):root.RadialLayout;
  const layout=branch=>radial.layout(branch);
  // Each physical adjacency gets one direct segment, clipped to the two device icons.
  function segment(p,q){
    const dx=q.x-p.x,dy=q.y-p.y;
    const inset=Math.min(.45,1/Math.max(Math.abs(dx)/33,Math.abs(dy)/37));
    if(!Number.isFinite(inset))return {x1:p.x,y1:p.y,x2:q.x,y2:q.y};
    return {x1:p.x+dx*inset,y1:p.y+dy*inset,x2:q.x-dx*inset,y2:q.y-dy*inset};
  }
  function el(tag,attrs={}){
    const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
    return node;
  }
  class View{
    constructor(container,onZoom){this.container=container;this.onZoom=onZoom;this.clear();}
    clear(){this.key=null;this.svg=null;this.points=null;this.camera={x:0,y:0,k:1};this.onZoom?.(1);}
    render({key,branch,links,failed='',affected=new Set(),query,showExtra,onSelect}){
      const changed=this.key!==key;
      if(changed){this.points=layout(branch).points;this.key=key;}
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
        const gate=n===key,color=n===failed?'#e84b5d':affected.has(n)?'#e8a126':gate?'#087d91':'#16b860';
        const status=n===failed?'Down':affected.has(n)?'Impacted':gate?'GNE gateway':'Connected';
        const selectable=typeof onSelect==='function';
        const g=el('g',{'class':'network-node',transform:`translate(${p.x} ${p.y})`,tabindex:0,role:selectable?'button':'img','aria-label':`${n}: ${status}. Drag to move this site.`,'data-node':n,opacity:'1'});
        const title=el('title');title.textContent=`${n} · ${status}\nDrag to arrange this site`;g.append(title);
        // Microwave dish and radio chassis, drawn as local SVG rather than an external image.
        g.append(el('rect',{x:-29,y:-33,width:58,height:64,rx:4,fill:color,stroke:gate?'#b6f5ff':'#c6f2d7','stroke-width':gate?3:1.5}));
        g.append(el('path',{d:'M-15 -22 Q-23 -1 8 0 Z M-14 -21 L7 -3 M-1 -13 L10 -23 M10 -23 L14 -19 M-4 0 L-4 6 M-12 6 H5',fill:'none',stroke:'white','stroke-width':2.2,'stroke-linecap':'round','stroke-linejoin':'round'}));
        g.append(el('circle',{cx:12,cy:-24,r:3,fill:'none',stroke:'white','stroke-width':1.5}));
        for(let i=0;i<3;i++)g.append(el('rect',{x:-20+i*15,y:12,width:10,height:13,rx:1,fill:'none',stroke:'white','stroke-width':1.5}));
        g.append(el('rect',{x:gate?-44:-32,y:-48,width:gate?40:30,height:17,rx:4,fill:gate?'#ddfaff':'#e3ecef',stroke:'#fff','stroke-width':.5}));
        const type=el('text',{'class':'node-type',x:gate?-24:-17,y:-36,'text-anchor':'middle',fill:gate?'#075f70':'#385c6b','font-size':10,'font-weight':'bold'});type.textContent=gate?'GNE':'NE';g.append(type);
        g.append(el('rect',{'class':'node-label-bg',x:-75,y:39,width:150,height:26,rx:5,fill:'#f7fcff',stroke:query&&n===query?'#ffe778':'#c8dce5','stroke-width':query&&n===query?3:1}));
        const label=el('text',{'class':'node-name',x:0,y:56,'text-anchor':'middle',fill:'#173e50','font-size':13,'font-weight':'bold'});label.textContent=n;g.append(label);
        if(selectable){
          g.onclick=e=>{if(e.detail===0)onSelect(n);};
          g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(n);}};
        }
        nodes.append(g);this.nodeElements.set(n,g);
      }
      this.updateEdges();this.container.replaceChildren(svg);this.bindInteractions(svg);
      if(changed)this.open();else this.applyCamera();
      return extraCount;
    }
    updateEdges(){
      for(const {a,b,path} of this.edges){
        const coordinates=segment(this.points.get(a),this.points.get(b));
        for(const [name,value] of Object.entries(coordinates))path.setAttribute(name,value);
      }
    }
    open(){
      if(!this.svg)return;
      const p=this.points.get(this.key),k=1;
      this.camera={k,x:this.container.clientWidth/2-p.x*k,y:this.container.clientHeight/2-p.y*k};this.applyCamera();
    }
    applyCamera(){if(!this.layer)return;const c=this.camera;this.layer.setAttribute('transform',`translate(${c.x} ${c.y}) scale(${c.k})`);this.onZoom?.(c.k);}
    fit(){
      if(!this.svg)return;
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      for(const p of this.points.values()){left=Math.min(left,p.x-90);right=Math.max(right,p.x+90);top=Math.min(top,p.y-65);bottom=Math.max(bottom,p.y+85);}
      const w=this.container.clientWidth,h=this.container.clientHeight,k=Math.min(1.35,(w-40)/(right-left),(h-40)/(bottom-top));
      this.camera={k,x:(w-(right-left)*k)/2-left*k,y:(h-(bottom-top)*k)/2-top*k};this.applyCamera();
    }
    focus(site){
      const p=this.points?.get(site);if(!this.svg||!p)return;
      const k=Math.max(1,this.camera.k);this.camera={k,x:this.container.clientWidth/2-p.x*k,y:this.container.clientHeight/2-p.y*k};this.applyCamera();
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
        const p=n?this.points.get(n):this.camera;drag={n,startX:e.clientX,startY:e.clientY,x:p.x,y:p.y};this.moved=false;
        svg.setPointerCapture(e.pointerId);e.preventDefault();
      };
      svg.onpointermove=e=>{
        if(!drag)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
        if(Math.hypot(dx,dy)>4)this.moved=true;if(!this.moved)return;
        if(drag.n){const p={x:drag.x+dx/this.camera.k,y:drag.y+dy/this.camera.k};this.points.set(drag.n,p);this.nodeElements.get(drag.n).setAttribute('transform',`translate(${p.x} ${p.y})`);this.updateEdges();}
        else{this.camera.x=drag.x+dx;this.camera.y=drag.y+dy;this.applyCamera();}
      };
      // Pointer capture directs the click to the SVG; explicitly select a node on a tap.
      svg.onpointerup=e=>{if(!drag)return;const n=drag.n;drag=null;if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);if(n&&!this.moved)this.nodeElements.get(n)?.dispatchEvent(new MouseEvent('click',{bubbles:false}));};
      svg.onpointercancel=()=>{drag=null;this.moved=true;};
      svg.addEventListener('wheel',e=>{e.preventDefault();const rect=this.container.getBoundingClientRect();this.zoom(e.deltaY<0?1.15:1/1.15,e.clientX-rect.left,e.clientY-rect.top);},{passive:false});
    }
  }
  const api={layout,segment,View};if(typeof module!=='undefined')module.exports=api;else root.Topology=api;
})(globalThis);
