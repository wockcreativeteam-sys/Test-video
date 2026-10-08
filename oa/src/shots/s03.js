// SHOT 03 — A LIFE IN ONE WALK (7.25 – 12.3 s)
// The particle legs keep walking and every footstep grows an entirely new world out of the
// footprint — school corridor, Mumbai street, kitchen, hospital, wedding, a child's bedroom,
// airport, rain, a staircase — each folding down into the next footprint. Her feet draw the line.
// WALKED travels smoothly with her, RAN accelerates past, KEPT GOING crosses the whole frame.
import { clamp, lerp, E } from '../engine/util.js';
import { cloud } from '../engine/cloud.js';
import { buildWorld, WORLD_ORDER } from '../lib/worlds.js';
import { drawWorld } from '../lib/growth.js';
import { solePrint } from '../lib/icons.js';
import { walkerJoints, lifeCam, walkerParticles, walkerEnergy, lifeGait, T0, STEP_T } from '../lib/walker.js';
import { glow3, text3D, u01, dust } from './common.js';
import { C, F as PF } from '../palette.js';
import { EV } from '../timeline.js';

const STEPS = EV.walkSteps; // [6.42, 6.95, 7.48 ... 11.72, 12.25]
const FIRST_WORLD = 2; // walkSteps index of the first world
let worlds = null;
const SOLE = solePrint()[0];

export function init() {
  worlds = WORLD_ORDER.map((n, i) => buildWorld(n, 11 + i));
}

/** heel position of step k of the life walk */
export function footAt(k, gp = lifeGait()) {
  return [k * gp.step, 0, (k & 1) === 0 ? 0.09 : -0.09];
}

/** the walker + her footprints + the line her feet draw. gt: gait time, a: alpha, zones: [legs, torso, upper] */
export function drawWalker(F, t, gt, gp, o = {}) {
  const J = walkerJoints(gt, gp);
  if (o.cam !== false) lifeCam(F, J, t);
  const b = walkerParticles(F, J, t);
  const En = walkerEnergy();
  const zones = o.zones || [1, 0.42, 0.26];
  const a = o.a ?? 1;
  for (let i = 0; i < b.n; i++) En[i] *= zones[b.zone[i]];
  cloud(F, b.P, b.n, { rgb: o.rgb || PF.GREEN, E: En, e: (o.e ?? 0.5) * a });
  return J;
}

/** glowing footprints of steps already taken (fade with age) */
export function drawFootprints(F, t, stepTimes, gp, o = {}) {
  const a0 = o.a ?? 1;
  stepTimes.forEach((ts, k) => {
    if (t < ts) return;
    const age = t - ts;
    const a = a0 * Math.exp(-age / (o.decay ?? 1.6)) * clamp(age / 0.05);
    if (a < 0.01) return;
    const f = footAt(k, gp);
    const n = SOLE.length / 2;
    const P = new Float32Array(n * 3);
    const L = 0.26, Wd = 0.2;
    for (let i = 0; i < n; i++) {
      P[i * 3] = f[0] + 0.1 + SOLE[i * 2 + 1] * L;
      P[i * 3 + 1] = 0.004;
      P[i * 3 + 2] = f[2] + SOLE[i * 2] * Wd;
    }
    glow3(F, P, n, { w: 1.6, a, glow: 0.8, core: 0.6 });
    // the landing ripple
    if (age < 0.5) {
      const r = 0.12 + age * 0.9;
      const m = 48;
      const R = new Float32Array((m + 1) * 3);
      for (let i = 0; i <= m; i++) {
        const an = (i / m) * Math.PI * 2;
        R[i * 3] = f[0] + 0.1 + Math.cos(an) * r;
        R[i * 3 + 1] = 0.004;
        R[i * 3 + 2] = f[2] + Math.sin(an) * r * 0.8;
      }
      F.L.poly(R, { rgb: C.GREEN, a: 0.5 * a0 * (1 - age / 0.5), w: 1, layer: 2 });
    }
  });
}

/** the line her feet draw: through every footprint, its head at the swinging toe */
export function drawFootLine(F, t, gt, gp, J, o = {}) {
  const kNow = Math.floor(gt / (1 / gp.cadence));
  const pts = [];
  const back = o.back ?? 9;
  for (let k = kNow - back; k <= kNow; k++) {
    const f = footAt(k, gp);
    pts.push([f[0] + 0.12, 0.006, f[2] * 0.6]);
  }
  // head: the foot in the air
  const sw = J.feet.L.since > J.feet.R.since ? J.toeL : J.toeR;
  pts.push([sw[0], Math.max(0.006, sw[1] * 0.4), sw[2] * 0.6]);
  // smooth (Catmull-Rom) into a dense polyline
  const P = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < 10; s++) {
      const u = s / 10, u2 = u * u, u3 = u2 * u;
      for (let c = 0; c < 3; c++)
        P.push(0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u3));
    }
  }
  P.push(...pts[pts.length - 1]);
  const n = P.length / 3;
  const av = new Float32Array(n);
  for (let i = 0; i < n; i++) av[i] = Math.pow(i / (n - 1), 1.6);
  glow3(F, new Float32Array(P), n, { w: 2.2, av, a: o.a ?? 1, glow: 1, head: { r: 2.4, g: 26 } });
}

/** worlds growing out of footprints. stepTimes: footfall times (index = step k) */
export function drawWorlds(F, t, stepTimes, firstK, gp, o = {}) {
  for (let w = 0; w < worlds.length; w++) {
    const k = firstK + w;
    const t0 = stepTimes[k];
    if (t0 === undefined || t < t0) continue;
    const tNext = stepTimes[k + 1] ?? t0 + 99;
    const life = tNext - t0;
    const age = t - t0;
    const colStart = life - Math.min(0.2, life * 0.4);
    const collapse = o.hold && w === worlds.length - 1 ? 0 : clamp((age - colStart) / (life - colStart + 0.06));
    if (collapse >= 1) continue;
    const f = footAt(k, gp);
    const nf = footAt(k + 1, gp);
    drawWorld(F, worlds[w], { origin: [f[0], 0, 0], next: [nf[0], 0, nf[2]], age: age * (o.growRate ?? 1), collapse, t: age, a: o.a ?? 1, warp: o.warp });
  }
}

export function draw(F, lt, t) {
  const gp = lifeGait();
  const gt = t - T0;
  const fadeIn = E.inOutSine(u01(t, 7.22, 7.48));
  const fadeOut = 1 - E.inOutSine(u01(t, 12.05, 12.3));
  const J = drawWalker(F, t, gt, gp, { a: fadeIn * fadeOut, zones: [1, lerp(0.15, 0.45, u01(t, 7.4, 8.4)), lerp(0.05, 0.3, u01(t, 7.4, 8.4))] });
  dust(F, t, { n: 900, e: 0.08 * fadeIn, box: 16 });
  drawFootprints(F, t, STEPS, gp, { a: fadeIn * fadeOut });
  drawFootLine(F, t, gt, gp, J, { a: fadeIn * fadeOut });
  drawWorlds(F, t, STEPS, FIRST_WORLD, gp, { a: fadeOut, hold: true });
  drawWords(F, t, J, fadeOut);
}

function drawWords(F, t, J, fade) {
  const px = J.pelvis[0];
  const R = [1, 0, 0], U = [0, 1, 0];
  // WALKED — revealed letter by letter, travelling with her, perfectly smooth
  const [w0, w1] = EV.words03.walked;
  if (t > w0 && t < w1) {
    const a = E.outCubic(u01(t, w0, w0 + 0.3)) * (1 - E.inCubic(u01(t, w1 - 0.3, w1))) * fade;
    const x = 0.6 + (t - w0) * 1.21; // her mean speed
    text3D(F, 'WALKED', [x - 0.6, 1.25, 2.4], R, U, 0.62, {
      fam: 'D300', track: 0.22, a, glow: 0.35,
      per: (gi) => ({ a: clamp((t - w0) * 7 - gi * 0.6) }),
    });
  }
  // RAN — from behind her, accelerating hard past her
  const [r0, r1] = EV.words03.ran;
  if (t > r0 && t < r1) {
    const u = t - r0;
    const x = px - 3.2 + 0.4 * u + 3.6 * u * u * u;
    const v = 0.4 + 10.8 * u * u;
    const a = E.outCubic(u01(t, r0, r0 + 0.15)) * (1 - E.inQuad(u01(t, r1 - 0.25, r1))) * fade;
    for (let g = 0; g < 4; g++) {
      const lag = g * 0.035 * v;
      text3D(F, 'RAN', [x - lag, 0.9, 1.7], R, U, 0.7, {
        fam: 'D600', track: 0.06, a: a * [1, 0.35, 0.18, 0.08][g], glow: 0.3,
        per: () => ({ sx: 1 + v * 0.045 }),
      });
    }
  }
  // KEPT GOING — crosses the entire frame, left to right, without stopping
  const [k0, k1] = EV.words03.keptGoing;
  if (t > k0 && t < k1 + 0.4) {
    const u = (t - k0) / (k1 - k0);
    const x = px - 5.6 + u * 11.6;
    const a = E.outCubic(u01(t, k0, k0 + 0.2)) * (1 - E.inQuad(u01(t, k1, k1 + 0.4))) * fade;
    text3D(F, 'KEPT GOING', [x, 1.55, 3.4], R, U, 0.66, { fam: 'D400', track: 0.18, a, glow: 0.35, align: 'c' });
  }
}
