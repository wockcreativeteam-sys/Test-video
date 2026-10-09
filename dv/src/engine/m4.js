// Minimal column-major 4x4 matrices (GL layout) for the scene graph.
export const m4 = {
  ident() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  },
  mul(a, b, o = new Float32Array(16)) {
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++)
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  },
  T(x, y, z) {
    const o = m4.ident();
    o[12] = x;
    o[13] = y;
    o[14] = z;
    return o;
  },
  S(x, y = x, z = x) {
    const o = m4.ident();
    o[0] = x;
    o[5] = y;
    o[10] = z;
    return o;
  },
  RX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  },
  RY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  },
  RZ(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  },
  /** rotation about an arbitrary unit axis */
  RA(ax, a) {
    const [x, y, z] = ax;
    const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
    return new Float32Array([
      t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0,
      t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
      t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0,
      0, 0, 0, 1,
    ]);
  },
  /** product of a list of matrices, left to right */
  chain(...ms) {
    let o = ms[0];
    for (let i = 1; i < ms.length; i++) o = m4.mul(o, ms[i]);
    return o;
  },
  /** basis matrix: columns x, y, z axes and origin */
  basis(x, y, z, p) {
    return new Float32Array([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, p[0], p[1], p[2], 1]);
  },
  /** matrix whose local +Y axis points from a to b (length preserved, no scale), origin at a */
  alongY(a, b, upHint = [0, 0, 1]) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const L = Math.hypot(d[0], d[1], d[2]) || 1;
    const y = [d[0] / L, d[1] / L, d[2] / L];
    let x = cross(y, upHint);
    if (Math.hypot(x[0], x[1], x[2]) < 1e-5) x = cross(y, [1, 0, 0]);
    x = norm(x);
    const z = cross(x, y);
    return m4.basis(x, y, z, a);
  },
  apply(m, p) {
    const [x, y, z] = p;
    return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
  },
  dir(m, v) {
    const [x, y, z] = v;
    return [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
  },
  /** inverse of a rigid (rotation + translation) matrix */
  invRigid(m) {
    const o = new Float32Array(16);
    o[0] = m[0]; o[1] = m[4]; o[2] = m[8];
    o[4] = m[1]; o[5] = m[5]; o[6] = m[9];
    o[8] = m[2]; o[9] = m[6]; o[10] = m[10];
    o[12] = -(m[0] * m[12] + m[1] * m[13] + m[2] * m[14]);
    o[13] = -(m[4] * m[12] + m[5] * m[13] + m[6] * m[14]);
    o[14] = -(m[8] * m[12] + m[9] * m[13] + m[10] * m[14]);
    o[15] = 1;
    return o;
  },
  /** orthographic light view-projection looking along dir at centre, half-extent ext, depth range ±depth */
  orthoLight(centre, dir, ext, depth, upHint = [0, 1, 0]) {
    const f = norm(dir);
    let r = cross(f, Math.abs(f[1]) > 0.95 ? [0, 0, 1] : upHint);
    r = norm(r);
    const u = cross(r, f);
    // rows: r, u, -f (view space, light looks down -z)
    const V = new Float32Array([
      r[0], u[0], -f[0], 0,
      r[1], u[1], -f[1], 0,
      r[2], u[2], -f[2], 0,
      -(r[0] * centre[0] + r[1] * centre[1] + r[2] * centre[2]),
      -(u[0] * centre[0] + u[1] * centre[1] + u[2] * centre[2]),
      f[0] * centre[0] + f[1] * centre[1] + f[2] * centre[2],
      1,
    ]);
    const P = new Float32Array([1 / ext, 0, 0, 0, 0, 1 / ext, 0, 0, 0, 0, -1 / depth, 0, 0, 0, 0, 1]);
    return m4.mul(P, V);
  },
};

export function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
