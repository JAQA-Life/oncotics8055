// AGPL-3.0-or-later. The runtime cannot send prompts to external hosts.
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';
const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, self.location.href);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/assets/browser-ai/')) {
    throw new Error('Browser AI only loads its self-hosted model assets.');
  }
  return nativeFetch(input, {...init, mode:'same-origin', redirect:'error', credentials:'omit', referrerPolicy:'no-referrer'});
};
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = message => {
  const kind=message.data?.kind;
  console.debug('AI_STAGE worker',kind);
  handler.onmessage(message,()=>console.debug('AI_STAGE complete',kind));
};
