"""Seamless glitter tile for the optional 'sparkle' cell material (screen-blended)."""
import random
import numpy as np
from PIL import Image

TINTS = [(1.0, 1.0, 1.0), (1.0, 0.93, 0.7), (0.8, 0.92, 1.0), (1.0, 0.8, 0.95), (0.85, 1.0, 0.9)]


def main(out):
    S = 512
    rnd = random.Random(5)
    img = np.zeros((S, S, 3))
    ys, xs = np.mgrid[0:S, 0:S]

    def splat(x, y, r, color, power):
        x0, x1 = int(x - r * 3) - 1, int(x + r * 3) + 2
        y0, y1 = int(y - r * 3) - 1, int(y + r * 3) + 2
        for oy in (-S, 0, S):
            for ox in (-S, 0, S):
                a0, a1 = max(0, x0 + ox), min(S, x1 + ox)
                b0, b1 = max(0, y0 + oy), min(S, y1 + oy)
                if a1 <= a0 or b1 <= b0:
                    continue
                X = xs[b0:b1, a0:a1] + 0.5 - (x + ox)
                Y = ys[b0:b1, a0:a1] + 0.5 - (y + oy)
                v = np.exp(-(X * X + Y * Y) / (2 * r * r)) * power
                img[b0:b1, a0:a1] += v[..., None] * np.array(color)

    def glint(x, y, length, color, power):
        for oy in (-S, 0, S):
            for ox in (-S, 0, S):
                cx, cy = x + ox, y + oy
                x0, x1 = max(0, int(cx - length) - 2), min(S, int(cx + length) + 3)
                y0, y1 = max(0, int(cy - length) - 2), min(S, int(cy + length) + 3)
                if x1 <= x0 or y1 <= y0:
                    continue
                X = xs[y0:y1, x0:x1] + 0.5 - cx
                Y = ys[y0:y1, x0:x1] + 0.5 - cy
                v = (np.exp(-np.abs(X) / 0.9) * np.exp(-np.abs(Y) / (length * 0.35)) +
                     np.exp(-np.abs(Y) / 0.9) * np.exp(-np.abs(X) / (length * 0.35)))
                img[y0:y1, x0:x1] += v[..., None] * np.array(color) * power

    for _ in range(2600):
        splat(rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(0.45, 1.1), rnd.choice(TINTS), rnd.uniform(0.25, 0.9))
    for _ in range(90):
        splat(rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(1.2, 2.0), rnd.choice(TINTS), rnd.uniform(0.6, 1.0))
    for _ in range(26):
        glint(rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(5, 11), rnd.choice(TINTS), rnd.uniform(0.7, 1.0))

    arr = (np.clip(img, 0, 1) ** 0.9 * 255).astype(np.uint8)
    Image.fromarray(arr, 'RGB').save(out, 'WEBP', quality=82, method=6)
    print('sparkle', out)

