'use strict';
// A Galaxy Fold opens to a near-square screen. Its view stays wider than tall
// whichever way it is held, so the portrait lesson waited for ever.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const source=process.env.TOUR_SOURCE?fs.readFileSync(process.env.TOUR_SOURCE,'utf8'):read('alderwing_intro.js');
const build='fold-fullscreen-v489-20260925';
function fixture(initial,kind,screen,view){
 let saved=initial,done=0;const events={},timers=[];
 class Node{constructor(){this.isConnected=true;this.children={};this.dataset={};this.textContent='';this.hidden=false;}setAttribute(){}append(n){n.parentElement=this;this.child=n;n.isConnected=true;}remove(){this.isConnected=false;if(this.parentElement?.child===this)this.parentElement.child=null;}set innerHTML(x){for(const k of ['p','small','button','.ai-turn-demo'])this.children[k]=new Node();}querySelector(k){return this.children[k]||null;}addEventListener(e,fn){this[e]=fn;}}
 const host=new Node(),body=new Node(),context={console,Map,Set,Object,Math,Number,screen:{width:screen[0],height:screen[1]},innerWidth:view[0],innerHeight:view[1],matchMedia:()=>({matches:true}),document:{hidden:false,body,createElement:()=>new Node(),addEventListener:(e,f)=>events[e]=f},addEventListener:(e,f)=>events[e]=f,clearTimeout(){},setTimeout:f=>timers.push(f),BurbzLookSettings:{isOpen:()=>false}};
 vm.createContext(context);vm.runInContext(source,context);const a=context.BurbzAlderwingIntro;
 a.bind({read:()=>saved,commit:p=>{saved=p;return true;},done:()=>done++});
 if(kind==='desk')a.desk(false);else a.outside(host);
 const box=()=>host.child||body.child;
 return{get phase(){return saved;},get done(){return done;},get button(){return box().querySelector('button');},text:k=>box().querySelector(k).textContent,next(){box().querySelector('button').click();},resize(w,h){context.innerWidth=w;context.innerHeight=h;events.resize();while(timers.length)timers.shift()();}};
}
// Galaxy Z Fold 5 inner screen in CSS pixels; Chrome's tab strip leaves a wide view.
const foldBook=[[690,829],[690,560]],foldTurned=[[829,690],[829,420]];
test('RED repro: an open Fold held upright can finish the portrait lesson',()=>{
 const f=fixture('portrait','desk',...foldBook);
 assert.equal(f.button.disabled,false);assert.equal(f.button.textContent,'Continue tutorial');
 assert.match(f.text('p'),/either way up/);assert.doesNotMatch(f.text('small'),/Rotate|Already in/);
 f.next();assert.equal(f.phase,'done');assert.equal(f.done,1);
});
test('an open Fold turned sideways can finish the portrait lesson too',()=>{
 const f=fixture('portrait','desk',...foldTurned);assert.equal(f.button.disabled,false);f.next();assert.equal(f.phase,'done');
});
test('an open Fold whose view is taller than wide still enters the world',()=>{
 const f=fixture('landscape','world',[690,829],[690,700]);
 assert.equal(f.button.disabled,false);assert.match(f.text('p'),/already wide/);f.next();assert.equal(f.phase,'world');
});
test('an ordinary phone is asked to tilt back, and tilting still carries on by itself',()=>{
 const f=fixture('portrait','desk',[390,844],[844,390]);
 assert.equal(f.button.disabled,false);assert.match(f.text('p'),/Tilt your phone again/);assert.match(f.text('small'),/Turn your phone upright, or tap Continue tutorial/);
 f.resize(390,844);assert.equal(f.phase,'done');
});
test('the portrait lesson never locks anyone in, whatever the phone reports',()=>{
 for(const screen of [[390,844],[344,882],[820,1180],[0,0]]){const f=fixture('portrait','desk',screen,[900,420]);assert.equal(f.button.disabled,false,String(screen));f.next();assert.equal(f.phase,'done',String(screen));}
});
test('a folded Fold and a small tablet still tilt into the landscape world',()=>{
 for(const screen of [[344,882],[820,1180]]){const f=fixture('landscape','world',screen,screen);assert.equal(f.button.disabled,true,String(screen));f.next();assert.equal(f.phase,'landscape');f.resize(screen[1],screen[0]);assert.equal(f.phase,'world',String(screen));}
});
test('fold-fullscreen v489 ships the intro under one new pin',()=>{
 const html=read('index.html'),sw=read('sw.js');
 // Later releases ship on top under their own marker; v489 stays in the cache chain.
 const LATER=['academy-garden-birds-v490-20260925','home-hub-v491-20260925','asmr-sound-v492-20260925','quest-lines-v493-20260926'];
 assert([build,...LATER].some(b=>html.includes("const BURBZ_BUILD = '"+b+"';")));
 assert(html.includes('<script src="alderwing_intro.js?v='+build+'"></script>'));
 assert.equal([...sw.matchAll(/alderwing_intro\.js\?v=([\w-]+)/g)].filter(m=>m[1]===build).length,3);
 assert.doesNotMatch(html+sw,/alderwing_intro\.js\?v=(?!fold-fullscreen-v489)/);
 assert(sw.match(/const BURBZ_CACHE = '([^']+)'/)[1].includes('-'+build));
});
test('full screen sits in the top bar and in Settings, and hides once on',()=>{
 const html=read('index.html');
 const header=html.slice(html.indexOf('<header class="header'),html.indexOf('</header>'));
 assert(header.indexOf('id="headerFullscreenBtn"')>=0&&header.indexOf('id="headerFullscreenBtn"')<header.indexOf('id="settingsBtn"'));
 assert.match(header,/id="headerFullscreenBtn"[^>]*hidden/);
 assert.match(html,/id="fullScreenRow" hidden/);assert.match(html,/role="switch"[^>]*id="toggleFullScreen"/);
 const sync=html.slice(html.indexOf('function syncBurbzFullscreen'),html.indexOf('function toggleBurbzFullscreen'));
 assert.match(sync,/headerFullscreenBtn'\)\.hidden=!can\|\|on\|\|burbzInstalledApp\(\)/);
 assert.match(html,/addEventListener\('fullscreenchange',syncBurbzFullscreen\)/);
});
