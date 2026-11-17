// GEO — procedural labyrinth SDF. Layout (metres, +Y up, water surface y=0):
//  seabed y~-28; rock massif r~90 around origin, plateau y~-5; gate spires at (+-17,88) + lone spire (-34,-8) break the surface.
//  Tier 2 (y -30..-24): ruin corridor grid (lines x,z = +-18,+-54) + grand hall on x=0 (z -24..100, entrance faces +Z).
//  Tier 1 (y~-15) and tier 3 (y~-48): warped-grid coral caves (26 m cells).
//  Oculus sky shaft (0,-26) r7 links all tiers; Well (-54,-20) r3.5 links tiers 1-2 and drops into the magenta grotto;
//  grand stair from the oculus (z=-33,y=-30) down to the amber crypt (z=-69,y=-48).
//  Abyssal trench: rift arcing round the east flank (centre radius ~118 from the origin, arc coord u=atan(z,x)*118 in
//  [-55,85] at the seabed, [-27,57] at the floor), 12.4-19.6 m wide with ledges, floor y~-120, 4 rock arches across it.
// Surface detail (GLSL only, surface displacement <= .25 m, only where the analytic distance < 1.2 m; that band is
// scaled x.8 so a .8 march step stays safe): domain-warped fbm +
// gradient noise (ridges / cracks / pits) + barnacle domes; ruins get mortar grooves, chipped edges and carved runes.
const GEO = /*glsl*/`
const vec3 gA=vec3(52,-19,-52),gC=vec3(-52,-50,-26),gD=vec3(52,-38,26),gE=vec3(0,-50,-80);
// material of last map(): 0 sand, 1 rock, 2 ruin stone, 3 coral cave; + detail terms reused by surf()
// gF fbm, gR gradient noise, gB barnacle, gU rune stroke dist (m), gM mortar seam dist (m), gJ rune colour coord
float gk,gF,gR,gB,gU,gM,gJ,
// gL>0: 'march mode' = true displacement only within ~10 m of the camera (beyond that the detail is bump-only,
// evaluated just by the normal taps with gL=0), which keeps the primary march cheap
gL;
float gS(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
// gradient noise (~-1..1)
float gH(vec3 c,vec3 f){return dot(fract(h3(c)*vec3(1,57,113))*2.-1.,f);}
float gN(vec3 p){vec3 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);vec2 e=vec2(1,0);
return 1.6*mix(mix(mix(gH(i,f),gH(i+e.xyy,f-e.xyy),u.x),mix(gH(i+e.yxy,f-e.yxy),gH(i+e.xxy,f-e.xxy),u.x),u.y),
mix(mix(gH(i+e.yyx,f-e.yyx),gH(i+e.xyx,f-e.xyx),u.x),mix(gH(i+e.yxx,f-e.yxx),gH(i+1.,f-1.),u.x),u.y),u.z);}
// rune glyphs: stroke distance (m) on a .5 x .7 m cell grid; stave + up to 4 random strokes (diagonals, loop, bar)
float gY(vec2 u){
vec2 c=u*vec2(2,1.4286),l=fract(c)-.5;
float h=h2(floor(c)),d=abs(l.x-.2*fract(h*9.)+.1);
vec4 s=1.-step(.5,fract(h*vec4(3,7,17,31)));
d=min(min(d,abs(l.x-l.y)*.7+s.x),min(abs(l.x+l.y)*.7+s.y,abs(length(l-vec2(0,.12))-.2)+s.z));
d=min(d,abs(l.y+.6*fract(h*5.)-.3)+s.w);
return h<.2?.5:max(d,max(abs(l.x)-.3,abs(l.y)-.38))*.55;
}
// coarse shape (no noise detail); sets gk. Used for shadows / probes / secondary rays
float gQ(vec3 p){
float x=p.x,y=p.y,z=p.z,r=length(p.xz),
// dunes
g=(y+28.-1.2*sin(x*.06)*sin(z*.045+1.)-3.*sin(x*.011)*sin(z*.013))*.95,
// massif = smooth intersection of flared side and undulating plateau
m=-.8*gS(90.-r-(y+28.)*.35-5.*sin(x*.05+1.)*sin(z*.05),2.*sin(x*.06+1.)*sin(z*.05)-y-5.,6.);
// spires (cones)
m=min(m,.95*min(length(vec2(abs(x)-17.,z-88.))+(y-8.)*.22,length(vec2(x+34.,z+8.))+(y-10.)*.2));
float s=gS(g,m,5.);
// continuous sand(0)..rock(1) weight so the detail recipe blends across the dune/massif fillet
gk=clamp(.5+(g-m)*.25,0.,1.);
if(s>5.)return s;
if(r<104.){
// coral caves: warped grid, folded in y for tiers 1 & 3
float e=y+31.5;
vec2 q=p.xz+4.*sin(p.zx*.1+sign(e)*2.);
q=abs(mod(q+13.,26.)-13.);
float c=max(.65*(length(vec2(min(q.x,q.y),abs(e)-16.5+1.5*sin(x*.07+z*.05)))-3.-2.*sin(x*.09+e*.1)*sin(z*.08+1.)),length(p.xz-vec2(10,0))-80.);
// ruin corridor grid with door frames
vec2 u=abs(mod(p.xz,36.)-18.),w=abs(vec2(x,y+25.))-vec2(3,2);
float a=min(u.x,u.y),b=max(u.x,u.y),
R=max(max(max(a-2.6,abs(y+27.)-3.),max(abs(x),abs(z))-58.),min(.4-abs(abs(b-9.)-3.),max(a-1.7,y+25.))),
// grand hall with colonnade
H=max(max(length(max(w,0.))-3.,abs(z-38.)-62.),.7-length(vec2(abs(x)-3.8,mod(z,8.)-4.))),
// oculus + well shafts
O=min(max(length(p.xz+vec2(0,26))-7.,-52.-y),max(length(p.xz+vec2(54,20))-3.5,abs(y+28.5)-16.5)),
// grand stair
t=z+69.,n=floor(t*.5),l=y+48.-n,
T=.9*max(max(abs(x)-3.,-min(l,max(2.-t+2.*n,l-1.))),max(y+42.-.5*t,abs(t-18.)-23.)),
// grottoes
G=min(min(length(p-gA)-9.,length(p-gC)-13.),min(length(p-gD)-12.,length(p-gE)-12.)),
V=min(min(c,G),O),k=min(min(R,H),T);
if(-min(V,k)>s){gk=k<V?2.:3.;s=-min(V,k);}
}
if(r>95.&&r<140.){
// abyssal trench: b = signed offset across the rift, u = arc length along it; ledges = width waves in y
float u=atan(z,x)*118.,b=r-118.+3.*sin(z*.08+x*.03),
w=max(.55*(abs(b)-8.-1.8*sin(y*.4+b*.2+u*.04)),.9*max(-120.-y+1.5*sin(u*.2),abs(u-15.)-70.-(y+28.)*.3)),
// rock arches spanning it (one per 30 m of arc, sagging toward the walls)
i=floor(u/30.+.5),
a=.8*max(max(length(vec2(u-30.*i,y+45.+60.*fract(i*.618)+.03*b*b))-2.2,abs(b)-12.),abs(u-15.)-70.);
if(-w>s){s=-w;gk=1.;}
if(a<s){s=a;gk=1.;}
}
return s;
}
// full surface = coarse shape + organic detail near the surface
float map(vec3 p){
float s=gQ(p),x=p.x,y=p.y,z=p.z,lo=dot(p-uP,p-uP),w=gL>0.?1.-smoothstep(16.,49.,lo):1.-smoothstep(900.,2025.,lo);
// neutral detail values for surf() when the detail is skipped (far LOD)
gF=.47;gR=.5;gB=0.;gU=1.;gM=1.;gJ=0.;
// detail only in a thin band around the surface and within 45 m of the camera (LOD): keeps marching cheap
if(w<=0.)return s;
if(s<.45){
// organic detail: domain-warped fbm (knobs), gradient noise R (ridges |R|~0, pits R>.3, cracks), barnacle domes
float W=gN(p*.25),f,R,h,D;
vec3 q=p+W*vec3(.8,-.6,.67),c=p*1.1;
f=fbm(q*.45);R=gN(q*1.1);h=h3(floor(c));
c=fract(c)-.5-(fract(h*vec3(7,13,29))-.5)*.4;
gF=f;gR=R;gB=step(.5,h)*(1.-smoothstep(0.,.25,length(c)));
float k=1.-min(abs(R),1.),e=smoothstep(.25,.7,R);
f-=.47;
if(gk<1.5)D=mix(.1*f+.03*sin(dot(p.xz,vec2(2.1,1.3))+4.*f)+.015*k*k,.5*f+.03*k*k*k-.05*e+.035*gB,gk);
else if(gk<2.5){
// ruin masonry: running-bond block seams (2.5 x 1.25 x 2.5 m), chipped edges, rune grooves on pillars / wall band
float cy=floor(y*.8+.5);
vec3 m3=fract(vec3(x*.4,y*.8,z*.4)+vec3(cy*.5,.5,cy*.5));
m3=(.5-abs(m3-.5))/vec3(.4,.8,.4);
gM=min(m3.x,min(m3.y,m3.z));
vec2 pc=vec2(abs(x)-3.8,mod(z,8.)-4.);
bool pl=length(pc)<1.1;
gJ=pl?z:x+z;
gU=pl?gY(vec2(atan(pc.y,-pc.x)*.6366,y))+step(3.,abs(y+25.)):gY(vec2(x+z,y))+step(1.,abs(y+27.2));
D=.05*f-.03*(1.-smoothstep(0.,.12,gM))-.07*smoothstep(.05,.25,f)*(1.-smoothstep(0.,.4,gM))-.015*(1.-smoothstep(0.,.06,gU));
}else D=.35*f+.05*k*k*k*k+.07*smoothstep(.08,.25,f)-.05*e+.035*gB;
// x.8 keeps the detailed band Lipschitz-safe for a .8 march step
return (s-D*w)*.8;
}
// conservative bound for the detail we skipped
return s-.25;
}
float gW(vec3 q){float w=max(1.-dot(q,q)/900.,0.);return w*w*w;}
vec3 glow(vec3 p){
float j=floor(p.z*.125);
// hall colonnade: one light per pillar (both rows), cyan/violet alternating every 8 m, zero at cell borders
vec3 q=vec3(abs(p.x)-3.8,(p.y+25.)*.6,mod(p.z,8.)-4.);
float a=max(1.-dot(q,q)*.0625,0.)*step(abs(j-4.5),8.);
// ruin-corridor door frames: light under each lintel
vec2 u=abs(mod(p.xz,36.)-18.);
float b=max(u.x,u.y);
q=vec3(min(u.x,u.y),p.y+24.5,abs(b-9.)-3.);
float d=max(1.-dot(q,q)*.111,0.)*clamp(59.-max(abs(p.x),abs(p.z)),0.,1.);
vec3 C=vec3(.15,.85,1),V=vec3(.6,.25,1);
return 1.6*(vec3(.1,.9,1)*gW(p-gA)+vec3(1,.15,.8)*gW(p-gC)+vec3(.2,1,.3)*gW(p-gD)+vec3(1,.6,.1)*gW(p-gE))
+1.5*(a*a*mix(C,V,mod(j,2.))*(.8+.2*sin(uT*1.5+j))+d*d*mix(C,V,step(b,9.))*(.8+.2*sin(uT*1.2+b)))
// the abyss: violet glow rising from the trench floor
+vec3(.45,.12,1)*clamp((-88.-p.y)*.04,0.,1.);
}
// NOTE: relies on the detail globals left by the caller's last map() near p (the normal taps)
void surf(vec3 p,vec3 n,out vec3 alb,out vec3 emi){
float k=gk,f=gF,r=gR,y=p.y,t=n3(p*2.3),c=n3(p*.31+3.),
// crack lines, cavity AO, encrustation coverage, flora patches (floors + ceiling cracks)
e=1.-smoothstep(0.,.08,abs(r)),
ao=clamp(.5+2.*(f-.47)+.25*(1.-abs(r))-.4*smoothstep(.3,.5,r),.15,1.),
m=smoothstep(.42,.58,n3(p*.45+c*2.)),
fl=smoothstep(.62,.72,n3(p*.4+7.))*(smoothstep(.5,.85,n.y)*smoothstep(.4,.7,t)+smoothstep(.4,.8,-n.y)*e);
vec3 C=vec3(.15,.85,1),V=vec3(.6,.25,1),G=vec3(.2,.38,.12),
// coralline palette: pink / purple / orange
cc=mix(mix(vec3(.95,.35,.55),vec3(.55,.22,.7),smoothstep(.35,.65,t)),vec3(1,.5,.15),smoothstep(.55,.75,c));
// glowing veins along the crack network + moss, tinted by nearby lights
emi=glow(p)*(1.2*e*smoothstep(.4,.6,f)+.6*smoothstep(.6,.8,t)*max(n.y,0.));
if(k<.5){
// rippled sand, shell grit, algae tufts
alb=vec3(.8,.72,.55)*(.72+.3*t)*(.88+.12*sin(dot(p.xz,vec2(2.1,1.3))+4.*(f-.47)));
alb=mix(alb,vec3(1,.94,.86),.35*smoothstep(.72,.8,n3(p*23.)));
alb=mix(alb,G,.5*smoothstep(.6,.75,c));
}else if(k>1.5&&k<2.5){
// masonry: dark mortar, algae on tops, coralline crust; glowing runes + faint seams
alb=vec3(.5,.52,.46)*(.6+.5*f)*(.45+.55*smoothstep(0.,.1,gM));
alb=mix(mix(alb,G,smoothstep(.4,.9,n.y)*smoothstep(.45,.65,f)),cc*.8,.6*m*smoothstep(.5,.7,c));
float j=floor(gJ*.125);
emi+=mix(C,V,mod(j,2.))*(2.5*(1.-smoothstep(0.,.03,gU))*(.75+.25*sin(uT*2.+j))+.15*(1.-smoothstep(0.,.05,gM)));
}else{
// rock / coral: algae on tops, coralline patches, pale barnacles, dark basalt in the abyss
alb=mix(vec3(.32,.27,.23),G,smoothstep(.3,.9,n.y)*smoothstep(.4,.6,c))*(.5+f);
alb=mix(alb,cc*(.6+.5*f),m*(k>2.5?.85:.5));
alb=mix(alb,vec3(.88,.84,.76),gB);
alb=mix(alb,vec3(.1,.08,.14)*(.6+f),.75*clamp(-.025*(y+40.),0.,1.));
}
// pulsing bioluminescent flora (cyan / green / violet), per-patch phase
if(k>1.5||y<-40.)emi+=fl*mix(mix(C,vec3(.3,1,.3),smoothstep(.3,.5,c)),V,smoothstep(.55,.7,c))*(.3+1.4*pow(.5+.5*sin(uT*1.3+c*9.),2.));
alb*=mix(.7+.3*ao,ao,min(k,1.));
}
`;
// JS mirror of map() (noise detail omitted: surfaces differ by <= .25 m; values near walls by <= .36 m)
const gSn = Math.sin, gAb = Math.abs, gMn = Math.min, gMx = Math.max, gHy = Math.hypot, gFl = Math.floor,
  gMd = (a, b) => a - b * gFl(a / b),
  gSm = (a, b, k) => { const h = gMx(k - gAb(a - b), 0) / k; return gMn(a, b) - h * h * k * .25; };
function sdf(x, y, z) {
  const r = gHy(x, z), g = (y + 28 - 1.2 * gSn(x * .06) * gSn(z * .045 + 1) - 3 * gSn(x * .011) * gSn(z * .013)) * .95,
    m = gMn(-.8 * gSm(90 - r - (y + 28) * .35 - 5 * gSn(x * .05 + 1) * gSn(z * .05), 2 * gSn(x * .06 + 1) * gSn(z * .05) - y - 5, 6),
      .95 * gMn(gHy(gAb(x) - 17, z - 88) + (y - 8) * .22, gHy(x + 34, z + 8) + (y - 10) * .2));
  let s = gSm(g, m, 5);
  if (s > 5) return s;
  if (r < 104) {
    const e = y + 31.5, o = Math.sign(e) * 2,
      qx = gAb(gMd(x + 4 * gSn(z * .1 + o) + 13, 26) - 13), qz = gAb(gMd(z + 4 * gSn(x * .1 + o) + 13, 26) - 13),
      c = gMx(.65 * (gHy(gMn(qx, qz), gAb(e) - 16.5 + 1.5 * gSn(x * .07 + z * .05)) - 3 - 2 * gSn(x * .09 + e * .1) * gSn(z * .08 + 1)), gHy(x - 10, z) - 80),
      ux = gAb(gMd(x, 36) - 18), uz = gAb(gMd(z, 36) - 18), a = gMn(ux, uz), b = gMx(ux, uz),
      R = gMx(a - 2.6, gAb(y + 27) - 3, gMx(gAb(x), gAb(z)) - 58, gMn(.4 - gAb(gAb(b - 9) - 3), gMx(a - 1.7, y + 25))),
      H = gMx(gHy(gMx(gAb(x) - 3, 0), gMx(gAb(y + 25) - 2, 0)) - 3, gAb(z - 38) - 62, .7 - gHy(gAb(x) - 3.8, gMd(z, 8) - 4)),
      O = gMn(gMx(gHy(x, z + 26) - 7, -52 - y), gMx(gHy(x + 54, z + 20) - 3.5, gAb(y + 28.5) - 16.5)),
      t = z + 69, n = gFl(t * .5), l = y + 48 - n,
      T = .9 * gMx(gAb(x) - 3, -gMn(l, gMx(2 - t + 2 * n, l - 1)), y + 42 - .5 * t, gAb(t - 18) - 23),
      G = gMn(gHy(x - 52, y + 19, z + 52) - 9, gHy(x + 52, y + 50, z + 26) - 13, gHy(x - 52, y + 38, z - 26) - 12, gHy(x, y + 50, z + 80) - 12);
    s = gMx(s, -gMn(c, G, O, R, H, T));
  }
  if (r > 95 && r < 140) {
    const u = Math.atan2(z, x) * 118, b = r - 118 + 3 * gSn(z * .08 + x * .03), i = gFl(u / 30 + .5), f = i * .618 - gFl(i * .618);
    s = gMn(gMx(s, -gMx(.55 * (gAb(b) - 8 - 1.8 * gSn(y * .4 + b * .2 + u * .04)), .9 * gMx(-120 - y + 1.5 * gSn(u * .2), gAb(u - 15) - 70 - (y + 28) * .3))),
      .8 * gMx(gHy(u - 30 * i, y + 45 + 60 * f + .03 * b * b) - 2.2, gAb(b) - 12, gAb(u - 15) - 70));
  }
  return s;
}
const LM = [
  [0, -24, 92, .6, .9, 1, 'Sunken Gate'],
  [0, -22, -26, .7, .95, 1, 'The Oculus'],
  [52, -19, -52, .1, .9, 1, 'Azure Grotto'],
  [-52, -50, -26, 1, .15, .8, 'Orchid Vault'],
  [52, -38, 26, .2, 1, .3, 'Emerald Cistern'],
  [0, -50, -80, 1, .6, .1, 'Amber Crypt'],
  [-54, -28, -20, .5, .4, 1, 'The Well'],
  [115, -112, 30, .5, .2, 1, 'The Abyss']
];
const SPAWN = [0, -7, 128, 0];
