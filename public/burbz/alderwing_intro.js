/* Saved opening dialogue accompanies the existing home/world lifecycle. */
(function(root){'use strict';
 const lines={shelter:'This is a temporary shelter until you choose your first home.',door:'Let’s take a look outside.',landscape:'Tilt your phone to enter landscape mode.',world:'This is Alderwing, a one-to-one-sized, fully explorable version of your own Earth.',look:'Swipe across the right side of the screen with your right thumb to look around.',forward:'Push the left stick forwards, then pull it backwards to walk both ways.',sideways:'Push the left stick left, then right to move sideways.',invert:'You can invert vertical look in Settings at any time. This reverses looking up and down.',anytime:'You can come here anytime.',earth:'But for now, let’s get back to Earth.',return:'Go back into the shelter.',chair:'Sit down at the desk to return to Earth.',portrait:'Tilt your phone again to go back to portrait.'};
 const next={shelter:'door',landscape:'world',world:'look',look:'forward',forward:'sideways',sideways:'invert',invert:'anytime',anytime:'earth',earth:'return',portrait:'done'};
 let api,view=null,box=null,resizeTimer=0,practice=null;
 const practiceSteps=['look','forward','sideways'];
 // Receipts live only in the current visible step. Old or held inputs cannot
 // acquire a new receipt without another pointer/key start in that step.
 function syncPractice(){const p=phase();if(!practiceSteps.includes(p)||view?.kind!=='world'){practice=null;return;}if(practice?.phase!==p||practice.host!==view.host)practice={phase:p,host:view.host,inputs:new Map(),look:false,forward:0,backward:0,left:0,right:0};}
 function ready(){return !practiceSteps.includes(phase())||!!practice&&(phase()==='look'?practice.look:phase()==='forward'?practice.forward>=.6&&practice.backward>=.6:practice.left>=.6&&practice.right>=.6);}
 function inputStart(host,id,kind){if(!view||view.host!==host||view.kind!=='world'||document.hidden||root.BurbzLookSettings?.isOpen())return;syncPractice();if(practice)practice.inputs.set(id,{kind,pixels:0,angle:0});}
 function inputLook(host,id,dx,dy,angle){const i=practice?.host===host&&practice.phase===phase()?practice.inputs.get(id):null;if(!i||i.kind!=='look'||phase()!=='look')return;i.pixels+=Math.hypot(dx,dy);i.angle+=Math.abs(angle);}
 function inputEnd(host,id,completed=false){const i=practice?.host===host?practice.inputs.get(id):null;if(!i)return;practice.inputs.delete(id);if(completed&&phase()==='look'&&i.kind==='look'&&i.pixels>=36&&i.angle>=.12){practice.look=true;render();}}
 function inputReset(host){if(practice?.host===host)practice.inputs.clear();}
 function inputMove(host,id,side,forward,dt,dx,dz,yaw){const i=practice?.host===host&&practice.phase===phase()?practice.inputs.get(id):null;if(!i||!['move','key'].includes(i.kind)||!['forward','sideways'].includes(phase())||!(dt>0)||!Number.isFinite(dx+dz+yaw))return;
  const f=-dx*Math.sin(yaw)-dz*Math.cos(yaw),r=dx*Math.cos(yaw)-dz*Math.sin(yaw),limit=Math.min(.05,dt)*2.7;
  const before=ready();for(const [key,axis,travel] of phase()==='forward'?[['forward',forward,f],['backward',-forward,-f]]:[['right',side,r],['left',-side,-r]])if(axis>=.35&&travel>0)practice[key]=Math.min(.6,practice[key]+Math.min(travel,limit));
  if(ready()!==before||!box?.querySelector('small')?.textContent.includes(progress()))render();
 }
 function progress(){if(!practice)return '';if(phase()==='look')return practice.look?'Look around ✓':'Make a swipe, then lift your thumb.';return (phase()==='forward'?[['Forwards','forward'],['Backwards','backward']]:[['Left','left'],['Right','right']]).map(([label,key])=>label+(practice[key]>=.6?' ✓':' …')).join(' · ');}

 const phase=()=>Object.hasOwn(lines,api?.read())?api.read():api?.read()==='done'?'done':null;
 const active=()=>!!phase()&&phase()!=='done';
 function clear(){box?.remove();box=null;view=null;practice=null;clearTimeout(resizeTimer);}
 function commit(p){if(!api.commit(p))return false;if(p==='done'){clear();api.done();}else render();return true;}
 function phone(){return matchMedia('(pointer:coarse)').matches&&Math.min(innerWidth,innerHeight)<900;}
 function oriented(p){return !phone()||(p==='landscape'?innerWidth>innerHeight:innerHeight>=innerWidth);}
 function render(){
  if(!active()||!view?.host?.isConnected){box?.remove();box=null;return;}
  syncPractice();let p=phase(),text=lines[p],recovery=false;if(!phone()){if(p==='look')text='Click and drag across the view to look around.';if(p==='forward')text='Push the left stick forwards and backwards, or use W and S to walk both ways.';if(p==='sideways')text='Push the left stick left and right, or use A and D to move sideways.';}
  if(view.kind==='room'&&!['shelter','door','chair'].includes(p)){text='Step outside to continue our tour.';recovery=true;}
  if(view.kind==='world'&&['shelter','door'].includes(p)){text='Let’s look around Alderwing.';recovery=true;}
  if(!box||box.parentElement!==view.host){box?.remove();box=document.createElement('aside');box.id='alderwingIntroGuide';box.setAttribute('aria-label','Merlin’s introduction');box.innerHTML='<img src="assets/merlin-tutorial.png" alt="Merlin"><div><p aria-live="polite"></p><small></small><button type="button">Next</button></div>';view.host.append(box);box.querySelector('button').addEventListener('click',()=>{const p=phase();if(next[p]&&ready()&&(!['landscape','portrait'].includes(p)||oriented(p)))commit(next[p]);});}
  box.dataset.phase=p;box.querySelector('p').textContent=text;
  const rotate=['landscape','portrait'].includes(p),button=box.querySelector('button');button.hidden=recovery||!next[p];button.disabled=(rotate&&!oriented(p))||!ready();button.textContent=p==='portrait'?'Continue tutorial':'Next';
  box.querySelector('small').textContent=recovery?'Your progress is saved.':practiceSteps.includes(p)?progress():p==='door'?'Turn around and walk to the door.':p==='return'?'Use the shelter door.':p==='chair'?'Walk to the chair and choose Sit at the command desk.':rotate&&!oriented(p)?'Rotate your phone when you’re ready.':rotate?(phone()?'Already in '+p+'.':'Continue when you’re ready.'):'';
 }
 function begin(){if(!phase())return commit('shelter');return phase()==='done'?false:true;}
 function room(host){if(!active())return false;if(phase()==='return'&&!api.commit('chair'))return true;view={kind:'room',host};render();return true;}
 function outside(host){if(!active())return false;if(['shelter','door'].includes(phase())&&!api.commit('landscape'))return false;view={kind:'world',host};render();return true;}
 function desk(viaChair){if(!active())return false;clear();if(viaChair&&phase()==='chair'&&!api.commit('portrait'))return false;if(phase()==='portrait'){view={kind:'desk',host:document.body};render();return true;}return false;}
 function allowExit(){return !active()||phase()!=='shelter';}
 function allowSeat(){return !active()||phase()==='chair';}
 function bind(options){clear();api=options;}
 root.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!active()||!view)return;const p=phase(),wasWaiting=box?.querySelector('button')?.disabled;render();if(wasWaiting&&['landscape','portrait'].includes(p)&&oriented(p))commit(next[p]);},160);});
 root.addEventListener('pagehide',clear);
 root.BurbzAlderwingIntro={bind,begin,room,outside,desk,allowExit,allowSeat,active,clear,phase,inputStart,inputLook,inputMove,inputEnd,inputReset};
})(globalThis);
