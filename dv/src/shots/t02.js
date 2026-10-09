// dev: assembly hall preview. t in [0,1): down-the-line, [1,2): station 3/4, [2,3): low side, [3,4): high wide
import { m4 } from '../engine/m4.js';
import { DaVinci, defaultState, stowedState } from '../model/davinci.js';
import { Robot6 } from '../model/robot6.js';
import { buildSets, hallScene, drawHall, drawCarriage, LINE } from '../model/sets.js';

let dv = null, rA = null, rB = null, S = null;
export function init(F) {
  dv = new DaVinci(F.R, 0.6);
  rA = new Robot6(F.R, 'driver');
  rB = new Robot6(F.R, 'grip');
  S = buildSets(F.R);
}
export function draw(F, lt, t) {
  const v = Math.floor(t);
  const views = [
    [[-9, 1.0, 0.6], [6, 1.2, 0], 34],
    [[3.2, 2.0, 4.2], [0, 1.0, 0], 34],
    [[0.5, 0.45, 4.6], [0, 0.9, 0], 30],
    [[-6, 6.5, 8], [4, 0.5, 0], 38],
  ];
  const [pos, tgt, fov] = views[Math.min(v, views.length - 1)];
  F.cam.set(pos, tgt, fov);
  const R = F.scene(hallScene(t, { lit: 1, cx: 0 }));
  drawHall(R, { banks: () => 1, lit: 1 });
  // pallet + robot at station 0
  R.add(S.pallet, m4.T(0, 0.04, 0), { alb: [0.05, 0.053, 0.06], rough: 0.4, metal: 0, f0: 0.05, coat: 0.4 });
  R.add(S.palletEdge, m4.T(0, 0.075, 0), { alb: [0.02, 0.02, 0.02], rough: 0.4, emis: [0.3, 1.0, 1.4] });
  const st = stowedState();
  st.root = m4.T(0, 0.08, 0);
  dv.draw(R, st);
  // assembly robots at the station
  const BA = m4.chain(m4.T(0.2, 0, 1.45), m4.RY(Math.PI));
  const qa = rA.solve(BA, [0.43, 0.3, 0.55], [0, -1, 0]);
  rA.draw(R, BA, qa);
  const BB = m4.T(-0.2, 0, -1.45);
  const qb = rB.solve(BB, [-0.43, 0.35, -0.5], [0, -1, 0]);
  rB.draw(R, BB, qb);
  // the next station: a carriage holding a column
  drawCarriage(R, 7, 2.2);
}
