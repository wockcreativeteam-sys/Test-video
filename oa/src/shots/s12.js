// SHOT 12 — NOW (45.2 – 49.8 s)
// We pull out of the held hands: the two of them walking together, at her pace. The world moves
// around them and gives itself up — buildings become lines, lines become footsteps, footsteps
// become green particles, particles become stars. MAYBE NOW · NOTICE · HOW SHE WALKS. — the last
// three words walk, in step with her.
import { clamp, lerp, E, mulberry32, track } from '../engine/util.js';
import { cloud } from '../engine/cloud.js';
import { glowLine } from '../engine/green.js';
import { buildWorld } from '../lib/worlds.js';
import { prepWorld } from '../lib/growth.js';
import { gaitParams, walkPose, makeBody, poseBody, rimEnergy } from '../lib/figure.js';
import { glow3, textFlat, u01, dust, scrim } from './common.js';
import { C, F as PF } from '../palette.js';
import { EV } from '../timeline.js';

const TS = EV.togetherSteps; // her footfalls
const STEP = 0.62;
const P4 = [0, 0, 0, 0];
let mom = null, kid = null, street = null, stars = null, streetPts = null;

export function init() {
  mom = makeBody(15000, 121, { groups: { leg: 1.6, foot: 1.1, torso: 0.9, arm: 0.6, head: 0.7 } });
  kid = makeBody(13000, 122, { groups: { leg: 1.4, foot: 1.0, torso: 1.0, arm: 0.7, head: 0.7 } });
  street = prepWorld(buildWorld('street', 7));
  // the street as points (for the dissolve into footsteps / particles / stars)
  const r = mulberry32(1212);
  const pts = [];
  for (const ln of street.lines) {
    const p = ln.p;
    for (let i = 0; i < p.length - 3; i += 3) {
      const L = Math.hypot(p[i + 3] - p[i], p[i + 4] - p[i + 1], p[i + 5] - p[i + 2]);
      const m = Math.max(1, Math.round(L / 0.06));
      for (let k = 0; k < m; k++) {
        const u = (k + r()) / m;
        pts.push(p[i] + (p[i + 3] - p[i]) * u, p[i + 1] + (p[i + 4] - p[i + 1]) * u, p[i + 2] + (p[i + 5] - p[i + 2]) * u, r(), r());
      }
    }
  }
  streetPts = new Float32Array(pts);
  const n = 1800;
  stars = { n, P: new Float32Array(n * 3), e: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    stars.P[i * 3] = (r() - 0.5) * 60;
    stars.P[i * 3 + 1] = 2 + r() * 22;
    stars.P[i * 3 + 2] = 8 + r() * 30;
    stars.e[i] = 0.2 + r() * r() * 1.4;
  }
}

function gaitTime(t) {
  const keys = TS.map((s, k) => [s, k * STEP, E.lin]);
  keys.unshift([TS[0] - STEP, -STEP, E.lin]);
  keys.push([TS[TS.length - 1] + STEP, TS.length * STEP, E.lin]);
  return track(keys, t);
}

export function draw(F, lt, t) {
  const g = gaitTime(t);
  const gpM = gaitParams({ age: 0.82, limp: 0.18, cadence: 1 / STEP, step: 0.5 });
  const gpK = gaitParams({ age: 0.3, cadence: 1 / STEP, step: 0.5, arm: 0.5 });
  const JM = walkPose(g, gpM, { x: 0, z: -0.34 });
  const JK = walkPose(g + 0.02, gpK, { x: 0.02, z: 0.36 });
  // ---- camera: out of their hands, back to the two of them walking -------------------------------
  const px = (JM.pelvis[0] + JK.pelvis[0]) / 2;
  const hand = [(JM.handR[0] + JK.handL[0]) / 2, (JM.handR[1] + JK.handL[1]) / 2, (JM.handR[2] + JK.handL[2]) / 2];
  const pull = E.inOutCubic(u01(t, 45.2, 46.5));
  const rise = E.inOutSine(u01(t, 47.6, 49.8));
  const pos = [lerp(hand[0] - 0.05, px + 2.6, pull), lerp(hand[1] + 0.05, 1.25 + rise * 0.8, pull), lerp(hand[2] - 0.5, -6.6 - rise * 1.5, pull)];
  const tgt = [lerp(hand[0], px + 0.1, pull), lerp(hand[1], 1.1 + rise * 1.2, pull), lerp(hand[2], 0, pull)];
  F.cam.set(pos, tgt, lerp(40, 38, pull));
  F.cam.mirror = true;
  const out = 1 - E.inOutSine(u01(t, 49.45, 49.8));
  const inA = E.inOutSine(u01(t, 45.2, 45.6));
  // ---- the world gives itself up: buildings -> lines -> footsteps -> particles -> stars -----------
  drawDissolve(F, t, px, inA * out);
  // ---- the two of them -------------------------------------------------------------------------
  poseBody(mom, JM, { t, flow: 0.006 });
  const Em = rimEnergy(mom, F.cam, null, { base: 0.3, rim: 1.2 });
  cloud(F, mom.P, mom.n, { rgb: PF.GREEN, E: Em, e: 0.5 * inA * out, near: [0.05, 0.4] });
  poseBody(kid, JK, { t, flow: 0.006 });
  const Ek = rimEnergy(kid, F.cam, null, { base: 0.3, rim: 1.2 });
  cloud(F, kid.P, kid.n, { rgb: PF.LILAC, E: Ek, e: 0.42 * inA * out, near: [0.05, 0.4] });
  // their held hands: one green thread
  glow3(F, new Float32Array([...JM.handR, ...hand, ...JK.handL]), 3, { w: 2.2, a: inA * out, glow: 1 });
  // their footsteps, one line
  const n = 40;
  const fl = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = px - 6 + (i / (n - 1)) * 6.4;
    fl[i * 3] = x;
    fl[i * 3 + 1] = 0.006;
    fl[i * 3 + 2] = 0.02 * Math.sin(x * 5);
  }
  const av = new Float32Array(n);
  for (let i = 0; i < n; i++) av[i] = Math.pow(i / (n - 1), 1.4);
  glow3(F, fl, n, { w: 2.2, av, a: inA * out, glow: 1, head: { r: 2.2, g: 22 } });
  drawType(F, t, out);
}

function drawDissolve(F, t, px, a0) {
  if (a0 <= 0.003) return;
  // the street sits ahead of them (in world space it slides by as they walk)
  const x0 = 1.2; // world offset of the street origin
  const dis = u01(t, 46.2, 49.2); // 0 buildings ... 1 stars
  const n = streetPts.length / 5;
  const P = new Float32Array(n * 3), En = new Float32Array(n), RGB = new Float32Array(n * 3);
  const [vr, vg, vb] = PF.VIOLET_HI, [gr, gg, gb] = PF.GREEN;
  for (let i = 0; i < n; i++) {
    let x = streetPts[i * 5] + x0, y = streetPts[i * 5 + 1], z = streetPts[i * 5 + 2];
    const r1 = streetPts[i * 5 + 3], r2 = streetPts[i * 5 + 4];
    const k = clamp(dis * 1.25 - r1 * 0.25); // each point's own progress
    // 1) buildings -> lines: everything flattens towards horizontal strata
    const s1 = E.inOutCubic(clamp(k / 0.3));
    y = lerp(y, Math.round(y * 3) / 3 * 0.25, s1);
    // 2) lines -> footsteps: points gather onto the ground in pairs along their path
    const s2 = E.inOutCubic(clamp((k - 0.3) / 0.25));
    const fx = Math.round(x / 0.31) * 0.31, fz = (Math.round(x / 0.31) % 2 ? 0.14 : -0.14) + (r2 - 0.5) * 0.08;
    x = lerp(x, fx + (r2 - 0.5) * 0.08, s2);
    y = lerp(y, 0.01, s2);
    z = lerp(z, lerp(z, fz, 0.7), s2);
    // 3) footsteps -> green particles -> stars: rise and spread into the sky
    const s3 = E.inOutCubic(clamp((k - 0.55) / 0.45));
    x = lerp(x, x + (r1 - 0.5) * 30, s3);
    y = lerp(y, 3 + r2 * 18, s3);
    z = lerp(z, z + 12 + r1 * 20, s3);
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    const green = clamp((k - 0.4) / 0.15) * (1 - clamp((k - 0.85) / 0.15));
    RGB[i * 3] = lerp(vr, gr, green); RGB[i * 3 + 1] = lerp(vg, gg, green); RGB[i * 3 + 2] = lerp(vb, gb, green);
    En[i] = (0.4 + 0.5 * r2) * (k < 0.02 ? 0.7 : 1);
  }
  cloud(F, P, n, { RGB, E: En, e: 0.6 * a0, near: [0.2, 1], fog: [4, 40, 0.3] });
  // the street's own lines, giving way as the dissolve begins
  const la = 1 - E.inQuad(clamp(dis / 0.25));
  if (la > 0.01) {
    for (const ln of street.lines) {
      const p = ln.p;
      const q = new Float32Array(p.length);
      for (let i = 0; i < p.length; i += 3) {
        q[i] = p[i] + x0;
        q[i + 1] = p[i + 1];
        q[i + 2] = p[i + 2];
      }
      F.L.poly(q, { rgb: C.VIOLET, a: a0 * la * 0.55, w: 1, fog: [6, 22, 0.25] });
    }
  }
  // stars already waiting in the sky
  const sa = E.inOutSine(u01(t, 47.8, 49.4)) * a0;
  if (sa > 0) cloud(F, stars.P, stars.n, { rgb: PF.VIOLET_HI, E: stars.e, e: 0.7 * sa, size: 0.6 });
  void px;
}

function drawType(F, t, a0) {
  // MAYBE NOW
  if (t > 45.85 && t < 46.95) {
    const a = E.outCubic(u01(t, 45.85, 46.2)) * (1 - E.inQuad(u01(t, 46.65, 46.95))) * a0;
    scrim(F, 600, 180, 720, 120, 0.3 * a);
    textFlat(F, 'MAYBE NOW', 960, 270, 68, { fam: 'D300', track: 0.22, align: 'c', a, glow: 0.3 });
  }
  // NOTICE — it becomes visible: brought into focus from a blur of particles
  if (t > 46.95 && t < 47.8) {
    const u = E.outCubic(u01(t, 46.95, 47.3));
    const a = u * (1 - E.inQuad(u01(t, 47.5, 47.8))) * a0;
    textFlat(F, 'NOTICE', 960, 270, 76, { fam: 'D500', track: lerp(0.9, 0.24, u), align: 'c', a, glow: 0.45, rgb: '232,255,238' });
  }
  // HOW SHE WALKS. — the words walk: each steps forward on her footfalls
  if (t > 47.75 && t < 49.7) {
    const a = E.outCubic(u01(t, 47.75, 48.05)) * (1 - E.inQuad(u01(t, 49.35, 49.7))) * a0;
    const words = ['HOW', 'SHE', 'WALKS.'];
    const base = [610, 900, 1170];
    words.forEach((w, i) => {
      // each word takes a step on alternating footfalls after 47.5
      let dx = 0, lift = 0;
      TS.forEach((ts, k) => {
        if (ts < 47.4 || (k % 3) !== i) return;
        const u = u01(t, ts - 0.18, ts + 0.12);
        dx += 36 * E.inOutCubic(u);
        lift += Math.sin(Math.PI * u) * 16;
      });
      textFlat(F, w, base[i] + dx, 290 - lift, 64, { fam: 'D400', track: 0.18, a, glow: 0.3 });
    });
  }
}
