'use strict';
const assert = require('node:assert/strict');
const Intro = require('../academy_home_intro.js');

class MemoryStorage {
  constructor({ readError = false, writeError = false } = {}) {
    this.map = new Map();
    this.readError = readError;
    this.writeError = writeError;
  }
  getItem(key) {
    if (this.readError) throw new Error('read failed');
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    if (this.writeError) throw new Error('write failed');
    this.map.set(key, String(value));
  }
}

const profileA = 'profile_A_1234567890';
const profileB = 'profile_B_1234567890';

assert.equal(Intro.isValidProfileId(profileA), true);
assert.equal(Intro.isValidProfileId('shared'), false, 'short shared defaults are not valid profiles');
assert.match(Intro.receiptKey(profileA), /^burbzAcademyHomeIntro:academy-home-intro-v444-20260922:/);

assert.deepEqual(Intro.evaluateEligibility({
  profileId: profileA,
  screen: 'scan',
  receiptSeen: false,
  pendingMerlinTimers: 0,
  safeIdle: true
}), { ok:true, reason:'ready' });
assert.equal(Intro.evaluateEligibility({ profileId:'', screen:'scan', safeIdle:true }).reason, 'missing-profile');
assert.equal(Intro.evaluateEligibility({ profileId:profileA, screen:'map', safeIdle:true }).reason, 'screen');
assert.equal(Intro.evaluateEligibility({ profileId:profileA, screen:'scan', receiptSeen:true, safeIdle:true }).reason, 'receipt');
assert.equal(Intro.evaluateEligibility({ profileId:profileA, screen:'scan', receiptSeen:false, pendingMerlinTimers:1, safeIdle:true }).reason, 'merlin-timer');
assert.equal(Intro.evaluateEligibility({ profileId:profileA, screen:'scan', receiptSeen:false, pendingMerlinTimers:0, safeIdle:'settings' }).reason, 'settings');

{
  const storage = new MemoryStorage();
  const session = new MemoryStorage();
  const receipts = Intro.createReceiptStore({ storage, sessionStorage:session });
  assert.equal(receipts.seen(profileA), false);
  assert.equal(receipts.mark(profileA).persisted, true);
  assert.equal(receipts.seen(profileA), true);
  assert.equal(receipts.seen(profileB), false, 'profile B is not blocked by profile A receipt');
}

{
  const storage = new MemoryStorage({ readError:true, writeError:true });
  const session = new MemoryStorage({ writeError:true });
  const memory = new Set();
  const receipts = Intro.createReceiptStore({ storage, sessionStorage:session, memory });
  assert.equal(receipts.seen(profileA), false, 'read failure falls through to session memory');
  receipts.noteSession(profileA);
  assert.equal(receipts.seen(profileA), true, 'session memory prevents repeated interruption after storage read failure');
  assert.equal(receipts.mark(profileA).ok, true, 'write failure still leaves an in-memory fail-safe receipt');
  assert(receipts.failures.some(row => row.op === 'read'));
  assert(receipts.failures.some(row => row.op === 'write'));
}

console.log('PASS academy Home intro profile receipts, safe-idle eligibility and storage-failure fail-safe');
