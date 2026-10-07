// Procedural supine human in centimetres: X lateral, Y up from the table, Z from the soles.
// Reconstructed into axial contour slices — the film never uses a stock anatomical model.
import { sdEll, sdCap, sdCapT, sdSph, smin, smax, contour2D, lift } from './engine/sdf.js';

export const CM = 0.1; // world units per cm (1 unit = 10 cm)

export function bodySDF(x, y, z) {
  const X = Math.abs(x);
  let d = sdEll(x, y, z, 0, 11, 163, 8.2, 9.6, 11.2); // head
  d = smin(d, sdCap(x, y, z, 0, 9.5, 146, 0, 10, 154, 5.6), 3); // neck
  d = smin(d, sdEll(x, y, z, 0, 11.6, 127, 17.6, 11.2, 19.5), 5); // chest
  d = smin(d, sdCap(X, y, z, 0, 9.5, 140, 16, 9.5, 140, 6.6), 4); // shoulders
  d = smin(d, sdEll(x, y, z, 0, 10.4, 105, 15.4, 10.4, 15.5), 6); // abdomen
  d = smin(d, sdEll(x, y, z, 0, 10, 88, 17.4, 10, 11.5), 5); // pelvis
  d = smin(d, sdCapT(X, y, z, 20, 9, 139, 23, 7, 111, 4.8, 4.0), 2.5); // upper arm
  d = smin(d, sdCapT(X, y, z, 23, 7, 111, 22.5, 5.5, 84, 3.9, 3.0), 2); // forearm
  d = smin(d, sdEll(X, y, z, 22.3, 5, 75, 3.2, 2.2, 6.5), 1.5); // hand
  d = smin(d, sdCapT(X, y, z, 9.5, 9.5, 86, 9.8, 8, 50, 8.6, 5.6), 4); // thigh
  d = smin(d, sdCapT(X, y, z, 9.8, 8, 50, 9.6, 6.5, 9, 5.6, 3.6), 2.5); // shin
  d = smin(d, sdCapT(X, y, z, 9.6, 5.5, 7, 10.4, 16.5, 1.5, 3.6, 3.0), 2); // foot (toes up)
  return d;
}

// --- organs (asymmetric, supine) ---
const heart = (x, y, z) => sdEll(x, y, z, 2.8, 13.2, 123.5, 6.2, 5.2, 6.8);
const lungL = (x, y, z) => smax(sdEll(x, y, z, 8.6, 12, 128, 6.8, 7.2, 13.5), -heart(x, y, z) - 0.6, 1.5);
const lungR = (x, y, z) => sdEll(x, y, z, -8.6, 12, 128.5, 7.0, 7.3, 13.8);
const liver = (x, y, z) => sdEll(x, y, z, -7.5, 11.5, 110.5, 9.5, 6.8, 7.5);
const stomach = (x, y, z) => sdEll(x, y, z, 6.5, 13.5, 110, 5.2, 4.2, 6.5);
const kidneys = (x, y, z) => sdEll(Math.abs(x), y, z, 7.5, 6.2, 104, 3.1, 2.6, 5.6);
const bladder = (x, y, z) => sdEll(x, y, z, 0, 10.5, 84, 4.2, 3.6, 3.2);
const aorta = (x, y, z) => sdCap(x, y, z, 1.5, 7.0, 136, 1.0, 6.2, 92, 1.2);
const brain = (x, y, z) => sdEll(x, y, z, 0, 11.6, 164, 6.6, 7.6, 9.2);
const skull = (x, y, z) => Math.abs(sdEll(x, y, z, 0, 11, 163, 8.2, 9.6, 11.2) + 0.9) - 0.45;
const spine = (x, y, z) => sdCap(x, y, z, 0, 4.9, 90, 0, 5.2, 152, 2.2) + 0.35 * Math.sin(z * 1.4);
const ribs = (x, y, z) => {
  if (z < 108 || z > 146) return 9;
  const shell = Math.abs(sdEll(x, y, z, 0, 11.6, 127, 17.6, 11.2, 19.5) + 1.7) - 0.5;
  const ph = z / 2.7;
  const slab = (Math.abs(ph - Math.floor(ph) - 0.5) - 0.32) * 2.7;
  return Math.max(shell, slab, -(y - 3.0));
};
const pelvisBone = (x, y, z) => smax(Math.abs(sdEll(Math.abs(x), y, z, 9.5, 9.5, 92, 7.5, 6.5, 6.5)) - 0.55, -(z - 86), 1);
const femur = (x, y, z) => {
  const X = Math.abs(x);
  let d = sdCap(X, y, z, 9.0, 9.0, 85, 9.8, 7.8, 53, 1.5);
  d = smin(d, sdSph(X, y, z, 8.2, 9.2, 87, 2.3), 1.2);
  d = smin(d, sdEll(X, y, z, 9.8, 7.6, 51.6, 3.6, 2.6, 2.3), 1.6);
  return d;
};
const tibia = (x, y, z) => {
  const X = Math.abs(x);
  let d = sdCap(X, y, z, 9.8, 7.3, 47, 9.6, 6.4, 10, 1.3);
  d = smin(d, sdEll(X, y, z, 9.8, 7.4, 48.6, 3.6, 2.4, 1.3), 1.4);
  return d;
};

export const ORGANS = [
  // name, fn, kind, Z range, XY box, res
  ['heart', heart, 'organ', [115, 132], [-6, 6, 22, 20], 0.5],
  ['lungL', lungL, 'organ', [113, 143], [0, 3, 17, 21], 0.6],
  ['lungR', lungR, 'organ', [113, 143], [-17, 3, 0, 21], 0.6],
  ['liver', liver, 'organ', [102, 119], [-18, 3, 3, 20], 0.6],
  ['stomach', stomach, 'organ', [103, 117], [0, 8, 13, 19], 0.6],
  ['kidneys', kidneys, 'organ', [97, 111], [-12, 2, 12, 10], 0.5],
  ['bladder', bladder, 'organ', [80, 88], [-5, 6, 5, 15], 0.5],
  ['aorta', aorta, 'vessel', [90, 138], [-2, 4, 4, 10], 0.4],
  ['brain', brain, 'organ', [154, 174], [-8, 2, 8, 21], 0.6],
  ['skull', skull, 'bone', [151, 175], [-10, 0, 10, 22], 0.5],
  ['spine', spine, 'bone', [88, 154], [-4, 1, 4, 9], 0.45],
  ['ribs', ribs, 'bone', [108, 146], [-20, 2, 20, 24], 0.6],
  ['pelvis', pelvisBone, 'bone', [84, 100], [-18, 2, 18, 17], 0.6],
  ['femur', femur, 'bone', [48, 90], [-14, 4, 14, 13], 0.45],
  ['tibia', tibia, 'bone', [9, 50], [-14, 3, 14, 11], 0.45],
];

/** cm -> world */
export const W3 = (X, Y, Z) => [X * CM, Y * CM, -Z * CM];

/** top-surface height (cm) of the body at lateral X, axial Z; 0 = table */
export function topY(X, Z) {
  let y = 34, prev = bodySDF(X, y, Z);
  if (prev < 0) return y;
  while (y > 0) {
    const d = bodySDF(X, y, Z);
    if (d < 0) {
      let lo = y, hi = y + Math.max(0.3, Math.min(prev, 4));
      for (let k = 0; k < 7; k++) {
        const m = (lo + hi) / 2;
        if (bodySDF(X, m, Z) < 0) lo = m;
        else hi = m;
      }
      return lo;
    }
    prev = d;
    y -= Math.max(0.35, d * 0.9);
  }
  return 0;
}

/**
 * Build the axial slice set.
 * returns { Z[], profile[i]: Float32Array (world xyz), outer[i]: [{P,closed,n}], organs[i]: [{P,..,kind,name}] }
 */
export function buildSlices(N, Z0, Z1, xs) {
  const S = { Z: [], profile: [], outer: [], organs: [] };
  for (let i = 0; i < N; i++) {
    const Z = Z0 + ((Z1 - Z0) * i) / (N - 1);
    S.Z.push(Z);
    const prof = new Float32Array(xs.length * 3);
    for (let j = 0; j < xs.length; j++) {
      const X = xs[j] / CM;
      const yTop = Math.abs(X) < 30 ? topY(X, Z) : 0;
      prof[j * 3] = xs[j];
      prof[j * 3 + 1] = yTop * CM;
      prof[j * 3 + 2] = -Z * CM;
    }
    S.profile.push(prof);
    const oc = contour2D((X, Y) => bodySDF(X, Y, Z), -30, -1.5, 30, 34, 0.9, 2);
    S.outer.push(oc.map((c) => lift(c, (X, Y) => [X * CM, Math.max(Y, 0) * CM, -Z * CM])));
    const org = [];
    for (const [name, fn, kind, zr, box, res] of ORGANS) {
      if (Z < zr[0] || Z > zr[1]) continue;
      const cs = contour2D((X, Y) => fn(X, Y, Z), box[0], box[1], box[2], box[3], res, 1);
      for (const c of cs) {
        const L = lift(c, (X, Y) => [X * CM, Y * CM, -Z * CM]);
        L.kind = kind;
        L.name = name;
        org.push(L);
      }
    }
    S.organs.push(org);
  }
  return S;
}
