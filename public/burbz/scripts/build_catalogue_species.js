/*
 * Enumerate every PLAYABLE bird the game can put in front of the player and
 * write its canonical (name, scientific) pair to data/catalogue-species.json.
 *
 * Why this exists
 * ---------------
 * The source-backed diet pipeline (scripts/check_bird_diets.py) used to build
 * diet records only from the 951 national-completion profiles plus the in-page
 * WILD_BIRDS starter list. Every OTHER species — the hundreds added by the UK
 * and AU expansion catalogues and the BOU alias overlay — had no diet record,
 * so at runtime it fell through to the conservative "unmatched" fallback, which
 * refuses fish and claims a generic invertebrates/seeds/fruit menu. That is how
 * a Yellow-legged Gull (Larus michahellis, a 40%-fish larid that IS in
 * BirdFuncDat) ended up refusing fish in the Kitchen.
 *
 * This builder loads the same catalogue modules index.html loads and records
 * their (name, scientific) pairs. check_bird_diets.py then reads the committed
 * JSON and mints a real BirdFuncDat-backed diet record for each one (exact
 * scientific -> scientific alias -> common name -> genus -> family -> unmatched),
 * so every playable bird eats what it really eats.
 *
 * Determinism: the catalogue modules are pure data, so this is reproducible.
 * The output is sorted by (scientific, name). Re-run this ONLY when the
 * catalogue files change; commit the regenerated JSON alongside them.
 *
 *   node scripts/build_catalogue_species.js            # write
 *   node scripts/build_catalogue_species.js --check    # verify (drift -> exit 1)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'catalogue-species.json');

// Loaded in the same order index.html loads them. national_bird_completion is
// deliberately excluded: its 951 profiles ARE profiles.json, already covered by
// the profile pipeline.
const EXPANSION_MODULES = [
  'uk_bird_expansion_2.js',
  'uk_bird_expansion_3.js',
  'uk_bird_expansion_4.js',
  'uk_bird_expansion_50.js',
  'au_bird_expansion.js',
  'au_bird_expansion_2.js',
];

// The BOU alias overlay is not a UMD array export; its rows live in a closure.
// It is a flat, well-formed inline-JSON list, so a targeted regex is safe here
// (verified: every {"name":...} row also carries a "scientific" key).
const ALIAS_MODULE = 'uk_bird_alias_completion_20260803.js';

function speciesArrayFrom(mod) {
  if (Array.isArray(mod)) return mod;
  if (mod && Array.isArray(mod.species)) return mod.species;
  if (mod && Array.isArray(mod.rows)) return mod.rows;
  if (mod && Array.isArray(mod.birds)) return mod.birds;
  if (mod && typeof mod === 'object') {
    for (const key of Object.keys(mod)) {
      const value = mod[key];
      if (Array.isArray(value) && value[0] && (value[0].scientific || value[0].scientificName)) return value;
    }
  }
  return [];
}

function collect() {
  const byKey = new Map();
  const add = (name, scientific, source) => {
    const cleanName = String(name || '').trim();
    const cleanSci = String(scientific || '').trim();
    if (!cleanName || !cleanSci) return;
    const key = cleanSci.toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, { name: cleanName, scientific: cleanSci, sources: [source] });
    } else {
      const row = byKey.get(key);
      if (!row.sources.includes(source)) row.sources.push(source);
    }
  };

  for (const file of EXPANSION_MODULES) {
    const mod = require(path.join(ROOT, file));
    for (const row of speciesArrayFrom(mod)) {
      if (!row) continue;
      add(row.name, row.scientific || row.scientificName, file);
    }
  }

  const aliasText = fs.readFileSync(path.join(ROOT, ALIAS_MODULE), 'utf8');
  const aliasRe = /\{"name":"([^"]+)","(?:internationalName":"[^"]*",")?scientific":"([^"]*)"/g;
  let match;
  while ((match = aliasRe.exec(aliasText)) !== null) {
    add(match[1], match[2], ALIAS_MODULE);
  }

  const species = Array.from(byKey.values());
  species.forEach(row => row.sources.sort());
  species.sort((a, b) => (a.scientific.localeCompare(b.scientific) || a.name.localeCompare(b.name)));
  return species;
}

function render(species) {
  return JSON.stringify({
    generatedBy: 'scripts/build_catalogue_species.js',
    note: 'Every playable non-profile bird and its scientific name. Consumed by check_bird_diets.py to mint source-backed diet records. Do not hand-edit — re-run the builder.',
    count: species.length,
    species,
  }, null, 2) + '\n';
}

function main() {
  const check = process.argv.includes('--check');
  const content = render(collect());
  if (check) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    // Git may materialise this generated JSON with CRLF on Windows even though
    // the deterministic builder emits LF. Line endings are not catalogue drift.
    if (current.replace(/\r\n/g, '\n') !== content) {
      process.stderr.write('DRIFT data/catalogue-species.json is stale — re-run node scripts/build_catalogue_species.js\n');
      process.exit(1);
    }
    process.stdout.write('catalogue-species.json is up to date\n');
    return;
  }
  fs.writeFileSync(OUT, content);
  const parsed = JSON.parse(content);
  process.stdout.write('Wrote ' + path.relative(ROOT, OUT) + ' with ' + parsed.count + ' catalogue species\n');
}

main();
