(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzMerlinCompanionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const BASE_CHATTER_LINES = [
    'I saw a worm this morning. I let him live. He knows why.',
    'Early bird gets the worm? I prefer brunch.',
    'I don’t sing for free after 9am.',
    'Statues are just humans who lost a staring contest with a pigeon.',
    'My nest isn’t messy, it’s rustic.',
    'The cat asked permission to enter this garden. As it should.',
    'Migration is just a group chat that got wildly out of hand.',
    'I could fly south for winter… or you could turn the heating up.',
    'That scarecrow? We use it as a coat rack.',
    'Tweet tweet. That’s copyrighted, by the way.',
    'Bathed in a puddle today. It’s called self-care.',
    'Seagulls don’t share chips. Don’t be a seagull.',
    'I’m on a seafood diet. I see food and scream like a gull.',
    'Your alarm goes off at 6am? Cute. I AM the alarm.',
    'Feathers: 10/10, would preen again.',
    'If I stare at the window long enough, snacks appear. Science.',
    'The pecking order? I invented it. Look it up.',
    'I’m not chubby, I’m fluffed for winter.',
    'Told an owl a joke once. He didn’t give a hoot.',
    'Free bird? Mate, this bird costs three sunflower seeds minimum.',
    'Fact: hummingbirds are the only birds that can fly backwards.',
    'Fact: an ostrich’s eye is bigger than its brain.',
    'Fact: wrens can sing around 10 notes a second. Show-offs.',
    'Fact: crows recognise human faces — and hold grudges.',
    'Fact: swifts can stay airborne for 10 months without landing.',
    'Fact: owls can’t move their eyes — that’s why they swivel their heads.',
    'Fact: a robin’s red breast is for territory battles, not romance.',
    'Fact: peregrine falcons dive at over 240 mph — fastest animal on Earth.',
    'Fact: some ducks sleep with one eye open, half the brain on watch.',
    'Fact: puffins can carry a dozen fish in their beak at once.'
  ];

  // Eighty new Merlin character lines. Together with the twenty gameplay tips
  // below this is exactly one hundred additional things for Merlin to say.
  const NEW_CHATTER_LINES = [
    'A wizard is never late. He is merely circling on a thermal.',
    'My wand says adventure. My stomach says mealworms.',
    'I polished my beak. The kingdom may now proceed.',
    'I have consulted the clouds. They remain extremely vague.',
    'One does not simply walk into a nest. Wipe your feet first.',
    'I can identify three hundred winds and one suspicious draught.',
    'The moon owes me a feather. Long story.',
    'Every great quest begins with snacks and a charged phone.',
    'I tried meditation. A beetle walked past and ruined everything.',
    'That was not a crash landing. It was advanced perching.',
    'My official title is Merlin, Wizard Falcon and Senior Crumb Inspector.',
    'I put the “raptor” in “rapturous applause”.',
    'A good cloak billows. Mine has wings and goes wherever it likes.',
    'I read the entire field guide. The pictures of me were excellent.',
    'Some birds flock. I prefer a carefully selected entourage.',
    'The wind whispered your name. Then it asked for directions.',
    'I have hidden a spell in this sentence. No, you cannot have it.',
    'You bring the map. I will bring unreasonable confidence.',
    'A tiny falcon can still have enormous main-character energy.',
    'My talons are for magic, manners and opening difficult snack packets.',
    'The kingdom is safe. I checked from the curtain rail.',
    'I once challenged a kestrel to a hover-off. We do not discuss the result.',
    'If lost, follow the feathers. Unless they are pigeon feathers.',
    'My favourite spell is Summon Breakfast.',
    'The dawn chorus keeps asking me to conduct. I am considering it.',
    'I have seen the future. You remember to charge your phone this time.',
    'No quest is too small if there is a dramatic hat involved.',
    'I can turn coins into snacks. The shopkeeper calls it “buying”.',
    'That sparkle was intentional. All my sparkles are intentional.',
    'A rook called me short. I called him architecturally repetitive.',
    'You may pet the wizard. The wizard reserves the right to look dignified.',
    'I am listening for birds and compliments. Either will do.',
    'My feathers are weatherproof. My mood is weather-dependent.',
    'The Academy library has banned me from rearranging books by wing colour.',
    'I know a spell for patience. It takes ages to cast.',
    'Never underestimate a bird who can read quest markers.',
    'I put a charm on the pantry. It now opens when you pull the handle.',
    'The stars are just legendary loot with terrible drop rates.',
    'I asked the river for wisdom. It told me to keep moving.',
    'There is no problem a good flight and a better snack cannot improve.',
    'The Barracks birds think I am mysterious. Please do not correct them.',
    'If the map looks big, remember: every kingdom starts beneath one perch.',
    'I keep emergency courage under my left wing.',
    'That distant chirp sounded rare. Or tiny and opinionated.',
    'My spellbook is mostly bird facts with dramatic punctuation!',
    'I am not hovering over your shoulder. I am supervising heroically.',
    'Today has excellent quest weather. I can tell because I want a quest.',
    'The best treasure is friendship. The second best is shiny gear.',
    'I tried to count every bird. The starlings refused to stand still.',
    'Do not worry. I have a plan, a backup plan and wings.',
    'The village bell rings for heroes. Also lunch. Mostly lunch.',
    'I can hear a wren arguing from three hedges away.',
    'One day they will build a statue of me. I demand a comfortable perch.',
    'The secret to magic is confidence and very good lighting.',
    'I told the rain to stop. It has submitted an appeal.',
    'A companion follows you. A wizard makes it look like destiny.',
    'If I look thoughtful, I am probably calculating snack distance.',
    'Your flock has potential. I have already prepared a speech.',
    'The old oak knows many secrets. It will not tell me where it hid the acorns.',
    'A feather on the breeze is nature sending a notification.',
    'I practise my heroic silhouette every sunset.',
    'We should explore somewhere new. Familiar worms grow complacent.',
    'My wand glows near birdsong and occasionally excellent biscuits.',
    'The Kingdom of Burbz runs on courage, curiosity and pantry stock.',
    'I can make myself invisible. I simply stand behind a larger bird.',
    'That cloud looks like a dragon. The other one looks like lunch.',
    'I have declared this perch a sovereign wizard tower.',
    'You handle the walking. I will handle aerial reconnaissance.',
    'A legendary day can begin with one ordinary chirp.',
    'The path ahead is mysterious, mainly because the hedge is in the way.',
    'I do not steal shiny things. I relocate magical resources.',
    'The finest fighters still need rest, food and someone cheering for them.',
    'My battle cry is elegant, piercing and difficult to spell.',
    'I once flew through a rainbow. Very damp. Excellent colours.',
    'Even wizards need naps. We call them mana restoration.',
    'There is always another bird to learn and another place to wander.',
    'I have checked your luck. It improves dramatically when you go outside.',
    'A quiet field is not empty. It is waiting for you to listen.',
    'I am ready when you are. I was also ready five minutes ago.',
    'Together we make an excellent team: you have thumbs and I know magic.'
  ];

  const GAMEPLAY_TIPS = [
    'Tip: Open Scan and choose Sound to let my wand keep listening with BirdNET while you visit other Burbz screens.',
    'Tip: Camera and BirdNET discoveries fill the Birdex; typing a bird name never counts as a discovery.',
    'Tip: Tap a discovered Birdex card to flip it and read the real habitat, diet and field-guide notes.',
    'Tip: Build the Barracks at the Academy before you try to recruit birds you have discovered.',
    'Tip: Feed birds their real diet in the Kitchen & Pantry to earn trust and improve your field notes.',
    'Tip: The Map’s Likely Birds panel changes with your real location, season and nearby habitat.',
    'Tip: Walking quests begin at their marked trailhead, so check the distance before choosing one.',
    'Tip: Tap Show Quests on the Map to frame every nearby route and compare its trailhead distance.',
    'Tip: Training, gear and Academy rooms strengthen recruited birds without changing their real biological base stats.',
    'Tip: A bird’s rarity affects encounters and rewards, not whether a robin can overpower an eagle.',
    'Tip: Use the Hospital and Roost after battles to restore tired or injured flock members.',
    'Tip: The Stores can hold XP scrolls for later, so you can choose exactly which recruited bird receives them.',
    'Tip: Locked Birdex cards hide species names; discover birds outdoors to reveal their artwork and information.',
    'Tip: In Birdex, use Load More to browse another batch without forcing every species card to load at once.',
    'Tip: Liberation Battles free real-world towns and awaken their linked sanctuary in the Kingdom of Burbz.',
    'Tip: Counter enemy wing classes in battle instead of relying only on the bird with the biggest power number.',
    'Tip: Settings contains Replay Complete Tutorial whenever you want Merlin’s full tour again.',
    'Tip: Continuous listening stops when you press Stop, close Burbz or your phone suspends the browser.',
    'Tip: Visit the Bag to equip earned gear; different items can improve attack, defence, speed or magic.',
    'Tip: Tap me at the top right whenever you want to check my food, happiness, energy and bond level.'
  ];

  const ALL_MERLIN_LINES = BASE_CHATTER_LINES.concat(NEW_CHATTER_LINES, GAMEPLAY_TIPS);
  const DEFAULT_MERLIN_CARE = Object.freeze({
    hunger: 20,
    happiness: 85,
    energy: 90,
    bondXp: 0,
    bondLevel: 1,
    thingsSaid: 0,
    chatterIndex: 0,
    tipIndex: 0,
    lastCareAt: null,
    lastFedAt: null,
    lastPlayedAt: null,
    lastRestedAt: null
  });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function sanitizeMerlinCare(raw, now) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const time = Number(now) || Date.now();
    return {
      hunger: clamp(source.hunger === undefined ? DEFAULT_MERLIN_CARE.hunger : source.hunger, 0, 100),
      happiness: clamp(source.happiness === undefined ? DEFAULT_MERLIN_CARE.happiness : source.happiness, 0, 100),
      energy: clamp(source.energy === undefined ? DEFAULT_MERLIN_CARE.energy : source.energy, 0, 100),
      bondXp: Math.max(0, Math.floor(Number(source.bondXp) || 0)),
      bondLevel: clamp(Math.floor(Number(source.bondLevel) || 1), 1, 99),
      thingsSaid: Math.max(0, Math.floor(Number(source.thingsSaid) || 0)),
      chatterIndex: Math.max(0, Math.floor(Number(source.chatterIndex) || 0)),
      tipIndex: Math.max(0, Math.floor(Number(source.tipIndex) || 0)),
      lastCareAt: Number(source.lastCareAt) || time,
      lastFedAt: Number(source.lastFedAt) || null,
      lastPlayedAt: Number(source.lastPlayedAt) || null,
      lastRestedAt: Number(source.lastRestedAt) || null
    };
  }

  function addBond(state, amount) {
    const next = { ...state, bondXp: state.bondXp + Math.max(0, Number(amount) || 0) };
    while (next.bondXp >= 100 && next.bondLevel < 99) {
      next.bondXp -= 100;
      next.bondLevel += 1;
    }
    return next;
  }

  function tickMerlinCare(raw, elapsedMinutes, now) {
    const state = sanitizeMerlinCare(raw, now);
    const minutes = clamp(elapsedMinutes, 0, 1440);
    const hungerGain = Math.floor(minutes / 15);
    const hungryPenalty = state.hunger + hungerGain > 60 ? Math.floor(minutes / 30) : 0;
    return sanitizeMerlinCare({
      ...state,
      hunger: state.hunger + hungerGain,
      happiness: state.happiness - hungryPenalty,
      energy: state.energy + Math.floor(minutes / 20),
      lastCareAt: Number(now) || Date.now()
    }, now);
  }

  function grantMerlinBondXp(raw, amount, now) {
    return addBond(sanitizeMerlinCare(raw, now), Math.max(0, Number(amount) || 0));
  }

  function applyMerlinCareAction(rawCare, rawPantry, action, now) {
    const time = Number(now) || Date.now();
    const state = sanitizeMerlinCare(rawCare, time);
    const pantry = { ...(rawPantry && typeof rawPantry === 'object' ? rawPantry : {}) };
    if (action === 'feed') {
      const insects = Math.max(0, Math.floor(Number(pantry.insects) || 0));
      if (insects < 1) return { ok:false, state, pantry, message:'No mealworms left — find or buy insects for Merlin first.' };
      pantry.insects = insects - 1;
      return { ok:true, pantry, state:addBond(sanitizeMerlinCare({ ...state, hunger:state.hunger - 30, happiness:state.happiness + 6, energy:state.energy + 4, lastCareAt:time, lastFedAt:time }, time), 5), message:'Mealworm magic! Merlin is much less hungry.' };
    }
    if (action === 'play') {
      return { ok:true, pantry, state:addBond(sanitizeMerlinCare({ ...state, hunger:state.hunger + 6, happiness:state.happiness + 22, energy:state.energy - 12, lastCareAt:time, lastPlayedAt:time }, time), 8), message:'Merlin swoops after the wand-light — happiness up!' };
    }
    if (action === 'rest') {
      return { ok:true, pantry, state:addBond(sanitizeMerlinCare({ ...state, happiness:state.happiness + 3, energy:state.energy + 28, lastCareAt:time, lastRestedAt:time }, time), 3), message:'Merlin tucks one foot up and restores his magic.' };
    }
    return { ok:false, state, pantry, message:'Merlin does not know that care action.' };
  }

  function nextMerlinUtterance(rawCare, randomFn) {
    const state = sanitizeMerlinCare(rawCare);
    const count = state.thingsSaid + 1;
    const isTip = count % 5 === 0;
    const pool = isTip ? GAMEPLAY_TIPS : BASE_CHATTER_LINES.concat(NEW_CHATTER_LINES);
    const indexKey = isTip ? 'tipIndex' : 'chatterIndex';
    let index;
    if (typeof randomFn === 'function') index = Math.floor(clamp(randomFn(), 0, 0.999999) * pool.length);
    else index = state[indexKey] % pool.length;
    const next = { ...state, thingsSaid:count, [indexKey]:state[indexKey] + 1 };
    return { state:next, line:pool[index], isTip };
  }

  return {
    BASE_CHATTER_LINES,
    NEW_CHATTER_LINES,
    GAMEPLAY_TIPS,
    ALL_MERLIN_LINES,
    DEFAULT_MERLIN_CARE,
    sanitizeMerlinCare,
    tickMerlinCare,
    grantMerlinBondXp,
    applyMerlinCareAction,
    nextMerlinUtterance
  };
});
