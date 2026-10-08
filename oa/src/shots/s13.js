// SHOT 13 — THE PLEDGE (49.4 – 56.4 s)
// Everything disappears: pure purple. One green line enters from the left and travels across.
// Three red interruptions appear on it; each one stops it, and turns into a word — NOTICE.
// ADDRESS. KEEP MOVING. — every word landing exactly on a step of the line. KEEP MOVING keeps moving.
import { clamp, lerp, E, mulberry32, track } from '../engine/util.js';
import { glowLine } from '../engine/green.js';
import { drawHead } from '../engine/lines.js';
import { shape, sampleShaped } from '../engine/glyphs.js';
import { textFlat, u01 } from './common.js';
import { C, F as PF } from '../palette.js';
import { EV } from '../timeline.js';

// the line's profile: three steps up across the frame (screen px)
const Y0 = 760, RISE = 92;
const STEPS_X = [520, 980, 1440]; // risers
const WORDS = ['NOTICE.', 'ADDRESS.', 'KEEP MOVING.'];
const RM = EV.redMarks, PL = EV.pledge;

/** the line's path as a polyline up to head position x (with the risers) */
function profile(xHead) {
  const pts = [[-40, Y0]];
  let y = Y0;
  for (let i = 0; i < 3; i++) {
    const xr = STEPS_X[i];
    if (xHead <= xr) break;
    pts.push([xr, y]);
    const up = Math.min(RISE, (xHead - xr) * 2.2);
    y -= up;
    pts.push([xr + up / 2.2 * 0.0 + 0.001, y]);
    if (up < RISE) return { pts, y };
  }
  pts.push([xHead, y]);
  return { pts, y };
}
// the head: travels, and halts at each red until its word has landed
const HEAD = [
  [49.7, -40, E.lin],
  [52.55, STEPS_X[0] - 6, E.outCubic],
  [52.95, STEPS_X[0] + 40, E.inOutCubic],
  [53.95, STEPS_X[1] - 6, E.inOutSine],
  [54.38, STEPS_X[1] + 40, E.inOutCubic],
  [55.15, STEPS_X[2] - 6, E.inOutSine],
  [55.55, STEPS_X[2] + 40, E.inOutCubic],
  [56.4, 2050, E.inQuad],
];

let wordPts = null;
export function init() {
  wordPts = WORDS.map((w) => {
    const S = shape(w, 'D500', { track: 0.12 });
    return { S, q: sampleShaped(S, 1600, 5 + w.length, 140) };
  });
}

export function draw(F, lt, t) {
  const xh = track(HEAD, t);
  const { pts } = profile(xh);
  // resample the polyline
  const P = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const L = Math.hypot(bx - ax, by - ay);
    const m = Math.max(1, Math.ceil(L / 8));
    for (let k = 0; k < m; k++) P.push(ax + ((bx - ax) * k) / m, ay + ((by - ay) * k) / m);
  }
  P.push(...pts[pts.length - 1]);
  const n = P.length / 2;
  const out = 1 - E.inOutSine(u01(t, 56.15, 56.4));
  const inA = E.outCubic(u01(t, 49.6, 49.9));
  // the line resists at each red mark: a tremor while it waits
  let tremor = 0;
  RM.forEach((r, i) => {
    if (t > r && t < PL[i]) tremor = Math.max(tremor, 1);
  });
  if (tremor) for (let i = Math.max(0, n - 30); i < n; i++) P[i * 2 + 1] += Math.sin(i * 1.7 + t * 60) * 1.2;
  glowLine(F, new Float32Array(P), n, { w: 2.6, a: inA * out, glow: 1.1, head: { r: 2.6, g: 30 } });
  // ---- the red interruptions, turning into words --------------------------------------------------
  RM.forEach((r, i) => {
    const xr = STEPS_X[i];
    const yr = Y0 - RISE * i;
    const ap = E.outCubic(u01(t, r - 0.25, r));
    const gone = u01(t, PL[i] - 0.1, PL[i] + 0.25);
    if (ap > 0 && gone < 1) {
      const pulse = 0.85 + 0.15 * Math.sin(t * 14);
      drawHead(F, { x: xr - 4, y: yr, r: 3.2, rgb: C.RED, core: C.RED_HI, g: 30, gi: 0.95, a: ap * (1 - gone) * pulse * out });
    }
    // the red bursts into the word that sits on the step
    if (t > PL[i] - 0.12) {
      const W = wordPts[i];
      const size = i === 2 ? 64 : 64;
      const wx = xr + 24, wy = yr - RISE - 22;
      const u = E.outCubic(u01(t, PL[i] - 0.12, PL[i] + 0.35));
      // particles fly from the red mark into the letters, then the solid word takes over
      const pa = (1 - E.inQuad(u01(t, PL[i] + 0.25, PL[i] + 0.6))) * out;
      if (pa > 0.01) {
        const [rr, rg, rb] = PF.RED, [lr, lg, lb] = PF.LILAC;
        for (let k = 0; k < 1600; k++) {
          const tx = wx + W.q[k * 2] * size, ty = wy + W.q[k * 2 + 1] * size;
          const d = ((k * 7919) % 100) / 100 * 0.3;
          const uk = E.outCubic(clamp((u - d) / 0.7));
          const x = lerp(xr, tx, uk), y = lerp(yr, ty, uk);
          const mixc = uk;
          const e = 0.6 * pa;
          F.S.pt(x, y, lerp(rr, lr, mixc) * e, lerp(rg, lg, mixc) * e, lerp(rb, lb, mixc) * e);
        }
      }
      const wa = E.outCubic(u01(t, PL[i] + 0.12, PL[i] + 0.45)) * out;
      // KEEP MOVING keeps moving
      const drift = i === 2 ? Math.max(0, t - PL[i] - 0.3) * 60 : 0;
      textFlat(F, WORDS[i], wx + drift, wy, size, { fam: 'D500', track: 0.12, a: wa, glow: 0.35, rgb: C.LILAC });
    }
  });
  // the VO's opening line, quietly
  if (t > 49.85 && t < 52.6) {
    const a = E.outCubic(u01(t, 49.85, 50.3)) * (1 - E.inQuad(u01(t, 52.2, 52.6)));
    textFlat(F, 'THIS WORLD OA DAY,', 960, 430, 40, { fam: 'D400', track: 0.32, align: 'c', a: a * 0.9, glow: 0.2 });
    textFlat(F, 'LET’S TAKE A PLEDGE.', 960, 490, 40, { fam: 'D400', track: 0.32, align: 'c', a: a * 0.9 * E.outCubic(u01(t, 50.9, 51.3)), glow: 0.2 });
  }
}
