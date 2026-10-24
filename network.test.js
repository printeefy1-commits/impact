const {test}=require('node:test');
const assert=require('node:assert/strict');
const N=require('./network.js');
test('extract allowed prefixes, S/M/X, lengths, and internal separators',()=>{
 assert.deepEqual(N.extract('A_12-S345-C12X3456'),['A12S345','C12X3456']);
 assert.deepEqual(N.extract('O12M1234'),['O12M1234']);
 for(const value of ['B12S345','A12Z345','A1S345','A12S34567'])assert.deepEqual(N.extract(value),[]);
});
test('extract identifiers while discarding descriptive prefixes, suffixes and whitespace',()=>{
 assert.deepEqual(N.extract(' A_12-S345 site north - C12M3456 microwave link '),['A12S345','C12M3456']);
 assert.deepEqual(N.extract('GNE: o 12 x 3456 — gateway description'),['O12X3456']);
 assert.deepEqual(N.extract('A12S345_suffix'),['A12S345']);
 const r=N.parseCells([{value:'A12S345 text-C12M3456 text-O12X345 text'}],2);
 assert.equal(r.valid.length,0);assert.equal(r.invalid.length,1);
});
test('reject malformed rows and self links',()=>{
 const r=N.parseCells([{value:'link'},{value:'A12S345-A12S345'},{value:'A12S345-C12X3456'}],2);
 assert.equal(r.valid.length,1);assert.equal(r.invalid.length,2);
});
test('downstream loss excludes failed node and already disconnected nodes',()=>{
 const adj=N.graph([['A01S001','C01M001'],['C01M001','O01X001'],['A02S002','O02M002']],['A01S001']);
 const r=N.analyze(adj,['A01S001'],'C01M001');
 assert.deepEqual(r.affected,['O01X001']);assert.equal(r.offline.length,2);
});
test('redundant path and multiple gateways maintain connectivity',()=>{
 const links=[['A01S001','C01M001'],['C01M001','O01X001'],['O01X001','A02S002']];
 const adj=N.graph(links,['A01S001','A02S002']);
 assert.deepEqual(N.analyze(adj,['A01S001','A02S002'],'C01M001').affected,[]);
 assert.deepEqual(N.analyze(adj,['A01S001','A02S002'],'A01S001').affected,[]);
 const cycle=N.graph([...links,['A02S002','A01S001']],['A01S001']);
 assert.deepEqual(N.analyze(cycle,['A01S001'],'C01M001').affected,[]);
 assert.equal(N.analyze(cycle,['A01S001'],'A01S001').affected.length,3);
});
