(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzBirdBondCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // bird-bond-love-v256-20260812: every bird can be loved for itself.
  // Players grow attached to different birds, so every companion carries its
  // own bond: a favourite flag, a bond level with a warm title, and a preen
  // action that deepens the bond a little at a time. Bond is affection, not
  // power — it never touches battle stats, so no player is punished for
  // loving a robin over a raven.

  const HOUR_MS = 60 * 60 * 1000;
  const MAX_BOND_LEVEL = 5;
  const XP_PER_BOND_LEVEL = 100;
  // Preening is a small, repeatable moment of care. The cooldown keeps it a
  // ritual (a few visits a day), not a tap-mash.
  const PREEN_COOLDOWN_MS = 4 * HOUR_MS;
  const PREEN_BOND_XP = 20;
  const PREEN_HAPPINESS = 12;
  const FEED_BOND_XP = 6;

  // One title per level. Level 5 is the end of the road on purpose — a bond
  // that finishes feels earned, not ground.
  const BOND_TITLES = Object.freeze(['New Friend', 'Companion', 'Close Friend', 'Beloved', 'Soulbound']);

  function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(n)));
  }

  function validTime(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // Heal any saved bond into a safe shape. Old saves have no bond at all —
  // they wake up as level-1 New Friends with everything still ahead of them.
  function sanitizeBond(raw) {
    const bond = raw && typeof raw === 'object' ? raw : {};
    const level = clampInt(bond.level, 1, MAX_BOND_LEVEL, 1);
    const xp = level >= MAX_BOND_LEVEL ? 0 : clampInt(bond.xp, 0, XP_PER_BOND_LEVEL - 1, 0);
    return {
      level: level,
      xp: xp,
      favourite: bond.favourite === true,
      lastPreenAt: validTime(bond.lastPreenAt),
      preens: clampInt(bond.preens, 0, Number.MAX_SAFE_INTEGER, 0)
    };
  }

  function bondTitle(level) {
    return BOND_TITLES[clampInt(level, 1, MAX_BOND_LEVEL, 1) - 1];
  }

  function bondProgress(rawBond) {
    const bond = sanitizeBond(rawBond);
    const max = bond.level >= MAX_BOND_LEVEL;
    return {
      level: bond.level,
      title: bondTitle(bond.level),
      xp: bond.xp,
      next: XP_PER_BOND_LEVEL,
      pct: max ? 100 : Math.min(100, Math.round((bond.xp / XP_PER_BOND_LEVEL) * 100)),
      max: max
    };
  }

  // Grow the bond. Returns a fresh bond object — callers compare levels to
  // spot a bond-up. XP past the final level is let go, not banked.
  function grantBondXp(rawBond, amount) {
    const bond = sanitizeBond(rawBond);
    let gained = clampInt(amount, 0, 10000, 0);
    while (gained > 0 && bond.level < MAX_BOND_LEVEL) {
      const room = XP_PER_BOND_LEVEL - bond.xp;
      const step = Math.min(room, gained);
      bond.xp += step;
      gained -= step;
      if (bond.xp >= XP_PER_BOND_LEVEL) { bond.level += 1; bond.xp = 0; }
    }
    if (bond.level >= MAX_BOND_LEVEL) bond.xp = 0;
    return bond;
  }

  function canPreen(rawBond, now = Date.now()) {
    const bond = sanitizeBond(rawBond);
    if (!bond.lastPreenAt) return { ok: true, remainingMs: 0 };
    const elapsed = now - bond.lastPreenAt;
    if (elapsed >= PREEN_COOLDOWN_MS || elapsed < 0) return { ok: true, remainingMs: 0 };
    return { ok: false, remainingMs: PREEN_COOLDOWN_MS - elapsed };
  }

  // One preen: stamp the time, count it, and grow the bond. If the bird was
  // preened too recently nothing changes — the caller shows the wait instead.
  function preen(rawBond, now = Date.now()) {
    const gate = canPreen(rawBond, now);
    const before = sanitizeBond(rawBond);
    if (!gate.ok) return { ok: false, bond: before, leveled: false, remainingMs: gate.remainingMs };
    const bond = grantBondXp(before, PREEN_BOND_XP);
    bond.lastPreenAt = now;
    bond.preens = before.preens + 1;
    return { ok: true, bond: bond, leveled: bond.level > before.level, remainingMs: 0 };
  }

  // "3h 12m" / "58m" / "under a minute" — for the preen button's wait copy.
  function describeWait(ms) {
    const total = Math.max(0, Math.ceil(Number(ms) || 0));
    if (total < 60000) return 'under a minute';
    const minutes = Math.ceil(total / 60000);
    if (minutes < 60) return minutes + 'm';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? hours + 'h ' + rest + 'm' : hours + 'h';
  }

  return {
    MAX_BOND_LEVEL,
    XP_PER_BOND_LEVEL,
    PREEN_COOLDOWN_MS,
    PREEN_BOND_XP,
    PREEN_HAPPINESS,
    FEED_BOND_XP,
    BOND_TITLES,
    sanitizeBond,
    bondTitle,
    bondProgress,
    grantBondXp,
    canPreen,
    preen,
    describeWait
  };
});
