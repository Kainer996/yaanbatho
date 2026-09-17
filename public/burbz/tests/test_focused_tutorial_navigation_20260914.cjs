'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
function source(name) {
  const start = html.indexOf('function ' + name + '(');
  assert(start >= 0, name);
  return html.slice(start, html.indexOf('\n}', start) + 2);
}
let matches = [], visibleTarget = null, clicked = 0, focused = 0, scrolled = 0, paused = 0, resumed = 0, toast = '', route = '';
const button = {disabled:false, tabIndex:0, id:'real-action', closest:()=>null, getClientRects:()=>[1], getAttribute:()=>null,
  matches:q=>q.includes('button'), querySelectorAll:()=>[], click:()=>clicked++, focus:()=>focused++,
  scrollIntoView:()=>scrolled++, getBoundingClientRect:()=>({left:10,top:10,right:110,bottom:60,width:100,height:50})};
const panel = {...button, matches:()=>false, querySelectorAll:()=>[button]};
const context = vm.createContext({document:{querySelectorAll:()=>matches}, getComputedStyle:el=>({position:'static',visibility:el.invisible?'hidden':'visible',display:'block'}),
  window:{innerWidth:390,innerHeight:844}, console, merlinNavigationPaused:false, merlinTutActive:false,
  featureGateOpen:()=>true, featureUnlockHint:()=>'', prerequisiteGuideGoal:()=>false, currentScreen:'scan',
  activateGameHudDestination:name=>{route=name;context.currentScreen=name;},
  showToast:message=>toast=message, updateMerlinFlowPointer:()=>{}, positionMerlinCurrentAction:()=>{},
  merlinTutSpotlightTarget:()=>{}, positionMerlinTutorialStage:()=>{},
  resumeMerlinNavigation:()=>resumed++,
  merlinNavigationObjective:()=>({screen:'scan',target:'#actual',label:'Do actual action'})});
vm.runInContext(source('merlinNavigationTarget')+'\n'+source('merlinNavigationControl')+'\n'+source('activateMerlinCurrentAction'), context);
matches=[button];
vm.runInContext('activateMerlinCurrentAction()',context);
assert.equal(clicked,1,'Exact native button is invoked once');assert.equal(focused,1);assert.equal(scrolled,1);
matches=[panel];vm.runInContext('activateMerlinCurrentAction()',context);
assert.equal(clicked,1,'A multi-action container must not execute its first child');assert.equal(focused,2);
matches=[{...button, closest:q=>q === '.screen' ? null : {}} ,button];
assert.equal(vm.runInContext('merlinNavigationTarget("#actual")',context),button,'Hidden/inert match cannot conceal another visible match');
matches=[{...button,invisible:true}];assert.equal(vm.runInContext('merlinNavigationTarget("#actual")',context),null);
matches=[];vm.runInContext('activateMerlinCurrentAction()',context);assert.match(toast,/not visible/);assert.equal(clicked,1,'Missing target never fakes an action');
matches=[{...button,disabled:true}];vm.runInContext('activateMerlinCurrentAction()',context);assert.equal(clicked,1,'Disabled native target cannot execute');
context.merlinNavigationPaused=true;vm.runInContext('activateMerlinCurrentAction()',context);assert.equal(resumed,1);assert.equal(clicked,1);
context.merlinNavigationPaused=false;context.merlinNavigationObjective=()=>({screen:'academy',target:'#actual'});context.featureGateOpen=()=>false;
vm.runInContext('activateMerlinCurrentAction()',context);assert.equal(route,'','Presentation cannot bypass a locked route');
context.featureGateOpen=()=>true;matches=[panel];vm.runInContext('activateMerlinCurrentAction()',context);assert.equal(route,'academy');assert.equal(clicked,1);
assert(!source('activateMerlinCurrentAction').includes('burbzTutorialAction'),'Only existing handlers report completion');
assert(html.includes('body.guided-opening #bottomDock .nav-item.is-locked { display:none !important; }'));
assert(html.includes("endMerlinTutorial(false, {pause:true})"));
assert(html.includes("...targetControls, ...freeControls"),'Tab includes actual target and free-action controls');
console.log('PASS: native action identity, container reveal, hidden/missing/disabled targets, pause, route gates, no fabricated completion');
