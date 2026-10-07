#!/usr/bin/env node
// Offline renderer. Serves film/, drives headless Chromium (SwiftShader WebGL2) and streams
// raw RGBA frames into ffmpeg.
//
//   node tools/render.mjs video  --from 0 --to 106 --out out/video.mkv
//   node tools/render.mjs stills --times 1,5.5,12 --out out/stills [--samples 1]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', 'film');
const PW = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);

const args = process.argv.slice(2);
const mode = args[0];
const opt = (k, d) => {
  const i = args.indexOf('--' + k);
  return i >= 0 ? args[i + 1] : d;
};
const W = 1920, H = 1080;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.otf': 'font/otf', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.css': 'text/css',
};

let sink = null; // function(buffer, frameIndex)
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/frame') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const buf = Buffer.concat(chunks);
      if (buf.length !== W * H * 4) {
        res.writeHead(400).end('bad size ' + buf.length);
        return;
      }
      await sink(buf, +url.searchParams.get('i'));
      res.writeHead(200).end('ok');
    });
    return;
  }
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-accelerated-2d-canvas', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text());
});
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html?render=1`);
await page.evaluate(() => window.__film.ready);
const info = await page.evaluate(() => ({ fps: window.__film.fps, frames: window.__film.frames }));

function ffmpeg(argv) {
  const p = spawn('ffmpeg', argv, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((r, j) => p.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg ' + c)))));
  return { p, done };
}
function write(stream, buf) {
  return new Promise((r) => (stream.write(buf) ? r() : stream.once('drain', r)));
}

if (mode === 'video') {
  const fps = info.fps;
  const i0 = Math.round(+opt('from', 0) * fps);
  const i1 = Math.min(info.frames, Math.round(+opt('to', info.frames / fps) * fps));
  const outFile = opt('out', 'out/video.mkv');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const scale = opt('scale', null);
  const vf = ['vflip'];
  if (scale) vf.push(`scale=iw*${scale}:ih*${scale}:flags=lanczos`);
  const enc = ffmpeg([
    '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', 'pipe:0',
    '-vf', vf.join(','), '-c:v', 'libx264', '-preset', opt('preset', 'medium'), '-crf', opt('crf', '10'), '-tune', 'grain',
    '-pix_fmt', 'yuv420p', outFile,
  ]);
  let n = 0;
  const t0 = Date.now();
  sink = async (buf) => {
    await write(enc.p.stdin, buf);
    n++;
    if (n % 30 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`frame ${i0 + n}/${i1}  ${(n / el).toFixed(2)} fps  eta ${(((i1 - i0 - n) / n) * el / 60).toFixed(1)} min`);
    }
  };
  await page.evaluate(([a, b, u]) => window.__film.capture(a, b, u), [i0, i1, `http://127.0.0.1:${port}/frame`]);
  enc.p.stdin.end();
  await enc.done;
  console.log('wrote', outFile, n, 'frames in', ((Date.now() - t0) / 1000).toFixed(1), 's');
} else if (mode === 'stills') {
  const times = opt('times', '1').split(',').map(Number);
  const dir = opt('out', 'out/stills');
  const samples = opt('samples', null);
  fs.mkdirSync(dir, { recursive: true });
  for (const t of times) {
    const t0 = Date.now();
    const url = await page.evaluate(([tt, s]) => {
      window.__film.still(tt, s ? +s : undefined);
      return document.getElementById('out').toDataURL('image/jpeg', 0.92);
    }, [t, samples]);
    const file = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log(file, Date.now() - t0, 'ms');
  }
}
await browser.close();
server.close();
