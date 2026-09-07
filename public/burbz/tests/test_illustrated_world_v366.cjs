const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function fn(name){const start=html.indexOf('function '+name+'(');assert(start>=0,name);return html.slice(start,html.indexOf('\n}',start)+2);}
const ctx=vm.createContext({console,URL,canonicalSpeciesName:x=>x,normaliseSpeciesKey:x=>x.toLowerCase().replace(/[^a-z]/g,'')});
vm.runInContext("let birdEducationCache = {};\n"+['escapeHTML','getEducationKey','getCachedBirdEducation','renderInfoBlock','renderEducationSections'].map(fn).join('\n'),ctx);
const run=s=>vm.runInContext(s,ctx);
run(`birdEducationCache={'Peregrine Falcon':{name:'Peregrine Falcon',diet:'old'},'Peregrine':{name:'Peregrine',scientificName:'Falco peregrinus',verifiedPrimary:true,diet:'checked'}}`);
assert.equal(run("getCachedBirdEducation({species:'Peregrine Falcon',scientificName:'Falco peregrinus'}).diet"),'checked','Scientific identity prefers checked facts over a legacy alias');
assert.equal(run("getCachedBirdEducation({species:'Peregrine Falcon'}).diet"),'checked','Name-only legacy Peregrine reaches the checked canonical profile');
run("birdEducationCache['Woodpigeon']={name:'Woodpigeon',verifiedPrimary:true,diet:'checked pigeon'};birdEducationCache.Robin={name:'Robin',verifiedPrimary:true,diet:'checked robin'}");
assert.equal(run("getCachedBirdEducation({species:'Wood Pigeon'}).diet"),'checked pigeon');
assert.equal(run("getCachedBirdEducation({species:'European Robin'}).diet"),'checked robin');
const safe=run(`renderEducationSections({species:'Test'},{verifiedPrimary:true,identification:'A <bright> bird',diet:'Small insects',sources:[{label:'BTO',url:'https://www.bto.org/example'}]})`);
assert(safe.includes('A &lt;bright&gt; bird'));assert(safe.includes('Diet in the wild'));assert(!safe.includes('Breeding</'));assert(safe.includes('noopener noreferrer'));
const empty=run(`renderEducationSections({species:'Test'},{identification:'Field-guide details are being checked.',sources:[{label:'Old notes',url:'https://example.org/notes'}]})`);
assert(!empty.includes('Field-guide details are being checked'));assert(empty.includes('not available here yet'));assert(!empty.includes('Loading'));
const unsafe=run(`renderEducationSections({species:'Test'},{identification:'Unverified prose',sources:[{url:'javascript:alert(1)'}]})`);assert(!unsafe.includes('javascript:'));assert(!unsafe.includes('Unverified prose'));
const sparrow=JSON.parse(fs.readFileSync(path.join(root,'data/bird-education.json')))['House Sparrow'];
ctx.sparrow=sparrow;
const sparrowHTML=run("renderEducationSections({species:'House Sparrow'},sparrow)");
assert(sparrowHTML.includes('Passer domesticus'));assert(sparrowHTML.includes('Wikipedia overview'));assert(sparrowHTML.includes('Longer source account'));assert(sparrowHTML.includes('CC BY-SA 4.0'));assert(!sparrowHTML.includes('Start with size'));assert(!sparrowHTML.includes('Use feeding clues'));assert(!sparrowHTML.includes('For learning, notice'));
const national=JSON.parse(fs.readFileSync(path.join(root,'data/national-bird-completion/education.json')))["Abbott's Booby"];
ctx.national=national;
const nationalHTML=run("renderEducationSections({species:\"Abbott's Booby\"},national)");
assert(nationalHTML.includes('Papasula abbotti'));assert(!nationalHTML.includes('Game stats'));assert(!nationalHTML.includes('centroid'));assert(!nationalHTML.includes('Broad omnivorous'));assert(!nationalHTML.includes('source checklist status'));
run("birdEducationCache={Alternate:{title:'Alternate',scientificName:'Passer domesticus',summary:'scientific identity'}}");
assert.equal(run("getCachedBirdEducation({species:'House Sparrow',scientificName:'Passer domesticus'}).summary"),'scientific identity','Legacy facts can match an exact binomial without changing gameplay identity');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/bird-facts-v366.json')));assert(data.species.length>=20);assert.equal(new Set(data.species.map(x=>x.scientificName)).size,data.species.length);
const enrichment=JSON.parse(fs.readFileSync(path.join(root,'data/bird-education-enrichment-v366.json')));
for(const name of ['Capercaillie','Fork-tailed Swift']){
 ctx.account=enrichment[name];const rendered=run("renderEducationSections({species:'Test'},account)");
 assert(rendered.includes('Wikipedia overview'));assert(rendered.includes('Longer source account'));assert(!rendered.includes('not available here yet'));
}
for(const row of data.species){assert(row.name&&row.scientificName&&row.identification);assert(row.sources.length);for(const source of row.sources){const u=new URL(source.url);assert.equal(u.protocol,'https:');assert(/(^|\.)(rspb\.org\.uk|bto\.org|allaboutbirds\.org)$/.test(u.hostname));}}
vm.runInContext(fn('globalMoneyHudMutationNeedsSync'),ctx);
assert.equal(run("globalMoneyHudMutationNeedsSync({target:{closest:()=>({})}})"),false,'Clipped map transformations do not force HUD layout');
assert.equal(run("globalMoneyHudMutationNeedsSync({target:{closest:()=>null}})"),true,'Overlay and header mutations still update the fallback coin HUD');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),updater=fs.readFileSync(path.join(root,'../../scripts/update-live-burbz.sh'),'utf8');
for(const file of ['illustrated_world.css?v=illustrated-world-v366-20260907','data/bird-facts-v366.json?v=illustrated-world-v366-20260907','data/bird-education-enrichment-v366.json?v=illustrated-world-v366-20260907','assets/illustrated-world-v366/card-folio.webp','assets/illustrated-world-v366/settlements.webp',...['village_walk.js','village_walk_core.js','village_walk_scene.js','village_walk.css'].map(f=>f+'?v=village-walk-v1-20260907'),...['geographic_forest_core.js','geographic_forest_worker.js','geographic_camera_core.js','geographic_marker_layer.js','geographic_map_3d.js','geographic_map_3d.css'].map(f=>f+'?v=geographic-terrain-v1-20260907'),'data/geographic-terrain-credits.html']){
 assert.equal(sw.split("'./"+file+"'").length-1,3,file+' in all offline sets');assert(updater.includes('"'+file.split('?')[0]+'"'));assert(fs.statSync(path.join(root,file.split('?')[0])).size>0);
}
console.log('Illustrated world: sourced identity lookup, escaped facts, honest missing data, source validation and atomic offline dependencies passed.');
