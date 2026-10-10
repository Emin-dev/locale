import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ImagePipeline} from '../web/image-pipeline.js';
const tick=()=>new Promise(r=>setImmediate(r));
const events=[];let live=0,maxLive=0,workers=[];
class FakeWorker{
 constructor(){this.dead=false;this.onmessage=null;this.onerror=null;live++;maxLive=Math.max(maxLive,live);workers.push(this);events.push('start');}
 postMessage(){this.started=true;}
 terminate(){assert(!this.dead);this.dead=true;live--;events.push('terminate');}
 finish(data={ok:true,value:{width:390,height:740}}){this.onmessage?.({data});}
}
const queue=new ImagePipeline({createWorker:()=>new FakeWorker(),read:async()=>new ArrayBuffer(4)});
const a=new AbortController(),b=new AbortController(),c=new AbortController();
const first=queue.process({},a.signal).catch(e=>e);await tick();assert.equal(workers.length,1);
const second=queue.process({},b.signal).catch(e=>e);const third=await queue.process({},c.signal).catch(e=>e);assert.match(third.message,/already waiting/);assert.equal(workers.length,1);
b.abort();assert.equal((await second).name,'AbortError');assert.equal(workers.length,1);a.abort();assert.equal((await first).name,'AbortError');assert.equal(live,0);assert.equal(queue.busy,false);
const d=new AbortController(),e=new AbortController();const fourth=queue.process({},d.signal).catch(e=>e);const fifth=queue.process({},e.signal);await tick();const old=workers.at(-1);d.abort();assert.equal((await fourth).name,'AbortError');await tick();assert.equal(old.dead,true);assert.equal(live,1);old.finish();assert.equal(live,1);workers.at(-1).finish();assert.deepEqual(await fifth,{width:390,height:740});assert.equal(live,0);
const bad=new AbortController();const failure=queue.process({},bad.signal).catch(e=>e);await tick();workers.at(-1).finish({ok:false,error:'Malformed image'});assert.equal((await failure).message,'Malformed image');assert.equal(live,0);
let finishRead;const slow=new ImagePipeline({createWorker:()=>new FakeWorker(),read:()=>new Promise(r=>finishRead=r)});const slowSignal=new AbortController();const before=workers.length;const slowResult=slow.process({},slowSignal.signal).catch(e=>e);slowSignal.abort();assert.equal((await slowResult).name,'AbortError');finishRead(new ArrayBuffer(4));await tick();assert.equal(workers.length,before);assert.equal(slow.busy,false);
assert.equal(maxLive,1);assert.equal(live,0);
const checks=['At most one active worker','At most one queued image','Queued cancellation starts no decoder','Active cancellation terminates worker','Cancelled worker cannot complete into next session','Failed decode terminates worker','Cancelled read never starts a worker','All worker instances terminated'];
fs.writeFileSync(new URL('../evidence/image-pipeline-results.json',import.meta.url),JSON.stringify({test_kind:'Unit tests with injected fake workers/readers. No actual browser decoder was executed.',checks,maxActiveWorkers:maxLive,liveWorkersAtEnd:live,events},null,2)+'\n');console.log('PASS '+checks.join('\nPASS '));
