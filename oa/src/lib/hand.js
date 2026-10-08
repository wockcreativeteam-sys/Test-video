// Procedural hands, drawn as a single contour line (the way a child's hand is traced on paper).
// A hand is a set of round cones (bones with soft tissue) smooth-unioned into a signed distance
// field; marching squares turns the field into one open contour that runs up one side of the
// forearm, around every finger, and down the other side. Units: cm, wrist at the origin, y up.

const DEG = Math.PI / 180;

// ---- anatomy presets ---------------------------------------------------------------------------
// fingers: [mcpX, mcpY, baseAngle(deg, + toward pinky), [proximal, middle, distal] lengths, baseR, tipR]
const ADULT_F = {
  palmW: 7.4, palmL: 9.6, wristW: 5.6, armW: 6.6,
  fingers: [
    [-2.65, 9.25, -9, [3.15, 2.0, 1.75], 0.86, 0.66],
    [-0.8, 9.85, -1, [3.45, 2.3, 1.85], 0.88, 0.67],
    [1.05, 9.55, 6, [3.25, 2.15, 1.8], 0.83, 0.63],
    [2.75, 8.75, 14, [2.55, 1.6, 1.5], 0.72, 0.56],
  ],
  thumb: { cmc: [-2.2, 2.3], ang: -36, lens: [3.5, 2.55, 2.1], r0: 1.4, r1: 0.82 },
  knuckle: 0.0,
};
const CHILD = {
  palmW: 5.7, palmL: 5.5, wristW: 4.5, armW: 5.0,
  fingers: [
    [-2.0, 5.45, -8, [1.95, 1.22, 1.08], 0.76, 0.66],
    [-0.64, 5.8, -1, [2.15, 1.32, 1.12], 0.78, 0.68],
    [0.74, 5.62, 6, [2.0, 1.25, 1.08], 0.74, 0.65],
    [2.02, 5.05, 14, [1.58, 1.0, 0.95], 0.65, 0.58],
  ],
  thumb: { cmc: [-1.6, 1.5], ang: -38, lens: [2.1, 1.5, 1.3], r0: 1.12, r1: 0.72 },
  knuckle: 0.0,
  k: 0.5,
};
const ADULT_M = {
  palmW: 8.6, palmL: 10.6, wristW: 6.4, armW: 7.6,
  fingers: [
    [-3.05, 10.2, -8, [3.4, 2.2, 1.9], 1.0, 0.78],
    [-0.95, 10.85, -1, [3.75, 2.5, 2.0], 1.02, 0.79],
    [1.2, 10.5, 6, [3.5, 2.35, 1.95], 0.97, 0.74],
    [3.15, 9.6, 14, [2.8, 1.75, 1.65], 0.85, 0.66],
  ],
  thumb: { cmc: [-2.55, 2.6], ang: -35, lens: [3.85, 2.8, 2.3], r0: 1.6, r1: 0.94 },
  knuckle: 0.0,
};
// the mother, decades later: the same hand, a little bonier, nodes at the finger joints
const OLDER_F = { ...ADULT_F, knuckle: 0.11 };

export const HANDS = { child: CHILD, mother: ADULT_F, older: OLDER_F, adult: ADULT_M };

// ---- poses -----------------------------------------------------------------------------------
// per finger: [abduction offset (deg), mcp flex, pip flex, dip flex]  (flex in deg, 90 = folded)
// thumb: [abduction offset, cmc flex, mcp flex, ip flex]
export const POSES = {
  open: { f: [[-3, 6, 8, 5], [0, 5, 7, 4], [3, 6, 8, 5], [6, 8, 10, 6]], th: [6, 10, 8, 6] },
  reach: { f: [[-2, 0, 2, 1], [0, 14, 18, 10], [2, 20, 26, 14], [5, 26, 34, 18]], th: [-4, 14, 12, 10] },
  point: { f: [[-1, 0, 0, 0], [0, 58, 70, 40], [1, 64, 76, 44], [3, 66, 80, 46]], th: [-14, 30, 26, 20] },
  rest: { f: [[-2, 12, 20, 12], [0, 16, 24, 14], [2, 18, 28, 16], [4, 22, 32, 18]], th: [-6, 16, 14, 10] },
  hold: { f: [[0, 40, 46, 26], [0, 44, 50, 28], [1, 46, 52, 30], [2, 48, 54, 32]], th: [-18, 26, 22, 18] },
  spread: { f: [[-9, 2, 4, 2], [-2, 2, 3, 2], [5, 2, 4, 2], [12, 4, 6, 3]], th: [14, 6, 4, 3] },
};

export function mixPose(a, b, u) {
  const l = (x, y) => x + (y - x) * u;
  return { f: a.f.map((r, i) => r.map((v, j) => l(v, b.f[i][j]))), th: a.th.map((v, j) => l(v, b.th[j])) };
}

// ---- primitives --------------------------------------------------------------------------------
// round cone (Inigo Quilez): segment a->b with radii r1, r2
function sdRoundCone(px, py, ax, ay, bx, by, r1, r2) {
  const bax = bx - ax, bay = by - ay;
  const l2 = bax * bax + bay * bay;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - ax, pay = py - ay;
  const y = pax * bax + pay * bay;
  const z = y - l2;
  const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y;
  const x2 = qx * qx + qy * qy;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/**
 * Build the hand's primitives for a pose. Returns { prims, tips: [[x,y] x5 (thumb, index..pinky)], bbox }
 */
export function handRig(kind, pose, o = {}) {
  const A = HANDS[kind];
  const prims = [];
  const tips = [];
  const knuckles = [];
  const spread = o.spread ?? 1;
  // palm: a fan of cones from the wrist to each MCP, plus heel-of-hand masses
  const ww = A.wristW / 2;
  for (const f of A.fingers) prims.push([f[0] * 0.55, 1.2, f[0], f[1] - 0.2, A.palmW * 0.17, f[4] * 1.05, 0]);
  prims.push([-ww * 0.5, 0.7, -A.palmW * 0.42, A.palmL * 0.4, ww * 0.68, A.palmW * 0.22, 0]); // thenar
  prims.push([ww * 0.5, 0.6, A.palmW * 0.4, A.palmL * 0.5, ww * 0.6, A.palmW * 0.17, 0]); // hypothenar
  prims.push([0, 0.2, 0, A.palmL * 0.62, ww * 0.95, A.palmW * 0.33, 0]); // palm core
  // forearm (long; cut later)
  prims.push([0, 0.6, 0, -40, ww, A.armW / 2, 0]);
  // fingers
  A.fingers.forEach((f, i) => {
    const p = pose.f[i];
    let ang = (f[2] + p[0]) * spread * DEG;
    let x = f[0], y = f[1];
    const lens = f[3];
    const flex = [p[1], p[2], p[3]];
    let cum = 0;
    for (let s = 0; s < 3; s++) {
      cum += flex[s];
      // flexion folds the finger toward the viewer: projected length shrinks, slight inward curl
      const L = lens[s] * Math.max(0.12, Math.cos(Math.min(cum, 170) * DEG * 0.92));
      const curl = (s === 0 ? 0 : 1) * flex[s] * 0.06 * DEG * (i < 2 ? 1 : -1);
      ang += curl;
      const nx = x + Math.sin(ang) * L, ny = y + Math.cos(ang) * L;
      const r0 = f[4] + (f[5] - f[4]) * (s / 3), r1 = f[4] + (f[5] - f[4]) * ((s + 1) / 3);
      prims.push([x, y, nx, ny, r0, r1, 1 + i]);
      if (s < 2 && A.knuckle > 0) knuckles.push([nx, ny, r1 * (1 + A.knuckle * (s === 1 ? 1.6 : 1)), 1 + i]);
      x = nx;
      y = ny;
    }
    tips.push([x + Math.sin(ang) * f[5], y + Math.cos(ang) * f[5]]);
  });
  // thumb
  {
    const T = A.thumb, p = pose.th;
    let ang = (T.ang + p[0]) * DEG;
    let x = T.cmc[0], y = T.cmc[1];
    let cum = 0;
    for (let s = 0; s < 3; s++) {
      cum += p[s + 1];
      const L = T.lens[s] * Math.max(0.2, Math.cos(Math.min(cum, 160) * DEG * 0.85));
      ang += p[s + 1] * 0.12 * DEG;
      const nx = x + Math.sin(ang) * L, ny = y + Math.cos(ang) * L;
      const r0 = T.r0 + (T.r1 - T.r0) * (s / 3), r1 = T.r0 + (T.r1 - T.r0) * ((s + 1) / 3);
      prims.push([x, y, nx, ny, r0 * (s === 0 ? 1.3 : 1), r1 * (s === 0 ? 1.08 : 1), 5]);
      x = nx;
      y = ny;
    }
    tips.unshift([x + Math.sin(ang) * T.r1, y + Math.cos(ang) * T.r1]);
  }
  for (const k of knuckles) prims.push([k[0], k[1] - 0.01, k[0], k[1] + 0.01, k[2], k[2], k[3]]);
  let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of prims) {
    x0 = Math.min(x0, q[0] - q[4], q[2] - q[5]);
    x1 = Math.max(x1, q[0] + q[4], q[2] + q[5]);
    y1 = Math.max(y1, q[1] + q[4], q[3] + q[5]);
  }
  return { prims, tips, bbox: [x0 - 0.6, o.cut ?? -9, x1 + 0.6, y1 + 0.6], kind };
}

const GD = new Float64Array(8);
// palm masses blend softly (k * 1.8); each digit is a hard union of its bones; digits meet the palm
// (and each other) with a small web (k)
function field(prims, px, py, k) {
  GD.fill(1e9);
  for (let i = 0; i < prims.length; i++) {
    const q = prims[i];
    const di = sdRoundCone(px, py, q[0], q[1], q[2], q[3], q[4], q[5]);
    const g = q[6];
    GD[g] = g === 0 ? (GD[0] > 1e8 ? di : smin(GD[0], di, k * 1.8)) : Math.min(GD[g], di);
  }
  let d = GD[0];
  for (let g = 1; g < 6; g++) if (GD[g] < 1e8) d = smin(d, GD[g], k * 0.7);
  return d;
}

/**
 * Trace the contour of a rig. Returns { P: Float32Array (x,y cm), n, tipS: [arc length at each tip],
 * L: total length } — an open line from the left forearm cut, around the hand, to the right cut.
 */
export function traceHand(rig, res = 0.09, k = 0.55) {
  const [x0, y0, x1, y1] = rig.bbox;
  const nx = Math.ceil((x1 - x0) / res) + 1, ny = Math.ceil((y1 - y0) / res) + 1;
  const D = new Float32Array(nx * ny);
  const prims = rig.prims;
  // cull primitives per row band for speed
  for (let j = 0; j < ny; j++) {
    const py = y0 + j * res;
    const rowP = prims.filter((q) => py >= Math.min(q[1], q[3]) - Math.max(q[4], q[5]) - 1.2 && py <= Math.max(q[1], q[3]) + Math.max(q[4], q[5]) + 1.2);
    for (let i = 0; i < nx; i++) {
      const px = x0 + i * res;
      // the forearm runs through the bottom edge of the grid, so the contour stays open there
      D[j * nx + i] = rowP.length ? field(rowP, px, py, k) : 1;
    }
  }
  // marching squares -> segments keyed by edge id
  const segs = new Map();
  const ex = (i, j) => (j * nx + i) * 2; // horizontal edge (i,j)-(i+1,j)
  const ey = (i, j) => (j * nx + i) * 2 + 1; // vertical edge (i,j)-(i,j+1)
  const pts = new Map();
  const edgePt = (id) => {
    let p = pts.get(id);
    if (p) return p;
    const cell = id >> 1, i = cell % nx, j = (cell / nx) | 0;
    let a, b, ax, ay, bx, by;
    if ((id & 1) === 0) {
      a = D[j * nx + i]; b = D[j * nx + i + 1];
      ax = i; ay = j; bx = i + 1; by = j;
    } else {
      a = D[j * nx + i]; b = D[(j + 1) * nx + i];
      ax = i; ay = j; bx = i; by = j + 1;
    }
    const u = a / (a - b);
    p = [x0 + (ax + (bx - ax) * u) * res, y0 + (ay + (by - ay) * u) * res];
    pts.set(id, p);
    return p;
  };
  const link = (a, b) => {
    (segs.get(a) || segs.set(a, []).get(a)).push(b);
    (segs.get(b) || segs.set(b, []).get(b)).push(a);
  };
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = D[j * nx + i] < 0, b = D[j * nx + i + 1] < 0, c = D[(j + 1) * nx + i + 1] < 0, d = D[(j + 1) * nx + i] < 0;
      const code = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const eB = ex(i, j), eR = ey(i + 1, j), eT = ex(i, j + 1), eL = ey(i, j);
      switch (code) {
        case 1: case 14: link(eL, eB); break;
        case 2: case 13: link(eB, eR); break;
        case 3: case 12: link(eL, eR); break;
        case 4: case 11: link(eR, eT); break;
        case 6: case 9: link(eB, eT); break;
        case 7: case 8: link(eL, eT); break;
        case 5: link(eL, eT); link(eB, eR); break;
        case 10: link(eL, eB); link(eR, eT); break;
      }
    }
  // walk the longest chain
  const seen = new Set();
  let best = null;
  for (const start of segs.keys()) {
    if (seen.has(start)) continue;
    // find an end (degree 1) of this component, else any point (loop)
    const comp = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const v = stack.pop();
      comp.push(v);
      for (const w of segs.get(v)) if (!seen.has(w)) {
        seen.add(w);
        stack.push(w);
      }
    }
    let end = comp.find((v) => segs.get(v).length === 1) ?? comp[0];
    const chain = [end];
    const used = new Set([end]);
    let cur = end;
    for (;;) {
      const nb = segs.get(cur).find((w) => !used.has(w));
      if (nb === undefined) break;
      chain.push(nb);
      used.add(nb);
      cur = nb;
    }
    if (!best || chain.length > best.length) best = chain;
  }
  let P = best.map(edgePt);
  // orient: start on the thumb side (left, x < 0) of the forearm cut
  if (P[0][0] > P[P.length - 1][0]) P.reverse();
  // smooth (keep ends)
  for (let it = 0; it < 2; it++) {
    const Q = P.map((p) => p.slice());
    for (let i = 1; i < P.length - 1; i++) {
      Q[i][0] = (P[i - 1][0] + 2 * P[i][0] + P[i + 1][0]) / 4;
      Q[i][1] = (P[i - 1][1] + 2 * P[i][1] + P[i + 1][1]) / 4;
    }
    P = Q;
  }
  const n = P.length;
  const out = new Float32Array(n * 2);
  const cum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i * 2] = P[i][0];
    out[i * 2 + 1] = P[i][1];
    if (i) cum[i] = cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  }
  const tipS = rig.tips.map(([tx, ty]) => {
    let bi = 0, bd = 1e9;
    for (let i = 0; i < n; i++) {
      const d = (P[i][0] - tx) ** 2 + (P[i][1] - ty) ** 2;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    return cum[bi];
  });
  return { P: out, n, cum, L: cum[n - 1], tipS, tips: rig.tips };
}

const cache = new Map();
/** cached trace for a named static pose */
export function handShape(kind, poseName, o = {}) {
  const key = kind + '|' + poseName + '|' + JSON.stringify(o);
  let s = cache.get(key);
  if (!s) {
    s = traceHand(handRig(kind, POSES[poseName], o), o.res, o.k ?? HANDS[kind].k ?? 0.6);
    cache.set(key, s);
  }
  return s;
}

/**
 * Place a traced hand on screen: rotate (deg, 0 = fingers up), scale px/cm, translate to (x, y)
 * where (x, y) is the screen position of local point `anchor` (default wrist).
 */
export function placeHand(T, x, y, scale, rotDeg, o = {}) {
  const c = Math.cos(rotDeg * DEG), s = Math.sin(rotDeg * DEG);
  const mx = o.mirror ? -1 : 1;
  const ax = o.anchor ? o.anchor[0] : 0, ay = o.anchor ? o.anchor[1] : 0;
  const out = new Float32Array(T.n * 2);
  for (let i = 0; i < T.n; i++) {
    const lx = (T.P[i * 2] - ax) * mx, ly = T.P[i * 2 + 1] - ay;
    // y up in hand space -> y down on screen
    out[i * 2] = x + (lx * c + ly * s) * scale;
    out[i * 2 + 1] = y + (lx * s - ly * c) * scale;
  }
  return out;
}

/** screen position of a local hand point under the same placement */
export function placePoint(px, py, x, y, scale, rotDeg, o = {}) {
  const c = Math.cos(rotDeg * DEG), s = Math.sin(rotDeg * DEG);
  const mx = o.mirror ? -1 : 1;
  const ax = o.anchor ? o.anchor[0] : 0, ay = o.anchor ? o.anchor[1] : 0;
  const lx = (px - ax) * mx, ly = py - ay;
  return [x + (lx * c + ly * s) * scale, y + (lx * s - ly * c) * scale];
}
