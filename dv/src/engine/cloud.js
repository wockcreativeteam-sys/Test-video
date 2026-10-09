// 3D point clouds into the particle film: projection, depth of field (bokeh discs that keep
// their energy), depth fog, near fade, optional motion streaks.
import { clamp, lerp } from './util.js';

const P4 = [0, 0, 0, 0], Q4 = [0, 0, 0, 0];

/**
 * P: Float32Array xyz. n: count.
 * o: rgb [r,g,b] (0..1), RGB (per-particle Float32Array 3n), e (energy), E (per-particle energy),
 *    size (px radius, 0 = point), sizeK (radius grows with perspective: px per unit at k=1),
 *    dof {focus, range, max, gain}, fog [z0, z1, min], near [z0, z1], prev (Float32Array xyz, for streaks),
 *    xf [cx, cy, cz, scale], screenOff [dx, dy], alphaFn(i, z) -> mult
 */
export function cloud(F, P, n, o = {}) {
  const cam = F.cam, S = F.S;
  const rgb = o.rgb || [1, 1, 1];
  const e0 = o.e ?? 1;
  if (e0 <= 0) return;
  const RGB = o.RGB, EN = o.E, prev = o.prev;
  const dof = o.dof, fog = o.fog, near = o.near, xf = o.xf;
  const size = o.size || 0, sizeK = o.sizeK || 0;
  const ox = o.screenOff ? o.screenOff[0] : 0, oy = o.screenOff ? o.screenOff[1] : 0;
  for (let i = 0; i < n; i++) {
    let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (xf) {
      x = xf[0] + (x - xf[0]) * xf[3];
      y = xf[1] + (y - xf[1]) * xf[3];
      z = xf[2] + (z - xf[2]) * xf[3];
    }
    if (!cam.project(x, y, z, P4)) continue;
    const sx = P4[0] + ox, sy = P4[1] + oy;
    if (sx < -60 || sy < -60 || sx > F.W + 60 || sy > F.H + 60) continue;
    let e = EN ? EN[i] * e0 : e0;
    const zc = P4[2];
    if (fog) e *= lerp(1, fog[2], clamp((zc - fog[0]) / (fog[1] - fog[0])));
    if (near) e *= clamp((zc - near[0]) / (near[1] - near[0]));
    if (o.alphaFn) e *= o.alphaFn(i, zc);
    if (e <= 0.002) continue;
    let rad = size + sizeK * P4[3];
    if (dof) {
      const b = Math.min(dof.max, (Math.abs(zc - dof.focus) / dof.range) * dof.max);
      rad += b;
      e *= 1 + b * (dof.gain ?? 0.18);
    }
    const r = RGB ? RGB[i * 3] : rgb[0], g = RGB ? RGB[i * 3 + 1] : rgb[1], b = RGB ? RGB[i * 3 + 2] : rgb[2];
    if (prev) {
      let px = prev[i * 3], py = prev[i * 3 + 1], pz = prev[i * 3 + 2];
      if (xf) {
        px = xf[0] + (px - xf[0]) * xf[3];
        py = xf[1] + (py - xf[1]) * xf[3];
        pz = xf[2] + (pz - xf[2]) * xf[3];
      }
      if (cam.project(px, py, pz, Q4) && Math.hypot(Q4[0] - P4[0], Q4[1] - P4[1]) > 1.2) {
        S.streak(Q4[0] + ox, Q4[1] + oy, sx, sy, rad, r * e, g * e, b * e);
        continue;
      }
    }
    if (rad < 0.6) S.pt(sx, sy, r * e, g * e, b * e);
    else S.blob(sx, sy, rad, r * e, g * e, b * e);
  }
}

/** 2D screen-space points (stride 2) */
export function cloud2(F, P, n, o = {}) {
  const S = F.S;
  const rgb = o.rgb || [1, 1, 1];
  const e0 = o.e ?? 1;
  const RGB = o.RGB, EN = o.E, size = o.size || 0, R = o.R;
  for (let i = 0; i < n; i++) {
    let e = EN ? EN[i] * e0 : e0;
    if (o.alphaFn) e *= o.alphaFn(i);
    if (e <= 0.002) continue;
    const r = RGB ? RGB[i * 3] : rgb[0], g = RGB ? RGB[i * 3 + 1] : rgb[1], b = RGB ? RGB[i * 3 + 2] : rgb[2];
    const rad = R ? R[i] : size;
    if (rad < 0.6) S.pt(P[i * 2], P[i * 2 + 1], r * e, g * e, b * e);
    else S.blob(P[i * 2], P[i * 2 + 1], rad, r * e, g * e, b * e);
  }
}
