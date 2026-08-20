"""Every bird can be loved (bird-bond-love-v256-20260812).

Players grow attached to different birds, so every companion now carries its
own bond: a favourite heart that leads the flock, a bond level with a warm
title (New Friend through Soulbound), and a preen ritual on the equipment
screen. Feeding a companion quietly deepens the bond the way it always did
for Merlin. Bond is affection only — it never touches battle stats.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
CORE = (ROOT / "bird_bond_core.js").read_text(encoding="utf-8")
UPDATER = (ROOT.parents[1] / "scripts" / "update-live-burbz.sh").read_text(encoding="utf-8")
OWN_RELEASE_PIN = "bird-bond-love-v256-20260812"
PREVIOUS_RELEASE_PIN = "raven-weight-and-wit-v255-20260812"
CURRENT_BUILD = "burbz-zombie-canon-v291-20260820"


def _node(source: str):
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, check=True, capture_output=True, text=True
    )
    return json.loads(result.stdout.strip().splitlines()[-1])


# ---------------------------------------------------------------- the core


def test_old_saves_wake_up_as_level_one_new_friends():
    out = _node(r"""
const B = require('./bird_bond_core.js');
const fresh = B.sanitizeBond(undefined);
const junk = B.sanitizeBond({ level: 99, xp: -4, favourite: 'yes', lastPreenAt: 'never', preens: 2.9 });
console.log(JSON.stringify({
  fresh,
  junkLevel: junk.level, junkXp: junk.xp, junkFav: junk.favourite,
  junkPreenAt: junk.lastPreenAt, junkPreens: junk.preens,
  title: B.bondTitle(1), topTitle: B.bondTitle(5)
}));
""")
    assert out["fresh"] == {"level": 1, "xp": 0, "favourite": False, "lastPreenAt": None, "preens": 0}
    assert out["junkLevel"] == 5      # clamped to the top, never beyond
    assert out["junkXp"] == 0         # max level holds no spare XP
    assert out["junkFav"] is False    # only a real true counts
    assert out["junkPreenAt"] is None
    assert out["junkPreens"] == 2
    assert out["title"] == "New Friend"
    assert out["topTitle"] == "Soulbound"


def test_bond_xp_levels_up_and_stops_at_soulbound():
    out = _node(r"""
const B = require('./bird_bond_core.js');
const up = B.grantBondXp({ level: 1, xp: 90 }, 20);
const flood = B.grantBondXp({ level: 1, xp: 0 }, 100000);
const progress = B.bondProgress({ level: 2, xp: 50 });
const maxed = B.bondProgress(flood);
console.log(JSON.stringify({ up, floodLevel: flood.level, floodXp: flood.xp, progress, maxedMax: maxed.max, maxedPct: maxed.pct }));
""")
    assert out["up"]["level"] == 2 and out["up"]["xp"] == 10
    assert out["floodLevel"] == 5 and out["floodXp"] == 0
    assert out["progress"]["title"] == "Companion"
    assert out["progress"]["pct"] == 50
    assert out["maxedMax"] is True and out["maxedPct"] == 100


def test_preen_grants_bond_then_asks_for_patience():
    out = _node(r"""
const B = require('./bird_bond_core.js');
const t0 = 1000000000000;
const first = B.preen({ level: 1, xp: 0 }, t0);
const tooSoon = B.preen(first.bond, t0 + 60 * 60 * 1000);
const later = B.preen(first.bond, t0 + B.PREEN_COOLDOWN_MS);
console.log(JSON.stringify({
  ok: first.ok, xp: first.bond.xp, preens: first.bond.preens, stamped: first.bond.lastPreenAt === t0,
  blocked: !tooSoon.ok, wait: B.describeWait(tooSoon.remainingMs),
  againOk: later.ok, againPreens: later.bond.preens
}));
""")
    assert out["ok"] is True
    assert out["xp"] == 20            # PREEN_BOND_XP
    assert out["preens"] == 1
    assert out["stamped"] is True
    assert out["blocked"] is True
    assert out["wait"] == "3h"        # 4h cooldown minus the hour that passed
    assert out["againOk"] is True and out["againPreens"] == 2


def test_the_wait_copy_reads_like_a_person_wrote_it():
    out = _node(r"""
const B = require('./bird_bond_core.js');
console.log(JSON.stringify([B.describeWait(30000), B.describeWait(35 * 60000), B.describeWait(192 * 60000)]));
""")
    assert out == ["under a minute", "35m", "3h 12m"]


def test_the_core_exposes_the_full_bond_api():
    out = _node(r"""
const B = require('./bird_bond_core.js');
console.log(JSON.stringify({
  keys: ['sanitizeBond','bondTitle','bondProgress','grantBondXp','canPreen','preen','describeWait'].every(k => typeof B[k] === 'function'),
  levels: B.MAX_BOND_LEVEL, perLevel: B.XP_PER_BOND_LEVEL,
  cooldownHours: B.PREEN_COOLDOWN_MS / 3600000,
  titles: B.BOND_TITLES
}));
""")
    assert out["keys"] is True
    assert out["levels"] == 5 and out["perLevel"] == 100
    assert out["cooldownHours"] == 4
    assert out["titles"] == ["New Friend", "Companion", "Close Friend", "Beloved", "Soulbound"]


# ---------------------------------------------------------------- the app


def test_the_equipment_screen_grew_a_bond_panel():
    assert '<script src="bird_bond_core.js?v=bird-bond-love-v256-20260812"></script>' in HTML
    assert 'class="bird-equip-section-label">Bond</div>' in HTML
    assert 'onclick="birdEquipPreen()"' in HTML
    assert 'onclick="birdEquipToggleFavourite()"' in HTML
    assert "Preening and good meals deepen the bond. It never fades." in HTML
    assert "function spawnBondHearts()" in HTML
    assert "bondHeartFloat" in HTML


def test_favourites_lead_the_flock_and_wear_a_heart():
    assert "(birdIsFavourite(b) ? 1 : 0) - (birdIsFavourite(a) ? 1 : 0) || (b.power || 0) - (a.power || 0)" in HTML
    assert 'card-fav-heart' in HTML
    assert 'data-action="toggle-favourite"' in HTML
    assert "e.target.closest('[data-action=\"toggle-favourite\"]')" in HTML
    assert "cardBondHeartsHTML(bird)" in HTML


def test_every_companion_is_healed_into_a_bond_on_load():
    assert "gameState.flock.forEach(ensureBirdBond);" in HTML
    assert "function ensureBirdBond(bird)" in HTML


def test_feeding_a_companion_deepens_the_bond_like_merlin():
    # The three kitchen feed paths reuse the same bondXp Merlin already earns,
    # and the Academy tray path uses the core's feed constant.
    assert HTML.count("grantBirdBondXp(bird, reward.bondXp); // companions bond over meals, same as Merlin") == 3
    assert HTML.count("grantBirdBondXp(bird, (birdBondCore() || {}).FEED_BOND_XP || 6); // a good meal deepens the bond") == 2


def test_the_inline_handlers_are_exported_for_onclick():
    export = HTML[HTML.index("openBirdEquip, closeBirdEquip"):]
    export = export[:export.index("});")]
    for name in ("toggleFavouriteBird", "birdEquipToggleFavourite", "birdEquipPreen"):
        assert name in export


# ---------------------------------------------------------------- release


def test_release_pins():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(line for line in SW.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert CURRENT_BUILD in cache_line  # head build reaches players
    assert f"./bird_bond_core.js?v={OWN_RELEASE_PIN}" in SW
    assert SW.count("bird_bond_core.js") == 2  # both precache lists
    assert '"bird_bond_core.js"' in UPDATER  # the live updater ships the new core
