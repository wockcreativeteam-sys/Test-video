// dv/src/timeline.js -> dv/audio/cues.json for the sound designer / mixer (incl. light-bank ignitions).
import fs from 'node:fs';
import { FPS, DURATION, BPM, SHOT, EV } from '../../dv/src/timeline.js';
import { LINE } from '../../dv/src/model/sets.js';

// light banks in the opening (mirrors bankT in dv/src/shots/s01.js)
const banks = [];
for (let i = 0; i < LINE.nBanks; i++) {
  const x = LINE.bank0 + i * LINE.bankStep;
  const order = Math.round((x + 3.5) / LINE.bankStep);
  if (order < 0) continue;
  const seq = [2.0, 2.5, 3.0, 3.25, 3.5, 3.75];
  const t = order < seq.length ? seq[order] : 3.75 + (order - seq.length + 1) * 0.07;
  if (t < 4.0) banks.push({ t: +t.toFixed(4), x, order });
}
fs.writeFileSync(new URL('../../dv/audio/cues.json', import.meta.url), JSON.stringify({ FPS, DURATION, BPM, SHOT, EV, banks }, null, 1));
console.log('cues.json:', Object.keys(EV).length, 'events,', banks.length, 'banks');
