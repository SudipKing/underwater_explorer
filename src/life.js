// LIFE — kelp, jellyfish, boid fish, manta rays, marine snow + glow spores. Rasterized + instanced on top of the raymarched world.
// Meshes are generated in the vertex shaders from gl_VertexID (no vertex buffers); only per-instance data is uploaded.

// shared VS helper: vertex of an n-wide quad grid drawn as plain TRIANGLES (6 verts per quad) -> integer grid coords
const lfG = /*glsl*/`
vec2 lg(int i,int n){int q=i/6,c=i%6;return vec2(q%n+int(c==1||c>2&&c<5),q/n+int(c==2||c>3));}
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
// ---- jellyfish: bell+skirt grid (verts 0-719, alpha pass) + 10 glowing tentacle ribbons (verts 720-1319, additive pass). lI = centre xyz, size; lJ = rgb, phase
lfJV = /*glsl*/`
layout(location=0)in vec4 lI;
layout(location=1)in vec4 lJ;
out vec3 lp,ln,lc,ll;
out vec2 lu;
out float lw;
void main(){
int j=gl_VertexID-720;
float t=uT*1.5+lJ.w;
vec3 c=lI.xyz+vec3(sin(uT*.11+lJ.w*2.)*.8,sin(uT*.3+lJ.w)*.6+.12*sin(t-2.),cos(uT*.13+lJ.w)*.8),L;
ln=vec3(0.,-1.,0.);
lw=pow(.5-.5*sin(t-.8),2.);
if(j<0){
lu=lg(gl_VertexID,12)/vec2(12.,10.);
float n=lu.x*6.2832,b=min(lu.y*2.,1.)*1.5708,e=max(lu.y*2.-1.,0.),q=sin(t-b-e*3.),r=sin(b)*(1.+.16*q*b)*(1.-.5*e);
L=vec3(cos(n)*r,cos(b)*(.75-.1*q)-e,sin(n)*r)+e*.35*vec3(sin(t*.6-e*4.),0.,cos(t*.5-e*3.));
ln=vec3(cos(n)*sin(b),cos(b)+.15,sin(n)*sin(b));
lp=c+L*lI.w;
}else{
int g=j/6,m=j%6;
float s=float(g%10+int(m==2||m>3))/10.,d=float(g/10),w=float(m==1||m>2&&m<5)*2.-1.,a=d*.6283+.3*h1(d+lJ.w);
L=vec3(cos(a),0.,sin(a))*(.5+.126*sin(t-4.57))+vec3(.35*sin(t*.6-4.),-1.,.35*cos(t*.5-3.))
+vec3(cos(a)*.3+.2*sin(uT*1.7-s*6.+d*2.),-(2.5+3.*h1(d*5.+lJ.w))*(1.+.1*sin(t-s*3.)),sin(a)*.3+.2*cos(uT*1.4-s*5.+d*1.3))*s;
lp=c+L*lI.w+uM[0]*w*(.012+.003*length(c-uP))*(1.-.4*s);
lu=vec2(-2.-w,s);
}
lc=lJ.rgb;ll=lit(c);
gl_Position=proj(lp);}
`,
lfJF = /*glsl*/`
in vec3 lp,ln,lc,ll;
in vec2 lu;
in float lw;
void main(){
if(lu.x<0.){
float s=lu.y,w=lu.x+2.,k=1.-w*w;
o=vec4(tone(max(fog(lc*(.3+1.7*k*k)*(1.-.9*s)*(.6+.4*sin(s*16.-uT*3.))*(1.+2.5*lw)*.45,lp)-fog(vec3(0.),lp),0.)),1.);
return;}
float e=max(lu.y*2.-1.,0.),f=1.-abs(dot(normalize(ln),normalize(uP-lp))),x=lu.x*6.2832,
m=e>0.?pow(.5+.5*sin(x*7.),6.)*(1.-e)*.8:.2+.7*f*f+.4*pow(.5+.5*sin(x*8.),4.)*lu.y;
vec3 c=max(lc+.4*f*cos(6.2832*(f+vec3(0.,.33,.67))+lu.y*3.),0.);
o=vec4(tone(fog(c*(.2*ll+.5+1.5*f*f)*(1.+1.6*lw),lp)),m*(1.+.4*lw));}
`,
// ---- fish: 6x6 grid spindle + tail. lI = pos xyz, wag phase; lJ = velocity xyz, school
lfFV = /*glsl*/`
layout(location=0)in vec4 lI;
layout(location=1)in vec4 lJ;
out vec3 lp,ln,lq;
void main(){
vec2 k=lg(gl_VertexID,6)/6.;
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
if(s>4.5)c=vec3(.7,.15,.55);
else if(s>3.5)c=mix(vec3(.8,.85,.9),vec3(.1,.2,.4),step(.55,t));
else if(s>2.5)c=vec3(.15,.55,.6);
else if(s>1.5)c=mix(vec3(.95,.75,.1),vec3(.06),step(.6,fract(u*6.)));
else if(s>.5)c=mix(vec3(1.,.35,.05),vec3(.9),step(abs(u-.3),.05));
c=mix(c,vec3(.85),.6*smoothstep(.2,1.,-t))*(1.-.55*smoothstep(0.,1.,t));
o=vec4(tone(fog((c*(.5+.2*n.y)+.6*pow(max(dot(n,normalize(SUN+normalize(uP-lp))),0.),30.))*lit(lp),lp)),1.);}
`,
// ---- manta rays: stateless closed paths (kind lI.x: 0 shaft helix, 1 loops over seabed, 2 massif circuit). lI = kind, phase, size, dir
// mesh: 16x8 diamond wing grid, top sheet (verts 0-767) + belly sheet (768-1535) + tail ribbon (1536-1583)
lfMV = /*glsl*/`
layout(location=0)in vec4 lI;
out vec3 lp,ln,lq;
vec3 lm(vec4 I,float t){
float a=I.y+I.w*t*(I.x<.5?.4:I.x<1.5?.13:.022);
if(I.x<.5)return vec3(3.*cos(a),-26.5+18.5*sin(t*.06+I.y),-26.+3.*sin(a));
if(I.x<1.5)return vec3(22.*cos(a),-14.+3.*sin(a*1.5+I.y),112.+17.*sin(a));
return vec3(cos(a),0.,sin(a))*112.+vec3(0.,-16.+3.*sin(a*3.),0.);}
void main(){
int j=gl_VertexID,h=j/768;
float t=uT,W=1.75*lI.z,x,y,z,s,c,e=1.-2.*float(h);
vec3 p0=lm(lI,t-.6),p1=lm(lI,t),p2=lm(lI,t+.6),f=normalize(p2-p0),r=normalize(cross(f,vec3(0.,1.,0.))),u=cross(r,f);
float k=clamp(6.*cross(p1-p0,p2-p1).y/dot(p1-p0,p2-p1),-.7,.7);
vec3 R=r*cos(k)+u*sin(k),V=u*cos(k)-r*sin(k);
if(h<2){
vec2 g=lg(j%768,16)/vec2(16.,8.);
s=g.x*2.-1.;c=g.y;
float a=abs(s);
x=mix(.4-.5*a,-.45+.28*a,c);z=s;
y=.3*a*a*sin(t*3.6-a*2.5+lI.y*3.)-.1*a+.2*pow(max(1.-a,0.),2.)*sin(c*3.1416)*e;
ln=V*e;
lq=vec3(s,c,float(h));
}else{
vec2 g=lg(j-1536,1)/vec2(1.,8.);
x=-.45-g.y*2.2;y=.12*g.y*sin(t*2.-g.y*3.+lI.y);z=.15*g.y*sin(t*1.3-g.y*2.)+(g.x-.5)*.04/W;
ln=V;lq=vec3(0.,0.,2.);
}
lp=p1+(f*x+R*z+V*y)*W;
gl_Position=proj(lp);}
`,
lfMF = /*glsl*/`
in vec3 lp,ln,lq;
void main(){
vec3 n=normalize(ln),c;
float s=abs(lq.x),m=smoothstep(.6,.72,n3(vec3(s*7.,lq.y*5.,lq.z*3.)));
if(lq.z>1.5)c=vec3(.04,.05,.07);
else if(lq.z>.5)c=mix(vec3(.85,.88,.9)*(1.-.3*s),vec3(.12,.14,.18),m*.7);
else c=mix(vec3(.05,.07,.1),vec3(.5,.55,.6),m*smoothstep(.2,.8,lq.y)*.8);
o=vec4(tone(fog(c*(.75+.25*n.y)*lit(lp),lp)),1.);}
`,
// ---- marine snow + bubbles (vertex ids < 1e5) and glow spores (ids >= 1e5, drawn with first=1e5): stateless hash lattice wrapped around the camera
lfSV = /*glsl*/`
out vec4 lc;
void main(){
float i=float(gl_VertexID),z=step(1e5,i),k,b,d,m,L=24.+4.*z;
i-=z*1e5;k=h1(i*.731);b=step(.985,k)*(1.-z);
vec3 p=vec3(h1(i),h1(i+.3),h1(i+.7))*L+uT*mix(vec3(.12,b*(1.+k)-.04,.07),vec3(.05,.03,-.04),z)+mix(.25,1.,z)*sin(uT*(.3+k)*vec3(.9,.7,1.1)+i);
p=mod(p-uP,L)-L*.5+uP;
d=length(p-uP);m=gQ(p);
vec3 s=mix(lit(p)*.35+glow(p)*step(k,.4)*3.,mix(mix(vec3(.1,.9,1.),vec3(.3,1.,.4),step(.33,k)),vec3(.7,.3,1.),step(.66,k))*(.3+2.5*pow(.5+.5*sin(uT*(.5+k)+i*3.),2.)),z);
lc=vec4(tone(max(fog(s*(.6+.4*sin(uT*(2.+k*4.)+i)),p)-fog(vec3(0.),p),0.))
*(1.-smoothstep(8.+3.*z,12.+2.*z,d))*smoothstep(.2,1.5,d),b);
gl_Position=m<.1||p.y>wave(p.xz)-.1||z>.5&&h1(i*1.37)>1.-.9*smoothstep(3.,12.,m)?vec4(9.,9.,9.,1.):proj(p);
gl_PointSize=clamp(uR.y*(.01+.012*k+.03*b+z*.05)/d,1.5,50.);}
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
lfT = new Float32Array(500),   // per-fish startle 0..1
lfH = [], lfV = [], lfC = [0, 0];
let lfP = [], lfQ = -1, lfN = 0, lfS = 7;
const lfNS = 6,   // schools
lfX = (i, m, f, c, n) => { U(lfP[i]); gl.bindVertexArray(lfV[i]); gl.drawArraysInstanced(m, f, c, n); },
lfR = () => (lfS = lfS * 16807 % 2147483647) / 2147483647,
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
  for (let i = s; i < 500; i += lfNS) lfD.set([x + lfR() * 4 - 2, y + lfR() * 2 - 1, z + lfR() * 4 - 2, lfR() * 6, lfR() - .5, 0, lfR() - .5, s], i * 8);
};
// pick school homes in the most open water near SPAWN (no GL needed)
function lfFI() {
  const S = SPAWN;
  for (let i = 0; i < lfNS; i++) {
    let d = -1, a;
    for (let j = 0; j < 30; j++) {
      const p = [S[0] + lfR() * 50 - 25 + Math.sin(S[3]) * 10, -5 - lfR() * 9, S[2] + lfR() * 50 - 25 - Math.cos(S[3]) * 10], e = sdf(...p);
      if (e > d) d = e, a = p;
    }
    lfSch(i, ...a);
  }
}
// boids step: neighbours = same school only (half of it per frame), sdf-gradient checks staggered over 8 frames.
// Player: fish within 6 m are pushed sideways off the player's velocity line (school parts), startled (speed burst, stronger
// separation, weaker cohesion) for ~1.4 s, then pulled back to the school centroid / home (school reforms behind).
// Every few seconds each school makes a spontaneous darting turn.
function lfStep(dt, t) {
  const D = lfD, W = lfW, n = [120, 260, 500][QL], c = cam.p, v = cam.v, H = (a, b, c) => Math.sqrt(a * a + b * b + c * c),
    vs = H(...v), ux = v[0] / (vs + 1e-6), uy = v[1] / (vs + 1e-6), uz = v[2] / (vs + 1e-6), dr = [];
  lfN++;
  for (let s = 0; s < lfNS; s++) {
    const h = lfH[s], e = t / (2.5 + s * .7), k = Math.floor(e), p = e - k, r = Math.abs(Math.sin(k * 12.99 + s * 78.2) * 43758.5) % 1,
      g = r > .35 && p < .18 ? Math.sin(p / .18 * 3.1416) * 9 : 0;
    dr.push(g * Math.cos(r * 19), g * Math.sin(r * 19));   // school-wide dart force (x,z)
    if (H(h[0] - c[0], h[1] - c[1], h[2] - c[2]) > 50) {   // schools left far behind re-form in open water near the player
      const a = lfR() * 6.28, r = 20 + lfR() * 12, x = c[0] + Math.cos(a) * r, y = Math.min(c[1] + lfR() * 8 - 4, -4), z = c[2] + Math.sin(a) * r;
      if (sdf(x, y, z) > 2.5) lfSch(s, x, y, z);
    }
  }
  for (let i = 0; i < n; i++) {
    const o = i * 8, s = i % lfNS, h = lfH[s], w = i * 3, q = s * 2;
    let x = D[o], y = D[o + 1], z = D[o + 2], vx = D[o + 4], vy = D[o + 5], vz = D[o + 6], st = Math.max(lfT[i] - dt * .7, 0),
      ax = dr[q], ay = 0, az = dr[q + 1], cx = 0, cy = 0, cz = 0, mx = 0, my = 0, mz = 0, k = 0, dx, dy, dz, d, f, e;
    for (let j = s + (i + lfN & 1) * lfNS; j < n; j += lfNS * 2) {   // alternate halves of the school each frame
      const p = j * 8; dx = D[p] - x; dy = D[p + 1] - y; dz = D[p + 2] - z; d = dx * dx + dy * dy + dz * dz;
      if (d < 9 && j != i) {
        k++; cx += dx; cy += dy; cz += dz; mx += D[p + 4]; my += D[p + 5]; mz += D[p + 6];
        if (d < .7 + .6 * st) { f = Math.min(3 / (d + 1e-4), 60) * (1 + st * 1.5); ax -= dx * f; ay -= dy * f; az -= dz * f; }   // separation
      }
    }
    if (k) {   // cohesion + alignment
      f = .35 / k; d = .8 / k;
      ax += cx * f + mx * d - vx * .8; ay += cy * f + my * d - vy * .8; az += cz * f + mz * d - vz * .8;
    }
    if (!(i + lfN & (st > .3 ? 1 : 7))) {   // walls: sdf gradient a little ahead of the fish (every 2nd frame while startled)
      const e = .4, px = x + vx * .4, py = y + vy * .4, pz = z + vz * .4;
      d = sdf(px, py, pz);
      dx = sdf(px + e, py, pz) - d; dy = sdf(px, py + e, pz) - d; dz = sdf(px, py, pz + e) - d;
      f = 1 / (H(dx, dy, dz) + 1e-6); dx *= f; dy *= f; dz *= f;
      f = d < 3 ? (3 - d) * 2.5 : 0; W[w] = dx * f; W[w + 1] = dy * f; W[w + 2] = dz * f;
      if (d < .6) { f = .6 - d; x += dx * f; y += dy * f; z += dz * f; }
    }
    ax += W[w]; ay += W[w + 1]; az += W[w + 2];
    if (y > -2.5) ay -= (y + 2.5) * 4;   // surface
    // home (slowly orbiting): pulls the school back together after it has been split
    dx = h[0] + 6 * Math.cos(t * .1 + s * 2) - x; dy = h[1] - y; dz = h[2] + 6 * Math.sin(t * .1 + s * 2) - z;
    d = H(dx, dy, dz) + 1e-6; f = Math.min(Math.max(d - 2.5, 0), 8) * .4 / d;
    ax += dx * f; ay += dy * f * 2; az += dz * f;
    // flee the player: radial when close, sideways off the velocity line when moving
    dx = x - c[0]; dy = y - c[1]; dz = z - c[2]; d = H(dx, dy, dz) + 1e-6;
    if (d < 6) {
      if (d < 4) { f = (4 - d) * 9 / d; ax += dx * f; ay += dy * f; az += dz * f; st = 1; }
      if (vs > .4) {
        e = dx * ux + dy * uy + dz * uz;   // offset along the path (+ = ahead of the player)
        let qx = dx - e * ux, qy = (dy - e * uy) * .6, qz = dz - e * uz, g = H(qx, qy, qz);
        if (g < .3) qx = Math.cos(i * 2.4), qy = 0, qz = Math.sin(i * 2.4), g = 1;   // dead on the path: pick a side
        f = (6 - d) * 5 * (e > -2 ? 1 : .3) / g; ax += qx * f; ay += qy * f; az += qz * f; st = 1;
      }
    }
    lfT[i] = st;
    // relax to cruise speed (burst while startled / darting), integrate, clamp
    d = H(vx, vy, vz) + 1e-6; f = (1.5 + s * .2 + st * 3 - d) * 2 / d;
    vx += (ax + vx * f) * dt + 1e-5; vy = (vy + (ay + vy * f) * dt) * (1 - dt); vz += (az + vz * f) * dt;
    d = H(vx, vy, vz); f = Math.min(Math.max(d, .7), 4.5 + st * 2.5) / d; vx *= f; vy *= f; vz *= f;
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
  // jellyfish: clusters at each landmark (its colour) + 2 shares scattered in open water ahead of SPAWN; every 15th is a big "lantern"
  a = [];
  for (i = 0; i < 180; i++) {
    const L = LM[i % m], r = L ? 9 : 24, c = L || [S[0] + fx * 14, -10, S[2] + fz * 14, .3, .6, 1], B = i % 15 == 0;
    for (j = 0; j < 8; j++) {
      x = c[0] + (lfR() - .5) * 2 * r; y = Math.min(c[1] + (lfR() - .5) * r * .7, B ? -8 : -4); z = c[2] + (lfR() - .5) * 2 * r;
      if (sdf(x, y, z) > (B ? 4.5 : 2.2)) {
        d = .75 / Math.max(c[3], c[4], c[5], .01);
        a.push(x, y, z, B ? 1.1 + lfR() * .5 : .35 + lfR() * .45, c[3] * d + lfR() * .25, c[4] * d + lfR() * .25, c[5] * d + lfR() * .25, lfR() * 6.28);
        break;
      }
    }
  }
  lfV[1] = lfA(new Float32Array(a), 2); lfC[1] = a.length / 8;
  lfFI();
  lfV[2] = lfA(lfD, 2, 35048);
  lfV[3] = gl.createVertexArray();
  // mantas: kind, phase, size, direction (first 3 cover every path kind, so any prefix is a mix)
  lfV[4] = lfA(new Float32Array([0, 0, 1, 1, 1, 0, 1.1, 1, 2, 0, 1.15, 1, 0, 3.1416, .9, 1, 1, 3.1416, 1, -1, 2, 3.1416, 1.05, -1]), 1);
  gl.bindVertexArray(null);
}
function lifeDraw(t, dt) {
  const c = cam.p, q = QL, n = [120, 260, 500][q];
  let k = [.4, .7, 1][q];
  if (c[1] > waveH(c[0], c[2], t)) return;
  if (lfQ != q) {   // programs carry `#define Q`, so rebuild when quality changes (also the first build)
    lfP.map(p => gl.deleteProgram(p));
    lfQ = q; lfP = [P(lfKV, lfKF), P(lfG + lfJV, lfJF), P(lfG + lfFV, lfFF), P(lfSV, lfSF), P(lfG + lfMV, lfMF)];
  }
  if (PB()) return;
  lfStep(dt, t);
  lfX(0, 5, 0, 30, lfC[0] * k | 0);
  gl.bindBuffer(34962, lfV[2].b); gl.bufferSubData(34962, 0, lfD, 0, n * 8);
  lfX(2, 4, 0, 216, n);
  lfX(4, 4, 0, 1584, [3, 5, 6][q]);
  gl.enable(3042); gl.depthMask(false); gl.blendFunc(770, 771);
  lfX(1, 4, 0, 720, k = lfC[1] * k | 0);
  gl.blendFunc(1, 1);
  lfX(1, 4, 720, 600, k);   // glowing tentacles (additive)
  lfX(3, 0, 0, [1500, 4000, 9000][q], 1); lfX(3, 0, 1e5, [1200, 3000, 6000][q], 1);   // marine snow, then spores
  gl.disable(3042); gl.depthMask(true);
}
