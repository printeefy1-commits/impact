const {test}=require('node:test');
const assert=require('node:assert/strict');
const N=require('./network.js');
test('extract allowed prefixes, S/M/X/T, lengths, and internal separators',()=>{
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
test('GNE keeps the primary name and rejects unsupported primary types instead of using annotations',()=>{
 assert.equal(N.primaryName('A12X345 Main site (C12M3456)_IDU1'),'A12X345');
 assert.equal(N.primaryName('A12Z345 (C12M3456)'), '');
 assert.equal(N.primaryName('A12X345_6900'),'A12X345');
 assert.equal(N.primaryName('A12X34567'),'');
 assert.deepEqual(N.extract('A12X345_6900-C12M3456 IDU1'),['A12X345','C12M3456']);
});
test('GNE table reads the name column only, never subnet names',()=>{
 const result=N.parseGates([
  {value:'Subnet',row:1,column:1},{value:'GNE Name',row:1,column:2},
  {value:'O12S345',row:2,column:1},{value:'A12X345 Primary (C12M3456)',row:2,column:2},
  {value:'O12S345',row:3,column:1},{value:'A12X345_IDU2',row:3,column:2},
  {value:'C12M3456',row:4,column:1},{value:'A12Z345 (C12M3456)',row:4,column:2}
 ]);
 assert.equal(result.column,2);assert.deepEqual(result.valid,[['A12X345'],['A12X345']]);
 assert.equal(result.review[2][3],'مكرر بعد التنظيف');assert.equal(result.review[3][2],'');
});
test('T is accepted for primary GNE names, links, and both numeric lengths',()=>{
 assert.equal(N.primaryName('O48T084_IDU1'),'O48T084');
 assert.equal(N.primaryName('a 12 t 3456_Site (C12M3456)'),'A12T3456');
 assert.deepEqual(N.parseCells([{value:'O48T084_IDU1-C12T3456_RTN'}],2).valid,[['O48T084','C12T3456']]);
 assert.deepEqual(N.parseGates([{value:'GNE Name',column:1,row:1},{value:'O48T084_IDU1',column:1,row:2}]).valid,[['O48T084']]);
});
test('SU is a two-letter type in primary names, links and future GNE imports',()=>{
 assert.equal(N.primaryName('O01SU478_IDU1'),'O01SU478');
 assert.equal(N.primaryName('a 12 su 3456 (C12M3456)'),'A12SU3456');
 assert.deepEqual(N.extract('O01SU478-C12T3456'),['O01SU478','C12T3456']);
 assert.equal(N.primaryName('O01SU47890'),'');
 assert.deepEqual(N.parseGates([{value:'GNE'},{value:'O01SU478_IDU1'},{value:'O01SU478_IDU2'}]).valid,[['O01SU478'],['O01SU478']]);
});
test('approved corrections are applied consistently on every subsequent upload',()=>{
 const cells=[{value:'GNE Name'},...['O01-CA-BBM','O01CA_Aoulef','A33CA03 djaneT (AT)-','A33CA02 ain aminas','A33CA01 illizi____','A11CA-Ain-Guezzam','A11CA02 ain salah','A11CA01','A33CABordj alhaouas'].map(value=>({value}))];
 const expected=['CA-BBM','O01CA03','A33CA03','A33CA02','A33CA01','A11CA03','A11CA02','A11CA01','A33CA04'];
 for(let upload=0;upload<2;upload++)assert.deepEqual(N.parseGates(cells).valid.flat(),expected);
});
test('link title variants resolve to approved GNE identities',()=>{
 assert.deepEqual(N.extract('A11X013-CA AT Ain Guezzam-HW'),['A11X013','A11CA03']);
 assert.deepEqual(N.extract('CA_AT_BBM-O01X026'),['CA-BBM','O01X026']);
 assert.deepEqual(N.extract('A33CABorj alhaoues-A33X015'),['A33CA04','A33X015']);
 assert.deepEqual(N.extract('O01CA_Timimoune-O01T033-SDB-18G'),['O01CA02','O01T033']);
 assert.equal(N.primaryName('O01CA_Timimoune ___ FO AT to O01X127'),'O01CA02');
});
test('MLR imports source and sink identities, excludes other columns and keeps unknown names unresolved',()=>{
 const result=N.parseLinks([
  {row:1,column:1,value:'Link Name'},{row:1,column:3,value:'Source NE Name'},{row:1,column:8,value:'Sink NE Name'},
  {row:2,column:1,value:'an ambiguous title'},{row:2,column:3,value:'A11X013'},{row:2,column:8,value:'A11CA-Ain-Guezzam'},
  {row:2,column:6,value:'O12S345-C12X345'},
  {row:3,column:3,value:'O01T033'},{row:3,column:8,value:'unapproved site name'}
 ]);
 assert.equal(result.mode,'endpoints');assert.deepEqual(result.valid,[['A11X013','A11CA03']]);assert.equal(result.invalid.length,1);
 assert.deepEqual(N.parseLinks([{row:1,column:1,value:'Link Name'},{row:2,column:1,value:'CA_AT_BBM-O01X026'},{row:2,column:2,value:'A12S345-O12M345'}]).valid,[['CA-BBM','O01X026']]);
});
test('CA site identifiers and the special CA-BBM gateway remain importable',()=>{
 for(const name of ['O01CA03','A33CA03','A33CA02','A33CA01','A11CA03','A11CA02','A11CA01','CA-BBM'])assert.equal(N.primaryName(name),name);
 assert.equal(N.primaryName('O01-CA-BBM'),'CA-BBM');
 assert.equal(N.primaryName('O01CA_Aoulef'),'O01CA03');
 assert.equal(N.primaryName('A11CA-Ain-Guezzam'),'A11CA03');
 assert.equal(N.primaryName('A33CABordj alhaouas'),'A33CA04');
 assert.deepEqual(N.extract('A33CABordj alhaouas-A33CA01'),['A33CA04','A33CA01']);
 assert.equal(N.primaryName('A33CA03 description'),'A33CA03');
 assert.equal(N.primaryName('A33CA003'),'');
 assert.deepEqual(N.extract('CA-BBM-O01CA03'),['CA-BBM','O01CA03']);
 assert.deepEqual(N.extract('A11CA03-O48T084'),['A11CA03','O48T084']);
 assert.deepEqual(N.extract('A11CA-Ain-Guezzam-O01CA_Aoulef'),['A11CA03','O01CA03']);
 assert.equal(N.primaryName('unrecognized A11CA03'),'');
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
test('selected gateway branch stops at other gateways, excludes disconnected nodes, and handles shared paths',()=>{
 const adj=N.graph([['A01S001','C01M001'],['C01M001','O01X001'],['O01X001','A02S002'],['A02S002','C02M002'],['A03S003','C03M003']],['A01S001','A02S002','O04X004']);
 const gates=['A01S001','A02S002','O04X004'];
 assert.deepEqual([...N.branch(adj,gates,'A01S001').visited],['A01S001','C01M001','O01X001']);
 assert.deepEqual([...N.branch(adj,gates,'O04X004').visited],['O04X004']);
 assert.equal(N.branch(adj,gates,'').visited.size,0);
 const other=N.branch(adj,gates,'A02S002');
 assert.ok(other.visited.has('O01X001'));assert.ok(other.visited.has('C02M002'));
 assert.ok(!other.visited.has('A01S001'));assert.ok(!other.visited.has('A03S003'));
 // The other gateway still supplies alternate connectivity during a failure.
 assert.deepEqual(N.analyze(adj,gates,'C01M001').affected,[]);
});
