import test from 'node:test';
import assert from 'node:assert/strict';
import {checkAssetResponse,localAssetFetcher} from '../public_html/scenario-lab/assets.mjs';
test('hosting HTML never becomes JSON or a cached model response',async()=>{
  for(const path of ['/assets/browser-ai/manifest.json','/assets/browser-ai/model.wasm','/assets/browser-ai/weights.bin']){
    await assert.rejects(checkAssetResponse(new Response('<!doctype html><p>PRIVATE CHALLENGE TOKEN</p>',{headers:{'content-type':'text/html'}}),path,{json:path.endsWith('.json')}),error=>error.message.includes(path)&&error.message.includes('HTML')&&!error.message.includes('PRIVATE'));
  }
  await assert.rejects(checkAssetResponse(new Response('<!doctype html>',{headers:{'content-type':'application/json'}}),'/assets/browser-ai/config.json',{json:true}),/HTML page instead of JSON/);
});
test('JSON and model bytes remain readable after validation',async()=>{
  const response=new Response('{"value":3}',{headers:{'content-type':'application/json'}});
  assert.deepEqual(await checkAssetResponse(response,'/test.json',{json:true}),{value:3});assert.deepEqual(await response.json(),{value:3});
  const binary=new Response(new Uint8Array([0,97,115,109]));assert.equal(await checkAssetResponse(binary,'/model.wasm'),binary);
  await assert.rejects(checkAssetResponse(new Response('bad JSON'),'/bad.json',{json:true}),/not valid JSON/);
  await assert.rejects(checkAssetResponse(new Response('missing',{status:404}),'/missing.json',{json:true}),/HTTP 404/);
});
test('only authorized local assets are fetched, with same-site cookies and no redirects',async()=>{
  const calls=[];const request=localAssetFetcher(async(input,init)=>{calls.push({input,init});return new Response('{}',{headers:{'content-type':'application/json'}});},'https://oncotics.com','https://oncotics.com/scenario-lab/model-worker.mjs',true);
  await request('/assets/browser-ai/config.json',{credentials:'include',redirect:'follow'});
  assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.redirect,'error');assert.equal(calls[0].init.mode,'same-origin');
  await assert.rejects(request('https://example.com/ai'),/self-hosted/);
  await assert.rejects(request('/scenario-lab/entity-aliases.json'),/self-hosted/);assert.equal(calls.length,1);
});
