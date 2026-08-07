import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SW = ROOT / "sw.js"
DEPLOY_SCRIPT = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"

RELEASE_PIN = "diet-hunger-release-20260723"
CACHE_MATCH = re.search(r"const BURBZ_CACHE = '([^']+)'", SW.read_text(encoding="utf-8"))
assert CACHE_MATCH is not None
CACHE_NAME = CACHE_MATCH.group(1)
# The point of this list is that index.html and sw.js never drift apart on a
# runtime asset — not that every asset stays frozen on the diet-hunger pin.
# merlin_companion_core.js has moved on since (shorter Merlin speech), so it
# carries its own pin and is checked the same way.
PINNED_RUNTIME_ASSETS = {
    # The quest board moved on with the categorised errands + one quest per
    # crafting material, so the Academy core carries its own pin now.
    "academy_treehouse_core.js": "living-canopy-v236-20260806",
    "kitchen_pantry_core.js": RELEASE_PIN,
    "data/bird-diet-records.js": "accurate-diets-full-catalogue-v226-20260805",
    "bird_diet_hunger_core.js": "accurate-diets-full-catalogue-v226-20260805",
    "diet_hunger_core.js": RELEASE_PIN,
    "merlin_companion_core.js": "reconciled-release-v170-20260729",
}
BUILD_ONLY_ASSETS = ["data/bird-diet-records.json"]
# The runtime diet payload now carries a real source-backed record for EVERY
# playable bird (the 951 profiles plus ~400 catalogue birds from the UK/AU
# expansions and the BOU alias overlay), so nothing falls through to the generic
# unmatched menu. Catalogue records are trimmed to the fields the game actually
# uses, so full coverage costs the browser ~1 MB (well under 200 KB gzipped on
# the wire). The build-only JSON keeps the fuller records for review.
MAX_RUNTIME_DIET_JS_BYTES = 1_150_000
MAX_BUILD_DIET_JSON_BYTES = 6_000_000


def test_index_and_service_worker_share_final_diet_hunger_release_pins():
    html = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")

    assert CACHE_NAME in sw
    assert "burbz-pantry-transaction-v114-20260723" not in sw

    for asset, pin in PINNED_RUNTIME_ASSETS.items():
        pinned = f"{asset}?v={pin}"
        assert pinned in html, f"{pinned} is not loaded by index.html"
        assert f"./{pinned}" in sw, f"{pinned} is not referenced by sw.js"

    for asset in BUILD_ONLY_ASSETS:
        assert asset not in html, f"build-only data must not be eagerly loaded: {asset}"
        assert f"./{asset}?v={RELEASE_PIN}" not in sw, f"build-only data must not be precached: {asset}"
    build_json = ROOT / BUILD_ONLY_ASSETS[0]
    assert build_json.stat().st_size <= MAX_BUILD_DIET_JSON_BYTES
    assert "sourceRecords" not in json.loads(build_json.read_text(encoding="utf-8"))

    stale_pins = [
        "kitchen-pantry-20260722",
        "diet-hunger-20260723",
        "merlin-tamagotchi-v1-20260723",
    ]
    for pin in stale_pins:
        assert pin not in html
        assert pin not in sw


def test_live_deploy_script_fetches_every_new_diet_runtime_dependency():
    deploy = DEPLOY_SCRIPT.read_text(encoding="utf-8")
    for asset in (
        "bird_diet_hunger_core.js",
        "diet_hunger_core.js",
        "data/bird-diet-records.js",
    ):
        assert f'"{asset}"' in deploy


def test_browser_diet_payload_is_compact_and_excludes_global_source_table():
    runtime_js = ROOT / "data" / "bird-diet-records.js"
    assert runtime_js.stat().st_size <= MAX_RUNTIME_DIET_JS_BYTES
    result = subprocess.run(
        ["node", "-e", "const p=require('./data/bird-diet-records.js'); console.log(JSON.stringify({records:p.records.length, sourceRecords:p.sourceRecords.length}));"],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    counts = json.loads(result.stdout)
    assert counts["records"] == 952
    assert 0 < counts["sourceRecords"] < 400


def test_compact_runtime_resolves_every_legacy_wild_bird_name():
    html = INDEX.read_text(encoding="utf-8")
    block = re.search(r"const WILD_BIRDS\s*=\s*\[(.*?)\n\];", html, flags=re.S)
    assert block
    names = re.findall(r"'([^']+)'", block.group(1))
    script = f"""
require('./data/bird-diet-records.js');
const D = require('./bird_diet_hunger_core.js');
const names = {json.dumps(names)};
console.log(JSON.stringify(names.filter(name => !D.getDietRecord({{ commonName:name, name }}))));
"""
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=30
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == []


def test_service_worker_precaches_diet_hunger_release_assets():
    script = r"""
const fs = require('fs');
const vm = require('vm');
const listeners = {};
const expansion = { art: {} };
const opened = [];
const added = [];
const self = {
  BURBZ_UK_BIRD_EXPANSION_50: expansion,
  BURBZ_UK_BIRD_EXPANSION_26: expansion,
  BURBZ_AU_BIRD_EXPANSION: expansion,
  BURBZ_UK_BIRD_EXPANSION_FINAL: expansion,
  BURBZ_AU_BIRD_EXPANSION_50: expansion,
  BURBZ_NATIONAL_BIRD_COMPLETION_20260715: expansion,
  BURBZ_UK_BIRD_EXPANSION_4: expansion,
  addEventListener: (name, fn) => { listeners[name] = fn; },
  clients: { claim: async () => {} },
  skipWaiting: async () => {},
  location: { origin: 'http://localhost:4173' }
};
const caches = {
  open: async name => {
    opened.push(name);
    return {
      add: async asset => { added.push(asset); },
      // The install fetches each shell entry with cache:'reload' and puts the
      // fresh copy, so precaching is observed on put(), not add().
      put: async (asset) => { added.push(typeof asset === 'string' ? asset : asset.url); }
    };
  },
  keys: async () => [],
  match: async () => null
};
const sandbox = {
  self,
  caches,
  importScripts: () => {},
  console,
  URL,
  Response,
  fetch: async () => new Response('ok')
};
vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), sandbox, { filename: 'sw.js' });
let installWork;
listeners.install({ waitUntil: promise => { installWork = promise; } });
Promise.resolve(installWork)
  .then(() => console.log(JSON.stringify({ opened, added })))
  .catch(err => { console.error(err); process.exit(1); });
"""
    result = subprocess.run(
        ["node", "-e", script],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert out["opened"] == [CACHE_NAME]
    for asset, pin in PINNED_RUNTIME_ASSETS.items():
        assert f"./{asset}?v={pin}" in out["added"]


def test_protected_regression_references_remain_in_the_app_shell():
    html = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    combined = html + "\n" + sw

    protected_markers = [
        "const MERLIN_GUIDE",
        "Falco columbarius",
        "BirdNET",
        "camera-only",
        "pair_of_tits",
        "national_bird_completion_20260715.js",
        "WILD_BIRDS.length",
        "recordSoundSessionDiscovery",
        'data-scan-path="camera-only"',
        "serviceWorker.register('./sw.js'",
    ]
    missing = [marker for marker in protected_markers if marker not in combined]
    assert not missing, "Missing protected Burbz markers: " + ", ".join(missing)

    script_bodies = re.findall(r"<script>(.*?)</script>", html, flags=re.S)
    assert script_bodies
    for body in script_bodies:
        subprocess.run(
            ["node", "-"],
            cwd=ROOT,
            text=True,
            encoding="utf-8",
            input=f"new Function({json.dumps(body)});\n",
            capture_output=True,
            timeout=30,
            check=True,
        )
