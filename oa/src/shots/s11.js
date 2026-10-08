// SHOT 11 — THE LOOP (40.8 – 45.6 s)
// The green line returns — the same line as the opening — and travels into her hand, older now.
// She reaches out; her grown child reaches back. They touch, exactly mirroring the first touch,
// but this time the child is holding HER hand. A green pulse runs between them and the red in
// her hand goes out, one particle at a time. THE FIRST TIME / SHE HELD YOUR HAND returns, reversed:
// the line gathers itself back into words.
import { clamp, lerp, E, mulberry32 } from '../engine/util.js';
import { glowLine, resample, subPath } from '../engine/green.js';
import { handRig, traceHand, POSES, mixPose } from '../lib/hand.js';
import { drawHead } from '../engine/lines.js';
import { textFlat, u01, scrim, dust } from './common.js';
import { C, F as PF } from '../palette.js';
import { EV } from '../timeline.js';

const DEG = Math.PI / 180;
const T11 = EV.touch11;
const SC = 26; // px per cm
const CPS = [905, 600]; // contact point on screen
const PHI_M = 44, PHI_A = -136; // her fingers up-left, the child's down-right

function motherPose(t) {
  return mixPose(POSES.reach, POSES.rest, E.inOutCubic(u01(t, T11 + 0.1, T11 + 0.8)));
}
function adultPose(t) {
  return mixPose(POSES.rest, mixPose(POSES.reach, POSES.hold, E.inOutCubic(u01(t, T11, T11 + 0.7))), E.inOutCubic(u01(t, 41.5, 42.3)));
}
function adultTip(t) {
  // reaching down to her, then sliding over her fingers to hold
  const u = E.inOutSine(u01(t, 41.5, T11));
  const h = E.inOutCubic(u01(t, T11, T11 + 0.7));
  return [lerp(-5.2, 0.0, u) + h * 2.6, lerp(4.6, 0.0, u) - h * 2.2];
}
function motherTip(t) {
  const u = E.outCubic(u01(t, 41.7, T11));
  return [lerp(1.4, 0.05, u), lerp(-1.2, -0.04, u)];
}

const cache = new Map();
function hand(kind, pose, tip, phi, mirror, key) {
  const ck = key;
  let T = cache.get(ck);
  if (!T) {
    T = traceHand(handRig(kind, pose, { cut: -16 }), 0.09, 0.6);
    cache.set(ck, T);
    if (cache.size > 40) cache.delete(cache.keys().next().value);
  }
  const lt = T.tips[1];
  const c = Math.cos(phi * DEG), s = Math.sin(phi * DEG);
  const mx = mirror ? -1 : 1;
  const P = new Float32Array(T.n * 2);
  for (let i = 0; i < T.n; i++) {
    const lx = (T.P[i * 2] - lt[0]) * mx, ly = T.P[i * 2 + 1] - lt[1];
    const hx = tip[0] + lx * c - ly * s, hy = tip[1] + lx * s + ly * c;
    P[i * 2] = CPS[0] + hx * SC;
    P[i * 2 + 1] = CPS[1] - hy * SC;
  }
  return { P, n: T.n, cum: T.cum, L: T.L, sTip: T.tipS[1], T };
}

let reds = null;
export function init() {
  const r = mulberry32(1111);
  reds = [];
  for (let i = 0; i < EV.redOut.length; i++) reds.push({ s: 0.18 + r() * 0.5, off: (r() - 0.5) * 14, ph: r() * 6.28 });
}

export function draw(F, lt, t) {
  const out = 1 - E.inOutSine(u01(t, 45.15, 45.6));
  dust(F, t, { n: 600, e: 0.06, box: 18, center: [0, 0, -6] });
  F.cam.set([0, 0, -10], [0, 0, 0], 40);
  // ---- her hand (older), formed by the returning line -------------------------------------------
  const kM = Math.round(t * 60);
  const M = hand('older', motherPose(t), motherTip(t), PHI_M, true, 'm' + kM);
  const form = E.inOutCubic(u01(t, 40.85, 41.75));
  const lineA = out;
  if (form < 1) {
    // morph: the horizontal line left by SHOWING -> her contour (resampled, staggered from the tip)
    const m = 400;
    const A = resample(new Float32Array([40, 518, 1880, 518]), 2, m);
    const B = resample(M.P, M.n, m);
    const P = new Float32Array(m * 2);
    for (let i = 0; i < m; i++) {
      const d = Math.abs(i / (m - 1) - M.sTip / M.L);
      const u = E.inOutCubic(clamp((form * 1.6 - d * 0.6)));
      P[i * 2] = lerp(A[i * 2], B[i * 2], u);
      P[i * 2 + 1] = lerp(A[i * 2 + 1], B[i * 2 + 1], u) + Math.sin(Math.PI * u) * 30 * Math.sin(i * 0.05 + t * 3);
    }
    glowLine(F, P, m, { w: 2.4, a: lineA, glow: 1 });
  } else {
    glowLine(F, M.P, M.n, { w: 2.4, a: lineA, glow: 1 });
  }
  // ---- the grown child's hand reaches back (violet), drawn on from its fingertip ------------------
  const kA = Math.round(t * 60);
  const A = hand('adult', adultPose(t), adultTip(t), PHI_A, false, 'a' + kA);
  const dA = lerp(0, A.L, E.inOutCubic(u01(t, 41.45, 42.35)));
  if (dA > 0.1) {
    const a0 = Math.max(0, (A.sTip - dA) / A.L), a1 = Math.min(1, (A.sTip + dA) / A.L);
    // the hand that holds hers covers it: erase her line under the child's palm once they hold
    const hold = E.inOutCubic(u01(t, T11, T11 + 0.7));
    if (hold > 0.02) {
      F.L.flush();
      for (const ctx of [F.ctx, F.g]) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = hold * 0.9;
        ctx.beginPath();
        for (let i = 0; i < A.n; i++) i ? ctx.lineTo(A.P[i * 2], A.P[i * 2 + 1]) : ctx.moveTo(A.P[0], A.P[1]);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    const part = subPath(A.P, A.n, a0, a1);
    // after the touch the child's line turns green from the contact outward
    glowLine(F, part, part.length / 2, { w: 2.0, a: out, rgb: C.VIOLET_HI, hi: '240,232,255', core: 0.6, glow: 0.5 });
    if (t > T11) {
      const g = lerp(0, A.L, E.outCubic(clamp((t - T11) / 0.7)));
      const b0 = Math.max(0, (A.sTip - g) / A.L), b1 = Math.min(1, (A.sTip + g) / A.L);
      const gp = subPath(A.P, A.n, b0, b1);
      glowLine(F, gp, gp.length / 2, { w: 2.2, a: out * 0.9, glow: 0.9 });
    }
  }
  // ---- the touch: a warmer, softer wave --------------------------------------------------------------
  const after = t - T11;
  if (after > -0.02 && after < 1.3) {
    const u = clamp(after / 1.2);
    F.fx.ring = { c: [CPS[0] / F.W, CPS[1] / F.H], r: lerp(0, 1.7, E.outCubic(u)), w: lerp(0.03, 0.12, u), a: 0.04 * Math.pow(1 - u, 1.5), glow: 0.12 * Math.pow(1 - u, 2), rgb: [0.6, 1.0, 0.7] };
    F.fx.exposure = 1 + 0.18 * Math.exp(-Math.max(0, after) * 7);
  }
  // ---- green pulses travel between them -------------------------------------------------------------
  if (t > T11 + 0.1) {
    for (let p = 0; p < 4; p++) {
      const ph = ((t - T11 - 0.1) * 0.9 + p * 0.25) % 1;
      // along the child's line toward the contact, then into her hand
      const onA = ph < 0.5;
      const H = onA ? A : M;
      const u = onA ? ph / 0.5 : (ph - 0.5) / 0.5;
      const s = onA ? lerp(Math.max(0, A.sTip - A.L * 0.45), A.sTip, u) : lerp(M.sTip, Math.max(0, M.sTip - M.L * 0.45), u);
      let i = 0;
      while (i < H.n - 2 && H.cum[i + 1] < s) i++;
      drawHead(F, { x: H.P[i * 2], y: H.P[i * 2 + 1], r: 2.6, rgb: C.GREEN, core: '240,255,244', g: 26, gi: 0.9, a: out * Math.sin(Math.PI * u) });
    }
  }
  // ---- the red in her hand goes out, one at a time ------------------------------------------------
  reds.forEach((rd, i) => {
    const tOff = EV.redOut[i];
    let a = E.outCubic(u01(t, 41.2, 41.8));
    let flare = 0;
    if (t > tOff) {
      const u = (t - tOff) / 0.35;
      flare = u < 1 ? Math.sin(Math.PI * u) : 0;
      a *= 1 - E.inQuad(clamp(u));
    }
    if (a <= 0.003 && flare <= 0) return;
    let k = 0;
    const s = M.L * rd.s;
    while (k < M.n - 2 && M.cum[k + 1] < s) k++;
    const x = M.P[k * 2] + Math.sin(t * 2 + rd.ph) * 2, y = M.P[k * 2 + 1] + rd.off;
    drawHead(F, { x, y, r: 2.1, rgb: C.RED, core: C.RED_HI, g: 16 + flare * 20, gi: 0.85, a: (a + flare * 0.5) * out });
  });
  // ---- THE FIRST TIME / SHE HELD YOUR HAND — the line gathers back into words --------------------
  drawType(F, t, out);
}

function drawType(F, t, a0) {
  const y1 = 760, y2 = 840, X = 1130;
  // reversed: a hairline contracts into THE FIRST TIME (the opening's stretch, run backwards)
  const g = E.outCubic(u01(t, 41.55, 42.1));
  if (t > 41.45) {
    const fac = 1 + (1 - g) * (1 - g) * 38;
    const a = E.outCubic(u01(t, 41.45, 41.6)) * a0;
    textFlat(F, 'THE FIRST TIME', X, y1, 40, {
      fam: 'D500', track: 0.34,
      per: (gi, gl) => ({ sx: fac, dx: (X + gl.cx * 40 - (X + 300)) * (fac - 1) * 0.92, a: a * g }),
    });
    if (g < 1) F.L.poly2(new Float32Array([X - (1 - g) * 900, y1 - 14, X + 610 + (1 - g) * 600, y1 - 14]), { rgb: C.LILAC, a: 0.55 * a * (1 - g), w: 1, layer: 2 });
  }
  if (t > 42.1) {
    const a = E.outCubic(u01(t, 42.1, 42.5)) * a0;
    // HELD locks on with the touch (as in the opening, but now the line ends on YOUR HAND)
    const lock = E.outBack(u01(t, T11 - 0.05, T11 + 0.3), 2.0);
    textFlat(F, 'SHE HELD YOUR HAND', X, y2, 56, {
      fam: 'D300', track: 0.2, a, glow: 0.35,
      per: (gi) => ({ dx: gi >= 4 && gi <= 7 ? (1 - lock) * 60 : 0, a: 1 }),
    });
  }
}
