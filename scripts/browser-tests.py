import json, threading, time, os
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'web')))
threading.Thread(target=server.serve_forever,daemon=True).start()
URL=os.environ.get('LOCALE_BASE_URL', f'http://127.0.0.1:{server.server_port}')
results=[]
def ok(name):results.append(name);print('PASS',name)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1050},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL);expect(page.locator('#stat-expected')).to_have_text('12');expect(page.locator('#stat-approved')).to_have_text('2')
 expect(page.locator('#stat-attention')).to_have_text('6');assert page.locator('.capture-card').count()==12
 ok('Rust/WASM sample boots with 12 declared slots, 9 captures, 2 approvals and 6 blockers')
 page.screenshot(path=str(ROOT/'evidence/desktop.png'),full_page=True)
 page.locator('[data-slot="2"]').click();expect(page.locator('#review-title')).to_have_text('Explore · fr-FR')
 page.locator('#approve').click();expect(page.locator('#review-status')).to_have_text('✓ Approved');expect(page.locator('#stat-approved')).to_have_text('3');expect(page.locator('#review-feedback')).to_contain_text('Capture approved')
 page.locator('#approve').click();assert page.locator('.history-event').count()==1;ok('Approval, hash-bound state and repeated-click idempotence')
 page.locator('#reject').click();expect(page.locator('#review-error')).to_contain_text('need a note')
 page.locator('#review-note').fill('The label needs a closer look.');page.locator('#reject').click();expect(page.locator('#review-status')).to_have_text('! Changes requested')
 page.locator('#review-note').fill('<img src=x onerror=alert(1)>');page.locator('#comment').click();expect(page.locator('#review-status')).to_have_text('! Changes requested');assert page.locator('#review-history img').count()==0
 ok('Required rejection note, comment preservation and literal untrusted text rendering')
 page.locator('#replace-file').set_input_files(str(ROOT/'web/fixtures/explore-de-DE.png'));expect(page.locator('#review-status')).to_have_text('↺ Review again');ok('Changed local image invalidates the old approval/rejection');expect(page.locator('#review-feedback')).to_contain_text('Image attached')
 # A non-390px PNG verifies the explicit CSS-pixel inspection scale.
 import zlib,struct
 def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
 landscape=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1920,1080,8,2,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+b'\x88\xaa\x88'*1920)*1080))+chunk(b'IEND',b'')
 page.locator('#replace-file').set_input_files({'name':'landscape.png','mimeType':'image/png','buffer':landscape});expect(page.locator('#replace-open')).to_be_enabled();page.locator('#actual-size').check();expect(page.locator('#current-stage img')).to_have_attribute('width','1920');assert page.locator('#current-stage img').evaluate('(img)=>img.getBoundingClientRect().width')==1920;assert page.locator('#current-stage').evaluate('(node)=>node.scrollWidth')>=1920;ok('Non-390px image uses its intrinsic width in CSS-pixel inspection mode')
 page.keyboard.press('Escape');expect(page.locator('#review-dialog')).not_to_be_visible()
 assert page.evaluate('document.activeElement.dataset.slot')=='2';ok('Escape dismisses review and restores keyboard focus')
 page.locator('[data-slot="3"]').click();expect(page.locator('#approve')).to_be_disabled();expect(page.locator('#review-reason')).to_contain_text('No capture');page.locator('#review-close').click()
 page.locator('[data-slot="7"]').click();expect(page.locator('#approve')).to_be_disabled();expect(page.locator('#review-status')).to_contain_text('Outdated');page.locator('#review-close').click()
 page.locator('[data-slot="10"]').click();expect(page.locator('#approve')).to_be_disabled();expect(page.locator('#review-status')).to_contain_text('Unverified');page.locator('#review-close').click();ok('Missing, stale and unverified captures block approval')
 page.locator('#search').fill('does not exist');expect(page.locator('#empty')).to_be_visible();page.locator('#clear-filters').click();assert page.locator('.capture-card').count()==12
 page.locator('[data-filter="approved"]').click();assert page.locator('.capture-card').count()==2;page.locator('[data-filter="all"]').click();page.locator('#locale-select').select_option('fr-FR');assert page.locator('.capture-card').count()==3;page.locator('#locale-select').select_option('');ok('Search empty state, reset and combined status/locale filters')
 with page.expect_download() as download:page.locator('#export-button').click()
 path=ROOT/'evidence/browser-export.json';download.value.save_as(path);data=json.loads(path.read_text());assert data['audit']['complete']==False;assert data['audit']['counts']['expected']==12;assert 'not a digital signature' in data['audit']['caveat'];ok('Portable JSON export preserves incomplete coverage and provenance caveats')
 page.locator('#import-open').click();page.locator('#import-submit').click();expect(page.locator('#import-error')).to_contain_text('Choose a JSON');page.locator('#import-cancel').click();assert page.locator('.capture-card').count()==12;ok('Empty import and cancel preserve the current project')
 page.locator('#import-open').click();page.locator('#manifest-file').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':b'{oops'});page.locator('#import-submit').click();expect(page.locator('#import-error')).to_contain_text('not valid JSON');page.locator('#import-cancel').click();ok('Malformed import rejected without replacing current reviews')
 manifest=json.loads((ROOT/'web/sample-manifest.json').read_text());manifest['captures'][0]['image']='https://evil.example/x.png'
 page.locator('#import-open').click();page.locator('#manifest-file').set_input_files({'name':'badpath.json','mimeType':'application/json','buffer':json.dumps(manifest).encode()});page.locator('#import-submit').click();expect(page.locator('#import-error')).to_contain_text('unsafe image name');page.locator('#import-cancel').click();ok('Remote image references are rejected by the Rust validator')
 page.locator('#import-open').click();page.locator('#manifest-file').set_input_files(str(ROOT/'web/sample-manifest.json'));page.locator('#image-files').set_input_files({'name':'explore-en-US.png','mimeType':'image/png','buffer':b'<svg onload="alert(1)"></svg>'});page.locator('#import-submit').click();expect(page.locator('#import-error')).to_contain_text('valid PNG');page.locator('#import-cancel').click();ok('SVG content masquerading as PNG is rejected before decode')
 page.locator('#import-open').click();page.locator('#manifest-file').set_input_files(str(ROOT/'web/sample-manifest.json'));page.locator('#import-submit').click();expect(page.locator('#import-dialog')).not_to_be_visible();expect(page.locator('#stat-approved')).to_have_text('0');page.locator('[data-slot="0"]').click();expect(page.locator('#approve')).to_be_disabled();page.locator('#replace-file').set_input_files(str(ROOT/'web/fixtures/explore-en-US.png'));expect(page.locator('#approve')).to_be_enabled();page.locator('#approve').click();expect(page.locator('#review-error')).to_contain_text('Invalid review event');page.locator('#reviewer-name').fill('Local reviewer');page.locator('#approve').click();expect(page.locator('#review-status')).to_have_text('✓ Approved');ok('Manifest-only import is unverified until local image and reviewer are supplied')
 page.screenshot(path=str(ROOT/'evidence/desktop-review.png'),full_page=True);page.locator('#review-close').click()
 page.set_viewport_size({'width':390,'height':844});page.goto(URL);expect(page.locator('#stat-expected')).to_have_text('12');assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(ROOT/'evidence/mobile.png'),full_page=True)
 page.locator('[data-slot="2"]').click();page.locator('#approve').click();expect(page.locator('#review-status')).to_have_text('✓ Approved');assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(ROOT/'evidence/mobile-review.png'),full_page=True);ok('390px mobile emulation completes approval without page overflow')
 page.keyboard.press('Escape');page.locator('#help-top').click();expect(page.locator('#help-dialog')).to_be_visible();page.keyboard.press('Escape');expect(page.locator('#help-dialog')).not_to_be_visible();ok('Guide opens and dismisses with Escape')
 assert not errors,errors;ok('No uncaught browser errors across exercised workflows')
 browser.close()
server.shutdown()
(ROOT/'evidence/browser-results.json').write_text(json.dumps({'browser':os.environ.get('CHROMIUM_EXECUTABLE','Playwright 1.62.0 bundled Chromium'),'emulation':'1440x1050 desktop; 390x844 mobile, not physical-device testing','passed':results,'errors':errors},indent=2))
