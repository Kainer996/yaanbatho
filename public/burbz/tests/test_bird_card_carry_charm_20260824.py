"""Yaan's ask (2026-08-24), pinned as `bird-card-carry-charm-v313-20260824`:

> "On the birds card please can you include the birds' carrying capacity and
> also charisma please."

The front of a bird card showed ATK · DEF · SPD and nothing else. Charm was
only on the back, and carrying capacity only in the field guide — so the two
numbers that decide who you send on a quest were the two you could not see
while choosing. The stat row is five tiles now: **ATK · DEF · SPD · CHA ·
CARRY**, on every card that carries the row.

- **Companion card** and **Birdex preview card** share the row markup verbatim,
  so both gained it in one edit.
- **Capture celebration card** — the "NEW COMPANION UNLOCKED" card — matches.
- **Silhouette card** shows `?` in all five, so an undiscovered slot is the
  same shape as a known one.

CARRY is loads brought home from a quest, the number the field guide's
"Size & carrying" panel and the quest picker's chip already quote. A
companion's satchel counts, because that is the load it actually flies with.

Yaan then asked for it on the **card back** too, so the stat block there
carries it as well. The eight combat stats pair off two to a row; carrying is
a different kind of number on a different scale, so it spans the full width at
the foot of the block. Its bar runs against `MAX_CARRY_UNITS` read off the
size core, not a literal — raise the ceiling there and every bar moves.

The trap this release had to dodge: a Birdex preview bird is built by
`createBirdFromDiscovery` → `createBirdEntry`, which stamps a **fresh id on
every render** (`Date.now() + hash`). Reading its equipment would have written
a new slot into `gameState.inventory.equipment` each time the codex drew — an
unbounded leak into the save. `birdCardCarryCapacity` therefore consults gear
only for a bird actually in `gameState.flock`, and `birdLoadout` refuses a
falsy id outright.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
SIZE_CORE = ROOT / "bird_size_core.js"

OWN_RELEASE_PIN = "bird-card-carry-charm-v313-20260824"
PREVIOUS_RELEASE_PIN = "nav-action-badges-v312-20260824"
CURRENT_BUILD = "trading-manager-gates-v346-20260903"

STAT_ROW_CARDS = {
    "createBirdCardHTML": "the companion card",
    "createKnownSpeciesCardHTML": "the Birdex preview card",
    "createSilhouetteCard": "the undiscovered silhouette",
}


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


LABEL_OPEN = 'class="card-stat-label">'


def stat_rows(source: str):
    """The tile labels of every card stat row in the file, in document order."""
    marker = '<div class="card-stats-row">'
    rows = []
    for chunk in source.split(marker)[1:]:
        block = chunk[:chunk.index("</div>\n", chunk.rindex("card-stat"))]
        labels = []
        for piece in block.split(LABEL_OPEN)[1:]:
            labels.append(piece[:piece.index("</span>")])
        rows.append(labels)
    return rows


# ---------------------------------------------------------------------------
# The five tiles
# ---------------------------------------------------------------------------

def test_every_card_stat_row_reads_atk_def_spd_cha_carry():
    rows = stat_rows(html_text())
    assert len(rows) == 4, f"expected four cards with a stat row, found {len(rows)}"
    for labels in rows:
        assert labels[:5] == ["ATK", "DEF", "SPD", "CHA", "CARRY"], labels


def test_each_card_that_shows_stats_shows_the_two_new_ones():
    html = html_text()
    for name, what in STAT_ROW_CARDS.items():
        src = function_source(html, name)
        assert 'card-stat-label">CHA<' in src, what
        assert 'card-stat-label">CARRY<' in src, what


def test_the_companion_and_birdex_cards_read_real_values():
    html = html_text()
    for name in ("createBirdCardHTML", "createKnownSpeciesCardHTML"):
        src = function_source(html, name)
        assert "${bird.cha || 0}" in src, name
        assert "${birdCardCarryCapacity(bird)}" in src, name


def test_an_undiscovered_slot_keeps_the_same_shape():
    src = function_source(html_text(), "createSilhouetteCard")
    assert src.count('class="card-stat-label">') == 5
    assert 'card-stat-label">CHA</span>?' in src
    assert 'card-stat-label">CARRY</span>?' in src


def test_the_carry_tile_says_what_the_number_means():
    html = html_text()
    assert 'title="Loads this bird brings home from a quest"' in html


def test_charm_is_not_repeated_in_the_field_guide_hint():
    """CHA has a tile now, so the hint line keeps the stats that do not."""
    src = function_source(html_text(), "createBirdCardHTML")
    hint = src[src.index("card-info-hint"):]
    hint = hint[:hint.index("</div>")]
    assert "MAG" in hint and "INT" in hint and "STAM" in hint
    assert "CHA" not in hint


# ---------------------------------------------------------------------------
# CARRY: what the number is, and the save it must not touch
# ---------------------------------------------------------------------------

def test_carry_is_the_number_the_field_guide_already_quotes():
    """Same core call as the Size & carrying panel and the quest picker chip."""
    html = html_text()
    assert "function birdCardCarryCapacity(bird)" in html
    src = function_source(html, "birdCardCarryCapacity")
    assert "birdSizeSummary(bird)" in src   # a companion's satchel counts
    assert "birdCarryCapacity(bird)" in src  # a preview shows its own back
    core = SIZE_CORE.read_text(encoding="utf-8")
    assert "function carryCapacity(bird, equipmentBonus)" in core


def test_a_bigger_bird_carries_more_and_the_smallest_still_carries_one():
    """A robin carries one, and from there the load climbs all the way up.

    every-bird-carries-its-weight-v335: the old rule was one load per 100 g,
    which flattened everything under a myna to 1 and everything over 2 kg to the
    cap. Weight now runs on a square-root curve anchored on the robin, so the
    middle of the roster actually spreads out.
    """
    loads = run_node(
        f"""
const core = require({json.dumps(str(SIZE_CORE))});
const bird = (massG, stamina) => ({{ massG, stamina, level: 1, carryGuild: 'songbird' }});
process.stdout.write(JSON.stringify({{
  goldcrest: core.carryCapacity(bird(6, 40)),
  robin: core.carryCapacity(bird(18, 50)),
  blackbird: core.carryCapacity(bird(100, 50)),
  jackdaw: core.carryCapacity(bird(250, 50)),
  crow: core.carryCapacity(bird(500, 50)),
  heron: core.carryCapacity(bird(1500, 88)),
  giant: core.carryCapacity(bird(9000, 99)),
  withSatchel: core.carryCapacity(bird(250, 50), 3),
  cap: core.MAX_CARRY_UNITS
}}));
"""
    )
    assert loads["goldcrest"] == 1 == loads["robin"]  # the floor holds them level
    # The rule Yaan asked for: it keeps climbing, with no flat stretch in the middle.
    assert loads["robin"] < loads["blackbird"] < loads["jackdaw"] < loads["crow"] < loads["heron"] < loads["giant"]
    assert loads["withSatchel"] == loads["jackdaw"] + 3
    assert loads["giant"] < loads["cap"], "the cap is a rail; no real bird should reach it"


def test_a_merlin_carries_far_more_than_a_robin_or_a_reed_warbler():
    """Yaan's report: a 180 g falcon hauling the same as an 18 g robin is wrong.

    A Merlin hunts by carrying prey home in its feet, so it lifts a real share
    of its own weight. The old flat rule gave it 2 against a robin's 1.
    """
    loads = run_node(
        f"""
const core = require({json.dumps(str(SIZE_CORE))});
const of = name => {{
  const size = core.speciesSize({{ id: name.toLowerCase().replace(/[^a-z]+/g, '_'), name }});
  return core.carryCapacity({{ massG: size.massG, sizeScore: size.score, carryGuild: size.carryGuild, stamina: 50, level: 1 }});
}};
process.stdout.write(JSON.stringify({{
  reedWarbler: of('Reed Warbler'), robin: of('Robin'), merlin: of('Merlin'),
  kestrel: of('Kestrel'), mallard: of('Mallard'), raven: of('Raven'),
  goldenEagle: of('Golden Eagle'), muteSwan: of('Mute Swan')
}}));
"""
    )
    assert loads["reedWarbler"] == 1 and loads["robin"] == 1
    assert loads["merlin"] >= loads["robin"] + 3      # the complaint, answered
    assert loads["merlin"] == loads["kestrel"]        # two falcons of a weight agree
    # …and a duck of six times the Merlin's weight still carries less, because a
    # webbed foot and a flat bill are no way to hold on to anything.
    assert loads["mallard"] < loads["merlin"]
    assert loads["merlin"] < loads["raven"] < loads["goldenEagle"]
    # All weight, no grip: the heaviest flying bird in the game is not the best hauler.
    assert loads["muteSwan"] < loads["goldenEagle"]


def test_what_a_bird_is_built_to_carry_counts_as_well_as_what_it_weighs():
    """Same weight, different build, different load — the carrying guilds."""
    loads = run_node(
        f"""
const core = require({json.dumps(str(SIZE_CORE))});
const at = guild => core.carryUnitsRaw({{ massG: 1000, carryGuild: guild }});
process.stdout.write(JSON.stringify({{
  raptor: at('raptor'), corvid: at('corvid'), songbird: at('songbird'),
  waterfowl: at('waterfowl'), gamebird: at('gamebird'),
  eagleVsGoose: core.carryCapacity({{ massG: 4500, carryGuild: 'raptor', stamina: 50, level: 1 }})
              - core.carryCapacity({{ massG: 4500, carryGuild: 'waterfowl', stamina: 50, level: 1 }}),
  guilds: Object.keys(core.CARRY_GUILDS).length
}}));
"""
    )
    assert loads["raptor"] > loads["corvid"] > loads["songbird"]
    assert loads["songbird"] > loads["waterfowl"] > loads["gamebird"]
    # A Golden Eagle and a goose of the very same weight are not the same hauler.
    assert loads["eagleVsGoose"] >= 10
    assert loads["guilds"] >= 15


def test_a_birdex_preview_never_writes_to_the_equipment_ledger():
    """A preview bird is rebuilt with a fresh id on every draw of the codex."""
    html = html_text()
    src = function_source(html, "birdCardCarryCapacity")
    # Gear is read only for a bird that is genuinely in the flock.
    assert "gameState.flock" in src
    assert "flock.some(member => member && member.id === bird.id)" in src
    # And the loadout itself turns away a missing id.
    loadout = function_source(html, "birdLoadout")
    assert "if (!birdId) return {};" in loadout
    # The id really is regenerated per render — this is what makes it matter.
    entry = function_source(html, "createBirdEntry")
    assert "id: Date.now() + '_' + hashStr(canonicalName)" in entry


def test_carry_falls_back_to_the_bare_capacity_for_a_stranger():
    src = function_source(html_text(), "birdCardCarryCapacity")
    result = run_node(
        f"""
const core = require({json.dumps(str(SIZE_CORE))});
const birdSizeCore = () => core;
let gearReads = 0;
const birdCarryCapacity = bird => core.carryCapacity(bird);
const birdSizeSummary = bird => {{ gearReads += 1; return core.sizeSummary(bird, 3); }};
let gameState;
{src}
const robin = {{ id:'in-flock', massG:18, stamina:50, level:1 }};
const stranger = {{ id:'preview-9', massG:18, stamina:50, level:1 }};
const nameless = {{ massG:18, stamina:50, level:1 }};
gameState = {{ flock:[robin] }};
const out = {{
  companionCountsItsSatchel: birdCardCarryCapacity(robin),
  previewShowsItsOwnBack: birdCardCarryCapacity(stranger),
  namelessIsSafe: birdCardCarryCapacity(nameless),
  nothingAtAll: birdCardCarryCapacity(null)
}};
gameState = {{}};
out.emptySaveIsSafe = birdCardCarryCapacity(robin);
out.gearReads = gearReads;
process.stdout.write(JSON.stringify(out));
"""
    )
    bare = result["previewShowsItsOwnBack"]
    assert result["companionCountsItsSatchel"] == bare + 3
    assert result["namelessIsSafe"] == bare
    assert result["emptySaveIsSafe"] == bare
    assert result["nothingAtAll"] == 0
    assert result["gearReads"] == 1  # only the bird in the flock was asked


# ---------------------------------------------------------------------------
# The card back
# ---------------------------------------------------------------------------

def back_stats(source: str):
    """The (label, colour) of every stat row on the card back, in order."""
    src = function_source(source, "createBirdCardHTML")
    block = src[src.index('<div class="card-back-stats">'):]
    block = block[:block.index("card-back-special")]
    rows = []
    for piece in block.split('class="card-back-stat-label">')[1:]:
        label = piece[:piece.index("</span>")]
        fill = piece[piece.index("background:var("):]
        rows.append((label, fill[len("background:var("):fill.index(")")]))
    return rows


def test_the_card_back_carries_every_stat_the_front_does():
    rows = back_stats(html_text())
    labels = [label for label, _ in rows]
    assert labels == ["HP", "ATK", "DEF", "SPD", "MAG", "CHA", "INT", "STAM", "CARRY"]
    # Carrying last, and in a colour no combat stat already uses.
    colours = [colour for _, colour in rows]
    assert colours[-1] == "--hp-yellow"
    assert len(set(colours)) == len(colours), colours


def test_carrying_spans_the_block_because_it_is_not_a_combat_stat():
    html = html_text()
    assert ".card-back-stat.is-carry { grid-column:1/-1; }" in html
    src = function_source(html, "createBirdCardHTML")
    assert 'class="card-back-stat is-carry"' in src
    assert '<strong class="card-back-stat-value">${birdCardCarryCapacity(bird)}</strong>' in src


def test_the_back_bar_is_scaled_by_the_cores_own_full_basket_not_a_literal():
    html = html_text()
    src = function_source(html, "birdCardCarryPct")
    # The bar is drawn against a full basket, NOT the hard ceiling — the ceiling
    # is only a rail against bad data and sits far above any real bird.
    assert "core.CARRY_BAR_FULL_UNITS" in src
    assert "core.MAX_CARRY_UNITS" not in src
    assert "${birdCardCarryPct(bird)}%" in function_source(html, "createBirdCardHTML")
    result = run_node(
        f"""
const core = require({json.dumps(str(SIZE_CORE))});
const birdSizeCore = () => core;
const birdCarryCapacity = bird => core.carryCapacity(bird);
const birdSizeSummary = bird => core.sizeSummary(bird, 0);
let gameState = {{ flock: [] }};
{function_source(html_text(), "birdCardCarryCapacity")}
{src}
const at = massG => birdCardCarryPct({{ massG, stamina: 50, level: 1 }});
process.stdout.write(JSON.stringify({{
  goldcrest: at(6), crow: at(500), giant: at(9000),
  barFull: core.CARRY_BAR_FULL_UNITS, rail: core.MAX_CARRY_UNITS
}}));
"""
    )
    # The bar is drawn against the core's own full basket, so these move with it.
    assert 0 < result["goldcrest"] < result["crow"] < result["giant"] <= 100
    assert result["barFull"] == 34       # a well-seasoned sea-eagle fills the basket
    assert result["rail"] > result["barFull"], "the hard ceiling is a rail, not the top of the bar"
    assert result["goldcrest"] == round(1 / result["barFull"] * 100)


# ---------------------------------------------------------------------------
# Release plumbing
# ---------------------------------------------------------------------------

def test_release_is_versioned():
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line       # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)


def test_no_core_pin_moved_because_no_core_changed():
    """v313 was index.html only — every `?v=` stayed where it was.

    The check pins on this release's OWN name, not on the head of the line:
    later releases do change cores, and their `?v=` bumps are none of v313's
    business. What must stay true is that no core was ever pinned to v313.
    """
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    for pinned in (f"action_badge_core.js?v={PREVIOUS_RELEASE_PIN}",
                   "bird_size_core.js?v="):
        assert pinned in html
    assert f"?v={OWN_RELEASE_PIN}" not in html
    assert f"?v={OWN_RELEASE_PIN}" not in sw
