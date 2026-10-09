// WebGL2 compositor for the da Vinci teaser:
//   background field + 3D scene (R3, premultiplied HDR) + vector layer (Canvas2D) + glow layer
//   + HDR particle film -> displacement (shock ring, flow warp, zoom blur) with chromatic split
//   -> bloom -> grade -> grain/dither -> screen.

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }`;

const PREFILTER = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uGlow, uBase, uPart, uScene; uniform float uBaseBloom, uThresh, uPartBloom, uPartThresh, uSceneBloom, uSceneThresh;
void main(){
  vec3 g = texture(uGlow, uv).rgb;
  vec4 sc = texture(uScene, uv);
  vec3 hs = max(sc.rgb - vec3(uSceneThresh), vec3(0.0)) * uSceneBloom;
  vec4 b = texture(uBase, uv);
  float l = dot(b.rgb, vec3(0.2126,0.7152,0.0722));
  vec3 hb = b.rgb * smoothstep(uThresh, uThresh + 0.25, l) * uBaseBloom;
  vec3 p = texture(uPart, uv).rgb;
  vec3 hp = max(p - vec3(uPartThresh), vec3(0.0)) * uPartBloom;
  o = vec4(g + hb + hp + hs, 1.0);
}`;

// 13-tap downsample (Jimenez 2014)
const DOWN = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uSrc; uniform vec2 uTx;
vec3 s(vec2 d){ return texture(uSrc, uv + d*uTx).rgb; }
void main(){
  vec3 a=s(vec2(-2,2)), b=s(vec2(0,2)), c=s(vec2(2,2));
  vec3 d=s(vec2(-2,0)), e=s(vec2(0,0)), f=s(vec2(2,0));
  vec3 g=s(vec2(-2,-2)), h=s(vec2(0,-2)), i=s(vec2(2,-2));
  vec3 j=s(vec2(-1,1)), k=s(vec2(1,1)), l=s(vec2(-1,-1)), m=s(vec2(1,-1));
  vec3 r = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  o = vec4(r,1.0);
}`;

const UP = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uLow, uCur; uniform vec2 uTx; uniform float uR, uMix;
vec3 s(vec2 d){ return texture(uLow, uv + d*uTx*uR).rgb; }
void main(){
  vec3 r = s(vec2(0,0))*4.0 + (s(vec2(-1,0))+s(vec2(1,0))+s(vec2(0,-1))+s(vec2(0,1)))*2.0
         + s(vec2(-1,-1))+s(vec2(1,-1))+s(vec2(-1,1))+s(vec2(1,1));
  r /= 16.0;
  o = vec4(texture(uCur, uv).rgb + r*uMix, 1.0);
}`;

const ACC = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uSrc; uniform float uW;
void main(){ o = vec4(texture(uSrc, uv).rgb * uW, 1.0); }`;

const FINAL = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uBase, uGlow, uBloom, uPart, uScene;
uniform vec3 uBg0, uBg1, uBg2;
uniform vec2 uBgC, uRes; uniform float uBgR, uBg2Amt, uAspect, uTime, uFrame;
uniform float uBloomStr, uGlowStr, uPartStr, uExposure, uCA, uVig, uFadeBlack, uFadeWhite, uSat, uGrain;
uniform vec3 uVigTint, uBloomTint, uFadeColor; uniform float uFadeCol;
// shock ring: centre (uv), radius & width (in screen heights), amplitude (screen heights), glow
uniform vec2 uRingC; uniform float uRingR, uRingW, uRingA, uRingGlow; uniform vec3 uRingRgb;
// flow warp (px), zoom blur
uniform float uWarp, uWarpS; uniform vec2 uZoomC; uniform float uZoom;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float gh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 softclip(vec3 c){
  vec3 k = vec3(0.8);
  vec3 over = max(c - k, 0.0);
  return min(c, k) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}
// premultiplied vector layer over the field, plus emissive layers
vec3 layers(vec2 u, vec3 bg, int ch){
  vec4 s = texture(uScene, u);
  vec3 c = s.rgb + bg * (1.0 - s.a);
  vec4 b = texture(uBase, u);
  c = b.rgb + c * (1.0 - b.a);
  c += texture(uGlow, u).rgb * uGlowStr;
  c += texture(uPart, u).rgb * uPartStr;
  return c;
}
vec3 sampleAll(vec2 u, vec3 bg, vec2 caOff){
  vec3 r = layers(u - caOff, bg, 0);
  vec3 g = layers(u, bg, 1);
  vec3 b = layers(u + caOff, bg, 2);
  return vec3(r.r, g.g, b.b);
}
void main(){
  vec2 dc = uv - 0.5;
  // ---- displacement field ----
  vec2 off = vec2(0.0);
  float ringE = 0.0;
  if (uRingA != 0.0 || uRingGlow > 0.0) {
    vec2 d = (uv - uRingC) * vec2(uAspect, 1.0);
    float r = length(d);
    float x = (r - uRingR) / max(uRingW, 1e-4);
    ringE = exp(-x * x);
    vec2 dir = d / max(r, 1e-5);
    vec2 o2 = dir * (x * ringE) * uRingA;
    off += o2 / vec2(uAspect, 1.0);
  }
  if (uWarp > 0.0) {
    vec2 q = uv * vec2(uAspect, 1.0) * uWarpS;
    vec2 w = vec2(vnoise(q + vec2(uTime * 0.31, 3.7)), vnoise(q + vec2(-uTime * 0.27, 9.1))) - 0.5;
    off += w * uWarp / uRes;
  }
  vec2 u0 = uv + off;
  // background field (not displaced: it is "space")
  vec2 bd = (uv - uBgC) * vec2(uAspect, 1.0);
  float br = length(bd) / uBgR;
  vec3 bg = mix(uBg0, uBg1, smoothstep(0.0, 1.0, br));
  float n = vnoise(uv * vec2(uAspect, 1.0) * 2.2 + vec2(uTime * 0.013, -uTime * 0.009)) - 0.5;
  bg *= 1.0 + n * 0.08;
  bg += uBg2 * uBg2Amt * exp(-br * br * 2.2);
  // lateral CA grows towards the corners, and inside the shock ring
  vec2 caOff = dc * (uCA / 960.0) * dot(dc, dc) * 4.0 + off * 0.35;
  vec3 col;
  if (uZoom > 0.0005) {
    col = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 8; i++) {
      float f = float(i) / 7.0;
      float s = 1.0 - uZoom * f;
      float w = 1.0 - f * 0.6;
      vec2 uz = uZoomC + (u0 - uZoomC) * s;
      col += sampleAll(uz, bg, caOff) * w;
      wsum += w;
    }
    col /= wsum;
  } else {
    col = sampleAll(u0, bg, caOff);
  }
  col += texture(uBloom, u0).rgb * uBloomStr * uBloomTint;
  col += uRingRgb * ringE * uRingGlow;
  col *= uExposure;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  float v = pow(clamp(length(dc * vec2(1.0, 0.82)) * 1.32, 0.0, 1.5), 2.4);
  col = mix(col, col * uVigTint, clamp(uVig * v, 0.0, 1.0));
  col = softclip(col);
  col = mix(col, uFadeColor, uFadeCol);
  col = mix(col, vec3(0.0), uFadeBlack);
  col = mix(col, vec3(1.0), uFadeWhite);
  vec2 px = uv * uRes;
  float g = (gh(px + uFrame * 17.13) + gh(px * 1.31 + uFrame * 3.7) - 1.0);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col += g * uGrain * (0.45 + 2.2 * lum * (1.0 - lum));
  col += (gh(px + uFrame) - 0.5) / 255.0;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
  return s;
}
function program(gl, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'p');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

export class Post {
  constructor(canvas, W, H) {
    this.W = W;
    this.H = H;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.P = {
      pre: program(gl, PREFILTER),
      down: program(gl, DOWN),
      up: program(gl, UP),
      fin: program(gl, FINAL),
      acc: program(gl, ACC),
    };
    this.texBase = this._tex();
    this.texGlow = this._tex();
    this.texPart = this._tex();
    gl.bindTexture(gl.TEXTURE_2D, this.texPart);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB32F, W, H, 0, gl.RGB, gl.FLOAT, null);
    this.blank = this._tex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    this.down = [];
    this.up = [];
    let w = W >> 1, h = H >> 1;
    for (let i = 0; i < 6; i++) {
      this.down.push(this._rt(w, h));
      this.up.push(this._rt(w, h));
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }
  }
  _tex() {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  _rt(w, h) {
    const gl = this.gl;
    const t = this._tex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, fb, w, h };
  }
  _upload(tex, canvas) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }
  _uploadPart(buf) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texPart);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.W, this.H, gl.RGB, gl.FLOAT, buf);
  }
  _draw(prog, target, binds, uni) {
    const gl = this.gl;
    gl.useProgram(prog.p);
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.W, this.H);
    }
    let unit = 0;
    for (const [name, tex] of Object.entries(binds)) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(prog.u[name], unit);
      unit++;
    }
    for (const [name, v] of Object.entries(uni)) {
      const loc = prog.u[name];
      if (loc == null) continue;
      if (typeof v === 'number') gl.uniform1f(loc, v);
      else if (v.length === 2) gl.uniform2fv(loc, v);
      else if (v.length === 3) gl.uniform3fv(loc, v);
    }
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** composite layers + the particle film and draw to the screen. fx: per-frame effect state */
  render(baseCanvas, glowCanvas, partBuf, L, fx, frame, sceneTex) {
    const scene = sceneTex || this.blank;
    const gl = this.gl;
    this._upload(this.texBase, baseCanvas);
    this._upload(this.texGlow, glowCanvas);
    this._uploadPart(partBuf);
    gl.disable(gl.BLEND);
    this._draw(this.P.pre, this.down[0], { uGlow: this.texGlow, uBase: this.texBase, uPart: this.texPart, uScene: scene }, {
      uBaseBloom: L.baseBloom, uThresh: L.bloomThresh, uPartBloom: L.partBloom, uPartThresh: L.partThresh,
      uSceneBloom: L.sceneBloom ?? 0.6, uSceneThresh: L.sceneThresh ?? 0.85,
    });
    for (let i = 1; i < this.down.length; i++) {
      const s = this.down[i - 1];
      this._draw(this.P.down, this.down[i], { uSrc: s.t }, { uTx: [1 / s.w, 1 / s.h] });
    }
    const last = this.down.length - 1;
    this._draw(this.P.acc, this.up[last], { uSrc: this.down[last].t }, { uW: 1 });
    for (let i = last - 1; i >= 0; i--) {
      const low = this.up[i + 1];
      this._draw(this.P.up, this.up[i], { uLow: low.t, uCur: this.down[i].t }, { uTx: [1 / low.w, 1 / low.h], uR: 1.0, uMix: L.bloomSpread });
    }
    const ring = fx.ring || { c: [0.5, 0.5], r: 0, w: 0.05, a: 0, glow: 0, rgb: [0, 0, 0] };
    this._draw(
      this.P.fin,
      null,
      { uBase: this.texBase, uGlow: this.texGlow, uBloom: this.up[0].t, uPart: this.texPart, uScene: scene },
      {
        uBg0: L.bg0, uBg1: L.bg1, uBg2: L.bg2, uBgC: [L.bgC[0], 1 - L.bgC[1]], uBgR: L.bgR, uBg2Amt: L.bg2Amt,
        uAspect: this.W / this.H, uTime: L.time, uRes: [this.W, this.H], uFrame: frame % 997,
        uBloomStr: L.bloom, uGlowStr: L.glow, uPartStr: L.part, uExposure: L.exposure * (fx.exposure ?? 1), uCA: L.ca + (fx.ca || 0),
        uVig: L.vig, uFadeBlack: Math.max(L.fadeBlack, fx.fadeBlack || 0), uFadeWhite: L.fadeWhite, uSat: L.sat, uVigTint: L.vigTint,
        uBloomTint: L.bloomTint, uGrain: L.grain, uFadeColor: fx.fadeColor || [0, 0, 0], uFadeCol: fx.fadeCol || 0,
        uRingC: [ring.c[0], 1 - ring.c[1]], uRingR: ring.r, uRingW: ring.w, uRingA: ring.a, uRingGlow: ring.glow, uRingRgb: ring.rgb,
        uWarp: fx.warp || 0, uWarpS: fx.warpS || 3, uZoomC: fx.zoomC ? [fx.zoomC[0], 1 - fx.zoomC[1]] : [0.5, 0.5], uZoom: fx.zoom || 0,
      }
    );
  }

  read(buf) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf;
  }
}
