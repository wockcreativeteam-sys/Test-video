"""Cut the machines out of the supplied posters and build vector line drawings.

Runs entirely locally: a BiRefNet (or ISNet) ONNX matting model through
onnxruntime, then OpenCV / scikit-image for edge tracing.

usage: python3 -I tools/assets/prep_machines.py <model.onnx> <src_dir> <out_dir>
"""
import json
import sys

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter
from skimage.morphology import skeletonize

# name: (source file, crop box l,t,r,b, list of boxes to force transparent (crop coords))
MACHINES = {
    "giraffe": ("ge_giraffe_incubator.jpg", (512, 12, 912, 708), [(343, 0, 400, 215)]),
    "sle6000": ("sle_6000.jpg", (532, 18, 902, 672), [(322, 0, 370, 215)]),
    "olympus": ("olympus_otv_s700.jpg", (538, 44, 918, 600), [(330, 0, 380, 250), (250, 0, 380, 70)]),
    "lullaby": ("ge_lullaby_warmer.jpg", (542, 22, 922, 762), [(298, 0, 380, 205)]),
    "benq": ("benq_trimax_650ns.jpg", (384, 252, 1024, 548), []),
    "infusomat": ("bbraun_infusomat_compact_plus.jpg", (518, 0, 962, 528), [(292, 0, 444, 196)]),
    "ingenia": ("philips_smartpath_3t.jpg", (390, 346, 730, 726), []),
    "mako_a": ("hero_future_of_healthcare.jpg", (722, 402, 856, 645), []),
    "mako_b": ("hero_future_of_healthcare.jpg", (922, 418, 1066, 664), []),
    "davinci_arms": ("hero_future_of_healthcare.jpg", (148, 330, 452, 548), []),
    # ZEISS microscope is not cut out: the poster's label overlaps the optics.
    "crea_display": ("crea_ot_integration.jpg", (400, 196, 666, 350), []),
}

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


def run_model(sess, img):
    w, h = img.size
    x = np.asarray(img.resize((1024, 1024), Image.BICUBIC)).astype(np.float32) / 255.0
    x = ((x - MEAN) / STD).transpose(2, 0, 1)[None].astype(np.float32)
    out = sess.run(None, {sess.get_inputs()[0].name: x})[0][0, 0]
    out = 1.0 / (1.0 + np.exp(-out))
    out = (out - out.min()) / max(out.max() - out.min(), 1e-6)
    m = Image.fromarray((out * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(m).astype(np.float32) / 255.0


def refine_alpha(alpha, rgb):
    # gentle contrast curve on the matte, then guided-filter-like edge snap
    a = np.clip((alpha - 0.12) / 0.76, 0, 1)
    a = a * a * (3 - 2 * a)
    guide = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    try:
        a = cv2.ximgproc.guidedFilter(guide, a, 2, 1e-4)  # type: ignore[attr-defined]
    except Exception:
        a = cv2.bilateralFilter(a, 5, 0.1, 3)
    # keep only the largest connected blob (+ anything big attached to it)
    hard = (a > 0.5).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(hard, 8)
    if n > 2:
        keep = np.zeros_like(hard)
        areas = stats[1:, cv2.CC_STAT_AREA]
        big = areas.max()
        for i, ar in enumerate(areas, start=1):
            if ar >= 0.04 * big:
                keep[lab == i] = 1
        keep = cv2.dilate(keep, np.ones((7, 7), np.uint8))
        a = a * keep
    return np.clip(a, 0, 1)


def decontaminate(rgb, alpha):
    """Pull edge colours from the interior so the cut-out has no bright halo."""
    rgbf = rgb.astype(np.float32)
    inner = (alpha > 0.95).astype(np.float32)
    acc = rgbf * inner[..., None]
    wsum = inner.copy()
    for k in (3, 7, 15, 31):
        acc_b = cv2.blur(acc, (k, k))
        w_b = cv2.blur(wsum, (k, k))
        fill = acc_b / np.maximum(w_b[..., None], 1e-5)
        need = (wsum < 0.5) & (w_b > 1e-3)
        acc[need] = fill[need]
        wsum[need] = 1.0
    edge = (alpha > 0.02) & (alpha < 0.95)
    out = rgbf.copy()
    mix = np.clip((0.95 - alpha) / 0.95, 0, 1)[..., None] * 0.85
    out[edge] = (rgbf * (1 - mix) + acc * mix)[edge]
    return np.clip(out, 0, 255).astype(np.uint8)


def trace_paths(binary, min_len=12):
    """Trace a 1px skeleton into ordered polylines."""
    sk = skeletonize(binary > 0).astype(np.uint8)
    h, w = sk.shape
    visited = np.zeros_like(sk, bool)
    nbrs = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

    def deg(y, x):
        c = 0
        for dy, dx in nbrs:
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and sk[yy, xx]:
                c += 1
        return c

    pts = np.argwhere(sk)
    ends = [tuple(p) for p in pts if deg(*p) == 1]
    starts = ends + [tuple(p) for p in pts]
    paths = []
    for s in starts:
        if visited[s]:
            continue
        path = [s]
        visited[s] = True
        cur = s
        while True:
            nxt = None
            for dy, dx in nbrs:
                yy, xx = cur[0] + dy, cur[1] + dx
                if 0 <= yy < h and 0 <= xx < w and sk[yy, xx] and not visited[yy, xx]:
                    nxt = (yy, xx)
                    break
            if nxt is None:
                break
            visited[nxt] = True
            path.append(nxt)
            cur = nxt
        if len(path) >= min_len:
            paths.append(path)
    return paths


def simplify(path, eps=0.9):
    arr = np.array([[p[1], p[0]] for p in path], np.float32).reshape(-1, 1, 2)
    ap = cv2.approxPolyDP(arr, eps, False).reshape(-1, 2)
    return ap


def fix_ingenia(alpha):
    """Geometric matte repair: the gantry is an ellipse (crop coords), the bore stays open,
    the magnet column above the housing is removed."""
    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    gantry = ((xx - 179) / 91.0) ** 2 + ((yy - 208) / 103.0) ** 2 <= 1.0
    bore = ((xx - 182) / 33.0) ** 2 + ((yy - 200) / 33.0) ** 2 <= 1.0
    alpha[gantry & ~bore] = np.maximum(alpha[gantry & ~bore], 1.0)
    edge = cv2.GaussianBlur((bore).astype(np.float32), (0, 0), 1.2)
    alpha[bore] = np.minimum(alpha[bore], 1.0 - edge[bore])
    alpha[(yy < 150) & (xx < 100)] = 0.0
    alpha[(yy < 193) & (xx < 50)] = 0.0
    alpha[(~gantry) & (yy < 140) & (xx > 100)] = 0.0
    return alpha


FIXES = {"ingenia": fix_ingenia}


def main():
    model, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
    only = sys.argv[4].split(",") if len(sys.argv) > 4 else None
    sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
    manifest = {}
    if only:
        try:
            manifest = json.load(open(f"{out}/manifest.json"))
        except FileNotFoundError:
            pass
    for name, (fn, box, zero) in MACHINES.items():
        if only and name not in only:
            continue
        img = Image.open(f"{src}/{fn}").convert("RGB").crop(box)
        rgb = np.asarray(img)
        alpha = run_model(sess, img)
        for (l, t, r, b) in zero:
            alpha[t:b, l:r] = 0
        alpha = refine_alpha(alpha, rgb)
        if name in FIXES:
            alpha = FIXES[name](alpha)
        clean = decontaminate(rgb, alpha)
        ys, xs = np.where(alpha > 0.03)
        t, b, l, r = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        pad = 4
        t, l = max(t - pad, 0), max(l - pad, 0)
        b, r = min(b + pad, alpha.shape[0]), min(r + pad, alpha.shape[1])
        rgba = np.dstack([clean, (alpha * 255).astype(np.uint8)])[t:b, l:r]
        Image.fromarray(rgba, "RGBA").save(f"{out}/{name}.png", optimize=True)

        # --- vector line drawing: silhouette + strong interior edges ---
        a8 = (alpha[t:b, l:r] * 255).astype(np.uint8)
        g = cv2.cvtColor(clean[t:b, l:r], cv2.COLOR_RGB2GRAY)
        g = cv2.bilateralFilter(g, 7, 40, 5)
        med = np.median(g[a8 > 128]) if (a8 > 128).any() else 128
        edges = cv2.Canny(g, int(max(10, 0.45 * med)), int(min(255, 1.0 * med)))
        inner = cv2.erode((a8 > 128).astype(np.uint8), np.ones((5, 5), np.uint8))
        edges = edges * inner
        sil = cv2.Canny((a8 > 128).astype(np.uint8) * 255, 50, 150)
        lines = []
        cs, _ = cv2.findContours((a8 > 128).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cs = sorted(cs, key=cv2.contourArea, reverse=True)
        for c in cs[:3]:
            if cv2.contourArea(c) < 200:
                continue
            ap = cv2.approxPolyDP(c.astype(np.float32), 0.8, True).reshape(-1, 2)
            lines.append({"k": "sil", "p": [round(float(v), 1) for xy in ap for v in xy] + [round(float(ap[0][0]), 1), round(float(ap[0][1]), 1)]})
        for path in trace_paths(edges, min_len=18):
            ap = simplify(path)
            if len(ap) < 2:
                continue
            lines.append({"k": "in", "p": [round(float(v), 1) for xy in ap for v in xy]})
        h, w = a8.shape
        with open(f"{out}/{name}.lines.json", "w") as f:
            json.dump({"w": w, "h": h, "lines": lines}, f, separators=(",", ":"))
        manifest[name] = {"w": int(w), "h": int(h), "src": fn, "box": list(box)}
        print(name, w, h, "lines", len(lines), "sil", sil.sum() // 255)
    with open(f"{out}/manifest.json", "w") as f:
        json.dump(manifest, f, indent=1)


if __name__ == "__main__":
    main()
