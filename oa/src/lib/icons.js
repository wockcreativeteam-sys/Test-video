// Small single-weight icons in [-0.5, 0.5]^2 (y up).
export function footprintIcon() {
  const out = [];
  const sole = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const y = Math.sin(a) * 0.33 - 0.05;
    const w = 0.13 + 0.05 * Math.max(0, Math.sin(a)) - 0.04 * Math.exp(-((y + 0.05) ** 2) / 0.01);
    sole.push(Math.cos(a) * w + 0.02 * Math.sin(a), y);
  }
  out.push(new Float32Array(sole));
  const toes = [[-0.11, 0.33, 0.055], [-0.03, 0.37, 0.045], [0.04, 0.36, 0.04], [0.1, 0.33, 0.035], [0.15, 0.28, 0.03]];
  for (const [x, y, r] of toes) {
    const c = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      c.push(x + Math.cos(a) * r, y + Math.sin(a) * r * 1.15);
    }
    out.push(new Float32Array(c));
  }
  return out;
}

/** a shoe-print (sole without toes): heel + forefoot in one outline */
export function solePrint() {
  const pts = [];
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const y = Math.sin(a);
    // wider forefoot (y > 0), narrow waist, round heel
    const w = 0.5 * (0.36 + 0.12 * Math.max(0, y) - 0.1 * Math.exp(-((y + 0.1) ** 2) / 0.08));
    pts.push(Math.cos(a) * w * (y > 0 ? 1 : 0.92), y * 0.5);
  }
  return [new Float32Array(pts)];
}
