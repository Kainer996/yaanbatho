// Run with: node scripts/test-homepage-accessibility.cjs
// Exercise the shipped page engine without starting the unrelated Next.js app.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element() {
  const classes = new Set();
  return {
    attrs: {}, events: {}, children: [], dataset: {},
    classList: {
      add: (...values) => values.forEach(value => classes.add(value)),
      remove: value => classes.delete(value),
      contains: value => classes.has(value),
      toggle(value, force = !classes.has(value)) {
        force ? classes.add(value) : classes.delete(value);
        return force;
      }
    },
    setAttribute(key, value) { this.attrs[key] = value; },
    addEventListener(key, fn) { this.events[key] = fn; },
    focus() { this.focused = true; },
    appendChild(child) { this.children.push(child); child.parentNode = this; },
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); },
    get firstChild() { return this.children[0]; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

const source = fs.readFileSync(path.join(__dirname, '../js/lumenform.js'), 'utf8');
const instrumented = source.replace(/\}\)\(\);\s*$/, 'globalThis.pageTest = { initLoader, initHeader, initWorkDeck }; })();');
const loader = element(), hero = element(), body = element();
const burger = element(), nav = element(), header = element();
const media = element(), list = element();
const entries = Array.from({ length: 2 }, () => {
  const entry = element();
  entry.head = element();
  entry.panel = element();
  entry.querySelector = selector => ({ '.lf-work-head': entry.head, '.lf-work-panel': entry.panel })[selector] || null;
  return entry;
});
list.querySelectorAll = () => entries;
const ids = { 'lf-loader': loader, 'lf-burger': burger, 'lf-nav': nav, 'lf-work-list': list, 'lf-work-stage-media': media };
const timers = [];
const context = {
  document: {
    readyState: 'loading', body,
    addEventListener() {},
    getElementById: id => ids[id] || null,
    querySelector: selector => selector === '.lf-header' ? header : null,
    querySelectorAll: selector => selector === '.lf-hero .lf-reveal' ? [hero] : [],
    createElement: element
  },
  window: { matchMedia: () => ({ matches: false }), addEventListener() {}, scrollY: 0 },
  IntersectionObserver: class { observe() {} },
  requestAnimationFrame: fn => fn(),
  setTimeout: fn => { timers.push(fn); }
};
vm.runInNewContext(instrumented, context);
const { initLoader, initHeader, initWorkDeck } = context.pageTest;

initLoader();
assert(loader.classList.contains('done'));
assert(body.classList.contains('lf-booted'));
assert(hero.classList.contains('in-view'));
assert.equal(timers.length, 0, 'Ready content must not wait for an artificial timer');
console.log('PASS: homepage content appears without a simulated loading delay');

initHeader();
burger.events.click();
assert.equal(burger.attrs['aria-expanded'], 'true');
assert(nav.classList.contains('open'));
nav.events.keydown({ key: 'Escape' });
assert.equal(burger.attrs['aria-expanded'], 'false');
assert(!nav.classList.contains('open'));
assert(burger.focused);
console.log('PASS: Escape closes the menu and restores focus');

initWorkDeck();
for (const entry of entries) {
  assert.equal(entry.panel.inert, true, 'Collapsed project links must not take keyboard focus');
  assert.equal(entry.head.attrs['aria-expanded'], 'false');
  assert.equal(entry.head.attrs['aria-controls'], entry.panel.id);
}
assert.notEqual(entries[0].panel.id, entries[1].panel.id);
entries[0].head.events.click();
assert.equal(entries[0].panel.inert, false);
assert.equal(entries[0].head.attrs['aria-expanded'], 'true');
entries[1].head.events.click();
assert.equal(entries[0].panel.inert, true);
assert.equal(entries[1].panel.inert, false);
entries[1].head.events.click();
assert.equal(entries[1].panel.inert, true);
console.log('PASS: project panels expose only the open project to keyboard navigation');
