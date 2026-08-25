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
   old site falls vacant.

**Amended by `forge-opens-on-the-anvil-v323-20260825`.** Yaan widened both halves:
ANY posted bird can now be moved to ANY post from wherever the player is
standing, and the birds who already have a job are offered at the BOTTOM of
the list, not the top. The tests below that pinned the narrower rule are
inverted, not deleted — each says which release changed it and why. Rule 1 got
stronger, not weaker: every post in the game renders bare now, because the
title and the explanation moved into the shared appointment sheet.

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
CURRENT_BUILD = "art-same-origin-v325-20260825"
# The release that last edited bird_roles_core.js — free-birds-v318, which
# retired the Head Gardener when the Aviary Gardens stopped being a room.
ROLES_CORE_PIN = "manager-builds-the-village-v324-20260825"


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
    "// One hand-drawn glyph per post",
    "// One delegated listener for every posting in the game",
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
// The slab defines the sheet's open/close plumbing; nothing here calls it, but
// a bare Node context still needs the names to exist.
const document = {
  getElementById: () => null,
  createElement: () => ({ setAttribute() {}, classList: { add() {}, remove() {}, contains: () => false } }),
  body: { appendChild() {} },
  addEventListener() {}
};
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
    # v319: the title went the same way — the sheet's own head carries it, so
    # the card is nothing but the holder, the label and the birds.
    assert 'class="role-post-card"' in html
    assert "Project Manager" not in html
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
    assert "Your own builds are faster and cost a little less" not in html
    assert "Stand down" in html
    assert '<div class="role-candidate-label">Replace with</div>' in html


def test_every_post_reads_bare_now_and_the_words_moved_into_the_sheet():
    """v319: what v315 did to the village desk, Yaan asked for everywhere.

    The Academy and the region cards lost their prose too — but nothing became
    unknowable, because the sheet that opens above them explains the job.
    """
    out = run_js("""
      gameState.flock = [bird('b1', 'Jackdaw', 105, 80, 38)];
      console.log(JSON.stringify({
        library: rolePostCardHTML('academy', 'library'),
        region: rolePostCardHTML('region', 'r1'),
        librarySheet: rolePickerSheetHTML('academy', 'library', ''),
        villageSheet: rolePickerSheetHTML('village', '101', 'Kestrelby\u2019s ')
      }));
    """)
    for html in (out["library"], out["region"]):
        assert 'class="role-post-copy"' not in html
        assert 'class="role-vacant"' not in html
        assert 'class="role-post-card"' in html
    # The sheet is where a post is explained, once, for the whole game.
    assert "Birds stationed in the Library learn INT faster." in out["librarySheet"]
    assert '<div class="role-picker-title">Librarian</div>' in out["librarySheet"]
    assert '<div class="role-picker-title">Kestrelby’s Project Manager</div>' in out["villageSheet"]
    assert "Your own builds are faster and cost a little less" in out["villageSheet"]


def test_the_words_still_live_in_the_roles_core():
    # Stripping the card did not strip the post's description from the game.
    assert "One bird runs every project in the village" in ROLES_CORE
    assert "Two builds can rise at once here: the manager’s site and yours." in ROLES_CORE


def test_the_row_the_player_taps_says_who_holds_the_post():
    """v319 replaced the drawer with one row that opens the shared sheet."""
    row = function_source("rolePostRowHTML")
    assert "data-action=\"role-open\"" in function_source("roleOpenAttrs")
    assert "birdDisplayName(post.bird) + ' · ' + role.effect.label + ' +' + post.bonusPct + '%'" in row
    assert "Vacant — tap to appoint a bird" in row
    assert "roleSymbolSVG(role, 'role-post-row-symbol')" in row
    # The old drawer copy is gone with the drawer.
    assert "runs the building sites and the ledger — tap to manage" not in HTML


# ---------------------------------------------------------------------------
# 2. Managers of other villages, at the top of the list
# ---------------------------------------------------------------------------

def test_another_villages_manager_is_offered_last_and_names_their_village():
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
    # v319 turned this over: a bird with a job is offered BENEATH the free
    # flock, under its own label, because taking them costs another post.
    assert candidate_names(html) == ["Goldcrest", "Jackdaw"]
    assert 'class="role-candidate is-posted"' in html
    assert '<div class="role-candidate-label is-sub">Already posted elsewhere</div>' in html
    # And the row still says which village they would leave.
    assert '<span class="role-candidate-post">\U0001F4CB Project Manager · Foxholt — moves here</span>' in html
    assert html.count('class="role-candidate-post"') == 1
    assert html.count('class="role-candidate-duty"') == 1


def test_every_posted_bird_is_offered_to_every_post():
    """v319 inverted v315's narrow rule: Yaan asked to be able to appoint the
    bird he wants from whatever screen he is on. A Librarian can take a
    village, a manager can take a room, and a Warden can take either."""
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
    # Every post offers every posted bird; only its own holder is left out.
    assert sorted(candidate_names(out["village"])) == ["Jackdaw", "Owl", "Raven"]
    assert sorted(candidate_names(out["kitchen"])) == ["Jackdaw", "Owl", "Raven"]
    assert sorted(candidate_names(out["region"])) == ["Jackdaw", "Owl", "Raven"]
    assert sorted(candidate_names(out["library"])) == ["Jackdaw", "Raven"]   # not Owl
    # Every one of them is marked, and every one names the job it would leave.
    for html in (out["village"], out["kitchen"], out["region"]):
        assert html.count('class="role-candidate-duty"') == 3
        assert "No companion is free for this post right now" not in html


def test_the_manager_of_this_very_village_is_not_offered_to_itself():
    out = run_js("""
      gameState.flock = [bird('mgr', 'Jackdaw', 105, 80, 38)];
      gameState.birdRoles.villages['101'] = 'mgr';
      const html = rolePostCardHTML('village', '101');
      console.log(JSON.stringify({ html }));
    """)
    assert candidate_names(out["html"]) == []
    assert "No companion is free for this post right now" in out["html"]


def test_the_free_flock_is_never_crowded_out_by_birds_who_have_jobs():
    """v319: the two groups have their own caps, so a large empire full of
    posted birds can never push the free ones off the list."""
    out = run_js("""
      const flock = [];
      const seeds = ['202', '303', '404', '505', '606', '707'];
      seeds.forEach((seed, i) => {
        flock.push(bird('m' + i, 'Manager' + i, 120 - i, 90, 30));
        gameState.birdRoles.villages[seed] = 'm' + i;
      });
      for (let i = 0; i < 10; i++) flock.push(bird('f' + i, 'Free' + i, 80 - i, 80, 30));
      gameState.flock = flock;
      const html = rolePostCardHTML('village', '101');
      console.log(JSON.stringify({ html }));
    """)
    names = candidate_names(out["html"])
    # Eight free birds first, then six of the posted ones — in that order.
    assert len(names) == 14
    assert all(n.startswith("Free") for n in names[:8])       # ROLE_CANDIDATE_LIMIT
    assert all(n.startswith("Manager") for n in names[8:])    # ROLE_POSTED_CANDIDATE_LIMIT
    assert names[8:] == ["Manager0", "Manager1", "Manager2", "Manager3", "Manager4", "Manager5"]
    assert "const ROLE_CANDIDATE_LIMIT = 8;" in HTML
    assert "const ROLE_POSTED_CANDIDATE_LIMIT = 6;" in HTML


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
    assert "Foxholt has no Project Manager now" in out["toasts"][0]


def test_a_librarian_walks_straight_onto_a_village_desk():
    """v319 inverted this. v315 refused it with 'stand them down first'."""
    out = run_js("""
      gameState.flock = [bird('lib', 'Owl', 200, 60, 30)];
      gameState.birdRoles.academy.library = 'lib';
      assignBirdRole('village', '101', 'lib');
      console.log(JSON.stringify({ roles: gameState.birdRoles, toasts }));
    """)
    assert out["roles"]["villages"] == {"101": "lib"}
    assert out["roles"]["academy"] == {}                      # the Library is empty now
    assert "Owl is now Project Manager" in out["toasts"][0]
    assert "The Library has no Librarian now" in out["toasts"][0]
    assert "stand them down first" not in out["toasts"][0]


def test_a_village_manager_walks_straight_into_a_room():
    """The other half of the same inversion, in the other direction."""
    out = run_js("""
      gameState.flock = [bird('mgr', 'Jackdaw', 105, 80, 38)];
      gameState.birdRoles.villages['202'] = 'mgr';
      assignBirdRole('academy', 'library', 'mgr');
      console.log(JSON.stringify({ roles: gameState.birdRoles, toasts }));
    """)
    assert out["roles"]["academy"] == {"library": "mgr"}
    assert out["roles"]["villages"] == {}                     # Foxholt is empty now
    assert "Jackdaw is now Librarian" in out["toasts"][0]
    assert "Foxholt has no Project Manager now" in out["toasts"][0]


def test_nobody_is_ever_refused_for_already_having_a_job():
    """The refusal is gone from the code, not merely unreachable."""
    assign = function_source("assignBirdRole")
    assert "stand them down first" not in assign
    assert "is already working as" not in assign
    assert "birdCanMoveToVillagePost" not in HTML
    assert "function birdMovesFromPost(scope, key, post)" in HTML


def test_re_appointing_the_sitting_manager_to_their_own_desk_is_quiet():
    out = run_js("""
      gameState.flock = [bird('mgr', 'Jackdaw', 105, 80, 38)];
      gameState.birdRoles.villages['101'] = 'mgr';
      assignBirdRole('village', '101', 'mgr');
      console.log(JSON.stringify({ villages: gameState.birdRoles.villages, toasts }));
    """)
    assert out["villages"] == {"101": "mgr"}
    assert "has no Project Manager now" not in out["toasts"][0]


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
