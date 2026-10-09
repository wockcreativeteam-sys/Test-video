// dev: da Vinci model turntable. t in [0,1): front (reference match), [1,2): 3/4, [2,3): side,
// [3,4): high back 3/4, [4,5): stowed 3/4, [5,6): arm close-up, [6,7): instrument tip macro
import { plane } from '../engine/geo.js';
import { m4 } from '../engine/m4.js';
import { DaVinci, defaultState, drawWrist } from '../model/davinci.js';
import { studio } from '../model/sets.js';

let dv = null, floor = null;
export function init(F) {
  dv = new DaVinci(F.R, +(new URLSearchParams(location.search).get('q') || 1));
  floor = F.R.mesh(plane(60, 60));
}
export function draw(F, lt, t) {
  const v = Math.floor(t);
  const st = defaultState();
  const views = [
    [[0, 1.05, 9.5], [0, 1.0, 0], 13],
    [[2.6, 1.6, 3.6], [0, 1.05, 0], 32],
    [[4.2, 1.2, 0.0], [0, 1.0, 0], 30],
    [[-2.4, 2.6, -2.6], [0, 1.1, 0], 32],
    [[2.6, 1.6, 3.6], [0, 1.05, 0], 32],
    [[0.9, 1.55, 1.5], [-0.25, 1.4, 0.3], 34],
    [[0.06, 1.02, 0.6], [0.0, 1.0, 0.47], 18],
  ];
  const [pos, tgt, fov] = views[Math.min(v, views.length - 1)];
  F.cam.set(pos, tgt, fov);
  if (v === 4) st.deploy = [0, 0, 0, 0];
  const q = new URLSearchParams(location.search);
  const sc = studio(t);
  if (q.has('noRefl')) sc.reflect = false;
  if (q.has('noKey')) sc.key = null;
  if (q.has('noSky')) sc.skyAO = null;
  const R = F.scene(sc);
  if (q.has('noFloor')) { dv.draw(R, st); return; }
  if (q.has('noRobot')) { R.add(floor, m4.ident(), { alb: [0.012, 0.012, 0.014], rough: 0.16, floor: true, reflStr: 0.7, reflBlur: 6 }); return; }
  R.add(floor, m4.ident(), { alb: [0.012, 0.012, 0.014], rough: 0.16, floor: true, reflStr: 0.7, reflBlur: 6 });
  const parts = dv.draw(R, st);
  if (q.has('count') && !window.__counted) {
    window.__counted = 1;
    let tri = 0, vtx = 0;
    for (const p of parts) if (p.mesh) { tri += p.mesh.n / 3; vtx += p.mesh.geo.P.length / 3; }
    console.warn('parts', parts.length, 'tris', tri, 'verts', vtx);
  }
}
