(function (root) {
  'use strict';

  const warriorSlugs = new Set(`
arctic_redpoll australasian_swamphen australian_king_parrot australian_magpie
australian_pelican australian_raven australian_white_ibis australian_wood_duck
barn_owl barnacle_goose black_swan blackbird blackcap blue_tit bohemian_waxwing
brown_thornbill bullfinch buzzard cabot_s_tern canada_goose carrion_crow chaffinch
chestnut_teal chiffchaff coal_tit collared_dove common_bronzewing common_linnet
common_myna common_redstart common_snipe cormorant corn_bunting crested_pigeon
crimson_rosella cuckoo curlew dipper dunnock dusky_moorhen eastern_rosella
eastern_spinebill eurasian_coot eurasian_tree_sparrow european_robin fea_s_petrel
feral_pigeon fieldfare firecrest galah gannet goldcrest golden_eagle goldfinch
goosander great_crested_grebe great_spotted_woodpecker great_tit green_woodpecker
greenfinch grey_butcherbird grey_fantail grey_partridge grey_wagtail greylag_goose
heron herring_gull house_martin house_sparrow jackdaw jay kestrel kingfisher
lapwing laughing_kookaburra little_corella little_grebe little_owl
little_pied_cormorant little_raven long_tailed_tit magpie magpie_lark mallard
masked_lapwing meadow_pipit merlin mistle_thrush mute_swan new_holland_honeyeater
noisy_miner northern_pintail nuthatch osprey oystercatcher pacific_black_duck
peregrine_falcon pheasant pied_currawong pied_flycatcher pied_wagtail puffin
rainbow_lorikeet raven razorbill red_crossbill red_kite red_rumped_parrot
red_wattlebird reed_bunting reed_warbler ring_necked_parakeet rook royal_spoonbill
sand_martin sedge_warbler silver_gull skylark song_thrush sparrowhawk spotted_dove
square_tailed_kite starling stejneger_s_stonechat stonechat sulphur_crested_cockatoo
superb_fairywren swallow swift tawny_frogmouth tawny_owl treecreeper
wedge_tailed_eagle welcome_swallow white_faced_heron white_plumed_honeyeater
white_tailed_eagle whitethroat willie_wagtail willow_warbler woodpigeon wren
yellowhammer
  `.trim().split(/\s+/));

  const legacySlugAliases = {
    rock_pigeon: 'feral_pigeon',
    robin: 'european_robin'
  };

  function artSlug(artUrl) {
    const file = String(artUrl || '').split('?')[0].split('#')[0].split('/').pop() || '';
    return file
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/_art_pending_\d+$/i, '')
      .replace(/_burbz_.*$/i, '')
      .replace(/_\d{8}(?:_v\d+|_clean)?$/i, '')
      .replace(/_[a-f0-9]{10,}$/i, '')
      .replace(/_(?:ava|yaan)(?:_square)?_\d+$/i, '');
  }

  root.BURBZ_MANGA_WARRIOR_SLUGS_20260803 = warriorSlugs;
  root.applyBurbzMangaWarriorArt20260803 = function (artMap) {
    if (!artMap) return artMap;
    Object.entries(artMap).forEach(([species, artUrl]) => {
      const rawSlug = artSlug(artUrl);
      const slug = legacySlugAliases[rawSlug] || rawSlug;
      if (!warriorSlugs.has(slug)) return;
      artMap[species] = '/burbz/bird-art-cache/' + slug + '_burbz_manga_warrior_20260802.png';
    });
    return artMap;
  };

  root.BURBZ_HABITAT_BACKGROUNDS_20260803 = Object.freeze({
    woodland: '/burbz/bird-art-cache/habitat-backgrounds/woodland_manga_20260803.png',
    wetland: '/burbz/bird-art-cache/habitat-backgrounds/wetland_manga_20260803.png',
    coast: '/burbz/bird-art-cache/habitat-backgrounds/coast_manga_20260803.png',
    grassland: '/burbz/bird-art-cache/habitat-backgrounds/grassland_manga_20260803.png',
    garden: '/burbz/bird-art-cache/habitat-backgrounds/garden_manga_20260803.png',
    heath: '/burbz/bird-art-cache/habitat-backgrounds/heath_manga_20260803.png',
    eucalypt: '/burbz/bird-art-cache/habitat-backgrounds/eucalypt_manga_20260803.png',
    mountain: '/burbz/bird-art-cache/habitat-backgrounds/mountain_manga_20260803.png'
  });
})(window);
