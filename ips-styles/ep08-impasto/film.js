// Ep08 "Need a Medical Visa for India? We Help With the Process." — impasto.
// A still life on a desk at home comes alive: the reports fly into the phone, a doctor confirms the plan,
// the invitation letter is laid in with the knife, the visa is stamped, the plane lands, Priya welcomes them.
import { logoReady, Stage, W, H, TR, key, titlePlate, label, chip, subs, endCrisp, wordmark, hex, clamp, lerp, seg, eio, eo } from './kit/stage.js';
import { P, E as EL, lin, rad } from './kit/common.js';
import { KNIFE, BRUSH, DAB } from './kit/engine/impasto.js';
import { sweep, skySet, hospSet, endSet, tableSet } from './kit/sets.js';

let S, TL, PL = {}, cut = {};
export async function setup(canvas) {
  await Promise.all(['italic 600 100px "Cormorant Garamond"', '600 40px "Cormorant Garamond"', '500 40px "Cormorant SC"'].map(f => document.fonts.load(f)));
  await logoReady();
  TL = await (await fetch('timeline.json')).json();
  const L = id => TL.lines.find(l => l.id === id), wd = (id, w, n = 0) => L(id).words.filter(x => x.w.toLowerCase().startsWith(w))[n].t;
  cut = {
    title: .7, share: L('m1').t0 - .15, doc: wd('m1', 'treatment') + .35, desk: wd('m1', 'documentation') - .35, letter: L('m2').t0 - .15,
    pass: L('m3').t0 - .15, stamp: wd('m3', 'process'), plane: wd('m3', 'before') - .2, welcome: wd('m3', 'travel') + .15, end: L('cta').t0 - .25, cta: L('cta').t0,
  };
  window.DUR = TL.dur;
  S = new Stage(canvas);
  PL.table = S.plateOf(1300, 2300, R => {
    tableSet(R);
    // passport, reports, phone, a cup of tea: a still life, value-planned, lit from the upper left
    R.fill(P([[180, 1260], [560, 1220], [600, 1730], [220, 1770]]), lin(180, 1220, 600, 1770, [[0, '#2a4a8a'], [1, '#14306e']]), { dir: 'edge', fallback: -5, group: 'pp', maxR: 12 });
    R.fill(c => c.ellipse(390, 1460, 80, 80, -.08, 0, 7), '#e8b24a', { group: 'ppe', maxR: 5 });
    R.text('PASSPORT', 395, 1650, '600 44px "Cormorant SC"', '#e8c88a', { dir: 'edge', group: 'ppt', maxR: 3 });
    [[620, 700, .06], [660, 760, -.04], [700, 820, .1]].forEach(([x, y, a], i) => {
      const c = Math.cos(a), s = Math.sin(a), Q = (u, v) => [x + u * c - v * s, y + u * s + v * c];
      R.fill(P([Q(0, 0), Q(420, 0), Q(420, 560), Q(0, 560)]), lin(x, y, x + 420, y + 560, [[0, '#fbf7ee'], [1, '#e2dacb']]), { dir: 'edge', fallback: 0, group: 'r' + i, maxR: 12 });
      if (i === 2) { for (let k = 0; k < 7; k++) R.fill(P([Q(40, 120 + k * 52), Q(380 - (k % 3) * 60, 120 + k * 52), Q(380 - (k % 3) * 60, 132 + k * 52), Q(40, 132 + k * 52)]), '#b8b0a2', { group: 'r2', maxR: 3 }); R.fill(P([Q(40, 50), Q(240, 50), Q(240, 76), Q(40, 76)]), '#c8262e', { group: 'r2', maxR: 3 }); }
    });
    R.fill(c => c.roundRect(230, 420, 300, 600, 44), '#1e2228', { dir: 90, group: 'ph', maxR: 10 });
    R.fill(c => c.ellipse(1010, 1660, 150, 150, 0, 0, 7), rad(990, 1640, 10, 150, [[0, '#fbf6ee'], [1, '#d8cfc0']]), { group: 'cup', maxR: 10 });
    R.fill(c => c.ellipse(1010, 1660, 108, 108, 0, 0, 7), rad(1000, 1650, 6, 108, [[0, '#c87a3a'], [1, '#8a4a20']]), { group: 'tea', maxR: 8 });
    R.fill(c => c.ellipse(860, 2010, 230, 70, -.1, 0, 7), '#4a8a5a', { group: 'leaf', maxR: 12, type: DAB });
  }, { seed: 31 });
  PL.title = titlePlate(S, ['Need a Medical Visa', 'to travel to India?'], { size: 100, w: 1000, dur: 1.1 });
  PL.clinic = S.plateOf(1300, 2300, R => {
    R.fill(P([[0, 0], [1300, 0], [1300, 1500], [0, 1500]]), lin(0, 0, 1300, 0, [[0, '#d6e2ea'], [1, '#a8bccc']]), { dir: 90, fallback: 90, group: 'wall', maxR: 50, detail: 2 });
    R.fill(P([[620, 360], [1180, 360], [1180, 980], [620, 980]]), '#2a2e36', { dir: 0, group: 'box', maxR: 10 });
    R.fill(P([[650, 390], [1150, 390], [1150, 950], [650, 950]]), rad(900, 670, 20, 420, [[0, '#f2f8fc'], [1, '#c8d8e4']]), { dir: 0, group: 'lite', maxR: 14 });
    // an x-ray of a knee on the light box
    R.fill(c => { c.moveTo(830, 420); c.lineTo(900, 420); c.lineTo(910, 640); c.bezierCurveTo(960, 660, 960, 700, 900, 720); c.lineTo(880, 920); c.lineTo(820, 920); c.lineTo(830, 720); c.bezierCurveTo(780, 700, 780, 660, 830, 640); c.closePath(); }, '#7a8a9a', { dir: 90, group: 'bone', maxR: 6 });
    R.fill(P([[0, 1500], [1300, 1500], [1300, 2300], [0, 2300]]), lin(0, 1500, 0, 2300, [[0, '#c8bca8'], [1, '#8a7c68']]), { dir: 0, group: 'floor', maxR: 30 });
    R.fill(c => c.ellipse(170, 1240, 120, 210, 0, 0, 7), lin(60, 0, 280, 0, [[0, '#6aa04a'], [1, '#2e6a3a']]), { group: 'plant', maxR: 14, type: DAB });
    R.fill(P([[100, 1420], [240, 1420], [220, 1520], [120, 1520]]), '#b89a7a', { group: 'pot', maxR: 6 });
  }, { seed: 32, app: sweep(1300, 2300) });
  PL.desk = S.plateOf(1300, 2300, R => {
    R.fill(P([[0, 0], [1300, 0], [1300, 1400], [0, 1400]]), lin(0, 0, 1300, 0, [[0, '#ecd6b4'], [1, '#c09a74']]), { dir: 90, fallback: 90, group: 'wall', maxR: 50, detail: 2 });
    R.fill(P([[160, 340], [700, 340], [700, 820], [160, 820]]), lin(0, 340, 0, 820, [[0, '#9ab8d8'], [1, '#e8d8c0']]), { dir: -4, group: 'win', maxR: 24 });
    R.fill(P([[150, 330], [710, 330], [710, 350], [150, 350]]), '#6a4a3a', { group: 'frame', maxR: 5 });
    // the desk, a monitor, a printer with a sheet coming out
    R.fill(P([[0, 1460], [1300, 1440], [1300, 1580], [0, 1600]]), lin(0, 1440, 0, 1600, [[0, '#9a6a44'], [1, '#6a4428']]), { dir: 0, group: 'desk', maxR: 14 });
    R.fill(P([[0, 1600], [1300, 1580], [1300, 2300], [0, 2300]]), lin(0, 1600, 0, 2300, [[0, '#5a3a26'], [1, '#2e1e14']]), { dir: 0, group: 'under', maxR: 30 });
    R.fill(P([[820, 1000], [1220, 1000], [1220, 1300], [820, 1300]]), '#24282e', { dir: 0, group: 'mon', maxR: 8 });
    R.fill(P([[840, 1020], [1200, 1020], [1200, 1280], [840, 1280]]), lin(0, 1020, 0, 1280, [[0, '#f4f6f8'], [1, '#d8e0e8']]), { dir: 0, group: 'scr', maxR: 8 });
    R.fill(P([[880, 1050], [1160, 1050], [1160, 1080], [880, 1080]]), '#1f3d66', { group: 'scr', maxR: 3 });
    R.fill(P([[1000, 1300], [1040, 1300], [1060, 1450], [980, 1450]]), '#3a3e46', { group: 'stand', maxR: 5 });
  }, { seed: 33, app: sweep(1300, 2300) });
  PL.letter = S.plateOf(1080, 1920, R => {
    tableSet(R, { wood: ['#7a5034', '#5a3824', '#3a2418'] });
    R.fill(P([[120, 260], [960, 230], [990, 1500], [150, 1530]]), lin(120, 230, 990, 1530, [[0, '#fdfaf2'], [1, '#e8e0d0']]), { dir: 'edge', fallback: 2, group: 'paper', maxR: 16 });
    R.fill(P([[180, 300], [920, 276], [922, 330], [182, 354]]), '#1f3d66', { group: 'head', maxR: 4 });
    R.fill(P([[182, 354], [922, 330], [922, 340], [182, 364]]), '#c8262e', { group: 'head2', maxR: 3 });
    for (let k = 0; k < 9; k++) R.fill(P([[200, 760 + k * 56], [880 - (k % 4) * 80, 744 + k * 56], [880 - (k % 4) * 80, 756 + k * 56], [200, 772 + k * 56]]), '#bdb4a4', { group: 'paper', maxR: 3 });
  }, { seed: 34, app: sweep(1080, 1920) });
  PL.ltitle = titlePlate(S, ['Medical Visa', 'Invitation Letter'], { size: 92, w: 760, italic: false, color: ['#1f3d66', '#14306e'], dur: 1.0, seed: 35 });
  PL.pass = S.plateOf(1080, 1920, R => {
    tableSet(R, { wood: ['#8a5a3a', '#6a4028', '#4a2c1c'] });
    // an open passport, the visa page on the right
    R.fill(P([[90, 520], [1000, 500], [1020, 1260], [110, 1290]]), '#14306e', { dir: 'edge', group: 'cover', maxR: 10 });
    R.fill(P([[120, 540], [540, 530], [552, 1250], [132, 1262]]), lin(120, 0, 540, 0, [[0, '#f2ead8'], [1, '#ded4bf']]), { dir: 90, group: 'pl', maxR: 12 });
    R.fill(P([[560, 530], [980, 520], [994, 1236], [572, 1250]]), lin(560, 0, 980, 0, [[0, '#ece2cc'], [1, '#f6eedc']]), { dir: 90, group: 'pr', maxR: 12 });
    R.fill(P([[180, 640], [360, 636], [364, 860], [184, 864]]), '#c8bca6', { group: 'photo', maxR: 6 });
    for (let k = 0; k < 6; k++) R.fill(P([[180, 920 + k * 46], [480, 914 + k * 46], [480, 924 + k * 46], [180, 930 + k * 46]]), '#a89e8c', { group: 'pl', maxR: 3 });
    R.text('VISA', 640, 610, '700 52px "Cormorant SC"', '#5a5040', { align: 'left', dir: 'edge', group: 'vt', maxR: 3 });
    for (let k = 0; k < 4; k++) R.fill(P([[620, 680 + k * 44], [900, 676 + k * 44], [900, 686 + k * 44], [620, 690 + k * 44]]), '#b0a690', { group: 'pr', maxR: 3 });
  }, { seed: 36, app: sweep(1080, 1920) });
  PL.sky = S.plateOf(1300, 2300, skySet, { seed: 37, app: sweep(1300, 2300) });
  PL.hosp = S.plateOf(1300, 2300, hospSet, { seed: 38, app: sweep(1300, 2300) });
  PL.end = S.plateOf(1080, 1920, endSet, { seed: 39, app: sweep(1080, 1920, .7) });
  PL.cta = titlePlate(S, ['Share your medical reports', 'to begin your', 'medical visa process.'], { size: 74, w: 980, color: ['#1f3d66', '#14306e'], align: 'center', dur: 1.2, seed: 40 });
  return frame;
}

const STEPS = ['Share Medical Reports', 'Treatment Evaluation', 'Medical Visa Invitation Letter', 'Visa Assistance', 'Travel to India'];
function steps(ov, t) {
  const at = [cut.share, cut.doc, cut.letter, cut.pass, cut.plane];
  let n = -1; at.forEach((a, i) => { if (t >= a + .1) n = i; });
  if (n < 0 || t > cut.end) return;
  const a = Math.min(seg(t, at[n] + .1, at[n] + .5), 1 - seg(t, (at[n + 1] ?? cut.end) - .2, (at[n + 1] ?? cut.end)));
  chip(ov, `Step ${n + 1} · ${STEPS[n]}`, 70, 300, a, { size: STEPS[n].length > 22 ? 36 : 42 });
  // the five steps as a row of knife-cut bars
  for (let i = 0; i < 5; i++) {
    ov.save(); ov.globalAlpha = .95 * seg(t, cut.share, cut.share + .4) * (1 - seg(t, cut.end - .2, cut.end));
    ov.fillStyle = i < n ? '#e8b24a' : i === n ? '#ffd86a' : 'rgba(255,246,230,.35)';
    ov.beginPath(); ov.moveTo(70 + i * 122, 352); ov.lineTo(176 + i * 122, 348); ov.lineTo(172 + i * 122, 362); ov.lineTo(66 + i * 122, 366); ov.closePath(); ov.fill(); ov.restore();
  }
}

function frame(t) {
  const d = S.dyn, ov = S.ov, cam0 = { x: 650, y: 1150, zoom: 1 };
  S.begin();
  if (t < cut.doc + .6) { // ---- A/B: the still life; the reports fly into the phone
    const cam = { x: key(t, [[0, 650], [cut.share, 640], [cut.doc, 520]]), y: key(t, [[0, 1180], [cut.share, 1150], [cut.doc, 860]]), zoom: key(t, [[0, 1.0], [cut.share, 1.04], [cut.doc, 1.35]]) };
    S.plate(PL.table, { t, cam, grey: 0 });
    // the phone's screen lights up; the top report lifts off and shrinks into it
    d.clear();
    const lit = seg(t, cut.share, cut.share + .3);
    d.push({ x: 380, y: 720, ang: Math.PI / 2, len: 520, wid: 250, c: hex(lit > 0 ? '#f6f8fa' : '#2a3038').map((v, i) => lerp(hex('#2a3038')[i], v, lit)), type: KNIFE, seed: 801, skew: 0 });
    if (lit > 0) {
      d.push({ x: 380, y: 520, ang: 0, len: 230, wid: 50, c: hex('#1f3d66'), type: KNIFE, seed: 802, skew: 0, alpha: lit });
      for (let k = 0; k < 3; k++) { const ok = seg(t, cut.share + .5 + k * .3, cut.share + .7 + k * .3); d.push({ x: 380, y: 640 + k * 90, ang: 0, len: 210, wid: 60, c: hex(ok > 0 ? '#e8f4ea' : '#eef0f2'), type: KNIFE, seed: 803 + k, skew: 0, alpha: lit }); if (ok > 0) d.push({ x: 450, y: 640 + k * 90, ang: 0, len: 30 * ok, wid: 30 * ok, c: hex('#2e9d57'), type: DAB, seed: 806 + k }); }
    }
    for (let k = 0; k < 3; k++) {
      const f = seg(t, cut.share + .15 + k * .3, cut.share + .65 + k * .3);
      if (f <= 0 || f >= 1) continue;
      const x = lerp(900, 380, eio(f)), y = lerp(1000 - k * 40, 650 + k * 90, eio(f)) - Math.sin(f * Math.PI) * 160, s = lerp(1, .35, eio(f));
      d.push({ x, y, ang: .1 - f * .2, len: 420 * s, wid: 300 * s, c: hex('#fbf7ee'), c2: hex('#e2dacb'), type: KNIFE, seed: 820 + k, skew: 0 });
    }
    S.E.drawNow(d.data(), { t, cam, grey: 0, run: 0 }); d.clear();
    const tf = 1 - seg(t, cut.share - .25, cut.share + .1);
    if (tf > 0) S.plate(PL.title, { t, cam: { x: W / 2, y: H / 2, zoom: 1 }, M: TR(50, 260), grey: 0, appear: cut.title, appDur: 1.2, strokeDur: .16, alpha: tf, noUnder: true });
  }
  if (t >= cut.doc && t < cut.desk + .6) { // ---- C: the specialist reviews and confirms the plan
    const cam = { x: 650, y: key(t, [[cut.doc, 1260], [cut.desk + .6, 1200]]), zoom: key(t, [[cut.doc, 1.0], [cut.desk + .6, 1.06]]) };
    S.plate(PL.clinic, { t, cam, grey: 0, appear: cut.doc, appDur: .55 });
    if (t > cut.doc + .3) {
      const nod = Math.sin(seg(t, cut.doc + 1.2, cut.doc + 1.8) * Math.PI * 2) * 10;
      S.drawPerson('arjun', 460, 1820, .62, { t, cam, look: [1, -.4], smile: .7, bob: nod, armL: [330, -1000], armLo: { bow: -20 } });
      const ck = seg(t, cut.doc + 1.4, cut.doc + 1.9);
      if (ck > 0) { d.clear(); d.push({ x: 1030, y: 830, ang: .8, len: 70 * ck, wid: 26, c: hex('#2e9d57'), type: KNIFE, seed: 840 }); if (ck > .5) d.push({ x: 1090, y: 790, ang: -1.0, len: 140 * (ck - .5) * 2, wid: 26, c: hex('#2e9d57'), type: KNIFE, seed: 841 }); S.E.drawNow(d.data(), { t, cam, grey: 0, run: 0 }); d.clear(); }
    }
  }
  if (t >= cut.desk && t < cut.letter + .6) { // ---- D: Priya prepares the documentation
    const cam = { x: 650, y: 1300, zoom: key(t, [[cut.desk, 1.0], [cut.letter + .6, 1.08]]) };
    S.plate(PL.desk, { t, cam, grey: 0, appear: cut.desk, appDur: .55 });
    if (t > cut.desk + .3) {
      const typ = Math.sin(t * 18) * 6;
      S.drawPerson('priya', 470, 1900, .62, { t, cam, look: [1, .5], smile: .6, armL: [190 + typ, -745], armR: [-150, -745 - typ], armLo: { bow: 60 }, armRo: { bow: -40 } });
      // the desk's front edge in front of her: she works behind it
      d.clear(); d.push({ x: 650, y: 1530, ang: 0, len: 1400, wid: 150, c: hex('#8a5c3a'), c2: hex('#6a4428'), type: KNIFE, seed: 855, skew: 0 });
      d.push({ x: 650, y: 1452, ang: 0, len: 1400, wid: 14, c: hex('#b4865c'), type: KNIFE, seed: 856, skew: 0 });
      S.E.drawNow(d.data(), { t, cam, grey: 0, run: 0 }); d.clear();
      // the printer pushes out a sheet
      const pf = seg(t, cut.desk + .8, cut.letter - .1);
      d.clear(); d.push({ x: 1100, y: 1430, ang: 0, len: 300, wid: 90, c: hex('#e8e4dc'), c2: hex('#c8c2b6'), type: KNIFE, seed: 850, skew: 0 });
      d.push({ x: 1100, y: 1400 - pf * 120, ang: Math.PI / 2, len: 200 * pf + 10, wid: 200, c: hex('#fdfaf2'), type: KNIFE, seed: 851, skew: 0 });
      S.E.drawNow(d.data(), { t, cam, grey: 0, run: 0 }); d.clear();
    }
  }
  if (t >= cut.letter && t < cut.pass + .6) { // ---- E: the invitation letter, laid in with the knife, signed and sealed
    const cam = { x: W / 2, y: H / 2 + key(t, [[cut.letter, 40], [cut.pass + .6, -20]]), zoom: key(t, [[cut.letter, 1.0], [cut.pass + .6, 1.05]]) };
    S.plate(PL.letter, { t, cam, grey: 0, appear: cut.letter, appDur: .55 });
    S.plate(PL.ltitle, { t, cam, M: TR(200, 420), grey: 0, appear: cut.letter + .5, appDur: 1.2, strokeDur: .15, noUnder: true });
    d.clear();
    const sg = seg(t, cut.letter + 1.6, cut.letter + 2.4); // a signature, written left to right
    for (let i = 0; i < 18 * sg; i++) { const u = i / 18; d.push({ x: 260 + u * 300, y: 1370 + Math.sin(u * 13) * 26 - u * 20, ang: Math.cos(u * 13) * .9, len: 26, wid: 7, c: hex('#1a2a54'), type: BRUSH, seed: 860 + i }); }
    const sl = seg(t, cut.letter + 2.3, cut.letter + 2.6); // the red seal
    if (sl > 0) { const r = 90 * eo(sl) * (1 + .15 * Math.sin(sl * Math.PI)); d.push({ x: 790, y: 1340, ang: .3, len: r * 2, wid: r * 2, c: hex('#c8262e'), c2: hex('#a81e22'), type: DAB, seed: 870 }); d.push({ x: 790, y: 1340, ang: .3, len: r * 1.3, wid: r * 1.3, c: hex('#e04a3a'), type: DAB, seed: 871 }); }
    S.E.drawNow(d.data(), { t, cam, grey: 0, run: 0 }); d.clear();
  }
  if (t >= cut.pass && t < cut.plane + .6) { // ---- F: the visa page, guided by Priya's hand; the stamp lands
    const cam = { x: W / 2, y: H / 2 + 40, zoom: key(t, [[cut.pass, 1.0], [cut.stamp, 1.1], [cut.stamp + .05, 1.16], [cut.plane + .6, 1.12]]) };
    S.plate(PL.pass, { t, cam, grey: 0, appear: cut.pass, appDur: .55 });
    d.clear();
    // a hand points along the lines as the team guides you (sleeve from the lower right)
    const g = seg(t, cut.pass + .4, cut.stamp - 1.0), back = seg(t, cut.stamp - .9, cut.stamp - .35);
    const hx = lerp(860, 660, eio(g)) + back * 420, hy = lerp(1000, 820, eio(g)) + back * 520;
    d.push({ x: hx + 230, y: hy + 300, ang: -2.2, len: 520, wid: 90, c: hex('#1f3d66'), c2: hex('#14306e'), type: KNIFE, seed: 880, skew: 0 });
    d.push({ x: hx + 40, y: hy + 50, ang: -2.2, len: 60, wid: 74, c: hex('#f4f2ee'), type: KNIFE, seed: 881, skew: 0 });
    d.push({ x: hx, y: hy, ang: -2.2, len: 76, wid: 56, c: hex('#b47650'), c2: hex('#d8a07a'), type: DAB, seed: 882 });
    d.push({ x: hx - 46, y: hy - 52, ang: -2.25, len: 54, wid: 18, c: hex('#b47650'), type: KNIFE, seed: 883 });
    // the stamp comes down, then the inked mark stays
    const sd = seg(t, cut.stamp - .35, cut.stamp), up = seg(t, cut.stamp + .15, cut.stamp + .5);
    if (sd > 0 && up < 1) { const y = lerp(300, 920, eio(sd)) - up * 500;   // a wooden stamp: knob, neck, rubber base
      d.push({ x: 780, y: y - 190, ang: 0, len: 110, wid: 100, c: hex('#8a5a3a'), c2: hex('#6a4028'), type: DAB, seed: 890 });
      d.push({ x: 780, y: y - 110, ang: Math.PI / 2, len: 120, wid: 56, c: hex('#7a4e30'), type: KNIFE, seed: 892, skew: 0 });
      d.push({ x: 780, y: y - 30, ang: 0, len: 240, wid: 60, c: hex('#5a3a26'), c2: hex('#3a2418'), type: KNIFE, seed: 891, skew: 0 });
      d.push({ x: 780, y: y + 6, ang: 0, len: 236, wid: 16, c: hex('#a81e22'), type: KNIFE, seed: 893, skew: 0 }); }
    if (t >= cut.stamp) {
      const k = eo(seg(t, cut.stamp, cut.stamp + .2));
      for (let i = 0; i < 16; i++) { const a0 = i / 16 * Math.PI * 2; d.push({ x: 780 + Math.cos(a0) * 100 * k, y: 1000 + Math.sin(a0) * 100 * k, ang: a0 + Math.PI / 2, len: 48, wid: 12, c: hex('#c8262e'), type: KNIFE, seed: 900 + i, alpha: .9 }); }
      d.push({ x: 780, y: 1000, ang: -.2, len: 120 * k, wid: 22, c: hex('#c8262e'), type: KNIFE, seed: 920 });
    }
    S.E.drawNow(d.data(), { t, cam, grey: 0, run: 0 }); d.clear();
    if (t >= cut.stamp) { const sx = (780 - cam.x) * cam.zoom + W / 2, sy = (1000 - cam.y) * cam.zoom + H / 2; label(ov, 'APPROVED', sx, sy + 60 * cam.zoom, { size: 30 * cam.zoom, color: '#c8262e', align: 'center', shadow: false, font: 'Cormorant SC', weight: 700, a: seg(t, cut.stamp + .1, cut.stamp + .3) }); }
  }
  if (t >= cut.plane && t < cut.welcome + .6) { // ---- G: the plane comes in over Mumbai
    const cam = { x: 650, y: key(t, [[cut.plane, 1240], [cut.welcome + .6, 1280]]), zoom: 1.0 };
    S.plate(PL.sky, { t, cam, grey: 0, appear: cut.plane, appDur: .5 });
    const pk = seg(t, cut.plane, cut.welcome + .6), x = lerp(-250, 1300, pk), y = lerp(860, 1180, pk), k = 1.7;
    d.clear();
    d.push({ x, y, ang: .22, len: 300 * k, wid: 44 * k, c: hex('#f4f2ee'), c2: hex('#c8cdd6'), type: KNIFE, seed: 930, taper: .2 });
    d.push({ x: x + 10 * k, y: y + 14 * k, ang: .9, len: 150 * k, wid: 34 * k, c: hex('#c8cdd6'), type: KNIFE, seed: 931 });
    d.push({ x: x - 128 * k, y: y - 60 * k, ang: -.9, len: 80 * k, wid: 30 * k, c: hex('#c8262e'), type: KNIFE, seed: 932 });
    d.push({ x: x + 150 * k, y: y + 30 * k, ang: .22, len: 40 * k, wid: 40 * k, c: hex('#f4f2ee'), type: DAB, seed: 933 });
    for (let i = 1; i < 12; i++) d.push({ x: x - 260 - i * 50, y: y - 60 - i * 11, ang: .22, len: 54, wid: 9 - i * .5, c: hex('#fff2dc'), type: KNIFE, alpha: .7 - i * .05, seed: 940 + i });
    S.E.drawNow(d.data(), { t, cam, grey: 0, run: 0 }); d.clear();
  }
  if (t >= cut.welcome && t < cut.end + .7) { // ---- H: Priya welcomes them at the hospital
    const cam = { x: 650, y: key(t, [[cut.welcome, 1180], [cut.end + .7, 1240]]), zoom: .96 };
    S.plate(PL.hosp, { t, cam, grey: 0, appear: cut.welcome, appDur: .5 });
    if (t > cut.welcome + .25) {
      const wv = Math.sin(t * 8) * 30;
      S.drawPerson('priya', 840, 1700, .5, { t, cam, look: [-1, 0], smile: .95, armR: [-200 + wv, -1040], armRo: { wave: true } });
      S.drawPerson('baba', 430, 1720, .52, { t, cam, look: [1, 0], smile: .95 });
      S.drawPerson('amara', 230, 1735, .48, { t, cam, look: [1, 0], smile: .95 });
    }
  }
  if (t >= cut.end) {
    const cam = { x: W / 2, y: H / 2, zoom: 1 };
    S.plate(PL.end, { t, cam, grey: 0, appear: cut.end, appDur: .7 });
    S.plate(PL.cta, { t, cam, M: TR(50, 660), grey: 0, appear: cut.cta, appDur: 1.6, strokeDur: .16, noUnder: true });
    wordmark(ov, seg(t, cut.end + .4, cut.end + .9), { x: W / 2, y: 260, dark: true, w: 820 });
    endCrisp(ov, t, cut.cta + 1.6, { button: 'START YOUR MEDICAL JOURNEY' });
  }
  if (t < cut.welcome) wordmark(ov, 1);
  steps(ov, t);
  subs(ov, t, TL.lines);
  S.finish({ expo: 1.03, sat: 1.06, contrast: 1.04, vig: .24, spec: .24, shin: 26 });
}
