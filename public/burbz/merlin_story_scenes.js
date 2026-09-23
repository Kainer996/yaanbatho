/* Read-only illustrations for the opening dialogue, not the later 3D tour.
 * Artwork provenance: assets/{home-v395,special-birds,walking-quests}/README.md
 * and assets/dashboard-banners/provenance.json. No generated/downloaded new art.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BurbzMerlinStoryScenes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const art = {
    realm:'assets/dashboard-banners/your-empire.webp',
    forest:'assets/dashboard-banners/open-camera.webp',
    spell:'assets/special-birds/rook-witch-scene.webp',
    bird:'assets/walking-quests/warden.webp',
    shelter:'assets/walking-quests/wayfarer-rest.webp',
    desk:'assets/home-v395/living-field-desk.webp'
  };
  const earth = {kind:'earth', label:'Earth'};
  const alderwing = {kind:'alderwing', label:'Alderwing'};
  const bird = {kind:'bird', image:art.bird, label:'Alderwing’s birds'};
  const scenes = {
    'lesson-0':{key:'earth', label:'A message for Earth', description:'A blue and green Earth beneath the stars.', items:[earth]},
    'alderwing-story-v420-1':{key:'multiverse', label:'Across the multiverse', description:'Earth and Alderwing joined by a golden trail across the stars.', link:true, items:[earth, alderwing]},
    'alderwing-story-v420-2':{key:'alderwing', label:'Alderwing', description:'A painted bird realm of green mountains, towers and bridges.', backdrop:art.realm, items:[alderwing]},
    'alderwing-story-v420-3':{key:'birds', label:'A world led by birds', description:'An illustrated bird cartographer stands before Alderwing’s towers.', backdrop:art.realm, items:[bird]},
    'alderwing-story-v420-4':{key:'spellbound', label:'Under a dark spell', description:'A bird is enclosed by violet rings of magic. The rings represent the imprisoning spell.', backdrop:art.spell, items:[{...bird, kind:'bound', label:'Imprisoned by magic'}]},
    'alderwing-story-v420-5':{key:'you', label:'The connection is you', description:'Earth is linked to an open golden portal into Alderwing.', link:true, items:[{...earth, label:'You · on Earth'}, {kind:'portal', label:'Alderwing'}]},
    'alderwing-story-v420-6':{key:'app', label:'A spell, sent to Earth', description:'A glowing phone-shaped portal carries Merlin’s spell to Earth.', backdrop:art.spell, link:true, items:[{kind:'phone', label:'Merlin’s spell'}, earth]},
    'alderwing-story-v420-7':{key:'freedom', label:'One discovery · one bird freed', description:'A camera frame in an Earth woodland points to a bird outside the broken spell on Alderwing.', backdrop:art.forest, link:true, items:[{kind:'camera', label:'Discover on Earth'}, {...bird, kind:'freed', label:'Free on Alderwing'}]},
    'alderwing-story-v420-8':{key:'later', label:'One step at a time', description:'A warmly lit woodland shelter: a quiet place to begin before the rescue adventure.', backdrop:art.forest, items:[{kind:'shelter', image:art.shelter, label:'First, get your bearings'}]},
    'alderwing-story-v420-9':{key:'tour', label:'Your journey starts here', description:'An inviting field desk with a map, lantern and a view of Alderwing’s hills.', backdrop:art.desk, items:[]},
    'alderwing-hub-v420':{key:'hub', label:'Home · your portal', description:'The field desk is your Home and connection to Alderwing. The next lesson opens the real Enter Alderwing control.', backdrop:art.desk, items:[{kind:'portal', label:'Earth ↔ Alderwing'}]}
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
    if (scene.backdrop) view.style.setProperty('--story-art', `url("${scene.backdrop}")`);
    const caption = element('figcaption', 'merlin-story-caption', scene.label);
    caption.setAttribute('aria-hidden', 'true');
    view.append(caption);
    const items = element('div', 'merlin-story-items' + (scene.link ? ' is-linked' : ''));
    items.setAttribute('aria-hidden', 'true');
    for (const item of scene.items) {
      const figure = element('div', 'merlin-story-item');
      const visual = element('div', 'merlin-story-visual story-' + item.kind);
      if (item.image) {
        const image = element('img', 'merlin-story-art');
        image.alt = '';
        image.decoding = 'async';
        image.addEventListener('error', () => { image.hidden = true; }, {once:true});
        image.src = item.image;
        visual.append(image);
      }
      figure.append(visual, element('span', 'merlin-story-label', item.label));
      items.append(figure);
    }
    view.append(items);
    overlay.prepend(view);
    overlay.classList.add('merlin-illustrated');
  }
  return {sceneFor, show, clear};
});
