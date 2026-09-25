#!/usr/bin/env python3
"""Bake the Academy's night art from the day paintings.

Run from public/burbz:  python3 assets/academy-night-20260925/source/bake_night.py
Needs Pillow, numpy and scipy.

Every night file lines up pixel for pixel with its day painting, so the game
can fade between them as the real evening draws in.

- Trees: the sky is cut away (the live night sky shows through), and the
  tree and valley are graded to moonlight, with a silver rim where leaves
  meet the sky and a few warm cottage lights down in the valley.
- Boughs: the same moonlight grade, alpha kept.
- Houses: moonlit timber, but the lamps, windows and hearths keep burning.
  Their light falls on the wood around them and spills into the night air.
  The manga houses also take light from the glow anchors that
  academy_alive_core.js already places on every window and lantern.
"""
import json
import pathlib
import subprocess

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = pathlib.Path(__file__).resolve().parent
BURBZ = HERE.parents[2]
ASSETS = BURBZ / 'assets'
OUT = HERE.parent
MANGA = ASSETS / 'academy-manga-20260925'
HOME = ASSETS / 'academy-living-tree-20260925'
HOUSES = ['kitchen', 'crowbar', 'training', 'hospital', 'tavern', 'observatory', 'workshop',
          'nursery', 'library', 'magpie_market', 'quest_roost', 'manager_office']


# ---- colour helpers ----------------------------------------------------------

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def lum(lin):
    return lin[..., 0] * 0.2126 + lin[..., 1] * 0.7152 + lin[..., 2] * 0.0722


def hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = (mx == r) & m
    gg = (mx == g) & m & ~rr
    bb = m & ~rr & ~gg
    h[rr] = ((g - b)[rr] / d[rr]) % 6
    h[gg] = ((b - r)[gg] / d[gg]) + 2
    h[bb] = ((r - g)[bb] / d[bb]) + 4
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return h * 60, s, mx


def load(path):
    return np.asarray(Image.open(path).convert('RGBA')).astype(np.float32) / 255.0


def save(path, rgba, quality=82):
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
    img.save(path, 'WEBP', quality=quality, method=6, alpha_quality=90)
    print(f'{path.relative_to(BURBZ)}  {img.size[0]}x{img.size[1]}  {path.stat().st_size // 1024} KB')


# ---- sky -----------------------------------------------------------------------

def sky_mask(rgb, horizon, style, ridge=None):
    """Soft 0..1 sky. Nothing below the horizon line counts as sky. The manga
    mountains are the same blue as the sky, so their ridge is traced by hand
    as (x, y) fractions and nothing below it counts as sky either."""
    H, W = rgb.shape[:2]
    h, s, v = hsv(rgb)
    if style == 'manga':
        blue = (h > 183) & (h < 236) & (s > 0.28) & (v > 0.70)
        cloud = (s < 0.24) & (v > 0.80) & ~((h > 35) & (h < 100) & (s > 0.10))
        cloud |= (s < 0.36) & (v > 0.74) & (h > 180) & (h < 240)  # cloud shading
    else:
        # The painted tree is backlit: its sky shows as pale blue and warm glare.
        blue = (h > 180) & (h < 240) & (s > 0.10) & (v > 0.72)
        blue |= (v > 0.90) & (s < 0.40) & (h > 25) & (h < 80)
        cloud = (s < 0.14) & (v > 0.86)
    ys = np.broadcast_to(np.arange(H)[:, None] / H, (H, W))
    allowed = ys < horizon + 0.025
    if ridge:
        top = np.interp(np.arange(W) / W, [p[0] for p in ridge], [p[1] for p in ridge])
        allowed = allowed & (ys < top[None, :] - 0.002)
    blue &= allowed
    cloud &= allowed
    lab, n = ndi.label(blue)
    if n:
        sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
        keep = np.zeros(n + 1, bool)
        keep[1:] = sizes >= W * H * 0.00002
        blue = keep[lab]
    # White only counts as cloud where it touches blue sky, so blossom stays.
    near = ndi.binary_dilation(blue, iterations=5)
    lab, n = ndi.label(cloud)
    if n:
        keep = np.zeros(n + 1, bool)
        keep[1:] = np.asarray(ndi.maximum(near, lab, range(1, n + 1))) > 0
        cloud = keep[lab]
    sky = ndi.binary_closing(blue | cloud, iterations=1)
    lab, n = ndi.label(~sky)
    if n:
        sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
        small = np.zeros(n + 1, bool)
        small[1:] = sizes < W * H * 0.00004
        sky |= small[lab]
    # The painted tree's sky shows in small gaps, so its edges get a softer cut.
    soft = ndi.gaussian_filter(sky.astype(np.float32), sigma=max(0.8, W / (1400 if style == 'manga' else 560)))
    soft *= 1 - smooth(horizon - 0.02, horizon + 0.025, ys)
    if ridge:
        soft *= ndi.gaussian_filter(allowed.astype(np.float32), sigma=max(0.8, W / 1400))
    return np.clip(soft, 0, 1)


# ---- moonlight -------------------------------------------------------------------

MOON = np.array([0.60, 0.76, 1.20], np.float32)


def moonlight(rgb, exposure=0.26, desat=0.55, top=0.35, moon_x=0.8):
    """Linear-light night grade: desaturate, cool, dim, lit from above."""
    H, W = rgb.shape[:2]
    lin = to_lin(rgb)
    y = lum(lin)[..., None]
    base = (lin * (1 - desat) + y * desat) * MOON
    ys = np.linspace(0, 1, H)[:, None]
    xs = np.linspace(0, 1, W)[None, :]
    light = (1 - top) + top * (1 - ys) ** 1.3
    light = light * (0.88 + 0.24 * np.exp(-((xs - moon_x) ** 2) / 0.18))
    out = base * exposure * light[..., None]
    return out + np.array([0.0035, 0.0055, 0.012])


def valley_lights(shape, rng, regions, count):
    """Warm cottage lights, far away down the valley."""
    H, W = shape
    glow = np.zeros((H, W), np.float32)
    core = np.zeros((H, W), np.float32)
    for x0, y0, x1, y1 in regions:
        for _ in range(count):
            cx = rng.uniform(x0, x1) * W
            cy = rng.uniform(y0, y1) * H
            r = rng.uniform(0.9, 1.7) * W / 1080
            iy, ix = int(cy), int(cx)
            if 0 <= iy < H and 0 <= ix < W:
                core[iy, ix] += rng.uniform(0.7, 1.0)
                glow[iy, ix] += r
    core = ndi.gaussian_filter(core, sigma=W / 900) * (W / 900) ** 2 * 6.0
    glow = ndi.gaussian_filter(glow, sigma=W / 170) * (W / 170) ** 2 * 1.6
    return np.clip(core, 0, 1.4), np.clip(glow, 0, 0.6)


def bake_tree(src, dst, style, horizon, moon_x, valleys, seed, ridge=None):
    rgba = load(src)
    rgb = rgba[..., :3]
    H, W = rgb.shape[:2]
    sky = sky_mask(rgb, horizon, style, ridge)
    out = moonlight(rgb, exposure=0.27 if style == 'manga' else 0.30, moon_x=moon_x)
    y = lum(to_lin(rgb))
    # silver rim where leaves and bark meet the sky
    near = ndi.gaussian_filter(sky, sigma=W / 260)
    rim = np.clip(near * 1.6, 0, 1) * (1 - sky)
    out += rim[..., None] * y[..., None] * 0.45 * np.array([0.75, 0.86, 1.0])
    core, glow = valley_lights((H, W), np.random.default_rng(seed), valleys, 7)
    ground = 1 - sky
    out += (core[..., None] * np.array([1.0, 0.80, 0.48]) + glow[..., None] * np.array([1.0, 0.62, 0.30]) * 0.12) * ground[..., None]
    save(dst, np.dstack([to_srgb(out), 1 - sky]))


def bake_bough(src, dst):
    rgba = load(src)
    out = moonlight(rgba[..., :3], exposure=0.25, top=0.2, moon_x=0.5)
    save(dst, np.dstack([to_srgb(out), rgba[..., 3]]))


# ---- houses --------------------------------------------------------------------

LAMP = np.array([1.0, 0.66, 0.32])
# Anchor glow kinds from academy_alive_core.js: colour, strength, reach.
KINDS = {
    'window': (LAMP, 1.15, 2.0),
    'lantern': (np.array([1.0, 0.70, 0.36]), 1.35, 2.3),
    'hearth': (np.array([1.0, 0.52, 0.20]), 1.5, 2.4),
    'sign': (np.array([1.0, 0.78, 0.45]), 0.55, 1.6),
    'cool': (np.array([0.55, 0.72, 1.0]), 0.9, 2.0),
    'coollantern': (np.array([0.66, 0.80, 1.0]), 1.0, 2.1),
    'moon': (np.array([0.80, 0.86, 1.0]), 0.8, 1.8),
    'pulse': (np.array([0.55, 1.0, 0.72]), 0.8, 1.8),
    'breath': (np.array([1.0, 0.80, 0.55]), 0.95, 2.0),
}


def emissive(rgb, alpha, scale=1.0):
    """Warm, bright blobs: lamp flames, lit windows, hearth fire.
    Thin gold timber highlights, moss and straw are opened away."""
    h, s, v = hsv(rgb)
    warm = smooth(8, 18, h) * (1 - smooth(48, 56, h))
    e = warm * smooth(0.84, 0.96, v) * smooth(0.34, 0.58, s)
    near = ndi.binary_dilation(e > 0.3, iterations=max(1, int(3 * scale)))
    core = smooth(0.94, 0.99, v) * (1 - smooth(0.40, 0.62, s)) * near
    e = np.maximum(e, core * 0.9)
    it = max(1, int(round(2 * scale)))
    blob = ndi.binary_opening(e > 0.28, iterations=it)
    lab, n = ndi.label(blob)
    if n:
        # big bright fields (straw roofs, sunlit walls) are not lamps
        sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
        keep = np.zeros(n + 1, bool)
        keep[1:] = sizes < rgb.shape[0] * rgb.shape[1] * 0.004
        blob = keep[lab]
    blob = ndi.binary_dilation(blob, iterations=it)
    e = ndi.gaussian_filter(e * blob, sigma=0.6 * scale)
    return np.clip(e * alpha, 0, 1)


def bake_house(src, dst, anchors=(), min_y=0.0, box=112.0):
    rgba = load(src)
    rgb, a = rgba[..., :3], rgba[..., 3]
    H, W = a.shape
    base = moonlight(rgb, exposure=0.34, top=0.25, moon_x=0.5)
    alb = to_lin(rgb)
    e = emissive(rgb, a, scale=W / 512)
    if min_y > 0:
        e = e * smooth(min_y - 0.03, min_y + 0.03, np.linspace(0, 1, H))[:, None]
    # Lamplight falls on the timber around every lit window and lantern.
    light = np.stack([ndi.gaussian_filter(e, sigma=W / 34)] * 3, -1) * LAMP * 4.2
    ys, xs = np.mgrid[0:H, 0:W]
    side = max(H, W)  # anchors are fractions of a square, object-fit:contain box
    ox, oy = (side - W) / 2, (side - H) / 2
    for an in anchors:
        if an.get('type') != 'glow':
            continue
        col, strength, reach = KINDS.get(an['glow'], KINDS['window'])
        cx, cy = an['fx'] * side - ox, an['fy'] * side - oy
        r = an.get('r', 20) / box * side * reach * 0.42
        f = np.exp(-((xs - cx) ** 2 + (ys - cy) ** 2) / (2 * r * r))
        light += f[..., None] * col * strength * 0.38
    lit = base + alb * light * 0.55
    # The lamps themselves burn in their own colour.
    lamp = alb * 1.45 + np.array([0.06, 0.03, 0.0])
    out = lit * (1 - e[..., None]) + lamp * e[..., None]
    # Bloom on the house, and a soft halo out into the night air.
    near = np.stack([ndi.gaussian_filter(alb[..., i] * e, sigma=W / 60) for i in range(3)], -1)
    wide = np.stack([ndi.gaussian_filter(alb[..., i] * e, sigma=W / 20) for i in range(3)], -1)
    tint = np.array([1.0, 0.74, 0.42])
    out = out + (near * 1.2 + wide * 1.6) * tint * a[..., None]
    halo = np.clip(lum(wide * tint) * 3.0, 0, 0.7)
    out_a = np.clip(a + halo * (1 - a), 0, 1)
    rgb_out = (out * a[..., None] + tint * 0.9 * (halo * (1 - a))[..., None]) / np.maximum(out_a[..., None], 1e-4)
    save(dst, np.dstack([to_srgb(rgb_out), out_a]))


def anchors():
    code = "process.stdout.write(JSON.stringify(require('./academy_alive_core.js').ANCHORS))"
    return json.loads(subprocess.check_output(['node', '-e', code], cwd=BURBZ))


# Mountain ridges of the two manga paintings, traced from the day art.
RIDGE_TALL = [(0.00, 0.620), (0.05, 0.616), (0.13, 0.602), (0.15, 0.600), (0.20, 0.607), (0.22, 0.605),
              (0.25, 0.610), (0.28, 0.611), (0.31, 0.616), (0.80, 0.624), (0.84, 0.620), (0.88, 0.611),
              (0.92, 0.620), (0.95, 0.610), (1.00, 0.602)]
RIDGE_WIDE = [(0.00, 0.571), (0.02, 0.570), (0.05, 0.567), (0.07, 0.577), (0.09, 0.584), (0.11, 0.596),
              (0.13, 0.609), (0.16, 0.603), (0.175, 0.600), (0.19, 0.607), (0.33, 0.611), (0.35, 0.619),
              (0.375, 0.609), (0.40, 0.614), (0.43, 0.617), (0.62, 0.634), (0.64, 0.637), (0.66, 0.636),
              (0.70, 0.625), (0.72, 0.633), (0.75, 0.625), (0.77, 0.623), (0.80, 0.625), (0.83, 0.620),
              (0.85, 0.611), (0.87, 0.603), (0.89, 0.596), (0.91, 0.597), (0.93, 0.601), (0.95, 0.593),
              (0.97, 0.583), (1.00, 0.590)]


def main():
    # (painting, style, horizon, moon side, valley regions as x0,y0,x1,y1 fractions)
    bake_tree(MANGA / 'tree.webp', OUT / 'manga' / 'tree.webp', 'manga', 0.645, 0.8,
              [(0.00, 0.655, 0.20, 0.74), (0.82, 0.655, 1.00, 0.70)], 1, RIDGE_TALL)
    bake_tree(MANGA / 'tree-wide.webp', OUT / 'manga' / 'tree-wide.webp', 'manga', 0.655, 0.8,
              [(0.02, 0.65, 0.26, 0.78), (0.70, 0.66, 0.97, 0.80)], 2, RIDGE_WIDE)
    bake_tree(HOME / 'tree.webp', OUT / 'home' / 'tree.webp', 'home', 0.66, 0.8,
              [(0.02, 0.74, 0.18, 0.88), (0.84, 0.80, 0.98, 0.90)], 3)
    bake_tree(HOME / 'tree-wide.webp', OUT / 'home' / 'tree-wide.webp', 'home', 0.60, 0.8,
              [(0.02, 0.74, 0.24, 0.94), (0.76, 0.76, 0.98, 0.94)], 4)
    for b in 'abcd':
        bake_bough(MANGA / f'bough-{b}.webp', OUT / 'manga' / f'bough-{b}.webp')
    marks = anchors()
    for rid in HOUSES:
        # The Training Hall's straw roof shines like a lamp; only its deck lights count.
        min_y = 0.36 if rid == 'training' else 0.0
        bake_house(MANGA / f'{rid}.webp', OUT / 'manga' / f'{rid}.webp', marks.get(rid, []), min_y)
        bake_house(HOME / f'{rid}.webp', OUT / 'home' / f'{rid}.webp', (), min_y)


if __name__ == '__main__':
    main()
