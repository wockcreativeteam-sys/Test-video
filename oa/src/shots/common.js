// Shared shot helpers: 3D line projection into the luminous line renderer, typography placement
// (flat, on 3D planes, along paths), volumetric dust, and small timing utilities.
import { clamp, lerp, mulberry32, E } from '../engine/util.js';
import { glowLine } from '../engine/green.js';
import { shape, drawShaped } from '../engine/glyphs.js';
import { cloud } from '../engine/cloud.js';
import { C, F as PF } from '../palette.js';

const P4 = [0, 0, 0, 0];

/** project a 3D polyline (stride 3) to screen runs (split where it goes behind the camera) */
export function project(F, P, n, xf) {
  const runs = [];
  let cur = [];
  for (let i = 0; i < n; i++) {
    let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (xf) {
      x = xf[0] + (x - xf[0]) * xf[3];
      y = xf[1] + (y - xf[1]) * xf[3];
      z = xf[2] + (z - xf[2]) * xf[3];
    }
    if (F.cam.project(x, y, z, P4)) cur.push(P4[0], P4[1], P4[2], P4[3]);
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  return runs.map((r) => {
    const m = r.length / 4;
    const S = new Float32Array(m * 2), Z = new Float32Array(m), K = new Float32Array(m);
    for (let i = 0; i < m; i++) {
      S[i * 2] = r[i * 4];
      S[i * 2 + 1] = r[i * 4 + 1];
      Z[i] = r[i * 4 + 2];
      K[i] = r[i * 4 + 3];
    }
    return { S, Z, K, n: m };
  });
}

/** a luminous 3D line: projected, width scales with perspective (o.persp = reference px/unit) */
export function glow3(F, P, n, o = {}) {
  const runs = project(F, P, n, o.xf);
  for (const r of runs) {
    let wv = o.wv;
    if (o.persp) {
      wv = new Float32Array(r.n);
      for (let i = 0; i < r.n; i++) wv[i] = clamp(r.K[i] / o.persp, o.wMin ?? 0.3, o.wMax ?? 4) * (o.wv ? o.wv[i] : 1);
    }
    let av = o.av;
    if (o.fog) {
      av = new Float32Array(r.n);
      for (let i = 0; i < r.n; i++) av[i] = lerp(1, o.fog[2], clamp((r.Z[i] - o.fog[0]) / (o.fog[1] - o.fog[0]))) * (o.av ? o.av[i] : 1);
    }
    glowLine(F, r.S, r.n, { ...o, wv, av, head: o.head && r === runs[runs.length - 1] ? o.head : null });
  }
  return runs;
}

/** draw-on helper: the sub-polyline [from, to] (fractions of 3D arc length) of a stride-3 line */
export function sub3(P, n, from, to) {
  if (to <= from) return null;
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(P[i * 3] - P[i * 3 - 3], P[i * 3 + 1] - P[i * 3 - 2], P[i * 3 + 2] - P[i * 3 - 1]);
  const L = cum[n - 1];
  const s0 = from * L, s1 = to * L;
  const out = [];
  const at = (s) => {
    let k = 0;
    while (k < n - 2 && cum[k + 1] < s) k++;
    const u = (s - cum[k]) / Math.max(1e-9, cum[k + 1] - cum[k]);
    return [lerp(P[k * 3], P[k * 3 + 3], u), lerp(P[k * 3 + 1], P[k * 3 + 4], u), lerp(P[k * 3 + 2], P[k * 3 + 5], u)];
  };
  out.push(...at(s0));
  for (let i = 0; i < n; i++) if (cum[i] > s0 && cum[i] < s1) out.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  out.push(...at(s1));
  return new Float32Array(out);
}

// ---- typography ---------------------------------------------------------------------------------
export const TYPE = { rgb: C.LILAC };

/**
 * Flat text from glyph outlines. align 'l' | 'c' | 'r'. per(gi, g) -> {dx, dy, sx, sy, a} | null
 * returns { x0, w, S }
 */
export function textFlat(F, str, x, y, size, o = {}) {
  const S = shape(str, o.fam || 'D400', { track: o.track || 0 });
  const w = S.width * size;
  const x0 = o.align === 'c' ? x - w / 2 : o.align === 'r' ? x - w : x;
  const per = o.per;
  drawShaped(
    F,
    S,
    (ex, ey, g, gi) => {
      if (per) {
        const q = per(gi, g);
        if (!q) return null;
        const cx = g.cx;
        return [x0 + (cx + (ex - cx) * (q.sx ?? 1)) * size + (q.dx || 0), y + ey * size * (q.sy ?? 1) + (q.dy || 0)];
      }
      return [x0 + ex * size, y + ey * size];
    },
    {
      rgb: o.rgb || TYPE.rgb, a: o.a ?? 1, glow: o.glow ?? 0.25, stroke: o.stroke,
      alphaFn: per ? (gi, g) => { const q = per(gi, g); return q ? q.a ?? 1 : 0; } : o.alphaFn,
      skip: o.skip, ctx: o.ctx,
    }
  );
  return { x0, w, S };
}

/**
 * Text on a 3D plane: origin (baseline-left unless align), right & up unit vectors (world),
 * size in world units per em. per(gi, g) -> {dx, dy, dz (world, along right/up/normal), a, sx, sy}
 */
export function text3D(F, str, origin, right, up, size, o = {}) {
  const S = shape(str, o.fam || 'D400', { track: o.track || 0 });
  const w = S.width * size;
  const ax = o.align === 'c' ? -w / 2 : o.align === 'r' ? -w : 0;
  const nrm = [right[1] * up[2] - right[2] * up[1], right[2] * up[0] - right[0] * up[2], right[0] * up[1] - right[1] * up[0]];
  const per = o.per;
  const cache = new Map();
  drawShaped(
    F,
    S,
    (ex, ey, g, gi) => {
      let q = null;
      if (per) {
        q = cache.get(gi);
        if (q === undefined) {
          q = per(gi, g);
          cache.set(gi, q);
        }
        if (!q) return null;
      }
      const cx = g.cx;
      const lx = ax + (q ? cx + (ex - cx) * (q.sx ?? 1) : ex) * size + (q?.dx || 0);
      const ly = -ey * size * (q?.sy ?? 1) + (q?.dy || 0);
      const lz = q?.dz || 0;
      const X = origin[0] + right[0] * lx + up[0] * ly + nrm[0] * lz;
      const Y = origin[1] + right[1] * lx + up[1] * ly + nrm[1] * lz;
      const Z = origin[2] + right[2] * lx + up[2] * ly + nrm[2] * lz;
      return F.cam.project(X, Y, Z, P4) ? [P4[0], P4[1]] : null;
    },
    {
      rgb: o.rgb || TYPE.rgb, a: o.a ?? 1, glow: o.glow ?? 0.25, stroke: o.stroke,
      alphaFn: per ? (gi) => { const q = cache.get(gi) ?? per(gi, S.glyphs[gi]); return q ? q.a ?? 1 : 0; } : null,
    }
  );
  return { w, S };
}

/**
 * Text bent along a screen-space path (Float32Array xy). s0: start offset (px along the path),
 * size: px per em, o.per(gi) -> {a, dy}
 */
export function textOnPath(F, str, path, n, s0, size, o = {}) {
  const S = shape(str, o.fam || 'D400', { track: o.track || 0 });
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(path[i * 2] - path[i * 2 - 2], path[i * 2 + 1] - path[i * 2 - 1]);
  const L = cum[n - 1];
  let k = 0;
  const frame = (s) => {
    s = clamp(s, 0, L);
    if (cum[k] > s) k = 0;
    while (k < n - 2 && cum[k + 1] < s) k++;
    const d = Math.max(1e-6, cum[k + 1] - cum[k]);
    const u = (s - cum[k]) / d;
    const dx = (path[k * 2 + 2] - path[k * 2]) / d, dy = (path[k * 2 + 3] - path[k * 2 + 1]) / d;
    return [path[k * 2] + dx * u * d, path[k * 2 + 1] + dy * u * d, dx, dy];
  };
  drawShaped(
    F,
    S,
    (ex, ey, g, gi) => {
      const q = o.per ? o.per(gi, g) : null;
      if (o.per && !q) return null;
      const s = s0 + ex * size;
      const f = frame(s);
      const off = ey * size + (q?.dy || 0) - (o.lift || 0);
      // glyph y (down) maps onto the path's right-hand normal in screen space (-dy, dx)
      return [f[0] - f[3] * off, f[1] + f[2] * off];
    },
    { rgb: o.rgb || TYPE.rgb, a: o.a ?? 1, glow: o.glow ?? 0.25, alphaFn: o.per ? (gi, g) => o.per(gi, g)?.a ?? 1 : null }
  );
  return { w: S.width * size, L };
}

// ---- scrim: a feathered dark field behind type (dims the vector and glow layers beneath it) ------
const SCRIMS = new Map();
function scrimSprite(w, h, f) {
  const key = `${Math.round(w)}|${Math.round(h)}|${Math.round(f)}`;
  let c = SCRIMS.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = Math.ceil(w + f * 4);
  c.height = Math.ceil(h + f * 4);
  const g = c.getContext('2d');
  // draw the rect far off-canvas and keep only its blurred shadow
  g.shadowColor = 'rgba(0,0,0,1)';
  g.shadowBlur = f;
  g.shadowOffsetX = 10000;
  g.fillStyle = '#000';
  g.fillRect(f * 2 - 10000, f * 2, w, h);
  SCRIMS.set(key, c);
  return c;
}
export function scrim(F, x, y, w, h, a = 0.55, f = 70) {
  if (a <= 0.003) return;
  F.L.flush(); // lines queued so far must sit under the scrim
  const c = scrimSprite(w, h, f);
  const ctx = F.ctx;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.drawImage(c, x - f * 2, y - f * 2);
  ctx.restore();
  const g = F.g;
  g.save();
  g.globalAlpha = Math.min(1, a * 1.2);
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(c, x - f * 2, y - f * 2);
  g.restore();
}

// ---- atmosphere -----------------------------------------------------------------------------------
const DUST = {};
/** a box of drifting dust around the camera (wraps), purple bokeh in the distance */
export function dust(F, t, o = {}) {
  const n = o.n ?? 1400;
  const key = n + '|' + (o.seed ?? 3);
  let D = DUST[key];
  if (!D) {
    const rnd = mulberry32(o.seed ?? 3);
    D = { P: new Float32Array(n * 3), base: new Float32Array(n * 3), E: new Float32Array(n), ph: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      D.base[i * 3] = rnd();
      D.base[i * 3 + 1] = rnd();
      D.base[i * 3 + 2] = rnd();
      D.E[i] = 0.25 + rnd() * rnd() * 1.6;
      D.ph[i] = rnd() * 6.283;
    }
    DUST[key] = D;
  }
  const box = o.box ?? 30;
  const c = o.center || F.cam.pos;
  const drift = o.drift || [0.05, 0.02, 0];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      let v = D.base[i * 3 + k] * box + drift[k] * t + Math.sin(t * 0.3 + D.ph[i] + k) * 0.15;
      v = ((v - c[k] + box / 2) % box + box) % box - box / 2 + c[k];
      D.P[i * 3 + k] = v;
    }
  }
  cloud(F, D.P, n, {
    rgb: o.rgb || PF.VIOLET_HI, E: D.E, e: o.e ?? 0.12,
    dof: o.dof || { focus: 6, range: 8, max: 9, gain: 0.25 },
    near: [0.4, 2.0], fog: o.fog,
  });
}

// ---- timing ---------------------------------------------------------------------------------------
/** 0..1 inside [a, b] */
export const u01 = (t, a, b) => clamp((t - a) / (b - a));
/** quantise time to a frame rate (stuttered / reduced-frame-rate animation) */
export const stepTime = (t, fps) => Math.floor(t * fps) / fps;
/** smooth pulse 0 -> 1 -> 0 over [a, b] */
export const bump = (t, a, b) => {
  const u = clamp((t - a) / (b - a));
  return Math.sin(Math.PI * u);
};
export { E, lerp, clamp };
