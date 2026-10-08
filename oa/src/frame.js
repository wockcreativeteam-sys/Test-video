// Per-(sub)frame drawing context shared by every shot.
import { Cam } from './engine/cam.js';
import { Lines } from './engine/lines.js';
import { Splat } from './engine/splat.js';

export class Frame {
  constructor(W, H) {
    this.W = W;
    this.H = H;
    this.base = document.createElement('canvas');
    this.base.width = W;
    this.base.height = H;
    this.glowC = document.createElement('canvas');
    this.glowC.width = W / 2;
    this.glowC.height = H / 2;
    this.ctx = this.base.getContext('2d', { willReadFrequently: true });
    this.g = this.glowC.getContext('2d', { willReadFrequently: true });
    this.cam = new Cam(W, H);
    this.L = new Lines(this);
    this.S = new Splat(W, H);
    this.fx = {};
    this.t = 0;
  }
  begin(t, look) {
    this.t = t;
    this.look = look;
    this.fx = {};
    const c = this.ctx, g = this.g;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.filter = 'none';
    c.clearRect(0, 0, this.W, this.H);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.filter = 'none';
    g.clearRect(0, 0, this.W / 2, this.H / 2);
    g.setTransform(0.5, 0, 0, 0.5, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
  }
}
