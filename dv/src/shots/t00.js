// dev: renderer test scene (primitives on a glossy floor under studio light)
import { rbox, cylinder, lathe, plane, sweep, rrect, bezier, torus } from '../engine/geo.js';
import { m4 } from '../engine/m4.js';
import { MAT } from '../engine/r3.js';

let M = null;
export function init(F) {
  const R = F.R;
  M = {
    floor: R.mesh(plane(40, 40)),
    box: R.mesh(rbox(0.6, 0.4, 0.5, 0.06)),
    cyl: R.mesh(cylinder(0.18, 0.7, { bevel: 0.02 })),
    vase: R.mesh(lathe([[0, 0], [0.2, 0], [0.24, 0.1], [0.12, 0.4], [0.16, 0.6], [0, 0.62]], 64)),
    tor: R.mesh(torus(0.25, 0.06)),
    tube: R.mesh(sweep(bezier([0, 0, 0], [0, 0.6, 0], [0.5, 0.8, 0], [0.8, 0.3, 0.2]), rrect(0.05, 0.03, 0.02, 4))),
  };
}
export function draw(F, lt, t) {
  const yaw = t * 0.4;
  const tgt = [0, 0.35, 0];
  F.cam.set([Math.sin(yaw) * 3.2, 1.3, Math.cos(yaw) * 3.2], tgt, 32);
  const R = F.scene({
    time: t,
    lights: [
      { dir: [-0.5, 0.8, 0.45], rgb: [2.2, 2.15, 2.1] },
      { dir: [0.7, 0.3, 0.4], rgb: [0.35, 0.4, 0.5] },
      { dir: [0.1, 0.4, -1], rgb: [0.9, 1.1, 1.3] },
    ],
    key: { shadow: true, dir: [0.5, -0.8, -0.45], center: [0, 0.4, 0], ext: 2.2, depth: 6, soft: 2.5 },
    skyAO: { center: [0, 1, 0], ext: 3, depth: 5, radius: 0.25, amount: 0.9 },
    boxes: [
      { dir: [-0.5, 0.8, 0.45], size: [0.5, 0.25], rgb: [3, 3, 3] },
      { dir: [0.1, 0.5, -1], size: [0.9, 0.05], rgb: [1.5, 1.8, 2.2] },
      { dir: [0.9, 0.2, 0.3], size: [0.06, 0.6], rgb: [1.4, 1.5, 1.6] },
    ],
    sky: [0.03, 0.035, 0.045], ground: [0.004, 0.004, 0.005], amb: 0.6,
    fogRgb: [0.01, 0.012, 0.016], fog: 0.04, reflect: true, exposure: 1.0,
  });
  R.add(M.floor, m4.ident(), { alb: [0.02, 0.021, 0.024], rough: 0.2, floor: true, reflStr: 0.8, reflBlur: 5, grid: [0.5, 1.0, 0.25, 0.25], gridRgb: [0.2, 0.7, 0.9] });
  R.add(M.box, m4.T(-0.8, 0.2, 0), MAT.white);
  R.add(M.cyl, m4.T(0, 0, -0.5), MAT.black);
  R.add(M.vase, m4.T(0.7, 0, 0.2), MAT.steel);
  R.add(M.tor, m4.chain(m4.T(0, 0.3, 0.6), m4.RX(1.2)), MAT.chrome);
  R.add(M.tube, m4.T(-0.2, 0, 0.2), { ...MAT.white, emis: [0, 0, 0] });
  R.addWire(M.box, m4.T(-0.8, 0.2, 0), { rgb: [0.3, 0.9, 1], a: 0.5 });
  R.addBeam([0.8, 1.6, 0.2], [0.7, 0.0, 0.2], 0.01, 0.01, [0.5, 1.4, 1.8], 1);
}
