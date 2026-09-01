"""The raven's law: weight and wit pull opposite ways.

On 2026-08-12 a real raven finally crossed the sky over Yaan — and the game
now honours what that bird actually is. Three rules, pinned here:

1. **True weight.** The hand-curated roster carries real field-guide masses.
   A Raven (~1.2 kg) really is twice a Carrion Crow (~510 g), and a Herring
   Gull really is a heavyweight.
2. **True carrying.** Load units come straight off the grams — one load per
   100 g — so a raven hauls double a crow's load, a buzzard dwarfs a robin,
   and gulls carry an awful lot.
3. **Weight loses ledgers.** The civic posts (Steward, Warden) run on charm
   and wit, and size counts AGAINST them: a robin out-governs a raven, however
   clever the raven is. Non-civic posts (the Librarian) ignore size entirely.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
STORY = ROOT / "STORY.md"
RELEASE = "every-bird-carries-its-weight-v335-20260827"
# The roles core moved on with chef mastery (v261); the size core stays ours.
# Later releases move BURBZ_BUILD on; this release's own segment stays in the
# cache lineage and its untouched cores keep their ?v= pins.
CURRENT_BUILD = "empire-three-pages-v343-20260901"
# bird_roles_core.js last changed in free-birds-v318, which retired the Head
# Gardener. A core ships under the tag of the release that last touched it.
ROLES_CORE_PIN = "manager-builds-the-village-v324-20260825"
# magpie-market-v316 edited this core, so it ships under that tag now.


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, check=False, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


# ---------------------------------------------------------------------------
# 1. True weight: the roster knows what these birds really weigh
# ---------------------------------------------------------------------------

def test_the_raven_weighs_twice_the_carrion_crow():
    out = run_node(
        """
        const core = require('./bird_size_core.js');
        const size = id => core.speciesSize({ id, name: id });
        console.log(JSON.stringify({
          raven: size('raven'), crow: size('carrion_crow'),
          robin: size('robin'), buzzard: size('buzzard'), gull: size('herring_gull')
        }));
        """
    )
    raven, crow = out["raven"], out["crow"]
    assert raven["source"] == "field" and crow["source"] == "field"
    assert raven["massG"] >= 2 * crow["massG"], "a raven is twice a carrion crow"
    assert raven["score"] > crow["score"]
    # The named yardsticks all read from the field guide now.
    assert out["robin"]["massG"] == 18 and out["robin"]["classId"] == "small"
    assert out["buzzard"]["massG"] == 780
    assert out["gull"]["massG"] == 1150, "a herring gull is a genuine heavyweight"


def test_measured_mass_still_beats_the_field_guide_which_beats_stats():
    out = run_node(
        """
        const core = require('./bird_size_core.js');
        console.log(JSON.stringify({
          measured: core.speciesSize({ id:'robin', stats:{ hp:3, strength:3 }, statProvenance:{ derivedInputs:{ mass:13 } } }),
          field: core.speciesSize({ id:'robin', stats:{ hp:3, strength:3 } }),
          stats: core.speciesSize({ stats:{ hp:9, strength:10 } })
        }));
        """
    )
    assert out["measured"]["source"] == "mass" and out["measured"]["massG"] == 13
    assert out["field"]["source"] == "field" and out["field"]["massG"] == 18
    assert out["stats"]["source"] == "stats" and out["stats"]["massG"] is None


# ---------------------------------------------------------------------------
# 2. True carrying: real weight, on a curve that reaches the real top
# ---------------------------------------------------------------------------

def test_carrying_tracks_real_mass_so_the_raven_far_outhauls_the_crow():
    """A raven out-hauls a crow, a buzzard buries a robin, and nothing is flat.

    v255 set this rule with load running straight off weight — one unit per
    100 g — which made a 1.2 kg raven exactly twice a 510 g crow. That literal
    doubling could never survive the whole roster: carried across four orders of
    magnitude it put every bird under a myna on 1 and every bird over 2 kg on
    the same ceiling. every-bird-carries-its-weight-v335 keeps the fact Yaan
    cared about — the raven is the far bigger hauler, and its number says so —
    on a square-root curve that still has somewhere to go at the top.
    """
    out = run_node(
        """
        const core = require('./bird_size_core.js');
        const carry = id => {
          const s = core.speciesSize({ id, name: id });
          return core.carryCapacity({ sizeScore: s.score, massG: s.massG, carryGuild: s.carryGuild, stamina: 50, level: 1 });
        };
        console.log(JSON.stringify({
          raven: carry('raven'), crow: carry('carrion_crow'), robin: carry('robin'),
          buzzard: carry('buzzard'), gull: carry('herring_gull'),
          jackdaw: carry('jackdaw'), goldenEagle: carry('golden_eagle'),
          plainBirdOfAGullsWeight: core.carryCapacity({ massG: 1150, carryGuild: 'songbird', stamina: 50, level: 1 }),
          maxUnits: core.MAX_CARRY_UNITS
        }));
        """
    )
    assert out["raven"] > out["crow"] > out["jackdaw"], "weight still tells, all the way up the corvids"
    assert out["raven"] >= out["crow"] + 3, "a raven is the far bigger hauler and the number says so"
    assert out["buzzard"] >= 2 * out["robin"], "a buzzard carries so much more than a robin"
    # Seagulls still carry an awful lot — for their weight. A buzzard of two
    # thirds the gull's weight now edges ahead of it, because it carries rabbits
    # in its talons and a gull carries what fits in its bill.
    assert out["gull"] > out["plainBirdOfAGullsWeight"], "seagulls carry an awful lot"
    assert out["gull"] > out["crow"]
    assert out["robin"] >= 1, "even the smallest bird brings a beakful home"
    # The top of the curve is a real bird, not the ceiling: the eagle has room above it.
    assert out["goldenEagle"] > out["raven"]
    assert out["goldenEagle"] <= out["maxUnits"]


# ---------------------------------------------------------------------------
# 3. Weight loses ledgers: the civic size rule
# ---------------------------------------------------------------------------

def test_governance_wit_falls_as_weight_rises():
    out = run_node(
        """
        const roles = require('./bird_roles_core.js');
        console.log(JSON.stringify({
          ladder: [0, 20, 40, 60, 80, 100].map(s => roles.governanceWitFactor(s)),
          unknown: roles.governanceWitFactor(undefined),
          civicSteward: Boolean(roles.roleById('steward').civic),
          civicWarden: Boolean(roles.roleById('region_warden').civic),
          civicLibrarian: Boolean(roles.roleById('librarian').civic),
          stewardStats: roles.roleById('steward').stats
        }));
        """
    )
    ladder = out["ladder"]
    assert ladder == sorted(ladder, reverse=True), "every step up in weight is a step down at the desk"
    assert ladder[0] > 1, "the robin's bracket wins a charm bonus"
    assert ladder[2] == 1, "up to jackdaw weight, no handicap"
    assert ladder[-1] < 0.7, "an eagle governs at well under full wit"
    assert out["unknown"] == 1, "no known size: no opinion"
    assert out["civicSteward"] and out["civicWarden"] and not out["civicLibrarian"]
    # Charm now carries half the civic job — the robin's own stat.
    assert out["stewardStats"]["cha"] >= 0.5


def test_the_robin_out_governs_the_raven_but_the_raven_keeps_the_library():
    out = run_node(
        """
        const roles = require('./bird_roles_core.js');
        const size = require('./bird_size_core.js');
        const mk = (id, int, cha) => {
          const s = size.speciesSize({ id, name: id });
          return { id, int, cha, sizeScore: s.score, massG: s.massG, stamina: 60, maxHp: 100 };
        };
        // Roster truth: the raven is the sharpest mind (INT 10, CHA 4); the
        // robin is the great charmer (INT 5, CHA 10).
        const raven = mk('raven', 100, 40);
        const robin = mk('robin', 50, 100);
        console.log(JSON.stringify({
          stewardRobin: roles.roleAptitude(robin, 'steward'),
          stewardRaven: roles.roleAptitude(raven, 'steward'),
          bestSteward: roles.bestCandidate([raven, robin], 'steward').id,
          bestLibrarian: roles.bestCandidate([raven, robin], 'librarian').id
        }));
        """
    )
    assert out["stewardRobin"] > out["stewardRaven"], "a robin melts a market square; a raven empties it"
    assert out["bestSteward"] == "robin"
    assert out["bestLibrarian"] == "raven", "non-civic posts still belong to the cleverest bird"


# ---------------------------------------------------------------------------
# 4. The raven is in the game, and the game says all this out loud
# ---------------------------------------------------------------------------

def test_the_raven_is_a_recruitable_character_and_the_ui_tells_the_rule():
    html = HTML.read_text(encoding="utf-8")
    assert 'id: "raven", name: "Raven", rarity: "rare"' in html
    # v4 re-derives every companion so old saves pick up the true weights.
    assert "const BIRD_BIOLOGY_STATS_VERSION = 'bird-biology-runtime-v5-every-bird-carries-its-weight-20260827';" in html
    # The size panel shows the governing chip and honest weight sourcing.
    assert "% governing" in html
    assert "governanceWitFactor" in html
    assert "field guide weight" in html


def test_the_story_canonises_the_law_of_weight_and_wit():
    story = STORY.read_text(encoding="utf-8")
    assert "## The Raven, and the law of weight and wit" in story
    assert "law of weight and wit" in story
    assert "one load for every hundred grams" in story


def test_release_is_versioned_for_service_worker_self_update():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert RELEASE in cache_line  # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert f"'./bird_size_core.js?v={RELEASE}'" in sw
    assert f"'./bird_roles_core.js?v={ROLES_CORE_PIN}'" in sw
    assert f'src="bird_size_core.js?v={RELEASE}"' in html
    assert f'src="bird_roles_core.js?v={ROLES_CORE_PIN}"' in html
