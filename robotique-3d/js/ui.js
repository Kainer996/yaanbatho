/* =====================================================================
   ROBOTIQUE 3D — DOM UI module
   Dialogue box, HUD, panels, toasts, touch controls, fullscreen.
   ===================================================================== */
import {S, ITEMS, QUESTS, activeQuest, SAYS} from './content.js?v=11';

export const TOUCH = ('ontouchstart' in window) ||
  (window.matchMedia && matchMedia('(pointer:coarse)').matches);

export const UI = {
  el:{}, typing:false, typeTimer:null, node:null, choiceIdx:0,
  onUseItem:null, onAdvanceSound:null,

  init(){
    for(const id of ['hud','credits','clock','tracker','prompt','dlg','dlgName','dlgText',
      'dlgChoices','dlgMore','toasts','questPanel','questList','helpPanel','title','fade',
      'ending','endText','hint','invPanel','invList','xhair']) this.el[id]=document.getElementById(id);
    this.el.dlg.addEventListener('click', e=>{
      if(e.target.closest('.choice')) return; this.advance(); });
    for(const pid of ['questPanel','helpPanel','invPanel']){
      const p=this.el[pid];
      p.addEventListener('click', e=>{ if(e.target===p) this.closePanels(); });
    }
  },

  refreshHUD(){
    this.el.credits.innerHTML='&#8353; '+S.credits;
    const hp=document.querySelector('#hpbar i'), hu=document.querySelector('#hungbar i');
    if(hp) hp.style.width=Math.round(S.hp/S.maxHp*100)+'%';
    if(hu) hu.style.width=Math.round(S.hunger)+'%';
    const h=Math.floor(S.minutes/60)%24, m=S.minutes%60;
    this.el.clock.textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+' · DAY '+(S.day||1)+' · 2045';
    const q=activeQuest();
    if(q){ this.el.tracker.style.display='';
      this.el.tracker.querySelector('.qt').textContent=QUESTS[q].title;
      this.el.tracker.querySelector('.qo').textContent=QUESTS[q].obj();
    } else this.el.tracker.style.display='none';
  },

  toast(msg, cls){
    const d=document.createElement('div'); d.className='toast'+(cls?' '+cls:''); d.innerHTML=msg;
    this.el.toasts.appendChild(d);
    setTimeout(()=>d.classList.add('out'), 2600);
    setTimeout(()=>d.remove(), 3200);
  },

  prompt(label){
    const pr=this.el.prompt;
    if(label && !this.dialogOpen && !this.anyPanel()){
      pr.style.display='block'; pr.textContent=label;
    } else pr.style.display='none';
  },

  /* ---- dialogue ---- */
  open(nodeId){
    const n=SAYS[nodeId]; if(!n) return;
    if(n.fx){ const r=n.fx(); if(r==='skip'){ this.close(); return; } }
    this.node=n; this.el.dlg.style.display='block';
    this.el.dlgName.textContent=n.who;
    this.el.dlgName.classList.toggle('player', n.who===S.name);
    this.el.dlgChoices.style.display='none'; this.el.dlgChoices.innerHTML='';
    this.el.dlgMore.style.display='none';
    this.typeText(n.text, ()=>{
      if(n.choices){ this.showChoices(n.choices); }
      else this.el.dlgMore.style.display='block';
    });
    if(this.onAdvanceSound) this.onAdvanceSound();
  },
  typeText(text, done){
    clearInterval(this.typeTimer); this.typing=true;
    const el=this.el.dlgText; el.textContent='';
    let i=0;
    this.typeTimer=setInterval(()=>{
      el.textContent=text.slice(0,++i);
      if(i>=text.length){ clearInterval(this.typeTimer); this.typing=false; done&&done(); }
    }, 14);
    this._fullText=text; this._onTyped=done;
  },
  skipType(){
    clearInterval(this.typeTimer); this.typing=false;
    this.el.dlgText.textContent=this._fullText;
    this._onTyped&&this._onTyped();
  },
  showChoices(choices){
    this.choiceIdx=0;
    const box=this.el.dlgChoices; box.innerHTML='';
    choices.forEach((c,i)=>{
      const d=document.createElement('div'); d.className='choice'+(i===0?' sel':'');
      d.innerHTML='<span class="key">'+(i+1)+'</span>'+c.t;
      d.onclick=()=>this.pick(i);
      box.appendChild(d);
    });
    box.style.display='block';
  },
  moveChoice(d){
    if(!this.node||!this.node.choices) return;
    const n=this.node.choices.length;
    this.choiceIdx=(this.choiceIdx+d+n)%n;
    [...this.el.dlgChoices.children].forEach((c,i)=>c.classList.toggle('sel', i===this.choiceIdx));
  },
  pick(i){
    if(!this.node||!this.node.choices) return;
    const c=this.node.choices[i]; if(!c) return;
    if(c.n) this.open(c.n); else this.close();
  },
  advance(){
    if(!this.dialogOpen) return;
    if(this.typing){ this.skipType(); return; }
    if(this.node && this.node.choices){ this.pick(this.choiceIdx); return; }
    if(this.node && this.node.next){ this.open(this.node.next); return; }
    this.close();
  },
  close(){ this.node=null; this.el.dlg.style.display='none'; this.refreshHUD(); },
  get dialogOpen(){ return !!this.node; },

  /* ---- panels ---- */
  togglePanel(which){
    const p=this.el[which];
    const open=p.style.display==='flex';
    this.closePanels();
    if(!open){
      if(which==='questPanel') this.renderQuests();
      if(which==='invPanel') this.renderInv();
      p.style.display='flex';
    }
  },
  anyPanel(){ return ['questPanel','helpPanel','invPanel'].some(id=>this.el[id].style.display==='flex'); },
  closePanels(){ for(const id of ['questPanel','helpPanel','invPanel']) this.el[id].style.display='none'; },
  renderQuests(){
    const box=this.el.questList; box.innerHTML='';
    const ids=Object.keys(S.quests);
    if(!ids.length){ box.innerHTML='<div class="qd">No quests yet. Try talking to someone.</div>'; return; }
    for(const id of ids){
      const q=QUESTS[id], st=S.quests[id];
      const d=document.createElement('div'); d.className='qitem'+(st==='done'?' done':'');
      d.innerHTML='<div class="qn">'+q.title+'</div><div class="qd">'+q.desc+'</div>'+
        '<div class="qs">'+(st==='done'?'✓ Complete':'▸ '+q.obj())+'</div>';
      box.appendChild(d);
    }
  },
  renderInv(){
    const box=this.el.invList; box.innerHTML='';
    const ids=Object.keys(S.inv);
    if(!ids.length){ box.innerHTML='<div class="qd">Empty. GreenGrid Market on the main street sells food.</div>'; return; }
    for(const id of ids){
      const it=ITEMS[id]; if(!it) continue;
      const d=document.createElement('div'); d.className='qitem';
      d.innerHTML='<div class="qn">'+it.name+' ×'+S.inv[id]+'</div><div class="qd">'+it.desc+'</div>';
      if(!it.passive){
        const b=document.createElement('button'); b.className='btn';
        b.style.cssText='margin:4px 0; padding:4px 18px; font-size:12px;';
        b.textContent='Use'; b.onclick=()=>{ if(this.onUseItem) this.onUseItem(id); };
        d.appendChild(b);
      }
      box.appendChild(d);
    }
  },

  fadeTo(black, ms){
    const f=this.el.fade;
    f.style.transition='opacity '+(ms||1200)+'ms ease';
    f.style.opacity=black?1:0;
  },
  showEnding(){
    this.el.endText.innerHTML=
     '<p>You came to New Meridian with a dead phone and nineteen missing years. Tonight you have a roof, a job the robots can’t do, and a physicist who knows exactly which door leads home.</p>'+
     '<p>Somewhere behind the Array’s blast shielding, a wormhole mouth has been waiting since 2026 — the year you fell asleep, the earliest moment any time machine can ever reach.</p>'+
     '<p>Dr. Okafor needs exotic matter. The city needs couriers. And you need to decide what “home” means when both ends of the tunnel are open.</p>';
    this.el.ending.style.display='flex';
  },
};

/* =====================================================================
   INPUT — keyboard + virtual joystick + look drag + buttons
   ===================================================================== */
export const INPUT = {
  keys:{}, look:{dx:0,dy:0}, stick:{x:0,y:0},
  onAction:null,            // (key) => void   for e/f/i/j/h/m/escape/digits
  pointerLocked:false,

  init(canvas){
    addEventListener('keydown', e=>{
      if(e.repeat) return;
      const k=e.key.toLowerCase();
      if(document.getElementById('title').style.display!=='none' &&
         document.activeElement===document.getElementById('nameInput')) return;
      this.keys[k]=true;
      if(this.onAction) this.onAction(k);
      if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', e=>{ this.keys[e.key.toLowerCase()]=false; });

    /* pointer lock (PC) */
    canvas.addEventListener('click', ()=>{
      if(TOUCH || UI.dialogOpen || UI.anyPanel()) return;
      if(document.getElementById('title').style.display!=='none') return;
      if(!this.pointerLocked) canvas.requestPointerLock&&canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', ()=>{
      this.pointerLocked = document.pointerLockElement===canvas;
    });
    addEventListener('mousemove', e=>{
      if(this.pointerLocked){ this.look.dx+=e.movementX; this.look.dy+=e.movementY; }
    });

    /* virtual joystick */
    const stick=document.getElementById('stick'), knob=document.getElementById('knob');
    let sid=null, scx=0, scy=0;
    const setKnob=(dx,dy)=>{ knob.style.transform=
      'translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px))'; };
    stick.addEventListener('touchstart', e=>{
      e.preventDefault();
      const t=e.changedTouches[0]; sid=t.identifier;
      const r=stick.getBoundingClientRect(); scx=r.left+r.width/2; scy=r.top+r.height/2;
    },{passive:false});
    addEventListener('touchmove', e=>{
      for(const t of e.changedTouches){
        if(t.identifier===sid){
          let dx=t.clientX-scx, dy=t.clientY-scy;
          const len=Math.hypot(dx,dy), max=44;
          if(len>max){ dx*=max/len; dy*=max/len; }
          this.stick.x=dx/max; this.stick.y=dy/max; setKnob(dx,dy);
        } else if(t.identifier===this.lid){
          this.look.dx+=(t.clientX-this.lx)*2.2; this.look.dy+=(t.clientY-this.ly)*2.2;
          this.lx=t.clientX; this.ly=t.clientY;
        }
      }
    },{passive:false});
    addEventListener('touchend', e=>{
      for(const t of e.changedTouches){
        if(t.identifier===sid){ sid=null; this.stick.x=0; this.stick.y=0; setKnob(0,0); }
        if(t.identifier===this.lid) this.lid=null;
      }
    });

    /* look drag: any touch outside the stick / buttons */
    addEventListener('touchstart', e=>{
      for(const t of e.changedTouches){
        const el=document.elementFromPoint(t.clientX,t.clientY);
        if(el && (el.closest('#stick')||el.closest('.tbtn')||el.closest('.sbtn')||
                  el.closest('#dlg')||el.closest('.panel')||el.closest('#title'))) continue;
        if(this.lid==null){ this.lid=t.identifier; this.lx=t.clientX; this.ly=t.clientY; }
      }
    },{passive:true});

    /* action button */
    const tA=document.getElementById('tA');
    tA.addEventListener('touchstart', e=>{ e.preventDefault();
      tA.classList.add('on'); if(this.onAction) this.onAction('e'); },{passive:false});
    tA.addEventListener('touchend', e=>{ if(e.cancelable)e.preventDefault(); tA.classList.remove('on'); },{passive:false});

    document.getElementById('btnQuests').addEventListener('click', ()=>this.onAction&&this.onAction('j'));
    document.getElementById('btnBag').addEventListener('click', ()=>this.onAction&&this.onAction('i'));

    /* fullscreen */
    const btnFS=document.getElementById('btnFS');
    const fsEl=()=>document.fullscreenElement||document.webkitFullscreenElement;
    btnFS.addEventListener('click', ()=>{
      const root=document.documentElement;
      if(fsEl()){ (document.exitFullscreen||document.webkitExitFullscreen).call(document); }
      else{
        const req=root.requestFullscreen||root.webkitRequestFullscreen;
        if(req){ try{ const p=req.call(root); p&&p.catch&&p.catch(()=>{}); }catch(e){} }
        if(screen.orientation&&screen.orientation.lock)
          screen.orientation.lock('landscape').catch(()=>{});
      }
    });
    if(!document.documentElement.requestFullscreen && !document.documentElement.webkitRequestFullscreen)
      btnFS.style.display='none';
  },
};
