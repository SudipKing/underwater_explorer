// LIFE — kelp, jellyfish, boid fish, marine snow. Rasterized + instanced on top of the raymarched world.
// Meshes are generated in the vertex shaders from gl_VertexID (no vertex buffers); only per-instance data is uploaded.

// shared VS helper: vertex of an n-wide quad grid drawn as plain TRIANGLES (6 verts per quad) -> integer grid coords
const lfG = /*glsl*/`
vec2 lg(int n){int q=gl_VertexID/6,c=gl_VertexID%6;return vec2(q%n+int(c==1||c>2&&c<5),q/n+int(c==2||c>3));}
`,
// ---- kelp: 14-segment ribbon (30-vert strip). lI = root xyz, height
lfKV = /*glsl*/`
layout(location=0)in vec4 lI;
out vec3 lp,lq;
void main(){
float k=float(gl_VertexID>>1)/14.,s=float(gl_VertexID&1)*2.-1.,r=h1(float(gl_InstanceID)),H=lI.w,y=k*H,
e=lI.x*.31+lI.z*.37+r*6.,n=r*6.2832,w=n+y*.5+sin(uT*.5+e)*.7;
vec3 p=lI.xyz;
// layered sway + slow current (grow with height^2), per-blade lean, then the twisting blade width
p.xz+=(vec2(sin(uT*.7+e+y*.35)+.5*sin(uT*1.3+e*1.7+y*.8),cos(uT*.6+e*1.3+y*.3)+.5*sin(uT*1.1+e+y*.7))*.1
+vec2(.25,.1)*(1.+.5*sin(uT*.2+lI.x*.05)))*k*k*H
+vec2(cos(n),sin(n))*k*(.4+r)
+vec2(cos(w),sin(w))*s*(.1+.12*r)*sin(min(k*4.,1.)*1.5708)*(1.-.85*k*k);
p.y+=y;
lp=p;lq=vec3(k,s,r);
gl_Position=proj(p);}
`,
lfKF = /*glsl*/`
in vec3 lp,lq;
void main(){
float k=lq.x;
vec3 c=mix(vec3(.04,.06,.015),vec3(.5,.5,.1),k*k)*(.65+.35*abs(lq.y))*(.8+.4*n3(vec3(lq.xy*vec2(40.,2.),lq.z*9.)));
o=vec4(tone(fog(c*lit(lp)*(1.+3.*k*pow(max(dot(normalize(lp-uP),SUN),0.),4.)),lp)),1.);}
`,
// ---- jellyfish: 12x10 grid, rows 0-5 bell, 5-10 trailing skirt/tentacles. lI = centre xyz, size; lJ = rgb, phase
lfJV = /*glsl*/`
layout(location=0)in vec4 lI;
layout(location=1)in vec4 lJ;
out vec3 lp,ln,lc,ll;
out vec2 lu;
void main(){
lu=lg(12)/vec2(12.,10.);
float n=lu.x*6.2832,b=min(lu.y*2.,1.)*1.5708,e=max(lu.y*2.-1.,0.),t=uT*1.5+lJ.w,
q=sin(t-b-e*3.),r=sin(b)*(1.+.16*q*b)*(1.-.5*e);
vec3 c=lI.xyz+vec3(sin(uT*.11+lJ.w*2.)*.8,sin(uT*.3+lJ.w)*.6+.12*sin(t-2.),cos(uT*.13+lJ.w)*.8);
lp=c+(vec3(cos(n)*r,cos(b)*(.75-.1*q)-e*2.6,sin(n)*r)+e*.35*vec3(sin(t*.6-e*4.),0.,cos(t*.5-e*3.)))*lI.w;
ln=vec3(cos(n)*sin(b),cos(b)+.15,sin(n)*sin(b));
lc=lJ.rgb;ll=lit(c);
gl_Position=proj(lp);}
`,
lfJF = /*glsl*/`
in vec3 lp,ln,lc,ll;
in vec2 lu;
void main(){
float e=max(lu.y*2.-1.,0.),f=1.-abs(dot(normalize(ln),normalize(uP-lp))),x=lu.x*6.2832,
m=e>0.?pow(.5+.5*sin(x*7.),6.)*(1.-e)*.8:.2+.7*f*f+.4*pow(.5+.5*sin(x*8.),4.)*lu.y;
vec3 c=max(lc+.4*f*cos(6.2832*(f+vec3(0.,.33,.67))+lu.y*3.),0.);
o=vec4(tone(fog(c*(.2*ll+.5+1.5*f*f),lp)),m);}
`,
// ---- fish: 6x6 grid spindle + tail. lI = pos xyz, wag phase; lJ = velocity xyz, school
lfFV = /*glsl*/`
layout(location=0)in vec4 lI;
layout(location=1)in vec4 lJ;
out vec3 lp,ln,lq;
void main(){
vec2 k=lg(6)/6.;
float u=k.x,n=k.y*6.2832,b=pow(abs(sin(min(u/.8,1.)*3.1416)),.7);
vec3 l=vec3(.5-u,cos(n)*(.2*b+max(u-.8,0.)*1.3),sin(n)*.09*b+sin(lI.w-u*4.)*.13*u*u),
f=normalize(lJ.xyz+vec3(1e-4,0.,0.)),r=normalize(cross(f,vec3(0.,1.,0.))),w=cross(r,f);
lp=lI.xyz+(f*l.x+w*l.y+r*l.z)*(.42+.14*h1(float(gl_InstanceID)));
ln=w*cos(n)*.5+r*sin(n);
lq=vec3(u,cos(n),lJ.w);
gl_Position=proj(lp);}
`,
lfFF = /*glsl*/`
in vec3 lp,ln,lq;
void main(){
vec3 n=normalize(ln),c=vec3(.5,.6,.75);
float s=lq.z,u=lq.x,t=lq.y;
if(s>2.5)c=vec3(.15,.55,.6);
else if(s>1.5)c=mix(vec3(.95,.75,.1),vec3(.06),step(.6,fract(u*6.)));
else if(s>.5)c=mix(vec3(1.,.35,.05),vec3(.9),step(abs(u-.3),.05));
c=mix(c,vec3(.85),.6*smoothstep(.2,1.,-t))*(1.-.55*smoothstep(0.,1.,t));
o=vec4(tone(fog((c*(.8+.2*n.y)+.6*pow(max(dot(n,normalize(SUN+normalize(uP-lp))),0.),30.))*lit(lp),lp)),1.);}
`,
// ---- marine snow + bubbles: stateless hash lattice wrapped in a 24 m cube around the camera
lfSV = /*glsl*/`
out vec4 lc;
void main(){
float i=float(gl_VertexID),k=h1(i*.731),b=step(.985,k),d;
vec3 p=vec3(h1(i),h1(i+.3),h1(i+.7))*24.+uT*vec3(.12,b*(1.+k)-.04,.07)+.25*sin(uT*(.3+k)*vec3(.9,.7,1.1)+i);
p=mod(p-uP,24.)-12.+uP;
d=length(p-uP);
lc=vec4(tone(max(fog((lit(p)*.35+glow(p)*step(k,.4)*3.)*(.6+.4*sin(uT*(2.+k*4.)+i)),p)-fog(vec3(0.),p),0.))
*(1.-smoothstep(8.,12.,d))*smoothstep(.2,1.5,d),b);
gl_Position=map(p)<.1||p.y>wave(p.xz)-.1?vec4(9.,9.,9.,1.):proj(p);
gl_PointSize=clamp(uR.y*(.01+.012*k+.03*b)/d,1.5,40.);}
`,
lfSF = /*glsl*/`
in vec4 lc;
void main(){
vec2 q=gl_PointCoord*2.-1.;
float r=dot(q,q),s=max(1.-r,0.);
o=vec4(lc.rgb*s*mix(s,.3+2.5*r*r,lc.w),1.);}
`,
lfD = new Float32Array(4e3),   // fish instances: x,y,z,phase, vx,vy,vz,school
lfW = new Float32Array(1500),  // cached wall-avoidance force per fish
lfH = [], lfV = [], lfC = [0, 0];
let lfP = [], lfQ = -1, lfN = 0, lfS = 7;
const lfR = () => (lfS = lfS * 16807 % 2147483647) / 2147483647,
// VAO + buffer holding n instanced vec4 attributes (locations 0..n-1)
lfA = (d, n, u) => {
  const v = gl.createVertexArray(), b = gl.createBuffer();
  gl.bindVertexArray(v); gl.bindBuffer(34962, b); gl.bufferData(34962, d, u || 35044);
  for (let i = 0; i < n; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, 5126, false, n * 16, i * 16); gl.vertexAttribDivisor(i, 1); }
  v.b = b; return v;
},
// (re)place school s around a home point
lfSch = (s, x, y, z) => {
  lfH[s] = [x, y, z];
  for (let i = s; i < 500; i += 4) lfD.set([x + lfR() * 4 - 2, y + lfR() * 2 - 1, z + lfR() * 4 - 2, lfR() * 6, lfR() - .5, 0, lfR() - .5, s], i * 8);
};
// pick 4 school homes in the most open water near SPAWN (no GL needed)
function lfFI() {
  const S = SPAWN;
  for (let i = 0; i < 4; i++) {
    let d = -1, a;
    for (let j = 0; j < 30; j++) {
      const p = [S[0] + lfR() * 50 - 25 + Math.sin(S[3]) * 10, -5 - lfR() * 9, S[2] + lfR() * 50 - 25 - Math.cos(S[3]) * 10], e = sdf(...p);
      if (e > d) d = e, a = p;
    }
    lfSch(i, ...a);
  }
}
// boids step: neighbours = same school only (half of it per frame), sdf-gradient checks staggered over 8 frames
function lfStep(dt, t) {
  const D = lfD, W = lfW, n = [120, 260, 500][QL], c = cam.p, H = (a, b, c) => Math.sqrt(a * a + b * b + c * c);
  lfN++;
  for (let s = 0; s < 4; s++) {   // schools left far behind re-form in open water near the player
    const h = lfH[s];
    if (H(h[0] - c[0], h[1] - c[1], h[2] - c[2]) > 50) {
      const a = lfR() * 6.28, r = 20 + lfR() * 12, x = c[0] + Math.cos(a) * r, y = Math.min(c[1] + lfR() * 8 - 4, -4), z = c[2] + Math.sin(a) * r;
      if (sdf(x, y, z) > 2.5) lfSch(s, x, y, z);
    }
  }
  for (let i = 0; i < n; i++) {
    const o = i * 8, s = i & 3, h = lfH[s], w = i * 3;
    let x = D[o], y = D[o + 1], z = D[o + 2], vx = D[o + 4], vy = D[o + 5], vz = D[o + 6],
      ax = 0, ay = 0, az = 0, cx = 0, cy = 0, cz = 0, mx = 0, my = 0, mz = 0, k = 0, dx, dy, dz, d, f;
    for (let j = s + (i + lfN & 1) * 4; j < n; j += 8) {   // alternate halves of the school each frame
      const p = j * 8; dx = D[p] - x; dy = D[p + 1] - y; dz = D[p + 2] - z; d = dx * dx + dy * dy + dz * dz;
      if (d < 9 && j != i) {
        k++; cx += dx; cy += dy; cz += dz; mx += D[p + 4]; my += D[p + 5]; mz += D[p + 6];
        if (d < .7) { f = Math.min(3 / (d + 1e-4), 60); ax -= dx * f; ay -= dy * f; az -= dz * f; }   // separation
      }
    }
    if (k) {   // cohesion + alignment
      f = .35 / k; d = .8 / k;
      ax += cx * f + mx * d - vx * .8; ay += cy * f + my * d - vy * .8; az += cz * f + mz * d - vz * .8;
    }
    if (!(i + lfN & 7)) {   // walls: sdf gradient a little ahead of the fish
      const e = .4, px = x + vx * .4, py = y + vy * .4, pz = z + vz * .4;
      d = sdf(px, py, pz);
      dx = sdf(px + e, py, pz) - d; dy = sdf(px, py + e, pz) - d; dz = sdf(px, py, pz + e) - d;
      f = 1 / (H(dx, dy, dz) + 1e-6); dx *= f; dy *= f; dz *= f;
      f = d < 3 ? (3 - d) * 2.5 : 0; W[w] = dx * f; W[w + 1] = dy * f; W[w + 2] = dz * f;
      if (d < .4) { f = .4 - d; x += dx * f; y += dy * f; z += dz * f; }
    }
    ax += W[w]; ay += W[w + 1]; az += W[w + 2];
    if (y > -2.5) ay -= (y + 2.5) * 4;   // surface
    // home (slowly orbiting)
    dx = h[0] + 6 * Math.cos(t * .1 + s * 2) - x; dy = h[1] - y; dz = h[2] + 6 * Math.sin(t * .1 + s * 2) - z;
    d = H(dx, dy, dz) + 1e-6; f = Math.min(Math.max(d - 6, 0), 8) * .4 / d;
    ax += dx * f; ay += dy * f * 2; az += dz * f;
    // flee the player
    dx = x - c[0]; dy = y - c[1]; dz = z - c[2]; d = H(dx, dy, dz) + 1e-6;
    if (d < 4) { f = (4 - d) * 9 / d; ax += dx * f; ay += dy * f; az += dz * f; }
    // relax to cruise speed, integrate, clamp
    d = H(vx, vy, vz) + 1e-6; f = (1.5 + s * .25 - d) * 2 / d;
    vx += (ax + vx * f) * dt + 1e-5; vy = (vy + (ay + vy * f) * dt) * (1 - dt); vz += (az + vz * f) * dt;
    d = H(vx, vy, vz); f = Math.min(Math.max(d, .7), 4.5) / d; vx *= f; vy *= f; vz *= f;
    x += vx * dt; y += vy * dt; z += vz * dt;
    if (y > -.8) y = -.8, vy = -Math.abs(vy);
    D[o] = x; D[o + 1] = y; D[o + 2] = z; D[o + 3] = (D[o + 3] + dt * (3 + d * f * 5)) % 6.2832;
    D[o + 4] = vx; D[o + 5] = vy; D[o + 6] = vz;
  }
}
function lifeInit() {
  const S = SPAWN, fx = Math.sin(S[3]), fz = -Math.cos(S[3]), pc = [], m = LM.length + 2;
  let a = [], i, j, x, y, z, d;
  // kelp patches: half scattered within 70 m of SPAWN, half in a band toward the labyrinth entrance
  for (i = 0; i < 48; i++) {
    d = lfR() * 6.28; x = 70 * Math.sqrt(lfR()); y = lfR() * 50 - 25;
    pc.push(i & 1 ? [S[0] + Math.cos(d) * x, S[2] + Math.sin(d) * x] : [S[0] + fx * x * .9 + fz * y, S[2] + fz * x * .9 - fx * y]);
  }
  for (i = 0; i < 520; i++) {   // plant i -> patch i%48, so any prefix of the buffer covers every patch
    x = pc[i % 48][0] + (lfR() + lfR() - 1) * 9; z = pc[i % 48][1] + (lfR() + lfR() - 1) * 9; y = -6;
    if (sdf(x, y, z) > .5) {
      for (j = 0; j < 40 && (d = sdf(x, y, z)) > .2; j++) y -= Math.max(d, .25);
      if (d <= .2) for (j = 3 + lfR() * 3 | 0; j--;) a.push(x + lfR() - .5, y - .5, z + lfR() - .5, Math.min(4 + 8 * lfR(), -1.5 - y));
    }
  }
  lfV[0] = lfA(new Float32Array(a), 1); lfC[0] = a.length / 4;
  // jellyfish: clusters at each landmark (its colour) + 2 shares scattered in open water ahead of SPAWN
  a = [];
  for (i = 0; i < 180; i++) {
    const L = LM[i % m], r = L ? 9 : 24, c = L || [S[0] + fx * 14, -10, S[2] + fz * 14, .3, .6, 1];
    for (j = 0; j < 8; j++) {
      x = c[0] + (lfR() - .5) * 2 * r; y = Math.min(c[1] + (lfR() - .5) * r * .7, -4); z = c[2] + (lfR() - .5) * 2 * r;
      if (sdf(x, y, z) > 2.2) {
        d = .75 / Math.max(c[3], c[4], c[5], .01);
        a.push(x, y, z, .35 + lfR() * .45, c[3] * d + lfR() * .25, c[4] * d + lfR() * .25, c[5] * d + lfR() * .25, lfR() * 6.28);
        break;
      }
    }
  }
  lfV[1] = lfA(new Float32Array(a), 2); lfC[1] = a.length / 8;
  lfFI();
  lfV[2] = lfA(lfD, 2, 35048);
  lfV[3] = gl.createVertexArray();
  gl.bindVertexArray(null);
}
function lifeDraw(t, dt) {
  const c = cam.p, q = QL, n = [120, 260, 500][q], k = [.4, .7, 1][q];
  if (c[1] > waveH(c[0], c[2], t)) return;
  if (lfQ != q) {   // programs carry `#define Q`, so rebuild when quality changes (also the first build)
    lfP.map(p => gl.deleteProgram(p));
    lfQ = q; lfP = [P(lfKV, lfKF), P(lfG + lfJV, lfJF), P(lfG + lfFV, lfFF), P(lfSV, lfSF)];
  }
  lfStep(dt, t);
  U(lfP[0]); gl.bindVertexArray(lfV[0]); gl.drawArraysInstanced(5, 0, 30, lfC[0] * k | 0);
  U(lfP[2]); gl.bindVertexArray(lfV[2]); gl.bindBuffer(34962, lfV[2].b); gl.bufferSubData(34962, 0, lfD, 0, n * 8);
  gl.drawArraysInstanced(4, 0, 216, n);
  gl.enable(3042); gl.depthMask(false); gl.blendFunc(770, 771);
  U(lfP[1]); gl.bindVertexArray(lfV[1]); gl.drawArraysInstanced(4, 0, 720, lfC[1] * k | 0);
  gl.blendFunc(1, 1);
  U(lfP[3]); gl.bindVertexArray(lfV[3]); gl.drawArrays(0, 0, [1500, 4000, 9000][q]);
  gl.disable(3042); gl.depthMask(true);
}
