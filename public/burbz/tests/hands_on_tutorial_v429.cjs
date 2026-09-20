'use strict';
const assert=require('node:assert/strict');
exports.verify=async({page,context,run,pass,shot})=>{
 if(process.env.INTRO_DESKTOP_ONLY)return desktop({page,run,pass,shot});
 const phase=p=>page.locator('#alderwingIntroGuide[data-phase="'+p+'"]'),next=()=>page.locator('#alderwingIntroGuide button'),cdp=await context.newCDPSession(page);
 let point=null;const touch=async(type,x,y)=>{point=type==='touchEnd'?null:{id:81,x,y};await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:point?[point]:[]});};
 const box=await page.locator('.vw-look').boundingBox(),x=box.width*.60,y=box.height*.61;
 await phase('world').waitFor();
 // The same held finger that looked before the current step earns no receipt.
 await touch('touchStart',x,y);await touch('touchMove',x+50,y);
 await next().evaluate(b=>b.click());await phase('look').waitFor();assert.equal(await next().isDisabled(),true);
 await touch('touchMove',x+105,y);await touch('touchEnd');assert.equal(await next().isDisabled(),true);
 await touch('touchStart',x,y);await touch('touchMove',x+5,y);await touch('touchEnd');assert.equal(await next().isDisabled(),true);
 await page.keyboard.press('ArrowRight');assert.equal(await next().isDisabled(),true);
 const pose0=await page.evaluate(()=>BurbzVillageWalk.diagnostics().player);
 await touch('touchStart',x,y);await touch('touchMove',x+55,y);assert.equal(await next().isDisabled(),true);await touch('touchEnd');assert.equal(await next().isDisabled(),false);
 const pose1=await page.evaluate(()=>BurbzVillageWalk.diagnostics().player);assert(Math.abs(pose1.yaw-pose0.yaw)>.12);
 pass('Look gate requires a fresh meaningful camera swipe and release; old held input, tiny swipes and arrow keys cannot complete it');
 await next().click();await phase('forward').waitFor();assert.equal(await next().isDisabled(),true);
 const stick=await page.locator('.vw-stick').boundingBox(),sx=stick.x+stick.width/2,sy=stick.y+stick.height/2;
 async function direction(dx,dy,label,release=true){await touch('touchStart',sx,sy);await touch('touchMove',sx+dx,sy+dy);await page.waitForFunction(label=>document.querySelector('#alderwingIntroGuide small').textContent.includes(label+' ✓'),label,{timeout:15000});if(release)await touch('touchEnd');}
 await direction(0,-25,'Forwards');assert.equal(await next().isDisabled(),true);await direction(0,25,'Backwards',false);assert.equal(await next().isDisabled(),false);
 await next().evaluate(b=>b.click());await phase('sideways').waitFor();await touch('touchMove',sx+25,sy);await page.waitForTimeout(600);await touch('touchEnd');assert.equal(await next().isDisabled(),true);assert(!await page.locator('#alderwingIntroGuide small').innerText().then(x=>x.includes('✓')));
 await direction(-25,0,'Left');assert.equal(await next().isDisabled(),true);await direction(25,0,'Right');assert.equal(await next().isDisabled(),false);
 pass('Left stick requires actual forwards and backwards travel, then fresh left and right travel; a held stick cannot cross steps');
 await shot('movement-practice');await next().click();await phase('invert').waitFor();
 await page.locator('.fp-settings').click();await page.locator('#settingsModal.show').waitFor();
 assert.equal(await page.locator('#toggleInvertLook').getAttribute('aria-checked'),'false');
 await run('window.__savedDurable=durableSaveState;durableSaveState=()=>({ok:false})');await page.locator('#toggleInvertLook').click();assert.equal(await page.locator('#toggleInvertLook').getAttribute('aria-checked'),'false');assert.equal(await run('gameState.settings.invertVerticalLook'),false);await run('durableSaveState=window.__savedDurable');
 await page.locator('#toggleInvertLook').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#toggleInvertLook').getAttribute('aria-checked'),'true');assert.equal(await run('JSON.parse(localStorage.getItem("burbz_state")).settings.invertVerticalLook'),true);
 await shot('invert-look-settings');await page.keyboard.press('Escape');await phase('invert').waitFor();assert.equal(await page.locator('#settingsModal.show').count(),0);
 // Camera pitch, not just a stored flag, reverses; horizontal look is unchanged.
 async function swipePitch(){const before=await page.evaluate(()=>BurbzVillageWalk.diagnostics().player);await touch('touchStart',x,y);await touch('touchMove',x+12,y+24);await touch('touchEnd');const after=await page.evaluate(()=>BurbzVillageWalk.diagnostics().player);return{pitch:after.pitch-before.pitch,yaw:after.yaw-before.yaw};}
 const inverted=await swipePitch();assert(inverted.pitch>0&&inverted.yaw<0);
 const pad=await page.locator('.fp-look-stick').boundingBox(),lx=pad.x+pad.width/2,ly=pad.y+pad.height/2,beforeHeld=await page.evaluate(()=>BurbzVillageWalk.diagnostics().player.pitch);
 await touch('touchStart',lx,ly);await touch('touchMove',lx,ly+20);await page.waitForFunction(p=>BurbzVillageWalk.diagnostics().player.pitch>p+.02,beforeHeld,{timeout:10000});await touch('touchEnd');
 await page.locator('.fp-settings').click();await page.locator('#toggleInvertLook').click();await page.locator('#settingsCloseBtn').click();const normal=await swipePitch();assert(normal.pitch<0&&normal.yaw<0);assert(Math.abs(normal.yaw-inverted.yaw)<.001);
 await page.locator('.fp-settings').click();await page.locator('#toggleInvertLook').click();await page.locator('#settingsCloseBtn').click();
 pass('World Settings is reachable and keyboard accessible; failed saving rolls back, successful choice persists, and actual vertical camera input reverses without changing horizontal input');
 await next().click();await phase('anytime').waitFor();
};

async function desktop({page,run,pass,shot}){
 const next=()=>page.locator('#alderwingIntroGuide button'),phase=p=>page.locator('#alderwingIntroGuide[data-phase="'+p+'"]');
 await next().click();await phase('look').waitFor();assert.equal(await next().isDisabled(),true);
 await page.mouse.move(650,410);await page.mouse.down();await page.mouse.move(710,430,{steps:10});await page.mouse.up();assert.equal(await next().isDisabled(),false);await next().click();await phase('forward').waitFor();
 async function move(key,label){await page.locator('.vw-look').focus();await page.keyboard.down(key);await page.waitForFunction(label=>document.querySelector('#alderwingIntroGuide small').textContent.includes(label+' ✓'),label,{timeout:15000});await page.keyboard.up(key);}
 await move('KeyW','Forwards');assert.equal(await next().isDisabled(),true);await move('KeyS','Backwards');await next().click();await phase('sideways').waitFor();assert.equal(await next().isDisabled(),true);await move('KeyA','Left');assert.equal(await next().isDisabled(),true);await move('KeyD','Right');await shot('desktop-practice');await next().click();await phase('invert').waitFor();
 await page.locator('.fp-settings').click();await page.locator('#toggleInvertLook').click();await page.locator('#settingsCloseBtn').click();
 await page.locator('.vw-look').focus();const before=await page.evaluate(()=>BurbzVillageWalk.diagnostics().player.pitch);await page.keyboard.down('ArrowUp');await page.waitForFunction(p=>BurbzVillageWalk.diagnostics().player.pitch<p,before);await page.keyboard.up('ArrowUp');assert.equal(await run('gameState.settings.invertVerticalLook'),true);
 for(const size of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]){await page.setViewportSize(size);await page.waitForTimeout(200);const r=await page.locator('#alderwingIntroGuide').boundingBox();assert(r.x>=0&&r.x+r.width<=size.width&&r.y+r.height<=size.height);await shot('instruction-'+size.width);}
 await next().click();await phase('anytime').waitFor();pass('Desktop mouse/WASD practice gates, inverted keyboard pitch and portrait/desktop instruction layouts pass');
}
