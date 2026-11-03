"""Draw the Melon Office app icon and write mac/AppIcon.icns.

A little robot employee in 小瓜's red headset, wearing the company badge. Flat colors, no gradients.

    python3 mac/make_icon.py        (needs Pillow and macOS iconutil)
"""
import os, subprocess, tempfile
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
S = 2048
INK = (22, 21, 28, 255)
def hx(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
TILE, DISC = hx('#141418'), hx('#1f1f26')
METAL, METAL2, LEG, JOINT = hx('#eceef4'), hx('#c8ccd8'), hx('#6b7080'), hx('#a3a9bb')
GREEN, GREEN2, SCREEN, EYE = hx('#7cc46f'), hx('#4e9a48'), hx('#1c1b26'), hx('#9be29f')
BLUE, CHEEK, RED = hx('#3d7bd9'), hx('#f29a8a'), hx('#e04f4f')
LW = 22

def rr(d, box, r, fill, outline=INK, w=LW):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=w)

def limb(d, pts, w=64):
    d.line(pts, fill=INK, width=w + 2 * 16, joint='curve')
    d.line(pts, fill=LEG, width=w, joint='curve')
    for x, y in pts[1:-1]:
        d.ellipse([x - 46, y - 46, x + 46, y + 46], fill=JOINT, outline=INK, width=16)

def shoe(d, x, y):
    rr(d, [x - 130, y - 95, x + 150, y + 10], 50, GREEN)
    rr(d, [x - 130, y - 20, x + 150, y + 30], 25, GREEN2, w=18)
    d.ellipse([x - 70, y - 75, x - 30, y - 35], fill=hx('#ffffff'))

def head_layer(style):
    L = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(L)
    # antenna
    d.line([(1000, 430), (1000, 315)], fill=JOINT, width=26)
    d.ellipse([948, 250, 1052, 354], fill=GREEN, outline=INK, width=16)
    if style == 'headset':  # 小瓜's red headset, as a nod to the game cast
        d.arc([600, 330, 1400, 980], 190, 350, fill=INK, width=96)
        d.arc([600, 330, 1400, 980], 190, 350, fill=RED, width=60)
    # head: a rounded box with a darker side
    rr(d, [640, 420, 1360, 890], 150, METAL)
    d.rounded_rectangle([1240, 450, 1335, 860], radius=60, fill=METAL2)
    d.rounded_rectangle([680, 445, 1180, 520], radius=36, fill=hx('#ffffff'))
    rr(d, [640, 420, 1360, 890], 150, None)
    # ears
    for x0 in (585, 1350):
        rr(d, [x0, 560, x0 + 70, 760], 30, GREEN if style != 'headset' else RED, w=18)
    # screen face
    rr(d, [720, 540, 1260, 810], 100, SCREEN, w=18)
    for cx in (870, 1110):
        d.rounded_rectangle([cx - 46, 600, cx + 46, 720], radius=46, fill=EYE)
        d.rounded_rectangle([cx - 4, 618, cx + 24, 650], radius=12, fill=SCREEN)
    d.arc([950, 700, 1030, 770], 20, 160, fill=EYE, width=20)
    for cx in (775, 1205):
        d.ellipse([cx - 34, 735, cx + 34, 775], fill=CHEEK)
    return L.rotate(6, center=(1000, 900), resample=Image.BICUBIC)  # a little head tilt

def bot(style):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([200, 200, S - 200, S - 200], radius=370, fill=255)
    im.paste(Image.new('RGBA', (S, S), TILE), (0, 0), mask)
    L = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(L)
    d.ellipse([330, 380, 1718, 1768], fill=DISC)
    d.ellipse([620, 1660, 1440, 1740], fill=hx('#101014'))  # floor shadow, flat
    # mid-stride legs
    limb(d, [(900, 1330), (820, 1480), (820, 1600)])
    shoe(d, 810, 1690)
    limb(d, [(1080, 1330), (1160, 1470), (1190, 1590)])
    shoe(d, 1200, 1680)
    # arms
    limb(d, [(760, 1080), (660, 1200), (690, 1310)], w=52)
    d.ellipse([640, 1290, 740, 1390], fill=METAL2, outline=INK, width=16)
    limb(d, [(1240, 1080), (1330, 1190), (1300, 1300)], w=52)
    d.ellipse([1250, 1280, 1350, 1380], fill=METAL2, outline=INK, width=16)
    # body
    rr(d, [740, 1000, 1260, 1380], 130, METAL)
    d.rounded_rectangle([1150, 1030, 1235, 1350], radius=50, fill=METAL2)
    rr(d, [740, 1000, 1260, 1380], 130, None)
    # neck
    rr(d, [930, 880, 1070, 960], 28, LEG, w=16)
    rr(d, [915, 945, 1085, 1020], 28, JOINT, w=16)
    # lanyard + badge
    d.line([(900, 1010), (965, 1150)], fill=BLUE, width=32)
    d.line([(1100, 1010), (1035, 1150)], fill=BLUE, width=32)
    rr(d, [875, 1130, 1125, 1365], 36, hx('#ffffff'), outline=BLUE, w=18)
    d.rounded_rectangle([970, 1110, 1030, 1155], radius=12, fill=JOINT)
    d.rounded_rectangle([925, 1170, 1075, 1270], radius=18, fill=GREEN)
    d.rounded_rectangle([915, 1300, 1085, 1325], radius=12, fill=hx('#c9ccd8'))
    L = Image.alpha_composite(L, head_layer(style))
    k = 0.9
    small = L.resize((int(S * k), int(S * k)), Image.LANCZOS)
    L = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    L.alpha_composite(small, (int(S * (1 - k) / 2), int(S * (1 - k) / 2) + 70))
    clip = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    clip.paste(L, (0, 0), mask)
    return Image.alpha_composite(im, clip)



with tempfile.TemporaryDirectory() as tmp:
    iconset = os.path.join(tmp, 'AppIcon.iconset')
    os.makedirs(iconset)
    big = bot('headset')
    for px in (16, 32, 128, 256, 512):
        big.resize((px, px), Image.LANCZOS).save(os.path.join(iconset, f'icon_{px}x{px}.png'))
        big.resize((px * 2, px * 2), Image.LANCZOS).save(os.path.join(iconset, f'icon_{px}x{px}@2x.png'))
    subprocess.run(['iconutil', '-c', 'icns', iconset, '-o', os.path.join(HERE, 'AppIcon.icns')], check=True)
    print('wrote', os.path.join(HERE, 'AppIcon.icns'))
