import os, sys, random, json
from PIL import Image, ImageDraw

"""Render Melon Office isometric art: layered background, row overlays, character sheets, layout.

    python3 tools/render_assets.py [out_dir]

Everything is drawn procedurally so the look can be tweaked here (colors, furniture, characters).
"""
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'public', 'assets')
OUTSCALE = 2          # textures are exported at 2x for retina screens
SS = 3
W, H = 864, 624
S = 34
OX, OY = 364, 132
INK = '#2a2440'


def hx(s, a=255):
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)


def P(x, y, z=0.0):
    return ((OX + (x - y) * S) * SS, (OY + (x + y) * S / 2 - z * S) * SS)


class R:
    def __init__(self, w=W, h=H):
        self.im = Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def poly(self, pts, c, a=None, outline=None):
        if a is None:
            self.d.polygon(pts, fill=hx(c), outline=hx(outline) if outline else None)
        else:
            ov = Image.new('RGBA', self.im.size, (0, 0, 0, 0))
            ImageDraw.Draw(ov).polygon(pts, fill=hx(c, int(a * 255)))
            self.im = Image.alpha_composite(self.im, ov)
            self.d = ImageDraw.Draw(self.im)

    def ell(self, cx, cy, rx, ry, c, a=None, outline=None, w=0):
        bb = [(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS]
        if a is None:
            self.d.ellipse(bb, fill=hx(c) if c else None, outline=hx(outline) if outline else None, width=int(w * SS))
        else:
            ov = Image.new('RGBA', self.im.size, (0, 0, 0, 0))
            ImageDraw.Draw(ov).ellipse(bb, fill=hx(c, int(a * 255)))
            self.im = Image.alpha_composite(self.im, ov)
            self.d = ImageDraw.Draw(self.im)

    def rr(self, x0, y0, x1, y1, r, c, outline=INK, w=2):
        self.d.rounded_rectangle([x0 * SS, y0 * SS, x1 * SS, y1 * SS], radius=r * SS, fill=hx(c),
                                 outline=hx(outline) if outline else None, width=int(w * SS))

    def line(self, pts, c, w=1):
        self.d.line([(px * SS, py * SS) for px, py in pts], fill=hx(c), width=int(w * SS))

    def arc(self, cx, cy, rx, ry, a0, a1, c, w):
        self.d.arc([(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS], a0, a1, fill=hx(c), width=int(w * SS))

    def pie(self, cx, cy, rx, ry, a0, a1, c, outline=None, w=0):
        self.d.pieslice([(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS], a0, a1, fill=hx(c),
                        outline=hx(outline) if outline else None, width=int(w * SS))


def shade(c, f):
    r, g, b, _ = hx(c)
    return '#%02x%02x%02x' % (max(0, min(255, int(r * f))), max(0, min(255, int(g * f))), max(0, min(255, int(b * f))))


def box(r, x, y, z, w, d, h, c, a=None, top=None, edge=True):
    t = top or shade(c, 1.12)
    left = c
    right = shade(c, 0.82)
    faces = [
        ([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], t),
        ([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], left),
        ([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], right),
    ]
    for pts, col in faces:
        r.poly(pts, col, a)
    if edge and a is None:
        e = shade(c, 0.7)
        r.d.line([P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y, z + h)], fill=hx(shade(c, 1.25)), width=SS)
        r.d.line([P(x + w, y + d, z), P(x + w, y + d, z + h)], fill=hx(e), width=SS)


def quad_floor(r, x0, x1, y0, y1, c, z=0.0, a=None):
    r.poly([P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)], c, a)


def quad_wa(r, x0, x1, z0, z1, c, y=0.02):   # on wall A (y=0 plane)
    r.poly([P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)], c)


def quad_wb(r, y0, y1, z0, z1, c, x=0.02):   # on wall B (x=0 plane)
    r.poly([P(x, y0, z0), P(x, y1, z0), P(x, y1, z1), P(x, y0, z1)], c)


def scr(x, y, z=0.0):
    a, b = P(x, y, z)
    return a / SS, b / SS


# ---------------- characters ----------------
CH = {
    'gua':  dict(shirt='#7cc46f', hair='#3a2a1e', pants='#3b3f5c'),
    'tian': dict(shirt='#7ec8f2', hair='#e8964a', pants='#3b3f5c'),
    'zi':   dict(shirt='#c78be8', hair='#2a2238', pants='#3b3f5c'),
    'agua': dict(shirt='#f2a65a', hair='#5a3a22', pants='#3b3f5c', skin='#e9b58c'),
    'pi':   dict(shirt='#e8e4ee', hair='#8c5a3c', pants='#3b3f5c'),
    'boss': dict(shirt='#f4f1ea', hair='#2b2533', pants='#2e2a44'),
    # walk-ins: 外包 and 实习生 who only come in for one job
    'g1':   dict(shirt='#4fb3a9', hair='#23202e', pants='#3b3f5c'),
    'g2':   dict(shirt='#f28fb1', hair='#4a2f2a', pants='#3b3f5c'),
    'g3':   dict(shirt='#ffd27a', hair='#6b4a2f', pants='#3b3f5c'),
    'g4':   dict(shirt='#8fa3d9', hair='#c06a3a', pants='#3b3f5c'),
}
ANCH = {}


def chibi(r, who, ax, ay, seated, frame, blink=False, key=None, raise_=None, mug=None, walk=0, act=None):
    p = CH[who]
    skin = p.get('skin', '#f6cfab')
    if raise_ is None:
        raise_ = who == 'zi'
    if mug is None:
        mug = who == 'pi'
    if not seated:
        r.ell(ax, ay, 15, 4, '#000000', 0.22)
        la = -3 if walk == 1 else 0
        lb = -3 if walk == 2 else 0
        leg = 8 if act == 'pet' else 15   # squatting down to the cat
        r.rr(ax - 9, ay - leg + la, ax - 1, ay + la, 3, p['pants'])
        r.rr(ax + 1, ay - leg + lb, ax + 9, ay + lb, 3, p['pants'])
        r.ell(ax - 5, ay - 1 + la, 6, 3, '#23232e'); r.ell(ax + 5, ay - 1 + lb, 6, 3, '#23232e')
        by1 = ay - leg + 2
    else:
        by1 = ay
    by0 = by1 - 24
    hy = by0 - 14
    if who == 'tian':
        r.rr(ax - 18, hy - 12, ax + 18, by0 + 12, 12, p['hair'])
    if who == 'pi':
        r.ell(ax, by0 + 1, 16, 7, '#c9c4d6', outline=INK, w=2)
    # body
    r.rr(ax - 14, by0, ax + 14, by1 + 4, 9, p['shirt'])
    r.d.rounded_rectangle([(ax + 5) * SS, (by0 + 4) * SS, (ax + 12) * SS, (by1 + 2) * SS], radius=5 * SS, fill=hx(shade(p['shirt'], 0.88)))
    if who == 'boss':
        r.d.polygon([((ax - 12) * SS, (by0 + 3) * SS), ((ax - 4) * SS, (by0 + 3) * SS), ((ax - 4) * SS, (by1 + 2) * SS), ((ax - 12) * SS, (by1 + 2) * SS)], fill=hx('#2e2a44'))
        r.d.polygon([((ax + 4) * SS, (by0 + 3) * SS), ((ax + 12) * SS, (by0 + 3) * SS), ((ax + 12) * SS, (by1 + 2) * SS), ((ax + 4) * SS, (by1 + 2) * SS)], fill=hx('#2e2a44'))
        r.d.polygon([((ax - 2) * SS, (by0 + 2) * SS), ((ax + 2) * SS, (by0 + 2) * SS), ((ax + 3) * SS, (by0 + 16) * SS), ((ax) * SS, (by0 + 19) * SS), ((ax - 3) * SS, (by0 + 16) * SS)], fill=hx('#e04f4f'))
        r.ell(ax - 8, by0 + 8, 3.4, 3.4, '#7cc46f', outline=INK, w=1)   # 甜瓜徽章
        r.line([(ax - 8, by0 + 5), (ax - 8, by0 + 11)], '#3f7f3a', 1)
    elif who == 'gua':
        for gx in (-8, -2, 4, 10):
            r.d.line([((ax + gx) * SS, (by0 + 3) * SS), ((ax + gx) * SS, (by1 + 2) * SS)], fill=hx('#4e9a48'), width=SS)
        for gy in (6, 13, 20):
            if by0 + gy < by1:
                r.d.line([((ax - 12) * SS, (by0 + gy) * SS), ((ax + 12) * SS, (by0 + gy) * SS)], fill=hx('#4e9a48'), width=SS)
    if who != 'boss':  # 工牌
        r.line([(ax - 5, by0 + 1), (ax - 3, by0 + 10)], '#3d7bd9', 1.5)
        r.line([(ax + 5, by0 + 1), (ax + 3, by0 + 10)], '#3d7bd9', 1.5)
        r.rr(ax - 4, by0 + 9, ax + 4, by0 + 18, 1.5, '#ffffff', outline='#3d7bd9', w=1.2)
        r.d.rectangle([(ax - 2) * SS, (by0 + 11) * SS, (ax + 2) * SS, (by0 + 13) * SS], fill=hx('#7cc46f'))
    # head
    hr = 16
    if who == 'zi':
        r.ell(ax, hy - 17, 7, 6, p['hair'], outline=INK, w=2)
    r.ell(ax, hy, hr, hr - 1, skin, outline=INK, w=2)
    # hair cap
    if who == 'agua':
        r.pie(ax, hy - 1, hr + 1, hr, 180, 360, '#ffd27a', outline=INK, w=2)
        r.ell(ax + 3, hy - 1, hr + 3, 3.5, '#e8b93e', outline=INK, w=1.5)
        r.ell(ax - 4, hy - 9, 4, 2.5, '#fff0b8')
    elif who == 'boss':  # 背头 + 两鬓微白；甜瓜元素只放在西装徽章上
        r.pie(ax, hy - 1, hr + 1, hr + 1, 180, 360, p['hair'], outline=INK, w=2)
        r.ell(ax + 5, hy - 4, 10, 5, p['hair'])
        r.ell(ax - 9, hy - 3, 5, 3, p['hair'])
        r.ell(ax - hr + 1, hy + 1, 2.2, 4, '#c9c4d6')
        r.ell(ax + hr - 1, hy + 1, 2.2, 4, '#c9c4d6')
    else:
        r.pie(ax, hy - 1, hr + 1, hr + 1, 180, 360, p['hair'], outline=INK, w=2)
        r.ell(ax - 7, hy - 2, 7, 4, p['hair'])
        r.ell(ax + 8, hy - 3, 6, 3, p['hair'])
        r.ell(ax - 5, hy - 10, 4, 2, shade(p['hair'], 1.35))
    # face
    if blink:
        r.line([(ax - 8, hy + 4), (ax - 4, hy + 4)], INK, 1.8)
        r.line([(ax + 4, hy + 4), (ax + 8, hy + 4)], INK, 1.8)
    elif act == 'phone':  # eyes on the screen
        r.arc(ax - 6, hy + 4, 3, 2.4, 20, 160, INK, 1.8)
        r.arc(ax + 6, hy + 4, 3, 2.4, 20, 160, INK, 1.8)
    else:
        r.ell(ax - 6, hy + 4, 2.2, 2.8, INK); r.ell(ax + 6, hy + 4, 2.2, 2.8, INK)
        r.ell(ax - 5.4, hy + 3, 0.8, 0.8, '#ffffff'); r.ell(ax + 6.6, hy + 3, 0.8, 0.8, '#ffffff')
    r.ell(ax - 10, hy + 8, 3, 1.8, '#f29a8a'); r.ell(ax + 10, hy + 8, 3, 1.8, '#f29a8a')
    if act == 'talk' and frame:
        r.ell(ax, hy + 9.5, 3, 2.4, '#b5574a', outline=INK, w=1)
    else:
        r.arc(ax, hy + 8, 3, 2, 20, 160, '#b5574a', 1.5)
    if who == 'tian':
        r.ell(ax - 6, hy + 4, 5, 4.5, None, outline=INK, w=1.5)
        r.ell(ax + 6, hy + 4, 5, 4.5, None, outline=INK, w=1.5)
        r.line([(ax - 1, hy + 4), (ax + 1, hy + 4)], INK, 1.5)
    if who == 'gua':
        r.arc(ax, hy - 2, hr + 3, hr + 2, 195, 345, '#e04f4f', 3)
        r.rr(ax - hr - 5, hy - 2, ax - hr + 2, hy + 9, 3, '#e04f4f')
        r.rr(ax + hr - 2, hy - 2, ax + hr + 5, hy + 9, 3, '#e04f4f')
    if raise_:  # raised hand
        hxp = ax + 22 + (2 if frame else 0)
        r.rr(hxp - 4, by0 - 18, hxp + 4, by0 + 8, 4, p['shirt'])
        r.ell(hxp, by0 - 20, 5, 5, skin, outline=INK, w=1.5)
    if mug:
        r.rr(ax + 12, by0 + 8, ax + 22, by0 + 20, 3, '#ffffff')
        r.arc(ax + 23, by0 + 14, 3.5, 3.5, 270, 90, INK, 1.5)
        sy = by0 + (2 if frame else 4)
        r.arc(ax + 15, sy, 2, 3, 200, 340, '#c9c4d6', 1.3)
        r.arc(ax + 19, sy - 3, 2, 3, 20, 160, '#c9c4d6', 1.3)
    if act == 'phone':  # both hands on a phone, the screen flickers between feeds
        r.rr(ax - 8, by0 + 5, ax + 8, by0 + 19, 3, '#2a2440', outline=INK, w=1.5)
        r.rr(ax - 6, by0 + 7, ax + 6, by0 + 17, 2, '#ff8fb1' if frame else '#7ec8f2', outline=None)
        r.ell(ax - 9, by0 + 15, 3.5, 3.5, skin, outline=INK, w=1.2)
        r.ell(ax + 9, by0 + 15 - (1.5 if frame else 0), 3.5, 3.5, skin, outline=INK, w=1.2)
    if act == 'talk':  # one hand waving while gossiping
        hy2 = by0 + (2 if frame else 6)
        r.rr(ax - 26, hy2, ax - 12, hy2 + 7, 3.5, p['shirt'])
        r.ell(ax - 27, hy2 + 3, 4.5, 4.5, skin, outline=INK, w=1.5)
    if act == 'pet':  # reaching down to the cat
        px = ax + 24 + (2 if frame else 0)
        r.rr(ax + 10, by1 - 8, px, by1 - 1, 3.5, p['shirt'])
        r.ell(px + 1, by1 - 4 + (1 if frame else 0), 4.5, 4, skin, outline=INK, w=1.5)
    r.ell(ax - 6, hy - 9, 3, 1.5, '#ffffff', a=0.35)
    if key:
        ANCH[key] = dict(x=round(ax), top=round(hy - hr - (20 if who in ('zi', 'boss') else 4)))


def chair(r, cx, cy):
    box(r, cx - 0.36, cy - 0.5, 0.35, 0.72, 0.18, 0.95, '#34364a')
    box(r, cx - 0.36, cy - 0.32, 0.36, 0.72, 0.62, 0.14, '#3f4258')


def monitor(r, x, y, glow, frame, on=True):
    box(r, x, y, 0.72, 0.56, 0.1, 0.5, '#3a3b4f')
    box(r, x + 0.24, y + 0.02, 0.72 - 0.0, 0.08, 0.08, 0.02, '#2c2d3e', edge=False)
    if on:
        pts = [P(x, y - 0.01, 0.74), P(x + 0.56, y - 0.01, 0.74), P(x + 0.56, y - 0.01, 1.2), P(x, y - 0.01, 1.2)]
        r.poly(pts, glow, 0.35)
    cx, cy = scr(x + 0.28, y + 0.05, 1.0)
    r.ell(cx - 1, cy, 2.5, 2.5, '#7cc46f' if on else '#55566a')


ROWS = {
    'row1': dict(desk_y=2.2, char_y=1.6),
    'row2': dict(desk_y=5.4, char_y=4.8),
}
SEAT_X = (1.3, 3.9, 6.5)


def seat_row(r, items, row, frame, layer):
    """Chairs live in the background; the desk + monitors are a separate overlay so that
    seated characters (drawn by the client) sit between the chair and the desk."""
    desk_y, char_y = ROWS[row]['desk_y'], ROWS[row]['char_y']
    if layer == 'bg':
        for c in SEAT_X:
            items.append((c + char_y - 0.6, lambda c=c: chair(r, c, char_y + 0.05)))
        return
    if layer != row:
        return
    dy = desk_y

    def desk_and_stuff():
        box(r, 0.8, dy, 0, 7.6, 1.0, 0.72, '#dcdae6', top='#f7f6fb')
        for c in SEAT_X:
            dm = 0.75
            monitor(r, c + dm - 0.85 - 0.28, dy + 0.1, '#55566a', frame, False)
            monitor(r, c + dm + 0.85 - 0.28, dy + 0.1, '#55566a', frame, False)
            box(r, c + 0.55, dy + 0.45, 0.72, 0.5, 0.22, 0.03, '#3a3b4f', edge=False)
        if row == 'row2':
            box(r, 7.4, 5.7, 0.72, 0.35, 0.35, 0.28, '#7cc46f')     # 公司周边：甜瓜抱枕
    items.append((4.6 + dy + 0.5 + 3, desk_and_stuff))


def plant(r, x, y):
    box(r, x - 0.22, y - 0.22, 0, 0.44, 0.44, 0.42, '#d0714a')
    cx, cy = scr(x, y, 0.75)
    for dx, dy, rr_, c in ((-7, 2, 10, '#4e9a48'), (7, 0, 10, '#5fae5a'), (0, -9, 11, '#7cc46f'), (-2, 6, 8, '#6bb862')):
        r.ell(cx + dx, cy + dy, rr_, rr_ * 0.9, c, outline=INK, w=1.5)


def scene(frame, layer='bg'):
    r = R()
    items = []
    if layer != 'bg':
        seat_row(r, items, layer, frame, layer)
        for _, fn in sorted(items, key=lambda t: t[0]):
            fn()
        return r.im
    return background(r, items, frame)


def background(r, items, frame):
    # base slab
    box(r, 0, 0, -0.7, 14, 10, 0.7, '#3b3f5c', top='#3b3f5c', edge=False)
    r.d.line([P(0, 10, -0.7), P(14, 10, -0.7), P(14, 0, -0.7)], fill=hx('#232539'), width=2 * SS)
    # walls
    box(r, -0.28, -0.28, 0, 0.28, 10.28, 3.2, '#d2d0de', top='#bdbacb', edge=False)
    box(r, 0, -0.28, 0, 14, 0.28, 3.2, '#ecebf3', top='#bdbacb', edge=False)
    # floors
    quad_floor(r, 0, 9, 0, 10, '#7f88a7')
    for i in range(1, 9):
        r.d.line([P(i, 0), P(i, 10)], fill=hx('#76809e'), width=SS)
    for j in range(1, 10):
        r.d.line([P(0, j), P(9, j)], fill=hx('#76809e'), width=SS)
    quad_floor(r, 9, 14, 0, 4, '#5e6c8c')
    for i in range(10):
        for j in range(12):
            quad_floor(r, 9 + i * 0.5, 9.5 + i * 0.5, 4 + j * 0.5, 4.5 + j * 0.5, '#efe9dd' if (i + j) % 2 == 0 else '#ded6c6')
    # wall stripes & decor
    quad_wa(r, 0, 14, 0, 0.22, '#7cc46f')
    quad_wb(r, 0, 10, 0, 0.22, '#6bb862')
    quad_wa(r, 1.2, 8.2, 2.3, 2.95, '#9e2f35')
    quad_wa(r, 1.25, 8.15, 2.34, 2.91, '#d64545')
    quad_wa(r, 1.25, 8.15, 2.34, 2.38, '#ffd27a'); quad_wa(r, 1.25, 8.15, 2.87, 2.91, '#ffd27a')
    quad_wa(r, 1.4, 3.9, 1.0, 2.05, '#23243a')
    vals = [0.2, 0.3, 0.28, 0.45, 0.4, 0.55, 0.62, 0.75 if frame else 0.7]
    for i, v in enumerate(vals):
        x0 = 1.6 + i * 0.28
        quad_wa(r, x0, x0 + 0.18, 1.15, 1.15 + v, '#6fe39a' if i < 7 else '#ffd27a', y=0.03)
    quad_wa(r, 4.25, 5.45, 1.3, 1.9, '#23243a')
    quad_wa(r, 5.8, 8.2, 1.05, 2.05, '#2f3045')
    quad_wa(r, 6.0, 6.7, 1.2, 1.9, '#7cc46f', y=0.03)
    quad_wa(r, 6.22, 6.28, 1.2, 1.9, '#3f7f3a', y=0.04); quad_wa(r, 6.42, 6.48, 1.2, 1.9, '#3f7f3a', y=0.04)
    quad_wa(r, 9.8, 13.4, 0.9, 2.65, '#f7f6fb')
    quad_wa(r, 9.8, 13.4, 2.45, 2.65, '#7cc46f', y=0.03)
    for i, v in enumerate((0.4, 0.6, 0.55, 0.9, 1.25)):
        x0 = 10.1 + i * 0.62
        quad_wa(r, x0, x0 + 0.4, 1.05, 1.05 + v, '#7ec8f2' if i < 4 else '#e04f4f', y=0.03)
    lz = 2.0 if frame else 1.9
    lx, ly = scr(12.9 if frame else 12.7, 0.04, lz)
    r.ell(lx, ly, 2.5, 2.5, '#ff3b3b')
    r.ell(lx, ly, 6, 6, '#ff3b3b', 0.25)
    for (y0, y1) in ((1.2, 3.4), (4.2, 6.4)):
        quad_wb(r, y0 - 0.08, y1 + 0.08, 0.92, 2.78, '#4a4d66')
        quad_wb(r, y0, y1, 1.0, 2.7, '#1f2d5c', x=0.03)
        rnd = random.Random(int(y0 * 10))
        yy = y0
        while yy < y1 - 0.05:
            bw = rnd.uniform(0.25, 0.45); bh = rnd.uniform(0.35, 1.05)
            y2 = min(y1, yy + bw)
            quad_wb(r, yy, y2, 1.0, 1.0 + bh, '#151c3a', x=0.04)
            for k in range(int(bh / 0.18)):
                if (k + int(yy * 10) + frame) % 3:
                    zz = 1.08 + k * 0.18
                    quad_wb(r, yy + 0.06, yy + 0.12, zz, zz + 0.07, '#ffd27a', x=0.05)
            yy = y2 + 0.04
        quad_wb(r, (y0 + y1) / 2 - 0.03, (y0 + y1) / 2 + 0.03, 1.0, 2.7, '#4a4d66', x=0.05)
    mx, my = scr(0.05, 5.6, 2.45)
    r.ell(mx, my, 7, 7, '#fff1b8')

    # ---------- objects ----------
    seat_row(r, items, 'row1', frame, 'bg')
    seat_row(r, items, 'row2', frame, 'bg')

    def rack():
        box(r, 0.08, 6.9, 0, 0.8, 0.85, 2.0, '#2f3042')
        for i in range(7):
            z = 0.25 + i * 0.25
            for k in range(3):
                on = (i + k + frame) % 3 != 0
                cx, cy = scr(0.88, 7.05 + k * 0.12, z + 0.1)
                r.ell(cx, cy, 1.4, 1.4, ['#6fe39a', '#ffd27a', '#7ec8f2'][k] if on else '#1e1e28')
    items.append((7.8, rack))

    def cot():
        for lx_ in (2.7, 4.65):
            box(r, lx_, 8.45, 0, 0.08, 0.7, 0.3, '#23232e', edge=False)
        box(r, 2.6, 8.4, 0.3, 2.2, 0.8, 0.08, '#5f8fd0')
        box(r, 2.7, 8.5, 0.38, 0.55, 0.6, 0.12, '#ffffff')
        box(r, 4.1, 8.45, 0.38, 0.5, 0.7, 0.05, '#d64545', edge=False)
        cx, cy = scr(3.75, 8.8, 0.38)
        r.ell(cx + 2, cy - 6, 15, 8, '#a3a3b0', outline=INK, w=1.5)
        r.ell(cx - 10, cy - 9, 8, 7, '#a3a3b0', outline=INK, w=1.5)
        r.d.polygon([((cx - 16) * SS, (cy - 13) * SS), ((cx - 14) * SS, (cy - 19) * SS), ((cx - 11) * SS, (cy - 14) * SS)], fill=hx('#a3a3b0'), outline=hx(INK))
        r.d.polygon([((cx - 9) * SS, (cy - 15) * SS), ((cx - 6) * SS, (cy - 20) * SS), ((cx - 4) * SS, (cy - 14) * SS)], fill=hx('#a3a3b0'), outline=hx(INK))
        r.line([(cx - 13, cy - 9), (cx - 10, cy - 9)], INK, 1.2); r.line([(cx - 8, cy - 9), (cx - 5, cy - 9)], INK, 1.2)
        for sx in (0, 5, 10):
            r.line([(cx + sx, cy - 13), (cx + sx, cy - 4)], '#7b7b8a', 1.4)
        tx = 3 if frame else 0
        r.arc(cx + 18, cy - 2 - tx, 6, 5, 180, 360, '#7b7b8a', 3)
    items.append((12.0, cot))

    def shelf():
        box(r, 0.08, 8.5, 0, 0.62, 1.35, 1.45, '#9a9db2')
        cols = ['#ffd27a', '#5fa8e8', '#ffd27a', '#5fa8e8']
        for i, z in enumerate((0.1, 0.55, 1.0)):
            for k in range(2):
                c = cols[(i + k) % 4]
                box(r, 0.22, 8.6 + k * 0.6, z, 0.4, 0.45, 0.34, c)
    items.append((9.4, shelf))

    def ball():
        cx, cy = scr(6.0, 9.0, 0.38)
        r.ell(cx, cy + 12, 14, 4, '#000000', 0.2)
        r.ell(cx, cy, 13, 13, '#e04f4f', outline=INK, w=1.5)
        r.ell(cx - 4, cy - 5, 4, 3, '#ff9a90')
    items.append((15.0, ball))
    items.append((16.8, lambda: plant(r, 7.8, 9.0)))
    items.append((9.1, lambda: plant(r, 8.55, 0.55)))

    # meeting room
    def mtable():
        for cx_ in (10.7, 11.7, 12.7):
            box(r, cx_ - 0.25, 0.95, 0, 0.5, 0.4, 0.75, '#34364a')
        box(r, 10.2, 1.4, 0, 3.0, 1.2, 0.68, '#7a5a42', top='#9b7656')
        box(r, 12.5, 1.65, 0.68, 0.6, 0.45, 0.03, '#3a3b4f', edge=False)
        pts = [P(12.5, 1.66, 0.7), P(13.1, 1.66, 0.7), P(13.1, 1.66, 1.12), P(12.5, 1.66, 1.12)]
        r.poly(pts, '#2c2d3e')
        for i, c in enumerate(('#ffd27a', '#7ec8f2', '#c78be8', '#9be29f')):
            x0 = 12.55 + (i % 2) * 0.27
            z0 = 0.74 + (i // 2) * 0.18
            r.poly([P(x0, 1.65, z0), P(x0 + 0.23, 1.65, z0), P(x0 + 0.23, 1.65, z0 + 0.15), P(x0, 1.65, z0 + 0.15)], c)
        box(r, 10.6, 1.8, 0.68, 0.45, 0.6, 0.02, '#ffffff', edge=False)
        for cx_ in (10.7, 11.7):
            box(r, cx_ - 0.25, 2.75, 0, 0.5, 0.4, 0.5, '#34364a')
    items.append((13.5, mtable))
    items.append((14.2, lambda: plant(r, 13.6, 0.5)))

    def glass():
        box(r, 8.96, 0.0, 0, 0.08, 2.5, 2.3, '#bfe6f7', a=0.32)
        box(r, 8.96, 3.4, 0, 0.08, 0.6, 2.3, '#bfe6f7', a=0.32)
        box(r, 10.3, 3.96, 0, 3.7, 0.08, 2.3, '#bfe6f7', a=0.32)
        for gx, gy, gw, gd in ((8.96, 0, 0.08, 2.5), (8.96, 3.4, 0.08, 0.6), (10.3, 3.96, 3.7, 0.08)):
            r.d.line([P(gx + gw, gy + gd, 2.3), P(gx + gw, gy, 2.3)], fill=hx('#e6f6fc'), width=2 * SS)
            r.d.line([P(gx, gy + gd, 2.3), P(gx + gw, gy + gd, 2.3)], fill=hx('#e6f6fc'), width=2 * SS)
            r.d.line([P(gx + gw, gy + gd, 0), P(gx + gw, gy + gd, 2.3)], fill=hx('#9fc8da'), width=2 * SS)
    items.append((13.4, glass))

    # pantry
    def snacks():
        box(r, 9.15, 4.15, 0, 1.5, 0.5, 1.6, '#9b7656')
        rnd = random.Random(5)
        for i, z in enumerate((0.15, 0.65, 1.15)):
            x = 9.25
            while x < 10.5:
                c = rnd.choice(('#e04f4f', '#ffd27a', '#7ec8f2', '#9be29f', '#f2a65a', '#c78be8'))
                box(r, x, 4.5, z, 0.2, 0.12, rnd.uniform(0.25, 0.38), c, edge=False)
                x += 0.26
    items.append((14.0, snacks))

    def counter():
        box(r, 12.3, 5.0, 0, 1.4, 2.6, 0.9, '#dcdae6', top='#f7f6fb')
        box(r, 12.6, 5.25, 0.9, 0.6, 0.6, 0.65, '#2f3042')
        cx, cy = scr(13.2, 5.5, 1.35)
        r.ell(cx, cy, 2, 2, '#ff6b5e' if frame else '#6fe39a')
        box(r, 12.55, 6.6, 0.9, 0.75, 0.6, 0.42, '#c9ccd8')
        box(r, 13.0, 8.3, 0, 0.9, 0.95, 1.95, '#e6ecf3')
        box(r, 13.05, 8.6, 1.95, 0.0001, 0.3, 0.0001, '#ffe07a', edge=False)
    items.append((19.0, counter))

    def ptable():
        for sx, sy in ((9.8, 8.0), (11.3, 8.0)):
            box(r, sx, sy, 0, 0.35, 0.35, 0.42, '#7cc46f')
        box(r, 10.1, 7.6, 0, 1.1, 1.0, 0.7, '#dcdae6', top='#f7f6fb')
        box(r, 10.3, 7.8, 0.7, 0.5, 0.4, 0.2, '#ffd27a')
        box(r, 10.9, 8.2, 0.7, 0.14, 0.14, 0.16, '#ffffff')
    items.append((18.4, ptable))
    items.append((19.2, lambda: plant(r, 9.5, 9.5)))

    for _, fn in sorted(items, key=lambda t: t[0]):
        fn()
    return r.im


# ---------------- export ----------------
CELL_W, CELL_H = 90, 120          # 1x cell size of a character frame
ANCHOR = (45, 108)                # where the seat / feet point sits inside a cell
FRAMES = [
    # name,        seated, frame, blink, raise, mug,  walk, bob
    ('sit',        True,  0, False, False, False, 0, 0),
    ('sit_type',   True,  1, False, False, False, 0, -1.5),
    ('sit_raise',  True,  0, False, True,  False, 0, 0),
    ('sit_raise2', True,  1, False, True,  False, 0, 0),
    ('sit_blink',  True,  0, True,  False, False, 0, 0),
    ('stand',      False, 0, False, False, False, 0, 0),
    ('walk1',      False, 0, False, False, False, 1, -1),
    ('walk2',      False, 0, False, False, False, 2, -1),
    ('mug',        False, 0, False, False, True,  0, 0),
    ('mug2',       False, 1, True,  False, True,  0, 0),
    # 摸鱼: name, seated, frame, blink, raise, mug, walk, bob, act
    ('sit_phone',  True,  0, False, False, False, 0, 0, 'phone'),
    ('sit_phone2', True,  1, False, False, False, 0, 0, 'phone'),
    ('talk1',      False, 0, False, False, False, 0, 0, 'talk'),
    ('talk2',      False, 1, False, False, False, 0, -1, 'talk'),
    ('pet1',       False, 0, False, False, False, 0, 0, 'pet'),
    ('pet2',       False, 1, True,  False, False, 0, 0, 'pet'),
]


def export_size(im, w, h):
    return im.resize((w * OUTSCALE, h * OUTSCALE), Image.LANCZOS)


def character_sheet(who):
    sheet = Image.new('RGBA', (CELL_W * len(FRAMES) * OUTSCALE, CELL_H * OUTSCALE), (0, 0, 0, 0))
    for i, (name, seated, frame, blink, raise_, mug, walk, bob, *act) in enumerate(FRAMES):
        r = R(CELL_W, CELL_H)
        chibi(r, who, ANCHOR[0], ANCHOR[1] + bob, seated, frame, blink=blink, raise_=raise_, mug=mug, walk=walk, act=act[0] if act else None)
        sheet.paste(export_size(r.im, CELL_W, CELL_H), (i * CELL_W * OUTSCALE, 0))
    return sheet


def layout():
    k = OUTSCALE
    seats = []
    for row in ('row1', 'row2'):
        for i, c in enumerate(SEAT_X):
            cy = ROWS[row]['char_y']
            ax, ay = scr(c, cy, 0.5)
            seats.append(dict(id=f'{row}-{i}', row=row, x=c, y=cy, anchor=[round(ax * k), round(ay * k)]))
    return dict(
        size=[W * k, H * k],
        iso=dict(ox=OX * k, oy=OY * k, s=S * k),
        cell=dict(w=CELL_W * k, h=CELL_H * k, ax=ANCHOR[0] * k, ay=ANCHOR[1] * k),
        frames=[f[0] for f in FRAMES],
        seats=seats,
        # walkable spots in floor units (x, y); the client projects them
        spots=dict(
            entrance=[8.7, 10.6],
            aisleEast=[8.72, 3.8],
            pantryDoor=[8.72, 6.9],
            pantry=[[12.4, 8.0], [9.6, 8.9], [11.6, 9.4], [13.3, 9.7]],
            rack=[1.55, 7.85],
            cat=[2.25, 8.75],                                  # next to the 行政猫 on the cot
            # gossip pairs, side by side on screen: one in the pantry, one on the open floor by the ball
            chat=[[[9.6, 5.3], [11.2, 4.6]], [[5.2, 8.2], [6.6, 6.8]]],
            boss=[13.55, 3.25],
        ),
        wall=dict(  # 2x px anchors for wall text overlays
            banner=[round(v * k) for v in scr(1.25, 0, 2.91)],
            clock=[round(v * k) for v in scr(4.25, 0, 1.9)],
            projector=[round(v * k) for v in scr(9.95, 0, 2.42)],
        ),
    )


if __name__ == '__main__':
    os.makedirs(os.path.join(OUT, 'chars'), exist_ok=True)
    for f in (0, 1):
        export_size(scene(f, 'bg'), W, H).save(os.path.join(OUT, f'bg_{"ab"[f]}.png'), optimize=True)
    for row in ('row1', 'row2'):
        export_size(scene(0, row), W, H).save(os.path.join(OUT, f'{row}.png'), optimize=True)
    for who in CH:
        character_sheet(who).save(os.path.join(OUT, 'chars', f'{who}.png'), optimize=True)
    with open(os.path.join(OUT, 'layout.json'), 'w') as fh:
        json.dump(layout(), fh, ensure_ascii=False, indent=2)
    print('assets written to', os.path.abspath(OUT))
