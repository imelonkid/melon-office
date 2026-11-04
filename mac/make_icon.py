"""Generate the flat workstation + employee badge Dock icon.

    python3 mac/make_icon.py  # Pillow and macOS iconutil required

All shapes use solid fills; only edge antialiasing introduces blended pixels.
"""
from pathlib import Path
import subprocess
import tempfile
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SIZE = 2048
WHITE, INK, GREEN = '#ffffff', '#455969', '#4f9479'


def workstation():
    image = Image.new('RGBA', (SIZE, SIZE))
    draw = ImageDraw.Draw(image)
    # Standard macOS inset tile, with transparent corners outside it.
    draw.rounded_rectangle((200, 200, 1848, 1848), radius=370, fill=WHITE)
    # Monitor and pedestal, on a shared 2048px design grid.
    draw.rounded_rectangle((395, 480, 1605, 1285), radius=195, fill=INK)
    draw.rounded_rectangle((505, 590, 1495, 1175), radius=85, fill=WHITE)
    for x in (825, 1175):
        draw.ellipse((x - 74, 800, x + 74, 948), fill=GREEN)
    draw.rectangle((895, 1260, 1105, 1440), fill=INK)
    draw.rounded_rectangle((720, 1390, 1280, 1505), radius=57, fill=INK)
    draw.rounded_rectangle((560, 1570, 1440, 1675), radius=52, fill=GREEN)
    # White separation keeps the overlapping badge readable at Dock sizes.
    draw.rounded_rectangle((1300, 1080, 1660, 1525), radius=88, fill=WHITE)
    draw.rounded_rectangle((1320, 1100, 1640, 1505), radius=68, fill=INK)
    draw.rounded_rectangle((1350, 1130, 1610, 1475), radius=38, fill=WHITE)
    draw.rounded_rectangle((1440, 1070, 1520, 1155), radius=24, fill=GREEN)
    draw.ellipse((1440, 1185, 1520, 1265), fill=GREEN)
    draw.pieslice((1400, 1260, 1560, 1400), 180, 360, fill=GREEN)
    for y in (1360, 1415):
        draw.rounded_rectangle((1400, y, 1560, y + 25), radius=12, fill=INK)
    return image


def main():
    with tempfile.TemporaryDirectory() as tmp:
        iconset = Path(tmp) / 'AppIcon.iconset'
        iconset.mkdir()
        image = workstation()
        for px in (16, 32, 128, 256, 512):
            for scale, suffix in ((1, ''), (2, '@2x')):
                image.resize((px * scale, px * scale), Image.Resampling.LANCZOS).save(
                    iconset / f'icon_{px}x{px}{suffix}.png')
        subprocess.run(['iconutil', '-c', 'icns', str(iconset), '-o', str(HERE / 'AppIcon.icns')], check=True)
        print('wrote', HERE / 'AppIcon.icns')


if __name__ == '__main__':
    main()
