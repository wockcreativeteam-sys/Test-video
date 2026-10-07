// Physiological waveforms, all driven by the shared heart track so picture and score agree.
import { HEART } from './timeline.js';
import { fbm1 } from './engine/util.js';

const gb = (x, mu, s) => Math.exp(-((x - mu) * (x - mu)) / (2 * s * s));

/** PQRST complex, p = seconds relative to the R peak */
export function ecgShape(p, lead = 0, wide = 1) {
  const L = LEADS[lead % LEADS.length];
  return (
    L.p * gb(p, -0.17, 0.026) -
    L.q * gb(p, -0.03 * wide, 0.009 * wide) +
    L.r * gb(p, 0, 0.0105 * wide) -
    L.s * gb(p, 0.032 * wide, 0.011 * wide) +
    L.t * gb(p, 0.27, 0.05)
  );
}
const LEADS = [
  { p: 0.11, q: 0.1, r: 1.0, s: 0.24, t: 0.27 }, // II
  { p: 0.08, q: 0.06, r: 0.7, s: 0.12, t: 0.2 }, // I
  { p: -0.08, q: 0.0, r: -0.55, s: -0.1, t: -0.18 }, // aVR
  { p: 0.06, q: 0.0, r: 0.25, s: 0.85, t: 0.22 }, // V1
  { p: 0.08, q: 0.12, r: 1.15, s: 0.3, t: 0.34 }, // V4
  { p: 0.1, q: 0.08, r: 0.85, s: 0.1, t: 0.26 }, // V6
];

function nearBeats(tau, beats) {
  // index of last beat <= tau + 0.45
  let lo = 0, hi = beats.length - 1, best = -1;
  const key = tau + 0.45;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (beats[m] <= key) {
      best = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return best;
}

export function ecg(tau, lead = 0, beats = HEART, delay = 0, wide = 1) {
  const t = tau - delay;
  const i = nearBeats(t, beats);
  if (i < 0) return 0;
  let v = 0;
  for (let k = Math.max(0, i - 1); k <= Math.min(beats.length - 1, i + 1); k++) {
    const p = t - beats[k];
    if (p > -0.3 && p < 0.55) v += ecgShape(p, lead, wide);
  }
  return v;
}

/** SpO2 plethysmograph (pulse arrives ~180 ms after R) */
export function pleth(tau, beats = HEART, delay = 0) {
  const t = tau - delay - 0.18;
  const i = nearBeats(t, beats);
  if (i < 0) return 0;
  let v = 0;
  for (let k = Math.max(0, i - 1); k <= i; k++) {
    const d = t - beats[k];
    if (d > -0.1 && d < 1.2) v += 0.85 * gb(d, 0.13, 0.065) + 0.3 * gb(d, 0.36, 0.08) + 0.12 * gb(d, 0.6, 0.15);
  }
  return v - 0.35;
}

/** arterial pressure: steep upstroke, dicrotic notch */
export function abp(tau, beats = HEART, delay = 0) {
  const t = tau - delay - 0.12;
  const i = nearBeats(t, beats);
  if (i < 0) return 0;
  let v = 0;
  for (let k = Math.max(0, i - 1); k <= i; k++) {
    const d = t - beats[k];
    if (d > -0.05 && d < 1.0) {
      const up = d < 0.08 ? Math.max(0, d / 0.08) : Math.exp(-(d - 0.08) * 3.2);
      v += 0.9 * up + 0.22 * gb(d, 0.34, 0.05);
    }
  }
  return v - 0.4;
}

export function resp(tau, period = 4.0, phase = 0) {
  const x = ((tau + phase) / period) * Math.PI * 2;
  return 0.55 * Math.sin(x) + 0.12 * Math.sin(2 * x + 0.6);
}

export function capno(tau, period = 4.0, phase = 0) {
  const u = (((tau + phase) / period) % 1 + 1) % 1;
  const rise = Math.min(1, Math.max(0, (u - 0.08) / 0.06));
  const fall = Math.min(1, Math.max(0, (u - 0.55) / 0.05));
  return 0.7 * (rise - fall) + 0.08 * u * rise * (1 - fall) - 0.3;
}

export function eeg(tau, seed = 1) {
  return 0.32 * fbm1(tau * 11, seed, 4) + 0.12 * Math.sin(tau * 62 + seed);
}

/** a signal for field line i (deterministic mix of types) */
export function fieldSignal(i, tau, delay) {
  const k = (i * 7 + 3) % 11;
  switch (k) {
    case 0: case 4: case 8: return 0.75 * ecg(tau, (i * 5) % 6, HEART, delay, 2.2);
    case 1: case 6: return 0.8 * pleth(tau, HEART, delay);
    case 2: return 0.7 * abp(tau, HEART, delay);
    case 3: case 9: return 0.6 * resp(tau, 4.0, i * 0.11);
    case 5: return 0.5 * capno(tau, 4.0, i * 0.07);
    default: return 0.75 * eeg(tau, i);
  }
}
