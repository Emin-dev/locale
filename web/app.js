'use strict';
import {ImagePipeline} from './image-pipeline.js';
// Browser glue only: bounded file acquisition, image preview and accessible UI.
// The Rust core owns matrix validation, eligibility, decisions and exports.
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=text; return n; };
const label={approved:'Approved',pending:'Needs review',missing:'Missing capture',stale:'Outdated',unverified:'Unverified',rejected:'Changes requested',invalidated:'Review again'};
const symbol={approved:'✓',pending:'◷',missing:'−',stale:'↺',unverified:'!',rejected:'!',invalidated:'↺'};
const localeNames={'en-US':'English','de-DE':'Deutsch','fr-FR':'Français','ar-SA':'العربية'};
const MAX_TOTAL_PIXELS=60_000_000;
const imagePipeline=new ImagePipeline();let imageSession=new AbortController(),replaceBusy=false;
function cancelImages(){imageSession.abort();imageSession=new AbortController();}
let wasm, project, audit, previews=new Map(), selected=-1, filter='all', sample=true, epoch=0, modalEpoch=0, toastTimer;
const encoder=new TextEncoder(), decoder=new TextDecoder('utf-8',{fatal:true});
function core(request){
 const bytes=encoder.encode(JSON.stringify(request));
 if(bytes.length>1048576)throw Error('Project exceeds the 1 MiB processing limit. Export and start a smaller project.');
 const p=wasm.locale_alloc(bytes.length); if(!p)throw Error('Unable to allocate review input.');
 let packed;
 try{new Uint8Array(wasm.memory.buffer,p,bytes.length).set(bytes);packed=wasm.locale_process(p,bytes.length);}finally{wasm.locale_free(p,bytes.length);}
 const out=Number(packed&0xffffffffn), len=Number(packed>>32n);let response;
 try{response=JSON.parse(decoder.decode(new Uint8Array(wasm.memory.buffer,out,len)));}finally{wasm.locale_free(out,len);}
 if(!response.ok)throw Error(response.error);return response.value;
}
function toast(text){if($('review-dialog').open)$('review-feedback').textContent=text;clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function showError(id,error){$(id).textContent=error.message||String(error);$(id).hidden=false;}
function revoke(map){for(const v of map.values())URL.revokeObjectURL(v.url);}
function statusChip(status){return el('span',`status-chip ${status}`,`${symbol[status]} ${label[status]}`);}
function matches(row){const term=$('search').value.trim().toLowerCase();return(!term||`${row.slot.screen} ${row.slot.state}`.toLowerCase().includes(term)) &&(filter==='all'||filter==='approved'&&row.status==='approved'||filter==='attention'&&['missing','stale','unverified','rejected','invalidated'].includes(row.status));}
function render(){
 if(!project||!audit)return;
 const m=project.manifest,c=audit.counts,locales=[...new Set(m.expected.map(s=>s.locale))];
 $('loading').hidden=true;$('fatal').hidden=true;$('workspace-name').textContent=m.project+' studio';$('crumb-release').textContent=m.release;$('release-title').textContent=m.release;$('build-label').textContent=m.build;$('locale-total').textContent=locales.length+' locales';
 document.querySelector('.release-meta span:last-child').textContent=sample?'Synthetic sample':'Local import';
 $('stat-expected').textContent=c.expected;$('stat-captured').replaceChildren(document.createTextNode(c.captured),el('em','',`/ ${c.expected}`));
 $('stat-approved').textContent=c.approved;const attention=c.missing+c.stale+c.unverified+c.rejected+c.invalidated;$('stat-attention').textContent=attention;
 $('captured-hint').textContent=`${project.attachments.length} images attached in this tab`;
 $('attention-hint').textContent=[c.missing?`${c.missing} missing`:null,c.stale?`${c.stale} outdated`:null,c.unverified?`${c.unverified} unverified`:null,c.rejected?`${c.rejected} changes`:null,c.invalidated?`${c.invalidated} changed`:null].filter(Boolean).join(' · ')||'No blockers in declared coverage';
 $('nav-count').textContent=c.expected;$('filter-all-count').textContent=c.expected;$('filter-attention-count').textContent=attention;$('filter-approved-count').textContent=c.approved;
 $('release-status').replaceChildren(el('span'),document.createTextNode(audit.complete?'All views approved':'Review in progress'));
 const select=$('locale-select'),old=select.value;select.replaceChildren(new Option('All locales',''));for(const l of locales)select.add(new Option(l,l));select.value=locales.includes(old)?old:'';
 const visibleLocales=select.value?[select.value]:locales;const matrix=$('matrix');matrix.replaceChildren();matrix.style.setProperty('--cols',visibleLocales.length);
 const groups=new Map();audit.rows.forEach((r,i)=>{const k=JSON.stringify([r.slot.screen,r.slot.state,r.slot.configuration,r.slot.text_size,r.slot.appearance]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push({r,i});});
 const header=el('div','matrix-head');header.append(el('div','','Screen / state'));for(const l of visibleLocales){const h=el('div','locale-header');h.append(el('span','locale-badge',l.split('-')[0]),document.createTextNode(l),el('small','',localeNames[l]||''));header.append(h);}matrix.append(header);
 let shown=0;
 for(const group of groups.values()){
  if(!group.some(({r})=>visibleLocales.includes(r.slot.locale)&&matches(r)))continue;
  const row=el('div','matrix-row'),s=group[0].r.slot;const heading=el('div','row-label');heading.append(el('strong','',s.screen),el('small','',s.state),el('span','state-tag',s.configuration+' · '+s.text_size+' · '+s.appearance));row.append(heading);
  for(const l of visibleLocales){const entry=group.find(({r})=>r.slot.locale===l);if(!entry||!matches(entry.r)){row.append(el('div','capture-cell filtered-cell',entry?'Filtered':'Not required'));continue;}
   shown++;const {r,i}=entry,cell=el('div','capture-cell'),button=el('button',`capture-card ${r.status==='missing'?'missing-card':''}`);button.type='button';button.dataset.slot=i;button.setAttribute('aria-label',`${s.screen}, ${s.state}, ${l}, ${s.configuration}, ${s.text_size} text, ${s.appearance} appearance: ${label[r.status]}`);
   const mob=el('div','mobile-locale');mob.append(document.createTextNode(l),el('small','',localeNames[l]||''));button.append(mob);
   const area=el('div','thumb-area');const preview=r.capture&&previews.get(r.capture.image);
   if(preview){const img=el('img');img.src=preview.url;img.alt='';img.loading='lazy';img.width=390;img.height=740;area.append(img);}else{area.append(el('span','missing-symbol',r.status==='missing'?'+':'▧'),el('span','missing-caption',r.status==='missing'?'Awaiting capture':'Image not attached'));}
   const foot=el('div','card-foot');foot.append(statusChip(r.status),el('span','card-arrow','↗'));button.append(area,foot);button.addEventListener('click',()=>openReview(i));cell.append(button);row.append(cell);
  }matrix.append(row);
 }
 $('empty').hidden=shown>0;matrix.hidden=!shown;
}
function setFilter(value){filter=value;for(const b of document.querySelectorAll('[data-filter]')){b.classList.toggle('selected',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));}render();}
function stage(id,row,description){const target=$(id);target.replaceChildren();if(row?.capture&&previews.has(row.capture.image)){const img=el('img');const preview=previews.get(row.capture.image);img.src=preview.url;img.width=preview.width;img.height=preview.height;img.alt=`${description}: ${row.slot.screen}, ${row.slot.state}, ${row.slot.locale}`;target.append(img);}else{target.append(el('div','image-placeholder',row?.status==='missing'?'No capture was supplied for this required configuration.':'No image bytes attached. Import or attach the named image to inspect it.'));}}
function updateReview(){
 const r=audit.rows[selected];if(!r)return;
 $('review-title').textContent=`${r.slot.screen} · ${r.slot.locale}`;$('review-subtitle').textContent=`${r.slot.state} / ${r.slot.configuration} / ${r.slot.text_size} text / ${r.slot.appearance}`;
 const reference=audit.rows.find(x=>x.slot.screen===r.slot.screen&&x.slot.state===r.slot.state&&x.slot.configuration===r.slot.configuration&&x.slot.text_size===r.slot.text_size&&x.slot.appearance===r.slot.appearance&&x.slot.locale==='en-US'&&x.slot.locale!==r.slot.locale)||audit.rows.find(x=>x.slot.screen===r.slot.screen&&x.slot.state===r.slot.state&&x.slot.configuration===r.slot.configuration&&x.slot.text_size===r.slot.text_size&&x.slot.appearance===r.slot.appearance&&x.slot.locale!==r.slot.locale);
 $('reference-locale').textContent=reference?.slot.locale||'None';$('current-locale').textContent=r.slot.locale;stage('reference-stage',reference,'Reference capture');stage('current-stage',r,'Review capture');
 $('review-status').replaceChildren(statusChip(r.status));$('review-reason').textContent=r.reason;
 const dl=$('metadata-list');dl.replaceChildren();for(const [k,v,mono] of [['Target build',project.manifest.build,true],['Capture build',r.capture?.build||'Not supplied',true],['Captured',r.capture?.captured_at||'Not supplied',false],['Image',r.capture?.image||'Not supplied',false],['Bytes SHA-256',r.byte_sha256||'Not attached',true],['Review binding',r.fingerprint,true]]){dl.append(el('dt','',k),el('dd',mono?'mono':'',v));}
 for(const id of ['approve','reject','comment'])$(id).disabled=!r.can_review;
 $('replace-open').disabled=!r.capture||replaceBusy;
 $('replace-open').textContent=replaceBusy?'Checking image…':r.capture?'Attach / replace image…':'Import a manifest with this capture to continue';
 const history=$('review-history');history.replaceChildren();if(!r.comments.length)history.append(el('p','history-empty','No decisions yet. Start with a careful look.'));
 for(const v of [...r.comments].reverse()){const item=el('div','history-event'+(v.fingerprint!==r.fingerprint?' old':''));item.append(el('strong','',`${v.reviewer} · ${v.decision==='comment'?'Comment':label[v.decision]}`),el('small','',v.at+(v.fingerprint!==r.fingerprint?' · Previous evidence':'')));if(v.comment)item.append(el('p','',v.comment));history.append(item);}
}
function openReview(i){selected=i;modalEpoch++;$('review-note').value='';$('review-feedback').textContent='';$('review-error').hidden=true;$('actual-size').checked=false;for(const id of ['reference-stage','current-stage'])$(id).classList.remove('actual');updateReview();$('review-dialog').showModal();}
function closeReview(){cancelImages();$('review-dialog').close();modalEpoch++;}
function decide(decision){
 $('review-error').hidden=true;
 try{const r=audit.rows[selected];const response=core({op:'decide',project,slot:selected,expected_fingerprint:r.fingerprint,expected_revision:audit.revision,decision,reviewer:$('reviewer-name').value,comment:$('review-note').value,at:new Date().toISOString()});project=response.project;audit=response.audit;cancelImages();epoch++;render();updateReview();$('review-note').value='';toast(decision==='approved'?'Capture approved. Decision is bound to this evidence.':decision==='rejected'?'Changes requested. Your note is in the review record.':'Comment added to this capture.');}
 catch(error){showError('review-error',error);}
}
async function prepareImage(file,name,isStale){
 if(isStale())throw new DOMException('Image processing cancelled.','AbortError');
 if(!file.size||file.size>5*1024*1024)throw Error(`${name}: each image must be 1 byte to 5 MiB.`);
 const result=await imagePipeline.process(file,imageSession.signal);
 if(isStale())throw Error('Image processing cancelled.');
 const blob=new Blob([result.bytes],{type:result.mime});
 return{attachment:{name,sha256:result.sha256},preview:{url:URL.createObjectURL(blob),width:result.width,height:result.height,bytes:file.size}};
}

function setProject(p,nextPreviews,isSample,nextAudit){cancelImages();revoke(previews);project=p;previews=nextPreviews;sample=isSample;audit=nextAudit||core({op:'audit',project});epoch++;selected=-1;filter='all';$('search').value='';$('locale-select').value='';setFilter('all');}
async function loadSample(){
 cancelImages();const started=++epoch,nextPreviews=new Map();$('sample-reset').disabled=true;
 try{const m=await fetch('sample-manifest.json').then(r=>{if(!r.ok)throw Error('Sample manifest is unavailable.');return r.json();});let p={manifest:m,attachments:[],reviews:[]};core({op:'audit',project:p});
  for(const capture of m.captures){const response=await fetch(`fixtures/${encodeURIComponent(capture.image)}`);if(!response.ok)throw Error('A sample capture is unavailable.');const result=await prepareImage(await response.blob(),capture.image,()=>epoch!==started);p.attachments.push(result.attachment);nextPreviews.set(capture.image,result.preview);}
  let a=core({op:'audit',project:p});for(const [slot,decision,comment,reviewer] of [[0,'approved','Copy and layout reviewed for the standard mobile state.','Alex · sample'],[1,'approved','Navigation and primary text reviewed.','Mia · sample'],[5,'rejected','Check the long action label and its spacing on a narrow screen.','Mia · sample']]){
   const response=core({op:'decide',project:p,slot,expected_fingerprint:a.rows[slot].fingerprint,expected_revision:a.revision,decision,reviewer,comment,at:'2026-10-09T11:30:00Z'});p=response.project;a=response.audit;
  }if(epoch!==started)throw Error('Sample load cancelled.');setProject(p,nextPreviews,true,a);
 }catch(error){revoke(nextPreviews);if(!project){$('loading').hidden=true;showError('fatal',error);}else toast(error.message);}
 finally{$('sample-reset').disabled=false;}
}
function resetImport(){cancelImages();++epoch;$('import-error').hidden=true;$('import-progress').textContent='';$('import-submit').disabled=false;$('manifest-file').value='';$('image-files').value='';}
function closeImport(){$('import-dialog').close();resetImport();}
async function importBundle(){
 const manifest=$('manifest-file').files[0],files=[...$('image-files').files];$('import-error').hidden=true;
 if(!manifest){showError('import-error',Error('Choose a JSON manifest first.'));return;}
 const started=++epoch,nextPreviews=new Map();$('import-submit').disabled=true;
 try{
  if(manifest.size>512*1024)throw Error('Manifest must be at most 512 KiB.');
  if(files.length>200||files.reduce((n,f)=>n+f.size,0)>30*1024*1024)throw Error('Limit: 200 images and 30 MiB total.');
  const text=await manifest.text();if(epoch!==started)return;
  let m;try{m=JSON.parse(text);}catch{throw Error('Manifest is not valid JSON.');}
  const p={manifest:m,attachments:[],reviews:[]};core({op:'audit',project:p});
  let totalPixels=0;
  const allowed=new Set(m.captures.map(c=>c.image)),seen=new Set();
  for(const file of files){if(!allowed.has(file.name))throw Error(`${file.name}: not referenced by this manifest.`);if(seen.has(file.name))throw Error(`Duplicate file: ${file.name}`);seen.add(file.name);}
  for(let i=0;i<files.length;i++){$('import-progress').textContent=`Checking image ${i+1} of ${files.length}…`;const result=await prepareImage(files[i],files[i].name,()=>epoch!==started);p.attachments.push(result.attachment);nextPreviews.set(files[i].name,result.preview);totalPixels+=result.preview.width*result.preview.height;if(totalPixels>MAX_TOTAL_PIXELS)throw Error('Bundle exceeds 60 megapixels total. Use a smaller review batch.');}
  const a=core({op:'audit',project:p});if(epoch!==started)throw Error('Import cancelled.');
  setProject(p,nextPreviews,false,a);$('reviewer-name').value='';closeImport();toast(`Imported ${a.counts.expected} required views. ${a.counts.approved} approved.`);
 }catch(error){revoke(nextPreviews);if(epoch===started)showError('import-error',error);}
 finally{if(epoch===started){$('import-submit').disabled=false;$('import-progress').textContent='';}}
}
async function replaceImage(){
 const file=$('replace-file').files[0];$('replace-file').value='';if(!file||replaceBusy)return;replaceBusy=true;updateReview();
 const i=selected,oldRevision=audit.revision,r=audit.rows[i],opened=modalEpoch,started=epoch;let result;
 try{if(!r.capture)throw Error('Import a capture record first.');result=await prepareImage(file,r.capture.image,()=>epoch!==started||modalEpoch!==opened);
  if(audit.revision!==oldRevision||selected!==i||!$('review-dialog').open)throw Error('Review changed while the image was loading. Please attach again.');
  const kept=[...previews.entries()].filter(([name])=>name!==r.capture.image).map(([,v])=>v);
  if(kept.reduce((n,v)=>n+v.width*v.height,0)+result.preview.width*result.preview.height>MAX_TOTAL_PIXELS||kept.reduce((n,v)=>n+v.bytes,0)+result.preview.bytes>30*1024*1024)throw Error('Session limit: 60 megapixels and 30 MiB total.');
  const next=structuredClone(project);next.attachments=next.attachments.filter(a=>a.name!==r.capture.image);next.attachments.push(result.attachment);const nextAudit=core({op:'audit',project:next});
  const previous=previews.get(r.capture.image);if(previous)URL.revokeObjectURL(previous.url);previews.set(r.capture.image,result.preview);project=next;audit=nextAudit;epoch++;render();updateReview();toast('Image attached. Any decision for different evidence no longer applies.');
 }catch(error){if(result)URL.revokeObjectURL(result.preview.url);if($('review-dialog').open&&error.name!=='AbortError')showError('review-error',error);}
 finally{replaceBusy=false;if($('review-dialog').open)updateReview();}
}
function exportReport(){try{const report=core({op:'export',project});const data=JSON.stringify(report,null,2)+'\n';const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=el('a');a.href=url;a.download='locale-review-report.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Report download requested. Review names, filenames and comments before sharing.');}catch(error){toast(error.message);}}
for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>setFilter(b.dataset.filter));
$('search').addEventListener('input',render);$('locale-select').addEventListener('change',render);$('clear-filters').addEventListener('click',()=>{$('search').value='';$('locale-select').value='';setFilter('all');});
$('nav-coverage').addEventListener('click',()=>{$('coverage-title').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});$('search').focus({preventScroll:true});});
for(const id of ['nav-guide','help-top'])$(id).addEventListener('click',()=>$('help-dialog').showModal());$('help-close').addEventListener('click',()=>$('help-dialog').close());
$('review-close').addEventListener('click',closeReview);$('review-dialog').addEventListener('cancel',()=>{cancelImages();modalEpoch++;});
$('review-dialog').addEventListener('close',()=>{modalEpoch++;const opener=document.querySelector(`button[data-slot="${selected}"]`);(opener||$('search')).focus({preventScroll:true});});
$('actual-size').addEventListener('change',()=>{for(const id of ['reference-stage','current-stage'])$(id).classList.toggle('actual',$('actual-size').checked);});
$('approve').addEventListener('click',()=>decide('approved'));$('reject').addEventListener('click',()=>decide('rejected'));$('comment').addEventListener('click',()=>decide('comment'));
$('replace-open').addEventListener('click',()=>$('replace-file').click());$('replace-file').addEventListener('change',replaceImage);
$('import-open').addEventListener('click',()=>{if(!wasm)return;resetImport();$('import-dialog').showModal();});$('import-close').addEventListener('click',closeImport);$('import-cancel').addEventListener('click',closeImport);$('import-dialog').addEventListener('cancel',resetImport);$('import-submit').addEventListener('click',importBundle);
$('export-button').addEventListener('click',exportReport);$('sample-reset').addEventListener('click',()=>{if(confirm('Reload the synthetic sample? Current session reviews will be replaced. Export first if you want to keep them.'))loadSample();});
window.addEventListener('pagehide',event=>{if(!event.persisted){cancelImages();++epoch;revoke(previews);}});
try{const response=await fetch('locale_review.wasm');if(!response.ok)throw Error('Review engine could not be loaded. Reload or check the deployment.');const instance=await WebAssembly.instantiate(await response.arrayBuffer(),{});wasm=instance.instance.exports;await loadSample();}
catch(error){$('loading').hidden=true;showError('fatal',error);$('import-open').disabled=true;$('export-button').disabled=true;$('sample-reset').disabled=true;}
