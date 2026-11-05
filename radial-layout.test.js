const {test}=require('node:test');
const assert=require('node:assert/strict');
const Network=require('./network.js');
const {layout}=require('./radial-layout.js');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function tree(links){return Network.branch(Network.graph(links,['G']),['G'],'G');}

test('GNE is centered and direct neighbors form spokes on every side',()=>{
 const result=layout(tree([['G','A'],['G','B'],['G','C'],['G','D'],['A','E'],['A','F'],['E','H']]));
 const root=result.points.get('G');
 assert.equal(root.x,result.width/2);assert.equal(root.y,result.height/2);
 const direct=['A','B','C','D'].map(n=>result.points.get(n));
 assert.ok(direct.some(p=>p.x<root.x-100));assert.ok(direct.some(p=>p.x>root.x+100));
 assert.ok(direct.some(p=>p.y<root.y-100));assert.ok(direct.some(p=>p.y>root.y+100));
 for(const p of direct)assert.ok(Math.abs(distance(p,root)-260)<1e-6);
});

test('dense radial levels keep icon and name bounds separate and every depth shares a ring',()=>{
 const links=[];for(let i=0;i<8;i++){links.push(['G','P'+i]);for(let j=0;j<10;j++)links.push(['P'+i,`C${i}-${j}`]);}
 const branch=tree(links),result=layout(branch),root=result.points.get('G'),rings=new Map();
 for(const [name,p] of result.points){const depth=branch.depth.get(name);if(!rings.has(depth))rings.set(depth,[]);rings.get(depth).push(p);assert.ok(p.x>=100&&p.y>=100);}
 for(const nodes of rings.values()){
  const r=distance(nodes[0],root);for(const p of nodes)assert.ok(Math.abs(distance(p,root)-r)<1e-6);
 }
 const points=[...result.points.values()];
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)assert.ok(distance(points[i],points[j])>=200-1e-6);
});

test('layout is deterministic when input order changes',()=>{
 const links=[['G','A'],['G','B'],['G','C'],['A','D'],['A','E'],['B','F']];
 const one=layout(tree(links)),two=layout(tree(links.slice().reverse()));
 for(const [name,p] of one.points)assert.deepEqual(two.points.get(name),p);
});

test('20,000-node chains avoid recursion and progress outward',()=>{
 const visited=new Set(),parent=new Map(),depth=new Map();
 for(let i=0;i<20000;i++){visited.add(i);depth.set(i,i);if(i)parent.set(i,i-1);}
 const result=layout({visited,parent,depth}),center=result.points.get(0);
 assert.equal(result.points.size,20000);
 assert.ok(Number.isFinite(result.width)&&Number.isFinite(result.height));
 assert.ok(distance(result.points.get(19999),center)>distance(result.points.get(19998),center));
});

test('empty and isolated GNE layouts remain finite',()=>{
 assert.equal(layout({visited:new Set(),parent:new Map(),depth:new Map()}).points.size,0);
 const one=layout(tree([]));assert.equal(one.points.size,1);assert.ok(Number.isFinite(one.width));
 assert.equal(one.points.get('G').x,one.width/2);assert.equal(one.points.get('G').y,one.height/2);
});

test('skewed sparse rings redistribute angles instead of inflating the whole map',()=>{
 const links=[['G','A'],['G','B'],['G','C'],['G','D'],['A','L'],['A','H'],['L','LL'],['H','M'],['H','HH']];
 for(let i=0;i<1000;i++)links.push(['HH','leaf'+i]);
 const result=layout(tree(links));
 assert.ok(result.width<175000,'sparse inherited sectors must not force an enormous radius');
 const root=result.points.get('G'),ll=result.points.get('LL'),m=result.points.get('M');
 assert.ok(distance(ll,m)>=200-1e-6);
 assert.ok(Math.abs(distance(ll,root)-distance(m,root))<1e-6);
});

test('ordered crowded branches stay planar while long links are shortened',()=>{
 const fixtures=[{"links":[["G","N027"],["G","N031"],["G","N009"],["G","N000"],["G","N036"],["G","N006"],["G","N013"],["G","N043"],["G","N038"],["G","N024"],["G","N029"],["G","N034"],["G","N041"],["G","N023"],["G","N017"],["G","N039"],["G","N037"],["G","N018"],["N027","N005"],["N027","N035"],["N031","N010"],["N009","N007"],["N009","N001"],["N009","N028"],["N009","N002"],["N009","N008"],["N036","N004"],["N038","N012"],["N024","N003"],["N029","N014"],["N029","N022"],["N029","N042"],["N029","N021"],["N029","N011"],["N029","N015"],["N029","N019"],["N029","N016"],["N029","N044"],["N034","N030"],["N034","N026"],["N034","N025"],["N008","N040"],["N015","N033"],["N015","N020"],["N019","N032"]],"shortLink":null},{"links":[["G","N030"],["G","N013"],["G","N014"],["G","N031"],["G","N026"],["G","N012"],["G","N019"],["G","N034"],["G","N033"],["G","N035"],["G","N032"],["G","N029"],["G","N018"],["G","N044"],["N030","N039"],["N014","N036"],["N014","N028"],["N014","N009"],["N014","N006"],["N031","N017"],["N031","N015"],["N026","N001"],["N012","N027"],["N019","N005"],["N019","N024"],["N019","N007"],["N019","N010"],["N019","N011"],["N019","N023"],["N033","N037"],["N035","N008"],["N035","N043"],["N035","N045"],["N029","N041"],["N018","N004"],["N028","N022"],["N009","N002"],["N017","N020"],["N017","N021"],["N017","N038"],["N017","N040"],["N017","N046"],["N011","N000"],["N011","N042"],["N002","N003"],["N020","N016"],["N016","N025"]],"shortLink":["N006","N014"]}];
 const orient=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 for(const fixture of fixtures){
  const branch=tree(fixture.links),points=layout(branch).points,edges=[...branch.parent];
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
   const [a,b]=edges[i],[c,d]=edges[j];if(a===c||a===d||b===c||b===d)continue;
   const A=points.get(a),B=points.get(b),C=points.get(c),D=points.get(d);
   assert.ok(!(orient(A,B,C)*orient(A,B,D)<-1e-6&&orient(C,D,A)*orient(C,D,B)<-1e-6),'Main links cross');
  }
  if(fixture.shortLink)assert.ok(distance(...fixture.shortLink.map(n=>points.get(n)))<700);
 }
});
