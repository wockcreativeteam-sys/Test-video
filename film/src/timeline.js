// Master clock. One source of truth for scenes, grade and the score (dumped to JSON for audio).
export const FPS = 30;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const DURATION = 106;
export const W = 1920;
export const H = 1080;

// chapter starts (seconds)
export const T = {
  signal: 0,
  field: 10,
  body: 15,
  scan: 18,
  mri: 21,
  seg: 23.5,
  knee: 26,
  davinci: 36,
  onco: 44,
  cardiac: 52,
  neuro: 60,
  platform: 68,
  human: 84.5,
  end: 96,
};

// --- the heart track --------------------------------------------------------
// adult resting rhythm at 60 BPM locked to the musical grid (every other beat)
function adultBeats() {
  const b = [];
  for (let t = 2.0; t < 84.2; t += 1.0) {
    // cardiac chapter: a short irregular run (54.0–56.6) before rhythm is restored
    if (t >= 54 && t < 57) continue;
    b.push(t);
  }
  // arrhythmic run (irregularly irregular), then restored sinus from 57.0
  [54.0, 54.62, 55.48, 55.9, 56.55].forEach((x) => b.push(x));
  // final human moment: one adult heart, slow
  for (let t = 86.5; t < 95.6; t += 1.0) b.push(t);
  return b.sort((a, c) => a - c);
}
function babyBeats() {
  const b = [];
  for (let t = 87.25; t < 95.6; t += 0.43) b.push(+t.toFixed(3));
  return b;
}
export const HEART = adultBeats();
export const BABY = babyBeats();

/** time since the most recent beat at or before t (Infinity if none) */
export function sinceBeat(t, beats = HEART) {
  let lo = 0, hi = beats.length - 1, best = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (beats[m] <= t) {
      best = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return best < 0 ? Infinity : t - beats[best];
}

/** heartbeat pulse envelope 0..1 (sharp attack, exp decay), with the "dub" second sound */
export function pulse(t, beats = HEART, decay = 7) {
  const s = sinceBeat(t, beats);
  if (!isFinite(s)) return 0;
  const lub = Math.exp(-s * decay);
  const dub = s > 0.28 ? 0.55 * Math.exp(-(s - 0.28) * decay * 1.3) : 0;
  return Math.max(lub, dub);
}
