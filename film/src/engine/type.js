// Kinetic typography. Glyph positions come from prefix measurements so kerning survives
// per-glyph animation. Families: D = Inter Display, M = Geist Mono.
import { clamp, E, hash2, lerp } from './util.js';

const FAM = { D: '"Inter Display"', M: '"Geist Mono"' };
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const layoutCache = new Map();

function fontStr(s) {
  return `${s.wt || 400} ${s.size}px ${FAM[s.fam || 'D']}`;
}

export function layout(ctx, str, s) {
  const key = fontStr(s) + '|' + (s.track || 0) + '|' + str;
  let L = layoutCache.get(key);
  if (L) return L;
  ctx.save();
  ctx.font = fontStr(s);
  ctx.letterSpacing = '0px';
  const tr = (s.track || 0) * s.size;
  const xs = new Float32Array(str.length + 1);
  for (let i = 0; i <= str.length; i++) xs[i] = ctx.measureText(str.slice(0, i)).width + tr * i;
  const m = ctx.measureText(str || 'X');
  ctx.restore();
  // total width excludes trailing tracking
  L = { xs, w: xs[str.length] - (str.length ? tr : 0), asc: m.actualBoundingBoxAscent || s.size * 0.72 };
  layoutCache.set(key, L);
  return L;
}

export function measure(F, str, s) {
  return layout(F.ctx, str, s).w;
}

function originX(x, w, align) {
  return align === 'c' ? x - w / 2 : align === 'r' ? x - w : x;
}

/**
 * Draw a line of text with an optional reveal / exit animation.
 * s: { fam, wt, size, track, align, rgb, a, layer, glow,
 *      anim: {mode, t, dur, stag, ease}, out: {mode, t, dur, stag, x} }
 */
export function text(F, str, x, y, s) {
  const ctx = s.layer === 1 ? F.g : F.ctx;
  const L = layout(ctx, str, s);
  const x0 = originX(x, L.w, s.align || 'l');
  const a0 = s.a ?? 1;
  const rgb = s.rgb || '255,255,255';
  const an = s.anim, out = s.out;
  const n = str.length;
  ctx.save();
  ctx.font = fontStr(s);
  ctx.letterSpacing = '0px';
  ctx.textBaseline = 'alphabetic';
  const mode = an ? an.mode : null;
  const clipRise = mode === 'rise' || (out && out.mode === 'drop');
  if (clipRise) {
    ctx.beginPath();
    ctx.rect(x0 - s.size, y - s.size * 1.02, L.w + s.size * 2, s.size * 1.3);
    ctx.clip();
  }
  for (let i = 0; i < n; i++) {
    let ch = str[i];
    if (ch === ' ') continue;
    let a = a0, dx = 0, dy = 0, blur = 0;
    if (an) {
      const stag = an.stag ?? 0.025, dur = an.dur ?? 0.6;
      const ease = an.ease || E.outExpo;
      const u = clamp((an.t - i * stag) / dur);
      if (u <= 0) continue;
      const e = ease(u);
      if (mode === 'rise') {
        dy = (1 - e) * s.size * 1.0;
        a *= clamp(u * 2.2);
      } else if (mode === 'fade') {
        a *= e;
      } else if (mode === 'blur') {
        a *= e;
        blur = (1 - e) * (an.blurPx ?? 10);
        dx = (1 - e) * (an.dx ?? s.size * 0.15) * (i - n / 2) / n;
      } else if (mode === 'decode') {
        if (u < 1) {
          const k = Math.floor(an.t * 30 + i * 7);
          ch = GLYPHS[Math.floor(hash2(i * 3.1, k) * GLYPHS.length)];
          a *= 0.55;
        }
      } else if (mode === 'type') {
        a *= u > 0 ? 1 : 0;
      }
    }
    if (out && out.t > 0) {
      const stag = out.stag ?? 0.02, dur = out.dur ?? 0.4;
      if (out.mode === 'scan') {
        const cx = x0 + (L.xs[i] + L.xs[i + 1]) / 2;
        if (cx < out.x) continue;
      } else {
        const u = clamp((out.t - i * stag) / dur);
        const e = (out.ease || E.inCubic)(u);
        if (out.mode === 'fade') a *= 1 - e;
        else if (out.mode === 'drop') {
          dy = -e * s.size * 1.0;
          a *= 1 - clamp(e * 1.4);
        } else if (out.mode === 'blur') {
          a *= 1 - e;
          blur = e * 10;
        }
      }
    }
    if (a <= 0.003) continue;
    if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(2)}px)`;
    ctx.fillStyle = `rgba(${rgb},${a})`;
    ctx.fillText(ch, x0 + L.xs[i] + dx, y + dy);
    if (s.glow) {
      F.g.save();
      F.g.font = ctx.font;
      F.g.fillStyle = `rgba(${s.glowRgb || rgb},${a * s.glow})`;
      F.g.fillText(ch, x0 + L.xs[i] + dx, y + dy);
      F.g.restore();
    }
    if (blur > 0.3) ctx.filter = 'none';
  }
  ctx.restore();
  return { x0, x1: x0 + L.w, w: L.w, y0: y - L.asc, y1: y };
}

/**
 * "EVERY [SECOND->DECISION] MATTERS." — the middle word rolls vertically like a
 * precision counter while the sentence re-centres around it.
 */
export function swapLine(F, pre, wA, wB, post, x, y, s, u) {
  const ctx = F.ctx;
  const lp = layout(ctx, pre, s).w;
  const la = layout(ctx, wA, s).w;
  const lb = layout(ctx, wB, s).w;
  const sp = layout(ctx, ' ', s).w + (s.track || 0) * s.size;
  const lpost = layout(ctx, post, s).w;
  const e = E.inOutQuart(clamp(u));
  const wm = lerp(la, lb, e);
  const total = lp + sp + wm + sp + lpost;
  const x0 = x - total / 2;
  const base = { ...s, align: 'l', anim: null };
  text(F, pre, x0, y, base);
  text(F, post, x0 + lp + sp + wm + sp, y, base);
  const mx = x0 + lp + sp;
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx - 20, y - s.size * 1.05, wm + 40, s.size * 1.35);
  ctx.clip();
  const h = s.size * 1.25;
  if (e < 1) text(F, wA, mx + (wm - la) / 2, y - e * h, { ...base, a: (s.a ?? 1) * (1 - e * 0.6) });
  if (e > 0) text(F, wB, mx + (wm - lb) / 2, y + (1 - e) * h, { ...base, a: (s.a ?? 1) * (0.4 + 0.6 * e) });
  ctx.restore();
  return { x0, w: total };
}

/** rolling numeric readout, mono, settles to value */
export function counter(F, value, decimals, x, y, s, u) {
  const v = value * E.outExpo(clamp(u));
  const str = (s.prefix || '') + v.toFixed(decimals) + (s.suffix || '');
  return text(F, str, x, y, s);
}
