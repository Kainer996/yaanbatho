/* Conservative OpenMapTiles open-land interpretation. Unknown cover stays
 * authored woodland; explicit woodland takes precedence over overlapping grass.
 * Schema: https://openmaptiles.org/schema/#landcover */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzOpenLandCore=api;})(globalThis,function(){
'use strict';
function kind(feature){if(!/^(Polygon|MultiPolygon)$/.test(feature?.geometry?.type))return null;const p=feature.properties||{},layer=feature.sourceLayer||feature['source-layer'],sub=String(p.subclass||'').toLowerCase();if(layer!=='landcover'||p.class!=='grass')return null;if(['heath','fell'].includes(sub))return'heath';if(['grass','grassland','meadow'].includes(sub))return'grassland';return null;}
function sample(x,z,at){const kind=at(x,z);if(!kind)return{kind:null,weight:0};let hits=1;for(const [dx,dz]of [[-4,0],[4,0],[0,-4],[0,4]])if(at(x+dx,z+dz)===kind)hits++;return{kind,weight:hits/5};}
function keepTree(tone,land){return !land.kind||tone>=land.weight*(land.kind==='heath'?.975:.94);}
function tint(rgb,land){const target=land.kind==='heath'?[1.12,.96,1.06]:[1.055,1.07,.94],w=land.weight;return rgb.map((v,i)=>v*(1+(target[i]-1)*w));}
return{kind,sample,keepTree,tint};
});
