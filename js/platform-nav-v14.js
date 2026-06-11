/**
 * Platform Nav — Two platforms, edge cables, 4 corner cogs
 * Top platform = header | Bottom platform = floor bar
 * Cogs at corners spin on scroll to drive the cables
 */
(function () {
  'use strict';

  let cogAngle = 0;
  let lastScrollY = window.scrollY;

  // ─── COG SVG PATH ──────────────────────────────────────────────────────────
  function buildGearPath(teeth, outerR, innerR) {
    let d = '';
    for (let i = 0; i < teeth; i++) {
      const toothSpan = 0.28;
      const a1 = (i / teeth) * Math.PI * 2 - toothSpan;
      const a2 = (i / teeth) * Math.PI * 2 + toothSpan;
      const ai1 = (i / teeth) * Math.PI * 2 - toothSpan * 0.5 + Math.PI / teeth;
      const ai2 = (i / teeth) * Math.PI * 2 + toothSpan * 0.5 + Math.PI / teeth;
      if (i === 0) d += `M${(Math.cos(a1) * outerR).toFixed(2)} ${(Math.sin(a1) * outerR).toFixed(2)} `;
      d += `L${(Math.cos(a1) * outerR).toFixed(2)} ${(Math.sin(a1) * outerR).toFixed(2)} `;
      d += `L${(Math.cos(a2) * outerR).toFixed(2)} ${(Math.sin(a2) * outerR).toFixed(2)} `;
      d += `L${(Math.cos(ai1) * innerR).toFixed(2)} ${(Math.sin(ai1) * innerR).toFixed(2)} `;
      d += `L${(Math.cos(ai2) * innerR).toFixed(2)} ${(Math.sin(ai2) * innerR).toFixed(2)} `;
    }
    return d + 'Z';
  }

  function makeCogSVG(size) {
    const r = size / 2;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width',  size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `${-r} ${-r} ${size} ${size}`);
    svg.style.cssText = 'display:block;overflow:visible;';

    const gear = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    gear.setAttribute('d', buildGearPath(10, r * 0.95, r * 0.68));
    gear.setAttribute('fill', '#666');
    gear.setAttribute('stroke', '#333');
    gear.setAttribute('stroke-width', '1');

    const hub = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hub.setAttribute('cx', '0'); hub.setAttribute('cy', '0');
    hub.setAttribute('r', (r * 0.28).toFixed(1));
    hub.setAttribute('fill', '#cc0000');
    hub.setAttribute('stroke', '#880000');
    hub.setAttribute('stroke-width', '1.5');

    const axle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    axle.setAttribute('cx', '0'); axle.setAttribute('cy', '0');
    axle.setAttribute('r', (r * 0.12).toFixed(1));
    axle.setAttribute('fill', '#1a1a1a');

    svg.appendChild(gear);
    svg.appendChild(hub);
    svg.appendChild(axle);
    return { svg, gear };
  }

  // ─── BUILD ──────────────────────────────────────────────────────────────────
  const cogEls = []; // all gear path elements for spinning

  function build() {
    const vw = window.innerWidth;
    const COG = 26; // cog diameter px

    // Cable centres (same x as the CSS left/right cable positions + half cable width)
    const CX_LEFT  = 10;       // left cable center x from viewport left
    const CX_RIGHT = vw - 10;  // right cable center x from viewport left
    const cogHalf  = COG / 2;

    // ── LEFT CABLE ──
    const cableL = document.createElement('div');
    cableL.className = 'lift-cable lift-cable-left';
    document.body.appendChild(cableL);

    // ── RIGHT CABLE — removed per Yaan's request ──

    // ── FLOOR ──
    const floor = document.createElement('div');
    floor.id = 'platform-floor';
    document.body.appendChild(floor);

    // ── TWO COGS (left side only) — centered on cable x ──
    const cogDefs = [
      { cx: CX_LEFT,  atTop: true  },
      { cx: CX_LEFT,  atTop: false },
    ];

    cogDefs.forEach(def => {
      const wrap = document.createElement('div');
      // Use bottom positioning for floor cogs so they stay pinned regardless of viewport resize
      const pinStyle = def.atTop
        ? `top: 0px; bottom: auto;`
        : `bottom: 22px; top: auto;`;          // always flush with floor bar
      wrap.style.cssText = `
        position: fixed;
        left: ${def.cx - cogHalf}px;
        ${pinStyle}
        width: ${COG}px;
        height: ${COG}px;
        z-index: 8992;
        pointer-events: none;
      `;
      const { svg, gear } = makeCogSVG(COG);
      cogEls.push(gear);
      wrap.appendChild(svg);
      document.body.appendChild(wrap);
    });
  }

  // ─── SCROLL → SPIN COGS ────────────────────────────────────────────────────
  function onScroll() {
    const delta = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    cogAngle += delta * 0.9;

    cogEls.forEach((g, i) => {
      // Left cogs clockwise on scroll-down, right counter-clockwise (real pulley)
      // Negate delta so scrolling UP feels like lifting
      const dir = i < 2 ? -1 : 1;
      g.setAttribute('transform', `rotate(${cogAngle * dir})`);
    });

    // Cable background-position shift (rope moves)
    document.querySelectorAll('.lift-cable').forEach(c => {
      c.style.backgroundPosition = `0 ${(window.scrollY * 0.5) % 14}px`;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    // Re-position right-side cogs on resize
    const vw = window.innerWidth;
    const COG = 38;
    document.querySelectorAll('.cog-right-wrap').forEach(w => {
      w.style.left = (vw - COG - 10) + 'px';
    });
  });

  // ─── INIT ───────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

})();
