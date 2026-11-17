// The recurring cast, as palette-knife figures.
// Each person is a flat, value-planned reference (body plate + head plate, painted once by paintRef) in
// person-local units: feet at (0, 0), up is negative, ~1240 tall. Faces (eyes, brows, mouth, glasses) and
// gesturing arms are procedural strokes rebuilt each frame from fixed seeds, so the paint never boils.
import { Ref, paintRef } from './engine/plate.js';
import { KNIFE, BRUSH, DAB, LINE, hex, mixc } from './engine/impasto.js';
import { P, E, lin, clamp, lerp } from './common.js';

export const PEOPLE = {
  baba: { skin: '#5a3620', skinL: '#8a5a3a', hair: '#ecebe6', top: '#1f3d66', topL: '#2f5a8e', pat1: '#e6a23c', pat2: '#2ba39b', pants: '#3b3f4a', shoes: '#2a1d16', hairStyle: 'curls', beard: true, glasses: true, build: 1.08 },
  amara: { skin: '#6a4129', skinL: '#9a6440', hair: '#1b1311', top: '#d9852f', topL: '#f0a54c', pants: '#2c3346', shoes: '#3a2a22', hairStyle: 'bun', earrings: '#e8b24a', build: .92 },
  priya: { skin: '#b47650', skinL: '#d8a07a', hair: '#15100e', top: '#14306e', topL: '#2a4c96', shirt: '#f4f2ee', pants: '#14306e', shoes: '#16161c', hairStyle: 'lowbun', lanyard: '#c8262e', build: .9 },
  arjun: { skin: '#a56a45', skinL: '#cf9670', hair: '#17140f', top: '#f4f6f8', topL: '#ffffff', shirt: '#c9ddf2', tie: '#14306e', pants: '#2e3442', shoes: '#1e1a18', hairStyle: 'side', stubble: true, coat: true, build: 1 },
};

// head centre in person-local units (for faces, look direction, props near the head)
export const HEAD = [0, -1105];
const HS = 1.3; // the head is drawn larger for appeal

function inP(c, f) { c.save(); c.translate(560, 1300); f(c); c.restore(); }
export const POX = 560, POY = 1300, PRW = 1120, PRH = 1400;

function drawBody(R, s) {
  const p = PEOPLE[s], b = p.build, L = (path, fill, props) => R.fill(c => inP(c, path), fill, props);
  // legs + shoes
  L(P([[-78 * b, -470], [-8, -470], [-14, -40], [-70 * b, -40]]), lin(-80, 0, 0, 0, [[0, p.pants], [1, shadeHex(p.pants, .82)]]), { dir: 90, group: 'leg1', maxR: 9 });
  L(P([[8, -470], [78 * b, -470], [70 * b, -40], [14, -40]]), lin(0, 0, 80, 0, [[0, shadeHex(p.pants, .9)], [1, shadeHex(p.pants, .7)]]), { dir: 90, group: 'leg2', maxR: 9 });
  for (const sd of [-1, 1]) L(c => { c.moveTo(sd * 18, -48); c.lineTo(sd * 82 * b, -48); c.quadraticCurveTo(sd * 104 * b, -10, sd * 96 * b, 0); c.lineTo(sd * 10, 0); c.closePath(); }, p.shoes, { dir: 0, group: 'shoe' + sd, maxR: 5 });
  // torso / top
  const w = 150 * b;
  L(c => { c.moveTo(-w * .34, -948); c.bezierCurveTo(-w * .7, -935, -w * .96, -915, -w * 1.0, -850); c.bezierCurveTo(-w * 1.0, -760, -w * .86, -620, -w * .8, -520); c.bezierCurveTo(-w * .82, -480, -w * .86, -450, -w * .88, -430); c.lineTo(w * .88, -430); c.bezierCurveTo(w * .86, -450, w * .82, -480, w * .8, -520); c.bezierCurveTo(w * .86, -620, w * 1.0, -760, w * 1.0, -850); c.bezierCurveTo(w * .96, -915, w * .7, -935, w * .34, -948); c.closePath(); },
    lin(-w, 0, w, 0, [[0, p.topL], [.5, p.top], [1, shadeHex(p.top, .72)]]), { dir: 90, group: 'top', maxR: 16, hgt: 1.05 });
  if (p.pat1) { // kitenge print: rows of medallions and triangles, painted as small dabs inside the shirt
    for (let row = 0; row < 5; row++) for (let k = -2; k <= 2; k++) {
      const x = k * 52 * b + (row % 2) * 26, y = -880 + row * 92;
      if (Math.abs(x) > w * .82) continue;
      if (row % 2) { L(E(x, y, 17, 17), p.pat2, { group: 'top', maxR: 4, type: DAB }); L(E(x, y, 8, 8), p.pat1, { group: 'top', maxR: 3, type: DAB }); }
      else L(P([[x - 18, y + 12], [x, y - 14], [x + 18, y + 12]]), p.pat1, { group: 'top', maxR: 4 });
    }
  }
  if (p.coat) { // white coat over shirt + tie
    L(P([[-30, -925], [30, -925], [16, -560], [-16, -560]]), p.shirt, { dir: 90, group: 'shirt', maxR: 6 });
    L(P([[-11, -915], [11, -915], [18, -640], [0, -600], [-18, -640]]), p.tie, { dir: 90, group: 'tie', maxR: 4 });
    L(P([[-w * .66, -930], [-30, -925], [-60, -760], [-14, -440], [-w * .9, -440]]), '#f2f4f7', { dir: 92, group: 'coatL', maxR: 12 });
    L(P([[w * .66, -930], [30, -925], [60, -760], [14, -440], [w * .9, -440]]), '#dfe4ea', { dir: 88, group: 'coatR', maxR: 12 });
    L(c => { c.arc(-38, -560, 26, 0, 7); }, '#c5cbd3', { group: 'steth', maxR: 4 });
  }
  if (p.shirt && !p.coat) { // blazer V with shirt, lanyard + card
    L(P([[-36, -928], [36, -928], [0, -760]]), p.shirt, { dir: 90, group: 'shirt', maxR: 5 });
    if (p.lanyard) {
      L(c => { c.moveTo(-34, -925); c.lineTo(-10, -700); c.lineTo(-2, -700); c.lineTo(-24, -925); c.closePath(); }, p.lanyard, { group: 'lan1', maxR: 3 });
      L(c => { c.moveTo(34, -925); c.lineTo(10, -700); c.lineTo(2, -700); c.lineTo(24, -925); c.closePath(); }, p.lanyard, { group: 'lan2', maxR: 3 });
      L(P([[-38, -705], [38, -705], [38, -600], [-38, -600]]), '#f6f6f2', { dir: 0, group: 'card', maxR: 5 });
      L(P([[-38, -705], [38, -705], [38, -684], [-38, -684]]), '#14306e', { dir: 0, group: 'cardh', maxR: 3 });
    }
  }
  if (s === 'amara') { // wrap fold + sash
    L(c => { c.moveTo(-10, -925); c.lineTo(70, -700); c.lineTo(100, -560); c.lineTo(60, -560); c.lineTo(30, -700); c.closePath(); }, shadeHex(p.top, .8), { dir: 70, group: 'fold', maxR: 6 });
    L(P([[-w * .9, -520], [w * .9, -520], [w * .9, -486], [-w * .9, -486]]), shadeHex(p.top, .72), { dir: 0, group: 'sash', maxR: 5 });
  }
  // neck
  L(P([[-34, -1040], [34, -1040], [38, -930], [-38, -930]]), lin(0, -990, 0, -920, [[0, shadeHex(p.skin, .78)], [1, p.skin]]), { dir: 90, group: 'neck', maxR: 6 });
}

function drawHead(R, s) {
  const p = PEOPLE[s];
  const hs = c => { c.translate(HEAD[0], HEAD[1]); c.scale(HS, HS); c.translate(-HEAD[0], -HEAD[1]); };
  const L = (path, fill, props) => R.fill(c => inP(c, q => { hs(q); path(q); }), fill, props);
  const RT = R.tint.bind(R); R = { fill: R.fill.bind(R), tint: (path, fill) => RT(c => inP(c, q => { hs(q); path(q); }), fill) };
  const [hx, hy] = HEAD;
  // hair mass behind the face
  if (p.hairStyle === 'bun') {
    L(E(hx - 6, hy - 168, 64, 50), lin(-60, 0, 60, 0, [[0, '#3a2a24'], [1, '#100a08']]), { dir: 'edge', fallback: 0, group: 'bun', maxR: 7 });
    for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) L(c => { c.moveTo(hx + sd * (70 + k * 10), hy - 20); c.quadraticCurveTo(hx + sd * (96 + k * 12), hy + 140, hx + sd * (100 + k * 16), hy + 330); c.lineTo(hx + sd * (86 + k * 16), hy + 330); c.quadraticCurveTo(hx + sd * (82 + k * 12), hy + 140, hx + sd * (58 + k * 10), hy - 20); c.closePath(); }, k % 2 ? '#241812' : '#3a2820', { dir: 90, group: 'braid' + sd + k, maxR: 5 });
  }
  if (p.hairStyle === 'lowbun') L(E(hx + 74, hy + 26, 40, 38), '#1a120e', { group: 'lowbun', maxR: 7 });
  // face
  L(c => { c.ellipse(hx, hy, 82, 102, 0, 0, 7); }, lin(hx - 82, 0, hx + 82, 0, [[0, p.skinL], [.45, p.skin], [1, shadeHex(p.skin, .78)]]), { dir: 'edge', fallback: 90, group: 'face', maxR: 7, detail: .8 });
  // ears
  for (const sd of [-1, 1]) L(E(hx + sd * 84, hy + 8, 14, 22), shadeHex(p.skin, sd < 0 ? 1.05 : .82), { group: 'ear' + sd, maxR: 3 });
  // nose (one lit plane + shadow)
  L(c => { c.moveTo(hx + 2, hy - 6); c.lineTo(hx + 14, hy + 34); c.lineTo(hx - 8, hy + 36); c.closePath(); }, shadeHex(p.skin, .84), { group: 'nose', maxR: 3 });
  // hair front
  const hairFill = lin(hx - 90, hy - 130, hx + 90, hy - 20, [[0, shadeHex(p.hair, 1.15)], [1, shadeHex(p.hair, .75)]]);
  if (p.hairStyle === 'curls') {
    L(c => { c.moveTo(hx - 88, hy + 6); c.bezierCurveTo(hx - 100, hy - 110, hx - 40, hy - 132, hx, hy - 132); c.bezierCurveTo(hx + 40, hy - 132, hx + 100, hy - 110, hx + 88, hy + 6); c.lineTo(hx + 72, hy - 10); c.bezierCurveTo(hx + 66, hy - 64, hx + 30, hy - 82, hx, hy - 82); c.bezierCurveTo(hx - 30, hy - 82, hx - 66, hy - 64, hx - 72, hy - 10); c.closePath(); }, '#e2e0da', { dir: 'edge', group: 'hair', maxR: 5, type: DAB, detail: .6 });
  } else if (p.hairStyle === 'bun' || p.hairStyle === 'lowbun' || p.hairStyle === 'side') {
    L(c => { c.moveTo(hx - 86, hy + 10); c.bezierCurveTo(hx - 98, hy - 118, hx - 30, hy - 136, hx + 4, hy - 134); c.bezierCurveTo(hx + 60, hy - 132, hx + 100, hy - 100, hx + 86, hy + 10); c.lineTo(hx + 72, hy - 20);
      if (p.hairStyle === 'side') { c.bezierCurveTo(hx + 60, hy - 70, hx + 10, hy - 84, hx - 30, hy - 92); c.lineTo(hx - 40, hy - 74); }
      else c.bezierCurveTo(hx + 50, hy - 84, hx - 40, hy - 90, hx - 66, hy - 50);
      c.lineTo(hx - 72, hy - 10); c.closePath(); }, hairFill, { dir: 'edge', fallback: 20, group: 'hair', maxR: 6 });
  }
  if (p.beard) L(c => { c.moveTo(hx - 80, hy + 10); c.bezierCurveTo(hx - 80, hy + 90, hx - 40, hy + 128, hx, hy + 130); c.bezierCurveTo(hx + 40, hy + 128, hx + 80, hy + 90, hx + 80, hy + 10); c.lineTo(hx + 66, hy + 16); c.bezierCurveTo(hx + 56, hy + 50, hx + 30, hy + 58, hx, hy + 58); c.bezierCurveTo(hx - 30, hy + 58, hx - 56, hy + 50, hx - 66, hy + 16); c.closePath(); }, lin(0, hy, 0, hy + 130, [[0, '#ecebe6'], [1, '#c8c4bc']]), { dir: 'edge', group: 'beard', maxR: 5, type: DAB });
  if (p.stubble) R.tint(q => { q.ellipse(hx, hy + 56, 74, 50, 0, 0, Math.PI); }, 'rgba(40,24,16,.28)');
  if (p.earrings) for (const sd of [-1, 1]) L(c => { c.arc(hx + sd * 86, hy + 50, 13, 0, 7); c.arc(hx + sd * 86, hy + 50, 8, 0, 7, true); }, p.earrings, { group: 'ear-r' + sd, maxR: 2, rule: 'evenodd' });
  // cheek warmth
  R.tint(q => { q.ellipse(hx - 44, hy + 34, 22, 14, 0, 0, 7); q.ellipse(hx + 44, hy + 34, 22, 14, 0, 0, 7); }, 'rgba(220,110,90,.18)');
}

// push strokes scaled by HS about the head centre
const scaled = out => ({ push: o => out.push({ ...o, x: HEAD[0] + (o.x - HEAD[0]) * HS, y: HEAD[1] + (o.y - HEAD[1]) * HS, len: o.len * HS, wid: o.wid * HS }) });
const shadeHex = (h, k) => { const [r, g, b] = hex(h); const f = v => Math.round(clamp(k >= 1 ? v + (1 - v) * (k - 1) : v * k) * 255).toString(16).padStart(2, '0'); return '#' + f(r) + f(g) + f(b); };
export { shadeHex };

// paint one person: { body, head } plates, strokes in person-local units
export function buildPerson(s, seed = 5, detail = 1) {
  const mk = (draw) => {
    const R = new Ref(PRW, PRH, 1); draw(R, s);
    const st = paintRef(R, { R: [22, 11, 6, 3.2, 1.8].map(r => r * detail), T: 10, seed });
    const a = st.a; for (let i = 0; i < st.n; i++) { a[i * 20] -= POX; a[i * 20 + 1] -= POY; }
    return { strokes: st, ref: R };
  };
  return { body: mk(drawBody), head: mk(drawHead) };
}

// face strokes (head-local = person-local). o: { look:[x,y], smile 0..1, blink 0..1, talk 0..1 }
export function face(out0, s, o = {}) {
  const out = scaled(out0);
  const p = PEOPLE[s], [hx, hy] = HEAD, look = o.look || [0, 0], sm = o.smile ?? .5, bl = o.blink || 0;
  const ink = hex('#1a0f0a'), white = hex('#f4efe6'), browC = hex(s === 'baba' ? '#e8e6e0' : '#1a120e');
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 34 + look[0] * 5, ey = hy - 4 + look[1] * 4;
    if (bl > .6) out.push({ x: ex, y: ey + 2, ang: 0, len: 26, wid: 5, c: ink, seed: 70 + sd, type: BRUSH, bend: -.3 });
    else {
      out.push({ x: ex - look[0] * 2, y: ey, ang: 0, len: 30, wid: 20 * (1 - bl * .7), c: white, seed: 71 + sd, type: DAB, hgt: .5 });
      out.push({ x: ex + look[0] * 3, y: ey + 1, ang: 0, len: 16, wid: 17 * (1 - bl * .7), c: ink, seed: 72 + sd, type: DAB, hgt: .6 });
      out.push({ x: ex + look[0] * 3 + 4, y: ey - 4, ang: 0, len: 5, wid: 5, c: [1, 1, 1], seed: 73 + sd, type: DAB, hgt: .8 });
    }
    out.push({ x: hx + sd * 34, y: hy - 38 - sm * 2 + (o.worry ? (sd > 0 ? -2 : 2) : 0), ang: sd * (o.worry ? .25 : -.1), len: 38, wid: s === 'baba' ? 9 : 8, c: browC, seed: 74 + sd, type: KNIFE, taper: .3 });
  }
  // mouth: a smile curve, opening a little when talking
  const mo = (o.talk || 0) * (.5 + .5 * Math.sin((o.t || 0) * 17 + (s.length * 3)));
  if (mo > .15) out.push({ x: hx, y: hy + 58, ang: 0, len: 30 + sm * 10, wid: 10 + mo * 12, c: hex('#4a1c16'), seed: 80, type: DAB, hgt: .4 });
  out.push({ x: hx, y: hy + 54, ang: 0, len: 34 + sm * 16, wid: 7, c: hex(s === 'priya' || s === 'amara' ? '#8a3a34' : '#4a2418'), seed: 81, type: BRUSH, bend: .25 + sm * .35 });
}

// glasses as two rings of short strokes (round frames for Baba)
export function glasses(out0, s) {
  const out = scaled(out0);
  const [hx, hy] = HEAD, c = hex('#24160e');
  for (const sd of [-1, 1]) for (let k = 0; k < 12; k++) {
    const a0 = k / 12 * Math.PI * 2, a1 = (k + 1) / 12 * Math.PI * 2, r = 31;
    const x0 = hx + sd * 34 + Math.cos(a0) * r, y0 = hy - 2 + Math.sin(a0) * r * .9, x1 = hx + sd * 34 + Math.cos(a1) * r, y1 = hy - 2 + Math.sin(a1) * r * .9;
    out.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, ang: Math.atan2(y1 - y0, x1 - x0), len: Math.hypot(x1 - x0, y1 - y0) * 1.3, wid: 8, c, seed: 90 + k + sd * 20, type: KNIFE, run: 0 });
  }
  out.push({ x: hx, y: hy - 8, ang: 0, len: 20, wid: 7, c, seed: 120, type: BRUSH, bend: -.3 });
}

// an arm from the shoulder to a hand target (person-local), sleeve colour + hand
export function arm(out, s, side, hand, o = {}) {
  const p = PEOPLE[s], b = p.build, sx = side * 128 * b, sy = -900;
  const [hx, hy] = hand, mx = (sx + hx) / 2 + side * (o.bow ?? 40), my = (sy + hy) / 2 + 30;
  const sl = hex(p.coat ? '#eef1f4' : p.top), sl2 = hex(p.coat ? '#cfd6de' : p.topL || p.top);
  const dk = sl.map(v => v * .72);
  const seg = (x0, y0, x1, y1, w, sd) => {
    const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0) * 1.1, nx = -Math.sin(a), ny = Math.cos(a);
    const lit = side < 0 ? -1 : 1; // the key light comes from the viewer's left
    out.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, ang: a, len: L, wid: w, c: sl, c2: sl2, seed: sd, type: KNIFE, hgt: .9, skew: 0 });
    out.push({ x: (x0 + x1) / 2 + nx * w * .3 * lit, y: (y0 + y1) / 2 + ny * w * .3 * lit, ang: a, len: L * .9, wid: w * .34, c: dk, seed: sd + 50, type: KNIFE, alpha: .75 });
    out.push({ x: (x0 + x1) / 2 - nx * w * .28 * lit, y: (y0 + y1) / 2 - ny * w * .28 * lit, ang: a, len: L * .82, wid: w * .26, c: sl2, seed: sd + 60, type: KNIFE, alpha: .8 });
  };
  seg(sx, sy, mx, my, 66 * b, 201 + side); seg(mx, my, hx, hy, 56 * b, 203 + side);
  out.push({ x: mx, y: my, ang: Math.atan2(hy - sy, hx - sx), len: 64 * b, wid: 60 * b, c: sl, seed: 207 + side, type: DAB }); // the elbow
  out.push({ x: sx, y: sy + 8, ang: Math.PI / 2, len: 80 * b, wid: 70 * b, c: sl2, seed: 208 + side, type: DAB }); // the shoulder cap
  out.push({ x: hx, y: hy, ang: o.handAng ?? Math.atan2(hy - my, hx - mx), len: 46, wid: 36, c: hex(p.skin), c2: hex(p.skinL), seed: 205 + side, type: DAB });
  if (o.wave) for (let k = 0; k < 4; k++) out.push({ x: hx - 14 + k * 9, y: hy - 30, ang: -Math.PI / 2 + (k - 1.5) * .18, len: 28, wid: 9, c: hex(p.skin), seed: 210 + k, type: BRUSH });
}
