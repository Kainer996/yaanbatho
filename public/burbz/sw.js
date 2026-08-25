importScripts('./uk_bird_expansion_50.js?v=uk50-source-backed-20260713');
importScripts('./uk_bird_expansion_2.js?v=uk26-source-backed-20260713');
importScripts('./au_bird_expansion.js?v=au-source-backed-20260713');
importScripts('./uk_bird_expansion_3.js?v=uk-regular-completion-20260715');
importScripts('./au_bird_expansion_2.js?v=au50-source-backed-r2-20260715');
importScripts('./national_bird_completion_20260715.js?v=national-completion-20260715');
importScripts('./uk_bird_expansion_4.js?v=uk-british-list-completion-20260722');
importScripts('./uk_bird_alias_completion_20260803.js?v=uk-bird-alias-completion-v216-20260803');

const BURBZ_CACHE = 'burbz-side-snacks-hunger-metre-v142-20260726-quest-routes-map-v143-20260726-timed-crafting-stores-v144-20260726-birdnet-v3-v145-20260727-quest-alignment-authority-v146-20260727-player-quest-chain-v146-20260728-merlin-guided-tutorial-v147-20260728-sw-self-update-v148-20260728-merlin-interactive-tutorial-v149-20260728-care-lesson-fix-v150-20260728-tutorial-polish-v151-20260728-discoveries-quiz-pacing-v152-20260728-bird-families-mega-v1-20260728-photo-locality-v153-20260728-tutorial-copy-cleanup-v154-20260729-camera-result-overlap-v155-20260729-kitchen-quest-guide-v156-20260729-sound-local-consensus-v157-20260729-kitchen-feed-sheet-v158-20260729-simple-locality-v160-20260729-recruit-card-name-v161-20260729-daily-hunger-bars-v162-20260729-birdex-card-names-v163-20260729-birdex-no-feed-v164-20260729-quest-drawers-closed-v165-20260729-generalist-diets-v166-20260729-generated-art-ui-v153-20260729-nickname-line-v167-20260729-intro-two-part-video-v154-20260729-academy-alive-v153-20260729-reconciled-release-v170-20260729-tutorial-chunked-progress-v171-20260729-birdnet-accuracy-v171-20260729-tutorial-merlin-feed-fix-v172-20260730-tutorial-merlin-spotlight-fix-v173-20260730-generated-art-ui-restore-v174-20260730-kitchen-no-duplicate-companions-v175-20260730-companion-feeding-only-v176-20260730-intro-hardening-v177-20260730-companion-always-top-up-v178-20260730-academy-wingbeats-v179-20260730-academy-3d-v180-20260730-empire-silent-v181-20260730-academy-canopy-v182-20260730-battle-flow-v183-20260731-quest-map-pan-v184-20260731-academy-detail-v184-20260731-academy-no-birds-v185-20260731-show-quests-close-v186-20260731-map-music-fade-v187-20260731-begin-quest-loop-authority-v188-20260731-empire-realms-trade-v189-20260731-global-money-hud-v190-20260731-training-claim-terminal-v191-20260801-remove-dead-map-icons-v192-20260801-empire-here-regions-v193-20260801-back-stays-in-game-v194-20260801-back-guard-gesture-v195-20260802-empire-player-start-sound-shelf-v196-20260802-merlin-bond-meter-v197-20260802-academy-library-v198-20260802-liberation-hides-league-v199-20260802-restored-lost-features-v200-20260802-bird-size-roles-v201-20260802-chef-bulk-feeding-v202-20260802-settlement-tiers-v203-20260803-battle-fullness-v204-20260803-two-side-snacks-v205-20260803-role-activity-reservations-v206-20260803-right-meal-quest-v207-20260803-roost-sleep-v208-20260803-quest-duration-tiers-v211-20260803-real-walk-nearby-quests-v215-20260803-uk-bird-alias-completion-v216-20260803-manga-warrior-habitats-v204-20260803-empire-clarity-v205-20260803-empire-live-reconcile-v217-20260803-hide-future-multiplayer-league-v218-20260804-quest-sheet-input-fix-v219-20260804-forge-satchels-v220-20260804-quarry-stone-economy-v221-20260804-feudal-hierarchy-v222-20260804-realm-dropdown-v223-20260804-ordered-quest-markers-v224-20260804-unique-place-names-v225-20260804-accurate-diets-full-catalogue-v226-20260805-midgame-progression-v227-20260805-eight-hour-quests-v228-20260805-nocturnal-night-bonus-v229-20260805-real-walk-go-map-v230-20260806-side-quests-walk-goal-v231-20260806-turn-potions-v232-20260806-turn-potions-hotfix-v233-20260806-academy-living-tree-v234-20260806-academy-3d-tree-glow-v235-20260806-living-canopy-v236-20260806-mallard-true-diet-v237-20260809-sleep-retired-v238-20260809-hospital-auto-discharge-v239-20260809-early-game-easy-battles-v240-20260810-battle-squad-board-v241-20260810-town-county-screens-v242-20260810-real-sky-daylight-v243-20260810-birdex-direct-recruit-v240-20260810-companion-unlock-copy-v241-20260810-remove-merlin-first-clue-v242-20260810-training-master-room-actor-v243-20260810-distributed-game-hud-v244-20260810-live-reconcile-v245-20260810-find-your-bird-v246-20260811-battle-faint-auto-hospital-v247-20260811-conquest-world-levels-v248-20260811-walking-story-quests-v249-20260811-academy-2d-default-v250-20260811-hold-to-steer-v251-20260811-academy-training-dock-v252-20260812-citizen-workers-timber-homes-v253-20260812-raven-weight-and-wit-v255-20260812-night-owl-dark-mode-v257-20260813-bird-bond-love-v256-20260812-night-hunter-ascendant-v258-20260813-village-variation-v260-20260813-chef-mastery-feed-all-v261-20260813-feedback-menu-v259-20260813-early-game-until-level-12-v262-20260813-feedback-menu-keyless-v263-20260813-real-place-names-v264-20260813-completion-notices-v265-20260813-night-veil-removed-v266-20260813-player-built-village-v267-20260814-empire-zoom-levels-v268-20260814-location-loot-v269-20260815-steven-the-gull-v270-20260815-fish-in-the-water-v271-20260815-village-provisions-v272-20260816-town-strategy-v273-20260816-mobile-fresh-update-v274-20260816-empire-nav-tabs-v275-20260817-town-square-city-builder-v276-20260817-one-town-fixed-view-v277-20260817-first-catch-once-v278-20260817-true-diet-primaries-v279-20260817-original-bird-card-art-v280-20260817-living-settlements-v281-20260817-quest-zoom-lock-v282-20260818-offroad-side-quests-v283-20260818-building-discovery-v284-20260819-settlement-scene-sharp-v285-20260819-battle-progression-fixes-v286-20260819-mercy-streak-attack-preview-v287-20260819-training-your-way-v288-20260819-merge-when-ready-v290-20260820-empire-badge-quest-prompts-v289-20260820-burbz-zombie-canon-v291-20260820-tavern-flock-rounds-v292-20260819-field-guide-menus-v293-20260820-steward-project-manager-v294-20260820-stores-market-project-manager-v295-20260820-honest-need-gauges-v296-20260820-equip-card-swipe-v297-20260820-generated-ui-art-v298-20260820-empire-declutter-v300-20260820-anchored-dock-v301-20260820-roost-retired-v302-20260820-fixed-dock-v303-20260820-village-basics-town-industry-v299-20260820-quiet-wand-whole-art-v304-20260821-make-a-friend-v305-20260821-arm-your-bird-v306-20260821-village-chain-v307-20260821-two-crews-v308-20260821-timber-village-builds-v309-20260823-walking-villagers-cottage-variety-v310-20260823-village-work-huts-v311-20260824-nav-action-badges-v312-20260824-bird-card-carry-charm-v313-20260824-project-manager-desk-v315-20260824-magpie-market-v316-20260824-empire-village-declutter-v317-20260824-free-birds-v318-20260824-empire-grid-v320-20260825';
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
  './empire_realm_core.js?v=merge-when-ready-v290-20260820',
  './settlement_merge_core.js?v=village-work-huts-v311-20260824',
  './town_strategy_core.js?v=town-strategy-v273-20260816',
  './empire_grid_core.js?v=empire-grid-v320-20260825',
  './world_level_core.js?v=conquest-world-levels-v248-20260811',
  './daylight_core.js?v=real-sky-daylight-v243-20260810',
  './quest_core.js?v=ordered-quest-markers-v224-20260804',
  './walking_story_core.js?v=mercy-streak-attack-preview-v287-20260819',
  './side_trail_core.js?v=offroad-side-quests-v283-20260818',
  './building_discovery_core.js?v=building-discovery-v284-20260819',
  './village_variation_core.js?v=village-variation-v260-20260813',
  './settlement_scene_core.js?v=settlement-scene-sharp-v285-20260819',
  './academy_treehouse_core.js?v=magpie-market-v316-20260824',
  './academy_alive_core.js?v=magpie-market-v316-20260824',
  './touch_steer_core.js?v=hold-to-steer-v251-20260811',
  './academy_3d_core.js?v=magpie-market-v316-20260824',
  './kitchen_pantry_core.js?v=mallard-true-diet-v237-20260809',
  './data/bird-diet-records.js?v=mallard-true-diet-v237-20260809',
  './bird_diet_hunger_core.js?v=mallard-true-diet-v237-20260809',
  './bird_sleep_core.js?v=night-hunter-ascendant-v258-20260813',
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
  './assets/settlements/settlement-loading-v281.webp',
  './assets/ui/quest-compass-emblem.webp',
  './assets/ui/merlin-wand-listener.webp',
  './assets/ui/burbz-icon-set/coin.webp',
  './assets/ui/burbz-icon-set/timber.webp',
  './assets/ui/burbz-icon-set/stone.svg',
  './assets/ui/burbz-icon-set/profile.webp',
  './assets/ui/burbz-icon-set/settings.webp',
  './assets/ui/burbz-icon-set/camera.webp',
  './assets/ui/burbz-icon-set/sound.webp',
  './assets/ui/burbz-icon-set/inventory.webp',
  './assets/ui/burbz-icon-set/forge.webp',
  './assets/ui/burbz-icon-set/quests.webp',
  './assets/ui/burbz-icon-set/map.webp',
  './assets/ui/burbz-icon-set/empire.webp',
  './assets/ui/burbz-icon-set/birdex.webp',
  './assets/ui/burbz-icon-set/scan.webp',
  './assets/ui/burbz-icon-set/battle.webp',
  './assets/ui/burbz-icon-set/academy.webp',
  './assets/ui/burbz-icon-set/leaderboards.webp',
  './assets/ui/burbz-icon-set/hospital.webp',
  './assets/gear/thorn_talons.webp',
  './assets/gear/bronze_spurs.webp',
  './assets/gear/stormcut_beak.webp',
  './assets/gear/kings_gaff.webp',
  './assets/gear/sunlance_talons.webp',
  './assets/gear/willow_wand.webp',
  './assets/gear/moonlit_charm.webp',
  './assets/gear/runed_crest.webp',
  './assets/gear/merlins_focus.webp',
  './assets/gear/dawnsong_orb.webp',
  './assets/gear/reed_vest.webp',
  './assets/gear/oak_breastplate.webp',
  './assets/gear/feather_mail.webp',
  './assets/gear/warden_plumage.webp',
  './assets/gear/aegis_of_dawn.webp',
  './assets/gear/swift_band.webp',
  './assets/gear/keen_eye_bead.webp',
  './assets/gear/stormglass_anklet.webp',
  './assets/gear/gale_pendant.webp',
  './assets/gear/heart_of_sky.webp',
  './assets/gear/reed_satchel.webp',
  './assets/gear/oakframe_satchel.webp',
  './assets/gear/stormweave_satchel.webp',
  './assets/gear/gilded_satchel.webp',
  './assets/gear/royal_satchel.webp',
  './assets/gear/ember_wisp.webp',
  './assets/gear/mending_light.webp',
  './assets/gear/frost_sigil.webp',
  './assets/gear/tempest_scroll.webp',
  './assets/gear/phoenix_chorus.webp',
  './assets/gear/tonic_of_vigour.webp',
  './assets/gear/nettle_brew.webp',
  './assets/gear/barrier_draught.webp',
  './assets/gear/stormwing_philtre.webp',
  './assets/gear/phoenix_elixir.webp',
  // Merlin's perched companion is a four-piece puppet, not one flat cutout.
  './assets/merlin/merlin-back.webp',
  './assets/merlin/merlin-body.webp',
  './assets/merlin/merlin-wing.webp',
  './assets/merlin/merlin-head.webp',
  './assets/academy-tree-manga-20260806.webp',
  './assets/academy-branches/branch-a.webp',
  './assets/academy-branches/branch-b.webp',
  './assets/academy-branches/branch-c.webp',
  './assets/academy-branches/branch-d.webp',
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
  './assets/academy-interiors-manga/crowbar-v2-animated-20260819.webp',
  './assets/academy-interiors-manga/kitchen-v2-animated-20260819.webp',
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
  './bird_size_core.js?v=raven-weight-and-wit-v255-20260812',
  './bird_roles_core.js?v=empire-grid-v320-20260825',
  './bird_bond_core.js?v=bird-bond-love-v256-20260812',
  './battle_core.js?v=mercy-streak-attack-preview-v287-20260819',
  './loot_crafting_core.js?v=magpie-market-v316-20260824',
  './audio_core.js?v=burbz-map-music-fade-v187-20260731',
  './action_badge_core.js?v=nav-action-badges-v312-20260824',
  './merlin_companion_core.js?v=reconciled-release-v170-20260729',
  './diary_core.js?v=accurate-diets-full-catalogue-v226-20260805',
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
  './empire_realm_core.js?v=merge-when-ready-v290-20260820',
  './settlement_merge_core.js?v=village-work-huts-v311-20260824',
  './town_strategy_core.js?v=town-strategy-v273-20260816',
  './empire_grid_core.js?v=empire-grid-v320-20260825',
  // 3D village ground detail (small, and the village looks flat without them)
  './assets/tex/grass_c.jpg',
  './assets/tex/grass_n.jpg',
  './assets/tex/cobble_c.jpg',
  './assets/tex/cobble_n.jpg',
  './academy_treehouse_core.js?v=magpie-market-v316-20260824',
  './kitchen_pantry_core.js?v=mallard-true-diet-v237-20260809',
  './data/bird-diet-records.js?v=mallard-true-diet-v237-20260809',
  './bird_diet_hunger_core.js?v=mallard-true-diet-v237-20260809',
  './bird_sleep_core.js?v=night-hunter-ascendant-v258-20260813',
  './diet_hunger_core.js?v=diet-hunger-release-20260723',
  './bird_family_core.js?v=bird-families-mega-v1-20260728',
  './bird_size_core.js?v=raven-weight-and-wit-v255-20260812',
  './bird_roles_core.js?v=empire-grid-v320-20260825',
  './bird_bond_core.js?v=bird-bond-love-v256-20260812',
  './battle_core.js?v=mercy-streak-attack-preview-v287-20260819',
  './loot_crafting_core.js?v=magpie-market-v316-20260824',
  './world_level_core.js?v=conquest-world-levels-v248-20260811',
  './walking_story_core.js?v=mercy-streak-attack-preview-v287-20260819',
  './side_trail_core.js?v=offroad-side-quests-v283-20260818',
  './building_discovery_core.js?v=building-discovery-v284-20260819',
  './village_variation_core.js?v=village-variation-v260-20260813',
  './settlement_scene_core.js?v=settlement-scene-sharp-v285-20260819',
  './audio_core.js?v=burbz-map-music-fade-v187-20260731',
  './action_badge_core.js?v=nav-action-badges-v312-20260824',
  './merlin_companion_core.js?v=reconciled-release-v170-20260729',
  './diary_core.js?v=accurate-diets-full-catalogue-v226-20260805',
  './sound_listener_core.js?v=birdnet-v3-accuracy-v5-20260729',
  './assets/ui/burbz-icon-set/coin.webp',
  './assets/ui/burbz-icon-set/timber.webp',
  './assets/ui/burbz-icon-set/stone.svg',
  './assets/ui/burbz-icon-set/profile.webp',
  './assets/ui/burbz-icon-set/settings.webp',
  './assets/ui/burbz-icon-set/camera.webp',
  './assets/ui/burbz-icon-set/sound.webp',
  './assets/ui/burbz-icon-set/inventory.webp',
  './assets/ui/burbz-icon-set/forge.webp',
  './assets/ui/burbz-icon-set/quests.webp',
  './assets/ui/burbz-icon-set/map.webp',
  './assets/ui/burbz-icon-set/empire.webp',
  './assets/ui/burbz-icon-set/birdex.webp',
  './assets/ui/burbz-icon-set/scan.webp',
  './assets/ui/burbz-icon-set/battle.webp',
  './assets/ui/burbz-icon-set/academy.webp',
  './assets/ui/burbz-icon-set/leaderboards.webp',
  './assets/ui/burbz-icon-set/hospital.webp',
  './assets/academy-buildings-manga/kitchen.png',
  './assets/academy-buildings-manga/training-hall.png',
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

// Keep worker takeover dependable on phones with slow links or tight storage.
// Only the current document and its changed Town runtimes must succeed before
// the worker can activate. The rest of the offline shell is still warmed
// below, but a large audio/data file failing must never strand a player on an
// older build. Required entries are cached first so optional writes cannot
// consume the available quota ahead of them.
const BURBZ_INSTALL_REQUIRED = [
  './index.html',
  './empire_realm_core.js?v=merge-when-ready-v290-20260820',
  './settlement_merge_core.js?v=village-work-huts-v311-20260824',
  './town_strategy_core.js?v=town-strategy-v273-20260816',
  './empire_grid_core.js?v=empire-grid-v320-20260825',
  './settlement_scene_core.js?v=settlement-scene-sharp-v285-20260819'
];
// Generated gameplay art is best-effort (one bad image must never abort an
// update) but it is still warmed on install so a freshly updated offline game
// opens its rooms and equipment with the real art instead of fallbacks.
const BURBZ_GENERATED_ART_WARM = BURBZ_ASSETS.filter(asset =>
  asset.startsWith('.' + '/assets/gear/') ||
  asset === './assets/academy-interiors-manga/crowbar-v2-animated-20260819.webp' ||
  asset === './assets/academy-interiors-manga/kitchen-v2-animated-20260819.webp'
);
const BURBZ_FALLBACK_REQUIRED = Array.from(new Set([
  ...BURBZ_CORE.filter(asset => !BURBZ_INSTALL_REQUIRED.includes(asset)),
  ...BURBZ_GENERATED_ART_WARM
]));
// This is an internal CacheStorage sentinel, not a file the live updater must
// upload. Keeping it relative without a "./" prefix also prevents dependency
// scanners from mistaking it for a deployable asset.
const BURBZ_SHELL_COMPLETE_KEY = '.burbz-shell-complete';

// A refresh must actually LAND the new build. cache.add() goes through the
// browser's ordinary HTTP cache, so a Pages response still inside its max-age
// would reinstall the OLD index.html into a brand-new service-worker cache —
// the player refreshes, the worker updates, and the screen looks identical.
// Fetching with cache:'reload' bypasses the HTTP cache and always takes the
// copy the server is serving right now.
function cacheFreshCopy(cache, asset) {
  return fetch(asset, { cache: 'reload' }).then(response => {
    if (!response || !response.ok) throw new Error('BURBZ SW: ' + asset + ' → ' + (response && response.status));
    return cache.put(asset, response);
  });
}

// Prefer this build's cache before consulting the one retained as an offline
// fallback. A global caches.match() walks caches in creation order and could
// otherwise return an older index/core file first, creating a mixed build.
function matchCurrentThenFallback(request, options) {
  return caches.open(BURBZ_CACHE)
    .then(cache => cache.match(request, options))
    .then(current => {
      if (current) return current;
      return caches.keys().then(keys => {
        const fallbackKeys = keys
          .filter(key => key.startsWith('burbz-') && key !== BURBZ_CACHE)
          .reverse();
        const findFallback = index => {
          if (index >= fallbackKeys.length) return undefined;
          return caches.open(fallbackKeys[index])
            .then(cache => cache.match(request, options))
            .then(cached => cached || findFallback(index + 1));
        };
        return findFallback(0);
      });
    });
}

function markShellComplete(cache) {
  return cache.put(BURBZ_SHELL_COMPLETE_KEY, new Response(BURBZ_CACHE))
    .then(() => true)
    .catch(err => {
      // The files themselves are already present; a marker write failing does
      // not make this shell unsafe, and the next release can validate it again.
      console.warn('BURBZ SW: shell-complete marker skipped', err);
      return true;
    });
}

function cacheHasCompleteFallback(cacheName) {
  return caches.open(cacheName).then(cache =>
    cache.match(BURBZ_SHELL_COMPLETE_KEY).then(marker => {
      // Validate the complete playable shell, including index.html and the
      // required runtimes. A failed intermediate install can be missing one
      // of those three even if every optional transfer happened to finish.
      return Promise.all(BURBZ_CORE.map(asset =>
        cache.match(asset, { ignoreSearch: true }).catch(() => null)
      )).then(matches => {
        if (!matches.every(Boolean)) return false;
        return marker ? true : markShellComplete(cache);
      });
    })
  ).catch(() => false);
}

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([caches.keys(), caches.open(BURBZ_CACHE)])
      .then(([keys, cache]) => {
        const hasPreviousBuild = keys.some(key => key.startsWith('burbz-') && key !== BURBZ_CACHE);
        return Promise.all(BURBZ_INSTALL_REQUIRED.map(asset =>
          cacheFreshCopy(cache, asset)
        )).then(() => {
          const optionalAssets = BURBZ_FALLBACK_REQUIRED;
          const cacheOptionalAsset = asset => cacheFreshCopy(cache, asset)
            .then(() => true)
            .catch(err => {
              console.warn('BURBZ SW: optional asset skipped', asset, err);
              return false;
            });
          const optionalWarm = Promise.all(optionalAssets.map(cacheOptionalAsset)).then(results =>
            results.every(Boolean) ? markShellComplete(cache) : false
          );
          if (!hasPreviousBuild) {
            // A first installation waits for every best-effort shell entry so
            // its next launch is genuinely offline-capable. Individual misses
            // are contained and can never reject the worker installation. A
            // permanent network hang is bounded so first activation still
            // completes on an unreliable mobile link.
            return Promise.race([
              optionalWarm,
              new Promise(resolve => setTimeout(() => resolve(false), 10000))
            ]);
          }
          // An upgrade already has a complete previous shell to fall back to.
          // Start warming the new cache, but never make a phone wait for large
          // audio/catalogue transfers before it may activate the new build.
          optionalWarm.catch(err => console.warn('BURBZ SW: background shell warm failed', err));
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => {
        const previousBuilds = keys.filter(key => key.startsWith('burbz-') && key !== BURBZ_CACHE);
        return Promise.all(previousBuilds.map(key =>
          cacheHasCompleteFallback(key).then(complete => ({ key, complete }))
        )).then(checked => {
          // Failed installs leave sparse caches behind. Retain the newest
          // demonstrably complete shell, not merely the newest cache name. If
          // no predecessor can be proven complete, fail safe by deleting none.
          const completeBuilds = checked.filter(entry => entry.complete).map(entry => entry.key);
          const previousFallback = completeBuilds.length ? completeBuilds[completeBuilds.length - 1] : null;
          const cachesToDelete = previousFallback
            ? previousBuilds.filter(key => key !== previousFallback)
            : [];
          return Promise.all(cachesToDelete.map(key => caches.delete(key)))
          .then(() => self.clients.claim())
          .then(() => {
            if (!previousBuilds.length || !self.clients.matchAll) return undefined;
            // Android may freeze a PWA before its old page receives the
            // controllerchange event. Navigating every existing game window
            // from the newly activated worker guarantees that a resumed phone
            // displays this build. localStorage progress is left untouched.
            return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
              clients.forEach(client => {
                const scope = self.registration && self.registration.scope;
                if (!client || !scope || !client.url || !client.url.startsWith(scope) || client.visibilityState === 'visible' || typeof client.navigate !== 'function') return undefined;
                // Do not return/await this promise from activate: a navigation
                // fetch waits for activation to finish, so waiting here would
                // create a lifecycle deadlock. The call is intentionally
                // launched after claim and allowed to settle independently.
                try {
                  client.navigate(client.url).catch(err => {
                    console.warn('BURBZ SW: client refresh deferred', err);
                  });
                } catch (err) {
                  console.warn('BURBZ SW: client refresh deferred', err);
                }
              });
            });
          });
        });
      })
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
      .catch(() => matchCurrentThenFallback(request, { ignoreSearch: true }).then(cached => {
        if (cached) return cached;
        if (request.mode === 'navigate') return matchCurrentThenFallback('./index.html');
        return Response.error();
      }))
  );
});
