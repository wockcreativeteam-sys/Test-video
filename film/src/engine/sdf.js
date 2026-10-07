// Signed-distance primitives (scalar, allocation-free) + marching-squares slicer.

export function sdEll(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = (px - cx) / rx, y = (py - cy) / ry, z = (pz - cz) / rz;
  const k0 = Math.sqrt(x * x + y * y + z * z);
  const k1 = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz));
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}
export function sdSph(px, py, pz, cx, cy, cz, r) {
  const x = px - cx, y = py - cy, z = pz - cz;
  return Math.sqrt(x * x + y * y + z * z) - r;
}
export function sdCap(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  let h = (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz);
  h = h < 0 ? 0 : h > 1 ? 1 : h;
  const x = pax - bax * h, y = pay - bay * h, z = paz - baz * h;
  return Math.sqrt(x * x + y * y + z * z) - r;
}
/** tapered capsule (approximate, fine for gentle tapers) */
export function sdCapT(px, py, pz, ax, ay, az, bx, by, bz, r0, r1) {
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  let h = (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz);
  h = h < 0 ? 0 : h > 1 ? 1 : h;
  const x = pax - bax * h, y = pay - bay * h, z = paz - baz * h;
  return Math.sqrt(x * x + y * y + z * z) - (r0 + (r1 - r0) * h);
}
export function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export function smax(a, b, k) {
  return -smin(-a, -b, k);
}

/**
 * Marching squares of f(x,y) = 0 over [x0,x1]x[y0,y1].
 * Returns polylines [{p: Float32Array [x,y,...], closed}], optionally Chaikin-smoothed.
 */
export function contour2D(f, x0, y0, x1, y1, res, smoothIters = 1) {
  const nx = Math.max(2, Math.ceil((x1 - x0) / res) + 1);
  const ny = Math.max(2, Math.ceil((y1 - y0) / res) + 1);
  const dx = (x1 - x0) / (nx - 1), dy = (y1 - y0) / (ny - 1);
  const v = new Float32Array(nx * ny);
  let any = false, anyIn = false;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const val = f(x0 + i * dx, y0 + j * dy);
      v[j * nx + i] = val;
      if (val < 0) anyIn = true;
      else any = true;
    }
  if (!anyIn) return [];
  // edge points: key = edge id; h-edge (i,j)->(i+1,j), v-edge (i,j)->(i,j+1)
  const pt = new Map();
  const edgePoint = (kind, i, j) => {
    const key = kind * 1e8 + j * 1e4 + i;
    let p = pt.get(key);
    if (p) return key;
    let a, b, ax, ay, bx, by;
    if (kind === 0) {
      a = v[j * nx + i]; b = v[j * nx + i + 1];
      ax = x0 + i * dx; ay = y0 + j * dy; bx = ax + dx; by = ay;
    } else {
      a = v[j * nx + i]; b = v[(j + 1) * nx + i];
      ax = x0 + i * dx; ay = y0 + j * dy; bx = ax; by = ay + dy;
    }
    const t = a / (a - b);
    pt.set(key, [ax + (bx - ax) * t, ay + (by - ay) * t]);
    return key;
  };
  const adj = new Map();
  const link = (k1, k2) => {
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1).push(k2);
    adj.get(k2).push(k1);
  };
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = v[j * nx + i], b = v[j * nx + i + 1], c = v[(j + 1) * nx + i + 1], d = v[(j + 1) * nx + i];
      const idx = (a < 0 ? 1 : 0) | (b < 0 ? 2 : 0) | (c < 0 ? 4 : 0) | (d < 0 ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const B = () => edgePoint(0, i, j); // bottom (a-b)
      const R = () => edgePoint(1, i + 1, j); // right (b-c)
      const T = () => edgePoint(0, i, j + 1); // top (d-c)
      const L = () => edgePoint(1, i, j); // left (a-d)
      switch (idx) {
        case 1: case 14: link(L(), B()); break;
        case 2: case 13: link(B(), R()); break;
        case 3: case 12: link(L(), R()); break;
        case 4: case 11: link(R(), T()); break;
        case 6: case 9: link(B(), T()); break;
        case 7: case 8: link(L(), T()); break;
        case 5: case 10: {
          const center = (a + b + c + d) / 4;
          if ((center < 0) === (idx === 5)) {
            link(L(), T());
            link(B(), R());
          } else {
            link(L(), B());
            link(R(), T());
          }
          break;
        }
      }
    }
  // chain
  const used = new Set();
  const out = [];
  for (const start of adj.keys()) {
    if (used.has(start)) continue;
    // prefer to start at an open end
    const chain = [start];
    used.add(start);
    let cur = start, prev = -1;
    for (;;) {
      const nb = adj.get(cur).find((k) => k !== prev && !used.has(k));
      if (nb === undefined) break;
      chain.push(nb);
      used.add(nb);
      prev = cur;
      cur = nb;
    }
    // try extend backwards from start
    cur = start;
    prev = chain.length > 1 ? chain[1] : -1;
    const back = [];
    for (;;) {
      const nb = adj.get(cur).find((k) => k !== prev && !used.has(k));
      if (nb === undefined) break;
      back.push(nb);
      used.add(nb);
      prev = cur;
      cur = nb;
    }
    const keys = back.reverse().concat(chain);
    if (keys.length < 3) continue;
    const first = keys[0], last = keys[keys.length - 1];
    const closed = adj.get(last).includes(first) && keys.length > 3;
    let pts = keys.map((k) => pt.get(k));
    for (let s = 0; s < smoothIters; s++) pts = chaikin(pts, closed);
    const p = new Float32Array(pts.length * 2);
    pts.forEach((q, n) => {
      p[n * 2] = q[0];
      p[n * 2 + 1] = q[1];
    });
    out.push({ p, closed });
  }
  return out;
}

export function chaikin(pts, closed) {
  const n = pts.length;
  const out = [];
  if (!closed) out.push(pts[0]);
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
    out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/** lift 2D contour into 3D with a mapping fn(u,v)->[x,y,z] */
export function lift(c2, map) {
  const n = c2.p.length / 2;
  const P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const q = map(c2.p[i * 2], c2.p[i * 2 + 1]);
    P[i * 3] = q[0];
    P[i * 3 + 1] = q[1];
    P[i * 3 + 2] = q[2];
  }
  return { P, closed: c2.closed, n };
}
