// Typography as geometry. Glyph outlines (opentype.js) flattened to polygons in em units
// (baseline y = 0, y down), so words can be projected in 3D, bent along paths, extruded,
// stretched, stuttered or poured into particles.
import opentype from '../../../oa/vendor/opentype.module.js';

export const FONTS = {};
const FILES = {
  D200: 'InterDisplay-ExtraLight.otf',
  D300: 'InterDisplay-Light.otf',
  D400: 'InterDisplay-Regular.otf',
  D500: 'InterDisplay-Medium.otf',
  D600: 'InterDisplay-SemiBold.otf',
  D700: 'InterDisplay-Bold.otf',
};

export async function loadGlyphFonts(base = '../oa/assets/fonts/') {
  await Promise.all(
    Object.entries(FILES).map(async ([k, f]) => {
      const buf = await (await fetch(base + f)).arrayBuffer();
      FONTS[k] = opentype.parse(buf);
    })
  );
}

const SEG = 0.0045; // flattening step (em)

function flatten(cmds, upm) {
  const contours = [];
  let cur = null, px = 0, py = 0, sx = 0, sy = 0;
  const push = (x, y) => {
    cur.push(x / upm, -y / upm);
  };
  for (const c of cmds) {
    if (c.type === 'M') {
      if (cur && cur.length > 4) contours.push(new Float32Array(cur));
      cur = [];
      px = sx = c.x;
      py = sy = c.y;
      push(px, py);
    } else if (c.type === 'L') {
      px = c.x;
      py = c.y;
      push(px, py);
    } else if (c.type === 'Q') {
      const len = Math.hypot(c.x1 - px, c.y1 - py) + Math.hypot(c.x - c.x1, c.y - c.y1);
      const n = Math.max(2, Math.ceil(len / upm / SEG));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        push(u * u * px + 2 * u * t * c.x1 + t * t * c.x, u * u * py + 2 * u * t * c.y1 + t * t * c.y);
      }
      px = c.x;
      py = c.y;
    } else if (c.type === 'C') {
      const len = Math.hypot(c.x1 - px, c.y1 - py) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2);
      const n = Math.max(3, Math.ceil(len / upm / SEG));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        const a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
        push(a * px + b * c.x1 + d * c.x2 + e * c.x, a * py + b * c.y1 + d * c.y2 + e * c.y);
      }
      px = c.x;
      py = c.y;
    } else if (c.type === 'Z') {
      if (cur && cur.length > 4) {
        // drop a duplicated closing point
        const n = cur.length;
        if (Math.abs(cur[n - 2] - cur[0]) < 1e-6 && Math.abs(cur[n - 1] - cur[1]) < 1e-6) cur.length = n - 2;
        contours.push(new Float32Array(cur));
      }
      cur = null;
      px = sx;
      py = sy;
    }
  }
  if (cur && cur.length > 4) contours.push(new Float32Array(cur));
  return contours;
}

const glyphCache = new Map();
function glyphOutline(font, key, glyph) {
  const k = key + '|' + glyph.index;
  let g = glyphCache.get(k);
  if (g) return g;
  const path = glyph.getPath(0, 0, font.unitsPerEm);
  // getPath returns y-down canvas coordinates already scaled to fontSize = upm
  const cmds = path.commands.map((c) => {
    const o = { type: c.type };
    for (const p of ['x', 'y', 'x1', 'y1', 'x2', 'y2']) if (c[p] !== undefined) o[p] = p[0] === 'y' ? -c[p] : c[p];
    return o;
  });
  const contours = flatten(cmds, font.unitsPerEm);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of contours)
    for (let i = 0; i < c.length; i += 2) {
      x0 = Math.min(x0, c[i]); x1 = Math.max(x1, c[i]);
      y0 = Math.min(y0, c[i + 1]); y1 = Math.max(y1, c[i + 1]);
    }
  g = { contours, bbox: [x0, y0, x1, y1], adv: glyph.advanceWidth / font.unitsPerEm };
  glyphCache.set(k, g);
  return g;
}

const shapeCache = new Map();
/**
 * Shape a string: { glyphs: [{ ch, x, adv, contours, bbox, cx }], width, asc, capH } in em units.
 * opts.track: extra tracking (em). Kerning from the font's GPOS table.
 */
export function shape(str, fam = 'D500', opts = {}) {
  const track = opts.track || 0;
  const key = fam + '|' + track + '|' + str;
  let S = shapeCache.get(key);
  if (S) return S;
  const font = FONTS[fam];
  if (!font) throw new Error('font not loaded ' + fam);
  const gl = font.stringToGlyphs(str);
  const upm = font.unitsPerEm;
  const out = [];
  let x = 0;
  for (let i = 0; i < gl.length; i++) {
    const g = gl[i];
    const o = glyphOutline(font, fam, g);
    out.push({ ch: str[i], x, adv: o.adv, contours: o.contours, bbox: o.bbox, cx: x + (o.bbox[0] + o.bbox[2]) / 2 });
    x += o.adv + track;
    if (i < gl.length - 1) x += font.getKerningValue(g, gl[i + 1]) / upm;
  }
  const capH = (font.tables.os2 && font.tables.os2.sCapHeight ? font.tables.os2.sCapHeight : 0.7 * upm) / upm;
  S = { str, glyphs: out, width: x - track, capH, fam };
  shapeCache.set(key, S);
  return S;
}

/**
 * Fill (or stroke) shaped text through an arbitrary mapping (x_em, y_em, glyph, glyphIndex) -> [sx, sy] | null.
 * opts: rgb, a, stroke (line width px, stroke instead of fill), alphaFn(glyph, i) -> alpha mult,
 *       skip(i) -> bool, ctx (defaults to F.ctx), glow (0..1 copy into the glow layer)
 */
export function drawShaped(F, S, map, opts = {}) {
  const ctxs = [opts.ctx || F.ctx];
  if (opts.glow) ctxs.push(F.g);
  const rgb = opts.rgb || '232,222,255';
  const a0 = opts.a ?? 1;
  if (a0 <= 0.003) return;
  for (let gi = 0; gi < S.glyphs.length; gi++) {
    const g = S.glyphs[gi];
    if (!g.contours.length) continue;
    if (opts.skip && opts.skip(gi, g)) continue;
    const a = a0 * (opts.alphaFn ? opts.alphaFn(gi, g) : 1);
    if (a <= 0.003) continue;
    for (let ci = 0; ci < ctxs.length; ci++) {
      const ctx = ctxs[ci];
      ctx.beginPath();
      let ok = true;
      for (const c of g.contours) {
        for (let i = 0; i < c.length; i += 2) {
          const p = map(g.x + c[i], c[i + 1], g, gi);
          if (!p) {
            ok = false;
            break;
          }
          if (i === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        }
        if (!ok) break;
        ctx.closePath();
      }
      if (!ok) continue;
      const aa = ci === 0 ? a : a * opts.glow;
      if (opts.stroke) {
        ctx.lineWidth = opts.stroke;
        ctx.strokeStyle = `rgba(${rgb},${aa})`;
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${opts.fillRgb || rgb},${aa})`;
        ctx.fill('nonzero');
      }
    }
  }
}

/** flat 2D placement: em (string coordinates) -> px at (x, y) baseline-left, with optional per-glyph offsets */
export function flatMap(x, y, size, per) {
  return (ex, ey, g, gi) => {
    if (per) {
      const o = per(gi, g);
      if (!o) return null;
      const sx = o.sx ?? 1, sy = o.sy ?? 1;
      const gx = g.cx; // scale around the glyph centre
      return [x + (gx + (ex - gx) * sx) * size + (o.dx || 0), y + ey * size * sy + (o.dy || 0)];
    }
    return [x + ex * size, y + ey * size];
  };
}

/** sample n points inside the glyphs (em coords). Deterministic. */
export function sampleShaped(S, n, seed = 1, res = 220) {
  const pad = 0.1;
  const W = Math.ceil((S.width + pad * 2) * res), H = Math.ceil(1.3 * res);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.fillStyle = '#fff';
  const oy = 1.0 * res;
  for (const g of S.glyphs) {
    c.beginPath();
    for (const ct of g.contours) {
      for (let i = 0; i < ct.length; i += 2) {
        const x = (g.x + ct[i] + pad) * res, y = oy + ct[i + 1] * res;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.closePath();
    }
    c.fill('nonzero');
  }
  const d = c.getImageData(0, 0, W, H).data;
  const cand = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4] > 127) cand.push(x, y);
  const m = cand.length / 2;
  const out = new Float32Array(n * 2);
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < n; i++) {
    const k = Math.floor(rnd() * m);
    out[i * 2] = (cand[k * 2] + rnd()) / res - pad;
    out[i * 2 + 1] = (cand[k * 2 + 1] + rnd() - oy) / res;
  }
  return out;
}

/** sample n points along the glyph outlines (em coords), evenly by arc length */
export function sampleOutline(S, n) {
  const segs = [];
  let total = 0;
  for (const g of S.glyphs)
    for (const c of g.contours) {
      const m = c.length / 2;
      for (let i = 0; i < m; i++) {
        const j = (i + 1) % m;
        const l = Math.hypot(c[j * 2] - c[i * 2], c[j * 2 + 1] - c[i * 2 + 1]);
        segs.push(g.x + c[i * 2], c[i * 2 + 1], g.x + c[j * 2], c[j * 2 + 1], total);
        total += l;
      }
    }
  const out = new Float32Array(n * 2);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const s = ((i + 0.5) / n) * total;
    while (k + 5 < segs.length && segs[k + 5 + 4] <= s) k += 5;
    const l0 = segs[k + 4], l1 = k + 5 < segs.length ? segs[k + 9] : total;
    const u = (s - l0) / Math.max(1e-9, l1 - l0);
    out[i * 2] = segs[k] + (segs[k + 2] - segs[k]) * u;
    out[i * 2 + 1] = segs[k + 1] + (segs[k + 3] - segs[k + 1]) * u;
  }
  return out;
}
