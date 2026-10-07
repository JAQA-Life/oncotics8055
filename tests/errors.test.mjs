import test from 'node:test';
import assert from 'node:assert/strict';
import {errorMessage,asError} from '../public_html/scenario-lab/errors.mjs';
import {preservingWorkerHandler} from '../src/worker-handler.mjs';
import {importResponse} from '../public_html/scenario-lab/core.mjs';
import {newJob,runJob} from '../public_html/scenario-lab/runner.mjs';
const gpuError=()=>Object.create({get message(){return 'GPU buffer allocation failed: out of memory';},get name(){return 'GPUOutOfMemoryError';}});
test('structured GPU errors retain non-enumerable details instead of object coercion',()=>{
  const error=gpuError();assert.equal(String(error),'[object Object]');
  assert.match(errorMessage(error),/GPUOutOfMemoryError.*out of memory/);
  assert.match(asError({message:{error}}).message,/GPUOutOfMemoryError.*out of memory/);
});
test('error formatting handles empty, cyclic and broken getter errors without leaking context',()=>{
  const cyclic={};cyclic.cause=cyclic;assert.doesNotThrow(()=>errorMessage(cyclic));
  assert.doesNotThrow(()=>errorMessage({get message(){throw Error('getter failed');}}));
  assert.doesNotMatch(errorMessage({request:{prompt:'CONFIDENTIAL'}}),/CONFIDENTIAL|object Object/);
  assert.doesNotMatch(errorMessage('[object Object]'),/object Object/);
  assert.match(errorMessage({messages:[{message:'shader compilation failed'}]}),/shader compilation failed/);
});
test('worker RPC preserves completion and EOF values and serializes structured failures',async()=>{
  class Base{messages=[];postMessage(message){this.messages.push(message);}}
  const Handler=preservingWorkerHandler(Base),handler=new Handler();
  await handler.handleTask('chunk',async()=>({choices:[{delta:{content:'text'}}]}));
  await handler.handleTask('EOF',async()=>undefined);
  await handler.handleTask('failed',async()=>{throw gpuError();});
  assert.equal(handler.messages[0].kind,'return');assert.equal(handler.messages[0].uuid,'chunk');
  assert.equal(handler.messages[0].content.choices[0].delta.content,'text');
  assert.equal(handler.messages[1].content,undefined);
  assert.match(handler.messages[2].content,/GPUOutOfMemoryError.*out of memory/);
  assert.equal(handler.messages[2].kind,'throw');assert.equal(handler.messages[2].uuid,'failed');
});
test('failed first interaction saves the real structured error without inventing progress',async()=>{
  const evidence=await importResponse('ctgov','Synthetic fixture',{studies:[{protocolSection:{identificationModule:{nctId:'NCT00000001',briefTitle:'Synthetic fixture'}}}]});
  const job=await newJob({title:'Failure fixture',question:'Research evidence gaps?',assumptions:['Synthetic test only'],agents:1,rounds:1,research_only:true,public_data_only:true,reviewed:true},evidence,{id:'fixture',revision:'synthetic'});
  const store={saved:[],async save(value){this.saved.push(structuredClone(value));}};
  await assert.rejects(()=>runJob(job,{store,envelope:evidence,generate:async()=>{throw gpuError();}}));
  assert.equal(job.state,'failed');assert.equal(job.next_step,0);assert.equal(job.events.length,0);
  assert.match(store.saved.at(-1).error,/GPUOutOfMemoryError.*out of memory/);assert.equal(job.report,undefined);
});
