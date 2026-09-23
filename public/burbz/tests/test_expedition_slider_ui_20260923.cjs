'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {chromium}=require('playwright');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const core=require('../academy_treehouse_core.js');const size=require('../bird_size_core.js');
function fn(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0,'function '+name+' exists');return html.slice(start,html.indexOf('\n}',start)+2);}
const bird={id:'b',level:20,commonName:'Test bird',power:160,stamina:120,int:80,spd:90,cha:140,sizeScore:50};
function context(){const c={window:{BurbzAcademyCore:core},document:{getElementById:()=>null},questSendState:{templateId:'branch_run',durationMinutes:5,birdId:'b'},gameState:{flock:[bird],birdExpeditions:[]},MERLIN_GUIDE:{id:'merlin-guide'},SFX:{tap(){}},getExpeditionTemplate:id=>core.getQuestTemplates().find(t=>t.id===id),expeditionBirdById:()=>bird,academyBirdById:()=>bird,birdRolesCore:()=>null,rolePostState:()=>({multiplier:1.5}),nocturnalNightBonusFor:()=>({coins:3,branches:2,xp:3,itemRolls:2}),merlinExpeditionSlowFactor:()=>2,academyRoleMultiplier:()=>1.5,birdSizeCore:()=>size,birdGearBonuses:()=>({carryBonus:2}),closeQuestOverlay:()=>c.closed++,renderQuests:()=>c.rendered++,closed:0,rendered:0};vm.createContext(c);for(const n of ['applyQuartermasterPlanning','applyExpeditionCarryLimit','questDurationLabel','selectQuestDuration','confirmQuestSend'])vm.runInContext(fn(n),c);return c;}
test('failed dispatch leaves SEND open and successful banked dispatch closes once',()=>{const c=context();c.startBirdExpedition=()=>false;c.confirmQuestSend();assert.equal(c.closed,0);assert.equal(c.rendered,0);c.startBirdExpedition=()=>{c.gameState.birdExpeditions.push({id:'new',birdId:'b',templateId:'branch_run',status:'active'});};c.confirmQuestSend();assert.equal(c.closed,1);assert.equal(c.rendered,1);});
test('every stop updates selection without rebuilding sheet; invalid values ignored',()=>{const c=context();let paints=0,updates=0;c.renderQuestSendSheet=()=>paints++;c.updateQuestSendPreview=()=>updates++;for(const m of core.QUEST_DURATION_MINUTES){c.selectQuestDuration(m);assert.equal(c.questSendState.durationMinutes,m);}assert.equal(paints,0);assert.equal(updates,22);for(const m of [true,false,[],[2],{},null,'',1.5,16,Infinity,'x'])c.selectQuestDuration(m);assert.equal(c.questSendState.durationMinutes,1440);});
test('preview reuses selected bird night/planning/carry and labels random shared finds',()=>{const c=context();vm.runInContext(fn('questSendDurationLabel'),c);vm.runInContext(fn('questSendPreviewText'),c);for(const m of core.QUEST_DURATION_MINUTES){c.questSendState.durationMinutes=m;const text=c.questSendPreviewText();assert.match(text,/random/i);assert.match(text,/shared|share/i);assert.match(text,/capacity|carry/i);}assert.equal(c.questSendDurationLabel(1440),'1 day');assert.equal(c.questSendDurationLabel(120),'2 hours');assert.equal(c.questSendDurationLabel(1),'1 minute');});
test('displayed ranges use actual modifiers and bound rolled/capped payouts without saving',()=>{
 const c=context();vm.runInContext(fn('questSendDurationLabel'),c);vm.runInContext(fn('questSendPreviewText'),c);const before=JSON.stringify(c.gameState);
 for(const t of core.getQuestTemplates().filter(t=>!t.tutorial))for(const m of core.QUEST_DURATION_MINUTES){
  c.questSendState={templateId:t.id,durationMinutes:m,birdId:'b'};
  const text=c.questSendPreviewText(),p=core.getBirdExpeditionPreview(bird,t.id,{durationMinutes:m,nightBonus:c.nocturnalNightBonusFor()});
  assert.ok(text.includes(`${Math.round(p.coins[0]*1.5)}–${Math.round(p.coins[1]*1.5)} coins`));assert.ok(text.includes(`+${p.xp} XP`));
  for(const now of [1000,1001,1002]){
   const q=c.applyExpeditionCarryLimit(c.applyQuartermasterPlanning(core.createBirdExpedition(bird,t.id,now,{durationMinutes:m,nightBonus:c.nocturnalNightBonusFor()})),bird);
   const timber=text.match(/up to (\d+) timber/);assert.ok(q.rewards.branches<=(timber?Number(timber[1]):0));assert.ok(q.carry.unitsUsed<=q.carry.capacity);
  }
 }
 assert.equal(JSON.stringify(c.gameState),before);
});
test('native range drag and keyboard retain input node, focus and accessible duration',async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await page.route('**/*',route=>route.abort());await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><style>'+[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n')+'</style><div id="questOverlay" class="quest-overlay"></div>');
 const names=['applyQuartermasterPlanning','applyExpeditionCarryLimit','questDurationLabel','questSendDurationLabel','questSendPreviewText','updateQuestSendPreview','renderQuestSendSheet','selectQuestDuration','selectQuestBird'];
 await page.addScriptTag({content:fs.readFileSync(require.resolve('../academy_treehouse_core.js'),'utf8')});
 await page.addScriptTag({content:fs.readFileSync(require.resolve('../bird_size_core.js'),'utf8')});
 await page.addScriptTag({content:`var questSendState={templateId:'branch_run',durationMinutes:5,birdId:'b'};var gameState={flock:[${JSON.stringify(bird)}]};var MERLIN_GUIDE={id:'merlin-guide'};var QUEST_TEMPLATE_INFO={};var SFX={tap(){}};
 function getExpeditionTemplate(id){return BurbzAcademyCore.getQuestTemplates().find(t=>t.id===id)};function expeditionBirdById(){return gameState.flock[0]};function questOverlayEl(){return document.getElementById('questOverlay')};function expeditionDispatchBirds(b){return b};function isStarterExpeditionTemplate(){return true};function freeBirdsFirst(b){return b};function sleepReadinessForBird(){return {sleeping:false}};function birdAssignedPost(){return null};function birdHasActiveExpedition(){return false};function birdHasActiveTraining(){return false};function birdWorkReadiness(){return {ok:true,status:{level:'fed'}}};function birdSizeSummary(b){return {icon:'X',capacity:BurbzBirdSizeCore.carryCapacity(b,2)}};function nocturnalNightBonusFor(){return null};function birdDisplayName(b){return b.commonName};function birdOnlyImgHTML(){return ''};function escapeHtml(s){return String(s)};function isNightRightNow(){return false};function merlinExpeditionSlowFactor(){return 1};function closeQuestOverlay(){};
 function academyRoleMultiplier(){return 1.5};function academyBirdById(){return gameState.flock[0]};function birdRolesCore(){return null};function rolePostState(){return {multiplier:1.5}};function birdSizeCore(){return BurbzBirdSizeCore};function birdGearBonuses(){return {carryBonus:2}};
 ${names.map(fn).join('\n')}
 renderQuestSendSheet();`});
 const input=page.locator('input[type=range]');assert.equal(await input.count(),1);assert.equal(await input.getAttribute('min'),'0');assert.equal(await input.getAttribute('max'),'21');assert.equal(await input.getAttribute('step'),'1');await input.evaluate(e=>window.originalRange=e);await input.focus();
 await page.keyboard.press('Home');assert.equal(await input.getAttribute('aria-valuetext'),'1 minute');
 for(let i=1;i<22;i++){await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>questSendState.durationMinutes),core.QUEST_DURATION_MINUTES[i]);}
 assert.equal(await input.getAttribute('aria-valuetext'),'1 day');
 const box=await input.boundingBox();await page.mouse.move(box.x+box.width-8,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width*.35,box.y+box.height/2,{steps:12});await page.mouse.up();
 assert.ok(await page.evaluate(()=>document.activeElement===originalRange&&document.querySelector('input[type=range]')===originalRange));assert.ok(await page.evaluate(()=>questSendState.durationMinutes<1440));
 const client=await page.context().newCDPSession(page);const touch=(type,x)=>client.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y:box.y+box.height/2}]});
 await touch('touchStart',box.x+12);for(let i=1;i<=12;i++)await touch('touchMove',box.x+12+(box.width-24)*i/12);await touch('touchEnd');
 assert.equal(await page.evaluate(()=>document.querySelector('input[type=range]')===originalRange),true);assert.equal(await page.evaluate(()=>questSendState.durationMinutes),1440);
 assert.ok(await input.evaluate(e=>e.getBoundingClientRect().height>=44));
 if(process.env.SLIDER_SCREENSHOT)await page.screenshot({path:process.env.SLIDER_SCREENSHOT});
 console.log('native slider: all 22 keyboard stops, mouse/touch drags, node/focus retained');
 }finally{await browser.close();}
});
