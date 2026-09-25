"""'PIXEL' in literal pixel blocks over 'SPLASH' in the heavy rounded font:
per-letter gradients, ink outline, 3D extrusion, gloss and paint drips."""
import math
import numpy as np
from PIL import Image
import sdfdraw as sd
import skel
from sdfdraw import hexrgb

INK = '#231a4f'
DEEP = '#130d31'

PIX = {
    'P': ['####.', '#...#', '####.', '#....', '#....'],
    'I': ['###', '.#.', '.#.', '.#.', '###'],
    'X': ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    'E': ['####', '#...', '###.', '#...', '####'],
    'L': ['#...', '#...', '#...', '#...', '####'],
}

# letter, gradient top, gradient bottom, tilt, baseline offset
SPLASH = [
    ('S', '#ff6fa5', '#e8286f', -5, 6),
    ('P', '#ffb347', '#ff7a1a', 3, -4),
    ('L', '#ffe45c', '#ffb81a', -2, 8),
    ('A', '#6ee7a0', '#1fb86e', 4, -2),
    ('S', '#5fdcff', '#1c9cf0', -4, 5),
    ('H', '#b39bff', '#7447f5', 5, -3),
]
# letter index -> [(x along the letter, drip length, drop radius)]
DRIPS = {2: [(0.62, 70, 21)], 3: [(0.22, 52, 17)], 5: [(0.82, 84, 23)]}

# The heavier logo stroke closes the font's 'A' counter, so it gets a wider A
WIDE_A = [skel.S((-10, skel.B), (250, skel.T), (330, skel.T), (590, skel.B)), skel.S((105, 220), (475, 220))]


def main(out, scale_out=0.5):
    font_a = skel.GLYPHS['A']
    skel.GLYPHS['A'] = WIDE_A
    try:
        im = render()
    finally:
        skel.GLYPHS['A'] = font_a
    im = im.resize((int(im.width * scale_out), int(im.height * scale_out)), Image.LANCZOS)
    im.save(out, optimize=True)
    print('logo', out, im.size)


def render():
    W, H = 2048, 680
    cv = sd.Canvas(W, H)
    outline_w = 17
    depth = 20
    cap = 300
    scale = cap / 720.0
    radius = 104
    baseline = 540
    track = -4

    widths = [sd.glyph(cv, ch, 0, baseline, scale, radius)[1] for ch, *_ in SPLASH]
    x = (W - sum(widths) - track * (len(widths) - 1)) / 2 + 60
    shapes = []
    for i, (ch, c0, c1, ang, dy) in enumerate(SPLASH):
        w = widths[i]
        pivot = (x + w / 2, baseline - cap / 2 + dy)
        d, _, ink = sd.glyph(cv, ch, x, baseline + dy, scale, radius, angle=ang, pivot=pivot, margin=110)
        for fx, length, rr in DRIPS.get(i, []):
            dx0 = x + w * fx
            tip_y = baseline + dy + length
            drip = np.minimum(sd.polyline(cv.X, cv.Y, [(dx0, baseline + dy - 40), (dx0, tip_y - rr * 0.5)], rr * 0.62),
                              sd.circle(cv.X, cv.Y, dx0, tip_y, rr))
            d = sd.smin(d, drip, 14)
        shapes.append((d, c0, c1, ink))
        x += w + track

    pixel, gap, px0, py0, tilt = 24, 5, 250, 92, -4.0
    pix_shapes = []
    cx = px0
    for ch in 'PIXEL':
        rows = PIX[ch]
        d = np.full((H, W), sd.BIG)
        for r, row in enumerate(rows):
            for c, v in enumerate(row):
                if v != '#':
                    continue
                bx = cx + c * (pixel + gap) + pixel / 2
                by = py0 + r * (pixel + gap) + pixel / 2 + (bx - px0) * math.tan(math.radians(tilt))
                d = np.minimum(d, sd.box(cv.X, cv.Y, bx, by, pixel / 2, pixel / 2, 5, tilt))
        pix_shapes.append(d)
        cx += (len(rows[0]) + 1) * (pixel + gap)

    pix_out = np.min(pix_shapes, axis=0) - 13.25
    cv.paint(sd.sweep(pix_out, 0, 14, 14), hexrgb(DEEP))
    cv.paint(pix_out, hexrgb(INK))
    for d in pix_shapes:
        cv.paint(d, sd.vgrad(cv, '#ffffff', '#dcd6ff', py0, py0 + 5 * (pixel + gap)))
        cv.paint(np.maximum(d, -sd.shift(d, 0, 6)), hexrgb('#b9aef5'), 0.9)

    union_out = np.min([d for d, *_ in shapes], axis=0) - outline_w
    cv.paint(sd.sweep(union_out, 0, depth, depth), hexrgb(DEEP))
    cv.paint(union_out, hexrgb(INK))
    for d, c0, c1, ink in shapes:
        cv.paint(d - outline_w, hexrgb(INK))
        cv.paint(d, sd.vgrad(cv, c0, c1, ink[1] + 10, ink[3] - 10))
        cv.paint(np.maximum(d, -sd.shift(d, 0, -12)), np.array([0, 0, 0]), 0.16)
        cv.paint(np.maximum(d + 7, -sd.shift(d + 7, 0, 13)), np.array([1, 1, 1]), 0.62)

    for (x, y, r, color) in [(1750, 170, 40, '#ffffff'), (1845, 250, 22, '#ffe45c'), (200, 400, 26, '#ffffff')]:
        d = sd.star(cv, x, y, r)
        cv.paint(d - 7, hexrgb(INK))
        cv.paint(d, hexrgb(color))

    for (x, y, r, color) in [(1720, 590, 13, '#5fdcff'), (300, 590, 11, '#ff6fa5'), (1800, 540, 8, '#b39bff'),
                             (250, 540, 16, '#ffb347')]:
        d = sd.circle(cv.X, cv.Y, x, y, r)
        cv.paint(d - 9, hexrgb(INK))
        cv.paint(d, hexrgb(color))

    im = cv.image()
    x0, y0, x1, y1 = im.getbbox()
    pad = 8
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)))
