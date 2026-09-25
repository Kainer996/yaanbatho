"""Build Merlin's v3 flight atlas from the two ElevenLabs sheets.

Run from this folder: python3 build_atlas.py
Needs Pillow, numpy and scipy. Writes ../merlin-flight-v3.webp and
../atlas-config.js. The sheets are 4x2 grids on flat magenta (#FF00FF).
"""
import json
import numpy as np
from PIL import Image
from scipy import ndimage

# Rough eye positions per cut frame; refined to the pupil below. Talon
# (grip) points for the pose sheet are hand-placed on the pebble or claws.
EYE_GUESS = {
    'flap': [(253, 180), (257, 134), (263, 47), (233, 42), (243, 37), (235, 43), (243, 92), (233, 142)],
    'pose': [(222, 20), (210, 67), (172, 90), (170, 130), (191, 19), (230, 50), (168, 142), (163, 91)],
}
GRIP = {('pose', 2): (215, 178), ('pose', 3): (125, 257), ('pose', 4): (120, 126), ('pose', 7): (170, 212)}
# Atlas order: the 8-pose wing beat, then reach, grab, lift and landing flare.
ORDER = [('flap', i, 'flap', i) for i in range(8)] + [('pose', 2, 'reach', 0), ('pose', 3, 'grab', 0), ('pose', 4, 'lift', 0), ('pose', 7, 'flare', 0)]
POSE_SCALE = 1.2   # the pose sheet paints Merlin a little smaller
OUT_SCALE = 0.8
BODY_FROM_EYE = (-84, 22)  # body centre, the flight pivot, in atlas pixels


def key(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    magenta = np.minimum(r, b) - g
    alpha = np.clip((215 - magenta) / 150, 0, 1)
    al = np.maximum(alpha, 1e-3)[..., None]
    col = np.clip((a - (1 - al) * np.array([255, 0, 255], np.float32)) / al, 0, 255)
    spill = np.minimum(col[..., 0], col[..., 2]) - col[..., 1]
    fix = (spill > 25) & (alpha < .98)
    col[..., 0][fix] = np.minimum(col[..., 0][fix], col[..., 1][fix] + 25)
    col[..., 2][fix] = np.minimum(col[..., 2][fix], col[..., 1][fix] + 25)
    return np.dstack([col, alpha * 255]).astype(np.uint8)


def cut(rgba):
    solid = rgba[..., 3] > 40
    labels, count = ndimage.label(solid)
    sizes = ndimage.sum(solid, labels, range(1, count + 1))
    boxes = ndimage.find_objects(labels)
    big = [(i, boxes[i]) for i in range(count) if sizes[i] > 3000]
    big.sort(key=lambda t: (0 if (t[1][0].start + t[1][0].stop) / 2 < rgba.shape[0] / 2 else 1, t[1][1].start))
    frames = []
    others = lambda i: [j + 1 for j, _ in big if j != i]
    for i, (ys, xs) in big:
        box = np.zeros_like(solid); box[ys, xs] = True
        keep = ndimage.binary_dilation(labels == i + 1, iterations=6) | ((labels > 0) & box & ~np.isin(labels, others(i)))
        sub = rgba.copy(); sub[..., 3] = np.where(keep, sub[..., 3], 0)
        y0, x0 = max(ys.start - 4, 0), max(xs.start - 4, 0)
        frames.append(sub[y0:ys.stop + 4, x0:xs.stop + 4])
    assert len(frames) == 8, len(frames)
    return frames


def eye_and_feet(im, guess):
    im = im.astype(float)
    lum = im[..., :3] @ [.3, .59, .11]; a = im[..., 3]
    ys, xs = np.mgrid[0:im.shape[0], 0:im.shape[1]]
    near = ((xs - guess[0]) ** 2 + (ys - guess[1]) ** 2 < 14 ** 2) & (a > 200)
    pupil = near & (lum <= np.percentile(lum[near], 8))
    ex, ey = xs[pupil].mean(), ys[pupil].mean()
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    talon = (r > 150) & (g > 100) & (b < 90) & (r - b > 90) & (a > 200) & (ys > ey + 10) & (np.abs(xs - ex) > 40)
    return (ex, ey), (xs[talon].mean(), ys[talon].max() + 5)


sheets = {name: cut(key(name + '-sheet.webp')) for name in ('flap', 'pose')}
items = []
for sheet, index, clip, frame in ORDER:
    raw = sheets[sheet][index]
    eye, feet = eye_and_feet(raw, EYE_GUESS[sheet][index])
    grip = GRIP.get((sheet, index), feet)
    s = (POSE_SCALE if sheet == 'pose' else 1.0) * OUT_SCALE
    im = Image.fromarray(raw)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    items.append(dict(clip=clip, frame=frame, im=im, eye=(eye[0] * s, eye[1] * s), grip=(grip[0] * s, grip[1] * s)))

pad = 6
left = max(i['eye'][0] for i in items); right = max(i['im'].width - i['eye'][0] for i in items)
top = max(i['eye'][1] for i in items); bottom = max(i['im'].height - i['eye'][1] for i in items)
cw, ch = int(np.ceil(left + right)) + 2 * pad, int(np.ceil(top + bottom)) + 2 * pad
ax, ay = left + pad, top + pad
cols, rows = 4, 3
atlas = Image.new('RGBA', (cols * cw, rows * ch), (0, 0, 0, 0))
frames = []
for n, item in enumerate(items):
    cx, cy = (n % cols) * cw, (n // cols) * ch
    ox, oy = round(ax - item['eye'][0]), round(ay - item['eye'][1])
    atlas.alpha_composite(item['im'], (cx + ox, cy + oy))
    frames.append({'id': n, 'clip': item['clip'], 'frame': item['frame'], 'source': [cx, cy, cw, ch],
                   'grip': [round((item['grip'][0] + ox) / cw, 4), round((item['grip'][1] + oy) / ch, 4)]})
atlas.save('../merlin-flight-v3.webp', 'WEBP', quality=94, method=6)
clips = {}
for f in frames: clips.setdefault(f['clip'], []).append(f['id'])
config = {'version': 3, 'url': 'assets/merlin-flight/merlin-flight-v3.webp', 'width': cols * cw, 'height': rows * ch,
          'cell': [cw, ch], 'pivot': [round((ax + BODY_FROM_EYE[0]) / cw, 4), round((ay + BODY_FROM_EYE[1]) / ch, 4)],
          'bodyLength': 216, 'frames': frames, 'clips': clips}
with open('../atlas-config.js', 'w') as out:
    out.write('window.MERLIN_FLIGHT_ATLAS = ' + json.dumps(config, separators=(',', ':')) + ';\n')
print('atlas', atlas.size, 'cell', (cw, ch))
