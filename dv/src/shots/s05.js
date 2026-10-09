// SHOT 05 — STATION 04 · ENDOWRIST INSTRUMENTS (16.0 – 20.0 s)
// Macro, in the dark: the wrist is printed by light — wireframe and hologram first, then solid
// metal behind a scanning band. It articulates on the beat (pitch, yaw, open, close) while the
// seven degrees of freedom are counted off. Then the four instruments slide home into the arms.
import { m4 } from '../engine/m4.js';
import { clamp, lerp, E } from '../engine/util.js';
import { hallScene, drawHall, studio } from '../model/sets.js';
import { W, initWorld, pallet, defaultState, stowedState } from './world.js';
import { drawWrist } from '../model/davinci.js';
import { mono, tag, header, frameHUD, u01, slam, arc3, proj, check, hline } from './hud.js';
import { C } from '../palette.js';
import { EV } from '../timeline.js';
import { glowDot } from '../engine/lines.js';

export function init(F) {
  initWorld(F);
}

const DOF = ['INSERTION', 'PITCH', 'YAW', 'ROLL', 'WRIST PITCH', 'WRIST YAW', 'GRIP'];

export function draw(F, lt, t) {
  initWorld(F);
  if (t < 19.0) macro(F, t);
  else insertion(F, t);
}

function macro(F, t) {
  // camera orbits the wrist
  const u = E.inOutSine(u01(t, 16.0, 19.0));
  const a = lerp(-0.75, 0.55, u);
  const r = lerp(0.085, 0.066, u);
  const tgt = [0, 0.011, 0];
  F.cam.set([tgt[0] + Math.sin(a) * r, tgt[1] + lerp(0.022, 0.012, u), tgt[2] + Math.cos(a) * r], tgt, 30, 0, [-170, 0]);
  F.cam.near = 0.002;
  const sc = studio(t, {
    key: { shadow: true, dir: [0.45, -0.85, -0.55], center: [0, 0.01, 0], ext: 0.05, depth: 0.3, soft: 2.5 },
    skyAO: null,
    reflect: false,
    near: 0.003,
    far: 5,
    fog: 0,
    rim: 1.4,
  });
  const R = F.scene(sc);
  // articulation on the beat
  const ev = EV.jaws; // 17.5, 18.0, 18.5, 19.0
  const pitch = 0.65 * E.inOutCubic(u01(t, ev[0] - 0.12, ev[0] + 0.1)) - 0.25 * E.inOutCubic(u01(t, ev[2] + 0.15, ev[3]));
  const yaw = -0.55 * E.inOutCubic(u01(t, ev[1] - 0.12, ev[1] + 0.1)) + 0.3 * E.inOutCubic(u01(t, ev[2] + 0.15, ev[3]));
  const open = 0.85 * E.outCubic(u01(t, ev[2] - 0.1, ev[2] + 0.08)) * (1 - E.inExpo(u01(t, ev[3] - 0.08, ev[3])));
  const roll = t * 0.35;
  const M0 = m4.chain(m4.RZ(-0.18), m4.RX(0.1), m4.RY(roll));
  // build by light: a scan band climbs the instrument
  const yS = lerp(-0.03, 0.04, E.inOutSine(u01(t, 16.25, 17.1)));
  const clip = { plane: [0, 1, 0, -yS], band: 0.0012, rgb: [0.5, 2.2, 3.0] };
  const built = t > 17.15;
  const holoA = 1 - u01(t, 17.0, 17.3);
  drawWrist(R, W.hi, M0, {
    pitch, yaw, open,
    clip: built ? null : clip,
    holo: holoA > 0.01 ? { rgb: [0.3, 0.85, 1.0], a: 1.2 * holoA * clamp((t - 16.0) * 4), clip: built ? null : clip, lineF: 9000 } : null,
    wire: holoA > 0.01 ? { rgb: [0.3, 0.85, 1.0], a: 0.5 * holoA * clamp((t - 16.0) * 4), clip: null } : null,
  });
  // HUD: joint arcs as they move
  const P1 = m4.apply(M0, [0, 0.0068, 0]);
  const P2 = m4.apply(m4.chain(M0, m4.T(0, 0.0068, 0), m4.RX(pitch)), [0, 0.0078, 0]);
  const xA = m4.dir(M0, [1, 0, 0]), yA = m4.dir(M0, [0, 1, 0]), zA = m4.dir(M0, [0, 0, 1]);
  if (t > ev[0] - 0.2) arc3(F, P1, 0.011, yA, zA, -0.2, 1.2, { u: E.outCubic(u01(t, ev[0] - 0.2, ev[0] + 0.2)), ticks: 12, a: 0.8 });
  if (t > ev[1] - 0.2) arc3(F, P2, 0.0095, yA, xA, -1.0, 0.4, { u: E.outCubic(u01(t, ev[1] - 0.2, ev[1] + 0.2)), ticks: 10, a: 0.8 });
  // scan band glow
  if (!built) {
    const q = proj(F, [0, yS, 0]);
    if (q) glowDot(F, q[0], q[1], 260, C.CYAN, 0.12 * clamp((t - 16.2) * 4));
  }
  header(F, '04', 'ENDOWRIST® INSTRUMENTS', t, 16.1, 18.95);
  // the seven degrees of freedom, counted off on the sixteenths
  const x = 1350, y = 330;
  DOF.forEach((s, i) => {
    const t0 = 17.2 + i * 0.21;
    if (t < t0) return;
    const yy = y + i * 52;
    mono(F, String(i + 1).padStart(2, '0'), x, yy, { size: 18, a: 0.85, rgb: C.CYAN });
    mono(F, s, x + 60, yy, { size: 21, a: 0.95, rgb: C.WHITE, glow: 0.15 });
    hline(F, [x + 60, yy + 14, x + 60 + 340 * E.outCubic(u01(t, t0, t0 + 0.2)), yy + 14], 1, { a: 0.35, w: 1, glow: 0 });
  });
  if (t > 18.65) {
    slam(F, '7', 1560, 830 + 80, 260, t, 18.7, { fam: 'D200' });
    mono(F, 'DEGREES OF FREEDOM', 1560, 970, { size: 22, a: u01(t, 18.75, 18.9), align: 'center', rgb: C.CYAN, track: 6 });
  }
  frameHUD(F, t, { status: 'STATION 04 · MACRO 8 mm', rec: true });
}

function insertion(F, t) {
  const u = E.inOutSine(u01(t, 19.0, 20.0));
  F.cam.set([lerp(1.8, 1.55, u), lerp(2.1, 2.0, u), lerp(2.2, 2.0, u)], [0, 1.18, 0.15], 36);
  const R = F.scene(hallScene(t, { lit: 1, cx: 0 }));
  drawHall(R, { lit: 1, xMin: -20, xMax: 40 });
  pallet(R, 0, 1);
  const st = stowedState();
  st.root = m4.T(0, 0.08, 0);
  st.insert = EV.insert.map((tk) => (t < tk - 0.22 ? 0 : E.outCubic(u01(t, tk - 0.22, tk))));
  W.lo.draw(R, st, {});
  W.lo.armPose.forEach((ap, k) => {
    const tk = EV.insert[k];
    const f = t > tk ? Math.exp(-(t - tk) / 0.08) : 0;
    const q = ap.housing ? proj(F, ap.housing) : null;
    if (q && f > 0.02) glowDot(F, q[0], q[1], 90, C.CYAN, 0.8 * f);
    if (q && t > tk) check(F, q[0] + 26, q[1] - 26, 9, u01(t, tk, tk + 0.12));
  });
  header(F, '04', 'INSTRUMENTS', t, 19.02, 19.98);
  mono(F, `INSTRUMENTS ${EV.insert.filter((tk) => t >= tk).length}/4`, 1824, 120, { size: 15, a: 0.9, align: 'right', rgb: C.CYAN });
  frameHUD(F, t, { status: 'LINE 01 · STATION 04', rec: true });
  void defaultState;
  void tag;
}
