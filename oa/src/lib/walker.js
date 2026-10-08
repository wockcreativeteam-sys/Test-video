// The life walk: one woman whose footfalls land exactly on the timeline's steps. Shared by the
// tunnel exit (02), the life in one walk (03), the slowing replay (06) and the clock (04).
import { gaitParams, walkPose, makeBody, poseBody, rimEnergy } from './figure.js';
import { EV } from '../timeline.js';

export const STEP_T = 0.53; // seconds per step in the life walk
export const T0 = EV.walkSteps[0]; // heel strike of step 0

let body = null, E = null;
export function walkerBody() {
  if (!body) {
    body = makeBody(24000, 11, { groups: { leg: 1.7, foot: 1.2, torso: 0.85, arm: 0.6, head: 0.65 } });
    E = new Float32Array(body.n);
    // group per particle (0 legs/feet, 1 torso, 2 arms/head) for fades
    body.zone = new Uint8Array(body.n);
    for (let i = 0; i < body.n; i++) {
      const g = body.G[body.seg[i]];
      body.zone[i] = g === 'leg' || g === 'foot' ? 0 : g === 'torso' ? 1 : 2;
    }
  }
  return body;
}
export function walkerEnergy() {
  return E;
}

/** gait parameters of the life walk; age 0..1, limp 0..1 */
export function lifeGait(age = 0.22, limp = 0) {
  return gaitParams({ age, limp, cadence: 1 / STEP_T, step: 0.64 - age * 0.12 });
}

/** joints at gait-time g (seconds of walking since step 0) */
export function walkerJoints(g, gp = lifeGait(), x0 = 0) {
  return walkPose(g, gp, { x: x0 });
}

/** the life-walk camera at time t: close on the legs as they form, then the wide tracking shot */
export function lifeCam(F, J, t) {
  const u = Math.min(1, Math.max(0, (t - 7.35) / 1.0));
  const e = u * u * (3 - 2 * u);
  const L = (a, b) => a + (b - a) * e;
  walkerCam(F, J, { off: [L(-0.75, -1.2), L(0.62, 1.3), L(-2.9, -6.5)], look: [L(0.3, 0.6), L(0.52, 1.0), 0] });
}

/** the shot-03 tracking camera, relative to the walker's pelvis */
export function walkerCam(F, J, o = {}) {
  const px = J.pelvis[0];
  const off = o.off || [-1.2, 1.3, -6.5];
  const look = o.look || [0.6, 1.0, 0];
  F.cam.set([px + off[0], off[1], off[2]], [px + look[0], look[1], look[2]], o.fov || 35);
  // seen from her left side, so she walks left-to-right on screen and type reads correctly
  F.cam.mirror = true;
}

/** pose the particle body and compute rim energies for the current camera */
export function walkerParticles(F, J, t, o = {}) {
  const b = walkerBody();
  poseBody(b, J, { t, flow: o.flow ?? 0.006 });
  rimEnergy(b, F.cam, E, { base: o.base ?? 0.3, rim: o.rim ?? 1.15 });
  return b;
}
