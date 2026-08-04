from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


def empire_logic(html: str) -> str:
    start = html.index("// EMPIRE —")
    end = html.index("// ---- Scene state", start)
    return html[start:end]


def test_liberated_towns_start_with_no_residents():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    assert "const VILLAGE_BASE_POPULATION = 0;" in logic
    # A stored population of 0 is valid state, not corruption to heal away.
    assert "Number(eco.population) < 0) eco.population = VILLAGE_BASE_POPULATION" in logic
    assert "Math.max(0, Math.min(VILLAGE_MAX_POPULATION, Math.floor(Number(eco.population))))" in logic


def test_shelter_and_residents_come_only_from_built_homes():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    assert "shelter: 0" in logic  # no free housing before the player builds
    # The stubborn-few floor steadies settled towns but never conjures
    # settlers into an empty province with no homes raised.
    sim_start = logic.index("function simulateVillageEconomy(")
    sim_end = logic.index("\nfunction simulateAllVillageEconomies", sim_start)
    sim = logic[sim_start:sim_end]
    assert "const floor = Math.min(eco.population, VILLAGE_MIN_POPULATION);" in sim
    assert "Math.max(VILLAGE_MIN_POPULATION," not in sim


def test_finishing_shelter_moves_new_residents_in():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    done_start = logic.index("function empireCompleteConstructions(")
    done_end = logic.index("\nfunction tickEmpireConstruction", done_start)
    done = logic[done_start:done_end]
    assert "building.need === 'shelter'" in done
    assert "eco.population += movedIn;" in done
    assert "move in!" in done


def test_empty_provinces_pay_no_taxes_and_say_why():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    snap_start = logic.index("function villageEconomySnapshot(")
    snap_end = logic.index("\n// Population drifts", snap_start)
    snap = logic[snap_start:snap_end]
    assert "pop <= 0 ? 0" in snap
    assert snap.count("pop <= 0 ? 0") == 2  # both taxes and branches gate on residents
    assert "no residents yet" in logic
    assert "Cottage Row</b> and residents will move in" in logic
    assert "build homes" in logic


def test_liberation_toast_explains_the_village_starts_empty():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    claim_start = logic.index("function claimCurrentVillage(")
    claim_end = logic.index("\nfunction renderVillageClaimBar", claim_start)
    claim = logic[claim_start:claim_end]
    assert "The village stands empty" in claim
    assert "residents will move in" in claim
