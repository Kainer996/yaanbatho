'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'scan_home.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function fn(name){const start=html.indexOf('function '+name+'(');assert(start>=0);const end=html.indexOf('\nfunction ',start+1);return html.slice(start,end<0?undefined:end);}
let failures=0;
function test(name,run){try{run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}}
function ui(){
 const list={innerHTML:'',querySelector:()=>null};
 const dialog={open:false,contains:()=>true,querySelector:s=>s==='#academyBuildPickerList'?list:null,showModal(){this.open=true;},close(){this.open=false;}};
 const opened=[];
 const context={console,document:{getElementById:()=>null,activeElement:null},requestAnimationFrame:()=>0,setTimeout:()=>0,CSS:{escape:x=>x}};
 context.globalThis=context;context.BurbzScanHomeCore={};
 const hook="root.__test={onClick,renderBuildPicker,set:(o)=>{options=o;boundSection={contains:()=>true};buildDialog=o.dialog;targets=new Map(o.targets);},};";
 vm.runInNewContext(source.replace('root.BurbzScanHome={',hook+'root.BurbzScanHome={'),context);
 context.__test.set({dialog,targets:[['build-rooms',{kind:'build-rooms'}]],icon:()=>'',open:t=>opened.push(t)});
 return {context,dialog,list,opened,click:id=>context.__test.onClick({target:{closest:s=>s==='[data-home-action]'?{dataset:{homeAction:id}}:null}})};
}
test('Build rooms uses canonical dispatch (tutorial event and gate)',()=>{const t=ui();t.click('build-rooms');assert.equal(t.opened.length,1);assert.equal(t.opened[0].kind,'build-rooms');});
test('Unaffordable Kitchen retains explicit attempt; locked room stays disabled',()=>{const t=ui();t.context.__test.renderBuildPicker({academyBuildRows:[{id:'kitchen',status:'unaffordable'},{id:'library',status:'locked'}]});assert.match(t.list.innerHTML,/data-home-action="academy-build-kitchen">Build/);assert.match(t.list.innerHTML,/data-home-action="academy-build-library" disabled/);});
test('Picker Open closes modal before dispatching owned-room navigation',()=>{const t=ui();t.context.__test.renderBuildPicker({academyBuildRows:[{id:'tavern',status:'built'}]});t.dialog.open=true;t.click('academy-build-open-tavern');assert.equal(t.dialog.open,false);assert.equal(t.opened[0].kind,'academy-room');});
test('Other navigation disposes body-mounted picker',()=>{let closed=0;const c={window:{BurbzScanHome:{closeSession(){},closeBuildPicker(){closed++;}},BurbzAcademyHomeIntro:{dispose(){}}},closeDeskPlayerEquipment(){},closeResourceQuestPrompt(){},currentScreen:'academy-room'};vm.runInNewContext(fn('switchScreen')+'\nswitchScreen("academy-room");',c);assert.equal(closed,1);});
test('Home training omits unowned-room promotions, owned drill stays',()=>{
 const templates=[{id:'basic',room:'training',label:'Basic drill',stat:'atk',icon:'X'},{id:'magic',room:'library',roomLabel:'Library',label:'Magic drill',stat:'mag',icon:'Y'}];
 const c={window:{BurbzAcademyCore:{advanceTrainingSession:s=>s,getTrainingTemplates:()=>templates,TRAINING_DURATION_MINUTES:[15]}},academyHomeTrainingSessions:()=>[],academyHomeFreeBirdsFirst:x=>x,gameState:{flock:[]},trainingDurationChoice:15,fmtTrainingTime:()=> '15m',isAcademyBuildingBuilt:()=>false,escapeHtml:String,isNightRightNow:()=>false,infoDotHTML:()=>'',infoNoteHTML:()=>''};
 vm.runInNewContext(fn('renderTrainingHallPanel')+'\nresult=renderTrainingHallPanel([],[],{homeReadOnly:true});',c);assert.match(c.result,/Basic drill/);assert.doesNotMatch(c.result,/Magic drill|Build the Library/);
});
test('Home refresh restores stable native IDs and trade keys without stealing focus',()=>{
 const section={contains:el=>!!el?.inHome,querySelectorAll:()=>replacements};
 let focused=null;
 const tab={id:'market-tab-sell',inHome:true,focus(){focused='tab';}};
 const trade={dataset:{tradeKey:'buy:material:twig:1'},inHome:true,focus(){focused='trade';}};
 const replacements=[trade];
 const c={document:{getElementById:id=>id===tab.id?tab:null},console};c.globalThis=c;c.BurbzScanHomeCore={};
 vm.runInNewContext(source.replace('root.BurbzScanHome={','root.__focusTest={restoreHomeFocus,setSection:s=>{boundSection=s;}};root.BurbzScanHome={'),c);
 c.__focusTest.setSection(section);
 c.__focusTest.restoreHomeFocus({id:tab.id,isConnected:false,dataset:{}});assert.equal(focused,'tab');
 c.__focusTest.restoreHomeFocus({isConnected:false,dataset:{tradeKey:trade.dataset.tradeKey}});assert.equal(focused,'trade');
 focused=null;c.__focusTest.restoreHomeFocus({id:tab.id,isConnected:true,dataset:{}});assert.equal(focused,null);
 tab.inHome=false;c.__focusTest.restoreHomeFocus({id:tab.id,isConnected:false,dataset:{}});assert.equal(focused,null);
});
test('Navigation fixture permits only the exact hydrated-media abort, not missing media',()=>{
 const runner=fs.readFileSync(path.join(root,'tests/run_academy_home_intro_20260922.cjs'),'utf8');
 const section=runner.slice(runner.indexOf('function classifyResourceFailure('),runner.indexOf('function classifyConsoleFailure('));
 const c={URL,introVideoRel:'assets/cutscenes/burbz-intro-two-part-hf-20260729.mp4',resourceNameFromUrl:s=>new URL(s).pathname.replace('/burbz/','')};vm.createContext(c);vm.runInContext(section,c);
 const row={url:'http://localhost:9194/burbz/'+c.introVideoRel,name:c.introVideoRel,scenario:'navigation-disposal',failure:'net::ERR_ABORTED'};
 assert.equal(c.classifyRequestFailure(row).allowed,true);
 assert.equal(c.classifyRequestFailure({...row,failure:'net::ERR_FAILED'}).allowed,false);
 assert.equal(c.classifyResourceFailure({...row,failure:undefined,status:404}).allowed,false);
 assert.equal(c.classifyRequestFailure({...row,name:'scan_home.js'}).allowed,false);
});
process.exitCode=failures?1:0;
