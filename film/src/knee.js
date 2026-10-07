// Left knee, reconstructed from dense axial slices. Local coords in cm, mirrored so the lateral
// side is +X'. Body/world mapping: X_body = -X', world = (X_body, Y, -Z) * 0.1
import { sdEll, sdCap, sdSph, smin, smax, contour2D } from './engine/sdf.js';

export const KX = 9.8; // knee centre X' (cm)
export const JOINT_Z = 49.55; // joint line (cm from the soles)
export const FEMUR_TIP = 49.75; // lowest point of the condyles
export const DISTAL_CUT = FEMUR_TIP + 0.9; // 9.0 mm distal resection
export const TIBIA_TOP = 49.35;
export const TIBIAL_CUT = TIBIA_TOP - 0.85; // 8.5 mm tibial resection

export function femur(x, y, z) {
  let d = sdCap(x, y, z, KX, 7.8, 54, KX - 0.4, 8.6, 80, 1.45);
  d = smin(d, sdEll(x, y, z, KX, 7.8, 55.6, 3.1, 2.45, 4.4), 2.0);
  d = smin(d, sdEll(x, y, z, KX - 1.9, 7.3, 52.05, 1.95, 2.5, 2.3), 1.1);
  d = smin(d, sdEll(x, y, z, KX + 1.85, 7.4, 52.2, 1.8, 2.42, 2.25), 1.1);
  d = smax(d, -sdCap(x, y, z, KX, 10.05, 50.6, KX, 10.05, 55.2, 0.62), 0.5); // trochlear groove
  d = smax(d, -sdCap(x, y, z, KX, 5.6, 50.3, KX, 6.9, 53.1, 0.72), 0.45); // intercondylar notch
  return d;
}
export function tibia(x, y, z) {
  let d = sdEll(x, y, z, KX, 7.3, 48.45, 3.7, 2.5, 0.95);
  d = smin(d, sdEll(x, y, z, KX - 1.8, 7.2, 48.2, 1.9, 2.3, 1.2), 0.8);
  d = smin(d, sdEll(x, y, z, KX + 1.8, 7.2, 48.25, 1.85, 2.25, 1.15), 0.8);
  d = smin(d, sdEll(x, y, z, KX, 7.3, 46.4, 2.6, 2.0, 2.8), 1.5);
  d = smin(d, sdCap(x, y, z, KX, 7.2, 46.5, KX - 0.2, 6.8, 22, 1.25), 1.6);
  d = smin(d, sdEll(x, y, z, KX, 9.25, 46.0, 0.9, 0.9, 1.6), 0.8); // tuberosity
  d = smin(d, sdEll(x, y, z, KX, 7.35, 49.2, 0.45, 0.9, 0.5), 0.3); // eminence
  return d;
}
export function fibula(x, y, z) {
  let d = sdCap(x, y, z, KX + 3.0, 6.6, 47.4, KX + 2.3, 6.4, 22, 0.55);
  d = smin(d, sdSph(x, y, z, KX + 3.0, 6.6, 47.6, 0.95), 0.5);
  return d;
}
export function patella(x, y, z) {
  return sdEll(x, y, z, KX, 10.75, 53.6, 1.9, 0.85, 2.3);
}

export const BONES = [
  ['femur', femur, [49.5, 64]],
  ['tibia', tibia, [38, 49.6]],
  ['fibula', fibula, [38, 48.8]],
  ['patella', patella, [51.2, 56]],
];

export const toWorld = (xp, y, z) => [-xp * 0.1, y * 0.1, -z * 0.1];

/** slices: [{bone, Z, P (world xyz), X (local X' per point), closed}] */
export function buildKnee(dz = 0.25) {
  const out = [];
  for (const [name, fn, zr] of BONES) {
    for (let Z = zr[0]; Z <= zr[1] + 1e-6; Z += dz) {
      const cs = contour2D((x, y) => fn(x, y, Z), KX - 4.8, 3.4, KX + 4.8, 12.4, 0.11, 1);
      for (const c of cs) {
        const n = c.p.length / 2;
        const P = new Float32Array(n * 3);
        const X = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const w = toWorld(c.p[i * 2], c.p[i * 2 + 1], Z);
          P[i * 3] = w[0];
          P[i * 3 + 1] = w[1];
          P[i * 3 + 2] = w[2];
          X[i] = c.p[i * 2];
        }
        out.push({ bone: name, Z, P, X, closed: c.closed });
      }
    }
  }
  return out;
}

/** a few longitudinal (sagittal) contours to give the stack a sculpted, solid read */
export function buildKneeSagittal(xs) {
  const out = [];
  for (const [name, fn] of BONES) {
    if (name === 'fibula' || name === 'patella') continue;
    for (const xp of xs) {
      const cs = contour2D((y, z) => fn(xp, y, z), 3.4, 38, 12.4, 64, 0.14, 1);
      for (const c of cs) {
        const n = c.p.length / 2;
        const P = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const w = toWorld(xp, c.p[i * 2], c.p[i * 2 + 1]);
          P[i * 3] = w[0];
          P[i * 3 + 1] = w[1];
          P[i * 3 + 2] = w[2];
        }
        out.push({ bone: name, P, closed: c.closed });
      }
    }
  }
  return out;
}
