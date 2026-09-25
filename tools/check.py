"""Check stamp shown over a finished colour's palette button."""
import numpy as np
from PIL import Image
import sdfdraw as sd
from sdfdraw import hexrgb

INK = '#231a4f'
DEEP = '#130d31'


def main(out):
    cv = sd.Canvas(500, 436)
    d = sd.polyline(cv.X, cv.Y, [(98, 212), (196, 304), (398, 100)], 50)
    outline = d - 20
    cv.paint(sd.sweep(outline, 0, 22, 22), hexrgb(DEEP))
    cv.paint(outline, hexrgb(INK))
    cv.paint(d, sd.vgrad(cv, '#ffffff', '#e4ddff', 60, 360))
    cv.paint(np.maximum(d, -sd.shift(d, 0, -12)), hexrgb('#b8abf2'), 1.0)
    cv.paint(np.maximum(d + 10, -sd.shift(d + 10, 0, 12)), np.array([1, 1, 1]), 0.9)
    cv.paint(sd.circle(cv.X, cv.Y, 372, 112, 11), np.array([1, 1, 1]), 0.95)
    im = cv.image().resize((250, 218), Image.LANCZOS)
    im.save(out, optimize=True)
    print('check', out, im.size)
