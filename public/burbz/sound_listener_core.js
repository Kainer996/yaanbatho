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

  root.BurbzSoundListenerCore = Object.freeze({ createLatestTaskQueue });
})(typeof window !== 'undefined' ? window : globalThis);
