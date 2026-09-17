/* Saved opening dialogue accompanies the existing home/world lifecycle. */
(function(root){'use strict';
 const lines={shelter:'This is a temporary shelter until you choose your first home.',door:'Let’s take a look outside.',landscape:'Tilt your phone to enter landscape mode.',world:'This is Alderwing, a one-to-one-sized, fully explorable version of your own Earth.',anytime:'You can come here anytime.',earth:'But for now, let’s get back to Earth.',return:'Go back into the shelter.',chair:'Sit down at the desk to return to Earth.',portrait:'Tilt your phone again to go back to portrait.'};
 const next={shelter:'door',landscape:'world',world:'anytime',anytime:'earth',earth:'return',portrait:'done'};
 let api,view=null,box=null,resizeTimer=0;
 const phase=()=>Object.hasOwn(lines,api?.read())?api.read():api?.read()==='done'?'done':null;
 const active=()=>!!phase()&&phase()!=='done';
 function clear(){box?.remove();box=null;view=null;clearTimeout(resizeTimer);}
 function commit(p){if(!api.commit(p))return false;if(p==='done'){clear();api.done();}else render();return true;}
 function phone(){return matchMedia('(pointer:coarse)').matches&&Math.min(innerWidth,innerHeight)<900;}
 function oriented(p){return !phone()||(p==='landscape'?innerWidth>innerHeight:innerHeight>=innerWidth);}
 function render(){
  if(!active()||!view?.host?.isConnected){box?.remove();box=null;return;}
  let p=phase(),text=lines[p],recovery=false;
  if(view.kind==='room'&&!['shelter','door','chair'].includes(p)){text='Step outside to continue our tour.';recovery=true;}
  if(view.kind==='world'&&['shelter','door'].includes(p)){text='Let’s look around Alderwing.';recovery=true;}
  if(!box||box.parentElement!==view.host){box?.remove();box=document.createElement('aside');box.id='alderwingIntroGuide';box.setAttribute('aria-label','Merlin’s introduction');box.innerHTML='<img src="assets/merlin-tutorial.png" alt="Merlin"><div><p aria-live="polite"></p><small></small><button type="button">Next</button></div>';view.host.append(box);box.querySelector('button').addEventListener('click',()=>{const p=phase();if(next[p]&&(!['landscape','portrait'].includes(p)||oriented(p)))commit(next[p]);});}
  box.dataset.phase=p;box.querySelector('p').textContent=text;
  const rotate=['landscape','portrait'].includes(p),button=box.querySelector('button');button.hidden=recovery||!next[p];button.disabled=rotate&&!oriented(p);button.textContent=p==='portrait'?'Continue tutorial':'Next';
  box.querySelector('small').textContent=recovery?'Your progress is saved.':p==='door'?'Turn around and walk to the door.':p==='return'?'Use the shelter door.':p==='chair'?'Walk to the chair and choose Sit at the command desk.':rotate&&!oriented(p)?'Rotate your phone when you’re ready.':rotate?(phone()?'Already in '+p+'.':'Continue when you’re ready.'):'';
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
 root.BurbzAlderwingIntro={bind,begin,room,outside,desk,allowExit,allowSeat,active,clear,phase};
})(globalThis);
