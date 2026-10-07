// The film's grade over time: background field, bloom, lens, grain, fades, motion-blur samples.
import { clamp, E, lerp } from './engine/util.js';
import { G } from './palette.js';

const NIGHT = {
  bg0: G.NIGHT_C, bg1: G.NIGHT_E, bgC: [0.5, 0.5], bgR: 1.15, bg2: G.BLUE_GLOW, bg2Amt: 0.0,
  bloom: 1.0, glow: 1.0, baseBloom: 0.2, bloomThresh: 0.78, bloomSpread: 0.9,
  exposure: 1.0, ca: 1.6, vig: 0.8, vigTint: [0.35, 0.4, 0.55], sat: 1.0, grain: 0.032,
  fadeBlack: 0, fadeWhite: 0, bloomTint: [1, 1, 1], mb: 1,
};
const VOID = { ...NIGHT, bg0: [0.012, 0.022, 0.05], bg1: [0.0, 0.004, 0.012], bgR: 0.9 };
const DEEP = { ...NIGHT, bg0: G.DEEP_C, bg1: G.DEEP_E, bgR: 1.25 };
const DAY = {
  ...NIGHT, bg0: G.DAY_C, bg1: G.DAY_E, bgR: 1.35, bg2: [0, 0, 0], bg2Amt: 0,
  bloom: 0.35, glow: 0.6, baseBloom: 0.0, vig: 0.22, vigTint: [0.86, 0.89, 0.95], ca: 0.8, grain: 0.018,
};

const with_ = (base, o) => ({ ...base, ...o });

// [time, look, ease-into-this-key]
const KEYS = [
  [0.0, with_(VOID, { fadeBlack: 1 })],
  [1.4, VOID, E.inOutSine],
  [9.6, with_(VOID, { bg2: G.RED_GLOW, bg2Amt: 0.05 })],
  [12.5, NIGHT],
  [15.0, with_(NIGHT, { mb: 3 })],
  [17.5, with_(NIGHT, { bg2Amt: 0.06, mb: 3 })],
  [21.0, with_(NIGHT, { mb: 2 })],
  [23.0, with_(DEEP, { bg2Amt: 0.08, mb: 3 })],
  [26.0, with_(NIGHT, { mb: 3 })],
  [27.0, with_(NIGHT, { mb: 1 })],
  [35.0, with_(NIGHT, { mb: 1 })],
  [36.0, with_(NIGHT, { mb: 4 })],
  [37.0, with_(NIGHT, { mb: 1 })],
  [43.0, with_(NIGHT, { mb: 1 })],
  [44.0, with_(NIGHT, { mb: 4 })],
  [45.0, with_(NIGHT, { mb: 1 })],
  [51.0, with_(NIGHT, { mb: 1 })],
  [52.0, with_(NIGHT, { mb: 4, bg2: G.RED_GLOW, bg2Amt: 0.04 })],
  [53.0, with_(NIGHT, { mb: 1, bg2: G.RED_GLOW, bg2Amt: 0.05 })],
  [59.0, with_(NIGHT, { mb: 1, bg2: G.RED_GLOW, bg2Amt: 0.02 })],
  [60.0, with_(NIGHT, { mb: 4 })],
  [61.0, with_(DEEP, { mb: 1 })],
  [67.5, with_(DEEP, { mb: 1 })],
  [68.5, with_(DEEP, { mb: 5 })],
  [76.0, with_(DEEP, { mb: 3, bg2Amt: 0.08 })],
  [82.0, with_(DEEP, { mb: 3, bg2Amt: 0.14, exposure: 1.06 })],
  [84.2, with_(DEEP, { mb: 4, exposure: 1.18, bg2Amt: 0.2 })],
  [84.45, with_(VOID, { mb: 4, exposure: 0.9 }), E.inQuad],
  [84.5, with_(DAY, { fadeWhite: 0.0 }), E.lin],
  [96.0, DAY],
  [106.0, DAY],
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
  L.mb = Math.max(1, Math.round(L.mb));
  return L;
}
