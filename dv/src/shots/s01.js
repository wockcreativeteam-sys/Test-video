// SHOT 01 — LINE ONLINE (0.0 – 4.0 s)
// Darkness; a boot sequence types itself; a laser line runs away down the floor. On the downbeat
// the first light bank slams on, then bank after bank, accelerating down the hall: an immaculate
// assembly line, a pallet with the first parts of the cart waiting at station 01, graphite robots
// waking (their joint rings light as the light reaches them).
// THE FUTURE OF SURGERY / IS BEING ASSEMBLED. — the letters fly in and lock like parts.
import { m4 } from '../engine/m4.js';
import { clamp, lerp, E } from '../engine/util.js';
import { hallScene, drawHall, bankX, LINE } from '../model/sets.js';
import { W, initWorld, pallet, stowedState } from './world.js';
import { mono, typed, bar, assemble, frameHUD, u01, scrim, hline } from './hud.js';
import { C } from '../palette.js';
import { EV } from '../timeline.js';

export function init(F) {
  initWorld(F);
}

// ignition time of each bank: the first ones on the beat, then a cascade down the hall
export function bankT(i) {
  const x = bankX(i);
  const order = Math.round((x + 3.5) / LINE.bankStep); // the first bank in frame (x = -3.5) is first
  if (order < 0) return 2.0; // the ones behind the camera come on with it
  const seq = [2.0, 2.5, 3.0, 3.25, 3.5, 3.75];
  if (order < seq.length) return seq[order];
  return 3.75 + (order - seq.length + 1) * 0.07;
}
/** bank brightness with a fluorescent-tube strike (flicker) and overshoot */
export function bankB(i, t, tOn = bankT(i)) {
  const d = t - tOn;
  if (d < 0) return 0;
  if (d < 0.1) {
    const f = Math.floor(d * 60);
    return [1, 0.15, 0.9, 0.3, 1.0, 1.3][Math.min(f, 5)];
  }
  return 1 + 0.35 * Math.exp(-(d - 0.1) / 0.12);
}

export function draw(F, lt, t) {
  initWorld(F);
  const robotsOn = (x) => clamp((t - (2.0 + Math.max(0, x + 10.5) * 0.11)) * 5);
  // overall hall level steps up with each of the first banks (thunk, thunk, thunk)
  let lit = 0;
  for (let i = 0; i < LINE.nBanks; i++) {
    const x = bankX(i);
    if (x < -11 || x > 4) continue;
    lit += Math.min(1.2, bankB(i, t)) / 3;
  }
  lit = clamp(lit, 0, 1.15);
  // ---- camera: low over the floor, looking down the line; a slow push and rise ----
  // anticipation tilt up to the ceiling as the banks strike, then down to the line for the title
  const ty = t < 2 ? lerp(1.8, 2.6, E.inOutSine(u01(t, 0, 2))) : t < 3.25 ? lerp(2.6, 3.0, E.outCubic(u01(t, 2, 3.25))) : lerp(3.0, 1.5, E.inOutCubic(u01(t, 3.25, 4.0)));
  const px = t < 2 ? lerp(-13.5, -13.0, u01(t, 0, 2)) : t < 3.25 ? lerp(-13.0, -11.9, u01(t, 2, 3.25)) : lerp(-11.9, -10.4, E.inOutCubic(u01(t, 3.25, 4.0)));
  const py = lerp(0.5, 0.92, E.inOutSine(u01(t, 1.5, 4.0)));
  F.cam.set([px, py, 0], [10, ty, 0], lerp(39, 35, E.inOutSine(u01(t, 0, 4))), lerp(-0.01, 0, u01(t, 0, 4)));
  const R = F.scene(hallScene(t, { lit, cx: 0, rim: 0.2 + 0.8 * lit, fog: 0.05 }));
  drawHall(R, { banks: (i) => bankB(i, t), lit, padGlow: 0.3 + 0.7 * lit, xMin: -16, xMax: 70 });
  // the laser line runs away down the floor before the lights come on
  if (t > 0.9 && t < 2.15) {
    const k = E.inCubic(u01(t, 0.95, 2.0));
    const x = lerp(-9.5, 26, k);
    const a = (1 - u01(t, 1.95, 2.15)) * clamp((t - 0.9) * 8);
    R.addBeam([x, 0.05, -2.6], [x, 0.05, 2.6], 0.014, 0.014, [0.5 * a, 1.8 * a, 2.4 * a], 1, 1.5);
    R.addBeam([x - 0.6, 0.04, -2.6], [x - 0.6, 0.04, 2.6], 0.3, 0.3, [0.02 * a, 0.08 * a, 0.1 * a], 1, 0);
  }
  // pallet with the sled + base at station 01, more pallets down the line
  for (const x of [0, 14, 28]) pallet(R, x, 0.15 + 0.85 * robotsOn(x));
  const st = stowedState();
  st.root = m4.T(0, 0.08, 0);
  st.leds = false;
  W.lo.draw(R, st, { hide: { column: 1, head: 1, arm0: 1, arm1: 1, arm2: 1, arm3: 1, ins0: 1, ins1: 1, ins2: 1, ins3: 1 } });
  // station robots waiting (tools down, rings waking with the light)
  for (const x of [0, 7, 14, 21, 28]) {
    const g = robotsOn(x);
    for (const side of [-1, 1]) {
      const B = m4.chain(m4.T(x + 0.2 * side, 0, 1.45 * side), m4.RY(side > 0 ? Math.PI : 0));
      const rob = side > 0 ? W.driver : W.welder;
      const q = rob.solve(B, [x + 0.55 * side, 0.95, 0.75 * side], [0, -1, 0]);
      rob.draw(R, B, q, { glow: g });
    }
  }
  // ---- HUD: boot sequence in the dark ----
  const hudA = 1 - u01(t, 1.9, 2.05);
  if (hudA > 0) {
    const cx = 960, cy = 520;
    typed(F, 'WOCKHARDT HOSPITALS  //  ROBOTIC SURGERY PROGRAMME', cx - 330, cy - 40, t, 0.15, { size: 16, a: 0.9 * hudA, rgb: C.ICE, cps: 70 });
    typed(F, 'ASSEMBLY LINE 01', cx - 330, cy - 8, t, 0.5, { size: 16, a: 0.95 * hudA, rgb: C.CYAN, cps: 40 });
    const p = clamp(EV.boot.reduce((s, b) => s + (t > b ? 1 / 3 : 0), 0) + (t > 1.25 ? (t - 1.25) * 1.6 : 0));
    bar(F, cx - 330, cy + 20, 660, p, { a: hudA });
    mono(F, `${String(Math.round(p * 100)).padStart(3, '0')}%`, cx + 330, cy + 50, { size: 13, a: 0.8 * hudA, align: 'right', rgb: C.ICE });
    mono(F, t > 1.75 ? 'ONLINE' : 'INITIALISING', cx - 330, cy + 50, { size: 13, a: 0.8 * hudA * (t > 1.75 ? 1 : 0.5 + 0.5 * (Math.floor(t * 6) % 2)), rgb: t > 1.75 ? C.CYAN : C.ICE });
  }
  frameHUD(F, t, { a: 0.3 + 0.5 * lit, status: 'LINE 01 · ' + (t < 2 ? 'STANDBY' : 'RUNNING') });
  // ---- title ----
  if (t > 2.7) {
    scrim(F, 560, 770, 800, 150, 0.55);
    assemble(F, 'THE FUTURE OF SURGERY', 960, 830, 58, t, 2.75, { align: 'c', track: 0.14, fam: 'D300', spread: 170 });
    assemble(F, 'IS BEING ASSEMBLED.', 960, 900, 58, t, 3.05, { align: 'c', track: 0.14, fam: 'D500', spread: 170, seed: 21, stagger: 0.022 });
    hline(F, [760, 935, 1160, 935], E.outCubic(u01(t, 3.3, 3.7)), { a: 0.7 });
  }
}
