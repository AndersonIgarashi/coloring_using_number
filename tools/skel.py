"""Stroke skeletons for the 'Pixel Splash' rounded display font.

Every glyph is a set of centre-line strokes; the outline is the set of points
within R font units of any stroke (round caps and joins for free). Units are
font units, y up, baseline at 0.
"""
import math
import numpy as np

R = 78
CAP = 720
TOP = CAP - R
BOT = R
MID = 360


def arc(cx, cy, rx, ry, a0, a1, step=3.0):
    n = max(6, int(math.ceil(abs(a1 - a0) / step)))
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def ellipse(cx, cy, rx, ry):
    return arc(cx, cy, rx, ry, 0, 360)


def dot(x, y, r=None):
    return ([(x, y)], r)


def S(*pts):
    return (list(pts), None)


def A(cx, cy, rx, ry, a0, a1):
    return (arc(cx, cy, rx, ry, a0, a1), None)


def E(cx, cy, rx, ry):
    return (ellipse(cx, cy, rx, ry), None)


def chain(*parts):
    pts = []
    for p in parts:
        seq = p[0] if isinstance(p, tuple) else p
        if pts and seq and math.dist(pts[-1], seq[0]) < 1e-6:
            seq = seq[1:]
        pts += list(seq)
    return (pts, None)


T, B, M = TOP, BOT, MID

GLYPHS = {
    'A': [S((0, B), (262, T), (318, T), (580, B)), S((92, 250), (488, 250))],
    'B': [chain([(0, B), (0, T), (205, T)], arc(205, 510, 135, 135, 90, -90), [(205, 375), (0, 375)]),
          chain([(0, 375), (235, 375)], arc(235, 225, 150, 150, 90, -90), [(235, B), (0, B)])],
    'C': [A(290, M, 290, 292, 42, 318)],
    'D': [chain([(0, B), (0, T), (190, T)], arc(190, M, 255, 285, 90, -90), [(190, B), (0, B)])],
    'E': [S((400, T), (0, T), (0, B), (400, B)), S((0, M), (345, M))],
    'F': [S((400, T), (0, T), (0, B)), S((0, M), (340, M))],
    'G': [chain(arc(295, M, 295, 292, 42, 360), [(590, M), (395, M)])],
    'H': [S((0, B), (0, T)), S((430, B), (430, T)), S((0, M), (430, M))],
    'I': [S((0, B), (0, T))],
    'J': [chain([(300, T), (300, 245)], arc(150, 245, 150, 170, 0, -170))],
    'K': [S((0, B), (0, T)), S((405, T), (20, 310)), S((150, 420), (420, B))],
    'L': [S((0, T), (0, B), (375, B))],
    'M': [S((0, B), (0, T), (285, 290), (570, T), (570, B))],
    'N': [S((0, B), (0, T), (450, B), (450, T))],
    'O': [E(300, M, 300, 292)],
    'P': [chain([(0, B), (0, T), (210, T)], arc(210, 495, 150, 150, 90, -90), [(210, 345), (0, 345)])],
    'Q': [E(300, M, 300, 292), S((375, 175), (575, -20))],
    'R': [chain([(0, B), (0, T), (210, T)], arc(210, 500, 145, 145, 90, -90), [(210, 355), (0, 355)]),
          S((180, 355), (415, B))],
    'S': [chain(arc(0, 505, 205, 140, 28, 270), arc(0, 220, 215, 145, 90, -152))],
    'T': [S((0, T), (470, T)), S((235, T), (235, B))],
    'U': [chain([(0, T), (0, 290)], arc(220, 290, 220, 212, 180, 360), [(440, 290), (440, T)])],
    'V': [S((0, T), (255, B), (510, T))],
    'W': [S((0, T), (170, B), (365, 510), (560, B), (730, T))],
    'X': [S((0, T), (480, B)), S((0, B), (480, T))],
    'Y': [S((0, T), (245, 350), (490, T)), S((245, 350), (245, B))],
    'Z': [S((0, T), (440, T), (0, B), (450, B))],

    '0': [E(0, M, 222, 292)],
    '1': [S((-120, 540), (40, T), (40, B))],
    '2': [chain(arc(0, 455, 205, 190, 158, -38), [(-205, B), (215, B)])],
    '3': [chain(arc(0, 505, 190, 140, 158, -90), [(-60, 365)]),
          chain([(-60, 365), (0, 365)], arc(0, 220, 210, 145, 90, -155))],
    '4': [S((150, B), (150, T), (-215, 235), (255, 235))],
    '5': [chain([(190, T), (-150, T), (-172, 380)], arc(15, 238, 205, 165, 138, -150))],
    '6': [chain(arc(0, 300, 210, 345, 52, 180), [(-210, 230)]), E(0, 230, 210, 155)],
    '7': [S((-200, T), (205, T), (-40, B))],
    '8': [E(0, 507, 180, 138), E(0, 222, 210, 147)],
    '9': [chain(arc(0, 420, 210, 345, -128, 0), [(210, 490)]), E(0, 490, 210, 155)],

    '.': [dot(0, B)],
    ',': [S((22, B), (-28, -95))],
    '!': [S((0, T), (0, 300)), dot(0, B)],
    '?': [chain(arc(0, 480, 190, 165, 160, -40), [(40, 275)]), dot(40, B)],
    "'": [S((0, T), (0, 505))],
    '"': [S((0, T), (0, 505)), S((200, T), (200, 505))],
    '-': [S((0, 318), (250, 318))],
    ':': [dot(0, B), dot(0, 440)],
    ';': [S((22, B), (-28, -95)), dot(22, 440)],
    '+': [S((0, 330), (380, 330)), S((190, 140), (190, 520))],
    '/': [S((0, -40), (330, T + 40))],
    '(': [A(250, M, 250, 400, 132, 228)],
    ')': [A(-250, M, 250, 400, 48, -48)],
    '%': [E(0, 525, 118, 122), E(420, 195, 118, 122), S((-30, 20), (450, 700))],
    '#': [S((110, 60), (170, 660)), S((330, 60), (390, 660)), S((0, 230), (480, 230)), S((20, 490), (500, 490))],
    '&': [chain([(470, B), (95, 470)], arc(175, 545, 105, 100, 223, -50), [(25, 285)],
                arc(185, 215, 185, 140, 150, 380), [(450, 330)])],
}

SIDE = {'default': (46, 46), 'I': (52, 52), '1': (40, 52), '.': (40, 40), ',': (40, 40),
        '!': (40, 40), ':': (40, 40), ';': (40, 40), "'": (40, 40), '"': (40, 40), 'J': (30, 46),
        'L': (46, 30), 'T': (22, 22), 'Y': (26, 26), 'V': (30, 30), 'W': (26, 26), 'A': (30, 30),
        '7': (40, 30), '/': (20, 20)}


def strokes(ch):
    out = []
    for pts, r in GLYPHS[ch]:
        if pts:
            out.append((np.asarray(pts, dtype=np.float64), R if r is None else r))
    return out


def sdf(strokes_list, xs, ys):
    """Signed distance (negative inside) of the union of stroked polylines,
    sampled on the grid xs (cols) x ys (rows)."""
    X, Y = np.meshgrid(xs, ys)
    best = np.full(X.shape, np.inf)
    for pts, r in strokes_list:
        if len(pts) == 1:
            d = np.hypot(X - pts[0, 0], Y - pts[0, 1])
        else:
            d = np.full(X.shape, np.inf)
            a = pts[:-1]
            b = pts[1:]
            for (ax, ay), (bx, by) in zip(a, b):
                vx, vy = bx - ax, by - ay
                ll = vx * vx + vy * vy
                if ll < 1e-12:
                    dd = np.hypot(X - ax, Y - ay)
                else:
                    t = np.clip(((X - ax) * vx + (Y - ay) * vy) / ll, 0.0, 1.0)
                    dd = np.hypot(X - (ax + t * vx), Y - (ay + t * vy))
                np.minimum(d, dd, out=d)
        np.minimum(best, d - r, out=best)
    return best


def bounds(strokes_list):
    xs = np.concatenate([p[:, 0] - r for p, r in strokes_list] + [p[:, 0] + r for p, r in strokes_list])
    ys = np.concatenate([p[:, 1] - r for p, r in strokes_list] + [p[:, 1] + r for p, r in strokes_list])
    return xs.min(), ys.min(), xs.max(), ys.max()
