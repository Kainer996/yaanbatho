import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
OWN_RELEASE_PIN = "empire-clarity-v205-20260803"
CURRENT_BUILD = "quiet-wand-whole-art-v304-20260821"


def html_text() -> str:
    return HTML.read_text(encoding="utf-8")


def function_slice(html: str, name: str, next_name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.index(f"\nfunction {next_name}(", start)
    return html[start:end]


def test_tap_cards_escape_content_and_both_village_hit_targets_share_them():
    html = html_text()
    card = function_slice(html, "showEmpireMapCard", "showEmpireVillageMapCard")
    assert "escapeHtml(f)" in card
    assert "escapeHtml(info.crest" in card
    assert "escapeHtml(a.label" in card
    assert html.count("showEmpireVillageMapCard(village);") == 2


def test_home_village_and_town_or_city_locator_are_separate_targets():
    html = html_text()
    render = function_slice(html, "renderEmpirePanel", "openEmpireRegion")
    assert 'data-action="locator-home"' in render
    assert 'data-action="locator-settlement"' in render
    assert "frameEmpireSettlement(ev.currentTarget.dataset.settlement)" in render
    assert "focusEmpireVillage(ev.currentTarget.dataset.seed)" in render


def test_cycle_countdown_handles_past_boundaries_and_future_device_clocks():
    html = html_text()
    helper = function_slice(html, "empireCycleCountdownMs", "empireNextTributeCountdownMs")
    interval = 8 * 60 * 60 * 1000
    now = 10 * interval
    script = (
        f"const EMPIRE_TRIBUTE_INTERVAL_MS={interval};\n"
        f"{helper}\n"
        f"console.log(JSON.stringify(["
        f"empireCycleCountdownMs({now},{now}),"
        f"empireCycleCountdownMs({now - interval - 30_000},{now}),"
        f"empireCycleCountdownMs({now + 3 * interval},{now})]));"
    )
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == [interval, interval - 30_000, 4 * interval]


def test_strongbox_uses_the_earliest_village_or_caravan_clock():
    html = html_text()
    start = html.index("function empireCycleCountdownMs(")
    end = html.index("\n// Keep the disabled strongbox button honest", start)
    countdown_functions = html[start:end]
    interval = 8 * 60 * 60 * 1000
    now = 10 * interval
    script = f"""
const EMPIRE_TRIBUTE_INTERVAL_MS = {interval};
let villages = [{{lastTributeAt:{now - 2 * 60 * 60 * 1000}}}];
let routes = [{{rec:{{lastTradeAt:{now - 7 * 60 * 60 * 1000}}}}}];
function empireVillages() {{ return villages; }}
function empireTradeRouteRecords() {{ return routes; }}
function realmCore() {{ return {{}}; }}
{countdown_functions}
const earliest = empireNextTributeCountdownMs({now});
villages = [{{lastTributeAt:{now + 9 * 60 * 60 * 1000}}}];
routes = [];
const future = empireNextTributeCountdownMs({now});
console.log(JSON.stringify([earliest, future]));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == [60 * 60 * 1000, 17 * 60 * 60 * 1000]


def test_strongbox_countdown_includes_caravans_and_ticks_to_a_rerender():
    html = html_text()
    countdown_start = html.index("function empireNextTributeCountdownMs(")
    countdown_end = html.index("\n// ============================================================================\n// REALMS & TRADE", countdown_start)
    countdown = html[countdown_start:countdown_end]
    assert "empireTradeRouteRecords().forEach" in countdown
    assert "let empireTributeCountdownTimer = null" in countdown
    assert "setInterval(() =>" in countdown
    assert "renderEmpirePanel();" in countdown
    render = function_slice(html, "renderEmpirePanel", "openEmpireRegion")
    assert "data-empire-tribute-countdown" in render
    assert "data-empire-tribute-at=" in render
    assert "ensureEmpireTributeCountdownTicker()" in render
    assert "stopEmpireTributeCountdownTicker()" in render


def test_idle_countdown_starts_one_timer_and_rerenders_once_when_due():
    html = html_text()
    start = html.index("let empireTributeCountdownTimer = null")
    end = html.index("\n// ============================================================================\n// REALMS & TRADE", start)
    ticker = html[start:end]
    script = f"""
let scheduled = [];
let cleared = [];
let now = 1000;
let renders = 0;
let currentScreen = 'village';
const label = {{dataset:{{empireTributeAt:'5000'}}, textContent:''}};
const document = {{querySelector:() => label}};
const Date = {{now:() => now}};
function setInterval(fn) {{ scheduled.push(fn); return 77; }}
function clearInterval(id) {{ cleared.push(id); }}
function formatBuildCountdown(ms) {{ return String(ms); }}
function renderEmpirePanel() {{ renders += 1; }}
{ticker}
ensureEmpireTributeCountdownTicker();
ensureEmpireTributeCountdownTicker();
now = 2000;
scheduled[0]();
const tickingText = label.textContent;
now = 5000;
scheduled[0]();
console.log(JSON.stringify({{scheduled:scheduled.length, cleared, renders, tickingText, timer:empireTributeCountdownTimer}}));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {
        "scheduled": 1,
        "cleared": [77],
        "renders": 1,
        "tickingText": "— NEXT IN 3000",
        "timer": None,
    }


def test_programmatic_map_focus_dismisses_stale_cards_and_the_key():
    html = html_text()
    pairs = [
        ("frameEmpirePlayer", "frameEmpireTerritory"),
        ("frameEmpireTerritory", "showEmpireWorld"),
        ("showEmpireWorld", "focusEmpireVillage"),
        ("focusEmpireVillage", "frameEmpireRegion"),
        ("frameEmpireRegion", "frameEmpireSettlement"),
        ("frameEmpireSettlement", "refreshEmpireMap"),
    ]
    for name, next_name in pairs:
        body = function_slice(html, name, next_name)
        assert "hideEmpireMapCard();" in body, name
        assert "hideEmpireMapKey();" in body, name


def test_final_release_pin_is_consistent_and_the_provisional_pin_is_gone():
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}'" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE = "))
    assert OWN_RELEASE_PIN in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    provisional_pin = "empire-clarity-v" + "204-20260803"
    assert provisional_pin not in html
    assert provisional_pin not in sw
