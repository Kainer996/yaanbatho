// Burbz Bird Family Core v1
// Real-bird family labels, overlapping gameplay tags, and deterministic
// three-of-a-kind squad synergies. Pure UMD module: no DOM and no saved state.
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzBirdFamilyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const MEGA_BONUS_PCT = 0.25;

  function family(id, label, icon, color, stat, bonusLabel) {
    return { id, label, icon, color, bonus:{ stat, pct:MEGA_BONUS_PCT, label:bonusLabel } };
  }

  const FAMILY_TYPES = {
    birds_of_prey: family('birds_of_prey','Birds of Prey','🦅','#ef725f','atk','Raptor Power'),
    corvid: family('corvid','Corvids','🐦‍⬛','#a98bdc','mag','Corvid Conspiracy'),
    falcon: family('falcon','Falcons','🪶','#f29a5b','spd','Falcon Flight'),
    eagle_hawk: family('eagle_hawk','Eagles & Hawks','🦅','#d86a4e','atk','Talon Formation'),
    owl: family('owl','Owls','🦉','#9d87c8','mag','Silent Parliament'),
    vulture: family('vulture','Vultures','🪶','#bd855a','maxHp','Soaring Endurance'),
    parrot: family('parrot','Parrots','🦜','#4fc99a','cha','Parrot Chorus'),
    pigeon_dove: family('pigeon_dove','Pigeons & Doves','🕊️','#9aa9c8','def','Homeward Guard'),
    waterfowl: family('waterfowl','Waterfowl','🦆','#4b9fe1','maxHp','Waterfowl Armada'),
    wader: family('wader','Waders','🐦','#62b9c5','spd','Tidal Step'),
    seabird: family('seabird','Seabirds','🌊','#5e8ed8','maxHp','Ocean Squadron'),
    heron_stork: family('heron_stork','Herons & Storks','🐦','#63aeb2','atk','Stillwater Strike'),
    rail: family('rail','Rails & Crakes','🐦','#809d62','def','Reedbed Guard'),
    gamebird: family('gamebird','Gamebirds','🪶','#b38a50','def','Ground Formation'),
    woodpecker: family('woodpecker','Woodpeckers','🐦','#cf6d55','atk','Drumming Force'),
    kingfisher: family('kingfisher','Kingfishers','🐦','#35b5ca','spd','River Flash'),
    swallow_swift: family('swallow_swift','Swallows & Swifts','🪽','#42c8b4','spd','Aerial Ballet'),
    finch: family('finch','Finches','🎵','#e1b94d','cha','Finch Chorus'),
    thrush: family('thrush','Thrushes','🎵','#c98a61','mag','Woodland Song'),
    tit: family('tit','Tits & Chickadees','🎵','#68a9db','spd','Flock Agility'),
    warbler: family('warbler','Warblers','🎵','#7bb46a','mag','Warbler Chorus'),
    sparrow: family('sparrow','Sparrows','🐦','#b69869','def','Hedge Alliance'),
    starling_myna: family('starling_myna','Starlings & Mynas','✨','#7e91b8','cha','Mimic Chorus'),
    wagtail_pipit: family('wagtail_pipit','Wagtails & Pipits','🐦','#86a0a8','spd','Tailwind Step'),
    wren: family('wren','Wrens','🎵','#b47c55','mag','Tiny Thunder'),
    lark: family('lark','Larks','🎵','#c5a65d','cha','Skylark Anthem'),
    cuckoo: family('cuckoo','Cuckoos','🐦','#9a79b6','mag','Cuckoo Cunning'),
    nightbird: family('nightbird','Nightbirds','🌙','#6f79a6','spd','Night Flight'),
    hummingbird: family('hummingbird','Hummingbirds','✨','#40c7af','spd','Hummingbird Rush'),
    crane_flamingo: family('crane_flamingo','Cranes & Flamingos','🐦','#dc88a5','def','Long-Leg Formation'),
    hornbill_toucan: family('hornbill_toucan','Hornbills & Toucans','🐦','#e88b45','atk','Great-Bill Brigade'),
    groundbird: family('groundbird','Ground Birds','🐦','#9e8558','maxHp','Grounded Resolve'),
    songbird: family('songbird','Songbirds','🎵','#5e9fd2','cha','Dawn Chorus')
  };

  const FAMILY_ORDER = [
    'birds_of_prey','corvid','falcon','eagle_hawk','owl','vulture','parrot',
    'pigeon_dove','waterfowl','wader','seabird','heron_stork','rail','gamebird',
    'woodpecker','kingfisher','swallow_swift','finch','thrush','tit','warbler',
    'sparrow','starling_myna','wagtail_pipit','wren','lark','cuckoo','nightbird',
    'hummingbird','crane_flamingo','hornbill_toucan','groundbird','songbird'
  ];

  function speciesKey(name) {
    return String(name || '').toLowerCase().replace(/\(.*?\)/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  const OVERRIDES = {
    magpie_lark:'wagtail_pipit', australian_magpie:'corvid', eurasian_magpie:'corvid',
    black_billed_magpie:'corvid', yellow_billed_magpie:'corvid',
    merlin:'falcon', osprey:'eagle_hawk', secretarybird:'eagle_hawk',
    tawny_frogmouth:'nightbird', laughing_kookaburra:'kingfisher',
    bush_stone_curlew:'wader', hardhead:'waterfowl', kakapo:'parrot',
    common_myna:'starling_myna', asian_koel:'cuckoo', great_frigatebird:'seabird'
  };

  const RULES = [
    ['falcon',['falcon','kestrel','merlin','hobby','caracara','gyrfalcon']],
    ['eagle_hawk',['eagle','hawk','goshawk','sparrowhawk','harrier','buzzard','kite','osprey','secretarybird']],
    ['owl',['owl','boobook','morepork']],
    ['vulture',['vulture','condor']],
    ['corvid',['crow','raven','magpie','jackdaw','rook','jay','chough','nutcracker','currawong']],
    ['parrot',['parrot','parakeet','macaw','cockatoo','corella','galah','rosella','lorikeet','budgerigar','cockatiel','kea','kakapo']],
    ['pigeon_dove',['pigeon','dove','bronzewing','woodpigeon','turtledove']],
    ['waterfowl',['duck','mallard','teal','wigeon','pintail','shoveler','pochard','goldeneye','eider','shelduck','goosander','merganser','gadwall','garganey','smew','scoter','scaup','swan','goose','grebe']],
    ['heron_stork',['heron','egret','bittern','stork','ibis','spoonbill','pelican','shoebill','hamerkop']],
    ['rail',['rail','crake','coot','moorhen','swamphen','gallinule']],
    ['wader',['curlew','whimbrel','godwit','snipe','woodcock','sandpiper','plover','lapwing','killdeer','oystercatcher','avocet','turnstone','dunlin','sanderling','knot','stint','stilt','redshank','greenshank','phalarope','jacana']],
    ['seabird',['gull','kittiwake','fulmar','shearwater','petrel','gannet','booby','albatross','penguin','puffin','razorbill','guillemot','auk','loon','diver','tern','skimmer','cormorant','shag','darter','anhinga','frigatebird','skua']],
    ['crane_flamingo',['crane','flamingo']],
    ['gamebird',['pheasant','partridge','quail','grouse','ptarmigan','peafowl','turkey','junglefowl','guineafowl']],
    ['woodpecker',['woodpecker','flicker','sapsucker','wryneck']],
    ['kingfisher',['kingfisher','kookaburra']],
    ['swallow_swift',['swallow','swift','martin','needletail','treeswift','woodswallow']],
    ['hummingbird',['hummingbird']],
    ['finch',['finch','goldfinch','greenfinch','chaffinch','redpoll','siskin','hawfinch','crossbill','bullfinch','canary']],
    ['thrush',['thrush','blackbird','redwing','fieldfare','robin','wheatear','stonechat','whinchat','bluebird']],
    ['tit',['tit','chickadee','bushtit']],
    ['warbler',['warbler','chiffchaff','blackcap','whitethroat','goldcrest','firecrest']],
    ['sparrow',['sparrow','dunnock','towhee','junco']],
    ['starling_myna',['starling','myna','mynah','mockingbird','lyrebird']],
    ['wagtail_pipit',['wagtail','pipit']],
    ['wren',['wren']],
    ['lark',['lark']],
    ['cuckoo',['cuckoo','koel','roadrunner']],
    ['nightbird',['nightjar','frogmouth','potoo']],
    ['hornbill_toucan',['hornbill','toucan']],
    ['groundbird',['ostrich','emu','cassowary','rhea','kiwi','bustard','tinamou']],
  ];

  function classifyBirdFamily(name) {
    const key = speciesKey(name);
    const overridden = OVERRIDES[key];
    if (overridden) return FAMILY_TYPES[overridden];
    const tokens = key.split('_').filter(Boolean);
    for (const [id, words] of RULES) {
      if (words.some(word => tokens.includes(word) || key.includes(word + '_') || key.endsWith('_' + word))) {
        return FAMILY_TYPES[id];
      }
    }
    return FAMILY_TYPES.songbird;
  }

  function birdTypeTags(name) {
    const primary = classifyBirdFamily(name).id;
    const tags = [primary];
    if (['falcon','eagle_hawk','owl','vulture'].includes(primary)) tags.push('birds_of_prey');
    return tags;
  }

  function familyForTag(id) { return FAMILY_TYPES[id] || FAMILY_TYPES.songbird; }

  function detectTeamSynergies(fighters) {
    const team = (fighters || []).filter(Boolean);
    const primaryCounts = new Map();
    team.forEach(f => {
      const primary = f.family || classifyBirdFamily(f.species || f.name).id;
      primaryCounts.set(primary, (primaryCounts.get(primary) || 0) + 1);
    });
    const specific = FAMILY_ORDER.filter(id => id !== 'birds_of_prey' && (primaryCounts.get(id) || 0) >= 3);
    const selected = specific.length ? specific : ['birds_of_prey'].filter(id =>
      team.filter(f => (f.typeTags || birdTypeTags(f.species || f.name)).includes(id)).length >= 3
    );
    return selected.map(id => {
      const meta = familyForTag(id);
      const memberIds = team.filter(f => (f.typeTags || birdTypeTags(f.species || f.name)).includes(id)).map(f => f.id);
      return {
        id, label:meta.label, icon:meta.icon, color:meta.color,
        bonus:{ ...meta.bonus }, memberCount:memberIds.length, memberIds,
        mega:true, title:meta.bonus.label + ' · MEGA BONUS',
        copy:'Three matching ' + meta.label.toLowerCase() + ' grant the whole squad +' + Math.round(meta.bonus.pct * 100) + '% ' + meta.bonus.stat.toUpperCase() + '.'
      };
    });
  }

  function applyTeamSynergies(fighters) {
    const team = (fighters || []).filter(Boolean);
    const synergies = detectTeamSynergies(team);
    synergies.forEach(synergy => {
      const stat = synergy.bonus.stat;
      team.forEach(f => {
        f.synergyBonuses = Array.isArray(f.synergyBonuses) ? f.synergyBonuses : [];
        if (f.synergyBonuses.includes(synergy.id)) return;
        if (stat === 'maxHp') {
          const oldMax = Math.max(1, Number(f.maxHp) || 1);
          const hpRatio = Math.max(0, Math.min(1, (Number(f.hp) || 0) / oldMax));
          f.maxHp = Math.round(oldMax * (1 + synergy.bonus.pct));
          f.hp = Math.round(f.maxHp * hpRatio);
        } else {
          f[stat] = Math.round((Number(f[stat]) || 0) * (1 + synergy.bonus.pct));
        }
        f.synergyBonuses.push(synergy.id);
      });
    });
    return synergies;
  }

  return {
    MEGA_BONUS_PCT, FAMILY_TYPES, FAMILY_ORDER, speciesKey,
    classifyBirdFamily, birdTypeTags, familyForTag,
    detectTeamSynergies, applyTeamSynergies
  };
});
