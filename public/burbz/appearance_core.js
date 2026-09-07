(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzAppearanceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function normalize(value) { return value === 'comic' ? 'comic' : 'normal'; }
  function readStoredTheme(storage) {
    try { return normalize(JSON.parse(storage.getItem('burbz_state') || '{}')?.settings?.appearance); }
    catch (_) { return 'normal'; }
  }
  function apply(theme, doc) {
    theme = normalize(theme);
    if (!doc) return theme;
    doc.documentElement.setAttribute('data-appearance', theme);
    if (doc.body) {
      doc.body.classList.toggle('woodland-ui', theme === 'normal');
      doc.body.classList.toggle('comic-ui', theme === 'comic');
    }
    const meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'comic' ? '#ffda38' : '#000000');
    doc.querySelectorAll('input[name="appearanceTheme"]').forEach(input => { input.checked = input.value === theme; });
    return theme;
  }
  // Only this cosmetic setting changes. The existing durable game-save path
  // remains the authority, including its storage-failure and cloud behavior.
  function choose(settings, value, persist, doc) {
    if (value !== 'normal' && value !== 'comic') return { ok:false, theme:normalize(settings.appearance) };
    const existed = Object.prototype.hasOwnProperty.call(settings, 'appearance');
    const previous = settings.appearance;
    settings.appearance = value;
    try {
      const saved = persist();
      if (!saved || saved.ok !== true) throw new Error('Appearance could not be saved');
    } catch (error) {
      if (existed) settings.appearance = previous;
      else delete settings.appearance;
      apply(previous, doc);
      return { ok:false, theme:normalize(previous), error };
    }
    apply(value, doc);
    return { ok:true, theme:value };
  }
  return { normalize, readStoredTheme, apply, choose };
});
