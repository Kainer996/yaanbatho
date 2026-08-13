/* Kitchen & Pantry meal-prep core. Ingredients map onto the game's real diet
   families (FOODS keys), and meal scoring is a knowledge puzzle, not a
   reflex game: the right family served the way the species really takes it
   in the wild scores best, and every verdict teaches the underlying fact. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  if (root) root.BurbzKitchenCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // Preparation styles — each one mirrors a real feeding behaviour.
  const PREPS = {
    whole:    { id:'whole',    label:'Whole prey ration',       icon:'🪶', desc:'Prepared whole as a tasteful prey ration for falcons and other specialists.' },
    // "Live" covers a minnow in the tank and a vole in the grass alike — the
    // old water-tank wording only ever made sense for fish.
    live:     { id:'live',     label:'Live prey',                icon:'🫧', desc:'Kept alive and moving. Specialist hunters only strike living prey.' },
    fresh:    { id:'fresh',    label:'Fresh & whole',            icon:'🍃', desc:'Served just as nature drops it.' },
    cracked:  { id:'cracked',  label:'Cracked on the anvil stone', icon:'🪨', desc:'Smashed open the way a Song Thrush breaks snails on a stone.' },
    husked:   { id:'husked',   label:'Husked & dried',           icon:'🌾', desc:'Dry seed with the husk split — finch-bill ready.' },
    floating: { id:'floating', label:'Floated on the water',     icon:'💧', desc:'Scattered on the pond surface for dabblers to sieve.' },
    tossed:   { id:'tossed',   label:'Tossed to the wind',       icon:'🌬️', desc:'Thrown skyward — some birds only ever feed on the wing.' },
    smeared:  { id:'smeared',  label:'Pressed into a bark log',  icon:'🪵', desc:'Worked into bark crevices like a garden suet log.' }
  };

  // Larder ingredients. family preserves the existing FOODS/pantry ids for UI
  // compatibility; dietFamily is the source-backed canonical compatibility id.
  const INGREDIENTS = {
    small_bird_prey_ration: { id:'small_bird_prey_ration', label:'Small-Bird Prey Ration', icon:'🪶', family:'meat',    dietFamily:'small_birds',             preps:['whole','fresh'],              source:'Falconry Ration Run quest, butcher counter.', takenBy:'Merlin, Sparrowhawk, Hobby, Peregrine', desc:'Tasteful prepared falcon ration representing small-bird prey without graphic detail.' },
    starling_prey_ration: { id:'starling_prey_ration', label:'Starling Prey Ration', icon:'🐦', family:'meat',  dietFamily:'small_birds',             preps:['whole','fresh'],              source:'Falconry Ration Run quest, butcher counter.', takenBy:'Peregrine, Sparrowhawk, Goshawk', desc:'A thrush-to-starling sized ration — the size class a Peregrine stoops on over open ground.' },
    pigeon_prey_ration:   { id:'pigeon_prey_ration',   label:'Pigeon Prey Ration',   icon:'🕊️', family:'meat',  dietFamily:'small_birds',             preps:['whole','fresh'],              source:'Falconry Ration Run quest, butcher counter.', takenBy:'Goshawk, Peregrine, Eagle Owl', desc:'The heavyweight bird-prey ration. Pigeons are the mainstay of city Peregrines and of Goshawks.' },
    live_minnow:      { id:'live_minnow',      label:'Live Minnow',      icon:'🐟', family:'fish',    dietFamily:'fish',                    preps:['live','fresh'],               source:'Fishing trips and riverside forage.', takenBy:'Kingfisher, Little Egret, young Osprey', desc:'A darting silver minnow. Keep it swimming for the plunge-divers.' },
    river_trout:      { id:'river_trout',      label:'River Trout',      icon:'🎣', family:'fish',    dietFamily:'fish',                    preps:['live','fresh'],               source:'The rarer fishing-trip catch.', takenBy:'Osprey, Grey Heron, Goosander, White-tailed Eagle', desc:'A plump trout — a proper prize for a big fish-hunter.' },
    sand_eel:         { id:'sand_eel',         label:'Sand Eel',         icon:'🐠', family:'fish',    dietFamily:'fish',                    preps:['live','fresh'],               source:'Fishing trips and the shoreline hunt.', takenBy:'Puffin, Arctic Tern, Kittiwake, Guillemot', desc:'The slim silver fish whole seabird colonies live on — carried home crosswise in the bill.' },
    mealworm_scoop:   { id:'mealworm_scoop',   label:'Mealworm Scoop',   icon:'🐛', family:'insects', dietFamily:'invertebrates',           preps:['fresh','smeared'],            source:'Shops and hedgerow quests.', desc:'Wriggling mealworms — useful for true insect-eaters, not a universal meal.' },
    wasp_grub_comb:   { id:'wasp_grub_comb',   label:'Wasp Grub Comb',   icon:'🐝', family:'insects', dietFamily:'invertebrates',           preps:['fresh','smeared'],            source:'Marsh & Ditch Hunt quest, map forage.', takenBy:'Honey Buzzard', desc:'A slab of wasp comb thick with grubs. The Honey Buzzard digs out wasp nests and eats little else all summer.' },
    aerial_midges:    { id:'aerial_midges',    label:'Cloud of Midges',  icon:'🦟', family:'flying',  dietFamily:'flying_insects',          preps:['tossed'],                     source:'Netted over the pond at dusk.', desc:'Tiny flying insects. Only useful to birds that feed on the wing.' },
    dragonfly_swarm:  { id:'dragonfly_swarm',  label:'Dragonfly Swarm',  icon:'🪰', family:'flying',  dietFamily:'flying_insects',          preps:['tossed'],                     source:'Marsh & Ditch Hunt quest, map forage.', takenBy:'Hobby, Bee-eater, Red-footed Falcon', desc:'Big insect prey for aerial hunters. A Hobby catches dragonflies on the wing and eats them in flight.' },
    garden_worms:     { id:'garden_worms',     label:'Garden Worms',     icon:'🪱', family:'worms',   dietFamily:'worms',                   preps:['fresh'],                      source:'Turned up by quests and forage.', desc:'Fat earthworms, the lawn-forager staple.' },
    shore_snail_mix:  { id:'shore_snail_mix',  label:'Shore Snail Mix',  icon:'🐚', family:'worms',   dietFamily:'molluscs_crustaceans',    preps:['cracked','fresh'],            source:'Estuary forage.', desc:'Small molluscs and crustaceans for waders and shorebirds.' },
    hedgerow_berries: { id:'hedgerow_berries', label:'Hedgerow Berries', icon:'🫐', family:'berries', dietFamily:'fruit_berries',           preps:['fresh'],                      source:'Autumn hedgerows and quests.', desc:'Rowan, hawthorn and bramble berries.' },
    windfall_apple:   { id:'windfall_apple',   label:'Windfall Apple',   icon:'🍎', family:'fruit',   dietFamily:'fruit_berries',           preps:['fresh'],                      source:'Orchard forage.', desc:'Soft windfall fruit for garden thrushes and blackcaps.' },
    nectar_cup:       { id:'nectar_cup',       label:'Nectar Cup',       icon:'🌺', family:'fruit',   dietFamily:'nectar',                  preps:['fresh'],                      source:'Blossom garden prep.', desc:'A nectar feeder for honeyeaters, lorikeets and other blossom specialists.' },
    sunflower_seeds:  { id:'sunflower_seeds',  label:'Sunflower Seeds',  icon:'🌻', family:'seeds',   dietFamily:'seeds',                   preps:['husked','fresh','floating'],  source:'Shops, quests and map forage.', desc:'Oil-rich seeds. Husk them for finches, float grain for ducks.' },
    acorn_handful:    { id:'acorn_handful',    label:'Acorn Handful',    icon:'🌰', family:'acorns',  dietFamily:'seeds',                   preps:['fresh','cracked'],            source:'Oak woodland forage.', desc:'Whole acorns — jays cache them whole; others need them cracked.' },
    suet_cake:        { id:'suet_cake',        label:'Suet Cake',        icon:'🧈', family:'suet',    dietFamily:'invertebrates',           preps:['smeared','fresh'],            source:'Shops.', desc:'High-energy fat cake, best worked into a bark log.' },
    pondweed_tangle:  { id:'pondweed_tangle',  label:'Pondweed Tangle',  icon:'🌿', family:'aquatic', dietFamily:'aquatic_plants',          preps:['floating','fresh'],           source:'Pond-edge forage.', desc:'Water plants and dabbled greens — proper duck food, never bread.' },
    field_vole:       { id:'field_vole',       label:'Field Vole',       icon:'🐭', family:'meat',    dietFamily:'small_mammals',           preps:['live','fresh'],               source:'Vole Meadow Hunt quest, map forage.', takenBy:'Barn Owl, Kestrel, Short-eared Owl, Hen Harrier', desc:'The single most important prey animal for British raptors — Barn Owls live on almost nothing else.' },
    wood_mouse:       { id:'wood_mouse',       label:'Wood Mouse',       icon:'🐁', family:'meat',    dietFamily:'small_mammals',           preps:['live','fresh'],               source:'Vole Meadow Hunt quest, map forage.', takenBy:'Tawny Owl, Little Owl, Long-eared Owl, Kestrel', desc:'The commonest woodland mouse, and the staple night-time catch of the Tawny Owl.' },
    common_shrew:     { id:'common_shrew',     label:'Common Shrew',     icon:'🐀', family:'meat',    dietFamily:'small_mammals',           preps:['live','fresh'],               source:'Vole Meadow Hunt quest.', takenBy:'Barn Owl, Kestrel, Short-eared Owl', desc:'Musky and small — most predators spit shrews out, but owls swallow them whole without complaint.' },
    young_rabbit:     { id:'young_rabbit',     label:'Young Rabbit',     icon:'🐇', family:'meat',    dietFamily:'small_mammals',           preps:['live','fresh'],               source:'Warren Watch quest, map forage.', takenBy:'Buzzard, Golden Eagle, Goshawk, Eagle Owl', desc:'The big prey item. Rabbits carry Buzzards and Golden Eagles through the lean months.' },
    common_frog:      { id:'common_frog',      label:'Common Frog',      icon:'🐸', family:'meat',    dietFamily:'reptiles_amphibians',     preps:['live','fresh'],               source:'Marsh & Ditch Hunt quest.', takenBy:'Grey Heron, Little Owl, Marsh Harrier, Buzzard', desc:'Amphibian prey out of ditches and wet meadows — a spring staple for herons and marsh hunters.' },
    common_lizard:    { id:'common_lizard',    label:'Common Lizard',    icon:'🦎', family:'meat',    dietFamily:'reptiles_amphibians',     preps:['live','fresh'],               source:'Marsh & Ditch Hunt quest.', takenBy:'Kestrel, Little Owl, Secretarybird, Pacific Baza', desc:'Reptile prey basking on heath and dune. Secretarybirds hunt reptiles on foot, striding through the grass.' },
    carrion_scraps:   { id:'carrion_scraps',   label:'Carrion Scraps',   icon:'🦴', family:'carrion', dietFamily:'carrion',                 preps:['fresh'],                      source:'Carrion Round quest, map forage.', takenBy:'Carrion Crow, Raven, Red Kite, Buzzard, Magpie', desc:'Scavenged remains — a corvid banquet.' },
    deer_carrion:     { id:'deer_carrion',     label:'Deer Carrion',     icon:'🦌', family:'carrion', dietFamily:'carrion',                 preps:['fresh'],                      source:'Carrion Round quest.', takenBy:'Red Kite, Raven, White-tailed Eagle, Griffon Vulture', desc:'A whole winter-killed carcass. Kites, ravens and eagles queue at one for days.' },
    marrow_bone:      { id:'marrow_bone',      label:'Marrow Bone',      icon:'🍖', family:'carrion', dietFamily:'carrion',                 preps:['fresh'],                      source:'Carrion Round quest.', takenBy:'Bearded Vulture (Lammergeier)', desc:'The Bearded Vulture is the only bird alive on a diet of bone: it drops them onto rock to split out the marrow.' },
    gizzard_grit:     { id:'gizzard_grit',     label:'Gizzard Grit',     icon:'⚪', family:'grit',    dietFamily:'grit',                    preps:['fresh'],                      source:'Riverbank gravel.', desc:'Birds have no teeth: seed-eaters swallow grit and the gizzard grinds the meal.' }
  };

  // Families whose meals the gizzard-grit garnish genuinely helps grind.
  const GRIT_FAMILIES = ['seeds', 'acorns', 'aquatic', 'aquatic_plants'];
  const DIET_FAMILIES = {
    small_birds:'Small-bird prey rations',
    small_mammals:'Small mammals',
    reptiles_amphibians:'Reptiles and amphibians',
    fish:'Fish',
    flying_insects:'Flying insects',
    invertebrates:'General invertebrates',
    worms:'Worms',
    molluscs_crustaceans:'Molluscs and crustaceans',
    seeds:'Seeds',
    fruit_berries:'Fruit and berries',
    nectar:'Nectar',
    aquatic_plants:'Aquatic or leafy plants',
    carrion:'Carrion'
  };

  // Educational lines shown when the family is right but the serving style is
  // not how the species really takes it (verdict "close").
  const PREP_NOTES = {
    'fish:live':      'It hunts living fish, snatched straight from the water — a still fillet barely tempts it.',
    'small_birds:whole': 'This falcon needs a whole small-bird prey ration as its main meal.',
    'small_mammals:live': 'It is a live-prey hunter: movement is what triggers the strike.',
    'reptiles_amphibians:live': 'It is a live-prey hunter: movement is what triggers the strike.',
    'meat:live':      'It is a live-prey hunter: movement is what triggers the strike.',
    'aquatic:floating': 'Dabblers sieve food from the surface — float it on the water.',
    'aquatic_plants:floating': 'Dabblers sieve food from the surface — float it on the water.',
    'seeds:floating': 'Ducks dabble spilt grain from the surface — scatter it on the water.',
    'seeds:husked':   'A seed-eater bill husks dry seed — serve it husked and dry.',
    'flying:tossed':  'It only feeds on the wing — toss the insects skyward.',
    'flying_insects:tossed': 'It only feeds on the wing — toss the insects skyward.',
    'molluscs_crustaceans:cracked': 'Shell-bearing shore food needs cracking before many birds can take it.',
    'suet:smeared':   'Bark-feeders take fat worked into crevices, like a garden suet log.',
    'acorns:fresh':   'It caches acorns whole to bury for winter — leave them uncracked.'
  };

  const TIER_META = {
    field_perfect: { id:'field_perfect', label:'Field-Perfect Meal', icon:'🏅', xp:24, coins:30 },
    hearty:        { id:'hearty',        label:'Hearty Meal',        icon:'🍽️', xp:14, coins:12 },
    scrappy:       { id:'scrappy',       label:'Scrappy Meal',       icon:'🥄', xp:6,  coins:0 },
    refused:       { id:'refused',       label:'Meal Refused',       icon:'🙅', xp:2,  coins:0 }
  };

  // First Field-Perfect meal for a wild (codex) species: bonus coins, and the
  // species trusts your table — recruiting it gets cheaper, down to a floor.
  const FIRST_BADGE_BONUS_COINS = 20;
  const RECRUIT_DISCOUNT = 0.15;
  const RECRUIT_FLOOR = 0.4;

  // The carnivore families. Birds of prey can only ever be fed from these, so
  // quest, forage and shop tables use this list to guarantee meat is around.
  const PREY_DIET_FAMILIES = ['small_birds', 'small_mammals', 'reptiles_amphibians', 'fish', 'carrion'];
  function listPreyIngredients() {
    return Object.values(INGREDIENTS)
      .filter(i => PREY_DIET_FAMILIES.indexOf(i.dietFamily) >= 0)
      .map(i => ({ ...i, preps:[...i.preps] }));
  }

  function ingredientById(id) { return INGREDIENTS[id] || null; }
  function prepById(id) { return PREPS[id] || null; }
  function listIngredients() { return Object.values(INGREDIENTS).map(i => ({ ...i, preps:[...i.preps] })); }
  function listPreps() { return Object.values(PREPS).map(p => ({ ...p })); }
  function tierMeta(id) { return TIER_META[id] || TIER_META.scrappy; }

  function ingredientFamilies(ingredient) {
    const ids = [ingredient && ingredient.family, ingredient && ingredient.dietFamily].filter(Boolean);
    return [...new Set(ids)];
  }

  function matchedFamily(list, ingredient) {
    const wanted = list || [];
    return ingredientFamilies(ingredient).find(family => wanted.includes(family)) || null;
  }

  function prepWantedFor(ingredient, prepWants) {
    const wants = prepWants || {};
    for (const family of ingredientFamilies(ingredient)) {
      if (wants[family]) return { family, prep:wants[family] };
    }
    return { family:(ingredient && (ingredient.dietFamily || ingredient.family)) || '', prep:null };
  }

  const GENERALIST = { pref:['seeds','insects'], ok:['berries','fruit','worms','suet'], avoid:[], prep:{}, fact:'Most garden birds take seeds and insects.' };

  // Score a plate. dietRule is a BIRD_DIET_RULES entry ({pref, ok, avoid,
  // prep?, fact}) or null for an unknown/generalist species. slots is an array
  // of {ingredientId, prep}. Deterministic and side-effect free.
  function scoreMeal(dietRule, slots) {
    const rule = dietRule || GENERALIST;
    const prepWants = rule.prep || {};
    const rows = (slots || []).filter(s => s && ingredientById(s.ingredientId));
    const foodRows = rows.filter(s => ingredientById(s.ingredientId).family !== 'grit');
    const gritRows = rows.filter(s => ingredientById(s.ingredientId).family === 'grit');

    let points = 0;
    let perfect = 0;
    let refused = 0;
    const slotResults = [];

    for (const slot of foodRows) {
      const ing = ingredientById(slot.ingredientId);
      const family = ing.dietFamily || ing.family;
      const servedPrep = PREPS[slot.prep] ? slot.prep : (ing.preps[0] || 'fresh');
      let verdict;
      let note;
      let delta;
      const prefFamily = matchedFamily(rule.pref, ing);
      const okFamily = matchedFamily(rule.ok, ing);
      const avoidFamily = matchedFamily(rule.avoid, ing);
      if (prefFamily) {
        const wantedInfo = prepWantedFor(ing, prepWants);
        const wanted = wantedInfo.prep || null;
        const noteFamily = wantedInfo.family || prefFamily || family;
        if (!wanted || wanted === servedPrep) {
          verdict = 'perfect'; delta = 2; perfect += 1;
          note = 'Exactly what it eats in the wild.';
        } else {
          verdict = 'close'; delta = 1;
          note = PREP_NOTES[noteFamily + ':' + wanted] || ('Right food, wrong serving — it takes ' + noteFamily + ' ' + (PREPS[wanted] ? PREPS[wanted].label.toLowerCase() : wanted) + '.');
        }
      } else if (okFamily) {
        verdict = 'nibbled'; delta = 1;
        note = 'It will nibble this, but it is not the heart of its diet.';
      } else if (avoidFamily) {
        verdict = 'refused'; delta = -2; refused += 1;
        note = rule.fact || 'That is not part of its natural diet.';
      } else {
        verdict = 'ignored'; delta = 0;
        note = 'It ignores this — not part of its natural diet.';
      }
      points += delta;
      slotResults.push({ ingredientId: ing.id, family, prep: servedPrep, verdict, points: delta, note });
    }

    // Grit garnish: pays only alongside a grinding-friendly (seed-type) meal.
    let gritNote = null;
    for (const slot of gritRows) {
      const helps = foodRows.some(s => GRIT_FAMILIES.includes(ingredientById(s.ingredientId).family));
      const verdict = helps ? 'gizzard' : 'wasted';
      const delta = helps ? 1 : 0;
      points += delta;
      gritNote = helps
        ? 'Gizzard bonus! Birds have no teeth — swallowed grit grinds seed inside the gizzard.'
        : 'Grit only helps grind seed-type meals — it was left in the tray.';
      slotResults.push({ ingredientId: 'gizzard_grit', family: 'grit', prep: 'fresh', verdict, points: delta, note: gritNote });
    }

    const n = foodRows.length;
    let tier;
    if (!n || points <= 0) tier = 'refused';
    else if (perfect === n && refused === 0 && n >= 2) tier = 'field_perfect';
    else if (perfect === 0 && refused === 0) tier = 'scrappy';
    else if (points >= 2 * n - 1) tier = 'hearty';
    else if (refused > 0 && points < n) tier = 'scrappy';
    else if (points >= n) tier = 'hearty';
    else tier = 'scrappy';

    const meta = tierMeta(tier);
    return { tier, tierLabel: meta.label, tierIcon: meta.icon, points, slots: slotResults, gritNote, xp: meta.xp, coins: meta.coins, perfectCount: perfect, refusedCount: refused };
  }

  function discountedRecruitCost(baseCost, badgeCount) {
    const base = Math.max(0, Number(baseCost) || 0);
    const times = Math.max(0, Math.floor(Number(badgeCount) || 0));
    const discounted = base * Math.pow(1 - RECRUIT_DISCOUNT, times);
    return Math.max(Math.round(base * RECRUIT_FLOOR), Math.round(discounted));
  }

  return {
    PREPS, INGREDIENTS, DIET_FAMILIES, GRIT_FAMILIES, PREP_NOTES, TIER_META,
    FIRST_BADGE_BONUS_COINS, RECRUIT_DISCOUNT, RECRUIT_FLOOR,
    PREY_DIET_FAMILIES, listPreyIngredients,
    ingredientById, prepById, listIngredients, listPreps, tierMeta,
    scoreMeal, discountedRecruitCost
  };
});
