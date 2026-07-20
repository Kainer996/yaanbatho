(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurbzAcademyCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  // Building costs are two-resource: coins (found on quests and discoveries)
  // and branches (the Academy's timber, gathered on quests). Branch costs rise
  // with the tree — higher floors need more timber hauled up.
  const TREEHOUSE_ROOMS = [
    { id:'outdoors', label:'Aviary Gardens', icon:'🌱', cost:0, branches:0, unlockLevel:1, floor:0, branch:'trunk', x:50, y:92, role:'roam', effect:'Starter gardens: free roaming, foraging and happiness recovery.' },
    { id:'dorm', label:'The Roost', icon:'🏠', cost:50, branches:10, unlockLevel:1, floor:1, branch:'left', x:24, y:78, role:'housing', effect:'Bird housing: rest, feed, groom and assign companions.' },
    { id:'tavern', label:'Barracks', icon:'🪶', cost:60, branches:8, unlockLevel:1, floor:1, branch:'right', x:76, y:80, role:'recruitment', effect:'The Academy recruitment office: review discovered and befriended birds, inspect their full cards, and invite them into the flock.' },
    { id:'training', label:'Training Hall', icon:'🏋️', cost:85, branches:20, unlockLevel:2, floor:2, branch:'right', x:70, y:65, role:'training', trainStat:'atk', effect:'Permanent stat drills, passive XP, and slow ATK growth for birds stationed here.' },
    { id:'hospital', label:'Bird Hospital', icon:'🏥', cost:140, branches:30, unlockLevel:3, floor:3, branch:'left', x:26, y:53, role:'healing', effect:'Fast HP recovery for tired or hurt companions stationed here.' },
    { id:'crowbar', label:'The Crowbar', icon:'🍻', cost:160, branches:35, unlockLevel:4, floor:4, branch:'right', x:72, y:42, role:'social', trainStat:'cha', effect:'The bird bar: companions perched here grow Personality (PER) and morale — charm pays out on social quests.' },
    { id:'kitchen', label:'Kitchen & Pantry', icon:'🥣', cost:130, branches:25, unlockLevel:3, floor:3, branch:'trunk', x:50, y:52, role:'food', trainStat:'stamina', effect:'Hearty meals: birds stationed here grow Stamina and stay fed.' },
    { id:'workshop', label:'Nest Workshop', icon:'🛠️', cost:180, branches:45, unlockLevel:5, floor:5, branch:'left', x:25, y:31, role:'craft', trainStat:'def', effect:'Nest engineering: birds stationed here toughen up and grow DEF.' },
    { id:'nursery', label:'Hatchery Nursery', icon:'🥚', cost:240, branches:60, unlockLevel:7, floor:6, branch:'left', x:36, y:18, role:'bond', effect:'Baby-bird care and bonding progression.' },
    { id:'observatory', label:'Moon Observatory', icon:'🔭', cost:260, branches:70, unlockLevel:8, floor:6, branch:'right', x:64, y:14, role:'forecast', trainStat:'int', effect:'Stargazing study: birds stationed here grow INT while charting spawns and migrations.' },
    { id:'quest_roost', label:'Quest Roost', icon:'🧭', cost:110, branches:15, unlockLevel:2, floor:2, branch:'trunk', x:50, y:66, role:'quests', effect:'Send birds out on real-time expeditions for coins, branches and items.' }
  ];

  // Quest economy: short starter errands teach the loop with small, frequent
  // payouts; long quests pay clearly better totals so timers feel worth it.
  // branches:[min,max] is the timber payout used for Academy building.
  // chaWeight marks social quests: a bird's Personality (cha) adds bonus coins
  // there — charmers talk squirrels, traders and passers-by into better deals.
  const QUEST_TEMPLATES = {
    find_seed: { id:'find_seed', label:'Find Seed', minutes:3, icon:'🌾', minLevel:1, starter:true, coins:[0,7], branches:[1,2], xp:6, items:['seed_satchel'], beats:['hops straight from the garden path','checks the soft grass for fallen seed','tucks a tiny seed satchel under one wing','returns ready for another quick errand'] },
    find_coins: { id:'find_coins', label:'Find Coins', minutes:4, icon:'🪙', minLevel:1, chaWeight:1, starter:true, coins:[6,16], branches:[0,1], xp:8, items:['shiny_pebble'], beats:['flutters toward a sunny lane','spots a glint beside an old root','trades a bright pebble for pocket coins','returns jingling with tiny treasure'] },
    branch_run: { id:'branch_run', label:'Branch Run', minutes:5, icon:'🪵', minLevel:1, starter:true, coins:[0,5], branches:[4,7], xp:8, items:['soft_moss'], beats:['glides down to the windfall thicket','tugs loose the driest fallen twigs','stacks a neat bundle of branches','hauls the timber home for the builders'] },
    scavenge: { id:'scavenge', label:'Scavenge', minutes:5, icon:'🧺', minLevel:1, starter:true, coins:[2,10], branches:[2,4], xp:10, items:['soft_moss','berry_bundle'], beats:['sets off on a quick cosy scavenge','checks mossy twigs and berry leaves','bundles useful bits for the Academy','returns with simple supplies'] },
    short_forage: { id:'short_forage', label:'Hedgerow Forage', minutes:60, icon:'🌿', minLevel:1, chaWeight:0.5, coins:[22,44], branches:[5,10], xp:25, items:['berry_bundle','shiny_pebble','soft_moss'], beats:['sets off beneath the safe branches','finds a singing hedgerow path','checks a glittering hollow','returns with a beakful of useful things'] },
    supply_run: { id:'supply_run', label:'Pantry Supply Run', minutes:120, icon:'🥣', minLevel:2, chaWeight:1.5, coins:[50,95], branches:[8,14], xp:55, items:['seed_satchel','worm_tin','berry_bundle'], beats:['sets off with a tiny satchel','trades gossip at a squirrel market','spots a cache of field snacks','returns to the tree with supplies'] },
    timber_haul: { id:'timber_haul', label:'Timber Haul', minutes:150, icon:'🌳', minLevel:3, coins:[20,45], branches:[22,38], xp:75, items:['soft_moss','old_map'], beats:['flies out to the storm-fall clearing','marks the straightest fallen boughs','ropes a heavy bundle with vine loops','hauls the timber back for the high floors'] },
    moon_scout: { id:'moon_scout', label:'Moonlit Scout', minutes:180, icon:'🌙', minLevel:4, chaWeight:0.75, coins:[95,170], branches:[10,18], xp:90, items:['moon_feather','old_map','shiny_pebble'], clueId:'moon_branch_map', beats:['sets off as the leaves glow silver','follows Merlin runes through the canopy','marks a safe route past the shadow woods','returns with a new clue for the Kingdom of Burbz'] }
  };

  // Six battle disciplines, one per Academy room. Each claimed session raises
  // the stat AND counts toward that discipline's Perch League move tier
  // (1 session = move I, 3 = move II, 6 = move III — see battle_core.js).
  const TRAINING_TEMPLATES = {
    wing_sprints: { id:'wing_sprints', label:'Wing Sprints', minutes:120, icon:'🪽', stat:'spd', statLabel:'SPD', school:'aero', moveLine:'Quick Dart → Wind Slash → Sonic Dive', room:'training', roomLabel:'Training Hall', xp:38, bonus:1, hunger:10, happiness:-2, copy:'Two-hour agility drills. Teaches AERO battle moves — fast strikes that always go first.', beats:['warms up on the lantern perch','runs short wing-burst laps','practises soft landings','finishes with brighter reactions'] },
    perch_strength: { id:'perch_strength', label:'Perch Strength', minutes:180, icon:'⚔️', stat:'atk', statLabel:'ATK', school:'strike', moveLine:'Talon Jab → Power Strike → Tempest Talons', room:'training', roomLabel:'Training Hall', xp:58, bonus:1, hunger:14, happiness:-3, copy:'Three-hour power work. Teaches STRIKE battle moves — the heaviest raw damage.', beats:['tests balance on the training rail','pulls weighted seed pouches','works through safe target strikes','rests after a stronger session'] },
    guard_drills: { id:'guard_drills', label:'Guard Drills', minutes:150, icon:'🛡️', stat:'def', statLabel:'DEF', school:'guard', moveLine:'Feather Guard → Nest Wall → Iron Plumage', room:'workshop', roomLabel:'Nest Workshop', xp:48, bonus:1, hunger:12, happiness:-2, copy:'Nest-engineering toughness work. Teaches GUARD battle moves — shields that soak damage.', beats:['weaves a practice nest wall','holds steady against gusty bellows','learns to tuck and brace','emerges with sturdier plumage'] },
    focus_roost: { id:'focus_roost', label:'Focus Roost', minutes:300, icon:'🧠', stat:'int', statLabel:'INT', school:'mind', moveLine:'Sharp Eyes → Outsmart → Master Plan', room:'observatory', roomLabel:'Moon Observatory', xp:92, bonus:2, hunger:18, happiness:-4, copy:'Five-hour stargazing study. Teaches MIND battle moves — clever attacks that expose weak points.', beats:['studies target calls on the notice board','tracks moving feather markers','solves a tiny route puzzle','returns sharper and calmer'] },
    song_circle: { id:'song_circle', label:'Song Circle', minutes:90, icon:'🎵', stat:'cha', statLabel:'PER', school:'song', moveLine:'Rally Chirp → Morale Anthem → Dawn Chorus', room:'crowbar', roomLabel:'The Crowbar', xp:32, bonus:1, hunger:8, happiness:3, copy:'A merry session at the bird bar. Teaches SONG battle moves — anthems that rally the whole team.', beats:['takes the open-mic perch at The Crowbar','trades verses with the regulars','leads a rousing chorus','flies home with new confidence'] },
    pantry_gauntlet: { id:'pantry_gauntlet', label:'Pantry Gauntlet', minutes:240, icon:'🌰', stat:'stamina', statLabel:'STAM', school:'endure', moveLine:'Second Wind → Deep Roost → Marathon Heart', room:'kitchen', roomLabel:'Kitchen & Pantry', xp:70, bonus:1, hunger:-10, happiness:1, copy:'Four hours of hearty meals and endurance laps. Teaches ENDURE battle moves — mid-fight recovery.', beats:['carb-loads at the seed counter','runs pantry supply relays','holds a long soaring circuit','returns full and unshakeable'] }
  };

  const MERLIN_CLUES = {
    garden_gate_rune: {
      id: 'garden_gate_rune',
      title: "Merlin's Garden Gate Rune",
      copy: 'A silver rune points toward the first restored garden gate of the Kingdom of Burbz.',
      unlocksTrial: 'garden_gate_trial'
    },
    moon_branch_map: {
      id: 'moon_branch_map',
      title: 'Moon-Branch Route Map',
      copy: "A safe path through the high branches glows on Merlin's tablet.",
      unlocksTrial: 'moon_branch_trial'
    }
  };

  function hashString(str) { let h = 2166136261; for (let i=0;i<str.length;i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rand(seed, min, max) { const x = Math.sin(seed) * 10000; return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min; }
  function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

  function getAcademyRooms() { return TREEHOUSE_ROOMS.map(r => ({...r})); }
  function getQuestTemplates() { return Object.values(QUEST_TEMPLATES).map(q => ({...q, items:[...q.items], beats:[...q.beats], branches:Array.isArray(q.branches) ? [...q.branches] : [0,0]})); }
  function getTrainingTemplates() { return Object.values(TRAINING_TEMPLATES).map(t => ({...t, beats:[...t.beats]})); }
  function getMerlinClues() { return Object.values(MERLIN_CLUES).map(c => ({...c})); }

  function createTrainingSession(bird, templateId='wing_sprints', nowMs=Date.now()) {
    const template = TRAINING_TEMPLATES[templateId] || TRAINING_TEMPLATES.wing_sprints;
    const birdName = String(bird.customName || '').trim() || bird.commonName || bird.species || 'A brave bird';
    const durationMs = template.minutes * 60 * 1000;
    return {
      id: `train_${nowMs}_${String(bird.id || birdName).replace(/[^a-z0-9]+/gi,'_')}`,
      birdId: bird.id || null,
      birdName,
      templateId: template.id,
      label: template.label,
      icon: template.icon,
      stat: template.stat,
      statLabel: template.statLabel,
      school: template.school || null,
      room: template.room || 'training',
      startMs: nowMs,
      endMs: nowMs + durationMs,
      status: 'active',
      rewards: { xp: template.xp, stat: template.stat, statLabel: template.statLabel, bonus: template.bonus, hunger: template.hunger, happiness: template.happiness, school: template.school || null },
      seed: hashString(`${bird.id || birdName}|${template.id}|${nowMs}`)
    };
  }

  function advanceTrainingSession(session, nowMs=Date.now()) {
    const template = TRAINING_TEMPLATES[session.templateId] || TRAINING_TEMPLATES.wing_sprints;
    const total = Math.max(1, session.endMs - session.startMs);
    const elapsed = clamp(nowMs - session.startMs, 0, total);
    const progressPct = Math.round((elapsed / total) * 100);
    const status = progressPct >= 100 ? 'complete' : 'active';
    const visibleCount = clamp(Math.floor((progressPct / 100) * template.beats.length) + 1, 1, template.beats.length);
    const events = template.beats.slice(0, visibleCount).map((text, i) => ({
      atMs: session.startMs + Math.round((total / Math.max(1, template.beats.length - 1)) * i),
      text: `${session.birdName} ${text}.`
    }));
    return { ...session, status, progressPct, events, templateCopy: template.copy };
  }

  function createBirdExpedition(bird, templateId='short_forage', nowMs=Date.now()) {
    const template = QUEST_TEMPLATES[templateId] || QUEST_TEMPLATES.short_forage;
    const birdName = String(bird.customName || '').trim() || bird.commonName || bird.species || 'A brave bird';
    const seed = hashString(`${bird.id || birdName}|${template.id}|${nowMs}`);
    const durationMs = template.minutes * 60 * 1000;
    const endMs = nowMs + durationMs;
    const baseCoins = rand(seed, template.coins[0], template.coins[1]);
    const powerBonus = Math.floor(((bird.power || 80) + (bird.int || 40) + (bird.spd || 40) + (bird.stamina || 40)) / 90);
    // Personality pays on social quests: charming birds haggle better prices.
    const charmBonus = template.chaWeight ? Math.floor(((bird.cha || 40) * template.chaWeight) / 60) : 0;
    // Branch (timber) payout: stronger, steadier birds haul a little extra.
    const branchRange = Array.isArray(template.branches) ? template.branches : [0, 0];
    const baseBranches = rand(seed + 7, branchRange[0], branchRange[1]);
    const branchBonus = baseBranches > 0 ? Math.floor(((bird.stamina || 40) + (bird.power || 80)) / 160) : 0;
    const item = template.items[seed % template.items.length];
    const bonusItem = template.items[(seed + 1) % template.items.length];
    const rewardItems = { [item]: 1 };
    // Charmers (high Personality) make friends out there and get gifts more often.
    const bonusRoll = (bird.cha || 0) >= 120 ? 2 : 3;
    if (seed % bonusRoll === 0) rewardItems[bonusItem] = (rewardItems[bonusItem] || 0) + 1;
    const clue = template.clueId ? MERLIN_CLUES[template.clueId] : null;
    return {
      id: `exp_${nowMs}_${String(bird.id || birdName).replace(/[^a-z0-9]+/gi,'_')}`,
      birdId: bird.id || null,
      birdName,
      templateId: template.id,
      label: template.label,
      icon: template.icon,
      startMs: nowMs,
      endMs,
      status: 'active',
      rewards: { coins: baseCoins + powerBonus + charmBonus, charmBonus, branches: baseBranches + branchBonus, xp: template.xp || (10 + Math.floor(template.minutes / 10)), items: rewardItems },
      story: clue ? { clueId: clue.id, title: clue.title, copy: clue.copy, unlocksTrial: clue.unlocksTrial } : null,
      seed
    };
  }

  function advanceBirdExpedition(expedition, nowMs=Date.now()) {
    const template = QUEST_TEMPLATES[expedition.templateId] || QUEST_TEMPLATES.short_forage;
    const total = Math.max(1, expedition.endMs - expedition.startMs);
    const elapsed = clamp(nowMs - expedition.startMs, 0, total);
    const progressPct = Math.round((elapsed / total) * 100);
    const status = progressPct >= 100 ? 'complete' : 'active';
    const visibleCount = clamp(Math.floor((progressPct / 100) * template.beats.length) + 1, 1, template.beats.length);
    const events = template.beats.slice(0, visibleCount).map((text, i) => ({
      atMs: expedition.startMs + Math.round((total / Math.max(1, template.beats.length - 1)) * i),
      text: `${expedition.birdName} ${text}.`
    }));
    return { ...expedition, status, progressPct, events };
  }

  return { getAcademyRooms, getQuestTemplates, getTrainingTemplates, getMerlinClues, createTrainingSession, advanceTrainingSession, createBirdExpedition, advanceBirdExpedition };
});
