'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),test=require('node:test');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scenes=require('../merlin_story_scenes.js');
const steps=html.slice(html.indexOf('const MERLIN_TUTORIAL_STEPS ='),html.indexOf('\nfunction merlinChapterStepIndices'));
const c={};vm.createContext(c);vm.runInContext(steps+'\nglobalThis.steps=MERLIN_TUTORIAL_STEPS;',c);
test('all four cinematic steps have finished local artwork and meaningful alt text',()=>{const intro=c.steps.filter(s=>s.cinematic);assert.equal(intro.length,4);const files=new Set();for(const step of intro){const art=scenes.sceneFor(step.id);assert.ok(art.description.length>30);assert.ok(fs.statSync(path.join(root,art.image)).size>100000);files.add(art.image);}assert.equal(files.size,4);assert.equal(scenes.sceneFor('alderwing-arrival-v395'),null);});
test('each painting is in all three worker lists and the deployment file list',()=>{const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),updater=fs.readFileSync(path.join(root,'../../scripts/update-live-burbz.sh'),'utf8');for(const src of new Set(c.steps.filter(s=>s.cinematic).map(s=>scenes.sceneFor(s.id).image))){assert.equal(sw.split("'./"+src+"'").length-1,3);assert.ok(updater.includes('"'+src+'"'));}});
test('interactive lessons have no illustration; hub retains its existing illustrated step',()=>{assert.equal(scenes.sceneFor('alderwing-arrival-v395'),null);assert.ok(scenes.sceneFor('alderwing-hub-v420').image);assert.equal(scenes.sceneFor('__proto__'),null);});
