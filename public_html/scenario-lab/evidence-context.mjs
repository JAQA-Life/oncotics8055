// AGPL-3.0-or-later. Deterministic selection of exact provider-field excerpts.
import {digest,verifySnapshot} from './core.mjs';
const fields={
 ctgov:['protocolSection/identificationModule/briefTitle','protocolSection/descriptionModule/briefSummary','protocolSection/descriptionModule/detailedDescription','protocolSection/conditionsModule/conditions/*','protocolSection/statusModule/overallStatus','protocolSection/designModule/phases/*','protocolSection/outcomesModule/primaryOutcomes/*/measure'],
 epmc:['title','abstractText','journalInfo/journal/title','authorString','pubYear'],
 uniprot:['uniProtkbId','proteinDescription/recommendedName/fullName/value','genes/*/geneName/value','comments/*/texts/*/value','organism/scientificName'],
 pubchem:['Title','MolecularFormula'],
 openfda:['openfda/generic_name/*','description/*','mechanism_of_action/*','clinical_studies/*','warnings/*']
};
const esc=value=>String(value).replaceAll('~','~0').replaceAll('/','~1');
export function atPointer(value,pointer){for(const part of pointer.split('/').slice(1)){if(value===null||typeof value!=='object')return undefined;value=value[part.replaceAll('~1','/').replaceAll('~0','~')];}return value;}
function walk(value,parts,path,out){if(!parts.length){if(typeof value==='string'&&value.trim())out.push({path,text:value});return;}const [head,...rest]=parts;if(head==='*'){if(Array.isArray(value))value.slice(0,12).forEach((item,i)=>walk(item,rest,path+'/'+i,out));}else if(value&&typeof value==='object')walk(value[head],rest,path+'/'+esc(head),out);}
function rootPointer(record){const parts=record.locator.split('/');return parts.slice(0,record.source==='ctgov'||record.source==='uniprot'||record.source==='openfda'?3:4).join('/');}
export function terms(value){return (String(value).toLocaleLowerCase('en').match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu)||[]).filter(x=>x.length>1&&!new Set(['the','and','with','this','that','from','what','under','could','should','research','question']).has(x));}
export function rank(items,query){
 const q=[...new Set(terms(query))],docs=items.map(item=>terms(item.text)),avg=docs.reduce((n,d)=>n+d.length,0)/Math.max(1,docs.length),df=new Map(q.map(t=>[t,docs.filter(d=>d.includes(t)).length]));
 return items.map((item,i)=>{let score=0;for(const term of q){const tf=docs[i].filter(t=>t===term).length;if(tf)score+=Math.log(1+(items.length-df.get(term)+.5)/(df.get(term)+.5))*tf*2.2/(tf+1.2*(.25+.75*docs[i].length/Math.max(1,avg)));}return {...item,score};}).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
export async function evidenceSeed(envelope,query){
 await verifySnapshot(envelope);const corpus=[];
 corpusLoop:for(const record of envelope.snapshot.records){
  const receipt=envelope.snapshot.receipts.find(x=>x.id===record.receipt_id),base=rootPointer(record),raw=atPointer(receipt.payload,base),values=[];
  for(const field of fields[record.source]||[])walk(raw,field.split('/'),base,values);
  if(!values.length){const original=atPointer(receipt.payload,record.locator);if(typeof original==='string')values.push({path:record.locator,text:original});}
  for(const field of values.slice(0,20))for(let start=0;start<Math.min(field.text.length,4096);){
   let end=Math.min(start+480,field.text.length);if(end<field.text.length&&/[\uD800-\uDBFF]/.test(field.text[end-1]))end--;
   const text=field.text.slice(start,end);if(!text.trim()){start=end;continue;}
   corpus.push({id:record.id+':'+field.path+':'+start,record_id:record.id,source:record.source,source_id:record.source_id,title:record.title,provenance:record.provenance,receipt_id:receipt.id,receipt_sha256:receipt.sha256,retrieved_at:receipt.retrieved_at??receipt.imported_at,locator:field.path,start,end,text,excerpt:true,url:record.url});
   start=end;if(corpus.length>=2000)break corpusLoop;
  }
  if(corpus.length>=2000)break;
 }
 const selected=[],counts=new Map();for(const item of rank(corpus,query)){if((counts.get(item.record_id)||0)>=3)continue;selected.push(item);counts.set(item.record_id,(counts.get(item.record_id)||0)+1);if(selected.length===12)break;}
 for(const [i,item] of selected.entries()){item.ref='R'+(i+1);item.passage_sha256=await digest({locator:item.locator,start:item.start,end:item.end,text:item.text,receipt_sha256:item.receipt_sha256});item.selection={provenance:'DERIVED',method:'Local lexical BM25 ranking; maximum three excerpts per record',score:item.score};}
 if(!selected.length)throw Error('No supported source text is available for the scenario. Inspect the source records.');
 return selected;
}
export async function verifySeed(seed,envelope){
 for(const item of seed){const record=envelope.snapshot.records.find(r=>r.id===item.record_id),receipt=envelope.snapshot.receipts.find(r=>r.id===item.receipt_id),field=atPointer(receipt?.payload,item.locator);
  if(!record||record.receipt_id!==item.receipt_id||item.provenance!==record.provenance||item.receipt_sha256!==receipt.sha256||typeof field!=='string'||field.slice(item.start,item.end)!==item.text||await digest({locator:item.locator,start:item.start,end:item.end,text:item.text,receipt_sha256:item.receipt_sha256})!==item.passage_sha256)throw Error('Selected evidence excerpt does not match its source receipt.');
 }
}
