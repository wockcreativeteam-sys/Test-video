// Billboard key visuals for the campaign, 48 x 14 ft bulletin (3.43:1), drawn at 6000 x 1750.
//   kv/index.html?o=A   night line-up       ALL OF THIS, FOR ONE HEARTBEAT.
//   kv/index.html?o=B   day blueprint       THE HOSPITAL, RE-ENGINEERED.
//   kv/index.html?o=C   life at the centre  TECHNOLOGY FIRST. LIFE ALWAYS.
// Same fonts, palette and Healwave as the film. The wordmark is a typographic stand-in for the
// registered Wockhardt Hospitals logo.
import { HW_NIGHT, HW_DAY } from '../src/engine/healwave.js';

const W = 6000, H = 1750;
const params = new URLSearchParams(location.search);
const OPTION = (params.get('o') || 'A').toUpperCase();
const canvas = document.getElementById('kv');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d', { willReadFrequently: false });
ctx.imageSmoothingQuality = 'high';

const INK = '10,28,62', BLUE = '18,70,160', ICE = '222,234,255', STEEL = '120,146,190', LUMI = '140,186,255';
const BRAND_RED = '214,28,40';
const rgba = (rgb, a) => `rgba(${rgb},${a})`;

// ---------------------------------------------------------------------------------------------
// the machines, in story order: imaging, robotics, theatre, newborn care
const MACHINES = [
  { id: 'ingenia', name: 'PHILIPS INGENIA 3.0T', what: 'MRI · SMARTSPEED AI', h: 600 },
  { id: 'mako_b', name: 'MAKO SMARTROBOTICS', what: 'ROBOTIC JOINT REPLACEMENT', h: 560 },
  { id: 'davinci_arms', name: 'DA VINCI', what: 'ROBOTIC SURGERY', h: 600 },
  { id: 'benq', name: 'BENQ TRIMAX 650 NS', what: 'OPERATING TABLE', h: 380 },
  { id: 'olympus', name: 'OLYMPUS VISERA ELITE III', what: '4K SURGICAL IMAGING', h: 640 },
  { id: 'crea_display', name: 'CREA', what: 'OR INTEGRATION', h: 330, stand: 300 },
  { id: 'giraffe', name: 'GE GIRAFFE', what: 'NEONATAL INCUBATOR', h: 700 },
  { id: 'lullaby', name: 'GE LULLABY', what: 'RADIANT WARMER', h: 820 },
  { id: 'sle6000', name: 'SLE 6000', what: 'NEONATAL VENTILATION', h: 720 },
  { id: 'infusomat', name: 'INFUSOMAT', what: 'B. BRAUN', h: 300, pole: 420 },
];
// the systems we name but have no photograph of
const ALSO = '128-SLICE DUAL-ENERGY CT · MEDTRONIC DBS · ZEISS NEUROSURGICAL MICROSCOPE · MINDRAY A9 · SANHAR PAPERLESS HIS · STERRAD 100NX · AR PHOTONICS DIODE LASER · SERVO-C · SLE5000 · PHILIPS MONITORING';

// ---------------------------------------------------------------------------------------------
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;

function font(wt, size, mono) {
  return `${wt} ${size}px ${mono ? '"Geist Mono"' : '"Inter Display"'}`;
}
/** text with tracking (em), alignment and an optional fill factory (x0, w) => style */
function txt(c, s, x, y, o) {
  c.save();
  c.font = font(o.wt ?? 600, o.size, o.mono);
  const tr = (o.track ?? 0) * o.size;
  c.letterSpacing = `${tr}px`;
  c.textBaseline = 'alphabetic';
  const w = c.measureText(s).width - tr;
  const x0 = o.align === 'r' ? x - w : o.align === 'c' ? x - w / 2 : x;
  c.globalAlpha = o.a ?? 1;
  c.fillStyle = o.fill ? o.fill(x0, w) : rgba(o.rgb ?? '255,255,255', 1);
  c.fillText(s, x0, y);
  c.restore();
  return { x0, w };
}
function measure(c, s, o) {
  c.save();
  c.font = font(o.wt ?? 600, o.size, o.mono);
  const tr = (o.track ?? 0) * o.size;
  c.letterSpacing = `${tr}px`;
  const w = c.measureText(s).width - tr;
  c.restore();
  return w;
}
/** the brand's multicolour word fill (the Healwave across a word) */
function healFill(c, pal) {
  return (x0, w) => {
    const g = c.createLinearGradient(x0, 0, x0 + w, 0);
    pal.forEach((rgb, i) => g.addColorStop(i / (pal.length - 1), rgba(rgb, 1)));
    return g;
  };
}

/**
 * The Healwave as a ribbon of strands along a screen polyline.
 * o: palette, strands, width, lw, a, smooth (px), twist, phase, spread(u,i), glow (canvas to also draw on)
 */
function ribbon(c, pts, o) {
  const n = pts.length;
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const L = cum[n - 1] || 1;
  const nx = new Float32Array(n), ny = new Float32Array(n);
  const sm = o.smooth ?? 40;
  let j0 = 0, j1 = 0;
  for (let i = 0; i < n; i++) {
    while (j0 < i && cum[i] - cum[j0] > sm) j0++;
    while (j1 < n - 1 && cum[j1] - cum[i] < sm) j1++;
    let tx = pts[j1][0] - pts[j0][0], ty = pts[j1][1] - pts[j0][1];
    const l = Math.hypot(tx, ty) || 1;
    nx[i] = -ty / l;
    ny[i] = tx / l;
    if (i && nx[i] * nx[i - 1] + ny[i] * ny[i - 1] < 0) {
      nx[i] = -nx[i];
      ny[i] = -ny[i];
    }
  }
  const pal = o.palette, ns = o.strands ?? 12;
  const targets = o.glow ? [c, o.glow] : [c];
  for (const t of targets) {
    t.save();
    t.lineJoin = 'round';
    t.lineCap = 'round';
    t.lineWidth = o.lw ?? 3;
    t.globalAlpha = o.a ?? 1;
    for (let k = 0; k < ns; k++) {
      const cc = ns > 1 ? k / (ns - 1) - 0.5 : 0;
      t.strokeStyle = rgba(pal[Math.round((k / Math.max(1, ns - 1)) * (pal.length - 1))], 1);
      const P = [];
      for (let i = 0; i < n; i++) {
        const u = cum[i] / L;
        let sp = o.spread ? o.spread(u, i) : 1;
        if (o.twist) sp *= Math.cos(Math.PI * o.twist * u + (o.phase ?? 0));
        const off = cc * (o.width ?? 60) * sp;
        P.push([pts[i][0] + nx[i] * off, pts[i][1] + ny[i] * off]);
      }
      if (!o.fade) {
        t.beginPath();
        P.forEach(([x, y], i) => (i ? t.lineTo(x, y) : t.moveTo(x, y)));
        t.stroke();
      } else {
        // alpha falls along the line, drawn in short pieces
        for (let i = 0; i < n - 1; i += 6) {
          const j = Math.min(n - 1, i + 6);
          t.globalAlpha = (o.a ?? 1) * lerp(o.fade[0], o.fade[1], cum[(i + j) >> 1] / L);
          t.beginPath();
          t.moveTo(P[i][0], P[i][1]);
          for (let q = i + 1; q <= j; q++) t.lineTo(P[q][0], P[q][1]);
          t.stroke();
        }
      }
    }
    t.restore();
  }
}

/** an ECG complex (P, QRS, T) as y offsets, x in [0, 1] across the complex */
function ecgShape(x) {
  const g = (m, s, a) => a * Math.exp(-((x - m) ** 2) / (2 * s * s));
  return g(0.16, 0.035, 0.12) - g(0.40, 0.012, 0.16) + g(0.445, 0.014, 1.0) - g(0.49, 0.013, 0.26) + g(0.74, 0.06, 0.24);
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}
async function loadJSON(src) {
  return (await fetch(src)).json();
}

function grain(c, amount, mode) {
  const n = document.createElement('canvas');
  n.width = n.height = 512;
  const g = n.getContext('2d');
  const id = g.createImageData(512, 512);
  const r = mulberry32(42);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = (r() * 255) | 0;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
    id.data[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  c.save();
  c.globalCompositeOperation = mode;
  c.globalAlpha = amount;
  c.fillStyle = c.createPattern(n, 'repeat');
  c.fillRect(0, 0, W, H);
  c.restore();
}

/** a machine standing on a floor line: optional light pool, contact shadow, reflection */
function machine(c, img, cx, floorY, h, o = {}) {
  const w = (img.width * h) / img.height;
  const x = cx - w / 2;
  const top = floorY - h - (o.lift ?? 0);
  if (o.pool) {
    const r = Math.max(w, h) * 0.75;
    const g = c.createRadialGradient(cx, floorY - h * 0.45, 0, cx, floorY - h * 0.45, r);
    g.addColorStop(0, rgba(o.pool, o.poolA ?? 0.14));
    g.addColorStop(1, rgba(o.pool, 0));
    c.fillStyle = g;
    c.fillRect(cx - r, floorY - h * 0.45 - r, r * 2, r * 2);
  }
  // contact shadow
  c.save();
  c.translate(cx, floorY);
  c.scale(1, 0.09);
  const sg = c.createRadialGradient(0, 0, 0, 0, 0, w * 0.62);
  sg.addColorStop(0, `rgba(0,0,0,${o.shadow ?? 0.45})`);
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sg;
  c.fillRect(-w, -w, w * 2, w * 2);
  c.restore();
  // the machine, relit on its own layer so the light stays on it
  const off = document.createElement('canvas');
  off.width = Math.ceil(w);
  off.height = Math.ceil(h);
  const g2 = off.getContext('2d');
  g2.imageSmoothingQuality = 'high';
  g2.drawImage(img, 0, 0, w, h);
  if (o.grade) {
    g2.globalCompositeOperation = 'source-atop';
    const gr = g2.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, o.grade[0]);
    gr.addColorStop(1, o.grade[1]);
    g2.fillStyle = gr;
    g2.fillRect(0, 0, w, h);
  }
  if (o.reflect) {
    const rh = Math.min(h * 0.55, o.reflectMax ?? 260);
    const rf = document.createElement('canvas');
    rf.width = Math.ceil(w);
    rf.height = Math.ceil(rh);
    const g3 = rf.getContext('2d');
    g3.setTransform(1, 0, 0, -1, 0, h);
    g3.drawImage(off, 0, 0);
    g3.setTransform(1, 0, 0, 1, 0, 0);
    g3.globalCompositeOperation = 'destination-in';
    const fade = g3.createLinearGradient(0, 0, 0, rh);
    fade.addColorStop(0, `rgba(0,0,0,${o.reflect})`);
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    g3.fillStyle = fade;
    g3.fillRect(0, 0, w, rh);
    c.drawImage(rf, x, floorY + (o.lift ?? 0) * 2 - (o.lift ? 0 : 0));
  }
  c.drawImage(off, x, top);
  return { x, y: top, w, h, cx };
}

/** wordmark stand-in: WOCKHARDT / hairline / HOSPITALS (+ tagline) */
function wordmark(c, x, y, o) {
  const s = o.scale ?? 1;
  const align = o.align ?? 'l';
  const big = { wt: 700, size: 176 * s, track: 0.03, align, rgb: o.red ? BRAND_RED : '255,255,255' };
  const r = txt(c, 'WOCKHARDT', x, y, big);
  c.fillStyle = rgba(o.ink, 0.85);
  c.fillRect(r.x0, y + 34 * s, r.w, Math.max(2, 3 * s));
  txt(c, 'HOSPITALS', align === 'r' ? r.x0 + r.w : align === 'c' ? r.x0 + r.w / 2 : r.x0, y + 110 * s, { wt: 500, size: 46 * s, track: 0.62, align, rgb: o.ink });
  if (o.tagline)
    txt(c, 'TECHNOLOGY FIRST. LIFE ALWAYS.', align === 'r' ? r.x0 + r.w : align === 'c' ? r.x0 + r.w / 2 : r.x0, y + 214 * s, { wt: 400, size: 52 * s, track: 0.16, align, rgb: o.tagRgb ?? o.ink });
  return r;
}

// ---------------------------------------------------------------------------------------------
// A — night line-up: everything stands on the Healwave, which rises into one heartbeat
async function optionA(c, A) {
  // night field
  const bg = c.createRadialGradient(3000, 1150, 100, 3000, 1150, 3700);
  bg.addColorStop(0, '#0e2550');
  bg.addColorStop(0.5, '#071433');
  bg.addColorStop(1, '#02060f');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  const FLOOR = 1440;
  // floor: a darker plane with a perspective grid
  const fl = c.createLinearGradient(0, FLOOR, 0, H);
  fl.addColorStop(0, 'rgba(4,10,26,0.0)');
  fl.addColorStop(1, 'rgba(1,4,12,0.85)');
  c.fillStyle = fl;
  c.fillRect(0, FLOOR, W, H - FLOOR);
  c.save();
  c.beginPath();
  c.rect(0, FLOOR, W, H - FLOOR);
  c.clip();
  c.strokeStyle = rgba(ICE, 0.05);
  c.lineWidth = 2;
  for (let i = -30; i <= 30; i++) {
    c.beginPath();
    c.moveTo(3000 + i * 40, FLOOR);
    c.lineTo(3000 + i * 400, H + 200);
    c.stroke();
  }
  for (let k = 1; k < 8; k++) {
    const y = FLOOR + (H - FLOOR) * (k / 8) ** 1.8;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(W, y);
    c.stroke();
  }
  c.restore();
  // horizon glow
  const hg = c.createLinearGradient(0, FLOOR - 220, 0, FLOOR + 40);
  hg.addColorStop(0, 'rgba(80,130,255,0)');
  hg.addColorStop(1, 'rgba(80,130,255,0.07)');
  c.fillStyle = hg;
  c.fillRect(0, FLOOR - 220, W, 260);

  // lay the machines out left to right, leaving one gap for the heartbeat
  const GAP = 460, L0 = 230, R0 = W - 230, overlap = 30;
  let total = 0;
  for (const m of MACHINES) total += (A.img[m.id].width * m.h) / A.img[m.id].height;
  const k = (R0 - L0 - GAP + overlap * (MACHINES.length - 2)) / total;
  let x = L0;
  const placed = [];
  MACHINES.forEach((m, i) => {
    const h = m.h * k;
    const w = (A.img[m.id].width * h) / A.img[m.id].height;
    placed.push({ m, cx: x + w / 2, h, w });
    x += w - overlap;
    if (i === 4) x += GAP + overlap * 2;
  });
  const beatX = placed[4].cx + placed[4].w / 2 + (placed[5].cx - placed[5].w / 2 - (placed[4].cx + placed[4].w / 2)) / 2;

  // stands for the screen and the pump
  c.strokeStyle = rgba(ICE, 0.45);
  c.lineWidth = 5;
  for (const p of placed) {
    const lift = p.m.stand ? p.m.stand * k : p.m.pole ? p.m.pole * k * 0.55 : 0;
    p.lift = lift;
    if (lift) {
      c.beginPath();
      c.moveTo(p.cx, FLOOR - lift + 4);
      c.lineTo(p.cx, FLOOR);
      c.moveTo(p.cx - 70, FLOOR);
      c.lineTo(p.cx + 70, FLOOR);
      if (p.m.pole) {
        c.moveTo(p.cx, FLOOR - lift - p.h - 60);
        c.lineTo(p.cx, FLOOR - lift - p.h);
      }
      c.stroke();
    }
  }
  for (const p of placed) {
    machine(c, A.img[p.m.id], p.cx, FLOOR, p.h, {
      lift: p.lift, reflect: p.lift ? 0 : 0.22, reflectMax: 230, pool: LUMI, poolA: 0.12, shadow: 0.55,
      grade: ['rgba(30,60,140,0.05)', 'rgba(6,16,44,0.38)'],
    });
  }

  // the Healwave runs along their feet and rises into one heartbeat
  const glow = document.createElement('canvas');
  glow.width = W;
  glow.height = H;
  const gc = glow.getContext('2d');
  const pts = [];
  const span = 520;
  for (let xx = -40; xx <= W + 40; xx += 3) {
    const u = (xx - (beatX - span / 2)) / span;
    const y = FLOOR + 46 - (u >= 0 && u <= 1 ? ecgShape(u) * 560 : 0);
    pts.push([xx, y]);
  }
  const fan = pts.map(([xx]) => {
    const u = (xx - (beatX - span / 2)) / span;
    return u >= 0 && u <= 1 ? Math.min(1, Math.abs(ecgShape(u)) * 2.2) : 0;
  });
  ribbon(c, pts, { palette: HW_NIGHT, strands: 12, width: 84, lw: 5, smooth: 26, a: 0.95, spread: (u, i) => 1 - 0.45 * fan[i], twist: 2, phase: 0.3, glow: gc });
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.filter = 'blur(26px)';
  c.globalAlpha = 0.75;
  c.drawImage(glow, 0, 0);
  c.filter = 'blur(70px)';
  c.globalAlpha = 0.45;
  c.drawImage(glow, 0, 0);
  c.restore();
  // the head at the R peak
  const peakY = FLOOR + 46 - ecgShape(0.445) * 560;
  const px = beatX - span / 2 + 0.445 * span;
  const hg2 = c.createRadialGradient(px, peakY, 0, px, peakY, 160);
  hg2.addColorStop(0, 'rgba(255,240,248,0.95)');
  hg2.addColorStop(0.15, 'rgba(255,110,180,0.55)');
  hg2.addColorStop(1, 'rgba(255,80,160,0)');
  c.fillStyle = hg2;
  c.fillRect(px - 160, peakY - 160, 320, 320);

  // machine names, up close
  for (const p of placed) {
    txt(c, p.m.name, p.cx, 1648, { mono: true, wt: 500, size: 25, track: 0.12, align: 'c', rgb: ICE, a: 0.9 });
    txt(c, p.m.what, p.cx, 1686, { mono: true, wt: 400, size: 19, track: 0.12, align: 'c', rgb: STEEL, a: 0.85 });
  }
  // headline
  txt(c, 'ALL OF THIS,', 230, 355, { wt: 600, size: 250, track: -0.015, rgb: '255,255,255' });
  txt(c, 'FOR ONE HEARTBEAT.', 230, 612, { wt: 600, size: 250, track: -0.015, rgb: '255,255,255' });
  // the rest of the arsenal
  txt(c, '+ ' + ALSO, 236, 736, { mono: true, wt: 400, size: 25, track: 0.1, rgb: ICE, a: 0.8 });
  wordmark(c, W - 230, 300, { align: 'r', ink: ICE, tagline: true, tagRgb: '255,255,255' });
  grain(c, 0.05, 'overlay');
}

// ---------------------------------------------------------------------------------------------
// B — day blueprint: the hospital as an engineering sheet
async function optionB(c, A) {
  c.fillStyle = '#f5f8fc';
  c.fillRect(0, 0, W, H);
  // drawing grid
  for (let x = 0; x <= W; x += 50) {
    c.fillStyle = rgba(BLUE, x % 250 === 0 ? 0.08 : 0.04);
    c.fillRect(x, 0, x % 250 === 0 ? 2 : 1, H);
  }
  for (let y = 0; y <= H; y += 50) {
    c.fillStyle = rgba(BLUE, y % 250 === 0 ? 0.08 : 0.04);
    c.fillRect(0, y, W, y % 250 === 0 ? 2 : 1);
  }
  // sheet border with zone ticks
  const M = 70;
  c.strokeStyle = rgba(INK, 0.55);
  c.lineWidth = 3;
  c.strokeRect(M, M, W - 2 * M, H - 2 * M);
  c.lineWidth = 2;
  'ABCDEFGHIJKL'.split('').forEach((ch, i) => {
    const x = M + ((W - 2 * M) * (i + 0.5)) / 12;
    txt(c, ch, x, M - 22, { mono: true, wt: 500, size: 22, align: 'c', rgb: INK, a: 0.55 });
    if (i) {
      const xx = M + ((W - 2 * M) * i) / 12;
      c.beginPath();
      c.moveTo(xx, M);
      c.lineTo(xx, M + 24);
      c.moveTo(xx, H - M);
      c.lineTo(xx, H - M - 24);
      c.stroke();
    }
  });
  // headline, Healwave rule, wordmark
  txt(c, 'THE HOSPITAL,', 250, 560, { wt: 600, size: 262, track: -0.02, rgb: INK });
  const r2 = txt(c, 'RE-ENGINEERED.', 250, 830, { wt: 600, size: 262, track: -0.02, rgb: INK });
  const rule = [];
  for (let x = 250; x <= 250 + r2.w; x += 4) rule.push([x, 945 + Math.sin((x - 250) / 230) * 6]);
  ribbon(c, rule, { palette: HW_DAY, strands: 10, width: 62, lw: 4, smooth: 60, a: 0.95, twist: 1.6, phase: 0.3, spread: (u) => 0.7 + 0.3 * Math.sin(Math.PI * u) });
  txt(c, '+ ' + ALSO.split(' · ').slice(0, 5).join(' · '), 256, 1070, { mono: true, wt: 500, size: 24, track: 0.1, rgb: BLUE, a: 0.9 });
  txt(c, '+ ' + ALSO.split(' · ').slice(5).join(' · '), 256, 1110, { mono: true, wt: 500, size: 24, track: 0.1, rgb: BLUE, a: 0.9 });
  wordmark(c, 250, 1380, { red: true, ink: INK, tagline: true, tagRgb: BLUE, scale: 0.92 });

  // the catalogue: 2 rows x 5 cells, each machine over its own technical drawing
  const X0 = 2620, X1 = W - 140, Y0 = 150, Y1 = H - 250;
  const cw = (X1 - X0) / 5, ch = (Y1 - Y0) / 2;
  MACHINES.forEach((m, i) => {
    const col = i % 5, row = Math.floor(i / 5);
    const cx = X0 + cw * (col + 0.5), base = Y0 + ch * row + ch - 150;
    const img = A.img[m.id];
    // fit inside the cell
    let h = Math.min(ch - 230, m.id === 'benq' ? 300 : m.id === 'crea_display' ? 240 : m.id === 'infusomat' ? 290 : 460);
    let w = (img.width * h) / img.height;
    if (w > cw - 90) {
      w = cw - 90;
      h = (img.height * w) / img.width;
    }
    const x = cx - w / 2, y = base - h;
    // cell frame + index
    c.strokeStyle = rgba(BLUE, 0.28);
    c.lineWidth = 2;
    c.strokeRect(X0 + cw * col + 14, Y0 + ch * row + 14, cw - 28, ch - 28);
    txt(c, String(i + 1).padStart(2, '0'), X0 + cw * col + 40, Y0 + ch * row + 70, { mono: true, wt: 500, size: 30, rgb: BLUE, a: 0.9 });
    // the technical drawing, offset behind the photograph
    const lines = A.lines[m.id];
    if (lines) {
      c.save();
      c.translate(x + 26, y - 26);
      c.scale(w / lines.w, h / lines.h);
      c.strokeStyle = rgba(BLUE, 0.55);
      c.lineWidth = 2.2 * (lines.w / w);
      c.lineJoin = 'round';
      for (const ln of lines.lines) {
        const p = ln.p;
        c.beginPath();
        c.moveTo(p[0], p[1]);
        for (let j = 2; j < p.length; j += 2) c.lineTo(p[j], p[j + 1]);
        c.stroke();
      }
      c.restore();
    }
    // dimension bracket at the side
    c.strokeStyle = rgba(INK, 0.5);
    c.lineWidth = 2;
    const bx = x - 34;
    c.beginPath();
    c.moveTo(bx, y);
    c.lineTo(bx, base);
    c.moveTo(bx - 12, y);
    c.lineTo(bx + 12, y);
    c.moveTo(bx - 12, base);
    c.lineTo(bx + 12, base);
    c.stroke();
    machine(c, img, cx, base, h, { shadow: 0.18 });
    // baseline + labels
    c.fillStyle = rgba(INK, 0.6);
    c.fillRect(X0 + cw * col + 40, base + 4, cw - 80, 2);
    txt(c, m.name, cx, base + 64, { mono: true, wt: 500, size: 25, track: 0.1, align: 'c', rgb: INK });
    txt(c, m.what, cx, base + 100, { mono: true, wt: 400, size: 20, track: 0.12, align: 'c', rgb: BLUE, a: 0.9 });
  });
  // title block
  const tbW = 1300, tbH = 150, tbx = W - M - tbW, tby = H - M - tbH;
  c.fillStyle = '#f5f8fc';
  c.fillRect(tbx, tby, tbW, tbH);
  c.strokeStyle = rgba(INK, 0.55);
  c.lineWidth = 3;
  c.strokeRect(tbx, tby, tbW, tbH);
  c.beginPath();
  c.moveTo(tbx + 520, tby);
  c.lineTo(tbx + 520, tby + tbH);
  c.moveTo(tbx + 520, tby + tbH / 2);
  c.lineTo(tbx + tbW, tby + tbH / 2);
  c.lineWidth = 2;
  c.stroke();
  txt(c, 'WOCKHARDT HOSPITALS', tbx + 30, tby + 62, { mono: true, wt: 500, size: 24, track: 0.12, rgb: INK });
  txt(c, 'THE CONNECTED HOSPITAL', tbx + 30, tby + 110, { mono: true, wt: 400, size: 20, track: 0.12, rgb: BLUE });
  txt(c, 'DWG  RE-ENGINEERED / 01', tbx + 550, tby + 50, { mono: true, wt: 500, size: 22, track: 0.12, rgb: INK });
  txt(c, 'SCALE  NTS      REV  2026', tbx + 550, tby + 125, { mono: true, wt: 400, size: 22, track: 0.12, rgb: INK, a: 0.8 });
  grain(c, 0.035, 'multiply');
}

// ---------------------------------------------------------------------------------------------
// C — life at the centre: the newborn's grip, drawn in the Healwave, inside a ring of machines
function parsePath(d) {
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
    if (cmd === 'M' || cmd === 'L') {
      cur = [+toks[i], +toks[i + 1]];
      out.push(cur);
      i += 2;
    } else if (cmd === 'C') {
      const c1 = [+toks[i], +toks[i + 1]], c2 = [+toks[i + 2], +toks[i + 3]], p = [+toks[i + 4], +toks[i + 5]];
      for (let k = 1; k <= 24; k++) {
        const s = k / 24, a = (1 - s) ** 3, b = 3 * (1 - s) ** 2 * s, cc = 3 * (1 - s) * s * s, e = s ** 3;
        out.push([a * cur[0] + b * c1[0] + cc * c2[0] + e * p[0], a * cur[1] + b * c1[1] + cc * c2[1] + e * p[1]]);
      }
      cur = p;
      i += 6;
    } else i++;
  }
  return out;
}

async function optionC(c, A) {
  // soft white with a lilac haze, like the brand's own covers
  c.fillStyle = '#fbfafd';
  c.fillRect(0, 0, W, H);
  const hz = c.createRadialGradient(4180, 820, 100, 4180, 820, 2400);
  hz.addColorStop(0, 'rgba(236,120,190,0.10)');
  hz.addColorStop(0.45, 'rgba(150,120,230,0.07)');
  hz.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = hz;
  c.fillRect(0, 0, W, H);
  const CX = 4180, CY = 860, RX = 1420, RY = 610;
  // the ring of machines (halo drawn as a thin Healwave)
  const ring = [];
  for (let k = 0; k <= 720; k++) {
    const a = (k / 720) * Math.PI * 2;
    ring.push([CX + Math.cos(a) * RX, CY + Math.sin(a) * RY]);
  }
  ribbon(c, ring, { palette: HW_DAY, strands: 7, width: 22, lw: 2.4, smooth: 30, a: 0.55, twist: 6, phase: 0.4 });
  // the newborn's grip in the Healwave, at the centre
  const grip = A.grip;
  const strokes = grip.strokes.map(parsePath).filter((p) => p.length > 1);
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (const p of strokes)
    for (const [x, y] of p) {
      bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
    }
  const sc = 1360 / (bx1 - bx0);
  const ox = CX - 70 - ((bx0 + bx1) / 2) * sc, oy = CY + 50 - ((by0 + by1) / 2) * sc;
  // anchor point of the threads: the baby's wrist (same spot the film's pulse rests on)
  const wrist = [ox + 588 * sc, oy + 140 * sc];
  // threads from each machine to the wrist, under everything
  const n = MACHINES.length;
  const spots = MACHINES.map((m, i) => {
    const a = -Math.PI / 2 + ((i + 0.5) / n) * Math.PI * 2;
    return { m, a, x: CX + Math.cos(a) * RX, y: CY + Math.sin(a) * RY };
  });
  for (const s of spots) {
    const pts = [];
    const mx = lerp(s.x, wrist[0], 0.5) + Math.sin(s.a) * 160, my = lerp(s.y, wrist[1], 0.5) - Math.cos(s.a) * 120;
    for (let k = 0; k <= 80; k++) {
      const u = (k / 80) * 0.62; // stop well short of the drawing
      const x = (1 - u) ** 2 * s.x + 2 * (1 - u) * u * mx + u * u * wrist[0];
      const y = (1 - u) ** 2 * s.y + 2 * (1 - u) * u * my + u * u * wrist[1];
      pts.push([x, y]);
    }
    ribbon(c, pts, { palette: HW_DAY, strands: 5, width: 14, lw: 2, smooth: 20, a: 0.55, spread: (u) => 1 - 0.7 * u, fade: [1, 0] });
  }
  // machines on the ring
  for (const s of spots) {
    const img = A.img[s.m.id];
    let h = { benq: 190, crea_display: 160, infusomat: 190, ingenia: 270, davinci_arms: 260 }[s.m.id] || 330;
    const w = (img.width * h) / img.height;
    machine(c, img, s.x, s.y + h / 2, h, { shadow: 0.16 });
    const below = s.y > CY + 80;
    const ly = below ? s.y + h / 2 + 52 : s.y - h / 2 - 54;
    txt(c, s.m.name, s.x, ly, { mono: true, wt: 500, size: 22, track: 0.1, align: 'c', rgb: INK, a: 0.92 });
    void w;
  }
  // the drawing itself
  for (const s0 of strokes) {
    const p = s0.map(([x, y]) => [ox + x * sc, oy + y * sc]);
    ribbon(c, p, { palette: HW_DAY, strands: 7, width: 20, lw: 2.8, smooth: 16, a: 0.95 });
  }
  // the pulse on the wrist
  const pg = c.createRadialGradient(wrist[0], wrist[1], 0, wrist[0], wrist[1], 46);
  pg.addColorStop(0, 'rgba(214,52,132,0.9)');
  pg.addColorStop(0.25, 'rgba(214,52,132,0.35)');
  pg.addColorStop(1, 'rgba(214,52,132,0)');
  c.fillStyle = pg;
  c.fillRect(wrist[0] - 46, wrist[1] - 46, 92, 92);
  // headline + wordmark on the left
  txt(c, 'TECHNOLOGY', 250, 520, { wt: 600, size: 240, track: -0.02, rgb: INK });
  txt(c, 'FIRST.', 250, 770, { wt: 600, size: 240, track: -0.02, rgb: INK });
  txt(c, 'LIFE ALWAYS.', 250, 1020, { wt: 600, size: 240, track: -0.02, fill: healFill(c, HW_DAY) });
  wordmark(c, 250, 1330, { red: true, ink: INK, scale: 0.92 });
  txt(c, '+ ' + ALSO.split(' · ').slice(0, 5).join(' · '), 256, 1590, { mono: true, wt: 500, size: 23, track: 0.08, rgb: BLUE, a: 0.9 });
  txt(c, '+ ' + ALSO.split(' · ').slice(5).join(' · '), 256, 1630, { mono: true, wt: 500, size: 23, track: 0.08, rgb: BLUE, a: 0.9 });
  grain(c, 0.03, 'multiply');
}

// ---------------------------------------------------------------------------------------------
async function main() {
  const fonts = ['300 40px "Inter Display"', '400 40px "Inter Display"', '500 40px "Inter Display"', '600 40px "Inter Display"', '700 40px "Inter Display"', '400 20px "Geist Mono"', '500 20px "Geist Mono"'];
  await Promise.all(fonts.map((f) => document.fonts.load(f, 'ABC0123')));
  const A = { img: {}, lines: {} };
  await Promise.all(
    MACHINES.map(async (m) => {
      A.img[m.id] = await loadImage(`../assets/machines/${m.id}.png`);
      try {
        A.lines[m.id] = await loadJSON(`../assets/machines/${m.id}.lines.json`);
      } catch (e) {
        A.lines[m.id] = null;
      }
    })
  );
  A.grip = await loadJSON('../assets/human/grip.json');
  if (OPTION === 'A') await optionA(ctx, A);
  else if (OPTION === 'B') await optionB(ctx, A);
  else await optionC(ctx, A);
  window.__kv = { done: true };
}
window.__kv = { done: false };
main().catch((e) => {
  window.__kv = { done: true, error: String(e && e.stack || e) };
});
