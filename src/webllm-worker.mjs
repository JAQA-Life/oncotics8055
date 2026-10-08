// AGPL-3.0-or-later. The runtime cannot send prompts to external hosts.
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';
import { preservingWorkerHandler } from './worker-handler.mjs';
import {localAssetFetcher} from '../public_html/scenario-lab/assets.mjs';
import {countRequest} from './token-budget.mjs';
import {errorMessage} from '../public_html/scenario-lab/errors.mjs';
const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = localAssetFetcher(nativeFetch,self.location.origin,self.location.href,true);
const Handler = preservingWorkerHandler(WebWorkerMLCEngineHandler);
const handler = new Handler();
let tokenizer,chatConfig;
self.onmessage = message => {
  if(message.data?.kind==='oncotics-channel'){
    const port=message.ports[0],base=message.data.base,expected=message.data.tokenizer_sha256,modelId=message.data.model_id;
    port.onmessage=async event=>{const {id,kind,content}=event.data;try{
      let value;
      if(kind==='initialize'){
        if(!/^\/assets\/browser-ai\/qwen\/resolve\/[a-f0-9]{40}\/$/.test(base)||!/^[a-f0-9]{64}$/.test(expected))throw Error('Incompatible tokenizer asset configuration.');
        const bytes=await (await fetch(base+'tokenizer.json',{cache:'no-store'})).arrayBuffer(),actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
        if(actual!==expected)throw Error('Tokenizer file integrity failed. Upload the complete model package.');
        // This adapter is intentionally coupled to pinned WebLLM 0.2.79 internals.
        // Reuse the actual inference tokenizer, not a separately initialized copy.
        const pipeline=handler.engine.loadedModelIdToPipeline?.get(modelId);
        chatConfig=handler.engine.loadedModelIdToChatConfig?.get(modelId);
        tokenizer=pipeline?.tokenizer;
        if(!chatConfig||typeof tokenizer?.encode!=='function'||typeof tokenizer?.getVocabSize!=='function')throw Error('Pinned WebLLM tokenizer adapter is incompatible. No scenario can run.');
        value={available:true,vocab_size:tokenizer.getVocabSize(),source:'Actual loaded WebLLM 0.2.79 inference tokenizer'};
      }else if(kind==='count'){if(!tokenizer)throw Error('Load the pinned tokenizer before budgeting.');value=countRequest(tokenizer,chatConfig,content);}
      else throw Error('Unknown tokenizer request.');
      port.postMessage({id,ok:true,value});
    }catch(error){port.postMessage({id,ok:false,error:errorMessage(error)});}};
    return;
  }
  const kind=message.data?.kind;
  console.debug('AI_STAGE worker',kind);
  handler.onmessage(message,()=>console.debug('AI_STAGE complete',kind));
};
