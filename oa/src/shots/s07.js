// SHOT 07 — RESISTANCE (24.4 – 29.5 s)
// Inside the joint, as architecture: two vast smooth surfaces — condyles above, plateau below —
// drawn as contour-line sculpture, moving against each other with the rhythm of a step. Every
// approach gathers red energy at the contact. The green line tries to pass through the gap; it
// is scraped, sheds particles and breaks into fragments. NOT BECAUSE / SHE WANTED TO STOP.
// moves forward and hits an invisible wall. Then EVERY STEP / BEGAN TO HURT. — HURT once, in red.
import { clamp, lerp, E, mulberry32, track } from '../engine/util.js';
import { cloud } from '../engine/cloud.js';
import { pnoise } from '../engine/noise.js';
import { glow3, textFlat, u01, dust, scrim } from './common.js';
import { C, F as PF } from '../palette.js';
import { EV } from '../timeline.js';

const COL = EV.collisions; // approaches
const P4 = [0, 0, 0, 0];

/** gap closure 0 (open) .. 1 (bone on bone) */
function closure(t) {
  let c = 0.18 + 0.12 * Math.sin(t * 4.2);
  for (const tc of COL) {
    const d = t - tc;
    c = Math.max(c, Math.exp(-(d * d) / 0.012) * (0.7 + 0.3 * clamp((tc - COL[0]) / 3.5)));
  }
  return clamp(c);
}
const GAP0 = 1.3;
function surfaces(t) {
  const c = closure(t);
  const gap = lerp(GAP0, 0.08, c);
  const slide = Math.sin(t * 2.1) * 0.35 + c * 0.25; // the surfaces glide against each other
  return { gap, c, slide };
}
// upper: two condyles (lowest at x = ±1.5) with the notch between; lower: two shallow facets + spines
function yTop(x, z, S) {
  const xs = x + S.slide;
  const lob = Math.min((xs - 1.55) ** 2, (xs + 1.55) ** 2);
  const notch = 0.55 * Math.exp(-(xs * xs) / 0.35);
  const curve = 0.018 * (z - 6) ** 2 * 0.12;
  return S.gap / 2 + 0.32 * lob + notch + curve + 0.05 * pnoise(xs * 0.9, z * 0.4, 1.3);
}
function yBot(x, z, S) {
  const xs = x - S.slide * 0.4;
  const facet = -0.1 * Math.exp(-((xs - 1.55) ** 2) / 1.2) - 0.1 * Math.exp(-((xs + 1.55) ** 2) / 1.2);
  const spine = 0.32 * Math.exp(-(xs * xs) / 0.06);
  const rim = 0.06 * xs * xs;
  return -S.gap / 2 + facet + spine - rim - 0.012 * (z - 6) ** 2 * 0.1 + 0.04 * pnoise(xs * 1.1, z * 0.5, 7.1);
}

let shed = null;
export function init() {
  const r = mulberry32(707);
  const n = 2600;
  shed = { n, s: new Float32Array(n), v: new Float32Array(n * 3), t0: new Float32Array(n), e: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    shed.s[i] = r() * 22;
    shed.v[i * 3] = (r() - 0.5) * 1.6;
    shed.v[i * 3 + 1] = (r() - 0.5) * 1.6;
    shed.v[i * 3 + 2] = -r() * 0.8;
    shed.t0[i] = COL[Math.floor(r() * COL.length)] + (r() - 0.5) * 0.15;
    shed.e[i] = 0.3 + r() * 0.8;
  }
}

function camAt(F, t) {
  const z = lerp(-3.2, 0.6, E.inOutSine(u01(t, 24.4, 29.4)));
  const sway = Math.sin(t * 0.9) * 0.15;
  const inP = E.outCubic(u01(t, 24.4, 25.2));
  const s = surfaces(t);
  const shake = s.c > 0.6 ? (s.c - 0.6) * 0.04 * Math.sin(t * 90) : 0;
  F.cam.set([sway + shake - 0.5, 0.1 + shake, z - (1 - inP) * 4], [sway * 0.3 - 0.6, -0.12, z + 10], lerp(30, 62, inP), Math.sin(t * 0.5) * 0.04);
}

/** the green line's centreline through the gap */
const LX = -0.95;
function lineY(z, S) {
  return (yTop(LX, z, S) + yBot(LX, z, S)) / 2 - 0.04 + 0.04 * Math.sin(z * 0.8);
}

export function draw(F, lt, t) {
  camAt(F, t);
  const S = surfaces(t);
  const fadeIn = E.inOutSine(u01(t, 24.45, 25.0));
  const out = 1 - E.inOutSine(u01(t, 29.15, 29.5));
  const A = fadeIn * out;
  // ---- the two surfaces as contour sculpture -----------------------------------------------------
  const nx = 90;
  for (let zi = 0; zi < 46; zi++) {
    const z = -2 + zi * 0.5;
    for (const which of [0, 1]) {
      const P = new Float32Array(nx * 3);
      for (let i = 0; i < nx; i++) {
        const x = -5 + (i / (nx - 1)) * 10;
        P[i * 3] = x;
        P[i * 3 + 1] = which ? yBot(x, z, S) : yTop(x, z, S);
        P[i * 3 + 2] = z;
      }
      const hero = zi % 4 === 0;
      F.L.poly(P, { rgb: hero ? C.VIOLET_HI : C.VIOLET, a: A * (hero ? 0.7 : 0.4), w: hero ? 1.2 : 0.8, fog: [2, 22, 0.0], near: [0.4, 1.5], layer: hero ? 2 : 0 });
    }
  }
  // longitudinal lines
  for (let xi = 0; xi < 13; xi++) {
    const x = -4.5 + xi * 0.75;
    for (const which of [0, 1]) {
      const P = new Float32Array(48 * 3);
      for (let i = 0; i < 48; i++) {
        const z = -2 + i * 0.5;
        P[i * 3] = x;
        P[i * 3 + 1] = which ? yBot(x, z, S) : yTop(x, z, S);
        P[i * 3 + 2] = z;
      }
      F.L.poly(P, { rgb: C.VIOLET, a: A * 0.28, w: 0.8, fog: [2, 22, 0.0], near: [0.4, 1.5] });
    }
  }
  dust(F, t, { n: 700, e: 0.06, box: 10 });
  // ---- red energy at the contact zones -----------------------------------------------------------
  if (S.c > 0.3) {
    const r = mulberry32(Math.floor(t * 30));
    const k = (S.c - 0.3) / 0.7;
    for (const xc of [-1.55, 1.55]) {
      const P = new Float32Array(60 * 3);
      for (let i = 0; i < 60; i++) {
        const z = 3.2 + i * 0.11;
        P[i * 3] = xc - S.slide * 0.7;
        P[i * 3 + 1] = (yTop(xc - S.slide, z, S) + yBot(xc - S.slide, z, S)) / 2;
        P[i * 3 + 2] = z;
      }
      const av = new Float32Array(60);
      for (let i = 0; i < 60; i++) av[i] = Math.sin((i / 59) * Math.PI) * (0.55 + 0.45 * Math.sin(i * 1.7 + t * 37));
      glow3(F, P, 60, { w: 2 + 3 * k, av, a: A * k, rgb: C.RED, hi: C.RED_HI, glow: 1.2, fog: [2, 20, 0], core: 0.6 });
    }
    // sparks
    const n = Math.round(520 * k);
    const Pp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const xc = (r() < 0.5 ? -1.55 : 1.55) - S.slide * 0.7;
      const z = 3 + r() * 7;
      Pp[i * 3] = xc + (r() - 0.5) * 0.9;
      Pp[i * 3 + 1] = (r() - 0.5) * 0.6;
      Pp[i * 3 + 2] = z;
    }
    cloud(F, Pp, n, { rgb: PF.RED, e: 1.1 * A, size: 0.8, fog: [2, 16, 0] });
  }
  // ---- the green line: squeezed, scraped, fragmented ----------------------------------------------
  const frag = clamp((t - COL[0] + 0.2) / (COL[COL.length - 1] - COL[0] + 0.4));
  const n = 220;
  const P = new Float32Array(n * 3);
  const av = new Float32Array(n);
  const wv = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const z = -1.6 + i * 0.1;
    const squeeze = S.c * Math.exp(-((z - 6) ** 2) / 30);
    P[i * 3] = LX + 0.08 * Math.sin(z * 1.3 + t * 2);
    P[i * 3 + 1] = lineY(z, S) + Math.sin(z * 9 + t * 30) * 0.02 * squeeze;
    P[i * 3 + 2] = z;
    // fragmentation: gaps open along the line as damage accumulates
    const hole = pnoise(z * 1.7, 3.3, Math.floor(t * 6) * 0.7) * 0.5 + 0.5;
    av[i] = hole < frag * 0.75 ? 0 : 1;
    wv[i] = 1 - 0.6 * squeeze;
  }
  glow3(F, P, n, { w: 2.6, wv, av, persp: 220, wMin: 0.4, wMax: 3, a: A, glow: 1.1, fog: [2, 20, 0.1] });
  // scraped particles peel off the line after each collision and drift
  const Ps = new Float32Array(shed.n * 3);
  const Es = new Float32Array(shed.n);
  let m = 0;
  for (let i = 0; i < shed.n; i++) {
    const age = t - shed.t0[i];
    if (age < 0 || age > 2.2) continue;
    const z = shed.s[i];
    Ps[m * 3] = LX + shed.v[i * 3] * age;
    Ps[m * 3 + 1] = lineY(z, S) + shed.v[i * 3 + 1] * age - 0.15 * age * age;
    Ps[m * 3 + 2] = z + shed.v[i * 3 + 2] * age;
    Es[m] = shed.e[i] * Math.exp(-age * 1.6);
    m++;
  }
  cloud(F, Ps, m, { rgb: PF.GREEN, E: Es, e: 2.2 * A, size: 0.7, fog: [2, 18, 0] });
  // ---- type ---------------------------------------------------------------------------------------
  drawType(F, t, out);
}

function drawType(F, t, a0) {
  // NOT BECAUSE / SHE WANTED TO STOP. — glides forward, then hits an invisible wall at textStop
  const stopT = EV.textStop;
  if (t > 24.95 && t < 29.4) scrim(F, 150, 330, 1000, 240, 0.62 * a0 * E.outCubic(u01(t, 24.95, 25.3)) * (1 - E.inQuad(u01(t, 29.1, 29.4))));
  if (t > 24.95 && t < 27.15) {
    const a = E.outCubic(u01(t, 24.95, 25.3)) * a0 * (1 - E.inQuad(u01(t, 26.85, 27.15)));
    const lines = [['NOT BECAUSE', 430], ['SHE WANTED TO STOP.', 526]];
    lines.forEach(([str, y], li) => {
      const L = str.length;
      textFlat(F, str, 210, y, 70, {
        fam: 'D400', track: 0.08, a, glow: 0.3,
        per: (gi) => {
          // each letter travels right at a steady pace; the front letters stop first and the
          // rest pile in behind them (compression), with a small recoil
          const lag = (L - gi) * 0.022 + li * 0.05;
          const tt = t - lag;
          const free = (tt - 24.95) * 170;
          const stopAt = (stopT - 24.95) * 170;
          let dx = Math.min(free, stopAt);
          let sx = 1;
          if (tt > stopT) {
            const u = tt - stopT;
            dx = stopAt - Math.sin(Math.min(u, 0.2) * 15.7) * 8 * Math.exp(-u * 8) - (L - gi) * 2.2 * E.outCubic(clamp(u / 0.15));
            sx = 1 - 0.16 * Math.exp(-u * 6);
          }
          return { dx, sx, a: 1 };
        },
      });
    });
  }
  // EVERY STEP / BEGAN TO HURT. — HURT once, in red, grinding into place
  if (t > 27.25 && t < 29.4) {
    const a = E.outCubic(u01(t, 27.25, 27.6)) * a0 * (1 - E.inQuad(u01(t, 29.1, 29.4)));
    textFlat(F, 'EVERY STEP', 210, 430, 70, { fam: 'D400', track: 0.08, a, glow: 0.3 });
    const b = E.outCubic(u01(t, 27.75, 28.1)) * a0 * (1 - E.inQuad(u01(t, 29.1, 29.4)));
    const res = textFlat(F, 'BEGAN TO ', 210, 526, 70, { fam: 'D400', track: 0.08, a: b, glow: 0.3 });
    const h = EV.hurt;
    if (t > h - 0.02) {
      const u = t - h;
      const jit = u < 0.25 ? Math.sin(u * 160) * 3 * (1 - u / 0.25) : 0;
      const ha = E.outCubic(clamp(u / 0.06)) * a0 * (1 - E.inQuad(u01(t, 29.1, 29.4)));
      textFlat(F, 'HURT.', res.x0 + res.w + 6 + jit, 526, 70, { fam: 'D600', track: 0.08, a: ha, rgb: C.RED, glow: 0.7 });
    }
  }
}
