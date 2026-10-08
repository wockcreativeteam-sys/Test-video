// SHOT 06 — SLOWER (20.1 – 24.9 s)
// Out of her knee, back into the life walk — the same worlds, the same pace: the world keeps
// moving at 100 %. Her steps don't: 100, 90, 80, 70, 50, 30 %. The worlds keep growing where
// she should have been; her green line stretches between her and life's pace like elastic.
// SHE STARTED WALKING / A LITTLE SLOWER. is animated at falling frame rates; SLOWER rushes in,
// slows, almost stops, then creeps on.
import { clamp, lerp, E, mulberry32, track } from '../engine/util.js';
import { cloud } from '../engine/cloud.js';
import { glowLine } from '../engine/green.js';
import { walkerJoints, walkerCam, walkerParticles, walkerEnergy, lifeGait } from '../lib/walker.js';
import { drawFootprints, drawWorlds, footAt } from './s03.js';
import { glow3, textFlat, u01, dust, stepTime } from './common.js';
import { C, F as PF } from '../palette.js';
import { EV } from '../timeline.js';

const SS = EV.slowSteps; // her footfalls (slowing)
const STEP_T = 0.53;
const WT0 = SS[0]; // the world's own footfalls stay at full pace from here
const worldSteps = Array.from({ length: 10 }, (_, k) => +(WT0 + k * STEP_T).toFixed(3));
const P4 = [0, 0, 0, 0];

/** her gait time: each footfall lands on its (slowing) cue */
function gaitTime(t) {
  const keys = [[SS[0] - STEP_T, -STEP_T]];
  SS.forEach((s, k) => keys.push([s, k * STEP_T]));
  keys.push([SS[5] + 1.75, 6 * STEP_T]); // the next step would be very late (30 %)
  return track(keys.map(([a, b]) => [a, b, E.lin]), t);
}
/** where life's pace would have put her (pelvis x) */
function paceX(t, gp) {
  return ((t - WT0) / STEP_T) * gp.step + gp.step * 0.38;
}

let knee = null;
export function init() {
  const r = mulberry32(606);
  const n = 3000;
  knee = { n, o: new Float32Array(n * 3), e: new Float32Array(n), w: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    const a = r() * 6.283, b = Math.acos(2 * r() - 1), rr = 0.07 * Math.cbrt(r());
    knee.o[i * 3] = Math.cos(a) * Math.sin(b) * rr;
    knee.o[i * 3 + 1] = Math.cos(b) * rr * 1.3;
    knee.o[i * 3 + 2] = Math.sin(a) * Math.sin(b) * rr;
    knee.e[i] = 0.3 + r() * 0.7;
    knee.w[i] = 0.5 + r();
  }
}

export function draw(F, lt, t) {
  const gp = lifeGait(0.8, 0.45);
  const g = gaitTime(t);
  const J = walkerJoints(g, gp);
  const out = 1 - E.inOutSine(u01(t, 24.55, 24.9));
  // ---- camera: out of the knee, then tracking a point between her and life's pace ---------------
  const pull = E.inOutCubic(u01(t, 20.1, 20.95));
  const px = J.pelvis[0];
  const lag = paceX(t, gp) - px; // how far behind she is
  const cx = px + clamp(lag, 0, 99) * 0.5;
  const k = J.kneeR;
  const camOff = [lerp(-0.05, -1.2, pull), lerp(0, 1.3, pull), lerp(-0.22, -6.5, pull)];
  const look = [lerp(k[0] - cx + 0.02, 0.6, pull), lerp(k[1], 1.0, pull), lerp(k[2], 0, pull)];
  walkerCam(F, { pelvis: [cx] }, { off: [camOff[0] + (k[0] - cx) * (1 - pull), camOff[1] + k[1] * (1 - pull), camOff[2] + k[2] * (1 - pull)], look, fov: lerp(30, 35, pull) });
  // ---- the knee volume we came out of ------------------------------------------------------------
  const kv = 1 - E.inQuad(u01(t, 20.15, 20.8));
  if (kv > 0.003) {
    const P = new Float32Array(knee.n * 3);
    for (let i = 0; i < knee.n; i++) {
      const sw = t * knee.w[i];
      const ox = knee.o[i * 3], oz = knee.o[i * 3 + 2];
      P[i * 3] = k[0] + ox * Math.cos(sw) - oz * Math.sin(sw);
      P[i * 3 + 1] = k[1] + knee.o[i * 3 + 1];
      P[i * 3 + 2] = k[2] + ox * Math.sin(sw) + oz * Math.cos(sw);
    }
    cloud(F, P, knee.n, { rgb: PF.GREEN, E: knee.e, e: 0.5 * kv, near: [0.005, 0.05], dof: { focus: 0.3, range: 0.25, max: 8, gain: 0.3 } });
  }
  dust(F, t, { n: 800, e: 0.07, box: 16 });
  // ---- the world at full pace --------------------------------------------------------------------
  drawWorlds(F, t, worldSteps, 0, gp, { a: out * E.inOutSine(u01(t, 20.4, 20.8)) });
  drawFootprints(F, t, SS, gp, { a: out });
  // ---- her: echoes trail her as time thickens ----------------------------------------------------
  const slow = clamp((t - 21.4) / 2.6);
  for (let e = 3; e >= 0; e--) {
    if (e > 0 && slow <= 0.02) continue;
    const ge = g - e * 0.07 * (0.5 + slow);
    const Je = e === 0 ? J : walkerJoints(ge, gp);
    const b = walkerParticles(F, Je, t);
    const En = walkerEnergy();
    for (let i = 0; i < b.n; i++) En[i] *= [1, 0.5, 0.35][b.zone[i]];
    const a = e === 0 ? 1 : 0.22 * slow * (1 - e / 4);
    cloud(F, b.P, b.n, { rgb: PF.GREEN, E: En, e: 0.5 * a * out * E.inOutSine(u01(t, 20.3, 20.7)), near: [0.05, 0.4] });
  }
  // red gathering in the knee (fine particles), growing through the shot
  const redN = Math.round(lerp(18, 40, clamp((t - 20.1) / 4.5)));
  {
    const r = mulberry32(66);
    const P = new Float32Array(redN * 3);
    for (let i = 0; i < redN; i++) {
      const a = r() * 6.283 + t * (1.2 + r() * 2), b = r() * 3.14, rr = 0.03 + r() * 0.06;
      P[i * 3] = k[0] + Math.cos(a) * Math.sin(b) * rr;
      P[i * 3 + 1] = k[1] + Math.cos(b) * rr;
      P[i * 3 + 2] = k[2] + Math.sin(a) * Math.sin(b) * rr;
    }
    cloud(F, P, redN, { rgb: PF.RED, e: 0.85 * out, size: 0.7, near: [0.01, 0.1] });
  }
  // ---- her line: elastic between her feet and life's pace -----------------------------------------
  drawElastic(F, t, J, gp, out);
  // ---- type ----------------------------------------------------------------------------------------
  drawType(F, t, out);
}

function drawElastic(F, t, J, gp, a0) {
  const sw = J.feet.L.since > J.feet.R.since ? J.toeL : J.toeR;
  const fx = paceX(t, gp) + 0.25;
  const x0 = sw[0];
  const len = Math.max(0.05, fx - x0);
  const stretch = clamp((len - 0.4) / 2.6);
  const n = 64;
  const P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    // a taut band: it thins and trembles as it stretches
    P[i * 3] = lerp(x0, fx, u);
    P[i * 3 + 1] = lerp(Math.max(0.006, sw[1] * 0.5), 0.006, u) + Math.sin(u * Math.PI) * 0.03 * Math.sin(t * 40) * stretch;
    P[i * 3 + 2] = lerp(sw[2] * 0.6, 0, u);
  }
  const wv = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    wv[i] = lerp(1, 0.25, stretch) * (1 - 0.6 * Math.sin(Math.PI * u) * stretch);
  }
  glow3(F, P, n, { w: 2.4, wv, a: a0, glow: 1, head: { r: 2.4, g: 26 } });
  // the trail behind her (her own line, through her footprints)
  const back = [];
  const kNow = Math.floor(gaitTime(t) / STEP_T);
  for (let k = kNow - 8; k <= kNow; k++) {
    const f = footAt(k, gp);
    back.push(f[0] + 0.12, 0.006, f[2] * 0.6);
  }
  back.push(x0, Math.max(0.006, sw[1] * 0.5), sw[2] * 0.6);
  const m = back.length / 3;
  const av = new Float32Array(m);
  for (let i = 0; i < m; i++) av[i] = Math.pow(i / (m - 1), 1.5);
  glow3(F, new Float32Array(back), m, { w: 2.2, av, a: a0, glow: 1 });
}

function drawType(F, t, a0) {
  const x = 150, y1 = 236, y2 = 236 + 96;
  // SHE STARTED WALKING — appears at 24, then 12 fps
  if (t > 20.85 && t < 24.6) {
    const ts = stepTime(t, t < 21.6 ? 24 : 12);
    const u = E.outCubic(u01(ts, 20.85, 21.35));
    const a = u * a0 * (1 - E.inQuad(u01(t, 24.25, 24.6)));
    textFlat(F, 'SHE STARTED WALKING', x + (1 - u) * 60, y1, 64, { fam: 'D300', track: 0.12, a, glow: 0.3 });
  }
  // A LITTLE — at 8 fps
  if (t > 21.55 && t < 24.6) {
    const ts = stepTime(t, 8);
    const u = E.outCubic(u01(ts, 21.55, 22.05));
    const a = u * a0 * (1 - E.inQuad(u01(t, 24.25, 24.6)));
    textFlat(F, 'A LITTLE', x + (1 - u) * 60, y2, 64, { fam: 'D300', track: 0.12, a, glow: 0.3 });
  }
  // SLOWER. — rushes in, slows, almost stops, then creeps on (4 fps by the end)
  if (t > 21.95 && t < 24.6) {
    const fps = t < 22.6 ? 30 : t < 23.3 ? 12 : t < 23.9 ? 6 : 4;
    const ts = stepTime(t, fps);
    // position: decelerating approach to just short of its place, a stall, then a slow creep
    const X = track([
      [21.95, 1900, E.lin],
      [22.35, 700, E.outQuad],
      [22.75, 585, E.outCubic],
      [23.55, 578, E.outQuad],
      [24.45, 560, E.inOutSine],
    ], ts);
    const a = E.outCubic(u01(ts, 21.95, 22.1)) * a0 * (1 - E.inQuad(u01(t, 24.25, 24.6)));
    const speed = Math.abs(track([[21.95, 1900], [22.35, 700, E.outQuad], [22.75, 585, E.outCubic], [23.55, 578, E.outQuad], [24.45, 560, E.inOutSine]], ts + 1 / 30) - X) * 30;
    const smear = clamp(speed / 2500);
    for (let gst = 0; gst < 3; gst++) {
      if (gst > 0 && smear < 0.05) break;
      textFlat(F, 'SLOWER.', X + 190 + gst * 40 * smear, y2, 64, {
        fam: 'D500', track: 0.12, a: a * [1, 0.35, 0.15][gst], glow: 0.4, rgb: '232,255,238',
        per: () => ({ sx: 1 + smear * 0.6 }),
      });
    }
  }
}
