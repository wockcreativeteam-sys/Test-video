// Shared stage for the impasto episodes: plates, people, knife-laid titles, and a crisp 2D overlay
// for small text (service labels, subtitles, the end card's button and footer), which knife strokes can't carry.
import { Impasto, Strokes, hex } from './engine/impasto.js';
import { Ref, paintRef } from './engine/plate.js';
import { buildPerson, face, glasses, arm, PEOPLE, HEAD } from './cast.js';
import { clamp, lerp, seg, eio, eo } from './common.js';

export const W = 1080, H = 1920;
export const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
export const TR = (x, y) => [1, 0, 0, 1, x, y], SC = s => [s, 0, 0, s, 0, 0];
export const key = (t, ks) => { if (t <= ks[0][0]) return ks[0][1]; for (let i = 0; i < ks.length - 1; i++) { const [t0, v0, e] = ks[i], [t1, v1] = ks[i + 1]; if (t < t1) { const k = (e || eio)((t - t0) / (t1 - t0)); return Array.isArray(v0) ? v0.map((v, j) => lerp(v, v1[j], k)) : lerp(v0, v1, k); } } return ks[ks.length - 1][1]; };

export class Stage {
  constructor(canvas) {
    this.E = new Impasto(canvas, { W, H, ss: new URLSearchParams(location.search).get('preview') ? 1 : 2 });
    this.dyn = new Strokes(16384);
    this.people = {};
    // crisp overlay
    const o = document.createElement('canvas'); o.width = W; o.height = H;
    o.style.cssText = 'position:fixed;left:0;top:0;width:' + W + 'px;height:' + H + 'px;pointer-events:none';
    document.body.appendChild(o); this.ov = o.getContext('2d');
  }
  up(built, w, h, ox = 0, oy = 0) { return { b: this.E.batch(built.strokes.data()), tex: this.E.texture(built.ref.ctx.canvas), w, h, ox, oy }; }
  // a reference illustration (draw(R) in plate units) painted to strokes
  plateOf(w, h, draw, { scale = .5, R = [34, 17, 9, 4.5, 2.5], T = 12, seed = 7, rev, app } = {}) {
    const ref = new Ref(w, h, scale); draw(ref);
    const strokes = paintRef(ref, { R, T, seed, rev, app });
    return this.up({ strokes, ref }, w, h);
  }
  person(s, seed = 5) {
    if (!this.people[s]) { const b = buildPerson(s, seed); this.people[s] = { body: this.up(b.body, 1120, 1400, 560, 1300), head: this.up(b.head, 1120, 1400, 560, 1300) }; }
    return this.people[s];
  }
  begin(ground = [.35, .32, .3]) { this.E.begin(ground); this.ov.clearRect(0, 0, W, H); }
  // draw a plate; o: { t, cam, M, grey, reveal, revC, appear, appDur, alpha, noUnder }
  plate(pl, o = {}) {
    const M = o.M || [1, 0, 0, 1, 0, 0], Mu = mul(M, TR(-pl.ox, -pl.oy));
    const inT = o.appear !== undefined && o.t < o.appear + (o.appDur ?? .5);
    const ua = o.appear === undefined ? 1 : seg(o.t, o.appear + (o.appDur ?? .5) * .55, o.appear + (o.appDur ?? .5));
    if (!o.noUnder && ua > 0) this.E.under(pl.tex, pl.w, pl.h, { ...o, M: Mu, alpha: (o.alpha ?? 1) * ua });
    this.E.draw(pl.b, { ...o, M, appear: inT ? o.appear : -1e6, appDur: o.strokeDur ?? .14 });
  }
  // a person at (x, y) feet, scale k, facing; o: { t, cam, grey, reveal, smile, look, talk, blink, armL, armR, flip, bob }
  drawPerson(s, x, y, k, o = {}) {
    const P = this.person(s), f = o.flip ? -1 : 1;
    const M = [k * f, 0, 0, k, x, y - (o.bob || 0)];
    const base = { t: o.t, cam: o.cam, grey: o.grey ?? 0, reveal: o.reveal, revDur: .25, alpha: o.alpha };
    this.plate(P.body, { ...base, M });
    const d = this.dyn; d.clear();
    // arms behind the head plate? no: hanging arms first, then head on top, then raised arms
    const blink = o.t !== undefined ? blinkAt(o.t, s) : 0;
    const R = o.armR || [-150, -470], Lh = o.armL || [150, -470];
    arm(d, s, -1, R, o.armRo || {}); arm(d, s, 1, Lh, o.armLo || {});
    this.E.drawNow(d.data(), { ...base, M, run: 0 }); d.clear();
    this.plate(P.head, { ...base, M });
    face(d, s, { look: o.look, smile: o.smile ?? .6, blink, talk: o.talk, t: o.t, worry: o.worry });
    if (PEOPLE[s].glasses) glasses(d, s);
    this.E.drawNow(d.data(), { ...base, M, run: 0 }); d.clear();
    return M;
  }
  finish(post) { this.E.finish(post); }
}
const blinkAt = (t, s) => { const per = 3.3 + (s.length % 3) * .6, ph = (t + s.length * .37) % per; return ph < .16 ? Math.sin(ph / .16 * Math.PI) : 0; };

// a knife-laid title: lines of serif type painted to strokes, laid in left to right
export function titlePlate(st, lines, { w = 1000, size = 96, lh = 1.12, color = ['#fff6e2', '#f2d8a8'], italic = true, align = 'left', seed = 21, dur = .9 } = {}) {
  const h = Math.ceil(lines.length * size * lh + size * .5);
  const ref = new Ref(w, h, 1);
  lines.forEach((ln, i) => {
    const y = size * (1 + i * lh);
    const g = c => { const gr = c.createLinearGradient(0, y - size, 0, y); gr.addColorStop(0, color[0]); gr.addColorStop(1, color[1]); return gr; };
    ref.text(ln, align === 'center' ? w / 2 : 8, y, `${italic ? 'italic ' : ''}600 ${size}px "Cormorant Garamond"`, g, { dir: 'edge', fallback: 15, maxR: 6, group: 't' + i, align });
  });
  const strokes = paintRef(ref, { R: [6, 3.2, 1.8], T: 9, seed, app: (x, y) => (x / w) * dur * .8 + (y / h) * dur * .25 });
  return st.up({ strokes, ref }, w, h);
}

// crisp text helpers on the overlay
export function label(ctx, text, x, y, { size = 40, color = '#fff6e2', a = 1, font = 'Cormorant Garamond', weight = 600, italic = false, align = 'left', shadow = true, spacing = 0 } = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px "${font}"`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  if (spacing) ctx.letterSpacing = spacing + 'px';
  if (shadow) { ctx.shadowColor = 'rgba(10,6,4,.55)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; }
  ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
}
// a service label: small caps on a calm painted-looking plane (a soft knife-shaped band)
export function chip(ctx, text, x, y, a, { size = 44 } = {}) {
  if (a <= 0) return;
  const k = eo(a);
  ctx.save(); ctx.globalAlpha = k; ctx.font = `600 ${size}px "Cormorant SC"`; ctx.letterSpacing = '3px';
  const w = ctx.measureText(text).width + 70;
  ctx.translate(x, y); ctx.transform(1, 0, -.12, 1, 0, 0);
  ctx.fillStyle = 'rgba(24,16,12,.62)'; ctx.beginPath(); ctx.moveTo(0, -size * .95); ctx.lineTo(w * (.3 + .7 * k), -size * 1.02); ctx.lineTo(w * (.3 + .7 * k) + 10, size * .42); ctx.lineTo(-6, size * .45); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8b24a'; ctx.fillRect(0, -size * .95, 7, size * 1.38);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(x, y);
  ctx.fillStyle = '#fff3dc'; ctx.fillText(text, 30, size * .1);
  ctx.restore();
}
// subtitles: plain serif, at most two lines, on a calm band; held while the line is spoken
export function subs(ctx, t, lines, { y = 1530, size = 46, maxW = 900 } = {}) {
  const L = lines.find(l => t >= l.t0 - .05 && t < l.t0 + l.dur + .45);
  if (!L || L.id === 'hook' || L.id === 'cta') return;
  const a = Math.min(seg(t, L.t0 - .05, L.t0 + .15), 1 - seg(t, L.t0 + L.dur + .25, L.t0 + L.dur + .45));
  // split into ≤2-line chunks by words, each chunk shown while its words are spoken
  const chunks = []; let cur = [];
  ctx.save(); ctx.font = `500 ${size}px "Cormorant Garamond"`;
  const fits = ws => ctx.measureText(ws.map(w => w.w).join(' ')).width <= maxW;
  const lineBreak = ws => { const out = [[]]; for (const w of ws) { const l = out[out.length - 1]; if (l.length && !fits([...l, w])) out.push([w]); else l.push(w); } return out; };
  for (const w of L.words) { cur.push(w); const lb = lineBreak(cur); if (lb.length > 2 || (/[,.?!]$/.test(w.w) && cur.length > 6)) { if (lb.length > 2) { cur.pop(); chunks.push(cur); cur = [w]; } else { chunks.push(cur); cur = []; } } }
  if (cur.length) chunks.push(cur);
  let ch = chunks.find((c, i) => t < (chunks[i + 1] ? chunks[i + 1][0].t - .05 : 1e9)) || chunks[chunks.length - 1];
  const rows = lineBreak(ch).map(r => r.map(w => w.w).join(' '));
  const lh = size * 1.22, bw = Math.max(...rows.map(r => ctx.measureText(r).width)) + 70, bh = rows.length * lh + 34;
  ctx.globalAlpha = a; ctx.fillStyle = 'rgba(20,13,10,.5)';
  ctx.beginPath(); ctx.roundRect(W / 2 - bw / 2, y - bh / 2, bw, bh, 14); ctx.fill();
  ctx.fillStyle = '#fbf2e2'; ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 6;
  rows.forEach((r, i) => ctx.fillText(r, W / 2, y - bh / 2 + 17 + size * .86 + i * lh));
  ctx.restore();
}
// the end card's crisp parts: the button (pressed by a tap), the blue footer
export function endCrisp(ctx, t, t0, { button, phone = '+91 91360 91380', site = 'wockhardthospitals.com' } = {}) {
  const a = seg(t, t0, t0 + .5), bk = eo(seg(t, t0 + .2, t0 + .8));
  if (a <= 0) return;
  // button
  ctx.save(); ctx.globalAlpha = bk; ctx.font = '700 38px "Cormorant SC"'; ctx.letterSpacing = '3px';
  const bw = Math.max(560, ctx.measureText(button).width + 160), bx = W / 2 - bw / 2, by = 1370;
  const press = 1 - .05 * Math.sin(Math.PI * seg(t, t0 + 1.6, t0 + 1.9));
  ctx.translate(W / 2, by + 50); ctx.scale(press, press); ctx.translate(-W / 2, -(by + 50));
  ctx.shadowColor = 'rgba(60,10,8,.45)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  const g = ctx.createLinearGradient(0, by, 0, by + 100); g.addColorStop(0, '#e2443a'); g.addColorStop(1, '#b81e22');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(bx, by, bw, 100, 50); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(button, W / 2 - 20, by + 63);
  ctx.beginPath(); ctx.arc(bx + bw - 54, by + 50, 30, 0, 7); ctx.fill();
  ctx.strokeStyle = '#c42a28'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx + bw - 66, by + 50); ctx.lineTo(bx + bw - 42, by + 50); ctx.moveTo(bx + bw - 52, by + 40); ctx.lineTo(bx + bw - 42, by + 50); ctx.lineTo(bx + bw - 52, by + 60); ctx.stroke();
  // ripple of the tap
  const rp = seg(t, t0 + 1.6, t0 + 2.4); if (rp > 0 && rp < 1) { ctx.globalAlpha = (1 - rp) * .6; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx + bw - 54, by + 50, 30 + rp * 90, 0, 7); ctx.stroke(); }
  ctx.restore();
  // footer
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(31,92,158,.94)'; ctx.fillRect(0, H - 250, W, 250);
  ctx.fillStyle = '#ffc629'; ctx.font = '700 34px "Cormorant SC"'; ctx.letterSpacing = '5px'; ctx.textAlign = 'center';
  ctx.fillText('INTERNATIONAL PATIENT SERVICES', W / 2, H - 170);
  ctx.letterSpacing = '0px'; ctx.fillStyle = '#fff'; ctx.font = '600 50px "Cormorant Garamond"'; ctx.fillText(phone, W / 2, H - 105);
  ctx.font = '500 32px "Cormorant Garamond"'; ctx.fillStyle = '#d8e6f6'; ctx.fillText(site, W / 2, H - 55);
  ctx.restore();
}
// the Wockhardt logo: white in the corner over pictures, full colour on the end card
const LOGO = {}; for (const k of ['color', 'white']) { const i = new Image(); i.src = new URL(`./logo-${k}.png`, import.meta.url).href; LOGO[k] = i; }
export const logoReady = () => Promise.all(Object.values(LOGO).map(i => i.decode()));
export function wordmark(ctx, a = 1, { x = W - 40, y = 70, dark = false, w = 400 } = {}) {
  if (a <= 0) return;
  const img = LOGO[dark ? 'color' : 'white'], h = w * img.height / img.width;
  ctx.save(); ctx.globalAlpha = a; if (!dark) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 12; }
  ctx.drawImage(img, dark ? x - w / 2 : x - w, y, w, h); ctx.restore();
}
export { hex, Strokes, HEAD, clamp, lerp, seg, eio, eo };
