import {errorMessage} from '../public_html/scenario-lab/errors.mjs';
// WebLLM's default worker uses error.toString(), which loses GPU error objects.
// Keep the same RPC protocol and preserve the message before it crosses threads.
export function preservingWorkerHandler(BaseHandler){
  return class extends BaseHandler{
    async handleTask(uuid,task){
      try{const content=await task();this.postMessage({kind:'return',uuid,content});}
      catch(error){this.postMessage({kind:'throw',uuid,content:errorMessage(error)});}
    }
  };
}
