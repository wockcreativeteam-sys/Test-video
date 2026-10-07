"""Tile rendered stills into a labelled contact sheet for review.

usage: python3 -I tools/contact.py <dir> <out.jpg> [cols] [cell_width]
"""
import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFont


def main():
    d, out = sys.argv[1], sys.argv[2]
    cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    cw = int(sys.argv[4]) if len(sys.argv) > 4 else 640
    files = sorted(glob.glob(os.path.join(d, "*.jpg")))
    ch = cw * 9 // 16
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw + (cols + 1) * 6, rows * (ch + 22) + 6), (40, 40, 40))
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 14)
    dr = ImageDraw.Draw(sheet)
    for k, f in enumerate(files):
        im = Image.open(f).convert("RGB").resize((cw, ch), Image.LANCZOS)
        x = 6 + (k % cols) * (cw + 6)
        y = 6 + (k // cols) * (ch + 22)
        sheet.paste(im, (x, y + 18))
        dr.text((x, y), os.path.basename(f)[1:-4] + "s", fill=(230, 230, 230), font=font)
    sheet.save(out, quality=90)
    print(out, sheet.size)


if __name__ == "__main__":
    main()
