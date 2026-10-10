import {inspectImage} from './files.js';
self.onmessage=async({data})=>{
 let bitmap;
 try{
  const bytes=new Uint8Array(data.bytes);if(!bytes.length||bytes.length>5*1024*1024)throw Error('Image must be 1 byte to 5 MiB.');
  const size=inspectImage(bytes);bitmap=await createImageBitmap(new Blob([bytes],{type:size.mime}));
  if(bitmap.width<1||bitmap.height<1||bitmap.width>8000||bitmap.height>8000||bitmap.width*bitmap.height>12000000)throw Error('Decoded image exceeds dimension limits.');
  const width=bitmap.width,height=bitmap.height;bitmap.close();bitmap=null;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  self.postMessage({ok:true,value:{bytes:bytes.buffer,sha256:hash,width,height,mime:size.mime}},[bytes.buffer]);
 }catch(error){self.postMessage({ok:false,error:error.message||'Image decoding failed.'});}
 finally{bitmap?.close();}
};
