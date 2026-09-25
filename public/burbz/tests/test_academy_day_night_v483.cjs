const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
// Academy day and night (v483): both Academy trees keep the game's clock.
// The day painting fades out as the sun sets over a moonlit copy of the tree
// and a live night sky; every house fades to a lit-up night picture, and warm
// lamplight pools on the bark. Night art loads only from dusk.
const D=require('../daylight_core.js'),N=require('../academy_daynight.js');
const alive=require('../academy_alive_core.js'),a3d=require('../academy_3d_core.js');
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
const root=path.join(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const HOURS=[0,3,4.9,5,5.5,6,6.5,7,12,16.9,17,17.5,18,18.5,19,19.5,20,21,23.5];
// Width and height from a WebP header (VP8, VP8L or VP8X).
function webpSize(file){
 const b=fs.readFileSync(path.join(root,file));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
 const kind=b.toString('ascii',12,16);
 if(kind==='VP8X')return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)];
 if(kind==='VP8L'){const n=b.readUInt32LE(21);return [1+(n&0x3fff),1+((n>>14)&0x3fff)];}
 if(kind==='VP8 ')return [b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff];
 throw Error('unknown WebP chunk '+kind);
}
const HOUSES=['nursery','observatory','workshop','library','manager_office','crowbar','hospital','kitchen','training','magpie_market','quest_roost','tavern'];
const NIGHT='assets/academy-night-20260925/';

test('lamps light through dusk, burn all night and go out through the dawn',()=>{
 assert.equal(fs.readFileSync(path.join(root,'daylight_core.js'),'utf8').includes('lampFactorForHour'),false,'the shared clock file is untouched');
 assert.equal(N.lampFactorForHour(12),0);assert.equal(N.lampFactorForHour(0),1);assert.equal(N.lampFactorForHour(20),1);
 assert(N.lampFactorForHour(17.5)>0&&N.lampFactorForHour(17.5)<N.lampFactorForHour(18.5)&&N.lampFactorForHour(18.5)<1,'lamps ramp up at dusk');
 assert(N.lampFactorForHour(5.5)<1&&N.lampFactorForHour(6.5)<N.lampFactorForHour(5.5)&&N.lampFactorForHour(7)===0,'lamps go out at dawn');
 for(const h of HOURS){assert.equal(N.isNightHour(h),D.phaseForHour(h)==='night',h+'h');const l=N.lampFactorForHour(h);assert(l>=0&&l<=1);if(N.isNightHour(h))assert(l>.7,'lamps are well lit all night at '+h+'h');}
});
test('both Academy engines keep the game clock, and agree with each other',()=>{
 for(const h of HOURS){
  assert.equal(alive.isNightHour(h),N.isNightHour(h),'2D night at '+h);assert.equal(a3d.isNightHour(h),N.isNightHour(h),'3D night at '+h);
  assert.equal(alive.lightBoostFor(h),N.lampFactorForHour(h),'2D lamps at '+h);assert.equal(a3d.lightBoostFor(h),N.lampFactorForHour(h),'3D lamps at '+h);
 }
});
test('the grade follows the sun: day, golden dusk, moonlit night, pink dawn',()=>{
 const noon=N.gradeForHour(12),dusk=N.gradeForHour(18),night=N.gradeForHour(23.5),dawn=N.gradeForHour(6);
 assert.deepEqual([noon.phase,noon.sun,noon.night,noon.lamps,noon.warm,noon.stars],['day',1,0,0,0,0]);
 assert.equal(dusk.phase,'dusk');assert(dusk.warm>.9&&dusk.night>.4&&dusk.night<.6,'dusk is golden and half dark');
 assert.deepEqual([night.phase,night.sun,night.night,night.lamps,night.stars],['night',0,1,1,1]);
 assert.equal(dawn.phase,'dawn');assert(dawn.warm>.9);
 for(const h of HOURS){const g=N.gradeForHour(h);for(const k of ['sun','night','warm','lamps','stars'])assert(g[k]>=0&&g[k]<=1,k+' at '+h);assert.equal(g.sky.length,3);assert(g.sky.every(c=>/^rgb\(\d+,\d+,\d+\)$/.test(c)));}
 assert.notDeepEqual(noon.sky,night.sky);assert.notDeepEqual(dusk.sky,night.sky);
});
test('evidence scripts can pin the clock; players get their local hour',()=>{
 const date=new Date(2026,8,25,21,30);assert.equal(N.localHour(date),21.5);
 globalThis.__academyAliveForceHour=3;assert.equal(N.localHour(date),3);
 globalThis.__burbzForceHour=18;assert.equal(N.localHour(date),18,'the game-wide hook wins');
 delete globalThis.__burbzForceHour;delete globalThis.__academyAliveForceHour;assert.equal(N.localHour(date),21.5);
});
test('the star field is fixed, bounded and thins toward the horizon',()=>{
 const a=N.starField(390,680,1789),b=N.starField(390,680,1789);assert.deepEqual(a,b);
 assert(a.length>100&&a.length<=420);assert(a.every(s=>s.x>=0&&s.x<=390&&s.y>=0&&s.y<=680*.82));
 const high=a.filter(s=>s.y<680*.3).length,low=a.filter(s=>s.y>680*.55).length;assert(high>low*2,'denser at the top');
 assert(a.some(s=>s.twinkle)&&a.some(s=>!s.twinkle));
});
test('every night picture exists and lines up with its day picture',()=>{
 const pairs=[['academy-manga-20260925/tree.webp','manga/tree.webp'],['academy-manga-20260925/tree-wide.webp','manga/tree-wide.webp'],
  ['academy-living-tree-20260925/tree.webp','home/tree.webp'],['academy-living-tree-20260925/tree-wide.webp','home/tree-wide.webp'],
  ...'abcd'.split('').map(b=>['academy-manga-20260925/bough-'+b+'.webp','manga/bough-'+b+'.webp']),
  ...HOUSES.flatMap(id=>[['academy-manga-20260925/'+id+'.webp','manga/'+id+'.webp'],['academy-living-tree-20260925/'+id+'.webp','home/'+id+'.webp']])];
 for(const [day,night] of pairs)assert.deepEqual(webpSize(NIGHT+night),webpSize('assets/'+day),night+' matches its day picture');
 assert(fs.existsSync(path.join(root,NIGHT,'source/bake_night.py')),'the bake script ships with the art');
});
test('the Academy screen: sky and moonlit tree wait under the fading day painting',()=>{
 const html=read('index.html'),start=html.indexOf('id="academyTreehouse"'),seg=html.slice(start,html.indexOf('academy-stage-3d',start));
 const sky=seg.indexOf('class="academy-night-sky" data-dn-sky'),night=seg.indexOf('class="academy-tree-night"'),day=seg.indexOf('class="academy-tree-swaybg"');
 assert(sky>0&&night>sky&&day>night,'sky, then night tree, then day painting');
 assert(seg.indexOf('id="academyNightPools"')>seg.indexOf('academy-branches-back')&&seg.indexOf('id="academyNightPools"')<seg.indexOf('id="academyTreeSway"'),'pools sit on the bark, under the houses');
 assert(seg.indexOf('class="academy-dusk"')>seg.indexOf('academy-branches-front'),'the golden-hour wash covers the whole scene');
 assert.equal((seg.match(/class="ab-night" data-night-src="assets\/academy-night-20260925\/manga\/bough-[a-d]\.webp"/g)||[]).length,6,'every bough has a night copy');
 assert(!/ab-night" src=/.test(seg),'night boughs never load by day');
 const sway='animation:treeSway 13s ease-in-out infinite alternate';
 for(const cls of ['.academy-tree-night','.academy-night-pools']){const rule=html.match(new RegExp('\\'+cls+' \\{([^}]*)\\}'));assert(rule&&rule[1].includes(sway),cls+' rides the same sway as the painting');}
 assert(/\.academy-tree-swaybg \{[^}]*opacity:var\(--dn-sun,1\)/.test(html),'the day painting fades with the sun');
 assert(/\.academy-treehouse\.dn-awake \.academy-tree-night \{ background-image:url\('assets\/academy-night-20260925\/manga\/tree\.webp'\)/.test(html),'night tree only from dusk');
 assert(/\.academy-treehouse\.dn-awake \.academy-tree-night \{ background-image:url\('assets\/academy-night-20260925\/manga\/tree-wide\.webp'\); background-position:center 72%/.test(html),'wide boxes get the wide night tree');
 assert(html.includes("treehouse-building-sprite treehouse-building-night\" data-night-src=\"' + escapeHtml(night)"),'houses carry a night picture, loaded only after dark');
 assert(html.includes("'<i class=\"academy-night-pool\" style=\"left:' + pos.x + '%;top:' + pos.y + '%\"></i>'"),'one pool per built house, at its spot');
 assert(/BurbzAcademyDayNight\.attach\(\$\('academyTreehouse'\)\); BurbzAcademyDayNight\.attach\(\$\('desk-academy-list'\)\)/.test(html),'both scenes keep the clock from start-up');
});
test('the Academy maps every manga house to its night picture',()=>{
 const html=read('index.html'),fn=html.match(/function academyNightAsset\(asset\) \{[\s\S]*?\n\}/)[0];
 const academyNightAsset=new Function(fn+';return academyNightAsset;')();
 for(const id of HOUSES){const night=academyNightAsset('assets/academy-manga-20260925/'+id+'.webp');assert.equal(night,NIGHT+'manga/'+id+'.webp');assert(fs.existsSync(path.join(root,night)));}
 for(const other of ['assets/academy-manga-20260925/aviary-gardens.webp','assets/academy-manga-20260925/tree.webp','assets/academy-buildings/roost.svg','',undefined])assert.equal(academyNightAsset(other),'');
});
test('Home: the living tree gets the same sky, night art, pools and lit houses',()=>{
 const js=read('scan_home.js'),css=read('scan_home.css');
 assert(js.includes("const NIGHT_ART='assets/academy-night-20260925/home/';"));
 const tree=js.slice(js.indexOf('function academyTree'),js.indexOf('function applyProgression'));
 const sky=tree.indexOf('class="home-tree-sky" data-dn-sky'),night=tree.indexOf('class="home-tree-night"'),art=tree.indexOf('class="home-tree-art"'),pools=tree.indexOf('class="home-tree-pools"'),houses=tree.indexOf('${houses}');
 assert(sky>0&&night>sky&&art>night&&pools>art&&houses>pools,'sky, night tree, day tree, pools, then houses');
 assert(tree.includes('<img class="home-tree-house-night" data-night-src="${NIGHT_ART}${escape(r.id)}.webp"'),'lit houses load only after dark');
 assert(/#screen-scan \.home-tree-art \{[^}]*opacity:var\(--dn-sun,1\)/.test(css));
 assert(css.includes('#screen-scan .dn-awake .home-tree-stage { --tree-night:url("assets/academy-night-20260925/home/tree.webp"); }'));
 assert(css.includes('#screen-scan .dn-awake .home-tree-stage { --tree-night:url("assets/academy-night-20260925/home/tree-wide.webp"); }'));
 assert(/#screen-scan \.home-tree-bough::after \{ opacity:var\(--dn-sun,1\); \}/.test(css),'swaying boughs fade to their night copy too');
 assert(/#screen-scan \.home-tree-pools \{[^}]*mix-blend-mode:screen;opacity:var\(--dn-lamps,0\)/.test(css));
});
test('the night sky respects reduced motion',()=>{
 const css=read('academy_daynight.css');
 assert(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.dn-twinkle \{ animation:none;[\s\S]*\.dn-shooting-star \{ animation:none; display:none; \}/.test(css));
 assert(/\.academy-tree-night, \.academy-night-pools \{ animation:none; \}/.test(read('index.html')));
});
test('v483 ships together: build marker, cache, three worker lists, updater and night art',()=>{
 const BUILD='academy-day-night-v483-20260925',html=read('index.html'),sw=read('sw.js'),updater=fs.readFileSync(path.join(root,'../../scripts/update-live-burbz.sh'),'utf8');
 // Later releases ship on top under their own marker; v483 stays in the cache chain.
 const LATER=['desk-screen-v484-20260925','smooth-sky-plain-plot-v485-20260925','village-folk-v486-20260925','photo-merlin-v487-20260925'],shipped=[BUILD,...LATER],cache=sw.match(/const BURBZ_CACHE = '([^']+)'/)[1];
 assert(shipped.some(b=>html.includes("const BURBZ_BUILD = '"+b+"';")));assert(cache.includes('-'+BUILD)&&shipped.some(b=>cache.endsWith('-'+b)));
 for(const file of ['academy_daynight.js','academy_daynight.css','academy_alive_core.js','academy_3d_core.js','scan_home.js','scan_home.css']){
  assert(shipped.some(b=>sw.split("'./"+file+'?v='+b+"'").length-1===3),file+' in all three worker lists');
  assert(shipped.some(b=>html.includes(file+'?v='+b)),file+' pinned in index.html');assert(updater.includes('"'+file+'"'),file+' in updater');
 }
 const art=[...['tree','tree-wide','bough-a','bough-b','bough-c','bough-d',...HOUSES].map(n=>NIGHT+'manga/'+n+'.webp'),...['tree','tree-wide',...HOUSES].map(n=>NIGHT+'home/'+n+'.webp')];
 for(const file of art){assert(sw.includes("'./"+file+"'"),file+' cached for offline nights');assert(updater.includes('"'+file+'"'),file+' in updater');}
});
console.log(`${count} Academy day and night groups passed.`);
