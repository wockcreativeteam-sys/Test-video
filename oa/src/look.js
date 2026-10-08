// The grade over time: background field, bloom, particles, lens, grain, fades, motion-blur samples.
import { clamp, E, lerp } from './engine/util.js';
import { G } from './palette.js';

const BASE = {
  bg0: G.P_C, bg1: G.P_E, bgC: [0.5, 0.5], bgR: 1.1, bg2: G.VIOLET_GLOW, bg2Amt: 0.0,
  bloom: 0.9, glow: 1.0, part: 1.0, baseBloom: 0.25, bloomThresh: 0.72, bloomSpread: 0.9, partBloom: 0.9, partThresh: 0.25,
  exposure: 1.0, ca: 1.2, vig: 0.85, vigTint: [0.3, 0.22, 0.42], sat: 1.0, grain: 0.034,
  fadeBlack: 0, fadeWhite: 0, bloomTint: [1, 0.96, 1.04], mb: 1,
};
const VOID = { ...BASE, bg0: [0.0, 0.0, 0.0], bg1: [0, 0, 0], vig: 0.0 };
const DEEP = { ...BASE, bg0: G.P_DEEP_C, bg1: G.P_DEEP_E };
const PURE = { ...BASE, bg0: G.P_PURE, bg1: G.P_PURE_E, bgR: 1.3, vig: 0.6, grain: 0.026 };
const w = (b, o) => ({ ...b, ...o });

// [time, look, ease into this key]
const KEYS = [
  [0.0, w(VOID, { fadeBlack: 0 })],
  [0.7, VOID],
  [1.5, w(DEEP, { mb: 2 }), E.inQuad],
  [2.2, w(BASE, { mb: 2 })],
  [2.6, w(BASE, { bg2Amt: 0.18 })],
  [3.6, w(BASE, { bg2Amt: 0.08, mb: 2 })],
  [4.6, w(DEEP, { mb: 2 })],
  [6.4, w(DEEP, { mb: 1 })],
  [7.4, w(BASE, { mb: 1 })],
  [11.9, w(BASE, { mb: 1 })],
  [12.6, w(DEEP, { mb: 2, bg2Amt: 0.06 })],
  [16.0, w(DEEP, { mb: 1 })],
  [19.5, w(DEEP, { mb: 1 })],
  [20.2, w(DEEP, { mb: 2 })],
  [20.7, w(BASE, { mb: 1 })],
  [24.3, w(BASE, { mb: 1 })],
  [25.0, w(DEEP, { mb: 1, bg2: G.RED_GLOW, bg2Amt: 0.03 })],
  [28.9, w(DEEP, { mb: 1, bg2: G.RED_GLOW, bg2Amt: 0.06 })],
  [29.4, w(DEEP, { mb: 2 })],
  [30.4, w(BASE, { mb: 1 })],
  [33.0, w(BASE, { mb: 1 })],
  [34.2, w(DEEP, { mb: 2 })],
  [36.5, w(BASE, { mb: 1, bg2Amt: 0.1 })],
  [41.0, w(BASE, { mb: 1, bg2Amt: 0.06 })],
  [45.0, w(BASE, { mb: 1, bg2: G.GREEN_GLOW, bg2Amt: 0.04 })],
  [49.2, w(BASE, { mb: 1 })],
  [49.6, PURE, E.inOutSine],
  [56.0, PURE],
  [60.0, PURE],
];

export function look(t) {
  let i = 1;
  while (i < KEYS.length && KEYS[i][0] < t) i++;
  if (i >= KEYS.length) return { ...KEYS[KEYS.length - 1][1], time: t };
  const [t0, a] = KEYS[i - 1];
  const [t1, b, ease] = KEYS[i];
  const u = (ease || E.inOutCubic)(clamp((t - t0) / Math.max(t1 - t0, 1e-6)));
  const L = { time: t };
  for (const k in b) {
    const va = a[k] ?? b[k], vb = b[k];
    if (Array.isArray(vb)) L[k] = vb.map((v, j) => lerp(va[j], v, u));
    else L[k] = lerp(va, vb, u);
  }
  L.mb = Math.min(3, Math.max(1, Math.round(L.mb)));
  return L;
}
