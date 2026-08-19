// Burbz Building Discovery Core — the trades hide until you find them.
// Every village rolls its trades from its seed, but none of them shows —
// not in the village, not on a town square — until the player uncovers it
// on a real-life walking quest through that settlement's land. Each
// waymarker reached inside a village's reach opens one more of its doors.
// The player's own builds (farms, wells, the Alehouse) are never gated:
// what you raise yourself needs no finding.
// Pure logic module: no DOM, deterministic, UMD export for Node tests.
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzBuildingDiscoveryCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // The five trades a settlement can host. Mirrors VILLAGE_SHOPS in
  // index.html — a key outside this list is never stored or returned.
  const SHOP_TRADE_KEYS = ['general', 'potion', 'smith', 'tavern', 'guild'];

  // How close (metres) a quest waymarker must be to a village's heart for a
  // reach to count as walking that village's land. Matches the range at
  // which a village can be walked into from the live map.
  const SHOP_DISCOVERY_RANGE_M = 1200;

  function validKey(key) { return SHOP_TRADE_KEYS.indexOf(key) !== -1; }

  function seedKey(seed) { return String(Number(seed) >>> 0); }

  // Heal a stored discovery map: seed → array of unique, valid trade keys.
  // Anything malformed is dropped, never thrown on.
  function sanitizeShopDiscoveries(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).forEach(k => {
      const seed = Number(k);
      if (!Number.isFinite(seed)) return;
      const list = raw[k];
      if (!Array.isArray(list)) return;
      const keep = [];
      list.forEach(key => { if (validKey(key) && keep.indexOf(key) === -1) keep.push(key); });
      if (keep.length) out[seedKey(seed)] = keep;
    });
    return out;
  }

  // The trades of `allKeys` the player has found in this settlement, in the
  // settlement's own deterministic order — so a discovered shop always
  // stands exactly where it always would have.
  function discoveredShopKeys(discoveries, seed, allKeys) {
    const found = discoveries && discoveries[seedKey(seed)];
    if (!Array.isArray(found) || !found.length) return [];
    return (Array.isArray(allKeys) ? allKeys : []).filter(k => validKey(k) && found.indexOf(k) !== -1);
  }

  // The next trade a walk would uncover here: first undiscovered key in the
  // settlement's order (the general store leads), or null when all are found.
  function nextShopDiscovery(discoveries, seed, allKeys) {
    const found = (discoveries && discoveries[seedKey(seed)]) || [];
    const keys = Array.isArray(allKeys) ? allKeys : [];
    for (let i = 0; i < keys.length; i++) {
      if (validKey(keys[i]) && found.indexOf(keys[i]) === -1) return keys[i];
    }
    return null;
  }

  // Record one find. Mutates the map in place (it lives on gameState) and
  // returns true only when something new was written.
  function recordShopDiscovery(discoveries, seed, key) {
    if (!discoveries || typeof discoveries !== 'object' || !validKey(key)) return false;
    const sk = seedKey(seed);
    if (!Array.isArray(discoveries[sk])) discoveries[sk] = [];
    if (discoveries[sk].indexOf(key) !== -1) return false;
    discoveries[sk].push(key);
    return true;
  }

  // The town square keeps one shopfront per ward — but only among the trades
  // its village has actually revealed. `roll` is the ward's own die in
  // [0, 1), burned by the caller whether or not anything shows.
  function townShopfrontKey(discoveredKeys, roll) {
    const keys = (Array.isArray(discoveredKeys) ? discoveredKeys : []).filter(validKey);
    if (!keys.length) return null;
    const r = isFinite(roll) ? Math.min(0.999999, Math.max(0, Number(roll))) : 0;
    return keys[Math.floor(r * keys.length) % keys.length];
  }

  // Honest progress for the governor's desk: how many of this settlement's
  // trades are found, out of how many it holds.
  function shopDiscoveryProgress(discoveries, seed, allKeys) {
    const keys = (Array.isArray(allKeys) ? allKeys : []).filter(validKey);
    return { found: discoveredShopKeys(discoveries, seed, keys).length, total: keys.length };
  }

  return {
    SHOP_TRADE_KEYS: SHOP_TRADE_KEYS,
    SHOP_DISCOVERY_RANGE_M: SHOP_DISCOVERY_RANGE_M,
    sanitizeShopDiscoveries: sanitizeShopDiscoveries,
    discoveredShopKeys: discoveredShopKeys,
    nextShopDiscovery: nextShopDiscovery,
    recordShopDiscovery: recordShopDiscovery,
    townShopfrontKey: townShopfrontKey,
    shopDiscoveryProgress: shopDiscoveryProgress
  };
});
