// 00:44–00:52  ONCOLOGY — detect → characterise → target → treat → monitor
import { C } from '../palette.js';
import { E, clamp, env, lerp, seg, v3, TAU } from '../engine/util.js';
import { orbit } from '../engine/cam.js';
import { label, callout, reticle, brackets, ring, dim } from '../engine/annot.js';
import { glowDot } from '../engine/lines.js';
import { statement, chapterTag } from './common.js';
import { davinciCam } from './s03_davinci.js';
import { drawBody, drawLifeLine } from './s01_signal.js';
import { buildLungs, buildBronchi, buildNodule, NODULE, W, heart as heartSDF } from '../thorax.js';
import { bodySDF } from '../anatomy.js';

let LU = null, BR = null, NO = null, BEAMS = null;
export const NW = W(...NODULE);
export const HEART_W = [0.374, 1.384, -12.4];

export function oncoCam(t) {
  if (t < 44.4) return davinciCam(t);
  // anterior view: superior up, the patient's left on screen-right (anatomical convention)
  const u1 = seg(t, 44.4, 46.4, E.inOutSine);
  const u2 = seg(t, 46.4, 50.4, E.inOutSine);
  const u3 = seg(t, 50.6, 52.8, E.inOutCubic);
  let tgt = v3.lerp([0.75, 1.25, -12.9], [0.42, 1.3, -12.85], u1);
  let yaw = lerp(-8, 2, u1) + 10 * u2;
  let pitch = lerp(62, 70, u1) + 3 * u2;
  let ld = lerp(Math.log(6.2), Math.log(5.6), u1) + Math.log(1 + 0.08 * u2);
  const shift = [lerp(0, 120, u1) * (1 - u3), 0];
  tgt = v3.lerp(tgt, HEART_W, u3);
  yaw = lerp(yaw, 10, u3);
  pitch = lerp(pitch, 72, u3);
  ld = lerp(ld, Math.log(3.6), u3);
  return { pos: orbit(tgt, yaw, pitch, Math.exp(ld)), tgt, fov: 36, shift };
}

function buildBeams() {
  // directions over the upper hemisphere (patient lies on the table), excluding any path that
  // passes within 1.2 cm of the heart or the spinal canal
  const out = [];
  const N = 46;
  const spine = (x, y, z) => Math.hypot(x - 0, y - 5.0) - 2.2;
  for (let i = 0; i < N; i++) {
    const yv = 1 - (i + 0.5) / N; // 1..0 (upper hemisphere only)
    const r = Math.sqrt(1 - yv * yv);
    const th = i * 2.39996;
    const dir = [Math.cos(th) * r, yv * 0.9 + 0.1, Math.sin(th) * r * 0.55];
    const d = v3.norm(dir);
    let ok = true;
    for (let s = 0.6; s < 26; s += 0.4) {
      const p = v3.add(NODULE, v3.mul(d, s));
      if (bodySDF(p[0], p[1], p[2]) > 2) break;
      if (heartSDF(p[0], p[1], p[2]) < 1.2 || spine(p[0], p[1], p[2]) < 1.2) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(d);
  }
  // keep an even dozen
  const step = Math.max(1, Math.floor(out.length / 12));
  return out.filter((_, i) => i % step === 0).slice(0, 12);
}

export const S04 = {
  id: 'onco',
  t0: 43.6,
  t1: 53.0,
  init() {
    LU = buildLungs();
    BR = buildBronchi();
    NO = buildNodule();
    BEAMS = buildBeams();
  },
  draw(F, lt, t) {
    const L = F.L;
    const ctxA = env(t, 43.8, 53.0, 0.8, 0.6);
    drawBody(F, 0.4 * ctxA, { focusZ: -12.8, focusR: 4, edgeA: 0.1, organs: true, only: ['spine', 'ribs', 'aorta', 'heart'], fog: [2.5, 14, 0.1] });
    drawLifeLine(F, t, 0.85 * ctxA, { dotOnly: true });
    // lungs
    const appear = seg(t, 44.0, 45.4, E.inOutCubic);
    const leave = seg(t, 51.2, 52.6, E.inOutCubic);
    const fog = [2.5, 8.5, 0.18];
    const focus = F.cam.depth(...NW);
    for (const s of LU) {
      const on = clamp(appear * 1.6 - Math.abs(s.Z - 128) / 40);
      if (on <= 0) continue;
      L.poly(s.P, { rgb: C.LUMI, a: 0.3 * (1 - leave), w: 0.85, closed: s.closed, to: E.outCubic(on), fog, dof: [focus, 1.8, 2.0] });
    }
    // bronchial tree grows outward by generation
    const grow = seg(t, 44.3, 45.9, E.inOutSine);
    for (const b of BR) {
      const g0 = b.gen / 8;
      const u = clamp((grow - g0) * 6);
      if (u <= 0) continue;
      L.poly(b.P, { rgb: C.ICE, a: (0.55 - b.gen * 0.05) * (1 - leave), w: Math.max(0.7, 2.2 - b.gen * 0.25), to: u, fog, dof: [focus, 1.8, 2.0] });
    }
    // nodule
    const det = seg(t, 46.0, 46.4);
    for (const s of NO) {
      L.poly(s.P, { rgb: det > 0 ? C.WHITE : C.ICE, a: (0.45 + 0.5 * det) * (1 - leave * 0.6) * appear, w: 1.0, closed: s.closed, layer: det > 0 ? 2 : 0 });
    }
    L.flush();
    detect(F, t);
    characterise(F, t);
    target(F, t);
    monitor(F, t);
    statement(F, 'TARGET WHAT MATTERS.', 120, 214, t - 47.5, 3.1);
    chapterTag(F, '04', 'ONCOLOGY', t - 44.6, 7.8);
  },
};

function detect(F, t) {
  const a = env(t, 44.9, 47.0, 0.3, 0.4);
  if (a <= 0) return;
  const n = F.cam.p(...NW);
  if (!n) return;
  // a search reticle sweeps the lung, then locks
  const hunt = clamp((t - 44.9) / 1.2);
  const lock = clamp((t - 46.0) / 0.3);
  const sx = n[0] + (1 - E.outCubic(hunt)) * Math.cos(t * 5.1) * 220 * (1 - lock);
  const sy = n[1] + (1 - E.outCubic(hunt)) * Math.sin(t * 3.7) * 140 * (1 - lock);
  reticle(F, sx, sy, 26, { t: t - 44.9, dur: 1.4, a, rgb: lock > 0 ? C.WHITE : C.ICE });
  if (lock > 0) {
    glowDot(F, n[0], n[1], 60, C.LUMI, 0.5 * a * lock);
    label(F, 'NODULE DETECTED', n[0] + 44, n[1] - 34, { t: t - 46.05, size: 13, wt: 600, a, rgb: C.WHITE });
  }
}

function characterise(F, t) {
  const a = env(t, 46.4, 49.6, 0.3, 0.5);
  if (a <= 0) return;
  const n = F.cam.p(...NW);
  if (!n) return;
  const r = 0.46 * 0.1 * n[3] * 1.6;
  brackets(F, n[0] - r, n[1] - r, r * 2, r * 2, { t: t - 46.4, a, len: 9 });
  dim(F, n[0] - r, n[1] + r + 18, n[0] + r, n[1] + r + 18, 'Ø 9.2 MM', { t: t - 46.6, a, off: 16 });
  // dual-energy panel
  const px = 1420, py = 700, pw = 360, ph = 150;
  const u = clamp((t - 46.8) / 0.5);
  const ctx = F.ctx;
  ctx.save();
  ctx.strokeStyle = `rgba(${C.STEEL},${0.6 * a * u})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py + ph);
  ctx.lineTo(px + pw * u, py + ph);
  ctx.stroke();
  const curves = [
    [C.STEEL, (k) => 60 + 30 * Math.exp(-k * 0.02), 'SOFT TISSUE'],
    [C.STEEL, (k) => 50 + 820 * Math.exp(-k * 0.035), 'CALCIUM'],
    [C.WHITE, (k) => 70 + 210 * Math.exp(-k * 0.03), 'NODULE'],
  ];
  for (const [rgb, f, name] of curves) {
    ctx.strokeStyle = `rgba(${rgb},${(name === 'NODULE' ? 0.95 : 0.5) * a})`;
    ctx.lineWidth = name === 'NODULE' ? 1.6 : 1;
    ctx.beginPath();
    for (let i = 0; i <= 60 * u; i++) {
      const k = 40 + i * (100 / 60);
      const X = px + (i / 60) * pw;
      const Y = py + ph - Math.min(ph, (f(k) / 900) * ph * 2.2);
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
    ctx.stroke();
  }
  ctx.restore();
  label(F, 'DUAL-ENERGY CT · TISSUE CHARACTERISATION', px, py - 18, { t: t - 46.8, size: 12, wt: 600, a });
  label(F, '40 KEV', px, py + ph + 20, { t: t - 47.0, size: 10.5, a: 0.6 * a, rgb: C.STEEL });
  label(F, '140 KEV', px + pw, py + ph + 20, { t: t - 47.0, size: 10.5, a: 0.6 * a, rgb: C.STEEL, align: 'r' });
  label(F, 'NODULE', px + pw * 0.62, py + ph * 0.46, { t: t - 47.3, size: 10.5, a: 0.9 * a, rgb: C.WHITE });
}

function target(F, t) {
  const a = env(t, 47.6, 51.2, 0.3, 0.6);
  if (a <= 0) return;
  const L = F.L;
  const n = F.cam.p(...NW);
  if (!n) return;
  // coordinate
  label(F, 'X 92.0  Y 142.0  Z 1276.0 MM', n[0] + 40, n[1] + 66, { t: t - 47.7, size: 12, a: 0.85 * a });
  // converging vectors, staggered
  BEAMS.forEach((d, i) => {
    const t0 = 48.0 + i * 0.09;
    const u = E.outCubic(clamp((t - t0) / 0.6));
    if (u <= 0) return;
    const far = v3.add(NODULE, v3.mul(d, 34));
    const from = W(...far);
    const P = new Float32Array([...from, ...NW]);
    L.poly(P, { rgb: C.LUMI, a: 0.75 * a, w: 1.2, from: 0, to: u, layer: 2, fade: [0.05, 1] });
  });
  L.flush();
  const conv = seg(t, 48.9, 49.5);
  if (conv > 0) {
    glowDot(F, n[0], n[1], 90 * conv, C.WHITE, 0.55 * a);
    const k = n[3] * 0.1;
    ring(F, n[0], n[1], 0.75 * k * conv, { rgb: C.WHITE, a: 0.9 * a, w: 1.3 });
    ring(F, n[0], n[1], 1.15 * k * conv, { rgb: C.LUMI, a: 0.6 * a, w: 1 });
    ring(F, n[0], n[1], 1.8 * k * conv, { rgb: C.STEEL, a: 0.45 * a, w: 1, dash: [3, 4] });
    label(F, '95%', n[0] + 0.75 * k + 6, n[1] - 4, { t: t - 49.2, size: 10.5, a: 0.8 * a });
    label(F, '50%', n[0] + 1.8 * k + 6, n[1] - 4, { t: t - 49.3, size: 10.5, a: 0.6 * a, rgb: C.STEEL });
  }
  // protected structures
  const pa = env(t, 48.5, 51.2, 0.4, 0.5) * a;
  const hp = F.cam.p(...W(2.8, 13.2, 123.5));
  const sp = F.cam.p(...W(0, 5.0, 126));
  if (hp) callout(F, hp[0], hp[1], hp[0] - 160, hp[1] + 120, [['HEART'], ['SPARED']], { t: t - 48.6, a: pa });
  if (sp) callout(F, sp[0], sp[1], sp[0] - 160, sp[1] + 90, [['SPINAL CORD'], ['SPARED']], { t: t - 48.8, a: pa });
}

function monitor(F, t) {
  const a = env(t, 49.8, 52.0, 0.4, 0.4);
  if (a <= 0) return;
  const px = 1420, py = 720, pw = 360, ph = 110;
  const vals = [1.0, 0.62, 0.31, 0.16];
  const u = clamp((t - 49.9) / 1.0);
  const ctx = F.ctx;
  ctx.save();
  ctx.strokeStyle = `rgba(${C.STEEL},${0.5 * a})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, py + ph);
  ctx.lineTo(px + pw, py + ph);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${C.WHITE},${0.95 * a})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const n = vals.length - 1;
  for (let i = 0; i <= 60 * u; i++) {
    const s = i / 60;
    const k = Math.min(n - 1, Math.floor(s * n));
    const f = s * n - k;
    const v = lerp(vals[k], vals[k + 1], E.inOutSine(f));
    const X = px + s * pw, Y = py + ph - v * ph;
    if (i === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  }
  ctx.stroke();
  ctx.restore();
  vals.forEach((v, i) => {
    if (i / n > u + 0.01) return;
    const X = px + (i / n) * pw, Y = py + ph - v * ph;
    ring(F, X, Y, 3.5, { rgb: C.WHITE, a: a, w: 1.2 });
    label(F, `WK ${i * 4}`, X, py + ph + 20, { t: t - 50.0 - i * 0.15, size: 10.5, align: 'c', a: 0.6 * a, rgb: C.STEEL });
  });
  label(F, 'RESPONSE · TUMOUR VOLUME', px, py - 18, { t: t - 49.9, size: 12, wt: 600, a });
  void TAU;
}
