/* The same timber, furniture, ink treatment and local sky as Alderwing villages. */
(function(root){'use strict';
const C=root.BurbzPlayerHomeCore;
function disposeScene(scene){const gs=new Set(),ms=new Set(),ts=new Set();scene.traverse(o=>{o.shadow?.dispose();if(o.geometry)gs.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){ms.add(m);if(m.map)ts.add(m.map);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());scene.clear();}
function ornament(T,type,accent=0x6f8c76){const b=root.BurbzSettlementModels.batch(T),wood=0x795335,trim=0x49372c,gold=0xc8a365;
 if(type==='bench'){b.box(1.8,.14,.65,0,.65,0,wood);b.box(1.8,.52,.1,0,1.02,-.3,wood);for(const x of [-.65,.65])for(const z of [-.23,.23])b.box(.12,.64,.12,x,.32,z,trim);}
 else if(type==='lantern'){b.cylinder(.07,.1,2.3,0,1.15,0,wood);b.box(.65,.09,.12,.18,2.25,0,gold);b.box(.34,.48,.34,.45,1.93,0,trim);b.add(new T.BoxGeometry(.27,.36,.27),0xffd37a,[.45,1.93,0],[0,0,0],[1,1,1],true);}
 else if(type==='birdbath'){b.cylinder(.19,.35,.95,0,.475,0,0xa5a18a);b.cylinder(.52,.3,.2,0,1.03,0,0xc1bba2);b.cylinder(.43,.43,.02,0,1.14,0,0x75a6a1);}
 else if(type==='planter'){b.cylinder(.27,.19,.42,0,.21,0,0xb57957);for(let i=0;i<6;i++){const a=i*2.4,x=Math.sin(a)*.19,z=Math.cos(a)*.19;b.cylinder(.015,.015,.48,x,.55,z,0x668450);b.sphere(.1,x,.8+(i%2)*.08,z,[0xe8c265,0xc9818b,0xd8d7be][i%3],[1,.5,1]);}}
 else if(type==='rug'){b.box(1.7,.022,2,0,.015,0,accent);for(const x of [-.76,.76])b.box(.06,.025,1.85,x,.02,0,0xe8d5aa);}
 else if(type==='armchair'){b.box(.9,.48,.85,0,.32,0,wood);b.box(.72,.18,.7,0,.64,.05,accent);b.box(.92,.86,.16,0,.85,-.35,accent);for(const x of [-.48,.48])b.box(.12,.38,.85,x,.73,0,wood);}
 else if(type==='shelf'){for(const y of [.12,.7,1.3,1.9])b.box(1.6,.09,.6,0,y,0,wood);for(const x of [-.76,.76])b.box(.09,1.9,.6,x,.97,0,trim);for(let k=0;k<3;k++)for(let i=0;i<7;i++)b.box(.12,.35+(i%2)*.09,.32,-.6+i*.19,.34+k*.59,0,[accent,0xab7252,0xc7b581][i%3]);}
 else if(type==='fern'||type==='cypress'){b.cylinder(.34,.25,.55,0,.275,0,0xb9895b);if(type==='cypress'){b.cylinder(.06,.1,1.2,0,1,0,trim);for(let i=0;i<3;i++)b.add(new T.ConeGeometry(.42-i*.08,.9,8),0x507957,[0,1.1+i*.4,0]);}else for(let i=0;i<7;i++){const a=i*.9;b.sphere(.32,Math.sin(a)*.2,.74,Math.cos(a)*.2,0x628b58,[.55,1.4,.3],[.2,a,.5]);}}
 else if(type==='rose'||type==='trellis'){for(const x of [-.6,.6])b.box(.09,2.3,.1,x,1.15,0,wood);for(let i=0;i<6;i++)b.box(1.3,.04,.045,0,.4+i*.32,0,gold);for(let i=0;i<10;i++){const x=Math.sin(i*2.4)*.5,y=.4+i*.18;b.sphere(.17,x,y,.05,0x57764c,[1,.65,.45]);if(type==='rose'&&i%2===0)b.sphere(.105,x,y+.08,.13,0xcd8b98);}}
 else if(type==='herbs'){b.box(1.8,.3,1.1,0,.15,0,wood);b.box(1.6,.04,.9,0,.32,0,0x493b29);for(let i=0;i<12;i++)b.sphere(.17,(i%4-.5)*.38-.38,.52,(Math.floor(i/4)-1)*.29,[0x789659,0x5c7b56,0xb0a26c][i%3],[.8,1.2,.8]);}
 else if(type==='arch'){for(const x of [-1,1]){b.box(.14,2.6,.65,x,1.3,0,wood);for(let y=.6;y<2.4;y+=.35)b.sphere(.23,x,y,.16,0x71905d,[.8,.7,1]);}for(let i=0;i<9;i++){const a=i*Math.PI/8;b.box(.32,.15,.7,Math.cos(a),2.55+Math.sin(a)*.55,0,gold,[0,0,-a]);}}
 else if(type==='pond'){b.cylinder(1.2,1.05,.18,0,.09,0,0xa7a48a,[0,0,0],24);b.cylinder(1.06,1.06,.018,0,.19,0,0x739f9e,[0,0,0],24);for(let i=0;i<5;i++){const a=i*2.4;b.cylinder(.18,.18,.015,Math.sin(a)*.65,.21,Math.cos(a)*.6,0x668d58);if(i%2===0)b.sphere(.09,Math.sin(a)*.65,.25,Math.cos(a)*.6,0xe7c7bf,[1,.5,1]);}}
 else if(type==='well'){b.cylinder(.7,.7,.75,0,.375,0,0xa5a18b);b.cylinder(.52,.52,.02,0,.76,0,0x335757);for(const x of [-.58,.58])b.box(.12,1.9,.14,x,1.2,0,wood);b.box(1.5,.12,1.3,0,2.18,0,0x5d806d);b.cylinder(.035,.035,1,0,1.5,0,gold);b.cylinder(.18,.14,.28,0,1,0,0x9e805a);}
 else if(type==='picnic'){b.box(2.1,.14,.85,0,.85,0,wood);for(const z of [-.72,.72])b.box(2.1,.13,.28,0,.47,z,wood);for(const x of [-.7,.7]){b.box(.13,.8,1.4,x,.42,0,trim);b.box(.2,.15,1.7,x,.1,0,trim);}}
 else if(type==='beehive'){b.box(.9,.11,.9,0,.35,0,wood);for(let i=0;i<6;i++)b.cylinder(.36-i*.036,.38-i*.032,.13,0,.47+i*.12,0,0xc3a165);b.box(.17,.07,.04,0,.52,.38,trim);}
 else if(type==='logpile'){for(const x of [-.7,.7])b.box(.08,1.2,.8,x,.6,0,wood);b.box(1.6,.12,1,0,1.2,0,0x65816a);for(let i=0;i<9;i++)b.cylinder(.14,.14,.8,(i%3-1)*.35,.2+Math.floor(i/3)*.28,0,[wood,0xa47c53][i%2],[Math.PI/2,0,0]);}
 else if(type==='feeder'){b.cylinder(.08,.13,1.5,0,.75,0,wood);b.box(.9,.1,.75,0,1.45,0,wood);for(const x of [-.33,.33])b.box(.06,.55,.55,x,1.75,0,gold);b.add(new T.ConeGeometry(.68,.42,4),0x527763,[0,2.18,0],[0,Math.PI/4,0]);}
 else if(type==='sundial'){b.cylinder(.16,.3,.85,0,.425,0,0xa9a591);b.cylinder(.45,.45,.08,0,.9,0,gold);b.add(new T.ConeGeometry(.22,.35,3),0x7e754d,[0,1.08,0],[0,0,.5]);for(let i=0;i<12;i++)b.sphere(.022,Math.sin(i*Math.PI/6)*.35,.955,Math.cos(i*Math.PI/6)*.35,trim);}
 else if(type==='bridge'){for(let i=0;i<9;i++)b.box(.21,.12,1.2,(i-4)*.22,.12+Math.sin(i*Math.PI/8)*.2,0,wood);for(const z of [-.56,.56]){for(const x of [-.9,0,.9])b.box(.07,.7,.07,x,.48,z,trim);b.box(2,.06,.07,0,.81,z,gold);}}
 else if(type==='sofa'){b.box(2,.46,.9,0,.28,0,wood);b.box(1.8,.18,.74,0,.6,.03,accent);b.box(2,.75,.15,0,.8,-.4,accent);for(const x of [-.95,.95])b.box(.16,.4,.85,x,.72,0,wood);for(const x of [-.55,.5])b.box(.36,.35,.13,x,.93,-.27,0xd4b979,[.1,0,.1]);}
 else if(type==='bedside'||type==='wardrobe'||type==='display'){const w=type==='bedside'?.8:type==='wardrobe'?1.5:1.3,h=type==='bedside'?.75:type==='wardrobe'?2.2:1.65;b.box(w,h,.65,0,h/2,0,wood);if(type==='display'){b.box(w-.16,h-.2,.04,0,h/2,.35,0x638e80);for(let i=0;i<3;i++){b.box(w,.06,.1,0,.4+i*.43,.39,trim);b.sphere(.12,(i%2?1:-1)*.3,.56+i*.43,.4,[gold,0xadc49d,0xd4c0a4][i]);}}else for(const x of [-w/4,w/4]){b.box(w/2-.07,h-.15,.035,x,h/2,.35,0x916943);b.sphere(.04,x>0?.08:-.08,h/2,.39,gold);}}
 else if(type==='writingdesk'||type==='workbench'||type==='potting'){const w=type==='workbench'?1.9:1.7;b.box(w,.14,.8,0,.95,0,wood);for(const x of [-w/2+.12,w/2-.12])for(const z of [-.3,.3])b.box(.1,.92,.1,x,.46,z,trim);if(type==='writingdesk'){b.box(.5,.02,.35,0,1.04,0,0xe4d2a6);b.cylinder(.09,.07,.15,.45,1.07,0,gold);b.box(.03,.4,.025,.46,1.3,0,0xd9d2b5,[0,0,-.2]);}else if(type==='potting'){b.box(w,.75,.08,0,1.4,-.35,trim);for(const x of [-.5,0,.5]){b.cylinder(.15,.1,.23,x,1.12,0,0xb7825f);b.sphere(.18,x,1.37,0,0x709857,[1,1.2,1]);}}else{b.box(.8,.035,.3,-.25,1.05,0,gold);b.box(.09,.045,.5,.45,1.07,0,trim,[0,.5,0]);b.box(.3,.14,.12,.55,1.09,-.2,0x999989);}}
 else if(type==='globe'){b.cylinder(.1,.35,.85,0,.425,0,wood);b.sphere(.4,0,1.25,0,0x659594);for(let i=0;i<5;i++)b.sphere(.13,Math.sin(i*1.4)*.3,1.2+Math.cos(i)*.2,.25,0x9cac6f,[1.3,.8,.4]);b.add(new T.TorusGeometry(.46,.025,6,28),gold,[0,1.25,0],[0,.3,-.4]);}
 else if(type==='loom'){for(const x of [-.72,.72])b.box(.1,1.7,.7,x,.85,0,wood);for(const y of [.5,1.5])b.box(1.5,.12,.15,0,y,0,wood);for(let i=0;i<15;i++)b.box(.025,1,.03,-.6+i*.085,1,.02,0xe5d4ad);for(let i=0;i<6;i++)b.box(1.25,.08,.04,0,.6+i*.09,.05,[accent,gold][i%2]);}
 else if(type==='piano'){b.box(1.7,1.25,.55,0,.625,-.12,wood);b.box(1.7,.13,.45,0,.82,.32,trim);for(let i=0;i<18;i++)b.box(.075,.04,.27,-.76+i*.085,.91,.38,0xe7dbbb);for(let i=0;i<12;i++)b.box(.05,.07,.15,-.7+i*.12,.95,.3,trim);for(const x of [-.7,.7])b.box(.1,.8,.1,x,.4,.45,wood);}

 else {b.cylinder(.65,.65,.1,0,.78,0,wood);b.cylinder(.1,.2,.74,0,.37,0,trim);b.cylinder(.14,.12,.17,.2,.92,0,0xd8c69e);}
 return b.finish();}
// Compact new upper rooms change the silhouette within the original reserved
// house footprint, so extending a home never consumes an existing garden plot.
function upperRooms(T,home){const all=new T.Group();for(const [id,r] of Object.entries(C.ROOMS)){if(!home.rooms[id])continue;const b=root.BurbzSettlementModels.batch(T),x=id==='library'?-1.35:id==='workshop'?1.35:0,z=id==='conservatory'?-.45:.95,y=id==='conservatory'?2.55:2.25,w=id==='conservatory'?1.45:1.2,d=1.45,wood=0x795335,trim=0x49372c;
 b.box(w,1.45,d,x,y+.725,z,id==='conservatory'?0x91beb1:0xdfcfad);for(const xx of [-w/2,w/2])for(const zz of [-d/2,d/2])b.box(.09,1.55,.09,x+xx,y+.75,z+zz,trim);b.box(w+.12,.12,d+.12,x,y,z,wood);
 if(id==='conservatory'){for(const xx of [-.4,0,.4]){b.box(.045,1.3,d+.04,x+xx,y+.72,z,0xd6bc82);b.sphere(.17,x+xx,y+.32,z+.7,0x638959,[1,1.6,.5]);}for(const sign of [-1,1])b.box(.88,.09,d+.2,x+sign*.37,y+1.61,z,0x8aafa7,[0,0,-sign*.3]);}
 else{b.box(.86,.89,.045,x,y+.85,z+d/2+.05,0x3c5a4d);b.add(new T.BoxGeometry(.68,.72,.05),id==='library'?0xc7d4a1:0xe3bf7b,[x,y+.87,z+d/2+.08],[0,0,0],[1,1,1],true);for(const xx of [-.4,0,.4])b.box(.05,.9,.08,x+xx,y+.85,z+d/2+.12,trim);b.box(1.03,.11,.27,x,y+.35,z+d/2+.11,wood);for(const sign of [-1,1])b.box(.86,.12,d+.24,x+sign*.32,y+1.62,z,r.accent,[0,0,-sign*.42]);if(id==='workshop'){b.box(.3,.9,.36,x+.28,y+1.7,z-.3,0xa79177);b.box(.4,.1,.44,x+.28,y+2.16,z-.3,0xc5b08b);}}
 const wing=b.finish();wing.userData.homeRoom=id;all.add(wing);}return all;}

function create(T,home,area,aspect,grade,options={}){const s=C.normalize(home),createdAt=options.now??Date.now();let scene,room=null,house=null,screen=null,screenSize=null;const targets=[],decor=[];let roof=null,frontLeaves=null,skyLight=null,sunLight=null;
 if(C.indoor(area)){
 const extra=C.ROOMS[area];
 const p=extra?{name:extra.name,scope:'player-home',width:8,depth:8,height:3.6,accent:extra.accent,props:[],spawn:{x:0,y:0,z:2.8,yaw:0,pitch:0},exit:{x:0,z:3.5},action:null}:{name:'Your woodland home',scope:'player-home',width:9,depth:10,height:3.6,accent:0x709486,props:[{type:'bed',x:-3,z:1.4,rot:0,w:1.7,d:2.4,solid:true},{type:'fireplace',x:-3.5,z:-1,rot:Math.PI/2,w:1,d:1.8,solid:true}],spawn:{x:0,y:0,z:3.8,yaw:0,pitch:0},exit:{x:0,z:4.3},action:null};
 room=root.BurbzBuildingRoomsScene.create(T,p);scene=room.scene;
 if(area==='room'&&Object.keys(s.rooms).length)for(const child of [...scene.children])if(child.isGroup&&child.position.x>4){scene.remove(child);disposeScene(child);}
 // The shared room shell's ceiling is opened only in the decorating view.
 scene.children[0]?.traverse(o=>{if(o.isMesh&&!roof)roof=o;});
 if(!extra){
 const desk=root.BurbzSettlementModels.batch(T),w=0x765139,trim=0x493329,gold=0xbf9855;
 desk.box(2.7,.15,1.25,0,.92,-3.45,w);for(const x of [-1.12,1.12])for(const z of [-3.9,-3])desk.box(.14,.9,.14,x,.45,z,trim);
 desk.box(.7,.05,.32,0,1.02,-3.02,trim);for(let row=0;row<3;row++)for(let i=0;i<8;i++)desk.box(.058,.03,.06,-.29+i*.082,1.055,-3.1+row*.085,gold);
 const height=aspect<1?1.6:Math.min(1.4,2.3/aspect),width=height*aspect;screenSize={width,height,x:0,y:1.12+height/2,z:-3.42};
 desk.box(width+.22,height+.24,.17,0,screenSize.y,-3.53,trim);desk.box(width+.1,height+.12,.19,0,screenSize.y,-3.52,gold);desk.cylinder(.07,.12,.38,0,1.13,-3.55,trim);
 for(const x of [-width/2-.08,width/2+.08])for(const y of [screenSize.y-height/2-.08,screenSize.y+height/2+.08])desk.sphere(.055,x,y,-3.4,gold);
 desk.cylinder(.13,.2,.1,1,.99,-3.3,gold);desk.cylinder(.035,.035,.5,1,1.26,-3.3,0xe4d2ac);desk.sphere(.08,1,1.57,-3.3,0xffcf76,[.5,1,.5]);
 scene.add(desk.finish());const chair=ornament(T,'armchair',0x466b5c);chair.position.set(0,0,-1.85);chair.rotation.y=Math.PI;chair.userData.homeTarget='desk';scene.add(chair);targets.push(chair);
 // The real app is projected beneath the WebGL canvas. This depth-tested
 // aperture exposes it only where the actual monitor is visible, including
 // furniture occlusion, side views and the exact full-viewport seated view.
 screen=new T.Mesh(new T.PlaneGeometry(width,height),new T.ShaderMaterial({
   vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:'void main(){gl_FragColor=vec4(0.0);}',
   blending:T.NoBlending,depthTest:true,depthWrite:true
 }));screen.position.set(0,screenSize.y,screenSize.z);screen.renderOrder=5;screen.userData.homeTarget='desk';scene.add(screen);targets.push(screen);
 }else{
 const theme=ornament(T,area==='library'?'writingdesk':area==='conservatory'?'potting':'workbench',extra.accent);theme.position.set(0,0,-2.8);theme.userData.findId=area+'-story';scene.add(theme);targets.push(theme);
 const side=ornament(T,area==='library'?'shelf':area==='conservatory'?'trellis':'logpile',extra.accent);side.position.set(-2.8,0,-1.3);side.rotation.y=Math.PI/2;scene.add(side);
 const detail=ornament(T,area==='library'?'globe':area==='conservatory'?'fern':'display',extra.accent);detail.position.set(-2.9,0,-2.8);scene.add(detail);
 if(area==='conservatory'){const glass=root.BurbzSettlementModels.batch(T);for(const x of [-3.83,3.83])for(const z of [-2,0,2]){glass.box(.04,1.65,1.5,x,2,z,0x9cc9bd);for(const y of [1.15,2.8])glass.box(.08,.08,1.65,x,y,z,0xd1c398);glass.box(.08,1.7,.07,x,2,z,0xd1c398);}scene.add(glass.finish());}
 }
 const doors=area==='room'?Object.keys(C.ROOMS).filter(id=>s.rooms[id]).map(id=>({id,x:4.37,z:C.ROOMS[id].doorZ,turn:Math.PI/2})):[{id:'room',x:0,z:3.55,turn:0}];
 for(const d of doors){const b=root.BurbzSettlementModels.batch(T);b.box(1.28,2.45,.11,0,1.225,0,0x3b5748);for(const x of [-.73,.73])b.box(.13,2.65,.18,x,1.325,0,0x9f7b50);b.box(1.6,.15,.18,0,2.66,0,0xc6ab73);for(let i=0;i<5;i++)b.box(.035,2.25,.035,-.5+i*.25,1.2,-.08,0x769078);b.sphere(.065,.4,1.15,-.14,0xe0bf73);const door=b.finish();door.position.set(d.x,0,d.z);door.rotation.y=d.turn;door.userData.roomTarget=d.id;scene.add(door);targets.push(door);}


 }else{
 scene=new T.Scene();if(!options.contentOnly){scene.background=new T.Color(0xa7c3ba);scene.fog=new T.Fog(0xa7c3ba,36,65);}const b=root.BurbzSettlementModels.batch(T),front=root.BurbzSettlementModels.batch(T);
 if(!options.contentOnly){b.cylinder(C.YARD.ground,17*C.YARD_SCALE,1,0,-.55,0,0x698160,[0,0,0],64);b.cylinder(6.3,6.3,.04,0,-.015,1.8,0x7c8764,[0,0,0],48);}
 for(let z=2;z<C.YARD.walk-.3;z+=.65)for(let x=-.65;x<=.65;x+=.65)b.box(.59,.04,.56,x+(Math.floor(z)%2)*.08,.025,z,0xab9e7c,[0,Math.sin(z)*.04,0]);
 for(const [i,t] of C.TREES.entries()){if(C.treeState(s,t.id,createdAt)>=3){b.cylinder(t.r,t.r*1.1,.28,t.x,.14,t.z,0xa58254);continue;}b.cylinder(t.r*.65,t.r,3.8,t.x,1.9,t.z,0x5b4332);for(let k=0;k<3;k++)(t.z>4?front:b).sphere(1.9,t.x+Math.sin(i+k)*.6,3.6+k*.7,t.z+Math.cos(i+k)*.6,[0x547956,0x678651,0x76915d][(i+k)%3],[1,1.05,.95]);}
 for(let i=0;i<90;i++){const a=i*2.4,r=(4+(i%12)*.7)*C.YARD_SCALE,x=Math.sin(a)*r,z=Math.cos(a)*r;if(Math.abs(x)<2.9&&Math.abs(z)<2.5||Math.abs(x)<1&&z>0)continue;b.sphere(.2,x,.1,z,0x82915e,[1,.5,1]);}
 // Moss, roots and small flowers break up the clearing without claiming resources.
 for(let i=0;i<180;i++){const a=i*2.4,r=(3.8+(i%17)*.51)*C.YARD_SCALE,x=Math.sin(a)*r,z=Math.cos(a)*r;if(Math.abs(x)<2.9&&Math.abs(z)<2.5||Math.abs(x)<1.1&&z>0)continue;const h=.1+(i%3)*.06;b.add(new T.ConeGeometry(.09,h,3),[0x587849,0x688252,0x7e8f59][i%3],[x,h/2,z]);if(i%7===0)b.sphere(.07,x,h,z,[0xe4c773,0xc78ba0,0xe5daca][i%3]);}
 scene.add(b.finish());frontLeaves=front.finish();scene.add(frontLeaves);house=root.BurbzSettlementModels.building(T,'cabin',s.tier+1,()=>.47,{roofs:[0x557e72]});house.userData.homeTarget='house';scene.add(house);targets.push(house);const additions=upperRooms(T,s);additions.userData.homeTarget='house';scene.add(additions);targets.push(additions);
 if(!options.contentOnly){const hemi=new T.HemisphereLight(0xffe7b5,0x526b70,grade.hemi),key=new T.DirectionalLight(grade.keyColor,grade.keyIntensity);key.position.set(-12,19,10);skyLight=hemi;sunLight=key;key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:1,far:60});key.shadow.bias=-.001;key.shadow.normalBias=.025;scene.add(hemi,key);scene.background.set(grade.sun>.3?0xabc9be:0x172c3a);scene.fog.color.copy(scene.background);}
 // Merlin uses the existing game portrait, perched by the door.
 if(options.portrait!==false){const tex=new T.TextureLoader().load('bird-art-cache/cutouts/merlin_burbz_manga_20260624_v2_cutout.png');tex.colorSpace=T.SRGBColorSpace;const bird=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true}));bird.scale.set(1.8,1.8,1);bird.position.set(2.2,2.1,1.4);scene.add(bird);}
 }
 for(const p of s.placed.filter(p=>p.area===area)){const mesh=ornament(T,C.ITEMS[p.item].type);mesh.position.set(p.x,0,p.z);mesh.rotation.y=p.turn*Math.PI/2;mesh.userData.placementId=p.id;scene.add(mesh);decor.push(mesh);targets.push(mesh);}
 const finds=[];for(const f of C.FINDS.filter(f=>f.area===area&&!f.id.endsWith('-story'))){const b=root.BurbzSettlementModels.batch(T);if(f.id==='tiny-door'){b.cylinder(.58,.72,1.35,f.x,.675,f.z,0x71543b);b.box(.44,.68,.08,f.x,.35,f.z+.6,0x345f50);for(const x of [-.26,.26])b.box(.065,.76,.09,f.x+x,.38,f.z+.62,0xc3ab74);b.sphere(.045,f.x+.13,.36,f.z+.68,0xd9ba65);}
 else if(f.id==='moon-pool'){b.cylinder(.65,.5,.3,f.x,.15,f.z,0xb1af99);b.cylinder(.53,.53,.015,f.x,.31,f.z,0x79a6a4);for(const x of [-.18,.18])b.sphere(.07,f.x+x,.335,f.z,0xd9e3c6,[1,.1,1]);}
 else if(f.id==='lost-pot'){b.cylinder(.3,.2,.42,f.x,.21,f.z,0xc68b69);b.box(.23,.018,.27,f.x,.44,f.z,0xe3ce9e);}
 else if(f.id==='merlin-acorn'){b.sphere(.16,f.x,.18,f.z,0xa68152,[.8,1,.8]);b.sphere(.18,f.x,.32,f.z,0x685139,[1,.4,1]);for(let i=0;i<5;i++)b.add(new T.ConeGeometry(.04,.14,3),0xdac478,[f.x+Math.sin(i*1.25)*.12,.44,f.z+Math.cos(i*1.25)*.12]);}
 else if(area==='yard'){b.add(new T.DodecahedronGeometry(.52),0xb4ae91,[f.x,.3,f.z],[0,.4,0],[1,.6,1]);for(let i=0;i<3;i++)b.box(.23-i*.03,.02,.035,f.x,.62,f.z+(i-1)*.09,0x8b784f);}
 else if(f.id==='floor-star'){b.add(new T.CylinderGeometry(.12,.12,.02,7),0xe5bf65,[f.x,.02,f.z]);}
 else{b.box(.24,.025,.3,f.x,.08,f.z,0xd6bb83);for(let i=0;i<3;i++)b.box(.14,.008,.015,f.x,.099,f.z+(i-1)*.06,0x7b623a);}const m=b.finish();m.userData.findId=f.id;scene.add(m);finds.push(m);targets.push(m);}
 root.BurbzManga?.styleScene(scene);
 return{scene,house,screen,screenSize,targets,decor,finds,world:C.world(s,area,createdAt,{connected:!!options.contentOnly}),light(g){if(skyLight){skyLight.intensity=g.hemi;sunLight.intensity=g.keyIntensity;sunLight.color.set(g.keyColor);scene.background.set(g.sun>.3?0xabc9be:0x172c3a);scene.fog.color.copy(scene.background);}},overhead(value){if(area==='yard'&&scene.fog){scene.fog.near=value?100:36;scene.fog.far=value?200:65;}frontLeaves?.traverse(o=>{if(o.material){o.material.transparent=true;o.material.opacity=value?.13:1;o.material.depthWrite=!value;}});},dispose:()=>disposeScene(scene)};
}
// The exact owned yard, expressed in local metres for the continuous world.
// Its owner supplies geographic placement, terrain, lighting and one renderer.
function createYardContent(T,home,options={}){const saved=C.normalize(home),now=options.now??Date.now(),view=create(T,saved,'yard',1,{}, {...options,now,contentOnly:true}),group=new T.Group();group.name='player-home-yard';for(const child of [...view.scene.children])group.add(child);group.updateMatrixWorld(true);
 const targets=[{kind:'home',id:'home-door',x:0,y:1.2,z:3.2,label:'Enter your home',range:2}];
 for(const f of C.FINDS.filter(f=>f.area==='yard'))targets.push({kind:'find',id:f.id,x:f.x,y:.6,z:f.z,label:saved.finds.includes(f.id)?'Read '+f.name:'Look closer',range:1.65});
 for(const t of C.TREES){const hits=C.treeState(saved,t.id,now);if(hits<3)targets.push({kind:'tree',id:t.id,x:t.x,y:1,z:t.z,label:'Chop tree · '+hits+'/3 strikes',range:1.65});}
 const solids=[],houseBounds=new T.Box3();for(const mesh of view.targets.filter(m=>m.userData.homeTarget==='house'))houseBounds.union(new T.Box3().setFromObject(mesh));solids.push({id:'house',x:0,z:0,w:5.5,d:4.5,minY:0,maxY:houseBounds.max.y});
 for(const mesh of view.decor){const p=saved.placed.find(p=>p.id===mesh.userData.placementId),item=C.ITEMS[p.item];if(item.flat)continue;const box=new T.Box3().setFromObject(mesh);solids.push({id:'decoration:'+p.id,x:p.x,z:p.z,w:p.turn%2?item.d:item.w,d:p.turn%2?item.w:item.d,minY:0,maxY:box.max.y});}
 for(const t of C.TREES)if(C.treeState(saved,t.id,now)<3){solids.push({id:t.id,x:t.x,z:t.z,w:t.r*2,d:t.r*2,minY:0,maxY:3.8});solids.push({id:t.id+':canopy',x:t.x,z:t.z,w:4.9,d:4.9,minY:1.6,maxY:7});}
 return{group,world:view.world,allowed:(x,z)=>view.world.allowed(x,z),targets,entrance:view.world.spawn(),radius:C.YARD.ground,blendRadius:C.YARD.ground+8,solids,day:view.world.day,dispose(){group.removeFromParent();disposeScene(group);}};
}
root.BurbzPlayerHomeScene={create,createYardContent,ornament,upperRooms,disposeScene};
})(globalThis);
