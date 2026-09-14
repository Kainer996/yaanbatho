/* Run the shipped discovery/photo functions; browser codecs and storage are disposable fakes. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
// An alternate HTML file lets the same behavioural tests demonstrate failure before the fix.
const html = fs.readFileSync(process.env.BURBZ_PHOTO_TEST_HTML || path.join(root, 'index.html'), 'utf8');
function fn(name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(html);
  assert.ok(match, 'shipped function ' + name);
  const start = match.index, lineEnd = html.indexOf('\n', start);
  const end = html.slice(start, lineEnd).endsWith('}') ? lineEnd : html.indexOf('\n}', start) + 2;
  assert.ok(end > start, 'complete function ' + name);
  return html.slice(start, end);
}
const catalogue = html.slice(html.indexOf('const BURBZ_SPECIES_PROFILES = ['), html.indexOf('function getBirdInfo('));
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  const storage = new Map(), photos = new Map();
  const calls = { decoded: [], encoded: [], writes: [], warnings: [], closed: 0, bitmapClosed: 0, unmatched: 0 };
  let run;
  const document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      let bitmap;
      return {
        width: 0, height: 0,
        getContext(kind) {
          assert.equal(kind, '2d');
          return { drawImage(image, x, y, width, height) {
            assert.equal(x, 0); assert.equal(y, 0);
            bitmap = image;
            calls.encoded.push({ source: image.source, width, height });
          } };
        },
        toBlob(callback, type, quality) {
          assert.equal(type, 'image/jpeg');
          assert.equal(quality, 0.82);
          const last = calls.encoded.at(-1);
          assert.equal(last.width, this.width); assert.equal(last.height, this.height);
          // The browser encoder is a boundary stub; keep a distinct output blob per input.
          const encoded = new Blob(['jpeg fixture for ', bitmap.source], { type });
          last.blob = encoded;
          queueMicrotask(() => callback(encoded));
        }
      };
    }
  };
  const indexedDB = {
    open(name, version) {
      assert.equal(name, 'burbz-player-photos'); assert.equal(version, 1);
      const db = {
        objectStoreNames: { contains: () => true },
        transaction(store, mode) {
          assert.equal(store, 'photos'); assert.equal(mode, 'readwrite');
          const tx = {
            objectStore(requested) {
              assert.equal(requested, 'photos');
              return { put(value, key) {
                const activeRecord = run('gameState.discoveredSpecies')[key];
                calls.writes.push({ key, value, activeRecord });
                queueMicrotask(() => {
                  photos.set(key, value);
                  tx.oncomplete();
                });
              } };
            }
          };
          return tx;
        },
        close() { calls.closed++; }
      };
      const request = { result: db };
      queueMicrotask(() => request.onsuccess());
      return request;
    }
  };
  const ctx = vm.createContext({ Date, Map, Set, Blob, document, indexedDB, calls,
    console: { warn: (...args) => calls.warnings.push(args) },
    localStorage: { setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key) || null },
    createImageBitmap: async (source, options) => {
      assert.equal(options.imageOrientation, 'from-image');
      calls.decoded.push({ source, records: Object.values(run('gameState.discoveredSpecies')) });
      return { source, width: 2048, height: 1024, close: () => { calls.bitmapClosed++; } };
    }
  });
  run = code => vm.runInContext(code, ctx);
  run('window = globalThis');
  for (const file of ['uk_bird_expansion_50.js', 'uk_bird_expansion_2.js', 'au_bird_expansion.js',
    'uk_bird_expansion_3.js', 'uk_bird_expansion_4.js', 'uk_bird_alias_completion_20260803.js',
    'au_bird_expansion_2.js', 'national_bird_completion_20260715.js']) {
    run(fs.readFileSync(path.join(root, file), 'utf8'));
  }
  run(`
    const UK50=BURBZ_UK_BIRD_EXPANSION_50, UK26=BURBZ_UK_BIRD_EXPANSION_26, AU_EXP=BURBZ_AU_BIRD_EXPANSION,
      UK_FINAL=BURBZ_UK_BIRD_EXPANSION_FINAL, UK4=BURBZ_UK_BIRD_EXPANSION_4, AU50=BURBZ_AU_BIRD_EXPANSION_50,
      NATIONAL=BURBZ_NATIONAL_BIRD_COMPLETION_20260715, UK_BIRD_ALIASES=BURBZ_UK_BIRD_ALIAS_COMPLETION_20260803;
    ${catalogue}
    let gameState={player:{xp:0,coins:0},flock:[],discoveredSpecies:{}};
    let continuousSoundScanWanted=true;
    const SOUND_SESSION_MAX_PER_WINDOW=4, BIRD_BIOLOGY_STATS_VERSION='fixture';
    ${html.match(/^const PLAYER_PHOTO_(?:DB_NAME|STORE|MAX_EDGE) = .+;$/gm).join('\n')}
    const determineBirdRarity=()=> 'common', generateBirdStats=()=>({hp:80,cha:50}), hashStr=()=>1,
      resolveBuiltInBirdArt=()=>null, defaultBirdCare=()=>({}), getBirdArtUrl=()=>null,
      recruitCostForBird=()=>150, discoveryRewardForBird=()=>14, fetchBirdArt=()=>{},
      logDiary=()=>{}, queueCloudSave=()=>{}, queueActionBadgeUpdate=()=>{},
      addCoins=n=>gameState.player.coins+=n, addPlayerXp=n=>gameState.player.xp+=n,
      updateQuestProgress=()=>{}, updateHeader=()=>{}, renderBirdex=()=>{}, renderProfile=()=>{},
      showToast=()=>{}, showScanEncounterCard=()=>{}, showRecruitChoiceOverlay=()=>{}, checkBadges=()=>{},
      showCatalogUnmatchedRecognition=()=>calls.unmatched++, questRegisterBirdEncounter=()=>{},
      recordSoundSessionDiscovery=()=>{},
      $=()=>({classList:{add(){},remove(){}},style:{}}), RARITY_COLORS={common:'#fff'};
    ${['speciesKey', 'canonicalSpeciesName', 'discoveryKeysForSpecies', 'getDiscoveredRecordForSpecies',
      'companionForSpecies', 'nextDiscoverySightingCount', 'rememberDiscoveredBird', 'createBirdEntry',
      'normaliseAcceptedBirdCandidates', 'durableSaveState', 'saveState', 'openPlayerPhotoDb',
      'savePlayerBirdPhoto', 'compressPlayerPhoto', 'rememberPlayerBirdPhoto', 'handleBirdCandidates'].map(fn).join('\n')}
  `);
  calls.warnings.length = 0; // Catalogue import warnings are unrelated to the photo-save path.
  return { run, calls, storage, photos,
    detect(name = 'Herring Gull', source = 'photo', blob = new Blob(['first original PNG'], { type: 'image/png' })) {
      ctx.input = { species: name, confidence: .96 };
      ctx.options = { source, blob };
      return { birds: run('handleBirdCandidates(input, [], options)'), blob };
    },
    record(name = 'Herring Gull') { return run(`getDiscoveredRecordForSpecies(${JSON.stringify(name)})`); },
    savedRecord(key) { return JSON.parse(storage.get('burbz_state')).discoveredSpecies[key]; }
  };
}

const checks = [];
function check(name, body) { checks.push({ name, body }); }

check('first accepted photo creates its discovery before storing JPEG and photoAt', async () => {
  const f = fixture(), { birds, blob } = f.detect();
  assert.equal(birds.length, 1);
  const record = f.record();
  assert.ok(record, 'accepted bird must be discovered');
  await settle();
  assert.equal(f.calls.warnings.length, 0);
  assert.equal(f.calls.writes.length, 1, 'the FIRST accepted photo must be saved');
  assert.equal(f.calls.decoded[0].source, blob, 'compress the actual player input');
  assert.ok(f.calls.decoded[0].records.includes(record), 'create the discovery before compression begins');
  assert.equal(f.calls.writes[0].activeRecord, record);
  assert.equal(f.photos.get(record.key).blob, f.calls.encoded[0].blob);
  assert.equal(f.photos.get(record.key).blob.type, 'image/jpeg');
  assert.equal(f.calls.encoded[0].width, 1024); assert.equal(f.calls.encoded[0].height, 512);
  assert.equal(f.calls.bitmapClosed, 1); assert.equal(f.calls.closed, 1);
  assert.match(record.photoAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(f.photos.get(record.key).takenAt, record.photoAt);
  assert.equal(f.photos.get(record.key).species, record.species);
  assert.equal(f.savedRecord(record.key).photoAt, record.photoAt, 'photo flag survives save/reload');
});

check('a known species without a photo marks the current replacement record', async () => {
  const f = fixture();
  f.run("rememberDiscoveredBird(createBirdEntry('Herring Gull', '', .96)); saveState();");
  const previous = f.record();
  f.detect();
  const current = f.record();
  assert.notEqual(current, previous, 'exercise actual re-sighting record replacement');
  await settle();
  assert.equal(f.calls.writes.length, 1);
  assert.equal(f.calls.writes[0].activeRecord, current);
  assert.match(current.photoAt || '', /^\d{4}-\d{2}-\d{2}T/, 'photoAt must be on the active record, not the replaced one');
  assert.equal(f.savedRecord(current.key).photoAt, current.photoAt);
  assert.equal(current.sightingCount, 2);
});

check('a repeated accepted photo preserves the original stored image and timestamp', async () => {
  const f = fixture();
  f.detect(); await settle();
  const first = f.record(), stored = f.photos.get(first.key), takenAt = first.photoAt;
  assert.ok(stored, 'first photo must exist before testing repeats');
  f.detect('Herring Gull', 'photo', new Blob(['different second photo'], { type: 'image/png' }));
  await settle();
  assert.equal(f.calls.writes.length, 1); assert.equal(f.calls.decoded.length, 1);
  assert.equal(f.photos.get(first.key), stored);
  assert.equal(f.record().photoAt, takenAt);
  assert.equal(f.savedRecord(first.key).photoAt, takenAt);
  assert.equal(f.record().sightingCount, 2);
});

check('sound discoveries never store the supplied image blob', async () => {
  const f = fixture();
  assert.equal(f.detect('Goldcrest', 'sound').birds.length, 1);
  await settle();
  assert.ok(f.record('Goldcrest'));
  assert.equal(f.record('Goldcrest').photoAt, undefined);
  assert.equal(f.calls.decoded.length, 0); assert.equal(f.calls.writes.length, 0);
  assert.equal(f.photos.size, 0);
});

check('unmatched or empty candidates never create a photo journal entry', async () => {
  const f = fixture();
  assert.equal(f.detect('Fixture bird outside the real catalogue').birds.length, 0);
  assert.equal(f.run("handleBirdCandidates(null, [], {source:'photo',blob:options.blob}).length"), 0);
  await settle();
  assert.equal(f.calls.unmatched, 1);
  assert.equal(Object.keys(f.run('gameState.discoveredSpecies')).length, 0);
  assert.equal(f.calls.decoded.length, 0); assert.equal(f.calls.writes.length, 0);
  assert.equal(f.photos.size, 0);
});

(async () => {
  let failed = 0;
  for (const { name, body } of checks) {
    try { await body(); console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); }
  }
  if (failed) process.exitCode = 1;
  else console.log(checks.length + ' first-photo journal regression groups passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
