const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../battle_core.js'),loot=require('../loot_crafting_core.js'),aim=require('../battle_aim_core.js');
function fixture(id='tempest_scroll'){
  const make=(id,species)=>core.buildFighter({id,species,hp:500,maxHp:500,atk:40,mag:65,def:40,int:40,spd:40,stamina:50});
  const player=make('p','European Robin');player.skills=[{...loot.spellSkillFor(id),cdLeft:0}];
  const b=core.createBattle({playerFighters:[player],opponentFighters:Array.from({length:4},(_,i)=>make('e'+i,'House Sparrow')),seed:'aim-test'});
  b.phase='act';b.turn=1;b.acting={side:'player',index:0};b.turnHolder={side:'player',index:0};return b;
}
test('direct Frost Sigil hits exactly the aimed bird and applies its slow',()=>{
  const b=fixture('frost_sigil'),before=b.teams.opponent.map(f=>f.hp);
  const events=core.resolveAction(b,{skillIndex:0,targetIndex:2,aimed:true});
  assert.deepEqual(events.filter(e=>e.type==='damage').map(e=>e.targetIndex),[2]);
  assert.deepEqual(b.teams.opponent.map((f,i)=>f.hp<before[i]),[false,false,true,false]);
  assert.ok(b.teams.opponent[2].mods.some(m=>m.stat==='spd'&&m.pct<0));
});
for(const [spell,scale] of [['ember_wisp',.35],['tempest_scroll',.55]])test(spell+' damages the primary and only immediate living neighbours',()=>{
  const b=fixture(spell),skill=b.teams.player[0].skills[0];
  assert.deepEqual(core.attackTargets(b,skill,1),[{index:1,scale:1,primary:true},{index:0,scale,primary:false},{index:2,scale,primary:false}]);
  const events=core.resolveAction(b,{skillIndex:0,targetIndex:1,aimed:true}).filter(e=>e.type==='damage');
  assert.deepEqual(events.map(e=>e.targetIndex),[1,0,2]);assert.ok(events[0].dmg>events[1].dmg&&events[0].dmg>events[2].dmg);
  assert.equal(b.teams.opponent[3].hp,b.teams.opponent[3].maxHp);assert.equal(skill.cdLeft,skill.cd);
  const after=JSON.stringify(b);assert.throws(()=>core.resolveAction(b,{skillIndex:0,targetIndex:1,aimed:true}));assert.equal(JSON.stringify(b),after);
});
test('edge splash does not wrap, and a fallen neighbour does not bridge a gap',()=>{
  const b=fixture(),s=b.teams.player[0].skills[0];
  assert.deepEqual(core.attackTargets(b,s,0).map(h=>h.index),[0,1]);assert.deepEqual(core.attackTargets(b,s,3).map(h=>h.index),[3,2]);
  b.teams.opponent[1].fainted=true;b.teams.opponent[1].hp=0;
  assert.deepEqual(core.attackTargets(b,s,0).map(h=>h.index),[0]);
});
test('invalid, dead and recharging aimed attacks leave all battle state unchanged',()=>{
  for(const index of [null,-1,4,1.5]){const b=fixture(),before=JSON.stringify(b);assert.throws(()=>core.resolveAction(b,{skillIndex:0,targetIndex:index,aimed:true}));assert.equal(JSON.stringify(b),before);}
  for(const mutate of [b=>{b.teams.opponent[1].fainted=true;},b=>{b.teams.player[0].skills[0].cdLeft=2;},b=>{b.teams.opponent.splice(1);}]){
    const b=fixture();mutate(b);const before=JSON.stringify(b);assert.throws(()=>core.resolveAction(b,{skillIndex:0,targetIndex:1,aimed:true}));assert.equal(JSON.stringify(b),before);
  }
});
test('preview uses splash strength before each target barrier and does not mutate',()=>{
  const b=fixture(),a=b.teams.player[0],d=b.teams.opponent[0],s=a.skills[0];d.barrier=15;
  const before=JSON.stringify(b),direct=core.previewDamage(a,d,s),splash=core.previewDamage(a,d,s,{damageScale:.55});
  assert.ok(splash.avg<direct.avg);assert.equal(JSON.stringify(b),before);
  const result=core.resolveAction(b,{skillIndex:0,targetIndex:1,aimed:true}).find(e=>e.type==='damage'&&e.targetIndex===0);
  assert.ok(result.crit||result.dmg>=splash.min&&result.dmg<=splash.max);
});
test('thumb targeting follows actual resized card centres and curves meet the artwork',()=>{
  const cards=[{index:0,x:40},{index:1,x:125},{index:3,x:285}];
  assert.equal(aim.targetAt(0,cards).index,0);assert.equal(aim.targetAt(100,cards).index,3);
  for(const t of cards)assert.equal(aim.targetAt(aim.valueFor(t.index,cards),cards).index,t.index);
  for(const width of [320,390,800]){const c=aim.curve({x:width-30,y:550},{x:width-30,y:160},width);assert.deepEqual(aim.pointAt(c,0),c.start);assert.deepEqual(aim.pointAt(c,1),c.end);for(let t=0;t<=1;t+=.05)assert.ok(aim.pointAt(c,t).x<=width);}
});
test('ordinary Peck and legacy all-target signatures retain their targeting',()=>{
  const b=fixture();b.teams.player[0].skills=[{...core.PECK,cdLeft:0}];assert.equal(core.isAimedSkill(core.PECK),false);
  assert.deepEqual(core.resolveAction(b,{skillIndex:0,targetIndex:3}).filter(e=>e.type==='damage').map(e=>e.targetIndex),[3]);
  const c=fixture();c.teams.player[0].skills=[{...core.signatureFor('Rook','trickster'),cdLeft:0}];
  assert.equal(core.resolveAction(c,{skillIndex:0,targetIndex:0}).filter(e=>e.type==='damage').length,4);
});
