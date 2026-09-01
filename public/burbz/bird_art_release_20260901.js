(function (root) {
  'use strict';

  // no-arms-card-art-v340-20260901.
  //
  // A full visual audit (1,757 paintings) found 37 birds from the early manga
  // batches (20260624–20260706) drawn with human arms or hands. Every one of
  // them has an armless warrior remake from 20260802, cut out on transparency.
  // For these birds only, the card shows that cutout over the bird's habitat
  // backdrop. Every other painting is untouched — Yaan prefers the originals.
  const armedFiles = new Set(`
australian_pelican_burbz_manga_20260701.png
barn_owl_burbz_manga_20260624_v2.png
blackcap_burbz_manga_20260624.png
blue_tit_burbz_manga_20260624_v2.png
common_linnet_burbz_manga_20260701.png
common_myna_burbz_manga_20260630.png
cormorant_burbz_manga_20260624_v2.png
crimson_rosella_burbz_manga_20260630.png
eastern_spinebill_burbz_manga_20260701.png
european_robin_burbz_manga_20260624_v2.png
firecrest_burbz_manga_20260624_v2.png
gannet_burbz_manga_20260624_v2.png
goldcrest_burbz_manga_20260624_v2.png
goldfinch_burbz_manga_20260624_v2.png
great_crested_grebe_burbz_manga_20260706T0200.png
great_tit_burbz_manga_20260624_v2.png
greenfinch_burbz_manga_20260624_v2.png
grey_wagtail_burbz_manga_20260624_v2.png
heron_burbz_manga_20260624_v2.png
jay_burbz_manga_20260624.png
little_corella_burbz_manga_20260701.png
little_raven_burbz_manga_20260630.png
long_tailed_tit_burbz_manga_20260624_v2.png
new_holland_honeyeater_burbz_manga_20260701.png
noisy_miner_burbz_manga_20260630.png
oystercatcher_burbz_manga_20260624_v2.png
peregrine_falcon_burbz_manga_20260624_v2.png
rainbow_lorikeet_burbz_manga_20260630.png
raven_burbz_manga_20260624_v2.png
reed_bunting_burbz_manga_20260624_v2.png
royal_spoonbill_burbz_manga_20260701.png
song_thrush_burbz_manga_20260624_v2.png
starling_burbz_manga_20260624_v2.png
superb_fairywren_burbz_manga_20260630.png
swift_burbz_manga_20260624.png
white_plumed_honeyeater_burbz_manga_20260701.png
woodpigeon_burbz_manga_20260624.png
  `.trim().split(/\s+/));

  function artFileName(artUrl) {
    return String(artUrl || '').split('?')[0].split('#')[0].split('/').pop() || '';
  }

  function armedSlug(fileName) {
    return fileName.replace(/_burbz_manga_\d{8}(?:T\d{4})?(?:_v\d+)?\.png$/i, '');
  }

  root.BURBZ_ARMED_MANGA_FILES_20260901 = armedFiles;

  // The armless stand-in for an armed painting: the warrior remake's
  // transparent cutout. Returns null for every painting that is not armed,
  // so callers can keep their original art untouched.
  root.burbzNoArmsCardArt20260901 = function (artUrl) {
    const file = artFileName(artUrl);
    if (!armedFiles.has(file)) return null;
    return '/burbz/bird-art-cache/cutouts/' + armedSlug(file) + '_burbz_manga_warrior_20260802_cutout.png';
  };
})(typeof window !== 'undefined' ? window : this);
