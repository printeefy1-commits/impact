const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');

test('standalone edition imports large CSV reports and XLSX without argument overflow',async()=>{
  const html=fs.readFileSync(path.join(__dirname,'athar-offline.html'));
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.context().setOffline(true);
    assert.equal(await page.locator('#downloadReview, #exportSummary, #demo, #failure, #reset, #impactCount, #report, footer, a[download]').count(),0);
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
    assert.doesNotMatch(await page.locator('body').innerText(),/[\u0600-\u06ff]/);
    await page.setInputFiles('#links',{name:'network.csv',mimeType:'text/csv',buffer:Buffer.from('link\nA01S001-C01M001\nC01M001-O01X001\nC01M001-A02S002\nA02S002-O02M002\nC02X002-O02M002\nA03X003-C03S003\n')});
    await page.setInputFiles('#gates',{name:'gne.csv',mimeType:'text/csv',buffer:Buffer.from('GNE\nA01S001\nC02X002\n')});
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.locator('#offlineCount').textContent(),'2');
    assert.equal(await page.locator('#map svg').count(),0);
    await page.selectOption('#gneSelect','A01S001');
    const visibleNames=()=>page.locator('#map .node-name').allTextContents();
    assert.deepEqual((await visibleNames()).sort(),['A01S001','A02S002','C01M001','O01X001'].sort());
    await page.selectOption('#gneSelect','C02X002');
    assert.ok(!(await visibleNames()).includes('A01S001'));
    assert.ok((await visibleNames()).includes('C02X002'));
    await page.fill('#search','O01X001');
    assert.equal(await page.locator('#gneSelect').inputValue(),'A01S001');
    assert.ok((await visibleNames()).includes('O01X001'));
    assert.match(await page.locator('#searchStatus').textContent(),/O01X001 → A01S001/);
    await page.fill('#search','O02M002');
    assert.equal(await page.locator('#gneSelect').inputValue(),'C02X002');
    assert.ok((await visibleNames()).includes('O02M002'));
    await page.fill('#search','A03X003');
    assert.equal(await page.locator('#map svg').count(),0);
    assert.match(await page.locator('#searchStatus').textContent(),/no route/);
    await page.fill('#search','O99X999');
    assert.equal(await page.locator('#map svg').count(),0);
    assert.match(await page.locator('#searchStatus').textContent(),/No match/);

    await page.fill('#gneSearch','not-found');
    assert.equal(await page.locator('#map svg').count(),0);
    assert.equal(await page.locator('#gneSelect option').count(),1);
    await page.fill('#gneSearch','a01');
    assert.equal(await page.locator('#gneSelect option').count(),2);
    await page.selectOption('#gneSelect','A01S001');
    assert.equal((await visibleNames()).length,4);
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    // The former replaceChildren(...issues) throws RangeError with this input.
    const csv='link\n'+'unmatched\n'.repeat(150000)+'A01S001-C01M001\nC01M001-O01X001\n';
    await page.setInputFiles('#links',{name:'large.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
    await page.setInputFiles('#gates',{name:'gne.csv',mimeType:'text/csv',buffer:Buffer.from('GNE\nA01S001')});
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.locator('#nodesCount').textContent(),'3');
    assert.equal(await page.locator('#map svg').count(),0);
    await page.selectOption('#gneSelect','A01S001');
    assert.equal((await visibleNames()).length,3);
    assert.match(await page.locator('#status').textContent(),/150002/);
    await page.evaluate(async()=>{
      for(const [id,rows] of [['links',[['link'],['A_12 X345 site north - C12SU3456 microwave'],['C12SU3456 duplicate-A12X345 note']]],['gates',[['GNE Name','Subnet'],[' C12SU3456 gateway (A12X345) description ','O12S345']]]]){
        const book=new ExcelJS.Workbook();book.addWorksheet('data').addRows(rows);
        const transfer=new DataTransfer();transfer.items.add(new File([await book.xlsx.writeBuffer()],id+'.xlsx'));
        document.getElementById(id).files=transfer.files;
      }
    });
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.locator('#nodesCount').textContent(),'2');
    assert.equal(await page.locator('#gatesCount').textContent(),'1');
    assert.equal(await page.locator('#gneSelect option[value="O12S345"]').count(),0);
    assert.equal(await page.locator('#gneSelect option[value="A12X345"]').count(),0);
    const exported={};
    for(const [button,name,expected] of [
      ['downloadLinks','cleaned-links.csv','link\r\nA12X345-C12SU3456\r\n'],
      ['downloadGates','cleaned-gne.csv','GNE\r\nC12SU3456\r\n']
    ]){
      const downloadPromise=page.waitForEvent('download');await page.click('#'+button);
      const download=await downloadPromise;assert.equal(download.suggestedFilename(),name);
      const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
      const data=Buffer.concat(chunks);assert.equal(data.toString('utf8').replace(/^\uFEFF/,''),expected);
      exported[button]=data;
    }
    // Exported files can be re-imported without changing the resulting topology.
    await page.setInputFiles('#links',{name:'cleaned-links.csv',mimeType:'text/csv',buffer:exported.downloadLinks});
    await page.setInputFiles('#gates',{name:'cleaned-gne.csv',mimeType:'text/csv',buffer:exported.downloadGates});
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.locator('#nodesCount').textContent(),'2');
    // A diamond has one real additional edge beyond its displayed spanning tree.
    await page.evaluate(()=>setData([
      ['A01S001','C01M001'],['A01S001','C02M002'],
      ['C01M001','O01X001'],['C02M002','O01X001']
    ],['A01S001']));
    await page.selectOption('#gneSelect','A01S001');
    assert.equal(await page.locator('#map .tree-link').count(),3);
    assert.equal(await page.locator('#extraCount').textContent(),'1');
    assert.notEqual(await page.locator('#map .extra-link').getAttribute('display'),'none');
    await page.uncheck('#extraLinks');
    assert.equal(await page.locator('#map .extra-link').getAttribute('display'),'none');
    await page.check('#extraLinks');
    assert.notEqual(await page.locator('#map .extra-link').getAttribute('display'),'none');
    assert.equal(await page.locator('#map .node-type').allTextContents().then(a=>a.filter(t=>t==='GNE').length),1);
    // Reciprocal/repeated physical records must not draw parallel edges.
    await page.evaluate(()=>{state.links.push(['C01M001','A01S001'],['A01S001','C01M001']);draw();});
    assert.equal(await page.locator('#map .topology-edges > line').count(),4);
    assert.equal(await page.locator('#map .topology-edges > path').count(),0);
    assert.equal(await page.locator('#zoomLabel').textContent(),'100%');
    const oldZoom=await page.locator('#zoomLabel').textContent();
    await page.click('#zoomIn');assert.notEqual(await page.locator('#zoomLabel').textContent(),oldZoom);
    await page.click('#centerMap');assert.equal(await page.locator('#zoomLabel').textContent(),'100%');
    await page.locator('#map').scrollIntoViewIfNeeded();
    const root=page.locator('#map .network-node[data-node="A01S001"]');
    const initialPosition=await root.getAttribute('transform'),box=await root.locator('rect').first().boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await page.mouse.move(box.x+box.width/2+35,box.y+box.height/2+20,{steps:5});await page.mouse.up();
    assert.notEqual(await root.getAttribute('transform'),initialPosition);
    const cameraBefore=await page.evaluate(()=>({...topologyView.camera}));
    const canvas=await page.locator('#map').boundingBox();
    await page.mouse.move(canvas.x+8,canvas.y+100);await page.mouse.down();
    await page.mouse.move(canvas.x+38,canvas.y+125,{steps:5});await page.mouse.up();
    const cameraAfter=await page.evaluate(()=>({...topologyView.camera}));
    assert.ok(cameraAfter.x>cameraBefore.x&&cameraAfter.y>cameraBefore.y);
    await page.click('#resetLayout');
    assert.equal(await root.getAttribute('transform'),initialPosition);
    // Nodes remain draggable graphics; clicking or pressing Enter no longer starts a fault.
    const beforeClick={position:await root.getAttribute('transform'),color:await root.locator('rect').first().getAttribute('fill'),count:await page.locator('#nodesCount').textContent()};
    await root.click();await root.press('Enter');
    assert.equal(await root.getAttribute('role'),'img');
    assert.deepEqual({position:await root.getAttribute('transform'),color:await root.locator('rect').first().getAttribute('fill'),count:await page.locator('#nodesCount').textContent()},beforeClick);
    assert.equal(await page.locator('#map .network-node').count(),4);
    await page.fill('#impactSite','A01S001');await page.click('#calculateImpact');
    assert.deepEqual((await page.locator('#impactResult').inputValue()).split(','),['A01S001','C01M001','C02M002','O01X001']);
    await page.fill('#impactSite','C01M001');await page.press('#impactSite','Enter');
    assert.equal(await page.locator('#impactResult').inputValue(),'C01M001');
    await page.fill('#impactSite','O99X999');await page.click('#calculateImpact');
    assert.equal(await page.locator('#impactResult').inputValue(),'');
    assert.match(await page.locator('#impactSummary').textContent(),/not found/);
    await page.evaluate(()=>setData([['A01S001','C01M001'],['C01M001','O01X001'],['O01X001','A02S002'],['C01M001','C02M002']],['A01S001','A02S002']));
    await page.selectOption('#gneSelect','A01S001');
    await page.fill('#impactSite','C01M001');await page.click('#calculateImpact');
    assert.equal(await page.locator('#impactResult').inputValue(),'C01M001,C02M002');
    await page.selectOption('#gneSelect','A02S002');
    assert.equal(await page.locator('#impactResult').inputValue(),'C01M001,C02M002');
    assert.match(await page.locator('#impactSummary').textContent(),/A01S001/);
    assert.ok(!(await visibleNames()).includes('C01M001'));
    // File order wins equal-hop ties even though the dropdown is sorted by name.
    await page.setInputFiles('#links',{name:'equal.csv',mimeType:'text/csv',buffer:Buffer.from('link\nA01S001-C01M001\nA02S002-C01M001\nC01M001-O01X001\n')});
    await page.setInputFiles('#gates',{name:'ordered-gne.csv',mimeType:'text/csv',buffer:Buffer.from('GNE\nA02S002\nA01S001\n')});
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    await page.selectOption('#gneSelect','A01S001');assert.deepEqual(await visibleNames(),['A01S001']);
    await page.selectOption('#gneSelect','A02S002');assert.deepEqual((await visibleNames()).sort(),['A02S002','C01M001','O01X001'].sort());
    await page.fill('#impactSite','A02S002');await page.click('#calculateImpact');
    assert.deepEqual((await page.locator('#impactResult').inputValue()).split(','),['A02S002','C01M001','O01X001']);
    await page.evaluate(()=>setData([['A01S001','C01M001'],['C01M001','O01X001'],['O01X001','C02M002'],['C02M002','A02S002']],['A01S001','A02S002']));
    await page.selectOption('#gneSelect','A01S001');
    await page.fill('#impactSite','C01M001');await page.click('#calculateImpact');
    assert.equal(await page.locator('#impactResult').inputValue(),'C01M001,O01X001');
    await page.selectOption('#gneSelect','A02S002');
    assert.equal(await page.locator('#impactResult').inputValue(),'C01M001,O01X001');
    assert.doesNotMatch(await page.locator('body').innerText(),/[\u0600-\u06ff]/);
    assert.deepEqual(errors,[]);
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
});
