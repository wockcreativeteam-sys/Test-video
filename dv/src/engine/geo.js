// Procedural mesh builders. Everything is generated as parametric grids with analytic normals
// (rounded boxes, lathes, lofts around 2D outlines, sweeps along 3D paths), plus a sparse
// "construction" wireframe per primitive (rings / iso-lines) for blueprint and scan looks.
import { m4 } from './m4.js';

export class Geo {
  constructor() {
    this.P = [];
    this.N = [];
    this.I = [];
    this.L = []; // wire segments: x0,y0,z0,x1,y1,z1
  }
  get nv() {
    return this.P.length / 3;
  }
  v(p, n) {
    this.P.push(p[0], p[1], p[2]);
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    this.N.push(n[0] / l, n[1] / l, n[2] / l);
    return this.nv - 1;
  }
  tri(a, b, c) {
    this.I.push(a, b, c);
  }
  quad(a, b, c, d) {
    this.I.push(a, b, c, a, c, d);
  }
  line(a, b) {
    this.L.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  poly(pts, closed) {
    for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) this.line(pts[i], pts[(i + 1) % pts.length]);
  }
  /** append another geo, optionally transformed by a rigid/uniform matrix */
  add(g, M) {
    const o = this.nv;
    for (let i = 0; i < g.P.length; i += 3) {
      let p = [g.P[i], g.P[i + 1], g.P[i + 2]], n = [g.N[i], g.N[i + 1], g.N[i + 2]];
      if (M) {
        p = m4.apply(M, p);
        n = m4.dir(M, n);
      }
      this.v(p, n);
    }
    for (const i of g.I) this.I.push(i + o);
    for (let i = 0; i < g.L.length; i += 6) {
      let a = [g.L[i], g.L[i + 1], g.L[i + 2]], b = [g.L[i + 3], g.L[i + 4], g.L[i + 5]];
      if (M) {
        a = m4.apply(M, a);
        b = m4.apply(M, b);
      }
      this.line(a, b);
    }
    return this;
  }
  xf(M) {
    const g = new Geo();
    g.add(this, M);
    return g;
  }
  bounds() {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.P.length; i += 3)
      for (let k = 0; k < 3; k++) {
        b[k] = Math.min(b[k], this.P[i + k]);
        b[k + 3] = Math.max(b[k + 3], this.P[i + k]);
      }
    return b;
  }
  /** n points sampled on the surface (area weighted), deterministic: Float32Array xyz + normals */
  sample(n, seed = 1) {
    let s = seed >>> 0;
    const rnd = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const I = this.I, P = this.P, N = this.N;
    const nt = I.length / 3;
    const cum = new Float64Array(nt + 1);
    for (let t = 0; t < nt; t++) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      cum[t + 1] = cum[t] + 0.5 * Math.hypot(cx, cy, cz);
    }
    const tot = cum[nt];
    const out = new Float32Array(n * 3), on = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = rnd() * tot;
      let lo = 0, hi = nt;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (cum[m + 1] < r) lo = m + 1;
        else hi = m;
      }
      const t = Math.min(lo, nt - 1);
      let u = rnd(), v = rnd();
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      for (let k = 0; k < 3; k++) {
        out[i * 3 + k] = P[a + k] + (P[b + k] - P[a + k]) * u + (P[c + k] - P[a + k]) * v;
        on[i * 3 + k] = N[a + k] + (N[b + k] - N[a + k]) * u + (N[c + k] - N[a + k]) * v;
      }
    }
    return { P: out, N: on, n };
  }
}

const PI = Math.PI;
/** global tessellation quality (scales segment counts while meshes are generated) */
export const GEO = { q: 1 };
const Q = (n, min = 3) => Math.max(min, Math.round(n * GEO.q));

/** rows of a 2D profile with crease splitting. pts: [[r, y], ...] -> [{r, y, nr, ny, join}] */
function profileRows(pts, crease = 40) {
  const segN = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dr = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1];
    const l = Math.hypot(dr, dy) || 1;
    segN.push([dy / l, -dr / l]);
  }
  const rows = [];
  const cosT = Math.cos((crease * PI) / 180);
  for (let i = 0; i < pts.length; i++) {
    const a = segN[i - 1], b = segN[i];
    if (!a) rows.push({ r: pts[i][0], y: pts[i][1], nr: b[0], ny: b[1], join: false });
    else if (!b) rows.push({ r: pts[i][0], y: pts[i][1], nr: a[0], ny: a[1], join: true });
    else if (a[0] * b[0] + a[1] * b[1] >= cosT) {
      rows.push({ r: pts[i][0], y: pts[i][1], nr: a[0] + b[0], ny: a[1] + b[1], join: true });
    } else {
      rows.push({ r: pts[i][0], y: pts[i][1], nr: a[0], ny: a[1], join: true });
      rows.push({ r: pts[i][0], y: pts[i][1], nr: b[0], ny: b[1], join: false });
    }
  }
  return rows;
}

/** surface of revolution about +Y. profile [[r, y], ...] from bottom-centre outward and up. */
export function lathe(profile, seg = 48, o = {}) {
  seg = Q(seg, 8);
  const g = new Geo();
  const rows = profileRows(profile, o.crease ?? 40);
  const a0 = o.a0 ?? 0, a1 = o.a1 ?? 2 * PI;
  const full = Math.abs(a1 - a0 - 2 * PI) < 1e-6;
  const ns = full ? seg : seg + 1;
  const base = [];
  for (const row of rows) {
    const b = g.nv;
    base.push(b);
    for (let s = 0; s < ns; s++) {
      const a = a0 + ((a1 - a0) * s) / seg;
      const c = Math.cos(a), sn = Math.sin(a);
      g.v([row.r * c, row.y, row.r * sn], [row.nr * c, row.ny, row.nr * sn]);
    }
  }
  for (let k = 1; k < rows.length; k++) {
    if (!rows[k].join) continue;
    const A = base[k - 1], B = base[k];
    for (let s = 0; s < seg; s++) {
      const s1 = full ? (s + 1) % seg : s + 1;
      g.quad(A + s, A + s1, B + s1, B + s);
    }
  }
  // construction lines: rings at profile vertices, a few meridians
  const wr = o.wireRings ?? true;
  if (wr) {
    for (const p of profile) {
      if (p[0] < 1e-5) continue;
      const ring = [];
      for (let s = 0; s <= seg; s++) {
        const a = a0 + ((a1 - a0) * s) / seg;
        ring.push([p[0] * Math.cos(a), p[1], p[0] * Math.sin(a)]);
      }
      g.poly(ring, false);
    }
  }
  const mer = o.wireMeridians ?? 8;
  for (let m = 0; m < mer; m++) {
    const a = a0 + ((a1 - a0) * m) / mer;
    const pts = profile.map((p) => [p[0] * Math.cos(a), p[1], p[0] * Math.sin(a)]);
    g.poly(pts, false);
  }
  return g;
}

/** profile helper: a solid cylinder (axis +Y, base at y = 0) with rounded rims of radius b */
export function cylProfile(r, h, b = 0, steps = 3) {
  steps = Q(steps, 1);
  const p = [[0, 0]];
  if (b > 0) {
    for (let i = 0; i <= steps; i++) {
      const a = -PI / 2 + (i / steps) * (PI / 2);
      p.push([r - b + Math.cos(a) * b, b + Math.sin(a) * b]);
    }
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * (PI / 2);
      p.push([r - b + Math.cos(a) * b, h - b + Math.sin(a) * b]);
    }
  } else {
    p.push([r, 0], [r, h]);
  }
  p.push([0, h]);
  return p;
}
export function cylinder(r, h, o = {}) {
  return lathe(cylProfile(r, h, o.bevel ?? Math.min(r, h) * 0.12, o.steps ?? 3), o.seg ?? 48, o);
}
/** cylinder along +Y centred on the origin */
export function cylC(r, h, o = {}) {
  return cylinder(r, h, o).xf(m4.T(0, -h / 2, 0));
}

// ---- 2D outlines (closed, CCW seen from +Y looking down... in x,z) with outward normals -------------
/** rounded rectangle outline: half sizes hx, hz, corner radius rc */
export function rrect(hx, hz, rc, steps = 8) {
  steps = Q(steps, 1);
  rc = Math.min(rc, hx, hz);
  const pts = [];
  const corners = [
    [hx - rc, hz - rc, 0],
    [-(hx - rc), hz - rc, PI / 2],
    [-(hx - rc), -(hz - rc), PI],
    [hx - rc, -(hz - rc), (3 * PI) / 2],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / steps) * (PI / 2);
      pts.push({ x: cx + Math.cos(a) * rc, z: cz + Math.sin(a) * rc, nx: Math.cos(a), nz: Math.sin(a) });
    }
  }
  return pts;
}
/** superellipse outline |x/a|^n + |z/b|^n = 1 */
export function superellipse(a, b, n = 4, m = 96) {
  m = Q(m, 12);
  const pts = [];
  for (let i = 0; i < m; i++) {
    const t = (i / m) * 2 * PI;
    const c = Math.cos(t), s = Math.sin(t);
    const x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const z = b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    // normal from the implicit gradient
    const nx = (n / a) * Math.sign(x) * Math.pow(Math.abs(x / a), n - 1);
    const nz = (n / b) * Math.sign(z) * Math.pow(Math.abs(z / b), n - 1);
    pts.push({ x, z, nx, nz });
  }
  for (const p of pts) {
    const l = Math.hypot(p.nx, p.nz) || 1;
    p.nx /= l;
    p.nz /= l;
  }
  return pts;
}
export function circleOutline(r, m = 32) {
  m = Q(m, 6);
  const pts = [];
  for (let i = 0; i < m; i++) {
    const a = (i / m) * 2 * PI;
    pts.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) });
  }
  return pts;
}

/**
 * Loft: a vertical prism around a closed outline. profile [[inset, y], ...] bottom to top
 * (inset > 0 shrinks the outline; use it for fillets and tapers). scale(y) optional per-row xz scale.
 * Caps are flat fans at the first / last rows.
 */
export function loft(outline, profile, o = {}) {
  const g = new Geo();
  // profile rows with normals: treat (-inset) as the radial coordinate
  const rows = profileRows(profile.map(([ins, y]) => [-ins, y]), o.crease ?? 40);
  const m = outline.length;
  const base = [];
  const sc = o.scale || (() => [1, 1]);
  for (const row of rows) {
    const b = g.nv;
    base.push(b);
    const s = sc(row.y);
    for (const q of outline) {
      const ins = -row.r;
      g.v([(q.x - q.nx * ins) * s[0], row.y, (q.z - q.nz * ins) * s[1]], [q.nx * row.nr, row.ny, q.nz * row.nr]);
    }
  }
  for (let k = 1; k < rows.length; k++) {
    if (!rows[k].join) continue;
    const A = base[k - 1], B = base[k];
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      g.quad(A + i, B + i, B + j, A + j);
    }
  }
  const cap = (row, up) => {
    const s = sc(row.y);
    const ins = -row.r;
    let cx = 0, cz = 0;
    const pts = outline.map((q) => [(q.x - q.nx * ins) * s[0], row.y, (q.z - q.nz * ins) * s[1]]);
    for (const p of pts) {
      cx += p[0];
      cz += p[2];
    }
    const nrm = [0, up ? 1 : -1, 0];
    const c = g.v([cx / m, row.y, cz / m], nrm);
    const b = g.nv;
    for (const p of pts) g.v(p, nrm);
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      if (up) g.tri(c, b + j, b + i);
      else g.tri(c, b + i, b + j);
    }
  };
  if (o.capBot !== false) cap(rows[0], false);
  if (o.capTop !== false) cap(rows[rows.length - 1], true);
  // wire: outline at each profile vertex + a few verticals
  for (const [ins, y] of profile) {
    const s = sc(y);
    g.poly(outline.map((q) => [(q.x - q.nx * ins) * s[0], y, (q.z - q.nz * ins) * s[1]]), true);
  }
  const nv = o.wireVerticals ?? 8;
  for (let k = 0; k < nv; k++) {
    const q = outline[Math.floor((k / nv) * m)];
    g.poly(profile.map(([ins, y]) => {
      const s = sc(y);
      return [(q.x - q.nx * ins) * s[0], y, (q.z - q.nz * ins) * s[1]];
    }), false);
  }
  return g;
}

/** a fillet profile for loft: bottom bevel rb, top fillet rt, height h (from y0) */
export function filletProfile(h, rt = 0.01, rb = 0.004, steps = 4, y0 = 0) {
  steps = Q(steps, 1);
  const p = [];
  if (rb > 0) for (let i = 0; i <= steps; i++) {
    const a = -PI / 2 + (i / steps) * (PI / 2);
    p.push([rb - Math.cos(a) * rb, y0 + rb + Math.sin(a) * rb]);
  }
  else p.push([0, y0]);
  if (rt > 0) for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (PI / 2);
    p.push([rt - Math.cos(a) * rt, y0 + h - rt + Math.sin(a) * rt]);
  }
  else p.push([0, y0 + h]);
  return p;
}

/** rounded box centred on the origin: size sx, sy, sz, edge radius r */
export function rbox(sx, sy, sz, r = 0.01, o = {}) {
  r = Math.min(r, sx / 2 - 1e-4, sy / 2 - 1e-4, sz / 2 - 1e-4);
  const g = loft(rrect(sx / 2, sz / 2, r, o.steps ?? 4), filletProfile(sy, r, r, o.steps ?? 4, -sy / 2), { wireVerticals: 4, ...o });
  return g;
}

/** rotation-minimising frames along a polyline */
function frames(path, up0) {
  const n = path.length;
  const T = [], N = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
    const t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(t[0], t[1], t[2]) || 1;
    T.push([t[0] / l, t[1] / l, t[2] / l]);
  }
  // initial normal
  let u = up0 || [0, 1, 0];
  let t0 = T[0];
  let b0 = cr(t0, u);
  if (Math.hypot(b0[0], b0[1], b0[2]) < 1e-4) b0 = cr(t0, [1, 0, 0]);
  b0 = nz(b0);
  let n0 = cr(b0, t0);
  N.push(n0);
  B.push(b0);
  for (let i = 1; i < n; i++) {
    // double reflection (Wang et al.)
    const v1 = sub(path[i], path[i - 1]);
    const c1 = dot(v1, v1) || 1e-12;
    const rL = sub(N[i - 1], mul(v1, (2 / c1) * dot(v1, N[i - 1])));
    const tL = sub(T[i - 1], mul(v1, (2 / c1) * dot(v1, T[i - 1])));
    const v2 = sub(T[i], tL);
    const c2 = dot(v2, v2) || 1e-12;
    const r = nz(sub(rL, mul(v2, (2 / c2) * dot(v2, rL))));
    N.push(r);
    B.push(nz(cr(T[i], r)));
  }
  return { T, N, B };
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nz = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Sweep a closed 2D outline (points {x, z, nx, nz} in the cross-section plane: x -> frame N,
 * z -> frame B) along a 3D path. o.scale(u) -> [sx, sz] per path station; caps at the ends.
 */
export function sweep(path, outline, o = {}) {
  const g = new Geo();
  const F = frames(path, o.up);
  const n = path.length, m = outline.length;
  const sc = o.scale || (() => [1, 1]);
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(...sub(path[i], path[i - 1])));
  const L = cum[n - 1] || 1;
  const base = [];
  const ring = (i) => {
    const s = sc(cum[i] / L);
    return outline.map((q) => {
      const x = q.x * s[0], z = q.z * s[1];
      return [path[i][0] + F.N[i][0] * x + F.B[i][0] * z, path[i][1] + F.N[i][1] * x + F.B[i][1] * z, path[i][2] + F.N[i][2] * x + F.B[i][2] * z];
    });
  };
  for (let i = 0; i < n; i++) {
    const b = g.nv;
    base.push(b);
    const R = ring(i);
    const s = sc(cum[i] / L);
    for (let k = 0; k < m; k++) {
      const q = outline[k];
      const nx = q.nx / (s[0] || 1), nzz = q.nz / (s[1] || 1);
      const nn = [F.N[i][0] * nx + F.B[i][0] * nzz, F.N[i][1] * nx + F.B[i][1] * nzz, F.N[i][2] * nx + F.B[i][2] * nzz];
      g.v(R[k], nn);
    }
  }
  for (let i = 1; i < n; i++) {
    const A = base[i - 1], B = base[i];
    for (let k = 0; k < m; k++) {
      const j = (k + 1) % m;
      g.quad(A + k, A + j, B + j, B + k);
    }
  }
  const cap = (i, dir) => {
    const R = ring(i);
    const nrm = mul(F.T[i], dir);
    const c = g.v(path[i], nrm);
    const b = g.nv;
    for (const p of R) g.v(p, nrm);
    for (let k = 0; k < m; k++) {
      const j = (k + 1) % m;
      if (dir < 0) g.tri(c, b + k, b + j);
      else g.tri(c, b + j, b + k);
    }
  };
  if (o.caps !== false) {
    cap(0, -1);
    cap(n - 1, 1);
  }
  const every = o.wireEvery ?? Math.max(1, Math.round(n / 6));
  for (let i = 0; i < n; i += every) g.poly(ring(i), true);
  g.poly(ring(n - 1), true);
  for (let k = 0; k < 4; k++) {
    const kk = Math.floor((k / 4) * m);
    g.poly(path.map((_, i) => ring(i)[kk]), false);
  }
  return g;
}

/** sample a cubic bezier into n+1 points */
export function bezier(p0, p1, p2, p3, n = 24) {
  n = Q(n, 4);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([0, 1, 2].map((k) => a * p0[k] + b * p1[k] + c * p2[k] + d * p3[k]));
  }
  return out;
}
/** an arc in a plane: centre c, from vector a (radius vector), around axis ax, angle */
export function arcPath(c, a, ax, ang, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const R = m4.RA(nz(ax), (ang * i) / n);
    const v = m4.dir(R, a);
    out.push([c[0] + v[0], c[1] + v[1], c[2] + v[2]]);
  }
  return out;
}

/** flat quad in the xz plane (normal +Y), centred */
export function plane(sx, sz) {
  const g = new Geo();
  const n = [0, 1, 0];
  const a = g.v([-sx / 2, 0, -sz / 2], n), b = g.v([sx / 2, 0, -sz / 2], n), c = g.v([sx / 2, 0, sz / 2], n), d = g.v([-sx / 2, 0, sz / 2], n);
  g.quad(a, d, c, b);
  return g;
}

/** torus segment about +Y: major R, minor r */
export function torus(R, r, segU = 48, segV = 16, a0 = 0, a1 = 2 * PI) {
  const prof = [];
  for (let i = 0; i <= segV; i++) {
    const a = -PI / 2 + (i / segV) * 2 * PI;
    prof.push([R + Math.cos(a) * r, Math.sin(a) * r]);
  }
  // lathe expects bottom->top outward ordering; a torus profile is a full circle
  return lathe(prof, segU, { a0, a1, crease: 80, wireMeridians: 0 });
}
