import {build} from 'esbuild';
for(const name of ['model-worker','model-client']){
  await build({entryPoints:[name==='model-worker'?'src/webllm-worker.mjs':'src/model-client.mjs'],outfile:'public_html/scenario-lab/'+name+'.mjs',bundle:true,format:'esm',platform:'browser',target:'es2022',legalComments:'eof',sourcemap:true,external:['url','module']});
}
console.log('Bundled pinned WebLLM runtime with error-preserving worker transport.');
