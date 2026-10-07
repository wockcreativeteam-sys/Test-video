// Dump the shared timeline (heart tracks, chapter times) for the audio synthesiser.
import fs from 'node:fs';
import { HEART, BABY, T, DURATION, BPM } from '../film/src/timeline.js';
fs.writeFileSync(new URL('../film/audio/cues.json', import.meta.url), JSON.stringify({ HEART, BABY, T, DURATION, BPM }, null, 1));
console.log('beats', HEART.length, 'baby', BABY.length);
