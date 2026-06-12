/* =====================================================================
   ROBOTIQUE 3D — engine module (Three.js r160)
   First-person open-world New Meridian, June 12 2045.
   ===================================================================== */
import * as THREE from 'three';
import {S, save, loadSave, hasSave, clearSave, clamp, setCtx,
        ITEMS, hasItem, QUESTS, activeQuest, questTargetPos,
        DOORS, PARENT, SCENE_NAMES, ROOMS, NPCS, PEDS, SAYS, npcEntryNode,
        INTRO, PICKUPS, humanCanvases, spriteCanvas, ROBOT_ROWS, PAL_ROBOT, PALS} from './content.js?v=9';
import {UI, INPUT, TOUCH} from './ui.js?v=9';

/* ---------------- renderer / scene ---------------- */
const canvas=document.getElementById('gl');
const renderer=new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x070a1c);
scene.fog=new THREE.Fog(0x0a0c20, 25, 170);
const camera=new THREE.PerspectiveCamera(72, innerWidth/innerHeight, .1, 500);
camera.rotation.order='YXZ';
let pitch=0;
addEventListener('resize', ()=>{
  renderer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
});
if(window.visualViewport) visualViewport.addEventListener('resize', ()=>{
  renderer.setSize(visualViewport.width,visualViewport.height);
  camera.aspect=visualViewport.width/visualViewport.height; camera.updateProjectionMatrix();
});

scene.add(new THREE.AmbientLight(0x33365a, 1.1));
const hemi=new THREE.HemisphereLight(0x2a2150, 0x0c0a18, .8); scene.add(hemi);
const moonLight=new THREE.DirectionalLight(0x8a9ad0, .35);
moonLight.position.set(80,120,-60); scene.add(moonLight);

/* ---------------- texture helpers ---------------- */
function ctex(c){ const t=new THREE.CanvasTexture(c);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter;
  t.colorSpace=THREE.SRGBColorSpace; return t; }
function buildingTex(seed, base, winA, winB, neon){
  const c=document.createElement('canvas'); c.width=64; c.height=128;
  const g=c.getContext('2d');
  g.fillStyle=base; g.fillRect(0,0,64,128);
  let s=seed; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  for(let y=6;y<120;y+=10) for(let x=4;x<58;x+=8){
    if(rnd()<.5){ g.fillStyle = rnd()<.78? (rnd()<.5?winA:winB) : '#0a0d1a';
      g.fillRect(x,y,5,6); }
  }
  if(neon && rnd()<.85){ g.fillStyle=neon; g.fillRect(0,0,64,3);
    if(rnd()<.5) g.fillRect((rnd()*50)|0,8,3,30+rnd()*40|0); }
  return ctex(c);
}
function flatMat(color){ return new THREE.MeshBasicMaterial({color}); }
function texSignCanvas(text, color, bg){
  const c=document.createElement('canvas'); c.width=256; c.height=64;
  const g=c.getContext('2d');
  g.fillStyle=bg||'#0b0916'; g.fillRect(0,0,256,64);
  g.strokeStyle=color; g.lineWidth=4; g.strokeRect(4,4,248,56);
  g.fillStyle=color; g.font='bold 30px monospace'; g.textAlign='center'; g.textBaseline='middle';
  g.shadowColor=color; g.shadowBlur=16;
  g.fillText(text,128,34);
  return c;
}
function neonSign(text, color, w, h){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshBasicMaterial({map:ctex(texSignCanvas(text,color)), transparent:false}));
  return m;
}
const texLoader=new THREE.TextureLoader();
function artTex(file){
  const t=texLoader.load('assets/'+file);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter;
  t.colorSpace=THREE.SRGBColorSpace; return t;
}

/* ---------------- world geometry ---------------- */
const world=new THREE.Group(); scene.add(world);

/* ground + roads */
{
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400,12,12), flatMat(0x0b0d18));
  ground.rotation.x=-Math.PI/2; ground.position.set(150,0,500); world.add(ground);
  const roadMat=flatMat(0x14172a);
  const main=new THREE.Mesh(new THREE.PlaneGeometry(540,10,24,1), roadMat);
  main.rotation.x=-Math.PI/2; main.position.set(0,.02,0); world.add(main);
  const row=new THREE.Mesh(new THREE.PlaneGeometry(14,150,1,8), roadMat);
  row.rotation.x=-Math.PI/2; row.position.set(100,.02,-80); world.add(row);
  const walkMat=flatMat(0x191d33);
  for(const z of [-7,7]){
    const sw=new THREE.Mesh(new THREE.PlaneGeometry(540,4,24,1), walkMat);
    sw.rotation.x=-Math.PI/2; sw.position.set(0,.03,z); world.add(sw);
  }
  // center line dashes
  const dashMat=flatMat(0x2a3050);
  for(let x=-250;x<250;x+=14){
    const d=new THREE.Mesh(new THREE.PlaneGeometry(5,.4), dashMat);
    d.rotation.x=-Math.PI/2; d.position.set(x,.04,0); world.add(d);
  }
  // park lawn
  const lawn=new THREE.Mesh(new THREE.PlaneGeometry(120,40,6,2), flatMat(0x0e1f18));
  lawn.rotation.x=-Math.PI/2; lawn.position.set(-200,.025,18); world.add(lawn);
}

/* sky: stars + moon */
{
  const starGeo=new THREE.BufferGeometry();
  const pos=[];
  for(let i=0;i<700;i++){
    const a=Math.random()*Math.PI*2, e=Math.random()*Math.PI*.45+.06, r=380;
    pos.push(Math.cos(a)*Math.cos(e)*r, Math.sin(e)*r, Math.sin(a)*Math.cos(e)*r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  const stars=new THREE.Points(starGeo, new THREE.PointsMaterial({color:0xc8d2ff, size:1.6, sizeAttenuation:false, fog:false}));
  scene.add(stars);
  const mc=document.createElement('canvas'); mc.width=64; mc.height=64;
  const mg=mc.getContext('2d');
  mg.fillStyle='#f4ead8'; mg.beginPath(); mg.arc(32,32,26,0,7); mg.fill();
  mg.fillStyle='#d8c8b0'; mg.beginPath(); mg.arc(22,24,6,0,7); mg.fill();
  mg.beginPath(); mg.arc(40,40,4,0,7); mg.fill();
  const moon=new THREE.Sprite(new THREE.SpriteMaterial({map:ctex(mc), fog:false}));
  moon.scale.set(34,34,1); moon.position.set(140,200,-260); scene.add(moon);
}

/* buildings along the main street */
const NEONS=['#43ffd9','#ff4f9a','#ffd23f','#7a5cff','#ff8c3a'];
function addBuilding(x,z,w,d,h,seed,opts={}){
  const tex=buildingTex(seed, opts.base||'#1c2240', '#8a78b0', '#43ffd9', NEONS[seed%5]);
  tex.repeat.set(Math.max(1,Math.round(w/10)), Math.max(1,Math.round(h/22)));
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  const side=new THREE.MeshBasicMaterial({map:tex});
  const top=flatMat(0x0d101e);
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), [side,side,top,top,side,side]);
  m.position.set(x,h/2,z); world.add(m);
  return m;
}
{
  let seed=11;
  // north side: front faces at z=-10 (doors/signs sit at -9.9, in front)
  // gaps: Velvet Row junction (x 84..118) and the open campus plaza (x>150)
  for(let x=-250;x<250;){
    const w=14+((seed*7)%18), h=18+((seed*13)%46);
    if(!(x+w>84 && x<118) && !(x+w>150)) addBuilding(x+w/2, -18-((seed%3)*2), w, 16, h, seed);
    x+=w+2; seed+=3;
  }
  // campus lab (holds the Array door at x=200)
  addBuilding(200, -18, 28, 16, 13, 77, {base:'#16242c'});
  // south side: front faces at z=+10
  for(let x=-140;x<250;){
    const w=14+((seed*5)%20), h=14+((seed*11)%40);
    addBuilding(x+w/2, 18+((seed%3)*2), w, 16, h, seed);
    x+=w+2; seed+=5;
  }
  // distant skyline ring
  for(let i=0;i<26;i++){
    const a=i/26*Math.PI*2;
    addBuilding(Math.cos(a)*300, Math.sin(a)*300, 30,30, 50+((i*37)%90), i*7+5, {base:'#141a32'});
  }
  // Velvet Row walls: inner faces at x=89 and x=111
  for(let z=-18;z>-150;){
    const d=12+((seed*7)%10), h=16+((seed*13)%26);
    addBuilding(84,z-d/2,10,d,h,seed,{base:'#2a1226'}); seed+=2;
    const d2=12+((seed*5)%12), h2=16+((seed*11)%24);
    addBuilding(116,z-d2/2,10,d2,h2,seed,{base:'#2a1226'}); seed+=2;
    z-=Math.max(d,d2)+2;
  }
  // Row dead-end (Neon Garden)
  addBuilding(100,-140,24,12,22,99,{base:'#1a0a2a'});
}

/* shop fronts: sign + door plane on the north row */
const doorMat=new THREE.MeshBasicMaterial({color:0x10131f});
function shopFront(x, label, color){
  const sign=neonSign(label, color, 10, 2.4);
  sign.position.set(x, 5.4, -9.9); world.add(sign);
  const door=new THREE.Mesh(new THREE.PlaneGeometry(2.2,3.2), doorMat.clone());
  door.material.color=new THREE.Color(color).multiplyScalar(.25);
  door.position.set(x, 1.6, -9.92); world.add(door);
  const frame=new THREE.Mesh(new THREE.PlaneGeometry(2.8,3.6), flatMat(0x2e3560));
  frame.position.set(x,1.8,-9.95); world.add(frame);
}
shopFront(-40,'GREENGRID','#43d97a');
shopFront(0,'CROOKED BEAN','#ff4f9a');
shopFront(40,'KAITEN-45','#ff5560');
shopFront(-100,'TANAKA TOWERS','#ffd23f');
shopFront(200,'MERIDIAN ARRAY','#43ffd9');

/* ansimuz banner planes (animated) */
const ANIM_SIGNS=[];
function bannerPlane(frames, x,y,z, w,h, ry){
  const texs=frames.map(artTex);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshBasicMaterial({map:texs[0], transparent:true, side:THREE.DoubleSide}));
  m.position.set(x,y,z); m.rotation.y=ry||0; world.add(m);
  ANIM_SIGNS.push({m, texs, rate:5+Math.random()*3});
  return m;
}
bannerPlane(['banner-big-1.png','banner-big-2.png','banner-big-3.png','banner-big-4.png'], -52,8,-9.8, 3,8);
bannerPlane(['banner-coke-1.png','banner-coke-2.png','banner-coke-3.png'], -150,9,-9.8, 2.6,7.4);
bannerPlane(['banner-neon-1.png','banner-neon-2.png','banner-neon-3.png','banner-neon-4.png'], 14,7,-9.8, 2,5);
bannerPlane(['banner-sushi-1.png','banner-sushi-2.png','banner-sushi-3.png'], 47,3.6,-9.8, 4.4,1.6);
bannerPlane(['monitor-1.png','monitor-2.png','monitor-3.png','monitor-4.png'], 70,7,-9.8, 2.6,2.2);
bannerPlane(['banner-side-1.png','banner-side-2.png','banner-side-3.png','banner-side-4.png'], 120,8,15.8, 2,7.6, Math.PI);
{ // HOTEL sign over Tanaka Towers
  const m=new THREE.Mesh(new THREE.PlaneGeometry(9,4.6),
    new THREE.MeshBasicMaterial({map:artTex('hotel-sign.png'), transparent:true}));
  m.position.set(-100,10.5,-9.7); world.add(m);
}
/* Velvet Row venue signs */
function rowSign(label,color,z,side){ // side: -1 west wall (face x=89), +1 east (face x=111)
  const sign=neonSign(label,color,8,2);
  sign.position.set(side<0? 89.15:110.85, 4.6, z);
  sign.rotation.y= side<0? Math.PI/2 : -Math.PI/2;
  world.add(sign);
}
rowSign('PINK NOODLE','#ff8c3a',-35,-1);
rowSign('LIVE · LIVE','#ff2f7a',-50,+1);
rowSign('THE STATIC','#43ffd9',-75,-1);
rowSign('GIRLS GIRLS','#ff2f7a',-92,+1);
rowSign('HOT·L','#ff5560',-110,-1);
{ const g=neonSign('NEON GARDEN','#b14aff',14,3);
  g.position.set(100,7.5,-133.8); world.add(g);
  const arch=new THREE.Mesh(new THREE.PlaneGeometry(4,4.4), flatMat(0x120822));
  arch.position.set(100,2.2,-133.9); world.add(arch); }
{ const d=new THREE.Mesh(new THREE.PlaneGeometry(2.2,3.2), flatMat(0x0e2a2a));
  d.position.set(89.1,1.6,-75); d.rotation.y=Math.PI/2; world.add(d); }

/* props */
function lamp(x,z,color){
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,5,5), flatMat(0x222840));
  pole.position.set(x,2.5,z); world.add(pole);
  const head=new THREE.Mesh(new THREE.BoxGeometry(.8,.18,.3),
    new THREE.MeshBasicMaterial({color:color||0x43ffd9}));
  head.position.set(x,5,z); world.add(head);
}
for(let x=-240;x<250;x+=40){ lamp(x,-8.5); lamp(x+20,8.5); }
for(let z=-25;z>-135;z-=22){ lamp(92.5,z,0xff2f7a); lamp(107.5,z-10,0xff2f7a); }
function tree(x,z,s){
  const t=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,1.6,5), flatMat(0x3a2c22));
  t.position.set(x,.8,z); world.add(t);
  const c=new THREE.Mesh(new THREE.ConeGeometry(1.4*s,2.8*s,7), flatMat(0x1d4a3a));
  c.position.set(x,1.6+1.4*s,z); world.add(c);
}
tree(-225,14,1); tree(-212,22,1.2); tree(-188,16,.9); tree(-176,24,1.1); tree(-165,12,1);
{ // bench
  const seat=new THREE.Mesh(new THREE.BoxGeometry(2.4,.12,.6), flatMat(0x6e5138));
  seat.position.set(-200,.55,7); world.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(2.4,.7,.1), flatMat(0x6e5138));
  back.position.set(-200,1.05,7.3); world.add(back);
  for(const dx of [-1,1]){ const leg=new THREE.Mesh(new THREE.BoxGeometry(.12,.55,.5), flatMat(0x23283c));
    leg.position.set(-200+dx,.27,7); world.add(leg); }
}
{ // noodle stall
  const body=new THREE.Mesh(new THREE.BoxGeometry(3,2,1.6), flatMat(0x211b34));
  body.position.set(18,1,7.5); world.add(body);
  const awn=new THREE.Mesh(new THREE.BoxGeometry(3.6,.14,2.2),
    new THREE.MeshBasicMaterial({color:0xff4f9a}));
  awn.position.set(18,2.3,7.3); world.add(awn);
  const sc=texSignCanvas('NOODLES','#43ffd9');
  const s=new THREE.Mesh(new THREE.PlaneGeometry(2.8,.8),
    new THREE.MeshBasicMaterial({map:ctex(sc)}));
  s.position.set(18,1.7,6.65); s.rotation.y=Math.PI; world.add(s);
}
/* the Meridian Array — wormhole ring */
let arrayRing;
{
  arrayRing=new THREE.Mesh(new THREE.TorusGeometry(7,.6,10,40),
    new THREE.MeshBasicMaterial({color:0x43ffd9}));
  arrayRing.position.set(228,24,-24); world.add(arrayRing);   // floats over the campus
  const inner=new THREE.Mesh(new THREE.TorusGeometry(5.4,.18,8,40),
    new THREE.MeshBasicMaterial({color:0xff4f9a}));
  inner.position.copy(arrayRing.position); world.add(inner);
  arrayRing.userData.inner=inner;
  const glow=new THREE.PointLight(0x43ffd9, 60, 90); glow.position.set(228,22,-22); scene.add(glow);
  const base=new THREE.Mesh(new THREE.BoxGeometry(2.4,17,2.4), flatMat(0x162830));
  base.position.set(228,8.5,-24); world.add(base);            // support pylon
}
const rowLight=new THREE.PointLight(0xff2f7a, 40, 60); rowLight.position.set(100,8,-80); scene.add(rowLight);
const gardenLight=new THREE.PointLight(0xb14aff, 30, 40); gardenLight.position.set(100,5,-128); scene.add(gardenLight);
const parkLight=new THREE.PointLight(0x4a90b8, 18, 50); parkLight.position.set(-200,7,8); scene.add(parkLight);

/* =====================================================================
   FLYING CARS — 3D traffic lanes + the Sky-Cab
   ===================================================================== */
function buildCar(color, taxi){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(3.4,.7,1.6), flatMat(color));
  body.position.y=.35; g.add(body);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(1.7,.55,1.4), flatMat(0x16202c));
  cab.position.set(-.2,.95,0); g.add(cab);
  const skirt=new THREE.Mesh(new THREE.BoxGeometry(3.5,.1,1.7),
    new THREE.MeshBasicMaterial({color:0x43ffd9}));
  skirt.position.y=.02; g.add(skirt);
  const engine=new THREE.Mesh(new THREE.BoxGeometry(.18,.4,1.1),
    new THREE.MeshBasicMaterial({color:0xff4f9a}));
  engine.position.set(-1.75,.45,0); g.add(engine);
  const lights=new THREE.Mesh(new THREE.BoxGeometry(.12,.16,1.2),
    new THREE.MeshBasicMaterial({color:0xfff3c0}));
  lights.position.set(1.72,.35,0); g.add(lights);
  if(taxi){
    const sign=new THREE.Mesh(new THREE.BoxGeometry(.8,.3,.5),
      new THREE.MeshBasicMaterial({color:0xffd23f}));
    sign.position.set(-.2,1.42,0); g.add(sign);
  }
  return g;
}
const TRAFFIC=[];
{
  const cols=[0x8a2236,0x1f4f6a,0x3a6a2a,0x5a3a7a,0x6a5a2a,0xffc014,0xffc014,0x2a2a3a];
  for(let i=0;i<10;i++){
    const car=buildCar(cols[i%cols.length], i===5||i===6);   // two air taxis in traffic
    scene.add(car);
    TRAFFIC.push({g:car, y:30+(i%4)*6, z:(i%2? -1:1)*(14+(i%3)*11),
      v:(8+(i%5)*3)*((i%2)?1:-1), x:-280+i*55});
  }
  for(let i=0;i<3;i++){      // crossing lanes over Velvet Row
    const car=buildCar([0xb14aff,0xff8c3a,0x2a6a7a][i], false);
    scene.add(car);
    TRAFFIC.push({g:car, axis:'z', y:26+i*5, x:94+i*5, v:(i%2?9:-9), z:-200+i*100});
  }
}
/* Sky-Cab pads (fast travel + the taxi ride) */
const PADS=[{name:'Memorial Park', x:-215, z:2},{name:'Transit Plaza', x:128, z:2},
            {name:'Research Campus', x:232, z:2}];
for(const p of PADS){
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,.08,18),
    new THREE.MeshBasicMaterial({color:0x18b89a}));
  ring.position.set(p.x,.06,p.z); world.add(ring);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,4.2,5), flatMat(0x222840));
  pole.position.set(p.x+2.6,2.1,p.z); world.add(pole);
  const sign=neonSign('SKY-CAB','#ffd23f',3.4,1);
  sign.position.set(p.x+2.6,4.6,p.z); world.add(sign);
}
const taxiCab=buildCar(0xffc014,true); taxiCab.visible=false; scene.add(taxiCab);
let RIDE=null, rideY=1.62;
function padMenu(idx){
  const opts=PADS.map((p,i)=>i).filter(i=>i!==idx);
  SAYS['cab.menu']={who:'SKY-CAB PAD',
    text:'Lane network online. Destination?'+(S.flags.rodeCab?' Fare: ₣8 per hop.':' First courier hop is free.'),
    choices:[...opts.map(i=>({t:PADS[i].name+(S.flags.rodeCab?' — ₣8':' — FREE'), n:'cab.go'+i})),
             {t:'(Step back)', n:null}]};
  for(const i of opts){
    SAYS['cab.go'+i]={who:'SKY-CAB', text:'Cab descending. Watch your head.',
      fx:()=>{
        const fare=S.flags.rodeCab?8:0;
        if(S.credits<fare){ UI.toast('Not enough credits (₣8).'); return 'skip'; }
        S.credits-=fare; UI.refreshHUD();
        setTimeout(()=>{ UI.close(); startRide(idx,i); }, 400);
      }};
  }
  UI.open('cab.menu');
}
function startRide(from,to){
  const a=PADS[from], b=PADS[to];
  const h=26+Math.random()*5;
  const pts=[
    new THREE.Vector3(a.x, 1.7, a.z),
    new THREE.Vector3(a.x, h*.7, a.z-14),
    new THREE.Vector3((a.x+b.x)/2, h, -26),
    new THREE.Vector3(b.x, h*.7, b.z-14),
    new THREE.Vector3(b.x, 1.7, b.z),
  ];
  RIDE={curve:new THREE.CatmullRomCurve3(pts), t:0,
        dur:Math.max(11, Math.abs(a.x-b.x)/16)};
  taxiCab.visible=true;
  setTimeout(()=>UI.open(S.flags.rodeCab? 'otto.again':'otto.1'), 1400);
}
const DRONES=[];
for(let i=0;i<3;i++){
  const texs=['drone-1.png','drone-2.png','drone-3.png','drone-4.png'].map(artTex);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:texs[0], transparent:true}));
  sp.scale.set(3,3,1); sp.position.set(-100+i*120, 12+i*2, (i%2? -12:12));
  scene.add(sp); DRONES.push({sp,texs,v:(i%2?2:-2.4)});
}

/* ---------------- interiors ---------------- */
function room(key, accent, build){
  const [cx,cz]=ROOMS[key];
  const grp=new THREE.Group(); grp.position.set(cx,0,cz); world.add(grp);
  const box=new THREE.Mesh(new THREE.BoxGeometry(16,4.2,14),
    new THREE.MeshBasicMaterial({color:0x171527, side:THREE.BackSide}));
  box.position.y=2.1; grp.add(box);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(16,14), flatMat(0x100e1c));
  floor.rotation.x=-Math.PI/2; floor.position.y=.01; grp.add(floor);
  const strip=new THREE.Mesh(new THREE.BoxGeometry(15.6,.12,.12),
    new THREE.MeshBasicMaterial({color:accent}));
  strip.position.set(0,3.9,-6.8); grp.add(strip);
  // exit door marker on the +z wall
  const door=new THREE.Mesh(new THREE.PlaneGeometry(2,3.2),
    new THREE.MeshBasicMaterial({color:new THREE.Color(accent).multiplyScalar(.35)}));
  door.position.set(0,1.6,6.93); door.rotation.y=Math.PI; grp.add(door);
  const lightP=new THREE.PointLight(accent, 14, 18); lightP.position.set(0,3.4,0); grp.add(lightP);
  const sign=neonSign(SCENE_NAMES[key]||key, '#'+new THREE.Color(accent).getHexString(), 8, 1.6);
  sign.position.set(0,3.2,-6.9); grp.add(sign);
  if(build) build(grp);
  return grp;
}
/* interior furnishing helpers */
function shelf(grp,x,z,c1,ry){
  const u=new THREE.Group(); u.position.set(x,0,z); if(ry) u.rotation.y=ry; grp.add(u);
  const s=new THREE.Mesh(new THREE.BoxGeometry(3.4,2.2,.8), flatMat(0x23332a));
  s.position.y=1.1; u.add(s);
  const glow=new THREE.Mesh(new THREE.BoxGeometry(3.4,.1,.84),
    new THREE.MeshBasicMaterial({color:c1})); glow.position.y=2.26; u.add(glow);
  const prods=[0xff8c3a,0x43ffd9,0xffd23f,0xff4f9a,0x7a5cff,0xe8e6e2];
  for(let row=0;row<3;row++) for(let i=0;i<6;i++){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.32,.4,.3),
      new THREE.MeshBasicMaterial({color:prods[(row*6+i+x|0)%6&5]||0xff8c3a}));
    b.position.set(-1.35+i*.54, .55+row*.62, .45); u.add(b);
  }
}
function counter(grp,x,z,w,col){
  const c=new THREE.Mesh(new THREE.BoxGeometry(w,1.1,1), flatMat(0x3a2c20));
  c.position.set(x,.55,z); grp.add(c);
  const t=new THREE.Mesh(new THREE.BoxGeometry(w,.08,1.06),
    new THREE.MeshBasicMaterial({color:col})); t.position.set(x,1.14,z); grp.add(t);
}
function stoolRow(grp,z,xs,col){
  for(const x of xs){
    const seat=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.1,8), flatMat(col||0x8a1f3a));
    seat.position.set(x,.78,z); grp.add(seat);
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.05,.08,.74,5), flatMat(0x1a1018));
    leg.position.set(x,.37,z); grp.add(leg);
  }
}
function cafeTable(grp,x,z){
  const t=new THREE.Mesh(new THREE.CylinderGeometry(.8,.8,.08,10), flatMat(0x34294e));
  t.position.set(x,1,z); grp.add(t);
  const p=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,1,6), flatMat(0x23202c));
  p.position.set(x,.5,z); grp.add(p);
  stoolRow(grp,z+1,[x-.7,x+.7],0x23202c);
}
function pipes(grp,col){
  for(const z of [-5,-2,2]){
    const pp=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,15.4,5), flatMat(0x232840));
    pp.rotation.z=Math.PI/2; pp.position.set(0,3.95,z); grp.add(pp);
  }
  const led=new THREE.Mesh(new THREE.BoxGeometry(15.4,.06,.06),
    new THREE.MeshBasicMaterial({color:col})); led.position.set(0,3.85,0); grp.add(led);
}
function hangLamp(grp,x,z,col){
  const cord=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,1.4,4), flatMat(0x0a0810));
  cord.position.set(x,3.4,z); grp.add(cord);
  const sh=new THREE.Mesh(new THREE.ConeGeometry(.4,.34,8), flatMat(0x23202c));
  sh.position.set(x,2.7,z); grp.add(sh);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(.12,6,6),
    new THREE.MeshBasicMaterial({color:col})); bulb.position.set(x,2.56,z); grp.add(bulb);
}
function poster(grp,x,z,txt,col,ry){
  const s=neonSign(txt,col,2.6,.8); s.position.set(x,2.4,z); if(ry) s.rotation.y=ry; grp.add(s);
}
function plant(grp,x,z){
  const pot=new THREE.Mesh(new THREE.CylinderGeometry(.28,.22,.4,7), flatMat(0x5a3a28));
  pot.position.set(x,.2,z); grp.add(pot);
  const leaf=new THREE.Mesh(new THREE.ConeGeometry(.5,1.1,6), flatMat(0x2f9a55));
  leaf.position.set(x,1,z); grp.add(leaf);
}
function crate(grp,x,z,s){
  const c=new THREE.Mesh(new THREE.BoxGeometry(s,s,s), flatMat(0x2c2740));
  c.position.set(x,s/2,z); grp.add(c);
}
function cityWindow(grp,x,z,w,ry){
  const tex=buildingTex(((x*7+z)|0)&1023, '#0a0d1c', '#8a78b0', '#43ffd9', null);
  const win=new THREE.Mesh(new THREE.PlaneGeometry(w,2.2),
    new THREE.MeshBasicMaterial({map:tex}));
  win.position.set(x,2.2,z); if(ry) win.rotation.y=ry; grp.add(win);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(w+.3,.12,.12), flatMat(0x3c4468));
  frame.position.set(x,3.36,z+(ry?0:.02)); if(ry) frame.rotation.y=ry; grp.add(frame);
}

room('market', 0x43d97a, g=>{
  shelf(g,-4,-3,0x43ffd9); shelf(g,0,-3,0xff8c3a); shelf(g,4,-3,0xffd23f);
  shelf(g,-4,1,0xff4f9a); shelf(g,4,1,0x7a5cff);
  counter(g,5,4.4,4,0x43d97a);
  // freezer wall with glow doors
  for(const x of [-6.4,-5.2]){
    const fr=new THREE.Mesh(new THREE.BoxGeometry(1.1,2.6,.5), flatMat(0x1a2a33));
    fr.position.set(x,1.3,-6.4); g.add(fr);
    const gl=new THREE.Mesh(new THREE.PlaneGeometry(.9,2.2),
      new THREE.MeshBasicMaterial({color:0x6ad8ff, transparent:true, opacity:.5}));
    gl.position.set(x,1.3,-6.1); g.add(gl);
  }
  // hydroponic living wall
  for(let i=0;i<4;i++){
    const tray=new THREE.Mesh(new THREE.BoxGeometry(5,.14,.5), flatMat(0x11331f));
    tray.position.set(2,.9+i*.7,-6.5); g.add(tray);
    const grow=new THREE.Mesh(new THREE.BoxGeometry(4.8,.22,.4),
      new THREE.MeshBasicMaterial({color:0x2f9a55}));
    grow.position.set(2,1.06+i*.7,-6.45); g.add(grow);
  }
  pipes(g,0x43d97a); hangLamp(g,0,2,0xcfe8d8);
  poster(g,-6.9,0,'FRESH·PRINTED','#43d97a',Math.PI/2);
  crate(g,6.6,-5.5,.9); crate(g,6.6,-4.3,.7); plant(g,-6.6,5);
});
room('cafe', 0xff4f9a, g=>{
  counter(g,-2,-3.6,7,0xff4f9a);
  stoolRow(g,-2.4,[-4,-2,0],0x8a1f3a);
  cafeTable(g,3.5,1); cafeTable(g,-4,2.5); cafeTable(g,0,4);
  // espresso rig + pastry case on the back wall
  const rig=new THREE.Mesh(new THREE.BoxGeometry(1.6,1,.8), flatMat(0x4a3550));
  rig.position.set(-4,1.7,-6.3); g.add(rig);
  const pastry=new THREE.Mesh(new THREE.BoxGeometry(2.4,.9,.8),
    new THREE.MeshBasicMaterial({color:0xffce9a, transparent:true, opacity:.35}));
  pastry.position.set(-.5,1.6,-6.3); g.add(pastry);
  cityWindow(g,4.5,-6.85,4);
  pipes(g,0xff4f9a); hangLamp(g,3.5,1,0xffce9a); hangLamp(g,-4,2.5,0xffce9a);
  poster(g,-6.9,1,'REAL BEANS ₣40','#ff4f9a',Math.PI/2);
  plant(g,6.5,5); plant(g,-6.5,5.4);
});
room('sushi', 0xff5560, g=>{
  counter(g,0,-3.6,11,0xffd23f);
  const belt=new THREE.Mesh(new THREE.BoxGeometry(11,.1,.5), flatMat(0x3a3140));
  belt.position.set(0,1.25,-3.8); g.add(belt); g.userData.belt=[];
  for(let i=0;i<6;i++){
    const plate=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.05,8),
      new THREE.MeshBasicMaterial({color:[0xff8c5a,0xffd23f,0x43ffd9,0xb8413f][i%4]}));
    plate.position.set(-5+i*2,1.34,-3.8); g.add(plate); g.userData.belt.push(plate);
  }
  stoolRow(g,-2.6,[-4.5,-2.7,-.9,.9,2.7,4.5],0xb8413f);
  // back kitchen: bottle wall + lanterns
  for(let i=0;i<10;i++){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.26,.6,.26),
      new THREE.MeshBasicMaterial({color:[0x7a5cff,0x43ffd9,0xb8413f,0xffd23f][i%4]}));
    b.position.set(-4.5+i,2.2,-6.5); g.add(b);
  }
  for(const x of [-5,0,5]){
    const lan=new THREE.Mesh(new THREE.SphereGeometry(.26,6,6),
      new THREE.MeshBasicMaterial({color:0xff5530}));
    lan.position.set(x,3.1,-2); g.add(lan);
  }
  pipes(g,0xff5560); poster(g,6.9,0,'回転 KAITEN','#ff5560',-Math.PI/2);
  crate(g,-6.5,-5.8,.8);
});
room('lobby', 0xffd23f, g=>{
  const mb=new THREE.Mesh(new THREE.BoxGeometry(5,2.4,.4), flatMat(0x2c2740));
  mb.position.set(-4,1.4,-6.5); g.add(mb);
  for(let r=0;r<3;r++) for(let cI=0;cI<6;cI++){
    const box=new THREE.Mesh(new THREE.PlaneGeometry(.55,.5), flatMat(0x171326));
    box.position.set(-6.1+cI*.85, .9+r*.75, -6.28); g.add(box);
  }
  const elev=new THREE.Mesh(new THREE.BoxGeometry(2.4,3.4,.3), flatMat(0x3c3a52));
  elev.position.set(3,1.7,-6.6); g.add(elev);
  const out=neonSign('OUT OF SERVICE','#ff5560',3,.8); out.position.set(3,3.6,-6.4); g.add(out);
  for(let i=0;i<5;i++){ const st=new THREE.Mesh(new THREE.BoxGeometry(2.4,.18,.7), flatMat(0x2c2740));
    st.position.set(5.6,.2+i*.3,-2-i*.7); g.add(st); }
  // checker rug + sofa
  const rug=new THREE.Mesh(new THREE.PlaneGeometry(5,3), flatMat(0x241f36));
  rug.rotation.x=-Math.PI/2; rug.position.set(-1,.02,1); g.add(rug);
  const sofa=new THREE.Mesh(new THREE.BoxGeometry(2.6,.8,1), flatMat(0x3a2c4e));
  sofa.position.set(-1,.4,2.6); g.add(sofa);
  plant(g,-6.5,3); plant(g,6.5,4); hangLamp(g,-1,1,0xcfc8e8);
  poster(g,-6.9,-2,'TANAKA TOWERS','#ffd23f',Math.PI/2);
});
room('hall', 0xb14aff, g=>{
  for(const [dx,col,num] of [[-4,0xff5560,'3'],[0,0xffd23f,'4'],[4,0x3a3550,'5']]){
    const d=new THREE.Mesh(new THREE.PlaneGeometry(1.8,3), flatMat(0x171326));
    d.position.set(dx,1.5,-6.9); g.add(d);
    const lampD=new THREE.Mesh(new THREE.BoxGeometry(.5,.2,.1),
      new THREE.MeshBasicMaterial({color:col})); lampD.position.set(dx,3.2,-6.85); g.add(lampD);
    const s=neonSign('UNIT '+num,'#'+new THREE.Color(col).getHexString(),1.4,.5);
    s.position.set(dx,3.55,-6.8); g.add(s);
  }
  // worn carpet runner + flickery conduit
  const run=new THREE.Mesh(new THREE.PlaneGeometry(13,1.6), flatMat(0x2c1f33));
  run.rotation.x=-Math.PI/2; run.position.set(0,.02,0); g.add(run);
  pipes(g,0xb14aff);
  poster(g,-6.9,0,'D3X WAS HERE','#ff2f7a',Math.PI/2);
  crate(g,6.4,3,.7); crate(g,6.4,4,.5);   // someone's unclaimed delivery
  cityWindow(g,-4,6.8,3,Math.PI);
});
room('room', 0x43ffd9, g=>{
  const bed=new THREE.Mesh(new THREE.BoxGeometry(2.6,.5,1.6), flatMat(0x2a2342));
  bed.position.set(-4,.25,-4); g.add(bed);
  const sheet=new THREE.Mesh(new THREE.BoxGeometry(2.6,.1,1.6),
    new THREE.MeshBasicMaterial({color:0x43ffd9})); sheet.position.set(-4,.52,-4); g.add(sheet);
  const pillow=new THREE.Mesh(new THREE.BoxGeometry(.8,.2,1.2), flatMat(0xcfd2da));
  pillow.position.set(-5,.62,-4); g.add(pillow);
  const desk=new THREE.Mesh(new THREE.BoxGeometry(2.2,.1,1), flatMat(0x34294e));
  desk.position.set(4,1,-4.5); g.add(desk);
  const term=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.9),
    new THREE.MeshBasicMaterial({color:0x43ffd9})); term.position.set(4,1.9,-5); g.add(term);
  // kitchenette + wardrobe + rug + window with the skyline
  const kitchen=new THREE.Mesh(new THREE.BoxGeometry(3,1.1,.9), flatMat(0x2c3048));
  kitchen.position.set(-5.6,.55,2); g.add(kitchen);
  const stoveGlow=new THREE.Mesh(new THREE.PlaneGeometry(.7,.5),
    new THREE.MeshBasicMaterial({color:0xff8c3a})); stoveGlow.position.set(-5.6,1.12,2.2);
  stoveGlow.rotation.x=-Math.PI/2; g.add(stoveGlow);
  const ward=new THREE.Mesh(new THREE.BoxGeometry(1.4,3,.8), flatMat(0x23202c));
  ward.position.set(6.6,1.5,-3); g.add(ward);
  const rug=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,.02,12), flatMat(0x33304a));
  rug.position.set(0,.02,0); g.add(rug);
  cityWindow(g,0,-6.85,5);
  hangLamp(g,0,0,0xffe6b8); plant(g,6.5,5.6);
});
room('static', 0x43ffd9, g=>{
  counter(g,2,-3.6,8,0x43ffd9);
  stoolRow(g,-2.5,[-1,.8,2.6,4.4],0x8a1f3a);
  // bottle wall
  for(let r=0;r<2;r++) for(let i=0;i<12;i++){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.22,.55,.22),
      new THREE.MeshBasicMaterial({color:[0xff2f7a,0x43ffd9,0xffd23f,0xb14aff,0xff8c3a][i%5]}));
    b.position.set(-2.6+i*.92, 1.9+r*.8, -6.5); g.add(b);
  }
  const juke=new THREE.Mesh(new THREE.BoxGeometry(1.2,2,.8),
    new THREE.MeshBasicMaterial({color:0xff2f7a})); juke.position.set(6.5,1,2); g.add(juke);
  g.userData.juke=juke;
  const booth=new THREE.Mesh(new THREE.BoxGeometry(3,1,1.4), flatMat(0x2c1020));
  booth.position.set(-5,.5,1.5); g.add(booth);
  const boothTable=new THREE.Mesh(new THREE.BoxGeometry(1.6,.08,.9), flatMat(0x3a1428));
  boothTable.position.set(-5,.9,2.6); g.add(boothTable);
  hangLamp(g,-5,2,0xffd23f);
  poster(g,-6.9,-1,'PRE-29 ONLY','#43ffd9',Math.PI/2);
  pipes(g,0x18b89a); crate(g,6.5,-5.5,.8);
});

/* walkable AABBs: [x1,z1,x2,z2] */
const WALK={
  world:[[-255,-9,255,9],[-255,9,-140,32],[89.5,-150,110.5,-5],[140,-9,255,32],
         [150,-34,186,-9],[214,-34,255,-9]],   // campus plaza, either side of the lab
};
for(const k in ROOMS){ const [cx,cz]=ROOMS[k]; WALK[k]=[[cx-7.4,cz-6.4,cx+7.4,cz+6.4]]; }
function inWalk(scene,x,z){
  for(const r of WALK[scene]||[]) if(x>=r[0]&&x<=r[2]&&z>=r[1]&&z<=r[3]) return true;
  return false;
}

/* ---------------- billboards ---------------- */
const BB={};            // key -> {sprite, def}
function makeBillboard(def){
  let tex;
  if(def.robot) tex=ctex(spriteCanvas(ROBOT_ROWS, PAL_ROBOT));
  else if(def.poi) return null;
  else { def.frames=humanCanvases(def.pal, def.patch); tex=ctex(def.frames.idle); }
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true}));
  sp.scale.set(1.2,1.8,1); sp.position.set(def.x,0.9,def.z);
  scene.add(sp);
  return sp;
}
for(const k in NPCS){ const n=NPCS[k]; const sp=makeBillboard(n); if(sp) BB[k]={sprite:sp, def:n}; }
const PEDBB=[];
for(const p of PEDS){
  p.frames=humanCanvases(p.pal);
  p.texs=[ctex(p.frames.idle), ...p.frames.walk.map(ctex)];
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:p.texs[1], transparent:true}));
  sp.scale.set(1.2,1.8,1); sp.position.set(p.x,0.9,p.z);
  scene.add(sp); p.sp=sp; p.dir=1; p.paused=0;
}
/* Raze */
const razeFrames=humanCanvases('raze','raze');
const razeTexs=[ctex(razeFrames.idle), ...razeFrames.walk.map(ctex)];
const razeSp=new THREE.Sprite(new THREE.SpriteMaterial({map:razeTexs[0], transparent:true}));
razeSp.scale.set(1.25,1.85,1); razeSp.visible=false; scene.add(razeSp);
/* credit chip drop */
const chip=new THREE.Mesh(new THREE.BoxGeometry(.4,.12,.25),
  new THREE.MeshBasicMaterial({color:0xffd23f}));
chip.visible=false; scene.add(chip);

/* world item pickups */
const PICKUP_COLORS={soycaf:0x43ffd9, bar:0xff8c3a, bento:0xffd23f, credits:0xffe680};
for(const p of PICKUPS){
  const m = p.kind==='credits'
    ? new THREE.Mesh(new THREE.OctahedronGeometry(.28), new THREE.MeshBasicMaterial({color:PICKUP_COLORS.credits}))
    : new THREE.Mesh(new THREE.BoxGeometry(.34,.34,.34), new THREE.MeshBasicMaterial({color:PICKUP_COLORS[p.kind]}));
  m.position.set(p.x,.5,p.z); world.add(m); p._m=m;
}
/* street food: SKW-R 7's grill stand (Transit Plaza) */
{
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.8,1.4), flatMat(0x33231a));
  body.position.set(124,0.9,7.6); world.add(body);
  const awn=new THREE.Mesh(new THREE.BoxGeometry(3.2,.14,2),
    new THREE.MeshBasicMaterial({color:0xff8c3a}));
  awn.position.set(124,2.15,7.4); world.add(awn);
  const grill=new THREE.Mesh(new THREE.BoxGeometry(2.2,.1,.6),
    new THREE.MeshBasicMaterial({color:0xff5530}));
  grill.position.set(124,1.85,7.2); world.add(grill);
  const sc=neonSign('SKEWERS','#ff8c3a',2.4,.7);
  sc.position.set(124,1.5,6.85); sc.rotation.y=Math.PI; world.add(sc);
}
/* Juno's amp in the park */
{
  const amp=new THREE.Mesh(new THREE.BoxGeometry(.7,.8,.5), flatMat(0x23202c));
  amp.position.set(-173.4,.4,15); world.add(amp);
  const grille=new THREE.Mesh(new THREE.PlaneGeometry(.5,.5),
    new THREE.MeshBasicMaterial({color:0x43ffd9}));
  grille.position.set(-173.4,.45,15.26); world.add(grille);
}

/* quest beacon pillar */
const beacon=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,60,10,1,true),
  new THREE.MeshBasicMaterial({color:0xffd23f, transparent:true, opacity:.16,
    side:THREE.DoubleSide, depthWrite:false}));
beacon.visible=false; scene.add(beacon);

/* ---------------- engine context for content fx ---------------- */
function toast(m,c){ UI.toast(m,c); }
function startQuest(id){ if(!S.quests[id]){ S.quests[id]='active';
  UI.toast('NEW QUEST: '+QUESTS[id].title,'quest'); UI.refreshHUD(); save(); } }
function finishQuest(id){ if(S.quests[id]==='active'){ S.quests[id]='done';
  UI.toast('QUEST COMPLETE: '+QUESTS[id].title,'quest'); UI.refreshHUD(); save(); } }
function earn(n){ S.credits+=n; UI.toast('+₣'+n); UI.refreshHUD(); save(); }
function eat(food,hp){ S.hunger=clamp(S.hunger+food,0,100);
  if(hp) S.hp=clamp(S.hp+hp,0,S.maxHp); UI.refreshHUD(); }
function buy(id){
  const it=ITEMS[id];
  if(S.credits<it.price){ UI.toast('Not enough credits (₣'+it.price+').'); return false; }
  S.credits-=it.price; S.inv[id]=(S.inv[id]||0)+1; UI.refreshHUD();
  UI.toast(it.name+' added to bag.'); save();
  return true;
}
function useItem(id){
  const it=ITEMS[id]; if(!it||!(S.inv[id]>0)) return;
  if(it.passive){ UI.toast(it.name+' is equipped automatically.'); return; }
  S.inv[id]--; if(S.inv[id]<=0) delete S.inv[id];
  eat(it.food, it.hp||4); UI.toast('Ate '+it.name+'.'); UI.renderInv(); save();
}
UI.onUseItem=useItem;
function fadeWork(mid){ UI.fadeTo(true,500); setTimeout(()=>{ mid&&mid(); UI.fadeTo(false,700); },700); }
function endChapter(){
  if(S.flags.chapterDone) return;
  S.flags.chapterDone=true; finishQuest('wayBack'); save();
  setTimeout(()=>{ UI.close(); UI.showEnding(); },400);
}
document.getElementById('btnEndClose').onclick=()=>{ document.getElementById('ending').style.display='none'; };

/* ---------------- combat ---------------- */
const MUG={active:false, x:-190, z:4, hp:60, max:60, state:'approach', t:0, cd:0, gone:false};
function startFight(){
  MUG.active=true; MUG.hp=MUG.max; MUG.state='approach'; MUG.t=0; MUG.cd=.5;
  MUG.x=S.x+(S.x<-200? 6:-6); MUG.z=clamp(S.z,-6,8);
  razeSp.visible=true; razeSp.position.set(MUG.x,.92,MUG.z);
}
function muggerGone(){ MUG.gone=true; razeSp.visible=false; }
function muggerFalls(){
  MUG.active=false; MUG.state='down'; S.flags.muggerDown=true;
  razeSp.material.rotation=Math.PI/2; razeSp.position.y=.35;
  S.flags.drop={x:clamp(MUG.x+1.5,-250,-150), z:clamp(MUG.z,-6,8)};
  chip.visible=true; chip.position.set(S.flags.drop.x,.3,S.flags.drop.z);
  UI.toast('Raze goes down. Something clatters onto the pavement.','quest');
  UI.refreshHUD(); save();
}
function punch(){
  if(S.punchCd>0) return;
  S.punchCd=.34; S.punchT=.16; camKick=.5;
  if(MUG.active){
    const dx=MUG.x-S.x, dz=MUG.z-S.z, dist=Math.hypot(dx,dz);
    const fx=-Math.sin(S.yaw), fz=-Math.cos(S.yaw);
    const facing=(dx*fx+dz*fz)/(dist||1);
    if(dist<2.6 && facing>.5){
      const dmg=9+(hasItem('knuckles')?8:0)+((Math.random()*5)|0);
      MUG.hp-=dmg; MUG.state='hurt'; MUG.t=0;
      MUG.x+=fx*.8; MUG.z+=fz*.8;
      razeSp.material.color.setHex(0xff8080);
      setTimeout(()=>razeSp.material.color.setHex(0xffffff),120);
      if(MUG.hp<=0) muggerFalls();
    }
  }
}
function hurtPlayer(n){
  S.hp=clamp(S.hp-n,0,S.maxHp); UI.refreshHUD(); camKick=1;
  if(S.hp<=0) knockOut();
}
function knockOut(){
  UI.close(); UI.fadeTo(true,500);
  setTimeout(()=>{
    S.scene='world'; S.x=-200; S.z=8; S.hp=45; S.hunger=Math.max(S.hunger,30);
    MUG.active=false; razeSp.visible=false;
    UI.toast('You come to on the bench. The city kept going without you.');
    UI.refreshHUD(); UI.fadeTo(false,800); save();
  },700);
}
function updateMugger(dt){
  if(S.scene!=='world') return;
  if(S.quests.parkEcho==='active' && !S.flags.muggerDown && !MUG.active && !UI.dialogOpen && S.x<-150){
    if(!S.flags.parkCue){ S.flags.parkCue=true; UI.open('raze.intro'); save(); }
    else startFight();
  }
  if(!MUG.active || UI.dialogOpen) return;
  MUG.t+=dt; MUG.cd-=dt;
  const dx=S.x-MUG.x, dz=S.z-MUG.z, dist=Math.hypot(dx,dz);
  if(MUG.state==='approach'){
    if(dist>1.4){ MUG.x+=dx/dist*2.4*dt; MUG.z+=dz/dist*2.4*dt; }
    if(dist<2 && MUG.cd<=0){ MUG.state='windup'; MUG.t=0;
      razeSp.material.color.setHex(0xffb0b0); }
    MUG.x=clamp(MUG.x,-250,-145); MUG.z=clamp(MUG.z,-8,9);
    razeSp.material.map=razeTexs[1+Math.floor(perfNow()*.006)%4];
  }
  else if(MUG.state==='windup'){
    if(MUG.t>.5){ MUG.state='strike'; MUG.t=0;
      razeSp.material.color.setHex(0xffffff);
      if(dist<2.2) { hurtPlayer(11); }
      MUG.cd=.9; }
  }
  else if(MUG.state==='strike'){ if(MUG.t>.25) MUG.state='approach'; }
  else if(MUG.state==='hurt'){ if(MUG.t>.32) MUG.state='approach'; }
  razeSp.position.set(MUG.x,.92,MUG.z);
}

setCtx({earn, eat, buy, toast, startQuest, finishQuest, refreshHUD:()=>UI.refreshHUD(),
  fadeWork, startFight, muggerGone, endChapter, save});

/* ---------------- doors & interaction ---------------- */
function goDoor(d){
  fadeWork(()=>{
    S.scene=d.to; S.x=d.tx; S.z=d.tz; S.yaw=d.tyaw||0;
    const nm=SCENE_NAMES[d.to]; if(nm) UI.toast(nm,'zone'); save();
  });
}
function nearestInteract(){
  // returns {label, act} or null
  if(RIDE) return null;
  const fx=-Math.sin(S.yaw), fz=-Math.cos(S.yaw);
  let best=null, bd=2.8;
  const consider=(x,z,label,act,r)=>{
    const dx=x-S.x, dz=z-S.z, dist=Math.hypot(dx,dz);
    if(dist>(r||bd)) return;
    const facing=(dx*fx+dz*fz)/(dist||1);
    if(dist>.8 && facing<.25) return;
    if(!best || dist<best.dist) best={label,act,dist};
  };
  if(MUG.active){ return {label:'PUNCH! — Raze '+Math.max(0,MUG.hp)+'/'+MUG.max, act:punch}; }
  for(const d of DOORS){
    if(d.scene!==S.scene) continue;
    consider(d.x,d.z, (d.needKey&&!S.flags.hasKey)? 'locked — Mr. Tan handles the leases' : d.label,
      ()=>{ if(d.needKey&&!S.flags.hasKey){ UI.toast('Locked. Mr. Tan handles the leases.'); return; } goDoor(d); });
  }
  if(S.scene==='world'){
    consider(200,-10,'Array door', ()=>UI.toast('ARRAY ACCESS: sealed. “Exotic-matter charge insufficient.”'));
    consider(100,-132,'NEON GARDEN', ()=>UI.toast('Big Sef doesn’t move. “Members only, ghost.”'));
    if(S.flags.drop) consider(S.flags.drop.x,S.flags.drop.z,'pick up credit chip', ()=>{}, 2.2);
    PADS.forEach((p,i)=>consider(p.x,p.z,'SKY-CAB pad — '+p.name, ()=>{
      if(!S.flags.metVendo){ UI.toast('“PADS SERVE REGISTERED COURIERS.” Get hired first.'); return; }
      padMenu(i);
    }, 3));
  }
  if(S.scene==='room'){
    const [cx,cz]=ROOMS.room;
    consider(cx-4,cz-4,'sleep', doSleep, 3);
  }
  for(const k in NPCS){
    const n=NPCS[k];
    if((n.scene||'world')!==S.scene) continue;
    if(MUG.active) continue;
    consider(n.x,n.z, n.poi? 'intercom — '+n.name : 'talk — '+n.name, ()=>{
      S.flags.talked[k]=true; UI.open(npcEntryNode(k));
    });
  }
  if(S.scene==='world') for(const p of PEDS){
    consider(p.x,p.z,'talk — '+p.name, ()=>{
      p.paused=4;
      p.lineIdx=((p.lineIdx||0)+1)%p.lines.length;
      SAYS['ped.tmp']={who:p.name, text:p.lines[p.lineIdx]};
      UI.open('ped.tmp');
    });
  }
  return best;
}
function doSleep(){
  UI.fadeTo(true,900);
  setTimeout(()=>{
    S.minutes=7*60+30;
    S.flags.shiftCooldown=0;
    S.hp=S.maxHp; S.hunger=clamp(S.hunger-15,5,100);
    if(!S.flags.slept){
      S.flags.slept=true;
      if(S.quests.roof==='active') finishQuest('roof');
      startQuest('wayBack');
      UI.toast('You sleep like a man with a door that locks.','quest');
    } else UI.toast('Rested. Game saved.');
    save(); UI.fadeTo(false,900); UI.refreshHUD();
  },1100);
}

/* ---------------- input actions ---------------- */
let started=false;
INPUT.onAction=(k)=>{
  if(!started) return;
  if(UI.dialogOpen){
    if(k==='e'||k===' '||k==='enter') UI.advance();
    else if(k==='arrowup') UI.moveChoice(-1);
    else if(k==='arrowdown') UI.moveChoice(1);
    else if(k>='1'&&k<='9') UI.pick(+k-1);
    else if(k==='escape') UI.close();
    return;
  }
  if(k==='j') UI.togglePanel('questPanel');
  else if(k==='i') UI.togglePanel('invPanel');
  else if(k==='h') UI.togglePanel('helpPanel');
  else if(k==='escape'){ UI.closePanels(); document.exitPointerLock&&document.exitPointerLock(); }
  else if(k==='f') punch();
  else if(k==='e'){
    const t=nearestInteract();
    if(t&&t.act) t.act();
  }
};

/* ---------------- main loop ---------------- */
let camKick=0, lastZone=null, introIdx=-1;
const perfNow=()=>performance.now();
let last=perfNow();
function zoneAt(){
  if(S.scene!=='world') return null;
  if(S.z<-14 && S.x>85 && S.x<115) return 'VELVET ROW';
  if(S.x<-140) return 'MEMORIAL PARK';
  if(S.x<-60) return 'RESIDENTIAL BLOCK';
  if(S.x<60) return 'MARKET STREET';
  if(S.x<140) return 'TRANSIT PLAZA';
  return 'MERIDIAN RESEARCH CAMPUS';
}
function update(dt){
  /* Sky-Cab flight overrides look + movement */
  if(RIDE){
    RIDE.t+=dt/RIDE.dur;
    const tt=Math.min(1,RIDE.t);
    const p=RIDE.curve.getPoint(tt);
    const ahead=RIDE.curve.getPoint(Math.min(1,tt+.015));
    S.x=p.x; S.z=p.z; rideY=p.y;
    const dx=ahead.x-p.x, dz=ahead.z-p.z;
    if(Math.hypot(dx,dz)>.0005) S.yaw=Math.atan2(-dx,-dz);
    pitch=clamp((p.y-ahead.y)*.4,-.4,.35);
    taxiCab.position.set(p.x, p.y-1.45, p.z);
    taxiCab.rotation.y=Math.atan2(-dz,dx);
    INPUT.look.dx=0; INPUT.look.dy=0;
    if(RIDE.t>=1){
      RIDE=null; taxiCab.visible=false; rideY=1.62;
      if(!S.flags.rodeCab) S.flags.rodeCab=true;
      save(); UI.refreshHUD();
    }
  } else {
    /* look */
    S.yaw -= INPUT.look.dx*.0024; pitch -= INPUT.look.dy*.0024;
    pitch=clamp(pitch,-1.3,1.3);
    INPUT.look.dx=0; INPUT.look.dy=0;
  }

  /* movement */
  if(!UI.dialogOpen && !UI.anyPanel() && !RIDE){
    const sprint=INPUT.keys['shift']? 1.7:1;
    const sp=4.2*sprint*(S.hunger<=20?.7:1);
    let mx=0,mz=0;
    if(INPUT.keys['w']||INPUT.keys['arrowup']) mz-=1;
    if(INPUT.keys['s']||INPUT.keys['arrowdown']) mz+=1;
    if(INPUT.keys['a']||INPUT.keys['arrowleft']) mx-=1;
    if(INPUT.keys['d']||INPUT.keys['arrowright']) mx+=1;
    mx+=INPUT.stick.x; mz+=INPUT.stick.y;
    const len=Math.hypot(mx,mz);
    if(len>0.01){
      mx/=Math.max(1,len); mz/=Math.max(1,len);
      const sin=Math.sin(S.yaw), cos=Math.cos(S.yaw);
      const wx=(mx*cos + mz*sin)*sp*dt;     // right*mx + forward*(-mz)
      const wz=(-mx*sin + mz*cos)*sp*dt;
      if(inWalk(S.scene, S.x+wx, S.z)) S.x+=wx;
      if(inWalk(S.scene, S.x, S.z+wz)) S.z+=wz;
      bobT+=dt*sp*1.6;
    }
  }
  if(S.punchCd>0) S.punchCd-=dt;
  if(S.punchT>0) S.punchT-=dt;
  camKick=Math.max(0,camKick-dt*4);
  if(S.flags.shiftCooldown>0) S.flags.shiftCooldown=Math.max(0,S.flags.shiftCooldown-dt/60);

  /* clock + hunger */
  S._clk=(S._clk||0)+dt; if(S._clk>2){ S._clk=0; S.minutes=(S.minutes+1)%(24*60); UI.refreshHUD(); }
  S._hug=(S._hug||0)+dt;
  if(S._hug>10){ S._hug=0; S.hunger=clamp(S.hunger-1,0,100);
    if(S.hunger===24) UI.toast('You are getting hungry. Find food.');
    if(S.hunger===8) UI.toast('Starving. Your legs are going soft.');
    UI.refreshHUD(); }
  if(S.hunger<=0){ S._stv=(S._stv||0)+dt; if(S._stv>3){ S._stv=0; hurtPlayer(2); } }
  else if(S.hunger>50 && S.hp<S.maxHp){ S._rgn=(S._rgn||0)+dt;
    if(S._rgn>5){ S._rgn=0; S.hp=clamp(S.hp+1,0,S.maxHp); UI.refreshHUD(); } }

  /* zone toast */
  const z=zoneAt();
  if(z && z!==lastZone){ lastZone=z; UI.toast(z,'zone'); }

  /* peds */
  if(S.scene==='world') for(const p of PEDS){
    if(p.paused>0){ p.paused-=dt; p.sp.material.map=p.texs[0]; continue; }
    p.x+=p.dir*1.1*dt;
    if(p.x<p.ax){p.x=p.ax;p.dir=1;} if(p.x>p.bx){p.x=p.bx;p.dir=-1;}
    p.sp.position.x=p.x;
    p.sp.material.map=p.texs[1+Math.floor(perfNow()*.007)%4];
  }

  updateMugger(dt);
  /* chip pickup */
  if(S.flags.drop && S.scene==='world' &&
     Math.hypot(S.x-S.flags.drop.x, S.z-S.flags.drop.z)<1.6){
    S.flags.drop=null; chip.visible=false; earn(180);
    UI.toast('Raze’s whole take, on one anonymous chip. Street rules.','quest');
    save();
  }

  /* item pickups */
  for(const p of PICKUPS){
    const got=!!S.flags.picked[p.id];
    if(p._m) p._m.visible=!got && true;
    if(got || p.scene!==S.scene) continue;
    if(Math.hypot(S.x-p.x, S.z-p.z)<1.5 && !RIDE){
      S.flags.picked[p.id]=true; p._m.visible=false;
      if(p.kind==='credits'){ earn(p.amt); }
      else{ S.inv[p.kind]=(S.inv[p.kind]||0)+1;
        UI.toast('Picked up: '+ITEMS[p.kind].name); save(); UI.refreshHUD(); }
    }
  }

  /* animated world */
  const t=perfNow()*.001;
  for(const a of ANIM_SIGNS) a.m.material.map=a.texs[Math.floor(t*a.rate)%a.texs.length];
  for(const c of TRAFFIC){
    if(c.axis==='z'){
      c.z+=c.v*dt; if(c.z>120) c.z=-260; if(c.z<-260) c.z=120;
      c.g.position.set(c.x, c.y+Math.sin(t+c.x)*.4, c.z);
      c.g.rotation.y=Math.atan2(-(c.v>0?1:-1),0);
    } else {
      c.x+=c.v*dt; if(c.x>300) c.x=-300; if(c.x<-300) c.x=300;
      c.g.position.set(c.x, c.y+Math.sin(t*1.2+c.z)*.4, c.z);
      c.g.rotation.y=Math.atan2(0, c.v>0?1:-1);
    }
  }
  for(const p of PICKUPS) if(p._m&&p._m.visible){ p._m.rotation.y=t*2;
    p._m.position.y=.5+Math.sin(t*3+p.x)*.08; }
  for(const d of DRONES){ d.sp.position.x+=d.v*dt;
    d.sp.position.y+= Math.sin(t*2+d.sp.position.x)*0.004;
    d.sp.material.map=d.texs[Math.floor(t*8)%4];
    if(d.sp.position.x>260) d.sp.position.x=-260;
    if(d.sp.position.x<-260) d.sp.position.x=260; }
  arrayRing.rotation.z=t*.4; arrayRing.userData.inner.rotation.z=-t*.7;
  chip.rotation.y=t*3; if(chip.visible) chip.position.y=.3+Math.sin(t*4)*.06;

  /* quest beacon */
  const qt=questTargetPos();
  if(qt){ beacon.visible=true; beacon.position.set(qt[0],30,qt[1]);
    beacon.material.opacity=.12+.06*Math.sin(t*2.4); }
  else beacon.visible=false;

  /* camera */
  camera.position.set(S.x, (RIDE? rideY : 1.62+Math.sin(bobT)*0.045) + camKick*0.06, S.z);
  camera.rotation.y=S.yaw; camera.rotation.x=pitch + (S.punchT>0? .04:0);

  /* prompt */
  const ni=nearestInteract();
  UI.prompt(ni? (TOUCH? 'E: ':'E — ')+ni.label : null);
}
let bobT=0;
function frame(){
  const now=perfNow(), dt=Math.min(.05,(now-last)/1000); last=now;
  if(started) update(dt);
  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------------- intro & boot ---------------- */
function playIntro(i){
  if(i>=INTRO.length){
    S.flags.intro=true; startQuest('awakening');
    UI.toast(TOUCH? 'Left stick walks · drag to look · E talks':'WASD + mouse · E to talk','quest');
    save(); return;
  }
  SAYS['intro.'+i]={who: i===INTRO.length-1?'—':S.name, text:INTRO[i]};
  UI.open('intro.'+i);
  const orig=UI.advance.bind(UI);
  UI.advance=function(){
    if(UI.typing){ UI.skipType(); return; }
    UI.advance=orig; UI.close(); playIntro(i+1);
  };
}
function boot(newGame){
  document.getElementById('title').style.display='none';
  document.getElementById('hud').style.display='flex';
  if(TOUCH){
    document.getElementById('touchUI').style.display='block';
    document.getElementById('btnQuests').style.display='flex';
    document.getElementById('btnBag').style.display='flex';
  } else {
    document.getElementById('hint').style.display='block';
  }
  started=true;
  UI.refreshHUD();
  UI.fadeTo(false,1600);
  if(newGame) setTimeout(()=>playIntro(0), 900);
}
UI.init();
INPUT.init(canvas);
if(hasSave()) document.getElementById('btnContinue').style.display='block';
function guarded(fn){
  return ()=>{ try{ fn(); }catch(e){
    if(window.__showErr) window.__showErr('boot: '+(e.stack||e.message||e));
    else throw e;
  } };
}
document.getElementById('btnNew').onclick=guarded(()=>{
  const nm=document.getElementById('nameInput').value.trim();
  S.name=nm||'Yaan';
  clearSave();
  boot(true);
});
document.getElementById('btnContinue').onclick=guarded(()=>{
  if(loadSave()){ boot(false); UI.toast('Game loaded.'); }
  else boot(true);
});
window.__gameReady=true;
