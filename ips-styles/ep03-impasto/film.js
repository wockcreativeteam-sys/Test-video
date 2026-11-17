// Ep03 "Landed in India? We're Already There." — impasto. Airport stress is a grey world; the first
// colour is the welcome placard, and from it colour is re-laid across everything the team touches.
import { logoReady, Stage, W, H, TR, mul, key, titlePlate, label, chip, subs, endCrisp, wordmark, hex, clamp, lerp, seg, eio, eo } from './kit/stage.js';
import { P, E as EL, lin, rad } from './kit/common.js';
import { KNIFE, BRUSH, DAB, LINE } from './kit/engine/impasto.js';

let S, TL, PL = {}, cut = {};
const NEVER = 1e6;
const sweep = (w, h, d = .55) => (x, y) => (x / w) * d * .8 + (y / h) * d * .2;

export async function setup(canvas) {
  await Promise.all(['italic 600 100px "Cormorant Garamond"', '600 40px "Cormorant Garamond"', '500 40px "Cormorant SC"'].map(f => document.fonts.load(f)));
  await logoReady();
  TL = await (await fetch('timeline.json')).json();
  const L = id => TL.lines.find(l => l.id === id), wd = (id, w) => L(id).words.find(x => x.w.toLowerCase().startsWith(w)).t;
  cut = { title: .75, hall: L('m1').t0 - .12, wock: wd('m2', 'wockhardt') - .2, reveal: wd('m2', 'wockhardt'), airport: wd('m2', 'airport'), road: wd('m2', 'pickup') - .25, room: wd('m2', 'accommodation') - .2, hosp: wd('m2', 'coordinated') - .2, end: L('cta').t0 - .25, cta: L('cta').t0 };
  window.DUR = TL.dur;
  S = new Stage(canvas);
  // ---------- plates ----------
  PL.sky = S.plateOf(1300, 2300, R => {
    R.fill(P([[0, 0], [1300, 0], [1300, 1560], [0, 1560]]), lin(0, 0, 0, 1560, [[0, '#3c4a78'], [.45, '#8a7f9e'], [.78, '#e6a07c'], [1, '#f6c98a']]), { dir: -4, fallback: -4, group: 'sky', maxR: 60, detail: 2.2 });
    R.fill(EL(880, 1420, 70, 70), rad(880, 1420, 10, 70, [[0, '#fff2c8'], [1, '#f6c27a']]), { group: 'sun', maxR: 10 });
    for (const [x, y, w] of [[180, 520, 300], [760, 360, 380], [420, 980, 260], [980, 860, 280]]) R.fill(EL(x, y, w, 46), '#c8a6ae', { dir: 0, group: 'cl' + x, maxR: 24, aj: .15 });
    // skyline
    const bl = [[0, 1500, 120], [110, 1430, 90], [190, 1360, 70], [250, 1470, 150], [390, 1300, 80], [460, 1410, 110], [560, 1250, 60], [610, 1380, 130], [730, 1330, 90], [810, 1450, 160], [960, 1290, 70], [1020, 1400, 140], [1150, 1350, 150]];
    bl.forEach(([x, y, w], i) => R.fill(P([[x, y], [x + w, y], [x + w, 1600], [x, 1600]]), lin(x, 0, x + w, 0, [[0, '#4a4060'], [1, '#2e2840']]), { dir: 90, group: 'b' + i, maxR: 26, detail: 1.4 }));
    for (let i = 0; i < 70; i++) { const b = bl[i % bl.length], x = b[0] + 12 + ((i * 37) % Math.max(20, b[2] - 24)), y = b[1] + 30 + ((i * 53) % 260); R.fill(P([[x, y], [x + 10, y], [x + 10, y + 14], [x, y + 14]]), '#f2c27a', { group: 'b' + (i % bl.length), maxR: 3 }); }
    R.fill(P([[0, 1590], [1300, 1590], [1300, 2300], [0, 2300]]), lin(0, 1590, 0, 2300, [[0, '#d89a7c'], [.3, '#6a6082'], [1, '#2a2840']]), { dir: 0, fallback: 0, group: 'sea', maxR: 30, aj: .12 });
    for (let i = 0; i < 40; i++) { const y = 1620 + i * 16, w = 160 - i * 2.6; R.fill(P([[880 - w / 2, y], [880 + w / 2, y], [880 + w / 2 - 6, y + 6], [880 - w / 2 + 6, y + 6]]), i % 2 ? '#f6d29a' : '#e8b07a', { dir: 0, group: 'sea', maxR: 6, type: DAB }); }
  }, { seed: 3 });
  PL.title = titlePlate(S, ['Your treatment journey', 'shouldn’t begin with', 'airport stress.'], { size: 92, w: 980, dur: 1.1 });
  // arrivals hall; colour is re-laid outward from the placard
  const PLAC = [930, 1330];
  const revHall = (x, y) => Math.hypot(x - PLAC[0], (y - PLAC[1]) * .8) / 1100;
  PL.hall = S.plateOf(1600, 2300, R => {
    R.fill(P([[0, 0], [1600, 0], [1600, 520], [0, 520]]), lin(0, 0, 0, 520, [[0, '#2c3448'], [1, '#4a5468']]), { dir: 0, group: 'ceil', maxR: 50, detail: 2 });
    for (let i = 0; i < 6; i++) R.fill(P([[i * 280 + 60, 470], [i * 280 + 240, 470], [i * 280 + 230, 500], [i * 280 + 70, 500]]), '#f8f0dc', { dir: 0, group: 'lamp' + i, maxR: 6 });
    R.fill(P([[0, 520], [1600, 520], [1600, 1420], [0, 1420]]), lin(0, 520, 0, 1420, [[0, '#a8c4d8'], [.55, '#d8e2e6'], [1, '#c8c0b0']]), { dir: 90, fallback: 90, group: 'glass', maxR: 40, detail: 1.6 });
    for (let i = 0; i <= 8; i++) R.fill(P([[i * 200 - 14, 520], [i * 200 + 14, 520], [i * 200 + 14, 1420], [i * 200 - 14, 1420]]), '#3c4658', { dir: 90, group: 'mul' + i, maxR: 8 });
    // a plane on the apron through the glass
    R.fill(c => { c.moveTo(260, 1150); c.lineTo(920, 1130); c.quadraticCurveTo(990, 1140, 980, 1170); c.lineTo(280, 1190); c.closePath(); }, '#f4f2ee', { dir: 0, group: 'pl', maxR: 10 });
    R.fill(P([[540, 1160], [700, 1160], [600, 1240], [520, 1240]]), '#dcdad6', { dir: 0, group: 'plw', maxR: 8 });
    R.fill(P([[280, 1150], [340, 1060], [380, 1060], [360, 1160]]), '#c8262e', { group: 'plt', maxR: 6 });
    // the ARRIVALS sign
    R.fill(P([[420, 600], [1180, 600], [1180, 760], [420, 760]]), '#1b2a4e', { dir: 0, group: 'sign', maxR: 12 });
    R.text('ARRIVALS', 800, 715, '600 104px "Cormorant SC"', '#f4e6c4', { dir: 'edge', group: 'signt', maxR: 4 });
    // floor, glossy
    R.fill(P([[0, 1420], [1600, 1420], [1600, 2300], [0, 2300]]), lin(0, 1420, 0, 2300, [[0, '#cfc6b6'], [.4, '#9a9488'], [1, '#5a5650']]), { dir: 0, fallback: 0, group: 'floor', maxR: 34, aj: .15 });
    for (let i = 0; i < 9; i++) for (let k = 0; k < 6; k++) R.fill(P([[i * 200 - 60, 1460 + k * 26], [i * 200 + 60, 1460 + k * 26], [i * 200 + 50, 1468 + k * 26], [i * 200 - 50, 1468 + k * 26]]), '#ece6d8', { dir: 0, group: 'floor', maxR: 5, type: DAB });
    // barrier rail
    R.fill(P([[0, 1560], [1600, 1560], [1600, 1580], [0, 1580]]), '#8a8e96', { dir: 0, group: 'rail', maxR: 6 });
    // marigold garland across the top of the glass (the colour comes back to it too)
    for (let i = 0; i < 40; i++) { const x = 30 + i * 40, y = 540 + Math.sin(i / 39 * Math.PI) * 60; R.fill(EL(x, y, 18, 18), i % 3 ? '#f2a024' : '#e8602a', { group: 'gar' + i, maxR: 6, type: DAB }); }
  }, { seed: 4, rev: revHall });
  PL.road = S.plateOf(1400, 2300, R => {
    R.fill(P([[0, 0], [1400, 0], [1400, 1400], [0, 1400]]), lin(0, 0, 0, 1400, [[0, '#6a8cc4'], [.6, '#f0b88a'], [1, '#f8d6a0']]), { dir: -3, fallback: -3, group: 'sky', maxR: 60, detail: 2.2 });
    R.fill(P([[0, 1300], [1400, 1260], [1400, 1420], [0, 1420]]), '#9a8aa4', { dir: 0, group: 'city', maxR: 20 });
    // the cable-stayed pylon and its fan of cables
    R.fill(P([[640, 260], [700, 260], [740, 1420], [600, 1420]]), lin(600, 0, 740, 0, [[0, '#f2e6d4'], [1, '#bca898']]), { dir: 90, group: 'pylon', maxR: 12 });
    for (let k = 0; k < 9; k++) for (const sd of [-1, 1]) R.line(c => { c.moveTo(670, 320 + k * 60); c.lineTo(670 + sd * (180 + k * 70), 1410); }, '#ece0cc', 6, { group: 'cab' + k + sd, maxR: 3, dir: 'edge' });
    R.fill(P([[0, 1410], [1400, 1410], [1400, 1480], [0, 1480]]), '#6a6470', { dir: 0, group: 'deck', maxR: 10 });
    R.fill(P([[0, 1480], [1400, 1480], [1400, 1560], [0, 1560]]), '#4a4652', { dir: 0, group: 'road', maxR: 12 });
    for (let i = 0; i < 8; i++) R.fill(P([[i * 190 + 20, 1515], [i * 190 + 120, 1515], [i * 190 + 120, 1523], [i * 190 + 20, 1523]]), '#f2e6c8', { group: 'road', maxR: 3 });
    R.fill(P([[0, 1560], [1400, 1560], [1400, 2300], [0, 2300]]), lin(0, 1560, 0, 2300, [[0, '#e8b48a'], [.35, '#7a86a8'], [1, '#2e3e66']]), { dir: 0, fallback: 0, group: 'sea', maxR: 30, aj: .12 });
    for (let i = 0; i < 30; i++) { const y = 1600 + i * 22, w = 120 - i * 3; R.fill(P([[670 - w / 2, y], [670 + w / 2, y], [670 + w / 2, y + 7], [670 - w / 2, y + 7]]), '#f4dcc0', { dir: 0, group: 'sea', maxR: 5, type: DAB }); }
  }, { seed: 5, app: sweep(1400, 2300) });
  PL.room = S.plateOf(1300, 2300, R => {
    R.fill(P([[0, 0], [1300, 0], [1300, 1560], [0, 1560]]), lin(0, 0, 1300, 0, [[0, '#e8c8a0'], [1, '#b88a68']]), { dir: 90, fallback: 90, group: 'wall', maxR: 50, detail: 2 });
    // the window: Mumbai at dusk
    R.fill(P([[170, 320], [830, 320], [830, 1120], [170, 1120]]), lin(0, 320, 0, 1120, [[0, '#4a5a8e'], [.6, '#c88ca0'], [1, '#f2b07a']]), { dir: -4, group: 'win', maxR: 30 });
    for (let i = 0; i < 9; i++) { const x = 190 + i * 72, h = 160 + (i * 97) % 220; R.fill(P([[x, 1120 - h], [x + 60, 1120 - h], [x + 60, 1120], [x, 1120]]), '#3a3654', { dir: 90, group: 'win', maxR: 8 }); }
    R.fill(P([[160, 300], [840, 300], [840, 330], [160, 330]]), '#6a4a3a', { dir: 0, group: 'frame', maxR: 6 });
    // curtains
    R.fill(c => { c.moveTo(80, 280); c.lineTo(220, 280); c.bezierCurveTo(240, 600, 200, 900, 230, 1180); c.lineTo(70, 1180); c.closePath(); }, lin(70, 0, 230, 0, [[0, '#a8402e'], [1, '#d8684a']]), { dir: 90, group: 'cur1', maxR: 14 });
    R.fill(c => { c.moveTo(780, 280); c.lineTo(920, 280); c.lineTo(930, 1180); c.lineTo(770, 1180); c.bezierCurveTo(800, 900, 760, 600, 780, 280); c.closePath(); }, lin(770, 0, 930, 0, [[0, '#d8684a'], [1, '#98382a']]), { dir: 90, group: 'cur2', maxR: 14 });
    // lamp
    R.fill(P([[1010, 860], [1180, 860], [1140, 980], [1050, 980]]), '#f6e2b0', { dir: 0, group: 'shade', maxR: 8 });
    R.fill(P([[1088, 980], [1102, 980], [1102, 1330], [1088, 1330]]), '#6a4a30', { group: 'stem', maxR: 4 });
    R.fill(rad(1095, 900, 0, 1, []) && (c => c.ellipse(1095, 920, 220, 220, 0, 0, 7)), rad(1095, 920, 20, 220, [[0, 'rgba(255,230,170,.55)'], [1, 'rgba(255,230,170,0)']]), { group: 'wall', maxR: 30 });
    // the bed
    R.fill(P([[0, 1380], [900, 1380], [920, 1700], [0, 1700]]), lin(0, 1380, 0, 1700, [[0, '#f4ede2'], [1, '#c8beb0']]), { dir: 0, group: 'bed', maxR: 20 });
    R.fill(P([[0, 1300], [520, 1300], [540, 1390], [0, 1390]]), '#e8e0d2', { dir: 0, group: 'pil', maxR: 10 });
    R.fill(P([[0, 1560], [1300, 1560], [1300, 2300], [0, 2300]]), lin(0, 1560, 0, 2300, [[0, '#8a5a3c'], [1, '#4a3022']]), { dir: 0, group: 'floor', maxR: 30 });
  }, { seed: 6, app: sweep(1300, 2300) });
  PL.hosp = S.plateOf(1300, 2300, R => {
    R.fill(P([[0, 0], [1300, 0], [1300, 900], [0, 900]]), lin(0, 0, 0, 900, [[0, '#7aa0d4'], [1, '#d8e4ee']]), { dir: -3, fallback: -3, group: 'sky', maxR: 60, detail: 2.2 });
    R.fill(P([[80, 260], [1220, 260], [1220, 1600], [80, 1600]]), lin(80, 0, 1220, 0, [[0, '#f4efe6'], [1, '#c8c0b4']]), { dir: 90, group: 'bld', maxR: 30 });
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) R.fill(P([[130 + k * 182, 420 + r * 190], [270 + k * 182, 420 + r * 190], [270 + k * 182, 560 + r * 190], [130 + k * 182, 560 + r * 190]]), lin(0, 420 + r * 190, 0, 560 + r * 190, [[0, '#8aaccc'], [1, '#c4d6e2']]), { dir: 90, group: 'w' + r + k, maxR: 10 });
    R.fill(P([[80, 290], [1220, 290], [1220, 380], [80, 380]]), '#ffffff', { dir: 0, group: 'band', maxR: 10 });
    R.text('WOCKHARDT HOSPITALS', 650, 356, '600 64px "Cormorant SC"', '#c8262e', { dir: 'edge', group: 'name', maxR: 3 });
    // entrance canopy and glass doors
    R.fill(P([[300, 1180], [1000, 1180], [1040, 1230], [260, 1230]]), '#1f3d66', { dir: 0, group: 'can', maxR: 10 });
    R.fill(P([[380, 1230], [920, 1230], [920, 1600], [380, 1600]]), lin(0, 1230, 0, 1600, [[0, '#f8eac8'], [1, '#e8c890']]), { dir: 90, group: 'door', maxR: 14 });
    R.fill(P([[645, 1230], [655, 1230], [655, 1600], [645, 1600]]), '#8a8070', { group: 'dline', maxR: 3 });
    R.fill(P([[0, 1600], [1300, 1600], [1300, 2300], [0, 2300]]), lin(0, 1600, 0, 2300, [[0, '#d8ccb8'], [1, '#8a8070']]), { dir: 0, group: 'paving', maxR: 30 });
    for (const x of [150, 1150]) { R.fill(EL(x, 1480, 110, 150), lin(x - 100, 0, x + 100, 0, [[0, '#6aa04a'], [1, '#2e6a3a']]), { group: 'tree' + x, maxR: 16, type: DAB }); R.fill(P([[x - 70, 1580], [x + 70, 1580], [x + 56, 1660], [x - 56, 1660]]), '#a8907a', { group: 'pot' + x, maxR: 8 }); }
  }, { seed: 8, app: sweep(1300, 2300) });
  PL.end = S.plateOf(1080, 1920, R => {
    R.fill(P([[0, 0], [1080, 0], [1080, 1920], [0, 1920]]), rad(540, 760, 60, 1300, [[0, '#fbf3e4'], [.6, '#f0e2c8'], [1, '#d8c4a0']]), { dir: -8, fallback: -8, group: 'bg', maxR: 50, detail: 2 });
    // the healwave: a knife ribbon in the brand colours across the card
    for (const [c, dy] of [['#c8262e', 0], ['#1f5c9e', 16], ['#e8b24a', 30]]) R.line(q => { q.moveTo(-20, 560 + dy); q.bezierCurveTo(300, 470 + dy, 700, 660 + dy, 1100, 540 + dy); }, c, 12, { group: 'w' + c, maxR: 4, dir: 'edge' });
  }, { seed: 9, app: sweep(1080, 1920, .7) });
  PL.cta = titlePlate(S, ['Focus on your health.', 'Let us help coordinate', 'your journey.'], { size: 80, w: 960, color: ['#1f3d66', '#14306e'], align: 'center', dur: 1.2, seed: 33 });
  return frame;
}

// ---------- moving strokes ----------
function plane(d, x, y, k, rev = 0) {
  const c = hex('#f4f2ee'), c2 = hex('#c8cdd6');
  d.push({ x, y, ang: -.12, len: 300 * k, wid: 44 * k, c, c2, type: KNIFE, seed: 1, rev, taper: .2 });
  d.push({ x: x + 10 * k, y: y + 14 * k, ang: .5, len: 150 * k, wid: 34 * k, c: c2, type: KNIFE, seed: 2, rev });
  d.push({ x: x - 128 * k, y: y - 36 * k, ang: -1.2, len: 80 * k, wid: 30 * k, c: hex('#c8262e'), type: KNIFE, seed: 3, rev });
  d.push({ x: x + 150 * k, y: y - 18 * k, ang: -.12, len: 40 * k, wid: 40 * k, c, type: DAB, seed: 4, rev });
  d.push({ x: x + 30 * k, y: y + 40 * k, ang: -.12, len: 40 * k, wid: 20 * k, c: hex('#9aa2b0'), type: KNIFE, seed: 5, rev });
  for (let i = 0; i < 6; i++) d.push({ x: x + (80 - i * 30) * k, y: y - 4 * k + i * 3.6 * k, ang: -.12, len: 12 * k, wid: 9 * k, c: hex('#3a4a66'), type: DAB, seed: 10 + i, rev });
}
function walker(d, x, y, k, ph, col, seed, rev = 0) {
  const sw = Math.sin(ph) * 14 * k;
  d.push({ x: x - 8 * k + sw, y: y - 70 * k, ang: Math.PI / 2 + .1, len: 140 * k, wid: 16 * k, c: hex('#3a3a44'), type: KNIFE, seed, rev });
  d.push({ x: x + 8 * k - sw, y: y - 70 * k, ang: Math.PI / 2 - .1, len: 140 * k, wid: 16 * k, c: hex('#2e2e38'), type: KNIFE, seed: seed + 1, rev });
  d.push({ x, y: y - 220 * k, ang: Math.PI / 2, len: 190 * k, wid: 70 * k, c: hex(col), c2: hex(col), type: KNIFE, seed: seed + 2, rev, taper: -.3 });
  d.push({ x, y: y - 340 * k, ang: 0, len: 46 * k, wid: 50 * k, c: hex('#8a5a3a'), type: DAB, seed: seed + 3, rev });
}
function car(d, x, y, k) {
  const body = hex('#f6f4f0'), blue = hex('#1f3d66');
  d.push({ x, y: y - 46 * k, ang: 0, len: 380 * k, wid: 70 * k, c: body, c2: hex('#d8dce2'), type: KNIFE, seed: 40, skew: 0 });
  d.push({ x: x - 10 * k, y: y - 104 * k, ang: 0, len: 220 * k, wid: 58 * k, c: body, type: KNIFE, seed: 41, taper: .25, skew: 0 });
  d.push({ x: x - 50 * k, y: y - 104 * k, ang: 0, len: 74 * k, wid: 36 * k, c: hex('#3a4a66'), type: KNIFE, seed: 42 });
  d.push({ x: x + 40 * k, y: y - 104 * k, ang: 0, len: 74 * k, wid: 36 * k, c: hex('#3a4a66'), type: KNIFE, seed: 43 });
  d.push({ x, y: y - 40 * k, ang: 0, len: 380 * k, wid: 9 * k, c: blue, type: KNIFE, seed: 44 });
  d.push({ x, y: y - 28 * k, ang: 0, len: 380 * k, wid: 5 * k, c: hex('#c8262e'), type: KNIFE, seed: 45 });
  for (const sx of [-110, 110]) { d.push({ x: x + sx * k, y: y - 6 * k, ang: 0, len: 56 * k, wid: 56 * k, c: hex('#1e1e22'), type: DAB, seed: 46 + sx }); d.push({ x: x + sx * k, y: y - 6 * k, ang: 0, len: 22 * k, wid: 22 * k, c: hex('#9aa0a8'), type: DAB, seed: 47 + sx }); }
  d.push({ x: x + 190 * k, y: y - 52 * k, ang: 0, len: 18 * k, wid: 14 * k, c: hex('#fff2b0'), type: DAB, seed: 48 });
}

const POST = {
  grey: { expo: 1, sat: 1, contrast: 1.05, vig: .32, spec: .26, shin: 26 },
  warm: { expo: 1.03, sat: 1.06, contrast: 1.04, vig: .24, spec: .24, shin: 26 },
};

function frame(t) {
  const d = S.dyn, ov = S.ov;
  S.begin();
  const camOf = (x, y, z) => ({ x, y, zoom: z });
  if (t < cut.hall + .6) { // ---- A: dawn sky, the plane comes in; the title is laid in with the knife
    const cam = camOf(650, key(t, [[0, 1250], [cut.hall + .6, 1180]]), key(t, [[0, 1.0], [cut.hall + .6, 1.06]]));
    S.plate(PL.sky, { t, cam, grey: 1 });
    d.clear(); const pk = seg(t, 0, cut.hall + .6);
    plane(d, lerp(-200, 1250, pk), lerp(1080, 1330, pk), 1.6);
    for (let i = 1; i < 14; i++) d.push({ x: lerp(-200, 1250, pk) - 260 - i * 50, y: lerp(1080, 1330, pk) - 30 - i * 14, ang: .32, len: 54, wid: 9 - i * .45, c: hex('#f4ecde'), type: KNIFE, alpha: .7 - i * .045, seed: 60 + i });
    S.E.drawNow(d.data(), { t, cam, grey: 1, run: 0 }); d.clear();
    const fade = 1 - seg(t, cut.hall - .3, cut.hall + .2);
    if (fade > 0) S.plate(PL.title, { t, cam: camOf(W / 2, H / 2, 1), M: TR(60, 300), grey: 0, appear: cut.title, appDur: 1.3, strokeDur: .16, alpha: fade, noUnder: true });
  }
  if (t >= cut.hall) { // ---- B/C: the arrivals hall, grey; then the placard and the colour
    const inB = t < cut.road + .5;
    if (inB) {
      const z = key(t, [[cut.hall, 1.0], [cut.wock, 1.08], [cut.wock + .01, 1.18], [cut.road, 1.26]]);
      const cam = camOf(key(t, [[cut.hall, 780], [cut.wock, 760], [cut.wock + .01, 780], [cut.road, 800]]), key(t, [[cut.hall, 1460], [cut.road, 1500]]), z);
      const rev = cut.reveal, o = { t, cam, grey: 1, reveal: rev, revDur: .35, revC: [930, 1330, 1100] };
      const app = t < cut.hall + .6 ? { appear: cut.hall, appDur: .6 } : {};
      S.plate(PL.hall, { ...o, ...app });
      // the crowd streams past, grey; each gets colour when the wave reaches them
      d.clear();
      for (let i = 0; i < 14; i++) {
        const sp = 70 + (i * 37) % 60, dir = i % 2 ? 1 : -1, y = 1640 + (i % 4) * 40, x = ((i * 233 + dir * t * sp) % 1900 + 1900) % 1900 - 150;
        if (Math.abs(x - 760) < 260 && y > 1600) continue;
        walker(d, x, y, .9 + (i % 3) * .08, t * 6 + i, ['#7a5a8a', '#3a6a8a', '#a86a3a', '#5a7a4a', '#8a3a3a'][i % 5], 300 + i * 10, Math.hypot(x - 930, (y - 1330) * .8) / 1100);
      }
      S.E.drawNow(d.data(), { ...o, run: 0 }); d.clear();
      // Baba and Amara, with the trolley, looking around
      const lost = t < cut.reveal + .4, lk = Math.sin(t * 1.3);
      const pr = (x, y) => rev + Math.hypot(x - 930, (y - 1330) * .8) / 1100;
      d.push({ x: 650, y: 1735, ang: 0, len: 200, wid: 16, c: hex('#9aa0a8'), type: KNIFE, seed: 501, rev: pr(650, 1735) - rev });
      d.push({ x: 650, y: 1650, ang: 0, len: 170, wid: 150, c: hex('#3a5a8a'), c2: hex('#2a4a6a'), type: KNIFE, seed: 502, rev: pr(650, 1650) - rev });
      d.push({ x: 640, y: 1560, ang: 0, len: 130, wid: 60, c: hex('#b84a3a'), type: KNIFE, seed: 503, rev: pr(640, 1560) - rev });
      S.E.drawNow(d.data(), { ...o, run: 0 }); d.clear();
      S.drawPerson('amara', 470, 1800, .42, { t, cam, grey: 1, reveal: pr(470, 1500), look: lost ? [lk, -.2] : [1, 0], smile: lost ? .15 : .9, worry: lost });
      S.drawPerson('baba', 620, 1790, .45, { t, cam, grey: 1, reveal: pr(620, 1500), look: lost ? [-lk, -.2] : [1, 0], smile: lost ? .1 : .9, worry: lost, armR: [-60, -480], armL: [150, -560] });
      // Priya walks in with the placard: the one thing already in colour
      if (t > cut.wock - .1) {
        const px = key(t, [[cut.wock - .1, 1250], [cut.wock + 1.1, 980]], eo), bob = Math.abs(Math.sin(t * 7)) * 6 * (t < cut.wock + 1.1 ? 1 : 0);
        S.drawPerson('priya', px, 1810, .46, { t, cam, grey: 0, look: [-1, 0], smile: .9, bob, armR: [-120, -700], armL: [110, -700], armRo: { bow: 30 }, armLo: { bow: 30 } });
        // the placard, held up
        const M = [.46, 0, 0, .46, px, 1810 - bob];
        d.push({ x: -10, y: -720, ang: 0, len: 380, wid: 230, c: hex('#fbf6ec'), c2: hex('#efe6d6'), type: KNIFE, seed: 520, skew: 0 });
        d.push({ x: -10, y: -820, ang: 0, len: 380, wid: 44, c: hex('#1f3d66'), type: KNIFE, seed: 521, skew: 0 });
        d.push({ x: -10, y: -798, ang: 0, len: 380, wid: 8, c: hex('#c8262e'), type: KNIFE, seed: 522, skew: 0 });
        S.E.drawNow(d.data(), { t, cam, M, grey: 0, run: 0 }); d.clear();
        // crisp placard text, carried by the camera
        const sx = (px - 10 * .46 - cam.x) * cam.zoom + W / 2, sy = (1810 - bob - 710 * .46 - cam.y) * cam.zoom + H / 2;
        ov.save(); ov.translate(sx, sy); ov.scale(cam.zoom * .46, cam.zoom * .46);
        label(ov, 'Welcome', 0, -22, { size: 52, color: '#1f3d66', align: 'center', shadow: false, italic: true });
        label(ov, 'Mr. Joseph', 0, 46, { size: 64, color: '#1f3d66', align: 'center', shadow: false, weight: 700 });
        ov.restore();
      }
      const post = t < cut.reveal ? POST.grey : POST.warm;
      chip(ov, 'Airport Assistance', 80, 330, seg(t, cut.airport - .9, cut.airport - .5) * (1 - seg(t, cut.road - .1, cut.road + .1)));
      void post;
    }
  }
  if (t >= cut.road && t < cut.room + .6) { // ---- D: pickup and drop: the car crosses the Sea Link
    const cam = camOf(key(t, [[cut.road, 640], [cut.room + .6, 760]]), 1380, 1.0);
    S.plate(PL.road, { t, cam, grey: 0, appear: cut.road, appDur: .55 });
    if (t > cut.road + .2) {
      d.clear(); car(d, key(t, [[cut.road, -250], [cut.room + .6, 1350]], x => x), 1505, 1.4);
      S.E.drawNow(d.data(), { t, cam, grey: 0, run: 0, appear: cut.road + .15, appDur: .1 }); d.clear();
    }
    chip(ov, 'Pickup & Drop', 80, 260, seg(t, cut.road + .2, cut.road + .5) * (1 - seg(t, cut.room - .1, cut.room + .1)));
  }
  if (t >= cut.room && t < cut.hosp + .6) { // ---- E: accommodation: the room, the lamp comes on
    const cam = camOf(650, key(t, [[cut.room, 1320], [cut.hosp + .6, 1260]]), key(t, [[cut.room, 1.0], [cut.hosp + .6, 1.07]]));
    S.plate(PL.room, { t, cam, grey: 0, appear: cut.room, appDur: .55 });
    if (t > cut.room + .3) {
      S.drawPerson('amara', 900, 1900, .46, { t, cam, look: [-1, 0], smile: .9, armL: [180, -560] });
      S.drawPerson('baba', 560, 1880, .48, { t, cam, look: [1, -.3], smile: .95 });
      d.clear(); d.push({ x: 760, y: 1830, ang: 0, len: 120, wid: 150, c: hex('#3a5a8a'), c2: hex('#2a4a6a'), type: KNIFE, seed: 610 }); S.E.drawNow(d.data(), { t, cam, grey: 0, run: 0 }); d.clear();
    }
    chip(ov, 'Accommodation Support', 80, 260, seg(t, cut.room + .2, cut.room + .5) * (1 - seg(t, cut.hosp - .1, cut.hosp + .1)));
  }
  if (t >= cut.hosp && t < cut.end + .7) { // ---- F: hospital arrival; Priya leads them to the doors
    const cam = camOf(650, key(t, [[cut.hosp, 1180], [cut.end + .7, 1260]]), key(t, [[cut.hosp, .94], [cut.end + .7, 1.0]]));
    S.plate(PL.hosp, { t, cam, grey: 0, appear: cut.hosp, appDur: .55 });
    if (t > cut.hosp + .3) {
      const w = seg(t, cut.hosp + .3, cut.end + .5), bob = k => Math.abs(Math.sin(t * 6 + k)) * 6;
      S.drawPerson('priya', lerp(860, 760, w), 1700, .5, { t, cam, look: [-1, 0], smile: .9, bob: bob(0), armR: [-210, -520] });
      S.drawPerson('baba', lerp(420, 500, w), 1720, .52, { t, cam, look: [1, 0], smile: .95, bob: bob(1) });
      S.drawPerson('amara', lerp(240, 320, w), 1735, .48, { t, cam, look: [1, 0], smile: .9, bob: bob(2) });
    }
    chip(ov, 'Hospital Coordination', 80, 260, seg(t, cut.hosp + .2, cut.hosp + .5) * (1 - seg(t, cut.end - .1, cut.end + .1)));
  }
  if (t >= cut.end) { // ---- G: the end card
    const cam = camOf(W / 2, H / 2, 1);
    S.plate(PL.end, { t, cam, grey: 0, appear: cut.end, appDur: .7 });
    S.plate(PL.cta, { t, cam, M: TR(60, 660), grey: 0, appear: cut.cta, appDur: 1.5, strokeDur: .16, noUnder: true });
    wordmark(ov, seg(t, cut.end + .4, cut.end + .9), { x: W / 2, y: 260, dark: true, w: 820 });
    endCrisp(ov, t, cut.cta + 1.4, { button: 'PLAN YOUR TRIP' });
  }
  if (t < cut.hosp) wordmark(ov, 1);
  subs(ov, t, TL.lines);
  S.finish(t < cut.reveal && t > cut.hall ? POST.grey : POST.warm);
}
