import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {inspectImage} from '../web/files.js';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const {instance}=await WebAssembly.instantiate(fs.readFileSync(path.join(root,'web/locale_review.wasm')),{});
const wasm=instance.exports;
function call(obj){
 const bytes=new TextEncoder().encode(JSON.stringify(obj));const p=wasm.locale_alloc(bytes.length);assert(p);new Uint8Array(wasm.memory.buffer,p,bytes.length).set(bytes);
 const packed=wasm.locale_process(p,bytes.length);wasm.locale_free(p,bytes.length);const ptr=Number(packed&0xffffffffn),len=Number(packed>>32n);const v=JSON.parse(new TextDecoder().decode(new Uint8Array(wasm.memory.buffer,ptr,len)));wasm.locale_free(ptr,len);return v;
}
function request(obj){const result=call(obj);assert(result.ok,result.error);return result.value;}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'web/sample-manifest.json')));
let project={manifest,attachments:manifest.captures.map(c=>({name:c.image,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'web/fixtures',c.image))).digest('hex')})),reviews:[]};
let a=request({op:'audit',project});assert.equal(a.counts.expected,12);assert.equal(a.counts.captured,9);assert.equal(a.counts.missing,3);assert.equal(a.counts.stale,1);assert.equal(a.counts.unverified,1);
const decisions=[[0,'approved',''],[1,'approved',''],[5,'rejected','Check label spacing.']];
for(const [slot,decision,comment]of decisions){const response=request({op:'decide',project,slot,expected_revision:a.revision,expected_fingerprint:a.rows[slot].fingerprint,decision,reviewer:'QA synthetic',comment,at:'2026-10-09T12:00:00.000Z'});project=response.project;a=response.audit;}
assert.equal(a.counts.approved,2);assert.equal(a.counts.rejected,1);assert.equal(a.counts.pending,4);
let old=a;project.attachments[0].sha256='f'.repeat(64);a=request({op:'audit',project});assert.equal(a.rows[0].status,'invalidated');
assert(!call({op:'decide',project,slot:0,expected_revision:old.revision,expected_fingerprint:old.rows[0].fingerprint,decision:'approved',reviewer:'QA',comment:'',at:'2026-10-09T12:00:00Z'}).ok);
const report=request({op:'export',project});assert.equal(report.audit.complete,false);assert.equal(report.audit.counts.invalidated,1);assert(report.audit.caveat.includes('not a digital signature'));
for(let i=0;i<250;i++)assert.equal(request({op:'audit',project}).revision,a.revision);
assert.equal(wasm.locale_alloc(1048577),0);
const png=fs.readFileSync(path.join(root,'web/fixtures/explore-en-US.png'));assert.deepEqual(inspectImage(png),{width:390,height:740,mime:'image/png'});
for(const bytes of [new Uint8Array(),new TextEncoder().encode('<svg></svg>'),new Uint8Array([255,216,255,192,0,1]),new Uint8Array([137,80,78,71])])assert.throws(()=>inspectImage(bytes));
const tooLarge=Buffer.from(png);tooLarge.writeUInt32BE(8001,16);assert.throws(()=>inspectImage(tooLarge));
const megapixel=Buffer.from(png);megapixel.writeUInt32BE(4000,16);megapixel.writeUInt32BE(4000,20);assert.throws(()=>inspectImage(megapixel));
const zero=Buffer.from(png);zero.writeUInt32BE(0,20);assert.throws(()=>inspectImage(zero));
const checks=['WASM ABI sample coverage oracle','WASM decision and rejection sequence','Changed bytes invalidate current decisions','Stale project revision blocks outdated decision','Portable export preserves incomplete state','250 repeated ABI calls stable','Allocation limit enforced','PNG header dimensions correct','Empty/truncated/SVG-disguised input rejected','Oversized dimensions/pixels and zero dimensions rejected'];
fs.writeFileSync(path.join(root,'evidence/wasm-results.json'),JSON.stringify({checks,passed:checks.length,wasm_bytes:fs.statSync(path.join(root,'web/locale_review.wasm')).size,wasm_memory_bytes:wasm.memory.buffer.byteLength},null,2)+'\n');
console.log('PASS '+checks.join('\nPASS '));
