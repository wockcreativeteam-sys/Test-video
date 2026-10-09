// SHOT 06 — STATION 05 · VISION + CALIBRATION (20.0 – 23.0 s)
// The endoscope's two lenses in macro: 3D HD VISION, left and right images fusing into one. Then
// the finished cart: a laser crosshair drops from the boom onto the calibration target and the
// four arms deploy around it in one movement; a hand-tremor trace runs through the filter and
// comes out still.
import { m4 } from '../engine/m4.js';
import { clamp, lerp, E, noise1 } from '../engine/util.js';
import { hallScene, drawHall, studio, SET_MAT } from '../model/sets.js';
import { W, initWorld, pallet, defaultState } from './world.js';
import { mono, tag, header, frameHUD, u01, assemble, proj, brackets, hline, crosshair, scrim } from './hud.js';
import { C } from '../palette.js';
import { EV } from '../timeline.js';
import { glowDot } from '../engine/lines.js';

export function init(F) {
  initWorld(F);
}

export function draw(F, lt, t) {
  initWorld(F);
  if (t < 21.0) scope(F, t);
  else calib(F, t);
}

function scope(F, t) {
  const u = E.inOutSine(u01(t, 20.0, 21.0));
  const tgt = [0, 0, 0];
  F.cam.set([lerp(0.016, 0.006, u), lerp(0.012, 0.008, u), lerp(0.034, 0.024, u)], [0, -0.003, 0], 30, 0, [-260, 0]);
  F.cam.near = 0.002;
  const R = F.scene(studio(t, {
    key: { shadow: false, dir: [0.4, -0.85, -0.5] },
    skyAO: null, reflect: false, near: 0.002, far: 3, fog: 0, rim: 1.6,
    boxes: [
      { dir: [-0.45, 0.85, 0.55], size: [0.55, 0.3], rgb: [3.2, 3.2, 3.2] },
      { dir: [0.3, 0.9, -0.3], size: [0.9, 0.05], rgb: [1.8, 2.3, 2.8] },
      { dir: [0.95, 0.15, 0.25], size: [0.06, 0.7], rgb: [1.5, 1.6, 1.7] },
      { dir: [-0.95, 0.4, -0.1], size: [0.05, 0.8], rgb: [1.0, 1.6, 2.2] },
    ],
  }));
  const M0 = m4.chain(m4.RY(t * 0.25), m4.RX(0.05));
  R.add(W.scope, M0, { alb: [0.8, 0.82, 0.85], rough: 0.2, metal: 1, f0: 0.04, coat: 0 });
  R.add(W.scopeRim, M0, { alb: [0.03, 0.03, 0.035], rough: 0.4, metal: 0, f0: 0.04, coat: 0.3 });
  R.add(W.lens, M0, { alb: [0.01, 0.012, 0.02], rough: 0.04, metal: 0, f0: 0.08, coat: 1, emis: [0.0, 0.03, 0.06] });
  const on = clamp((t - 20.15) * 5);
  R.add(W.ports, M0, { alb: [0.05, 0.05, 0.05], rough: 0.3, emis: [2.4 * on, 2.6 * on, 2.8 * on] });
  // stereo: left and right frames converge into one
  const k = E.inOutCubic(u01(t, 20.25, 20.75));
  const cx = 1340, cy = 520, w = 520, h = 300;
  const off = (1 - k) * 70;
  brackets(F, cx - w / 2 - off, cy - h / 2, w, h, u01(t, 20.1, 20.35), { a: 0.8 * (1 - k * 0.6) });
  brackets(F, cx - w / 2 + off, cy - h / 2, w, h, u01(t, 20.1, 20.35), { a: 0.8 * (1 - k * 0.6), rgb: C.ICE });
  if (k < 0.95) {
    mono(F, 'L', cx - w / 2 - off + 12, cy - h / 2 + 26, { size: 14, a: 0.8 * (1 - k), rgb: C.CYAN });
    mono(F, 'R', cx + w / 2 + off - 24, cy - h / 2 + 26, { size: 14, a: 0.8 * (1 - k), rgb: C.ICE });
  }
  if (t > 20.35) assemble(F, '3D HD', cx, cy + 34, 120, t, 20.38, { align: 'c', fam: 'D200', track: 0.04, spread: 120 });
  if (t > 20.55) mono(F, 'VISION', cx, cy + 92, { size: 22, a: u01(t, 20.55, 20.75), align: 'center', rgb: C.CYAN, track: 12 });
  header(F, '05', 'VISION', t, 20.05, 20.97);
  frameHUD(F, t, { status: 'STATION 05 · OPTICS', rec: true });
}

function calib(F, t) {
  const u = E.inOutSine(u01(t, 21.0, 23.0));
  F.cam.set([lerp(2.5, 1.9, u), lerp(2.25, 2.0, u), lerp(3.3, 3.05, u)], [0, lerp(1.2, 1.15, u), 0.45], 34);
  const R = F.scene(hallScene(t, { lit: 1, cx: 0 }));
  drawHall(R, { lit: 1, xMin: -20, xMax: 40 });
  pallet(R, 0, 1);
  const st = defaultState();
  st.root = m4.T(0, 0.08, 0);
  const dep = E.inOutCubic(u01(t, 21.05, 21.85));
  st.deploy = [0, 1, 2, 3].map((k) => clamp(dep * 1.15 - k * 0.05));
  st.boomExt = 0.32;
  W.lo.draw(R, st, {});
  // calibration target under the remote centres
  const T = [0, 0.88, 0.72];
  R.add(W.S.target, m4.T(T[0], T[1] - 0.015, T[2]), SET_MAT.GRAPH);
  const lz = clamp((t - 21.0) * 6);
  R.add(W.S.targetRing, m4.T(T[0], T[1] + 0.016, T[2]), { alb: [0.02, 0.02, 0.02], rough: 0.4, emis: [0.3 * lz, 1.1 * lz, 1.5 * lz] });
  // the laser drops from the boom
  const L0 = [0, 1.65 + 0.08, 0.32 + 0.1];
  const drop = E.outCubic(u01(t, 21.0, 21.2));
  const L1 = [lerp(L0[0], T[0], drop), lerp(L0[1], T[1] + 0.02, drop), lerp(L0[2], T[2], drop)];
  R.addBeam(L0, L1, 0.004, 0.004, [0.6 * lz, 2.2 * lz, 3.0 * lz], 1, 2);
  R.addBeam(L0, L1, 0.04, 0.06, [0.02 * lz, 0.08 * lz, 0.11 * lz], 1, 0);
  if (drop > 0.95) {
    const s = 0.24 * E.outCubic(u01(t, 21.18, 21.4));
    R.addBeam([T[0] - s, T[1] + 0.02, T[2]], [T[0] + s, T[1] + 0.02, T[2]], 0.003, 0.003, [0.6, 2.2, 3.0], 1, 2);
    R.addBeam([T[0], T[1] + 0.02, T[2] - s], [T[0], T[1] + 0.02, T[2] + s], 0.003, 0.003, [0.6, 2.2, 3.0], 1, 2);
  }
  const q = proj(F, [T[0], T[1] + 0.02, T[2]]);
  if (q && drop > 0.9) {
    crosshair(F, q[0], q[1], 22, 0.8, { spin: t * 2.5 });
    glowDot(F, q[0], q[1], 60, C.CYAN, 0.6);
  }
  tag(F, [T[0] + 0.24, T[1] + 0.02, T[2]], 'LASER TARGETING', { u: u01(t, 21.2, 21.5), side: 1, up: -70, len: 280, size: 20, sub: 'BOOM ALIGNED TO TARGET' });
  // tremor filtration panel
  if (t > 21.7) {
    const x = 1240, y = 760, w = 560, h = 190;
    const a = u01(t, 21.7, 21.85);
    scrim(F, x - 20, y - 30, w + 40, h + 60, 0.55 * a);
    brackets(F, x, y, w, h, a, { a: 0.7 });
    mono(F, 'TREMOR FILTRATION', x + 16, y + 30, { size: 19, a, rgb: C.WHITE, glow: 0.15 });
    mono(F, 'MOTION SCALING', x + w - 16, y + 30, { size: 15, a: a * 0.8, align: 'right', rgb: C.CYAN });
    const pr = E.inOutSine(u01(t, 21.8, 22.7));
    const n = 120;
    const raw = [], cl = [];
    for (let i = 0; i <= n * pr; i++) {
      const s = i / n;
      const base = Math.sin(s * 6.3) * 0.25;
      const jit = noise1(s * 60, 3) * 0.32 + noise1(s * 140, 7) * 0.18;
      raw.push(x + 16 + s * (w - 32), y + h * 0.42 - (base + jit) * 70);
      cl.push(x + 16 + s * (w - 32), y + h * 0.72 - base * 70);
    }
    if (raw.length > 3) {
      hline(F, raw, 1, { rgb: C.GREY, a: 0.8 * a, w: 1.2, glow: 0 });
      hline(F, cl, 1, { rgb: C.CYAN_HI, a: a, w: 2, glow: 0.8 });
    }
    mono(F, 'INPUT', x + 16, y + h * 0.42 - 40, { size: 11, a: a * 0.6, rgb: C.GREY });
    mono(F, 'OUTPUT', x + 16, y + h * 0.72 + 34, { size: 11, a: a * 0.8, rgb: C.CYAN });
  }
  header(F, '05', 'CALIBRATION', t, 21.03, 22.95);
  frameHUD(F, t, { status: 'LINE 01 · STATION 05', rec: true });
  void EV;
}
