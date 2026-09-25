/* Saved opening dialogue accompanies the existing home/world lifecycle. */
(function(root){'use strict';
 const lines={shelter:'This is a temporary shelter until you choose your first home.',turn:'Before we go outside, turn around. Swipe sideways on the right side of the screen with your right thumb. Lift it and swipe again until you face the door.',door:'Let’s take a look outside.',landscape:'Tilt your phone to enter landscape mode.',world:'This is Alderwing, a one-to-one-sized, fully explorable version of your own Earth.',look:'Swipe across the right side of the screen with your right thumb to look around.',forward:'Push the left stick forwards, then pull it backwards to walk both ways.',sideways:'Push the left stick left, then right to move sideways.',invert:'You can invert vertical look in Settings at any time. This reverses looking up and down.',anytime:'You can come here anytime.',earth:'But for now, let’s get back to Earth.',return:'Go back into the shelter.',chair:'Sit down at the desk to return to Earth.',portrait:'Tilt your phone again to go back to portrait.'};
 const next={shelter:'turn',turn:'door',landscape:'world',world:'look',look:'forward',forward:'sideways',sideways:'invert',invert:'anytime',anytime:'earth',earth:'return',portrait:'done'};
 let api,view=null,box=null,resizeTimer=0,practice=null,pending=null,saveFailed=false;
 const practiceSteps=['turn','look','forward','sideways'];
 const phase=()=>Object.hasOwn(lines,api?.read())?api.read():api?.read()==='done'?'done':null;
 const active=()=>!!phase()&&phase()!=='done';
 const visible=()=>!!view?.host?.isConnected&&!document.hidden&&!root.BurbzLookSettings?.isOpen();
 function matchingView(){const p=phase();return !!view&&(p==='portrait'?view.kind==='desk':['shelter','turn','door','chair'].includes(p)?view.kind==='room':view.kind==='world');}
 // Receipts live only in the current visible practice step. Animation is only
 // CSS: it never calls this API. Each renderer reports its applied camera/travel.
 function syncPractice(){const p=phase();if(!practiceSteps.includes(p)||!matchingView()){practice=null;return;}if(practice?.phase!==p||practice.host!==view.host)practice={phase:p,host:view.host,inputs:new Map(),look:false,turn:0,forward:0,backward:0,left:0,right:0};}
 function ready(){const p=phase();return !practiceSteps.includes(p)||!!practice&&(p==='turn'?Math.abs(practice.turn)>=2.6:p==='look'?practice.look:p==='forward'?practice.forward>=.6&&practice.backward>=.6:practice.left>=.6&&practice.right>=.6);}
 function inputStart(host,id,kind){if(!visible()||!matchingView()||view.host!==host)return;syncPractice();if(practice)practice.inputs.set(id,{kind,pixels:0,angle:0,yaw:0});}
 function currentInput(host,id){if(!visible()||!matchingView()){practice?.inputs.clear();return null;}return practice?.host===host&&practice.phase===phase()?practice.inputs.get(id):null;}
 function inputLook(host,id,dx,dy,angle,yawDelta){const i=currentInput(host,id);if(!i||i.kind!=='look'||!['turn','look'].includes(phase())||!Number.isFinite(dx+dy+angle))return;i.pixels+=Math.hypot(dx,dy);i.angle+=Math.abs(angle);if(Number.isFinite(yawDelta))i.yaw+=yawDelta;}
 function inputEnd(host,id,completed=false){const i=currentInput(host,id);if(!i)return;practice.inputs.delete(id);if(!completed||i.kind!=='look'||i.pixels<36)return;if(phase()==='turn'){practice.turn+=i.yaw;render();}else if(phase()==='look'&&i.angle>=.12){practice.look=true;render();}}
 function inputReset(host){if(practice?.host===host)practice.inputs.clear();}
 function inputMove(host,id,side,forward,dt,dx,dz,yaw){const i=currentInput(host,id);if(!i||!['move','key'].includes(i.kind)||!['forward','sideways'].includes(phase())||!(dt>0)||!Number.isFinite(dx+dz+yaw))return;
  const f=-dx*Math.sin(yaw)-dz*Math.cos(yaw),r=dx*Math.cos(yaw)-dz*Math.sin(yaw),limit=Math.min(.05,dt)*2.7;
  const before=ready();for(const [key,axis,travel] of phase()==='forward'?[['forward',forward,f],['backward',-forward,-f]]:[['right',side,r],['left',-side,-r]])if(axis>=.35&&travel>0)practice[key]=Math.min(.6,practice[key]+Math.min(travel,limit));
  if(ready()!==before||!box?.querySelector('small')?.textContent.includes(progress()))render();
 }
 function progress(){if(!practice)return '';if(phase()==='turn')return ready()?'Turn around ✓':Math.abs(practice.turn)>.1?'Keep swiping the same way, then lift your thumb.':'Try it in the room — the picture is only a demonstration.';if(phase()==='look')return practice.look?'Look around ✓':'Make a swipe, then lift your thumb.';return (phase()==='forward'?[['Forwards','forward'],['Backwards','backward']]:[['Left','left'],['Right','right']]).map(([label,key])=>label+(practice[key]>=.6?' ✓':' …')).join(' · ');}
 function clear(){box?.remove();box=null;view=null;practice=null;pending=null;saveFailed=false;clearTimeout(resizeTimer);}
 function commit(p){let ok=false;try{ok=(!pending?.confirm||pending.confirm())&&api.commit(p);}catch(_){/* Keep the current earned step available for retry. */}if(!ok){saveFailed=true;render();return false;}saveFailed=false;pending=null;if(p==='done'){clear();api.done();}else render();return true;}
 function phone(){return matchMedia('(pointer:coarse)').matches&&Math.min(innerWidth,innerHeight)<900;}
 // A book-style foldable opens to a near-square screen. Its view stays wide
 // whichever way it is held, so the tilt lessons never ask it to turn.
 function square(){const w=root.screen?.width,h=root.screen?.height;return w>0&&h>0&&Math.max(w,h)/Math.min(w,h)<1.3;}
 function oriented(p){return !phone()||square()||(p==='landscape'?innerWidth>innerHeight:innerHeight>=innerWidth);}
 function advance(){if(!visible())return;if(pending){if(pending.from===phase()&&pending.host===view.host&&pending.kind===view.kind)commit(pending.to);return;}const p=phase();if(matchingView()&&next[p]&&ready()&&(!['landscape','portrait'].includes(p)||oriented(p)))commit(next[p]);}
 function render(){
  if(!active()||!view?.host?.isConnected){box?.remove();box=null;return;}
  syncPractice();const p=phase(),recovery=!matchingView();let text=lines[p];
  if(!phone()){if(p==='turn')text='Before we go outside, turn around. Click and drag sideways across the room. Release and drag again until you face the door.';if(p==='look')text='Click and drag across the view to look around.';if(p==='forward')text='Push the left stick forwards and backwards, or use W and S to walk both ways.';if(p==='sideways')text='Push the left stick left and right, or use A and D to move sideways.';}
  const rotate=['landscape','portrait'].includes(p),fold=rotate&&phone()&&square();
  if(fold)text=p==='landscape'?'Your screen is already wide. No need to tilt it.':'Your screen works either way up. No need to tilt it back.';
  if(recovery){if(view.kind==='room')text=['portrait'].includes(p)?'Sit at the command desk to finish returning to Earth.':'We’re back inside early. Step outside to continue the same lesson.';else if(view.kind==='world')text=['shelter','turn','door'].includes(p)?'Go back into the shelter to finish our first lesson.':'Go back into the shelter, then sit at the desk.';}
  if(pending)text='Your action is complete, but the next instruction could not be saved.';
  if(!box||box.parentElement!==view.host){box?.remove();box=document.createElement('aside');box.id='alderwingIntroGuide';box.setAttribute('aria-label','Merlin’s introduction');box.innerHTML='<img src="assets/merlin-tutorial.png" alt="Merlin"><div><p aria-live="polite"></p><div class="ai-turn-demo" aria-hidden="true" hidden><span class="ai-demo-screen"><span class="ai-demo-zone"></span><span class="ai-demo-arrow">↔</span><span class="ai-demo-thumb"></span></span><span class="ai-demo-caption">Right side · swipe, lift, repeat</span></div><small></small><button type="button">Next</button></div>';view.host.append(box);box.querySelector('button').addEventListener('click',advance);}
  box.dataset.phase=p;box.querySelector('p').textContent=text;
  const demo=box.querySelector('.ai-turn-demo');if(demo){demo.hidden=p!=='turn'||recovery;const caption=demo.querySelector('.ai-demo-caption');if(caption)caption.textContent=phone()?'Right side · swipe, lift, repeat':'Drag sideways · release, repeat';}
  const button=box.querySelector('button');button.hidden=!pending&&(recovery||!next[p]);button.disabled=!pending&&((rotate&&!oriented(p))||!ready());button.textContent=pending?'Retry save':p==='portrait'?'Continue tutorial':'Next';
  box.querySelector('small').textContent=saveFailed?'Progress could not be saved. Please try again.':recovery?'Your lesson is saved; no practice has been skipped.':practiceSteps.includes(p)?progress():p==='door'?'Walk to the door and choose Step outside.':p==='return'?'Use the shelter door.':p==='chair'?'Walk to the chair and choose Sit at the command desk.':rotate&&!oriented(p)?'Rotate your phone when you’re ready.':rotate?(phone()&&!fold?'Already in '+p+'.':'Continue when you’re ready.'):'';
 }
 function begin(){if(!phase())return commit('shelter');return phase()==='done'?false:true;}
 // Bind the *actual* view before attempting a durable checkpoint. Failed writes
 // retain the witnessed lifecycle action locally for Retry, never a free Next.
 function attach(kind,host){if(view?.host!==host||view?.kind!==kind){pending=null;saveFailed=false;practice=null;}view={kind,host};}
 function checkpoint(to,confirm){pending={from:phase(),to,host:view.host,kind:view.kind,confirm};commit(to);}
 function room(host){if(!active())return false;attach('room',host);if(phase()==='return'&&!pending)checkpoint('chair');else render();return true;}
 function outside(host,confirm){if(!active())return false;attach('world',host);if(!pending&&(phase()==='door'||confirm))checkpoint(phase()==='door'?'landscape':phase(),confirm);else render();return true;}
 function desk(viaChair){if(!active())return false;clear();if(phase()==='chair'&&viaChair){attach('desk',document.body);checkpoint('portrait');return true;}if(phase()==='portrait'){attach('desk',document.body);render();return true;}return false;}
 function allowExit(){return !active()||!['shelter','turn'].includes(phase());}
 function allowSeat(){return !active()||['chair','portrait'].includes(phase());}
 function bind(options){clear();api=options;}
 root.addEventListener('resize',()=>{practice?.inputs.clear();clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!active()||!view)return;const p=phase(),wasWaiting=box?.querySelector('button')?.disabled;render();if(wasWaiting&&visible()&&matchingView()&&!pending&&['landscape','portrait'].includes(p)&&oriented(p))commit(next[p]);},160);});
 root.addEventListener('blur',()=>practice?.inputs.clear());
 document.addEventListener?.('visibilitychange',()=>{practice?.inputs.clear();});
 root.addEventListener('pagehide',clear);
 root.BurbzAlderwingIntro={bind,begin,room,outside,desk,allowExit,allowSeat,active,clear,phase,inputStart,inputLook,inputMove,inputEnd,inputReset};
})(globalThis);
