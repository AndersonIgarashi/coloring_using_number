"""Builds the Pixel Splash TTF: glyph skeletons -> SDF -> marching squares
outlines -> simplified TrueType contours -> hand-written sfnt tables.
Caps only: lowercase letters map to the uppercase glyphs."""
import math
import struct
import numpy as np
import skel

STEP = 2.0
EPS = 0.6
SPACE = 300
ASCENT, DESCENT = 880, -160
# 2026-09-24, fixed so rebuilding gives the same bytes
TIMESTAMP = 1790208000 + 2082844800


def contours_from_sdf(f, xs, ys):
    """Marching squares with the inside kept on the right of each directed edge,
    so outer contours come out clockwise and holes counter-clockwise (y up)."""
    inside = f < 0
    case = (inside[:-1, :-1] * 1 + inside[:-1, 1:] * 2 + inside[1:, 1:] * 4 + inside[1:, :-1] * 8).astype(np.int8)
    table = {1: [(3, 0)], 2: [(0, 1)], 3: [(3, 1)], 4: [(1, 2)], 6: [(0, 2)], 7: [(3, 2)], 8: [(2, 3)],
             9: [(2, 0)], 11: [(2, 1)], 12: [(1, 3)], 13: [(1, 0)], 14: [(0, 3)]}
    pos, nxt = {}, {}

    def point(key):
        if key in pos:
            return
        kind, i, j = key
        if kind == 'h':
            fa, fb = f[j, i], f[j, i + 1]
            t = fa / (fa - fb)
            pos[key] = (xs[i] + t * (xs[i + 1] - xs[i]), ys[j])
        else:
            fa, fb = f[j, i], f[j + 1, i]
            t = fa / (fa - fb)
            pos[key] = (xs[i], ys[j] + t * (ys[j + 1] - ys[j]))

    for j, i in zip(*np.nonzero((case != 0) & (case != 15))):
        c = int(case[j, i])
        e = [('h', i, j), ('v', i + 1, j), ('h', i, j + 1), ('v', i, j)]
        if c in (5, 10):
            centre = (f[j, i] + f[j, i + 1] + f[j + 1, i + 1] + f[j + 1, i]) / 4
            if c == 5:
                segs = [(1, 0), (3, 2)] if centre < 0 else [(3, 0), (1, 2)]
            else:
                segs = [(0, 3), (2, 1)] if centre < 0 else [(0, 1), (2, 3)]
        else:
            segs = table[c]
        for a, b in segs:
            point(e[a])
            point(e[b])
            nxt[e[a]] = e[b]

    loops, seen = [], set()
    for start in nxt:
        if start in seen:
            continue
        loop, k = [], start
        while k not in seen:
            seen.add(k)
            loop.append(pos[k])
            k = nxt[k]
        loops.append(np.array(loop))
    return loops


def rdp(pts, eps):
    keep = np.zeros(len(pts), bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b - a < 2:
            continue
        p, q = pts[a], pts[b]
        seg = pts[a + 1:b]
        v = q - p
        ll = math.hypot(*v)
        if ll < 1e-9:
            d = np.hypot(*(seg - p).T)
        else:
            d = np.abs(v[0] * (seg[:, 1] - p[1]) - v[1] * (seg[:, 0] - p[0])) / ll
        k = int(np.argmax(d))
        if d[k] > eps:
            m = a + 1 + k
            keep[m] = True
            stack += [(a, m), (m, b)]
    return pts[keep]


def simplify_loop(loop, eps):
    far = int(np.argmax(np.hypot(*(loop - loop[0]).T)))
    first = rdp(loop[:far + 1], eps)
    second = rdp(np.vstack([loop[far:], loop[:1]]), eps)
    out = []
    for x, y in np.round(np.vstack([first[:-1], second[:-1]])).astype(int):
        if not out or (x, y) != out[-1]:
            out.append((int(x), int(y)))
    while len(out) > 1 and out[0] == out[-1]:
        out.pop()
    return out


def area(c):
    return 0.5 * sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(c, c[1:] + c[:1]))


def glyph_outline(ch):
    st = skel.strokes(ch)
    x0, y0, x1, y1 = skel.bounds(st)
    xs = np.arange(math.floor(x0) - 6, math.ceil(x1) + 7, STEP)
    ys = np.arange(math.floor(y0) - 6, math.ceil(y1) + 7, STEP)
    f = skel.sdf(st, xs, ys)
    contours = [simplify_loop(l, EPS) for l in contours_from_sdf(f, xs, ys)]
    contours = [c for c in contours if len(c) >= 3 and abs(area(c)) > 6]
    lsb, rsb = skel.SIDE.get(ch, skel.SIDE['default'])
    xmin = min(x for c in contours for x, _ in c)
    xmax = max(x for c in contours for x, _ in c)
    contours = [[(x + lsb - xmin, y) for x, y in c] for c in contours]
    return contours, (xmax - xmin) + lsb + rsb


def pad4(b):
    return b + b'\0' * ((4 - len(b) % 4) % 4)


def checksum(b):
    b = pad4(b)
    return sum(struct.unpack('>%dI' % (len(b) // 4), b)) & 0xFFFFFFFF


def encode_glyph(contours):
    if not contours:
        return b'', (0, 0, 0, 0), 0
    pts = [p for c in contours for p in c]
    xmin = min(p[0] for p in pts)
    ymin = min(p[1] for p in pts)
    xmax = max(p[0] for p in pts)
    ymax = max(p[1] for p in pts)
    ends, n = [], 0
    for c in contours:
        n += len(c)
        ends.append(n - 1)
    flags, xb, yb = [], b'', b''
    px = py = 0
    for x, y in pts:
        fl = 0x01
        dx, dy = x - px, y - py
        px, py = x, y
        if dx == 0:
            fl |= 0x10
        elif -255 <= dx <= 255:
            fl |= 0x02 | (0x10 if dx > 0 else 0)
            xb += struct.pack('>B', abs(dx))
        else:
            xb += struct.pack('>h', dx)
        if dy == 0:
            fl |= 0x20
        elif -255 <= dy <= 255:
            fl |= 0x04 | (0x20 if dy > 0 else 0)
            yb += struct.pack('>B', abs(dy))
        else:
            yb += struct.pack('>h', dy)
        flags.append(fl)
    fb = b''
    i = 0
    while i < len(flags):
        run = 1
        while i + run < len(flags) and flags[i + run] == flags[i] and run < 255:
            run += 1
        fb += struct.pack('>BB', flags[i] | 0x08, run - 1) if run > 1 else struct.pack('>B', flags[i])
        i += run
    data = struct.pack('>hhhhh', len(contours), xmin, ymin, xmax, ymax)
    data += struct.pack('>%dH' % len(ends), *ends) + struct.pack('>H', 0) + fb + xb + yb
    return pad4(data), (xmin, ymin, xmax, ymax), len(pts)


def cmap_table(mapping):
    segs = []
    for c in sorted(mapping):
        g = mapping[c]
        if segs and c == segs[-1][1] + 1 and g - c == segs[-1][2]:
            segs[-1][1] = c
        else:
            segs.append([c, c, g - c])
    segs.append([0xFFFF, 0xFFFF, 1])
    n = len(segs)
    sr = 2 * (2 ** int(math.log2(n)))
    sub = struct.pack('>HHHHHHH', 4, 0, 0, n * 2, sr, int(math.log2(n)), n * 2 - sr)
    sub += struct.pack('>%dH' % n, *[s[1] for s in segs]) + b'\0\0'
    sub += struct.pack('>%dH' % n, *[s[0] for s in segs])
    sub += struct.pack('>%dH' % n, *[s[2] % 65536 for s in segs])
    sub += struct.pack('>%dH' % n, *([0] * n))
    sub = sub[:2] + struct.pack('>H', len(sub)) + sub[4:]
    return struct.pack('>HHHHIHHI', 0, 2, 0, 3, 20, 3, 1, 20) + sub


def name_table(names):
    recs, store = [], b''
    for nid in sorted(names):
        s = names[nid].encode('utf-16-be')
        recs.append(struct.pack('>HHHHHH', 3, 1, 0x409, nid, len(s), len(store)))
        store += s
    return struct.pack('>HHH', 0, len(recs), 6 + 12 * len(recs)) + b''.join(recs) + store


def build(out_path):
    order = list(skel.GLYPHS.keys())
    glyphs = [('.notdef', [[(50, 0), (50, 700), (450, 700), (450, 0)], [(100, 50), (400, 50), (400, 650), (100, 650)]], 500),
              ('space', [], SPACE)]
    for ch in order:
        contours, adv = glyph_outline(ch)
        glyphs.append((ch, contours, int(round(adv))))

    gid = {g[0]: i for i, g in enumerate(glyphs)}
    mapping = {0x20: gid['space'], 0xA0: gid['space']}
    for ch in order:
        mapping[ord(ch)] = gid[ch]
        if ch.isalpha():
            mapping[ord(ch.lower())] = gid[ch]

    glyf, loca, bboxes, max_pts, max_ctr = b'', [0], [], 0, 0
    for _, contours, _ in glyphs:
        data, bb, npts = encode_glyph(contours)
        glyf += data
        loca.append(len(glyf))
        bboxes.append(bb)
        max_pts = max(max_pts, npts)
        max_ctr = max(max_ctr, len(contours))

    inked = [bb for (_, c, _), bb in zip(glyphs, bboxes) if c]
    advs = [g[2] for g in glyphs]
    lsbs = [bb[0] if c else 0 for (_, c, _), bb in zip(glyphs, bboxes)]
    rsbs = [a - bb[2] for a, (_, c, _), bb in zip(advs, glyphs, bboxes) if c]
    xmin = min(b[0] for b in inked)
    ymin = min(b[1] for b in inked)
    xmax = max(b[2] for b in inked)
    ymax = max(b[3] for b in inked)

    head = struct.pack('>IIIIHHqqhhhhHHhhh', 0x00010000, 0x00010000, 0, 0x5F0F3CF5, 0x000B, 1000, TIMESTAMP, TIMESTAMP,
                       xmin, ymin, xmax, ymax, 0, 8, 2, 1, 0)
    hhea = struct.pack('>IhhhHhhhhhhhhhhhH', 0x00010000, ASCENT, DESCENT, 0, max(advs), min(b[0] for b in inked),
                       min(rsbs), xmax, 1, 0, 0, 0, 0, 0, 0, 0, len(glyphs))
    maxp = struct.pack('>IHHHHHHHHHHHHHH', 0x00010000, len(glyphs), max_pts, max_ctr, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0)
    nz = [a for a in advs if a > 0]
    os2 = struct.pack('>HhHHHhhhhhhhhhhh', 4, round(sum(nz) / len(nz)), 800, 5, 0,
                      650, 600, 0, 75, 650, 600, 0, 350, 60, 330, 0)
    os2 += bytes([2, 11, 8, 3, 3, 5, 0, 2, 0, 4])
    os2 += struct.pack('>IIII', 1, 0, 0, 0) + b'PXSP'
    os2 += struct.pack('>HHHhhhHHIIhhHHH', 0x00C0, 0x20, max(mapping), ASCENT, DESCENT, 0, 900, 200, 1, 0,
                       540, skel.CAP, 0, 0x20, 1)
    post = struct.pack('>IihhIIIII', 0x00030000, 0, -100, 50, 0, 0, 0, 0, 0)
    hmtx = b''.join(struct.pack('>Hh', a, l) for a, l in zip(advs, lsbs))
    name = name_table({1: 'Pixel Splash', 2: 'Regular', 3: 'Pixel Splash Regular 1.000', 4: 'Pixel Splash Regular',
                       5: 'Version 1.000', 6: 'PixelSplash-Regular'})
    tables = {'OS/2': os2, 'cmap': cmap_table(mapping), 'glyf': glyf, 'head': head, 'hhea': hhea, 'hmtx': hmtx,
              'loca': struct.pack('>%dI' % len(loca), *loca), 'maxp': maxp, 'name': name, 'post': post}

    tags = sorted(tables)
    n = len(tags)
    sr = 16 * (2 ** int(math.log2(n)))
    header = struct.pack('>IHHHH', 0x00010000, n, sr, int(math.log2(n)), n * 16 - sr)
    offset = 12 + 16 * n
    body, records = b'', b''
    for t in tags:
        data = tables[t]
        records += struct.pack('>4sIII', t.encode('latin-1'), checksum(data), offset + len(body), len(data))
        body += pad4(data)
    font = bytearray(header + records + body)
    head_off = offset + sum(len(pad4(tables[t])) for t in tags[:tags.index('head')])
    font[head_off + 8:head_off + 12] = struct.pack('>I', (0xB1B0AFBA - checksum(bytes(font))) & 0xFFFFFFFF)
    with open(out_path, 'wb') as fh:
        fh.write(bytes(font))
    print('font', out_path, len(font), 'bytes')
