/* Local, needs-driven Peep decisions. No network calls or economic rewards. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzPeepNeeds=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)?{x:p.x,z:p.z}:null;
  function sanitize(raw){
    if(!raw||typeof raw!=='object')return null;
    const pos=point(raw);if(!pos)return null;
    const route=Array.isArray(raw.route)?raw.route.slice(0,256).map(point).filter(Boolean):[];
    return {...pos,thirst:clamp(raw.thirst,0,100),energy:clamp(raw.energy,0,100),fun:clamp(raw.fun,0,100),
      at:clamp(raw.at,0,9e15),yaw:clamp(raw.yaw,-Math.PI*2,Math.PI*2),action:['home','work','green','well','fun','sleep','outside','travel','blocked'].includes(raw.action)?raw.action:'home',
      target:typeof raw.target==='string'?raw.target.slice(0,90):'home',targetKey:typeof raw.targetKey==='string'?raw.targetKey.slice(0,90):'',sceneKey:typeof raw.sceneKey==='string'?raw.sceneKey.slice(0,200):'',
      elapsed:clamp(raw.elapsed,0,100000),distance:clamp(raw.distance,0,100000),cycle:clamp(raw.cycle,0,1000),route};
  }
  function initial(person,env,now){
    let seed=0;for(const c of person.id)seed=(seed*31+c.charCodeAt(0))>>>0;
    let action=['home','work','green'][seed%3];if(!env.destinations[action])action='green';
    const start=env.destinations[action];
    return {...start.point,thirst:20+seed%40,energy:65+seed%30,fun:45+seed%40,at:now,yaw:0,action,target:action,targetKey:start.key,sceneKey:env.sceneKey||'',elapsed:seed%18,distance:0,cycle:seed%3,route:[]};
  }
  function advance(person,env,now,hour){
    const m=person.lifeMemory||(person.lifeMemory=initial(person,env,now));
    // The village and combined town depict different coordinate frames. On
    // entry, place the same saved person at the corresponding real destination;
    // never carry village coordinates into a town's roofs. Needs are preserved.
    if(m.sceneKey!==(env.sceneKey||'')){
      const key=m.action==='sleep'?'home':env.destinations[m.action]?m.action:'green';
      const target=env.destinations[key]||env.destinations.green;
      Object.assign(m,target.point,{sceneKey:env.sceneKey||'',action:m.action==='sleep'&&key==='home'?'sleep':key,target:key,targetKey:target.key,route:[],distance:0,elapsed:0,at:now});
    }
    // Reopening the game is not a new offline penalty. The settlement's existing
    // provisions/growth simulation owns offline accounting. Resume this street.
    const gap=(now-m.at)/1000,dt=gap>=0&&gap<=60?Math.min(gap,10):0;m.at=now;
    const dest=env.destinations,night=hour<6||hour>=22;
    const atTarget=(key)=>dest[key]&&m.targetKey===dest[key].key&&Math.hypot(m.x-dest[key].point.x,m.z-dest[key].point.z)<.08;
    const drinking=m.action==='well'&&atTarget('well');
    const sleeping=m.action==='sleep'&&atTarget('home');
    const playing=m.action==='fun'&&atTarget('fun');
    m.thirst=clamp(m.thirst+dt*(drinking?-12:.17),0,100);
    m.energy=clamp(m.energy+dt*(sleeping?2:m.action==='outside'?.35:m.action==='home'?.35:-.12),0,100);
    m.fun=clamp(m.fun+dt*(playing?3:dest.fun?-.07:-.15),0,100);
    m.elapsed+=dt;
    let arrived=false;
    if(m.action==='travel'){
      // A removed destination invalidates a trip immediately, without jumping
      // to a replacement building or continuing into a newly occupied plot.
      const target=dest[m.target];
      if(!target||target.key!==m.targetKey){m.action='blocked';m.elapsed=0;m.route=[];}
      else{
        m.distance+=dt*.8;
        const length=env.life.routeLength(m.route),p=env.life.samplePath(m.route,length?m.distance/length:1);
        m.x=p.x;m.z=p.z;m.yaw=p.yaw;
        if(m.distance>=length){m.action=m.target==='home'&&(night||m.energy<=30)?'sleep':m.target;m.elapsed=0;m.route=[];arrived=true;}
      }
    }
    const urgent=(night||m.energy<=25)?(dest.home?'home':'outside'):m.thirst>=65&&dest.well?'well':m.fun<=35&&dest.fun?'fun':null;
    const sameNeed=(urgent==='home'&&m.action==='sleep')||urgent===m.action||(m.action==='travel'&&urgent===m.target);
    const done=m.action==='home'&&m.elapsed>=18||m.action==='work'&&m.elapsed>=60||m.action==='green'&&m.elapsed>=22||m.action==='well'&&(m.thirst<=10||!drinking)||m.action==='fun'&&(m.fun>=90||!playing)||m.action==='sleep'&&m.energy>=90&&!night||m.action==='outside'&&m.energy>=55&&!night||m.action==='blocked'&&m.elapsed>=15;
    // Commit to a short drink/game/sleep once there. Need thresholds use relief
    // thresholds above, preventing a thirsty Peep changing its mind every frame.
    const busy=['well','fun','sleep','outside'].includes(m.action)&&!done;
    if(!arrived&&((urgent&&!sameNeed&&!busy&&m.action!=='blocked')||done)){
      let goal=urgent;
      if(!goal){m.cycle=(m.cycle+1)%3;goal=['work','green','home'][m.cycle];if(!dest[goal])goal='green';}
      if(goal==='outside'){m.action='outside';m.elapsed=0;m.route=[];}
      else{
        const target=dest[goal],route=target&&env.routeFrom(m,target);
        if(route&&route.length){m.route=route;m.distance=0;m.elapsed=0;m.target=goal;m.targetKey=target.key;m.action='travel';}
        else{m.action='blocked';m.target=goal;m.elapsed=0;m.route=[];}
      }
    }
    const bored=!dest.fun||m.fun<35;
    const mood=m.thirst>=65?'Thirsty':m.energy<=25?'Tired':bored?'Unhappy':'Content';
    const labels={home:'At home',work:'Working',green:'Mooching on the green',well:'Drinking at the well',fun:'Enjoying a little entertainment',sleep:'Sleeping at home',outside:'Resting outside · needs a home',blocked:'Waiting for a clear path'};
    const trips={home:night||m.energy<=30?'Heading home to sleep':'Heading home',work:'Walking to work',well:'Going to the well',fun:'Looking for entertainment',green:'Mooching to the green'};
    const need=m.thirst>=65&&!dest.well?'Needs a reachable well':bored&&!dest.fun?'Needs entertainment':m.energy<=25&&!dest.home?'Needs a home':'';
    return {x:m.x,z:m.z,yaw:m.yaw,activity:m.action==='travel'?trips[m.target]:labels[m.action],moving:m.action==='travel',inside:(m.action==='home'||m.action==='sleep')&&atTarget('home'),stride:now/1000*6,mood,need,thirst:Math.round(m.thirst),energy:Math.round(m.energy),fun:Math.round(m.fun)};
  }
  return {sanitize,initial,advance};
});
