// Smooth gradient noise (improved Perlin, deterministic permutation) and curl fields
// for fluid-like particle motion and controlled turbulence.
const perm = new Uint8Array(512);
(function () {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = 1337;
  for (let i = 255; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
})();
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function grad(h, x, y, z) {
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
/** 3D gradient noise in about [-1, 1] */
export function pnoise(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  x -= X; y -= Y; z -= Z;
  const xi = X & 255, yi = Y & 255, zi = Z & 255;
  const u = fade(x), v = fade(y), w = fade(z);
  const A = perm[xi] + yi, AA = perm[A] + zi, AB = perm[A + 1] + zi;
  const B = perm[xi + 1] + yi, BA = perm[B] + zi, BB = perm[B + 1] + zi;
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(grad(perm[AA] & 15, x, y, z), grad(perm[BA] & 15, x - 1, y, z), u), l(grad(perm[AB] & 15, x, y - 1, z), grad(perm[BB] & 15, x - 1, y - 1, z), u), v),
    l(l(grad(perm[AA + 1] & 15, x, y, z - 1), grad(perm[BA + 1] & 15, x - 1, y, z - 1), u), l(grad(perm[AB + 1] & 15, x, y - 1, z - 1), grad(perm[BB + 1] & 15, x - 1, y - 1, z - 1), u), v),
    w
  ) * 1.1;
}
export function fbm3(x, y, z, oct = 3) {
  let a = 0.5, s = 0, n = 0;
  for (let o = 0; o < oct; o++) {
    s += a * pnoise(x, y, z);
    n += a;
    x *= 2.02; y *= 2.02; z *= 2.02;
    a *= 0.5;
  }
  return s / n;
}
const E = 0.0009;
/** divergence-free 2D flow: curl of a scalar potential (z = time) */
export function curl2(x, y, t, out) {
  const n1 = pnoise(x, y + E, t), n2 = pnoise(x, y - E, t);
  const n3 = pnoise(x + E, y, t), n4 = pnoise(x - E, y, t);
  out = out || [0, 0];
  out[0] = (n1 - n2) / (2 * E);
  out[1] = -(n3 - n4) / (2 * E);
  return out;
}
/** 3D curl noise (three offset potentials) */
export function curl3(x, y, z, out) {
  const p1 = (a, b, c) => pnoise(a, b, c);
  const p2 = (a, b, c) => pnoise(a + 31.4, b - 17.1, c + 7.7);
  const p3 = (a, b, c) => pnoise(a - 11.3, b + 23.9, c - 41.2);
  const dy3 = (p3(x, y + E, z) - p3(x, y - E, z)) / (2 * E);
  const dz2 = (p2(x, y, z + E) - p2(x, y, z - E)) / (2 * E);
  const dz1 = (p1(x, y, z + E) - p1(x, y, z - E)) / (2 * E);
  const dx3 = (p3(x + E, y, z) - p3(x - E, y, z)) / (2 * E);
  const dx2 = (p2(x + E, y, z) - p2(x - E, y, z)) / (2 * E);
  const dy1 = (p1(x, y + E, z) - p1(x, y - E, z)) / (2 * E);
  out = out || [0, 0, 0];
  out[0] = dy3 - dz2;
  out[1] = dz1 - dx3;
  out[2] = dx2 - dy1;
  return out;
}
