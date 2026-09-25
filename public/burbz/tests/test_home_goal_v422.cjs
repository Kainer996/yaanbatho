'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=name=>{const at=html.indexOf('function '+name+'(');assert(at>=0);return html.slice(at,html.indexOf('\n}',at)+2);};
let opening={id:'birdhouse',label:'Build the Birdhouse',complete:false},quest={id:'q',name:'Find your first bird',target:1},objective=null,events=[];
const c=vm.createContext({merlinNavigationPaused:false,merlinTutActive:false,merlinTutAwaitingAction:false,gameState:{quests:{q:{progress:0}}},openingObjective:()=>opening,activePlayerQuest:()=>quest,merlinNavigationObjective:()=>objective,merlinTutCurrentStep:()=>({id:'intro'}),resumeMerlinNavigation:()=>events.push('resume'),activateMerlinCurrentAction:()=>events.push('native'),focusQuestFromNotice:t=>events.push(t.questId),currentScreen:'scan',endMerlinLessonRest:()=>events.push('rest-ended'),merlinOpeningChapterFor:()=>null,startMerlinTutorial:o=>{events.push('lesson-'+o.chapterId);c.merlinTutActive=true;},$:id=>({disabled:false,click:()=>events.push(id),focus:()=>events.push('focus-'+id)}),showToast:()=>{}});
vm.runInContext(source('scanHomeCurrentGoal')+'\n'+source('activateHomeCurrentGoal'),c);
const goal=()=>vm.runInContext('scanHomeCurrentGoal()',c),go=()=>vm.runInContext('activateHomeCurrentGoal()',c);
assert.equal(goal().name,'Build the Birdhouse');go();assert.deepEqual(events,['rest-ended','native'],'v469: the goal ends Merlin\'s rest, then acts');
// v469: a lesson waiting on this screen starts at once from the goal.
c.merlinOpeningChapterFor=()=>'companion';go();assert.deepEqual(events.slice(-2),['rest-ended','lesson-companion']);c.merlinTutActive=false;c.merlinOpeningChapterFor=()=>null;
opening={id:'kitchen',label:'Build the Kitchen',complete:false};assert.equal(goal().name,'Build the Kitchen');
opening={id:'done',label:'Discover your next bird',complete:true};assert.equal(goal().name,quest.name);go();assert.equal(events.at(-1),'q');
c.gameState.quests.q.progress=1;assert.equal(goal().name,'Collect reward: Find your first bird');const before=JSON.stringify(c.gameState);go();assert.equal(JSON.stringify(c.gameState),before,'Presentation never claims a reward');
quest=null;assert.equal(goal().name,'Discover your next bird');go();assert.equal(events.at(-1),'focus-captureBtn');
c.merlinNavigationPaused=true;assert.equal(goal().name,'Resume lesson');go();assert.equal(events.at(-1),'resume');
c.merlinNavigationPaused=false;c.merlinTutActive=true;assert.match(goal().name,/Continue Merlin/);go();assert.equal(events.at(-1),'merlinTutorialNext');
c.merlinTutAwaitingAction=true;objective={label:'Enter Alderwing'};assert.equal(goal().name,'Enter Alderwing');go();assert.equal(events.at(-1),'native');
assert(!source('activateHomeCurrentGoal').includes('burbzTutorialAction'));console.log('PASS 8 Current Goal groups: real opening precedence, subsequent stage, quest/reward, repeatable discovery, pause/resume, reading and native action; no progression grant');
