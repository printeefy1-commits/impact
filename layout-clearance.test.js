const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('./layout-clearance');
const boxes=[{x:-45,y:-60,width:90,height:110}];
function clear(points,edges){const parts=new Map([...points.keys()].map(n=>[n,boxes]));assert.ok(C.obstacles(points,parts,edges).length>0);const before=[...points.keys()];assert.deepEqual(C.arrange(points,parts,edges,'A'),[]);assert.deepEqual(C.obstacles(points,parts,edges),[]);assert.deepEqual([...points.keys()],before);}
test('move a blocking device rather than bending a straight link',()=>{
 clear(new Map([['A',{x:0,y:0}],['B',{x:600,y:0}],['C',{x:300,y:0}]]),[{a:'A',b:'B',tree:true},{a:'A',b:'C',tree:true}]);
});
test('permit a straight link behind a name without moving sites',()=>{
 const points=new Map([['A',{x:0,y:0}],['B',{x:300,y:0}],['C',{x:150,y:-80}]]),edges=[{a:'A',b:'B',tree:true},{a:'A',b:'C',tree:true}];
 assert.equal(C.intersects(points.get('A'),points.get('B'),{x:105,y:-140,width:90,height:110}),false);
 const parts=new Map([...points.keys()].map(n=>[n,boxes])),before=JSON.stringify([...points]);
 assert.deepEqual(C.arrange(points,parts,edges,'A'),[]);
 assert.equal(JSON.stringify([...points]),before);
});
test('additional physical links also avoid intermediate sites',()=>{
 clear(new Map([['A',{x:0,y:0}],['B',{x:300,y:0}],['C',{x:600,y:0}]]),[{a:'A',b:'B',tree:true},{a:'B',b:'C',tree:true},{a:'A',b:'C',tree:false}]);
});
test('straight endpoint clipping clears the device while allowing names above links',()=>{
 assert.ok(Math.abs(C.endPoint({x:0,y:0},{x:0,y:600},boxes).y-50)<1e-8);
 assert.deepEqual(C.endPoint({x:0,y:0},{x:600,y:0},boxes),{x:45,y:0});
});
test('compact a distant branch without stretching its internal main links',()=>{
 const points=new Map([['A',{x:0,y:0}],['B',{x:1500,y:0}],['C',{x:1760,y:0}],['D',{x:0,y:500}]]);
 const parts=new Map([...points.keys()].map(n=>[n,boxes])),edges=[{a:'A',b:'B',tree:true},{a:'B',b:'C',tree:true},{a:'A',b:'D',tree:true}];
 const lengths=()=>edges.map(e=>Math.hypot(points.get(e.a).x-points.get(e.b).x,points.get(e.a).y-points.get(e.b).y));
 const before=lengths();C.compactLinks(points,parts,edges);const after=lengths();
 assert.ok(after.every((length,i)=>length<=before[i]+1e-6));
 assert.ok(after.reduce((a,b)=>a+b)<before.reduce((a,b)=>a+b)*.5);
 assert.deepEqual(C.obstacles(points,parts,edges),[]);assert.deepEqual(points.get('A'),{x:0,y:0});
});

test('reserve wrapped names when expanding and compacting branches',()=>{
 const points=new Map([['A',{x:0,y:0}],['B',{x:0,y:200}],['C',{x:0,y:400}]]);
 const parts=new Map([...points.keys()].map(n=>[n,boxes]));
 const spacing=new Map([...points.keys()].map(n=>[n,[{x:-90,y:-75,width:180,height:310}]]));
 const edges=[{a:'A',b:'B',tree:true},{a:'B',b:'C',tree:true}];
 C.arrange(points,parts,edges,'A',spacing);
 assert.ok(points.get('B').y>=310);assert.ok(points.get('C').y-points.get('B').y>=310);
 assert.deepEqual(points.get('A'),{x:0,y:0});assert.deepEqual(C.obstacles(points,parts,edges),[]);
});
