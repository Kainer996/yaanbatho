const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace('\ninit();',`// Disposable local fixture only.
localStorage.setItem(BURBZ_EPOCH_KEY,BURBZ_FRESH_START_EPOCH);
localStorage.setItem(BURBZ_INTRO_SEEN_KEY,'1');
localStorage.setItem(BURBZ_TUTORIAL_CHAPTERS_KEY,JSON.stringify(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id)));
const fixture=JSON.parse(JSON.stringify(DEFAULT_STATE));
fixture.settings={music:false,sfx:false,vibration:false,appearance:'normal'};
Object.assign(fixture.player,{level:20,coins:12345,branches:4321,stone:123});
localStorage.setItem('burbz_state',JSON.stringify(fixture));
window.__testEval=code=>eval(code);
// Run
init();`);
module.exports=html;
