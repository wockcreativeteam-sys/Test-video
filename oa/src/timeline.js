// Master clock for "Every Step" (World OA Day). One source of truth for shots, the grade,
// the voice-over placement and every sound event (dumped to oa/audio/cues.json for the mixer).
export const FPS = 30;
export const DURATION = 60;
export const W = 1920;
export const H = 1080;

// shot windows [t0, t1] — they overlap: every transition is drawn by both neighbours
export const SHOT = {
  s01: [0.0, 4.25], // the first line
  s02: [3.7, 7.6], // the walk (inside the line)
  s03: [7.25, 12.3], // a life in one walk
  s04: [11.9, 16.6], // time breaks
  s05: [16.0, 20.6], // the first interruption
  s06: [20.1, 24.9], // slower
  s07: [24.4, 29.5], // resistance
  s08: [29.0, 33.4], // the human scale
  s09: [32.9, 37.3], // the memory glitch
  s10: [36.9, 41.2], // she
  s11: [40.8, 45.6], // the loop
  s12: [45.2, 49.8], // now
  s13: [49.4, 56.4], // the pledge
  s14: [56.0, 60.0], // the final image
};

// voice-over: [key, start] (durations come from oa/audio/vo/durations.json)
export const VO = [
  ['v01', 1.35], // The first time she held your hand…
  ['v02', 4.35], // …she taught you how to walk.
  ['v03', 7.75], // She walked us to school. Ran behind us. Ran ahead of us.
  ['v04', 12.55], // And somehow, always kept going.
  ['v05', 16.9], // Then, somewhere along the way…
  ['v06', 20.9], // …she started walking a little slower.
  ['v07a', 25.0], // Not because she wanted to stop.
  ['v07b', 27.3], // Because every step began to hurt.
  ['v08', 29.75], // For us, she may be a patient with osteoarthritis.
  ['v09', 33.9], // But for someone…
  ['v10', 37.4], // …she is the woman who never stopped showing up.
  ['v11', 41.6], // The first time she held your hand, she taught you how to walk.
  ['v12', 45.9], // Maybe now, it's time to notice how she walks.
  ['v13a', 49.8], // This World OA Day, let's take a pledge.
  ['v13b', 52.95], // Notice the signs. Address the pain. Keep life moving.
];

const range = (a, n, d) => Array.from({ length: n }, (_, i) => +(a + i * d).toFixed(3));

// ---- events (seconds) -------------------------------------------------------------------------
export const EV = {
  breath: 0.12,
  pointOn: 0.55,
  dive: [0.72, 1.6],
  touch: 2.3, // "held" — the radial wave
  constellation: 2.55,
  map: 3.05,
  path: 3.5,
  tunnelIn: 3.95,
  frags: [4.55, 4.95, 5.28, 5.55, 5.77, 5.95, 6.1], // memory fragments, accelerating
  legsOut: 6.2,
  wordSteps: [5.34, 5.66, 5.98, 6.3], // HOW TO WALK. stepping toward camera
  // footfalls of the life walk: 2 in the tunnel exit, 9 worlds, then into the clock
  walkSteps: [6.42, 6.95, ...range(7.48, 9, 0.53), 12.25],
  worlds: ['school', 'street', 'kitchen', 'hospital', 'wedding', 'bedroom', 'airport', 'rain', 'stairs'],
  words03: { walked: [7.7, 9.15], ran: [9.2, 10.45], keptGoing: [10.45, 12.4] },
  clockPull: [11.95, 13.0],
  ages: [13.1, 13.6, 14.1, 14.6], // 20s 30s 40s 50s pass under the second hand
  stutter: [14.8, 15.06, 15.32], // one frame repeats. again. again.
  clockSlow: [15.6, 16.6],
  firstRed: 15.32, // red appears, almost invisibly
  stairSteps: [16.62, 17.28, 17.96, 18.7, 19.5],
  redHits: [17.96, 18.7],
  kneeDive: [19.55, 20.5],
  // the same walk, slowing: 100% 90% 80% 70% 50% 30%
  slowSteps: [20.55, 21.08, 21.66, 22.32, 23.08, 24.14],
  slowRates: [1.0, 1.0, 0.9, 0.8, 0.7, 0.5, 0.3],
  jointIn: [24.4, 25.2],
  collisions: [25.0, 25.75, 26.55, 27.4, 28.25, 28.8],
  textStop: 26.25,
  hurt: 28.8,
  explode: 29.2,
  room: [29.45, 30.9],
  patientSteps: [30.25, 30.95, 31.75, 32.42, 33.2],
  notices: 31.35,
  oaWord: [31.55, 32.75],
  pupil: [33.0, 34.55],
  stair09: 34.6,
  hand09: 35.25,
  memory09: 35.85,
  she: 37.0,
  throughH: [37.85, 38.9],
  memories10: [38.5, 40.3],
  showing: [39.4, 40.45],
  collapse: [40.4, 41.0],
  motherHand: [41.0, 42.1],
  touch11: 42.5,
  redOut: [43.0, 43.36, 43.7, 44.08, 44.42, 44.8, 45.15],
  pullOut12: [45.25, 46.4],
  togetherSteps: range(45.6, 7, 0.62),
  stars: [47.6, 49.4],
  purple: 49.45,
  lineIn: 49.7,
  redMarks: [52.62, 54.02, 55.22],
  pledge: [52.95, 54.38, 55.55], // NOTICE. ADDRESS. KEEP MOVING.
  figure: [56.15, 57.15],
  finalStep: 57.3,
  brand: 57.42,
  supers: { day: 56.7, line: 57.35, brand: 57.6, support: 57.85 },
  end: 60.0,
};

/** progress helper used by shots: local time inside a shot */
export const local = (t, key) => t - SHOT[key][0];
