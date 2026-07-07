(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurbzAcademyCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const TREEHOUSE_ROOMS = [
    { id:'outdoors', label:'Aviary Gardens', icon:'🌱', cost:0, unlockLevel:1, floor:0, branch:'trunk', x:50, y:92, role:'roam', effect:'Starter gardens: free roaming, foraging and happiness recovery.' },
    { id:'dorm', label:'The Roost', icon:'🏠', cost:50, unlockLevel:1, floor:1, branch:'left', x:24, y:78, role:'housing', effect:'Bird housing: rest, feed, groom and assign companions.' },
    { id:'training', label:'Training Hall', icon:'🏋️', cost:85, unlockLevel:2, floor:2, branch:'right', x:70, y:65, role:'training', effect:'Permanent stat drills and passive XP.' },
    { id:'hospital', label:'Bird Hospital', icon:'🏥', cost:140, unlockLevel:3, floor:3, branch:'left', x:26, y:53, role:'healing', effect:'Future: recovery care and status cures.' },
    { id:'crowbar', label:"The Crow's Perch", icon:'🐦‍⬛', cost:160, unlockLevel:4, floor:4, branch:'right', x:72, y:42, role:'social', effect:'The social roost: birds chat, swap rumours, befriend visitors and train their Personality here.' },
    { id:'kitchen', label:'Kitchen & Pantry', icon:'🥣', cost:130, unlockLevel:3, floor:3, branch:'trunk', x:50, y:52, role:'food', effect:'Cook species-friendly snacks and expand pantry.' },
    { id:'workshop', label:'Nest Workshop', icon:'🛠️', cost:180, unlockLevel:5, floor:5, branch:'left', x:25, y:31, role:'craft', effect:'Craft perches, gear, habitats and upgrades.' },
    { id:'market', label:'Recruitment Roost', icon:'🪶', cost:210, unlockLevel:6, floor:5, branch:'right', x:73, y:29, role:'recruit', effect:'Recruit discovered Birdex species for coins when you are ready.' },
    { id:'nursery', label:'Hatchery Nursery', icon:'🥚', cost:240, unlockLevel:7, floor:6, branch:'left', x:36, y:18, role:'bond', effect:'Baby-bird care and bonding progression.' },
    { id:'observatory', label:'Moon Observatory', icon:'🔭', cost:260, unlockLevel:8, floor:6, branch:'right', x:64, y:14, role:'forecast', effect:'Forecast spawns, migrations and night encounters.' },
    { id:'quest_roost', label:'Quest Roost', icon:'🧭', cost:110, unlockLevel:2, floor:2, branch:'trunk', x:50, y:66, role:'quests', effect:'Send birds out on real-time expeditions for coins and items.' }
  ];

  const QUEST_TEMPLATES = {
    find_seed: { id:'find_seed', label:'Find Seed', minutes:3, icon:'🌾', minLevel:1, starter:true, coins:[0,8], xp:6, items:['seed_satchel'], beats:['hops straight from the garden path','checks the soft grass for fallen seed','tucks a tiny seed satchel under one wing','returns ready for another quick errand'] },
    find_coins: { id:'find_coins', label:'Find Coins', minutes:4, icon:'🪙', minLevel:1, starter:true, coins:[8,22], xp:8, items:['shiny_pebble'], beats:['flutters toward a sunny lane','spots a glint beside an old root','trades a bright pebble for pocket coins','returns jingling with tiny treasure'] },
    scavenge: { id:'scavenge', label:'Scavenge', minutes:5, icon:'🧺', minLevel:1, starter:true, coins:[3,14], xp:10, items:['soft_moss','berry_bundle'], beats:['sets off on a quick cosy scavenge','checks mossy twigs and berry leaves','bundles useful bits for the Academy','returns with simple supplies'] },
    short_forage: { id:'short_forage', label:'Hedgerow Forage', minutes:60, icon:'🌿', minLevel:1, coins:[18,38], xp:25, items:['berry_bundle','shiny_pebble','soft_moss'], beats:['sets off beneath the safe branches','finds a singing hedgerow path','checks a glittering hollow','returns with a beakful of useful things'] },
    supply_run: { id:'supply_run', label:'Pantry Supply Run', minutes:120, icon:'🥣', minLevel:2, coins:[35,72], xp:55, items:['seed_satchel','worm_tin','berry_bundle'], beats:['sets off with a tiny satchel','trades gossip at a squirrel market','spots a cache of field snacks','returns to the tree with supplies'] },
    moon_scout: { id:'moon_scout', label:'Moonlit Scout', minutes:180, icon:'🌙', minLevel:4, coins:[70,130], xp:90, items:['moon_feather','old_map','shiny_pebble'], clueId:'moon_branch_map', beats:['sets off as the leaves glow silver','follows Merlin runes through the canopy','marks a safe route past the shadow woods','returns with a new clue for Bird Burbs'] },
    // Social quests — unlocked by building The Crow's Perch. They pay out
    // permanent Personality (PERS) growth on top of coins/XP, and a bird's
    // existing Personality boosts the coin haul (charm opens doors).
    befriend_stranger: { id:'befriend_stranger', label:'Befriend a Stranger', minutes:45, icon:'🤝', minLevel:1, social:true, coins:[10,24], xp:22, personality:1, items:['friendship_feather','berry_bundle'], beats:['spots a lonely bird preening on a far fence','offers a berry and a polite chirp','swaps hatching stories until the shyness melts','flies home with a brand-new friend waving goodbye'] },
    wing_natter: { id:'wing_natter', label:'Wing & Natter', minutes:90, icon:'💬', minLevel:2, social:true, coins:[18,40], xp:32, personality:1, items:['friendship_feather','shiny_pebble'], beats:['drops in on the hedgerow gossip circle','listens closely to a wise old wood pigeon','tells the tale of the Academy treehouse','chats until dusk and learns three new calls'] },
    flock_summit: { id:'flock_summit', label:'Flock Summit', minutes:180, icon:'🫂', minLevel:3, minPersonality:45, social:true, coins:[55,110], xp:85, personality:2, items:['friendship_feather','moon_feather'], beats:['is invited to the great mixed-flock summit','greets finches, gulls and corvids by name','smooths over a squabble about the best berry hedge','is cheered off home as the flock\'s favourite diplomat'] }
  };

  const TRAINING_TEMPLATES = {
    wing_sprints: { id:'wing_sprints', label:'Wing Training', minutes:120, icon:'🪽', room:'training', stat:'spd', statLabel:'SPD', xp:38, bonus:1, hunger:10, happiness:-2, copy:'A focused two-hour mobile session: quick to understand, long enough to check back later.', beats:['warms up on the lantern perch','runs short wing-burst laps','practises soft landings','finishes with brighter reactions'] },
    perch_strength: { id:'perch_strength', label:'Perch Strength', minutes:180, icon:'🪵', room:'training', stat:'atk', statLabel:'ATK', xp:58, bonus:1, hunger:14, happiness:-3, copy:'A three-hour mid-length drill, good for an afternoon check-in and clear stat growth.', beats:['tests balance on the training rail','pulls weighted seed pouches','works through safe target strikes','rests after a stronger session'] },
    focus_roost: { id:'focus_roost', label:'Focus Roost', minutes:300, icon:'🎯', room:'training', stat:'int', statLabel:'INT', xp:92, bonus:2, hunger:18, happiness:-4, copy:'A five-hour deeper training block for idle-game style progress while you are away.', beats:['studies target calls on the notice board','tracks moving feather markers','solves a tiny route puzzle','returns sharper and calmer'] },
    // Crow's Perch social sessions — the only timed way to grow Personality.
    perch_meet_greet: { id:'perch_meet_greet', label:'Meet & Greet', minutes:60, icon:'💬', room:'crowbar', stat:'personality', statLabel:'PERS', xp:26, bonus:1, hunger:6, happiness:5, copy:'An hour of introductions at The Crow\'s Perch: your bird practises greetings, small talk and reading the room.', beats:['hops onto the welcome perch','trades names with a visiting jackdaw','practises the polite three-chirp greeting','leaves the bar with a warmer, braver voice'] },
    perch_story_circle: { id:'perch_story_circle', label:'Story Circle', minutes:240, icon:'🏮', room:'crowbar', stat:'personality', statLabel:'PERS', xp:72, bonus:2, hunger:12, happiness:8, copy:'A four-hour lantern-lit story circle: telling tales to a full perch builds serious confidence and charm.', beats:['takes the storyteller\'s perch under the lantern','opens with the tale of the moonlit scout','holds the whole bar silent at the scary bit','gets a standing wing-ovation and three new friends'] }
  };

  const MERLIN_CLUES = {
    garden_gate_rune: {
      id: 'garden_gate_rune',
      title: "Merlin's Garden Gate Rune",
      copy: 'A silver rune points toward the first restored garden gate of Bird Burbs.',
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
  function getQuestTemplates() { return Object.values(QUEST_TEMPLATES).map(q => ({...q, items:[...q.items], beats:[...q.beats]})); }
  function getTrainingTemplates() { return Object.values(TRAINING_TEMPLATES).map(t => ({...t, beats:[...t.beats]})); }
  function getMerlinClues() { return Object.values(MERLIN_CLUES).map(c => ({...c})); }

  function createTrainingSession(bird, templateId='wing_sprints', nowMs=Date.now()) {
    const template = TRAINING_TEMPLATES[templateId] || TRAINING_TEMPLATES.wing_sprints;
    const birdName = bird.commonName || bird.species || 'A brave bird';
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
      startMs: nowMs,
      endMs: nowMs + durationMs,
      status: 'active',
      rewards: { xp: template.xp, stat: template.stat, statLabel: template.statLabel, bonus: template.bonus, hunger: template.hunger, happiness: template.happiness },
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
    const birdName = bird.commonName || bird.species || 'A brave bird';
    const seed = hashString(`${bird.id || birdName}|${template.id}|${nowMs}`);
    const durationMs = template.minutes * 60 * 1000;
    const endMs = nowMs + durationMs;
    const baseCoins = rand(seed, template.coins[0], template.coins[1]);
    // Social quests trade on charm: Personality drives the bonus haul instead
    // of raw power, so Crow's Perch regulars out-earn bruisers at befriending.
    const powerBonus = template.social
      ? Math.floor(((bird.personality || 30) * 2 + (bird.int || 40)) / 60)
      : Math.floor(((bird.power || 80) + (bird.int || 40) + (bird.spd || 40) + (bird.stamina || 40)) / 90);
    const item = template.items[seed % template.items.length];
    const bonusItem = template.items[(seed + 1) % template.items.length];
    const rewardItems = { [item]: 1 };
    if (seed % 3 === 0) rewardItems[bonusItem] = (rewardItems[bonusItem] || 0) + 1;
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
      rewards: { coins: baseCoins + powerBonus, xp: template.xp || (10 + Math.floor(template.minutes / 10)), items: rewardItems, personality: template.personality || 0 },
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
