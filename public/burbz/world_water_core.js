/* Streams and waterfalls from real mapped watercourses and real elevation.
 * Pure geometry: no rendering, persistence or game state. Mapped lines run
 * downstream, so distance along a line is the direction of flow. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzWorldWaterCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const STEP=2,WIDTH={river:5,canal:4,stream:2.2,drain:1.3,ditch:1.1};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function width(kind,intermittent){return(WIDTH[kind]||WIDTH.stream)*(intermittent?.7:1);}
// Surface speed in metres a second: slow in pools, quicker on steep ground,
// fastest where the water falls. Canals barely move.
function speed(steep,fall,kind){return fall?4.2:kind==='canal'?.25:.55+2.4*clamp(steep,0,1);}
// Resample a mapped line every 2m, keeping distance along the flow.
function resample(line){
 const out=[];let s=0;
 for(let i=0;i<line.length;i++){const p=line[i];if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z))return[];if(!i){out.push({x:p.x,z:p.z,s:0});continue;}
  const a=line[i-1],len=Math.hypot(p.x-a.x,p.z-a.z);if(!(len>1e-6))continue;const n=Math.max(1,Math.ceil(len/STEP));
  for(let j=1;j<=n;j++){const t=j/n;out.push({x:a.x+(p.x-a.x)*t,z:a.z+(p.z-a.z)*t,s:s+len*t});}s+=len;}
 // Mitred joins: each sample faces along the average of its neighbours.
 for(let i=0;i<out.length;i++){const a=out[Math.max(0,i-1)],b=out[Math.min(out.length-1,i+1)],len=Math.hypot(b.x-a.x,b.z-a.z)||1;out[i].ux=(b.x-a.x)/len;out[i].uz=(b.z-a.z)/len;}
 return out;
}
// Steepness along the flow over about 6m, 0 for flat water, 1 for a fall.
function profile(samples,height){
 for(const p of samples)p.h=height(p.x,p.z);
 // A jump of more than 6m between 2m samples is a gap in the elevation
 // data, not a real cliff; treat that stretch as unknown ground.
 for(let i=1;i<samples.length;i++)if(Number.isFinite(samples[i].h)&&Number.isFinite(samples[i-1].h)&&Math.abs(samples[i].h-samples[i-1].h)>6)samples[i].h=NaN;
 for(let i=0;i<samples.length;i++){const a=samples[Math.max(0,i-3)],b=samples[Math.min(samples.length-1,i+3)],run=Math.max(1,b.s-a.s),drop=Number.isFinite(a.h)&&Number.isFinite(b.h)?a.h-b.h:0;
  samples[i].grade=Math.max(0,drop/run);samples[i].steep=clamp((samples[i].grade-.12)/.55,0,1);}
 return samples;
}
// Runs steeper than ~37 degrees that fall at least 3.5m become waterfalls.
function falls(samples,w){
 const rows=[];let start=-1;
 for(let i=0;i<=samples.length;i++){const steep=i<samples.length&&samples[i].grade>.75;
  if(steep&&start<0)start=i;
  if(!steep&&start>=0){const top=samples[Math.max(0,start-1)],foot=samples[Math.min(samples.length-1,i)],drop=top.h-foot.h;
   if(Number.isFinite(drop)&&drop>=3.5&&drop<=80&&drop<=(foot.s-top.s)*2.5)rows.push({top,foot,drop,width:w,from:start,to:i});start=-1;}}
 return rows;
}
// Shape one mapped line once: 2m samples, real heights, steepness and falls.
// The DEM height is smooth and deterministic, so the result can be cached.
// lift marks the samples a fall runs over. widthAt(point), when given,
// sets each sample's own width, as for a settlement river that narrows away.
function prepare(line,kind,intermittent,height,widthAt=null){
 const w=width(kind,intermittent),samples=profile(resample(line),height),drops=samples.length>1?falls(samples,w):[],lift=new Float32Array(samples.length);
 if(widthAt)for(const q of samples)q.w=Math.max(0,widthAt(q)||0);
 for(const f of drops)for(let i=f.from;i<f.to;i++)lift[i]=clamp(.3+f.drop*.05,.3,.8);
 const x0=Math.min(...samples.map(p=>p.x)),x1=Math.max(...samples.map(p=>p.x)),z0=Math.min(...samples.map(p=>p.z)),z1=Math.max(...samples.map(p=>p.z));
 return{samples,falls:drops,lift,width:w,kind:WIDTH[kind]?kind:'stream',bounds:{x0,x1,z0,z1}};
}
// The point a distance s along a prepared stream, between its samples.
function at(stream,s){
 const S=stream.samples;if(!S.length)return null;if(s<=S[0].s)return{...S[0],i:0};const last=S[S.length-1];if(s>=last.s)return{...last,i:S.length-1};
 let lo=0,hi=S.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(S[m].s<=s)lo=m;else hi=m;}
 const a=S[lo],b=S[hi],t=(s-a.s)/Math.max(1e-6,b.s-a.s),mix=(p,q)=>p+(q-p)*t,h=Number.isFinite(a.h)&&Number.isFinite(b.h)?mix(a.h,b.h):Number.isFinite(a.h)?a.h:b.h;
 const ux=mix(a.ux,b.ux),uz=mix(a.uz,b.uz),len=Math.hypot(ux,uz)||1;
 return{x:mix(a.x,b.x),z:mix(a.z,b.z),s,h,ux:ux/len,uz:uz/len,steep:mix(a.steep,b.steep),w:a.w===undefined?undefined:mix(a.w,b.w??a.w),i:lo};
}
// A waterfall leaves its lip in an arc and lands in the pool at its foot. The
// steeper the real drop, the further the sheet stands off the rock behind it.
// Rows run evenly down the sheet; five vertices cross it. Flow attributes are
// [metres below the lip, side -1..1, 0 at the lip to 1 at the foot, half width].
function curtain(stream,f,height,cell,out){
 const w=stream.width,run=Math.max(1,f.foot.s-f.top.s),drop=f.drop,free=clamp((drop/run-.75)/1.1,0,1)*.8+.2;
 // A dense arc first, then even rows by length, so long falls stay smooth.
 const arc=[];let len=0;
 for(let k=-3;k<=48;k++){const u=k/48,p=at(stream,f.top.s+u*run);if(!p||!Number.isFinite(p.h))return false;
  const ground=height(p.x,p.z),g=Number.isFinite(ground)?ground:p.h;
  // Above the lip the water is still the stream; below it, it flies.
  const fly=u<=0?g+.1:f.top.h+.12-(drop+.05)*u*u,y=u<=0?g+.1:Math.max(g+.18*(1-u)+.06,g+(fly-g)*free+.18*(1-u));
  const q={x:p.x,z:p.z,y,ux:p.ux,uz:p.uz,u:Math.max(0,u)};if(arc.length){const a=arc[arc.length-1];len+=Math.hypot(q.x-a.x,q.y-a.y,q.z-a.z);}q.len=len;arc.push(q);}
 const rows=clamp(Math.round(len/1.2),6,40),first=out.positions.length/3;
 for(let r=0;r<=rows;r++){const target=len*r/rows;let j=1;while(j<arc.length-1&&arc[j].len<target)j++;const a=arc[j-1],b=arc[j],t=clamp((target-a.len)/Math.max(1e-6,b.len-a.len),0,1);
  const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=a.y+(b.y-a.y)*t,u=a.u+(b.u-a.u)*t,ux=a.ux+(b.ux-a.ux)*t,uz=a.uz+(b.uz-a.uz)*t,half=w/2*(1.15+.45*u),below=Math.max(0,f.top.h-y);
  // The sheet bows forward in its middle, like water over a rounded lip.
  for(const side of [-1,-.5,0,.5,1]){const bow=.35*w*(1-side*side)*Math.sin(Math.PI*u)*free;out.positions.push(x-uz*side*half+ux*bow-cell.x,y,z+ux*side*half+uz*bow-cell.z);out.flow.push(below,side,u,half);}}
 for(let r=0;r<rows;r++)for(let c=0;c<4;c++){const a=first+r*5+c,b=a+5;out.indices.push(a,b,a+1,a+1,b,b+1);}
 return true;
}
// One chunk's share of every stream: pieces whose middle lies in the chunk,
// so neighbouring chunks meet exactly with no overlap. Vertex heights come
// from the chunk's own ground. Flow attributes are [distance along, side
// -1..1, steepness]; shape attributes are [flow x, flow z, half width, part]
// where part is 0 for the stream, 1 for a plunge pool and 2 for the wet rock
// a fall pours down. Pools flow outward from their centre. wet(x,z) marks
// mapped lakes and river areas, which draw their own water.
function build(cell,size,prepared,height,{wet=null}={}){
 const positions=[],flow=[],shape=[],indices=[],mist=[],gully=[],banks=[],splash=[],falling={positions:[],flow:[],indices:[]};
 const inCell=(x,z)=>x>=cell.x&&x<cell.x+size&&z>=cell.z&&z<cell.z+size;
 // Map tiles overlap at their edges, so one river can arrive as two pieces
 // along the same stretch. The first piece draws it; the other skips it.
 const drawn=new Map(),key=(x,z)=>Math.floor(x/2)+','+Math.floor(z/2);
 const twin=(id,x,z,ux,uz,r)=>{for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const q of drawn.get(key(x+dx*2,z+dz*2))||[])if(q.id!==id&&Math.hypot(q.x-x,q.z-z)<r&&Math.abs(q.ux*ux+q.uz*uz)>.8)return true;return false;};
 for(const [id,stream] of prepared.entries()){
  const {samples,lift,width:w}=stream,b=stream.bounds;if(samples.length<2||b.x1<cell.x-w||b.x0>cell.x+size+w||b.z1<cell.z-w||b.z0>cell.z+size+w)continue;
  // Falling water fans out a little wider than the stream above it.
  const halfAt=(p,i)=>(p.w??w)/2*clamp(p.s/3,.35,1)*(lift[i]>0?1.25:1+p.steep*.25);
  const vertex=(p,i,side)=>{const half=halfAt(p,i),x=p.x-p.uz*side*half,z=p.z+p.ux*side*half,y=height(x,z);return Number.isFinite(y)?[x,y+.08,z,half]:null;};
  // Steep water cuts a dark, wet rock gully lined with boulders.
  for(let i=0;i<samples.length;i++){const p=samples[i],rough=lift[i]>0?1:p.steep;if(rough<.45||p.x<cell.x-8||p.x>cell.x+size+8||p.z<cell.z-8||p.z>cell.z+size+8)continue;if(wet?.(p.x,p.z))continue;gully.push({x:p.x,z:p.z,r:w*(lift[i]>0?1.5:1.1)+1.6,t:rough});
   if(i%2===0&&inCell(p.x,p.z))for(const side of [-1,1]){const d=w*(lift[i]>0?.95:.75)+.7+(i%3)*.25,x=p.x-p.uz*side*d,z=p.z+p.ux*side*d,y=height(x,z);if(Number.isFinite(y))banks.push({x,z,y,size:.45+rough*.45+((i*7)%5)*.08,angle:i*1.7+side});}}
  for(let i=1;i<samples.length;i++){const a=samples[i-1],c=samples[i],mx=(a.x+c.x)/2,mz=(a.z+c.z)/2;if(!inCell(mx,mz))continue;
   if(wet&&wet(a.x,a.z)&&wet(c.x,c.z))continue;
   const ux=c.x-a.x,uz=c.z-a.z,l=Math.hypot(ux,uz)||1;if(twin(id,mx,mz,ux/l,uz/l,Math.max(1.2,w*.45)))continue;
   const quad=[vertex(a,i-1,-1),vertex(a,i-1,1),vertex(c,i,-1),vertex(c,i,1)];if(quad.some(v=>!v)||quad[0][3]+quad[2][3]<.3)continue;
   (drawn.get(key(mx,mz))||drawn.set(key(mx,mz),[]).get(key(mx,mz))).push({id,x:mx,z:mz,ux:ux/l,uz:uz/l});
   const base=positions.length/3;for(const [k,v] of quad.entries()){const j=k<2?i-1:i,p=samples[j];positions.push(v[0]-cell.x,v[1],v[2]-cell.z);flow.push(p.s,k%2?1:-1,lift[j]>0?1:p.steep);shape.push(p.ux,p.uz,v[3],lift[j]>0?2:0);}
   indices.push(base,base+1,base+2,base+1,base+3,base+2);}
  for(const f of stream.falls){
   // The sheet belongs to the chunk that holds its lip.
   if(inCell(f.top.x,f.top.z))curtain(stream,f,height,cell,falling);
   // A plunge pool, churning outward from where the water lands.
   if(!inCell(f.foot.x,f.foot.z))continue;const y=height(f.foot.x,f.foot.z);if(!Number.isFinite(y))continue;const r=w*1.7,base=positions.length/3;
   const rim=j=>{const a=j/10*Math.PI*2,x=f.foot.x+Math.cos(a)*r,z=f.foot.z+Math.sin(a)*r,h=height(x,z);return{x,z,y:Math.max(y,Number.isFinite(h)?h:y)+.07,ux:Math.cos(a),uz:Math.sin(a)};};
   for(let j=0;j<10;j++){const p=rim(j),q=rim(j+1),m=(j+.5)/10*Math.PI*2;
    positions.push(f.foot.x-cell.x,y+.07,f.foot.z-cell.z);flow.push(0,0,.9);shape.push(Math.cos(m),Math.sin(m),r,1);
    for(const e of [q,p]){positions.push(e.x-cell.x,e.y,e.z-cell.z);flow.push(r,1,.25);shape.push(e.ux,e.uz,r,1);}
    indices.push(base+j*3,base+j*3+1,base+j*3+2);}
   for(let j=0;j<3;j++)mist.push({x:f.foot.x+(j-1)*w*.35,y:y+.5+j*.55,z:f.foot.z+(j%2?.3:-.3),size:1.3+Math.min(f.drop,40)*.09+j*.4,phase:j*2.1+f.foot.s*.1});
   // Droplets thrown up where the fall lands, more for a bigger fall.
   const n=clamp(Math.round(8+f.drop*.8),8,36);
   for(let j=0;j<n;j++){const a=j*2.39996+f.foot.s,k=((j*37)%11)/11;splash.push({x:f.foot.x+Math.cos(a)*w*.3,y:y+.1,z:f.foot.z+Math.sin(a)*w*.3,dx:Math.cos(a),dz:Math.sin(a),speed:1.2+k*1.6+Math.min(f.drop,30)*.05,rise:2+k*2.2+Math.min(f.drop,30)*.08,phase:((j*53)%17)/17,size:.16+k*.1});}}
 }
 return{positions,flow,shape,indices,mist,gully,banks,splash,curtain:falling};
}
// The nearest running water to a point and every waterfall within reach,
// for the sound of the water and the flecks drifting on it. d is metres to
// the water's edge, 0 when standing in it.
function nearest(prepared,x,z,reach=60){
 let best=null;const drops=[];
 for(const stream of prepared){const b=stream.bounds,S=stream.samples,w=stream.width;if(S.length<2||x<b.x0-reach||x>b.x1+reach||z<b.z0-reach||z>b.z1+reach)continue;
  for(let i=1;i<S.length;i++){const a=S[i-1],c=S[i],ex=c.x-a.x,ez=c.z-a.z,l2=ex*ex+ez*ez||1,t=clamp(((x-a.x)*ex+(z-a.z)*ez)/l2,0,1),px=a.x+ex*t,pz=a.z+ez*t,wide=a.w??w,d=Math.max(0,Math.hypot(x-px,z-pz)-wide/2);if(wide<.3)continue;
   if(d<reach&&(!best||d<best.d)){const fall=stream.lift[i-1]>0||stream.lift[i]>0;best={d,x:px,z:pz,y:Number.isFinite(a.h)&&Number.isFinite(c.h)?a.h+(c.h-a.h)*t:null,s:a.s+(c.s-a.s)*t,ux:ex/Math.sqrt(l2),uz:ez/Math.sqrt(l2),steep:fall?1:a.steep+(c.steep-a.steep)*t,width:wide,kind:stream.kind,speed:speed(a.steep+(c.steep-a.steep)*t,fall,stream.kind),stream};}}
  for(const f of stream.falls){const d=Math.hypot(x-f.foot.x,z-f.foot.z);if(d<reach+f.drop)drops.push({d,drop:f.drop,x:f.foot.x,z:f.foot.z,y:f.foot.h,width:w});}}
 drops.sort((a,b)=>a.d-b.d);
 return{water:best,falls:drops};
}
// How loud each kind of running water is at the listener, where it sits and
// how bright it sounds. Small quick water babbles; broad water rushes; a fall
// roars from further off, the bigger the drop. listener: {x,y,z,yaw}, where
// the camera faces (-sin yaw, -cos yaw). Levels run 0..1.
function listen(near,listener){
 const out={brook:{level:0,pan:0,cutoff:12000},river:{level:0,pan:0,cutoff:12000},fall:{level:0,pan:0,cutoff:12000}};
 const fade=(d,reach)=>Math.pow(clamp(1-d/reach,0,1),1.5);
 const place=(layer,x,y,z,edge,level,wide)=>{if(!(level>layer.level))return;const dx=x-listener.x,dz=z-listener.z,flat=Math.hypot(dx,dz),d=Math.hypot(edge,Number.isFinite(y)?y-listener.y:0);
  // Beside broad water the sound surrounds you; a far one sits to one side.
  const right=(dx*Math.cos(listener.yaw)-dz*Math.sin(listener.yaw))/Math.max(.5,flat);
  layer.level=level;layer.pan=clamp(right*.8*clamp(flat/(wide?7:3),.25,1),-.85,.85);layer.cutoff=clamp(15000*Math.exp(-d/40),1800,15000);};
 const w=near?.water;
 if(w){const d=Math.hypot(w.d,Number.isFinite(w.y)?w.y-listener.y:0),size=clamp((w.width-1)/4,0,1),lively=clamp(w.steep*1.3,0,1),still=w.kind==='canal'?.25:1;
  place(out.brook,w.x,w.y,w.z,w.d,(1-size*.65)*(.4+.6*lively)*fade(d,16+lively*8)*still,false);
  place(out.river,w.x,w.y,w.z,w.d,(.2+size*.8)*(.45+.55*lively)*fade(d,26+size*20)*still,true);}
 for(const f of near?.falls||[]){const d=Math.hypot(f.d,Number.isFinite(f.y)?f.y-listener.y:0);place(out.fall,f.x,f.y,f.z,f.d,clamp(.4+f.drop/25,0,1)*fade(d,28+f.drop*2.5),false);}
 return out;
}
// A tileable water texture, made once: ripple slopes in red and green,
// clumpy foam in blue and the bright web of caustic light in alpha. Every
// layer repeats across the tile, so it can scroll and tile without seams.
function texture(size=128){
 let seed=0x2f6b1d3;const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
 const data=new Uint8Array(size*size*4),TAU=Math.PI*2,n=size*size;
 function perlin(cells){const g=new Float32Array(cells*cells*2);for(let i=0;i<cells*cells;i++){const a=rnd()*TAU;g[i*2]=Math.cos(a);g[i*2+1]=Math.sin(a);}
  const out=new Float32Array(n),dot=(i,j,dx,dy)=>{const k=(((j%cells)+cells)%cells)*cells+(((i%cells)+cells)%cells);return g[k*2]*dx+g[k*2+1]*dy;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size*cells,v=y/size*cells,i0=Math.floor(u),j0=Math.floor(v),fu=u-i0,fv=v-j0;
   const su=fu*fu*fu*(fu*(fu*6-15)+10),sv=fv*fv*fv*(fv*(fv*6-15)+10),a=dot(i0,j0,fu,fv),b=dot(i0+1,j0,fu-1,fv),c=dot(i0,j0+1,fu,fv-1),d=dot(i0+1,j0+1,fu-1,fv-1),top=a+(b-a)*su;
   out[y*size+x]=top+(c+(d-c)*su-top)*sv;}
  return out;}
 // Ripples: soft rolling swells with sharper, narrower crests on top.
 const h=new Float32Array(n);
 for(const [cells,amp,ridge] of [[4,1,.35],[8,.55,.5],[16,.28,.6],[32,.12,.6]]){const p=perlin(cells);for(let i=0;i<n;i++)h[i]+=amp*((1-ridge)*p[i]+ridge*(.35-Math.abs(p[i])));}
 const gx=new Float32Array(n),gy=new Float32Array(n);let peak=1e-6;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x,at=(a,b)=>h[((b+size)%size)*size+((a+size)%size)];gx[i]=(at(x+1,y)-at(x-1,y))*.5;gy[i]=(at(x,y+1)-at(x,y-1))*.5;peak=Math.max(peak,Math.abs(gx[i]),Math.abs(gy[i]));}
 const foam=new Float32Array(n);for(const [cells,amp] of [[4,.5],[8,.28],[16,.15],[32,.07]]){const p=perlin(cells);for(let i=0;i<n;i++)foam[i]+=amp*p[i];}
 let lo=Infinity,hi=-Infinity;for(const v of foam){lo=Math.min(lo,v);hi=Math.max(hi,v);}
 // Caustics after the tileable water caustic by Dave Hoskins.
 const caustic=new Float32Array(n);let clo=Infinity,chi=-Infinity;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const px=x/size*TAU-250,py=y/size*TAU-250;let ix=px,iy=py,c=1;
  for(let k=0;k<5;k++){const t=.37*(1-3.5/(k+1)),nx=px+Math.cos(t-ix)+Math.sin(t+iy),ny=py+Math.sin(t-iy)+Math.cos(t+ix);ix=nx;iy=ny;c+=1/Math.hypot(px/(Math.sin(ix+t)/.005),py/(Math.cos(iy+t)/.005));}
  c=1.17-Math.pow(c/5,1.4);const v=Math.pow(Math.abs(c),8);caustic[y*size+x]=v;clo=Math.min(clo,v);chi=Math.max(chi,v);}
 for(let i=0;i<n;i++){data[i*4]=Math.round(127.5+127*gx[i]/peak);data[i*4+1]=Math.round(127.5+127*gy[i]/peak);data[i*4+2]=Math.round(255*(foam[i]-lo)/(hi-lo||1));data[i*4+3]=Math.round(255*Math.min(1,(caustic[i]-clo)/(chi-clo||1)*1.4));}
 return{size,data};
}
// Collision and craft surfaces use short straight corridors, as before.
function corridors(streams,limit=160,near={x:0,z:0}){
 const rows=[];
 for(const stream of streams){const w=width(stream.kind,stream.intermittent),line=stream.line;
  for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i];if(!a||!b)continue;const length=Math.hypot(b.x-a.x,b.z-a.z);if(length<1)continue;
   rows.push({x:(a.x+b.x)/2,z:(a.z+b.z)/2,ux:(b.x-a.x)/length,uz:(b.z-a.z)/length,width:w,start:length/2,end:length/2+w*.5,kind:'river',stream:true});}}
 return rows.sort((a,b)=>Math.hypot(a.x-near.x,a.z-near.z)-Math.hypot(b.x-near.x,b.z-near.z)).slice(0,limit);
}
return{STEP,WIDTH,width,speed,resample,profile,falls,prepare,at,curtain,build,nearest,listen,texture,corridors};
});
