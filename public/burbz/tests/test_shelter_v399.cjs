const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../player_home_core.js');
let h=C.initial();
assert.equal(h.arrival,'home');assert.equal(h.tier,0);assert(h.outlook);
function act(action,wallet={branches:25}){const r=C.propose(h,wallet,action);assert(r.ok,r.error);h=r.home;return r;}
act({kind:'arrival',event:'enter'});assert.equal(h.arrival,'shack');
assert(!C.propose(h,{branches:25},{kind:'arrival',event:'desk'}).ok,'a desk shortcut does not finish the outside tour');
act({kind:'arrival',event:'outside'});h=C.normalize(JSON.parse(JSON.stringify(h)));assert.equal(h.arrival,'outside');
act({kind:'arrival',event:'desk'});assert.equal(h.arrival,'done');
act({kind:'arrival',event:'enter'});assert.equal(h.arrival,'done','the opening never replays after completion');
act({kind:'anchor',lat:54,lon:-2,source:'initial',expectedRevision:0});
const location={kind:'build-home',lat:54.005,lon:-2.004,expectedRevision:1},old=JSON.stringify(h);
for(const action of [{...location,expectedRevision:0},{...location,lat:NaN},{...location,lon:181}])assert(!C.propose(h,{branches:25},action).ok);
assert(!C.propose(h,{branches:24},location).ok);assert.equal(JSON.stringify(h),old,'failed proposals preserve the whole shelter');
const built=act(location);assert.equal(built.wallet.branches,0);assert.equal(h.tier,1);assert.equal(h.anchor.lat,location.lat);assert.equal(h.anchor.lon,location.lon);assert.equal(h.anchor.revision,2);
assert(!C.propose(h,{branches:1000},location).ok,'a repeated build cannot pay twice or move the permanent house');
assert.deepEqual(C.normalize(JSON.parse(JSON.stringify(h))),h,'new home and location survive restart');
const legacy={...h};delete legacy.outlook;assert(!C.normalize(legacy).outlook);assert.equal(C.visibleTrees(C.normalize(legacy)).length,0,'old gardens lose their ring of trees too');
assert.equal(C.visibleTrees(h).length,0,'a new shelter has no trees round its plot');
const world=C.world(h,'yard',Date.now(),{connected:true});assert(world.allowed(0,16));assert(!world.allowed(-10,24),'pond is not walkable ground');assert(!world.allowed(7,18),'outlook boulder has collision');assert(world.allowed(0,40),'no finite map rim after the clearing');
// Test the actual durable adapter, including failed-write identity restoration.
const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),start=html.indexOf('function commitPlayerHomeAction('),end=html.indexOf('\nfunction anchorPlayerHomeAt(',start);
const original=C.normalize(JSON.parse(old)),journey={pose:{lat:54,lon:-2}},gameState={playerHome:original,player:{branches:25},worldJourney:journey};let fail=true;
const ctx={BurbzPlayerHomeCore:C,gameState,durableSaveState:()=>({ok:!fail}),updateHeader(){},refreshGeographicAvatarMarker(){}};
vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
assert(!ctx.commitPlayerHomeAction(location).ok);assert.equal(gameState.playerHome,original);assert.equal(gameState.worldJourney,journey);assert.equal(gameState.player.branches,25);
fail=false;assert(ctx.commitPlayerHomeAction(location).ok);assert.equal(gameState.playerHome.anchor.lat,location.lat);assert.equal(gameState.player.branches,0);assert.equal(gameState.worldJourney,null);assert(!ctx.commitPlayerHomeAction(location).ok);
console.log('Shelter: ordered resumable tour, explicit current location, cost/duplicate/stale guards, durable rollback, garden migration and scenic collision pass.');
