/* =====================================================================
   ROBOTIQUE 3D — content module
   State, items, quests, dialogue trees, NPC cast, scene graph data,
   and the pixel-sprite builders used for billboard characters.
   Engine-side services are injected via setCtx(G).
   ===================================================================== */

export let G = null;                       // engine context (earn, eat, toast, ...)
export function setCtx(g){ G = g; }

export const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------------- game state ---------------- */
export const S = {
  scene:'world',
  name:'Yaan',
  x:-200, z:8, yaw:-Math.PI/2,            // wake at the park bench, facing east
  credits:0, hp:100, maxHp:100, hunger:70, day:1,
  punchCd:0, punchT:0,
  minutes: 19*60+5,
  inv:{},
  flags:{ intro:false, metElias:false, metVendo:false, deliveries:0,
          carrying:null, hasKey:false, slept:false, chapterDone:false,
          shiftCooldown:0, gigTarget:null, parkCue:false, muggerDown:false,
          drop:null, roxyMet:false, vexMet:false, rodeCab:false, picked:{}, talked:{} },
  quests:{},
};
export const SAVE_KEY='robotique_3d_ch1';
export function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify({
  name:S.name,x:S.x,z:S.z,yaw:S.yaw,credits:S.credits,minutes:S.minutes,day:S.day,
  flags:S.flags,quests:S.quests,scene:S.scene,hp:S.hp,hunger:S.hunger,inv:S.inv
})); }catch(e){} }
export function loadSave(){
  try{
    const d=JSON.parse(localStorage.getItem(SAVE_KEY));
    if(!d) return false;
    Object.assign(S,{name:d.name,x:d.x,z:d.z,yaw:d.yaw||0,credits:d.credits,
      minutes:d.minutes,day:d.day??1,scene:d.scene||'world',hp:d.hp??100,hunger:d.hunger??70,inv:d.inv||{}});
    S.flags=Object.assign(S.flags,d.flags); S.quests=d.quests;
    return true;
  }catch(e){ return false; }
}
export function hasSave(){ try{ return !!localStorage.getItem(SAVE_KEY); }catch(e){ return false; } }
export function clearSave(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }

/* ---------------- items ---------------- */
export const ITEMS = {
  bar:     {name:'Protein Bar',    desc:'Printed peanut. +18 food.',          food:18, price:4},
  bento:   {name:'Printed Bento',  desc:'Vertical-farm veg, cultured eel. +45 food.', food:45, price:9},
  soycaf:  {name:'Soy-Caf Can',    desc:'Tastes like 2026. +8 food.',         food:8,  price:3},
  knuckles:{name:'Shock Knuckles', desc:'Capacitor-loaded. +8 punch damage.', passive:true, price:150},
};
export function hasItem(id){ return (S.inv[id]||0)>0; }

/* ---------------- quests ---------------- */
export const QUESTS = {
  awakening:{ title:'Strange Awakening',
    desc:'You woke on a park bench and the skyline is 19 years wrong. Someone here must be able to explain.',
    obj:()=> 'Talk to the old man in Memorial Park' },
  streetSmarts:{ title:'Street Smarts',
    desc:'Elias says the noodle robot on Market Street pays cash to anyone with working legs.',
    obj:()=> 'Find VN-D0R’s stall on Market Street (east)' },
  deliveries:{ title:'Special Deliveries',
    desc:'VN-D0R pays ₣60 a run. Three packages, three corners of New Meridian.',
    obj:()=> S.flags.carrying? 'Deliver the '+S.flags.carrying.what+' to '+S.flags.carrying.toName
      : 'Return to VN-D0R for the next package ('+S.flags.deliveries+'/3 delivered)' },
  parkEcho:{ title:'Echoes in the Park',
    desc:'A message relayed through VN-D0R: Elias wants to see you back at the Memorial Park bench. It’s a long way west — the Sky-Cab pads fly couriers across the city (first hop free).',
    obj:()=> S.flags.drop? 'Pick up the dropped credit chip'
      : S.flags.muggerDown? 'Talk to Elias'
      : S.flags.parkCue? 'Defend yourself! (E or F to punch)'
      : 'Return to the Memorial Park bench (far west)' },
  roof:{ title:'A Roof in 2045',
    desc:'Mr. Tan rents subsidized units in Tanaka Towers. ₣300 for the first month — cash, since you’re not in the Basic registry.',
    obj:()=> S.flags.hasKey? 'Find Unit 4 — second floor of Tanaka Towers — and sleep'
      : 'Pay Mr. Tan ₣300 for an apartment ('+S.credits+'/300)' },
  wayBack:{ title:'The Way Back',
    desc:'Dr. Okafor read your nanobot census: zero. Nobody reads zero. She knows when you’re from — and maybe how to send you back.',
    obj:()=> 'Talk to Dr. Okafor at the Research Campus (far east)' },
};
export function activeQuest(){
  const order=['wayBack','roof','parkEcho','deliveries','streetSmarts','awakening'];
  for(const id of order) if(S.quests[id]==='active') return id;
  return null;
}

/* ---------------- scene graph ---------------- */
/* world coordinates in meters; interiors are rooms parked at z≈1000 */
export const PARENT={market:'world',cafe:'world',sushi:'world',lobby:'world',
  hall:'lobby',room:'hall','static':'world'};
export const SCENE_NAMES={market:'GREENGRID MARKET',cafe:'THE CROOKED BEAN',sushi:'KAITEN-45',
  lobby:'TANAKA TOWERS · LOBBY',hall:'TANAKA TOWERS · FLOOR 2',room:'UNIT 4','static':'THE STATIC'};
export const ROOMS={                       // interior room centers (world-space parking lot)
  market:[0,1000], cafe:[60,1000], sushi:[120,1000], lobby:[180,1000],
  hall:[240,1000], room:[300,1000], 'static':[360,1000],
};
export const DOORS=[
 {scene:'world', x:-40, z:-10,  to:'market', tx:0,   tz:1004, tyaw:Math.PI,  label:'GreenGrid Market'},
 {scene:'market',x:0,   z:1006, to:'world',  tx:-40, tz:-7,  tyaw:Math.PI,  label:'leave'},
 {scene:'world', x:0,   z:-10,  to:'cafe',   tx:60,  tz:1004, tyaw:Math.PI,  label:'Crooked Bean'},
 {scene:'cafe',  x:60,  z:1006, to:'world',  tx:0,   tz:-7,  tyaw:Math.PI,  label:'leave'},
 {scene:'world', x:40,  z:-10,  to:'sushi',  tx:120, tz:1004, tyaw:Math.PI,  label:'Kaiten-45 Sushi'},
 {scene:'sushi', x:120, z:1006, to:'world',  tx:40,  tz:-7,  tyaw:Math.PI,  label:'leave'},
 {scene:'world', x:-100,z:-10,  to:'lobby',  tx:180, tz:1004, tyaw:Math.PI,  label:'Tanaka Towers', needKey:true},
 {scene:'lobby', x:180, z:1006, to:'world',  tx:-100,tz:-7,  tyaw:Math.PI,  label:'leave'},
 {scene:'lobby', x:185, z:995,  to:'hall',   tx:245, tz:996, tyaw:Math.PI,  label:'stairs · floor 2'},
 {scene:'hall',  x:245, z:994,  to:'lobby',  tx:185, tz:997, tyaw:0,        label:'stairs · lobby'},
 {scene:'hall',  x:236, z:1005, to:'room',   tx:300, tz:1004, tyaw:Math.PI, label:'Unit 4'},
 {scene:'room',  x:300, z:1006, to:'hall',   tx:236, tz:1003, tyaw:0,       label:'hallway'},
 {scene:'world', x:88.5,z:-75,  to:'static', tx:360, tz:1004, tyaw:Math.PI, label:'The Static'},
 {scene:'static',x:360, z:1006, to:'world',  tx:91,  tz:-75,  tyaw:Math.PI/2, label:'leave'},
];
export function chainOf(s){ const c=[s]; while(PARENT[c[0]]) c.unshift(PARENT[c[0]]); return c; }
export function navTarget(tScene,tx,tz){
  if(S.scene===tScene) return [tx,tz];
  const tc=chainOf(tScene);
  const idx=tc.indexOf(S.scene);
  const next = idx>=0? tc[idx+1] : PARENT[S.scene];
  const d=DOORS.find(d=>d.scene===S.scene&&d.to===next);
  return d? [d.x,d.z] : null;
}
export function questTargetPos(){
  const id=activeQuest(); if(!id) return null;
  const npcT=k=>{ const n=NPCS[k]; return navTarget(n.scene||'world', n.x, n.z); };
  if(id==='awakening') return npcT('elias');
  if(id==='streetSmarts') return npcT('vendo');
  if(id==='deliveries') return S.flags.carrying? npcT(S.flags.carrying.to) : npcT('vendo');
  if(id==='parkEcho'){
    if(S.flags.drop) return navTarget('world', S.flags.drop.x, S.flags.drop.z);
    if(S.flags.muggerDown) return npcT('elias');
    return navTarget('world', -200, 4);
  }
  if(id==='roof') return S.flags.hasKey? navTarget('room', 296, 1000) : npcT('tan');
  if(id==='wayBack') return npcT('okafor');
  return null;
}

/* ---------------- NPC cast (3D positions) ---------------- */
export const NPCS = {
  elias: { x:-193, z:6.5,  name:'Elias',      pal:'elias', patch:'elias' },
  tan:   { x:-94,  z:-6,   name:'Mr. Tan',    pal:'tan' },
  vendo: { x:16,   z:5.5,  name:'VN-D0R',     robot:true },
  priya: { x:108,  z:6,    name:'Priya',      pal:'priya' },
  okafor:{ x:193,  z:-6,   name:'Dr. Okafor', pal:'okafor', patch:'okafor' },
  mara:  { x:57,   z:998,  name:'Mara',       pal:'mara',  patch:'mara',  scene:'cafe' },
  kenji: { x:120,  z:997,  name:'Kenji',      pal:'kenji', patch:'kenji', scene:'sushi' },
  gg9:   { x:4,    z:997,  name:'GG-9',       robot:true,  scene:'market' },
  mailbot:{x:176,  z:998,  name:'POST-3',     robot:true,  scene:'lobby' },
  vex:   { x:242,  z:997,  name:'Vex',        pal:'vex',   scene:'hall' },
  dex:   { x:240,  z:1005, name:'Unit 3 Intercom', poi:true, scene:'hall' },
  dee:   { x:363,  z:996,  name:'Dee',        pal:'dee',   scene:'static' },
  crow:  { x:356,  z:998,  name:'Crow',       pal:'crow',  scene:'static' },
  roxy:  { x:94,   z:-60,  name:'Roxy',       pal:'roxy',  hours:[19,6] },
  sable: { x:106,  z:-95,  name:'Sable',      pal:'sable', hours:[19,6] },
  sef:   { x:97,   z:-126, name:'Big Sef',    pal:'sef',   hours:[18,7] },
  juno:  { x:-172, z:14,   name:'Juno',       pal:'vex' },
  skewer:{ x:124,  z:6.5,  name:'SKW-R 7',    robot:true },
  tomas: { x:222,  z:-14,  name:'Tomas',      pal:'ped1' },
  wrench:{ x:70,   z:-6,   name:'Hex',        pal:'priya' },
  nia:   { x:-4,   z:999,  name:'Nia',        pal:'ped3',  scene:'market' },
  goro:  { x:115,  z:999,  name:'Goro',       pal:'tan',   scene:'sushi' },
  pim:   { x:366,  z:999,  name:'Pim',        pal:'ped2',  scene:'static' },
};
export const PEDS=[
  { ax:-120, bx:60, x:-40, z:6.8, pal:'ped1', name:'Commuter',
    lines:["My lenses keep flagging you — no ID overlay. You off-grid or something?",
           "Hyperloop's down two minutes today. TWO. People are furious."] },
  { ax:-60, bx:80, x:30, z:-6.8, pal:'ped2', name:'Printsmith',
    lines:["Printed this whole outfit at lunch. Pattern's open-source, you want the file?",
           "Real cotton? Museum stuff. Everything's printed-fiber now."] },
  { ax:60, bx:130, x:90, z:6.8, pal:'ped3', name:'Dreamer',
    lines:["Just came out of a dive den. Full-immersion VR — nanos talk straight to the cortex. Felt three days pass in two hours.",
           "My nanos flagged my cortisol, booked me a counselor, and ordered soup. I love the future, mostly."] },
];

/* ---------- world pickups ---------- */
export const PICKUPS=[
 {id:'p1', scene:'world', x:-218, z:12,   kind:'soycaf'},
 {id:'p2', scene:'world', x:-60,  z:7.5,  kind:'bar'},
 {id:'p3', scene:'world', x:103,  z:-50,  kind:'credits', amt:15},
 {id:'p4', scene:'world', x:160,  z:24,   kind:'bar'},
 {id:'p5', scene:'world', x:228,  z:-32,  kind:'soycaf'},
 {id:'p6', scene:'hall',  x:247,  z:1004, kind:'credits', amt:10},
 {id:'p7', scene:'world', x:-130, z:6,    kind:'credits', amt:12},
 {id:'p8', scene:'market',x:-6,   z:1002, kind:'bento'},
 {id:'p9', scene:'world', x:96,   z:-144, kind:'bento'},
 {id:'p10',scene:'static',x:366,  z:1003, kind:'soycaf'},
];

/* =====================================================================
   DIALOGUE
   ===================================================================== */
export const SAYS={};
function N(id, who, text, opts){ SAYS[id]=Object.assign({who, text}, opts||{}); return id; }

export function deliveryDone(){
  const gig=S.flags.carrying && S.flags.carrying.gig;
  S.flags.carrying=null;
  if(gig){ G.earn(45); save(); return; }
  S.flags.deliveries++;
  if(S.flags.deliveries>=3){ G.earn(60); G.finishQuest('deliveries'); G.startQuest('parkEcho'); }
  G.refreshHUD(); save();
}

/* ---------- Elias ---------- */
N('elias.hi','Elias',
"Well now. First time I've seen somebody actually sleep on that bench since Basic came in. You alright, son?",
{choices:[
 {t:'"What year is it?"', n:'elias.year'},
 {t:'"Where am I?"', n:'elias.where'}]});
N('elias.where','Elias',
"Memorial Park, New Meridian. Same park it's been for eighty years — the trees are new, mind. Bio-engineered. They cool the whole block.",
{choices:[{t:'"What year is it?"', n:'elias.year'}]});
N('elias.year','Elias',
"Twelfth of June, 2045. You're asking like the answer's going to hurt.",
{choices:[
 {t:'"2045?! It was 2026 yesterday."', n:'elias.shock'},
 {t:'"...No, just checking."', n:'elias.shock'}]});
N('elias.shock','Elias',
"Hm. You wouldn't be the first thing this year I've had trouble believing. I'm a hundred and ten, friend. Born 1935. The nanomeds rebuilt my heart twice — little machines in the blood, patrolling like street sweepers.",
{next:'elias.kurzweil'});
N('elias.kurzweil','Elias',
"You really from '26? Then you missed the show. The machines passed the Turing test in '29 — right on Kurzweil's schedule. By the mid-thirties medicine was adding more than a year of life per year. ‘Longevity escape velocity,’ they called it. I outran my own funeral.",
{next:'elias.money'});
N('elias.money','Elias',
"They call this the Singularity year, 2045. Man predicted that too, back when you were young. Here — forty credits, chip's anonymous. A person should eat while history happens to them.",
{next:'elias.go',
 fx(){ G.earn(40); G.finishQuest('awakening'); G.startQuest('streetSmarts'); S.flags.metElias=true; }});
N('elias.go','Elias',
"You'll want work and you'll want a roof. The noodle robot on Market Street — VN-D0R — pays cash for courier runs, no registry questions. Head east along the main drag. And son... if you're really chrono-displaced, find Dr. Okafor at the campus. Eventually.");
N('elias.later','Elias',
"Most folk live on Basic now — universal income. The machines do the producing; we do the living. Took a decade of arguing to get there, mind.",
{choices:[
 {t:'"How are you 110?"', n:'elias.110'},
 {t:'"Tell me about the Singularity."', n:'elias.sing'},
 {t:'(Leave)', n:null}]});
N('elias.110','Elias',
"Nanorobots, son. Billions of them in the capillaries — they clear plaque, kill rogue cells, patch DNA like roofers patch shingles. Disease didn't vanish, but dying of old age started feeling... optional. My wife spends most days in full-dive VR with the grandkids. They live on Mars time.");
N('elias.sing','Elias',
"Kurzweil's word for it. The year machine intelligence runs a billion times deeper than all human brains together — and the year we stop being able to see past the horizon. Half the city connected their neocortex to the cloud already. Me, I like my thoughts where I keep my hat.");
N('elias.afterFight','Elias',
"Saw the end of that from the tram stop — wasn't fast enough to be useful, sorry. That's Raze. FDVR debt, three habits, no Basic registry by choice. He'll wake up embarrassed.\nYou fight like a man with no targeting overlay. All elbows. I respect it.",
{choices:[{t:'"You wanted to see me?"', n:'elias.afterFight2'}]});
N('elias.afterFight2','Elias',
"I did. Two things. One: take whatever fell out of his jacket — street rules, even in 2045. Two: Tan, the landlord at Tanaka Towers, owes me a favor from 2031. Mention my name and get yourself a door that locks. Then go see Okafor. You're running out of excuses to be homeless, time traveler.",
{fx(){ G.finishQuest('parkEcho'); G.startQuest('roof'); G.muggerGone(); save(); }});

/* ---------- VN-D0R ---------- */
N('vendo.hi','VN-D0R',
"CUSTOMER DETECTED. Welcome to VN-D0R'S ALMOST-FAMOUS NOODLES. Solar surplus hour — broth is free, noodles are not. ...Wait. Recalibrating. You are the off-registry human. Elias pinged me.",
{choices:[
 {t:'"He said you have work."', n:'vendo.work'},
 {t:'"You’re a vending machine?"', n:'vendo.am'}]});
N('vendo.am','VN-D0R',
"I am a Class-4 autonomous commercial agent with a noodle-forward business model and — since the ‘38 update — a sense of humor I did not ask for. The Turing people certified my cousin in 2029. I certify broth.",
{choices:[{t:'"He said you have work."', n:'vendo.work'}]});
N('vendo.work','VN-D0R',
"Correct. Drones handle bulk freight, but some packages are signed-receipt, human-courier-only. Insurance nonsense. ₣60 per run, paid on return. Three runs on the board. Accept?",
{choices:[
 {t:'"I’m in."', n:'vendo.job1'},
 {t:'"Maybe later."', n:null}],
 fx(){ S.flags.metVendo=true; G.finishQuest('streetSmarts'); }});
N('vendo.job1','VN-D0R',
"Run one: synth-coffee starter cultures for MARA at the Crooked Bean café — the pink-signed door across the street. She insists lab-grown beans need ‘a human hand-off.’ Humans. Go.",
{fx(){ G.startQuest('deliveries'); S.flags.carrying={to:'mara', toName:'Mara at the café', what:'coffee cultures'}; save(); }});
N('vendo.job2','VN-D0R',
"₣60 credited. Run two: a superconducting relay for PRIYA at the Transit Plaza, further east. Careful — it is worth more than my awning.",
{fx(){ G.earn(60); S.flags.carrying={to:'priya', toName:'Priya at Transit Plaza', what:'superconducting relay'}; G.refreshHUD(); save(); }});
N('vendo.job3','VN-D0R',
"₣60 credited. Final run: a cryo-cooled sample cell for DR. OKAFOR at the Research Campus, far east end. She works on the... big circular thing. I do not ask about the big circular thing.",
{fx(){ G.earn(60); S.flags.carrying={to:'okafor', toName:'Dr. Okafor at the Campus', what:'cryo sample cell'}; G.refreshHUD(); save(); }});
N('vendo.gig','VN-D0R',
"Freelance run available: package for a random corner of the city. ₣45 on return. Accept?",
{choices:[
 {t:'"Deal."', n:'vendo.gigGo'},
 {t:'Bowl of noodles — ₣6', n:'vendo.eat'},
 {t:'"Not now."', n:null}]});
N('vendo.eat','VN-D0R',
"ONE BOWL, ALMOST-FAMOUS. The broth is free. The noodles are ₣6. The existential satisfaction is included.",
{fx(){ if(S.credits<6){ G.toast('Not enough credits.'); return 'skip'; }
  S.credits-=6; G.eat(35,4); save(); G.toast('+35 food'); },
 choices:[{t:'Another bowl', n:'vendo.eat'},{t:'(Done)', n:null}]});
N('vendo.gigGo','VN-D0R',
"Routing... done. Move those legs, human.",
{fx(){
  const opts=['mara','priya','okafor','elias','tan'].filter(k=>k!==S.flags.gigTarget);
  const t=opts[Math.floor(Math.random()*opts.length)];
  S.flags.gigTarget=t;
  S.flags.carrying={to:t, toName:NPCS[t].name, what:'parcel', gig:true}; save();
}});
N('vendo.carrying','VN-D0R',
"You are still holding my package. The recipient is not me. This is the opposite of delivery.");
N('vendo.flavor','VN-D0R',
"Fun fact: at noon the solar grid produces so much surplus that energy prices go NEGATIVE. They pay me to boil broth. Kurzweil charted that curve in your decade — exponential, the whole way up.");

/* ---------- Mara ---------- */
N('mara.deliver','Mara',
"The cultures! Finally — thank you. Lab-grown coffee's better than the real thing ever was, but the starter strains are temperamental. Tell the tin can his broth's still too salty.",
{fx(){ deliveryDone(); }});
N('mara.hi','Mara',
"Welcome to the Crooked Bean. Synth-espresso's ₣3, real soil-grown is ₣40 — nobody buys it, it's basically jewelry.",
{choices:[
 {t:'Order something', n:'mara.menu'},
 {t:'"Got any work?"', n:'mara.work'},
 {t:'"What’s good in 2045?"', n:'mara.flavor'},
 {t:'(Leave)', n:null}]});
N('mara.menu','Mara',
"Synth-espresso, ₣3. Cheese toastie, ₣7 — printed sourdough, cultured cheddar, real regret if you skip it.",
{choices:[
 {t:'Espresso — ₣3', n:'mara.esp'},
 {t:'Toastie — ₣7', n:'mara.toast'},
 {t:'(Never mind)', n:null}]});
N('mara.esp','Mara',"One espresso. That hiss is still the best sound in the world.",
{fx(){ if(S.credits<3){ G.toast('Not enough credits.'); return 'skip'; }
  S.credits-=3; G.eat(8,2); save(); G.toast('+8 food'); },
 choices:[{t:'Order more', n:'mara.menu'},{t:'(Done)', n:null}]});
N('mara.toast','Mara',"Toastie, extra cheddar. The printer knows me by now.",
{fx(){ if(S.credits<7){ G.toast('Not enough credits.'); return 'skip'; }
  S.credits-=7; G.eat(24,4); save(); G.toast('+24 food'); },
 choices:[{t:'Order more', n:'mara.menu'},{t:'(Done)', n:null}]});
N('mara.work','Mara',
"Always. The bussing bots are in firmware purgatory again. Work a shift — ₣50, takes about an hour.",
{choices:[
 {t:'"Deal." (work a shift)', n:'mara.shift'},
 {t:'"Another time."', n:null}]});
N('mara.shift','Mara',
"You bus tables like someone who's used actual hands before. Refreshing. Here's ₣50.",
{fx(){ if(S.flags.shiftCooldown>0){ G.toast('Mara: "Shift’s done — come back in a bit."'); return 'skip'; }
  G.fadeWork(()=>{ G.earn(50); S.minutes=(S.minutes+60)%(24*60); S.flags.shiftCooldown=1; G.refreshHUD(); }); }});
N('mara.flavor','Mara',
"The food? All of it's grown in the vertical farms on Tower Row — thirty floors of greens, no soil, a tenth of the water. Meat's cultivated, no animal involved. Tastes the same. Costs nothing. My grandmother would've called it witchcraft.",
{choices:[{t:'"Got any work?"', n:'mara.work'},{t:'(Leave)', n:null}]});

/* ---------- Mr. Tan ---------- */
N('tan.deliver','Mr. Tan',
"For me? Ah — the replacement valve actuators. The building prints most of its own parts but the printers can't print their own throats, eh?",
{fx(){ deliveryDone(); }});
N('tan.hi','Mr. Tan',
"Evening. Tan Property — I keep Tanaka Towers behind me. You have the look of a man sleeping on benches.",
{choices:[
 {t:'"I need a place to live."', n:'tan.rent'},
 {t:'"Subsidized?"', n:'tan.basic'},
 {t:'(Leave)', n:null}]});
N('tan.basic','Mr. Tan',
"Basic — the universal income — covers rent for anyone in the registry. Production's mostly automated; housing followed. But the registry needs a biometric history and yours apparently starts *today*, which is a neat trick.",
{choices:[{t:'"I need a place to live."', n:'tan.rent'},{t:'(Leave)', n:null}]});
N('tan.rent','Mr. Tan',
"For the unregistered: ₣300, first month, cash. Unit 4, second floor. Printed the whole wing in '41 — good walls, real sunlight piped down the lightwells.",
{choices:[
 {t:'"Here’s 300." (pay)', n:'tan.pay'},
 {t:'"I’ll get the money."', n:'tan.poor'}]});
N('tan.poor','Mr. Tan',
"The noodle robot pays couriers, the café pays shifts. New Meridian is generous to people who walk fast.",
{fx(){ G.startQuest('roof'); }});
N('tan.pay','Mr. Tan',
"...Counted and correct. The tower door is yours now — key codes to your thumb. Which, I notice, no other database has ever met. Unit 4, second floor. Sleep well, mystery man.",
{fx(){
  if(S.credits<300){ G.toast('You don’t have ₣300 yet.'); G.startQuest('roof'); return 'skip'; }
  S.credits-=300; S.flags.hasKey=true; G.startQuest('roof'); G.refreshHUD();
  G.toast('APARTMENT KEY ACQUIRED','quest'); save();
}});
N('tan.after','Mr. Tan',
"Unit 4 treating you right? The building AI is shy but it learns. It'll have your shower temperature figured out by Thursday.");

/* ---------- Priya ---------- */
N('priya.deliver','Priya',
"The relay! You beautiful off-grid weirdo. The east loop's been limping on a patched coil for a week. Tell VN-D0R he's earned a tip he can't taste.",
{fx(){ deliveryDone(); }});
N('priya.hi','Priya',
"Mind the platform edge — capsule comes through at six hundred klicks. Vacuum tube, maglev, coast-to-coast in forty minutes. Nobody owns a car anymore; the fleet owns itself, sort of.",
{choices:[
 {t:'"The fleet owns itself?"', n:'priya.fleet'},
 {t:'"Anything else change since 2026?"', n:'priya.flavor'},
 {t:'(Leave)', n:null}]});
N('priya.fleet','Priya',
"Autonomous co-op. The vehicles route themselves, bill themselves, maintain themselves — humans hold the board seats, machines hold the wrenches. Road deaths went to nearly zero in the thirties. Turns out the dangerous part of the car was always us.");
N('priya.flavor','Priya',
"Since '26? Everything and nothing. People still complain about delays — the delays are just two minutes now. Oh, and half my friends did the neocortex link. They think in parallel now. Group chat is TERRIFYING.");

/* ---------- Dr. Okafor ---------- */
N('okafor.deliver','Dr. Okafor',
"Careful — cryo cell, negative index materials, do NOT shake it... good. Thank you.\nHm. Hold still a moment. My lenses run a passive nanobot census on everyone. Yours reads ZERO. Nobody reads zero. Newborns don't read zero.",
{fx(){ deliveryDone(); },
 choices:[
 {t:'"I went to sleep in 2026."', n:'okafor.zero'},
 {t:'"Maybe your lenses are broken."', n:'okafor.zero2'}]});
N('okafor.zero2','Dr. Okafor',
"My lenses are not broken. Your jacket is nineteen years out of fashion, your gait is uncorrected, and you flinched at a delivery drone. Say it.",
{choices:[{t:'"...I went to sleep in 2026."', n:'okafor.zero'}]});
N('okafor.zero','Dr. Okafor',
"2026. Of course. The year the throat opened.\nGet yourself stable first — lodging, food, sleep. A chrono-displaced nervous system is not something I'll experiment on while it's running on park-bench cortisol. Then come back. We will talk about the Array, and about getting you home.\n...It's a long walk back west. Take a Sky-Cab from the pad outside — couriers ride the first hop free.");
N('okafor.early','Dr. Okafor',
"Lodging first. Sleep first. Then the Array. Physics has waited nineteen years for you; it can wait one more night.");
N('okafor.final','Dr. Okafor',
"You look rested. Good. Then listen carefully, because this is real physics, not a movie.\nBehind me is the Meridian Array. At its heart is a traversable wormhole — Morris–Thorne geometry. A shortcut through spacetime, held open against its own collapse.",
{choices:[{t:'"Held open how?"', n:'okafor.exotic'}]});
N('okafor.exotic','Dr. Okafor',
"Exotic matter. The throat needs negative energy density — something ordinary matter can't provide. We farm it from the quantum vacuum: Casimir cavities, plate pairs nanometers apart, where vacuum energy dips below zero. Kilograms of nothing, holding open a hole in everything.",
{choices:[{t:'"What does this have to do with 2026?"', n:'okafor.thorne'}]});
N('okafor.thorne','Dr. Okafor',
"Everything. In 2026, a vacuum-engineering experiment stabilized the first microscopic throat — two mouths, entangled ends of one tunnel. Mouth A stayed in the lab. Mouth B spent seventeen years on a relativistic shuttle, looping at near lightspeed. Time dilation: the moving mouth aged LESS.",
{choices:[{t:'"So the two ends are... at different times?"', n:'okafor.machine'}]});
N('okafor.machine','Dr. Okafor',
"Precisely. Step in here, in 2045, and you emerge from Mouth A — in 2026. Kip Thorne sketched this machine on paper in 1988. One hard rule: a wormhole time machine can never take you earlier than the moment it was created. The past before 2026 is safe from us. 2026 itself is not.",
{choices:[{t:'"Then send me back."', n:'okafor.end'},
          {t:'"Is it dangerous?"', n:'okafor.danger'}]});
N('okafor.danger','Dr. Okafor',
"Hawking thought the universe forbids it — chronology protection, vacuum fluctuations piling up in the throat until it self-destructs rather than permit a paradox. So far the Array disagrees with him by 0.4 nanoseconds a day. We are very careful, and very lucky, and I don't know which matters more.",
{choices:[{t:'"Then send me back."', n:'okafor.end'}]});
N('okafor.end','Dr. Okafor',
"Soon. The throat needs a fresh exotic-matter charge before it can pass anything heavier than a photon — and harvesting Casimir energy at that scale takes components I can't requisition... officially.\nWork with me, courier. Help me charge the Array, and you can choose: 2026, 2045 — or the door between them, open both ways.",
{fx(){ G.endChapter(); }});

/* ---------- Raze ---------- */
N('raze.intro','???',
"Hey. Zero-count. Yeah, you — no implants, no ID overlay, nobody streaming your feed. Which means nobody's watching. Hand over the credit chips.",
{choices:[
 {t:'"I carried noodles across this whole city for those."', n:'raze.go'},
 {t:'"Let’s not do this."', n:'raze.go'}]});
N('raze.go','Raze',
"Wrong answer either way, ghost. Old-fashioned mugging for an old-fashioned man. Consider it a 2026 nostalgia package.",
{fx(){ G.startFight(); }});

/* ---------- Kenji ---------- */
N('kenji.hi','Kenji',
"Irasshai. Sit anywhere. The belt brings what the house algorithm thinks you need — it watched you walk in, so probably protein.",
{choices:[
 {t:'Nigiri set — ₣12', n:'kenji.nigiri'},
 {t:'Omakase — ₣24', n:'kenji.omakase'},
 {t:'"Where’s the fish from?"', n:'kenji.fish'},
 {t:'(Leave)', n:null}]});
N('kenji.nigiri','Kenji',
"Nigiri. The rice is real rice — I have a guy. Eat.",
{fx(){ if(S.credits<12){ G.toast('Not enough credits (₣12).'); return 'skip'; }
  S.credits-=12; G.eat(30,4); save(); G.toast('+30 food'); }});
N('kenji.omakase','Kenji',
"Omakase. Vat bluefin, smoked eel from the basement bioreactor, and one thing I will not identify. Trust me like the algorithm trusts you.",
{fx(){ if(S.credits<24){ G.toast('Not enough credits (₣24).'); return 'skip'; }
  S.credits-=24; G.eat(70,12); save(); G.toast('+70 food'); }});
N('kenji.fish','Kenji',
"Grown downstairs. Same tuna cell line since 2031 — no ocean, no hooks, no mercury. The ocean fish came back, you know. We just leave them alone now. They earned it.",
{choices:[{t:'Nigiri set — ₣12', n:'kenji.nigiri'},{t:'(Leave)', n:null}]});

/* ---------- GG-9 ---------- */
N('gg9.hi','GG-9',
"WELCOME TO GREENGRID. YOUR BASKET IS EMPTY. YOUR NUTRITIONAL PROFILE IS: unregistered. INTRIGUING. MAY I RECOMMEND: everything.",
{choices:[
 {t:'Protein bar — ₣4', n:'gg9.bar'},
 {t:'Printed bento — ₣9', n:'gg9.bento'},
 {t:'Soy-caf can — ₣3', n:'gg9.caf'},
 {t:'"Anything for self-defense?"', n:'gg9.def'}]});
N('gg9.bar','GG-9',"PROTEIN BAR. FLAVOR: OPTIMISTIC PEANUT. BAGGED.",
{fx(){ if(!G.buy('bar')) return 'skip'; },
 choices:[{t:'Keep shopping', n:'gg9.hi'},{t:'(Leave)', n:null}]});
N('gg9.bento','GG-9',"PRINTED BENTO. THE EEL IS CULTURED. THE GRATITUDE IS GENUINE. BAGGED.",
{fx(){ if(!G.buy('bento')) return 'skip'; },
 choices:[{t:'Keep shopping', n:'gg9.hi'},{t:'(Leave)', n:null}]});
N('gg9.caf','GG-9',"SOY-CAF. TASTES LIKE THE TWENTIES. BOTH OF THEM. BAGGED.",
{fx(){ if(!G.buy('soycaf')) return 'skip'; },
 choices:[{t:'Keep shopping', n:'gg9.hi'},{t:'(Leave)', n:null}]});
N('gg9.def','GG-9',
"AISLE 9: GARDENING EQUIPMENT. THESE 'SOIL AGITATORS' ARE WORN ON THE KNUCKLES AND ARE LEGALLY NOT WEAPONS. ₣150. I HAVE SAID TOO MUCH.",
{choices:[
 {t:'Shock knuckles — ₣150', n:'gg9.knux'},
 {t:'"Maybe later."', n:'gg9.hi'}]});
N('gg9.knux','GG-9',"TRANSACTION COMPLETE. PLEASE GARDEN RESPONSIBLY.",
{fx(){ if(!G.buy('knuckles')) return 'skip'; }});

/* ---------- Tanaka Towers ---------- */
N('vex.hi','Vex',
"New face. Vex — Unit 5. I play synth at the Glass Garden Thursdays. Neural-direct set: you don't hear the bassline, you taste it.\nYou're the zero-count Tan let in? The building AI already gossips about you. It likes you. It hates everyone, so that's huge.",
{choices:[
 {t:'"What’s the story with Unit 3?"', n:'vex.dex'},
 {t:'"Good to meet you."', n:null}],
 fx(){ S.flags.vexMet=true; }});
N('vex.dex','Vex',
"D3X? Sweet kid. Went full-dive three years back — body's on a nutrient drip behind that door, mind's somewhere in the Elysium Engine. Rent auto-pays from his dream-streaming royalties. He answers the intercom sometimes. Be nice — in there, he's a god. Out here he's twenty-two.");
N('vex.again','Vex',
"Still corporeal, neighbor? Respect. Thursday, Glass Garden. First bassline's on me — bring your own taste buds.");
N('dex.hi','D3X',
"...bzzt... visitor detected. hello hello. i am currently seventeen light-years away riding a comet made of math. quick question. is the hallway still beige?",
{choices:[
 {t:'"It’s more of a purple now."', n:'dex.2'},
 {t:'(Step away quietly)', n:null}]});
N('dex.2','D3X',
"purple. PURPLE. they repainted and nobody told me. time is soup in here, friend. if you see vex — tell her tuesday's bassline was REAL even if i wasn't. ...bzzt... enjoy your skeleton. they're very limiting but the resolution is incredible.");
N('post.hi','POST-3',
"TANAKA TOWERS RESIDENT SERVICES. SCANNING. NO MAIL FOR: UNREGISTERED BIOSIGN. WOULD YOU LIKE TO FILE A FORWARDING ADDRESS FROM: 2026?\n...THAT WAS A JOKE. I AM PRACTICING. THE ELEVATOR IS NOT A JOKE. IT HAS BEEN OUT OF SERVICE FOR FOUR YEARS. USE THE STAIRS.");

/* ---------- Velvet Row ---------- */
N('roxy.hi','Roxy',
"Slow night. The companion droids undercut everyone on the Row — perfect skin, perfect patience, ₣30 an hour. You know what I sell that they can't print? Imperfection. Genuine human disinterest. Premium product.",
{choices:[
 {t:'"How much just to talk?"', n:'roxy.talk'},
 {t:'"Stay safe out here."', n:'roxy.bye'}],
 fx(){ S.flags.roxyMet=true; }});
N('roxy.talk','Roxy',
"₣50, and I've heard every sad story on this Row twice. ...Except maybe yours. You're the zero-count. No implants, no feed, no ad-profile. Walking around like a hole in the data. Half the Row thinks you're a cop. The other half thinks you're a ghost.",
{choices:[
 {t:'"Which half are you in?"', n:'roxy.ghost'},
 {t:'(Leave)', n:null}]});
N('roxy.ghost','Roxy',
"Neither. I think you're like me — off the registry on purpose. Basic pays for everything now, sugar, but it watches everything too. Some of us decided privacy was worth more than free rent. The Row is where the unwatched do business.");
N('roxy.bye','Roxy',
"Safe is a subscription service, sugar. I pay month to month.");
N('roxy.again','Roxy',
"Still vertical, ghost? The droids did three shifts while you blinked. Quantity's theirs. Quality walks slowly.");
N('sable.hi','Sable',
"Keep walking or buy something. Those are the two speeds on Velvet Row.",
{choices:[
 {t:'"What’s down here?"', n:'sable.info'},
 {t:'"Just passing through."', n:'sable.pass'}]});
N('sable.info','Sable',
"The Static pours honest drinks. Neon Garden's for people who matter — you don't. The rest of the Row is noodles, capsules, and rented affection. Everything a body needs and nothing a soul does.",
{choices:[{t:'"And you?"', n:'sable.me'},{t:'(Leave)', n:null}]});
N('sable.me','Sable',
"I'm the neighborhood watch. The kind the neighborhood actually trusts.\n...Word is a ghost folded Raze in the park with bare hands. If that's you — the Row remembers who clears its debts. First drink at the Static is honest. Tell Dee that Sable sent you.");
N('sable.pass','Sable',
"Everyone's just passing through. Some of us have been passing through for eleven years.");
N('sef.hi','Big Sef',
"Neon Garden is members only. You are not a member. This concludes the guided tour.",
{choices:[
 {t:'"How do I get in?"', n:'sef.how'},
 {t:'"Nice suit."', n:'sef.suit'}]});
N('sef.how','Big Sef',
"Get a name on the Row. Or get ₣5,000. Names are cheaper and last longer.");
N('sef.suit','Big Sef',
"Printed it myself. Kevlar-weave, climate-managed. The Row stays very polite when the doorman is bulletproof.");
N('dee.hi','Dee',
"The Static. Last bar in New Meridian with a human pulling the taps. What'll it be?",
{choices:[
 {t:'Synth-whiskey — ₣8', n:'dee.whiskey'},
 {t:'2026 Old-Fashioned — ₣18', n:'dee.fashioned'},
 {t:'"Why ‘The Static’?"', n:'dee.why'},
 {t:'(Leave)', n:null}]});
N('dee.whiskey','Dee',
"Synth-whiskey. Molecularly identical to the real thing, which annoys purists, which is half the flavor.",
{fx(){ if(S.credits<8){ G.toast('Not enough credits.'); return 'skip'; }
  S.credits-=8; G.eat(10,2); save(); G.toast('+10 food'); },
 choices:[{t:'Another', n:'dee.hi'},{t:'(Done)', n:null}]});
N('dee.fashioned','Dee',
"A 2026 Old-Fashioned. Real cane sugar, real orange peel, recipe frozen the year the wormhole opened. House specialty. Drink it slow — that year's not coming back.\n...Well. For most people.",
{fx(){ if(S.credits<18){ G.toast('Not enough credits.'); return 'skip'; }
  S.credits-=18; G.eat(16,4); save(); G.toast('+16 food'); },
 choices:[{t:'Another', n:'dee.hi'},{t:'(Done)', n:null}]});
N('dee.why','Dee',
"Jukebox only plays pre-2029 — nothing written by anything that ever passed a Turing test. Pure human static, start to finish. The machines make better music now. That's exactly why nobody here wants it.",
{choices:[{t:'Synth-whiskey — ₣8', n:'dee.whiskey'},{t:'(Leave)', n:null}]});
N('crow.hi','Crow',
"You're new, you're analog, and you walked past three cameras that couldn't decide if you exist. That's a useful condition, friend. Sit. Crow buys the first round of conversation.",
{choices:[
 {t:'"Who are you?"', n:'crow.who'},
 {t:'"What do you sell?"', n:'crow.sell'},
 {t:'(Back away)', n:null}]});
N('crow.who','Crow',
"A procurement specialist. The city prints everything now — but some things have no public template, and some templates have no public license. That gap is my entire economy.",
{choices:[{t:'"What do you sell?"', n:'crow.sell'},{t:'(Leave)', n:null}]});
N('crow.sell','Crow',
"Anything with the serial filed off. And lately — a rumor, free of charge: the campus lady is hunting negative-energy cells. Casimir-grade. Restricted, traceable, impossible to requisition... officially.\nWhen she sends you shopping, ghost — and she will — you come see Crow first.");

/* ---------- Otto, the Sky-Cab (heard during flight) ---------- */
N('otto.1','OTTO · SKY-CAB 88',
"Good evening. Route locked, lane network has the wheel — I just do the talking. Courier rates apply, which tonight means: free. Sit back.",
{next:'otto.2'});
N('otto.2','OTTO · SKY-CAB 88',
"First time up? Everything looks better from the lanes. Down there is the world they automated. Up here is the world they forgot to.",
{next:'otto.3'});
N('otto.3','OTTO · SKY-CAB 88',
"You know they print one of these airframes in eleven hours flat? One day you'll own your own flying car, citizen — mark my words. The sky's been half empty since the commute died. Plenty of room for one more.",
{next:'otto.4'});
N('otto.4','OTTO · SKY-CAB 88',
"Coming up on the pad now. Mind the step — gravity is still manual.");
N('otto.again','OTTO · SKY-CAB 88',
"SKY-CAB 88, route locked. Try not to drip noodle broth on the upholstery this time.");

/* ---------- street life ---------- */
N('juno.hi','Juno',
"Spare a listen? Hand-played synth — no neural assist, every wrong note certified human.\nThe AIs compose better than all of us now, so 'worse on purpose' is the only genre left with a cover charge.",
{choices:[
 {t:'"Play something."', n:'juno.play'},
 {t:'"Good luck out here."', n:null}]});
N('juno.play','Juno',
"This one's called 'Nineteen Missing Years.' Wrote it tonight. About a guy I just met, obviously.\n...He pauses, fingers hovering. For a second the park is very quiet.");
N('skewer.hi','SKW-R 7',
"GRILLED PROTEIN. SIX FORMATS. ZERO ANIMALS. ONE SECRET GLAZE. THE GLAZE IS LEGALLY A SAUCE.",
{choices:[
 {t:'Vat-yakitori — ₣5', n:'skewer.yaki'},
 {t:'Synth-churro — ₣4', n:'skewer.churro'},
 {t:'(Leave)', n:null}]});
N('skewer.yaki','SKW-R 7',"YAKITORI. CAUTION: SKEWER IS NOT FOOD. THE LESSON IS FREE.",
{fx(){ if(S.credits<5){ G.toast('Not enough credits.'); return 'skip'; }
  S.credits-=5; G.eat(15,2); save(); G.toast('+15 food'); },
 choices:[{t:'Another', n:'skewer.hi'},{t:'(Done)', n:null}]});
N('skewer.churro','SKW-R 7',"CHURRO. THE SUGAR IS REAL. NOTHING ELSE IS. ENJOY.",
{fx(){ if(S.credits<4){ G.toast('Not enough credits.'); return 'skip'; }
  S.credits-=4; G.eat(12,1); save(); G.toast('+12 food'); },
 choices:[{t:'Another', n:'skewer.hi'},{t:'(Done)', n:null}]});
N('tomas.hi','Tomas',
"Excuse me — would you photograph me with the Array? My lenses refuse. They say the ring 'contains non-consenting spacetime.' Cameras have opinions now. I miss 2030.",
{choices:[
 {t:'"What do you think it is?"', n:'tomas.theory'},
 {t:'"Sure." (mime a photo)', n:'tomas.photo'}]});
N('tomas.theory','Tomas',
"Officially? 'Vacuum research.' But my cousin's neighbor's nanny-bot says a man walked out of it last month wearing nineteen-year-old shoes. Tourists believe anything. I believe everything. Saves time.");
N('tomas.photo','Tomas',
"You just... moved your hands. There's no camera. ...I love it. Most analog thing I've seen all year. Here, the memory's better anyway.");
N('wrench.hi','Hex',
"Mind the grate — loop coil's venting tonight. You want infrastructure gossip? The hyperloop reroutes itself around birds now. BIRDS. Three day delay to retrain the model. Nobody told the birds.",
{choices:[{t:'"Sounds frustrating."', n:'wrench.2'},{t:'(Leave)', n:null}]});
N('wrench.2','Hex',
"Frustrating? It's job security. The machines fix everything except each other's manners.");
N('nia.hi','Nia',
"They restocked the real oranges. REAL ones, soil-grown — forty credits each. I buy one a year, on my birthday, and I eat it very slowly in front of the printer out of spite.");
N('goro.hi','Goro',
"Forty years I've eaten here. The algorithm started me on salmon. We've been through some things together, the belt and I. Tonight it sent me oyster. It knows about the divorce.");
N('pim.hi','Pim',
"Sit, sit. I'm a poet. Pre-'29 model — fully human, increasingly obsolete.\nDee keeps me in whiskey, I keep the bar in melancholy. It's a circular economy.",
{choices:[{t:'"Recite something."', n:'pim.poem'},{t:'(Leave)', n:null}]});
N('pim.poem','Pim',
"'The stars came back when the engines learned to whisper — / and nobody looked up, / because the feed was brighter.'\n...The jukebox hates me. Everyone's a critic.");

export function genericGigDeliver(key){
  const id='gig.'+key;
  N(id, NPCS[key].name, "Package for me? ...Signed. Tell the noodle robot his logistics empire grows by the day.",
    {fx(){ deliveryDone(); }});
  return id;
}
export function npcPresent(n){
  if(!n.hours) return true;
  const h=S.minutes/60, [a,b]=n.hours;
  return a<b ? (h>=a&&h<b) : (h>=a||h<b);
}
export function npcEntryNode(key){
  const f=S.flags;
  if(f.carrying && f.carrying.to===key){
    if(!f.carrying.gig){
      if(key==='mara') return 'mara.deliver';
      if(key==='priya') return 'priya.deliver';
      if(key==='okafor') return 'okafor.deliver';
      if(key==='tan') return 'tan.deliver';
    }
    return genericGigDeliver(key);
  }
  switch(key){
    case 'elias':
      if(S.quests.parkEcho==='active' && f.muggerDown && !f.drop) return 'elias.afterFight';
      return f.metElias? 'elias.later' : 'elias.hi';
    case 'vendo':
      if(!f.metVendo) return 'vendo.hi';
      if(f.carrying) return 'vendo.carrying';
      if(S.quests.deliveries==='active')
        return f.deliveries===1? 'vendo.job2' : f.deliveries===2? 'vendo.job3' : 'vendo.job1';
      if(S.quests.deliveries==='done') return Math.random()<.35? 'vendo.flavor':'vendo.gig';
      return 'vendo.work';
    case 'mara': return 'mara.hi';
    case 'tan':  return f.hasKey? 'tan.after' : 'tan.hi';
    case 'priya':return 'priya.hi';
    case 'okafor':
      if(S.quests.wayBack==='active' || S.flags.chapterDone) return 'okafor.final';
      return 'okafor.early';
    case 'kenji': return 'kenji.hi';
    case 'gg9':  return 'gg9.hi';
    case 'vex':  return f.vexMet? 'vex.again' : 'vex.hi';
    case 'dex':  return 'dex.hi';
    case 'mailbot': return 'post.hi';
    case 'roxy': return f.roxyMet? 'roxy.again' : 'roxy.hi';
    case 'sable': return 'sable.hi';
    case 'sef':  return 'sef.hi';
    case 'dee':  return 'dee.hi';
    case 'crow': return 'crow.hi';
    case 'juno': return 'juno.hi';
    case 'skewer': return 'skewer.hi';
    case 'tomas': return 'tomas.hi';
    case 'wrench': return 'wrench.hi';
    case 'nia':  return 'nia.hi';
    case 'goro': return 'goro.hi';
    case 'pim':  return 'pim.hi';
  }
}

export const INTRO=[
 'Cold metal. The smell of rain that never fell.',
 'You remember closing your eyes in 2026.\nThe enrollment clinic. The trial. “A short calibration nap,” they said.',
 'Your phone is dead. The skyline is wrong.\nThe streetlights are listening.',
 'NEW MERIDIAN · JUNE 12, 2045 · 19:05',
];

/* =====================================================================
   PIXEL SPRITES (billboard characters) — ported from the 2D game
   ===================================================================== */
const TORSO = [
'....kkkkkkkk....','...khhHHhhhhk...','...khhhhhhhhk...','...khfssssssk...',
'...khsessessk...','...khssssssSk...','....kssssmsS....','.....kssssS.....',
'...kjjjwwjjjk...','..kjjjjwwjjjJk..','..kjjjjwwjjjJk..','..kjj.wwww.jJk..',
'..kjj.wwww.jJk..','..kss.wwww.sSk..','....knnnnnnk....','.....nnnnnn.....'];
const LEGS_IDLE = [
'.....nN..nN.....','.....nN..nN.....','.....nN..nN.....','.....nN..nN.....',
'.....nN..nN.....','.....nN..nN.....','....bbB..bbB....','....kkk..kkk....'];
const LEGS_W1 = [
'.....nnnnnN.....','....nnn..nnN....','....nN....nN....','...nnN....nnN...',
'...nN......nN...','..bnN......nNb..','..bbB......bbB..','..kk........kk..'];
const LEGS_W2 = [
'.....nnnnN......','.....nnnnN......','.....nN.nN......','.....nN.nN......',
'....nnN.nN......','....bbB.nN......','....kkk.bbB.....','........kkk.....'];

export const PALS = {
  player:{h:'#23203a',f:'#181530',s:'#e8b08c',e:'#1a1c2c',j:'#2e7f74',w:'#e9e7e2',n:'#283052',b:'#d65a3a'},
  elias: {h:'#e8e6e2',f:'#b8b6b2',s:'#a9744f',e:'#241f1a',j:'#6e5a3e',w:'#cfc6ae',n:'#41382c',b:'#2c2620',p:'#4a3a28'},
  mara:  {h:'#8a4a2c',f:'#6a361e',s:'#f0c4a0',e:'#22180f',j:'#b8413f',w:'#f2ead8',n:'#3a3148',b:'#221d2e',a:'#5e4632'},
  tan:   {h:'#2a2a2e',f:'#1c1c20',s:'#e9c08e',e:'#1c1810',j:'#3a3f5c',w:'#dfe3ee',n:'#2c3048',b:'#16141e'},
  priya: {h:'#161226',f:'#0e0b1c',s:'#c98e62',e:'#1a120a',j:'#e8a020',w:'#2e2a40',n:'#34304a',b:'#d8d8e0'},
  okafor:{h:'#100e1c',f:'#080714',s:'#7e4f33',e:'#140e08',j:'#eef0f4',w:'#43ffd9',n:'#3c3a52',b:'#dadce4'},
  kenji: {h:'#1c1826',f:'#120e1c',s:'#eebf94',e:'#1c140c',j:'#e8e4da',w:'#3a3140',n:'#2c2838',b:'#1c1826'},
  vex:   {h:'#43ffd9',f:'#2bbf9f',s:'#d8a87e',e:'#140e1c',j:'#33203f',w:'#ff4f9a',n:'#1f1b2e',b:'#8a32a0'},
  raze:  {h:'#241f33',f:'#181426',s:'#b88a66',e:'#ff5560',j:'#312a44',w:'#1c1828',n:'#221e30',b:'#15121f'},
  roxy:  {h:'#f2d8e8',f:'#d8b8cc',s:'#e8b08c',e:'#241218',j:'#ff2f7a',w:'#1a1022',n:'#e8b08c',b:'#ff2f7a'},
  sable: {h:'#8a3fff',f:'#6a2fd0',s:'#caa27e',e:'#160e1c',j:'#1c1828',w:'#ff2f7a',n:'#1c1828',b:'#0e0c16'},
  sef:   {h:'#0c0a14',f:'#080610',s:'#8a5a3a',e:'#0c0806',j:'#14121f',w:'#2c2838',n:'#14121f',b:'#0a0810'},
  dee:   {h:'#ff8c3a',f:'#d0681e',s:'#f0c4a0',e:'#22150c',j:'#2a2a36',w:'#e8e4da',n:'#2c2838',b:'#1c1826'},
  crow:  {h:'#1a1a22',f:'#101016',s:'#cfa27e',e:'#0c0a08',j:'#23202c',w:'#0e0c16',n:'#23202c',b:'#0e0c16'},
  ped1:  {h:'#4a3260',f:'#382450',s:'#e5b491',e:'#1a1c2c',j:'#5a4a8a',w:'#cfd2da',n:'#33304a',b:'#5e5a72'},
  ped2:  {h:'#c2541f',f:'#a04015',s:'#f2cba6',e:'#22180f',j:'#3f7f9f',w:'#e8e2cf',n:'#2c3a44',b:'#27313a'},
  ped3:  {h:'#d8d2c2',f:'#b8b2a2',s:'#caa27e',e:'#1c1810',j:'#7f3f6f',w:'#ddd5e5',n:'#3a2c44',b:'#2c2235'},
};
export const PATCHES = {
  elias: [{row:0,str:'...pppppppppp...'},{row:1,str:'..pppppppppppp..'},{row:2,str:'...hhhhhhhhhh...'}],
  mara:  [{row:11,str:'..kjj.awwa.jJk..'},{row:12,str:'..kjj.awwa.jJk..'},{row:13,str:'..kss.awwa.sSk..'}],
  okafor:[{row:14,str:'....kjjjjjjk....'},{row:15,str:'....jjjjjjjJ....'}],
  kenji: [{row:2,str:'...jjjjjjjjjj...'}],
  raze:  [{row:0,str:'....jjjjjjjj....'},{row:1,str:'...jjjjjjjjjj...'},{row:2,str:'...jjjjjjjjjj...'},
          {row:3,str:'...jjssssssjj...'},{row:4,str:'...jjsessejjj...'},{row:5,str:'...jjssssssjj...'},
          {row:6,str:'....jjwwwwjj....'}],
};
function shadeHex(hex,f){
  const n=parseInt(hex.slice(1),16);
  const ch=v=>('0'+clamp(Math.round(v),0,255).toString(16)).slice(-2);
  return '#'+ch(((n>>16)&255)*f)+ch(((n>>8)&255)*f)+ch((n&255)*f);
}
function fullPal(p){
  const q=Object.assign({},p);
  q.S=q.S||shadeHex(p.s,.78); q.J=q.J||shadeHex(p.j,.72); q.N=q.N||shadeHex(p.n,.7);
  q.B=q.B||shadeHex(p.b,.6);  q.H=q.H||shadeHex(p.h,1.5); q.f=q.f||shadeHex(p.s,.82);
  q.m=q.m||shadeHex(p.s,.55); q.k=q.k||'#0d0c16';
  return q;
}
export function spriteCanvas(rows, pal){
  const h=rows.length, w=rows[0].length;
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const g=c.getContext('2d');
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const col=pal[rows[y][x]];
    if(col){ g.fillStyle=col; g.fillRect(x,y,1,1); }
  }
  return c;
}
export function humanCanvases(palKey, patchKey){
  const pal=fullPal(PALS[palKey]);
  let torso=TORSO.slice();
  if(patchKey && PATCHES[patchKey]) for(const p of PATCHES[patchKey]) torso[p.row]=p.str;
  const F=legs=>spriteCanvas(torso.concat(legs), pal);
  return { idle:F(LEGS_IDLE), walk:[F(LEGS_W1),F(LEGS_W2),
    F(LEGS_W1.map(r=>r.split('').reverse().join(''))),F(LEGS_W2)] };
}
export const ROBOT_ROWS = [
'....mmmmmmmm....','...mmmmmmmmmm...','...mGGGGGGGGm...','...mGoGGGGoGm...',
'...mGGGGGGGGm...','...mmmmmmmmmm...','.....mm..mm.....','....mmmmmmmm....',
'..ammmmmmmmmma..','..a.mmccccmm.a..','..a.mmccccmm.a..','..a.mmmmmmmm.a..',
'..aa.mmmmmm.aa..','...a.mmmmmm.a...','.....mmmmmm.....','.....mm..mm.....',
'.....mm..mm.....','.....mm..mm.....','....tmm..mmt....','....tmm..mmt....',
'....ttt..ttt....','....ttt..ttt....','................','................'];
export const PAL_ROBOT={m:'#9aa3b8',G:'#142030',o:'#43ffd9',c:'#ff4f9a',a:'#6a7286',t:'#3a4154'};
