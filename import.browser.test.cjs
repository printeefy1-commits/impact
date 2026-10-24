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
    await page.click('#demo');
    assert.equal(await page.locator('#map svg').count(),0);
    await page.selectOption('#gneSelect','A01S001');
    const visibleNames=()=>page.locator('#map g text').allTextContents();
    assert.deepEqual((await visibleNames()).sort(),['A01S001','A02S002','C01M001','O01X001','O02M002'].sort());
    await page.selectOption('#failure','C01M001');
    assert.equal(await page.locator('#impactCount').textContent(),'1');
    await page.selectOption('#gneSelect','C02X002');
    assert.ok(!(await visibleNames()).includes('A01S001'));
    assert.ok((await visibleNames()).includes('C02X002'));
    assert.equal(await page.locator('#failure').inputValue(),'C01M001');
    await page.fill('#gneSearch','not-found');
    assert.equal(await page.locator('#map svg').count(),0);
    assert.equal(await page.locator('#gneSelect option').count(),1);
    await page.fill('#gneSearch','a01');
    assert.equal(await page.locator('#gneSelect option').count(),2);
    await page.selectOption('#gneSelect','A01S001');
    assert.equal((await visibleNames()).length,5);
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
    assert.match(await page.locator('#importReport').textContent(),/150002/);
    assert.equal(await page.locator('#issues p').count(),200);
    await page.selectOption('#failure','C01M001');
    assert.equal(await page.locator('#impactCount').textContent(),'1');
    await page.evaluate(async()=>{
      for(const [id,rows] of [['links',[['link'],['A_12 X345 site north - C12M3456 microwave'],['C12M3456 duplicate-A12X345 note']]],['gates',[['GNE'],[' C12M3456 gateway description ']]]]){
        const book=new ExcelJS.Workbook();book.addWorksheet('data').addRows(rows);
        const transfer=new DataTransfer();transfer.items.add(new File([await book.xlsx.writeBuffer()],id+'.xlsx'));
        document.getElementById(id).files=transfer.files;
      }
    });
    await page.click('#load');await page.waitForFunction(()=>!document.getElementById('load').disabled);
    assert.equal(await page.locator('#nodesCount').textContent(),'2');
    await page.selectOption('#failure','C12M3456');
    assert.equal(await page.locator('#impactCount').textContent(),'1');
    const exported={};
    for(const [button,name,expected] of [
      ['downloadLinks','cleaned-links.csv','link\r\nA12X345-C12M3456\r\n'],
      ['downloadGates','cleaned-gne.csv','GNE\r\nC12M3456\r\n']
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
    assert.deepEqual(errors,[]);
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
});
