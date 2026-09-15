// Read-only prerequisite graphs. Adapters supply authoritative facts and actions;
// this module never navigates, changes a save, spends, claims or invents a source.
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.BurbzPrerequisiteGuidance=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const count=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
// Saved guidance is a single small intent scoped to the existing per-game
// profile. Never accept saved labels/actions or carry an intent into a new game.
function normaliseTrackedRecipe(value, owner, recipeExists) {
  if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1)return null;
  if(typeof owner!=='string'||!/^[a-zA-Z0-9_-]{16,96}$/.test(owner)||value.owner!==owner)return null;
  if(typeof value.recipeId!=='string'||!/^[a-z0-9_]{1,64}$/.test(value.recipeId)||typeof recipeExists!=='function')return null;
  if(!recipeExists(value.recipeId))return null;
  return {version:1,owner,recipeId:value.recipeId};
}
function normaliseTrackedGoal(value,owner,known) {
  if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==2||typeof owner!=='string'||!/^[a-zA-Z0-9_-]{16,96}$/.test(owner)||value.owner!==owner)return null;
  const g=value.goal;if(!g||typeof g!=='object'||Array.isArray(g)||typeof g.type!=='string'||g.type.length>32||!Array.isArray(g.args)||g.args.length>4)return null;
  if(!g.args.every(a=>typeof a==='string'?a.length>0&&a.length<=120&&!/[<>\u0000-\u001f]/.test(a):Number.isSafeInteger(a)&&Math.abs(a)<=10000000000))return null;
  const goal={type:g.type,args:[...g.args]};if(typeof known!=='function'||!known(goal))return null;
  return {version:2,owner,goal};
}
function resolve(graph, goal, options={}) {
  const nodes=graph?.nodes||{}, actions=[], issues=[], seenActions=new Set(), cache=new Map(), maxNodes=Math.max(1,Math.min(200,options.maxNodes||80));
  let visited=0;
  function walk(id,path,ancestors){
    if(ancestors.has(id)){issues.push({id,reason:'cycle',path:[...path,id]});return false;}
    if(cache.has(id))return cache.get(id);
    if(++visited>maxNodes){issues.push({id,reason:'limit',path});return false;}
    const node=Object.prototype.hasOwnProperty.call(nodes,id)?nodes[id]:null;
    if(!node){issues.push({id,reason:'unknown',path});return false;}
    if(node.satisfied===true){cache.set(id,true);return true;}
    const trail=[...path,{id,label:node.label||id}], next=new Set(ancestors);next.add(id);
    const requirements=Array.isArray(node.requires)?node.requires:[];
    let ready=true;for(const child of requirements)if(!walk(child,trail,next))ready=false;
    if(!ready){cache.set(id,false);return false;}
    if(node.action&&node.available===true){
      const actionKey=JSON.stringify(node.action);
      if(!seenActions.has(actionKey)){actions.push({id,label:node.label,path:trail,action:{...node.action}});seenActions.add(actionKey);}
    }else issues.push({id,reason:node.reason||'unavailable',path:trail});
    cache.set(id,false);return false;
  }
  const satisfied=walk(goal,[],new Set());
  return {goal,status:satisfied?'satisfied':actions.length?'actionable':'blocked',actions,issues};
}
function forgePlan(facts){
  const f=facts||{}, recipe=f.recipe, nodes={}, shortages=[];
  const put=(id,node)=>(nodes[id]={label:id,...node},id);
  const action=(id,label,route)=>put(id,{label,action:route,available:!!route});
  if(!recipe?.id)return {goal:'recipe',nodes:{recipe:{label:'Recipe unavailable',reason:'unknown recipe'}},shortages};
  const source=(kind)=>{
    const id='source:'+kind;if(nodes[id])return id;
    const s=f.sources?.[kind];return put(id,{label:s?.label||'Find a confirmed source of '+kind,action:s?.action,available:s?.available===true,reason:s?.reason||'No currently available source has been confirmed.'});
  };
  const resource=(key,label,have,need,kind)=>{
    const short=Math.max(0,count(need)-count(have));
    if(short)shortages.push({key,label,have:count(have),need:count(need),short});
    return put(key,{label:short?'Need '+short+' more '+label:label,satisfied:!short,requires:short?[source(kind)]:[]});
  };
  const market=f.market||{}, forge=f.forge||{};
  const marketReq=[];
  const marketNeeded=[...(recipe.materials||[]),...(count(forge.level)<count(forge.required)?forge.upgrade?.materials||[]:[])].some(m=>count(m.have)<count(m.need)&&m.buyable===true&&Number(m.each)>0);
  if(!market.built&&marketNeeded){
    marketReq.push(resource('market:level','trainer levels',f.level,market.level,'xp'));
    marketReq.push(resource('market:coins','coins for the Market',f.coins,market.coins,'coins'));
    marketReq.push(resource('market:branches','timber for the Market',f.branches,market.branches,'branches'));
    if(market.lock)marketReq.push(put('market:lock',{label:market.lock,reason:market.lock}));
  }
  put('market',{label:'Build the Magpie Market',satisfied:market.built===true,requires:marketReq,available:f.routes?.academy===true,action:{kind:'market-build'}});
  function materials(prefix,list,reserveCoins){
    const missing=(list||[]).filter(m=>count(m.have)<count(m.need));
    const known=missing.filter(m=>Number.isFinite(m.each)&&m.each>0&&m.buyable===true);
    const budget=count(reserveCoins)+known.reduce((sum,m)=>sum+(count(m.need)-count(m.have))*m.each,0);
    const budgetId=resource(prefix+':budget','coins for materials and the '+(prefix==='recipe'?'recipe':'Forge upgrade'),f.coins,budget,'coins');
    return missing.map(m=>{
      const short=count(m.need)-count(m.have), id=prefix+':material:'+m.id;
      shortages.push({key:id,id:m.id,label:m.label||m.id,have:count(m.have),need:count(m.need),short});
      if(!known.includes(m))return put(id,{label:short+' × '+(m.label||m.id),reason:'No audited purchase source for this material.'});
      return put(id,{label:'Buy '+short+' × '+(m.label||m.id)+' at the Market',requires:['market',budgetId],available:f.routes?.academy===true,action:{kind:'market',itemId:m.id,quantity:short}});
    });
  }
  const requires=[];
  if(count(forge.level)<count(forge.required)){
    const upgrade=forge.upgrade;
    if(!upgrade)requires.push(put('forge:upgrade',{label:'Upgrade the Forge',reason:'Upgrade price unavailable.'}));
    else {
      const req=[resource('upgrade:branches','timber for the Forge',f.branches,upgrade.branches,'branches'),...materials('upgrade',upgrade.materials,upgrade.coins)];
      req.push(resource('upgrade:coins','coins for the Forge upgrade',f.coins,upgrade.coins,'coins'));
      requires.push(put('forge:upgrade',{label:'Upgrade the Forge to level '+(count(forge.level)+1)+' (recipe needs '+forge.required+')',requires:req,available:f.routes?.forge===true,action:{kind:'forge-upgrade'}}));
    }
  }
  requires.push(resource('recipe:coins','coins for the recipe',f.coins,recipe.coins,'coins'));
  requires.push(...materials('recipe',recipe.materials,recipe.coins));
  if(forge.queueFull)requires.push(action('forge:queue',forge.readyJob?'Collect a finished Forge job':'Review the busy anvils — a slot must become free',{kind:'forge-queue'}));
  const goal='recipe:'+recipe.id;
  put(goal,{label:'Forge '+recipe.label,requires,available:f.routes?.forge===true,action:{kind:'recipe',recipeId:recipe.id}});
  return {goal,nodes,shortages};
}
return {resolve,forgePlan,normaliseTrackedRecipe,normaliseTrackedGoal};
});
