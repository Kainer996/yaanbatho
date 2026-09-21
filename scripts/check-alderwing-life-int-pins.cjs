'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const repoRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(repoRoot, 'public/burbz');
const evidenceRoot = process.env.EVIDENCE_DIR || '/root/burbz-alderwing-cleanup-evidence/work-life-int/pins';
const runDir = path.join(evidenceRoot, new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(runDir, { recursive: true });

const rev = 'destination-cleanup-v434-20260921';
const priorRev = 'alderwing-qst-ui-save-v432-20260921';
const changedRuntime = ['village_walk.js','building_rooms.js','village_discoveries.js','building_work.css','village_discovery_core.js','village_discoveries.css','destination_route_core.js','destination_elevation_core.js','destination_reward_core.js','destination_state_core.js','destination_quest_ui.js','destination_quest_ui.css'];
const pinnedDependencies = ['building_rooms.js','village_discoveries.js','building_work.css','village_discovery_core.js','village_discoveries.css'];
const changedFiles = ['index.html', 'sw.js', ...changedRuntime];
const unchangedPins = {
  'village_walk.css': priorRev,
  'building_rooms_core.js': 'opening-home-v416-20260914',
  'building_rooms_scene.js': 'map-pictures-v374-20260908'
};

const text = {
  'index.html': fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8'),
  'sw.js': fs.readFileSync(path.join(publicRoot, 'sw.js'), 'utf8'),
  'village_walk.js': fs.readFileSync(path.join(publicRoot, 'village_walk.js'), 'utf8'),
  'scripts/update-live-burbz.sh': fs.readFileSync(path.join(repoRoot, 'scripts/update-live-burbz.sh'), 'utf8')
};

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(publicRoot, file))).digest('hex');
}

function parsePins() {
  const match = text['village_walk.js'].match(/const PIN=(\{[^;]+\});/);
  assert.ok(match, 'village_walk.js PIN object was not found');
  return Function(`return ${match[1]}`)();
}

function swList(name) {
  const re = new RegExp(`const ${name} = \\[(.*?)\\];`, 's');
  const match = text['sw.js'].match(re);
  assert.ok(match, `${name} not found in sw.js`);
  return [...match[1].matchAll(/'([^']+)'/g)].map(row => row[1]);
}

function pinFor(list, file) {
  const matches = list.filter(url => url === `./${file}?v=${rev}` || url.startsWith(`./${file}?v=`));
  assert.equal(matches.length, 1, `${file} must appear exactly once in each sw.js list`);
  return matches[0].split('?v=')[1];
}

const pins = parsePins();
const lists = {
  BURBZ_ASSETS: swList('BURBZ_ASSETS'),
  BURBZ_CORE: swList('BURBZ_CORE'),
  BURBZ_INSTALL_REQUIRED: swList('BURBZ_INSTALL_REQUIRED')
};
const indexWalkPin = text['index.html'].match(/village_walk\.js\?v=([^']+)/)?.[1];
const build = text['index.html'].match(/const BURBZ_BUILD = '([^']+)';/)?.[1];
const cacheName = text['sw.js'].match(/const BURBZ_CACHE = '([^']+)';/)?.[1];
const updateScript = text['scripts/update-live-burbz.sh'];

const checks = [];
function check(id, pass, observed) {
  checks.push({ id, pass, observed });
  assert.ok(pass, `${id}: ${JSON.stringify(observed)}`);
}

for (const file of pinnedDependencies) {
  check(`${file}:village_walk_pin`, pins[file] === rev, { expected: rev, observed: pins[file] });
}
for (const file of changedRuntime) {
  for (const [name, list] of Object.entries(lists)) {
    check(`${file}:${name}`, pinFor(list, file) === rev, { expected: rev, observed: pinFor(list, file) });
  }
}
check('index_html_walk_pin', indexWalkPin === rev, { expected: rev, observed: indexWalkPin });
check('index_html_build_marker', build === rev, { expected: rev, observed: build });
check('sw_cache_marker', cacheName.endsWith(`${priorRev}-${rev}`), { expectedSuffix: `${priorRev}-${rev}`, observed: cacheName.slice(-120) });
check('sw_three_lists_present', Object.keys(lists).length === 3, Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])));

for (const [file, expected] of Object.entries(unchangedPins)) {
  check(`${file}:unchanged_pin_host`, pins[file] === expected, { expected, observed: pins[file] });
  for (const [name, list] of Object.entries(lists)) {
    const observed = pinFor(list, file);
    check(`${file}:${name}:unchanged`, observed === expected, { expected, observed });
  }
}

for (const file of changedFiles) {
  check(`update_script_lists_${file}`, updateScript.includes(file), { file, present: updateScript.includes(file) });
}

const report = {
  startedAt: new Date().toISOString(),
  revision: rev,
  priorRevision: priorRev,
  changedRuntime,
  changedFiles,
  cacheName,
  build,
  moduleSha256: Object.fromEntries(changedRuntime.map(file => [file, sha(file)])),
  listLengths: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])),
  checks
};

fs.writeFileSync(path.join(runDir, 'pin-check-report.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(evidenceRoot, 'latest-pin-check.txt'), `${runDir}\n`);
console.log(JSON.stringify({ ok: true, runDir, checks: checks.length }, null, 2));
