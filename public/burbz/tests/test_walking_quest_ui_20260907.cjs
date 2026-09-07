'use strict';

// Pure rendering contracts. Browser layout/focus and actual outdoor GPS are
// validated separately; this harness neither simulates nor claims those checks.
const assert = require('node:assert/strict');
const UI = require('../walking_quest_ui.js');
let passed = 0;
function check(name, run) {
  try { run(); passed++; }
  catch (error) { error.message = name + ': ' + error.message; throw error; }
}
const route = {
  routeSchemaVersion:1, routeMode:'out-and-back', lengthM:2160,
  startDistM:243, pathShare:0.92, publicPathShare:0.8,
  source:'OpenStreetMap', sourceTimestamp:'2026-09-07T10:00:00Z',
  name:'The woodland path', warnings:['Includes steps']
};
const encounter = {
  id:'warden', name:'The Warden', kind:'npc', artKey:'warden',
  role:'Keeper of the bird roads', lore:'A secret from Alderwing.',
  prompt:'How will you greet the Warden?', discovered:false,
  choices:[{id:'greet', label:'Greet the Warden', outcome:'A remembered greeting.'}],
  checkpointIndex:2, fictional:true
};

check('round trip distance is not doubled or cut', () => {
  const stats = UI.routeStats(route);
  assert.equal(stats.lengthM,2160);
  assert.equal(stats.distance,'2.2 km');
  assert.match(UI.offerCard(route,0),/2\.2 km/);
  assert.doesNotMatch(UI.offerCard(route,0),/4\.3 km/);
});
check('walking time follows the complete route', () => {
  assert.equal(UI.routeStats(route).durationMin,29);
  assert.equal(UI.routeStats({...route,lengthM:4500}).durationMin,60);
});
check('start distance is explicitly straight-line and separate', () => {
  assert.equal(UI.routeStats(route).startLabel,'243 m away · straight-line');
  assert.equal(UI.routeStats(route).startDistance,UI.routeStats(route).startLabel);
  const card = UI.offerCard(route,0);
  assert.match(card,/complete walk/);
  assert.match(card,/243 m away · straight-line/);
});
check('a close start does not invent a claim that the player is there', () => {
  assert.equal(UI.routeStats({...route,startDistM:12}).startLabel,'12 m away · straight-line');
  assert.equal(UI.routeStats({...route,startDistM:0}).startLabel,'0 m away · straight-line');
});
check('unknown start remains unknown', () => {
  for (const startDistM of [null,undefined,'',NaN,Infinity,-1]) {
    assert.equal(UI.routeStats({...route,startDistM}).startLabel,'Start distance unavailable');
  }
});
check('missing or invalid length does not produce walking time', () => {
  for (const lengthM of [null,undefined,'',0,-10,NaN,Infinity]) {
    const stats = UI.routeStats({...route,lengthM});
    assert.equal(stats.lengthM,null);
    assert.equal(stats.durationMin,null);
    assert.equal(stats.distance,'Distance unavailable');
  }
});
check('loop status requires the checked route contract', () => {
  assert.equal(UI.routeStats({...route,routeMode:'loop'}).modeLabel,'Genuine loop');
  assert.equal(UI.routeStats({...route,routeSchemaVersion:0,routeMode:'loop'}).mode,'unknown');
  assert.equal(UI.routeStats({...route,routeMode:'made-up'}).mode,'unknown');
});
check('return path and retraced connector are explained', () => {
  assert.match(UI.offerCard(route,0),/Retrace the same path/);
  assert.match(UI.routeFacts(route),/Retrace the same path/);
  assert.match(UI.routeFacts({...route,routeMode:'loop',viaSpur:true}),/connecting path is retraced/);
});
check('footpath ratio is not confused with a legal access percentage', () => {
  assert.equal(UI.routeStats(route).pathPercent,92);
  assert.match(UI.routeFacts(route),/mapped footpaths/);
  assert.doesNotMatch(UI.routeFacts(route),/guaranteed|legally certified/);
});
check('invalid footpath percentages remain unknown', () => {
  for (const pathShare of [null,undefined,'',-1,60,Infinity,NaN]) {
    assert.equal(UI.routeStats({...route,pathShare}).pathPercent,null);
  }
  assert.equal(UI.routeStats({...route,pathShare:0}).pathPercent,0);
  assert.equal(UI.routeStats({...route,pathShare:1}).pathPercent,100);
});
check('route source and valid timestamp are displayed without inventing dates', () => {
  assert.match(UI.routeFacts(route),/OpenStreetMap · 2026-09-07/);
  assert.equal(UI.routeStats({...route,sourceTimestamp:'not a date'}).sourceDate,'');
  assert.equal(UI.routeStats({...route,sourceTimestamp:null}).sourceDate,'');
});
check('route details state assumptions and current access limits', () => {
  const facts = UI.routeFacts(route);
  assert.match(facts,/4\.5 km\/h/);
  assert.match(facts,/excluding stops and travel to the start/);
  assert.match(facts,/conditions can change; follow signs/);
  assert.match(facts,/Includes steps/);
});
check('untrusted map text is escaped in all route outputs', () => {
  const bad = '<img src=x onerror="attack()"> & \' quoted';
  const card = UI.offerCard({...route,name:bad},0);
  const facts = UI.routeFacts({...route,source:bad,warnings:[bad]});
  for (const html of [card,facts]) {
    assert.doesNotMatch(html,/<img src=x/);
    assert.match(html,/&lt;img/);
    assert.match(html,/&quot;attack\(\)&quot;/);
    assert.match(html,/&amp;/);
    assert.match(html,/&#39;/);
  }
});
check('offer indices cannot become executable attributes', () => {
  const html = UI.offerCard(route,'0" onclick="attack()');
  assert.match(html,/data-quest-offer="0"/);
  assert.doesNotMatch(html,/onclick=/);
});
check('selected offer carries programmatic state', () => {
  assert.match(UI.offerCard(route,2,{selected:true}),/aria-current="true"/);
  assert.doesNotMatch(UI.offerCard(route,2),/aria-current=/);
});
check('SVG icon names are allowlisted rather than inserted', () => {
  const html = UI.icon('<script>attack()</script>');
  assert.match(html,/<svg/);
  assert.match(html,/aria-hidden="true"/);
  assert.doesNotMatch(html,/script|attack/);
});
check('encounter artwork rejects remote URLs and embedded attributes', () => {
  for (const artPath of ['https://evil.example/a.png','data:image/svg+xml,attack','x" onerror="attack()']) {
    const html = UI.encounterCards([{...encounter,artKey:'unknown',artPath}]);
    assert.match(html,/assets\/walking-quests\/warden\.webp/);
    assert.doesNotMatch(html,/evil\.example|data:image|onerror=/);
  }
});
check('undiscovered lore and choice prompts stay locked', () => {
  for (const html of [UI.encounterCards([encounter]),UI.encounterDialog(encounter)]) {
    assert.doesNotMatch(html,/A secret from Alderwing/);
    assert.doesNotMatch(html,/How will you greet/);
    assert.doesNotMatch(html,/data-encounter-choice=/);
    assert.match(html,/Checkpoint 3/);
  }
});
check('fiction labels remain visible in full and compact previews', () => {
  assert.match(UI.encounterCards([encounter]),/Fictional encounter/);
  assert.match(UI.encounterCards([encounter],{compact:true}),/Fictional encounter/);
  assert.match(UI.encounterDialog(encounter),/not a real-world building or person/);
});
check('compact encounter strip cannot nest buttons in an offer', () => {
  assert.doesNotMatch(UI.encounterCards([encounter],{compact:true}),/<button/);
  const html = UI.offerCard(route,0,{encounters:[encounter]});
  assert.equal((html.match(/<button\b/g) || []).length,1);
  assert.equal((html.match(/<\/button>/g) || []).length,1);
});
check('active encounters expose stable binding attributes safely', () => {
  const html = UI.encounterCards([{...encounter,id:'x" onclick="attack()'}]);
  assert.match(html,/data-encounter-id="x&quot; onclick=&quot;attack\(\)"/);
  assert.doesNotMatch(html,/" onclick="/);
  assert.doesNotMatch(UI.encounterCards([encounter],{interactive:false}),/<button/);
});
check('discovered encounters expose choices exactly once', () => {
  const discovered = {...encounter,discovered:true};
  assert.match(UI.encounterDialog(discovered),/data-encounter-choice="greet"/);
  const chosen = UI.encounterDialog({...discovered,choiceId:'greet',outcome:'A remembered greeting.'});
  assert.doesNotMatch(chosen,/data-encounter-choice=/);
  assert.match(chosen,/A remembered greeting\./);
  assert.match(chosen,/Remembered in your trail journal/);
});
check('embedded encounter uses its containing sheet navigation', () => {
  assert.doesNotMatch(UI.encounterDialog(encounter,{embedded:true}),/data-wq-close/);
  assert.match(UI.encounterDialog(encounter),/data-wq-close/);
});
check('completed journal is static and preserves lore and chosen outcomes', () => {
  const html = UI.journal([{...encounter,discovered:true,choiceId:'greet',outcome:'A remembered greeting.'}]);
  assert.doesNotMatch(html,/<button/);
  assert.match(html,/A secret from Alderwing/);
  assert.match(html,/A remembered greeting/);
  assert.match(html,/Fictional/);
});
check('journal does not expose undiscovered entries', () => {
  const html = UI.journal([encounter]);
  assert.match(html,/0 discovered/);
  assert.doesNotMatch(html,/The Warden|A secret from Alderwing/);
});
check('poor route data has a useful honest empty state', () => {
  assert.match(UI.emptyState('data-incomplete'),/walking map is incomplete/);
  assert.match(UI.emptyState('no-useful-route'),/No useful public-footpath walk/);
  assert.doesNotMatch(UI.emptyState('no-useful-route'),/Begin this walk/);
});

console.log('PASS: ' + passed + ' walking quest UI behavior contracts');
