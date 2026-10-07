// IndexedDB is device/origin-local, not a server account or an immutable archive.
import {verifySnapshot} from './core.mjs';
const DATABASE='oncotics-browser-scenarios-v1';
const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export class LocalStore {
  async open(){const r=indexedDB.open(DATABASE,1);r.onupgradeneeded=()=>{r.result.createObjectStore('snapshots',{keyPath:'id'});r.result.createObjectStore('jobs',{keyPath:'id'});};this.db=await request(r);this.db.onversionchange=()=>this.db.close();return this;}
  async transaction(name,mode,action){const tx=this.db.transaction(name,mode),done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Browser storage transaction aborted.'));});try{const result=await action(tx.objectStore(name));await done;return result;}catch(e){done.catch(()=>{});throw e;}}
  async freeze(envelope){await verifySnapshot(envelope);return this.transaction('snapshots','readwrite',s=>request(s.add(structuredClone(envelope))));}
  snapshot(id){return this.transaction('snapshots','readonly',s=>request(s.get(id)));}
  save(job){return this.transaction('jobs','readwrite',s=>request(s.put(structuredClone(job))));}
  get(id){return this.transaction('jobs','readonly',s=>request(s.get(id)));}
  async list(){return (await this.transaction('jobs','readonly',s=>request(s.getAll()))).sort((a,b)=>b.created_at-a.created_at);}
  async recover(){for(const job of await this.list())if(job.state==='running'){job.state='interrupted';job.error='The browser session ended before completion. Resume from the last saved step.';await this.save(job);}}
  async clear(){for(const name of ['jobs','snapshots'])await this.transaction(name,'readwrite',s=>request(s.clear()));}
}
