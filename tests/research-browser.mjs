// Explicit synthetic action fixtures for UI/recovery testing; not AI inference.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4173',server=spawn(process.execPath,['tools/serve.mjs'],{stdio:'inherit'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/scenario-lab/');await page.waitForFunction(()=>document.querySelector('#model-info').textContent.includes('Included model:'));
 const result=await page.evaluate(async()=>{
  const {importResponse}=await import('/scenario-lab/core.mjs'),{newResearchJob,runResearchJob}=await import('/scenario-lab/research-engine.mjs'),{budgetContext}=await import('/scenario-lab/context-budget.mjs'),{LocalStore}=await import('/scenario-lab/storage.mjs');
  const store=await new LocalStore().open(),evidence=await importResponse('ctgov','Synthetic UI fixture',{studies:[{protocolSection:{identificationModule:{nctId:'NCT00000001',briefTitle:'Synthetic supply fixture'},descriptionModule:{briefSummary:'Synthetic public research excerpt for supply verification. No clinical data.'}}}]});await store.freeze(evidence);
  const job=await newResearchJob({title:'Synthetic enhanced UI fixture',question:'Which supply evidence needs verification?',assumptions:['Hypothetical meeting'],agents:2,rounds:2,research_only:true,public_data_only:true,reviewed:true},evidence,{id:'synthetic-ui-fixture',revision:'synthetic'});
  await runResearchJob(job,{store,envelope:evidence,prepare:ctx=>budgetContext(ctx,async request=>({prompt_tokens:Math.ceil(request.prompt.length/3),schema_allowance:100,output_reserve:192,safety_margin:128,total_reserved:Math.ceil(request.prompt.length/3)+420})),generate:async(prompt,signal,refs)=>JSON.stringify({action:'request_verification',target:refs[0],statement:'Synthetic request only',references:[refs[0]],uncertainty:'Verify provider context.'})});return {id:job.id,tick:job.environment.tick};
 });
 await page.reload();await page.locator('[data-scenario]').first().click();await page.waitForFunction(()=>document.querySelector('#detail').textContent.includes('completed'));
 assert.match(await page.locator('#detail').innerText(),/4 \/ 4 saved interactions/);
 await page.locator('[data-tab=network]').click();await page.locator('#agent-network').waitFor({state:'visible'});assert.equal(await page.locator('.event-node').count(),4);assert.ok(await page.locator('.network-edge.observation').count()>0);
 await page.locator('.event-node').first().focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#agent-dialog').isVisible(),true);assert.match(await page.locator('#agent-detail').innerText(),/Evidence supplied to this agent/);assert.match(await page.locator('#agent-detail').innerText(),/ASSUMPTION/);await page.locator('#close-dialog').click();
 await page.locator('[data-tab=agents]').click();await page.locator('[data-agent="0"]').click();assert.match(await page.locator('#agent-detail').innerText(),/Own saved statements/);assert.match(await page.locator('#agent-detail').innerText(),/Other-agent observations/);await page.locator('#close-dialog').click();
 await page.locator('[data-tab=report]').click();assert.match(await page.locator('#detail').innerText(),/source-field excerpts|Exact provider-field excerpts/);assert.match(await page.locator('#detail').innerText(),/No clinical\/geographic forecast/);
 const download=page.waitForEvent('download');await page.locator('#export-run').click();await mkdir('test-results',{recursive:true});await (await download).saveAs('test-results/enhanced-ui-export.json');
 await page.locator('[data-tab=network]').click();await page.screenshot({path:'test-results/enhanced-network.png',fullPage:true});
 await page.evaluate(async id=>{const {LocalStore}=await import('/scenario-lab/storage.mjs');const store=await new LocalStore().open(),job=await store.get(id);job.environment.tick++;await store.save(job);},result.id);
 await page.reload();await page.locator('[data-scenario]').first().click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('environment'));
 assert.deepEqual(errors,[]);await writeFile('test-results/research-ui.json',JSON.stringify({passed:true,scope:'Synthetic action UI fixtures; no AI inference',checks:['Interactive network and keyboard inspection','Separate own/observed memory','Excerpt provenance, report and export','Reload integrity rejects altered state'],ticks:result.tick},null,2));
}finally{await browser?.close();server.kill();}
