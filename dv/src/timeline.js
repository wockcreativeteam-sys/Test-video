// "da Vinci Xi — launch teaser": 30 s at 30 fps on a 120 BPM grid (one beat = 0.5 s, one bar = 2 s).
// Every cut, impact and type event sits on the grid so picture and sound lock together.
export const FPS = 30;
export const DURATION = 30;
export const W = 1920;
export const H = 1080;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const B = (n) => +(n * BEAT).toFixed(4);

// shot windows (seconds); overlaps are drawn by both neighbours
export const SHOT = {
  s01: [0.0, 4.0], // darkness -> the line lights up, bank by bank
  s02: [4.0, 8.0], // STATION 01 — mobile base
  s03: [8.0, 12.0], // STATION 02 — column + boom
  s04: [12.0, 16.0], // STATION 03 — four arms
  s05: [16.0, 20.0], // STATION 04 — EndoWrist instruments
  s06: [20.0, 23.0], // STATION 05 — vision + calibration
  s07: [23.0, 30.0], // blackout -> hero reveal (stays under the end card)
  s08: [27.5, 30.0], // end card (2D, over the hero)
};

// sound/picture events (seconds)
export const EV = {
  boot: [0.25, 0.75, 1.25], // HUD boot ticks in the dark
  banks: [2.0, 2.5, 3.0, 3.25, 3.5, 3.75], // light banks slam on down the line
  baseArrive: 4.5, // pallet stops (clamp)
  bolts: [5.5, 6.0, 6.5, 7.0], // torque tools + sparks
  baseScan: [7.0, 7.75],
  columnDrop: 8.5,
  headDrop: 9.5,
  boomTurn: [10.0, 11.5],
  armLock: [12.5, 13.0, 13.5, 14.0], // arms 1-4 lock on
  armWake: [14.0, 14.75],
  typeFour: 14.5,
  typeOne: 15.25,
  instrForm: [16.0, 17.0], // the wrist assembles from light
  jaws: [17.5, 18.0, 18.5, 19.0], // jaw open/close + wrist moves
  insert: [19.0, 19.25, 19.5, 19.75], // instruments slide into the arms
  lens: 20.0,
  laser: 21.0,
  tremor: [21.75, 22.75],
  blackout: 23.0,
  reveal: 24.0,
  unfold: [24.0, 25.5],
  title: 25.5,
  sub: 26.0,
  end: 27.5,
  brand: 28.25,
  last: 29.5,
};
