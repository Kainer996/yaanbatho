importScripts('./uk_bird_expansion_50.js?v=uk50-source-backed-20260713');
importScripts('./uk_bird_expansion_2.js?v=uk26-source-backed-20260713');
importScripts('./au_bird_expansion.js?v=au-source-backed-20260713');
importScripts('./uk_bird_expansion_3.js?v=uk-regular-completion-20260715');
importScripts('./au_bird_expansion_2.js?v=au50-source-backed-r2-20260715');
importScripts('./national_bird_completion_20260715.js?v=national-completion-20260715');
importScripts('./uk_bird_expansion_4.js?v=uk-british-list-completion-20260722');
importScripts('./uk_bird_alias_completion_20260803.js?v=uk-bird-alias-completion-v216-20260803');

const BURBZ_CACHE = 'burbz-side-snacks-hunger-metre-v142-20260726-quest-routes-map-v143-20260726-timed-crafting-stores-v144-20260726-birdnet-v3-v145-20260727-quest-alignment-authority-v146-20260727-player-quest-chain-v146-20260728-merlin-guided-tutorial-v147-20260728-sw-self-update-v148-20260728-merlin-interactive-tutorial-v149-20260728-care-lesson-fix-v150-20260728-tutorial-polish-v151-20260728-discoveries-quiz-pacing-v152-20260728-bird-families-mega-v1-20260728-photo-locality-v153-20260728-tutorial-copy-cleanup-v154-20260729-camera-result-overlap-v155-20260729-kitchen-quest-guide-v156-20260729-sound-local-consensus-v157-20260729-kitchen-feed-sheet-v158-20260729-simple-locality-v160-20260729-recruit-card-name-v161-20260729-daily-hunger-bars-v162-20260729-birdex-card-names-v163-20260729-birdex-no-feed-v164-20260729-quest-drawers-closed-v165-20260729-generalist-diets-v166-20260729-generated-art-ui-v153-20260729-nickname-line-v167-20260729-intro-two-part-video-v154-20260729-academy-alive-v153-20260729-reconciled-release-v170-20260729-tutorial-chunked-progress-v171-20260729-birdnet-accuracy-v171-20260729-tutorial-merlin-feed-fix-v172-20260730-tutorial-merlin-spotlight-fix-v173-20260730-generated-art-ui-restore-v174-20260730-kitchen-no-duplicate-companions-v175-20260730-companion-feeding-only-v176-20260730-intro-hardening-v177-20260730-companion-always-top-up-v178-20260730-academy-wingbeats-v179-20260730-academy-3d-v180-20260730-empire-silent-v181-20260730-academy-canopy-v182-20260730-battle-flow-v183-20260731-quest-map-pan-v184-20260731-academy-detail-v184-20260731-academy-no-birds-v185-20260731-show-quests-close-v186-20260731-map-music-fade-v187-20260731-begin-quest-loop-authority-v188-20260731-empire-realms-trade-v189-20260731-global-money-hud-v190-20260731-training-claim-terminal-v191-20260801-remove-dead-map-icons-v192-20260801-empire-here-regions-v193-20260801-back-stays-in-game-v194-20260801-back-guard-gesture-v195-20260802-empire-player-start-sound-shelf-v196-20260802-merlin-bond-meter-v197-20260802-academy-library-v198-20260802-liberation-hides-league-v199-20260802-restored-lost-features-v200-20260802-bird-size-roles-v201-20260802-chef-bulk-feeding-v202-20260802-settlement-tiers-v203-20260803-battle-fullness-v204-20260803-two-side-snacks-v205-20260803-role-activity-reservations-v206-20260803-right-meal-quest-v207-20260803-roost-sleep-v208-20260803-quest-duration-tiers-v211-20260803-real-walk-nearby-quests-v215-20260803-uk-bird-alias-completion-v216-20260803-manga-warrior-habitats-v204-20260803-empire-clarity-v205-20260803-empire-live-reconcile-v217-20260803';
// diet-hunger-release-20260723: source-backed diet, hunger, Pantry, and Merlin runtime core.
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
  './empire_realm_core.js?v=empire-clarity-v205-20260803',
  './quest_core.js?v=begin-quest-loop-authority-v188-20260731',
  './academy_treehouse_core.js?v=quest-duration-tiers-v211-20260803',
  './academy_alive_core.js?v=restored-lost-features-v200-20260802',
  './academy_3d_core.js?v=restored-lost-features-v200-20260802',
  './kitchen_pantry_core.js?v=diet-hunger-release-20260723',
  './data/bird-diet-records.js?v=real-walk-nearby-quests-v215-20260803',
  './bird_diet_hunger_core.js?v=real-walk-nearby-quests-v215-20260803',
  './bird_sleep_core.js?v=roost-sleep-v208-20260803',
  './diet_hunger_core.js?v=diet-hunger-release-20260723',
  './scan_economy_core.js',
  './sound_listener_core.js?v=birdnet-v3-accuracy-v5-20260729',
  './uk_bird_expansion_50.js?v=uk50-source-backed-20260713',
  './uk_bird_expansion_2.js?v=uk26-source-backed-20260713',
  './au_bird_expansion.js?v=au-source-backed-20260713',
  './uk_bird_expansion_3.js?v=uk-regular-completion-20260715',
  './au_bird_expansion_2.js?v=au50-source-backed-r2-20260715',
  './national_bird_completion_20260715.js?v=national-completion-20260715',
  './uk_bird_expansion_4.js?v=uk-british-list-completion-20260722',
  './uk_bird_alias_completion_20260803.js?v=uk-bird-alias-completion-v216-20260803',
  './bird_art_release_20260727.js?v=builtin-imagegen-1026',
  './bird_art_release_20260803.js?v=manga-warrior-habitats-20260803',
  './spain_boundary_20260715.js?v=spain-mainland-balearics-20260715',
  './data/uk-bird-education-50.json?v=au-source-backed-20260713',
  './data/regional-bird-education-20260715.json?v=regional-birds-v75-20260715',
  './data/national-bird-completion/manifest.json?v=national-completion-20260715',
  './assets/merlin-tutorial.png',
  './assets/ui/quest-compass-emblem.webp',
  './assets/ui/merlin-wand-listener.webp',
  './assets/ui/burbz-icon-set/coin.webp',
  './assets/ui/burbz-icon-set/timber.webp',
  './assets/ui/burbz-icon-set/profile.webp',
  './assets/ui/burbz-icon-set/settings.webp',
  './assets/ui/burbz-icon-set/camera.webp',
  './assets/ui/burbz-icon-set/sound.webp',
  './assets/ui/burbz-icon-set/inventory.webp',
  './assets/ui/burbz-icon-set/forge.webp',
  './assets/ui/burbz-icon-set/quests.webp',
  // Merlin's perched companion is a four-piece puppet, not one flat cutout.
  './assets/merlin/merlin-back.webp',
  './assets/merlin/merlin-body.webp',
  './assets/merlin/merlin-wing.webp',
  './assets/merlin/merlin-head.webp',
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
  './bird_family_core.js?v=bird-families-mega-v1-20260728',
  './bird_size_core.js?v=empire-clarity-v205-20260803',
  './bird_roles_core.js?v=empire-clarity-v205-20260803',
  './battle_core.js?v=bird-size-roles-v201-20260802',
  './loot_crafting_core.js?v=timed-crafting-20260726',
  './audio_core.js?v=burbz-map-music-fade-v187-20260731',
  './action_badge_core.js?v=nav-action-badges-v1-20260721',
  './merlin_companion_core.js?v=reconciled-release-v170-20260729',
  './diary_core.js?v=restored-lost-features-v200-20260802',
  './bird-art-cache/cutouts/merlin_burbz_manga_20260624_v2_cutout.png',
  './assets/audio/bgm-birbs-quest.mp3',
  './assets/audio/bgm-burbz-quest-v2.mp3',
  './assets/audio/sfx-ui-tap.mp3',
  './assets/audio/sfx-page-wing.mp3',
  './assets/audio/sfx-capture.mp3',
  './assets/audio/sfx-resource.mp3',
  './assets/audio/sfx-battle-hit.mp3',
  './assets/audio/sfx-battle-magic.mp3',
  './assets/audio/sfx-battle-defend.mp3',
  './assets/audio/sfx-build.mp3',
  './assets/audio/sfx-level-up.mp3',
  './assets/audio/sfx-quest-complete.mp3',
  './assets/audio/sfx-victory.mp3',
  './assets/audio/sfx-defeat-error.mp3',
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
  './assets/cutscenes/burbz-intro-two-part-hf-20260729.mp4',
  './assets/academy-buildings/aviary-gardens.svg',
  './assets/academy-buildings/crowbar.svg',
  './assets/academy-buildings/hospital.svg',
  './assets/academy-buildings/kitchen.svg',
  './assets/academy-buildings/library.svg',
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
  './academy_treehouse_core.js?v=quest-duration-tiers-v211-20260803',
  './kitchen_pantry_core.js?v=diet-hunger-release-20260723',
  './data/bird-diet-records.js?v=real-walk-nearby-quests-v215-20260803',
  './bird_diet_hunger_core.js?v=real-walk-nearby-quests-v215-20260803',
  './bird_sleep_core.js?v=roost-sleep-v208-20260803',
  './diet_hunger_core.js?v=diet-hunger-release-20260723',
  './bird_family_core.js?v=bird-families-mega-v1-20260728',
  './bird_size_core.js?v=empire-clarity-v205-20260803',
  './bird_roles_core.js?v=empire-clarity-v205-20260803',
  './battle_core.js?v=bird-size-roles-v201-20260802',
  './loot_crafting_core.js?v=timed-crafting-20260726',
  './audio_core.js?v=burbz-map-music-fade-v187-20260731',
  './action_badge_core.js?v=nav-action-badges-v1-20260721',
  './merlin_companion_core.js?v=reconciled-release-v170-20260729',
  './diary_core.js?v=restored-lost-features-v200-20260802',
  './sound_listener_core.js?v=birdnet-v3-accuracy-v5-20260729',
  './assets/ui/burbz-icon-set/coin.webp',
  './assets/ui/burbz-icon-set/timber.webp',
  './assets/ui/burbz-icon-set/profile.webp',
  './assets/ui/burbz-icon-set/settings.webp',
  './assets/ui/burbz-icon-set/camera.webp',
  './assets/ui/burbz-icon-set/sound.webp',
  './assets/ui/burbz-icon-set/inventory.webp',
  './assets/ui/burbz-icon-set/forge.webp',
  './assets/ui/burbz-icon-set/quests.webp',
  './bird-art-cache/cutouts/merlin_burbz_manga_20260624_v2_cutout.png',
  './assets/audio/bgm-birbs-quest.mp3',
  './assets/audio/bgm-burbz-quest-v2.mp3',
  './assets/audio/sfx-ui-tap.mp3',
  './assets/audio/sfx-page-wing.mp3',
  './assets/audio/sfx-capture.mp3',
  './assets/audio/sfx-resource.mp3',
  './assets/audio/sfx-battle-hit.mp3',
  './assets/audio/sfx-battle-magic.mp3',
  './assets/audio/sfx-battle-defend.mp3',
  './assets/audio/sfx-build.mp3',
  './assets/audio/sfx-level-up.mp3',
  './assets/audio/sfx-quest-complete.mp3',
  './assets/audio/sfx-victory.mp3',
  './assets/audio/sfx-defeat-error.mp3',
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
  './uk_bird_alias_completion_20260803.js?v=uk-bird-alias-completion-v216-20260803',
  './bird_art_release_20260727.js?v=builtin-imagegen-1026',
  './bird_art_release_20260803.js?v=manga-warrior-habitats-20260803',
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
        // 206 partial responses (video/audio range requests) are rejected by
        // Cache.put with a TypeError, so don't try to store them.
        if (response.ok && response.status !== 206 && (url.origin === self.location.origin || cacheableArtHost)) {
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
