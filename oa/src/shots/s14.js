// SHOT 14 — THE FINAL IMAGE (56.0 – 60.0 s)
// The green line keeps moving, curves, and becomes a figure drawn in one line. The figure takes one
// final step; the step becomes the brand: the line runs on from her foot into a quiet underline and
// the wordmark. WORLD OA DAY · EVERY STEP MATTERS. · WOCKHARDT · the supporting line. Hold.
// (The wordmark is a typographic stand-in until the registered brand mark is supplied.)
import { clamp, lerp, E } from '../engine/util.js';
import { glowLine, resample, subPath } from '../engine/green.js';
import { drawHead } from '../engine/lines.js';
import { textFlat, u01 } from './common.js';
import { C } from '../palette.js';
import { EV } from '../timeline.js';

const FS = EV.finalStep;
// the figure, as one continuous line (unit = figure height; x right, y up; feet at y = 0)
function figure(step) {
  // step 0: front foot lifted behind the hip line .. 1: planted ahead
  const fk = [lerp(0.06, 0.13, step), lerp(0.2, 0.25, step)]; // front knee
  const ff = [lerp(0.04, 0.27, step), lerp(0.1, 0.0, step)]; // front heel
  const ft = [ff[0] + 0.09, lerp(0.07, 0.0, step)];
  return [
    [-1.6, 0.0], [-0.5, 0.0], [-0.22, 0.0], // the line arrives along the ground: the back foot
    [-0.13, 0.02], [-0.11, 0.24], [-0.02, 0.47], // back leg to the hip
    [0.0, 0.62], [0.02, 0.77], // body
    [-0.06, 0.7], [-0.12, 0.56], [-0.1, 0.5], [-0.04, 0.6], [0.03, 0.79], // the back arm, swung and returned
    [0.07, 0.86], [0.12, 0.93], [0.07, 1.0], [0.0, 0.97], [-0.01, 0.9], [0.05, 0.85], // the head
    [0.09, 0.74], [0.15, 0.6], [0.19, 0.53], [0.13, 0.58], [0.05, 0.5], [0.02, 0.46], // the front arm
    fk, ff, ft, // the front leg — the final step
  ];
}
function catmull(pts, per) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push(
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      );
    }
  }
  out.push(...pts[pts.length - 1]);
  return new Float32Array(out);
}

const FX = 520, FY = 820, FH = 470; // figure placement: foot line y, height px

export function draw(F, lt, t) {
  // ---- the line arrives (continuing the pledge line) and draws the figure -------------------------
  const draw01 = E.inOutCubic(u01(t, EV.figure[0] - 0.1, EV.figure[1]));
  const step = E.inOutCubic(u01(t, FS - 0.45, FS));
  const pts = figure(step);
  const L = catmull(pts, 10);
  const n = L.length / 2;
  const S = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    S[i * 2] = FX + L[i * 2] * FH;
    S[i * 2 + 1] = FY - L[i * 2 + 1] * FH;
  }
  // the incoming line slides in from the left before it rises into the figure
  if (t < EV.figure[0] + 0.1) {
    const u = E.outCubic(u01(t, 56.0, EV.figure[0] + 0.1));
    glowLine(F, new Float32Array([-40, FY, lerp(-40, FX - 0.22 * FH, u), FY]), 2, { w: 2.6, a: 1, glow: 1.1, head: { r: 2.6, g: 30 } });
  } else {
    const part = subPath(S, n, 0, Math.max(0.02, draw01));
    glowLine(F, part, part.length / 2, { w: 2.6, a: 1, glow: 1.1, head: draw01 < 1 ? { r: 2.6, g: 30 } : null });
  }
  // ---- the step lands: the line runs on from her foot and becomes the brand's underline ------------
  const land = t - FS;
  if (land > -0.02) {
    const fx = S[(n - 1) * 2], fy = FY;
    // a footprint of light where the step lands
    const pulse = Math.exp(-Math.max(0, land) * 4);
    drawHead(F, { x: fx, y: fy, r: 2.8, rgb: C.GREEN, core: '240,255,244', g: 26 + 30 * pulse, gi: 0.9, a: 1 });
    const run = E.inOutCubic(clamp(land / 0.6));
    const x1 = lerp(fx, 1560, run);
    glowLine(F, new Float32Array([fx, fy, x1, fy]), 2, { w: 2.2, a: 1, glow: 0.9, head: run < 1 ? { r: 2.2, g: 22 } : null });
    if (land < 0.6) F.fx.ring = { c: [fx / F.W, fy / F.H], r: land * 1.2, w: 0.03, a: 0.02 * (1 - land / 0.6), glow: 0.06 * (1 - land / 0.6), rgb: [0.5, 1, 0.6] };
  }
  // ---- supers ----------------------------------------------------------------------------------------
  const sup = EV.supers;
  const X = 860;
  const a1 = E.outCubic(u01(t, sup.day, sup.day + 0.5));
  textFlat(F, 'WORLD OA DAY', X, 560, 30, { fam: 'D500', track: 0.42, a: a1 * 0.92, glow: 0.2 });
  const a2 = E.outCubic(u01(t, sup.line, sup.line + 0.45));
  textFlat(F, 'EVERY STEP MATTERS.', X - (1 - a2) * 30, 660, 74, { fam: 'D300', track: 0.06, a: a2, glow: 0.35 });
  const a3 = E.outCubic(u01(t, sup.brand, sup.brand + 0.5));
  textFlat(F, 'WOCKHARDT', X, 790, 46, { fam: 'D600', track: 0.2, a: a3, glow: 0.3, rgb: '245,240,255' });
  const a4 = E.outCubic(u01(t, sup.support, sup.support + 0.5));
  textFlat(F, 'Talk to your healthcare professional about osteoarthritis.', 960, 990, 25, { fam: 'D400', track: 0.04, align: 'c', a: a4 * 0.85 });
}
