// Batched hairline renderer. Every polyline in the film goes through here:
// 3D projection, depth fog, defocus (wider + fainter), arc-length draw-on and write-heads.
import { clamp, lerp } from './util.js';

const P4 = [0, 0, 0, 0];
const Q4 = [0, 0, 0, 0];
const AQ = 32; // alpha quantisation steps
const WQ = 10; // width quantisation per px

export class Lines {
  constructor(F) {
    this.F = F;
    this.buckets = new Map();
    this.heads = [];
  }
  _bucket(layer, rgb, w, a) {
    const k = layer + '|' + rgb + '|' + w + '|' + a;
    let b = this.buckets.get(k);
    if (!b) {
      b = { layer, rgb, w, a, path: new Path2D() };
      this.buckets.set(k, b);
    }
    return b;
  }

  /** cumulative arc lengths for a flat point array */
  static cum(P, stride = 3, n = P.length / stride, closed = false) {
    const m = closed ? n + 1 : n;
    const c = new Float32Array(m);
    for (let i = 1; i < m; i++) {
      const a = (i - 1) * stride, b = (i % n) * stride;
      let d = 0;
      for (let k = 0; k < stride; k++) {
        const e = P[b + k] - P[a + k];
        d += e * e;
      }
      c[i] = c[i - 1] + Math.sqrt(d);
    }
    return c;
  }

  /**
   * Draw a polyline.
   * P: flat array, xyz (stride 3) or screen xy (opt.screen, stride 2)
   * opt: rgb 'r,g,b', a, w, layer (0 base, 1 glow, 2 both), closed, from, to,
   *      fog [z0,z1,aMin], dof [focusZ, range, maxPx], persp (reference k for width scaling),
   *      fade [a0,a1] alpha along the line, head {r, rgb, a, g, gi}
   */
  poly(P, opt) {
    const F = this.F, cam = F.cam;
    const screen = !!opt.screen;
    const stride = screen ? 2 : 3;
    const n = opt.n || P.length / stride;
    if (n < 2) return;
    const closed = !!opt.closed;
    const from = opt.from ?? 0, to = opt.to ?? 1;
    if (to <= from) return;
    const a0 = opt.a ?? 1;
    if (a0 <= 0.003) return;
    const w0 = opt.w ?? 1;
    const rgb = opt.rgb || '220,232,255';
    const layer = opt.layer ?? 0;
    const fog = opt.fog, dof = opt.dof, fade = opt.fade, persp = opt.persp;
    const segs = closed ? n : n - 1;

    let cum = null, total = 0, L0 = 0, L1 = 0;
    const partial = from > 0 || to < 1 || fade || opt.head;
    if (partial) {
      cum = opt.cum || Lines.cum(P, stride, n, closed);
      total = cum[cum.length - 1];
      L0 = from * total;
      L1 = to * total;
    }
    let prevBucket = null, havePrev = false;
    let px = 0, py = 0, pz = 0, pk = 0;
    let headX = 0, headY = 0, headOk = false;

    for (let s = 0; s < segs; s++) {
      const ia = s * stride, ib = ((s + 1) % n) * stride;
      let ta = 0, tb = 1;
      if (partial) {
        const la = cum[s], lb = cum[s + 1];
        if (lb <= L0 || la >= L1) {
          havePrev = false;
          prevBucket = null;
          continue;
        }
        const d = lb - la || 1e-9;
        ta = la < L0 ? (L0 - la) / d : 0;
        tb = lb > L1 ? (L1 - la) / d : 1;
      }
      // endpoints (interpolated if partial)
      let ax, ay, az, bx, by, bz;
      if (screen) {
        ax = lerp(P[ia], P[ib], ta); ay = lerp(P[ia + 1], P[ib + 1], ta);
        bx = lerp(P[ia], P[ib], tb); by = lerp(P[ia + 1], P[ib + 1], tb);
        P4[0] = ax; P4[1] = ay; P4[2] = 1; P4[3] = 1;
        Q4[0] = bx; Q4[1] = by; Q4[2] = 1; Q4[3] = 1;
      } else {
        ax = lerp(P[ia], P[ib], ta); ay = lerp(P[ia + 1], P[ib + 1], ta); az = lerp(P[ia + 2], P[ib + 2], ta);
        bx = lerp(P[ia], P[ib], tb); by = lerp(P[ia + 1], P[ib + 1], tb); bz = lerp(P[ia + 2], P[ib + 2], tb);
        if (opt.xf) {
          const X = opt.xf;
          ax = X[0] + (ax - X[0]) * X[3]; ay = X[1] + (ay - X[1]) * X[3]; az = X[2] + (az - X[2]) * X[3];
          bx = X[0] + (bx - X[0]) * X[3]; by = X[1] + (by - X[1]) * X[3]; bz = X[2] + (bz - X[2]) * X[3];
        }
        const okA = cam.project(ax, ay, az, P4);
        const okB = cam.project(bx, by, bz, Q4);
        if (!okA || !okB) {
          havePrev = false;
          prevBucket = null;
          continue;
        }
      }
      // alpha / width for this segment
      let a = a0, w = w0;
      if (!screen) {
        const z = (P4[2] + Q4[2]) * 0.5;
        if (fog) a *= lerp(1, fog[2], clamp((z - fog[0]) / (fog[1] - fog[0])));
        if (opt.near) a *= clamp((z - opt.near[0]) / (opt.near[1] - opt.near[0]));
        if (persp) w *= clamp(((P4[3] + Q4[3]) * 0.5) / persp, 0.35, 3.0);
        if (dof) {
          const blur = Math.min(dof[2], (Math.abs(z - dof[0]) / dof[1]) * dof[2]);
          if (blur > 0.15) {
            w += blur;
            a /= 1 + blur * 0.55;
          }
        }
      }
      if (fade) {
        const u = partial ? (cum[s] + (cum[s + 1] - cum[s]) * 0.5) / (total || 1) : s / segs;
        a *= lerp(fade[0], fade[1], u);
      }
      if (opt.alphaFn) a *= opt.alphaFn(s / segs, P4, Q4);
      if (opt.segAlpha) a *= opt.segAlpha(s);
      if (a <= 0.004) {
        havePrev = false;
        prevBucket = null;
        continue;
      }
      const aq = Math.min(1, Math.round(a * AQ) / AQ) || 1 / AQ;
      const wq = Math.max(0.1, Math.round(w * WQ) / WQ);
      const b = this._bucket(layer, rgb, wq, aq);
      const sx = P4[0], sy = P4[1], ex = Q4[0], ey = Q4[1];
      if (b !== prevBucket || !havePrev || Math.abs(px - sx) > 0.01 || Math.abs(py - sy) > 0.01) b.path.moveTo(sx, sy);
      b.path.lineTo(ex, ey);
      prevBucket = b;
      havePrev = true;
      px = ex; py = ey; pz = Q4[2]; pk = Q4[3];
      headX = ex; headY = ey; headOk = true;
    }
    if (opt.head && headOk && to < 1.0001) this.heads.push({ x: headX, y: headY, k: pk, ...opt.head });
  }

  /**
   * Fill a closed 3D polygon immediately (additive by default) — stacked slice fills build
   * an X-ray volume. opt: rgb, a, add (bool, default true), fog [z0,z1,aMin]
   */
  fill(P, opt) {
    const F = this.F, cam = F.cam;
    const n = opt.n || P.length / 3;
    if (n < 3 || (opt.a ?? 0) <= 0.002) return;
    const ctx = opt.layer === 1 ? F.g : F.ctx;
    let zs = 0, k = 0;
    ctx.beginPath();
    const X = opt.xf;
    for (let i = 0; i < n; i++) {
      let px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
      if (X) {
        px = X[0] + (px - X[0]) * X[3]; py = X[1] + (py - X[1]) * X[3]; pz = X[2] + (pz - X[2]) * X[3];
      }
      if (!cam.project(px, py, pz, P4)) return;
      if (i === 0) ctx.moveTo(P4[0], P4[1]);
      else ctx.lineTo(P4[0], P4[1]);
      zs += P4[2];
      k++;
    }
    ctx.closePath();
    let a = opt.a;
    if (opt.fog) a *= lerp(1, opt.fog[2], clamp((zs / k - opt.fog[0]) / (opt.fog[1] - opt.fog[0])));
    const prev = ctx.globalCompositeOperation;
    if (opt.add !== false) ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${opt.rgb || '220,232,255'},${a})`;
    ctx.fill();
    ctx.globalCompositeOperation = prev;
  }

  /** convenience: 2D screen polyline */
  poly2(P, opt) {
    opt.screen = true;
    this.poly(P, opt);
  }

  /** a write-head / emitter: core on base, halo on glow layer */
  head(x, y, h) {
    this.heads.push({ x, y, ...h });
  }

  flush() {
    const F = this.F;
    for (const b of this.buckets.values()) {
      if (b.layer === 0 || b.layer === 2) {
        const c = F.ctx;
        c.lineWidth = b.w;
        c.strokeStyle = `rgba(${b.rgb},${b.a})`;
        c.stroke(b.path);
      }
      if (b.layer === 1 || b.layer === 2) {
        const c = F.g;
        c.lineWidth = b.layer === 2 ? b.w * 2.2 + 1 : b.w;
        c.strokeStyle = `rgba(${b.rgb},${b.layer === 2 ? b.a * 0.55 : b.a})`;
        c.stroke(b.path);
      }
    }
    this.buckets.clear();
    for (const h of this.heads) drawHead(F, h);
    this.heads.length = 0;
  }
}

export function drawHead(F, h) {
  const r = h.r ?? 2.4;
  const rgb = h.rgb || '255,255,255';
  const a = h.a ?? 1;
  const g = h.g ?? 26; // glow radius (px)
  const gi = h.gi ?? 0.9;
  if (a <= 0) return;
  const c = F.ctx;
  c.fillStyle = `rgba(${h.core || '255,255,255'},${a})`;
  c.beginPath();
  c.arc(h.x, h.y, r, 0, Math.PI * 2);
  c.fill();
  if (g > 0 && gi > 0) glowDot(F, h.x, h.y, g, rgb, gi * a);
  if (h.streak) {
    // faint anamorphic streak on the glow layer
    const gc = F.g;
    const len = h.streak;
    const grd = gc.createLinearGradient(h.x - len, h.y, h.x + len, h.y);
    grd.addColorStop(0, `rgba(${rgb},0)`);
    grd.addColorStop(0.5, `rgba(${rgb},${0.35 * a * gi})`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    gc.fillStyle = grd;
    gc.fillRect(h.x - len, h.y - 1.2, len * 2, 2.4);
  }
}

export function glowDot(F, x, y, r, rgb, intensity) {
  const gc = F.g;
  const grd = gc.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, `rgba(${rgb},${clamp(intensity)})`);
  grd.addColorStop(0.18, `rgba(${rgb},${clamp(intensity * 0.45)})`);
  grd.addColorStop(0.5, `rgba(${rgb},${clamp(intensity * 0.1)})`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  gc.fillStyle = grd;
  gc.beginPath();
  gc.arc(x, y, r, 0, Math.PI * 2);
  gc.fill();
}
