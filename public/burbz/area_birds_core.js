/* Local occurrence evidence is an estimate, never a measured encounter probability. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzAreaBirdsCore=api;})(globalThis,function(){'use strict';
 const key=name=>String(name||'').trim().toLowerCase().split(/\s+/).slice(0,2).join(' ');
 function area(position,date=new Date()){
  if(!position||!Number.isFinite(position.lat)||!Number.isFinite(position.lon)||Math.abs(position.lat)>85||Math.abs(position.lon)>180)return null;
  const lat=Math.round(position.lat*10)/10,lon=Math.round(position.lon*10)/10,month=date.getMonth()+1,year=date.getFullYear();
  return {lat,lon,month,year,id:[lat,lon,month,year].join(':'),radius:20};
 }
 function query(a,seasonal=true){
  const ring=[];for(let i=0;i<=32;i++){const angle=i/32*Math.PI*2,lat=a.lat+Math.sin(angle)*a.radius/111.195,lon=a.lon+Math.cos(angle)*a.radius/(111.195*Math.cos(a.lat*Math.PI/180));ring.push(lon.toFixed(5)+' '+lat.toFixed(5));}ring[32]=ring[0];
  const params=new URLSearchParams({taxonKey:'212',hasCoordinate:'true',hasGeospatialIssue:'false',occurrenceStatus:'PRESENT',year:(a.year-5)+','+a.year,limit:'0',facet:'scientificName',facetLimit:'2000',geometry:'POLYGON(('+ring.join(',')+'))'});
  params.append('basisOfRecord','HUMAN_OBSERVATION');params.append('basisOfRecord','MACHINE_OBSERVATION');if(seasonal)params.set('month',String(a.month));
  return 'https://api.gbif.org/v1/occurrence/search?'+params;
 }
 function records(data){
  if(!data||!Number.isFinite(data.count)||data.count<0||!Array.isArray(data.facets))throw Error('Incomplete bird records');
  if(data.count===0)return {total:0,counts:{},truncated:false};
  const facet=data.facets.find(f=>f.field==='SCIENTIFIC_NAME');if(!facet||!Array.isArray(facet.counts))throw Error('Missing species records');
  const counts={};for(const row of facet.counts.slice(0,2000)){const name=key(row.name);if(!/^[a-z-]+ [a-z-]+$/.test(name)||!Number.isSafeInteger(row.count)||row.count<0)continue;counts[name]=(counts[name]||0)+row.count;}
  return {total:data.count,counts,truncated:facet.counts.length>=2000};
 }
 function rank(catalogue,context,evidence,sort='likely',search=''){
  const habitats=new Set(context.habitats||[]),bySpecies=new Map(),month=context.month;
  const grouped=new Map();for(const entry of catalogue||[]){if(entry.excluded)continue;const id=key(entry.canonical||entry.scientific)||entry.name.toLowerCase(),old=grouped.get(id);if(!old)grouped.set(id,{...entry});else{old.inRange=old.inRange||entry.inRange;old.habitats=[...new Set([...(old.habitats||[]),...(entry.habitats||[])])];old.recordKeys=[...new Set([...(old.recordKeys||[]),...(entry.recordKeys||[])])];old.months=old.months?.length&&entry.months?.length?[...new Set([...old.months,...entry.months])]:null;}}
  for(const [id,entry] of grouped){
   const aliases=[...new Set([id,...(entry.recordKeys||[]).map(key)])];const count=aliases.reduce((n,k)=>n+(evidence?.seasonal?.counts[k]||0),0),annual=aliases.reduce((n,k)=>n+(evidence?.annual?.counts[k]||0),0);
   // Checklist-only, historic and out-of-range names need actual local records.
   if(!entry.inRange&&!count&&!annual)continue;
   const inSeason=!entry.months?.length||entry.months.includes(month),matched=(entry.habitats||[]).filter(h=>habitats.has(h)),hasRecords=!!evidence&&evidence.annual.total>0;
   const seasonKnown=!!entry.months?.length;
   const score=count>0?count:0;
   const bucket=count>0?0:entry.inRange&&inSeason&&matched.length?1:entry.inRange&&inSeason?2:3;
   const frequency=entry.recordMatchVerified===false?'Record matching not verified':!hasRecords?'Frequency not yet known':annual===0?'No local records':annual>=1000?'Frequently recorded':annual>=100?'Regularly recorded':annual>=10?'Occasionally recorded':'Few local records';
   const likelihood=count>0?'Local seasonal records':!inSeason?'Outside usual season':matched.length?'Suitable habitat nearby':'Possible in the wider area';
   bySpecies.set(id,{...entry,id,count,annual,score,bucket,inSeason,seasonKnown,matched,frequency,likelihood,hasRecords});
  }
  const q=String(search).trim().toLowerCase();return [...bySpecies.values()].filter(r=>!q||(r.name+' '+r.scientific).toLowerCase().includes(q)).sort((a,b)=>{
   if(sort==='name')return a.name.localeCompare(b.name);
   if(sort==='rare'){const known=(a.annual>0?0:1)-(b.annual>0?0:1);return known||(a.annual-b.annual)||a.name.localeCompare(b.name);}
   return a.bucket-b.bucket||b.score-a.score||Number(!!b.matched.length)-Number(!!a.matched.length)||b.annual-a.annual||a.name.localeCompare(b.name);
  });
 }
 return {key,area,query,records,rank};
});
