'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const html=read('index.html'),css=read('scan_home.css'),js=read('scan_home.js'),sw=read('sw.js');
assert.match(html,/<span class="desk-current-label">Quests<\/span>/);
for(const name of ['training','hospital','kitchen','crafting','open-camera','start-sound-scan','your-empire','saltmere']){
 const rel='assets/dashboard-banners/'+name+'.webp';assert(fs.statSync(path.join(root,rel)).size>1000);assert(css.includes(rel));assert.equal(sw.split('./'+rel).length-1,3,rel+' in each worker list');
}
assert.match(js,/goalHeight=50/);assert.match(css,/mask-image:linear-gradient\(to right,transparent/);
assert.match(js,/data-banner="\$\{column.id==='villages'\?'saltmere':''\}"/);
assert.match(css,/pointer-events:none/);
console.log('PASS banner assets, Quests label, compact goal, scoped village layer and offline registration');
