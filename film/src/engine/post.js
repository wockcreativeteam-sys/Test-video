// WebGL2 compositor: background field + vector layer + emitter layer -> bloom -> grade ->
// temporal accumulation (motion blur) -> grain/dither -> screen.

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }`;

const PREFILTER = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uGlow, uBase; uniform float uBaseBloom, uThresh;
void main(){
  vec3 g = texture(uGlow, uv).rgb;
  vec4 b = texture(uBase, uv);
  float l = dot(b.rgb, vec3(0.2126,0.7152,0.0722));
  vec3 hb = b.rgb * smoothstep(uThresh, uThresh + 0.25, l) * uBaseBloom;
  o = vec4(g + hb, 1.0);
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

// 3x3 tent upsample + add current level
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

const COMP = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uBase, uGlow, uBloom;
uniform vec3 uBg0, uBg1, uBg2;
uniform vec2 uBgC; uniform float uBgR, uBg2Amt, uAspect, uTime;
uniform float uBloomStr, uGlowStr, uExposure, uCA, uVig, uFadeBlack, uFadeWhite, uSat;
uniform vec3 uVigTint, uBloomTint;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
vec3 softclip(vec3 c){
  vec3 k = vec3(0.82);
  vec3 over = max(c - k, 0.0);
  return min(c, k) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}
void main(){
  vec2 dc = uv - 0.5;
  vec2 d = (uv - uBgC) * vec2(uAspect, 1.0);
  float r = length(d) / uBgR;
  vec3 bg = mix(uBg0, uBg1, smoothstep(0.0, 1.0, r));
  float n = vnoise(uv * vec2(uAspect, 1.0) * 2.2 + vec2(uTime * 0.013, -uTime * 0.009)) - 0.5;
  bg *= 1.0 + n * 0.06;
  bg += uBg2 * uBg2Amt * exp(-r * r * 2.2);
  // uCA = lateral aberration in px at the frame corners (radial, quadratic falloff)
  vec2 ca = dc * (uCA / 960.0) * dot(dc, dc) * 4.0;
  vec4 bR = texture(uBase, uv - ca);
  vec4 bG = texture(uBase, uv);
  vec4 bB = texture(uBase, uv + ca);
  vec3 col = vec3(bR.r + bg.r * (1.0 - bR.a), bG.g + bg.g * (1.0 - bG.a), bB.b + bg.b * (1.0 - bB.a));
  col += texture(uGlow, uv).rgb * uGlowStr;
  col += texture(uBloom, uv).rgb * uBloomStr * uBloomTint;
  col *= uExposure;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  float v = pow(clamp(length(dc * vec2(1.0, 0.82)) * 1.32, 0.0, 1.5), 2.4);
  col = mix(col, col * uVigTint, clamp(uVig * v, 0.0, 1.0));
  col = softclip(col);
  col = mix(col, vec3(0.0), uFadeBlack);
  col = mix(col, vec3(1.0), uFadeWhite);
  o = vec4(col, 1.0);
}`;

// composite + grade + lens + grain in one full-resolution pass
const FUSED = COMP.replace('uniform float uBloomStr', 'uniform float uGrain, uFrame; uniform vec2 uRes;\nuniform float uBloomStr')
  .replace('  o = vec4(col, 1.0);\n}', `  vec2 px = uv * uRes;
  float g = (gh(px + uFrame * 17.13) + gh(px * 1.31 + uFrame * 3.7) - 1.0);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col += g * uGrain * (0.45 + 2.2 * lum * (1.0 - lum));
  col += (gh(px + uFrame) - 0.5) / 255.0;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`)
  .replace('vec3 softclip', 'float gh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\nvec3 softclip');

const ACC = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uSrc; uniform float uW;
void main(){ o = vec4(texture(uSrc, uv).rgb * uW, 1.0); }`;

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
      fused: program(gl, FUSED),
      acc: program(gl, ACC),
    };
    this.texBase = this._tex8();
    this.texGlow = this._tex8();
    // bloom chain at 1/2 .. 1/64
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
  _tex8() {
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
    const t = this._tex8();
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

  /** composite the (already motion-blurred) layers and draw to the screen */
  render(baseCanvas, glowCanvas, L, frame) {
    const gl = this.gl;
    this._upload(this.texBase, baseCanvas);
    this._upload(this.texGlow, glowCanvas);
    gl.disable(gl.BLEND);
    this._draw(this.P.pre, this.down[0], { uGlow: this.texGlow, uBase: this.texBase }, { uBaseBloom: L.baseBloom, uThresh: L.bloomThresh });
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
    this._draw(
      this.P.fused,
      null,
      { uBase: this.texBase, uGlow: this.texGlow, uBloom: this.up[0].t },
      {
        uBg0: L.bg0, uBg1: L.bg1, uBg2: L.bg2, uBgC: [L.bgC[0], 1 - L.bgC[1]], uBgR: L.bgR, uBg2Amt: L.bg2Amt,
        uAspect: this.W / this.H, uTime: L.time,
        uBloomStr: L.bloom, uGlowStr: L.glow, uExposure: L.exposure, uCA: L.ca, uVig: L.vig,
        uFadeBlack: L.fadeBlack, uFadeWhite: L.fadeWhite, uSat: L.sat, uVigTint: L.vigTint, uBloomTint: L.bloomTint,
        uGrain: L.grain, uFrame: frame % 997, uRes: [this.W, this.H],
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
