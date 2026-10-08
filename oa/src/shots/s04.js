// SHOT 04 — TIME BREAKS (11.9 – 16.6 s)
// The camera pulls back: her whole life has been walking the rim of a gigantic clock. The
// numerals (5 … 60 — minutes, and ages) are made of thousands of footprints, the gears are
// rings of footprints, and the second hand is her own green line, sweeping impossibly fast.
// Chronophotographic ghosts of her trail the hand and age as it passes 20, 30, 40, 50.
// Then the clock stutters — one frame repeats, again, again — and the line loses momentum.
// No type. A first red particle appears, almost invisibly.
import { clamp, lerp, E, mulberry32, track } from '../engine/util.js';
import { cloud } from '../engine/cloud.js';
import { shape, sampleOutline } from '../engine/glyphs.js';
import { gaitParams, walkPose, makeBody, poseBody, rimEnergy } from '../lib/figure.js';
import { glow3, u01, dust } from './common.js';
import { drawHead } from '../engine/lines.js';
import { C, F as PF } from '../palette.js';
import { EV } from '../timeline.js';

const R = 6.0; // rim (her path)
const DEG = Math.PI / 180;
const P4 = [0, 0, 0, 0];

/** clock angle (deg, clockwise on screen from 12) -> ground point at radius r */
export const dialPt = (th, r, y = 0) => [-Math.sin(th * DEG) * r, y, Math.cos(th * DEG) * r];

// ---- time: the stutter and the loss of momentum ------------------------------------------------
const ST = EV.stutter; // [14.8, 15.06, 15.32]
export function clockTime(t) {
  if (t < ST[0]) return t;
  const rep = ST[1] - ST[0];
  if (t < ST[2] + rep) {
    const k = (t - ST[0]) / rep;
    const f = k - Math.floor(k);
    return ST[0] + Math.min(f * rep, 0.075);
  }
  const u = t - (ST[2] + rep);
  return ST[0] + 0.075 + 0.95 * (1 - Math.exp(-u / 0.85));
}
const THETA = [
  [11.9, 0],
  [12.5, 32, E.inQuad],
  [13.1, 120, E.inQuad],
  [14.6, 300, E.lin],
  [14.875, 333, E.lin],
];
export function handAngle(t) {
  const c = clockTime(t);
  if (c <= 14.875) return track(THETA, c);
  return 333 + (c - 14.875) * 20;
}
// age along the dial: 20s at 120°, 50s at 300°
const ageAt = (th) => clamp(lerp(0.08, 0.92, th / 340));

// ---- the dial: footprint numerals, footprint gears, ticks ---------------------------------------
let dial = null, ghostBody = null, heroBody = null;
function buildDial() {
  const rnd = mulberry32(404);
  const prints = []; // [x, z, angle] per footprint
  // numerals 5..60 at r = 4.35, upright relative to the viewer (baseline facing the centre's bottom)
  for (let h = 1; h <= 12; h++) {
    const str = String(h * 5);
    const S = shape(str, 'D500', { track: 0.04 });
    const n = Math.round(60 * str.length);
    const pts = sampleOutline(S, n);
    const th = h * 30;
    const c = dialPt(th, 4.35);
    const size = 0.95;
    for (let i = 0; i < n; i++) {
      const ex = (pts[i * 2] - S.width / 2) * size, ey = (pts[i * 2 + 1] + S.capH / 2) * size;
      // glyph x -> world -x (screen right), glyph y (down) -> world -z (towards the viewer)
      const j = (i + 1) % n;
      const dx = pts[j * 2] - pts[i * 2], dy = pts[j * 2 + 1] - pts[i * 2 + 1];
      prints.push(c[0] - ex, c[2] - ey, Math.atan2(-dy, -dx), 1);
    }
  }
  // gears: rings of footprints that turn at different rates
  const rings = [1.25, 2.15, 3.05];
  rings.forEach((r, ri) => {
    const m = Math.round((2 * Math.PI * r) / 0.24);
    for (let i = 0; i < m; i++) prints.push(r, (i / m) * 360, ri + 2, 0); // polar; resolved per frame
  });
  // rim ticks: a pair of prints per minute, longer at the hours
  const ticks = [];
  for (let i = 0; i < 60; i++) ticks.push([i * 6, i % 5 === 0 ? 0.55 : 0.25]);
  dial = { prints: new Float32Array(prints), n: prints.length / 4, ticks };
  void rnd;
}

export function init() {
  buildDial();
  ghostBody = makeBody(2600, 21, { groups: { leg: 1.6, foot: 1.0, torso: 0.8, arm: 0.5, head: 0.6 } });
  heroBody = makeBody(16000, 23, { groups: { leg: 1.6, foot: 1.1, torso: 0.85, arm: 0.6, head: 0.65 } });
}

/** her figure at dial angle th (deg), gait time g, age a — returns joints in world space */
function figureAt(body, th, g, age, t) {
  const gp = gaitParams({ age, cadence: lerp(1.9, 1.5, age) });
  const J = walkPose(g, gp, {});
  // local walk: +x forward; place the pelvis on the rim, forward = clockwise tangent
  const px = J.pelvis[0];
  const a = th * DEG;
  const c = dialPt(th, R);
  const fwd = [-Math.cos(a), 0, -Math.sin(a)]; // d/dθ of dialPt (clockwise)
  const out = [Math.sin(a), 0, -Math.cos(a)]; // towards the centre? (−position/R)
  const inw = [Math.sin(a), 0, -Math.cos(a)];
  void out;
  const map = (p) => [c[0] + fwd[0] * (p[0] - px) + inw[0] * -p[2], p[1], c[2] + fwd[2] * (p[0] - px) + inw[2] * -p[2]];
  const W = {};
  for (const k in J) if (Array.isArray(J[k]) && J[k].length === 3 && typeof J[k][0] === 'number') W[k] = map(J[k]);
  W.feet = J.feet;
  poseBody(body, W, { t, flow: 0.007 });
  return W;
}

// ---- camera ---------------------------------------------------------------------------------------
function camAt(F, t, th) {
  // start: beside her (inside the dial, so she walks left-to-right), pull back up over the dial
  const u = E.inOutCubic(u01(t, 11.9, 13.05));
  const a = th * DEG;
  const her = dialPt(th, R);
  const fwd = [-Math.cos(a), 0, -Math.sin(a)];
  const inw = [Math.sin(a), 0, -Math.cos(a)];
  const near = [her[0] - fwd[0] * 1.2 + inw[0] * 6.5, 1.3, her[2] - fwd[2] * 1.2 + inw[2] * 6.5];
  const nearT = [her[0] + fwd[0] * 0.6, 1.0, her[2] + fwd[2] * 0.6];
  const orbit = (t - 13) * 3.5 * DEG;
  const far = [Math.sin(orbit) * 10.5, 11.5, -Math.cos(orbit) * 10.5 - 0.5];
  const farT = [0, 0, 0.6];
  // rise through an arc
  const pos = [lerp(near[0], far[0], u), lerp(near[1], far[1], u) + Math.sin(Math.PI * u) * 2.5, lerp(near[2], far[2], u)];
  const tgt = [lerp(nearT[0], farT[0], u), lerp(nearT[1], farT[1], u), lerp(nearT[2], farT[2], u)];
  F.cam.set(pos, tgt, lerp(35, 42, u));
}

export function draw(F, lt, t) {
  const c = clockTime(t);
  const th = handAngle(t);
  camAt(F, t, Math.min(th, 8));
  const fadeIn = E.inOutSine(u01(t, 11.95, 12.35));
  const out = 1 - E.inOutSine(u01(t, 16.15, 16.6));
  const dialA = E.inOutSine(u01(t, 12.15, 12.9)) * out;
  const stut = ST.some((s) => t >= s && t < s + 0.05) ? 1 : 0;
  if (stut) {
    F.fx.ca = 9;
    F.fx.exposure = 1.12;
  }
  dust(F, t, { n: 700, e: 0.07, box: 26 });

  // ---- the dial --------------------------------------------------------------------------------------
  if (dialA > 0.003) {
    const n = dial.n;
    const P = new Float32Array(n * 6);
    const En = new Float32Array(n * 2);
    let m = 0;
    for (let i = 0; i < n; i++) {
      let x = dial.prints[i * 4], z = dial.prints[i * 4 + 1], ang = dial.prints[i * 4 + 2];
      const kind = dial.prints[i * 4 + 3];
      let bright = 0.55;
      if (kind === 0) {
        // gear print: polar (r, deg, ring)
        const r = x, a0 = z, ring = ang;
        const rate = [0, 0, 1.0, -0.55, 0.32][ring] * 1.0;
        const a = (a0 + c * rate * 60) * DEG;
        x = -Math.sin(a) * r;
        z = Math.cos(a) * r;
        ang = a + (rate > 0 ? 0 : Math.PI);
        bright = 0.42;
      } else {
        // numerals glow as the hand passes them
        const nth = Math.round(Math.atan2(-x, z) / DEG / 30) * 30;
        const d = ((th - ((nth + 360) % 360)) + 720) % 360;
        bright = 0.55 + 1.6 * Math.exp(-d / 25) * (d < 180 ? 1 : 0);
      }
      // a footprint = heel + forefoot blob, along the stroke
      const ca = Math.cos(ang), sa = Math.sin(ang);
      P[m * 3] = x - ca * 0.045; P[m * 3 + 1] = 0.01; P[m * 3 + 2] = z - sa * 0.045;
      En[m++] = bright * 0.8;
      P[m * 3] = x + ca * 0.05; P[m * 3 + 1] = 0.01; P[m * 3 + 2] = z + sa * 0.05;
      En[m++] = bright;
    }
    cloud(F, P, m, { rgb: PF.VIOLET_HI, E: En, e: 0.75 * dialA, size: 1.0, sizeK: 0.02 });
    // ticks + rim + hub
    for (const [deg, len] of dial.ticks) {
      const a = dialPt(deg, R + 0.35), b = dialPt(deg, R + 0.35 + len);
      F.L.poly(new Float32Array([...a, ...b]), { rgb: C.VIOLET_HI, a: dialA * (len > 0.4 ? 0.7 : 0.4), w: len > 0.4 ? 1.4 : 1 });
    }
    for (const rr of [R - 0.3, R + 0.3, 0.32]) {
      const ring = [];
      for (let i = 0; i <= 180; i++) ring.push(...dialPt(i * 2, rr));
      F.L.poly(new Float32Array(ring), { rgb: C.VIOLET, a: dialA * 0.45, w: 1 });
    }
  }

  // ---- her: the hero at the hand's tip and the chronophotographic trail -----------------------------
  const gSpeed = lerp(1, 4.2, E.inOutSine(u01(t, 12.4, 13.2))) * (t > 15.6 ? lerp(1, 0.25, u01(t, 15.6, 16.6)) : 1);
  const g = (c - 11.9) * gSpeed + 5.5;
  const heroA = fadeIn * out;
  const W = figureAt(heroBody, th, g, ageAt(th), t);
  const Eh = rimEnergy(heroBody, F.cam, null, { base: 0.32, rim: 1.2 });
  cloud(F, heroBody.P, heroBody.n, { rgb: PF.GREEN, E: Eh, e: 0.55 * heroA });
  // ghosts every 8 degrees behind the hand
  const ghostA = dialA * clamp((th - 10) / 40);
  if (ghostA > 0.01) {
    for (let j = 1; j <= 26; j++) {
      const tg = th - j * 8;
      if (tg < 2) break;
      const fall = Math.exp(-j / 9) * ghostA;
      figureAt(ghostBody, tg, g - j * 0.11, ageAt(tg), t);
      const Eg = rimEnergy(ghostBody, F.cam, null, { base: 0.25, rim: 1 });
      cloud(F, ghostBody.P, ghostBody.n, { rgb: PF.GREEN, E: Eg, e: 0.5 * fall });
    }
  }
  // ---- the second hand: her line --------------------------------------------------------------------
  const handA = E.inOutSine(u01(t, 12.3, 12.9)) * out;
  if (handA > 0.003) {
    const tip = dialPt(th, R - 0.25, 0.02);
    const tail = dialPt(th + 180, 1.1, 0.02);
    glow3(F, new Float32Array([...tail, 0, 0.02, 0, ...tip]), 3, { w: 3.2, a: handA, glow: 1.2, head: { r: 3, g: 40 } });
    // motion smear of the sweep
    const speed = Math.abs(handAngle(t) - handAngle(t - 1 / 30)) * 30;
    const smear = clamp(speed / 140);
    for (let k = 1; k <= 6; k++) {
      const tp = dialPt(th - k * 2.2 * smear, R - 0.25, 0.02);
      F.L.poly(new Float32Array([0, 0.02, 0, ...tp]), { rgb: C.GREEN, a: handA * 0.22 * smear * (1 - k / 7), w: 2, layer: 2 });
    }
    drawHubDot(F, handA);
  }
  // ---- the first red particle, almost invisible ----------------------------------------------------
  if (t > EV.firstRed) {
    const k = W.kneeR;
    if (F.cam.project(k[0], k[1], k[2], P4)) {
      const a = 0.35 * E.outCubic(u01(t, EV.firstRed, EV.firstRed + 0.3)) * out;
      const [r, gg, b] = PF.RED;
      F.S.blob(P4[0], P4[1], 1.1, r * a * 2, gg * a * 2, b * a * 2);
    }
  }
}

function drawHubDot(F, a) {
  if (F.cam.project(0, 0.02, 0, P4)) drawHead(F, { x: P4[0], y: P4[1], r: 3.2, rgb: C.GREEN, g: 30, gi: 0.8, a });
}
