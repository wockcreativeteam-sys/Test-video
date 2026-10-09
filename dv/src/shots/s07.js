// SHOT 07 — HERO (23.0 – 30.0 s; the end card plays over its last seconds)
// Blackout on the downbeat — only the light rings glow. A blade of light sweeps across the shells;
// then the cart is lit like a product and unfolds its four arms in one movement. da Vinci Xi.
import { m4 } from '../engine/m4.js';
import { clamp, lerp, E } from '../engine/util.js';
import { hallScene, drawHall } from '../model/sets.js';
import { W, initWorld, pallet, stowedState } from './world.js';
import { mono, frameHUD, u01, assemble, scrim, hline } from './hud.js';
import { C } from '../palette.js';
import { EV } from '../timeline.js';

export function init(F) {
  initWorld(F);
}

export function draw(F, lt, t) {
  initWorld(F);
  const rev = E.outCubic(u01(t, EV.reveal, EV.reveal + 0.35)); // product light
  const sweep = u01(t, 23.4, 23.95); // the blade of light
  const blade = Math.sin(Math.PI * sweep);
  // ---- camera: low, slow orbit and push; the cart sits right of centre for the title ----
  const u = E.inOutSine(u01(t, 23.0, 30.0));
  const a = lerp(-0.62, -0.18, u);
  const r = lerp(3.6, 2.95, u);
  F.cam.set([Math.sin(a) * r, lerp(0.55, 0.8, u), Math.cos(a) * r + 0.2], [0, lerp(1.45, 1.38, u), 0.25], lerp(37, 33, u), 0, [lerp(250, 230, u), 0]);
  // ---- light: hall off; hero key + rims; the blade travels across the env ----
  const sc = hallScene(t, { lit: 0.05 + 0.25 * rev, cx: 0, rim: 0.2 + 1.6 * rev + 1.2 * blade, fog: 0.05 });
  sc.lights[0].rgb = [2.6 * rev, 2.55 * rev, 2.5 * rev];
  sc.lights[0].dir = [-0.35, 1, 0.55];
  sc.key.dir = [0.35, -1, -0.55];
  sc.lights[1].rgb = [0.5 * rev, 0.6 * rev, 0.75 * rev];
  const bx = lerp(-1.4, 1.4, sweep);
  sc.boxes = [
    { dir: [-0.35, 1, 0.55], size: [0.6, 0.25], rgb: [3.4 * rev, 3.4 * rev, 3.4 * rev] },
    { dir: [bx, 0.35, 1], size: [0.05, 1.2], rgb: [6 * blade, 6.5 * blade, 7 * blade] },
    { dir: [0.1, 0.4, -1], size: [1.6, 0.05], rgb: [1.2 + 1.2 * rev, 1.6 + 1.3 * rev, 2.2 + 1.4 * rev] },
    { dir: [1, 0.2, 0.3], size: [0.05, 0.9], rgb: [1.4 * rev, 1.6 * rev, 1.9 * rev] },
    { dir: [-1, 0.25, -0.2], size: [0.05, 0.9], rgb: [0.9 * rev, 1.3 * rev, 1.8 * rev] },
    { dir: [0, 1, 0], size: [0.9, 0.9], rgb: [0.35 * rev, 0.37 * rev, 0.4 * rev] },
  ];
  sc.sky = [0.02 * rev + 0.002, 0.024 * rev + 0.002, 0.03 * rev + 0.003];
  const R = F.scene(sc);
  drawHall(R, { banks: () => 0, lit: 0.04 + 0.12 * rev, padGlow: 0.3, xMin: -20, xMax: 40, shafts: false });
  pallet(R, 0, 0.6 + 0.4 * rev);
  // the cart: stowed in the dark, unfolding into the surgical pose
  const st = stowedState();
  st.root = m4.T(0, 0.08, 0);
  const un = EV.unfold;
  st.deploy = [0, 1, 2, 3].map((k) => E.inOutCubic(clamp((t - un[0] - k * 0.08) / (un[1] - un[0] - 0.24))));
  st.boomExt = 0.32 * E.inOutCubic(u01(t, un[0], un[0] + 0.8));
  st.ledGain = 1.2;
  W.hi.draw(R, st, {});
  // ---- title ----
  if (t > EV.title && t < 27.6) {
    const out = u01(t, 27.3, 27.55);
    scrim(F, 80, 400, 700, 260, 0.45 * (1 - out));
    const r1 = assemble(F, 'da Vinci Xi', 140, 560, 124, t, EV.title, { fam: 'D300', track: 0.0, spread: 150, a: 1 - out });
    if (r1) mono(F, '®', 140 + r1.w + 8, 482, { size: 26, a: u01(t, EV.title + 0.4, EV.title + 0.6) * (1 - out), rgb: C.WHITE, wt: 400 });
    if (t > EV.sub) {
      mono(F, 'ROBOTIC SURGICAL SYSTEM', 146, 622, { size: 20, a: u01(t, EV.sub, EV.sub + 0.25) * (1 - out), rgb: C.CYAN, track: 7 });
      hline(F, [146, 650, 760, 650], E.outCubic(u01(t, EV.sub + 0.1, EV.sub + 0.6)), { a: 0.6 * (1 - out) });
    }
  }
  frameHUD(F, t, { a: 0.4 * (1 - u01(t, 27.2, 27.5)), status: t < EV.reveal ? 'LINE 01 · POWER CYCLE' : 'LINE 01 · COMPLETE' });
}
