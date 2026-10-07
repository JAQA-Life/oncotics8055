// Preserve browser/GPU error details without serializing requests or evidence.
export function errorMessage(value){
  const seen=new Set();
  const read=(object,key)=>{try{return object?.[key];}catch{return undefined;}};
  function describe(item,depth=0){
    if(typeof item==='string')return item.trim()==='[object Object]'?'':item.trim().slice(0,2400);
    if(item==null||depth>4||seen.has(item))return '';
    if(typeof item!=='object')return String(item);
    seen.add(item);
    const name=read(item,'name');
    for(const key of ['message','reason','error','cause','details','description']){
      const detail=describe(read(item,key),depth+1);
      if(detail)return typeof name==='string'&&name!=='Error'&&!detail.startsWith(name)?name+': '+detail:detail;
    }
    const messages=read(item,'messages');
    if(Array.isArray(messages))return messages.slice(0,5).map(x=>describe(x,depth+1)).filter(Boolean).join('; ').slice(0,2400);
    return typeof name==='string'&&name!=='Object'?name:'';
  }
  return describe(value)||'Browser AI raised an error without readable details. Reload the model; check browser hardware acceleration and available GPU memory.';
}
export function asError(value){return new Error(errorMessage(value));}
