// HOST (owned by the integrator). Loaded LAST, after geo.js, atmo.js, life.js, ctrl.js.
// All files are concatenated into ONE classic <script>, so top-level names are shared globals.
const C = document.getElementById('c'),
  gl = C.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
const HDR = /*glsl*/`
uniform float uT;uniform vec2 uR;uniform vec3 uP;uniform mat3 uM;uniform sampler2D uS;uniform vec4 uC;
#define Z0 int(min(uT,0.))
const float F=.8,ZN=.1,ZF=400.;
const vec3 SUN=vec3(.4472,.7950,.4099);
float h1(float n){return fract(sin(n)*43758.5453);}
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float h3(vec3 p){p=fract(p*.3183+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+1.),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=Z0;i<4;i++){s+=a*n3(p);p=p*2.03+7.1;a*=.5;}return s;}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
vec3 ray(vec2 v){vec2 q=(v*2.-1.)*F;q.x*=uR.x/uR.y;return normalize(uM*vec3(q,1));}
vec4 proj(vec3 w){vec3 d=(w-uP)*uM;return vec4(d.x*uR.y/(F*uR.x),d.y/F,(d.z*(ZF+ZN)-2.*ZF*ZN)/(ZF-ZN),d.z);}
float dep(float w){return clamp((ZF+ZN-2.*ZF*ZN/max(w,ZN))/(ZF-ZN)*.5+.5,0.,1.);}
`;
// Programs compile in the background (KHR_parallel_shader_compile) so a cold start never freezes the page.
// PB() is true while any program is still compiling; errors are logged once a program completes.
const PL = [], KP = gl.getExtension('KHR_parallel_shader_compile'),
  LD = document.body.appendChild(Object.assign(document.createElement('div'), {
    textContent: 'GROWING THE REEF…',
    style: 'position:fixed;left:0;right:0;bottom:9%;text-align:center;color:#9ef;font:12px system-ui;letter-spacing:.3em;pointer-events:none'
  }));
function PB() {
  for (let i = PL.length; i--;) {
    const p = PL[i];
    if (gl.isProgram(p)) {
      if (KP && !gl.getProgramParameter(p, 37297)) return 1;
      if (!gl.getProgramParameter(p, 35714)) console.error(gl.getProgramInfoLog(p), p.s.map(x => gl.getShaderInfoLog(x)).join('\n'));
    }
    PL.splice(i, 1);
  }
  return 0;
}
// Compile a program. HDR+GEO+ATMO are prepended to BOTH stages; fragment stage also gets `out vec4 o;`.
function P(vs, fs) {
  const p = gl.createProgram(),
    h = '#version 300 es\nprecision highp float;precision highp int;\n#define Q ' + QL + '\n' + HDR + GEO + ATMO;
  p.s = [[35633, vs], [35632, 'out vec4 o;\n' + fs]].map(([k, s]) => {
    const x = gl.createShader(k);
    gl.shaderSource(x, h + s); gl.compileShader(x);
    gl.attachShader(p, x); return x;
  });
  gl.linkProgram(p); PL.push(p);
  p.c = {}; p.l = n => p.c[n] ??= gl.getUniformLocation(p, n);
  return p;
}
// Use program p and set the shared uniforms (uT,uR,uP,uM) for the current render target.
let T = 0, RW = 1, RH = 1, MB = new Float32Array(9);
function U(p) {
  gl.useProgram(p);
  gl.uniform1f(p.l('uT'), T); gl.uniform2f(p.l('uR'), RW, RH);
  gl.uniform3fv(p.l('uP'), cam.p); gl.uniformMatrix3fv(p.l('uM'), false, MB);
  // uC = (submerged-ness 0..1, seconds since last surface crossing, speed m/s, +1 if that crossing was upward into air else -1)
  gl.uniform4f(p.l('uC'), cam.sub, T - (cam.tx ?? -99), Math.hypot(...cam.v), cam.td || 0);
  return p;
}
const FVS = `out vec2 v;void main(){v=vec2(gl_VertexID&1,gl_VertexID>>1)*2.;gl_Position=vec4(v*2.-1.,0,1);}`,
  fvao = gl.createVertexArray(), fb = gl.createFramebuffer(), tx = gl.createTexture(),
  HF = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
let pS, pP, nS, nP, W = 0, H = 0, fw = 0, fh = 0, lq = -1, last = 0, drawn = 0;
function size() {
  const d = Math.min(devicePixelRatio || 1, [1, 1.5, 2][QL]), w = innerWidth * d | 0, h = innerHeight * d | 0;
  if (w == W && h == H && lq == QL) return;
  C.width = W = w; C.height = H = h;
  if (lq != QL) { nS = P(FVS, 'in vec2 v;' + SCENE); nP = P(FVS, 'in vec2 v;' + POST); lq = QL; }
  const s = [.45, .6, .85][QL]; fw = W * s | 0; fh = H * s | 0;
  gl.bindTexture(3553, tx);
  gl.texImage2D(3553, 0, HF ? 34842 : 32856, fw, fh, 0, 6408, HF ? 5131 : 5121, null);
  gl.texParameteri(3553, 10241, 9729); gl.texParameteri(3553, 10240, 9729);
  gl.texParameteri(3553, 10242, 33071); gl.texParameteri(3553, 10243, 33071);
  gl.bindFramebuffer(36160, fb); gl.framebufferTexture2D(36160, 36064, 3553, tx, 0);
  drawn = 0;
}
function frame(ms) {
  requestAnimationFrame(frame);
  const t = ms / 1e3, dt = Math.min(t - last, .05); last = t;
  size();
  ctrlStep(dt, T);
  const b = PB();
  LD.hidden = !b;
  // swap in freshly compiled scene programs; keep rendering with the old ones meanwhile
  if (nS && !b) { gl.deleteProgram(pS); gl.deleteProgram(pP); pS = nS; pP = nP; nS = 0; drawn = 0; }
  if (b) drawn = 0;
  if (paused && drawn) return;
  if (!paused) T += dt;
  drawn = 1;
  if (!pS) { benthDraw(T, dt); lifeDraw(T, dt); return; }   // first load: kick off life compiles too
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  // columns: right, up, forward. yaw=0,pitch=0 looks down -Z.
  MB.set([cy, 0, sy, -sy * sp, cp, cy * sp, sy * cp, sp, -cy * cp]);
  gl.bindVertexArray(fvao); gl.disable(3042);
  gl.bindFramebuffer(36160, fb); gl.viewport(0, 0, RW = fw, RH = fh);
  gl.disable(2929); U(pS); gl.drawArrays(4, 0, 3);
  gl.bindFramebuffer(36160, null); gl.viewport(0, 0, RW = W, RH = H);
  gl.enable(2929); gl.depthMask(true); gl.depthFunc(519);
  U(pP); gl.activeTexture(33984); gl.bindTexture(3553, tx); gl.uniform1i(pP.l('uS'), 0); gl.drawArrays(4, 0, 3);
  gl.depthFunc(515);
  benthDraw(T, dt);
  lifeDraw(T, dt);
}
ctrlInit(C); lifeInit(); benthInit(); requestAnimationFrame(frame);
