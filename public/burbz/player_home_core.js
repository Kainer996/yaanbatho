/* Personal home state and placement rules. Proposals are committed by the game adapter. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzPlayerHomeCore=api;})(globalThis,function(){'use strict';
 const ITEMS={bench:{name:'Oak bench',type:'bench',area:'yard',w:1.8,d:.75,timber:8},flowers:{name:'Wildflower pot',type:'planter',area:'both',w:.7,d:.7,timber:3},lantern:{name:'Lantern post',type:'lantern',area:'yard',w:.5,d:.5,timber:5},birdbath:{name:'Stone birdbath',type:'birdbath',area:'yard',w:1,d:1,timber:10},rug:{name:'Woven rug',type:'rug',area:'room',w:1.7,d:2,timber:4,flat:true},chair:{name:'Reading chair',type:'armchair',area:'room',w:1,d:1,timber:7},books:{name:'Bookshelf',type:'shelf',area:'room',w:1.6,d:.6,timber:10},table:{name:'Tea table',type:'teatable',area:'both',w:1.3,d:1.3,timber:7}};
 Object.assign(ITEMS,{
 fern:{name:'Copper fern pot',type:'fern',area:'both',w:.8,d:.8,timber:4},cypress:{name:'Potted cypress',type:'cypress',area:'both',w:.9,d:.9,timber:7},rose:{name:'Climbing rose',type:'rose',area:'yard',w:1.3,d:.7,timber:8},herbs:{name:'Raised herb bed',type:'herbs',area:'yard',w:1.8,d:1.1,timber:9},trellis:{name:'Ivy lattice',type:'trellis',area:'yard',w:1.6,d:.55,timber:9},arch:{name:'Garden arch',type:'arch',area:'yard',w:2.3,d:.8,timber:14},pond:{name:'Lily pond',type:'pond',area:'yard',w:2.4,d:2.4,timber:16},well:{name:'Wishing well',type:'well',area:'yard',w:1.5,d:1.5,timber:18},picnic:{name:'Picnic table',type:'picnic',area:'yard',w:2.1,d:1.7,timber:14},beehive:{name:'Straw skep',type:'beehive',area:'yard',w:.9,d:.9,timber:8},logpile:{name:'Covered log rack',type:'logpile',area:'yard',w:1.6,d:.9,timber:6},feeder:{name:'Little bird shelter',type:'feeder',area:'yard',w:1,d:1,timber:9},sundial:{name:'Brass sundial',type:'sundial',area:'yard',w:.9,d:.9,timber:11},bridge:{name:'Garden footbridge',type:'bridge',area:'yard',w:2,d:1.2,timber:14},
 sofa:{name:'Velvet settee',type:'sofa',area:'room',w:2,d:1,timber:16},bedside:{name:'Bedside chest',type:'bedside',area:'room',w:.8,d:.7,timber:6},wardrobe:{name:'Carved wardrobe',type:'wardrobe',area:'room',w:1.5,d:.8,timber:15},writingdesk:{name:'Letter-writing desk',type:'writingdesk',area:'room',w:1.7,d:.9,timber:12},globe:{name:'Alderwing globe',type:'globe',area:'room',w:.9,d:.9,timber:11},loom:{name:'Weaver’s loom',type:'loom',area:'room',w:1.6,d:.85,timber:16},piano:{name:'Little spinet',type:'piano',area:'room',w:1.7,d:.9,timber:20},display:{name:'Keepsake cabinet',type:'display',area:'room',w:1.3,d:.65,timber:12},workbench:{name:'Carpenter’s bench',type:'workbench',area:'room',w:1.9,d:.9,timber:13},potting:{name:'Potting table',type:'potting',area:'both',w:1.7,d:.8,timber:10}
 });
 const YARD_SCALE=Math.SQRT2,YARD={ground:16*YARD_SCALE,walk:14.3*YARD_SCALE,decorate:10*YARD_SCALE},MAX_PER_SPACE=32,MAX_PLACED=96;
 const ROOMS={
 library:{name:'Keeper’s library',timber:28,accent:0x557e8a,doorZ:-2.5,description:'A quiet reading room with shelves, an old globe and the keeper’s collected stories.',activity:'Read the keeper’s collection',lore:'The oldest shelf holds no grand prophecies. Its books record small things: a shared meal, a mended nest, a traveller welcomed home. The keeper marked every one as a kind of magic.'},
 conservatory:{name:'Sunlit conservatory',timber:34,accent:0x789568,doorZ:0,description:'A glass-lined garden room for arranging plants and planning your clearing.',activity:'Visit the potting bench',lore:'Little labels describe invented Alderwing plants: moonmint, lanternleaf and the wonderfully ordinary hopeful bean. The gardener’s note says that looking after a place is also a way of looking after yourself.'},
 workshop:{name:'Maker’s workshop',timber:42,accent:0xb18a62,doorZ:2.5,description:'A timber workshop with tools and a model home, ready for your next decoration.',activity:'Plan a new decoration',lore:'A tiny model of your home sits among wood shavings. Under it someone has written: “Measure twice. Make something kind. A little crooked is allowed.”'}
 };
 const indoor=area=>area==='room'||Object.hasOwn(ROOMS,area);
 const roomOpen=(s,area)=>area==='room'||!!s.rooms?.[area];
 const roomPath=id=>({x:2.25,z:ROOMS[id].doorZ,w:4.1,d:1.15});
 const extraFixed=[{x:0,z:-2.8,w:2,d:1},{x:-2.8,z:-1.3,w:.7,d:2},{x:-2.9,z:-2.8,w:1,d:1}];
 const dayKey=now=>new Date(Number.isFinite(now)?now:Date.now()).toISOString().slice(0,10);
 const treeState=(s,id,now)=>{const t=s.trees?.[id];return t?.day===dayKey(now)?t.hits:0;};

 const TIERS=[{name:'Shelter',timber:0},{name:'Cosy cottage',timber:25},{name:'Alderwing hearthhome',timber:60}];
 const FINDS=[
 {id:'welcome-stone',area:'yard',x:-6,z:3,name:'The welcome stone',text:'The old letters read: “A house remembers every kindness done beneath its roof.” Someone has tucked a feather beneath the moss.'},
 {id:'tiny-door',area:'yard',x:7,z:-5,name:'A door for someone smaller',text:'Three tiny knocks answer yours. A voice whispers, “Finally. A neighbour who knocks.” You leave the little door closed.'},
 {id:'moon-pool',area:'yard',x:-6,z:-7,name:'The moon in the water',text:'The bowl reflects two moons, even in daylight. Merlin says the smaller one is a memory of Alderwing’s first sky.'},
 {id:'lost-pot',area:'yard',x:6,z:6,name:'A gift under the roots',text:'A forgotten flowerpot holds a note: “For whoever makes this place a home.” The pot is yours to decorate with.',gift:'flowers'},
 {id:'desk-note',area:'room',x:2.8,z:-3.5,name:'The first keeper’s note',text:'“This glass connects places, not wires. Sit, open it, and the whole of Alderwing is only a thought away.”'},
 {id:'hearth-song',area:'room',x:-3.5,z:-1,name:'A song in the chimney',text:'The chimney hums three gentle notes. Merlin hums a fourth, then looks very pleased with himself.'},
 {id:'floor-star',area:'room',x:3.5,z:2.7,name:'The star beneath the floor',text:'One brass nail has seven points. When you touch it, a little constellation flickers across the timber.'},
 {id:'merlin-acorn',area:'yard',x:0,z:-9,name:'Merlin’s important treasure',text:'An acorn wears a very small paper crown. “The king of the forest,” Merlin explains. “Do be polite.”'}
 ];
 const TREES=Array.from({length:28},(_,i)=>{const a=i*2.399963,r=(10.8+(i%4)*1.1)*YARD_SCALE;return{id:'tree-'+i,x:Math.sin(a)*r,z:Math.cos(a)*r,r:.38+(i%3)*.07};});
 for(const [id,r] of Object.entries(ROOMS))FINDS.push({id:id+'-story',area:id,x:0,z:-2.8,name:r.activity,text:r.lore});
 const visibleTrees=s=>s.outlook?TREES.filter(t=>!(t.z>7&&Math.abs(t.x)<11)):TREES;
 // The Academy grows as a tree beside the built house: a little taller than
 // the woodland, with the player's own Academy buildings on its boughs.
 // `clear` keeps its roots and low treehouses free of furniture and plots;
 // `walk` stops the player walking into the trunk, roots and low houses. Its spot is chosen once, clear of
 // anything already in the garden, and saved with the next change.
 const ACADEMY_TREE={clear:3.6,walk:3.3,spots:[{x:-8,z:-2.5},{x:8.5,z:1},{x:-9.5,z:-9.5},{x:9.5,z:-9.5},{x:-10,z:6},{x:10,z:7}]};
 const academyBox=t=>({x:t.x,z:t.z,w:ACADEMY_TREE.clear*2,d:ACADEMY_TREE.clear*2});
 function academySpotClear(s,p){const b=academyBox(p);if(Math.hypot(p.x,p.z)+ACADEMY_TREE.clear>YARD.decorate+2||overlap(b,houseFootprint({...s,tier:Math.max(1,s.tier)}))||overlap(b,{x:0,z:5,w:2,d:6})||FINDS.filter(f=>f.area==='yard').some(f=>overlap(b,{...f,w:1.3,d:1.3}))||visibleTrees(s).some(t=>overlap(b,{...t,w:t.r*2+.5,d:t.r*2+.5})))return false;return !(s.placed||[]).some(q=>q.area==='yard'&&overlap(b,bounds(q),.1))&&!(s.farm?.plots||[]).some(q=>overlap(b,{...q,w:2,d:2},.1));}
 function pickAcademySpot(s){for(const p of ACADEMY_TREE.spots)if(academySpotClear(s,p))return{...p};for(let ring=5;ring<=11;ring++)for(let i=0;i<24;i++){const a=i*Math.PI/12+ring,p={x:Math.round(Math.sin(a)*ring*2)/2,z:Math.round(Math.cos(a)*ring*2)/2};if(academySpotClear(s,p))return p;}return null;}
 const academyTree=s=>s.tier>0&&s.academyTree?s.academyTree:null;
 const academyBlocks=(s,b)=>{const t=academyTree(s);return !!t&&overlap(b,academyBox(t));};
 const roomLayout=s=>s.tier>0?{width:9,depth:10,height:3.6,deskZ:-3.45,standZ:-1.05,spawnZ:3.8,doorZ:4.3}:{width:3.4,depth:4.6,height:2.95,deskZ:-1.45,standZ:.95,spawnZ:1.65,doorZ:2};
 const roomFixed=s=>s.tier?FIXED:[{...FIXED[0],z:roomLayout(s).deskZ}];
 const houseFootprint=s=>({x:0,z:0,w:s.tier?5.5:3.6,d:s.tier?4.5:4.8});
 const groundProfile=s=>({radius:s.tier===0?12:s.outlook?36:YARD.ground,blendRadius:s.tier===0?20:s.outlook?60:YARD.ground+8});
 const FIXED=[{x:0,z:-3.45,w:2.7,d:1.25},{x:-3.5,z:-1,w:1,d:1.8}];
 const MAX_MAP_LAT=85.0511287798066;
 function normalizeAnchor(value){if(!value||typeof value!=='object'||!Number.isFinite(value.lat)||!Number.isFinite(value.lon)||Math.abs(value.lat)>MAX_MAP_LAT||Math.abs(value.lon)>180||!Number.isSafeInteger(value.revision)||value.revision<1||!['initial','chosen'].includes(value.source))return null;return{lat:value.lat,lon:value.lon,revision:value.revision,source:value.source};}
 function initial(veteran=false){return{version:3,outlook:true,anchor:null,rooms:{},trees:{},intro:veteran?'done':'welcome',arrival:veteran?'done':'home',tier:0,owned:{bench:1,flowers:1,rug:1},placed:[],finds:[],nextId:1,academyTree:null,farm:{version:1,plots:[],seeds:{},nextId:1}};}
 function normalize(value,veteran=false){const v=value&&typeof value==='object'?value:{},s=initial(veteran);s.intro=['welcome','house','desk','done'].includes(v.intro)?v.intro:s.intro;s.tier=Number.isInteger(v.tier)?Math.max(0,Math.min(2,v.tier)):0;s.owned={};for(const id of Object.keys(ITEMS))s.owned[id]=Number.isSafeInteger(v.owned?.[id])?Math.max(0,Math.min(100,v.owned[id])):(value?0:s.owned[id]||initial().owned[id]||0);s.finds=FINDS.filter(f=>v.finds?.includes(f.id)).map(f=>f.id);s.nextId=Number.isSafeInteger(v.nextId)&&v.nextId>0?v.nextId:1;
 s.outlook=value?v.outlook===true:true;
 s.anchor=normalizeAnchor(v.anchor);
 s.arrival=['home','shack','outside','done'].includes(v.arrival)?v.arrival:v.intro==='done'||s.tier>0||veteran?'done':'home';
 for(const id of Object.keys(ROOMS))if(v.rooms?.[id]===true)s.rooms[id]=true;
 for(const t of TREES){const h=v.trees?.[t.id];if(h&&/^\d{4}-\d{2}-\d{2}$/.test(h.day)&&Number.isInteger(h.hits)&&h.hits>=1&&h.hits<=3)s.trees[t.id]={day:h.day,hits:h.hits};}
 for(const p of Array.isArray(v.placed)?v.placed.slice(0,MAX_PLACED):[]){if(!Number.isSafeInteger(p.id)||p.id<1||s.placed.some(o=>o.id===p.id)||!ITEMS[p.item]||s.placed.filter(o=>o.item===p.item).length>=s.owned[p.item])continue;const q={id:p.id,item:p.item,area:p.area,x:p.x,z:p.z,turn:Number.isInteger(p.turn)?((p.turn%4)+4)%4:0};if(s.placed.filter(o=>o.area===q.area).length<MAX_PER_SPACE&&validPlacement(s,q).ok){s.placed.push(q);s.nextId=Math.max(s.nextId,p.id+1);}}
 s.farm=normalizeFarm(v.farm,s);
 // A saved spot stays put; otherwise the first clear spot is chosen now.
 const saved=v.academyTree;s.academyTree=s.tier<1?null:saved&&Number.isFinite(saved.x+saved.z)&&Math.hypot(saved.x,saved.z)<=YARD.decorate?{x:saved.x,z:saved.z}:pickAcademySpot(s);return s;}
 function bounds(p){const i=ITEMS[p.item];return{x:p.x,z:p.z,w:p.turn%2?i.d:i.w,d:p.turn%2?i.w:i.d};}
 function overlap(a,b,gap=.2){return Math.abs(a.x-b.x)<(a.w+b.w)/2+gap&&Math.abs(a.z-b.z)<(a.d+b.d)/2+gap;}
 function validPlacement(s,p){const item=ITEMS[p.item],inside=indoor(p.area);if(!item||!['yard','room',...Object.keys(ROOMS)].includes(p.area)||inside&&!roomOpen(s,p.area)||item.area!=='both'&&item.area!==(inside?'room':'yard'))return{ok:false,error:'Choose furniture for a room you have built.'};if(!Number.isFinite(p.x+p.z)||Math.abs(p.x*2-Math.round(p.x*2))>.001||Math.abs(p.z*2-Math.round(p.z*2))>.001)return{ok:false,error:'Choose a space on the ground.'};const b=bounds(p);
 if(inside){const main=p.area==='room',halfX=main?roomLayout(s).width/2-.3:3.7,halfZ=main?roomLayout(s).depth/2-.4:3.7;if(Math.abs(p.x)+b.w/2>halfX||Math.abs(p.z)+b.d/2>halfZ)return{ok:false,error:'Keep furniture inside the walls.'};const fixed=main?roomFixed(s):extraFixed,path=main?{x:0,z:1.5,w:1.5,d:6.5}:{x:0,z:.6,w:1.5,d:5.6};if(!item.flat&&(fixed.some(f=>overlap(b,f))||overlap(b,path)||main&&Object.keys(ROOMS).some(id=>s.rooms[id]&&overlap(b,roomPath(id)))))return{ok:false,error:'Leave a clear path to the desk, room doors and reading tables.'};}
 else if(Math.hypot(p.x,p.z)+Math.hypot(b.w,b.d)/2>YARD.decorate||overlap(b,houseFootprint(s))||overlap(b,{x:0,z:5,w:2,d:6})||FINDS.filter(f=>f.area==='yard').some(f=>overlap(b,{...f,w:1.3,d:1.3}))||visibleTrees(s).some(t=>overlap(b,{...t,w:t.r*2+.5,d:t.r*2+.5})))return{ok:false,error:'Keep the house, path, tree roots and little discoveries clear.'};
 else if(academyBlocks(s,b))return{ok:false,error:'Keep the Academy tree’s roots clear.'};
 if(p.area==='yard'&&s.farm?.plots.some(q=>overlap(b,{...q,w:2,d:2},0)))return{ok:false,error:'Keep your growing plots clear.'};
 if(s.placed.some(q=>q.id!==p.id&&q.area===p.area&&!ITEMS[q.item].flat&&!item.flat&&overlap(b,bounds(q))))return{ok:false,error:'There is already furniture in that space.'};return{ok:true};}

 // Farming uses ordinary inventory ingredients and a saved seed box. Growth
 // begins when watered, continues offline, and never spoils an absent player's crop.
 const CROPS={
  reed:{name:'River reeds',seedName:'Reed cuttings',icon:'🌾',minutes:20,coins:4,store:'items',item:'river_reed',yield:3,color:0x9daa61,copy:'Grow supple stems for arrows and woven equipment.'},
  sunflower:{name:'Sunflowers',seedName:'Sunflower seeds',icon:'🌻',minutes:30,coins:5,store:'larder',item:'sunflower_seeds',yield:3,color:0xeac348,copy:'Golden flowers with seeds for your seed-eating birds.'},
  berries:{name:'Berry bushes',seedName:'Berry seeds',icon:'🫐',minutes:45,coins:6,store:'larder',item:'hedgerow_berries',yield:3,color:0x7775b2,copy:'A little hedgerow harvest for your Kitchen.'},
  pondweed:{name:'Pondweed',seedName:'Pondweed cuttings',icon:'🌿',minutes:15,coins:3,store:'larder',item:'pondweed_tangle',yield:3,color:0x76a777,copy:'A shallow water bed of greens for waterbirds.'}
 };
 const FARM={size:2,max:64,timber:2,radius:YARD.walk-.5};
 const count=n=>Number.isSafeInteger(n)&&n>=0?n:0;
 const validTime=n=>Number.isSafeInteger(n)&&n>0&&n<8640000000000000;
 function farmStatus(p,now=Date.now()){const c=CROPS[p?.crop];if(!c)return{stage:'empty',progress:0,remaining:0};if(!p.wateredAt)return{stage:'dry',progress:0,remaining:c.minutes*60000};const elapsed=Math.max(0,now-p.wateredAt),progress=Math.min(1,elapsed/(c.minutes*60000));return{stage:progress>=1?'ready':progress>=.65?'flower':progress>=.25?'growing':'sprout',progress,remaining:Math.max(0,c.minutes*60000-elapsed)};}
 function validPlot(home,p){if(!Number.isSafeInteger(p.x)||!Number.isSafeInteger(p.z)||p.x%2||p.z%2||Math.hypot(p.x,p.z)+Math.SQRT2>FARM.radius)return{ok:false,error:'Choose a square inside your clearing.'};
 const b={...p,w:2,d:2};if(overlap(b,houseFootprint(home))||overlap(b,{x:0,z:5,w:2,d:6})||FINDS.filter(f=>f.area==='yard').some(f=>overlap(b,{...f,w:1.3,d:1.3}))||visibleTrees(home).some(t=>overlap(b,{...t,w:t.r*2+.5,d:t.r*2+.5})))return{ok:false,error:'Leave the house, paths, trees and discoveries clear.'};
 if(academyBlocks(home,b))return{ok:false,error:'Leave the Academy tree’s roots clear.'};
 if(home.placed.some(q=>q.area==='yard'&&overlap(b,bounds(q),.1)))return{ok:false,error:'Move the garden furniture before making a plot here.'};if(home.farm?.plots.some(q=>q.id!==p.id&&q.x===p.x&&q.z===p.z))return{ok:false,error:'There is already a plot here.'};return{ok:true};}
 function normalizeFarm(raw,home){const farm={version:1,plots:[],seeds:{},nextId:Math.max(1,count(raw?.nextId))};for(const id of Object.keys(CROPS))farm.seeds[id]=Math.min(999,count(raw?.seeds?.[id]));
 for(const p of Array.isArray(raw?.plots)?raw.plots.slice(0,FARM.max):[]){if(!Number.isSafeInteger(p.id)||p.id<1||p.id>=Number.MAX_SAFE_INTEGER||farm.plots.some(q=>q.id===p.id)||!validPlot({...home,farm},p).ok)continue;const q={id:p.id,x:p.x,z:p.z,crop:null,plantedAt:0,wateredAt:0};if(CROPS[p.crop]&&validTime(p.plantedAt)){q.crop=p.crop;q.plantedAt=p.plantedAt;q.wateredAt=validTime(p.wateredAt)&&p.wateredAt>=p.plantedAt?p.wateredAt:0;}farm.plots.push(q);farm.nextId=Math.max(farm.nextId,p.id+1);}return farm;}
 function farmKey(home,now=Date.now()){return JSON.stringify((home?.farm?.plots||[]).map(p=>[p.id,p.x,p.z,p.crop,p.wateredAt,farmStatus(p,now).stage]));}
 function proposeFarm(home,wallet,inventory,action,now=Date.now()){
  const s=normalize(home),w={branches:wallet?.branches,coins:wallet?.coins},inv={...inventory,items:{...inventory?.items},larder:{...inventory?.larder}},fail=error=>({ok:false,error});
  if(!action||!validTime(now))return fail('Your farm could not be updated.');if(s.tier<1)return fail('Build your cottage before starting a farm.');
  if(action.expectedRevision!==undefined&&action.expectedRevision!==s.anchor?.revision)return fail('Your home moved. Reopen Build to use its new garden.');
  const pay=(key,n)=>Number.isSafeInteger(w[key])&&w[key]>=n?(w[key]-=n,true):false;
  const plot=s.farm.plots.find(p=>p.id===action.id),crop=CROPS[action.crop];let message='';
  if(action.kind==='farm-plot'){if(s.farm.plots.length>=FARM.max)return fail('Your farm holds up to '+FARM.max+' plots.');const p={id:s.farm.nextId,x:action.x,z:action.z,crop:null,plantedAt:0,wateredAt:0};const valid=validPlot(s,p);if(!valid.ok)return valid;if(!Number.isSafeInteger(p.id+1))return fail('Your plots could not be counted.');if(!pay('branches',FARM.timber))return fail('A growing plot needs '+FARM.timber+' timber.');s.farm.nextId++;s.farm.plots.push(p);message='Plot ready. Add another beside it to grow your field.';}
  else if(action.kind==='farm-buy'){if(!crop)return fail('Choose seeds to buy.');if(s.farm.seeds[action.crop]>996)return fail('Your seed box is full.');if(!pay('coins',crop.coins))return fail('You need '+crop.coins+' coins for this packet.');s.farm.seeds[action.crop]+=3;message='Three plantings added to your seed box.';}
  else if(action.kind==='farm-plant'){if(!plot||plot.crop)return fail('Choose an empty plot.');if(!crop)return fail('Choose a crop.');if(s.farm.seeds[action.crop]>0)s.farm.seeds[action.crop]--;else if(count(inv[crop.store][crop.item])>0)inv[crop.store][crop.item]--;else return fail('Buy a seed packet or bring one '+crop.seedName.toLowerCase()+' from your stores.');Object.assign(plot,{crop:action.crop,plantedAt:now,wateredAt:0});message='Planted. Water this plot to start it growing.';}
  else if(action.kind==='farm-water'){const chosen=action.all?s.farm.plots.filter(p=>p.crop&&!p.wateredAt):plot?[plot]:[];if(!chosen.length||chosen.some(p=>!p.crop||p.wateredAt))return fail('Choose a freshly planted plot that needs water.');for(const p of chosen)p.wateredAt=Math.max(now,p.plantedAt);message='Watered. Your crops will keep growing while you are away.';}
  else if(action.kind==='farm-harvest'){const chosen=action.all?s.farm.plots.filter(p=>farmStatus(p,now).stage==='ready'):plot?[plot]:[];if(!chosen.length||chosen.some(p=>farmStatus(p,now).stage!=='ready'))return fail('These crops are not ready to harvest.');for(const p of chosen){const c=CROPS[p.crop],n=count(inv[c.store][c.item]);if(!Number.isSafeInteger(n+c.yield))return fail('Your harvest could not fit safely in your stores.');inv[c.store][c.item]=n+c.yield;s.farm.seeds[p.crop]=Math.min(999,s.farm.seeds[p.crop]+1);Object.assign(p,{crop:null,plantedAt:0,wateredAt:0});}message='Harvest stored, with seeds saved for replanting.';}
  else if(action.kind==='farm-remove'){if(!plot)return fail('That plot has already been removed.');if(plot.crop)return fail('Harvest the crop before removing this plot.');s.farm.plots=s.farm.plots.filter(p=>p.id!==plot.id);message='Empty plot returned to grass.';}
  else return fail('Choose a farm action.');return{ok:true,home:s,wallet:w,inventory:inv,message};
 }

 function available(s,id){return(s.owned[id]||0)-s.placed.filter(p=>p.item===id).length;}
 function propose(home,wallet,action){const s=normalize(home),w={branches:wallet?.branches};const fail=error=>({ok:false,error});if(!action||typeof action!=='object')return fail('Choose an action.');
 const pay=n=>{if(!Number.isSafeInteger(w.branches)||w.branches<n)return false;w.branches-=n;return true;};
 if(action.kind==='intro'){const order=['welcome','house','desk','done'];if(order.indexOf(action.stage)<order.indexOf(s.intro)||!order.includes(action.stage))return fail('This welcome step is already complete.');s.intro=action.stage;}
 else if(action.kind==='arrival'){
  if(!['enter','outside','desk'].includes(action.event))return fail('That welcome step is unavailable.');
  if(s.arrival!=='done'){
   if(action.event==='enter'){if(s.arrival==='home')s.arrival='shack';s.intro='done';}
   else if(action.event==='outside'&&s.arrival==='shack')s.arrival='outside';
   else if(action.event==='desk'&&s.arrival==='outside')s.arrival='done';
   else return fail('Look outside the shelter, then return to the desk.');
  }
 }
 else if(action.kind==='build-home'){
  if(s.tier!==0)return fail('Your house has already been built.');
  const revision=s.anchor?.revision||0;
  if(action.expectedRevision!==revision)return fail('Your home location changed. Choose where to build again.');
  const anchor=normalizeAnchor({lat:action.lat,lon:action.lon,revision:revision+1,source:'chosen'});
  if(!anchor)return fail('Choose a loaded place in Alderwing to build your house.');
  if(!pay(TIERS[1].timber))return fail('You need '+TIERS[1].timber+' timber to build your house.');
  s.anchor=anchor;s.tier=1;s.academyTree=pickAcademySpot(s);
 }
 else if(action.kind==='anchor'){const revision=s.anchor?.revision||0;if(action.expectedRevision!==revision||action.source==='initial'&&s.anchor)return fail('Your home location has changed. Choose its place again.');const anchor=normalizeAnchor({lat:action.lat,lon:action.lon,revision:revision+1,source:action.source});if(!anchor)return fail('Choose a valid place on the world map.');s.anchor=anchor;}
 else if(action.kind==='upgrade'){if(s.tier===0)return fail('Walk outside and choose where to build your house.');if(s.tier>=2)return fail('Your hearthhome is complete.');if(!pay(TIERS[s.tier+1].timber))return fail('You need '+TIERS[s.tier+1].timber+' timber for this upgrade.');s.tier++;}
 else if(action.kind==='build-room'){const r=ROOMS[action.room];if(!r)return fail('Choose a room.');if(s.rooms[action.room])return fail('This room is already built.');if(s.tier<1)return fail('Upgrade to a cosy cottage before adding rooms.');if(!pay(r.timber))return fail('You need '+r.timber+' timber for this room.');s.rooms[action.room]=true;s.placed=s.placed.filter(p=>p.area!=='room'||ITEMS[p.item].flat||!overlap(bounds(p),roomPath(action.room)));}
 else if(action.kind==='chop'){const tree=visibleTrees(s).find(t=>t.id===action.id);if(!tree)return fail('Choose a woodland tree.');if(action.area!=='yard'||!Number.isFinite(action.x+action.z)||Math.hypot(action.x-tree.x,action.z-tree.z)>1.8)return fail('Walk closer to the tree before chopping.');const hits=treeState(s,tree.id);if(hits>=3)return fail('This tree is resting until tomorrow (UTC).');if(!Number.isSafeInteger(w.branches)||w.branches<0||hits===2&&!Number.isSafeInteger(w.branches+3))return fail('Your timber could not be counted safely.');s.trees[tree.id]={day:dayKey(),hits:hits+1};if(hits===2)w.branches+=3;}
 else if(action.kind==='craft'){const i=ITEMS[action.item];if(!i)return fail('Choose a decoration.');if(s.owned[action.item]>=100)return fail('You have enough of this decoration.');if(!pay(i.timber))return fail('You need '+i.timber+' timber to make this.');s.owned[action.item]=(s.owned[action.item]||0)+1;}
 else if(action.kind==='place'){const old=action.id?s.placed.find(p=>p.id===action.id):null;if(s.placed.length>=MAX_PLACED&&!old||s.placed.filter(p=>p.area===action.area).length>=MAX_PER_SPACE&&(!old||old.area!==action.area))return fail('Each space holds 32 decorations, with 96 across your home. Put one away to make space.');if(action.id&&!old)return fail('That decoration has moved.');if(old&&old.item!==action.item)return fail('Choose the same decoration to move.');if(!old&&available(s,action.item)<1)return fail('Make this decoration first.');const p={id:old?.id||s.nextId,item:action.item,area:action.area,x:action.x,z:action.z,turn:((Number.isFinite(action.turn)?Math.floor(action.turn):0)%4+4)%4};const valid=validPlacement(s,p);if(!valid.ok)return valid;if(old)s.placed=s.placed.filter(q=>q.id!==old.id);else s.nextId++;s.placed.push(p);}
 else if(action.kind==='store'){const old=s.placed.find(p=>p.id===action.id);if(!old)return fail('That decoration is already put away.');s.placed=s.placed.filter(p=>p.id!==old.id);}
 else if(action.kind==='find'){const f=FINDS.find(f=>f.id===action.id);if(!f||indoor(f.area)&&!roomOpen(s,f.area)||s.finds.includes(f.id))return fail('This discovery is already in your journal.');s.finds.push(f.id);if(f.gift)s.owned[f.gift]=(s.owned[f.gift]||0)+1;}
 else return fail('That action is unavailable.');return{ok:true,home:s,wallet:w};}
 function safePosition(world,p){if(p&&world.allowed(p.x,p.z))return p;if(p)for(let ring=1;ring<=10;ring++)for(let i=0;i<24;i++){const a=i*Math.PI/12,x=p.x+Math.sin(a)*ring*.25,z=p.z+Math.cos(a)*ring*.25;if(world.allowed(x,z))return{...p,x,z};}return{...world.spawn(),yaw:p?.yaw??world.spawn().yaw,pitch:p?.pitch??world.spawn().pitch};}
 function world(home,area,now=Date.now(),options={}){const s=normalize(home),inside=indoor(area),main=area==='room',fixed=inside?(main?roomFixed(s):extraFixed):[houseFootprint(s)];return{day:dayKey(now),radius:inside?7:options.connected?Infinity:15*YARD_SCALE,segments:[],height:()=>0,surface:(x,z)=>inside?'wood':'ground',spawn:()=>inside?{x:0,y:0,z:main?roomLayout(s).spawnZ:2.8,yaw:0,pitch:-.02}:{x:0,y:0,z:4,yaw:Math.PI,pitch:0},allowed(x,z){if(!Number.isFinite(x+z)||inside&&!roomOpen(s,area))return false;if(inside?(Math.abs(x)>(main?roomLayout(s).width/2-.3:3.7)||Math.abs(z)>(main?roomLayout(s).depth/2-.4:3.7)):!options.connected&&Math.hypot(x,z)>YARD.walk)return false;const person={x,z,w:.54,d:.54};return !fixed.some(f=>overlap(person,f,0))&&!s.placed.some(p=>p.area===area&&!ITEMS[p.item].flat&&overlap(person,bounds(p),0))&&(inside||!visibleTrees(s).some(t=>treeState(s,t.id,now)<3&&Math.hypot(x-t.x,z-t.z)<t.r+.27))&&(inside||!academyTree(s)||Math.hypot(x-academyTree(s).x,z-academyTree(s).z)>=ACADEMY_TREE.walk+.27);}};}
 return{ACADEMY_TREE,academyTree,pickAcademySpot,roomLayout,roomFixed,houseFootprint,groundProfile,ITEMS,TIERS,ROOMS,FINDS,TREES,visibleTrees,FIXED,YARD,YARD_SCALE,MAX_PER_SPACE,MAX_PLACED,MAX_MAP_LAT,indoor,roomOpen,dayKey,treeState,initial,normalize,normalizeAnchor,available,validPlacement,propose,safePosition,world,CROPS,FARM,farmStatus,validPlot,farmKey,proposeFarm};
});
