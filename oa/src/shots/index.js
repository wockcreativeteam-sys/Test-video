// Shot registry: each shot draws inside its own (overlapping) window; transitions are drawn by both.
import { SHOT } from '../timeline.js';
import * as s01 from './s01.js';
import * as s02 from './s02.js';
import * as s03 from './s03.js';
import * as s04 from './s04.js';

const mods = { s01, s02, s03, s04 };
export const SHOTS = Object.entries(mods).map(([key, m]) => ({ key, t0: SHOT[key][0], t1: SHOT[key][1], draw: m.draw, init: m.init }));
