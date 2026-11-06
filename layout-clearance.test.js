const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('./layout-clearance');
const boxes=[{x:-45,y:-60,width:90,height:110},{x:-75,y:60,width:150,height:50}];
function clear(points,edges){const parts=new Map([...points.keys()].map(n=>[n,boxes]));assert.ok(C.obstacles(points,parts,edges).length>0);const before=[...points.keys()];assert.deepEqual(C.arrange(points,parts,edges,'A'),[]);assert.deepEqual(C.obstacles(points,parts,edges),[]);assert.deepEqual([...points.keys()],before);}
test('move a blocking device rather than bending a straight link',()=>{
 clear(new Map([['A',{x:0,y:0}],['B',{x:600,y:0}],['C',{x:300,y:0}]]),[{a:'A',b:'B',tree:true},{a:'A',b:'C',tree:true}]);
});
test('protect transparent site-name areas as well as device icons',()=>{
 const points=new Map([['A',{x:0,y:0}],['B',{x:600,y:0}],['C',{x:300,y:-80}]]),edges=[{a:'A',b:'B',tree:true},{a:'A',b:'C',tree:true}];
 assert.equal(C.intersects(points.get('A'),points.get('B'),{x:255,y:-140,width:90,height:110}),false);
 clear(points,edges);
});
test('additional physical links also avoid intermediate sites',()=>{
 clear(new Map([['A',{x:0,y:0}],['B',{x:300,y:0}],['C',{x:600,y:0}]]),[{a:'A',b:'B',tree:true},{a:'B',b:'C',tree:true},{a:'A',b:'C',tree:false}]);
});
test('straight endpoint clipping leaves the device and its own name clear',()=>{
 assert.ok(Math.abs(C.endPoint({x:0,y:0},{x:0,y:600},boxes).y-110)<1e-8);
 assert.deepEqual(C.endPoint({x:0,y:0},{x:600,y:0},boxes),{x:45,y:0});
});
