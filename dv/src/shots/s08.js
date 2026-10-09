// SHOT 08 — END CARD (27.5 – 30.0 s)
// The hero light flares to white. On white: ROBOTIC SURGERY / COMING SOON, and the Wockhardt
// Hospitals lockup (typographic stand-in for the registered mark) over the Healwave.
import { clamp, lerp, E } from '../engine/util.js';
import { mono, u01, assemble } from './hud.js';
import { healwave, HW_DAY } from '../engine/healwave.js';
import { shape, drawShaped } from '../engine/glyphs.js';
import { C } from '../palette.js';
import { EV } from '../timeline.js';

const INK = '22,26,34';

export function draw(F, lt, t) {
  // white card (covers the 3D scene), arriving through the flare
  const wa = E.inOutSine(u01(t, 27.55, 27.75));
  if (wa <= 0) return;
  const ctx = F.ctx;
  ctx.fillStyle = `rgba(250,250,251,${wa})`;
  ctx.fillRect(0, 0, F.W, F.H);
  if (t < 27.7) return;
  const cx = 960;
  assemble(F, 'ROBOTIC SURGERY', cx, 420, 78, t, 27.72, { align: 'c', fam: 'D300', track: 0.1, rgb: INK, glow: 0, spread: 120, flash: false });
  if (t > 28.0) mono(F, 'COMING SOON', cx, 482, { size: 22, a: u01(t, 28.0, 28.25), align: 'center', rgb: '0,150,190', track: 12, wt: 500 });
  // lockup
  if (t > EV.brand) {
    const u = E.outExpo(u01(t, EV.brand, EV.brand + 0.6));
    const S = shape('WOCKHARDT', 'D700', { track: 0.035 });
    const size = 92, w = S.width * size;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, F.W, 690);
    ctx.clip();
    drawShaped(F, S, (ex, ey) => [cx - w / 2 + ex * size, 680 + ey * size + (1 - u) * 110], { rgb: C.BRAND_RED, a: 1 });
    ctx.restore();
    mono(F, 'HOSPITALS', cx, 738, { size: 24, a: u01(t, EV.brand + 0.25, EV.brand + 0.55), align: 'center', rgb: INK, track: 16, wt: 500 });
    // the healwave under the name
    const open = E.outExpo(u01(t, EV.brand + 0.3, EV.brand + 1.1));
    if (open > 0) {
      const hw = 300 * open;
      const P = new Float32Array(2 * 120);
      for (let i = 0; i < 120; i++) {
        const s = i / 119;
        P[i * 2] = cx - hw + 2 * hw * s;
        P[i * 2 + 1] = 786 + Math.sin(s * Math.PI * 2 + t * 0.9) * 3 * open;
      }
      healwave(F, P, { screen: true, palette: HW_DAY, a: 0.95, width: 12, strands: 7, lw: 1.3, smooth: 40, twist: 1, phase: -t * 0.5, spread: (s) => 0.55 + 0.45 * Math.sin(Math.PI * s) });
      F.L.flush();
    }
  }
  if (t > 28.6) {
    mono(F, 'da Vinci, da Vinci X and EndoWrist are trademarks of Intuitive Surgical, Inc.  ·  Computer-generated imagery.', cx, 1030, { size: 12, a: 0.7 * u01(t, 28.6, 28.9), align: 'center', rgb: '90,96,108', track: 1, wt: 400 });
  }
  void clamp;
  void lerp;
}
