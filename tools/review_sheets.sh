#!/usr/bin/env bash
# Sample a rendered film into labelled contact sheets for review passes.
#   tools/review_sheets.sh <film.mp4> <outdir> [fps] [per_sheet]
set -euo pipefail
IN="$1"; OUT="$2"; FPS="${3:-1}"; PER="${4:-24}"
mkdir -p "$OUT/frames"
rm -f "$OUT"/frames/*.jpg "$OUT"/sheet_*.jpg
ffmpeg -loglevel error -i "$IN" -vf "fps=$FPS,scale=640:-1" -q:v 3 "$OUT/frames/f_%05d.jpg"
python3 - "$OUT" "$FPS" "$PER" <<'EOF'
import glob, os, sys
from PIL import Image, ImageDraw, ImageFont
out, fps, per = sys.argv[1], float(sys.argv[2]), int(sys.argv[3])
files = sorted(glob.glob(os.path.join(out, "frames", "*.jpg")))
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 13)
cols = 4
for s in range(0, len(files), per):
    chunk = files[s:s + per]
    rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 646 + 6, rows * 382 + 6), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    for k, f in enumerate(chunk):
        im = Image.open(f)
        x, y = 6 + (k % cols) * 646, 6 + (k // cols) * 382
        sheet.paste(im, (x, y + 18))
        t = (s + k) / fps
        d.text((x, y + 1), f"{t:6.1f}s", fill=(235, 235, 235), font=font)
    sheet.save(os.path.join(out, f"sheet_{s // per:02d}.jpg"), quality=86)
print(len(files), "frames")
EOF
