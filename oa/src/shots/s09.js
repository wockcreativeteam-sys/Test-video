// SHOT 09 — THE MEMORY GLITCH (32.9 – 37.3 s)
// The doctor's eye. We push into the pupil: inside it, a staircase; inside the staircase, a hand;
// inside the hand, a memory — the same woman, the same gesture, the same hesitation — as two
// layers at once: clinical (particles, measured) and personal (her green line, a child's hand in
// hers). FOR SOMEONE: the two words drift apart into a huge negative space.
import { clamp, lerp, E, mulberry32, track } from '../engine/util.js';
import { glowLine } from '../engine/green.js';
import { handShape } from '../lib/hand.js';
import { gaitParams, walkPose, makeBody, poseBody, rimEnergy } from '../lib/figure.js';
import { textFlat, u01, scrim } from './common.js';
import { pnoise } from '../engine/noise.js';
import { C, F as PF } from '../palette.js';
import { EV } from '../timeline.js';

const CX = 960, CY = 540;
// the zoom through the nested worlds (log scale)
const ZK = [
  [32.9, Math.log(0.55)],
  [33.6, Math.log(0.95), E.inOutSine],
  [34.5, Math.log(7.5), E.inCubic],
  [35.15, Math.log(22), E.outCubic],
  [35.75, Math.log(150), E.inOutCubic],
  [36.35, Math.log(330), E.inOutCubic],
  [37.3, Math.log(420), E.outQuad],
];
const zoom = (t) => Math.exp(track(ZK, t));

// nested placements (in eye units, at zoom 1): pupil -> stair landing door -> palm
const PUPIL_R = 104;
const STAIR = { c: [0, 0], s: 0.085 }; // staircase drawn in its own units (~1200 wide) scaled into the pupil
const DOOR = [430, -420, 150, 230]; // in stair units: x, y, w, h of the doorway at the top
const HAND = { c: [DOOR[0] + 75, DOOR[1] + 140], s: 7.2 }; // hand in cm units inside the door (stair units)
const PALM = [0.0, 4.6]; // memory window centre in hand cm
const MEM_S = 0.0045; // memory layer (px of a 1920 frame) per hand cm

let fibers = null, patient = null, mother = null, child = null, handT = null;
export function init() {
  const r = mulberry32(909);
  fibers = [];
  for (let i = 0; i < 420; i++) {
    const a = (i / 420) * Math.PI * 2 + r() * 0.01;
    fibers.push([a, 0.5 + r() * 0.5, r()]);
  }
  patient = makeBody(9000, 91, { groups: { leg: 1.5, foot: 1, torso: 0.9, arm: 0.6, head: 0.7 } });
  mother = makeBody(9000, 92, { groups: { leg: 1.5, foot: 1, torso: 0.9, arm: 0.6, head: 0.7 } });
  child = makeBody(4000, 93, { groups: { leg: 1.4, foot: 1, torso: 1, arm: 0.7, head: 1.0 } });
  handT = handShape('mother', 'open', { cut: -6 });
}

// the zoom follows the nested centres: eye -> doorway -> palm (all in eye units)
const DOOR_C = [STAIR.c[0] + (DOOR[0] + DOOR[2] / 2) * STAIR.s, STAIR.c[1] + (DOOR[1] + DOOR[3] / 2) * STAIR.s];
const PALM_C = [STAIR.c[0] + (HAND.c[0] + PALM[0] * HAND.s) * STAIR.s, STAIR.c[1] + (HAND.c[1] - PALM[1] * HAND.s) * STAIR.s];
let FX = 0, FY = 0;
function setFocus(t) {
  const u1 = E.inOutCubic(u01(t, 34.45, 35.25));
  const u2 = E.inOutCubic(u01(t, 35.25, 35.95));
  FX = lerp(lerp(0, DOOR_C[0], u1), PALM_C[0], u2);
  FY = lerp(lerp(0, DOOR_C[1], u1), PALM_C[1], u2);
}
// screen transform for a point given in eye units
function eyeToScreen(z, x, y) {
  return [CX + (x - FX) * z, CY + (y - FY) * z];
}
function stairToScreen(z, x, y) {
  return eyeToScreen(z, STAIR.c[0] + x * STAIR.s, STAIR.c[1] + y * STAIR.s);
}
function handToScreen(z, x, y) {
  // hand cm (y up) -> stair units (y down)
  return stairToScreen(z, HAND.c[0] + x * HAND.s, HAND.c[1] - y * HAND.s);
}

function drawEye(F, t, z, a) {
  const c = F.ctx;
  c.save();
  c.translate(CX - FX * z, CY - FY * z);
  c.scale(z, z);
  const lw = (px) => px / z;
  // lids
  const lid = (sgn, peak) => {
    c.beginPath();
    c.moveTo(-430, 6);
    c.bezierCurveTo(-250, sgn * peak, 250, sgn * peak, 430, -6);
  };
  c.lineCap = 'round';
  c.strokeStyle = `rgba(${C.VIOLET_HI},${0.85 * a})`;
  c.lineWidth = lw(2.2);
  lid(-1, 330);
  c.stroke();
  lid(1, 250);
  c.stroke();
  c.strokeStyle = `rgba(${C.VIOLET},${0.45 * a})`;
  c.lineWidth = lw(1.3);
  c.beginPath();
  c.moveTo(-400, -40);
  c.bezierCurveTo(-230, -400, 230, -400, 410, -50);
  c.stroke();
  // lashes
  for (let i = 0; i < 34; i++) {
    const u = 0.08 + (i / 33) * 0.84;
    const x = lerp(-430, 430, u);
    const y = -330 * 0.75 * 4 * u * (1 - u) * 0.98;
    const ang = -Math.PI / 2 + (u - 0.5) * 1.4;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + Math.cos(ang) * 26, y + Math.sin(ang) * 26, x + Math.cos(ang + 0.4) * 40, y + Math.sin(ang + 0.4) * 44);
    c.stroke();
  }
  // iris within the lids
  c.save();
  c.beginPath();
  c.moveTo(-430, 6);
  c.bezierCurveTo(-250, -330, 250, -330, 430, -6);
  c.bezierCurveTo(250, 250, -250, 250, -430, 6);
  c.closePath();
  c.clip();
  const R = 232;
  for (const [ang, len, k] of fibers) {
    const r0 = PUPIL_R + 4, r1 = lerp(150, R - 6, len);
    const wob = 0.035 * Math.sin(ang * 9 + k * 6);
    c.strokeStyle = `rgba(${k < 0.12 ? C.GREEN : k < 0.55 ? C.VIOLET_HI : C.VIOLET},${(k < 0.12 ? 0.55 : 0.4) * a})`;
    c.lineWidth = lw(1.0);
    c.beginPath();
    c.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
    c.quadraticCurveTo(Math.cos(ang + wob) * (r0 + r1) * 0.5, Math.sin(ang + wob) * (r0 + r1) * 0.5, Math.cos(ang) * r1, Math.sin(ang) * r1);
    c.stroke();
  }
  c.strokeStyle = `rgba(${C.VIOLET_HI},${0.75 * a})`;
  c.lineWidth = lw(2);
  c.beginPath();
  c.arc(0, 0, R, 0, Math.PI * 2);
  c.stroke();
  // collarette
  c.beginPath();
  for (let i = 0; i <= 180; i++) {
    const an = (i / 180) * Math.PI * 2;
    const rr = 150 + 6 * Math.sin(an * 14) + 3 * pnoise(an * 3, 1, 2);
    if (i === 0) c.moveTo(Math.cos(an) * rr, Math.sin(an) * rr);
    else c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
  }
  c.strokeStyle = `rgba(${C.VIOLET_HI},${0.45 * a})`;
  c.lineWidth = lw(1.2);
  c.stroke();
  c.restore();
  // pupil: a dark disc (the world inside is drawn into it), with the green catch-light
  c.fillStyle = `rgba(4,2,10,${a})`;
  c.beginPath();
  c.arc(0, 0, PUPIL_R, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function clipCircle(F, x, y, r, fn) {
  const c = F.ctx;
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.clip();
  fn();
  c.restore();
}

function drawStair(F, t, z, a) {
  // a straight flight seen in perspective, rising to a doorway of light (in stair units)
  const pts = [];
  const N = 9;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x0 = lerp(-560, DOOR[0] - 40, u), y0 = lerp(520, DOOR[1] + DOOR[3], u);
    const w = lerp(720, 120, u);
    pts.push([x0, y0, w]);
  }
  const c = F.ctx;
  c.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const [xa, ya, wa] = pts[i], [xb, yb, wb] = pts[i + 1];
    const A = stairToScreen(z, xa, ya), B = stairToScreen(z, xa + wa, ya);
    const Cc = stairToScreen(z, xb, yb), D = stairToScreen(z, xb + wb, yb);
    const riserY = lerp(ya, yb, 0.55);
    const R1 = stairToScreen(z, lerp(xa, xb, 0.1), riserY), R2 = stairToScreen(z, lerp(xa + wa, xb + wb, 0.1), riserY);
    c.strokeStyle = `rgba(${C.VIOLET_HI},${0.85 * a})`;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]);
    c.moveTo(R1[0], R1[1]); c.lineTo(R2[0], R2[1]);
    c.moveTo(A[0], A[1]); c.lineTo(Cc[0], Cc[1]);
    c.moveTo(B[0], B[1]); c.lineTo(D[0], D[1]);
    c.stroke();
  }
  // the doorway of light at the top
  const d0 = stairToScreen(z, DOOR[0], DOOR[1]), d1 = stairToScreen(z, DOOR[0] + DOOR[2], DOOR[1] + DOOR[3]);
  c.strokeStyle = `rgba(${C.LILAC},${a})`;
  c.lineWidth = 2;
  c.strokeRect(d0[0], d0[1], d1[0] - d0[0], d1[1] - d0[1]);
  // her green line climbing the stairs into the door
  const L = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    const s = stairToScreen(z, lerp(-300, DOOR[0] + 75, u), lerp(470, DOOR[1] + DOOR[3] - 10, u) - Math.abs(Math.sin(u * N * Math.PI)) * 18);
    L.push(s[0], s[1]);
  }
  glowLine(F, new Float32Array(L), 61, { w: 2.2, a });
  return [d0, d1];
}

function drawHandLayer(F, t, z, a) {
  const P = new Float32Array(handT.n * 2);
  for (let i = 0; i < handT.n; i++) {
    const s = handToScreen(z, handT.P[i * 2], handT.P[i * 2 + 1]);
    P[i * 2] = s[0];
    P[i * 2 + 1] = s[1];
  }
  glowLine(F, P, handT.n, { w: 2.4, a, glow: 1 });
  return P;
}

// the memory: two layers of the same walk — clinical (lilac particles + a measured knee) and
// personal (green: the mother, younger, a child's hand in hers)
function drawMemory(F, t, z, a, clipPath) {
  const c = F.ctx;
  const ctr = handToScreen(z, PALM[0], PALM[1]);
  const k = z * HAND.s * STAIR.s * MEM_S; // screen px per memory px
  // a virtual camera for the memory figures
  const lt = t - 35.6;
  const gpP = gaitParams({ age: 0.85, limp: 0.7, cadence: 1.3 });
  const gpM = gaitParams({ age: 0.2, cadence: 1.8 });
  const JP = walkPose(lt * 0.9 + 2, gpP, { x: 0, z: 0 });
  const JM = walkPose(lt * 0.9 + 2, gpM, { x: 0, z: 0.0 });
  F.cam.set([JP.pelvis[0] + 0.2, 0.95, -4.2], [JP.pelvis[0] + 0.2, 0.9, 0], 35);
  F.cam.mirror = true;
  const glitch = Math.floor(t * 12) % 7 === 0 ? 1 : 0;
  const map = (x, y) => [ctr[0] + (x - CX) * k, ctr[1] + (y - CY) * k];
  const P4 = [0, 0, 0, 0];
  // clinical layer
  poseBody(patient, JP, { t, flow: 0.005 });
  const Ep = rimEnergy(patient, F.cam, null, { base: 0.3, rim: 1.1 });
  const [lr, lg, lb] = PF.LILAC;
  for (let i = 0; i < patient.n; i++) {
    if (!F.cam.project(patient.P[i * 3], patient.P[i * 3 + 1], patient.P[i * 3 + 2], P4)) continue;
    const s = map(P4[0] + (glitch ? 14 : 0), P4[1]);
    const e = Ep[i] * 1.1 * a;
    F.S.pt(s[0], s[1], lr * e, lg * e, lb * e);
  }
  // personal layer, slightly offset in time and space (double exposure)
  poseBody(mother, JM, { t, flow: 0.005 });
  const Em = rimEnergy(mother, F.cam, null, { base: 0.3, rim: 1.1 });
  const [gr, gg, gb] = PF.GREEN;
  for (let i = 0; i < mother.n; i++) {
    if (!F.cam.project(mother.P[i * 3] + 0.05, mother.P[i * 3 + 1], mother.P[i * 3 + 2], P4)) continue;
    const s = map(P4[0] - (glitch ? 10 : 0), P4[1]);
    const e = Em[i] * 1.1 * a;
    F.S.pt(s[0], s[1], gr * e, gg * e, gb * e);
  }
  // the child, holding her hand
  const JC = walkPose(lt * 1.6 + 1, gaitParams({ cadence: 2.6, step: 0.32 }), { x: 0.05, z: -0.42 });
  const sc = 0.55;
  const CJ = {};
  for (const key in JC) if (Array.isArray(JC[key]) && JC[key].length === 3 && typeof JC[key][0] === 'number') CJ[key] = [JM.pelvis[0] + (JC[key][0] - JC.pelvis[0]) * sc + 0.05, JC[key][1] * sc, -0.42];
  poseBody(child, CJ, { t, flow: 0.004, bulk: 0.8 });
  const Ec = rimEnergy(child, F.cam, null, { base: 0.3, rim: 1.1 });
  for (let i = 0; i < child.n; i++) {
    if (!F.cam.project(child.P[i * 3], child.P[i * 3 + 1], child.P[i * 3 + 2], P4)) continue;
    const s = map(P4[0], P4[1]);
    const e = Ec[i] * 1.1 * a;
    F.S.pt(s[0], s[1], gr * e, gg * e, gb * e);
  }
  // clinical marks at her knee: a measured arc with ticks
  if (F.cam.project(JP.kneeR[0], JP.kneeR[1], JP.kneeR[2], P4)) {
    const s = map(P4[0], P4[1]);
    const R = 60 * k;
    c.strokeStyle = `rgba(${C.LILAC},${0.6 * a})`;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(s[0], s[1], R, -2.2, -0.6);
    c.stroke();
    for (let i = 0; i <= 8; i++) {
      const an = -2.2 + (i / 8) * 1.6;
      c.beginPath();
      c.moveTo(s[0] + Math.cos(an) * R, s[1] + Math.sin(an) * R);
      c.lineTo(s[0] + Math.cos(an) * R * (i % 4 === 0 ? 1.14 : 1.07), s[1] + Math.sin(an) * R * (i % 4 === 0 ? 1.14 : 1.07));
      c.stroke();
    }
  }
  if (glitch) F.fx.ca = Math.max(F.fx.ca || 0, 8);
  void clipPath;
}

export function draw(F, lt, t) {
  const z = zoom(t);
  setFocus(t);
  const fadeIn = E.inOutSine(u01(t, 32.95, 33.35));
  const out = 1 - E.inOutSine(u01(t, 36.95, 37.3));
  const eyeA = fadeIn * (1 - E.inQuad(u01(t, 34.6, 35.0)));
  if (eyeA > 0.003) drawEye(F, t, z, eyeA);
  // the green catch-light in the pupil grows into the opening
  const pr = PUPIL_R * z;
  // staircase inside the pupil (clipped to it while the pupil is smaller than the frame)
  const stA = E.inOutSine(u01(t, 33.7, 34.3)) * (1 - E.inQuad(u01(t, 35.6, 35.95))) * out;
  let door = null;
  if (stA > 0.003) {
    if (pr < 1400) clipCircle(F, CX - FX * z, CY - FY * z, pr, () => { door = drawStair(F, t, z, stA); F.L.flush(); });
    else door = drawStair(F, t, z, stA);
  }
  // the hand inside the doorway
  const hA = E.inOutSine(u01(t, 34.9, 35.35)) * (1 - E.inQuad(u01(t, 36.25, 36.6))) * out;
  if (hA > 0.003) {
    const d0 = stairToScreen(z, DOOR[0], DOOR[1]), d1 = stairToScreen(z, DOOR[0] + DOOR[2], DOOR[1] + DOOR[3]);
    const w = d1[0] - d0[0];
    if (w < 4000) {
      F.ctx.save();
      F.ctx.beginPath();
      F.ctx.rect(d0[0], d0[1], w, d1[1] - d0[1]);
      F.ctx.clip();
      drawHandLayer(F, t, z, hA);
      F.ctx.restore();
    } else drawHandLayer(F, t, z, hA);
  }
  // the memory inside the hand
  const mA = E.inOutSine(u01(t, 35.6, 36.2)) * out;
  if (mA > 0.003) drawMemory(F, t, z, mA);
  // FOR SOMEONE — the words drift apart into a vast negative space
  if (t > 34.1 && t < 37.3) {
    const a = E.outCubic(u01(t, 34.1, 34.45)) * out;
    const sep = E.inOutSine(u01(t, 34.7, 37.2));
    textFlat(F, 'FOR', 860 - sep * 560, 575, 76, { fam: 'D300', track: 0.18, align: 'r', a, glow: 0.3 });
    textFlat(F, 'SOMEONE', 900 + sep * 520, 575, 76, { fam: 'D300', track: 0.18, align: 'l', a, glow: 0.3 });
  }
}
