// 01:36–01:46  IDENTITY — the opening gesture returns on white: a red point, a hairline, the name.
// If an official logo file is supplied at assets/brand/logo.png it replaces the typographic
// lockup (the typographic version is a stand-in, not the registered mark).
import { C } from '../palette.js';
import { E, clamp, env, lerp, seg } from '../engine/util.js';
import { text, layout } from '../engine/type.js';
import { glowDot } from '../engine/lines.js';
import { WRIST } from './s08_human.js';
import { halo } from './common.js';

const BRAND_RED = '214,28,40';
let LOGO = null;

export const S09 = {
  id: 'end',
  t0: 95.2,
  t1: 106.1,
  async init() {
    try {
      const r = await fetch('assets/brand/logo.png', { method: 'HEAD' });
      if (r.ok) {
        const img = new Image();
        img.src = 'assets/brand/logo.png';
        await img.decode();
        LOGO = img;
      }
    } catch (e) {
      LOGO = null;
    }
  },
  draw(F, lt, t) {
    const ctx = F.ctx;
    const cx = 960, ly = 548;
    // the point travels from the baby's wrist to the centre: the same point that opened the film
    const go = E.inOutCubic(seg(t, 95.4, 96.4));
    const px = lerp(WRIST[0], cx, go), py = lerp(WRIST[1], ly, go);
    const open = E.outExpo(seg(t, 96.3, 97.4));
    const halfW = 300 * open;
    const beat = Math.exp(-Math.max(0, t - 101.2) * 6) * (t > 101.2 ? 1 : 0) + Math.exp(-Math.max(0, t - 101.48) * 7) * (t > 101.48 ? 0.6 : 0);
    // hairline
    if (open > 0) {
      ctx.strokeStyle = `rgba(${C.INK},${0.85})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - halfW, ly);
      ctx.lineTo(cx + halfW, ly);
      ctx.stroke();
    }
    // the point rides to the end of the line and stays there as the final heartbeat
    const ride = E.inOutCubic(seg(t, 97.0, 98.0));
    const dotX = lerp(px, cx + halfW + 22, ride), dotY = py;
    halo(F, dotX, dotY, 24 + beat * 44, C.RED, 0.14 + 0.16 * beat);
    ctx.fillStyle = `rgba(${C.RED},1)`;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4.2 + beat * 2.6, 0, Math.PI * 2);
    ctx.fill();

    if (LOGO) {
      const a = seg(t, 96.6, 97.6, E.inOutCubic);
      const h = 150, w = (LOGO.width / LOGO.height) * h;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.drawImage(LOGO, cx - w / 2, ly - h - 24, w, h);
      ctx.restore();
    } else {
      // typographic lockup (stand-in for the registered mark)
      const s1 = { fam: 'D', wt: 700, size: 104, track: 0.035, align: 'c', rgb: BRAND_RED, a: 1 };
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, 1920, ly - 2);
      ctx.clip();
      text(F, 'WOCKHARDT', cx, ly - 30 + (1 - E.outExpo(seg(t, 96.7, 97.9))) * 120, { ...s1 });
      ctx.restore();
      text(F, 'HOSPITALS', cx, ly + 58, {
        fam: 'D', wt: 500, size: 27, track: 0.62, align: 'c', rgb: C.INK, a: 1,
        anim: { mode: 'blur', t: t - 97.3, dur: 0.9, stag: 0.04, blurPx: 6 },
      });
    }
    text(F, 'TECHNOLOGY FIRST. LIFE ALWAYS.', cx, ly + 178, {
      fam: 'D', wt: 400, size: 30, track: 0.2, align: 'c', rgb: C.BLUE, a: 1,
      anim: { mode: 'blur', t: t - 98.6, dur: 1.0, stag: 0.03, blurPx: 7 },
    });
    void clamp;
    void env;
    void layout;
  },
};
