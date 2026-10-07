import {readFile,stat,cp,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const publicRoot=path.join(root,'public_html');
const manifest=JSON.parse(await readFile(path.join(publicRoot,'assets/browser-ai/manifest.json')));
if(manifest.schema!=='oncotics-browser-model/1'||manifest.files.length<16)throw Error('Acquire the full browser model before building: npm run vendor');
for(const item of manifest.files){const file=path.resolve(publicRoot,item.path);if(!file.startsWith(publicRoot+path.sep))throw Error('Invalid asset path');const bytes=await readFile(file);if(bytes.length!==item.bytes||createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Asset integrity failed: '+item.path);}
const packs=JSON.parse(await readFile(path.join(root,'docs/model-integrity.json')));
for(const pack of packs){const bytes=await readFile(path.join(publicRoot,'assets/models',pack.id,'model.onnx'));if(bytes.length!==pack.bytes||createHash('sha256').update(bytes).digest('hex')!==pack.sha256)throw Error('Existing imaging model changed: '+pack.id);}
await stat(path.join(publicRoot,'assets/ohif/index.html'));
const original=JSON.parse(await readFile(path.join(root,'docs/static-integrity.json')));
for(const item of original){const bytes=await readFile(path.join(publicRoot,item.path));if(bytes.length!==item.bytes||createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Original asset/page changed: '+item.path);}
await mkdir(path.join(root,'dist'),{recursive:true});
await cp(publicRoot,path.join(root,'dist'),{recursive:true});
console.log('Build verified: self-hosted WebLLM, '+packs.length+' original ONNX models, and '+original.length+' unchanged original assets/workspace/imaging pages.');
