'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const G=require('../prerequisite_guidance_core.js'),L=require('../loot_crafting_core.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const fn=name=>{const start=html.indexOf('function '+name+'(');assert(start>=0,name);return html.slice(start,html.indexOf('\n}',start)+2);};
const owner='first_saved_game_1234',other='second_saved_game_5678';
const fresh=()=>({photoProfileId:owner,prerequisiteGoal:null,player:{coins:100},inventory:{items:{oak_twig:2,river_reed:2},gear:{},equipment:{'@player':{weapon:'thorn_talons'}}},forgeJobs:[],quests:{keep:{progress:3}},untouched:{yes:true}});
const copy=v=>JSON.parse(JSON.stringify(v));
function fixture(saved){
 const data={value:saved||JSON.stringify(fresh()),fail:false,writes:0};
 const c={window:{BurbzPrerequisiteGuidance:G},lootCore:()=>L,gameState:JSON.parse(data.value),localStorage:{getItem:()=>data.value,setItem:(key,value)=>{if(data.fail)throw Error('Quota');data.value=value;data.writes++;}},photoSaveBaseline:data.value,photoSaveConflictShown:false,queueCloudSave:()=>{},queueActionBadgeUpdate:()=>{},showToast:t=>c.toasts.push(t),toasts:[],setTimeout,console,Date,Math,JSON,Number,Object,Array};
 vm.createContext(c);
 vm.runInContext(['normalisePrerequisiteRecipeGoal','prerequisiteTrackedRecipe','setPrerequisiteRecipeGoal','durableSaveState','saveState','snapshotGameState','restoreStateTree','restoreGameStateSnapshot','forgeCommitChange','craftGear'].map(fn).join('\n'),c);
 Object.assign(c,{burbzForgeLevel:()=>1,forgeQueueIsFull:()=>false,startPrerequisiteRecipe:id=>c.setPrerequisiteRecipeGoal(id),ensureForgeJobs:()=>c.gameState.forgeJobs,updateHeader:()=>{},SFX:{questComplete:()=>{}},vibrate:()=>{},formatForgeDuration:()=>'',renderForge:()=>{},refreshPrerequisiteGoalBanner:()=>{}});
 return {c,data};
}
let groups=0;function check(name,run){run();groups++;console.log('PASS',name);}
check('Saved input is one bounded, known recipe in the current game, with no saved routes or rewards',()=>{
 const goal={version:1,owner,recipeId:'reed_bow',action:{kind:'give',coins:999999},label:'unsafe',shortage:0};
 assert.deepEqual(G.normaliseTrackedRecipe(goal,owner,id=>!!L.recipeFor(id)),{version:1,owner,recipeId:'reed_bow'});
 for(const bad of [null,[],true,'reed_bow',{...goal,version:2},{...goal,owner:other},{...goal,recipeId:'not_real'},{...goal,recipeId:'x'.repeat(65)},{...goal,recipeId:'<script>'},{...goal,recipeId:42}])assert.equal(G.normaliseTrackedRecipe(bad,owner,id=>!!L.recipeFor(id)),null);
 assert.equal(G.normaliseTrackedRecipe(goal,'bad',()=>true),null);assert.equal(G.normaliseTrackedRecipe(goal,owner,null),null);
 for(const recipe of L.allRecipes())assert.equal(G.normaliseTrackedRecipe({...goal,recipeId:recipe.gearId},owner,id=>!!L.recipeFor(id)).recipeId,recipe.gearId);
});
check('Selection persists without altering inventory, equipment or quests, and survives a separate app session',()=>{
 const {c,data}=fixture(),before=copy(c.gameState);assert(c.setPrerequisiteRecipeGoal('reed_bow'));assert.equal(data.writes,1);const saved=JSON.parse(data.value);delete saved.prerequisiteGoal;delete before.prerequisiteGoal;assert.deepEqual(saved,before);
 const reopened=fixture(data.value);assert.equal(reopened.c.prerequisiteTrackedRecipe(),'reed_bow');assert.equal(reopened.data.writes,0,'Reading the goal must not save or spend');
 assert(c.setPrerequisiteRecipeGoal('reed_bow'));assert.equal(data.writes,1,'Next-step refresh does not write the same goal repeatedly');
 assert(!c.setPrerequisiteRecipeGoal('not_real'));assert.equal(c.prerequisiteTrackedRecipe(),'reed_bow');assert.equal(data.writes,1);
});
check('Confirmed reset and replacement game identities cannot inherit another game’s goal',()=>{
 const {c,data}=fixture();c.setPrerequisiteRecipeGoal('reed_bow');const old=copy(c.gameState.prerequisiteGoal);
 c.gameState={...fresh(),photoProfileId:other,prerequisiteGoal:old};assert.equal(c.prerequisiteTrackedRecipe(),null);
 c.gameState={...fresh(),photoProfileId:other};assert.equal(c.prerequisiteTrackedRecipe(),null);
 c.gameState={...fresh(),photoProfileId:other,prerequisiteGoal:{version:1,owner:other,recipeId:'thorn_talons'}};assert.equal(c.prerequisiteTrackedRecipe(),'thorn_talons');
 assert(html.includes('prerequisiteGoal: null'));assert(html.includes('gameState.prerequisiteGoal = normalisePrerequisiteRecipeGoal(gameState.prerequisiteGoal);'));
});
check('Stop tracking persists; failed selection or stop preserves the previous goal and other live references',()=>{
 const {c,data}=fixture();c.setPrerequisiteRecipeGoal('reed_bow');const before=data.value,goal=c.gameState.prerequisiteGoal,bag=c.gameState.inventory.items;
 data.fail=true;assert(!c.setPrerequisiteRecipeGoal('thorn_talons'));assert.equal(c.gameState.prerequisiteGoal,goal);assert(!c.setPrerequisiteRecipeGoal(null));assert.equal(c.gameState.prerequisiteGoal,goal);assert.equal(c.gameState.inventory.items,bag);assert.equal(data.value,before);
 data.fail=false;assert(c.setPrerequisiteRecipeGoal(null));assert.equal(fixture(data.value).c.prerequisiteTrackedRecipe(),null);
 const missing=fixture();delete missing.c.gameState.prerequisiteGoal;missing.data.fail=true;assert(!missing.c.setPrerequisiteRecipeGoal('reed_bow'));assert(!Object.hasOwn(missing.c.gameState,'prerequisiteGoal'),'Rollback preserves absent legacy field');
});
check('A stale tab cannot overwrite another tab’s tracked goal or resource changes',()=>{
 const first=fixture(),stale=fixture(first.data.value);first.c.setPrerequisiteRecipeGoal('reed_bow');stale.data.value=first.data.value;
 assert(!stale.c.setPrerequisiteRecipeGoal('thorn_talons'));assert.equal(stale.c.prerequisiteTrackedRecipe(),null);assert.equal(stale.data.value,first.data.value);assert.equal(stale.data.writes,0);
});
check('Paid commission and goal completion commit together; failed save restores both with no duplicate job',()=>{
 const {c,data}=fixture();c.setPrerequisiteRecipeGoal('reed_bow');const before=data.value,bag=c.gameState.inventory.items,quests=c.gameState.quests;
 data.fail=true;assert.equal(c.craftGear('reed_bow'),false);assert.equal(data.value,before);assert.equal(c.prerequisiteTrackedRecipe(),'reed_bow');assert.equal(c.gameState.inventory.items,bag);assert.equal(c.gameState.quests,quests);assert.equal(c.gameState.forgeJobs.length,0);assert.equal(c.gameState.player.coins,100);
 data.fail=false;assert.equal(c.craftGear('reed_bow'),true);const reopened=fixture(data.value);assert.equal(reopened.c.prerequisiteTrackedRecipe(),null);assert.equal(reopened.c.gameState.player.coins,80);assert.equal(reopened.c.gameState.forgeJobs.length,1);assert.equal(reopened.c.gameState.forgeJobs[0].gearId,'reed_bow');assert.deepEqual(copy(reopened.c.gameState.inventory.items),{});
});
check('An unrelated commission cannot clear the tracked recipe',()=>{
 const {c,data}=fixture();c.setPrerequisiteRecipeGoal('thorn_talons');assert.equal(c.craftGear('reed_bow'),true);assert.equal(fixture(data.value).c.prerequisiteTrackedRecipe(),'thorn_talons');
});
check('Recovery recomputes authoritative material quantities, gates and budgets rather than a saved plan',()=>{
 const {c,data}=fixture();c.setPrerequisiteRecipeGoal('reed_bow');const reopened=fixture(data.value).c;
 const facts=()=>({recipe:{id:reopened.prerequisiteTrackedRecipe(),label:'Wayfarer Bow',coins:20,materials:Object.entries(L.recipeFor('reed_bow').materials).map(([id,need])=>({id,need,have:reopened.gameState.inventory.items[id]||0,buyable:true,each:6}))},coins:reopened.gameState.player.coins,market:{built:true},forge:{level:1,required:1},routes:{academy:true,forge:true},sources:{coins:{label:'Earn coins',available:true,action:{kind:'errand',id:'find_coins'}}}});
 reopened.prerequisiteRecipeFacts=facts;reopened.BurbzPrerequisiteGuidance=G;vm.runInContext(fn('prerequisiteCurrentPlan'),reopened);
 delete reopened.gameState.inventory.items.river_reed;let p=reopened.prerequisiteCurrentPlan();assert.equal(p.actions[0].action.quantity,2);
 reopened.gameState.inventory.items.river_reed=1;p=reopened.prerequisiteCurrentPlan();assert.equal(p.actions[0].action.quantity,1);
 reopened.gameState.player.coins=20;p=reopened.prerequisiteCurrentPlan();assert.equal(p.actions[0].action.kind,'errand');
 reopened.gameState.player.coins=100;reopened.gameState.inventory.items.river_reed=2;p=reopened.prerequisiteCurrentPlan();assert.equal(p.actions[0].action.kind,'recipe');
});
console.log(groups+' prerequisite persistence/transaction groups passed');
