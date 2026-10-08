// Procedural line-art worlds for "Every Step" (World OA Day).
//
// Shot 03 grows a whole world out of every footprint (shot 06 replays them slowed); shot 08 is
// rebuilt from particles inside the examination room. Everything here is static geometry in the
// final pose — metres, y up, ground y = 0, local origin = the footprint — drawn the way an
// architect draws: only the edges a draughtsman would put down from the shot camera (silhouettes
// and creases of every solid, visible arcs of every turned object), never a wireframe.
//
//   buildWorld(name, seed)  → { name, lines: [{ p: Float32Array xyz…, w, closed? }], dots?, anim?(t) }
//   buildExamRoom(seed)     → same shape, seen from the shot-08 camera
//   buildFragment(name)     → [Float32Array xy…] flat single-weight icon in [-0.5, 0.5]², y up
//
// w is importance: 1 structure / silhouette · 0.5 secondary · 0.2 fine detail.
// Deterministic: every random choice comes from mulberry32(seed); no clocks, no Math.random.
import { mulberry32 } from '../engine/util.js';

export const WORLD_ORDER = ['school', 'street', 'kitchen', 'hospital', 'wedding', 'bedroom', 'airport', 'rain', 'stairs'];
export const FRAGMENTS = ['shoe', 'staircase', 'schoolbag', 'bicycle'];

const TAU = Math.PI * 2;
const PI = Math.PI;
const W1 = 1, W2 = 0.5, W3 = 0.2;
// eyes the solids are drawn for (relative to the footprint / room origin)
const EYE_WALK = [-1.2, 1.3, -6.5];
const EYE_EXAM = [0.5, 1.35, -7.5];

// ------------------------------------------------------------------------------------------------
// vectors and 3x4 affine matrices
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (t) => t * t * (3 - 2 * t);

const MI = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
function mmul(a, b) {
  const o = new Array(12);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      let s = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c];
      if (c === 3) s += a[r * 4 + 3];
      o[r * 4 + c] = s;
    }
  }
  return o;
}
const mT = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
const mRy = (a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0];
};
const mRx = (a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0];
};
const mRz = (a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0];
};
const mS = (x, y = x, z = x) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0];
const mAp = (m, p) => [
  m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
  m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
  m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11],
];
function mInv(m) {
  const [a, b, c, tx, d, e, f, ty, g, h, i, tz] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const id = 1 / (a * A + b * B + c * C);
  const r00 = A * id, r01 = -(b * i - c * h) * id, r02 = (b * f - c * e) * id;
  const r10 = B * id, r11 = (a * i - c * g) * id, r12 = -(a * f - c * d) * id;
  const r20 = C * id, r21 = -(a * h - b * g) * id, r22 = (a * e - b * d) * id;
  return [
    r00, r01, r02, -(r00 * tx + r01 * ty + r02 * tz),
    r10, r11, r12, -(r10 * tx + r11 * ty + r12 * tz),
    r20, r21, r22, -(r20 * tx + r21 * ty + r22 * tz),
  ];
}
function newell(V, f) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < f.length; i++) {
    const a = V[f[i]], b = V[f[(i + 1) % f.length]];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [x, y, z];
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ------------------------------------------------------------------------------------------------
// curve sampling (local coordinates)
/** points on an arc: centre c, radius r, angles a0..a1, plane 'xy' | 'xz' | 'zy' (zy: angle from +z toward +y) */
function arcPts(c, r, a0, a1, plane = 'xy', n = 0) {
  if (!n) n = Math.max(6, Math.ceil((Math.abs(a1 - a0) / TAU) * clamp(Math.ceil((TAU * r) / 0.035), 20, 96)));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, cs = Math.cos(a) * r, sn = Math.sin(a) * r;
    if (plane === 'xy') out.push([c[0] + cs, c[1] + sn, c[2]]);
    else if (plane === 'xz') out.push([c[0] + cs, c[1], c[2] + sn]);
    else out.push([c[0], c[1] + sn, c[2] + cs]);
  }
  return out;
}
/** uniform Catmull-Rom through control points (any dimension), `per` samples per span */
function crPts(ctrl, per = 8, closed = false) {
  const n = ctrl.length;
  if (n < 3) return ctrl.slice();
  const get = (i) => (closed ? ctrl[(i + n) % n] : ctrl[clamp(i, 0, n - 1)]);
  const out = [];
  const spans = closed ? n : n - 1;
  for (let s = 0; s < spans; s++) {
    const p0 = get(s - 1), p1 = get(s), p2 = get(s + 1), p3 = get(s + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push(p1.map((_, d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  if (!closed) out.push(ctrl[n - 1].slice());
  return out;
}
/** cubic Bézier */
function bezPts(p0, p1, p2, p3, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push(p0.map((_, k) => a * p0[k] + b * p1[k] + c * p2[k] + d * p3[k]));
  }
  return out;
}
/** 2D rounded rectangle outline (counter-clockwise), radii per corner [bl, br, tr, tl] */
function rrect2(x0, y0, x1, y1, rad, per = 6) {
  const R = Array.isArray(rad) ? rad : [rad, rad, rad, rad];
  const out = [];
  const corner = (cx, cy, r, a0) => {
    if (r <= 1e-6) {
      out.push([cx, cy]);
      return;
    }
    for (let i = 0; i <= per; i++) {
      const a = a0 + (i / per) * (PI / 2);
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x0 + R[0], y0 + R[0], R[0], PI);
  corner(x1 - R[1], y0 + R[1], R[1], 1.5 * PI);
  corner(x1 - R[2], y1 - R[2], R[2], 0);
  corner(x0 + R[3], y1 - R[3], R[3], 0.5 * PI);
  // corner() with r = 0 pushes the exact corner; adjust those to the true corner positions
  return out.map((p) => p);
}

// ------------------------------------------------------------------------------------------------
// the drawing context
class Draw {
  constructor(name, seed, eye) {
    this.name = name;
    this.rnd = mulberry32((Math.imul(seed | 0, 7919) + hashStr(name)) >>> 0);
    this.eye = eye;
    this.m = MI;
    this.st = [];
    this.lines = [];
    this.dots = [];
  }
  rand(a = 0, b = 1) {
    return a + (b - a) * this.rnd();
  }
  push(m) {
    this.st.push(this.m);
    this.m = mmul(this.m, m);
    return this;
  }
  pop() {
    this.m = this.st.pop();
    return this;
  }
  /** translate (+ rotate about y, uniform scale) for the duration of fn */
  at(x, y, z, ry, fn, s = 1) {
    this.push(mmul(mT(x, y, z), mmul(mRy(ry || 0), mS(s))));
    fn();
    this.pop();
  }
  /** the eye in local coordinates */
  get E() {
    return mAp(mInv(this.m), this.eye);
  }
  line(pts, w = W2, closed = false) {
    if (pts.length < 2) return;
    const a = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) {
      const q = mAp(this.m, pts[i]);
      a[i * 3] = q[0];
      a[i * 3 + 1] = q[1] < 0 ? 0 : q[1];
      a[i * 3 + 2] = q[2];
    }
    this.lines.push(closed ? { p: a, w, closed: true } : { p: a, w });
  }
  seg(a, b, w = W2, over = 0) {
    if (over) {
      const d = nrm(sub(b, a));
      a = sub(a, scl(d, over));
      b = add(b, scl(d, over));
    }
    this.line([a, b], w);
  }
  dot(p) {
    const q = mAp(this.m, p);
    this.dots.push(q[0], Math.max(0, q[1]), q[2]);
  }
  quad(a, b, c, d, w = W2) {
    this.line([a, b, c, d], w, true);
  }
  /** rectangle in the plane z = const */
  rxy(x0, y0, x1, y1, z, w = W2) {
    this.line([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], w, true);
  }
  /** rectangle in the plane x = const */
  rzy(z0, y0, z1, y1, x, w = W2) {
    this.line([[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], w, true);
  }
  /** rectangle in the plane y = const */
  rxz(x0, z0, x1, z1, y, w = W2) {
    this.line([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], w, true);
  }
  arc(c, r, a0, a1, w = W2, plane = 'xy', n = 0) {
    this.line(arcPts(c, r, a0, a1, plane, n), w);
  }
  circle(c, r, w = W2, plane = 'xy', n = 0) {
    const p = arcPts(c, r, 0, TAU, plane, n);
    p.pop();
    this.line(p, w, true);
  }
  curve(ctrl, w = W2, per = 8, closed = false) {
    const p = crPts(ctrl, per, closed);
    this.line(p, w, closed);
  }
  /** a hanging wire between a and b with sag s (parabolic approximation of the catenary) */
  wire(a, b, s, w = W3, n = 28) {
    this.line(wirePts(a, b, s, n), w);
  }
  /** draw only the runs of pts where ok[i] holds */
  runs(pts, ok, w = W2, closed = false) {
    const n = pts.length;
    let all = true, any = false;
    for (const v of ok) {
      all = all && v;
      any = any || v;
    }
    if (!any) return;
    if (all) {
      this.line(pts, w, closed);
      return;
    }
    const start = closed ? ok.indexOf(false) : 0;
    let cur = [];
    const total = closed ? n + 1 : n;
    for (let s = 0; s < total; s++) {
      const i = (start + s) % n;
      if (ok[i]) cur.push(pts[i]);
      else {
        if (cur.length > 1) this.line(cur, w);
        cur = [];
      }
    }
    if (cur.length > 1) this.line(cur, w);
  }
  /** join segments [[ia, ib], …] over vertices V into as few polylines as possible */
  chain(V, segs, w = W2) {
    if (!segs.length) return;
    const used = new Array(segs.length).fill(false);
    const adj = new Map();
    segs.forEach((s, i) => {
      for (const v of s) {
        if (!adj.has(v)) adj.set(v, []);
        adj.get(v).push(i);
      }
    });
    const free = (v) => adj.get(v).filter((i) => !used[i]).length;
    let left = segs.length;
    while (left) {
      let start = -1;
      for (const v of adj.keys()) if (free(v) % 2 === 1) { start = v; break; }
      if (start < 0) for (const v of adj.keys()) if (free(v) > 0) { start = v; break; }
      const path = [start];
      let cur = start;
      for (;;) {
        const i = adj.get(cur).find((k) => !used[k]);
        if (i === undefined) break;
        used[i] = true;
        left--;
        cur = segs[i][0] === cur ? segs[i][1] : segs[i][0];
        path.push(cur);
      }
      const closed = path.length > 3 && path[0] === path[path.length - 1];
      if (closed) path.pop();
      this.line(path.map((k) => V[k]), w, closed);
    }
  }
  /** a polyhedron drawn like a draughtsman: silhouette edges + visible creases sharper than `crease`° */
  solid(V, F, w = W2, crease = 30) {
    const E = this.E;
    const cosC = Math.cos((crease * PI) / 180);
    const N = F.map((f) => nrm(newell(V, f)));
    const vis = F.map((f, i) => {
      let c = [0, 0, 0];
      for (const k of f) c = add(c, V[k]);
      c = scl(c, 1 / f.length);
      return dot(N[i], sub(E, c)) > 1e-7;
    });
    const em = new Map();
    F.forEach((f, fi) => {
      for (let k = 0; k < f.length; k++) {
        const a = f[k], b = f[(k + 1) % f.length];
        const key = a < b ? a * 65536 + b : b * 65536 + a;
        let e = em.get(key);
        if (!e) em.set(key, (e = { a: Math.min(a, b), b: Math.max(a, b), f: [] }));
        e.f.push(fi);
      }
    });
    const segs = [];
    for (const e of em.values()) {
      let draw;
      if (e.f.length === 1) draw = vis[e.f[0]];
      else {
        const f1 = e.f[0], f2 = e.f[1];
        draw = vis[f1] !== vis[f2] || (vis[f1] && dot(N[f1], N[f2]) < cosC);
      }
      if (draw) segs.push([e.a, e.b]);
    }
    this.chain(V, segs, w);
  }
  box(x0, y0, z0, x1, y1, z1, w = W2) {
    const C = [];
    for (let i = 0; i < 8; i++) C.push([i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0]);
    this.solid(C, [[0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6], [0, 4, 6, 2], [1, 3, 7, 5]], w);
  }
  /** extrude a 2D outline (local xy) from z0 to z1 */
  prism(prof, z0, z1, w = W2, crease = 30) {
    let area = 0;
    for (let i = 0; i < prof.length; i++) {
      const a = prof[i], b = prof[(i + 1) % prof.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const P = area < 0 ? prof.slice().reverse() : prof;
    const n = P.length;
    const V = [...P.map(([x, y]) => [x, y, z0]), ...P.map(([x, y]) => [x, y, z1])];
    const F = [[...Array(n).keys()].reverse(), [...Array(n).keys()].map((i) => i + n)];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      F.push([i, j, j + n, i + n]);
    }
    this.solid(V, F, w, crease);
  }
  /**
   * Surface of revolution about the local y axis. prof: [[r, y], …] walked bottom → top along the
   * outside. Draws the silhouette generators seen from the eye and the visible arcs of the rings at
   * creases (plus o.bands: extra ring indices). o.open: the top end is an open rim (inside visible).
   */
  lathe(prof, w = W2, o = {}) {
    const E = this.E;
    const n = o.n || 72;
    const Vh = Math.hypot(E[0], E[2]) || 1e-6;
    const phi = Math.atan2(E[2], E[0]);
    const P = prof, m = P.length;
    const cosC = Math.cos(((o.crease ?? 22) * PI) / 180);
    const N = [];
    for (let i = 0; i < m - 1; i++) {
      const dr = P[i + 1][0] - P[i][0], dy = P[i + 1][1] - P[i][1];
      const l = Math.hypot(dr, dy) || 1;
      N.push([dy / l, -dr / l]);
    }
    const front = (s, t, r, y) => N[s][0] * (Vh * Math.cos(t - phi) - r) + N[s][1] * (E[1] - y) > 1e-7;
    const ringW = o.ringW ?? w;
    for (let i = 0; i < m; i++) {
      const [r, y] = P[i];
      if (r < 1e-4) continue;
      const a = i > 0 ? i - 1 : -1, b = i < m - 1 ? i : -1;
      let crease = a < 0 || b < 0;
      if (!crease) crease = N[a][0] * N[b][0] + N[a][1] * N[b][1] < cosC;
      if (!crease && !(o.bands && o.bands.includes(i))) continue;
      const pts = [], ok = [];
      for (let k = 0; k < n; k++) {
        const t = (k / n) * TAU;
        pts.push([r * Math.cos(t), y, r * Math.sin(t)]);
        let v = (a >= 0 && front(a, t, r, y)) || (b >= 0 && front(b, t, r, y));
        if (b < 0 && o.open && E[1] > y) v = true;
        ok.push(v);
      }
      this.runs(pts, ok, i === 0 || i === m - 1 ? w : ringW, true);
    }
    if (o.noSil) return;
    for (const sg of [-1, 1]) {
      let cur = [];
      let lastT = null;
      for (let i = 0; i < m - 1; i++) {
        const [nr, ny] = N[i];
        const [r0, y0] = P[i], [r1, y1] = P[i + 1];
        let ok = false, t = 0;
        if (Math.abs(nr) > 1e-6) {
          const c = (nr * r0 - ny * (E[1] - y0)) / (nr * Vh);
          if (Math.abs(c) < 1) {
            ok = true;
            t = phi + sg * Math.acos(c);
          }
        }
        const smoothJoin = i > 0 && N[i - 1][0] * N[i][0] + N[i - 1][1] * N[i][1] >= cosC;
        if (ok && cur.length && smoothJoin && lastT !== null && Math.abs(t - lastT) < 0.6) {
          const tm = (t + lastT) / 2;
          cur[cur.length - 1] = [r0 * Math.cos(tm), y0, r0 * Math.sin(tm)];
          cur.push([r1 * Math.cos(t), y1, r1 * Math.sin(t)]);
        } else {
          if (cur.length > 1) this.line(cur, w);
          cur = ok ? [[r0 * Math.cos(t), y0, r0 * Math.sin(t)], [r1 * Math.cos(t), y1, r1 * Math.sin(t)]] : [];
        }
        lastT = ok ? t : null;
      }
      if (cur.length > 1) this.line(cur, w);
    }
  }
  /** vertical cylinder standing at (x, y0, z) */
  cyl(x, y0, z, r, h, w = W2, o = {}) {
    this.at(x, y0, z, 0, () => this.lathe([[0, 0], [r, 0], [r, h], [0, h]], w, o));
  }
  /** sphere outline as seen from the eye (+ optional visible latitude rings) */
  sphere(c, r, w = W2, o = {}) {
    const E = this.E;
    const d = sub(E, c), D = len(d);
    if (D <= r * 1.001) return;
    const k = (r * r) / (D * D);
    const cc = add(c, scl(d, k)), rho = r * Math.sqrt(1 - k);
    const nz = nrm(d);
    const ux = nrm(crs(Math.abs(nz[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], nz)), uy = crs(nz, ux);
    const n = o.n || clamp(Math.ceil((TAU * r) / 0.03), 16, 96);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      pts.push(add(cc, add(scl(ux, rho * Math.cos(a)), scl(uy, rho * Math.sin(a)))));
    }
    this.line(pts, w, true);
    const ring = (pp, ww) => {
      const ok = pp.map((p) => dot(sub(p, c), sub(E, p)) > 0);
      this.runs(pp, ok, ww, true);
    };
    for (const la of o.lats || []) {
      const pp = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        pp.push([c[0] + r * Math.cos(la) * Math.cos(a), c[1] + r * Math.sin(la), c[2] + r * Math.cos(la) * Math.sin(a)]);
      }
      ring(pp, o.ringW ?? W3);
    }
    for (const lo of o.longs || []) {
      const pp = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        pp.push([c[0] + r * Math.cos(a) * Math.cos(lo), c[1] + r * Math.sin(a), c[2] + r * Math.cos(a) * Math.sin(lo)]);
      }
      ring(pp, o.ringW ?? W3);
    }
  }
  finish(extra = {}) {
    // every open line starts at its end nearer the footprint (and lower), every loop at its
    // vertex nearest the footprint, so a draw-on from the origin reads as growth
    const key = (p, i) => Math.hypot(p[i], p[i + 2]) + 0.6 * p[i + 1];
    for (const L of this.lines) {
      const p = L.p, n = p.length / 3;
      let q = null;
      if (L.closed) {
        let best = 0, bk = Infinity;
        for (let i = 0; i < n; i++) {
          const k = key(p, i * 3);
          if (k < bk) {
            bk = k;
            best = i;
          }
        }
        if (best) {
          q = new Float32Array(p.length);
          for (let i = 0; i < n; i++) {
            const s = ((i + best) % n) * 3;
            q[i * 3] = p[s];
            q[i * 3 + 1] = p[s + 1];
            q[i * 3 + 2] = p[s + 2];
          }
        }
      } else if (key(p, (n - 1) * 3) < key(p, 0) - 1e-6) {
        q = new Float32Array(p.length);
        for (let i = 0; i < n; i++) {
          const s = (n - 1 - i) * 3;
          q[i * 3] = p[s];
          q[i * 3 + 1] = p[s + 1];
          q[i * 3 + 2] = p[s + 2];
        }
      }
      if (q) L.p = q;
    }
    const out = { name: this.name, lines: this.lines };
    if (this.dots.length) out.dots = new Float32Array(this.dots);
    return Object.assign(out, extra);
  }
}

function wirePts(a, b, s, n = 28) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = mix(a, b, t);
    p[1] -= 4 * s * t * (1 - t);
    out.push(p);
  }
  return out;
}

// ================================================================================================
// shared pieces

/** floor: tile joints in a grid, fading into the cut edge */
function floorGrid(d, x0, x1, z0, z1, sx, sz, w = W3, skip = null) {
  for (let z = Math.ceil(z0 / sz) * sz; z <= z1 - 1e-6; z += sz) {
    if (z <= z0 + 1e-6) continue;
    d.seg([x0, 0, z], [x1, 0, z], w);
  }
  for (let x = Math.ceil(x0 / sx) * sx; x <= x1 + 1e-6; x += sx) {
    if (skip && skip(x)) continue;
    d.seg([x, 0, z0], [x, 0, z1], w);
  }
}

/** a recessed wall opening on the wall plane z = zw (wall facing -z), depth t into +z */
function opening(d, x0, x1, y0, y1, zw, t, w = W1, wr = W2) {
  const E = d.E;
  const pts = [[x0, y0, zw], [x0, y1, zw], [x1, y1, zw], [x1, y0, zw]];
  if (y0 <= 0.001) d.line(pts, w);
  else d.line(pts, w, true);
  // reveal faces visible from the eye
  const zb = zw + t;
  if (E[0] < x1) d.line([[x1, y0, zw], [x1, y0, zb], [x1, y1, zb], [x1, y1, zw]], wr); // jamb facing -x
  if (E[0] > x0) d.line([[x0, y0, zw], [x0, y0, zb], [x0, y1, zb], [x0, y1, zw]], wr); // jamb facing +x
  if (E[1] < y1) d.seg([x0, y1, zb], [x1, y1, zb], wr); // soffit
  if (E[1] > y0 && y0 > 0.001) d.seg([x0, y0, zb], [x1, y0, zb], wr); // sill
}

/** Indian window: recessed frame, two casements, transom and a grille of vertical bars */
function grilleWindow(d, x0, x1, y0, y1, zw, o = {}) {
  const t = o.depth ?? 0.18;
  opening(d, x0, x1, y0, y1, zw, t, o.w ?? W1, W2);
  const zf = zw + t * 0.55;
  const f = 0.045;
  d.rxy(x0 + f, y0 + f, x1 - f, y1 - f, zf, W3);
  const yt = lerp(y0, y1, o.transom ?? 0.74);
  d.seg([x0 + f, yt, zf], [x1 - f, yt, zf], W2);
  d.seg([(x0 + x1) / 2, y0 + f, zf], [(x0 + x1) / 2, yt, zf], W3);
  // grille bars in front of the glass
  const zg = zw + t * 0.25;
  const nb = Math.max(3, Math.round((x1 - x0) / (o.bar ?? 0.12)));
  for (let i = 1; i < nb; i++) {
    const x = lerp(x0, x1, i / nb);
    d.seg([x, y0, zg], [x, y1, zg], W3);
  }
  if (o.cross !== false) {
    d.seg([x0, lerp(y0, y1, 0.36), zg], [x1, lerp(y0, y1, 0.36), zg], W3);
  }
  // projecting sill
  if (o.sill !== false && y0 > 0.2) {
    d.box(x0 - 0.06, y0 - 0.05, zw - 0.06, x1 + 0.06, y0, zw, W2);
  }
}

/** wall clock on the plane z (facing -z), hands at h:m */
function wallClock(d, x, y, z, r, h = 10.17, m = 8) {
  d.circle([x, y, z - 0.045], r, W1, 'xy', 64);
  d.circle([x, y, z - 0.045], r * 0.88, W3, 'xy', 64);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const r0 = i % 3 ? r * 0.78 : r * 0.7;
    d.seg([x + Math.sin(a) * r0, y + Math.cos(a) * r0, z - 0.046], [x + Math.sin(a) * r * 0.84, y + Math.cos(a) * r * 0.84, z - 0.046], W3);
  }
  const ah = (h / 12) * TAU, am = (m / 60) * TAU;
  d.line([[x - Math.sin(ah) * r * 0.1, y - Math.cos(ah) * r * 0.1, z - 0.05], [x + Math.sin(ah) * r * 0.48, y + Math.cos(ah) * r * 0.48, z - 0.05]], W2);
  d.line([[x - Math.sin(am) * r * 0.12, y - Math.cos(am) * r * 0.12, z - 0.05], [x + Math.sin(am) * r * 0.7, y + Math.cos(am) * r * 0.7, z - 0.05]], W2);
}

/** ceiling fan hanging from yTop; static part only (blades come from fanBlades in anim) */
function fanBody(d, x, z, yTop, drop = 0.42) {
  d.seg([x, yTop, z], [x, yTop - drop, z], W2);
  d.at(x, yTop - drop - 0.11, z, 0, () => {
    d.lathe([[0, 0], [0.07, 0.0], [0.115, 0.03], [0.12, 0.06], [0.09, 0.1], [0.03, 0.115], [0.03, 0.14]], W2, { n: 48 });
    d.lathe([[0, -0.02], [0.03, -0.02], [0.03, 0], [0, 0]], W3, { n: 24 });
  });
  d.lathe;
}
function fanBlades(d, x, z, y, ang, r = 0.62) {
  for (let i = 0; i < 3; i++) {
    const a = ang + (i / 3) * TAU;
    d.at(x, y, z, a, () => {
      d.line([[0.1, 0.0, -0.025], [r * 0.35, 0.01, -0.05], [r, 0.02, -0.052], [r + 0.02, 0.02, 0], [r, 0.02, 0.052], [r * 0.35, 0.01, 0.05], [0.1, 0, 0.025]], W2, true);
    });
  }
}

/** school backpack hanging from a hook at (x, y, z): body + front pocket + top loop */
function hangingBag(d, x, y, z, s = 1, ry = 0) {
  d.at(x, y, z, ry, () => {
    const bw = 0.3, bh = 0.38, bd = 0.13;
    d.prism(rrect2(-bw / 2, -bh - 0.06, bw / 2, -0.06, [0.05, 0.05, 0.11, 0.11], 5), 0.0, bd, W2);
    // front pocket on the face z = 0 (facing -z)
    const pk = rrect2(-0.11, -bh - 0.04, 0.11, -0.2, [0.03, 0.03, 0.05, 0.05], 4).map(([u, v]) => [u, v, -0.012]);
    d.line(pk, W3, true);
    d.seg([-0.09, -0.235, -0.014], [0.09, -0.235, -0.014], W3);
    // loop over the hook
    d.line(arcPts([0, -0.03, 0.06], 0.035, PI, 0, 'xy', 10), W3);
  }, s);
}

// ================================================================================================
// 1 · school corridor — an Indian school verandah: the corridor blackboard with chalk geometry,
//     the brass bell on its bracket, a classroom door open on a desk-bench, the clock above it,
//     bags on hooks, grille windows and a ceiling fan.
function school(seed) {
  const d = new Draw('school', seed, EYE_WALK);
  const ZW = 3.0, YC = 3.5;
  // floor + wall + ceiling edges
  d.seg([-7, 0, ZW], [9, 0, ZW], W1);
  d.seg([-7, YC, ZW], [9, YC, ZW], W1);
  for (const z of [-0.6, 0.6, 1.8]) d.seg([-7, 0, z], [9, 0, z], W3);
  for (let x = -6.6; x <= 8.5; x += 1.2) d.seg([x, 0, -0.6], [x, 0, ZW], W3);
  const DX0 = -1.45, DX1 = -0.25, DY = 2.15; // classroom door
  const band = (y) => {
    d.seg([-7, y, ZW - 0.002], [DX0, y, ZW - 0.002], W3);
    d.seg([DX1, y, ZW - 0.002], [9, y, ZW - 0.002], W3);
  };
  band(1.05); // painted dado
  band(0.12); // skirting
  // windows with grilles at both ends
  grilleWindow(d, 5.5, 7.1, 0.95, 2.3, ZW);
  grilleWindow(d, -5.7, -4.1, 0.95, 2.3, ZW);
  // ---- the corridor blackboard (hero)
  const b0 = 2.3, b1 = 4.95, by0 = 0.95, by1 = 2.22;
  d.box(b0, by0, ZW - 0.05, b1, by1, ZW, W1);
  d.rxy(b0 + 0.07, by0 + 0.07, b1 - 0.07, by1 - 0.07, ZW - 0.052, W3);
  d.box(b0 + 0.05, by0 - 0.035, ZW - 0.13, b1 - 0.05, by0 + 0.005, ZW - 0.05, W2); // chalk ledge
  d.box(b1 - 0.5, by0 + 0.005, ZW - 0.11, b1 - 0.28, by0 + 0.06, ZW - 0.06, W3); // duster
  d.seg([b0 + 0.4, by0 + 0.012, ZW - 0.09], [b0 + 0.48, by0 + 0.012, ZW - 0.08], W3); // chalk
  d.seg([b0 + 0.56, by0 + 0.012, ZW - 0.1], [b0 + 0.6, by0 + 0.012, ZW - 0.08], W3);
  const cz = ZW - 0.053;
  // chalk geometry: circle + inscribed triangle, Pythagoras' squares, a parabola on axes
  const cc = [2.95, 1.6];
  d.circle([cc[0], cc[1], cz], 0.36, W2, 'xy', 64);
  d.line([0, 1, 2].map((k) => [cc[0] + 0.36 * Math.cos(PI / 2 + (k * TAU) / 3), cc[1] + 0.36 * Math.sin(PI / 2 + (k * TAU) / 3), cz]), W3, true);
  d.seg([cc[0], cc[1], cz], [cc[0] + 0.36 * Math.cos(-PI / 6), cc[1] + 0.36 * Math.sin(-PI / 6), cz], W3);
  const A = [3.66, 1.4], B = [3.96, 1.4], C = [3.66, 1.625]; // a 3-4-5 triangle with its squares
  d.line([[...A, cz], [...B, cz], [...C, cz]], W2, true);
  d.rxy(A[0], A[1] - 0.3, B[0], A[1], cz, W3);
  d.rxy(A[0] - 0.225, A[1], A[0], C[1], cz, W3);
  const hx = (B[0] - C[0]), hy = (B[1] - C[1]); // square on the hypotenuse, outward
  d.line([[...C, cz], [C[0] - hy, C[1] + hx, cz], [B[0] - hy, B[1] + hx, cz], [...B, cz]], W3);
  d.line([[A[0] + 0.05, A[1], cz], [A[0] + 0.05, A[1] + 0.05, cz], [A[0], A[1] + 0.05, cz]], W3);
  const px = 4.5, py = 1.2;
  d.seg([px - 0.3, py, cz], [px + 0.32, py, cz], W3);
  d.seg([px, py - 0.12, cz], [px, py + 0.75, cz], W3);
  const par = [];
  for (let i = 0; i <= 24; i++) {
    const u = -0.26 + (0.52 * i) / 24;
    par.push([px + u, py + 0.08 + 7.5 * u * u, cz]);
  }
  d.line(par, W2);
  // tube light above the board
  d.box(3.0, 2.52, ZW - 0.07, 4.25, 2.56, ZW - 0.03, W2);
  d.seg([3.1, 2.54, ZW], [3.1, 2.54, ZW - 0.05], W3);
  d.seg([4.15, 2.54, ZW], [4.15, 2.54, ZW - 0.05], W3);
  // ---- the bell on a wrought-iron bracket
  const bx = 1.72, by = 2.92, bz = ZW - 0.16;
  d.rxy(bx - 0.46, by - 0.3, bx - 0.36, by + 0.06, ZW - 0.004, W3); // wall plate
  d.line([[bx - 0.36, by, ZW - 0.01], [bx - 0.36, by, bz], [bx, by, bz]], W2); // arm
  d.line([[bx - 0.36, by - 0.26, bz], [bx - 0.1, by, bz]], W3); // brace
  d.line(crPts([[bx - 0.36, by - 0.14, bz], [bx - 0.26, by - 0.08, bz], [bx - 0.2, by - 0.13, bz], [bx - 0.25, by - 0.18, bz], [bx - 0.3, by - 0.14, bz]], 5), W3); // scroll
  d.seg([bx, by, bz], [bx, by - 0.08, bz], W3);
  d.at(bx, by - 0.46, bz, 0, () => {
    d.lathe(
      [[0.0, 0.0], [0.155, 0.0], [0.15, 0.022], [0.125, 0.065], [0.103, 0.135], [0.095, 0.225], [0.087, 0.3], [0.062, 0.345], [0.0, 0.36]],
      W1,
      { n: 64, crease: 28 }
    );
    d.seg([0, 0.36, 0], [0, 0.38, 0], W2);
    d.sphere([0.012, 0.03, 0], 0.026, W3);
  });
  d.curve([[bx + 0.012, by - 0.44, bz], [bx + 0.03, by - 0.7, bz + 0.02], [bx + 0.02, by - 1.0, bz + 0.05], [bx + 0.05, by - 1.12, bz + 0.07]], W3, 6);
  // ---- classroom door (open inward) with a glimpse of the class
  opening(d, DX0, DX1, 0, DY, ZW, 0.22);
  d.at(DX0 + 0.02, 0, ZW + 0.22, -1.93, () => {
    d.box(0, 0.02, -0.02, DX1 - DX0 - 0.04, DY - 0.03, 0.02, W2);
    d.rxy(0.16, 1.25, DX1 - DX0 - 0.2, 1.95, -0.024, W3);
    d.rxy(0.16, 0.2, DX1 - DX0 - 0.2, 1.0, -0.024, W3);
  });
  wallClock(d, (DX0 + DX1) / 2, 2.72, ZW, 0.24);
  const ZB = 6.6;
  d.seg([-1.75, 0, ZB], [0.3, 0, ZB], W3);
  grilleWindow(d, -1.45, -0.25, 0.95, 2.05, ZB, { w: W2, sill: false });
  deskBench(d, -1.55, 4.65, 1.3);
  // ---- bags on hooks
  d.seg([-3.4, 1.52, ZW - 0.01], [-1.75, 1.52, ZW - 0.01], W2);
  [-3.1, -2.55, -2.0].forEach((hx, i) => {
    d.seg([hx, 1.52, ZW - 0.01], [hx, 1.48, ZW - 0.08], W3);
    hangingBag(d, hx, 1.5, ZW - 0.22, 1.25, 0);
  });
  // ceiling fan over the corridor
  const FX = -2.4, FZ = 1.5;
  fanBody(d, FX, FZ, YC);
  return d.finish({
    anim: (t) => {
      const a = new Draw('school.anim', 1, EYE_WALK);
      fanBlades(a, FX, FZ, YC - 0.42 - 0.11 + 0.05, t * 7.5);
      return a.lines;
    },
  });
}

/** Indian classroom desk-bench unit, seen from behind; x is its left end, z its bench line */
function deskBench(d, x, z, L) {
  // bench seat
  d.box(x, 0.4, z - 0.15, x + L, 0.44, z + 0.15, W2);
  // desk with a sloped top
  const zd0 = z + 0.32, zd1 = z + 0.75;
  d.solid(
    [[x, 0.68, zd0], [x + L, 0.68, zd0], [x + L, 0.76, zd1], [x, 0.76, zd1], [x, 0.72, zd0], [x + L, 0.72, zd0], [x + L, 0.8, zd1], [x, 0.8, zd1]],
    [[0, 1, 2, 3].reverse(), [4, 5, 6, 7], [0, 4, 5, 1].reverse(), [3, 2, 6, 7].reverse(), [0, 3, 7, 4].reverse(), [1, 5, 6, 2].reverse()],
    W2
  );
  d.seg([x + 0.02, 0.5, zd0 + 0.02], [x + L - 0.02, 0.5, zd0 + 0.02], W3); // book shelf
  // iron side frames
  for (const sx of [x + 0.04, x + L - 0.04]) {
    d.line([[sx, 0, z - 0.12], [sx, 0.4, z - 0.1]], W3);
    d.line([[sx, 0, z + 0.12], [sx, 0.4, z + 0.1]], W3);
    d.line([[sx, 0, zd0 + 0.05], [sx, 0.68, zd0 + 0.02]], W3);
    d.line([[sx, 0, zd1 - 0.05], [sx, 0.76, zd1 - 0.04]], W3);
    d.seg([sx, 0.08, z - 0.12], [sx, 0.08, zd1 - 0.05], W3);
  }
}

// ------------------------------------------------------------------------------------------------
// repeating patterns drawn as one continuous meander (bars + rails in a single stroke)
/** vertical bars between rails y0..y1 on the plane z, n bars from x0 to x1 */
function meanderV(x0, x1, y0, y1, z, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n);
    if (i % 2 === 0) out.push([x, y0, z], [x, y1, z]);
    else out.push([x, y1, z], [x, y0, z]);
  }
  return out;
}
/** horizontal slats between rails x0..x1 on the plane z, n slats from y0 to y1 */
function meanderH(x0, x1, y0, y1, z, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const y = lerp(y1, y0, i / n);
    if (i % 2 === 0) out.push([x0, y, z], [x1, y, z]);
    else out.push([x1, y, z], [x0, y, z]);
  }
  return out;
}

/** a canvas shop awning on the facade z = zf: sloped, striped, with a scalloped valance */
function awning(d, xa, xb, ya, yb, zf, depth, o = {}) {
  const zb = zf - depth;
  d.line([[xa, ya, zf], [xa, yb, zb], [xb, yb, zb], [xb, ya, zf]], W2);
  const st = o.stripe ?? 0.36;
  const ns = Math.max(2, Math.round((xb - xa) / st));
  for (let i = 1; i < ns; i++) {
    const x = lerp(xa, xb, i / ns);
    d.seg([x, ya, zf], [x, yb, zb], W3);
  }
  // scalloped valance
  const sw = o.scallop ?? 0.24, dep = o.dip ?? 0.09;
  const nsc = Math.max(2, Math.round((xb - xa) / sw));
  const val = [];
  for (let i = 0; i < nsc; i++) {
    const u0 = lerp(xa, xb, i / nsc), u1 = lerp(xa, xb, (i + 1) / nsc);
    for (let k = 0; k <= 8; k++) {
      if (i > 0 && k === 0) continue;
      const t = k / 8;
      val.push([lerp(u0, u1, t), yb - 0.06 - dep * Math.sin(PI * t), zb]);
    }
  }
  d.line([[xa, yb, zb], ...val, [xb, yb, zb]], W2);
}

/** rolling shutter in an opening x0..x1, rolled down to yb (box at y1) on the facade z */
function shutter(d, x0, x1, yb, y1, z, w = W3) {
  d.box(x0 - 0.06, y1, z - 0.16, x1 + 0.06, y1 + 0.2, z, W2);
  if (yb < y1 - 0.05) {
    const n = Math.max(2, Math.round((y1 - yb) / 0.075));
    d.line(meanderH(x0 + 0.02, x1 - 0.02, yb, y1, z - 0.04, n), w);
    d.seg([x0, yb, z - 0.05], [x1, yb, z - 0.05], W2);
  }
}

/** the kaali-peeli: a Premier Padmini taxi, front toward -x, near side facing the camera */
function taxi(d, X, Z, s = 1) {
  d.at(X, 0, Z, 0, () => {
    const zn = -0.72, zg = -0.64;
    // near-side body panel: front corner, belt line, rear corner, sill with both wheel arches
    const top = crPts([[-1.9, 0.43], [-1.935, 0.62], [-1.9, 0.79], [-1.76, 0.85], [-1.2, 0.885], [-0.6, 0.935], [0.4, 0.955], [1.5, 0.965], [1.85, 0.94], [1.925, 0.85], [1.945, 0.62], [1.915, 0.44]], 5);
    const archR = arcPts([1.17, 0.29, 0], 0.37, 0, PI, 'xy', 20).map((p) => [p[0], p[1]]);
    const archF = arcPts([-1.17, 0.29, 0], 0.37, 0, PI, 'xy', 20).map((p) => [p[0], p[1]]);
    const panel = [...top, [1.62, 0.33], ...archR, [0.78, 0.31], [-0.78, 0.31], ...archF, [-1.62, 0.33], [-1.82, 0.38]];
    d.line(panel.map(([x, y]) => [x, y, zn]), W1, true);
    d.seg([-1.82, 0.72, zn - 0.005], [1.86, 0.735, zn - 0.005], W3); // chrome strip
    // doors
    d.seg([-0.62, 0.34, zn], [-0.6, 0.93, zn], W3);
    d.seg([0.44, 0.31, zn], [0.44, 0.955, zn], W3);
    d.seg([1.34, 0.67, zn], [1.36, 0.962, zn], W3);
    d.seg([0.22, 0.87, zn - 0.01], [0.34, 0.87, zn - 0.01], W3);
    d.seg([1.12, 0.875, zn - 0.01], [1.24, 0.875, zn - 0.01], W3);
    // greenhouse (near side, tumblehome) and its windows
    d.line(crPts([[-0.58, 0.955], [-0.44, 1.2], [-0.26, 1.42], [0.3, 1.47], [0.95, 1.45], [1.22, 1.24], [1.45, 0.97]], 5).map(([x, y]) => [x, y, zg]), W1);
    d.line([[-0.48, 0.99], [-0.25, 1.38], [0.38, 1.41], [0.38, 0.99]].map(([x, y]) => [x, y, zg - 0.005]), W2, true);
    d.seg([-0.29, 0.99, zg - 0.005], [-0.29, 1.21, zg - 0.005], W3);
    d.line([[0.46, 0.99], [0.46, 1.41], [0.9, 1.41], [1.3, 1.0]].map(([x, y]) => [x, y, zg - 0.005]), W2, true);
    d.seg([-0.6, 0.97, zg], [1.52, 0.98, zg], W3);
    // windscreen
    const bow = (x0, y, zh, b) => {
      const o = [];
      for (let i = 0; i <= 12; i++) {
        const z = -zh + (2 * zh * i) / 12;
        o.push([x0 - b * (1 - (z / zh) ** 2), y, z]);
      }
      return o;
    };
    d.line(bow(-0.58, 0.955, 0.64, 0.05), W2);
    d.line(bow(-0.26, 1.42, 0.58, 0.03), W1);
    d.seg([-0.58, 0.955, 0.64], [-0.26, 1.42, 0.58], W2);
    d.seg([-0.62, 0.965, -0.3], [-0.5, 1.07, -0.12], W3); // wipers
    d.seg([-0.62, 0.965, 0.15], [-0.5, 1.07, 0.33], W3);
    // bonnet: far edge, front edge, centre chrome strip
    d.curve([[-1.86, 0.835, 0.7], [-1.2, 0.88, 0.71], [-0.6, 0.93, 0.7]], W2, 6);
    d.line(bow(-1.88, 0.0, 0.68, -0.02).map(([x, , z]) => [x, 0.835 + 0.03 * (1 - (z / 0.68) ** 2), z]), W1);
    d.seg([-1.84, 0.865, 0], [-0.64, 0.975, 0], W3);
    // nose: far front corner, headlamps, grille, indicators
    d.curve([[-1.9, 0.83, 0.68], [-1.94, 0.62, 0.69], [-1.91, 0.44, 0.68]], W2, 5);
    for (const z of [-0.5, 0.5]) {
      d.circle([-1.945, 0.645, z], 0.085, W2, 'zy', 28);
      d.circle([-1.94, 0.645, z], 0.108, W3, 'zy', 28);
      d.circle([-1.94, 0.5, z * 1.03], 0.032, W3, 'zy', 12);
    }
    d.line(rrect2(-0.32, 0.5, 0.32, 0.73, 0.06, 4).map(([z, y]) => [-1.946, y, z]), W2, true);
    for (const y of [0.565, 0.615, 0.665]) d.seg([-1.947, y, -0.3], [-1.947, y, 0.3], W3);
    // bumpers + overriders
    d.box(-1.995, 0.355, -0.75, -1.93, 0.445, 0.75, W2);
    d.box(-1.93, 0.355, -0.77, -1.7, 0.445, -0.715, W3);
    for (const z of [-0.3, 0.3]) d.box(-2.025, 0.3, z - 0.03, -1.985, 0.585, z + 0.03, W3);
    d.box(1.93, 0.37, -0.75, 1.995, 0.46, 0.75, W2);
    d.box(1.7, 0.37, -0.77, 1.93, 0.46, -0.715, W3);
    // boot top far edge
    d.curve([[1.52, 0.98, 0.7], [1.85, 0.95, 0.7], [1.92, 0.88, 0.69]], W3, 5);
    // wheels
    for (const x of [-1.17, 1.17]) {
      d.circle([x, 0.29, zn + 0.01], 0.29, W1, 'xy', 48);
      d.circle([x, 0.29, zn + 0.0], 0.185, W3, 'xy', 36);
      d.circle([x, 0.29, zn - 0.01], 0.11, W2, 'xy', 24);
    }
    // fender mirror
    d.seg([-1.25, 0.875, zn + 0.02], [-1.25, 0.99, zn - 0.04], W3);
    d.circle([-1.25, 1.02, zn - 0.045], 0.04, W3, 'xy', 14);
    // roof carrier
    for (const z of [-0.52, 0.52]) {
      d.seg([-0.18, 1.56, z], [0.98, 1.56, z], W2);
      d.seg([-0.12, 1.44, z], [-0.12, 1.56, z], W3);
      d.seg([0.9, 1.45, z], [0.9, 1.56, z], W3);
    }
    for (const x of [-0.12, 0.39, 0.9]) d.seg([x, 1.56, -0.52], [x, 1.56, 0.52], W3);
  }, s);
}

/** Mumbai street lamp: tapered pole, swan-neck arm reaching over the road (-z) */
function streetLamp(d, x, z, h = 3.25, reach = 0.85) {
  d.at(x, 0, z, 0, () => {
    d.lathe([[0, 0], [0.13, 0], [0.13, 0.32], [0.085, 0.4], [0.075, 0.42], [0.05, h], [0, h]], W2, { n: 40 });
    const arm = crPts([[0, h - 0.05, 0], [0, h + 0.18, -0.08], [0, h + 0.26, -0.35], [0, h + 0.2, -reach + 0.12], [0, h + 0.12, -reach]], 6);
    d.line(arm, W2);
    d.at(0, h - 0.02, -reach, 0, () => {
      d.lathe([[0.0, 0.0], [0.07, 0.0], [0.19, 0.06], [0.2, 0.08], [0.12, 0.14], [0.03, 0.16], [0.0, 0.16]], W2, { n: 48 });
    });
  });
}

// ================================================================================================
// 2 · Mumbai street — a kaali-peeli Padmini at the kerb, shopfronts with striped awnings and
//     rolling shutters, balconies with grilles, a gully behind the walker with laundry across it,
//     a lamp post, a utility pole and the tangle of overhead wires.
function street(seed) {
  const d = new Draw('street', seed, EYE_WALK);
  // footpath joints, kerbs
  d.seg([-7, 0, -0.5], [9, 0, -0.5], W3);
  for (let x = -6.4; x <= 8.8; x += 1.6) d.seg([x, 0, -0.9], [x, 0, 0.4], W3);
  d.box(-7, 0, 0.4, 9, 0.15, 0.58, W2); // near kerb
  for (let x = -6.1; x <= 8.8; x += 0.9) d.seg([x, 0, 0.4], [x, 0.15, 0.4], W3);
  d.box(-7, 0, 2.3, 9, 0.15, 2.45, W3); // far kerb
  const GF = 2.3; // shop openings
  const balcony = (x0, x1, z, slab) => {
    d.box(x0, slab, z - 0.6, x1, slab + 0.1, z, W2);
    const zr = z - 0.58, y0 = slab + 0.1, y1 = slab + 0.95;
    d.seg([x0 + 0.05, y1, zr], [x1 - 0.05, y1, zr], W2);
    d.seg([x0 + 0.05, y0 + 0.08, zr], [x1 - 0.05, y0 + 0.08, zr], W3);
    const np = Math.round((x1 - x0) / 1.4);
    for (let i = 0; i <= np; i++) {
      const x = lerp(x0 + 0.05, x1 - 0.05, i / np);
      d.seg([x, y0, zr], [x, y1, zr], W3);
    }
    // the art-deco grille: a run of rings between the rails
    for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.42) d.circle([x, (y0 + y1) / 2 + 0.04, zr - 0.004], 0.15, W3, 'xy', 20);
    // windows behind the balcony
    for (let x = x0 + 0.5; x < x1 - 1.2; x += 1.7) d.rxy(x, y0 + 0.05, x + 1.0, y0 + 1.0, z, W3);
  };
  // ---------------- building A (behind the walker, screen right)
  const ZA = 3.2, AX1 = -0.1;
  d.seg([-7, 0, ZA], [AX1, 0, ZA], W1);
  d.seg([AX1, 0, ZA], [AX1, 4.5, ZA], W1);
  opening(d, -3.9, -0.6, 0, GF, ZA, 0.12, W2, W3);
  shutter(d, -3.9, -0.6, 1.45, GF, ZA);
  d.box(-3.6, 0, ZA + 0.55, -1.1, 0.92, ZA + 0.95, W3);
  awning(d, -4.05, -0.45, 2.62, 2.25, ZA, 0.6);
  d.rxy(-3.7, 2.68, -0.8, 2.9, ZA - 0.01, W3);
  opening(d, -7, -4.4, 0, GF, ZA, 0.12, W2, W3);
  shutter(d, -7, -4.4, 0.0, GF, ZA);
  balcony(-6.4, -0.45, ZA, 3.0);
  // ---------------- building B (ahead, screen left)
  const ZB = 3.0, BX0 = 1.1;
  d.seg([BX0, 0, ZB], [9, 0, ZB], W1);
  d.seg([BX0, 0, ZB], [BX0, 4.5, ZB], W1);
  opening(d, 1.45, 6.85, 0, GF, ZB, 0.12, W2, W3);
  shutter(d, 1.45, 6.85, GF, GF, ZB);
  for (const y of [1.65, 2.0]) d.seg([1.6, y, ZB + 0.7], [6.7, y, ZB + 0.7], W3);
  for (const [x, y, w, h] of [[1.8, 1.65, 0.3, 0.22], [2.3, 1.65, 0.22, 0.28], [3.9, 1.65, 0.34, 0.2], [4.4, 1.65, 0.2, 0.26], [5.6, 1.65, 0.3, 0.24], [2.0, 2.0, 0.4, 0.2], [3.3, 2.0, 0.26, 0.24], [5.2, 2.0, 0.36, 0.2]]) d.rxy(x, y, x + w, y + h, ZB + 0.68, W3);
  awning(d, 1.3, 7.0, 2.62, 2.25, ZB, 0.6);
  d.rxy(1.5, 2.68, 6.8, 2.9, ZB - 0.01, W3);
  d.box(6.85, 0, ZB - 0.08, 7.2, 2.95, ZB, W2);
  opening(d, 7.2, 9, 0, GF, ZB, 0.12, W2, W3);
  shutter(d, 7.2, 9, 0.85, GF, ZB);
  balcony(1.25, 8.4, ZB, 2.98);
  // ---------------- the gully behind the walker
  d.seg([AX1, 0, ZA], [AX1, 0, 7], W2);
  d.seg([BX0, 0, ZB], [BX0, 0, 7], W2);
  d.seg([AX1, 3.0, ZA], [AX1, 3.0, 7], W3);
  d.seg([BX0, 2.98, ZB], [BX0, 2.98, 7], W3);
  d.seg([AX1, 0, 7], [BX0, 0, 7], W3);
  const lw = [[AX1, 2.75, 4.7], [BX0, 2.8, 4.3]];
  d.wire(lw[0], lw[1], 0.1, W3, 16);
  const onLine = (t) => {
    const p = mix(lw[0], lw[1], t);
    p[1] -= 4 * 0.1 * t * (1 - t);
    return p;
  };
  // a shirt and a long dupatta drying on the line
  {
    const a = onLine(0.2), z = a[2] + 0.01, x = a[0], y = a[1];
    d.line([[x - 0.05, y, z], [x - 0.12, y - 0.04, z], [x - 0.2, y - 0.16, z], [x - 0.14, y - 0.2, z], [x - 0.1, y - 0.15, z], [x - 0.1, y - 0.55, z], [x + 0.2, y - 0.55, z], [x + 0.2, y - 0.15, z], [x + 0.24, y - 0.2, z], [x + 0.3, y - 0.16, z], [x + 0.22, y - 0.04, z], [x + 0.15, y, z]], W3);
    const b = onLine(0.62), c = onLine(0.86);
    d.line(crPts([b, [b[0] + 0.02, b[1] - 0.45, b[2] + 0.01], [b[0] + 0.06, b[1] - 0.95, b[2] + 0.01], [b[0] + 0.03, b[1] - 1.05, b[2] + 0.01]], 6), W3);
    d.line(crPts([c, [c[0] - 0.01, c[1] - 0.4, c[2] + 0.01], [c[0] + 0.01, c[1] - 0.82, c[2] + 0.01], [c[0] + 0.03, c[1] - 0.95, c[2] + 0.01]], 6), W3);
    d.seg([b[0] + 0.03, b[1] - 1.05, b[2] + 0.01], [c[0] + 0.03, c[1] - 0.95, c[2] + 0.01], W3);
  }
  // ---------------- the taxi
  taxi(d, 3.1, 1.45);
  // ---------------- lamp post, utility pole, the tangle of wires
  const LX = -2.55, LZ = 2.5;
  streetLamp(d, LX, LZ, 2.95, 0.75);
  const lampTop = [LX, 3.18, LZ - 0.05];
  const PX = 6.0, PZ = 0.48; // utility pole on the near kerb, framing the left edge
  d.at(PX, 0, PZ, 0, () => d.lathe([[0, 0], [0.12, 0], [0.09, 4.5], [0, 4.5]], W1, { n: 36 }));
  d.box(PX - 0.13, 2.2, PZ + 0.1, PX + 0.13, 2.6, PZ + 0.26, W3); // junction box
  d.wire([PX - 0.05, 2.3, PZ + 0.26], [PX - 0.9, 2.5, ZB - 0.02], 0.2, W3, 14);
  for (const y of [2.68, 2.74, 2.8]) d.seg([PX - 0.15, y, PZ], [PX + 0.15, y, PZ], W3); // cable clamps
  const A = [[PX, 3.3, PZ - 0.12], [PX, 3.18, PZ + 0.1], [PX, 3.05, PZ + 0.12], [PX, 2.95, PZ - 0.1]];
  // long spans along the street, sagging through the clear sky over the gully
  d.wire(A[0], lampTop, 0.7, W2, 60);
  d.wire(A[1], [-7, 3.62, 2.75], 1.0, W3, 64);
  d.wire(A[2], [-7, 3.4, 3.0], 1.15, W3, 64);
  d.wire(A[3], [AX1 - 0.05, 2.98, ZA - 0.6], 0.42, W3, 40);
  d.wire(lampTop, [-7, 3.25, 2.2], 0.25, W3, 24);
  d.wire(A[0], [9, 3.6, 0.9], 0.3, W3, 16);
  d.wire(A[2], [9, 3.3, 1.2], 0.25, W3, 16);
  // drops to the buildings and wires swinging toward the camera out of the top of the frame
  d.wire(A[1], [BX0 + 0.05, 3.08, ZB - 0.6], 0.3, W3, 28);
  d.wire(A[2], [3.4, 3.08, ZB - 0.6], 0.16, W3, 20);
  d.wire(lampTop, [-5.6, 3.05, ZA - 0.6], 0.14, W3, 20);
  d.wire(lampTop, [0.4, 4.5, -0.3], 0.5, W3, 36);
  d.wire([BX0 + 0.05, 3.08, ZB - 0.6], [-1.6, 4.5, -0.3], 0.55, W3, 36);
  return d.finish();
}

// ================================================================================================
// 3 · kitchen — a granite platform along the wall: the two-burner stove with the pressure cooker
//     (steam from its whistle) and a kadhai, the LPG cylinder beneath, steel utensils on a rail,
//     the tava on its nail, spice tins on a shelf, a clay matka, the window grille, a plate rack.
function kitchen(seed) {
  const d = new Draw('kitchen', seed, EYE_WALK);
  const ZW = 1.75, YC = 3.0, CT = 0.86, ZF = ZW - 0.62; // wall, ceiling, counter top, counter front
  d.seg([-7, 0, ZW], [9, 0, ZW], W1);
  d.seg([-7, YC, ZW], [9, YC, ZW], W1);
  for (const z of [-0.6, 0.0, 0.6]) d.seg([-7, 0, z], [9, 0, z], W3);
  for (let x = -6.6; x <= 8.5; x += 0.6) d.seg([x, 0, -0.6], [x, 0, ZF], W3);
  // the platform: granite slab, open shelf below on brick partitions
  d.box(-5.2, CT - 0.035, ZF - 0.03, 6.2, CT, ZW, W1);
  for (const x of [-5.2, -2.9, -0.9, 2.35, 4.2]) d.box(x, 0, ZF + 0.04, x + 0.09, CT - 0.035, ZW, W3);
  d.box(-5.15, 0.4, ZF + 0.08, 6.15, 0.43, ZW, W3);
  d.seg([-7, 0.0, ZF + 0.04], [9, 0.0, ZF + 0.04], W3);
  // steel vessels stacked on the open shelf
  const pot = (x, y, z, r, h) => d.at(x, y, z, 0, () => d.lathe([[0, 0], [r * 0.9, 0], [r, h * 0.2], [r, h * 0.85], [r * 0.97, h], [r * 1.04, h], [r * 1.04, h * 1.05]], W3, { n: 40, open: true }));
  pot(-4.6, 0.43, ZF + 0.4, 0.17, 0.2);
  pot(-4.6, 0.64, ZF + 0.4, 0.14, 0.17);
  pot(-4.1, 0.43, ZF + 0.4, 0.13, 0.15);
  pot(-2.4, 0.43, ZF + 0.4, 0.16, 0.22);
  pot(-1.9, 0.43, ZF + 0.42, 0.12, 0.14);
  pot(3.0, 0.43, ZF + 0.4, 0.15, 0.2);
  pot(3.45, 0.43, ZF + 0.42, 0.11, 0.13);
  // ---- the stove + pressure cooker (hero)
  const SX = 1.15, SZ = ZF + 0.04, sw = 0.86, sd = 0.44, sh = 0.11;
  d.box(SX, CT, SZ, SX + sw, CT + sh, SZ + sd, W1);
  for (const kx of [SX + 0.16, SX + sw - 0.16]) d.circle([kx, CT + 0.05, SZ - 0.012], 0.024, W2, 'xy', 16);
  const burner = (cx) => {
    const cz = SZ + sd * 0.55, y = CT + sh;
    d.cyl(cx, y, cz, 0.05, 0.025, W3, { n: 24 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + PI / 4;
      d.line([[cx + Math.cos(a) * 0.07, y, cz + Math.sin(a) * 0.07], [cx + Math.cos(a) * 0.07, y + 0.035, cz + Math.sin(a) * 0.07], [cx + Math.cos(a) * 0.15, y + 0.035, cz + Math.sin(a) * 0.15], [cx + Math.cos(a) * 0.15, y, cz + Math.sin(a) * 0.15]], W3);
    }
    return [cx, y + 0.035, cz];
  };
  const B1 = burner(SX + 0.22), B2 = burner(SX + sw - 0.22);
  // the pressure cooker: body, lid, long handle, whistle
  const PC = B1;
  d.at(PC[0], PC[1], PC[2], 0, () => {
    d.lathe([[0, 0], [0.14, 0], [0.16, 0.02], [0.163, 0.26], [0.153, 0.266], [0.153, 0.28], [0.075, 0.305], [0.03, 0.312], [0.0, 0.312]], W1, { n: 64, crease: 26 });
    d.lathe([[0, 0.312], [0.014, 0.312], [0.014, 0.35], [0.03, 0.35], [0.03, 0.4], [0.02, 0.425], [0, 0.43]], W2, { n: 24, crease: 30 });
  });
  d.box(PC[0] + 0.15, PC[1] + 0.225, PC[2] - 0.026, PC[0] + 0.53, PC[1] + 0.265, PC[2] + 0.026, W1); // handle
  d.box(PC[0] - 0.24, PC[1] + 0.23, PC[2] - 0.024, PC[0] - 0.155, PC[1] + 0.26, PC[2] + 0.024, W2); // helper handle
  const whistle = [PC[0], PC[1] + 0.43, PC[2]];
  // kadhai on the second burner
  d.at(B2[0], B2[1], B2[2], 0, () => {
    const prof = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * (PI / 2);
      prof.push([0.2 * Math.sin(a), 0.13 * (1 - Math.cos(a))]);
    }
    d.lathe(prof, W2, { n: 56, open: true });
  });
  for (const sx of [-1, 1]) d.arc([B2[0] + sx * 0.23, B2[1] + 0.12, B2[2]], 0.045, sx > 0 ? -PI / 2 : PI / 2, sx > 0 ? PI / 2 : PI * 1.5, W3, 'xy', 10);
  // LPG cylinder under the stove and its hose
  d.at(SX + 0.36, 0, ZF + 0.36, 0, () => {
    d.lathe([[0, 0], [0.13, 0], [0.13, 0.06], [0.155, 0.08], [0.16, 0.13], [0.16, 0.5], [0.15, 0.56], [0.11, 0.6], [0.05, 0.62], [0, 0.62]], W2, { n: 56, crease: 24 });
    d.lathe([[0.075, 0.6], [0.08, 0.66], [0.085, 0.72], [0.07, 0.72]], W3, { n: 32, open: true });
    d.box(-0.03, 0.62, -0.03, 0.03, 0.7, 0.03, W3);
  });
  d.curve([[SX + 0.36, 0.7, ZF + 0.33], [SX + 0.5, 0.78, ZF + 0.1], [SX + 0.82, 0.8, ZF - 0.05], [SX + 0.8, CT + 0.02, ZF + 0.08], [SX + sw - 0.01, CT + 0.05, SZ + 0.2]], W3, 6);
  // ---- window with grille above the platform, exhaust fan beside it
  grilleWindow(d, 2.55, 3.95, 1.2, 2.35, ZW, { depth: 0.16, sill: false });
  d.circle([4.62, 2.25, ZW - 0.01], 0.2, W2, 'xy', 48);
  d.circle([4.62, 2.25, ZW - 0.015], 0.04, W3, 'xy', 16);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    d.curve([[4.62 + Math.cos(a) * 0.05, 2.25 + Math.sin(a) * 0.05, ZW - 0.014], [4.62 + Math.cos(a + 0.5) * 0.12, 2.25 + Math.sin(a + 0.5) * 0.12, ZW - 0.014], [4.62 + Math.cos(a + 0.75) * 0.18, 2.25 + Math.sin(a + 0.75) * 0.18, ZW - 0.014]], W3, 4);
  }
  d.box(2.6, 2.62, ZW - 0.06, 3.9, 2.66, ZW - 0.02, W2); // tube light
  // ---- steel utensils on a rail (behind the walker, screen left)
  const RY = 1.62, RZ = ZW - 0.05;
  d.seg([-2.75, RY, RZ], [-0.95, RY, RZ], W2);
  for (const x of [-2.7, -1.0]) d.seg([x, RY, RZ], [x, RY, ZW], W3);
  const hook = (x) => d.line(arcPts([x, RY - 0.025, RZ], 0.025, PI / 2, PI * 2.2, 'xy', 8), W3);
  const zu = RZ + 0.01;
  // ladle
  hook(-2.5);
  d.seg([-2.5, RY - 0.05, zu], [-2.5, RY - 0.44, zu], W2);
  d.line([...arcPts([-2.5, RY - 0.47, zu], 0.05, PI, TAU, 'xy', 12), [-2.9, RY - 0.47, zu], [-3.0, RY - 0.47, zu]], W2);
  // slotted spoon
  hook(-2.18);
  d.seg([-2.18, RY - 0.05, zu], [-2.18, RY - 0.38, zu], W2);
  d.circle([-2.18, RY - 0.445, zu], 0.065, W2, 'xy', 24);
  for (const [dx, dy] of [[0, 0], [0.03, 0.02], [-0.03, 0.02], [0.03, -0.02], [-0.03, -0.02]]) d.circle([-2.18 + dx, RY - 0.445 + dy, zu - 0.002], 0.006, W3, 'xy', 6);
  // tongs
  hook(-1.85);
  d.line([[-1.88, RY - 0.05, zu], [-1.9, RY - 0.52, zu]], W2);
  d.line([[-1.82, RY - 0.05, zu], [-1.79, RY - 0.52, zu]], W2);
  d.circle([-1.85, RY - 0.06, zu], 0.025, W3, 'xy', 10);
  // strainer
  hook(-1.5);
  d.seg([-1.5, RY - 0.05, zu], [-1.5, RY - 0.24, zu], W2);
  d.circle([-1.5, RY - 0.34, zu], 0.1, W2, 'xy', 36);
  d.circle([-1.5, RY - 0.34, zu], 0.075, W3, 'xy', 28);
  // small saucepan
  hook(-1.12);
  d.seg([-1.12, RY - 0.05, zu], [-1.12, RY - 0.24, zu], W2);
  d.circle([-1.12, RY - 0.38, zu], 0.13, W2, 'xy', 40);
  d.circle([-1.12, RY - 0.38, zu], 0.105, W3, 'xy', 36);
  // the tava on its nail
  d.circle([-3.2, 1.45, ZW - 0.02], 0.17, W1, 'xy', 48);
  d.circle([-3.2, 1.45, ZW - 0.022], 0.14, W3, 'xy', 44);
  d.line([[-3.2, 1.62, ZW - 0.02], [-3.2, 1.86, ZW - 0.02], [-3.18, 1.88, ZW - 0.02], [-3.16, 1.86, ZW - 0.02], [-3.16, 1.62, ZW - 0.02]], W2);
  // ---- spice tins on a shelf above the platform
  d.box(-0.75, 1.86, ZW - 0.22, 1.35, 1.89, ZW, W2);
  [[-0.6, 0.06, 0.15], [-0.42, 0.06, 0.15], [-0.24, 0.06, 0.15], [-0.02, 0.075, 0.2], [0.2, 0.075, 0.2], [0.45, 0.055, 0.12], [0.62, 0.055, 0.12], [0.86, 0.065, 0.22], [1.1, 0.065, 0.17]].forEach(([x, r, h]) => {
    d.at(x, 1.89, ZW - 0.11, 0, () => d.lathe([[0, 0], [r, 0], [r, h], [r * 1.05, h], [r * 1.05, h + 0.025], [0, h + 0.028]], W3, { n: 28, crease: 30 }));
  });
  // ---- the clay matka on its ring, steel plates on a rack
  d.at(4.72, CT, ZF + 0.3, 0, () => {
    d.lathe([[0, 0], [0.11, 0.0], [0.12, 0.03], [0.1, 0.06], [0.0, 0.06]], W3, { n: 40 });
    d.lathe([[0, 0.04], [0.1, 0.05], [0.19, 0.13], [0.22, 0.24], [0.2, 0.34], [0.13, 0.42], [0.085, 0.45], [0.085, 0.48], [0.11, 0.5]], W2, { n: 56, open: true, crease: 35 });
  });
  d.box(5.0, 1.15, ZW - 0.2, 6.0, 1.18, ZW, W3);
  for (let i = 0; i < 4; i++) {
    const x = 5.18 + i * 0.22;
    d.circle([x, 1.36, ZW - 0.09 + i * 0.012], 0.17, W2, 'xy', 40);
    d.circle([x, 1.36, ZW - 0.092 + i * 0.012], 0.12, W3, 'xy', 32);
  }
  return d.finish({
    anim: (t) => {
      const a = new Draw('kitchen.anim', 1, EYE_WALK);
      // steam: soft wisps curling up from the whistle
      for (let k = 0; k < 4; k++) {
        const ph = (t * 0.9 + k * 0.25) % 1;
        const pts = [];
        for (let i = 0; i <= 14; i++) {
          const u = i / 14;
          const h = (0.06 + 0.9 * ph) * u;
          const sway = Math.sin(u * 5.5 + t * 3 + k * 1.7) * 0.05 * u * (0.4 + ph) + (k - 1.5) * 0.02 * u;
          pts.push([whistle[0] + sway, whistle[1] + 0.01 + h, whistle[2] + Math.cos(u * 4 + k) * 0.02 * u]);
        }
        a.line(pts, ph < 0.75 ? W2 : W3);
      }
      return a.lines;
    },
  });
}


// ================================================================================================
// 4 · hospital — a ward bay: the bed with its raised back and rails (hero), a drip on its stand,
//     a monitor with a pulse, the curtain on its ceiling track, a window with blinds.
function hospital(seed) {
  const d = new Draw('hospital', seed, EYE_WALK);
  const ZW = 3.3, YC = 3.2;
  d.seg([-7, 0, ZW], [9, 0, ZW], W1);
  d.seg([-7, YC, ZW], [9, YC, ZW], W1);
  floorGrid(d, -7, 9, -0.6, ZW, 0.6, 0.6, W3);
  d.seg([-7, 0.1, ZW - 0.002], [9, 0.1, ZW - 0.002], W3);
  // window with blinds
  opening(d, 4.6, 6.6, 0.9, 2.5, ZW, 0.16);
  for (let y = 1.0; y < 2.45; y += 0.07) d.seg([4.66, y, ZW + 0.05], [6.54, y, ZW + 0.05], W3);
  // ---- the bed (hero): frame, mattress, raised back, rails, wheels
  const X0 = 1.0, X1 = 3.15, Z0 = 1.35, Z1 = 2.3, H = 0.62;
  d.box(X0, H - 0.08, Z0, X1, H, Z1, W2); // frame
  d.box(X0 + 0.55, H, Z0 + 0.03, X1 - 0.02, H + 0.14, Z1 - 0.03, W1); // mattress (flat part)
  // raised back section
  d.solid(
    [[X0 + 0.02, H, Z0 + 0.03], [X0 + 0.55, H, Z0 + 0.03], [X0 + 0.55, H, Z1 - 0.03], [X0 + 0.02, H, Z1 - 0.03],
     [X0 - 0.12, H + 0.62, Z0 + 0.03], [X0 + 0.0, H + 0.68, Z0 + 0.03], [X0 + 0.0, H + 0.68, Z1 - 0.03], [X0 - 0.12, H + 0.62, Z1 - 0.03]],
    [[0, 1, 2, 3].reverse(), [4, 5, 6, 7], [0, 4, 5, 1].reverse(), [3, 2, 6, 7].reverse(), [0, 3, 7, 4].reverse(), [1, 5, 6, 2].reverse()],
    W1
  );
  d.curve([[X0 + 0.05, H + 0.62, Z0 + 0.2], [X0 + 0.0, H + 0.74, (Z0 + Z1) / 2], [X0 + 0.05, H + 0.62, Z1 - 0.2]], W2, 8); // pillow
  // head and foot boards
  d.box(X0 - 0.22, 0.2, Z0, X0 - 0.17, H + 0.55, Z1, W2);
  d.box(X1 + 0.02, 0.2, Z0, X1 + 0.07, H + 0.38, Z1, W2);
  // side rail (near side) — a tube with uprights
  d.line([[X0 + 0.25, H + 0.42, Z0 - 0.04], [X1 - 0.35, H + 0.42, Z0 - 0.04]], W2);
  d.line([[X0 + 0.25, H + 0.3, Z0 - 0.04], [X1 - 0.35, H + 0.3, Z0 - 0.04]], W3);
  for (let x = X0 + 0.25; x <= X1 - 0.34; x += 0.31) d.seg([x, H, Z0 - 0.04], [x, H + 0.42, Z0 - 0.04], W3);
  // legs + castors
  for (const x of [X0 + 0.05, X1 - 0.05]) for (const z of [Z0 + 0.05, Z1 - 0.05]) {
    d.seg([x, 0.12, z], [x, H - 0.08, z], W3);
    d.circle([x, 0.06, z - 0.02], 0.055, W3, 'xy', 18);
  }
  // blanket fold
  d.curve([[X0 + 1.2, H + 0.15, Z0 + 0.02], [X0 + 1.35, H + 0.2, (Z0 + Z1) / 2], [X0 + 1.25, H + 0.15, Z1 - 0.02]], W3, 8);
  // ---- the drip stand
  const IX = 3.7, IZ = 1.55;
  d.seg([IX, 0.05, IZ], [IX, 2.15, IZ], W2);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    d.seg([IX, 0.08, IZ], [IX + Math.cos(a) * 0.28, 0.02, IZ + Math.sin(a) * 0.28], W3);
  }
  d.seg([IX - 0.18, 2.12, IZ], [IX + 0.18, 2.12, IZ], W3);
  d.line([[IX - 0.16, 2.12, IZ], [IX - 0.2, 2.02, IZ], [IX - 0.24, 1.72, IZ], [IX - 0.14, 1.66, IZ], [IX - 0.08, 1.72, IZ], [IX - 0.11, 2.02, IZ], [IX - 0.16, 2.12, IZ]], W2, true);
  d.curve([[IX - 0.16, 1.66, IZ], [IX - 0.2, 1.4, IZ - 0.1], [IX - 0.5, 1.05, Z0 + 0.3], [X1 - 0.6, H + 0.25, Z0 + 0.4]], W3, 8);
  // ---- the monitor with a pulse
  const MX = 0.2, MY = 1.75, MZ = ZW - 0.05;
  d.box(MX - 0.32, MY - 0.22, MZ - 0.1, MX + 0.32, MY + 0.22, MZ, W1);
  d.seg([MX, MY - 0.22, MZ - 0.05], [MX, MY - 0.45, MZ - 0.02], W3);
  const ecg = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60, x = MX - 0.26 + u * 0.52;
    const ph = (u * 2.5) % 1;
    const y = MY + 0.03 + (ph > 0.42 && ph < 0.5 ? (ph < 0.46 ? 0.13 : -0.07) : Math.sin(ph * TAU) * 0.01);
    ecg.push([x, y, MZ - 0.105]);
  }
  d.line(ecg, W2);
  // ---- curtain on a ceiling track
  d.seg([-3.6, YC - 0.05, 0.6], [-3.6, YC - 0.05, ZW - 0.1], W2);
  d.seg([-3.6, YC - 0.05, 0.6], [-1.4, YC - 0.05, 0.6], W2);
  const folds = [];
  for (let i = 0; i <= 26; i++) {
    const z = 0.65 + (i / 26) * 1.6;
    folds.push([-3.6 + Math.sin(i * 1.3) * 0.06, YC - 0.12, z]);
  }
  d.line(folds, W3);
  for (let i = 0; i <= 8; i++) {
    const z = 0.7 + i * 0.2;
    d.seg([-3.6 + Math.sin(i * 1.7) * 0.05, YC - 0.12, z], [-3.6 + Math.sin(i * 1.7 + 1) * 0.05, 0.35, z + 0.04], W3);
  }
  return d.finish();
}

// ================================================================================================
// 5 · wedding — a mandap: four turned pillars, a domed canopy with a kalash, marigold strings,
//     string lights, the havan kund and a rangoli on the floor.
function wedding(seed) {
  const d = new Draw('wedding', seed, EYE_WALK);
  const X0 = 0.9, X1 = 3.9, Z0 = 0.9, Z1 = 3.7, PH = 2.7;
  const pillar = (x, z) => d.at(x, 0, z, 0, () => {
    d.lathe([[0, 0], [0.16, 0], [0.16, 0.12], [0.11, 0.18], [0.09, 0.5], [0.11, 0.56], [0.08, 0.62], [0.075, 1.5], [0.1, 1.56], [0.075, 1.62], [0.07, 2.35], [0.11, 2.45], [0.16, 2.55], [0.16, PH], [0, PH]], W1, { n: 56, crease: 25 });
  });
  for (const x of [X0, X1]) for (const z of [Z0, Z1]) pillar(x, z);
  // canopy: beams + a dome
  d.line([[X0, PH, Z0], [X1, PH, Z0], [X1, PH, Z1], [X0, PH, Z1]], W1, true);
  d.line([[X0 - 0.15, PH + 0.12, Z0 - 0.15], [X1 + 0.15, PH + 0.12, Z0 - 0.15], [X1 + 0.15, PH + 0.12, Z1 + 0.15], [X0 - 0.15, PH + 0.12, Z1 + 0.15]], W2, true);
  const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  for (const [ax, az] of [[X0, Z0], [X1, Z0], [X1, Z1], [X0, Z1]]) d.curve([[ax, PH + 0.12, az], [lerp(ax, cx, 0.5), PH + 0.95, lerp(az, cz, 0.5)], [cx, PH + 1.25, cz]], W2, 10);
  d.at(cx, PH + 1.22, cz, 0, () => d.lathe([[0, 0], [0.09, 0.02], [0.12, 0.1], [0.08, 0.2], [0.04, 0.24], [0.06, 0.3], [0, 0.42]], W2, { n: 32 }));
  // draped fabric swags between pillars on the front + garlands of marigolds (bead strings)
  const swag = (a, b, sag, w) => d.wire(a, b, sag, w, 32);
  swag([X0, PH - 0.05, Z0], [X1, PH - 0.05, Z0], 0.45, W2);
  swag([X0, PH - 0.12, Z0], [X1, PH - 0.12, Z0], 0.62, W3);
  for (let i = 0; i <= 10; i++) {
    const x = lerp(X0 + 0.15, X1 - 0.15, i / 10);
    const top = PH - 0.05 - 0.45 * 4 * (i / 10) * (1 - i / 10);
    const len = 0.5 + 0.25 * Math.sin(i * 1.7);
    for (let k = 0; k < 9; k++) d.dot([x, top - (k / 8) * len, Z0 - 0.01]);
  }
  for (const z of [Z0, Z1]) for (const x of [X0, X1]) {
    // marigold strings spiralling down the pillars
    for (let k = 0; k < 40; k++) {
      const a = k * 0.6, y = PH - 0.15 - k * 0.06;
      d.dot([x + Math.cos(a) * 0.12, y, z + Math.sin(a) * 0.12]);
    }
  }
  // string lights across the back
  for (let r = 0; r < 3; r++) {
    const pts = wirePts([-5.5, 3.6 - r * 0.25, 4.6], [8.5, 3.5 - r * 0.25, 4.6], 0.35 + r * 0.1, 60);
    d.line(pts, W3);
    pts.forEach((p, i) => i % 3 === 0 && d.dot([p[0], p[1] - 0.04, p[2]]));
  }
  // havan kund: stepped square fire pit with flames
  const hx = cx, hz = cz + 0.2;
  d.box(hx - 0.32, 0, hz - 0.32, hx + 0.32, 0.12, hz + 0.32, W2);
  d.box(hx - 0.22, 0.12, hz - 0.22, hx + 0.22, 0.24, hz + 0.22, W2);
  d.curve([[hx - 0.1, 0.24, hz], [hx - 0.12, 0.42, hz], [hx - 0.02, 0.62, hz], [hx + 0.06, 0.45, hz], [hx + 0.1, 0.24, hz]], W2, 6);
  d.curve([[hx - 0.03, 0.26, hz], [hx + 0.02, 0.48, hz], [hx + 0.05, 0.26, hz]], W3, 6);
  // rangoli on the floor in front
  const rx = cx, rz = Z0 - 0.45;
  for (const r of [0.22, 0.42, 0.6]) d.circle([rx, 0.002, rz], r, r > 0.5 ? W2 : W3, 'xz', 64);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    d.line(crPts([[rx + Math.cos(a) * 0.22, 0.002, rz + Math.sin(a) * 0.22], [rx + Math.cos(a + 0.25) * 0.42, 0.002, rz + Math.sin(a + 0.25) * 0.42], [rx + Math.cos(a) * 0.6, 0.002, rz + Math.sin(a) * 0.6], [rx + Math.cos(a - 0.25) * 0.42, 0.002, rz + Math.sin(a - 0.25) * 0.42], [rx + Math.cos(a) * 0.22, 0.002, rz + Math.sin(a) * 0.22]], 5), W3);
  }
  return d.finish();
}

// ================================================================================================
// 6 · bedroom — a child's room at night: the small bed, a window with the moon, a mobile turning
//     over the bed, a ball and a stacking toy, a shelf of books.
function bedroom(seed) {
  const d = new Draw('bedroom', seed, EYE_WALK);
  const ZW = 2.9, YC = 3.0;
  d.seg([-7, 0, ZW], [9, 0, ZW], W1);
  d.seg([-7, YC, ZW], [9, YC, ZW], W1);
  for (let x = -6.5; x <= 8.5; x += 0.45) d.seg([x, 0, -0.6], [x, 0, ZW], W3); // floorboards
  // the bed (hero)
  const X0 = 1.3, X1 = 3.0, Z0 = 1.75, Z1 = 2.75;
  d.box(X0, 0.12, Z0, X1, 0.36, Z1, W2);
  d.prism(rrect2(X0 - 0.12, 0.0, X0, 1.05, [0, 0, 0.18, 0.18], 6).map(([x, y]) => [x, y]), Z0 - 0.02, Z1 + 0.02, W1);
  d.box(X1, 0.0, Z0 - 0.02, X1 + 0.08, 0.62, Z1 + 0.02, W2);
  d.curve([[X0 + 0.05, 0.36, Z0 + 0.04], [X0 + 0.5, 0.55, Z0 + 0.0], [X0 + 1.0, 0.5, Z0 - 0.02], [X1 - 0.05, 0.42, Z0 + 0.02]], W2, 10); // blanket edge
  d.curve([[X0 + 0.55, 0.52, Z0 + 0.05], [X0 + 0.7, 0.6, (Z0 + Z1) / 2], [X0 + 0.6, 0.5, Z1 - 0.05]], W3, 8); // fold
  d.curve([[X0 + 0.05, 0.42, Z0 + 0.25], [X0 + 0.15, 0.56, (Z0 + Z1) / 2], [X0 + 0.05, 0.42, Z1 - 0.25]], W2, 8); // pillow
  // the window with the moon and stars
  const wx0 = 0.6, wx1 = 2.6, wy0 = 1.2, wy1 = 2.55;
  opening(d, wx0, wx1, wy0, wy1, ZW, 0.2);
  d.seg([(wx0 + wx1) / 2, wy0, ZW + 0.1], [(wx0 + wx1) / 2, wy1, ZW + 0.1], W3);
  const mc = [wx0 + 0.55, wy1 - 0.4, ZW + 0.2];
  d.arc(mc, 0.17, -1.2, 1.9 + 0.9, W1, 'xy', 40);
  d.arc([mc[0] + 0.08, mc[1] + 0.03, mc[2]], 0.14, -0.9, 2.3, W2, 'xy', 36);
  for (let i = 0; i < 9; i++) d.dot([wx0 + 0.25 + d.rand() * 1.6, wy0 + 0.25 + d.rand() * 1.0, ZW + 0.22]);
  // mobile hanging over the bed (anim)
  const MX = (X0 + X1) / 2, MZ = (Z0 + Z1) / 2, MY = YC - 0.75;
  d.seg([MX, YC, MZ], [MX, MY, MZ], W3);
  // shelf with books
  d.box(-2.4, 1.55, ZW - 0.24, -0.6, 1.59, ZW, W2);
  let bx = -2.3;
  for (let i = 0; i < 7; i++) {
    const w = 0.05 + d.rand() * 0.05, h = 0.2 + d.rand() * 0.12;
    d.box(bx, 1.59, ZW - 0.2, bx + w, 1.59 + h, ZW - 0.04, W3);
    bx += w + 0.01;
  }
  // toys: a ball and a stacking ring tower
  d.sphere([3.7, 0.17, 1.2], 0.17, W1, { lats: [0], longs: [0.6] });
  d.at(-0.6, 0, 1.5, 0, () => {
    d.cyl(0, 0, 0, 0.13, 0.04, W3);
    d.seg([0, 0.04, 0], [0, 0.42, 0], W3);
    [0.13, 0.11, 0.09, 0.07].forEach((r, k) => d.at(0, 0.06 + k * 0.08, 0, 0, () => d.lathe([[r * 0.4, 0], [r, 0.01], [r, 0.06], [r * 0.4, 0.07]], W2, { n: 36 })));
  });
  return d.finish({
    anim: (t) => {
      const a = new Draw('bedroom.anim', 1, EYE_WALK);
      const ang = t * 1.4;
      a.at(MX, MY, MZ, ang, () => {
        a.seg([-0.45, 0, 0], [0.45, 0, 0], W2);
        a.seg([0, 0, -0.35], [0, 0, 0.35], W3);
        const hang = (x, z, len, k) => {
          a.seg([x, 0, z], [x, -len, z], W3);
          if (k === 0) a.arc([x, -len - 0.07, z], 0.07, -1.0, 2.6, W2, 'xy', 18);
          else {
            const st = [];
            for (let i = 0; i <= 10; i++) {
              const r = i % 2 ? 0.035 : 0.08, q = (i / 10) * TAU - PI / 2;
              st.push([x + Math.cos(q) * r, -len - 0.08 + Math.sin(q) * r, z]);
            }
            a.line(st, W2, true);
          }
        };
        hang(-0.45, 0, 0.3, 0);
        hang(0.45, 0, 0.42, 1);
        hang(0, -0.35, 0.22, 1);
        hang(0, 0.35, 0.36, 1);
      });
      return a.lines;
    },
  });
}

// ================================================================================================
// 7 · airport — a terminal: the curtain wall, an aircraft beyond it (hero), the departure board,
//     a row of seats and a suitcase standing by.
function airport(seed) {
  const d = new Draw('airport', seed, EYE_WALK);
  const ZG = 4.4;
  // curtain wall: tall mullions + transoms, a canted top
  for (let x = -6.8; x <= 8.8; x += 1.3) d.seg([x, 0, ZG], [x, 4.4, ZG + 0.6], W2);
  for (const y of [0.05, 1.4, 2.8]) d.seg([-6.8, y, ZG + (y / 4.4) * 0.6], [8.8, y, ZG + (y / 4.4) * 0.6], W3);
  d.seg([-6.8, 4.4, ZG + 0.6], [8.8, 4.4, ZG + 0.6], W1);
  for (let x = -6.6; x <= 8.6; x += 0.9) d.seg([x, 0, -0.6], [x, 0, ZG], W3);
  // the aircraft outside (hero): fuselage, wing, tail, windows, engines — side-on beyond the glass
  const ax = 1.8, ay = 1.55, az = 6.8, L = 9.0, R0 = 0.55;
  const fus = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    const x = ax - L / 2 + u * L;
    const r = R0 * (u < 0.12 ? Math.sqrt(u / 0.12) : u > 0.8 ? 1 - ((u - 0.8) / 0.2) * 0.75 : 1);
    fus.push([x, ay + r + (u > 0.8 ? (u - 0.8) * 1.2 : 0), az]);
  }
  for (let i = 40; i >= 0; i--) {
    const u = i / 40;
    const x = ax - L / 2 + u * L;
    const r = R0 * (u < 0.12 ? Math.sqrt(u / 0.12) : 1);
    fus.push([x, ay - r * 0.9 + (u > 0.8 ? (u - 0.8) * 1.6 : 0), az]);
  }
  d.line(fus, W1, true);
  d.line([[ax + L / 2 - 1.2, ay + R0 + 0.2, az], [ax + L / 2 - 0.2, ay + R0 + 1.7, az], [ax + L / 2 + 0.3, ay + R0 + 1.75, az], [ax + L / 2 - 0.05, ay + R0 + 0.35, az]], W1); // fin
  d.line([[ax - 0.6, ay - 0.2, az - 0.3], [ax + 1.3, ay - 0.55, az - 2.6], [ax + 1.85, ay - 0.55, az - 2.6], [ax + 1.0, ay - 0.25, az - 0.3]], W2); // wing (towards us)
  d.cyl(ax + 0.6, ay - 0.95, az - 1.3, 0.24, 0.0, W3);
  d.line([[ax + 0.15, ay - 0.62, az - 1.2], [ax + 1.05, ay - 0.62, az - 1.2], [ax + 1.15, ay - 0.42, az - 1.2], [ax + 0.1, ay - 0.42, az - 1.2]], W2, true); // engine
  for (let i = 0; i < 18; i++) d.circle([ax - L / 2 + 1.4 + i * 0.36, ay + 0.18, az - 0.02], 0.05, W3, 'xy', 10);
  d.seg([ax - L / 2 + 0.9, ay - 0.1, az - 0.02], [ax - L / 2 + 0.9, ay + 0.35, az - 0.02], W3); // door
  // departure board hanging from the roof
  const bx0 = -2.6, bx1 = 0.2, by0 = 2.55, by1 = 3.3, bz = 2.2;
  d.box(bx0, by0, bz, bx1, by1, bz + 0.1, W1);
  for (let r = 0; r < 5; r++) {
    const y = by1 - 0.14 - r * 0.13;
    d.seg([bx0 + 0.1, y, bz - 0.01], [bx0 + 0.6, y, bz - 0.01], W3);
    d.seg([bx0 + 0.75, y, bz - 0.01], [bx0 + 1.9, y, bz - 0.01], W3);
    d.seg([bx0 + 2.05, y, bz - 0.01], [bx0 + 2.6, y, bz - 0.01], W3);
  }
  d.seg([bx0 + 0.3, by1, bz + 0.05], [bx0 + 0.3, 4.4, bz + 0.05], W3);
  d.seg([bx1 - 0.3, by1, bz + 0.05], [bx1 - 0.3, 4.4, bz + 0.05], W3);
  // a row of seats
  for (let i = 0; i < 6; i++) {
    const x = -5.6 + i * 0.58, z = 2.6;
    d.box(x, 0.42, z - 0.22, x + 0.52, 0.47, z + 0.2, W2);
    d.solid([[x, 0.47, z + 0.2], [x + 0.52, 0.47, z + 0.2], [x + 0.52, 0.47, z + 0.26], [x, 0.47, z + 0.26], [x, 0.95, z + 0.32], [x + 0.52, 0.95, z + 0.32], [x + 0.52, 0.95, z + 0.38], [x, 0.95, z + 0.38]],
      [[0, 1, 2, 3].reverse(), [4, 5, 6, 7], [0, 4, 5, 1].reverse(), [3, 2, 6, 7].reverse(), [0, 3, 7, 4].reverse(), [1, 5, 6, 2].reverse()], W2);
  }
  d.seg([-5.6, 0.3, 2.6], [-2.1, 0.3, 2.6], W3);
  // the suitcase (with her)
  const sx = 0.95, sz = 0.45;
  d.box(sx, 0.08, sz - 0.12, sx + 0.42, 0.72, sz + 0.12, W1);
  d.line([[sx + 0.1, 0.72, sz], [sx + 0.1, 1.05, sz], [sx + 0.32, 1.05, sz], [sx + 0.32, 0.72, sz]], W2);
  for (const x of [sx + 0.06, sx + 0.36]) d.circle([x, 0.045, sz - 0.13], 0.045, W3, 'xy', 14);
  for (const y of [0.3, 0.5]) d.seg([sx, y, sz - 0.125], [sx + 0.42, y, sz - 0.125], W3);
  return d.finish();
}

// ================================================================================================
// 8 · rain — a street at night in the monsoon: a lamp with its cone of light, an umbrella over
//     her, puddles, a wall with a lit window; rain falls and rings spread (anim).
function rain(seed) {
  const d = new Draw('rain', seed, EYE_WALK);
  const ZW = 3.6;
  d.seg([-7, 0, ZW], [9, 0, ZW], W1);
  d.seg([-7, 0, 0.9], [9, 0, 0.9], W3); // kerb
  d.seg([-7, 0.12, 0.9], [9, 0.12, 0.9], W3);
  // wall + building edge + lit window + gutter pipe
  d.seg([-7, 3.9, ZW], [9, 3.9, ZW], W2);
  grilleWindow(d, -3.4, -2.0, 1.2, 2.4, ZW, { w: W2 });
  d.seg([5.2, 0, ZW - 0.1], [5.2, 3.9, ZW - 0.1], W2);
  d.seg([5.28, 0, ZW - 0.1], [5.28, 3.9, ZW - 0.1], W3);
  // street lamp + light cone (hero)
  const LX = 2.6, LZ = 1.6;
  d.cyl(LX, 0, LZ, 0.07, 0.25, W2);
  d.seg([LX, 0.25, LZ], [LX, 3.6, LZ], W1);
  d.curve([[LX, 3.6, LZ], [LX - 0.15, 3.95, LZ], [LX - 0.6, 4.0, LZ], [LX - 0.85, 3.85, LZ]], W1, 8);
  d.line([[LX - 1.05, 3.75, LZ], [LX - 0.65, 3.75, LZ], [LX - 0.72, 3.62, LZ], [LX - 0.98, 3.62, LZ]], W2, true);
  for (let k = 0; k < 7; k++) {
    const u = k / 6;
    d.seg([LX - 0.85 + (u - 0.5) * 0.2, 3.6, LZ], [LX - 0.85 + (u - 0.5) * 2.6, 0.0, LZ + (u - 0.5) * 0.6], W3);
  }
  d.circle([LX - 0.85, 0.003, LZ], 1.3, W3, 'xz', 64);
  // the umbrella over her
  const UX = 0.25, UY = 2.0, UZ = 0.05;
  d.at(UX, UY, UZ, 0, () => {
    const ribs = 8;
    const rim = [];
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48) * TAU;
      const sc = 1 - 0.06 * Math.abs(Math.sin(a * ribs / 2));
      rim.push([Math.cos(a) * 0.62 * sc, -0.18 - 0.03 * Math.abs(Math.sin((a * ribs) / 2)), Math.sin(a) * 0.62 * sc]);
    }
    d.line(rim, W1, true);
    for (let k = 0; k < ribs; k++) {
      const a = (k / ribs) * TAU;
      d.curve([[0, 0.12, 0], [Math.cos(a) * 0.35, 0.02, Math.sin(a) * 0.35], [Math.cos(a) * 0.62, -0.18, Math.sin(a) * 0.62]], W3, 6);
    }
    d.seg([0, 0.12, 0], [0, 0.22, 0], W2);
    d.line([[0, 0.12, 0], [0, -0.75, 0], [0.03, -0.82, 0], [0.09, -0.8, 0]], W2);
  });
  // puddles
  for (const [px, pz, r] of [[-1.8, 0.4, 0.5], [1.4, -0.3, 0.35], [3.6, 0.5, 0.6], [-4.2, 0.2, 0.45]]) {
    const pts = [];
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * TAU;
      const rr = r * (1 + 0.18 * Math.sin(a * 3 + px));
      pts.push([px + Math.cos(a) * rr, 0.002, pz + Math.sin(a) * rr * 0.6]);
    }
    d.line(pts, W3, true);
  }
  return d.finish({
    anim: (t) => {
      const a = new Draw('rain.anim', 1, EYE_WALK);
      const r = mulberry32(99);
      for (let i = 0; i < 150; i++) {
        const x = -6 + r() * 15, z = -1.0 + r() * 4.6, sp = 7 + r() * 3;
        const y = 4.6 - ((t * sp + r() * 4.6) % 4.6);
        a.seg([x, y + 0.3, z], [x + 0.03, y, z], W3);
      }
      for (let i = 0; i < 10; i++) {
        const x = -5 + r() * 12, z = -0.6 + r() * 2.4;
        const ph = (t * 1.8 + r()) % 1;
        a.circle([x, 0.003, z], 0.03 + ph * 0.32, W3, 'xz', 32);
      }
      return a.lines;
    },
  });
}

// ================================================================================================
// 9 · stairs — a stairwell: one flight rising ahead of her (hero) with treads, risers, handrail
//     and balusters, the landing above, the wall behind with a window.
function stairs(seed) {
  const d = new Draw('stairs', seed, EYE_WALK);
  const ZW = 2.4;
  d.seg([-7, 0, ZW], [9, 0, ZW], W1);
  for (let x = -6.5; x <= 8.5; x += 0.6) d.seg([x, 0, -0.6], [x, 0, 0.4], W3);
  const N = 12, RISE = 0.19, RUN = 0.3, SX = 0.9, Z0 = 0.45, Z1 = 1.55;
  for (let i = 0; i < N; i++) {
    const x = SX + i * RUN, y = i * RISE;
    d.box(x, y, Z0, x + RUN + 0.03, y + RISE, Z1, i === 0 ? W1 : W2);
  }
  // stringer + landing + upper wall
  const top = N * RISE;
  d.line([[SX, 0, Z0 - 0.02], [SX + N * RUN, top, Z0 - 0.02], [SX + N * RUN + 1.6, top, Z0 - 0.02]], W1);
  d.box(SX + N * RUN, top - 0.12, Z0, SX + N * RUN + 1.6, top, ZW, W2);
  // handrail with balusters on the open (near) side
  const rail = [];
  for (let i = 0; i <= N; i++) rail.push([SX + i * RUN + 0.15, i * RISE + 0.92, Z0 + 0.05]);
  rail.push([SX + N * RUN + 1.5, top + 0.92, Z0 + 0.05]);
  d.line(rail, W1);
  for (let i = 0; i < N; i++) d.seg([SX + i * RUN + 0.15, i * RISE + RISE, Z0 + 0.05], [SX + i * RUN + 0.15, i * RISE + 0.92 + RISE * 0.5, Z0 + 0.05], W3);
  d.cyl(SX + 0.05, 0, Z0 + 0.05, 0.05, 1.05, W2);
  // the wall behind: a tall window following the stair
  opening(d, SX + 1.6, SX + 2.6, 1.6, 3.6, ZW, 0.14, W2, W3);
  d.seg([SX + 2.1, 1.6, ZW + 0.07], [SX + 2.1, 3.6, ZW + 0.07], W3);
  d.seg([SX + 1.6, 2.6, ZW + 0.07], [SX + 2.6, 2.6, ZW + 0.07], W3);
  return d.finish();
}

// ================================================================================================
// the examination room (shot 08): window with light, couch, desk + chairs, curtain, wall lamp
function examRoom(seed) {
  const d = new Draw('examRoom', seed, EYE_EXAM);
  const ZW = 3.4, YC = 3.0;
  d.seg([-5, 0, ZW], [6, 0, ZW], W1);
  d.seg([-5, YC, ZW], [6, YC, ZW], W1);
  d.seg([-5, 0, ZW], [-5, YC, ZW], W2);
  d.seg([-5, 0, ZW], [-5, 0, -2], W2);
  d.seg([-5, YC, ZW], [-5, YC, -1], W3);
  floorGrid(d, -5, 6, -2, ZW, 0.6, 0.6, W3);
  // the large window
  opening(d, -1.6, 1.4, 0.95, 2.6, ZW, 0.2);
  d.seg([-0.1, 0.95, ZW + 0.1], [-0.1, 2.6, ZW + 0.1], W3);
  d.seg([-1.6, 2.15, ZW + 0.1], [1.4, 2.15, ZW + 0.1], W3);
  // examination couch (left)
  const cx0 = -4.4, cx1 = -2.5, cz0 = 1.6, cz1 = 2.25;
  d.box(cx0, 0.62, cz0, cx1, 0.72, cz1, W1);
  d.solid([[cx0, 0.72, cz0], [cx0 + 0.55, 0.72, cz0], [cx0 + 0.55, 0.72, cz1], [cx0, 0.72, cz1], [cx0 - 0.08, 1.05, cz0], [cx0 + 0.02, 1.08, cz0], [cx0 + 0.02, 1.08, cz1], [cx0 - 0.08, 1.05, cz1]],
    [[0, 1, 2, 3].reverse(), [4, 5, 6, 7], [0, 4, 5, 1].reverse(), [3, 2, 6, 7].reverse(), [0, 3, 7, 4].reverse(), [1, 5, 6, 2].reverse()], W2);
  for (const x of [cx0 + 0.08, cx1 - 0.08]) for (const z of [cz0 + 0.06, cz1 - 0.06]) d.seg([x, 0, z], [x, 0.62, z], W3);
  d.box(cx1 - 0.6, 0, cz0 - 0.45, cx1 - 0.15, 0.22, cz0 - 0.05, W2); // step
  // desk + monitor + doctor's chair (right)
  const dx0 = 1.6, dx1 = 3.3, dz0 = 2.2, dz1 = 2.9;
  d.box(dx0, 0.72, dz0, dx1, 0.76, dz1, W1);
  d.box(dx0 + 0.02, 0, dz0 + 0.05, dx0 + 0.06, 0.72, dz1 - 0.05, W3);
  d.box(dx1 - 0.06, 0, dz0 + 0.05, dx1 - 0.02, 0.72, dz1 - 0.05, W3);
  d.box(dx0 + 0.6, 0.98, dz1 - 0.2, dx0 + 1.2, 1.36, dz1 - 0.16, W2);
  d.seg([dx0 + 0.9, 0.76, dz1 - 0.18], [dx0 + 0.9, 0.98, dz1 - 0.18], W3);
  const chair = (x, z, back) => {
    d.box(x - 0.24, 0.45, z - 0.24, x + 0.24, 0.5, z + 0.24, W2);
    d.seg([x, 0.1, z], [x, 0.45, z], W3);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      d.seg([x, 0.1, z], [x + Math.cos(a) * 0.3, 0.03, z + Math.sin(a) * 0.3], W3);
    }
    if (back) d.box(x - 0.22, 0.6, z + back * 0.24, x + 0.22, 1.1, z + back * 0.24 + back * 0.05, W2);
  };
  chair(2.2, 1.6, 1);
  chair(0.8, 1.2, -1);
  // curtain on a track (left)
  d.seg([-5, YC - 0.05, 1.2], [-2.0, YC - 0.05, 1.2], W2);
  for (let i = 0; i <= 10; i++) {
    const x = -4.9 + i * 0.12;
    d.seg([x + Math.sin(i * 1.9) * 0.03, YC - 0.1, 1.2], [x + Math.sin(i * 1.9 + 1) * 0.03, 0.3, 1.2 + Math.sin(i) * 0.04], W3);
  }
  // wall lamp
  d.box(-0.5, 2.75, ZW - 0.12, 0.3, 2.82, ZW, W2);
  return d.finish();
}

// ================================================================================================
// fragments (shot 02): single-weight icons in [-0.5, 0.5]^2
function frag(pts) {
  return new Float32Array(pts.flat());
}
function fragment(name) {
  const out = [];
  const circ = (cx, cy, r, n = 48, a0 = 0, a1 = TAU) => {
    const p = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return p;
  };
  if (name === 'shoe') {
    // a child's school shoe (Mary-Jane): sole, upper, strap with buckle, toe cap
    out.push(frag(crPts([[-0.42, -0.2], [-0.44, -0.08], [-0.36, 0.08], [-0.2, 0.12], [-0.08, 0.06], [0.1, 0.02], [0.3, -0.02], [0.43, -0.1], [0.42, -0.2]], 8)));
    out.push(frag([[-0.44, -0.2], [0.44, -0.2], [0.44, -0.26], [-0.44, -0.26], [-0.44, -0.2]]));
    out.push(frag([[-0.32, -0.26], [-0.32, -0.32], [-0.1, -0.32], [-0.1, -0.26]]));
    out.push(frag(crPts([[-0.2, 0.12], [-0.12, 0.2], [0.0, 0.16], [0.06, 0.04]], 8)));
    out.push(frag(circ(-0.05, 0.13, 0.025, 16)));
    out.push(frag(crPts([[0.18, 0.0], [0.26, -0.08], [0.3, -0.2]], 8)));
  } else if (name === 'staircase') {
    const p = [[-0.45, -0.42]];
    for (let i = 0; i < 6; i++) p.push([-0.45 + i * 0.15, -0.42 + (i + 1) * 0.14], [-0.3 + i * 0.15, -0.42 + (i + 1) * 0.14]);
    p.push([0.45, 0.42], [0.45, -0.42], [-0.45, -0.42]);
    out.push(frag(p));
    out.push(frag([[-0.4, -0.12], [0.45, 0.62 - 0.15]]));
    for (let i = 0; i < 6; i++) out.push(frag([[-0.4 + i * 0.15, -0.28 + i * 0.14], [-0.4 + i * 0.15, -0.12 + i * 0.14]]));
  } else if (name === 'schoolbag') {
    out.push(frag(rrect2(-0.3, -0.42, 0.3, 0.34, [0.06, 0.06, 0.18, 0.18], 6)));
    out.push(frag(rrect2(-0.2, -0.36, 0.2, -0.06, [0.04, 0.04, 0.06, 0.06], 5)));
    out.push(frag([[-0.17, -0.12], [0.17, -0.12]]));
    out.push(frag(circ(0, 0.4, 0.08, 24, 0, PI)));
    out.push(frag(crPts([[-0.3, 0.28], [-0.4, 0.1], [-0.38, -0.2], [-0.3, -0.34]], 8)));
    out.push(frag(crPts([[0.3, 0.28], [0.4, 0.1], [0.38, -0.2], [0.3, -0.34]], 8)));
  } else if (name === 'bicycle') {
    const r = 0.2;
    out.push(frag(circ(-0.27, -0.18, r)));
    out.push(frag(circ(0.27, -0.18, r)));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * PI;
      for (const cx of [-0.27, 0.27]) out.push(frag([[cx + Math.cos(a) * r, -0.18 + Math.sin(a) * r], [cx - Math.cos(a) * r, -0.18 - Math.sin(a) * r]]));
    }
    out.push(frag([[-0.27, -0.18], [-0.05, -0.18], [0.16, 0.08], [-0.12, 0.08], [-0.27, -0.18]]));
    out.push(frag([[-0.05, -0.18], [-0.14, 0.14]]));
    out.push(frag([[-0.2, 0.15], [-0.07, 0.15]]));
    out.push(frag([[0.27, -0.18], [0.14, 0.18], [0.08, 0.22]]));
    out.push(frag([[0.14, 0.18], [0.24, 0.21]]));
    out.push(frag(circ(-0.05, -0.18, 0.04, 16)));
  }
  return out;
}

// placeholder worlds (filled in below as they are designed)
function placeholder(name) {
  const d = new Draw(name, 1, EYE_WALK);
  d.seg([-7, 0, 3], [9, 0, 3], W1);
  d.rxy(1, 0, 4, 2.5, 3, W1);
  return d.finish();
}

const BUILDERS = {
  school,
  street,
  kitchen,
  hospital,
  wedding,
  bedroom,
  airport,
  rain,
  stairs,
};

export function buildWorld(name, seed = 1) {
  const f = BUILDERS[name];
  return f ? f(seed) : placeholder(name);
}

export function buildExamRoom(seed = 1) {
  return examRoom(seed);
}

export function buildFragment(name) {
  return fragment(name);
}
