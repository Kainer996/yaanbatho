# Woodland finish v360

Replaces PR290's bright `comic_ui.css` activation with `woodland_ui.css` and `body.woodland-ui` on the current f0a80ac baseline. The old stylesheet/assets remain available for rollback but the bright paper texture is no longer requested or precached.

Palette comes directly from the immediately preceding v358 inline styles: black/walnut #000000/#080706/#11100d/#1c1810, parchment #f4ead4/#c8b98f, brass #d6a84f/#8f6f2a and gold #f0c767. Rarity and health colours retain their existing semantics. New bevels, quiet top-edge highlights, layered shadows, active tab baselines and focus rings refine those surfaces without filtering artwork or covering world canvases. Existing local fonts and illustrated battlefield remain; the battlefield is lit with a warm dark overlay. v359 short-landscape battle arrangements remain.

Read-only server inspection found deployed SHA f0a80acfab3fee0882ce7a3875fab4cd44c34646, active automatic sync timer and no failed managed-file hashes. The recent /root/burbz-manga-v356 development checkout was clean; the older hosting checkout has extensive unrelated files/edits and was not modified. No reset or old draft integration was used.

Validation:
- 29 focused UI/cache/card/tutorial/Academy/flock checks passed.
- Broader changed-test run: 949 passed, 21 failed; all 21 failures reproduce on untouched f0a80ac in a matching sparse checkout (omitted assets/data and historical expectations). No fully passing broad-suite claim.
- Inline game scripts are byte-identical to v359 after normalizing only BURBZ_BUILD. Academy/model/lighting/manga/battle modules are byte-identical. Inline scripts, service worker and updater syntax pass; whitespace check passes.
- Actual local game captures: Forge before/after at390px, Quests before/after at390px, Materials selected state, companion dialog390px, collection1280px, battle390px, aim390px/844x390 landscape, and current 3D Academy1280px.
- Actual interactions: Forge Materials tab activates; companion Escape closes the overlay; Start Battle starts; Spark opens the real aim panel; Cancel closes it. No new console errors observed. No horizontal document overflow in the checked390px and844px views. Physical-phone FPS/touch/pinch are not certified.
- Browser fixtures are local-only: disposable seeded saves, blocked API/service-worker routes, no test hooks in shipped HTML.

Release: woodland-finish-v360-20260907. The new CSS is present in all three service-worker shell lists and the existing updater's managed file list. Core module pins and deployment workflows are unchanged. The cache retains v359 lineage and appends v360. Main publication would use the normal guarded workflow; this document itself is not a deployment claim.
