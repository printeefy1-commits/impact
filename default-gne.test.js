const {test}=require('node:test');
const assert=require('node:assert/strict');
const gates=require('./default-gne');
const N=require('./network');

test('the confirmed 272 gateways are canonical, unique, and include the MLR discovery',()=>{
  assert.equal(gates.length,272);
  assert.equal(new Set(gates).size,272);
  assert.ok(Object.isFrozen(gates));
  for(const gate of gates)assert.equal(N.primaryName(gate),gate);
  for(const gate of ['A16X589','A16X1801','C40X052','O46T078','O01S478','CA-BBM','A33CA01','A11CA03'])assert.ok(gates.includes(gate),gate);
  assert.equal(gates.at(-1),'A16X589');
});

test('built-in order resolves ownership ties before appended gateways',()=>{
  const first=gates[0],second=gates[1],extra='A99X001';
  const adj=N.graph([[second,'NE(1-1)'],[extra,'NE(1-1)'],[first,'NE(1-1)']],gates.concat(extra));
  assert.equal(N.traverse(adj,gates.concat(extra)).owner.get('NE(1-1)'),first);
});
