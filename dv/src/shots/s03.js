// SHOT 03 — STATION 02 · COLUMN + BOOM (8.0 – 12.0 s)
// The column drops into the base and locks (dust off the floor); the boom head lands on top and
// its light ring wakes; the boom extends and swings — the HUD measures the rotation.
import { m4 } from '../engine/m4.js';
import { clamp, lerp, E } from '../engine/util.js';
import { hallScene, drawHall, drawCarriage } from '../model/sets.js';
import { W, initWorld, pallet, stowedState, puff } from './world.js';
import { mono, tag, header, frameHUD, u01, arc3, proj, crosshair } from './hud.js';
import { C } from '../palette.js';
import { glowDot } from '../engine/lines.js';

export function init(F) {
  initWorld(F);
}

function boomYaw(t) {
  if (t < 10.5) return 0;
  if (t < 11.0) return 0.5 * E.inOutCubic(u01(t, 10.5, 11.0));
  if (t < 11.5) return lerp(0.5, -0.42, E.inOutCubic(u01(t, 11.0, 11.5)));
  return lerp(-0.42, 0, E.inOutCubic(u01(t, 11.5, 11.95)));
}

export function draw(F, lt, t) {
  initWorld(F);
  const colY = t < 8.5 ? lerp(1.6, 0, E.inQuad(u01(t, 8.0, 8.5))) : 0;
  const headY = t < 9.5 ? (t < 9.0 ? 2.6 : lerp(1.2, 0, E.inQuad(u01(t, 9.0, 9.5)))) : 0;
  const shake = (t0, k) => (t > t0 ? k * Math.exp(-(t - t0) * 12) * Math.sin(t * 95) : 0);
  const sh = shake(8.5, 0.012) + shake(9.5, 0.008);
  // ---- cameras ----
  if (t < 9.0) {
    const u = u01(t, 8.0, 9.0);
    F.cam.set([lerp(1.05, 0.95, u), 0.32 + sh, lerp(1.45, 1.35, u)], [0, lerp(1.35, 1.05, E.inOutSine(u)) + sh, 0], 44);
  } else if (t < 10.0) {
    const u = u01(t, 9.0, 10.0);
    F.cam.set([lerp(0.25, 0, u), lerp(2.75, 2.6, u) + sh, lerp(3.0, 2.8, u)], [0, 1.62 + sh, 0], 33);
  } else {
    const u = E.inOutSine(u01(t, 10.0, 12.0));
    const a = lerp(-0.95, 0.75, u);
    const r = lerp(3.1, 2.7, u);
    F.cam.set([Math.sin(a) * r, lerp(2.35, 2.75, u), Math.cos(a) * r + 0.1], [0, lerp(1.7, 1.82, u), 0.2], 36);
  }
  const yaw = boomYaw(t);
  const ext = 0.32 * E.inOutCubic(u01(t, 10.0, 10.5));
  const R = F.scene(hallScene(t, { lit: 1, cx: 0 }));
  drawHall(R, { lit: 1, xMin: -20, xMax: 40 });
  pallet(R, 0, 1);
  const st = stowedState();
  st.root = m4.T(0, 0.08, 0);
  st.offset = { column: [0, colY, 0], head: [0, colY + headY, 0] };
  st.boomExt = ext;
  st.boomYaw = yaw;
  st.ledGain = clamp((t - 9.62) * 6) * (t > 9.62 && t < 9.72 ? (Math.floor(t * 60) % 2 ? 0.2 : 1) : 1);
  const hide = { arm0: 1, arm1: 1, arm2: 1, arm3: 1, ins0: 1, ins1: 1, ins2: 1, ins3: 1 };
  if (t < 9.0) hide.head = 1;
  W.lo.draw(R, st, { hide });
  // carriages holding the parts until they lock
  if (t < 8.62) drawCarriage(R, 0, 1.56 + colY);
  else if (t < 9.0) drawCarriage(R, 0, lerp(1.56, 2.6, E.inOutSine(u01(t, 8.62, 9.0))));
  if (t >= 9.0 && t < 9.65) drawCarriage(R, 0, 2.0 + headY);
  else if (t >= 9.65 && t < 10.3) drawCarriage(R, 0, lerp(2.0, 3.0, E.inOutSine(u01(t, 9.65, 10.3))));
  puff(F, [0, 0.66, -0.02], t, 8.5, { n: 700, r: 0.55, e: 0.45, seed: 13 });
  // lock flashes
  for (const [t0, y] of [[8.5, 0.66], [9.5, 1.55]]) {
    const f = t > t0 ? Math.exp(-(t - t0) / 0.09) : 0;
    if (f > 0.02) {
      const q = proj(F, [0, y, 0.13]);
      if (q) glowDot(F, q[0], q[1], 160, C.CYAN, 0.7 * f);
    }
  }
  // ---- HUD ----
  header(F, '02', 'COLUMN + BOOM', t, 8.12, 11.92);
  if (t < 9.0) tag(F, [0.12, 1.1, 0.12], 'COLUMN', { u: u01(t, 8.55, 8.85), side: 1, up: -60, len: 190, size: 19, sub: 'LOCKED' });
  if (t >= 9.0 && t < 10.0) tag(F, [0.14, 1.93, 0.05], 'BOOM HEAD', { u: u01(t, 9.55, 9.85), side: 1, up: -50, len: 210, size: 19, sub: 'LOCKED · LINKED' });
  if (t >= 10.0) {
    const c = [0, 1.76 + 0.08, 0];
    const u = E.outCubic(u01(t, 10.05, 10.5));
    arc3(F, c, 0.95, [0, 0, 1], [1, 0, 0], -0.8, 0.8, { u, ticks: 32, a: 0.75 });
    // pointer at the current boom direction
    const d = [Math.sin(yaw), 0, Math.cos(yaw)];
    const p0 = proj(F, [c[0] + d[0] * 0.75, c[1], c[2] + d[2] * 0.75]), p1 = proj(F, [c[0] + d[0] * 1.08, c[1], c[2] + d[2] * 1.08]);
    if (p0 && p1 && u > 0.5) {
      const ctx = F.ctx;
      ctx.strokeStyle = `rgba(${C.WHITE},${0.95})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.stroke();
      glowDot(F, p1[0], p1[1], 30, C.CYAN, 0.6);
      mono(F, `${yaw >= 0 ? '+' : '−'}${Math.abs((yaw * 180) / Math.PI).toFixed(1)}°`, p1[0] + 14, p1[1] - 10, { size: 18, a: 1, rgb: C.WHITE, glow: 0.3 });
    }
    tag(F, [0.6, 1.84, ext], 'OVERHEAD BOOM', { u: u01(t, 10.25, 10.65), side: 1, up: -90, len: 260, size: 19, sub: 'ROTATES · MULTI-QUADRANT ACCESS' });
    const q = proj(F, [0, 1.98 + 0.08, 0]);
    if (q) crosshair(F, q[0], q[1], 16, 0.6 * u, { spin: t * 3 });
  }
  frameHUD(F, t, { status: 'LINE 01 · STATION 02', rec: true });
}
