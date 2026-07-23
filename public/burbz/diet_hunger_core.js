/* Compatibility wrapper for the source-backed diet/hunger core. */
(function(root) {
  let api = root && root.BurbzDietHungerCore;
  if (!api && typeof require === 'function') {
    api = require('./bird_diet_hunger_core.js');
  }
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && api) root.BurbzDietHungerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
