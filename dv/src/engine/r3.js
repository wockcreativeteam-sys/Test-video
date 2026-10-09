// R3 — a small deferred-free WebGL2 product renderer for the da Vinci teaser.
//   * meshes from geo.js (pos + normal), drawn with per-draw matrices and materials
//   * GGX specular + a procedural studio environment (softbox strips) for glossy reflections
//   * key-light shadow map + a soft overhead "sky" occlusion map (contact shadows / AO)
//   * planar floor reflection (half-res mirrored pass, blurred by roughness)
//   * scan reveal: a clip plane with an emissive band; hologram (fresnel) + wire + beams
//   * MSAA x4 into an HDR target; sub-frame accumulation for motion blur
// The camera is the film's Cam (same projection as the 2D layers, incl. mirror and shift).
import { m4 } from './m4.js';

const VS = `#version 300 es
invariant gl_Position;
layout(location=0) in vec3 aP;
layout(location=1) in vec3 aN;
uniform mat4 uM;
uniform vec3 uCamPos, uCR, uCU, uCF;
uniform vec4 uProj; // sx, sy, ox, oy
uniform vec2 uNF;
uniform float uMirrorY;
out vec3 vP; out vec3 vN; out vec3 vO;
void main(){
  vec4 wp = uM * vec4(aP, 1.0);
  vP = wp.xyz;
  vO = aP;
  vN = mat3(uM) * aN;
  vec3 p = wp.xyz; p.y *= uMirrorY;
  vec3 d = p - uCamPos;
  float xc = dot(d, uCR), yc = dot(d, uCU), zc = dot(d, uCF);
  gl_Position = vec4(xc * uProj.x + uProj.z * zc, yc * uProj.y + uProj.w * zc, uNF.x * zc + uNF.y, zc);
}`;

const VS_DEPTH = `#version 300 es
layout(location=0) in vec3 aP;
uniform mat4 uM; uniform mat4 uL;
void main(){ gl_Position = uL * (uM * vec4(aP, 1.0)); }`;
const FS_DEPTH = `#version 300 es
precision mediump float; void main(){}`;

const POISSON = `const vec2 PD[4] = vec2[4](vec2(-0.7, -0.25), vec2(0.25, -0.7), vec2(0.7, 0.25), vec2(-0.25, 0.7));`;

const FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vP; in vec3 vN; in vec3 vO;
layout(location=0) out vec4 oC;
uniform vec3 uEye;
uniform vec3 uAlb; uniform float uRough, uMetal, uF0, uCoat; uniform vec3 uEmis;
uniform vec3 uLd[3]; uniform vec3 uLc[3];
uniform sampler2DShadow uSh0; uniform mat4 uShM0; uniform float uShR0;
uniform sampler2DShadow uSh1; uniform mat4 uShM1; uniform float uShR1; uniform float uSkyAO;
uniform samplerCube uEnv;
uniform vec3 uSky, uGround, uHorizon; uniform float uAmb;
uniform vec3 uFogC; uniform float uFogD, uFogH;
uniform float uIsFloor; uniform sampler2D uRefl; uniform vec2 uRes; uniform float uReflStr, uReflBlur, uReflOn, uFloorEnv;
uniform vec4 uClip; uniform float uClipOn, uBandW; uniform vec3 uBandC;
uniform vec4 uPL[2]; uniform vec3 uPLc[2];
uniform float uExpo, uRefPass;
uniform vec4 uStripe;
uniform vec4 uGrid; uniform vec3 uGridC;
${POISSON}
float shadowK(sampler2DShadow sm, mat4 M, vec3 p, vec3 n, float rad, float bias){
  vec4 q = M * vec4(p + n * bias * 4.0, 1.0);
  vec3 c = q.xyz * 0.5 + 0.5;
  if (c.x < 0.0 || c.y < 0.0 || c.x > 1.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float s = texture(sm, vec3(c.xy + PD[0] * rad, c.z - bias));
  s += texture(sm, vec3(c.xy + PD[1] * rad, c.z - bias));
  s += texture(sm, vec3(c.xy + PD[2] * rad, c.z - bias));
  s += texture(sm, vec3(c.xy + PD[3] * rad, c.z - bias));
  return s * 0.25;
}
vec3 tone(vec3 x){
  x = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  return sqrt(x) * 0.6 + x * 0.4 * (1.25 - 0.25 * x); // ~gamma 2.2
}
void main(){
  float cd = dot(vP, uClip.xyz) + uClip.w;
#ifdef CLIP
  if (cd > 0.0) discard;
#endif
  vec3 N = normalize(vN);
  vec3 V = normalize(uEye - vP);
  float dist = length(uEye - vP);
  float fog = clamp(1.0 - exp(-dist * uFogD * exp(-max(vP.y, 0.0) * uFogH)), 0.0, 1.0);
  vec3 emis = uEmis;
  vec3 col;
  if (uIsFloor > 0.5) {
    // ---- floor: planar reflection + contact shadows + grid ----
    float sh0 = uShR0 > 0.0 ? shadowK(uSh0, uShM0, vP, N, uShR0, 0.0012) : 1.0;
    float sky = uShR1 > 0.0 ? mix(1.0, shadowK(uSh1, uShM1, vP, N, uShR1, 0.004), uSkyAO) : 1.0;
    float NoV = max(V.y, 1e-3);
    float Fr = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
    vec3 R = reflect(-V, N);
    vec3 refl = textureLod(uEnv, R, 1.5).rgb * uFloorEnv;
    if (uReflOn > 0.5) {
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 o = uReflBlur / uRes;
      vec3 r = texture(uRefl, uv + PD[0] * o).rgb + texture(uRefl, uv + PD[1] * o).rgb + texture(uRefl, uv + PD[2] * o).rgb + texture(uRefl, uv + PD[3] * o).rgb;
      refl += r * 0.25 * uReflStr;
    }
    vec3 L = uLd[0];
    float NoL = max(dot(N, L), 0.0);
    col = uAlb * (uLc[0] * NoL * sh0 + (uSky * 2.0 + uLc[1] * 0.3) * sky) + refl * mix(0.35, 1.0, Fr * 4.0) * mix(0.5, 1.0, sky);
    for (int i = 0; i < 2; i++) {
      vec3 d = uPL[i].xyz - vP;
      float r2 = dot(d, d);
      col += uAlb * uPLc[i] * max(dot(N, d) * inversesqrt(r2), 0.0) / (1.0 + r2 / (uPL[i].w * uPL[i].w));
    }
    if (uGrid.x > 0.0) {
      vec2 gp = vP.xz / uGrid.x;
      vec2 fw = fwidth(gp);
      vec2 gl = abs(fract(gp - 0.5) - 0.5) / max(fw, vec2(1e-4));
      float line = 1.0 - min(min(gl.x, gl.y) / max(uGrid.y, 0.5), 1.0);
      emis += uGridC * line * uGrid.z * exp(-length(vP.xz) * uGrid.w);
    }
  } else {
    // ---- objects ----
#ifdef CHEAP
    col = uAlb * (0.5 + 0.5 * N.y);
#else
#ifdef NOSH
    float sh0 = 1.0, sky = 1.0;
#else
    float sh0 = uShR0 > 0.0 ? shadowK(uSh0, uShM0, vP, N, uShR0, 0.0012) : 1.0;
    float sky = uShR1 > 0.0 ? mix(1.0, shadowK(uSh1, uShM1, vP, N, uShR1, 0.004), uSkyAO) : 1.0;
#endif
    float NoV = max(dot(N, V), 1e-4);
    vec3 alb = uAlb;
    if (uStripe.w > 0.0) {
      float st = dot(vO, uStripe.xyz) / uStripe.w;
      float f = abs(fract(st) - 0.5) * 2.0;
      alb *= mix(1.0, 0.35, 1.0 - smoothstep(0.0, fwidth(st) * 1.5 + 0.02, 1.0 - f));
    }
    float rough = clamp(uRough, 0.05, 1.0);
    float a = rough * rough;
    float a2 = a * a;
    vec3 f0 = mix(vec3(uF0), alb, uMetal);
    vec3 dif = alb * (1.0 - uMetal);
    col = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      vec3 L = uLd[i];
      float NoL = dot(N, L);
      if (NoL <= 0.0) continue;
      vec3 H = normalize(L + V);
      float NoH = max(dot(N, H), 0.0), LoH = max(dot(L, H), 0.05);
      float dd = NoH * NoH * (a2 - 1.0) + 1.0;
      float D = a2 / (3.14159 * dd * dd);
      float fw = 1.0 - LoH; float fw2 = fw * fw;
      vec3 F = f0 + (1.0 - f0) * (fw2 * fw2 * fw);
      float sh = i == 0 ? sh0 : mix(1.0, sky, 0.6);
      col += (dif * 0.31831 + F * (D * 0.25 / (LoH * LoH))) * uLc[i] * (NoL * sh * 3.14159);
    }
    for (int i = 0; i < 2; i++) {
      vec3 d = uPL[i].xyz - vP;
      float r2 = dot(d, d);
      col += dif * uPLc[i] * max(dot(N, d) * inversesqrt(r2), 0.0) / (1.0 + r2 / (uPL[i].w * uPL[i].w));
    }
    // ambient: the most blurred level of the studio environment
    vec3 amb = textureLod(uEnv, N, 5.0).rgb * 1.6;
    col += dif * amb * (uAmb * sky);
    vec3 R = reflect(-V, N);
    vec3 e1 = textureLod(uEnv, R, rough * 5.0).rgb;
    vec3 e2 = textureLod(uEnv, R, 0.35).rgb;
    float fv = 1.0 - NoV; float fv2 = fv * fv;
    float fr5 = fv2 * fv2 * fv;
    vec3 Fe = f0 + (max(vec3(1.0 - rough), f0) - f0) * fr5;
    float specOcc = mix(sky, 1.0, 0.35) * mix(0.55, 1.0, sh0);
    col += e1 * Fe * specOcc;
    col += e2 * ((0.04 + 0.96 * fr5) * uCoat * specOcc);
#endif
  }
  col = mix(col, uFogC, fog);
  col = tone(col * uExpo);
#ifdef CLIP
  emis += uBandC * exp(-(cd * cd) / max(uBandW * uBandW, 1e-8));
#endif
  col += emis * (1.0 - fog * 0.6);
  oC = vec4(col, 1.0);
}`;

// studio environment baked into a cube map, one mip level per roughness
const FS_ENV = `#version 300 es
precision highp float;
out vec4 o;
uniform vec4 uBoxD[6]; uniform vec4 uBoxT[6]; uniform vec4 uBoxB[6]; uniform vec3 uBoxC[6];
uniform vec3 uSky, uGround, uHorizon; uniform float uRoughL, uSize; uniform int uFace;
vec3 skyGrad(vec3 R){
  return mix(uGround, uSky, clamp(R.y * 1.25 + 0.375, 0.0, 1.0)) + uHorizon * max(1.0 - abs(R.y) * 6.0, 0.0);
}
void main(){
  vec2 st = gl_FragCoord.xy / uSize * 2.0 - 1.0;
  float sc = st.x, tc = st.y;
  vec3 d;
  if (uFace == 0) d = vec3(1.0, -tc, -sc);
  else if (uFace == 1) d = vec3(-1.0, -tc, sc);
  else if (uFace == 2) d = vec3(sc, 1.0, tc);
  else if (uFace == 3) d = vec3(sc, -1.0, -tc);
  else if (uFace == 4) d = vec3(sc, -tc, 1.0);
  else d = vec3(-sc, -tc, -1.0);
  vec3 R = normalize(d);
  float rough = uRoughL;
  float s1 = 0.02 + rough * rough * 1.4;
  float k1 = 1.0 / (1.0 + rough * rough * 5.0);
  vec3 c = skyGrad(R);
  for (int i = 0; i < 6; i++) {
    float z = dot(R, uBoxD[i].xyz);
    float iz = 1.0 / max(z, 0.02);
    float x = abs(dot(R, uBoxT[i].xyz)) * iz, y = abs(dot(R, uBoxB[i].xyz)) * iz;
    float on = smoothstep(-0.05 - rough * 0.5, 0.05, z);
    vec2 dd = vec2(uBoxT[i].w - x, uBoxB[i].w - y);
    vec2 m = clamp(dd / s1 + 0.5, 0.0, 1.0);
    c += uBoxC[i] * (m.x * m.y * on * k1);
  }
  o = vec4(c, 1.0);
}`;

// hologram: additive fresnel shell for parts that are not built yet (or ghosts)
const FS_HOLO = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; in vec3 vO;
layout(location=0) out vec4 oC;
uniform vec3 uEye, uHoloC; uniform float uHoloA, uTime, uLineF;
uniform vec4 uClip; uniform float uClipOn;
void main(){
  float cd = dot(vP, uClip.xyz) + uClip.w;
  if (uClipOn > 0.5 && cd <= 0.0) discard;
  vec3 N = normalize(vN);
#ifdef SIMPLE
  oC = vec4(uAlb * (0.5 + 0.5 * N.y), 1.0); return;
#endif
  vec3 V = normalize(uEye - vP);
  float fr = pow(1.0 - abs(dot(N, V)), 2.2);
  float scan = 0.7 + 0.3 * sin(vP.y * uLineF - uTime * 9.0);
  vec3 c = uHoloC * (0.05 + fr * 0.9) * scan * uHoloA;
  oC = vec4(c, 0.0);
}`;

const VS_LINE = `#version 300 es
layout(location=0) in vec3 aP;
uniform mat4 uM;
uniform vec3 uCamPos, uCR, uCU, uCF;
uniform vec4 uProj; uniform vec2 uNF;
out vec3 vP;
void main(){
  vec4 wp = uM * vec4(aP, 1.0);
  vP = wp.xyz;
  vec3 d = wp.xyz - uCamPos;
  float xc = dot(d, uCR), yc = dot(d, uCU), zc = dot(d, uCF);
  gl_Position = vec4(xc * uProj.x + uProj.z * zc, yc * uProj.y + uProj.w * zc, uNF.x * zc + uNF.y - 0.0004 * zc, zc);
}`;
const FS_LINE = `#version 300 es
precision highp float;
in vec3 vP;
layout(location=0) out vec4 oC;
uniform vec3 uC; uniform float uA;
uniform vec4 uClip; uniform float uClipOn;
void main(){
  float cd = dot(vP, uClip.xyz) + uClip.w;
  if (uClipOn > 0.5 && cd > 0.0) discard;
  oC = vec4(uC * uA, 0.0);
}`;

// camera-facing glowing ribbons (lasers, light shafts): per-vertex across-coordinate in aN.x
const VS_BEAM = `#version 300 es
layout(location=0) in vec3 aP;
layout(location=1) in vec3 aN; // x: across (-1..1), y: along (0..1), z: alpha
uniform vec3 uCamPos, uCR, uCU, uCF;
uniform vec4 uProj; uniform vec2 uNF;
out vec3 vA;
void main(){
  vA = aN;
  vec3 d = aP - uCamPos;
  float xc = dot(d, uCR), yc = dot(d, uCU), zc = dot(d, uCF);
  gl_Position = vec4(xc * uProj.x + uProj.z * zc, yc * uProj.y + uProj.w * zc, uNF.x * zc + uNF.y, zc);
}`;
const FS_BEAM = `#version 300 es
precision highp float;
in vec3 vA;
layout(location=0) out vec4 oC;
uniform vec3 uC; uniform float uCore;
void main(){
  float x = vA.x;
  float g = exp(-x * x * 4.0) * 0.6 + exp(-x * x * 60.0) * uCore;
  oC = vec4(uC * g * vA.z, 0.0);
}`;

// textured decal quads (labels on the machine), premultiplied alpha
const VS_DECAL = `#version 300 es
layout(location=0) in vec3 aP;
layout(location=1) in vec3 aN; // uv in xy
uniform mat4 uM;
uniform vec3 uCamPos, uCR, uCU, uCF;
uniform vec4 uProj; uniform vec2 uNF;
out vec2 vUV; out vec3 vP;
void main(){
  vUV = aN.xy;
  vec4 wp = uM * vec4(aP, 1.0);
  vP = wp.xyz;
  vec3 d = wp.xyz - uCamPos;
  float xc = dot(d, uCR), yc = dot(d, uCU), zc = dot(d, uCF);
  gl_Position = vec4(xc * uProj.x + uProj.z * zc, yc * uProj.y + uProj.w * zc, uNF.x * zc + uNF.y - 0.0002 * zc, zc);
}`;
const FS_DECAL = `#version 300 es
precision highp float;
in vec2 vUV; in vec3 vP;
layout(location=0) out vec4 oC;
uniform sampler2D uTex; uniform vec4 uTint; uniform vec3 uGlow;
uniform vec4 uClip; uniform float uClipOn;
void main(){
  float cd = dot(vP, uClip.xyz) + uClip.w;
  if (uClipOn > 0.5 && cd > 0.0) discard;
  vec4 t = texture(uTex, vUV);
  float a = t.a * uTint.a;
  oC = vec4(uTint.rgb * a + uGlow * a, a);
}`;

const VS_FS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS_ACC = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D uSrc; uniform float uW;
void main(){ o = texture(uSrc, uv) * uW; }`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => i + 1 + ': ' + l).join('\n'));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'p');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

// default material
export const MAT = {
  white: { alb: [0.82, 0.83, 0.84], rough: 0.32, metal: 0, f0: 0.04, coat: 0.5 },
  grey: { alb: [0.5, 0.52, 0.55], rough: 0.4, metal: 0, f0: 0.04, coat: 0.3 },
  black: { alb: [0.022, 0.022, 0.024], rough: 0.36, metal: 0, f0: 0.045, coat: 0.45 },
  satin: { alb: [0.03, 0.03, 0.032], rough: 0.55, metal: 0, f0: 0.04, coat: 0.15 },
  rubber: { alb: [0.018, 0.018, 0.02], rough: 0.85, metal: 0, f0: 0.03, coat: 0 },
  steel: { alb: [0.78, 0.8, 0.83], rough: 0.24, metal: 1, f0: 0.04, coat: 0 },
  chrome: { alb: [0.9, 0.92, 0.95], rough: 0.08, metal: 1, f0: 0.04, coat: 0 },
  gunmetal: { alb: [0.2, 0.21, 0.23], rough: 0.35, metal: 1, f0: 0.04, coat: 0 },
  graphite: { alb: [0.07, 0.075, 0.085], rough: 0.42, metal: 0, f0: 0.045, coat: 0.35 },
  glass: { alb: [0.01, 0.012, 0.016], rough: 0.05, metal: 0, f0: 0.06, coat: 1 },
};

export class R3 {
  constructor(gl, W, H, o = {}) {
    this.gl = gl;
    this.W = W;
    this.H = H;
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.P = {
      main: program(gl, VS, o.fsDefs ? FS.replace('#version 300 es', '#version 300 es\n' + o.fsDefs) : FS),
      mainClip: program(gl, VS, FS.replace('#version 300 es', '#version 300 es\n#define CLIP\n' + (o.fsDefs || ''))),
      holo: program(gl, VS, FS_HOLO),
      depth: program(gl, VS_DEPTH, FS_DEPTH),
      zpre: program(gl, VS, FS_DEPTH),
      line: program(gl, VS_LINE, FS_LINE),
      beam: program(gl, VS_BEAM, FS_BEAM),
      decal: program(gl, VS_DECAL, FS_DECAL),
      acc: program(gl, VS_FS, FS_ACC),
      env: program(gl, VS_FS, FS_ENV),
    };
    // fullscreen triangle
    this.fsVao = gl.createVertexArray();
    gl.bindVertexArray(this.fsVao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    // targets
    const samples = Math.min(o.samples ?? 4, gl.getParameter(gl.MAX_SAMPLES));
    this.samples = samples;
    this.ms = this._msTarget(W, H, samples);
    this.res = this._texTarget(W, H, false);
    this.acc = this._texTarget(W, H, false);
    this.refl = this._texTarget(W >> 2, H >> 2, true);
    this.sh0 = this._shadowTarget(o.shadowSize ?? 2048);
    this.sh1 = this._shadowTarget(1024);
    // dynamic beam buffer
    this.beamVao = gl.createVertexArray();
    this.beamBuf = gl.createBuffer();
    gl.bindVertexArray(this.beamVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.beamBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(null);
    this.envSize = 128;
    this.envLevels = 6;
    this.envTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.envTex);
    gl.texStorage2D(gl.TEXTURE_CUBE_MAP, this.envLevels, gl.RGBA16F, this.envSize, this.envSize);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.envFb = gl.createFramebuffer();
    this.envKey = '';
    this.dummy = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.dummy);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    this.queue = [];
    this.scene = null;
    this.out = this.res.tex;
  }
  _tex(w, h, fmt, type, filter) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  _msTarget(w, h, samples) {
    const gl = this.gl;
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const c = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, c);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA16F, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c);
    const d = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, d);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('ms fbo incomplete ' + st);
    return { fb, w, h };
  }
  _texTarget(w, h, depth) {
    const gl = this.gl;
    const tex = this._tex(w, h, gl.RGBA16F, gl.HALF_FLOAT, gl.LINEAR);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (depth) {
      const d = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, d);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
    }
    return { fb, tex, w, h };
  }
  _shadowTarget(S) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, S, S);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    return { fb, tex, S };
  }

  /** upload a Geo -> mesh handle (triangles + wire lines) */
  mesh(g) {
    const gl = this.gl;
    const nv = g.P.length / 3;
    const data = new Float32Array(nv * 6);
    for (let i = 0; i < nv; i++) {
      data[i * 6] = g.P[i * 3];
      data[i * 6 + 1] = g.P[i * 3 + 1];
      data[i * 6 + 2] = g.P[i * 3 + 2];
      data[i * 6 + 3] = g.N[i * 3];
      data[i * 6 + 4] = g.N[i * 3 + 1];
      data[i * 6 + 5] = g.N[i * 3 + 2];
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(g.I), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    const m = { vao, n: g.I.length, geo: g, wire: null };
    if (g.L.length) {
      const wv = gl.createVertexArray();
      gl.bindVertexArray(wv);
      const lb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, lb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.L), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      m.wire = { vao: wv, n: g.L.length / 3 };
    }
    return m;
  }
  /** a textured quad (decal) from a canvas: size in world units, centred, in the local xy plane facing +z */
  decal(canvas, w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const data = new Float32Array([
      -w / 2, -h / 2, 0, 0, 0, 0,
      w / 2, -h / 2, 0, 1, 0, 0,
      w / 2, h / 2, 0, 1, 1, 0,
      -w / 2, h / 2, 0, 0, 1, 0,
    ]);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, n: 6, tex };
  }

  // ---- per (sub)frame queue -----------------------------------------------------------------------
  begin(scene) {
    this.queue.length = 0;
    this.holo = [];
    this.wires = [];
    this.beams = [];
    this.decals = [];
    this.scene = scene;
  }
  /** opaque draw. mat: {alb, rough, metal, f0, coat, emis, stripe, grid, floor, clip, noShadow} */
  add(mesh, M, mat) {
    this.queue.push({ mesh, M, mat });
  }
  addHolo(mesh, M, o) {
    this.holo.push({ mesh, M, o });
  }
  addWire(mesh, M, o) {
    if (mesh.wire) this.wires.push({ mesh, M, o });
  }
  addDecal(d, M, o) {
    this.decals.push({ d, M, o });
  }
  /** camera-facing beam from a to b, width in world units (w0 at a, w1 at b), rgb, alpha */
  addBeam(a, b, w0, w1, rgb, alpha = 1, core = 1) {
    this.beams.push({ a, b, w0, w1, rgb, alpha, core });
  }

  _camUniforms(prog, cam, mirrorY = 1) {
    const gl = this.gl, u = prog.u;
    const W = this.W, H = this.H;
    const sx = (cam.focal / (W / 2)) * (cam.mirror ? -1 : 1);
    const sy = cam.focal / (H / 2);
    const ox = cam.shift[0] / (W / 2), oy = -cam.shift[1] / (H / 2);
    const n = Math.max(0.01, this.scene.near ?? 0.02), f = this.scene.far ?? 300;
    gl.uniform3fv(u.uCamPos, cam.pos);
    gl.uniform3fv(u.uCR, cam.r);
    gl.uniform3fv(u.uCU, cam.u);
    gl.uniform3fv(u.uCF, cam.f);
    gl.uniform4f(u.uProj, sx, sy, ox, oy);
    gl.uniform2f(u.uNF, (f + n) / (f - n), (-2 * f * n) / (f - n));
    if (u.uMirrorY) gl.uniform1f(u.uMirrorY, mirrorY);
  }
  _sceneUniforms(prog, cam, refPass) {
    const gl = this.gl, u = prog.u, S = this.scene;
    const eye = refPass ? [cam.pos[0], -cam.pos[1], cam.pos[2]] : cam.pos;
    gl.uniform3fv(u.uEye, eye);
    const L = S.lights || [];
    const ld = new Float32Array(9), lc = new Float32Array(9);
    for (let i = 0; i < 3; i++) {
      const l = L[i] || { dir: [0, 1, 0], rgb: [0, 0, 0] };
      ld.set(nrm(l.dir), i * 3);
      lc.set(l.rgb, i * 3);
    }
    gl.uniform3fv(u.uLd, ld);
    gl.uniform3fv(u.uLc, lc);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.envTex);
    gl.uniform1i(u.uEnv, 4);
    gl.uniform3fv(u.uSky, S.sky || [0.02, 0.02, 0.025]);
    gl.uniform3fv(u.uGround, S.ground || [0.005, 0.005, 0.006]);
    gl.uniform3fv(u.uHorizon, S.horizon || [0, 0, 0]);
    gl.uniform1f(u.uAmb, S.amb ?? 1);
    gl.uniform3fv(u.uFogC, S.fogRgb || [0, 0, 0]);
    gl.uniform1f(u.uFogD, S.fog ?? 0);
    gl.uniform1f(u.uFogH, S.fogH ?? 0);
    gl.uniform1f(u.uExpo, S.exposure ?? 1);
    gl.uniform1f(u.uRefPass, refPass ? 1 : 0);
    gl.uniform2f(u.uRes, this.W, this.H);
    const PL = (S.points || []).slice(0, 2);
    const pl = new Float32Array(8), plc = new Float32Array(6);
    PL.forEach((p, i) => {
      pl.set([...p.pos, p.r ?? 0.5], i * 4);
      plc.set(p.rgb, i * 3);
    });
    gl.uniform4fv(u.uPL, pl);
    gl.uniform3fv(u.uPLc, plc);
    // shadows
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.sh0.tex);
    gl.uniform1i(u.uSh0, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.sh1.tex);
    gl.uniform1i(u.uSh1, 2);
    const k = S.key;
    gl.uniformMatrix4fv(u.uShM0, false, this._shM0 || m4.ident());
    gl.uniform1f(u.uShR0, k && k.shadow ? (k.soft ?? 1.5) / this.sh0.S : 0);
    gl.uniformMatrix4fv(u.uShM1, false, this._shM1 || m4.ident());
    gl.uniform1f(u.uShR1, S.skyAO ? S.skyAO.radius / (2 * S.skyAO.ext) : 0);
    gl.uniform1f(u.uSkyAO, S.skyAO ? S.skyAO.amount ?? 0.85 : 0);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, refPass ? this.dummy : this.refl.tex);
    gl.uniform1i(u.uRefl, 3);
    gl.uniform1f(u.uReflOn, refPass ? 0 : S.reflect ? 1 : 0);
  }
  _matUniforms(prog, m) {
    const gl = this.gl, u = prog.u;
    gl.uniform3fv(u.uAlb, m.alb || [0.8, 0.8, 0.8]);
    gl.uniform1f(u.uRough, m.rough ?? 0.5);
    gl.uniform1f(u.uMetal, m.metal ?? 0);
    gl.uniform1f(u.uF0, m.f0 ?? 0.04);
    gl.uniform1f(u.uCoat, m.coat ?? 0);
    gl.uniform3fv(u.uEmis, m.emis || [0, 0, 0]);
    gl.uniform4fv(u.uStripe, m.stripe || [0, 0, 0, 0]);
    gl.uniform4fv(u.uGrid, m.grid || [0, 0, 0, 0]);
    gl.uniform3fv(u.uGridC, m.gridRgb || [0, 0, 0]);
    gl.uniform1f(u.uIsFloor, m.floor ? 1 : 0);
    gl.uniform1f(u.uReflStr, m.reflStr ?? 1);
    gl.uniform1f(u.uReflBlur, m.reflBlur ?? 6);
    gl.uniform1f(u.uFloorEnv, m.floorEnv ?? 0.3);
    this._clipUniforms(prog, m.clip);
  }
  _clipUniforms(prog, c) {
    const gl = this.gl, u = prog.u;
    if (c) {
      gl.uniform4fv(u.uClip, c.plane);
      gl.uniform1f(u.uClipOn, 1);
      if (u.uBandW) gl.uniform1f(u.uBandW, c.band ?? 0.01);
      if (u.uBandC) gl.uniform3fv(u.uBandC, c.rgb || [0, 0, 0]);
    } else {
      gl.uniform4f(u.uClip, 0, 0, 0, 0);
      gl.uniform1f(u.uClipOn, 0);
    }
  }

  _bakeEnv() {
    const gl = this.gl, S = this.scene;
    const key = JSON.stringify([S.boxes, S.sky, S.ground, S.horizon]);
    if (key === this.envKey) return;
    this.envKey = key;
    const P = this.P.env, u = P.u;
    gl.useProgram(P.p);
    const B = S.boxes || [];
    const bd = new Float32Array(24), bt = new Float32Array(24), bb = new Float32Array(24), bc = new Float32Array(18);
    B.slice(0, 6).forEach((b, i) => {
      const d = nrm(b.dir);
      let t = nrm(cross(d, b.up || [0, 1, 0]));
      if (!isFinite(t[0]) || Math.hypot(...t) < 0.5) t = [1, 0, 0];
      const bi = nrm(cross(t, d));
      bd.set([...d, 0], i * 4);
      bt.set([...t, b.size[0]], i * 4);
      bb.set([...bi, b.size[1]], i * 4);
      bc.set(b.rgb, i * 3);
    });
    gl.uniform4fv(u.uBoxD, bd);
    gl.uniform4fv(u.uBoxT, bt);
    gl.uniform4fv(u.uBoxB, bb);
    gl.uniform3fv(u.uBoxC, bc);
    gl.uniform3fv(u.uSky, S.sky || [0.02, 0.02, 0.025]);
    gl.uniform3fv(u.uGround, S.ground || [0.005, 0.005, 0.006]);
    gl.uniform3fv(u.uHorizon, S.horizon || [0, 0, 0]);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.envFb);
    gl.bindVertexArray(this.fsVao);
    for (let l = 0; l < this.envLevels; l++) {
      const sz = this.envSize >> l;
      gl.viewport(0, 0, sz, sz);
      gl.uniform1f(u.uSize, sz);
      gl.uniform1f(u.uRoughL, l / (this.envLevels - 1));
      for (let f = 0; f < 6; f++) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, this.envTex, l);
        gl.uniform1i(u.uFace, f);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    gl.bindVertexArray(null);
  }

  _shadowPass(target, LM) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
    gl.viewport(0, 0, target.S, target.S);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.5, 3);
    const P = this.P.depth;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uL, false, LM);
    for (const d of this.queue) {
      if (d.mat.floor || d.mat.noShadow) continue;
      gl.uniformMatrix4fv(P.u.uM, false, d.M);
      gl.bindVertexArray(d.mesh.vao);
      gl.drawElements(gl.TRIANGLES, d.mesh.n, gl.UNSIGNED_INT, 0);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }

  /** render the queued scene with camera cam. accumulate: weight for motion blur (first: clear) */
  _mark(name) {
    if (!this.stageSync) return;
    this.stageSync();
    const t = performance.now();
    this.stageT.push(name + ':' + (t - (this._lastMark || t)).toFixed(0));
    this._lastMark = t;
  }
  render(cam, acc = null) {
    const gl = this.gl, S = this.scene;
    this._lastMark = performance.now();
    this._bakeEnv();
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    // ---- shadow maps ----
    if (S.key && S.key.shadow) {
      const k = S.key;
      this._shM0 = m4.orthoLight(k.center || [0, 0.8, 0], k.dir, k.ext ?? 2.5, k.depth ?? 8);
      this._shadowPass(this.sh0, this._shM0);
    }
    if (S.skyAO) {
      const a = S.skyAO;
      this._shM1 = m4.orthoLight(a.center || [0, 1, 0], [0.0001, -1, 0.0002], a.ext ?? 4, a.depth ?? 6);
      this._shadowPass(this.sh1, this._shM1);
    }
    this._mark('shadows');
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    // draw order: front-to-back opaque (early depth rejection), clip-plane draws after, floors last
    const cp = cam.pos;
    const dist = (d) => (d.M[12] - cp[0]) ** 2 + (d.M[13] - cp[1]) ** 2 + (d.M[14] - cp[2]) ** 2;
    const order = this.queue.map((d) => ({ d, k: (d.mat.floor ? 2e9 : 0) + (d.mat.clip ? 1e9 : 0) + dist(d) }));
    order.sort((a, b) => a.k - b.k);
    const drawList = order.map((o) => o.d);
    const progs = [this.P.main, this.P.mainClip];
    const pass = (mirrorY, refPass, filter) => {
      for (const pr of progs) {
        gl.useProgram(pr.p);
        this._camUniforms(pr, cam, mirrorY);
        this._sceneUniforms(pr, cam, refPass);
      }
      let cur = null;
      for (const d of drawList) {
        if (filter && !filter(d)) continue;
        const pr = d.mat.clip ? this.P.mainClip : this.P.main;
        if (pr !== cur) {
          gl.useProgram(pr.p);
          cur = pr;
        }
        this._matUniforms(pr, d.mat);
        gl.uniformMatrix4fv(pr.u.uM, false, d.M);
        gl.bindVertexArray(d.mesh.vao);
        gl.drawElements(gl.TRIANGLES, d.mesh.n, gl.UNSIGNED_INT, 0);
      }
    };
    // ---- floor reflection (mirrored, quarter res) ----
    if (S.reflect) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.refl.fb);
      gl.viewport(0, 0, this.refl.w, this.refl.h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      pass(-1, true, (d) => !d.mat.floor && !d.mat.noReflect);
      // emissive beams are mirrored too (lasers and light shafts reflect in the floor)
      this._beams(cam, -1);
    }
    this._mark('refl');
    // ---- main pass ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.ms.fb);
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    pass(1, false, null);
    // decals (premultiplied over)
    if (this.decals.length) {
      const P = this.P.decal;
      gl.useProgram(P.p);
      this._camUniforms(P, cam);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      for (const d of this.decals) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, d.d.tex);
        gl.uniform1i(P.u.uTex, 0);
        gl.uniform4fv(P.u.uTint, d.o.tint || [1, 1, 1, 1]);
        gl.uniform3fv(P.u.uGlow, d.o.glow || [0, 0, 0]);
        this._clipUniforms(P, d.o.clip);
        gl.uniformMatrix4fv(P.u.uM, false, d.M);
        gl.bindVertexArray(d.d.vao);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
      }
      gl.depthMask(true);
    }
    // additive layers: holograms, wires, beams
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    if (this.holo.length) {
      const P = this.P.holo;
      gl.useProgram(P.p);
      this._camUniforms(P, cam, 1);
      gl.uniform3fv(P.u.uEye, cam.pos);
      gl.uniform1f(P.u.uTime, S.time || 0);
      for (const h of this.holo) {
        gl.uniform3fv(P.u.uHoloC, h.o.rgb || [0.3, 0.8, 1]);
        gl.uniform1f(P.u.uHoloA, h.o.a ?? 1);
        gl.uniform1f(P.u.uLineF, h.o.lineF ?? 260);
        this._clipUniforms(P, h.o.clip);
        gl.uniformMatrix4fv(P.u.uM, false, h.M);
        gl.bindVertexArray(h.mesh.vao);
        gl.drawElements(gl.TRIANGLES, h.mesh.n, gl.UNSIGNED_INT, 0);
      }
    }
    if (this.wires.length) {
      const P = this.P.line;
      gl.useProgram(P.p);
      this._camUniforms(P, cam);
      for (const w of this.wires) {
        gl.uniform3fv(P.u.uC, w.o.rgb || [0.4, 0.85, 1]);
        gl.uniform1f(P.u.uA, w.o.a ?? 1);
        this._clipUniforms(P, w.o.clip);
        if (w.o.noDepth) gl.disable(gl.DEPTH_TEST);
        gl.uniformMatrix4fv(P.u.uM, false, w.M);
        gl.bindVertexArray(w.mesh.wire.vao);
        gl.drawArrays(gl.LINES, 0, w.mesh.wire.n);
        if (w.o.noDepth) gl.enable(gl.DEPTH_TEST);
      }
    }
    this._beams(cam, 1);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    this._mark('main');
    // ---- resolve ----
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.ms.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.res.fb);
    gl.blitFramebuffer(0, 0, this.W, this.H, 0, 0, this.W, this.H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    this.out = this.res.tex;
    this._mark('resolve');
    if (acc) {
      // accumulate sub-frames: acc.first clears
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.acc.fb);
      gl.viewport(0, 0, this.W, this.H);
      if (acc.first) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      const P = this.P.acc;
      gl.useProgram(P.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.res.tex);
      gl.uniform1i(P.u.uSrc, 0);
      gl.uniform1f(P.u.uW, acc.w);
      gl.bindVertexArray(this.fsVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND);
      this.out = this.acc.tex;
    }
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    return this.out;
  }

  _beams(cam, mirrorY) {
    if (!this.beams.length) return;
    const gl = this.gl;
    // build camera-facing quads on the CPU
    const n = this.beams.length;
    const data = new Float32Array(n * 6 * 6);
    let o = 0;
    const eye = cam.pos;
    for (const b of this.beams) {
      const a = mirrorY < 0 ? [b.a[0], -b.a[1], b.a[2]] : b.a;
      const c = mirrorY < 0 ? [b.b[0], -b.b[1], b.b[2]] : b.b;
      const d = nrm([c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
      const mid = [(a[0] + c[0]) / 2 - eye[0], (a[1] + c[1]) / 2 - eye[1], (a[2] + c[2]) / 2 - eye[2]];
      let s = cross(d, mid);
      s = nrm(s);
      const q = (p, w, x, y) => {
        data[o++] = p[0] + s[0] * w * x;
        data[o++] = p[1] + s[1] * w * x;
        data[o++] = p[2] + s[2] * w * x;
        data[o++] = x;
        data[o++] = y;
        data[o++] = b.alpha;
      };
      q(a, b.w0, -1, 0); q(a, b.w0, 1, 0); q(c, b.w1, 1, 1);
      q(a, b.w0, -1, 0); q(c, b.w1, 1, 1); q(c, b.w1, -1, 1);
    }
    const P = this.P.beam;
    gl.useProgram(P.p);
    // the mirrored pass reuses the real camera with mirrored geometry (vertices already flipped)
    this._camUniforms(P, cam);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.bindVertexArray(this.beamVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.beamBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    let i = 0;
    for (const b of this.beams) {
      gl.uniform3fv(P.u.uC, b.rgb.map((v) => v * (mirrorY < 0 ? 0.5 : 1)));
      gl.uniform1f(P.u.uCore, b.core);
      gl.drawArrays(gl.TRIANGLES, i * 6, 6);
      i++;
    }
    gl.depthMask(true);
    if (mirrorY < 0) gl.disable(gl.BLEND);
  }
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function nrm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
