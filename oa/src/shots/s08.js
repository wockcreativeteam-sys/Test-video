// SHOT 08 — THE HUMAN SCALE (29.0 – 33.4 s)
// The joint bursts into particles; the camera travels backward through them as they rebuild an
// examination room — walls, window light, couch, desk, chairs, a doctor — all of the same
// particles. The patient walks, with a limp; the camera keeps to her knee. The doctor notices.
// OSTEOARTHRITIS assembles from particles beside her, then dissolves. The word goes; she stays.
import { clamp, lerp, E, mulberry32, track } from '../engine/util.js';
import { cloud } from '../engine/cloud.js';
import { curl2 } from '../engine/noise.js';
import { shape, sampleShaped } from '../engine/glyphs.js';
import { buildExamRoom } from '../lib/worlds.js';
import { gaitParams, walkPose, makeBody, poseBody, rimEnergy } from '../lib/figure.js';
import { u01, dust } from './common.js';
import { drawHead } from '../engine/lines.js';
import { C, F as PF } from '../palette.js';
import { EV } from '../timeline.js';

const P4 = [0, 0, 0, 0];
const PSTEPS = EV.patientSteps;
const ROOM_X = 0; // room origin
let room = null, patient = null, doctor = null, word = null, shaft = null;

function sampleLines(lines, spacing, rnd) {
  const pts = [];
  for (const ln of lines) {
    const p = ln.p, n = p.length / 3;
    const w = ln.w ?? 0.5;
    for (let i = 0; i < n - 1; i++) {
      const ax = p[i * 3], ay = p[i * 3 + 1], az = p[i * 3 + 2];
      const bx = p[i * 3 + 3], by = p[i * 3 + 4], bz = p[i * 3 + 5];
      const L = Math.hypot(bx - ax, by - ay, bz - az);
      const m = Math.max(1, Math.round(L / spacing));
      for (let k = 0; k < m; k++) {
        const u = (k + rnd()) / m;
        pts.push(ax + (bx - ax) * u, ay + (by - ay) * u, az + (bz - az) * u, w);
      }
    }
  }
  return pts;
}

export function init() {
  const rnd = mulberry32(808);
  const W = buildExamRoom(3);
  const s = sampleLines(W.lines, 0.02, rnd);
  const n = s.length / 4;
  room = { n, T: new Float32Array(n * 3), e: new Float32Array(n), d: new Float32Array(n), b: new Float32Array(n * 3), P: new Float32Array(n * 3) };
  for (let i = 0; i < n; i++) {
    room.T[i * 3] = s[i * 4] + ROOM_X;
    room.T[i * 3 + 1] = s[i * 4 + 1];
    room.T[i * 3 + 2] = s[i * 4 + 2];
    const w = s[i * 4 + 3];
    room.e[i] = (w >= 0.9 ? 0.9 : w >= 0.4 ? 0.55 : 0.32) * (0.7 + rnd() * 0.6);
    room.d[i] = rnd() * 0.5;
    const a = rnd() * 6.283, b = Math.acos(2 * rnd() - 1);
    room.b[i * 3] = Math.cos(a) * Math.sin(b);
    room.b[i * 3 + 1] = Math.cos(b);
    room.b[i * 3 + 2] = Math.sin(a) * Math.sin(b);
  }
  patient = makeBody(14000, 81, { groups: { leg: 1.6, foot: 1.1, torso: 0.9, arm: 0.6, head: 0.7 } });
  doctor = makeBody(9000, 82, { groups: { leg: 1.0, foot: 0.8, torso: 1.1, arm: 0.8, head: 0.9 } });
  // OSTEOARTHRITIS as a particle word
  const S = shape('OSTEOARTHRITIS', 'D500', { track: 0.06 });
  const m = 9000;
  const q = sampleShaped(S, m, 9, 160);
  word = { m, Q: q, w: S.width, d: new Float32Array(m), v: new Float32Array(m * 3), e: new Float32Array(m) };
  for (let i = 0; i < m; i++) {
    word.d[i] = rnd() * 0.35;
    word.v[i * 3] = (rnd() - 0.5) * 0.8;
    word.v[i * 3 + 1] = rnd() * 0.6 + 0.1;
    word.v[i * 3 + 2] = (rnd() - 0.5) * 0.8;
    word.e[i] = 0.5 + rnd() * 0.6;
  }
  // window light: dust in the shaft
  const k = 1600;
  shaft = { k, P: new Float32Array(k * 3), base: new Float32Array(k * 3), e: new Float32Array(k) };
  for (let i = 0; i < k; i++) {
    const u = rnd(), v = rnd(), w = rnd();
    // a slanted box from the window (z 3.4, y 0.95-2.6, x -1.6..1.4) down to the floor near z ~ 0.8
    shaft.base[i * 3] = lerp(-1.6, 1.4, u) + w * 0.6;
    shaft.base[i * 3 + 1] = lerp(lerp(0.95, 2.6, v), 0.0, w);
    shaft.base[i * 3 + 2] = lerp(3.3, 0.6, w);
    shaft.e[i] = 0.15 + rnd() * 0.5;
  }
}

// ---- the people ------------------------------------------------------------------------------------
function patientJoints(t) {
  const gp = gaitParams({ age: 0.85, limp: 0.7, cadence: 1.4 });
  const keys = [[PSTEPS[0] - 0.7, -0.7]];
  PSTEPS.forEach((s, k) => keys.push([s, k * 0.7]));
  keys.push([PSTEPS[4] + 0.7, 5 * 0.7]);
  const g = track(keys.map(([a, b]) => [a, b, E.lin]), t);
  return walkPose(g, gp, { x: -2.6, z: 0.5 });
}
function doctorJoints(t) {
  // seated, facing the room (-z), at the desk; turns his head toward her when he notices
  const x = 2.2, z = 1.62;
  const look = E.inOutCubic(u01(t, EV.notices - 0.15, EV.notices + 0.45));
  const lean = 0.06 + look * 0.08;
  const J = {};
  J.pelvis = [x, 0.52, z];
  J.hipL = [x + 0.1, 0.52, z]; J.hipR = [x - 0.1, 0.52, z];
  J.kneeL = [x + 0.12, 0.52, z - 0.44]; J.kneeR = [x - 0.12, 0.52, z - 0.44];
  J.ankleL = [x + 0.12, 0.08, z - 0.5]; J.ankleR = [x - 0.12, 0.08, z - 0.5];
  J.heelL = [x + 0.12, 0.01, z - 0.47]; J.heelR = [x - 0.12, 0.01, z - 0.47];
  J.toeL = [x + 0.12, 0.01, z - 0.7]; J.toeR = [x - 0.12, 0.01, z - 0.7];
  J.chest = [x, 1.0, z - lean];
  J.neck = [x, 1.13, z - lean - 0.02];
  const turn = look * 0.75; // towards -x (where she walks)
  J.head = [x - Math.sin(turn) * 0.04, 1.25, z - lean - 0.05 - Math.cos(turn) * 0.02];
  J.bun = [J.head[0] + Math.sin(turn) * 0.06, J.head[1] - 0.02, J.head[2] + Math.cos(turn) * 0.06];
  J.shoulderL = [x + 0.19, 1.04, z - lean]; J.shoulderR = [x - 0.19, 1.04, z - lean];
  J.elbowL = [x + 0.22, 0.8, z - lean - 0.12]; J.elbowR = [x - 0.22, 0.8, z - lean - 0.12];
  J.wristL = [x + 0.14, 0.72, z - lean - 0.36]; J.wristR = [x - 0.14, 0.72, z - lean - 0.36];
  J.handL = [x + 0.1, 0.71, z - lean - 0.48]; J.handR = [x - 0.1, 0.71, z - lean - 0.48];
  return J;
}
export function doctorEye(t) {
  const J = doctorJoints(t);
  const turn = E.inOutCubic(u01(t, EV.notices - 0.15, EV.notices + 0.45)) * 0.75;
  return [J.head[0] - Math.sin(turn) * 0.08 - 0.03, J.head[1] + 0.02, J.head[2] - Math.cos(turn) * 0.08];
}

// ---- camera ---------------------------------------------------------------------------------------
function camAt(F, t, PJ) {
  const k = PJ.kneeR;
  const back = E.inOutCubic(u01(t, 29.15, 30.7));
  const close = [k[0] - 0.12, k[1] + 0.04, k[2] - 0.32];
  const med = [k[0] - 0.4, 0.85, -3.3];
  const tgt0 = k, tgt1 = [k[0] + 0.55, 0.85, 0.9];
  let pos = [lerp(close[0], med[0], back), lerp(close[1], med[1], back), lerp(close[2], med[2], back)];
  let tgt = [lerp(tgt0[0], tgt1[0], back), lerp(tgt0[1], tgt1[1], back), lerp(tgt0[2], tgt1[2], back)];
  // after the doctor notices, rise a little to hold both of them
  const rise = E.inOutSine(u01(t, 31.2, 32.3));
  pos = [pos[0] + rise * 0.6, pos[1] + rise * 0.45, pos[2] - rise * 0.6];
  tgt = [tgt[0] + rise * 0.5, tgt[1] + rise * 0.25, tgt[2] + rise * 0.3];
  // push into the doctor's eye
  const push = E.inCubic(u01(t, 32.75, 33.4));
  if (push > 0) {
    const eye = doctorEye(t);
    const ep = [eye[0] - 0.05, eye[1], eye[2] - 0.06];
    pos = [lerp(pos[0], ep[0], push), lerp(pos[1], ep[1], push), lerp(pos[2], ep[2], push)];
    tgt = [lerp(tgt[0], eye[0], push), lerp(tgt[1], eye[1], push), lerp(tgt[2], eye[2] + 0.5, push)];
  }
  F.cam.set(pos, tgt, lerp(64, 40, back) - push * 12);
  F.cam.mirror = true; // she walks left-to-right, type reads correctly
  return { focus: lerp(0.35, 3.4, back) };
}

export function draw(F, lt, t) {
  const PJ = patientJoints(t);
  const cf = camAt(F, t, PJ);
  const fade = 1 - E.inOutSine(u01(t, 33.05, 33.4));
  const burst = t - EV.explode;
  const k = PJ.kneeR;
  // ---- the room, from the burst ---------------------------------------------------------------------
  const v = [0, 0];
  for (let i = 0; i < room.n; i++) {
    const u = E.inOutCubic(u01(t, EV.room[0] + room.d[i], EV.room[1] + room.d[i] * 0.6));
    const bu = clamp(burst / 0.9);
    const R = (0.03 + 3.2 * E.outCubic(bu)) * (0.35 + 0.65 * room.d[i] * 2); // burst radius around the knee
    const bx = k[0] + room.b[i * 3] * R, by = k[1] + room.b[i * 3 + 1] * R, bz = k[2] + room.b[i * 3 + 2] * R;
    const tx = room.T[i * 3], ty = room.T[i * 3 + 1], tz = room.T[i * 3 + 2];
    const sw = Math.sin(Math.PI * u);
    curl2(tx * 0.6, tz * 0.6, t * 0.5, v);
    room.P[i * 3] = lerp(bx, tx, u) + v[0] * 0.25 * sw;
    room.P[i * 3 + 1] = lerp(by, ty, u) + v[1] * 0.2 * sw;
    room.P[i * 3 + 2] = lerp(bz, tz, u);
  }
  const ra = (burst < 0 ? 0 : 1) * fade;
  // the burst is hot (green-white, from inside her knee) and cools into the violet room
  const cool = E.inOutSine(u01(t, 29.3, 30.4));
  const rgb = [lerp(0.7, PF.VIOLET_HI[0], cool), lerp(1.0, PF.VIOLET_HI[1], cool), lerp(0.8, PF.VIOLET_HI[2], cool)];
  cloud(F, room.P, room.n, { rgb, E: room.e, e: lerp(4.5, 1.05, cool) * ra, near: [0.02, 0.12], dof: { focus: cf.focus, range: 3.5, max: lerp(0.6, 3, cool), gain: 0.2 } });
  if (burst > -0.02 && burst < 0.5) {
    F.fx.exposure = 1 + 0.5 * Math.exp(-Math.max(0, burst) * 8);
    F.fx.zoom = 0.18 * Math.exp(-Math.max(0, burst) * 5);
    F.fx.zoomC = [0.5, 0.5];
  }
  // window light: a soft slanted shaft of dust
  const sa = E.inOutSine(u01(t, 30.2, 31.0)) * fade;
  if (sa > 0) {
    for (let i = 0; i < shaft.k; i++) {
      shaft.P[i * 3] = shaft.base[i * 3] + Math.sin(t * 0.4 + i) * 0.03;
      shaft.P[i * 3 + 1] = shaft.base[i * 3 + 1] + Math.sin(t * 0.3 + i * 1.7) * 0.03;
      shaft.P[i * 3 + 2] = shaft.base[i * 3 + 2];
    }
    cloud(F, shaft.P, shaft.k, { rgb: PF.LILAC, E: shaft.e, e: 0.9 * sa, dof: { focus: cf.focus, range: 3, max: 4, gain: 0.25 } });
  }
  dust(F, t, { n: 500, e: 0.05, box: 9 });
  // ---- the patient (her) -----------------------------------------------------------------------------
  const pa = E.inOutSine(u01(t, 29.6, 30.4)) * fade;
  poseBody(patient, PJ, { t, flow: 0.006 });
  const Ep = rimEnergy(patient, F.cam, null, { base: 0.3, rim: 1.2 });
  cloud(F, patient.P, patient.n, { rgb: PF.GREEN, E: Ep, e: 0.5 * pa, near: [0.05, 0.3], dof: { focus: cf.focus, range: 2.5, max: 2.5 } });
  // red, still in her knee
  {
    const r = mulberry32(88);
    const n = 40;
    const P = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283 + t * (1 + r() * 2), b = r() * 3.14, rr = 0.03 + r() * 0.05;
      P[i * 3] = k[0] + Math.cos(a) * Math.sin(b) * rr;
      P[i * 3 + 1] = k[1] + Math.cos(b) * rr;
      P[i * 3 + 2] = k[2] + Math.sin(a) * Math.sin(b) * rr;
    }
    cloud(F, P, n, { rgb: PF.RED, e: 0.8 * fade, size: 0.7, near: [0.02, 0.2] });
  }
  // ---- the doctor ----------------------------------------------------------------------------------
  const da = E.inOutSine(u01(t, 30.0, 30.9)) * fade;
  const DJ = doctorJoints(t);
  poseBody(doctor, DJ, { t, flow: 0.004 });
  const Ed = rimEnergy(doctor, F.cam, null, { base: 0.28, rim: 1.1 });
  cloud(F, doctor.P, doctor.n, { rgb: PF.LILAC, E: Ed, e: 0.45 * da, near: [0.05, 0.3], dof: { focus: cf.focus, range: 2.5, max: 2.5 } });
  // the moment he notices: a glint in his eye
  const gl = Math.exp(-((t - EV.notices - 0.35) ** 2) / 0.02);
  if (gl > 0.02) {
    const e = doctorEye(t);
    if (F.cam.project(e[0], e[1], e[2], P4)) drawHead(F, { x: P4[0], y: P4[1], r: 1.4, rgb: C.GREEN, g: 18, gi: 0.8 * gl, a: gl * fade });
  }
  // ---- OSTEOARTHRITIS: assembles beside her, then dissolves; she keeps walking ----------------------
  const [w0, w1] = EV.oaWord;
  if (t > w0 - 0.35 && t < w1 + 0.8) {
    const size = 0.19; // m per em
    const ox = PJ.pelvis[0] - (word.w * size) / 2 + 0.2, oy = 2.15, oz = 1.0;
    const P = new Float32Array(word.m * 3), En = new Float32Array(word.m);
    let m = 0;
    for (let i = 0; i < word.m; i++) {
      const fin = E.outCubic(u01(t, w0 - 0.35 + word.d[i], w0 + 0.15 + word.d[i]));
      const dis = clamp((t - (w1 - 0.1) - word.d[i] * 0.6) / 0.7);
      if (fin <= 0) continue;
      const tx = ox + word.Q[i * 2] * size, ty = oy - word.Q[i * 2 + 1] * size, tz = oz;
      const fx = room.T[(i % room.n) * 3], fy = room.T[(i % room.n) * 3 + 1], fz = room.T[(i % room.n) * 3 + 2];
      let x = lerp(fx, tx, fin), y = lerp(fy, ty, fin), z = lerp(fz, tz, fin);
      if (dis > 0) {
        const d = E.outQuad(dis);
        x += word.v[i * 3] * d;
        y += word.v[i * 3 + 1] * d;
        z += word.v[i * 3 + 2] * d;
      }
      P[m * 3] = x; P[m * 3 + 1] = y; P[m * 3 + 2] = z;
      En[m++] = word.e[i] * (1 - dis) * (0.35 + 0.65 * fin);
    }
    cloud(F, P, m, { rgb: PF.LILAC, E: En, e: 0.75 * fade, near: [0.05, 0.3] });
  }
}
