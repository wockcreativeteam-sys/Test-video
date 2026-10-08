// SHOT 01 — THE FIRST LINE (0 – 4.25 s)
// Black. A microscopic green point. An impossible dive: the point is a particle on a child's
// fingertip, orbited by thousands of smaller ones. The child's hand is traced by the line; it
// reaches; a mother's hand reaches back. Contact: a radial displacement wave crosses the frame,
// the life passes into her hand, both hands become a constellation, the constellation becomes a
// topographic map, the map tilts and the line becomes a walking path — which we dive into.
// Ground plane y = 0, units cm. Hand space (x, y) maps to world (x, 0, -y); the camera looks down.
import { clamp, lerp, E, mulberry32, track } from '../engine/util.js';
import { handRig, traceHand, POSES, mixPose } from '../lib/hand.js';
import { glowLine, subPath } from '../engine/green.js';
import { cloud } from '../engine/cloud.js';
import { pnoise } from '../engine/noise.js';
import { drawHead } from '../engine/lines.js';
import { textFlat, u01, project } from './common.js';
import { C, F as PF } from '../palette.js';
import { EV } from '../timeline.js';

const FOV = 35;
const FOCAL = 540 / Math.tan((FOV * Math.PI) / 360);
const TOUCH = EV.touch;
const CP = [0, 0]; // contact point (hand space)
const PHI_C = -48, PHI_M = 132; // hand rotations (deg, ccw), child fingers up-right, mother's down-left
const DEG = Math.PI / 180;

// ---- the hands ------------------------------------------------------------------------------------
function childPose(t) {
  return mixPose(POSES.rest, POSES.reach, E.inOutCubic(u01(t, 1.5, 2.2)));
}
function motherPose(t) {
  return mixPose(POSES.rest, POSES.reach, E.inOutCubic(u01(t, 1.7, 2.3)));
}
function childTip(t) {
  const u = E.inOutSine(u01(t, 1.55, TOUCH));
  return [lerp(-2.6, CP[0], u), lerp(-2.0, CP[1], u)];
}
function motherTip(t) {
  const u = E.outCubic(u01(t, 1.6, TOUCH));
  return [lerp(3.4, CP[0] + 0.05, u), lerp(2.6, CP[1] + 0.04, u)];
}
const cache = { k: null, v: null };
/** both traced hands at time t (hand space), frozen after the touch */
function hands(t) {
  const tt = Math.min(t, TOUCH + 0.01);
  const key = Math.round(tt * 120);
  if (cache.k === key) return cache.v;
  const out = {};
  for (const [name, kind, pose, tip, phi] of [
    ['child', 'child', childPose(tt), childTip(tt), PHI_C],
    ['mother', 'mother', motherPose(tt), motherTip(tt), PHI_M],
  ]) {
    const rig = handRig(kind, pose, { cut: -14 });
    const T = traceHand(rig, kind === 'child' ? 0.07 : 0.09, kind === 'child' ? 0.5 : 0.6);
    const lt = T.tips[1];
    const c = Math.cos(phi * DEG), s = Math.sin(phi * DEG);
    const P = new Float32Array(T.n * 2);
    for (let i = 0; i < T.n; i++) {
      const lx = T.P[i * 2] - lt[0], ly = T.P[i * 2 + 1] - lt[1];
      P[i * 2] = tip[0] + lx * c - ly * s;
      P[i * 2 + 1] = tip[1] + lx * s + ly * c;
    }
    out[name] = { P, n: T.n, cum: T.cum, L: T.L, sTip: T.tipS[1], tip };
  }
  cache.k = key;
  cache.v = out;
  return out;
}

// ---- camera ---------------------------------------------------------------------------------------
const LOGS = [
  [0.0, Math.log(0.012)],
  [0.72, Math.log(0.014)],
  [1.52, Math.log(260), E.inOutQuart],
  [2.12, Math.log(23.5), E.inOutCubic],
  [2.95, Math.log(25), E.inOutSine],
];
function scaleAt(t) {
  return Math.exp(track(LOGS, t));
}
// the path: from the contact point, winding forward (+y in hand space) across the map
const PATH = (() => {
  const pts = [];
  for (let i = 0; i <= 260; i++) {
    const s = i * 2.4;
    const k = Math.min(1, s / 40);
    const x = (Math.sin(s / 21) * 7 + Math.sin(s / 7.3) * 1.1) * (1 - 0.75 * k) + Math.sin(s / 95) * 22 * k + s * 0.02;
    pts.push(x, s);
  }
  return new Float32Array(pts);
})();
const PATH_N = PATH.length / 2;
function pathAt(s) {
  if (s < 0) {
    const d = [PATH[2] - PATH[0], PATH[3] - PATH[1]];
    const l = Math.hypot(d[0], d[1]);
    return [PATH[0] + (d[0] / l) * s, PATH[1] + (d[1] / l) * s];
  }
  const i = clamp(Math.floor(s / 2.4), 0, PATH_N - 2);
  const u = clamp(s / 2.4 - i, 0, 1);
  return [lerp(PATH[i * 2], PATH[i * 2 + 2], u), lerp(PATH[i * 2 + 1], PATH[i * 2 + 3], u)];
}

/** sets F.cam for shot-01 time t; returns { s, center } */
export function cam01(F, t) {
  const s = scaleAt(t);
  const tip = childTip(t);
  const comp = [CP[0] + 3.4, CP[1] + 3.9];
  const cu = E.inOutCubic(u01(t, 1.5, 2.2));
  let cx = lerp(tip[0], comp[0], cu), cy = lerp(tip[1], comp[1], cu);
  if (t < 2.9) {
    const h = FOCAL / s;
    F.cam.set([cx, h, -cy], [cx, 0, -cy - h * 0.0005], FOV);
    return { s, cx, cy };
  }
  // tilt and travel: the camera comes down onto the path and lines up with it
  const u = u01(t, 2.9, 4.25);
  const e = E.inOutSine(u);
  const h0 = FOCAL / scaleAt(2.9);
  const sC = lerp(-14, 70, E.inQuad(u));
  const sL = sC + lerp(0.5, 46, E.inOutSine(clamp(u * 1.4)));
  const pc = pathAt(sC), pa = pathAt(sC + 1.5), pb = pathAt(sC - 1.5);
  const tl = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) || 1;
  const pl = [pc[0] + ((pa[0] - pb[0]) / tl) * (sL - sC), pc[1] + ((pa[1] - pb[1]) / tl) * (sL - sC)];
  const h = Math.exp(lerp(Math.log(h0), Math.log(0.55), Math.pow(e, 1.15)));
  const px = lerp(cx, pc[0], E.inOutCubic(clamp(u * 1.3))), py = lerp(cy, pc[1], E.inOutCubic(clamp(u * 1.3)));
  const look = E.inOutCubic(clamp(u * 1.25));
  const qx = lerp(px, pl[0], look), qy = lerp(py + h * 0.0005, pl[1], look);
  F.cam.set([px, h, -py], [qx, 0, -qy], FOV);
  return { s, cx: qx, cy: qy };
}

// ---- particles ------------------------------------------------------------------------------------
const ORB = 6500, DUSTN = 1400;
let orb, dive;
function initParticles() {
  const r = mulberry32(101);
  orb = { r: new Float32Array(ORB), th: new Float32Array(ORB), inc: new Float32Array(ORB), w: new Float32Array(ORB), e: new Float32Array(ORB), P: new Float32Array(ORB * 3), rot: new Float32Array(ORB) };
  for (let i = 0; i < ORB; i++) {
    orb.r[i] = lerp(0.1, 2.6, Math.pow(r(), 0.8));
    orb.th[i] = r() * 6.283;
    orb.inc[i] = (r() - 0.5) * 2.2;
    orb.rot[i] = r() * 6.283;
    orb.w[i] = (2.6 / Math.sqrt(orb.r[i])) * (r() < 0.5 ? 1 : 0.8);
    orb.e[i] = (0.1 + r() * r() * 0.9) * (0.6 + orb.r[i] * 0.35);
  }
  dive = { P: new Float32Array(DUSTN * 3), e: new Float32Array(DUSTN) };
  for (let i = 0; i < DUSTN; i++) {
    const h = Math.exp(lerp(Math.log(2), Math.log(160000), r()));
    const a = r() * 6.283, d = Math.sqrt(r()) * h * 0.55;
    dive.P[i * 3] = Math.cos(a) * d;
    dive.P[i * 3 + 1] = h;
    dive.P[i * 3 + 2] = Math.sin(a) * d;
    dive.e[i] = 0.3 + r() * 0.8;
  }
}

// ---- constellation / topography ---------------------------------------------------------------------
let dots = null;
function makeDots(H) {
  const pts = [];
  for (const k of ['child', 'mother']) {
    const h = H[k];
    const step = k === 'child' ? 0.95 : 1.25;
    for (let s = 0; s < h.L; s += step) {
      let i = 0;
      while (i < h.n - 2 && h.cum[i + 1] < s) i++;
      pts.push(h.P[i * 2], h.P[i * 2 + 1], k === 'child' ? 1 : 0);
    }
  }
  const n = pts.length / 3;
  const r = mulberry32(7);
  const D = { n, P: new Float32Array(pts), e: new Float32Array(n), edges: [] };
  for (let i = 0; i < n; i++) D.e[i] = 0.4 + r() * 0.9;
  // constellation edges: each dot to its nearest neighbour ahead + a few long chords
  for (let i = 0; i < n; i++) {
    let best = -1, bd = 1e9;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const d = Math.hypot(D.P[i * 3] - D.P[j * 3], D.P[i * 3 + 1] - D.P[j * 3 + 1]);
      if (d > 1.6 && d < bd) {
        bd = d;
        best = j;
      }
    }
    if (best >= 0 && bd < 4.5 && r() < 0.7) D.edges.push(i, best);
  }
  return D;
}

const GX0 = -70, GX1 = 70, GY0 = -45, GY1 = 230, GS = 1.6;
const GNX = Math.ceil((GX1 - GX0) / GS) + 1, GNY = Math.ceil((GY1 - GY0) / GS) + 1;
const FIELD = new Float32Array(GNX * GNY);
function topoField(t) {
  const sig = lerp(0.45, 4.2, E.inOutCubic(u01(t, 2.85, 3.55)));
  const terr = E.inOutSine(u01(t, 3.0, 3.7));
  FIELD.fill(0);
  const R = Math.ceil((sig * 3) / GS);
  const inv = 1 / (sig * sig);
  const amp = 1.0;
  for (let k = 0; k < dots.n; k++) {
    const x = dots.P[k * 3], y = dots.P[k * 3 + 1];
    const ci = Math.round((x - GX0) / GS), cj = Math.round((y - GY0) / GS);
    for (let j = Math.max(0, cj - R); j <= Math.min(GNY - 1, cj + R); j++) {
      const dy = GY0 + j * GS - y;
      for (let i = Math.max(0, ci - R); i <= Math.min(GNX - 1, ci + R); i++) {
        const dx = GX0 + i * GS - x;
        FIELD[j * GNX + i] += amp * Math.exp(-(dx * dx + dy * dy) * inv);
      }
    }
  }
  if (terr > 0) {
    for (let j = 0; j < GNY; j++)
      for (let i = 0; i < GNX; i++) {
        const x = GX0 + i * GS, y = GY0 + j * GS;
        FIELD[j * GNX + i] += terr * (1.6 + 1.5 * pnoise(x / 26, y / 26, 0.3) + 0.6 * pnoise(x / 9, y / 9, 4.1));
      }
  }
}
/** iso-contour segments of FIELD at level L -> flat array of world xyz pairs (segments) */
function iso(L) {
  const out = [];
  const v = (i, j) => FIELD[j * GNX + i] - L;
  const X = (i) => GX0 + i * GS, Y = (j) => GY0 + j * GS;
  for (let j = 0; j < GNY - 1; j++)
    for (let i = 0; i < GNX - 1; i++) {
      const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
      const code = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const eB = [X(i) + (a / (a - b)) * GS, Y(j)], eR = [X(i + 1), Y(j) + (b / (b - c)) * GS];
      const eT = [X(i) + (d / (d - c)) * GS, Y(j + 1)], eL = [X(i), Y(j) + (a / (a - d)) * GS];
      const seg = (p, q) => out.push(p[0], 0, -p[1], q[0], 0, -q[1]);
      switch (code) {
        case 1: case 14: seg(eL, eB); break;
        case 2: case 13: seg(eB, eR); break;
        case 3: case 12: seg(eL, eR); break;
        case 4: case 11: seg(eR, eT); break;
        case 6: case 9: seg(eB, eT); break;
        case 7: case 8: seg(eL, eT); break;
        case 5: seg(eL, eT); seg(eB, eR); break;
        case 10: seg(eL, eB); seg(eR, eT); break;
      }
    }
  return out;
}

const P4 = [0, 0, 0, 0];
function toScreen(F, x, y) {
  return F.cam.project(x, 0, -y, P4) ? [P4[0], P4[1], P4[3]] : null;
}
function screenLine(F, P, n) {
  const out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    F.cam.project(P[i * 2], 0, -P[i * 2 + 1], P4);
    out[i * 2] = P4[0];
    out[i * 2 + 1] = P4[1];
  }
  return out;
}

export function init() {
  initParticles();
}

export function draw(F, lt, t) {
  const cam = cam01(F, t);
  const OUT = 1 - E.inQuad(u01(t, 4.02, 4.22)); // handed over to the tunnel
  const H = hands(t);
  const tipC = H.child.tip;
  const scr = toScreen(F, tipC[0], tipC[1]);
  const after = t - TOUCH;
  const handsA = 1 - E.inCubic(u01(t, 2.55, 2.95)); // hand lines give way to the constellation

  // ---- the dive: dust rushing past ----------------------------------------------------------------
  if (t > 0.6 && t < 1.75) {
    const dt = 1 / 60;
    const prev = new Float32Array(DUSTN * 2);
    const pos = { ...cam };
    cam01(F, Math.max(0, t - dt));
    for (let i = 0; i < DUSTN; i++) {
      const ok = F.cam.project(dive.P[i * 3] + tipC[0], dive.P[i * 3 + 1], dive.P[i * 3 + 2] - tipC[1], P4);
      prev[i * 2] = ok ? P4[0] : NaN;
      prev[i * 2 + 1] = P4[1];
    }
    cam01(F, t);
    const a = E.inOutSine(u01(t, 0.62, 0.9)) * (1 - E.inQuad(u01(t, 1.45, 1.75)));
    for (let i = 0; i < DUSTN; i++) {
      if (!F.cam.project(dive.P[i * 3] + tipC[0], dive.P[i * 3 + 1], dive.P[i * 3 + 2] - tipC[1], P4)) continue;
      if (Number.isNaN(prev[i * 2])) continue;
      const e = dive.e[i] * a * 9;
      const [r, g, b] = PF.VIOLET_HI;
      const L = Math.hypot(P4[0] - prev[i * 2], P4[1] - prev[i * 2 + 1]);
      if (L > 2200) continue;
      F.S.streak(prev[i * 2], prev[i * 2 + 1], P4[0], P4[1], 0.7, r * e, g * e, b * e);
    }
    void pos;
  }

  // ---- orbiting particles around the fingertip ----------------------------------------------------
  const orbA = E.inOutSine(u01(t, 0.95, 1.4)) * (1 - E.inQuad(u01(t, 2.6, 3.2)));
  if (orbA > 0.003) {
    const fling = after > 0 ? E.outCubic(clamp(after / 0.9)) * 7 : 0;
    for (let i = 0; i < ORB; i++) {
      const th = orb.th[i] + orb.w[i] * t;
      const r = orb.r[i] * (1 + fling * (0.4 + orb.e[i]));
      const ox = r * Math.cos(th), oy = r * Math.sin(th);
      const ci = Math.cos(orb.inc[i]), si = Math.sin(orb.inc[i]);
      const cr = Math.cos(orb.rot[i]), sr = Math.sin(orb.rot[i]);
      // orbit plane: tilt by inc around x, then rotate by rot around the vertical
      const lx = ox, ly = oy * ci, lh = oy * si;
      const x = lx * cr - ly * sr, y = lx * sr + ly * cr;
      orb.P[i * 3] = tipC[0] + x;
      orb.P[i * 3 + 1] = 0.25 + lh * 0.6 + 0.3;
      orb.P[i * 3 + 2] = -(tipC[1] + y);
    }
    cloud(F, orb.P, ORB, { rgb: PF.GREEN_HI, E: orb.e, e: 1.25 * orbA, near: [0.2, 1.0] });
  }

  // ---- the point ------------------------------------------------------------------------------------
  const pointA = E.outCubic(u01(t, EV.pointOn, EV.pointOn + 0.18)) * (1 - E.inQuad(u01(t, 2.7, 3.1)));
  if (scr && pointA > 0.003) {
    const tw = 1 + 0.08 * Math.sin(t * 31) * (t < 1 ? 1 : 0);
    drawHead(F, { x: scr[0], y: scr[1], r: 2.4 * tw, rgb: C.GREEN, core: '236,255,240', g: 30 + 20 * clamp(after < 0 ? 0 : 1 - after * 2), gi: 0.95, a: pointA });
  }

  // ---- hand contours ---------------------------------------------------------------------------------
  if (handsA > 0.003 && t > 1.05) {
    // child: drawn on from the fingertip both ways
    const ch = H.child;
    const d = lerp(0, ch.L, E.inOutCubic(u01(t, 1.12, 2.05)));
    if (d > 0.05) {
      const Sc = screenLine(F, ch.P, ch.n);
      const a0 = Math.max(0, (ch.sTip - d) / ch.L), a1 = Math.min(1, (ch.sTip + d) / ch.L);
      const part = subPath(Sc, ch.n, a0, a1);
      glowLine(F, part, part.length / 2, { w: 2.2, a: handsA, glow: 0.9 });
    }
    // mother: violet, drawn on from her fingertip, then green flows in from the contact
    const mo = H.mother;
    const dm = lerp(0, mo.L, E.inOutCubic(u01(t, 1.62, 2.3)));
    if (dm > 0.05) {
      const Sm = screenLine(F, mo.P, mo.n);
      const a0 = Math.max(0, (mo.sTip - dm) / mo.L), a1 = Math.min(1, (mo.sTip + dm) / mo.L);
      const part = subPath(Sm, mo.n, a0, a1);
      glowLine(F, part, part.length / 2, { w: 1.6, a: handsA * 0.9, rgb: C.VIOLET_HI, hi: '240,232,255', core: 0.6, glow: 0.45 });
      if (after > 0) {
        const g = lerp(0, mo.L, E.outCubic(clamp(after / 0.55)));
        const b0 = Math.max(0, (mo.sTip - g) / mo.L), b1 = Math.min(1, (mo.sTip + g) / mo.L);
        const gp = subPath(Sm, mo.n, b0, b1);
        glowLine(F, gp, gp.length / 2, { w: 2.2, a: handsA, glow: 0.9 });
      }
    }
  }

  // ---- contact: the radial wave -------------------------------------------------------------------
  if (after > -0.02 && after < 1.2) {
    const c = toScreen(F, CP[0], CP[1]);
    if (c) {
      const u = clamp(after / 1.0);
      F.fx.ring = {
        c: [c[0] / F.W, c[1] / F.H],
        r: lerp(0.0, 2.1, E.outCubic(u)),
        w: lerp(0.018, 0.09, u),
        a: 0.07 * Math.pow(1 - u, 1.4),
        glow: 0.16 * Math.pow(1 - u, 2.4),
        rgb: [0.55, 1.0, 0.62],
      };
      // a thin ring of light riding the wave
      const R = lerp(0.0, 2.1, E.outCubic(u)) * F.H;
      const ringA = Math.pow(1 - u, 1.8);
      if (ringA > 0.01) {
        const m = 900;
        const [rr, gg, bb] = PF.GREEN_HI;
        for (let i = 0; i < m; i++) {
          const a = (i / m) * 6.2832;
          const j = 1 + 0.012 * Math.sin(i * 12.9898 + t * 3);
          F.S.pt(c[0] + Math.cos(a) * R * j, c[1] + Math.sin(a) * R * j, rr * 0.5 * ringA, gg * 0.5 * ringA, bb * 0.5 * ringA);
        }
      }
      F.fx.exposure = 1 + 0.28 * Math.exp(-Math.max(0, after) * 9);
      F.fx.ca = 5 * Math.exp(-Math.max(0, after) * 5);
    }
  }

  // ---- constellation ---------------------------------------------------------------------------------
  if (t > 2.42) {
    if (!dots) dots = makeDots(hands(TOUCH + 0.02));
    const ca = E.outCubic(u01(t, 2.45, 2.8)) * (1 - E.inOutSine(u01(t, 3.35, 3.85)));
    if (ca > 0.003) {
      const spread = E.outCubic(u01(t, 2.3, 3.2)) * 0.6;
      const P = new Float32Array(dots.n * 3);
      for (let i = 0; i < dots.n; i++) {
        const x = dots.P[i * 3], y = dots.P[i * 3 + 1];
        P[i * 3] = x * (1 + spread * 0.08) + pnoise(i * 0.37, t * 0.4, 1) * spread;
        P[i * 3 + 1] = 0.1;
        P[i * 3 + 2] = -(y * (1 + spread * 0.08) + pnoise(i * 0.37, t * 0.4, 5) * spread);
      }
      cloud(F, P, dots.n, { rgb: PF.GREEN_HI, E: dots.e, e: 2.6 * ca, size: 1.3 });
      if (ca > 0.05) for (let i = 0; i < dots.n; i += 3) {
        if (!F.cam.project(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], P4)) continue;
        drawHead(F, { x: P4[0], y: P4[1], r: 0, rgb: C.GREEN, g: 16, gi: 0.5 * ca * dots.e[i], a: 1 });
      }
      // links
      const la = ca * (1 - E.inQuad(u01(t, 3.0, 3.4)));
      if (la > 0.003) {
        for (let k = 0; k < dots.edges.length; k += 2) {
          const i = dots.edges[k], j = dots.edges[k + 1];
          const flick = 0.55 + 0.45 * Math.sin(t * 9 + k);
          F.L.poly(new Float32Array([P[i * 3], P[i * 3 + 1], P[i * 3 + 2], P[j * 3], P[j * 3 + 1], P[j * 3 + 2]]), { rgb: C.VIOLET_HI, a: 0.6 * la * flick, w: 1.0, layer: 2 });
        }
      }
    }
  }

  // ---- topography -------------------------------------------------------------------------------------
  if (t > 2.8 && dots) {
    const ta = E.inOutSine(u01(t, 2.85, 3.3)) * OUT;
    topoField(t);
    const levels = [0.45, 0.8, 1.15, 1.5, 1.85, 2.2, 2.6, 3.0, 3.45, 3.9, 4.4];
    levels.forEach((L, li) => {
      const segs = iso(L);
      if (!segs.length) return;
      const runs = new Float32Array(segs);
      // draw as independent segments through the line batcher
      for (let k = 0; k < runs.length; k += 6) {
        F.L.poly(runs.subarray(k, k + 6), { rgb: li % 3 === 0 ? C.VIOLET_HI : C.VIOLET, a: ta * (li % 3 === 0 ? 0.8 : 0.5), w: li % 3 === 0 ? 1.3 : 0.9, fog: [8, 125, 0.0], near: [0.6, 3], layer: li % 3 === 0 ? 2 : 0 });
      }
    });
  }

  // ---- the path ------------------------------------------------------------------------------------------
  if (t > 3.05) {
    const u = E.inOutCubic(u01(t, 3.08, 4.15));
    const end = Math.max(2, Math.floor(u * PATH_N));
    const P3 = new Float32Array(end * 3);
    for (let i = 0; i < end; i++) {
      P3[i * 3] = PATH[i * 2];
      P3[i * 3 + 1] = 0.25;
      P3[i * 3 + 2] = -PATH[i * 2 + 1];
    }
    const runs = project(F, P3, end);
    for (const r of runs) {
      const wv = new Float32Array(r.n), av = new Float32Array(r.n);
      for (let i = 0; i < r.n; i++) {
        wv[i] = clamp(r.K[i] / 22, 0.6, 26);
        av[i] = clamp((r.Z[i] - 0.4) / 3);
      }
      glowLine(F, r.S, r.n, { w: 2.0, wv, av, a: OUT, glow: 1, head: r === runs[runs.length - 1] ? { r: 2.6, g: 34 } : null });
    }
  }

  // ---- typography: THE FIRST TIME -> a line; HELD locks onto the contact --------------------------
  drawType(F, t, scr);
}

function drawType(F, t, scr) {
  const appear = u01(t, 1.42, 1.75);
  const stretch = E.inCubic(u01(t, 1.98, 2.32));
  const gone = u01(t, 2.32, 2.8);
  const contact = toScreen(F, CP[0], CP[1]);
  if (appear > 0 && gone < 1 && scr) {
    const size = 19;
    const str = 'THE FIRST TIME';
    // anchored beside the fingertip, sliding to the contact height as it stretches
    const x = scr[0] + 26, y = lerp(scr[1] - 20, contact ? contact[1] + 6 : scr[1], stretch);
    const fac = 1 + stretch * stretch * 38;
    const wpx = 0.34 * size * str.length * 0.9;
    const cxw = x + wpx / 2;
    textFlat(F, str, x, y, size, {
      fam: 'D500', track: 0.34,
      per: (gi, g) => {
        const ui = clamp(appear * 1.6 - gi * 0.04);
        if (ui <= 0) return null;
        const gx = x + g.cx * size * 1.0;
        return { sx: fac, dx: (gx - cxw) * (fac - 1) * 0.92, a: ui * (1 - E.inQuad(stretch)) * (1 - gone) };
      },
    });
    // the stretched type becomes a horizontal hairline
    if (stretch > 0) {
      const yy = contact ? contact[1] : y;
      const half = lerp(60, 1300, stretch);
      const cx = contact ? contact[0] : x;
      const a = stretch * (1 - E.inQuad(gone));
      F.L.poly2(new Float32Array([cx - half, yy, cx + half, yy]), { rgb: C.LILAC, a: 0.55 * a, w: 1, layer: 2 });
    }
  }
  // HELD: snaps onto the contact point at the touch
  const ha = E.outCubic(u01(t, TOUCH - 0.02, TOUCH + 0.12)) * (1 - E.inCubic(u01(t, 2.9, 3.25)));
  if (ha > 0.003 && contact) {
    const lock = E.outBack(u01(t, TOUCH - 0.02, TOUCH + 0.28), 2.2);
    textFlat(F, 'HELD', contact[0] + 150, contact[1] + 96, 54, {
      fam: 'D300', track: 0.46, align: 'c',
      per: (gi) => ({ dx: (gi - 1.5) * (1 - lock) * 160, a: ha, sx: lerp(2.5, 1, lock) }),
      glow: 0.5,
    });
  }
}
