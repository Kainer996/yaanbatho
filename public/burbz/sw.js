importScripts('./uk_bird_expansion_50.js?v=uk50-source-backed-20260713');
importScripts('./uk_bird_expansion_2.js?v=uk26-source-backed-20260713');
importScripts('./au_bird_expansion.js?v=au-source-backed-20260713');

const BURBZ_CACHE = 'burbz-companion-naming-v61-20260713';
const UK50_SW = self.BURBZ_UK_BIRD_EXPANSION_50;
const UK26_SW = self.BURBZ_UK_BIRD_EXPANSION_26;
const AU_SW = self.BURBZ_AU_BIRD_EXPANSION;
const BIRD_ART_GITHUB_RAW_BASE = 'https://github.com/Kainer996/yaanbatho/raw/refs/heads/main';
const ALL_EXPANSION_ART = { ...UK50_SW.art, ...UK26_SW.art, ...AU_SW.art };
const UK50_REMOTE_ART = Object.values(ALL_EXPANSION_ART).map(path =>
  BIRD_ART_GITHUB_RAW_BASE + path.replace(/^\/burbz\//, '/public/burbz/')
);
const UK50_REMOTE_CUTOUTS = Object.values(ALL_EXPANSION_ART).map(path => {
  const filename = path.split('/').pop().replace(/\.png$/i, '_cutout.png');
  return BIRD_ART_GITHUB_RAW_BASE + '/public/burbz/bird-art-cache/cutouts/' + filename;
});
const BURBZ_ASSETS = [
  './',
  './index.html',
  './lib/three.min.js?v=0.158.0',
  './lib/maplibre-gl.js?v=5.24.0',
  './lib/maplibre-gl.css?v=5.24.0',
  './quest_core.js?v=loop-home-20260710',
  './academy_treehouse_core.js?v=bird-rename-20260710',
  './scan_economy_core.js',
  './uk_bird_expansion_50.js?v=uk50-source-backed-20260713',
  './uk_bird_expansion_2.js?v=uk26-source-backed-20260713',
  './au_bird_expansion.js?v=au-source-backed-20260713',
  './data/uk-bird-education-50.json?v=au-source-backed-20260713',
  './assets/merlin-tutorial.png',
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
  './battle_core.js',
  './manifest.json',
  './privacy.html',
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
BURBZ_ASSETS.push(...UK50_REMOTE_ART, ...UK50_REMOTE_CUTOUTS);

// The app shell must cache or the install fails; artwork/video are best-effort
// so one missing file can never knock out offline support for the whole game.
const BURBZ_CORE = [
  './',
  './index.html',
  './lib/three.min.js?v=0.158.0',
  './academy_treehouse_core.js',
  './battle_core.js',
  './uk_bird_expansion_50.js?v=uk50-source-backed-20260713',
  './uk_bird_expansion_2.js?v=uk26-source-backed-20260713',
  './au_bird_expansion.js?v=au-source-backed-20260713',
  './data/uk-bird-education-50.json?v=au-source-backed-20260713',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(BURBZ_CACHE)
      .then(cache => Promise.all(BURBZ_ASSETS.map(asset =>
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
      .then(keys => Promise.all(keys.map(key => key === BURBZ_CACHE ? null : caches.delete(key))))
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
