import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SW = ROOT / "sw.js"
DEPLOY_SCRIPT = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"

RELEASE_PIN = "diet-hunger-release-20260723"
CACHE_NAME = "burbz-merlin-animated-rig-v119-20260725"
PINNED_RUNTIME_ASSETS = [
    "academy_treehouse_core.js",
    "kitchen_pantry_core.js",
    "data/bird-diet-records.js",
    "bird_diet_hunger_core.js",
    "diet_hunger_core.js",
    "merlin_companion_core.js",
]
BUILD_ONLY_ASSETS = ["data/bird-diet-records.json"]
MAX_RUNTIME_DIET_JS_BYTES = 1_000_000


def test_index_and_service_worker_share_final_diet_hunger_release_pins():
    html = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")

    assert CACHE_NAME in sw
    assert "burbz-pantry-transaction-v114-20260723" not in sw

    for asset in PINNED_RUNTIME_ASSETS:
        pinned = f"{asset}?v={RELEASE_PIN}"
        assert pinned in html, f"{pinned} is not loaded by index.html"
        assert f"./{pinned}" in sw, f"{pinned} is not referenced by sw.js"

    for asset in BUILD_ONLY_ASSETS:
        assert asset not in html, f"build-only data must not be eagerly loaded: {asset}"
        assert f"./{asset}?v={RELEASE_PIN}" not in sw, f"build-only data must not be precached: {asset}"
    build_json = ROOT / BUILD_ONLY_ASSETS[0]
    assert build_json.stat().st_size <= 4_000_000
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
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=30)
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
      put: async () => {}
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
        capture_output=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert out["opened"] == [CACHE_NAME]
    for asset in PINNED_RUNTIME_ASSETS:
        assert f"./{asset}?v={RELEASE_PIN}" in out["added"]


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
            input=f"new Function({json.dumps(body)});\n",
            capture_output=True,
            timeout=30,
            check=True,
        )
