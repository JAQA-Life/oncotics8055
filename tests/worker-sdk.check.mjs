// Exercise the actual pinned SDK's worker dispatch with injected RPC task results.
// This is a transport/failure test, not AI inference and not a model benchmark.
import assert from 'node:assert/strict';
import {WebWorkerMLCEngineHandler} from '@mlc-ai/web-llm';
import {preservingWorkerHandler} from '../src/worker-handler.mjs';
const Handler=preservingWorkerHandler(WebWorkerMLCEngineHandler),handler=new Handler(),responses=[];
handler.postMessage=message=>responses.push(message);
const complete=()=>new Promise((resolve,reject)=>{const deadline=Date.now()+5000;const check=()=>responses.length?resolve(responses.pop()):Date.now()>deadline?reject(Error('Pinned worker did not respond')):setImmediate(check);check();});
handler.engine.getMessage=async()=>{throw Object.create({get message(){return 'Structured GPU validation test failure';},get name(){return 'GPUValidationError';}});};
handler.onmessage({kind:'getMessage',uuid:'structured-fault',content:{}});
assert.deepEqual(await complete(),{kind:'throw',uuid:'structured-fault',content:'GPUValidationError: Structured GPU validation test failure'});
handler.engine.getMessage=async()=> 'Successful transport test';
handler.onmessage({kind:'getMessage',uuid:'success',content:{}});
assert.deepEqual(await complete(),{kind:'return',uuid:'success',content:'Successful transport test'});
console.log('Pinned WebLLM 0.2.79 worker dispatch: structured failure and success verified. No model inference performed by this check.');
