importScripts('./uk_bird_expansion_50.js?v=uk50-source-backed-20260713');
importScripts('./uk_bird_expansion_2.js?v=uk26-source-backed-20260713');
importScripts('./au_bird_expansion.js?v=au-source-backed-20260713');
importScripts('./uk_bird_expansion_3.js?v=uk-regular-completion-20260715');
importScripts('./au_bird_expansion_2.js?v=au50-source-backed-r2-20260715');
importScripts('./national_bird_completion_20260715.js?v=national-completion-20260715');
importScripts('./uk_bird_expansion_4.js?v=uk-british-list-completion-20260722');

const BURBZ_CACHE = 'burbz-kitchen-pantry-v105-20260722';
const UK50_SW = self.BURBZ_UK_BIRD_EXPANSION_50;
const UK26_SW = self.BURBZ_UK_BIRD_EXPANSION_26;
const AU_SW = self.BURBZ_AU_BIRD_EXPANSION;
const UK_FINAL_SW = self.BURBZ_UK_BIRD_EXPANSION_FINAL;
const AU50_SW = self.BURBZ_AU_BIRD_EXPANSION_50;
const NATIONAL_SW = self.BURBZ_NATIONAL_BIRD_COMPLETION_20260715;
const UK4_SW = self.BURBZ_UK_BIRD_EXPANSION_4;
// Wave-4 placeholder art is lightweight local SVG (no PNG cutout counterpart).
const UK4_ART = UK4_SW ? Object.values(UK4_SW.art) : [];
const BIRD_ART_GITHUB_RAW_BASE = 'https://github.com/Kainer996/yaanbatho/raw/refs/heads/main';
const ALL_EXPANSION_ART = { ...UK50_SW.art, ...UK26_SW.art, ...AU_SW.art };
const NEW_LOCAL_PLACEHOLDER_ART = { ...UK_FINAL_SW.art, ...AU50_SW.art };
const UK50_REMOTE_ART = Object.values(ALL_EXPANSION_ART).map(path =>
  BIRD_ART_GITHUB_RAW_BASE + path.replace(/^\/burbz\//, '/public/burbz/')
);
const UK50_REMOTE_CUTOUTS = Object.values(ALL_EXPANSION_ART).map(path => {
  const filename = path.split('/').pop().replace(/\.png$/i, '_cutout.png');
  return BIRD_ART_GITHUB_RAW_BASE + '/public/burbz/bird-art-cache/cutouts/' + filename;
});
const NEW_LOCAL_ART = Object.values(NEW_LOCAL_PLACEHOLDER_ART);
const NEW_LOCAL_CUTOUTS = NEW_LOCAL_ART.map(path => {
  const filename = path.split('/').pop().replace(/\.png$/i, '_cutout.png');
  return '/burbz/bird-art-cache/cutouts/' + filename;
});
const BURBZ_ASSETS = [
  './',
  './index.html',
  './lib/three.min.js?v=0.158.0',
  './lib/maplibre-gl.js?v=5.24.0',
  './lib/maplibre-gl.css?v=5.24.0',
  './empire_map_core.js?v=liberation-map-v3-20260714',
  './quest_core.js?v=bird-levelling-20260722',
  './academy_treehouse_core.js?v=kitchen-pantry-20260722',
  './kitchen_pantry_core.js?v=kitchen-pantry-20260722',
  './scan_economy_core.js',
  './sound_listener_core.js?v=merlin-discovery-history-v3-20260716',
  './uk_bird_expansion_50.js?v=uk50-source-backed-20260713',
  './uk_bird_expansion_2.js?v=uk26-source-backed-20260713',
  './au_bird_expansion.js?v=au-source-backed-20260713',
  './uk_bird_expansion_3.js?v=uk-regular-completion-20260715',
  './au_bird_expansion_2.js?v=au50-source-backed-r2-20260715',
  './national_bird_completion_20260715.js?v=national-completion-20260715',
  './uk_bird_expansion_4.js?v=uk-british-list-completion-20260722',
  './spain_boundary_20260715.js?v=spain-mainland-balearics-20260715',
  './data/uk-bird-education-50.json?v=au-source-backed-20260713',
  './data/regional-bird-education-20260715.json?v=regional-birds-v75-20260715',
  './data/national-bird-completion/manifest.json?v=national-completion-20260715',
  './assets/merlin-tutorial.png',
  './assets/ui/quest-compass-emblem.webp',
  './assets/ui/merlin-wand-listener.webp',
  './assets/academy-tree-manga-20260629.png',
  './assets/academy-buildings-manga/aviary-gardens.png',
  './assets/academy-buildings-manga/roost.png',
  './assets/academy-buildings-manga/training-hall.png',
  './assets/academy-buildings-manga/hospital.png',
  './assets/academy-buildings-manga/crowbar.png',
  './assets/academy-buildings-manga/kitchen.png',
  './assets/academy-buildings-manga/workshop.png',
  './assets/academy-buildings-manga/market.png',
  './assets/academy-buildings-manga/nursery.png',
  './assets/academy-buildings-manga/observatory.png',
  './assets/academy-buildings-manga/quest-roost.png',
  './assets/academy-interiors-manga/aviary-gardens.png',
  './assets/academy-interiors-manga/roost.png',
  './assets/academy-interiors-manga/barracks.png',
  './assets/academy-interiors-manga/training-hall.png',
  './assets/academy-interiors-manga/hospital.png',
  './assets/academy-interiors-manga/crowbar.png',
  './assets/academy-interiors-manga/kitchen.png',
  './assets/academy-interiors-manga/workshop.png',
  './assets/academy-interiors-manga/nursery.png',
  './assets/academy-interiors-manga/observatory.png',
  './assets/academy-interiors-manga/quest-roost.png',
  './assets/village-interiors-manga/seed-and-sundry.png',
  './assets/village-interiors-manga/gilded-beak.png',
  './assets/village-interiors-manga/talon-and-anvil.png',
  './assets/village-interiors-manga/puffins-rest.png',
  './assets/village-interiors-manga/birders-guild.png',
  './battle_core.js?v=evil-burbz-squads-20260720',
  './loot_crafting_core.js?v=bird-equip-screen-20260721',
  './audio_core.js?v=medieval-bird-audio-v2-20260721',
  './action_badge_core.js?v=nav-action-badges-v1-20260721',
  './assets/audio/ui-book.mp3',
  './assets/audio/ui-lock.mp3',
  './assets/audio/ui-coins.mp3',
  './assets/audio/ui-wood.mp3',
  './assets/audio/ui-metal.mp3',
  './assets/audio/ui-spell.mp3',
  './assets/audio/reward-level-up.mp3',
  './assets/audio/bird-blackbird.mp3',
  './assets/audio/bird-tawny-owl.mp3',
  './assets/audio/ATTRIBUTION.md',
  './audio-credits.html',
  './manifest.json',
  './privacy.html',
  './assets/evil-burbz/evil-burb-1.png',
  './assets/evil-burbz/evil-burb-2.png',
  './assets/evil-burbz/evil-burb-3.png',
  './assets/evil-burbz/evil-burb-4.png',
  './assets/burbz-logo-yaan-transparent-20260608.png',
  './assets/cutscenes/burbz-intro-30s-seedance-20260629-discord.mp4',
  './assets/cutscenes/burbz-intro-part1-seedance-20260629-discord.mp4',
  './assets/cutscenes/burbz-intro-part2-seedance-20260629-discord.mp4',
  './assets/academy-buildings/aviary-gardens.svg',
  './assets/academy-buildings/crowbar.svg',
  './assets/academy-buildings/hospital.svg',
  './assets/academy-buildings/kitchen.svg',
  './assets/academy-buildings/market.svg',
  './assets/academy-buildings/nursery.svg',
  './assets/academy-buildings/observatory.svg',
  './assets/academy-buildings/roost.svg',
  './assets/academy-buildings/training-hall.svg',
  './assets/academy-buildings/workshop.svg',
  // Melbourne common birds — melbourne_common_20260630
  // Regional plus-20 birds — regional_plus20_20260701
  './data/bird-education.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png'
];
BURBZ_ASSETS.push(...UK50_REMOTE_ART, ...UK50_REMOTE_CUTOUTS, ...NEW_LOCAL_ART, ...NEW_LOCAL_CUTOUTS);
BURBZ_ASSETS.push(...UK4_ART);

// The app shell must cache or the install fails; artwork/video are best-effort
// so one missing file can never knock out offline support for the whole game.
const BURBZ_CORE = [
  './index.html',
  './lib/three.min.js?v=0.158.0',
  // 3D village ground detail (small, and the village looks flat without them)
  './assets/tex/grass_c.jpg',
  './assets/tex/grass_n.jpg',
  './assets/tex/cobble_c.jpg',
  './assets/tex/cobble_n.jpg',
  './academy_treehouse_core.js?v=kitchen-pantry-20260722',
  './kitchen_pantry_core.js?v=kitchen-pantry-20260722',
  './battle_core.js?v=evil-burbz-squads-20260720',
  './loot_crafting_core.js?v=bird-equip-screen-20260721',
  './audio_core.js?v=medieval-bird-audio-v2-20260721',
  './action_badge_core.js?v=nav-action-badges-v1-20260721',
  './assets/audio/ui-book.mp3',
  './assets/audio/ui-lock.mp3',
  './assets/audio/ui-coins.mp3',
  './assets/audio/ui-wood.mp3',
  './assets/audio/ui-metal.mp3',
  './assets/audio/ui-spell.mp3',
  './assets/audio/reward-level-up.mp3',
  './assets/audio/bird-blackbird.mp3',
  './assets/audio/bird-tawny-owl.mp3',
  './assets/audio/ATTRIBUTION.md',
  './audio-credits.html',
  './uk_bird_expansion_50.js?v=uk50-source-backed-20260713',
  './uk_bird_expansion_2.js?v=uk26-source-backed-20260713',
  './au_bird_expansion.js?v=au-source-backed-20260713',
  './uk_bird_expansion_3.js?v=uk-regular-completion-20260715',
  './au_bird_expansion_2.js?v=au50-source-backed-r2-20260715',
  './national_bird_completion_20260715.js?v=national-completion-20260715',
  './uk_bird_expansion_4.js?v=uk-british-list-completion-20260722',
  './spain_boundary_20260715.js?v=spain-mainland-balearics-20260715',
  './data/uk-bird-education-50.json?v=au-source-backed-20260713',
  './data/regional-bird-education-20260715.json?v=regional-birds-v75-20260715',
  './data/national-bird-completion/manifest.json?v=national-completion-20260715',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(BURBZ_CACHE)
      // Only the compact app shell is eager. Large education/art datasets are
      // fetched and cached when the player actually opens them.
      .then(cache => Promise.all(BURBZ_CORE.map(asset =>
        cache.add(asset).catch(err => {
          if (BURBZ_CORE.includes(asset)) throw err;
          console.warn('BURBZ SW: optional asset skipped', asset);
        })
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('burbz-') && key !== BURBZ_CACHE)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.includes('/api/')) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();
        const cacheableArtHost = url.hostname === 'github.com' || url.hostname === 'raw.githubusercontent.com';
        if (response.ok && (url.origin === self.location.origin || cacheableArtHost)) {
          caches.open(BURBZ_CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then(cached => {
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }))
  );
});
