"""Yaan's ask (2026-08-24), pinned as `nav-action-badges-v312-20260824`:

> "When the player gets the little red notifications on the buttons at the
> bottom (like when a quest is complete), can you also have notifications on
> the kitchen icon if a bird needs feeding, the forge icon if there are enough
> materials to forge something, the empire icon if a building is complete.
> Plus any other notifications you can think of that keep the gameplay going
> and keep the player playing."

Three named dots, three more that follow the same rule, and one plumbing fix
that made them all possible:

1. **The walker reaches the dock pop-ups.** Kitchen, Hospital and Training
   open a sheet rather than a screen, so they carry `data-quick-destination`
   instead of `data-screen` and the shared badge walker used to skip them.
   `applyActionBadges` now keys off either attribute, which retires the
   hand-rolled `updateTrainingDockBadge`.

2. **Kitchen** — birds gone Hungry, Merlin included, but only while the
   kitchen actually holds food. A dot you cannot act on is noise.

3. **Forge** — commissions ready to collect (already there) plus gear the
   stores can pay for right now. Only pieces the player does not own and has
   not queued count, so the dot means "something new is within reach" rather
   than "you still own materials".

4. **Empire** — taxes waiting (already there) plus buildings that have
   finished: projects past their clock, town halls past theirs, and the
   corner cards a finished build leaves behind until the player looks.

5. **Hospital** — birds under half health who are not already in a bed.

6. **Stores** — spare kit an empty slot could take, counted once per piece
   rather than once per bird.

Every count clears the moment the player acts on it. That is the rule the
suite guards: a badge is a promise that something is waiting.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
BADGE_CORE = ROOT / "action_badge_core.js"
LOOT_CORE = ROOT / "loot_crafting_core.js"
HUNGER_CORE = ROOT / "bird_diet_hunger_core.js"
UPDATER = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"

# This release's own segment and the badge core's cache pin. Both stay put
# while the head build moves on — a core pin never tracks CURRENT_BUILD.
OWN_RELEASE_PIN = "nav-action-badges-v312-20260824"
PREVIOUS_RELEASE_PIN = "village-work-huts-v311-20260824"
CURRENT_BUILD = "forge-opens-on-the-anvil-v323-20260825"


def run_node(source: str):
    result = subprocess.run(
        ["node", "-e", source],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(source: str, name: str) -> str:
    start = source.index(f"function {name}(")
    end = source.find("\nfunction ", start + 10)
    if end == -1:
        end = len(source)
    return source[start:end]


def html_text() -> str:
    return HTML.read_text(encoding="utf-8")


# A DOM small enough to hold in your head, big enough for the walker: it uses
# querySelectorAll, getAttribute, classList, appendChild and querySelector.
FAKE_DOM = """
function el(attrs) {
  const node = {
    attrs: Object.assign({}, attrs),
    children: [],
    classes: new Set(),
    getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    querySelector(sel) {
      const want = sel.replace('.', '');
      return this.children.find(c => String(c.className || '').split(' ').includes(want)) || null;
    },
    remove() {
      if (!this.parentNode) return;
      this.parentNode.children = this.parentNode.children.filter(c => c !== this);
      this.parentNode = null;
    }
  };
  node.classList = {
    add: name => node.classes.add(name),
    remove: name => node.classes.delete(name),
    has: name => node.classes.has(name)
  };
  node.ownerDocument = { createElement: () => el({}) };
  return node;
}
function dom(items) {
  return {
    items,
    ownerDocument: { createElement: () => el({}) },
    querySelectorAll(selector) {
      const parts = selector.split(',').map(s => s.trim());
      return items.filter(item => parts.some(part =>
        part === '[data-quick-destination]'
          ? item.getAttribute('data-quick-destination') != null
          : item.getAttribute('data-screen') != null && item.getAttribute('data-game-route') != null));
    }
  };
}
function badgeOf(item) {
  const badge = item.querySelector('.nav-action-badge');
  return badge ? badge.textContent : null;
}
"""


# ---------------------------------------------------------------------------
# 1. The walker reaches the dock pop-ups
# ---------------------------------------------------------------------------

def test_the_dock_popups_are_still_keyed_by_destination():
    html = html_text()
    nav = html.split('id="bottomDock"')[1].split("</nav>")[0]
    for destination in ("kitchen", "training", "hospital"):
        assert f'data-quick-destination="{destination}"' in nav


def test_the_badge_core_walks_both_kinds_of_button():
    core = BADGE_CORE.read_text(encoding="utf-8")
    assert "[data-game-route][data-screen],[data-quick-destination]" in core
    assert "item.getAttribute('data-quick-destination') || item.getAttribute('data-screen')" in core


def test_a_popup_button_gets_the_same_badge_a_routed_tab_gets():
    result = run_node(
        f"""
const core = require({json.dumps(str(BADGE_CORE))});
{FAKE_DOM}
const kitchen = el({{ 'data-quick-destination':'kitchen', 'aria-label':'Kitchen & Pantry' }});
const forge = el({{ 'data-game-route':'', 'data-screen':'forge', 'aria-label':"Blacksmith's forge" }});
const root = dom([kitchen, forge]);
core.applyActionBadges(root, {{ kitchen:2, forge:1 }});
const lit = {{
  kitchen: badgeOf(kitchen),
  forge: badgeOf(forge),
  kitchenLabel: kitchen.getAttribute('aria-label'),
  kitchenClass: kitchen.classList.has('has-action')
}};
// Feed the bird: the dot must leave and take the label with it.
core.applyActionBadges(root, {{ kitchen:0, forge:1 }});
process.stdout.write(JSON.stringify({{
  lit,
  cleared: badgeOf(kitchen),
  clearedLabel: kitchen.getAttribute('aria-label'),
  clearedClass: kitchen.classList.has('has-action'),
  forgeStays: badgeOf(forge)
}}));
"""
    )
    assert result["lit"]["kitchen"] == "2"
    assert result["lit"]["forge"] == "1"
    assert result["lit"]["kitchenClass"] is True
    assert "Kitchen & Pantry" in result["lit"]["kitchenLabel"]
    assert result["cleared"] is None
    assert result["clearedLabel"] == "Kitchen & Pantry"  # base label restored
    assert result["clearedClass"] is False
    assert result["forgeStays"] == "1"


def test_the_hand_rolled_training_badge_is_retired():
    html = html_text()
    assert "function updateTrainingDockBadge()" not in html
    assert "training-ready-badge" not in html
    assert "training: trainingCount" in function_source(html, "normalizeActionBadgeState")


def test_every_new_destination_is_a_known_screen():
    counts = run_node(
        f"""
const core = require({json.dumps(str(BADGE_CORE))});
process.stdout.write(JSON.stringify(core.computeActionBadgeCounts({{
  kitchen: 2, hospital: 1, training: 3, inventory: 4
}})));
"""
    )
    assert counts["kitchen"] == 2
    assert counts["hospital"] == 1
    assert counts["training"] == 3
    assert counts["inventory"] == 4


def test_a_screen_reader_hears_what_is_waiting_not_just_a_number():
    html = html_text()
    words = html[html.index("const ACTION_BADGE_WORDS"):html.index("};", html.index("const ACTION_BADGE_WORDS"))]
    assert "'bird to feed', 'birds to feed'" in words
    assert "'bird to treat', 'birds to treat'" in words
    assert "formatActionText: actionBadgeText" in html


# ---------------------------------------------------------------------------
# 2. Kitchen — a bird needs feeding
# ---------------------------------------------------------------------------

def test_kitchen_counts_hungry_birds_and_merlin():
    src = function_source(html_text(), "kitchenBirdsNeedingFood")
    helpers = "\n".join([
        function_source(html_text(), "badgeHungerWarns"),
        function_source(html_text(), "kitchenHoldsFood"),
    ])
    result = run_node(
        f"""
const hungerCore = require({json.dumps(str(HUNGER_CORE))});
const dietHungerCore = () => hungerCore;
let gameState;
{helpers}
{src}
const now = Date.UTC(2026, 7, 24, 12, 0, 0);
const bird = (hunger) => ({{ id:'b' + hunger, care:{{ hunger, happiness:80, lastHungerAt:now }} }});
const withFood = flock => ({{ flock, pantry:{{ seeds:3 }}, inventory:{{ larder:{{}} }} }});
const out = {{}};
gameState = withFood([bird(10), bird(50)]);            // fed and peckish
out.quietWhenFed = kitchenBirdsNeedingFood(now);
gameState = withFood([bird(75), bird(90), bird(20)]);  // hungry and urgent
out.hungryAndUrgent = kitchenBirdsNeedingFood(now);
gameState = withFood([bird(75)]);
gameState.merlinCare = {{ hunger:88, happiness:60, lastHungerAt:now }};
out.merlinCounts = kitchenBirdsNeedingFood(now);
gameState = {{ flock:[bird(90)], pantry:{{ seeds:0 }}, inventory:{{ larder:{{}} }} }};
out.bareKitchenStaysQuiet = kitchenBirdsNeedingFood(now);
gameState = {{ flock:[bird(90)], pantry:{{}}, inventory:{{ larder:{{ vole:1 }} }} }};
out.larderAloneIsEnough = kitchenBirdsNeedingFood(now);
process.stdout.write(JSON.stringify(out));
"""
    )
    assert result["quietWhenFed"] == 0
    assert result["hungryAndUrgent"] == 2
    assert result["merlinCounts"] == 2
    assert result["bareKitchenStaysQuiet"] == 0
    assert result["larderAloneIsEnough"] == 1


def test_kitchen_reads_hunger_the_way_the_gauges_do():
    """Hunger climbs while the app is closed, so the badge projects it too."""
    src = function_source(html_text(), "kitchenBirdsNeedingFood")
    helpers = "\n".join([
        function_source(html_text(), "badgeHungerWarns"),
        function_source(html_text(), "kitchenHoldsFood"),
    ])
    result = run_node(
        f"""
const hungerCore = require({json.dumps(str(HUNGER_CORE))});
const dietHungerCore = () => hungerCore;
let gameState;
{helpers}
{src}
const fed = Date.UTC(2026, 7, 24, 0, 0, 0);
const care = {{ hunger:20, happiness:80, lastHungerAt:fed }};
gameState = {{ flock:[{{ id:'b1', care }}], pantry:{{ seeds:2 }}, inventory:{{ larder:{{}} }} }};
process.stdout.write(JSON.stringify({{
  justFed: kitchenBirdsNeedingFood(fed),
  aDayLater: kitchenBirdsNeedingFood(fed + 24 * 60 * 60 * 1000),
  careUntouched: care.hunger
}}));
"""
    )
    assert result["justFed"] == 0
    assert result["aDayLater"] == 1
    assert result["careUntouched"] == 20  # counting never rewrites the save


# ---------------------------------------------------------------------------
# 3. Forge — enough materials to make something
# ---------------------------------------------------------------------------

def test_forge_badge_adds_craftable_gear_to_ready_commissions():
    counts = run_node(
        f"""
const core = require({json.dumps(str(BADGE_CORE))});
process.stdout.write(JSON.stringify([
  core.computeActionBadgeCounts({{ forge: 2, forgeCraftable: 3 }}).forge,
  core.computeActionBadgeCounts({{ forgeCraftable: 1 }}).forge,
  core.computeActionBadgeCounts({{ forge: 2 }}).forge,
  core.computeActionBadgeCounts({{}}).forge,
]));
"""
    )
    assert counts == [5, 1, 2, 0]


def test_forge_counts_only_new_gear_the_stores_can_pay_for():
    src = function_source(html_text(), "forgeCraftableNow")
    result = run_node(
        f"""
const L = require({json.dumps(str(LOOT_CORE))});
const lootCore = () => L;
let gameState, jobs = [];
const ensureForgeJobs = () => jobs;
const forgeQueueIsFull = () => jobs.length >= L.FORGE_MAX_JOBS;
const burbzForgeLevel = () => 1;
{src}
// Thorn Talons want 2 iron grit and 20 coins; nothing else common uses grit.
const base = mats => ({{
  player:{{ coins: 20 }},
  inventory:{{ items: mats, gear:{{}}, equipment:{{}} }}
}});
const out = {{}};
gameState = base({{}});
out.nothingToMakeWithBareStores = forgeCraftableNow();
gameState = base({{ iron_grit: 2 }});
out.gritBuysTalons = forgeCraftableNow();
gameState = base({{ iron_grit: 2 }});
gameState.player.coins = 5;
out.coinsShortStaysQuiet = forgeCraftableNow();
gameState = base({{ iron_grit: 2 }});
gameState.inventory.gear.thorn_talons = 1;
out.alreadyOwnedDoesNotCount = forgeCraftableNow();
gameState = base({{ iron_grit: 2 }});
gameState.inventory.equipment = {{ bird1: {{ weapon:'thorn_talons' }} }};
out.alreadyWornDoesNotCount = forgeCraftableNow();
gameState = base({{ iron_grit: 2 }});
jobs = [{{ gearId:'thorn_talons' }}];
out.onTheAnvilDoesNotCount = forgeCraftableNow();
jobs = [{{ gearId:'a' }}, {{ gearId:'b' }}, {{ gearId:'c' }}];
gameState = base({{ iron_grit: 2 }});
out.fullAnvilStaysQuiet = forgeCraftableNow();
process.stdout.write(JSON.stringify(out));
"""
    )
    assert result["nothingToMakeWithBareStores"] == 0
    assert result["gritBuysTalons"] == 1
    assert result["coinsShortStaysQuiet"] == 0
    assert result["alreadyOwnedDoesNotCount"] == 0
    assert result["alreadyWornDoesNotCount"] == 0
    assert result["onTheAnvilDoesNotCount"] == 0
    assert result["fullAnvilStaysQuiet"] == 0


def test_forge_respects_the_forge_level_gate():
    """A full storeroom still cannot buy gear the anvil is too cold to make."""
    src = function_source(html_text(), "forgeCraftableNow")
    result = run_node(
        f"""
const L = require({json.dumps(str(LOOT_CORE))});
const lootCore = () => L;
let gameState, level = 1;
const ensureForgeJobs = () => [];
const forgeQueueIsFull = () => false;
const burbzForgeLevel = () => level;
{src}
// Stock every material and every coin: only the level gate can hold gear back.
const stock = {{}};
Object.keys(L.MATERIALS).forEach(id => {{ stock[id] = 999; }});
gameState = {{ player:{{ coins: 999999 }}, inventory:{{ items: stock, gear:{{}}, equipment:{{}} }} }};
level = 1;
const cold = forgeCraftableNow();
level = L.FORGE_MAX_LEVEL;
const summit = forgeCraftableNow();
process.stdout.write(JSON.stringify({{ cold, summit, catalogue: Object.keys(L.GEAR).length }}));
"""
    )
    assert 0 < result["cold"] < result["summit"]
    assert result["summit"] == result["catalogue"]  # the top forge can make it all


# ---------------------------------------------------------------------------
# 4. Empire — a building is complete
# ---------------------------------------------------------------------------

def test_empire_badge_adds_finished_buildings_to_waiting_taxes():
    counts = run_node(
        f"""
const core = require({json.dumps(str(BADGE_CORE))});
process.stdout.write(JSON.stringify([
  core.computeActionBadgeCounts({{ village: 2, buildingsComplete: 1 }}).village,
  core.computeActionBadgeCounts({{ buildingsComplete: 2 }}).village,
  core.computeActionBadgeCounts({{ village: 3 }}).village,
  core.computeActionBadgeCounts({{}}).village,
]));
"""
    )
    assert counts == [3, 2, 3, 0]


def test_empire_counts_projects_halls_and_the_cards_they_leave():
    src = function_source(html_text(), "empireBuildingsComplete")
    result = run_node(
        f"""
let villages = [], towns = [], notices = [];
const empireVillages = () => villages;
const villageConstructions = rec => rec.constructions || [];
const empireSettlementsInfo = () => ({{ towns }});
const ensureTownSeatState = seat => seat.state;
let gameState;
{src}
const now = 1_000_000;
const out = {{}};
const set = () => {{ gameState = {{ completionNotices: notices }}; }};
villages = [{{ constructions:[{{ endMs: now + 5000 }}] }}]; towns = []; notices = []; set();
out.stillBuilding = empireBuildingsComplete(now);
villages = [{{ constructions:[{{ endMs: now - 1 }}, {{ endMs: now + 5000 }}] }}]; set();
out.oneProjectDone = empireBuildingsComplete(now);
villages = []; towns = [{{ state:{{ hallConstruction:{{ endMs: now - 1 }} }} }}]; set();
out.hallCounts = empireBuildingsComplete(now);
towns = [];
notices = [
  {{ kind:'empire-building' }},
  {{ kind:'empire-building' }},
  {{ kind:'quest' }}
];
set();
out.cardsCarryTheNews = empireBuildingsComplete(now);
notices = []; set();
out.dismissedCardsClearIt = empireBuildingsComplete(now);
process.stdout.write(JSON.stringify(out));
"""
    )
    assert result["stillBuilding"] == 0
    assert result["oneProjectDone"] == 1
    assert result["hallCounts"] == 1
    assert result["cardsCarryTheNews"] == 2
    assert result["dismissedCardsClearIt"] == 0


# ---------------------------------------------------------------------------
# 5 & 6. Hospital and Stores
# ---------------------------------------------------------------------------

def test_hospital_counts_the_badly_hurt_who_have_no_bed():
    src = function_source(html_text(), "hospitalPatientsWaiting")
    result = run_node(
        f"""
const HOSPITAL_BADGE_HURT_RATIO = 0.5;
let built = true, posted = [], questing = [], drilling = [];
const isAcademyRoomBuilt = room => built;
const birdAssignedPost = id => posted.includes(id);
const birdHasActiveExpedition = id => questing.includes(id);
const birdHasActiveTraining = id => drilling.includes(id);
let gameState;
{src}
const bird = (id, hp, room) => ({{ id, hp, maxHp:100, academy:{{ room: room || 'outdoors' }} }});
const out = {{}};
gameState = {{ flock:[bird('a', 100), bird('b', 80)] }};
out.scratchesDoNotCount = hospitalPatientsWaiting();
gameState = {{ flock:[bird('a', 20), bird('b', 45), bird('c', 90)] }};
out.badlyHurtCount = hospitalPatientsWaiting();
gameState = {{ flock:[bird('a', 20, 'hospital')] }};
out.alreadyInBedDoesNotCount = hospitalPatientsWaiting();
gameState = {{ flock:[bird('a', 20)] }};
posted = ['a'];
out.workingBirdKeepsItsPost = hospitalPatientsWaiting();
posted = []; questing = ['a'];
out.questingBirdKeepsItsClock = hospitalPatientsWaiting();
questing = []; drilling = ['a'];
out.drillingBirdKeepsItsClock = hospitalPatientsWaiting();
drilling = []; built = false;
out.noWardNoDot = hospitalPatientsWaiting();
built = true;
gameState = {{ flock:[{{ id:'a', maxHp:100, academy:{{ room:'outdoors' }} }}] }};
out.missingHpReadsAsHale = hospitalPatientsWaiting();
process.stdout.write(JSON.stringify(out));
"""
    )
    assert result["scratchesDoNotCount"] == 0
    assert result["badlyHurtCount"] == 2
    assert result["alreadyInBedDoesNotCount"] == 0
    assert result["workingBirdKeepsItsPost"] == 0
    assert result["questingBirdKeepsItsClock"] == 0
    assert result["drillingBirdKeepsItsClock"] == 0
    assert result["noWardNoDot"] == 0
    assert result["missingHpReadsAsHale"] == 0


def test_stores_counts_spare_kit_once_not_once_per_bird():
    src = function_source(html_text(), "storesGearWaitingToEquip")
    result = run_node(
        f"""
const L = require({json.dumps(str(LOOT_CORE))});
const lootCore = () => L;
let gameState;
{src}
const state = (flock, gear, equipment) => ({{
  flock, inventory:{{ gear, equipment: equipment || {{}} }}
}});
const out = {{}};
gameState = state([{{ id:'a' }}, {{ id:'b' }}, {{ id:'c' }}], {{ thorn_talons: 1 }});
out.oneSpareIsOneDot = storesGearWaitingToEquip();
gameState = state([{{ id:'a' }}, {{ id:'b' }}], {{ thorn_talons: 2 }});
out.twoSparesTwoDots = storesGearWaitingToEquip();
gameState = state([{{ id:'a' }}], {{ thorn_talons: 5 }});
out.cappedByFreeSlots = storesGearWaitingToEquip();
gameState = state([{{ id:'a' }}], {{ thorn_talons: 1 }}, {{ a:{{ weapon:'willow_wand' }} }});
out.filledSlotStaysQuiet = storesGearWaitingToEquip();
gameState = state([], {{ thorn_talons: 3 }});
out.noFlockNoDot = storesGearWaitingToEquip();
gameState = state([{{ id:'a' }}], {{}});
out.emptyArmouryNoDot = storesGearWaitingToEquip();
process.stdout.write(JSON.stringify(out));
"""
    )
    assert result["oneSpareIsOneDot"] == 1
    assert result["twoSparesTwoDots"] == 2
    assert result["cappedByFreeSlots"] == 1
    assert result["filledSlotStaysQuiet"] == 0
    assert result["noFlockNoDot"] == 0
    assert result["emptyArmouryNoDot"] == 0


# ---------------------------------------------------------------------------
# The heartbeat: one broken save must never blank the whole dock
# ---------------------------------------------------------------------------

def test_every_new_count_is_wrapped_so_one_failure_cannot_blank_the_dock():
    src = function_source(html_text(), "normalizeActionBadgeState")
    for var, call, key in (
        ("forgeCraftableCount", "forgeCraftableNow()", "forgeCraftable: forgeCraftableCount"),
        ("buildingsCompleteCount", "empireBuildingsComplete(now)", "buildingsComplete: buildingsCompleteCount"),
        ("kitchenCount", "kitchenBirdsNeedingFood(now)", "kitchen: kitchenCount"),
        ("hospitalCount", "hospitalPatientsWaiting()", "hospital: hospitalCount"),
        ("storesCount", "storesGearWaitingToEquip()", "inventory: storesCount"),
        ("trainingCount", "trainingHubSessions()", "training: trainingCount"),
    ):
        assert f"let {var} = 0;" in src           # a broken helper contributes nothing
        assert f"try {{ {var} = {call}" in src
        assert key in src


# ---------------------------------------------------------------------------
# Release plumbing
# ---------------------------------------------------------------------------

def test_release_is_versioned_and_the_badge_core_pin_moved():
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line       # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    # The badge core changed, so its pin moved everywhere at once.
    pin = f"action_badge_core.js?v={OWN_RELEASE_PIN}"
    assert f'<script src="{pin}"></script>' in html
    assert sw.count(f"'./{pin}'") == 2
    assert "action_badge_core.js?v=battle-progression-fixes-v286-20260819" not in html
    assert "action_badge_core.js?v=battle-progression-fixes-v286-20260819" not in sw
    assert '"action_badge_core.js"' in UPDATER.read_text(encoding="utf-8")
