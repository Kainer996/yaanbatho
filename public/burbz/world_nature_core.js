/* Alderwing nature: what covers the ground and what grows there, read from the
 * real map's land cover, the real elevation, slope, water and today's season.
 * Pure data. No rendering, persistence, GPS or game rewards. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzWorldNatureCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),mix=(a,b,t)=>a+(b-a)*t;
function smooth(t){t=clamp(t,0,1);return t*t*(3-2*t);}
function hash(x,z,salt=0){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^salt;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
// Smooth value noise in world metres. Fixed per place, so a hill keeps its look.
function noise(x,z,scale,salt){const u=x/scale,v=z/scale,gx=Math.floor(u),gz=Math.floor(v),a=smooth(u-gx),b=smooth(v-gz);return mix(mix(hash(gx,gz,salt),hash(gx+1,gz,salt),a),mix(hash(gx,gz+1,salt),hash(gx+1,gz+1,salt),a),b);}
// sRGB hex to linear floats, as the renderer's vertex colours expect.
function linear(hex){return[(hex>>16)&255,(hex>>8)&255,hex&255].map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);});}
const lerp3=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];

// ---- Land cover from OpenMapTiles (https://openmaptiles.org/schema/) ----
const COVERS=['wood','farmland','orchard','meadow','heath','scrub','rock','scree','sand','wetland','ice','urban','sport','park'];
// Higher wins where mapped shapes overlap: a wood inside a park is a wood.
const PRIORITY={ice:9,wood:8,rock:7,scree:6,sand:6,wetland:5,orchard:4,farmland:4,sport:3,urban:2,park:2,scrub:1,heath:1,meadow:0};
const URBAN=['residential','commercial','industrial','retail','garages','railway','school','university','college','kindergarten','hospital','library','bus_station','military','suburb','quarter','neighbourhood'];
function cover(feature){
 if(!/^(Polygon|MultiPolygon)$/.test(feature?.geometry?.type))return null;
 const p=feature.properties||{},layer=feature.sourceLayer||feature['source-layer'],cls=String(p.class||'').toLowerCase(),sub=String(p.subclass||'').toLowerCase();
 if(layer==='landcover'){
  if(cls==='wood')return'wood';
  if(cls==='farmland')return /orchard|vineyard|plant_nursery/.test(sub)?'orchard':'farmland';
  if(cls==='rock')return sub==='scree'?'scree':'rock';
  if(cls==='sand')return'sand';
  if(cls==='wetland')return'wetland';
  if(cls==='ice')return'ice';
  if(cls==='grass'){
   if(['heath','fell','tundra'].includes(sub))return'heath';
   if(['scrub','shrubbery'].includes(sub))return'scrub';
   if(['golf_course','recreation_ground'].includes(sub))return'sport';
   if(['park','garden','allotments','flowerbed','village_green'].includes(sub))return'park';
   return'meadow';
  }
  return null;
 }
 if(layer==='landuse'){
  if(cls==='forest')return'wood';
  if(cls==='quarry')return'rock';
  if(['pitch','stadium','track','playground'].includes(cls))return'sport';
  if(cls==='cemetery')return'park';
  if(URBAN.includes(cls))return'urban';
 }
 return null;
}
function stronger(a,b){return !b||(PRIORITY[a]??-1)>(PRIORITY[b]??-1)?a:b;}

// ---- Season and climate, from the real date and latitude ----
// Day-of-year weights for each season. The south is six months apart and the
// tropics stay in a mild summer.
function season(date=new Date(),lat=50){
 const start=Date.UTC(date.getUTCFullYear(),0,1),day=((date.getTime()-start)/86400000+(lat<0?182.5:0))%365;
 const peak=d=>Math.max(0,Math.cos((day-d)/365*Math.PI*2));
 const raw={winter:peak(15),spring:peak(105),summer:peak(197),autumn:peak(288)};
 if(Math.abs(lat)<23){const t=Math.abs(lat)/23;for(const k of Object.keys(raw))raw[k]*=t;raw.summer+=1-t;}
 const total=raw.winter+raw.spring+raw.summer+raw.autumn||1;
 return{winter:raw.winter/total,spring:raw.spring/total,summer:raw.summer/total,autumn:raw.autumn/total,day};
}
// Rough natural treeline by latitude; the damp, windy British uplands sit low.
const TREELINE=[[0,3900],[25,3600],[35,3000],[42,2400],[47,2000],[50,1300],[53,760],[56,600],[60,750],[65,550],[70,300],[75,0]];
function table(rows,x){x=Math.abs(x);for(let i=1;i<rows.length;i++)if(x<=rows[i][0]){const [a,ya]=rows[i-1],[b,yb]=rows[i];return mix(ya,yb,(x-a)/(b-a));}return rows[rows.length-1][1];}
function treeline(lat){return table(TREELINE,lat);}
// Lying snow: the summer line sits near the treeline plus a margin; winter
// brings it far lower.
function snowline(lat,seasons){const summer=treeline(lat)+900+Math.max(0,20-Math.abs(lat))*60,winter=Math.max(0,treeline(lat)-250);return mix(summer,winter,clamp(seasons.winter+seasons.autumn*.25+seasons.spring*.35,0,1));}

// ---- Ground colours (sRGB design values, linear at runtime) ----
const HEX={meadow:0x6c9a44,meadowDry:0x8f9a4c,pasture:0x679443,rough:0x7f8b50,moor:0x86854f,moorAutumn:0x9c8752,heath:0x655e45,heather:0x7a5a78,bracken:0x6c8b3b,brackenRust:0xa2652f,scrub:0x5b7338,woodFloor:0x4a6232,litter:0x6d5733,
 crops:[0x6f9a45,0x7fa84c,0x659240,0x8db052,0x76a048,0xc9b458,0x6a9442,0x9c7a4f],cropsAutumn:[0x6c9444,0x7a9f48,0x62903f,0x86a04c,0x6f9a45,0xc2a86a,0x6a9442,0x8a6a45],orchard:0x769b49,
 rock:0x8b8982,slate:0x6b6c68,pale:0xaeaaa0,scree:0x9a968c,cliff:0x6c6962,sand:0xd6c28f,wetland:0x56663a,peat:0x5e5238,snow:0xeef1f4,urban:0x7a9a55,sport:0x5fa845,park:0x6fa04a,road:0x9b8b6c,winterGrass:0x76844f,springGrass:0x7aab4a};
const C={};for(const [k,v] of Object.entries(HEX))C[k]=Array.isArray(v)?v.map(linear):linear(v);

// Unmapped land keeps Alderwing's own dense woodland: most of it where the
// map records nothing nearby, and still close to half where the map records
// plenty, in a natural mosaic with meadow and scrub.
function unmapped(n,openBias){
 const wood=mix(.68,.46,openBias);
 if(n.large<wood)return'woodland';
 if(n.large<wood+mix(.1,.14,openBias)&&n.patch>.5)return'scrub';
 return'meadow';
}
// One sample of the living ground. Inputs are metres and plain numbers:
// altitude above sea, slope (rise over run), mapped cover, water nearness
// (0 dry to 1 at the bank), noise fields and the season.
function sample({altitude=0,slope=0,cover:mapped=null,wet=0,lat=50,seasons=season(),openBias=0,x=0,z=0,field=0}={}){
 const n={patch:noise(x,z,48,409),large:noise(x,z,190,977),grain:hash(Math.floor(x/5),Math.floor(z/5),853),fine:noise(x,z,9,131),bloom:noise(x,z,23,557),copse:noise(x,z,40,613)};
 const line=treeline(lat),snow=snowline(lat,seasons),alpine=smooth((altitude-line*.72)/(line*.35+80)),above=smooth((altitude-line)/(line*.12+60));
 let kind=mapped||unmapped(n,openBias);
 if(!mapped&&kind==='woodland'&&altitude>line*.8)kind=n.patch>.5?'heath':'meadow';
 if(!mapped&&kind==='meadow'&&alpine>.5&&n.patch>.55)kind='heath';
 const autumn=seasons.autumn,winter=seasons.winter,spring=seasons.spring,copse=smooth((n.copse-.68)/.12);
 let ground,trees=0,shrubs=0,flora=0,rocks=0,rockiness=0;
 const species={pine:0,spruce:0,oak:0,birch:0,hawthorn:0,dead:0};
 const plants={grass:0,flowers:0,fern:0,heather:0,gorse:0,bush:0,reeds:0,mushroom:0,log:0,stone:0};
 const grass=lerp3(lerp3(lerp3(C.meadow,C.springGrass,spring),C.meadowDry,autumn*.55),C.winterGrass,winter);
 switch(kind){
  case'wood':case'woodland':{
   ground=lerp3(C.woodFloor,C.litter,autumn*.6+winter*.3);trees=kind==='wood'?.97:.92;shrubs=.18;flora=.35;
   const conifer=clamp(.25+alpine*.5+(n.large-.5)*.6,0,.9);
   species.pine=conifer*.45;species.spruce=conifer*.55;species.oak=(1-conifer)*(.55-wet*.3);species.birch=(1-conifer)*(.3+wet*.4)+alpine*.2;species.hawthorn=(1-conifer)*.1;species.dead=.03;
   plants.fern=.34;plants.bush=.14;plants.mushroom=.015+autumn*.035;plants.log=.05;plants.grass=.2;plants.flowers=.06+spring*.2;plants.stone=.05;break;}
  case'meadow':case'park':case'sport':case'urban':{
   const mowed=kind!=='meadow';
   ground=kind==='sport'?C.sport:kind==='urban'?lerp3(C.urban,grass,.4):kind==='park'?lerp3(C.park,grass,.3):lerp3(grass,C.rough,alpine*.8);
   // Copses and hedgerow trees dot open country, as they do in real fields.
   trees=(mowed?.05:.06+(1-alpine)*.03)+copse*(mowed?.35:.85);shrubs=mowed?.03:.07;flora=mowed?.2:.95;
   species.oak=.5;species.hawthorn=.3;species.birch=.15+alpine*.3;species.pine=.05;
   plants.grass=mowed?.5:.55;plants.flowers=mowed?.12:.3+spring*.2-winter*.25;plants.bush=.08;plants.stone=.04+alpine*.1;break;}
  case'heath':{
   // Moor grass with patches of heather, which blooms purple in late summer
   // and turns rusty after; bracken browns on the steeper banks in autumn.
   const patch=clamp(n.bloom*1.7-.45,0,1),bloom=Math.exp(-Math.pow((seasons.day-228)/22,2));
   const moor=lerp3(C.moor,C.moorAutumn,clamp(autumn*1.3-.2,0,1)+winter*.5),heather=lerp3(C.heath,C.heather,bloom*.8);
   const bracken=lerp3(C.bracken,C.brackenRust,clamp(autumn*1.6-.7,0,1)+winter*.8);
   ground=lerp3(lerp3(moor,heather,patch*.75),bracken,clamp(slope*1.6-.2,0,.55)*(1-patch));trees=.035+copse*.55*(1-alpine);shrubs=.12;flora=.9;
   species.hawthorn=.4;species.birch=.35;species.pine=.2;species.dead=.05;
   plants.heather=.45*patch+.08;plants.fern=.3*(1-patch);plants.grass=.35;plants.gorse=.08;plants.stone=.1;break;}
  case'scrub':{ground=lerp3(C.scrub,grass,.3);trees=.3;shrubs=.5;flora=.7;species.hawthorn=.5;species.birch=.3;species.oak=.2;plants.gorse=.3;plants.bush=.35;plants.grass=.3;plants.fern=.15;plants.flowers=.08;break;}
  case'farmland':case'orchard':{
   const tones=autumn>.45?C.cropsAutumn:C.crops,pick=tones[Math.floor(hash(field|0,7,311)*tones.length)%tones.length];
   ground=kind==='orchard'?C.orchard:lerp3(pick,grass,winter*.5);trees=kind==='orchard'?.45:.015+copse*.6;shrubs=.01;flora=kind==='orchard'?.4:.15;
   species.oak=.6;species.hawthorn=.4;plants.grass=.7;plants.flowers=.12;break;}
  case'rock':case'scree':{
   const tone=n.large<.33?C.slate:n.large>.7?C.pale:C.rock;ground=kind==='scree'?lerp3(C.scree,tone,.35):tone;rockiness=kind==='scree'?.8:1;
   trees=.008;shrubs=.02;flora=.25;rocks=kind==='scree'?.9:.6;species.birch=.6;species.hawthorn=.4;plants.stone=.7;plants.grass=.25;plants.heather=.05;break;}
  case'sand':{ground=C.sand;rockiness=.4;flora=.18;plants.grass=.8;plants.stone=.05;break;}
  case'wetland':{ground=lerp3(C.wetland,C.peat,n.patch*.6);trees=.14;shrubs=.05;flora=.8;species.birch=.7;species.dead=.2;species.hawthorn=.1;plants.reeds=.5;plants.grass=.3;plants.flowers=.12;break;}
  case'ice':{ground=C.snow;rockiness=.2;break;}
  default:ground=grass;
 }
 // Real slope: cliffs are bare rock, steep banks thin the trees.
 const steep=smooth((slope-.62)/.45),cliff=smooth((slope-.95)/.5);
 if(kind!=='ice'){ground=lerp3(ground,lerp3(C.rock,C.cliff,cliff),steep*.85);rockiness=Math.max(rockiness,steep);}
 trees*=1-smooth((slope-.45)/.4);shrubs*=1-cliff;flora*=1-steep*.7;rocks=Math.max(rocks,steep*.45);
 // Above the treeline: open fell, then rock and lying snow.
 trees*=1-above;if(alpine>0&&!['rock','scree','ice','sand'].includes(kind))ground=lerp3(ground,C.rough,alpine*.35);
 const snowCover=kind==='ice'?1:smooth((altitude-snow)/120)*(1-cliff*.6);
 if(snowCover>0){ground=lerp3(ground,C.snow,snowCover);flora*=1-snowCover;shrubs*=1-snowCover;}
 // Damp ground by streams and lakes is lusher and hosts reeds.
 if(wet>0&&!['rock','scree','ice','sand'].includes(kind)){ground=lerp3(ground,lerp3(C.meadow,C.wetland,.4),wet*.35);plants.reeds=Math.max(plants.reeds,wet*.35);}
 // Fine grain keeps large areas from looking painted.
 const g=.9+n.grain*.14+(n.fine-.5)*.1;ground=ground.map(v=>v*g);
 return{kind,ground,rockiness,trees,shrubs,flora,rocks,species,plants,snow:snowCover,alpine,seasons,bloom:Math.exp(-Math.pow((seasons.day-228)/22,2))};
}
function pick(weights,r){let total=0;for(const w of Object.values(weights))total+=Math.max(0,w);if(!(total>0))return null;let t=r*total;for(const [k,w] of Object.entries(weights)){t-=Math.max(0,w);if(t<=0)return k;}return Object.keys(weights).pop();}
// Deterministic scatter on a jittered metre grid. IDs and positions never
// depend on the viewer, so a flower stays put across visits.
function scatter(cell,size,spacing,salt,shift={x:0,z:0}){
 const rows=[];
 for(let gx=Math.floor((cell.x+shift.x)/spacing);gx<=Math.floor((cell.x+size+shift.x)/spacing);gx++)for(let gz=Math.floor((cell.z+shift.z)/spacing);gz<=Math.floor((cell.z+size+shift.z)/spacing);gz++){
  const x=(gx+.1+hash(gx,gz,salt)*.8)*spacing-shift.x,z=(gz+.1+hash(gx,gz,salt+7)*.8)*spacing-shift.z;
  if(x<cell.x||x>=cell.x+size||z<cell.z||z>=cell.z+size)continue;
  rows.push({id:salt+':'+gx+':'+gz,x,z,a:hash(gx,gz,salt+13),b:hash(gx,gz,salt+17),c:hash(gx,gz,salt+19),d:hash(gx,gz,salt+23)});
 }
 return rows;
}
// Autumn and winter colour for broadleaf crowns; conifers keep their needles.
function crownTint(kind,seasons,r){
 if(kind==='pine'||kind==='spruce')return[1,1,1];
 const autumn=clamp(seasons.autumn*2-1.1,0,1),turn=r<.4?[1.55,1.05,.45]:r<.75?[1.35,.8,.35]:[1.7,1.3,.4];
 const t=autumn*(kind==='birch'?1:.8),bare=seasons.winter;
 return[mix(1,turn[0],t)*mix(1,.7,bare),mix(1,turn[1],t)*mix(1,.62,bare),mix(1,turn[2],t)*mix(1,.5,bare)];
}
// The colour a wood shows from afar: its crowns, mixed by species and season.
const CROWNS={pine:0x42653a,spruce:0x36573a,oak:0x4d6d34,birch:0x86a04a,hawthorn:0x58703a,dead:0x7b7166};
function canopyColor(species,seasons){let r=0,g=0,b=0,total=0;for(const [kind,w] of Object.entries(species||{})){if(!(w>0)||!CROWNS[kind])continue;const c=linear(CROWNS[kind]),t=crownTint(kind,seasons,.5);r+=c[0]*t[0]*w;g+=c[1]*t[1]*w;b+=c[2]*t[2]*w;total+=w;}return total?[r/total*.86,g/total*.86,b/total*.86]:linear(CROWNS.oak);}
const FLOWERS=[0xf4efe0,0xf2cf3a,0x9b6fd0,0xd8453b,0x5e7fd6,0xf09bc0];
function flowerColor(r,seasons){const i=Math.floor(r*FLOWERS.length)%FLOWERS.length;return linear(seasons.autumn>.5&&i===4?FLOWERS[1]:FLOWERS[i]);}
return{COVERS,PRIORITY,cover,stronger,season,treeline,snowline,sample,pick,scatter,crownTint,canopyColor,flowerColor,noise,hash,linear,smooth};
});
