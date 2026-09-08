/* Timber joinery, furniture and warm window light, using the outdoor mesh toolkit. */
(function(root){'use strict';
function create(T,p){
 const scene=new T.Scene();scene.background=new T.Color(0x30291f);scene.fog=new T.Fog(0x423627,19,34);
 const wood=0x805b3b,trim=0x483528,stone=0xafa58e,cream=0xe2d0a7,iron=0x464b49,gold=0xbf9855;
 const batch=()=>root.BurbzSettlementModels.batch(T),b=batch(),w=p.width,d=p.depth,h=p.height;
 // Separate planks, pegs, exposed structural beams and inset framed windows.
 b.box(w,.18,d,0,-.10,0,trim);
 for(let z=-d/2+.17;z<d/2;z+=.35){b.box(w-.03,.05,.32,0,-.025,z,wood+(Math.round((z+d)*10)%3)*0x050402);for(const x of [-w/2+.18,w/2-.18])b.cylinder(.025,.025,.008,x,.007,z,trim);}
 b.box(w,h,.18,0,h/2,-d/2,cream);b.box(w,h,.18,0,h/2,d/2,cream);
 for(const x of [-w/2,w/2]){b.box(.18,h,d,x,h/2,0,cream);for(let z=-d/2;z<=d/2;z+=2.4){b.box(.22,h,.18,x,h/2,z,trim);}}
 for(const z of [-d/2+.12,d/2-.12]){b.box(w,.19,.2,0,.18,z,wood);b.box(w,.22,.22,0,h-.18,z,trim);for(let x=-w/2;x<=w/2;x+=2.3)b.box(.18,h,.2,x,h/2,z,trim);}
 b.box(w,.16,d,0,h+.12,0,wood);
 for(let z=-d/2+.8;z<d/2;z+=2.2){b.box(w,.26,.23,0,h-.1,z,trim);for(const x of [-w/2+.32,w/2-.32])b.box(.17,.95,.17,x,h-.52,z,wood,[0,0,x>0?-.55:.55]);}
 function window(x,z,turn){const a=batch();a.box(1.65,1.75,.16,0,1.95,0,trim);a.add(new T.BoxGeometry(1.4,1.5,.06),0xa9c7bd,[0,1.95,.1],[0,0,0],[1,1,1],true);a.box(.07,1.5,.12,0,1.95,.15,wood);a.box(1.4,.07,.12,0,1.95,.15,wood);a.box(1.8,.12,.45,0,1.06,.13,wood);for(const xx of [-.98,.98]){a.box(.32,1.73,.1,xx,1.95,.13,p.accent);for(let yy=1.2;yy<2.8;yy+=.2)a.box(.34,.035,.12,xx,yy,.19,trim);}const g=a.finish();g.position.set(x,0,z);g.rotation.y=turn;scene.add(g);}
 for(const x of [-w/2+.12,w/2-.12])for(const z of [-d*.24,d*.2])window(x,z,x<0?Math.PI/2:-Math.PI/2);
 // The closed exit door is a deliberate action; collision stops walking into the void.
 b.box(1.65,2.65,.22,0,1.32,d/2-.17,trim);b.box(1.4,2.4,.10,0,1.2,d/2-.31,p.accent);
 for(let x=-.6;x<.7;x+=.2)b.box(.025,2.35,.035,x,1.2,d/2-.38,trim);
 b.sphere(.07,.47,1.12,d/2-.44,gold);b.box(1.6,.08,.55,0,.04,d/2-.4,stone);
 // Hanging iron lanterns have real housings; no animated light/shadow cost.
 for(const z of [-d*.2,d*.23]){b.cylinder(.025,.025,.48,0,h-.24,z,iron);for(const x of [-.15,.15])for(const zz of [-.15,.15])b.box(.035,.42,.035,x,h-.65,z+zz,iron);b.box(.34,.05,.34,0,h-.87,z,iron);b.add(new T.BoxGeometry(.25,.30,.25),0xffd28a,[0,h-.65,z],[0,0,0],[1,1,1],true);b.box(.43,.08,.43,0,h-.4,z,gold);}
 scene.add(b.finish());
 function furniture(o){const f=batch(),type=o.type;const box=(ww,hh,dd,x,y,z,c=wood)=>f.box(ww,hh,dd,x,y,z,c),cyl=(r1,r2,hh,x,y,z,c=wood)=>f.cylinder(r1,r2,hh,x,y,z,c),ball=(r,x,y,z,c)=>f.sphere(r,x,y,z,c);
 function legs(ww,dd,yy=.75){for(const x of [-ww/2+.12,ww/2-.12])for(const z of [-dd/2+.12,dd/2-.12])box(.12,yy,.12,x,yy/2,z,trim);}
 function table(ww=1.7,dd=1,yy=.85){legs(ww,dd,yy);box(ww,.12,dd,0,yy,0);for(let x=-ww/2+.12;x<ww/2;x+=.28)box(.02,.014,dd-.04,x,yy+.065,0,trim);}
 function cup(x,y,z){cyl(.085,.065,.15,x,y,z,cream);f.add(new T.TorusGeometry(.06,.018,5,8),gold,[x+.09,y,z],[0,0,0]);}
 function barrel(x=0,z=0){cyl(.34,.3,.85,x,.44,z);for(const y of [.18,.7])cyl(.355,.355,.05,x,y,z,iron);cyl(.305,.305,.04,x,.88,z,wood);for(let i=0;i<10;i++){let a=i*Math.PI/5;box(.018,.73,.018,x+Math.cos(a)*.335,.44,z+Math.sin(a)*.335,trim);}}
 function shelf(){for(const x of [-.72,.72])box(.12,2.1,.55,x,1.05,0,trim);for(const y of [.13,.68,1.23,1.85]){box(1.55,.09,.58,0,y,0);for(let i=0;i<7;i++){let hh=.22+(i%3)*.07;box(.12,hh,.28,-.58+i*.18,y+hh/2+.045,.03,[p.accent,cream,0x8b4a3d,0x76815c][i%4]);}}}
 function hearth(forge=false){box(forge?2.5:1.8,.17,forge?1.6:.95,0,.085,0,stone);for(const x of [-.68,.68])box(.28,1.5,.7,x,.82,0,stone);box(1.75,.3,.9,0,1.64,0,stone);box(1,1.55,.45,0,2.48,-.2,stone);box(1.07,.9,.12,0,.65,-.3,trim);for(let i=0;i<3;i++)f.add(new T.ConeGeometry(.16,.5+i*.12,6),[0xffce68,0xef9140][i%2],[(i-1)*.25,.45,.07],[0,0,(i-1)*.2],[1,1,1],true);box(.9,.13,.15,0,.22,.12,wood);}
 if(type==='rug'){box(2,.015,3,0,.015,0,p.accent);for(const x of [-.92,.92])box(.06,.017,2.9,x,.02,0,cream);for(const z of [-1.4,1.4])box(1.88,.017,.06,0,.02,z,cream);}
 else if(type==='nest'||type==='cradle'||type==='nestbench'){if(type!=='nest')table(1.4,1,.5);const y=type==='nest'?.25:.75;for(let i=0;i<5;i++)f.add(new T.TorusGeometry(.48-i*.035,.045,5,16),i%2?wood:gold,[0,y+i*.04,0],[Math.PI/2,0,i*.4]);f.sphere(.37,0,y,0,cream,[1,.25,1]);if(type==='cradle')for(const x of [-.65,.65]){box(.08,1.85,.08,x,.95,0,trim);box(.09,.6,.09,x*.62,1.64,0,wood,[0,0,x<0?-.8:.8]);}if(type==='nestbench')for(let i=0;i<6;i++)box(.65,.025,.025,(i%2?-.8:.8),.65,i*.08-.2,gold);}
 else if(type==='perch'||type==='trainingrail'){for(const x of [-.55,.55]){cyl(.045,.065,1.2,x,.6,0);box(.35,.08,.55,x,.04,0,trim);}box(1.45,.1,.12,0,1.15,0,wood);if(type==='trainingrail')for(const x of [-.4,.4])f.add(new T.TorusGeometry(.28,.035,6,16),gold,[x,1.7,0],[0,0,0]);}
 else if(type==='target'){for(const x of [-.55,.55])box(.09,1.8,.09,x,.9,0,trim);for(let i=0;i<4;i++)f.add(new T.CylinderGeometry(.7-i*.16,.7-i*.16,.04,20),i%2?cream:p.accent,[0,1.42,.02+i*.035],[Math.PI/2,0,0]);}
 else if(['registry','medicine','treasure','panrack','weapons'].includes(type)){shelf();table(1.7,.8,.65);if(type==='medicine')for(let i=0;i<7;i++)cyl(.06,.09,.25,(i-3)*.19,.86,0,[0x6b9a85,0xb18a4b,0x869eac][i%3]);else if(type==='registry'){box(1.1,.04,.6,0,.75,0,cream);for(let i=0;i<5;i++)box(.8,.005,.015,0,.777,i*.08-.17,trim);}else if(type==='treasure')for(let i=0;i<14;i++)cyl(.08,.08,.045,(i%5-2)*.2,.78+Math.floor(i/5)*.04,0,gold);else for(let i=0;i<4;i++){box(.035,1.05,.035,(i-1.5)*.34,1.12,.37,iron);if(type==='panrack')f.add(new T.TorusGeometry(.14,.045,6,12),gold,[(i-1.5)*.34,.7,.37],[0,0,0]);}}
 else if(type==='planningboard'||type==='questboard'){for(const x of [-.75,.75])box(.11,2.45,.14,x,1.23,0,trim);box(1.8,1.55,.12,0,1.62,0,wood);for(let i=0;i<6;i++){box(.42,.52,.03,(i%3-1)*.52,1.27+Math.floor(i/3)*.65,.085,cream);cyl(.035,.035,.035,(i%3-1)*.52,1.48+Math.floor(i/3)*.65,.12,gold);}if(type==='planningboard'){table(1.7,.9,.6);for(let i=0;i<4;i++){box(.25,.25,.3,(i%2-.5)*.6,.8,Math.floor(i/2)*.4-.2,p.accent);f.add(new T.ConeGeometry(.23,.2,4),trim,[(i%2-.5)*.6,1,Math.floor(i/2)*.4-.2],[0,Math.PI/4,0]);}}}
 else if(type==='mobile'){box(.12,2.5,.12,0,1.25,0,wood);box(1.3,.08,.08,0,2.45,0,trim);for(const x of [-.5,0,.5]){box(.012,.7,.012,x,2.06,0,gold);ball(.14,x,1.68,0,[cream,p.accent,gold][Math.round((x+.5)*2)]);}}
 else if(type==='bed'||type==='bunk'){legs(1.55,2.2,.5);for(const y of type==='bunk'?[.5,1.75]:[.5]){box(1.55,.19,2.2,0,y,0,trim);box(1.45,.19,2.05,0,y+.16,0,cream);box(1.46,.06,1.5,0,y+.28,.24,p.accent);for(const x of [-.65,.65])box(.035,.025,1.48,x,y+.32,.24,gold);box(.95,.13,.4,0,y+.3,-.77,0xf0e3c7);}box(1.58,1.05,.14,0,.65,-1.05,wood);for(const x of [-.75,.75])box(.1,type==='bunk'?2.3:1.2,.1,x,type==='bunk'?1.15:.6,-1.05,trim);}
 else if(type==='bookwall'){for(const cx of [-1.65,0,1.65]){for(const x of [-.75,.75])box(.12,2.85,.6,cx+x,1.43,0,trim);for(const y of [.14,.75,1.36,1.97,2.62]){box(1.58,.09,.6,cx,y,0);for(let i=0;i<8;i++){const hh=.25+(i%3)*.07;box(.13,hh,.32,cx-.64+i*.18,y+hh/2+.05,.05,[p.accent,cream,0x805944,0x637b68][i%4]);}}box(1.7,.16,.72,cx,2.94,0,gold);}for(const x of [-2.4,2.4])box(.07,2.8,.08,x,1.4,.5,wood);for(let i=0;i<7;i++)box(.7,.055,.1,2.1,.3+i*.34,.5,trim);}
 else if(type==='tradecounter'){box(5,.7,1.05,0,.35,0,trim);box(5.2,.12,1.25,0,.76,0,wood);for(let i=0;i<7;i++){const x=(i-3)*.68;box(.54,.43,.045,x,.39,.55,p.accent);box(.55,.06,.5,x,.85,0,gold);for(let j=0;j<3;j++)ball(.07,x+(j-1)*.13,.94,0,[gold,0x859eae,0x778c6b][i%3]);}box(.065,.65,.06,0,1.14,0,gold);box(.92,.045,.05,0,1.49,0,gold);for(const x of [-.41,.41]){box(.014,.29,.014,x,1.34,0,iron);cyl(.2,.1,.07,x,1.16,0,gold);}for(const x of [-2.5,2.5])box(.09,2.85,.09,x,1.43,-.4,trim);for(let i=0;i<10;i++)box(.5,.10,1.25,(i-4.5)*.51,2.9,-.1,i%2?cream:p.accent);}
 else if(type==='shelf'||type==='racks'){shelf();}
 else if(type==='fireplace'||type==='forge'){hearth(type==='forge');}
 else if(type==='bar'){box(7,1.12,1,0,.56,0,trim);box(7.15,.16,1.15,0,1.19,0);for(let x=-3.25;x<3.5;x+=.65){box(.51,.73,.04,x,.55,.51,p.accent);cyl(.045,.06,.32,x,1.44,-.2,[0x426f54,0x9f633d][Math.round(x*100)%2===0?0:1]);cup(x,1.35,.25);}for(const x of [-2.5,0,2.5]){f.add(new T.TorusGeometry(.22,.035,6,12),gold,[x,.27,.67],[Math.PI/2,0,0]);}}
 else if(type==='table'||type==='teatable'){table(type==='table'?1.6:1.3,1.1);cup(-.35,.98,0);cup(.35,.98,0);cyl(.14,.12,.2,0,1.02,0,iron);for(const z of [-.67,.67]){box(1.6,.1,.26,0,.48,z);for(const x of [-.6,.6])box(.1,.46,.18,x,.23,z,trim);}}
 else if(type==='armchair'){legs(.9,.85,.4);box(.9,.25,.8,0,.48,0,p.accent);box(.9,.8,.19,0,.92,-.33,p.accent);for(const x of [-.42,.42])box(.14,.2,.83,x,.76,0,wood);}
 else if(type==='pew'){legs(2.5,.6,.45);box(2.5,.14,.65,0,.49,0);box(2.5,.48,.12,0,.84,-.27);}
 else if(type==='loom'){for(const x of [-.75,.75])box(.12,1.95,.17,x,.98,0,trim);for(const y of [.28,1.78])box(1.6,.14,.17,0,y,0);box(1.3,1.25,.03,0,1.02,0,p.accent);for(let x=-.6;x<.7;x+=.07)box(.017,1.55,.05,x,1.04,.035,cream);box(1.75,.12,.4,0,.62,.48);}
 else if(type==='piano'||type==='organ'){box(1.9,1.35,.65,0,.68,-.12,trim);box(1.7,.14,.5,0,.91,.35,cream);for(let i=0;i<16;i++)box(.05,.06,.22,-.78+i*.10,1.02,.25,iron);if(type==='organ')for(let i=0;i<7;i++)cyl(.07,.07,1+Math.sin(i/6*Math.PI),-.75+i*.25,1.65+Math.sin(i/6*Math.PI)/2,-.12,gold);}
 else if(type==='telescope'){for(let i=0;i<3;i++)f.add(new T.BoxGeometry(.07,1.35,.07),trim,[Math.sin(i*2.1)*.25,.6,Math.cos(i*2.1)*.25],[Math.cos(i*2.1)*.4,0,-Math.sin(i*2.1)*.4]);f.cylinder(.16,.1,1.15,0,1.46,0,gold,[.9,0,0]);}
 else if(type==='globe'){cyl(.12,.25,.85,0,.43,0,trim);ball(.38,0,1.15,0,0x769a92);f.add(new T.TorusGeometry(.43,.025,6,18),gold,[0,1.15,0],[0,0,.3]);}
 else if(type==='planter'||type==='pots'||type==='produce'){table(1.2,.7,.6);for(let i=0;i<3;i++){const x=(i-1)*.35;cyl(.13,.09,.24,x,.79,0,0xb57b5d);if(type==='planter'){cyl(.018,.018,.6,x,1.12,0,0x526e3f);for(let j=0;j<4;j++)f.sphere(.15,x+(j%2?.1:-.1),.97+j*.1,0,0x7e945b,[1,.32,.65]);}else ball(.09,x,.96,0,type==='produce'?0xbb984f:p.accent);}}
 else if(type==='woodpile'){for(let y=0;y<3;y++)for(let i=0;i<4-y;i++)f.cylinder(.14,.14,.95,(i-(3-y)/2)*.28,.16+y*.24,0,wood,[Math.PI/2,0,0]);}
 else if(type==='barrels'){barrel(-.33,-.05);barrel(.33,.08);}
 else if(type==='chest'||type==='trunks'||type==='crates'){box(1.15,.65,.75,0,.34,0);box(1.2,.14,.8,0,.73,0,trim);for(const x of [-.42,.42])box(.08,.7,.8,x,.38,0,iron);box(.13,.17,.03,0,.57,.41,gold);}
 else if(type==='oven'){box(1.7,1.2,1,0,.6,0,stone);f.sphere(.72,0,1.2,0,stone,[1,1,.65]);box(.8,.52,.08,0,.72,.51,iron);box(.9,.09,.45,0,.39,.64,wood);}
 else if(type==='anvil'){box(.7,.6,.65,0,.3,0,wood);box(.8,.15,.45,0,.76,0,iron);box(.5,.3,.36,0,.59,0,iron);f.add(new T.ConeGeometry(.23,.7,5),iron,[.54,.76,0],[0,0,-Math.PI/2]);}
 else if(type==='altar'){table(2.7,1.1,1);box(2.75,.03,1.13,0,1.09,0,p.accent);for(const x of [-.9,.9]){cyl(.06,.1,.36,x,1.28,0,gold);cyl(.04,.04,.22,x,1.55,0,cream);}box(.6,.09,.4,0,1.16,0,cream);}
 else if(type==='stall'){table(2.3,1.1,.85);for(const x of [-1.05,1.05])box(.1,2.35,.1,x,1.17,-.4,trim);for(let x=-1.1;x<1.2;x+=.3)box(.3,.08,1.35,x,2.35,0,Math.round(x*10)%2===0?p.accent:cream);for(let i=0;i<5;i++)ball(.13,-.8+i*.4,1.05,0,[0xa9aa59,0xbc6753,0xd0a75a][i%3]);}
 else if(type==='stage'){box(5,.32,2,0,.16,0);for(const x of [-2.3,2.3])box(.36,2.7,.2,x,1.65,-.75,p.accent);box(4.8,.35,.25,0,2.9,-.75,p.accent);}
 else if(type==='pump'){cyl(.75,.8,.7,0,.35,0,stone);cyl(.6,.6,.025,0,.72,0,0x6b9b9b);cyl(.15,.18,1.5,.45,.75,0,iron);box(.6,.12,.16,.2,1.46,0,iron);box(.07,.45,.07,.48,1.65,0,wood);}
 else if(type==='easel'||type==='mirror'||type==='net'){for(const x of [-.45,.45])box(.07,1.9,.07,x,.95,0,wood);box(1.02,1.24,.08,0,1.22,0,trim);box(.86,1.08,.025,0,1.22,.05,type==='mirror'?0xa5b9b7:cream);if(type==='easel'){f.sphere(.25,0,1.34,.08,p.accent,[1,.7,.02]);box(.85,.23,.03,0,.83,.09,0x8e9c72);}if(type==='net')for(let i=0;i<7;i++){box(.012,1.04,.02,-.4+i*.13,1.22,.07,wood);box(.85,.012,.02,0,.7+i*.16,.07,wood);}}
 else if(type==='clock'){box(.65,1.95,.5,0,.99,0,trim);cyl(.21,.21,.035,0,1.55,.29,cream);f.add(new T.CylinderGeometry(.24,.24,.05,12),cream,[0,1.55,.28],[Math.PI/2,0,0]);box(.025,.18,.02,0,1.6,.32,iron);box(.15,.025,.02,.06,1.55,.32,iron);box(.025,.75,.04,0,.84,.28,gold);ball(.1,0,.46,.28,gold);}
 else if(type==='hives'){for(const x of [-.32,.32]){box(.52,.24,.7,x,.13,0,trim);for(let i=0;i<3;i++)box(.55,.22,.65,x,.35+i*.24,0,cream);box(.65,.1,.75,x,1,0,p.accent);}}
 else if(type==='wheel'){cyl(.35,.4,.58,0,.29,0,wood);cyl(.55,.55,.07,0,.62,0,stone);cyl(.18,.23,.35,0,.83,0,0xb5785b);}
 else {table(type==='saw'?2.7:1.85,.9);if(type==='mapdesk'){box(1.5,.014,.7,0,.925,0,cream);for(let i=0;i<5;i++)box(.05,.02,.6,-.6+i*.3,.94,0,p.accent);}
  else if(type==='saw'){f.add(new T.CylinderGeometry(.48,.48,.04,16),iron,[0,.97,0],[0,0,Math.PI/2]);box(2.5,.18,.18,0,1,.24,wood);}
  else if(type==='ore'||type==='stone'){for(let i=0;i<4;i++)f.add(new T.DodecahedronGeometry(.22),type==='ore'?0x76726c:stone,[(i-1.5)*.35,1.09,0]);}
  else if(type==='spools'){for(let i=0;i<4;i++)cyl(.12,.12,.27,(i-1.5)*.35,1.06,0,[p.accent,cream,gold][i%3]);}
  else if(type==='music'){box(.55,.65,.08,0,1.35,0,trim);box(.48,.5,.03,0,1.4,.06,cream);for(let i=0;i<4;i++)box(.38,.01,.01,0,1.25+i*.08,.08,iron);}
  else if(type==='scales'){box(.08,.75,.08,0,1.26,0,gold);box(.95,.05,.06,0,1.61,0,gold);for(const x of [-.43,.43]){box(.018,.3,.018,x,1.46,0,iron);cyl(.22,.12,.08,x,1.28,0,gold);}}
  else {box(.9,.08,.28,0,.96,0,cream);box(.12,.07,.6,.4,.98,0,iron);cup(-.6,1.01,0);}}
 const g=f.finish();g.position.set(o.x,0,o.z);g.rotation.y=o.rot;g.userData.furniture=type;scene.add(g);
 }
 p.props.forEach(furniture);
 if(p.scope==='academy'){const canopy=batch();for(const z of [-d/2+.35,d/2-.35]){for(let i=0;i<9;i++){const x=(i-4)*(w-1)/8;canopy.add(new T.TorusGeometry(.24,.03,5,10),p.accent,[x,h-.42,z],[0,0,0]);}}for(const x of [-w/2+.45,w/2-.45])for(let z=-d/2+.8;z<d/2;z+=2){canopy.cylinder(.05,.07,.55,x,.28,z,wood);canopy.box(.65,.08,.15,x,.54,z,gold);}scene.add(canopy.finish());}

 scene.add(new T.HemisphereLight(0xffe7bd,0x697572,1.55));const key=new T.DirectionalLight(0xffdeb0,1.7);key.position.set(-3,6,4);scene.add(key);const fill=new T.DirectionalLight(0xadc8cc,.75);fill.position.set(4,3,-4);scene.add(fill);
 root.BurbzManga?.styleScene(scene);
 return{scene,plan:p,world:root.BurbzBuildingRoomsCore.world(p),dispose(){scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});scene.clear();}};
}
root.BurbzBuildingRoomsScene={create};
})(typeof globalThis!=='undefined'?globalThis:this);
