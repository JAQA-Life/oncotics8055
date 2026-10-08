// Installed-package diagnostics only; never prints model inputs or evidence.
import {readFile} from 'node:fs/promises';
for(const name of ['web-tokenizers','web-llm']){
 const code=await readFile('node_modules/@mlc-ai/'+name+'/lib/index.js','utf8');
 console.log('TOKENIZER_PACKAGE',name);
 for(const term of ['asyncInitTokenizers','static async fromJSON','binding.Tokenizer','loadedTokenizers','loadedPipelines','tokenizers.set','modelIdToTokenizer','class MLCEngine']){
  const i=code.indexOf(term);if(i>=0)console.log(term,code.slice(Math.max(0,i-100),i+800));
 }
}
