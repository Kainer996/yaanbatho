"""The Head Chef feeds the whole species at once.

Three player asks, pinned together because they ship together:

1. **Bulk feeding.** With a Head Chef appointed to the Kitchen & Pantry,
   serving one companion plates the same food for every flock-mate of the
   same species in the same sitting — one tap instead of one per duplicate
   bird. Each extra bird still eats one ingredient, birds already full are
   skipped so nothing is wasted, and service stops when the stores run dry.
   No chef → nobody is bulk-served, exactly as before.
2. **The tutorial tip.** The perk is taught the moment it is earned: the
   instant a bird is appointed Head Chef, a dismissable tip explains the
   whole-species table service.
3. **The chef is visibly in the room.** The appointed bird's transparent
   cutout (never the framed painting) stands on the Kitchen room stage like a
   sprite, with a nameplate, so the chef looks genuinely at work.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
ROLES_CORE = ROOT / "bird_roles_core.js"
RELEASE_PIN = "roost-retired-v302-20260820"
CURRENT_BUILD = "village-chain-v307-20260821"
PREVIOUS_RELEASE_PIN = "chef-bulk-feeding-v202-20260802"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


# ---------------------------------------------------------------------------
# 1. The planning maths lives in the roles core, pure and Node-testable
# ---------------------------------------------------------------------------

def test_chef_service_plan_feeds_the_hungry_skips_the_full_and_stops_at_the_stores():
    out = run_node(
        """
        const roles = require('./bird_roles_core.js');
        const rows = [
          { key:'b', hunger:80 },
          { key:'c', hunger:0 },   // already full — nothing is wasted on it
          { key:'d', hunger:60 }
        ];
        console.log(JSON.stringify({
          unstaffed: roles.chefServicePlan(false, rows, 5),
          plenty: roles.chefServicePlan(true, rows, 5),
          short: roles.chefServicePlan(true, rows, 1),
          empty: roles.chefServicePlan(true, rows, 0)
        }));
        """
    )
    # No chef → no plan: the old one-bird-at-a-time game is untouched.
    assert out["unstaffed"] == {"fed": [], "alreadyFull": [], "shortBy": 0}
    # A staffed kitchen feeds every hungry flock-mate, and only those.
    assert out["plenty"]["fed"] == ["b", "d"]
    assert out["plenty"]["alreadyFull"] == ["c"]
    assert out["plenty"]["shortBy"] == 0
    # The stores are the limit: one serving in stock feeds one bird and the
    # plan says honestly how many went short.
    assert out["short"]["fed"] == ["b"] and out["short"]["shortBy"] == 1
    assert out["empty"]["fed"] == [] and out["empty"]["shortBy"] == 2


def test_the_head_chef_role_card_advertises_the_perk():
    out = run_node(
        """
        const roles = require('./bird_roles_core.js');
        console.log(JSON.stringify({ copy: roles.roleById('head_chef').effect.copy }));
        """
    )
    assert "same species" in out["copy"]


# ---------------------------------------------------------------------------
# 2. One tap really feeds the whole species (the real feeding transaction)
# ---------------------------------------------------------------------------

BULK_FEED_HARNESS = r"""
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
function fnSrc(name) {
  const start = html.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = html.indexOf('{', start), depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) break; }
  }
  return html.slice(start, i + 1);
}
global.window = global;
require('./kitchen_pantry_core.js');
require('./bird_diet_hunger_core.js');
require('./bird_roles_core.js');
const toasts = [];
const bursts = [];
const notes = [];
global.setTimeout = fn => { fn(); return 0; }; // chef summary toast lands synchronously
global.showToast = m => toasts.push(m);
global.SFX = { tap(){}, capture(){}, victory(){} };
global.vibrate = () => {};
global.saveState = () => {};
global.escapeHtml = s => String(s == null ? '' : s);
global.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
global.speciesKey = n => String(n || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
global.canonicalSpeciesName = n => String(n || '').split('(')[0].trim();
global.birdOnlyImgHTML = () => '<span class="art">B</span>';
global.birdDisplayName = b => (b && (b.commonName || b.species)) || 'Bird';
global.kitchenIngredientById = id => global.BurbzKitchenCore.ingredientById(id);
global.kitchenCore = () => global.BurbzKitchenCore;
global.kitchenDietCore = () => global.BurbzDietHungerCore;
global.dietHungerCore = () => global.BurbzDietHungerCore;
global.hungerStatusForBird = b => global.BurbzDietHungerCore.hungerStatusForCare(b && b.care, Date.now());
global.inferBirdDiet = () => ({ pref:['fruit_berries'], ok:[], avoid:[], fact:'' });
global.academyBirdById = id => gameState.flock.find(b => b.id === id) || null;
global.ensureBirdAcademy = b => {
  b.academy = b.academy || { room:'outdoors' };
  b.training = b.training || { feedCount:0, trainCount:0 };
};
global.getMerlinCare = () => gameState.merlinCare;
global.MERLIN_CORE = { grantMerlinBondXp: c => c, sanitizeMerlinCare: c => c };
global.birdHasActiveExpedition = () => false;
global.birdHasActiveTraining = () => false;
global.academyRoleMultiplier = () => 1;
global.ensureEmpireState = () => ({ dormantRegionWardens:{} });
global.empireRegionForLegacyId = () => null;
global.refillPantry = () => {};
global.updateQuestProgress = () => {};
global.grantBirdBondXp = () => {}; // bird-bond-love-v256: feeding also deepens the bond
global.birdBondCore = () => null;
global.applyPlayerXpState = n => { gameState.player.xp += n; };
global.levelUpBird = (b, xp) => { b.xp = (b.xp || 0) + xp; };
global.recalcBirdPower = () => {};
global.addCoins = n => { gameState.player.coins += n; };
global.discoveredSpeciesRecords = () => [];
global.createBirdFromDiscovery = () => null;
global.RARITY_RECRUIT_COST = { common:150 };
global.playFeedDopamineBurst = d => bursts.push(d);
global.refreshFeedSurfaces = () => {};
global.showFeedNotePopup = (t, b) => notes.push({ title:t, body:b });
global.feedSheetKey = null;
global.FOODS = {};
const now = Date.now();
const care = hunger => ({ hunger, happiness:40, lastFed:new Date(now - 60 * 1000).toISOString(),
  lastHungerAt: now, hungerTransactions:[], hungerTransactionLog:[] });
// Waxwings live on berries, so hedgerow berries are a PRIMARY meal that fills
// each one to full — the bulk serving the Head Chef is here to demonstrate.
const thrush = (id, hunger) => ({
  id, species:'Waxwing', commonName:'Waxwing', scientificName:'Bombycilla garrulus',
  level:1, xp:0, maxHp:100, hp:100,
  academy:{ room:'outdoors', dietKnown:true }, training:{ feedCount:0, hpBonus:0 },
  care: care(hunger)
});
global.gameState = {
  player: { coins:0, xp:0, mealsServed:0 },
  flock: [
    { id:'chefbird', species:'Raven', commonName:'Raven', scientificName:'Corvus corax',
      level:5, xp:0, maxHp:120, hp:120, int:200, stamina:100,
      academy:{ room:'outdoors', dietKnown:true }, training:{ feedCount:0, hpBonus:0 }, care: care(0) },
    thrush('thrushA', 100),
    thrush('thrushB', 80),
    thrush('thrushD', 60),
    thrush('thrushFull', 0),
    { id:'robin', species:'European Robin', commonName:'European Robin', scientificName:'Erithacus rubecula',
      level:1, xp:0, maxHp:100, hp:100,
      academy:{ room:'outdoors', dietKnown:true }, training:{ feedCount:0, hpBonus:0 }, care: care(90) }
  ],
  merlinCare:{ hunger:50, happiness:80, hungerTransactions:[], hungerTransactionLog:[] },
  pantry: {},
  dietBadges: {}, kitchenNotes: {},
  discoveredSpecies: {},
  birdRoles: { academy:{ kitchen:'chefbird' }, villages:{}, regions:{} },
  kitchenLegacySupplyMigrationVersion: 1,
  inventory:{ larder:{ hedgerow_berries:2 } }
};
let code = 'let kitchenRosterTrayKey = null;\n';
const rewardsAt = html.indexOf('const FEED_MEAL_REWARDS = Object.freeze({');
code += html.slice(rewardsAt, html.indexOf('});', rewardsAt) + 3) + '\n';
for (const n of ['legacyKitchenSupplyIngredient','ensureLarder','addLarderIngredient','feedOptionVerdict',
                 'feedRewardsForVerdict','feedSideSnackExplainer','kitchenRosterEntries',
                 'kitchenRosterEntryByKey','kitchenRosterWantedPrep','kitchenRosterFoodOptions',
                 'kitchenRosterEatsLabels','kitchenRosterHungerStatus','kitchenRosterRefusalToast',
                 'feedEntryForKey','feedWildEntryForSpeciesKey','feedFoodOptions','kitchenRecordFieldNote',
                 'recordFeedReceipt','birdRolesCore','ensureRolesState','roleDefFor','rolePostState',
                 'chefBulkFeedSameSpecies','burbzFeedFood','feedWildSpecies']) code += fnSrc(n) + '\n';
code += 'module.exports = { burbzFeedFood };';
const mod = { exports: {} };
new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
const bird = id => gameState.flock.find(b => b.id === id);
// Two servings in stock. Feeding thrushA takes one; the Head Chef's service
// plates the last one for thrushB, and thrushD honestly goes short.
mod.exports.burbzFeedFood('thrushA', 'larder', 'hedgerow_berries');
console.log(JSON.stringify({
  toasts,
  berriesLeft: gameState.inventory.larder.hedgerow_berries,
  aHunger: bird('thrushA').care.hunger,
  bHunger: bird('thrushB').care.hunger,
  bXp: bird('thrushB').xp,
  dHunger: bird('thrushD').care.hunger,
  fullHunger: bird('thrushFull').care.hunger,
  robinHunger: bird('robin').care.hunger,
  robinXp: bird('robin').xp,
  mealsServed: gameState.player.mealsServed
}));
"""


def test_one_tap_feeds_every_hungry_bird_of_the_species_until_the_stores_run_dry():
    out = run_node(BULK_FEED_HARNESS)
    # The tapped bird ate, and so did its hungry flock-mate — one tap, two meals.
    assert out["aHunger"] == 0
    assert out["bHunger"] == 0
    assert out["bXp"] > 0
    assert out["berriesLeft"] == 0
    assert out["mealsServed"] == 2
    # The stores ran dry before thrushD — it stays hungry and the toast says so.
    assert out["dHunger"] > 0
    chef_toast = next(t for t in out["toasts"] if "Head Chef" in t)
    assert "Raven" in chef_toast and "1 more Waxwing fed" in chef_toast
    assert "still waiting" in chef_toast
    # The full bird and the different species are untouched.
    assert out["fullHunger"] == 0
    assert out["robinHunger"] > 0 and out["robinXp"] == 0


def test_without_a_chef_nothing_is_bulk_served():
    harness = BULK_FEED_HARNESS.replace(
        "birdRoles: { academy:{ kitchen:'chefbird' }, villages:{}, regions:{} }",
        "birdRoles: { academy:{}, villages:{}, regions:{} }",
    )
    out = run_node(harness)
    # Only the tapped bird ate; its flock-mates keep their own turn.
    assert out["aHunger"] == 0
    assert out["bHunger"] > 0 and out["bXp"] == 0
    assert out["berriesLeft"] == 1
    assert out["mealsServed"] == 1
    assert not any("Head Chef" in t for t in out["toasts"])


# ---------------------------------------------------------------------------
# 3. The tutorial tip fires the moment the chef is appointed
# ---------------------------------------------------------------------------

def test_appointing_a_head_chef_shows_the_bulk_feeding_tutorial_tip():
    html = HTML.read_text(encoding="utf-8")
    assign = function_source(html, "assignBirdRole")
    assert "key === 'kitchen'" in assign and "showChefBulkFeedTip(bird)" in assign
    tip = function_source(html, "showChefBulkFeedTip")
    # It rides the shared dismissable feed-note popup, tagged as its own note.
    assert "showFeedNotePopup(" in tip and "'chef-bulk-feed'" in tip
    assert "same species" in tip
    # The popup carries the note id so the tip is distinguishable from the
    # side-snack explainer it shares a component with.
    note = function_source(html, "showFeedNotePopup")
    assert "data-feed-note=\"' + escapeHtml(noteId || 'side-snack') + '\"" in note


def test_the_feed_surfaces_tell_the_player_about_table_service():
    html = HTML.read_text(encoding="utf-8")
    # The feed sheet names the chef and the species-wide serving.
    assert "function feedSheetChefNoticeHTML(" in html
    assert "data-chef-bulk-notice=" in html
    sheet = function_source(html, "renderFeedSheet")
    assert "feedSheetChefNoticeHTML" in sheet and "chefNotice" in sheet
    # And the Kitchen's own how-it-works fold mentions the perk.
    assert "Appoint a Head Chef above and the kitchen reorganises by food: one serving feeds every bird of the same species" in html


# ---------------------------------------------------------------------------
# 4. The chef appears calmly in the Kitchen's assigned-bird grid
# ---------------------------------------------------------------------------

def test_the_appointed_chef_is_drawn_in_the_kitchen_assignment_grid():
    html = HTML.read_text(encoding="utf-8")
    grid = function_source(html, "roomBirdGridHTML")
    # Posted room staff are included even when their home room is elsewhere,
    # using the transparent bird-only artwork rather than a wandering sprite.
    assert "rolePostState('academy', room)" in grid
    assert "post.staffed && post.bird" in grid
    assert "birdOnlyImgHTML(bird, 'room-bird-grid-art')" in grid
    assert "entry.role" in grid
    render = function_source(html, "renderAcademyRoomInterior")
    assert "roomBirdGridHTML(stageBirds, room)" in render
    assert "kitchenChefSpriteHTML(room)" not in render
    assert ".room-bird-grid { position:absolute;" in html
    assert ".room-bird-grid-art" in html and "object-fit:contain" in html


# ---------------------------------------------------------------------------
# 5. Release plumbing
# ---------------------------------------------------------------------------

def test_release_is_versioned_for_service_worker_self_update():
    sw = SW.read_text(encoding="utf-8")
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE = "))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML.read_text(encoding="utf-8")
    # The edited roles core ships under the new tag everywhere it is loaded.
    assert f"'./bird_roles_core.js?v={RELEASE_PIN}'" in sw
    assert f'src="bird_roles_core.js?v={RELEASE_PIN}"' in HTML.read_text(encoding="utf-8")
