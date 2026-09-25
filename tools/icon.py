"""App icon: a paint drop built from pixel tiles, half painted in the brand
rainbow and half still numbered."""
import math
import numpy as np
from PIL import Image
import sdfdraw as sd
import skel
from sdfdraw import hexrgb

INK = '#231a4f'
DEEP = '#130d31'
BANDS = ['#ff4f8b', '#ff8a3d', '#ffc93c', '#34d399', '#22b8f0', '#7b4dff']


def teardrop(X, Y, cx, cy, r, tip_y):
    alpha = math.asin(r / (cy - tip_y))
    t1 = (cx - r * math.cos(alpha), cy - r * math.sin(alpha))
    t2 = (cx + r * math.cos(alpha), cy - r * math.sin(alpha))
    return np.minimum(sd.circle(X, Y, cx, cy, r), sd.polygon(X, Y, [(cx, tip_y), t2, (cx, cy), t1]))


def main(out):
    N = 1024
    cv = sd.Canvas(N, N)
    t = np.clip((cv.X + cv.Y) / (2 * N), 0, 1)[..., None]
    bg = sd.mix(hexrgb('#8b5cff'), hexrgb('#ff4f8b'), t)
    light = np.clip(1 - np.hypot(cv.X - 330, cv.Y - 250) / 700, 0, 1)[..., None] ** 2
    cv.paint(np.full((N, N), -10.0), bg + (1 - bg) * light * 0.35)
    for (x, y, r, a) in [(170, 820, 150, 0.08), (880, 150, 190, 0.07), (900, 900, 90, 0.08)]:
        cv.paint(sd.circle(cv.X, cv.Y, x, y, r), np.array([1, 1, 1]), a)

    cx, cy, r, tip = 512, 628, 262, 118
    shape = teardrop(cv.X, cv.Y, cx, cy, r, tip)
    pitch, size = 60, 52
    cells = []
    for gy in range(-9, 6):
        for gx in range(-6, 7):
            x = cx + gx * pitch
            y = cy + gy * pitch + 20
            if 0 <= int(x) < N and 0 <= int(y) < N and shape[int(y), int(x)] < -pitch * 0.12:
                cells.append((gx, gy, x, y))

    tiles = np.min([sd.box(cv.X, cv.Y, x, y, size / 2, size / 2, 10) for _, _, x, y in cells], axis=0)
    outline = tiles - 17
    cv.paint(sd.sweep(outline, 0, 26, 26), hexrgb(DEEP))
    cv.paint(outline, hexrgb(INK))

    scale = 29 / 720
    for gx, gy, x, y in cells:
        band = min(len(BANDS) - 1, max(0, int((gy + 8) * len(BANDS) / 12.5)))
        d = sd.box(cv.X, cv.Y, x, y, size / 2, size / 2, 10)
        if gx - gy * 0.3 < 0.2:
            col = hexrgb(BANDS[band])
            shade = np.clip((cv.Y - (y - size / 2)) / size, 0, 1)[..., None]
            cv.paint(d, sd.mix(col + (1 - col) * 0.25, col * 0.86, shade))
            cv.paint(np.maximum(d + 5, -sd.shift(d + 5, 0, 9)), np.array([1, 1, 1]), 0.5)
        else:
            cv.paint(d, hexrgb('#ffffff'))
            cv.paint(np.maximum(d, -sd.shift(d, 0, -7)), hexrgb('#d9d3f7'), 1.0)
            num = str(band + 1)
            x0, _, x1, _ = skel.bounds(skel.strokes(num))
            gd, _, _ = sd.glyph(cv, num, x - (x1 - x0) * scale / 2, y + 14.5, scale)
            cv.paint(gd, hexrgb(INK))

    gloss = np.maximum(sd.circle(cv.X, cv.Y, cx - 110, cy - 150, 140), shape + 36)
    cv.paint(gloss, np.array([1, 1, 1]), 0.18)

    for (x, y, s) in [(800, 300, 44), (230, 380, 28), (790, 720, 24)]:
        cv.paint(sd.star(cv, x, y, s, bar=0.17, core=0.24), np.array([1, 1, 1]), 0.95)

    im = cv.image().convert('RGB').resize((512, 512), Image.LANCZOS)
    im.save(out, optimize=True)
    print('icon', out, im.size)
