/* Pure aggregation and DOM rendering for Burbz navigation action badges.
 * Input is caller-normalized state; this module never reads game globals.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BurbzActionBadges = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Routed screens plus the three dock buttons that open a pop-up instead of a
  // screen. Both kinds carry badges; only the attribute they are keyed by
  // differs.
  var SCREENS = [
    'quests', 'academy', 'birdex', 'battle', 'forge',
    'map', 'village', 'inventory', 'leaderboards',
    'kitchen', 'hospital', 'training'
  ];
  var BADGE_SELECTOR = '[data-game-route][data-screen],[data-quick-destination]';
  var BASE_LABEL_KEY = '__burbzActionBadgeBaseLabel';

  function countValue(value) {
    return typeof value === 'number' && isFinite(value) && value > 0
      ? Math.floor(value)
      : 0;
  }

  function entries(value) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    return Object.keys(value).map(function (key) { return value[key]; });
  }

  function definitions(value) {
    var groups = entries(value);
    var result = [];
    groups.forEach(function (group) {
      if (Array.isArray(group)) result = result.concat(group);
      else result.push(group);
    });
    return result;
  }

  function countCompletedQuests(input) {
    var questStates = input.quests;
    var defs = definitions(input.questDefinitions);

    if (!defs.length && Array.isArray(questStates)) {
      return questStates.filter(function (quest) {
        return quest && quest.claimed !== true &&
          typeof quest.target === 'number' && isFinite(quest.target) &&
          typeof quest.progress === 'number' && quest.progress >= quest.target;
      }).length;
    }

    if (!questStates || typeof questStates !== 'object') return 0;
    return defs.filter(function (definition) {
      if (!definition || definition.id == null ||
          typeof definition.target !== 'number' || !isFinite(definition.target)) return false;
      var state = questStates[definition.id];
      return !!state && state.claimed !== true &&
        typeof state.progress === 'number' && state.progress >= definition.target;
    }).length;
  }

  function countCompleteUnclaimed(value) {
    return entries(value).filter(function (item) {
      return item && item.status === 'complete' && item.claimed !== true;
    }).length;
  }

  function countSideDiscoveries(value) {
    return entries(value).filter(function (item) {
      return item && item.active !== false && item.claimed !== true;
    }).length;
  }

  function computeActionBadgeCounts(input) {
    input = input && typeof input === 'object' ? input : {};
    var counts = {};
    SCREENS.forEach(function (screen) {
      counts[screen] = countValue(input[screen]);
    });

    counts.quests = countCompletedQuests(input) +
      countCompleteUnclaimed(input.birdExpeditions || input.expeditions) +
      countSideDiscoveries(input.sideQuestDiscoveries);
    counts.academy = countCompleteUnclaimed(input.birdTrainingSessions || input.trainingSessions) +
      countValue(input.recruitableCount) + countValue(input.careNeedsCount);
    // Forge: pieces waiting on the anvil, plus new gear the stores can already
    // pay for. Empire: taxes waiting, plus buildings that have finished.
    counts.forge = countValue(input.forge) + countValue(input.forgeCraftable);
    counts.village = countValue(input.village) + countValue(input.buildingsComplete);
    return counts;
  }

  function removeNode(node) {
    if (!node) return;
    if (typeof node.remove === 'function') node.remove();
    else if (node.parentNode && typeof node.parentNode.removeChild === 'function') {
      node.parentNode.removeChild(node);
    }
  }

  function defaultActionText(count) {
    return count + (count === 1 ? ' action available' : ' actions available');
  }

  function applyActionBadges(root, counts, options) {
    if (!root || typeof root.querySelectorAll !== 'function') return 0;
    counts = counts && typeof counts === 'object' ? counts : {};
    options = options && typeof options === 'object' ? options : {};
    var formatActionText = typeof options.formatActionText === 'function'
      ? options.formatActionText
      : defaultActionText;
    var srOnlyClass = typeof options.screenReaderClass === 'string' && options.screenReaderClass
      ? options.screenReaderClass
      : 'sr-only';
    var items = root.querySelectorAll(BADGE_SELECTOR);
    var updated = 0;

    Array.prototype.forEach.call(items, function (item) {
      if (!item || typeof item.getAttribute !== 'function') return;
      // Dock pop-ups are keyed by where they go, routed tabs by their screen.
      var screen = item.getAttribute('data-quick-destination') || item.getAttribute('data-screen');
      if (!screen) return;
      var locked = item.getAttribute('aria-disabled') === 'true';
      var count = locked ? 0 : countValue(counts[screen]);
      var badge = typeof item.querySelector === 'function'
        ? item.querySelector('.nav-action-badge')
        : null;
      var actionTextNode = typeof item.querySelector === 'function'
        ? item.querySelector('.nav-action-text')
        : null;

      if (!(BASE_LABEL_KEY in item)) {
        item[BASE_LABEL_KEY] = item.getAttribute('aria-label');
      }
      // Gate labels change as destinations unlock; never cache a locked label.
      var baseLabel = item.getAttribute('data-unlocked-label') || item[BASE_LABEL_KEY];
      if (locked) baseLabel += ' — locked. ' + (item.getAttribute('title') || 'Continue Player Quests to unlock.');

      if (!count) {
        if (item.classList && typeof item.classList.remove === 'function') {
          item.classList.remove('has-action');
        }
        removeNode(badge);
        removeNode(actionTextNode);
        if (baseLabel == null) item.removeAttribute('aria-label');
        else item.setAttribute('aria-label', baseLabel);
        updated += 1;
        return;
      }

      var doc = item.ownerDocument || root.ownerDocument ||
        (typeof document !== 'undefined' ? document : null);
      if (!doc || typeof doc.createElement !== 'function' ||
          typeof item.appendChild !== 'function') return;

      if (item.classList && typeof item.classList.add === 'function') {
        item.classList.add('has-action');
      }
      if (!badge) {
        badge = doc.createElement('span');
        badge.className = 'nav-action-badge';
        badge.setAttribute('aria-hidden', 'true');
        item.appendChild(badge);
      }
      badge.textContent = String(count);
      badge.setAttribute('aria-hidden', 'true');

      if (!actionTextNode) {
        actionTextNode = doc.createElement('span');
        actionTextNode.className = srOnlyClass + ' nav-action-text';
        item.appendChild(actionTextNode);
      }
      var actionText = String(formatActionText(count, screen));
      actionTextNode.textContent = actionText;
      item.setAttribute('aria-label', baseLabel ? baseLabel + ', ' + actionText : actionText);
      updated += 1;
    });
    return updated;
  }

  return {
    computeActionBadgeCounts: computeActionBadgeCounts,
    applyActionBadges: applyActionBadges
  };
}));
