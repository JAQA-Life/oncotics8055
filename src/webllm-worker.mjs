// AGPL-3.0-or-later. The runtime cannot send prompts to external hosts.
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';
import { preservingWorkerHandler } from './worker-handler.mjs';
import {localAssetFetcher} from '../public_html/scenario-lab/assets.mjs';
const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = localAssetFetcher(nativeFetch,self.location.origin,self.location.href,true);
const Handler = preservingWorkerHandler(WebWorkerMLCEngineHandler);
const handler = new Handler();
self.onmessage = message => {
  const kind=message.data?.kind;
  console.debug('AI_STAGE worker',kind);
  handler.onmessage(message,()=>console.debug('AI_STAGE complete',kind));
};
