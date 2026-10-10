import fs from 'node:fs';import assert from 'node:assert/strict';
const root=new URL('..',import.meta.url).pathname;
const w=(await WebAssembly.instantiate(fs.readFileSync(root+'/web/locale_review.wasm'),{})).instance.exports;
const size=o=>Buffer.byteLength(JSON.stringify(o));
function call(o){let b=Buffer.from(JSON.stringify(o)),p=w.locale_alloc(b.length);if(!p)return{ok:false,error:'input allocation rejected: '+b.length};new Uint8Array(w.memory.buffer,p,b.length).set(b);let v=w.locale_process(p,b.length);w.locale_free(p,b.length);let op=Number(v&0xffffffffn),l=Number(v>>32n),r=JSON.parse(Buffer.from(w.memory.buffer,op,l).toString());w.locale_free(op,l);return r;}
let p=JSON.parse(fs.readFileSync(root+'/tests/fixture.json','utf8'));p.manifest.expected=p.manifest.expected.slice(0,1);p.manifest.captures=p.manifest.captures.slice(0,1);p.attachments=p.attachments.slice(0,1);for(const key of Object.keys(p.manifest.expected[0]))p.manifest.expected[0][key]='x'.repeat(80);p.manifest.captures[0].slot=structuredClone(p.manifest.expected[0]);
let a=call({op:'audit',project:p});assert(a.ok,a.error);const fingerprint=a.value.rows[0].fingerprint;
const review={slot:p.manifest.expected[0],fingerprint,decision:'comment',reviewer:'QA',comment:'x',at:'2026-10-09T19:00:00Z'};
p.reviews=Array.from({length:499},()=>structuredClone(review));
const req=()=>({op:'decide',project:p,slot:0,expected_fingerprint:fingerprint,expected_revision:'f'.repeat(64),decision:'rejected',reviewer:'QA',comment:'new rejection',at:'2026-10-09T19:00:00Z'});
const spare=1048576-size(req());const base=1+Math.floor(spare/499);const rem=spare%499;
assert(base<1500);for(let i=0;i<499;i++)p.reviews[i].comment='x'.repeat(base+(i<rem?1:0)-4)+String(i).padStart(4,'0');
a=call({op:'audit',project:p});assert(a.ok,a.error);let request=req();request.expected_revision=a.value.revision;assert.equal(size(request),1048576);
const original=JSON.stringify(p);
const result=call(request);assert.equal(result.ok,false);assert.match(result.error,/capacity/);assert.equal(JSON.stringify(p),original);
const nextExport=call({op:'export',project:p});assert(nextExport.ok,nextExport.error);assert.equal(nextExport.value.review_history.length,499);
const observation={inputDecisionBytes:size(request),accepted:result.ok,error:result.error,originalProjectUnchanged:JSON.stringify(p)===original,originalExportStillWorks:nextExport.ok,retainedReviewCount:nextExport.value.review_history.length};
console.log(JSON.stringify(observation,null,2));fs.writeFileSync(root+'/evidence/capacity-results.json',JSON.stringify(observation,null,2)+'\n');
