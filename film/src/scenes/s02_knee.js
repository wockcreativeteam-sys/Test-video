// 00:25.4–00:36.6  PLAN · PRECISION (MAKO)
// Segmented knee → resection planes → haptic boundary → a robotic arm mills only inside it.
import { C } from '../palette.js';
import { E, clamp, env, lerp, seg, v3, TAU } from '../engine/util.js';
import { orbit } from '../engine/cam.js';
import { label, callout, ruler } from '../engine/annot.js';
import { text } from '../engine/type.js';
import { machineReveal, statement, chapterTag, drawArm } from './common.js';
import { signalCam, KNEE, drawLifeLine } from './s01_signal.js';
import { buildKnee, buildKneeSagittal, toWorld, KX, FEMUR_TIP, DISTAL_CUT, TIBIA_TOP, TIBIAL_CUT } from '../knee.js';

let K = null, KS = null;
export const ABD = [0.15, 1.0, -10.2];

export function kneeCam(t) {
  if (t < 26.6) return signalCam(t);
  const T0 = [KNEE[0], KNEE[1], KNEE[2]];
  const u1 = seg(t, 26.6, 28.6, E.inOutSine);
  const u2 = seg(t, 28.6, 31.4, E.inOutSine);
  const u3 = seg(t, 31.4, 35.0, E.inOutSine);
  const u4 = seg(t, 35.0, 36.8, E.inOutCubic);
  let yaw = -35 + (-62 + 35) * u1 + (-84 + 62) * u2 + (-98 + 84) * u3;
  let pitch = 28 - 8 * u1 - 4 * u2 + 10 * u3;
  let ld = Math.log(4.2) + (Math.log(3.75) - Math.log(4.2)) * u1 + (Math.log(3.35) - Math.log(3.75)) * u2 + (Math.log(2.95) - Math.log(3.35)) * u3;
  let tgt = v3.lerp(T0, [KNEE[0] + 0.02, KNEE[1] - 0.02, -5.02], u3);
  // hand-off: up the body to the abdomen
  tgt = v3.lerp(tgt, ABD, u4);
  yaw = lerp(yaw, -92, u4);
  pitch = lerp(pitch, 27, u4);
  ld = lerp(ld, Math.log(6.6), u4);
  return { pos: orbit(tgt, yaw, pitch, Math.exp(ld)), tgt, fov: lerp(34, 36, u4) };
}

const ARM_BASE = toWorld(KX + 4, 22, 24);
export const S02 = {
  id: 'knee',
  t0: 25.3,
  t1: 36.8,
  init() {
    K = buildKnee(0.24);
    KS = buildKneeSagittal([KX - 2.6, KX - 1.3, KX, KX + 1.3, KX + 2.6]);
  },
  draw(F, lt, t) {
    const L = F.L;
    const appear = seg(t, 25.5, 27.2, E.inOutCubic);
    const leave = seg(t, 35.2, 36.4, E.inOutCubic);
    const millX = toolSweep(t); // local X' that the burr has cleared up to
    const implant = seg(t, 34.4, 35.2, E.outCubic);
    const fog = [2.2, 6.5, 0.28];
    const focus = F.cam.depth(KNEE[0], KNEE[1], KNEE[2]);
    const dof = [focus, 1.6, 2.2];
    for (const s of K) {
      // draw-on rolls outward from the joint line
      const d = Math.abs(s.Z - 49.5);
      const on = clamp((appear * 16 - d * 0.9) / 2.2);
      if (on <= 0) continue;
      let a = (s.bone === 'femur' || s.bone === 'tibia' ? 0.46 : 0.36) * (1 - leave);
      const inFemurCut = s.bone === 'femur' && s.Z < DISTAL_CUT;
      const inTibiaCut = s.bone === 'tibia' && s.Z > TIBIAL_CUT;
      let segAlpha = null;
      if (inFemurCut && millX !== null) {
        const X = s.X;
        segAlpha = (i) => clamp((X[i] - millX) / 0.6);
      }
      void inTibiaCut;
      L.poly(s.P, { rgb: s.bone === 'patella' || s.bone === 'fibula' ? C.STEEL : C.ICE, a, w: 0.9, closed: s.closed, to: E.outCubic(on), fog, dof, segAlpha });
      if (s.closed && on >= 1 && !(inFemurCut && millX !== null)) L.fill(s.P, { rgb: C.LUMI, a: 0.016 * (1 - leave), fog });
      if (inFemurCut && implant > 0) L.poly(s.P, { rgb: C.WHITE, a: 0.9 * implant * (1 - leave), w: 1.15, closed: s.closed, layer: 2, fog });
    }
    for (const s of KS) L.poly(s.P, { rgb: C.STEEL, a: 0.22 * appear * (1 - leave), w: 0.8, closed: s.closed, fog, dof });
    L.flush();
    if (t >= 27.6) drawLifeLine(F, t, 0.8, { dotOnly: true });
    labels(F, t);
    plan(F, t);
    robot(F, t, millX);
    statement(F, 'PLAN BEFORE YOU TOUCH.', 120, 214, t - 28.2, 2.6);
    statement(F, 'PRECISION,', 120, 880, t - 31.7, 3.0);
    statement(F, 'DOWN TO THE MILLIMETRE.', 120, 966, t - 31.86, 2.84);
    chapterTag(F, '02', 'PLAN · PRECISION', t - 26.8, 9.0);
  },
};

// ---------------------------------------------------------------------------
function proj(F, xp, y, z) {
  const w = toWorld(xp, y, z);
  return F.cam.p(w[0], w[1], w[2]);
}

function labels(F, t) {
  const a = env(t, 26.9, 29.4, 0.3, 0.5);
  if (a <= 0) return;
  const items = [
    ['FEMUR', KX - 1.4, 8.6, 58, 27.0, [-1, -1]],
    ['PATELLA', KX, 11.4, 53.8, 27.2, [1, -1]],
    ['TIBIA', KX - 1.2, 8.2, 44, 27.35, [-1, 1]],
    ['FIBULA', KX + 3.1, 6.4, 44.5, 27.5, [1, 1]],
  ];
  for (const [name, x, y, z, ts, dir] of items) {
    const p = proj(F, x, y, z);
    if (!p) continue;
    callout(F, p[0], p[1], p[0] + dir[0] * 150, p[1] + dir[1] * 90, [[name, { size: 13 }]], { t: t - ts, a, run: 30 });
  }
  const tt = t - 27.6;
  label(F, 'CT-BASED 3D RECONSTRUCTION · SEGMENTED', 120, 986, { t: tt, size: 12, a: 0.7 * a });
}

function quad(F, corners, fillA, lineA, rgb = C.LUMI) {
  const P = new Float32Array(15);
  corners.forEach((c, i) => {
    P[i * 3] = c[0];
    P[i * 3 + 1] = c[1];
    P[i * 3 + 2] = c[2];
  });
  P[12] = corners[0][0];
  P[13] = corners[0][1];
  P[14] = corners[0][2];
  if (fillA > 0) F.L.fill(P.subarray(0, 12), { rgb, a: fillA, add: true });
  F.L.poly(P, { rgb, a: lineA, w: 1.2 });
}

function plan(F, t) {
  const L = F.L;
  const a = env(t, 28.6, 35.6, 0.6, 0.6);
  if (a <= 0) return;
  // mechanical axes (dashed by drawing short segments)
  const axA = seg(t, 28.7, 29.6, E.inOutCubic);
  const hip = [8.4, 9.2, 87], kc = [KX, 7.6, 50], ank = [KX - 0.2, 6.6, 8];
  for (const [p0, p1] of [[hip, kc], [kc, ank]]) {
    const n = 34;
    for (let i = 0; i < n; i += 2) {
      const u0 = i / n, u1 = (i + 1) / n;
      if (u0 > axA) break;
      const A = toWorld(lerp(p0[0], p1[0], u0), lerp(p0[1], p1[1], u0), lerp(p0[2], p1[2], u0));
      const B = toWorld(lerp(p0[0], p1[0], Math.min(u1, axA)), lerp(p0[1], p1[1], Math.min(u1, axA)), lerp(p0[2], p1[2], Math.min(u1, axA)));
      L.poly(new Float32Array([...A, ...B]), { rgb: C.RED, a: 0.55 * a, w: 1 });
    }
  }
  // resection planes
  const pA = seg(t, 29.2, 30.0, E.outCubic);
  if (pA > 0) {
    const zf = DISTAL_CUT;
    const ex = 3.7 * pA, ey = 3.0 * pA;
    quad(F, [toWorld(KX - ex, 7.5 - ey, zf), toWorld(KX + ex, 7.5 - ey, zf), toWorld(KX + ex, 7.5 + ey, zf), toWorld(KX - ex, 7.5 + ey, zf)], 0.05 * a, 0.75 * a);
    const sl = Math.tan((3 * Math.PI) / 180);
    const zt = (y) => TIBIAL_CUT + (y - 7.3) * sl;
    quad(F, [toWorld(KX - ex, 7.3 - ey, zt(7.3 - ey)), toWorld(KX + ex, 7.3 - ey, zt(7.3 - ey)), toWorld(KX + ex, 7.3 + ey, zt(7.3 + ey)), toWorld(KX - ex, 7.3 + ey, zt(7.3 + ey))], 0.05 * a, 0.75 * a);
    L.flush();
    const q1 = proj(F, KX + 3.7, 10.5, zf), q2 = proj(F, KX + 3.7, 4.3, zt(4.3));
    if (q1) callout(F, q1[0], q1[1], q1[0] + 170, q1[1] + 30, [['DISTAL RESECTION'], ['9.0 MM']], { t: t - 29.7, a });
    if (q2) callout(F, q2[0], q2[1], q2[0] + 170, q2[1] + 90, [['TIBIAL RESECTION'], ['8.5 MM · POSTERIOR SLOPE 3°']], { t: t - 30.0, a });
  }
  // haptic boundary around the distal resection volume
  const hA = env(t, 30.5, 35.3, 0.5, 0.5);
  if (hA > 0) {
    const x0 = KX - 3.5, x1 = KX + 3.5, y0 = 4.5, y1 = 10.5, z0 = FEMUR_TIP - 0.25, z1 = DISTAL_CUT;
    const flash = 0.5 + 0.5 * Math.sin(t * TAU * 2.2);
    const c = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ].map((v) => toWorld(v[0], v[1], v[2]));
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const [i, j] of edges) L.poly(new Float32Array([...c[i], ...c[j]]), { rgb: C.LUMI, a: (0.55 + 0.25 * flash) * hA * a, w: 1.2, layer: 2 });
    for (const f of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6]]) {
      const P = new Float32Array(12);
      f.forEach((k, i) => P.set(c[k], i * 3));
      L.fill(P, { rgb: C.LUMI, a: 0.035 * hA * a });
    }
    L.flush();
    const q = proj(F, x0, y0, z0);
    if (q) callout(F, q[0], q[1], q[0] - 170, q[1] + 120, [['HAPTIC BOUNDARY'], ['TOOL CONFINED TO PLAN']], { t: t - 30.8, a: hA * a, glow: true, glowRgb: C.LUMI });
  }
  // millimetre ruler down the resection depth
  const rA = env(t, 32.2, 35.3, 0.4, 0.4);
  if (rA > 0) {
    const r0 = proj(F, KX + 4.4, 7.6, FEMUR_TIP), r1 = proj(F, KX + 4.4, 7.6, DISTAL_CUT);
    if (r0 && r1) {
      ruler(F, r0[0], r0[1], r1[0], r1[1], 9, { t: (t - 32.2) * 1.2, major: 5, hMaj: 12, hMin: 6, a: 0.85 * rA, rgb: C.ICE });
      const prog = clamp((t - 32.4) / 2.0);
      label(F, `${(9.0 * E.outCubic(prog)).toFixed(1)} MM`, r1[0] + 18, r1[1] + 4, { t: t - 32.4, size: 15, wt: 600, a: rA, rgb: C.WHITE });
      label(F, 'DEPTH', r1[0] + 18, r1[1] - 16, { t: t - 32.5, size: 11, a: 0.6 * rA });
    }
  }
}

// ---------------------------------------------------------------------------
// tool sweep: returns the local X' the burr has cleared to (null before milling starts)
function toolSweep(t) {
  if (t < 32.0) return null;
  return lerp(KX - 4.2, KX + 4.2, E.inOutSine(clamp((t - 32.0) / 2.4)));
}
function toolTip(t) {
  const sx = toolSweep(t) ?? KX - 4.2;
  const osc = Math.sin(t * TAU * 3.1);
  const y = 7.4 + osc * 2.4;
  const z = (FEMUR_TIP + DISTAL_CUT) / 2 + Math.sin(t * TAU * 1.3) * 0.3;
  return toWorld(sx, y, z);
}
function ik(base, tip, L1, L2, hint) {
  const d = v3.sub(tip, base);
  const D = Math.min(v3.len(d), L1 + L2 - 1e-3);
  const dir = v3.norm(d);
  const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D);
  const h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
  let up = v3.sub(hint, v3.mul(dir, v3.dot(hint, dir)));
  up = v3.norm(up);
  return v3.add(v3.add(base, v3.mul(dir, a)), v3.mul(up, h));
}

function robot(F, t, millX) {
  const a = env(t, 30.9, 35.5, 0.7, 0.6);
  if (a <= 0) return;
  const L = F.L;
  const enter = E.outCubic(clamp((t - 30.9) / 1.1));
  let tip = toolTip(t);
  const parked = toWorld(KX + 6, 14, 51);
  tip = v3.lerp(parked, tip, enter * (1 - seg(t, 34.6, 35.4, E.inCubic)));
  const wrist = v3.add(tip, [0.0, 0.62, 0.55]);
  const elbow = ik(ARM_BASE, wrist, 2.0, 1.7, [0, 1, 0.3]);
  L.flush();
  drawArm(F, [ARM_BASE, elbow, wrist, tip], [0.17, 0.13, 0.035], a);
  const ctx = F.ctx;
  const tp = F.cam.p(...tip);
  if (tp) {
    const cutting = millX !== null && t < 34.4;
    L.head(tp[0], tp[1], { r: 3, rgb: C.LUMI, g: cutting ? 60 : 30, gi: cutting ? 1 : 0.6, a });
    if (cutting) {
      // sparks of removed bone (deterministic)
      for (let k = 0; k < 7; k++) {
        const ph = (t * 9 + k * 0.37) % 1;
        const an = k * 2.39 + t * 3;
        const r = ph * 28;
        ctx.fillStyle = `rgba(${C.ICE},${0.7 * (1 - ph) * a})`;
        ctx.fillRect(tp[0] + Math.cos(an) * r, tp[1] + Math.sin(an) * r - ph * 10, 1.6, 1.6);
      }
    }
  }
  // the MAKO itself
  const mu = t - 31.3;
  const mout = seg(t, 35.0, 35.6);
  const box = machineReveal(F, 'mako_b', 1590, 118, 1.3, mu, { out: mout, filter: 'brightness(0.92) contrast(1.05)', pool: C.LUMI });
  if (box) callout(F, box.x + box.w * 0.3, box.y + box.h * 0.62, box.x - 90, box.y + box.h + 30, [['MAKO SMARTROBOTICS'], ['ROBOTIC-ARM ASSISTED SURGERY']], { t: mu - 0.9, a: 1 - mout });
  void text;
  void TIBIA_TOP;
}
