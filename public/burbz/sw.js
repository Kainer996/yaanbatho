const BURBZ_CACHE = 'burbz-realistic-stats-v14-20260706';
const BURBZ_ASSETS = [
  './',
  './index.html',
  './lib/three.min.js?v=0.158.0',
  './lib/maplibre-gl.js?v=5.24.0',
  './lib/maplibre-gl.css?v=5.24.0',
  './academy_treehouse_core.js',
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
  './assets/academy-interiors/roost-interior-manga-20260629.png',
  './assets/academy-interiors/training-interior.svg',
  './assets/academy-interiors/gardens-interior.svg',
  './assets/cutscenes/burbz-intro-30s-seedance-20260629-discord.mp4',
  './assets/cutscenes/burbz-intro-part1-seedance-20260629-discord.mp4',
  './assets/cutscenes/burbz-intro-part2-seedance-20260629-discord.mp4',
  './bird-art-cache/cutouts/blackbird_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/blue_tit_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/chiffchaff_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/european_robin_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/great_tit_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/wren_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/blackcap_burbz_manga_20260630_clean.png',
  './bird-art-cache/curlew_burbz_manga_20260630_clean.png',
  './bird-art-cache/magpie_burbz_manga_20260630_clean.png',
  './bird-art-cache/cutouts/blackcap_burbz_manga_20260630_clean_cutout.png',
  './bird-art-cache/cutouts/curlew_burbz_manga_20260630_clean_cutout.png',
  './bird-art-cache/cutouts/magpie_burbz_manga_20260630_clean_cutout.png',
  './bird-art-cache/cutouts/dipper_burbz_manga_20260630_cutout.png',
  './bird-art-cache/cutouts/goosander_burbz_manga_20260630_cutout.png',
  './bird-art-cache/cutouts/willow_warbler_burbz_manga_20260630_cutout.png',
  './bird-art-cache/cutouts/sand_martin_burbz_manga_20260630_cutout.png',
  './bird-art-cache/cutouts/common_redstart_burbz_manga_20260630_cutout.png',
  './bird-art-cache/cutouts/pied_flycatcher_burbz_manga_20260630_cutout.png',
  './bird-art-cache/cutouts/treecreeper_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/tawny_owl_burbz_manga_20260624_cutout.png',
  './bird-art-cache/cutouts/rook_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/magpie_burbz_manga_20260624_cutout.png',
  './bird-art-cache/cutouts/meadow_pipit_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/mute_swan_burbz_manga_20260624_cutout.png',
  './bird-art-cache/cutouts/kingfisher_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/grey_wagtail_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/heron_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/nuthatch_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/blackcap_burbz_manga_20260624_cutout.png',
  './bird-art-cache/cutouts/great_spotted_woodpecker_burbz_manga_20260624_cutout.png',
  './bird-art-cache/cutouts/lapwing_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/yellowhammer_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/kestrel_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/stonechat_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/pied_wagtail_burbz_manga_20260624_cutout.png',
  './bird-art-cache/cutouts/jackdaw_burbz_manga_20260624_cutout.png',
  './bird-art-cache/cutouts/skylark_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/buzzard_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/raven_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/cutouts/woodpigeon_burbz_manga_20260624_cutout.png',
  './bird-art-cache/cutouts/goldfinch_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/house_sparrow_burbz_manga_20260624_v2.png',
  './bird-art-cache/cutouts/oystercatcher_burbz_manga_20260624_v2_cutout.png',
  './bird-art-cache/sulphur_crested_cockatoo_burbz_manga_20260630_v2.png',
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
  './bird-art-cache/australian_magpie_burbz_manga_20260630.png',
  './bird-art-cache/rainbow_lorikeet_burbz_manga_20260630.png',
  './bird-art-cache/tawny_frogmouth_burbz_manga_20260630.png',
  './bird-art-cache/noisy_miner_burbz_manga_20260630.png',
  './bird-art-cache/australian_wood_duck_burbz_manga_20260630.png',
  './bird-art-cache/pacific_black_duck_burbz_manga_20260630.png',
  './bird-art-cache/magpie_lark_burbz_manga_20260630.png',
  './bird-art-cache/dusky_moorhen_burbz_manga_20260630.png',
  './bird-art-cache/superb_fairywren_burbz_manga_20260630.png',
  './bird-art-cache/chestnut_teal_burbz_manga_20260630.png',
  './bird-art-cache/laughing_kookaburra_burbz_manga_20260630.png',
  './bird-art-cache/eurasian_coot_burbz_manga_20260630.png',
  './bird-art-cache/little_pied_cormorant_burbz_manga_20260630.png',
  './bird-art-cache/australasian_swamphen_burbz_manga_20260630.png',
  './bird-art-cache/red_wattlebird_burbz_manga_20260630.png',
  './bird-art-cache/spotted_dove_burbz_manga_20260630.png',
  './bird-art-cache/grey_butcherbird_burbz_manga_20260630.png',
  './bird-art-cache/white_faced_heron_burbz_manga_20260630.png',
  './bird-art-cache/pied_currawong_burbz_manga_20260630.png',
  './bird-art-cache/galah_burbz_manga_20260630.png',
  './bird-art-cache/sulphur_crested_cockatoo_burbz_manga_20260630.png',
  './bird-art-cache/crested_pigeon_burbz_manga_20260630.png',
  './bird-art-cache/little_raven_burbz_manga_20260630.png',
  './bird-art-cache/eastern_rosella_burbz_manga_20260630.png',
  './bird-art-cache/common_myna_burbz_manga_20260630.png',
  './bird-art-cache/silver_gull_burbz_manga_20260630.png',
  './bird-art-cache/black_swan_burbz_manga_20260630.png',
  './bird-art-cache/crimson_rosella_burbz_manga_20260630.png',
  './bird-art-cache/australian_king_parrot_burbz_manga_20260630.png',
  './bird-art-cache/australian_white_ibis_burbz_manga_20260630.png',
  './bird-art-cache/red_rumped_parrot_burbz_manga_20260630.png',
  './bird-art-cache/rock_pigeon_burbz_manga_20260630.png',
  './bird-art-cache/common_bronzewing_burbz_manga_20260630.png',
  './bird-art-cache/brown_thornbill_burbz_manga_20260630.png',
  './bird-art-cache/grey_fantail_burbz_manga_20260630.png',
  // Regional plus-20 birds — regional_plus20_20260701
  './bird-art-cache/welcome_swallow_burbz_manga_20260701.png',
  './bird-art-cache/willie_wagtail_burbz_manga_20260701.png',
  './bird-art-cache/new_holland_honeyeater_burbz_manga_20260701.png',
  './bird-art-cache/eastern_spinebill_burbz_manga_20260701.png',
  './bird-art-cache/white_plumed_honeyeater_burbz_manga_20260701.png',
  './bird-art-cache/masked_lapwing_burbz_manga_20260701.png',
  './bird-art-cache/royal_spoonbill_burbz_manga_20260701.png',
  './bird-art-cache/australian_pelican_burbz_manga_20260701.png',
  './bird-art-cache/little_corella_burbz_manga_20260701.png',
  './bird-art-cache/australian_raven_burbz_manga_20260701.png',
  './bird-art-cache/great_spotted_woodpecker_burbz_manga_20260701.png',
  './bird-art-cache/little_grebe_burbz_manga_20260701.png',
  './bird-art-cache/peregrine_falcon_burbz_manga_20260701.png',
  './bird-art-cache/bohemian_waxwing_burbz_manga_20260701.png',
  './bird-art-cache/red_crossbill_burbz_manga_20260701.png',
  './bird-art-cache/common_snipe_burbz_manga_20260701.png',
  './bird-art-cache/common_linnet_burbz_manga_20260701.png',
  './bird-art-cache/eurasian_tree_sparrow_burbz_manga_20260701.png',
  './bird-art-cache/grey_partridge_burbz_manga_20260701.png',
  './bird-art-cache/sedge_warbler_burbz_manga_20260701.png',
  './data/bird-education.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png'
];

// The app shell must cache or the install fails; artwork/video are best-effort
// so one missing file can never knock out offline support for the whole game.
const BURBZ_CORE = [
  './',
  './index.html',
  './lib/three.min.js?v=0.158.0',
  './academy_treehouse_core.js',
  './battle_core.js',
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
        if (response.ok && url.origin === self.location.origin) {
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
