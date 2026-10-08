// Architecture that grows out of a footprint and collapses into the next one. Every line of a
// world draws on in order of its distance from the footprint and rises out of the ground; when
// the next foot lands the whole world folds down into that footprint.
import { clamp, lerp, E } from '../engine/util.js';
import { cloud } from '../engine/cloud.js';
import { C, F as PF } from '../palette.js';

/** precompute per-line distances (from the footprint origin) */
export function prepWorld(W) {
  if (W._prep) return W;
  let dmax = 0;
  for (const ln of W.lines) {
    const p = ln.p;
    let d = Infinity;
    for (let i = 0; i < p.length; i += 3) d = Math.min(d, Math.hypot(p[i], p[i + 2] * 1.2) + p[i + 1] * 0.35);
    ln.d = d;
    dmax = Math.max(dmax, d);
    ln.tmp = new Float32Array(p.length);
  }
  W.dmax = dmax;
  W._prep = true;
  return W;
}

/**
 * o: origin [x,y,z], age (s since the footfall), growDur (s), spread (s per metre of distance),
 *    collapse 0..1, next [x,y,z] (where it collapses to), a (alpha), t (time for animated parts),
 *    warp(p) optional deformation of world points (in place, world coords)
 */
export function drawWorld(F, W, o) {
  prepWorld(W);
  const a0 = o.a ?? 1;
  if (a0 <= 0.003) return;
  const age = o.age, gd = o.growDur ?? 0.22, sp = o.spread ?? 0.028;
  const col = o.collapse ?? 0;
  const ce = E.inCubic(col);
  const ox = o.origin[0], oy = o.origin[1], oz = o.origin[2];
  const nx = o.next ? o.next[0] : ox, ny = o.next ? o.next[1] : oy, nz = o.next ? o.next[2] : oz;
  const drawSet = (lines) => {
    for (const ln of lines) {
      const g = clamp((age - (ln.d ?? 0) * sp) / gd);
      if (g <= 0) continue;
      const rise = E.outCubic(g);
      const p = ln.p;
      const q = ln.tmp && ln.tmp.length === p.length ? ln.tmp : (ln.tmp = new Float32Array(p.length));
      for (let i = 0; i < p.length; i += 3) {
        let x = ox + p[i], y = oy + p[i + 1] * rise, z = oz + p[i + 2];
        if (ce > 0) {
          x = lerp(x, nx, ce);
          y = lerp(y, ny, ce) * (1 - ce * 0.5);
          z = lerp(z, nz, ce);
        }
        q[i] = x; q[i + 1] = y; q[i + 2] = z;
      }
      if (o.warp) o.warp(q);
      const w = ln.w ?? 1;
      const imp = w >= 0.9 ? 1 : w >= 0.4 ? 0.62 : 0.36;
      const a = a0 * imp * (1 - col * col);
      F.L.poly(q, {
        rgb: w >= 0.9 ? C.VIOLET_HI : C.VIOLET, a: a * (o.alpha ?? 0.85), w: w >= 0.9 ? 1.25 : 0.9,
        to: E.outQuad(g), layer: w >= 0.9 ? 2 : 0, closed: !!ln.closed && g >= 1,
        fog: o.fog || [6, 22, 0.25],
      });
    }
  };
  drawSet(W.lines);
  if (W.anim && o.t !== undefined) {
    const extra = W.anim(o.t);
    if (extra && extra.length) drawSet(extra.map((l) => ({ ...l, d: 0 })));
  }
  if (W.dots && W.dots.length) {
    const n = W.dots.length / 3;
    const P = new Float32Array(W.dots.length);
    const g = E.outCubic(clamp((age - 0.12) / gd));
    for (let i = 0; i < n; i++) {
      let x = ox + W.dots[i * 3], y = oy + W.dots[i * 3 + 1] * g, z = oz + W.dots[i * 3 + 2];
      if (ce > 0) {
        x = lerp(x, nx, ce); y = lerp(y, ny, ce); z = lerp(z, nz, ce);
      }
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    }
    if (o.warp) o.warp(P);
    cloud(F, P, n, { rgb: PF.VIOLET_HI, e: 0.9 * a0 * g * (1 - col), size: 1.2 });
  }
}
