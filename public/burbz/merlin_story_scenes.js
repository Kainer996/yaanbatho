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
  const scenes = {
    'lesson-0':{key:'earth',image:'assets/tutorial-story/merlin-arrival-20260924.webp',description:'Merlin welcomes you through a glowing portal from Alderwing.'},
    'alderwing-story-v420-1':{key:'multiverse',image:'assets/tutorial-story/merlin-arrival-20260924.webp',description:'Merlin beside a portal connecting worlds.'},
    'alderwing-story-v420-2':{key:'alderwing',image:'assets/tutorial-story/merlin-arrival-20260924.webp',description:'Alderwing’s green valleys and soaring bird kingdom.'},
    'alderwing-story-v420-3':{key:'birds',image:'assets/tutorial-story/merlin-arrival-20260924.webp',description:'Birds fly above the towers of Alderwing.'},
    'alderwing-story-v420-4':{key:'spellbound',image:'assets/tutorial-story/alderwing-spell-20260924.webp',description:'Bird warriors imprisoned in violet spell cages beneath zombie bird guards.'},
    'alderwing-story-v420-5':{key:'you',image:'assets/tutorial-story/message-to-earth-20260924.webp',description:'Merlin sends a golden spell through a portal to a phone on Earth.'},
    'alderwing-story-v420-6':{key:'app',image:'assets/tutorial-story/message-to-earth-20260924.webp',description:'The app is Merlin’s magical connection to Earth.'},
    'alderwing-story-v420-7':{key:'freedom',image:'assets/tutorial-story/warrior-freed-20260924.webp',description:'Discovering a robin on Earth frees its warrior counterpart in Alderwing.'},
    'alderwing-story-v420-8':{key:'later',image:'assets/tutorial-story/shelter-invitation-20260924.webp',description:'Merlin waits by the welcoming doorway of a temporary shelter.'},
    'alderwing-story-v420-9':{key:'tour',image:'assets/tutorial-story/shelter-invitation-20260924.webp',description:'Merlin invites you to begin the shelter tour.'},
    'alderwing-hub-v420':{key:'hub',image:'assets/tutorial-story/shelter-invitation-20260924.webp',description:'A warm field desk inside the shelter is your connection to Alderwing.'},
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
