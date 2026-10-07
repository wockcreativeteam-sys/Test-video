// 00:60–00:68.6  NEURO — pathways → frame → coordinates → trajectory → stimulation → one cell
import { C } from '../palette.js';
import { E, clamp, env, lerp, seg, v3, TAU } from '../engine/util.js';
import { orbit } from '../engine/cam.js';
import { label, callout } from '../engine/annot.js';
import { text } from '../engine/type.js';
import { glowDot, Lines } from '../engine/lines.js';
import { chapterTag, headline, nameplate } from './common.js';
import { cardiacCam, HEAD_W } from './s05_cardiac.js';
import { drawBody, drawLifeLine } from './s01_signal.js';
import { buildBrain, buildTracts, buildFrame, buildNeuron, entryPoint, STN, toW } from '../brain.js';

let BR = null, BL = null, TR = null, FR = null, NE = null, EP = null;
export let STN_W = toW(...STN);

export function neuroCam(t) {
  if (t < 61.2) return cardiacCam(t);
  const u1 = seg(t, 61.2, 63.4, E.inOutSine);
  const u2 = seg(t, 63.4, 66.4, E.inOutSine);
  const u3 = seg(t, 66.2, 68.6, E.inOutQuart);
  let tgt = v3.lerp(HEAD_W, [STN_W[0] * 0.5, STN_W[1] + 0.05, STN_W[2] - 0.12], u1);
  let yaw = lerp(74, 92, u1) + 14 * u2;
  let pitch = lerp(24, 8, u1) + 4 * u2;
  let ld = lerp(Math.log(4.0), Math.log(4.3), u1) + Math.log(1 + 0.05 * u2);
  const roll = lerp(0, -Math.PI / 2, u1);
  const shift = [lerp(0, -300, u1) * (1 - u3), lerp(0, 40, u1) * (1 - u3)];
  tgt = v3.lerp(tgt, STN_W, u3);
  ld = lerp(ld, Math.log(0.11), u3);
  yaw = lerp(yaw, 128, u3);
  pitch = lerp(pitch, 20, u3);
  return { pos: orbit(tgt, yaw, pitch, Math.exp(ld)), tgt, fov: lerp(36, 40, u3), shift, roll };
}

export const S06 = {
  id: 'neuro',
  t0: 59.6,
  t1: 70.6,
  async init() {
    BR = buildBrain();
    TR = buildTracts().map((f) => ({ ...f, cum: Lines.cum(f.P) }));
    FR = buildFrame();
    NE = buildNeuron();
    EP = entryPoint();
    // the cortical surface grown by tools/anatomy/brain_surface.py (cm, body coordinates)
    const spec = await (await fetch('assets/anatomy/brain_lateral.json')).json();
    const mk = (pts) => {
      const P = new Float32Array(pts.length * 3);
      let cy = 0, cz = 0;
      pts.forEach((q, i) => {
        P.set(toW(q[0], q[1], q[2]), i * 3);
        cy += q[1];
        cz += q[2];
      });
      return { P, cum: Lines.cum(P), cy: cy / pts.length, cz: cz / pts.length };
    };
    const sulci = spec.sulci.map((o) => ({ ...mk(o.p), kind: o.kind, name: o.name }));
    // folding radiates out from the insula, as it does in development
    const far = Math.max(...sulci.map((o) => Math.hypot(o.cy - 12.4, o.cz - 163.4)));
    for (const o of sulci) o.ord = Math.hypot(o.cy - 12.4, o.cz - 163.4) / far;
    BL = { outline: spec.outline.map((o) => ({ ...mk(o.p), part: o.part })), sulci, folia: spec.folia.map(mk) };
  },
  draw(F, lt, t) {
    const L = F.L;
    const ctxA = env(t, 59.8, 69.0, 0.8, 0.5) * (1 - seg(t, 66.4, 67.6));
    if (t < 68.6) {
      drawBody(F, 0.3 * ctxA, { focusZ: -16.3, focusR: 2.5, edgeA: 0.06, only: ['skull'], fog: [2, 9, 0.1] });
      drawLifeLine(F, t, 0.7 * ctxA, { dotOnly: true });
    }
    const macro = seg(t, 66.4, 67.8, E.inOutSine);
    // after the single cell, the pull-out passes back through the fibres and the whole brain
    const back = seg(t, 68.7, 69.3) * (1 - seg(t, 69.95, 70.55));
    const camD = v3.len(v3.sub(F.cam.pos, F.cam.tgt));
    const view = v3.norm(v3.sub(F.cam.pos, F.cam.tgt));
    const fog = t < 68 ? [2.0, 6.0, 0.16] : [camD * 0.8, camD * 3, 0.2];
    const near = t < 68 ? null : [0.3 * camD, 0.8 * camD];
    // focus sits on the cortex while it forms, then racks to the target for the DBS
    const surf = F.cam.depth(...toW(6.2, 12, 165));
    const focus = t < 68 ? lerp(surf, F.cam.depth(...STN_W), seg(t, 63.5, 64.3, E.inOutSine)) : camD;
    const dof = t < 68 ? [focus, 1.2, 2.2] : [focus, Math.max(0.25, camD * 0.7), 1.6];
    const brainA = (1 - macro) * (t < 68 ? 1 : 0) + back * clamp((camD - 0.45) / 0.9);

    // 1. acquisition: axial slices stack up under a rising scan plane
    const sweep = seg(t, 60.1, 61.7, E.inOutSine);
    const settle = seg(t, 62.4, 63.6);
    if (brainA > 0.01)
      for (const s of BR) {
        const zf = (s.Z - 149) / 25.2;
        const k = t < 68 ? sweep * 1.15 - zf : 1;
        if (k <= 0) continue;
        const front = t < 68 ? Math.exp(-((k / 0.035) ** 2)) : 0;
        const base = lerp(0.2, 0.075, t < 68 ? settle : 1) * clamp(k / 0.12);
        L.poly(s.P, { rgb: front > 0.25 ? C.LUMI : C.ICE, a: (base + 0.55 * front) * brainA, w: front > 0.25 ? 1.2 : 0.8, closed: s.closed, fog, near, dof, layer: front > 0.25 ? 2 : 0 });
      }
    // 2. the cortex resolves out of the slices
    if (brainA > 0.01) surface(F, t, brainA, { fog, near, dof, lat: Math.abs(view[0]), built: t >= 68 });

    // 3. tractography + travelling signals
    const tr = t < 68 ? seg(t, 62.3, 63.5, E.inOutSine) : 1;
    const trA = t < 68 ? 1 - macro * 0.85 : back * clamp((camD - 0.12) / 0.25) * (1 - 0.6 * clamp((camD - 2) / 3));
    if (trA > 0.01)
      TR.forEach((f, i) => {
        const rgb = f.kind === 'cst' ? C.LUMI : f.kind === 'cc' ? C.ICE : C.STEEL;
        const a = (f.kind === 'arc' ? 0.15 : f.kind === 'cc' ? 0.2 : 0.3) * trA;
        L.poly(f.P, { rgb, a, w: 0.9, to: clamp(tr * 1.4 - (i % 7) * 0.05), cum: f.cum, fog, near, dof });
      });
    L.flush();
    const sigA = Math.max(env(t, 62.8, 67.0, 0.5, 0.6), back * 0.8 * clamp(1 - (camD - 1) / 4));
    if (sigA > 0)
      TR.forEach((f, i) => {
        if (i % 5) return;
        const u = ((t * (0.55 + (i % 5) * 0.08) + i * 0.137) % 1 + 1) % 1;
        const n = f.P.length / 3;
        const k = Math.min(n - 1, Math.floor(u * (n - 1)));
        const p = F.cam.p(f.P[k * 3], f.P[k * 3 + 1], f.P[k * 3 + 2]);
        if (p && (!near || p[2] > near[1])) L.head(p[0], p[1], { r: 1.3, rgb: C.LUMI, core: '235,244,255', g: 12, gi: 0.55 * sigA, a: 0.7 * sigA });
      });
    if (t < 68.8) {
      frame(F, t);
      dbs(F, t);
      coords(F, t);
    }
    neuron(F, t);
    // right column: the line, the three numbers, the system that reaches them
    headline(F, ['THREE NUMBERS.', 'ONE STEADY HAND.'], t - 64.4, 2.3, { x: 1300, y: 150, lh: 72, size: 64 });
    // the plate sits under the target coordinates
    nameplate(F, 'DEEP BRAIN STIMULATION', 'MEDTRONIC DBS SYSTEM', 'INTEGRA MAYFIELD 3-PIN FIXATION · STEREOTACTIC LOCALISER', t - 63.6, 3.0, { x: 1300 });
    chapterTag(F, '06', 'NEUROSURGERY', t - 60.6, 6.4);
  },
};

function surface(F, t, A, o) {
  const L = F.L;
  const { fog, near, dof } = o;
  const sfog = o.built ? fog : [3.0, 8.0, 0.3]; // the cortex stays crisp while it forms
  const done = o.built;
  // silhouette: strongest when the view is lateral
  const latW = lerp(0.4, 1, clamp((o.lat - 0.45) / 0.4));
  for (const s of BL.outline) {
    const cer = s.part === 'cerebrum';
    const on = done ? 1 : cer ? seg(t, 61.0, 62.3, E.inOutCubic) : seg(t, 61.7, 62.7, E.inOutCubic);
    if (on <= 0) continue;
    const head = on > 0 && on < 1 ? { r: 2.2, rgb: C.LUMI, core: '235,244,255', g: 24, gi: 0.8 * A } : null;
    L.poly(s.P, { rgb: cer ? C.WHITE : C.ICE, a: (cer ? 0.72 : 0.65) * A * latW, w: cer ? 1.35 : 1.1, to: on, cum: s.cum, fog: sfog, near, dof, layer: cer ? 2 : 0, head });
  }
  for (const s of BL.sulci) {
    const major = s.kind === 'major';
    const t0 = major ? (s.name === 'sylvian' ? 61.7 : 61.95) : 62.0 + s.ord * 0.95;
    const on = done ? 1 : seg(t, t0, t0 + (major ? 0.75 : 0.5), E.inOutCubic);
    if (on <= 0) continue;
    L.poly(s.P, { rgb: major ? C.WHITE : C.ICE, a: (major ? 0.95 : 0.8) * A, w: major ? 1.3 : 1.05, to: on, cum: s.cum, fog: sfog, near, dof, layer: 0 });
  }
  BL.folia.forEach((s, k) => {
    const on = done ? 1 : seg(t, 62.3 + k * 0.035, 62.8 + k * 0.035, E.inOutCubic);
    if (on <= 0) return;
    L.poly(s.P, { rgb: C.ICE, a: 0.5 * A, w: 0.85, to: on, cum: s.cum, fog: sfog, near, dof });
  });
}

function frame(F, t) {
  const a = env(t, 62.6, 67.0, 0.6, 0.6);
  if (a <= 0) return;
  const L = F.L;
  const u = seg(t, 62.6, 63.8, E.inOutCubic);
  for (const f of FR) {
    const rgb = f.kind === 'loc' ? C.LUMI : C.ICE;
    const fa = f.kind === 'loc' ? 0.3 : f.kind === 'arc' ? 0.6 : 0.75;
    L.poly(f.P, { rgb, a: fa * a, w: f.kind === 'ring' ? 1.6 : 1.0, to: u, fog: [3, 6, 0.3] });
  }
  L.flush();
  const p = F.cam.p(...toW(-10.6, 11, 159.5));
  if (p) callout(F, p[0], p[1], p[0] - 300, p[1] - 40, [['MAYFIELD HEAD FIXATION'], ['3-PIN · DBS LOCALISER']], { t: t - 63.2, a });
}

function dbs(F, t) {
  const a = env(t, 63.8, 68.8, 0.4, 0.3);
  if (a <= 0) return;
  const L = F.L;
  const { entry, dir } = EP;
  const outer = v3.add(entry, v3.mul(dir, 3));
  // planned trajectory (dashed) then the electrode descends along it
  const traj = seg(t, 63.8, 64.6, E.inOutCubic);
  const A = toW(...outer), B = toW(...STN);
  const n = 40;
  for (let i = 0; i < n; i += 2) {
    const u0 = i / n, u1 = Math.min((i + 1) / n, traj);
    if (u0 > traj) break;
    L.poly(new Float32Array([...v3.lerp(A, B, u0), ...v3.lerp(A, B, u1)]), { rgb: C.WHITE, a: 0.7 * a, w: 1 });
  }
  const ins = seg(t, 64.6, 65.8, E.inOutCubic);
  if (ins > 0) {
    const tip = v3.lerp(A, B, ins);
    L.poly(new Float32Array([...A, ...tip]), { rgb: C.ICE, a: 0.95 * a, w: 2.2, layer: 2 });
    // four contacts near the tip (1.5 mm, 0.5 mm spacing)
    const dirW = v3.norm(v3.sub(A, B));
    for (let k = 0; k < 4; k++) {
      const c0 = v3.add(tip, v3.mul(dirW, 0.02 + k * 0.02)), c1 = v3.add(c0, v3.mul(dirW, 0.015));
      const lit = clamp((t - 65.6 - k * 0.12) / 0.2);
      L.poly(new Float32Array([...c0, ...c1]), { rgb: lit > 0 ? C.WHITE : C.STEEL, a, w: 3.4, layer: lit > 0 ? 2 : 0 });
    }
    const tp = F.cam.p(...tip);
    if (tp) L.head(tp[0], tp[1], { r: 2.2, rgb: C.LUMI, g: 24, gi: 0.7 * a, a });
  }
  L.flush();
  const stim = seg(t, 65.9, 66.5);
  if (stim > 0) {
    const sp = F.cam.p(...v3.add(B, v3.mul(v3.norm(v3.sub(A, B)), 0.04)));
    if (sp) {
      const breathe = 0.85 + 0.15 * Math.sin(t * TAU * 1.3);
      glowDot(F, sp[0], sp[1], Math.min(0.06 * sp[3] + 30, 140) * stim * breathe, C.LUMI, 0.75 * a * (1 - 0.5 * seg(t, 66.8, 67.6)));
      glowDot(F, sp[0], sp[1], Math.min(0.025 * sp[3] + 12, 50) * stim, C.WHITE, 0.6 * a * (1 - 0.5 * seg(t, 66.8, 67.6)));
      if (t < 67.2) label(F, 'STIMULATION · 130 HZ', sp[0] + 40, sp[1] + 40, { t: t - 66.0, size: 12, wt: 600, a: a * (1 - seg(t, 66.6, 67.1)) });
    }
  }
  const ep = F.cam.p(...toW(...entry));
  if (ep && t < 66.6) label(F, 'ENTRY', ep[0] + 14, ep[1] - 10, { t: t - 64.0, size: 11, a: 0.7 * a * (1 - seg(t, 66.0, 66.5)) });
}

function coords(F, t) {
  const a = env(t, 63.3, 66.7, 0.4, 0.5);
  if (a <= 0) return;
  const x = 1300, y0 = 360;
  label(F, 'TARGET · SUBTHALAMIC NUCLEUS', x, y0 - 70, { t: t - 63.3, size: 13, wt: 600, a });
  label(F, 'RELATIVE TO MID-COMMISSURAL POINT', x, y0 - 48, { t: t - 63.45, size: 11, a: 0.6 * a, rgb: C.STEEL });
  const rows = [
    ['X', 12.0, 'LATERAL'],
    ['Y', -2.5, 'POSTERIOR'],
    ['Z', -4.0, 'INFERIOR'],
  ];
  rows.forEach(([k, v, name], i) => {
    const tt = t - 63.5 - i * 0.18;
    if (tt <= 0) return;
    const yy = y0 + 60 + i * 132;
    const u = clamp(tt / 0.9);
    const val = (v * E.outExpo(u)).toFixed(1);
    label(F, k, x, yy - 64, { t: tt, size: 14, wt: 600, a, rgb: C.LUMI });
    label(F, name, x + 30, yy - 64, { t: tt, size: 11, a: 0.6 * a, rgb: C.STEEL });
    text(F, (v < 0 ? '−' : '') + Math.abs(+val).toFixed(1), x - 6, yy + 36, { fam: 'D', wt: 100, size: 118, track: -0.02, rgb: C.WHITE, a, anim: { mode: 'fade', t: tt, dur: 0.4 } });
    label(F, 'MM', x + 290, yy + 34, { t: tt, size: 13, a: 0.7 * a });
  });
}

function neuron(F, t) {
  const a = env(t, 66.8, 69.0, 0.5, 0.4);
  if (a <= 0) return;
  const L = F.L;
  const grow = seg(t, 66.8, 67.9, E.outCubic);
  for (const p of NE.parts) {
    L.poly(p.P, { rgb: p.gen < 0 ? C.LUMI : C.ICE, a: (p.gen < 0 ? 0.9 : 0.8 - p.gen * 0.1) * a, w: Math.max(0.8, 2.2 - Math.max(0, p.gen) * 0.35), to: clamp(grow * 2 - Math.max(0, p.gen) * 0.25), layer: 2 });
  }
  L.flush();
  const sp = F.cam.p(...toW(...NE.c));
  if (sp) {
    const fire = Math.max(0, Math.sin(t * TAU * 1.6)) ** 6;
    glowDot(F, sp[0], sp[1], 70 + 60 * fire, C.LUMI, (0.6 + 0.4 * fire) * a);
    L.head(sp[0], sp[1], { r: 5, rgb: C.WHITE, g: 40, gi: 0.8 * a, a });
    label(F, 'ONE CELL', sp[0] + 36, sp[1] - 30, { t: t - 67.4, size: 12, wt: 600, a: a * (1 - seg(t, 68.4, 68.9)) });
  }
}
