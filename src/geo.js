// GEO — procedural labyrinth SDF. Layout (metres, +Y up, water surface y=0):
//  seabed y~-28; rock massif r~90 around origin, plateau y~-5; gate spires at (+-17,88) + lone spire (-34,-8) break the surface.
//  Tier 2 (y -30..-24): ruin corridor grid (lines x,z = +-18,+-54) + grand hall on x=0 (z -24..100, entrance faces +Z).
//  Tier 1 (y~-15) and tier 3 (y~-48): warped-grid coral caves (26 m cells).
//  Oculus sky shaft (0,-26) r7 links all tiers; Well (-54,-20) r3.5 links tiers 1-2 and drops into the magenta grotto;
//  grand stair from the oculus (z=-33,y=-30) down to the amber crypt (z=-69,y=-48).
const GEO = /*glsl*/`
const vec3 gA=vec3(52,-19,-52),gC=vec3(-52,-50,-26),gD=vec3(52,-38,26),gE=vec3(0,-50,-80);
float gk; // material of last map(): 0 sand, 1 rock, 2 ruin stone, 3 coral cave
float gS(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float map(vec3 p){
float x=p.x,y=p.y,z=p.z,
// dunes
g=(y+28.-1.2*sin(x*.06)*sin(z*.045+1.)-3.*sin(x*.011)*sin(z*.013))*.95,
// massif = smooth intersection of flared side and undulating plateau
m=-.8*gS(90.-length(p.xz)-(y+28.)*.35-5.*sin(x*.05+1.)*sin(z*.05),2.*sin(x*.06+1.)*sin(z*.05)-y-5.,6.);
// spires (cones)
m=min(m,.95*min(length(vec2(abs(x)-17.,z-88.))+(y-8.)*.22,length(vec2(x+34.,z+8.))+(y-10.)*.2));
float s=gS(g,m,5.);
gk=g<m?0.:1.;
if(s>5.)return s;
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
v=min(min(c,G),O),k=min(min(R,H),T);
if(-min(v,k)>s){gk=k<v?2.:3.;s=-min(v,k);}
if(s<1.)s-=(fbm(p*.8)-.47)*(gk==2.?.08:gk<.5?.15:.5);
return s;
}
float gW(vec3 q){float w=max(1.-dot(q,q)/900.,0.);return w*w*w;}
vec3 glow(vec3 p){
return 1.6*(vec3(.1,.9,1)*gW(p-gA)+vec3(1,.15,.8)*gW(p-gC)+vec3(.2,1,.3)*gW(p-gD)+vec3(1,.6,.1)*gW(p-gE));
}
void surf(vec3 p,vec3 n,out vec3 alb,out vec3 emi){
map(p);
float k=gk,f=fbm(p*.6),t=n3(p*2.3);
vec3 b=abs(fract(p*vec3(.4,.8,.4))-.5)+abs(n);
// glowing veins + moss in grotto light
emi=glow(p)*(3.-3.*smoothstep(0.,.03,abs(f-.45))+.5*smoothstep(.6,.8,t)*max(n.y,0.));
if(k<.5)alb=vec3(.8,.72,.55)*(.75+.3*t+.1*sin(p.x*3.+p.z*2.+4.*f));
else if(k==2.){
// block seams + rune band
alb=vec3(.5,.52,.46)*(.6+.5*f)*(.5+.5*smoothstep(0.,.03,min(b.x,min(b.y,b.z))));
emi+=vec3(.1,.8,.6)*step(.6,h3(floor(p*4.+.5)))*step(abs(p.y+27.),.4)*(1.-abs(n.y))*(.6+.4*sin(uT+p.x+p.z));
}else{
alb=mix(vec3(.3,.26,.22),vec3(.16,.3,.2),smoothstep(.2,.8,n.y)*t)*(.4+1.1*f);
if(k>2.)alb=mix(alb,mix(vec3(.9,.35,.3),vec3(.95,.6,.2),t),.8*smoothstep(.5,.62,n3(p*.3)));
}
}
`;
// JS mirror of map() (fbm detail omitted)
const gSn = Math.sin, gAb = Math.abs, gMn = Math.min, gMx = Math.max, gHy = Math.hypot, gFl = Math.floor,
  gMd = (a, b) => a - b * gFl(a / b),
  gSm = (a, b, k) => { const h = gMx(k - gAb(a - b), 0) / k; return gMn(a, b) - h * h * k * .25; };
function sdf(x, y, z) {
  const g = (y + 28 - 1.2 * gSn(x * .06) * gSn(z * .045 + 1) - 3 * gSn(x * .011) * gSn(z * .013)) * .95,
    m = gMn(-.8 * gSm(90 - gHy(x, z) - (y + 28) * .35 - 5 * gSn(x * .05 + 1) * gSn(z * .05), 2 * gSn(x * .06 + 1) * gSn(z * .05) - y - 5, 6),
      .95 * gMn(gHy(gAb(x) - 17, z - 88) + (y - 8) * .22, gHy(x + 34, z + 8) + (y - 10) * .2)),
    s = gSm(g, m, 5);
  if (s > 5) return s;
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
  return gMx(s, -gMn(c, G, O, R, H, T));
}
const LM = [
  [0, -24, 92, .6, .9, 1, 'Sunken Gate'],
  [0, -22, -26, .7, .95, 1, 'The Oculus'],
  [52, -19, -52, .1, .9, 1, 'Azure Grotto'],
  [-52, -50, -26, 1, .15, .8, 'Orchid Vault'],
  [52, -38, 26, .2, 1, .3, 'Emerald Cistern'],
  [0, -50, -80, 1, .6, .1, 'Amber Crypt'],
  [-54, -28, -20, .5, .4, 1, 'The Well']
];
const SPAWN = [0, -7, 128, 0];
