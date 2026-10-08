// AGPL-3.0-or-later. Versioned research actions; never mutate public evidence.
import {ROLES,validateSpec,digest,verifySnapshot,text,canonical,reportFor} from './core.mjs';
import {evidenceSeed,verifySeed,rank} from './evidence-context.mjs';
import {ACTIONS,promptText,responseSchema} from './context-budget.mjs';
import {errorMessage} from './errors.mjs';
export const RULES='oncotics-research-actions/1',PROMPT_VERSION='oncotics-evidence-memory/1';
export function initialState(){return {rule_version:RULES,tick:0,items:[],provenance:'DERIVED',meaning:'Rule-based bookkeeping of simulated requests and hypotheses; no real-world outcome'};}
export function memoriesFor(agents,events){return Object.fromEntries(agents.map(a=>[a.id,{provenance:'DERIVED',policy:'public-rounds/1',own_event_ids:events.filter(e=>e.agent_id===a.id).map(e=>e.id),observed_event_ids:events.filter(e=>e.agent_id!==a.id).map(e=>e.id)}]));}
export async function newResearchJob(spec,envelope,model){
 spec=validateSpec(spec);await verifySnapshot(envelope);if(Date.now()-envelope.snapshot.created_at>86400000)throw Error('Retrieve current evidence; the snapshot is older than 24 hours.');
 const seed=await evidenceSeed(envelope,spec.question+' '+envelope.snapshot.entities.map(e=>e.normalized).join(' ')),agents=ROLES.slice(0,spec.agents).map(a=>({...a,provenance:'SIMULATED'}));
 const recipe={rule_version:RULES,prompt_version:PROMPT_VERSION,memory_policy:'public-rounds/1',generation:{temperature:.35,max_tokens:192,seed:42,context_limit:4096},limits:{agents:5,rounds:4},provenance:'DERIVED'};
 return {schema:'oncotics-browser-scenario/2',id:crypto.randomUUID(),spec,spec_sha256:await digest(spec),snapshot_id:envelope.id,evidence_sha256:envelope.sha256,seed,seed_sha256:await digest(seed),model:structuredClone(model),agents,recipe,recipe_sha256:await digest(recipe),memories:memoriesFor(agents,[]),environment:initialState(),events:[],next_step:0,state:'ready',stage:'ready',progress:0,created_at:Date.now(),research_only:true};
}
export function contextFor(job,agent,round){
 const memory=job.memories[agent.id],map=new Map(job.events.map(e=>[e.id,e])),entry=e=>({id:e.id,agent:e.agent_id,action:e.action,target:e.target,text:e.statement,uncertainty:e.uncertainty,provenance:'SIMULATED'});
 const own=memory.own_event_ids.slice(-3).map(id=>entry(map.get(id))),observed=rank(memory.observed_event_ids.map(id=>entry(map.get(id))),job.spec.question+' '+agent.focus).slice(0,3);
 return {question:job.spec.question,assumptions:job.spec.assumptions.map((text,i)=>({ref:'A'+(i+1),text,provenance:'ASSUMPTION'})),role:agent.name,focus:agent.focus,round,clock:job.environment.tick,memory_policy:'Public committed events; own history is separate from other-agent observations',own,observed,evidence:job.seed.map(p=>({ref:p.ref,source:p.source,field:p.locator,text:p.text,provenance:p.provenance,excerpt:true})),allowed_actions:ACTIONS,environment:{open_items:job.environment.items.length,meaning:'Simulated research bookkeeping only'}};
}
function normalize(raw,job,agent,round,prepared){
 let parsed;try{parsed=JSON.parse(String(raw).trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw Error('The local model returned invalid action JSON. No replacement event was invented.');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.keys(parsed).some(k=>!['action','target','statement','references','uncertainty'].includes(k)))throw Error('Unsupported generated action fields.');
 if(!ACTIONS.includes(parsed.action))throw Error('Unknown research action; no state change was applied.');
 const allowed=new Map(prepared.context.evidence.map(p=>[p.ref,job.seed.find(x=>x.ref===p.ref)])),assumptions=prepared.context.assumptions.map(a=>a.ref);
 if(!allowed.has(parsed.target)&&!assumptions.includes(parsed.target))throw Error('Action target was not supplied to this agent.');
 if(parsed.action==='challenge_assumption'&&!assumptions.includes(parsed.target))throw Error('A challenge must target an explicit assumption.');
 if(!Array.isArray(parsed.references)||parsed.references.length>12||parsed.references.some(ref=>!allowed.has(ref)))throw Error('The local model cited an unknown or omitted reference.');
 if(allowed.has(parsed.target)&&!parsed.references.includes(parsed.target))throw Error('The evidence action target must appear in the supplied references.');
 return {id:crypto.randomUUID(),agent_id:agent.id,round,action:parsed.action,target:parsed.target,statement:text(parsed.statement,'Generated statement',1600),uncertainty:text(parsed.uncertainty,'Generated uncertainty',1000),references:[...new Set(parsed.references)].map(ref=>({ref,record_id:allowed.get(ref).record_id,passage_id:allowed.get(ref).id,locator:allowed.get(ref).locator,passage_sha256:allowed.get(ref).passage_sha256,provenance:'SIMULATED',meaning:'Model-selected reference; citation does not verify the statement'})),provenance:'SIMULATED',created_at:Date.now()};
}
export function reduceState(state,event){
 if(state.rule_version!==RULES||!ACTIONS.includes(event.action))throw Error('Unsupported environment rules.');
 const result=structuredClone(state),key=event.action+':'+event.target;result.tick++;
 let item=result.items.find(x=>x.key===key);if(!item){item={key,action:event.action,target:event.target,event_ids:[],status:'unverified',provenance:'SIMULATED'};result.items.push(item);}item.event_ids.push(event.id);return result;
}
export function verifyPrepared(original,prepared){
 const ctx=prepared.context,filter=(items,selected,key)=>items.filter(item=>selected.some(x=>x[key]===item[key]));
 const expected={...original,evidence:filter(original.evidence,ctx.evidence,'ref'),own:filter(original.own,ctx.own,'id'),observed:filter(original.observed,ctx.observed,'id')};
 if(canonical(expected)!==canonical(ctx)||!ctx.evidence.length||!Number.isInteger(prepared.budget.total_reserved)||prepared.budget.total_reserved<0)throw Error('Prepared context changed evidence, assumptions or memory visibility.');
}
export async function verifyResearchJob(job,envelope){
 await verifySnapshot(envelope);await verifySeed(job.seed,envelope);
 if(job.schema!=='oncotics-browser-scenario/2'||job.evidence_sha256!==envelope.sha256||await digest(job.seed)!==job.seed_sha256||await digest(job.spec)!==job.spec_sha256||await digest(job.recipe)!==job.recipe_sha256||job.recipe.rule_version!==RULES||job.recipe.prompt_version!==PROMPT_VERSION)throw Error('Scenario recipe or evidence integrity failed.');
 validateSpec(job.spec);if(canonical(job.agents)!==canonical(ROLES.slice(0,job.spec.agents).map(a=>({...a,provenance:'SIMULATED'}))))throw Error('Scenario agent configuration changed.');
 if(job.events.length!==job.next_step||job.next_step>job.spec.rounds*job.agents.length)throw Error('Scenario checkpoint is inconsistent.');
 let state=initialState();const past=[];
 for(const event of job.events){
  const index=past.length,agent=job.agents[index%job.agents.length],round=Math.floor(index/job.agents.length)+1;
  if(event.agent_id!==agent.id||event.round!==round||event.provenance!=='SIMULATED'||event.tick!==index+1||event.prior_state_sha256!==await digest(state)||event.context_sha256!==await digest(event.context_audit)||event.event_sha256!==await digest(Object.fromEntries(Object.entries(event).filter(([k])=>k!=='event_sha256'))))throw Error('Saved simulation event integrity failed.');
  const replayJob={...job,events:past,environment:state,memories:memoriesFor(job.agents,past)},candidate=contextFor(replayJob,agent,round),allowedOwn=new Set(candidate.own.map(e=>e.id)),allowedObserved=new Set(candidate.observed.map(e=>e.id));
  if(event.context_audit.own_event_ids.some(id=>!allowedOwn.has(id))||event.context_audit.observed_event_ids.some(id=>!allowedObserved.has(id)))throw Error('Saved agent memory exposure is inconsistent.');
  const input={...candidate,own:candidate.own.filter(e=>event.context_audit.own_event_ids.includes(e.id)),observed:candidate.observed.filter(e=>event.context_audit.observed_event_ids.includes(e.id)),evidence:candidate.evidence.filter(p=>event.context_audit.supplied_refs.includes(p.ref))},prepared={context:input};
  const normalized=normalize(JSON.stringify({action:event.action,target:event.target,statement:event.statement,references:event.references.map(r=>r.ref),uncertainty:event.uncertainty}),job,agent,round,prepared);
  if(canonical(normalized.references)!==canonical(event.references)||event.context_audit.prompt_sha256!==await digest(promptText(input)))throw Error('Saved source references or prompt exposure changed.');
  state=reduceState(state,event);if(event.next_state_sha256!==await digest(state))throw Error('Simulation state hash chain failed.');past.push(event);
 }
 if(canonical(state)!==canonical(job.environment)||canonical(memoriesFor(job.agents,past))!==canonical(job.memories))throw Error('Saved environment or agent memory does not match committed events.');if(job.simulation_graph&&canonical(job.simulation_graph)!==canonical(simulationGraph(job)))throw Error('Saved simulation graph does not match committed events.');if(job.report&&canonical(job.report)!==canonical(researchReport(job)))throw Error('Saved report does not match committed events.');if(job.state==='completed'&&(job.next_step!==job.spec.rounds*job.agents.length||!job.report))throw Error('Completed scenario has an incomplete report.');return true;
}
export function simulationGraph(job){
 const nodes=[...job.agents.map(a=>({id:a.id,label:a.name,kind:'agent',provenance:'SIMULATED'})),...job.events.map(e=>({id:e.id,label:e.action+' · '+e.tick,kind:'event',provenance:'SIMULATED'}))],edges=[];
 for(const e of job.events){edges.push({from:e.agent_id,to:e.id,relation:'generated',provenance:'SIMULATED'});for(const id of [...e.context_audit.own_event_ids,...e.context_audit.observed_event_ids])edges.push({from:id,to:e.id,relation:'supplied_as_context',provenance:'SIMULATED'});}
 return {nodes,edges,provenance:'SIMULATED',meaning:'Recorded synthetic events and supplied observations; no real social ties or causal relationships'};
}
export function researchReport(job){return {...reportFor(job),recipe:job.recipe,environment:job.environment,selected_evidence:job.seed,context_audits:job.events.map(e=>({event_id:e.id,...e.context_audit})),limitations:['Evidence consists of selected exact provider-field excerpts; omissions may change interpretation.','Agent observations and hypotheses are SIMULATED, not independently trained opinions.','References and rules do not validate clinical claims.','Local ranking, rule state and memory selection are DERIVED; generated statements remain SIMULATED.','No clinical/geographic forecast, MiroFish equivalence or cross-device deterministic reproduction is claimed.']};}
export async function runResearchJob(job,{store,envelope,generate,prepare,signal,onChange=()=>{}}){
 await verifyResearchJob(job,envelope);if(typeof prepare!=='function')throw Error('Tokenizer-backed context preparation is required for enhanced scenarios.');
 const total=job.spec.rounds*job.agents.length;job.state='running';job.stage='Preparing agent context';delete job.error;await store.save(job);onChange(job);
 try{
  for(let step=job.next_step;step<total;step++){
   signal?.throwIfAborted();const agent=job.agents[step%job.agents.length],round=Math.floor(step/job.agents.length)+1,context=contextFor(job,agent,round);job.stage='Budgeting '+agent.name+' context';onChange(job);
   const prepared=await prepare(context,signal,job.recipe.generation);signal?.throwIfAborted();
   verifyPrepared(context,prepared);
   if(prepared.prompt!==promptText(prepared.context)||canonical(prepared.schema)!==canonical(responseSchema(prepared.context.evidence.map(p=>p.ref),[...prepared.context.assumptions.map(a=>a.ref),...prepared.context.evidence.map(p=>p.ref)]))||prepared.budget.total_reserved>job.recipe.generation.context_limit)throw Error('Prepared model context or token budget is inconsistent.');
   job.stage='Generating '+agent.name+' action';job.live_diagnostics={budget:prepared.budget,agent_id:agent.id,started_at:Date.now(),provenance:'DERIVED'};onChange(job);
   const started=performance.now(),generated=await generate(prepared.prompt,signal,prepared.context.evidence.map(p=>p.ref),{enhanced:true,schema:prepared.schema,...job.recipe.generation,seed:job.recipe.generation.seed+step});signal?.throwIfAborted();
   const event=normalize(typeof generated==='string'?generated:generated.text,job,agent,round,prepared),next=reduceState(job.environment,event);
   Object.assign(event,{tick:next.tick,rule_version:RULES,prior_state_sha256:await digest(job.environment),next_state_sha256:await digest(next),generation:{...job.recipe.generation,seed:job.recipe.generation.seed+step},diagnostics:{duration_ms:Math.round(performance.now()-started),usage:generated.usage||null,budget:prepared.budget,provenance:'DERIVED'},context_audit:{provenance:'DERIVED',supplied_refs:prepared.context.evidence.map(p=>p.ref),own_event_ids:prepared.context.own.map(e=>e.id),observed_event_ids:prepared.context.observed.map(e=>e.id),prompt_sha256:await digest(prepared.prompt),schema_sha256:await digest(prepared.schema),selection:'Bounded local lexical memory selection; exact evidence and event IDs retained'}});
   event.context_sha256=await digest(event.context_audit);event.event_sha256=await digest(event);
   const nextEvents=[...job.events,event],candidate={...job,events:nextEvents,next_step:step+1,environment:next,memories:memoriesFor(job.agents,nextEvents),simulation_graph:simulationGraph({...job,events:nextEvents}),progress:Math.round(100*(step+1)/total),updated_at:Date.now(),stage:'Saved interaction '+(step+1)};
   delete candidate.live_diagnostics;await store.save(candidate);Object.assign(job,candidate);delete job.live_diagnostics;onChange(job);
  }
  signal?.throwIfAborted();const completed={...job,report:researchReport(job),state:'completed',stage:'completed',progress:100};await store.save(completed);Object.assign(job,completed);onChange(job);
 }catch(e){delete job.live_diagnostics;job.state=signal?.aborted?'paused':'failed';job.stage=job.state;job.error=signal?.aborted?'Paused after the last saved step. Resume when ready.':errorMessage(e);try{await store.save(job);}catch{job.error+=' The latest failure state could not be saved.';}onChange(job);throw e;}
 return job;
}
