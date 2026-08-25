"""A bird with no job is free, and the game says so.

Yaan's ask (2026-08-24), pinned as `free-birds-v318-20260824`:

> "The birds are in a room called the Aviary Gardens. The Aviary Gardens
> shouldn't even be a room. The bird should just be free... If the birds are
> in the aviary garden, make them just be free, not doing anything, and make
> them top of the list for doing any sort of quests or anything or being
> assigned to anything. Also have the red notification on the birds tab show
> that there are birds not assigned to anything."

`outdoors` was never really a room — it is where a bird stands when nobody
has given it a job. This release stops calling that a place:

1. The Aviary Gardens is FREE BIRDS. No Head Gardener, no passive perk, no
   room to walk into.
2. A free bird — no post, no room, not away, not drilling — is offered first
   in every list that assigns work.
3. The birds tab carries a red dot counting them.

The tree is still home, so free birds still mend and cheer up between
adventures. That is the flock resting, not a job.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW = ROOT / "sw.js"
ROLES_CORE = ROOT / "bird_roles_core.js"
BADGE_CORE = ROOT / "action_badge_core.js"

OWN_RELEASE_PIN = "free-birds-v318-20260824"
CURRENT_BUILD = "forge-opens-on-the-anvil-v323-20260825"
PREVIOUS_RELEASE_PIN = "empire-village-declutter-v317-20260824"
# The release that last edited bird_roles_core.js — this one, which retired
# the Head Gardener.
# v318 edited bird_roles_core.js, so its tag moved to v318. v320 edited it
# again (the village post now names a town’s desk Lord Mayor), so the tag
# tracks the head build — the invariant is that it never lags behind.
# NOT CURRENT_BUILD: a core ships under the tag of the release that last
# EDITED it, and the head has moved on twice since without touching this one.
ROLES_CORE_PIN = "empire-grid-v322-20260825"


def html_text() -> str:
    return HTML_PATH.read_text(encoding="utf-8")


def function_source(html: str, name: str) -> str:
    start = html.index("function %s(" % name)
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def run_node(source: str):
    r = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8",
                       capture_output=True, check=False, timeout=60)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


def free_bird_harness(probe: str) -> str:
    """The real birdIsFree/freeBirds helpers, in a bare Node context."""
    html = html_text()
    fns = "\n".join(function_source(html, n) for n in
                    ("birdIsFree", "freeBirds", "freeBirdsCount", "freeBirdsFirst"))
    return """
const FREE_BIRD_ROOM = 'outdoors';
let posts = {};
let away = {};
let drilling = {};
const birdAssignedPost = id => posts[id] || null;
const birdHasActiveExpedition = id => !!away[id];
const birdHasActiveTraining = id => !!drilling[id];
const gameState = { flock: [] };
const bird = (id, room) => ({ id, commonName: id, academy: { room } });
""" + fns + "\n" + probe


# ---------------------------------------------------------------------------
# 1. Free is a state, not a room
# ---------------------------------------------------------------------------

def test_the_aviary_gardens_is_no_longer_a_place():
    html = html_text()
    rooms = html[html.index("const ACADEMY_ROOMS = {"):html.index("const FREE_BIRD_ROOM")]
    line = next(l for l in rooms.splitlines() if l.strip().startswith("outdoors:"))
    assert "AVIARY GARDENS" not in line
    assert "FREE BIRDS" in line
    # No passive perk is advertised, and no bird perches there as decoration.
    assert "Passive:" not in line
    assert "perches:[]" in line


def test_being_free_is_not_a_room_you_can_open():
    open_room = function_source(html_text(), "openAcademyRoom")
    assert "if (room === FREE_BIRD_ROOM)" in open_room
    assert "switchScreen('academy')" in open_room


def test_the_head_gardener_post_is_retired():
    roles = run_node(
        "const c = require(%s); console.log(JSON.stringify("
        "(c.getRoles ? c.getRoles() : c.ROLES).map(r => ({id:r.id, scope:r.scope, key:r.key}))));"
        % json.dumps(str(ROLES_CORE)))
    academy = [r for r in roles if r["scope"] == "academy"]
    assert not any(r["key"] == "outdoors" for r in academy), "a free bird holds no job"
    assert not any(r["id"] == "head_gardener" for r in roles)
    # Every room that is still a room kept its head.
    assert len(academy) == 11


def test_standing_a_bird_down_reads_as_setting_it_free():
    html = html_text()
    chips = function_source(html, "academyRoomButtonsHTML")
    assert "const free = room === FREE_BIRD_ROOM;" in chips
    assert "'Set free'" in chips
    panel = function_source(html, "renderAcademyRoomPanel")
    assert "r === FREE_BIRD_ROOM ? ('🕊️ Set free')" in panel
    # Nothing offers to "send" a bird to a place that is not a place.
    assert "Send to ' + cfg.label" in chips, "real rooms still say send"


def test_the_id_is_unchanged_so_old_saves_keep_their_birds():
    html = html_text()
    assert "const FREE_BIRD_ROOM = 'outdoors';" in html
    # Every fallback in the game still writes the same id it always did.
    assert "bird.academy.room = 'outdoors'" in html


def test_the_tree_is_still_home_so_free_birds_still_mend():
    """'Not doing anything' means no job, not no rest."""
    html = html_text()
    tick = html[html.index("} else if (room === 'nursery' || room === 'outdoors') {"):]
    tick = tick[:tick.index("} else {")]
    assert "b.care.happiness = clamp(" in tick
    assert "if (room === 'outdoors') b.hp = clamp(" in tick


# ---------------------------------------------------------------------------
# 2. Who counts as free
# ---------------------------------------------------------------------------

def test_a_bird_is_free_only_when_nothing_has_claimed_it():
    out = run_node(free_bird_harness("""
gameState.flock = [
  bird('idle'),                    // never assigned at all
  bird('resting', 'outdoors'),     // explicitly standing free
  bird('scholar', 'library'),      // stationed in a room
  bird('chef', 'outdoors'),        // free-standing, but holds a post
  bird('flier', 'outdoors'),       // away on a quest
  bird('pupil', 'outdoors'),       // mid-drill
];
posts = { chef: { role: { title: 'Head Chef' } } };
away = { flier: true };
drilling = { pupil: true };
console.log(JSON.stringify({
  free: freeBirds().map(b => b.id),
  count: freeBirdsCount(),
}));
"""))
    assert out["free"] == ["idle", "resting"]
    assert out["count"] == 2


def test_free_birds_rise_to_the_top_without_shuffling_the_rest():
    out = run_node(free_bird_harness("""
const list = [bird('a', 'library'), bird('b'), bird('c', 'workshop'), bird('d')];
gameState.flock = list;
console.log(JSON.stringify({
  sorted: freeBirdsFirst(list).map(x => x.id),
  original: list.map(x => x.id),
  empty: freeBirdsFirst(null),
}));
"""))
    # Free first, and the two groups keep their own order — the sort is stable,
    # so an aptitude ranking underneath survives intact.
    assert out["sorted"] == ["b", "d", "a", "c"]
    assert out["original"] == ["a", "b", "c", "d"], "the caller's array is not mutated"
    assert out["empty"] == []


# ---------------------------------------------------------------------------
# 3. Free birds lead every list that hands out work
# ---------------------------------------------------------------------------

def test_every_assignment_picker_offers_free_birds_first():
    html = html_text()
    quest = function_source(html, "renderQuestSendSheet")
    assert "freeBirdsFirst(dispatchBirds.filter(" in quest, "quest dispatch"
    training = function_source(html, "renderTrainingHallPanel")
    assert "const availableBirds = freeBirdsFirst(" in training, "the drill board"
    interior = function_source(html, "renderAcademyRoomInterior")
    assert "freeBirdsFirst(others)" in interior, "the add-a-bird roster"
    role = function_source(html, "rolePostCardHTML")
    # one-tap-appointments-v320 rewrote this card, but kept the rule: inside the
    # group of birds with no post, a bird with nothing at all to do leads one
    # merely stationed in a room.
    assert "unposted.filter(c => birdIsFree(c.bird))" in role, "role posts"
    assert "unposted.filter(c => !birdIsFree(c.bird))" in role, "role posts"


def test_a_role_post_offers_free_birds_first_and_posted_birds_last():
    """Amended by `forge-opens-on-the-anvil-v323-20260825`.

    This release put serving village managers at the TOP of a role post, ahead
    of the free flock. Yaan reversed that the same day — "show the birds that
    have been assigned to other roles at the bottom of the list" — so a bird
    with a job is now offered last whatever job it is. What free-birds actually
    argued for survives untouched: among the birds with no post, the one with
    nothing at all to do leads the one merely stationed in a room.
    """
    role = function_source(html_text(), "rolePostCardHTML")
    block = role[role.index("const unposted = ranked.filter"):role.index("const optionsHtml")]
    assert block.index("unposted.filter(c => birdIsFree(c.bird))") < block.index("unposted.filter(c => !birdIsFree(c.bird))")
    # Posted birds are a second group with its own cap, beneath the first.
    assert block.index("const available") < block.index("const posted")
    assert "ROLE_CANDIDATE_LIMIT" in block and "ROLE_POSTED_CANDIDATE_LIMIT" in block
    assert "ROLE_SERVING_CANDIDATE_LIMIT" not in role


def test_the_hospital_still_sorts_by_who_is_hurt():
    """One picker rightly ignores idleness: the ward wants the worst first."""
    interior = function_source(html_text(), "renderAcademyRoomInterior")
    assert "room === 'hospital' ? others.slice().sort((a, b) => birdHpRatio(a) - birdHpRatio(b))" in interior


# ---------------------------------------------------------------------------
# 4. The birds tab says how many are spare
# ---------------------------------------------------------------------------

def test_the_birds_tab_counts_birds_with_nothing_to_do():
    html = html_text()
    state = function_source(html, "normalizeActionBadgeState")
    assert "idleBirdCount = freeBirdsCount();" in state
    assert "birdex: idleBirdCount" in state
    # Wrapped like every other count: one broken save must not blank the dock.
    assert "try { idleBirdCount = freeBirdsCount(); } catch (e) {}" in state
    # Screen readers get words, not a bare number.
    assert "birdex: ['bird with nothing to do', 'birds with nothing to do']" in html


def test_the_badge_reaches_the_birds_button():
    html = html_text()
    # The dock button the count lands on.
    assert 'data-game-route data-screen="birdex"' in html
    badge = BADGE_CORE.read_text(encoding="utf-8")
    assert "'birdex'" in badge, "the walker already knows this screen"
    out = run_node(
        "const c = require(%s); console.log(JSON.stringify({"
        "  none: c.computeActionBadgeCounts({ birdex: 0 }).birdex,"
        "  three: c.computeActionBadgeCounts({ birdex: 3 }).birdex,"
        "  junk: c.computeActionBadgeCounts({ birdex: -2 }).birdex"
        "}));" % json.dumps(str(BADGE_CORE)))
    assert out == {"none": 0, "three": 3, "junk": 0}


# ---------------------------------------------------------------------------
# Shipping
# ---------------------------------------------------------------------------

def test_release_is_versioned_for_service_worker_self_update():
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert "const BURBZ_BUILD = '%s';" % CURRENT_BUILD in html
    cache_line = next(l for l in sw.splitlines() if l.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line, "the lineage is append-only"
    assert OWN_RELEASE_PIN in cache_line, "this release's own segment stays"
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)


def test_the_one_edited_core_ships_under_this_release():
    """bird_roles_core.js lost the Head Gardener, so its `?v=` moves with it.

    It has moved again since. What this pins is the rule, not the release: an
    edited core carries the CURRENT tag everywhere it is loaded, with no stale
    copy left behind in either the page or the worker.
    """
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert "bird_roles_core.js?v=%s" % ROLES_CORE_PIN in html
    assert "'./bird_roles_core.js?v=%s'" % ROLES_CORE_PIN in sw
    stale = [m for m in re.findall(r"bird_roles_core\.js\?v=([A-Za-z0-9.-]+)", html + sw)
             if m != ROLES_CORE_PIN]
    assert not stale, stale
    # Nothing else changed, so no other pin moved.
    for untouched in ("academy_treehouse_core.js", "loot_crafting_core.js", "action_badge_core.js"):
        assert "%s?v=%s" % (untouched, OWN_RELEASE_PIN) not in html, untouched
