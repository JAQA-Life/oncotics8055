// AGPL-3.0-or-later. Static assets may receive hosting error/challenge HTML.
const LIMIT=32*1024*1024;
function deliveryError(path,detail){return Error('Website file delivery failed for '+path+': '+detail+'. Upload the complete package at the website root and check Hostinger file routing, cache and browser-check rules for this asset.');}
export async function checkAssetResponse(response,path,{json=false}={}){
  if(!response.ok)throw deliveryError(path,'HTTP '+response.status);
  const type=response.headers.get('content-type')||'';
  if(/(?:text\/html|application\/xhtml\+xml)/i.test(type))throw deliveryError(path,'the server returned an HTML page instead of '+(json?'JSON':'a model file'));
  if(json){
    const declared=Number(response.headers.get('content-length'));
    if(declared>LIMIT)throw deliveryError(path,'JSON file exceeds its size limit');
    const reader=response.clone().body.getReader();let size=0;const chunks=[];
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>LIMIT){reader.cancel().catch(()=>{});throw deliveryError(path,'JSON file exceeds its size limit');}chunks.push(value);}}finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const text=new TextDecoder().decode(bytes);
    if(/^\s*</.test(text))throw deliveryError(path,'the server returned an HTML page instead of JSON');
    try{return JSON.parse(text);}catch{throw deliveryError(path,'the file is not valid JSON');}
  }
  return response;
}
export function localAssetFetcher(nativeFetch,origin,base,modelOnly=false){
  return async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,base);
    if(url.origin!==origin||!(url.pathname.startsWith('/assets/browser-ai/')||(!modelOnly&&url.pathname==='/scenario-lab/entity-aliases.json')))throw Error('Browser AI only loads its self-hosted model assets.');
    const response=await nativeFetch(input,{...init,mode:'same-origin',redirect:'error',credentials:'same-origin',referrerPolicy:'no-referrer'});
    await checkAssetResponse(response,url.pathname,{json:url.pathname.endsWith('.json')});
    return response;
  };
}
export async function localJSON(path){
  const request=localAssetFetcher(globalThis.fetch.bind(globalThis),location.origin,location.href);
  const response=await request(path,{cache:'no-store'});
  return response.json();
}
