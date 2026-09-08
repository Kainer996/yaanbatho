/* Room discoveries and reachable indoor routes; the caller owns persistence. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzInteriorLifeCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function key(t){const academy=t.scope==='academy',home=academy?'':t.homeId||(['cabin','cottages'].includes(t.buildingId)?t.buildingId+':0':'');return [academy?'academy':'village',academy?0:Number(t.seed)>>>0,t.buildingId,String(home).slice(0,120)].map(encodeURIComponent).join('/');}
const MATERIALS={library:'down_tuft',observatory:'moon_dust',magpie_market:'gold_thread',foundry:'iron_grit',quarry:'iron_grit',minehut:'iron_grit',nursery:'down_tuft',hospital:'river_reed',workshop:'oak_twig',lumber:'oak_twig',lumberhut:'oak_twig'};
function finds(t){const h=hash(key(t));return [{id:'welcome',label:'Little supply pouch',reward:{materials:{[MATERIALS[t.buildingId]||'oak_twig']:1}}},{id:'keepsake',label:'Forgotten coin purse',reward:{coins:3+h%5}}];}
function collected(state,t,id){return !!state.interiorDiscoveries?.[key(t)]?.[id];}
function claim(state,t,id){const item=finds(t).find(x=>x.id===id);if(!item||collected(state,t,id))return null;const all=state.interiorDiscoveries||(state.interiorDiscoveries={});const page=all[key(t)]||(all[key(t)]={});page[id]=true;return item;}
function navigation(world,spawn){
 const step=.4,nodes=[],lookup=new Map(),queue=[];const index=(x,z)=>Math.round((x-spawn.x)/step)+','+Math.round((z-spawn.z)/step);
 const add=(x,z,parent)=>{const k=index(x,z);if(lookup.has(k)||!world.allowed(x,z))return;const node={x,z,parent,index:nodes.length};lookup.set(k,node);nodes.push(node);queue.push(node);};add(spawn.x,spawn.z,null);
 for(let q=0;q<queue.length&&nodes.length<10000;q++){const p=queue[q];for(const [dx,dz]of [[step,0],[-step,0],[0,step],[0,-step]])if(world.allowed(p.x+dx/2,p.z+dz/2))add(p.x+dx,p.z+dz,p.index);}
 function closest(p){let best=nodes[0],d=Infinity;for(const n of nodes){const a=Math.hypot(n.x-p.x,n.z-p.z);if(a<d){d=a;best=n;}}return best;}
 function route(a,b){const from=closest(a),to=closest(b);if(!from||!to)return[];const pending=[from],parents=new Map([[from.index,null]]);for(let i=0;i<pending.length;i++){const p=pending[i];if(p===to)break;for(const[dx,dz]of [[step,0],[-step,0],[0,step],[0,-step]]){const n=lookup.get(index(p.x+dx,p.z+dz));if(n&&!parents.has(n.index)&&world.allowed(p.x+dx/2,p.z+dz/2)){parents.set(n.index,p.index);pending.push(n);}}}if(!parents.has(to.index))return[];const path=[];for(let i=to.index;i!==null;i=parents.get(i))path.push({x:nodes[i].x,z:nodes[i].z});return path.reverse();}
 function spots(seed,count){const sorted=nodes.filter(n=>Math.hypot(n.x-spawn.x,n.z-spawn.z)>2).sort((a,b)=>hash(seed+':'+a.index)-hash(seed+':'+b.index));const out=[];for(const n of sorted){if(out.every(p=>Math.hypot(p.x-n.x,p.z-n.z)>1.2)){out.push({x:n.x,z:n.z});if(out.length===count)break;}}return out;}
 return{nodes,route,closest,spots};
}
return{hash,key,finds,collected,claim,navigation};
});
