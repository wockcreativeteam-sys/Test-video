// Shot registry: each shot draws inside its own window. Dev shots (no window) draw only with ?only=key.
import { SHOT } from '../timeline.js';
import * as t00 from './t00.js';
import * as t01 from './t01.js';
import * as t02 from './t02.js';
import * as s01 from './s01.js';
import * as s02 from './s02.js';
import * as s03 from './s03.js';
import * as s04 from './s04.js';
import * as s05 from './s05.js';
import * as s06 from './s06.js';
import * as s07 from './s07.js';
import * as s08 from './s08.js';

const mods = { t00, t01, t02, s01, s02, s03, s04, s05, s06, s07, s08 };
const only = new URLSearchParams(location.search).get('only');
export const SHOTS = Object.entries(mods)
  .filter(([key]) => SHOT[key] || only === key)
  .map(([key, m]) => ({
    key,
    t0: SHOT[key] ? SHOT[key][0] : 0,
    t1: SHOT[key] ? SHOT[key][1] : 1e9,
    draw: m.draw,
    init: m.init,
  }));
