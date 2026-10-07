// Engineering-drawing vocabulary: callouts, dimensions, reticles, brackets, rulers.
// All screen-space, immediate mode, hairline.
import { clamp, E, lerp, TAU } from './util.js';
import { text } from './type.js';
import { glowDot } from './lines.js';

const ICE = '220,232,255';

function stroke(ctx, rgb, a, w) {
  ctx.strokeStyle = `rgba(${rgb},${a})`;
  ctx.lineWidth = w;
}

/** mono label with decode-in */
export function label(F, str, x, y, o = {}) {
  const t = o.t ?? 10;
  return text(F, str, x, y, {
    fam: 'M',
    wt: o.wt || 500,
    size: o.size || 13,
    track: o.track ?? 0.12,
    align: o.align || 'l',
    rgb: o.rgb || ICE,
    a: o.a ?? 0.9,
    layer: o.layer || 0,
    anim: o.instant ? null : { mode: 'decode', t, dur: o.dur ?? 0.32, stag: o.stag ?? 0.018 },
    out: o.out,
  });
}

/**
 * Callout: anchor ring -> elbow leader -> stacked labels.
 * lines: [[str, {size, wt, rgb, a}], ...]
 */
export function callout(F, ax, ay, bx, by, lines, o = {}) {
  const t = o.t ?? 10;
  const a = o.a ?? 1;
  if (t <= 0 || a <= 0) return;
  const ctx = F.ctx;
  const rgb = o.rgb || ICE;
  const side = bx >= ax ? 1 : -1;
  const elbowX = bx - side * (o.run ?? 46);
  // anchor
  const ua = E.outBack(clamp(t / 0.25), 2.2);
  ctx.save();
  stroke(ctx, rgb, 0.95 * a, 1.2);
  ctx.beginPath();
  ctx.arc(ax, ay, 4.5 * ua, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = `rgba(${rgb},${a})`;
  ctx.beginPath();
  ctx.arc(ax, ay, 1.6 * ua, 0, TAU);
  ctx.fill();
  if (o.glow) glowDot(F, ax, ay, 22, o.glowRgb || rgb, 0.55 * a * ua);
  // leader: anchor -> elbow -> end
  const ul = E.inOutCubic(clamp((t - 0.08) / 0.42));
  if (ul > 0) {
    const d1 = Math.hypot(elbowX - ax, by - ay), d2 = Math.abs(bx - elbowX);
    const L = (d1 + d2) * ul;
    stroke(ctx, rgb, 0.7 * a, 1);
    ctx.beginPath();
    const r0 = 6;
    const ux = (elbowX - ax) / (d1 || 1), uy = (by - ay) / (d1 || 1);
    ctx.moveTo(ax + ux * r0, ay + uy * r0);
    if (L <= d1) ctx.lineTo(ax + ux * L, ay + uy * L);
    else {
      ctx.lineTo(elbowX, by);
      ctx.lineTo(elbowX + side * (L - d1), by);
    }
    ctx.stroke();
  }
  ctx.restore();
  // labels
  let yy = by - 8;
  const lx = bx + side * 8;
  lines.forEach((ln, i) => {
    const [str, st = {}] = ln;
    const size = st.size || (i === 0 ? 15 : 12.5);
    label(F, str, lx, yy + (i === 0 ? 0 : 0), {
      t: t - 0.38 - i * 0.12,
      size,
      wt: st.wt || (i === 0 ? 600 : 400),
      rgb: st.rgb || rgb,
      a: (st.a ?? (i === 0 ? 0.98 : 0.66)) * a,
      align: side > 0 ? 'l' : 'r',
      track: st.track ?? 0.1,
    });
    yy += size + 9;
    if (i === 0) yy += 2;
  });
}

/** dimension line between two screen points with end ticks and centred label */
export function dim(F, x0, y0, x1, y1, str, o = {}) {
  const t = o.t ?? 10;
  if (t <= 0) return;
  const a = o.a ?? 0.9;
  const rgb = o.rgb || ICE;
  const u = E.inOutCubic(clamp(t / (o.dur ?? 0.5)));
  const ctx = F.ctx;
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L, tk = o.tick ?? 6;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  ctx.save();
  stroke(ctx, rgb, a, 1);
  ctx.beginPath();
  ctx.moveTo(lerp(mx, x0, u), lerp(my, y0, u));
  ctx.lineTo(lerp(mx, x1, u), lerp(my, y1, u));
  if (u > 0.95) {
    ctx.moveTo(x0 + nx * tk, y0 + ny * tk);
    ctx.lineTo(x0 - nx * tk, y0 - ny * tk);
    ctx.moveTo(x1 + nx * tk, y1 + ny * tk);
    ctx.lineTo(x1 - nx * tk, y1 - ny * tk);
  }
  ctx.stroke();
  ctx.restore();
  if (str) {
    const off = o.off ?? 14;
    label(F, str, mx + nx * off * (o.flip ? -1 : 1), my + ny * off * (o.flip ? -1 : 1) + 4, {
      t: t - 0.3,
      align: 'c',
      size: o.size || 13,
      rgb: o.lrgb || rgb,
      a: a,
    });
  }
}

/** reticle that hunts then locks */
export function reticle(F, x, y, r, o = {}) {
  const t = o.t ?? 10;
  if (t <= 0) return;
  const a = o.a ?? 1;
  const rgb = o.rgb || ICE;
  const lock = E.outExpo(clamp(t / (o.dur ?? 0.7)));
  const rr = lerp(r * 2.6, r, lock);
  const rot = (1 - lock) * 1.4;
  const ctx = F.ctx;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  stroke(ctx, rgb, a * clamp(t * 4), 1.2);
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const a0 = (k * TAU) / 4 + 0.32, a1 = ((k + 1) * TAU) / 4 - 0.32;
    ctx.moveTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
    ctx.arc(0, 0, rr, a0, a1);
  }
  for (let k = 0; k < 4; k++) {
    const an = (k * TAU) / 4;
    ctx.moveTo(Math.cos(an) * (rr + 4), Math.sin(an) * (rr + 4));
    ctx.lineTo(Math.cos(an) * (rr + 12), Math.sin(an) * (rr + 12));
  }
  ctx.stroke();
  if (o.center !== false) {
    ctx.fillStyle = `rgba(${rgb},${a})`;
    ctx.fillRect(-1, -1, 2, 2);
  }
  ctx.restore();
}

/** four corner brackets closing in on a box */
export function brackets(F, x, y, w, h, o = {}) {
  const t = o.t ?? 10;
  if (t <= 0) return;
  const a = (o.a ?? 0.9) * clamp(t * 5);
  const rgb = o.rgb || ICE;
  const u = E.outExpo(clamp(t / (o.dur ?? 0.6)));
  const g = lerp(o.from ?? 40, 0, u);
  const len = o.len ?? 14;
  const x0 = x - g, y0 = y - g, x1 = x + w + g, y1 = y + h + g;
  const ctx = F.ctx;
  ctx.save();
  stroke(ctx, rgb, a, o.lw ?? 1.2);
  ctx.beginPath();
  ctx.moveTo(x0, y0 + len); ctx.lineTo(x0, y0); ctx.lineTo(x0 + len, y0);
  ctx.moveTo(x1 - len, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + len);
  ctx.moveTo(x1, y1 - len); ctx.lineTo(x1, y1); ctx.lineTo(x1 - len, y1);
  ctx.moveTo(x0 + len, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - len);
  ctx.stroke();
  ctx.restore();
}

/** ruler: ticks along a screen segment; major every `major` ticks */
export function ruler(F, x0, y0, x1, y1, count, o = {}) {
  const t = o.t ?? 10;
  if (t <= 0) return;
  const a = o.a ?? 0.6;
  const rgb = o.rgb || ICE;
  const u = clamp(t / (o.dur ?? 0.6));
  const major = o.major || 5;
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const ctx = F.ctx;
  ctx.save();
  stroke(ctx, rgb, a, 1);
  ctx.beginPath();
  const shown = Math.floor(count * E.outCubic(u));
  for (let i = 0; i <= shown; i++) {
    const s = i / count;
    const px = x0 + dx * s, py = y0 + dy * s;
    const h = i % major === 0 ? o.hMaj ?? 10 : o.hMin ?? 4.5;
    ctx.moveTo(px, py);
    ctx.lineTo(px + nx * h, py + ny * h);
  }
  if (o.spine !== false) {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + dx * E.outCubic(u), y0 + dy * E.outCubic(u));
  }
  ctx.stroke();
  ctx.restore();
}

/** thin circle (optionally dashed / partial) */
export function ring(F, x, y, r, o = {}) {
  const a = o.a ?? 0.8;
  if (a <= 0 || r <= 0) return;
  const ctx = F.ctx;
  ctx.save();
  stroke(ctx, o.rgb || ICE, a, o.w ?? 1);
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath();
  ctx.arc(x, y, r, o.a0 ?? 0, o.a1 ?? TAU);
  ctx.stroke();
  ctx.restore();
}
