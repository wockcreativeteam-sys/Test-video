// Perspective camera shared by every 3D line layer.
import { v3 } from './util.js';

export class Cam {
  constructor(W = 1920, H = 1080) {
    this.W = W;
    this.H = H;
    this.pos = [0, 0, 10];
    this.tgt = [0, 0, 0];
    this.up = [0, 1, 0];
    this.fov = 35;
    this.roll = 0;
    this.near = 0.004;
    this.shift = [0, 0]; // principal point offset in px (composition without rotating)
    this.update();
  }
  set(pos, tgt, fov, roll = 0, shift = null) {
    this.pos = pos;
    this.tgt = tgt;
    if (fov) this.fov = fov;
    this.roll = roll;
    this.shift = shift || [0, 0];
    return this.update();
  }
  update() {
    const f = v3.norm(v3.sub(this.tgt, this.pos));
    let r = v3.cross(f, this.up);
    if (v3.len(r) < 1e-6) r = [1, 0, 0];
    r = v3.norm(r);
    let u = v3.cross(r, f);
    if (this.roll) {
      const c = Math.cos(this.roll), s = Math.sin(this.roll);
      const r2 = v3.add(v3.mul(r, c), v3.mul(u, s));
      const u2 = v3.add(v3.mul(u, c), v3.mul(r, -s));
      r = r2;
      u = u2;
    }
    this.f = f;
    this.r = r;
    this.u = u;
    this.focal = this.H / 2 / Math.tan((this.fov * Math.PI) / 360);
    this.cx = this.W / 2 + this.shift[0];
    this.cy = this.H / 2 + this.shift[1];
    return this;
  }
  /** project world point -> out[0..3] = sx, sy, depth, px-per-unit. returns false if behind */
  project(x, y, z, out) {
    const dx = x - this.pos[0], dy = y - this.pos[1], dz = z - this.pos[2];
    const zc = dx * this.f[0] + dy * this.f[1] + dz * this.f[2];
    if (zc < this.near) {
      out[2] = zc;
      return false;
    }
    const xc = dx * this.r[0] + dy * this.r[1] + dz * this.r[2];
    const yc = dx * this.u[0] + dy * this.u[1] + dz * this.u[2];
    const k = this.focal / zc;
    out[0] = this.cx + xc * k;
    out[1] = this.cy - yc * k;
    out[2] = zc;
    out[3] = k;
    return true;
  }
  p(x, y, z) {
    const o = [0, 0, 0, 0];
    return this.project(x, y, z, o) ? o : null;
  }
  depth(x, y, z) {
    return (x - this.pos[0]) * this.f[0] + (y - this.pos[1]) * this.f[1] + (z - this.pos[2]) * this.f[2];
  }
}

/** orbit helper: camera position around target given yaw/pitch (deg) and distance */
export function orbit(tgt, yawDeg, pitchDeg, dist) {
  const y = (yawDeg * Math.PI) / 180, p = (pitchDeg * Math.PI) / 180;
  return [tgt[0] + Math.sin(y) * Math.cos(p) * dist, tgt[1] + Math.sin(p) * dist, tgt[2] + Math.cos(y) * Math.cos(p) * dist];
}
