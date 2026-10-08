// "Every Step" colour system: three colours with fixed meanings.
//   PURPLE — the world, memory, time, emotion (backgrounds, architecture, memory layers)
//   GREEN  — life, movement, energy, possibility (the line, the walking body)
//   RED    — pain, resistance, interruption (never decorative; grows, then recedes)
// Strings are "r,g,b" for the canvas engines; arrays are 0..1 for GL.
export const C = {
  GREEN: '92,255,122',
  GREEN_HI: '200,255,210', // white-hot core of the line
  GREEN_DIM: '30,170,92',
  GREEN_DEEP: '18,110,64',
  RED: '255,46,78',
  RED_HI: '255,190,198',
  RED_DIM: '190,24,52',
  VIOLET: '150,112,236', // world lines
  VIOLET_HI: '206,186,255',
  VIOLET_DIM: '92,66,168',
  VIOLET_DEEP: '58,36,112',
  LILAC: '232,222,255', // type
  WHITE: '255,255,255',
};

// float versions for particles / GL (linear-ish 0..1)
export const F = {
  GREEN: [0.36, 1.0, 0.48],
  GREEN_HI: [0.71, 1.0, 0.81],
  RED: [1.0, 0.18, 0.31],
  VIOLET: [0.59, 0.44, 0.93],
  VIOLET_HI: [0.81, 0.73, 1.0],
  LILAC: [0.91, 0.87, 1.0],
  WARM: [1.0, 0.78, 0.52],
};

export const G = {
  // purple world: centre / edge of the background field
  P_C: [0.085, 0.036, 0.16],
  P_E: [0.012, 0.004, 0.03],
  P_DEEP_C: [0.05, 0.018, 0.1],
  P_DEEP_E: [0.006, 0.002, 0.016],
  P_PURE: [0.2, 0.09, 0.36], // "pure purple" of the pledge
  P_PURE_E: [0.07, 0.025, 0.14],
  BLACK: [0, 0, 0],
  GREEN_GLOW: [0.1, 0.5, 0.25],
  RED_GLOW: [0.5, 0.05, 0.1],
  VIOLET_GLOW: [0.28, 0.16, 0.55],
};

export const rgbStr = (a, k = 255) => `${Math.round(a[0] * k)},${Math.round(a[1] * k)},${Math.round(a[2] * k)}`;
