"""The Kitchen's feeding table reads clean and scrolls with the screen.

Yaan's asks (2026-08-27, from a Kitchen screenshot). Pinned as
`kitchen-clean-table-v333`:

- The companion feeding table is no longer a list scrolling inside the
  screen — one scroll for the whole Kitchen.
- A bird called by its own species name no longer says that name twice;
  the species line stays only when it adds something (a renamed bird,
  Merlin's Latin name).
- "Full — optional top-ups still use one ingredient" is gone. A full bar
  carries no caption at all; the working captions stay.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
RELEASE = "kitchen-clean-table-v333-20260827"
CURRENT_BUILD = "empire-three-pages-v343-20260901"


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, check=False, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


# ---------------------------------------------------------------------------
# 1. One scroll for the whole Kitchen
# ---------------------------------------------------------------------------

def test_roster_list_no_longer_scrolls_inside_the_screen():
    html = HTML.read_text(encoding="utf-8")
    rule = re.search(r"^\.kitchen-roster-list \{[^}]*\}", html, re.M).group(0)
    assert "max-height" not in rule
    assert "overflow" not in rule
    assert "flex-direction:column" in rule  # still the same stacked list


# ---------------------------------------------------------------------------
# 2. The name reads once
# ---------------------------------------------------------------------------

def entries_harness(probe: str) -> str:
    html = HTML.read_text(encoding="utf-8")
    return """
global.window = global;
const gameState = { flock: [
  { id: 'a', species: 'Carrion Crow', commonName: 'Carrion Crow' },
  { id: 'b', species: 'European Robin', commonName: 'European Robin', customName: 'Pip' },
] };
const birdDisplayName = bird => bird.customName || bird.commonName || bird.species;
const canonicalSpeciesName = name => name || '';
""" + function_source(html, "kitchenRosterEntries") + "\n" + probe


def test_species_line_stays_only_when_it_adds_something():
    out = run_node(entries_harness("""
const rows = kitchenRosterEntries();
console.log(JSON.stringify({
  merlin: rows[0].speciesLine,
  sameName: rows[1].speciesLine,
  renamed: rows[2].speciesLine,
  names: rows.map(r => r.name),
}));
"""))
    assert out["merlin"] == "Falco columbarius · permanent companion"
    assert out["sameName"] == ""              # never the same name twice
    assert out["renamed"] == "European Robin"  # a nickname keeps its species
    assert out["names"] == ["Merlin", "Carrion Crow", "Pip"]


def test_row_omits_the_species_div_when_the_line_is_empty():
    html = HTML.read_text(encoding="utf-8")
    row = function_source(html, "kitchenRosterRowHTML")
    assert "entry.speciesLine ? '<div class=\"kitchen-roster-species\">" in row


# ---------------------------------------------------------------------------
# 3. A full bar carries no caption
# ---------------------------------------------------------------------------

def hunger_harness(probe: str) -> str:
    html = HTML.read_text(encoding="utf-8")
    return """
global.window = global;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const escapeHtml = s => String(s);
""" + function_source(html, "hungerBarHTML") + "\n" + probe


def test_full_bar_is_silent_and_working_captions_stay():
    out = run_node(hunger_harness("""
const full = hungerBarHTML({ hunger: 0, level: 'fed' }, 'kitchen-roster');
const peckish = hungerBarHTML({ hunger: 30, level: 'peckish' }, 'kitchen-roster');
const urgent = hungerBarHTML({ hunger: 90, level: 'urgent', blocksWork: true }, 'kitchen-roster');
console.log(JSON.stringify({
  fullHasNote: full.includes('bird-hunger-note'),
  fullHasCopy: full.includes('optional top-ups'),
  peckishNote: peckish.includes('Feed anytime — each tap uses one whole ingredient'),
  urgentNote: urgent.includes('Feed before quests or training'),
}));
"""))
    assert out["fullHasNote"] is False   # no caption at all when full
    assert out["fullHasCopy"] is False
    assert out["peckishNote"] is True
    assert out["urgentNote"] is True


def test_the_old_copy_is_gone_from_the_game():
    html = HTML.read_text(encoding="utf-8")
    assert "optional top-ups still use one ingredient" not in html


# ---------------------------------------------------------------------------
# 4. The release pins
# ---------------------------------------------------------------------------

def test_release_pins():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if "const BURBZ_CACHE" in line)
    assert RELEASE in cache_line  # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
