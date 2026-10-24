const {test}=require('node:test');
const assert=require('node:assert/strict');
const Network=require('./network.js');
const {layout,segment}=require('./topology.js');

test('topology layout distributes root neighbors around the GNE',()=>{
 const tree=Network.branch(Network.graph([['G','A'],['G','B'],['G','C'],['G','D'],['A','E']],['G']),['G'],'G');
 const result=layout(tree),root=result.points.get('G');
 assert.equal(result.points.size,6);
 const children=['A','B','C','D'].map(n=>result.points.get(n));
 assert.ok(children.some(p=>p.x<root.x));assert.ok(children.some(p=>p.x>root.x));
 assert.ok(children.some(p=>p.y<root.y));assert.ok(children.some(p=>p.y>root.y));
});

test('each edge is a direct segment clipped to the device boundaries',()=>{
 assert.deepEqual(segment({x:0,y:0},{x:200,y:0}),{x1:33,y1:0,x2:167,y2:0});
 assert.deepEqual(segment({x:0,y:0},{x:0,y:200}),{x1:0,y1:37,x2:0,y2:163});
 const p={x:20,y:40},q={x:400,y:300},s=segment(p,q);
 assert.ok(Math.abs((s.x1-p.x)*(q.y-p.y)-(s.y1-p.y)*(q.x-p.x))<1e-8);
 assert.ok(Math.abs((s.x2-p.x)*(q.y-p.y)-(s.y2-p.y)*(q.x-p.x))<1e-8);
 assert.ok(s.x1>p.x&&s.x2<q.x);
 for(const value of Object.values(segment(p,p)))assert.ok(Number.isFinite(value));
});
