/* Deterministic, read-only room plans. Coordinates and collision share one source. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BurbzBuildingRoomsCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const CABINS=[
 ['Hearthside','fireplace','armchair','shelf',0xb26748,7,8],
 ['Herbalist','planter','workbench','shelf',0x688463,8,8],
 ['Weaver','loom','spools','chest',0xa0748f,8,9],
 ['Mapmaker','mapdesk','globe','shelf',0x58848b,9,8],
 ['Fisher','net','barrels','workbench',0x628e99,7,9],
 ['Beekeeper','hives','workbench','shelf',0xc49c51,9,9],
 ['Woodcarver','workbench','woodpile','chest',0x9a724a,8,8],
 ['Stargazer','telescope','mapdesk','shelf',0x656b99,9,8],
 ['Booklover','shelf','shelf','armchair',0x7a6658,8,10],
 ['Baker','oven','workbench','barrels',0xbc8b61,9,9],
 ['Musician','piano','music','armchair',0x91684b,9,8],
 ['Potter','wheel','pots','shelf',0xb67661,8,9],
 ['Gardener','planter','planter','workbench',0x82995d,7,10],
 ['Tailor','loom','mirror','spools',0x965775,9,9],
 ['Traveller','trunks','mapdesk','chest',0x72917c,8,8],
 ['Painter','easel','pots','workbench',0x778caa,9,10],
 ['Clockmaker','clock','workbench','shelf',0xab8646,8,9],
 ['Bunkhouse','bunk','trunks','barrels',0x688078,10,9],
 ['Teahouse','teatable','planter','shelf',0x9d7972,9,8],
 ['Winter retreat','fireplace','woodpile','armchair',0x8b6263,10,10]
];
const ROOMS={tavern:['The village pub',12,13,'bar','tables','fireplace',0x944d3f],chapel:['The chapel',10,13,'altar','pews','organ',0x737ba0],market:['Market hall',12,11,'stall','stalls','scales',0xa9854f],storehouse:['The storehouse',11,12,'crates','racks','barrels',0x78907c],foundry:['The foundry',11,12,'forge','anvil','workbench',0x9b5e46],entertainment:['The gathering hall',12,12,'stage','tables','music',0x8d6689],farm:['The farmhouse',10,11,'oven','produce','workbench',0x7c8b54],hut:['The food lodge',9,10,'oven','produce','barrels',0x7f9161],well:['The pump house',8,9,'pump','barrels','workbench',0x5c8c8c],lumberhut:['The woodcutter’s hut',8,10,'woodpile','workbench','saw',0x937452],minehut:['The miner’s hut',8,10,'ore','workbench','racks',0x7c858b],lumber:['The sawmill',11,13,'saw','woodpile','workbench',0x8b724c],quarry:['The stone workshop',11,12,'stone','workbench','ore',0x92948c]};
function hash(value){let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
const SIZES={bed:[1.65,2.35],bunk:[1.7,2.4],fireplace:[2,1],armchair:[1,1],shelf:[1.6,.6],workbench:[2,1],loom:[1.8,1.4],mapdesk:[1.8,1.1],telescope:[1.4,1.4],piano:[1.9,.9],oven:[1.8,1.1],teatable:[1.5,1.5],bar:[7,1.1],altar:[2.8,1.2],organ:[2,1],stage:[5,2],stall:[2.4,1.4],forge:[2.6,1.7],pump:[1.8,1.8],saw:[2.8,1.5],stone:[2.2,1.8],anvil:[1.4,1],pew:[2.5,.7],table:[1.8,1.6],rug:[2,3]};
function plan({buildingId='cabin',seed=0,homeId='',variant}={}){
 const cabin=buildingId==='cabin'||buildingId==='cottages';if(!cabin&&!ROOMS[buildingId])throw Error('No room for this building');
 const k=Number.isInteger(variant)?((variant%20)+20)%20:hash(seed+':'+buildingId+':'+homeId)%20;
 const row=cabin?CABINS[k]:ROOMS[buildingId];const w=cabin?row[5]:row[1],d=cabin?row[6]:row[2],accent=cabin?row[4]:row[6];
 const p={buildingId,variant:cabin?k:null,name:cabin?row[0]+' cabin':row[0],width:w,depth:d,height:3.5,accent,props:[],spawn:{x:0,y:0,z:d/2-1.2,yaw:0,pitch:-.04},exit:{x:0,z:d/2-.65},action:null};
 function put(type,x,z,turn=0){const size=SIZES[type]||[1.3,1];const rot=turn*Math.PI/2,sw=turn%2?size[1]:size[0],sd=turn%2?size[0]:size[1];const item={type,x,z,rot,w:sw,d:sd,solid:type!=='rug'};p.props.push(item);return item;}
 if(cabin){
  const mirror=k%2?-1:1;const left=-mirror*(w/2-1.3),right=mirror*(w/2-1.35);
  put('bed',left,k%3===0?-.6:-d/2+1.7,k%4===2?1:0);
  put(row[1],right,-d/2+1.5,row[1]==='fireplace'?(mirror>0?3:1):(k%5===0?1:0));
  put(row[2],right,d/2-2.1,k%3===1?1:0);
  put(row[3],left,d/2-1.9,k%4===0?1:0);
  put('rug',0,-.1);if(k>=16)put('chest',0,-d/2+.9);
 }else{
  put(row[3],0,-d/2+1.5);
  const type=row[4];
  if(type==='pews'){for(const x of [-2.5,2.5])for(const z of [-2,0,2])put('pew',x,z);}
  else if(type==='tables'){for(const x of [-3.5,3.5])for(const z of [-1.4,2.1])put('table',x,z);}
  else if(type==='stalls'){for(const x of [-3.8,3.8])for(const z of [-1.4,2.1])put('stall',x,z,x<0?1:3);}
  else {for(const x of [-w/2+1.7,w/2-1.7])for(const z of [-.8,d/2-2.2])put(type,x,z);}
  put(row[5],-w/2+1.65,-d/2+1.5);if(buildingId==='tavern')p.action={x:0,z:-d/2+3.1,label:'Step up to the bar',kind:'bar'};
 }
 return p;
}
function world(p){const r=.27;return{segments:[],polygons:[],radius:Math.hypot(p.width,p.depth),height:()=>0,spawn:()=>({...p.spawn}),allowed(x,z){return Number.isFinite(x+z)&&Math.abs(x)<p.width/2-r&&Math.abs(z)<p.depth/2-r&&!p.props.some(o=>o.solid&&Math.abs(x-o.x)<o.w/2+r&&Math.abs(z-o.z)<o.d/2+r);}};}
return{CABINS,ROOMS,plan,world,hash};
});
