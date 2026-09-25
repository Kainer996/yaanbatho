importScripts('./uk_bird_expansion_50.js?v=uk50-source-backed-20260713');
importScripts('./uk_bird_expansion_2.js?v=uk26-source-backed-20260713');
importScripts('./au_bird_expansion.js?v=au-source-backed-20260713');
importScripts('./uk_bird_expansion_3.js?v=uk-regular-completion-20260715');
importScripts('./au_bird_expansion_2.js?v=au50-source-backed-r2-20260715');
importScripts('./national_bird_completion_20260715.js?v=national-completion-20260715');
importScripts('./uk_bird_expansion_4.js?v=uk-british-list-completion-20260722');
importScripts('./uk_bird_alias_completion_20260803.js?v=uk-bird-alias-completion-v216-20260803');
importScripts('./geographic_cache.js?v=connected-world-v386-20260910');

// v419: install a fresh shell so existing phones receive immediate photo ID.

const BURBZ_CACHE = 'burbz-bird-photo-original-v425b-20260918-burbz-bird-photo-recognition-v425-20260918-burbz-companion-care-habitats-v424-20260918-burbz-side-snacks-hunger-metre-v142-20260726-quest-routes-map-v143-20260726-timed-crafting-stores-v144-20260726-birdnet-v3-v145-20260727-quest-alignment-authority-v146-20260727-player-quest-chain-v146-20260728-merlin-guided-tutorial-v147-20260728-sw-self-update-v148-20260728-merlin-interactive-tutorial-v149-20260728-care-lesson-fix-v150-20260728-tutorial-polish-v151-20260728-discoveries-quiz-pacing-v152-20260728-bird-families-mega-v1-20260728-photo-locality-v153-20260728-tutorial-copy-cleanup-v154-20260729-camera-result-overlap-v155-20260729-kitchen-quest-guide-v156-20260729-sound-local-consensus-v157-20260729-kitchen-feed-sheet-v158-20260729-simple-locality-v160-20260729-recruit-card-name-v161-20260729-daily-hunger-bars-v162-20260729-birdex-card-names-v163-20260729-birdex-no-feed-v164-20260729-quest-drawers-closed-v165-20260729-generalist-diets-v166-20260729-generated-art-ui-v153-20260729-nickname-line-v167-20260729-intro-two-part-video-v154-20260729-academy-alive-v153-20260729-reconciled-release-v170-20260729-tutorial-chunked-progress-v171-20260729-birdnet-accuracy-v171-20260729-tutorial-merlin-feed-fix-v172-20260730-tutorial-merlin-spotlight-fix-v173-20260730-generated-art-ui-restore-v174-20260730-kitchen-no-duplicate-companions-v175-20260730-companion-feeding-only-v176-20260730-intro-hardening-v177-20260730-companion-always-top-up-v178-20260730-academy-wingbeats-v179-20260730-academy-3d-v180-20260730-empire-silent-v181-20260730-academy-canopy-v182-20260730-battle-flow-v183-20260731-quest-map-pan-v184-20260731-academy-detail-v184-20260731-academy-no-birds-v185-20260731-show-quests-close-v186-20260731-map-music-fade-v187-20260731-begin-quest-loop-authority-v188-20260731-empire-realms-trade-v189-20260731-global-money-hud-v190-20260731-training-claim-terminal-v191-20260801-remove-dead-map-icons-v192-20260801-empire-here-regions-v193-20260801-back-stays-in-game-v194-20260801-back-guard-gesture-v195-20260802-empire-player-start-sound-shelf-v196-20260802-merlin-bond-meter-v197-20260802-academy-library-v198-20260802-liberation-hides-league-v199-20260802-restored-lost-features-v200-20260802-bird-size-roles-v201-20260802-chef-bulk-feeding-v202-20260802-settlement-tiers-v203-20260803-battle-fullness-v204-20260803-two-side-snacks-v205-20260803-role-activity-reservations-v206-20260803-right-meal-quest-v207-20260803-roost-sleep-v208-20260803-quest-duration-tiers-v211-20260803-real-walk-nearby-quests-v215-20260803-uk-bird-alias-completion-v216-20260803-manga-warrior-habitats-v204-20260803-empire-clarity-v205-20260803-empire-live-reconcile-v217-20260803-hide-future-multiplayer-league-v218-20260804-quest-sheet-input-fix-v219-20260804-forge-satchels-v220-20260804-quarry-stone-economy-v221-20260804-feudal-hierarchy-v222-20260804-realm-dropdown-v223-20260804-ordered-quest-markers-v224-20260804-unique-place-names-v225-20260804-accurate-diets-full-catalogue-v226-20260805-midgame-progression-v227-20260805-eight-hour-quests-v228-20260805-nocturnal-night-bonus-v229-20260805-real-walk-go-map-v230-20260806-side-quests-walk-goal-v231-20260806-turn-potions-v232-20260806-turn-potions-hotfix-v233-20260806-academy-living-tree-v234-20260806-academy-3d-tree-glow-v235-20260806-living-canopy-v236-20260806-mallard-true-diet-v237-20260809-sleep-retired-v238-20260809-hospital-auto-discharge-v239-20260809-early-game-easy-battles-v240-20260810-battle-squad-board-v241-20260810-town-county-screens-v242-20260810-real-sky-daylight-v243-20260810-birdex-direct-recruit-v240-20260810-companion-unlock-copy-v241-20260810-remove-merlin-first-clue-v242-20260810-training-master-room-actor-v243-20260810-distributed-game-hud-v244-20260810-live-reconcile-v245-20260810-find-your-bird-v246-20260811-battle-faint-auto-hospital-v247-20260811-conquest-world-levels-v248-20260811-walking-story-quests-v249-20260811-academy-2d-default-v250-20260811-hold-to-steer-v251-20260811-academy-training-dock-v252-20260812-citizen-workers-timber-homes-v253-20260812-raven-weight-and-wit-v255-20260812-night-owl-dark-mode-v257-20260813-bird-bond-love-v256-20260812-night-hunter-ascendant-v258-20260813-village-variation-v260-20260813-chef-mastery-feed-all-v261-20260813-feedback-menu-v259-20260813-early-game-until-level-12-v262-20260813-feedback-menu-keyless-v263-20260813-real-place-names-v264-20260813-completion-notices-v265-20260813-night-veil-removed-v266-20260813-player-built-village-v267-20260814-empire-zoom-levels-v268-20260814-location-loot-v269-20260815-steven-the-gull-v270-20260815-fish-in-the-water-v271-20260815-village-provisions-v272-20260816-town-strategy-v273-20260816-mobile-fresh-update-v274-20260816-empire-nav-tabs-v275-20260817-town-square-city-builder-v276-20260817-one-town-fixed-view-v277-20260817-first-catch-once-v278-20260817-true-diet-primaries-v279-20260817-original-bird-card-art-v280-20260817-living-settlements-v281-20260817-quest-zoom-lock-v282-20260818-offroad-side-quests-v283-20260818-building-discovery-v284-20260819-settlement-scene-sharp-v285-20260819-battle-progression-fixes-v286-20260819-mercy-streak-attack-preview-v287-20260819-training-your-way-v288-20260819-merge-when-ready-v290-20260820-empire-badge-quest-prompts-v289-20260820-burbz-zombie-canon-v291-20260820-tavern-flock-rounds-v292-20260819-field-guide-menus-v293-20260820-steward-project-manager-v294-20260820-stores-market-project-manager-v295-20260820-honest-need-gauges-v296-20260820-equip-card-swipe-v297-20260820-generated-ui-art-v298-20260820-empire-declutter-v300-20260820-anchored-dock-v301-20260820-roost-retired-v302-20260820-fixed-dock-v303-20260820-village-basics-town-industry-v299-20260820-quiet-wand-whole-art-v304-20260821-make-a-friend-v305-20260821-arm-your-bird-v306-20260821-village-chain-v307-20260821-two-crews-v308-20260821-timber-village-builds-v309-20260823-walking-villagers-cottage-variety-v310-20260823-village-work-huts-v311-20260824-nav-action-badges-v312-20260824-bird-card-carry-charm-v313-20260824-project-manager-desk-v315-20260824-magpie-market-v316-20260824-empire-village-declutter-v317-20260824-free-birds-v318-20260824-empire-grid-v322-20260825-villages-first-county-merge-v319-20260824-one-tap-appointments-v320-20260824-forge-opens-on-the-anvil-v323-20260825-manager-builds-the-village-v324-20260825-art-same-origin-v325-20260825-iron-ingot-errand-v326-20260825-free-your-first-village-v327-20260825-wand-button-leads-v328-20260825-trail-mode-v329-20260825-field-any-bird-v330-20260826-quiet-arena-v331-20260826-village-swipe-v332-20260826-kitchen-clean-table-v333-20260827-walk-detection-removed-v334-20260827-every-bird-carries-its-weight-v335-20260827-screen-swipe-v336-20260831-feeding-menu-banked-coins-v337-20260831-gentle-start-v338-20260831-polished-ui-notifications-v339-20260901-no-arms-card-art-v340-20260901-step-inside-buildings-v341-20260901-release-polish-v342-20260901-empire-three-pages-v343-20260901-generated-building-interiors-v344-20260902-visible-build-shortfall-v345-20260903-trading-manager-gates-v346-20260903-rook-recognition-special-characters-v347-20260904-alderwing-living-settlements-v348-20260904-little-folk-residents-v350-20260905-painted-forge-anvil-v351-20260905-woodland-ui-polish-v352-20260906-concise-onboarding-v353-20260906-barracks-tutorial-callout-v354-20260906-companion-card-polish-v355-20260906-manga-world-v356-20260907-ink-precision-v357-20260907-crafted-academy-v358-20260907-comic-ui-v359-20260907-woodland-finish-v360-20260907-walking-quests-v361-20260907-appearance-v362-20260907-companion-life-v363-20260907-tutorial-contrast-v364-20260907-field-map-v365-20260907-illustrated-world-v366-20260907-village-discoveries-v367-20260908-walkable-interiors-v368-20260908-interior-arrival-v369-20260908-academy-flight-v370-20260908-bird-flight-controls-v371-20260908-woodland-harvest-v372-20260908-living-map-v373-20260908-map-pictures-v374-20260908-full-cards-v375-20260908-night-quests-v376-20260908-area-birds-v377-20260909-scan-home-v378-20260909-player-home-v379-20260909-player-home-v380-20260909-map-trails-v381-20260909-pocket-detours-v382-20260910-side-chest-v383-20260910-enchanted-study-v384-20260910-homestead-v385-20260910-connected-world-v386-20260910-offline-map-shell-20260910-connected-world-v386-20260910-home-countryside-v387-20260910-landscape-v388-20260910-market-tabs-v389-20260910-merlin-flight-v390-20260910-continuous-world-v391-20260910-photo-recovery-v392-20260911-photo-accuracy-v393-20260911-landscape-atlas-v394b-20260913-living-desk-v395-20260913-desk-panels-v396-20260913-desk-composition-v397-20260913-home-equipment-v398-20260913-home-followup-v399-20260913-unified-alderwing-v400-20260913-distant-sky-v401-20260913-quest-buildings-v402-20260913-map-camera-v403-20260914-builder-help-v404-20260914-builder-actions-v404b-20260914-building-opening-v405-20260914-wilderness-discoveries-v406-20260914-wayside-room-title-v406b-20260914-photo-recognition-v407-20260914-photo-journal-v407b-20260914-houses-terrain-v408-20260914-home-farming-v409-20260914-gemini-photos-v410-20260914-empire-opening-v414-20260914-empire-title-v414b-20260914-new-game-trailer-v415-20260914-opening-home-v416-20260914-alderwing-followups-v417-20260914-alderwing-flight-shores-v418-20260915-alderwing-intro-desk-v420-20260917-home-squares-v421-20260917-home-b-charcoal-v422-20260917-home-b-stable-v423-20260917-shelter-tour-v426-20260919-walk-shelter-controls-v427-20260920-compact-guidance-v428-20260920-hands-on-world-tutorial-v429-20260920-quest-only-overview-v430-20260921-alderwing-qst-ui-save-v432-20260921-destination-cleanup-v434-20260921-destination-touch-v435b-20260921-destination-touch-v435c-20260921-destination-anywhere-v436-20260921-red-gold-pocket-v437-20260921-house-entry-landing-v438-20260922-craft-home-repair-v440-20260922-dashboard-banners-v443-20260922-quest-pulse-v442-20260922-home-load-repair-v449-20260923-tavern-hall-open-v450-20260923-home-ground-intro-v451-20260923-gold-trail-raven-v454-20260923-expedition-duration-v455-20260923-quest-revisit-v457-20260923-hall-music-v458-20260923-hall-entrances-v459-20260923-academy-home-v460-20260923-separate-home-v461-20260924-merlin-story-art-20260924-calm-asmr-v462-20260924-home-academy-dock-v463-20260924-calm-camp-v463-20260924-calm-weather-v464-20260924-home-academy-tree-v465-20260924-bird-patch-map-v466-20260924-merlin-opening-v467-20260924-paced-tutorial-v469-20260924-alderwing-nature-v470-20260925-academy-plain-tree-v471-20260925-alderwing-steady-v472-20260925-academy-living-tree-v473-20260925-home-dock-back-v474-20260925';
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
const ALL_EXPANSION_ART = { ...UK50_SW.art, ...UK26_SW.art, ...AU_SW.art };
const NEW_LOCAL_PLACEHOLDER_ART = { ...UK_FINAL_SW.art, ...AU50_SW.art };
// Expansion art is served same-origin, like every other asset in this list.
// Precaching it from GitHub spent an LFS download per file per install — ~292
// files for every player on every service-worker update.
const UK50_LOCAL_ART = Object.values(ALL_EXPANSION_ART);
const UK50_LOCAL_CUTOUTS = UK50_LOCAL_ART.map(path => {
  const filename = path.split('/').pop().replace(/\.png$/i, '_cutout.png');
  return '/burbz/bird-art-cache/cutouts/' + filename;
});
const NEW_LOCAL_ART = Object.values(NEW_LOCAL_PLACEHOLDER_ART);
const NEW_LOCAL_CUTOUTS = NEW_LOCAL_ART.map(path => {
  const filename = path.split('/').pop().replace(/\.png$/i, '_cutout.png');
  return '/burbz/bird-art-cache/cutouts/' + filename;
});
const BURBZ_ASSETS = [
  './geographic_cache.js?v=connected-world-v386-20260910',
  './geographic_home_picker.js?v=alderwing-intro-desk-v420-20260917',
  './geographic_settlement_scene.js?v=connected-world-v386-20260910',
  './geographic_world_core.js?v=gps-shelter-swimming-v439-20260922',
  './flight_craft_core.js?v=craft-home-repair-v440-20260922',
  './flight_craft.js?v=alderwing-steady-v472-20260925',
  './shore_water.js?v=alderwing-nature-v470-20260925',
  './world_nature_core.js?v=alderwing-steady-v472-20260925',
  './world_nature.js?v=alderwing-steady-v472-20260925',
  './world_horizon.js?v=alderwing-steady-v472-20260925',
  './world_water_core.js?v=alderwing-nature-v470-20260925',
  './world_water.js?v=alderwing-nature-v470-20260925',
  './open_land_core.js?v=alderwing-flight-shores-v418-20260915',
  './exploration_core.js?v=alderwing-followups-v417-20260914',
  './exploration.js?v=calm-weather-v464-20260924',
  './exploration.css?v=calm-camp-v463-20260924',
  './geographic_world.js?v=hands-on-world-tutorial-v429-20260920',
  './geographic_world.css?v=home-countryside-v387-20260910',

  './quest_pocket_core.js?v=pocket-detours-v382-20260910',
  './side_trail_core.js?v=pocket-detours-v382-20260910',
  './player_home.css?v=home-ground-intro-v451-20260923',
  './player_home_core.js?v=home-ground-intro-v451-20260923',
  './player_home_scene.js?v=home-ground-intro-v451-20260923',
  './player_home.js?v=calm-asmr-v462-20260924',
  './alderwing_intro.js?v=home-ground-intro-v451-20260923',
  './merlin_story_scenes.js?v=merlin-opening-v467-20260924',
  './merlin_story_scenes.css?v=merlin-opening-v467-20260924',
  './assets/special-birds/rook-witch-scene.webp',

  './appearance_core.js?v=appearance-v362-20260907',
  './appearance_ui.css?v=appearance-v362-20260907',
  './field_map_ui.js?v=alderwing-intro-desk-v420-20260917',
  './field_map_ui.css?v=alderwing-intro-desk-v420-20260917',
  './illustrated_world.css?v=alderwing-intro-desk-v420-20260917',
  './landscape_ui.css?v=landscape-v388-20260910',
  './landscape_ui.js?v=landscape-v388-20260910',
  './geographic_forest_core.js?v=continuous-world-v391-20260910',
  './geographic_forest_worker.js?v=continuous-world-v391-20260910',
  './geographic_camera_core.js?v=map-pictures-v374-20260908',
  './geographic_marker_layer.js?v=map-pictures-v374-20260908',
  './geographic_map_3d.js?v=map-camera-v403-20260914',
  './geographic_map_3d.css?v=night-quests-v376-20260908',
  './geographic_surfaces.js?v=map-pictures-v374-20260908',
  './geographic_places_core.js?v=quest-revisit-v457-20260923',
  './map_trail_core.js?v=quest-revisit-v457-20260923',
  './geographic_details_scene.js?v=quest-buildings-v402-20260913',
  './scan_home.css?v=academy-living-tree-v473-20260925',
  './scan_home_core.js?v=academy-living-tree-v473-20260925',
  './scan_home.js?v=academy-living-tree-v473-20260925',
  './photo_queue.js?v=bird-photo-recognition-v425-20260918',
  './photo_queue.css?v=gemini-photos-v410-20260914',
  './assets/home-v378/woodland-lookout.webp',
  './assets/home-v384/enchanted-study.webp',
  './assets/home-v395/living-field-desk.webp',
  './assets/dashboard-banners/training.webp',
  './assets/dashboard-banners/hospital.webp',
  './assets/dashboard-banners/kitchen.webp',
  './assets/dashboard-banners/crafting.webp',
  './assets/dashboard-banners/open-camera.webp',
  './assets/dashboard-banners/start-sound-scan.webp',
  './assets/dashboard-banners/your-empire.webp',
  './assets/dashboard-banners/saltmere.webp',
  './assets/bird-cards-v411/blue_tit-manga-20260914.webp',
  './assets/bird-cards-v411/great_tit-manga-20260914.webp',
  './assets/bird-cards-v411/long_tailed_tit-manga-20260914.webp',
  './assets/bird-cards-v411/goldcrest-manga-20260914.webp',
  './assets/home-v399/warrior-equipment.webp',
  './area_birds.css?v=area-birds-v377-20260909',
  './area_birds_taxonomy.js?v=area-birds-v377-20260909',
  './area_birds_core.js?v=area-birds-v377-20260909',
  './area_birds.js?v=area-birds-v377-20260909',
  './geographic_daynight_core.js?v=night-quests-v376-20260908',
  './geographic_daynight.js?v=red-gold-pocket-v437-20260921',
  './geographic_places.js?v=quest-revisit-v457-20260923',
  './geographic_places.css?v=quest-buildings-v402-20260913',
  './data/geographic-terrain-credits.html',
  './data/bird-education-enrichment-v366.json?v=illustrated-world-v366-20260907',
  './data/bird-facts-v366.json?v=illustrated-world-v366-20260907',
  './assets/illustrated-world-v366/card-folio.webp',
  './assets/illustrated-world-v366/settlements.webp',
  './academy_flight_core.js?v=connected-world-v386-20260910',
  './academy_flight.js?v=map-pictures-v374-20260908',
  './village_harvest_core.js?v=map-pictures-v374-20260908',
  './village_harvest.js?v=calm-asmr-v462-20260924',
  './interior_life_core.js?v=map-pictures-v374-20260908',
  './interior_life.js?v=calm-asmr-v462-20260924',
  './assets/academy-rooms-v370/magpie-market.webp',
  './assets/academy-rooms-v370/library.webp',
  './assets/academy-rooms-v370/manager-office.webp',
  './building_rooms_core.js?v=tavern-hall-open-v450-20260923',
  './building_rooms_scene.js?v=hall-music-v458-20260923',
  './building_rooms.js?v=hall-music-v458-20260923',
  './village_world_core.js?v=alderwing-steady-v472-20260925',
  './village_world.js?v=alderwing-steady-v472-20260925',
  './wilderness_places_core.js?v=wilderness-discoveries-v406-20260914',
  './wilderness_places.js?v=wilderness-discoveries-v406-20260914',
  './wilderness_places.css?v=wilderness-discoveries-v406-20260914',

  './world_sky.js?v=distant-sky-v401-20260913',
  './village_walk.js?v=alderwing-steady-v472-20260925',
  './building_work_core.js?v=builder-help-v404-20260914',
  './building_work.js?v=building-opening-v405-20260914',
  './building_work.css?v=craft-home-repair-v440-20260922',
  './first_person_map.js?v=alderwing-flight-shores-v418-20260915',
  './first_person_hud.js?v=hands-on-world-tutorial-v429-20260920',
  './first_person_hud.css?v=craft-home-repair-v440-20260922',
  './player_equipment_core.js?v=continuous-world-v391-20260910',
  './player_equipment.js?v=alderwing-followups-v417-20260914',
  './first_person_spell_core.js?v=wilderness-birds-v395-20260913',
  './first_person_cast_controls.js?v=alderwing-followups-v417-20260914',
  './zombie_progression_core.js?v=alderwing-flight-shores-v418-20260915',
  './wilderness_combat_core.js?v=alderwing-flight-shores-v418-20260915',
  './wilderness_birds.js?v=alderwing-flight-shores-v418-20260915',
  './wilderness_combat.js?v=alderwing-nature-v470-20260925',
  './first_person_cast_controls.css?v=continuous-world-v391-20260910',
  './wilderness_combat.css?v=alderwing-flight-shores-v418-20260915',
  './player_equipment.css?v=wilderness-birds-v395-20260913',
  './village_harvest_scene.js?v=homestead-v385-20260910',
  './village_discoveries.css?v=destination-cleanup-v434-20260921',
  './assets/discoveries-v385/alderwing-objects.webp',
  './village_walk_core.js?v=alderwing-followups-v417-20260914',
  './village_walk_scene.js?v=wilderness-discoveries-v406-20260914',
  './village_walk.css?v=alderwing-qst-ui-save-v432-20260921',
  './village_discovery_content.js?v=homestead-v385-20260910',
  './village_discovery_core.js?v=destination-cleanup-v434-20260921',
  './village_discoveries.js?v=destination-cleanup-v434-20260921',
  './comic_ui.css?v=appearance-v362-20260907',
  './assets/comic-ui/ink-paper-v359.webp',
  './',
  './index.html',
  './woodland_ui.css?v=woodland-finish-v360-20260907',
  './special_bird_sprites.js?v=special-card-sprites-20260907',
  './special_bird_sprites.css?v=special-card-sprites-20260907',
  './assets/special-birds/rook-witch.webp?v=special-card-sprites-20260907',
  './assets/special-birds/peregrine-falcon.webp?v=special-card-sprites-20260907',
  './assets/special-birds/brandon-lee.webp?v=special-card-sprites-20260907',
  './assets/special-birds/steven.webp?v=special-card-sprites-20260907',
  './assets/special-birds/rook-witch-scene.webp?v=special-card-sprites-20260907',
  './assets/special-birds/brandon-lee-scene.webp?v=special-card-sprites-20260907',
  './assets/special-birds/steven-scene.webp?v=special-card-sprites-20260907',
  './walking_route_core.js?v=walking-quests-v361-20260907',
  './walking_encounter_core.js?v=walking-quests-v361-20260907',
  './walking_quest_ui.js?v=walk-shelter-controls-v427-20260920',
  './walking_quest_ui.css?v=walk-shelter-controls-v427-20260920',
  './destination_route_core.js?v=red-gold-pocket-v437-20260921',
  './destination_elevation_core.js?v=destination-cleanup-v434-20260921',
  './destination_reward_core.js?v=destination-cleanup-v434-20260921',
  './destination_state_core.js?v=quest-revisit-v457-20260923',
  './destination_quest_ui.js?v=quest-revisit-v457-20260923',
  './destination_quest_ui.css?v=gold-trail-raven-v454-20260923',
  './assets/walking-quests/warden.webp',
  './assets/walking-quests/lantern-post.webp',
  './assets/walking-quests/wayfarer-rest.webp',
  './assets/comic-ui/battlefield-v359.webp',
  './assets/comic-ui/fonts/inter-latin.woff2',
  './assets/comic-ui/fonts/rajdhani-bold.woff2',
  './assets/comic-ui/fonts/russo-one.woff2',
  './lib/three.min.js?v=0.158.0',
  './lib/maplibre-gl.js?v=5.24.0',
  './lib/maplibre-gl.css?v=5.24.0',
  './empire_map_core.js?v=alderwing-followups-v417-20260914',
  './empire_realm_core.js?v=merge-when-ready-v290-20260820',
  './settlement_merge_core.js?v=village-work-huts-v311-20260824',
  './town_strategy_core.js?v=building-opening-v405-20260914',
  './empire_grid_core.js?v=empire-grid-v322-20260825',
  './village_manager_core.js?v=manager-builds-the-village-v324-20260825',
  './building_interior_core.js?v=tavern-hall-open-v450-20260923',
  './world_level_core.js?v=conquest-world-levels-v248-20260811',
  './daylight_core.js?v=real-sky-daylight-v243-20260810',
  './quest_core.js?v=landscape-atlas-v394-20260913',
  './walking_story_core.js?v=opening-home-v416-20260914',
  './trail_mode_core.js?v=trail-mode-v329-20260825',
  './building_discovery_core.js?v=building-discovery-v284-20260819',
  './village_variation_core.js?v=village-variation-v260-20260813',
  './peep_needs_core.js?v=academy-flight-v370-20260908',
  './settlement_life_core.js?v=little-folk-residents-v350-20260905',
  './settlement_models.js?v=tavern-hall-open-v450-20260923',
  './settlement_lighting.js?v=unified-alderwing-v400-20260913',
  './settlement_scene_core.js?v=little-folk-residents-v350-20260905',
  './assets/bird-card/weapon.webp',
  './assets/bird-card/armour.webp',
  './assets/bird-card/trinket.webp',
  './assets/bird-card/spell.webp',
  './assets/bird-card/potion.webp',
  './assets/bird-card/preen.webp',
  './assets/ui/empire-tab.webp',
  './assets/ui/towns-tab.webp',
  './assets/ui/villages-tab.webp',
  './assets/ui/merlin-listening-wand-v354.webp',
  './academy_treehouse_core.js?v=expedition-duration-v455-20260923',
  './academy_alive_core.js?v=opening-home-v416-20260914',
  './touch_steer_core.js?v=hold-to-steer-v251-20260811',
  './desk_portal.js?v=hall-music-v458-20260923',
  './first_village_tutorial.js?v=hall-music-v458-20260923',
  './academy_3d_core.js?v=opening-home-v416-20260914',
  './manga_render_core.js?v=alderwing-nature-v470-20260925',
  './kitchen_pantry_core.js?v=mallard-true-diet-v237-20260809',
  './data/bird-diet-records.js?v=mallard-true-diet-v237-20260809',
  './bird_diet_hunger_core.js?v=mallard-true-diet-v237-20260809',
  './bird_sleep_core.js?v=night-hunter-ascendant-v258-20260813',
  './diet_hunger_core.js?v=diet-hunger-release-20260723',
  './scan_economy_core.js?v=continuous-sound-discovery-v2-20260709',
  './sound_listener_core.js?v=birdnet-v3-accuracy-v5-20260729',
  './bird_home_range_core.js?v=bird-patch-map-v466-20260924',
  './bird_patch_map.js?v=bird-patch-map-v466-20260924',
  './bird_patch_map.css?v=bird-patch-map-v466-20260924',
  './uk_bird_expansion_50.js?v=uk50-source-backed-20260713',
  './uk_bird_expansion_2.js?v=uk26-source-backed-20260713',
  './au_bird_expansion.js?v=au-source-backed-20260713',
  './uk_bird_expansion_3.js?v=uk-regular-completion-20260715',
  './au_bird_expansion_2.js?v=au50-source-backed-r2-20260715',
  './national_bird_completion_20260715.js?v=national-completion-20260715',
  './uk_bird_expansion_4.js?v=uk-british-list-completion-20260722',
  './uk_bird_alias_completion_20260803.js?v=uk-bird-alias-completion-v216-20260803',
  './bird_art_release_20260727.js?v=raven-card-art-20260923',
  '/burbz/bird-art-cache/raven_burbz_cloaked_mountain_20260923.webp',
  './assets/tutorial-story/alderwing-spell-20260924.webp',
  './assets/tutorial-story/merlin-arrival-20260924.webp',
  './assets/tutorial-story/message-to-earth-20260924.webp',
  './assets/tutorial-story/shelter-invitation-20260924.webp',
  './assets/tutorial-story/warrior-freed-20260924.webp',
  './bird_art_release_20260803.js?v=manga-warrior-habitats-20260803',
  './bird_art_release_20260901.js?v=no-arms-card-art-v340-20260901',
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
  './assets/ui/burbz-icon-set/home.webp',
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
  './assets/academy-living-tree-20260925/tree.webp',
  './assets/academy-living-tree-20260925/tree-wide.webp',
  './assets/academy-living-tree-20260925/nursery.webp',
  './assets/academy-living-tree-20260925/observatory.webp',
  './assets/academy-living-tree-20260925/workshop.webp',
  './assets/academy-living-tree-20260925/library.webp',
  './assets/academy-living-tree-20260925/manager_office.webp',
  './assets/academy-living-tree-20260925/crowbar.webp',
  './assets/academy-living-tree-20260925/hospital.webp',
  './assets/academy-living-tree-20260925/kitchen.webp',
  './assets/academy-living-tree-20260925/training.webp',
  './assets/academy-living-tree-20260925/magpie_market.webp',
  './assets/academy-living-tree-20260925/quest_roost.webp',
  './assets/academy-living-tree-20260925/tavern.webp',
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
  './assets/building-interiors-manga/cabin.webp',
  './assets/building-interiors-manga/hut.webp',
  './assets/building-interiors-manga/farm.webp',
  './assets/building-interiors-manga/well.webp',
  './assets/building-interiors-manga/lumberhut.webp',
  './assets/building-interiors-manga/minehut.webp',
  './assets/building-interiors-manga/cottages.webp',
  './assets/building-interiors-manga/tavern.webp',
  './assets/building-interiors-manga/chapel.webp',
  './assets/building-interiors-manga/lumber.webp',
  './assets/building-interiors-manga/quarry.webp',
  './assets/building-interiors-manga/market.webp',
  './assets/building-interiors-manga/storehouse.webp',
  './assets/building-interiors-manga/foundry.webp',
  './assets/building-interiors-manga/entertainment.webp',
  './assets/building-interiors-manga/plot.webp',
  './bird_family_core.js?v=bird-families-mega-v1-20260728',
  './bird_size_core.js?v=every-bird-carries-its-weight-v335-20260827',
  './bird_roles_core.js?v=rook-recognition-special-characters-v347-20260904',
  './bird_bond_core.js?v=bird-bond-love-v256-20260812',
  './battle_core.js?v=alderwing-followups-v417-20260914',
  './battle_aim_core.js?v=little-folk-residents-v350-20260905',
  './loot_crafting_core.js?v=wilderness-birds-v395-20260913',
  './prerequisite_guidance_core.js?v=alderwing-followups-v417-20260914',
  './assets/audio/footsteps/calm-grass-01.mp3',
  './assets/audio/footsteps/calm-grass-02.mp3',
  './assets/audio/footsteps/calm-grass-03.mp3',
  './assets/audio/footsteps/calm-stone-01.mp3',
  './assets/audio/footsteps/calm-stone-02.mp3',
  './assets/audio/footsteps/calm-wood-01.mp3',
  './assets/audio/footsteps/calm-wood-02.mp3',
  './assets/audio/footsteps/calm-wood-03.mp3',
  './assets/audio/footsteps/tense-gravel-01.mp3',
  './assets/audio/footsteps/tense-gravel-02.mp3',
  './assets/audio/footsteps/tense-gravel-03.mp3',
  './assets/audio/footsteps/tense-gravel-04.mp3',
  './assets/audio/camp/campfire-loop.mp3',
  './assets/audio/camp/chop-01.mp3',
  './assets/audio/camp/chop-02.mp3',
  './assets/audio/camp/dust-01.mp3',
  './assets/audio/camp/dust-02.mp3',
  './assets/audio/camp/eat-01.mp3',
  './assets/audio/camp/eat-02.mp3',
  './assets/audio/camp/eat-03.mp3',
  './assets/audio/camp/stool.mp3',
  './assets/audio/weather/rain-loop.mp3',
  './assets/audio/weather/wind-loop.mp3',
  './audio_core.js?v=calm-camp-v463-20260924',
  './action_badge_core.js?v=barracks-tutorial-callout-v354-20260906',
  './onboarding_gate_core.js?v=opening-home-v416-20260914',
  './merlin_companion_core.js?v=opening-home-v416-20260914',
  './merlin_flight.js?v=merlin-flight-v390-20260910',
  './merlin_flight.css?v=merlin-flight-v1-20260907',
  './assets/merlin-flight/merlin-flight-v1.webp',
  './assets/merlin-flight/merlin-flight-v2.webp',
  './assets/merlin-flight/atlas-config.js?v=merlin-flight-v390-20260910',
  './diary_core.js?v=opening-home-v416-20260914',
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
  './assets/forge/anvil-v351.webp',
  './assets/quest-categories/food.webp',
  './assets/quest-categories/materials.webp',
  './assets/quest-categories/timber.webp',
  './assets/quest-categories/treasure.webp',
  './assets/quest-categories/diplomacy.webp',
  './assets/audio/little-folk/mumble-01.mp3',
  './assets/audio/little-folk/mumble-02.mp3',
  './assets/audio/little-folk/mumble-03.mp3',
  './assets/audio/little-folk/mumble-04.mp3',
  './assets/audio/little-folk/mumble-05.mp3',
  './assets/audio/little-folk/mumble-06.mp3',
  './assets/audio/little-folk/mumble-07.mp3',
  './assets/audio/little-folk/mumble-08.mp3',
  './assets/audio/little-folk/mumble-09.mp3',
  './assets/audio/little-folk/mumble-10.mp3',
  './assets/audio/little-folk/mumble-11.mp3',
  './assets/audio/little-folk/mumble-12.mp3',
  './assets/audio/little-folk/mumble-13.mp3',
  './assets/audio/little-folk/mumble-14.mp3',
  './assets/audio/little-folk/mumble-15.mp3',
  './assets/audio/little-folk/mumble-16.mp3',
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
  './icons/maskable-512.png',
  './enemy_outposts.css?v=alderwing-followups-v417-20260914',
  './enemy_outposts.js?v=alderwing-flight-shores-v418-20260915',
  './enemy_outposts_core.js?v=alderwing-flight-shores-v418-20260915',
  './assets/audio/fireball-v412/cast.mp3',
  './assets/audio/fireball-v412/charge.mp3',
  './assets/audio/fireball-v412/impact.mp3',
];
BURBZ_ASSETS.push(...UK50_LOCAL_ART, ...UK50_LOCAL_CUTOUTS, ...NEW_LOCAL_ART, ...NEW_LOCAL_CUTOUTS);
BURBZ_ASSETS.push(...UK4_ART);

// The app shell must cache or the install fails; artwork/video are best-effort
// so one missing file can never knock out offline support for the whole game.
const BURBZ_CORE = [
  './lib/maplibre-gl.js?v=5.24.0',
  './lib/maplibre-gl.css?v=5.24.0',
  './geographic_cache.js?v=connected-world-v386-20260910',
  './geographic_home_picker.js?v=alderwing-intro-desk-v420-20260917',
  './geographic_settlement_scene.js?v=connected-world-v386-20260910',
  './geographic_world_core.js?v=gps-shelter-swimming-v439-20260922',
  './flight_craft_core.js?v=craft-home-repair-v440-20260922',
  './flight_craft.js?v=alderwing-steady-v472-20260925',
  './shore_water.js?v=alderwing-nature-v470-20260925',
  './world_nature_core.js?v=alderwing-steady-v472-20260925',
  './world_nature.js?v=alderwing-steady-v472-20260925',
  './world_horizon.js?v=alderwing-steady-v472-20260925',
  './world_water_core.js?v=alderwing-nature-v470-20260925',
  './world_water.js?v=alderwing-nature-v470-20260925',
  './open_land_core.js?v=alderwing-flight-shores-v418-20260915',
  './exploration_core.js?v=alderwing-followups-v417-20260914',
  './exploration.js?v=calm-weather-v464-20260924',
  './exploration.css?v=calm-camp-v463-20260924',
  './geographic_world.js?v=hands-on-world-tutorial-v429-20260920',
  './geographic_world.css?v=home-countryside-v387-20260910',

  './quest_pocket_core.js?v=pocket-detours-v382-20260910',
  './side_trail_core.js?v=pocket-detours-v382-20260910',
  './player_home.css?v=home-ground-intro-v451-20260923',
  './player_home_core.js?v=home-ground-intro-v451-20260923',
  './player_home_scene.js?v=home-ground-intro-v451-20260923',
  './player_home.js?v=calm-asmr-v462-20260924',
  './alderwing_intro.js?v=home-ground-intro-v451-20260923',
  './merlin_story_scenes.js?v=merlin-opening-v467-20260924',
  './merlin_story_scenes.css?v=merlin-opening-v467-20260924',
  './assets/special-birds/rook-witch-scene.webp',

  './appearance_core.js?v=appearance-v362-20260907',
  './appearance_ui.css?v=appearance-v362-20260907',
  './field_map_ui.js?v=alderwing-intro-desk-v420-20260917',
  './field_map_ui.css?v=alderwing-intro-desk-v420-20260917',
  './illustrated_world.css?v=alderwing-intro-desk-v420-20260917',
  './landscape_ui.css?v=landscape-v388-20260910',
  './landscape_ui.js?v=landscape-v388-20260910',
  './geographic_forest_core.js?v=continuous-world-v391-20260910',
  './geographic_forest_worker.js?v=continuous-world-v391-20260910',
  './geographic_camera_core.js?v=map-pictures-v374-20260908',
  './geographic_marker_layer.js?v=map-pictures-v374-20260908',
  './geographic_map_3d.js?v=map-camera-v403-20260914',
  './geographic_map_3d.css?v=night-quests-v376-20260908',
  './geographic_surfaces.js?v=map-pictures-v374-20260908',
  './geographic_places_core.js?v=quest-revisit-v457-20260923',
  './map_trail_core.js?v=quest-revisit-v457-20260923',
  './geographic_details_scene.js?v=quest-buildings-v402-20260913',
  './scan_home.css?v=academy-living-tree-v473-20260925',
  './scan_home_core.js?v=academy-living-tree-v473-20260925',
  './scan_home.js?v=academy-living-tree-v473-20260925',
  './photo_queue.js?v=bird-photo-recognition-v425-20260918',
  './photo_queue.css?v=gemini-photos-v410-20260914',
  './assets/home-v378/woodland-lookout.webp',
  './assets/home-v384/enchanted-study.webp',
  './assets/home-v395/living-field-desk.webp',
  './assets/dashboard-banners/training.webp',
  './assets/dashboard-banners/hospital.webp',
  './assets/dashboard-banners/kitchen.webp',
  './assets/dashboard-banners/crafting.webp',
  './assets/dashboard-banners/open-camera.webp',
  './assets/dashboard-banners/start-sound-scan.webp',
  './assets/dashboard-banners/your-empire.webp',
  './assets/dashboard-banners/saltmere.webp',
  './assets/bird-cards-v411/blue_tit-manga-20260914.webp',
  './assets/bird-cards-v411/great_tit-manga-20260914.webp',
  './assets/bird-cards-v411/long_tailed_tit-manga-20260914.webp',
  './assets/bird-cards-v411/goldcrest-manga-20260914.webp',
  './assets/home-v399/warrior-equipment.webp',
  './area_birds.css?v=area-birds-v377-20260909',
  './area_birds_taxonomy.js?v=area-birds-v377-20260909',
  './area_birds_core.js?v=area-birds-v377-20260909',
  './area_birds.js?v=area-birds-v377-20260909',
  './geographic_daynight_core.js?v=night-quests-v376-20260908',
  './geographic_daynight.js?v=red-gold-pocket-v437-20260921',
  './geographic_places.js?v=quest-revisit-v457-20260923',
  './geographic_places.css?v=quest-buildings-v402-20260913',
  './data/geographic-terrain-credits.html',
  './data/bird-education-enrichment-v366.json?v=illustrated-world-v366-20260907',
  './data/bird-facts-v366.json?v=illustrated-world-v366-20260907',
  './assets/illustrated-world-v366/card-folio.webp',
  './assets/illustrated-world-v366/settlements.webp',
  './academy_flight_core.js?v=connected-world-v386-20260910',
  './academy_flight.js?v=map-pictures-v374-20260908',
  './village_harvest_core.js?v=map-pictures-v374-20260908',
  './village_harvest.js?v=calm-asmr-v462-20260924',
  './interior_life_core.js?v=map-pictures-v374-20260908',
  './interior_life.js?v=calm-asmr-v462-20260924',
  './assets/academy-rooms-v370/magpie-market.webp',
  './assets/academy-rooms-v370/library.webp',
  './assets/academy-rooms-v370/manager-office.webp',
  './building_rooms_core.js?v=tavern-hall-open-v450-20260923',
  './building_rooms_scene.js?v=hall-music-v458-20260923',
  './building_rooms.js?v=hall-music-v458-20260923',
  './village_world_core.js?v=alderwing-steady-v472-20260925',
  './village_world.js?v=alderwing-steady-v472-20260925',
  './wilderness_places_core.js?v=wilderness-discoveries-v406-20260914',
  './wilderness_places.js?v=wilderness-discoveries-v406-20260914',
  './wilderness_places.css?v=wilderness-discoveries-v406-20260914',

  './world_sky.js?v=distant-sky-v401-20260913',
  './village_walk.js?v=alderwing-steady-v472-20260925',
  './building_work_core.js?v=builder-help-v404-20260914',
  './building_work.js?v=building-opening-v405-20260914',
  './building_work.css?v=craft-home-repair-v440-20260922',
  './first_person_map.js?v=alderwing-flight-shores-v418-20260915',
  './first_person_hud.js?v=hands-on-world-tutorial-v429-20260920',
  './first_person_hud.css?v=craft-home-repair-v440-20260922',
  './player_equipment_core.js?v=continuous-world-v391-20260910',
  './player_equipment.js?v=alderwing-followups-v417-20260914',
  './first_person_spell_core.js?v=wilderness-birds-v395-20260913',
  './first_person_cast_controls.js?v=alderwing-followups-v417-20260914',
  './zombie_progression_core.js?v=alderwing-flight-shores-v418-20260915',
  './wilderness_combat_core.js?v=alderwing-flight-shores-v418-20260915',
  './wilderness_birds.js?v=alderwing-flight-shores-v418-20260915',
  './wilderness_combat.js?v=alderwing-nature-v470-20260925',
  './first_person_cast_controls.css?v=continuous-world-v391-20260910',
  './wilderness_combat.css?v=alderwing-flight-shores-v418-20260915',
  './player_equipment.css?v=wilderness-birds-v395-20260913',
  './village_harvest_scene.js?v=homestead-v385-20260910',
  './village_discoveries.css?v=destination-cleanup-v434-20260921',
  './assets/discoveries-v385/alderwing-objects.webp',
  './village_walk_core.js?v=alderwing-followups-v417-20260914',
  './village_walk_scene.js?v=wilderness-discoveries-v406-20260914',
  './village_walk.css?v=alderwing-qst-ui-save-v432-20260921',
  './village_discovery_content.js?v=homestead-v385-20260910',
  './village_discovery_core.js?v=destination-cleanup-v434-20260921',
  './village_discoveries.js?v=destination-cleanup-v434-20260921',
  './comic_ui.css?v=appearance-v362-20260907',
  './assets/comic-ui/ink-paper-v359.webp',
  './woodland_ui.css?v=woodland-finish-v360-20260907',
  './special_bird_sprites.js?v=special-card-sprites-20260907',
  './special_bird_sprites.css?v=special-card-sprites-20260907',
  './assets/special-birds/rook-witch.webp?v=special-card-sprites-20260907',
  './assets/special-birds/peregrine-falcon.webp?v=special-card-sprites-20260907',
  './assets/special-birds/brandon-lee.webp?v=special-card-sprites-20260907',
  './assets/special-birds/steven.webp?v=special-card-sprites-20260907',
  './assets/special-birds/rook-witch-scene.webp?v=special-card-sprites-20260907',
  './assets/special-birds/brandon-lee-scene.webp?v=special-card-sprites-20260907',
  './assets/special-birds/steven-scene.webp?v=special-card-sprites-20260907',
  './quest_core.js?v=landscape-atlas-v394-20260913',
  './walking_route_core.js?v=walking-quests-v361-20260907',
  './walking_encounter_core.js?v=walking-quests-v361-20260907',
  './walking_quest_ui.js?v=walk-shelter-controls-v427-20260920',
  './walking_quest_ui.css?v=walk-shelter-controls-v427-20260920',
  './destination_route_core.js?v=red-gold-pocket-v437-20260921',
  './destination_elevation_core.js?v=destination-cleanup-v434-20260921',
  './destination_reward_core.js?v=destination-cleanup-v434-20260921',
  './destination_state_core.js?v=quest-revisit-v457-20260923',
  './destination_quest_ui.js?v=quest-revisit-v457-20260923',
  './destination_quest_ui.css?v=gold-trail-raven-v454-20260923',
  './assets/walking-quests/warden.webp',
  './assets/walking-quests/lantern-post.webp',
  './assets/walking-quests/wayfarer-rest.webp',
  './assets/comic-ui/battlefield-v359.webp',
  './assets/comic-ui/fonts/inter-latin.woff2',
  './assets/comic-ui/fonts/rajdhani-bold.woff2',
  './assets/comic-ui/fonts/russo-one.woff2',
  './manga_render_core.js?v=alderwing-nature-v470-20260925',
  './academy_3d_core.js?v=opening-home-v416-20260914',
  './index.html',
  './lib/three.min.js?v=0.158.0',
  './empire_realm_core.js?v=merge-when-ready-v290-20260820',
  './settlement_merge_core.js?v=village-work-huts-v311-20260824',
  './town_strategy_core.js?v=building-opening-v405-20260914',
  './empire_grid_core.js?v=empire-grid-v322-20260825',
  './village_manager_core.js?v=manager-builds-the-village-v324-20260825',
  './building_interior_core.js?v=tavern-hall-open-v450-20260923',
  // 3D village ground detail (small, and the village looks flat without them)
  './assets/tex/grass_c.jpg',
  './assets/tex/grass_n.jpg',
  './assets/tex/cobble_c.jpg',
  './assets/tex/cobble_n.jpg',
  './academy_treehouse_core.js?v=expedition-duration-v455-20260923',
  './kitchen_pantry_core.js?v=mallard-true-diet-v237-20260809',
  './data/bird-diet-records.js?v=mallard-true-diet-v237-20260809',
  './bird_diet_hunger_core.js?v=mallard-true-diet-v237-20260809',
  './bird_sleep_core.js?v=night-hunter-ascendant-v258-20260813',
  './diet_hunger_core.js?v=diet-hunger-release-20260723',
  './bird_family_core.js?v=bird-families-mega-v1-20260728',
  './bird_size_core.js?v=every-bird-carries-its-weight-v335-20260827',
  './bird_roles_core.js?v=rook-recognition-special-characters-v347-20260904',
  './bird_bond_core.js?v=bird-bond-love-v256-20260812',
  './battle_core.js?v=alderwing-followups-v417-20260914',
  './battle_aim_core.js?v=little-folk-residents-v350-20260905',
  './loot_crafting_core.js?v=wilderness-birds-v395-20260913',
  './prerequisite_guidance_core.js?v=alderwing-followups-v417-20260914',
  './world_level_core.js?v=conquest-world-levels-v248-20260811',
  './walking_story_core.js?v=opening-home-v416-20260914',
  './trail_mode_core.js?v=trail-mode-v329-20260825',
  './building_discovery_core.js?v=building-discovery-v284-20260819',
  './village_variation_core.js?v=village-variation-v260-20260813',
  './peep_needs_core.js?v=academy-flight-v370-20260908',
  './settlement_life_core.js?v=little-folk-residents-v350-20260905',
  './settlement_models.js?v=tavern-hall-open-v450-20260923',
  './settlement_lighting.js?v=unified-alderwing-v400-20260913',
  './settlement_scene_core.js?v=little-folk-residents-v350-20260905',
  './assets/audio/footsteps/calm-grass-01.mp3',
  './assets/audio/footsteps/calm-grass-02.mp3',
  './assets/audio/footsteps/calm-grass-03.mp3',
  './assets/audio/footsteps/calm-stone-01.mp3',
  './assets/audio/footsteps/calm-stone-02.mp3',
  './assets/audio/footsteps/calm-wood-01.mp3',
  './assets/audio/footsteps/calm-wood-02.mp3',
  './assets/audio/footsteps/calm-wood-03.mp3',
  './assets/audio/footsteps/tense-gravel-01.mp3',
  './assets/audio/footsteps/tense-gravel-02.mp3',
  './assets/audio/footsteps/tense-gravel-03.mp3',
  './assets/audio/footsteps/tense-gravel-04.mp3',
  './assets/audio/camp/campfire-loop.mp3',
  './assets/audio/camp/chop-01.mp3',
  './assets/audio/camp/chop-02.mp3',
  './assets/audio/camp/dust-01.mp3',
  './assets/audio/camp/dust-02.mp3',
  './assets/audio/camp/eat-01.mp3',
  './assets/audio/camp/eat-02.mp3',
  './assets/audio/camp/eat-03.mp3',
  './assets/audio/camp/stool.mp3',
  './assets/audio/weather/rain-loop.mp3',
  './assets/audio/weather/wind-loop.mp3',
  './audio_core.js?v=calm-camp-v463-20260924',
  './action_badge_core.js?v=barracks-tutorial-callout-v354-20260906',
  './onboarding_gate_core.js?v=opening-home-v416-20260914',
  './merlin_companion_core.js?v=opening-home-v416-20260914',
  './merlin_flight.js?v=merlin-flight-v390-20260910',
  './merlin_flight.css?v=merlin-flight-v1-20260907',
  './assets/merlin-flight/merlin-flight-v1.webp',
  './assets/merlin-flight/merlin-flight-v2.webp',
  './assets/merlin-flight/atlas-config.js?v=merlin-flight-v390-20260910',
  './diary_core.js?v=opening-home-v416-20260914',
  './sound_listener_core.js?v=birdnet-v3-accuracy-v5-20260729',
  './bird_home_range_core.js?v=bird-patch-map-v466-20260924',
  './bird_patch_map.js?v=bird-patch-map-v466-20260924',
  './bird_patch_map.css?v=bird-patch-map-v466-20260924',
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
  './assets/ui/burbz-icon-set/home.webp',
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
  './assets/forge/anvil-v351.webp',
  './assets/quest-categories/food.webp',
  './assets/quest-categories/materials.webp',
  './assets/quest-categories/timber.webp',
  './assets/quest-categories/treasure.webp',
  './assets/quest-categories/diplomacy.webp',
  './assets/audio/little-folk/mumble-01.mp3',
  './assets/audio/little-folk/mumble-02.mp3',
  './assets/audio/little-folk/mumble-03.mp3',
  './assets/audio/little-folk/mumble-04.mp3',
  './assets/audio/little-folk/mumble-05.mp3',
  './assets/audio/little-folk/mumble-06.mp3',
  './assets/audio/little-folk/mumble-07.mp3',
  './assets/audio/little-folk/mumble-08.mp3',
  './assets/audio/little-folk/mumble-09.mp3',
  './assets/audio/little-folk/mumble-10.mp3',
  './assets/audio/little-folk/mumble-11.mp3',
  './assets/audio/little-folk/mumble-12.mp3',
  './assets/audio/little-folk/mumble-13.mp3',
  './assets/audio/little-folk/mumble-14.mp3',
  './assets/audio/little-folk/mumble-15.mp3',
  './assets/audio/little-folk/mumble-16.mp3',
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
  './bird_art_release_20260727.js?v=raven-card-art-20260923',
  '/burbz/bird-art-cache/raven_burbz_cloaked_mountain_20260923.webp',
  './assets/tutorial-story/alderwing-spell-20260924.webp',
  './assets/tutorial-story/merlin-arrival-20260924.webp',
  './assets/tutorial-story/message-to-earth-20260924.webp',
  './assets/tutorial-story/shelter-invitation-20260924.webp',
  './assets/tutorial-story/warrior-freed-20260924.webp',
  './bird_art_release_20260803.js?v=manga-warrior-habitats-20260803',
  './bird_art_release_20260901.js?v=no-arms-card-art-v340-20260901',
  './spain_boundary_20260715.js?v=spain-mainland-balearics-20260715',
  './data/uk-bird-education-50.json?v=au-source-backed-20260713',
  './data/regional-bird-education-20260715.json?v=regional-birds-v75-20260715',
  './data/national-bird-completion/manifest.json?v=national-completion-20260715',
  './manifest.json',
  './academy_alive_core.js?v=opening-home-v416-20260914',
  './touch_steer_core.js?v=hold-to-steer-v251-20260811',
  './desk_portal.js?v=hall-music-v458-20260923',
  './first_village_tutorial.js?v=hall-music-v458-20260923',
  './empire_map_core.js?v=alderwing-followups-v417-20260914',
  './daylight_core.js?v=real-sky-daylight-v243-20260810',
  './scan_economy_core.js?v=continuous-sound-discovery-v2-20260709',
  './enemy_outposts.css?v=alderwing-followups-v417-20260914',
  './enemy_outposts.js?v=alderwing-flight-shores-v418-20260915',
  './enemy_outposts_core.js?v=alderwing-flight-shores-v418-20260915',
  './assets/audio/fireball-v412/cast.mp3',
  './assets/audio/fireball-v412/charge.mp3',
  './assets/audio/fireball-v412/impact.mp3',
];

// Keep worker takeover dependable on phones with slow links or tight storage.
// Only the current document and its changed Town runtimes must succeed before
// the worker can activate. The rest of the offline shell is still warmed
// below, but a large audio/data file failing must never strand a player on an
// older build. Required entries are cached first so optional writes cannot
// consume the available quota ahead of them.
const BURBZ_INSTALL_REQUIRED = [
  './lib/maplibre-gl.js?v=5.24.0',
  './lib/maplibre-gl.css?v=5.24.0',
  './geographic_cache.js?v=connected-world-v386-20260910',
  './geographic_home_picker.js?v=alderwing-intro-desk-v420-20260917',
  './geographic_settlement_scene.js?v=connected-world-v386-20260910',
  './geographic_world_core.js?v=gps-shelter-swimming-v439-20260922',
  './flight_craft_core.js?v=craft-home-repair-v440-20260922',
  './flight_craft.js?v=alderwing-steady-v472-20260925',
  './shore_water.js?v=alderwing-nature-v470-20260925',
  './world_nature_core.js?v=alderwing-steady-v472-20260925',
  './world_nature.js?v=alderwing-steady-v472-20260925',
  './world_horizon.js?v=alderwing-steady-v472-20260925',
  './world_water_core.js?v=alderwing-nature-v470-20260925',
  './world_water.js?v=alderwing-nature-v470-20260925',
  './open_land_core.js?v=alderwing-flight-shores-v418-20260915',
  './exploration_core.js?v=alderwing-followups-v417-20260914',
  './exploration.js?v=calm-weather-v464-20260924',
  './exploration.css?v=calm-camp-v463-20260924',
  './geographic_world.js?v=hands-on-world-tutorial-v429-20260920',
  './geographic_world.css?v=home-countryside-v387-20260910',

  './quest_pocket_core.js?v=pocket-detours-v382-20260910',
  './side_trail_core.js?v=pocket-detours-v382-20260910',
  './player_home.css?v=home-ground-intro-v451-20260923',
  './player_home_core.js?v=home-ground-intro-v451-20260923',
  './player_home_scene.js?v=home-ground-intro-v451-20260923',
  './player_home.js?v=calm-asmr-v462-20260924',
  './alderwing_intro.js?v=home-ground-intro-v451-20260923',
  './merlin_story_scenes.js?v=merlin-opening-v467-20260924',
  './merlin_story_scenes.css?v=merlin-opening-v467-20260924',
  './assets/special-birds/rook-witch-scene.webp',

  './appearance_core.js?v=appearance-v362-20260907',
  './appearance_ui.css?v=appearance-v362-20260907',
  './field_map_ui.js?v=alderwing-intro-desk-v420-20260917',
  './field_map_ui.css?v=alderwing-intro-desk-v420-20260917',
  './illustrated_world.css?v=alderwing-intro-desk-v420-20260917',
  './landscape_ui.css?v=landscape-v388-20260910',
  './landscape_ui.js?v=landscape-v388-20260910',
  './geographic_forest_core.js?v=continuous-world-v391-20260910',
  './geographic_forest_worker.js?v=continuous-world-v391-20260910',
  './geographic_camera_core.js?v=map-pictures-v374-20260908',
  './geographic_marker_layer.js?v=map-pictures-v374-20260908',
  './geographic_map_3d.js?v=map-camera-v403-20260914',
  './geographic_map_3d.css?v=night-quests-v376-20260908',
  './geographic_surfaces.js?v=map-pictures-v374-20260908',
  './geographic_places_core.js?v=quest-revisit-v457-20260923',
  './map_trail_core.js?v=quest-revisit-v457-20260923',
  './geographic_details_scene.js?v=quest-buildings-v402-20260913',
  './scan_home.css?v=academy-living-tree-v473-20260925',
  './scan_home_core.js?v=academy-living-tree-v473-20260925',
  './scan_home.js?v=academy-living-tree-v473-20260925',
  './photo_queue.js?v=bird-photo-recognition-v425-20260918',
  './photo_queue.css?v=gemini-photos-v410-20260914',
  './assets/home-v378/woodland-lookout.webp',
  './assets/home-v384/enchanted-study.webp',
  './assets/home-v395/living-field-desk.webp',
  './assets/dashboard-banners/training.webp',
  './assets/dashboard-banners/hospital.webp',
  './assets/dashboard-banners/kitchen.webp',
  './assets/dashboard-banners/crafting.webp',
  './assets/dashboard-banners/open-camera.webp',
  './assets/dashboard-banners/start-sound-scan.webp',
  './assets/dashboard-banners/your-empire.webp',
  './assets/dashboard-banners/saltmere.webp',
  './assets/bird-cards-v411/blue_tit-manga-20260914.webp',
  './assets/bird-cards-v411/great_tit-manga-20260914.webp',
  './assets/bird-cards-v411/long_tailed_tit-manga-20260914.webp',
  './assets/bird-cards-v411/goldcrest-manga-20260914.webp',
  './assets/home-v399/warrior-equipment.webp',
  './area_birds.css?v=area-birds-v377-20260909',
  './area_birds_taxonomy.js?v=area-birds-v377-20260909',
  './area_birds_core.js?v=area-birds-v377-20260909',
  './area_birds.js?v=area-birds-v377-20260909',
  './geographic_daynight_core.js?v=night-quests-v376-20260908',
  './geographic_daynight.js?v=red-gold-pocket-v437-20260921',
  './geographic_places.js?v=quest-revisit-v457-20260923',
  './geographic_places.css?v=quest-buildings-v402-20260913',
  './data/geographic-terrain-credits.html',
  './data/bird-education-enrichment-v366.json?v=illustrated-world-v366-20260907',
  './data/bird-facts-v366.json?v=illustrated-world-v366-20260907',
  './assets/illustrated-world-v366/card-folio.webp',
  './assets/illustrated-world-v366/settlements.webp',
  './academy_flight_core.js?v=connected-world-v386-20260910',
  './academy_flight.js?v=map-pictures-v374-20260908',
  './village_harvest_core.js?v=map-pictures-v374-20260908',
  './village_harvest.js?v=calm-asmr-v462-20260924',
  './interior_life_core.js?v=map-pictures-v374-20260908',
  './interior_life.js?v=calm-asmr-v462-20260924',
  './assets/academy-rooms-v370/magpie-market.webp',
  './assets/academy-rooms-v370/library.webp',
  './assets/academy-rooms-v370/manager-office.webp',
  './building_rooms_core.js?v=tavern-hall-open-v450-20260923',
  './building_rooms_scene.js?v=hall-music-v458-20260923',
  './building_rooms.js?v=hall-music-v458-20260923',
  './village_world_core.js?v=alderwing-steady-v472-20260925',
  './village_world.js?v=alderwing-steady-v472-20260925',
  './wilderness_places_core.js?v=wilderness-discoveries-v406-20260914',
  './wilderness_places.js?v=wilderness-discoveries-v406-20260914',
  './wilderness_places.css?v=wilderness-discoveries-v406-20260914',

  './world_sky.js?v=distant-sky-v401-20260913',
  './village_walk.js?v=alderwing-steady-v472-20260925',
  './building_work_core.js?v=builder-help-v404-20260914',
  './building_work.js?v=building-opening-v405-20260914',
  './building_work.css?v=craft-home-repair-v440-20260922',
  './first_person_map.js?v=alderwing-flight-shores-v418-20260915',
  './first_person_hud.js?v=hands-on-world-tutorial-v429-20260920',
  './first_person_hud.css?v=craft-home-repair-v440-20260922',
  './player_equipment_core.js?v=continuous-world-v391-20260910',
  './player_equipment.js?v=alderwing-followups-v417-20260914',
  './first_person_spell_core.js?v=wilderness-birds-v395-20260913',
  './first_person_cast_controls.js?v=alderwing-followups-v417-20260914',
  './zombie_progression_core.js?v=alderwing-flight-shores-v418-20260915',
  './wilderness_combat_core.js?v=alderwing-flight-shores-v418-20260915',
  './wilderness_birds.js?v=alderwing-flight-shores-v418-20260915',
  './wilderness_combat.js?v=alderwing-nature-v470-20260925',
  './first_person_cast_controls.css?v=continuous-world-v391-20260910',
  './wilderness_combat.css?v=alderwing-flight-shores-v418-20260915',
  './player_equipment.css?v=wilderness-birds-v395-20260913',
  './village_harvest_scene.js?v=homestead-v385-20260910',
  './village_discoveries.css?v=destination-cleanup-v434-20260921',
  './assets/discoveries-v385/alderwing-objects.webp',
  './village_walk_core.js?v=alderwing-followups-v417-20260914',
  './village_walk_scene.js?v=wilderness-discoveries-v406-20260914',
  './village_walk.css?v=alderwing-qst-ui-save-v432-20260921',
  './village_discovery_content.js?v=homestead-v385-20260910',
  './village_discovery_core.js?v=destination-cleanup-v434-20260921',
  './village_discoveries.js?v=destination-cleanup-v434-20260921',
  './comic_ui.css?v=appearance-v362-20260907',
  './assets/comic-ui/ink-paper-v359.webp',
  './woodland_ui.css?v=woodland-finish-v360-20260907',
  './special_bird_sprites.js?v=special-card-sprites-20260907',
  './special_bird_sprites.css?v=special-card-sprites-20260907',
  './assets/special-birds/rook-witch.webp?v=special-card-sprites-20260907',
  './assets/special-birds/peregrine-falcon.webp?v=special-card-sprites-20260907',
  './assets/special-birds/brandon-lee.webp?v=special-card-sprites-20260907',
  './assets/special-birds/steven.webp?v=special-card-sprites-20260907',
  './assets/special-birds/rook-witch-scene.webp?v=special-card-sprites-20260907',
  './assets/special-birds/brandon-lee-scene.webp?v=special-card-sprites-20260907',
  './assets/special-birds/steven-scene.webp?v=special-card-sprites-20260907',
  './quest_core.js?v=landscape-atlas-v394-20260913',
  './walking_route_core.js?v=walking-quests-v361-20260907',
  './walking_encounter_core.js?v=walking-quests-v361-20260907',
  './walking_quest_ui.js?v=walk-shelter-controls-v427-20260920',
  './walking_quest_ui.css?v=walk-shelter-controls-v427-20260920',
  './destination_route_core.js?v=red-gold-pocket-v437-20260921',
  './destination_elevation_core.js?v=destination-cleanup-v434-20260921',
  './destination_reward_core.js?v=destination-cleanup-v434-20260921',
  './destination_state_core.js?v=quest-revisit-v457-20260923',
  './destination_quest_ui.js?v=quest-revisit-v457-20260923',
  './destination_quest_ui.css?v=gold-trail-raven-v454-20260923',
  './assets/walking-quests/warden.webp',
  './assets/walking-quests/lantern-post.webp',
  './assets/walking-quests/wayfarer-rest.webp',
  './assets/comic-ui/battlefield-v359.webp',
  './assets/comic-ui/fonts/inter-latin.woff2',
  './assets/comic-ui/fonts/rajdhani-bold.woff2',
  './assets/comic-ui/fonts/russo-one.woff2',
  './manga_render_core.js?v=alderwing-nature-v470-20260925',
  './academy_3d_core.js?v=opening-home-v416-20260914',
  './battle_core.js?v=alderwing-followups-v417-20260914',
  './battle_aim_core.js?v=little-folk-residents-v350-20260905',
  './loot_crafting_core.js?v=wilderness-birds-v395-20260913',
  './prerequisite_guidance_core.js?v=alderwing-followups-v417-20260914',
  './assets/audio/footsteps/calm-grass-01.mp3',
  './assets/audio/footsteps/calm-grass-02.mp3',
  './assets/audio/footsteps/calm-grass-03.mp3',
  './assets/audio/footsteps/calm-stone-01.mp3',
  './assets/audio/footsteps/calm-stone-02.mp3',
  './assets/audio/footsteps/calm-wood-01.mp3',
  './assets/audio/footsteps/calm-wood-02.mp3',
  './assets/audio/footsteps/calm-wood-03.mp3',
  './assets/audio/footsteps/tense-gravel-01.mp3',
  './assets/audio/footsteps/tense-gravel-02.mp3',
  './assets/audio/footsteps/tense-gravel-03.mp3',
  './assets/audio/footsteps/tense-gravel-04.mp3',
  './assets/audio/camp/campfire-loop.mp3',
  './assets/audio/camp/chop-01.mp3',
  './assets/audio/camp/chop-02.mp3',
  './assets/audio/camp/dust-01.mp3',
  './assets/audio/camp/dust-02.mp3',
  './assets/audio/camp/eat-01.mp3',
  './assets/audio/camp/eat-02.mp3',
  './assets/audio/camp/eat-03.mp3',
  './assets/audio/camp/stool.mp3',
  './assets/audio/weather/rain-loop.mp3',
  './assets/audio/weather/wind-loop.mp3',
  './audio_core.js?v=calm-camp-v463-20260924',
  './assets/forge/anvil-v351.webp',
  './assets/quest-categories/food.webp',
  './assets/quest-categories/materials.webp',
  './assets/quest-categories/timber.webp',
  './assets/quest-categories/treasure.webp',
  './assets/quest-categories/diplomacy.webp',
  './assets/audio/little-folk/mumble-01.mp3',
  './assets/audio/little-folk/mumble-02.mp3',
  './assets/audio/little-folk/mumble-03.mp3',
  './assets/audio/little-folk/mumble-04.mp3',
  './assets/audio/little-folk/mumble-05.mp3',
  './assets/audio/little-folk/mumble-06.mp3',
  './assets/audio/little-folk/mumble-07.mp3',
  './assets/audio/little-folk/mumble-08.mp3',
  './assets/audio/little-folk/mumble-09.mp3',
  './assets/audio/little-folk/mumble-10.mp3',
  './assets/audio/little-folk/mumble-11.mp3',
  './assets/audio/little-folk/mumble-12.mp3',
  './assets/audio/little-folk/mumble-13.mp3',
  './assets/audio/little-folk/mumble-14.mp3',
  './assets/audio/little-folk/mumble-15.mp3',
  './assets/audio/little-folk/mumble-16.mp3',
  './index.html',
  './merlin_companion_core.js?v=opening-home-v416-20260914',
  './merlin_flight.js?v=merlin-flight-v390-20260910',
  './merlin_flight.css?v=merlin-flight-v1-20260907',
  './assets/merlin-flight/merlin-flight-v1.webp',
  './assets/merlin-flight/merlin-flight-v2.webp',
  './assets/merlin-flight/atlas-config.js?v=merlin-flight-v390-20260910',
  './empire_realm_core.js?v=merge-when-ready-v290-20260820',
  './settlement_merge_core.js?v=village-work-huts-v311-20260824',
  './town_strategy_core.js?v=building-opening-v405-20260914',
  './empire_grid_core.js?v=empire-grid-v322-20260825',
  './village_manager_core.js?v=manager-builds-the-village-v324-20260825',
  './building_interior_core.js?v=tavern-hall-open-v450-20260923',
  './peep_needs_core.js?v=academy-flight-v370-20260908',
  './settlement_life_core.js?v=little-folk-residents-v350-20260905',
  './settlement_models.js?v=tavern-hall-open-v450-20260923',
  './settlement_lighting.js?v=unified-alderwing-v400-20260913',
  './settlement_scene_core.js?v=little-folk-residents-v350-20260905',
  './lib/three.min.js?v=0.158.0',
  './academy_treehouse_core.js?v=expedition-duration-v455-20260923',
  './academy_alive_core.js?v=opening-home-v416-20260914',
  './touch_steer_core.js?v=hold-to-steer-v251-20260811',
  './desk_portal.js?v=hall-music-v458-20260923',
  './first_village_tutorial.js?v=hall-music-v458-20260923',
  './kitchen_pantry_core.js?v=mallard-true-diet-v237-20260809',
  './data/bird-diet-records.js?v=mallard-true-diet-v237-20260809',
  './bird_diet_hunger_core.js?v=mallard-true-diet-v237-20260809',
  './bird_sleep_core.js?v=night-hunter-ascendant-v258-20260813',
  './diet_hunger_core.js?v=diet-hunger-release-20260723',
  './bird_family_core.js?v=bird-families-mega-v1-20260728',
  './bird_size_core.js?v=every-bird-carries-its-weight-v335-20260827',
  './bird_roles_core.js?v=rook-recognition-special-characters-v347-20260904',
  './bird_bond_core.js?v=bird-bond-love-v256-20260812',
  './empire_map_core.js?v=alderwing-followups-v417-20260914',
  './world_level_core.js?v=conquest-world-levels-v248-20260811',
  './daylight_core.js?v=real-sky-daylight-v243-20260810',
  './walking_story_core.js?v=opening-home-v416-20260914',
  './trail_mode_core.js?v=trail-mode-v329-20260825',
  './building_discovery_core.js?v=building-discovery-v284-20260819',
  './village_variation_core.js?v=village-variation-v260-20260813',
  './scan_economy_core.js?v=continuous-sound-discovery-v2-20260709',
  './sound_listener_core.js?v=birdnet-v3-accuracy-v5-20260729',
  './bird_home_range_core.js?v=bird-patch-map-v466-20260924',
  './bird_patch_map.js?v=bird-patch-map-v466-20260924',
  './bird_patch_map.css?v=bird-patch-map-v466-20260924',
  './uk_bird_expansion_50.js?v=uk50-source-backed-20260713',
  './uk_bird_expansion_2.js?v=uk26-source-backed-20260713',
  './au_bird_expansion.js?v=au-source-backed-20260713',
  './uk_bird_expansion_3.js?v=uk-regular-completion-20260715',
  './au_bird_expansion_2.js?v=au50-source-backed-r2-20260715',
  './national_bird_completion_20260715.js?v=national-completion-20260715',
  './uk_bird_expansion_4.js?v=uk-british-list-completion-20260722',
  './uk_bird_alias_completion_20260803.js?v=uk-bird-alias-completion-v216-20260803',
  './bird_art_release_20260727.js?v=raven-card-art-20260923',
  '/burbz/bird-art-cache/raven_burbz_cloaked_mountain_20260923.webp',
  './assets/tutorial-story/alderwing-spell-20260924.webp',
  './assets/tutorial-story/merlin-arrival-20260924.webp',
  './assets/tutorial-story/message-to-earth-20260924.webp',
  './assets/tutorial-story/shelter-invitation-20260924.webp',
  './assets/tutorial-story/warrior-freed-20260924.webp',
  './bird_art_release_20260803.js?v=manga-warrior-habitats-20260803',
  './bird_art_release_20260901.js?v=no-arms-card-art-v340-20260901',
  './spain_boundary_20260715.js?v=spain-mainland-balearics-20260715',
  './action_badge_core.js?v=barracks-tutorial-callout-v354-20260906',
  './onboarding_gate_core.js?v=opening-home-v416-20260914',
  './diary_core.js?v=opening-home-v416-20260914',
  './enemy_outposts.css?v=alderwing-followups-v417-20260914',
  './enemy_outposts.js?v=alderwing-flight-shores-v418-20260915',
  './enemy_outposts_core.js?v=alderwing-flight-shores-v418-20260915',
  './assets/audio/fireball-v412/cast.mp3',
  './assets/audio/fireball-v412/charge.mp3',
  './assets/audio/fireball-v412/impact.mp3',
];
// Generated gameplay art is best-effort (one bad image must never abort an
// update) but it is still warmed on install so a freshly updated offline game
// opens its rooms and equipment with the real art instead of fallbacks.
const BURBZ_GENERATED_ART_WARM = BURBZ_ASSETS.filter(asset =>
  asset.startsWith('.' + '/assets/gear/') ||
  asset.startsWith('.' + '/assets/building-interiors-manga/') ||
  asset === './assets/academy-interiors-manga/crowbar-v2-animated-20260819.webp' ||
  asset === './assets/academy-interiors-manga/kitchen-v2-animated-20260819.webp'
);
const BURBZ_FALLBACK_REQUIRED = Array.from(new Set([
  ...BURBZ_CORE.filter(asset => !BURBZ_INSTALL_REQUIRED.includes(asset)),
  ...BURBZ_GENERATED_ART_WARM,
  './assets/cutscenes/burbz-intro-two-part-hf-20260729.mp4'
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

// Cached full trailers also serve byte ranges for offline mobile playback/seek.
async function introCachedRange(response,request){
  const value=request.headers.get('range');if(!value||response.status!==200)return response;
  const m=/^bytes=(\d*)-(\d*)$/.exec(value);if(!m||(!m[1]&&!m[2]))return response;
  const blob=await response.blob(),size=blob.size;
  const start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2])),end=m[1]?(m[2]?Math.min(size-1,Number(m[2])):size-1):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
  const headers=new Headers(response.headers);headers.set('Content-Range','bytes '+start+'-'+end+'/'+size);headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');headers.delete('Content-Encoding');
  return new Response(blob.slice(start,end+1),{status:206,headers});
}

// These version-pinned Home dependencies are installed before activation. A
// stalled mobile connection must not hide an exact current-build cached copy
// behind the Home loader's 15-second deadline. Never prefer an old/different
// revision, and leave navigation, API, maps and all other fetch policy intact.
const BURBZ_HOME_DEPENDENCY_URLS = new Set(BURBZ_INSTALL_REQUIRED
  .filter(asset => /^\.\/(?:building_rooms_core|building_rooms_scene|village_walk_core)\.js\?v=/.test(asset))
  .map(asset => new URL(asset, self.location.href).href));
async function homeDependencyOrNetwork(request) {
  if (BURBZ_HOME_DEPENDENCY_URLS.has(request.url)) {
    try {
      const cached = await (await caches.open(BURBZ_CACHE)).match(request);
      if (cached && cached.ok) return cached;
    } catch (_) { /* CacheStorage failure must retain the normal network path. */ }
  }
  return fetch(request);
}

self.addEventListener('fetch', event => {
  if (self.BurbzGeographicCache.respond(event)) return;
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.includes('/api/')) return;

  event.respondWith(
    homeDependencyOrNetwork(request)
      .then(response => {
        const copy = response.clone();
        // Nothing this release ships asks GitHub for art any more. The allowance
        // stays for one release only, so a client still running the previous
        // build — mid-update, with the old remote URLs in flight — keeps working.
        // Remove it in the release after art-same-origin-v325-20260825.
        const cacheableArtHost = url.hostname === 'github.com' || url.hostname === 'raw.githubusercontent.com';
        // 206 partial responses (video/audio range requests) are rejected by
        // Cache.put with a TypeError, so don't try to store them.
        if (response.ok && response.status !== 206 && (url.origin === self.location.origin || cacheableArtHost)) {
          caches.open(BURBZ_CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        // The current canonical document wins over an old cached directory URL.
        // Otherwise /burbz/?reset=1 can silently reopen the previous build.
        const scopePath = new URL('./', self.location.href).pathname;
        const appEntry = request.mode === 'navigate' && url.origin === self.location.origin &&
          (url.pathname === scopePath || url.pathname === scopePath + 'index.html');
        if (appEntry) {
          const current = await (await caches.open(BURBZ_CACHE)).match('./index.html');
          if (current) return current;
        }
        const cached = await matchCurrentThenFallback(request, { ignoreSearch: true });
        if (cached) return url.pathname.endsWith('/assets/cutscenes/burbz-intro-two-part-hf-20260729.mp4') ? introCachedRange(cached, request) : cached;
        if (request.mode === 'navigate') return matchCurrentThenFallback('./index.html');
        return Response.error();
      })
  );
});
