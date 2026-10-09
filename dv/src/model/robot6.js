// Industrial 6-axis assembly robot (graphite, cyan joint rings) with a simple analytic IK:
// base yaw -> shoulder/elbow (2-link planar) -> wrist pitch keeps the tool on a given direction.
// Tools: 'grip' (two fingers), 'driver' (torque spindle), 'scan' (laser head).
import { Geo, rbox, cylinder, cylC, lathe, loft, superellipse, filletProfile, sweep, rrect } from '../engine/geo.js';
import { m4, cross, norm } from '../engine/m4.js';
import { clamp } from '../engine/util.js';

const PI = Math.PI;
export const R6_MAT = {
  body: { alb: [0.075, 0.08, 0.088], rough: 0.36, metal: 0, f0: 0.05, coat: 0.6 },
  dark: { alb: [0.025, 0.026, 0.03], rough: 0.5, metal: 0, f0: 0.04, coat: 0.2 },
  steel: { alb: [0.75, 0.77, 0.8], rough: 0.25, metal: 1, f0: 0.04, coat: 0 },
  accent: { alb: [0.8, 0.82, 0.84], rough: 0.35, metal: 0, f0: 0.04, coat: 0.4 },
  ring: { alb: [0.02, 0.05, 0.06], rough: 0.3, metal: 0, f0: 0.04, coat: 0.5, emis: [0.25, 1.1, 1.5] },
};
const H0 = 0.52; // shoulder height
const L1 = 0.78, L2 = 0.7; // upper arm, forearm (to wrist centre)
const LW = 0.16; // wrist centre -> flange

export class Robot6 {
  constructor(R, tool = 'grip') {
    const M = (g) => R.mesh(g);
    this.tool = tool;
    this.m = {
      base: M(loft(superellipse(0.26, 0.26, 2.2, 48), filletProfile(0.1, 0.03, 0.0, 3, 0))),
      turret: M(lathe([[0, 0], [0.2, 0], [0.2, 0.18], [0.16, 0.26], [0, 0.26]], 40)),
      shoulder: M(cylC(0.15, 0.3, { seg: 40, bevel: 0.04 }).xf(m4.RZ(PI / 2))),
      upper: M(armSeg(L1, 0.2, 0.15)),
      elbow: M(cylC(0.115, 0.24, { seg: 36, bevel: 0.03 }).xf(m4.RZ(PI / 2))),
      fore: M(foreSeg(L2)),
      wrist: M(cylC(0.07, 0.15, { seg: 32, bevel: 0.02 }).xf(m4.RZ(PI / 2))),
      flange: M(cylinder(0.05, 0.05, { seg: 28, bevel: 0.01 })),
      ring: M(lathe([[0.122, 0], [0.152, 0], [0.152, 0.008], [0.122, 0.008]], 40, { crease: 60, wireRings: false, wireMeridians: 0 }).xf(m4.RZ(PI / 2))),
      ringS: M(lathe([[0.06, 0], [0.072, 0], [0.072, 0.006], [0.06, 0.006]], 32, { crease: 60, wireRings: false, wireMeridians: 0 }).xf(m4.RZ(PI / 2))),
      ringT: M(lathe([[0.2, 0], [0.205, 0], [0.205, 0.012], [0.2, 0.012]], 48, { crease: 60, wireRings: false, wireMeridians: 0 })),
    };
    // tools (along local +y from the flange, pointing "out")
    const tl = new Geo();
    if (tool === 'grip') {
      tl.add(rbox(0.12, 0.05, 0.08, 0.015), m4.T(0, 0.075, 0));
      this.finger = M(rbox(0.018, 0.09, 0.05, 0.006).xf(m4.T(0, 0.045, 0)));
      this.toolLen = 0.19;
    } else if (tool === 'driver') {
      tl.add(lathe([[0, 0], [0.05, 0], [0.05, 0.12], [0.03, 0.15], [0, 0.15]], 28), m4.T(0, 0.05, 0));
      this.bit = M(lathe([[0, 0], [0.012, 0], [0.012, 0.07], [0.006, 0.09], [0, 0.09]], 16));
      this.toolLen = 0.29;
    } else {
      tl.add(rbox(0.16, 0.08, 0.1, 0.02), m4.T(0, 0.09, 0));
      this.lens = M(rbox(0.12, 0.012, 0.03, 0.005).xf(m4.T(0, 0.135, 0)));
      this.toolLen = 0.14;
    }
    this.m.tool = M(tl);
  }

  /** IK: base matrix B (on the floor), world target p, tool direction d (unit, where the tool points) */
  solve(B, p, d, o = {}) {
    const Bi = m4.invRigid(B);
    const pl = m4.apply(Bi, p);
    const dl = norm(m4.dir(Bi, d));
    const w = [pl[0] - dl[0] * (LW + this.toolLen), pl[1] - dl[1] * (LW + this.toolLen), pl[2] - dl[2] * (LW + this.toolLen)];
    const yaw = Math.atan2(w[0], w[2]);
    const r = Math.hypot(w[0], w[2]);
    const h = w[1] - H0;
    const D = clamp(Math.hypot(r, h), 0.15, L1 + L2 - 1e-3);
    const a = Math.atan2(h, r);
    const c2 = clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1);
    const sh = a + Math.acos(c2); // shoulder elevation (elbow up)
    const ce = clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1);
    const el = PI - Math.acos(ce); // elbow bend
    // tool direction in the arm plane -> wrist pitch; out-of-plane part -> wrist yaw
    const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
    const side = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const dPlane = [dl[0] * fwd[0] + dl[2] * fwd[2], dl[1]];
    const toolAng = Math.atan2(dPlane[1], dPlane[0]); // elevation of the tool in the plane
    const foreAng = sh - el;
    const pitch = toolAng - foreAng;
    const ys = Math.asin(clamp(dl[0] * side[0] + dl[2] * side[2], -1, 1));
    return { yaw, sh, el, pitch, wyaw: ys, roll: o.roll || 0, grip: o.grip ?? 0.5 };
  }

  /** queue the robot: B base matrix, q joint state (from solve), o: { glow (0..1), mat } */
  draw(R, B, q, o = {}) {
    const m = this.m;
    const body = o.mat || R6_MAT.body;
    const ring = { ...R6_MAT.ring, emis: R6_MAT.ring.emis.map((v) => v * (o.glow ?? 1)) };
    R.add(m.base, B, R6_MAT.dark);
    const T1 = m4.mul(B, m4.RY(q.yaw));
    R.add(m.ringT, m4.mul(T1, m4.T(0, 0.1, 0)), ring);
    R.add(m.turret, m4.mul(T1, m4.T(0, 0.1, 0)), body);
    const S = m4.chain(T1, m4.T(0, H0, 0), m4.RX(-q.sh)); // upper arm along local +z after pitch
    R.add(m.shoulder, S, body);
    R.add(m.ring, m4.mul(S, m4.T(0.152, 0, 0)), ring);
    R.add(m.upper, S, body);
    const El = m4.chain(S, m4.T(0, 0, L1), m4.RX(q.el));
    R.add(m.elbow, El, body);
    R.add(m.ring, m4.mul(El, m4.T(0.122, 0, 0)), ring);
    R.add(m.fore, El, body);
    const Wr = m4.chain(El, m4.T(0, 0, L2), m4.RX(-q.pitch), m4.RY(q.wyaw));
    R.add(m.wrist, Wr, R6_MAT.accent);
    R.add(m.ringS, m4.mul(Wr, m4.T(0.075, 0, 0)), ring);
    // flange / tool point along local +z
    const Fl = m4.chain(Wr, m4.T(0, 0, LW - 0.05), m4.RX(PI / 2), m4.RY(q.roll));
    R.add(m.flange, Fl, R6_MAT.steel);
    const Tl = m4.mul(Fl, m4.T(0, 0.05, 0));
    R.add(m.tool, Tl, R6_MAT.dark);
    if (this.finger) {
      const g = 0.012 + 0.03 * clamp(q.grip);
      R.add(this.finger, m4.mul(Tl, m4.T(-g, 0.1, 0)), R6_MAT.steel);
      R.add(this.finger, m4.mul(Tl, m4.T(g, 0.1, 0)), R6_MAT.steel);
    }
    if (this.bit) R.add(this.bit, m4.chain(Tl, m4.T(0, 0.2, 0), m4.RY(q.spin || 0)), R6_MAT.steel);
    if (this.lens) R.add(this.lens, Tl, { ...R6_MAT.dark, emis: [0.4 * (o.glow ?? 1), 1.4 * (o.glow ?? 1), 1.8 * (o.glow ?? 1)] });
    this.tip = m4.apply(Tl, [0, this.toolLen, 0]);
    this.flangeM = Tl;
    return this.tip;
  }
}

/** upper arm: a tapered box along +z (0..L) */
function armSeg(L, w, h) {
  const path = [];
  for (let i = 0; i <= 8; i++) path.push([0, 0, (i / 8) * L]);
  return sweep(path, rrect(w / 2, h / 2, Math.min(w, h) * 0.3, 3), { up: [0, 1, 0], scale: (u) => [1 - 0.25 * u, 1 - 0.2 * u] });
}
function foreSeg(L) {
  const path = [];
  for (let i = 0; i <= 8; i++) path.push([0, 0, (i / 8) * L]);
  return sweep(path, rrect(0.075, 0.07, 0.04, 3), { up: [0, 1, 0], scale: (u) => [1 - 0.35 * u, 1 - 0.3 * u] });
}
