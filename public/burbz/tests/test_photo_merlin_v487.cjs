'use strict';
// Photo Merlin v487: photos are identified the Merlin way. The page sends the
// rough place and week, shows ranked bird cards and waits for This is my bird.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const BUILD='photo-merlin-v487-20260925';

test('v487 ships together: build marker, cache, worker lists and updater',()=>{
 const html=read('index.html'),sw=read('sw.js'),updater=fs.readFileSync(path.join(root,'../../scripts/update-live-burbz.sh'),'utf8');
 assert(html.includes("const BURBZ_BUILD = '"+BUILD+"';"));
 assert(sw.match(/const BURBZ_CACHE = '([^']+)'/)[1].endsWith('-'+BUILD));
 assert.equal(sw.split("'./photo_queue.js?v="+BUILD+"'").length-1,3,'photo queue in all three worker lists');
 assert(html.includes('photo_queue.js?v='+BUILD));
 for(const file of ['photo_id.py','photo_gemini.py','photo_budget.py','photo_queue.js','sound_id/birdnet_v3_provider.py'])assert(updater.includes('"'+file+'"'),file);
});

test('one contract across page, queue, adapter, worker, installer and proof',()=>{
 const html=read('index.html'),queue=read('photo_queue.js'),adapter=read('photo_id.py'),worker=read('photo_gemini.py');
 const installer=fs.readFileSync(path.join(root,'../../scripts/install-photo-id.sh'),'utf8');
 const proof=fs.readFileSync(path.join(root,'../../scripts/verify-photo-id.py'),'utf8');
 for(const [name,text] of [['page',html],['queue',queue],['adapter',adapter],['worker',worker],['installer',installer],['proof',proof]])
  assert(text.includes('photo-gemini-v487'),name);
 for(const [name,text] of [['page',html],['queue',queue],['adapter',adapter],['proof',proof]])assert(text.includes('merlin-v487'),name);
 assert(!html.includes("'photo-gemini-v425'")&&!queue.includes('photo-gemini-v425'));
});

test('the page never adds a bird without the player, and never offers a catalogue picker',()=>{
 const html=read('index.html');
 const identify=html.slice(html.indexOf('async function identifyImage('),html.indexOf('\nasync function startCamera()'));
 assert(!identify.includes('handleBirdCandidates('),'identifyImage itself awards nothing');
 const pick=html.slice(html.indexOf('function pickPhotoMatch('),html.indexOf('async function identifyImage('));
 assert(pick.includes('state?.matches?.[index]')&&pick.includes('state.picked = true'),'only a listed, receipted match, once');
 for(const marker of ['speciesPickerOverlay','openSpeciesPicker(','Not the right bird?','Pick the bird you actually saw or heard'])assert(!html.includes(marker),marker);
 assert(html.includes('id="birdCropMatches"')&&html.includes('This is my bird'));
});

test('photo place follows the location switch and old library photos carry none',()=>{
 const html=read('index.html');
 const helper=html.slice(html.indexOf('async function getCurrentPositionForPhotoId()'),html.indexOf('let photoIdBusy = false;'));
 assert(helper.includes('!soundLocationAssistEnabled()'));
 const start=html.slice(html.indexOf('function startPhotoPlace('),html.indexOf('function photoPlaceForUpload('));
 assert(start.includes('PHOTO_PLACE_RECENT_MS')&&start.includes('lastModified')&&start.includes('toFixed(2)'));
 assert(html.includes('The server keeps neither.'));
});
