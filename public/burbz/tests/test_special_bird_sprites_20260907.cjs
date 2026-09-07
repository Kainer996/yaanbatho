const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),core=require('../special_bird_sprites.js'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const fn=name=>{const at=html.indexOf('function '+name+'(');assert(at>=0,name);return html.slice(at,html.indexOf('\n}',at)+2)};
const scope={};vm.createContext(scope);vm.runInContext(['specialBirdCharacterFor','applySpecialBirdCharacter','easterEggBirdName','applyEasterEggBirdName'].map(fn).join('\n'),scope);
for(const [species,key,name] of [['Rook','rook-witch','The Rook Witch'],['Carrion Crow','brandon-lee','Brandon Lee'],['Herring Gull','steven-herring-gull','Steven'],['European Herring Gull','steven-herring-gull','Steven'],['Peregrine Falcon','peregrine-falcon',undefined]]){
 assert.equal(core.keyFor({species}),key);const bird=scope.applySpecialBirdCharacter({species,level:7,xp:18,customField:{keep:true},specialMove:'Existing move'});assert.equal(bird.customName,name);assert.equal(bird.level,7);assert.equal(bird.xp,18);assert(bird.customField.keep);
 if(key==='brandon-lee'||key==='peregrine-falcon')assert.equal(bird.specialMove,'Existing move');
 const custom=scope.applySpecialBirdCharacter({species,customName:'Player name'});assert.equal(custom.customName,'Player name');
 assert.equal(core.frameAt(key,0),0);const length=core.SHEETS[key].durations.reduce((a,b)=>a+b,0);assert(length>=1000&&length<2000);assert.equal(core.frameAt(key,length-1),7);assert.equal(core.frameAt(key,length),-1);
}
for(const species of ['American Crow','Hooded Crow','Common Gull','American Herring Gull','Lesser Black-backed Gull','Merlin','Australian Magpie']){assert.equal(core.keyFor({species}),null);assert.equal(scope.easterEggBirdName({species}),null)}
assert.equal(core.keyFor({scientificName:'Corvus corone'}),'brandon-lee');assert.equal(core.keyFor({scientificName:'Falco peregrinus'}),'peregrine-falcon');
const updater=fs.readFileSync(path.resolve(root,'../../scripts/update-live-burbz.sh'),'utf8');
for(const def of Object.values(core.SHEETS))for(const file of [def.file,def.scene].filter(Boolean)){const bytes=fs.readFileSync(path.join(root,'assets/special-birds',file));assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');assert(bytes.length>1000&&bytes.length<250000);assert(updater.includes('"assets/special-birds/'+file+'"'));}
for(const file of ['special_bird_sprites.js','special_bird_sprites.css']){assert(updater.includes('"'+file+'"'));assert.equal(fs.readFileSync(path.join(root,'sw.js'),'utf8').split("'./"+file+'?v=special-card-sprites-20260907\'').length-1,3)}
assert(!fn('createLockedBirdexCardHTML').includes('specialBirdAnimationButtonHTML'));
console.log('Special sprite identities, default-only migration, complete timelines, narrow species aliases, asset bytes and delivery registration pass.');
