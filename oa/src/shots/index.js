// Shot registry: each shot draws inside its own (overlapping) window; transitions are drawn by both.
import { SHOT } from '../timeline.js';
import * as s01 from './s01.js';
import * as s02 from './s02.js';
import * as s03 from './s03.js';
import * as s04 from './s04.js';
import * as s05 from './s05.js';
import * as s06 from './s06.js';
import * as s07 from './s07.js';
import * as s08 from './s08.js';
import * as s09 from './s09.js';
import * as s10 from './s10.js';
import * as s11 from './s11.js';
import * as s12 from './s12.js';
import * as s13 from './s13.js';
import * as s14 from './s14.js';

const mods = { s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12, s13, s14 };
export const SHOTS = Object.entries(mods).map(([key, m]) => ({ key, t0: SHOT[key][0], t1: SHOT[key][1], draw: m.draw, init: m.init }));
