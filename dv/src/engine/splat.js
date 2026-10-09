// HDR particle film. Particles are light: every splat adds energy into a float RGB buffer
// (energy-conserving, so a defocused particle spreads the same light over a wider disc).
//   pt      sub-pixel point (bilinear)
//   blob    soft disc (depth of field), sub-pixel kernels up to r = 4, flat-ish bokeh above
//   streak  motion-blurred point (energy spread along the path)
export class Splat {
  constructor(W, H) {
    this.W = W;
    this.H = H;
    this.buf = new Float32Array(W * H * 3);
    this.gain = 1;
    this.kc = new Map();
  }
  clear() {
    this.buf.fill(0);
  }
  pt(x, y, r, g, b) {
    const W = this.W, H = this.H;
    x -= 0.5;
    y -= 0.5;
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < -1 || iy < -1 || ix >= W || iy >= H) return;
    const fx = x - ix, fy = y - iy;
    const k = this.gain;
    r *= k; g *= k; b *= k;
    const B = this.buf;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    if (ix >= 0 && iy >= 0 && ix < W - 1 && iy < H - 1) {
      let o = (iy * W + ix) * 3;
      B[o] += r * w00; B[o + 1] += g * w00; B[o + 2] += b * w00;
      B[o + 3] += r * w10; B[o + 4] += g * w10; B[o + 5] += b * w10;
      o += W * 3;
      B[o] += r * w01; B[o + 1] += g * w01; B[o + 2] += b * w01;
      B[o + 3] += r * w11; B[o + 4] += g * w11; B[o + 5] += b * w11;
      return;
    }
    const add = (px, py, w) => {
      if (px < 0 || py < 0 || px >= W || py >= H) return;
      const o = (py * W + px) * 3;
      B[o] += r * w; B[o + 1] += g * w; B[o + 2] += b * w;
    };
    add(ix, iy, w00); add(ix + 1, iy, w10); add(ix, iy + 1, w01); add(ix + 1, iy + 1, w11);
  }
  /** kernel for radius index ri (radius = ri / 4 px) and sub-pixel phase (sx, sy in 0..3) */
  _kernel(ri, sx, sy) {
    const key = ri * 16 + sx * 4 + sy;
    let k = this.kc.get(key);
    if (k) return k;
    const rad = ri / 4;
    const R = Math.ceil(rad + 1.5);
    const n = 2 * R + 1;
    const w = new Float32Array(n * n);
    const ox = sx / 4 - 0.375, oy = sy / 4 - 0.375; // sub-pixel centre offset
    let s = 0;
    // soft-edged disc: flat core (bokeh) with a 1 px antialiased rim, gaussian-ish for small radii
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const dx = i - R - ox, dy = j - R - oy;
        const d = Math.hypot(dx, dy);
        let v;
        if (rad < 2.5) v = Math.exp(-(d * d) / (2 * Math.max(0.35, rad * 0.55) ** 2));
        else v = Math.min(1, Math.max(0, rad + 0.5 - d)) * (0.75 + 0.25 * Math.min(1, d / rad));
        w[j * n + i] = v;
        s += v;
      }
    for (let i = 0; i < w.length; i++) w[i] /= s || 1;
    k = { R, n, w };
    this.kc.set(key, k);
    return k;
  }
  blob(x, y, rad, r, g, b) {
    if (rad < 0.6) return this.pt(x, y, r, g, b);
    const W = this.W, H = this.H;
    let ri = Math.round(rad * 4);
    if (ri > 16) ri = Math.round(rad) * 4; // whole-pixel steps above r = 4
    if (ri > 4 * 48) ri = 4 * 48;
    const fx = x - 0.5, fy = y - 0.5;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const sx = ri <= 16 ? Math.min(3, Math.floor((fx - ix) * 4)) : 2;
    const sy = ri <= 16 ? Math.min(3, Math.floor((fy - iy) * 4)) : 2;
    const K = this._kernel(ri, sx, sy);
    const R = K.R, n = K.n, w = K.w, B = this.buf;
    const k = this.gain;
    r *= k; g *= k; b *= k;
    const x0 = ix - R, y0 = iy - R;
    const i0 = Math.max(0, -x0), i1 = Math.min(n, W - x0);
    const j0 = Math.max(0, -y0), j1 = Math.min(n, H - y0);
    for (let j = j0; j < j1; j++) {
      let o = ((y0 + j) * W + x0 + i0) * 3;
      let q = j * n + i0;
      for (let i = i0; i < i1; i++, o += 3, q++) {
        const v = w[q];
        if (v === 0) continue;
        B[o] += r * v;
        B[o + 1] += g * v;
        B[o + 2] += b * v;
      }
    }
  }
  /** motion-blurred particle: energy spread from (x0,y0) to (x1,y1) */
  streak(x0, y0, x1, y1, rad, r, g, b) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.min(160, Math.ceil(L / Math.max(0.7, rad * 0.8))));
    const s = 1 / n;
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      const x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
      if (rad < 0.6) this.pt(x, y, r * s, g * s, b * s);
      else this.blob(x, y, rad, r * s, g * s, b * s);
    }
  }
}
