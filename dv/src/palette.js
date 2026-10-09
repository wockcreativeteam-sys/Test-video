// da Vinci teaser colour system: graphite + cool white light, cyan instrumentation, white type.
// The brand red / healwave arrive only on the end card.
export const C = {
  CYAN: '79,227,255',
  CYAN_HI: '200,246,255',
  CYAN_DIM: '30,120,150',
  ICE: '226,244,255',
  WHITE: '255,255,255',
  GREY: '150,160,172',
  AMBER: '255,176,64',
  RED: '255,56,64',
  BRAND_RED: '214,28,40',
};
export const F = {
  CYAN: [0.31, 0.89, 1.0],
  CYAN_HI: [0.78, 0.96, 1.0],
  ICE: [0.88, 0.95, 1.0],
  WHITE: [1, 1, 1],
  SPARK: [1.0, 0.62, 0.25],
  AMBER: [1.0, 0.69, 0.25],
};
export const G = {
  VOID: [0.0, 0.0, 0.0],
  NIGHT_C: [0.018, 0.024, 0.032],
  NIGHT_E: [0.002, 0.003, 0.005],
  STUDIO_C: [0.03, 0.036, 0.045],
  STUDIO_E: [0.004, 0.005, 0.007],
  CYAN_GLOW: [0.1, 0.45, 0.6],
};
export const rgbStr = (a, k = 255) => `${Math.round(a[0] * k)},${Math.round(a[1] * k)},${Math.round(a[2] * k)}`;
