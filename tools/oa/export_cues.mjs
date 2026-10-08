// oa/src/timeline.js (+ VO durations) -> oa/audio/cues.json for the sound designer / mixer.
import fs from 'node:fs';
import { FPS, DURATION, SHOT, VO, EV } from '../../oa/src/timeline.js';

const d = JSON.parse(fs.readFileSync(new URL('../../oa/audio/vo/durations.json', import.meta.url)));
const vo = VO.map(([k, t]) => ({ key: k, t, dur: d.durations[k], text: d.lines[k] }));
fs.writeFileSync(new URL('../../oa/audio/cues.json', import.meta.url), JSON.stringify({ FPS, DURATION, SHOT, VO: vo, EV }, null, 1));
console.log('cues.json:', vo.length, 'VO lines,', Object.keys(EV).length, 'event groups');
