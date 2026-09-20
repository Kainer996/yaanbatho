'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function source(name) {
  const start = html.indexOf('function '+name+'(');
  assert(start >= 0, name);
  return html.slice(start,html.indexOf('\n}',start)+2);
}
test('redundant dock reminder and reserved banner space are retired',()=>{
  assert(!html.includes('id="tutorialNavPointer"'));
  assert(!html.includes('--tutorial-action-row'));
  assert(!source('placeMerlinNavigationControls').includes('panel.append(task)'));
});
test('flow updates keep guided routes without depending on a banner',()=>{
  for(const screen of ['scan','quests','birdex','village','academy']) {
    for(const active of [false,true]) for(const paused of [false,true]) {
      const toggles = []; let placed, homeRenders=0;
      const ctx = vm.createContext({merlinTutActive:active,merlinNavigationPaused:paused,currentScreen:screen,
        merlinNavigationObjective:()=>({complete:false}),
        document:{body:{classList:{toggle:(...args)=>toggles.push(args)}},querySelectorAll:()=>[]},
        $:()=>null,placeMerlinNavigationControls:(...args)=>placed=args,renderScanHome:()=>homeRenders++});
      vm.runInContext(source('updateMerlinFlowPointer')+'\nupdateMerlinFlowPointer();',ctx);
      assert.deepEqual(toggles,[['guided-opening',true]]);
      assert.equal(placed[0],active);
      assert.equal(homeRenders,screen==='scan'?1:0);
    }
  }
});
test('action steps focus their real control, not the removed proxy',()=>{
  assert(!source('merlinTutShowStep').includes("$('tutorialCurrentAction')"));
});
test('contextual help, pause and keyboard rescue remain accessible',()=>{
  assert.match(html,/id="merlinTutorialTask" role="status" aria-live="polite"/);
  assert.match(html,/id="merlinTutorialReadingPause" type="button">Pause/);
  assert.match(html,/\$\('merlinTutorialReadingPause'\)\?\.addEventListener\('click', pauseMerlinNavigation\)/);
  assert(source('pauseMerlinNavigation').includes("$('settingsBtn')"));
  assert(html.includes("else if (event.key === 'Escape')"));
  assert(html.includes("$('merlinTutorialReadingPause'), $('tutorialNavigationPause')"));
});
test('late guidance palette uses shaded brown and antique gold, not flat green',()=>{
  const css=html.slice(html.indexOf('/* Compact, darker Merlin guidance;'),html.indexOf('</style>',html.indexOf('/* Compact, darker Merlin guidance;')));
  for(const green of ['#18261f','#61715b','#25372b','#344932','#53644f','#293d2e','#1d2d23']) assert(!css.includes(green),green);
  assert(css.includes('linear-gradient('));
  assert(css.includes('#merlinTutorialTask'));
  assert(css.includes('min-height:44px'));
});
