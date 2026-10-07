// Thorax detail models (cm, body coordinates): lungs, bronchial tree, nodule, heart + vessels.
import { sdEll, sdCap, sdSph, smin, smax, contour2D } from './engine/sdf.js';
import { mulberry32, v3 } from './engine/util.js';

export const W = (X, Y, Z) => [X * 0.1, Y * 0.1, -Z * 0.1];

// ---------------- lungs ----------------
const heartBlob = (x, y, z) => sdEll(x, y, z, 2.8, 13.2, 123.5, 6.2, 5.2, 6.8);
export function lungL(x, y, z) {
  let d = sdEll(x, y, z, 8.6, 12, 129, 7.0, 7.4, 14);
  d = smax(d, -sdSph(x, y, z, 6, 11, 103.5, 12), 1.5); // diaphragm dome
  d = smax(d, -(heartBlob(x, y, z) - 0.8), 1.2);
  d = smax(d, -(x - 2.3), 1.0);
  return d;
}
export function lungR(x, y, z) {
  let d = sdEll(x, y, z, -8.6, 12, 129.5, 7.2, 7.5, 14.3);
  d = smax(d, -sdSph(x, y, z, -6, 11, 105.5, 12), 1.5);
  d = smax(d, x + 2.3, 1.0);
  return d;
}
export const NODULE = [9.2, 14.2, 127.6];
export function nodule(x, y, z) {
  const d = sdSph(x, y, z, NODULE[0], NODULE[1], NODULE[2], 0.46);
  return d + 0.06 * Math.sin(x * 9.1) * Math.sin(y * 8.3 + 1) * Math.sin(z * 7.7 + 2);
}

function slicesOf(fn, z0, z1, dz, box, res, tag) {
  const out = [];
  for (let Z = z0; Z <= z1 + 1e-6; Z += dz) {
    const cs = contour2D((x, y) => fn(x, y, Z), box[0], box[1], box[2], box[3], res, 1);
    for (const c of cs) {
      const n = c.p.length / 2;
      const P = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        P[i * 3] = c.p[i * 2] * 0.1;
        P[i * 3 + 1] = c.p[i * 2 + 1] * 0.1;
        P[i * 3 + 2] = -Z * 0.1;
      }
      out.push({ P, closed: c.closed, Z, tag });
    }
  }
  return out;
}

export function buildLungs() {
  return [
    ...slicesOf(lungL, 113, 144, 0.55, [1, 3, 17, 21], 0.36, 'L'),
    ...slicesOf(lungR, 113, 145, 0.55, [-17, 3, -1, 21], 0.36, 'R'),
  ];
}
export function buildNodule() {
  return slicesOf(nodule, NODULE[2] - 0.6, NODULE[2] + 0.6, 0.12, [NODULE[0] - 1, NODULE[1] - 1, NODULE[0] + 1, NODULE[1] + 1], 0.05, 'N');
}

/** bronchial tree: segments [{P (2 pts world), gen}] */
export function buildBronchi() {
  const rnd = mulberry32(42);
  const segs = [];
  const inside = (p) => Math.min(lungL(p[0], p[1], p[2]), lungR(p[0], p[1], p[2])) < -0.4;
  const push = (a, b, gen) => segs.push({ P: new Float32Array([...W(...a), ...W(...b)]), gen });
  const trachea0 = [0, 13.4, 152], carina = [0, 13.0, 138.5];
  push(trachea0, carina, 0);
  function grow(p, dir, len, gen) {
    if (gen > 7) return;
    let end = v3.add(p, v3.mul(dir, len));
    if (gen > 1 && !inside(end)) {
      end = v3.add(p, v3.mul(dir, len * 0.5));
      if (!inside(end)) return;
    }
    push(p, end, gen);
    for (let k = 0; k < 2; k++) {
      const axis = v3.norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
      const perp = v3.norm(v3.cross(dir, axis));
      const ang = (0.42 + rnd() * 0.3) * (k ? 1 : -1);
      const nd = v3.norm(v3.add(v3.mul(dir, Math.cos(ang)), v3.mul(perp, Math.sin(ang))));
      grow(end, nd, len * (0.74 + rnd() * 0.1), gen + 1);
    }
  }
  grow(carina, v3.norm([0.75, -0.08, -0.62]), 4.2, 1);
  grow(carina, v3.norm([-0.7, -0.05, -0.6]), 3.6, 1);
  return segs;
}

// ---------------- heart ----------------
export const HB = [1.4, 12.4, 128.6]; // base centre
export const HA = [6.6, 15.6, 118.4]; // apex
const AX = v3.norm(v3.sub(HA, HB));
const REF = v3.norm(v3.cross(AX, [0, 1, 0]));
const UPV = v3.cross(REF, AX);
export const HEART_C = v3.lerp(HB, HA, 0.45);
function local(x, y, z, c) {
  const d = [x - c[0], y - c[1], z - c[2]];
  return [v3.dot(d, REF), v3.dot(d, UPV), v3.dot(d, AX)];
}
function ellA(x, y, z, c, ra, rb, rl) {
  const q = local(x, y, z, c);
  return sdEll(q[0], q[1], q[2], 0, 0, 0, ra, rb, rl);
}
export function heart(x, y, z) {
  const lvC = v3.lerp(HB, HA, 0.52);
  let d = ellA(x, y, z, lvC, 3.5, 3.4, 6.1); // LV
  const rvC = v3.add(v3.lerp(HB, HA, 0.42), [-2.3, 1.5, 0.3]);
  d = smin(d, ellA(x, y, z, rvC, 3.0, 2.3, 5.0), 1.2); // RV
  d = smin(d, sdEll(x, y, z, HB[0] + 1.8, HB[1] - 2.0, HB[2] + 1.2, 2.3, 2.0, 2.2), 1.0); // LA
  d = smin(d, sdEll(x, y, z, HB[0] - 3.1, HB[1] - 0.6, HB[2] + 0.4, 2.4, 2.2, 2.6), 1.0); // RA
  d = smin(d, sdCap(x, y, z, HB[0] - 0.4, HB[1] + 0.4, HB[2] + 1.2, -0.4, 12.6, 135.5, 1.35), 0.8); // ascending aorta
  d = smin(d, sdCap(x, y, z, -0.4, 12.6, 135.5, 2.4, 8.6, 137.0, 1.25), 0.6); // arch
  d = smin(d, sdCap(x, y, z, 2.4, 8.6, 137.0, 2.0, 7.0, 116.0, 1.15), 0.6); // descending
  d = smin(d, sdCap(x, y, z, HB[0] + 0.2, HB[1] + 2.6, HB[2] + 0.4, 2.8, 13.8, 134.0, 1.2), 0.7); // pulmonary trunk
  return d;
}
export function buildHeart() {
  return slicesOf(heart, 113.6, 139.5, 0.3, [-6.5, 4.5, 12.5, 21.5], 0.2, 'H');
}

/** point on the heart surface at axial fraction h (0 base .. 1 apex) and azimuth phi */
export function heartSurface(h, phi, off = 0.15) {
  const c = v3.lerp(HB, HA, h);
  const dir = v3.add(v3.mul(REF, Math.cos(phi)), v3.mul(UPV, Math.sin(phi)));
  let r = 0.2;
  let prev = heart(...v3.add(c, v3.mul(dir, r)));
  for (let k = 0; k < 80 && prev < 0; k++) {
    r += 0.12;
    prev = heart(...v3.add(c, v3.mul(dir, r)));
  }
  return v3.add(c, v3.mul(dir, r + off));
}
export const PHI_ANT = Math.PI / 2; // UPV points anterior-ish

function curve(n, fn) {
  const P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const w = W(...fn(i / (n - 1)));
    P[i * 3] = w[0];
    P[i * 3 + 1] = w[1];
    P[i * 3 + 2] = w[2];
  }
  return P;
}
export function buildCoronaries() {
  const lad = curve(90, (s) => heartSurface(0.12 + 0.86 * s, PHI_ANT + 0.25 + 0.15 * Math.sin(s * 5), 0.2));
  const lcx = curve(70, (s) => heartSurface(0.16 + 0.12 * s, PHI_ANT + 0.25 + s * 2.2, 0.2));
  const rca = curve(80, (s) => heartSurface(0.12 + 0.18 * s, PHI_ANT + 0.25 - s * 2.6, 0.2));
  const d1 = curve(40, (s) => heartSurface(0.3 + 0.45 * s, PHI_ANT + 0.25 + 0.15 * Math.sin(1.5) + s * 0.9, 0.2));
  const om = curve(40, (s) => heartSurface(0.26 + 0.45 * s, PHI_ANT + 1.45 + s * 0.4, 0.2));
  return { lad, lcx, rca, d1, om };
}
export function buildHelix(turns = 6.5, n = 900) {
  return curve(n, (s) => heartSurface(0.04 + 0.94 * s, PHI_ANT + s * turns * Math.PI * 2, 0.32));
}
