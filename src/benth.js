// BENTH — sea-floor ecosystem: staghorn + brain corals, anemones, glow polyps, starfish, shells, clams, crabs.
// One instanced program for every type (uniform bG = sides, rows, type). Every mesh is a set of K tubes of S x R quads
// generated from gl_VertexID; per-instance data only (12 floats):
//   loc0 = root xyz, size   loc1 = surface normal xyz, seed   loc2 = yaw, gait, openness/excite, snap time
// Types: 0 staghorn 1 brain 2 anemone 3 glow polyps 4 starfish 5 shell 6 clam 7 crab (6,7 last: updated per frame).
const bnH = /*glsl*/`
uniform ivec3 bG;
`,
bnV = /*glsl*/`
layout(location=0)in vec4 bI;
layout(location=1)in vec4 bJ;
layout(location=2)in vec4 bK;
out vec3 bp,bn,bk,be,bl,bq;
const vec3 bP[8]=vec3[](vec3(1.,.25,.5),vec3(.65,.2,1.),vec3(1.,.45,.1),vec3(.1,.85,1.),vec3(1.,.15,.2),vec3(.95,.75,.2),vec3(.4,.9,.5),vec3(.3,.4,1.));
vec3 bm;
vec3 bh(float h){return bP[int(h*8.)&7];}
// tube vertex: centre a, axis d, radius r, flattened by w along the axis-normal that is closest to u, angle t (normal -> bm)
vec3 bt(vec3 a,vec3 d,float r,float w,vec3 u,float t){
d=normalize(d);vec3 x=normalize(cross(d,u)),y=cross(x,d);
bm=normalize(x*cos(t)*w+y*sin(t));
return a+(x*cos(t)+y*sin(t)*w)*r;}
// anemone tentacle centre line at v (ring angle a, phase p, extension g, local current w)
vec3 bA(float v,float a,float p,float g,vec3 w){
float m=g*(.3+.6*v)-(1.-g)*.5*v+.3*v*sin(uT*1.8-v*5.+p);
vec3 o=vec3(cos(a),0.,sin(a));
return o*.12+vec3(0.,.18+.12*g,0.)+(.15+.35*g)*v*(o*sin(m)+vec3(0.,cos(m),0.))+w*v*v*.3*g+vec3(-o.z,0.,o.x)*.05*v*sin(uT*2.3+p*2.-v*4.);}
void main(){
int S=bG.x,R=bG.y,Y=bG.z,i=gl_VertexID,n=S*R*6,k=i/n,c=i%6;
i=i%n/6;
float s=bI.w,h=bJ.w,f=float(k),D=distance(bI.xyz,uP),
t=float(i%S+int(c==1||c>2&&c<5))/float(S)*6.2832,g=float(i/S+int(c==2||c>3))/float(R);
vec3 P=bI.xyz,N=bJ.xyz;
// cull far / behind-camera instances before any map() work
if(D>35.+15.*float(Q)||dot(P-uP,uM[2])<-3.*s-1.){gl_Position=vec4(0.,0.,2.,1.);return;}
vec3 T=normalize(cross(abs(N.y)>.7?vec3(1.,0.,0.):vec3(0.,1.,0.),N)),B=cross(T,N);
T=T*cos(bK.x)+B*sin(bK.x);B=cross(T,N);
// snap the root onto the noisy GLSL surface along the stored normal
gL=1.;
for(int j=Z0;j<2;j++)P-=N*clamp(map(P),-.4,.4);
vec3 W=vec3(.7,0.,.5)*(.7+.3*sin(uT*.3+P.x*.1)),w=vec3(dot(W,T),dot(W,N),dot(W,B)),C=bh(h),E=vec3(0.),q=vec3(0.),l;
bm=vec3(0.,1.,0.);
if(Y==0){
// staghorn: 15 forked segments (heap order); walk the fork path from the root
int m=k+1,L=m>7?3:m>3?2:m>1?1:0;
vec3 o=vec3(0.),d=vec3(0.,1.,0.);float z=.4,r=.07;
for(int j=Z0;j<3;j++)if(j<L){o+=d*z;int b=m>>(L-1-j);float e=h1(float(b>>1)*7.1+h*50.)*6.2832;
d=normalize(d+normalize(cross(d,vec3(cos(e),0.,sin(e))))*(float(b&1)*1.4-.7)+vec3(0.,.35,0.));z*=.8;r*=.72;}
l=bt(o+d*z*g,d,r*(1.-g*(L>2?.6:.28)),1.,vec3(.3,.2,.93),t);
l.xz+=(w.xz*.12+.05*sin(uT*vec2(1.3,1.1)+h*9.))*l.y*l.y;
C=mix(C,vec3(1.,.95,.85),float(L/3)*g*.7);
E=step(.6,h1(h*3.))*float(L/3)*g*g*vec3(.1,.8,1.)*(.7+.5*sin(uT*2.+f));
}else if(Y==1){
// brain coral: breathing half-ellipsoid, grooves in the fragment shader
float b=g*1.5708,y=.6+.03*sin(uT*.7+h*9.),m=1.+.08*sin(t*3.+h*20.)*cos(b);
l=vec3(cos(t)*cos(b)*m,y*sin(b)-.12,sin(t)*cos(b)*m);
bm=normalize(vec3(cos(t)*cos(b),sin(b)/y,sin(t)*cos(b)));
q=l*s;C=mix(C,vec3(.6,.7,.4),.4);
}else if(Y==2){
// anemone: column + 8 tentacles; retract within ~2 m of the player
float r=smoothstep(1.2,2.5,D),a=f*.785+h*6.;
if(k<1){l=bt(vec3(0.,min(g,.67)*1.5*(.28+.12*r)-.1,0.),vec3(0.,1.,0.),g>.9?0.:.12+.04*g,1.,vec3(0.,0.,1.),t);
if(g>.9)bm=vec3(0.,1.,0.);}
else{float p=h*30.+f*1.3;vec3 o=bA(g,a,p,r,w);
l=bt(o,bA(g+.05,a,p,r,w)-o,.03*(1.-.6*g),1.,vec3(-sin(a),0.,cos(a)),t);
C=mix(C,bh(fract(h+.4)),g);
E=vec3(.1,.9,1.)*g*g*(.4+.4*sin(uT*2.+a*3.))*step(.4,h1(h*7.));}
}else if(Y==3){
// glow polyps: 4 pulsing bulbs
float r=(.5+.5*h1(f+h*9.))*.16*(1.+.15*sin(uT*2.+f+h*9.));
vec3 o=vec3((h1(f*3.1+h*30.)-.5)*.7,r*.4,(h1(f*1.7+h*20.)-.5)*.7);
l=bt(o+vec3(0.,(g-.5)*2.*r,0.),vec3(0.,1.,0.),r*sin(g*3.1416),1.,vec3(0.,0.,1.),t);
bm=normalize(l-o);
E=(h<.5?vec3(.1,.9,1.):h<.8?vec3(.9,.2,1.):vec3(.3,1.,.4))*(1.2+sin(uT*1.7+h*20.+f*2.))*1.5;C=E*.15+.1;
}else if(Y==4){
// starfish: 5 flattened tapering arms, tips cling, slow curl
float a=f*1.2566,u=.15*sin(uT*.4+h*20.+f*1.3)+.1;
vec3 o=vec3(cos(a),0.,sin(a));
l=bt(o*g+vec3(0.,.2*(1.-g*g)+u*g*g,0.),o+vec3(0.,2.*g*(u-.2),0.),.22*(1.-.8*g),.5,vec3(0.,1.,0.),t);
q=l*s;
}else if(Y==5){
// gastropod: log-spiral tube around local x, conch lip flare
float K=.12+.1*h1(h*9.),A=.3+1.2*h1(h*7.),V=g*12.57,r=exp(K*(V-12.57));
l=bt(r*vec3(-A,sin(V),cos(V))+vec3(A*.5,1.2,0.),vec3(-A*K,K*sin(V)+cos(V),K*cos(V)-sin(V)),.55*r*(1.+.5*smoothstep(.9,1.,g)),1.,vec3(1.,0.,0.),t);
l.y+=l.z*.05*sin(uT*.8+h*30.);
q=vec3(V,t,0.);C=mix(vec3(.9,.8,.65),C,.4);
}else if(Y==6){
// clam: two ribbed valves hinged at z=-1; openness bK.z from JS
float b=bK.z*(.2+.2*sin(uT*.5+h*20.)),y=k<1?-1.:1.;
l=vec3(cos(t)*g*.8,.3*(1.-g*g)*y,sin(t)*g-.3*(1.-g));
bm=normalize(vec3(l.x*.9,y,l.z*.6));
if(k>0){l.z+=1.;l.yz=rot(b)*l.yz;bm.yz=rot(b)*bm.yz;l.z-=1.;}
l.y+=.1;q=vec3(t,g,0.);
}else{
// crab: body, 8 two-segment legs (gait bK.y), 2 claws (raised by excitement bK.z), 2 eye stalks
float x=bK.z,r=.38*sqrt(abs(sin(g*3.1416))),y=.55;
int j=k-1,m=j>>1;
vec3 A=vec3(-.42,.3,0.),b=vec3(.42,.3,0.),u=vec3(0.,1.,0.);
C=mix(vec3(.9,.3,.1),C,.3)*(k>0?1.15:1.);
if(k>0&&k<17){float z=float(m&3)*.2-.3,o=m<4?-1.:1.,p=bK.y+float(m&3)*1.5708+(m<4?0.:3.1416),e=max(sin(p),0.);
vec3 H=vec3(o*.3,.25,z),M=vec3(o*.6,.45+e*.12,z*1.3),L=vec3(o*.85-cos(p)*.12,e*.15-.03,z*1.6);
A=j%2<1?H:M;b=j%2<1?M:L;r=j%2<1?.055-.015*g:.04-.025*g;y=1.;}
else if(k<21){j=k-17;float o=j<2?-1.:1.;
vec3 M=vec3(o*.42,.35+.25*x,.6);
A=j%2<1?vec3(o*.22,.28,.3):M;b=j%2<1?M:vec3(o*(.25+.04*sin(uT*4.+h*9.)),.35+.45*x,.95);
r=j%2<1?.05:.03+.1*sin(g*3.1416);y=.6;C*=1.-.8*float(j%2)*g*g;}
else{float o=k<22?-1.:1.;A=vec3(o*.1,.38,.33);b=vec3(o*.13,.55,.36);r=.025+.015*g;u=vec3(0.,0.,1.);y=1.;C=mix(C,vec3(.02),step(.6,g));}
l=bt(mix(A,b,g),b-A,r,y,u,t);
}
P+=N*(Y==4?.04:-.02);
vec3 X=P+(T*l.x+N*l.y+B*l.z)*s;
bn=T*bm.x+N*bm.y+B*bm.z;bp=X;bk=C;be=E;bq=q;bl=lit(X);
gl_Position=proj(X);}
`,
bnF = /*glsl*/`
in vec3 bp,bn,bk,be,bl,bq;
void main(){
int Y=bG.z;
vec3 d=normalize(uP-bp),n=normalize(bn),c=bk;
float f=dot(n,d);
if(Y==1)c*=.4+.6*smoothstep(-.5,.5,sin(n3(bq*5.)*28.));
if(Y==4)c*=.7+.5*step(.62,n3(bq*70.));
if(Y==5)c*=.8+.2*sin(bq.y*18.85+bq.x*2.)*sin(bq.x*9.);
if(Y==6)c=f<0.?c*1.3:mix(vec3(.75,.7,.62),c,.25)*(.85+.15*cos(bq.x*24.))*(.9+.1*sin(bq.y*40.));
if(f<0.){n=-n;if(Y==5)c=.7+.3*cos(6.2832*(f+vec3(0.,.33,.67)));}
o=vec4(tone(fog(c*bl*(.45+.55*max(dot(n,normalize(SUN+vec3(0.,1.,0.))),0.))+.25*pow(max(dot(reflect(-d,n),SUN),0.),20.)*bl+be,bp)),1.);}
`,
// clam snap puff: 4 expanding rings + 4 rising bubbles per clam (points, additive)
bnPV = /*glsl*/`
layout(location=0)in vec4 bI;
layout(location=1)in vec4 bJ;
layout(location=2)in vec4 bK;
out vec4 bw;
void main(){
float a=uT-bK.w,i=float(gl_VertexID),e=step(4.,i);
vec3 p=bI.xyz+bJ.xyz*bI.w*(.4+a*(1.+e*3.))+vec3(h1(i+bJ.w*50.)-.5,0.,h1(i*3.+bJ.w)-.5)*a*.8;
gl_Position=vec4(0.,0.,2.,1.);
if(a>1.4)return;
bw=vec4(tone(fog(lit(p)*.5,p))*(1.-a/1.4),e);
gl_Position=proj(p);
gl_PointSize=uR.y*bI.w*(e>0.?.25:.6+a*1.5)/max(distance(p,uP),.3);}
`,
bnPF = /*glsl*/`
in vec4 bw;
void main(){float r=length(gl_PointCoord*2.-1.);
o=vec4(bw.rgb*(bw.w>0.?(1.-smoothstep(.6,1.,r))*r*r*1.5:(1.-smoothstep(0.,.2,abs(r-.7)))*.6),1.);}
`,
bnT = [[5, 1, 15], [14, 5, 1], [4, 3, 9], [4, 3, 4], [4, 3, 5], [5, 14, 1], [10, 3, 2], [4, 3, 23]], // sides, rows, tubes
bnC = [180, 110, 150, 280, 260, 230, 110, 36],                                                      // max instances per type
bnZ = [.7, .8, .5, .7, .45, .45, .5, .5, .22, .26, .14, .18, .3, .3, .25, .25],              // size = a + b*rnd
// type weights (digits, by type) for surface classes: sandy floor, reef floor, grotto floor, wall, ceiling
bnW = ['11202631', '43412110', '32442110', '20134000', '00010000'],
bnA = [], bnN = [],
bnX = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
bnL = v => { const l = Math.hypot(...v); return v.map(c => c / l); },
bnR = () => (bnS = bnS * 16807 % 2147483647) / 2147483647,
bnG = (x, y, z) => bnL([sdf(x + .05, y, z) - sdf(x - .05, y, z), sdf(x, y + .05, z) - sdf(x, y - .05, z), sdf(x, y, z + .05) - sdf(x, y, z - .05)]),
// project p (in place) onto sdf=0 along the gradient; returns the unit normal, or 0 if not a valid underwater surface point
bnJ = p => {
  let n = bnG(...p), j, d;
  for (j = 0; j < 2; j++) { d = sdf(...p); p[0] -= n[0] * d; p[1] -= n[1] * d; p[2] -= n[2] * d; }
  n = bnG(...p);
  return Math.abs(sdf(...p)) < .05 && n[1] == n[1] && p[1] < -2.5 ? n : 0;
},
// march p along unit u to the surface
bnM = (p, u) => {
  let d = sdf(...p), s = 0, j = 0;
  if (!(d > .2)) return 0;
  for (; j < 48 && d > .02 && s < 45; j++) { d = Math.max(d * .9, .02); p[0] += u[0] * d; p[1] += u[1] * d; p[2] += u[2] * d; s += d; d = sdf(...p); }
  return d < .1 && bnJ(p);
};
let bnS = 11, bnD, bnB, bnK, bnO = 0, bnP = [], bnQ = -1;
function benthInit() {
  // zones: centre xyz, half-extent xyz, samples, P(random direction instead of straight down), floor weight table
  const Z = [[0, -12, 112, 25, 2, 22, 500, 0, 0], [0, -23, 38, 4.5, 1.5, 60, 600, .4, 0], [0, -3, -26, 20, 1, 20, 300, 0, 1],
    [10, -15, 0, 60, 2, 60, 500, 1, 1], [10, -48, 0, 60, 2, 60, 500, 1, 1]], I = bnT.map(() => []);
  let i, j, k, o = 0;
  for (const a of [18, -18, 54, -54]) Z.push([a, -26, 0, 1.5, 1, 56, 80, .5, 1], [0, -26, a, 56, 1, 1.5, 80, .5, 1]);
  for (const m of LM) Z.push(m[1] < -80 ? [m[0], m[1], m[2], 12, 6, 12, 300, .3, 0] : [m[0], m[1], m[2], 9, 7, 9, 250, 1, 2]);   // deep trench: sandy floor
  // round-robin over zones so the per-type caps are shared fairly
  for (i = 0; i < 600 && I.some((a, k) => a.length < bnC[k]); i++) for (const z of Z) {
    if (i >= z[6]) continue;
    const p = [0, 1, 2].map(c => z[c] + (bnR() * 2 - 1) * z[c + 3]),
      n = bnM(p, bnR() < z[7] ? bnL([bnR() - .5, bnR() - .5, bnR() - .5]) : [0, -1, 0]);
    if (!n) continue;
    const w = bnW[n[1] > .65 ? z[8] : n[1] < -.5 ? 4 : 3], f = k => I[k].length < bnC[k] ? w.charCodeAt(k) - 48 : 0;
    let s = 1e-9;
    for (k = 0; k < 8; k++) s += f(k);
    for (s *= bnR(), k = 0; k < 8 && (s -= f(k)) > 0; k++);
    if (k < 8) I[k].push([...p, bnZ[k * 2] + bnZ[k * 2 + 1] * bnR(), ...n, bnR(), bnR() * 6.2832, 0, 1, -99]);
  }
  // shuffle so any prefix (quality fraction) covers every zone
  for (const a of I) for (i = a.length; i > 1;) { j = bnR() * i-- | 0; [a[i], a[j]] = [a[j], a[i]]; }
  bnK = I[7].map(r => r.slice(0, 3));   // crab homes
  for (k = 0; k < 6; k++) bnO += I[k].length * 12;
  bnD = new Float32Array(I.flat(2));
  bnB = gl.createBuffer(); gl.bindBuffer(34962, bnB); gl.bufferData(34962, bnD, 35048);
  for (k = 0; k < 8; k++) {
    gl.bindVertexArray(bnA[k] = gl.createVertexArray());
    for (j = 0; j < 3; j++) { gl.enableVertexAttribArray(j); gl.vertexAttribPointer(j, 4, 5126, false, 48, o * 48 + j * 16); gl.vertexAttribDivisor(j, 1); }
    o += bnN[k] = I[k].length;
  }
  gl.bindVertexArray(null);
}
// clams snap shut near the player; crabs wander / sidestep away from the camera, glued to the sdf surface
function bnU(t, dt) {
  const D = bnD, c = cam.p, M = Math;
  let i, o = bnO, d;
  for (i = 0; i < bnN[6]; i++, o += 12) {
    d = M.hypot(D[o] - c[0], D[o + 1] - c[1], D[o + 2] - c[2]);
    if (d < 3) { if (D[o + 10] > .5) D[o + 11] = t; D[o + 10] = M.max(D[o + 10] - dt * 12, 0); }
    else if (d > 3.5) D[o + 10] = M.min(D[o + 10] + dt * .2, 1);
  }
  for (i = 0; i < bnN[7]; i++, o += 12) {
    const N = [D[o + 4], D[o + 5], D[o + 6]], A = bnL(bnX(M.abs(N[1]) > .7 ? [1, 0, 0] : [0, 1, 0], N)), B = bnX(A, N),
      p = [D[o], D[o + 1], D[o + 2]], h = bnK[i], s = D[o + 3], e = D[o + 7],
      f = p.map((v, j) => v - c[j]), H = h.map((v, j) => v - p[j]), r = M.hypot(...f), F = r < 5, b = M.hypot(...H) > 6,
      g = F ? f : b && H, w = e * 40 + M.sin(t * .13 + e * 9) * 3,
      x = g ? g[0] * A[0] + g[1] * A[1] + g[2] * A[2] : M.cos(w), z = g ? g[0] * B[0] + g[1] * B[1] + g[2] * B[2] : M.sin(w);
    let a = D[o + 8], q = M.atan2(z, x) - a, u = 1, v = F ? 1.8 - r * .3 : b ? .3 : .25 * M.max(M.sin(t * .4 + e * 30), 0);
    q -= 6.2832 * M.round(q / 6.2832);
    if (M.abs(q) > 1.5708) q -= M.sign(q) * 3.1416, u = -1;   // sidestep: either flank may lead
    a += M.max(-dt * 3, M.min(dt * 3, q));
    v *= M.max(M.cos(q), 0) * dt;
    if (v > 1e-4) {
      const C = M.cos(a), S = M.sin(a), m = p.map((y, j) => y + (A[j] * C + B[j] * S) * u * v), n = bnJ(m);
      if (n && n[1] > .3) D.set([...m, s, ...n], o); else a += 3.1416;   // blocked: turn around
    }
    D[o + 8] = a % 6.2832; D[o + 9] += u * v / (s * .1); D[o + 10] += ((F ? 1 : 0) - D[o + 10]) * M.min(dt * 3, 1);
  }
}
function benthDraw(t, dt) {
  const c = cam.p, q = QL, k = [.4, .7, 1][q];
  if (c[1] > waveH(c[0], c[2], t)) return;
  if (bnQ != q) {
    bnP.map(p => gl.deleteProgram(p));
    bnQ = q; bnP = [P(bnH + bnV, bnH + bnF), P(bnPV, bnPF)];
  }
  if (PB()) return;
  bnU(t, dt);
  gl.bindBuffer(34962, bnB); gl.bufferSubData(34962, bnO * 4, bnD, bnO);
  U(bnP[0]);
  bnT.map(([s, r, n], i) => { gl.uniform3i(bnP[0].l('bG'), s, r, i); gl.bindVertexArray(bnA[i]); gl.drawArraysInstanced(4, 0, s * r * n * 6, bnN[i] * k | 0); });
  gl.enable(3042); gl.depthMask(false); gl.blendFunc(1, 1);
  U(bnP[1]); gl.bindVertexArray(bnA[6]); gl.drawArraysInstanced(0, 0, 8, bnN[6] * k | 0);
  gl.disable(3042); gl.depthMask(true);
}
