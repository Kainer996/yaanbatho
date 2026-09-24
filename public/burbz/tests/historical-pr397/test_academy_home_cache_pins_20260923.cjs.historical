#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..', '..');
// The release owner chooses the global build after serial integration.
// Academy module pins remain independently coherent before that gate.
const MARKER = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/scan_home\.css\?v=([^"\s]+)/)[1];
const RUNTIME_ASSETS = [
  'scan_home.css',
  'scan_home_core.js',
  'scan_home.js',
  'academy_home_intro.js',
];

function read(file) {
  return fs.readFileSync(path.join(REPO, file), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const index = read('public/burbz/index.html');
const sw = read('public/burbz/sw.js');
const updater = read('scripts/update-live-burbz.sh');

const build = index.match(/const BURBZ_BUILD = '([^']+)';/)[1];
assert(sw.includes(`-${build}'`), 'service worker cache name must end with the current global build');

for (const file of RUNTIME_ASSETS) {
  const url = `${file}?v=${MARKER}`;
  assert(index.includes(url), `index is missing ${url}`);
  assert(!index.match(new RegExp(`${escapeRegExp(file)}\\?v=(?!${escapeRegExp(MARKER)})([^"'<\\s]+)`)), `index has stale pin for ${file}`);
  assert(fs.existsSync(path.join(ROOT, file)), `${file} does not exist on disk`);
  assert(updater.includes(`"${file}"`), `live updater file list is missing ${file}`);
}

const sandbox = {
  self: {
    location: { href: 'https://example.test/burbz/sw.js' },
    BURBZ_UK_BIRD_EXPANSION_50: { art: {} },
    BURBZ_UK_BIRD_EXPANSION_26: { art: {} },
    BURBZ_AU_BIRD_EXPANSION: { art: {} },
    BURBZ_UK_BIRD_EXPANSION_FINAL: { art: {} },
    BURBZ_AU_BIRD_EXPANSION_50: { art: {} },
    BURBZ_NATIONAL_BIRD_COMPLETION_20260715: {},
    BURBZ_UK_BIRD_EXPANSION_4: { art: {} },
    addEventListener() {},
  },
  importScripts() {},
  caches: {},
  fetch() {},
  URL,
  Request,
  Response,
  Promise,
  console,
};

vm.runInNewContext(
  sw.replace(/\bconst\s+(BURBZ_ASSETS|BURBZ_CORE|BURBZ_INSTALL_REQUIRED)\s*=/g, 'var $1 ='),
  sandbox,
  { filename: 'sw.js' }
);

for (const listName of ['BURBZ_ASSETS', 'BURBZ_CORE', 'BURBZ_INSTALL_REQUIRED']) {
  const list = sandbox[listName];
  assert(Array.isArray(list), `${listName} did not evaluate to an array`);
  for (const file of RUNTIME_ASSETS) {
    const url = `./${file}?v=${MARKER}`;
    assert(list.includes(url), `${listName} is missing ${url}`);
    const stale = list.filter(entry => typeof entry === 'string' && entry.startsWith(`./${file}?v=`) && entry !== url);
    assert(stale.length === 0, `${listName} has stale ${file} entries: ${stale.join(', ')}`);
  }
}

console.log(`academy home cache pins OK: ${MARKER}`);
