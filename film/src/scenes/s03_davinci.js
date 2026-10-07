// 00:36–00:44  HUMAN + MACHINE (da Vinci)
// Four arms dock through ports; the surgeon's hand path (red, with tremor) drives the
// instrument tip, which draws the same suture scaled 3:1 and filtered (white).
import { C } from '../palette.js';
import { E, clamp, env, lerp, seg, v3, TAU, fbm1 } from '../engine/util.js';
import { orbit } from '../engine/cam.js';
import { label, callout } from '../engine/annot.js';
import { machineReveal, statement, chapterTag, drawArm } from './common.js';
import { kneeCam, ABD } from './s02_knee.js';
import { drawBody, drawLifeLine } from './s01_signal.js';
import { topY, CM } from '../anatomy.js';

export const TGT = [0.25, 0.86, -10.0];
const BOOM = [0.1, 4.1, -10.6];
let PORTS = null;

export function davinciCam(t) {
  if (t < 36.8) return kneeCam(t);
  const u = seg(t, 36.8, 41.6, E.inOutSine);
  const out = seg(t, 41.6, 44.4, E.inOutCubic);
  let tgt = v3.lerp(ABD, TGT, seg(t, 36.8, 38.0, E.inOutCubic));
  const s0 = seg(t, 36.8, 38.1, E.inOutCubic);
  let yaw = lerp(-92, -64, s0) + 6 * u, pitch = lerp(27, 30, s0) + 2 * u;
  let ld = lerp(Math.log(6.6), Math.log(11.5), s0) + Math.log(1 - 0.06 * u);
  const shift = [lerp(0, 330, s0) * (1 - out), lerp(0, 120, s0) * (1 - out)];
  // travel up the body to the lungs
  const LUNG = [0.75, 1.25, -12.9];
  tgt = v3.lerp(tgt, LUNG, out);
  yaw = lerp(yaw, -8, out);
  pitch = lerp(pitch, 62, out);
  ld = lerp(ld, Math.log(6.2), out);
  return { pos: orbit(tgt, yaw, pitch, Math.exp(ld)), tgt, fov: 36, shift };
}

function ports() {
  const P = [];
  for (const [X, Z] of [[-10, 106], [-3.5, 114], [5.5, 113], [11, 104]]) {
    const y = topY(X, Z) * CM;
    P.push([X * CM, y, -Z * CM]);
  }
  return P;
}

// suture path in normalised coords, s in [0,1]
const LOOPS = 4;
function suture(s) {
  const S = LOOPS * TAU;
  const q = s * S;
  return [-1 + 2 * s - 0.12 * Math.sin(q) * 1.0, -0.62 * Math.cos(q) + 0.05 * Math.sin(q * 0.5)];
}

export const S03 = {
  id: 'davinci',
  t0: 35.6,
  t1: 44.4,
  init() {
    PORTS = ports();
  },
  draw(F, lt, t) {
    const ctxA = env(t, 35.7, 44.4, 0.9, 0.9);
    // on the way in and out a narrow scan window rides with the camera, so the flight up
    // the body reads as slices passing by rather than a wall of rings
    const travel = Math.max(1 - seg(t, 37.0, 38.3, E.inOutSine), seg(t, 41.7, 43.4, E.inOutSine));
    drawBody(F, ctxA, { focusZ: lerp(-10.4, F.cam.tgt[2], travel), focusR: lerp(5, 1.3, travel), edgeA: lerp(0.2, 0, travel), fog: [3, 18, 0.1] });
    drawLifeLine(F, t, 0.8 * ctxA, { dotOnly: true });
    F.L.flush();
    arms(F, t);
    scaling(F, t);
    const pu = t - 36.9;
    const pout = seg(t, 38.5, 39.1);
    const box = machineReveal(F, 'davinci_arms', 1430, 690, 1.2, pu, { out: pout, lineDur: 0.4, restLines: 0, filter: 'brightness(0.9) contrast(1.05) saturate(0.9)' });
    if (box) callout(F, box.x + box.w * 0.84, box.y + box.h * 0.08, box.x + box.w * 0.62, box.y - 150, [['DA VINCI SURGICAL SYSTEM'], ['3D HD VISION · WRISTED INSTRUMENTS']], { t: pu - 0.6, a: 1 - pout });
    statement(F, 'HUMAN JUDGEMENT.', 120, 214, t - 38.3, 3.3);
    statement(F, 'MACHINE PRECISION.', 120, 300, t - 38.95, 2.65);
    chapterTag(F, '03', 'HUMAN + MACHINE', t - 37.2, 6.6);
  },
};

// ---------------------------------------------------------------------------
function arms(F, t) {
  const a = env(t, 36.0, 43.4, 0.8, 0.9);
  if (a <= 0) return;
  const dock = E.inOutCubic(clamp((t - 36.2) / 1.5));
  const insert = E.inOutCubic(clamp((t - 37.2) / 0.9));
  const retract = E.inCubic(clamp((t - 41.8) / 1.2));
  const L = F.L;
  const k = F.cam.p(...TGT);
  for (let i = 0; i < 4; i++) {
    const port = PORTS[i];
    const axis = v3.norm(v3.sub(port, TGT));
    const dirXZ = v3.norm([port[0] - BOOM[0], 0, port[2] - BOOM[2]]);
    const shoulder = v3.add(BOOM, v3.mul(dirXZ, 0.7));
    let mount = v3.add(port, v3.mul(axis, 1.7));
    mount = v3.add(mount, [0, 3.2 * (1 - dock) + 2.2 * retract, 0]);
    const elbow = v3.add(v3.lerp(shoulder, mount, 0.5), v3.add(v3.mul(dirXZ, 0.75), [0, 0.7, 0]));
    // instrument tip: inside, near the target; instrument 0 follows the scaled suture
    let tip = v3.add(TGT, v3.mul(v3.norm(v3.sub(port, TGT)), 0.32));
    if (i === 0 && k) {
      const s = suturePhase(t);
      const q = suture(s);
      const kk = k[3];
      tip = v3.add(TGT, v3.add(v3.mul(F.cam.r, (q[0] * 100) / kk), v3.mul(F.cam.u, (-q[1] * 36.7) / kk)));
    }
    const depth = insert * (1 - retract);
    const tipNow = v3.lerp(v3.add(port, v3.mul(axis, 0.6)), tip, depth);
    L.flush();
    drawArm(F, [shoulder, elbow, mount], [0.12, 0.095], a * clamp(dock * 1.4));
    // shaft through the port
    L.poly(new Float32Array([...mount, ...tipNow]), { rgb: C.ICE, a: 0.85 * a, w: 1.6 });
    const pp = F.cam.p(...port);
    if (pp) {
      const ctx = F.ctx;
      ctx.strokeStyle = `rgba(${C.LUMI},${0.8 * a * dock})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(pp[0], pp[1], 7, 3.5, 0, 0, TAU);
      ctx.stroke();
    }
    const tp = F.cam.p(...tipNow);
    if (tp && depth > 0.2) {
      if (i === 2) {
        // endoscope: a viewing cone
        const ctx = F.ctx;
        const dirS = [tp[0] - (pp ? pp[0] : tp[0]), tp[1] - (pp ? pp[1] : tp[1])];
        const l = Math.hypot(dirS[0], dirS[1]) || 1;
        const ux = dirS[0] / l, uy = dirS[1] / l;
        ctx.strokeStyle = `rgba(${C.LUMI},${0.35 * a * depth})`;
        ctx.beginPath();
        for (const sgn of [-1, 1]) {
          ctx.moveTo(tp[0], tp[1]);
          ctx.lineTo(tp[0] + (ux * 0.94 - uy * 0.34 * sgn) * 90, tp[1] + (uy * 0.94 + ux * 0.34 * sgn) * 90);
        }
        ctx.stroke();
      }
      L.head(tp[0], tp[1], { r: 2, rgb: C.LUMI, g: 18, gi: 0.6 * a * depth });
    }
  }
  L.flush();
  drawArm(F, [v3.add(BOOM, [0, 3.0, 0]), BOOM], [0.16], a * clamp(dock * 1.4));
  if (k) label(F, 'OPERATIVE SITE', k[0] - 26, k[1] + 58, { t: t - 37.6, size: 11, a: 0.7 * env(t, 37.4, 38.4, 0.3, 0.4), align: 'r' });
}

function suturePhase(t) {
  return E.inOutSine(clamp((t - 38.2) / 3.3));
}

function scaling(F, t) {
  const a = env(t, 38.0, 42.0, 0.4, 0.6);
  if (a <= 0) return;
  const L = F.L;
  const s1 = suturePhase(t);
  const N = 420;
  // the surgeon's hand: large, with physiological tremor (~9 Hz)
  const hx = 440, hy = 700, sx = 300, sy = 110;
  const hand = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const s = (i / (N - 1)) * s1;
    const q = suture(s);
    const tt = 38.2 + s * 3.3;
    const jx = fbm1(tt * 9.2, 3) * 5.5 + fbm1(tt * 2.1, 9) * 4;
    const jy = fbm1(tt * 9.7, 5) * 5.5 + fbm1(tt * 1.7, 11) * 4;
    hand[i * 2] = hx + q[0] * sx + jx;
    hand[i * 2 + 1] = hy + q[1] * sy + jy;
  }
  L.poly2(hand, { rgb: C.RED, a: 0.95 * a, w: 1.6, layer: 2, fade: [0.15, 1], head: s1 > 0 && s1 < 1 ? { r: 2.6, rgb: C.RED, core: '255,226,226', g: 34, gi: 0.85 } : null });
  // the instrument: the same path, 3:1, filtered
  const k = F.cam.p(...TGT);
  if (!k) return;
  const ix = k[0], iy = k[1];
  const inst = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const s = (i / (N - 1)) * s1;
    const q = suture(s);
    inst[i * 2] = ix + (q[0] * sx) / 3;
    inst[i * 2 + 1] = iy + (q[1] * sy) / 3;
  }
  L.poly2(inst, { rgb: C.WHITE, a: 0.95 * a, w: 1.3, layer: 2, fade: [0.25, 1], head: s1 > 0 && s1 < 1 ? { r: 2.2, rgb: C.LUMI, g: 26, gi: 0.9 } : null });
  L.flush();
  // link between the two heads
  const qh = suture(s1), qi = suture(s1);
  const ax = hx + qh[0] * sx, ay = hy + qh[1] * sy, bx = ix + (qi[0] * sx) / 3, by = iy + (qi[1] * sy) / 3;
  const ctx = F.ctx;
  ctx.save();
  ctx.setLineDash([3, 6]);
  ctx.strokeStyle = `rgba(${C.STEEL},${0.55 * a})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.restore();
  label(F, '3 : 1', (ax + bx) / 2, (ay + by) / 2 - 10, { t: t - 38.6, align: 'c', size: 15, wt: 600, a, rgb: C.WHITE });
  label(F, 'SURGEON · HAND INPUT', hx - sx, hy + sy + 52, { t: t - 38.4, size: 12, a: 0.8 * a, rgb: C.ICE });
  label(F, 'PHYSIOLOGICAL TREMOR', hx - sx, hy + sy + 72, { t: t - 38.6, size: 11, a: 0.5 * a, rgb: C.STEEL });
  label(F, 'INSTRUMENT TIP', ix - sx / 3, iy + sy / 3 + 52, { t: t - 38.9, size: 12, a: 0.8 * a, rgb: C.ICE });
  label(F, 'MOTION SCALED 3:1 · TREMOR FILTERED', ix - sx / 3, iy + sy / 3 + 72, { t: t - 39.1, size: 11, a: 0.6 * a, rgb: C.STEEL });
}
