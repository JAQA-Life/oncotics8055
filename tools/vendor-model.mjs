// Build-time acquisition only. Published browser inference is same-origin.
import { prebuiltAppConfig } from '@mlc-ai/web-llm';
import { build } from 'esbuild';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const modelId = 'Qwen2.5-3B-Instruct-q4f32_1-MLC';
const lock=JSON.parse(await readFile(path.join(root,'model-lock.json'),'utf8'));
const record = prebuiltAppConfig.model_list.find(x => x.model_id === modelId);
if (!record) throw Error('Pinned WebLLM does not contain the selected model');
const target = path.join(root, 'public_html/assets/browser-ai');
const modelTarget=path.join(target,'qwen','resolve',lock.revision);
await mkdir(modelTarget, {recursive:true});
await mkdir(path.join(target, 'licenses'), {recursive:true});
const inventory = [];
async function fetchBytes(url, destination) {
  const response = await fetch(url, {signal:AbortSignal.timeout(180000)});
  if (!response.ok) throw Error(`Acquisition failed: ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, bytes);
  inventory.push({path:path.relative(path.join(root,'public_html'),destination).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:url});
  console.log('Acquired', path.basename(destination), bytes.length);
}
const repo = 'mlc-ai/' + modelId;
if(lock.repo!==repo||lock.model_id!==modelId||lock.webllm_version!=='0.2.79'||!/^[a-f0-9]{40}$/.test(lock.revision))throw Error('Incompatible model lock');
const metaResponse = await fetch('https://huggingface.co/api/models/' + repo+'/revision/'+lock.revision);
if (!metaResponse.ok) throw Error('Model metadata is unavailable');
const metadata = await metaResponse.json();
if (metadata.sha!==lock.revision) throw Error('Model revision does not match its lock');
const selected = metadata.siblings.map(x => x.rfilename).filter(x => /^(mlc-chat-config\.json|ndarray-cache\.json|tokenizer.*|vocab\.json|merges\.txt|params_shard_\d+\.bin|README\.md|LICENSE.*)$/.test(x));
for (const name of selected) {
  if (name.includes('/') || name.includes('..')) throw Error('Unexpected model path');
  await fetchBytes(`https://huggingface.co/${repo}/resolve/${metadata.sha}/${name}`,path.join(modelTarget,name));
}
const config=JSON.parse(await readFile(path.join(modelTarget,'mlc-chat-config.json'),'utf8'));
const weights=JSON.parse(await readFile(path.join(modelTarget,'ndarray-cache.json'),'utf8'));
for (const name of [...config.tokenizer_files,...weights.records.map(x=>x.dataPath)]) {
  if (!selected.includes(name)) throw Error('Missing model dependency: '+name);
  await stat(path.join(modelTarget,name));
}
await fetchBytes(record.model_lib,path.join(target,'model.wasm'));
const wasm=await readFile(path.join(target,'model.wasm'));
if (!wasm.subarray(0,4).equals(Buffer.from([0,97,115,109]))) throw Error('Invalid compiled model WASM');
const baseMeta=await (await fetch('https://huggingface.co/api/models/Qwen/Qwen2.5-3B-Instruct')).json();
await fetchBytes(`https://huggingface.co/Qwen/Qwen2.5-3B-Instruct/resolve/${baseMeta.sha}/LICENSE`,path.join(target,'licenses/Qwen-LICENSE.txt'));
const notice=Buffer.from('Qwen is licensed under the Qwen RESEARCH LICENSE AGREEMENT, Copyright (c) Alibaba Cloud. All Rights Reserved.\n\nModel: Qwen2.5-3B-Instruct. MLC quantization q4f32_1 and WebGPU compilation are upstream modifications by MLC-AI. Oncotics redistributes these pinned artifacts unchanged; see the model manifest for revision, acquisition URLs and hashes.\nNon-commercial research/evaluation only under the default model license; commercial use requires a separate license from Alibaba Cloud.\n');
const noticePath=path.join(target,'licenses/Qwen-NOTICE.txt');await writeFile(noticePath,notice);inventory.push({path:'assets/browser-ai/licenses/Qwen-NOTICE.txt',bytes:notice.length,sha256:createHash('sha256').update(notice).digest('hex'),source:'Required attribution and redistribution notice accompanying the included Qwen Research License'});
await fetchBytes('https://raw.githubusercontent.com/mlc-ai/web-llm/main/LICENSE',path.join(target,'licenses/WebLLM-LICENSE.txt'));
await fetchBytes('https://raw.githubusercontent.com/mlc-ai/mlc-llm/main/LICENSE',path.join(target,'licenses/MLC-LICENSE.txt'));
const licenses=await (await fetch('https://api.github.com/repos/mlc-ai/web-llm/contents/licenses')).json();
for(const file of licenses)if(file.type==='file'&&file.download_url)await fetchBytes(file.download_url,path.join(target,'licenses','WebLLM-'+file.name));
// Tokenizers' Emscripten Node-only branches are unreachable in a browser worker.
await build({entryPoints:[path.join(root,'src/webllm-worker.mjs')],outfile:path.join(root,'public_html/scenario-lab/model-worker.mjs'),bundle:true,format:'esm',platform:'browser',target:'es2022',legalComments:'eof',sourcemap:true,external:['url','module']});
await build({entryPoints:[path.join(root,'src/model-client.mjs')],outfile:path.join(root,'public_html/scenario-lab/model-client.mjs'),bundle:true,format:'esm',platform:'browser',target:'es2022',legalComments:'eof',sourcemap:true});
for(const name of ['model-worker.mjs','model-worker.mjs.map','model-client.mjs','model-client.mjs.map']){const bytes=await readFile(path.join(root,'public_html/scenario-lab',name));inventory.push({path:'scenario-lab/'+name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:'esbuild bundle of pinned WebLLM and Oncotics source'});}
const manifest={schema:'oncotics-browser-model/1',id:modelId,revision:metadata.sha,webllm_version:'0.2.79',model_base:'/assets/browser-ai/qwen/resolve/'+metadata.sha+'/',model_lib:'/assets/browser-ai/model.wasm',context_window_size:4096,vram_required_MB:record.vram_required_MB,buffer_size_required_bytes:Math.max(record.buffer_size_required_bytes||0,256*1024*1024),required_features:record.required_features||[],license:lock.license,non_commercial:true,files:inventory};
await writeFile(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({model:modelId,revision:metadata.sha,files:inventory.length,bytes:inventory.reduce((a,x)=>a+x.bytes,0)}));
