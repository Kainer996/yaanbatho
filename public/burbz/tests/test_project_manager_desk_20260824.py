"""The Project Manager desk: no prose, and managers can move between villages.

Yaan's ask, 2026-08-24: "remove all of that writing from where the player
appoints a project manager, and also give the player the option to appoint any
birds that are project managers in other villages — at the top of the list."

Two changes, one desk.

1. A village post renders BARE. The flavour paragraph and the vacant explainer
   are gone; what is left is the title, who holds it, and the list of birds.
   The words still live in `bird_roles_core.js`, and the Academy and region
   cards still read them, so only the desk Yaan pointed at got quieter.

2. A bird already project-managing ANOTHER village can be appointed straight
   here. Village desks are one job in many places, so the manager moves and the
   old site falls vacant. Those birds head the list. Every other post — a
   Librarian, a Warden — still has to stand down first.

These tests run the REAL functions lifted out of index.html against the real
`bird_roles_core.js`, in the harness style of test_manager_two_crews_20260821.
"""
import json
import subprocess
from pathlib import Path

BURBZ = Path(__file__).resolve().parents[1]
HTML_PATH = BURBZ / "index.html"
HTML = HTML_PATH.read_text(encoding="utf-8")
SW = (BURBZ / "sw.js").read_text(encoding="utf-8")
ROLES_CORE = (BURBZ / "bird_roles_core.js").read_text(encoding="utf-8")

RELEASE = "project-manager-desk-v315-20260824"
# The head of the line, which later releases move. Not this release's
# own name — magpie-market-v316 shipped after it.
CURRENT_BUILD = "empire-grid-v320-20260825"
# The release that last edited bird_roles_core.js — free-birds-v318, which
# retired the Head Gardener when the Aviary Gardens stopped being a room.
ROLES_CORE_PIN = "empire-grid-v320-20260825"


def function_source(name: str) -> str:
    start = HTML.index(f"function {name}(")
    end = HTML.find("\nfunction ", start + 10)
    assert end > start, name
    return HTML[start:end]


def slab(start: str, end: str) -> str:
    a = HTML.index(start)
    b = HTML.index(end, a)
    assert b > a
    return HTML[a:b]


DESK_SLAB = slab(
    "// The one post a bird can take without standing down first",
    "// One delegated listener for every posting card in the game.",
)

STUBS = """
global.window = global;
require(%s);
const birdRolesCore = () => globalThis.BurbzBirdRolesCore;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const escapeHtml = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const birdDisplayName = b => (b && (b.name || b.commonName || b.species)) || 'a bird';
const birdOnlyImgHTML = (bird, cls) => '<img class="' + cls + '">';
const birdHasActiveTraining = () => false;
const birdHasActiveExpedition = () => false;
const normalizeBirdCare = b => { b.care = b.care || { sleeping: false }; };
const ACADEMY_ROOMS = { library: { label: 'The Library' } };
const FREE_BIRD_ROOM = 'outdoors';
const empireSettlementOfSeed = () => null;
const empireSettlementById = () => null;
const canonicalEmpireSettlement = s => s;
const townDisplayName = s => s && s.name;
const empireRegionById = id => ({ name: 'The Weald' });
const toasts = [];
const showToast = t => toasts.push(t);
const saveState = () => {};
const SFX = { tap() {} };
const refreshRoleSurfaces = () => {};
const updateQuestProgress = () => {};
const pauseHeadChefCareer = () => {};
const startHeadChefCareer = () => {};
const ensureBirdAcademy = b => { b.academy = b.academy || {}; };
const empire = { villages: {
  '101': { seed: 101, name: 'Kestrelby' },
  '202': { seed: 202, name: 'Foxholt' },
  '303': { seed: 303, name: 'Briarwell' },
  '404': { seed: 404, name: 'Aldermoor' },
  '505': { seed: 505, name: 'Marshend' },
  '606': { seed: 606, name: 'Thornlea' },
  '707': { seed: 707, name: 'Hollowdown' }
} };
const ensureEmpireState = () => empire;
const gameState = { flock: [], birdRoles: { academy: {}, villages: {}, regions: {} } };
const ensureRolesState = () => gameState.birdRoles;
function bird(id, name, int_, cha, size) {
  return { id, name, species: name, commonName: name, int: int_, cha, sizeScore: size, care: { sleeping: false } };
}
"""


def run_js(body: str):
    script = (STUBS % json.dumps(str(BURBZ / "bird_roles_core.js"))) + "\n" + DESK_SLAB + "\n"
    for name in ("roleDefFor", "rolePostState", "birdPostLabel", "birdAssignedPost", "assignBirdRole", "birdIsFree"):
        script += function_source(name) + "\n"
    script += body
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def candidate_names(html: str):
    """The bird names in a card's Appoint list, in the order they are offered."""
    names = []
    for chunk in html.split('<span class="role-candidate-name">')[1:]:
        names.append(chunk.split("</span>")[0])
    return names


# ---------------------------------------------------------------------------
# 1. The desk carries no writing
# ---------------------------------------------------------------------------

def test_a_vacant_village_desk_is_a_picker_not_a_pamphlet():
    out = run_js("""
      gameState.flock = [bird('b1', 'Jackdaw', 105, 80, 38), bird('b2', 'Robin', 70, 90, 12)];
      const html = rolePostCardHTML('village', '101', { titlePrefix: 'Kestrelby\\u2019s ' });
      console.log(JSON.stringify({ html }));
    """)
    html = out["html"]
    # The prose is gone: no flavour paragraph, no vacant explainer.
    assert 'class="role-post-copy"' not in html
    assert 'class="role-vacant"' not in html
    assert "One bird runs every project in the village" not in html
    assert "Two builds can rise at once here" not in html
    assert "the better suited it is, the more the post is worth" not in html
    # What is left is the post, the label and the birds.
    assert 'class="role-post-card is-bare"' in html
    assert "Kestrelby’s Project Manager" in html
    assert '<div class="role-candidate-label">Appoint</div>' in html
    assert candidate_names(html) == ["Jackdaw", "Robin"]


def test_a_staffed_village_desk_keeps_the_number_and_drops_the_sentence():
    out = run_js("""
      gameState.flock = [bird('b1', 'Jackdaw', 105, 80, 38), bird('b2', 'Robin', 70, 90, 12)];
      gameState.birdRoles.villages['101'] = 'b1';
      const html = rolePostCardHTML('village', '101', { titlePrefix: 'Kestrelby\\u2019s ' });
      console.log(JSON.stringify({ html }));
    """)
    html = out["html"]
    assert 'class="role-holder"' in html
    assert "Project management <b>+" in html          # the number survives
    assert "Every build is faster and costs a little less" not in html
    assert "Stand down" in html
    assert '<div class="role-candidate-label">Replace with</div>' in html


def test_the_academy_and_the_region_keep_their_words():
    out = run_js("""
      gameState.flock = [bird('b1', 'Jackdaw', 105, 80, 38)];
      console.log(JSON.stringify({
        library: rolePostCardHTML('academy', 'library'),
        region: rolePostCardHTML('region', 'r1')
      }));
    """)
    for html in (out["library"], out["region"]):
        assert 'class="role-post-copy"' in html
        assert 'class="role-vacant"' in html
        assert 'class="role-post-card"' in html       # not bare
    assert "The Library runs on one thing" in out["library"]
    assert "A region is too big for one town hall" in out["region"]


def test_the_words_still_live_in_the_roles_core():
    # Stripping the card did not strip the post's description from the game.
    assert "One bird runs every project in the village" in ROLES_CORE
    assert "Two builds can rise at once here." in ROLES_CORE


def test_the_drawer_line_above_the_desk_still_says_what_the_post_does():
    # The one-line summary the player taps to open the desk is untouched, so
    # nothing about the post became unknowable.
    assert "runs the building sites and the ledger — tap to manage" in HTML
    assert "Vacant — appoint a bird: builds go faster and cheaper, taxes rise" in HTML


# ---------------------------------------------------------------------------
# 2. Managers of other villages, at the top of the list
# ---------------------------------------------------------------------------

def test_another_villages_manager_is_offered_first_and_names_their_village():
    out = run_js("""
      gameState.flock = [
        bird('free', 'Goldcrest', 250, 250, 10),   // the best bird in the flock
        bird('mgr', 'Jackdaw', 105, 80, 38)
      ];
      gameState.birdRoles.villages['202'] = 'mgr';
      const html = rolePostCardHTML('village', '101', { titlePrefix: 'Kestrelby\\u2019s ' });
      console.log(JSON.stringify({ html }));
    """)
    html = out["html"]
    # Serving managers lead, even past a better-suited free bird.
    assert candidate_names(html) == ["Jackdaw", "Goldcrest"]
    assert 'class="role-candidate is-serving"' in html
    # And the row says which village they would leave.
    assert '<span class="role-candidate-post">\U0001F4CB Foxholt · move here</span>' in html
    assert html.count('class="role-candidate-post"') == 1


def test_only_village_managers_move_and_only_to_another_village():
    out = run_js("""
      gameState.flock = [
        bird('lib', 'Owl', 200, 60, 30),
        bird('war', 'Raven', 150, 150, 80),
        bird('mgr', 'Jackdaw', 105, 80, 38)
      ];
      gameState.birdRoles.academy.library = 'lib';
      gameState.birdRoles.regions['r1'] = 'war';
      gameState.birdRoles.villages['202'] = 'mgr';
      console.log(JSON.stringify({
        village: rolePostCardHTML('village', '101'),
        library: rolePostCardHTML('academy', 'library'),
        kitchen: rolePostCardHTML('academy', 'kitchen'),
        region: rolePostCardHTML('region', 'r2')
      }));
    """)
    # A village desk offers the other village's manager — and nobody else posted.
    assert candidate_names(out["village"]) == ["Jackdaw"]
    # An Academy room and a region hall offer nobody who already holds a post.
    assert candidate_names(out["kitchen"]) == []
    assert "No companion is free for this post right now" in out["kitchen"]
    assert candidate_names(out["region"]) == []
    # The Librarian's own card still offers nobody else (its holder is excluded).
    assert candidate_names(out["library"]) == []


def test_the_manager_of_this_very_village_is_not_offered_to_itself():
    out = run_js("""
      gameState.flock = [bird('mgr', 'Jackdaw', 105, 80, 38)];
      gameState.birdRoles.villages['101'] = 'mgr';
      const html = rolePostCardHTML('village', '101');
      console.log(JSON.stringify({ html }));
    """)
    assert candidate_names(out["html"]) == []
    assert "No companion is free for this post right now" in out["html"]


def test_serving_managers_never_crowd_the_free_flock_out_of_the_list():
    out = run_js("""
      const flock = [];
      const seeds = ['202', '303', '404', '505', '606', '707'];
      seeds.forEach((seed, i) => {
        flock.push(bird('m' + i, 'Manager' + i, 120 - i, 90, 30));
        gameState.birdRoles.villages[seed] = 'm' + i;
      });
      for (let i = 0; i < 6; i++) flock.push(bird('f' + i, 'Free' + i, 80, 80, 30));
      gameState.flock = flock;
      const html = rolePostCardHTML('village', '101');
      console.log(JSON.stringify({ names: [], html }));
    """)
    names = candidate_names(out["html"])
    assert len(names) == 8                                    # ROLE_CANDIDATE_LIMIT
    assert [n for n in names if n.startswith("Manager")] == [
        "Manager0", "Manager1", "Manager2", "Manager3", "Manager4"
    ]                                                          # ROLE_SERVING_CANDIDATE_LIMIT
    assert len([n for n in names if n.startswith("Free")]) == 3
    assert "const ROLE_CANDIDATE_LIMIT = 8;" in HTML
    assert "const ROLE_SERVING_CANDIDATE_LIMIT = 5;" in HTML


# ---------------------------------------------------------------------------
# 3. Appointing one actually moves them
# ---------------------------------------------------------------------------

def test_appointing_another_villages_manager_moves_them_and_empties_the_old_desk():
    out = run_js("""
      gameState.flock = [bird('mgr', 'Jackdaw', 105, 80, 38)];
      gameState.birdRoles.villages['202'] = 'mgr';
      assignBirdRole('village', '101', 'mgr');
      console.log(JSON.stringify({ villages: gameState.birdRoles.villages, toasts }));
    """)
    assert out["villages"] == {"101": "mgr"}          # Foxholt is vacant again
    assert len(out["toasts"]) == 1
    assert "Jackdaw is now Project Manager" in out["toasts"][0]
    assert "Foxholt needs a new one" in out["toasts"][0]


def test_a_librarian_still_has_to_stand_down_before_taking_a_village():
    out = run_js("""
      gameState.flock = [bird('lib', 'Owl', 200, 60, 30)];
      gameState.birdRoles.academy.library = 'lib';
      assignBirdRole('village', '101', 'lib');
      console.log(JSON.stringify({ roles: gameState.birdRoles, toasts }));
    """)
    assert out["roles"]["villages"] == {}
    assert out["roles"]["academy"] == {"library": "lib"}
    assert out["toasts"] == ["Owl is already working as Librarian — stand them down first."]


def test_a_village_manager_still_has_to_stand_down_before_taking_a_room():
    out = run_js("""
      gameState.flock = [bird('mgr', 'Jackdaw', 105, 80, 38)];
      gameState.birdRoles.villages['202'] = 'mgr';
      assignBirdRole('academy', 'library', 'mgr');
      console.log(JSON.stringify({ roles: gameState.birdRoles, toasts }));
    """)
    assert out["roles"]["academy"] == {}
    assert out["roles"]["villages"] == {"202": "mgr"}
    assert out["toasts"] == ["Jackdaw is already working as Project Manager — stand them down first."]


def test_re_appointing_the_sitting_manager_to_their_own_desk_is_quiet():
    out = run_js("""
      gameState.flock = [bird('mgr', 'Jackdaw', 105, 80, 38)];
      gameState.birdRoles.villages['101'] = 'mgr';
      assignBirdRole('village', '101', 'mgr');
      console.log(JSON.stringify({ villages: gameState.birdRoles.villages, toasts }));
    """)
    assert out["villages"] == {"101": "mgr"}
    assert "needs a new one" not in out["toasts"][0]


# ---------------------------------------------------------------------------
# 4. Release plumbing
# ---------------------------------------------------------------------------

def test_release_is_versioned_for_service_worker_self_update():
    cache_line = next(line for line in SW.splitlines() if line.startswith("const BURBZ_CACHE = "))
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert RELEASE in cache_line, "this release keeps its place in the lineage"
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    # bird_roles_core.js was untouched by v315, so v315 moved no pin on it.
    # magpie-market-v316 added the Market Trader post and re-pinned it there,
    # and it stays on that tag until some release edits the core again — the
    # head build moving past it changes nothing.
    assert f"'./bird_roles_core.js?v={ROLES_CORE_PIN}'" in SW
    assert f"?v={RELEASE}" not in SW, "v315 changed no core, so it pins none"
