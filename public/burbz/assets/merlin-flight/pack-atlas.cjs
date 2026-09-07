#!/usr/bin/env node
'use strict';

// Technical export only: key the supplied image-generator matte, isolate complete
// connected artwork, and align it. This script never draws/reconstructs bird art.
// NODE_PATH=/home/yaan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node work/pack-merlin-atlas.cjs
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = __dirname;
const argv = process.argv.slice(2);
function option(name, fallback) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : fallback; }
const INPUT = path.resolve(option('--input', path.join(ROOT, 'generated')));
const OUTPUT = path.resolve(option('--output', path.join(ROOT, 'packed')));
const ANCHORS = path.resolve(option('--anchors', path.join(ROOT, 'merlin-atlas-anchors.json')));
const ALLOW_DRAFT = argv.includes('--allow-draft');
const INCLUDE_DRAFTS = argv.includes('--include-drafts');
const CELL = 256, COLS = 8, ROWS = 8, PIVOT = [128, 160], BODY_PX = Number(option('--body-pixels', 120)), MARGIN = 8;
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

function chromaMatte(data) {
  let keyedPixels = 0, edgePixels = 0;
  // Source matte is vivid magenta with small generator/compression variations.
  // Removing excess shared R/B preserves neutral/blue/gold/brown bird colors.
  // Matte cleanup occurs before resizing so Lanczos receives correct true alpha.
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, oldAlpha] = data.subarray(i, i + 4);
    const spill = Math.max(0, Math.min(r, b) - g);
    // 241 = min(245,247)-4 for the measured matte. Matching this value
    // matters: a stronger key creates a complementary green edge fringe.
    let alpha = 1 - Math.min(1, spill / 241);
    if (alpha < 0.15) alpha = 0;
    if (alpha === 0) { data.fill(0, i, i + 4); keyedPixels++; continue; }
    if (alpha < 1) {
      // Unpremultiply the estimated magenta contribution; no hue replacement.
      const matte = [245, 4, 247];
      for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - matte[c] * (1 - alpha)) / alpha)));
      data[i + 3] = Math.round(oldAlpha * alpha);
      edgePixels++;
    }
  }
  return { keyedPixels, edgePixels };
}

function connectedComponents(data, width, height) {
  const labels = new Int32Array(width * height);
  const queue = new Int32Array(width * height);
  const components = [];
  for (let p = 0; p < labels.length; p++) {
    if (labels[p] || data[p * 4 + 3] < 12) continue;
    const label = components.length + 1;
    let read = 0, write = 0, minX = width, minY = height, maxX = 0, maxY = 0, sumX = 0, sumY = 0;
    labels[p] = label; queue[write++] = p;
    while (read < write) {
      const q = queue[read++], x = q % width, y = Math.floor(q / width);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); sumX += x; sumY += y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const n = ny * width + nx;
        if (!labels[n] && data[n * 4 + 3] >= 12) { labels[n] = label; queue[write++] = n; }
      }
    }
    components.push({ label, count: write, x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, centroid: [sumX / write, sumY / write] });
  }
  return { labels, components };
}

function atAnchor(anchor, labels, components, width, height) {
  const x = Math.round(anchor[0]), y = Math.round(anchor[1]);
  if (x < 0 || x >= width || y < 0 || y >= height) throw Error(`Anchor outside source: ${anchor}`);
  const id = labels[y * width + x];
  if (!id || components[id - 1].count < 500) throw Error(`Anchor ${anchor} is not inside a bird body; inspect source overlay.`);
  return components[id - 1];
}

function draftAnchors(components) {
  // Only creates a review proposal. Production output requires reviewed=true.
  return components.filter(c => c.count >= 500).sort((a, b) => a.centroid[1] - b.centroid[1]).reduce((rows, c, i) => {
    rows[Math.floor(i / 4)].push(c); return rows;
  }, [[], []]).flatMap(row => row.sort((a, b) => a.centroid[0] - b.centroid[0])).map(c => ({pivot: c.centroid.map(Math.round), bodyLength: 275, reviewed: false}));
}

function alphaBounds(data, width, height, threshold = 4) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1, edgeNonzero = 0, marginNonzero = 0, opaquePixels = 0, semiTransparentPixels = 0, magentaPixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, a = data[i + 3];
    if (a === 255) opaquePixels++; else if (a > 0) semiTransparentPixels++;
    if (a <= threshold) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) edgeNonzero++;
    if (x < MARGIN || y < MARGIN || x >= width - MARGIN || y >= height - MARGIN) marginNonzero++;
    if (a > 20 && Math.min(data[i], data[i + 2]) - data[i + 1] > 80) magentaPixels++;
  }
  return {bounds: x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1], edgeNonzero, marginNonzero, opaquePixels, semiTransparentPixels, magentaPixels};
}

async function main() {
  await fs.mkdir(OUTPUT, {recursive: true});
  const config = JSON.parse(await fs.readFile(ANCHORS, 'utf8'));
  const files = (await fs.readdir(INPUT)).filter(f => /^0[0-7]-.+\.png$/.test(f) && (INCLUDE_DRAFTS || !f.endsWith('-draft.png'))).sort();
  if (!files.length) throw Error(`No generated sheets in ${INPUT}`);
  if (new Set(files.map(f=>f.slice(0,2))).size !== files.length) throw Error('Multiple input sheets select the same atlas row. Keep one reviewed consuming source per row.');
  const composites = [], contact = [], qa = [], draft = {};
  const frameMap = {format: 1, cell: [CELL, CELL], grid: [COLS, ROWS], pivot: PIVOT, preferredBodyPixels: BODY_PX, views: [], frames: []};
  let unreviewed = false;
  for (const file of files) {
    const row = Number(file.slice(0, 2));
    const {data, info} = await sharp(path.join(INPUT, file)).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    let zeroAlpha = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] === 0) zeroAlpha++;
    // The image generator sometimes returns real RGBA despite previewing hidden
    // RGB background colors. Preserve that mask exactly; key opaque matte only.
    const existingAlpha = zeroAlpha > info.width * info.height * .01;
    const chroma = existingAlpha ? {keyedPixels:0,edgePixels:0} : chromaMatte(data);
    const {labels, components} = connectedComponents(data, info.width, info.height);
    const major = components.filter(c => c.count >= 500);
    if (major.length !== 8) throw Error(`${file}: expected 8 separate birds, found ${major.length}. Source needs inspection; never crop through merged artwork.`);
    const mapping = config.views[file] || {frames: draftAnchors(components)};
    if (mapping.frames.length !== 8) throw Error(`${file}: expected 8 frame anchors.`);
    draft[file] = mapping;
    // One cap for the WHOLE view. Capping frames separately to their moving wing
    // bounds would make the bird's body pulse larger/smaller through each flap.
    const perFrameCaps = mapping.frames.map(anchor => {
      const c = atAnchor(anchor.pivot, labels, components, info.width, info.height);
      const [x, y] = anchor.pivot;
      if (!(anchor.bodyLength > 0)) throw Error(`${file}: missing measured bodyLength.`);
      return anchor.bodyLength * Math.min(
        (PIVOT[0] - MARGIN - 1) / Math.max(1, x - c.x),
        (PIVOT[1] - MARGIN - 1) / Math.max(1, y - c.y),
        (CELL - PIVOT[0] - MARGIN - 1) / Math.max(1, c.x + c.width - x),
        (CELL - PIVOT[1] - MARGIN - 1) / Math.max(1, c.y + c.height - y)
      );
    });
    const viewBodyPx = Math.floor(Math.min(BODY_PX, ...perFrameCaps) * 10) / 10;
    const viewMeta = {row, source: file, sourceAlpha: existingAlpha ? 'preserved' : 'magenta-keyed', bodyPixels: viewBodyPx, preferredBodyPixels: BODY_PX, cappedForWholeView: viewBodyPx < BODY_PX, talon: [0, 0]};
    frameMap.views.push(viewMeta);
    const sourceOverlays = [];
    const selected = new Set();
    for (let col = 0; col < 8; col++) {
      const anchor = mapping.frames[col];
      if (!anchor.reviewed) unreviewed = true;
      const component = atAnchor(anchor.pivot, labels, components, info.width, info.height);
      if (selected.has(component.label)) throw Error(`${file}: anchors select the same component more than once.`);
      selected.add(component.label);
      const [px, py] = anchor.pivot;
      const baseScale = viewBodyPx / anchor.bodyLength;
      const scale = baseScale;
      const left = Math.round(PIVOT[0] - (px - component.x) * scale);
      const top = Math.round(PIVOT[1] - (py - component.y) * scale);
      const targetWidth = Math.round(component.width * scale), targetHeight = Math.round(component.height * scale);
      if (left < MARGIN || top < MARGIN || left + targetWidth > CELL - MARGIN || top + targetHeight > CELL - MARGIN) throw Error(`${file} frame ${col}: fixed body scale violates ${MARGIN}px margin (${left},${top},${targetWidth},${targetHeight}); review body size/view, do not bbox-normalize.`);
      const crop = Buffer.alloc(component.width * component.height * 4);
      for (let y = 0; y < component.height; y++) for (let x = 0; x < component.width; x++) {
        const sourcePixel = (component.y + y) * info.width + component.x + x;
        if (labels[sourcePixel] !== component.label) continue;
        data.copy(crop, (y * component.width + x) * 4, sourcePixel * 4, sourcePixel * 4 + 4);
      }
      const sprite = await sharp(crop, {raw: {width: component.width, height: component.height, channels: 4}}).resize(targetWidth, targetHeight).png().toBuffer();
      const cell = await sharp({create: {width: CELL, height: CELL, channels: 4, background: '#00000000'}}).composite([{input: sprite, left, top}]).png().toBuffer();
      const rawCell = await sharp(cell).raw().toBuffer();
      const stats = alphaBounds(rawCell, CELL, CELL);
      if (stats.edgeNonzero || stats.marginNonzero || stats.magentaPixels) throw Error(`${file} frame ${col}: failed edge/matte QA ${JSON.stringify(stats)}`);
      composites.push({input: cell, left: col * CELL, top: row * CELL});
      contact.push({input: cell, left: col * CELL, top: row * CELL});
      const talonSource = anchor.talon || [px, py + anchor.bodyLength * .42];
      const talon = [PIVOT[0] + (talonSource[0] - px) * scale, PIVOT[1] + (talonSource[1] - py) * scale].map(n => Math.round(n * 100) / 100);
      viewMeta.talon[0] += talon[0] / 8; viewMeta.talon[1] += talon[1] / 8;
      const frame = {row, column: col, source: file, sourcePivot: anchor.pivot, sourceBodyLength: anchor.bodyLength, bodyPixels: viewBodyPx, reviewed: Boolean(anchor.reviewed), sourceBounds: [component.x, component.y, component.width, component.height], scale, rect: [col * CELL, row * CELL, CELL, CELL], pivot: PIVOT, talon, sourceTalon: talonSource, talonReviewed: Boolean(anchor.talon && anchor.reviewed), talonVisible: anchor.talonVisible !== false, ...stats};
      frameMap.frames.push(frame);
      qa.push(frame);
      sourceOverlays.push(`<rect x="${component.x}" y="${component.y}" width="${component.width}" height="${component.height}" fill="none" stroke="#55ddff" stroke-width="2"/><path d="M${px-12} ${py}h24M${px} ${py-12}v24" stroke="#ffcc00" stroke-width="3"/><circle cx="${talonSource[0]}" cy="${talonSource[1]}" r="7" fill="none" stroke="#00e5ca" stroke-width="3"/><text x="${px+16}" y="${py-16}" fill="white" stroke="black" stroke-width=".8" font-family="sans-serif" font-size="24">${col} ${anchor.reviewed ? 'reviewed' : 'DRAFT'}</text>`);
      await fs.writeFile(path.join(OUTPUT, `${file.slice(0,-4)}-${col}.png`), cell);
    }
    const overlay = Buffer.from(`<svg width="${info.width}" height="${info.height}" xmlns="http://www.w3.org/2000/svg">${sourceOverlays.join('')}</svg>`);
    await sharp(data, {raw: {width: info.width, height: info.height, channels: 4}}).composite([{input: overlay}]).png().toFile(path.join(OUTPUT, `${file.slice(0, -4)}-anchor-review.png`));
    viewMeta.talon = viewMeta.talon.map(n => Math.round(n * 100) / 100);
    console.log(`${file}: ${major.length} complete birds; ${chroma.keyedPixels} matte pixels cleared; reviewed ${mapping.frames.filter(f=>f.reviewed).length}/8; shared body height ${viewBodyPx}px.`);
  }
  await fs.writeFile(path.join(OUTPUT, 'anchors-review.json'), JSON.stringify({views: draft}, null, 2)+'\n');
  await fs.writeFile(path.join(OUTPUT, 'atlas-qa.json'), JSON.stringify({sources: files, complete: files.length === ROWS, reviewed: !unreviewed, cell: CELL, minimumMargin: MARGIN, frames: qa}, null, 2)+'\n');
  if (unreviewed && !ALLOW_DRAFT) throw Error('Unreviewed anchors: inspect *-anchor-review.png and anchors-review.json, enter reviewed body anchors/lengths in the input anchor map, then rerun. --allow-draft emits a clearly named draft only.');
  const basename = unreviewed ? 'merlin-flight-draft' : 'merlin-flight';
  const atlas = sharp({create: {width: CELL * COLS, height: CELL * ROWS, channels: 4, background: '#00000000'}}).composite(composites);
  await atlas.clone().png({compressionLevel:9}).toFile(path.join(OUTPUT, `${basename}.png`));
  await atlas.clone().webp({lossless:true, effort:6}).toFile(path.join(OUTPUT, `${basename}.webp`));
  await fs.writeFile(path.join(OUTPUT, `${basename}.mapping.json`), JSON.stringify(frameMap, null, 2)+'\n');
  // Debug image preserves transparency. Labels/grid are in a distinct debug file,
  // never baked into a consuming atlas. The pivot shows the same torso position.
  const labelsSvg = [];
  for (const frame of qa) {
    const x=frame.column*CELL, y=frame.row*CELL;
    labelsSvg.push(`<rect x="${x+.5}" y="${y+.5}" width="255" height="255" fill="none" stroke="#668899" stroke-opacity=".45"/><path d="M${x+PIVOT[0]-6} ${y+PIVOT[1]}h12M${x+PIVOT[0]} ${y+PIVOT[1]-6}v12" stroke="#00b5ad" stroke-opacity=".85"/><circle cx="${x+frame.talon[0]}" cy="${y+frame.talon[1]}" r="3" fill="none" stroke="#00b5ad"/><text x="${x+10}" y="${y+20}" fill="#367a8c" font-family="sans-serif" font-size="13">${escape(frame.source.slice(3,-4))} / ${frame.column}${frame.reviewed?'':' DRAFT'}</text>`);
  }
  contact.push({input: Buffer.from(`<svg width="2048" height="2048" xmlns="http://www.w3.org/2000/svg">${labelsSvg.join('')}</svg>`), left:0,top:0});
  await sharp({create:{width:2048,height:2048,channels:4,background:'#00000000'}}).composite(contact).png().toFile(path.join(OUTPUT,'contact-sheet-transparent.png'));
  for (const [name, background] of [['light','#f4f0df'],['dark','#16251f']]) {
    await sharp(path.join(OUTPUT,'contact-sheet-transparent.png')).flatten({background}).png().toFile(path.join(OUTPUT,`contact-sheet-${name}.png`));
  }
  for (const file of files) {
    await sharp(path.join(OUTPUT,'contact-sheet-transparent.png')).extract({left:0,top:Number(file.slice(0,2))*CELL,width:CELL*COLS,height:CELL}).png().toFile(path.join(OUTPUT,`${file.slice(0,-4)}-row-review.png`));
  }
  const encodedPng = await sharp(path.join(OUTPUT,`${basename}.png`)).ensureAlpha().raw().toBuffer();
  const encodedWebp = await sharp(path.join(OUTPUT,`${basename}.webp`)).ensureAlpha().raw().toBuffer();
  let alphaMismatches = 0, visibleColorMismatches = 0;
  for (let i = 0; i < encodedPng.length; i += 4) {
    if (encodedPng[i+3] !== encodedWebp[i+3]) alphaMismatches++;
    if (encodedPng[i+3] > 0 && (encodedPng[i] !== encodedWebp[i] || encodedPng[i+1] !== encodedWebp[i+1] || encodedPng[i+2] !== encodedWebp[i+2])) visibleColorMismatches++;
  }
  if (alphaMismatches || visibleColorMismatches) throw Error(`Encoded atlas roundtrip mismatch: ${alphaMismatches} alpha, ${visibleColorMismatches} visible RGB.`);
  await fs.writeFile(path.join(OUTPUT,'encoded-export-qa.json'),JSON.stringify({size:[2048,2048],format:['PNG RGBA','lossless WebP RGBA'],alphaMismatches,visibleColorMismatches,occupiedRows:files.length,pivot:PIVOT},null,2)+'\n');
  console.log(JSON.stringify({output: OUTPUT, frames: qa.length, rows: files.length, complete: files.length === ROWS, reviewed: !unreviewed, edgesClear: qa.every(f=>!f.marginNonzero), magentaPixels: qa.reduce((s,f)=>s+f.magentaPixels,0)}, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
