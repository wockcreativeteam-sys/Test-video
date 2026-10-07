// 00:00–00:27  THE HUMAN → SIGNAL → THE INVISIBLE → DIAGNOSE
// One red pulse becomes a trace, the trace becomes a field of signals, the field becomes the
// topography of a body, a scan ring closes every slice, the Ingenia resolves, and the body is
// segmented down to bone as the camera dives to the knee.
import { C } from '../palette.js';
import { E, clamp, env, lerp, seg, track, mulberry32, TAU, v3 } from '../engine/util.js';
import { orbit } from '../engine/cam.js';
import { HEART, pulse, sinceBeat } from '../timeline.js';
import { ecg, fieldSignal } from '../signals.js';
import { buildSlices, CM, topY } from '../anatomy.js';
import { text, swapLine } from '../engine/type.js';
import { label, dim, callout, ring } from '../engine/annot.js';
import { machineReveal, statement, chapterTag } from './common.js';

const V = 2.4; // trace speed (world units / s)
const NL = 84; // body lines
const XS = [];
for (let x = -12; x <= 12.0001; x += 0.05) XS.push(+x.toFixed(3));
const NX = XS.length;
const XH = []; // fine sampling for the life line (QRS must not alias)
for (let x = -12; x <= 12.0001; x += 0.01) XH.push(+x.toFixed(3));
const NH = XH.length;
const HALF_H = Math.round(12 / 0.01);
export const Z_HEART = -12.4;
let SL = null;
let CHEST = null; // chest top profile on XH
const buf = new Float32Array(NX * 3);
const hbuf = new Float32Array(NH * 3);
const ringBuf = new Float32Array(161 * 3);

export const KNEE = [-0.98, 0.7, -5.05];
export const RING_Y = 2.9;
export const RING_R = 3.5;
export const RING_END = -18.6;

export function signalCam(t) {
  const pos = track(
    [
      [0, [0, 0, 17.13]],
      [2.4, [0, 0, 17.13]],
      [6.5, [-2.1, 0.05, 16.4], E.inOutSine],
      [9.8, [-2.4, 0.12, 15.6], E.inOutSine],
      [13.4, [-1.6, 6.6, 12.6], E.inOutCubic],
      [15.6, [-3.4, 7.4, 8.2], E.inOutSine],
      [17.8, [-10.4, 6.2, 0.6], E.inOutCubic],
      [19.6, [-6.2, 5.0, 8.6], E.inOutSine],
      [21.6, [-4.4, 4.5, 12.8], E.inOutSine],
      [23.4, [-4.2, 4.6, 16.4], E.inOutSine],
      [26.6, [-3.6, 2.6, -1.6], E.inOutQuart],
    ],
    t
  );
  const tgt = track(
    [
      [0, [0, 0, 0]],
      [2.4, [0, 0, 0]],
      [6.5, [-2.1, 0, 0], E.inOutSine],
      [9.8, [-2.4, 0.05, 0], E.inOutSine],
      [13.4, [-0.6, 0.2, -6.0], E.inOutCubic],
      [15.6, [0, 0.5, -8.4], E.inOutSine],
      [17.8, [0, 0.8, -9.6], E.inOutCubic],
      [19.6, [0, 1.6, -13.0], E.inOutSine],
      [21.6, [0, RING_Y, RING_END], E.inOutSine],
    ],
    t
  );
  if (t <= 21.6) return { pos, tgt, fov: track([[0, 35], [12, 35], [16, 38], [19.6, 36], [21.6, 33]], t) };
  // pull back until the ring is the size of the photographed bore, hold, then log-zoom to the knee
  const B = [0, RING_Y, RING_END];
  const u1 = seg(t, 21.6, 22.55, E.inOutCubic);
  const hold = seg(t, 22.55, 24.3, E.inOutSine);
  const u2 = seg(t, 24.15, 26.6, E.inOutQuart);
  let yaw = lerp(-8, -16, u1) + 2.5 * hold;
  let pitch = lerp(3, 11, u1) + 1.0 * hold;
  let ld = lerp(Math.log(31.7), Math.log(MATCH_D), u1) + Math.log(1 - 0.05 * hold);
  const T2 = v3.lerp(B, KNEE, u2);
  yaw = lerp(yaw, -35, u2);
  pitch = lerp(pitch, 28, u2);
  ld = lerp(ld, Math.log(4.2), u2);
  return { pos: orbit(T2, yaw, pitch, Math.exp(ld)), tgt: T2, fov: lerp(lerp(33, 30, u1), 34, u2) };
}
const MATCH_D = 128;

// ---------------------------------------------------------------------------
export const S01 = {
  id: 'signal',
  t0: 0,
  t1: 27.6,
  init() {
    SL = buildSlices(NL, 1.5, 178, XS);
    const r = mulberry32(7);
    SL.jit = SL.Z.map(() => r());
    CHEST = new Float32Array(NH);
    for (let j = 0; j < NH; j++) CHEST[j] = Math.abs(XH[j]) < 3.2 ? topY(XH[j] / CM, 124) * CM : 0;
  },
  draw(F, lt, t) {
    if (t > 9.9 && t < 22.3) drawField(F, t);
    if (t > 17.8) drawScan(F, t);
    drawLifeLine(F, t, 1 - seg(t, 23.0, 24.4));
    if (t > 23.0) drawLifeLine(F, t, seg(t, 23.0, 24.4), { dotOnly: true });
    if (t < 10.6) drawRulerAndData(F, t);
    drawOpeningType(F, t);
    if (t > 21.0 && t < 25.6) drawIngenia(F, t);
    statement(F, 'SEE DEEPER.', 120, 214, t - 17.3, 2.5);
    statement(F, 'UNDERSTAND MORE.', 120, 214, t - 23.3, 2.4);
    chapterTag(F, '01', 'DIAGNOSE', t - 17.6, 8.2);
  },
};

// ---------------------------------------------------------------------------
// the life line. Before 15 s it is the trace on the z=0 "paper"; from 15 s it migrates into the
// chest of the body and keeps beating there until the cardiac chapter claims it.
function traceY(x, t) {
  if (x > 0) return 0; // the future: flat
  const tau = t + x / V;
  if (tau < 2.0) return 0;
  return ecg(tau, 0);
}
export function lifeLineZ(t) {
  return lerp(0, Z_HEART, seg(t, 15.0, 17.6, E.inOutCubic));
}
export function lifeHead(t) {
  const m = seg(t, 15.0, 17.6, E.inOutCubic);
  return [0, lerp(traceY(0, t), CHEST[HALF_H] + 0.24 * ecg(t, 0), m) + m * 0.02, lifeLineZ(t)];
}
export function drawLifeLine(F, t, alpha = 1, o = {}) {
  if (t < 1.0 || alpha <= 0) return;
  const L = F.L;
  const pz = pulse(t);
  const appear = seg(t, 1.0, 1.8, E.outCubic);
  const breath = 0.5 + 0.5 * Math.sin((t - 1.0) * 1.7);
  const m = seg(t, 15.0, 17.6, E.inOutCubic);
  const z = lifeLineZ(t);
  const open = seg(t, 2.0, 3.1, E.outExpo);
  const a = alpha;
  if (open > 0 && !o.dotOnly) {
    for (let j = 0; j < NH; j++) {
      const x = XH[j];
      const y0 = traceY(x, t);
      const y1 = CHEST[j] + (x <= 0 ? 0.24 * ecg(t + x / V, 0) : 0);
      hbuf[j * 3] = x;
      hbuf[j * 3 + 1] = lerp(y0, y1, m);
      hbuf[j * 3 + 2] = z;
    }
    // history: draw from the head (index HALF_H) back to the left edge
    const hist = new Float32Array((HALF_H + 1) * 3);
    for (let j = 0; j <= HALF_H; j++) {
      const s = (HALF_H - j) * 3;
      hist[j * 3] = hbuf[s];
      hist[j * 3 + 1] = hbuf[s + 1];
      hist[j * 3 + 2] = hbuf[s + 2];
    }
    const fadeEnd = lerp(0.05, 0.0, m);
    const reach = open * lerp(1, 0.3, seg(t, 18.0, 21.4, E.inOutSine));
    L.poly(hist, { rgb: C.RED, a: 0.95 * a, w: o.w ?? 1.6, layer: 2, to: reach, fade: [1, fadeEnd], persp: m > 0 ? 95 : 0 });
    const fut = hbuf.subarray(HALF_H * 3);
    L.poly(fut, { rgb: m > 0.5 ? C.RED : C.STEEL, a: lerp(0.45, 0.9, m) * a, w: lerp(1, o.w ?? 1.6, m), layer: m > 0.5 ? 2 : 0, to: reach, fade: [1, 0], persp: m > 0 ? 95 : 0 });
  }
  const hp = lifeHead(t);
  const p = F.cam.p(hp[0], hp[1], hp[2]);
  if (p && appear > 0) {
    const r = (2.6 + breath * 0.5 * (1 - open) + pz * 1.6) * (m > 0 ? clamp(p[3] / 110, 0.6, 1.2) : 1);
    const dot = o.dotOnly ? 0.45 : 1;
    L.head(p[0], p[1], {
      r: o.dotOnly ? 2.0 + pz * 1.2 : r,
      rgb: C.RED,
      core: '255,226,226',
      a: appear * a,
      g: (34 + pz * 70 + breath * 8) * (1 - 0.4 * m) * dot,
      gi: (0.75 + pz * 0.25) * (o.dotOnly ? 0.6 : 1),
      streak: (60 + pz * 160) * (1 - m),
    });
    if (t < 12) {
      const s = sinceBeat(t);
      if (s < 0.9) ring(F, p[0], p[1], 6 + E.outCubic(s / 0.9) * 120, { rgb: C.RED, a: 0.35 * (1 - s / 0.9) * appear * a, w: 1 });
    }
  }
}

// ---------------------------------------------------------------------------
// ruler + measurements under/over the trace (2D labels anchored in world)
function drawRulerAndData(F, t) {
  const cam = F.cam;
  const aR = env(t, 3.4, 10.4, 0.8, 0.6);
  if (aR <= 0) return;
  const ctx = F.ctx;
  ctx.save();
  ctx.lineWidth = 1;
  const tauMin = t - 12 / V, tauMax = t + 12 / V;
  const k0 = Math.ceil(tauMin / 0.04), k1 = Math.floor(tauMax / 0.04);
  ctx.beginPath();
  for (let k = k0; k <= k1; k++) {
    const tau = k * 0.04;
    const x = (tau - t) * V;
    const maj = k % 5 === 0;
    const sec = k % 25 === 0;
    const a = cam.p(x, -1.25, 0), b = cam.p(x, sec ? -1.55 : maj ? -1.42 : -1.33, 0);
    if (!a || !b) continue;
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.strokeStyle = `rgba(${C.STEEL},${0.5 * aR})`;
  ctx.stroke();
  ctx.restore();
  for (let s = Math.ceil(tauMin); s <= Math.floor(tauMax); s++) {
    const q = cam.p((s - t) * V, -1.86, 0);
    if (!q) continue;
    const fadeEdge = clamp(1 - Math.abs(q[0] - 960) / 1000);
    label(F, `00:${String(s).padStart(2, '0')}`, q[0], q[1], { align: 'c', size: 11, a: 0.5 * aR * fadeEdge, rgb: C.STEEL, instant: true });
  }
  const aD = env(t, 7.2, 10.2, 0.6, 0.5);
  if (aD <= 0) return;
  for (let i = 0; i < HEART.length; i++) {
    const b = HEART[i];
    if (b > t - 0.05 || b < 3) continue;
    const x = (b - t) * V;
    if (x < -11) continue;
    const q = cam.p(x, 1.16, 0);
    if (!q) continue;
    const born = clamp((t - Math.max(b, 7.2)) / 0.4);
    label(F, 'R', q[0], q[1] - 8, { align: 'c', size: 11, a: 0.8 * aD * born, rgb: C.ICE, instant: true });
    const nb = HEART[i + 1];
    if (nb && nb < t - 0.05) {
      const q2 = cam.p((nb - t) * V, 1.16, 0);
      if (q2)
        dim(F, q[0] + 10, q[1] - 30, q2[0] - 10, q2[1] - 30, `${Math.round((nb - b) * 1000)} MS`, {
          t: (t - Math.max(nb, 7.4)) * 1.6,
          a: 0.55 * aD,
          rgb: C.STEEL,
          lrgb: C.ICE,
          off: -13,
        });
    }
  }
  const h = cam.p(0, 0, 0);
  if (h) {
    const rows = [
      ['HR', '60', 'BPM', 7.6],
      ['RR', '1000', 'MS', 8.1],
      ['QRS', '92', 'MS', 8.6],
      ['SPO2', '98', '%', 9.0],
    ];
    rows.forEach(([k, v, u, ts], i) => {
      const tt = t - ts;
      if (tt <= 0) return;
      const y = h[1] - 160 + i * 24;
      label(F, k, h[0] + 70, y, { t: tt, size: 12, a: 0.55 * aD, rgb: C.STEEL });
      label(F, v, h[0] + 158, y, { t: tt - 0.1, size: 13, wt: 500, a: 0.95 * aD, rgb: C.ICE, align: 'r' });
      label(F, u, h[0] + 166, y, { t: tt - 0.15, size: 11, a: 0.5 * aD, rgb: C.STEEL });
    });
  }
}

// ---------------------------------------------------------------------------
function drawOpeningType(F, t) {
  if (t < 3.3 || t > 10.4) return;
  const y = 812;
  const s = { fam: 'D', wt: 300, size: 32, track: 0.34, rgb: C.ICE, a: 0.94 };
  if (t < 6.55) {
    text(F, 'EVERY SECOND MATTERS.', 960, y, { ...s, align: 'c', anim: { mode: 'blur', t: t - 3.4, dur: 0.9, stag: 0.035, blurPx: 9 } });
  } else {
    const a = 1 - seg(t, 9.3, 10.2, E.inCubic);
    swapLine(F, 'EVERY', 'SECOND', 'DECISION', 'MATTERS.', 960, y, { ...s, a: 0.94 * a }, (t - 6.6) / 0.55);
  }
}

// ---------------------------------------------------------------------------
// the field: copies peel off the trace, fan into depth, then become the body's topography
function lineZ(i) {
  return -SL.Z[i] * CM;
}
function scrollAt(t) {
  const T0 = 14.6, T1 = 17.0;
  if (t <= T0) return t;
  const u = Math.min(1, (t - T0) / (T1 - T0));
  return T0 + (u - (u / 2 - Math.sin(Math.PI * u) / (2 * Math.PI))) * (T1 - T0);
}
export function scanRingZ(t) {
  if (t < 18.0) return null;
  return lerp(0.8, -18.6, E.inOutSine(clamp((t - 18.0) / 3.6)));
}
function revealOf(i, t) {
  const zr = scanRingZ(t);
  if (zr === null) return 0;
  return clamp((lineZ(i) + 0.05 - zr) / 0.9);
}

function drawField(F, t) {
  const L = F.L;
  const m = seg(t, 15.0, 17.6, E.inOutCubic);
  const scroll = scrollAt(t);
  const segm = seg(t, 23.4, 25.2, E.inOutCubic);
  const fogA = [8, 30, 0.16];
  for (let i = 0; i < NL; i++) {
    const born = 9.95 + i * 0.022;
    if (t < born) continue;
    const u = E.outCubic(clamp((t - born) / 1.7));
    const z = lerp(0, lineZ(i), u);
    const delay = i * 0.006;
    const prof = SL.profile[i];
    const sigAmp = (1 - m) * (0.55 + 0.45 * SL.jit[i]);
    const rv = revealOf(i, t);
    for (let j = 0; j < NX; j++) {
      const x = XS[j];
      const tau = scroll + x / V;
      let ySig = 0;
      if (sigAmp > 0.001) ySig = lerp(ecg(tau, 0, HEART, 0, 2.2), fieldSignal(i, tau, delay), u) * sigAmp;
      buf[j * 3] = x;
      buf[j * 3 + 1] = ySig + prof[j * 3 + 1] * m;
      buf[j * 3 + 2] = z;
    }
    const near = clamp(1 - i / NL);
    const a = (0.32 + 0.42 * near) * u * (1 - 0.6 * rv) * (1 - 0.85 * segm) * (1 - seg(t, 20.8, 22.2, E.inOutSine));
    const drawn = E.outCubic(clamp((t - born) / 0.9));
    L.poly(buf, { rgb: C.ICE, a, w: 1.05, from: 0.5 - drawn * 0.5, to: 0.5 + drawn * 0.5, fog: fogA, persp: 100 });
  }
}

// ---------------------------------------------------------------------------
// the scan: a 70 cm gantry ring travels the body away from us; every slice it passes closes into
// a full cross-section with its organs and fills into an X-ray volume. Then segmentation: soft
// tissue recedes, bone remains.
function drawScan(F, t) {
  const L = F.L;
  const zr = scanRingZ(t);
  const segm = seg(t, 23.4, 25.2, E.inOutCubic);
  const vol = 0;
  const gone = seg(t, 25.0, 26.4, E.inOutSine);
  const fogA = [8, 140, 0.35];
  for (let i = 0; i < NL; i++) {
    const rv = revealOf(i, t);
    if (rv <= 0) continue;
    const draw = E.inOutCubic(rv);
    for (const o of SL.outer[i]) {
      L.poly(o.P, { rgb: C.ICE, a: 0.34 * (1 - 0.85 * segm) * (1 - gone), w: 0.9, closed: o.closed, to: draw, fog: fogA, persp: 110 });
      if (vol > 0 && o.closed) L.fill(o.P, { rgb: C.LUMI, a: 0.022 * vol * (1 - segm), fog: fogA });
    }
    for (const o of SL.organs[i]) {
      const bone = o.kind === 'bone';
      const a = (bone ? lerp(0.5, 0.75, segm) : 0.4 * (1 - segm)) * (1 - gone);
      const rgb = bone ? C.ICE : o.kind === 'vessel' ? C.STEEL : C.LUMI;
      L.poly(o.P, { rgb, a, w: bone ? 1.05 : 0.85, closed: o.closed, to: draw, fog: fogA, persp: 260 });
      if (vol > 0 && o.closed) L.fill(o.P, { rgb: bone ? C.ICE : C.LUMI, a: (bone ? 0.07 * (0.6 + segm) : 0.04 * (1 - segm)) * vol, fog: fogA });
    }
  }
  const ringA = env(t, 17.9, 23.2, 0.5, 0.7);
  if (zr !== null && ringA > 0) {
    const cy = RING_Y, R = RING_R;
    const spin = t * TAU * 1.6;
    for (let k = 0; k <= 160; k++) {
      const an = (k / 160) * TAU;
      ringBuf[k * 3] = Math.cos(an) * R;
      ringBuf[k * 3 + 1] = cy + Math.sin(an) * R;
      ringBuf[k * 3 + 2] = zr;
    }
    L.poly(ringBuf, { rgb: C.ICE, a: 0.85 * ringA, w: 1.6, layer: 2 });
    const R2 = R * 1.11;
    for (let k = 0; k <= 160; k++) {
      const an = (k / 160) * TAU;
      ringBuf[k * 3] = Math.cos(an) * R2;
      ringBuf[k * 3 + 1] = cy + Math.sin(an) * R2;
    }
    L.poly(ringBuf, { rgb: C.STEEL, a: 0.4 * ringA, w: 1 });
    const tk = new Float32Array(6);
    for (let k = 0; k < 72; k++) {
      const an = (k / 72) * TAU;
      const r1 = k % 6 === 0 ? R * 1.08 : R * 1.045;
      tk[0] = Math.cos(an) * R * 1.016; tk[1] = cy + Math.sin(an) * R * 1.016; tk[2] = zr;
      tk[3] = Math.cos(an) * r1; tk[4] = cy + Math.sin(an) * r1; tk[5] = zr;
      L.poly(tk, { rgb: C.STEEL, a: 0.55 * ringA, w: 1 });
    }
    const sx = Math.cos(spin) * R, sy = cy + Math.sin(spin) * R;
    const fan = new Float32Array(6);
    for (let k = -6; k <= 6; k++) {
      const an = spin + Math.PI + k * 0.055;
      fan[0] = sx; fan[1] = sy; fan[2] = zr;
      fan[3] = Math.cos(an) * R; fan[4] = cy + Math.sin(an) * R; fan[5] = zr;
      L.poly(fan, { rgb: C.LUMI, a: 0.13 * ringA, w: 1 });
    }
    const arc = new Float32Array(17 * 3);
    for (let k = 0; k <= 16; k++) {
      const an = spin - 0.18 + (k / 16) * 0.36;
      arc[k * 3] = Math.cos(an) * R; arc[k * 3 + 1] = cy + Math.sin(an) * R; arc[k * 3 + 2] = zr;
    }
    L.poly(arc, { rgb: C.WHITE, a: 0.95 * ringA, w: 2.6, layer: 2 });
    const sp = F.cam.p(sx, sy, zr);
    if (sp) L.head(sp[0], sp[1], { r: 2.2, rgb: C.LUMI, g: 36, gi: 0.9 * ringA });
    let best = -1, bd = 1e9;
    for (let i = 0; i < NL; i++) {
      const d = Math.abs(lineZ(i) - zr);
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0 && bd < 0.3) {
      for (const o of SL.outer[best]) L.poly(o.P, { rgb: C.WHITE, a: 0.9 * ringA, w: 1.4, closed: o.closed, layer: 2 });
      for (const o of SL.organs[best]) L.poly(o.P, { rgb: C.LUMI, a: 0.8 * ringA, w: 1.1, closed: o.closed, layer: 2 });
    }
    L.flush();
    const top = F.cam.p(0, cy + R * 1.12, zr);
    if (top) {
      const sl = Math.round(clamp((0.8 - zr) / (0.8 - RING_END)) * 128);
      const tt = t - 18.3;
      const la = ringA * (1 - seg(t, 21.4, 22.0));
      label(F, 'Ø 70 CM', top[0], top[1] - 30, { t: tt, align: 'c', size: 12, rgb: C.ICE, a: 0.85 * la });
      label(F, `SLICE ${String(sl).padStart(3, '0')} / 128`, top[0], top[1] - 12, { t: tt - 0.1, align: 'c', size: 11, rgb: C.STEEL, a: 0.75 * la });
    }
  }
}

// ---------------------------------------------------------------------------
// The ring arrives at the head and the real scanner resolves around it: the photograph is
// registered to the projected ring every frame (bore centre/radius measured in the cut-out).
const BORE = { x: 166, y: 99, r: 31.5 };
function drawIngenia(F, t) {
  const u = t - 22.2;
  const out = seg(t, 24.2, 25.1);
  const c = F.cam.p(0, RING_Y, RING_END);
  const e = F.cam.p(RING_R, RING_Y, RING_END);
  if (!c || !e) return;
  const rpx = Math.hypot(e[0] - c[0], e[1] - c[1]);
  const s = rpx / BORE.r;
  const x = c[0] - BORE.x * s, y = c[1] - BORE.y * s;
  const box = machineReveal(F, 'ingenia', x, y, s, u, { out, lineDur: 0.5, wipeDur: 0.5, restLines: 0.1, filter: 'brightness(0.9) contrast(1.05) saturate(0.85)' });
  if (!box) return;
  const a = 1 - out;
  callout(F, x + box.w * 0.62, y + box.h * 0.12, x + box.w + 70, y - 36, [
    ['PHILIPS INGENIA 3.0T EVOLUTION'],
    ['SMARTSPEED · UP TO 3× FASTER'],
  ], { t: u - 0.7, a, glow: true, glowRgb: C.LUMI });
  callout(F, x + box.w * 0.16, y + box.h * 0.62, x - 70, y + box.h + 40, [
    ['128-SLICE CT'],
    ['DUAL-ENERGY · LOW DOSE'],
  ], { t: u - 1.0, a });
}

// ---------------------------------------------------------------------------
/** the reconstructed body as context for later chapters (revealed state) */
export function drawBody(F, alpha, o = {}) {
  if (alpha <= 0) return;
  const L = F.L;
  const fog = o.fog || [4, 26, 0.12];
  const zMin = o.zMin ?? -99, zMax = o.zMax ?? 99;
  for (let i = 0; i < NL; i++) {
    const z = lineZ(i);
    if (z < zMin || z > zMax) continue;
    let a = alpha;
    if (o.focusZ !== undefined) a *= lerp(1, o.edgeA ?? 0.25, clamp(Math.abs(z - o.focusZ) / (o.focusR ?? 4)));
    const near = o.near || [0.8, 2.6];
    for (const s of SL.outer[i]) L.poly(s.P, { rgb: C.ICE, a: 0.3 * a, w: 0.85, closed: s.closed, fog, persp: 160, near });
    if (o.organs !== false)
      for (const s of SL.organs[i]) {
        const bone = s.kind === 'bone';
        if (o.only && !o.only.includes(s.name)) continue;
        L.poly(s.P, { rgb: bone ? C.ICE : C.LUMI, a: (bone ? 0.32 : 0.26) * a, w: 0.8, closed: s.closed, fog, persp: 160, near });
      }
  }
}
