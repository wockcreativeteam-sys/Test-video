// Film runtime: loads assets, owns the master render function, exposes a deterministic
// render/capture API for the offline renderer and a real-time preview player.
import { Frame } from './frame.js';
import { Post } from './engine/post.js';
import { look } from './look.js';
import { FPS, DURATION, W, H } from './timeline.js';
import { SCENES } from './scenes/index.js';
import { platformCam } from './scenes/s07_platform.js';

const SHUTTER = 0.5; // 180-degree shutter
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');

const out = document.getElementById('out');
out.width = W;
out.height = H;
const F = new Frame(W, H);
const post = new Post(out, W, H);

async function loadFonts() {
  const faces = [
    '100 40px "Inter Display"', '200 40px "Inter Display"', '300 40px "Inter Display"', '400 40px "Inter Display"',
    '500 40px "Inter Display"', '600 40px "Inter Display"', '700 40px "Inter Display"',
    '300 20px "Geist Mono"', '400 20px "Geist Mono"', '500 20px "Geist Mono"',
  ];
  await Promise.all(faces.map((f) => document.fonts.load(f, 'ABC0123')));
}

async function loadAssets() {
  const meta = await (await fetch('assets/machines/manifest.json')).json();
  F.assets.meta = meta;
  await Promise.all(
    Object.keys(meta).map(async (name) => {
      const img = new Image();
      img.src = `assets/machines/${name}.png`;
      await img.decode();
      F.assets.img[name] = img;
      F.assets.lines[name] = await (await fetch(`assets/machines/${name}.lines.json`)).json();
    })
  );
}

function drawAt(t) {
  F.begin(t, look(t));
  const c = platformCam(Math.min(t, 84.5));
  F.cam.set(c.pos, c.tgt, c.fov, c.roll || 0, c.shift || null);
  for (const s of SCENES) {
    if (t >= s.t0 && t < s.t1) {
      s.draw(F, t - s.t0, t);
      F.L.flush();
    }
  }
  return F.look;
}

// motion blur: sub-frames are averaged on the CPU canvases, then graded once on the GPU
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
  if (n <= 1) {
    const L = drawAt(t);
    post.render(F.base, F.glowC, L, i);
    return;
  }
  aB.globalCompositeOperation = 'source-over';
  aG.globalCompositeOperation = 'source-over';
  aB.clearRect(0, 0, W, H);
  aG.clearRect(0, 0, W / 2, H / 2);
  let L = L0;
  for (let s = 0; s < n; s++) {
    const ts = t + ((s + 0.5) / n - 0.5) * (SHUTTER / FPS);
    L = drawAt(Math.max(0, ts));
    aB.globalCompositeOperation = 'lighter';
    aG.globalCompositeOperation = 'lighter';
    aB.globalAlpha = 1 / n;
    aG.globalAlpha = 1 / n;
    aB.drawImage(F.base, 0, 0);
    aG.drawImage(F.glowC, 0, 0);
  }
  aB.globalAlpha = 1;
  aG.globalAlpha = 1;
  post.render(accBase, accGlow, look(t), i);
}

const ready = (async () => {
  await loadFonts();
  await loadAssets();
  for (const s of SCENES) if (s.init) await s.init(F);
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
    const t0 = performance.now();
    const L = drawAt(t);
    const t1 = performance.now();
    renderFrame(Math.round(t * FPS), n || 1);
    const t2 = performance.now();
    post.gl.finish();
    const t3 = performance.now();
    const buf = new Uint8Array(W * H * 4);
    post.read(buf);
    const t4 = performance.now();
    return { draw: +(t1 - t0).toFixed(1), sample: +(t2 - t1).toFixed(1), finish: +(t3 - t2).toFixed(1), read: +(t4 - t3).toFixed(1) };
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
  let playing = false, clockT = 0, last = 0;
  play.onclick = () => {
    playing = !playing;
    play.textContent = playing ? 'Pause' : 'Play';
    if (playing) audio.play().catch(() => {});
    else audio.pause();
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
