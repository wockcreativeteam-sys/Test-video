// Deterministic math, easing and noise. Nothing in the film may read a clock or Math.random.

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invlerp = (a, b, x) => clamp((x - a) / (b - a));
export const remap = (x, a, b, c, d) => lerp(c, d, invlerp(a, b, x));
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const fract = (x) => x - Math.floor(x);
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export const E = {
  lin: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inQuint: (t) => t * t * t * t * t,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t, s = 1.4) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  // a "precise" settle: fast attack, long confident tail
  settle: (t) => 1 - Math.pow(1 - t, 3.6),
};

/** progress of t through [a,b], eased */
export const seg = (t, a, b, ease = E.lin) => ease(clamp((t - a) / (b - a)));

/** fade-in over [a, a+fi], hold, fade-out over [b-fo, b] */
export function env(t, a, b, fi = 0.3, fo = 0.3, ei = E.outCubic, eo = E.inCubic) {
  if (t <= a || t >= b) return 0;
  const i = fi > 0 ? ei(clamp((t - a) / fi)) : 1;
  const o = fo > 0 ? 1 - eo(clamp((t - (b - fo)) / fo)) : 1;
  return Math.min(i, o);
}

/** keyframe track: [[t, value, ease?], ...] values may be numbers or arrays */
export function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (t <= k[0]) {
      const p = keys[i - 1];
      const ease = k[2] || E.inOutCubic;
      const u = ease((t - p[0]) / (k[0] - p[0]));
      if (typeof p[1] === 'number') return lerp(p[1], k[1], u);
      return p[1].map((v, j) => lerp(v, k[1][j], u));
    }
  }
  return keys[keys.length - 1][1];
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash1(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
export function hash2(a, b) {
  let x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/** smooth 1D value noise in [-1,1] */
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash2(i, seed) * 2 - 1, hash2(i + 1, seed) * 2 - 1, u);
}
export function fbm1(x, seed = 0, oct = 4) {
  let a = 0.5, s = 0, n = 0;
  for (let o = 0; o < oct; o++) {
    s += a * noise1(x, seed + o * 17.3);
    n += a;
    x *= 2.03;
    a *= 0.5;
  }
  return s / n;
}
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => hash2(a + seed * 13.1, b - seed * 7.7) * 2 - 1;
  return lerp(lerp(h(ix, iy), h(ix + 1, iy), ux), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), ux), uy);
}

export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
};

/** Catmull-Rom through points (arrays of equal length), u in [0,1] across the whole path */
export function catmull(pts, u) {
  const n = pts.length - 1;
  const x = clamp(u) * n;
  const i = Math.min(Math.floor(x), n - 1);
  const t = x - i;
  const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n)];
  const t2 = t * t, t3 = t2 * t;
  return p1.map((_, k) =>
    0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
  );
}

export function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
