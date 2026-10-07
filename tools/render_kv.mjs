// Render the billboard key visuals (film/kv) to PNG.
//   node tools/render_kv.mjs            # all three options -> out/kv/
//   node tools/render_kv.mjs A C        # some of them
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', 'film');
const OUT = path.resolve(here, '..', 'out', 'kv');
const PW = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.otf': 'font/otf', '.woff2': 'font/woff2' };
const NAMES = { A: 'A_all-of-this_night', B: 'B_re-engineered_blueprint', C: 'C_life-always_halo' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await chromium.launch({ args: ['--disable-accelerated-2d-canvas', '--disable-gpu'] });
fs.mkdirSync(OUT, { recursive: true });
const opts = process.argv.slice(2).length ? process.argv.slice(2) : ['A', 'B', 'C'];
for (const o of opts) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 500 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/kv/index.html?o=${o}`);
  await page.waitForFunction(() => window.__kv && window.__kv.done, null, { timeout: 300000 });
  const err = await page.evaluate(() => window.__kv.error);
  if (err) {
    console.log('error in', o, err);
    continue;
  }
  const b64 = await page.evaluate(() => document.getElementById('kv').toDataURL('image/png').split(',')[1]);
  const file = path.join(OUT, `wockhardt_kv_${NAMES[o]}_6000x1750.png`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log('wrote', file);
  await page.close();
}
await browser.close();
server.close();
