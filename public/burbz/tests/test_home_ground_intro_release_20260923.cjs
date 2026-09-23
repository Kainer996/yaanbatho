'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const build='home-ground-intro-v451-20260923',modules=['player_home.css','player_home_core.js','player_home_scene.js','player_home.js','alderwing_intro.js','village_world_core.js','village_world.js','village_walk.js','merlin_story_scenes.js','merlin_story_scenes.css'];
const html=read('index.html'),sw=read('sw.js'),walk=read('village_walk.js'),home=read('player_home.js'),updater=fs.readFileSync(path.join(repo,'scripts/update-live-burbz.sh'),'utf8');
const old=n=>cp.execFileSync('git',['-C',repo,'show','HEAD:public/burbz/'+n],{encoding:'utf8',maxBuffer:20*1024*1024});
assert(html.includes("const BURBZ_BUILD = '"+build+"';"));
const cache=s=>s.match(/const BURBZ_CACHE = '([^']+)'/)[1];assert.equal(cache(sw),cache(old('sw.js'))+'-'+build);
const self={location:new URL('https://example.test/burbz/sw.js'),addEventListener(){}};
for(const key of ['BURBZ_UK_BIRD_EXPANSION_50','BURBZ_UK_BIRD_EXPANSION_26','BURBZ_AU_BIRD_EXPANSION','BURBZ_UK_BIRD_EXPANSION_FINAL','BURBZ_AU_BIRD_EXPANSION_50'])self[key]={art:{}};
const ctx=vm.createContext({self,URL,importScripts(){},console});vm.runInContext(sw,ctx);
const lists=vm.runInContext('({BURBZ_ASSETS,BURBZ_CORE,BURBZ_INSTALL_REQUIRED})',ctx);
for(const [name,urls]of Object.entries(lists)){
 for(const file of modules)assert.equal(urls.filter(u=>u==='./'+file+'?v='+build).length,1,name+': '+file);
 for(const file of ['assets/dashboard-banners/your-empire.webp','assets/dashboard-banners/open-camera.webp','assets/special-birds/rook-witch-scene.webp','assets/walking-quests/warden.webp','assets/walking-quests/wayfarer-rest.webp','assets/home-v395/living-field-desk.webp'])assert(urls.includes('./'+file),name+': exact illustration URL '+file);
}
for(const file of modules)assert(updater.includes('"'+file+'"'),file+' updater');
for(const file of modules.filter(f=>!f.startsWith('village_world'))){assert(html.includes(file+'?v='+build),'consumer '+file);}
for(const file of ['village_world_core.js','village_world.js'])assert(walk.includes("'"+file+"':'"+build+"'"));
// All existing unchanged consuming URL identities remain untouched.
function pins(s){return [...s.matchAll(/([\w./-]+\.(?:js|css))\?v=([\w-]+)/g)].filter(m=>!modules.includes(m[1].replace(/^\.\//,''))).map(m=>m[0]).sort();}
assert.deepEqual(pins(html),pins(old('index.html')));
for(const file of fs.readdirSync(root).filter(n=>/\.(js|html)$/.test(n))){
 const s=read(file);for(const mod of modules){const escaped=mod.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');for(const m of s.matchAll(new RegExp(escaped+'\\?v=([\\w-]+)','g')))assert.equal(m[1],build,file+': stale '+mod);}
}
const helper=s=>s.slice(s.indexOf('const BURBZ_HOME_DEPENDENCY_URLS'),s.indexOf("self.addEventListener('fetch'"));assert.equal(helper(sw),helper(old('sw.js')));
const loader=s=>s.split('\n').find(l=>l.startsWith('function load()'));assert.equal(loader(home),loader(old('player_home.js')));
assert(home.includes("['village_walk_core.js','BurbzVillageWalkCore','alderwing-followups-v417-20260914']"));
const stripChangedWorldPins=s=>s.replace(/('village_world(?:_core)?\.js':')[^']+/g,'$1PIN');assert.equal(stripChangedWorldPins(walk),stripChangedWorldPins(old('village_walk.js')));
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!/\bsrc\s*=|\btype\s*=/.test(match[1])&&match[2].trim())new Function(match[2]);}
console.log('PASS v451 global marker; ten exact changed-module pins; three worker manifests; six exact story-art keys; updater; unchanged consumers/Home cache helper/lazy tuple; pin-only walking diff; inline scripts');
