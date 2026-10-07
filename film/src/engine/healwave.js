// The Healwave — Wockhardt's brand ribbon: many fine coloured strands travelling together,
// fanning and converging, flipping like a flat tape when it twists. Drawn as offset copies of a
// centreline in screen space, so it reads the same from any camera angle.
import { clamp, lerp } from './util.js';

// strand colours, in ribbon order (sampled from the brand artwork)
export const HW = [
  '242,146,184', // light pink
  '236,112,132', // coral pink
  '226,70,146', // magenta
  '188,86,164', // orchid
  '140,90,176', // purple
  '106,112,200', // indigo
  '56,118,198', // blue
  '98,180,222', // sky
  '44,166,122', // green
  '238,174,72', // gold
  '242,152,122', // peach
  '224,76,94', // coral red
];
// the same hues, pushed to full luminance for night scenes (lines on a dark field)
export const HW_NIGHT = [
  '255,150,196', // pink
  '255,84,160', // magenta
  '226,92,226', // orchid
  '164,108,255', // violet
  '104,132,255', // indigo
  '48,164,255', // blue
  '70,214,255', // sky
  '40,220,170', // teal-green
  '150,226,90', // green
  '255,214,70', // gold
  '255,156,72', // orange
  '255,96,100', // coral
];
// a deeper subset that holds up on white
export const HW_DAY = ['214,52,132', '160,70,160', '98,92,184', '40,104,180', '30,150,110', '226,150,40', '226,90,84'];
export const HW_HEAD = '238,84,160'; // write-head glow
export const HW_CORE = '255,238,248';

const P4 = [0, 0, 0, 0];
let SX = new Float32Array(4096), SY = new Float32Array(4096), SK = new Float32Array(4096), SZ = new Float32Array(4096);
let CUM = new Float32Array(4096), NX = new Float32Array(4096), NY = new Float32Array(4096), VA = new Float32Array(4096);

function grow(n) {
  if (SX.length >= n) return;
  const m = Math.ceil(n * 1.5);
  SX = new Float32Array(m); SY = new Float32Array(m); SK = new Float32Array(m); SZ = new Float32Array(m);
  CUM = new Float32Array(m); NX = new Float32Array(m); NY = new Float32Array(m); VA = new Float32Array(m);
}

/**
 * Draw a healwave along a polyline.
 * P: Float32Array, world xyz (stride 3) or screen xy with o.screen (stride 2).
 * o: width   full ribbon width in px (at k = persp when persp is set)
 *    strands number of strands (default 10), lw strand width (px), palette (array of 'r,g,b')
 *    from,to draw-on range along the line (fractions of its world/screen length)
 *    a       alpha; fade [aStart, aEnd] along the visible part; fog [z0,z1,aMin]; near [z0,z1]
 *    persp   scale width with perspective (k / persp)
 *    twist   half-twists along the visible length; phase shifts them (animate with time)
 *    spread  optional fn(u) -> width multiplier along the visible part (u = 0 start .. 1 end)
 *    smooth  px half-window for the ribbon's normal (keeps sharp waveforms from tangling)
 *    glow    halo strength on the glow layer; layer for the strands (0 base, 2 base+glow)
 *    head    write-head at the drawing end: { r, g, gi } (colours are the brand head colours)
 * Returns the screen position of the drawing end (or null).
 */
export function healwave(F, P, o = {}) {
  const screen = !!o.screen;
  const stride = screen ? 2 : 3;
  const n0 = (P.length / stride) | 0;
  if (n0 < 2 || (o.a ?? 1) <= 0.003) return null;
  grow(n0 + 2);
  const cam = F.cam;
  const from = o.from ?? 0, to = o.to ?? 1;
  if (to <= from) return null;
  // arc length along the source line (world or screen) for the draw-on range
  let total = 0;
  CUM[0] = 0;
  for (let i = 1; i < n0; i++) {
    const a = (i - 1) * stride, b = i * stride;
    const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = screen ? 0 : P[b + 2] - P[a + 2];
    total += Math.sqrt(dx * dx + dy * dy + dz * dz);
    CUM[i] = total;
  }
  const L0 = from * total, L1 = to * total;
  const xf = o.xf;
  // visible vertices (interpolated ends), projected
  let n = 0;
  const push = (x, y, z) => {
    if (screen) {
      SX[n] = x; SY[n] = y; SK[n] = 1; SZ[n] = 1; n++;
      return true;
    }
    if (xf) {
      x = xf[0] + (x - xf[0]) * xf[3];
      y = xf[1] + (y - xf[1]) * xf[3];
      z = xf[2] + (z - xf[2]) * xf[3];
    }
    if (!cam.project(x, y, z, P4)) return false;
    SX[n] = P4[0]; SY[n] = P4[1]; SZ[n] = P4[2]; SK[n] = P4[3]; n++;
    return true;
  };
  const at = (i, u) => {
    const a = i * stride, b = (i + 1) * stride;
    return [lerp(P[a], P[b], u), lerp(P[a + 1], P[b + 1], u), screen ? 0 : lerp(P[a + 2], P[b + 2], u)];
  };
  for (let i = 0; i < n0; i++) {
    const c = CUM[i];
    if (c < L0) {
      if (i + 1 < n0 && CUM[i + 1] > L0) {
        const q = at(i, (L0 - c) / Math.max(1e-9, CUM[i + 1] - c));
        push(q[0], q[1], q[2]);
      }
      continue;
    }
    if (c > L1) {
      if (i > 0 && CUM[i - 1] < L1) {
        const q = at(i - 1, (L1 - CUM[i - 1]) / Math.max(1e-9, c - CUM[i - 1]));
        push(q[0], q[1], q[2]);
      }
      break;
    }
    const b = i * stride;
    if (!push(P[b], P[b + 1], screen ? 0 : P[b + 2]) && n > 1) break;
  }
  if (n < 2) return null;
  // screen arc length of the visible part
  CUM[0] = 0;
  for (let i = 1; i < n; i++) CUM[i] = CUM[i - 1] + Math.hypot(SX[i] - SX[i - 1], SY[i] - SY[i - 1]);
  const sl = CUM[n - 1] || 1;
  // smoothed normals: tangent across a window of +-smooth px
  const w = o.smooth ?? 24;
  let j0 = 0, j1 = 0;
  for (let i = 0; i < n; i++) {
    while (j0 < i && CUM[i] - CUM[j0] > w) j0++;
    while (j1 < n - 1 && CUM[j1] - CUM[i] < w) j1++;
    let tx = SX[j1] - SX[j0], ty = SY[j1] - SY[j0];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    NX[i] = -ty;
    NY[i] = tx;
  }
  // keep the normal field from flipping between neighbours
  for (let i = 1; i < n; i++) {
    if (NX[i] * NX[i - 1] + NY[i] * NY[i - 1] < 0) {
      NX[i] = -NX[i];
      NY[i] = -NY[i];
    }
  }
  // per-vertex alpha: fade along the visible part, depth fog, near fade
  const a0 = o.a ?? 1, fade = o.fade, fog = o.fog, near = o.near;
  for (let i = 0; i < n; i++) {
    const u = CUM[i] / sl;
    let a = a0;
    if (fade) a *= lerp(fade[0], fade[1], u);
    if (!screen) {
      if (fog) a *= lerp(1, fog[2], clamp((SZ[i] - fog[0]) / (fog[1] - fog[0])));
      if (near) a *= clamp((SZ[i] - near[0]) / (near[1] - near[0]));
    }
    VA[i] = a;
  }
  const pal = o.palette || HW_NIGHT;
  const ns = o.strands ?? 10;
  const width = o.width ?? 18;
  const persp = o.persp || 0;
  const twist = o.twist ?? 0, phase = o.phase ?? 0;
  const spreadFn = o.spread;
  const lw = o.lw ?? 1.25;
  const layer = o.layer ?? 0;
  const L = F.L;
  const buf = new Float32Array(n * 2);
  const segAlpha = (s) => 0.5 * (VA[s] + VA[s + 1]);
  // a soft halo under the ribbon (glow layer)
  if (o.glow) {
    for (let i = 0; i < n; i++) {
      buf[i * 2] = SX[i];
      buf[i * 2 + 1] = SY[i];
    }
    L.poly2(buf, { rgb: o.glowRgb || '255,236,246', a: o.glow, w: Math.max(2, width * 0.5), layer: 1, segAlpha });
  }
  for (let k = 0; k < ns; k++) {
    const c = ns > 1 ? k / (ns - 1) - 0.5 : 0;
    for (let i = 0; i < n; i++) {
      const u = CUM[i] / sl;
      let wd = width;
      if (persp) wd *= clamp(SK[i] / persp, 0.35, 2.5);
      let sp = spreadFn ? spreadFn(u, i) : 1;
      if (twist) sp *= lerp(1, Math.cos(Math.PI * twist * u + phase), clamp(u * (o.openRate ?? 4)));
      const off = c * wd * sp;
      buf[i * 2] = SX[i] + NX[i] * off;
      buf[i * 2 + 1] = SY[i] + NY[i] * off;
    }
    L.poly2(buf, { rgb: pal[Math.round((k / Math.max(1, ns - 1)) * (pal.length - 1))], a: 1, w: lw, layer, segAlpha });
  }
  const end = [SX[n - 1], SY[n - 1], SZ[n - 1], SK[n - 1]];
  if (o.head && to < 1.0001) {
    const h = o.head;
    L.head(end[0], end[1], { r: h.r ?? 2.6, rgb: HW_HEAD, core: HW_CORE, g: h.g ?? 34, gi: h.gi ?? 0.85, a: h.a ?? a0, streak: h.streak });
  }
  return end;
}

/** the life point when it is only a point: white-hot core in a magenta halo with a faint rainbow rim */
export function healPoint(F, x, y, o = {}) {
  const a = o.a ?? 1;
  if (a <= 0.003) return;
  const r = o.r ?? 3;
  const ctx = F.ctx;
  if (o.rim !== false) {
    // rainbow rim: the strand colours around a ring
    const rr = r * (o.rimScale ?? 2.6);
    const pal = o.day ? HW_DAY : HW;
    for (let k = 0; k < pal.length; k++) {
      const a0 = (k / pal.length) * Math.PI * 2 + (o.spin ?? 0), a1 = a0 + (Math.PI * 2) / pal.length;
      ctx.strokeStyle = `rgba(${pal[k]},${0.85 * a})`;
      ctx.lineWidth = Math.max(1, r * 0.45);
      ctx.beginPath();
      ctx.arc(x, y, rr, a0, a1 + 0.02);
      ctx.stroke();
    }
  }
  if (o.rimOnly) return;
  F.L.head(x, y, { r, rgb: o.day ? '214,52,132' : HW_HEAD, core: o.day ? '214,52,132' : HW_CORE, g: o.g ?? 30, gi: (o.gi ?? 0.8) * (o.day ? 0.4 : 1), a, streak: o.streak });
}
