'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),L=require('../loot_crafting_core.js'),K=require('../kitchen_pantry_core.js');
const fn=name=>{const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction ',start+10);assert(start>=0&&end>start,name);return html.slice(start,end);};
function fixture(){
 const c={console,structuredClone,JSON,Math,Number,Object,Array,String,Date,lootCore:()=>L,kitchenCore:()=>K,kitchenIngredientById:K.ingredientById,inventoryLabel:id=>id,inventoryIcon:()=> '🎁',forgeGearStatLine:()=> 'Crafted equipment',escapeHtml:s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),formatHudAmount:String,academyRoleMultiplier:()=>1,allowed:true,isAcademyBuildingBuilt:()=>c.allowed,focusMagpieMarketBuild:()=>{},$:()=>null,currentScreen:'academy-room',showToast:t=>c.toasts.push(t),showResourceQuestPrompt:()=>c.prompts++,queueCloudSave:()=>{},queueActionBadgeUpdate:()=>{},SFX:{questComplete:()=>{},victory:()=>{}},vibrate:()=>{},updateHeader:()=>{},renderInventory:()=>{},renderForge:()=>{},logDiary:()=>{},formatForgeDuration:()=>'',toasts:[],prompts:0,saved:null,fail:false};
 c.gameState={player:{coins:1000,marketTrades:0},inventory:{items:{oak_twig:7,lucky_pebble:2},larder:{hedgerow_berries:3},gear:{},equipment:{bird1:{weapon:'equipped-only'}}},quests:{trade:{progress:0}},forgeJobs:[],unrelated:{keep:true}};
 c.localStorage={setItem:(key,value)=>{if(c.fail)throw Error('Quota');c.saved=JSON.parse(value);}};
 c.updateQuestProgress=(type,n,effects)=>{c.gameState.quests.trade.progress+=n;effects?.push(()=>c.toasts.push('quest'));};c.ensureForgeJobs=()=>c.gameState.forgeJobs;
 vm.createContext(c);
 vm.runInContext(['snapshotGameState','restoreStateTree','restoreGameStateSnapshot','durableSaveState','saveState','addCoins','collectForgeJob'].map(fn).join('\n')+'\n'+html.slice(html.indexOf('function storesSellRarity('),html.indexOf('function renderProjectManagerOfficePanelHTML(')),c);
 return c;
}
let groups=0;const check=(name,f)=>{f();groups++;console.log('PASS',name);};
check('Buy and Sell offer distinct goods, with all positive owned bags represented',()=>{
 const c=fixture(),gear=Object.keys(L.GEAR)[0];c.gameState.inventory.gear[gear]=2;
 let s=c.renderMagpieMarketPanelHTML();assert(s.includes('role="tablist"'));assert(s.includes('BUY 5'));assert(!s.includes('SELL 1'));assert(s.includes('Food &amp;')||s.includes('Food & larder'));
 c.magpieMarketSetTab('sell');s=c.renderMagpieMarketPanelHTML();assert(s.includes('SELL 1'));assert(!s.includes('BUY 1'));
 const rows=c.magpieMarketSellStock();assert.deepEqual(Array.from(new Set(rows.map(r=>r.kind))).sort(),['food','gear','keepsake','material']);assert(rows.some(r=>r.id===gear));
});
check('Material and food buys charge exact quotes, persist stock and trade progress together',()=>{
 const c=fixture();assert(c.magpieMarketBuy('oak_twig',5));assert.equal(c.gameState.player.coins,975);assert.equal(c.saved.inventory.items.oak_twig,12);
 assert(c.magpieMarketBuy('hedgerow_berries',1,'food'));assert.equal(c.saved.inventory.larder.hedgerow_berries,4);assert.equal(c.saved.player.coins,970);assert.equal(c.saved.player.marketTrades,2);assert.equal(c.saved.quests.trade.progress,2);
});
check('Insufficient full quantity, invalid quantities and unknown goods never spend or grant',()=>{
 const c=fixture();c.gameState.player.coins=6;let before=JSON.stringify(c.gameState);assert(!c.magpieMarketBuy('oak_twig',5));assert.equal(c.prompts,1);
 for(const qty of [0,-1,1.5,NaN,Infinity,'1'])assert(!c.magpieMarketBuy('oak_twig',qty));assert(!c.magpieMarketBuy('unknown',1));assert(!c.magpieMarketBuy('__proto__',1,'food'));assert(!c.magpieMarketBuy('constructor',1));assert(!c.magpieMarketBuy('oak_twig',1,'gear'));assert.deepEqual(JSON.parse(JSON.stringify(c.gameState)),JSON.parse(before));
});
check('Every collected Forge recipe, across all five equipment slots, can be sold',()=>{
 const c=fixture(),all=Object.values(L.GEAR);const slots=new Set();
 for(const item of all){assert(L.recipeFor(item.id));slots.add(item.slot);c.gameState.forgeJobs=[{id:'test',gearId:item.id,endMs:0}];c.collectForgeJob('test');assert.equal(c.gameState.inventory.gear[item.id],1);assert(c.magpieMarketSellStock().some(row=>row.kind==='gear'&&row.id===item.id));const coins=c.gameState.player.coins;assert(c.magpieMarketSell(item.id,'all','gear'));assert.equal(c.gameState.player.coins,coins+L.sellValue('gear',item.rarity));assert(!(item.id in c.gameState.inventory.gear));}
 assert.equal(slots.size,5);assert.equal(c.gameState.inventory.equipment.bird1.weapon,'equipped-only');console.log('  recipes verified:',all.length);
});
check('Single, whole-stack and stale sales clamp to inventory with no duplicate currency',()=>{
 const c=fixture();assert(c.magpieMarketSell('oak_twig',1));assert.equal(c.saved.inventory.items.oak_twig,6);assert(c.magpieMarketSell('oak_twig',99));assert.equal(c.saved.player.coins,1014);assert(!c.magpieMarketSell('oak_twig',1));assert.equal(c.gameState.player.coins,1014);
 assert(c.magpieMarketSell('hedgerow_berries','all','food'));assert(c.magpieMarketSell('lucky_pebble','all','keepsake'));assert.equal(c.saved.player.coins,1030);
});
check('Empty inventories and malformed stock are safe, with a useful empty state',()=>{
 const c=fixture();c.gameState.inventory={};c.magpieMarketSetTab('sell');assert(c.renderMagpieMarketPanelHTML().includes('Nothing to sell yet'));assert.equal(c.magpieMarketSellStock().length,0);assert(!c.magpieMarketSell('none',1,'keepsake'));assert(!c.magpieMarketSell('none',1,'unknown'));
 c.gameState.inventory.items={oak_twig:Infinity};assert(!c.magpieMarketSell('oak_twig','all'));assert.equal(c.gameState.player.coins,1000);
});
check('Failed writes restore purse, items, quest progress and existing object identities',()=>{
 for(const action of [c=>c.magpieMarketBuy('oak_twig',5),c=>c.magpieMarketSell('oak_twig','all')]){
  const c=fixture(),before=JSON.stringify(c.gameState),bag=c.gameState.inventory.items,quest=c.gameState.quests.trade;c.fail=true;assert(!action(c));assert.deepEqual(JSON.parse(JSON.stringify(c.gameState)),JSON.parse(before));assert.equal(c.gameState.inventory.items,bag);assert.equal(c.gameState.quests.trade,quest);assert(!c.toasts.includes('quest'));assert.equal(c.saved,null);c.fail=false;assert(action(c));assert.equal(c.saved.player.marketTrades,1);
 }
});
check('Market building gate, protected equipped pieces and item-category validation stay enforced',()=>{
 const c=fixture(),before=JSON.stringify(c.gameState);c.allowed=false;assert(!c.magpieMarketBuy('oak_twig',1));assert(!c.magpieMarketSell('oak_twig',1));assert.deepEqual(JSON.parse(JSON.stringify(c.gameState)),JSON.parse(before));c.allowed=true;assert(!c.magpieMarketSell('equipped-only',1,'gear'));assert(!c.magpieMarketSell('oak_twig',1,'keepsake'));assert.deepEqual(JSON.parse(JSON.stringify(c.gameState)),JSON.parse(before));
});
console.log(groups+' marketplace regression groups passed');
