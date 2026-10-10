// At most one active image worker and one queued job. A cancelled job never
// commits a preview. Worker termination cancels its execution context; browser
// codec internals are not independently measured or certified by this module.
export function readFile(file,signal){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  const abort=()=>{reader.abort();reject(new DOMException('Image processing cancelled.','AbortError'));};
  const cleanup=()=>signal.removeEventListener('abort',abort);
  reader.onload=()=>{cleanup();resolve(reader.result);};
  reader.onerror=()=>{cleanup();reject(Error('Unable to read this local file.'));};
  reader.onabort=()=>{cleanup();reject(new DOMException('Image processing cancelled.','AbortError'));};
  if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});reader.readAsArrayBuffer(file);
 });
}
export class ImagePipeline {
 constructor({createWorker=()=>new Worker(new URL('./image-worker.js',import.meta.url),{type:'module'}),read=readFile}={}){this.createWorker=createWorker;this.read=read;this.queue=[];this.active=null;}
 get busy(){return Boolean(this.active)||this.queue.length>0;}
 process(file,signal){
  return new Promise((resolve,reject)=>{
   if(signal.aborted){reject(new DOMException('Image processing cancelled.','AbortError'));return;}
   if(this.queue.length>=1){reject(Error('An image is already waiting. Wait for the current image or cancel it.'));return;}
   const job={file,signal,resolve,reject,worker:null,done:false};
   job.abort=()=>this.finish(job,new DOMException('Image processing cancelled.','AbortError'));
   signal.addEventListener('abort',job.abort,{once:true});this.queue.push(job);this.pump();
  });
 }
 finish(job,error,value){
  if(job.done)return;job.done=true;job.signal.removeEventListener('abort',job.abort);
  if(job.worker){job.worker.onmessage=null;job.worker.onerror=null;job.worker.terminate();job.worker=null;}
  this.queue=this.queue.filter(x=>x!==job);if(this.active===job)this.active=null;
  if(error)job.reject(error);else job.resolve(value);this.pump();
 }
 async pump(){
  if(this.active||!this.queue.length)return;const job=this.queue.shift();this.active=job;
  try{
   const bytes=await this.read(job.file,job.signal);if(job.done)return;
   const worker=this.createWorker();job.worker=worker;
   worker.onmessage=({data})=>{if(job.done)return;if(data.ok)this.finish(job,null,data.value);else this.finish(job,Error(data.error||'Image processing failed.'));};
   worker.onerror=()=>this.finish(job,Error('The image worker stopped. Try a smaller valid PNG or JPEG.'));
   worker.postMessage({bytes},[bytes]);
  }catch(error){this.finish(job,error);}
 }
}
