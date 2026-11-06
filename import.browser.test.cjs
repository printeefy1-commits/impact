const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const defaultGates=require('./default-gne');

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
    assert.equal(await page.inputValue('#gneSelect'),'A06X232');
    assert.equal(await page.locator('#map svg').count(),1);
    assert.equal(await page.locator('#downloadLinks').isEnabled(),true);
    const resetGatewayAdditions=async()=>{
      await page.context().setOffline(false);await page.evaluate(()=>localStorage.clear());
      await page.reload();await page.context().setOffline(true);
    };
    assert.equal(await page.locator('#downloadReview, #exportSummary, #demo, #failure, #reset, #impactCount, #report, footer, a[download]').count(),0);
    assert.equal(await page.locator('.intro, #gneSearch').count(),0);
    assert.equal(await page.locator('.map-stage .stats').count(),1);
    assert.equal(await page.locator('.map-stage .canvas-bar').count(),1);
    assert.equal(await page.locator('.legend').count(),0);
    assert.ok(await page.locator('.topbar').evaluate(el=>Math.abs(el.getBoundingClientRect().height-96/2.54)<1));
    assert.ok(await page.evaluate(()=>document.getElementById('mapPanel').getBoundingClientRect().bottom<=innerHeight));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
    for(const [width,height] of [[1920,1080],[1100,650],[900,600],[1280,720]]){
      await page.setViewportSize({width,height});
      assert.ok(await page.evaluate(()=>{
        const map=document.getElementById('mapPanel').getBoundingClientRect(),side=document.querySelector('aside').getBoundingClientRect();
        return map.bottom<=innerHeight&&map.bottom>=innerHeight-20&&Math.abs(map.bottom-side.bottom)<2&&document.documentElement.scrollWidth<=innerWidth;
      }));
    }

    assert.equal(await page.locator('.stats').evaluate(el=>getComputedStyle(el).opacity),'0.5');
    await page.locator('.stats').hover();await page.waitForTimeout(180);
    assert.equal(await page.locator('.stats').evaluate(el=>getComputedStyle(el).opacity),'1');
    await page.mouse.move(0,0);
    assert.equal(await page.locator('.compact-heading #fitMap, .compact-heading #fullscreen, .compact-heading #resetLayout').count(),3);
    assert.ok(await page.locator('#status').evaluate(el=>el.hidden));
    assert.ok(await page.locator('.search-input').evaluate(el=>Math.abs(el.getBoundingClientRect().width-5*96/2.54)<1));
    assert.ok(await page.locator('#gneSelect').evaluate(el=>Math.abs(el.getBoundingClientRect().width-4*96/2.54)<1));
    assert.ok(await page.evaluate(()=>Math.abs(document.querySelector('aside').getBoundingClientRect().bottom-document.querySelector('#mapPanel').getBoundingClientRect().bottom)<2));
    assert.ok(await page.locator('.compact-heading').evaluate(el=>el.getBoundingClientRect().height<=40));
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

    await page.fill('#search','A01S001');
    assert.equal(await page.inputValue('#gneSelect'),'A01S001');
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    // The former replaceChildren(...issues) throws RangeError with this input.
    await resetGatewayAdditions();
    const csv='link\n'+'unmatched\n'.repeat(150000)+'A01S001-C01M001\nC01M001-O01X001\n';
    await page.setInputFiles('#links',{name:'large.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
    await page.setInputFiles('#gates',{name:'gne.csv',mimeType:'text/csv',buffer:Buffer.from('GNE\nA01S001')});
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.locator('#nodesCount').textContent(),String(defaultGates.length+3));
    assert.equal(await page.locator('#map svg').count(),0);
    await page.selectOption('#gneSelect','A01S001');
    assert.equal((await visibleNames()).length,3);
    assert.match(await page.locator('#status').textContent(),/150002/);
    await resetGatewayAdditions();
    await page.evaluate(async()=>{
      for(const [id,rows] of [['links',[['link'],['A_12 X345 site north - C12SU3456 microwave'],['C12SU3456 duplicate-A12X345 note']]],['gates',[['GNE Name','Subnet'],[' C12SU3456 gateway (A12X345) description ','O12S345']]]]){
        const book=new ExcelJS.Workbook();book.addWorksheet('data').addRows(rows);
        const transfer=new DataTransfer();transfer.items.add(new File([await book.xlsx.writeBuffer()],id+'.xlsx'));
        document.getElementById(id).files=transfer.files;
      }
    });
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.locator('#nodesCount').textContent(),String(defaultGates.length+2));
    assert.equal(await page.locator('#gatesCount').textContent(),String(defaultGates.length+1));
    assert.equal(await page.locator('#gneSelect option[value="O12S345"]').count(),0);
    assert.equal(await page.locator('#gneSelect option[value="A12X345"]').count(),0);
    const exported={};
    for(const [button,name,expected] of [
      ['downloadLinks','cleaned-links.csv','Source NE Name,Sink NE Name\r\nA12X345,C12SU3456\r\n'],
      ['downloadGates','cleaned-gne.csv','GNE\r\n'+defaultGates.join('\r\n')+'\r\nC12SU3456\r\n']
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
    assert.equal(await page.locator('#nodesCount').textContent(),String(defaultGates.length+2));
    // A diamond has one real additional edge beyond its displayed spanning tree.
    await page.evaluate(()=>setData([
      ['A01S001','C01M001'],['A01S001','C02M002'],
      ['C01M001','O01X001'],['C02M002','O01X001']
    ],['A01S001']));
    await page.selectOption('#gneSelect','A01S001');
    assert.equal(await page.locator('#map .tree-link').count(),3);
    assert.ok(await page.evaluate(()=>topologyView.edges.every(({a,b,path})=>[[a,'x1','y1'],[b,'x2','y2']].every(([name,x,y])=>{
      const p=topologyView.points.get(name),r=topologyView.attachments.get(name)[0];
      const dx=Number(path.getAttribute(x))-p.x,dy=Number(path.getAttribute(y))-p.y;
      return dx>=r.x-1e-5&&dx<=r.x+r.width+1e-5&&dy>=r.y-1e-5&&dy<=r.y+r.height+1e-5&&Math.min(Math.abs(dx-r.x),Math.abs(dx-r.x-r.width),Math.abs(dy-r.y),Math.abs(dy-r.y-r.height))<1e-5;
    }))));

    assert.equal(await page.evaluate(()=>LayoutClearance.obstacles(topologyView.points,topologyView.parts,topologyView.edges).length),0);
    assert.ok(await page.evaluate(()=>[...topologyView.parts.values()].every(parts=>parts.length===1)));
    assert.ok(await page.evaluate(()=>Boolean(document.querySelector('.topology-edges').compareDocumentPosition(document.querySelector('.topology-nodes'))&Node.DOCUMENT_POSITION_FOLLOWING)));
    assert.equal(await page.locator('.gateway-node .device-icon').getAttribute('transform'),'scale(1.8)');
    assert.equal(await page.locator('.network-node:not(.gateway-node) .device-icon').first().getAttribute('transform'),'scale(1.4)');
    assert.equal(await page.locator('.gateway-node .device-icon > rect').first().getAttribute('fill'),'#f2c230');
    assert.equal(await page.locator('.stats b').first().evaluate(el=>getComputedStyle(el).fontSize),'25.5px');
    assert.equal(await page.locator('#map .node-name').first().evaluate(el=>getComputedStyle(el).fontSize),'29.25px');
    assert.ok(await page.locator('.network-node:not(.gateway-node) .node-label-bg').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).fill==='none')));
    assert.notEqual(await page.locator('.gateway-node .node-label-bg').evaluate(n=>getComputedStyle(n).fill),'none');
    const labelFits=await page.locator('#map .network-node').evaluateAll(nodes=>nodes.every(node=>{
      const text=node.querySelector('.node-name').getBBox(),bg=node.querySelector('.node-label-bg').getBBox();
      return text.x>=bg.x&&text.y>=bg.y&&text.x+text.width<=bg.x+bg.width&&text.y+text.height<=bg.y+bg.height;
    }));
    assert.ok(labelFits);
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
    assert.equal(await page.locator('#zoomLabel').textContent(),'32%');
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
    assert.equal(await root.getAttribute('role'),'button');
    assert.deepEqual({position:await root.getAttribute('transform'),color:await root.locator('rect').first().getAttribute('fill'),count:await page.locator('#nodesCount').textContent()},beforeClick);
    assert.equal(await page.locator('#map .network-node').count(),4);
    await page.fill('#impactSite','A01S001');await page.click('#calculateImpact');
    assert.deepEqual((await page.locator('#impactResult').inputValue()).split(','),['A01S001','C01M001','C02M002','O01X001']);
    await page.fill('#impactSite','C01M001');await page.press('#impactSite','Enter');
    assert.equal(await page.locator('#impactResult').inputValue(),'C01M001,O01X001');
    await page.uncheck('#extraLinks');await page.click('#calculateImpact');
    assert.equal(await page.locator('#impactResult').inputValue(),'C01M001,O01X001');
    await page.check('#extraLinks');
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
    await resetGatewayAdditions();
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
    await page.evaluate(()=>setData([['A44X003','A44X004']],['A44X003']));
    await page.fill('#search','44X004');
    assert.equal(await page.inputValue('#gneSelect'),'A44X003');
    await page.fill('#impactSite','44X003');await page.click('#calculateImpact');
    assert.equal(await page.inputValue('#impactResult'),'A44X003,A44X004');
    const framing=await page.evaluate(()=>{
      const map=document.getElementById('map'),area=map.getBoundingClientRect();
      const bounds=['A44X003','A44X004'].map(name=>document.querySelector('[data-node="'+name+'"]').getBoundingClientRect());
      const cx=(Math.min(...bounds.map(b=>b.left))+Math.max(...bounds.map(b=>b.right)))/2,cy=(Math.min(...bounds.map(b=>b.top))+Math.max(...bounds.map(b=>b.bottom)))/2;
      const contained=['A44X003','A44X004'].every(name=>{
        const b=document.querySelector('[data-node="'+name+'"]').getBoundingClientRect();
        return b.left>=area.left&&b.top>=area.top&&b.right<=area.right&&b.bottom<=area.bottom;
      });
      return {contained,x:(cx-area.left)/area.width,y:(cy-area.top)/area.height};
    });
    assert.ok(framing.contained);
    assert.ok(Math.abs(framing.x-.5)<.005&&Math.abs(framing.y-.5)<.005);

    assert.ok(parseInt(await page.textContent('#zoomLabel'),10)>0);
    await page.click('#zoomIn');
    await page.fill('#search','44X004');
    assert.equal(await page.textContent('#zoomLabel'),'32%');
    await page.fill('#search','A44X003');
    assert.equal(await page.textContent('#zoomLabel'),'32%');
    const assertGatewayCentered=async()=>{
      const position=await page.evaluate(()=>{const area=document.getElementById('map').getBoundingClientRect(),m=document.querySelector('[data-node="A44X003"]').getScreenCTM();return {x:(m.e-area.left)/area.width,y:(m.f-area.top)/area.height};});
      assert.ok(Math.abs(position.x-.5)<.005&&Math.abs(position.y-.5)<.005);
    };
    await assertGatewayCentered();
    await page.selectOption('#gneSelect','A44X003');
    assert.equal(await page.textContent('#zoomLabel'),'32%');await assertGatewayCentered();
    const savedPosition=await page.evaluate(()=>({...topologyView.points.get('A44X004')}));
    await page.evaluate(()=>{const root=topologyView.points.get('A44X003');topologyView.points.set('A44X004',{x:root.x+10000,y:root.y+3000});});
    await page.fill('#search','44X004');
    assert.ok(parseInt(await page.textContent('#zoomLabel'),10)<32);
    await assertGatewayCentered();
    assert.ok(await page.evaluate(()=>{const area=document.getElementById('map').getBoundingClientRect(),b=document.querySelector('[data-node="A44X004"]').getBoundingClientRect();return b.left>=area.left&&b.right<=area.right&&b.top>=area.top&&b.bottom<=area.bottom;}));
    await page.evaluate(position=>topologyView.points.set('A44X004',position),savedPosition);
    await page.fill('#search','A44X003');await page.fill('#search','44X004');
    assert.equal(await page.textContent('#zoomLabel'),'32%');
    await page.fill('#impactSite','44X004');await page.click('#calculateImpact');
    assert.equal(await page.inputValue('#impactResult'),'A44X004');
    await page.setViewportSize({width:520,height:844});
    await page.waitForFunction(()=>{
      const area=document.getElementById('map').getBoundingClientRect(),boxes=['A44X003','A44X004'].map(name=>document.querySelector('[data-node="'+name+'"]').getBoundingClientRect());
      const x=(Math.min(...boxes.map(b=>b.left))+Math.max(...boxes.map(b=>b.right)))/2,y=(Math.min(...boxes.map(b=>b.top))+Math.max(...boxes.map(b=>b.bottom)))/2;
      return boxes.every(b=>b.left>=area.left&&b.right<=area.right&&b.top>=area.top&&b.bottom<=area.bottom)&&Math.abs(x-area.left-area.width/2)<2&&Math.abs(y-area.top-area.height/2)<2;
    });
    // Special sites survive import, lookup, impact, downloads and re-import.
    await resetGatewayAdditions();
    const specialCSV='Source NE Name,Sink NE Name,Link Name\nA16X001,A16-SCE1-PEPSI-050,\nA16SCE1-PEPSI050,NE(160-32630),\nA16SCE1-PEPSI050,A16SE01-sikaalgérie-062_E-band,\nA16X001,A16W1043 EB V,\n,,A16W1043-A16WX1055\n';
    await page.setInputFiles('#links',{name:'special.csv',mimeType:'text/csv',buffer:Buffer.from(specialCSV)});
    await page.setInputFiles('#gates',{name:'special-gne.csv',mimeType:'text/csv',buffer:Buffer.from('GNE\nA16X001\n')});
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.locator('#nodesCount').textContent(),String(defaultGates.length+6));
    await page.fill('#search','A16-SCE1-PEPSI-050');
    assert.equal(await page.locator('#gneSelect').inputValue(),'A16X001');
    assert.ok((await visibleNames()).includes('NE(160-32630)'));
    const longLabel=page.locator('.network-node[data-node="A16SCE1-SIKAALGÉRIE062"] .node-name');
    assert.ok(await longLabel.locator('tspan').count()>1);
    assert.equal(await longLabel.evaluate(el=>getComputedStyle(el).fontSize),'29.25px');
    assert.ok(await page.locator('#map .network-node').evaluateAll(nodes=>nodes.every(node=>{
      const a=node.querySelector('.node-name').getBBox(),b=node.querySelector('.node-label-bg').getBBox();
      return a.x>=b.x&&a.y>=b.y&&a.x+a.width<=b.x+b.width&&a.y+a.height<=b.y+b.height;
    })));
    await page.click('#fitMap');
    await page.fill('#impactSite','A16-SCE1-PEPSI-050');await page.click('#calculateImpact');
    const specialImpact='A16SCE1-PEPSI050,A16SCE1-SIKAALGÉRIE062,NE(160-32630)';
    assert.equal(await page.locator('#impactResult').inputValue(),specialImpact);
    const specialDownload=page.waitForEvent('download');await page.click('#downloadLinks');
    const specialChunks=[];for await(const chunk of await (await specialDownload).createReadStream())specialChunks.push(chunk);
    const specialBuffer=Buffer.concat(specialChunks);
    assert.match(specialBuffer.toString('utf8'),/Source NE Name,Sink NE Name/);
    assert.match(specialBuffer.toString('utf8'),/NE\(160-32630\)/);
    await page.setInputFiles('#links',{name:'cleaned-special.csv',mimeType:'text/csv',buffer:specialBuffer});
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.locator('#nodesCount').textContent(),String(defaultGates.length+6));
    await page.fill('#impactSite','A16SCE1-PEPSI050');await page.click('#calculateImpact');
    assert.equal(await page.locator('#impactResult').inputValue(),specialImpact);
    assert.doesNotMatch(await page.locator('body').innerText(),/[\u0600-\u06ff]/);
    assert.deepEqual(errors,[]);
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
});

test('daily links use built-in GNEs and optional additions persist across reloads',async()=>{
  const html=fs.readFileSync(path.join(__dirname,'athar-offline.html'));
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    assert.deepEqual(await page.evaluate(()=>[...DefaultGNE]),[...defaultGates]);
    assert.equal(await page.locator('#gatewayInfo').count(),0);
    assert.equal(await page.locator('label[for=impactSite]').count(),0);
    assert.match(await page.getAttribute('#impactSite','placeholder'),/NE or GNE name/);
    assert.equal(await page.inputValue('#gneSelect'),'A06X232');
    assert.equal(await page.textContent('#nodesCount'),'5183');
    assert.equal(await page.textContent('#offlineCount'),'0');
    assert.equal(await page.locator('[data-node="A06X232"]').count(),1);
    assert.equal(await page.textContent('#zoomLabel'),'32%');
    assert.equal(await page.locator('#links').evaluate(input=>input.files.length),0);
    const bundledCount=await page.evaluate(()=>state.links.length);
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.evaluate(()=>state.links.length),bundledCount);
    assert.equal(await page.inputValue('#gneSelect'),'A06X232');
    assert.ok(await page.locator('#status').evaluate(el=>el.hidden));
    const links='link\nA16X589-A99X100\nA99X100-A99X101\nO46T078-O46X158\n';
    await page.setInputFiles('#links',{name:'day-one.csv',mimeType:'text/csv',buffer:Buffer.from(links)});
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.textContent('#gatesCount'),'272');
    assert.match(await page.textContent('#status'),/Using 272 GNEs/);
    await page.fill('#search','A99X101');assert.equal(await page.inputValue('#gneSelect'),'A16X589');
    assert.equal(await page.locator('[data-node="A99X101"] .device-icon>rect').first().getAttribute('stroke'),'#ff3038');
    await page.fill('#impactSite','A16X589');await page.click('#calculateImpact');
    assert.equal(await page.inputValue('#impactResult'),'A16X589,A99X100,A99X101');
    assert.ok(await page.locator('.impacted .device-icon>rect:first-child').evaluateAll(nodes=>nodes.every(n=>n.getAttribute('stroke')==='#ff3038')));
    assert.equal(await page.locator('#map .impacted').count(),3);
    assert.ok(await page.locator('#map .impacted').evaluateAll(nodes=>nodes.every(n=>n.querySelector('rect').getAttribute('fill')==='#87929d')));
    await page.fill('#impactSite','A99X101');
    assert.equal(await page.locator('#map .impacted').count(),0);
    await page.setInputFiles('#gates',{name:'new-gates.csv',mimeType:'text/csv',buffer:Buffer.from('GNE\nA99X100_IDU1\nA99X100\nA16X589\n')});
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.textContent('#gatesCount'),'273');
    assert.match(await page.textContent('#status'),/Added 1 new gateway/);
    await page.fill('#search','A99X101');assert.equal(await page.inputValue('#gneSelect'),'A99X100');
    assert.deepEqual(await page.evaluate(()=>state.gates.slice(0,272)),[...defaultGates]);
    const promise=page.waitForEvent('download');await page.click('#downloadGates');const chunks=[];
    for await(const chunk of await(await promise).createReadStream())chunks.push(chunk);
    const exported=Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).slice(1);
    assert.deepEqual(exported,[...defaultGates,'A99X100']);
    await page.reload();
    assert.deepEqual(await page.evaluate(()=>additionalGates),['A99X100']);
    assert.equal(await page.inputValue('#gneSelect'),'A06X232');
    assert.equal(await page.textContent('#gatesCount'),'273');
    await page.setInputFiles('#gates',{name:'gate-only.csv',mimeType:'text/csv',buffer:Buffer.from('GNE\nA16X617\n')});
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.textContent('#gatesCount'),'274');
    assert.ok(await page.evaluate(()=>state.assignment.owner.get('A16X617')==='A16X617'));
    // This temporary gate-only test must not affect the following daily-import assertions.
    await page.evaluate(()=>{additionalGates=['A99X100'];localStorage.setItem(gatewayStorageKey,JSON.stringify(additionalGates));});
    await page.setInputFiles('#gates',[]);
    assert.equal(await page.locator('#gates').evaluate(input=>input.files.length),0);
    await page.setInputFiles('#links',{name:'day-two.csv',mimeType:'text/csv',buffer:Buffer.from('link\nA16X589-A99X100\nA99X100-A99X101\nA99X101-A99X102\n')});
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.textContent('#gatesCount'),'273');
    await page.fill('#search','A99X102');assert.equal(await page.inputValue('#gneSelect'),'A99X100');
    await page.fill('#impactSite','A99X100');await page.click('#calculateImpact');
    assert.equal(await page.inputValue('#impactResult'),'A99X100,A99X101,A99X102');
    // Failed optional imports leave the working network and saved list intact.
    await page.setInputFiles('#gates',{name:'empty.csv',mimeType:'text/csv',buffer:Buffer.from('GNE\n')});
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.match(await page.textContent('#status'),/optional GNE file contains no gateway names/);
    assert.equal(await page.textContent('#gatesCount'),'273');
    // If persistence is blocked, additions still work for the current session.
    await page.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('Storage blocked');};});
    await page.setInputFiles('#gates',{name:'another-gate.csv',mimeType:'text/csv',buffer:Buffer.from('GNE\nA99X102\n')});
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.textContent('#gatesCount'),'274');
    assert.match(await page.textContent('#status'),/Browser storage is unavailable/);
    await page.setInputFiles('#gates',[]);await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.textContent('#gatesCount'),'274');
    assert.deepEqual(errors,[]);
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Ctrl selection moves a group and replaces search highlighting; hover darkens icons',async()=>{
 const html=fs.readFileSync(path.join(__dirname,'athar-offline.html'));
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1600,height:1200}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(()=>setData([['A01S001','C01M001'],['A01S001','O01X001'],['A01S001','A02S002']],['A01S001']));
  await page.fill('#search','C01M001');await page.click('#fitMap');
  const node=name=>page.locator(`[data-node="${name}"]`),icon=name=>node(name).locator('.device-icon>rect').first();
  await node('C01M001').locator('.node-name').hover();
  assert.equal(await icon('C01M001').evaluate(el=>getComputedStyle(el).fill),'rgb(7, 91, 56)');
  assert.equal(await page.locator('.highlighted').count(),1);
  await icon('C01M001').click();
  assert.equal(await page.locator('.highlighted').count(),0);
  assert.equal(await page.inputValue('#search'),'');
  assert.equal(await node('C01M001').getAttribute('aria-pressed'),'true');
  await icon('O01X001').click({modifiers:['Control']});
  assert.equal(await page.locator('.selected').count(),2);
  const before=await page.evaluate(()=>Object.fromEntries([...topologyView.points].map(([n,p])=>[n,{...p}])));
  const edgeBefore=await page.locator('.tree-link').first().getAttribute('x2');
  const box=await icon('C01M001').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2+30,{steps:6});await page.mouse.up();
  const after=await page.evaluate(()=>Object.fromEntries(topologyView.points));
  const dx=after.C01M001.x-before.C01M001.x,dy=after.C01M001.y-before.C01M001.y;
  assert.ok(dx>0&&dy>0);
  assert.ok(Math.abs(after.O01X001.x-before.O01X001.x-dx)<1e-6);
  assert.ok(Math.abs(after.O01X001.y-before.O01X001.y-dy)<1e-6);
  assert.deepEqual(after.A01S001,before.A01S001);assert.deepEqual(after.A02S002,before.A02S002);
  assert.notEqual(await page.locator('.tree-link').first().getAttribute('x2'),edgeBefore);
  assert.equal(await page.locator('.selected').count(),2);
  await page.mouse.move(0,0);
  for(const name of ['C01M001','O01X001'])assert.equal(await icon(name).evaluate(el=>getComputedStyle(el).stroke),'rgb(255, 48, 56)');
  const controlBox=await icon('C01M001').boundingBox();
  await page.keyboard.down('Control');
  await page.mouse.move(controlBox.x+controlBox.width/2,controlBox.y+controlBox.height/2);await page.mouse.down();
  await page.mouse.move(controlBox.x+controlBox.width/2+20,controlBox.y+controlBox.height/2+10,{steps:4});await page.mouse.up();await page.keyboard.up('Control');
  assert.equal(await page.locator('.selected').count(),2);
  await page.uncheck('#extraLinks');await page.check('#extraLinks'); // Rerendering the same map preserves selection.
  assert.equal(await page.locator('.selected').count(),2);
  await icon('O01X001').click({modifiers:['Control']});assert.equal(await page.locator('.selected').count(),1);
  await node('C01M001').press('Escape');assert.equal(await page.locator('.selected').count(),0);
  await page.fill('#search','A02S002');assert.equal(await page.locator('.highlighted').count(),1);
  await node('C01M001').press('Enter');assert.equal(await page.locator('.highlighted').count(),0);
  await node('O01X001').press('Control+Space');assert.equal(await page.locator('.selected').count(),2);
  await page.fill('#search','A01S001');assert.equal(await page.locator('.selected').count(),0);
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
