"""The Forge opens on its anvil, not on the rack.

Yaan's ask (2026-08-25), pinned as `forge-opens-on-the-anvil-v323-20260825`:

> "Can you also make it so that when the player clicks to enter the forge, that
> forge screen opens on the Crafting tab please, not on the Equip tab?"

Crafting is what the room is *for*; equipping is something you do to a bird,
and it stays one tap away. Three things make that true and keep it true:

- `FORGE_DEFAULT_TAB` is the tab every entry lands on, and `switchScreen`
  applies it — the dock routes generically through `data-screen="forge"`, so
  putting the reset anywhere else would leave a return visit on whatever tab
  was last open;
- the player's own tap still sticks while they are inside. Only *entering*
  resets;
- the two buttons that promise equipping in their own words — the battle
  board's "Gear up" and the Stores' "EQUIP YOUR FLOCK AT THE FORGE" — call
  `openForge('equip')` and still land where they say they will.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")

OWN_RELEASE_PIN = "forge-opens-on-the-anvil-v323-20260825"
PREVIOUS_RELEASE_PIN = "one-tap-appointments-v320-20260824"
# The head build has moved past this release; its own marker stays in the
# lineage for ever, and the newest one goes on the end.
CURRENT_BUILD = "concise-onboarding-v353-20260906"


def function_source(name: str) -> str:
    start = HTML.index(f"function {name}(")
    return HTML[start:HTML.index("\nfunction ", start + 20)]


# ---------------------------------------------------------------------------
# 1. The anvil is the default
# ---------------------------------------------------------------------------

def test_the_forge_defaults_to_the_crafting_tab():
    assert "const FORGE_DEFAULT_TAB = 'craft';" in HTML
    assert "let forgeState = { tab: FORGE_DEFAULT_TAB, birdId: null, slotPicker: null };" in HTML


def test_entering_the_forge_resets_it_to_the_default_tab():
    """The dock routes generically, so the reset has to live in switchScreen —
    anywhere else and a second visit reopens on whatever was left open."""
    src = function_source("switchScreen")
    assert "if (name === 'forge') {" in src
    assert "forgeApplyTab(forgeEntryTab || FORGE_DEFAULT_TAB);" in src
    assert "forgeEntryTab = null;" in src
    # And the dock's own button is the generic route, with no tab of its own.
    assert '<button class="nav-item" data-game-route data-screen="forge"' in HTML


def test_the_markup_highlights_craft_before_any_javascript_runs():
    tabs = HTML[HTML.index('<div class="forge-tabs">'):]
    tabs = tabs[:tabs.index("</div>")]
    assert 'class="forge-tab active" id="forgeTabCraft"' in tabs
    assert 'class="forge-tab" id="forgeTabEquip"' in tabs
    assert tabs.count("forge-tab active") == 1


# ---------------------------------------------------------------------------
# 2. A tap inside still sticks
# ---------------------------------------------------------------------------

def test_the_players_own_tap_is_not_overridden_while_they_are_inside():
    """Only entering resets. forgeSetTab is the tap, and it never consults the
    default — otherwise the tabs would be unusable."""
    tap = function_source("forgeSetTab")
    assert "forgeApplyTab(tab);" in tap
    assert "FORGE_DEFAULT_TAB" not in tap
    assert "renderForge();" in tap
    # renderForge reads the state; it must not reset it either.
    assert "forgeApplyTab" not in function_source("renderForge")


def test_an_unknown_tab_falls_back_to_the_default_rather_than_blanking():
    apply_src = function_source("forgeApplyTab")
    assert "FORGE_TABS.includes(tab) ? tab : FORGE_DEFAULT_TAB" in apply_src
    assert "const FORGE_TABS = ['equip', 'craft', 'materials'];" in HTML
    # The highlight is driven off the resolved tab, not the argument.
    assert "el.classList.toggle('active', t === forgeState.tab)" in apply_src


# ---------------------------------------------------------------------------
# 3. The buttons that promise equipping still deliver it
# ---------------------------------------------------------------------------

def test_the_two_equip_buttons_name_the_tab_they_promise():
    assert """<button class="sq-forge-btn" id="battleForgeBtn" onclick="openForge('equip')">""" in HTML
    assert """onclick="openForge(\\'equip\\')">🛡️ EQUIP YOUR FLOCK AT THE FORGE""" in HTML
    # The generic ones stay generic and get the anvil.
    assert """<button class="stores-forge-btn" id="storesForgeBtn" onclick="switchScreen('forge')">""" in HTML
    assert """closeBirdEquip(); switchScreen(\\'forge\\');""" in HTML   # "CRAFT MORE AT THE…"


def test_open_forge_works_from_inside_the_forge_too():
    """switchScreen returns early when the screen is already open, so a caller
    already standing in the Forge would otherwise be silently ignored."""
    assert "if (name === currentScreen) return;" in function_source("switchScreen")
    src = function_source("openForge")
    assert "if (currentScreen === 'forge') {" in src
    assert "forgeApplyTab(forgeEntryTab || FORGE_DEFAULT_TAB);" in src
    assert "renderForge();" in src


def test_open_forge_is_reachable_from_an_inline_handler():
    """Both callers are inline onclicks, and the game script is an IIFE."""
    assert "forgeSetTab, openForge, forgeSelectBird" in HTML


def test_the_entry_tab_is_spent_once_and_never_sticks():
    """A leftover would silently redirect the next visit."""
    assert "let forgeEntryTab = null;" in HTML
    for src in (function_source("switchScreen"), function_source("openForge")):
        if "forgeEntryTab" in src:
            assert "forgeEntryTab = null;" in src


# ---------------------------------------------------------------------------
# 4. Shipping
# ---------------------------------------------------------------------------

def test_release_is_versioned_so_a_refresh_lands_the_new_default():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(l for l in SW.splitlines() if l.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line, "the lineage is append-only"
    assert OWN_RELEASE_PIN in cache_line, "and this release keeps its place in it"
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD), "the newest marker goes last"


def test_this_release_edited_no_core_so_it_pins_none():
    assert f"?v={OWN_RELEASE_PIN}" not in HTML
    assert f"?v={OWN_RELEASE_PIN}" not in SW
