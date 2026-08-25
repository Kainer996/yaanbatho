"""Every post in the game is one symbol and one sheet.

Yaan's ask (2026-08-24), from a screenshot of the Kitchen, pinned as
`one-tap-appointments-v320-20260824`:

> "Where it says 'Head Chef, the kitchen wants a thinker' — remove that. Remove
> the paragraph underneath. Remove the grid where it says 'Appoint' and instead
> have a box in the top-left corner of the picture of the kitchen with a symbol
> for a player to click to appoint a chef… a chef's hat, maybe an SVG one. When
> the player clicks the box they get a little menu that pops up, which explains
> what the chef does and then gives them a list of the birds that they can
> assign, what percentage, and how useful they are. **This goes across the rest
> of the game too.** Show the birds that have been assigned to other roles at
> the bottom of the list… Do allow the player, from whatever screen they're on,
> to be able to assign a different bird to that role that they want to."

So the shape of every appointment in Burbz changed at once:

- a hand-drawn SVG glyph per post (`ROLE_SYMBOLS`), chef's hat included,
- a `role-badge` in the top-left of an Academy room's own picture,
- a `role-post-row` for a village, Town Hall or County Hall desk,
- one `#rolePicker` sheet on the body — the ONLY place a post is explained,
  and reachable from any screen because it does not belong to one,
- free birds ranked first, then the birds who already have a job, marked and
  naming the post they would leave,
- and **one-bird-one-job is no longer a refusal.** Any posted bird can be
  moved; the job they leave falls vacant and the toast says so.

The picker's own behaviour with real birds is covered by
`test_project_manager_desk_20260824.py`, which runs these functions in Node.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
ROLES_CORE = (ROOT / "bird_roles_core.js").read_text(encoding="utf-8")

OWN_RELEASE_PIN = "one-tap-appointments-v320-20260824"
# A later release ships over the top; this one changed no core either, so only
# the head build moves on.
CURRENT_BUILD = "trail-mode-v329-20260825"
PREVIOUS_RELEASE_PIN = "villages-first-county-merge-v319-20260824"


def function_source(name: str) -> str:
    start = HTML.index(f"function {name}(")
    return HTML[start:HTML.index("\nfunction ", start + 20)]


# ---------------------------------------------------------------------------
# 1. The symbols
# ---------------------------------------------------------------------------

def test_every_post_in_the_game_has_a_drawn_symbol():
    """A role with no glyph must still render, so the map is checked against
    the roles core rather than against itself."""
    symbols = HTML[HTML.index("const ROLE_SYMBOLS = {"):]
    symbols = symbols[:symbols.index("\n};")]
    # (No head_gardener: free-birds-v318 retired the post with the Aviary
    # Gardens, and a glyph for a post that no longer exists is dead weight.)
    for role_id in ("head_chef", "librarian", "star_charter", "drill_master",
                    "nest_architect", "innkeeper", "head_healer", "nest_nanny",
                    "market_trader", "quartermaster", "recruiting_officer",
                    "steward", "region_warden"):
        assert f"id:'{role_id}'" in ROLES_CORE, role_id      # still a real post
        assert f"{role_id}:" in symbols, role_id


def test_the_kitchen_wears_a_chefs_hat():
    symbols = HTML[HTML.index("const ROLE_SYMBOLS = {"):]
    hat = symbols[symbols.index("head_chef:"):symbols.index("librarian:")]
    assert "<path" in hat
    assert hat.count("<path") >= 3          # dome, band and pleats
    assert "id:'head_chef'" in ROLES_CORE and "key:'kitchen'" in ROLES_CORE


def test_a_post_with_no_drawing_falls_back_to_its_own_emoji():
    src = function_source("roleSymbolSVG")
    assert "const body = role && ROLE_SYMBOLS[role.id];" in src
    assert "if (!body) return" in src and "role.icon" in src
    # currentColor, so one glyph works on the art, on a desk row and in the sheet.
    assert 'stroke="currentColor"' in src
    assert 'aria-hidden="true"' in src


# ---------------------------------------------------------------------------
# 2. The corner box on the room's own picture
# ---------------------------------------------------------------------------

def test_the_badge_sits_in_the_top_left_of_the_room_art():
    room = function_source("renderAcademyRoomInterior")
    assert "const roleBadge = rolePostBadgeHTML('academy', room);" in room
    # Inside the hero, first thing in the topbar's left group — ahead of the
    # room's own title card, which is what puts it in the corner.
    assert '<div class="academy-room-topbar"><div class="academy-room-topbar-left">\' + roleBadge' in room
    assert '<div class="academy-room-topbar"><div class="academy-room-topbar-left">\' + rolePostBadgeHTML(\'academy\', \'tavern\')' in room
    assert ".academy-room-topbar-left { display:flex;" in HTML
    assert ".role-badge { position:relative;" in HTML


def test_the_badge_says_what_it_will_do_and_shows_who_holds_the_post():
    src = function_source("rolePostBadgeHTML")
    # The title is derived, not read off the role: a Town's heart is the Lord
    # Mayor's desk (empire-grid-v322) and the badge must say so too.
    assert "(post.staffed ? 'Change ' : 'Appoint a ') + prefix + rolePostTitle(scope, key, role)" in src
    assert "aria-label=" in src and "title=" in src
    assert "roleSymbolSVG(role, 'role-badge-symbol')" in src
    assert "post.staffed ? birdOnlyImgHTML(post.bird, 'role-badge-art') : ''" in src
    assert "(post.staffed ? ' is-staffed' : ' is-vacant')" in src
    # A vacant post breathes rather than explaining itself in a sentence.
    assert ".role-badge.is-vacant { border-style:dashed;" in HTML
    assert "@media (prefers-reduced-motion:reduce) { .role-badge.is-vacant { animation:none; } }" in HTML


def test_the_kitchen_screen_carries_no_post_writing_at_all():
    room = function_source("renderAcademyRoomInterior")
    assert "rolePostCardHTML(" not in room
    assert "rolePanel" not in room
    # The two paragraphs Yaan circled came from the roles core through the old
    # inline card. They still belong to the core; no screen prints them.
    assert "The Kitchen wants a thinker" in ROLES_CORE
    assert "The Kitchen wants a thinker" not in HTML
    assert 'class="role-post-copy"' not in HTML
    assert 'class="role-vacant"' not in HTML


# ---------------------------------------------------------------------------
# 3. One sheet, reachable from anywhere
# ---------------------------------------------------------------------------

def test_the_sheet_lives_on_the_body_not_inside_a_screen():
    """That is what makes it openable from whatever screen the player is on."""
    src = function_source("rolePickerRoot")
    assert "document.getElementById('rolePicker')" in src
    assert "document.body.appendChild(el)" in src
    open_src = function_source("openRolePicker")
    assert "rolePickerOpen = { scope, key: String(key), prefix: prefix || '' };" in open_src
    assert "el.classList.add('is-open')" in open_src


def test_the_sheet_is_the_one_place_a_post_is_explained():
    sheet = function_source("rolePickerSheetHTML")
    assert "roleSymbolSVG(role, 'role-picker-symbol')" in sheet
    assert '<div class="role-picker-title">' in sheet
    assert "escapeHtml(role.effect.label)" in sheet
    assert "'<div class=\"role-picker-copy\">' + escapeHtml(role.effect.copy) + '</div>'" in sheet
    assert "rolePostCardHTML(scope, key)" in sheet
    # Every other surface only opens it.
    for renderer in ("renderAcademyRoomInterior", "renderVillageManagePanel",
                     "renderRegionScreen", "renderTownScreen"):
        assert "rolePostCardHTML(" not in function_source(renderer), renderer


def test_the_desks_offer_the_same_sheet_as_the_rooms():
    assert "rolePostRowHTML('village', String(rec.seed >>> 0)" in HTML       # village desk
    assert "rolePostRowHTML('village', String(Number(settle.heartSeed) >>> 0)" in HTML  # Town Hall
    assert "rolePostRowHTML('region', String(region.id))" in HTML            # County Hall
    row = function_source("rolePostRowHTML")
    assert "roleOpenAttrs(scope, key, prefix)" in row
    assert "Vacant — tap to appoint a bird" in row
    # The Training Hall's bespoke picker retired into the shared one.
    assert "trainingMasterPickerOverlayHTML" not in HTML
    assert "training-master-picker" not in HTML
    assert "roleOpenAttrs('academy', 'training', '')" in HTML


def test_one_listener_opens_closes_assigns_and_dismisses():
    listener = HTML[HTML.index("// One delegated listener for every posting in the game"):]
    listener = listener[:listener.index("// Escape closes the sheet")]
    for action in ("role-picker-close", "role-open", "role-assign", "role-clear"):
        assert f'"[data-action=\\"{action}\\"]"' in listener or f'[data-action="{action}"]' in listener, action
    assert "openRolePicker(opener.dataset.roleScope, opener.dataset.roleKey, opener.dataset.rolePrefix || '')" in listener
    assert "if (event.key === 'Escape' && rolePickerOpen) closeRolePicker();" in HTML


def test_appointing_from_inside_the_sheet_redraws_the_sheet():
    """Otherwise the player is left looking at the list they just acted on."""
    refresh = function_source("refreshRoleSurfaces")
    assert "try { refreshRolePicker(); } catch (e) {}" in refresh
    src = function_source("refreshRolePicker")
    assert "if (!rolePickerOpen) return;" in src
    assert "el.innerHTML = rolePickerSheetHTML(" in src


# ---------------------------------------------------------------------------
# 4. Birds who already have a job — offered, marked, and at the bottom
# ---------------------------------------------------------------------------

def test_posted_birds_are_offered_last_under_their_own_label():
    card = function_source("rolePostCardHTML")
    assert "posted: birdAssignedPost(c.bird.id) ? birdPostLabel(c.bird) : null" in card
    assert "const unposted = ranked.filter(c => !c.posted);" in card
    assert "const posted = ranked.filter(c => c.posted).slice(0, ROLE_POSTED_CANDIDATE_LIMIT);" in card
    assert "available.map(row).join('')" in card
    # Merged with free-birds-v318: inside the unposted group, a bird with
    # nothing at all to do leads one merely stationed in a room.
    assert "unposted.filter(c => birdIsFree(c.bird))" in card
    assert card.index("unposted.filter(c => birdIsFree(c.bird))") < card.index("unposted.filter(c => !birdIsFree(c.bird))")
    assert card.index("const available") < card.index("const posted")
    assert '<div class="role-candidate-label is-sub">Already posted elsewhere</div>' in card
    # Each row shows its rank, its stats and what the post would be worth.
    assert "roleStatLine(role, c.bird)" in card
    assert "'<span class=\"role-candidate-gain\">+' + c.bonusPct + '%</span>'" in card


def test_a_posted_bird_is_marked_and_names_the_job_it_would_leave():
    card = function_source("rolePostCardHTML")
    assert "'<span class=\"role-candidate-duty\">ON DUTY</span>'" in card
    assert "c.posted.icon + ' ' + escapeHtml(c.posted.title)" in card
    assert "escapeHtml(c.posted.where) + ' — moves here" in card
    assert ".role-candidate.is-posted {" in HTML
    assert ".role-candidate-duty { flex:none;" in HTML


def test_the_duty_chip_cannot_be_clipped_away_by_a_long_bird_name():
    """The name ellipsises; the marker must not ride inside it."""
    card = function_source("rolePostCardHTML")
    name_span = card[card.index('role-candidate-nameline'):card.index('role-candidate-meta')]
    assert "'</span>' +\n        (c.posted ?" in name_span      # chip is a sibling
    assert ".role-candidate-nameline { display:flex;" in HTML
    assert ".role-candidate-name { flex:1; min-width:0;" in HTML


def test_the_candidate_list_does_not_trap_a_scroller_inside_the_sheet():
    """The sheet scrolls; a second scroller would hide the posted birds."""
    assert ".role-picker .role-candidate-list { max-height:none; overflow:visible; }" in HTML


# ---------------------------------------------------------------------------
# 5. A bird can be moved from wherever the player is standing
# ---------------------------------------------------------------------------

def test_holding_a_post_no_longer_refuses_a_bird():
    assign = function_source("assignBirdRole")
    assert "stand them down first" not in assign
    assert "is already working as" not in assign
    assert "birdMovesFromPost(scope, key, currentPost) ? birdPostLabel(bird) : null" in assign
    assert "birdCanMoveToVillagePost" not in HTML
    # And nothing filters a posted bird out of the offer any more.
    assert "const post = birdAssignedPost(b.id);" not in function_source("roleCandidateBirds")


def test_the_toast_names_the_post_that_just_fell_vacant():
    assign = function_source("assignBirdRole")
    assert "movesFrom.where + ' has no ' + movesFrom.title + ' now'" in assign
    # The label must be read BEFORE core.assignRole moves the bird, or it names
    # the post the bird just arrived in.
    assert assign.index("const movesFrom") < assign.index("core.assignRole(")


def test_a_head_chef_who_leaves_the_kitchen_stops_being_paid_as_one():
    """assignRole vacates the Kitchen silently, so the career must be stopped
    here or it keeps running with nobody at the stove."""
    assign = function_source("assignBirdRole")
    assert "if (currentPost && currentPost.scope === 'academy' && currentPost.key === 'kitchen' && !samePost) pauseHeadChefCareer(bird.id);" in assign


def test_the_things_that_still_stop_an_appointment_are_untouched():
    assign = function_source("assignBirdRole")
    assert "is away on a quest — call them home first." in assign
    assert "is training — finish the session first." in assign
    assert "is fast asleep — wait until they wake." in assign


# ---------------------------------------------------------------------------
# 6. Shipping
# ---------------------------------------------------------------------------

def test_release_is_versioned_so_a_refresh_lands_the_new_screens():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(l for l in SW.splitlines() if l.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line, "the lineage is append-only"
    assert OWN_RELEASE_PIN in cache_line, "and this release keeps its place in it"
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD), "the newest marker goes last"


def test_this_release_edited_no_core_so_it_pins_none():
    assert f"?v={OWN_RELEASE_PIN}" not in HTML
    assert f"?v={OWN_RELEASE_PIN}" not in SW
