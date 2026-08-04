"""Delamere bird-generation: seasonal availability is separated from rarity.

The "Area Birds" panel used to label every species by a single all-time
commonness score, so a winter-only duck (Eurasian Wigeon) or an irruptive
winter finch (Bohemian Waxwing) showed as "Regular"/"Uncommon" on 1 August,
and nothing was ever excluded for being out of season.

bird_seasonality_core.js computes a candidate probability

    p = local occurrence x week-of-year x habitat match x time-of-day detectability

and drives both exclusion (when the seasonal/habitat term is ~0) and the
displayed rarity label. These tests pin the reference scenario the task
specifies: Delamere Forest, 1-7 August.
"""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "bird_seasonality_core.js"
HTML = ROOT / "index.html"

# Delamere Forest, Cheshire — early August (week 31).
DELAMERE_LAT, DELAMERE_LON = 53.22, -2.68
AUG_WEEK = 31


def _eval(script: str):
    result = subprocess.run(
        ["node", "-e", script],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def _score(species, habitat, hour=13, week=AUG_WEEK):
    script = (
        "const S=require('./bird_seasonality_core.js');"
        f"const ctx={{week:{week},hour:{hour},habitat:{json.dumps(habitat)}}};"
        f"const c=S.candidateProbability({json.dumps(species)},ctx);"
        "console.log(JSON.stringify({"
        f"present:S.isPresent({json.dumps(species)},ctx),"
        f"label:S.rarityLabel({json.dumps(species)},ctx),"
        "p:c.p,week:c.weekProbability,hab:c.habitatMatch,det:c.detectability,occ:c.localOccurrence}));"
    )
    return _eval(script)


def test_module_loads_under_node():
    version = _eval(
        "const S=require('./bird_seasonality_core.js');console.log(JSON.stringify(S.version));"
    )
    assert version.startswith("bird-seasonality-")


def test_aug_first_is_week_31():
    wk = _eval(
        "const S=require('./bird_seasonality_core.js');"
        "console.log(JSON.stringify(S.weekOfYear(new Date(2026,7,1))));"
    )
    assert wk == AUG_WEEK


# --- The seven reference species, Delamere, 1-7 August ----------------------

def test_mistle_thrush_is_regular():
    r = _score("Mistle Thrush", "woodland")
    assert r["present"] is True
    assert r["label"] == "regular"


def test_hobby_is_uncommon():
    r = _score("Hobby", "wetland")
    assert r["present"] is True
    assert r["label"] == "uncommon"


def test_woodcock_is_rare_by_day_and_uncommon_at_dusk():
    day = _score("Woodcock", "woodland", hour=13)
    dusk = _score("Woodcock", "woodland", hour=20)
    # Present all day (resident), but detectability, not season, sets the label.
    assert day["present"] is True and dusk["present"] is True
    assert day["label"] == "rare"
    assert dusk["label"] == "uncommon"
    assert dusk["det"] > day["det"]


def test_mediterranean_gull_only_around_water():
    on_water = _score("Mediterranean Gull", "water")
    on_wood = _score("Mediterranean Gull", "woodland")
    assert on_water["present"] is True
    assert on_water["label"] == "uncommon"
    # Away from the mere (Blakemere) it is not offered at all.
    assert on_wood["present"] is False
    assert on_wood["hab"] == 0


def test_yellowhammer_uncommon_on_edges_not_woodland_interior():
    edge = _score("Yellowhammer", "farmland")
    interior = _score("Yellowhammer", "woodland")
    assert edge["present"] is True
    assert edge["label"] == "uncommon"
    # Deep woodland is not its habitat: far rarer / effectively edge-only.
    assert interior["label"] in {"rare", "scarce"}
    assert interior["p"] < edge["p"]


def test_eurasian_wigeon_unavailable_in_august():
    for habitat in ("water", "wetland", "coast"):
        r = _score("Eurasian Wigeon", habitat)
        assert r["present"] is False, habitat
        # Excluded because the WEEK term is ~0, not because it is "rare".
        assert r["week"] < 0.05


def test_bohemian_waxwing_unavailable_in_august():
    for habitat in ("urban", "park", "woodland"):
        r = _score("Bohemian Waxwing", habitat)
        assert r["present"] is False, habitat
        assert r["week"] < 0.05


# --- Structural guarantees --------------------------------------------------

def test_seasonal_availability_is_separate_from_rarity():
    """A winter duck and a summer migrant flip availability across the year
    while an all-time score never would."""
    wigeon_summer = _score("Eurasian Wigeon", "water", week=31)
    wigeon_winter = _score("Eurasian Wigeon", "water", week=2)
    assert wigeon_summer["week"] < 0.05 < wigeon_winter["week"]

    hobby_summer = _score("Hobby", "wetland", week=31)
    hobby_winter = _score("Hobby", "wetland", week=2)
    assert hobby_winter["week"] < 0.05 < hobby_summer["week"]


def test_common_residents_stay_common_with_host_hints():
    # index.html passes commonness + habitats from the field-guide profile.
    script = (
        "const S=require('./bird_seasonality_core.js');"
        "const ctx={week:31,hour:13,habitat:'woodland',"
        "hints:{commonness:96,habitats:['woodland','park','farmland','urban']}};"
        "console.log(JSON.stringify(S.rarityLabel('Blackbird',ctx)));"
    )
    assert _eval(script) == "common"


def test_status_inferred_from_profile_text_for_unlisted_species():
    # A species NOT in the explicit table is still gated from its status text.
    winter = _eval(
        "const S=require('./bird_seasonality_core.js');"
        "console.log(JSON.stringify(S.isPresent('Some Winter Duck',"
        "{week:31,habitat:'water',hints:{commonness:50,habitats:['water'],"
        "statusText:'Winter Visitor to the UK'}})));"
    )
    assert winter is False


# --- index.html wiring ------------------------------------------------------

def test_index_html_wires_the_seasonality_engine():
    html = HTML.read_text(encoding="utf-8")
    assert "bird_seasonality_core.js" in html
    # Spawn generation gates on seasonal presence.
    assert "seasonallyAbsentHere(species, habitat, week)" in html
    # The area-bird panel derives its label from the engine, not the all-time
    # score, and week/detectability feed the roll-up.
    assert "rarityLabelForProbability" in html
    assert "candidateProbability(row.species" in html
    assert "PRESENCE_FLOOR" in html


def test_module_referenced_before_alias_completion_script():
    html = HTML.read_text(encoding="utf-8")
    assert html.index("bird_seasonality_core.js") < html.index("uk_bird_alias_completion")
