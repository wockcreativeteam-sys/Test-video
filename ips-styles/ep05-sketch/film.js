// Ep05 "Advanced Treatment, One Destination" — urban sketch, pen and wash on one sketchbook page.
// The pen draws the hospital first; five ink paths run out from it to five specialty sketches, each drawn
// and washed with colour as the voice names it; the page ends with a consultation and the whole page in view.
import { clamp, lerp, ss, TAU, rng, fbm, hex, mix3, INK, PAPER, rgba, rough, penStroke, drawPen, wash, dab, handwrite, ellipse, figure, drawPrims, R3 } from './engine.js';
import { stand, wave, mixPose } from './poses.js';
const { V } = R3;
const W = 1080, H = 1920, PW = 2400, PH = 4700;
const seg = (t, a, b) => clamp((t - a) / (b - a)), eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }, eo = t => 1 - Math.pow(1 - clamp(t), 3);

let TL, cut = {}, ctx, paper, els = [];
export async function setup(canvas) {
  await Promise.all([document.fonts.load('80px Caveat'), document.fonts.load('600 80px Caveat'), document.fonts.load('80px "Reenie Beanie"')]);
  TL = await (await fetch('timeline.json')).json();
  const L = id => TL.lines.find(l => l.id === id), wd = (id, w) => L(id).words.find(x => x.w.toLowerCase().startsWith(w)).t;
  cut = { hosp: wd('m1', 'one'), paths: wd('m1', 'multiple'), knee: wd('m2', 'orthopedic'), heart: wd('m2', 'cardiac'), brain: wd('m2', 'neurological'),
    kidney: wd('m2', 'transplant'), cancer: wd('m2', 'cancer'), back: wd('m2', 'india'), consult: L('m3').t0 - .2, end: L('cta').t0 - .4, cta: L('cta').t0 };
  window.DUR = TL.dur;
  await LOGO.decode();
  canvas.width = W; canvas.height = H; ctx = canvas.getContext('2d');
  paper = makePaper();
  build();
  return frame;
}

// ---------- the page ----------
function makePaper() {
  const c = document.createElement('canvas'); c.width = PW / 2; c.height = PH / 2; const x = c.getContext('2d'), im = x.createImageData(c.width, c.height);
  for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) {
    const m = fbm(i / 180, j / 180, 3, 4) * .06 + fbm(i / 18, j / 18, 9, 2) * .035, k = (j * c.width + i) * 4;
    im.data[k] = PAPER[0] * (1 - m); im.data[k + 1] = PAPER[1] * (1 - m); im.data[k + 2] = PAPER[2] * (1 - m * 1.2); im.data[k + 3] = 255;
  }
  x.putImageData(im, 0, 0); return c;
}
// an element: pen strokes drawn in order from t0 over dur, then a wash blooming from a point
function el(o) { els.push({ strokes: [], washes: [], ...o }); return els[els.length - 1]; }
const pen = (e, pts, w = 3.2, o = {}) => e.strokes.push(penStroke(pts, { w, wob: w * .4, over: w * 2.2, gap: .35, seed: (e.seed = (e.seed || 11) + 7), ...o }));
const box = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

const HOSP = [1200, 2250], SPOTS = { knee: [560, 1120], heart: [1840, 1140], brain: [500, 2050], kidney: [1900, 2080], cancer: [1220, 3360] };
const COL = { sky: hex('#9fbcd6'), stone: hex('#e3d6bc'), glass: hex('#8fb2cc'), red: hex('#c9573f'), navy: hex('#3d5a86'), green: hex('#7fa04a'), skin: hex('#b07a5c'), bone: hex('#e8dcc2'), gold: hex('#e2b04a'), pink: hex('#d98a8a'), violet: hex('#8b93a6'), teal: hex('#6aa6a0') };

function build() {
  // the hospital, drawn from life
  const h = el({ t0: cut.hosp - .1, dur: 1.4, bloom: [HOSP[0], HOSP[1] - 120], ct: cut.hosp + 1.0, cdur: 1.2 });
  const [hx, hy] = HOSP;
  h.washes.push({ poly: box(hx - 360, hy - 520, 720, 560), col: COL.stone, a: .55 }, { poly: box(hx - 480, hy - 260, 120, 300), col: COL.stone, a: .4 }, { poly: box(hx + 360, hy - 300, 140, 340), col: COL.stone, a: .4 });
  for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) h.washes.push({ poly: box(hx - 320 + k * 108, hy - 470 + r * 104, 70, 64), col: COL.glass, a: .5 });
  h.washes.push({ poly: box(hx - 130, hy - 60, 260, 100), col: COL.navy, a: .45 }, { poly: box(hx - 380, hy - 560, 760, 34), col: COL.red, a: .55 }, { poly: ellipse(hx, hy + 70, 560, 60), col: COL.violet, a: .22 });
  h.washes.push({ poly: ellipse(hx - 560, hy - 600, 360, 260), col: COL.sky, a: .3 }, { poly: ellipse(hx + 520, hy - 640, 420, 230), col: COL.sky, a: .28 });
  pen(h, [[hx - 360, hy + 40], [hx - 360, hy - 520], [hx + 360, hy - 520], [hx + 360, hy + 40]], 3.6);
  pen(h, [[hx - 380, hy - 560], [hx + 380, hy - 560]], 3); pen(h, [[hx - 380, hy - 526], [hx + 380, hy - 526]], 2.4);
  pen(h, [[hx - 480, hy + 40], [hx - 480, hy - 260], [hx - 360, hy - 260]], 3); pen(h, [[hx + 360, hy - 300], [hx + 500, hy - 300], [hx + 500, hy + 40]], 3);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) { const x = hx - 320 + k * 108, y = hy - 470 + r * 104; pen(h, [[x, y + 64], [x, y], [x + 70, y]], 2); }
  pen(h, [[hx - 150, hy + 40], [hx - 150, hy - 70], [hx + 150, hy - 70], [hx + 150, hy + 40]], 3); pen(h, [[hx, hy - 60], [hx, hy + 40]], 2.2);
  pen(h, [[hx - 700, hy + 46], [hx + 700, hy + 40]], 2.6);
  for (const tx of [hx - 620, hx + 640]) { pen(h, [[tx, hy + 40], [tx, hy - 120]], 2.4); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; pen(h, [[tx + Math.cos(a) * 60, hy - 200 + Math.sin(a) * 70], [tx + Math.cos(a + .9) * 70, hy - 200 + Math.sin(a + .9) * 76]], 2); } h.washes.push({ poly: ellipse(tx, hy - 200, 95, 105), col: COL.green, a: .55 }); }
  h.label = { text: 'Wockhardt Hospitals · Mumbai', x: hx, y: hy + 150, size: 64, t: cut.hosp + .6 };
  // five paths: dashed ink lines from the hospital out to each specialty
  els.paths = Object.entries(SPOTS).map(([k, [x, y]], i) => {
    const sx = HOSP[0] + Math.sign(x - HOSP[0] || .001) * (Math.abs(x - HOSP[0]) > 200 ? 300 : 0), sy = y < HOSP[1] ? HOSP[1] - 560 : HOSP[1] + 60;
    const mx = (sx + x) / 2 + (i % 2 ? 120 : -120), my = (sy + y) / 2;
    return penStroke([[sx, sy], [mx, my], [x, y + (y < HOSP[1] ? 230 : -230)]], { w: 2.6, wob: 1, over: 4, seed: 300 + i });
  });
  // the five specialties
  const sp = (k, t, draw, label, sub) => { const [x, y] = SPOTS[k]; const e = el({ t0: t - .05, dur: 1.0, bloom: [x, y], ct: t + .45, cdur: .9, seed: 400 + k.length * 13 }); draw(e, x, y); e.label = { text: label, x, y: y + 290, size: 58, t: t + .2, sub }; e.frame = true; return e; };
  sp('knee', cut.knee, (e, x, y) => {   // a knee joint with a robotic arm beside it
    e.washes.push({ poly: [[x - 60, y - 220], [x + 20, y - 220], [x + 30, y - 20], [x - 70, y - 20]], col: COL.bone, a: .6 }, { poly: [[x - 70, y + 20], [x + 30, y + 20], [x + 20, y + 220], [x - 60, y + 220]], col: COL.bone, a: .6 }, { poly: ellipse(x - 20, y, 70, 30), col: COL.gold, a: .55 });
    pen(e, [[x - 60, y - 220], [x - 70, y - 40], [x - 90, y - 10]], 3); pen(e, [[x + 20, y - 220], [x + 30, y - 40], [x + 50, y - 10]], 3);
    pen(e, [[x - 90, y + 30], [x - 70, y + 50], [x - 60, y + 220]], 3); pen(e, [[x + 50, y + 30], [x + 30, y + 50], [x + 20, y + 220]], 3);
    pen(e, [[x + 260, y + 220], [x + 240, y + 40], [x + 140, y - 60], [x + 70, y - 10]], 3.2); pen(e, [[x + 300, y + 220], [x + 220, y + 220]], 3);
    e.washes.push({ poly: [[x + 230, y + 220], [x + 260, y + 40], [x + 160, y - 50], [x + 120, y - 30], [x + 220, y + 50], [x + 210, y + 220]], col: COL.violet, a: .45 });
  }, 'Robotic Knee & Hip Replacement');
  sp('heart', cut.heart, (e, x, y) => {
    const P = [...Array(28)].map((_, i) => { const a = i / 28 * TAU; return [x + 16 * Math.pow(Math.sin(a), 3) * 11, y - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 11]; });
    e.washes.push({ poly: P, col: COL.red, a: .6 }); pen(e, [...P, P[0], P[1]], 3.2);
    pen(e, [[x - 300, y + 230], [x - 120, y + 230], [x - 90, y + 170], [x - 60, y + 290], [x - 30, y + 230], [x + 300, y + 230]], 2.6, { smooth: false });
  }, 'Advanced Cardiac Care');
  sp('brain', cut.brain, (e, x, y) => {
    const P = ellipse(x, y, 200, 150, 32); e.washes.push({ poly: P, col: COL.pink, a: .5 }); pen(e, [...P, P[0], P[1]], 3);
    for (let k = 0; k < 5; k++) pen(e, [[x - 160 + k * 70, y - 100], [x - 120 + k * 70, y - 20], [x - 160 + k * 70, y + 60]], 2.2);
    pen(e, [[x + 40, y - 300], [x + 20, y - 60]], 2.6); e.washes.push({ poly: ellipse(x + 20, y - 50, 18, 18), col: COL.gold, a: .8 });
  }, 'Neurosurgery & DBS');
  sp('kidney', cut.kidney, (e, x, y) => {
    const K = [...Array(24)].map((_, i) => { const a = i / 24 * TAU; const r = 120 - 50 * Math.max(0, Math.cos(a)) ** 3; return [x - 80 + Math.cos(a) * r * .7, y + Math.sin(a) * r]; });
    const Lv = [[x + 30, y - 120], [x + 280, y - 140], [x + 290, y - 30], [x + 120, y + 60], [x + 40, y + 10]];
    e.washes.push({ poly: K, col: COL.red, a: .45 }, { poly: Lv, col: hex('#a86a4a'), a: .5 }); pen(e, [...K, K[0], K[1]], 3); pen(e, [...Lv, Lv[0], Lv[1]], 3);
  }, 'Kidney & Liver Transplant');
  sp('cancer', cut.cancer, (e, x, y) => {   // the awareness ribbon
    // centre line: up the left tail, round the loop at the top, down to the right tail
    const C = [[x - 130, y + 250], [x - 40, y + 60], [x + 40, y - 80], [x + 70, y - 170], [x, y - 230], [x - 70, y - 170], [x - 40, y - 80], [x + 40, y + 60], [x + 130, y + 250]];
    const band = (pts, w) => { const L = [], Rr = []; for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); Rr.push([pts[i][0] - nx * w, pts[i][1] - ny * w]); } return [...L, ...Rr.reverse()]; };
    const sm = (pts) => { const o = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 6; k++) { const u = k / 6; o.push([lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]); } o.push(pts[pts.length - 1]); return o; };
    const B = band(sm(C), 32);
    e.washes.push({ poly: B, col: COL.pink, a: .6 });
    const n = B.length / 2; pen(e, B.slice(0, n), 3); pen(e, B.slice(n), 3);
  }, 'Cancer Care');
  // the consultation: Dr Arjun with Baba and Amara, drawn below
  els.consult = { x: 1200, y: 4150 };
}

// a sketched person (style figures: line, wash, blank face)
const LOOKS = {
  arjun: { skin: hex('#b07a5c'), top: hex('#f4f2ee'), bottom: hex('#3d4458'), hair: hex('#231c1a'), shoe: hex('#333') },
  baba: { skin: hex('#5e3a22'), top: hex('#2f5a8e'), bottom: hex('#4a4e5a'), hair: hex('#ecebe6'), curly: 1, hairVol: .9, shoe: hex('#3a2a22') },
  amara: { skin: hex('#6a4129'), top: hex('#d9852f'), bottom: hex('#2c3346'), hair: hex('#1b1311'), hairLong: 1, shoe: hex('#3a2a22') },
};
function person(who, x, y, S, yaw, pose, colorAmt, inkP, seed) {
  const prims = figure(LOOKS[who], pose, { x, y, S, yaw }, { seed, boil: 0 });
  drawPrims(ctx, prims, { color: colorAmt, ink: inkP });
}

// ---------- camera ----------
function camAt(t) {
  const K = [
    [0, [840, 600, .9]], [cut.hosp - .2, [860, 640, .9]], [cut.hosp + .3, [1200, 1950, .95]], [cut.paths, [1200, 2050, .8]], [cut.paths + 1.6, [1200, 2250, .46]],
    [cut.knee - .25, [1200, 2250, .46]], [cut.knee + .2, [700, 1180, .82]], [cut.heart - .1, [760, 1180, .82]], [cut.heart + .25, [1700, 1180, .82]],
    [cut.brain - .1, [1740, 1200, .82]], [cut.brain + .25, [640, 2080, .82]], [cut.kidney - .1, [680, 2100, .82]], [cut.kidney + .25, [1760, 2120, .82]],
    [cut.cancer - .1, [1780, 2140, .82]], [cut.cancer + .25, [1220, 3360, .82]], [cut.back, [1220, 3330, .82]], [cut.back + .5, [1200, 2400, .46]],
    [cut.consult, [1200, 2600, .46]], [cut.consult + .6, [1200, 3980, .9]], [cut.end, [1200, 4000, .95]], [cut.end + 1.2, [1200, 2300, .44]], [99, [1200, 2300, .44]],
  ];
  let i = 0; while (i < K.length - 2 && t > K[i + 1][0]) i++;
  const [t0, a] = K[i], [t1, b] = K[i + 1], k = eio(seg(t, t0, t1));
  return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), z: Math.exp(lerp(Math.log(a[2]), Math.log(b[2]), k)) };
}

function drawEl(e, t) {
  const total = e.strokes.reduce((s, x) => s + x.L, 0); let acc = 0;
  const p = seg(t, e.t0, e.t0 + e.dur);
  if (p <= 0) return;
  // colour blooms from a point with a ragged wet front
  const c = seg(t, e.ct, e.ct + e.cdur);
  if (c > 0) {
    ctx.save(); ctx.beginPath(); const R = 60 + c * 900, pts = 40;
    for (let i = 0; i <= pts; i++) { const a = i / pts * TAU, r = R * (.82 + .18 * fbm(Math.cos(a) * 3 + e.bloom[0] * .01, Math.sin(a) * 3, 5)); i ? ctx.lineTo(e.bloom[0] + Math.cos(a) * r, e.bloom[1] + Math.sin(a) * r) : ctx.moveTo(e.bloom[0] + Math.cos(a) * r, e.bloom[1] + Math.sin(a) * r); }
    ctx.clip();
    e.washes.forEach((w, i) => wash(ctx, w.poly, w.col, { a: w.a, j: 5, layers: 3, edge: .35, seed: 50 + i, dx: 3, dy: 2 }));
    ctx.restore();
  }
  for (const s of e.strokes) { const a0 = acc / total, a1 = (acc + s.L) / total; acc += s.L; drawPen(ctx, s, seg(p, a0, a1)); }
  if (e.label) {
    const lp = seg(t, e.label.t, e.label.t + .7);
    handwrite(ctx, e.label.text, e.label.x, e.label.y, e.label.size, lp, { font: 'Caveat', weight: 600, align: 'center', col: INK });
  }
}

function frame(t) {
  const cam = camAt(t), z = cam.z;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#e9e0cc'; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(z, 0, 0, z, W / 2 - cam.x * z, H / 2 - cam.y * z);
  ctx.drawImage(paper, 0, -600, PW, PH + 600);
  // the page edge frays into dabs (the painting never goes edge to edge)
  // the corner note
  handwrite(ctx, 'Mumbai · 9:40 am · sunny', 300, 260, 58, seg(t, .1, 1.1), { font: 'Reenie Beanie', col: hex('#5a4a3c') });
  // the hook question, handwritten in the margin
  handwrite(ctx, 'Looking for specialized', 300, 560, 104, seg(t, .7, 1.9), { font: 'Caveat', weight: 600, col: INK });
  handwrite(ctx, 'treatment in India?', 300, 690, 104, seg(t, 1.7, 2.8), { font: 'Caveat', weight: 600, col: hex('#a8432e') });
  // one destination · multiple pathways
  handwrite(ctx, 'One destination.', 1200, 1440, 96, seg(t, cut.hosp + .1, cut.hosp + .9), { font: 'Caveat', weight: 600, align: 'center', col: INK });
  els.paths.forEach((p, i) => { drawPen(ctx, p, seg(t, cut.paths + i * .12, cut.paths + 1.1 + i * .12), hex('#7a6656')); });
  if (!els.rings) els.rings = Object.values(SPOTS).map(([x, y], i) => penStroke([...ellipse(x, y, 300, 270, 30), ...ellipse(x, y, 300, 270, 4)], { w: 2.2, wob: 2.4, over: 10, seed: 500 + i, gap: .6 }));
  els.rings.forEach((r, i) => drawPen(ctx, r, seg(t, cut.paths + 1.0 + i * .12, cut.paths + 1.7 + i * .12), hex('#a89684'), .7));
  handwrite(ctx, 'Multiple care pathways', 1200, 2560, 80, seg(t, cut.paths + .4, cut.paths + 1.3), { font: 'Caveat', weight: 500, align: 'center', col: hex('#5a4a3c') });
  for (const e of els) drawEl(e, t);
  // the consultation
  const C = els.consult, ct = cut.consult;
  if (t > ct) {
    const ink = seg(t, ct, ct + 1.2), col = seg(t, ct + .9, ct + 2.0), nod = Math.sin(seg(t, ct + 1.5, ct + 2.5) * TAU) * .12;
    wash(ctx, ellipse(C.x, C.y + 20, 520, 50), COL.violet, { a: .2 * col, j: 6, seed: 61 });
    const g = Math.sin(t * 2.4) * .04;
    person('arjun', C.x - 260, C.y, 580, Math.PI / 2 + .55, stand({ handR: V(.17, .74 + g, .26), elbR: V(1, -1, 0), headYaw: 0 }), col, ink, 71);
    person('baba', C.x + 110, C.y, 560, -Math.PI / 2 - .55, stand({ nod }), col, ink, 72);
    person('amara', C.x + 340, C.y + 10, 520, -Math.PI / 2 - .6, stand({ handL: V(-.14, .72, .16), elbL: V(-1, -1, 0) }), col, ink, 73);
    handwrite(ctx, 'specialist evaluation', C.x, C.y + 140, 64, seg(t, ct + .4, ct + 1.3), { font: 'Caveat', weight: 600, align: 'center', col: INK });
    handwrite(ctx, '+ coordinated support', C.x, C.y + 220, 58, seg(t, ct + 1.8, ct + 2.6), { font: 'Caveat', weight: 500, align: 'center', col: hex('#a8432e') });
  }
  // end: the whole page; the CTA written in the margin
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const ek = seg(t, cut.end, cut.end + .6);
  if (ek > 0) {
    // the page turns: a fresh sheet slides up from the bottom edge with a soft shadow on its leading edge
    const y0 = H * (1 - eio(ek));
    ctx.save(); ctx.shadowColor = 'rgba(40,30,20,.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = -12;
    ctx.translate(0, y0); ctx.drawImage(paper, 300, 300, W / 2, H / 2, 0, 0, W, H); ctx.restore();
    if (ek >= 1) { handwrite(ctx, 'Mumbai · Wockhardt Hospitals', 60, 120, 48, seg(t, cut.end + .6, cut.end + 1.2), { font: 'Reenie Beanie', col: hex('#5a4a3c') }); hospitalMini(ctx, t); }
    handwrite(ctx, 'Send your medical reports', W / 2, 480, 92, seg(t, cut.cta, cut.cta + 1.1), { font: 'Caveat', weight: 600, align: 'center', col: INK });
    handwrite(ctx, 'for specialist review.', W / 2, 590, 92, seg(t, cut.cta + 1.0, cut.cta + 1.9), { font: 'Caveat', weight: 600, align: 'center', col: hex('#a8432e') });
    wordmark(ctx, seg(t, cut.end + 1.2, cut.end + 1.8));
    endCrisp(ctx, t, cut.cta + 2.0);
  } else wordmark(ctx, seg(t, .3, 1.0), true);
  subs(t);
}

// the hospital again, small, drawn on the new page under the CTA
let mini;
function hospitalMini(c, t) {
  if (!mini) { mini = []; const x = W / 2, y = 1060; const add = (pts, w = 2.6) => mini.push(penStroke(pts, { w, wob: 1, over: 5, seed: 600 + mini.length, gap: .3 }));
    add([[x - 220, y + 120], [x - 220, y - 140], [x + 220, y - 140], [x + 220, y + 120]], 3); add([[x - 240, y - 160], [x + 240, y - 160]]);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) add([[x - 190 + k * 80, y - 100 + r * 64 + 36], [x - 190 + k * 80, y - 100 + r * 64], [x - 140 + k * 80, y - 100 + r * 64]], 1.8);
    add([[x - 420, y + 124], [x + 420, y + 120]]); }
  const p = seg(t, cut.end + .7, cut.end + 2.2);
  mini.forEach((s, i) => drawPen(c, s, seg(p, i / mini.length, (i + 1) / mini.length)));
  const cp = seg(t, cut.end + 1.6, cut.end + 2.6);
  if (cp > 0) { c.save(); c.beginPath(); c.arc(W / 2, 1040, 40 + cp * 400, 0, TAU); c.clip(); wash(c, [[W / 2 - 220, 1180], [W / 2 - 220, 920], [W / 2 + 220, 920], [W / 2 + 220, 1180]], COL.stone, { a: .5, j: 5, seed: 81, dx: 3, dy: 2 }); wash(c, [[W / 2 - 240, 900], [W / 2 + 240, 900], [W / 2 + 240, 920], [W / 2 - 240, 920]], COL.red, { a: .55, j: 3, seed: 82 }); wash(c, ellipse(W / 2, 1190, 460, 40), COL.violet, { a: .2, j: 5, seed: 83 }); c.restore(); }
}
const LOGO = new Image(); LOGO.src = 'logo-color.png';
function wordmark(c, a, corner = false) {
  if (a <= 0 || !LOGO.complete) return;
  const w = corner ? 380 : 860, h = w * LOGO.height / LOGO.width, x = corner ? W - 40 - w : W / 2 - w / 2, y = corner ? 60 : 150;
  c.save(); c.globalAlpha = a; c.drawImage(LOGO, x, y, w, h); c.restore();
}
function endCrisp(c, t, t0) {
  const a = seg(t, t0, t0 + .5); if (a <= 0) return;
  c.save(); c.globalAlpha = a;
  const bw = 640, bx = W / 2 - bw / 2, by = 1300, press = 1 - .05 * Math.sin(Math.PI * seg(t, t0 + 1.3, t0 + 1.6));
  c.translate(W / 2, by + 50); c.scale(press, press); c.translate(-W / 2, -(by + 50));
  c.shadowColor = 'rgba(60,10,8,.35)'; c.shadowBlur = 18; c.shadowOffsetY = 6;
  c.fillStyle = '#c8322a'; c.beginPath(); c.roundRect(bx, by, bw, 100, 50); c.fill(); c.shadowColor = 'transparent';
  c.fillStyle = '#fff'; c.font = '700 48px Caveat'; c.textAlign = 'center'; c.fillText('GET AN EXPERT OPINION  →', W / 2, by + 66);
  c.restore();
  c.save(); c.globalAlpha = a; c.fillStyle = 'rgba(61,90,134,.95)'; c.fillRect(0, H - 250, W, 250);
  c.fillStyle = '#f2d27a'; c.font = '600 44px Caveat'; c.textAlign = 'center'; c.fillText('International Patient Services', W / 2, H - 165);
  c.fillStyle = '#fff'; c.font = '600 60px Caveat'; c.fillText('+91 91360 91380', W / 2, H - 98); c.font = '500 40px Caveat'; c.fillStyle = '#dbe6f4'; c.fillText('wockhardthospitals.com', W / 2, H - 50);
  c.restore();
}
// subtitles: handwritten into a strip in the lower margin
function subs(t) {
  const L = TL.lines.find(l => t >= l.t0 - .05 && t < l.t0 + l.dur + .4);
  if (!L || L.id === 'hook' || L.id === 'cta') return;
  const ws = L.words, chunks = []; let cur = [];
  ctx.save(); ctx.font = '600 54px Caveat';
  for (const w of ws) { cur.push(w); if (ctx.measureText(cur.map(x => x.w).join(' ')).width > 880 || /[,.]$/.test(w.w)) { chunks.push(cur); cur = []; } }
  if (cur.length) chunks.push(cur);
  const ch = chunks.find((c, i) => t < (chunks[i + 1] ? chunks[i + 1][0].t - .05 : 1e9)) || chunks[chunks.length - 1];
  const a = Math.min(seg(t, L.t0 - .05, L.t0 + .1), 1 - seg(t, L.t0 + L.dur + .2, L.t0 + L.dur + .4));
  ctx.globalAlpha = a * .9; ctx.fillStyle = '#f5eede'; ctx.beginPath(); ctx.roundRect(70, 1470, W - 140, 104, 8); ctx.fill();
  ctx.globalAlpha = a; ctx.fillStyle = rgba(INK, .95); ctx.textAlign = 'center';
  ctx.fillText(ch.map(x => x.w).join(' '), W / 2, 1540);
  ctx.restore();
}
