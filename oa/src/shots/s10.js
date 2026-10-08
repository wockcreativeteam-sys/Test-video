// SHOT 10 — SHE (36.9 – 41.2 s)
// The word SHE, enormous, built in depth; the frame is made of its letters. We travel through the
// H — inside it, her life: hundreds of tiny moving memories (walking, cooking, working, laughing,
// holding a child, waiting, climbing, living), flashes of colour and movement streaming past.
// SHE NEVER / STOPPED SHOWING UP. — SHOWING stretches across the whole screen, then collapses into
// a single green line.
import { clamp, lerp, E, mulberry32, track } from '../engine/util.js';
import { glowLine } from '../engine/green.js';
import { shape, sampleShaped, drawShaped } from '../engine/glyphs.js';
import { cloud } from '../engine/cloud.js';
import { textFlat, u01, scrim, dust } from './common.js';
import { C, F as PF } from '../palette.js';
import { EV } from '../timeline.js';

const P4 = [0, 0, 0, 0];
const SIZE = 3.1; // metres per em
let S = null, word = null, cells = null, O = null, Hc = null;

export function init() {
  S = shape('SHE', 'D600', { track: 0.04 });
  O = [-(S.width * SIZE) / 2, -(S.capH * SIZE) / 2, 0]; // baseline-left so the word is centred
  const h = S.glyphs[1];
  Hc = [O[0] + (h.x + (h.bbox[0] + h.bbox[2]) / 2) * SIZE, O[1] + S.capH * 0.2 * SIZE, 0];
  // particles that pour into the letters
  const m = 12000;
  const q = sampleShaped(S, m, 31, 120);
  const r = mulberry32(1010);
  word = { m, q, d: new Float32Array(m), s: new Float32Array(m * 3), e: new Float32Array(m) };
  for (let i = 0; i < m; i++) {
    word.d[i] = r() * 0.4;
    word.s[i * 3] = (r() - 0.5) * 16;
    word.s[i * 3 + 1] = (r() - 0.5) * 9;
    word.s[i * 3 + 2] = -1 + r() * 8;
    word.e[i] = 0.4 + r() * 0.7;
  }
  // memory cells inside the H
  const n = 190;
  cells = [];
  for (let i = 0; i < n; i++) {
    cells.push({
      x: Hc[0] + (r() - 0.5) * 9, y: Hc[1] + (r() - 0.5) * 5.2, z: 3 + r() * 34,
      kind: i % 8, size: 0.45 + r() * 0.5, on: 38.3 + r() * 1.9, len: 0.35 + r() * 0.9, ph: r() * 6.28,
    });
  }
}

function camAt(F, t) {
  // hold on SHE, then fly through the lower counter of the H and on through her life
  const u = E.inOutCubic(u01(t, 37.7, 38.95));
  const z0 = -6.2 - (1 - E.outCubic(u01(t, 36.9, 37.7))) * 1.5;
  const zc = lerp(z0, 1.5, u) + Math.max(0, t - 38.95) * 9.5;
  const x = lerp(0, Hc[0], E.inOutSine(u01(t, 37.75, 38.7)));
  const y = lerp(0, Hc[1], E.inOutSine(u01(t, 37.75, 38.7)));
  F.cam.set([x, y, zc], [x, y, zc + 10], lerp(52, 64, u));
  F.cam.mirror = true;
}

function drawWord(F, t, a) {
  const R = [1, 0, 0], U = [0, 1, 0];
  // extruded: stacked outline layers going away from us, the front face brightest
  const layers = 12;
  for (let l = layers; l >= 0; l--) {
    const dz = (l / layers) * 1.4;
    const front = l === 0;
    drawShaped(
      F,
      S,
      (ex, ey) => {
        const X = O[0] + ex * SIZE, Y = O[1] - ey * SIZE, Z = dz;
        return F.cam.project(X, Y, Z, P4) ? [P4[0], P4[1]] : null;
      },
      { rgb: front ? C.LILAC : C.VIOLET, a: a * (front ? 0.95 : 0.5 * (1 - l / (layers + 2))), stroke: front ? 2.2 : 1.1, glow: front ? 0.5 : 0 }
    );
  }
}

const icon = {
  // tiny animated memories, in a unit cell (x right, y up), returned as polylines
  0: (t) => { // walking
    const s = Math.sin(t * 7);
    return [[[0, 0.15], [0, 0.55]], [[0, 0.15], [0.18 * s, -0.4]], [[0, 0.15], [-0.18 * s, -0.4]], circle(0, 0.68, 0.11), [[0, 0.48], [0.2 * -s, 0.1]]];
  },
  1: (t) => { // cooking: a pot and steam
    const st = [];
    for (let k = 0; k < 3; k++) {
      const p = [];
      for (let i = 0; i <= 12; i++) {
        const y = 0.05 + i * 0.05;
        p.push([-0.12 + k * 0.12 + 0.05 * Math.sin(y * 14 - t * 6 + k), y]);
      }
      st.push(p);
    }
    return [[[-0.35, 0.0], [-0.3, -0.35], [0.3, -0.35], [0.35, 0.0]], [[-0.42, 0], [0.42, 0]], ...st];
  },
  2: (t) => { // working: a broom sweeping
    const a = Math.sin(t * 5) * 0.35;
    const tip = [Math.sin(a) * 0.7, -0.45 + (1 - Math.cos(a)) * 0.3];
    return [[[0, 0.5], tip], [[tip[0] - 0.15, tip[1] - 0.12], [tip[0] + 0.15, tip[1] - 0.12]], [[tip[0] - 0.12, tip[1]], [tip[0] - 0.15, tip[1] - 0.12]], [[tip[0] + 0.12, tip[1]], [tip[0] + 0.15, tip[1] - 0.12]]];
  },
  3: (t) => { // laughing: a face and pulsing arcs
    const out = [circle(0, 0, 0.2), arc(0, -0.02, 0.1, Math.PI * 0.15, Math.PI * 0.85)];
    for (let k = 0; k < 3; k++) {
      const r = 0.28 + ((t * 0.9 + k / 3) % 1) * 0.35;
      out.push(arc(0, 0, r, -0.6, 0.6), arc(0, 0, r, Math.PI - 0.6, Math.PI + 0.6));
    }
    return out;
  },
  4: (t) => { // holding a child's hand
    const s = Math.sin(t * 6) * 0.08;
    return [[[-0.2, 0.1], [-0.2, 0.55]], [[-0.2, 0.1], [-0.3 + s, -0.45]], [[-0.2, 0.1], [-0.1 - s, -0.45]], circle(-0.2, 0.67, 0.1),
      [[0.25, -0.05], [0.25, 0.2]], [[0.25, -0.05], [0.2 - s, -0.45]], [[0.25, -0.05], [0.3 + s, -0.45]], circle(0.25, 0.29, 0.07), [[-0.2, 0.4], [0.02, 0.05], [0.25, 0.12]]];
  },
  5: (t) => { // waiting: a bench and a clock
    const a = t * 2;
    return [[[-0.45, -0.1], [0.45, -0.1]], [[-0.4, -0.1], [-0.4, -0.4]], [[0.4, -0.1], [0.4, -0.4]], circle(0.1, 0.45, 0.2), [[0.1, 0.45], [0.1 + Math.sin(a) * 0.15, 0.45 + Math.cos(a) * 0.15]], [[-0.15, -0.1], [-0.15, 0.25]], circle(-0.15, 0.36, 0.09)];
  },
  6: (t) => { // climbing
    const k = (t * 2) % 4;
    const st = [[-0.45, -0.45]];
    for (let i = 0; i < 4; i++) st.push([-0.45 + i * 0.22, -0.45 + (i + 1) * 0.2], [-0.23 + i * 0.22, -0.45 + (i + 1) * 0.2]);
    const fx = -0.35 + Math.floor(k) * 0.22, fy = -0.25 + Math.floor(k) * 0.2;
    return [st, [[fx, fy], [fx, fy + 0.35]], circle(fx, fy + 0.45, 0.08)];
  },
  7: (t) => { // living: a flower opening
    const o = 0.5 + 0.5 * Math.sin(t * 2);
    const out = [[[0, -0.5], [0, 0.1]], arc(0.12, -0.2, 0.12, Math.PI, Math.PI * 1.6)];
    for (let k = 0; k < 6; k++) {
      const an = (k / 6) * Math.PI * 2;
      out.push([[0, 0.15], [Math.cos(an) * 0.25 * o, 0.15 + Math.sin(an) * 0.25 * o]]);
    }
    return out;
  },
};
function circle(x, y, r) {
  const p = [];
  for (let i = 0; i <= 20; i++) p.push([x + Math.cos((i / 20) * Math.PI * 2) * r, y + Math.sin((i / 20) * Math.PI * 2) * r]);
  return p;
}
function arc(x, y, r, a0, a1) {
  const p = [];
  for (let i = 0; i <= 12; i++) {
    const a = a0 + ((a1 - a0) * i) / 12;
    p.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return p;
}

function drawCells(F, t, a) {
  for (const c of cells) {
    const u = (t - c.on) / c.len;
    if (u < 0 || u > 1) continue;
    const fl = Math.sin(Math.PI * u) ** 0.6 * (0.75 + 0.25 * Math.sin(t * 23 + c.ph));
    const green = c.kind % 2 === 0;
    const polys = icon[c.kind](t + c.ph);
    for (const poly of polys) {
      const P = new Float32Array(poly.length * 3);
      for (let i = 0; i < poly.length; i++) {
        P[i * 3] = c.x + poly[i][0] * c.size;
        P[i * 3 + 1] = c.y + poly[i][1] * c.size;
        P[i * 3 + 2] = c.z;
      }
      F.L.poly(P, { rgb: green ? C.GREEN : C.VIOLET_HI, a: a * fl, w: 1.4, layer: 2, fog: [2, 30, 0], near: [0.3, 1.2] });
    }
    // a faint frame around each memory
    const f = 0.62 * c.size;
    F.L.poly(new Float32Array([c.x - f, c.y - f, c.z, c.x + f, c.y - f, c.z, c.x + f, c.y + f, c.z, c.x - f, c.y + f, c.z, c.x - f, c.y - f, c.z]), { rgb: C.VIOLET, a: a * fl * 0.35, w: 0.9, fog: [2, 30, 0], near: [0.3, 1.2] });
  }
}

export function draw(F, lt, t) {
  camAt(F, t);
  const out = 1 - E.inOutSine(u01(t, 40.95, 41.2));
  // SHE pours in from particles, then stands as built type
  const pour = u01(t, 36.9, 37.6);
  if (t < 38.6) {
    const P = new Float32Array(word.m * 3), En = new Float32Array(word.m);
    for (let i = 0; i < word.m; i++) {
      const u = E.inOutCubic(clamp((pour - word.d[i]) / 0.6));
      const tx = O[0] + word.q[i * 2] * SIZE, ty = O[1] - word.q[i * 2 + 1] * SIZE, tz = -0.02;
      P[i * 3] = lerp(word.s[i * 3], tx, u);
      P[i * 3 + 1] = lerp(word.s[i * 3 + 1], ty, u);
      P[i * 3 + 2] = lerp(word.s[i * 3 + 2], tz, u);
      En[i] = word.e[i] * (0.4 + 0.6 * u);
    }
    const fade = 1 - E.inQuad(u01(t, 37.9, 38.6));
    cloud(F, P, word.m, { rgb: PF.LILAC, E: En, e: 1.1 * fade, near: [0.2, 1.0] });
  }
  const builtA = E.inOutSine(u01(t, 37.25, 37.7)) * (1 - E.inQuad(u01(t, 38.75, 39.1)));
  if (builtA > 0.003) drawWord(F, t, builtA);
  dust(F, t, { n: 900, e: 0.08, box: 22 });
  // her life inside the H
  const ca = E.inOutSine(u01(t, 38.4, 38.9)) * out * (1 - E.inQuad(u01(t, 40.3, 40.8)));
  if (ca > 0.003) drawCells(F, t, ca);
  drawType(F, t, out);
}

function drawType(F, t, a0) {
  const [s0, s1] = EV.showing; // SHOWING stretch
  const [c0, c1] = EV.collapse;
  if (t < 38.3 || t > 41.2) return;
  const a = E.outCubic(u01(t, 38.3, 38.65)) * a0;
  const y1 = 470, y2 = 570;
  const restA = a * (1 - E.inQuad(u01(t, s0 + 0.1, s0 + 0.45)));
  scrim(F, 330, 380, 1260, 230, 0.4 * restA);
  textFlat(F, 'SHE NEVER', 960, y1, 72, { fam: 'D300', track: 0.14, align: 'c', a: restA, glow: 0.3 });
  // STOPPED [SHOWING] UP. — SHOWING stretches across the whole frame, then becomes a line
  const st = E.inOutCubic(u01(t, s0, s1));
  const col = E.inCubic(u01(t, c0, c0 + 0.3));
  const S1 = shape('STOPPED ', 'D300', { track: 0.14 }), S2 = shape('SHOWING', 'D500', { track: 0.14 }), S3 = shape(' UP.', 'D300', { track: 0.14 });
  const sz = 72;
  const w1 = S1.width * sz, w2 = S2.width * sz, w3 = S3.width * sz;
  const total = w1 + w2 + w3;
  const x0 = 960 - total / 2;
  textFlat(F, 'STOPPED ', x0 - st * 900, y2, sz, { fam: 'D300', track: 0.14, a: restA, glow: 0.3 });
  textFlat(F, ' UP.', x0 + w1 + w2 + st * 900, y2, sz, { fam: 'D300', track: 0.14, a: restA, glow: 0.3 });
  // SHOWING: grows to span the frame (scale about its centre), then flattens into the line
  const cx = x0 + w1 + w2 / 2;
  const target = 1840 / w2;
  const sx = lerp(1, target, st);
  const sy = lerp(1, 0.02, col);
  const ga = a * (1 - E.inQuad(u01(t, c0 + 0.15, c0 + 0.35)));
  if (ga > 0.003) {
    textFlat(F, 'SHOWING', lerp(cx, 960, st) - (w2 * sx) / 2, y2 - (1 - sy) * 26, sz, {
      fam: 'D500', track: 0.14, rgb: col > 0 ? '200,255,214' : C.LILAC, a: ga, glow: 0.5,
      per: (gi, g) => ({ sx: sx, sy: sy, dx: (g.cx * sz) * (sx - 1) }),
    });
  }
  // the line it becomes
  if (t > c0) {
    const la = E.outCubic(u01(t, c0 + 0.05, c0 + 0.3)) * a0;
    const half = lerp(920, 920, col);
    glowLine(F, new Float32Array([960 - half, y2 - 26, 960 + half, y2 - 26]), 2, { w: 2.6, a: la, glow: 1.2 });
  }
}
