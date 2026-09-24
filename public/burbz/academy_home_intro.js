/* Presentation-only Academy Home intro. No gameplay save or tutorial state. */
(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BurbzAcademyHomeIntro = api.createAcademyHomeIntro({ root });
  root.BurbzAcademyHomeIntroCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';

  const VERSION = 'academy-home-intro-v444-20260922';
  const RECEIPT_PREFIX = 'burbzAcademyHomeIntro';
  const PROFILE_RE = /^[a-zA-Z0-9_-]{16,96}$/;

  function isValidProfileId(value) {
    return PROFILE_RE.test(String(value || ''));
  }

  function receiptKey(profileId) {
    return RECEIPT_PREFIX + ':' + VERSION + ':' + profileId;
  }

  function storageGet(storage, key) {
    try { return { ok:true, value:storage ? storage.getItem(key) : null }; }
    catch (error) { return { ok:false, error }; }
  }

  function storageSet(storage, key, value) {
    try {
      if (storage) storage.setItem(key, value);
      return { ok:true };
    } catch (error) {
      return { ok:false, error };
    }
  }

  function createReceiptStore(options = {}) {
    const storage = options.storage || null;
    const sessionStorage = options.sessionStorage || null;
    const memory = options.memory || new Set();
    const failures = [];
    const sessionKey = profileId => receiptKey(profileId) + ':session';
    return {
      failures,
      seen(profileId) {
        if (!isValidProfileId(profileId)) return true;
        const key = receiptKey(profileId);
        const local = storageGet(storage, key);
        if (local.ok && local.value === '1') return true;
        if (!local.ok) failures.push({ op:'read', key, message:String(local.error && local.error.message || local.error) });
        const session = storageGet(sessionStorage, sessionKey(profileId));
        if (session.ok && session.value === '1') return true;
        if (!session.ok) failures.push({ op:'session-read', key:sessionKey(profileId), message:String(session.error && session.error.message || session.error) });
        return memory.has(profileId);
      },
      noteSession(profileId) {
        if (!isValidProfileId(profileId)) return;
        memory.add(profileId);
        const session = storageSet(sessionStorage, sessionKey(profileId), '1');
        if (!session.ok) failures.push({ op:'session-write', key:sessionKey(profileId), message:String(session.error && session.error.message || session.error) });
      },
      mark(profileId) {
        if (!isValidProfileId(profileId)) return { ok:false };
        memory.add(profileId);
        const key = receiptKey(profileId);
        const local = storageSet(storage, key, '1');
        if (!local.ok) failures.push({ op:'write', key, message:String(local.error && local.error.message || local.error) });
        const session = storageSet(sessionStorage, sessionKey(profileId), '1');
        if (!session.ok) failures.push({ op:'session-write', key:sessionKey(profileId), message:String(session.error && session.error.message || session.error) });
        return { ok:local.ok || session.ok || memory.has(profileId), persisted:local.ok };
      }
    };
  }

  function evaluateEligibility(context = {}) {
    if (!isValidProfileId(context.profileId)) return { ok:false, reason:'missing-profile' };
    if (context.active) return { ok:false, reason:'active' };
    if (context.screen !== 'scan') return { ok:false, reason:'screen' };
    if (context.receiptSeen) return { ok:false, reason:'receipt' };
    if (Number(context.pendingMerlinTimers) > 0) return { ok:false, reason:'merlin-timer' };
    if (context.safeIdle !== true) return { ok:false, reason:context.safeIdle || 'busy' };
    return { ok:true, reason:'ready' };
  }

  function createAcademyHomeIntro(options = {}) {
    const env = options.root || root;
    const doc = options.document || env.document;
    const win = options.window || env;
    const receiptStore = options.receipts || createReceiptStore({
      storage: options.storage || env.localStorage,
      sessionStorage: options.sessionStorage || env.sessionStorage
    });
    const adapter = {
      profileId: () => '',
      screen: () => 'scan',
      safeIdle: () => true,
      pendingMerlinTimers: () => 0,
      focusAfter: () => null,
      ...options.adapter
    };
    let overlay = null;
    let lastFocus = null;
    let activeProfile = '';
    let lastProfile = '';
    let generation = 0;
    let scheduleTimer = 0;
    let retryTimer = 0;
    let phaseTimer = 0;
    let interiorTimer = 0;
    let finishTimer = 0;
    let keyHandler = null;
    let clickHandler = null;
    let motionHandler = null;
    let started = 0;
    let completed = 0;
    let skipped = 0;
    let disposed = 0;
    const debugEvents = [];

    const reducedMotion = () => {
      try { return !!win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches; }
      catch (_) { return false; }
    };
    const timings = () => ({
      tree:1800,
      interior:3800,
      complete:4600,
      reduced:320
    });

    function event(name, detail = {}) {
      debugEvents.push({ name, detail, at:Date.now() });
      if (debugEvents.length > 80) debugEvents.shift();
    }

    function context() {
      const profileId = String(adapter.profileId() || '');
      return {
        profileId,
        screen: adapter.screen(),
        active: !!overlay,
        receiptSeen: receiptStore.seen(profileId),
        pendingMerlinTimers: Number(adapter.pendingMerlinTimers() || 0),
        safeIdle: adapter.safeIdle()
      };
    }

    function clearOwnedTimers() {
      if (scheduleTimer) win.clearTimeout(scheduleTimer);
      if (retryTimer) win.clearTimeout(retryTimer);
      if (phaseTimer) win.clearTimeout(phaseTimer);
      if (interiorTimer) win.clearTimeout(interiorTimer);
      if (finishTimer) win.clearTimeout(finishTimer);
      scheduleTimer = retryTimer = phaseTimer = interiorTimer = finishTimer = 0;
    }

    function focusTarget() {
      return adapter.focusAfter?.() ||
        doc.querySelector?.('#academyHomeTree [data-home-action="build-rooms"]') ||
        doc.querySelector?.('#scanHomeActions button') ||
        doc.querySelector?.('#screen-scan button');
    }

    function removeOverlay(reason, writeReceipt) {
      const old = overlay;
      const profile = activeProfile;
      const shouldRestore = reason !== 'pagehide' && reason !== 'navigation' && reason !== 'profile';
      generation++;
      clearOwnedTimers();
      if (keyHandler) doc.removeEventListener('keydown', keyHandler, true);
      if (clickHandler && old) old.removeEventListener('click', clickHandler, true);
      if (motionHandler) {
        try {
          const media = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)');
          media?.removeEventListener?.('change', motionHandler);
          media?.removeListener?.(motionHandler);
        } catch (_) {}
      }
      keyHandler = clickHandler = motionHandler = null;
      overlay = null;
      activeProfile = '';
      if (writeReceipt && profile) receiptStore.mark(profile);
      old?.remove();
      doc.body?.classList.remove('academy-home-intro-active');
      if (shouldRestore) {
        const target = focusTarget();
        if (target && typeof target.focus === 'function') target.focus({ preventScroll:true });
        else if (lastFocus && lastFocus.isConnected && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll:true });
      }
      event('dispose', { reason, receipt:!!writeReceipt, profile });
    }

    function finish(reason) {
      if (!overlay) return false;
      completed += reason === 'complete' || reason === 'reduced' ? 1 : 0;
      skipped += reason === 'skip' || reason === 'back' ? 1 : 0;
      removeOverlay(reason, true);
      schedule('after-' + reason);
      return true;
    }

    function dispose(reason = 'dispose') {
      disposed += overlay ? 1 : 0;
      removeOverlay(reason, false);
      return true;
    }

    function trapFocus(eventObject) {
      if (!overlay || eventObject.key !== 'Tab') return;
      const controls = Array.from(overlay.querySelectorAll('button,[href],input,select,textarea,[tabindex]'))
        .filter(el => !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.getClientRects().length);
      if (!controls.length) return;
      const at = controls.indexOf(doc.activeElement);
      const next = eventObject.shiftKey ? (at <= 0 ? controls.length - 1 : at - 1) : (at + 1) % controls.length;
      eventObject.preventDefault();
      controls[next]?.focus({ preventScroll:true });
    }

    function treeSvg(roomCount) {
      const rooms = Math.max(1, Math.min(7, Number(roomCount) || 1));
      const floors = Array.from({ length:rooms }, (_, i) => {
        const y = 128 + i * 34;
        const width = 78 + (i % 2) * 24;
        const x = 150 - width / 2;
        return '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="24" rx="3" />';
      }).join('');
      return '<svg class="academy-home-intro-svg" viewBox="0 0 300 430" aria-hidden="true" focusable="false">' +
        '<path class="intro-root" d="M146 336 C104 356 75 381 38 408 M154 336 C193 356 228 378 266 407 M150 333 C142 369 132 394 112 421 M151 333 C162 370 175 395 196 421" />' +
        '<path class="intro-trunk" d="M91 339 C105 268 99 196 118 130 C129 91 172 91 183 130 C202 197 196 268 209 339 Z" />' +
        '<g class="intro-cut-rooms">' + floors + '</g>' +
        '<circle class="intro-canopy c1" cx="87" cy="115" r="61" />' +
        '<circle class="intro-canopy c2" cx="146" cy="74" r="72" />' +
        '<circle class="intro-canopy c3" cx="213" cy="118" r="62" />' +
        '<circle class="intro-canopy c4" cx="151" cy="142" r="76" />' +
        '<path class="intro-branch" d="M120 169 C93 151 70 142 41 141 M179 169 C207 150 230 141 260 139" />' +
        '</svg>';
    }

    function cutawaySvg(roomCount) {
      const rooms = Math.max(1, Math.min(10, Number(roomCount) || 1));
      const rows = Array.from({ length:rooms }, (_, i) => {
        const y = 30 + i * 31;
        const height = rooms > 6 ? 23 : 28;
        const width = i % 3 === 1 ? 172 : 198;
        const x = 111 - width / 2;
        return '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" rx="2" />' +
          '<line x1="' + (x + 14) + '" y1="' + (y + height - 5) + '" x2="' + (x + width - 14) + '" y2="' + (y + height - 5) + '" />';
      }).join('');
      return '<svg class="academy-home-intro-cutaway-svg" viewBox="0 0 222 370" aria-hidden="true" focusable="false">' +
        '<path class="intro-bark left" d="M7 0 C24 72 14 123 25 189 C36 258 21 309 34 370" />' +
        '<path class="intro-bark right" d="M215 0 C197 72 208 123 197 189 C185 258 201 309 188 370" />' +
        '<g class="intro-final-rooms">' + rows + '</g>' +
        '</svg>';
    }

    function show(profileId) {
      if (!doc || !doc.body || overlay) return false;
      activeProfile = profileId;
      lastProfile = profileId;
      lastFocus = doc.activeElement;
      const owned = doc.querySelectorAll ? doc.querySelectorAll('#academyHomeRooms .academy-home-room').length : 1;
      const isReduced = reducedMotion();
      const token = ++generation;
      const node = doc.createElement('div');
      node.className = 'academy-home-intro';
      node.dataset.phase = isReduced ? 'reduced' : 'tree';
      node.setAttribute('role', 'dialog');
      node.setAttribute('aria-modal', 'true');
      node.setAttribute('aria-labelledby', 'academyHomeIntroTitle');
      node.innerHTML =
        '<button type="button" class="academy-home-intro-skip">Skip</button>' +
        '<h2 id="academyHomeIntroTitle" class="sr-only">Academy Home intro</h2>' +
        '<div class="academy-home-intro-stage">' +
          '<div class="academy-home-intro-whole">' + treeSvg(owned) + '</div>' +
          '<div class="academy-home-intro-interior">' + cutawaySvg(owned) + '</div>' +
        '</div>';
      overlay = node;
      doc.body.append(node);
      doc.body.classList.add('academy-home-intro-active');
      if (receiptStore.failures.some(row => row.key === receiptKey(profileId) && row.op === 'read')) receiptStore.noteSession(profileId);
      started += 1;
      event('show', { profile:profileId, reduced:isReduced, owned });

      clickHandler = eventObject => {
        if (eventObject.target.closest('.academy-home-intro-skip')) {
          eventObject.preventDefault();
          eventObject.stopPropagation();
          finish('skip');
        }
      };
      keyHandler = eventObject => {
        if (!overlay) return;
        if (eventObject.key === 'Escape') {
          eventObject.preventDefault();
          eventObject.stopPropagation();
          finish('skip');
          return;
        }
        trapFocus(eventObject);
      };
      motionHandler = eventObject => {
        if (eventObject.matches && overlay) finish('reduced');
      };
      node.addEventListener('click', clickHandler, true);
      doc.addEventListener('keydown', keyHandler, true);
      try {
        const media = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)');
        media?.addEventListener?.('change', motionHandler);
        media?.addListener?.(motionHandler);
      } catch (_) {}
      node.querySelector('.academy-home-intro-skip')?.focus({ preventScroll:true });
      const time = timings();
      if (isReduced) {
        finishTimer = win.setTimeout(() => { if (token === generation) finish('reduced'); }, time.reduced);
      } else {
        phaseTimer = win.setTimeout(() => { if (token === generation && overlay) overlay.dataset.phase = 'zoom'; }, time.tree);
        interiorTimer = win.setTimeout(() => { if (token === generation && overlay) overlay.dataset.phase = 'interior'; }, time.interior);
        finishTimer = win.setTimeout(() => { if (token === generation) finish('complete'); }, time.complete);
      }
      return true;
    }

    function check(reason = 'check') {
      scheduleTimer = 0;
      const nextProfile = String(adapter.profileId() || '');
      if (lastProfile && nextProfile && nextProfile !== lastProfile) dispose('profile');
      if (overlay && nextProfile && nextProfile !== activeProfile) { dispose('profile'); return; }
      const current = context();
      const result = evaluateEligibility(current);
      event('eligibility', { reason, result:result.reason, profile:current.profileId, pending:current.pendingMerlinTimers });
      if (result.ok) {
        show(current.profileId);
        return;
      }
      if (current.screen === 'scan' && !current.receiptSeen && isValidProfileId(current.profileId) && !overlay) {
        if (retryTimer) win.clearTimeout(retryTimer);
        retryTimer = win.setTimeout(() => check('retry'), 260);
      }
    }

    function schedule(reason = 'schedule') {
      if (!doc || !doc.body) return;
      if (scheduleTimer) win.clearTimeout(scheduleTimer);
      scheduleTimer = win.setTimeout(() => check(reason), 0);
    }

    function skip(reason = 'skip') {
      return finish(reason);
    }

    function bind(nextAdapter = {}) {
      Object.assign(adapter, nextAdapter);
      schedule('bind');
      return api;
    }

    win.addEventListener?.('pagehide', () => dispose('pagehide'));

    const api = {
      bind,
      schedule,
      skip,
      dispose,
      profileReplaced(profileId) {
        if (overlay) dispose('profile');
        lastProfile = String(profileId || '');
        schedule('profile-replaced');
      },
      state() {
        return {
          version:VERSION,
          active:!!overlay,
          phase:overlay?.dataset.phase || null,
          activeProfile,
          lastProfile,
          started,
          completed,
          skipped,
          disposed,
          receiptFailures:receiptStore.failures.slice(),
          events:debugEvents.slice(-24)
        };
      },
      _context: context
    };
    return api;
  }

  return {
    VERSION,
    RECEIPT_PREFIX,
    isValidProfileId,
    receiptKey,
    createReceiptStore,
    evaluateEligibility,
    createAcademyHomeIntro
  };
});
