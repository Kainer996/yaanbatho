'use strict';
// Focused real-DOM proof of the extracted production switch adapter and map HUD.
// No provider requests, GPS simulation, or reward shortcuts in the application.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/root/src/gstack/node_modules/playwright');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),dir=process.env.EVIDENCE_DIR||'/root/burbz-detours-v382-evidence';
const source=name=>{const begin=html.indexOf('function '+name+'(');for(let end=html.indexOf('}',begin);end>=0;end=html.indexOf('}',end+1)){const value=html.slice(begin,end+1);try{new vm.Script('('+value+')');return value;}catch{}}throw Error(name);};
const names=['snapshotGameState','restoreStateTree','restoreGameStateSnapshot','ensureWalkingQuestState','ensureSideQuestState','activeWalkingQuest','sideQuestActive','savedOriginalQuest','questDetourActionsHTML','updateDetourResumeButton','updateWalkQuestHud','commitDetourTransition','resumeOriginalQuest','resumeSavedDetour'];
(async()=>{fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',args:['--no-sandbox']});const results=[];try{
for(const [width,height]of [[320,640],[390,844],[844,390]]){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n'),hud=html.split('\n').find(line=>line.includes('id="mapQuestHud"'));
 await page.route('http://detour.local/',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style><body>'+hud+'</body>'}));await page.goto('http://detour.local/');
 await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../side_trail_core.js'),'utf8')});
 await page.addScriptTag({content:`
 var currentScreen='map',failSave=false,gameState={xp:77,coins:12,walkingQuests:{active:null,suspended:{id:'original',name:'The Original',route:[[51.5,-1.2],[51.51,-1.2]],checkpoints:[{reached:true},{reached:false}],distanceWalkedM:500,birdsCaptured:[],chestsOpened:1},history:[]},sideQuest:{active:{id:'side',auto:true,parentQuestId:'original',name:'Inkwing’s Missing Margins',distanceM:123,discoveries:[{id:'remote',claimed:false,lat:0,lon:0,loot:{coins:99}}],path:[[51.5,-1.2,1]]},history:[]}};
 function $(id){return document.getElementById(id)}
 function durableSaveState(){if(failSave)throw Error('disk full');localStorage.setItem('state',JSON.stringify(gameState));return {ok:true}}
 function showToast(message){window.lastToast=message}function escapeHtml(s){return String(s)}
 function questPocketSuspend(q){q.pocketOwner='paused'}function questPocketResume(q){q.pocketOwner='active'}
 ${['clearWalkingQuestFromMap','clearSideQuestFromMap','startSideQuestPocketMode','stopSideQuestPocketMode','drawSideQuestOnMap','drawWalkingQuestOnMap','closeWalkQuestSheet','renderQuests','updateMapSideQuestButton','acquireQuestWakeLock','releaseQuestWakeLock'].map(n=>'function '+n+'(){}').join('\n')}
 ${names.map(source).join('\n')}
 updateWalkQuestHud();
 `});
 const button=page.locator('#mapDetourResume');await button.waitFor({state:'visible'});const box=await button.boundingBox();assert(box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=height);assert(box.height>=44);
 await page.screenshot({path:path.join(dir,`resume-${width}x${height}.png`)});
 await page.evaluate(()=>failSave=true);await button.tap();assert.equal(await page.evaluate(()=>gameState.walkingQuests.active),null);assert.match(await page.evaluate(()=>lastToast),/Could not save/);
 await page.evaluate(()=>failSave=false);await button.tap();let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('state')));assert.equal(state.walkingQuests.active.id,'original');assert.equal(state.sideQuest.suspendedDetour.discoveries[0].claimed,false);assert.equal(state.xp,77);
 await page.evaluate(()=>{gameState=JSON.parse(localStorage.getItem('state'));updateWalkQuestHud()});assert.match(await button.innerText(),/Saved Detour/);await button.tap();state=await page.evaluate(()=>JSON.parse(localStorage.getItem('state')));assert.equal(state.sideQuest.active.id,'side');assert.equal(state.walkingQuests.suspended.id,'original');assert.equal(state.sideQuest.active.discoveries[0].loot.coins,99);
 assert.deepEqual(errors,[]);results.push({width,height,resumeVisible:true,touchSaveFailureRollback:true,resumeNoGPSOrClaim:true,reloadAndContinue:true,errors});await context.close();
}
fs.writeFileSync(path.join(dir,'controls-results.json'),JSON.stringify({scope:'extracted production switch adapter and actual map HUD CSS/DOM',results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
