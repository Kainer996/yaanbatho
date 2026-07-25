import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
DIET_CORE = ROOT / "bird_diet_hunger_core.js"
MERLIN_CORE = ROOT / "merlin_companion_core.js"
QUEST_CORE = ROOT / "quest_core.js"


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr + "\nSTDOUT:\n" + result.stdout
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    if end < 0:
      end = html.find("\n//", start + 10)
    assert end > start
    return html[start:end]


def test_migration_bounds_timestamps_history_and_preserves_existing_bird_data():
    out = run_node(
        """
const D = require('./diet_hunger_core.js');
const oldSave = {
  flock: [
    { id:'old1', species:'European Robin', hp:12, maxHp:20, training:{ atkBonus:2 }, academy:{ room:'roost' } },
    { id:'old2', species:'Mallard', hp:19, maxHp:30, care:{ hunger:175, happiness:10, lastHungerAt:1234, hungerTransactions:['old_tx'], hungerTransactionLog:[{ id:'logged_tx', type:'feeding', delta:-8, at:1200 }] } }
  ],
  merlinCare: { hunger:-20, happiness:88, energy:66, bondLevel:4, bondXp:30, hungerTransactions:['merlin_old'] },
  inventory: { larder:{} },
  pantry: {}
};
const migrated = D.migrateHungerState(oldSave, 1800000000000);
const reloaded = D.migrateHungerState(JSON.parse(JSON.stringify(migrated)), 1800000005000);
console.log(JSON.stringify({ migrated, reloaded }));
"""
    )
    birds = out["migrated"]["flock"]
    assert [bird["id"] for bird in birds] == ["old1", "old2"]
    assert birds[0]["training"] == {"atkBonus": 2}
    assert birds[0]["academy"] == {"room": "roost"}
    assert birds[0]["hp"] == 12 and birds[0]["maxHp"] == 20
    assert birds[0]["care"]["hunger"] == 20
    assert birds[1]["care"]["hunger"] == 100
    assert birds[1]["care"]["hungerTransactions"] == ["old_tx", "logged_tx"]
    assert {row["id"] for row in birds[1]["care"]["hungerTransactionLog"]} >= {"old_tx", "logged_tx"}
    assert birds[1]["care"]["lastHungerAt"] == 1234
    assert out["migrated"]["merlinCare"]["hunger"] == 0
    assert out["migrated"]["merlinCare"]["energy"] == 66
    assert out["migrated"]["merlinCare"]["bondLevel"] == 4
    assert out["migrated"]["merlinCare"]["hungerTransactions"] == ["merlin_old"]
    assert out["reloaded"]["flock"][1]["care"]["hunger"] == 100
    assert out["reloaded"]["flock"][1]["care"]["hungerTransactions"] == ["old_tx", "logged_tx"]


def test_new_recruits_and_browser_load_paths_use_default_hunger_migration():
    html = INDEX.read_text(encoding="utf-8")
    create = function_source(html, "createBirdEntry")
    load = function_source(html, "loadState")
    merge = function_source(html, "mergeCloudState")
    ensure = function_source(html, "ensureBirdAcademy")
    assert "care: defaultBirdCare()" in create
    assert "normalizeBirdCare(b)" in load
    assert "migrateAllHungerState(Date.now())" in load
    assert "migrateHungerState(merged" in merge
    assert "normalizeBirdCare(bird)" in ensure
    assert "bird.care = defaultBirdCare()" in ensure


def test_merlin_bridge_preserves_care_bond_and_adds_hunger_transactions():
    out = run_node(
        """
const M = require('./merlin_companion_core.js');
let care = M.sanitizeMerlinCare({
  hunger:130,
  happiness:88,
  energy:66,
  bondLevel:4,
  bondXp:30,
  hungerTransactions:['merlin_old'],
  hungerTransactionLog:[{ id:'log_only', type:'feeding', delta:-5, at:900 }]
}, 1000);
const fed = M.applyMerlinCareAction(care, { small_bird_prey_ration:1 }, 'feed', 2000);
console.log(JSON.stringify({ care, fed }));
"""
    )
    care = out["care"]
    assert care["hunger"] == 100
    assert care["energy"] == 66
    assert care["bondLevel"] == 4
    assert care["hungerTransactions"] == ["merlin_old", "log_only"]
    fed = out["fed"]
    assert fed["ok"] is True
    assert fed["state"]["hunger"] < care["hunger"]
    assert "merlin-feed:small_bird_prey_ration:2000" in fed["state"]["hungerTransactions"]
    assert any(row["activityId"] == "merlin-feed:small_bird_prey_ration" for row in fed["state"]["hungerTransactionLog"])


def test_hunger_thresholds_warn_block_and_feeding_recovers():
    out = run_node(
        """
const D = require('./diet_hunger_core.js');
let state = {
  flock: [{ id:'finch1', species:'European Goldfinch', scientificName:'Carduelis carduelis', care:{ hunger:90, happiness:60, hungerTransactions:[] } }],
  inventory: { larder:{ sunflower_seeds:1 } },
  pantry: {}
};
const thresholds = [20, 50, 72, 90].map(hunger => D.hungerStatusForCare({ hunger }, 1000));
const before = D.activityReadiness(state.flock[0], 'expedition', 1000);
const fed = D.applyFeedingTransaction(state, { target:'bird', birdId:'finch1', scientificName:'Carduelis carduelis', commonName:'European Goldfinch' }, { ingredientId:'sunflower_seeds', prep:'husked' }, { transactionId:'feed-finch-recovery', now:2000 });
const after = D.activityReadiness(fed.state.flock[0], 'expedition', 2000);
console.log(JSON.stringify({ thresholds, before, fed, after }));
"""
    )
    assert [row["level"] for row in out["thresholds"]] == ["fed", "peckish", "hungry", "urgent"]
    assert out["thresholds"][2]["warnsWork"] is True
    assert out["thresholds"][3]["blocksWork"] is True
    assert out["before"]["ok"] is False
    assert out["fed"]["ok"] is True
    assert out["fed"]["state"]["flock"][0]["care"]["hunger"] < 90
    assert out["after"]["ok"] is True
    assert "feed-finch-recovery" in out["fed"]["state"]["flock"][0]["care"]["hungerTransactions"]


def test_activity_hunger_is_idempotent_for_expedition_training_battle_and_reload():
    out = run_node(
        """
const D = require('./diet_hunger_core.js');
const A = require('./academy_treehouse_core.js');
const bird = { id:'b1', species:'Mallard', commonName:'Mallard', power:90, int:45, spd:45, stamina:45, care:{ hunger:20, hungerTransactions:[] } };
const exp = A.createBirdExpedition(bird, 'find_seed', 1000);
const expDone = A.advanceBirdExpedition(exp, exp.endMs + 1);
const train = A.createTrainingSession(bird, 'wing_sprints', 2000);
const trainDone = A.advanceTrainingSession(train, train.endMs + 1);
let state = { flock:[bird], birdExpeditions:[{ ...expDone, status:'complete' }], birdTrainingSessions:[{ ...trainDone, status:'complete' }] };
state = D.applyActivityHungerTransaction(state, { birdId:'b1', activityType:'expedition', activityId:exp.id, delta:12, now:3000 }).state;
const afterExpOnce = state.flock[0].care.hunger;
state = D.applyActivityHungerTransaction(state, { birdId:'b1', activityType:'expedition', activityId:exp.id, delta:12, now:3001 }).state;
const afterExpTwice = state.flock[0].care.hunger;
const reloaded = JSON.parse(JSON.stringify(state));
state = D.applyActivityHungerTransaction(reloaded, { birdId:'b1', activityType:'expedition', activityId:exp.id, delta:12, now:3002 }).state;
const afterReloadClaim = state.flock[0].care.hunger;
state = D.applyActivityHungerTransaction(state, { birdId:'b1', activityType:'training', activityId:train.id, delta:trainDone.rewards.hunger, now:4000 }).state;
const afterTrainOnce = state.flock[0].care.hunger;
state = D.applyActivityHungerTransaction(state, { birdId:'b1', activityType:'training', activityId:train.id, delta:trainDone.rewards.hunger, now:4001 }).state;
const afterTrainTwice = state.flock[0].care.hunger;
state = D.applyActivityHungerTransaction(state, { birdId:'b1', activityType:'battle', activityId:'battle42', delta:12, now:5000 }).state;
const afterBattleOnce = state.flock[0].care.hunger;
state = D.applyActivityHungerTransaction(state, { birdId:'b1', activityType:'battle', activityId:'battle42', delta:12, now:5001 }).state;
console.log(JSON.stringify({
  expStatus: expDone.status,
  trainStatus: trainDone.status,
  afterExpOnce,
  afterExpTwice,
  afterReloadClaim,
  afterTrainOnce,
  afterTrainTwice,
  afterBattleOnce,
  afterBattleTwice: state.flock[0].care.hunger,
  tx: state.flock[0].care.hungerTransactions,
  log: state.flock[0].care.hungerTransactionLog,
  reservedExp: D.isBirdReservedForActivity(state, 'b1')
}));
"""
    )
    assert out["expStatus"] == "complete"
    assert out["trainStatus"] == "complete"
    assert out["afterExpOnce"] == 32
    assert out["afterExpTwice"] == 32
    assert out["afterReloadClaim"] == 32
    assert out["afterTrainOnce"] == 42
    assert out["afterTrainTwice"] == 42
    assert out["afterBattleOnce"] == 54
    assert out["afterBattleTwice"] == 54
    assert len(out["tx"]) == 3
    assert {row["type"] for row in out["log"]} >= {"expedition", "training", "battle"}
    assert out["reservedExp"] is True


def test_browser_activity_paths_use_transactions_readiness_and_completed_reservation():
    html = INDEX.read_text(encoding="utf-8")
    claim_exp = function_source(html, "claimBirdExpedition")
    claim_training = function_source(html, "claimBirdTrainingSession")
    start_exp = function_source(html, "startBirdExpedition")
    start_training = function_source(html, "startBirdTrainingSession")
    has_exp = function_source(html, "birdHasActiveExpedition")
    has_training = function_source(html, "birdHasActiveTraining")
    end_battle = function_source(html, "endPerchBattle")

    assert "applyBirdHungerTransaction(q.birdId, 'expedition', q.id" in claim_exp
    assert "applyBirdHungerTransaction(session.birdId, 'training', session.id" in claim_training
    # Merlin can lead starter errands now, and he keeps his care state outside
    # the flock, so the guard is handed his care record rather than a flock bird.
    assert "warnOrBlockBirdWork(birdId === 'merlin-guide' ? { ...bird, care:getMerlinCare() } : bird, 'expedition')" in start_exp
    assert "warnOrBlockBirdWork(bird, 'training')" in start_training
    assert "advanceBirdExpedition" not in has_exp
    assert "advanceTrainingSession" not in has_training
    assert "claimed','cancelled','failed" in has_exp
    assert "claimed','cancelled','failed" in has_training
    assert "battleState.completed" in end_battle
    assert "applyBirdHungerTransaction(bird.id, 'battle', battleActivityId" in end_battle


def test_visible_hunger_surfaces_and_humane_copy_are_present_without_death_path():
    html = INDEX.read_text(encoding="utf-8")
    for marker in (
        'data-hunger-surface="companion-card"',
        'data-hunger-surface="academy-room"',
        'data-hunger-surface="expedition-dispatch"',
        'data-hunger-surface="training-dispatch"',
        'data-hunger-surface="battle-readiness"',
        'data-hunger-surface="merlin-care"',
    ):
        assert marker in html
    lowered = html.lower()
    for label in ("fed", "peckish", "hungry", "urgent care"):
        assert label in lowered
    assert "needs food before" in lowered
    assert "feed them soon" in lowered
    dangerous = re.compile(r"hunger[^\\n]{0,120}\\b(die|dies|death|delete|remove|kill|permanent injury)\\b", re.I)
    assert not dangerous.search(html + "\n" + DIET_CORE.read_text(encoding="utf-8") + "\n" + MERLIN_CORE.read_text(encoding="utf-8"))


def test_walking_and_side_quests_do_not_assign_bird_hunger_work():
    quest_core = QUEST_CORE.read_text(encoding="utf-8")
    html = INDEX.read_text(encoding="utf-8")
    complete_walk = function_source(html, "completeWalkingQuest")
    side_start = html.index("// SIDE QUEST")
    side_end = html.index("function openActiveWalkQuestSheet", side_start)
    side_section = html[side_start:side_end]

    assert "birdId" not in quest_core
    assert "assignedBird" not in quest_core
    assert "applyBirdHungerTransaction" not in complete_walk
    assert "grantMerlinBondXp" in complete_walk
    assert "birdId" not in side_section
    assert "assignedBird" not in side_section
