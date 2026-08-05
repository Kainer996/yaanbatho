"""Adventurer's Diary: an RPG-storybook chronicle of everything the player does.

A new Diary tab renders Merlin's quill-written record of the whole adventure —
every bird discovered and recruited, every battle and liberated town, every
walking quest, expedition, craft, badge and level-up — grouped into day
chapters with a prose summary per day and a "story so far" front page, so
players who put the game down never lose track of where they're up to.
The pure logic lives in diary_core.js; gameplay code appends typed events via
logDiary() and the events persist inside gameState.diary.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
CORE = ROOT / "diary_core.js"


def run_node(script: str) -> dict:
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


# ---------------------------------------------------------------------------
# Wiring: tab, screen, state, script include, service worker
# ---------------------------------------------------------------------------

def test_diary_tab_and_screen_exist():
    html = HTML.read_text(encoding="utf-8")
    assert 'data-screen="diary"' in html
    assert 'aria-label="Diary"' in html
    assert '<div class="nav-label">Diary</div>' in html
    assert 'id="screen-diary"' in html
    assert 'id="diaryBook"' in html
    assert "ADVENTURER'S DIARY" in html


def test_switch_screen_renders_the_diary():
    html = HTML.read_text(encoding="utf-8")
    assert "if (name === 'diary') renderDiary();" in html
    assert "function renderDiary()" in html


def test_diary_state_is_declared_and_healed():
    html = HTML.read_text(encoding="utf-8")
    assert "diary: { entries: [] }" in html  # DEFAULT_STATE
    assert "sanitizeDiaryState(gameState.diary)" in html  # loadState migration
    assert "function logDiary(type, data)" in html


def test_diary_core_is_included_and_cached_offline():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    # The original v200 lineage remains in BURBZ_CACHE, while the script and
    # both offline entries move when its player-facing place copy changes.
    assert 'src="diary_core.js?v=accurate-diets-full-catalogue-v226-20260805"' in html
    assert sw.count("./diary_core.js?v=accurate-diets-full-catalogue-v226-20260805") == 2  # assets + core shell
    assert "restored-lost-features-v200-20260802" in sw  # historical cache lineage


def test_merlin_teaches_the_diary_chapter():
    html = HTML.read_text(encoding="utf-8")
    assert "chapterId:'diary'" in html
    assert "screen:'diary'" in html


# ---------------------------------------------------------------------------
# Gameplay hooks: every notable deed writes a diary event
# ---------------------------------------------------------------------------

def test_all_notable_deeds_are_logged():
    html = HTML.read_text(encoding="utf-8")
    for hook in [
        "logDiary('discover'",     # new species in the Birdex
        "logDiary('recruit'",      # bird joins the flock
        "logDiary('level_up'",     # trainer level up
        "logDiary('bird_level'",   # companion level up
        "logDiary('battle'",       # battle history
        "logDiary('village'",      # sanctuary birdhouse raised
        "logDiary('walk_quest'",   # walking quest completed
        "logDiary('side_quest'",   # side quest ended
        "logDiary('expedition'",   # bird expedition claimed
        "logDiary('clue'",         # Merlin story clue found
        "logDiary('quest_claim'",  # daily/weekly/achievement claimed
        "logDiary('craft'",        # gear forged
        "logDiary('badge'",        # badge earned
        "logDiary('meal'",         # diet mastered at the Kitchen
    ]:
        assert hook in html, f"missing diary hook: {hook}"


def test_boot_migration_discoveries_stay_silent():
    # Flock re-registration at boot must not spam the diary with discoveries:
    # the discover event only fires on the non-silent new-discovery path.
    html = HTML.read_text(encoding="utf-8")
    start = html.index("function rememberDiscoveredBird(")
    end = html.find("\nfunction ", start + 10)
    src = html[start:end]
    assert "if (!existing && !opts.silent) {" in src
    assert "logDiary('discover'" in src


# ---------------------------------------------------------------------------
# Core logic (run in node, like the game itself)
# ---------------------------------------------------------------------------

def test_events_append_sanitize_and_cap():
    out = run_node("""
      const core = require('./diary_core.js');
      const diary = core.sanitizeDiaryState({ entries: ['junk', null, { t: 'NaN' }, { t: 5, type: 'discover', species: 'Wren' }] });
      const healed = diary.entries.length;
      for (let i = 0; i < core.DIARY_ENTRY_LIMIT + 60; i++) core.appendDiaryEvent(diary, { type: 'discover', species: 'B' + i }, 1000 + i);
      const rejected = core.appendDiaryEvent(diary, { notype: true }, 2000);
      console.log(JSON.stringify({ healed, capped: diary.entries.length, limit: core.DIARY_ENTRY_LIMIT, rejected: rejected === null,
        oldestDropped: diary.entries[0].species !== 'Wren' }));
    """)
    assert out["healed"] == 1  # junk filtered, valid entry kept
    assert out["capped"] == out["limit"]  # bounded save size
    assert out["rejected"] is True  # typeless events never enter the diary
    assert out["oldestDropped"] is True  # cap drops the oldest entries first


def test_days_group_into_chapters_newest_first():
    out = run_node("""
      const core = require('./diary_core.js');
      const day1 = new Date(2026, 6, 22, 9, 0).getTime();
      const day2 = new Date(2026, 6, 23, 18, 30).getTime();
      const diary = core.sanitizeDiaryState(null);
      core.appendDiaryEvent(diary, { type: 'craft', item: 'Thorn Talons' }, day1);
      core.appendDiaryEvent(diary, { type: 'discover', species: 'Wren' }, day2);
      core.appendDiaryEvent(diary, { type: 'recruit', species: 'Wren', cost: 150 }, day2 + 60000);
      const days = core.groupEntriesByDay(diary.entries);
      console.log(JSON.stringify({ order: days.map(d => d.key), firstDayCount: days[0].entries.length,
        chronological: days[0].entries[0].type === 'discover',
        heading: core.diaryDayHeading('2026-07-23', day2), yesterday: core.diaryDayHeading('2026-07-22', day2) }));
    """)
    assert out["order"] == ["2026-07-23", "2026-07-22"]  # diary reads backwards
    assert out["firstDayCount"] == 2
    assert out["chronological"] is True  # within a day, events read as the day unfolded
    assert out["heading"] == "Today · the 23rd of July, 2026"
    assert out["yesterday"] == "Yesterday · the 22nd of July, 2026"


def test_diary_lines_read_like_a_storybook():
    out = run_node("""
      const core = require('./diary_core.js');
      const t = new Date(2026, 6, 23, 9, 41).getTime();
      const line = k => core.formatDiaryLine(k);
      console.log(JSON.stringify({
        discover: line({ t, type: 'discover', species: 'Peregrine Falcon', rarity: 'epic' }),
        liberation: line({ t, type: 'battle', won: true, tier: 'Garden Perch', liberated: 'Guildford' }),
        walk: line({ t, type: 'walk_quest', name: 'Riverside Ramble', km: 2.4, markers: 5, markersTotal: 5, xp: 120 }),
        unknown: line({ t, type: 'mystery_event' })
      }));
    """)
    assert "Peregrine Falcon" in out["discover"]["text"]
    assert "a epic" not in out["discover"]["text"].lower()  # article fixed
    assert "Guildford" in out["liberation"]["text"] and out["liberation"]["icon"] == "🕊️"
    assert "Riverside Ramble" in out["walk"]["text"] and "5/5" in out["walk"]["text"]
    assert out["unknown"]["text"]  # unknown types degrade gracefully, never crash


def test_day_chronicle_and_story_so_far_summarise_the_adventure():
    out = run_node("""
      const core = require('./diary_core.js');
      const t = new Date(2026, 6, 23, 9, 0).getTime();
      const entries = [
        { t, type: 'discover', species: 'Wren' }, { t: t + 1, type: 'discover', species: 'Robin' },
        { t: t + 2, type: 'battle', won: true, tier: 'Garden Perch', liberated: 'Guildford' },
        { t: t + 3, type: 'walk_quest', name: 'Loop', km: 2.4, xp: 90 }
      ];
      console.log(JSON.stringify({
        chronicle: core.composeDayChronicle(entries),
        quiet: core.composeDayChronicle([]),
        story: core.diaryStorySoFar(entries, { name: 'Yaan', title: 'Bird Watcher', level: 5, discovered: 12, companions: 3, towns: 2, wins: 8 }),
        blank: core.diaryStorySoFar([], {})
      }));
    """)
    assert "two new species entered the Birdex" in out["chronicle"]
    assert "speciess" not in out["chronicle"]  # plural fixed
    assert "Guildford" in out["chronicle"] and "2.4 km" in out["chronicle"]
    assert "quiet day" in out["quiet"]
    assert "Yaan" in out["story"] and "12 species discovered" in out["story"] and "Merlin" in out["story"]
    assert "first great deed" in out["blank"]  # fresh saves get an inviting front page
