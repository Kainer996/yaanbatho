# Comic UI artwork, v359

Requested by Yaan on 2026-09-07: make the whole game UI brighter, bolder and
comic-book-like to match the approved manga 3D world, without changing bird
artwork. Follow-up: create a bright illustrated battlefield and overhaul the
battle screen in the same style.

Both original images were made with the built-in image-generation tool, not
the fallback API/CLI. No specific underlying model version was exposed by the
tool. Existing bird images, portraits, cutouts and enemy artwork are unchanged.

## Shipped assets

- `ink-paper-v359.webp`: 1200×800, 56,020 bytes. Ivory paper with yellow and
  turquoise ink corners. Decorative UI background, never a full-screen effect
  over game scenes or text.
- `battlefield-v359.webp`: 900×1350, 306,416 bytes. Sunlit woodland battlefield
  with distant ruins and banners. Used by battle selection, the live arena and
  results. The background does not intercept targeting or change combat.

Generated PNGs were resized and encoded as WebP with Sharp (quality 84/86).
No artwork was redrawn, masked, composited or recoloured during conversion.
Originals remain in the generating session's image output directory.

## Final prompts

### Ink paper

Use case: stylized-concept. Asset type: production game UI background texture,
not a screenshot or mockup. Create one original bold printed-manga/comic-book
background for a bright woodland bird adventure UI. Wide landscape composition,
approximately 3:2. Warm ivory paper dominates the central 70 percent, almost
empty and very lightly textured so real HTML text can be readable over it.
Around the outer corners only: confidently drawn thick near-black brush
strokes, energetic diagonal yellow ink slabs and small turquoise patches,
coarse halftone dot clusters, tiny imperfect risograph registration and paper
flecks. Friendly adventurous pop-comic energy, cel-shaded graphic ink,
substantial opaque colours, crisp visual design rather than grunge. Asymmetric
corner accents, beautiful negative space. No birds, no characters, no objects,
no icons, no text, no letters, no numerals, no logo, no watermark, no UI
controls, no panel grid. This is an actual reusable background asset; no
perspective, no photographed paper, no shadows cast outside the image, no
frame mockup. Keep the central reading area clean ivory.

### Battlefield

Use case: stylized-concept. Asset type: actual background plate for a mobile
turn-based bird battle game, not a UI mockup. Create a bright, gorgeous
stylized comic-book battlefield in the woodland kingdom of Alderwing. Portrait
2:3 composition intended to sit behind two opposing rows of existing bird
character sprites. Camera elevated slightly looking across a broad open
sunlit meadow sparring clearing. The lower 75 percent must be unobstructed
ochre-gold earth with short mint-green grass at its outer edges, readable open
flat ground for fighters; soft painted contact-shading only, no fighters.
Upper quarter: distant layered turquoise-green wooded hills, a few chunky
ink-outlined ruined stone walls and leaning pennant poles on the far outer
edges, warm azure sky and cream clouds. Strong thick dark hand-inked contours,
vivid cel-shaded 2D/3D depth, manga adventure-game finish, subtle halftone
shading in shadows, confident large colour shapes. Energetic and welcoming,
noon sunshine, yellow-green highlights, cool teal shadows. Crisp and
beautifully composed, not photorealistic. No characters, birds, animals,
people, weapons in foreground, corpses, blood, text, words, numbers, logos,
panels or UI controls. Keep the centre and foreground clean enough to clearly
see the game's existing bird sprites over it. This is a background asset for
actual gameplay.

## Fonts

The game's existing Inter, Rajdhani and Russo One families now have small
same-origin Latin WOFF2 fallbacks so the comic presentation works offline.
Total font payload: 71,288 bytes. Inter is variable (100–900); Rajdhani is
bold (700), Russo One is its original regular display face (400).
Existing remote faces remain available for additional scripts/weights.

Downloaded from Google Fonts on 2026-09-07:

- Inter: `https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2`
- Rajdhani: `https://fonts.gstatic.com/s/rajdhani/v17/LDI2apCSOBg7S-QT7pa8FvOreec.woff2`
- Russo One: `https://fonts.gstatic.com/s/russoone/v18/Z9XUDmZRWg6M1LvRYsHOz8mJ.woff2`

All three are redistributed under the SIL Open Font License 1.1. Original
copyright notices and complete licences are beside the fonts in `fonts/`.
The fonts are not modified or renamed.
