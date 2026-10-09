// Shared world for every shot: the da Vinci (two tessellation levels), the assembly robots, the
// hall, the endoscope tip, and effect helpers (sparks, laser scan contours, surface point clouds).
import { m4 } from '../engine/m4.js';
import { Geo, lathe, cylinder, rbox, superellipse } from '../engine/geo.js';
import { DaVinci, DV_MAT, defaultState, stowedState } from '../model/davinci.js';
import { Robot6 } from '../model/robot6.js';
import { buildSets, SET_MAT } from '../model/sets.js';
import { clamp, lerp, mulberry32 } from '../engine/util.js';
import { cloud } from '../engine/cloud.js';

export const W = {};
let ready = false;
export function initWorld(F) {
  if (ready) return W;
  ready = true;
  const R = F.R;
  W.hi = new DaVinci(R, 1);
  W.lo = new DaVinci(R, 0.6);
  W.driver = new Robot6(R, 'driver');
  W.welder = new Robot6(R, 'scan');
  W.grip = new Robot6(R, 'grip');
  W.S = buildSets(R);
  // endoscope tip (8 mm), face at y = 0, two lenses and two light ports
  const g = new Geo();
  g.add(lathe([[0, -0.15], [0.0042, -0.15], [0.0042, -0.0006], [0.0039, 0], [0, 0]], 64));
  W.scope = R.mesh(g);
  const lens = new Geo();
  for (const s of [-1, 1]) lens.add(lathe([[0, 0], [0.00125, 0], [0.00125, 0.0002], [0.0009, 0.00045], [0, 0.0005]], 40), m4.T(s * 0.0016, 0, 0.0006));
  W.lens = R.mesh(lens);
  const ports = new Geo();
  for (const s of [-1, 1]) ports.add(cylinder(0.0006, 0.0002, { seg: 20, bevel: 0.00005 }), m4.T(0, 0, s * 0.0024 - 0.0004 * s + 0.0));
  W.ports = R.mesh(ports);
  const rimG = new Geo();
  rimG.add(lathe([[0.0036, -0.0002], [0.0041, -0.0002], [0.0041, 0.0001], [0.0036, 0.0001]], 64, { crease: 60, wireMeridians: 0, wireRings: false }));
  W.scopeRim = R.mesh(rimG);
  // surface samples of the base for the scan point cloud
  W.basePts = W.hi.mesh.base.geo.sample(26000, 11);
  return W;
}
export { defaultState, stowedState, DV_MAT, SET_MAT };

/** the pallet under the cart at x (and an optional cyan edge glow) */
export function pallet(R, x, glow = 1) {
  R.add(W.S.pallet, m4.T(x, 0.04, 0), SET_MAT.GRAPH);
  R.add(W.S.palletEdge, m4.T(x, 0.075, 0), { alb: [0.02, 0.02, 0.02], rough: 0.4, emis: [0.3 * glow, 1.0 * glow, 1.4 * glow] });
}

/** deterministic sparks from a point: streaks with gravity. dir: main direction */
export function sparks(F, p, t, t0, o = {}) {
  const dt = t - t0;
  if (dt < 0 || dt > (o.life ?? 0.8)) return;
  const n = o.n ?? 140;
  const rnd = mulberry32(o.seed ?? 5);
  const dir = o.dir || [0, 1, 0];
  const P = new Float32Array(n * 3), Q = new Float32Array(n * 3), En = new Float32Array(n);
  let m = 0;
  for (let i = 0; i < n; i++) {
    const delay = rnd() * (o.spread ?? 0.08);
    const life = 0.15 + rnd() * (o.lifeMax ?? 0.5);
    const sp = (o.speed ?? 2.2) * (0.4 + rnd());
    const a = rnd() * Math.PI * 2, c = rnd() * 0.9;
    const v = [dir[0] + Math.cos(a) * c, dir[1] + rnd() * 0.4, dir[2] + Math.sin(a) * c];
    const vl = Math.hypot(v[0], v[1], v[2]);
    const tt = dt - delay;
    if (tt < 0 || tt > life) continue;
    const pos = (s) => [p[0] + (v[0] / vl) * sp * s, p[1] + (v[1] / vl) * sp * s - 4.9 * s * s, p[2] + (v[2] / vl) * sp * s];
    const a1 = pos(tt), a0 = pos(Math.max(0, tt - 0.022));
    P.set(a1, m * 3);
    Q.set(a0, m * 3);
    En[m] = (1 - tt / life) * (0.6 + rnd() * 0.8);
    m++;
  }
  cloud(F, P, m, { rgb: o.rgb || [1.0, 0.62, 0.28], E: En, e: o.e ?? 3, prev: Q, size: 0.6 });
}

/** a burst of soft dust (light in the haze) from a point */
export function puff(F, p, t, t0, o = {}) {
  const dt = t - t0;
  if (dt < 0 || dt > 1.4) return;
  const n = o.n ?? 600;
  const rnd = mulberry32(o.seed ?? 9);
  const P = new Float32Array(n * 3), En = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = (o.r ?? 0.6) * (0.3 + rnd()) * (1 - Math.exp(-dt * 4));
    P[i * 3] = p[0] + Math.cos(a) * r;
    P[i * 3 + 1] = p[1] + rnd() * 0.08 + dt * 0.05;
    P[i * 3 + 2] = p[2] + Math.sin(a) * r;
    En[i] = (0.3 + rnd()) * Math.exp(-dt * 2.2);
  }
  cloud(F, P, n, { rgb: o.rgb || [0.7, 0.8, 0.9], E: En, e: o.e ?? 0.5, size: 0.8, dof: { focus: 3, range: 2, max: 4, gain: 0.2 } });
}

// base outline at height y (matches the loft in davinci.js) -> closed list of world points
const BASE_OUT = superellipse(0.36, 0.42, 3.4, 96);
const BASE_PROF = [[0.012, 0.13], [0, 0.15], [0.004, 0.4], [0.016, 0.5], [0.04, 0.56], [0.08, 0.59], [0.13, 0.6]];
export function baseContour(y, root = [0, 0.08, 0]) {
  const yl = y - root[1];
  let ins = 0.13;
  for (let i = 1; i < BASE_PROF.length; i++) {
    if (yl <= BASE_PROF[i][1]) {
      const [i0, y0] = BASE_PROF[i - 1], [i1, y1] = BASE_PROF[i];
      ins = lerp(i0, i1, clamp((yl - y0) / (y1 - y0)));
      break;
    }
  }
  const s = [1 - (yl - 0.15) * 0.05, 1 - (yl - 0.15) * 0.03];
  return BASE_OUT.map((q) => [root[0] + (q.x - q.nx * ins) * s[0], y, root[2] - 0.02 + (q.z - q.nz * ins) * s[1]]);
}

/** points of the base surface below height y (scan "digital twin"), drawn as particles */
export function basePoints(F, root, yMax, e, o = {}) {
  const B = W.basePts;
  const P = new Float32Array(B.n * 3), En = new Float32Array(B.n);
  let m = 0;
  for (let i = 0; i < B.n; i++) {
    const y = B.P[i * 3 + 1] + root[1];
    if (y > yMax) continue;
    P[m * 3] = B.P[i * 3] + root[0];
    P[m * 3 + 1] = y;
    P[m * 3 + 2] = B.P[i * 3 + 2] + root[2];
    En[m] = 0.35 + 0.65 * Math.exp(-(yMax - y) * (o.fall ?? 9));
    m++;
  }
  cloud(F, P, m, { rgb: o.rgb || [0.35, 0.9, 1.0], E: En, e, size: 0 });
}
