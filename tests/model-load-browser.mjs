// Load the actual pinned Qwen model through the changed HTTP guard; no inference.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4173',server=spawn(process.execPath,['tools/serve.mjs'],{stdio:'inherit'});
let context,profile,page;
try{
  for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  profile=await mkdtemp(path.join(tmpdir(),'oncotics-model-load-'));
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:['--enable-unsafe-webgpu','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
  page=await context.newPage();const external=[],errors=[];
  context.on('request',request=>{if(!request.url().startsWith(base)&&!request.url().startsWith('data:')&&!request.url().startsWith('blob:'))external.push(request.url());});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/scenario-lab/');await page.waitForFunction(()=>document.querySelector('#model-info').textContent.includes('Included model:'),null,{timeout:60000});
  const start=Date.now();await page.locator('#load-model').click();
  await page.waitForFunction(()=>!document.querySelector('#unload-model').disabled||!document.querySelector('#load-model').disabled,null,{timeout:600000});
  assert.equal(await page.locator('#unload-model').isEnabled(),true,await page.locator('#status').innerText());
  const identity=await page.evaluate(async()=>{const model=await import('/scenario-lab/model.mjs?v=complete-fix-2');return model.identity();});
  assert.equal(identity.id,'Qwen2.5-3B-Instruct-q4f32_1-MLC');assert.equal(identity.revision,'dfa91e859b714acfa489a1464297080656c3460d');assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  await mkdir('test-results',{recursive:true});const result={passed:true,scope:'Actual Qwen model/WASM loaded using new asset guard; no inference',duration_ms:Date.now()-start,identity,external_requests:external};
  await writeFile('test-results/model-load.json',JSON.stringify(result,null,2));console.log('MODEL_LOAD_RESULT',JSON.stringify(result));
  await page.locator('#unload-model').click();
}catch(error){if(page)console.error('MODEL_LOAD_UI',await page.locator('#status').innerText());throw error;}
finally{await context?.close();server.kill();if(profile)await rm(profile,{recursive:true,force:true});}
