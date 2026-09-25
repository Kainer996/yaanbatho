'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=f=>fs.readFileSync(__dirname+'/../'+f,'utf8');
const html=read('index.html'),home=read('scan_home.js'),sw=read('sw.js');
const rev='academy-manga-v475-20260925';
const fn=name=>{const m=html.match(new RegExp('function '+name+'\\([^]*?\\n}'));assert(m,name);return m[0];};
test('Academy navigation selects its independent screen and starts the tree, then Home returns to its desk',()=>{
 const calls=[],noop=()=>{},classes={add:noop,remove:noop};
 const c={window:{BurbzScanHome:{closeSession:noop,closeBuildPicker:noop}},document:{querySelector:()=>null,querySelectorAll:()=>[],body:{setAttribute:noop}},$:id=>({classList:classes}),$$:()=>[],currentScreen:'scan',closeDeskPlayerEquipment:noop,closeResourceQuestPrompt:noop,SFX:{page:noop},recordScreenTrail:noop,destinationRoomGeneration:0,destinationQuestController:null,geographicPlaces:null,geographicWorldVisit:null,syncBurbzMusicForMapZoom:noop,updateMerlinListeningUI:noop,wireAcademyZones:()=>calls.push('wire'),renderAcademy:()=>calls.push('tree'),applyAcademyView:()=>calls.push('view'),academyViewPause:()=>calls.push('pause'),renderScanHome:()=>calls.push('desk'),queueActionBadgeUpdate:noop};
 vm.createContext(c);vm.runInContext(fn('switchScreen')+'\nswitchScreen("academy");',c);
 assert.equal(c.currentScreen,'academy');assert.deepEqual(calls,['wire','tree','view']);
 vm.runInContext('switchScreen("scan");',c);assert.equal(c.currentScreen,'scan');assert.deepEqual(calls,['wire','tree','view','desk','pause']);
});
test('Home keeps Empire first and all original care panels even for locked saves',()=>{
 assert.match(home,/ids=\['building','discover','today','stores','kitchen','training','hospital','academy'\]/);
 assert.match(home,/featured='building'/);
 assert.match(home,/if\(fullEmpire\)\{panelElement\('building'\)\.style\.gridArea/);
 for(const id of ['kitchen','training','hospital'])assert.ok(html.includes('desk-'+id+'-list'));
 assert.doesNotMatch(home,/academyHomeRooms|academyHomeTree/);
});
test('Home stacks the four rooms left, puts a condensed Academy right, and the dock leads with Home, then only what Home lacks',()=>{
 assert.ok(html.includes('id="desk-academy-list"'));
 assert.match(home,/panelElement\('academy'\)\.style\.gridArea=`\$\{row\} \/ \$\{careColumns\+1\} \/ \$\{row\+careRows\} \/ \$\{columns\+1\}`/);
 const dock=html.slice(html.indexOf('id="bottomDock"'),html.indexOf('<!-- Capture Celebration Overlay -->'));
 assert.deepEqual([...dock.matchAll(/data-screen="([^"]+)"/g)].map(m=>m[1]),['scan','map','battle','birdex','inventory','leaderboards']);
 assert.doesNotMatch(dock,/data-quick-destination/);
 assert.match(html,/id="headerHomeBtn" data-game-route data-screen="scan"/);
 assert.match(html,/target:'#screen-scan \.desk-panel-academy \.desk-panel-heading'/);
 // v469 retired the "tap the logo" lesson: the player walks Home in their own time.
});
test('Academy tree and construction remain independent without merged intro takeover',()=>{
 assert.ok(html.includes('id="screen-academy"'));
 assert.ok(html.includes('id="academyStage3D"'));
 assert.match(fn('focusAcademyBuildCard'),/switchScreen\('academy'\)/);
 assert.doesNotMatch(html,/BurbzAcademyHomeIntro|academy_home_intro\.js|bindAcademyHomeIntro/);
 assert.doesNotMatch(sw,/academy_home_intro\.js/);
});
test('Restored Home uses a new coherent shell and exact cache pins',()=>{
 // Later releases append to the cache name, so check membership, not the tail.
 assert(sw.match(/const BURBZ_CACHE = '([^']+)'/)[1].includes(rev));
 assert.match(sw,new RegExp(html.match(/const BURBZ_BUILD = '([^']+)'/)[1]+"';"));
 for(const file of ['scan_home.css','scan_home.js','scan_home_core.js']){
  // v483 re-pinned scan_home.js for the Academy's day and night; v484
  // re-pinned scan_home.css when Merlin moved to the right in landscape;
  // v488 re-pinned it for the gold Quests strip.
  const pin=file+'?v='+(file==='scan_home.css'?'quests-strip-v488-20260925':file==='scan_home.js'?'academy-day-night-v483-20260925':rev);assert.ok(html.includes(pin),pin);
  assert.equal(sw.split('./'+pin).length-1,3,pin+' in every worker list');
 }
 for(const pin of ['quest-revisit-v457-20260923','hall-music-v458-20260923','expedition-duration-v455-20260923'])assert.ok(html.includes(pin),pin+' retained');
});
