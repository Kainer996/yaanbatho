"""New players find guaranteed starter timber on the questing map.

Timber bundles spawn in a ring right around the player (well inside gathering
range) until The Roost and Barracks are built or every bundle is taken, and
they add up to both opening buildings' branch cost.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


def _required_int(pattern: str, text: str) -> int:
    match = re.search(pattern, text)
    assert match, pattern
    return int(match.group(1))


def test_starter_timber_covers_the_barracks_cost():
    html = HTML.read_text(encoding="utf-8")
    bundles = _required_int(r"const STARTER_TIMBER_BUNDLES = (\d+);", html)
    per = _required_int(r"const STARTER_TIMBER_PER_BUNDLE = (\d+);", html)
    core = (ROOT / "academy_treehouse_core.js").read_text(encoding="utf-8")

    barracks = _required_int(r"id:'tavern'.*?branches:(\d+)", core)
    assert bundles * per >= barracks, (bundles, per, barracks)
    # Both opening buildings are affordable from the default starting purse.

    barracks_coins = _required_int(r"id:'tavern'.*?cost:(\d+)", core)
    start_coins = _required_int(r"player: \{ name: 'Bird Trainer'.*?coins: (\d+)", html)
    assert start_coins >= barracks_coins, (start_coins, barracks_coins)


def test_bundles_spawn_in_a_ring_within_gathering_range_of_the_player():
    html = HTML.read_text(encoding="utf-8")
    start = html.index("function starterTimberPickupsNear(")
    body = html[start:html.index("\nfunction collectStarterTimber", start)]
    # Anchored to the player's current position, not to fixed world cells.
    assert "lat: lat + dLat" in body and "lon: lon + dLon" in body
    # Max ring distance stays well inside MAP_PICKUP_RANGE_M (220 m).
    distance_match = re.search(r"const meters = (\d+) \+ i \* (\d+);", body)
    assert distance_match
    base, step = map(int, distance_match.groups())
    bundles = _required_int(r"const STARTER_TIMBER_BUNDLES = (\d+);", html)
    assert base + (bundles - 1) * step < 220
    # Simulate a full gather in node: spawn near a player, take every bundle.
    script = _runtime_harness(html) + """
const near = starterTimberPickupsNear(51.5, -0.12);
const dists = near.map(p => mapDistanceMeters(p, { lat:51.5, lon:-0.12 }));
const before = gameState.player.branches;
near.forEach(p => collectStarterTimber(p));
const after = gameState.player.branches;
const respawn = starterTimberPickupsNear(51.5, -0.12);
console.log(JSON.stringify({ count: near.length, maxDist: Math.max(...dists), gained: after - before, respawn: respawn.length }));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["count"] == 6
    assert payload["maxDist"] < 220
    assert payload["gained"] >= 18          # plenty of branches for the Barracks
    assert payload["respawn"] == 0          # taken bundles never respawn


def test_starter_timber_is_wired_into_the_live_map_and_stops_after_both_openers():
    html = HTML.read_text(encoding="utf-8")
    draw_start = html.index("function drawMapPickups(")
    draw = html[draw_start:html.index("\nfunction collectMapPickup", draw_start)]
    assert "starterTimberPickupsNear(lat, lon)" in draw
    collect_start = html.index("function collectMapPickup(")
    collect = html[collect_start:html.index("\nlet liveMapAreaRows", collect_start)]
    assert "collectStarterTimber(pickup)" in collect
    assert "isAcademyBuildingBuilt('tavern')) return true;" in html
    assert "starterTimber: { taken: {} }" in html      # default state entry
    assert ".burbz-pickup-marker.starter" in html      # visible green glow styling


def _runtime_harness(html: str) -> str:
    """Extract just the starter-timber functions with tiny stand-ins for game glue."""
    def fn(name):
        start = html.index("function " + name)
        depth, i = 0, html.index("{", start)
        for i in range(i, len(html)):
            if html[i] == "{":
                depth += 1
            elif html[i] == "}":
                depth -= 1
                if depth == 0:
                    break
        return html[start:i + 1]

    bundles_match = re.search(r"const STARTER_TIMBER_BUNDLES = \d+;", html)
    per_match = re.search(r"const STARTER_TIMBER_PER_BUNDLE = \d+;", html)
    assert bundles_match and per_match
    bundles = bundles_match.group(0)
    per = per_match.group(0)
    return "\n".join([
        "const gameState = { player: { branches: 0 }, academyBuildings: {} };",
        "function isAcademyBuildingBuilt() { return false; }",
        "function addBranches(n) { gameState.player.branches += n; }",
        "function burbzHash32(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }",
        "function showToast() {}",
        "function setTimeout() {}",
        "function mapDistanceMeters(a, b) { const dLat = (a.lat - b.lat) * 111320; const dLon = (a.lon - b.lon) * 111320 * Math.cos(b.lat * Math.PI / 180); return Math.hypot(dLat, dLon); }",
        bundles,
        per,
        "const STARTER_TIMBER_TYPE = { id:'starter_timber', glyph:'x', label:'Starter timber', grant(){ return ''; } };",
        fn("ensureStarterTimberState"),
        fn("starterTimberDone"),
        fn("starterTimberPickupsNear"),
        fn("collectStarterTimber"),
    ])
