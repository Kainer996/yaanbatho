"""The tree itself is home: the Roost is gone as a building and a mechanic.

Yaan's ask: the Academy is one big tree — birds live in it. The Roost made
no sense as a separate house. Cut it, and let the game stand exactly as it
was without it.

What replaced each duty:

* the tutorial's build lesson is the Barracks (Merlin's gift now covers its
  60 coins and 8 timber);
* the gentle HP mend the Roost sold now happens to birds roosting in the
  Aviary Gardens — the tree is home, so home heals;
* feeding, grooming and deep rest moved to the gardens with them;
* old saves migrate: a built Roost refunds its 50 coins and 10 timber, its
  lodgers move out to the gardens, and the Roost Warden post retires.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")


def test_no_room_building_or_role_is_called_dorm_any_more():
    result = subprocess.run(
        ["node", "-e",
         "const a=require('./academy_treehouse_core.js');"
         "const r=require('./bird_roles_core.js');"
         "const rooms=a.getAcademyRooms().map(x=>x.id);"
         "const posts=(r.ROLE_POSTS||r.listRolePosts&&r.listRolePosts()||[]).map(p=>p.key||'');"
         "console.log(JSON.stringify({rooms,posts}));"],
        cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert "dorm" not in data["rooms"]
    assert "outdoors" in data["rooms"] and "tavern" in data["rooms"]
    assert "dorm" not in data["posts"]
    # The runtime room tables agree.
    rooms_block = HTML[HTML.index("const ACADEMY_ROOMS = {"):HTML.index("const ACADEMY_ROOM_STAT_EFFECTS")]
    assert "dorm:" not in rooms_block
    assert "THE ROOST" not in HTML


def test_the_tree_carries_the_rest_and_the_care_actions():
    # The gardens mend HP gently — the exact rate the Roost used to sell.
    sweep = HTML[HTML.index("const roomBoost = academyRoleMultiplier(room)"):]
    sweep = sweep[:sweep.index("academyGraduationOverlay")]
    assert "if (room === 'outdoors') b.hp = clamp((b.hp || b.maxHp) + Math.max(1, Math.round((b.maxHp || 100) * 0.04 * roomBoost)), 1, b.maxHp || 100);" in sweep
    assert "'dorm'" not in sweep
    # Feed, groom, deep rest and forage all live in the gardens panel.
    panel = HTML[HTML.index("if (academySelectedRoom === 'outdoors') {"):]
    panel = panel[:panel.index("} else if (academySelectedRoom === 'training')")]
    for marker in ("academyFeed", "academyGroom", "academyRest", "academyForage"):
        assert marker in panel, marker


def test_the_barracks_is_the_tutorial_build_lesson():
    assert "maybeGrantMerlinBarracksGift" in HTML
    assert "onFirstBarracksBuilt" in HTML
    assert "THE BARRACKS IS BUILT!" in HTML
    assert "barracks-built" in HTML
    assert "roost-built" not in HTML
    assert "maybeGrantMerlinRoostGift" not in HTML
    # The gift covers exactly the Barracks bill.
    assert "ACADEMY_BUILDINGS.tavern) || { cost:60, branches:8 }" in HTML


def test_old_saves_migrate_refund_and_rehome():
    load = HTML[HTML.index("// The Roost is retired — the tree itself is home."):]
    load = load[:load.index("// v6:")]
    assert "gameState.player.coins = (Number(gameState.player.coins) || 0) + 50" in load
    assert "gameState.player.branches = (Number(gameState.player.branches) || 0) + 10" in load
    assert "delete gameState.academyBuildings.dorm" in load
    assert "if (b.academy.room === 'dorm') b.academy.room = 'outdoors'" in load
    assert "if (b.academy.hospitalReturnRoom === 'dorm') b.academy.hospitalReturnRoom = 'outdoors'" in load
    assert "gameState.birdRoles.academy.dorm" in load
