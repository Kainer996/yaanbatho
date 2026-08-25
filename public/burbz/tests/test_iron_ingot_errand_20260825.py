# -*- coding: utf-8 -*-
"""A bird can fetch an Iron Ingot (iron-ingot-errand-v326-20260825).

The gap this release closes: the Iron Foundry was added to the village build
list and it pours Iron Ingots, but nothing ever went out and FETCHED one. Every
other crafting material in the game has a named errand — that is a rule the
suite already enforced, and iron_ingot had been failing it since the Foundry
landed.

The fix is one errand, the Foundry Ingot Pour, built to the same shape as the
other materials quests: the material it targets, a length that tracks its
rarity, and a level gate that matches the other uncommons.
"""
import json
import subprocess
from pathlib import Path

BURBZ = Path(__file__).resolve().parent.parent
CURRENT_BUILD = "free-your-first-village-v327-20260825"


def node_json(script):
    out = subprocess.run(
        ["node", "-e", script], cwd=str(BURBZ), capture_output=True, text=True, timeout=60
    )
    assert out.returncode == 0, out.stderr
    return json.loads(out.stdout)


def template():
    return node_json(
        """
        const A = require('./academy_treehouse_core.js');
        const t = A.getQuestTemplates().find(q => q.id === 'ingot_pour');
        console.log(JSON.stringify(t || null));
        """
    )


def test_the_errand_exists_and_targets_the_iron_ingot():
    t = template()
    assert t, "ingot_pour must exist"
    assert t["material"] == "iron_ingot"
    assert t["category"] == "materials"
    assert "iron_ingot" in t["items"]


def test_it_is_priced_and_paced_like_the_other_uncommon_materials():
    # Moon Dust (40m) and Storm Glass (50m) are the other two uncommons. The
    # ingot sits between them on every dial, so rarity still reads off length.
    rows = node_json(
        """
        const A = require('./academy_treehouse_core.js');
        const pick = id => { const t = A.getQuestTemplates().find(q => q.id === id);
          return { id, minutes:t.minutes, minLevel:t.minLevel, xp:t.xp, starter:!!t.starter }; };
        console.log(JSON.stringify(['moondust_sweep','ingot_pour','stormglass_hunt'].map(pick)));
        """
    )
    dust, ingot, glass = rows
    assert dust["minutes"] < ingot["minutes"] < glass["minutes"]
    assert dust["xp"] < ingot["xp"] < glass["xp"]
    assert ingot["minLevel"] == dust["minLevel"] == glass["minLevel"] == 2
    # Uncommon, so it is NOT a day-one starter — only the commons are.
    assert ingot["starter"] is False


def test_a_bird_sent_on_it_actually_brings_ingots_home():
    # The whole point. Run the real expedition many times and count what lands.
    data = node_json(
        """
        const A = require('./academy_treehouse_core.js');
        const bird = { id:'b1', commonName:'Robin', cha:60, int:80 };
        let runsWithIngot = 0, ingots = 0;
        const RUNS = 200;
        for (let i = 0; i < RUNS; i++) {
          let e = A.createBirdExpedition(bird, 'ingot_pour', 1000000 + i * 7919, { durationMinutes: 60 });
          e = A.advanceBirdExpedition(e, e.endsAt + 1000);
          const items = (e.rewards && e.rewards.items) || {};
          if (items.iron_ingot) { runsWithIngot += 1; ingots += items.iron_ingot; }
        }
        console.log(JSON.stringify({ RUNS, runsWithIngot, ingots }));
        """
    )
    assert data["ingots"] > 0, "the errand must actually deliver iron ingots"
    # An hour out should pay off far more often than not.
    assert data["runsWithIngot"] > data["RUNS"] * 0.5, data


def test_the_foundry_still_pours_them_too():
    # The errand is a second road, not a replacement: the Iron Foundry building
    # keeps producing ingots exactly as it did.
    index = (BURBZ / "index.html").read_text(encoding="utf-8")
    assert "produces: { materials: { iron_ingot: 1 } }" in index
    assert "'Iron Foundry'" in index


def test_the_release_is_pinned():
    index = (BURBZ / "index.html").read_text(encoding="utf-8")
    sw = (BURBZ / "sw.js").read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in index
    assert CURRENT_BUILD in sw
