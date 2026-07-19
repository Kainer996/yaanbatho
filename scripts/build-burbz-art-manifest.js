#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const burbzDir = path.join(root, 'public', 'burbz');
const indexPath = path.join(burbzDir, 'index.html');
const outputPath = path.join(root, 'tmp', 'imagegen', 'burbz-placeholder-manifest.json');
const index = fs.readFileSync(indexPath, 'utf8');

function extractBalanced(text, startAt, open, close) {
  const start = text.indexOf(open, startAt);
  if (start < 0) throw new Error(`Could not find ${open} after offset ${startAt}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error(`Unbalanced ${open}${close} block`);
}

function evaluateLiteral(marker, open, close, from = 0) {
  const markerIndex = index.indexOf(marker, from);
  if (markerIndex < 0) throw new Error(`Marker not found: ${marker}`);
  return vm.runInNewContext(`(${extractBalanced(index, markerIndex, open, close)})`);
}

function requireBurbz(file) {
  return require(path.join(burbzDir, file));
}

function normaliseSpeciesKey(name) {
  return String(name || '')
    .split('(')[0]
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slug(name) {
  return normaliseSpeciesKey(name).replace(/ /g, '_');
}

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function weaponFor(profile, name) {
  const details = [
    name,
    profile && profile.group,
    profile && profile.family,
    profile && profile.order,
    ...((profile && profile.traits) || []),
  ].join(' ').toLowerCase();
  if (/eagle|hawk|falcon|harrier|kite|buzzard|vulture|raptor|accipitr|falconiform/.test(details)) {
    return 'an ornate medieval battle axe secured diagonally across its back harness';
  }
  if (/albatross|petrel|shearwater|booby|gannet|skua|gull|tern|puffin|murre|auk|seabird|coast|ocean/.test(details)) {
    return 'a weathered naval cutlass sheathed along its side harness';
  }
  if (/owl|nightjar|frogmouth|nocturnal/.test(details)) {
    return 'a dark engraved short sword sheathed securely at its side';
  }
  if (/duck|goose|swan|grebe|coot|gallinule|waterfowl/.test(details)) {
    return 'a compact double-headed axe strapped firmly across its back';
  }
  if (/stork|heron|egret|crane|ibis|spoonbill|sandpiper|plover|wader|shorebird/.test(details)) {
    return 'a slender ceremonial sword in a fitted back scabbard';
  }
  if (/parrot|cockatoo|lorikeet|macaw|corvid|crow|raven|magpie|bowerbird/.test(details)) {
    return 'an engraved war hammer mounted securely on its leather back harness';
  }
  const choices = [
    'a finely engraved short sword sheathed securely at its side',
    'a compact single-bladed axe strapped firmly across its back',
    'a narrow ranger sword carried in a fitted back scabbard',
    'a small crescent war axe mounted securely on its leather harness',
  ];
  return choices[stableHash(name) % choices.length];
}

function habitatFor(profile) {
  const parts = [];
  if (profile && profile.habitat) parts.push(`Habitat: ${profile.habitat}`);
  if (profile && profile.range) parts.push(`Range context: ${profile.range}`);
  if (profile && profile.origin) parts.push(`Native context: ${profile.origin}`);
  return parts.join('. ').slice(0, 900) || 'Use the species’ scientifically appropriate natural habitat and climate.';
}

const wildBase = evaluateLiteral('const WILD_BIRDS =', '[', ']');
const builtIn = evaluateLiteral('const BUILT_IN_BIRD_ART =', '{', '}');
const replacementMarker = index.indexOf('// Complete manga RPG artwork for species that previously used simple placeholders.');
const replacements = evaluateLiteral('Object.assign(BUILT_IN_BIRD_ART, {', '{', '}', replacementMarker);

const uk50 = requireBurbz('uk_bird_expansion_50.js');
const uk26 = requireBurbz('uk_bird_expansion_2.js');
const auExpansion = requireBurbz('au_bird_expansion.js');
const ukFinal = requireBurbz('uk_bird_expansion_3.js');
const au50 = requireBurbz('au_bird_expansion_2.js');
requireBurbz('national_bird_completion_20260715.js');
const national = globalThis.BURBZ_NATIONAL_BIRD_COMPLETION_20260715;

Object.assign(
  builtIn,
  uk50.art,
  uk26.art,
  auExpansion.art,
  ukFinal.art,
  au50.art,
  replacements,
);

const profiles = [
  ...uk50.profiles,
  ...uk26.profiles,
  ...auExpansion.profiles,
  ...ukFinal.profiles,
  ...au50.profiles,
  ...national.profiles,
];
const profilesByKey = new Map();
for (const profile of profiles) {
  for (const key of [profile.name, ...(profile.aliases || [])]) {
    const normalised = normaliseSpeciesKey(key);
    if (normalised && !profilesByKey.has(normalised)) profilesByKey.set(normalised, profile);
  }
}

const wildBirds = [];
const seenBirds = new Set();
function addWildBird(name) {
  const key = normaliseSpeciesKey(name);
  if (!name || seenBirds.has(key)) return;
  seenBirds.add(key);
  wildBirds.push(name);
}
wildBase.forEach(addWildBird);
[uk50, uk26, auExpansion, ukFinal, au50].forEach(expansion => expansion.names.forEach(addWildBird));
national.names.forEach(addWildBird);

function resolveBuiltInBirdArt(name) {
  if (builtIn[name]) return builtIn[name];
  const cleaned = String(name || '').split('(')[0].trim();
  if (builtIn[cleaned]) return builtIn[cleaned];
  const deRegionalised = cleaned.replace(/^(Common|Eurasian|European|Northern|British|Great|Lesser)\s+/i, '').trim();
  if (deRegionalised && builtIn[deRegionalised]) return builtIn[deRegionalised];
  const profile = profilesByKey.get(normaliseSpeciesKey(cleaned));
  if (profile) {
    if (builtIn[profile.name]) return builtIn[profile.name];
    for (const alias of profile.aliases || []) {
      if (builtIn[alias]) return builtIn[alias];
    }
  }
  return null;
}

const placeholderBirds = [];
for (const name of wildBirds) {
  const profile = profilesByKey.get(normaliseSpeciesKey(name));
  const currentArt = resolveBuiltInBirdArt(name) || (profile && profile.art) || null;
  if (!currentArt || !(/placeholder/i.test(currentArt) || /field_guide_art_pending/i.test(currentArt))) continue;
  const targetFile = `${slug(name)}_burbz_manga_rpg_20260720.webp`;
  const targetRelativePath = `public/burbz/bird-art-cache/completion-20260720/${targetFile}`;
  const targetUrl = `/burbz/bird-art-cache/completion-20260720/${targetFile}`;
  const weapon = weaponFor(profile, name);
  const habitat = habitatFor(profile);
  const prompt = [
    'Use case: stylized-concept',
    'Asset type: square collectible bird portrait for the Burbz game',
    `Primary request: Create one polished manga RPG warrior portrait of a scientifically recognizable ${name}.`,
    'Input images: Images 1–3 are style references only; match their detailed inked feathers, painterly manga finish, cinematic natural lighting, leather harnesses, and engraved medieval equipment.',
    `Scene/backdrop: ${habitat} Show a believable species-appropriate landscape, vegetation, weather, and climate.`,
    `Subject: One ${name} with accurate real-world plumage, bill, feet, proportions, and silhouette; ${weapon}.`,
    'Style/medium: high-detail manga fantasy wildlife illustration, crisp ink contours, richly rendered feathers, grounded natural colour, premium game-card artwork.',
    'Composition/framing: square 1:1 portrait, one bird only, full body or strong three-quarter body view, bird dominant in frame, habitat clearly visible.',
    'Constraints: natural bird anatomy only; exactly two natural wings and two legs; absolutely no arms, hands, fingers, humanoid shoulders, or extra limbs; wings remain ordinary feathered wings and do not grip objects; weapon must be secured to a fitted leather harness, belt, or scabbard and must not float; beak completely empty and closed or naturally relaxed; no weapon held in the beak; no clothing that hides species-identifying plumage; no text, border, logo, signature, or watermark.',
    'Avoid: human anatomy, anthropomorphic arms, weapon in mouth, wrong habitat, incorrect plumage, duplicate birds, cropped-off head, deformed feet, extra wings, extra legs, modern firearms, desert scenery for polar or aquatic birds.',
  ].join('\n');
  placeholderBirds.push({
    index: placeholderBirds.length + 1,
    species: name,
    scientificName: profile && (profile.scientificName || profile.scientific) || null,
    family: profile && profile.family || null,
    order: profile && profile.order || null,
    rarity: profile && profile.rarity || null,
    traits: profile && profile.traits || [],
    habitat,
    weapon,
    currentArt,
    placeholderKind: /\.svg(?:$|\?)/i.test(currentArt) ? 'svg' : 'png',
    targetFile,
    targetRelativePath,
    targetUrl,
    prompt,
    status: 'pending',
  });
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({
  version: 'burbz-placeholder-completion-20260720',
  generatedAt: new Date().toISOString(),
  referenceImages: [
    'C:/Users/theja/Downloads/Generated image 3.png',
    'C:/Users/theja/Downloads/Generated image 1 (1).png',
    'C:/Users/theja/Downloads/hf_20260706_010025_61181784-3c67-4c4f-bb16-c08ada46b51b.png',
  ],
  total: placeholderBirds.length,
  birds: placeholderBirds,
}, null, 2)}\n`);

console.log(`Wrote ${placeholderBirds.length} placeholder species to ${path.relative(root, outputPath)}`);
if (placeholderBirds.length !== 1121) {
  throw new Error(`Expected 1121 placeholders, found ${placeholderBirds.length}`);
}
