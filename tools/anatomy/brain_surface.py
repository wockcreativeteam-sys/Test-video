#!/usr/bin/env python3
"""Lateral cortical surface for the neuro chapter.

Grows gyri on the brain's lateral projection with a Gray-Scott reaction-diffusion system
seeded by an anatomical template (horizontal frontal and temporal gyri, vertical pre/post-
central gyri, the Sylvian fissure), skeletonises the sulci into single lines, then lifts every
line back onto the 3D surface of the same signed-distance brain used by film/src/brain.js.

Output: film/assets/anatomy/brain_lateral.json, in cm, body coordinates
(X lateral, Y anterior, Z superior), near (+X) hemisphere only:
  outline  - the lateral silhouette (grazing points), scalloped where sulci reach the edge
  sulci    - polylines on the cortical surface; kind 'major' (Sylvian, central) or 'minor'
  folia    - cerebellar folia
  stem     - brainstem outline
usage: tools/anatomy/brain_surface.py [--preview out.png]
"""
import json
import math
import os
import sys

import numpy as np
from scipy import ndimage as ndi
from skimage.morphology import skeletonize

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'film', 'assets', 'anatomy', 'brain_lateral.json')


# --- signed-distance brain (mirror of film/src/brain.js) -----------------------------------
def sd_ell(x, y, z, cx, cy, cz, rx, ry, rz):
    a, b, c = (x - cx) / rx, (y - cy) / ry, (z - cz) / rz
    k0 = np.sqrt(a * a + b * b + c * c)
    k1 = np.sqrt(a * a / (rx * rx) + b * b / (ry * ry) + c * c / (rz * rz))
    return np.where(k1 > 1e-9, k0 * (k0 - 1) / np.maximum(k1, 1e-9), -min(rx, ry, rz))


def sd_cap(x, y, z, a, b, r):
    pax, pay, paz = x - a[0], y - a[1], z - a[2]
    bax, bay, baz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    h = np.clip((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1)
    return np.sqrt((pax - bax * h) ** 2 + (pay - bay * h) ** 2 + (paz - baz * h) ** 2) - r


def smin(a, b, k):
    h = np.maximum(k - np.abs(a - b), 0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def smax(a, b, k):
    return -smin(-a, -b, k)


def cerebrum(X, y, z):
    d = sd_ell(X, y, z, 3.2, 15.0, 165.8, 3.5, 4.7, 5.0)  # frontal
    d = smin(d, sd_ell(X, y, z, 3.4, 10.6, 168.3, 3.6, 4.9, 4.4), 1.6)  # parietal
    d = smin(d, sd_ell(X, y, z, 3.0, 6.3, 165.0, 3.1, 3.4, 4.0), 1.4)  # occipital
    d = smin(d, sd_ell(X, y, z, 4.15, 12.7, 160.6, 2.75, 4.9, 2.6), 1.0)  # temporal
    d = smax(d, -(X - 0.14), 0.2)
    return d


CB = dict(c=(0.0, 7.0, 158.35), r=(4.9, 3.25, 2.25), tilt=0.16)


def cerebellum(x, y, z):
    c, r, a = CB['c'], CB['r'], CB['tilt']
    yy, zz = y - c[1], z - c[2]
    yr = yy * math.cos(a) - zz * math.sin(a)
    zr = yy * math.sin(a) + zz * math.cos(a)
    return sd_ell(x, yr, zr, c[0], 0, 0, r[0], r[1], r[2])


def stem(x, y, z):
    d = sd_ell(x, y, z, 0, 10.75, 156.3, 1.7, 1.6, 1.65)  # pons
    return smin(d, sd_cap(x, y, z, (0, 9.7, 159.6), (0, 9.0, 149.0), 1.2), 0.8)


# --- lateral projection --------------------------------------------------------------------
DX = 0.1
Y0, Y1, Z0, Z1 = 0.5, 21.5, 145.5, 176.0
ys = np.arange(Y0, Y1 + 1e-9, DX)
zs = np.arange(Z0, Z1 + 1e-9, DX)
YY, ZZ = np.meshgrid(ys, zs)  # [iz, iy]
XS = np.arange(0.0, 8.6, 0.1)


def project(fn):
    """min over X of fn, the X where it is reached, and the outermost X still inside"""
    best = np.full(YY.shape, np.inf)
    bestX = np.zeros(YY.shape)
    outer = np.full(YY.shape, np.nan)
    for X in XS:
        d = fn(np.full(YY.shape, X), YY, ZZ)
        m = d < best
        best[m], bestX[m] = d[m], X
        outer[d <= 0] = X
    return best, bestX, outer


def refine_outer(fn, outer):
    """bisection: exact lateral surface X between the last inside sample and the next"""
    lo = np.nan_to_num(outer, nan=0.0)
    hi = lo + 0.1
    for _ in range(12):
        mid = (lo + hi) / 2
        inside = fn(mid, YY, ZZ) <= 0
        lo = np.where(inside, mid, lo)
        hi = np.where(inside, hi, mid)
    return lo


def gray_scott(mask, seed, steps=9000, F=0.037, k=0.06, Du=0.16, Dv=0.08, rng=None):
    U = np.ones(mask.shape)
    V = np.zeros(mask.shape)
    V[mask] = 0.25 * seed[mask] + 0.03 * rng.random(mask.sum())
    U[mask] = 1 - 0.5 * seed[mask]
    lap = lambda A: (np.roll(A, 1, 0) + np.roll(A, -1, 0) + np.roll(A, 1, 1) + np.roll(A, -1, 1) - 4 * A)
    for _ in range(steps):
        uvv = U * V * V
        U += Du * lap(U) - uvv + F * (1 - U)
        V += Dv * lap(V) + uvv - (F + k) * V
        U[~mask] = 1.0
        V[~mask] = 0.0
    return U, V


def seg_dist(py, pz, a, b):
    """distance from grid points to segment a-b, and the projection parameter"""
    ay, az = a
    by, bz = b
    vy, vz = by - ay, bz - az
    h = np.clip(((py - ay) * vy + (pz - az) * vz) / (vy * vy + vz * vz), 0, 1)
    return np.hypot(py - ay - vy * h, pz - az - vz * h), h


def polyline_dist(py, pz, pts):
    d = np.full(py.shape, np.inf)
    for a, b in zip(pts[:-1], pts[1:]):
        d = np.minimum(d, seg_dist(py, pz, a, b)[0])
    return d


# key sulci, (Y, Z) in cm; anterior = +Y
SYLVIAN = [(17.3, 160.6), (15.6, 162.2), (12.0, 163.0), (9.4, 164.0), (8.4, 165.6)]
CENTRAL = [(9.0, 172.6), (10.0, 170.4), (11.0, 168.4), (12.0, 166.4), (12.6, 164.2)]


def template():
    """anatomical stripe template: +1 on gyri crowns, -1 in sulci"""
    lam = 1.25  # gyral period, cm
    dS = polyline_dist(YY, ZZ, SYLVIAN)
    # signed offset from the central sulcus (anterior positive)
    dC = polyline_dist(YY, ZZ, CENTRAL)
    side = np.sign((YY - 11.0) + 0.45 * (ZZ - 168.0))
    above = ZZ > np.interp(YY, [8.0, 12.0, 15.6, 18.0], [165.8, 163.0, 162.2, 160.4])
    frontal = above & (side > 0) & (dC > lam * 1.5)
    central = above & (dC <= lam * 1.5)
    temporal = ~above & (YY > 7.5)
    rng = np.random.default_rng(3)
    warp = ndi.gaussian_filter(rng.standard_normal(YY.shape), 9) * 9.0  # ~0.35 cm meander
    phase = np.zeros(YY.shape)
    phase[frontal] = (ZZ[frontal] - 164.0 + 0.55 * warp[frontal] + 0.18 * (YY[frontal] - 15)) / lam  # frontal gyri
    phase[central] = dC[central] / lam + 0.5  # pre/post-central gyri parallel to the sulcus
    phase[temporal] = dS[temporal] / lam + 0.5  # temporal gyri parallel to the fissure
    rest = ~(frontal | central | temporal)
    phase[rest] = (dS[rest] + 0.35 * dC[rest]) / lam  # parietal/occipital: looser
    phase += 0.25 * warp * ~frontal
    return np.cos(2 * np.pi * phase), dS, dC


def trace_skeleton(sk):
    """skeleton pixels -> list of polylines (index coords)"""
    sk = sk.copy()
    H, W = sk.shape
    nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

    def neigh(p):
        r, c = p
        return [(r + dr, c + dc) for dr, dc in nb if 0 <= r + dr < H and 0 <= c + dc < W and sk[r + dr, c + dc]]

    pts = list(zip(*np.nonzero(sk)))
    deg = {p: len(neigh(p)) for p in pts}
    visited = set()
    lines = []

    def walk(start, nxt):
        line = [start, nxt]
        visited.add(frozenset((start, nxt)))
        prev, cur = start, nxt
        while deg.get(cur, 0) == 2:
            cand = [q for q in neigh(cur) if q != prev and frozenset((cur, q)) not in visited]
            if not cand:
                break
            q = cand[0]
            visited.add(frozenset((cur, q)))
            line.append(q)
            prev, cur = cur, q
        return line

    for p in pts:
        if deg[p] != 2:
            for q in neigh(p):
                if frozenset((p, q)) not in visited:
                    lines.append(walk(p, q))
    for p in pts:  # loops
        for q in neigh(p):
            if frozenset((p, q)) not in visited:
                lines.append(walk(p, q))
    return lines


def chaikin(P, iters=2):
    P = np.asarray(P, float)
    for _ in range(iters):
        if len(P) < 3:
            break
        Q = P[:-1] * 0.75 + P[1:] * 0.25
        R = P[:-1] * 0.25 + P[1:] * 0.75
        P = np.vstack([P[:1], np.column_stack([Q, R]).reshape(-1, 2), P[-1:]])
    return P


def simplify(P, step=0.12):
    out = [P[0]]
    acc = 0
    for a, b in zip(P[:-1], P[1:]):
        acc += np.hypot(*(b - a))
        if acc >= step:
            out.append(b)
            acc = 0
    if not np.allclose(out[-1], P[-1]):
        out.append(P[-1])
    return np.array(out)


def length(P):
    return float(np.hypot(*np.diff(P, axis=0).T).sum()) if len(P) > 1 else 0.0


def sample(img, P):
    """bilinear sample of a grid image at (Y, Z) cm points"""
    iy = (P[:, 0] - Y0) / DX
    iz = (P[:, 1] - Z0) / DX
    return ndi.map_coordinates(img, [iz, iy], order=1, mode='nearest')


def contours(mask_f, level=0.5):
    from skimage import measure
    cs = measure.find_contours(mask_f, level)
    return [np.column_stack([Y0 + c[:, 1] * DX, Z0 + c[:, 0] * DX]) for c in cs]


def split_runs(P, keep):
    """split a polyline into runs where keep(point) is true"""
    runs, cur = [], []
    for q, k in zip(P, keep):
        if k:
            cur.append(q)
        elif cur:
            runs.append(np.array(cur))
            cur = []
    if cur:
        runs.append(np.array(cur))
    return [r for r in runs if len(r) > 2 and length(r) > 0.4]


def smooth_line(pts, n=60):
    P = chaikin(np.array(pts, float), 4)
    return simplify(P, 0.1)


def main():
    rng = np.random.default_rng(7)
    cer_d, cer_x, cer_out = project(lambda X, y, z: cerebrum(X, y, z))
    cb_d, cb_x, cb_out = project(lambda X, y, z: cerebellum(X, y, z))
    st_d, st_x, st_out = project(lambda X, y, z: stem(X, y, z))
    Mc = ndi.binary_fill_holes(cer_d < 0)
    Mcb, Mst = cb_d < 0, st_d < 0
    surfX = refine_outer(lambda X, y, z: cerebrum(X, y, z), cer_out)
    surfX = np.where(np.isnan(cer_out) & Mc, ndi.grey_closing(np.nan_to_num(surfX), size=5), surfX)
    cbX = refine_outer(lambda X, y, z: cerebellum(X, y, z), cb_out)

    tmpl, dS, dC = template()
    edge = ndi.distance_transform_edt(Mc) * DX  # cm to the silhouette
    # the named sulci are barriers for the reaction-diffusion: gyri grow along them
    major = ((dS < 0.11) | ((dC < 0.09) & (ZZ > 164.9))) & Mc
    Mrd = Mc & ~major
    seed = np.clip(tmpl, 0, 1) * (edge > 0.25) * 0.8
    U, V = gray_scott(Mrd, seed, rng=rng)
    gyri = V > 0.18
    sulc = Mrd & ~gyri & (edge > 0.22)
    sk = skeletonize(sulc) & (dS > 0.32) & ~((dC < 0.3) & (ZZ > 164.6))
    sulci = []

    def lift(P, xs, inset, smooth=0):
        X = sample(xs, P) - inset
        if smooth:  # grazing depth is quantised: smooth it along the line
            X = ndi.gaussian_filter1d(X, smooth, mode='nearest')
        return np.column_stack([X, P]).round(3).tolist()

    for L in trace_skeleton(sk):
        P = np.array([(Y0 + c * DX, Z0 + r * DX) for r, c in L])
        if length(P) < 0.5:
            continue
        P = simplify(chaikin(P, 2), 0.1)
        if len(P) >= 3:
            sulci.append({'kind': 'minor', 'p': lift(P, surfX, 0.04)})
    # Sylvian fissure and central sulcus, drawn from their anatomical paths
    for name, pts in (('sylvian', SYLVIAN), ('central', CENTRAL)):
        P = smooth_line(pts)
        P = P[sample(edge, P) > 0.05]
        sulci.append({'kind': 'major', 'name': name, 'p': lift(P, surfX, 0.05)})

    # silhouettes: cerebrum (scalloped where sulci meet the edge), then the visible parts of
    # the cerebellum and brainstem tucked beneath it
    band = (edge < 0.34) & Mc
    groove = ndi.binary_dilation((sulc | major) & (edge < 0.6), iterations=2) & band
    cer_sil = ndi.binary_fill_holes(Mc & ~groove)
    outline = []
    for P in contours(ndi.gaussian_filter(cer_sil.astype(float), 0.9), 0.5):
        if length(P) < 3:
            continue
        P = simplify(chaikin(simplify(P, 0.1), 2), 0.07)
        outline.append({'part': 'cerebrum', 'p': lift(P, cer_x, 0.0, smooth=6)})
    over = ndi.binary_dilation(cer_sil, iterations=1)
    for P in contours(ndi.gaussian_filter(Mcb.astype(float), 0.8), 0.5):
        P = simplify(P, 0.08)
        for R in split_runs(P, sample(over.astype(float), P) < 0.5):
            outline.append({'part': 'cerebellum', 'p': lift(R, cb_x, 0.0, smooth=6)})
    over2 = ndi.binary_dilation(cer_sil | Mcb, iterations=1)
    for P in contours(ndi.gaussian_filter(Mst.astype(float), 0.8), 0.5):
        P = simplify(P, 0.08)
        for R in split_runs(P, (sample(over2.astype(float), P) < 0.5) & (P[:, 1] > 150.2)):
            outline.append({'part': 'stem', 'p': lift(R, st_x, 0.0, smooth=6)})

    # cerebellar folia: gently curved, roughly horizontal lines across the visible lobe
    folia = []
    c, a = CB['c'], CB['tilt']
    yr = (YY - c[1]) * math.cos(a) - (ZZ - c[2]) * math.sin(a)
    zr = (YY - c[1]) * math.sin(a) + (ZZ - c[2]) * math.cos(a)
    fol = zr + 0.09 * yr * yr / CB['r'][1] + 0.06 * np.sin(yr * 3.1)
    cbEdge = ndi.distance_transform_edt(Mcb & ~over) * DX
    from skimage import measure
    for lv in np.arange(-1.9, 2.0, 0.3):
        for cc in measure.find_contours(np.where(cbEdge > 0.16, fol, np.nan), lv):
            P = np.column_stack([Y0 + cc[:, 1] * DX, Z0 + cc[:, 0] * DX])
            if length(P) < 0.6:
                continue
            P = simplify(P, 0.1)
            folia.append(lift(P, cbX, 0.03))

    out = {'units': 'cm', 'axes': 'X lateral, Y anterior, Z superior', 'outline': outline, 'sulci': sulci, 'folia': folia}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print('outline', len(outline), 'sulci', len(sulci), 'folia', len(folia), 'bytes', os.path.getsize(OUT))

    if '--preview' in sys.argv:
        from PIL import Image, ImageDraw
        path = sys.argv[sys.argv.index('--preview') + 1]
        S = 40
        img = Image.new('RGB', (int((Y1 - Y0) * S), int((Z1 - Z0) * S)), (6, 14, 32))
        d = ImageDraw.Draw(img)
        tx = lambda q: ((Y1 - q[1]) * S, (Z1 - q[2]) * S)  # anterior on the left, like the film
        rd = np.flipud(np.fliplr(V / V.max()))
        rdimg = Image.fromarray((rd * 60).astype(np.uint8)).resize(img.size)
        img.paste(Image.merge('RGB', (rdimg, rdimg, rdimg)), (0, 0), Image.fromarray((np.flipud(np.fliplr(Mc)) * 90).astype(np.uint8)).resize(img.size))
        for o in outline:
            d.line([tx(q) for q in o['p']], fill=(240, 246, 255) if o['part'] == 'cerebrum' else (200, 215, 240), width=2)
        for s in sulci:
            d.line([tx(q) for q in s['p']], fill=(255, 120, 120) if s['kind'] == 'major' else (170, 200, 255), width=2 if s['kind'] == 'major' else 1)
        for P in folia:
            d.line([tx(q) for q in P], fill=(120, 150, 210), width=1)
        img.save(path)
        print('preview', path)


if __name__ == '__main__':
    main()
