// Brain, tractography and stereotactic geometry (cm, supine body coordinates:
// X lateral, Y anterior (face up), Z superior).
import { sdEll, sdCap, smin, smax, contour2D } from './engine/sdf.js';
import { mulberry32, v3, lerp } from './engine/util.js';

const W = (X, Y, Z) => [X * 0.1, Y * 0.1, -Z * 0.1];

export function brain(x, y, z) {
  const X = Math.abs(x);
  // lobes per hemisphere
  let d = sdEll(X, y, z, 3.2, 15.0, 165.8, 3.5, 4.7, 5.0); // frontal
  d = smin(d, sdEll(X, y, z, 3.4, 10.6, 168.3, 3.6, 4.9, 4.4), 1.6); // parietal
  d = smin(d, sdEll(X, y, z, 3.0, 6.3, 165.0, 3.1, 3.4, 4.0), 1.4); // occipital
  d = smin(d, sdEll(X, y, z, 4.15, 12.7, 160.6, 2.75, 4.9, 2.6), 1.0); // temporal
  d = smax(d, -(X - 0.14), 0.2); // interhemispheric fissure
  d = smax(d, -sdCap(X, y, z, 6.4, 15.8, 162.4, 6.6, 8.6, 163.9, 0.42), 0.25); // lateral (Sylvian) sulcus
  // gyri and sulci: meandering folds
  const g = Math.sin(1.75 * y + 0.85 * Math.sin(1.3 * z + 0.4 * X)) * Math.sin(1.95 * z + 0.75 * Math.sin(1.15 * y));
  d += 0.17 * (Math.abs(g) - 0.45) + 0.05 * Math.sin(3.1 * X + 2.3 * y + 2.9 * z);
  // cerebellum (tucked under the occipital lobe, with folia), pons, brainstem
  // (kept in step with tools/anatomy/brain_surface.py, which grows the cortical surface)
  const cy = y - 7.0, cz = z - 158.35, ct = 0.16;
  const yr = cy * Math.cos(ct) - cz * Math.sin(ct), zr = cy * Math.sin(ct) + cz * Math.cos(ct);
  d = smin(d, sdEll(x, yr, zr, 0, 0, 0, 4.9, 3.25, 2.25) + 0.05 * Math.sin(zr * 11.0), 0.5);
  d = smin(d, sdEll(x, y, z, 0, 10.75, 156.3, 1.7, 1.6, 1.65), 0.6);
  d = smin(d, sdCap(x, y, z, 0, 9.7, 159.6, 0, 9.0, 149, 1.2), 0.8);
  return d;
}
export function head(x, y, z) {
  return sdEll(x, y, z, 0, 11, 163, 8.2, 9.6, 11.2);
}

export function buildBrain() {
  const out = [];
  for (let Z = 149; Z <= 174.2; Z += 0.42) {
    const cs = contour2D((x, y) => brain(x, y, Z), -8, 3, 8, 20.5, 0.17, 1);
    for (const c of cs) {
      const n = c.p.length / 2;
      const P = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) P.set(W(c.p[i * 2], c.p[i * 2 + 1], Z), i * 3);
      out.push({ P, closed: c.closed, Z });
    }
  }
  return out;
}

/** sagittal outlines (constant X) — the iconic lateral silhouette */
export function buildBrainSagittal(xs = [-4.6, -2.6, -0.9, 0.9, 2.6, 4.6]) {
  const out = [];
  for (const X of xs) {
    const cs = contour2D((y, z) => brain(X, y, z), 2.5, 147, 20.5, 175, 0.16, 1);
    for (const c of cs) {
      const n = c.p.length / 2;
      const P = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) P.set(W(X, c.p[i * 2], c.p[i * 2 + 1]), i * 3);
      out.push({ P, closed: c.closed, X });
    }
  }
  return out;
}

function poly(pts) {
  const P = new Float32Array(pts.length * 3);
  pts.forEach((p, i) => P.set(W(...p), i * 3));
  return P;
}

/** fibre bundles: [{P, kind}] */
export function buildTracts() {
  const r = mulberry32(11);
  const out = [];
  const N = 44;
  // corpus callosum: U-shaped commissural fibres
  for (let k = 0; k < 64; k++) {
    const y0 = lerp(6.4, 16.8, r());
    const lift = 2.6 + r() * 1.6;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      const u = 2 * s - 1;
      const x = 5.4 * u;
      const z = 164.4 + 1.3 * Math.cos(u * 1.4) + lift * Math.pow(Math.abs(u), 3.2);
      const y = y0 + 0.5 * Math.sin(u * 3 + k);
      pts.push([x, y, z]);
    }
    out.push({ P: poly(pts), kind: 'cc' });
  }
  // corticospinal: fans from motor cortex converge into the brainstem
  for (const side of [-1, 1]) {
    for (let k = 0; k < 34; k++) {
      const top = [side * lerp(1.6, 5.0, r()), lerp(9.0, 14.0, r()), 170.5 + r() * 1.6];
      const mid = [side * 1.9, 11.0 + (r() - 0.5) * 0.8, 161.5];
      const bot = [side * 0.55, 9.3, 151.0];
      const pts = [];
      for (let i = 0; i < N; i++) {
        const s = i / (N - 1);
        const a = v3.lerp(top, mid, s), b = v3.lerp(mid, bot, s);
        const p = v3.lerp(a, b, s);
        pts.push(p);
      }
      out.push({ P: poly(pts), kind: 'cst' });
    }
  }
  // association arcs, front to back on each side
  for (const side of [-1, 1]) {
    for (let k = 0; k < 22; k++) {
      const x0 = side * lerp(3.6, 5.6, r());
      const zc = lerp(162.5, 167.5, r());
      const pts = [];
      for (let i = 0; i < N; i++) {
        const s = i / (N - 1);
        const y = lerp(17.6, 5.2, s);
        const z = zc + 2.4 * Math.sin(Math.PI * s);
        pts.push([x0 + side * 0.4 * Math.sin(Math.PI * s), y, z]);
      }
      out.push({ P: poly(pts), kind: 'arc' });
    }
  }
  return out;
}

// DBS geometry
export const MCP = [0, 11.2, 162.0];
export const STN = [1.2, 10.95, 161.6];
export function entryPoint() {
  const aim = [3.2, 15.0, 172.8];
  const d = v3.norm(v3.sub(aim, STN));
  let s = 0;
  while (s < 30 && head(...v3.add(STN, v3.mul(d, s))) < 0) s += 0.05;
  return { entry: v3.add(STN, v3.mul(d, s)), dir: d };
}
export const toW = W;

/** stereotactic frame: base ring, posts, N-localiser plates, centre-of-arc */
export function buildFrame() {
  const lines = [];
  const ring = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    ring.push([Math.cos(a) * 10.6, 11 + Math.sin(a) * 12.4, 159.5]);
  }
  lines.push({ P: poly(ring), kind: 'ring' });
  for (const [x, y] of [[-7.4, 19.5], [7.4, 19.5], [-7.4, 2.8], [7.4, 2.8]]) {
    const base = [x * 1.32, y < 11 ? -0.4 : 21.8, 159.5];
    lines.push({ P: poly([base, [x * 1.32, y, 160.5], [x, y, 165.2]]), kind: 'post' });
  }
  // N-localisers on both lateral plates
  for (const side of [-1, 1]) {
    const x = side * 11.6;
    lines.push({ P: poly([[x, 3.5, 157], [x, 3.5, 171]]), kind: 'loc' });
    lines.push({ P: poly([[x, 18.5, 157], [x, 18.5, 171]]), kind: 'loc' });
    lines.push({ P: poly([[x, 3.5, 157], [x, 18.5, 171]]), kind: 'loc' });
  }
  // centre-of-arc: semicircle centred on the target
  const arc = [];
  for (let i = 0; i <= 64; i++) {
    const a = lerp(0.18, Math.PI - 0.18, i / 64);
    arc.push([STN[0] + Math.cos(a) * 15, STN[1], STN[2] + Math.sin(a) * 15]);
  }
  lines.push({ P: poly(arc), kind: 'arc' });
  return lines;
}

/** a single neuron near the target, for the macro moment */
export function buildNeuron() {
  const r = mulberry32(5);
  const c = v3.add(STN, [-0.05, 0.02, -0.04]);
  const out = [];
  function grow(p, dir, len, gen) {
    if (gen > 4) return;
    const pts = [p];
    let q = p, d = dir;
    for (let i = 0; i < 8; i++) {
      d = v3.norm(v3.add(d, [(r() - 0.5) * 0.5, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5]));
      q = v3.add(q, v3.mul(d, len / 8));
      pts.push(q);
    }
    out.push({ P: poly(pts), gen });
    const n = gen < 2 ? 2 : r() < 0.6 ? 2 : 1;
    for (let k = 0; k < n; k++) grow(q, v3.norm(v3.add(d, [(r() - 0.5) * 1.2, (r() - 0.5) * 1.2, (r() - 0.5) * 1.2])), len * 0.7, gen + 1);
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    grow(c, v3.norm([Math.cos(a), Math.sin(a) * 0.6, Math.sin(a * 1.7) * 0.8]), 0.32, 0);
  }
  // axon
  const ax = [];
  for (let i = 0; i <= 30; i++) ax.push(v3.add(c, [0.012 * i, -0.04 * i + 0.006 * Math.sin(i), -0.03 * i]));
  out.push({ P: poly(ax), gen: -1 });
  return { c, parts: out };
}
