// Shared scene vocabulary: machine reveals, statements, chapter tags.
import { C } from '../palette.js';
import { E, clamp, lerp } from '../engine/util.js';
import { text } from '../engine/type.js';
import { label } from '../engine/annot.js';
import { glowDot } from '../engine/lines.js';

/**
 * A machine arrives through the line: its silhouette is traced by a write-head, the photograph
 * resolves under a scan band, then the drawing recedes to a faint technical overlay.
 * x,y = top-left in px, s = scale, u = seconds since start, out = 0..1 exit.
 * Returns the drawn box.
 */
export function machineReveal(F, name, x, y, s, u, o = {}) {
  const img = F.assets.img[name];
  const LJ = F.assets.lines[name];
  if (!img || u <= 0) return null;
  const w = img.width * s, h = img.height * s;
  const out = o.out ?? 0;
  const aAll = (o.a ?? 1) * (1 - E.inCubic(clamp(out)));
  if (aAll <= 0.001) return { x, y, w, h };
  const ink = o.ink || C.ICE;
  const tl = o.lineDur ?? 0.75;
  const drawU = E.inOutCubic(clamp(u / tl));
  const wipe = E.inOutCubic(clamp((u - tl * 0.55) / (o.wipeDur ?? 0.6)));
  const lineFade = lerp(1, o.restLines ?? 0.18, E.inOutCubic(clamp((u - tl - 0.25) / 0.6)));
  const ctx = F.ctx;

  // soft lit pool behind the object (night scenes)
  if (o.pool) {
    const cx = x + w / 2, cy = y + h * 0.55;
    const r = Math.max(w, h) * 0.75;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${o.pool},${0.16 * aAll * wipe})`);
    g.addColorStop(1, `rgba(${o.pool},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // photograph under a scan band
  if (wipe > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 2, y - 2, w + 4, (h + 4) * wipe);
    ctx.clip();
    ctx.globalAlpha = aAll;
    if (o.filter) ctx.filter = o.filter;
    ctx.drawImage(img, x, y, w, h);
    ctx.filter = 'none';
    ctx.restore();
    if (o.reflect) {
      ctx.save();
      ctx.globalAlpha = aAll * 0.12 * wipe;
      ctx.translate(x, y + h * 2 + 2);
      ctx.scale(1, -1);
      ctx.beginPath();
      ctx.rect(0, h - h * 0.35, w, h * 0.35);
      ctx.clip();
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    }
    if (wipe < 1) {
      const sy = y + h * wipe;
      ctx.fillStyle = `rgba(${C.LUMI},${0.55 * aAll})`;
      ctx.fillRect(x - 12, sy - 0.75, w + 24, 1.5);
      F.g.fillStyle = `rgba(${C.LUMI},${0.7 * aAll})`;
      F.g.fillRect(x - 20, sy - 3, w + 40, 6);
    }
  }
  // the drawing
  if (LJ && lineFade * aAll > 0.01) {
    for (const ln of LJ.lines) {
      const P = ln.p;
      const n = P.length / 2;
      const Q = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        Q[i * 2] = x + P[i * 2] * s;
        Q[i * 2 + 1] = y + P[i * 2 + 1] * s;
      }
      const sil = ln.k === 'sil';
      F.L.poly2(Q, {
        rgb: ink,
        a: (sil ? 0.9 : 0.35) * lineFade * aAll,
        w: sil ? 1.3 : 0.9,
        to: drawU,
        layer: sil && drawU < 1 ? 2 : 0,
        head: sil && drawU < 1 && drawU > 0 ? { r: 2, rgb: C.LUMI, g: 26, gi: 0.8 } : null,
      });
    }
    F.L.flush();
  }
  return { x, y, w, h, a: aAll };
}

/** a statement line: rises from a baseline mask, exits by dropping away */
export function statement(F, str, x, y, t, dur, o = {}) {
  if (t < 0 || t > dur + 1) return;
  const outT = t - dur;
  text(F, str, x, y, {
    fam: 'D',
    wt: o.wt || 600,
    size: o.size || 84,
    track: o.track ?? -0.01,
    align: o.align || 'l',
    rgb: o.rgb || C.WHITE,
    a: o.a ?? 1,
    glow: o.glow ?? 0,
    anim: { mode: 'rise', t, dur: o.inDur ?? 0.9, stag: o.stag ?? 0.028, ease: E.outExpo },
    out: outT > 0 ? { mode: o.outMode || 'drop', t: outT, dur: 0.5, stag: 0.015, ease: E.inCubic } : null,
  });
}

/** small chapter marker, top-left: index + name, with a hairline */
export function chapterTag(F, idx, name, t, dur, o = {}) {
  if (t < 0 || t > dur) return;
  const a = clamp(t / 0.4) * clamp((dur - t) / 0.5) * (o.a ?? 1);
  const x = 96, y = 92;
  const rgb = o.rgb || C.STEEL;
  label(F, idx, x, y, { t, size: 12, wt: 500, a: 0.9 * a, rgb: o.hl || C.ICE });
  const ctx = F.ctx;
  const lw = 38 * E.outCubic(clamp((t - 0.15) / 0.5));
  ctx.strokeStyle = `rgba(${rgb},${0.6 * a})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 30, y - 4.5);
  ctx.lineTo(x + 30 + lw, y - 4.5);
  ctx.stroke();
  label(F, name, x + 80, y, { t: t - 0.2, size: 12, wt: 500, a: 0.75 * a, rgb, track: 0.22 });
}

/** soft emitter shortcut */
export function emit(F, x, y, r, rgb, i) {
  glowDot(F, x, y, r, rgb, i);
}

/**
 * Robotic arm as a technical illustration: occluding capsule links with outline + highlight,
 * jointed hubs. joints: world points [base, ..., tip]; radii: world radius per link.
 */
export function drawArm(F, joints, radii, a, o = {}) {
  const ctx = F.ctx;
  const P = joints.map((j) => F.cam.p(j[0], j[1], j[2]));
  const ink = o.ink || '222,234,255';
  const body = o.body || '7,17,38';
  for (let i = 0; i < joints.length - 1; i++) {
    const p0 = P[i], p1 = P[i + 1];
    if (!p0 || !p1) continue;
    const r0 = radii[i] * p0[3], r1 = radii[i] * (o.taper ?? 0.85) * p1[3];
    const th = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    const nx = -Math.sin(th), ny = Math.cos(th);
    ctx.beginPath();
    ctx.moveTo(p0[0] + nx * r0, p0[1] + ny * r0);
    ctx.lineTo(p1[0] + nx * r1, p1[1] + ny * r1);
    ctx.arc(p1[0], p1[1], r1, th + Math.PI / 2, th - Math.PI / 2, true);
    ctx.lineTo(p0[0] - nx * r0, p0[1] - ny * r0);
    ctx.arc(p0[0], p0[1], r0, th - Math.PI / 2, th + Math.PI / 2, true);
    ctx.closePath();
    ctx.fillStyle = `rgba(${body},${0.94 * a})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${ink},${0.82 * a})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // highlight edge for volume
    ctx.strokeStyle = `rgba(${ink},${0.28 * a})`;
    ctx.beginPath();
    ctx.moveTo(p0[0] + nx * r0 * 0.55, p0[1] + ny * r0 * 0.55);
    ctx.lineTo(p1[0] + nx * r1 * 0.55, p1[1] + ny * r1 * 0.55);
    ctx.stroke();
  }
  for (let i = 0; i < joints.length - 1; i++) {
    const p = P[i];
    if (!p) continue;
    const r = radii[Math.min(i, radii.length - 1)] * p[3] * 1.06;
    ctx.fillStyle = `rgba(${body},${0.96 * a})`;
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${ink},${0.85 * a})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${ink},${0.45 * a})`;
    ctx.beginPath();
    ctx.arc(p[0], p[1], r * 0.32, 0, Math.PI * 2);
    ctx.stroke();
  }
  return P;
}

/** a soft halo painted (not added) — for emitters on white backgrounds */
export function halo(F, x, y, r, rgb, a) {
  const ctx = F.ctx;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.35, `rgba(${rgb},${a * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
