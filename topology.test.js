const {test}=require('node:test');
const assert=require('node:assert/strict');
const Network=require('./network.js');
const {layout}=require('./topology.js');

test('subtrees have separate lanes and parents are centered over children',()=>{
 const adj=Network.graph([['G','A'],['G','B'],['A','C'],['A','D'],['B','E']],['G']);
 const tree=Network.branch(adj,['G'],'G'),result=layout(tree),p=result.points;
 assert.equal(p.size,6);
 assert.equal(p.get('A').x,(p.get('C').x+p.get('D').x)/2);
 assert.ok(p.get('D').x<p.get('E').x);
 for(const parent of tree.parent.values())assert.ok(p.has(parent));
 for(const [child,parent] of tree.parent)assert.equal(p.get(child).y-p.get(parent).y,150);
 const rows=new Map();for(const [n,point] of p){const d=tree.depth.get(n);if(!rows.has(d))rows.set(d,[]);rows.get(d).push(point.x);}
 for(const row of rows.values()){row.sort((a,b)=>a-b);for(let i=1;i<row.length;i++)assert.ok(row[i]-row[i-1]>=180);}
});
test('very deep trees are laid out without a recursive call stack',()=>{
 const visited=new Set(),parent=new Map(),depth=new Map();
 for(let i=0;i<20000;i++){visited.add(i);depth.set(i,i);if(i)parent.set(i,i-1);}
 const result=layout({visited,parent,depth});
 assert.equal(result.points.size,20000);assert.equal(result.points.get(0).x,result.points.get(19999).x);
});
