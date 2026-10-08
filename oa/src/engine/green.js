// The line. A luminous stroke in screen space with per-vertex width and alpha:
// green body + white-hot core on the vector layer, a wide halo on the glow layer.
import { C } from '../palette.js';
import { drawHead } from './lines.js';

const AQ = 24, WQ = 4;

/**
 * P: Float32Array screen xy (stride 2), n points.
 * o: w (px), a, wv / av (per-vertex multipliers, Float32Array n), rgb, hi (core rgb), core (0..1),
 *    glow (0..1 halo strength), halo (halo width multiplier), head {r, g, gi, rgb}
 */
export function glowLine(F, P, n, o = {}) {
  if (n < 2) return;
  const a0 = o.a ?? 1;
  if (a0 <= 0.003) return;
  const w0 = o.w ?? 2;
  if (o.wv) {
    let mx = 0;
    for (let i = 0; i < n; i++) mx = Math.max(mx, o.wv[i] * w0);
    if (mx > 5) return ribbonLine(F, P, n, o);
  }
  const rgb = o.rgb || C.GREEN, hi = o.hi || C.GREEN_HI;
  const core = o.core ?? 0.9, glow = o.glow ?? 1, halo = o.halo ?? 1;
  const wv = o.wv, av = o.av;
  const buckets = new Map();
  let prev = null;
  for (let i = 0; i < n - 1; i++) {
    let a = a0, w = w0;
    if (av) a *= 0.5 * (av[i] + av[i + 1]);
    if (wv) w *= 0.5 * (wv[i] + wv[i + 1]);
    if (a <= 0.004 || w <= 0.02) {
      prev = null;
      continue;
    }
    const aq = Math.min(1, Math.max(1, Math.round(a * AQ)) / AQ);
    const wq = Math.max(0.25, Math.round(w * WQ) / WQ);
    const k = aq * 1000 + wq;
    let b = buckets.get(k);
    if (!b) {
      b = { a: aq, w: wq, p: new Path2D() };
      buckets.set(k, b);
    }
    const x0 = P[i * 2], y0 = P[i * 2 + 1], x1 = P[i * 2 + 2], y1 = P[i * 2 + 3];
    if (b !== prev) b.p.moveTo(x0, y0);
    b.p.lineTo(x1, y1);
    prev = b;
  }
  const c = F.ctx, g = F.g;
  c.lineCap = g.lineCap = 'round';
  c.lineJoin = g.lineJoin = 'round';
  for (const b of buckets.values()) {
    if (glow > 0) {
      g.lineWidth = b.w * 3.2 * halo + 2.5;
      g.strokeStyle = `rgba(${rgb},${Math.min(1, b.a * 0.42 * glow)})`;
      g.stroke(b.p);
    }
    c.lineWidth = b.w;
    c.strokeStyle = `rgba(${rgb},${b.a})`;
    c.stroke(b.p);
    if (core > 0 && b.w > 0.6) {
      c.lineWidth = Math.max(0.5, b.w * 0.42);
      c.strokeStyle = `rgba(${hi},${b.a * core})`;
      c.stroke(b.p);
    }
  }
  if (o.head) {
    const h = o.head;
    const hx = P[(n - 1) * 2], hy = P[(n - 1) * 2 + 1];
    drawHead(F, { x: hx, y: hy, r: h.r ?? w0 * 0.9, rgb: h.rgb || rgb, core: h.core || '240,255,244', g: h.g ?? 30, gi: h.gi ?? 0.9, a: (h.a ?? 1) * a0 });
  }
}

/** resample a screen polyline to m points evenly by arc length (returns Float32Array 2m) */
export function resample(P, n, m, out) {
  out = out || new Float32Array(m * 2);
  if (n < 2) {
    for (let i = 0; i < m; i++) {
      out[i * 2] = P[0];
      out[i * 2 + 1] = P[1];
    }
    return out;
  }
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]);
  const L = cum[n - 1] || 1e-9;
  let k = 0;
  for (let j = 0; j < m; j++) {
    const s = (j / (m - 1)) * L;
    while (k < n - 2 && cum[k + 1] < s) k++;
    const u = (s - cum[k]) / Math.max(1e-9, cum[k + 1] - cum[k]);
    out[j * 2] = P[k * 2] + (P[k * 2 + 2] - P[k * 2]) * u;
    out[j * 2 + 1] = P[k * 2 + 1] + (P[k * 2 + 3] - P[k * 2 + 1]) * u;
  }
  return out;
}

/** arc length of a screen polyline */
export function arcLen(P, n) {
  let L = 0;
  for (let i = 1; i < n; i++) L += Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]);
  return L;
}

/** sub-path [from, to] (fractions of arc length) of a screen polyline */
export function subPath(P, n, from, to) {
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]);
  const L = cum[n - 1];
  const s0 = from * L, s1 = to * L;
  const out = [];
  const at = (s) => {
    let k = 0;
    while (k < n - 2 && cum[k + 1] < s) k++;
    const u = (s - cum[k]) / Math.max(1e-9, cum[k + 1] - cum[k]);
    return [P[k * 2] + (P[k * 2 + 2] - P[k * 2]) * u, P[k * 2 + 1] + (P[k * 2 + 3] - P[k * 2 + 1]) * u];
  };
  const a = at(s0);
  out.push(a[0], a[1]);
  for (let i = 0; i < n; i++) if (cum[i] > s0 && cum[i] < s1) out.push(P[i * 2], P[i * 2 + 1]);
  const b = at(s1);
  out.push(b[0], b[1]);
  return new Float32Array(out);
}

/** wide variable-width lines as filled ribbons (no overlapping round caps), chunked by alpha */
function ribbonLine(F, P, n, o) {
  const a0 = o.a ?? 1, w0 = o.w ?? 2;
  const rgb = o.rgb || C.GREEN, hi = o.hi || C.GREEN_HI;
  const core = o.core ?? 0.9, glow = o.glow ?? 1, halo = o.halo ?? 1;
  const wv = o.wv, av = o.av;
  const NX = new Float32Array(n), NY = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    let tx = P[i1 * 2] - P[i0 * 2], ty = P[i1 * 2 + 1] - P[i0 * 2 + 1];
    const l = Math.hypot(tx, ty) || 1;
    NX[i] = -ty / l;
    NY[i] = tx / l;
  }
  const A = (i) => a0 * (av ? av[i] : 1);
  const Wd = (i) => w0 * (wv ? wv[i] : 1);
  const poly = (ctx, i0, i1, k, kmin) => {
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const h = Math.max(kmin, Wd(i) * k) / 2;
      const x = P[i * 2] + NX[i] * h, y = P[i * 2 + 1] + NY[i] * h;
      if (i === i0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = i1; i >= i0; i--) {
      const h = Math.max(kmin, Wd(i) * k) / 2;
      ctx.lineTo(P[i * 2] - NX[i] * h, P[i * 2 + 1] - NY[i] * h);
    }
    ctx.closePath();
    ctx.fill();
  };
  const c = F.ctx, g = F.g;
  let i0 = 0;
  const q = (i) => Math.round(A(i) * 16) / 16;
  while (i0 < n - 1) {
    let i1 = i0 + 1;
    const qa = q(i0);
    while (i1 < n - 1 && q(i1) === qa) i1++;
    const a = Math.min(1, qa);
    if (a > 0.004) {
      if (glow > 0) {
        g.fillStyle = `rgba(${rgb},${Math.min(1, a * 0.42 * glow)})`;
        poly(g, i0, i1, 3.2 * halo, 3);
      }
      c.fillStyle = `rgba(${rgb},${a})`;
      poly(c, i0, i1, 1, 0.8);
      if (core > 0) {
        c.fillStyle = `rgba(${hi},${a * core})`;
        poly(c, i0, i1, 0.42, 0.5);
      }
    }
    i0 = i1;
  }
  if (o.head) {
    const h = o.head;
    drawHead(F, { x: P[(n - 1) * 2], y: P[(n - 1) * 2 + 1], r: h.r ?? w0 * 0.9, rgb: h.rgb || rgb, core: h.core || '240,255,244', g: h.g ?? 30, gi: h.gi ?? 0.9, a: (h.a ?? 1) * a0 });
  }
}
