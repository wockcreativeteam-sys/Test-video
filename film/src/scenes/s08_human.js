// 01:24.5–01:36  THE HUMAN, AGAIN — silence, white, one line: a newborn's hand around a finger.
import { C } from '../palette.js';
import { E, clamp, env, lerp, seg } from '../engine/util.js';
import { text } from '../engine/type.js';
import { glowDot } from '../engine/lines.js';
import { BABY, pulse } from '../timeline.js';
import { halo } from './common.js';

let STROKES = null; // [{P (screen xy), len, t0, t1}]
const SC = 1.32, OX = 300, OY = 128;
export const WRIST = [OX + 588 * SC, OY + 140 * SC]; // where the baby's pulse rests

function parse(d) {
  const toks = d.replace(/,/g, ' ').trim().split(/\s+/);
  const out = [];
  let cur = [0, 0], cmd = null, i = 0;
  while (i < toks.length) {
    const tk = toks[i];
    if (tk === 'M' || tk === 'C' || tk === 'L') {
      cmd = tk;
      i++;
      continue;
    }
    if (cmd === 'M') {
      cur = [+toks[i], +toks[i + 1]];
      out.push(cur);
      i += 2;
    } else if (cmd === 'L') {
      cur = [+toks[i], +toks[i + 1]];
      out.push(cur);
      i += 2;
    } else if (cmd === 'C') {
      const c1 = [+toks[i], +toks[i + 1]], c2 = [+toks[i + 2], +toks[i + 3]], p = [+toks[i + 4], +toks[i + 5]];
      for (let k = 1; k <= 20; k++) {
        const s = k / 20, a = (1 - s) ** 3, b = 3 * (1 - s) ** 2 * s, c = 3 * (1 - s) * s * s, e = s ** 3;
        out.push([a * cur[0] + b * c1[0] + c * c2[0] + e * p[0], a * cur[1] + b * c1[1] + c * c2[1] + e * p[1]]);
      }
      cur = p;
      i += 6;
    } else i++;
  }
  return out;
}

export const S08 = {
  id: 'human',
  t0: 84.4,
  t1: 96.4,
  async init() {
    const spec = await (await fetch('assets/human/grip.json')).json();
    const list = spec.strokes.map((d) => {
      const pts = parse(d);
      const P = new Float32Array(pts.length * 2);
      let len = 0;
      pts.forEach((q, i) => {
        P[i * 2] = OX + q[0] * SC;
        P[i * 2 + 1] = OY + q[1] * SC;
        if (i) len += Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]);
      });
      return { P, len, edge: pts[0][0] < 2 };
    });
    // one continuous performance: strokes drawn in order, time proportional to length
    const T0 = 85.9, T1 = 90.6;
    const total = list.reduce((s, x) => s + Math.pow(x.len, 0.75), 0);
    let acc = 0;
    for (const x of list) {
      const d = Math.pow(x.len, 0.75) / total;
      x.t0 = lerp(T0, T1, acc);
      x.t1 = lerp(T0, T1, acc + d);
      acc += d;
    }
    STROKES = list;
  },
  draw(F, lt, t) {
    const L = F.L;
    const out = seg(t, 94.8, 95.9, E.inOutCubic);
    // the red point that survived the implosion, breathing in the silence
    const start = [960, 540];
    let head = start;
    let drawing = false;
    for (const s of STROKES) {
      const u = clamp((t - s.t0) / (s.t1 - s.t0));
      if (u <= 0) continue;
      const e = E.inOutSine(u);
      L.poly2(s.P, { rgb: C.INK, a: 0.95 * (1 - out), w: 2.4, to: e, fade: s.edge ? [0, 1] : null });
      if (u < 1) {
        drawing = true;
        // head position at the drawing front
        const n = s.P.length / 2;
        const k = Math.min(n - 1, Math.floor(e * (n - 1)));
        head = [s.P[k * 2], s.P[k * 2 + 1]];
      }
    }
    L.flush();
    const firstT = STROKES[0].t0;
    const pre = t < firstT;
    if (pre) {
      // travel from the centre to the first stroke start, with a breath
      const go = E.inOutCubic(seg(t, 85.2, firstT));
      head = [lerp(start[0], STROKES[0].P[0], go), lerp(start[1], STROKES[0].P[1], go)];
    } else if (!drawing) {
      // drawing complete: the point settles on the baby's wrist and keeps its pulse
      const settle = E.inOutCubic(seg(t, 90.6, 91.5));
      const last = STROKES[STROKES.length - 1];
      const n = last.P.length / 2;
      head = [lerp(last.P[(n - 1) * 2], WRIST[0], settle), lerp(last.P[(n - 1) * 2 + 1], WRIST[1], settle)];
    }
    const babyBeat = t > 87.2 ? pulse(t, BABY, 9) : 0;
    const breath = 0.5 + 0.5 * Math.sin((t - 84.5) * 1.6);
    const r = 4.2 + babyBeat * 2.0 + (pre ? breath * 0.8 : 0);
    const a = 1 - seg(t, 95.4, 96.2);
    halo(F, head[0], head[1], 26 + babyBeat * 30 + (pre ? breath * 8 : 0), C.RED, 0.16 * a);
    F.ctx.fillStyle = `rgba(${C.RED},${a})`;
    F.ctx.beginPath();
    F.ctx.arc(head[0], head[1], r, 0, Math.PI * 2);
    F.ctx.fill();
    glowDot(F, head[0], head[1], 22 + babyBeat * 26, C.RED, 0.35 * a);
    // the line, at last
    const ta = env(t, 91.7, 95.6, 0.1, 0.8);
    if (ta > 0)
      text(F, "IT'S ALREADY HERE.", 960, 958, {
        fam: 'D', wt: 300, size: 34, track: 0.32, align: 'c', rgb: C.INK, a: 0.95 * ta,
        anim: { mode: 'blur', t: t - 91.7, dur: 1.0, stag: 0.04, blurPx: 8 },
      });
  },
};
