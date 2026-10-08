// The walking body. A procedural gait with planted feet (no sliding): footprints are laid
// first, each foot swings between them on a lifted arc, the pelvis rides above with its bob,
// sway and roll, and two-bone IK puts the knees where they must be. Ageing and an antalgic
// limp (the knee that hurts) bend the same machinery. Units: metres, y up, walking along +x.
import { clamp, lerp, smooth, E, mulberry32 } from '../engine/util.js';
import { pnoise } from '../engine/noise.js';

const TAU = Math.PI * 2;

export const BODY = {
  // a woman of ~1.58 m
  thigh: 0.41, shin: 0.39, ankleH: 0.07, heel: 0.06, toe: 0.17, hipW: 0.085,
  spine: 0.47, neck: 0.1, head: 0.11, shoulderW: 0.17, upperArm: 0.28, foreArm: 0.25, hand: 0.17,
};

/**
 * Gait parameters (all optional):
 *  cadence  steps per second (default 1.9)
 *  step     step length (m) (default 0.62)
 *  age      0 (young) .. 1 (old): shorter steps, forward lean, less knee in swing, less arm swing
 *  limp     0..1 pain in the RIGHT knee: shorter stance on it, stiff knee, trunk lean, hesitation
 *  lift     swing-foot height (m)
 *  stairs   {rise, run} climb a staircase instead of level ground
 */
export function gaitParams(o = {}) {
  const age = o.age ?? 0, limp = o.limp ?? 0;
  return {
    cadence: o.cadence ?? lerp(1.9, 1.55, age) * lerp(1, 0.78, limp),
    step: o.step ?? lerp(0.66, 0.5, age) * lerp(1, 0.82, limp),
    age, limp,
    lift: o.lift ?? lerp(0.09, 0.055, age),
    stairs: o.stairs || null,
    lean: o.lean ?? lerp(0.04, 0.2, age) + limp * 0.06,
    arm: o.arm ?? lerp(1, 0.45, age) * lerp(1, 0.7, limp),
  };
}

/**
 * Pose at gait time g (seconds of walking, may be warped), start x0.
 * Returns joints (arrays [x,y,z]) and foot frames.
 */
export function walkPose(g, gp, o = {}) {
  const B = o.body || BODY;
  const T = 1 / gp.cadence; // seconds per step
  const z0 = o.z ?? 0;
  const x0 = o.x ?? 0;
  const dir = o.dir ?? 1;
  const steps = g / T;
  const k = Math.floor(steps);
  const ph = steps - k; // phase inside the current step (0 at heel strike of the leading foot)
  // which foot struck at step k: even -> left, odd -> right
  const lead = (k & 1) === 0 ? 'L' : 'R';
  const stair = gp.stairs;
  const footAt = (i) => {
    // footprint i (heel position)
    const x = x0 + i * gp.step;
    const y = stair ? (i + 1) * stair.rise : 0;
    return [x, y];
  };
  // swing timing: a foot is in the air from toe-off (late in the previous step) to its heel strike
  const swingStart = 0.12; // fraction of the step after the other foot's strike when toe-off happens
  // asymmetry: the painful (right) leg's stance is shortened -> the left leg swings faster
  const feet = {};
  for (const side of ['L', 'R']) {
    // the step index at which this foot last struck
    const parity = side === 'L' ? 0 : 1;
    let ks = k;
    if ((ks & 1) !== parity) ks -= 1;
    const since = steps - ks; // steps since this foot's strike (0..2)
    const prev = footAt(ks), next = footAt(ks + 2);
    let fx, fy, pitch;
    if (since < 1 + swingStart) {
      // stance (planted on prev), heel-off near the end
      fx = prev[0];
      fy = prev[1];
      const hu = clamp((since - 0.55) / (1 + swingStart - 0.55));
      pitch = -lerp(0, 0.75, E.inQuad(hu)); // heel rises (toe down)
      const su = clamp(since / 0.12);
      pitch += (1 - E.outQuad(su)) * 0.22; // heel strike: toes up
    } else {
      const u = clamp((since - 1 - swingStart) / (1 - swingStart));
      const e = E.inOutSine(u);
      fx = lerp(prev[0], next[0], e);
      const rise = stair ? Math.sin(Math.PI * Math.min(1, u * 1.35)) * (gp.lift + stair.rise * 0.9) : Math.sin(Math.PI * u) * gp.lift;
      fy = lerp(prev[1], next[1], E.inOutSine(clamp(u * 1.25))) + rise;
      pitch = lerp(-0.75, 0.22, E.inOutSine(u));
    }
    // ankle from heel + foot pitch (pitch > 0 toes up)
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const hx = fx, hy = fy;
    // foot local: heel (0,0), ankle (heel, ankleH), toe (toe, 0); rotate around heel when toes up,
    // around the toe when the heel rises
    let ax, ay, tx, ty;
    if (pitch >= 0) {
      ax = hx + B.heel * cp - B.ankleH * sp;
      ay = hy + B.heel * sp + B.ankleH * cp;
      tx = hx + (B.heel + B.toe) * cp;
      ty = hy + (B.heel + B.toe) * sp;
    } else {
      // pivot at toe (toe stays planted)
      tx = hx + B.heel + B.toe;
      ty = hy;
      const c2 = Math.cos(-pitch), s2 = Math.sin(-pitch);
      const hx2 = tx - (B.heel + B.toe) * c2, hy2 = ty + (B.heel + B.toe) * s2;
      ax = hx2 + B.heel * c2 + B.ankleH * s2;
      ay = hy2 - B.heel * s2 + B.ankleH * c2;
    }
    const lat = (side === 'L' ? 1 : -1) * 0.09;
    feet[side] = { heel: [hx, hy, z0 + lat], ankle: [ax, ay, z0 + lat], toe: [tx, ty, z0 + lat], pitch, since };
  }
  // pelvis: moves at the mean speed with bob; height follows the stance foot
  const px = x0 + (steps - 0.5) * gp.step + gp.step * 0.38;
  const stanceY = stair ? Math.max(feet.L.heel[1] * (feet.L.since < 1.1 ? 1 : 0), feet.R.heel[1] * (feet.R.since < 1.1 ? 1 : 0)) : 0;
  const baseY = stair ? lerp(footAt(k)[1], footAt(k + 1)[1], E.inOutSine(ph)) : 0;
  const legLen = B.thigh + B.shin + B.ankleH;
  const bob = -Math.cos(TAU * ph) * 0.018 * (1 - gp.age * 0.4);
  let pyH = baseY + legLen * lerp(0.965, 0.93, gp.age) + bob;
  if (stair) pyH = Math.max(baseY, stanceY) + legLen * 0.9 + bob;
  // limp: a dip and hesitation when loading the right leg
  const rightLoad = lead === 'R' ? Math.exp(-ph * 6) : 0;
  pyH -= gp.limp * 0.03 * rightLoad;
  const sway = Math.sin(Math.PI * (steps + 0.5)) * 0.022 + (lead === 'R' ? 1 : -1) * gp.limp * 0.02;
  const pelvis = [px, pyH, z0 + sway];
  const roll = Math.sin(TAU * ph * 0.5 + (lead === 'R' ? Math.PI : 0)) * 0.05; // transverse rotation
  const hips = {
    L: [px - Math.sin(roll) * B.hipW, pyH, z0 + sway + Math.cos(roll) * B.hipW],
    R: [px + Math.sin(roll) * B.hipW, pyH, z0 + sway - Math.cos(roll) * B.hipW],
  };
  const J = { pelvis, feet };
  // legs: two-bone IK in the plane containing hip->ankle, knee forward
  for (const side of ['L', 'R']) {
    const H = hips[side], A = feet[side].ankle;
    let dx = A[0] - H[0], dy = A[1] - H[1], dz = A[2] - H[2];
    let d = Math.hypot(dx, dy, dz);
    const L1 = B.thigh, L2 = B.shin;
    const stiff = side === 'R' ? gp.limp * 0.5 : 0;
    const maxD = (L1 + L2) * 0.999;
    if (d > maxD) {
      dx *= maxD / d; dy *= maxD / d; dz *= maxD / d;
      d = maxD;
    }
    const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    let a = Math.acos(cosA) * (1 - stiff * 0.6);
    // direction hip->ankle, and "forward" perpendicular in the sagittal plane
    const ux = dx / d, uy = dy / d, uz = dz / d;
    // forward vector: +x projected perpendicular to u
    let fx = dir - ux * (ux * dir), fy = -uy * (ux * dir), fz = -uz * (ux * dir);
    const fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl; fy /= fl; fz /= fl;
    const K = [H[0] + (ux * Math.cos(a) + fx * Math.sin(a)) * L1, H[1] + (uy * Math.cos(a) + fy * Math.sin(a)) * L1, H[2] + (uz * Math.cos(a) + fz * Math.sin(a)) * L1];
    J['hip' + side] = H;
    J['knee' + side] = K;
    J['ankle' + side] = feet[side].ankle;
    J['heel' + side] = feet[side].heel;
    J['toe' + side] = feet[side].toe;
  }
  // trunk
  const lean = gp.lean + (o.leanAdd || 0);
  const latLean = gp.limp * 0.07 * rightLoad;
  const chest = [px + Math.sin(lean) * B.spine, pyH + Math.cos(lean) * B.spine, z0 + sway - latLean * B.spine];
  const neck = [chest[0] + Math.sin(lean * 1.4) * B.neck, chest[1] + B.neck, chest[2]];
  const head = [neck[0] + Math.sin(lean * 1.6) * B.head * 0.9 + 0.02, neck[1] + B.head, neck[2]];
  J.chest = chest;
  J.neck = neck;
  J.head = head;
  J.bun = [head[0] - 0.085, head[1] + 0.02, head[2]];
  // arms swing opposite to legs
  const legPhaseL = (feet.L.since % 2) / 2; // 0..1 per stride from left heel strike
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const S0 = [chest[0] - 0.02, chest[1] - 0.04, chest[2] + s * B.shoulderW];
    const swing = Math.cos(TAU * legPhaseL) * 0.38 * gp.arm * (side === 'L' ? -1 : 1);
    const el = [S0[0] + Math.sin(swing) * B.upperArm, S0[1] - Math.cos(swing) * B.upperArm, S0[2] + s * 0.02];
    const fa = swing + 0.25 + Math.max(0, swing) * 0.4;
    const wr = [el[0] + Math.sin(fa) * B.foreArm, el[1] - Math.cos(fa) * B.foreArm, el[2] + s * 0.01];
    J['shoulder' + side] = S0;
    J['elbow' + side] = el;
    J['wrist' + side] = wr;
    J['hand' + side] = [wr[0] + Math.sin(fa + 0.1) * B.hand * 0.8, wr[1] - Math.cos(fa + 0.1) * B.hand * 0.8, wr[2]];
  }
  J.steps = steps;
  J.k = k;
  J.phase = ph;
  J.lead = lead;
  return J;
}

// ---- particle body -------------------------------------------------------------------------------
// segments: [jointA, jointB, rA, rB, weight(particle share), group]
const SEGS = [
  // [jointA, jointB, rA, rB, particle share, group, lateral scale, sagittal scale]
  ['ankleL', 'kneeL', 0.036, 0.056, 1.0, 'leg', 1, 1],
  ['ankleR', 'kneeR', 0.036, 0.056, 1.0, 'leg', 1, 1],
  ['kneeL', 'hipL', 0.056, 0.088, 1.35, 'leg', 1, 1],
  ['kneeR', 'hipR', 0.056, 0.088, 1.35, 'leg', 1, 1],
  ['ankleL', 'toeL', 0.034, 0.022, 0.32, 'foot', 1.2, 0.8],
  ['ankleR', 'toeR', 0.034, 0.022, 0.32, 'foot', 1.2, 0.8],
  ['heelL', 'ankleL', 0.026, 0.034, 0.12, 'foot', 1, 1],
  ['heelR', 'ankleR', 0.026, 0.034, 0.12, 'foot', 1, 1],
  ['hipL', 'hipR', 0.1, 0.1, 0.55, 'torso', 1, 0.95],
  ['pelvis', 'chest', 0.125, 0.128, 1.7, 'torso', 1.3, 0.78],
  ['shoulderL', 'shoulderR', 0.055, 0.055, 0.35, 'torso', 1, 0.9],
  ['chest', 'neck', 0.11, 0.05, 0.45, 'torso', 1.2, 0.8],
  ['neck', 'head', 0.048, 0.088, 0.75, 'head', 0.92, 1.05],
  ['head', 'bun', 0.045, 0.04, 0.12, 'head', 1, 1],
  ['shoulderL', 'elbowL', 0.04, 0.032, 0.42, 'arm', 1, 1],
  ['shoulderR', 'elbowR', 0.04, 0.032, 0.42, 'arm', 1, 1],
  ['elbowL', 'wristL', 0.032, 0.024, 0.36, 'arm', 1, 1],
  ['elbowR', 'wristR', 0.032, 0.024, 0.36, 'arm', 1, 1],
  ['wristL', 'handL', 0.026, 0.018, 0.14, 'arm', 1.3, 0.6],
  ['wristR', 'handR', 0.026, 0.018, 0.14, 'arm', 1.3, 0.6],
];

/**
 * A particle body: n particles distributed over the segments' surfaces (fixed parameters, so
 * every frame the same particle sits on the same spot of the body).
 */
export function makeBody(n, seed = 7, o = {}) {
  const rnd = mulberry32(seed);
  const segW = SEGS.map((s) => s[4] * (o.groups && o.groups[s[5]] !== undefined ? o.groups[s[5]] : 1));
  const tot = segW.reduce((a, b) => a + b, 0);
  const seg = new Uint8Array(n), u = new Float32Array(n), th = new Float32Array(n), rr = new Float32Array(n), ph = new Float32Array(n);
  let k = 0;
  for (let s = 0; s < SEGS.length; s++) {
    const m = s === SEGS.length - 1 ? n - k : Math.round((segW[s] / tot) * n);
    for (let i = 0; i < m && k < n; i++, k++) {
      seg[k] = s;
      u[k] = rnd();
      th[k] = rnd() * TAU;
      rr[k] = rnd() < 0.68 ? 0.9 + 0.1 * rnd() : Math.cbrt(rnd()) * 0.9; // shell + soft volume
      ph[k] = rnd();
    }
  }
  return { n, seg, u, th, rr, ph, P: new Float32Array(n * 3), N: new Float32Array(n * 3), G: SEGS.map((s) => s[5]) };
}

/** place body particles for joints J. flow: turbulence amplitude (m), t: time for the flow */
export function poseBody(body, J, o = {}) {
  const { n, seg, u, th, rr, ph, P, N } = body;
  const flow = o.flow ?? 0.006, t = o.t ?? 0;
  const bulk = o.bulk ?? 1;
  const segFrame = SEGS.map(([a, b, ra, rb, , , latS, sagS]) => {
    const A = J[a], Bp = J[b];
    const dx = Bp[0] - A[0], dy = Bp[1] - A[1], dz = Bp[2] - A[2];
    const L = Math.hypot(dx, dy, dz) || 1e-6;
    const ax = dx / L, ay = dy / L, az = dz / L;
    // perpendicular frame: p ~ lateral (z), q ~ sagittal
    let rx = 0, ry = 0, rz = 1;
    if (Math.abs(az) > 0.9) { rx = 0; ry = 1; rz = 0; }
    let px = ay * rz - az * ry, py = az * rx - ax * rz, pz = ax * ry - ay * rx;
    const pl = Math.hypot(px, py, pz) || 1;
    px /= pl; py /= pl; pz /= pl;
    const qx = ay * pz - az * py, qy = az * px - ax * pz, qz = ax * py - ay * px;
    return [A, ax, ay, az, L, px, py, pz, qx, qy, qz, ra * bulk, rb * bulk, latS, sagS];
  });
  for (let i = 0; i < n; i++) {
    const f = segFrame[seg[i]];
    const A = f[0], L = f[4];
    const s = u[i];
    let r = lerp(f[11], f[12], s) * rr[i];
    // soften the ends: round caps
    const capE = Math.min(s, 1 - s) * L;
    if (capE < r) r *= Math.sqrt(Math.max(0, 1 - ((r - capE) / r) ** 2)) * 0.6 + 0.4;
    const c = Math.cos(th[i]), sn = Math.sin(th[i]);
    const nx = f[5] * c + f[8] * sn, ny = f[6] * c + f[9] * sn, nz = f[7] * c + f[10] * sn;
    const cl = c * f[13], sl = sn * f[14];
    let x = A[0] + f[1] * s * L + (f[5] * cl + f[8] * sl) * r;
    let y = A[1] + f[2] * s * L + (f[6] * cl + f[9] * sl) * r;
    let z = A[2] + f[3] * s * L + (f[7] * cl + f[10] * sl) * r;
    if (flow > 0) {
      const q = ph[i] * 40;
      x += pnoise(q, t * 0.9, 0.5) * flow;
      y += pnoise(q + 7.3, t * 0.9, 1.5) * flow;
      z += pnoise(q + 3.1, t * 0.9, 2.5) * flow;
    }
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    N[i * 3] = nx; N[i * 3 + 1] = ny; N[i * 3 + 2] = nz;
  }
  return P;
}

/** rim-lit particle energies: brighter where the surface turns away from the camera */
export function rimEnergy(body, cam, out, o = {}) {
  const { n, P, N, seg } = body;
  const base = o.base ?? 0.28, rim = o.rim ?? 1.0;
  const gw = o.groupGain || null;
  out = out || new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const vx = P[i * 3] - cam.pos[0], vy = P[i * 3 + 1] - cam.pos[1], vz = P[i * 3 + 2] - cam.pos[2];
    const vl = Math.hypot(vx, vy, vz) || 1;
    const d = Math.abs((vx * N[i * 3] + vy * N[i * 3 + 1] + vz * N[i * 3 + 2]) / vl);
    const f = 1 - d;
    let e = base + rim * f * f * f;
    if (gw) e *= gw[body.G[seg[i]]] ?? 1;
    out[i] = e;
  }
  return out;
}

/** standing pose (for the doctor / a waiting figure): small breathing sway */
export function standPose(t, o = {}) {
  const gp = gaitParams({ age: o.age ?? 0.3 });
  const J = walkPose(0.001, gp, { x: o.x ?? 0, z: o.z ?? 0 });
  return J;
}
