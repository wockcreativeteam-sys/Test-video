// SHOT 04 — STATION 03 · FOUR ARMS (12.0 – 16.0 s)
// Four arms hang in a row above the boom and drop one per beat — 1, 2, 3, 4 — each locking with a
// flash and a numeral. Their light rings wake in sequence and each arm twitches through a joint
// test. FOUR ARMS. / ONE SURGEON IN CONTROL.
import { m4 } from '../engine/m4.js';
import { rbox } from '../engine/geo.js';
import { clamp, lerp, E } from '../engine/util.js';
import { hallScene, drawHall, SET_MAT } from '../model/sets.js';
import { W, initWorld, pallet, stowedState } from './world.js';
import { mono, header, frameHUD, u01, slam, assemble, proj, scrim, hline } from './hud.js';
import { C } from '../palette.js';
import { EV } from '../timeline.js';
import { glowDot } from '../engine/lines.js';

let rod = null, hook = null;
export function init(F) {
  initWorld(F);
  rod = F.R.mesh(rbox(0.04, 1, 0.04, 0.01).xf(m4.T(0, 0.5, 0)));
  hook = F.R.mesh(rbox(0.16, 0.05, 0.16, 0.015));
}
const PX = [-0.48, -0.22, 0.22, 0.48]; // stowed pillar x (world)

export function draw(F, lt, t) {
  initWorld(F);
  const lock = EV.armLock;
  const drop = lock.map((tk) => {
    if (t < tk - 0.3) return 1.35;
    if (t < tk) return lerp(1.35, 0, E.inQuad(u01(t, tk - 0.3, tk)));
    return 0.012 * Math.sin((t - tk) * 45) * Math.exp(-(t - tk) * 14);
  });
  const ledOn = [0, 1, 2, 3].map((k) => {
    const t0 = 14.0 + k * 0.14;
    if (t < t0) return 0;
    const d = t - t0;
    return d < 0.08 ? [1, 0.1, 0.8, 0.2, 1][Math.min(4, Math.floor(d * 60))] : 1;
  });
  const twitch = [0, 1, 2, 3].map((k) => {
    const t0 = 14.05 + k * 0.14;
    return t > t0 ? Math.sin((t - t0) * 18) * Math.exp(-(t - t0) * 5) : 0;
  });
  const shake = lock.reduce((s, tk) => s + (t > tk ? 0.006 * Math.exp(-(t - tk) * 14) * Math.sin(t * 95) : 0), 0);
  // ---- cameras ----
  if (t < 14.75) {
    const u = E.inOutSine(u01(t, 12.0, 14.75));
    F.cam.set([0, lerp(1.7, 1.5, u) + shake, lerp(5.6, 4.5, u)], [0, lerp(1.55, 1.35, u) + shake, 0], 31);
  } else {
    const u = E.inOutSine(u01(t, 14.75, 16.0));
    F.cam.set([lerp(-2.4, -2.0, u), lerp(0.7, 0.85, u), lerp(2.7, 2.45, u)], [0.05, 1.32, 0.05], 34, 0, [260, 0]);
  }
  const R = F.scene(hallScene(t, { lit: 1, cx: 0 }));
  drawHall(R, { lit: 1, xMin: -20, xMax: 40 });
  pallet(R, 0, 1);
  const st = stowedState();
  st.root = m4.T(0, 0.08, 0);
  st.insert = [null, null, null, null];
  st.offset = {};
  for (let k = 0; k < 4; k++) st.offset['arm' + k] = [0, drop[k], 0];
  st.armLed = ledOn;
  st.pillarYaw = twitch.map((v) => v * 0.35);
  st.deploy = twitch.map((v) => Math.max(0, v) * 0.12);
  st.ledGain = 1;
  W.lo.draw(R, st, {});
  // hoist rods holding the arms until they lock, then retracting
  for (let k = 0; k < 4; k++) {
    const tk = lock[k];
    const up = t > tk + 0.05 ? E.inOutSine(u01(t, tk + 0.05, tk + 0.45)) * 1.6 : 0;
    const yb = 1.66 + 0.08 + drop[k] + up;
    if (yb > 3.55) continue;
    R.add(rod, m4.chain(m4.T(PX[k], yb, 0), m4.S(1, 3.6 - yb, 1)), SET_MAT.GRAPH);
    R.add(hook, m4.T(PX[k], yb, 0), SET_MAT.GRAPH);
  }
  // lock flashes + numerals
  for (let k = 0; k < 4; k++) {
    const tk = lock[k];
    const f = t > tk ? Math.exp(-(t - tk) / 0.08) : 0;
    const q = proj(F, [PX[k], 1.64 + 0.08, 0.07]);
    if (q && f > 0.02) glowDot(F, q[0], q[1], 120, C.CYAN, 0.8 * f);
    if (t < 14.75 && q) slam(F, String(k + 1), q[0], q[1] - 200, 110, t, tk, { t1: 14.75, fam: 'D200' });
  }
  // ---- type ----
  if (t > 14.75) {
    scrim(F, 90, 760, 900, 210, 0.55);
    assemble(F, 'FOUR ARMS.', 140, 840, 92, t, 14.85, { fam: 'D300', track: 0.06, spread: 160 });
    assemble(F, 'ONE SURGEON IN CONTROL.', 140, 920, 52, t, 15.15, { fam: 'D500', track: 0.1, spread: 160, seed: 33, stagger: 0.016, dur: 0.3 });
    hline(F, [140, 955, 760, 955], E.outCubic(u01(t, 15.45, 15.9)), { a: 0.7 });
  }
  header(F, '03', 'FOUR ARMS', t, 12.12, 14.7);
  if (t < 14.75) {
    const n = lock.filter((tk) => t >= tk).length;
    mono(F, `ARMS ${n}/4`, 1824, 120, { size: 15, a: 0.9, align: 'right', rgb: n === 4 ? C.CYAN : C.ICE });
  }
  frameHUD(F, t, { status: 'LINE 01 · STATION 03', rec: true });
  void clamp;
}
