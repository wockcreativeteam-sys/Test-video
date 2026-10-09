// Film runtime: loads fonts, owns the master render function, exposes a deterministic
// render/capture API for the offline renderer and a real-time preview player.
import { Frame } from './frame.js';
import { Post } from './engine/post.js';
import { R3 } from './engine/r3.js';
import { loadGlyphFonts } from './engine/glyphs.js';
import { look } from './look.js';
import { FPS, DURATION, W, H } from './timeline.js';
import { SHOTS } from './shots/index.js';

const SHUTTER = 0.5; // 180-degree shutter
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
const ONLY = params.get('only'); // debug: draw only this shot key

const out = document.getElementById('out');
out.width = W;
out.height = H;
const F = new Frame(W, H);
const post = new Post(out, W, H);
const R = new R3(post.gl, W, H, { samples: +(params.get('msaa') || 4), fsDefs: params.get('defs') ? params.get('defs').split(',').map((d) => '#define ' + d).join('\n') : '' });
F.R = R;

async function loadFonts() {
  const faces = [
    '200 40px "Inter Display"', '300 40px "Inter Display"', '400 40px "Inter Display"',
    '500 40px "Inter Display"', '600 40px "Inter Display"', '700 40px "Inter Display"',
    '300 20px "Geist Mono"', '400 20px "Geist Mono"', '500 20px "Geist Mono"',
  ];
  await Promise.all(faces.map((f) => document.fonts.load(f, 'ABC0123')));
  await loadGlyphFonts();
}

function drawAt(t, gain) {
  F.begin(t, look(t));
  F.S.gain = gain;
  for (const s of SHOTS) {
    if (ONLY && s.key !== ONLY) continue;
    if (t >= s.t0 && t < s.t1) {
      F.ctx.save();
      F.g.save();
      s.draw(F, t - s.t0, t);
      F.L.flush();
      F.ctx.restore();
      F.g.restore();
    }
  }
  return F.fx;
}

// motion blur: sub-frames are averaged on the CPU canvases, the particle film accumulates, and
// the 3D scene accumulates on the GPU
const accBase = document.createElement('canvas');
const accGlow = document.createElement('canvas');
accBase.width = W;
accBase.height = H;
accGlow.width = W / 2;
accGlow.height = H / 2;
const aB = accBase.getContext('2d', { willReadFrequently: true });
const aG = accGlow.getContext('2d', { willReadFrequently: true });

export function renderFrame(i, samplesOverride) {
  const t = i / FPS;
  const L0 = look(t);
  const n = samplesOverride || L0.mb;
  F.S.clear();
  if (n <= 1) {
    const fx = drawAt(t, 1);
    const sc = F.r3on ? R.render(F.cam) : null;
    post.render(F.base, F.glowC, F.S.buf, L0, fx, i, sc);
    return;
  }
  aB.globalCompositeOperation = 'source-over';
  aG.globalCompositeOperation = 'source-over';
  aB.clearRect(0, 0, W, H);
  aG.clearRect(0, 0, W / 2, H / 2);
  let fxMid = null, sc = null, first = true;
  for (let s = 0; s < n; s++) {
    const ts = t + ((s + 0.5) / n - 0.5) * (SHUTTER / FPS);
    const fx = drawAt(Math.max(0, ts), 1 / n);
    if (s === Math.floor(n / 2)) fxMid = { ...fx };
    if (F.r3on) {
      sc = R.render(F.cam, { first, w: 1 / n });
      first = false;
    }
    aB.globalCompositeOperation = 'lighter';
    aG.globalCompositeOperation = 'lighter';
    aB.globalAlpha = 1 / n;
    aG.globalAlpha = 1 / n;
    aB.drawImage(F.base, 0, 0);
    aG.drawImage(F.glowC, 0, 0);
  }
  aB.globalAlpha = 1;
  aG.globalAlpha = 1;
  post.render(accBase, accGlow, F.S.buf, L0, fxMid || {}, i, sc);
}

const ready = (async () => {
  await loadFonts();
  for (const s of SHOTS) if (s.init) await s.init(F);
  return true;
})();

window.__film = {
  ready,
  fps: FPS,
  duration: DURATION,
  frames: Math.round(DURATION * FPS),
  render(i, n) {
    renderFrame(i, n);
    return true;
  },
  still(t, n) {
    renderFrame(Math.round(t * FPS), n);
    return true;
  },
  profile(t, n) {
    const gl = post.gl;
    const i = Math.round(t * FPS);
    const px = new Uint8Array(4);
    const sync = () => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    };
    sync();
    const T = [performance.now()];
    F.S.clear();
    const L0 = look(i / FPS);
    const fx = drawAt(i / FPS, 1);
    T.push(performance.now());
    R.stageSync = sync;
    R.stageT = [];
    const sc = F.r3on ? R.render(F.cam) : null;
    sync();
    T.push(performance.now());
    post.render(F.base, F.glowC, F.S.buf, L0, fx, i, sc);
    sync();
    T.push(performance.now());
    R.stageSync = null;
    const d = T.slice(1).map((v, k) => +(v - T[k]).toFixed(1));
    return { draw: d[0], r3: d[1], post: d[2], stages: R.stageT };
  },
  async capture(i0, i1, url) {
    const buf = new Uint8Array(W * H * 4);
    for (let i = i0; i < i1; i++) {
      renderFrame(i);
      post.read(buf);
      const r = await fetch(`${url}?i=${i}`, { method: 'POST', body: buf });
      if (!r.ok) throw new Error('capture post failed ' + i);
    }
    return i1 - i0;
  },
};

// ---------------- preview player ----------------
if (!RENDER) {
  const ui = document.getElementById('ui');
  ui.style.display = 'flex';
  const audio = document.getElementById('score');
  const scrub = document.getElementById('scrub');
  const tc = document.getElementById('tc');
  const play = document.getElementById('play');
  scrub.max = DURATION;
  let playing = false, clockT = +(params.get('t') || 0), last = 0;
  play.onclick = () => {
    playing = !playing;
    play.textContent = playing ? 'Pause' : 'Play';
    if (playing) {
      audio.currentTime = clockT;
      audio.play().catch(() => {});
    } else audio.pause();
  };
  scrub.oninput = () => {
    clockT = +scrub.value;
    audio.currentTime = clockT;
  };
  ready.then(() => {
    const loop = (now) => {
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      if (playing) clockT = audio.readyState >= 2 && !audio.paused ? audio.currentTime : clockT + dt;
      if (clockT >= DURATION) {
        clockT = 0;
        audio.currentTime = 0;
      }
      scrub.value = clockT;
      tc.textContent = clockT.toFixed(2) + 's';
      renderFrame(Math.round(clockT * FPS), 1);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
