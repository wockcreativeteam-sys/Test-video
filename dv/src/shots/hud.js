// Instrumentation layer: monospace HUD (callouts anchored to 3D points, station headers, brackets,
// counters, arcs, crosshairs) and display typography that assembles like a part on the line.
import { clamp, lerp, E, mulberry32 } from '../engine/util.js';
import { shape, drawShaped } from '../engine/glyphs.js';
import { glowDot } from '../engine/lines.js';
import { C } from '../palette.js';

const P4 = [0, 0, 0, 0];
export const u01 = (t, a, b) => clamp((t - a) / (b - a));
export const pulse = (t, a, d = 0.12) => (t < a ? 0 : Math.exp(-(t - a) / d));
export { E, clamp, lerp };

/** project a world point -> [x, y, depth] or null */
export function proj(F, p) {
  return F.cam.project(p[0], p[1], p[2], P4) ? [P4[0], P4[1], P4[2]] : null;
}

/** monospace text (Canvas2D). o: size, wt, rgb, a, align, track, glow, layer */
export function mono(F, txt, x, y, o = {}) {
  const a = o.a ?? 1;
  if (a <= 0.003 || !txt) return 0;
  const c = F.ctx;
  const size = o.size ?? 15;
  c.save();
  c.font = `${o.wt ?? 500} ${size}px "Geist Mono"`;
  c.letterSpacing = (o.track ?? size * 0.14) + 'px';
  c.textAlign = o.align || 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = `rgba(${o.rgb || C.ICE},${a})`;
  c.fillText(txt, x, y);
  const w = c.measureText(txt).width;
  c.restore();
  if (o.glow) {
    const g = F.g;
    g.save();
    g.font = `${o.wt ?? 500} ${size}px "Geist Mono"`;
    g.letterSpacing = (o.track ?? size * 0.14) + 'px';
    g.textAlign = o.align || 'left';
    g.fillStyle = `rgba(${o.glowRgb || o.rgb || C.CYAN},${a * o.glow})`;
    g.fillText(txt, x, y);
    g.restore();
  }
  return w;
}
/** typed-on text: n chars visible after t0 at cps chars/s, with a block cursor while typing */
export function typed(F, txt, x, y, t, t0, o = {}) {
  if (t < t0) return;
  const cps = o.cps ?? 40;
  const n = Math.min(txt.length, Math.floor((t - t0) * cps));
  const s = txt.slice(0, n);
  const w = mono(F, s, x, y, o);
  if (n < txt.length || (o.cursor && Math.floor(t * 4) % 2 === 0)) {
    const size = o.size ?? 15;
    F.ctx.fillStyle = `rgba(${o.rgb || C.CYAN},${(o.a ?? 1) * 0.9})`;
    F.ctx.fillRect(x + w + 3, y - size * 0.78, size * 0.55, size * 0.9);
  }
}

function line(ctx, pts, rgb, a, w) {
  if (a <= 0.003) return;
  ctx.strokeStyle = `rgba(${rgb},${a})`;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}
/** a polyline drawn on progressively (u 0..1 of its length), base + glow */
export function hline(F, pts, u, o = {}) {
  if (u <= 0) return null;
  let L = 0;
  const seg = [];
  for (let i = 2; i < pts.length; i += 2) {
    const l = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    seg.push(l);
    L += l;
  }
  const want = L * clamp(u);
  const out = [pts[0], pts[1]];
  let acc = 0;
  for (let i = 0; i < seg.length; i++) {
    if (acc + seg[i] >= want) {
      const k = (want - acc) / (seg[i] || 1);
      out.push(lerp(pts[i * 2], pts[i * 2 + 2], k), lerp(pts[i * 2 + 1], pts[i * 2 + 3], k));
      break;
    }
    acc += seg[i];
    out.push(pts[i * 2 + 2], pts[i * 2 + 3]);
  }
  const rgb = o.rgb || C.CYAN, a = o.a ?? 1;
  line(F.ctx, out, rgb, a, o.w ?? 1.2);
  if (o.glow !== 0) line(F.g, out, rgb, a * (o.glow ?? 0.6), (o.w ?? 1.2) * 2.4 + 1);
  return [out[out.length - 2], out[out.length - 1]];
}

/**
 * 3D callout: a dot on the point, an elbow leader, a label (and an optional value line).
 * o: u (0..1 build), out (0..1 dismiss), side (+1 right, -1 left), up (px rise), len (px), sub, rgb
 */
export function tag(F, p3, label, o = {}) {
  const u = clamp(o.u ?? 1), out = clamp(o.out ?? 0);
  if (u <= 0 || out >= 1) return;
  const P = Array.isArray(p3) && p3.length === 2 ? p3 : proj(F, p3);
  if (!P) return;
  const a = (o.a ?? 1) * (1 - out);
  const side = o.side ?? 1, rise = o.up ?? -70, len = o.len ?? 150;
  const x0 = P[0], y0 = P[1];
  const x1 = x0 + side * Math.abs(rise) * 0.7, y1 = y0 + rise;
  const x2 = x1 + side * len;
  const rgb = o.rgb || C.CYAN;
  // dot + ring
  const ctx = F.ctx;
  const du = E.outCubic(u01(u, 0, 0.25));
  ctx.fillStyle = `rgba(${C.WHITE},${a * du})`;
  ctx.beginPath();
  ctx.arc(x0, y0, 3.2 * du, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb},${a * du * 0.8})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x0, y0, 9 + 5 * (1 - du), 0, Math.PI * 2);
  ctx.stroke();
  glowDot(F, x0, y0, 22, rgb, 0.5 * a * du);
  // leader
  const lu = E.outCubic(u01(u, 0.1, 0.7));
  hline(F, [x0, y0, x1, y1, x2, y1], lu, { rgb, a, w: 1.1 });
  // label
  const tu = u01(u, 0.45, 1);
  if (tu > 0) {
    const n = Math.ceil(label.length * tu);
    const tx = side > 0 ? x1 + 6 : x2 + 6 - 0;
    const txt = label.slice(0, n);
    const sz = o.size ?? 17;
    mono(F, txt, side > 0 ? x1 + 4 : x2, y1 - 10, { size: sz, a, rgb: C.WHITE, glow: 0.25 });
    if (o.sub) mono(F, o.sub.slice(0, Math.ceil(o.sub.length * tu)), side > 0 ? x1 + 4 : x2, y1 + sz + 8, { size: sz - 3, a: a * 0.85, rgb, wt: 400 });
    void tx;
  }
}

/** station header (top-left): index, title, rule, progress */
export function header(F, idx, title, t, t0, t1, o = {}) {
  if (t < t0 || t > t1) return;
  const inU = E.outCubic(u01(t, t0, t0 + 0.35));
  const outU = E.inCubic(u01(t, t1 - 0.25, t1));
  const a = inU * (1 - outU);
  const x = o.x ?? 96, y = o.y ?? 104;
  mono(F, 'STATION', x, y, { size: 15, a: a * 0.8, rgb: C.CYAN, track: 4 });
  mono(F, idx, x + 120, y, { size: 15, a, rgb: C.WHITE, track: 4 });
  hline(F, [x, y + 14, x + 430, y + 14], inU, { a: a * 0.6, w: 1, glow: 0.3 });
  // progress ticks
  const p = clamp((t - t0) / (t1 - t0));
  for (let i = 0; i < 24; i++) {
    const on = i / 24 < p;
    F.ctx.fillStyle = `rgba(${on ? C.CYAN : C.GREY},${a * (on ? 0.9 : 0.3)})`;
    F.ctx.fillRect(x + i * 18, y + 22, 12, 3);
  }
  const tu = u01(t, t0 + 0.1, t0 + 0.6);
  typedTitle(F, title, x, y + 74, tu, a, o.size ?? 40);
}
function typedTitle(F, title, x, y, u, a, size) {
  if (u <= 0) return;
  // display type, letters wipe in left to right
  const S = shape(title, 'D300', { track: 0.06 });
  const n = S.glyphs.length;
  drawShaped(F, S, (ex, ey, g, gi) => {
    const k = clamp(u * (n + 4) - gi);
    if (k <= 0) return null;
    return [x + ex * size + (1 - E.outCubic(k)) * 14, y + ey * size];
  }, { rgb: C.WHITE, a, glow: 0.18, alphaFn: (gi) => E.outCubic(clamp(u * (n + 4) - gi)) });
}

/** corner brackets around a screen rect */
export function brackets(F, x, y, w, h, u, o = {}) {
  if (u <= 0) return;
  const a = (o.a ?? 1) * clamp(u * 2);
  const k = (o.k ?? 22) * E.outCubic(clamp(u));
  const ex = (1 - E.outCubic(clamp(u))) * 30;
  const rgb = o.rgb || C.CYAN;
  const X0 = x - ex, Y0 = y - ex, X1 = x + w + ex, Y1 = y + h + ex;
  const L = (pts) => {
    line(F.ctx, pts, rgb, a, 1.4);
    line(F.g, pts, rgb, a * 0.5, 4);
  };
  L([X0, Y0 + k, X0, Y0, X0 + k, Y0]);
  L([X1 - k, Y0, X1, Y0, X1, Y0 + k]);
  L([X1, Y1 - k, X1, Y1, X1 - k, Y1]);
  L([X0 + k, Y1, X0, Y1, X0, Y1 - k]);
}
/** screen bbox of a set of world points */
export function screenBox(F, pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    const q = proj(F, p);
    if (!q) continue;
    x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]);
    x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]);
  }
  return x0 < x1 ? [x0, y0, x1 - x0, y1 - y0] : null;
}

/** crosshair reticle */
export function crosshair(F, x, y, r, a, o = {}) {
  if (a <= 0.003) return;
  const rgb = o.rgb || C.CYAN;
  const ctx = F.ctx;
  ctx.strokeStyle = `rgba(${rgb},${a})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  const g = r * 0.35;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * (r - 6), y + dy * (r - 6));
    ctx.lineTo(x + dx * (r + g), y + dy * (r + g));
    ctx.stroke();
  }
  if (o.spin !== undefined) {
    ctx.beginPath();
    ctx.arc(x, y, r * 1.35, o.spin, o.spin + 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 1.35, o.spin + Math.PI, o.spin + Math.PI + 1.2);
    ctx.stroke();
  }
  glowDot(F, x, y, r * 1.6, rgb, 0.25 * a);
}

/** a 3D arc around centre c in the plane spanned by unit vectors U, V (angles in rad) */
export function arc3(F, c, r, U, V, a0, a1, o = {}) {
  const n = 64;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = lerp(a0, a1, i / n);
    const p = [c[0] + (U[0] * Math.cos(t) + V[0] * Math.sin(t)) * r, c[1] + (U[1] * Math.cos(t) + V[1] * Math.sin(t)) * r, c[2] + (U[2] * Math.cos(t) + V[2] * Math.sin(t)) * r];
    const q = proj(F, p);
    if (q) pts.push(q[0], q[1]);
  }
  if (pts.length < 4) return null;
  hline(F, pts, o.u ?? 1, { rgb: o.rgb || C.CYAN, a: o.a ?? 0.9, w: o.w ?? 1.3, glow: o.glow ?? 0.6 });
  // ticks
  if (o.ticks) {
    for (let i = 0; i <= o.ticks; i++) {
      const t = lerp(a0, a1, i / o.ticks);
      const p0 = [c[0] + (U[0] * Math.cos(t) + V[0] * Math.sin(t)) * r, c[1] + (U[1] * Math.cos(t) + V[1] * Math.sin(t)) * r, c[2] + (U[2] * Math.cos(t) + V[2] * Math.sin(t)) * r];
      const rr = r * (i % 3 === 0 ? 1.08 : 1.04);
      const p1 = [c[0] + (U[0] * Math.cos(t) + V[0] * Math.sin(t)) * rr, c[1] + (U[1] * Math.cos(t) + V[1] * Math.sin(t)) * rr, c[2] + (U[2] * Math.cos(t) + V[2] * Math.sin(t)) * rr];
      const q0 = proj(F, p0), q1 = proj(F, p1);
      if (q0 && q1 && i / o.ticks <= (o.u ?? 1)) line(F.ctx, [q0[0], q0[1], q1[0], q1[1]], o.rgb || C.CYAN, (o.a ?? 0.9) * 0.7, 1);
    }
  }
  return pts;
}

/** big numeral / word that slams in (scale-down with a flash) */
export function slam(F, txt, x, y, size, t, t0, o = {}) {
  if (t < t0) return;
  const u = E.outExpo(u01(t, t0, t0 + 0.22));
  const out = o.t1 !== undefined ? E.inCubic(u01(t, o.t1 - 0.2, o.t1)) : 0;
  if (out >= 1) return;
  const s = lerp(1.6, 1, u);
  const a = clamp(u * 3) * (1 - out) * (o.a ?? 1);
  const S = shape(txt, o.fam || 'D200', { track: o.track ?? 0 });
  const w = S.width * size * s;
  const flash = Math.exp(-(t - t0) / 0.08);
  drawShaped(F, S, (ex, ey) => [x - w / 2 + ex * size * s, y + ey * size * s], { rgb: o.rgb || C.WHITE, a, glow: 0.3 + flash });
}

/**
 * Display type that assembles: each glyph flies in from a scattered position and locks on,
 * staggered; a tiny flash on lock. o: fam, track, align, rgb, stagger, dur, spread, out (0..1)
 */
export function assemble(F, str, x, y, size, t, t0, o = {}) {
  if (t < t0) return null;
  const S = shape(str, o.fam || 'D300', { track: o.track ?? 0.08 });
  const n = S.glyphs.length;
  const w = S.width * size;
  const x0 = o.align === 'c' ? x - w / 2 : o.align === 'r' ? x - w : x;
  const stag = o.stagger ?? 0.03, dur = o.dur ?? 0.38;
  const rnd = mulberry32(o.seed ?? str.length * 7 + 3);
  const off = S.glyphs.map(() => [(rnd() - 0.5) * (o.spread ?? 220), (rnd() - 0.5) * (o.spread ?? 220) * 0.5, rnd()]);
  const outU = clamp(o.out ?? 0);
  const order = S.glyphs.map((g, i) => i);
  const a0 = o.a ?? 1;
  const lockT = (i) => t0 + order[i] * stag + dur;
  drawShaped(F, S, (ex, ey, g, gi) => {
    const u = E.outCubic(u01(t, t0 + order[gi] * stag, lockT(gi)));
    if (u <= 0) return null;
    const k = 1 - u;
    const d = off[gi];
    const ox = d[0] * k + outU * (d[0] * 0.3), oy = d[1] * k - outU * 18;
    return [x0 + ex * size + ox, y + ey * size + oy];
  }, {
    rgb: o.rgb || C.WHITE, a: a0 * (1 - outU), glow: o.glow ?? 0.2,
    alphaFn: (gi) => clamp(u01(t, t0 + order[gi] * stag, t0 + order[gi] * stag + dur * 0.5) * 1.2),
  });
  // lock flashes
  if (o.flash !== false) {
    S.glyphs.forEach((g, gi) => {
      if (!g.contours.length || !isFinite(g.cx)) return;
      const lt = lockT(gi);
      const f = t >= lt ? Math.exp(-(t - lt) / 0.07) : 0;
      if (f > 0.02) glowDot(F, x0 + g.cx * size, y - size * 0.35, size * 0.5, C.CYAN, 0.5 * f * a0);
    });
  }
  return { x0, w, S };
}

/** persistent frame furniture: corner marks, timecode, line status */
export function frameHUD(F, t, o = {}) {
  const a = o.a ?? 1;
  if (a <= 0.003) return;
  const W = F.W, H = F.H, m = 44, k = 18;
  const rgb = C.ICE;
  const L = (pts) => line(F.ctx, pts, rgb, a * 0.55, 1.2);
  L([m, m + k, m, m, m + k, m]);
  L([W - m - k, m, W - m, m, W - m, m + k]);
  L([W - m, H - m - k, W - m, H - m, W - m - k, H - m]);
  L([m + k, H - m, m, H - m, m, H - m - k]);
  const f = Math.floor(t * 30);
  const tc = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t) % 60).padStart(2, '0')}:${String(f % 30).padStart(2, '0')}`;
  mono(F, tc, W - m - 6, H - m - 12, { size: 12, a: a * 0.6, align: 'right', rgb });
  if (o.status) mono(F, o.status, m + 6, H - m - 12, { size: 12, a: a * 0.6, rgb });
  if (o.rec) {
    const on = Math.floor(t * 2) % 2 === 0;
    F.ctx.fillStyle = `rgba(${C.RED},${a * (on ? 0.9 : 0.25)})`;
    F.ctx.beginPath();
    F.ctx.arc(W - m - 150, H - m - 17, 4, 0, Math.PI * 2);
    F.ctx.fill();
  }
}

/** a thin progress bar */
export function bar(F, x, y, w, u, o = {}) {
  const a = o.a ?? 1;
  F.ctx.fillStyle = `rgba(${C.GREY},${a * 0.3})`;
  F.ctx.fillRect(x, y, w, 2);
  F.ctx.fillStyle = `rgba(${o.rgb || C.CYAN},${a})`;
  F.ctx.fillRect(x, y, w * clamp(u), 2);
  F.g.fillStyle = `rgba(${o.rgb || C.CYAN},${a * 0.5})`;
  F.g.fillRect(x, y - 2, w * clamp(u), 6);
}

/** check mark that draws on */
export function check(F, x, y, s, u, o = {}) {
  hline(F, [x - s, y, x - s * 0.3, y + s * 0.7, x + s, y - s * 0.8], u, { rgb: o.rgb || C.CYAN, a: o.a ?? 1, w: 2 });
}

/** a feathered dark field behind type */
export function scrim(F, x, y, w, h, a) {
  if (a <= 0.003) return;
  F.L.flush();
  const ctx = F.ctx;
  const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) * 0.62);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - w * 0.2, y - h * 0.4, w * 1.4, h * 1.8);
}
