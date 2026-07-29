(function (root) {
  'use strict';

  function createLatestTaskQueue(worker, options) {
    if (typeof worker !== 'function') throw new TypeError('worker must be a function');
    const opts = options || {};
    let active = 0;
    let pending = null;
    let hasPending = false;
    let dropped = 0;
    let completed = 0;
    let closed = false;

    async function run(task) {
      active += 1;
      try {
        await worker(task);
      } catch (error) {
        if (typeof opts.onError === 'function') opts.onError(error);
      } finally {
        active -= 1;
        completed += 1;
        if (!closed && hasPending) {
          const next = pending;
          pending = null;
          hasPending = false;
          void run(next);
        }
      }
    }

    function enqueue(task) {
      if (closed) return false;
      if (!active) {
        void run(task);
      } else {
        if (hasPending) dropped += 1;
        pending = task;
        hasPending = true;
      }
      return true;
    }

    function clear() {
      pending = null;
      hasPending = false;
    }

    function close() {
      closed = true;
      clear();
    }

    function snapshot() {
      return { active, pending: hasPending ? 1 : 0, dropped, completed };
    }

    return { enqueue, clear, close, snapshot };
  }

  function filenameForMime(mimeType) {
    const mime = String(mimeType || '').toLowerCase();
    if (mime.includes('webm')) return 'recording.webm';
    if (mime.includes('ogg')) return 'recording.ogg';
    if (mime.includes('mp4') || mime.includes('m4a')) return 'recording.m4a';
    if (mime.includes('wav')) return 'recording.wav';
    return 'recording.audio';
  }

  function createDiscoveryHistory() {
    const entries = new Map();
    let order = [];

    function add(discovery) {
      if (!discovery || !String(discovery.key || '').trim()) return null;
      const key = String(discovery.key).trim().toLowerCase();
      const previous = entries.get(key);
      const next = {
        key,
        name: String(discovery.name || previous?.name || key),
        scientificName: String(discovery.scientificName || previous?.scientificName || ''),
        confidence: Math.max(Number(previous?.confidence) || 0, Number(discovery.confidence) || 0),
        rarity: String(discovery.rarity || previous?.rarity || 'common'),
        isNew: !!(previous?.isNew || discovery.isNew),
        count: (previous?.count || 0) + 1
      };
      entries.set(key, next);
      order = [key, ...order.filter(existingKey => existingKey !== key)];
      return { ...next };
    }

    function reset() {
      entries.clear();
      order = [];
    }

    function snapshot() {
      return order.map(key => ({ ...entries.get(key) }));
    }

    return { add, reset, snapshot };
  }

  function soundWindowAgeCue(windowData, now) {
    const item = windowData || {};
    const endedAt = Number(item.endedAt);
    const durationMs = Math.max(0, Number(item.durationMs) || 12000);
    if (!Number.isFinite(endedAt)) return 'the previous sound window';

    const current = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const endAge = Math.max(0, Math.round((current - endedAt) / 1000));
    const startAge = Math.max(endAge, Math.round((current - endedAt + durationMs) / 1000));
    if (!endAge) return `the last ${Math.max(1, Math.round(durationMs / 1000))}s of sound`;
    return `sound recorded ${startAge}\u2013${endAge}s ago`;
  }

  root.BurbzSoundListenerCore = Object.freeze({
    createLatestTaskQueue,
    createDiscoveryHistory,
    filenameForMime,
    soundWindowAgeCue
  });
})(typeof window !== 'undefined' ? window : globalThis);
