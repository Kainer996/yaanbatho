"""The Twenty Roads: twenty shared walking tales, the same for every player.

Every real-world walking quest now carries the next untold tale of a fixed
20-quest campaign (walking_story_core.js). Tales are sized to the walk
(stroll / ramble / trek), told by named NPCs with dialogue at the trailhead,
mid-route and the banner, hide one Feathered Folio lore scroll each (Academy
and Empire canon, Bethesda-book style), and pay real catalogue gear,
materials and bird-study scrolls on first completion.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
STORY_PATH = ROOT / "STORY.md"
UPDATER_PATH = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"
OWN_RELEASE_PIN = "walking-story-quests-v249-20260811"
# The core itself moved again with mercy-streak-attack-preview-v287, then with
# release-polish-v342 (the charter ladder now climbs village -> town -> county).
CORE_PIN = "release-polish-v342-20260901"
PREVIOUS_RELEASE_PIN = "conquest-world-levels-v248-20260811"
CURRENT_BUILD = "alderwing-living-settlements-v348-20260904"


def run_node(script: str):
    run = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert run.returncode == 0, run.stderr
    return json.loads(run.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def test_the_campaign_is_twenty_valid_tales_with_real_rewards():
    out = run_node("""
const W = require('./walking_story_core.js');
const L = require('./loot_crafting_core.js');
const BAG_ITEMS = ['xp_scroll_minor', 'xp_scroll_greater'];
const totals = W.validateWalkingStories({
  gearExists: id => !!L.gearById(id),
  materialExists: id => !!L.materialById(id),
  itemExists: id => BAG_ITEMS.includes(id)
});
const rarities = W.WALKING_STORIES.map(s => {
  const ids = Object.keys(s.reward.gear);
  return Math.max(...ids.map(id => ['common','uncommon','rare','epic','legendary'].indexOf(L.gearById(id).rarity)));
});
console.log(JSON.stringify({
  totals,
  tiers: { stroll: W.WALKING_STORIES.filter(s => s.tier === 'stroll').length,
           ramble: W.WALKING_STORIES.filter(s => s.tier === 'ramble').length,
           trek: W.WALKING_STORIES.filter(s => s.tier === 'trek').length },
  finale: W.WALKING_STORIES.find(s => s.order === 20),
  maxEarlyRarity: Math.max(...rarities.slice(0, 5)),
  finaleRarity: rarities[19]
}));
""")
    assert out["totals"]["stories"] == 20
    assert out["totals"]["gearCount"] >= 20
    assert out["tiers"]["stroll"] + out["tiers"]["ramble"] + out["tiers"]["trek"] == 20
    assert min(out["tiers"].values()) >= 5, "every walk size carries a real share of the campaign"
    # The rewards genuinely escalate: no epics in the opening tales, a
    # legendary (Heart of the Sky) plus a phoenix ember at the finale.
    assert out["maxEarlyRarity"] <= 2
    assert out["finaleRarity"] == 4
    assert out["finale"]["reward"]["materials"].get("phoenix_ember") == 1
    assert "Merlin" in out["finale"]["scroll"]["title"]


def test_scrolls_tie_the_roads_to_the_empire_and_academy_canon():
    out = run_node("""
const W = require('./walking_story_core.js');
console.log(JSON.stringify(W.WALKING_STORIES.map(s => s.scroll.title + '\\n' + s.scroll.text)));
""")
    folio = "\n".join(out)
    # Empire canon: the feudal ladder, trade routes and the painted realm.
    for anchor in ("county", "Duchy", "Empire of the Liberated Skies", "trade route", "unity taxes"):
        assert anchor.lower() in folio.lower(), anchor
    # Academy canon: the rooms and the tree.
    for anchor in ("Academy", "Crowbar", "Kitchen", "Training Hall", "Observatory", "Fletcher"):
        assert anchor in folio, anchor
    # The usurper and Merlin bind the campaign to the main story.
    assert "usurper" in folio
    assert "spell-tablet" in folio


def test_the_same_walk_always_tells_the_same_tale_in_order():
    out = run_node("""
const W = require('./walking_story_core.js');
const strollIds = W.WALKING_STORIES.filter(s => s.tier === 'stroll').map(s => s.id);
console.log(JSON.stringify({
  tierShort: W.storyTierForLength(900),
  tierMid: W.storyTierForLength(2000),
  tierLong: W.storyTierForLength(5000),
  tierBad: W.storyTierForLength(NaN),
  firstShortA: W.nextWalkingStory(900, []).id,
  firstShortB: W.nextWalkingStory(1200, []).id,
  firstLong: W.nextWalkingStory(5200, []).id,
  second: W.nextWalkingStory(900, [W.nextWalkingStory(900, []).id]).id,
  fallback: W.nextWalkingStory(900, strollIds).id,
  fallbackTier: W.nextWalkingStory(900, strollIds).tier,
  allDone: W.nextWalkingStory(900, W.WALKING_STORIES.map(s => s.id)),
  junkIgnored: W.nextWalkingStory(900, ['not_a_story']).id,
  progress: W.walkingStoryProgress([W.WALKING_STORIES[0].id])
}));
""")
    assert out["tierShort"] == "stroll" and out["tierMid"] == "ramble" and out["tierLong"] == "trek"
    assert out["tierBad"] == "ramble"
    # Deterministic: any stroll-sized walk tells stroll tale one first.
    assert out["firstShortA"] == out["firstShortB"] == "ws01_lamplighters_round"
    assert out["firstLong"] == "ws06_beacon_on_the_far_hill"
    assert out["second"] != out["firstShortA"]
    # A tier walked dry falls through, so the campaign always completes.
    assert out["fallbackTier"] != "stroll"
    assert out["allDone"] is None
    assert out["junkIgnored"] == "ws01_lamplighters_round"
    assert out["progress"]["done"] == 1 and out["progress"]["total"] == 20


def test_story_beats_ride_existing_waymarkers_on_a_real_built_quest():
    out = run_node("""
global.window = global;
const W = require('./walking_story_core.js');
require('./quest_core.js');
const Q = window.BurbzQuestCore;
// A deterministic ~2.4km-one-way offer built by the real quest engine, long
// enough for plain flags to survive the chest conversions.
const pts = [];
for (let i = 0; i <= 40; i++) pts.push({ lat: 51.5 + i * 0.00055, lon: -1.2 });
const quest = Q.buildQuestFromOffer({ kind: 'footpath', name: 'Test Way', ref: 'w/1', points: pts }, { rand: () => 0.42, now: 1000 });
const story = W.nextWalkingStory(quest.lengthM, []);
const attached = W.attachWalkingStory(quest, story);
const plan = W.walkingStoryCheckpointPlan(quest.checkpoints);
const kinds = quest.checkpoints.map(c => c.kind);
console.log(JSON.stringify({
  lengthM: quest.lengthM,
  storyId: attached.id,
  npcRenamed: quest.npcName === attached.npcName,
  hasTexts: !!(attached.intro && attached.milestone && attached.outro && attached.scroll.text),
  kinds,
  milestoneKind: plan.milestoneAtIndex == null ? null : kinds[plan.milestoneAtIndex],
  scrollKind: plan.scrollAtIndex == null ? null : kinds[plan.scrollAtIndex],
  distinct: plan.milestoneAtIndex !== plan.scrollAtIndex,
  matchesAttach: attached.milestoneAtIndex === plan.milestoneAtIndex && attached.scrollAtIndex === plan.scrollAtIndex,
  noFlagPlan: W.walkingStoryCheckpointPlan([{kind:'npc'},{kind:'chest'},{kind:'finish'}]),
  oneFlagPlan: W.walkingStoryCheckpointPlan([{kind:'npc'},{kind:'flag'},{kind:'finish'}])
}));
""")
    # The story rides plain flags only — chest reaches are claim intents and
    # never mark reached on contact, so a beat there could be lost.
    assert out["storyId"], "a tale attaches to a real built quest"
    assert out["npcRenamed"] and out["hasTexts"] and out["matchesAttach"]
    assert out["milestoneKind"] == "flag" and out["scrollKind"] == "flag"
    assert out["distinct"]
    # No plain flag at all: the scroll waits for the finish grant instead.
    assert out["noFlagPlan"] == {"milestoneAtIndex": None, "scrollAtIndex": None}
    assert out["oneFlagPlan"]["scrollAtIndex"] == 1 and out["oneFlagPlan"]["milestoneAtIndex"] is None


def test_html_wires_the_campaign_into_the_walking_quest_lifecycle():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert f'<script src="walking_story_core.js?v={CORE_PIN}"></script>' in html
    # Attach at activation, right after the quest is built.
    activate = function_source(html, "activateWalkingQuestFromOffer")
    assert "attachStoryToNewWalkingQuest(quest)" in activate
    assert "quest.story.intro" in activate
    # State survives saves and never double-pays.
    ensure = function_source(html, "ensureWalkingStoryState")
    assert "gameState.walkingStories" in ensure
    apply_fn = function_source(html, "applyWalkingStoryCompletion")
    assert "st.completed.includes(story.id)" in apply_fn
    assert "addBirdXpItemToBag" in apply_fn
    assert "gameState.inventory.gear[id]" in apply_fn
    # Story beats ride the ordered flag events; the scroll pays +25 XP once.
    fix = function_source(html, "questOnPositionFix")
    assert "handleWalkingStoryWaymarker(quest, ev.index)" in fix
    collect = function_source(html, "collectWalkingStoryScroll")
    assert "story.scrollCollected" in collect
    assert "addPlayerXp(25)" in collect
    # Completion pays the tale and speaks the outro.
    complete = function_source(html, "completeWalkingQuest")
    assert "summary.story = applyWalkingStoryCompletion(quest)" in complete
    assert "summary.story.outro" in complete
    # The quests screen shows campaign progress and the readable folio.
    assert "The Twenty Roads" in html
    assert "The Feathered Folio" in html
    assert "openFeatheredFolioSheet" in html
    # The map focus card previews the tale a walk of that size would tell.
    assert "nextWalkingStoryForLength(walk.km * 1000)" in html


def test_release_is_versioned_and_the_new_core_is_precached_everywhere():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert sw.count(f"'./walking_story_core.js?v={CORE_PIN}'") == 2
    updater = UPDATER_PATH.read_text(encoding="utf-8")
    assert '"walking_story_core.js"' in updater
    story = STORY_PATH.read_text(encoding="utf-8")
    assert "The Twenty Roads" in story
    assert "Feathered Folio" in story
