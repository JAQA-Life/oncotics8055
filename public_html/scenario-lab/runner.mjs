import {ROLES,digest,verifySnapshot,seedFor,promptFor,parseEvent,reportFor,validateSpec} from './core.mjs';
import {errorMessage} from './errors.mjs';
export async function newJob(spec,envelope,model){spec=validateSpec(spec);await verifySnapshot(envelope);if(!envelope.snapshot.records.length)throw Error('Retrieve or import supported evidence before running.');if(Date.now()-envelope.snapshot.created_at>86400000)throw Error('Retrieve current evidence; the snapshot is older than 24 hours.');const seed=seedFor(envelope);return {schema:'oncotics-browser-scenario/1',id:crypto.randomUUID(),spec,snapshot_id:envelope.id,evidence_sha256:envelope.sha256,seed,seed_sha256:await digest(seed),model:structuredClone(model),agents:ROLES.slice(0,spec.agents).map(x=>({...x,provenance:'SIMULATED'})),events:[],next_step:0,state:'ready',stage:'ready',progress:0,created_at:Date.now(),research_only:true};}
export async function runJob(job,{store,envelope,generate,signal,onChange=()=>{}}){
  await verifySnapshot(envelope);
  if(job.evidence_sha256!==envelope.sha256||await digest(job.seed)!==job.seed_sha256)throw Error('Scenario seed integrity failed.');
  validateSpec(job.spec);
  const total=job.spec.rounds*job.agents.length;
  if(job.next_step!==job.events.length||job.next_step>total)throw Error('Scenario checkpoint is inconsistent.');
  job.state='running';job.stage='agent interactions';delete job.error;await store.save(job);onChange(job);
  try{
    for(let step=job.next_step;step<total;step++){
      signal?.throwIfAborted();
      const role=job.agents[step%job.agents.length],round=Math.floor(step/job.agents.length)+1,prompt=promptFor(job,role,round);
      if(new TextEncoder().encode(prompt).length>3800)throw Error('The bounded model prompt is too large. Shorten the research question or assumptions.');
      const raw=await generate(prompt,signal,job.seed.map(r=>r.ref));signal?.throwIfAborted();
      const event=parseEvent(raw,job,role,round);
      job.events.push(event);job.next_step=step+1;job.progress=Math.round(100*job.next_step/total);job.updated_at=Date.now();
      try{await store.save(job);}catch(e){job.events.pop();job.next_step=step;job.progress=Math.round(100*step/total);throw e;}
      onChange(job);
    }
    signal?.throwIfAborted();job.report=reportFor(job);job.simulation_graph={provenance:'SIMULATED',nodes:job.agents.map(a=>({id:a.id,label:a.name,provenance:'SIMULATED'})),edges:job.events.slice(1).map((e,i)=>({from:job.events[i].agent_id,to:e.agent_id,relation:'responded_after',provenance:'SIMULATED',meaning:'Generation order, not a real stakeholder relationship'}))};job.state='completed';job.stage='completed';job.progress=100;await store.save(job);onChange(job);
  }catch(e){job.state=signal?.aborted?'paused':'failed';job.stage=job.state;job.error=e?.name==='QuotaExceededError'?'Browser storage is full. Export existing runs, free storage and reload.':signal?.aborted?'Paused after the last saved step. Resume when ready.':errorMessage(e);try{await store.save(job);}catch{job.error+=' The latest state could not be saved.';}onChange(job);throw e;}
  return job;
}
