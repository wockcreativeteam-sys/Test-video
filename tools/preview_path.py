"""Preview SVG-like stroke paths (absolute M / C / L) for the hand-authored line art.

usage: python3 -I tools/preview_path.py <paths.json> <out.png>
paths.json: {"w":1000,"h":600,"strokes":["M 0 0 C ...", ...]}
"""
import json
import sys

from PIL import Image, ImageDraw, ImageFont


def parse(d):
    toks = d.replace(",", " ").split()
    i, pts, cur, out = 0, [], (0, 0), []
    cmd = None
    while i < len(toks):
        t = toks[i]
        if t in ("M", "C", "L"):
            cmd = t
            i += 1
            continue
        if cmd == "M":
            cur = (float(toks[i]), float(toks[i + 1]))
            if pts:
                out.append(pts)
            pts = [cur]
            i += 2
        elif cmd == "L":
            p = (float(toks[i]), float(toks[i + 1]))
            pts.append(p)
            cur = p
            i += 2
        elif cmd == "C":
            c1 = (float(toks[i]), float(toks[i + 1]))
            c2 = (float(toks[i + 2]), float(toks[i + 3]))
            p = (float(toks[i + 4]), float(toks[i + 5]))
            for k in range(1, 25):
                s = k / 24
                a = (1 - s) ** 3
                b = 3 * (1 - s) ** 2 * s
                c = 3 * (1 - s) * s * s
                e = s ** 3
                pts.append((a * cur[0] + b * c1[0] + c * c2[0] + e * p[0], a * cur[1] + b * c1[1] + c * c2[1] + e * p[1]))
            cur = p
            i += 6
        else:
            i += 1
    if pts:
        out.append(pts)
    return out


def main():
    spec = json.load(open(sys.argv[1]))
    S = 2
    W, H = spec["w"], spec["h"]
    im = Image.new("RGB", (W * S, H * S), (248, 250, 253))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
    for n, stroke in enumerate(spec["strokes"]):
        for poly in parse(stroke):
            d.line([(x * S, y * S) for x, y in poly], fill=(14, 34, 72), width=int(2.2 * S), joint="curve")
            if len(sys.argv) > 3:
                x, y = poly[0]
                d.text((x * S + 4, y * S - 24), str(n), fill=(220, 40, 50), font=f)
    im.resize((W, H), Image.LANCZOS).save(sys.argv[2])


if __name__ == "__main__":
    main()
