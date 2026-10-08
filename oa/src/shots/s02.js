// SHOT 02 — THE WALK (3.7 – 7.6 s)
// We fall into the line: it becomes a tunnel of green strands. Memory fragments flash past for a
// few frames each (school shoe, staircase, schoolbag, bicycle, a child's hand, a mother's hand,
// a footprint), faster and faster. SHE TAUGHT YOU floats in the tunnel; HOW TO WALK. walks toward
// us — HOW and WALK are the feet, TO is the body. Then the tunnel's light pours into a pair of
// legs made of particles, and they walk.
import { clamp, lerp, E, mulberry32, track } from '../engine/util.js';
import { glowLine } from '../engine/green.js';
import { cloud } from '../engine/cloud.js';
import { curl2 } from '../engine/noise.js';
import { buildFragment } from '../lib/worlds.js';
import { handShape } from '../lib/hand.js';
import { walkerBody, walkerEnergy, walkerJoints, lifeCam, walkerParticles, lifeGait, T0 } from '../lib/walker.js';
import { glow3, text3D, u01 } from './common.js';
import { C, F as PF } from '../palette.js';
import { EV } from '../timeline.js';

const R = 1.05; // tunnel radius (m)
const NSTR = 52;
const P4 = [0, 0, 0, 0];

function centre(s, out = [0, 0, 0]) {
  out[0] = 1.4 * Math.sin(s / 11) + 0.4 * Math.sin(s / 4.1);
  out[1] = 0.9 * Math.sin(s / 17 + 1.0);
  out[2] = s;
  return out;
}
function frame(s) {
  const a = centre(s - 0.3), b = centre(s + 0.3);
  let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
  const l = Math.hypot(tx, ty, tz);
  tx /= l; ty /= l; tz /= l;
  // n = normalised (up x t), b = t x n
  let nx = 1 * tz - 0 * ty, ny = 0 * tx - 0 * tz, nz = 0 * ty - 1 * tx; // up = (0,1,0): up x t = (tz, 0, -tx)
  nx = tz; ny = 0; nz = -tx;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl; ny /= nl; nz /= nl;
  const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
  return { c: centre(s), t: [tx, ty, tz], n: [nx, ny, nz], b: [bx, by, bz] };
}
function wallPoint(s, th, r, out) {
  const f = frame(s);
  const c = Math.cos(th), sn = Math.sin(th);
  out[0] = f.c[0] + (f.n[0] * c + f.b[0] * sn) * r;
  out[1] = f.c[1] + (f.n[1] * c + f.b[1] * sn) * r;
  out[2] = f.c[2] + (f.n[2] * c + f.b[2] * sn) * r;
  return out;
}

// camera progress along the tunnel (m): accelerating, then braking as the tunnel turns to legs
const SK = [
  [3.95, -2.0],
  [4.3, 0.0, E.lin],
  [5.0, 5.5, E.inQuad],
  [5.6, 15.0, E.lin],
  [6.12, 31.0, E.inQuad],
  [6.7, 39.5, E.outCubic],
  [7.6, 40.5, E.outQuad],
];
const sCam = (t) => track(SK, t);
function camAt(F, t) {
  const s = sCam(t);
  const f = frame(s);
  const ahead = centre(s + 7);
  const roll = Math.sin(t * 1.3) * 0.06 + (t - 4) * 0.05;
  F.cam.set([f.c[0], f.c[1], f.c[2]], ahead, 70, roll);
  return s;
}

// ---- particles on the wall ------------------------------------------------------------------------
const NW = 7000;
let wall, frags, morph;
const FRAG_ORDER = ['shoe', 'staircase', 'schoolbag', 'bicycle', 'childHand', 'motherHand', 'footprint'];

function footprintIcon() {
  // a small sole + five toes, as a single-weight icon in [-0.5, 0.5]^2
  const out = [];
  const sole = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const y = Math.sin(a) * 0.33 - 0.05;
    const w = 0.13 + 0.05 * Math.max(0, Math.sin(a)) - 0.04 * Math.exp(-((y + 0.05) ** 2) / 0.01);
    sole.push(Math.cos(a) * w + 0.02 * Math.sin(a), y);
  }
  out.push(new Float32Array(sole));
  const toes = [[-0.11, 0.33, 0.055], [-0.03, 0.37, 0.045], [0.04, 0.36, 0.04], [0.1, 0.33, 0.035], [0.15, 0.28, 0.03]];
  for (const [x, y, r] of toes) {
    const c = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      c.push(x + Math.cos(a) * r, y + Math.sin(a) * r * 1.15);
    }
    out.push(new Float32Array(c));
  }
  return out;
}
function handIcon(kind, pose) {
  const T = handShape(kind, pose, { cut: -3 });
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < T.n; i++) {
    x0 = Math.min(x0, T.P[i * 2]); x1 = Math.max(x1, T.P[i * 2]);
    y0 = Math.min(y0, T.P[i * 2 + 1]); y1 = Math.max(y1, T.P[i * 2 + 1]);
  }
  const k = 1 / Math.max(x1 - x0, y1 - y0);
  const P = new Float32Array(T.n * 2);
  for (let i = 0; i < T.n; i++) {
    P[i * 2] = (T.P[i * 2] - (x0 + x1) / 2) * k;
    P[i * 2 + 1] = (T.P[i * 2 + 1] - (y0 + y1) / 2) * k;
  }
  return [P];
}

export function init() {
  const r = mulberry32(202);
  wall = { s: new Float32Array(NW), th: new Float32Array(NW), r: new Float32Array(NW), e: new Float32Array(NW) };
  for (let i = 0; i < NW; i++) {
    wall.s[i] = -3 + r() * 52;
    wall.th[i] = r() * Math.PI * 2;
    wall.r[i] = R * (0.86 + 0.14 * Math.sqrt(r()));
    wall.e[i] = 0.25 + r() * r() * 1.2;
  }
  frags = {};
  for (const f of FRAG_ORDER) {
    if (f === 'childHand') frags[f] = handIcon('child', 'open');
    else if (f === 'motherHand') frags[f] = handIcon('mother', 'reach');
    else if (f === 'footprint') frags[f] = footprintIcon();
    else {
      try {
        frags[f] = buildFragment(f);
      } catch (e) {
        frags[f] = footprintIcon();
      }
    }
  }
  // morph: tunnel particles -> the walker's leg particles
  const b = walkerBody();
  const legs = [];
  for (let i = 0; i < b.n; i++) if (b.zone[i] === 0) legs.push(i);
  const M = Math.min(NW, legs.length);
  morph = { M, legIdx: new Uint32Array(M), delay: new Float32Array(M), gain: legs.length / M };
  for (let i = 0; i < M; i++) {
    morph.legIdx[i] = legs[Math.floor((i / M) * legs.length)];
    morph.delay[i] = r() * 0.35;
  }
}

function drawTunnel(F, t, s, a) {
  // strands: helical, some brighter
  const twist = 0.05;
  const span = 46, step = 0.6;
  const m = Math.ceil(span / step);
  const P = new Float32Array(m * 3);
  const q = [0, 0, 0];
  for (let k = 0; k < NSTR; k++) {
    const th0 = (k / NSTR) * Math.PI * 2;
    for (let i = 0; i < m; i++) {
      const ss = s - 0.6 + i * step;
      wallPoint(ss, th0 + ss * twist + Math.sin(ss * 0.21 + k) * 0.05, R, q);
      P[i * 3] = q[0]; P[i * 3 + 1] = q[1]; P[i * 3 + 2] = q[2];
    }
    const hero = k % 7 === 0;
    const bright = hero ? 1 : 0.28 + 0.22 * (0.5 + 0.5 * Math.sin(k * 2.3 + t * 2));
    glow3(F, P, m, { w: hero ? 1.6 : 1.0, persp: 260, wMin: 0.25, wMax: 5, a: a * bright, fog: [4, 36, 0], glow: (hero ? 0.8 : 0.35) * bright, core: hero ? 0.8 : 0.2 });
  }
  // rings
  const ringN = 56;
  const RP = new Float32Array((ringN + 1) * 3);
  for (let j = 0; j < 16; j++) {
    const ss = Math.ceil(s / 3) * 3 + j * 3;
    for (let i = 0; i <= ringN; i++) {
      wallPoint(ss, (i / ringN) * Math.PI * 2, R * 1.002, q);
      RP[i * 3] = q[0]; RP[i * 3 + 1] = q[1]; RP[i * 3 + 2] = q[2];
    }
    F.L.poly(RP, { rgb: C.GREEN, a: a * 0.3, w: 1.0, fog: [3, 34, 0], near: [0.6, 2.5], layer: 2 });
  }
}

function drawWallParticles(F, t, a, dt) {
  const q = [0, 0, 0];
  const n = NW;
  const sx0 = new Float32Array(n), sy0 = new Float32Array(n);
  camAt(F, t - dt);
  for (let i = 0; i < n; i++) {
    wallPoint(wall.s[i], wall.th[i] + wall.s[i] * 0.05, wall.r[i], q);
    if (F.cam.project(q[0], q[1], q[2], P4)) {
      sx0[i] = P4[0];
      sy0[i] = P4[1];
    } else sx0[i] = NaN;
  }
  camAt(F, t);
  const [r, g, b] = PF.GREEN;
  for (let i = 0; i < n; i++) {
    wallPoint(wall.s[i], wall.th[i] + wall.s[i] * 0.05, wall.r[i], q);
    if (!F.cam.project(q[0], q[1], q[2], P4) || Number.isNaN(sx0[i])) continue;
    const z = P4[2];
    if (z < 0.3 || z > 40) continue;
    const e = wall.e[i] * a * clamp((40 - z) / 30) * clamp((z - 0.3) / 1.5) * 2.2;
    const L = Math.hypot(P4[0] - sx0[i], P4[1] - sy0[i]);
    if (L > 900) continue;
    F.S.streak(sx0[i], sy0[i], P4[0], P4[1], 0.6, r * e, g * e, b * e);
  }
}

function drawFragment(F, name, t, tf, s) {
  const life = 0.135;
  if (t < tf || t > tf + life) return;
  const sF = sCam(tf) + 5.2;
  const f = frame(sF);
  const icon = frags[name];
  const size = 1.25;
  const u = (t - tf) / life;
  const a = Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.5;
  const jitter = (name.length % 3) - 1;
  for (const poly of icon) {
    const m = poly.length / 2;
    const P = new Float32Array(m * 3);
    for (let i = 0; i < m; i++) {
      const x = poly[i * 2] * size + jitter * 0.12, y = poly[i * 2 + 1] * size;
      P[i * 3] = f.c[0] + f.n[0] * x + f.b[0] * y;
      P[i * 3 + 1] = f.c[1] + f.n[1] * x + f.b[1] * y;
      P[i * 3 + 2] = f.c[2] + f.n[2] * x + f.b[2] * y;
    }
    glow3(F, P, m, { w: 2.0, a, rgb: C.LILAC, hi: '255,255,255', core: 0.7, glow: 0.8 });
  }
}

export function draw(F, lt, t) {
  const s = camAt(F, t);
  const enter = E.outCubic(u01(t, 3.98, 4.3));
  const toLegs = u01(t, 6.1, 6.75);
  const tunnelA = enter * (1 - E.inOutSine(toLegs));
  // the plunge into the line: a white-green flash and a zoom blur from the vanishing point
  if (t < 4.5) {
    const k = Math.exp(-Math.max(0, t - 4.02) * 7) * (t > 3.92 ? 1 : 0);
    F.fx.exposure = 1 + 0.9 * k;
    F.fx.zoom = 0.35 * k;
    F.fx.zoomC = [0.5, 0.5];
  }
  if (tunnelA > 0.003) {
    drawTunnel(F, t, s, tunnelA);
    drawWallParticles(F, t, tunnelA, 1 / 60);
  }
  // memory fragments
  EV.frags.forEach((tf, i) => drawFragment(F, FRAG_ORDER[i % FRAG_ORDER.length], t, tf, s));
  // ---- SHE TAUGHT YOU (floating ahead, we pass through it) ----------------------------------------
  camAt(F, t);
  const cam = F.cam;
  if (t > 4.22 && t < 5.2) {
    const D = lerp(9, 0.5, E.inQuad(u01(t, 4.22, 5.15)));
    const a = E.outCubic(u01(t, 4.22, 4.45)) * clamp((D - 0.5) / 1.4);
    const words = ['SHE', 'TAUGHT', 'YOU'];
    words.forEach((wd, wi) => {
      const dz = (wi - 1) * 0.7; // each word at its own depth
      const dd = D + dz;
      if (dd < 0.4) return;
      const o = [cam.pos[0] + cam.f[0] * dd, cam.pos[1] + cam.f[1] * dd, cam.pos[2] + cam.f[2] * dd];
      const yoff = (1 - wi) * 0.36;
      const org = [o[0] + cam.u[0] * yoff, o[1] + cam.u[1] * yoff, o[2] + cam.u[2] * yoff];
      text3D(F, wd, org, cam.r, cam.u, 0.34, { fam: 'D300', track: 0.3, align: 'c', a: a * clamp((dd - 0.4) / 1.2), glow: 0.4 });
    });
  }
  // ---- HOW TO WALK. — HOW and WALK step like feet, TO glides like the body ----------------------
  if (t > 5.05 && t < 6.8) {
    const a = E.outCubic(u01(t, 5.05, 5.3)) * (1 - E.inCubic(u01(t, 6.48, 6.8)));
    const steps = EV.wordSteps;
    const stepLen = 0.95;
    const D0 = 5.2;
    const stepOf = (wi) => {
      let d = D0 + (wi === 2 ? 0 : stepLen * 0.5), h = 0, tilt = 0;
      steps.forEach((ts, k) => {
        if ((k % 2 === 0 ? 0 : 2) !== wi) return;
        const u = u01(t, ts - 0.14, ts + 0.1);
        d -= stepLen * E.inOutCubic(u);
        h += Math.sin(Math.PI * u) * 0.34;
        tilt += Math.sin(Math.PI * u) * (u < 0.5 ? -0.35 : 0.25);
      });
      return { d, h, tilt };
    };
    const H = stepOf(0), Wk = stepOf(2);
    const dT = (H.d + Wk.d) / 2 - 0.1;
    const bob = Math.abs(Math.sin(((t - 5.05) * Math.PI) / 0.32)) * 0.05;
    const items = [
      ['HOW', -1.0, H.d, H.h, H.tilt],
      ['TO', 0.02, dT, 0.06 + bob, 0],
      ['WALK.', 1.12, Wk.d, Wk.h, Wk.tilt],
    ];
    for (const [wd, x, d, h, tilt] of items) {
      const o = [cam.pos[0] + cam.f[0] * d, cam.pos[1] + cam.f[1] * d, cam.pos[2] + cam.f[2] * d];
      const yy = h - 0.62;
      const org = [o[0] + cam.r[0] * x + cam.u[0] * yy, o[1] + cam.r[1] * x + cam.u[1] * yy, o[2] + cam.r[2] * x + cam.u[2] * yy];
      // the word pitches like a foot rolling heel-to-toe
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const up = [cam.u[0] * ct - cam.f[0] * st, cam.u[1] * ct - cam.f[1] * st, cam.u[2] * ct - cam.f[2] * st];
      text3D(F, wd, org, cam.r, up, 0.36, { fam: 'D500', track: 0.1, align: 'c', a, glow: 0.45, rgb: wd === 'TO' ? C.LILAC : '232,255,238' });
    }
  }
  // ---- the tunnel's light pours into a pair of legs -----------------------------------------------
  if (t > 6.05) drawMorph(F, t);
}

function drawMorph(F, t) {
  const M = morph.M;
  // sources: wall particles in the tunnel camera
  camAt(F, t);
  const q = [0, 0, 0];
  const sx = new Float32Array(M), sy = new Float32Array(M), se = new Float32Array(M);
  for (let i = 0; i < M; i++) {
    wallPoint(wall.s[i], wall.th[i] + wall.s[i] * 0.05, wall.r[i], q);
    if (F.cam.project(q[0], q[1], q[2], P4) && P4[2] > 0.3) {
      sx[i] = P4[0];
      sy[i] = P4[1];
      se[i] = wall.e[i] * clamp((40 - P4[2]) / 30);
    } else {
      sx[i] = F.W / 2;
      sy[i] = F.H / 2;
      se[i] = 0;
    }
  }
  // targets: the walker's leg particles in the shot-03 camera
  const gp = lifeGait();
  const J = walkerJoints(t - T0, gp);
  lifeCam(F, J, t);
  const b = walkerParticles(F, J, t);
  const En = walkerEnergy();
  const fadeOut = 1 - E.inOutSine(u01(t, 7.2, 7.5));
  const [r, g, bl] = PF.GREEN;
  const v = [0, 0];
  for (let i = 0; i < M; i++) {
    const k = morph.legIdx[i];
    const m = E.inOutCubic(u01(t, 6.12 + morph.delay[i], 6.95 + morph.delay[i]));
    if (m <= 0) continue;
    let tx = 0, ty = 0, te = 0;
    if (F.cam.project(b.P[k * 3], b.P[k * 3 + 1], b.P[k * 3 + 2], P4)) {
      tx = P4[0];
      ty = P4[1];
      te = En[k] * 0.5 * morph.gain;
    }
    const sw = Math.sin(Math.PI * m);
    curl2(sx[i] * 0.004, sy[i] * 0.004, t * 0.8, v);
    const x = lerp(sx[i], tx, m) + v[0] * 90 * sw;
    const y = lerp(sy[i], ty, m) + v[1] * 90 * sw;
    const e = lerp(se[i] * 0.9, te, m) * fadeOut;
    if (e <= 0.003) continue;
    F.S.pt(x, y, r * e, g * e, bl * e);
  }
}
