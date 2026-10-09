// Sets and lighting rigs: the assembly line (dark glossy hall, overhead light banks that slam on,
// gantry, conveyor pallet, station pads) and a void studio for the hero reveal.
import { Geo, plane, rbox, cylinder, lathe } from '../engine/geo.js';
import { m4 } from '../engine/m4.js';
import { clamp, lerp } from '../engine/util.js';

export const LINE = {
  stations: [0, 7, 14, 21, 28], // station x positions along the line
  bankStep: 3.5, // light banks every 3.5 m along x
  bankY: 4.6,
  bank0: -21, // first bank x
  nBanks: 26,
};

export function bankX(i) {
  return LINE.bank0 + i * LINE.bankStep;
}

let S = null;
/** build the set meshes once */
export function buildSets(R) {
  if (S) return S;
  const M = (g) => R.mesh(g);
  S = {};
  S.floor = M(plane(240, 120));
  // light banks: a long emissive bar across the line + a dark housing
  S.bankLight = M(rbox(0.12, 0.04, 3.4, 0.015));
  S.bankHouse = M(new Geo().add(rbox(0.3, 0.12, 3.6, 0.03), m4.T(0, 0.07, 0)).add(rbox(0.04, 0.9, 0.04, 0.01), m4.T(0, 0.55, 1.4)).add(rbox(0.04, 0.9, 0.04, 0.01), m4.T(0, 0.55, -1.4)));
  // lane lines on the floor (emissive strips) and the conveyor channel
  S.lane = M(rbox(240, 0.004, 0.035, 0.001));
  S.track = M(new Geo().add(rbox(240, 0.03, 0.9, 0.01), m4.T(0, 0.015, 0)));
  S.rail = M(rbox(240, 0.02, 0.03, 0.005));
  // pallet: graphite slab with a light edge
  S.pallet = M(rbox(1.5, 0.08, 1.45, 0.025));
  S.palletEdge = M(new Geo().add(rbox(1.52, 0.012, 0.012, 0.004), m4.T(0, 0, 0.73)).add(rbox(1.52, 0.012, 0.012, 0.004), m4.T(0, 0, -0.73)).add(rbox(0.012, 0.012, 1.46, 0.004), m4.T(0.76, 0, 0)).add(rbox(0.012, 0.012, 1.46, 0.004), m4.T(-0.76, 0, 0)));
  // station pad outline (emissive) around each station
  const pad = new Geo();
  const hx = 1.6, hz = 1.75;
  pad.add(rbox(hx * 2, 0.003, 0.02, 0.001), m4.T(0, 0, hz));
  pad.add(rbox(hx * 2, 0.003, 0.02, 0.001), m4.T(0, 0, -hz));
  pad.add(rbox(0.02, 0.003, hz * 2, 0.001), m4.T(hx, 0, 0));
  pad.add(rbox(0.02, 0.003, hz * 2, 0.001), m4.T(-hx, 0, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pad.add(rbox(0.3, 0.004, 0.06, 0.001), m4.T(sx * (hx - 0.15), 0.001, sz * (hz - 0.03)));
  S.pad = M(pad);
  // pillars along both sides with vertical light strips
  S.pillar = M(rbox(0.5, 7, 0.5, 0.03).xf(m4.T(0, 3.5, 0)));
  S.pillarLight = M(rbox(0.03, 5.5, 0.03, 0.01).xf(m4.T(0, 3.2, 0)));
  // gantry rails (two I-beams along x) and a carriage with a telescoping lifter
  S.gantryRail = M(new Geo().add(rbox(240, 0.22, 0.12, 0.01), m4.T(0, 0, 0)).add(rbox(240, 0.03, 0.26, 0.008), m4.T(0, 0.12, 0)).add(rbox(240, 0.03, 0.26, 0.008), m4.T(0, -0.12, 0)));
  S.carriage = M(new Geo().add(rbox(0.7, 0.22, 2.4, 0.03), m4.T(0, 0, 0)).add(rbox(0.5, 0.3, 0.5, 0.04), m4.T(0, -0.2, 0)));
  S.lifter = M(rbox(0.16, 1, 0.16, 0.02).xf(m4.T(0, -0.5, 0)));
  S.lifter2 = M(rbox(0.12, 1, 0.12, 0.02).xf(m4.T(0, -0.5, 0)));
  S.gripPlate = M(rbox(0.5, 0.05, 0.5, 0.015));
  // back wall panels (far, dark) with a seam grid
  S.wall = M(rbox(240, 9, 0.2, 0.02).xf(m4.T(0, 4.5, 0)));
  // calibration target plate (on a stand)
  S.target = M(new Geo().add(cylinder(0.32, 0.03, { seg: 64, bevel: 0.006 }), m4.T(0, 0, 0)).add(cylinder(0.04, 0.9, { seg: 24, bevel: 0.01 }), m4.T(0, -0.9, 0)).add(cylinder(0.25, 0.03, { seg: 48, bevel: 0.008 }), m4.T(0, -0.93, 0)));
  S.targetRing = M(lathe([[0.22, 0], [0.235, 0], [0.235, 0.004], [0.22, 0.004]], 64, { crease: 60, wireRings: false, wireMeridians: 0 }));
  return S;
}

const GRAPH = { alb: [0.06, 0.064, 0.072], rough: 0.4, metal: 0, f0: 0.05, coat: 0.4 };
const DARK = { alb: [0.025, 0.026, 0.03], rough: 0.55, metal: 0, f0: 0.04, coat: 0.1 };
const STEEL = { alb: [0.7, 0.72, 0.75], rough: 0.3, metal: 1, f0: 0.04, coat: 0 };
const em = (rgb, k) => ({ alb: [0.02, 0.02, 0.02], rough: 0.4, metal: 0, f0: 0.04, coat: 0, emis: rgb.map((v) => v * k) });

/**
 * Lighting for the assembly hall. banks(i) -> 0..1 brightness of bank i; centre: station x for
 * shadow framing; o.amb overall.
 */
export function hallScene(t, o = {}) {
  const lit = o.lit ?? 1; // overall hall level (banks on)
  const cx = o.cx ?? 0;
  const k = lit;
  return {
    time: t,
    lights: [
      { dir: [0.25, 1, 0.35], rgb: [2.4 * k, 2.4 * k, 2.45 * k] },
      { dir: [-0.6, 0.35, 0.7], rgb: [0.35 * k, 0.42 * k, 0.5 * k] },
      { dir: [0.1, 0.5, -1], rgb: [(0.9 + 0.3 * k) * (o.rim ?? 1), (1.1 + 0.3 * k) * (o.rim ?? 1), (1.5 + 0.3 * k) * (o.rim ?? 1)] },
    ],
    key: { shadow: true, dir: [-0.25, -1, -0.35], center: [cx, 1.0, 0], ext: o.shadowExt ?? 2.4, depth: 7, soft: 2.0 },
    skyAO: { center: [cx, 1.2, 0], ext: 3.2, depth: 6, radius: 0.12, amount: 0.85 },
    boxes: [
      { dir: [0.0, 1, 0.12], up: [1, 0, 0], size: [1.4, 0.05], rgb: [3.2 * k, 3.2 * k, 3.3 * k] },
      { dir: [0.45, 1, 0.1], up: [1, 0, 0], size: [1.4, 0.04], rgb: [2.2 * k, 2.2 * k, 2.3 * k] },
      { dir: [-0.45, 1, 0.1], up: [1, 0, 0], size: [1.4, 0.04], rgb: [2.2 * k, 2.2 * k, 2.3 * k] },
      { dir: [0.1, 0.35, -1], size: [1.6, 0.05], rgb: [1.0, 1.4, 1.9] },
      { dir: [-1, 0.15, 0.2], size: [0.04, 0.9], rgb: [0.5 * k, 0.75 * k, 1.0 * k] },
      { dir: [1, 0.15, 0.2], size: [0.04, 0.9], rgb: [0.5 * k, 0.75 * k, 1.0 * k] },
    ],
    sky: [0.035 * k + 0.004, 0.04 * k + 0.005, 0.05 * k + 0.007],
    ground: [0.004, 0.0045, 0.006],
    horizon: [0.02 * k, 0.03 * k, 0.04 * k],
    amb: 0.7,
    fogRgb: [0.012 * k + 0.002, 0.016 * k + 0.003, 0.022 * k + 0.004],
    fog: o.fog ?? 0.045,
    fogH: 0.15,
    reflect: true,
    exposure: o.exposure ?? 1.0,
    points: o.points || [],
  };
}

/** queue the hall. o: { banks(i) -> 0..1, cx (camera-relevant x range), stations, pallet x, glow } */
export function drawHall(R, o = {}) {
  const s = S;
  const banks = o.banks || (() => 1);
  const lit = o.lit ?? 1;
  R.add(s.floor, m4.T(20, 0, 0), {
    alb: [0.016, 0.017, 0.02], rough: 0.18, floor: true, reflStr: 0.85, reflBlur: 3, floorEnv: 0.25,
    grid: [1.0, 0.8, 0.06 * lit, 0.03], gridRgb: [0.3, 0.75, 1.0],
  });
  // lane lines + track
  for (const z of [-2.1, 2.1]) R.add(s.lane, m4.T(20, 0.002, z), em([0.9, 0.95, 1.0], 0.55 * lit + 0.05));
  R.add(s.track, m4.T(20, 0, 0), DARK);
  for (const z of [-0.32, 0.32]) R.add(s.rail, m4.T(20, 0.03, z), STEEL);
  // station pads
  for (const x of LINE.stations) R.add(s.pad, m4.T(x, 0.002, 0), em([0.3, 0.85, 1.2], (0.15 + 0.85 * lit) * (o.padGlow ?? 1)));
  // light banks
  const x0 = o.xMin ?? -40, x1 = o.xMax ?? 80;
  for (let i = 0; i < LINE.nBanks; i++) {
    const x = bankX(i);
    if (x < x0 || x > x1) continue;
    const b = clamp(banks(i));
    R.add(s.bankHouse, m4.T(x, LINE.bankY, 0), { ...DARK, noShadow: true });
    R.add(s.bankLight, m4.T(x, LINE.bankY - 0.01, 0), { ...em([1, 1, 1.05], 0.02 + 3.2 * b), noShadow: true });
    // a faint shaft of light in the haze
    if (b > 0.01 && o.shafts !== false) R.addBeam([x, LINE.bankY - 0.05, 0], [x, 0.0, 0], 0.5, 1.4, [0.05 * b, 0.055 * b, 0.065 * b], 1, 0);
  }
  // pillars (both sides)
  for (let x = -42; x <= 84; x += 7) {
    if (x < x0 - 7 || x > x1 + 7) continue;
    for (const z of [-6.2, 6.2]) {
      R.add(s.pillar, m4.T(x, 0, z), { ...GRAPH, noShadow: true });
      R.add(s.pillarLight, m4.T(x, 0, z + (z < 0 ? 0.26 : -0.26)), { ...em([0.4, 0.8, 1.2], 0.2 + 0.8 * lit), noShadow: true });
    }
  }
  // gantry rails
  for (const z of [-1.15, 1.15]) R.add(s.gantryRail, m4.T(20, 3.6, z), { ...GRAPH, noShadow: true });
  R.add(s.wall, m4.T(20, 0, -9.5), { ...DARK, noShadow: true, noReflect: true });
}

/** a gantry carriage at x with its lifter extended down to height yEnd (the grip plate) */
export function drawCarriage(R, x, yEnd, z = 0) {
  const s = S;
  R.add(s.carriage, m4.T(x, 3.6, z), { ...GRAPH });
  const top = 3.3;
  const L = Math.max(0.05, top - yEnd);
  // two telescoping stages
  R.add(s.lifter, m4.chain(m4.T(x, top, z), m4.S(1, Math.min(L, 1.6), 1)), GRAPH);
  if (L > 1.4) R.add(s.lifter2, m4.chain(m4.T(x, top - 1.4, z), m4.S(1, L - 1.4, 1)), STEEL);
  R.add(s.gripPlate, m4.T(x, yEnd, z), GRAPH);
}

export function studio(t, o = {}) {
  const k = o.k ?? 1;
  return {
    time: t,
    lights: [
      { dir: [-0.45, 0.85, 0.55], rgb: [2.3 * k, 2.25 * k, 2.2 * k] },
      { dir: [0.8, 0.35, 0.45], rgb: [0.45 * k, 0.5 * k, 0.58 * k] },
      { dir: [0.2, 0.45, -1], rgb: [1.1 * (o.rim ?? 1), 1.3 * (o.rim ?? 1), 1.6 * (o.rim ?? 1)] },
    ],
    key: { shadow: true, dir: [0.45, -0.85, -0.55], center: [0, 1, 0.1], ext: 1.6, depth: 5, soft: 2.2 },
    skyAO: { center: [0, 1.2, 0], ext: 2.0, depth: 4, radius: 0.12, amount: 0.8 },
    boxes: [
      { dir: [-0.45, 0.85, 0.55], size: [0.55, 0.3], rgb: [3.2 * k, 3.2 * k, 3.2 * k] },
      { dir: [0.2, 0.45, -1], size: [1.2, 0.06], rgb: [1.6, 1.9, 2.3] },
      { dir: [0.95, 0.15, 0.25], size: [0.06, 0.7], rgb: [1.5 * k, 1.6 * k, 1.7 * k] },
      { dir: [-0.95, 0.1, -0.1], size: [0.05, 0.8], rgb: [1.2 * k, 1.3 * k, 1.5 * k] },
      { dir: [0, 1, 0.05], size: [0.6, 0.6], rgb: [0.6 * k, 0.62 * k, 0.65 * k] },
    ],
    sky: [0.05 * k, 0.055 * k, 0.065 * k], ground: [0.006, 0.006, 0.007], horizon: [0.03 * k, 0.035 * k, 0.045 * k], amb: 0.7,
    fogRgb: [0.004, 0.005, 0.007], fog: 0.035, reflect: true, exposure: 1.0,
    ...o,
  };
}

export const SET_MAT = { GRAPH, DARK, STEEL, em };
void lerp;
