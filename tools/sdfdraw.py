"""Tiny signed-distance-field painter: shapes are SDF arrays in pixels
(negative inside), painted with analytic anti-aliasing onto a premultiplied
RGBA canvas."""
import math
import numpy as np
from PIL import Image
import skel

BIG = 1e5


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def mix(a, b, t):
    return a + (b - a) * t


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.rgb = np.zeros((h, w, 3))
        self.a = np.zeros((h, w))
        ys, xs = np.mgrid[0:h, 0:w]
        self.X = xs + 0.5
        self.Y = ys + 0.5

    def paint(self, sdf, color, alpha=1.0):
        cov = np.clip(0.5 - sdf, 0, 1) * alpha
        col = color if np.ndim(color) == 3 else np.broadcast_to(color, (self.h, self.w, 3))
        self.rgb = col * cov[..., None] + self.rgb * (1 - cov[..., None])
        self.a = cov + self.a * (1 - cov)

    def image(self):
        a = self.a
        rgb = np.where(a[..., None] > 1e-6, self.rgb / np.maximum(a[..., None], 1e-6), 0)
        arr = np.dstack([np.clip(rgb, 0, 1), np.clip(a, 0, 1)])
        return Image.fromarray((arr * 255 + 0.5).astype(np.uint8), 'RGBA')

    def save(self, path):
        self.image().save(path, optimize=True)


def circle(X, Y, cx, cy, r):
    return np.hypot(X - cx, Y - cy) - r


def box(X, Y, cx, cy, hw, hh, r=0.0, angle=0.0):
    x, y = X - cx, Y - cy
    if angle:
        ca, sa = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        x, y = x * ca + y * sa, -x * sa + y * ca
    qx = np.abs(x) - hw + r
    qy = np.abs(y) - hh + r
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r


def polyline(X, Y, pts, r):
    pts = [tuple(p) for p in pts]
    if len(pts) == 1:
        return np.hypot(X - pts[0][0], Y - pts[0][1]) - r
    d = np.full(X.shape, np.inf)
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
        vx, vy = bx - ax, by - ay
        ll = vx * vx + vy * vy or 1e-12
        t = np.clip(((X - ax) * vx + (Y - ay) * vy) / ll, 0, 1)
        np.minimum(d, np.hypot(X - ax - t * vx, Y - ay - t * vy), out=d)
    return d - r


def polygon(X, Y, pts):
    pts = np.asarray(pts, float)
    d = np.full(X.shape, np.inf)
    inside = np.zeros(X.shape, bool)
    n = len(pts)
    for i in range(n):
        ax, ay = pts[i]
        bx, by = pts[(i + 1) % n]
        vx, vy = bx - ax, by - ay
        ll = vx * vx + vy * vy or 1e-12
        t = np.clip(((X - ax) * vx + (Y - ay) * vy) / ll, 0, 1)
        np.minimum(d, np.hypot(X - ax - t * vx, Y - ay - t * vy), out=d)
        cond = (ay > Y) != (by > Y)
        xint = ax + (Y - ay) * vx / (vy if vy else 1e-12)
        inside ^= cond & (X < xint)
    return np.where(inside, -d, d)


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return mix(b, a, h) - k * h * (1 - h)


def shift(sdf, dx, dy):
    out = np.full(sdf.shape, BIG)
    h, w = sdf.shape
    ys = slice(max(0, dy), min(h, h + dy))
    yd = slice(max(0, -dy), min(h, h - dy))
    xs = slice(max(0, dx), min(w, w + dx))
    xd = slice(max(0, -dx), min(w, w - dx))
    out[ys, xs] = sdf[yd, xd]
    return out


# Union of the shape dragged along (dx, dy): a solid 3D extrusion
def sweep(sdf, dx, dy, steps):
    out = sdf.copy()
    for k in range(1, steps + 1):
        np.minimum(out, shift(sdf, round(dx * k / steps), round(dy * k / steps)), out=out)
    return out


def glyph(cv, ch, x, baseline, scale, radius=None, angle=0.0, pivot=None, margin=40):
    """SDF (pixels) of a font glyph whose ink box starts at x, sitting on baseline,
    optionally drawn with a heavier stroke and rotated (clockwise degrees) about pivot.
    Returns (sdf, ink_width_px, ink_box)."""
    st = skel.strokes(ch)
    x0, y0, x1, y1 = skel.bounds(st)
    grow = (radius if radius is not None else skel.R) - skel.R
    ox = x - (x0 - grow) * scale
    width = (x1 - x0 + 2 * grow) * scale
    left = int(max(0, x - margin))
    right = int(min(cv.w, x + width + margin))
    top = int(max(0, baseline - (y1 + grow) * scale - margin))
    bot = int(min(cv.h, baseline - (y0 - grow) * scale + margin))
    out = np.full((cv.h, cv.w), BIG)
    if right <= left or bot <= top:
        return out, width, None
    Xw = cv.X[top:bot, left:right]
    Yw = cv.Y[top:bot, left:right]
    if angle:
        px, py = pivot
        ca, sa = math.cos(math.radians(-angle)), math.sin(math.radians(-angle))
        Xw, Yw = px + (Xw - px) * ca - (Yw - py) * sa, py + (Xw - px) * sa + (Yw - py) * ca
    u = (Xw - ox) / scale
    v = (baseline - Yw) / scale
    d = np.full(u.shape, np.inf)
    for pts, r in st:
        np.minimum(d, polyline(u, v, pts, 0.0) - (r + grow), out=d)
    out[top:bot, left:right] = d * scale
    return out, width, (x, baseline - (y1 + grow) * scale, x + width, baseline - (y0 - grow) * scale)


def vgrad(cv, top_color, bottom_color, y0, y1):
    t = np.clip((cv.Y - y0) / max(1e-6, y1 - y0), 0, 1)[..., None]
    return mix(hexrgb(top_color), hexrgb(bottom_color), t)


# Two-bar sparkle with a soft centre
def star(cv, cx, cy, r, bar=0.16, core=0.22):
    d = np.full((cv.h, cv.w), BIG)
    for a in (0, 90):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        d = np.minimum(d, polyline(cv.X, cv.Y, [(cx - r * ca, cy - r * sa), (cx + r * ca, cy + r * sa)], r * bar))
    return smin(d, circle(cv.X, cv.Y, cx, cy, r * core), r * 0.25)
