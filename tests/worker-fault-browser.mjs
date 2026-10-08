// Explicit fault injection only: this test does not perform AI inference.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:'inherit'}),base='http://127.0.0.1:4173';
let browser;
try{
  for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage();
  await page.goto(base+'/scenario-lab/');
  await page.waitForFunction(()=>document.querySelector('#model-info').textContent.includes('Included model:'),null,{timeout:30000});
  const result=await page.evaluate(async()=>{
    const {importResponse}=await import('/scenario-lab/core.mjs'),{newJob,runJob}=await import('/scenario-lab/runner.mjs?v=research-v2-1'),{LocalStore}=await import('/scenario-lab/storage.mjs');
    const store=await new LocalStore().open();
    const evidence=await importResponse('ctgov','Synthetic fault fixture',{studies:[{protocolSection:{identificationModule:{nctId:'NCT00000001',briefTitle:'Synthetic fault fixture'}}}]});await store.freeze(evidence);
    const job=await newJob({title:'Synthetic fault injection',question:'Test error reporting only?',assumptions:['Synthetic injected error; no model inference'],agents:1,rounds:1,research_only:true,public_data_only:true,reviewed:true},evidence,{id:'synthetic-fault-test',revision:'synthetic'});
    try{await runJob(job,{store,envelope:evidence,generate:async()=>{throw Object.create({get message(){return 'Synthetic GPU buffer allocation failed: out of memory';},get name(){return 'GPUOutOfMemoryError';}});}});}catch{}
    return {state:job.state,steps:job.next_step,error:job.error};
  });
  assert.equal(result.state,'failed');assert.equal(result.steps,0);
  await page.reload();await page.locator('[data-scenario]').first().click();
  await page.waitForFunction(()=>document.querySelector('#detail').textContent.includes('GPUOutOfMemoryError'),null,{timeout:30000});
  const detail=await page.locator('#detail').innerText();assert.match(detail,/Synthetic GPU buffer allocation failed: out of memory/);assert.match(detail,/0 \/ 1 saved interactions/);assert.doesNotMatch(detail,/\[object Object\]/);
  // Real Cesium/WebGL rendering with clearly synthetic, injected provider coordinates.
  const failures=[];page.on('pageerror',e=>failures.push(e.message));
  await page.locator('[data-tab=world]').click();await page.locator('#globe canvas').waitFor({state:'visible',timeout:30000});
  assert.match(await page.locator('#detail').innerText(),/No source-reported trial coordinates/);
  await page.route('https://clinicaltrials.gov/api/v2/studies*',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({studies:[{protocolSection:{identificationModule:{nctId:'NCT00000002',briefTitle:'Synthetic geography fixture'},contactsLocationsModule:{locations:[{facility:'Synthetic fixture facility',geoPoint:{lat:20,lon:77}}]}}}]})}));
  await page.locator('[data-tab=overview]').click();await page.locator('#public-only').check();await page.locator('#concepts').fill('Synthetic geography fixture');
  const sources=page.locator('#sources input');for(let i=0;i<await sources.count();i++)await sources.nth(i).uncheck();await page.locator('#sources input[value=ctgov]').check();
  await page.locator('#retrieve').click();await page.waitForFunction(()=>document.querySelector('#snapshot-summary').textContent.includes('1 record occurrences'),null,{timeout:30000});
  await page.locator('[data-tab=world]').click();await page.locator('#globe canvas').waitFor({state:'visible',timeout:30000});
  assert.match(await page.locator('#detail').innerText(),/Synthetic fixture facility/);
  await page.waitForTimeout(2000);assert.doesNotMatch(await page.locator('#globe').innerText(),/Globe unavailable/);assert.deepEqual(failures,[]);
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/geography.png'});
  await page.locator('[data-tab=simulation]').click();await page.locator('[data-tab=world]').click();await page.locator('#globe canvas').waitFor({state:'visible',timeout:30000});
  // Exercise the actual application against hosting HTML in place of JSON.
  await page.route('**/assets/browser-ai/manifest.json',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Checking your browser</title>'}));
  await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('HTML page'),null,{timeout:30000});
  assert.match(await page.locator('#status').innerText(),/assets\/browser-ai\/manifest.json/);
  assert.doesNotMatch(await page.locator('#status').innerText(),/SyntaxError|Unexpected token/);
  await page.unroute('**/assets/browser-ai/manifest.json');
  await page.route('**/scenario-lab/entity-aliases.json',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Missing file</title>'}));
  await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('HTML page'),null,{timeout:30000});
  assert.match(await page.locator('#status').innerText(),/scenario-lab\/entity-aliases.json/);
  await writeFile('test-results/worker-fault.json',JSON.stringify({passed:true,method:'Synthetic injected error, not AI inference',result,geography:'Actual Cesium module/WebGL globe rendered with synthetic provider coordinates and after tab switches',hosting:'Actual UI rejects injected HTML for model manifest and entity aliases with endpoint-specific diagnostics'},null,2));
  console.log('Browser fault UI and zero-progress checkpoint verified.');
}finally{await browser?.close();server.kill();}
