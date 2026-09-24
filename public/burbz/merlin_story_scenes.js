/* Read-only illustrations for the opening dialogue, not the later 3D tour.
 * Generated artwork and prompts: assets/tutorial-story/README.md.
 * Scene selection is presentation only; dialogue and saved lessons are unchanged.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BurbzMerlinStoryScenes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Five beats, one painting each. `focus` keeps the subject in frame when a
  // tall phone screen crops the wide painting.
  const scenes = {
    'lesson-0':{key:'arrival',image:'assets/tutorial-story/merlin-arrival-20260924.webp',focus:'32% 40%',description:'Merlin arrives through a glowing portal above the towers of Alderwing.'},
    'alderwing-story-v420-4':{key:'spellbound',image:'assets/tutorial-story/alderwing-spell-20260924.webp',focus:'38% 50%',description:'Bird warriors trapped in violet spell cages beneath zombie bird guards.'},
    'alderwing-story-v420-5':{key:'message',image:'assets/tutorial-story/message-to-earth-20260924.webp',focus:'50% 50%',description:'Merlin sends a golden spell through a portal to a phone on Earth.'},
    'alderwing-story-v420-7':{key:'freedom',image:'assets/tutorial-story/warrior-freed-20260924.webp',focus:'40% 50%',description:'Finding a robin on Earth frees its warrior twin in Alderwing.'},
    'alderwing-hub-v420':{key:'hub',image:'assets/tutorial-story/shelter-invitation-20260924.webp',focus:'30% 60%',description:'Merlin waits at the open door of your shelter, your hub and portal to Alderwing.'},
  };
  function sceneFor(id) {
    return Object.prototype.hasOwnProperty.call(scenes, id) ? scenes[id] : null;
  }
  function clear(overlay) {
    if (!overlay) return;
    overlay.classList.remove('merlin-illustrated');
    overlay.querySelector('.merlin-story-scene')?.remove();
  }
  function show(overlay, id) {
    if (!overlay) return;
    const scene = sceneFor(id);
    if (!scene) { clear(overlay); return; }
    // Rebuild only on lesson changes; no observers, animation loop or saved state.
    const previous = overlay.querySelector('.merlin-story-scene');
    if (previous?.dataset.scene === scene.key) return;
    clear(overlay);
    const document = overlay.ownerDocument;
    const element = (tag, className, text) => {
      const node = document.createElement(tag);
      node.className = className;
      if (text) node.textContent = text;
      return node;
    };
    const view = element('figure', 'merlin-story-scene');
    view.dataset.scene = scene.key;
    view.style.setProperty('--scene-image', `url("${scene.image}")`);
    view.style.setProperty('--scene-focus', scene.focus);
    view.setAttribute('role', 'img');
    view.setAttribute('aria-label', scene.description);
    const image = element('img', 'merlin-story-painting');
    image.alt = '';
    image.width = 1536;
    image.height = 1024;
    image.decoding = 'async';
    image.src = scene.image;
    view.append(image);
    overlay.prepend(view);
    overlay.classList.add('merlin-illustrated');
  }
  return {sceneFor, show, clear};
});
