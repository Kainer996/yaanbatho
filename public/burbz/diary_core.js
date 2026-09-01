// Adventurer's Diary core — the chronicle of everything the player has done.
// Pure logic only (no DOM): the diary state lives in gameState.diary, gameplay
// code appends typed events, and this module turns those events into an
// RPG-storybook diary — day chapters, Merlin's prose summaries and a
// "story so far" front page — so players never lose track of where they're up to.
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzDiaryCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // Enough history for weeks of play without letting the save grow unbounded.
  const DIARY_ENTRY_LIMIT = 400;

  const DIARY_EVENT_TYPES = [
    'discover',   // a new species entered the Birdex
    'recruit',    // a bird joined the flock
    'level_up',   // the trainer levelled up
    'bird_level', // a companion levelled up
    'battle',     // a liberation or legacy solo battle ended
    'village',    // a liberated town received its sanctuary birdhouse
    'walk_quest', // a real-world walking quest was completed
    'side_quest', // a free-exploration side quest was ended
    'expedition', // a bird expedition was claimed
    'clue',       // a Merlin story clue was found
    'quest_claim',// a daily/weekly/achievement quest reward was claimed
    'craft',      // gear forged at the Fletcher's Forge
    'badge',      // a badge was earned
    'meal'        // a species' diet was mastered at the Kitchen
  ];

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function ordinal(n) {
    const v = n % 100;
    if (v >= 11 && v <= 13) return n + 'th';
    const last = n % 10;
    return n + (last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th');
  }

  function countWord(n, singular, plural) {
    const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
    const word = n >= 0 && n < words.length ? words[n] : String(n);
    return word + ' ' + (n === 1 ? singular : (plural || singular + 's'));
  }

  function fmtKm(km) {
    const n = Number(km) || 0;
    return (Math.round(n * 100) / 100).toFixed(n >= 10 ? 1 : 2).replace(/\.?0+$/, '') || '0';
  }

  // Deterministic template pick keyed off the entry timestamp so a diary line
  // never changes wording between renders, but neighbouring lines vary.
  function pick(list, seed) {
    if (!Array.isArray(list) || !list.length) return '';
    return list[Math.abs(Math.floor(Number(seed) || 0)) % list.length];
  }

  function sanitizeDiaryState(raw) {
    const diary = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const entries = Array.isArray(diary.entries) ? diary.entries : [];
    diary.entries = entries
      .filter(e => e && typeof e === 'object' && Number.isFinite(Number(e.t)) && typeof e.type === 'string' && e.type)
      .sort((a, b) => Number(a.t) - Number(b.t));
    if (diary.entries.length > DIARY_ENTRY_LIMIT) diary.entries = diary.entries.slice(-DIARY_ENTRY_LIMIT);
    return diary;
  }

  function appendDiaryEvent(diary, event, now) {
    if (!diary || typeof diary !== 'object') return null;
    if (!event || typeof event !== 'object' || typeof event.type !== 'string' || !event.type) return null;
    if (!Array.isArray(diary.entries)) diary.entries = [];
    const entry = { ...event, t: Number.isFinite(Number(now)) ? Number(now) : Number(event.t) || 0 };
    diary.entries.push(entry);
    if (diary.entries.length > DIARY_ENTRY_LIMIT) diary.entries.splice(0, diary.entries.length - DIARY_ENTRY_LIMIT);
    return entry;
  }

  function diaryDayKey(t) {
    const d = new Date(Number(t) || 0);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function diaryDayHeading(dayKey, now) {
    const parts = String(dayKey || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(p => !Number.isFinite(p))) return String(dayKey || '');
    const label = 'the ' + ordinal(parts[2]) + ' of ' + (MONTHS[parts[1] - 1] || '?') + ', ' + parts[0];
    if (Number.isFinite(Number(now))) {
      const DAY = 24 * 60 * 60 * 1000;
      if (dayKey === diaryDayKey(now)) return 'Today · ' + label;
      if (dayKey === diaryDayKey(Number(now) - DAY)) return 'Yesterday · ' + label;
    }
    return label;
  }

  // Newest day first (a diary is read backwards), entries within a day in the
  // order they happened so each chapter reads as the day unfolding.
  function groupEntriesByDay(entries) {
    const byDay = new Map();
    (Array.isArray(entries) ? entries : []).forEach(e => {
      if (!e || !Number.isFinite(Number(e.t))) return;
      const key = diaryDayKey(e.t);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(e);
    });
    return [...byDay.entries()]
      .map(([key, dayEntries]) => ({ key, entries: dayEntries.sort((a, b) => Number(a.t) - Number(b.t)) }))
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  }

  const RARITY_FLOURISH = {
    rare: 'A rare find — ',
    epic: 'The quill trembled with excitement — ',
    legendary: 'Let it be written in gold: '
  };

  function formatDiaryLine(entry) {
    const e = entry || {};
    const seed = Number(e.t) || 0;
    const species = e.species || 'a mysterious bird';
    switch (e.type) {
      case 'discover': {
        // The rarity flourish already announces rare/epic/legendary, so only
        // sentences without one work the rarity into the description itself.
        const described = (!RARITY_FLOURISH[e.rarity] && e.rarity && e.rarity !== 'common' ? e.rarity + ' ' : '') + species;
        const article = /^[aeiou]/i.test(described) ? 'An' : 'A';
        const text = pick([
          article + ' ' + described + ' revealed itself to the tablet’s magic — a new species inscribed in the Birdex.',
          'New wings over the realm: the ' + species + ', never before seen, sang its name into the chronicle.',
          'The tablet stirred and glowed — the ' + species + ' has been discovered and recorded.'
        ], seed);
        const flourish = RARITY_FLOURISH[e.rarity] || '';
        return { icon: '🐦', text: flourish ? flourish + text.charAt(0).toLowerCase() + text.slice(1) : text };
      }
      case 'recruit':
        return { icon: '🪶', text: pick([
          'The ' + species + ' swore the oath at the Barracks and joined the flock' + (e.cost ? ' for ' + e.cost + ' coins' : '') + '.',
          'A new companion: the ' + species + ' now flies at the chosen one’s side' + (e.cost ? ' (' + e.cost + ' coins well spent)' : '') + '.'
        ], seed) };
      case 'level_up':
        return { icon: '👑', text: pick([
          'The chosen one rose to Level ' + (e.level || '?') + (e.title ? ' — the realm now whispers the title “' + e.title + '”.' : '.'),
          'Strength grows: Level ' + (e.level || '?') + ' attained' + (e.title ? ', worthy of the name “' + e.title + '”.' : '.')
        ], seed) };
      case 'bird_level':
        return { icon: '🎓', text: pick([
          'The ' + species + ' trained hard and reached Level ' + (e.level || '?') + '.',
          'Sharper talons, keener eyes — the ' + species + ' rose to Level ' + (e.level || '?') + '.'
        ], seed) };
      case 'battle': {
        if (e.liberated) return { icon: '🕊️', text: 'The squad shattered the garrison of ' + e.liberated + ' Village — another village freed from the evil Burbz!' };
        if (e.won) {
          const base = pick([
            'Victory in the ' + (e.tier || 'battle') + ' — the shadow retreats a little further.',
            'The flock fought upon the ' + (e.tier || 'league') + ' perch and carried the day.'
          ], seed);
          return { icon: '🏆', text: base + (e.promoted ? ' Promoted to a higher perch!' : '') };
        }
        return { icon: '🪶', text: pick([
          'Defeat in the ' + (e.tier || 'battle') + '. The flock returned bruised, but unbowed.',
          'The evil Burbz held the ' + (e.tier || 'league') + ' perch this day — the flock will heal, and return.'
        ], seed) };
      }
      case 'village':
        return { icon: '🏰', text: 'A sanctuary birdhouse was raised in ' + (e.name || 'a freed village') + (e.count ? ' — ' + countWord(e.count, 'village now stands', 'villages now stand') + ' free in the empire.' : '.') };
      case 'walk_quest':
        return { icon: '🥾', text: 'The trail “' + (e.name || 'a walking quest') + '” was walked to its end — ' + fmtKm(e.km) + ' km' +
          (Number.isFinite(Number(e.markersTotal)) && e.markersTotal > 0 ? ', ' + (e.markers || 0) + '/' + e.markersTotal + ' waymarkers' : '') +
          (e.xp ? ', ' + e.xp + ' XP earned' : '') + '.' };
      case 'side_quest':
        return { icon: '🧭', text: 'A wander into the unknown: ' + fmtKm(e.km) + ' km charted off the beaten path' +
          (Number(e.discoveries) > 0 ? ', with ' + countWord(Number(e.discoveries), 'discovery', 'discoveries') + ' stumbled upon' : '') + '.' };
      case 'expedition':
        return { icon: '🎒', text: (e.bird || 'A companion') + ' returned from “' + (e.quest || 'an expedition') + '”' +
          (e.coins ? ' bearing ' + e.coins + ' coins' : ' with tales to tell') + (e.xp ? ' (+' + e.xp + ' XP)' : '') + '.' };
      case 'clue':
        return { icon: '📜', text: 'A fragment of Merlin’s tale came to light: “' + (e.title || 'a hidden clue') + '”.' };
      case 'quest_claim':
        return { icon: '📯', text: 'The ' + (e.kind || '') + (e.kind ? ' ' : '') + 'charge “' + (e.name || 'a quest') + '” was fulfilled and its reward claimed.' };
      case 'craft':
        return { icon: '⚒️', text: pick([
          'At the Fletcher’s Forge, ' + (e.item || 'a piece of gear') + ' was hammered into being.',
          'Sparks flew at the Forge — ' + (e.item || 'new gear') + ' now awaits a worthy wing.'
        ], seed) };
      case 'badge':
        return { icon: '🎖️', text: 'A badge of honour was bestowed: ' + (e.name || 'a new badge') + '.' };
      case 'meal':
        return { icon: '🍽️', text: 'A field-perfect meal was served at the Kitchen — the diet of the ' + species + ' is now mastered.' };
      default:
        return { icon: '✒️', text: 'Something noteworthy happened, though the ink has smudged.' };
    }
  }

  // A short prose summary of one day's entries — the italic line under each
  // chapter heading, written as if Merlin reviewed the day each evening.
  function composeDayChronicle(entries) {
    const list = Array.isArray(entries) ? entries : [];
    const count = type => list.filter(e => e && e.type === type).length;
    const discoveries = count('discover');
    const recruits = count('recruit');
    const battles = list.filter(e => e && e.type === 'battle');
    const wins = battles.filter(e => e.won).length;
    const liberated = battles.filter(e => e.liberated).map(e => e.liberated);
    const walks = list.filter(e => e && (e.type === 'walk_quest' || e.type === 'side_quest'));
    const km = walks.reduce((sum, e) => sum + (Number(e.km) || 0), 0);
    const questsDone = count('quest_claim') + count('expedition');
    const crafts = count('craft');

    const parts = [];
    if (discoveries) parts.push(countWord(discoveries, 'new species', 'new species') + ' entered the Birdex');
    if (recruits) parts.push(countWord(recruits, 'bird') + ' joined the flock');
    if (battles.length) parts.push(countWord(battles.length, 'battle') + ' ' + (battles.length === 1 ? 'was' : 'were') + ' fought against the evil Burbz' + (wins ? ' (' + (wins === battles.length ? (battles.length === 1 ? 'won' : 'all won') : wins + ' won') + ')' : ' (none won — yet)'));
    if (liberated.length) parts.push('the village' + (liberated.length === 1 ? '' : 's') + ' of ' + liberated.join(' and ') + ' ' + (liberated.length === 1 ? 'was' : 'were') + ' freed');
    if (km > 0) parts.push(fmtKm(km) + ' km ' + (walks.length === 1 ? 'was' : 'were') + ' walked under open sky');
    if (questsDone) parts.push(countWord(questsDone, 'quest') + ' ' + (questsDone === 1 ? 'was' : 'were') + ' seen through');
    if (crafts) parts.push(countWord(crafts, 'treasure') + ' ' + (crafts === 1 ? 'was' : 'were') + ' forged');

    if (!parts.length) return 'A quiet day of watching and waiting — even heroes must rest.';
    let prose;
    if (parts.length === 1) prose = parts[0];
    else prose = parts.slice(0, -1).join('; ') + '; and ' + parts[parts.length - 1];
    prose = 'This day, ' + prose + '.';
    return prose.charAt(0).toUpperCase() + prose.slice(1);
  }

  // The illuminated front page: who the hero has become, in one paragraph.
  function diaryStorySoFar(entries, totals) {
    const t = totals || {};
    const list = Array.isArray(entries) ? entries : [];
    const name = t.name || 'the chosen one';
    const opening = 'Here begins the chronicle of ' + name +
      (t.title ? ', ' + t.title : '') +
      (t.level ? ' of Level ' + t.level : '') +
      ', summoned across the multiverse to free the Kingdom of Burbz from the shadow.';
    const deeds = [];
    if (Number(t.discovered) > 0) deeds.push(String(t.discovered) + ' species discovered');
    if (Number(t.companions) > 0) deeds.push(String(t.companions) + ' loyal companion' + (t.companions === 1 ? '' : 's'));
    if (Number(t.towns) > 0) deeds.push(String(t.towns) + ' village' + (t.towns === 1 ? '' : 's') + ' liberated');
    if (Number(t.wins) > 0) deeds.push(String(t.wins) + ' ' + (t.wins === 1 ? 'victory' : 'victories') + ' over the evil Burbz');
    const middle = deeds.length
      ? ' Thus far the record shows ' + (deeds.length === 1 ? deeds[0] : deeds.slice(0, -1).join(', ') + ' and ' + deeds[deeds.length - 1]) + '.'
      : ' The pages that follow await their first great deed.';
    const first = list.length ? ' The tale begins on ' + diaryDayHeading(diaryDayKey(list[0].t)) + '.' : '';
    return opening + middle + first + ' Penned faithfully in Merlin’s own quill-hand, that no deed be forgotten.';
  }

  return {
    DIARY_ENTRY_LIMIT,
    DIARY_EVENT_TYPES,
    sanitizeDiaryState,
    appendDiaryEvent,
    diaryDayKey,
    diaryDayHeading,
    groupEntriesByDay,
    formatDiaryLine,
    composeDayChronicle,
    diaryStorySoFar
  };
});
