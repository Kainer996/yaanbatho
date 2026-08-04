"""Weight tells, and every bird can hold a job.

Two rules, pinned here so neither can quietly drift:

1. **Size.** A bigger bird carries more and is stronger in battle; a little
   bird carries less and is weaker in battle. Size is real biology — measured
   AVONET body mass where the catalogue has it, read back off the profile's own
   HP/STRENGTH where it does not — and the scaling is applied exactly once,
   where a bird's stats are generated.
2. **Roles.** A bird can be posted to run an Academy room, steward a village or
   hold a region, and the post is only as good as the bird in it. For the
   thinking jobs — Librarian, Star Charter, Head Chef, Steward, Warden — that
   means INT: the cleverer the librarian, the more effective the Library.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
SIZE_CORE = ROOT / "bird_size_core.js"
ROLES_CORE = ROOT / "bird_roles_core.js"
ROLE_CORE_PIN = "empire-clarity-v205-20260803"
SIZE_CORE_PIN = "forge-satchels-v220-20260804"
CURRENT_BUILD = "forge-satchels-v220-20260804"


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, check=False, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


# ---------------------------------------------------------------------------
# 1. Size: bigger carries more and hits harder, smaller carries less and hits softer
# ---------------------------------------------------------------------------

def test_size_is_read_from_real_mass_when_the_catalogue_has_it():
    out = run_node(
        """
        const core = require('./bird_size_core.js');
        // A real national-completion profile: AVONET's measured mass rides on
        // statProvenance, and that mass IS the bird's size.
        const profile = { stats:{ hp:3, strength:3 }, statProvenance:{ derivedInputs:{ mass:13 } } };
        const noMass = { stats:{ hp:9, strength:10 } };
        console.log(JSON.stringify({
          measured: core.speciesSize(profile),
          derived: core.speciesSize(noMass),
          scale: [3, 10, 18, 100, 800, 4500, 11000].map(g => core.sizeScoreFromMassGrams(g))
        }));
        """
    )
    assert out["measured"]["source"] == "mass"
    assert out["measured"]["massG"] == 13
    assert out["measured"]["classId"] in ("tiny", "small")
    # No measured mass: fall back to the biology stats, and say so rather than
    # inventing grams.
    assert out["derived"]["source"] == "stats"
    assert out["derived"]["massG"] is None
    assert out["derived"]["classId"] == "giant"
    # Mass maps onto the 0-100 score monotonically, on a log scale.
    assert out["scale"] == sorted(out["scale"])
    assert out["scale"][0] < 10 and out["scale"][-1] > 90


def test_carrying_capacity_and_haul_rise_with_size():
    out = run_node(
        """
        const core = require('./bird_size_core.js');
        const bird = score => ({ sizeScore: score, stamina: 50, level: 1 });
        console.log(JSON.stringify({
          capacities: [0, 20, 40, 60, 80, 100].map(s => core.carryCapacity(bird(s))),
          hauls: [0, 50, 100].map(s => core.haulMultiplier(bird(s)))
        }));
        """
    )
    capacities = out["capacities"]
    assert capacities == sorted(capacities)
    assert capacities[0] == 1, "a goldcrest manages one load, no more"
    assert capacities[-1] >= 8, "a giant hauls a stack"
    hauls = out["hauls"]
    assert hauls[0] < 1 < hauls[-1], "little birds bring back less than average, giants more"


def test_an_overloaded_little_bird_leaves_the_rest_behind():
    out = run_node(
        """
        const core = require('./bird_size_core.js');
        const rewards = { branches: 6, items: { soft_moss: 1, oak_twig: 1 } };
        console.log(JSON.stringify({
          tiny: core.applyCarryLimit(rewards, { sizeScore: 0, stamina: 50, level: 1 }),
          giant: core.applyCarryLimit(rewards, { sizeScore: 96, stamina: 50, level: 1 })
        }));
        """
    )
    tiny, giant = out["tiny"], out["giant"]
    assert tiny["capacity"] < giant["capacity"]
    assert tiny["overloaded"] and tiny["leftBehind"] > 0
    assert not giant["overloaded"]
    assert giant["branches"] > tiny["branches"]
    assert sum(giant["items"].values()) > sum(tiny["items"].values())
    # A timber errand always keeps one unit back for timber, so even the
    # smallest bird comes home with a beakful rather than nothing at all.
    assert tiny["branches"] > 0


def test_battle_strength_rises_with_size_and_is_applied_once():
    out = run_node(
        """
        const core = require('./bird_size_core.js');
        console.log(JSON.stringify({
          mults: [0, 25, 50, 75, 100].map(s => core.battlePowerMultiplier(s)),
          min: core.BATTLE_MIN_MULT, max: core.BATTLE_MAX_MULT
        }));
        """
    )
    mults = out["mults"]
    assert mults == sorted(mults), "every step up in weight is a step up in strength"
    assert mults[0] < 1 < mults[-1], "little birds fight below par, giants above it"
    assert out["min"] == mults[0] and out["max"] == mults[-1]
    html = HTML.read_text(encoding="utf-8")
    # Applied once, at the source, so nothing downstream double-counts it.
    assert "battlePowerMultiplier(size.score)" in html
    battle = (ROOT / "battle_core.js").read_text(encoding="utf-8")
    assert "battlePowerMultiplier" not in battle, "the engine must not re-apply the size scaling"
    assert "sizeClass: bird.sizeClass || null" in battle


def test_generated_stats_make_the_eagle_beat_the_goldcrest_on_every_physical_axis():
    """The whole rule, run through the game's own generateBirdStats."""
    source = HTML.read_text(encoding="utf-8")
    start = source.index("function generateBirdStats(")
    end = source.index("\nconst BIRD_BIOLOGY_STATS_VERSION", start)
    out = run_node(
        """
        const SIZE_CORE = require('./bird_size_core.js');
        function birdSizeCore() { return SIZE_CORE; }
        function speciesSizeInfo(p) { return SIZE_CORE.speciesSize(p); }
        function birdCarryCapacity(bird) { return SIZE_CORE.carryCapacity(bird); }
        function speciesCharmBase() { return 5; }
        function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
        function hashStr() { return 0; }
        function seededRandom() { return () => 0.5; }
        const SPECIAL_MOVES = ['Wingbeat'];
        const BIRD_EMOJIS = ['bird'];
        const PROFILES = {
          'Goldcrest': { name:'Goldcrest', stats:{ hp:1, stamina:6, strength:1, def:4, spd:7, int:5 } },
          'Robin':     { name:'Robin',     stats:{ hp:4, stamina:5, strength:3, def:5, spd:5, int:5 } },
          'Buzzard':   { name:'Buzzard',   stats:{ hp:6, stamina:7, strength:6, def:7, spd:6, int:5 } },
          'Golden Eagle': { name:'Golden Eagle', stats:{ hp:9, stamina:8, strength:10, def:8, spd:8, int:6 } }
        };
        function findSpeciesProfile(name) { return PROFILES[name] || null; }
        """
        + source[start:end]
        + """
        const out = {};
        Object.keys(PROFILES).forEach(name => {
          const s = generateBirdStats(name, null, 'common');
          out[name] = { size:s.sizeClass, score:s.sizeScore, hp:s.maxHp, atk:s.atk, def:s.def, mag:s.mag,
                        spd:s.spd, int:s.int, power:s.power, carry:SIZE_CORE.carryCapacity({ ...s, level:1 }) };
        });
        console.log(JSON.stringify(out));
        """
    )
    crest, robin, buzzard, eagle = out["Goldcrest"], out["Robin"], out["Buzzard"], out["Golden Eagle"]
    order = [crest, robin, buzzard, eagle]
    for key in ("score", "hp", "atk", "def", "power", "carry"):
        values = [bird[key] for bird in order]
        assert values == sorted(values), f"{key} must rise with size: {values}"
    assert [b["size"] for b in order] == ["tiny", "small", "medium", "giant"]
    # Magic remains the small bird's edge — but only an edge: it is scaled by
    # size too, so weight still wins a straight fight.
    assert crest["mag"] > eagle["mag"]
    assert eagle["atk"] > crest["mag"]
    # Speed and cleverness are deliberately size-free: a goldcrest still flies
    # rings around an eagle.
    assert crest["spd"] > robin["spd"]


def test_every_companion_is_re_derived_so_old_saves_get_the_size_rule():
    html = HTML.read_text(encoding="utf-8")
    assert "const BIRD_BIOLOGY_STATS_VERSION = 'bird-biology-runtime-v3-size-20260802';" in html
    # Size belongs to the species, so migration re-reads it from the profile
    # rather than trusting whatever an older save wrote.
    assert "bird.sizeScore = base.sizeScore;" in html
    assert "bird.carryCapacity = birdCarryCapacity(bird);" in html


# ---------------------------------------------------------------------------
# 2. Roles: a job for every bird, and the clever ones do the clever jobs
# ---------------------------------------------------------------------------

def test_every_academy_room_a_village_and_a_region_has_a_post():
    out = run_node(
        """
        const roles = require('./bird_roles_core.js');
        const academy = require('./academy_treehouse_core.js');
        console.log(JSON.stringify({
          rooms: academy.getAcademyRooms().map(r => r.id),
          staffedRooms: academy.getAcademyRooms().map(r => (roles.academyRoleForRoom(r.id) || {}).id || null),
          village: roles.villageRole().id,
          region: roles.regionRole().id,
          titles: roles.ROLES.map(r => r.title)
        }));
        """
    )
    assert None not in out["staffedRooms"], "every buildable room needs a head"
    assert len(out["rooms"]) == len(out["staffedRooms"])
    assert out["village"] == "steward" and out["region"] == "region_warden"
    # The posts the player asked for by name.
    assert "Librarian" in out["titles"]
    assert "Head Chef" in out["titles"]


def test_the_cleverer_the_bird_the_better_the_librarian_and_the_library():
    out = run_node(
        """
        const roles = require('./bird_roles_core.js');
        const bird = int => ({ id:'b' + int, int, cha:60, stamina:60, atk:60, def:60, spd:60, maxHp:100 });
        const ladder = [20, 60, 120, 200, 250].map(int => {
          const fx = roles.roleEffectiveness(bird(int), 'librarian');
          return { int, aptitude:fx.aptitude, rank:fx.rank.label, multiplier:fx.multiplier };
        });
        console.log(JSON.stringify({
          ladder,
          vacant: roles.roleEffectiveness(null, 'librarian'),
          best: roles.bestCandidate([bird(40), bird(220), bird(90)], 'librarian').id,
          // INT is the whole job for the Librarian.
          librarianStats: roles.roleById('librarian').stats,
          chefStats: roles.roleById('head_chef').stats,
          stewardStats: roles.roleById('steward').stats
        }));
        """
    )
    ladder = out["ladder"]
    assert [row["aptitude"] for row in ladder] == sorted(row["aptitude"] for row in ladder)
    assert [row["multiplier"] for row in ladder] == sorted(row["multiplier"] for row in ladder)
    assert ladder[0]["rank"] == "Novice" and ladder[-1]["rank"] == "Grandmaster"
    # An unstaffed post changes nothing at all — a posting is upside only.
    assert out["vacant"]["multiplier"] == 1 and out["vacant"]["staffed"] is False
    assert out["best"] == "b220", "the cleverest bird is the suggested Librarian"
    assert out["librarianStats"] == {"int": 1}
    assert out["chefStats"]["int"] >= 0.5
    assert out["stewardStats"]["int"] >= 0.5


def test_one_bird_one_job():
    out = run_node(
        """
        const roles = require('./bird_roles_core.js');
        let state = roles.sanitizeRoleState({ junk: true, academy: { library: 'raven' } });
        state = roles.assignRole(state, 'village', '99', 'raven');
        const afterMove = JSON.parse(JSON.stringify(state));
        state = roles.assignRole(state, 'region', 'r1', 'wren');
        const pruned = roles.pruneRoleState(state, ['wren']);
        console.log(JSON.stringify({
          shape: Object.keys(afterMove),
          afterMove,
          posts: roles.postsHeldBy(afterMove, 'raven'),
          pruned
        }));
        """
    )
    assert out["shape"] == ["academy", "villages", "regions"]
    # Taking the village vacated the Library: a bird cannot hold two posts.
    assert out["afterMove"]["academy"] == {}
    assert out["afterMove"]["villages"] == {"99": "raven"}
    assert len(out["posts"]) == 1
    # A bird that has left the flock never holds a post from beyond the grave.
    assert out["pruned"]["villages"] == {} and out["pruned"]["regions"] == {"r1": "wren"}


def test_posts_are_wired_into_the_things_they_claim_to_improve():
    html = HTML.read_text(encoding="utf-8")
    # The Academy: room heads speed up study, healing, resting and morale.
    assert "const roomBoost = academyRoleMultiplier(room);" in html
    assert "elapsedMin * roomBoost" in html
    assert "0.10 * roomBoost" in html          # Head Healer
    assert "0.04 * roomBoost" in html          # Roost Warden
    # The Kitchen: the Head Chef improves every plate that leaves it.
    assert "const chef = academyRoleMultiplier('kitchen');" in html
    # The Barracks: the Recruiting Officer talks the price down.
    assert "const officer = academyRoleMultiplier('tavern');" in html
    # The Quest Roost: the Quartermaster plans a heavier trip, and the bird's
    # own back decides how much of it comes home.
    assert "function applyQuartermasterPlanning(quest)" in html
    assert "applyExpeditionCarryLimit(quest, bird);" in html
    # The realm: Stewards and Wardens.
    assert "const steward = villageRoleMultiplier(rec.seed);" in html
    assert "* unity * governance)" in html
    assert "const wardens = (regionRoleMultiplier(a.id) + regionRoleMultiplier(b.id)) / 2;" in html


def test_the_appointment_card_is_reachable_from_every_surface():
    html = HTML.read_text(encoding="utf-8")
    assert "function rolePostCardHTML(scope, key" in html
    # Academy room interiors (including the Barracks, which renders early).
    assert "const rolePanel = rolePostCardHTML('academy', room);" in html
    assert "rolePostCardHTML('academy', 'tavern')" in html
    # A village's own hall, and a region's.
    assert "rolePostCardHTML('village', String(rec.seed >>> 0)" in html
    assert "rolePostCardHTML('region', String(region.id))" in html
    # Assignment runs through one delegated listener, not per-card onclicks.
    assert 'data-action="role-assign"' in html and 'data-action="role-clear"' in html
    # And the bird's own card says what it is and what it does.
    assert "function renderBirdSizePanel(bird)" in html
    assert "function renderBirdPostLine(bird)" in html
    assert "${renderBirdSizePanel(bird)}" in html


def test_role_state_is_saved_and_healed():
    html = HTML.read_text(encoding="utf-8")
    assert "birdRoles: { academy: {}, villages: {}, regions: {} }" in html
    assert "function ensureRolesState()" in html
    assert "core.pruneRoleState(gameState.birdRoles, liveIds)" in html


def test_role_holders_are_reserved_from_quests_training_and_battles():
    html = HTML.read_text(encoding="utf-8")
    assert "function birdAssignedPost(birdId)" in html
    assert "const assignedPost = birdAssignedPost(b.id);" in html
    assert "const disabled = Boolean(assignedPost) || away || training || tooLow || !readiness.ok;" in html
    assert "assignedPost ? assignedPost.role.title" in html
    assert "if (assignedPost) { showToast" in html
    assert "!birdAssignedPost(b.id)" in html
    assert "!birdHasActiveTraining(b.id)" in html
    assert "!birdHasActiveExpedition(b.id)" in html
    assert "return !b.care.sleeping;" in html
    assert "const flock = getBattleFlock().filter(b => !birdAssignedPost(b.id) && !birdHasActiveTraining(b.id) && !birdHasActiveExpedition(b.id) && !sleepReadinessForBird(b, Date.now()).sleeping);" in html
    assert "const posted = team.find(b => birdAssignedPost(b.id));" in html
    # Role holders cannot silently move into a second post; stand them down first.
    assert "const currentPost = birdAssignedPost(bird.id);" in html
    assert "No companion is free for this post right now" in html
    assert html.count("!birdAssignedPost(b.id)") >= 3
    # A bird cannot be appointed while another timed activity still owns it.
    assert "if (birdHasActiveTraining(bird.id))" in html


def test_release_is_versioned_for_service_worker_self_update():
    sw = SW.read_text(encoding="utf-8")
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE = "))
    assert "restored-lost-features-v200-20260802" in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML.read_text(encoding="utf-8")
    # Both new cores ship, and are precached for offline play.
    assert SIZE_CORE.exists() and ROLES_CORE.exists()
    assert f"'./bird_size_core.js?v={SIZE_CORE_PIN}'" in sw
    assert f"'./bird_roles_core.js?v={ROLE_CORE_PIN}'" in sw
    html = HTML.read_text(encoding="utf-8")
    assert f'src="bird_size_core.js?v={SIZE_CORE_PIN}"' in html
    assert f'src="bird_roles_core.js?v={ROLE_CORE_PIN}"' in html
