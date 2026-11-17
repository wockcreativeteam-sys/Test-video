// Ep06 "Your Care Doesn't End When You Fly Home" — stick-figure explainer.
// Baba holds hands with his care team on one ground line. He goes home: the line bends into a globe and his
// hand never lets go. The accent (the one meaning: the care connection) runs along the joined arms as a follow-up.
const W = 1080, H = 1920;
const C = { paper: '#F3F0EA', ink: '#24242C', mute: '#9C978C', tint: '#E2DDD2', acc: '#D6402E', globe: '#E9E4DA' };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a)), eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const eo = t => 1 - Math.pow(1 - clamp(t), 3), back = (t, s = 1.8) => { t = clamp(t) - 1; return 1 + t * t * ((s + 1) * t + s); };
let g, TL, cut = {}, LOGO;

export async function setup(canvas) {
  await document.fonts.load('600 80px Jost'); await document.fonts.load('500 40px Jost');
  LOGO = new Image(); LOGO.src = 'logo-color.png'; await LOGO.decode();
  TL = await (await fetch('timeline.json')).json();
  const L = id => TL.lines.find(l => l.id === id), wd = (id, w) => L(id).words.find(x => x.w.toLowerCase().startsWith(w)).t;
  cut = { hook: .7, home: wd('m1', 'returning'), losing: wd('m1', 'losing'), wock: L('m2').t0, follow: wd('m2', 'post-care'), cont: wd('m2', 'continuity'), ret: wd('m2', 'return'), end: L('cta').t0 - .3, cta: L('cta').t0 };
  window.DUR = TL.dur;
  canvas.width = W; canvas.height = H; g = canvas.getContext('2d');
  return frame;
}

// ---- a stick person: feet on a surface point, rotated so "up" is along `up` (radians, 0 = screen up)
// arms: [handL, handR] targets in world coords or null (hanging). Limbs are single quadratic curves.
function person(o) {
  const { x, y, h = 300, rot = 0, col = C.ink, head = C.paper, t = 0, walk = 0, hands = [null, null], pop = 1 } = o;
  if (pop <= 0) return {};
  const s = h / 300 * back(pop, 1.4), lw = 8 * Math.sqrt(h / 300) * clamp(pop * 1.5);
  const R = (lx, ly) => [x + (lx * Math.cos(rot) - ly * Math.sin(rot)) * s, y + (lx * Math.sin(rot) + ly * Math.cos(rot)) * s];
  const sway = Math.sin(t * 1.7 + x * .01) * 2;
  const hip = R(sway * .3, -130), neck = R(sway, -228), headC = R(sway * 1.2, -262);
  const sh = R(sway * .9, -212);
  g.save(); g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  // legs: one curve each, the knee as control point
  for (const sd of [-1, 1]) {
    const st = Math.sin(walk + (sd > 0 ? Math.PI : 0)) * 26 * (walk ? 1 : 0);
    const foot = R(sd * 26 + st, -Math.max(0, Math.sin(walk + (sd > 0 ? Math.PI : 0))) * 10 * (walk ? 1 : 0)), knee = R(sd * 22 + st * .6 + 10, -64);
    g.beginPath(); g.moveTo(...hip); g.quadraticCurveTo(...knee, ...foot); g.stroke();
  }
  // spine
  g.beginPath(); g.moveTo(...hip); g.quadraticCurveTo(...R(sway + 6, -180), ...neck); g.stroke();
  // arms: hanging, or reaching to a hand target (the elbow bends down)
  const handsOut = [];
  for (const [i, sd] of [[0, -1], [1, 1]]) {
    let hd = hands[i] || R(sd * 52, -122);
    const mid = [(sh[0] + hd[0]) / 2, (sh[1] + hd[1]) / 2];
    const el = hands[i] ? [mid[0], mid[1] + 34 * s] : R(sd * 40, -170);
    g.beginPath(); g.moveTo(...sh); g.quadraticCurveTo(...el, ...hd); g.stroke();
    handsOut.push(hd);
  }
  g.beginPath(); g.arc(...headC, 32 * s, 0, Math.PI * 2); g.fillStyle = head; g.fill(); g.stroke();
  g.restore();
  return { hands: handsOut, sh, headC };
}
// a joined hand between two shoulders: one tangent-continuous curve, owner's colour each half, sag below
function link(a, b, sag, col = C.ink, lw = 8) {
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag];
  g.save(); g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round';
  g.beginPath(); g.moveTo(...a); g.quadraticCurveTo(m[0], m[1] + sag * .5, b[0], b[1]); g.stroke(); g.restore();
  return m;
}
const text = (s, x, y, size, col = C.ink, a = 1, weight = 600, align = 'left') => {
  if (a <= 0) return; g.save(); g.globalAlpha = a; g.fillStyle = col; g.font = `${weight} ${size}px Jost`; g.letterSpacing = size > 60 ? '-2px' : '0px'; g.textAlign = align; g.fillText(s, x, y); g.restore();
};
const rise = (t, t0) => ({ a: seg(t, t0, t0 + .4), dy: (1 - eo(seg(t, t0, t0 + .4))) * 20 });

function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
  // camera: one ground line (zoom 1) → pull back until the line is the top of a globe
  const pull = eio(seg(t, cut.home + .2, cut.losing + .6));
  const z = Math.exp(lerp(0, Math.log(.48), pull));
  const R0 = 2600;                                  // globe radius (world units); the ground line is its top
  const GC = [540, 1250 + R0];                       // globe centre
  g.setTransform(z, 0, 0, z, 540 - 540 * z, 1000 - 1250 * z + pull * 260);
  // the globe (fades in as the line curves)
  const curve = pull;
  if (curve > 0) { g.save(); g.globalAlpha = curve; g.beginPath(); g.arc(GC[0], GC[1], R0, 0, Math.PI * 2); g.fillStyle = C.globe; g.fill(); g.restore(); }
  // the ground line: straight at first, bending onto the globe
  g.save(); g.strokeStyle = C.tint; g.lineWidth = 6 / z * .6;
  g.beginPath();
  for (let i = 0; i <= 60; i++) { const u = (i / 60 - .5) * 2, ang = u * 1.1, xs = 540 + u * 3000; const xc = GC[0] + Math.sin(ang) * R0, yc = GC[1] - Math.cos(ang) * R0; const px = lerp(xs, xc, curve), py = lerp(1250, yc, curve); i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.stroke(); g.restore();
  // positions on the globe: angle along the surface
  const onG = a => [GC[0] + Math.sin(a) * R0, GC[1] - Math.cos(a) * R0];
  const team = [-.16, -.1].map((a, i) => ({ a }));
  const babaA = lerp(-.04, .3, eio(seg(t, cut.home + .1, cut.losing + .9)));
  const pts = { arjun: -.17, priya: -.11, baba: babaA, amara: babaA + .06 };
  const P = k => { const a = pts[k] * curve + (1 - curve) * (pts[k] * 0 + ({ arjun: -.17, priya: -.11, baba: -.04, amara: .02 }[k] + (k === 'baba' || k === 'amara' ? (babaA + .04) * 0 : 0))) ; return a; };
  const place = k => { const a = pts[k]; const flat = [600 + (a + .07) * 2200, 1250]; const glb = onG(a); return { p: [lerp(flat[0], glb[0], curve), lerp(flat[1], glb[1], curve)], rot: a * curve }; };
  const walking = t > cut.home + .1 && t < cut.losing + .9;
  const hs = 300;
  const pa = place('arjun'), pp = place('priya'), pb = place('baba'), pm = place('amara');
  const pop = k => seg(t, .1 + k * .12, .5 + k * .12);
  // labels on the globe
  if (curve > .5) {
    const lm = onG(-.14), lk = onG(pts.baba + .03);
    text('Mumbai', lm[0], lm[1] + 160, 90, C.mute, curve, 500, 'center');
    text('Home', lk[0], lk[1] + 160, 90, C.mute, curve, 500, 'center');
  }
  const A = person({ x: pa.p[0], y: pa.p[1], rot: pa.rot, h: hs, t, pop: pop(0) });
  const Pr = person({ x: pp.p[0], y: pp.p[1], rot: pp.rot, h: hs * .95, t, pop: pop(1) });
  const Bb = person({ x: pb.p[0], y: pb.p[1], rot: pb.rot, h: hs, t, walk: walking ? t * 9 : 0, pop: pop(2) });
  person({ x: pm.p[0], y: pm.p[1], rot: pm.rot, h: hs * .92, t, walk: walking ? t * 9 + 1 : 0, pop: pop(3) });
  // the joined hand: Priya's to Baba's, one curve however far he goes (it never lets go)
  if (Pr.sh && Bb.sh) {
    const d = Math.hypot(Bb.sh[0] - Pr.sh[0], Bb.sh[1] - Pr.sh[1]);
    const sag = Math.min(60, d * .08) * (1 - curve) + (-d * .18) * curve;        // on the globe the line arcs up and over
    const thin = t > cut.losing - .1 && t < cut.wock ? 1 - .5 * Math.sin(Math.PI * seg(t, cut.losing - .1, cut.wock)) : 1;
    const m = link(Pr.sh, Bb.sh, sag, C.ink, 8 * thin / Math.max(z, .5));
    link(A.sh, Pr.sh, 40, C.ink, 8);
    // the follow-up: an accent pulse runs along the joined arms, team → patient
    const fp = seg(t, cut.follow, cut.follow + 1.4);
    if (fp > 0) {
      const steps = 40, n = Math.ceil(steps * fp);
      g.save(); g.strokeStyle = C.acc; g.lineWidth = 12 / Math.max(z, .5); g.lineCap = 'round'; g.beginPath();
      for (let i = 0; i <= n; i++) { const u = Math.min(i / steps, fp); const q = (1 - u); const cx = m[0], cy = m[1] + sag * .5; const x = q * q * Pr.sh[0] + 2 * q * u * cx + u * u * Bb.sh[0], y = q * q * Pr.sh[1] + 2 * q * u * cy + u * u * Bb.sh[1]; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.restore();
      // nodes along the line: treatment → recovery → follow-up
      ['Treatment', 'Recovery', 'Follow-Up'].forEach((lab, i) => {
        const u = .2 + i * .3, q = 1 - u, cx = m[0], cy = m[1] + sag * .5;
        const x = q * q * Pr.sh[0] + 2 * q * u * cx + u * u * Bb.sh[0], y = q * q * Pr.sh[1] + 2 * q * u * cy + u * u * Bb.sh[1];
        const on = fp >= u, r = 26 / Math.max(z, .5);
        g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = on ? C.acc : C.paper; g.fill(); g.lineWidth = 6 / Math.max(z, .5); g.strokeStyle = on ? C.acc : C.mute; g.stroke(); g.restore();
        text(lab, x, y + (i === 1 ? r + 70 / z : -r - 30 / z), 34 / z, on ? C.ink : C.mute, seg(t, cut.follow - .2 + i * .3, cut.follow + .2 + i * .3), 600, 'center');
      });
    }
    // continuity: the line closes all the way round the globe
    const cp = seg(t, cut.cont, cut.ret + .4);
    if (cp > 0) { g.save(); g.strokeStyle = C.acc; g.lineWidth = 10 / z; g.lineCap = 'round'; g.beginPath(); g.arc(GC[0], GC[1], R0 + 40, -Math.PI / 2 + pts.baba, -Math.PI / 2 + pts.baba + Math.PI * 2 * eio(cp)); g.stroke(); g.restore(); }
  }
  // ---- HUD (screen space): left-aligned at a 90 px margin
  g.setTransform(1, 0, 0, 1, 0, 0);
  const hk = 1 - seg(t, cut.home - .3, cut.home);
  let r = rise(t, cut.hook); text('Flying home', 90, 300 - r.dy, 92, C.ink, r.a * hk);
  r = rise(t, cut.hook + .25); text('after treatment?', 90, 400 - r.dy, 92, C.ink, r.a * hk);
  r = rise(t, 2.5); text('Your care journey can continue.', 90, 490 - r.dy, 46, C.acc, r.a * hk, 500);
  r = rise(t, cut.cont); text('Continuity of care', 90, 300 - r.dy, 80, C.ink, r.a * (1 - seg(t, cut.end - .3, cut.end)));
  r = rise(t, cut.cont + .3); text('Treatment → Recovery → Follow-Up', 90, 370 - r.dy, 40, C.mute, r.a * (1 - seg(t, cut.end - .3, cut.end)), 500);
  if (t < cut.end) { g.save(); g.globalAlpha = seg(t, .3, .8); const lw = 360, lh = lw * LOGO.height / LOGO.width; g.drawImage(LOGO, W - 50 - lw, 60, lw, lh); g.restore(); }
  subs(t);
  if (t > cut.end) endCard(t);
}

function subs(t) {
  const L = TL.lines.find(l => t >= l.t0 - .05 && t < l.t0 + l.dur + .5);
  if (!L || L.id === 'hook' || L.id === 'cta') return;
  const chunks = []; let cur = [];
  g.save(); g.font = '500 40px Jost';
  for (const w of L.words) { cur.push(w); if (g.measureText(cur.map(x => x.w).join(' ')).width > 820 || /[,.]$/.test(w.w)) { chunks.push(cur); cur = []; } }
  if (cur.length) chunks.push(cur);
  const ch = chunks.find((c, i) => t < (chunks[i + 1] ? chunks[i + 1][0].t - .05 : 1e9)) || chunks[chunks.length - 1];
  g.globalAlpha = Math.min(seg(t, L.t0 - .05, L.t0 + .2), 1 - seg(t, L.t0 + L.dur + .3, L.t0 + L.dur + .5));
  g.fillStyle = C.acc; g.fillRect(90, 1500, 5, 56);
  g.fillStyle = C.ink; g.fillText(ch.map(x => x.w).join(' '), 116, 1542);
  g.restore();
}

function endCard(t) {
  const a = seg(t, cut.end, cut.end + .5);
  g.save(); g.globalAlpha = a; g.fillStyle = C.paper; g.fillRect(0, 0, W, H); g.restore();
  const lw = 820, lh = lw * LOGO.height / LOGO.width; g.save(); g.globalAlpha = seg(t, cut.end + .2, cut.end + .7); g.drawImage(LOGO, 90, 260, lw, lh); g.restore();
  let r = rise(t, cut.cta); text('Start your care journey', 90, 620 - r.dy, 76, C.ink, r.a);
  r = rise(t, cut.cta + .4); text('with Wockhardt Hospitals.', 90, 710 - r.dy, 76, C.acc, r.a);
  // two people joined by the hand, under the line (the film's one idea, once more)
  const pk = seg(t, cut.cta + .6, cut.cta + 1.2);
  const a1 = person({ x: 330, y: 1150, h: 300, t, pop: pk }), b1 = person({ x: 560, y: 1150, h: 300, t, pop: seg(t, cut.cta + .8, cut.cta + 1.4) });
  if (a1.sh && b1.sh && pk > .9) link(a1.sh, b1.sh, 40, C.acc, 8);
  g.save(); g.strokeStyle = C.tint; g.lineWidth = 4; g.beginPath(); g.moveTo(90, 1152); g.lineTo(990, 1152); g.stroke(); g.restore();
  // button + footer
  const bk = eo(seg(t, cut.cta + 1.4, cut.cta + 1.9)); if (bk <= 0) return;
  g.save(); g.globalAlpha = bk; const bx = 90, by = 1290, bw = 900, bh = 104;
  g.fillStyle = C.acc; g.beginPath(); g.roundRect(bx, by, bw, bh, 52); g.fill();
  g.fillStyle = '#fff'; g.font = '600 32px Jost'; g.letterSpacing = '2px'; g.textAlign = 'center'; g.fillText('SPEAK TO OUR INTERNATIONAL PATIENT TEAM', bx + bw / 2, by + 64);
  g.restore();
  g.save(); g.globalAlpha = bk; g.fillStyle = '#1F5C9E'; g.fillRect(0, H - 250, W, 250); g.fillStyle = '#FFC629'; g.font = '600 32px Jost'; g.letterSpacing = '4px'; g.textAlign = 'center';
  g.fillText('INTERNATIONAL PATIENT SERVICES', W / 2, H - 168); g.letterSpacing = '0px'; g.fillStyle = '#fff'; g.font = '600 52px Jost'; g.fillText('+91 91360 91380', W / 2, H - 100); g.font = '500 32px Jost'; g.fillStyle = '#D8E6F6'; g.fillText('wockhardthospitals.com', W / 2, H - 52); g.restore();
}
