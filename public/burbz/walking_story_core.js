// Burbz Walking Story Core — "The Twenty Roads"
// A fixed campaign of 20 real-world walking quests. The same twenty tales, in
// the same order, for every player on Earth: the route under your boots is
// local, but the story you walk is shared. Each tale is sized to the walk
// (stroll / ramble / trek), told by a named NPC, and hides one lore scroll —
// the Feathered Folio — linking the roads to the Academy and the Empire.
// Pure logic module: no DOM, deterministic, UMD export for Node tests.
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzWalkingStoryCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const CAMPAIGN = {
    id: 'twenty_roads',
    title: 'The Twenty Roads',
    blurb: 'Twenty tales of the free realm, one for every road you walk. The paths are yours; the story is everyone\'s.'
  };

  // Walk-size tiers. lengthM is the quest's full walking distance, return leg
  // included, exactly as quest_core stamps it on the built quest.
  const STORY_TIERS = {
    stroll: { id: 'stroll', label: 'Stroll', icon: '🥾', minM: 0,    maxM: 1500 },
    ramble: { id: 'ramble', label: 'Ramble', icon: '🚶', minM: 1500, maxM: 3200 },
    trek:   { id: 'trek',   label: 'Trek',   icon: '⛰️', minM: 3200, maxM: Infinity }
  };

  function storyTierForLength(lengthM) {
    const m = Number(lengthM);
    if (!isFinite(m)) return 'ramble';
    if (m < STORY_TIERS.stroll.maxM) return 'stroll';
    if (m < STORY_TIERS.ramble.maxM) return 'ramble';
    return 'trek';
  }

  // The twenty tales. Rewards name real catalogue ids only: gear and materials
  // from loot_crafting_core, items from the bird-study scroll bag. A test
  // resolves every id, so a typo here cannot reach a player.
  const WALKING_STORIES = [
    {
      id: 'ws01_lamplighters_round', order: 1, tier: 'stroll',
      title: 'The Lamplighter\'s Round',
      npc: { name: 'Elder Bramblewing', role: 'Keeper of the Cradle Village' },
      intro: 'Ah, Merlin\'s walker! Our waymarker lanterns went dark the night the usurper rose. Walk my old round and let your footsteps wake them — light remembers being carried.',
      milestone: 'See how the lantern glow follows you? The old spells only needed someone who still walks the roads for love of them.',
      outro: 'Every lamp on the round burns again. The shadow hates a lit road, walker. Take this vest — my own, from younger wings — and the page I promised you.',
      scroll: {
        id: 'folio_01_charter_of_the_cradle',
        title: 'A Charter for the Cradle',
        text: 'Let it be written: where one village stands free, the realm is not fallen. Let its lamps be tended and its bounds be walked each season. From three free villages a county rises; from counties, duchies; from duchies, kingdoms; and from two crowns, the Empire of the Liberated Skies. But it begins — it always begins — with one walked road. — sealed with a green wax feather'
      },
      reward: { coins: 60, xp: 60, gear: { reed_vest: 1 }, materials: { oak_twig: 3 } }
    },
    {
      id: 'ws02_crumbs_for_the_quartermaster', order: 2, tier: 'stroll',
      title: 'Crumbs for the Quartermaster',
      npc: { name: 'Quartermaster Reedwhistle', role: 'Supply-wren of the Free Flocks' },
      intro: 'Name\'s Reedwhistle — I keep every free bird fed, which is harder than it sounds. My cache line hasn\'t been checked since the darkness came. Walk it for me and count what the shadow left us.',
      milestone: 'A full cache! Ha! The evil Burbz can\'t smell seed — smoke has no stomach. That\'s how we\'ll outlast them, walker: they occupy, we provision.',
      outro: 'Caches counted and the line holds. The Academy Kitchen will eat this winter. Here — a tonic from my private shelf, and a page from my ledger. Keep both close.',
      scroll: {
        id: 'folio_02_quartermasters_ledger',
        title: 'The Quartermaster\'s Ledger, Left Page',
        text: 'Rule one of the Kitchen & Pantry: every bird eats what it truly eats, and nothing else. A kingfisher starves beside a seed store. A gull feasts anywhere. Appoint a Head Chef and the pantry runs itself — the cleverer the chef, the further each plate goes. Rule two: feed the fighters first. Rule three: there is no rule the robin will not charm her way around.'
      },
      reward: { coins: 70, xp: 70, gear: { tonic_of_vigour: 1 }, materials: { river_reed: 3 } }
    },
    {
      id: 'ws03_scribes_lost_satchel', order: 3, tier: 'ramble',
      title: 'The Scribe\'s Lost Satchel',
      npc: { name: 'Scribe Inkwing', role: 'Jackdaw Archivist of the Academy Library' },
      intro: 'Catastrophe! A gust took my satchel and scattered a century of notes along this path. Walk my route, walker — my wings are for writing, not weather.',
      milestone: 'Pages! Here, caught in the hedge! Careful now — that one\'s the founding deed. Older than the usurper, older than fear.',
      outro: 'Nearly every page recovered, and the one that matters most. The Library owes you shelf-room forever. Keep that founding page — Sage Oakfeather says knowledge kept secret is just dust with pride.',
      scroll: {
        id: 'folio_03_founding_of_the_academy',
        title: 'On the Founding of the Academy',
        text: 'The Academy was not built. It was grown. Merlin planted his staff at the meeting of the old roads and asked the tree to hold a school, and the tree — being wiser than most councils — agreed. First came the Aviary Gardens, then the Roost, then rooms as they were needed: a Kitchen, a Hospital, a Library for the patient, a Crowbar for the sociable. The tree still grows. So must we.'
      },
      reward: { coins: 90, xp: 100, gear: { moonlit_charm: 1 }, materials: { iron_grit: 2 }, items: { xp_scroll_minor: 1 } }
    },
    {
      id: 'ws04_thistledowns_beat', order: 4, tier: 'stroll',
      title: 'Thistledown\'s Beat',
      npc: { name: 'Warden Thistledown', role: 'Warden of the Old Roads' },
      intro: 'A warden walks their beat daily, or it stops being theirs. My wing\'s not healed enough for the full round. Walk it in my stead — check every stile, note every shadow.',
      milestone: 'That cold patch you just passed? Old shadow-scorch. The usurper\'s soldiers rested there once. They don\'t rest anywhere a free walker passes daily — remember that.',
      outro: 'Beat walked, stiles sound, shadows noted. You\'d have made a fine warden in the old days. You ARE one now, come to think of it. My watch-notes are yours — read how we held the roads.',
      scroll: {
        id: 'folio_04_watch_notes',
        title: 'Watch-Notes of the Old Roads',
        text: 'Day 340 of the occupation. The evil Burbz hold every crossroads, yet they cannot hold the paths BETWEEN. Smoke needs a place to pool; a walker never stops. So we walk. Every road walked in freedom stays half-free, whatever banner rots above it. If you read this and the realm is still dark: walk. That is the whole of the order. Walk.'
      },
      reward: { coins: 80, xp: 80, gear: { swift_band: 1 }, materials: { down_tuft: 3 } }
    },
    {
      id: 'ws05_bell_that_would_not_ring', order: 5, tier: 'ramble',
      title: 'The Bell That Would Not Ring',
      npc: { name: 'Brother Alderdown', role: 'Chapel Dove of the Parish Bounds' },
      intro: 'Our chapel bell fell silent under the shadow — not cracked, just heartbroken. The old rite says a silent bell must be carried around the parish bounds by a free soul. Would you carry it? It\'s only a little bell.',
      milestone: 'Did you hear it? A hum! The bell remembers ringing! Keep walking, friend — it\'s listening to your footsteps and gathering its nerve.',
      outro: 'RING! Oh, RING! Sweetest sound in the parish! You\'ve given us our voice back, walker. Take this breastplate from the chapel\'s old defender, and the homily I never dared preach aloud.',
      scroll: {
        id: 'folio_05_homily_against_the_dark',
        title: 'A Homily Against the Dark',
        text: 'They tell you the usurper\'s soldiers are terrible, and they are: great shapes of smoke and ember with burning red eyes. But mark what they are made OF. Torn shadow. Borrowed shapes. Nothing the light ever loved. When a free bird dispels one, no creature dies — a lie stops being told, that is all. Do not hate the evil Burbz. Pity the stolen shapes, and put the lie down kindly wherever you find it standing.'
      },
      reward: { coins: 100, xp: 110, gear: { oak_breastplate: 1 }, materials: { moon_dust: 2 } }
    },
    {
      id: 'ws06_beacon_on_the_far_hill', order: 6, tier: 'trek',
      title: 'The Beacon on the Far Hill',
      npc: { name: 'Captain Gorsefoot', role: 'Bantam Captain of the Free Muster' },
      intro: 'Captain Gorsefoot, at your service — all of me, which isn\'t much, which is the joke, which I\'ve heard. The far beacon has stood dark since the muster fell. It\'s a proper trek, but light it and every free flock for miles knows the fight goes on.',
      milestone: 'Halfway, walker! When your legs complain, tell them this: the last bird who walked this road carried the muster\'s orders. You carry its answer.',
      outro: 'THE BEACON BURNS! Look at it! Half the realm can see that light, and somewhere the usurper is asking who lit it. YOU did. Take a blade worthy of the climb, and the last orders ever cried from that hill.',
      scroll: {
        id: 'folio_06_orders_from_the_last_muster',
        title: 'Orders from the Last Muster',
        text: 'To every captain of the free flocks: the capital is lost. The king\'s perch is taken. You are ordered — LAST order, so hear it whole — to scatter, survive, and keep the roads. Bury the banners. Teach the fledglings. One day a walker will come who can wake the dark map itself, village by village. When the far beacon burns again, that day has come. Muster. — Marshal of the Skyward Host, written in haste, sealed in hope'
      },
      reward: { coins: 150, xp: 160, gear: { stormcut_beak: 1 }, materials: { storm_glass: 2 }, items: { xp_scroll_minor: 1 } }
    },
    {
      id: 'ws07_mossbeaks_quiet_shrines', order: 7, tier: 'stroll',
      title: 'Mossbeak\'s Quiet Shrines',
      npc: { name: 'Keeper Mossbeak', role: 'Keeper of the Wayside Shrines' },
      intro: 'Softly now. Along this path stand the old wayside shrines — little roofs over little kindnesses. I\'m too slow to tend them all before dusk. Brush the leaves from each as you pass. That\'s the whole rite. Small things, kept, are how big things survive.',
      milestone: 'You tend them gently. Good. Each shrine remembers a bird who chose kindness when cruelty was easier. Merlin himself built the first one, you know. Before the wand. Before everything.',
      outro: 'All the shrines stand tended, and the path feels lighter — no, don\'t take my word, look behind you. Take this healing light, walker, and the waykeepers\' prayers. They are short. The best ones are.',
      scroll: {
        id: 'folio_07_prayers_of_the_waykeepers',
        title: 'Prayers of the Waykeepers',
        text: 'For the road: may it bend but not break. For the walker: may the way be long enough to think and short enough to arrive. For the flock at home: may the kettle be on. For the enemy: may the shadow grow bored of you and leave. And the falcon\'s own prayer, taught to the first keeper: may I be the reason a small thing was not lost. — collected at the wayside, author after author, none of them grand'
      },
      reward: { coins: 90, xp: 90, gear: { mending_light: 1 }, materials: { down_tuft: 2, moon_dust: 1 } }
    },
    {
      id: 'ws08_herbalists_rounds', order: 8, tier: 'ramble',
      title: 'The Herbalist\'s Rounds',
      npc: { name: 'Marla Nettlewick', role: 'Hedge-Robin Herbalist of the Bird Hospital' },
      intro: 'You look sturdy. Good — the Hospital\'s simples shelf is bare and my gathering round takes proper legs. Walk it with my basket: feverfew by the stile, comfrey past the wet ditch. The ward sister is owed her herbs.',
      milestone: 'That\'s the comfrey — grab a good bunch. Between us: half of healing is the herb, and half is somebody bothering to walk this far for you. The patients know the difference.',
      outro: 'A full basket! The ward will smell like a meadow and mend twice as fast for it. Here, a barrier draught of my own brewing — and the ward sister\'s receipts. Every cure in there was walked for, same as today.',
      scroll: {
        id: 'folio_08_receipts_of_the_ward_sister',
        title: 'Receipts of the Ward Sister',
        text: 'For a battle-fainted bird: warmth, stillness, and no visitors with opinions. For shadow-chill: sunlight in doses, laughter as tolerated. For a broken wing: time, splinted with patience. NOTE TO ALL STAFF — a healed patient goes HOME. The ward is a ward, not a lodging house; the moment a bird stands at full health, it is discharged to its own room and its own life. We heal them to leave us. That is the whole art.'
      },
      reward: { coins: 110, xp: 120, gear: { barrier_draught: 1 }, materials: { gold_thread: 1 } }
    },
    {
      id: 'ws09_letter_for_the_miller', order: 9, tier: 'stroll',
      title: 'A Letter for the Miller',
      npc: { name: 'Elder Bramblewing', role: 'Keeper of the Cradle Village' },
      intro: 'You again! Fortune loves me. This letter must reach the old mill by dusk, and my knees have registered a formal complaint. It\'s sealed with the green feather — no peeking, though you\'ll know soon enough.',
      milestone: 'Fine day for history, isn\'t it? Yes, history. That letter you\'re carrying — let\'s just say the realm grows back the way it grew the first time. Village by village. Walker by walker.',
      outro: 'Delivered! And now you may know: that was a summons to the first county moot since the darkness fell. Three free villages, close as neighbours — that\'s a COUNTY, walker, the first rung of the realm. And you carried the invitation. Take the copy — it belongs in your folio.',
      scroll: {
        id: 'folio_09_summons_to_the_county_moot',
        title: 'Summons to the First County Moot',
        text: 'To every free village within a short flight: your lamps are seen. Your bells are heard. It is time. Where three liberated villages stand together, their folk may found a COUNTY — granaries shared, roads kept, unity taxes paid into the common strongbox, a County Hall raised at the eldest sanctuary. Come to the moot. Come argue about the name — there is always an argument about the name. Come be a realm again. — by the Elder\'s wing, green feather seal'
      },
      reward: { coins: 100, xp: 100, gear: { keen_eye_bead: 1 }, materials: { iron_grit: 3 } }
    },
    {
      id: 'ws10_old_trade_road', order: 10, tier: 'trek',
      title: 'The Old Trade Road',
      npc: { name: 'Quartermaster Reedwhistle', role: 'Supply-wren of the Free Flocks' },
      intro: 'Big job today, walker — the biggest. Before the darkness, sky-caravans ran this road with cargo from counties away. The route\'s not been proved passable since. Walk it end to end. If your boots can do it, wings can.',
      milestone: 'Still on the old line — see the worn stones? A thousand caravans polished those. The usurper closed the roads because trade is how free realms hold wings. A closed road is a siege. An open one is a promise.',
      outro: 'PASSABLE! Officially! I\'m writing it in the book — first proved trade road of the new realm. When two counties open a route along here, remember whose boots proved it. Mail for the road-prover, and the old waybill for your folio.',
      scroll: {
        id: 'folio_10_waybill_of_the_sky_caravans',
        title: 'Waybill of the Sky-Caravans',
        text: 'MANIFEST, southbound caravan: two casks elderberry cordial (Crowbar, urgent). One crate lens-glass (Observatory, FRAGILE). Forge-iron, moon dust, three sacks letters. NOTE TO NEW COUNTIES: a trade route is drawn capital to capital in gold upon the map, and the farther the road, the rarer the cargo it returns. The caravans fly even over darkened lands — a ribbon of light through the usurper\'s night, proof the free realms still reach each other. Nothing on this manifest matters more than that.'
      },
      reward: { coins: 170, xp: 180, gear: { feather_mail: 1 }, materials: { sun_amber: 1 } }
    },
    {
      id: 'ws11_ember_script', order: 11, tier: 'ramble',
      title: 'Inkwing and the Ember Script',
      npc: { name: 'Scribe Inkwing', role: 'Jackdaw Archivist of the Academy Library' },
      intro: 'Walker! Perfect timing — bring your boots. The old milestones along this way carry carvings in the Ember Script, the usurper\'s own hand. I need rubbings of every one. Know your enemy\'s writing and you know his fears.',
      milestone: 'This carving — it\'s a WARD, not a boast! The usurper marked these stones to keep something OUT. Shadow that fears a road... oh, this rewrites three of my chapters.',
      outro: 'Every rubbing taken. And the conclusion is delicious: the usurper fears walked roads. Fears them enough to write it in stone. You\'ve turned his own script into our best weapon. A frost sigil for your trouble — and my translation, for the folio.',
      scroll: {
        id: 'folio_11_fragments_of_the_ember_script',
        title: 'Fragments of the Ember Script',
        text: 'Translated from the usurper\'s stone-wards, with the archivist\'s notes. "LET NO ROAD REMEMBER." (They remember.) "LET NO LAMP BE CARRIED." (They are carried.) "LET THE WALKED WAYS BE UNWALKED, FOR WHERE THEY WALK THE LAND WAKES." (Note the fear in the grammar — a command given to stone because no soldier could enforce it.) The shadow\'s whole strategy, confessed in his own hand: the realm wakes underfoot. So walk.'
      },
      reward: { coins: 130, xp: 140, gear: { frost_sigil: 1 }, materials: { storm_glass: 2 }, items: { xp_scroll_greater: 1 } }
    },
    {
      id: 'ws12_fledglings_first_march', order: 12, tier: 'stroll',
      title: 'The Fledgling\'s First March',
      npc: { name: 'Captain Gorsefoot', role: 'Bantam Captain of the Free Muster' },
      intro: 'Walker! Young Bramble here won\'t leave the yard — first patrol nerves, we\'ve all had them. March the training loop ahead of us, steady pace, nothing fancy. Fledglings follow courage. Yours will do.',
      milestone: 'Look behind you — the little terror\'s marching! Head high, wings tucked, proper form! Don\'t make a fuss or we\'ll lose the miracle. Just keep walking like it\'s the easiest thing in the world.',
      outro: 'Full loop, no tears — a muster record. Bramble thinks you\'re the bravest soul in the realm and I\'m not going to correct the child. Spurs for the drill-leader, and my old primer. Page one is the whole secret.',
      scroll: {
        id: 'folio_12_drill_masters_primer',
        title: 'The Drill Master\'s Primer',
        text: 'Page one: courage is a walking pace. Not a roar, not a dive — a pace. A bird that can hold a steady walk toward a frightening thing can be taught everything else in the Training Hall. Page two: train the smallest hardest; the realm is saved by wrens more often than eagles, and the eagles know it. Page three: drill ends at the Crowbar. Warriors who laugh together fly together. There is no page four.'
      },
      reward: { coins: 120, xp: 130, gear: { bronze_spurs: 1 }, materials: { down_tuft: 2 } }
    },
    {
      id: 'ws13_songs_under_the_eaves', order: 13, tier: 'ramble',
      title: 'Songs Under the Eaves',
      npc: { name: 'Old Tam Cinderquill', role: 'Retired Fletcher of the Forge' },
      intro: 'Sit down, no wait, walk — that\'s the point. Tam Cinderquill, fletcher, retired. Before the dark I could tell every path by its dawn chorus. My old song-map\'s here in my head, but the legs are gone. Walk it for me? Listen well at every turn, come back and tell me what still sings.',
      milestone: 'What can you hear? Truly listen. That\'s the verse I fletched arrows to for forty years. The shadow silenced half the realm\'s song — every road you walk hands a verse back.',
      outro: 'Still singing. STILL SINGING! You\'ve given an old bird his morning back, walker. Take this anklet — storm glass, my own work, listen to it crackle — and my songbook. The forge and the chorus were never separate crafts.',
      scroll: {
        id: 'folio_13_fletchers_songbook',
        title: 'The Fletcher\'s Songbook',
        text: 'A fletcher works to the dawn chorus or not at all — ask any smith at the Fletcher\'s Forge why the hearths face east. The old forge-song goes: Field Anvil for the learning wing, Stone Hearth for the willing wing, Guild Forge for the skilled, Royal for the bold, and the Sunfire Forge for the one work you\'ll be remembered by. Every hearth hones every blade the flock carries. And every blade, well made, is a promise the song goes on.'
      },
      reward: { coins: 140, xp: 150, gear: { stormglass_anklet: 1 }, materials: { gold_thread: 1, river_reed: 2 } }
    },
    {
      id: 'ws14_drowned_milestone', order: 14, tier: 'trek',
      title: 'The Drowned Milestone',
      npc: { name: 'Warden Thistledown', role: 'Warden of the Old Roads' },
      intro: 'A long one today, walker, and worth every step. Somewhere out on this way lies the border-stone of the old duchy — lost, overgrown, half-drowned in years. Find it. A realm that can\'t find its borders can\'t grow back into them.',
      milestone: 'You\'re in the old border country now. Two counties once met here as friends — that\'s all a duchy is, counties keeping faith across the distance. The stone will know your footsteps. Keep on.',
      outro: 'FOUND! The border-stone stands read again, and the old duchy has edges once more. When two free counties clasp wings across this line, the realm climbs its next rung — and it will be partly your doing. A runed crest for the finder. And the compact itself, walker. Folio-worthy if anything ever was.',
      scroll: {
        id: 'folio_14_border_stone_compact',
        title: 'The Border-Stone Compact',
        text: 'We, two counties of the free realm, set this stone not to divide our lands but to MEET at it. Within six hundred kilometres of wing, county capital to county capital, let there be one DUCHY: granaries answering granaries, roads joined to roads, one banner flown above two proud ones. Higher still stand kingdoms, and above kingdoms the Empire of the Liberated Skies — every tier made of the tier below it, never of subjects. Titles here are promises kept, not lands taken. The stone remembers the promise.'
      },
      reward: { coins: 180, xp: 200, gear: { runed_crest: 1 }, materials: { sun_amber: 1 }, items: { xp_scroll_greater: 1 } }
    },
    {
      id: 'ws15_kettle_for_the_watch', order: 15, tier: 'stroll',
      title: 'A Kettle for the Watch',
      npc: { name: 'Marla Nettlewick', role: 'Hedge-Robin Herbalist of the Bird Hospital' },
      intro: 'Quick feet needed, not clever ones! The night watch is out on the cold posts and this kettle of nettle brew won\'t carry itself. Walk it round while it\'s hot. A warm watch is a sharp watch.',
      milestone: 'Hear them thank you? A watch that knows it\'s remembered stands taller. The usurper grows his garrisons every time we grow — the world levels up its shadows, the wardens say. So the watch matters more every season.',
      outro: 'Kettle empty, watch warm, rounds done — you\'d make a fine hospital runner. Take a war-brew for your own battles, and the watch roster. Read the last line. Everyone should read the last line.',
      scroll: {
        id: 'folio_15_night_watch_roster',
        title: 'The Night Watch Roster',
        text: 'Posts one through nine, dusk till dawn, no post stands empty. NOTICE TO ALL WATCHERS: the wardens confirm it — the more the free realm rises, the harder the usurper pours shadow into what he still holds. Every county founded, every crown claimed, and his garrisons stand a level meaner, meanest of all out on the far frontier. Do not be disheartened. It means we are WINNING — a quiet enemy is a content one. Last line, and read it twice: the shadow gets stronger because we do.'
      },
      reward: { coins: 140, xp: 140, gear: { nettle_brew: 1 }, materials: { moon_dust: 2 } }
    },
    {
      id: 'ws16_observatorys_errand', order: 16, tier: 'ramble',
      title: 'The Observatory\'s Errand',
      npc: { name: 'Sage Oakfeather', role: 'Astronomer of the Moon Observatory' },
      intro: 'Walker, I require boots of exceptional smoothness. This lens blank must reach the far grinding-stone unjolted — one crack and a year of moonlight is wasted. Walk it the long gentle way. No shortcuts. The stars reward patience.',
      milestone: 'Halfway, and not a tremor — the lens hums happily, or I imagine it does, which for an astronomer is the same thing. Through its finished eye we\'ll map the dark half of the realm without leaving the tree.',
      outro: 'Delivered whole! When this lens first drinks moonlight, whatever it shows us of the darkened lands, your steady feet made it possible. A gale pendant, walker — you\'ve earned wind that obeys — and my observatory notes for the folio.',
      scroll: {
        id: 'folio_16_notes_from_the_observatory',
        title: 'Notes from the Moon Observatory',
        text: 'Night 112. The moon dust gathers on the lenses again — we sweep it into jars; the Forge pays well for glimmer. Night 119. Confirmed: the usurper\'s darkness is not weather. It is a HELD thing, effortful, like a wing forced open. Held things tire. Night 127. Charted lights in the occupied lands moving in walked patterns — lamps, carried. The dark map wakes from below, not above. Recommend to the council: fund the walkers. The sky agrees.'
      },
      reward: { coins: 160, xp: 170, gear: { gale_pendant: 1 }, materials: { storm_glass: 2 } }
    },
    {
      id: 'ws17_usurpers_footprints', order: 17, tier: 'trek',
      title: 'The Usurper\'s Footprints',
      npc: { name: 'Captain Gorsefoot', role: 'Bantam Captain of the Free Muster' },
      intro: 'Grim work today, walker, and I\'ll only ask once: a shadow-column passed through this country in the first days of the dark, and no free bird has ever walked its trail. The muster needs to know what the usurper\'s soldiers leave behind. Walk it whole. Eyes open.',
      milestone: 'Scorch-rings, cold as old grief — but look INSIDE the ring. Green. Growing. Even where the shadow pooled deepest, the land is already forgetting him. Note everything. Hope is intelligence too.',
      outro: 'Trail walked, and now the muster knows: the shadow passes, the land remains, and nothing the usurper does is permanent. That knowledge is worth a war-band, and you walked it out of the ground. Warden\'s plumage for your back, walker. And my field notes — the truest natural history of our enemy yet written.',
      scroll: {
        id: 'folio_17_natural_history_of_the_evil_burbz',
        title: 'A Natural History of the Evil Burbz',
        text: 'They are not birds. Write that first and read it whenever you doubt it. The evil Burbz are shadow cast in the SHAPE of birds — raptor-shaped, corvid-shaped, owl-shaped, keeping the wing-class of the form they were cast around, so matchup wisdom still wins fights. They do not eat. They do not nest. They occupy. And when a living flock breaks one, it does not die — it unravels, smoke and ember scattering, because it was never anything but a held lie. The garrison\'s strength is the usurper\'s fear made visible. Be flattered by it.'
      },
      reward: { coins: 200, xp: 220, gear: { warden_plumage: 1 }, materials: { ancient_rune: 1 } }
    },
    {
      id: 'ws18_smallest_diplomat', order: 18, tier: 'stroll',
      title: 'The Smallest Diplomat',
      npc: { name: 'Brother Alderdown', role: 'Chapel Dove of the Parish Bounds' },
      intro: 'A delicate errand, friend. A robin envoy walks the old parley path today to charm a lingering shadow-post into standing down — no battle, just charm. She asked for one companion: somebody with honest boots. That\'s you. Walk with her.',
      milestone: 'Watch her work — see the shadow-post leaning in to listen? The raptors will tell you wars are won by talons. The robins know better and are too polite to say so.',
      outro: 'Stood down! The whole post, won over without a feather raised — the gentlest dispelling there is. The envoy says your steady company did half the charming. A stormwing philtre for the diplomat\'s companion, and the treatise every Crowbar regular can recite.',
      scroll: {
        id: 'folio_18_on_charm',
        title: 'On Charm, and the Small Birds\' War',
        text: 'The buzzards carry the front line, and honour to them. But mark what the robin carries: CHARM, the fundamental stat of diplomacy, and diplomacy is how the small birds fight. Any bird may parley with an evil Burb; charm saps its will to hold the lie, and a weakened one may be won over whole — shadow lifted, no harm done, goodwill gifts left behind. Where is charm grown? The Crowbar, over elderberry cordial, one shy regular at a time. The Kingdom needs its warriors. It is saved, rather often, by its wrens.'
      },
      reward: { coins: 160, xp: 160, gear: { stormwing_philtre: 1 }, materials: { gold_thread: 1 } }
    },
    {
      id: 'ws19_cartographers_last_blank', order: 19, tier: 'ramble',
      title: 'The Cartographer\'s Last Blank',
      npc: { name: 'Scribe Inkwing', role: 'Jackdaw Archivist of the Academy Library' },
      intro: 'The county map is finished, walker. Every lane, every stile, every proud little bridge — except ONE way, this one, the last blank on the parchment. Sage Oakfeather and I have argued three days about what\'s down it. Settle us. Walk the blank.',
      milestone: 'You\'re drawing the map with your boots now — the realm\'s own chart, painted the way the free counties paint their lieges\' colours. A map with no blanks is a realm with no excuses.',
      outro: 'The blank is FILLED, the map complete, and Oakfeather was wrong about the bridge, which matters to me enormously. The first complete county map since the darkness — your road finished it. Merlin\'s own focus for the walker who closed the chart. And the essay for your folio: how a painted realm thinks.',
      scroll: {
        id: 'folio_19_the_painted_realm',
        title: 'The Painted Realm',
        text: 'Study a finished county map and you study the realm\'s mind. The border inked in the realm\'s colour. Lanes running home to the capital. And when counties swear to a duchy or a kingdom, the atlas paints their lands in the liege\'s own hue — one colour per crown, so a glance tells you who keeps faith with whom. Lone counties stay unpainted, and rightly: the colours are the REWARD for uniting the realm. An unpainted land is not unclaimed. It is unfinished. Walkers finish it.'
      },
      reward: { coins: 180, xp: 200, gear: { merlins_focus: 1 }, materials: { ancient_rune: 1 } }
    },
    {
      id: 'ws20_twentieth_road', order: 20, tier: 'trek',
      title: 'The Twentieth Road',
      npc: { name: 'Elder Bramblewing', role: 'Keeper of the Cradle Village' },
      intro: 'So. The twentieth road. They\'re all here, walker — the Captain, the Scribe, the Sage, the Quartermaster, Marla with the kettle, even Tam. Nineteen roads you\'ve walked for us. This last one you walk for yourself, and we walk the ends of it with you. Merlin is watching, you know. He always was.',
      milestone: 'Every road you\'ve walked is part of this one — the lamps, the bell, the beacon, the border-stone. A realm isn\'t freed by one great deed. It\'s freed by twenty ordinary ones, done anyway. On you go. We\'re right behind you.',
      outro: 'Done. Twenty roads, walked whole, and the realm between them awake and singing. Kneel — no, don\'t kneel, you\'re taller than me, this is awkward — WALKER OF THE TWENTY ROADS, the free realm thanks you. The Heart of the Sky, an ember that never cools, and one last letter. He wrote it himself. Read it somewhere quiet.',
      scroll: {
        id: 'folio_20_merlins_letter',
        title: 'Merlin\'s Letter to the Walker',
        text: 'I threw my spell-tablet across the whole of the multiverse, and of every soul in your world it woke for you. I have never once wondered whether it chose well. You have walked twenty roads for a kingdom you have never seen, and at the end of every one of them, my realm grew a little lighter — the lamps, the bell, the beacon, the map. These are the deeds empires are quietly made of. Rest your boots tonight. Then, when you\'re ready: the dark map is wide, walker, and the roads of it are endless, and I find I am no longer afraid of that. Not since you started walking. — M.'
      },
      reward: { coins: 300, xp: 350, gear: { heart_of_sky: 1 }, materials: { phoenix_ember: 1 }, items: { xp_scroll_greater: 2 } }
    }
  ];

  const STORIES_BY_ID = {};
  WALKING_STORIES.forEach(s => { STORIES_BY_ID[s.id] = s; });

  function walkingStoryById(id) { return STORIES_BY_ID[id] || null; }

  function normaliseCompletedIds(completedIds) {
    const seen = {};
    (Array.isArray(completedIds) ? completedIds : []).forEach(id => { if (STORIES_BY_ID[id]) seen[id] = true; });
    return seen;
  }

  // The same walk size always yields the same tale for the same progress:
  // the first untold story of the walk's tier, in campaign order. A walker
  // who has finished a whole tier falls through to the first untold story of
  // any tier, so the campaign can always be completed on the roads you have.
  function nextWalkingStory(lengthM, completedIds) {
    const done = normaliseCompletedIds(completedIds);
    const tier = storyTierForLength(lengthM);
    const inTier = WALKING_STORIES.find(s => s.tier === tier && !done[s.id]);
    if (inTier) return inTier;
    return WALKING_STORIES.find(s => !done[s.id]) || null;
  }

  function walkingStoryProgress(completedIds) {
    const done = normaliseCompletedIds(completedIds);
    const doneCount = Object.keys(done).length;
    const byTier = {};
    Object.keys(STORY_TIERS).forEach(tierId => {
      const stories = WALKING_STORIES.filter(s => s.tier === tierId);
      byTier[tierId] = {
        total: stories.length,
        done: stories.filter(s => done[s.id]).length,
        next: stories.find(s => !done[s.id]) || null
      };
    });
    return { total: WALKING_STORIES.length, done: doneCount, complete: doneCount >= WALKING_STORIES.length, byTier: byTier };
  }

  // Story beats ride on the quest's own ordered waymarkers, so they need no
  // new checkpoint kinds and cannot upset ordered-marker progression. The
  // milestone beat lands mid-list; the lore scroll waits at the last plain
  // flag before the home stretch. Chest checkpoints are never used — their
  // reach events are claim intents, not arrivals.
  function walkingStoryCheckpointPlan(checkpoints) {
    const flags = [];
    (Array.isArray(checkpoints) ? checkpoints : []).forEach((cp, i) => {
      if (cp && cp.kind === 'flag') flags.push(i);
    });
    if (!flags.length) return { milestoneAtIndex: null, scrollAtIndex: null };
    if (flags.length === 1) return { milestoneAtIndex: null, scrollAtIndex: flags[0] };
    return {
      milestoneAtIndex: flags[Math.floor((flags.length - 1) / 2)],
      scrollAtIndex: flags[flags.length - 1]
    };
  }

  // Stamp a tale onto a freshly built walking quest. The full text travels on
  // the quest itself, so a saved adventure still tells its story even if the
  // catalogue changes in a later release.
  function attachWalkingStory(quest, story) {
    if (!quest || !story || !STORIES_BY_ID[story.id]) return null;
    const plan = walkingStoryCheckpointPlan(quest.checkpoints);
    quest.story = {
      campaign: CAMPAIGN.id,
      id: story.id,
      order: story.order,
      total: WALKING_STORIES.length,
      title: story.title,
      tier: story.tier,
      npcName: story.npc.name,
      npcRole: story.npc.role,
      intro: story.intro,
      milestone: story.milestone,
      outro: story.outro,
      scroll: { id: story.scroll.id, title: story.scroll.title, text: story.scroll.text },
      reward: JSON.parse(JSON.stringify(story.reward)),
      milestoneAtIndex: plan.milestoneAtIndex,
      scrollAtIndex: plan.scrollAtIndex,
      scrollCollected: false
    };
    quest.npcName = story.npc.name;
    return quest.story;
  }

  // Every reward id must resolve against the live catalogues. Throws on the
  // first bad id; returns totals so tests can assert the campaign's shape.
  function validateWalkingStories(resolvers) {
    resolvers = resolvers || {};
    const ids = {};
    const orders = {};
    const scrollIds = {};
    let gearCount = 0, materialCount = 0, itemCount = 0;
    WALKING_STORIES.forEach(story => {
      if (ids[story.id]) throw new Error('Duplicate story id: ' + story.id);
      ids[story.id] = true;
      if (orders[story.order]) throw new Error('Duplicate story order: ' + story.order);
      orders[story.order] = true;
      if (!STORY_TIERS[story.tier]) throw new Error('Unknown tier on ' + story.id);
      ['title', 'intro', 'milestone', 'outro'].forEach(key => {
        if (!String(story[key] || '').trim()) throw new Error('Missing ' + key + ' on ' + story.id);
      });
      if (!story.npc || !String(story.npc.name || '').trim() || !String(story.npc.role || '').trim()) {
        throw new Error('Missing NPC on ' + story.id);
      }
      if (!story.scroll || !String(story.scroll.id || '').trim() ||
          !String(story.scroll.title || '').trim() || !String(story.scroll.text || '').trim()) {
        throw new Error('Missing scroll on ' + story.id);
      }
      if (scrollIds[story.scroll.id]) throw new Error('Duplicate scroll id: ' + story.scroll.id);
      scrollIds[story.scroll.id] = true;
      const reward = story.reward || {};
      if (!(Number(reward.coins) > 0) || !(Number(reward.xp) > 0)) throw new Error('Missing coins/xp on ' + story.id);
      Object.keys(reward.gear || {}).forEach(id => {
        gearCount += reward.gear[id];
        if (typeof resolvers.gearExists === 'function' && !resolvers.gearExists(id)) throw new Error('Unknown gear: ' + id + ' on ' + story.id);
      });
      Object.keys(reward.materials || {}).forEach(id => {
        materialCount += reward.materials[id];
        if (typeof resolvers.materialExists === 'function' && !resolvers.materialExists(id)) throw new Error('Unknown material: ' + id + ' on ' + story.id);
      });
      Object.keys(reward.items || {}).forEach(id => {
        itemCount += reward.items[id];
        if (typeof resolvers.itemExists === 'function' && !resolvers.itemExists(id)) throw new Error('Unknown item: ' + id + ' on ' + story.id);
      });
      if (!Object.keys(reward.gear || {}).length) throw new Error('Every tale pays real gear: ' + story.id);
    });
    for (let order = 1; order <= WALKING_STORIES.length; order++) {
      if (!orders[order]) throw new Error('Missing story order: ' + order);
    }
    return { stories: WALKING_STORIES.length, gearCount: gearCount, materialCount: materialCount, itemCount: itemCount };
  }

  return {
    CAMPAIGN: CAMPAIGN,
    STORY_TIERS: STORY_TIERS,
    WALKING_STORIES: WALKING_STORIES,
    storyTierForLength: storyTierForLength,
    walkingStoryById: walkingStoryById,
    nextWalkingStory: nextWalkingStory,
    walkingStoryProgress: walkingStoryProgress,
    walkingStoryCheckpointPlan: walkingStoryCheckpointPlan,
    attachWalkingStory: attachWalkingStory,
    validateWalkingStories: validateWalkingStories
  };
});
