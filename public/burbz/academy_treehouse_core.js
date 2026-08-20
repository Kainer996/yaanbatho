(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurbzAcademyCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  // Building costs are two-resource: coins (found on quests and discoveries)
  // and branches (the Academy's timber, gathered on quests). Branch costs rise
  // with the tree — higher floors need more timber hauled up.
  //
  // unlockLevel is the trainer-level gate, and the curve is a deliberate slow
  // burn rather than a sprint: the opening trio (Gardens, Roost, Barracks) is
  // open at level 1 for the tutorial, the teaching rooms then arrive one per
  // level through the early game, and the four specialist rooms (Workshop,
  // Library, Nursery, Observatory) are true mid-game milestones spaced out to
  // trainer level 12. Costs climb with the gates, so a newly unlocked room is
  // also a savings goal — there should always be a next building on the
  // horizon instead of the whole tree opening at once.
  // Default x/y sit each room on a painted bough of the 2026-08-06 tree
  // (assets/academy-tree-manga-20260806.webp). Player placements override
  // these, so retuning here only moves fresh or never-moved buildings.
  const TREEHOUSE_ROOMS = [
    { id:'outdoors', label:'Aviary Gardens', icon:'🌱', cost:0, branches:0, unlockLevel:1, floor:0, branch:'trunk', x:50, y:92, role:'roam', effect:'Starter gardens: free roaming, foraging and happiness recovery.' },
    { id:'dorm', label:'The Roost', icon:'🏠', cost:50, branches:10, unlockLevel:1, floor:1, branch:'left', x:22, y:68, role:'housing', effect:'Bird housing: rest, feed, groom and assign companions.' },
    { id:'tavern', label:'Barracks', icon:'🪶', cost:60, branches:8, unlockLevel:1, floor:1, branch:'right', x:80, y:71, role:'recruitment', effect:'The Academy recruitment office: review discovered and befriended birds, inspect their full cards, and invite them into the flock.' },
    { id:'training', label:'Training Hall', icon:'🏋️', cost:85, branches:20, unlockLevel:2, floor:2, branch:'right', x:75, y:58, role:'training', trainStat:'atk', effect:'Permanent stat drills, passive XP, and slow ATK growth for birds stationed here.' },
    { id:'hospital', label:'Bird Hospital', icon:'🏥', cost:140, branches:30, unlockLevel:5, floor:3, branch:'left', x:25, y:52, role:'healing', effect:'Fast HP recovery for tired or hurt companions stationed here.' },
    { id:'crowbar', label:'The Crowbar', icon:'🍻', cost:190, branches:40, unlockLevel:6, floor:4, branch:'right', x:75, y:41, role:'social', trainStat:'cha', effect:'The bird bar and the home of Kingdom diplomacy: companions perched here grow Charm (CHA) and morale — charm pays out on diplomacy quests.' },
    { id:'kitchen', label:'Kitchen & Pantry', icon:'🥣', cost:130, branches:25, unlockLevel:4, floor:3, branch:'trunk', x:50, y:55, role:'food', trainStat:'stamina', effect:'The feeding table: serve each companion the food it really eats, and run the Pantry Gauntlet to grow Stamina.' },
    { id:'workshop', label:'Nest Workshop', icon:'🛠️', cost:240, branches:55, unlockLevel:8, floor:5, branch:'left', x:29, y:30, role:'craft', trainStat:'def', effect:'Nest engineering: birds stationed here toughen up and grow DEF.' },
    { id:'library', label:'The Library', icon:'📚', cost:300, branches:70, unlockLevel:9, floor:5, branch:'right', x:74, y:26, role:'study', trainStat:'int', effect:'The Academy reading room: shelves of field guides and story scrolls. Birds stationed here sharpen their minds and grow INT.' },
    { id:'nursery', label:'Hatchery Nursery', icon:'🥚', cost:380, branches:85, unlockLevel:11, floor:6, branch:'left', x:35, y:16, role:'bond', effect:'Baby-bird care and bonding progression.' },
    { id:'observatory', label:'Moon Observatory', icon:'🔭', cost:450, branches:100, unlockLevel:12, floor:6, branch:'right', x:66, y:12, role:'forecast', trainStat:'int', effect:'Stargazing study: birds stationed here grow INT while charting spawns and migrations.' },
    { id:'quest_roost', label:'Quest Roost', icon:'🧭', cost:110, branches:15, unlockLevel:3, floor:2, branch:'trunk', x:49, y:71, role:'quests', effect:'Send birds out on real-time expeditions for coins, branches and items.' }
  ];

  // Quest economy: short starter errands teach the loop with small, frequent
  // payouts; long quests pay clearly better totals so timers feel worth it.
  // branches:[min,max] is the timber payout used for Academy building.
  // chaWeight marks social/diplomacy quests: a bird's Charm (cha) adds bonus
  // coins there — charmers talk squirrels, traders and passers-by into better
  // deals. Warriors haul the branches; robins and wrens win the negotiations.
  // The quest board is sorted into categories so a player looking for FOOD, or
  // for a specific crafting MATERIAL, can open one drawer instead of scrolling
  // the whole board. Order here is the order the drawers appear in.
  const QUEST_CATEGORIES = [
    { id:'food',      icon:'🍽️', label:'Food & Hunting',      copy:'Every food in the game has an errand that brings it home — seed, berries, worms, insects, fish, shore food and real prey for the birds of prey.' },
    { id:'materials', icon:'⛏️', label:'Materials & Salvage',  copy:'One errand per crafting material in the Kingdom, from windfall oak to a phoenix ember. This is how the Fletcher\'s Forge gets fed.' },
    { id:'timber',    icon:'🪵', label:'Timber & Building',    copy:'Branch and timber hauls for Academy floors, birdhouses and province building.' },
    { id:'treasure',  icon:'🪙', label:'Coin & Treasure',      copy:'Coin runs, keepsakes and the long moonlit flights that turn up Merlin\'s secrets.' },
    { id:'diplomacy', icon:'🕊️', label:'Diplomacy',            copy:'Charm errands. A robin or a wren wins these where a buzzard never could — CHA pays out here.' }
  ];
  const QUEST_CATEGORY_INDEX = Object.fromEntries(QUEST_CATEGORIES.map(c => [c.id, c]));

  // Every normal Kingdom errand offers the same seven timer choices, including
  // an eight-hour bedtime option. The reward curve rises sub-linearly: longer
  // flights pay much larger totals for players who are away, while repeating
  // quick flights remains the best reward per minute for attentive play (the
  // familiar mobile-simulation trade-off).
  const QUEST_DURATION_MINUTES = Object.freeze([5, 10, 30, 60, 120, 480, 1440]);
  function questDurationMultiplier(minutes) {
    return Math.pow(Math.max(5, Number(minutes) || 5) / 5, 0.9);
  }
  // Physical finds grow more gently than coins/XP because birds still have a
  // believable carrying limit; a day-long errand brings a useful bundle, not
  // hundreds of nominal items that would immediately be left behind.
  function questItemMultiplier(minutes) {
    return Math.pow(Math.max(5, Number(minutes) || 5) / 5, 0.45);
  }
  // Training runs work the same way: the player picks how long a drill
  // lasts, from a quarter hour to a full day. A longer run pays a bigger
  // total for a player who is away, but the payout grows slower than the
  // clock — many short runs always beat one long one, so attentive play
  // wins. Rewards are anchored to each template's classic duration, so a
  // run at that duration pays exactly what it always did.
  const TRAINING_DURATION_MINUTES = Object.freeze([15, 30, 60, 120, 240, 480, 1440]);
  function trainingXpMultiplier(minutes) {
    return Math.pow(Math.max(15, Number(minutes) || 15) / 15, 0.8);
  }
  // Permanent stat gains grow gentler still: a day of drills makes a bird
  // stronger, never a different bird.
  function trainingStatMultiplier(minutes) {
    return Math.pow(Math.max(15, Number(minutes) || 15) / 15, 0.6);
  }
  // Appetite follows effort, but slowly — a day of drills must never starve
  // a bird on its own.
  function trainingHungerMultiplier(minutes) {
    return Math.pow(Math.max(15, Number(minutes) || 15) / 15, 0.5);
  }
  function trainingRewardsForDuration(template, minutes) {
    const base = Math.max(15, Number(template && template.minutes) || 60);
    const selected = TRAINING_DURATION_MINUTES.includes(Number(minutes)) ? Number(minutes) : base;
    const ratio = trainingXpMultiplier(selected) / trainingXpMultiplier(base);
    const statRatio = trainingStatMultiplier(selected) / trainingStatMultiplier(base);
    const hungerRatio = trainingHungerMultiplier(selected) / trainingHungerMultiplier(base);
    const baseHunger = Number(template && template.hunger) || 0;
    const hunger = baseHunger === 0 ? 0
      : baseHunger > 0 ? Math.max(1, Math.round(baseHunger * hungerRatio))
      : -Math.max(1, Math.round(-baseHunger * hungerRatio));
    return {
      minutes: selected,
      xp: Math.max(1, Math.round((Number(template && template.xp) || 1) * ratio)),
      bonus: Math.max(1, Math.round((Number(template && template.bonus) || 1) * statRatio)),
      hunger,
      happiness: Number(template && template.happiness) || 0
    };
  }
  function getTrainingDurationOptions(templateId) {
    const template = TRAINING_TEMPLATES[templateId];
    if (!template) return [];
    return TRAINING_DURATION_MINUTES.map(m => ({ ...trainingRewardsForDuration(template, m) }));
  }

  function scaledQuestRange(range, ratio) {
    const source = Array.isArray(range) ? range : [0, 0];
    const scale = Math.max(0, Number(ratio) || 0);
    const low = source[0] > 0 ? Math.max(0, Math.round(source[0] * scale)) : 0;
    const high = source[1] > 0 ? Math.max(1, Math.round(source[1] * scale)) : 0;
    return [Math.min(low, high), Math.max(low, high)];
  }
  function questRewardsForDuration(template, minutes) {
    const selectedMinutes = QUEST_DURATION_MINUTES.includes(Number(minutes)) ? Number(minutes) : Math.max(5, Number(template && template.minutes) || 5);
    const baseMultiplier = questDurationMultiplier(template && template.minutes);
    const ratio = questDurationMultiplier(selectedMinutes) / Math.max(0.0001, baseMultiplier);
    const physicalRatio = questItemMultiplier(selectedMinutes) / Math.max(0.0001, questItemMultiplier(template && template.minutes));
    return {
      minutes: selectedMinutes,
      ratio,
      physicalRatio,
      coins: scaledQuestRange(template && template.coins, ratio),
      branches: scaledQuestRange(template && template.branches, physicalRatio),
      xp: Math.max(1, Math.round((Number(template && template.xp) || 1) * ratio)),
      expectedItemRolls: physicalRatio
    };
  }

  const QUEST_TEMPLATES = {
    // Merlin's First Flight: the one-off tutorial errand. It lasts seconds,
    // not minutes, so a brand-new player sees the whole send → return → claim
    // loop without waiting, and it always brings home a crafting material so
    // Merlin can tease the Forge. tutorial:true keeps it off the normal board
    // drawers — the quest screen renders it as its own one-off card.
    merlin_first_flight: { id:'merlin_first_flight', category:'treasure', label:"Merlin's First Flight", minutes:5/60, icon:'🪄', minLevel:1, starter:true, tutorial:true, coins:[4,8], branches:[1,2], xp:8, items:['oak_twig','river_reed','iron_grit','down_tuft'], beats:['leaps from your shoulder in a shower of sparks','loops the garden once at wizard speed','snatches something useful from a hollow stump','is back before the kettle sings'] },
    find_seed: { id:'find_seed', category:'food', label:'Find Seed', minutes:3, icon:'🌾', minLevel:1, starter:true, coins:[0,7], branches:[1,2], xp:6, items:['seed_satchel','sunflower_seeds'], beats:['hops straight from the garden path','checks the soft grass for fallen seed','tucks a tiny seed satchel under one wing','returns ready for another quick errand'] },
    find_coins: { id:'find_coins', category:'treasure', label:'Find Coins', minutes:4, icon:'🪙', minLevel:1, chaWeight:1, starter:true, coins:[6,16], branches:[0,1], xp:8, items:['shiny_pebble'], beats:['flutters toward a sunny lane','spots a glint beside an old root','trades a bright pebble for pocket coins','returns jingling with tiny treasure'] },
    branch_run: { id:'branch_run', category:'timber', label:'Branch Run', minutes:5, icon:'🪵', minLevel:1, starter:true, coins:[0,5], branches:[4,7], xp:8, items:['soft_moss'], beats:['glides down to the windfall thicket','tugs loose the driest fallen twigs','stacks a neat bundle of branches','hauls the timber home for the builders'] },
    scavenge: { id:'scavenge', category:'materials', label:'Scavenge', minutes:5, icon:'🧺', minLevel:1, starter:true, coins:[2,10], branches:[2,4], xp:10, items:['soft_moss','berry_bundle'], beats:['sets off on a quick cosy scavenge','checks mossy twigs and berry leaves','bundles useful bits for the Academy','returns with simple supplies'] },
    // --- Hunting errands: where MEAT comes from. Every bird of prey in the
    // Academy needs prey, so these are starter quests (no Quest Roost, no
    // level gate) and each one brings back the animals that raptor group
    // really hunts: voles and mice for owls and kestrels, rabbits for
    // buzzards and eagles, bird rations for the bird-hunting falcons and
    // hawks, carrion for kites, ravens and vultures, frogs and lizards for
    // herons, little owls and the reptile hunters.
    meadow_hunt: { id:'meadow_hunt', category:'food', label:'Vole Meadow Hunt', minutes:4, icon:'🐭', minLevel:1, starter:true, coins:[0,6], branches:[0,1], xp:8, items:['field_vole','field_vole','wood_mouse','common_shrew'], beats:['quarters the rough grass on stiff wings','hangs still in the wind above a vole run','drops into the tussocks — and holds something','carries the catch home for the cold larder'] },
    warren_watch: { id:'warren_watch', category:'food', label:'Warren Watch', minutes:6, icon:'🐇', minLevel:1, starter:true, coins:[2,9], branches:[0,2], xp:12, items:['young_rabbit','wood_mouse','field_vole'], beats:['takes a fence post above the warren','waits out the long grey afternoon','stoops the moment a young rabbit strays','hauls the heaviest prey of the day home'] },
    ration_run: { id:'ration_run', category:'food', label:'Falconry Ration Run', minutes:5, icon:'🪶', minLevel:1, starter:true, coins:[0,7], branches:[0,1], xp:10, items:['small_bird_prey_ration','small_bird_prey_ration','starling_prey_ration','pigeon_prey_ration'], beats:['flies down to the old falconry mews','waits while the keeper packs the day\'s rations','tucks the prepared prey parcels under one wing','returns with proper food for the bird-hunters'] },
    carrion_round: { id:'carrion_round', category:'food', label:'Carrion Round', minutes:5, icon:'🦴', minLevel:1, starter:true, coins:[3,12], branches:[0,1], xp:10, items:['carrion_scraps','carrion_scraps','deer_carrion','marrow_bone'], beats:['rides the morning thermals over the hill road','circles once where the crows are already gathered','waits its turn, then takes the best of what is left','brings the scavengers\' share back to the stores'] },
    marsh_hunt: { id:'marsh_hunt', category:'food', label:'Marsh & Ditch Hunt', minutes:5, icon:'🐸', minLevel:1, starter:true, coins:[1,8], branches:[0,2], xp:10, items:['common_frog','common_lizard','dragonfly_swarm','wasp_grub_comb'], beats:['picks a slow way along the flooded ditch','freezes over a shivering patch of water','takes a frog, then a basking lizard on the bank','comes home damp, muddy and well fed'] },
    // --- Plant, insect and shore errands: where every NON-prey food comes
    // from. Between these and the hunting quests above, every single
    // ingredient in the game has at least one quest that brings it home, so
    // no companion can ever be stranded with nothing it will eat. All are
    // starter quests for the same reason the hunts are: food is not a luxury.
    berry_run: { id:'berry_run', category:'food', label:'Berry Picking', minutes:4, icon:'🫐', minLevel:1, starter:true, coins:[0,6], branches:[0,1], xp:8, items:['hedgerow_berries','hedgerow_berries','windfall_apple'], beats:['drops into the loaded hedge','works along the rowan and the bramble','fills its crop with ripe berries','carries a beakful home for the larder'] },
    orchard_round: { id:'orchard_round', category:'food', label:'Orchard Windfall', minutes:6, icon:'🍎', minLevel:1, starter:true, coins:[1,8], branches:[0,2], xp:10, items:['windfall_apple','windfall_apple','hedgerow_berries'], beats:['glides down the old orchard rows','turns the frost-softened windfalls over','sees off a bad-tempered blackbird','brings back sweet fruit for the thrushes'] },
    worm_dig: { id:'worm_dig', category:'food', label:'Wormcast Dig', minutes:4, icon:'🪱', minLevel:1, starter:true, coins:[0,5], branches:[0,1], xp:8, items:['garden_worms','garden_worms','mealworm_scoop'], beats:['runs and stops across the wet lawn','cocks its head to listen underground','pulls a long worm out of the cast','stocks the larder for the ground-feeders'] },
    mast_gather: { id:'mast_gather', category:'food', label:'Acorn & Mast Gather', minutes:6, icon:'🌰', minLevel:1, starter:true, coins:[1,9], branches:[1,3], xp:11, items:['acorn_handful','acorn_handful','sunflower_seeds','gizzard_grit'], beats:['works the oak canopy for good mast','tests each acorn for weight','picks up gizzard grit from the track','flies home heavy with autumn stores'] },
    midge_chase: { id:'midge_chase', category:'food', label:'Midge Swarm Chase', minutes:3, icon:'🦟', minLevel:1, starter:true, coins:[0,5], branches:[0,1], xp:8, items:['aerial_midges','aerial_midges','dragonfly_swarm'], beats:['climbs into the warm evening air','finds a column of midges over the pond','feeds on the wing without landing once','brings a netted cloud back for the aerial feeders'] },
    bark_grub_round: { id:'bark_grub_round', category:'food', label:'Bark & Grub Round', minutes:5, icon:'🐛', minLevel:1, starter:true, coins:[0,7], branches:[1,2], xp:10, items:['mealworm_scoop','suet_cake','wasp_grub_comb'], beats:['works up the trunk in short hops','chisels a grub out of soft bark','raids a fat cake left on a garden log','returns with insect food for the small birds'] },
    shore_scavenge: { id:'shore_scavenge', category:'food', label:'Shoreline Scavenge', minutes:6, icon:'🐚', minLevel:1, starter:true, coins:[2,10], branches:[0,1], xp:11, items:['shore_snail_mix','shore_snail_mix','sand_eel'], beats:['walks the tideline as the water drops','probes the wet sand for shellfish','cracks a snail open on a flat stone','carries shore food back for the waders'] },
    sandeel_run: { id:'sandeel_run', category:'food', label:'Sand Eel Run', minutes:7, icon:'🐠', minLevel:1, starter:true, coins:[3,12], branches:[0,1], xp:13, items:['sand_eel','sand_eel','live_minnow'], beats:['heads out over the open water','hangs above a boiling shoal','dives, and comes up with a silver eel','flies home with the catch held crosswise'] },
    nectar_round: { id:'nectar_round', category:'food', label:'Blossom Nectar Round', minutes:4, icon:'🌺', minLevel:1, starter:true, coins:[1,7], branches:[0,1], xp:9, items:['nectar_cup','nectar_cup','aerial_midges'], beats:['follows the blossom line down the valley','works each flower with a brush tongue','picks off small insects between sips','returns with nectar for the blossom feeders'] },
    pond_graze: { id:'pond_graze', category:'food', label:'Dabbling Pond Graze', minutes:5, icon:'🦆', minLevel:1, starter:true, coins:[1,8], branches:[0,2], xp:10, items:['pondweed_tangle','pondweed_tangle','shore_snail_mix'], beats:['paddles out to the quiet weedy end','up-ends to reach the pondweed below','sieves the surface for small shells','brings green food back for the dabblers'] },
    short_forage: { id:'short_forage', category:'materials', label:'Hedgerow Forage', minutes:60, icon:'🌿', minLevel:1, chaWeight:0.5, coins:[22,44], branches:[5,10], xp:25, items:['berry_bundle','shiny_pebble','soft_moss'], beats:['sets off beneath the safe branches','finds a singing hedgerow path','checks a glittering hollow','returns with a beakful of useful things'] },
    supply_run: { id:'supply_run', category:'food', label:'Pantry Supply Run', minutes:120, icon:'🥣', minLevel:2, chaWeight:1.5, coins:[50,95], branches:[8,14], xp:55, items:['seed_satchel','worm_tin','berry_bundle','xp_scroll_minor'], beats:['sets off with a tiny satchel','trades gossip at a squirrel market','spots a cache of field snacks','returns to the tree with supplies'] },
    // Fish is prey too: ospreys, herons and kingfishers starve without it, so
    // the fishing trip is unlocked from the start alongside the other hunts.
    fishing_trip: { id:'fishing_trip', category:'food', label:'Fishing Trip', minutes:45, icon:'🎣', minLevel:1, starter:true, coins:[10,26], branches:[0,2], xp:30, items:['live_minnow','live_minnow','river_trout','pondweed_tangle'], beats:['follows the stream down to the shallows','stands statue-still over a glittering pool','strikes — and comes up with a wriggling catch','carries the catch home fresh for the Kitchen larder'] },
    timber_haul: { id:'timber_haul', category:'timber', label:'Timber Haul', minutes:150, icon:'🌳', minLevel:3, coins:[20,45], branches:[22,38], xp:75, items:['soft_moss','old_map','xp_scroll_minor'], beats:['flies out to the storm-fall clearing','marks the straightest fallen boughs','ropes a heavy bundle with vine loops','hauls the timber back for the high floors'] },
    moon_scout: { id:'moon_scout', category:'treasure', label:'Moonlit Scout', minutes:180, icon:'🌙', minLevel:4, chaWeight:0.75, coins:[95,170], branches:[10,18], xp:90, items:['moon_feather','old_map','shiny_pebble','xp_scroll_greater'], clueId:'moon_branch_map', beats:['sets off as the leaves glow silver','follows Merlin runes through the canopy','marks a safe route past the shadow woods','returns with a new clue for the Kingdom of Burbz'] },
    envoy_parley: { id:'envoy_parley', category:'diplomacy', label:'Diplomacy Envoy', minutes:90, icon:'🕊️', minLevel:2, chaWeight:2.5, coins:[28,62], branches:[2,5], xp:45, items:['shiny_pebble','berry_bundle','xp_scroll_minor'], beats:['flies out under a truce-feather banner','charms a wary border flock at the parley stone','talks a bitter squabble down to shared seed','returns with goodwill gifts for the Academy'] },
    // --- Materials errands: one per crafting material in the Kingdom --------
    // Before these, the only way to a Phoenix Ember was to hope one fell out
    // of a chest. Now every single material in loot_crafting_core.MATERIALS
    // has a named quest that goes out and fetches it, and the errand's length
    // tracks the material's rarity: the four common materials are starter
    // errands measured in minutes, an Ancient Rune is an afternoon, and a
    // Phoenix Ember is a day's vigil.
    oak_gather: { id:'oak_gather', category:'materials', material:'oak_twig', label:'Windfall Oak Gather', minutes:5, icon:'🪵', minLevel:1, starter:true, coins:[0,5], branches:[2,4], xp:8, items:['oak_twig','oak_twig','soft_moss'], beats:['drops into the windfall wood after a gale','tests each fallen branch for a clean grain','saws two good hafts free with its bill','flies the timber back to the Forge yard'] },
    reed_cutting: { id:'reed_cutting', category:'materials', material:'river_reed', label:'Reedbed Cutting', minutes:6, icon:'🌾', minLevel:1, starter:true, coins:[0,6], branches:[1,2], xp:9, items:['river_reed','river_reed','soft_moss'], beats:['wades out into the whispering reedbed','picks the long supple stems the fletchers want','binds a bundle with a twist of sedge','carries the reed home over the water'] },
    grit_sift: { id:'grit_sift', category:'materials', material:'iron_grit', label:'Gizzard-Stone Sift', minutes:7, icon:'⚙️', minLevel:1, starter:true, coins:[1,6], branches:[0,1], xp:10, items:['iron_grit','iron_grit','gizzard_grit'], beats:['works the gravel bar where the river bends','sifts the shingle for iron-heavy stones','grinds a pinch fine on the anvil rock','brings edge-grit back for the smith'] },
    down_collection: { id:'down_collection', category:'materials', material:'down_tuft', label:'Down Tuft Collection', minutes:5, icon:'🪶', minLevel:1, starter:true, coins:[0,5], branches:[0,1], xp:8, items:['down_tuft','down_tuft','soft_moss'], beats:['tours the old nests along the hedge line','lifts warm underdown from an empty cup','packs the tufts loose so they stay soft','returns with padding for the armourers'] },
    moondust_sweep: { id:'moondust_sweep', category:'materials', material:'moon_dust', label:'Moon Dust Sweep', minutes:40, icon:'🌙', minLevel:2, coins:[14,30], branches:[0,2], xp:22, items:['moon_dust','moon_dust','shiny_pebble'], beats:['climbs to the Observatory lens gallery','waits for the glimmer to settle after moonrise','sweeps the silvered dust into a folded leaf','glides home before the shine fades'] },
    stormglass_hunt: { id:'stormglass_hunt', category:'materials', material:'storm_glass', label:'Storm Glass Hunt', minutes:50, icon:'🌩️', minLevel:2, coins:[16,34], branches:[0,2], xp:26, items:['storm_glass','storm_glass','shiny_pebble'], beats:['follows the storm front out onto the dunes','searches the sand where the lightning struck','prises a humming shard of fused glass loose','beats the next squall home'] },
    amber_dig: { id:'amber_dig', category:'materials', material:'sun_amber', label:'Sun Amber Dig', minutes:120, icon:'🟠', minLevel:3, coins:[40,80], branches:[2,5], xp:55, items:['sun_amber','sun_amber','moon_dust'], beats:['works the old resin bank under the pines','digs down through root and needle litter','lifts a drop of trapped sunlight clear','carries the amber home in both feet'] },
    goldthread_spin: { id:'goldthread_spin', category:'materials', material:'gold_thread', label:'Gold Thread Errand', minutes:135, icon:'🧵', minLevel:3, chaWeight:1, coins:[45,90], branches:[0,3], xp:60, items:['gold_thread','gold_thread','shiny_pebble'], beats:['calls at the magpie hoard with a polite bow','haggles patiently over the brightest filament','watches it spun into a length of gold thread','flies back with the spool tucked under a wing'] },
    rune_search: { id:'rune_search', category:'materials', material:'ancient_rune', label:'Ancient Rune Search', minutes:240, icon:'🪬', minLevel:5, coins:[90,160], branches:[3,8], xp:100, items:['ancient_rune','old_map','moon_feather'], beats:['sets out for the fallen halls of the old kingdom','reads feather-marks worn almost smooth','works one etched sliver free of the stone','returns with the old magic still humming'] },
    ember_vigil: { id:'ember_vigil', category:'materials', material:'phoenix_ember', label:'Phoenix Ember Vigil', minutes:420, icon:'🔥', minLevel:7, coins:[160,280], branches:[4,10], xp:165, items:['phoenix_ember','ancient_rune','xp_scroll_greater'], beats:['flies a day and a night to the ember ridge','keeps the long vigil where the firebird nested','takes up an ember that will never cool','carries the impossible thing home'] }
  };

  // Six battle disciplines, one per Academy room. Each claimed session raises
  // the stat AND counts toward that discipline's battle-move tier
  // (1 session = move I, 3 = move II, 6 = move III — see battle_core.js).
  const TRAINING_TEMPLATES = {
    wing_sprints: { id:'wing_sprints', label:'Wing Sprints', minutes:120, icon:'🪽', stat:'spd', statLabel:'SPD', school:'aero', moveLine:'Quick Dart → Wind Slash → Sonic Dive', room:'training', roomLabel:'Training Hall', xp:38, bonus:1, hunger:10, happiness:-2, copy:'Two-hour agility drills. Teaches AERO battle moves — fast strikes that always go first.', beats:['warms up on the lantern perch','runs short wing-burst laps','practises soft landings','finishes with brighter reactions'] },
    perch_strength: { id:'perch_strength', label:'Perch Strength', minutes:180, icon:'⚔️', stat:'atk', statLabel:'ATK', school:'strike', moveLine:'Talon Jab → Power Strike → Tempest Talons', room:'training', roomLabel:'Training Hall', xp:58, bonus:1, hunger:14, happiness:-3, copy:'Three-hour power work. Teaches STRIKE battle moves — the heaviest raw damage.', beats:['tests balance on the training rail','pulls weighted seed pouches','works through safe target strikes','rests after a stronger session'] },
    guard_drills: { id:'guard_drills', label:'Guard Drills', minutes:150, icon:'🛡️', stat:'def', statLabel:'DEF', school:'guard', moveLine:'Feather Guard → Nest Wall → Iron Plumage', room:'workshop', roomLabel:'Nest Workshop', xp:48, bonus:1, hunger:12, happiness:-2, copy:'Nest-engineering toughness work. Teaches GUARD battle moves — shields that soak damage.', beats:['weaves a practice nest wall','holds steady against gusty bellows','learns to tuck and brace','emerges with sturdier plumage'] },
    focus_roost: { id:'focus_roost', label:'Focus Roost', minutes:300, icon:'🧠', stat:'int', statLabel:'INT', school:'mind', moveLine:'Sharp Eyes → Outsmart → Master Plan', room:'observatory', roomLabel:'Moon Observatory', xp:92, bonus:2, hunger:18, happiness:-4, copy:'Five-hour stargazing study. Teaches MIND battle moves — clever attacks that expose weak points.', beats:['studies target calls on the notice board','tracks moving feather markers','solves a tiny route puzzle','returns sharper and calmer'] },
    // The Library's gentler road to a sharper bird: shorter than the Focus
    // Roost, kind to morale, same MIND school so its sessions count toward the
    // same move line.
    quiet_study: { id:'quiet_study', label:'Quiet Study', minutes:150, icon:'📚', stat:'int', statLabel:'INT', school:'mind', moveLine:'Sharp Eyes → Outsmart → Master Plan', room:'library', roomLabel:'The Library', xp:50, bonus:1, hunger:8, happiness:2, copy:'A reading circle in the Library stacks. Grows INT and teaches MIND battle moves at a cosier pace.', beats:['picks a field guide from the low shelf','sounds out the long words about itself','solves the riddle on the last page','returns wiser and quietly smug'] },
    song_circle: { id:'song_circle', label:'Song Circle', minutes:90, icon:'🎵', stat:'cha', statLabel:'CHA', school:'song', moveLine:'Rally Chirp → Morale Anthem → Dawn Chorus', room:'crowbar', roomLabel:'The Crowbar', xp:32, bonus:1, hunger:8, happiness:3, copy:'A merry session at the bird bar. Grows Charm and teaches SONG battle moves — anthems that rally the whole team.', beats:['takes the open-mic perch at The Crowbar','trades verses with the regulars','leads a rousing chorus','flies home with new confidence'] },
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
  function getQuestTemplates() { return Object.values(QUEST_TEMPLATES).map(q => ({...q, category:q.category || 'treasure', items:[...q.items], beats:[...q.beats], branches:Array.isArray(q.branches) ? [...q.branches] : [0,0]})); }
  function getQuestDurationOptions(templateId) {
    const template = QUEST_TEMPLATES[templateId];
    if (!template || template.tutorial === true) return [];
    return QUEST_DURATION_MINUTES.map(minutes => ({ ...questRewardsForDuration(template, minutes) }));
  }
  function getQuestCategories() { return QUEST_CATEGORIES.map(c => ({...c})); }
  function questCategory(id) { const c = QUEST_CATEGORY_INDEX[id]; return c ? {...c} : null; }
  function getTrainingTemplates() { return Object.values(TRAINING_TEMPLATES).map(t => ({...t, beats:[...t.beats]})); }
  function getMerlinClues() { return Object.values(MERLIN_CLUES).map(c => ({...c})); }

  // options.nightBonus is the Night Hunter pack (bird_sleep_core's
  // NOCTURNAL_NIGHT_BONUS): the caller decides whether it applies — it knows
  // the bird and the local clock — and this core only does the maths, so the
  // reward pipeline stays deterministic and Node-testable.
  function nightBonusPack(options) {
    const pack = options && options.nightBonus;
    return pack && typeof pack === 'object' ? pack : null;
  }
  function nightMultiplier(pack, key) {
    return pack ? Math.max(1, Number(pack[key]) || 1) : 1;
  }

  function createTrainingSession(bird, templateId='wing_sprints', nowMs=Date.now(), options={}) {
    const template = TRAINING_TEMPLATES[templateId] || TRAINING_TEMPLATES.wing_sprints;
    const birdName = String(bird.customName || '').trim() || bird.commonName || bird.species || 'A brave bird';
    // The player picks the run length from the catalogue; anything else —
    // legacy callers, arbitrary numbers — falls back to the classic timer
    // with the classic payout.
    const economy = trainingRewardsForDuration(template, Number(options && options.durationMinutes));
    const durationMs = economy.minutes * 60 * 1000;
    const night = nightBonusPack(options);
    const xp = Math.round(economy.xp * nightMultiplier(night, 'xp'));
    // Night Hunters learn twice as much from every drill: the pack's statBonus
    // multiplies the permanent stat gain, not just the XP. Packs without a
    // statBonus (older saves mid-session) fall back to the plain gain.
    const statGain = Math.max(1, Math.round(economy.bonus * nightMultiplier(night, 'statBonus')));
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
      durationMinutes: economy.minutes,
      startMs: nowMs,
      endMs: nowMs + durationMs,
      status: 'active',
      nightBonus: !!night,
      rewards: { xp, stat: template.stat, statLabel: template.statLabel, bonus: statGain, hunger: economy.hunger, happiness: economy.happiness, school: template.school || null },
      seed: hashString(`${bird.id || birdName}|${template.id}|${nowMs}`)
    };
  }

  function advanceTrainingSession(session, nowMs=Date.now()) {
    const template = TRAINING_TEMPLATES[session.templateId] || TRAINING_TEMPLATES.wing_sprints;
    const total = Math.max(1, session.endMs - session.startMs);
    const elapsed = clamp(nowMs - session.startMs, 0, total);
    const progressPct = Math.round((elapsed / total) * 100);
    // Progress refreshes must never resurrect a session after its reward has
    // been claimed (or after another terminal outcome).
    const status = ['claimed', 'cancelled', 'failed'].includes(session.status)
      ? session.status
      : (progressPct >= 100 ? 'complete' : 'active');
    const visibleCount = clamp(Math.floor((progressPct / 100) * template.beats.length) + 1, 1, template.beats.length);
    const events = template.beats.slice(0, visibleCount).map((text, i) => ({
      atMs: session.startMs + Math.round((total / Math.max(1, template.beats.length - 1)) * i),
      text: `${session.birdName} ${text}.`
    }));
    return { ...session, status, progressPct, events, templateCopy: template.copy };
  }

  // options.slowFactor stretches the timer without touching the payout. It is
  // how a hungry Merlin still flies: the Kingdom cannot deadlock on an empty
  // larder, so he works on regardless — it just takes him twice as long.
  // options.nightBonus (the Night Hunter pack) multiplies the payout instead.
  function createBirdExpedition(bird, templateId='short_forage', nowMs=Date.now(), options={}) {
    const template = QUEST_TEMPLATES[templateId] || QUEST_TEMPLATES.short_forage;
    const birdName = String(bird.customName || '').trim() || bird.commonName || bird.species || 'A brave bird';
    const seed = hashString(`${bird.id || birdName}|${template.id}|${nowMs}`);
    const slowFactor = Math.max(1, Number(options && options.slowFactor) || 1);
    // Tutorial/legacy calls keep their authored timer. Normal UI dispatches may
    // only use one of the six catalogued choices; caller-authored arbitrary
    // timers and rewards are deliberately ignored.
    const requestedDuration = Number(options && options.durationMinutes);
    const durationMinutes = template.tutorial !== true && QUEST_DURATION_MINUTES.includes(requestedDuration)
      ? requestedDuration
      : template.minutes;
    const economy = template.tutorial === true
      ? { ratio:1, physicalRatio:1, coins:[...template.coins], branches:Array.isArray(template.branches) ? [...template.branches] : [0,0], xp:template.xp || 1, expectedItemRolls:1 }
      : questRewardsForDuration(template, durationMinutes);
    const durationMs = Math.round(durationMinutes * 60 * 1000 * slowFactor);
    const endMs = nowMs + durationMs;
    const baseCoins = rand(seed, economy.coins[0], economy.coins[1]);
    const powerBonus = Math.max(0, Math.round(Math.floor(((bird.power || 80) + (bird.int || 40) + (bird.spd || 40) + (bird.stamina || 40)) / 90) * economy.ratio));
    // Charm pays on social and diplomacy quests: charming birds haggle better prices.
    const charmBonus = template.chaWeight ? Math.max(0, Math.round(Math.floor(((bird.cha || 40) * template.chaWeight) / 60) * economy.ratio)) : 0;
    // Branch (timber) payout: stronger, steadier birds haul a little extra.
    const branchRange = economy.branches;
    const baseBranches = rand(seed + 7, branchRange[0], branchRange[1]);
    const branchBonus = baseBranches > 0 ? Math.max(0, Math.round(Math.floor(((bird.stamina || 40) + (bird.power || 80)) / 160) * economy.physicalRatio)) : 0;
    // Item loot scales as expected rolls, including a deterministic fractional
    // chance at short tiers and multiple finds on long tiers.
    const expectedItemRolls = Math.max(0, Number(economy.expectedItemRolls) || 0);
    let itemRolls = Math.floor(expectedItemRolls);
    const fractionalRoll = expectedItemRolls - itemRolls;
    if (((seed + 19) % 10000) / 10000 < fractionalRoll) itemRolls += 1;
    const rewardItems = {};
    for (let i = 0; i < itemRolls; i++) {
      const item = template.items[(seed + i) % template.items.length];
      rewardItems[item] = (rewardItems[item] || 0) + 1;
    }
    // Charmers (high Charm) make friends out there and get one extra gift often.
    const bonusRoll = (bird.cha || 0) >= 120 ? 2 : 3;
    if (itemRolls > 0 && seed % bonusRoll === 0) {
      const bonusItem = template.items[(seed + itemRolls) % template.items.length];
      rewardItems[bonusItem] = (rewardItems[bonusItem] || 0) + 1;
      itemRolls += 1;
    }
    // Night Hunters see what daytime birds miss: guaranteed extra finds on top
    // of whatever the ordinary rolls turned up.
    const night = nightBonusPack(options);
    const nightFinds = night ? Math.max(0, Math.round(Number(night.itemRolls) || 0)) : 0;
    for (let i = 0; i < nightFinds; i++) {
      const nightItem = template.items[(seed + itemRolls + i) % template.items.length];
      rewardItems[nightItem] = (rewardItems[nightItem] || 0) + 1;
    }
    itemRolls += nightFinds;
    // Story clues remain proper discoveries rather than five-minute spam: the
    // selected flight must be at least as substantial as the authored quest.
    const clue = template.clueId && durationMinutes >= template.minutes ? MERLIN_CLUES[template.clueId] : null;
    return {
      id: `exp_${nowMs}_${String(bird.id || birdName).replace(/[^a-z0-9]+/gi,'_')}`,
      birdId: bird.id || null,
      birdName,
      templateId: template.id,
      label: template.label,
      icon: template.icon,
      startMs: nowMs,
      endMs,
      durationMinutes,
      status: 'active',
      slowFactor,
      hungryFlight: slowFactor > 1,
      nightBonus: night ? { coins: nightMultiplier(night, 'coins'), branches: nightMultiplier(night, 'branches'), xp: nightMultiplier(night, 'xp'), itemRolls: nightFinds } : null,
      rewards: {
        coins: Math.round((baseCoins + powerBonus + charmBonus) * nightMultiplier(night, 'coins')),
        charmBonus,
        branches: Math.round((baseBranches + branchBonus) * nightMultiplier(night, 'branches')),
        xp: Math.round(economy.xp * nightMultiplier(night, 'xp')),
        items: rewardItems,
        itemRolls
      },
      story: clue ? { clueId: clue.id, title: clue.title, copy: clue.copy, unlocksTrial: clue.unlocksTrial } : null,
      seed
    };
  }

  function advanceBirdExpedition(expedition, nowMs=Date.now()) {
    const template = QUEST_TEMPLATES[expedition.templateId] || QUEST_TEMPLATES.short_forage;
    const total = Math.max(1, expedition.endMs - expedition.startMs);
    const elapsed = clamp(nowMs - expedition.startMs, 0, total);
    const progressPct = Math.round((elapsed / total) * 100);
    const status = ['claimed', 'cancelled', 'failed'].includes(expedition.status)
      ? expedition.status
      : (progressPct >= 100 ? 'complete' : 'active');
    const visibleCount = clamp(Math.floor((progressPct / 100) * template.beats.length) + 1, 1, template.beats.length);
    const events = template.beats.slice(0, visibleCount).map((text, i) => ({
      atMs: expedition.startMs + Math.round((total / Math.max(1, template.beats.length - 1)) * i),
      text: `${expedition.birdName} ${text}.`
    }));
    return { ...expedition, status, progressPct, events };
  }

  return { QUEST_DURATION_MINUTES, questDurationMultiplier, getQuestDurationOptions, TRAINING_DURATION_MINUTES, trainingXpMultiplier, trainingStatMultiplier, trainingRewardsForDuration, getTrainingDurationOptions, getAcademyRooms, getQuestTemplates, getQuestCategories, questCategory, getTrainingTemplates, getMerlinClues, createTrainingSession, advanceTrainingSession, createBirdExpedition, advanceBirdExpedition };
});
