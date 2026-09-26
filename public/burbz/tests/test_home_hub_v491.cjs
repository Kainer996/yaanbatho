'use strict';
// Home is the hub (v491). Every box opens its own screen: Academy, Crafting,
// Kitchen, Training, Hospital, and the Villages, Towns and Regions pages.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const BUILD='home-hub-v491-20260925';
const html=read('index.html'),home=read('scan_home.js'),css=read('scan_home.css'),sw=read('sw.js');
const route=html.slice(html.indexOf('function openScanHomeTarget('),html.indexOf('let deskEquipmentSession'));

test('Villages, Towns and Regions titles are buttons that open their own Empire page',()=>{
 assert.match(home,/const EMPIRE_PAGE=\{villages:'villages',towns:'towns',regions:'realm'\};/);
 assert.match(home,/targets\.set\('column-'\+column\.id,\{kind:'empire-page',page:EMPIRE_PAGE\[column\.id\]\}\)/);
 assert.match(home,/<button type="button" class="desk-empire-open" data-home-action="column-\$\{column\.id\}"/);
 // The Empire gate still guards the pages, and the page opens before the screen.
 assert.match(route,/'empire-page':'village'/);
 assert.match(route,/target\.kind==='empire-page'\)\{const page=EMPIRE_PAGES\.includes\(target\.page\)\?target\.page:'villages';empireLedgerOnlyMode=false;showEmpirePage\(page,\{silent:true\}\);switchScreen\('village'\);/);
 assert.match(route,/\$\('empireRealmPanel'\)\?\.scrollIntoView/);
});

test('Training opens the Training Hall screen, and a drill opens the room it runs in',()=>{
 assert.doesNotMatch(route,/openTrainingHub\(\)/);
 assert.match(route,/target\.kind==='training'\)\{const room=TRAINING_HUB_ROOMS\.includes\(target\.room\)\?target\.room:'training';openAcademyRoomHudShortcut\(room,TRAINING_HUB_ROOM_TITLES\[room\]\);\}/);
 assert.match(html,/progress:Math\.round\(s\.progressPct\?\?0\),room:s\.room\|\|'training',remaining:/);
 const C=require(path.join(root,'scan_home_core.js'));
 const m=C.derive({gates:{training:true},rooms:{training:{built:true}},training:[{id:'a',name:'Ada',room:'library'},{id:'b',name:'Bo'}]});
 assert.deepEqual(m.training.map(t=>t.target),[{kind:'training',room:'library'},{kind:'training'}]);
 // The quick Training sheet stays for its other callers.
 assert.match(html,/function openTrainingHub\(\)/);
});

test('Academy, Crafting, Kitchen and Hospital keep their screens',()=>{
 assert.match(home,/headings=\{academy:\{kind:'academy'\},stores:\{kind:'forge'\},kitchen:\{kind:'kitchen'\},training:\{kind:'training'\},hospital:\{kind:'hospital'\}/);
 assert.match(route,/target\.kind==='kitchen'\)openKitchenHudShortcut\(\)/);
 assert.match(route,/target\.kind==='hospital'\)openHospitalHudShortcut\(\)/);
 assert.match(route,/target\.kind==='forge'\)openForge\('craft'\)/);
 assert.match(route,/target\.kind==='academy'\)activateGameHudDestination\('academy'\)/);
});

test('A tap anywhere in a box opens that box, but never from the notices sheet',()=>{
 assert.match(home,/function boxAction\(el\)\{/);
 assert.match(home,/el\.closest\('#homeBuildingNotices,\.scan-home-tools'\)\)return null/);
 assert.match(home,/const column=el\.closest\('\.desk-empire-column'\);if\(column\)return column\.querySelector\('\.desk-empire-open'\);/);
 assert.match(home,/closest\('\.desk-panel\[data-home-panel\]'\)\?\.querySelector\('\.desk-panel-heading'\)/);
 assert.match(home,/const button=event\.target\.closest\('\[data-home-action\]'\)\|\|boxAction\(event\.target\);/);
 assert.match(css,/\.desk-panel\[data-home-panel\] \{ cursor:pointer;/);
});

test('Boxes that want the player wear a gold edge; quiet ones stay quiet',()=>{
 assert.match(home,/const attention=\{stores:m\.forgeReady>0,kitchen:m\.kitchen\.some\(b=>!b\.away&&\['hungry','urgent'\]\.includes\(b\.level\)\),training:m\.training\.some\(s=>s\.ready\),hospital:m\.hospital\.some\(b=>!b\.admitted\)\};/);
 assert.match(css,/\.desk-panel\[data-home-attention="true"\] \{ border-color:#d6a84f;/);
});

test('Short landscape fits every box: rooms share one row beside a tall Academy',()=>{
 assert.match(home,/main\.dataset\.homeLayout=shortLandscape\?'short-landscape':'stack';/);
 assert.match(home,/panelElement\('academy'\)\.style\.gridArea=`1 \/ 4 \/ \$\{row\} \/ 5`;/);
 assert.match(home,/const landscapeRoom=Math\.max\(34,Math\.min\(52,/);
 // The Empire box is sized from its real heading and column titles, so the first tile is whole.
 assert.match(home,/chrome=Math\.ceil\(\(empirePanel\.querySelector\('\.desk-panel-heading'\)\?\.offsetHeight\|\|44\)\+\(empirePanel\.querySelector\('\.desk-empire-column h3'\)\?\.offsetHeight\|\|22\)\+11\)/);
 assert.match(css,/\[data-home-layout="short-landscape"\] \.home-tree-ready \{ right:auto;left:6px; \}/);
});

test('v491 ships together: build marker, cache and all three Home pins in every worker list',()=>{
 // Later releases ship on top under their own marker; v491 stays in the cache chain.
 const LATER=['asmr-sound-v492-20260925','quest-lines-v493-20260926','photo-merlin-v494-20260926','walk-planner-v495-20260926'];
 assert.ok([BUILD,...LATER].some(b=>html.includes("const BURBZ_BUILD = '"+b+"';")));
 const cache=sw.match(/const BURBZ_CACHE = '([^']+)'/)[1];assert.ok(cache.includes('-'+BUILD));
 for(const file of ['scan_home.css','scan_home.js','scan_home_core.js']){
  // v493 re-pinned all three Home files for the quest lines.
  const pin=[BUILD,...LATER].map(b=>file+'?v='+b).find(p=>html.includes(p));assert.ok(pin,file);
  assert.equal(sw.split("'./"+pin+"'").length-1,3,pin+' in every worker list');
 }
 const updater=fs.readFileSync(path.join(root,'../../scripts/update-live-burbz.sh'),'utf8');
 for(const file of ['scan_home.css','scan_home.js','scan_home_core.js'])assert.ok(updater.includes('"'+file+'"'),file);
});
