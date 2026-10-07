// Build-time acquisition only. Published browser inference is same-origin.
import { prebuiltAppConfig } from '@mlc-ai/web-llm';
import { build } from 'esbuild';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const modelId = 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC';
const record = prebuiltAppConfig.model_list.find(x => x.model_id === modelId);
if (!record) throw Error('Pinned WebLLM does not contain the selected model');
const target = path.join(root, 'public_html/assets/browser-ai');
await mkdir(path.join(target, 'qwen'), {recursive:true});
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
const metaResponse = await fetch('https://huggingface.co/api/models/' + repo);
if (!metaResponse.ok) throw Error('Model metadata is unavailable');
const metadata = await metaResponse.json();
if (!/^[a-f0-9]{40}$/.test(metadata.sha)) throw Error('Unpinned model revision');
const selected = metadata.siblings.map(x => x.rfilename).filter(x => /^(mlc-chat-config\.json|ndarray-cache\.json|tokenizer.*|vocab\.json|merges\.txt|params_shard_\d+\.bin|README\.md|LICENSE.*)$/.test(x));
for (const name of selected) {
  if (name.includes('/') || name.includes('..')) throw Error('Unexpected model path');
  await fetchBytes(`https://huggingface.co/${repo}/resolve/${metadata.sha}/${name}`,path.join(target,'qwen',name));
}
const config=JSON.parse(await readFile(path.join(target,'qwen/mlc-chat-config.json'),'utf8'));
const weights=JSON.parse(await readFile(path.join(target,'qwen/ndarray-cache.json'),'utf8'));
for (const name of [...config.tokenizer_files,...weights.records.map(x=>x.dataPath)]) {
  if (!selected.includes(name)) throw Error('Missing model dependency: '+name);
  await stat(path.join(target,'qwen',name));
}
await fetchBytes(record.model_lib,path.join(target,'model.wasm'));
const wasm=await readFile(path.join(target,'model.wasm'));
if (!wasm.subarray(0,4).equals(Buffer.from([0,97,115,109]))) throw Error('Invalid compiled model WASM');
const baseMeta=await (await fetch('https://huggingface.co/api/models/Qwen/Qwen2.5-0.5B-Instruct')).json();
await fetchBytes(`https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/resolve/${baseMeta.sha}/LICENSE`,path.join(target,'licenses/Qwen-LICENSE.txt'));
await fetchBytes('https://raw.githubusercontent.com/mlc-ai/web-llm/v0.2.79/LICENSE',path.join(target,'licenses/WebLLM-LICENSE.txt'));
await fetchBytes('https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/LICENSE',path.join(target,'licenses/MLC-LICENSE.txt'));
await build({entryPoints:[path.join(root,'src/webllm-worker.mjs')],outfile:path.join(root,'public_html/scenario-lab/model-worker.mjs'),bundle:true,format:'esm',platform:'browser',target:'es2022',legalComments:'eof',sourcemap:true});
const worker=await readFile(path.join(root,'public_html/scenario-lab/model-worker.mjs'));
inventory.push({path:'scenario-lab/model-worker.mjs',bytes:worker.length,sha256:createHash('sha256').update(worker).digest('hex'),source:'esbuild bundle of pinned WebLLM and src/webllm-worker.mjs'});
const manifest={schema:'oncotics-browser-model/1',id:modelId,revision:metadata.sha,webllm_version:'0.2.79',model_base:'/assets/browser-ai/qwen/',model_lib:'/assets/browser-ai/model.wasm',context_window_size:4096,vram_required_MB:record.vram_required_MB,files:inventory};
await writeFile(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({model:modelId,revision:metadata.sha,files:inventory.length,bytes:inventory.reduce((a,x)=>a+x.bytes,0)}));
