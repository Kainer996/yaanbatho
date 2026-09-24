/* Streams and waterfalls from real mapped watercourses and real elevation.
 * Pure geometry: no rendering, persistence or game state. Mapped lines run
 * downstream, so distance along a line is the direction of flow. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzWorldWaterCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const STEP=2,WIDTH={river:5,canal:4,stream:2.2,drain:1.3,ditch:1.1};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function width(kind,intermittent){return(WIDTH[kind]||WIDTH.stream)*(intermittent?.7:1);}
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
function prepare(line,kind,intermittent,height){
 const w=width(kind,intermittent),samples=profile(resample(line),height),drops=samples.length>1?falls(samples,w):[],lift=new Float32Array(samples.length);
 for(const f of drops)for(let i=f.from;i<f.to;i++)lift[i]=clamp(.3+f.drop*.05,.3,.8);
 const x0=Math.min(...samples.map(p=>p.x)),x1=Math.max(...samples.map(p=>p.x)),z0=Math.min(...samples.map(p=>p.z)),z1=Math.max(...samples.map(p=>p.z));
 return{samples,falls:drops,lift,width:w,bounds:{x0,x1,z0,z1}};
}
// One chunk's share of every stream: pieces whose middle lies in the chunk,
// so neighbouring chunks meet exactly with no overlap. Vertex heights come
// from the chunk's own ground. Flow attributes are [distance along, side
// -1..1, steepness]; plunge pools use the side for their radius.
function build(cell,size,prepared,height){
 const positions=[],flow=[],indices=[],mist=[],gully=[],banks=[];
 const inCell=(x,z)=>x>=cell.x&&x<cell.x+size&&z>=cell.z&&z<cell.z+size;
 for(const stream of prepared){
  const {samples,lift,width:w}=stream,b=stream.bounds;if(samples.length<2||b.x1<cell.x-w||b.x0>cell.x+size+w||b.z1<cell.z-w||b.z0>cell.z+size+w)continue;
  // Falling water fans out wider than the stream above it.
  const vertex=(p,i,side)=>{const half=w/2*clamp(p.s/3,.35,1)*(lift[i]>0?1.6:1+p.steep*.25),x=p.x-p.uz*side*half,z=p.z+p.ux*side*half,y=height(x,z);return Number.isFinite(y)?[x,y+.08+lift[i],z]:null;};
  // Steep water cuts a dark, wet rock gully lined with boulders.
  for(let i=0;i<samples.length;i++){const p=samples[i],rough=lift[i]>0?1:p.steep;if(rough<.45||p.x<cell.x-8||p.x>cell.x+size+8||p.z<cell.z-8||p.z>cell.z+size+8)continue;gully.push({x:p.x,z:p.z,r:w*(lift[i]>0?1.5:1.1)+1.6,t:rough});
   if(i%2===0&&inCell(p.x,p.z))for(const side of [-1,1]){const d=w*(lift[i]>0?.95:.75)+.7+(i%3)*.25,x=p.x-p.uz*side*d,z=p.z+p.ux*side*d,y=height(x,z);if(Number.isFinite(y))banks.push({x,z,y,size:.45+rough*.45+((i*7)%5)*.08,angle:i*1.7+side});}}
  for(let i=1;i<samples.length;i++){const a=samples[i-1],c=samples[i];if(!inCell((a.x+c.x)/2,(a.z+c.z)/2))continue;
   const quad=[vertex(a,i-1,-1),vertex(a,i-1,1),vertex(c,i,-1),vertex(c,i,1)];if(quad.some(v=>!v))continue;
   const base=positions.length/3;for(const [k,v] of quad.entries()){const j=k<2?i-1:i,p=samples[j];positions.push(v[0]-cell.x,v[1],v[2]-cell.z);flow.push(p.s,k%2?1:-1,lift[j]>0?1:p.steep);}
   indices.push(base,base+1,base+2,base+1,base+3,base+2);}
  // A plunge pool and rising spray at the foot of each fall.
  for(const f of stream.falls){if(!inCell(f.foot.x,f.foot.z))continue;const y=height(f.foot.x,f.foot.z);if(!Number.isFinite(y))continue;const r=w*1.7,base=positions.length/3;
   positions.push(f.foot.x-cell.x,y+.07,f.foot.z-cell.z);flow.push(f.foot.s,0,.45);
   for(let j=0;j<=10;j++){const a=j/10*Math.PI*2,x=f.foot.x+Math.cos(a)*r,z=f.foot.z+Math.sin(a)*r,h=height(x,z);positions.push(x-cell.x,Math.max(y,Number.isFinite(h)?h:y)+.07,z-cell.z);flow.push(f.foot.s+j*.6,1,.18);}
   for(let j=0;j<10;j++)indices.push(base,base+2+j,base+1+j);
   for(let j=0;j<3;j++)mist.push({x:f.foot.x+(j-1)*w*.35,y:y+.4+j*.4,z:f.foot.z+(j%2?.3:-.3),size:1.1+Math.min(f.drop,40)*.07+j*.3,phase:j*2.1+f.foot.s*.1});}
 }
 return{positions,flow,indices,mist,gully,banks};
}
// Collision and craft surfaces use short straight corridors, as before.
function corridors(streams,limit=160,near={x:0,z:0}){
 const rows=[];
 for(const stream of streams){const w=width(stream.kind,stream.intermittent),line=stream.line;
  for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i];if(!a||!b)continue;const length=Math.hypot(b.x-a.x,b.z-a.z);if(length<1)continue;
   rows.push({x:(a.x+b.x)/2,z:(a.z+b.z)/2,ux:(b.x-a.x)/length,uz:(b.z-a.z)/length,width:w,start:length/2,end:length/2+w*.5,kind:'river',stream:true});}}
 return rows.sort((a,b)=>Math.hypot(a.x-near.x,a.z-near.z)-Math.hypot(b.x-near.x,b.z-near.z)).slice(0,limit);
}
return{STEP,WIDTH,width,resample,profile,falls,prepare,build,corridors};
});
