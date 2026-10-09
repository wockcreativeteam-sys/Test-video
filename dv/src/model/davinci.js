// Procedural da Vinci Xi patient cart (four arms), built from the reference photos:
//   * dark charcoal base tub on a white forked sled (two long legs, black bumpers, casters)
//   * slim white column with a black front panel, a white neck, the dark drum cap on top
//     ("da Vinci Xi"), a blue light ring under the boom
//   * the overhead boom: a wide white T-bar (orienting platform); four arms hang from it
//   * each arm: setup joint (drum + horizontal link) -> numbered pillar -> grey joint band ->
//     shoulder housing -> parallelogram links (blue light ring at the elbow) -> instrument spar
//     (white carriage rail with a dark slot), instrument backend on top, shaft down through the
//     cannula to the remote centre of motion
// Units: metres; origin on the floor under the column; +y up; +z forward (towards the patient);
// arms are numbered 1-4 left to right in a front view.
//
// Assembly groups (each can be hidden, offset, scan-revealed or shown as a hologram):
//   sled, base, column, head (neck + drum + boom + T-bar), arm0..arm3, ins0..ins3
import { Geo, GEO, rbox, cylinder, cylC, lathe, loft, rrect, filletProfile, sweep, bezier, superellipse, circleOutline } from '../engine/geo.js';
import { m4, cross, norm } from '../engine/m4.js';
import { MAT } from '../engine/r3.js';
import { clamp, lerp, E } from '../engine/util.js';

const PI = Math.PI;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export const DV_MAT = {
  shell: { alb: [0.86, 0.87, 0.88], rough: 0.34, metal: 0, f0: 0.04, coat: 0.55 },
  shell2: { alb: [0.74, 0.76, 0.78], rough: 0.38, metal: 0, f0: 0.04, coat: 0.4 },
  band: { alb: [0.42, 0.44, 0.47], rough: 0.42, metal: 0, f0: 0.04, coat: 0.3 },
  dark: { alb: [0.05, 0.052, 0.058], rough: 0.38, metal: 0, f0: 0.045, coat: 0.45 },
  panel: { alb: [0.018, 0.018, 0.02], rough: 0.3, metal: 0, f0: 0.045, coat: 0.6 },
  drum: { alb: [0.035, 0.036, 0.04], rough: 0.32, metal: 0, f0: 0.045, coat: 0.55 },
  base: { alb: [0.055, 0.056, 0.06], rough: 0.5, metal: 0, f0: 0.04, coat: 0.25 },
  rubber: MAT.rubber,
  steel: { alb: [0.8, 0.82, 0.85], rough: 0.22, metal: 1, f0: 0.04, coat: 0 },
  chrome: { alb: [0.92, 0.93, 0.95], rough: 0.07, metal: 1, f0: 0.04, coat: 0 },
  ledR: { alb: [0.05, 0.01, 0.01], rough: 0.3, metal: 0, f0: 0.04, coat: 0.6, emis: [1.6, 0.08, 0.06] },
  ledB: { alb: [0.02, 0.04, 0.06], rough: 0.3, metal: 0, f0: 0.04, coat: 0.6, emis: [0.2, 0.62, 1.7] },
};

function labelCanvas(txt, o = {}) {
  const c = document.createElement('canvas');
  c.width = o.w || 512;
  c.height = o.h || 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = o.color || '#c8ccd2';
  g.font = o.font || '500 64px "Inter Display"';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (o.track) g.letterSpacing = o.track + 'px';
  g.fillText(txt, c.width / 2, c.height / 2 + (o.dy || 0));
  return c;
}

// ---- dimensions -------------------------------------------------------------------------------------
const TBAR = { y: 1.76, hx: 0.6, hy: 0.1, hz: 0.12 }; // T-bar centre height, half sizes
const SET1 = 1.625, SET2 = 1.565; // setup link heights (just under the T-bar)
const PIL_TOP = 1.57, PIL_BOT = 1.29; // pillar span
const BAND = 0.06; // grey joint band at the pillar foot
const LA = 0.15, LB = 0.4; // shoulder housing link, long parallelogram link
const SPAR = 0.6; // spar length (foot to top)
const FOOT_E = 0.1; // link attachment above the spar foot
const RCM_F = 0.12; // RCM below the spar foot (cannula)
const SHAFT = 0.84; // instrument shaft length (backend to tip)
const INS_OFF = 0.034; // instrument axis in front of the spar body

// per-arm design: setup-joint mount x on the T-bar; setup link length (two equal links, folded
// when stowed); setup yaws th1/th2 [stowed, deployed]; RCM in T-bar space [stowed, deployed];
// instrument lean (x, z) [stowed, deployed]
const ARMS = [
  { mx: -0.48, LS: 0.2, th1: [PI, PI * 0.95], th2: [PI, PI * 1.58], rcm: [[-0.3, -1.14, 0.16], [-0.2, -0.8, 0.3]], lean: [[0.5, 0.06], [0.48, 0.16]], label: '1', side: -1 },
  { mx: -0.22, LS: 0.15, th1: [PI, PI * 0.92], th2: [PI, PI * 1.61], rcm: [[-0.1, -1.14, 0.17], [-0.068, -0.82, 0.34]], lean: [[0.12, 0.06], [0.2, 0.16]], label: '2', side: -1 },
  { mx: 0.22, LS: 0.15, th1: [0, PI * 0.08], th2: [PI, PI * 0.39], rcm: [[0.1, -1.14, 0.17], [0.068, -0.82, 0.34]], lean: [[-0.12, 0.06], [-0.2, 0.16]], label: '3', side: 1 },
  { mx: 0.48, LS: 0.2, th1: [0, PI * 0.05], th2: [PI, PI * 0.42], rcm: [[0.3, -1.14, 0.16], [0.2, -0.8, 0.3]], lean: [[-0.5, 0.06], [-0.48, 0.16]], label: '4', side: 1 },
];

export class DaVinci {
  constructor(R, quality = 1) {
    this.R = R;
    const q0 = GEO.q;
    GEO.q = quality;
    const M = (g) => R.mesh(g);
    const ms = (this.mesh = {});
    // ---- sled: crossbars + two long forward legs ----
    const sled = new Geo();
    for (const sx of [-1, 1]) sled.add(rbox(0.15, 0.16, 1.12, 0.045), m4.T(sx * 0.43, 0.15, 0.12));
    sled.add(rbox(0.74, 0.12, 0.13, 0.05), m4.T(0, 0.15, 0.34));
    sled.add(rbox(0.74, 0.1, 0.12, 0.04), m4.T(0, 0.14, -0.38));
    ms.sled = M(sled);
    const sledDark = new Geo();
    for (const sx of [-1, 1]) {
      sledDark.add(rbox(0.152, 0.05, 1.1, 0.02), m4.T(sx * 0.43, 0.065, 0.12));
      sledDark.add(cylinder(0.017, 0.025, { seg: 20, bevel: 0.006 }), m4.T(sx * 0.43, 0.225, 0.27));
    }
    ms.sledDark = M(sledDark);
    const wheel = lathe([[0, -0.016], [0.026, -0.017], [0.033, -0.012], [0.035, 0], [0.033, 0.012], [0.026, 0.017], [0, 0.016]], 28, { crease: 60, wireMeridians: 0 }).xf(m4.RZ(PI / 2));
    const wheels = new Geo();
    for (const sx of [-1, 1])
      for (const z of [0.6, -0.36]) {
        wheels.add(wheel, m4.T(sx * 0.43, 0.035, z));
        wheels.add(rbox(0.045, 0.03, 0.05, 0.01), m4.T(sx * 0.43, 0.06, z));
      }
    ms.wheels = M(wheels);
    // ---- base tub (charcoal) ----
    ms.base = M(
      loft(superellipse(0.36, 0.42, 3.4, 96), [[0.012, 0.13], [0, 0.15], [0.004, 0.4], [0.016, 0.5], [0.04, 0.56], [0.08, 0.59], [0.13, 0.6]], {
        scale: (y) => [1 - (y - 0.15) * 0.05, 1 - (y - 0.15) * 0.03],
        wireVerticals: 12,
      }).xf(m4.T(0, 0, -0.02))
    );
    ms.baseNotch = M(rbox(0.17, 0.11, 0.06, 0.02).xf(m4.T(0, 0.2, 0.385)));
    ms.baseSeam = M(rbox(0.006, 0.4, 0.02, 0.002).xf(m4.T(0, 0.37, 0.39)));
    // ---- column: white body, black front panel ----
    ms.col = M(rbox(0.25, 0.92, 0.26, 0.05).xf(m4.T(0, 1.02, -0.02)));
    ms.colPanel = M(rbox(0.21, 0.62, 0.02, 0.012).xf(m4.T(0, 0.9, 0.112)));
    ms.colDots = M(new Geo().add(cylinder(0.006, 0.006, { seg: 12, bevel: 0.002 }), m4.chain(m4.T(-0.02, 1.38, 0.11), m4.RX(PI / 2))).add(cylinder(0.006, 0.006, { seg: 12, bevel: 0.002 }), m4.chain(m4.T(0.02, 1.38, 0.11), m4.RX(PI / 2))));
    // ---- head: neck, drum cap, light ring, boom, T-bar ----
    ms.neck = M(loft(superellipse(0.13, 0.13, 2.6, 64), filletProfile(0.4, 0.02, 0.0, 4, 1.46), { wireVerticals: 8 }));
    ms.drum = M(loft(superellipse(0.15, 0.135, 3.0, 72), filletProfile(0.13, 0.04, 0.02, 5, 1.875), { wireVerticals: 8 }));
    ms.drumRing = M(loft(superellipse(0.135, 0.12, 2.8, 64), filletProfile(0.012, 0.004, 0.004, 2, 1.862)));
    ms.ledRing = M(rbox(0.09, 0.012, 0.012, 0.005).xf(m4.T(0, 1.64, 0.128)));
    ms.boom = M(rbox(0.22, 0.12, 0.6, 0.045).xf(m4.T(0, 1.79, 0.05)));
    // T-bar: two halves with a vented panel on the right, chamfered ends
    const tbar = new Geo();
    for (const sx of [-1, 1]) tbar.add(rbox(TBAR.hx - 0.12, TBAR.hy * 2, TBAR.hz * 2, 0.05), m4.T(sx * (0.12 + (TBAR.hx - 0.12) / 2), 0, 0));
    tbar.add(rbox(0.32, TBAR.hy * 2 - 0.02, TBAR.hz * 2 - 0.02, 0.04), m4.T(0, 0, 0));
    for (const sx of [-1, 1]) tbar.add(rbox(0.1, TBAR.hy * 2 - 0.04, TBAR.hz * 2 + 0.01, 0.045), m4.T(sx * (TBAR.hx - 0.05), -0.008, 0));
    ms.tbar = M(tbar);
    const vent = new Geo();
    for (let i = 0; i < 7; i++) vent.add(rbox(0.008, 0.11, 0.012, 0.003), m4.T(0.3 + i * 0.022, 0, TBAR.hz + 0.004));
    vent.add(rbox(0.2, 0.012, 0.012, 0.004), m4.T(0.366, -0.075, TBAR.hz + 0.004));
    ms.vent = M(vent);
    ms.tbarSeam = M(new Geo().add(rbox(0.006, TBAR.hy * 2 + 0.004, TBAR.hz * 2 + 0.004, 0.002), m4.T(-0.16, 0, 0)).add(rbox(0.006, TBAR.hy * 2 + 0.004, TBAR.hz * 2 + 0.004, 0.002), m4.T(0.16, 0, 0)));
    // ---- arms ----
    this.arm = ARMS.map((A) => {
      const a = {};
      a.mount = M(cylinder(0.058, 0.07, { seg: 40, bevel: 0.015 }));
      a.setup = M(link(A.LS, 0.118, 0.055, 0.027));
      a.j2 = M(cylinder(0.056, 0.12, { seg: 40, bevel: 0.015 }));
      a.pillar = M(loft(superellipse(0.062, 0.064, 2.6, 48), filletProfile(PIL_TOP - PIL_BOT, 0.02, 0.0, 3, 0), { wireVerticals: 6 }));
      a.band = M(loft(superellipse(0.0625, 0.0645, 2.6, 48), [[0, 0], [0, BAND]], { wireVerticals: 4 }));
      a.foot = M(loft(superellipse(0.062, 0.064, 2.6, 48), filletProfile(0.06, 0.0, 0.02, 3, 0), { wireVerticals: 4 }));
      a.shoulder = M(cylC(0.07, 0.13, { seg: 40, bevel: 0.025 }));
      a.la = M(armLink(LA, 0.12, 0.1));
      a.knee = M(cylC(0.062, 0.12, { seg: 40, bevel: 0.022 }));
      a.lb = M(armLink(LB, 0.11, 0.085));
      a.lb2 = M(armLink(LB, 0.05, 0.03));
      a.elbow = M(cylC(0.056, 0.105, { seg: 40, bevel: 0.022 }));
      a.ledRing = M(lathe([[0.034, 0], [0.044, 0], [0.044, 0.0035], [0.034, 0.0035]], 40, { crease: 60, wireMeridians: 0, wireRings: false }));
      a.spar = M(sparGeo());
      a.slot = M(rbox(0.016, SPAR * 0.8, 0.008, 0.003));
      a.mountClamp = M(rbox(0.06, 0.05, 0.05, 0.012));
      a.label = R.decal(labelCanvas(A.label, { w: 128, h: 128, font: '500 92px "Inter Display"' }), 0.034, 0.034);
      return a;
    });
    this.ins = {
      housing: M(insHousing()),
      top: M(rbox(0.05, 0.02, 0.036, 0.006).xf(m4.T(0, 0.135, 0))),
      shaft: M(cylinder(0.0042, SHAFT, { seg: 20, bevel: 0.001, wireMeridians: 2 })),
      cannula: M(lathe([[0, 0], [0.0062, 0], [0.0062, 0.17], [0.0095, 0.175], [0.0095, 0.205], [0, 0.205]], 24)),
      tip: M(cylinder(0.0046, 0.014, { seg: 20, bevel: 0.0015 })),
    };
    this.wrist = buildWrist(R);
    this.cable = M(sweep(bezier([0, 0, 0], [0, 0.2, 0.0], [-0.06, 0.32, -0.12], [-0.1, 0.12, -0.3], 30), circleOutline(0.0065, 12), { wireEvery: 6 }));
    this.topLabel = R.decal(labelCanvas('da Vinci X', { w: 1024, h: 160, font: '400 90px "Inter Display"', color: '#ffffff', track: 2 }), 0.17, 0.0266);
    this.state = defaultState();
    GEO.q = q0;
  }

  /** full pose -> list of parts { mesh, M, mat, group } (decals: { decal, M, tint }) */
  pose(st = this.state) {
    const out = [];
    const put = (mesh, M, mat, group) => out.push({ mesh, M, mat, group });
    const root = st.root || m4.ident();
    const g = (name) => {
      const o = st.offset && st.offset[name];
      return o ? m4.mul(m4.T(o[0], o[1], o[2]), root) : root;
    };
    const ms = this.mesh;
    const Gs = g('sled');
    put(ms.sled, Gs, DV_MAT.shell, 'sled');
    put(ms.sledDark, Gs, DV_MAT.dark, 'sled');
    put(ms.wheels, Gs, DV_MAT.rubber, 'sled');
    const Gb = g('base');
    put(ms.base, Gb, DV_MAT.base, 'base');
    put(ms.baseNotch, Gb, DV_MAT.panel, 'base');
    put(ms.baseSeam, Gb, DV_MAT.panel, 'base');
    const Gc = g('column');
    put(ms.col, Gc, DV_MAT.shell, 'column');
    put(ms.colPanel, Gc, DV_MAT.panel, 'column');
    put(ms.colDots, Gc, DV_MAT.dark, 'column');
    // head (rises with the column's telescope)
    const Gh = m4.mul(g('head'), m4.T(0, st.lift || 0, 0));
    put(ms.neck, Gh, DV_MAT.shell, 'head');
    put(ms.drum, Gh, DV_MAT.drum, 'head');
    put(ms.drumRing, Gh, DV_MAT.band, 'head');
    put(ms.ledRing, Gh, st.leds ? { ...DV_MAT.ledB, emis: mul(DV_MAT.ledB.emis, st.ledGain ?? 1) } : DV_MAT.dark, 'head');
    out.push({ decal: this.topLabel, M: m4.mul(Gh, m4.T(0, 1.94, 0.137)), group: 'head', tint: [0.62, 0.64, 0.68, 1] });
    // boom: yaw about the column axis, extension forward
    const ext = st.boomExt || 0;
    const B = m4.chain(Gh, m4.RY(st.boomYaw || 0));
    if (ext > 0.001) put(ms.boom, m4.mul(B, m4.T(0, 0, ext * 0.5 - 0.05)), DV_MAT.shell, 'head');
    const P = m4.chain(B, m4.T(0, TBAR.y, ext), m4.RY(st.platYaw || 0));
    this.platM = P;
    put(ms.tbar, P, DV_MAT.shell, 'head');
    put(ms.vent, P, DV_MAT.band, 'head');
    put(ms.tbarSeam, P, DV_MAT.band, 'head');
    this.armPose = [];
    ARMS.forEach((A, k) => {
      const o = st.offset && st.offset['arm' + k];
      const Pa = o ? m4.mul(m4.T(o[0], o[1], o[2]), P) : P;
      const ap = this._arm(k, A, st, Pa, put, 'arm' + k);
      this.armPose.push(ap);
      const ins = st.insert[k];
      if (ins !== null && ins !== undefined) {
        const oi = st.offset && st.offset['ins' + k];
        this._instrument(k, ap, ins, st, put, 'ins' + k, oi);
      }
    });
    return out;
  }

  _arm(k, A, st, P, put, ag) {
    const a = this.arm[k];
    const d = E.inOutCubic(clamp(st.deploy[k]));
    const W = (p) => m4.apply(P, p);
    const yP = TBAR.y;
    // setup arm: drum under the T-bar, two links (folded flat when stowed) swing the pillar out
    const th1 = lerp(A.th1[0], A.th1[1], d) + (st.setupYaw ? st.setupYaw[k] : 0);
    const th2 = lerp(A.th2[0], A.th2[1], d);
    const dir = (t) => [Math.cos(t), 0, Math.sin(t)];
    const mount = [A.mx, 0, 0];
    const j2 = add(mount, mul(dir(th1), A.LS));
    const pil = add(j2, mul(dir(th1 + th2), A.LS));
    const y1 = SET1 - yP, y2 = SET2 - yP;
    put(a.mount, m4.mul(P, m4.T(mount[0], y1 - 0.005, mount[2])), DV_MAT.shell, ag);
    put(a.setup, m4.chain(P, m4.T(mount[0], y1, mount[2]), m4.RY(-th1)), DV_MAT.shell, ag);
    put(a.j2, m4.mul(P, m4.T(j2[0], y2 - 0.035, j2[2])), DV_MAT.shell, ag);
    put(a.setup, m4.chain(P, m4.T(j2[0], y2, j2[2]), m4.RY(-(th1 + th2))), DV_MAT.shell, ag);
    // pillar (rotates about its own axis: yaw of the manipulator)
    const pyaw = lerp(0, A.side * -0.25, d) + (st.pillarYaw ? st.pillarYaw[k] : 0);
    const Pp = m4.chain(P, m4.T(pil[0], 0, pil[2]), m4.RY(pyaw));
    const yb = PIL_BOT - yP;
    put(a.pillar, m4.mul(Pp, m4.T(0, yb, 0)), DV_MAT.shell, ag);
    put(a.band, m4.mul(Pp, m4.T(0, yb - BAND, 0)), DV_MAT.band, ag);
    put(a.foot, m4.mul(Pp, m4.T(0, yb - BAND - 0.06, 0)), DV_MAT.shell, ag);
    const lab = m4.mul(Pp, m4.T(0, PIL_TOP - yP - 0.075, 0.0645));
    // ---- manipulator: shoulder S, knee K, elbow E on the spar; spar through the RCM ----
    const S = W([pil[0], yb - BAND - 0.07, pil[2]]);
    const C0 = m4.apply(P, mix(A.rcm[0], A.rcm[1], d)); // RCM in T-bar space
    const C = st.rcmOff ? add(C0, st.rcmOff[k]) : C0;
    const ln = mix(A.lean[0], A.lean[1], d);
    const lx = ln[0] + (st.lean ? st.lean[k][0] : 0), lz = ln[1] + (st.lean ? st.lean[k][1] : 0);
    const ax = norm(m4.dir(P, [Math.sin(lx), -1, Math.sin(lz)])); // instrument axis, pointing down
    const up = mul(ax, -1);
    // spar frame: x in the lateral plane, z = front (towards +z, away from the column)
    let fz = m4.dir(P, [0, 0, 1]);
    let sx = norm(cross(up, fz));
    const sz = norm(cross(sx, up));
    const Fp = sub(C, mul(ax, RCM_F)); // spar foot (on the instrument axis)
    const body = mul(sz, -INS_OFF); // spar body behind the instrument axis
    const Ep = add(add(Fp, mul(up, FOOT_E)), mul(sz, -INS_OFF - 0.02)); // link attachment behind the spar
    // knee: two-circle IK in the plane of S, E and up, bending up/outward
    const dSE = sub(Ep, S);
    const D = clamp(len(dSE), LB - LA + 1e-3, LA + LB - 1e-3);
    const dn = norm(dSE);
    const ca = clamp((LA * LA + D * D - LB * LB) / (2 * LA * D), -1, 1);
    const sa = Math.sqrt(1 - ca * ca);
    const outv = norm(add([0, 0.6, 0], mul(m4.dir(P, [A.side, 0, 0]), 0.8)));
    let perp = sub(outv, mul(dn, dot(outv, dn)));
    perp = norm(perp);
    const K = add(S, add(mul(dn, ca * LA), mul(perp, sa * LA)));
    const pn = norm(cross(dn, perp));
    const jb = (o) => m4.basis(perp, pn, cross(perp, pn), o);
    put(a.shoulder, jb(S), DV_MAT.shell, ag);
    put(a.la, linkM(S, K, pn), DV_MAT.shell, ag);
    put(a.knee, jb(K), DV_MAT.shell, ag);
    const lg = (st.ledGain ?? 1) * (st.armLed ? st.armLed[k] : 1);
    const led = st.leds && lg > 0.001 ? { ...DV_MAT.ledB, emis: mul(DV_MAT.ledB.emis, lg) } : DV_MAT.band;
    for (const s2 of [-1, 1]) put(a.ledRing, m4.chain(jb(K), m4.T(0, s2 * 0.0595 - (s2 < 0 ? 0.0035 : 0), 0)), led, ag);
    put(a.lb, linkM(K, Ep, pn), DV_MAT.shell, ag);
    // the thin parallel link of the parallelogram, offset towards the spar side
    const off = mul(perp, -0.075);
    put(a.lb2, linkM(add(K, off), add(Ep, off), pn), DV_MAT.shell2, ag);
    put(a.elbow, jb(Ep), DV_MAT.shell, ag);
    for (const s2 of [-1, 1]) put(a.ledRing, m4.chain(jb(Ep), m4.T(0, s2 * 0.052 - (s2 < 0 ? 0.0035 : 0), 0)), led, ag);
    // spar
    const Sp = m4.basis(sx, up, sz, add(Fp, body));
    put(a.spar, Sp, DV_MAT.shell, ag);
    put(a.slot, m4.mul(Sp, m4.T(0, SPAR * 0.52, 0.0175)), DV_MAT.panel, ag);
    put(a.mountClamp, m4.mul(Sp, m4.T(0, 0.02, INS_OFF * 0.6)), DV_MAT.dark, ag);
    put(this.ins.cannula, m4.basis(sx, up, sz, add(C, mul(up, -0.05))), DV_MAT.steel, ag);
    return { S, K, E: Ep, F: Fp, C, ax, up, sx, sz, lab, top: add(Fp, mul(up, SPAR)) };
  }

  _instrument(k, ap, ins, st, put, ig, o) {
    const I = this.ins;
    // insertion 1: seated (backend at the top of the spar, tip 0.12 m past the RCM); 0: lifted clear
    const travel = (1 - clamp(ins)) * 0.45;
    const off = o || [0, 0, 0];
    const frame = (p) => m4.basis(ap.sx, ap.up, ap.sz, add(p, off));
    const hb = add(ap.F, mul(ap.up, SPAR - 0.14 + travel));
    put(I.housing, frame(hb), DV_MAT.shell2, ig);
    put(I.top, frame(hb), DV_MAT.dark, ig);
    const tip = add(hb, mul(ap.up, -SHAFT));
    put(I.shaft, frame(tip), DV_MAT.steel, ig);
    put(I.tip, frame(add(tip, mul(ap.up, -0.014))), DV_MAT.dark, ig);
    ap.tip = add(tip, off);
    ap.housing = add(hb, off);
    if (k === 2 && st.cable) put(this.cable, frame(add(hb, mul(ap.up, 0.15))), DV_MAT.panel, ig);
  }

  /** queue the robot. o: { hide:{group:true}, clip:{group:{plane,band,rgb}}, holo:{group:{rgb,a,solid}}, wire:{group:{rgb,a}}, matFn } */
  draw(R, st = this.state, o = {}) {
    const parts = this.pose(st);
    for (const p of parts) {
      if (o.hide && o.hide[p.group]) continue;
      const clip = o.clip && o.clip[p.group];
      if (p.decal) {
        R.addDecal(p.decal, p.M, { tint: p.tint, clip });
        continue;
      }
      if (o.holo && o.holo[p.group]) {
        const h = o.holo[p.group];
        R.addHolo(p.mesh, p.M, { ...h, clip: h.clip || clip });
        if (o.wire && o.wire[p.group]) R.addWire(p.mesh, p.M, o.wire[p.group]);
        if (h.solid !== true) continue;
      }
      let mat = p.mat;
      if (o.matFn) mat = o.matFn(p, mat) || mat;
      if (clip) mat = { ...mat, clip };
      R.add(p.mesh, p.M, mat);
      if (o.wire && o.wire[p.group] && !(o.holo && o.holo[p.group])) R.addWire(p.mesh, p.M, o.wire[p.group]);
    }
    this.armPose.forEach((ap, k) => {
      if (o.hide && o.hide['arm' + k]) return;
      if (o.holo && o.holo['arm' + k] && o.holo['arm' + k].solid !== true) return;
      R.addDecal(this.arm[k].label, ap.lab, { tint: [0.14, 0.15, 0.17, 1], clip: o.clip && o.clip['arm' + k] });
    });
    return parts;
  }
}

export function defaultState() {
  return {
    root: m4.ident(),
    offset: {},
    lift: 0,
    boomYaw: 0,
    boomExt: 0.32,
    platYaw: 0,
    deploy: [1, 1, 1, 1],
    insert: [1, 1, 1, 1],
    leds: true,
    cable: true,
  };
}
export function stowedState() {
  const s = defaultState();
  s.boomExt = 0;
  s.deploy = [0, 0, 0, 0];
  return s;
}

// ---- part geometry -------------------------------------------------------------------------------
function link(L, w, h, r) {
  return rbox(L + w, h, w, r).xf(m4.T(L / 2, 0, 0));
}
/** arm housing along local +x from 0..L (local y = joint axis), slightly waisted */
function armLink(L, w, h) {
  const path = [];
  const n = Math.max(4, Math.round(16 * GEO.q));
  for (let i = 0; i <= n; i++) path.push([(i / n) * L, 0, 0]);
  return sweep(path, rrect(h / 2, w / 2, Math.min(w, h) * 0.45, 5), {
    up: [0, 0, 1],
    scale: (u) => [1 - 0.1 * Math.sin(PI * u), 1 - 0.12 * Math.sin(PI * u)],
  });
}
function linkM(a, b, n) {
  const x = norm(sub(b, a));
  const z = norm(cross(x, n));
  const y = cross(z, x);
  return m4.basis(x, y, z, a);
}
/** the spar: carriage rail along +y (0..SPAR), its slot face towards +z */
function sparGeo() {
  const g = new Geo();
  const w = 0.064, d = 0.03;
  g.add(rbox(w, SPAR, d, 0.012), m4.T(0, SPAR / 2, 0));
  g.add(rbox(w + 0.012, 0.075, d + 0.026, 0.018), m4.T(0, 0.04, -0.006));
  g.add(rbox(w + 0.008, 0.06, d + 0.018, 0.016), m4.T(0, SPAR - 0.03, -0.004));
  return g;
}
function insHousing() {
  const g = new Geo();
  g.add(rbox(0.06, 0.13, 0.044, 0.012), m4.T(0, 0.065, 0));
  return g;
}

/** EndoWrist-style wrist + jaws for macro shots, 8 mm shaft, 1:1 scale */
function buildWrist(R) {
  const M = (g) => R.mesh(g);
  const r = 0.0042;
  const w = {};
  w.shaft = M(lathe([[0, -0.12], [r, -0.12], [r, 0], [r * 0.98, 0.0012], [0, 0.0012]], 48, { wireMeridians: 4 }));
  w.sleeve = M(lathe([[0, -0.02], [r * 1.02, -0.02], [r * 1.02, 0.0005], [0, 0.0005]], 48));
  const clev = new Geo();
  clev.add(lathe([[0, 0], [r, 0], [r * 0.95, 0.003], [r * 0.7, 0.0045], [0, 0.0045]], 40));
  for (const s of [-1, 1]) clev.add(rbox(0.0022, 0.0062, 0.0062, 0.0011), m4.T(s * 0.0026, 0.0068, 0));
  w.clev1 = M(clev);
  w.pin = M(cylC(0.0011, 0.0075, { seg: 20, bevel: 0.0003 }).xf(m4.RZ(PI / 2)));
  const l2 = new Geo();
  l2.add(rbox(0.0028, 0.0062, 0.0058, 0.0013), m4.T(0, 0.0012, 0));
  l2.add(lathe([[0, 0.003], [r * 0.85, 0.003], [r * 0.85, 0.0055], [0, 0.0055]], 40));
  for (const s of [-1, 1]) l2.add(rbox(0.0058, 0.0056, 0.0021, 0.001), m4.T(0, 0.0078, s * 0.0024));
  w.link2 = M(l2);
  const jaw = (side) => {
    const g = new Geo();
    const path = [];
    for (let i = 0; i <= 20; i++) path.push([0, (i / 20) * 0.017, 0]);
    g.add(sweep(path, rrect(0.0012, 0.0019, 0.0009, 3), { up: [1, 0, 0], scale: (u) => [1 - 0.55 * u, 1 - 0.35 * u] }));
    for (let i = 0; i < 9; i++) g.add(rbox(0.0028 * (1 - i * 0.05), 0.0006, 0.0006, 0.00025), m4.T(0, 0.004 + i * 0.0014, side * 0.0011 * (1 - i * 0.04)));
    return g;
  };
  w.jawA = M(jaw(1));
  w.jawB = M(jaw(-1));
  return w;
}

/** wrist pose: pitch (about x at pivot 1), yaw (about z at pivot 2), jaw opening (rad) */
export function drawWrist(R, dv, M0, o = {}) {
  const w = dv.wrist;
  const S = DV_MAT.steel, D = { ...DV_MAT.dark, rough: 0.3 };
  const clip = o.clip;
  const m = (mat) => (clip ? { ...mat, clip } : mat);
  const parts = [];
  const add2 = (mesh, M, mat) => parts.push({ mesh, M, mat });
  add2(w.shaft, M0, S);
  add2(w.sleeve, m4.mul(M0, m4.T(0, -0.003, 0)), D);
  add2(w.clev1, M0, S);
  const P1 = m4.chain(M0, m4.T(0, 0.0068, 0), m4.RX(o.pitch || 0));
  add2(w.pin, m4.mul(M0, m4.T(0, 0.0068, 0)), DV_MAT.chrome);
  add2(w.link2, P1, S);
  const P2 = m4.chain(P1, m4.T(0, 0.0078, 0), m4.RZ(o.yaw || 0));
  add2(w.pin, m4.chain(P1, m4.T(0, 0.0078, 0), m4.RX(PI / 2)), DV_MAT.chrome);
  const op = (o.open || 0) / 2;
  add2(w.jawA, m4.mul(P2, m4.RZ(op)), D);
  add2(w.jawB, m4.mul(P2, m4.RZ(-op)), S);
  for (const p of parts) {
    if (o.holo) R.addHolo(p.mesh, p.M, { ...o.holo, clip: o.holo.clip });
    if (o.wire) R.addWire(p.mesh, p.M, o.wire);
    if (!o.holoOnly) R.add(p.mesh, p.M, m(p.mat));
  }
  return parts;
}
