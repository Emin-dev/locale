// Static deployment gate. No installation, Cargo, Rust or shell build is invoked.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read=p=>fs.readFileSync(path.join(root,p));
for(const f of ['web/index.html','web/app.js','web/style.css','web/files.js','web/image-pipeline.js','web/image-worker.js','web/sample-manifest.json','web/locale_review.wasm','web/third-party-licenses.txt'])assert(read(f).length>0,`Missing static asset: ${f}`);
const lock=read('Cargo.lock').toString(),entries=JSON.parse(read('licenses/manifest.json')),bundle=read('web/third-party-licenses.txt').toString();
const packages=[...lock.matchAll(/\[\[package\]\]\nname = "([^"]+)"\nversion = "([^"]+)"\nsource = "([^"]+)"\nchecksum = "([^"]+)"/g)];
for(const [,crate,version,,checksum]of packages)assert(entries.some(e=>e.crate===crate&&e.version===version&&e.registry_checksum===checksum),`Missing notices: ${crate}@${version}`);
for(const e of entries){const text=read(e.file);assert.equal(crypto.createHash('sha256').update(text).digest('hex'),e.sha256,`Changed notice ${e.file}`);assert(bundle.includes(text.toString()),`Notice not served: ${e.file}`);}
const standard=JSON.parse(read('licenses/rust-standard-library.json'));assert(standard.compiler.startsWith('rustc 1.99.0 '));assert.equal(standard.sha256,'5647be074c8edf7339fd863055923a8fc80bc5610a8d4661ec3b767b9d392c27');
for(const location of [standard.source,standard.served])assert.equal(crypto.createHash('sha256').update(read(location)).digest('hex'),standard.sha256,'Rust standard-library notice missing or modified');
const wasmBytes=read('web/locale_review.wasm');
for(const prefix of ['/workspace/','/home/','/Users/','C:\\Users\\'])assert(!wasmBytes.includes(prefix),`Shipped WASM contains an absolute user/build path (${prefix}). Rebuild with scripts/build.sh.`);
const wasm=(await WebAssembly.instantiate(wasmBytes,{})).instance.exports;
const fixture=JSON.parse(read('tests/fixture.json'));const bytes=Buffer.from(JSON.stringify({op:'audit',project:fixture}));const p=wasm.locale_alloc(bytes.length);assert(p);new Uint8Array(wasm.memory.buffer,p,bytes.length).set(bytes);const result=wasm.locale_process(p,bytes.length);wasm.locale_free(p,bytes.length);const ptr=Number(result&0xffffffffn),len=Number(result>>32n);const output=JSON.parse(Buffer.from(wasm.memory.buffer,ptr,len).toString());wasm.locale_free(ptr,len);assert(output.ok);assert.equal(output.value.counts.expected,2);assert.equal(output.value.counts.missing,1);
const manifest=JSON.parse(read('web/sample-manifest.json'));for(const c of manifest.captures)assert(read('web/fixtures/'+c.image).length>0);
console.log(`Static build verified: WASM smoke, ${manifest.captures.length} sample captures, ${packages.length} pinned dependencies, ${entries.length} Cargo license texts, pinned Rust standard-library notices. No Rust build or dependency install performed.`);
