// SHOT 02 — STATION 01 · MOBILE BASE (4.0 – 8.0 s)
// The pallet glides in and locks (pneumatic clamps on the beat); a torque driver seats the fixings;
// a laser welder stitches the seam (sparks on the beat); a laser sheet sweeps up the base and
// leaves a cyan point-cloud twin behind it. The column waits overhead.
import { m4 } from '../engine/m4.js';
import { rbox } from '../engine/geo.js';
import { clamp, lerp, E } from '../engine/util.js';
import { hallScene, drawHall, drawCarriage } from '../model/sets.js';
import { W, initWorld, pallet, stowedState, sparks, puff, baseContour, basePoints, SET_MAT } from './world.js';
import { mono, tag, header, frameHUD, u01, pulse, check, hline, proj } from './hud.js';
import { C } from '../palette.js';
import { glowDot } from '../engine/lines.js';

let clampM = null;
export function init(F) {
  initWorld(F);
  clampM = F.R.mesh(rbox(0.5, 0.12, 0.16, 0.02));
}

const KNOB = [0.43, 0.08 + 0.225, 0.27];
const SEAM = [-0.36, 0.08 + 0.2, 0.12];

export function draw(F, lt, t) {
  initWorld(F);
  // pallet travel: glides in, decelerates, locks at 4.5 with a small settle
  const px = t < 4.5 ? -5.5 * Math.pow(1 - u01(t, 4.0, 4.5), 2.6) : 0.015 * Math.sin((t - 4.5) * 40) * Math.exp(-(t - 4.5) * 12);
  const root = [px, 0.08, 0];
  const shake = t > 4.5 ? 0.004 * Math.exp(-(t - 4.5) * 14) * Math.sin(t * 90) : 0;
  // ---- cameras ----
  let lit = 1;
  if (t < 5.0) {
    const u = u01(t, 4.0, 5.0);
    F.cam.set([px * 0.3 + lerp(3.6, 3.3, u), 0.95 + shake, lerp(3.4, 3.15, u)], [px * 0.85 - 0.2, 0.38 + shake, 0], 30);
  } else if (t < 5.75) {
    const u = u01(t, 5.0, 5.75);
    F.cam.set([lerp(1.05, 0.98, u), lerp(0.95, 0.9, u), lerp(1.3, 1.22, u)], [0.4, 0.36, 0.25], 30);
  } else if (t < 6.4) {
    const u = u01(t, 5.75, 6.4);
    F.cam.set([lerp(-1.05, -0.98, u), lerp(0.92, 0.86, u), lerp(1.2, 1.12, u)], [-0.34, 0.32, 0.12], 30);
  } else {
    const u = E.inOutSine(u01(t, 6.4, 8.0));
    F.cam.set([lerp(3.3, 2.7, u), lerp(1.9, 2.35, u), lerp(3.6, 3.0, u)], [0, lerp(0.45, 0.75, u), 0], lerp(33, 35, u));
  }
  const weldOn = t > 5.85 && t < 6.25;
  const weldP = [SEAM[0] + (t - 5.85) * 0.12, SEAM[1], SEAM[2]];
  const flick = weldOn ? 0.7 + 0.3 * Math.sin(t * 173) * Math.sin(t * 61) : 0;
  const points = weldOn ? [{ pos: weldP, rgb: [4 * flick, 2.6 * flick, 1.4 * flick], r: 0.35 }] : [];
  const R = F.scene(hallScene(t, { lit, cx: 0, points }));
  drawHall(R, { lit, xMin: -20, xMax: 40 });
  pallet(R, px, 1);
  // clamps close on the pallet at 4.5
  const cz = lerp(1.05, 0.81, E.outExpo(u01(t, 4.42, 4.52)));
  for (const s of [-1, 1]) R.add(clampM, m4.T(px * 0 + 0, 0.07, s * cz), SET_MAT.GRAPH);
  // the cart so far: sled + base
  const st = stowedState();
  st.root = m4.T(root[0], root[1], root[2]);
  st.leds = false;
  // the column hangs overhead, lowering at the end of the shot
  const colDrop = lerp(3.0, 1.6, E.inOutSine(u01(t, 7.2, 8.0)));
  st.offset = { column: [0, colDrop, 0] };
  const hide = { head: 1, arm0: 1, arm1: 1, arm2: 1, arm3: 1, ins0: 1, ins1: 1, ins2: 1, ins3: 1 };
  if (t < 6.4) hide.column = 1;
  const dv = t >= 5.0 && t < 6.4 ? W.hi : W.lo;
  dv.draw(R, st, { hide });
  if (!hide.column) drawCarriage(R, 0, 1.47 + colDrop + 0.0);
  // ---- station robots ----
  // driver (front right): approach the knob, seat it, lift
  {
    const B = m4.chain(m4.T(0.2, 0, 1.45), m4.RY(Math.PI));
    const hover = 0.3 * (1 - E.inOutCubic(u01(t, 5.0, 5.3))) + 0.25 * E.inCubic(u01(t, 5.6, 5.75)) + (t < 5.0 ? 0.3 : 0);
    const tgt = [KNOB[0] + px, KNOB[1] + 0.012 + hover, KNOB[2]];
    const rest = [0.3, 1.25, 1.05];
    const go = E.inOutCubic(u01(t, 4.6, 5.0));
    const q = W.driver.solve(B, t < 5.0 ? [lerp(rest[0], tgt[0], go), lerp(rest[1], tgt[1] + 0.3, go), lerp(rest[2], tgt[2], go)] : tgt, [0, -1, 0]);
    q.spin = t > 5.3 && t < 5.6 ? (t - 5.3) * 60 : 0;
    W.driver.draw(R, B, q, { glow: 1 });
  }
  // welder (left): sweeps along the seam
  {
    const B = m4.T(-0.2, 0, -1.45);
    const reach = E.inOutCubic(u01(t, 5.55, 5.85));
    const tgt = [lerp(-0.3, weldP[0] + px, reach), lerp(1.25, weldP[1] + 0.09, reach), lerp(-1.05, weldP[2] - 0.05, reach)];
    const back = E.inOutCubic(u01(t, 6.25, 6.6));
    const q = W.welder.solve(B, [lerp(tgt[0], -0.3, back), lerp(tgt[1], 1.25, back), lerp(tgt[2], -1.05, back)], weldOn || back < 1 ? [0.1, -1, 0.4] : [0, -1, 0]);
    W.welder.draw(R, B, q, { glow: 1 + (weldOn ? 2 : 0) });
  }
  // weld light, sparks
  if (weldOn) {
    const q = proj(F, weldP);
    if (q) {
      glowDot(F, q[0], q[1], 70, '255,190,120', 0.9 * flick);
      glowDot(F, q[0], q[1], 16, '255,255,255', 1);
    }
  }
  sparks(F, weldP, t, 5.95, { n: 220, seed: 3, dir: [0.2, 0.6, 0.8], speed: 2.4 });
  sparks(F, [weldP[0] + 0.02, weldP[1], weldP[2]], t, 6.12, { n: 160, seed: 8, dir: [0.4, 0.5, 0.7], speed: 2.0 });
  puff(F, [px, 0.09, 0], t, 4.5, { n: 500, r: 0.9, e: 0.35 });
  // ---- laser sheet: sweeps up the base, leaves a point-cloud twin ----
  if (t > 6.45) {
    const yS = lerp(0.1, 0.78, E.inOutSine(u01(t, 6.5, 7.5)));
    const a = 1 - u01(t, 7.55, 7.8);
    if (a > 0) {
      const ring = baseContour(Math.min(yS, 0.675), root);
      const pts = [];
      for (const p of ring) {
        const q = proj(F, p);
        if (q) pts.push(q[0], q[1]);
      }
      if (pts.length > 8) {
        pts.push(pts[0], pts[1]);
        hline(F, pts, 1, { rgb: C.CYAN_HI, a: 0.95 * a, w: 1.6, glow: 1.2 });
      }
      // the sheet itself: a faint square of light at the scan height
      const sq = [[-1.2, yS, -1.2], [1.2, yS, -1.2], [1.2, yS, 1.2], [-1.2, yS, 1.2]].map((p) => proj(F, p));
      if (sq.every(Boolean)) {
        const g = F.g;
        g.fillStyle = `rgba(${C.CYAN},${0.08 * a})`;
        g.beginPath();
        sq.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
        g.closePath();
        g.fill();
        hline(F, [sq[0][0], sq[0][1], sq[1][0], sq[1][1], sq[2][0], sq[2][1], sq[3][0], sq[3][1], sq[0][0], sq[0][1]], 1, { a: 0.35 * a, w: 1 });
      }
      basePoints(F, root, yS, 0.9 * a * (1 - u01(t, 7.5, 7.8)));
    }
  }
  // ---- HUD ----
  header(F, '01', 'MOBILE BASE', t, 4.12, 7.92);
  if (t < 5.0) tag(F, [px, 0.72, 0.15], 'BASE ASSEMBLY', { u: u01(t, 4.55, 4.85), side: 1, up: -90, len: 220, size: 18, sub: 'CLAMPED · 4/4' });
  if (t >= 5.0 && t < 5.75) {
    const tq = clamp((t - 5.3) / 0.3);
    tag(F, KNOB, 'FIXING 03', { u: u01(t, 5.05, 5.3), side: -1, up: -150, len: 230, size: 20, sub: `TORQUE ${(tq * 24).toFixed(1)} Nm` });
    const q = proj(F, KNOB);
    if (q && t > 5.6) check(F, q[0] - 330, q[1] - 110, 14, u01(t, 5.6, 5.7));
  }
  if (t >= 5.75 && t < 6.4) tag(F, SEAM, 'SEAM WELD', { u: u01(t, 5.8, 6.05), side: 1, up: -160, len: 230, size: 20, sub: 'LASER · 1070 nm' });
  if (t >= 6.4) {
    const x = 1330, y = 780;
    const items = ['SHELL', 'CASTERS', 'STABILITY'];
    items.forEach((s, i) => {
      const t0 = 7.0 + i * 0.25;
      if (t < t0) return;
      mono(F, s, x, y + i * 48, { size: 20, a: 0.95, rgb: C.WHITE, glow: 0.2 });
      hline(F, [x + 190, y - 7 + i * 48, x + 380, y - 7 + i * 48], u01(t, t0, t0 + 0.15), { a: 0.4, w: 1, glow: 0 });
      check(F, x + 410, y - 8 + i * 48, 10, u01(t, t0 + 0.1, t0 + 0.22));
    });
    mono(F, 'DIGITAL TWIN SCAN', x, y - 56, { size: 15, a: 0.8 * u01(t, 6.5, 6.7), rgb: C.CYAN, track: 4 });
  }
  frameHUD(F, t, { status: 'LINE 01 · STATION 01', rec: true });
  void pulse;
}
