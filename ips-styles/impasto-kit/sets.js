// Painted sets shared by the impasto episodes (reference illustrations; painted by Stage.plateOf).
import { P, E as EL, lin, rad } from './common.js';
import { KNIFE, BRUSH, DAB } from './engine/impasto.js';
export const sweep = (w, h, d = .55) => (x, y) => (x / w) * d * .8 + (y / h) * d * .2;

// golden Mumbai skyline over the sea (1300 x 2300)
export function skySet(R) {
  R.fill(P([[0, 0], [1300, 0], [1300, 1560], [0, 1560]]), lin(0, 0, 0, 1560, [[0, '#3c5a98'], [.45, '#9a8fae'], [.78, '#eea87c'], [1, '#f8d08a']]), { dir: -4, fallback: -4, group: 'sky', maxR: 60, detail: 2.2 });
  R.fill(EL(880, 1420, 70, 70), rad(880, 1420, 10, 70, [[0, '#fff4cc'], [1, '#f6c27a']]), { group: 'sun', maxR: 10 });
  for (const [x, y, w] of [[180, 520, 300], [760, 360, 380], [420, 980, 260], [980, 860, 280]]) R.fill(EL(x, y, w, 46), '#d8b2b2', { dir: 0, group: 'cl' + x, maxR: 24, aj: .15 });
  const bl = [[0, 1500, 120], [110, 1430, 90], [190, 1360, 70], [250, 1470, 150], [390, 1300, 80], [460, 1410, 110], [560, 1250, 60], [610, 1380, 130], [730, 1330, 90], [810, 1450, 160], [960, 1290, 70], [1020, 1400, 140], [1150, 1350, 150]];
  bl.forEach(([x, y, w], i) => R.fill(P([[x, y], [x + w, y], [x + w, 1600], [x, 1600]]), lin(x, 0, x + w, 0, [[0, '#4a4060'], [1, '#2e2840']]), { dir: 90, group: 'b' + i, maxR: 26, detail: 1.4 }));
  for (let i = 0; i < 70; i++) { const b = bl[i % bl.length], x = b[0] + 12 + ((i * 37) % Math.max(20, b[2] - 24)), y = b[1] + 30 + ((i * 53) % 260); R.fill(P([[x, y], [x + 10, y], [x + 10, y + 14], [x, y + 14]]), '#f2c27a', { group: 'b' + (i % bl.length), maxR: 3 }); }
  R.fill(P([[0, 1590], [1300, 1590], [1300, 2300], [0, 2300]]), lin(0, 1590, 0, 2300, [[0, '#d89a7c'], [.3, '#6a6082'], [1, '#2a2840']]), { dir: 0, fallback: 0, group: 'sea', maxR: 30, aj: .12 });
  for (let i = 0; i < 40; i++) { const y = 1620 + i * 16, w = 160 - i * 2.6; R.fill(P([[880 - w / 2, y], [880 + w / 2, y], [880 + w / 2 - 6, y + 6], [880 - w / 2 + 6, y + 6]]), i % 2 ? '#f6d29a' : '#e8b07a', { dir: 0, group: 'sea', maxR: 6, type: DAB }); }
}

// the hospital in morning light (1300 x 2300)
export function hospSet(R) {
  R.fill(P([[0, 0], [1300, 0], [1300, 900], [0, 900]]), lin(0, 0, 0, 900, [[0, '#7aa0d4'], [1, '#d8e4ee']]), { dir: -3, fallback: -3, group: 'sky', maxR: 60, detail: 2.2 });
  R.fill(P([[80, 260], [1220, 260], [1220, 1600], [80, 1600]]), lin(80, 0, 1220, 0, [[0, '#f4efe6'], [1, '#c8c0b4']]), { dir: 90, group: 'bld', maxR: 30 });
  for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) R.fill(P([[130 + k * 182, 420 + r * 190], [270 + k * 182, 420 + r * 190], [270 + k * 182, 560 + r * 190], [130 + k * 182, 560 + r * 190]]), lin(0, 420 + r * 190, 0, 560 + r * 190, [[0, '#8aaccc'], [1, '#c4d6e2']]), { dir: 90, group: 'w' + r + k, maxR: 10 });
  R.fill(P([[80, 290], [1220, 290], [1220, 380], [80, 380]]), '#ffffff', { dir: 0, group: 'band', maxR: 10 });
  R.text('WOCKHARDT HOSPITALS', 650, 356, '600 64px "Cormorant SC"', '#c8262e', { dir: 'edge', group: 'name', maxR: 3 });
  R.fill(P([[300, 1180], [1000, 1180], [1040, 1230], [260, 1230]]), '#1f3d66', { dir: 0, group: 'can', maxR: 10 });
  R.fill(P([[380, 1230], [920, 1230], [920, 1600], [380, 1600]]), lin(0, 1230, 0, 1600, [[0, '#f8eac8'], [1, '#e8c890']]), { dir: 90, group: 'door', maxR: 14 });
  R.fill(P([[645, 1230], [655, 1230], [655, 1600], [645, 1600]]), '#8a8070', { group: 'dline', maxR: 3 });
  R.fill(P([[0, 1600], [1300, 1600], [1300, 2300], [0, 2300]]), lin(0, 1600, 0, 2300, [[0, '#d8ccb8'], [1, '#8a8070']]), { dir: 0, group: 'paving', maxR: 30 });
  for (const x of [150, 1150]) { R.fill(EL(x, 1480, 110, 150), lin(x - 100, 0, x + 100, 0, [[0, '#6aa04a'], [1, '#2e6a3a']]), { group: 'tree' + x, maxR: 16, type: DAB }); R.fill(P([[x - 70, 1580], [x + 70, 1580], [x + 56, 1660], [x - 56, 1660]]), '#a8907a', { group: 'pot' + x, maxR: 8 }); }
}

// the end card's painted ground with the brand ribbon (1080 x 1920)
export function endSet(R) {
  R.fill(P([[0, 0], [1080, 0], [1080, 1920], [0, 1920]]), rad(540, 760, 60, 1300, [[0, '#fbf3e4'], [.6, '#f0e2c8'], [1, '#d8c4a0']]), { dir: -8, fallback: -8, group: 'bg', maxR: 50, detail: 2 });
  for (const [c, dy] of [['#c8262e', 0], ['#1f5c9e', 16], ['#e8b24a', 30]]) R.line(q => { q.moveTo(-20, 560 + dy); q.bezierCurveTo(300, 470 + dy, 700, 660 + dy, 1100, 540 + dy); }, c, 12, { group: 'w' + c, maxR: 4, dir: 'edge' });
}

// a wooden desk seen from above, warm lamp light from the upper left (1300 x 2300)
export function tableSet(R, { wood = ['#8a5a3a', '#6a4028', '#4a2c1c'] } = {}) {
  R.fill(P([[0, 0], [1300, 0], [1300, 2300], [0, 2300]]), lin(0, 0, 1300, 2300, [[0, wood[0]], [.55, wood[1]], [1, wood[2]]]), { dir: 8, fallback: 8, group: 'wood', maxR: 44, detail: 1.8 });
  for (let i = 0; i < 26; i++) R.line(q => { const y = i * 92 + 20; q.moveTo(-20, y); q.bezierCurveTo(400, y + 18, 900, y - 14, 1320, y + 10); }, i % 2 ? 'rgba(60,34,20,.5)' : 'rgba(150,100,64,.35)', 6, { group: 'wood', maxR: 4, dir: 'edge' });
  R.fill(c => c.ellipse(260, 260, 620, 560, 0, 0, 7), rad(260, 260, 40, 620, [[0, 'rgba(255,220,150,.42)'], [1, 'rgba(255,220,150,0)']]), { group: 'wood', maxR: 40 });
}
