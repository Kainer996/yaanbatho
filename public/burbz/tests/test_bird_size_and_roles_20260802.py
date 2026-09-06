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
SIZE_CORE_PIN = "every-bird-carries-its-weight-v335-20260827"
CURRENT_BUILD = "companion-card-polish-v355-20260906"
# bird_roles_core.js last changed in free-birds-v318, which retired the Head
# Gardener. A core ships under the tag of the release that last touched it.
ROLES_CORE_PIN = "rook-recognition-special-characters-v347-20260904"
# magpie-market-v316 edited this core, so it ships under that tag now.


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
    assert giant["branches"] >= tiny["branches"]
    assert sum(giant["items"].values()) > sum(tiny["items"].values())
    # However small the bird, it never comes home with an empty beak.
    assert tiny["branches"] + sum(tiny["items"].values()) > 0


def test_every_playable_bird_knows_what_it_weighs():
    """No bird in the game guesses its weight off its stat block any more.

    every-bird-carries-its-weight-v335: 425 of the roster's birds — including
    the Bald Eagle, the Emperor Penguin, the Ostrich and the Reed Warbler —
    had no weight anywhere, so speciesSize() fell back to reading one off HP
    and STRENGTH. The carry rule cannot be honest while that is true, so the
    field guide now covers every single playable species.
    """
    out = run_node(
        """
        const core = require('./bird_size_core.js');
        const mods = ['./uk_bird_expansion_50.js', './uk_bird_expansion_2.js', './au_bird_expansion.js',
                      './uk_bird_expansion_3.js', './au_bird_expansion_2.js', './uk_bird_expansion_4.js'];
        let total = 0, guessing = 0;
        const count = p => {
          total += 1;
          const s = core.speciesSize(p);
          if (s.source === 'stats' || s.source === 'default') guessing += 1;
        };
        mods.forEach(f => (require(f).profiles || []).forEach(count));
        require('./national_bird_completion_20260715.js').profiles.forEach(count);
        console.log(JSON.stringify({ total, guessing, entries: Object.keys(core.FIELD_GUIDE_MASS_G).length }));
        """
    )
    assert out["guessing"] == 0, "every playable bird must know what it really weighs"
    assert out["total"] > 1100
    assert out["entries"] >= 560


def test_the_carrying_guild_is_read_off_the_bird_not_off_a_lucky_substring():
    """Whole words only, and taxonomy never overrules the obvious exceptions.

    Accipitridae holds the eagles, the Old World vultures and the kites in one
    family, and they carry nothing alike — a griffon has near-chicken feet and
    gorges rather than carries, while an osprey has the best grip of any bird
    alive. And a plain substring match reads "Eastern" and "Bittern" as terns,
    "Owlet-nightjar" as an owl and "Dovekie" as a dove.
    """
    out = run_node(
        """
        const core = require('./bird_size_core.js');
        const guild = (name, extra) => core.carryGuildForProfile(Object.assign({ name }, extra || {}));
        console.log(JSON.stringify({
          griffon: guild('Eurasian Griffon Vulture', { family: 'Accipitridae' }),
          condor: guild('Andean Condor', { family: 'Cathartidae' }),
          lammergeier: guild('Bearded Vulture', { family: 'Accipitridae' }),
          redKite: guild('Red Kite', { family: 'Accipitridae' }),
          elanus: guild('Black-shouldered Kite', { id: 'black_shouldered_kite', family: 'Accipitridae' }),
          osprey: guild('Osprey', { id: 'osprey' }),
          goldenEagle: guild('Golden Eagle', { family: 'Accipitridae' }),
          bittern: guild('Bittern'),
          cattleEgret: guild('Eastern Cattle-Egret'),
          farEasternCurlew: guild('Far Eastern Curlew'),
          owletNightjar: guild('Australian Owlet-nightjar'),
          magpieGoose: guild('Magpie Goose'),
          commonTern: guild('Common Tern'),
          tawnyOwl: guild('Tawny Owl')
        }));
        """
    )
    # Taxonomy cannot separate these three; the exception list can.
    assert out["griffon"] == out["condor"] == "vulture"
    assert out["lammergeier"] == "bonedropper", "the one vulture that really does carry"
    assert out["redKite"] == "kite"
    assert out["elanus"] == "raptor", "Elanus really does hunt rodents"
    assert out["osprey"] == "osprey"
    assert out["goldenEagle"] == "raptor"
    # Whole words only.
    assert out["bittern"] == "fisher"
    assert out["cattleEgret"] == "fisher"
    assert out["farEasternCurlew"] == "wader"
    assert out["owletNightjar"] == "aerial"
    assert out["magpieGoose"] == "waterfowl"
    # …without breaking the ordinary matches those rules exist to protect.
    assert out["commonTern"] == "gull"
    assert out["tawnyOwl"] == "owl"


def test_training_can_never_lift_a_small_bird_past_a_bigger_one():
    """A well-fed, heavily trained robin is still a robin.

    The level bonus used to be a flat +(level-1)/10 — worth +490% to a Robin and
    +21% to a Golden Eagle. So a level-50 Goldcrest carried 5, exactly a wild
    Merlin's load, and a level-50 Robin carried 6, more than one. That is the
    size rule coming apart at the point it was written to hold. Seasoning and
    condition are a SHARE of the bird's own back now.

    The line: who a bird is decides what it can carry; what it carries it IN is
    the part the player changes. So a satchel may still lift a small bird past a
    big one — that is a crafted legendary, not a level-up.
    """
    out = run_node(
        """
        const core = require('./bird_size_core.js');
        const at = (massG, carryGuild, level, stamina, gear) =>
          core.carryCapacity({ massG, carryGuild, level: level || 1, stamina: stamina || 50 }, gear);
        console.log(JSON.stringify({
          goldcrestMaxed: at(5.5, 'songbird', 50, 100),
          robinMaxed: at(18, 'songbird', 50, 100),
          robinFresh: at(18, 'songbird', 1),
          wildMerlin: at(200, 'raptor', 1),
          merlinMaxed: at(200, 'raptor', 50, 100),
          eagleMaxed: at(4500, 'raptor', 50, 100),
          robinWithRoyalSatchel: at(18, 'songbird', 1, 50, 5),
          cap: core.MAX_CARRY_UNITS
        }));
        """
    )
    # No amount of training lifts a small bird to a wild Merlin's load.
    assert out["goldcrestMaxed"] < out["wildMerlin"]
    assert out["robinMaxed"] < out["wildMerlin"]
    # Training still helps the birds with a back to build on.
    assert out["merlinMaxed"] > out["wildMerlin"]
    assert out["eagleMaxed"] > out["merlinMaxed"]
    # …and it must not shove the big birds into the ceiling, or the top goes flat again.
    assert out["eagleMaxed"] < out["cap"]
    # A satchel is the small bird's way up, and it is allowed to be.
    assert out["robinWithRoyalSatchel"] > out["robinFresh"]


def test_compound_bird_names_land_in_the_right_guild():
    """A Thornbill is not a hornbill; a Woodpigeon really is a pigeon.

    Whole-word matching is what stops "Cuckooshrike" reading as a shrike and
    "Woodswallow" as a swallow — but it also means every bird whose name is ONE
    compound word has to be named outright. These are the ones that matter.
    """
    out = run_node(
        """
        const core = require('./bird_size_core.js');
        const g = name => core.carryGuildForProfile({ name });
        console.log(JSON.stringify({
          woodpigeon: g('Woodpigeon'), brolga: g('Brolga'), capercaillie: g('Capercaillie'),
          malleefowl: g('Malleefowl'), scrubfowl: g('Orange-footed Scrubfowl'),
          scaup: g('Scaup'), whimbrel: g('Whimbrel'), garganey: g('Garganey'),
          corncrake: g('Corncrake'), nativehen: g('Tasmanian Nativehen'),
          thornbill: g('Brown Thornbill'), woodswallow: g('Dusky Woodswallow'),
          cuckooshrike: g('Black-faced Cuckooshrike'), shrikethrush: g('Gray Shrikethrush'),
          spinebill: g('Eastern Spinebill'), babbler: g('Grey-crowned Babbler')
        }));
        """
    )
    # Compound names that really are the bird.
    assert out["woodpigeon"] == "pigeon"
    assert out["brolga"] == "wader", "a Brolga is a crane"
    assert out["capercaillie"] == out["malleefowl"] == out["scrubfowl"] == "gamebird"
    assert out["scaup"] == out["garganey"] == out["corncrake"] == out["nativehen"] == "waterfowl"
    assert out["whimbrel"] == "wader"
    # Compound names that only LOOK like another guild. All passerines.
    for key in ["thornbill", "woodswallow", "cuckooshrike", "shrikethrush", "spinebill", "babbler"]:
        assert out[key] == "songbird", key + " is a songbird, whatever its name contains"


def test_a_vulture_does_not_out_carry_an_eagle_it_outweighs():
    """A griffon is heavier than a sea-eagle and carries far less. Grip decides."""
    out = run_node(
        """
        const core = require('./bird_size_core.js');
        const carry = (massG, carryGuild) => core.carryCapacity({ massG, carryGuild, stamina: 50, level: 1 });
        console.log(JSON.stringify({
          griffon: carry(8000, 'vulture'), seaEagle: carry(5000, 'raptor'),
          osprey: carry(1500, 'osprey'), heronOfAWeight: carry(1500, 'fisher'),
          pelican: carry(5500, 'pouch')
        }));
        """
    )
    assert out["griffon"] < out["seaEagle"], "8 kg of vulture carries less than 5 kg of sea-eagle"
    assert out["osprey"] > out["heronOfAWeight"], "the best feet on the roster tell"
    assert out["pelican"] < out["seaEagle"], "the pouch is drained before take-off"


def test_a_bird_comes_home_with_the_thing_it_was_sent_for():
    """The hold is shared out in proportion to what the bird actually found.

    every-bird-carries-its-weight-v335. Before this, finds were packed first and
    timber kept a single unit back, so a Golden Eagle on a day-long TIMBER
    errand came home with three branches and an armful of moss — and any bird
    with a one-unit hold (nearly half the roster) came back from a FOOD errand
    with two sticks and nothing to eat.
    """
    out = run_node(
        """
        const core = require('./bird_size_core.js');
        const bird = (massG, carryGuild) => ({ massG, carryGuild, stamina: 50, level: 1 });
        // A day-long Branch Run: 90 branches, and moss picked up along the way.
        const timber = { branches: 90, items: { soft_moss: 12 } };
        // An hour on the Bark & Grub Round: food, and a couple of stray twigs.
        const food = { branches: 2, items: { mealworm_scoop: 3 } };
        console.log(JSON.stringify({
          eagleOnTimber: core.applyCarryLimit(timber, bird(4500, 'raptor')),
          robinOnTimber: core.applyCarryLimit(timber, bird(18, 'songbird')),
          robinOnFood: core.applyCarryLimit(food, bird(18, 'songbird')),
          eagleOnFood: core.applyCarryLimit(food, bird(4500, 'raptor'))
        }));
        """
    )
    # A timber errand comes home mostly as timber, and the big bird brings far more.
    assert out["eagleOnTimber"]["branches"] >= 40
    assert out["eagleOnTimber"]["branches"] > out["robinOnTimber"]["branches"] * 10
    assert out["robinOnTimber"]["branches"] > 0, "sent for sticks, comes home with sticks"
    # A food errand comes home as food, even in a one-unit hold.
    assert sum(out["robinOnFood"]["items"].values()) > 0, "sent for supper, comes home with supper"
    assert out["robinOnFood"]["branches"] == 0, "the twigs are what gets dropped, not the food"
    assert sum(out["eagleOnFood"]["items"].values()) >= sum(out["robinOnFood"]["items"].values())


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
    assert [b["size"] for b in order] == ["tiny", "small", "large", "giant"]
    # Magic remains the small bird's edge — but only an edge: it is scaled by
    # size too, so weight still wins a straight fight.
    assert crest["mag"] > eagle["mag"]
    assert eagle["atk"] > crest["mag"]
    # Speed and cleverness are deliberately size-free: a goldcrest still flies
    # rings around an eagle.
    assert crest["spd"] > robin["spd"]


def test_every_companion_is_re_derived_so_old_saves_get_the_size_rule():
    html = HTML.read_text(encoding="utf-8")
    assert "const BIRD_BIOLOGY_STATS_VERSION = 'bird-biology-runtime-v5-every-bird-carries-its-weight-20260827';" in html
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
    # free-birds-v318 retired the Aviary Gardens as a room, and its Head
    # Gardener with it: a free bird holds no job at all. Every room a player
    # can actually build still has a head.
    heads = dict(zip(out["rooms"], out["staffedRooms"]))
    assert heads.pop("outdoors") is None, "being free is not a post"
    # The Project Manager's Office is a licence counter, not another bird post:
    # its birds are appointed out at the village desks it unlocks.
    assert heads.pop("manager_office") is None
    assert None not in heads.values(), "every other buildable room needs a head"
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
    assert "const chef = academyRoleMultiplier('kitchen') * chefCareer.rewardMultiplier;" in html
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


def test_the_appointment_sheet_is_reachable_from_every_surface():
    html = HTML.read_text(encoding="utf-8")
    assert "function rolePostCardHTML(scope, key" in html
    # one-tap-appointments-v319: no surface carries the card inline any more.
    # Every Academy room wears a symbol in the corner of its own picture, and
    # every desk wears a row; both open the one shared sheet.
    assert "function rolePostBadgeHTML(scope, key" in html
    assert "function rolePostRowHTML(scope, key" in html
    assert "function openRolePicker(scope, key, prefix)" in html
    assert "const roleBadge = rolePostBadgeHTML('academy', room);" in html
    assert "rolePostBadgeHTML('academy', 'tavern')" in html
    assert "roleOpenAttrs('academy', 'training', '')" in html      # the Drill Master actor
    # A village's own hall, a Town Hall's heart village, and a region's.
    assert "rolePostRowHTML('village', String(rec.seed >>> 0)" in html
    assert "rolePostRowHTML('village', String(Number(settle.heartSeed) >>> 0)" in html
    assert "rolePostRowHTML('region', String(region.id))" in html
    # The sheet is the only place the card is built for a player to see; the
    # other call is the QA debug hook, which renders nothing on a screen.
    sheet = html[html.index("function rolePickerSheetHTML("):]
    assert "rolePostCardHTML(scope, key) +" in sheet[:sheet.index("\nfunction ")]
    for renderer in ("renderAcademyRoomInterior", "renderVillageManagePanel", "renderRegionScreen", "renderTownScreen"):
        body = html[html.index("function " + renderer + "("):]
        body = body[:body.index("\nfunction ")]
        assert "rolePostCardHTML(" not in body, renderer
    # Assignment runs through one delegated listener, not per-card onclicks.
    assert 'data-action="role-assign"' in html and 'data-action="role-clear"' in html
    assert 'data-action="role-open"' in html and 'data-action="role-picker-close"' in html
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
    # The battle picker reads the same rule through one helper, and Merlin —
    # who holds no post, drill or errand slot — is its only exemption.
    assert "!birdAssignedPost(bird.id) && !birdHasActiveTraining(bird.id) &&" in html
    assert "!birdHasActiveExpedition(bird.id) && !sleepReadinessForBird(bird, now).sleeping" in html
    assert "const flock = roster.filter(b => birdBattleAvailable(b));" in html
    assert "const posted = team.find(b => !isMerlinCompanion(b) && birdAssignedPost(b.id));" in html
    # Role holders cannot silently move into a second post; stand them down first.
    assert "const currentPost = birdAssignedPost(bird.id);" in html
    assert "No companion is free for this post right now" in html
    # Quests, training and battle each keep their own guard; the battle one now
    # reads `bird` rather than `b` because it lives in birdBattleAvailable.
    assert html.count("!birdAssignedPost(b.id)") + html.count("!birdAssignedPost(bird.id)") >= 3
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
    assert f"'./bird_roles_core.js?v={ROLES_CORE_PIN}'" in sw
    html = HTML.read_text(encoding="utf-8")
    assert f'src="bird_size_core.js?v={SIZE_CORE_PIN}"' in html
    assert f'src="bird_roles_core.js?v={ROLES_CORE_PIN}"' in html
