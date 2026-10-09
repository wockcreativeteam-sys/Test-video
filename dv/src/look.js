// The grade over time: background field, bloom, lens, grain, fades, motion-blur samples.
import { clamp, E, lerp } from './engine/util.js';
import { G } from './palette.js';

const BASE = {
  bg0: G.NIGHT_C, bg1: G.NIGHT_E, bgC: [0.5, 0.45], bgR: 1.1, bg2: G.CYAN_GLOW, bg2Amt: 0.0,
  bloom: 0.75, glow: 1.0, part: 1.0, baseBloom: 0.2, bloomThresh: 0.75, bloomSpread: 0.85, partBloom: 0.9, partThresh: 0.25,
  sceneBloom: 0.55, sceneThresh: 0.82,
  exposure: 1.0, ca: 1.0, vig: 0.7, vigTint: [0.2, 0.24, 0.3], sat: 1.0, grain: 0.03,
  fadeBlack: 0, fadeWhite: 0, bloomTint: [0.95, 1.0, 1.06], mb: 2,
};
const VOID = { ...BASE, bg0: G.VOID, bg1: G.VOID, vig: 0.0 };
const STUDIO = { ...BASE, bg0: G.STUDIO_C, bg1: G.STUDIO_E, bgR: 1.25 };
const CARD = { ...BASE, vig: 0.0, baseBloom: 0.0, bloom: 0.25, glow: 0.6, grain: 0.012, ca: 0.0, sceneBloom: 0.0 };
const w = (b, o) => ({ ...b, ...o });

// [time, look, ease into this key]
const KEYS = [
  [0.0, w(VOID, { mb: 1 })],
  [1.9, w(VOID, { mb: 1 })],
  [2.0, w(BASE, { mb: 2 }), E.outCubic],
  [23.0, w(BASE, { mb: 2 })],
  [23.05, w(BASE, { mb: 2, bloom: 0.95 })],
  [27.3, w(BASE, { mb: 2, bloom: 0.95 })],
  [27.55, w(BASE, { mb: 1, fadeWhite: 1, bloom: 1.4 }), E.inQuad],
  [27.8, w(CARD, { mb: 1, fadeWhite: 0 }), E.outCubic],
  [30.0, w(CARD, { mb: 1 })],
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
