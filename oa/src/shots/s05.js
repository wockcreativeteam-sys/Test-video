// SHOT 05 — THE FIRST INTERRUPTION (16.0 – 20.6 s)
// The clock's rings lift into an enormous spiral staircase rising into the haze. She climbs.
// First step, easy. Second, easy. Third: her line hits a red particle and the whole staircase
// bends around it. Fourth: another — the architecture starts to deform. Fifth: the camera dives
// into her knee. SOMEWHERE ALONG THE WAY runs along her line, and kinks with it.
import { clamp, lerp, E, mulberry32, track } from '../engine/util.js';
import { cloud } from '../engine/cloud.js';
import { gaitParams, walkPose, makeBody, poseBody, rimEnergy } from '../lib/figure.js';
import { glow3, textOnPath, u01, dust, project } from './common.js';
import { drawHead } from '../engine/lines.js';
import { handAngle } from './s04.js';
import { C, F as PF } from '../palette.js';
import { EV } from '../timeline.js';

const DEG = Math.PI / 180;
const RISE = 0.19, DTH = 10; // per step: height (m), angle (deg)
const R_IN = 1.6, R_OUT = 7.2, R_PATH = 6.0;
const NSTEP = 150;
const TH0 = 345; // she starts where the second hand stopped
const P4 = [0, 0, 0, 0];
const SS = EV.stairSteps; // footfalls
const HITS = EV.redHits;

// helix: angle (deg) clockwise from 12, as in the clock
const hx = (th, r) => -Math.sin(th * DEG) * r;
const hz = (th, r) => Math.cos(th * DEG) * r;
const stepTh = (i) => TH0 - 6 * DTH + i * DTH; // a few steps before her first
const stepY = (i) => (i - 6) * RISE;

// which step index (stair geometry) her k-th footfall lands on
const footStep = (k) => 6 + k + 1;

// ---- warp: the architecture bends around the red particles ---------------------------------------
let redPos = [];
function warpAmt(t, j) {
  const h = HITS[j];
  if (t < h - 0.02) return 0;
  const u = t - h;
  // a hard bend that partly relaxes; the second hit leaves the space deformed
  const settle = j === 0 ? 0.25 : 0.6;
  return (Math.exp(-u * 3.2) * (1 - settle) + settle) * E.outCubic(clamp(u / 0.12)) * (j === 0 ? 0.9 : 1.4);
}
function warp(t) {
  const amps = HITS.map((_, j) => warpAmt(t, j));
  return (P) => {
    for (let i = 0; i < P.length; i += 3) {
      let x = P[i], y = P[i + 1], z = P[i + 2];
      for (let j = 0; j < amps.length; j++) {
        const a = amps[j];
        if (a <= 0) continue;
        const c = redPos[j];
        const dx = x - c[0], dy = y - c[1], dz = z - c[2];
        const d2 = dx * dx + dy * dy + dz * dz;
        const f = a * 0.45 * Math.exp(-d2 / 3.2);
        const d = Math.sqrt(d2) + 1e-4;
        // push away from the particle (a lens of resistance) with a twist
        x += (dx / d) * f * 0.9 + (-dz / d) * f * 0.25;
        y += (dy / d) * f * 0.6;
        z += (dz / d) * f * 0.9 + (dx / d) * f * 0.25;
      }
      P[i] = x; P[i + 1] = y; P[i + 2] = z;
    }
    return P;
  };
}

// ---- geometry --------------------------------------------------------------------------------------
let stairLines = null, body = null;
function buildStairs() {
  const L = [];
  const arc = (th0, th1, r, y, n = 8) => {
    const p = [];
    for (let k = 0; k <= n; k++) {
      const th = lerp(th0, th1, k / n);
      p.push(hx(th, r), y, hz(th, r));
    }
    return new Float32Array(p);
  };
  for (let i = 0; i < NSTEP; i++) {
    const th = stepTh(i), y = stepY(i);
    const th1 = th + DTH;
    // tread: outer + inner edge, nose (radial), riser at the nose
    L.push({ p: arc(th, th1, R_OUT, y + RISE), w: 1 });
    L.push({ p: new Float32Array([hx(th, R_IN), y + RISE, hz(th, R_IN), hx(th, R_OUT), y + RISE, hz(th, R_OUT)]), w: 0.7 });
    L.push({ p: new Float32Array([hx(th, R_OUT), y, hz(th, R_OUT), hx(th, R_OUT), y + RISE, hz(th, R_OUT)]), w: 0.6 });
    if (i % 2 === 0) L.push({ p: arc(th, th1, R_IN, y + RISE, 4), w: 0.4 });
    // outer balusters every other step
    if (i % 2 === 0) L.push({ p: new Float32Array([hx(th + DTH / 2, R_OUT - 0.08), y + RISE, hz(th + DTH / 2, R_OUT - 0.08), hx(th + DTH / 2, R_OUT - 0.08), y + RISE + 1.0, hz(th + DTH / 2, R_OUT - 0.08)]), w: 0.35 });
  }
  // helical handrail + soffit line
  const rail = [], soff = [], col = [];
  for (let i = 0; i <= NSTEP * 4; i++) {
    const s = i / 4;
    const th = stepTh(0) + s * DTH, y = stepY(0) + s * RISE;
    rail.push(hx(th, R_OUT - 0.08), y + RISE + 1.0, hz(th, R_OUT - 0.08));
    soff.push(hx(th, R_OUT), y - 0.35, hz(th, R_OUT));
  }
  L.push({ p: new Float32Array(rail), w: 1 });
  L.push({ p: new Float32Array(soff), w: 0.5 });
  // the central column: vertical lines
  col.push({ p: new Float32Array([0, stepY(0) - 4, 0, 0, stepY(NSTEP), 0]), w: 0.45 });
  stairLines = L.concat(col);
  // impossible architecture: giant flights hanging in the haze, some upside down
  const rnd = mulberry32(5);
  const flights = [
    [-14, 9, 6, 0.4, 0, 1.0], [10, 14, -4, -0.9, 0, 1.2], [-6, 18, -12, 2.1, Math.PI, 1.4],
    [16, 4, 12, 1.4, 0, 1.6], [-18, -2, 14, -0.3, Math.PI / 2, 1.3], [4, 24, 8, 0.8, Math.PI, 1.8],
  ];
  for (const [fx, fy, fz, ry, rz, sc] of flights) {
    const cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    const tf = (x, y, z) => {
      const x1 = x * cz - y * sz, y1 = x * sz + y * cz;
      return [fx + (x1 * cy + z * sy) * sc, fy + y1 * sc, fz + (-x1 * sy + z * cy) * sc];
    };
    const n = 10 + Math.floor(rnd() * 6);
    const prof = [];
    for (let i = 0; i < n; i++) {
      prof.push(...tf(i * 0.9, i * 0.5, -1.4), ...tf(i * 0.9, (i + 1) * 0.5, -1.4), ...tf((i + 1) * 0.9, (i + 1) * 0.5, -1.4));
      L.push({ p: new Float32Array([...tf(i * 0.9, (i + 1) * 0.5, -1.4), ...tf(i * 0.9, (i + 1) * 0.5, 1.4)]), w: 0.3, far: 1 });
    }
    L.push({ p: new Float32Array(prof), w: 0.55, far: 1 });
    const prof2 = [];
    for (let i = 0; i < n; i++) prof2.push(...tf(i * 0.9, (i + 1) * 0.5, 1.4), ...tf((i + 1) * 0.9, (i + 1) * 0.5, 1.4));
    L.push({ p: new Float32Array(prof2), w: 0.4, far: 1 });
  }
  stairLines = L.concat(col);
}

export function init() {
  buildStairs();
  body = makeBody(16000, 31, { groups: { leg: 1.7, foot: 1.1, torso: 0.85, arm: 0.6, head: 0.65 } });
  redPos = HITS.map((_, j) => {
    const i = footStep(2 + j);
    const th = stepTh(i) + DTH * 0.5;
    return [hx(th, R_PATH), stepY(i) + RISE + 0.06, hz(th, R_PATH)];
  });
}

// gait time that lands each footfall exactly on its cue
function gaitTime(t) {
  const T = 0.7;
  const keys = [[SS[0] - 0.7, -T], ...SS.map((s, k) => [s, k * T]), [SS[4] + 0.7, 5 * T]];
  return track(keys.map(([a, b]) => [a, b, E.lin]), t);
}

/** her joints in world space (straight-stair walk mapped onto the helix) */
function herJoints(t) {
  const gp = gaitParams({ age: 0.72, cadence: 1 / 0.7, stairs: { rise: RISE, run: 0.62 } });
  gp.step = (R_PATH * DTH * DEG);
  const g = gaitTime(t);
  const J = walkPose(g, gp, {});
  const base = stepTh(footStep(-1)) + DTH * 0.5;
  const y0 = stepY(footStep(-1));
  const map = (p) => {
    const th = base + (p[0] / (R_PATH * DEG));
    const r = R_PATH - p[2];
    return [hx(th, r), p[1] + y0, hz(th, r)];
  };
  const W = {};
  for (const k in J) if (Array.isArray(J[k]) && J[k].length === 3 && typeof J[k][0] === 'number') W[k] = map(J[k]);
  return W;
}

// ---- camera ----------------------------------------------------------------------------------------
function camAt(F, t, W) {
  const p = W.pelvis;
  const thP = Math.atan2(-p[0], p[2]) / DEG;
  // from the well of the staircase, looking out and up at her
  const camTh = thP - 4;
  const near = [hx(camTh, 0.7), p[1] + 0.25, hz(camTh, 0.7)];
  const look = [hx(thP + 9, R_PATH), p[1] + 2.4, hz(thP + 9, R_PATH)];
  // the knee dive
  const kd = E.inOutCubic(u01(t, EV.kneeDive[0], EV.kneeDive[1] - 0.15));
  const k = W.kneeR;
  const pos = [lerp(near[0], k[0] + (near[0] - k[0]) * 0.03, kd), lerp(near[1], k[1], kd), lerp(near[2], k[2] + (near[2] - k[2]) * 0.03, kd)];
  const tgt = [lerp(look[0], k[0], kd), lerp(look[1], k[1], kd), lerp(look[2], k[2], kd)];
  // arrival from the clock overview
  const arr = E.inOutCubic(u01(t, 16.0, 16.85));
  const over = [Math.sin(13 * 3.5 * DEG) * 10.5, 11.5, -10.5];
  const P = [lerp(over[0], pos[0], arr), lerp(over[1], pos[1], arr), lerp(over[2], pos[2], arr)];
  const T = [lerp(0, tgt[0], arr), lerp(0, tgt[1], arr), lerp(0.6, tgt[2], arr)];
  F.cam.set(P, T, lerp(42, 80, arr) - kd * 40);
}

export function draw(F, lt, t) {
  const W = herJoints(t);
  camAt(F, t, W);
  const fadeIn = E.inOutSine(u01(t, 16.0, 16.45));
  const out = 1 - E.inOutSine(u01(t, 20.25, 20.6));
  const rise = E.inOutCubic(u01(t, 16.0, 16.75)); // the dial's rings lift into the helix
  const wf = warp(t);
  // ---- staircase ----------------------------------------------------------------------------------
  const q = new Float32Array(64 * 3);
  for (const ln of stairLines) {
    const p = ln.p;
    const n = p.length / 3;
    const Q = n * 3 <= q.length ? q.subarray(0, n * 3) : new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      Q[i * 3] = p[i * 3];
      Q[i * 3 + 1] = p[i * 3 + 1] * rise;
      Q[i * 3 + 2] = p[i * 3 + 2];
    }
    wf(Q);
    F.L.poly(Q, { rgb: ln.w >= 0.9 ? C.VIOLET_HI : C.VIOLET, a: fadeIn * out * (ln.far ? 0.42 : ln.w >= 0.9 ? 0.85 : 0.75 * ln.w + 0.25), w: ln.w >= 0.9 ? 1.4 : 1.0, fog: ln.far ? [8, 60, 0.2] : [3, 40, 0.1], near: [0.3, 1.2], layer: ln.w >= 0.9 ? 2 : 0 });
  }
  dust(F, t, { n: 900, e: 0.09, box: 18 });
  // ---- her line: up the staircase ahead of her, kinked by the red ---------------------------------
  const kinks = HITS.map((_, j) => warpAmt(t, j));
  const pathPts = [];
  const sNow = clamp((gaitTime(t) / 0.7) + 0.5, 0, 6);
  for (let s = sNow - 1.5; s <= sNow + 40; s += 0.12) {
    const i = footStep(-1) + s;
    const th = stepTh(i) + DTH * 0.5;
    let y = stepY(i) + RISE + 0.05;
    let r = R_PATH;
    // kinks: sharp V where the red particles sit
    HITS.forEach((_, j) => {
      const sj = 2 + j + 1;
      const d = s - sj;
      if (kinks[j] > 0) y -= kinks[j] * 0.3 * Math.max(0, 1 - Math.abs(d) / 0.5);
    });
    pathPts.push(hx(th, r), y * rise, hz(th, r));
  }
  const PP = wf(new Float32Array(pathPts));
  const nP = PP.length / 3;
  const av = new Float32Array(nP);
  for (let i = 0; i < nP; i++) av[i] = clamp(i / 10) * (1 - i / nP);
  glow3(F, PP, nP, { w: 2.4, persp: 260, wMin: 0.4, wMax: 3, av, a: fadeIn * out, glow: 1, fog: [4, 40, 0.15] });
  // ---- the red particles ----------------------------------------------------------------------------
  HITS.forEach((h, j) => {
    const appear = E.outCubic(u01(t, h - 0.9, h - 0.5));
    if (appear <= 0) return;
    const hit = t > h;
    const c = redPos[j];
    // before the hit it waits on the line; after, it clings to her knee
    const k = W.kneeR;
    const m = hit ? E.outCubic(u01(t, h, h + 0.35)) : 0;
    const p = [lerp(c[0], k[0], m), lerp(c[1] * rise, k[1], m), lerp(c[2], k[2], m)];
    if (!F.cam.project(p[0], p[1], p[2], P4)) return;
    const pulse = 0.8 + 0.2 * Math.sin(t * 9 + j);
    const a = appear * out * pulse * (hit ? 0.75 : 1);
    drawHead(F, { x: P4[0], y: P4[1], r: 2.4, rgb: C.RED, core: C.RED_HI, g: 22, gi: 0.9, a });
    if (hit && t - h < 0.5) {
      F.fx.ca = Math.max(F.fx.ca || 0, 7 * (1 - (t - h) / 0.5));
      F.fx.ring = { c: [P4[0] / F.W, P4[1] / F.H], r: (t - h) * 1.4, w: 0.05, a: 0.03 * (1 - (t - h) / 0.5), glow: 0.08 * (1 - (t - h) / 0.5), rgb: [1, 0.2, 0.3] };
    }
  });
  // ---- her ---------------------------------------------------------------------------------------------
  poseBody(body, W, { t, flow: 0.006 });
  const En = rimEnergy(body, F.cam, null, { base: 0.3, rim: 1.2 });
  cloud(F, body.P, body.n, { rgb: PF.GREEN, E: En, e: 0.5 * fadeIn * out, near: [0.05, 0.5] });
  // red accumulating in her knee (a few particles orbiting it)
  const redK = HITS.reduce((s, h) => s + (t > h ? E.outCubic(u01(t, h, h + 0.5)) : 0), 0);
  if (redK > 0) {
    const k = W.kneeR;
    const r = mulberry32(55);
    const n = Math.round(18 * redK);
    const P = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283 + t * (1.5 + r() * 2), b = r() * 3.14, rr = 0.04 + r() * 0.05;
      P[i * 3] = k[0] + Math.cos(a) * Math.sin(b) * rr;
      P[i * 3 + 1] = k[1] + Math.cos(b) * rr;
      P[i * 3 + 2] = k[2] + Math.sin(a) * Math.sin(b) * rr;
    }
    cloud(F, P, n, { rgb: PF.RED, e: 0.9 * out, size: 0.8, near: [0.02, 0.2] });
  }
  // the knee as a dense volume when we dive into it
  const kv = E.inQuad(u01(t, EV.kneeDive[0] - 0.2, EV.kneeDive[1] - 0.2));
  if (kv > 0) {
    const k = W.kneeR;
    const r = mulberry32(77);
    const n = 7000;
    const P = new Float32Array(n * 3), En = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, b = Math.acos(2 * r() - 1), rr = 0.07 * Math.cbrt(r());
      const sw = t * (0.5 + r());
      P[i * 3] = k[0] + Math.cos(a + sw) * Math.sin(b) * rr;
      P[i * 3 + 1] = k[1] + Math.cos(b) * rr * 1.3;
      P[i * 3 + 2] = k[2] + Math.sin(a + sw) * Math.sin(b) * rr;
      En[i] = 0.3 + r() * 0.7;
    }
    cloud(F, P, n, { rgb: PF.GREEN, E: En, e: 1.2 * kv * out, near: [0.005, 0.03], dof: { focus: 0.15, range: 0.2, max: 8, gain: 0.45 } });
  }
  // the dive: rushing into the knee
  if (t > EV.kneeDive[0]) {
    const u = u01(t, EV.kneeDive[0], EV.kneeDive[1]);
    F.fx.zoom = 0.3 * Math.sin(Math.PI * u);
    if (F.cam.project(W.kneeR[0], W.kneeR[1], W.kneeR[2], P4)) F.fx.zoomC = [P4[0] / F.W, P4[1] / F.H];
  }
  // ---- SOMEWHERE ALONG THE WAY — written along her line, kinking with it ---------------------------
  drawLineText(F, t, PP, nP, fadeIn * out);
}

function drawLineText(F, t, PP, nP, a0) {
  const t0 = 16.95, t1 = 19.4;
  if (t < t0 || t > t1 + 0.3) return;
  const runs = project(F, PP, nP);
  if (!runs.length) return;
  const r = runs.reduce((a, b) => (b.n > a.n ? b : a));
  // lift the text a little above the line, starting just ahead of her feet
  const str = 'SOMEWHERE ALONG THE WAY';
  const reveal = (t - t0) * 14;
  textOnPath(F, str, r.S, r.n, 60, 30, {
    fam: 'D500', track: 0.12, lift: 14, a: a0 * (1 - E.inQuad(u01(t, t1, t1 + 0.3))),
    per: (gi) => ({ a: clamp(reveal - gi) }),
  });
}
