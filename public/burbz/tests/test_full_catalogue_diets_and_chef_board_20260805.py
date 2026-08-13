"""Accurate diets for every playable bird, and the Head Chef service board.

Three player asks, shipped together as the feeding & kitchen overhaul:

1. **Accuracy.** The reported bug: feeding a Yellow-legged Gull fish was refused,
   because the gull (Larus michahellis) was not in the 951 national profiles and
   fell through to the generic "unmatched" menu that refuses fish. Every playable
   bird — the 951 profiles PLUS the ~400 catalogue birds from the UK/AU expansions
   and the BOU alias overlay — now carries a real BirdFuncDat-backed diet, matched
   exact scientific -> scientific alias -> common name -> genus -> family. So the
   gull eats fish, as it does in the wild.

2. **Omnivores eat all sorts.** A generalist's food families within reach of its
   top family are all PRIMARY (full meals), so a gull's fish, invertebrates and
   molluscs are all main meals, while a specialist keeps its single primary.

3. **The Head Chef makes feeding easy.** With a chef appointed the kitchen is laid
   out by FOOD, each course listing the birds that eat it, and one tap serves a
   food to every hungry bird that eats it — across species, until the stores run
   dry.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
DIET_JSON = ROOT / "data" / "bird-diet-records.json"
CATALOGUE_JSON = ROOT / "data" / "catalogue-species.json"


def run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=90
    )
    assert result.returncode == 0, result.stderr + "\nSTDOUT:\n" + result.stdout
    return json.loads(result.stdout)


# ---------------------------------------------------------------------------
# 1. The reported bug: the Yellow-legged Gull eats fish
# ---------------------------------------------------------------------------

def test_yellow_legged_gull_eats_fish_as_a_main_meal():
    out = run_node(
        """
require('./data/bird-diet-records.js');
const D = require('./bird_diet_hunger_core.js');
const gull = { commonName:'Yellow-legged Gull', scientificName:'Larus michahellis' };
const rec = D.getDietRecord(gull);
const verdict = id => D.scoreFoodCompatibility(gull, { ingredientId:id, prep: id==='live_minnow'?'live':(id==='sand_eel'?'live':'fresh') }).verdict;
console.log(JSON.stringify({
  method: rec && rec.matchMethod,
  primary: rec && rec.primaryCompatibleFamilies,
  minnow: verdict('live_minnow'),
  sandEel: verdict('sand_eel')
}));
"""
    )
    # It resolves to the real gull row, not the old unmatched fallback.
    assert out["method"] == "exact"
    # Fish is a MAIN meal for it — the exact thing the bug refused.
    assert out["minnow"] == "primary"
    assert out["sandEel"] == "primary"
    assert "fish" in out["primary"]


# ---------------------------------------------------------------------------
# 2. Every playable bird has a real diet — nothing falls through to "unmatched"
# ---------------------------------------------------------------------------

def test_every_catalogue_bird_resolves_to_a_source_backed_diet():
    payload = json.loads(DIET_JSON.read_text(encoding="utf-8"))
    catalogue = payload["catalogueRecords"]
    # A record exists for the gull, and for a good few hundred other birds.
    assert len(catalogue) > 300
    # No catalogue bird is left on the conservative unmatched menu.
    unmatched = [r for r in catalogue if r["matchMethod"] == "unmatched"]
    assert unmatched == [], [r["name"] for r in unmatched][:10]
    # And the drift guard records zero unresolved catalogue birds.
    assert payload["fallbacks"]["catalogueUnresolved"] == []
    assert payload["metadata"]["catalogue"]["unresolvedCount"] == 0


def test_runtime_resolves_every_catalogue_species_by_name_and_scientific():
    catalogue = json.loads(CATALOGUE_JSON.read_text(encoding="utf-8"))["species"]
    script = f"""
require('./data/bird-diet-records.js');
const D = require('./bird_diet_hunger_core.js');
const species = {json.dumps(catalogue)};
const missing = species.filter(s => !D.getDietRecord({{ commonName:s.name, scientificName:s.scientific }}));
console.log(JSON.stringify(missing.slice(0, 12).map(s => s.name)));
"""
    assert run_node(script) == []


def test_genus_fallback_lands_a_near_miss_on_its_real_relatives_diet():
    # A catalogue bird whose exact species is not in BirdFuncDat but whose genus
    # is should get a genuine genus-averaged menu, not the generic fallback.
    payload = json.loads(DIET_JSON.read_text(encoding="utf-8"))
    genus = [r for r in payload["catalogueRecords"] if r["matchMethod"] == "genus-fallback"]
    assert genus, "expected at least one genus-fallback catalogue record"
    for record in genus:
        assert record["primaryCompatibleFamilies"] or record["secondaryCompatibleFamilies"]


# ---------------------------------------------------------------------------
# 3. Omnivores eat all sorts; specialists stay narrow
# ---------------------------------------------------------------------------

def test_omnivores_have_several_main_meals_specialists_have_one():
    out = run_node(
        """
require('./data/bird-diet-records.js');
const D = require('./bird_diet_hunger_core.js');
const primary = s => (D.getDietRecord(s) || {}).primaryCompatibleFamilies || [];
console.log(JSON.stringify({
  gull: primary({ commonName:'Yellow-legged Gull', scientificName:'Larus michahellis' }),
  kingfisher: primary({ commonName:'Common Kingfisher', scientificName:'Alcedo atthis' }),
  merlin: primary({ commonName:'Merlin', scientificName:'Falco columbarius' })
}));
"""
    )
    # The gull is a generalist: several full-meal families, fish among them.
    assert len(out["gull"]) >= 3
    assert "fish" in out["gull"]
    # A fish specialist keeps a single primary.
    assert out["kingfisher"] == ["fish"]
    # And Merlin, a small-bird hunter, keeps its single primary.
    assert out["merlin"] == ["small_birds"]


# ---------------------------------------------------------------------------
# 4. The Head Chef service board: the kitchen laid out by food
# ---------------------------------------------------------------------------

def test_kitchen_ships_the_head_chef_service_board():
    html = HTML.read_text(encoding="utf-8")
    # The board and its one-tap cross-species serving exist and are wired in.
    assert "function kitchenHeadChefBoardHTML(" in html
    assert "function chefServeFoodToEveryEater(" in html
    assert "kitchenHeadChefBoardHTML()" in html  # rendered into the kitchen panel
    assert 'data-action="chef-board-serve"' in html
    assert "chefServeFoodToEveryEater," in html  # exposed for the inline onclick


CHEF_BOARD_HARNESS = r"""
const fs = require('fs');
const html = fs.readFileSync('index.html','utf8');
function fnSrc(name){
  const start=html.indexOf('function '+name+'(');
  if(start<0) throw new Error('missing '+name);
  let i=html.indexOf('{',start),depth=0;
  for(;i<html.length;i++){ if(html[i]==='{')depth++; else if(html[i]==='}'){depth--; if(depth===0)break;} }
  return html.slice(start,i+1);
}
global.window = global;
require('./kitchen_pantry_core.js');
require('./data/bird-diet-records.js');
require('./bird_diet_hunger_core.js');
require('./bird_roles_core.js');
const toasts=[];
global.setTimeout = fn => { fn(); return 0; };
global.showToast = m => toasts.push(m);
global.SFX = { tap(){}, capture(){} };
global.vibrate=()=>{};
global.saveState=()=>{};
global.escapeHtml = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
global.clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));
global.speciesKey = n => String(n||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
global.canonicalSpeciesName = n => String(n||'').split('(')[0].trim();
global.birdOnlyImgHTML = () => '<span>B</span>';
global.birdDisplayName = b => (b&&(b.commonName||b.species))||'Bird';
global.kitchenIngredientById = id => global.BurbzKitchenCore.ingredientById(id);
global.kitchenCore = () => global.BurbzKitchenCore;
global.kitchenDietCore = () => global.BurbzDietHungerCore;
global.dietHungerCore = () => global.BurbzDietHungerCore;
global.hungerStatusForBird = b => global.BurbzDietHungerCore.hungerStatusForCare(b&&b.care, Date.now());
global.inferBirdDiet = () => ({pref:[],ok:[],avoid:[],fact:''});
global.academyBirdById = id => gameState.flock.find(b=>b.id===id)||null;
global.ensureBirdAcademy = b => { b.academy=b.academy||{room:'outdoors'}; b.training=b.training||{feedCount:0}; };
global.getMerlinCare = () => gameState.merlinCare;
global.MERLIN_CORE = { grantMerlinBondXp:c=>c, sanitizeMerlinCare:c=>c };
global.birdHasActiveExpedition = () => false;
global.birdHasActiveTraining = () => false;
global.academyRoleMultiplier = () => 1;
global.refillPantry = () => {};
global.updateQuestProgress = () => {};
global.grantBirdBondXp = () => {}; // bird-bond-love-v256: feeding also deepens the bond
global.birdBondCore = () => null;
global.applyPlayerXpState = n => { gameState.player.xp += n; };
global.levelUpBird = (b,xp)=>{ b.xp=(b.xp||0)+xp; };
global.recalcBirdPower = () => {};
global.addCoins = n => { gameState.player.coins += n; };
global.discoveredSpeciesRecords = () => [];
global.rolePostState = (scope,key) => {
  const id = (gameState.birdRoles && gameState.birdRoles.academy && gameState.birdRoles.academy[key]);
  const bird = id ? gameState.flock.find(b=>b.id===id) : null;
  return { staffed: !!bird, bird, multiplier:1 };
};
global.FOODS = { seeds:{label:'Seeds',emoji:'S',desc:''}, fish:{label:'Fish',emoji:'F',desc:''} };
const now=Date.now();
const care = h => ({hunger:h,happiness:40,lastFed:new Date(now-60000).toISOString(),lastHungerAt:now,hungerTransactions:[],hungerTransactionLog:[]});
global.gameState = {
  player:{coins:0,xp:0,mealsServed:0},
  flock:[
    { id:'chef', species:'Raven', commonName:'Raven', scientificName:'Corvus corax', level:5, xp:0, maxHp:120, hp:120, academy:{room:'outdoors',dietKnown:true}, training:{feedCount:0,hpBonus:0}, care:care(0) },
    { id:'gull1', species:'Yellow-legged Gull', commonName:'Yellow-legged Gull', scientificName:'Larus michahellis', level:1, xp:0, maxHp:100, hp:100, academy:{room:'outdoors',dietKnown:true}, training:{feedCount:0,hpBonus:0}, care:care(90) },
    { id:'gull2', species:'Yellow-legged Gull', commonName:'Yellow-legged Gull', scientificName:'Larus michahellis', level:1, xp:0, maxHp:100, hp:100, academy:{room:'outdoors',dietKnown:true}, training:{feedCount:0,hpBonus:0}, care:care(70) },
    { id:'finch', species:'European Goldfinch', commonName:'European Goldfinch', scientificName:'Carduelis carduelis', level:1, xp:0, maxHp:100, hp:100, academy:{room:'outdoors',dietKnown:true}, training:{feedCount:0,hpBonus:0}, care:care(80) }
  ],
  merlinCare: care(0),
  pantry:{ seeds:5, fish:1 },
  dietBadges:{}, kitchenNotes:{},
  birdRoles:{ academy:{ kitchen:'chef' }, villages:{}, regions:{} },
  kitchenLegacySupplyMigrationVersion:1,
  inventory:{ larder:{} }
};
let code='let kitchenRosterTrayKey=null;\nconst CHEF_BOARD_HUNGRY_MIN=1;\n';
const rewardsAt=html.indexOf('const FEED_MEAL_REWARDS = Object.freeze({');
code+=html.slice(rewardsAt, html.indexOf('});',rewardsAt)+3)+'\n';
for(const n of ['legacyKitchenSupplyIngredient','ensureLarder','addLarderIngredient','feedOptionVerdict','feedRewardsForVerdict','kitchenRosterEntries','kitchenRosterEntryByKey','kitchenRosterWantedPrep','kitchenRosterFoodOptions','kitchenRosterEatsLabels','kitchenRosterHungerStatus','feedEntryForKey','feedWildEntryForSpeciesKey','feedFoodOptions','kitchenRecordFieldNote','recordFeedReceipt','kitchenAllInStockFoods','kitchenBoardEaterRows','kitchenBoardIsHungry','kitchenHeadChefBoardHTML','chefServeFoodToEveryEater']) code+=fnSrc(n)+'\n';
code+='module.exports={kitchenHeadChefBoardHTML,chefServeFoodToEveryEater};';
const mod={exports:{}};
new Function('module','exports','require',code)(mod,mod.exports,require);
global.refreshFeedSurfaces = () => {};
const F=mod.exports;
const boardHTML = F.kitchenHeadChefBoardHTML();
const gull = id => gameState.flock.find(b=>b.id===id);
const out={};
out.boardHasFishCourse = boardHTML.includes('data-chef-board-food="pantry:fish"');
out.boardListsGullUnderFish = /data-chef-board-food="pantry:fish"[\s\S]*?Yellow-legged Gull/.test(boardHTML);
// One fish in stock, two hungry gulls -> one fed, one still waiting.
F.chefServeFoodToEveryEater('pantry','fish');
out.fishLeft = gameState.pantry.fish;
out.gull1Fed = gull('gull1').care.hunger === 0;
out.gull2StillHungry = gull('gull2').care.hunger > 0;
out.fishToast = toasts[toasts.length-1];
// Seeds go to the seed-eating finch; the gulls refuse seed and are never served it.
F.chefServeFoodToEveryEater('pantry','seeds');
out.finchFed = gull('finch').care.hunger === 0;
out.gullsUnchangedBySeed = gull('gull2').care.hunger > 0;
console.log(JSON.stringify(out));
"""


def test_head_chef_serves_a_food_to_every_hungry_bird_that_eats_it():
    out = run_node(CHEF_BOARD_HARNESS)
    assert out["boardHasFishCourse"] is True
    assert out["boardListsGullUnderFish"] is True
    # One fish, two hungry gulls: one fed to full, the other left waiting.
    assert out["fishLeft"] == 0
    assert out["gull1Fed"] is True
    assert out["gull2StillHungry"] is True
    assert "still waiting" in out["fishToast"]
    # Seeds reach the finch that eats them; the gulls, which refuse seed, do not.
    assert out["finchFed"] is True
    assert out["gullsUnchangedBySeed"] is True


# ---------------------------------------------------------------------------
# 5. The generators are drift-free and reproducible
# ---------------------------------------------------------------------------

def test_catalogue_species_builder_is_drift_free():
    result = subprocess.run(
        ["node", "scripts/build_catalogue_species.js", "--check"],
        cwd=ROOT, text=True, capture_output=True, timeout=60,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_diet_generator_regenerates_without_drift():
    result = subprocess.run(
        ["python", "scripts/check_bird_diets.py", "--check"],
        cwd=ROOT, text=True, capture_output=True, timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Catalogue unresolved count: 0" in (result.stdout + result.stderr)
