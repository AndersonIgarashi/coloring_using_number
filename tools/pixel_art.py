"""The board picture: a pixel-art Pikachu face drawn cell by cell, outlined
automatically, printed as the `pixels` array for src/config.ts and saved as a
colour + numbers preview.

python pixel_art.py [preview.png]
"""
import sys
import numpy as np
from PIL import Image, ImageDraw

PALETTE = {1: '#ffd43b', 2: '#f59f1c', 3: '#ef3b36', 4: '#8a1c2b', 5: '#ffffff', 6: '#1e1b2e'}
CODES = {'.': 0, 'Y': 1, 'O': 2, 'R': 3, 'M': 4, 'W': 5, 'K': 6}

# Silhouette without the outline: K = black ear tips, Y = yellow fur
SILHOUETTE = [
    '.....................',
    '..K...............K..',
    '..KK.............KK..',
    '..KKK...........KKK..',
    '...KKK.........KKK...',
    '...YYY.........YYY...',
    '...YYYY.......YYYY...',
    '....YYYY.....YYYY....',
    '....YYYY.....YYYY....',
    '.....YYYY...YYYY.....',
    '....YYYYYYYYYYYYY....',
    '...YYYYYYYYYYYYYYY...',
    '..YYYYYYYYYYYYYYYYY..',
    '.YYYYYYYYYYYYYYYYYYY.',
    '.YYYYYYYYYYYYYYYYYYY.',
    '.YYYYYYYYYYYYYYYYYYY.',
    '.YYYYYYYYYYYYYYYYYYY.',
    '.YYYYYYYYYYYYYYYYYYY.',
    '.YYYYYYYYYYYYYYYYYYY.',
    '.YYYYYYYYYYYYYYYYYYY.',
    '..YYYYYYYYYYYYYYYYY..',
    '...YYYYYYYYYYYYYYY...',
    '.....YYYYYYYYYYY.....',
    '.....................',
]


def mirror(cells):
    return [(r, 20 - c) for r, c in cells]


def eye(c0, r0):
    black = [(r0, c0 + 1), (r0, c0 + 2), (r0 + 1, c0), (r0 + 1, c0 + 2), (r0 + 1, c0 + 3),
             (r0 + 2, c0), (r0 + 2, c0 + 1), (r0 + 2, c0 + 2), (r0 + 2, c0 + 3),
             (r0 + 3, c0), (r0 + 3, c0 + 1), (r0 + 3, c0 + 2), (r0 + 3, c0 + 3), (r0 + 4, c0 + 1), (r0 + 4, c0 + 2)]
    return black, [(r0 + 1, c0 + 1)]


def build():
    rows = [list(r) for r in SILHOUETTE]

    def paint(cells, ch):
        for r, c in cells:
            rows[r][c] = ch

    for c0 in (4, 13):
        black, shine = eye(c0, 12)
        paint(black, 'K')
        paint(shine, 'W')
    paint([(16, 10), (17, 9), (17, 11)], 'K')
    paint([(18, 8), (18, 12), (19, 8), (19, 12), (20, 9), (20, 10), (20, 11)], 'K')
    paint([(18, 9), (18, 10), (18, 11)], 'M')
    paint([(19, 9), (19, 10), (19, 11)], 'R')
    cheek = [(17, 2), (17, 3), (18, 1), (18, 2), (18, 3), (18, 4), (19, 1), (19, 2), (19, 3), (19, 4), (20, 2), (20, 3)]
    paint(cheek + mirror(cheek), 'R')
    ear_inner = [(5, 5), (6, 6), (7, 7), (8, 7), (9, 8)]
    paint(ear_inner + mirror(ear_inner), 'O')
    paint([(22, c) for c in range(5, 16)] + [(21, 3), (21, 4), (21, 16), (21, 17)], 'O')

    grid = np.array([[CODES[ch] for ch in row] for row in rows])
    return outline(grid)


# Every empty cell touching the picture (4-neighbourhood) becomes black outline
def outline(grid):
    out = grid.copy()
    h, w = grid.shape
    for r in range(h):
        for c in range(w):
            if grid[r, c]:
                continue
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                rr, cc = r + dr, c + dc
                if 0 <= rr < h and 0 <= cc < w and grid[rr, cc]:
                    out[r, c] = 6
                    break
    return out


def to_config(grid):
    lines = ['  %d,' % grid.shape[1]]
    for i, row in enumerate(grid):
        lines.append('  ' + ','.join(str(v) for v in row) + (',' if i < len(grid) - 1 else ''))
    return '\n'.join(lines)


def preview(grid, path, cell=26):
    rows, cols = grid.shape
    w, h = cols * cell + 2, rows * cell + 2
    im = Image.new('RGB', (w * 2 + 20, h), 'white')
    d = ImageDraw.Draw(im)
    for r in range(rows):
        for c in range(cols):
            v = int(grid[r, c])
            if not v:
                continue
            x, y = c * cell + 1, r * cell + 1
            d.rectangle([x, y, x + cell - 1, y + cell - 1], fill=PALETTE[v])
            x += w + 20
            d.rectangle([x, y, x + cell - 1, y + cell - 1], outline='#9aa0b4')
            d.text((x + cell / 2, y + cell / 2), str(v), fill='black', anchor='mm')
    im.save(path)


if __name__ == '__main__':
    grid = build()
    print(to_config(grid))
    if len(sys.argv) > 1:
        preview(grid, sys.argv[1])
