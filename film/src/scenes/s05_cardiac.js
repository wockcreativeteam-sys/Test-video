// 00:52–00:60  CARDIAC — signal → anatomy → diagnosis → intervention → restored rhythm
import { C } from '../palette.js';
import { E, clamp, env, lerp, seg, v3, TAU } from '../engine/util.js';
import { orbit } from '../engine/cam.js';
import { label, reticle } from '../engine/annot.js';
import { glowDot, Lines } from '../engine/lines.js';
import { headline, nameplate, chapterTag } from './common.js';
import { oncoCam, HEART_W } from './s04_onco.js';
import { drawBody, drawLifeLine, lifeHead } from './s01_signal.js';
import { buildHeart, buildCoronaries, buildHelix } from '../thorax.js';
import { pulse, HEART } from '../timeline.js';
import { ecg } from '../signals.js';
import { healwave, HW_HEAD, HW_CORE } from '../engine/healwave.js';

let HS = null, COR = null, HX = null, HXcum = null;
const U_STEN = 0.4;
export const HEAD_W = [0.0, 1.16, -16.35];

export function cardiacCam(t) {
  if (t < 52.8) return oncoCam(t);
  const u = seg(t, 52.8, 59.0, E.inOutSine);
  const out = seg(t, 59.0, 61.2, E.inOutCubic);
  let tgt = HEART_W;
  let yaw = 10 - 24 * u, pitch = 72 - 8 * u, ld = Math.log(3.6) + Math.log(1 + 0.12 * u);
  const shift = [lerp(0, 250, seg(t, 52.8, 54.0, E.inOutCubic)) * (1 - out), 0];
  tgt = v3.lerp(tgt, HEAD_W, out);
  yaw = lerp(yaw, 74, out);
  pitch = lerp(pitch, 24, out);
  ld = lerp(ld, Math.log(4.0), out);
  return { pos: orbit(tgt, yaw, pitch, Math.exp(ld)), tgt, fov: 36, shift };
}

function along(P, cum, u) {
  const L = cum[cum.length - 1] * u;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < L) i++;
  const f = (L - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return [lerp(P[(i - 1) * 3], P[i * 3], f), lerp(P[(i - 1) * 3 + 1], P[i * 3 + 1], f), lerp(P[(i - 1) * 3 + 2], P[i * 3 + 2], f)];
}

export const S05 = {
  id: 'cardiac',
  t0: 51.6,
  t1: 61.4,
  init() {
    HS = buildHeart();
    COR = buildCoronaries();
    for (const k in COR) COR[k] = { P: COR[k], cum: Lines.cum(COR[k]) };
    HX = buildHelix(4.25, 900);
    HXcum = Lines.cum(HX);
  },
  draw(F, lt, t) {
    const L = F.L;
    const ctxA = env(t, 51.8, 61.4, 0.8, 0.8);
    drawBody(F, 0.3 * ctxA, { focusZ: -12.4, focusR: 3, edgeA: 0.1, only: ['spine', 'ribs', 'aorta'], fog: [2, 10, 0.1] });
    const pz = pulse(t, HEART, 9);
    const xf = [HEART_W[0], HEART_W[1], HEART_W[2], 1 - 0.045 * pz];
    const leave = seg(t, 59.2, 60.6, E.inOutCubic);
    // the life line returns and winds the heart into being
    const wind = E.inOutSine(clamp((t - 52.2) / 2.2));
    if (t < 53.0) drawLifeLine(F, t, 0.9 * (1 - seg(t, 52.2, 53.0)), { dotOnly: true });
    if (wind > 0) {
      const recede = lerp(1, 0.72, seg(t, 54.2, 55.4, E.inOutSine));
      healwave(F, HX, { a: 0.95 * recede * (1 - leave), width: 20, strands: 10, lw: 1.3, twist: 3, phase: -t * 0.9, smooth: 14, to: wind, xf, fade: [0.55, 1], head: wind < 1 ? { r: 2.6, g: 36, gi: 0.9 } : null });
    }
    // anatomy inside
    const anat = seg(t, 53.4, 54.6, E.inOutCubic);
    const fog = [2.2, 5.6, 0.2];
    for (const s of HS) {
      const on = clamp(anat * 1.5 - Math.abs(s.Z - 124) / 30);
      if (on <= 0) continue;
      L.poly(s.P, { rgb: C.ICE, a: 0.42 * (1 - leave), w: 0.85, closed: s.closed, to: E.outCubic(on), fog, xf });
      if (s.closed && on >= 1) L.fill(s.P, { rgb: C.LUMI, a: 0.018 * (1 - leave) * anat, fog, xf });
    }
    // coronary tree
    const cor = seg(t, 53.8, 55.0, E.inOutSine);
    const stent = seg(t, 56.2, 57.0, E.outBack);
    for (const k of ['lad', 'lcx', 'rca', 'd1', 'om']) {
      const cc = COR[k];
      if (k === 'lad' && t < 56.8) {
        // stenosed: the distal LAD dims
        L.poly(cc.P, { rgb: C.WHITE, a: 0.9 * (1 - leave), w: 1.6, to: Math.min(cor, U_STEN - 0.02), cum: cc.cum, xf, layer: 2 });
        if (cor > U_STEN) L.poly(cc.P, { rgb: C.STEEL, a: 0.5 * (1 - leave), w: 1.0, from: U_STEN + 0.02, to: cor, cum: cc.cum, xf });
      } else L.poly(cc.P, { rgb: C.WHITE, a: (k === 'lad' ? 0.9 : 0.7) * (1 - leave), w: k === 'lad' ? 1.6 : 1.2, to: cor, cum: cc.cum, xf, layer: 2 });
    }
    L.flush();
    flow(F, t, xf, leave);
    stenosis(F, t, xf, stent, leave);
    ecgStrip(F, t);
    headline(F, ['FOUND BEFORE IT BECAME', 'A HEART ATTACK.'], t - 55.2, 3.4);
    // the plate sits above the ECG strip
    nameplate(F, 'CT CORONARY ANGIOGRAPHY', '128-SLICE CARDIAC CT', 'NON-INVASIVE · CORONARY ARTERIES IN 3D', t - 54.0, 4.6, { y: 800 });
    chapterTag(F, '05', 'CARDIAC CARE', t - 52.6, 7.6);
    void lifeHead;
  },
};

function flow(F, t, xf, leave) {
  const a = env(t, 54.6, 60.4, 0.4, 0.6) * (1 - leave);
  if (a <= 0) return;
  const restored = t > 56.9;
  for (const k of ['lad', 'lcx', 'rca']) {
    const cc = COR[k];
    for (let i = 0; i < 9; i++) {
      let u = ((t * 0.32 + i / 9) % 1 + 1) % 1;
      if (k === 'lad' && !restored && u > U_STEN - 0.03) {
        // blocked: particles pile up at the stenosis
        u = U_STEN - 0.03 - (i % 3) * 0.012;
      }
      const p = along(cc.P, cc.cum, u);
      const q = [xf[0] + (p[0] - xf[0]) * xf[3], xf[1] + (p[1] - xf[1]) * xf[3], xf[2] + (p[2] - xf[2]) * xf[3]];
      const s = F.cam.p(q[0], q[1], q[2]);
      if (!s) continue;
      F.L.head(s[0], s[1], { r: 1.6, rgb: C.RED, core: '255,200,205', g: 10, gi: 0.7 * a, a });
    }
  }
}

function stenosis(F, t, xf, stent, leave) {
  const cc = COR.lad;
  const p = along(cc.P, cc.cum, U_STEN);
  const q = [xf[0] + (p[0] - xf[0]) * xf[3], xf[1] + (p[1] - xf[1]) * xf[3], xf[2] + (p[2] - xf[2]) * xf[3]];
  const s = F.cam.p(q[0], q[1], q[2]);
  if (!s) return;
  const a = env(t, 54.8, 59.0, 0.3, 0.5) * (1 - leave);
  if (a <= 0) return;
  const found = t > 55.2;
  reticle(F, s[0], s[1], 18, { t: t - 54.8, dur: 0.5, a, rgb: found && t < 56.8 ? C.RED : C.WHITE });
  if (t < 56.8) label(F, 'LAD · 70% STENOSIS', s[0] + 36, s[1] - 26, { t: t - 55.2, size: 13, wt: 600, a, rgb: C.WHITE });
  else label(F, 'STENT DEPLOYED · FLOW RESTORED', s[0] + 36, s[1] - 26, { t: t - 56.8, size: 13, wt: 600, a, rgb: C.WHITE });
  if (stent > 0) {
    // stent: three zig-zag rings + struts, expanding
    const p0 = along(cc.P, cc.cum, U_STEN - 0.025), p1 = along(cc.P, cc.cum, U_STEN + 0.025);
    const ax = v3.norm(v3.sub(p1, p0));
    const n1 = v3.norm(v3.cross(ax, [0, 1, 0]));
    const n2 = v3.cross(ax, n1);
    const r = 0.012 + 0.03 * stent;
    for (let k = 0; k < 3; k++) {
      const cc0 = v3.lerp(p0, p1, k / 2);
      const pts = new Float32Array(17 * 3);
      for (let j = 0; j <= 16; j++) {
        const an = (j / 16) * TAU;
        const z = (j % 2 ? 1 : -1) * 0.008;
        const w = v3.add(v3.add(cc0, v3.add(v3.mul(n1, Math.cos(an) * r), v3.mul(n2, Math.sin(an) * r))), v3.mul(ax, z));
        const ww = [xf[0] + (w[0] - xf[0]) * xf[3], xf[1] + (w[1] - xf[1]) * xf[3], xf[2] + (w[2] - xf[2]) * xf[3]];
        pts.set(ww, j * 3);
      }
      F.L.poly(pts, { rgb: C.WHITE, a: 0.95 * a, w: 1.1, layer: 2 });
    }
    F.L.flush();
    glowDot(F, s[0], s[1], 40, C.LUMI, 0.45 * a * stent);
  }
}

function ecgStrip(F, t) {
  const a = env(t, 53.2, 59.6, 0.6, 0.6);
  if (a <= 0) return;
  const x0 = 120, x1 = 1800, y = 968, pxPerS = 260;
  const N = 900;
  const P = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const x = x0 + ((x1 - x0) * i) / (N - 1);
    const tau = t - (x1 - x) / pxPerS;
    P[i * 2] = x;
    P[i * 2 + 1] = y - ecg(tau, 0) * 46;
  }
  const fan = new Float32Array(N);
  for (let i = 0; i < N; i++) fan[i] = Math.min(1, Math.abs(ecg(t - (x1 - (x0 + ((x1 - x0) * i) / (N - 1))) / pxPerS, 0)));
  healwave(F, P, { screen: true, a: 0.9 * a, width: 18, strands: 10, lw: 1.3, twist: 1.2, phase: -t * 0.6, smooth: 50, fade: [0, 1], spread: (u, i) => 0.7 + 1.0 * fan[i] });
  F.L.head(x1, y - ecg(t, 0) * 46, { r: 2.4, rgb: HW_HEAD, core: HW_CORE, g: 26, gi: 0.8 * a, a });
  F.L.flush();
  const irregular = t > 54.0 && t < 57.0;
  label(F, 'ECG · LEAD II', x0, y - 70, { t: t - 53.3, size: 11, a: 0.6 * a, rgb: C.STEEL });
  label(F, irregular ? 'IRREGULAR RHYTHM' : t >= 57 ? 'SINUS RHYTHM RESTORED' : 'SINUS RHYTHM', x0 + 150, y - 70, {
    t: irregular ? t - 54.1 : t >= 57 ? t - 57.1 : t - 53.4,
    size: 11,
    wt: 600,
    a: 0.9 * a,
    rgb: irregular ? C.RED : C.ICE,
  });
}
