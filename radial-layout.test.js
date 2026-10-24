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
