#!/usr/bin/env node
// Preview the line-art worlds of oa/src/lib/worlds.js (dev tool; not part of the film render).
// Serves oa/ over http, opens oa/dev/worlds.html in headless Chromium and writes PNGs:
//   <out>/NN_<world>.png (shot-03 camera), exam_room.png (shot-08 camera), fragments.png, contact_sheet.png
// It also validates every world in Node: budgets, bounds, NaNs, determinism.
//
//   node tools/oa/preview_worlds.mjs [--only school,street] [--t 0.3] [--out DIR] [--anim]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', 'oa');
const PW = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf('--' + k);
  return i >= 0 ? args[i + 1] : d;
};
const OUT = path.resolve(
  opt('out', '/tmp/claude-0/-home-user-Test-video/54c79fef-5d64-56fa-80bc-161540386706/scratchpad/worlds_preview')
);
const T = +opt('t', 0.3);
const only = opt('only', '') ? opt('only', '').split(',') : null;
const animFrames = args.includes('--anim');
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- validation in Node
const lib = await import(pathToFileURL(path.join(ROOT, 'src/lib/worlds.js')).href);
const BOUNDS = { x: [-7, 9], y: [0, 4.5], z: [-1.2, 7] };
const report = [];
function check(name, W) {
  let pts = 0, nan = 0, out = 0;
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  const scan = (p) => {
    for (let i = 0; i < p.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = p[i + k];
        if (!Number.isFinite(v)) nan++;
        if (v < lo[k]) lo[k] = v;
        if (v > hi[k]) hi[k] = v;
      }
      const ax = 'xyz';
      for (let k = 0; k < 3; k++) {
        const b = BOUNDS[ax[k]];
        if (p[i + k] < b[0] - 1e-3 || p[i + k] > b[1] + 1e-3) { out++; break; }
      }
    }
  };
  for (const L of W.lines) {
    pts += L.p.length / 3;
    if (!(L.p instanceof Float32Array) || L.p.length < 6 || L.p.length % 3) nan++;
    scan(L.p);
  }
  if (W.dots) scan(W.dots);
  let animLines = 0;
  if (W.anim) for (const t of [0, 0.25, 0.5, 1.5]) { const a = W.anim(t); animLines = Math.max(animLines, a.length); for (const L of a) scan(L.p); }
  const ws = [0, 0, 0];
  for (const L of W.lines) ws[L.w >= 0.75 ? 0 : L.w >= 0.35 ? 1 : 2]++;
  const r = {
    name, lines: W.lines.length, points: pts, dots: W.dots ? W.dots.length / 3 : 0, anim: animLines,
    'w1/.5/.2': ws.join('/'), nan, outOfBounds: out,
    x: `${lo[0].toFixed(1)}..${hi[0].toFixed(1)}`, y: `${lo[1].toFixed(2)}..${hi[1].toFixed(2)}`, z: `${lo[2].toFixed(1)}..${hi[2].toFixed(1)}`,
  };
  report.push(r);
  return r;
}
const sameGeom = (a, b) => a.lines.length === b.lines.length && a.lines.every((L, i) => L.p.length === b.lines[i].p.length && L.p.every((v, j) => v === b.lines[i].p[j]));
for (const n of lib.WORLD_ORDER) {
  const W = lib.buildWorld(n, 1);
  check(n, W);
  if (!sameGeom(W, lib.buildWorld(n, 1))) console.error('NON-DETERMINISTIC', n);
}
check('examRoom', lib.buildExamRoom(1));
console.table(report);
for (const f of lib.FRAGMENTS) {
  const P = lib.buildFragment(f);
  let pts = 0, bad = 0;
  for (const p of P) { pts += p.length / 2; for (const v of p) if (!Number.isFinite(v) || v < -0.5001 || v > 0.5001) bad++; }
  console.log(`fragment ${f.padEnd(10)} polylines ${P.length}  points ${pts}  out-of-square ${bad}`);
}

// ---------------------------------------------------------------- render in Chromium
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/dev/worlds.html`;

const { chromium } = await import(PW);
const browser = await chromium.launch({ args: ['--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });

async function shot(query, file, h = 1080) {
  await page.setViewportSize({ width: 1920, height: h });
  await page.goto(`${base}?${query}`);
  await page.waitForFunction(() => window.__done === true, null, { timeout: 60000 });
  await page.locator('#c').screenshot({ path: path.join(OUT, file) });
  console.log('wrote', file);
}

const extra = opt('cam', '') ? `&cam=${opt('cam', '')}` : '';
for (const [i, n] of lib.WORLD_ORDER.entries()) {
  if (only && !only.includes(n)) continue;
  const tag = String(i + 1).padStart(2, '0');
  await shot(`view=world&name=${n}&t=${T}${extra}`, `${tag}_${n}.png`);
  if (animFrames) for (const t of [0.05, 0.45]) await shot(`view=world&name=${n}&t=${t}${extra}&hud=0`, `${tag}_${n}_t${t}.png`);
}
if (!only || only.includes('exam')) await shot(`view=exam&t=${T}${extra}`, 'exam_room.png');
if (!only || only.includes('frag')) await shot('view=frag', 'fragments.png');
if (!only || only.includes('sheet')) await shot(`view=sheet&t=${T}`, 'contact_sheet.png', 1440);

await browser.close();
server.close();
console.log('out:', OUT);
