// Browser integration uses clearly synthetic provider fixtures; the model is real.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),base='http://127.0.0.1:4173';
await mkdir(new URL('test-results/',root),{recursive:true});
const server=spawn(process.execPath,['tools/serve.mjs'],{cwd:root,stdio:'inherit'});
let browser,page,context,profile;
const results={checks:[],externalRequests:[],inference:null,errors:[]};
try{
  for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  // A normal disk-backed profile is required for this multi-gigabyte model.
  // Incognito contexts use a smaller memory-backed storage quota.
  profile=await mkdtemp(path.join(tmpdir(),'oncotics-browser-'));
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,acceptDownloads:true,args:['--enable-unsafe-webgpu','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
  browser=context.browser();
  page=await context.newPage();
  page.on('pageerror',e=>results.errors.push(e.message));
  context.on('requestfailed',r=>console.error('REQUEST_FAILED',new URL(r.url()).pathname,r.failure()?.errorText));
  page.on('console',msg=>{if(['error','warning'].includes(msg.type())||msg.text().startsWith('AI_STAGE'))console.log('BROWSER_CONSOLE',msg.type(),msg.text());});
  context.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))results.externalRequests.push(r.url());});
  await context.route('https://clinicaltrials.gov/api/v2/studies*',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({studies:[{protocolSection:{identificationModule:{nctId:'NCT00000001',briefTitle:'Synthetic CI fixture: stakeholder research coordination'},descriptionModule:{briefSummary:'Synthetic research coordination fixture only. A hypothetical meeting identifies source verification gaps. No clinical findings.'},contactsLocationsModule:{locations:[{facility:'Synthetic CI facility',geoPoint:{lat:20,lon:77}}]}}}]})}));
  await page.goto(base+'/scenario-lab/');
  await page.waitForFunction(()=>document.querySelector('#model-info').textContent.includes('Included model:'),null,{timeout:60000});
  assert.match(await page.title(),/Scenario Lab/);
  await page.locator('#public-only').check();
  await page.locator('#concepts').fill('test research');
  const sources=page.locator('#sources input');for(let i=0;i<await sources.count();i++)await sources.nth(i).uncheck();
  await page.locator('#sources input[value=ctgov]').check();
  await page.locator('#retrieve').click();
  await page.waitForFunction(()=>document.querySelector('#snapshot-summary').textContent.includes('1 record occurrences'),null,{timeout:30000});
  assert.match(await page.locator('#detail').innerText(),/FACT/);
  results.checks.push('Evidence-first retrieval, raw receipt, source labeling and graph preserved.');
  await page.locator('[data-tab=overview]').click();
  await page.locator('[name=title]').fill('Synthetic CI scenario');
  await page.locator('[name=question]').fill('What evidence gap should stakeholders verify? Use at most six words for the statement and three words for uncertainty.');
  await page.locator('[name=assumptions]').fill('Assume stakeholders meet to identify research evidence gaps.');
  await page.locator('[name=agents]').fill('1');await page.locator('[name=rounds]').fill('1');
  await page.locator('#reviewed').check();
  await page.locator('#preview-evidence').click();await page.waitForFunction(()=>document.querySelector('#evidence-preview').textContent.includes('Exact provider-field excerpts'));assert.match(await page.locator('#evidence-preview').innerText(),/Exact provider-field excerpts/);
  console.log('GPU_STATUS',await page.locator('#device-info').innerText());
  const gpu=await page.evaluate(async()=>{const adapter=await navigator.gpu?.requestAdapter();return adapter?{limits:{buffer:adapter.limits.maxStorageBufferBindingSize},info:{vendor:adapter.info?.vendor,architecture:adapter.info?.architecture,device:adapter.info?.device}}:null;});
  assert.ok(gpu,'CI WebGPU adapter is required for real model verification');results.gpu=gpu;
  console.log('GPU_ADAPTER',JSON.stringify(gpu));
  results.storage=await page.evaluate(()=>navigator.storage.estimate());console.log('STORAGE_ESTIMATE',JSON.stringify(results.storage));
  await page.locator('#load-model').click();
  console.log('MODEL_LOAD_STARTED');
  await page.waitForFunction(()=>!document.querySelector('#run').disabled||!document.querySelector('#load-model').disabled,null,{timeout:900000});
  assert.equal(await page.locator('#run').isEnabled(),true,await page.locator('#status').innerText());
  console.log('MODEL_LOADED');
  const budget=await page.evaluate(async()=>{const model=await import('/scenario-lab/model.mjs?v=research-v2-1');return model.prepareContext({question:'Synthetic token-budget check only',assumptions:[{ref:'A1',text:'Synthetic meeting',provenance:'ASSUMPTION'}],evidence:[{ref:'R1',text:'Synthetic source field',provenance:'ASSUMPTION'}],own:[],observed:[]});});assert.ok(budget.budget.total_reserved<=4096);assert.ok(budget.budget.prompt_tokens>0);results.tokenizer=budget.budget;
  results.checks.push('Bundled Qwen model and WASM loaded from same-origin files.');
  const start=Date.now();await page.locator('#run').click();
  console.log('REAL_INFERENCE_STARTED');
  await page.waitForFunction(()=>document.querySelector('#detail').textContent.includes('running')||document.querySelector('#status').classList.contains('error'),null,{timeout:15000});
  assert.match(await page.locator('#detail').innerText(),/running/,'The UI must create and start the run');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Run completed')||document.querySelector('#status').classList.contains('error'),null,{timeout:5430000});
  assert.match(await page.locator('#status').innerText(),/Run completed/,'Real model run must finish with valid JSON and references');
  assert.equal(await page.locator('.record .SIMULATED').count(),1);
  const enhanced=await page.evaluate(async()=>{const {LocalStore}=await import('/scenario-lab/storage.mjs'),{verifyResearchJob}=await import('/scenario-lab/research-engine.mjs');const store=await new LocalStore().open(),job=(await store.list())[0],evidence=await store.snapshot(job.snapshot_id);await verifyResearchJob(job,evidence);return {schema:job.schema,tick:job.environment.tick,action:job.events[0].action,diagnostics:job.events[0].diagnostics};});assert.equal(enhanced.schema,'oncotics-browser-scenario/2');assert.equal(enhanced.tick,1);assert.ok(enhanced.diagnostics.budget.total_reserved<=4096);if(enhanced.diagnostics.usage){assert.ok(enhanced.diagnostics.usage.prompt_tokens<=enhanced.diagnostics.budget.prompt_tokens+enhanced.diagnostics.budget.safety_margin);assert.ok(enhanced.diagnostics.usage.prompt_tokens+enhanced.diagnostics.budget.output_reserve<4096);}results.enhanced=enhanced;
  results.inference={duration_ms:Date.now()-start,state:'completed',model:'Qwen2.5-3B-Instruct-q4f32_1-MLC',interactions:1};
  await page.locator('[data-tab=agents]').click();await page.locator('[data-agent="0"]').click();assert.equal(await page.locator('#agent-dialog').isVisible(),true);await page.locator('#close-dialog').click();
  await page.locator('[data-tab=report]').click();assert.match(await page.locator('#detail').innerText(),/SIMULATED/);assert.match(await page.locator('#detail').innerText(),/ASSUMPTION/);
  const downloaded=page.waitForEvent('download');await page.locator('#export-run').click();const file=await downloaded;await file.saveAs(fileURLToPath(new URL('test-results/scenario-export.json',root)));
  await page.reload();await page.locator('[data-scenario]').first().click();await page.waitForFunction(()=>document.querySelector('#detail').textContent.includes('completed'),null,{timeout:30000});assert.match(await page.locator('#detail').innerText(),/completed/);
  results.checks.push('Real local inference, synthetic agent inspection, labeled report, export and IndexedDB reload.');
  await page.locator('[data-tab=network]').click();assert.equal(await page.locator('.event-node').count(),1);results.checks.push('Real generated action committed through research rules and rendered in the event network.');
  await page.locator('[data-tab=world]').click();await page.locator('[data-world=difference]').click();assert.match(await page.locator('#detail').innerText(),/No simulation or difference layer/);
  results.checks.push('Unsupported difference layer shows an explicit limitation.');
  for(const route of ['/','/precision-oncology-workspace/','/imaging/','/assets/ohif/index.html','/assets/models/brain-mri-brats-segresnet/model.onnx']){const r=await fetch(base+route);assert.equal(r.status,200,route);await r.arrayBuffer();}
  await page.screenshot({path:fileURLToPath(new URL('test-results/scenario-lab.png',root)),fullPage:true});
  assert.deepEqual(results.externalRequests.filter(x=>!x.startsWith('https://clinicaltrials.gov/api/v2/studies')),[],'No external AI, model CDN or telemetry request is permitted');
  assert.deepEqual(results.errors,[],'No uncaught browser errors');
  results.checks.push('Existing workspace/imaging/OHIF routes retained; no external AI/CDN/telemetry requests.');
  const disabled=await browser.newContext();await disabled.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));const noGPU=await disabled.newPage();await noGPU.goto(base+'/scenario-lab/');await noGPU.waitForFunction(()=>document.querySelector('#device-info').textContent.includes('WebGPU is unavailable'));assert.equal(await noGPU.locator('#run').isDisabled(),true);await disabled.close();
  results.checks.push('Unsupported devices retain evidence browsing and cannot start AI.');
  console.log('BROWSER_TEST_RESULT',JSON.stringify(results));
}catch(error){results.failure=error.stack;if(page){results.ui=await page.evaluate(()=>({status:document.querySelector('#status')?.textContent,detail:document.querySelector('#detail')?.textContent?.slice(0,2500)})).catch(()=>null);console.error('FAILED_UI',JSON.stringify(results.ui));await page.screenshot({path:fileURLToPath(new URL('test-results/failure.png',root)),fullPage:true}).catch(()=>{});}console.error(error);process.exitCode=1;}
finally{await writeFile(new URL('test-results/browser-results.json',root),JSON.stringify(results,null,2));await context?.close();server.kill();if(profile)await rm(profile,{recursive:true,force:true});}
