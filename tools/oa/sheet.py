"""Contact sheet of stills: python3 tools/oa/sheet.py <dir> <out.jpg> [cols]"""
import glob, sys
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
fs = sorted(glob.glob(d + '/t*.jpg'))
ims = [Image.open(f) for f in fs]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (w * cols, h * rows), (20, 20, 20))
dr = ImageDraw.Draw(S)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * w, (i // cols) * h
    S.paste(im, (x, y))
    dr.text((x + 8, y + 6), f.split('/')[-1][1:-4], fill=(255, 255, 0))
S.save(out, quality=88)
print(out, S.size)
