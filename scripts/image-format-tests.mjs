import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deflateSync} from 'node:zlib';
import {inspectImage} from '../web/files.js';

// Synthetic 1x1 pixels only. Fixture CRC deliberately uses a different,
// bit-at-a-time implementation from the production table-driven parser.
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
function u32(n){const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;}
function chunk(type,data=Buffer.alloc(0)){
 const payload=Buffer.concat([Buffer.from(type),data]);let crc=0xffffffff;
 for(const byte of payload){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return Buffer.concat([u32(data.length),payload,u32((crc^0xffffffff)>>>0)]);
}
const ihdr=(width=1,height=1)=>chunk('IHDR',Buffer.concat([u32(width),u32(height),Buffer.from([8,6,0,0,0])]));
const idat=chunk('IDAT',deflateSync(Buffer.from([0,255,0,0,255]))),iend=chunk('IEND');
const png=(...chunks)=>Buffer.concat([signature,...chunks]);
const staticPng=png(ihdr(),idat,iend);
function frame(sequence){const b=Buffer.alloc(26);b.writeUInt32BE(sequence);b.writeUInt32BE(1,4);b.writeUInt32BE(1,8);b.writeUInt16BE(1,20);b.writeUInt16BE(10,22);return chunk('fcTL',b);}
function animatedPng(plays=0,defaultIncluded=true){
 const actl=chunk('acTL',Buffer.concat([u32(2),u32(plays)]));
 const blue=deflateSync(Buffer.from([0,0,0,255,255]));
 return defaultIncluded?png(ihdr(),actl,frame(0),idat,frame(1),chunk('fdAT',Buffer.concat([u32(2),blue])),iend)
  :png(ihdr(),actl,idat,frame(0),chunk('fdAT',Buffer.concat([u32(1),blue])),frame(2),chunk('fdAT',Buffer.concat([u32(3),blue])),iend);
}
// Pillow-generated solid 1x1 JPEG/WebP, and a two-frame red/blue WebP.
const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDi6KKK+ZP3E//Z','base64');
const webp=Buffer.from('UklGRhwAAABXRUJQVlA4TA8AAAAvAAAAAAcQ/Y/+ByKi/wEA','base64');
const animatedWebp=Buffer.from('UklGRoQAAABXRUJQVlA4WAoAAAACAAAAAAAAAAAAQU5JTQYAAAAAAAAAAABBTk1GKAAAAAAAAAAAAAAAAAAAAGQAAAJWUDhMDwAAAC8AAAAABxD9j/4HIqL/AQBBTk1GKAAAAAAAAAAAAAAAAAAAAGQAAABWUDhMDwAAAC8AAAAABxDR//4HIqL/AQA=','base64');
const animationError=/Animated PNG screenshots are not supported/;
const formatError=/Only valid PNG and JPEG/;
const expectPng=b=>assert.deepEqual(inspectImage(b),{width:1,height:1,mime:'image/png'});
expectPng(staticPng);
assert.deepEqual(inspectImage(jpeg),{width:1,height:1,mime:'image/jpeg'});
// A chunk name appearing inside ancillary data is not an animation chunk.
expectPng(png(ihdr(),chunk('tEXt',Buffer.from('note\0acTL fcTL fdAT')),idat,iend));
expectPng(png(ihdr(),idat,chunk('tEXt',Buffer.from('note\0static')),iend));
const compressed=idat.subarray(8,-4);
expectPng(png(ihdr(),chunk('IDAT',compressed.subarray(0,3)),chunk('IDAT',compressed.subarray(3)),iend));
const offset=Buffer.concat([Buffer.from('padding'),staticPng,Buffer.from('padding')]);expectPng(offset.subarray(7,-7));
for(const name of fs.readdirSync(new URL('../web/fixtures/',import.meta.url)))assert.equal(inspectImage(fs.readFileSync(new URL('../web/fixtures/'+name,import.meta.url))).mime,'image/png');
const animations=[animatedPng(),animatedPng(1),animatedPng(0,false),png(ihdr(),frame(0),idat,iend),png(ihdr(),idat,chunk('fdAT',u32(0)),iend),png(ihdr(),idat,chunk('acTL',Buffer.concat([u32(1),u32(0)])),iend)];
for(const bytes of animations)assert.throws(()=>inspectImage(bytes),animationError);
for(const bytes of [webp,animatedWebp])assert.throws(()=>inspectImage(bytes),formatError);
for(let n=0;n<staticPng.length;n++)assert.throws(()=>inspectImage(staticPng.subarray(0,n)),undefined,`truncated at byte ${n}`);
for(const n of [14,0x7fffffff,0x80000000,0xffffffff]){const bad=Buffer.from(staticPng);bad.writeUInt32BE(n,8);assert.throws(()=>inspectImage(bad),/PNG/);}
for(const p of [29,staticPng.length-1]){const bad=Buffer.from(staticPng);bad[p]^=1;assert.throws(()=>inspectImage(bad),/checksum/);}
const malformed=[png(idat,iend),png(ihdr(),ihdr(),idat,iend),png(chunk('IHDR',Buffer.alloc(12)),idat,iend),png(ihdr(),iend),png(ihdr(),idat),png(ihdr(),idat,chunk('IEND',Buffer.from([0]))),Buffer.concat([staticPng,Buffer.from([0])]),png(ihdr(),chunk('ABcD'),idat,iend),png(ihdr(),chunk('ABCD'),idat,iend),png(ihdr(),idat,chunk('tEXt'),idat,iend)];
for(const bytes of malformed)assert.throws(()=>inspectImage(bytes),/PNG/);
for(const [w,h] of [[0,1],[1,0],[8001,1],[4000,4000],[0xffffffff,1]])assert.throws(()=>inspectImage(png(ihdr(w,h),idat,iend)),/Limit/);
console.log('PASS PNG framing, CRC, truncation, bounded lengths, static metadata, sample PNGs and PNG/JPEG compatibility');
console.log('PASS APNG controls rejected in both default-image layouts; static and animated WebP remain unsupported');

// Exercise the actual worker entrypoint, with only its browser decoder stubbed.
// Browser tests independently decode the valid fixtures and exercise the UI.
let decoded=0,closed=0,response;
globalThis.self={postMessage:value=>{response=value;}};
globalThis.createImageBitmap=async blob=>{decoded++;assert(['image/png','image/jpeg'].includes(blob.type));return{width:1,height:1,close(){closed++;}};};
await import('../web/image-worker.js');
async function run(bytes){response=undefined;const buffer=Uint8Array.from(bytes).buffer;await self.onmessage({data:{bytes:buffer}});assert(response);return response;}
for(const bytes of [...animations,webp,animatedWebp,...malformed]){const before=decoded;const result=await run(bytes);assert.equal(result.ok,false);assert.equal(decoded,before,'Rejected bytes must not reach createImageBitmap');}
for(const bytes of [staticPng,jpeg]){const result=await run(bytes);assert.equal(result.ok,true);assert.deepEqual(Buffer.from(result.value.bytes),bytes);assert.equal(result.value.sha256,Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex'));}
assert.equal(decoded,2);assert.equal(closed,2);
console.log('PASS Actual worker rejects animation/malformed inputs before decoding; static original bytes and hashes preserved');
