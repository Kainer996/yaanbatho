// Burbz Bird Roles Core — "Every bird has a job".
// A bird can be given ONE post in the Kingdom: a room of the Academy to run, a
// village to project-manage, or a whole region to hold. The post is only as good as
// the bird in it — each role reads the stats that job actually needs, and a
// clever bird runs a clever building better. Put the sharpest mind in the
// Library and the Library itself gets better; put a fool in there and the
// shelves stay dusty.
//
// The rule for the intellectual posts is deliberately blunt: INT is the whole
// job. Librarian, Star Charter and Head Chef all read INT first, because the
// player asked for exactly that — the more intelligent the bird, the better
// the work.
//
// The CIVIC posts — Steward of a village, Warden of a region — carry a second
// law (raven-weight-and-wit-v255): weight and wit pull opposite ways. The big
// birds win the battles and haul the timber, but a heavyweight behind a
// governor's desk is heavy going; the small charmers — the robin above all —
// run a town best. Size feeds the battle rule in bird_size_core.js; here it
// counts AGAINST the ledger.
// Pure module: no DOM, no game state of its own, UMD export.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzBirdRolesCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function n(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // A stat of 250 is mastery for the purposes of a job: a fresh companion sits
  // around 50-80, a well-drilled one passes 250 and pegs the meter. (Stats
  // themselves go higher — this is the scale of the WORK, not of the bird.)
  const STAT_MASTERY = 250;

  // How much better than an unstaffed building the very best appointee makes it.
  const MAX_ROLE_BONUS = 0.75;

  // Head Chef mastery is earned by real time on duty, not by the companion's
  // ordinary combat level. One day advances one Chef Level; level 10 unlocks
  // the whole-kitchen "Feed all birds" service. Earned time is retained if the
  // chef stands down and resumes later.
  const CHEF_MAX_LEVEL = 10;
  const CHEF_MS_PER_LEVEL = 24 * 60 * 60 * 1000;
  const CHEF_REWARD_BONUS_PER_LEVEL = 0.02;

  const ROLE_RANKS = [
    { id:'novice',      label:'Novice',      icon:'🌱', min:0 },
    { id:'apprentice',  label:'Apprentice',  icon:'📗', min:20 },
    { id:'keeper',      label:'Keeper',      icon:'🔑', min:40 },
    { id:'master',      label:'Master',      icon:'🎓', min:60 },
    { id:'grandmaster', label:'Grandmaster', icon:'👑', min:80 }
  ];

  // ---------------------------------------------------------------------------
  // The posts
  // ---------------------------------------------------------------------------
  // scope   — where the post is held: an Academy room, a village, a region.
  // key     — for academy roles, the room id it belongs to.
  // stats   — the weighted mix that decides how good this bird is at the job.
  // effect  — what the post actually changes in the game, in plain words.
  const ROLES = [
    // ---- The Academy ------------------------------------------------------
    {
      id:'librarian', title:'Librarian', icon:'📚', scope:'academy', key:'library',
      stats:{ int:1 },
      effect:{ id:'study_speed', label:'Study speed', copy:'Birds stationed in the Library learn INT faster.' },
      copy:'The Library runs on one thing: the mind of the bird who keeps it. A clever librarian knows every scroll on every shelf, so every bird studying here learns faster.'
    },
    {
      id:'star_charter', title:'Star Charter', icon:'🔭', scope:'academy', key:'observatory',
      stats:{ int:0.75, spd:0.25 },
      effect:{ id:'study_speed', label:'Charting speed', copy:'Birds stationed in the Observatory learn INT faster.' },
      copy:'Someone has to read the sky and write it down. A sharp mind with quick eyes charts more of it each night.'
    },
    {
      id:'drill_master', title:'Drill Master', icon:'🏋️', scope:'academy', key:'training',
      stats:{ atk:0.6, stamina:0.4 },
      effect:{ id:'training_speed', label:'Drill intensity', copy:'Birds stationed in the Training Hall gain ATK faster.' },
      copy:'A hard bird runs a hard hall. Strength and staying power make the drills bite.'
    },
    {
      id:'nest_architect', title:'Nest Architect', icon:'🛠️', scope:'academy', key:'workshop',
      stats:{ int:0.5, def:0.5 },
      effect:{ id:'training_speed', label:'Build quality', copy:'Birds stationed in the Workshop gain DEF faster.' },
      copy:'Half engineering, half brute nest-craft — the best architects have both.'
    },
    {
      id:'innkeeper', title:'Innkeeper', icon:'🍻', scope:'academy', key:'crowbar',
      stats:{ cha:0.8, int:0.2 },
      effect:{ id:'training_speed', label:'Good company', copy:'Birds drinking at The Crowbar gain CHA faster and cheer up quicker.' },
      copy:'Diplomacy is taught over a table, not a lectern. A charming host draws the whole bar into the conversation.'
    },
    {
      id:'head_healer', title:'Head Healer', icon:'🏥', scope:'academy', key:'hospital',
      stats:{ int:0.6, cha:0.4 },
      effect:{ id:'heal_rate', label:'Recovery rate', copy:'Hurt birds in the Hospital heal faster.' },
      copy:'Knowing what is wrong, and being gentle about it. Clever hands mend wings sooner.'
    },
    {
      id:'head_chef', title:'Head Chef', icon:'🥣', scope:'academy', key:'kitchen',
      stats:{ int:0.6, stamina:0.4 },
      effect:{ id:'meal_quality', label:'Meal quality', copy:'Every meal served pays more XP, coins and cheer — and one serving feeds every companion of the same species at once.' },
      copy:'The Kitchen wants a thinker. A clever chef knows what every species really eats and how to prepare it, so every plate does more good.'
    },
    {
      id:'nest_nanny', title:'Nest Nanny', icon:'🥚', scope:'academy', key:'nursery',
      stats:{ cha:0.6, int:0.4 },
      effect:{ id:'care_rate', label:'Nursery care', copy:'Birds in the Nursery gain happiness while stationed there.' },
      copy:'Patience and warmth, in that order. Chicks settle for a nanny they trust.'
    },
    {
      id:'quartermaster', title:'Quartermaster', icon:'🧭', scope:'academy', key:'quest_roost',
      stats:{ int:0.5, stamina:0.3, spd:0.2 },
      effect:{ id:'expedition_yield', label:'Expedition planning', copy:'Every expedition claimed pays more coins and timber.' },
      copy:'Routes, rations and where to look first. A well-run Roost sends birds out better prepared, and they come back heavier.'
    },
    {
      id:'recruiting_officer', title:'Recruiting Officer', icon:'🪶', scope:'academy', key:'tavern',
      stats:{ cha:0.7, int:0.3 },
      effect:{ id:'recruit_discount', label:'Recruiting', copy:'Birds join the flock for fewer coins.' },
      copy:'Talking strangers into a life of adventure is a charm job with a head for numbers.'
    },
    {
      id:'head_gardener', title:'Head Gardener', icon:'🌱', scope:'academy', key:'outdoors',
      stats:{ stamina:0.5, int:0.5 },
      effect:{ id:'care_rate', label:'Foraging grounds', copy:'Birds roaming the Aviary Gardens stay happier and go hungry slower.' },
      copy:'Knowing which beds to let run wild and which to keep cropped is how the Gardens feed themselves.'
    },
    // ---- The realm --------------------------------------------------------
    // Civic posts: weight counts against the ledger. A village trusts a
    // charmer at the door, not a shadow over the market square.
    {
      // The village post is the PROJECT MANAGER (Yaan, 2026-08-20): the bird
      // that runs the building sites and keeps the ledger. Grander civic
      // titles — Lord Mayors for towns, Councillors for counties — come
      // later. The id stays 'steward' so old saves keep their appointee.
      id:'steward', title:'Project Manager', icon:'📋', scope:'village', key:null,
      stats:{ int:0.5, cha:0.5 }, civic:true,
      effect:{ id:'village_yield', label:'Project management', copy:'Two builds can rise at once here. Every build is faster and costs a little less — and the village pays more taxes, timber and goods.' },
      copy:'One bird runs every project in the village: it plans the scaffolds, sweet-talks the masons, haggles the timber yard and keeps the tax ledger straight. A foreman on site means a second crew can work in parallel, so two builds rise at once. Wit and charm do the work, and the lighter the bird, the easier the folk take to it. A robin melts the market square; a raven empties it.'
    },
    {
      id:'region_warden', title:'Warden of the Region', icon:'👑', scope:'region', key:null,
      stats:{ int:0.5, cha:0.5 }, civic:true,
      effect:{ id:'region_yield', label:'Regional rule', copy:'Caravan roads touching this region earn more, and its sanctuaries pay a little extra.' },
      copy:'A region is too big for one town hall. The Warden rides between sanctuaries, keeps the roads open and the tribute honest — charm-and-wit work, and heavy going for a heavyweight.'
    }
  ];

  const ROLE_INDEX = Object.fromEntries(ROLES.map(r => [r.id, r]));
  const ACADEMY_ROLE_BY_ROOM = Object.fromEntries(ROLES.filter(r => r.scope === 'academy').map(r => [r.key, r]));

  function roleById(id) { return ROLE_INDEX[String(id || '')] || null; }
  function academyRoleForRoom(roomId) { return ACADEMY_ROLE_BY_ROOM[String(roomId || '')] || null; }
  function villageRole() { return ROLE_INDEX.steward; }
  function regionRole() { return ROLE_INDEX.region_warden; }

  // ---------------------------------------------------------------------------
  // Weight and wit — the civic size rule
  // ---------------------------------------------------------------------------
  // How well a bird of this weight sits behind a governor's desk, as a
  // multiplier on its civic aptitude. Up to jackdaw weight (score 40) size is
  // no handicap, and the true lightweights — the robin's bracket, score 20 and
  // under — win a small charm bonus on top. Past 40 the desk shrinks: a crow
  // gives up a sixth of its aptitude, a raven a quarter, an eagle almost half.
  // Battle strength runs the other way (bird_size_core.js), so the trade is
  // real: the bird that wins your battles is not the bird that runs your towns.
  const CIVIC_FULL_WIT_MAX_SCORE = 40;
  const CIVIC_SMALL_CHARM_BONUS = 0.15;
  const CIVIC_GIANT_WIT_PENALTY = 0.45;
  function governanceWitFactor(sizeScore) {
    const s = Number(sizeScore);
    if (!Number.isFinite(s)) return 1;   // no known size: no opinion
    const score = clamp(s, 0, 100);
    if (score <= 20) return 1 + CIVIC_SMALL_CHARM_BONUS;
    if (score <= CIVIC_FULL_WIT_MAX_SCORE) {
      return 1 + CIVIC_SMALL_CHARM_BONUS * (CIVIC_FULL_WIT_MAX_SCORE - score) / (CIVIC_FULL_WIT_MAX_SCORE - 20);
    }
    return 1 - CIVIC_GIANT_WIT_PENALTY * (score - CIVIC_FULL_WIT_MAX_SCORE) / (100 - CIVIC_FULL_WIT_MAX_SCORE);
  }

  // ---------------------------------------------------------------------------
  // The Project Manager's site work (steward-project-manager-v294)
  // ---------------------------------------------------------------------------
  // Yaan's rule: the appointed village bird runs the building sites.
  // How much it helps reads straight off the same civic aptitude — INT and CHA,
  // weighed down by size — so the songbirds and the robin, no use in a battle
  // line, become the best project managers in the realm. A perfect appointee
  // takes 30% off every build clock and 15% off the bill. An empty post
  // changes nothing: both factors sit at exactly 1.
  const STEWARD_MAX_BUILD_SPEEDUP = 0.30;
  const STEWARD_MAX_COST_DISCOUNT = 0.15;
  function stewardProjectFactors(aptitude) {
    const a = clamp(n(aptitude, 0), 0, 100) / 100;
    const buildFactor = Math.round((1 - STEWARD_MAX_BUILD_SPEEDUP * a) * 1000) / 1000;
    const costFactor = Math.round((1 - STEWARD_MAX_COST_DISCOUNT * a) * 1000) / 1000;
    return {
      buildFactor,
      costFactor,
      speedPct: Math.round((1 - buildFactor) * 100),
      discountPct: Math.round((1 - costFactor) * 100)
    };
  }

  // ---------------------------------------------------------------------------
  // How good is this bird at this job?
  // ---------------------------------------------------------------------------
  // 0-100. Every point of it is earned from the stats the job names — which is
  // why training a bird's INT in the Library and then making it the Librarian
  // is a real, compounding strategy. Civic posts then weigh the bird itself:
  // the same stats govern better on a robin than on a raven.
  function roleAptitude(bird, role) {
    const def = typeof role === 'string' ? roleById(role) : role;
    if (!def || !bird) return 0;
    const weights = def.stats || {};
    let total = 0, weightSum = 0;
    Object.entries(weights).forEach(([stat, weight]) => {
      const w = Math.max(0, Number(weight) || 0);
      if (!w) return;
      const value = stat === 'hp' ? n(bird.maxHp, n(bird.hp, 50)) : n(bird[stat], 50);
      total += w * clamp(value / STAT_MASTERY, 0, 1) * 100;
      weightSum += w;
    });
    if (weightSum <= 0) return 0;
    const base = total / weightSum;
    const witted = def.civic ? base * governanceWitFactor(bird.sizeScore) : base;
    return Math.round(clamp(witted, 0, 100));
  }

  function rankForAptitude(aptitude) {
    const a = clamp(n(aptitude, 0), 0, 100);
    let match = ROLE_RANKS[0];
    for (const rank of ROLE_RANKS) if (a >= rank.min) match = rank;
    return match;
  }

  // The number the rest of the game multiplies by. An empty post is 1.0 — the
  // building keeps working exactly as it always did, and a posting is upside
  // only.
  function roleEffectiveness(bird, role) {
    const def = typeof role === 'string' ? roleById(role) : role;
    if (!def || !bird) {
      return { role: def || null, staffed:false, aptitude:0, rank:ROLE_RANKS[0], bonusPct:0, multiplier:1 };
    }
    const aptitude = roleAptitude(bird, def);
    const multiplier = 1 + MAX_ROLE_BONUS * (aptitude / 100);
    return {
      role: def,
      staffed: true,
      aptitude,
      rank: rankForAptitude(aptitude),
      bonusPct: Math.round((multiplier - 1) * 100),
      multiplier: Math.round(multiplier * 1000) / 1000
    };
  }

  // Who should hold this post? Highest aptitude wins; ties break on name so the
  // suggestion never flickers between renders.
  function bestCandidate(birds, role) {
    const def = typeof role === 'string' ? roleById(role) : role;
    if (!def || !Array.isArray(birds) || !birds.length) return null;
    return birds.slice().sort((a, b) => {
      const diff = roleAptitude(b, def) - roleAptitude(a, def);
      if (diff) return diff;
      return String(a && a.id).localeCompare(String(b && b.id));
    })[0] || null;
  }

  function rankCandidates(birds, role) {
    const def = typeof role === 'string' ? roleById(role) : role;
    if (!def || !Array.isArray(birds)) return [];
    return birds
      .map(bird => ({ bird, ...roleEffectiveness(bird, def) }))
      .sort((a, b) => (b.aptitude - a.aptitude) || String(a.bird && a.bird.id).localeCompare(String(b.bird && b.bird.id)));
  }

  // ---------------------------------------------------------------------------
  // Assignment state
  // ---------------------------------------------------------------------------
  // Shape: { academy:{ roomId: birdId }, villages:{ seed: birdId }, regions:{ regionId: birdId } }
  // One bird, one job: assigning a bird that already holds a post vacates the
  // old one, so the flock can never be double-counted.
  const SCOPE_BUCKETS = { academy:'academy', village:'villages', region:'regions' };

  function sanitizeRoleState(raw) {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const out = { academy:{}, villages:{}, regions:{} };
    Object.values(SCOPE_BUCKETS).forEach(bucket => {
      const table = src[bucket];
      if (!table || typeof table !== 'object' || Array.isArray(table)) return;
      Object.entries(table).forEach(([key, birdId]) => {
        const id = String(birdId || '').trim();
        if (!key || !id) return;
        out[bucket][String(key)] = id;
      });
    });
    return out;
  }

  function bucketFor(scope) { return SCOPE_BUCKETS[String(scope || '')] || null; }

  function assignedBirdId(state, scope, key) {
    const bucket = bucketFor(scope);
    if (!bucket) return null;
    const table = (state && state[bucket]) || {};
    return table[String(key)] || null;
  }

  // Every post this bird currently holds — normally at most one, but a save
  // healed from an older build might disagree, and the UI should show the truth.
  function postsHeldBy(state, birdId) {
    const id = String(birdId || '');
    const posts = [];
    if (!id) return posts;
    Object.entries(SCOPE_BUCKETS).forEach(([scope, bucket]) => {
      const table = (state && state[bucket]) || {};
      Object.entries(table).forEach(([key, holder]) => {
        if (String(holder) === id) posts.push({ scope, key });
      });
    });
    return posts;
  }

  function assignRole(state, scope, key, birdId) {
    const next = sanitizeRoleState(state);
    const bucket = bucketFor(scope);
    const id = String(birdId || '').trim();
    if (!bucket || !key || !id) return next;
    // One bird, one job.
    postsHeldBy(next, id).forEach(post => { delete next[bucketFor(post.scope)][post.key]; });
    next[bucket][String(key)] = id;
    return next;
  }

  function unassignRole(state, scope, key) {
    const next = sanitizeRoleState(state);
    const bucket = bucketFor(scope);
    if (!bucket || !key) return next;
    delete next[bucket][String(key)];
    return next;
  }

  // ---------------------------------------------------------------------------
  // The Head Chef's table service: one order, the whole species
  // ---------------------------------------------------------------------------
  // With a Head Chef appointed, feeding one companion plates the same food for
  // every hungry flock-mate of the same species in the same sitting, instead of
  // the player tapping through each duplicate bird. Pure planning: the caller
  // passes whether the post is staffed, the flock-mate rows ({ key, hunger })
  // and how many servings are in stock. The plan says who eats, who was already
  // full (nothing is wasted on a full bird), and how many went short because
  // the stores ran dry. No chef → nobody is bulk-served, exactly as before.
  function chefServicePlan(staffed, rows, stockCount) {
    if (!staffed) return { fed:[], alreadyFull:[], shortBy:0 };
    const list = Array.isArray(rows) ? rows.filter(r => r && r.key != null) : [];
    const hungry = list.filter(r => Number(r.hunger) > 0);
    const alreadyFull = list.filter(r => !(Number(r.hunger) > 0)).map(r => String(r.key));
    const stock = Math.max(0, Math.floor(Number(stockCount) || 0));
    return {
      fed: hungry.slice(0, stock).map(r => String(r.key)),
      alreadyFull,
      shortBy: Math.max(0, hungry.length - stock)
    };
  }

  function sanitizeChefCareer(raw) {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const workedMs = Math.max(0, Math.floor(n(src.workedMs, 0)));
    const activeSinceValue = src.activeSince == null ? NaN : Number(src.activeSince);
    const activeSince = Number.isFinite(activeSinceValue) && activeSinceValue >= 0 ? activeSinceValue : null;
    return { workedMs, activeSince };
  }

  function startChefCareer(raw, now) {
    const career = sanitizeChefCareer(raw);
    if (career.activeSince == null) career.activeSince = Math.max(0, n(now, Date.now()));
    return career;
  }

  function pauseChefCareer(raw, now) {
    const career = sanitizeChefCareer(raw);
    if (career.activeSince != null) {
      career.workedMs += Math.max(0, n(now, Date.now()) - career.activeSince);
      career.activeSince = null;
    }
    return career;
  }

  function chefCareerProgress(raw, now) {
    const career = sanitizeChefCareer(raw);
    const at = Math.max(0, n(now, Date.now()));
    const totalMs = career.workedMs + (career.activeSince == null ? 0 : Math.max(0, at - career.activeSince));
    const level = clamp(1 + Math.floor(totalMs / CHEF_MS_PER_LEVEL), 1, CHEF_MAX_LEVEL);
    const intoLevelMs = level >= CHEF_MAX_LEVEL ? CHEF_MS_PER_LEVEL : totalMs % CHEF_MS_PER_LEVEL;
    return {
      level,
      totalMs,
      intoLevelMs,
      nextLevelMs: CHEF_MS_PER_LEVEL,
      feedAllUnlocked: level >= CHEF_MAX_LEVEL,
      rewardMultiplier: Math.round((1 + (level - 1) * CHEF_REWARD_BONUS_PER_LEVEL) * 1000) / 1000
    };
  }

  // Pure whole-kitchen planner. It first maximises how many birds can eat, so
  // an omnivore cannot take the only meal a specialist accepts while another
  // suitable food sits unused. Within that maximum matching, proper meals are
  // tried before side snacks and input order decides ties.
  function chefFeedAllPlan(rows, stockByFood) {
    const stock = {};
    Object.entries(stockByFood && typeof stockByFood === 'object' ? stockByFood : {}).forEach(([key, value]) => {
      stock[String(key)] = Math.max(0, Math.floor(Number(value) || 0));
    });
    const verdictRank = { primary:0, secondary:1, insufficient:2 };
    const seenKeys = new Set();
    const list = [];
    (Array.isArray(rows) ? rows : []).forEach((row, index) => {
      if (!row || row.key == null) return;
      const key = String(row.key);
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      list.push({
        key,
        index,
        options:(Array.isArray(row.options) ? row.options : [])
          .filter(option => option && option.foodKey && stock[String(option.foodKey)] > 0 && verdictRank[option.verdict] != null)
          .map(option => ({ foodKey:String(option.foodKey), verdict:String(option.verdict) }))
          .sort((a, b) => verdictRank[a.verdict] - verdictRank[b.verdict])
      });
    });
    const units = [];
    Object.entries(stock).forEach(([foodKey, count]) => {
      for (let i = 0; i < Math.min(count, list.length); i += 1) units.push({ id:foodKey + '#' + i, foodKey });
    });
    const unitOwner = new Map();
    const rowUnit = new Map();
    const rowByKey = new Map(list.map(row => [row.key, row]));
    function trySeat(row, seenUnits, seenRows) {
      if (!row || seenRows.has(row.key)) return false;
      seenRows.add(row.key);
      for (const option of row.options) {
        for (const unit of units) {
          if (unit.foodKey !== option.foodKey || seenUnits.has(unit.id)) continue;
          seenUnits.add(unit.id);
          const ownerKey = unitOwner.get(unit.id);
          if (!ownerKey || trySeat(rowByKey.get(ownerKey), seenUnits, seenRows)) {
            unitOwner.set(unit.id, row.key);
            rowUnit.set(row.key, { unitId:unit.id, foodKey:option.foodKey, verdict:option.verdict });
            return true;
          }
        }
      }
      return false;
    }
    list.forEach(row => trySeat(row, new Set(), new Set()));
    const assignments = [];
    const unfed = [];
    list.sort((a, b) => a.index - b.index).forEach(row => {
      const match = rowUnit.get(row.key);
      if (!match) { unfed.push(row.key); return; }
      assignments.push({ key:row.key, foodKey:match.foodKey, verdict:match.verdict });
      stock[match.foodKey] -= 1;
    });
    return { assignments, unfed, remainingStock:stock };
  }

  // Drop posts held by birds that have left the flock (released, or a save
  // healed across builds), so a vacancy is never invisible.
  function pruneRoleState(state, liveBirdIds) {
    const live = new Set((liveBirdIds || []).map(id => String(id)));
    const next = sanitizeRoleState(state);
    Object.values(SCOPE_BUCKETS).forEach(bucket => {
      Object.entries(next[bucket]).forEach(([key, birdId]) => {
        if (!live.has(String(birdId))) delete next[bucket][key];
      });
    });
    return next;
  }

  return {
    ROLES,
    ROLE_INDEX,
    ROLE_RANKS,
    STAT_MASTERY,
    MAX_ROLE_BONUS,
    CHEF_MAX_LEVEL,
    CHEF_MS_PER_LEVEL,
    CHEF_REWARD_BONUS_PER_LEVEL,
    CIVIC_FULL_WIT_MAX_SCORE,
    CIVIC_SMALL_CHARM_BONUS,
    CIVIC_GIANT_WIT_PENALTY,
    STEWARD_MAX_BUILD_SPEEDUP,
    STEWARD_MAX_COST_DISCOUNT,
    stewardProjectFactors,
    governanceWitFactor,
    roleById,
    academyRoleForRoom,
    villageRole,
    regionRole,
    roleAptitude,
    rankForAptitude,
    roleEffectiveness,
    bestCandidate,
    rankCandidates,
    sanitizeRoleState,
    assignedBirdId,
    postsHeldBy,
    assignRole,
    unassignRole,
    chefServicePlan,
    sanitizeChefCareer,
    startChefCareer,
    pauseChefCareer,
    chefCareerProgress,
    chefFeedAllPlan,
    pruneRoleState
  };
});
