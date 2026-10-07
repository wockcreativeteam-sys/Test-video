// 01:08–01:24.5  THE PLATFORM — one cell → patient → operating room → hospital → network.
// A single log-scale pull-out. World units: 1 = 10 cm. Floor at y = FLOOR.
import { C } from '../palette.js';
import { E, clamp, env, lerp, seg, v3, TAU } from '../engine/util.js';
import { orbit } from '../engine/cam.js';
import { label, ring } from '../engine/annot.js';
import { text } from '../engine/type.js';
import { glowDot, Lines } from '../engine/lines.js';
import { chapterTag } from './common.js';
import { neuroCam, STN_W } from './s06_neuro.js';
import { drawBody, lifeHead } from './s01_signal.js';
import { pulse } from '../timeline.js';

const FLOOR = -0.92;
export const PATIENT = [0, 0.3, -9.0];
let HOSP = null, NET = null;

// ---------------------------------------------------------------------------
// camera: log distance pull-out with continuous target/orientation handoff
export function platformCam(t) {
  if (t < 68.6) return neuroCam(t);
  const n = neuroCam(68.6);
  const uA = seg(t, 68.6, 70.4, E.inOutSine);
  const uB = seg(t, 70.2, 73.4, E.inOutSine);
  const uC = seg(t, 73.2, 79.4, E.inOutSine);
  const uD = seg(t, 79.2, 83.6, E.inOutCubic);
  const ldA = lerp(Math.log(0.11), Math.log(16), uA);
  let ld = lerp(ldA, Math.log(78), uB);
  ld = lerp(ld, Math.log(300), uC);
  ld = lerp(ld, Math.log(1.05e6), uD);
  // the target holds on the cell until the whole brain is in view, then moves to the body
  let tgt = v3.lerp(STN_W, PATIENT, seg(t, 69.55, 70.9, E.inOutCubic));
  tgt = v3.lerp(tgt, [0, FLOOR, -6], uB);
  tgt = v3.lerp(tgt, [34, FLOOR, 2], uC);
  // the target only leaves the hospital once it has become a point
  const far = clamp((ld - Math.log(26000)) / (Math.log(1.05e6) - Math.log(26000)));
  tgt = v3.lerp(tgt, [96000, FLOOR, -70000], E.inOutSine(far));
  let yaw = lerp(128, 90, uA) + 18 * uB + 22 * uC + 10 * uD;
  let pitch = lerp(20, 80, uA);
  pitch = lerp(pitch, 56, uC);
  pitch = lerp(pitch, 74, uD);
  const roll = lerp(n.roll || 0, 0, E.inOutSine(uA));
  const col = seg(t, 83.65, 84.42, E.inQuart);
  tgt = v3.lerp(tgt, [0, FLOOR, 0], col);
  const shift = [0, lerp(0, 150, seg(t, 80.0, 81.6, E.inOutSine)) * (1 - col)];
  return { pos: orbit(tgt, yaw, pitch, Math.exp(ld)), tgt, fov: lerp(40, 42, uA), roll };
}

// ---------------------------------------------------------------------------
// geometry helpers on the floor plane
const F3 = (x, z, y = FLOOR) => [x, y, z];
function rectP(x0, z0, x1, z1, y = FLOOR) {
  return new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1, x0, y, z0]);
}
function circP(cx, cz, r, n = 48, y = FLOOR) {
  const P = new Float32Array((n + 1) * 3);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    P.set([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r], i * 3);
  }
  return P;
}
function pathP(pts, y = FLOOR) {
  const P = new Float32Array(pts.length * 3);
  pts.forEach((p, i) => P.set([p[0], y, p[1]], i * 3));
  return P;
}

// ---------------------------------------------------------------------------
// the hospital: rooms, devices, staff, machines (photographs standing in their rooms)
function buildHospital() {
  const rooms = [
    // name, x0, z0, x1, z1, sub-label
    ['OT 01 · NEURO', -35, -45, 35, 20, 'CREA INTEGRATED'],
    ['ROBOTIC OT', 40, -45, 110, 20, 'MAKO · DA VINCI'],
    ['OT 03', -110, -45, -40, 20, ''],
    ['CSSD', 115, -45, 165, 20, 'STERRAD 100NX'],
    ['MRI', -110, 50, -40, 115, 'INGENIA 3.0T'],
    ['CT', -35, 50, 35, 115, '128-SLICE · DUAL-ENERGY'],
    ['LIVER TRANSPLANT ICU', 40, 50, 110, 115, 'DEDICATED UNIT'],
    ['NICU', 115, 50, 185, 115, 'NEONATAL CRITICAL CARE'],
    ['DIGITAL CORE', -35, -120, 35, -55, 'SANHAR PAPERLESS HIS'],
    ['LABORATORY', 40, -120, 110, -55, ''],
    ['WARDS', -110, -120, -40, -55, ''],
  ];
  const core = [0, -88];
  const corridorZ = 35, corridorZ2 = -50;
  // data traces from each room to the digital core, routed along corridors
  const traces = rooms
    .filter((r) => r[0] !== 'DIGITAL CORE')
    .map((r, i) => {
      const cx = (r[1] + r[3]) / 2, cz = (r[2] + r[4]) / 2;
      const lane = (i % 4) * 2.2 - 3.3;
      const viaZ = cz > 20 ? corridorZ + lane : corridorZ2 + lane;
      const pts = [[cx, cz], [cx, viaZ], [core[0] + lane * 2, viaZ], [core[0] + lane * 2, core[1]]];
      return { P: pathP(pts, FLOOR + 0.02), cum: null };
    });
  traces.forEach((tr) => (tr.cum = Lines.cum(tr.P)));
  // the patient's journey: imaging -> theatre -> ICU
  const journey = pathP([[-75, 82], [-75, corridorZ], [-2, corridorZ], [-2, 4], [0, -9], [2, 4], [2, corridorZ], [75, corridorZ], [75, 82]], FLOOR + 0.05);
  // machines: [img, x, z, height (world units), label, sub]
  const machines = [
    ['ingenia', -75, 88, 19, 'PHILIPS INGENIA 3.0T', 'MRI'],
    ['mako_a', 60, -20, 17, 'MAKO', 'ROBOTIC-ARM SURGERY'],
    ['davinci_arms', 88, -8, 16, 'DA VINCI', 'ROBOTIC SURGERY'],
    ['benq', -2, -2, 9, 'BENQ TRIMAX 650 NS', 'OT TABLE'],
    ['olympus', 14, -10, 16, 'OLYMPUS OTV-S700', '4K · 3D'],
    ['crea_display', -16, 6, 7, 'CREA', 'OR INTEGRATION'],
    ['giraffe', 128, 70, 14, 'GE GIRAFFE', 'INCUBATOR'],
    ['lullaby', 146, 96, 16, 'GE LULLABY', 'RADIANT WARMER'],
    ['sle6000', 162, 70, 14, 'SLE 6000', 'HFOV VENTILATION'],
    ['infusomat', 172, 98, 9, 'INFUSOMAT', '0.1 ML/H STEPS'],
  ];
  return { rooms, traces, journey, journeyCum: Lines.cum(journey), machines, core };
}

// OR furniture (top view) around the patient
function orItems() {
  return [
    { P: rectP(-3.0, -19.6, 3.0, 1.6), a: 0.8, k: 'table' },
    { P: rectP(-1.4, -12.5, 1.4, -6.0), a: 0.4, k: 'table' },
    { P: rectP(-11.5, -28.5, -5.0, -22.0), a: 0.7, k: 'a9' },
    { P: circP(10, -23, 2.6), a: 0.7, k: 'zeiss' },
    { P: pathP([[10, -23], [6, -20.5], [1.5, -17.2]], FLOOR + 1.6), a: 0.8, k: 'zeiss' },
    { P: rectP(8.0, -8.5, 13.0, -4.0), a: 0.7, k: 'oly' },
    { P: circP(-7, -2, 1.2), a: 0.6, k: 'crea' },
    { P: pathP([[-7, -2], [-10.5, 3.5]], FLOOR + 1.8), a: 0.6, k: 'crea' },
    { P: pathP([[-7, -2], [-2.5, 6.5]], FLOOR + 1.8), a: 0.6, k: 'crea' },
    { P: rectP(-13.5, 3.0, -7.5, 4.2), a: 0.8, k: 'crea' },
    { P: rectP(-5.5, 6.0, 0.5, 7.2), a: 0.8, k: 'crea' },
    { P: circP(0, -13, 4.2, 64, FLOOR + 2.2), a: 0.45, k: 'light' },
    { P: circP(2.5, -5, 3.6, 64, FLOOR + 2.2), a: 0.45, k: 'light' },
  ];
}
const STAFF = [
  ['SURGEON', -5.0, -15.5],
  ['ASSISTANT', 5.2, -12.0],
  ['ANAESTHETIST', -3.8, -25.5],
  ['SCRUB NURSE', 6.0, -1.0],
];

// network: 1 km = 400 units; Mumbai Central at the origin
function geo(lat, lon) {
  const lat0 = 18.969, lon0 = 72.819;
  return [(lon - lon0) * 111.32 * Math.cos((lat0 * Math.PI) / 180) * 400, (-(lat - lat0) * 110.57) * 400];
}
function buildNet() {
  const nodes = [
    ['MUMBAI CENTRAL', 18.969, 72.819],
    ['MIRA ROAD', 19.281, 72.87],
    ['NAGPUR', 21.146, 79.088],
    ['RAJKOT', 22.304, 70.802],
  ].map(([name, la, lo]) => ({ name, la, lo, p: geo(la, lo) }));
  const arcs = [];
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].p, b = nodes[j].p;
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = 64;
      const P = new Float32Array((n + 1) * 3);
      for (let k = 0; k <= n; k++) {
        const s = k / n;
        P.set([lerp(a[0], b[0], s), FLOOR + Math.sin(Math.PI * s) * d * 0.18, lerp(a[1], b[1], s)], k * 3);
      }
      arcs.push({ P, cum: Lines.cum(P), i, j });
    }
  return { nodes, arcs };
}

// ---------------------------------------------------------------------------
export const S07 = {
  id: 'platform',
  t0: 68.4,
  t1: 84.5,
  init() {
    HOSP = buildHospital();
    HOSP.or = orItems();
    NET = buildNet();
  },
  draw(F, lt, t) {
    const L = F.L;
    const camD = v3.len(v3.sub(F.cam.pos, F.cam.tgt));
    const collapse = seg(t, 83.7, 84.42, E.inQuint);
    const beat = pulse(t);
    // the patient (reconstructed body) stays the centre of everything
    const bodyA = env(t, 68.6, 84.5, 0.8, 0.2) * clamp(1 - Math.log10(camD / 40) / 2.2);
    drawBody(F, 0.65 * bodyA, { fog: [2, 400, 0.4], organs: camD < 30 });
    const hp = lifeHead(t);
    const pp = F.cam.p(hp[0], hp[1], hp[2]);
    if (pp) L.head(pp[0], pp[1], { r: 2.4 + beat * 1.6, rgb: C.RED, core: '255,226,226', g: 26 + beat * 60, gi: 0.9, a: 1 });
    // scale-aware layers
    const orA = env(t, 69.8, 84.0, 0.8, 0.6) * clamp(1.6 - Math.log10(camD / 60) * 0.9);
    const hospA = env(t, 72.6, 84.0, 0.8, 0.5) * clamp(2.4 - Math.log10(camD / 300) * 0.8);
    const netA = env(t, 79.6, 84.4, 0.6, 0.3);
    if (orA > 0.01) drawOR(F, t, orA * (1 - collapse));
    if (hospA > 0.01) drawHospital(F, t, hospA * (1 - collapse), beat);
    if (netA > 0.01) drawNetwork(F, t, netA, camD, beat);
    // the climax line
    const sa = env(t, 80.5, 84.2, 0.1, 0.25);
    if (sa > 0) {
      const s = { fam: 'D', wt: 600, size: 96, track: -0.015, align: 'c', rgb: C.WHITE, a: sa };
      text(F, 'THE FUTURE OF MEDICINE', 960, 250, { ...s, anim: { mode: 'rise', t: t - 80.5, dur: 0.9, stag: 0.025 } });
      text(F, 'ISN’T COMING.', 960, 356, { ...s, anim: { mode: 'rise', t: t - 80.8, dur: 0.9, stag: 0.03 } });
    }
    chapterTag(F, '07', 'THE PLATFORM', t - 70.2, 10.0);
  },
};

// ---------------------------------------------------------------------------
function drawOR(F, t, a) {
  const L = F.L;
  const draw = seg(t, 69.8, 71.6, E.inOutCubic);
  // walls (double line), door
  L.poly(rectP(-35, -45, 35, 20), { rgb: C.ICE, a: 0.7 * a, w: 1.4, to: draw });
  L.poly(rectP(-34.2, -44.2, 34.2, 19.2), { rgb: C.STEEL, a: 0.45 * a, w: 1, to: draw });
  for (const it of HOSP.or) L.poly(it.P, { rgb: it.k === 'light' ? C.STEEL : C.ICE, a: it.a * a, w: 1.2, to: draw });
  // floor grid (600 mm tiles)
  const g = seg(t, 70.0, 71.4) * a;
  if (g > 0)
    for (let x = -30; x <= 30; x += 6) L.poly(new Float32Array([x, FLOOR, -44, x, FLOOR, 19]), { rgb: C.STEEL, a: 0.1 * g, w: 1 });
  // data lines from every device to the integration hub, then out through the wall
  const hub = [-35, -10];
  const dl = seg(t, 70.8, 72.2, E.inOutSine);
  const srcs = [[-8, -25], [10, -23], [10.5, -6], [-10.5, 3.6], [-2.5, 6.6], [0, -9]];
  srcs.forEach((s, i) => {
    const P = pathP([s, [s[0], -10 + (i - 2.5) * 1.2], [hub[0], -10 + (i - 2.5) * 1.2]], FLOOR + 0.03);
    L.poly(P, { rgb: C.LUMI, a: 0.4 * a, w: 1, to: dl });
  });
  L.flush();
  // staff: humans are nodes in this network
  const st = seg(t, 70.6, 71.4);
  for (const [name, x, z] of STAFF) {
    const p = F.cam.p(x, FLOOR + 0.02, z);
    if (!p) continue;
    ring(F, p[0], p[1], Math.max(4, 1.6 * p[3]) * st, { rgb: C.WHITE, a: 0.85 * a, w: 1.2 });
    label(F, name, p[0] + 12, p[1] - 10, { t: t - 70.8, size: 11, a: 0.75 * a });
  }
  const lab = [
    ['BENQ TRIMAX 650 NS', -3.0, 1.6, 71.2],
    ['MINDRAY A9 · ANAESTHESIA', -11.5, -28.5, 71.35],
    ['ZEISS NEURO MICROSCOPE', 12.6, -23, 71.5],
    ['OLYMPUS 4K · 3D', 13.0, -4.0, 71.65],
    ['CREA · OR INTEGRATION', -13.5, 4.2, 71.8],
  ];
  for (const [s, x, z, ts] of lab) {
    const p = F.cam.p(x, FLOOR, z);
    if (p) label(F, s, p[0] + 8, p[1] + 16, { t: t - ts, size: 11, wt: 600, a: 0.85 * a, rgb: C.ICE });
  }
}

function drawHospital(F, t, a, beat) {
  const L = F.L;
  const draw = seg(t, 72.8, 74.8, E.inOutCubic);
  for (const r of HOSP.rooms) {
    if (r[0] === 'OT 01 · NEURO') continue;
    L.poly(rectP(r[1], r[2], r[3], r[4]), { rgb: C.ICE, a: 0.55 * a, w: 1.2, to: draw });
  }
  // outer envelope
  L.poly(rectP(-118, -128, 193, 123), { rgb: C.STEEL, a: 0.5 * a, w: 1.6, to: draw });
  // data traces (the hospital's nervous system)
  const tr = seg(t, 73.6, 75.4, E.inOutSine);
  for (const x of HOSP.traces) L.poly(x.P, { rgb: C.LUMI, a: 0.22 * a, w: 1.0, to: tr, cum: x.cum });
  // the patient's journey (red)
  const j = seg(t, 74.4, 78.6, E.inOutSine);
  L.poly(HOSP.journey, { rgb: C.RED, a: 0.95 * a, w: 2, to: j, cum: HOSP.journeyCum, layer: 2, head: j > 0 && j < 1 ? { r: 3, rgb: C.RED, core: '255,226,226', g: 40, gi: 1 } : null });
  L.flush();
  // pulses along traces, synced to the heart
  for (let i = 0; i < HOSP.traces.length; i++) {
    const x = HOSP.traces[i];
    const u = ((t * 0.45 + i * 0.173) % 1 + 1) % 1;
    const n = x.P.length / 3;
    const k = Math.min(n - 1, u * (n - 1));
    const k0 = Math.floor(k), f = k - k0;
    const k1 = Math.min(n - 1, k0 + 1);
    const p = F.cam.p(lerp(x.P[k0 * 3], x.P[k1 * 3], f), FLOOR, lerp(x.P[k0 * 3 + 2], x.P[k1 * 3 + 2], f));
    if (p) L.head(p[0], p[1], { r: 1.8, rgb: C.LUMI, core: '235,244,255', g: 14 + beat * 14, gi: 0.9 * a * tr, a: a * tr });
  }
  // room labels
  for (const r of HOSP.rooms) {
    const p = F.cam.p(r[1] + 3, FLOOR, r[2] + 4);
    if (!p) continue;
    label(F, r[0], p[0], p[1] + 14, { t: t - 73.4, size: 11.5, wt: 600, a: 0.9 * a, rgb: C.ICE });
    if (r[5]) label(F, r[5], p[0], p[1] + 30, { t: t - 73.6, size: 10, a: 0.55 * a, rgb: C.STEEL });
  }
  const core = F.cam.p(HOSP.core[0], FLOOR, HOSP.core[1]);
  if (core) glowDot(F, core[0], core[1], 40 + beat * 30, C.LUMI, 0.6 * a * tr);
  // machines standing in their departments (far to near)
  const mA = env(t, 74.0, 81.6, 0.8, 0.8) * a;
  if (mA > 0.01) {
    const list = HOSP.machines
      .map((m) => ({ m, d: F.cam.depth(m[1], FLOOR, m[2]) }))
      .sort((p, q) => q.d - p.d);
    list.forEach(({ m }, idx) => {
      const [name, x, z, h, lab1, lab2] = m;
      const img = F.assets.img[name];
      const base = F.cam.p(x, FLOOR, z), top = F.cam.p(x, FLOOR + h, z);
      if (!img || !base || !top) return;
      const tb = 74.0 + idx * 0.22;
      const born = clamp((t - tb) / 0.45);
      if (born <= 0) return;
      // roll call: each machine swells as it arrives in its department, then settles
      const pop = 1 + 0.85 * E.outCubic(born) * (1 - E.inOutSine(clamp((t - tb - 0.55) / 0.7)));
      const ph = Math.hypot(top[0] - base[0], top[1] - base[1]) * 2.3 * pop;
      const pw = (ph * img.width) / img.height;
      const ctx = F.ctx;
      // light pool on the floor
      const gr = ctx.createRadialGradient(base[0], base[1], 0, base[0], base[1], pw * 0.9);
      gr.addColorStop(0, `rgba(${C.LUMI},${0.16 * mA * born})`);
      gr.addColorStop(1, `rgba(${C.LUMI},0)`);
      ctx.fillStyle = gr;
      ctx.fillRect(base[0] - pw, base[1] - pw, pw * 2, pw * 2);
      ctx.save();
      ctx.globalAlpha = mA * born;
      ctx.filter = 'brightness(0.92) contrast(1.05)';
      const rise = (1 - E.outCubic(born)) * ph * 0.3;
      ctx.beginPath();
      ctx.rect(base[0] - pw / 2 - 2, base[1] - ph - 2, pw + 4, ph + 4);
      ctx.clip();
      ctx.drawImage(img, base[0] - pw / 2, base[1] - ph + rise, pw, ph);
      ctx.restore();
      if (ph > 26) {
        label(F, lab1, base[0] - pw / 2, base[1] + 18, { t: t - tb - 0.2, size: 10.5 + 2.5 * (pop - 1), wt: 600, a: 0.9 * mA, rgb: C.WHITE });
        label(F, lab2, base[0] - pw / 2, base[1] + 33 + 3 * (pop - 1), { t: t - tb - 0.3, size: 9.5 + 2 * (pop - 1), a: 0.6 * mA, rgb: C.STEEL });
      }
    });
  }
}

function drawNetwork(F, t, a, camD, beat) {
  const L = F.L;
  const col = seg(t, 83.65, 84.42, E.inQuart);
  const xf = [0, FLOOR, 0, 1 - col];
  const imp = (x, y, z) => [x * (1 - col), FLOOR + (y - FLOOR) * (1 - col), z * (1 - col)];
  // lat/long graticule, scale-aware
  const g1 = clamp(Math.log10(camD / 5000) / 1.5) * a;
  if (g1 > 0) {
    for (let lo = 69; lo <= 81; lo++) {
      const x = geo(19, lo)[0];
      L.poly(new Float32Array([x, FLOOR, geo(24, lo)[1], x, FLOOR, geo(16, lo)[1]]), { rgb: C.STEEL, a: 0.2 * g1, w: 1 });
    }
    for (let la = 16; la <= 24; la++) {
      const z = geo(la, 72)[1];
      L.poly(new Float32Array([geo(la, 68)[0], FLOOR, z, geo(la, 82)[0], FLOOR, z]), { rgb: C.STEEL, a: 0.2 * g1, w: 1 });
    }
  }
  const arcU = seg(t, 81.0, 82.6, E.inOutSine);
  for (const ar of NET.arcs) L.poly(ar.P, { rgb: C.LUMI, a: 0.6 * a, w: 1.2, to: arcU, cum: ar.cum, layer: 2, xf });
  L.flush();
  NET.arcs.forEach((ar, i) => {
    if (arcU < 1) return;
    const u = ((t * 0.5 + i * 0.29) % 1 + 1) % 1;
    const n = ar.P.length / 3;
    const k = Math.floor(u * (n - 1));
    const p = F.cam.p(...imp(ar.P[k * 3], ar.P[k * 3 + 1], ar.P[k * 3 + 2]));
    if (p) L.head(p[0], p[1], { r: 2, rgb: C.WHITE, g: 18, gi: 0.8 * a, a });
  });
  NET.nodes.forEach((nd, i) => {
    const p = F.cam.p(...imp(nd.p[0], FLOOR, nd.p[1]));
    if (!p) return;
    const b = 0.6 + 0.4 * beat;
    const isHome = i === 0;
    L.head(p[0], p[1], { r: 3.2 + beat * 2, rgb: isHome ? C.RED : C.LUMI, core: '255,255,255', g: (40 + beat * 50) * b, gi: 0.9 * a, a });
    ring(F, p[0], p[1], 10 + beat * 8, { rgb: isHome ? C.RED : C.ICE, a: 0.6 * a, w: 1 });
    const dy = i === 1 ? -26 : 26;
    const la = a * (1 - seg(t, 83.4, 83.8));
    label(F, nd.name, p[0] + 18, p[1] + dy, { t: t - 80.6 - i * 0.12, size: 13, wt: 600, a: la, rgb: C.WHITE });
    label(F, `${nd.la.toFixed(2)}°N  ${nd.lo.toFixed(2)}°E`, p[0] + 18, p[1] + dy + 17, { t: t - 80.7 - i * 0.12, size: 10.5, a: 0.6 * la, rgb: C.STEEL });
  });
  label(F, 'WOCKHARDT HOSPITALS · CONNECTED NETWORK', 120, 986, { t: t - 81.2, size: 12, wt: 600, a: 0.8 * a * (1 - col) });
  if (col > 0) {
    const h = F.cam.p(0, FLOOR, 0);
    if (h) {
      glowDot(F, h[0], h[1], 60 + 520 * col * col, C.RED, 0.9 * col);
      L.head(h[0], h[1], { r: 3 + 9 * col, rgb: C.RED, core: '255,235,235', g: 80 + 200 * col, gi: 1, a: 1 });
    }
  }
}
